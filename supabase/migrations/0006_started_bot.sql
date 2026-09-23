-- Migration 0006: distinguish people who actually started the Telegram bot from
-- learners who only logged in on the website (tg-auth also creates bot_users rows).
--
-- Bot audiences (nurture, inactivity, broadcasts) filter on started_bot_at, so
-- website-only sign-ups get no automatic bot messages (decision D3, 2026-09-14).
-- The bot sets the column on a user's first update; tg-auth never touches it.

BEGIN;

ALTER TABLE bot_users ADD COLUMN IF NOT EXISTS started_bot_at TIMESTAMPTZ;

-- Every existing positive row was created by the bot itself (the only tg-auth
-- row so far is the owner, who also uses the bot).
UPDATE bot_users SET started_bot_at = created_at WHERE id > 0 AND started_bot_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bot_users_started
  ON bot_users(started_bot_at) WHERE started_bot_at IS NOT NULL;

COMMIT;
