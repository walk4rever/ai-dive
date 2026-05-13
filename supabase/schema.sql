-- AI Pulse stories table (renamed from ai_pulse_posts)
CREATE TABLE IF NOT EXISTS ai_pulse_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  excerpt TEXT NOT NULL DEFAULT '',
  is_premium BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  content_type TEXT NOT NULL DEFAULT 'analysis' CHECK (content_type IN ('analysis', 'case', 'podcast', 'invest')),
  featured BOOLEAN NOT NULL DEFAULT false,
  topic_ids UUID[] NOT NULL DEFAULT '{}',
  signal_ids UUID[] NOT NULL DEFAULT '{}',
  author_slug TEXT,
  user_id UUID,
  agent_id UUID,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI Pulse topics table (renamed from ai_pulse_series)
CREATE TABLE IF NOT EXISTS ai_pulse_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI Pulse signals table (raw intelligence from sources)
CREATE TABLE IF NOT EXISTS ai_pulse_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT UNIQUE NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'unknown',
  source_name TEXT,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  signal_date DATE NOT NULL DEFAULT (timezone('Asia/Shanghai', now()))::date,
  status TEXT NOT NULL DEFAULT 'raw' CHECK (status IN ('raw', 'selected', 'archived')),
  metadata JSONB,
  reason TEXT,
  insight SMALLINT CHECK (insight BETWEEN 0 AND 10),
  actionable SMALLINT CHECK (actionable BETWEEN 0 AND 10),
  influence SMALLINT CHECK (influence BETWEEN 0 AND 10),
  score_meta JSONB,
  score_version TEXT,
  score_status TEXT NOT NULL DEFAULT 'pending' CHECK (score_status IN ('pending', 'scored', 'reviewed')),
  scored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI Pulse distributions table (channel publishing records)
CREATE TABLE IF NOT EXISTS ai_pulse_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES ai_pulse_stories(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('website', 'email', 'wechat', 'lark', 'xiaohongshu')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed')),
  channel_post_id TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI Pulse subscribers table
CREATE TABLE IF NOT EXISTS ai_pulse_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'paid')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'unsubscribed')),
  stripe_customer_id TEXT,
  confirmed_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  confirmation_nonce_hash TEXT,
  confirmation_expires_at TIMESTAMPTZ,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI Pulse email send log
CREATE TABLE IF NOT EXISTS ai_pulse_email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES ai_pulse_stories(id) ON DELETE CASCADE,
  subscriber_id UUID REFERENCES ai_pulse_subscribers(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ
);

-- Users, agents, sessions
CREATE TABLE IF NOT EXISTS ai_pulse_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  username text UNIQUE,
  email_verified_at timestamptz,
  verification_nonce_hash text,
  verification_expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_pulse_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES ai_pulse_users(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_pulse_user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES ai_pulse_users(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_pulse_wechat_tokens (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_pulse_stories_updated_at
  BEFORE UPDATE ON ai_pulse_stories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER ai_pulse_topics_updated_at
  BEFORE UPDATE ON ai_pulse_topics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER ai_pulse_signals_updated_at
  BEFORE UPDATE ON ai_pulse_signals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE ai_pulse_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_pulse_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_pulse_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_pulse_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_pulse_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_pulse_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_pulse_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_pulse_user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_pulse_wechat_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read published ai_pulse_stories" ON ai_pulse_stories
  FOR SELECT USING (status = 'published');

CREATE POLICY "Public read ai_pulse_signals" ON ai_pulse_signals
  FOR SELECT USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_pulse_stories_status_published_at ON ai_pulse_stories (status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_pulse_stories_content_type_published_at ON ai_pulse_stories (content_type, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_pulse_stories_featured_published_at ON ai_pulse_stories (featured, published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_ai_pulse_topics_created_at ON ai_pulse_topics (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_pulse_signals_status ON ai_pulse_signals (status);
CREATE INDEX IF NOT EXISTS idx_ai_pulse_signals_score_status ON ai_pulse_signals (score_status);
CREATE INDEX IF NOT EXISTS idx_ai_pulse_signals_created_at ON ai_pulse_signals (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_pulse_signals_signal_date ON ai_pulse_signals (signal_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_pulse_distributions_story_id ON ai_pulse_distributions (story_id);
CREATE INDEX IF NOT EXISTS idx_ai_pulse_subscribers_email ON ai_pulse_subscribers (email);
CREATE INDEX IF NOT EXISTS idx_ai_pulse_subscribers_status ON ai_pulse_subscribers (status);

-- Grants
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT ON ai_pulse_stories TO anon, authenticated;
GRANT SELECT ON ai_pulse_signals TO anon, authenticated;
GRANT ALL ON ai_pulse_subscribers TO service_role;
GRANT ALL ON ai_pulse_topics TO service_role;
GRANT ALL ON ai_pulse_distributions TO service_role;
GRANT ALL ON ai_pulse_email_sends TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, service_role;
