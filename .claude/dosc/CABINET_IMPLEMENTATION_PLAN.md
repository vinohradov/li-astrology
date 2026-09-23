# Cabinet — Implementation Plan (step-by-step, for execution sessions)

> Written 2026-09-14 against the **live** DB, edge functions, bot and web code.
> Companion to `CABINET_SPEC.md` (the design). Where this file and the spec disagree,
> **this file wins** — §1 lists every deliberate change and why.
>
> **How to use this file:** work top to bottom, one phase per PR/session. Every step has
> files to touch, the exact contract, and a "Verify" block. After each step, tick the
> checkbox in §10 and add one line to the log in §11. Do not skip Phase 0.
>
> **Status 2026-09-14:** Phases 0–3 implemented and **live** (`main` @ `8f68ac8`): migrations
> 0003/0004, edge functions `tg-auth` + `claim-order`, secret fix, and the website cabinet. Remaining go-live steps are in §10. Regression
> tests live in `tools/cabinet-tests/`. Next build work: Phase 4 (media).

---

## 0. Ground truth (verified 2026-09-14)

### Infra

| Thing | Fact |
|---|---|
| Site | Astro 6 + React 19 islands + Tailwind 4 in `web/`. Static build → GitHub Pages via `.github/workflows/deploy.yml` (triggers on `web/**` push to `main`). Domain `https://www.li-astrology.com.ua`. **No SSR, no server rewrites** → unknown paths 404 → cabinet routes must be real static pages + query params. |
| Web → backend | Only `web/src/scripts/payment.ts` talks to Supabase, and only to the `create-payment` edge function with the anon key. No PostgREST usage from the site yet. `@supabase/supabase-js` is **not** in `web/package.json` yet. |
| Bot | grammY in `bot/`, deployed on **Fly.io** (`bot/fly.toml`, app `li-astrology-bot`). `docs/STATUS.md` still says Railway — stale. Uses `SUPABASE_SERVICE_KEY` (`sb_secret_…`, maps to `service_role`, bypasses RLS). |
| Supabase | project `plyofinxmwvwbintvqbx`, linked in CLI (`supabase/.temp/project-ref`). CLI installed (2.72.7, old — `brew upgrade supabase`). Edge functions: `create-payment`, `mono-callback`, `wfp-callback`, `reconcile-payments`, all `verify_jwt=false` (`supabase/config.toml`). Secrets already set: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `SITE_URL`, `MONOBANK_TOKEN`. |
| Supabase Auth | **0 users**. Email provider enabled, signups enabled, anonymous sign-in disabled. JWT signing uses the **new asymmetric keys (ES256, see `/auth/v1/.well-known/jwks.json`)** → do NOT plan on minting our own HS256 JWTs with a legacy secret (spec §3 did). |
| Storage | No buckets exist. |
| Local machine | Node **20.4** (web needs ≥22.12 → use `nvm use 22`), Docker installed but daemon not running (only needed for `supabase functions serve`), no `psql`. |
| Repo | **public** (`github.com/vinohradov/li-astrology`). Never commit secrets. |
| Supabase account | **The only account used for this project** is the owner's personal GitHub login `vinohradov` (dashboard sign-in = "Continue with GitHub"). The CLI is logged in; its personal access token (macOS keychain, `sbp_…`) works for the Management API — SQL as `postgres` and auth config — so no dashboard access is required for this plan. |

### Data (live)

Tables and columns (from PostgREST OpenAPI):

```
courses               id uuid, slug, title, description, price_uah int (KOPIYKAS: 119900 = 1199 UAH),
                      sort_order, is_active, created_at, intro_html
lessons               id uuid, course_id, position smallint, title, content_type ('video'|'audio'|'document'|'mixed'),
                      text_html (Telegram-HTML subset, \n newlines), media jsonb, tg_message_id,
                      is_free_preview bool, compact bool, material bool, created_at
user_courses          id, user_id bigint (= telegram id), course_id, purchased_at, expires_at, payment_id text (= order_id), amount_paid
user_lesson_progress  user_id bigint, lesson_id uuid, completed bool, opened_at, completed_at   (PK user_id+lesson_id)
bot_users             id bigint (telegram id), first_name, last_name, username, phone, email, lang ('uk'|'ru'), created_at, last_active, blocked_bot
payments              id, order_id text UNIQUE, provider, provider_order_id, status ('pending'|'paid'|'failed'|'expired'|'refunded'),
                      course_slug, amount int (UAH, not kopiykas!), currency, telegram_user_id bigint|null, customer_*, promo_code,
                      source ('web'|'bot'), raw, paid_at, created_at, updated_at
promotions, reminders, bot_sessions, bot_waitlist   (bot-internal, cabinet never touches them)
```

Courses (all `is_active=true`, all have `intro_html`):

| slug | id | price | lessons |
|---|---|---|---|
| `intensiv` | `2ad83d74-35ce-4a85-afe1-44799076b22e` | 1199 UAH | 11 |
| `astro-z-0` | `50626a23-7423-40d2-93d2-fd11d6d7cf23` | 6000 UAH | 26 |
| `aspekty-basic` | `6239c8d4-a5a0-4783-ba35-7d73d1eb63c7` | 1290 UAH | 4 |
| `aspekty-pro` | `1a3c5ec9-2ac9-4322-beed-ec0fb9e88c6e` | 2790 UAH | 7 |

Lessons: 48 total. `media` items are **always** `{ "type": "video"|"audio"|"document", "file_id": "<telegram file_id>" }` — 52 video, 47 document, 16 audio, no other keys, no URLs. `is_free_preview` and `material` are `false` everywhere; `compact=true` on 16 lessons of `astro-z-0` and 3 of `aspekty-basic` (homework chips, podcasts, methodички). Row counts: 3 `bot_users`, 2 `user_courses`, 22 progress rows, 31 payments. **The production user base is tiny → migrations are low-risk and prod can double as the test environment.**

### Bot semantics the cabinet must mirror (`bot/src/handlers/lesson.ts`, `my-courses.ts`, `db/progress.ts`)

- Opening a lesson upserts `user_lesson_progress` with `opened_at=now()` (`markLessonOpened`). Completing sets `completed=true, completed_at=now()` (`markLessonCompleted`). Both `onConflict: 'user_id,lesson_id'`.
- Progress total = lessons where `material=false`; completed = progress rows with `completed=true` joined to that course.
- List rendering: `compact` lessons render as small chips 2-per-row; full lessons one per row. Type icon (🎬/🎧/📄/📚) is prepended **unless the title already starts with an emoji**.
- Lesson view: title + `text_html` + media items (video/audio/document, in array order) + "mark complete" (hidden for `material` lessons) + prev/next + back.
- Access check: `user_courses` row exists and (`expires_at` is null or in the future).
- `astro-z-0` has an extra "📚 Література / книги" screen hard-coded in `bot/src/content/extras.ts` (`COURSE_EXTRAS`).
- Web purchase claim (`bot/src/handlers/start.ts` → `handleOrderIdDeeplink` + `db/payments.ts` → `claimPaymentForUser`): payment must be `paid`; if `telegram_user_id IS NULL` do a **conditional update** (`WHERE telegram_user_id IS NULL`) so a second user cannot hijack it; if already someone else's → "alreadyClaimed"; then `grantAccess` upsert into `user_courses` with `payment_id=order_id, amount_paid=amount*100`.

### 🔴 Security defect found (fix in Phase 0)

`bot/schema.sql` / `0001_payments.sql` create policies `CREATE POLICY "service_role_all_<t>" ... FOR ALL USING (true) WITH CHECK (true)` **without `TO service_role`** → they apply to every role including `anon`. Verified 2026-09-14: the public anon key (shipped in `web/src/config/site.ts`) can `SELECT` from `bot_users`, `payments`, `lessons` (incl. file_ids) and gets HTTP 200 on `PATCH bot_users`. `docs/SECURITY.md` claims the opposite. Anyone can currently grant themselves courses or read customer data. This must be closed **before** any authenticated policies are added.

---

## 1. Decisions that change vs `CABINET_SPEC.md`

