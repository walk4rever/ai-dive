-- Agent chat turn history — persists /agent (探索页) and "AI解读" (per-article panel)
-- conversations so they survive refresh/device switch, and so pi-gateway can seed a
-- cold-started AgentSession with prior turns. One (user_id, context_key) = one
-- continuously-growing thread; context_key is an article slug or the literal 'global'.
CREATE TABLE IF NOT EXISTS ai_pulse_chat_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES ai_pulse_users(id) ON DELETE CASCADE,
  context_key text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  text text NOT NULL DEFAULT '',
  image_urls text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_pulse_chat_turns ENABLE ROW LEVEL SECURITY;
GRANT ALL ON ai_pulse_chat_turns TO service_role;
CREATE POLICY "service_role full access" ON ai_pulse_chat_turns FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ai_pulse_chat_turns_user_context_created
  ON ai_pulse_chat_turns (user_id, context_key, created_at);
