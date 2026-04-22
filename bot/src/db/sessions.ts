import { supabase } from './client.js';

interface StoredSession {
  botMessageIds?: number[];
  [k: string]: unknown;
}

/**
 * Append a Telegram message_id to the user's persisted grammY session so
 * the next navigation click (via cleanAndSend) can delete it.
 *
 * Used for messages sent outside a handler context — e.g. nurture broadcasts
 * from the reminders cron — which otherwise would never be tracked.
 *
 * Note: this is a read-modify-write and is not strictly atomic. For the
 * current traffic pattern (nurture cron runs once per minute) this is fine.
 */
export async function appendUserBotMessageId(
  userId: number,
  messageId: number
): Promise<void> {
  const key = userId.toString();

  const { data } = await supabase
    .from('bot_sessions')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  const session: StoredSession = (data?.value as StoredSession | null) ?? {};
  const ids = session.botMessageIds ?? [];
  ids.push(messageId);
  session.botMessageIds = ids;

  await supabase
    .from('bot_sessions')
    .upsert({ key, value: session }, { onConflict: 'key' });
}
