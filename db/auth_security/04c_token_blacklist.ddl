-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Token Blacklist
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- PURPOSE:
-- Immediate revocation of access tokens (JWTs) before their natural expiry.
-- Used for logout, password changes, and security events.
--
-- NOTE:
-- Entries are auto-cleaned after token's natural expiration time.
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
