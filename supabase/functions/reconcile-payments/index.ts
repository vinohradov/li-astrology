// Reconciliation fallback — polls Mono's invoice-status API for every
// `pending` monobank payment, updates our DB, grants user_courses when paid.
// Call manually or on a cron:
//   curl -X POST https://<project>.supabase.co/functions/v1/reconcile-payments
//
// Useful when webhooks are missed / mis-delivered. Idempotent.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MONOBANK_TOKEN = Deno.env.get('MONOBANK_TOKEN')!
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface MonoStatus {
  invoiceId: string
  status: string
  amount: number
  ccy: number
  finalAmount?: number
  reference?: string
  modifiedDate?: string
  webHookUrl?: string
}

async function fetchMonoStatus(invoiceId: string): Promise<MonoStatus | null> {
  const res = await fetch(
    `https://api.monobank.ua/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`,
    { headers: { 'X-Token': MONOBANK_TOKEN } },
  )
  if (!res.ok) {
    console.error('[reconcile] mono status failed', invoiceId, res.status, await res.text())
    return null
  }
  return (await res.json()) as MonoStatus
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
    console.error('[reconcile] telegram notify failed', err)
  }
}

serve(async () => {
  const { data: pending, error } = await supabase
    .from('payments')
    .select('*')
    .eq('provider', 'monobank')
    .eq('status', 'pending')
    .not('provider_order_id', 'is', null)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const results: Array<Record<string, unknown>> = []

  for (const payment of pending ?? []) {
    const status = await fetchMonoStatus(payment.provider_order_id)
    if (!status) {
      results.push({ order_id: payment.order_id, action: 'mono-status-error' })
      continue
    }

    const newStatus =
      status.status === 'success' ? 'paid'
      : status.status === 'reversed' ? 'refunded'
      : status.status === 'expired' ? 'expired'
      : status.status === 'failure' ? 'failed'
      : 'pending'

    if (newStatus === 'pending') {
      results.push({ order_id: payment.order_id, mono_status: status.status, action: 'still-pending' })
      continue
    }

    await supabase.from('payments')
      .update({
        status: newStatus,
        paid_at: newStatus === 'paid' ? new Date().toISOString() : null,
        raw: status as unknown as Record<string, unknown>,
      })
      .eq('order_id', payment.order_id)

    if (newStatus === 'paid' && payment.telegram_user_id) {
      const { data: course } = await supabase
        .from('courses').select('id, title')
        .eq('slug', payment.course_slug).single()

      if (course) {
        await supabase.from('user_courses').upsert({
          user_id: payment.telegram_user_id,
          course_id: course.id,
          payment_id: payment.order_id,
          amount_paid: payment.amount * 100,
        }, { onConflict: 'user_id,course_id', ignoreDuplicates: true })

        await notifyTelegram(
          payment.telegram_user_id,
          `✅ Оплата успішна!\n\nВам відкрито доступ до курсу «${course.title}».\n\nНатисніть /my_courses щоб почати навчання.`,
        )
      }
    }

    results.push({
      order_id: payment.order_id,
      mono_status: status.status,
      new_status: newStatus,
      web_hook_url: status.webHookUrl ?? null,
      action: 'updated',
    })
  }

  return new Response(JSON.stringify({ processed: results.length, results }, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  })
})
