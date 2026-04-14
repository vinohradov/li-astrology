# Supabase Setup Guide

The website and Telegram bot share one Supabase project. Schema lives in two files:

- `../bot/schema.sql` — core tables (`bot_users`, `courses`, `lessons`, `user_courses`, `promotions`, `bot_sessions`)
- `migrations/0001_payments.sql` — provider-agnostic `payments` table (replaces the old `purchases`)

## 1. Apply schema

1. Open [SQL Editor](https://supabase.com/dashboard/project/plyofinxmwvwbintvqbx/sql)
2. Run `../bot/schema.sql` (if not yet applied)
3. Run `migrations/0001_payments.sql`

## 2. Edge Functions env vars

[Edge Functions → Settings](https://supabase.com/dashboard/project/plyofinxmwvwbintvqbx/settings/functions) — add:

```
TELEGRAM_BOT_TOKEN=<bot token from @BotFather>
TELEGRAM_BOT_USERNAME=li_astrology_bot
SITE_URL=https://li-astrology.com.ua

# WayForPay — leave empty to use sandbox defaults (test_merch_n1)
WAYFORPAY_MERCHANT_ACCOUNT=
WAYFORPAY_SECRET_KEY=
WAYFORPAY_DOMAIN_NAME=li-astrology.com.ua
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

## 3. Deploy Edge Functions

```bash
npm install -g supabase
supabase login
supabase link --project-ref plyofinxmwvwbintvqbx

supabase functions deploy create-payment
supabase functions deploy wfp-callback --no-verify-jwt
```

`--no-verify-jwt` on `wfp-callback` because WayForPay doesn't send a Supabase JWT; signature is verified inside the function via HMAC_MD5.

## 4. Payment flow

```
Web:  lander → payment.js → create-payment → WFP → wfp-callback → payments.status=paid
      → user clicks "Open Telegram" → bot /start {order_id} → grants user_courses

Bot:  inline "Buy" → create-payment (telegram_user_id known) → WFP link →
      wfp-callback → payments.status=paid + user_courses + Telegram notify
```

## Troubleshooting

- **Function logs**: [Functions dashboard](https://supabase.com/dashboard/project/plyofinxmwvwbintvqbx/functions)
- **Payments table**: [Table Editor](https://supabase.com/dashboard/project/plyofinxmwvwbintvqbx/editor) → `payments`
- **Bot logs**: Railway project dashboard
