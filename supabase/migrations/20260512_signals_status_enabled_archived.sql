-- Migrate signal status model: raw/selected/archived → enabled/archived.
-- Both 'raw' and 'selected' map to 'enabled' (visible on site).

-- 1. Drop old CHECK constraint
ALTER TABLE ai_pulse_signals
  DROP CONSTRAINT IF EXISTS ai_pulse_signals_status_check;

-- 2. Migrate data
UPDATE ai_pulse_signals SET status = 'enabled' WHERE status IN ('raw', 'selected');

-- 3. Change default and add new CHECK constraint
ALTER TABLE ai_pulse_signals
  ALTER COLUMN status SET DEFAULT 'enabled',
  ADD CONSTRAINT ai_pulse_signals_status_check CHECK (status IN ('enabled', 'archived'));
