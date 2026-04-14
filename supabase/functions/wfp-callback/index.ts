// Li Astrology — WayForPay Service URL (webhook)
// Receives payment status, updates payments row, grants user_courses when tg user is known.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'node:crypto'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WAYFORPAY_SECRET_KEY = Deno.env.get('WAYFORPAY_SECRET_KEY') || 'flk3409refn54t54t*FNJRET'
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface WfpCallback {
  merchantAccount: string
  orderReference: string
  merchantSignature: string
  amount: number
  currency: string
  authCode?: string
  cardPan?: string
  transactionStatus: string
  reasonCode: number | string
  reason?: string
  email?: string
  phone?: string
  createdDate?: number
  processingDate?: number
}

function hmacMd5(key: string, data: string): string {
  return createHmac('md5', key).update(data, 'utf8').digest('hex')
}

function verifySignature(cb: WfpCallback): boolean {
  const source = [
    cb.merchantAccount,
    cb.orderReference,
    cb.amount,
    cb.currency,
    cb.authCode ?? '',
    cb.cardPan ?? '',
    cb.transactionStatus,
    cb.reasonCode,
  ].join(';')
  const expected = hmacMd5(WAYFORPAY_SECRET_KEY, source)
  return expected === cb.merchantSignature
}

function buildResponse(orderReference: string) {
  const time = Math.floor(Date.now() / 1000)
  const status = 'accept'
  const signature = hmacMd5(WAYFORPAY_SECRET_KEY, [orderReference, status, time].join(';'))
  return { orderReference, status, time, signature }
}

async function notifyTelegram(chatId: number, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    })
  } catch (err) {
    console.error('telegram notify failed', err)
  }
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let cb: WfpCallback
  try {
    const raw = await req.text()
    // WFP may post application/x-www-form-urlencoded with a single "json" field, or JSON body
    cb = raw.trim().startsWith('{') ? JSON.parse(raw) : JSON.parse(new URLSearchParams(raw).get('json') || '{}')
  } catch {
    return new Response('bad body', { status: 400 })
  }

  if (!cb.orderReference || !cb.merchantSignature) {
    return new Response('missing fields', { status: 400 })
  }

  if (!verifySignature(cb)) {
    console.warn('WFP signature mismatch for', cb.orderReference)
    return new Response('bad signature', { status: 400 })
  }

  const { data: payment, error: fetchErr } = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', cb.orderReference)
    .single()

  if (fetchErr || !payment) {
    console.error('payment not found', cb.orderReference, fetchErr)
    return new Response('not found', { status: 404 })
  }

  // Idempotency: if already finalised, acknowledge
  if (payment.status === 'paid' || payment.status === 'refunded') {
    return json(buildResponse(cb.orderReference))
  }

  const approved = cb.transactionStatus === 'Approved'
  const newStatus = approved
    ? 'paid'
    : cb.transactionStatus === 'Expired' ? 'expired'
    : cb.transactionStatus === 'Refunded' ? 'refunded'
    : 'failed'

  await supabase.from('payments')
    .update({
      status: newStatus,
      provider_order_id: cb.authCode ?? null,
      paid_at: approved ? new Date().toISOString() : null,
      raw: cb as unknown as Record<string, unknown>,
      customer_email: cb.email ?? payment.customer_email,
      customer_phone: cb.phone ?? payment.customer_phone,
    })
    .eq('order_id', cb.orderReference)

  if (approved && payment.telegram_user_id) {
    // Resolve course UUID and insert user_courses (idempotent via UNIQUE)
    const { data: course } = await supabase
      .from('courses')
      .select('id, title')
      .eq('slug', payment.course_slug)
      .single()

    if (course) {
      await supabase.from('user_courses')
        .upsert({
          user_id: payment.telegram_user_id,
          course_id: course.id,
          payment_id: cb.orderReference,
          amount_paid: payment.amount * 100, // kopiykas
        }, { onConflict: 'user_id,course_id', ignoreDuplicates: true })

      await notifyTelegram(
        payment.telegram_user_id,
        `✅ Оплата успішна!\n\nВам відкрито доступ до курсу «${course.title}».\n\nНатисніть /my_courses щоб почати навчання.`,
      )
    }
  }

  return json(buildResponse(cb.orderReference))
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
