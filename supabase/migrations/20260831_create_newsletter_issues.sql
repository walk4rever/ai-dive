-- Weekly newsletter digest (信号解读 / 深度阅读 / 热门出品): one row per issue, keyed by
-- the 7-day period it covers. The digest's data (signals/posts/decks) is always
-- computed live from current content at send time — this table doesn't cache that,
-- only the one thing an admin actually authors by hand: the 信号解读 summary
-- paragraph, plus a record of when (and whether) the issue went out.
CREATE TABLE IF NOT EXISTS ai_pulse_newsletter_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  summary text NOT NULL DEFAULT '',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ai_pulse_newsletter_issues_updated_at') THEN
    CREATE TRIGGER ai_pulse_newsletter_issues_updated_at
      BEFORE UPDATE ON ai_pulse_newsletter_issues
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$;

ALTER TABLE ai_pulse_newsletter_issues ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE ai_pulse_newsletter_issues TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_pulse_newsletter_issues'
      AND policyname = 'service_role full access'
  ) THEN
    CREATE POLICY "service_role full access"
      ON ai_pulse_newsletter_issues
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;

-- Reuse the existing single-post send log (ai_pulse_email_sends) for per-recipient
-- dedup instead of a parallel table: story_id is already nullable there, so a digest
-- send is just a row with story_id NULL and newsletter_issue_id set — same table, same
-- (subscriber_id, <the thing sent>) dedup shape the post-send flow already relies on
-- (src/app/api/admin/posts/[slug]/send).
ALTER TABLE ai_pulse_email_sends
  ADD COLUMN IF NOT EXISTS newsletter_issue_id uuid REFERENCES ai_pulse_newsletter_issues(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ai_pulse_email_sends_newsletter_issue
  ON ai_pulse_email_sends (newsletter_issue_id, subscriber_id);
