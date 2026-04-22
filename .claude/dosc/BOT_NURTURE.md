# Bot Nurture + Waitlist

> Оновлено 2026-04-22. Код: `bot/src/content/nurture.ts`, `bot/src/jobs/nurture.ts`, `bot/src/db/waitlist.ts`, `bot/src/handlers/start.ts`.

---

## Огляд

Дві паралельні nurture-послідовності:

| Послідовність | Кого ловить | Анкер дати | Ціль конверсії | Reminder type | Кроки |
|---|---|---|---|---|---|
| **Intensiv → Full Course** | Купив Інтенсив, НЕ купив `astro-z-0` | `user_courses.purchased_at` | Повний курс 6000 грн | `nurture_day<N>` | 1 / 3 / 7 / 14 |
| **Cold → Intensiv** | Зайшов у бот, нічого не купив, `created_at` ≤ 30 днів | `bot_users.created_at` | Інтенсив 1199 грн | `cold_nurture_day<N>` | 1 / 3 / 7 |

Обидві запускаються одним cron-тіком у `scheduler.ts` через функцію `checkNurture()`, яка викликає `runSequence()` для кожної. Доставка — через існуючий pipeline `reminders` (send-reminders кожну хвилину).

Dedup: для кожного користувача проти `reminders.type` — один крок відправляється тільки раз.

**Перехід між послідовностями:**
1. Незнайомець робить /start → потрапляє у **Cold**. Отримує день 1, 3, 7.
2. Купує Інтенсив посередині (скажімо, у день 4 від /start) → наступні Cold-кроки пропускаються (фільтр `user_courses.count = 0`).
3. Через день 1 після купівлі Інтенсиву стартує **Intensiv**-послідовність.
4. Якщо купує повний курс — Intensiv-послідовність теж припиняється (фільтр `astro-z-0 not in user_courses`).

---

## 1. Intensiv-nurture (покупці Інтенсиву → повний курс)

### Мета

Через 1/3/7/14 днів після оплати Інтенсиву бот шле 4 повідомлення, які:
1. Тримають людину залученою (день 1).
2. Дають цінність + натяк на глибину (день 3).
3. Явно показують різницю Інтенсив → повний курс (день 7).
4. Прямий CTA на купівлю повного курсу `astro-z-0` за 6000 грн (день 14).

Ціль воронки — підняти 30-day LTV покупця Інтенсиву за рахунок конверсії у повний курс.

Масив: `INTENSIV_NURTURE_STEPS` у `bot/src/content/nurture.ts`.

### Як це працює технічно

1. **Cron `checkNurture`** у `bot/src/jobs/nurture.ts` запускається **щогодини** (о :15 хв), див. `scheduler.ts`. Він всередині викликає `runSequence()` по черзі для Intensiv + Cold.
2. **Intensiv-частина** (`fetchIntensivBuyers`): усі покупці Інтенсиву (`user_courses` JOIN `bot_users`, не заблоковані). Для кожного — виключаємо тих, хто вже купив `astro-z-0`.
3. Для кожного кандидата:
    - Обчислити age = days since `user_courses.purchased_at`.
    - Для кожного `INTENSIV_NURTURE_STEPS[i]` (де `day <= age`):
        - Перевірити, чи немає вже запису в `reminders` з `type='nurture_day<N>'` для цього user_id (дедуп).
        - Якщо немає — створити `reminder` з локалізованим текстом і (опціонально) URL-кнопкою.
4. Далі існуючий `send-reminders` cron (1 раз на хвилину) забирає reminder і шле повідомлення через Telegram API.
5. Якщо користувач заблокував бота — `send-reminders` позначає `bot_users.blocked_bot=true`, наступні nurture-кандидати фільтруються.

### Як змінити контент

Відредагуй `bot/src/content/nurture.ts` — масив `INTENSIV_NURTURE_STEPS` (для цієї послідовності). Кожен елемент:

```typescript
{
  day: 3,
  textUk: (name) => `...`,
  textRu: (name) => `...`,
  button?: {
    labelUk: '...',
    labelRu: '...',
    url: 'https://...',
  },
}
```

- `day` — через скільки днів слати.
- `textUk` / `textRu` — функції, що повертають текст. `name` — first_name користувача.
- `button` — опційна URL-кнопка. Для чистих engagement-повідомлень (день 1) не потрібна.

**Важливо:** якщо додаш **новий** крок (наприклад, `day: 5`), він автоматично почне слатися тільки новим покупцям — існуючі покупці отримають нові повідомлення, якщо їхній age ≥ N і reminder з типом `nurture_day5` ще не створювався для них (дедуп по user+type).

Якщо **видаляєш** крок — просто видали елемент з масиву. Старі reminders, які вже в черзі, відправляться, але нові — ні.

