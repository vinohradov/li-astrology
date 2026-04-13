import { supabase } from './client.js';

export interface LessonProgress {
  user_id: number;
  lesson_id: string;
  completed: boolean;
  opened_at: string;
  completed_at: string | null;
}

export async function getProgressForCourse(
  userId: number,
  courseId: string
): Promise<Map<string, LessonProgress>> {
  const { data } = await supabase
    .from('user_lesson_progress')
    .select('*, lessons!inner(course_id)')
    .eq('user_id', userId)
    .eq('lessons.course_id', courseId);

  const map = new Map<string, LessonProgress>();
  if (data) {
    for (const row of data) {
      map.set(row.lesson_id, row);
    }
  }
  return map;
}

export async function getCompletedCount(userId: number, courseId: string): Promise<number> {
  const { count } = await supabase
    .from('user_lesson_progress')
    .select('*, lessons!inner(course_id)', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('completed', true)
    .eq('lessons.course_id', courseId);

  return count ?? 0;
}

export async function markLessonOpened(userId: number, lessonId: string) {
  await supabase
    .from('user_lesson_progress')
    .upsert(
      { user_id: userId, lesson_id: lessonId, opened_at: new Date().toISOString() },
      { onConflict: 'user_id,lesson_id' }
    );
}

export async function markLessonCompleted(userId: number, lessonId: string) {
  await supabase
    .from('user_lesson_progress')
    .upsert(
      {
        user_id: userId,
        lesson_id: lessonId,
        completed: true,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,lesson_id' }
    );
}
