// Li Astrology — Telegram Login → Supabase Auth session
//
// The browser posts the raw Telegram Login Widget payload. We verify its hash with
// the bot token, make sure a Supabase Auth user exists for that Telegram account
// (telegram_id lives in app_metadata, which users cannot edit), and return a
// one-time magic-link token hash. The browser exchanges it for a normal session via
// supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }). No email is ever sent.
//
// verify_jwt = false: the caller has no session yet; the Telegram hash is the credential.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type User } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || ''

const MAX_AUTH_AGE_SEC = 24 * 3600
const EMAIL_DOMAIN = 'users.li-astrology.com.ua'
const TELEGRAM_FIELDS = ['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date'] as const

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

type TelegramAuth = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** https://core.telegram.org/widgets/login#checking-authorization */
function verifyTelegramHash(data: Record<string, unknown>, hash: string): boolean {
  const checkString = TELEGRAM_FIELDS
    .filter((k) => data[k] !== undefined && data[k] !== null)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join('\n')
  const secret = createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest()
  const expected = createHmac('sha256', secret).update(checkString).digest()
  let received: Uint8Array
  try {
    received = Uint8Array.from(hash.match(/.{2}/g)!.map((b) => parseInt(b, 16)))
  } catch {
    return false
  }
  return received.length === expected.length && timingSafeEqual(received, expected)
}

async function findUserByEmail(email: string): Promise<User | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const hit = data.users.find((u) => u.email === email)
    if (hit) return hit
    if (data.users.length < 1000) return null
  }
  return null
}

/** Returns the auth user for this Telegram account, creating or repairing it as needed. */
async function ensureAuthUser(tg: TelegramAuth, existingUid: string | null): Promise<User> {
  const email = `tg-${tg.id}@${EMAIL_DOMAIN}`
  // provider/providers in app_metadata are managed by Supabase Auth; we only own telegram_id.
  const appMeta = { telegram_id: tg.id }
  const userMeta = { first_name: tg.first_name ?? null, username: tg.username ?? null }

  let user: User | null = null
  if (existingUid) {
    const { data } = await supabase.auth.admin.getUserById(existingUid)
    user = data?.user ?? null
  }
  if (!user) user = await findUserByEmail(email)

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: appMeta,
      user_metadata: userMeta,
    })
    if (error || !data.user) throw error ?? new Error('createUser returned no user')
    return data.user
  }

  if (Number(user.app_metadata?.telegram_id) !== tg.id || user.email !== email) {
    // Self-heal: never trust a user whose telegram_id doesn't match the verified one.
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      email,
      email_confirm: true,
      app_metadata: appMeta,
    })
    if (error || !data.user) throw error ?? new Error('updateUserById returned no user')
    return data.user
  }
  return user
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (!TELEGRAM_BOT_TOKEN) return json({ error: 'not_configured' }, 500)

  let body: TelegramAuth
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  const id = Number(body?.id)
  const authDate = Number(body?.auth_date)
  if (!Number.isSafeInteger(id) || id <= 0 || !Number.isFinite(authDate) || typeof body.hash !== 'string') {
    return json({ error: 'bad_request' }, 400)
  }

  if (!verifyTelegramHash(body as unknown as Record<string, unknown>, body.hash)) {
    console.warn('[tg-auth] bad_hash', JSON.stringify({ id }))
    return json({ error: 'bad_hash' }, 401)
  }
  if (Math.floor(Date.now() / 1000) - authDate > MAX_AUTH_AGE_SEC) {
    return json({ error: 'expired' }, 401)
  }

  try {
    // Same fields the bot writes in upsertUser; lang, blocked_bot and started_bot_at are
    // left untouched (started_bot_at is set only by the bot on the user's first update, so
    // website-only sign-ups never enter the bot's messaging audiences).
    const profile = {
      first_name: body.first_name ?? null,
      last_name: body.last_name ?? null,
      username: body.username ?? null,
      last_active: new Date().toISOString(),
    }
    const { error: insertErr } = await supabase
      .from('bot_users')
      .upsert({ id, ...profile }, { onConflict: 'id', ignoreDuplicates: true })
    if (insertErr) throw insertErr
    const { data: botUser, error: updateErr } = await supabase
      .from('bot_users')
      .update(profile)
      .eq('id', id)
      .select('id, auth_uid')
      .single()
    if (updateErr) throw updateErr

    const user = await ensureAuthUser({ ...body, id }, botUser?.auth_uid ?? null)

    if (botUser?.auth_uid !== user.id) {
      const { error } = await supabase.from('bot_users').update({ auth_uid: user.id }).eq('id', id)
      if (error) throw error
    }

    const { data: link, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email!,
    })
    if (linkErr || !link?.properties?.hashed_token) throw linkErr ?? new Error('no hashed_token')

    console.log('[tg-auth] ok', JSON.stringify({ telegram_id: id, uid: user.id }))
    return json({ token_hash: link.properties.hashed_token, telegram_id: id })
  } catch (err) {
    console.error('[tg-auth] error', err instanceof Error ? err.message : err)
    return json({ error: 'internal' }, 500)
  }
})
