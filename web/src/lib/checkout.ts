import { products, site, type ProductSlug } from '@/config/site';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

/** begin_checkout / InitiateCheckout events. Safe no-op when GA or the pixel aren't loaded. */
export function trackCheckout(productId: string) {
  const product = products[productId as ProductSlug];
  const value = product?.priceUah;
  const name = product?.title || productId;

  window.gtag?.('event', 'begin_checkout', {
    currency: 'UAH',
    value,
    items: [{ item_id: productId, item_name: name, price: value }],
  });
  window.fbq?.('track', 'InitiateCheckout', {
    currency: 'UAH',
    value,
    content_ids: [productId],
    content_name: name,
  });
}

/**
 * Create an invoice via the create-payment edge function and return the provider's pay URL.
 * Pass telegramUserId when the buyer is logged in (cabinet): mono-callback then grants
 * access directly and no claim step is needed.
 */
export async function createInvoice(opts: {
  slug: string;
  provider?: string;
  telegramUserId?: number;
}): Promise<string> {
  const response = await fetch(`${site.supabase.url}/functions/v1/create-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${site.supabase.anonKey}`,
    },
    body: JSON.stringify({
      provider: opts.provider ?? 'monobank',
      product_slug: opts.slug,
      source: 'web',
      ...(opts.telegramUserId ? { telegram_user_id: opts.telegramUserId } : {}),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.invoice_url) {
    throw new Error(payload.error || `create-payment failed (${response.status})`);
  }
  return payload.invoice_url as string;
}
