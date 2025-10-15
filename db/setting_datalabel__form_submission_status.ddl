-- =====================================================
-- SETTING: FORM SUBMISSION STATUS
-- Defines available form submission status values
-- =====================================================

CREATE TABLE IF NOT EXISTS app.setting_datalabel_form_submission_status (
    level_id integer PRIMARY KEY,
    level_name varchar(50) NOT NULL UNIQUE,
    level_descr text,
    is_active boolean DEFAULT true,
    sort_order integer,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

-- Form submission status values
INSERT INTO app.setting_datalabel_form_submission_status (level_id, level_name, level_descr, sort_order) VALUES
(0, 'draft', 'Draft - not yet submitted', 0),
(1, 'submitted', 'Submitted - awaiting review', 1),
(2, 'under_review', 'Under review by approver', 2),
(3, 'approved', 'Approved and processed', 3),
(4, 'rejected', 'Rejected - requires revision', 4),
(5, 'withdrawn', 'Withdrawn by submitter', 5);

COMMENT ON TABLE app.setting_datalabel_form_submission_status IS 'Form submission status setting values for d_form_data.submission_status';
