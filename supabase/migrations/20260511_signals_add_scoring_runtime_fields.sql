-- Add scoring runtime fields for v1 rubric.
ALTER TABLE ai_pulse_signals
  ADD COLUMN IF NOT EXISTS score_meta jsonb,
  ADD COLUMN IF NOT EXISTS score_version text,
  ADD COLUMN IF NOT EXISTS score_status text NOT NULL DEFAULT 'pending' CHECK (score_status IN ('pending', 'scored', 'reviewed')),
  ADD COLUMN IF NOT EXISTS scored_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ai_pulse_signals_score_status
  ON ai_pulse_signals (score_status);

