-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Authentication Cleanup Functions
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- PURPOSE:
-- Scheduled cleanup of expired authentication data. Should be run
-- daily via pg_cron or external scheduler.
--
-- CLEANUP TARGETS:
-- - Token blacklist entries (after natural expiry)
-- - Refresh tokens (7 days after expiry)
-- - WebAuthn challenges (after expiry)
-- - OAuth states (after expiry)
-- - Rate limit entries (1 hour after window)
-- - Expired sessions (mark inactive)
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
