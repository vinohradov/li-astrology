// Li Astrology — Create Payment Edge Function
// Provider-agnostic entry point. Implements WayForPay and MonoBank acquiring.
// Called from web frontend and from Telegram bot.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'node:crypto'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const WAYFORPAY_MERCHANT_ACCOUNT = Deno.env.get('WAYFORPAY_MERCHANT_ACCOUNT') || 'test_merch_n1'
const WAYFORPAY_SECRET_KEY       = Deno.env.get('WAYFORPAY_SECRET_KEY')       || 'flk3409refn54t54t*FNJRET'
const WAYFORPAY_DOMAIN_NAME      = Deno.env.get('WAYFORPAY_DOMAIN_NAME')      || 'li-astrology.com.ua'
const MONOBANK_TOKEN             = Deno.env.get('MONOBANK_TOKEN')             || ''
const SITE_URL                   = Deno.env.get('SITE_URL')                   || 'https://li-astrology.com.ua'
const TELEGRAM_BOT_USERNAME      = Deno.env.get('TELEGRAM_BOT_USERNAME')      || 'li_astrology_bot'

// Product cover images shown in Mono invoice UI (pay page + merchant cabinet).
// Must be a public HTTPS URL. Drop files into web/public/images/courses/<slug>.jpg
// and add the slug here to wire them up; unknown slugs fall back to the brand logo.
const COURSE_ICON_BY_SLUG: Record<string, string> = {
  'intensiv':      `${SITE_URL}/images/courses/intensiv.jpg`,
  'astro-z-0':     `${SITE_URL}/images/courses/astro-z-0.jpg`,
  'aspekty-basic': `${SITE_URL}/images/courses/aspekty-basic.jpg`,
  'aspekty-pro':   `${SITE_URL}/images/courses/aspekty-pro.jpg`,
}
const COURSE_ICON_FALLBACK = `${SITE_URL}/images/li_logo_gold.png`
function iconForSlug(slug: string): string {
  return COURSE_ICON_BY_SLUG[slug] ?? COURSE_ICON_FALLBACK
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface CreatePaymentRequest {
  provider: 'wayforpay' | 'monobank'
  product_slug: string
  source: 'web' | 'bot'
  telegram_user_id?: number
  customer_email?: string
  customer_phone?: string
  customer_name?: string
  promo_code?: string
}

interface Promotion {
  id: string
  code: string
  course_id: string | null
  discount_pct: number | null
  discount_abs: number | null
  valid_from: string
  valid_until: string | null
  max_uses: number | null
  times_used: number
}

async function validateAndConsumePromo(
  code: string,
  courseId: string,
  priceKopiykas: number,
): Promise<{ promo: Promotion; discountKopiykas: number } | null> {
  const { data: promo } = await supabase
    .from('promotions')
    .select('*')
    .eq('code', code.toUpperCase())
    .lte('valid_from', new Date().toISOString())
    .single<Promotion>()

  if (!promo) return null
  if (promo.valid_until && new Date(promo.valid_until) < new Date()) return null
  if (promo.max_uses !== null && promo.times_used >= promo.max_uses) return null
  if (promo.course_id && promo.course_id !== courseId) return null

  let discountKopiykas = 0
  if (promo.discount_pct) discountKopiykas = Math.round(priceKopiykas * (promo.discount_pct / 100))
  else if (promo.discount_abs) discountKopiykas = Math.min(promo.discount_abs, priceKopiykas)

  await supabase
    .from('promotions')
    .update({ times_used: promo.times_used + 1 })
    .eq('id', promo.id)

  return { promo, discountKopiykas }
}

function hmacMd5(key: string, data: string): string {
  return createHmac('md5', key).update(data, 'utf8').digest('hex')
}

function makeOrderId(source: string, slug: string): string {
  const ts = Date.now()
  const rand = Math.random().toString(36).slice(2, 8)
  return `${source}-${slug}-${ts}-${rand}`
}

async function createWfpInvoice(params: {
  orderReference: string
  amount: number
  productName: string
  customerEmail?: string
  customerPhone?: string
  returnUrl: string
  serviceUrl: string
}) {
  const orderDate = Math.floor(Date.now() / 1000)

  const signatureFields = [
    WAYFORPAY_MERCHANT_ACCOUNT,
    WAYFORPAY_DOMAIN_NAME,
    params.orderReference,
    orderDate,
    params.amount,
    'UAH',
    params.productName,
    1,
    params.amount,
  ].join(';')

  const merchantSignature = hmacMd5(WAYFORPAY_SECRET_KEY, signatureFields)

  const body = {
    transactionType: 'CREATE_INVOICE',
    merchantAccount: WAYFORPAY_MERCHANT_ACCOUNT,
    merchantAuthType: 'SimpleSignature',
    merchantDomainName: WAYFORPAY_DOMAIN_NAME,
    merchantSignature,
    apiVersion: 1,
    language: 'UA',
    serviceUrl: params.serviceUrl,
    returnUrl: params.returnUrl,
    orderReference: params.orderReference,
    orderDate,
    amount: params.amount,
    currency: 'UAH',
    productName: [params.productName],
    productCount: [1],
    productPrice: [params.amount],
    clientEmail: params.customerEmail,
    clientPhone: params.customerPhone,
  }

  const res = await fetch('https://api.wayforpay.com/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const payload = await res.json()
  if (payload.reasonCode !== 1100) {
    throw new Error(`WFP invoice failed: ${payload.reasonCode} ${payload.reason}`)
  }
  return payload as { invoiceUrl: string; qrCode?: string }
}

async function createMonoInvoice(params: {
  orderReference: string
  amountUah: number
  productName: string
  productIcon?: string
  redirectUrl: string
  webHookUrl: string
}): Promise<{ invoiceUrl: string; invoiceId: string }> {
  if (!MONOBANK_TOKEN) throw new Error('MONOBANK_TOKEN not configured')

  const amountKop = params.amountUah * 100
  const basketItem: Record<string, unknown> = {
    name: params.productName,
    qty: 1,
    sum: amountKop,
    unit: 'шт.',
    code: params.orderReference,
  }
  if (params.productIcon) basketItem.icon = params.productIcon

  const body = {
    amount: amountKop,
    ccy: 980,
    merchantPaymInfo: {
      reference: params.orderReference,
      destination: params.productName,
      basketOrder: [basketItem],
    },
    redirectUrl: params.redirectUrl,
    webHookUrl: params.webHookUrl,
    validity: 3600,
    paymentType: 'debit',
  }

  const res = await fetch('https://api.monobank.ua/api/merchant/invoice/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Token': MONOBANK_TOKEN,
    },
    body: JSON.stringify(body),
  })

  const payload = await res.json()
  if (!res.ok || !payload.pageUrl || !payload.invoiceId) {
    throw new Error(`Mono invoice failed: ${res.status} ${JSON.stringify(payload)}`)
  }
  return { invoiceUrl: payload.pageUrl, invoiceId: payload.invoiceId }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const body = await req.json() as CreatePaymentRequest

    if (!body.provider || !body.product_slug || !body.source) {
      return json({ error: 'provider, product_slug and source are required' }, 400)
    }
    if (body.provider !== 'wayforpay' && body.provider !== 'monobank') {
      return json({ error: `provider ${body.provider} not supported` }, 400)
    }
    if (body.source !== 'web' && body.source !== 'bot') {
      return json({ error: 'source must be web or bot' }, 400)
    }

    const { data: course, error: courseErr } = await supabase
      .from('courses')
      .select('id, slug, title, price_uah, is_active')
      .eq('slug', body.product_slug)
      .single()

    if (courseErr || !course) return json({ error: 'course not found' }, 404)
    if (!course.is_active) return json({ error: 'course not active' }, 400)

    let priceKopiykas = course.price_uah
    let appliedPromoCode: string | null = null
    if (body.promo_code) {
      const applied = await validateAndConsumePromo(body.promo_code, course.id, priceKopiykas)
      if (!applied) return json({ error: 'promo invalid' }, 400)
      priceKopiykas -= applied.discountKopiykas
      appliedPromoCode = applied.promo.code
    }

    const amountUah = Math.floor(priceKopiykas / 100)
    const orderId = makeOrderId(body.source, course.slug)
    // After WayForPay checkout, customer is redirected back here.
    // Our Astro /payment/success/ page reads order_id + product, then offers
    // a Telegram deep-link that the bot resolves to grant access.
    const returnUrl = body.source === 'web'
      ? `${SITE_URL}/payment/success/?order_id=${orderId}&product=${course.slug}`
      : `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${orderId}`

    const { error: insertErr } = await supabase.from('payments').insert({
      order_id: orderId,
      provider: body.provider,
      status: 'pending',
      course_slug: course.slug,
      amount: amountUah,
      currency: 'UAH',
      telegram_user_id: body.telegram_user_id ?? null,
      customer_email: body.customer_email ?? null,
      customer_phone: body.customer_phone ?? null,
      customer_name: body.customer_name ?? null,
      source: body.source,
      promo_code: appliedPromoCode,
    })
    if (insertErr) {
      console.error('payments insert failed', insertErr)
      return json({ error: 'db insert failed' }, 500)
    }

    if (body.provider === 'wayforpay') {
      const invoice = await createWfpInvoice({
        orderReference: orderId,
        amount: amountUah,
        productName: course.title,
        customerEmail: body.customer_email,
        customerPhone: body.customer_phone,
        returnUrl,
        serviceUrl: `${SUPABASE_URL}/functions/v1/wfp-callback`,
      })
      return json({
        order_id: orderId,
        invoice_url: invoice.invoiceUrl,
        qr_code: invoice.qrCode,
      })
    }

    // monobank
    const mono = await createMonoInvoice({
      orderReference: orderId,
      amountUah,
      productName: course.title,
      productIcon: iconForSlug(course.slug),
      redirectUrl: returnUrl,
      webHookUrl: `${SUPABASE_URL}/functions/v1/mono-callback`,
    })

    await supabase.from('payments')
      .update({ provider_order_id: mono.invoiceId })
      .eq('order_id', orderId)

    return json({
      order_id: orderId,
      invoice_url: mono.invoiceUrl,
    })
  } catch (err) {
    console.error('create-payment error', err)
    return json({ error: err instanceof Error ? err.message : 'internal error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
