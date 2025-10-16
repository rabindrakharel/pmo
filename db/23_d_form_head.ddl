-- =====================================================
-- FORM ENTITY (d_form_head) - HEAD TABLE
-- Advanced multi-step form definitions with in-place versioning
-- =====================================================
--
-- BUSINESS PURPOSE:
-- Stores form templates (schemas) that define multi-step data collection workflows.
-- Each form has a stable ID that never changes, enabling public URLs and stable references.
-- Forms can be edited/published multiple times; version tracks schema iterations.
--
-- API SEMANTICS & LIFECYCLE:
--
-- 1. CREATE NEW FORM
--    • Endpoint: POST /api/v1/form
--    • Body: {name, form_schema: {steps: [...]}}
--    • Returns: {id: "new-uuid", version: 1, url: "/public/form/{id}"}
--    • Database: INSERT with version=1, active_flag=true, created_ts=now()
--    • Business Rule: ID and URL are permanent; form_schema defines structure
--
-- 2. UPDATE FORM SCHEMA (Draft Auto-Save OR Schema Change)
--    • Endpoint: PUT /api/v1/form/{id}
--    • Body: {form_schema: {steps: [...]}, name, descr}
--    • Returns: {id: "same-uuid", version: 2}
--    • Database: UPDATE SET form_schema=$1, version=version+1, updated_ts=now() WHERE id=$2
--    • SCD Behavior: IN-PLACE UPDATE (NOT Type 2)
--      - Same ID (critical for stable public URLs)
--      - version increments (1 → 2 → 3...)
--      - updated_ts refreshed
--      - Old schema OVERWRITTEN (no archival)
--    • Business Rule: Public URL (/public/form/{id}) remains valid; submissions use latest schema
--
-- 3. SOFT DELETE FORM
--    • Endpoint: DELETE /api/v1/form/{id}
--    • Database: UPDATE SET active_flag=false, to_ts=now() WHERE id=$1
--    • Business Rule: Form hidden from lists; public URL disabled; existing submissions preserved
--
-- 4. LIST FORMS
--    • Endpoint: GET /api/v1/form
--    • Query: ?active=true (default), ?project_id={uuid}
--    • Database: SELECT * FROM d_form_head WHERE active_flag=true ORDER BY updated_ts DESC
--    • RBAC: Filtered by entity_id_rbac_map (permission 0=view required)
--
-- 5. GET SINGLE FORM
--    • Endpoint: GET /api/v1/form/{id}
--    • Database: SELECT * FROM d_form_head WHERE id=$1 AND active_flag=true
--    • RBAC: Checks entity_id_rbac_map for view permission
--    • Frontend Usage: FormBuilder component renders form_schema as editable steps
--
-- 6. PUBLIC FORM ACCESS
--    • Endpoint: GET /public/form/{id} (NO AUTH)
--    • Database: SELECT id, name, form_schema, url FROM d_form_head WHERE id=$1 AND active_flag=true
--    • Returns: Public-facing form for submissions (InteractiveForm component)
--
-- KEY SCD FIELDS:
-- • id: NEVER changes (stable public URL reference)
-- • version: Increments on schema updates (audit trail of changes)
-- • from_ts: Original creation timestamp (never modified)
-- • updated_ts: Last modification timestamp (refreshed on every UPDATE)
-- • to_ts: Soft delete timestamp (NULL = active, timestamptz = deleted)
-- • active_flag: Soft delete flag (true = active, false = deleted)
--
-- RELATIONSHIP TO d_form_data:
-- • Form submissions (d_form_data) reference form_id via FK
-- • When form schema changes (version++), NEW submissions use new schema
-- • OLD submissions retain their original submission_data structure
-- • No cascade updates to existing submissions
--
-- NO UNIQUE CONSTRAINTS:
-- • slug/code are NOT unique (allows reuse across forms without conflicts)
-- • Only id is guaranteed unique (primary key)
--
-- =====================================================

CREATE TABLE app.d_form_head (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(100),  -- No unique constraint
    code varchar(50),   -- No unique constraint
    name varchar(200) NOT NULL,
    descr text,
    url varchar(500),   -- Public form URL: /public/form/{id}
    tags jsonb DEFAULT '[]'::jsonb,

    -- Form Type
    form_type varchar(50) DEFAULT 'multi_step',

    -- Multi-Step Form Schema (JSONB)
    -- Structure: {"steps": [{"id":"step-1","name":"step_1","title":"Info","fields":[{...}]}]}
    form_schema jsonb DEFAULT '{"steps": []}'::jsonb,

    -- Temporal Tracking (NOT for archival, just audit)
    from_ts timestamptz DEFAULT now(),      -- Original creation time (never changes)
    to_ts timestamptz,                      -- Reserved (unused in current implementation)
    active_flag boolean DEFAULT true,       -- Soft delete flag
    created_ts timestamptz DEFAULT now(),   -- Original creation time
    updated_ts timestamptz DEFAULT now(),   -- Last modification time

    -- In-Place Version Counter
    -- Increments on schema changes, ID stays same
    version integer DEFAULT 1
);
