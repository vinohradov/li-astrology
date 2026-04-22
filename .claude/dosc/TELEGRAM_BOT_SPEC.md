# Telegram Bot Spec: Li Astrology LMS
> Single bot (@li_astrology_bot) serving all courses as a full learning management system.
>
> **Status (2026-04-22): спецификация в значительной степени реализована.**
> Актуальная реализация — `bot/` (grammY + Node + TS, Railway). Для текущего состояния см. `docs/STATUS.md` и `.claude/dosc/BOT_ARCHITECTURE.md`.
> Этот документ сохраняется как design-спека (замысел + flows). Расхождения с фактической реализацией отмечены ниже.

---

## Architecture Decision

**Model: Bot-as-LMS** (not channel-based) — ✅ реализовано
- Bot delivers lessons directly in chat (video + PDF + text)
- Progress tracking per student per lesson
- One bot for all courses — student sees only what they purchased
- No external video hosting — files stored on Telegram CDN via `file_id`

**Отличия от исходной спеки → фактической реализации:**
- Runtime: изначально планировался Deno/Supabase Edge Functions → **факт: Node.js + grammY на Railway** (long polling, не webhook).
- Таблицы: `telegram_users` / `products` / `purchases` (спека) → **факт: `bot_users` / `courses` / `user_courses` / `payments`**.
- Платёжка: LiqPay (спека) → **факт: Mono как основной, LiqPay удалён**.
- Слаг `kurs-aspekty` (спека) → **факт: два отдельных SKU `aspekty-basic` (1290 грн) и `aspekty-pro` (2790 грн)**.
- Full course (`course-basic` / `course-advanced` в спеке) → **факт: `astro-z-0` / `astro-z-0-pro`, coming-soon, лендинга пока нет**.

---

## Content Setup (One-time, Admin)

1. Export existing Telegram channels via Telegram Desktop → Export chat history (Videos + Files + Photos)
2. Run setup script: uploads each video/PDF to Telegram via admin command → bot replies with `file_id`
3. Store in `lessons` table: title, order, `video_file_id`, `pdf_file_id`, `course_id`

---

## Database Schema (additions needed)

### `telegram_users`
- `id` (bigint PK) — Telegram User ID
- `first_name` (text)
- `username` (text)
- `language_code` (text) — uk/ru
- `created_at` (timestamp)

### `lessons`
- `id` (serial PK)
- `course_id` (text FK → products.id)
- `title` (text)
- `description` (text)
- `video_file_id` (text) — Telegram file_id
- `pdf_file_id` (text) — optional
- `order_index` (int)

### `lesson_progress`
- `user_id` (bigint FK → telegram_users.id)
- `lesson_id` (int FK → lessons.id)
- `completed_at` (timestamp)

---

## User Flows

### Flow 1: Purchase → First Access
```
Student pays on li-astrology.com.ua (or inside bot)
  → Mono webhook → mono-callback Edge Function verifies and stores payment
  → Success page (web): [Відкрити в Telegram]
  → t.me/li_astrology_bot?start={order_id}
  → Bot: looks up payments by order_id, confirms status=paid
  → Bot: upserts bot_users record
  → Bot: upserts user_courses (user ↔ course access)
  → Bot: sends welcome + [До курсу] button
```

### Flow 2: Lesson Navigation
```
[До курсу] or /menu
  → If 1 course: show lesson list directly
  → If 2+ courses: show course selector first

Course selector (multi-purchase):
  [📘 Інтенсив  2/5 ✅]
  [📗 Аспекти   0/8  ]

Lesson list:
  📚 Інтенсив — Основи астрології
  Прогрес: ████░░░░░░ 2/5 уроків
  ─────────────────────
  ✅ Урок 1 — Філософія астрології
  ✅ Урок 2 — Знаки Зодіаку
  ▶️ Урок 3 — Натальна карта
  ⬜ Урок 4 — Сонце і Місяць
  ⬜ Урок 5 — Особисті планети
  ─────────────────────
  [▶️ Продовжити навчання]
```

### Flow 3: Lesson View
```
📖 Урок 3 — Натальна карта

<description text>

[▶️ Дивитися відео]  [📄 Методичка]

[← Назад]  [✅ Урок пройдено →]
```
- Bot sends video natively (Telegram file_id)
- PDF sent as document if exists
- "Урок пройдено" — manually marked by student → updates lesson_progress

### Flow 4: Upsell (automated)
```
Student completes Intensiv
  → Bot: "Готова йти далі? Тримай знижку на Аспекти 👇"
  → [Купити Аспекти →] (link to /kurs-aspekty/)

Student completes Aspects purchase
  → Bot generates promo code: LI-{base64(1290)}-{HMAC}
  → Bot: "Твій промокод на знижку 1 290 грн на повний курс: LI-XXXXX"
  → [Дізнатися про повний курс →] (link to /course/)
```

---

## Bot Commands & Menus

| Trigger | Action |
|---------|--------|
| `/start` | Welcome message (no access yet) |
| `/start {order_id}` | Verify purchase, activate course, show welcome |
| `/menu` or [📚 Мої курси] | Show course list / lesson list |
| Lesson button | Show lesson with video + PDF |
| [✅ Урок пройдено] | Mark lesson complete, show next |
| [▶️ Продовжити] | Jump to next incomplete lesson |

### Admin Commands (hidden)
| Command | Action |
|---------|--------|
| `/admin_upload` | Bot echoes `file_id` of any video/file sent to it |
| `/broadcast {message}` | Send message to all users |

---

## Multi-Course Access Logic

```
Bot checks purchases table for this telegram_user_id
  → 1 active course  → go directly to lesson list
  → 2+ active courses → show course selector menu
  → 0 courses        → "Придбай курс на li-astrology.com.ua"
```

Courses map to slugs (live + coming-soon):
- `intensiv` → 5 lessons (LIVE)
- `aspekty-basic` → 3 PDFs (LIVE; PDFs сейчас считаются как lessons с `material=false`)
- `aspekty-pro` → basic + видео-разборы (LIVE)
- `astro-z-0` → 12 lessons + bonus (coming-soon, нет лендинга)
- `astro-z-0-pro` → 12 lessons + bonus + feedback + certificate (coming-soon)

---

## Content Population Plan

1. Export each Telegram channel (Intensiv, Aspects, Full Course)
2. Review `export_results.json` — map messages to lesson structure
3. Run admin upload script — get `file_id` for each video/PDF
4. Populate `lessons` table with correct `order_index` and `course_id`

---

## Tech Stack

- **Runtime:** Deno (Supabase Edge Functions)
- **Framework:** grammy
- **Database:** Supabase PostgreSQL
- **Hosting:** Supabase Edge Functions (webhook mode)
- **Files:** Telegram CDN (via file_id — no external hosting)
- **Languages:** Ukrainian (primary), Russian (based on language_code)

---

## Open Questions

- [ ] How many lessons does each course have? (confirm after content export)
- [ ] Does Aspects course have PDFs/methodologies?
- [ ] Upsell trigger: after last lesson completed, or after X days?
- [ ] course-advanced feedback flow — how does student submit homework? (separate channel? direct message to admin?)
- [ ] Should progress reset be possible? (e.g. if student wants to replay)
