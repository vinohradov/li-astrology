import { supabase } from './client.js';

export interface BotUser {
  id: number;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  phone: string | null;
  email: string | null;
  lang: string;
  /** First-touch attribution, e.g. `gift:ig_bio`, `buy:intensiv`, `direct`. */
  source: string | null;
  source_at: string | null;
  created_at: string;
  last_active: string;
  blocked_bot: boolean;
}

export async function upsertUser(user: {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}) {
  const { error } = await supabase
    .from('bot_users')
    .upsert(
      {
        id: user.id,
        first_name: user.first_name ?? null,
        last_name: user.last_name ?? null,
        username: user.username ?? null,
        last_active: new Date().toISOString(),
        blocked_bot: false,
      },
      { onConflict: 'id' }
    );

  if (error) console.error('upsertUser error:', error);
}

export async function getUser(userId: number): Promise<BotUser | null> {
  const { data } = await supabase
    .from('bot_users')
    .select('*')
    .eq('id', userId)
    .single();

  return data;
}

/**
 * First-touch attribution: records where a user came from (e.g. `gift:ig_bio`,
 * `buy:intensiv`, `direct`). Only the first non-null value sticks.
 */
export async function setUserSource(userId: number, source: string) {
  const { error } = await supabase
    .from('bot_users')
    .update({ source, source_at: new Date().toISOString() })
    .eq('id', userId)
    .is('source', null);
  if (error) console.error('setUserSource error:', error);
}

export async function markBlocked(userId: number) {
  await supabase
    .from('bot_users')
    .update({ blocked_bot: true })
    .eq('id', userId);
}

export async function setUserLang(userId: number, lang: 'uk' | 'ru') {
  const { error } = await supabase
    .from('bot_users')
    .update({ lang })
    .eq('id', userId);
  if (error) console.error('setUserLang error:', error);
}
