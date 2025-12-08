-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- WebAuthn Challenges
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- PURPOSE:
-- Temporary storage for WebAuthn/Passkey registration and authentication
-- challenges. Short-lived entries (5 minute TTL) for security.
--
-- FLOW:
-- 1. Server generates challenge, stores here
-- 2. Client signs challenge with passkey
-- 3. Server verifies, marks as used
-- 4. Cleanup job removes expired entries
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
