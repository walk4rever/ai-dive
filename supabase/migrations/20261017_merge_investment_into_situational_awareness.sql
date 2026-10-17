UPDATE ai_pulse_stories
SET topic_ids = CASE
  WHEN 'abbcd09b-b9fb-4a9c-824a-8ccb4fadaa93'::uuid = ANY(topic_ids)
    THEN array_remove(topic_ids, 'f4f4f902-227c-4783-8ea1-2dde7c6daac5'::uuid)
  ELSE array_append(
    array_remove(topic_ids, 'f4f4f902-227c-4783-8ea1-2dde7c6daac5'::uuid),
    'abbcd09b-b9fb-4a9c-824a-8ccb4fadaa93'::uuid
  )
END
WHERE 'f4f4f902-227c-4783-8ea1-2dde7c6daac5'::uuid = ANY(topic_ids);

DELETE FROM ai_pulse_topics
WHERE id = 'f4f4f902-227c-4783-8ea1-2dde7c6daac5';
