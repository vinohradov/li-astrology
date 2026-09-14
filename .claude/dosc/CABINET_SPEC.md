# Cabinet Spec: Personal Cabinet + Courses on li-astrology.com.ua

> **Status (2026-09-14): design spec. Execution plan with phases, contracts and verification is in
> `CABINET_IMPLEMENTATION_PLAN.md` — follow that file; its §1 lists where it deliberately deviates from
> this spec (real Supabase Auth sessions instead of self-signed JWTs, single `claim-order` function,
> RLS lockdown as Phase 0, React islands + static routes). Nothing implemented yet.**
>
> Goal: user accounts + personal cabinet + course consumption **on the main domain**
> (`https://www.li-astrology.com.ua`, apex 301→www), where **paying for a course grants
> access to the cabinet**. The Telegram bot stays as a parallel delivery channel — the
> cabinet and the bot share the same Supabase data (courses, lessons, access, progress).

---

## 1. Verified starting point (2026-07-07, checked against live DB + code)

What we already have that the cabinet reuses as-is:

| Asset | State |
|---|---|
| `courses` / `lessons` / `user_courses` / `user_lesson_progress` | Live in Supabase — already a complete LMS data model. 48 lessons, progress tracked per user per lesson by the bot. |
| Users | `bot_users` keyed by **Telegram ID (bigint)**; optional `email`, `phone`, `lang`. |
| Payments | Mono acquiring via `create-payment` edge function; `mono-callback` webhook + `reconcile-payments` safety net. |
| Site | Astro static on GitHub Pages, deployed from `web/` via `.github/workflows/deploy.yml`. |
| Promo codes | `promotions` table exists (UI currently removed from bot). |
| PDF pipeline | `materials/` design system — reusable for certificates + styled downloads. |

**Hard constraints discovered:**

1. **All 115 lesson media items are Telegram `file_id`s only** (52 video, 47 document,
   16 audio; zero external URLs, no size/duration metadata). A website cannot play
   Telegram file_ids → video/audio/PDF must be re-hosted before the cabinet can serve them.
2. **Web purchases are not linked to a user at payment time.** `create-payment` with
   `source=web` stores `telegram_user_id=null`; `mono-callback` grants `user_courses`
   **only if `telegram_user_id` is present** (`mono-callback/index.ts:158`). Today the
   web success page pushes the buyer into the bot deep-link (`/start <order_id>` →
   `claimPaymentForUser`) to claim access. The cabinet needs a web-native equivalent.
3. GitHub Pages is **static-only** → the cabinet is a client-rendered app; all
   server-side logic lives in Supabase Edge Functions (already the pattern for payments).

---

## 2. Architecture decisions

| Decision | Choice | Why |
|---|---|---|
| Where | **`/cabinet/` path on the main domain**, inside the existing Astro app in `web/` | User requirement: cabinet on li-astrology.com.ua. Same repo, same deploy workflow, same domain cookie/origin — no new hosting, no DNS changes. |
| Rendering | Client-side app (Astro page with a framework island — Preact/Svelte/vanilla TS) | GitHub Pages can't SSR. Supabase JS auth + RLS make client-side safe. |
| Backend | Supabase only: RLS-protected REST + new Edge Functions | Matches existing infra; service-role stays server-side. |
| Auth (phase 1) | **Telegram Login Widget** → `tg-auth` edge function → Supabase-signed JWT | Every existing customer is already keyed by Telegram ID → all past purchases + progress appear in the cabinet instantly, zero migration. |
| Auth (phase 3) | Email OTP (Supabase Auth) as fallback for no-Telegram buyers | Needs an `accounts` linking model — deferred, see §8. |
| Video hosting | **Bunny Stream** | ~$1–5/mo at our scale, signed/expiring embed URLs, domain-locked player, EU. (Fallback: Vimeo Starter if we decide to buy simplicity.) |
| PDF/audio hosting | Supabase Storage, private bucket + signed URLs | Simple, already in the stack; no streaming needs. |
| Bot | Unchanged as a channel | `media` JSONB keeps `file_id` and gains hosted URLs/IDs — one source of truth, two delivery channels. |

