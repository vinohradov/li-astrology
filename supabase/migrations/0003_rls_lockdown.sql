-- Migration 0003: close anon/authenticated access to all public tables.
--
-- Defect (found 2026-09-14): the `service_role_all_<table>` policies from
-- bot/schema.sql and 0001/0002 were created without `TO service_role`, so they
-- applied to PUBLIC. Together with Supabase's default table grants, the public
-- anon key (shipped in web/src/config/site.ts) could read and write every table.
--
-- After this migration:
--   * the service_role policies are scoped to service_role (which also has BYPASSRLS),
--   * anon/authenticated hold no privileges on existing public tables/sequences,
--   * tables created later by `postgres` are not auto-granted to anon/authenticated,
--     so every browser-facing grant must be explicit (see 0004_cabinet_auth.sql).
--
-- Bot (sb_secret_ key) and edge functions (SUPABASE_SERVICE_ROLE_KEY) run as
-- service_role and are unaffected.

BEGIN;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'bot_users','courses','lessons','user_courses','user_lesson_progress',
    'reminders','promotions','bot_sessions','payments','bot_waitlist'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "service_role_all_%s" ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "service_role_all_%s" ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      tbl, tbl);
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

COMMIT;
