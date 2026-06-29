-- Rename content types: analysis→tech, podcast→insight (routes become plural)
ALTER TABLE ai_pulse_stories
  DROP CONSTRAINT IF EXISTS ai_pulse_stories_content_type_check;

UPDATE ai_pulse_stories SET content_type = 'tech' WHERE content_type = 'analysis';
UPDATE ai_pulse_stories SET content_type = 'insight' WHERE content_type = 'podcast';

ALTER TABLE ai_pulse_stories
  ADD CONSTRAINT ai_pulse_stories_content_type_check
    CHECK (content_type IN ('intel', 'tech', 'case', 'insight'));
