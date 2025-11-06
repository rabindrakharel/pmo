-- =====================================================
-- FORM DATA (d_form_data) - FORM SUBMISSIONS
-- =====================================================
--
-- SEMANTICS:
-- • Form submissions with approval workflow and flattened JSONB data
-- • Simple fields: {"email_123": "user@example.com"}
-- • DataTable fields: {"inventory__col1_1": "Item A"} (pattern: tableName__col_row)
-- • Flattened for efficient querying and partial updates
--
-- KEY FIELDS:
-- • form_id: uuid (FK to d_form_head)
-- • submission_data: jsonb (flat key-value pairs)
-- • dl__form_submission_status: text (submitted, under_review, approved, rejected)
-- • dl__form_approval_status: text (pending, approved, rejected)
-- • submitted_by: varchar (email or user identifier)
-- • reviewed_by_empid, approved_by_empid: uuid
--
-- =====================================================
--   3. Consistent key-value structure across all field types
--   4. Easy to extract/filter rows or columns using key patterns
--
-- RECONSTRUCTION:
--   Frontend DataTableInput component extracts keys matching pattern:
--   Object.keys(submissionData).filter(k => k.startsWith('tableName__'))
--
-- =====================================================

CREATE TABLE app.d_form_data (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id uuid NOT NULL REFERENCES app.d_form_head(id) ON DELETE CASCADE,

    -- Submission data (JSONB with flattened structure - see documentation above)
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
    approved_ts timestamptz,

    -- Temporal fields
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

-- =====================================================
-- SAMPLE DATA - Form Submissions
-- =====================================================

-- Sample submissions for Landscaping Form (ee8a6cfd-9d31-4705-b8f3-ad2d5589802c)
-- Submitted by James Miller (8260b1b0-5efc-4611-ad33-ee76c0cf7f13)

INSERT INTO app.d_form_data (
    id,
    form_id,
    submission_data,
    submission_status,
    stage,
    submitted_by_empid
) VALUES
-- Submission 1: Abinav's landscaping request
(
    '35906526-e72e-4517-861b-72538bd39782',
    'ee8a6cfd-9d31-4705-b8f3-ad2d5589802c',
    '{
        "text_1760648879230": "abinav",
        "email_1760648881366": "aa@cc.com",
        "table_1760648887217__col1_1": "44444",
        "table_1760648887217__col2_1": "2323.232",
        "table_1760648887217__col3_1": "asda"
    }'::jsonb,
    'submitted',
    'saved',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
),
-- Submission 2: Soma's landscaping request
(
    '646964c8-64ab-41b4-8a15-4ecc9e491ab4',
    'ee8a6cfd-9d31-4705-b8f3-ad2d5589802c',
    '{
        "text_1760648879230": "Soma Name",
        "email_1760648881366": "som@samoama.com",
        "table_1760648887217__col1_1": "232",
        "table_1760648887217__col2_1": "232333",
        "table_1760648887217__col3_1": "1111"
    }'::jsonb,
    'submitted',
    'saved',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
),
-- Submission 3: Hong Sang's landscaping request
(
    'df00832d-725b-4801-b45d-62bd4e657e60',
    'ee8a6cfd-9d31-4705-b8f3-ad2d5589802c',
    '{
        "text_1760648879230": "Hong Sang",
        "email_1760648881366": "kidida@huron.com",
        "table_1760648887217__col1_1": "33.222",
        "table_1760648887217__col2_1": "0.999",
        "table_1760648887217__col3_1": "8989"
    }'::jsonb,
    'submitted',
    'saved',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
),
-- Submission 4: Marioulo Gonalez's landscaping request
(
    '857ec071-b1d2-4540-b823-d6b33ed7d890',
    'ee8a6cfd-9d31-4705-b8f3-ad2d5589802c',
    '{
        "text_1760648879230": "Marioulo Gonalez",
        "email_1760648881366": "gongamo@missiuan.com",
        "table_1760648887217__col1_1": "32323",
        "table_1760648887217__col2_1": "8888888",
        "table_1760648887217__col3_1": "66.666"
    }'::jsonb,
    'submitted',
    'saved',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
)
ON CONFLICT (id) DO UPDATE SET
    submission_data = EXCLUDED.submission_data,
    submission_status = EXCLUDED.submission_status,
    stage = EXCLUDED.stage,
    updated_ts = now();


COMMENT ON TABLE app.d_form_data IS 'Form submissions with approval workflow';