-- Track which agent uploaded each signal, enabling agent-scoped deletes
ALTER TABLE ai_pulse_signals
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES ai_pulse_agents(id);

CREATE INDEX IF NOT EXISTS idx_ai_pulse_signals_agent_id ON ai_pulse_signals (agent_id);
