import { supabase } from './client.js';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';

export interface Payment {
  id: string;
  order_id: string;
  provider: 'wayforpay' | 'monobank';
  status: PaymentStatus;
  course_slug: string;
  amount: number; // UAH (not kopiykas)
  telegram_user_id: number | null;
  source: 'web' | 'bot';
  paid_at: string | null;
  created_at: string;
}

export async function getPaymentByOrderId(orderId: string): Promise<Payment | null> {
  const { data } = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();
  return data as Payment | null;
}

/**
 * Bind a web-first payment (telegram_user_id NULL) to the current Telegram user.
 * Conditional update prevents a second user from hijacking someone else's order.
 * Returns true if the claim was successful.
 */
export async function claimPaymentForUser(
  orderId: string,
  telegramUserId: number,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('payments')
    .update({ telegram_user_id: telegramUserId })
    .eq('order_id', orderId)
    .is('telegram_user_id', null)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('claimPaymentForUser error:', error);
    return false;
  }
  return !!data;
}
