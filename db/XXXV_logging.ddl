-- db/XXXV_logging.ddl
-- ============================================================================
-- Audit Logging Table with Sync Status Tracking
-- ============================================================================
-- Captures all entity changes for:
-- 1. Audit trail (who changed what, when)
-- 2. PubSub sync (LogWatcher polls pending changes)
-- ============================================================================

CREATE TABLE app.logging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- ========================================================================
    -- Actor (WHO made the change)
    -- ========================================================================
    person_id UUID,                                    -- User UUID (nullable for system actions)
    fname VARCHAR(100),                                -- First name (denormalized for audit)
    lname VARCHAR(100),                                -- Last name (denormalized for audit)
    username VARCHAR(255),                             -- Email/username
    person_type VARCHAR(50) CHECK (person_type IN ('employee', 'customer', 'system', 'guest')),

    -- ========================================================================
    -- Request Context
    -- ========================================================================
    api_endpoint VARCHAR(500),                         -- e.g., '/api/v1/project/uuid'
    http_method VARCHAR(10),                           -- GET, POST, PATCH, DELETE

    -- ========================================================================
    -- Target Entity (WHAT was changed) - Required for sync
    -- ========================================================================
    entity_code VARCHAR(100) NOT NULL,                 -- Entity type: 'project', 'task', etc.
    entity_id UUID NOT NULL,                           -- Entity instance UUID
    action SMALLINT NOT NULL CHECK (action BETWEEN 0 AND 5),
    -- Action codes match Permission enum:
    -- 0 = VIEW (not synced)
    -- 1 = EDIT
    -- 2 = SHARE
    -- 3 = DELETE
    -- 4 = CREATE
    -- 5 = OWNER (permission change)

    -- ========================================================================
    -- State Snapshots (optional, for detailed audit)
    -- ========================================================================
    entity_from_version JSONB,                         -- Before state (UPDATE/DELETE)
    entity_to_version JSONB,                           -- After state (INSERT/UPDATE)

    -- ========================================================================
    -- Security Context
    -- ========================================================================
    user_agent TEXT,                                   -- Browser/client info
    ip INET,                                           -- Client IP address

    -- ========================================================================
    -- Timestamps
    -- ========================================================================
    created_ts TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- ========================================================================
    -- Sync Status (for PubSub LogWatcher)
    -- ========================================================================
    sync_status VARCHAR(20) DEFAULT 'pending',         -- pending, sent, skipped
    sync_processed_ts TIMESTAMPTZ                      -- When sync was processed
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Primary index for LogWatcher polling
-- Only pending changes that aren't VIEW actions
CREATE INDEX idx_logging_sync_pending
    ON app.logging(created_ts)
    WHERE sync_status = 'pending' AND action != 0;

-- Fast lookup for entity history (audit queries)
CREATE INDEX idx_logging_entity
    ON app.logging(entity_code, entity_id, created_ts DESC);

-- Fast lookup for user activity (audit queries)
CREATE INDEX idx_logging_person
    ON app.logging(person_id, created_ts DESC)
    WHERE person_id IS NOT NULL;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE app.logging IS
    'Audit log capturing entity changes. Used for audit trail and PubSub sync.';

COMMENT ON COLUMN app.logging.entity_code IS
    'Entity type code (project, task, employee, etc.)';

COMMENT ON COLUMN app.logging.entity_id IS
    'UUID of the entity instance that was changed';

COMMENT ON COLUMN app.logging.action IS
    'Action type: 0=VIEW, 1=EDIT, 2=SHARE, 3=DELETE, 4=CREATE, 5=OWNER';

COMMENT ON COLUMN app.logging.sync_status IS
    'PubSub sync status: pending (not yet pushed), sent (pushed to subscribers), skipped (no subscribers)';

-- ============================================================================
-- Trigger Function for Automatic Logging
-- ============================================================================

