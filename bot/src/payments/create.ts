import { config } from '../config.js';

export type PaymentProvider = 'monobank' | 'wayforpay';

interface CreateInvoiceParams {
  provider?: PaymentProvider;
  courseSlug: string;
  telegramUserId: number;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  promoCode?: string;
}

interface CreateInvoiceResult {
  orderId: string;
  invoiceUrl: string;
  qrCode?: string;
}

/**
 * Calls the Supabase Edge Function `create-payment`. For bot-initiated
 * purchases the Edge Function sets the provider's redirectUrl to the bot
 * deep-link (t.me/<bot>?start=<orderId>) so the user returns here and the
 * /start handler claims the payment.
 */
export async function createInvoice(
  params: CreateInvoiceParams,
): Promise<CreateInvoiceResult> {
  const url = `${config.SUPABASE_URL}/functions/v1/create-payment`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({
      provider: params.provider ?? 'monobank',
      source: 'bot',
      product_slug: params.courseSlug,
      telegram_user_id: params.telegramUserId,
      customer_email: params.customerEmail,
      customer_phone: params.customerPhone,
      customer_name: params.customerName,
      promo_code: params.promoCode,
    }),
  });

  const payload = await res.json();
  if (!res.ok || !payload.invoice_url) {
    throw new Error(
      `create-payment failed: ${payload.error || res.statusText}`,
    );
  }

  return {
    orderId: payload.order_id,
    invoiceUrl: payload.invoice_url,
    qrCode: payload.qr_code,
  };
}