Якщо **переписуєш текст** на вже існуючому кроці — зміниться тільки для тих, кому ще не відправляли (reminder не створювався). Для тих, хто вже отримав — лишиться старий текст (уже у `reminders.payload.text`).

### Як зупинити серію для конкретного користувача

Одна з двох опцій:
1. Видалити всі pending reminders: `DELETE FROM reminders WHERE user_id=<id> AND type LIKE 'nurture_%' AND sent_at IS NULL`.
2. Поставити псевдо-запис, який дедуп врахує: `INSERT INTO reminders (user_id, type, payload, scheduled_at, sent_at) VALUES (<id>, 'nurture_day14', '{"text":""}', now(), now())`.

### Як глобально вимкнути серію

В `bot/src/jobs/scheduler.ts` закоментувати блок `cron.schedule('15 * * * *', ...)` для nurture. Pending reminders продовжать відправлятись доки не закінчаться.

Або швидше — очистити `NURTURE_STEPS = []` у content/nurture.ts і задеплоїти.

### Поточна серія (Intensiv → повний курс)

| Day | Кнопка | URL | Сенс |
|---|---|---|---|
| 1 | — | — | Engagement — питання про стихії |
| 3 | «Подивитись програму курсу» | `/course/` | Освітній bonus + soft mention курсу |
| 7 | «Перейти до курсу» | `/course/` | Явний pitch: Інтенсив = 10%, курс = 100% |
| 14 | «Придбати 6 000 грн» | `t.me/bot?start=buy_astro-z-0` | Direct CTA — пряма покупка в боті |

---

## 2. Cold-nurture (зайшов у бот, нічого не купив → Інтенсив)

### Мета

Через 1/3/7 днів після `/start` бот шле 3 повідомлення для тих, хто подивився на бота, але не зробив жодної купівлі. Ціль — конверсія у tripwire-продукт (Інтенсив 1199 грн), не в повний курс — це холодна аудиторія, не готова одразу до 6000.

Масив: `COLD_NURTURE_STEPS` у `bot/src/content/nurture.ts`.

### Аудиторія + фільтри

`fetchColdUsers()` у `jobs/nurture.ts`:
1. `bot_users.blocked_bot = false`.
2. `bot_users.created_at >= NOW() - 30 днів` — **MAX_AGE cutoff**. Користувачів, які реєструвались давно і нічого не робили, не будемо бомбити новими повідомленнями.
3. `user_id` НЕ присутній у `user_courses` — тобто жодної покупки. Якщо зробили хоча б одну — вони автоматично виходять з Cold і потрапляють або у Intensiv-nurture (якщо купили Інтенсив), або просто перестають отримувати повідомлення.

### Чому саме 3 кроки, а не 4

Холодна аудиторія — найшвидше блокує бота при переспамі. 3 повідомлення — збалансовано: дати шанс, не бути настирливим. Останнє повідомлення (день 7) явно говорить «після цього я більше не пишу» — зменшує шанс, що користувач заблокує бота. Далі, якщо людина колись захоче, вона сама поверне.

### Поточна серія (Cold → Інтенсив)

| Day | Кнопка | URL | Сенс |
|---|---|---|---|
| 1 | «Каталог курсів» | `t.me/bot?start=catalog` | Engagement — «Сонце це 10% карти» |
| 3 | «Дивитись Інтенсив» | `/intensiv/` | Інсайт про доми + soft pitch Інтенсиву |
| 7 | «Спробувати Інтенсив — 1 199 грн» | `t.me/bot?start=buy_intensiv` | Фінальне звернення — direct CTA + «якщо ні — більше не писатиму» |

### Як змінити контент

Так само як для Intensiv-nurture — редагуй `COLD_NURTURE_STEPS` у `bot/src/content/nurture.ts`.

### Як зупинити серію для конкретного користувача

`DELETE FROM reminders WHERE user_id=<id> AND type LIKE 'cold_nurture_%' AND sent_at IS NULL` — видалити pending. АБО додати pseudo-sent записи для кожного кроку, якщо потрібно заблокувати майбутні сценарії:
```sql
INSERT INTO reminders (user_id, type, payload, scheduled_at, sent_at)
VALUES (<id>, 'cold_nurture_day1', '{"text":""}', now(), now()),
       (<id>, 'cold_nurture_day3', '{"text":""}', now(), now()),
       (<id>, 'cold_nurture_day7', '{"text":""}', now(), now());
```

### Зв'язок Cold ↔ Intensiv послідовностей

Якщо користувач купує Інтенсив посеред Cold-серії — наступні Cold-кроки вимикаються автоматично (`user_courses.count > 0` filter). З наступного `/start + 1 day` стартує Intensiv-nurture. Немає конфлікту, немає дублів.

