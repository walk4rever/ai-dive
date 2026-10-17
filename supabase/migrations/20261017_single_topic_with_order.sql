-- Collapse topic membership to one topic per story and store an explicit
-- editorial order inside that topic.

DO $$
BEGIN
  -- Ignore stale ids here: those belong to retired topics and will be removed
  -- below. Only a story with two still-existing topics needs manual resolution.
  IF EXISTS (
    SELECT 1
    FROM ai_pulse_stories story
    WHERE (
      SELECT COUNT(DISTINCT kept.id)
      FROM unnest(story.topic_ids) AS kept(id)
      WHERE EXISTS (
        SELECT 1
        FROM ai_pulse_topics topic
        WHERE topic.id = kept.id
      )
    ) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot migrate: some stories belong to more than one existing topic';
  END IF;
END;
$$;

-- Retired topics were deleted without cleaning the old topic_ids arrays.
-- Drop those stale references before enforcing the one-topic invariant.
UPDATE ai_pulse_stories AS story
SET topic_ids = ARRAY(
  SELECT DISTINCT kept.id
  FROM unnest(story.topic_ids) AS kept(id)
  WHERE EXISTS (
    SELECT 1
    FROM ai_pulse_topics topic
    WHERE topic.id = kept.id
  )
)
WHERE EXISTS (
  SELECT 1
  FROM unnest(story.topic_ids) AS existing(id)
  WHERE NOT EXISTS (
    SELECT 1
    FROM ai_pulse_topics topic
    WHERE topic.id = existing.id
  )
);

ALTER TABLE ai_pulse_stories
  ADD COLUMN IF NOT EXISTS topic_id uuid,
  ADD COLUMN IF NOT EXISTS topic_order integer;

UPDATE ai_pulse_stories
SET topic_id = topic_ids[1]
WHERE cardinality(topic_ids) = 1;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY topic_id
      ORDER BY published_at ASC NULLS LAST, created_at ASC, id ASC
    )::integer AS position
  FROM ai_pulse_stories
  WHERE topic_id IS NOT NULL
)
UPDATE ai_pulse_stories AS story
SET topic_order = ranked.position
FROM ranked
WHERE story.id = ranked.id;

ALTER TABLE ai_pulse_stories
  DROP CONSTRAINT IF EXISTS ai_pulse_stories_topic_presence_check,
  ADD CONSTRAINT ai_pulse_stories_topic_presence_check CHECK (
    (topic_id IS NULL AND topic_order IS NULL)
    OR (topic_id IS NOT NULL AND topic_order > 0)
  );

ALTER TABLE ai_pulse_stories
  DROP CONSTRAINT IF EXISTS ai_pulse_stories_topic_id_fkey,
  ADD CONSTRAINT ai_pulse_stories_topic_id_fkey
    FOREIGN KEY (topic_id) REFERENCES ai_pulse_topics(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_pulse_stories_topic_order
  ON ai_pulse_stories (topic_id, topic_order)
  WHERE topic_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.move_topic_story(
  p_topic_id uuid,
  p_story_id uuid,
  p_direction text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_current_order integer;
  v_neighbor_id uuid;
  v_neighbor_order integer;
  v_temp_order integer;
BEGIN
  IF p_direction NOT IN ('up', 'down') THEN
    RAISE EXCEPTION 'Invalid direction' USING ERRCODE = '22023';
  END IF;

  SELECT topic_order
  INTO v_current_order
  FROM ai_pulse_stories
  WHERE id = p_story_id
    AND topic_id = p_topic_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Story is not in this topic' USING ERRCODE = 'P0002';
  END IF;

  IF p_direction = 'up' THEN
    SELECT id, topic_order
    INTO v_neighbor_id, v_neighbor_order
    FROM ai_pulse_stories
    WHERE topic_id = p_topic_id
      AND topic_order < v_current_order
    ORDER BY topic_order DESC
    LIMIT 1;
  ELSE
    SELECT id, topic_order
    INTO v_neighbor_id, v_neighbor_order
    FROM ai_pulse_stories
    WHERE topic_id = p_topic_id
      AND topic_order > v_current_order
    ORDER BY topic_order ASC
    LIMIT 1;
  END IF;

  IF v_neighbor_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(topic_order), 0) + 1
  INTO v_temp_order
  FROM ai_pulse_stories
  WHERE topic_id = p_topic_id;

  UPDATE ai_pulse_stories SET topic_order = v_temp_order WHERE id = p_story_id;
  UPDATE ai_pulse_stories SET topic_order = v_current_order WHERE id = v_neighbor_id;
  UPDATE ai_pulse_stories SET topic_order = v_neighbor_order WHERE id = p_story_id;
END;
$$;

REVOKE ALL ON FUNCTION public.move_topic_story(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_topic_story(uuid, uuid, text) TO service_role;

ALTER TABLE ai_pulse_stories DROP COLUMN IF EXISTS topic_ids;
