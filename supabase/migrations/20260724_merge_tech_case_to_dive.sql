-- Merge content types: tech + case -> dive (single "深度" column)
ALTER TABLE ai_pulse_stories
  DROP CONSTRAINT IF EXISTS ai_pulse_stories_content_type_check;

UPDATE ai_pulse_stories SET content_type = 'dive' WHERE content_type IN ('tech', 'case');

ALTER TABLE ai_pulse_stories
  ADD CONSTRAINT ai_pulse_stories_content_type_check
    CHECK (content_type IN ('intel', 'dive', 'insight'));
