# Open items — action required

## Urgent / credentials

- [ ] **Rotate GitHub personal access token.** A PAT was committed into the
      `origin` remote URL (`ghp_ZLTV…`). Revoke at
      https://github.com/settings/tokens and switch the remote to SSH:
      ```
      git remote set-url origin git@github.com:vinohradov/li-astrology.git
      ```

## Monobank

- [ ] **Contact Mono support to enable full merchant API access on the
      integration token.** The token created via
      "Налаштування інтеграції на сайт" → `mSrc…` can call `/invoice/create`
      fine but returns **404 on `/api/merchant/pub-key`**.
      Without pub-key access, ECDSA signature verification on webhooks is
      impossible, and we rely on an invoice-details match instead
      (invoiceId + amount + ccy). That is secure, but strict ECDSA would be
      better.
      - Who to contact: Mono acquiring support (from fop.monobank.ua —
        chat inside the merchant cabinet, or `acquiring@monobank.ua`).
      - What to ask: "Please enable the `/api/merchant/pub-key` endpoint
        for our integration token so we can verify webhook signatures."
      - No code change needed once enabled — `mono-callback` will pick up
        the key automatically on the next cache refresh.

- [ ] **Remove `TEST_PRICE_DIVISOR=10` before going live.** Run
      `supabase secrets unset TEST_PRICE_DIVISOR` to restore full prices.

- [ ] **Check Mono merchant dashboard for any webhook delivery warnings.**
      Historical webhooks returned 500 before we hardened the handler;
      Mono may have soft-deactivated retries. New invoices work fine but
      worth verifying "Webhooks" tab in the cabinet shows healthy green.

## Nice-to-have

- [ ] Wire the bot purchase flow to reuse the same "Про курс" website
      URLs for the `astro-z-0` course (no landing page exists yet).

- [ ] Translate course marketing copy (landing pages + course DB titles
      and descriptions) for Russian users. Only UI chrome is translated
      right now.

- [ ] Telegram bot avatar — PNG ready at `brand/li-bot-avatar-512.png`.
      Upload via @BotFather → `/mybots` → Edit Bot → Edit Botpic.

- [ ] When comfortable, drop the `reconcile-payments` cron tick from
      every minute to every 5 minutes. Webhooks are now reliable; cron
      is a belt-and-suspenders safety net.

- [ ] LiqPay activation tasks (separate from Mono; tracked in
      `.claude-personal/.../project_liqpay_activation.md`). Low priority
      unless LiqPay becomes the primary path again.
