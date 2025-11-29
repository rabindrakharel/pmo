-- db/system/system_cache_subscription.ddl
-- ============================================================================
-- System Cache Subscription Tracking
-- ============================================================================
-- Tracks which entity instances each connected user is subscribed to.
-- This table is EPHEMERAL - cleared on server restart or user disconnect.
-- Replaces in-memory Map with database table for multi-pod support.
-- ============================================================================

CREATE TABLE app.system_cache_subscription (
    -- Composite primary key
    user_id UUID NOT NULL,
    entity_code VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,

    -- Connection tracking
    connection_id VARCHAR(50) NOT NULL,  -- WebSocket connection identifier

    -- Timestamps
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Primary key on the three main columns
    PRIMARY KEY (user_id, entity_code, entity_id)
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Fast lookup: "Who is subscribed to this entity?" (used by LogWatcher)
CREATE INDEX idx_system_cache_subscription_entity
    ON app.system_cache_subscription(entity_code, entity_id);

-- Fast cleanup: "Remove all subscriptions for this user" (on disconnect)
CREATE INDEX idx_system_cache_subscription_user
    ON app.system_cache_subscription(user_id);

-- Fast cleanup: "Remove all subscriptions for this connection" (on disconnect)
CREATE INDEX idx_system_cache_subscription_connection
    ON app.system_cache_subscription(connection_id);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE app.system_cache_subscription IS
    'Ephemeral table tracking live WebSocket subscriptions for cache sync. Cleared on disconnect.';

COMMENT ON COLUMN app.system_cache_subscription.user_id IS
    'The user (employee) who is subscribed';

COMMENT ON COLUMN app.system_cache_subscription.entity_code IS
    'Entity type code (project, task, employee, etc.)';

COMMENT ON COLUMN app.system_cache_subscription.entity_id IS
    'Specific entity instance UUID the user is watching';

COMMENT ON COLUMN app.system_cache_subscription.connection_id IS
    'WebSocket connection ID - allows cleanup when connection drops';

COMMENT ON COLUMN app.system_cache_subscription.subscribed_at IS
    'When the subscription was created';

-- ============================================================================
-- Cleanup Functions
-- ============================================================================

-- Function to clean up all subscriptions for a user
CREATE OR REPLACE FUNCTION app.cleanup_user_subscriptions(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM app.system_cache_subscription
    WHERE user_id = p_user_id;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up all subscriptions for a connection
CREATE OR REPLACE FUNCTION app.cleanup_connection_subscriptions(p_connection_id VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM app.system_cache_subscription
    WHERE connection_id = p_connection_id;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean stale subscriptions (older than X hours - safety net)
CREATE OR REPLACE FUNCTION app.cleanup_stale_subscriptions(p_hours INTEGER DEFAULT 24)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM app.system_cache_subscription
    WHERE subscribed_at < now() - (p_hours || ' hours')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Bulk Operations (Optimized)
-- ============================================================================

-- Function to subscribe to multiple entities at once
CREATE OR REPLACE FUNCTION app.bulk_subscribe(
    p_user_id UUID,
    p_connection_id VARCHAR,
    p_entity_code VARCHAR,
    p_entity_ids UUID[]
)
RETURNS INTEGER AS $$
DECLARE
    inserted_count INTEGER;
BEGIN
    INSERT INTO app.system_cache_subscription (user_id, entity_code, entity_id, connection_id)
    SELECT p_user_id, p_entity_code, unnest(p_entity_ids), p_connection_id
    ON CONFLICT (user_id, entity_code, entity_id)
    DO UPDATE SET
        connection_id = EXCLUDED.connection_id,
        subscribed_at = now();

    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to unsubscribe from multiple entities at once
CREATE OR REPLACE FUNCTION app.bulk_unsubscribe(
    p_user_id UUID,
    p_entity_code VARCHAR,
    p_entity_ids UUID[]
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM app.system_cache_subscription
    WHERE user_id = p_user_id
      AND entity_code = p_entity_code
      AND entity_id = ANY(p_entity_ids);

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Query Functions (Used by LogWatcher)
-- ============================================================================

-- Get all users subscribed to a specific entity instance
CREATE OR REPLACE FUNCTION app.get_entity_subscribers(
    p_entity_code VARCHAR,
    p_entity_id UUID
)
RETURNS TABLE(user_id UUID, connection_id VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT s.user_id, s.connection_id
    FROM app.system_cache_subscription s
    WHERE s.entity_code = p_entity_code
      AND s.entity_id = p_entity_id;
END;
$$ LANGUAGE plpgsql;

-- Get all users subscribed to ANY of the given entity instances (batch)
-- Returns: user_id, entity_ids[] they're subscribed to from the input list
CREATE OR REPLACE FUNCTION app.get_batch_subscribers(
    p_entity_code VARCHAR,
    p_entity_ids UUID[]
)
RETURNS TABLE(
    user_id UUID,
    connection_id VARCHAR,
    subscribed_entity_ids UUID[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.user_id,
        s.connection_id,
        array_agg(s.entity_id) as subscribed_entity_ids
    FROM app.system_cache_subscription s
    WHERE s.entity_code = p_entity_code
      AND s.entity_id = ANY(p_entity_ids)
    GROUP BY s.user_id, s.connection_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Statistics
-- ============================================================================

-- Get subscription statistics
CREATE OR REPLACE FUNCTION app.get_subscription_stats()
RETURNS TABLE(
    entity_code VARCHAR,
    unique_entities BIGINT,
    unique_users BIGINT,
    total_subscriptions BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.entity_code,
        COUNT(DISTINCT s.entity_id) as unique_entities,
        COUNT(DISTINCT s.user_id) as unique_users,
        COUNT(*) as total_subscriptions
    FROM app.system_cache_subscription s
    GROUP BY s.entity_code
    ORDER BY total_subscriptions DESC;
END;
$$ LANGUAGE plpgsql;
