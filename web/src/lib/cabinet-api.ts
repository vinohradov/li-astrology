import { functionsUrl, supabase } from './supabase';
import { site } from '@/config/site';
import type { Course, Lesson, LessonOutline, Me, Progress } from './cabinet-types';

/** All reads/writes go through RLS; nothing here needs (or has) elevated rights. */

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function getMe(telegramId: number): Promise<Me | null> {
  return check(
    await supabase
      .from('bot_users')
      .select('id, first_name, last_name, username, lang')
      .eq('id', telegramId)
      .maybeSingle(),
  );
}

export async function setLang(telegramId: number, lang: 'uk' | 'ru'): Promise<void> {
  check(await supabase.from('bot_users').update({ lang }).eq('id', telegramId));
}

export async function listCourses(): Promise<Course[]> {
  return (
    check(
      await supabase
        .from('courses')
        .select('id, slug, title, description, price_uah, sort_order, is_active, intro_html')
        .order('sort_order'),
    ) ?? []
  );
}

export async function getCourseBySlug(slug: string): Promise<Course | null> {
  return check(
    await supabase
      .from('courses')
      .select('id, slug, title, description, price_uah, sort_order, is_active, intro_html')
      .eq('slug', slug)
      .maybeSingle(),
  );
}

/** Course ids the user can open now (unexpired user_courses rows). */
export async function listOwnedCourseIds(): Promise<Set<string>> {
  const rows =
    check(await supabase.from('user_courses').select('course_id, expires_at')) ?? [];
  const now = Date.now();
  return new Set(
    rows
      .filter((r) => !r.expires_at || new Date(r.expires_at).getTime() > now)
      .map((r) => r.course_id as string),
  );
}

/** Lesson program without text/media — available for every active course. */
export async function getOutline(courseId?: string): Promise<LessonOutline[]> {
  let q = supabase
    .from('lessons_outline')
    .select('id, course_id, position, title, content_type, compact, material, is_free_preview')
    .order('position');
  if (courseId) q = q.eq('course_id', courseId);
  return check(await q) ?? [];
}

/** Full lesson; null when it doesn't exist or the user doesn't own the course. */
export async function getLesson(id: string): Promise<Lesson | null> {
  return check(
    await supabase
      .from('lessons')
      .select(
        'id, course_id, position, title, content_type, compact, material, is_free_preview, text_html, media',
      )
      .eq('id', id)
      .maybeSingle(),
  );
}

/** All of the user's progress rows, keyed by lesson id (the dataset is tiny). */
export async function getMyProgress(): Promise<Map<string, Progress>> {
  const rows =
    check(
      await supabase
        .from('user_lesson_progress')
        .select('lesson_id, completed, opened_at, completed_at'),
    ) ?? [];
  return new Map(rows.map((r) => [r.lesson_id as string, r as Progress]));
}

/** Same upsert as bot/src/db/progress.ts markLessonOpened — never touches `completed`. */
export async function markOpened(telegramId: number, lessonId: string): Promise<void> {
  check(
    await supabase
      .from('user_lesson_progress')
      .upsert(
        { user_id: telegramId, lesson_id: lessonId, opened_at: new Date().toISOString() },
        { onConflict: 'user_id,lesson_id' },
      ),
  );
}

/** Same upsert as bot/src/db/progress.ts markLessonCompleted. */
export async function markCompleted(telegramId: number, lessonId: string): Promise<void> {
  check(
    await supabase.from('user_lesson_progress').upsert(
      {
        user_id: telegramId,
        lesson_id: lessonId,
        completed: true,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,lesson_id' },
    ),
  );
}

export type CourseStats = { total: number; completed: number; nextLessonId: string | null };

/** Progress math as the bot does it: trackable = non-material lessons. */
export function courseStats(outline: LessonOutline[], progress: Map<string, Progress>): CourseStats {
  const trackable = outline.filter((l) => !l.material);
  const completed = trackable.filter((l) => progress.get(l.id)?.completed).length;
  const next = trackable.find((l) => !progress.get(l.id)?.completed) ?? outline[0] ?? null;
  return { total: trackable.length, completed, nextLessonId: next?.id ?? null };
}

/** Signed player URL for a hosted lessons.media item (supabase/functions/media-url);
 *  null when it can't be played here, so the caller falls back to the bot. */
export async function getMediaUrl(lessonId: string, index: number): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const res = await fetch(`${functionsUrl}/media-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: site.supabase.anonKey },
    body: JSON.stringify({ lesson_id: lessonId, index }),
  });
  if (!res.ok) return null;
  const body = await res.json().catch(() => ({}));
  return typeof body.url === 'string' ? body.url : null;
}

export type ClaimResult =
  | { status: 'granted'; course_slug: string; course_title: string; course_id: string }
  | { status: 'pending' | 'failed' | 'claimed_by_other' | 'not_found' | 'error' };

/** Bind a paid web order to the logged-in user (supabase/functions/claim-order). */
export async function claimOrder(orderId: string): Promise<ClaimResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: 'error' };
  const res = await fetch(`${functionsUrl}/claim-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: site.supabase.anonKey },
    body: JSON.stringify({ order_id: orderId }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 404) return { status: 'not_found' };
  if (res.status === 403) return { status: 'claimed_by_other' };
  if (!res.ok || !body.status) return { status: 'error' };
  return body as ClaimResult;
}
