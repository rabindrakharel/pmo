-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Authentication Token Management Tables
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- PURPOSE:
-- Secure token management for modern authentication:
-- - Refresh token rotation with reuse detection
-- - Token blacklisting for immediate revocation
-- - Session management with device tracking
-- - WebAuthn/Passkey challenge storage
-- - OAuth state/PKCE storage
--
-- SECURITY FEATURES:
-- - Single-use refresh tokens (rotation on every use)
-- - Token family tracking (detect stolen token reuse)
-- - Automatic cleanup of expired tokens
-- - Device binding for tokens
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ─────────────────────────────────────────────────────────────────────────────
-- REFRESH TOKENS
-- Implements refresh token rotation with reuse detection
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.refresh_token (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Token identification
    token_hash varchar(64) NOT NULL,          -- SHA256 hash of the token
    token_family uuid NOT NULL,               -- Family ID for rotation tracking

    -- Ownership
    person_id uuid NOT NULL,                  -- Owner of the token

    -- Device binding
    device_id varchar(64),                    -- Device fingerprint
    device_name varchar(255),                 -- "Chrome on MacOS"
    ip_address varchar(45),                   -- IPv4 or IPv6
    user_agent text,                          -- Full user agent string

    -- Lifecycle
    expires_ts timestamptz NOT NULL,          -- Token expiration
    revoked_flag boolean DEFAULT false,       -- Explicitly revoked
    revoked_ts timestamptz,                   -- When revoked
    revoked_reason varchar(50),               -- 'logout', 'password_change', 'suspicious', 'reuse_detected'

    -- Usage tracking
    used_flag boolean DEFAULT false,          -- Has been used (single-use)
    used_ts timestamptz,                      -- When used
    replaced_by_id uuid,                      -- ID of replacement token (for rotation)

    -- Metadata
    created_ts timestamptz DEFAULT now(),

    -- Constraints
    CONSTRAINT fk_refresh_token_person FOREIGN KEY (person_id)
        REFERENCES app.person(id) ON DELETE CASCADE
);

-- Indexes for refresh token lookups
CREATE INDEX IF NOT EXISTS idx_refresh_token_hash ON app.refresh_token(token_hash) WHERE revoked_flag = false;
CREATE INDEX IF NOT EXISTS idx_refresh_token_person ON app.refresh_token(person_id, revoked_flag);
CREATE INDEX IF NOT EXISTS idx_refresh_token_family ON app.refresh_token(token_family);
CREATE INDEX IF NOT EXISTS idx_refresh_token_expires ON app.refresh_token(expires_ts) WHERE revoked_flag = false;
CREATE INDEX IF NOT EXISTS idx_refresh_token_device ON app.refresh_token(device_id, person_id);

COMMENT ON TABLE app.refresh_token IS 'Refresh tokens with rotation and reuse detection';
COMMENT ON COLUMN app.refresh_token.token_hash IS 'SHA256 hash of refresh token (never store plaintext)';
COMMENT ON COLUMN app.refresh_token.token_family IS 'Family UUID - all rotated tokens share same family';
COMMENT ON COLUMN app.refresh_token.used_flag IS 'Single-use: true after token exchanged for new pair';
COMMENT ON COLUMN app.refresh_token.replaced_by_id IS 'Links to the new token created during rotation';


-- ─────────────────────────────────────────────────────────────────────────────
-- TOKEN BLACKLIST
-- For immediate revocation of access tokens (JWTs)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.token_blacklist (
    jti varchar(64) PRIMARY KEY,              -- JWT ID (unique token identifier)
    person_id uuid,                           -- Token owner
    expires_ts timestamptz NOT NULL,          -- When token would naturally expire
    reason varchar(50),                       -- 'logout', 'password_change', 'security'
    created_ts timestamptz DEFAULT now()
);

-- Index for cleanup job
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON app.token_blacklist(expires_ts);

COMMENT ON TABLE app.token_blacklist IS 'Blacklisted JWTs for immediate revocation';
COMMENT ON COLUMN app.token_blacklist.jti IS 'JWT ID claim - unique identifier per token';


