-- Migration 0004: cabinet auth — browser access for logged-in Telegram users.
--
-- Identity: the tg-auth edge function creates a Supabase Auth user per Telegram
-- account and stores the Telegram id in app_metadata (admin-only, not user-editable).
-- Every policy below keys on that id; auth users without it see nothing.
--
-- Requires 0003_rls_lockdown.sql (no implicit grants to anon/authenticated).

BEGIN;

-- Link Telegram users to Supabase Auth users (written by tg-auth, service_role).
ALTER TABLE bot_users ADD COLUMN IF NOT EXISTS auth_uid UUID UNIQUE;

-- Telegram id of the calling user from the session JWT; NULL for anon or foreign auth users.
CREATE OR REPLACE FUNCTION public.current_telegram_id() RETURNS BIGINT
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'telegram_id', '')::bigint
$$;

-- Course ownership for the calling user (mirrors bot/src/db/purchases.ts hasAccess).
-- SECURITY DEFINER so policies can call it without recursive RLS evaluation.
CREATE OR REPLACE FUNCTION public.owns_course(p_course_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT current_telegram_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM user_courses uc
    WHERE uc.user_id = current_telegram_id()
      AND uc.course_id = p_course_id
      AND (uc.expires_at IS NULL OR uc.expires_at > now())
  )
$$;

CREATE OR REPLACE FUNCTION public.owns_lesson(p_lesson_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM lessons l WHERE l.id = p_lesson_id AND owns_course(l.course_id))
$$;

REVOKE ALL ON FUNCTION public.current_telegram_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owns_course(UUID)     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owns_lesson(UUID)     FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_telegram_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owns_course(UUID)     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owns_lesson(UUID)     TO authenticated, service_role;

-- bot_users: read own row; may change only the bot/cabinet UI language.
GRANT SELECT ON bot_users TO authenticated;
GRANT UPDATE (lang) ON bot_users TO authenticated;
DROP POLICY IF EXISTS "own_bot_user_select" ON bot_users;
CREATE POLICY "own_bot_user_select" ON bot_users FOR SELECT TO authenticated
  USING (id = current_telegram_id());
DROP POLICY IF EXISTS "own_bot_user_update" ON bot_users;
CREATE POLICY "own_bot_user_update" ON bot_users FOR UPDATE TO authenticated
  USING (id = current_telegram_id()) WITH CHECK (id = current_telegram_id());

-- courses: active courses for any Telegram-linked user (owned + upsell cards).
GRANT SELECT ON courses TO authenticated;
DROP POLICY IF EXISTS "courses_active_select" ON courses;
CREATE POLICY "courses_active_select" ON courses FOR SELECT TO authenticated
  USING (is_active = true AND current_telegram_id() IS NOT NULL);

-- lessons: full rows (text + media) only for owned courses or free previews.
GRANT SELECT ON lessons TO authenticated;
DROP POLICY IF EXISTS "lessons_owned_select" ON lessons;
CREATE POLICY "lessons_owned_select" ON lessons FOR SELECT TO authenticated
  USING (current_telegram_id() IS NOT NULL AND (is_free_preview = true OR owns_course(course_id)));

-- lessons_outline: program of every active course, no text/media — for locked views.
-- Owner-privileged view (security_invoker = false) so it bypasses lessons RLS.
CREATE OR REPLACE VIEW public.lessons_outline WITH (security_invoker = false) AS
  SELECT l.id, l.course_id, l.position, l.title, l.content_type,
         l.compact, l.material, l.is_free_preview
  FROM lessons l
  JOIN courses c ON c.id = l.course_id AND c.is_active = true
  WHERE current_telegram_id() IS NOT NULL;
REVOKE ALL ON public.lessons_outline FROM PUBLIC, anon;
GRANT SELECT ON public.lessons_outline TO authenticated;

-- user_courses: read own purchases. Writes stay server-side (payments / claim-order).
GRANT SELECT ON user_courses TO authenticated;
DROP POLICY IF EXISTS "own_user_courses_select" ON user_courses;
CREATE POLICY "own_user_courses_select" ON user_courses FOR SELECT TO authenticated
  USING (user_id = current_telegram_id());

-- user_lesson_progress: own rows, only for lessons of owned courses (same table the bot writes).
GRANT SELECT, INSERT, UPDATE ON user_lesson_progress TO authenticated;
DROP POLICY IF EXISTS "own_progress_select" ON user_lesson_progress;
CREATE POLICY "own_progress_select" ON user_lesson_progress FOR SELECT TO authenticated
  USING (user_id = current_telegram_id());
DROP POLICY IF EXISTS "own_progress_insert" ON user_lesson_progress;
CREATE POLICY "own_progress_insert" ON user_lesson_progress FOR INSERT TO authenticated
  WITH CHECK (user_id = current_telegram_id() AND owns_lesson(lesson_id));
DROP POLICY IF EXISTS "own_progress_update" ON user_lesson_progress;
CREATE POLICY "own_progress_update" ON user_lesson_progress FOR UPDATE TO authenticated
  USING (user_id = current_telegram_id())
  WITH CHECK (user_id = current_telegram_id() AND owns_lesson(lesson_id));

-- Studying in either channel counts as activity, so the bot's inactivity job
-- (bot/src/jobs/inactivity.ts, keyed on bot_users.last_active) doesn't nag
-- people who learn in the cabinet.
CREATE OR REPLACE FUNCTION public.touch_bot_user_last_active() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE bot_users SET last_active = now() WHERE id = NEW.user_id;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.touch_bot_user_last_active() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_progress_touch_last_active ON user_lesson_progress;
CREATE TRIGGER trg_progress_touch_last_active
  AFTER INSERT OR UPDATE ON user_lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_bot_user_last_active();

-- payments, promotions, reminders, bot_sessions, bot_waitlist: no browser access.

COMMIT;
