# Telegram Bot Setup Guide

To fully enable the automated course delivery via Telegram, follow these steps:

## 1. Create a Telegram Bot
1. Open Telegram and search for **@BotFather**.
2. Send `/newbot`.
3. Follow the instructions to name your bot (e.g., `Li Astrology Bot`) and giving it a username (must end in `bot`, e.g., `li_astrology_bot`).
4. **Copy the API Token** provided by BotFather.
5. Update `js/config.js` if your bot username is different from `li_astrology_bot`.

## 2. Create Private Channels
For each course product, create a **Private Channel** in Telegram:
- **Intensiv**
- **Kurs Aspekty (Text)**
- **Kurs Aspekty (Video)**
- **Kurs Aspekty (Professional)**

## 3. Add Bot as Administrator
1. Go to each channel's settings.
2. Select **Administrators** > **Add Admin**.
3. Search for your bot username (`@li_astrology_bot`) and add it.
4. Ensure "Invite Users via Link" permission is enabled.

## 4. Get Channel IDs
You need the numeric ID for each channel (e.g., `-1001234567890`).
1. Forward a message from the channel to the bot **@userinfobot** (or similar ID bots).
2. Note down the ID for each channel.

## 5. Configure Supabase Secrets
Go to your Supabase Dashboard > Project Settings > Edge Functions > Secrets (or use CLI).
Set the following secrets:

```bash
TELEGRAM_BOT_TOKEN=your_token_from_botfather
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CHANNEL_INTENSIV=-100xxxxxxxxxx
CHANNEL_KURS_T1=-100xxxxxxxxxx
CHANNEL_KURS_T2=-100xxxxxxxxxx
CHANNEL_KURS_T3=-100xxxxxxxxxx
```

## 6. Set Webhook
To verify purchases when users press "Start", the bot needs a webhook.
Run this command in your terminal (replacing placeholders):

```bash
curl -F "url=https://[YOUR_SUPABASE_ID].supabase.co/functions/v1/telegram-bot" \
     https://api.telegram.org/bot[YOUR_BOT_TOKEN]/setWebhook
```

## 7. Test
1. Make a purchase (or simulate one in Supabase `purchases` table).
2. Go to `https://t.me/li_astrology_bot?start=[ORDER_ID]`.
3. The bot should verify the order and send you a one-time invite link.
