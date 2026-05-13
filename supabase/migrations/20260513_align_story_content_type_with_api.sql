-- Align story content_type constraint with API-supported types
ALTER TABLE ai_pulse_stories
  DROP CONSTRAINT IF EXISTS ai_pulse_stories_content_type_check,
  ADD CONSTRAINT ai_pulse_stories_content_type_check
    CHECK (content_type IN ('analysis', 'case', 'podcast', 'invest'));
