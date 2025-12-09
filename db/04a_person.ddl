-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- app.person - Centralized Authentication & Identity Hub
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- PURPOSE:
-- Central authentication table for ALL person types. This table is the SINGLE
-- source of truth for authentication, security, MFA, RBAC, and notification.
-- Personal details (name, address) are stored in entity-specific tables.
--
-- entity_code values: 'employee', 'customer', 'vendor', 'supplier'
-- NOTE: Roles are NOT persons. Role membership is via entity_instance_link.
--
-- DESIGN PRINCIPLES:
-- • Auth Centralization: ALL passwords, MFA, security questions stored HERE
-- • Identity Hub: Links to employee/customer/supplier via person_id FK
-- • No Personal Details: first_name, last_name, address are in entity tables
-- • Security First: Next-gen auth (passkeys, biometrics, trusted devices)
-- • Audit Trail: Complete login history, device tracking, session management
--
-- AUTHENTICATION FLOW:
-- 1. Login request → Query person by email
-- 2. Verify password_hash via bcrypt
-- 3. Check MFA if enabled → verify TOTP/backup code
-- 4. Generate JWT with person.id as subject
-- 5. Update login history, session tracking
--
-- RELATIONSHIPS:
-- • Children: employee.person_id, customer.person_id, supplier.person_id
-- • Role Membership: entity_instance_link (entity_code='role', child_entity_code='person')
-- • Notifications: All messaging/email targets this table
--
-- RBAC MODEL (v2.0.0):
-- Permissions are granted to ROLES (not directly to persons).
-- Persons inherit permissions through role membership via entity_instance_link.
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS app.person (
    -- ─────────────────────────────────────────────────────────────────────────
    -- Standard Entity Fields
    -- ─────────────────────────────────────────────────────────────────────────
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(100),
    name varchar(255), -- Display name (copied from employee/customer for convenience)

    -- ─────────────────────────────────────────────────────────────────────────
    -- Entity Type (which entity table this person belongs to)
    -- ─────────────────────────────────────────────────────────────────────────
    entity_code varchar(100), -- 'employee', 'customer', 'vendor', 'supplier'

    -- ─────────────────────────────────────────────────────────────────────────
    -- Primary Authentication Identifier
    -- ─────────────────────────────────────────────────────────────────────────
    email varchar(255) NOT NULL, -- Login email (primary auth identifier)

    -- ─────────────────────────────────────────────────────────────────────────
    -- Password Authentication
    -- ─────────────────────────────────────────────────────────────────────────
    password_hash varchar(255), -- bcrypt hashed password
    password_changed_ts timestamptz, -- Last password change
    force_password_change_flag boolean DEFAULT false, -- Require password change on next login
    password_history jsonb DEFAULT '[]'::jsonb, -- Previous password hashes (prevent reuse)

    -- ─────────────────────────────────────────────────────────────────────────
    -- Password Reset
    -- ─────────────────────────────────────────────────────────────────────────
    password_reset_token varchar(255), -- Secure reset token
    password_reset_expires_ts timestamptz, -- Token expiration (1 hour)

    -- ─────────────────────────────────────────────────────────────────────────
    -- Account Security & Lockout
    -- ─────────────────────────────────────────────────────────────────────────
    failed_login_attempts integer DEFAULT 0, -- Count of failed attempts
    account_locked_until_ts timestamptz, -- Temporary lockout timestamp
    account_locked_reason text, -- Why account was locked
    permanent_lock_flag boolean DEFAULT false, -- Admin-initiated permanent lock

    -- ─────────────────────────────────────────────────────────────────────────
    -- Multi-Factor Authentication (MFA)
    -- ─────────────────────────────────────────────────────────────────────────
    mfa_enabled_flag boolean DEFAULT false, -- MFA active
    mfa_method varchar(50) DEFAULT 'totp', -- 'totp', 'sms', 'email', 'authenticator'
    mfa_secret varchar(255), -- TOTP secret key (encrypted)
    mfa_backup_codes jsonb DEFAULT '[]'::jsonb, -- One-time backup codes
    mfa_backup_codes_generated_ts timestamptz, -- When backup codes were generated
    mfa_last_verified_ts timestamptz, -- Last successful MFA verification

    -- ─────────────────────────────────────────────────────────────────────────
    -- Security Questions (Account Recovery)
    -- ─────────────────────────────────────────────────────────────────────────
    security_questions jsonb DEFAULT '[]'::jsonb,
    -- Structure: [{"question": "...", "answer_hash": "..."}]
    security_questions_set_ts timestamptz, -- When questions were set

    -- ─────────────────────────────────────────────────────────────────────────
    -- Email Verification
    -- ─────────────────────────────────────────────────────────────────────────
    email_verified_flag boolean DEFAULT false, -- Email confirmed
    email_verification_token varchar(255), -- Verification token
    email_verification_expires_ts timestamptz, -- Token expiration
    email_verified_ts timestamptz, -- When email was verified

    -- ─────────────────────────────────────────────────────────────────────────
    -- Phone Verification (for MFA/2FA)
    -- ─────────────────────────────────────────────────────────────────────────
    phone_number varchar(50), -- Phone for MFA (not contact - that's in entity table)
    phone_verified_flag boolean DEFAULT false, -- Phone confirmed
    phone_verification_code varchar(10), -- SMS verification code
    phone_verification_expires_ts timestamptz, -- Code expiration
    phone_verified_ts timestamptz, -- When phone was verified

    -- ─────────────────────────────────────────────────────────────────────────
    -- Account Recovery
    -- ─────────────────────────────────────────────────────────────────────────
    recovery_email varchar(255), -- Backup email for account recovery
    recovery_email_verified_flag boolean DEFAULT false,
    recovery_phone varchar(50), -- Backup phone for account recovery
    recovery_phone_verified_flag boolean DEFAULT false,

    -- ─────────────────────────────────────────────────────────────────────────
    -- Trusted Devices & Sessions
    -- ─────────────────────────────────────────────────────────────────────────
    trusted_devices jsonb DEFAULT '[]'::jsonb,
    -- Structure: [{"device_id": "...", "name": "...", "trusted_ts": "...", "last_used_ts": "...", "user_agent": "..."}]
    max_sessions integer DEFAULT 5, -- Maximum concurrent sessions
    active_sessions jsonb DEFAULT '[]'::jsonb,
    -- Structure: [{"session_id": "...", "device_id": "...", "created_ts": "...", "expires_ts": "...", "ip_address": "..."}]

    -- ─────────────────────────────────────────────────────────────────────────
    -- WebAuthn / Passkeys (Passwordless)
    -- ─────────────────────────────────────────────────────────────────────────
    passkey_enabled_flag boolean DEFAULT false,
    passkey_credentials jsonb DEFAULT '[]'::jsonb,
    -- Structure: [{"credential_id": "...", "public_key": "...", "name": "...", "created_ts": "...", "last_used_ts": "..."}]

    -- ─────────────────────────────────────────────────────────────────────────
    -- Biometric Authentication
    -- ─────────────────────────────────────────────────────────────────────────
    biometric_enabled_flag boolean DEFAULT false,
    biometric_type varchar(50), -- 'fingerprint', 'face_id', 'touch_id'
    biometric_registered_ts timestamptz,

    -- ─────────────────────────────────────────────────────────────────────────
    -- Login History & Audit
    -- ─────────────────────────────────────────────────────────────────────────
    last_login_ts timestamptz, -- Most recent successful login
    last_login_ip varchar(45), -- IPv4 or IPv6
    last_login_device varchar(255), -- User agent / device info
    last_login_location jsonb, -- Geo-location data
    login_count integer DEFAULT 0, -- Total successful logins
    login_history jsonb DEFAULT '[]'::jsonb,
    -- Structure: [{"ts": "...", "ip": "...", "device": "...", "location": {...}, "success": true/false}]

    -- ─────────────────────────────────────────────────────────────────────────
    -- Notification Preferences
    -- ─────────────────────────────────────────────────────────────────────────
    notification_preferences jsonb DEFAULT '{
        "email": true,
        "sms": false,
        "push": true,
        "login_alerts": true,
        "security_alerts": true,
        "marketing": false
    }'::jsonb,

    -- ─────────────────────────────────────────────────────────────────────────
    -- Terms of Service / Privacy Policy
    -- ─────────────────────────────────────────────────────────────────────────
    tos_accepted_flag boolean DEFAULT false,
    tos_accepted_ts timestamptz,
    tos_version varchar(20), -- Version of TOS accepted
    privacy_policy_accepted_flag boolean DEFAULT false,
    privacy_policy_accepted_ts timestamptz,
    privacy_policy_version varchar(20),

    -- ─────────────────────────────────────────────────────────────────────────
    -- GDPR / Data Privacy
    -- ─────────────────────────────────────────────────────────────────────────
    data_export_requested_ts timestamptz, -- GDPR data export request
    data_deletion_requested_ts timestamptz, -- GDPR deletion request
    data_processing_consent_flag boolean DEFAULT true,

    -- ─────────────────────────────────────────────────────────────────────────
    -- Entity References (NO FKs for loose coupling)
    -- The entity-specific table holds person_id as FK back to this table
    -- These are convenience reverse references (optional, for quick lookups)
    -- ─────────────────────────────────────────────────────────────────────────
    employee_id uuid, -- If entity_code='employee', points to employee.id
    customer_id uuid, -- If entity_code='customer', points to customer.id
    supplier_id uuid, -- If entity_code='supplier', points to supplier.id
    -- NOTE: No role_id column. Role membership is via entity_instance_link.

    -- ─────────────────────────────────────────────────────────────────────────
    -- Standard Metadata & Temporal Fields
    -- ─────────────────────────────────────────────────────────────────────────
    metadata jsonb DEFAULT '{}',
    active_flag boolean DEFAULT true,
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Indexes for Authentication Performance
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Primary authentication lookup (login by email)
CREATE UNIQUE INDEX IF NOT EXISTS idx_person_email ON app.person(email) WHERE active_flag = true;

-- Entity type filtering
CREATE INDEX IF NOT EXISTS idx_person_entity_code ON app.person(entity_code) WHERE active_flag = true;

-- Password reset token lookup
CREATE INDEX IF NOT EXISTS idx_person_reset_token ON app.person(password_reset_token) WHERE password_reset_token IS NOT NULL;

-- Email verification token lookup
CREATE INDEX IF NOT EXISTS idx_person_email_verification ON app.person(email_verification_token) WHERE email_verification_token IS NOT NULL;

-- Entity reference lookups
CREATE INDEX IF NOT EXISTS idx_person_employee_id ON app.person(employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_person_customer_id ON app.person(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_person_supplier_id ON app.person(supplier_id) WHERE supplier_id IS NOT NULL;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Comments
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMMENT ON TABLE app.person IS 'Centralized authentication hub for all person types (employees, customers, suppliers). Stores auth, MFA, security. Role membership via entity_instance_link (entity_code=role, child=person). Personal details stored in entity-specific tables.';
COMMENT ON COLUMN app.person.id IS 'Unique identifier (UUID) - used as JWT subject';
COMMENT ON COLUMN app.person.code IS 'Unique person code (e.g., PER-00001)';
COMMENT ON COLUMN app.person.name IS 'Display name (copied from employee/customer for convenience in role membership)';
COMMENT ON COLUMN app.person.entity_code IS 'Entity type code: employee, customer, vendor, supplier (NOT role - roles are separate entities)';
COMMENT ON COLUMN app.person.email IS 'Primary email - login identifier (unique per active person)';
COMMENT ON COLUMN app.person.password_hash IS 'Bcrypt hashed password (cost 12)';
COMMENT ON COLUMN app.person.password_changed_ts IS 'Timestamp of last password change';
COMMENT ON COLUMN app.person.force_password_change_flag IS 'If true, user must change password on next login';
COMMENT ON COLUMN app.person.password_history IS 'Array of previous password hashes to prevent reuse';
COMMENT ON COLUMN app.person.password_reset_token IS 'Secure token for password reset (expires in 1 hour)';
COMMENT ON COLUMN app.person.password_reset_expires_ts IS 'Password reset token expiration timestamp';
COMMENT ON COLUMN app.person.failed_login_attempts IS 'Count of consecutive failed login attempts';
COMMENT ON COLUMN app.person.account_locked_until_ts IS 'Temporary lockout expires at this timestamp';
COMMENT ON COLUMN app.person.account_locked_reason IS 'Reason for account lock (failed_attempts, admin, suspicious)';
COMMENT ON COLUMN app.person.permanent_lock_flag IS 'Admin-initiated permanent account lock';
COMMENT ON COLUMN app.person.mfa_enabled_flag IS 'Whether MFA is enabled for this account';
COMMENT ON COLUMN app.person.mfa_method IS 'MFA method: totp, sms, email, authenticator';
COMMENT ON COLUMN app.person.mfa_secret IS 'TOTP secret key (should be encrypted at rest)';
COMMENT ON COLUMN app.person.mfa_backup_codes IS 'Array of one-time backup codes for MFA recovery';
COMMENT ON COLUMN app.person.security_questions IS 'Array of security Q&A for account recovery';
COMMENT ON COLUMN app.person.email_verified_flag IS 'Whether email has been verified';
COMMENT ON COLUMN app.person.phone_number IS 'Phone number for MFA verification (not contact phone)';
COMMENT ON COLUMN app.person.phone_verified_flag IS 'Whether phone has been verified for MFA';
COMMENT ON COLUMN app.person.trusted_devices IS 'Array of trusted devices (skip MFA on trusted)';
COMMENT ON COLUMN app.person.passkey_enabled_flag IS 'Whether WebAuthn/Passkey authentication is enabled';
COMMENT ON COLUMN app.person.passkey_credentials IS 'WebAuthn credential data for passwordless login';
COMMENT ON COLUMN app.person.biometric_enabled_flag IS 'Whether biometric authentication is enabled';
COMMENT ON COLUMN app.person.last_login_ts IS 'Timestamp of most recent successful login';
COMMENT ON COLUMN app.person.login_history IS 'Array of recent login attempts with details';
COMMENT ON COLUMN app.person.notification_preferences IS 'User notification settings';
COMMENT ON COLUMN app.person.tos_accepted_flag IS 'Whether Terms of Service were accepted';
COMMENT ON COLUMN app.person.data_processing_consent_flag IS 'GDPR consent for data processing';
COMMENT ON COLUMN app.person.employee_id IS 'Reference to employee.id if entity_code=employee';
COMMENT ON COLUMN app.person.customer_id IS 'Reference to customer.id if entity_code=customer';
COMMENT ON COLUMN app.person.supplier_id IS 'Reference to supplier.id if entity_code=supplier';
COMMENT ON COLUMN app.person.active_flag IS 'Soft delete flag (true = active)';
