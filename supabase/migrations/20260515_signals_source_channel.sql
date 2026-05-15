-- Add source_channel column and reclassify source_type by URL

-- 1. Add source_channel (free-text, agent-injected, e.g. "hn", "rss", "manual")
ALTER TABLE ai_pulse_signals
  ADD COLUMN IF NOT EXISTS source_channel text;

-- 2. Reclassify source_type for all existing rows based on URL
UPDATE ai_pulse_signals SET source_type = CASE
  WHEN url ~ '^https?://(www\.)?x\.com/'            THEN 'x'
  WHEN url ~ '^https?://(www\.)?twitter\.com/'      THEN 'x'
  WHEN url ~ '^https?://(www\.)?arxiv\.org/'        THEN 'arxiv'
  WHEN url ~ '^https?://(www\.)?github\.com/'       THEN 'github'
  WHEN url ~ '^https?://github\.blog/'              THEN 'github'
  WHEN url ~ '^https?://(www\.)?a16z\.com/'         THEN 'a16z'
  WHEN url ~ '^https?://(www\.)?techcrunch\.com/'   THEN 'techcrunch'
  WHEN url ~ '^https?://www\.ithome\.com/'          THEN 'ithome'
  WHEN url ~ '^https?://(news\.)?ycombinator\.com/' THEN 'yc'
  ELSE 'web'
END;

-- 3. Update default and add check constraint
ALTER TABLE ai_pulse_signals
  ALTER COLUMN source_type SET DEFAULT 'web',
  DROP CONSTRAINT IF EXISTS ai_pulse_signals_source_type_check,
  ADD CONSTRAINT ai_pulse_signals_source_type_check
    CHECK (source_type IN ('x', 'github', 'arxiv', 'a16z', 'techcrunch', 'ithome', 'yc', 'web'));
