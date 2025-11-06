-- =====================================================
-- FORM ENTITY (d_form_head) - DYNAMIC FORMS
-- =====================================================
--
-- SEMANTICS:
-- • Dynamic multi-step forms with JSONB schemas, supports public/internal URLs
-- • Stable UUID with TWO URLs: internal (/form/{uuid}, auth), shared (/form/{8-char}, public)
-- • In-place schema updates (version++), old submissions preserve original schema
--
-- OPERATIONS:
-- • CREATE: INSERT with version=1, generates internal + shared URLs
-- • UPDATE: Same ID, version++, form_schema overwritten (no archival)
-- • DELETE: active_flag=false, to_ts=now(), disables both URLs
-- • SUBMIT: POST to shared_url creates d_form_data entry
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY (stable, critical for URL permanence)
-- • slug, code: varchar (NO unique constraint)
-- • internal_url: varchar (/form/{uuid}, auth required)
-- • shared_url: varchar (/form/{8-char}, public, no auth)
-- • form_schema: jsonb ({"steps": [{"id", "fields": [...]}]})
-- • form_type: varchar (multi_step, single_page, wizard)
-- • entity_type, entity_id: text, uuid (parent link)
--
-- RELATIONSHIPS:
-- • Parent: project, task (via entity_type/entity_id)
-- • Children: d_form_data (submissions), artifact (attachments)
-- • RBAC: entity_id_rbac_map
--
-- =====================================================

CREATE TABLE app.d_form_head (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(100),  -- No unique constraint
    code varchar(50),   -- No unique constraint
    name varchar(200) NOT NULL,
    descr text,
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
-- SAMPLE DATA - Form Definitions
-- =====================================================

-- Landscaping Form
INSERT INTO app.d_form_head (
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