-- ─────────────────────────────────────────────────────────────────────────────
-- ACTIVE SESSIONS
-- Server-side session tracking with device info
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.user_session (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Ownership
    person_id uuid NOT NULL,

    -- Session identification
    session_token_hash varchar(64) NOT NULL,  -- SHA256 hash of session token

    -- Device information
    device_id varchar(64),
    device_name varchar(255),                 -- "iPhone 15 Pro"
    device_type varchar(50),                  -- 'mobile', 'desktop', 'tablet'
    browser varchar(100),                     -- "Chrome 120"
    os varchar(100),                          -- "macOS 14.2"
    ip_address varchar(45),

    -- Location (optional, from IP geolocation)
    location_city varchar(100),
    location_country varchar(100),
    location_coords point,                    -- lat/lon

    -- Lifecycle
    created_ts timestamptz DEFAULT now(),
    last_active_ts timestamptz DEFAULT now(), -- Updated on each API call
    expires_ts timestamptz NOT NULL,

    -- Status
    active_flag boolean DEFAULT true,
    terminated_ts timestamptz,
    terminated_reason varchar(50),            -- 'logout', 'expired', 'revoked', 'new_session_limit'

    -- Risk
    risk_score integer DEFAULT 0,             -- 0-100, calculated at creation
    is_suspicious boolean DEFAULT false,

    -- Constraints
    CONSTRAINT fk_user_session_person FOREIGN KEY (person_id)
        REFERENCES app.person(id) ON DELETE CASCADE
);

-- Indexes for session management
CREATE INDEX IF NOT EXISTS idx_user_session_person ON app.user_session(person_id, active_flag);
CREATE INDEX IF NOT EXISTS idx_user_session_token ON app.user_session(session_token_hash) WHERE active_flag = true;
CREATE INDEX IF NOT EXISTS idx_user_session_device ON app.user_session(device_id, person_id);
CREATE INDEX IF NOT EXISTS idx_user_session_expires ON app.user_session(expires_ts) WHERE active_flag = true;

COMMENT ON TABLE app.user_session IS 'Active user sessions with device tracking';


-- ─────────────────────────────────────────────────────────────────────────────
-- WEBAUTHN CHALLENGES
-- Temporary storage for WebAuthn registration/authentication challenges
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.webauthn_challenge (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Challenge data
    challenge varchar(255) NOT NULL,          -- Base64URL encoded challenge
    challenge_type varchar(20) NOT NULL,      -- 'registration' or 'authentication'

    -- Context
    person_id uuid,                           -- NULL for authentication (email lookup)
    email varchar(255),                       -- For authentication lookup

    -- Lifecycle
    expires_ts timestamptz NOT NULL,          -- Short-lived (5 minutes)
    used_flag boolean DEFAULT false,

    created_ts timestamptz DEFAULT now()
);

-- Index for challenge lookup
CREATE INDEX IF NOT EXISTS idx_webauthn_challenge_lookup
    ON app.webauthn_challenge(challenge, challenge_type)
    WHERE used_flag = false;

-- Auto-cleanup: challenges expire quickly
CREATE INDEX IF NOT EXISTS idx_webauthn_challenge_expires
    ON app.webauthn_challenge(expires_ts);

COMMENT ON TABLE app.webauthn_challenge IS 'Temporary WebAuthn challenges (5 min TTL)';


