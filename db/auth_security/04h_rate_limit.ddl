-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Rate Limiting
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- PURPOSE:
-- Track rate limits per IP/user for sensitive actions. Prevents brute
-- force attacks on login, password reset, and other critical endpoints.
--
-- SLIDING WINDOW:
-- Uses a sliding window approach where each (key, action) pair has
-- a count and window timestamps. Cleanup removes old entries.
--
-- ACTIONS TRACKED:
-- - login: Authentication attempts
-- - password_reset: Password reset requests
-- - mfa_verify: MFA code verification attempts
-- - api_request: General API rate limiting
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
