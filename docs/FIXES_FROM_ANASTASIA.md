# Fixes from Anastasia (chat WORK, 2026-04-13 → 2026-04-22)

Extracted from Telegram export `ChatExport_2026-04-22/result.json`.
Status verified against repo + Supabase DB + the latest commits on `main`.

Legend: ✅ done · ⚠️ partial / needs review · ❌ not done · 🔧 requires manual action outside code

---

## ✅ Done

### F-01 — Remove duplicate ALLCAPS "УРОК N" header inside lessons
**Date:** 2026-04-13 18:32 · **Course:** `astro-z-0`, all lessons
**Asked:** delete the second ALLCAPS «УРОК 11» repetition, keep only «Урок 11: Синтез карти».
**Verified:** DB `lessons` rows for `astro-z-0` show single clean titles (e.g. "Урок 1: Філософія астрології"). No ALLCAPS dups present in `text_html` either.

### F-02 — Final lesson intro before audio podcast
**Date:** 2026-04-13 18:38–18:39 · **Course:** `astro-z-0`, lesson «🎧 Фінал»
**Asked:** add the «И вот мы с вами добрались до финального аккорда…» text before the audio.
**Verified:** `lessons.text_html` on lesson 26 ("🎧 Фінал") contains the exact text Anastasia provided (starts with "И вот мы с вами добрались до финального аккорда нашего обучения ❤️"). See `docs/STATUS.md:65`.

### F-03 — "📚 Література / книги" as separate button after the course
**Date:** 2026-04-13 18:46 · **Course:** `astro-z-0`
**Asked:** book list as a separate message, re-openable any time — NOT stuffed into the final lesson.
**Verified:** `bot/src/content/extras.ts` — `COURSE_EXTRAS['astro-z-0']` with `buttonLabel: '📚 Література / книги'` and the full list. Rendered by `bot/src/handlers/lesson.ts:54-70` via `extras:` callback. Listed in lesson list: `lesson.ts:166-169`.

### F-04 — Rename aspekty-pro lesson 2: «проробка» → «пропрацювання»
**Date:** 2026-04-13 18:56 · **Course:** `aspekty-pro`
**Asked:** title "Компенсаторика і проробка" → "Компенсаторика та пропрацювання" (body text untouched).
**Verified:** DB row — `aspekty-pro` position 2 title is exactly "Компенсаторика та пропрацювання".

### F-05 — Mark methods in aspekty-basic as completable lessons
**Date:** 2026-04-13 19:08 · **Course:** `aspekty-basic`
**Asked:** «Позначити як завершений» button on Самовчитель / Аспекти Сонця / Аспекти особистих планет so progress hits 100%.
**Verified:** DB — all three rows in `aspekty-basic` now have `material=false` (treated as real lessons that contribute to progress). Previously were display-only materials.

### F-06 — Retire 📦 emoji, use content-type icons
**Date:** 2026-04-13 19:18
**Asked:** drop the «коробки» emoji; use 📚 / ✍️ / 🎧 / 📐 / 🎬 / 🎁 / ☀️🌙 per type.
**Verified:** `bot/src/handlers/lesson.ts:149-157` — titles with a leading emoji keep theirs; otherwise fallback icons 🎬/🎧/📄/📚 by `content_type`. 📦 fully removed (zero matches in `bot/src/`, `bot/course-structure/`). STATUS.md:62 confirms.

### F-07 — Website → bot payment flow (no course access after paying)
**Date:** 2026-04-15 20:20
**Asked:** she paid on the website but the bot didn't grant access.
**Verified:** Andrii fixed same evening (chat 20:51 "починил"). Since then multiple successful buys through both web and bot (see reconcile/webhook flow in `supabase/functions/mono-callback` + `reconcile-payments`).

### F-09 — Website full-course page: rewrite text block
**Date:** 2026-04-16 04:25
**Asked:** replace full-course landing copy word-for-word with the new version — new hero subtitle, new «Для кого» 6 cards, new «Навіщо» 3 cards, new program copy + dropped «Як побудувати натальну карту» item, new «Медитації» → «Подкасти» per-item, new «Що ви отримаєте» 4-block section, new author bio, layout preserved.
**Verified:** `web/src/pages/course/index.astro` rewritten in this session. Build green. All new strings present in `dist/course/index.html`.

### F-10 — Language disclaimer on website
**Date:** 2026-04-15 22:29
**Asked:** стипулировать что обучение на русском (видео) при украинском/русском интерфейсе сайта и бота.
**Verified:** Added as FAQ item on `/course/` and as a standalone note section on `/aspekty/` and `/intensiv/`: «Відеоуроки та аудіо-подкасти записані російською мовою. Інтерфейс сайту та Telegram-бота доступний і українською, і російською.»

### F-11 — Pro-tariff feature list cleanup
**Date:** 2026-04-15 22:52
**Decision:** per Anastasia's 04-16 rewrite, Pro tariff = Basic + «Блок "Як консультувати" — 6 модулів». Removed previously-listed Pro features that Anastasia did NOT claim in her new copy: «Зворотний зв'язок від автора», «Сертифікат», «Супровід у роботі з першими клієнтами». Also dropped the two big "Feedback / Certificate" badge blocks at the bottom of the Pro-extras section.
**⚠️ Confirm with Anastasia**: if Pro should still include author feedback / certificate / supervision, revert `proItems` in `web/src/pages/course/index.astro` and restore the badge blocks. Current state follows Anastasia's own 04-16 narrative, but the prior page copy had additional claims that may have been intentional.

