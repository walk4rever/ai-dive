-- Reduce read amplification for public signal feeds, monthly calendars, and scoring workers.
-- The table is small today, so regular CREATE INDEX keeps this compatible with Supabase migrations.

CREATE INDEX IF NOT EXISTS idx_ai_pulse_signals_status_date_created
  ON ai_pulse_signals (status, signal_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_pulse_signals_enabled_created
  ON ai_pulse_signals (created_at DESC)
  WHERE status = 'enabled';

CREATE INDEX IF NOT EXISTS idx_ai_pulse_signals_unscored_enabled_created
  ON ai_pulse_signals (created_at DESC)
  WHERE status = 'enabled'
    AND (insight IS NULL OR actionable IS NULL OR influence IS NULL);