| # | Spec said | Now | Why |
|---|---|---|---|
| 1 | Sign our own JWT in `tg-auth` with `SUPABASE_JWT_SECRET`, store in localStorage, 7-day expiry, RLS on `auth.jwt()->>'telegram_id'`. | Use **real Supabase Auth users**. `tg-auth` verifies the Telegram hash, finds/creates an `auth.users` row (synthetic email `tg-<id>@users.li-astrology.com.ua`, `email_confirm=true`, `app_metadata.telegram_id`), calls `auth.admin.generateLink({type:'magiclink'})` and returns the `hashed_token`; the browser calls `supabase.auth.verifyOtp({token_hash, type:'magiclink'})` and gets a normal session (refresh tokens, `onAuthStateChange`, works with `verify_jwt=true` functions). RLS reads `app_metadata.telegram_id` via a SQL helper `current_telegram_id()`. | Project uses asymmetric signing keys; legacy HS256 secret is being phased out by Supabase and may be revoked. Real sessions also give us free refresh, logout, and a straight path to email OTP later (same `auth.users`). `app_metadata` is admin-only → users cannot forge their telegram id. |
| 2 | Framework island "Preact/Svelte/vanilla". | **React** (`@astrojs/react` already installed, `ProgramAccordion.tsx` is the pattern). | No new toolchain. |
| 3 | Client-side router under `/cabinet/`. | Three static Astro pages: `/cabinet/`, `/cabinet/course/?slug=…`, `/cabinet/lesson/?id=…`. Each mounts one React island with `client:only="react"`. | GitHub Pages can't rewrite; query params survive static hosting; each page gets a real `<title>`. |
| 4 | Separate `order-status` + `claim-order` edge functions; success page polls before showing options. | **One** `claim-order` function returning `pending / granted / failed / claimed_by_other`. Success page just links to `/cabinet/?claim=<order_id>`; the cabinet polls `claim-order` every 5 s while `pending` (reconcile job runs every minute). | Fewer moving parts, no unauthenticated status endpoint, and the "checking payment" state lives where the user ends up anyway. |
| 5 | `lessons` SELECT only for owned courses. | Same, **plus** a `lessons_outline` view (id, course_id, position, title, content_type, compact, material, is_free_preview — no text, no media) readable by any logged-in user. | Lets the course page show a locked program for unowned courses (upsell) without leaking content. |
| 6 | UK/RU toggle in cabinet v1. | **Ukrainian only** in v1; keep strings in one `web/src/lib/cabinet-strings.ts` so RU can be added later. | Site RU toggle is a stub, all course content is UK-only. |
| 7 | (not covered) | Phase 0 = RLS lockdown (see §0). | Pre-existing hole; adding `authenticated` policies on top of PUBLIC-open tables is pointless. |
| 8 | (not covered) | Every `authenticated` policy also requires `current_telegram_id() IS NOT NULL`, so an auth user created outside `tg-auth` sees nothing. Additionally (optional, defence in depth) set `disable_signup=true` via the Management API; `auth.admin.createUser` still works. | Otherwise anyone can `signUp()` with the anon key and get role `authenticated`. The SQL guard makes the cabinet safe even if the dashboard flag is ever flipped back. |
| 9 | Extras (`COURSE_EXTRAS`) hard-coded in bot. | Optional: move to `courses.extras_html` + `courses.extras_label`; bot falls back to DB. | One source of truth; not blocking. |
| 10 | Media contract: `{type, file_id, bunny_id?, storage_path?}`. | `{type, file_id, title?, bunny_video_id?, storage_path?, size_bytes?, duration_s?}`, addressed by `(lesson_id, index)`. Items with only `file_id` render as "available in the Telegram bot" placeholders. | Defined now so the lesson UI is final before media exists (Phase 4). |
| 11 | `claim-order` with `verify_jwt = true`. | `verify_jwt = false`; the function verifies the session itself with `auth.getUser(jwt)` and reads `app_metadata.telegram_id`. | The gateway JWT check does not support the project's asymmetric (ES256) signing keys. `getUser` is a full server-side validation. |
| 12 | `TG_AUTH_DEV_SECRET` escape hatch for localhost. | **Not implemented.** Local/CI testing signs a real widget payload with `BOT_TOKEN` and injects the resulting session into `localStorage` (see `tools/cabinet-tests/`). | No bypass code path exists in production. |
| 13 | (not covered) | Trigger `trg_progress_touch_last_active` bumps `bot_users.last_active` on any progress write. | The bot's inactivity job keys on `last_active`; without it cabinet learners would get "you haven't studied" nudges. |
| 14 | (not covered) | Bot handles `/start lesson_<uuid>` (access-checked) so lesson media cards deep-link into the right lesson. | Media stays in Telegram until Phase 4. Needs a bot redeploy (`fly deploy`). |
| 15 | (not covered) | Supabase secret `TELEGRAM_BOT_TOKEN` was stale (digest ≠ live token; the 2026-08-18 rotation only updated `bot/.env` + Fly). Reset to the live token 2026-09-14. | `tg-auth` verifies widget hashes with it; `mono-callback`/`reconcile-payments` Telegram notifications were silently failing too. |
| 16 | Buy buttons only as an upsell idea. | "Купити" on other-course cards and on locked course pages; `web/src/lib/checkout.ts` is shared with the marketing `payment.ts`. | One invoice code path for site and cabinet. |

Unchanged from spec: cabinet lives at `/cabinet/` on the main domain, bot stays as a parallel channel on the same tables, Telegram Login Widget is the v1 auth, Bunny Stream for video + Supabase Storage for PDF/audio, media served only via short-lived signed URLs, email accounts deferred.

---

## 2. Conventions for every phase

