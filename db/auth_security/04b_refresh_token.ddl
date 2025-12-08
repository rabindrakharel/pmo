-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Refresh Token Management
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- PURPOSE:
-- Implements refresh token rotation with reuse detection for secure
-- token-based authentication. Tokens are single-use and tracked by family.
--
-- SECURITY FEATURES:
-- - Single-use refresh tokens (rotation on every use)
-- - Token family tracking (detect stolen token reuse)
-- - Device binding for tokens
-- - SHA256 hashed storage (never plaintext)
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
