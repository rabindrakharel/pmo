-- =====================================================
-- SETTING: FORM APPROVAL STATUS
-- Defines available form approval status values
-- =====================================================

CREATE TABLE IF NOT EXISTS app.setting_datalabel_form_approval_status (
    level_id integer PRIMARY KEY,
    level_name varchar(50) NOT NULL UNIQUE,
    level_descr text,
    is_active boolean DEFAULT true,
    sort_order integer,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

-- Form approval status values
INSERT INTO app.setting_datalabel_form_approval_status (level_id, level_name, level_descr, sort_order) VALUES
(0, 'pending', 'Pending approval', 0),
(1, 'approved', 'Approved by authorized person', 1),
(2, 'rejected', 'Rejected - does not meet criteria', 2),
(3, 'conditional', 'Conditionally approved - requires changes', 3),
(4, 'escalated', 'Escalated to higher authority', 4);

COMMENT ON TABLE app.setting_datalabel_form_approval_status IS 'Form approval status setting values for d_form_data.approval_status';
