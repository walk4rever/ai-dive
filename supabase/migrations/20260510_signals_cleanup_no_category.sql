-- Remove signals with no metadata.category (unclassified, low-value)
DELETE FROM ai_pulse_signals
WHERE metadata IS NULL
   OR metadata->>'category' IS NULL
   OR metadata->>'category' = '';
