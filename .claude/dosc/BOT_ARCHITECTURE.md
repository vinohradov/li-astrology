# Архитектура Telegram-бота (LMS System)
> Документация по устройству, базе данных и логике работы обучающего бота Li Astrology.

## 🏗 Архитектура
Бот работает на **Supabase Edge Functions** (Deno/TypeScript) в режиме Serverless Webhook.
База данных: **PostgreSQL** (Supabase).

### Стек
- **Runtime:** Deno
- **Framework:** `grammy` (легкий и мощный фреймворк для Telegram ботов)
- **Database:** Supabase (postgres)
- **Hosting:** Supabase Edge Functions

---

## 🗄 База Данных (Schema)

### 1. `telegram_users`
Профиль пользователя в Телеграм.
- `id` (bigint, PK): Telegram User ID.
- `first_name` (text): Имя.
- `username` (text): Юзернейм (@...).
- `created_at` (timestamp): Дата первого входа.
- `language_code` (text): Язык интерфейса (uk/ru).

### 2. `products`
Список продуктов (Интенсив, Аспекты и т.д.).
- `id` (text, PK): Код продукта (напр. 'intensiv', 'aspekty_pro').
- `name` (text): Название.
- `description` (text): Описание.

### 3. `purchases`
Журнал покупок. Связывает юзера и продукт.
- `id` (uuid, PK)
- `user_id` (bigint, FK -> telegram_users.id)
- `product_id` (text, FK -> products.id)
- `created_at` (timestamp)
- `amount` (numeric): Сумма покупки (для аналитики).

### 4. `lessons`
Учебные материалы.
- `id` (serial, PK)
- `course_id` (text, FK -> products.id): К какому курсу относится.
- `module_id` (text): Для группировки (например "Модуль 1").
- `title` (text): Название урока.
- `description` (text): Текст сообщения.
- `video_file_id` (text): ID файла в Telegram (для нативной отправки).
- `attachment_url` (text): Ссылка на методичку (опционально).
- `order_index` (int): Порядок сортировки.

---

## 🔄 Логика работы (User Flows)

### 1. Вход после покупки (Deep Linking)
1.  Пользователь нажимает "Открыть Telegram" на сайте.
2.  Ссылка: `t.me/bot?start=intensiv_ORDER123`.
3.  **Бот:**
    *   Парсит параметр `start`.
    *   Проверяет `ORDER123` в таблице заказов сайта (или сразу активирует, если мы доверяем ссылке).
    *   Создает запись в `purchases` (если нет).
    *   Шлет: "Добро пожаловать на Интенсив! 👇".
    *   Открывает доступ к меню Интенсива.

### 2. Просмотр уроков
1.  Пользователь жмет кнопку **"📚 Мои уроки"**.
2.  **Бот:**
    *   Смотрит в таблицы `purchases`, какие курсы куплены.
    *   Если куплен только Интенсив -> Сразу показывает список уроков Интенсива.
    *   Если куплено несколько -> Показывает выбор курса.
3.  Пользователь выбирает Урок 1.
4.  **Бот:**
    *   Берет `video_file_id` из базы.
    *   Шлет видео (защищенное от пересылки).

### 3. Апселл (Воронка)
1.  Бот имеет фоновый процесс (или триггер), который проверяет "старых" пользователей Интенсива.
2.  Шлет сообщение: "Ты прошел Интенсив, держи скидку на Аспекты".
3.  Кнопка [Купить Аспекты] -> Ссылка на оплату.

---

## ✅ Статус разработки

### База Данных
- [ ] Таблицы созданы.
- [ ] RLS (Security) настроены.

### Функционал Бота
- [ ] Подключение к Telegram (Webhook).
- [ ] Команда `/start` (регистрация юзера).
- [ ] Обработка Deep Link (активация курса).
- [ ] Меню "Мои уроки" (динамическое).
- [ ] Админка (загрузка видео через чат с ботом).

### Инфраструктура
- [ ] Edge Function деплой.
- [ ] Секреты (Bot Token) добавлены в Supabase.

---

## 🛠 Команды Админа (Скрытые)
- `/admin_upload` - Режим загрузки контента. Бот присылает `file_id` любого отправленного ему видео.
- `/broadcast` - Рассылка по всем юзерам.

---

## 🚀 Как запустить (Deploy)
```bash
# 1. Логин в CLI
supabase login

# 2. Деплой базы (миграции)
supabase db push

# 3. Деплой функции
supabase functions deploy bot --no-verify-jwt

# 4. Установка вебхука
curl -F "url=https://PROJECT_REF.supabase.co/functions/v1/bot" https://api.telegram.org/bot<TOKEN>/setWebhook
```
