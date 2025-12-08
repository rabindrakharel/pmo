-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Known Device Registry
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- PURPOSE:
-- Track known devices per user for trust and security decisions.
-- Trusted devices can skip MFA, unknown devices trigger additional
-- verification.
--
-- FEATURES:
-- - Device fingerprinting and naming
-- - Trust status with expiration
-- - Login history per device
-- - Device blocking capability
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
