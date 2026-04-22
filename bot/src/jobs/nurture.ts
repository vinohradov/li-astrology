// Queues nurture messages for intensiv buyers.
// Runs on a cron (scheduler.ts); messages themselves are delivered by the
// existing `reminders` pipeline (send-reminders.ts).
//
// Logic per step (day N):
//   • intensiv purchased >= N days ago
//   • user hasn't already bought astro-z-0 (already converted — skip)
//   • no reminder with type=`nurture_day<N>` exists for this user
// If all true — insert a reminder; send-reminders will pick it up within 1 min.

import { supabase } from '../db/client.js';
import { createReminder } from '../db/reminders.js';
import { NURTURE_STEPS } from '../content/nurture.js';

const INTENSIV_SLUG = 'intensiv';
const CONVERSION_SLUG = 'astro-z-0';

export async function checkNurture() {
  const { data: intensiv } = await supabase
    .from('courses')
    .select('id')
    .eq('slug', INTENSIV_SLUG)
    .single();
  if (!intensiv) return;

  const { data: fullCourse } = await supabase
    .from('courses')
    .select('id')
    .eq('slug', CONVERSION_SLUG)
    .single();

  // All intensiv purchases, oldest first.
  const { data: purchases } = await supabase
    .from('user_courses')
    .select('user_id, purchased_at, bot_users!inner(id, first_name, lang, blocked_bot)')
    .eq('course_id', intensiv.id)
    .eq('bot_users.blocked_bot', false);

  if (!purchases || purchases.length === 0) return;

  const now = Date.now();
  let queued = 0;

  for (const row of purchases as any[]) {
    const userId: number = row.user_id;
    const user = row.bot_users;
    if (!user) continue;

    // Skip users who already bought the full course.
    if (fullCourse) {
      const { count } = await supabase
        .from('user_courses')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('course_id', fullCourse.id);
      if ((count ?? 0) > 0) continue;
    }

    const purchasedAt = new Date(row.purchased_at).getTime();
    const ageDays = Math.floor((now - purchasedAt) / (24 * 60 * 60 * 1000));

    for (const step of NURTURE_STEPS) {
      if (ageDays < step.day) continue;

      const type = `nurture_day${step.day}`;

      // Dedup: already queued or sent?
      const { count: existing } = await supabase
        .from('reminders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', type);
      if ((existing ?? 0) > 0) continue;

      const lang = user.lang === 'ru' ? 'ru' : 'uk';
      const name = user.first_name ?? '';
      const text = lang === 'ru' ? step.textRu(name) : step.textUk(name);

      const buttons = step.button
        ? [
            {
              text: lang === 'ru' ? step.button.labelRu : step.button.labelUk,
              url: step.button.url,
            },
          ]
        : undefined;

      await createReminder({
        userId,
        type,
        payload: { text, buttons },
      });

      queued += 1;
    }
  }

  if (queued > 0) {
    console.log(`Nurture check: queued ${queued} messages across ${purchases.length} intensiv buyers`);
  }
}
