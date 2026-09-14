# Cabinet — Implementation Plan (step-by-step, for execution sessions)

> Written 2026-09-14 against the **live** DB, edge functions, bot and web code.
> Companion to `CABINET_SPEC.md` (the design). Where this file and the spec disagree,
> **this file wins** — §1 lists every deliberate change and why.
>
> **How to use this file:** work top to bottom, one phase per PR/session. Every step has
> files to touch, the exact contract, and a "Verify" block. After each step, tick the
> checkbox in §10 and add one line to the log in §11. Do not skip Phase 0.
>
> **Status 2026-09-14:** Phases 0–3 implemented on branch `feat/cabinet`. Backend (migrations
> 0003/0004, edge functions `tg-auth` + `claim-order`, secret fix) is **live**; the website part
> goes live when the branch is merged to `main`. Remaining go-live steps are in §10. Regression
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

## 7. Phase 4 — Media hosting (blocked on files; do prep now)

Prep that can happen any time (no files needed):
- [ ] Create Bunny Stream library (EU), enable **token authentication** + allowed referrer `www.li-astrology.com.ua`; note `library_id`, `API key`, `token auth key` → `supabase secrets set BUNNY_LIBRARY_ID=… BUNNY_API_KEY=… BUNNY_TOKEN_KEY=…`.
- [ ] Supabase Storage: private bucket `course-media` (no public access). Path convention `course-media/<course_slug>/<lesson_position>-<index>-<slug>.<ext>`.
- [ ] Edge function `media-url` (`verify_jwt = true`): body `{ lesson_id, index }` → resolve telegram_id from JWT (as in claim-order) → service-key query `lessons` + `owns_course` logic → item = `media[index]` → if `bunny_video_id`: return `{ kind:'bunny', url: https://iframe.mediadelivery.net/embed/<lib>/<video>?token=<sha256hex(token_key + video_id + expires)>&expires=<unix+3600> }`; if `storage_path`: `storage.from('course-media').createSignedUrl(path, 3600)` → `{ kind:'file', url }`; else 404 `{ error:'not_hosted' }`. Log nothing sensitive.
- [ ] `MediaBlock.tsx`: call `media-url` lazily (on card mount) for hosted items; Bunny → `<iframe allowfullscreen>` 16:9; audio → `<audio controls preload="none">`; document → "Завантажити" (`target=_blank`).
- [ ] `tools/media-migrate/` (Node + tsx, reuse `bot/` deps): (a) `inventory.ts` prints every `(course_slug, position, index, type)` needing a file; (b) `upload.ts <course_slug>` takes a local folder mapped by `<position>-<index>.*`, uploads videos to Bunny (create video → PUT upload), audio/docs to Storage, then patches **only** the addressed `media[index]` object with `bunny_video_id`/`storage_path`/`title`/`size_bytes` (idempotent — skips items already hosted). Never rewrite the array shape; the bot keeps reading `file_id`.

Getting the files (spec §5): Plan A — originals from Anastasia. Plan B — Telegram MTProto export (user session, e.g. GramJS in `tools/media-migrate/export-telegram.ts`) from the private media channel `MEDIA_CHANNEL_ID` (bot/.env) where every file_id originates; Bot API `getFile` is capped at 20 MB so it is not an option for videos.

Verify: every one of the 115 items renders in the cabinet AND still sends in the bot; spot-check that an unowned user gets 404 from `media-url`; confirm a Bunny URL stops working after expiry.

---

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
- [ ] Manual: BotFather `/setdomain` = www.li-astrology.com.ua
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

**Phase 4 — Media** (prep items in §7)

---

## 11. Log

- 2026-09-14 — Test side effect found and reverted: an early `claim_order_test.py` reused the owner's paid April `web-aspekty-pro` order and re-granted aspekty-pro (row deleted; no payment rows changed). Test now only reuses orders for courses already owned. **Note:** like the bot's `/start <order_id>`, `claim-order` re-grants any `paid` order bound to the caller — to revoke access, set the payment to `refunded` as well as deleting `user_courses`.
- 2026-09-14 — **Phases 0–3 implemented** (branch `feat/cabinet`). Live: 0003 RLS lockdown, 0004 cabinet auth, `tg-auth`, `claim-order`, `TELEGRAM_BOT_TOKEN` secret fixed. Tests: RLS/auth 26/26, claim-order 14/14, headless UI suite all OK (desktop + 390 px, no console errors). Found + fixed stale bot-token secret. Go-live blockers: BotFather /setdomain, merge to main, `fly deploy` for lesson deep link.
- 2026-09-14 — Confirmed Management API access via CLI token (SQL + auth config); signup toggle made optional by RLS guard.
- 2026-09-14 — Plan written from live DB/code audit. Found anon-key full access (Phase 0). Auth approach switched to real Supabase Auth sessions (ES256 signing keys in use).
