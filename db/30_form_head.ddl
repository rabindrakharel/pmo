-- =====================================================
-- FORM ENTITY (d_form_head) - HEAD TABLE
-- Multi-step form definitions with JSONB schemas and public/internal URLs
-- =====================================================
--
-- SEMANTICS:
-- Forms are dynamic data collection templates with multi-step JSONB schemas.
-- Each form has stable UUID and TWO URLs: internal (auth required) and shared (public, 8-char code).
-- Updates are in-place (same ID, version++), enabling stable URLs while tracking schema evolution.
-- Submissions (d_form_data) reference form_id; old submissions preserve original schema structure.
--
-- OPERATIONS:
-- • CREATE: POST /api/v1/form, INSERT with version=1, generates internal + shared URLs
-- • UPDATE: PUT /api/v1/form/{id}, same ID, version++, form_schema updated, updated_ts refreshes
-- • DELETE: DELETE /api/v1/form/{id}, active_flag=false, to_ts=now() (soft delete, disables URLs)
-- • LIST: GET /api/v1/form, filters by form_type/active_flag, RBAC enforced
--
-- FORM SCHEMA STRUCTURE:
-- {
--   "steps": [
--     {
--       "id": "step-1", "name": "step_1", "title": "General Information",
--       "fields": [
--         {"name": "text_1760648879230", "label": "Text Input", "type": "text", "required": false},
--         {"name": "datatable_1760648887217", "type": "datatable", "dataTableColumns": [...]}
--       ]
--     }
--   ]
-- }
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • Parent: project (via metadata.primary_entity_id or entity_instance_link)
-- • Children: d_form_data (submissions), artifact (attachments)
--
-- URL ACCESS MODES:
-- • Internal URL (/form/{uuid}): Requires authentication, enables editing/management
-- • Shared URL (/form/{8-char-code}): Public presigned URL, anyone can submit, no auth
--
-- =====================================================

CREATE TABLE app.form_head (
    id uuid DEFAULT gen_random_uuid(),
    code varchar(50),   -- No unique constraint
    name varchar(200),
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    internal_url varchar(500),   -- Internal form URL: /form/{id} (authenticated access)
    shared_url varchar(500),     -- Public shared URL: /form/{8-char-random} (presigned, no auth required)
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

-- =====================================================
-- DATA CURATION:
-- =====================================================

-- Landscaping Form
INSERT INTO app.form_head (
    id,
    name,
    descr,
    internal_url,
    shared_url,
    form_type,
    form_schema,
    version,
    active_flag
) VALUES (
    'ee8a6cfd-9d31-4705-b8f3-ad2d5589802c',
    'Landscapingform',
    'Landscapping form',
    '/form/ee8a6cfd-9d31-4705-b8f3-ad2d5589802c',
    '/form/aB3xK9mZ',
    'multi_step',
    '{
        "steps": [
            {
                "id": "step-1",
                "name": "step_1",
                "title": "General Information",
                "description": "",
                "fields": [
                    {
                        "name": "text_1760648879230",
                        "label": "Text Input",
                        "type": "text",
                        "required": false
                    },
                    {
                        "name": "email_1760648881366",
                        "label": "Email",
                        "type": "email",
                        "required": false
                    }
                ]
            },
            {
                "id": "step-1760648883781",
                "name": "step_2",
                "title": "Step 2",
                "description": "",
                "fields": [
                    {
                        "name": "datatable_1760648887217",
                        "label": "Data Table",
                        "type": "datatable",
                        "required": false,
                        "dataTableName": "table_1760648887217",
                        "dataTableColumns": [
                            {"name": "col1", "label": "Columnaa"},
                            {"name": "col2", "label": "COLB"},
                            {"name": "col3", "label": "COLC"}
                        ],
                        "dataTableDefaultRows": 1
                    }
                ]
            }
        ],
        "currentStepIndex": 0
    }'::jsonb,
    1,
    true
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    descr = EXCLUDED.descr,
    internal_url = EXCLUDED.internal_url,
    shared_url = EXCLUDED.shared_url,
    form_type = EXCLUDED.form_type,
    form_schema = EXCLUDED.form_schema,
    updated_ts = now();
