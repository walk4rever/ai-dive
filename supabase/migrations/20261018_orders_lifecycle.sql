-- Order lifecycle: pending checkouts are short-lived, finished rows stay for
-- reconciliation, and users can hide rows without losing paid entitlements.

ALTER TABLE ai_pulse_orders
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS user_deleted_at timestamptz;

ALTER TABLE ai_pulse_orders
  DROP CONSTRAINT IF EXISTS ai_pulse_orders_status_check;

ALTER TABLE ai_pulse_orders
  ADD CONSTRAINT ai_pulse_orders_status_check
  CHECK (status IN ('pending', 'paid', 'refunded', 'cancelled'));

ALTER TABLE ai_pulse_orders
  DROP CONSTRAINT IF EXISTS ai_pulse_orders_cancel_reason_check;

ALTER TABLE ai_pulse_orders
  ADD CONSTRAINT ai_pulse_orders_cancel_reason_check
  CHECK (cancel_reason IS NULL OR cancel_reason IN ('expired', 'superseded', 'user', 'error'));

-- Existing duplicate pending rows predate the one-live-checkout rule. Keep the
-- newest and cancel the rest so the partial unique index can be created.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, kind, ref
      ORDER BY created_at DESC, id DESC
    ) AS position
  FROM ai_pulse_orders
  WHERE status = 'pending'
)
UPDATE ai_pulse_orders AS orders
SET
  status = 'cancelled',
  cancelled_at = now(),
  cancel_reason = 'superseded'
FROM ranked
WHERE orders.id = ranked.id
  AND ranked.position > 1;

-- Two settled rows for the same purchase would mean a double charge. Refuse to
-- install the guard silently; resolve those rows (and refund if needed) first.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM ai_pulse_orders
    WHERE status = 'paid'
    GROUP BY user_id, kind, ref
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate paid orders found; resolve them before applying the unique index';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_pulse_orders_one_pending
  ON ai_pulse_orders (user_id, kind, ref)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_pulse_orders_one_paid
  ON ai_pulse_orders (user_id, kind, ref)
  WHERE status = 'paid';

CREATE INDEX IF NOT EXISTS idx_ai_pulse_orders_user_visible
  ON ai_pulse_orders (user_id, created_at DESC)
  WHERE user_deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_pulse_orders_pending_created
  ON ai_pulse_orders (created_at)
  WHERE status = 'pending';
