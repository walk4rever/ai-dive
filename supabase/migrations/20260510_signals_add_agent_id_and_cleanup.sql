-- 1. Add agent_id column (tracks which agent uploaded each signal)
ALTER TABLE ai_pulse_signals
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES ai_pulse_agents(id);

CREATE INDEX IF NOT EXISTS idx_ai_pulse_signals_agent_id
  ON ai_pulse_signals (agent_id);

-- 2. Remove legacy http:// signals (orphan data — cannot be managed via API)
DELETE FROM ai_pulse_signals
  WHERE url NOT LIKE 'https://%';
