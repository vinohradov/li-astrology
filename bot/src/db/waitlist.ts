import { supabase } from './client.js';

/** Add user to a waitlist. Idempotent on (user, list_slug). */
export async function addToWaitlist(params: {
  userId: number;
  listSlug: string;
  source?: string;
}): Promise<{ alreadyThere: boolean }> {
  const { error } = await supabase.from('bot_waitlist').insert({
    telegram_user_id: params.userId,
    list_slug: params.listSlug,
    source: params.source ?? null,
  });

  if (error?.code === '23505') return { alreadyThere: true };
  if (error) throw error;
  return { alreadyThere: false };
}