- **Migrations**: new files in `supabase/migrations/NNNN_name.sql`, numbered after `0002`. Wrap in `BEGIN; … COMMIT;`. Idempotent where possible (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`).
  - **Apply with the Management API using the CLI's login token** (verified 2026-09-14: runs as `postgres`, no dashboard or DB password needed). The token lives in the macOS keychain; never print it fully, never commit it:
    ```bash
    SBP=$(security find-generic-password -s "Supabase CLI" -w | sed 's/^go-keyring-base64://' | base64 -d)
    REF=plyofinxmwvwbintvqbx
    sbsql() { python3 -c 'import json,sys; print(json.dumps({"query": sys.stdin.read()}))' \
      | curl -s -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
          -H "Authorization: Bearer $SBP" -H "Content-Type: application/json" -d @-; echo; }
    sbsql < supabase/migrations/0003_rls_lockdown.sql      # apply a file
    echo "select count(*) from courses" | sbsql              # ad-hoc query
    ```
    Fallbacks: SQL Editor (dashboard login = GitHub account `vinohradov`), or `supabase db push --linked` (needs the DB password; first `supabase migration repair --status applied 0001 0002`). Whatever the path, run the step's "Verify" curl after.
- **Auth settings** (same token): read `GET https://api.supabase.com/v1/projects/$REF/config/auth`, change with `PATCH … -d '{"disable_signup": true}'`. `site_url` there is `http://localhost:3000` — irrelevant for us (we never send the magic-link email, only exchange its `token_hash`).
- **Edge functions**: `supabase/functions/<name>/index.ts`, Deno, same imports as `create-payment` (`std@0.168.0/http/server.ts`, `esm.sh/@supabase/supabase-js@2`). CORS headers copied from `create-payment` (add `Access-Control-Allow-Origin: *` — GitHub Pages origin is fixed but `*` matches existing functions). Register JWT setting in `supabase/config.toml`. Deploy: `supabase functions deploy <name>` (add `--no-verify-jwt` if `verify_jwt=false`).
- **Secrets**: `supabase secrets set KEY=value`. Never in code, never in `docs/`.
- **Web**: TypeScript strict, `@/` alias = `web/src/`. Tailwind tokens from `web/src/styles/global.css` (`ink`, `cream`, `gold`, `gold-bright`, `plum`, `plum-deep`, `font-display`). Buttons look like `PaymentButton.astro` (rounded-full, uppercase, tracking-[0.2em]). Cabinet pages pass `noindex` to the layout.
- **Verification is via curl against the live project** (the base is tiny). Service key is in `bot/.env` as `SUPABASE_SERVICE_KEY`; anon key is in `web/src/config/site.ts`.

```bash
# helpers used in Verify blocks
cd /Users/andriivinohradov/WebstormProjects/astrology
set -a; source bot/.env; set +a
ANON=$(grep -o "eyJ[^']*" web/src/config/site.ts | head -1)
SVC="$SUPABASE_SERVICE_KEY"
```

- **Docs to keep current**: tick §10, log in §11, and when a phase ships update `docs/STATUS.md` (also fix "Railway" → "Fly.io") and `docs/SECURITY.md`.
- **Branch/PR**: one branch per phase (`feat/cabinet-phase-N`). Pushing `web/**` to `main` deploys the live site immediately, so keep unfinished cabinet pages unlinked from the header until Phase 3 is done (they are still reachable by URL — that's fine, they're `noindex`).

---

## 3. Phase 0 — Lock down RLS (½ day) — **do first, ships alone**

Goal: anon key can read/write nothing; service role keeps working; nothing else changes.

### Step 0.1 — migration `supabase/migrations/0003_rls_lockdown.sql`

```sql
BEGIN;

-- 1. The original policies were created without `TO service_role`, so they applied to
--    PUBLIC (incl. anon). Recreate them scoped to service_role only. service_role also
--    has BYPASSRLS, so these policies are belt-and-braces.
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

-- 2. Remove the default table privileges from the browser-facing roles.
--    Later migrations GRANT back exactly what the cabinet needs.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

COMMIT;
```

### Step 0.2 — verify

```bash
# must be 401/403 or an empty/permission-denied body, NOT rows:
curl -s "$SUPABASE_URL/rest/v1/bot_users?select=id&limit=1" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
curl -s -o /dev/null -w "%{http_code}\n" -X PATCH "$SUPABASE_URL/rest/v1/bot_users?id=eq.0" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" -d '{"last_active":"2026-01-01T00:00:00Z"}'
# service key must still work (expect rows):
curl -s "$SUPABASE_URL/rest/v1/courses?select=slug" -H "apikey: $SVC" -H "Authorization: Bearer $SVC"
```
Then smoke the bot (`/start`, My courses, open a lesson) and one web checkout up to the Mono page (`create-payment` uses the service key, must still return an `invoice_url`).

### Step 0.3 — docs
- `docs/SECURITY.md` → RLS section: describe the defect, the fix, the date.
- `docs/TODO.md` → remove the urgent item once merged.

**Done when:** both anon curls return no data and the bot + checkout smoke pass.

---

## 4. Phase 1 — Auth: Telegram Login → Supabase session (2–3 days)

Goal: a user can log in at `/cabinet/` with the Telegram widget and get a Supabase session whose JWT carries `app_metadata.telegram_id`; RLS lets that user read their own data. No course UI yet beyond "logged in as …".

### Manual prerequisites (user)
- [ ] BotFather → `/setdomain` → bot `@li_astrology_bot` → `www.li-astrology.com.ua`. The widget refuses to load on any other origin (including localhost).
- [ ] (optional, recommended) disable public signups — one command, no dashboard:
      `curl -s -X PATCH "https://api.supabase.com/v1/projects/$REF/config/auth" -H "Authorization: Bearer $SBP" -H "Content-Type: application/json" -d '{"disable_signup": true}'` (see §2 for `$SBP`). The RLS guard in 1.1 makes this non-blocking.
- [ ] `brew upgrade supabase`; `nvm use 22` (nvm is installed).

### Step 1.1 — migration `0004_cabinet_auth.sql`

```sql
BEGIN;

-- Link Telegram users to Supabase Auth users (filled by the tg-auth function).
ALTER TABLE bot_users ADD COLUMN IF NOT EXISTS auth_uid UUID UNIQUE;

-- Telegram id of the calling user, read from the session JWT. NULL for anon or
-- for auth users created outside tg-auth (they then match no row anywhere).
CREATE OR REPLACE FUNCTION public.current_telegram_id() RETURNS BIGINT
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT NULLIF(
    coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb
      -> 'app_metadata' ->> 'telegram_id',
    ''
  )::bigint
$$;
GRANT EXECUTE ON FUNCTION public.current_telegram_id() TO authenticated;

-- Ownership helper (mirrors bot/src/db/purchases.ts hasAccess).
CREATE OR REPLACE FUNCTION public.owns_course(p_course_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_courses uc
    WHERE uc.user_id = current_telegram_id()
      AND uc.course_id = p_course_id
      AND (uc.expires_at IS NULL OR uc.expires_at > now())
  )
$$;
GRANT EXECUTE ON FUNCTION public.owns_course(UUID) TO authenticated;

-- bot_users: own row, may only change lang/email.
GRANT SELECT ON bot_users TO authenticated;
GRANT UPDATE (lang, email) ON bot_users TO authenticated;
CREATE POLICY "own_bot_user_select" ON bot_users FOR SELECT TO authenticated
  USING (id = current_telegram_id());
CREATE POLICY "own_bot_user_update" ON bot_users FOR UPDATE TO authenticated
  USING (id = current_telegram_id()) WITH CHECK (id = current_telegram_id());

-- courses: any logged-in user sees active courses (needed for upsell cards).
GRANT SELECT ON courses TO authenticated;
CREATE POLICY "courses_active_select" ON courses FOR SELECT TO authenticated
  USING (is_active = true AND current_telegram_id() IS NOT NULL);

-- lessons: full rows only for owned courses or free previews.
GRANT SELECT ON lessons TO authenticated;
CREATE POLICY "lessons_owned_select" ON lessons FOR SELECT TO authenticated
  USING (current_telegram_id() IS NOT NULL AND (is_free_preview = true OR owns_course(course_id)));

-- lessons_outline: titles/positions of every lesson (no text, no media) for the
-- locked program view. security_invoker=false → runs as owner, bypasses lessons RLS.
CREATE OR REPLACE VIEW lessons_outline WITH (security_invoker = false) AS
  SELECT id, course_id, position, title, content_type, compact, material, is_free_preview
  FROM lessons
  WHERE current_telegram_id() IS NOT NULL;   -- auth users without a telegram id see nothing
GRANT SELECT ON lessons_outline TO authenticated;

-- user_courses: own rows.
GRANT SELECT ON user_courses TO authenticated;
CREATE POLICY "own_user_courses_select" ON user_courses FOR SELECT TO authenticated
  USING (user_id = current_telegram_id());

-- user_lesson_progress: own rows, and only for lessons of owned courses.
GRANT SELECT, INSERT, UPDATE ON user_lesson_progress TO authenticated;
CREATE POLICY "own_progress_select" ON user_lesson_progress FOR SELECT TO authenticated
  USING (user_id = current_telegram_id());
CREATE POLICY "own_progress_insert" ON user_lesson_progress FOR INSERT TO authenticated
  WITH CHECK (user_id = current_telegram_id()
    AND EXISTS (SELECT 1 FROM lessons l WHERE l.id = lesson_id AND owns_course(l.course_id)));
CREATE POLICY "own_progress_update" ON user_lesson_progress FOR UPDATE TO authenticated
  USING (user_id = current_telegram_id())
  WITH CHECK (user_id = current_telegram_id());

COMMIT;
```

Notes: `payments`, `promotions`, `reminders`, `bot_sessions`, `bot_waitlist` get **no** grants — the cabinet reaches payments only through edge functions.

### Step 1.2 — edge function `supabase/functions/tg-auth/index.ts`

`supabase/config.toml`:
```toml
[functions.tg-auth]
# Called before the user has a session; the Telegram hash is the credential.
verify_jwt = false
```

Contract:
```
POST /functions/v1/tg-auth
body: { id: number, first_name: string, last_name?: string, username?: string,
        photo_url?: string, auth_date: number, hash: string }      // raw widget payload
200: { token_hash: string, telegram_id: number }
401: { error: 'bad_hash' | 'expired' }
400: { error: 'bad_request' }
```

Algorithm (Telegram Login Widget spec):
1. `data_check_string` = all received fields except `hash`, as `key=value`, sorted by key, joined with `\n`. Only include keys that were sent.
2. `secret_key = SHA256(TELEGRAM_BOT_TOKEN)` (raw bytes); `expected = hex(HMAC_SHA256(secret_key, data_check_string))`. Compare to `hash` with constant-time compare. Use `crypto.subtle` (works in Deno) or `node:crypto`.
3. Reject if `now - auth_date > 86400`.
4. Upsert `bot_users` (`id, first_name, last_name, username, last_active=now(), blocked_bot=false` — same fields as `bot/src/db/users.ts upsertUser`). Do **not** touch `lang`.
5. Resolve auth user: read `bot_users.auth_uid`. If null → `supabase.auth.admin.createUser({ email: \`tg-${id}@users.li-astrology.com.ua\`, email_confirm: true, app_metadata: { telegram_id: id, provider: 'telegram' }, user_metadata: { first_name, username } })`; on `email_exists` (row created but `auth_uid` write failed earlier) look it up with `admin.listUsers` filtered by that email; then `UPDATE bot_users SET auth_uid`. If `auth_uid` exists but `app_metadata.telegram_id` is missing → `admin.updateUserById` to set it (self-healing).
6. `const { data } = await supabase.auth.admin.generateLink({ type: 'magiclink', email })` → return `data.properties.hashed_token` as `token_hash`.
7. Log one line `[tg-auth] ok telegram_id=… uid=…`.

Dev escape hatch: **not implemented** — see decision #12.

Deploy: `supabase functions deploy tg-auth --no-verify-jwt`.

### Step 1.3 — web: Supabase client + auth helpers

- `cd web && npm i @supabase/supabase-js`
- `web/src/lib/supabase.ts`:
  ```ts
  import { createClient } from '@supabase/supabase-js';
  import { site } from '@/config/site';
  export const supabase = createClient(site.supabase.url, site.supabase.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  ```
- `web/src/lib/auth.ts`:
  - `loginWithTelegram(widgetData)` → POST `tg-auth` → `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })` → returns session.
  - `getTelegramId(session)` → `Number(session.user.app_metadata?.telegram_id)` or null.
  - `logout()` → `supabase.auth.signOut()`.
  - `useSession()` React hook: initial `getSession()`, subscribe `onAuthStateChange`, returns `{ session, loading }`.
- `web/src/components/cabinet/TelegramLogin.tsx`: injects `<script async src="https://telegram.org/js/telegram-widget.js?22" data-telegram-login="li_astrology_bot" data-size="large" data-userpic="false" data-request-access="write" data-onauth="onTelegramAuth(user)">` into a ref'd div; defines `window.onTelegramAuth = (user) => loginWithTelegram(user)`. Show a spinner + error toast (reuse the toast style from `payment.ts`). Copy: "Увійдіть через Telegram — той самий акаунт, що й у боті. Ваші курси та прогрес з'являться автоматично."
- `web/src/layouts/CabinetLayout.astro`: like `Layout.astro` (same `<head>`, fonts, Analytics, `noindex` always) but a **solid dark top bar** (the marketing `Header.astro` is absolute/transparent for hero pages) with logo, "Мої курси" link, user name + "Вийти" (rendered by a small React `CabinetNav` island), and a minimal footer. Body background `bg-cream-soft`.
- `web/src/pages/cabinet/index.astro`: `<CabinetLayout title="Кабінет — Li Astrology"><CabinetHome client:only="react" /></CabinetLayout>`.
- `web/src/components/cabinet/CabinetHome.tsx` (Phase 1 version): if no session → `<TelegramLogin/>`; else "Ви увійшли як {first_name} (id …)" + logout button. Phase 2 replaces the body with the course grid.
- Add `analytics`: on successful login `window.gtag?.('event','login',{method:'telegram'})`.

### Step 1.4 — verify

1. Deploy site (push `web/**`), open `https://www.li-astrology.com.ua/cabinet/`, log in with the widget. Expect: name shown; `localStorage` has `sb-plyofinxmwvwbintvqbx-auth-token`.
2. In DevTools console:
   ```js
   const s = (await supabase.auth.getSession()).data.session; // expose supabase on window in dev builds
   JSON.parse(atob(s.access_token.split('.')[1])).app_metadata   // → { telegram_id: 413606412, provider: 'telegram' }
   await supabase.from('bot_users').select('*')          // → exactly one row (yours)
   await supabase.from('user_courses').select('*')       // → your purchases (2 rows for the owner account)
   await supabase.from('lessons').select('id').limit(1)  // → rows only if you own a course
   await supabase.from('payments').select('*')           // → error: permission denied
   ```
3. Negative: POST `tg-auth` with a tampered `hash` → 401. With `auth_date` older than a day → 401.
4. Bot unaffected (`/start`, My courses).

**Done when:** the 4 checks pass. Bonus check: `signUp({email,password})` with the anon key either fails (signups disabled) or succeeds but `from('courses').select()` returns `[]` for that user.

---

## 5. Phase 2 — Cabinet UI: courses, program, lesson, progress (3–5 days)

Goal: every text lesson is consumable in the cabinet with progress in sync with the bot; media items show as typed placeholders that will become players in Phase 4.

### Step 2.1 — data layer `web/src/lib/cabinet-api.ts`

All calls go through `supabase` (RLS enforces access). Types in `web/src/lib/cabinet-types.ts`:

```ts
export type MediaItem = {
  type: 'video' | 'audio' | 'document';
  file_id: string;              // Telegram — used by the bot only
  title?: string;               // display name (Phase 4 fills)
  bunny_video_id?: string;      // Phase 4 — videos
  storage_path?: string;        // Phase 4 — audio/document in bucket course-media
  size_bytes?: number;
  duration_s?: number;
};
export type Course = { id: string; slug: string; title: string; description: string|null; price_uah: number; sort_order: number; is_active: boolean; intro_html: string|null };
export type LessonOutline = { id: string; course_id: string; position: number; title: string; content_type: string; compact: boolean; material: boolean; is_free_preview: boolean };
export type Lesson = LessonOutline & { text_html: string|null; media: MediaItem[] };
export type Progress = { lesson_id: string; completed: boolean; opened_at: string; completed_at: string|null };
```

Functions:
- `listCourses()` → `courses` ordered by `sort_order`.
- `listMyCourseIds()` → `user_courses` (`course_id, expires_at`) → filter unexpired.
- `getOutline(courseId)` → `lessons_outline` ordered by `position`.
- `getLessons(courseId)` → `lessons` ordered by `position` (returns [] when not owned — RLS).
- `getLesson(id)` → single `lessons` row or null.
- `getProgress(courseId)` → `user_lesson_progress` `select('lesson_id, completed, opened_at, completed_at, lessons!inner(course_id)')` `.eq('lessons.course_id', courseId)`.
- `markOpened(telegramId, lessonId)` / `markCompleted(telegramId, lessonId)` → same upserts as `bot/src/db/progress.ts` (`onConflict: 'user_id,lesson_id'`). Completed must never be un-set by `markOpened` (only send `opened_at`).
- `courseStats(outline, progress)` → `{ total: outline.filter(l => !l.material).length, completed: progress.filter(p => p.completed && trackable).length }`.
- `updateLang(telegramId, lang)` → `bot_users` update (Settings page).

### Step 2.2 — pages & components

| Route | File | Island | Content |
|---|---|---|---|
| `/cabinet/` | `pages/cabinet/index.astro` | `CabinetHome.tsx` | Login gate. Then: **Мої курси** grid (cards: cover from `/images/courses/<slug>.jpg`, title, progress bar `completed/total`, button "Продовжити" → first not-completed lesson, or "Почати"). Below: **Інші курси** upsell cards for active courses not owned (price from `price_uah/100`, "Детальніше" → marketing page `products[slug].href`, "Купити" → Phase 3). Empty state copy = bot's `myCourses.empty`. |
| `/cabinet/course/?slug=` | `pages/cabinet/course/index.astro` | `CourseView.tsx` | Course title, progress bar, `intro_html` in a collapsible "Про курс". Lesson list from outline: `compact` items as 2-col chips, others full-width rows; ✅ for completed; type icon rule from §0. If not owned: rows are locked (🔒, no link), plus a buy CTA. If `slug` unknown → "Курс не знайдено" + link back. |
| `/cabinet/lesson/?id=` | `pages/cabinet/lesson/index.astro` | `LessonView.tsx` | Loads lesson (RLS → null means no access → redirect to course page). On mount `markOpened`. Renders: breadcrumb, title, `text_html` (see 2.3), media blocks (see 2.4), "✅ Позначити як завершений" (hidden when `material`; disabled label "✅ Завершено" when done), prev/next from outline, "📋 До списку уроків". Fire `gtag('event','lesson_complete',{course_slug, lesson_id})`. |
| `/cabinet/settings/` | `pages/cabinet/settings/index.astro` | `SettingsView.tsx` | Telegram name/username/id, language radio (`uk`/`ru`, writes `bot_users.lang` — affects bot UI), "Вийти". |

Shared: `CabinetShell.tsx` (session gate + loading skeleton + error boundary), `ProgressBar.tsx`, `LessonRow.tsx`, `MediaBlock.tsx`, `cabinet-strings.ts` (all UI copy; seed from `bot/src/locales/uk.ts` `myCourses`/`lessons` keys so wording matches the bot).

### Step 2.3 — rendering `text_html`

Content is Telegram-HTML written by us: tags `b, strong, i, em, u, s, a, code, pre, blockquote, tg-spoiler`, newlines as `\n`. Render with a tiny converter: escape nothing (trusted, authored by the owner), replace `\n` → `<br>`, map `tg-spoiler` → `<span class="spoiler">`, open links in new tab. Put it in `web/src/lib/tg-html.ts` and unit-test it mentally with lesson `astro-z-0` #22 (1063 chars, the longest).

### Step 2.4 — `MediaBlock.tsx` (the "materials structure")

One card per `media[i]`, in order, labelled by type: 🎬 Відео / 🎧 Аудіо / 📄 Матеріал, with `title` if present else "Відео 1", "Файл 2"… State machine:

- `bunny_video_id` present → Phase 4 player (`<iframe>` with signed embed URL from `media-url`).
- `storage_path` present → Phase 4 audio `<audio controls>` / document "Завантажити" link (signed URL).
- only `file_id` → **placeholder**: muted card "Цей файл поки доступний у Telegram-боті" + button "Відкрити в боті" → `https://t.me/li_astrology_bot?start=lesson_<lesson_id>` (bot-side handler for `lesson_` payloads is a 10-line addition in `bot/src/handlers/start.ts`: payload `lesson_<uuid>` → `showLesson`; add when convenient).

Until Phase 4 the first two branches are unreachable but the component must already switch on the fields, so Phase 4 only adds the URL fetching.

### Step 2.5 — header link + nice touches
- Add `{ href: '/cabinet/', label: 'Кабінет' }` to `nav` in `web/src/components/Header.astro` and a "Кабінет" link in `Footer.astro` **only after Phase 3** (see §2 branch note). Until then reach it by URL.
- Optional (decision #9): `ALTER TABLE courses ADD COLUMN extras_label TEXT, ADD COLUMN extras_html TEXT;` copy the `astro-z-0` literature block from `bot/src/content/extras.ts`, render on the course page, and make the bot prefer DB values.

### Step 2.6 — verify
- Log in as the owner account (owns `intensiv` + `aspekty-pro` per live `user_courses`): both cards show correct `completed/total`, matching the bot's "Мої курси" numbers exactly (22 progress rows exist — compare).
- Open a lesson → `user_lesson_progress.opened_at` updates (check via service-key curl). Mark complete → bot shows ✅ for that lesson. Mark complete in the bot → cabinet shows ✅ after reload.
- Visit `/cabinet/course/?slug=astro-z-0` (not owned) → locked outline, no lesson text loads, `/cabinet/lesson/?id=<astro-z-0 lesson>` redirects back.
- Mobile 390 px: chips wrap, lesson text readable, buttons full-width.
- `npm run build` clean; no `window` access at build time (everything inside `client:only` islands).

**Done when:** all of the above and the numbers match the bot for the two owned courses.

---

## 6. Phase 3 — Payment → cabinet access (1–2 days)

Goal: a buyer coming from Mono can activate the purchase in the cabinet without Telegram chat; cabinet upsell purchases land automatically.

### Step 3.1 — edge function `supabase/functions/claim-order/index.ts`

`config.toml`: `[functions.claim-order] verify_jwt = false` (decision #11 — the session is verified inside). Inside: `const { data: { user } } = await supabaseAdmin.auth.getUser(jwtFromAuthorizationHeader)`; `telegram_id = Number(user.app_metadata.telegram_id)`; 401 if missing.

Contract:
```
POST /functions/v1/claim-order   Authorization: Bearer <session access_token>
body: { order_id: string }
200 { status: 'granted', course_slug, course_title }   // access exists now (idempotent)
200 { status: 'pending' }                                // payment not confirmed yet → client polls
200 { status: 'failed' }                                 // failed / expired / refunded
403 { status: 'claimed_by_other' }
404 { error: 'not_found' }
```
Logic (port of `handleOrderIdDeeplink`): load payment by `order_id`; map status; if paid and `telegram_user_id IS NULL` → conditional `UPDATE payments SET telegram_user_id=:me WHERE order_id=:id AND telegram_user_id IS NULL` (0 rows → `claimed_by_other`); if paid and `telegram_user_id = me` → continue; else 403. Then `upsert user_courses { user_id, course_id, payment_id: order_id, amount_paid: amount*100 }` (`onConflict: 'user_id,course_id', ignoreDuplicates: true`) and return `granted`. Log `[claim-order] …` one line.

### Step 3.2 — success page `web/src/pages/payment/success.astro`
- Second CTA, equal weight, placed **above** the Telegram one: "Відкрити кабінет на сайті" → `/cabinet/?claim=<order_id>&product=<slug>`. Steps block becomes "Оберіть, де навчатись: у кабінеті на сайті або в Telegram-боті — прогрес спільний".
- Keep the purchase analytics exactly as is.

### Step 3.3 — cabinet claim flow (`CabinetHome.tsx`)
- If `?claim=` present: if not logged in, show the login card with the hint "Увійдіть через Telegram, щоб активувати замовлення №…". After login (or immediately if logged in) call `claim-order`; show a status card: `pending` → "Перевіряємо оплату…" and retry every 5 s for up to 3 min (then "Оплата ще обробляється — відкрийте кабінет через хвилину або напишіть на {email}"); `granted` → toast "Курс «…» додано" and reload courses; `claimed_by_other` / `failed` → copy from bot `purchase.alreadyClaimed` / `purchase.failed`. Strip `claim` from the URL with `history.replaceState` after a terminal state.

### Step 3.4 — buying from the cabinet
- Upsell "Купити" calls `create-payment` with `{ provider:'monobank', product_slug, source:'web', telegram_user_id }` (the logged-in id). Because `telegram_user_id` is set, `mono-callback`/`reconcile-payments` grant access directly and the Telegram confirmation message goes out. The Mono redirect returns to `/payment/success/…`; the cabinet CTA there → `claim-order` returns `granted` (already the user's). Reuse `trackCheckout` from `payment.ts` (export it) for `begin_checkout`.
- Optional: extend the `mono-callback` Telegram message with "або відкрийте кабінет: https://www.li-astrology.com.ua/cabinet/".

### Step 3.5 — go live
- Add the header/footer "Кабінет" links (Step 2.5).
- `supabase secrets unset TG_AUTH_DEV_SECRET` if it was ever set.
- Update `docs/STATUS.md` (cabinet section + Fly.io), `docs/SECURITY.md` (auth model, new functions), `supabase/README.md` (new functions + migrations list), and `CABINET_SPEC.md` status line.

### Step 3.6 — verify
1. Real 1 UAH test is not possible (prices fixed) → use an existing `paid` web order whose `telegram_user_id` is NULL if any (`payments` via service key), or temporarily set one to NULL for your own account, claim it, confirm `user_courses` row + cabinet card.
2. Claim the same order from a second Telegram account → 403 `claimed_by_other`.
3. Pending order (create one via a buy click, don't pay) → `pending`, polling visible, stops after 3 min.
4. Buy from the cabinet upsell while logged in → after paying, the Telegram confirmation arrives AND the cabinet shows the course without any claim step.

**Done when:** 1–4 pass and the header link is live.

---

## 6b. Phase 3B — Email login + web-first purchase flow (re-planned 2026-09-14, not built)

**Target flow (user, 2026-09-14):** the main entry point is the website: a visitor registers/pays on the
site, then sees the paid course in the cabinet. Telegram is a second channel where the same person can see
all their courses. Telegram must not be required to buy or to learn.

### What this changes vs. the first draft of this section

1. **Checkout collects an email (required).** Today the marketing buy buttons send no identity at all, so
   a web purchase is anonymous until someone claims it with the order id. With the email stored on the
   payment, access can be granted to the buyer's email identity automatically.
2. **Access is granted by verified email, not by order id + merge.** The first draft let a Telegram user
   absorb an email learner by presenting the order id. That is an account-takeover vector (type someone
   else's email at checkout, then merge their whole account). Merging accounts is now only ever explicit
   (Settings → connect) and only by someone logged in to **both** identities.
3. **The bot never merges.** `/start <order_id>` keeps its current rule (claim only if unclaimed). If the
   order already belongs to an email learner it points to the cabinet settings instead of "already claimed".
4. **Media is the real blocker for email-only learners.** 0 of the 115 lesson files are hosted anywhere but
   Telegram (verified 2026-09-14). An email-only buyer today would get lesson text and "available in the
   Telegram bot" cards — i.e. no videos, no PDFs. See D4.

### Facts this design is based on (verified 2026-09-14)

- Supabase Auth has **no custom SMTP** (`smtp_host` null); the built-in mailer only reaches project team
  addresses at 2 emails/hour → **real customers cannot receive codes until custom SMTP is configured.**
- The magic-link template has no `{{ .Token }}` (sends a link, not a code); `mailer_otp_length` is 8.
- Domain DNS is at **uadns.com** (`ns10–12.uadns.com`); no MX/SPF/DKIM/DMARC records exist.
- `payments.customer_email` already exists and `create-payment` already stores it when sent.
- `mono-callback` / `reconcile-payments` grant `user_courses` only when `payments.telegram_user_id` is set.
- Only one auth user exists (the owner). Identity model can still change cheaply.
- Everything is keyed by `bot_users.id` (Telegram id): `user_courses`, `user_lesson_progress`,
  `payments.telegram_user_id`, `reminders`, `bot_waitlist` (FKs to `bot_users`).

### Decisions (user)

| # | Question | Options | Recommendation |
|---|---|---|---|
| D1 | Email provider for SMTP | **Resend** (free 3,000/month) · Brevo (300/day) · Mailgun/SES | **Decided 2026-09-14: Resend.** Needs a sign-up + DNS records at uadns.com (SPF, DKIM, DMARC). Sender `no-reply@li-astrology.com.ua`. |
| D2 | How email accounts get created | **A** re-enable signups + Cloudflare Turnstile captcha, client calls `signInWithOtp` · **B** keep signups off, custom `email-otp-start` function pre-creates users | **Decided 2026-09-14: A.** Less code, native captcha + rate limits; RLS already gives an auth user nothing until `learner-bootstrap` links it. |
| D3 | Bot messages for website-only sign-ups | see §6c | **Decided 2026-09-14: no messages → §6c option A.** |
| D4 | Media before or after email login? **Decided 2026-09-14: email login first, then media (Phase 4); files exported with the owner's Telegram account.** | **A** Phase 4 first (needs files: originals from Anastasia, or MTProto export — needs the owner's Telegram `api_id`/`api_hash` + one login code) · **B** email login first, cabinet nudges «Підключіть Telegram, щоб отримати відео та матеріали» until Phase 4 ships | A if files can be obtained within ~1 week; otherwise B, but treat Phase 4 as the very next task. Email-only learners are not a real product until media is hosted. |

### Identity model

`bot_users` stays the single **learner** table. Email-only learners get a row with a **negative id** from a
sequence. All FKs, policies, functions and the bot keep working; no `account_id` columns anywhere.

- JWT claim `app_metadata.learner_id` (bigint): positive = Telegram id, negative = email-only learner.
  `tg-auth` sets both `telegram_id` and `learner_id` (same value).
- SQL `current_learner_id()` = `coalesce(learner_id, telegram_id)`; `current_telegram_id()` becomes a
  wrapper around it, so every 0004 policy keeps working unedited.
- Several auth users may map to one learner (a Telegram login and an email login of the same person).
  `bot_users.auth_uid` stays "the Telegram-login auth user" (used by `tg-auth`); email auth users are
  found by email. "Which auth users belong to learner X" = `auth.users.raw_app_meta_data->>'learner_id'`.
- `bot_users.email` for negative rows is the **verified** login email (set by `learner-bootstrap` only).
  For positive rows it stays whatever the bot collected (unverified) — never used for linking.
- Linking = `merge_learner(src, dst)` (below), called only from `link-telegram` after the caller proved both
  identities. Direction is always email learner (negative) → Telegram id (positive), because the bot needs
  the positive id.

### Main flow, end to end

```
[marketing page] «Купити» → email field (required, validated) → sessionStorage.set('checkout_email')
   → create-payment { product_slug, source:'web', customer_email }        (Mono receipt: optional customerEmails)
   → Mono → /payment/success/?order_id=…&product=…
[success page]  «Відкрити кабінет» → /cabinet/?claim=<order_id>            (unchanged)
[cabinet login card]  email pre-filled from sessionStorage → «Надіслати код» → 6-digit code → verifyOtp
   → learner-bootstrap:  find/create negative learner for the VERIFIED email
                         + claim every paid payment WHERE lower(customer_email)=email AND telegram_user_id IS NULL
                           → set payments.telegram_user_id = learner, upsert user_courses
                         + report payments for this email already owned by a positive id (linked_elsewhere)
   → refreshSession → «Мої курси» shows the course (claim-order for ?claim= still runs; returns granted)
[cabinet purchase while logged in] create-payment gets telegram_user_id = learner_id (negative ok)
   → mono-callback grants directly (Telegram notification skipped for negative ids)
[Telegram]  success page «Відкрити в Telegram» → bot /start <order_id>:
   • unclaimed → claims to the Telegram id (as today)
   • owned by a negative learner → «Це замовлення активовано в кабінеті на сайті за email. Щоб бачити
     курс і тут, підключіть Telegram: Кабінет → Налаштування → Підключити Telegram» (deep link to settings)
   • owned by another positive id → alreadyClaimed (as today)
[Settings → «Підключити Telegram»] widget → link-telegram → merge_learner(negative → tgId) → bot shows all courses
[Settings → «Додати вхід через email»] (Telegram learners) updateUser({ email }) + email_change code → both logins work
```

Why claim by verified email rather than auto-granting in the webhook: the webhook cannot verify the address,
and the success page already brings the buyer straight into the email login. A "your access is ready" email
from the webhook (Resend API) is a nice-to-have, listed in 3B.9.

### Step 3B.1 — prerequisites (user)
- [ ] D1: create the provider account, add its DNS records at uadns.com, wait for "verified".
- [ ] Supabase → Authentication → SMTP Settings: host/port/user/password, sender
      `no-reply@li-astrology.com.ua`, name `Li Astrology` (or Management API `PATCH /config/auth` `smtp_*`;
      never commit the password).
- [ ] D2=A: Cloudflare Turnstile site key for `www.li-astrology.com.ua`; secret into Supabase Auth →
      Attack Protection (`security_captcha_provider=turnstile`).
- [ ] D4 answered.

### Step 3B.2 — auth config (Management API, §2)
```json
{ "disable_signup": false, "mailer_otp_length": 6, "mailer_otp_exp": 900,
  "rate_limit_email_sent": 30, "security_captcha_enabled": true, "security_captcha_provider": "turnstile",
  "mailer_secure_email_change_enabled": false,
  "mailer_subjects_magic_link": "Код входу до кабінету Li Astrology",
  "mailer_templates_magic_link_content": "<h2>Ваш код входу</h2><p style=\"font-size:28px;letter-spacing:6px\"><b>{{ .Token }}</b></p><p>Код діє 15 хвилин. Якщо ви не запитували вхід — просто ігноруйте цей лист.</p>",
  "mailer_subjects_email_change": "Підтвердження email для кабінету Li Astrology",
  "mailer_templates_email_change_content": "<h2>Код підтвердження</h2><p style=\"font-size:28px;letter-spacing:6px\"><b>{{ .Token }}</b></p>",
  "site_url": "https://www.li-astrology.com.ua" }
```
`mailer_secure_email_change_enabled=false` because Telegram users' current email is the synthetic
`tg-<id>@users.li-astrology.com.ua`, which cannot receive mail.

### Step 3B.3 — migration `0005_learner_identity.sql`
```sql
BEGIN;
CREATE SEQUENCE IF NOT EXISTS email_learner_id_seq START -1 INCREMENT -1 MAXVALUE -1;

CREATE OR REPLACE FUNCTION public.current_learner_id() RETURNS BIGINT
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT NULLIF(coalesce(auth.jwt() -> 'app_metadata' ->> 'learner_id',
                         auth.jwt() -> 'app_metadata' ->> 'telegram_id'), '')::bigint
$$;
CREATE OR REPLACE FUNCTION public.current_telegram_id() RETURNS BIGINT
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT public.current_learner_id() $$;
REVOKE ALL ON FUNCTION public.current_learner_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_learner_id() TO authenticated, service_role;

ALTER TABLE bot_users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS bot_users_email_learner_uniq ON bot_users (lower(email)) WHERE id < 0;
GRANT UPDATE (first_name) ON bot_users TO authenticated;   -- email learners type their name once (3B.7)

-- service_role only: create (or return) the email learner for a VERIFIED address.
CREATE OR REPLACE FUNCTION public.ensure_email_learner(p_email TEXT) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id BIGINT;
BEGIN
  SELECT id INTO v_id FROM bot_users WHERE id < 0 AND lower(email) = lower(p_email);
  IF v_id IS NULL THEN
    INSERT INTO bot_users (id, email, email_verified_at, lang, blocked_bot, last_active)
    VALUES (nextval('email_learner_id_seq'), lower(p_email), now(), 'uk', true, now())
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END $$;

-- service_role only: attach every unclaimed paid payment for this verified email to the learner.
CREATE OR REPLACE FUNCTION public.claim_payments_by_email(p_learner BIGINT, p_email TEXT)
RETURNS TABLE (order_id TEXT, course_slug TEXT) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    UPDATE payments p SET telegram_user_id = p_learner
    WHERE p.status = 'paid' AND p.telegram_user_id IS NULL AND lower(p.customer_email) = lower(p_email)
    RETURNING p.order_id, p.course_slug, p.amount
  ), granted AS (
    INSERT INTO user_courses (user_id, course_id, payment_id, amount_paid)
    SELECT p_learner, c.id, cl.order_id, cl.amount * 100 FROM claimed cl JOIN courses c ON c.slug = cl.course_slug
    ON CONFLICT (user_id, course_id) DO NOTHING
  )
  SELECT cl.order_id, cl.course_slug FROM claimed cl;
END $$;

-- service_role only: move everything from learner src (negative) to dst (Telegram id), then delete src.
CREATE OR REPLACE FUNCTION public.merge_learner(src BIGINT, dst BIGINT) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF src = dst OR src >= 0 OR dst <= 0 THEN RAISE EXCEPTION 'merge_learner: src must be negative, dst positive'; END IF;
  INSERT INTO user_courses (user_id, course_id, purchased_at, expires_at, payment_id, amount_paid)
    SELECT dst, course_id, purchased_at, expires_at, payment_id, amount_paid FROM user_courses WHERE user_id = src
  ON CONFLICT (user_id, course_id) DO UPDATE SET
    expires_at = CASE WHEN user_courses.expires_at IS NULL OR EXCLUDED.expires_at IS NULL THEN NULL
                      ELSE greatest(user_courses.expires_at, EXCLUDED.expires_at) END;
  DELETE FROM user_courses WHERE user_id = src;
  INSERT INTO user_lesson_progress (user_id, lesson_id, completed, opened_at, completed_at)
    SELECT dst, lesson_id, completed, opened_at, completed_at FROM user_lesson_progress WHERE user_id = src
  ON CONFLICT (user_id, lesson_id) DO UPDATE SET
    completed    = user_lesson_progress.completed OR EXCLUDED.completed,
    opened_at    = greatest(user_lesson_progress.opened_at, EXCLUDED.opened_at),
    completed_at = least(user_lesson_progress.completed_at, EXCLUDED.completed_at);
  DELETE FROM user_lesson_progress WHERE user_id = src;
  UPDATE payments SET telegram_user_id = dst WHERE telegram_user_id = src;
  DELETE FROM reminders WHERE user_id = src;
  UPDATE bot_users d SET email = coalesce(s.email, d.email), email_verified_at = coalesce(d.email_verified_at, s.email_verified_at)
    FROM bot_users s WHERE d.id = dst AND s.id = src;
  -- every auth user that logged in as the email learner now resolves to the Telegram learner
  UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('learner_id', dst)
    WHERE (raw_app_meta_data ->> 'learner_id')::bigint = src;
  DELETE FROM bot_users WHERE id = src;
END $$;

REVOKE ALL ON FUNCTION public.ensure_email_learner(TEXT)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_payments_by_email(BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.merge_learner(BIGINT, BIGINT)         FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_email_learner(TEXT)            TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_payments_by_email(BIGINT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.merge_learner(BIGINT, BIGINT)         TO service_role;
COMMIT;
```
Notes: `payments.telegram_user_id` will hold negative ids for email learners — keep the column name, document it
in `docs/STATUS.md`. If updating `auth.users` from SQL is refused on this project, do that one step from
`link-telegram` via `auth.admin.updateUserById` instead. A JWT issued before a merge carries the old
`learner_id` until its next refresh (≤ 1 h, `jwt_exp=3600`); `link-telegram`'s caller refreshes immediately,
other open sessions of the same person may see an empty cabinet for up to an hour — acceptable.

### Step 3B.4 — guard every Telegram send against negative ids (before any email learner exists)
- `bot/src/jobs/send-reminders.ts`: `if (!reminder.user_id || reminder.user_id <= 0) { markReminderFailed; continue; }`.
- `mono-callback`, `reconcile-payments`, `wfp-callback`: `notifyTelegram` only when `telegram_user_id > 0`.
  While there, move the "grant + notify" block into `supabase/functions/_shared/grant.ts` and use it from all
  three plus `claim-order` (today it is copy-pasted).
- Bot jobs and admin broadcasts selecting from `bot_users` (`jobs/nurture.ts`, `jobs/inactivity.ts`,
  `jobs/completion-nurture.ts`, `admin/commands.ts` ×3): `.gt('id', 0)` (the §6c filter implies it).
- `web/src/components/cabinet/MediaBlock.tsx`: for `learnerId < 0` replace «Відкрити в боті» with
  «Підключіть Telegram у налаштуваннях, щоб отримати файли» → `/cabinet/settings/` (until Phase 4).

### Step 3B.5 — checkout collects the email
- `web/src/scripts/payment.ts` + `PaymentButton.astro`: clicking a buy button opens a small inline form
  (email input, «Перейти до оплати»); validate `^[^@\s]+@[^@\s]+\.[^@\s]+$`; `sessionStorage.setItem('checkout_email', email)`;
  `createInvoice({ slug, provider, customerEmail })`. Keyboard/mobile friendly; the existing toast for errors.
- `web/src/lib/checkout.ts`: `customerEmail` → `customer_email` in the body.
- `create-payment`: no change needed (`customer_email` stored). Optional: pass it to Mono as
  `merchantPaymInfo.customerEmails: [email]` for the receipt — verify the field in Mono's docs first.
- Cabinet purchases (already logged in) keep sending `telegram_user_id = learnerId` and no email form.

### Step 3B.6 — edge function `learner-bootstrap` (session verified inside, `verify_jwt=false` like claim-order)
```
POST /functions/v1/learner-bootstrap   Authorization: Bearer <session>
200 { learner_id, created: boolean, claimed: [{ order_id, course_slug }], linked_elsewhere: boolean }
401 unauthorized   403 { error: 'email_not_confirmed' | 'synthetic_email' }
```
1. `auth.getUser(jwt)`. If `app_metadata.learner_id` (or `telegram_id`) exists → skip to 4 with that id.
2. Require `user.email_confirmed_at`; reject `@users.li-astrology.com.ua`.
3. `rpc('ensure_email_learner', { p_email })` → `admin.updateUserById(uid, { app_metadata: { learner_id } })`.
4. `rpc('claim_payments_by_email', { p_learner, p_email })` → `claimed`. Then `linked_elsewhere` = exists
   paid payment with this email whose `telegram_user_id > 0` and ≠ learner (only meaningful for negative learners).
5. Log one line; never log the email in full.
Client: after `verifyOtp` call this, then `supabase.auth.refreshSession()` so the claim is in the JWT.

### Step 3B.7 — web changes
- `web/src/lib/auth.ts`: `getTelegramId` → `getLearnerId` (reads `learner_id ?? telegram_id`);
  `startEmailLogin(email, captchaToken)` = `signInWithOtp({ email, options: { shouldCreateUser: true, captchaToken } })`;
  `verifyEmailCode(email, code)` = `verifyOtp({ email, token: code, type: 'email' })` → `learner-bootstrap` → `refreshSession`.
- `TelegramLogin.tsx` → `LoginCard.tsx`: **email first** (main entry point), pre-filled from
  `sessionStorage.checkout_email`, Turnstile widget (`https://challenges.cloudflare.com/turnstile/v0/api.js`),
  code step (6 digits, resend after 60 s), then a divider «або» and the Telegram widget below.
- First login of a new email learner: one optional field «Як до вас звертатися?» → `bot_users.first_name`
  (RLS: own row; grant added in 3B.3). Used for the greeting and later certificates.
- `CabinetHome.tsx`: if bootstrap returned `linked_elsewhere` → notice «Ваші покупки за цим email активовані в
  Telegram. Підключіть Telegram у налаштуваннях, щоб бачити їх тут» → settings.
- `SettingsView.tsx`: «Способи входу» block — Telegram (linked / «Підключити Telegram» widget → `link-telegram`)
  and email (address / «Додати вхід через email» → `updateUser({ email })` + code → `verifyOtp({ type: 'email_change' })`).
  Hide «Мова бота» for learners with `learnerId < 0`. If Supabase answers "email already registered" on
  add-email: «Цей email вже має акаунт. Увійдіть за email і підключіть Telegram у налаштуваннях».
- `claim-order`: read `learner_id ?? telegram_id`; rest unchanged (negative ids are valid FKs).
- Strings in `cabinet-strings.ts` (`login.email*`, `settings.logins*`, `claim.linkedElsewhere`).

### Step 3B.8 — edge function `link-telegram` + bot + tg-auth
- `link-telegram` (session + Telegram widget payload): verify the hash exactly like `tg-auth`; require the
  caller's `learner_id < 0`; upsert `bot_users` for the Telegram id (as `tg-auth` does, `started_bot_at` untouched);
  `rpc('merge_learner', { src: callerLearner, dst: telegramId })`; return `{ learner_id: telegramId }`; client refreshes.
- Bot `handlers/start.ts` `handleOrderIdDeeplink`: when `payment.telegram_user_id < 0` → new locale string
  `purchase.claimedOnSite` with an inline URL button to `https://www.li-astrology.com.ua/cabinet/settings/`.
  No merge in the bot, ever.
- `tg-auth`: (a) set `app_metadata.learner_id` alongside `telegram_id`; (b) `ensureAuthUser` must heal only
  `app_metadata`, never rewrite a real email back to the synthetic one (today it does).

### Step 3B.9 — optional polish
- Webhook email «Доступ відкрито — увійдіть за цим email» via the provider's HTTP API (one more secret).
- Mono receipt email (3B.5).

### Step 3B.10 — tests (`tools/cabinet-tests/email_learner_test.py`)
Disposable address `cabinet-test+<ts>@li-astrology.com.ua`; get a session with
`auth.admin.generateLink({ type: 'magiclink' })` + `verify` (no mail sent; the address is confirmed by admin
creation with `email_confirm: true`). Then: bootstrap creates a negative learner · RLS shows no courses ·
synthetic paid payment with that `customer_email` → bootstrap again → `claimed` contains it and the course is
visible · progress write works · `claim-order` with the same order → granted · a second disposable learner +
`merge_learner` between the two (never into the owner) moves courses/progress and updates `auth.users`
app_metadata · negative-id send guard: insert a `reminders` row for the negative learner, run
`processReminders` logic path (unit) → marked failed, no Telegram call · bot `/start` with a payment owned by
a negative id → `claimedOnSite` branch (unit) · cleanup: auth users, negative `bot_users`, synthetic payments.
One manual check: a real code arrives in a real inbox; one real purchase from a marketing page with an email.

**Effort:** ~2–2.5 days after D1/D2 (3B.5 checkout form and the bot branch add ~half a day vs. the first draft).

---

## 6c. Phase 3C — Bot messages for website sign-ups (**built + live 2026-09-14**, option A)

**Current behaviour:** `tg-auth` creates a `bot_users` row for anyone who logs in on the site, and the widget
asks for permission to message them (`data-request-access="write"`). `fetchColdUsers` in
`bot/src/jobs/nurture.ts` selects every non-blocked `bot_users` row created in the last 30 days with no
purchase, so a website-only visitor receives the cold Intensiv sequence from the bot. Because steps are
queued when `ageDays ≥ step.day`, someone who logged in on the site 10 days before first opening the bot
would get days 1, 3 and 7 at once.

| Option | Behaviour | Change |
|---|---|---|
| **A (recommended)** | Only people who actually started the bot get bot nurture and inactivity messages. Website-only sign-ups get nothing automatic (a site/email sequence can come later). | New column `bot_users.started_bot_at`; bot sets it on first update; all bot audience queries filter on it; cold anchor = `started_bot_at`. |
| B | Keep: anyone who allowed messages via the widget gets cold nurture. | Only fix the anchor so steps don't pile up, and add the §3B.4 negative-id guard. |
| C | Like A, plus one welcome message from the bot right after the first website login («Ви увійшли в кабінет… тут бот з тими ж курсами»). | A + `tg-auth` inserts one `reminders` row `type='web_welcome'` for new rows only. |

### Steps for option A
1. Migration `0006_started_bot.sql`:
   ```sql
   ALTER TABLE bot_users ADD COLUMN IF NOT EXISTS started_bot_at TIMESTAMPTZ;
   -- every existing positive row was created by the bot (tg-auth rows so far = owner, who also uses the bot)
   UPDATE bot_users SET started_bot_at = created_at WHERE id > 0 AND started_bot_at IS NULL;
   CREATE INDEX IF NOT EXISTS idx_bot_users_started ON bot_users(started_bot_at) WHERE started_bot_at IS NOT NULL;
   ```
2. `tg-auth`: insert new rows with `started_bot_at: null` using `upsert(..., { ignoreDuplicates: true })`, then a
   separate `update` of `first_name/last_name/username/last_active` (never touches `started_bot_at`).
3. Bot `middleware/auth.ts`: after `upsertUser`, if `!ctx.session.startedBotMarked` run
   `update bot_users set started_bot_at = now() where id = :id and started_bot_at is null`, then set the session
   flag (add `startedBotMarked?: boolean` to the session type in `bot/src/bot.ts`).
4. Audience filters `.not('started_bot_at', 'is', null)` in `jobs/nurture.ts` (both sequences),
   `jobs/inactivity.ts`, `jobs/completion-nurture.ts`, and the broadcast queries in `admin/commands.ts`.
   Cold sequence: `.gte('started_bot_at', cutoff)` and `anchor: new Date(u.started_bot_at)`.
5. Deploy order: migration → bot (`fly deploy`) → `tg-auth`. Verify: log in on the site with a Telegram account
   that never opened the bot → row has `started_bot_at` null → after the next nurture tick no `reminders` rows
   for it; then press Start in the bot → `started_bot_at` set → day-1 cold message arrives the next day, not at once.

**Effort:** ~2–3 hours.

---

## 7. Phase 4 — Media hosting (after Phase 3B; export method decided 2026-09-14)

### Source of the files (verified 2026-09-14)

Every lesson file lives in one of four **private course channels**. The lessons were imported from Telegram
Desktop JSON exports of these channels (`bot/scripts/extract-file-ids.ts` + `import-structured.ts`, grouping in
`bot/course-structure/<slug>.json`). Those exports still exist on the owner's Mac in
`~/Downloads/Telegram Desktop/ChatExport_2026-04-13*`, but were made **without files** ("File not included").
They do carry each file's message id, name, size, mime type and duration, and the mapping to live lessons is exact:

| course slug | channel name | channel id | lessons | media messages in structure | live `lessons.media` items | total size |
|---|---|---|---|---|---|---|
| `aspekty-pro` | Аспекты // профессиональный | 3749232984 | 7 | 15 | 15 | 4.2 GB |
| `aspekty-basic` | Аспекты // базовый | 3735057617 | 4 | 4 | 4 | 0.7 GB |
| `intensiv` | Intensive // | 3122135614 | 11 | 26 | 26 | 6.8 GB |
| `astro-z-0` | Астрология с 0 // курс | 3703088871 | 26 | 70 | 70 | 15.2 GB |

Total ≈ 27 GB before de-duplication. `astro-z-0` repeats the Intensiv lessons, so many files are the same
recording in two channels — dedupe by `file_name` + `file_size` + `duration_seconds` before uploading.
Largest single file seen ≈ 506 MB. The Bot API cannot download files over 20 MB, so a **user-account (MTProto)**
client is required.

### Step 4.1 — owner prerequisites (manual, ~5 minutes)
- [ ] https://my.telegram.org → API development tools → create an app → note `api_id` and `api_hash`.
      Put them in `tools/media-migrate/.env` (`TG_API_ID`, `TG_API_HASH`) — gitignored, never in chat.
- [ ] Be a member of the four channels above with the account used for login (the owner already exported them).
- [ ] Bunny Stream: create account + EU library, enable token authentication, allowed referrer
      `www.li-astrology.com.ua`; put `BUNNY_LIBRARY_ID`, `BUNNY_API_KEY`, `BUNNY_TOKEN_KEY` into the same `.env`
      and into `supabase secrets`.

### Step 4.2 — login (one time)
`tools/media-migrate/login.mjs` using GramJS (`telegram` npm package). Non-interactive two-step so it works
through Claude Code's `!` prefix:
```
! node tools/media-migrate/login.mjs --phone +380XXXXXXXXX     # Telegram sends a login code
! node tools/media-migrate/login.mjs --code 12345 [--password <2FA password if set>]
```
Writes `tools/media-migrate/.session` (StringSession, file mode 600, gitignored). **The session grants full
access to the Telegram account**: never commit or print it; delete the file after the migration and terminate
the session in Telegram → Settings → Devices.

### Step 4.3 — inventory + download (`tools/media-migrate/download.mjs`)
1. For each course: read `bot/course-structure/<slug>.json` and the channel `result.json` → ordered list of
   `(lesson position, media index, channel id, message id, type, file_name, size, duration)`. Cross-check the
   order against `lessons.media` (same count per lesson, same type per index) and abort on any mismatch.
2. Dedupe identical recordings across channels (name + size + duration).
3. `client.getMessages(channel, { ids })` → `client.downloadMedia(msg, { outputFile, progressCallback })` into
   `~/course-media/<slug>/<position>-<index>-<file_name>`. Resumable: skip files whose size already matches;
   `.part` files for in-progress downloads. Respect FloodWait errors (sleep the requested seconds).
   Non-Premium accounts get throttled download speed — expect several hours for ~20 GB; run in the background.
4. Write `~/course-media/manifest.json` with sha256 per file.

### Step 4.4 — upload + write hosted ids (`tools/media-migrate/upload.mjs`)
- Videos → Bunny Stream: create video in a collection per course, `PUT` the file, poll until `status = 4 (finished)`.
- Audio + documents → Supabase Storage private bucket `course-media`, path `<slug>/<position>-<index>-<safe name>`.
- Patch only the addressed `lessons.media[index]` object with `bunny_video_id` or `storage_path`, plus `title`
  (from `file_name`), `size_bytes`, `duration_s`. Idempotent: skip items that already have a hosted field.
  `file_id` stays, so the bot keeps working unchanged.

### Step 4.5 — delivery
- Edge function `media-url` (session verified inside): body `{ lesson_id, index }` → owns the course?
  → Bunny signed embed URL (`token = sha256_hex(token_key + video_id + expires)`, 1 h) or Storage signed URL (1 h).
- `MediaBlock.tsx`: `bunny` → 16:9 iframe player; `file` audio → `<audio controls preload="none">`;
  document → «Завантажити». Remove the "connect Telegram" nudge for hosted items.

### Step 4.6 — verify
Every one of the 115 items plays/downloads in the cabinet for an owner of the course; the bot still sends all of
them; an unowned learner gets 403 from `media-url`; an expired Bunny URL stops working.

## 8. Phase 5 — Later (unchanged priorities from spec §7)

1. Natal chart calculator (lead magnet + practice tool).
2. Certificate of completion via `materials/` PDF pipeline at 100 %.
3. Styled PDF downloads; 4. homework/questions → bot admin; 5. bot ↔ cabinet nurture deep links (`lesson_<id>` payload from Step 2.4); 6. notes/bookmarks; 7. promo-code field on cabinet buy; 8. email-OTP accounts (spec §8 — now simpler: the `auth.users` row already exists, only an `accounts`/linking model is needed).

---

## 9. Open questions (need the user)

1. **Originals for the 52 videos** exist? (Plan A vs B for Phase 4.)
2. Bunny vs Vimeo — Bunny assumed; only revisit if token auth wiring stalls.
3. Should the cabinet show `astro-z-0-pro` (not in DB) as "coming soon"? Default: no, only DB courses.
4. Keep the Telegram claim path forever, or make the cabinet the primary CTA on the success page? Default: both, cabinet first.

---

## 10. Checklist

**Phase 0 — RLS lockdown**
- [x] 0.1 migration `0003_rls_lockdown.sql` applied
- [x] 0.2 anon read/write verified blocked; service role reads/writes all tables; reconcile-payments 200 (Fly logs not checked — CLI not logged in)
- [x] 0.3 SECURITY.md / TODO.md updated

**Phase 1 — Auth**
- [x] Manual: BotFather `/setdomain` = www.li-astrology.com.ua
- [x] `disable_signup` ON (set in dashboard by the user)
- [x] 1.1 migration `0004_cabinet_auth.sql` applied (+ last_active trigger)
- [x] 1.2 `tg-auth` deployed (`--no-verify-jwt --use-api`), config.toml entry
- [x] 1.3 supabase-js + `lib/supabase.ts`, `lib/auth.ts`, `TelegramLogin.tsx`, `CabinetLayout.astro`, `/cabinet/` page
- [ ] 1.4 server-side 26/26 pass (`tools/cabinet-tests/rls_auth_test.py`); **real widget login on www pending** BotFather /setdomain + merge
- [x] `TG_AUTH_DEV_SECRET` never implemented

**Phase 2 — Cabinet UI**
- [x] 2.1 `cabinet-api.ts` + types
- [x] 2.2 `/cabinet/`, `/cabinet/course/`, `/cabinet/lesson/`, `/cabinet/settings/`
- [x] 2.3 `tg-html.ts`
- [x] 2.4 `MediaBlock.tsx` placeholders; bot `lesson_<id>` deep link (code done — **needs `fly deploy`**)
- [ ] 2.5 (opt) extras to DB
- [x] 2.6 progress numbers match the bot (3/11 intensiv for owner, UI + DB); mark-complete writes the shared row

**Phase 3 — Payment → cabinet**
- [x] 3.1 `claim-order` deployed (`verify_jwt = false`, session verified inside)
- [x] 3.2 success page CTA
- [x] 3.3 claim flow + polling
- [x] 3.4 cabinet buy with `telegram_user_id` (home cards + locked course page)
- [x] 3.5 header/footer links (on branch), docs updated
- [ ] 3.6 API 14/14 pass with synthetic payment rows (`claim_order_test.py`); **real purchase on www pending** merge

**Phase 3B — Email login + web-first purchase** (§6b, needs D1/D2/D4)
- [ ] D1 = Resend (decided); DNS verified, Supabase SMTP configured
- [ ] D2 = A (decided); Turnstile keys · D4 media order decided
- [ ] 3B.2 auth config · 3B.3 migration 0005 · 3B.4 negative-id send guards + shared grant helper
- [ ] 3B.5 checkout email form · 3B.6 learner-bootstrap · 3B.7 web (login card, settings, claim-order)
- [ ] 3B.8 link-telegram + bot `claimedOnSite` branch + tg-auth heal fix
- [ ] 3B.10 tests + real inbox + one real purchase

**Phase 3C — Bot messages for web sign-ups** (§6c, needs D3)
- [x] D3 = option A · migration 0006 applied · tg-auth insert-only deployed · bot `startedBotMarked` flag + `markStartedBot` · filters in nurture (both), inactivity, completion-nurture, admin stats/broadcast · negative-id guard in send-reminders · bot release v4 · tests: `bot_audience_test.ts` 5/5, website-only login keeps `started_bot_at` NULL

**Phase 4 — Media** (prep items in §7)

---

## 11. Log

- 2026-09-14 — Phase 3C built + live (migration 0006, tg-auth v-insert-only, bot release v4, tests pass). D1 Resend, D2 signups+Turnstile, D3 no bot messages for web-only, D4 login first then media. Phase 4 export mapping verified: 4 course channels, 115 media messages = 115 lesson media items, ≈27 GB; export via owner's account with GramJS.
- 2026-09-14 — §6b re-planned for the web-first flow (register/pay on the site → course in cabinet; Telegram second). Checkout now collects email; access is claimed by verified email; no merge-by-order_id (takeover vector); bot never merges; D4 added because 0/115 media items are hosted.
- 2026-09-14 — Bot deployed to Fly (release v3, health OK, polling OK) with `/start lesson_<id>`. Planned Phase 3B (email login via negative-id learners in `bot_users`, no accounts table) and Phase 3C (bot messaging for web sign-ups); both wait on user decisions D1–D3.
- 2026-09-14 — `/setdomain` done; `feat/cabinet` fast-forwarded to `main` (`8f68ac8`) and live on www (all cabinet routes 200, header link, success CTA). Pending: `fly deploy` (Fly CLI not logged in), first real widget login + purchase.
- 2026-09-14 — Test side effect found and reverted: an early `claim_order_test.py` reused the owner's paid April `web-aspekty-pro` order and re-granted aspekty-pro (row deleted; no payment rows changed). Test now only reuses orders for courses already owned. **Note:** like the bot's `/start <order_id>`, `claim-order` re-grants any `paid` order bound to the caller — to revoke access, set the payment to `refunded` as well as deleting `user_courses`.
- 2026-09-14 — **Phases 0–3 implemented** (branch `feat/cabinet`). Live: 0003 RLS lockdown, 0004 cabinet auth, `tg-auth`, `claim-order`, `TELEGRAM_BOT_TOKEN` secret fixed. Tests: RLS/auth 26/26, claim-order 14/14, headless UI suite all OK (desktop + 390 px, no console errors). Found + fixed stale bot-token secret. Go-live blockers: BotFather /setdomain, merge to main, `fly deploy` for lesson deep link.
- 2026-09-14 — Confirmed Management API access via CLI token (SQL + auth config); signup toggle made optional by RLS guard.
- 2026-09-14 — Plan written from live DB/code audit. Found anon-key full access (Phase 0). Auth approach switched to real Supabase Auth sessions (ES256 signing keys in use).
