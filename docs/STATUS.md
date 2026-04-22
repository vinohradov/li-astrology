# Project Status — Li Astrology

Last updated: 2026-04-22

## Stack

| Layer | Tech | Location |
|---|---|---|
| Marketing site | Astro + Tailwind | `web/` — deployed to GitHub Pages via `.github/workflows/deploy.yml` |
| Legacy static site | Plain HTML/CSS/JS | `index.html`, `intensiv/`, `kurs-aspekty/`, `js/` (still deployed alongside Astro) |
| Telegram bot | grammY + Node + TypeScript | `bot/` — deployed to Railway on `git push` via Dockerfile/nixpacks |
| Backend DB + Edge Functions | Supabase (project `plyofinxmwvwbintvqbx`) | `supabase/functions/`, `supabase/migrations/` |
| Payments | MonoBank acquiring (primary) + WayForPay (scaffolding, unused) | `supabase/functions/create-payment`, `mono-callback`, `wfp-callback`, `reconcile-payments` |

## Courses (slug → UUID)

Live (selling via Mono):
- `intensiv` — `2ad83d74-35ce-4a85-afe1-44799076b22e` — "Інтенсив «Астрологія з 0»" — 1199 UAH
- `aspekty-basic` — `6239c8d4-a5a0-4783-ba35-7d73d1eb63c7` — "Аспекти — базовий тариф" — 1290 UAH
- `aspekty-pro` — `1a3c5ec9-2ac9-4322-beed-ec0fb9e88c6e` — "Аспекти — професійний тариф" — 2790 UAH

Sellable but landing not wired:
- `astro-z-0` — `50626a23-7423-40d2-93d2-fd11d6d7cf23` — "Курс «Астрологія з 0»" — 6000 UAH — `is_active=true`.
  Content fully in DB (26 rows in `lessons`: meditations, 12 lessons, Sun/Moon gift, consultation demo, bonus, methodologies, finale). Bot handles `?start=buy_astro-z-0` already (see `bot/src/handlers/start.ts:25`). Edge function `create-payment` knows the slug.
  **Landing `/course/` is in waitlist-mode and DOES NOT link to the buy flow** — all CTAs point to `?start=waitlist_course` (not handled). This is a UI-backend mismatch currently blocking sales.

Pre-launch (content not recorded yet):
- `astro-z-0-pro` — "Курс «Астрологія з 0» — Для профі" — 12500 UAH. Shares the `/course/` landing (pro tariff card is "Рекомендуємо"). **NOT YET IN DB.** Depends on the "Як консультувати" block (6 modules) being filmed.

## Payment flow (live)

```
[user] buy button (bot OR web)
  → POST create-payment edge function (verify_jwt=false)
      • validates course, applies TEST_PRICE_DIVISOR if set
      • inserts payments row (status=pending, source=web|bot)
      • calls Mono /api/merchant/invoice/create with webHookUrl + redirectUrl
  → returns Mono pageUrl → user pays on pay.monobank.ua
  → Mono redirects: web → /payment/success/?order_id=…, bot → t.me/<bot>?start=<order_id>
  → Mono webhook → mono-callback:
      • verifies signature (best-effort; pub-key endpoint is 404 on our token)
      • fallback security: requires invoiceId + amount + ccy to match what we stored
      • updates payments.status=paid, upserts user_courses, sends Telegram confirmation
  → bot /start <order_id> handler confirms access
```

Safety net: `reconcile-payments` edge function runs every minute from the bot scheduler
(`bot/src/jobs/reconcile-payments.ts`). Polls Mono's `/api/merchant/invoice/status`
for every `pending` monobank row, updates DB, grants access. Handles webhook misses.

## i18n

- Bot has Ukrainian (default) + Russian. Toggle in Settings.
- Locale resolver `bot/src/locales/index.ts`, middleware `bot/src/middleware/locale.ts` sets `ctx.t`.
- User preference persisted in `bot_users.lang`.
- Course titles/descriptions/lesson content in DB are Ukrainian only — only UI chrome is translated.
- Website has a UI-only language toggle; Russian marketing copy not translated yet (toast: "Російська версія — скоро").

## Bot content specifics

- Emoji logic in `bot/src/handlers/lesson.ts`: titles starting with an emoji keep theirs; otherwise `📚/🎧/🎬/📄` from content_type.
- `📦` retired. Default fallback is `📚`.
- `aspekty-basic` PDFs (Самовчитель, Аспекти Сонця і Місяця, Аспекти особистих планет) are now full lessons (`material=false`) and count toward progress.
- `aspekty-pro` lesson 2 renamed "Компенсаторика та пропрацювання".
- `astro-z-0` final lesson "🎧 Фінал" has custom intro text_html before the audio.
- `astro-z-0` lesson list has a persistent "📚 Література / книги" button → `bot/src/content/extras.ts`.
- Purchase flow: "Про курс (на сайті)" URL button above "Купити" on catalog detail. Promo code UI removed.

## Test-mode price divisor

Set `TEST_PRICE_DIVISOR=10` in Supabase secrets to charge 1/10 real price on every new invoice.
Unset to return to full price. No redeploy required.

```bash
supabase secrets set TEST_PRICE_DIVISOR=10    # testing
supabase secrets unset TEST_PRICE_DIVISOR     # production
```

## Key URLs

- Site: https://li-astrology.com.ua
- Bot: https://t.me/li_astrology_bot
- Supabase dashboard: https://supabase.com/dashboard/project/plyofinxmwvwbintvqbx
- Edge functions logs: https://supabase.com/dashboard/project/plyofinxmwvwbintvqbx/functions
- Mono merchant cabinet: https://fop.monobank.ua
- Repo: https://github.com/vinohradov/li-astrology
