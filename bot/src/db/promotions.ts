import { supabase } from './client.js';

export interface Promotion {
  id: string;
  code: string | null;
  course_id: string | null;
  discount_pct: number | null;
  discount_abs: number | null;
  valid_from: string;
  valid_until: string | null;
  max_uses: number | null;
  times_used: number;
}

export async function validatePromo(code: string, courseId?: string): Promise<Promotion | null> {
  let query = supabase
    .from('promotions')
    .select('*')
    .eq('code', code.toUpperCase())
    .lte('valid_from', new Date().toISOString());

  const { data } = await query.single();

  if (!data) return null;
  if (data.valid_until && new Date(data.valid_until) < new Date()) return null;
  if (data.max_uses && data.times_used >= data.max_uses) return null;
  if (data.course_id && courseId && data.course_id !== courseId) return null;

  return data;
}

export async function incrementPromoUsage(promoId: string) {
  const { data } = await supabase
    .from('promotions')
    .select('times_used')
    .eq('id', promoId)
    .single();

  if (data) {
    await supabase
      .from('promotions')
      .update({ times_used: data.times_used + 1 })
      .eq('id', promoId);
  }
}

export function calculateDiscount(promo: Promotion, priceKopiykas: number): number {
  if (promo.discount_pct) {
    return Math.round(priceKopiykas * (promo.discount_pct / 100));
  }
  if (promo.discount_abs) {
    return Math.min(promo.discount_abs, priceKopiykas);
  }
  return 0;
}
