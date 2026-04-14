/**
 * Client-side payment handler.
 * Buttons with [data-product="{slug}"] → create WayForPay invoice → redirect.
 */

import { site } from '@/config/site';

const state = { processing: false };

async function start(productId: string) {
  if (state.processing) return;
  state.processing = true;
  setLoading(true);

  try {
    const response = await fetch(`${site.supabase.url}/functions/v1/create-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${site.supabase.anonKey}`,
      },
      body: JSON.stringify({
        provider: 'wayforpay',
        product_slug: productId,
        source: 'web',
      }),
    });

    const payload = await response.json();
    if (!response.ok || !payload.invoice_url) {
      throw new Error(payload.error || 'create-payment failed');
    }
    window.location.href = payload.invoice_url;
  } catch (err) {
    console.error('Payment error:', err);
    state.processing = false;
    setLoading(false);
    alert('Помилка створення платежу. Спробуйте ще раз.');
  }
}

function setLoading(loading: boolean) {
  document.querySelectorAll<HTMLElement>('[data-product]').forEach((btn) => {
    if (loading) {
      btn.setAttribute('data-original-text', btn.textContent ?? '');
      btn.classList.add('opacity-60', 'pointer-events-none');
    } else {
      const orig = btn.getAttribute('data-original-text');
      if (orig) btn.textContent = orig;
      btn.classList.remove('opacity-60', 'pointer-events-none');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll<HTMLAnchorElement>('[data-product]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const slug = btn.getAttribute('data-product');
      if (slug) start(slug);
    });
  });
});
