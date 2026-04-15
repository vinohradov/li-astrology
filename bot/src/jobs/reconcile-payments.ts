import { config } from '../config.js';

// Polls the reconcile-payments Edge Function. The function queries Mono for
// every pending mono payment, updates the DB, and notifies users. Bot-side
// cron is the safety net for missed webhooks.
export async function tickReconcilePayments() {
  const url = `${config.SUPABASE_URL}/functions/v1/reconcile-payments`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.SUPABASE_SERVICE_KEY}`,
      },
    });
    if (!res.ok) {
      console.error('reconcile-payments HTTP', res.status, await res.text());
      return;
    }
    const payload = await res.json() as { processed?: number };
    if (payload.processed && payload.processed > 0) {
      console.log('[reconcile] tick processed', payload.processed);
    }
  } catch (err) {
    console.error('reconcile-payments tick error', err);
  }
}
