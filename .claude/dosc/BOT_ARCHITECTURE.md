# Архітектура Telegram-бота
> Оновлено **2026-04-22**.
>
> **Цей документ — тільки вказівник.** Живі джерела істини:
> - `docs/STATUS.md` — поточний стек, флоу платежів, особливості контенту.
> - `bot/` — власне код бота (grammY + Node + TypeScript).
> - `supabase/migrations/` — схема БД, включно з таблицями бота.
>
> Попередня версія цього файлу (Deno/Edge Function, LiqPay, таблиці `telegram_users`/`products`/`purchases`) **застаріла** і не відповідає реальній реалізації.

---

## Коротке summary (deploy + run)

| Параметр | Значення |
|---|---|
| Framework | `grammY` |
| Runtime | Node.js + TypeScript |
| Hosting | Railway (Dockerfile + nixpacks) |
| Trigger | Long polling (не webhook) |
| База даних | Supabase Postgres (спільна з сайтом) |
| Деплой | `git push` → Railway білдить з `bot/Dockerfile` |
| Секрети | `bot/.env` (не коміт): `BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ADMIN_IDS` |

---

## Таблиці БД (фактичні)

Усі з RLS + `service_role_all_<table>` policy. Див. `supabase/migrations/`:

- `bot_users` — Telegram-профіль + `lang`
- `courses` — каталог (`slug`, ціна, активність)
- `lessons` — уроки з `media` JSONB (Telegram `file_id`), `text_html`, `order`, `material` flag
- `user_courses` — зв'язок юзер ↔ куплений курс
- `user_lesson_progress` — трекінг прогресу
- `payments` — платежі (спільна з сайтом; `provider` = `monobank` | `wayforpay`)
- `reminders`, `promotions`, `bot_sessions` — службові

---

## Флоу купівлі з бота (стисло)

```
user у боті → «Купити» на курсі
  → bot виклик supabase/functions/create-payment
      • source='bot', provider='monobank'
      • insert payments(status=pending)
      • Mono invoice/create
  → bot надсилає pageUrl користувачу
  → юзер платить → Mono redirect t.me/li_astrology_bot?start=<order_id>
  → bot /start handler підтверджує оплату (через mono-callback уже оновив payments)
  → upsert user_courses → доступ до уроків
```

Деталі, edge-cases, reconcile-логіка — див. `docs/STATUS.md` секція "Payment flow (live)".

---

## Що в боті зроблено / не зроблено

Повний чеклист — у `.claude/dosc/MARKETING_STRATEGY.md` секція 7.
Короткий розріз конкретно бота:

- [x] /start + deep-link активація `?start=<order_id>`
- [x] Каталог курсів + купівля
- [x] Видача уроків (Telegram `file_id` + `protect_content: true`)
- [x] Трекінг прогресу per lesson
- [x] UK/RU локалізація UI (перемикач у Settings)
- [x] Reconcile cron (раз на хвилину, страхує webhook-misses)
- [ ] Nurture-послідовність після Інтенсиву (24ч/48ч/72ч)
- [ ] Upsell з aspekty-basic → aspekty-pro
- [ ] Broadcast / admin-рассилка
- [ ] Промокоди на майбутній повний курс

---

## Історичний контекст

Попередня версія цього документа описувала бота як Edge Function на Deno у Supabase. Від цього відмовились на користь Railway-Node, бо:
1. Long polling простіший за webhook для невеликого навантаження.
2. Railway дає безкоштовний tier + стабільний процесс без холодного старту.
3. Edge Functions використовуються тільки для платежів (`create-payment`, `mono-callback`, `reconcile-payments`).

Також попередня схема згадувала таблиці `telegram_users` / `products` / `purchases`. Фактична схема — `bot_users` / `courses` / `user_courses` / `payments`.
