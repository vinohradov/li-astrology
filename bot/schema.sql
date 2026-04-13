-- Li Astrology Bot — Database Schema
-- Run in Supabase SQL Editor alongside existing schema

-- Bot users (every Telegram user who starts the bot)
CREATE TABLE IF NOT EXISTS bot_users (
  id            BIGINT PRIMARY KEY,
  first_name    TEXT,
  last_name     TEXT,
  username      TEXT,
  phone         TEXT,
  email         TEXT,
  lang          TEXT DEFAULT 'uk',
  created_at    TIMESTAMPTZ DEFAULT now(),
  last_active   TIMESTAMPTZ DEFAULT now(),
  blocked_bot   BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_bot_users_last_active
  ON bot_users(last_active) WHERE blocked_bot = false;

-- Courses
CREATE TABLE IF NOT EXISTS courses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  price_uah   INTEGER NOT NULL,
  sort_order  SMALLINT DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Lessons (imported from Telegram channel exports)
CREATE TABLE IF NOT EXISTS lessons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position      SMALLINT NOT NULL,
  title         TEXT NOT NULL,
  content_type  TEXT NOT NULL,
  text_html     TEXT,
  media         JSONB DEFAULT '[]',
  tg_message_id BIGINT,
  is_free_preview BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, position)
);

CREATE INDEX IF NOT EXISTS idx_lessons_course_pos
  ON lessons(course_id, position);

-- User course access (purchases)
CREATE TABLE IF NOT EXISTS user_courses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      BIGINT NOT NULL REFERENCES bot_users(id),
  course_id    UUID NOT NULL REFERENCES courses(id),
  purchased_at TIMESTAMPTZ DEFAULT now(),
  expires_at   TIMESTAMPTZ,
  payment_id   TEXT,
  amount_paid  INTEGER,
  UNIQUE(user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_user_courses_user
  ON user_courses(user_id);

-- Lesson progress
CREATE TABLE IF NOT EXISTS user_lesson_progress (
  user_id      BIGINT NOT NULL REFERENCES bot_users(id),
  lesson_id    UUID NOT NULL REFERENCES lessons(id),
  completed    BOOLEAN DEFAULT false,
  opened_at    TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_progress_user
  ON user_lesson_progress(user_id);

-- Reminders queue
CREATE TABLE IF NOT EXISTS reminders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      BIGINT REFERENCES bot_users(id),
  type         TEXT NOT NULL,
  payload      JSONB NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at      TIMESTAMPTZ,
  failed       BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reminders_pending
  ON reminders(scheduled_at) WHERE sent_at IS NULL AND failed = false;

-- Promotions / discounts
CREATE TABLE IF NOT EXISTS promotions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT UNIQUE,
  course_id     UUID REFERENCES courses(id),
  discount_pct  SMALLINT,
  discount_abs  INTEGER,
  valid_from    TIMESTAMPTZ DEFAULT now(),
  valid_until   TIMESTAMPTZ,
  max_uses      INTEGER,
  times_used    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- grammY session storage
CREATE TABLE IF NOT EXISTS bot_sessions (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

-- RLS: all tables accessed via service_role only
ALTER TABLE bot_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_sessions ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'bot_users','courses','lessons','user_courses',
    'user_lesson_progress','reminders','promotions','bot_sessions'
  ])
  LOOP
    EXECUTE format('CREATE POLICY "service_role_all_%s" ON %I FOR ALL USING (true) WITH CHECK (true)', tbl, tbl);
  END LOOP;
END $$;

-- Seed courses
INSERT INTO courses (slug, title, description, price_uah, sort_order) VALUES
  ('intensiv', 'Інтенсив "Астрологія з 0"', 'Твій легкий перший крок у світ астрології', 119900, 1),
  ('aspekty', 'Алгоритм трактування аспектів', 'Поглиблений курс для практикуючих астрологів', 129000, 2),
  ('basic', 'Курс Basic', 'Базовий курс астрології', 600000, 3),
  ('advanced', 'Курс Advanced', 'Просунутий курс для професіоналів', 1250000, 4)
ON CONFLICT (slug) DO NOTHING;

SELECT 'Bot schema created successfully!' as message;
