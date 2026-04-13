import { supabase } from './client.js';

export interface Reminder {
  id: string;
  user_id: number | null;
  type: string;
  payload: { text: string; buttons?: Array<{ text: string; callback_data?: string; url?: string }> };
  scheduled_at: string;
  sent_at: string | null;
  failed: boolean;
}

export async function getPendingReminders(limit = 30): Promise<Reminder[]> {
  const { data } = await supabase
    .from('reminders')
    .select('*')
    .is('sent_at', null)
    .eq('failed', false)
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at')
    .limit(limit);

  return data ?? [];
}

export async function markReminderSent(id: string) {
  await supabase
    .from('reminders')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', id);
}

export async function markReminderFailed(id: string) {
  await supabase
    .from('reminders')
    .update({ failed: true })
    .eq('id', id);
}

export async function createReminder(params: {
  userId: number;
  type: string;
  payload: Reminder['payload'];
  scheduledAt?: Date;
}) {
  await supabase.from('reminders').insert({
    user_id: params.userId,
    type: params.type,
    payload: params.payload,
    scheduled_at: (params.scheduledAt ?? new Date()).toISOString(),
  });
}
