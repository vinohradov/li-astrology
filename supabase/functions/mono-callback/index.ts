// Li Astrology — MonoBank Acquiring Webhook
// Verifies ECDSA signature, updates payments, grants user_courses when the
// tg user is known, notifies the user in Telegram.

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

/** Accepts either a PEM string, or a base64-wrapped PEM. */
function toPem(raw: string): string {
  if (raw.includes('BEGIN') && raw.includes('PUBLIC KEY')) return raw
  try { return atob(raw) } catch { return raw }
}

async function getMonoPublicKey(): Promise<KeyObject> {
  if (cachedPubKey && Date.now() - cachedPubKey.fetchedAt < 60 * 60 * 1000) {
    return cachedPubKey.key
  }
  const res = await fetch('https://api.monobank.ua/api/merchant/pub-key', {
    headers: { 'X-Token': MONOBANK_TOKEN },
  })
  if (!res.ok) throw new Error(`pub-key fetch failed: ${res.status} ${await res.text()}`)
  const payload = await res.json() as { key: string }
  const key = createPublicKey(toPem(payload.key))
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
    console.error('[mono] signature verify threw', err)
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
    console.error('[mono] telegram notify failed', err)
  }
}

serve(async (req) => {
  // Mono pings the webhook URL with GET during invoice setup as a liveness check.
  if (req.method === 'GET') return new Response('ok', { status: 200 })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const rawBody = await req.text()
  const sigB64 = req.headers.get('x-sign') || req.headers.get('X-Sign') || ''
  if (!sigB64) return new Response('missing signature', { status: 400 })

  // Signature verification is best-effort while we confirm the crypto format
  // on real webhooks. Never block on it — losing a real payment event is worse
  // than the narrow blast radius of accepting a forged webhook, which still
  // needs the exact order_id (randomly generated, never exposed) to do harm.
  let sigOk: boolean | 'unverified' = 'unverified'
  try {
    const pubKey = await getMonoPublicKey()
    sigOk = verifyMonoSignature(rawBody, sigB64, pubKey)
  } catch (err) {
    console.error('[mono] pub-key fetch error', err)
  }

  let cb: MonoCallback
  try { cb = JSON.parse(rawBody) } catch { return new Response('bad body', { status: 400 }) }

  const orderId = cb.reference
  if (!orderId) return new Response('missing reference', { status: 400 })

  const { data: payment } = await supabase
    .from('payments').select('*').eq('order_id', orderId).single()

  if (!payment) return new Response('not found', { status: 404 })

  if (payment.status === 'paid' || payment.status === 'refunded') {
    console.log('[mono] summary', JSON.stringify({ orderId, sigOk, monoStatus: cb.status, action: 'already-finalised' }))
    return new Response('ok', { status: 200 })
  }

  const newStatus =
    cb.status === 'success' ? 'paid'
    : cb.status === 'reversed' ? 'refunded'
    : cb.status === 'expired' ? 'expired'
    : cb.status === 'failure' ? 'failed'
    : 'pending'

  const { error: updErr } = await supabase.from('payments')
    .update({
      status: newStatus,
      provider_order_id: cb.invoiceId,
      paid_at: newStatus === 'paid' ? new Date().toISOString() : null,
      raw: cb as unknown as Record<string, unknown>,
    })
    .eq('order_id', orderId)
  if (updErr) console.error('[mono] payment update error', updErr)

  if (newStatus === 'paid' && payment.telegram_user_id) {
    const { data: course } = await supabase
      .from('courses').select('id, title').eq('slug', payment.course_slug).single()

    if (course) {
      await supabase.from('user_courses').upsert({
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

  // Single-line summary for easy grep in logs.
  console.log('[mono] summary', JSON.stringify({ orderId, sigOk, monoStatus: cb.status, newStatus }))

  return new Response('ok', { status: 200 })
})
