# Project Status — Li Astrology

Last updated: 2026-06-08

## Stack

| Layer | Tech | Location |
|---|---|---|
| Marketing site | Astro + Tailwind | `web/` — **the only deployed site**; GitHub Pages via `.github/workflows/deploy.yml` (triggers on `web/**` only, builds `web/dist`). Serves on `www.li-astrology.com.ua` (apex 301→www). |
| Legacy static site | Plain HTML/CSS/JS | `index.html`, `intensiv/`, `kurs-aspekty/`, `js/` — **NOT served / dead** (legacy ~Jan 2026). Don't edit for live changes; verify against the live www domain. Routes differ from live (legacy `/kurs-aspekty/` vs live `/aspekty/`). |
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
      • validates course
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

## Analytics, tracking & SEO (added 2026-06-08)

All in the Astro app `web/`. Before this date the LIVE site had **zero** analytics
(GA4 lived only in the dead legacy root). Config in `web/src/config/site.ts`:
`analytics: { ga4, metaPixel }` + `googleSiteVerification`.

- **Google Analytics 4** — `G-X0MBT0NMFG`. (Reused from legacy config — confirm the
  property still belongs to us; if dead, create new + swap the one line.)
- **Meta Pixel** — `1880056772659898`. In Andrii's Meta Business; IG @li_astrology_
  (wife's) connects as an asset (not required for the pixel to track the website).
  Confirmed firing (`tr?...ev=PageView` → 200). Events: PageView, plus
  `begin_checkout`/`InitiateCheckout` on buy-button click (`web/src/scripts/payment.ts`)
  and `purchase`/`Purchase` on the success page.
- Both loaders live in `web/src/components/Analytics.astro` as ONE top-level
  `<script define:vars>` (do NOT wrap raw-JS scripts in `{cond && (<script>…)}` — Astro
  parses the body as JSX and the pixel IIFE never runs → "fbq is not defined").
- **SEO**: Layout.astro already had canonical/OG/Twitter; added JSON-LD
  (`EducationalOrganization` site-wide + `Course` with UAH prices on intensiv/aspekty/course).
- **Static**: `web/public/{robots.txt,sitemap.xml,llms.txt}`. robots allows AI bots
  (GPTBot/ClaudeBot/PerplexityBot/Google-Extended); llms.txt is the AI-discoverability card.
- **Canonical host = www**: `site.url` + sitemap/llms/robots/canonical/OG all on
  `https://www.li-astrology.com.ua` (was apex, which 301s — fixed so canonical isn't a redirect).
- **Google Search Console**: VERIFIED (URL-prefix `https://www.li-astrology.com.ua`,
  HTML-tag method, token in `site.googleSiteVerification`). Sitemap submitted.

## Key URLs

- Site: https://www.li-astrology.com.ua
- Bot: https://t.me/li_astrology_bot
- Supabase dashboard: https://supabase.com/dashboard/project/plyofinxmwvwbintvqbx
- Edge functions logs: https://supabase.com/dashboard/project/plyofinxmwvwbintvqbx/functions
- Mono merchant cabinet: https://fop.monobank.ua
- Repo: https://github.com/vinohradov/li-astrology
- Google Analytics 4: https://analytics.google.com (property G-X0MBT0NMFG)
- Meta Events Manager (Pixel 1880056772659898): https://business.facebook.com/events_manager2/
- Google Search Console: https://search.google.com/search-console
