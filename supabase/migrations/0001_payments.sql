-- Migration: replace liqpay-specific `purchases` with provider-agnostic `payments`
-- Apply in Supabase SQL Editor: https://supabase.com/dashboard/project/plyofinxmwvwbintvqbx/sql
--
-- Preconditions:
--   * `courses` and `bot_users` tables exist (from bot/schema.sql)
--   * `purchases` table is empty (verified before migration)

BEGIN;

DROP TABLE IF EXISTS purchases;

CREATE TABLE payments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  order_id             TEXT UNIQUE NOT NULL,

  provider             TEXT NOT NULL CHECK (provider IN ('wayforpay', 'monobank')),
  provider_order_id    TEXT,

  status               TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'paid', 'failed', 'expired', 'refunded')),

  course_slug          TEXT NOT NULL REFERENCES courses(slug),
  amount               INTEGER NOT NULL,
  currency             TEXT NOT NULL DEFAULT 'UAH',

  telegram_user_id     BIGINT REFERENCES bot_users(id),
  customer_email       TEXT,
  customer_phone       TEXT,
  customer_name        TEXT,

  promo_code           TEXT,
  source               TEXT NOT NULL CHECK (source IN ('web', 'bot')),

  raw                  JSONB,
  paid_at              TIMESTAMPTZ
);

CREATE INDEX idx_payments_order_id      ON payments(order_id);
CREATE INDEX idx_payments_status        ON payments(status);
CREATE INDEX idx_payments_tg_user       ON payments(telegram_user_id);
CREATE INDEX idx_payments_course_slug   ON payments(course_slug);
CREATE INDEX idx_payments_created       ON payments(created_at DESC);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_payments" ON payments
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON payments TO service_role;

COMMIT;

SELECT 'payments schema created, purchases dropped' AS message;
