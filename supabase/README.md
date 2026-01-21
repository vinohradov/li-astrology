# Supabase Setup Guide

## 1. Create Database Schema

Go to [Supabase SQL Editor](https://supabase.com/dashboard/project/plyofinxmwvwbintvqbx/sql) and run the contents of `schema.sql`.

## 2. Set Environment Variables

Go to [Edge Functions Settings](https://supabase.com/dashboard/project/plyofinxmwvwbintvqbx/settings/functions) and add these secrets:

```
LIQPAY_PUBLIC_KEY=sandbox_i21449002699
LIQPAY_PRIVATE_KEY=sandbox_oMGV3eHK1O5vnvY4CXJKhaRkjJSxMqdssflJE7TY
TELEGRAM_BOT_TOKEN=8496882517:AAEouUsgceTT3YBZfRD7cTQQjfV5B6AsM5k
CHANNEL_INTENSIV=-100xxxxxxxxxx
CHANNEL_KURS_T1=-100xxxxxxxxxx
CHANNEL_KURS_T2=-100xxxxxxxxxx
CHANNEL_KURS_T3=-100xxxxxxxxxx
```

**Note:** Replace channel IDs after creating private Telegram channels.

## 3. Deploy Edge Functions

Install Supabase CLI:
```bash
npm install -g supabase
```

Login and link project:
```bash
supabase login
supabase link --project-ref plyofinxmwvwbintvqbx
```

Deploy functions:
```bash
supabase functions deploy create-payment
supabase functions deploy liqpay-callback
supabase functions deploy telegram-bot
```

## 4. Set Up Telegram Webhook

After deploying, set the webhook for your bot:

```bash
curl -X POST "https://api.telegram.org/bot8496882517:AAEouUsgceTT3YBZfRD7cTQQjfV5B6AsM5k/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://plyofinxmwvwbintvqbx.supabase.co/functions/v1/telegram-bot"}'
```

## 5. Create Telegram Channels

1. Create 4 private channels in Telegram:
   - Li Astrology Intensiv (for intensiv product)
   - Li Astrology Kurs T1 (for tariff 1)
   - Li Astrology Kurs T2 (for tariff 2)
   - Li Astrology Kurs T3 (for tariff 3)

2. Add @li_astrology_bot as admin to all channels

3. Get channel IDs:
   - Forward a message from each channel to @userinfobot
   - Copy the "Id" value (negative number like -1001234567890)

4. Update environment variables with channel IDs

## 6. Test the Flow

1. Open the website and click "Buy"
2. Complete payment (sandbox mode)
3. You should be redirected to success page
4. Click "Open Telegram" button
5. Bot should send you the channel invite link

## Troubleshooting

### Check Edge Function Logs
Go to [Functions](https://supabase.com/dashboard/project/plyofinxmwvwbintvqbx/functions) and click on a function to see logs.

### Check Database
Go to [Table Editor](https://supabase.com/dashboard/project/plyofinxmwvwbintvqbx/editor) and check the `purchases` table.

### Test Telegram Bot
Send `/start` to @li_astrology_bot - should get welcome message.
