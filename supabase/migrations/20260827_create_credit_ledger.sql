-- Credits ledger for /agent + AI解读 usage metering (TODO.md 阶段 4.1).
-- Append-only: balance is always derived as SUM(delta), never stored/mutated in place.
-- period = 'YYYY-MM' scopes a row to one billing month so expiry is implicit (a past
-- month's rows simply stop counting toward the balance query) — no cleanup job needed.
-- period = NULL is reserved for future never-expiring grants (e.g. purchased top-up packs).
CREATE TABLE IF NOT EXISTS ai_pulse_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES ai_pulse_users(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL,
  period text,
  ref_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_pulse_credit_ledger ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE ai_pulse_credit_ledger TO service_role;

CREATE POLICY "service_role full access"
  ON ai_pulse_credit_ledger
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- One grant per (user, reason, period): makes the lazy monthly grant idempotent under
-- concurrent requests — a duplicate insert hits this and is caught as a no-op in app code.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_pulse_credit_ledger_grant_period
  ON ai_pulse_credit_ledger (user_id, reason, period)
  WHERE reason IN ('grant_free', 'grant_plan');

CREATE INDEX IF NOT EXISTS idx_ai_pulse_credit_ledger_user_period
  ON ai_pulse_credit_ledger (user_id, period, created_at);