CREATE OR REPLACE FUNCTION app.log_entity_change()
RETURNS TRIGGER AS $$
DECLARE
    v_action SMALLINT;
    v_person_id UUID;
BEGIN
    -- Determine action type
    v_action := CASE TG_OP
        WHEN 'INSERT' THEN 4  -- CREATE
        WHEN 'UPDATE' THEN 1  -- EDIT
        WHEN 'DELETE' THEN 3  -- DELETE
    END;

    -- Get person from session context (set by API middleware via SET LOCAL)
    v_person_id := NULLIF(current_setting('app.current_user_id', true), '')::UUID;

    -- Insert log entry
    INSERT INTO app.logging (
        person_id,
        entity_code,
        entity_id,
        action,
        entity_from_version,
        entity_to_version,
        api_endpoint,
        http_method
    ) VALUES (
        v_person_id,
        TG_ARGV[0],  -- entity_code passed as trigger argument
        COALESCE(NEW.id, OLD.id),
        v_action,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END,
        NULLIF(current_setting('app.current_endpoint', true), ''),
        NULLIF(current_setting('app.current_method', true), '')
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION app.log_entity_change IS
    'Trigger function to automatically log entity changes. Pass entity_code as first argument.';

-- ============================================================================
-- Entity Change Triggers
-- ============================================================================
-- Apply to each entity table that should be synced

CREATE TRIGGER log_project_changes
    AFTER INSERT OR UPDATE OR DELETE ON app.project
    FOR EACH ROW EXECUTE FUNCTION app.log_entity_change('project');

CREATE TRIGGER log_task_changes
    AFTER INSERT OR UPDATE OR DELETE ON app.task
    FOR EACH ROW EXECUTE FUNCTION app.log_entity_change('task');

CREATE TRIGGER log_employee_changes
    AFTER INSERT OR UPDATE OR DELETE ON app.employee
    FOR EACH ROW EXECUTE FUNCTION app.log_entity_change('employee');

CREATE TRIGGER log_role_changes
    AFTER INSERT OR UPDATE OR DELETE ON app.role
    FOR EACH ROW EXECUTE FUNCTION app.log_entity_change('role');

CREATE TRIGGER log_business_changes
    AFTER INSERT OR UPDATE OR DELETE ON app.business
    FOR EACH ROW EXECUTE FUNCTION app.log_entity_change('business');

CREATE TRIGGER log_office_changes
    AFTER INSERT OR UPDATE OR DELETE ON app.office
    FOR EACH ROW EXECUTE FUNCTION app.log_entity_change('office');

CREATE TRIGGER log_worksite_changes
    AFTER INSERT OR UPDATE OR DELETE ON app.worksite
    FOR EACH ROW EXECUTE FUNCTION app.log_entity_change('worksite');

CREATE TRIGGER log_customer_changes
    AFTER INSERT OR UPDATE OR DELETE ON app.cust
    FOR EACH ROW EXECUTE FUNCTION app.log_entity_change('customer');

-- ============================================================================
-- Cleanup Function
-- ============================================================================

CREATE OR REPLACE FUNCTION app.cleanup_old_logs(p_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM app.logging
    WHERE created_ts < now() - (p_days || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION app.cleanup_old_logs IS
    'Delete logs older than specified days (default 90). Run periodically for maintenance.';

-- ============================================================================
-- Statistics Function
-- ============================================================================

CREATE OR REPLACE FUNCTION app.get_logging_stats()
RETURNS TABLE(
    sync_status VARCHAR,
    count BIGINT,
    oldest_ts TIMESTAMPTZ,
    newest_ts TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        l.sync_status,
        COUNT(*) as count,
        MIN(l.created_ts) as oldest_ts,
        MAX(l.created_ts) as newest_ts
    FROM app.logging l
    GROUP BY l.sync_status
    ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION app.get_logging_stats IS
    'Get sync status statistics for monitoring LogWatcher health.';
