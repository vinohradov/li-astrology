import { config } from '../config.js';

interface CreatePaymentParams {
  courseSlug: string;
  telegramUserId: number;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  promoCode?: string;
}

interface CreatePaymentResult {
  orderId: string;
  invoiceUrl: string;
  qrCode?: string;
}

/**
 * Calls the Supabase Edge Function `create-payment` to obtain a WayForPay invoice
 * for a bot-initiated purchase. The Edge Function creates the payments row and
 * the WFP invoice; we only get back the redirect URL.
 */
export async function createWayForPayInvoice(
  params: CreatePaymentParams,
): Promise<CreatePaymentResult> {
  const url = `${config.SUPABASE_URL}/functions/v1/create-payment`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({
      provider: 'wayforpay',
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
