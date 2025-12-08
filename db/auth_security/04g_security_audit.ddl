-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Security Audit Log
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- PURPOSE:
-- Immutable audit trail for all security-relevant events. Supports
-- compliance requirements, incident investigation, and anomaly detection.
--
-- IMMUTABILITY:
-- This table should have NO UPDATE or DELETE permissions for the app role.
-- Only INSERT allowed. Data retention handled by archival process.
--
-- EVENT CATEGORIES:
-- - authentication: login, logout, MFA, passkey
-- - account: password change, email change, MFA setup
-- - session: create, revoke, refresh
-- - authorization: permission/role changes
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
