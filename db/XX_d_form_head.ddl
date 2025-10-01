-- =====================================================
-- FORM ENTITY (d_form_head) - HEAD TABLE
-- Form definitions and submissions
-- =====================================================

CREATE TABLE app.d_form_head (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(100) UNIQUE NOT NULL,
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    tags jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,

    -- Form definition
    form_schema jsonb NOT NULL DEFAULT '{}'::jsonb, -- JSON schema for form structure
    form_ui_schema jsonb DEFAULT '{}'::jsonb, -- UI rendering hints
    form_type varchar(50) DEFAULT 'standard', -- standard, workflow, survey, checklist

    -- Form configuration
    is_template boolean DEFAULT false,
    allow_multiple_submissions boolean DEFAULT true,
    require_authentication boolean DEFAULT true,
    auto_save_enabled boolean DEFAULT true,

    -- Workflow integration
    workflow_stage varchar(50),
    approval_required boolean DEFAULT false,
    notification_settings jsonb DEFAULT '{}'::jsonb,

    -- Relationships (mapped via entity_id_map)
    primary_entity_type varchar(50), -- project, task, business, office
    primary_entity_id uuid,

    -- Temporal fields
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);



COMMENT ON TABLE app.d_form_head IS 'Form definitions with JSON schema and workflow integration';