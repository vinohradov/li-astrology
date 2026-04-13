import { supabase } from './client.js';

export interface BotUser {
  id: number;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  phone: string | null;
  email: string | null;
  lang: string;
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

export async function markBlocked(userId: number) {
  await supabase
    .from('bot_users')
    .update({ blocked_bot: true })
    .eq('id', userId);
}
