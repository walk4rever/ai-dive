-- Signals schema update:
-- 1) Rename date -> signal_date for business event date
-- 2) Add updated_at with auto-update trigger
-- 3) Keep created_at for ingestion time, add indexes

ALTER TABLE ai_pulse_signals
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE ai_pulse_signals
  RENAME COLUMN date TO signal_date;

ALTER TABLE ai_pulse_signals
  ALTER COLUMN signal_date SET DEFAULT (timezone('Asia/Shanghai', now()))::date;

DROP TRIGGER IF EXISTS ai_pulse_signals_updated_at ON ai_pulse_signals;
CREATE TRIGGER ai_pulse_signals_updated_at
  BEFORE UPDATE ON ai_pulse_signals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP INDEX IF EXISTS idx_ai_pulse_signals_signal_date;
DROP INDEX IF EXISTS idx_ai_pulse_signals_date;
CREATE INDEX IF NOT EXISTS idx_ai_pulse_signals_signal_date
  ON ai_pulse_signals (signal_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_pulse_signals_created_at
  ON ai_pulse_signals (created_at DESC);
