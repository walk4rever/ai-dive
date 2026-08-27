-- 出品栏目付费墙 schema (TODO.md 阶段 4.2): per-deck pricing + a provider-agnostic
-- orders table shared by deck purchases and (later) membership plans.

ALTER TABLE ai_pulse_decks
  ADD COLUMN IF NOT EXISTS price_cents integer,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'CNY';

COMMENT ON COLUMN ai_pulse_decks.price_cents IS
  'NULL = not for sale / still free to read. Set = requires a paid ai_pulse_orders row to access.';

-- One-time-purchase orders. Deck purchases (kind='deck', ref=deck slug) and future
-- membership plans (kind='membership', ref=plan id) share this table because both are
-- single one-time payments under the payment channels available to this project (see
-- TODO.md 阶段 4.3) — one provider integration, one callback-verification path, not two.
CREATE TABLE IF NOT EXISTS ai_pulse_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES ai_pulse_users(id) ON DELETE CASCADE,
  email text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('deck', 'membership')),
  ref text NOT NULL,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'CNY',
  provider text,
  provider_order_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'refunded')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_pulse_orders ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE ai_pulse_orders TO service_role;

CREATE POLICY "service_role full access"
  ON ai_pulse_orders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Entitlement check ("does this user own this deck") is a lookup by exactly these
-- four columns — see src/lib/decks/access.ts.
CREATE INDEX IF NOT EXISTS idx_ai_pulse_orders_entitlement
  ON ai_pulse_orders (user_id, kind, ref, status);

-- Guards against double-booking the same provider callback (a webhook retry, or two
-- concurrent callback deliveries) once 4.3 wires up a real payment provider.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_pulse_orders_provider_order
  ON ai_pulse_orders (provider, provider_order_id)
  WHERE provider_order_id IS NOT NULL;
