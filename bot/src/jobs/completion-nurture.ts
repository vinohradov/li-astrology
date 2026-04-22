// Event-triggered (not cron-scheduled) nurture: fires when a user hits
// 100% completion of a course that has an entry in COMPLETION_NURTURE.
// Called from the `complete:` callback handler in handlers/lesson.ts.
//
// Delivery flow: this just inserts a row into `reminders` with scheduled_at=now,
// the regular send-reminders cron (every minute) picks it up and sends it.
// That keeps all outbound messaging in one pipe (message tracking, 403 handling).

import { supabase } from '../db/client.js';
import { createReminder } from '../db/reminders.js';
import { getCompletedCount, getTrackableLessonsCount } from '../db/progress.js';
import { COMPLETION_NURTURE } from '../content/nurture.js';

/**
 * Check if the user just reached 100% completion of a course with a
 * registered completion-nurture. If yes (and no prior reminder of that
 * type exists), queue one for immediate delivery.
 */
export async function maybeQueueCompletionNurture(
  userId: number,
  lessonId: string
): Promise<void> {
  const { data: lesson } = await supabase
    .from('lessons')
    .select('course_id, courses!inner(slug)')
    .eq('id', lessonId)
    .maybeSingle();
  if (!lesson) return;

  const courseId = (lesson as any).course_id as string;
  const slug = (lesson as any).courses?.slug as string | undefined;
  if (!slug) return;

  const nurture = COMPLETION_NURTURE[slug];
  if (!nurture) return;

  const total = await getTrackableLessonsCount(courseId);
  if (total === 0) return;

  const completed = await getCompletedCount(userId, courseId);
  if (completed < total) return;

  const type = `course_complete_${slug}`;

  const { count: existing } = await supabase
    .from('reminders')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', type);
  if ((existing ?? 0) > 0) return;

  const { data: user } = await supabase
    .from('bot_users')
    .select('first_name, lang')
    .eq('id', userId)
    .maybeSingle();

  const name = user?.first_name ?? '';
  const lang = user?.lang ?? 'uk';
  const text = lang === 'ru' ? nurture.textRu(name) : nurture.textUk(name);
  const buttonLabel = lang === 'ru' ? nurture.button.labelRu : nurture.button.labelUk;

  await createReminder({
    userId,
    type,
    payload: {
      text,
      buttons: [{ text: buttonLabel, url: nurture.button.url }],
    },
  });
}
