-- ============================================================================
-- PMO Platform - Central Audit Logging Table
-- ============================================================================
-- FILE: LI_f_logging.ddl
-- PURPOSE: Comprehensive audit trail for all entity operations
-- DEPENDENCIES: III_d_employee.ddl, VI_d_cust.ddl, XLV_d_entity.ddl, XLIX_d_entity_id_rbac_map.ddl
-- SCHEMA: app
-- TABLE: f_logging
-- ============================================================================

-- ============================================================================
-- SEMANTICS & BUSINESS RULES
-- ============================================================================
--
-- OVERVIEW:
--   The f_logging table provides a comprehensive, immutable audit trail of all
--   person actions (employees, customers, etc.) performed on entities within the
--   PMO platform. It captures WHO did WHAT, WHEN, WHERE, and HOW for complete
--   compliance and forensic analysis capabilities.
--
-- KEY CONCEPTS:
--   1. **Immutable Log**: Records are never updated or deleted (append-only)
--   2. **Action Alignment**: ACTION codes mirror RBAC permission indices (0-5)
--   3. **Version Tracking**: Captures before/after state for edit operations
--   4. **Security Context**: Stores IP, user agent, and device for forensics
--   5. **Entity Polymorphism**: Works across all 18+ entity types
--   6. **Denormalized Person Data**: Stores fname, lname, username directly (not person_id)
--      to preserve actor identity even if person record is deleted or modified
--
-- ACTION CODE MAPPING (aligned with entity_id_rbac_map):
--   [0] = View:   Read access - user viewed entity details
--   [1] = Edit:   Modify existing entity - user changed field values
--   [2] = Share:  Share entity with others - user granted access to another user
--   [3] = Delete: Soft delete entity - user marked entity as deleted
--   [4] = Create: Create new entities - user created a new entity instance
--   [5] = Owner:  Permission management - user modified RBAC permissions
--
-- VERSIONING STRATEGY:
--   - entity_from_version: JSONB snapshot of entity state BEFORE action
--   - entity_to_version:   JSONB snapshot of entity state AFTER action
--   - For CREATE (4): from_version is NULL, to_version has full new state
--   - For DELETE (3): from_version has full state, to_version marks deleted_at
--   - For EDIT (1): Both versions present, only changed fields stored in to_version
--   - For VIEW (0): Both versions NULL (read-only operation)
--
-- RETENTION & COMPLIANCE:
--   - Logs retained for minimum 7 years for regulatory compliance
--   - Partition by month for efficient querying and archival
--   - Indexes on username, entity_name, entity_id, updated for fast lookups
--   - Denormalized design ensures audit integrity if source person records change
--
-- USAGE PATTERNS:
--   1. Audit trail queries: "Show all actions by person X on project Y"
--   2. Forensic analysis: "Who deleted this task and when?"
--   3. Compliance reporting: "Export all GDPR-relevant access logs"
--   4. Change history: "Show edit history for this form submission"
--   5. Security monitoring: "Flag suspicious IP access patterns"
--   6. Customer activity tracking: "Show all customer portal actions"
--   7. Employee action reports: "Generate employee productivity audit"
--
-- PRIVACY & SECURITY:
--   - PII in version snapshots must be encrypted at rest (future enhancement)
--   - IP addresses hashed for GDPR compliance (future enhancement)
--   - Access to f_logging restricted to admins and compliance officers
--   - Automated alerts for bulk delete/share operations
--
-- INTEGRATION POINTS:
--   - API Middleware: Automatic logging on every entity operation
--   - RBAC System: Validates action codes against user permissions before logging
--   - Entity System: Captures entity state via universal entity API
--   - Notification Service: Triggers alerts on critical actions (delete, share)
--
-- ============================================================================
-- TABLE STRUCTURE
-- ============================================================================

DROP TABLE IF EXISTS app.f_logging CASCADE;

