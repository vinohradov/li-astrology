// Li Astrology — MonoBank Acquiring Webhook
// Receives invoice status updates, verifies ECDSA signature, updates payments,
// grants user_courses when the tg user is known, notifies the user in Telegram.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createPublicKey, createVerify, type KeyObject } from 'node:crypto'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MONOBANK_TOKEN = Deno.env.get('MONOBANK_TOKEN') || ''
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface MonoCallback {
  invoiceId: string
  status: 'created' | 'processing' | 'hold' | 'success' | 'failure' | 'reversed' | 'expired'
  failureReason?: string
  errCode?: string
  amount: number
  ccy: number
  finalAmount?: number
  reference?: string
  createdDate?: string
  modifiedDate?: string
  cancelList?: unknown
}

let cachedPubKey: { key: KeyObject; fetchedAt: number } | null = null

async function getMonoPublicKey(): Promise<KeyObject> {
  // Refresh once per hour — Mono rotates keys rarely but we keep it cheap.
  if (cachedPubKey && Date.now() - cachedPubKey.fetchedAt < 60 * 60 * 1000) {
    return cachedPubKey.key
  }
  const res = await fetch('https://api.monobank.ua/api/merchant/pub-key', {
    headers: { 'X-Token': MONOBANK_TOKEN },
  })
  if (!res.ok) throw new Error(`pub-key fetch failed: ${res.status}`)
  const payload = await res.json() as { key: string }
  // Mono returns the PEM itself, base64-encoded.
  const pem = atob(payload.key)
  const key = createPublicKey(pem)
  cachedPubKey = { key, fetchedAt: Date.now() }
  return key
}

function verifyMonoSignature(rawBody: string, sigB64: string, pubKey: KeyObject): boolean {
  try {
    const verify = createVerify('SHA256')
    verify.update(rawBody, 'utf8')
    verify.end()
    return verify.verify(pubKey, Buffer.from(sigB64, 'base64'))
  } catch (err) {
    console.error('mono signature verify threw', err)
    return false
  }
}

async function notifyTelegram(chatId: number, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
  } catch (err) {
    console.error('telegram notify failed', err)
  }
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const rawBody = await req.text()
  const sigB64 = req.headers.get('x-sign') || req.headers.get('X-Sign') || ''
  if (!sigB64) {
    console.warn('mono callback without X-Sign')
    return new Response('missing signature', { status: 400 })
  }

  let pubKey: KeyObject
  try {
    pubKey = await getMonoPublicKey()
  } catch (err) {
    console.error('pub-key error', err)
    return new Response('pub-key error', { status: 500 })
  }

  if (!verifyMonoSignature(rawBody, sigB64, pubKey)) {
    console.warn('mono signature mismatch')
    return new Response('bad signature', { status: 400 })
  }

  let cb: MonoCallback
  try {
    cb = JSON.parse(rawBody)
  } catch {
    return new Response('bad body', { status: 400 })
  }

  const orderId = cb.reference
  if (!orderId) {
    console.warn('mono callback without reference', cb.invoiceId)
    return new Response('missing reference', { status: 400 })
  }

  const { data: payment, error: fetchErr } = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .single()

  if (fetchErr || !payment) {
    console.error('payment not found', orderId, fetchErr)
    return new Response('not found', { status: 404 })
  }

  // Idempotency guard
  if (payment.status === 'paid' || payment.status === 'refunded') {
    return new Response('ok', { status: 200 })
  }

  const newStatus =
    cb.status === 'success' ? 'paid'
    : cb.status === 'reversed' ? 'refunded'
    : cb.status === 'expired' ? 'expired'
    : cb.status === 'failure' ? 'failed'
    : 'pending'

  await supabase.from('payments')
    .update({
      status: newStatus,
      provider_order_id: cb.invoiceId,
      paid_at: newStatus === 'paid' ? new Date().toISOString() : null,
      raw: cb as unknown as Record<string, unknown>,
    })
    .eq('order_id', orderId)

  if (newStatus === 'paid' && payment.telegram_user_id) {
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
          payment_id: orderId,
          amount_paid: payment.amount * 100,
        }, { onConflict: 'user_id,course_id', ignoreDuplicates: true })

      await notifyTelegram(
        payment.telegram_user_id,
        `✅ Оплата успішна!\n\nВам відкрито доступ до курсу «${course.title}».\n\nНатисніть /my_courses щоб почати навчання.`,
      )
    }
  }

  return new Response('ok', { status: 200 })
})
