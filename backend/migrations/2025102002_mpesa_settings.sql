-- Safe migration to ensure mpesa_settings exists with required columns

CREATE TABLE IF NOT EXISTS mpesa_settings (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    short_code      TEXT NOT NULL DEFAULT '',
    passkey         TEXT NOT NULL DEFAULT '',
    consumer_key    TEXT NOT NULL DEFAULT '',
    consumer_secret TEXT NOT NULL DEFAULT '',
    environment     TEXT NOT NULL DEFAULT 'sandbox',
    stk_callback_url        TEXT NOT NULL DEFAULT '',
    c2b_validation_url      TEXT NOT NULL DEFAULT '',
    c2b_confirmation_url    TEXT NOT NULL DEFAULT '',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mpesa_settings ADD COLUMN IF NOT EXISTS short_code TEXT NOT NULL DEFAULT '';
ALTER TABLE mpesa_settings ADD COLUMN IF NOT EXISTS passkey TEXT NOT NULL DEFAULT '';
ALTER TABLE mpesa_settings ADD COLUMN IF NOT EXISTS consumer_key TEXT NOT NULL DEFAULT '';
ALTER TABLE mpesa_settings ADD COLUMN IF NOT EXISTS consumer_secret TEXT NOT NULL DEFAULT '';
ALTER TABLE mpesa_settings ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'sandbox';
ALTER TABLE mpesa_settings ADD COLUMN IF NOT EXISTS stk_callback_url TEXT NOT NULL DEFAULT '';
ALTER TABLE mpesa_settings ADD COLUMN IF NOT EXISTS c2b_validation_url TEXT NOT NULL DEFAULT '';
ALTER TABLE mpesa_settings ADD COLUMN IF NOT EXISTS c2b_confirmation_url TEXT NOT NULL DEFAULT '';
ALTER TABLE mpesa_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

INSERT INTO mpesa_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

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


