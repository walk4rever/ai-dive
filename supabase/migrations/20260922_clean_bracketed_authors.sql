-- Clean any square brackets / wikilink markers from author_display and author_slug in ai_pulse_stories
UPDATE ai_pulse_stories
SET author_display = trim(both '[] ' from author_display)
WHERE author_display LIKE '%[%' OR author_display LIKE '%]%';

UPDATE ai_pulse_stories
SET author_slug = trim(both '[] ' from author_slug)
WHERE author_slug LIKE '%[%' OR author_slug LIKE '%]%';
