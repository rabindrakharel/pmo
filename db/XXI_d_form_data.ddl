-- =====================================================
-- FORM DATA (d_form_data) - DATA TABLE
-- Form submissions with approval workflow
-- =====================================================

CREATE TABLE app.d_form_data (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id uuid NOT NULL REFERENCES app.d_form_head(id) ON DELETE CASCADE,

    -- Submission data
    submission_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    submission_status varchar(50) DEFAULT 'draft', -- draft, submitted, approved, rejected

    -- Data stage
    stage varchar(20) NOT NULL DEFAULT 'draft', -- draft, saved

    -- Submission metadata
    submitted_by_empid uuid NOT NULL,
    submission_ip_address inet,
    submission_user_agent text,

    -- Workflow tracking
    approval_status varchar(50), -- pending, approved, rejected
    approved_by_empid uuid,
    approval_notes text,
    approved_at timestamptz,

    -- Temporal fields
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);



COMMENT ON TABLE app.d_form_data IS 'Form submissions with approval workflow';