Приклад хронології:
```
T+0    /start
T+1    cold_nurture_day1 ✉️
T+3    cold_nurture_day3 ✉️
T+4    купує Інтенсив
T+5    cold_nurture_day7 — пропущено (більше не cold)
T+5    nurture_day1 ✉️ (інтенсив + 1 день)
T+7    nurture_day3 ✉️
...
```

---

## 3. Waitlist (зараз тільки для Pro-тарифу повного курсу)

### Навіщо

Лендинг `/course/` продає basic-тариф (6000) напряму, а pro-тариф (12500) — у waitlist-mode до моменту, поки не буде знято блок «Як консультувати» (~2 місяці). Кнопки "Лист очікування" на сайті шлють у бота з payload `waitlist_course`.

### Як це працює

1. Користувач на `/course/` натискає «Лист очікування» (hero — не має її тепер; тільки Pro-картка і mobile sticky ведуть на waitlist).
2. Відкривається `t.me/li_astrology_bot?start=waitlist_course`.
3. `handlers/start.ts` ловить payload `waitlist_course`:
    - Викликає `addToWaitlist({userId, listSlug: 'astro-z-0-pro', source: 'course_landing'})`.
    - Insert у `bot_waitlist` (UNIQUE на (user_id, list_slug) — ідемпотентно).
    - Шле confirmation повідомлення + кнопки «Каталог» / «Головне меню».

### Структура `bot_waitlist`

```sql
id                UUID PRIMARY KEY
telegram_user_id  BIGINT → bot_users.id (cascade)
list_slug         TEXT              -- наразі 'astro-z-0-pro'
source            TEXT NULL         -- 'course_landing' | 'bot_nurture' | ...
created_at        TIMESTAMPTZ
notified_at       TIMESTAMPTZ NULL  -- виставляється коли broadcast виконаний
UNIQUE (telegram_user_id, list_slug)
```

### Як зробити розсилку коли Pro запуститься

Варіанти:
- Швидко: admin-команда `/broadcast_waitlist <list_slug> <text>` — пройти по `bot_waitlist` WHERE list_slug=X AND notified_at IS NULL, поставити reminder для кожного, set notified_at=now().
- Acurate: скрипт `scripts/broadcast-waitlist.ts` — аналогічно, але з підтвердженням кількості, rate-limit тощо.

Admin-команда зараз не реалізована. Додамо коли ближче до запуску Pro.

### Як додати нові waitlist'и в майбутньому

Нова точка входу → новий `listSlug` + (опційно) новий payload. Наприклад, якщо колись Інтенсив закриємо і почнемо набирати у waitlist:

```typescript
// handlers/start.ts
if (payload === 'waitlist_intensiv') {
  await addToWaitlist({ userId, listSlug: 'intensiv-v2', source: 'intensiv_landing' });
  ...
}
```

Таблиця і логіка універсальні по `list_slug`.

---

## 4. Перетин nurture ↔ waitlist

Зараз не перетинаються.
Intensiv-nurture веде на покупку basic-тарифу курсу (`buy_astro-z-0`), НЕ на waitlist Pro-тарифу. Це навмисно: основна маса людей після Інтенсиву не готова до 12 500 грн і питанням "чекати чи ні".

Cold-nurture веде на Інтенсив (1199), теж не у waitlist — щоб не плутати холодну аудиторію.

Waitlist-підписники **не виключаються** з Cold-nurture. Якщо хтось підписався на waitlist Pro-тарифу, але ще нічого не купив — Cold-nurture все одно спробує продати йому Інтенсив. Це свідома поведінка: waitlist — це інтерес до Pro (12500), а Cold пропонує доступний вхід (1199), це два різних продукти.

Якщо колись захочемо додати крок nurture що веде у Pro-waitlist — просто додати `INTENSIV_NURTURE_STEPS[i]` з кнопкою на `waitlist_course` payload.

---

## 5. Чек-лист перед запуском реклами

- [ ] SQL міграція `0002_waitlist_and_nurture.sql` застосована в Supabase (див. `supabase/migrations/`).
- [ ] Бот задеплоєний з новим кодом (Railway автоматично перебудує після `git push`).
- [ ] Перевірити: в логах бота є рядок `Scheduler started: ... nurture (1h)`.
- [ ] Тест waitlist: зайти по `https://t.me/li_astrology_bot?start=waitlist_course` — має прийти confirmation + кнопки.
- [ ] Тест Intensiv-nurture: створити фейковий user_courses row зі старою `purchased_at` (наприклад, 2 дні тому) + intensiv course_id → через годину-дві має з'явитись reminder з type='nurture_day1' → в наступну хвилину — повідомлення.
- [ ] Тест Cold-nurture: створити бот-юзера з `created_at` 2 дні тому (або дочекатись реального /start від тест-аккаунту без покупок) → наступний tick nurture-cron має створити reminder з type='cold_nurture_day1'.
- [ ] Перевірити, що adminIDs отримують помилки, якщо щось впаде (error-handler middleware).