### F-08 — Clean chat on navigation ("один экран = один урок")
**Date:** 2026-04-13 17:07 (big UX TZ) + 2026-04-22 14:00 (follow-up on stuck nurture)
**Asked:** when switching lesson/course, old messages (text + media + buttons) disappear; nav never mixes content from two courses.
**Verified:** `bot/src/utils/chat.ts` — `cleanAndSend()` deletes tracked message IDs + edits the callback msg in place. **Just hardened in this session** (commit `4259918`):
- nurture broadcasts are now tracked too (`bot/src/db/sessions.ts` + `send-reminders.ts`)
- after 24h of inactivity, nav is sent as a NEW message at the bottom of the chat instead of being edited into a stale position
**Residual:** Telegram's 48h hard limit on `deleteMessage` in private chats — messages older than 48h cannot be deleted by any bot. Documented in `docs/TODO.md` "Bot chat cleanup — known limits".

---

## ⚠️ Partial / needs review

_(was F-09, F-10, F-11 — all resolved in 2026-04-22 session, see Done section)_

---

## ❌ Not done

### F-12 — Rename lesson 1 in `astro-z-0`: «Медитації» → «Подкасти»
**Date:** 2026-04-13 17:36 ("надо будет заменить название «Медитації» на «Подкасти»")
**Status:** DB row `astro-z-0` position 1 title is still `🎧 Медитації`. Also `intensiv` position 1 is "Подарунки та медитації" (may or may not need renaming — Anastasia's message was specifically about the word "Медитації" as a lesson title, but she didn't specify course → worth confirming).
**Action:** one DB update for astro-z-0, confirm intent for intensiv.

### F-13 — Post-completion nurture for `aspekty-basic` buyers
**Date:** 2026-04-13 15:40 (long Ukrainian message "✨ Мої любі, наше навчання з теми аспектів підійшло до завершення…")
**Asked:** when an aspekty-basic student finishes all lessons, bot sends a message congratulating + pitching the full course, with a CTA button.
**Status:** not implemented. `bot/src/content/nurture.ts` only has INTENSIV_NURTURE_STEPS and COLD_NURTURE_STEPS. No on-completion trigger exists for aspekty-basic. The scheduler (`bot/src/jobs/nurture.ts`) is purely date-based, not event-based.
**Action:** decide — event trigger on last-lesson-completed, or time-based 3-day nurture after purchase? Anastasia's text is ready, just needs plumbing.

### F-14 — Rename bot: «Астрологія з 0 | навчання»
**Date:** 2026-04-13 15:50
**Asked:** change bot display name (not username) to "Астрологія з 0 | навчання" — so it reads as a product, not as "li_astrology_bot".
**Status:** bot's public name is set via @BotFather, not in code. Unchanged (bot still reads as "li_astrology" per nurture screenshots).
🔧 **Action (manual):** @BotFather → `/mybots` → pick bot → Edit Name → "Астрологія з 0 | навчання".

### F-15 — Upload bot avatar
**Date:** 2026-04-15 22:24
**Asked:** use the brand circle symbol as bot avatar.
**Status:** avatar file prepared at `brand/li-bot-avatar-512.png` (per `docs/TODO.md`). Not uploaded yet.
🔧 **Action (manual):** @BotFather → `/mybots` → Edit Bot → Edit Botpic → upload `brand/li-bot-avatar-512.png`.

---

## Non-fix content (context, not action items)

- 2026-04-13 16:00–17:10 — long discussion about "один-диалог-на-курс vs навигация-в-одном-боте" UX. Anastasia initially preferred separate channels per course (a-la Матриця Долі). Andrii pushed back with "навигация удобнее для большинства", then Anastasia reversed after seeing the cleaned bot: "классно получилось… по структуре бота вопросов почти нет" (17:35–17:37). **Outcome:** no product change needed — bot-as-LMS model confirmed.
- 2026-04-22 14:26 — Anastasia got 2 nurture messages at once (D+1 and D+3). Root cause documented in `docs/TODO.md` "Nurture scheduler — known quirks": retroactive firing for users who bought before the nurture rule was added. Not urgent — only affects existing paid users, new buyers land on a clean timeline.

---

## Suggested next batch

Remaining after 2026-04-22 session:
1. **F-12** — rename DB `astro-z-0` lesson 1 "🎧 Медитації" → "🎧 Подкасти" (1 DB update). Note: landing page already renamed to «Подарунки: аудіо-подкасти».
2. **F-14 + F-15** 🔧 — @BotFather: rename to «Астрологія з 0 | навчання» + upload `brand/li-bot-avatar-512.png`.
3. **F-13** — post-completion trigger for aspekty-basic buyers (event-driven, not date-driven; Anastasia's Ukrainian text ready in chat export).
4. **F-11 confirm** — ask Anastasia whether Pro should explicitly include feedback / certificate / supervision (currently dropped in favour of her clean "Pro = 6-module Як консультувати block" narrative).
