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

-- Indexes for form data
CREATE INDEX idx_form_data_form_id ON app.d_form_data(form_id);
CREATE INDEX idx_form_data_submitted_by ON app.d_form_data(submitted_by_empid);
CREATE INDEX idx_form_data_status ON app.d_form_data(submission_status);
CREATE INDEX idx_form_data_stage ON app.d_form_data(stage);
CREATE INDEX idx_form_data_created ON app.d_form_data(created_ts DESC);

-- Update trigger for form data
CREATE TRIGGER trg_form_data_updated_ts BEFORE UPDATE ON app.d_form_data
    FOR EACH ROW EXECUTE FUNCTION app.update_updated_ts();

COMMENT ON TABLE app.d_form_data IS 'Form submissions with approval workflow';