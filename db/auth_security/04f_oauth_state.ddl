-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- OAuth State Storage
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- PURPOSE:
-- PKCE and state storage for OAuth 2.1 flows with external providers
-- (Google, Microsoft, GitHub). Prevents CSRF and authorization code
-- interception attacks.
--
-- OAUTH 2.1 COMPLIANCE:
-- - PKCE required for all flows (code_verifier stored here)
-- - State parameter for CSRF protection
-- - Short-lived entries (10 minute TTL)
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS app.oauth_state (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

    -- OAuth parameters
    state varchar(64) NOT NULL UNIQUE,        -- CSRF protection
    code_verifier varchar(128),               -- PKCE code verifier

    -- Provider info
    provider varchar(50) NOT NULL,            -- 'google', 'microsoft', 'github'
    redirect_uri text NOT NULL,

    -- Context
    person_id uuid,                           -- NULL if new user
    action varchar(20) NOT NULL,              -- 'login', 'signup', 'link'

    -- Lifecycle
    expires_ts timestamptz NOT NULL,          -- 10 minutes
    used_flag boolean DEFAULT false,

    created_ts timestamptz DEFAULT now()
);

-- Index for state lookup
CREATE INDEX IF NOT EXISTS idx_oauth_state_lookup
    ON app.oauth_state(state)
    WHERE used_flag = false;

COMMENT ON TABLE app.oauth_state IS 'OAuth 2.1 state and PKCE storage';
COMMENT ON COLUMN app.oauth_state.code_verifier IS 'PKCE code_verifier for token exchange';
