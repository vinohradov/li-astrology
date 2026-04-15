import { supabase } from '../db/client.js';
import { createReminder } from '../db/reminders.js';
import { getLocale } from '../locales/index.js';

/**
 * Find users inactive for 3+ days who have uncompleted courses,
 * and haven't received an inactivity reminder in the last 7 days.
 */
export async function checkInactivity() {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Find inactive users with purchased courses
  const { data: inactiveUsers } = await supabase
    .from('bot_users')
    .select('id, first_name, lang')
    .eq('blocked_bot', false)
    .lt('last_active', threeDaysAgo);

  if (!inactiveUsers || inactiveUsers.length === 0) return;

  for (const user of inactiveUsers) {
    // Check if we already sent an inactivity reminder recently
    const { data: recentReminder } = await supabase
      .from('reminders')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'inactivity')
      .gte('created_at', sevenDaysAgo)
      .limit(1);

    if (recentReminder && recentReminder.length > 0) continue;

    // Find their most-progressed uncompleted course
    const { data: userCourses } = await supabase
      .from('user_courses')
      .select('course_id, courses(title)')
      .eq('user_id', user.id);

    if (!userCourses || userCourses.length === 0) continue;

    // Pick first course for the reminder
    const uc = userCourses[0] as any;
    const courseTitle = uc.courses?.title ?? 'курс';

    // Count total and completed lessons
    const { count: totalLessons } = await supabase
      .from('lessons')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', uc.course_id);

    const { count: completedLessons } = await supabase
      .from('user_lesson_progress')
      .select('*, lessons!inner(course_id)', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('completed', true)
      .eq('lessons.course_id', uc.course_id);

    const nextLesson = (completedLessons ?? 0) + 1;

    const t = getLocale((user as { lang?: string }).lang);
    await createReminder({
      userId: user.id,
      type: 'inactivity',
      payload: {
        text: t.reminder.inactivity(
          user.first_name ?? '',
          courseTitle,
          nextLesson,
          totalLessons ?? 0
        ),
        buttons: [
          { text: t.reminder.continueCourse, callback_data: `course:${uc.course_id}` },
        ],
      },
    });
  }

  console.log(`Inactivity check: processed ${inactiveUsers.length} users`);
}
