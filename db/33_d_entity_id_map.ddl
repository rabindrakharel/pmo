-- =====================================================
-- ENTITY INSTANCE LINKAGE MAP (d_entity_id_map)
-- Parent-child relationships between specific entity instances (NO FOREIGN KEYS)
-- =====================================================
--
-- BUSINESS PURPOSE: LINKAGE TABLE 
-- Maps parent-child relationships between specific entity instances WITHOUT using foreign keys.
-- Enables flexible hierarchies and prevents cascade issues during soft deletes.
-- Powers dynamic tab navigation, filtered child entity queries, and the Linkage Management UI.
-- This table stores ACTUAL instance-to-instance links (e.g., Project A → Task B).
-- For valid TYPE-to-TYPE rules, see d_entity_map (e.g., "project" can contain "task").
--
-- API SEMANTICS & LIFECYCLE:
--
-- 1. CREATE RELATIONSHIP (Link Child to Parent)
--    • Endpoint: POST /api/v1/linkage
--    • Body: {parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type}
--    • Returns: {id: "new-uuid", created_ts: "timestamp"}
--    • Database:
--      INSERT INTO d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
--      VALUES ($1, $2, $3, $4)
--    • Business Rule: Validates against d_entity_map for allowed type combinations
--    • RBAC: Requires edit permission on parent entity AND create permission on child entity type
--
-- 2. CREATE RELATIONSHIP (Implicit on Child Entity Creation)
--    • When: POST /api/v1/task with {project_id: "uuid"}
--    • Database: After task INSERT, auto-creates mapping:
--      INSERT INTO d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
--      VALUES ('project', $project_id, 'task', $new_task_id)
--    • Business Rule: Establishes parent-child link for tab navigation
--
-- 3. QUERY CHILD ENTITIES (Filtered by Parent)
--    • Endpoint: GET /api/v1/project/{id}/task
--    • Database:
--      SELECT t.* FROM d_task t
--      INNER JOIN d_entity_id_map eim ON eim.child_entity_id = t.id::text
--      WHERE eim.parent_entity_id = $1
--        AND eim.parent_entity_type = 'project'
--        AND eim.child_entity_type = 'task'
--        AND eim.active_flag = true
--        AND t.active_flag = true
--      ORDER BY t.created_ts DESC
--    • Frontend: Powers EntityChildListPage filtered views and dynamic tabs
--
-- 4. COUNT CHILD ENTITIES (Tab Badges)
--    • Endpoint: GET /api/v1/project/{id}/child-counts
--    • Database:
--      SELECT
--        eim.child_entity_type,
--        COUNT(*) as count
--      FROM d_entity_id_map eim
--      WHERE eim.parent_entity_id = $1
--        AND eim.parent_entity_type = 'project'
--        AND eim.active_flag = true
--      GROUP BY eim.child_entity_type
--    • Frontend: Renders tab badges like "Tasks (8)", "Wiki (3)", "Forms (2)"
--
-- 5. UPDATE RELATIONSHIP (Change Parent)
--    • Endpoint: PUT /api/v1/linkage/{id}
--    • Body: {parent_entity_id: "new-parent-uuid"}
--    • Returns: {id: "same-uuid", updated_ts: "new-timestamp"}
--    • Database: UPDATE d_entity_id_map SET parent_entity_id=$1, updated_ts=now() WHERE id=$2
--    • SCD Behavior: IN-PLACE UPDATE (same mapping ID)
--    • Business Rule: Moves child to new parent (e.g., reassign task to different project)
--
-- 6. REMOVE RELATIONSHIP (Unlink)
--    • Endpoint: DELETE /api/v1/linkage/{id}
--    • Database: UPDATE d_entity_id_map SET active_flag=false, to_ts=now() WHERE id=$1
--    • Business Rule: Child entity still exists but is no longer linked to parent
--    • Frontend: Child disappears from parent's tab but remains in global entity list
--
-- 7. LIST ALL LINKAGES (Linkage Management Page)
--    • Endpoint: GET /api/v1/linkage?parent_entity_type=project&limit=50
--    • Database:
--      SELECT
--        eim.*,
--        pe.entity_name as parent_name,
--        ce.entity_name as child_name
--      FROM d_entity_id_map eim
--      LEFT JOIN d_entity pe ON pe.entity_id = eim.parent_entity_id::uuid AND pe.entity_type = eim.parent_entity_type
--      LEFT JOIN d_entity ce ON ce.entity_id = eim.child_entity_id::uuid AND ce.entity_type = eim.child_entity_type
--      WHERE eim.active_flag = true
--      ORDER BY eim.created_ts DESC
--      LIMIT $1 OFFSET $2
--    • Frontend: LinkagePage displays all relationships with parent/child names
--
-- 8. GET AVAILABLE CHILDREN (For Linking UI)
--    • Endpoint: GET /api/v1/linkage/available-children?parent_entity_type=project&parent_entity_id={uuid}&child_entity_type=task
--    • Database:
--      SELECT t.* FROM d_task t
--      WHERE t.active_flag = true
--        AND NOT EXISTS (
--          SELECT 1 FROM d_entity_id_map eim
--          WHERE eim.child_entity_id = t.id::text
--            AND eim.child_entity_type = 'task'
--            AND eim.parent_entity_type = 'project'
--            AND eim.parent_entity_id = $1
--            AND eim.active_flag = true
--        )
--    • Business Rule: Shows only unlinked entities that can be added
--    • Frontend: Dropdown of available children in LinkagePage
--
-- 9. SOFT DELETE HANDLING (Parent Entity Deletion)
--    • When: DELETE /api/v1/project/{id}
--    • Database: Parent soft delete optionally deactivates mappings:
--      UPDATE d_entity_id_map SET active_flag = false, to_ts=now() WHERE parent_entity_id = $1
--    • Business Rule: Child entities remain accessible; can be reassigned to new parent
--    • Alternative: Keep mappings active to preserve relationship history
--
-- KEY FIELDS:
-- • parent_entity_type: 'project', 'biz', 'office', 'client', 'task', 'form', 'role'
-- • parent_entity_id: TEXT (UUID as string) of parent entity instance
-- • child_entity_type: 'task', 'wiki', 'artifact', 'form', 'employee', etc.
-- • child_entity_id: TEXT (UUID as string) of child entity instance
-- • relationship_type: Descriptive label ('owns', 'contains', 'hosts', 'documents')
-- • from_ts: Relationship creation timestamp (never modified)
-- • to_ts: Relationship end timestamp (NULL=active, timestamptz=deleted)
-- • active_flag: Soft delete flag (true=active, false=deleted)
-- • created_ts: Original creation time (never modified)
-- • updated_ts: Last modification time (refreshed on UPDATE)
--
-- VALID PARENT-CHILD RELATIONSHIPS:
-- (Enforced by d_entity_map validation)
--   PARENT ENTITY     → CHILD ENTITIES
--   =====================================
--   business (biz)    → project
--   project           → task, artifact, wiki, form
--   office            → task, artifact, wiki, form, business
--   client            → project, artifact, form
--   role              → employee
--   task              → form, artifact, employee (assignees)
--   form              → artifact
--
-- WHY NO FOREIGN KEYS?
-- • Flexibility: Can link entities across schemas/databases
-- • Soft Deletes: Parent deletion doesn't cascade to children
-- • Versioning: Supports temporal relationships with from_ts/to_ts
-- • Multi-tenancy: Can partition by tenant without FK constraints
-- • Performance: Avoids FK validation overhead on high-volume inserts
--
-- LINKAGE PAGE UI WORKFLOW:
-- 1. User selects parent entity type(s) (multi-select: project, office, client)
-- 2. System shows valid child types based on d_entity_map rules
-- 3. User selects specific parent entity instance from dropdown
-- 4. User selects child entity type (task, artifact, wiki, form)
-- 5. System shows available unlinked children of that type
-- 6. User selects children to link and submits
-- 7. System creates d_entity_id_map entries for each link
--
-- =====================================================

