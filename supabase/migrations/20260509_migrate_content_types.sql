-- Rename interview → podcast
UPDATE ai_pulse_stories SET content_type = 'podcast' WHERE content_type = 'interview';

-- Delete brief stories
DELETE FROM ai_pulse_stories WHERE content_type = 'brief';
