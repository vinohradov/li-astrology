-- First-touch attribution for bot users.
-- Set once by the bot on /start (handlers/start.ts → setUserSource):
--   gift:<src>      lead magnet, <src> comes from the /gift/ page UTM or IG bio
--   buy:<slug>      landed on a buy deep-link
--   waitlist        course Pro waitlist
--   cabinet         came from the site cabinet lesson deep-link
--   purchase        came back from a payment redirect
--   direct          plain /start
-- Lets us answer "how many bot users / buyers came from the lead magnet".

ALTER TABLE bot_users ADD COLUMN IF NOT EXISTS source    TEXT;
ALTER TABLE bot_users ADD COLUMN IF NOT EXISTS source_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bot_users_source ON bot_users(source);

-- Handy report: users and buyers per source.
--   select u.source, count(*) users,
--          count(*) filter (where exists (select 1 from user_courses c where c.user_id = u.id)) buyers
--   from bot_users u group by 1 order by 2 desc;
