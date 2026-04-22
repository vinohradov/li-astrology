-- Waitlist for pre-launch products (e.g. astro-z-0-pro tariff).
-- The bot inserts a row when a user triggers a waitlist deep-link.
-- When the product launches, a broadcast iterates list_slug=<slug> and
-- marks notified_at to avoid sending twice.

CREATE TABLE IF NOT EXISTS bot_waitlist (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id  BIGINT NOT NULL REFERENCES bot_users(id) ON DELETE CASCADE,
  list_slug         TEXT NOT NULL,
  source            TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  notified_at       TIMESTAMPTZ,
  UNIQUE (telegram_user_id, list_slug)
);

CREATE INDEX IF NOT EXISTS idx_bot_waitlist_list_pending
  ON bot_waitlist(list_slug) WHERE notified_at IS NULL;

ALTER TABLE bot_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_bot_waitlist"
  ON bot_waitlist FOR ALL USING (true) WITH CHECK (true);

-- Index to speed up nurture dedup (one reminder per user-per-type).
CREATE INDEX IF NOT EXISTS idx_reminders_user_type
  ON reminders(user_id, type);
