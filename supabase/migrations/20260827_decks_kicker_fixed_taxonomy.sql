-- Lock ai_pulse_decks.kicker to a fixed taxonomy instead of freeform text.
-- The prior "【主题标签】" convention (see 20260812_create_decks.sql backfill)
-- drifted within days (e.g. chuhai-growth-os used "实战手册 · PLAYBOOK"),
-- so kicker now holds one of four content-type labels rendered uppercase
-- by the existing `.kicker` CSS class (text-transform: uppercase).

UPDATE ai_pulse_decks SET kicker = 'PLAYBOOK'
  WHERE slug IN ('inference-engineering', 'chuhai-growth-os', 'harvey-playbook', 'anthropic-founders-playbook');

UPDATE ai_pulse_decks SET kicker = 'COURSE'
  WHERE slug IN ('k3-course-30', 'k3-course');

UPDATE ai_pulse_decks SET kicker = 'KEYNOTE'
  WHERE slug IN ('ribbit-letters', 'agent-harness');

ALTER TABLE ai_pulse_decks
  ADD CONSTRAINT ai_pulse_decks_kicker_check CHECK (kicker IN ('KEYNOTE', 'COURSE', 'REPORT', 'PLAYBOOK'));
