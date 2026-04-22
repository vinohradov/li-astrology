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

## Course launch (astro-z-0)

**Status:** `astro-z-0` is `is_active=true` in DB with all 26 lesson
rows populated. Bot supports `?start=buy_astro-z-0`, `create-payment`
Edge Function knows the slug. **Basic tariff (6000) is fully ready to
sell after deploying the latest landing changes.**

- [x] Rewire `/course/` landing CTAs for Basic tariff to the buy flow
      (hero + basic card + sticky mobile → `?start=buy_astro-z-0`; "Скоро"
      badge removed).
- [x] `web/src/config/site.ts` — `astro-z-0.status: 'live'`.
- [x] Pro tariff card stays on waitlist with disclaimer (`~2 months`).
- [x] `?start=waitlist_course` handler in bot + `bot_waitlist` table.

Pending (requires a deploy + SQL migration):

- [ ] **Apply SQL migration** `supabase/migrations/0002_waitlist_and_nurture.sql`
      via Supabase Dashboard → SQL Editor. Creates `bot_waitlist` +
      dedup index on `reminders`.

- [ ] **Deploy Astro site** (`git push` → GitHub Pages) so the rewired
      CTAs go live.

- [ ] **Deploy bot** (`git push` → Railway) so waitlist handler +
      nurture cron activate.

- [ ] **Record and upload "Як консультувати" block** (6 modules from the
      landing). Then create `astro-z-0-pro` course row + lesson rows +
      flip its landing CTA from waitlist to buy. ETA ~2 months.

- [ ] **Broadcast command / script** for pushing `bot_waitlist` entries
      when Pro tariff launches. Not urgent — add when closer to Pro
      launch.

## Nice-to-have

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
