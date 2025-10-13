-- =====================================================
-- FORM ENTITY (d_form_head) - HEAD TABLE
-- Advanced multi-step form definitions with comprehensive metadata
-- =====================================================

CREATE TABLE app.d_form_head (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(100) UNIQUE NOT NULL,
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    url varchar(500),
    tags jsonb DEFAULT '[]'::jsonb,

    -- Form Type Configuration
    form_type varchar(50) DEFAULT 'multi_step', -- single_step, multi_step, workflow, survey, checklist

    -- Multi-Step Form Schema
    -- Nested JSONB array with ordered steps and fields
    -- form_schema Structure: {"steps": [{"step": 1, "fields": [{"label": "Field 1", "type": "text", "required": true}, ...]}, ...]}
    form_schema jsonb DEFAULT '{"steps": []}'::jsonb,

    -- Temporal fields (SCD Type 2 - handles history)
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),

    -- Version as separate column
    version integer DEFAULT 1
);