-- ─────────────────────────────────────────────────────────────────────────────
-- OAUTH STATE
-- PKCE and state storage for OAuth flows
-- ─────────────────────────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────────────────────────
-- SECURITY AUDIT LOG
-- Immutable audit trail for security events
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.security_audit (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Event identification
    event_type varchar(50) NOT NULL,          -- See event types below
    event_category varchar(30) NOT NULL,      -- 'authentication', 'authorization', 'account', 'session'

    -- Actor
    person_id uuid,                           -- NULL for failed login attempts
    email varchar(255),                       -- For tracking pre-auth events

    -- Event details
    event_detail jsonb DEFAULT '{}',          -- Event-specific data

    -- Context
    ip_address varchar(45),
    user_agent text,
    device_id varchar(64),

    -- Location
    geo_country varchar(100),
    geo_city varchar(100),

    -- Risk assessment
    risk_score integer,                       -- 0-100
    risk_factors jsonb DEFAULT '[]',          -- ['new_device', 'impossible_travel', etc.]

    -- Result
    success_flag boolean NOT NULL,
    failure_reason varchar(100),

    -- Timestamp (immutable)
    created_ts timestamptz DEFAULT now() NOT NULL
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_security_audit_person ON app.security_audit(person_id, created_ts DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_event ON app.security_audit(event_type, created_ts DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_ip ON app.security_audit(ip_address, created_ts DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_time ON app.security_audit(created_ts DESC);

-- Event types reference:
-- authentication: login_success, login_failure, logout, mfa_success, mfa_failure, passkey_auth
-- account: password_change, email_change, mfa_enable, mfa_disable, passkey_register, passkey_remove
-- session: session_create, session_revoke, session_revoke_all, token_refresh, token_revoke
-- authorization: permission_grant, permission_revoke, role_assign, role_remove

COMMENT ON TABLE app.security_audit IS 'Immutable security audit log - no UPDATE/DELETE allowed';


-- ─────────────────────────────────────────────────────────────────────────────
-- RATE LIMITING
-- Track rate limits per IP/user for various actions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.rate_limit (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Identification
    key varchar(255) NOT NULL,                -- 'login:192.168.1.1' or 'login:email@example.com'
    action varchar(50) NOT NULL,              -- 'login', 'password_reset', 'mfa_verify', etc.

    -- Counts
    attempt_count integer DEFAULT 1,
    window_start_ts timestamptz DEFAULT now(),
    window_end_ts timestamptz NOT NULL,

    -- Status
    blocked_until_ts timestamptz,             -- If rate limit exceeded

    CONSTRAINT uq_rate_limit_key_action UNIQUE (key, action)
);

-- Index for rate limit checks
CREATE INDEX IF NOT EXISTS idx_rate_limit_lookup ON app.rate_limit(key, action, window_end_ts);

COMMENT ON TABLE app.rate_limit IS 'Rate limiting counters per action/key';


-- ─────────────────────────────────────────────────────────────────────────────
-- DEVICE REGISTRY
-- Known devices for trust and fingerprinting
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.known_device (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Ownership
    person_id uuid NOT NULL,

    -- Device identification
    device_id varchar(64) NOT NULL,           -- Fingerprint hash
    device_name varchar(255),                 -- User-provided name "My MacBook"

    -- Device details
    device_type varchar(50),                  -- 'mobile', 'desktop', 'tablet'
    browser varchar(100),
    os varchar(100),

    -- Trust status
    trusted_flag boolean DEFAULT false,       -- Skip MFA on this device
    trust_expires_ts timestamptz,             -- Trust expiration (30 days default)

    -- Usage
    first_seen_ts timestamptz DEFAULT now(),
    last_seen_ts timestamptz DEFAULT now(),
    login_count integer DEFAULT 1,

    -- Status
    active_flag boolean DEFAULT true,
    blocked_flag boolean DEFAULT false,
    blocked_reason varchar(100),

    CONSTRAINT fk_known_device_person FOREIGN KEY (person_id)
        REFERENCES app.person(id) ON DELETE CASCADE,
    CONSTRAINT uq_known_device UNIQUE (person_id, device_id)
);

-- Index for device lookups
CREATE INDEX IF NOT EXISTS idx_known_device_lookup ON app.known_device(person_id, device_id) WHERE active_flag = true;

COMMENT ON TABLE app.known_device IS 'Known and trusted devices per user';


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- CLEANUP FUNCTIONS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Function to clean up expired tokens and challenges
CREATE OR REPLACE FUNCTION app.cleanup_expired_auth_data()
RETURNS void AS $$
BEGIN
    -- Delete expired token blacklist entries
    DELETE FROM app.token_blacklist WHERE expires_ts < NOW();

    -- Delete expired refresh tokens (keep revoked ones for audit)
    DELETE FROM app.refresh_token
    WHERE expires_ts < NOW() - INTERVAL '7 days';

    -- Delete expired WebAuthn challenges
    DELETE FROM app.webauthn_challenge WHERE expires_ts < NOW();

    -- Delete expired OAuth states
    DELETE FROM app.oauth_state WHERE expires_ts < NOW();

    -- Delete old rate limit entries
    DELETE FROM app.rate_limit WHERE window_end_ts < NOW() - INTERVAL '1 hour';

    -- Deactivate expired sessions
    UPDATE app.user_session
    SET active_flag = false, terminated_reason = 'expired', terminated_ts = NOW()
    WHERE expires_ts < NOW() AND active_flag = true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION app.cleanup_expired_auth_data IS 'Cleanup expired auth data - run daily via cron';
