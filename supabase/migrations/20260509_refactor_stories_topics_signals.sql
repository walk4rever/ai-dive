-- Migration: Signal → Story → Distribution schema refactor
-- posts → stories, series → topics, add signals and distributions tables

-- 1. Add new array columns to posts before rename
ALTER TABLE ai_pulse_posts
  ADD COLUMN IF NOT EXISTS topic_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS signal_ids uuid[] NOT NULL DEFAULT '{}';

-- 2. Backfill topic_ids from junction table before dropping it
UPDATE ai_pulse_posts p
SET topic_ids = subq.ids
FROM (
  SELECT post_id, ARRAY_AGG(series_id) AS ids
  FROM ai_pulse_series_posts
  GROUP BY post_id
) subq
WHERE p.id = subq.post_id;

-- 3. Drop junction table (replaced by topic_ids array)
DROP TABLE IF EXISTS ai_pulse_series_posts;

-- 4. Drop series_slug column (replaced by topic_ids)
ALTER TABLE ai_pulse_posts DROP COLUMN IF EXISTS series_slug;

-- 5. Rename ai_pulse_posts → ai_pulse_stories
ALTER TABLE ai_pulse_posts RENAME TO ai_pulse_stories;

-- 6. Rename ai_pulse_series → ai_pulse_topics
ALTER TABLE ai_pulse_series RENAME TO ai_pulse_topics;

-- 7. Rename post_id → story_id in email_sends
ALTER TABLE ai_pulse_email_sends RENAME COLUMN post_id TO story_id;

-- 8. Create ai_pulse_signals
CREATE TABLE IF NOT EXISTS ai_pulse_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text UNIQUE NOT NULL,
  source_type text NOT NULL DEFAULT 'unknown',
  source_name text,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  date date NOT NULL,
  status text NOT NULL DEFAULT 'raw' CHECK (status IN ('raw', 'selected', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 9. Create ai_pulse_distributions
CREATE TABLE IF NOT EXISTS ai_pulse_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES ai_pulse_stories(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('website', 'email', 'wechat', 'lark', 'xiaohongshu')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed')),
  channel_post_id text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 10. Migrate intel story signals to ai_pulse_signals table
DO $$
DECLARE
  story_rec RECORD;
  sig JSONB;
  sig_url TEXT;
  sig_id uuid;
  new_ids uuid[];
  content_parsed JSONB;
BEGIN
  FOR story_rec IN
    SELECT id, content, published_at
    FROM ai_pulse_stories
    WHERE content_type = 'intel'
  LOOP
    BEGIN
      content_parsed := story_rec.content::jsonb;
    EXCEPTION WHEN OTHERS THEN
      content_parsed := '{}'::jsonb;
    END;

    new_ids := '{}';

    IF jsonb_typeof(content_parsed->'signals') = 'array' THEN
      FOR sig IN SELECT * FROM jsonb_array_elements(content_parsed->'signals')
      LOOP
        sig_url := sig->>'url';
        CONTINUE WHEN sig_url IS NULL OR sig_url = '';

        INSERT INTO ai_pulse_signals (url, source_type, source_name, title, description, date)
        VALUES (
          sig_url,
          LOWER(COALESCE(sig->>'source', 'unknown')),
          COALESCE(sig->>'source', 'unknown'),
          COALESCE(sig->>'title', ''),
          COALESCE(sig->>'desc', ''),
          story_rec.published_at::date
        )
        ON CONFLICT (url) DO NOTHING;

        SELECT id INTO sig_id FROM ai_pulse_signals WHERE url = sig_url;
        IF sig_id IS NOT NULL THEN
          new_ids := new_ids || sig_id;
        END IF;
      END LOOP;
    END IF;

    UPDATE ai_pulse_stories SET signal_ids = new_ids WHERE id = story_rec.id;
  END LOOP;
END;
$$;

-- 11. RLS for new tables
ALTER TABLE ai_pulse_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_pulse_distributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read ai_pulse_signals"
  ON ai_pulse_signals FOR SELECT USING (true);

CREATE POLICY "service_role full access ai_pulse_signals"
  ON ai_pulse_signals FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role full access ai_pulse_distributions"
  ON ai_pulse_distributions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 12. Grants
GRANT SELECT ON ai_pulse_signals TO anon, authenticated;
GRANT ALL ON ai_pulse_signals TO service_role;
GRANT ALL ON ai_pulse_distributions TO service_role;

-- 13. Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_ai_pulse_signals_date ON ai_pulse_signals (date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_pulse_signals_status ON ai_pulse_signals (status);
CREATE INDEX IF NOT EXISTS idx_ai_pulse_distributions_story_id ON ai_pulse_distributions (story_id);

-- 14. Rename existing indexes to match new table name
ALTER INDEX IF EXISTS idx_ai_pulse_posts_status_published_at
  RENAME TO idx_ai_pulse_stories_status_published_at;
ALTER INDEX IF EXISTS idx_ai_pulse_posts_content_type_published_at
  RENAME TO idx_ai_pulse_stories_content_type_published_at;
ALTER INDEX IF EXISTS idx_ai_pulse_posts_featured_published_at
  RENAME TO idx_ai_pulse_stories_featured_published_at;
