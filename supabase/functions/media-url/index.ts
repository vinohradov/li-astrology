// Li Astrology — signed URL for a hosted lesson media item
//
// The cabinet calls this for a lessons.media item that has `bunny_video_id` (video in
// Bunny Stream) or `storage_path` (audio/document in a Bunny Storage zone behind a pull
// zone). Access is checked the same way as the RLS helper owns_course(): the lesson is a
// free preview, or the caller has an unexpired user_courses row for its course. The
// returned URL carries a token that expires, so a copied link stops working.
//
// Auth: session token verified here with auth.getUser() (verify_jwt = false in
// config.toml — see claim-order for why). telegram_id comes from app_metadata.
//
// Secrets: BUNNY_LIBRARY_ID, BUNNY_TOKEN_KEY (Stream library → Security → token
// authentication key); BUNNY_FILES_HOST, BUNNY_FILES_TOKEN_KEY (pull zone hostname and its
// Security → Token authentication key).
//
// Responses:
//   200 { kind: 'bunny' | 'file', url, expires_at }
//   403 { error: 'no_access' }   404 { error: 'not_found' | 'not_hosted' }
//   401 { error: 'unauthorized' }   400 { error: 'bad_request' }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BUNNY_LIBRARY_ID = Deno.env.get('BUNNY_LIBRARY_ID') ?? ''
const BUNNY_TOKEN_KEY = Deno.env.get('BUNNY_TOKEN_KEY') ?? ''
const BUNNY_FILES_HOST = Deno.env.get('BUNNY_FILES_HOST') ?? ''
const BUNNY_FILES_TOKEN_KEY = Deno.env.get('BUNNY_FILES_TOKEN_KEY') ?? ''

// Long enough to finish a lesson with breaks; the player page has to be reloaded after that.
const TTL_SECONDS = 3 * 60 * 60

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

// Bunny CDN token authentication (HMAC-SHA256 variant): the message is path + expires.
async function cdnToken(key: string, path: string, expires: number): Promise<string> {
  const enc = new TextEncoder()
  const hmacKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, enc.encode(path + expires)))
  const b64 = btoa(String.fromCharCode(...sig))
  return 'HS256-' + b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth, error: authErr } = jwt ? await supabase.auth.getUser(jwt) : { data: null, error: true }
  const telegramId = Number(auth?.user?.app_metadata?.telegram_id)
  if (authErr || !auth?.user || !Number.isSafeInteger(telegramId) || telegramId <= 0) {
    return json({ error: 'unauthorized' }, 401)
  }

  let lessonId = ''
  let index = -1
  try {
    const body = await req.json()
    lessonId = typeof body?.lesson_id === 'string' ? body.lesson_id : ''
    index = Number.isInteger(body?.index) ? body.index : -1
  } catch { /* handled below */ }
  if (!/^[0-9a-f-]{36}$/i.test(lessonId) || index < 0) return json({ error: 'bad_request' }, 400)

  const { data: lesson, error: lessonErr } = await supabase
    .from('lessons')
    .select('course_id, is_free_preview, media')
    .eq('id', lessonId)
    .maybeSingle()
  if (lessonErr) {
    console.error('[media-url] lesson read failed', lessonErr.message)
    return json({ error: 'internal' }, 500)
  }
  if (!lesson) return json({ error: 'not_found' }, 404)

  if (!lesson.is_free_preview) {
    const { data: owned, error: ownErr } = await supabase
      .from('user_courses')
      .select('expires_at')
      .eq('user_id', telegramId)
      .eq('course_id', lesson.course_id)
      .maybeSingle()
    if (ownErr) {
      console.error('[media-url] access read failed', ownErr.message)
      return json({ error: 'internal' }, 500)
    }
    const active = owned && (!owned.expires_at || new Date(owned.expires_at).getTime() > Date.now())
    if (!active) return json({ error: 'no_access' }, 403)
  }

  const item = Array.isArray(lesson.media) ? lesson.media[index] : null
  if (!item) return json({ error: 'not_found' }, 404)

  const expires = Math.floor(Date.now() / 1000) + TTL_SECONDS

  if (item.bunny_video_id && BUNNY_LIBRARY_ID && BUNNY_TOKEN_KEY) {
    const token = await sha256Hex(BUNNY_TOKEN_KEY + item.bunny_video_id + expires)
    const url = `https://player.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${item.bunny_video_id}?token=${token}&expires=${expires}`
    return json({ kind: 'bunny', url, expires_at: expires })
  }

  // storage_path is written by tools/media-migrate and is ASCII-only, so it needs no encoding.
  if (typeof item.storage_path === 'string' && /^[\w./-]+$/.test(item.storage_path) && BUNNY_FILES_HOST && BUNNY_FILES_TOKEN_KEY) {
    const path = '/' + item.storage_path
    const token = await cdnToken(BUNNY_FILES_TOKEN_KEY, path, expires)
    return json({ kind: 'file', url: `https://${BUNNY_FILES_HOST}${path}?token=${token}&expires=${expires}`, expires_at: expires })
  }

  return json({ error: 'not_hosted' }, 404)
})