CREATE TABLE app.d_entity_id_map (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_entity_type varchar(20) NOT NULL,
    parent_entity_id text NOT NULL,
    child_entity_type varchar(20) NOT NULL,
    child_entity_id text NOT NULL,
    relationship_type varchar(50) DEFAULT 'contains',
    from_ts timestamptz NOT NULL DEFAULT now(),
    to_ts timestamptz,
    active_flag boolean NOT NULL DEFAULT true,
    created_ts timestamptz NOT NULL DEFAULT now(),
    updated_ts timestamptz NOT NULL DEFAULT now(),
    UNIQUE(parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
);

-- Indexes for common query patterns
CREATE INDEX idx_d_entity_id_map_parent ON app.d_entity_id_map(parent_entity_type, parent_entity_id) WHERE active_flag = true;
CREATE INDEX idx_d_entity_id_map_child ON app.d_entity_id_map(child_entity_type, child_entity_id) WHERE active_flag = true;
CREATE INDEX idx_d_entity_id_map_active ON app.d_entity_id_map(active_flag) WHERE active_flag = true;

COMMENT ON TABLE app.d_entity_id_map IS 'Parent-child relationships between specific entity instances for navigation, filtering, and linkage management';

-- =====================================================
-- DATA CURATION: Port Existing Relationships
-- Populate from existing entity tables with parent-child links
-- =====================================================

-- Business → Project relationships
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT 'business', p.business_id::text, 'project', p.id::text, 'owns'
FROM app.d_project p
WHERE p.business_id IS NOT NULL AND p.active_flag = true;

-- Office → Business relationships
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT 'office', b.office_id::text, 'business', b.id::text, 'hosts'
FROM app.d_business b
WHERE b.office_id IS NOT NULL AND b.active_flag = true;

-- Project → Task relationships
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT 'project', t.project_id::text, 'task', t.id::text, 'contains'
FROM app.d_task t
WHERE t.project_id IS NOT NULL AND t.active_flag = true;

-- Parent → Artifact relationships (using primary_entity_type and primary_entity_id)
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT a.primary_entity_type, a.primary_entity_id::text, 'artifact', a.id::text, 'contains'
FROM app.d_artifact a
WHERE a.primary_entity_id IS NOT NULL
  AND a.primary_entity_type IS NOT NULL
  AND a.active_flag = true;

-- Parent → Wiki relationships (using primary_entity_type and primary_entity_id)
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT w.primary_entity_type, w.primary_entity_id::text, 'wiki', w.id::text, 'documents'
FROM app.d_wiki w
WHERE w.primary_entity_id IS NOT NULL
  AND w.primary_entity_type IS NOT NULL
  AND w.active_flag = true;

-- Parent → Form relationships (using primary_entity_type and primary_entity_id)
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT f.primary_entity_type, f.primary_entity_id::text, 'form', f.id::text, 'uses'
FROM app.d_form_head f
WHERE f.primary_entity_id IS NOT NULL
  AND f.primary_entity_type IS NOT NULL
  AND f.active_flag = true;

-- Task → Employee relationships (Task Assignees)
-- All tasks assigned to James Miller
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
VALUES
    ('task', 'a1111111-1111-1111-1111-111111111111', 'employee', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 'assigned_to'),
    ('task', 'a2222222-2222-2222-2222-222222222222', 'employee', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 'assigned_to'),
    ('task', 'b1111111-1111-1111-1111-111111111111', 'employee', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 'assigned_to'),
    ('task', 'b2222222-2222-2222-2222-222222222222', 'employee', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 'assigned_to'),
    ('task', 'c1111111-1111-1111-1111-111111111111', 'employee', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 'assigned_to'),
    ('task', 'd1111111-1111-1111-1111-111111111111', 'employee', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 'assigned_to'),
    ('task', 'e1111111-1111-1111-1111-111111111111', 'employee', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 'assigned_to'),
    ('task', 'f1111111-1111-1111-1111-111111111111', 'employee', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 'assigned_to');
