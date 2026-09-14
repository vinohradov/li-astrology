// Li Astrology — claim a web purchase from the cabinet
//
// Web-native twin of the bot's /start <order_id> flow (bot/src/handlers/start.ts
// handleOrderIdDeeplink + bot/src/db/payments.ts claimPaymentForUser):
// binds a paid, unclaimed web payment to the logged-in Telegram user and grants
// user_courses. Idempotent — calling it again for your own order returns 'granted'.
//
// Auth: the caller's Supabase session token is verified here with auth.getUser()
// (verify_jwt = false in config.toml because the gateway check does not support the
// project's asymmetric signing keys). telegram_id comes from app_metadata, which only
// tg-auth (service role) can write.
//
// Responses:
//   200 { status: 'granted', course_slug, course_title, course_id }
//   200 { status: 'pending' }            payment not confirmed yet — client polls
//   200 { status: 'failed' }             failed / expired / refunded
//   403 { status: 'claimed_by_other' }
//   404 { error: 'not_found' }   401 { error: 'unauthorized' }   400 { error: 'bad_request' }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth, error: authErr } = jwt ? await supabase.auth.getUser(jwt) : { data: null, error: true }
  const telegramId = Number(auth?.user?.app_metadata?.telegram_id)
  if (authErr || !auth?.user || !Number.isSafeInteger(telegramId) || telegramId <= 0) {
    return json({ error: 'unauthorized' }, 401)
  }

  let orderId = ''
  try {
    const body = await req.json()
    orderId = typeof body?.order_id === 'string' ? body.order_id.trim() : ''
  } catch { /* handled below */ }
  if (!orderId || orderId.length > 120) return json({ error: 'bad_request' }, 400)

  const { data: payment, error: payErr } = await supabase
    .from('payments')
    .select('order_id, status, course_slug, amount, telegram_user_id')
    .eq('order_id', orderId)
    .maybeSingle()
  if (payErr) {
    console.error('[claim-order] payment read failed', payErr.message)
    return json({ error: 'internal' }, 500)
  }
  if (!payment) return json({ error: 'not_found' }, 404)

  if (payment.status === 'pending') return json({ status: 'pending' })
  if (payment.status !== 'paid') return json({ status: 'failed' })

  if (payment.telegram_user_id === null) {
    // Conditional update: only one account can ever win an unclaimed order.
    const { data: claimed, error } = await supabase
      .from('payments')
      .update({ telegram_user_id: telegramId })
      .eq('order_id', orderId)
      .is('telegram_user_id', null)
      .select('telegram_user_id')
      .maybeSingle()
    if (error) {
      console.error('[claim-order] claim update failed', error.message)
      return json({ error: 'internal' }, 500)
    }
    if (!claimed) {
      const { data: now } = await supabase.from('payments').select('telegram_user_id').eq('order_id', orderId).single()
      if (now?.telegram_user_id !== telegramId) return json({ status: 'claimed_by_other' }, 403)
    }
  } else if (payment.telegram_user_id !== telegramId) {
    console.warn('[claim-order] claimed_by_other', JSON.stringify({ orderId, telegramId }))
    return json({ status: 'claimed_by_other' }, 403)
  }

  const { data: course } = await supabase
    .from('courses')
    .select('id, slug, title')
    .eq('slug', payment.course_slug)
    .single()
  if (!course) {
    console.error('[claim-order] course missing for payment', payment.course_slug)
    return json({ error: 'internal' }, 500)
  }

  const { error: grantErr } = await supabase.from('user_courses').upsert(
    {
      user_id: telegramId,
      course_id: course.id,
      payment_id: orderId,
      amount_paid: payment.amount * 100,
    },
    { onConflict: 'user_id,course_id', ignoreDuplicates: true },
  )
  if (grantErr) {
    console.error('[claim-order] grant failed', grantErr.message)
    return json({ error: 'internal' }, 500)
  }

  console.log('[claim-order] granted', JSON.stringify({ orderId, telegramId, course: course.slug }))
  return json({ status: 'granted', course_slug: course.slug, course_title: course.title, course_id: course.id })
})
