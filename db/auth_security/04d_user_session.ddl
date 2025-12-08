-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- User Session Management
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- PURPOSE:
-- Server-side session tracking with device information, location,
-- and risk assessment. Enables "active sessions" view for users.
--
-- FEATURES:
-- - Device fingerprinting and tracking
-- - Geolocation from IP
-- - Risk scoring for suspicious sessions
-- - Activity timestamps for session management
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
