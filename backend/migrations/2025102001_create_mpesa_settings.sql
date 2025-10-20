-- M-Pesa (Daraja) settings storage
-- A single-row table to hold current Daraja configuration

CREATE TABLE IF NOT EXISTS mpesa_settings (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    short_code      TEXT NOT NULL DEFAULT '',
    passkey         TEXT NOT NULL DEFAULT '',
    consumer_key    TEXT NOT NULL DEFAULT '',
    consumer_secret TEXT NOT NULL DEFAULT '',
    environment     TEXT NOT NULL DEFAULT 'sandbox', -- 'sandbox' | 'production'
    stk_callback_url        TEXT NOT NULL DEFAULT '',
    c2b_validation_url      TEXT NOT NULL DEFAULT '',
    c2b_confirmation_url    TEXT NOT NULL DEFAULT '',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure the singleton row exists
INSERT INTO mpesa_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'mpesa_settings_set_updated_at'
  ) THEN
    CREATE TRIGGER mpesa_settings_set_updated_at
    BEFORE UPDATE ON mpesa_settings
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
  END IF;
END $$;


