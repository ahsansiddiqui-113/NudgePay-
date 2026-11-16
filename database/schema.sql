-- NudgePay schema (PostgreSQL 14+)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                  TEXT NOT NULL UNIQUE,
  password_hash          TEXT NOT NULL,
  business_name          TEXT,
  reply_to_email         TEXT,                       -- Pro: custom Reply-To
  plan                   TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  paddle_customer_id     TEXT,
  paddle_subscription_id TEXT,
  subscription_status    TEXT,
  reminder_days          INTEGER[] NOT NULL DEFAULT '{1,7,14}', -- Pro: custom schedule
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_name    TEXT NOT NULL,
  client_email   TEXT NOT NULL,
  invoice_number TEXT,
  amount_cents   BIGINT NOT NULL CHECK (amount_cents > 0),
  currency       CHAR(3) NOT NULL DEFAULT 'USD',
  due_date       DATE NOT NULL,
  payment_link   TEXT,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid', 'cancelled')),
  paused         BOOLEAN NOT NULL DEFAULT FALSE,
  reminders_sent INTEGER NOT NULL DEFAULT 0,
  last_nudge_at  TIMESTAMPTZ,
  paid_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_user_status ON invoices (user_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_worker ON invoices (due_date) WHERE status = 'active' AND paused = FALSE;

-- One row per sent reminder. UNIQUE(invoice_id, stage) makes the worker idempotent.
CREATE TABLE IF NOT EXISTS reminder_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  stage       INTEGER NOT NULL,        -- index into the user's reminder_days
  tone        TEXT NOT NULL,           -- gentle | firm | final
  provider_id TEXT,                    -- Resend message id
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, stage)
);

-- Pro: custom tone templates, one per tone per user.
CREATE TABLE IF NOT EXISTS email_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tone       TEXT NOT NULL CHECK (tone IN ('gentle', 'firm', 'final')),
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tone)
);

-- Paddle webhook idempotency.
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id    TEXT PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
