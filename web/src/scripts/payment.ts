/**
 * Client-side payment handler.
 * Buttons with [data-product="{slug}"] → create WayForPay invoice → redirect.
 *
 * UX: the clicked button shows an inline spinner; other payment buttons are
 * disabled while a request is in flight. Errors surface via a non-blocking
 * toast rather than alert().
 */

import { site } from '@/config/site';

let processing = false;

const SPINNER_HTML = `
  <svg class="wfp-spinner h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
    <path d="M22 12a10 10 0 0 0-10-10" stroke-linecap="round"/>
  </svg>
`;

function showToast(message: string, tone: 'error' | 'info' = 'error') {
  const existing = document.getElementById('wfp-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'wfp-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.className = [
    'fixed bottom-6 left-1/2 z-[200] -translate-x-1/2',
    'flex items-center gap-3 rounded-full px-5 py-3',
    'text-xs font-medium uppercase tracking-widest',
    'shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)]',
    'border backdrop-blur',
    tone === 'error'
      ? 'border-red-400/40 bg-ink text-cream'
      : 'border-gold-bright/40 bg-ink text-cream',
  ].join(' ');
  toast.innerHTML = `
    <span class="text-base" aria-hidden="true">${tone === 'error' ? '⚠️' : '✨'}</span>
    <span class="normal-case tracking-normal text-[13px]">${message}</span>
  `;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('opacity-0', 'transition-opacity', 'duration-500'), 3200);
  setTimeout(() => toast.remove(), 3800);
}

function setAllDisabled(disabled: boolean) {
  document.querySelectorAll<HTMLElement>('[data-product]').forEach((btn) => {
    if (disabled) {
      btn.classList.add('opacity-60', 'pointer-events-none');
      btn.setAttribute('aria-disabled', 'true');
    } else {
      btn.classList.remove('opacity-60', 'pointer-events-none');
      btn.removeAttribute('aria-disabled');
    }
  });
}

function markActive(active: HTMLElement, on: boolean) {
  if (on) {
    // Save original markup once, then inject spinner + "Обробка" label.
    if (!active.hasAttribute('data-original-html')) {
      active.setAttribute('data-original-html', active.innerHTML);
    }
    active.innerHTML = `${SPINNER_HTML}<span>Обробка…</span>`;
    active.classList.remove('opacity-60', 'pointer-events-none');
    active.classList.add('wfp-loading');
  } else {
    const orig = active.getAttribute('data-original-html');
    if (orig) {
      active.innerHTML = orig;
      active.removeAttribute('data-original-html');
    }
    active.classList.remove('wfp-loading');
  }
}

async function start(productId: string, button: HTMLElement) {
  if (processing) return;
  processing = true;
  setAllDisabled(true);
  markActive(button, true);

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

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.invoice_url) {
      throw new Error(payload.error || `create-payment failed (${response.status})`);
    }

    // Redirect to WayForPay checkout.
    window.location.href = payload.invoice_url;
  } catch (err) {
    console.error('Payment error:', err);
    showToast('Не вдалося створити платіж. Спробуйте ще раз.');
    markActive(button, false);
    setAllDisabled(false);
    processing = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll<HTMLAnchorElement>('[data-product]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (btn.getAttribute('aria-disabled') === 'true') return;
      const slug = btn.getAttribute('data-product');
      if (slug) start(slug, btn);
    });
  });
});
