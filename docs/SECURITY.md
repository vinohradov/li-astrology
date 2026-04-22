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

- **2026-04-15** — GitHub PAT was pasted into chat while configuring the
  origin remote. Mono token was also pasted in chat during Mono setup.
  Both are supposed to have been rotated. Verify via `git remote -v` that
  no PAT is embedded in the URL.

## RLS

All bot tables (`bot_users`, `courses`, `lessons`, `user_courses`,
`user_lesson_progress`, `reminders`, `promotions`, `bot_sessions`,
`payments`) have RLS enabled with a single `service_role_all_<table>`
policy that grants full access to the service role. Direct PostgREST
calls from the browser can never touch these tables — only our
service-keyed Edge Functions can.
