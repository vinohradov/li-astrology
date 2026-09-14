# Security notes

## Payment webhook (Mono)

**Preferred path:** ECDSA signature verification using Mono's public key
(`/api/merchant/pub-key`). Currently **unavailable** — that endpoint returns
404 for our integration token. See `docs/TODO.md` for the support request.

**Active protection** (fallback in `supabase/functions/mono-callback/index.ts`):

1. Webhook must include an `X-Sign` header (presence check — format not
   verified since pub-key is unavailable).
2. Webhook body must parse as JSON and carry a `reference` field matching
   an `order_id` in `payments`.
3. Webhook `invoiceId` must equal `payments.provider_order_id` (set at
   invoice-create time from Mono's response).
4. Webhook `amount` must equal `payments.amount * 100` (kopiykas).
5. Webhook `ccy` must equal `980`.

If (3/4/5) fail → 400 response, no DB update.

An attacker would need to know a valid `order_id` **and** the `invoiceId`
Mono returned at invoice-create. Neither is exposed publicly; both live
only in our DB, our logs, and Mono's system.

When pub-key access is restored, strict ECDSA verification kicks in
automatically — the fallback is only used when `sigOk !== true`.

## Supabase Edge Function auth

- `create-payment`: `verify_jwt = false`. The bot uses a `sb_secret_…`
  API key (not a JWT), and the function validates course + price
  internally, so JWT verification is not load-bearing.
- `mono-callback`, `wfp-callback`: `verify_jwt = false`. These receive
  external provider POSTs with their own signature schemes.
- `reconcile-payments`: `verify_jwt = false`. Read-only against Mono's
  API, idempotent writes to our DB.

## Cabinet auth

- `tg-auth` (`verify_jwt = false`): verifies the Telegram Login Widget hash
  (HMAC-SHA256 with SHA256(bot token), constant-time compare, `auth_date` ≤ 24h),
  then creates/links a Supabase Auth user (`tg-<id>@users.li-astrology.com.ua`,
  pre-confirmed, `app_metadata.telegram_id`) and returns a single-use magic-link
  `token_hash`. No email is sent. `app_metadata` is writable only by the service role.
- `claim-order` (`verify_jwt = false`): validates the caller's session with
  `auth.getUser(jwt)` (the gateway check doesn't support the project's ES256 keys),
  then binds a paid unclaimed order with a conditional update
  (`WHERE telegram_user_id IS NULL`) — same rule as the bot's `/start <order_id>`.
- Public email signups are disabled in Supabase Auth (`disable_signup = true`).

## Secrets management

All secrets live in Supabase Edge Function secrets, never in code or
committed files.

Required secrets:
- `MONOBANK_TOKEN` — merchant integration token
- `TELEGRAM_BOT_TOKEN` — bot token from @BotFather
- `WAYFORPAY_MERCHANT_ACCOUNT`, `WAYFORPAY_SECRET_KEY`, `WAYFORPAY_DOMAIN_NAME`
  — WayForPay scaffolding (unused in live flow)
- `TELEGRAM_BOT_USERNAME` — `li_astrology_bot`
- `SITE_URL` — `https://li-astrology.com.ua`

Supabase auto-injects `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

View / set:
```
supabase secrets list
supabase secrets set KEY=value
supabase secrets unset KEY
```

## Bot credentials

Bot reads from `bot/.env` (not committed):
- `BOT_TOKEN` — same as `TELEGRAM_BOT_TOKEN` above
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `ADMIN_IDS` — comma-separated Telegram user IDs for support notifications

## Known credential incidents

- **2026-09-14** — **Supabase `TELEGRAM_BOT_TOKEN` secret was stale.** The
  2026-08-18 rotation updated `bot/.env` and Fly but not the Supabase Edge
  Function secret (its digest matched neither the live token nor empty).
  Effect: `mono-callback` / `reconcile-payments` Telegram payment
  confirmations were failing silently. Reset to the live token via
  `supabase secrets set --env-file` (value never printed). **When rotating the
  bot token, update all three: `bot/.env`, `fly secrets`, `supabase secrets`.**

- **2026-08-18** — **Bot token compromise.** The live `BOT_TOKEN` was
  committed to the **public** repo `vinohradov/li-astrology` in
  `supabase/README.md` (`4fbf44a`, 2026-01-21) and `bot/.env.example`
  (`a43c2fd`, 2026-04-13). Removed from HEAD later, but it stayed readable
  in git history and was harvested. An attacker used it to:
  set a webhook to `https://ssh.inkognit.org:8443/hook/…` (which silently
  killed our long-polling with 409 — inbound updates were dead), and rewrite
  the bot's `en` description, short description and `/start` command
  description to casino spam (`@Xstakerobot`).
  Remediated same day: token revoked via BotFather, new token written to
  `bot/.env` + `fly secrets`, webhook deleted with `drop_pending_updates`,
  descriptions and commands restored. Old token confirmed dead
  (`401 SESSION_REVOKED`). Note: `getMe`/`getWebhookInfo` kept returning
  stale `ok:true` for the revoked token from Telegram's edge cache — use a
  method like `getMyCommands` to confirm a revoke.
  Follow-ups: the GitHub PAT was stripped from the `origin` remote URL
  (still needs revoking at github.com/settings/tokens); the token remains in
  public git history forever, so rotation — not history rewriting — is the
  fix; consider making the repo private.

- **2026-04-15** — GitHub PAT was pasted into chat while configuring the
  origin remote. Mono token was also pasted in chat during Mono setup.
  Both are supposed to have been rotated. Verify via `git remote -v` that
  no PAT is embedded in the URL.

## RLS

**⚠️ Defect found 2026-09-14 (open until cabinet Phase 0 ships):** the
`service_role_all_<table>` policies from `bot/schema.sql` and
`0001_payments.sql` were created **without `TO service_role`**, so they apply
to PUBLIC — including the `anon` role. Verified: the public anon key shipped in
`web/src/config/site.ts` can `SELECT` from `bot_users`, `payments`, `lessons`
and gets HTTP 200 on `PATCH bot_users`. The earlier claim below that browsers
"can never touch these tables" was wrong. Fix = migration
`0003_rls_lockdown.sql` (recreate policies `TO service_role`, revoke table
privileges from `anon`/`authenticated`) — see
`.claude/dosc/CABINET_IMPLEMENTATION_PLAN.md` §3. Update this section when
applied.

All bot tables (`bot_users`, `courses`, `lessons`, `user_courses`,
`user_lesson_progress`, `reminders`, `promotions`, `bot_sessions`,
`payments`, `bot_waitlist`) have RLS enabled. The bot and edge functions use
the service role (`sb_secret_…` / `SUPABASE_SERVICE_ROLE_KEY`), which
bypasses RLS. The cabinet (Phase 1+) adds `authenticated` policies keyed on
`app_metadata.telegram_id` from the Supabase Auth JWT.
