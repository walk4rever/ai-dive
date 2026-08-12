-- Decks (出品) metadata table — replaces the hardcoded array in src/app/decks/page.tsx
-- so external agents can import new decks via scripts/import-deck.mjs without a
-- code deploy. HTML content itself is hosted on Cloudflare R2 (new imports) or
-- served from public/decks/ (the 3 decks backfilled below, left in place as-is).
CREATE TABLE IF NOT EXISTS ai_pulse_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  href text NOT NULL,
  title text NOT NULL,
  kicker text NOT NULL,
  description text NOT NULL,
  meta text NOT NULL,
  date date NOT NULL,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ai_pulse_decks_updated_at') THEN
    CREATE TRIGGER ai_pulse_decks_updated_at
      BEFORE UPDATE ON ai_pulse_decks
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$;

ALTER TABLE ai_pulse_decks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_pulse_decks'
      AND policyname = 'Public read published ai_pulse_decks'
  ) THEN
    CREATE POLICY "Public read published ai_pulse_decks"
      ON ai_pulse_decks FOR SELECT USING (status = 'published');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_pulse_decks'
      AND policyname = 'service_role full access ai_pulse_decks'
  ) THEN
    CREATE POLICY "service_role full access ai_pulse_decks"
      ON ai_pulse_decks FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END;
$$;

GRANT SELECT ON ai_pulse_decks TO anon, authenticated;
GRANT ALL ON ai_pulse_decks TO service_role;

CREATE INDEX IF NOT EXISTS idx_ai_pulse_decks_status_date ON ai_pulse_decks (status, date DESC);

-- Backfill the 3 decks currently hardcoded in src/app/decks/page.tsx.
-- Their HTML stays under public/decks/ (unchanged) — only metadata moves here.
INSERT INTO ai_pulse_decks (slug, href, title, kicker, description, meta, date, status)
VALUES
  (
    'agent-harness',
    '/decks/agent-harness.html',
    'Harness 工程：从黑箱到可见',
    'HARNESS 系列 · 43 页',
    '基于《Harness 系列》六篇整理的技术演讲：五个维度、三套实践，附 Uber 与 Ramp 两个完整企业案例。',
    '43 slides · 60 min',
    '2026-04-01',
    'published'
  ),
  (
    'anthropic-founders-playbook',
    '/decks/anthropic-founders-playbook.html',
    'The Founder''s Playbook：AI-Native 创业指南',
    'Anthropic · 35 页',
    'Anthropic 2026 年官方创始人手册完整精读。覆盖 Idea → MVP → Launch → Scale 四阶段，详解 Claude / Claude Code / Claude Cowork 的实战用法与案例。',
    '35 slides · 25 min',
    '2026-05-01',
    'published'
  ),
  (
    'k3-course',
    '/decks/k3-course/index.html',
    'K3 七天课：从零读懂 47 页技术报告',
    'K3 七天课 · 7 篇',
    '不假设你懂编程、懂数学、懂 AI——只假设你有高中水平。每天先用比喻和图解讲清一个概念，再回到 Kimi K3 技术报告对应章节，七天读完一份 47 页的技术报告。',
    '7 天课程 · 30+ 图解 · 25 道自测题',
    '2026-08-12',
    'published'
  )
ON CONFLICT (slug) DO NOTHING;
