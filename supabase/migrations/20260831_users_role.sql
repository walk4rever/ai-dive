-- `ai_pulse_users.role` was added by hand on the production database when the admin
-- console shipped and never made it into schema.sql or a migration — src/lib/auth.ts
-- selects it on every login and puts it in the JWT, so a fresh environment built from
-- schema.sql alone would fail to authenticate anyone. This backfills the definition;
-- it is idempotent and a no-op against production.
ALTER TABLE ai_pulse_users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

DO $$
BEGIN
  ALTER TABLE ai_pulse_users
    ADD CONSTRAINT ai_pulse_users_role_check CHECK (role IN ('user', 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN ai_pulse_users.role IS
  'user | admin. Read at login into the next-auth JWT (src/lib/auth.ts). admin gates /admin, the admin APIs, and bypasses the /decks paywall (src/lib/decks/access.ts). Promote with: UPDATE ai_pulse_users SET role = ''admin'' WHERE email = ''...'';';
