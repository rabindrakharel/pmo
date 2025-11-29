-- db/system/system_notify.ddl
-- ============================================================================
-- PostgreSQL NOTIFY/LISTEN for Real-Time Cache Invalidation
-- ============================================================================
-- Replaces 60-second polling with instant push notifications
--
-- Architecture:
--   1. Entity tables → log_entity_change trigger → system_logging table
--   2. system_logging INSERT → notify_entity_change trigger → NOTIFY channel
--   3. PubSub service LISTEN → WebSocket push to subscribers
-- ============================================================================

-- ============================================================================
-- NOTIFY Trigger Function
-- ============================================================================
-- Fires on INSERT to system_logging, sends payload to 'entity_changes' channel

CREATE OR REPLACE FUNCTION app.notify_entity_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Skip VIEW actions (action = 0) - no cache invalidation needed
    IF NEW.action = 0 THEN
        RETURN NEW;
    END IF;

    -- Send notification with JSON payload
    -- Channel: 'entity_changes'
    -- Payload: JSON with entity_code, entity_id, action, log_id
    PERFORM pg_notify(
        'entity_changes',
        json_build_object(
            'log_id', NEW.id,
            'entity_code', NEW.entity_code,
            'entity_id', NEW.entity_id,
            'action', NEW.action,
            'timestamp', extract(epoch from NEW.created_ts)::bigint
        )::text
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION app.notify_entity_change IS
    'Sends pg_notify on entity_changes channel when non-VIEW logs are inserted';

-- ============================================================================
-- Trigger on system_logging
-- ============================================================================

DROP TRIGGER IF EXISTS notify_system_logging_changes ON app.system_logging;

CREATE TRIGGER notify_system_logging_changes
    AFTER INSERT ON app.system_logging
    FOR EACH ROW
    EXECUTE FUNCTION app.notify_entity_change();

COMMENT ON TRIGGER notify_system_logging_changes ON app.system_logging IS
    'Real-time notification trigger for cache invalidation via PubSub';

-- ============================================================================
-- Helper Function: Manual Notify (for testing/debugging)
-- ============================================================================

CREATE OR REPLACE FUNCTION app.manual_notify(
    p_entity_code VARCHAR,
    p_entity_id UUID,
    p_action SMALLINT DEFAULT 1
)
RETURNS void AS $$
BEGIN
    PERFORM pg_notify(
        'entity_changes',
        json_build_object(
            'log_id', gen_random_uuid(),
            'entity_code', p_entity_code,
            'entity_id', p_entity_id,
            'action', p_action,
            'timestamp', extract(epoch from now())::bigint
        )::text
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION app.manual_notify IS
    'Manually send a notify for testing. Usage: SELECT app.manual_notify(''project'', ''uuid-here'', 1);';

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this in psql to verify trigger is active:
-- SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'notify_system_logging_changes';
