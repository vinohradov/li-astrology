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

## Bot chat cleanup — known limits

- **Telegram Bot API: 48h hard limit on `deleteMessage` / `deleteMessages`**
  in private chats. Bot messages older than 48 hours cannot be removed by
  any means — this is a platform rule, not our bug.
- What we do: every navigation goes through `cleanAndSend`
  (`bot/src/utils/chat.ts`), which tracks sent message_ids in
  `bot_sessions.value.botMessageIds` and deletes them on the next click.
  Nurture broadcasts now track their message_id via
  `appendUserBotMessageId` in `bot/src/db/sessions.ts`.
- For callbacks older than 24h, `cleanAndSend` switches from "edit in place"
  to "send new at the bottom" so the returning user doesn't see the nav
  buried above frozen old content.
- Residual UX gap: if a user returns after 48h, old media (audio/video)
  can't be deleted. It stays above the new navigation in the scroll
  history. No fix available — only mitigation is the 1/3/7-day nurture
  sequence that tries to pull users back inside the 48h window.

- [ ] On first-seen user return after >7 days, consider sending a
      visual separator ("━━━━━━ з поверненням ━━━━━━") before navigation
      to visually close off the dead history. Low priority — nice polish.

## Nurture scheduler — known quirks

- [ ] **Retroactive firing on new nurture rules.** When a new nurture
      sequence is added, existing paid users get every step whose
      `scheduled_at` is already in the past (e.g. a user who bought
      Intensiv 3 weeks ago received D+1 and D+3 nurture within the same
      minute). Prevent by either (a) stamping a "skip if older than X"
      guard in the scheduler, or (b) only scheduling for users whose
      trigger event is in the future at time of rule insert. Not urgent
      since going forward new buyers land on the timeline cleanly.

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
