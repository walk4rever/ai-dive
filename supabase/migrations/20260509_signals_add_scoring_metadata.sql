-- Clear legacy intel signals (migrated from old intel stories format)
TRUNCATE TABLE ai_pulse_signals;

-- Add Phase 1: ingestion fields
ALTER TABLE ai_pulse_signals
  ADD COLUMN metadata JSONB;

-- Add Phase 2: curation / scoring fields
ALTER TABLE ai_pulse_signals
  ADD COLUMN reason     TEXT,
  ADD COLUMN insight    SMALLINT CHECK (insight BETWEEN 0 AND 10),
  ADD COLUMN actionable SMALLINT CHECK (actionable BETWEEN 0 AND 10),
  ADD COLUMN influence  SMALLINT CHECK (influence BETWEEN 0 AND 10);