**Escape hatch:** if we ever need SSR (SEO'd cabinet pages, server redirects), move the
whole `web/` deploy from GitHub Pages to Cloudflare Pages — same domain, same Astro
project, adds functions. Not needed for v1.

---

## 3. Auth design (Telegram Login)

```
[/cabinet/ login page]
  → Telegram Login Widget (bot: @li_astrology_bot; requires BotFather /setdomain → www.li-astrology.com.ua)
  → widget returns {id, first_name, username, photo_url, auth_date, hash}
  → POST tg-auth edge function:
      • verify hash = HMAC-SHA256(data_check_string, SHA256(BOT_TOKEN))  ← spec-standard check
      • reject if auth_date older than 24h
      • upsert bot_users row (first_name/username refresh)
      • sign JWT with SUPABASE_JWT_SECRET:
          { role: 'authenticated', telegram_id: <id>, exp: now+7d }
  → client stores JWT (localStorage), passes it to supabase-js as the auth token
  → RLS policies key on (auth.jwt()->>'telegram_id')::bigint
```

New RLS policies (tables are currently service-role-only — add, don't replace):

- `courses`, `lessons` (minus media secrets): `SELECT` for `authenticated` — lessons only
  where the user owns the course (join through `user_courses`) or `is_free_preview`.
- `user_courses`: `SELECT` own rows.
- `user_lesson_progress`: `SELECT/INSERT/UPDATE` own rows.
- Media access **never** via direct public URLs: `media-url` edge function checks
  ownership then returns a short-lived signed URL (Bunny token / Storage signed URL).

Rate-limit `tg-auth` and log logins (reuse `bot_users.last_active`).

---

## 4. Payment → cabinet access (the core flow)

Current flow stays; we add the web-native claim path:

```
[buy on site] → create-payment (source=web) → Mono pay page
  → redirect: /payment/success/?order_id=…
      NEW on this page:
        1. Poll payment status (new `order-status` edge function or RLS-safe view) until paid
           (reconcile-payments already guarantees eventual consistency)
        2. Show TWO equal options:
           a. «Відкрити кабінет» → Telegram Login → POST claim-order {order_id, JWT}
           b. «Відкрити в Telegram» → existing t.me deep-link (unchanged)
  → claim-order edge function (mirrors bot's claimPaymentForUser):
      • payment exists, status=paid, telegram_user_id IS NULL (or = claimer)
      • set payments.telegram_user_id, upsert user_courses
      • → redirect into /cabinet/ with the course unlocked
```

- Purchases **from the bot** and already-claimed web purchases need nothing: `user_courses`
  is already keyed by Telegram ID → visible in the cabinet on first login.
- `mono-callback`/`reconcile-payments` unchanged (they already grant when
  `telegram_user_id` is set).
- Buy buttons inside the cabinet (upsells) call `create-payment` with the logged-in
  `telegram_user_id` → access lands automatically, no claim step.

---

## 5. Content migration (the long pole — start immediately)

1. **Ask Anastasia for original recordings** (video + audio). Bot API cannot download
   files >20 MB, so originals are Plan A.
2. Plan B: one-time MTProto export (Telegram *user* session, e.g. Telethon/GramJS script
   in `tools/`) — downloads any size from the source channels/bot chat.
3. Upload: videos → Bunny Stream (one library, collections per course); PDFs/audio →
   Supabase Storage private bucket `course-media/<course_slug>/…`.
4. Extend `media` JSONB items: `{type, file_id, bunny_id?, storage_path?}` — bot keeps
   using `file_id`, cabinet uses the new fields. One import script, idempotent,
   position-matched, in `tools/`.
5. Verify every lesson renders in both channels before flipping anything user-facing.

---

## 6. Cabinet UI (v1 scope)

Routes under `/cabinet/` (single Astro page, client-side router or query params):

- **Login** — Telegram widget + short "what is this" copy.
- **My courses** — owned courses with progress bars; not-owned active courses as
  upsell cards (reuse marketing imagery, buy → create-payment).
- **Course view** — lesson list (emoji/type logic mirrors `bot/src/handlers/lesson.ts`),
  progress ticks, «продовжити з місця зупинки».
- **Lesson view** — text_html + Bunny player (signed embed) + PDF/audio download links
  (signed) + prev/next + mark-complete (writes `user_lesson_progress`, same semantics
  as the bot so the two channels stay in sync).
- **Settings** — language (reuse `bot_users.lang`), linked Telegram account info.

Brand: reuse `web/` Tailwind theme + `brand/` tokens (same as PDF design system).
i18n: UK default, RU toggle — reuse the bot's locale key structure where sensible.

---

## 7. Nice-to-have features (post-v1, prioritized)

1. **Natal chart calculator** — niche killer feature; birth date/time/place → chart in
   the cabinet. Doubles as site lead magnet; students practice on their own chart.
   (Swiss Ephemeris port or `astronomy-engine`.)
2. **Certificate of completion** — generate from the `materials/` PDF pipeline on 100%
   progress; personalized; students share to IG → organic marketing for the ads push.
3. Styled PDF materials download (pipeline exists).
4. Homework / "ask a question" per lesson → routed to the bot's admin side.
5. Bot↔cabinet nudges — bot reminder deep-links into the cabinet lesson (nurture infra exists).
6. Notes & bookmarks per lesson.
7. Promo-code field on cabinet buy buttons (backend already supports `promo_code`).
8. Quizzes/self-checks; drip/cohort scheduling; referral program — later.

---

## 8. Email-only accounts (phase 3 design sketch)

For buyers without Telegram: Supabase Auth email OTP. Requires a unified identity:
`accounts` table (`id uuid PK`, `telegram_id bigint UNIQUE NULL`, `auth_uid uuid UNIQUE
NULL`, `email`), plus nullable `account_id` on `user_courses`/`user_lesson_progress`
(backfilled from `telegram_id`). Claim-order then works from either identity. **Do not
build in v1** — every current customer has Telegram; complexity isn't paid for yet.

---

## 9. Phases / task breakdown

**Phase 0 — unblock content (can run in parallel with everything)**
- [ ] Ask Anastasia for original video/audio files
- [ ] Create Bunny Stream account + library; decide plan
- [ ] BotFather `/setdomain` → www.li-astrology.com.ua
- [ ] (fallback) MTProto export script in `tools/`

**Phase 1 — auth + cabinet shell (no video dependency)**
- [ ] `tg-auth` edge function (hash verify + JWT) + tests
- [ ] RLS policies migration (supabase/migrations)
- [ ] `/cabinet/` app: login, my-courses, course view, lesson view (text lessons only)
- [ ] Progress read/write wired to `user_lesson_progress`

**Phase 2 — payment → access on web**
- [ ] `order-status` + `claim-order` edge functions
- [ ] `/payment/success/` upgrade: poll status + «Відкрити кабінет» path
- [ ] Analytics: `Purchase` event already fires; add `cabinet_login`, `lesson_complete` GA4 events

**Phase 3 — media**
- [ ] Upload PDFs/audio to Supabase Storage; extend `media` JSONB; `media-url` edge function
- [ ] Upload videos to Bunny; signed embed in lesson view
- [ ] Full QA: every lesson of every course in bot AND cabinet

**Phase 4 — nice-to-haves** (order per §7; natal chart + certificates first)

---

## 10. Open questions

1. Anastasia's originals — do they exist for all 52 videos? (Determines Plan A vs B.)
2. Bunny vs Vimeo final call — Bunny assumed; revisit only if signed-URL wiring stalls.
3. JWT lifetime / re-login UX (7d proposed).
4. Does the cabinet replace the bot for NEW courses eventually, or stay dual-channel?
   (Spec assumes dual-channel indefinitely.)