CREATE TABLE app.f_logging (
    -- Primary Identifier
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Actor (WHO performed the action) - Denormalized for immutable audit trail
    fname varchar(100),                 -- First name of person performing action
    lname varchar(100),                 -- Last name of person performing action
    username varchar(255),              -- Username/email identifier
    person_type varchar(50) NOT NULL CHECK (person_type IN ('employee', 'customer', 'system', 'guest')),

    -- Target Entity (WHAT was acted upon)
    entity_name varchar(100) NOT NULL,  -- 'project', 'task', 'employee', etc.
    entity_id uuid NOT NULL,            -- Specific entity instance UUID

    -- Action Type (HOW the entity was accessed/modified)
    action smallint NOT NULL CHECK (action >= 0 AND action <= 5),
    -- 0=View, 1=Edit, 2=Share, 3=Delete, 4=Create, 5=Owner

    -- Temporal (WHEN the action occurred)
    updated timestamptz NOT NULL DEFAULT now(),

    -- Versioning (State Snapshots)
    entity_from_version jsonb,          -- Entity state BEFORE action (NULL for create/view)
    entity_to_version jsonb,            -- Entity state AFTER action (NULL for view/delete)

    -- Security Context (WHERE and from WHAT device)
    user_agent text,                    -- Browser/client user agent string
    ip inet,                            -- IP address (v4 or v6)
    device_name varchar(255),           -- Device identifier (e.g., "MacBook Pro", "iPhone 13")

    -- Audit Metadata
    created_at timestamptz NOT NULL DEFAULT now(),
    log_source varchar(50) DEFAULT 'api' -- 'api', 'web', 'mobile', 'system'
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Primary query patterns: Filter by person, entity, time range, action type, person type

-- Index for username-specific queries: "Show all actions by james.miller@huronhome.ca"
CREATE INDEX idx_f_logging_username ON app.f_logging(username, updated DESC);

-- Index for person name queries: "Show all actions by John Doe"
CREATE INDEX idx_f_logging_person_name ON app.f_logging(lname, fname, updated DESC);

-- Index for person type queries: "Show all customer actions"
CREATE INDEX idx_f_logging_person_type ON app.f_logging(person_type, updated DESC);

-- Index for entity-specific queries: "Show audit trail for project abc-123"
CREATE INDEX idx_f_logging_entity ON app.f_logging(entity_name, entity_id, updated DESC);

-- Index for time-based queries: "Show all actions in last 30 days"
CREATE INDEX idx_f_logging_updated ON app.f_logging(updated DESC);

-- Index for action-specific queries: "Show all deletes in last week"
CREATE INDEX idx_f_logging_action ON app.f_logging(action, updated DESC);

-- Index for security monitoring: "Show all access from suspicious IPs"
CREATE INDEX idx_f_logging_ip ON app.f_logging(ip, updated DESC);

-- Composite index for common filtered queries
CREATE INDEX idx_f_logging_composite ON app.f_logging(username, person_type, entity_name, action, updated DESC);

-- ============================================================================
-- COMMENTS FOR SCHEMA DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE app.f_logging IS 'Central audit trail logging all person actions on entities. Immutable, append-only records for compliance and forensic analysis. Person data denormalized for audit integrity.';

COMMENT ON COLUMN app.f_logging.id IS 'Unique log entry identifier (UUID)';
COMMENT ON COLUMN app.f_logging.fname IS 'First name of person performing action (denormalized for immutability)';
COMMENT ON COLUMN app.f_logging.lname IS 'Last name of person performing action (denormalized for immutability)';
COMMENT ON COLUMN app.f_logging.username IS 'Username/email of person performing action (denormalized for immutability)';
COMMENT ON COLUMN app.f_logging.person_type IS 'Type of person performing action (employee, customer, system, guest)';
COMMENT ON COLUMN app.f_logging.entity_name IS 'Type of entity acted upon (e.g., project, task, client)';
COMMENT ON COLUMN app.f_logging.entity_id IS 'Specific entity instance UUID';
COMMENT ON COLUMN app.f_logging.action IS 'Action type code (0=View, 1=Edit, 2=Share, 3=Delete, 4=Create, 5=Owner)';
COMMENT ON COLUMN app.f_logging.updated IS 'Timestamp when action occurred';
COMMENT ON COLUMN app.f_logging.entity_from_version IS 'JSONB snapshot of entity state BEFORE action (NULL for create/view)';
COMMENT ON COLUMN app.f_logging.entity_to_version IS 'JSONB snapshot of entity state AFTER action (NULL for view/delete)';
COMMENT ON COLUMN app.f_logging.user_agent IS 'Browser/client user agent string for security context';
COMMENT ON COLUMN app.f_logging.ip IS 'IP address of request origin (v4 or v6)';
COMMENT ON COLUMN app.f_logging.device_name IS 'Device identifier (e.g., MacBook Pro, iPhone 13)';
COMMENT ON COLUMN app.f_logging.created_at IS 'Record creation timestamp (immutable)';
COMMENT ON COLUMN app.f_logging.log_source IS 'Source of log entry (api, web, mobile, system)';

-- ============================================================================
-- DATA CURATION: Sample Audit Log Records
-- ============================================================================
-- Using test user: James Miller (8260b1b0-5efc-4611-ad33-ee76c0cf7f13)
-- Sample scenarios: Create project, Edit task, View client, Delete artifact, Share form
-- ============================================================================

-- Sample 1: CREATE action - James (employee) creates a new project
INSERT INTO app.f_logging (
    fname,
    lname,
    username,
    person_type,
    entity_name,
    entity_id,
    action,
    updated,
    entity_from_version,
    entity_to_version,
    user_agent,
    ip,
    device_name,
    log_source
) VALUES (
    'James',
    'Miller',
    'james.miller@huronhome.ca',
    'employee',
    'project',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    4, -- CREATE
    '2025-11-10 09:15:23-05',
    NULL, -- No prior state for new entity
    jsonb_build_object(
        'id', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'name', 'Website Redesign Q1 2025',
        'description', 'Complete overhaul of company website with modern design',
        'stage', 'initiation',
        'priority', 'high',
        'owner_id', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
        'created_at', '2025-11-10T09:15:23-05:00'
    ),
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/119.0.0.0',
    '192.168.1.100',
    'MacBook Pro 16-inch',
    'api'
);

-- Sample 2: EDIT action - James (employee) updates task status
INSERT INTO app.f_logging (
    fname,
    lname,
    username,
    person_type,
    entity_name,
    entity_id,
    action,
    updated,
    entity_from_version,
    entity_to_version,
    user_agent,
    ip,
    device_name,
    log_source
) VALUES (
    'James',
    'Miller',
    'james.miller@huronhome.ca',
    'employee',
    'task',
    'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    1, -- EDIT
    '2025-11-10 10:30:45-05',
    jsonb_build_object(
        'status', 'in_progress',
        'assignee_id', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
        'progress_pct', 30
    ),
    jsonb_build_object(
        'status', 'completed',
        'assignee_id', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
        'progress_pct', 100,
        'completed_at', '2025-11-10T10:30:45-05:00'
    ),
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/119.0.0.0',
    '192.168.1.105',
    'Dell XPS 15',
    'web'
);

-- Sample 3: VIEW action - James (employee) views client details
INSERT INTO app.f_logging (
    fname,
    lname,
    username,
    person_type,
    entity_name,
    entity_id,
    action,
    updated,
    entity_from_version,
    entity_to_version,
    user_agent,
    ip,
    device_name,
    log_source
) VALUES (
    'James',
    'Miller',
    'james.miller@huronhome.ca',
    'employee',
    'client',
    'c3d4e5f6-a7b8-9012-cdef-123456789012',
    0, -- VIEW
    '2025-11-10 11:45:12-05',
    NULL, -- View operations don't track state
    NULL,
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1',
    '10.0.0.50',
    'iPhone 15 Pro',
    'mobile'
);

-- Sample 4: DELETE action - James (employee) soft-deletes an artifact
INSERT INTO app.f_logging (
    fname,
    lname,
    username,
    person_type,
    entity_name,
    entity_id,
    action,
    updated,
    entity_from_version,
    entity_to_version,
    user_agent,
    ip,
    device_name,
    log_source
) VALUES (
    'James',
    'Miller',
    'james.miller@huronhome.ca',
    'employee',
    'artifact',
    'd4e5f6a7-b8c9-0123-def1-234567890123',
    3, -- DELETE
    '2025-11-10 14:20:33-05',
    jsonb_build_object(
        'id', 'd4e5f6a7-b8c9-0123-def1-234567890123',
        'name', 'Old Design Mockup.pdf',
        'file_type', 'application/pdf',
        'size_bytes', 2458123,
        'deleted_at', NULL
    ),
    jsonb_build_object(
        'deleted_at', '2025-11-10T14:20:33-05:00',
        'deleted_by', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
    ),
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/119.0.0.0',
    '192.168.1.100',
    'MacBook Pro 16-inch',
    'api'
);

-- Sample 5: SHARE action - James (employee) shares a form with another employee
INSERT INTO app.f_logging (
    fname,
    lname,
    username,
    person_type,
    entity_name,
    entity_id,
    action,
    updated,
    entity_from_version,
    entity_to_version,
    user_agent,
    ip,
    device_name,
    log_source
) VALUES (
    'James',
    'Miller',
    'james.miller@huronhome.ca',
    'employee',
    'form',
    'e5f6a7b8-c9d0-1234-ef12-345678901234',
    2, -- SHARE
    '2025-11-10 15:55:18-05',
    jsonb_build_object(
        'shared_with', jsonb_build_array()
    ),
    jsonb_build_object(
        'shared_with', jsonb_build_array(
            jsonb_build_object(
                'emp_id', 'f6a7b8c9-d0e1-2345-f123-456789012345',
                'permission', 'edit',
                'shared_at', '2025-11-10T15:55:18-05:00'
            )
        )
    ),
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/537.36',
    '192.168.1.100',
    'MacBook Pro 16-inch',
    'web'
);

-- Sample 6: OWNER action - James (employee) modifies RBAC permissions on a project
INSERT INTO app.f_logging (
    fname,
    lname,
    username,
    person_type,
    entity_name,
    entity_id,
    action,
    updated,
    entity_from_version,
    entity_to_version,
    user_agent,
    ip,
    device_name,
    log_source
) VALUES (
    'James',
    'Miller',
    'james.miller@huronhome.ca',
    'employee',
    'project',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    5, -- OWNER (permission management)
    '2025-11-10 16:30:55-05',
    jsonb_build_object(
        'permissions', jsonb_build_object(
            '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', jsonb_build_array(0,1,2,3,4,5)
        )
    ),
    jsonb_build_object(
        'permissions', jsonb_build_object(
            '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', jsonb_build_array(0,1,2,3,4,5),
            'f6a7b8c9-d0e1-2345-f123-456789012345', jsonb_build_array(0,1) -- Added view+edit for another user
        )
    ),
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/119.0.0.0',
    '192.168.1.100',
    'MacBook Pro 16-inch',
    'api'
);

-- Sample 7: EDIT action - James (employee) updates own employee profile
INSERT INTO app.f_logging (
    fname,
    lname,
    username,
    person_type,
    entity_name,
    entity_id,
    action,
    updated,
    entity_from_version,
    entity_to_version,
    user_agent,
    ip,
    device_name,
    log_source
) VALUES (
    'James',
    'Miller',
    'james.miller@huronhome.ca',
    'employee',
    'employee',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    1, -- EDIT
    '2025-11-11 08:15:00-05',
    jsonb_build_object(
        'phone', '416-555-1234',
        'title', 'Senior Project Manager',
        'department', 'Operations'
    ),
    jsonb_build_object(
        'phone', '416-555-9999',
        'title', 'Director of Project Management',
        'department', 'Leadership'
    ),
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/119.0.0.0',
    '192.168.1.100',
    'MacBook Pro 16-inch',
    'web'
);

-- Sample 8: CREATE action - System auto-creates workflow automation (system actor)
INSERT INTO app.f_logging (
    fname,
    lname,
    username,
    person_type,
    entity_name,
    entity_id,
    action,
    updated,
    entity_from_version,
    entity_to_version,
    user_agent,
    ip,
    device_name,
    log_source
) VALUES (
    NULL, -- System has no first name
    NULL, -- System has no last name
    'system@pmo.internal',
    'system',
    'workflow_automation',
    'f7a8b9c0-d1e2-3456-g234-567890123456',
    4, -- CREATE
    '2025-11-11 09:00:00-05',
    NULL,
    jsonb_build_object(
        'id', 'f7a8b9c0-d1e2-3456-g234-567890123456',
        'name', 'Auto-assign task on project creation',
        'trigger_event', 'project.created',
        'action_type', 'task.create',
        'active_flag', true
    ),
    'PMO-System-Scheduler/1.0',
    '127.0.0.1',
    'API Server',
    'system'
);

-- Sample 9: VIEW action - Customer views their project status from portal
INSERT INTO app.f_logging (
    fname,
    lname,
    username,
    person_type,
    entity_name,
    entity_id,
    action,
    updated,
    entity_from_version,
    entity_to_version,
    user_agent,
    ip,
    device_name,
    log_source
) VALUES (
    'Sarah',
    'Johnson',
    'sarah.johnson@example.com',
    'customer',
    'project',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    0, -- VIEW
    '2025-11-11 10:30:00-05',
    NULL,
    NULL,
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/119.0.0.0',
    '203.0.113.45',
    'Windows Desktop',
    'web'
);

-- Sample 10: EDIT action - Customer updates project requirements via portal
INSERT INTO app.f_logging (
    fname,
    lname,
    username,
    person_type,
    entity_name,
    entity_id,
    action,
    updated,
    entity_from_version,
    entity_to_version,
    user_agent,
    ip,
    device_name,
    log_source
) VALUES (
    'Sarah',
    'Johnson',
    'sarah.johnson@example.com',
    'customer',
    'project',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    1, -- EDIT
    '2025-11-11 11:00:00-05',
    jsonb_build_object(
        'customer_notes', 'Initial requirements'
    ),
    jsonb_build_object(
        'customer_notes', 'Updated: Need mobile-first design and dark mode support'
    ),
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/119.0.0.0',
    '203.0.113.45',
    'Windows Desktop',
    'web'
);

-- ============================================================================
-- VALIDATION QUERIES
-- ============================================================================

-- Query 1: Audit trail for a specific entity
-- SELECT * FROM app.f_logging
-- WHERE entity_name = 'project' AND entity_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
-- ORDER BY updated DESC;

-- Query 2: All actions by a specific person (by username)
-- SELECT fname, lname, person_type, entity_name, entity_id, action, updated
-- FROM app.f_logging
-- WHERE username = 'james.miller@huronhome.ca'
-- ORDER BY updated DESC;

-- Query 2b: All actions by a specific person (by name)
-- SELECT fname, lname, username, person_type, entity_name, action, updated
-- FROM app.f_logging
-- WHERE lname = 'Miller' AND fname = 'James'
-- ORDER BY updated DESC;

-- Query 2c: All actions by customers
-- SELECT fname, lname, username, entity_name, entity_id, action, updated
-- FROM app.f_logging
-- WHERE person_type = 'customer'
-- ORDER BY updated DESC;

-- Query 3: All delete operations in last 30 days
-- SELECT fname, lname, username, person_type, entity_name, entity_id, updated, entity_from_version
-- FROM app.f_logging
-- WHERE action = 3 AND updated >= now() - interval '30 days'
-- ORDER BY updated DESC;

-- Query 4: Suspicious IP access patterns (multiple entities in short time)
-- SELECT ip, COUNT(DISTINCT entity_id) as entity_count, MIN(updated), MAX(updated)
-- FROM app.f_logging
-- WHERE updated >= now() - interval '1 hour'
-- GROUP BY ip
-- HAVING COUNT(DISTINCT entity_id) > 50;

-- ============================================================================
-- END OF FILE: LI_f_logging.ddl
-- ============================================================================
