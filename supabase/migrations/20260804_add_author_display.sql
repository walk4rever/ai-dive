-- Keep a stable machine identifier separate from the human-readable author name.
ALTER TABLE ai_pulse_stories
  ADD COLUMN IF NOT EXISTS author_display TEXT;

UPDATE ai_pulse_stories
SET author_display = COALESCE(author_display, author_slug)
WHERE author_slug IS NOT NULL;

UPDATE ai_pulse_stories
SET author_slug = NULLIF(
  regexp_replace(
    regexp_replace(lower(trim(author_slug)), '[^a-z0-9]+', '-', 'g'),
    '(^-|-$)', '', 'g'
  ),
  ''
)
WHERE author_slug IS NOT NULL;
