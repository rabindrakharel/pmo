-- =====================================================
-- FORM DATA (d_form_data) - DATA TABLE
-- Form submissions with approval workflow
-- =====================================================
--
-- SUBMISSION DATA STRUCTURE (submission_data JSONB):
-- All form field values are stored as flat key-value pairs in submission_data.
--
-- SIMPLE FIELDS: Stored with field name as key
--   {
--     "email_123": "user@example.com",
--     "textarea_456": "Some text content",
--     "select_789": "Option 2"
--   }
--
-- DATATABLE FIELDS: Flattened with pattern tableName__columnName_rowNumber
--   Example: DataTable field with dataTableName="inventory" and 3 columns × 2 rows:
--   {
--     "inventory__col1_1": "Item A",    "inventory__col2_1": "10",     "inventory__col3_1": "$5.00",
--     "inventory__col1_2": "Item B",    "inventory__col2_2": "25",     "inventory__col3_2": "$3.50"
--   }
--
--   Pattern: {dataTableName}__{columnName}_{rowNumber}
--   - dataTableName: Configured in form field (e.g., "inventory", "schedule", "employees")
--   - columnName: Column identifier from dataTableColumns (e.g., "col1", "item_name", "quantity")
--   - rowNumber: 1-indexed row position (1, 2, 3...)
--
-- WHY FLATTENED?
--   1. Simplifies querying individual cells via JSONB operators
--   2. Makes partial updates efficient (update single cell without rebuilding array)
--   3. Consistent key-value structure across all field types
--   4. Easy to extract/filter rows or columns using key patterns
--
-- RECONSTRUCTION:
--   Frontend DataTableInput component extracts keys matching pattern:
--   Object.keys(submissionData).filter(k => k.startsWith('tableName__'))
--
-- =====================================================

CREATE TABLE app.form_data (
    id uuid DEFAULT gen_random_uuid(),
    form_id uuid) ON DELETE CASCADE,

    -- Submission data (JSONB with flattened structure - see documentation above)
    submission_data jsonb DEFAULT '{}'::jsonb,
    submission_status varchar(50) DEFAULT 'draft', -- draft, submitted, approved, rejected

    -- Data stage
    stage varchar(20) DEFAULT 'draft', -- draft, saved

    -- Submission metadata
    submitted_by__employee_id uuid,
    submission_ip_address inet,
    submission_user_agent text,

    -- Workflow tracking
    approval_status varchar(50), -- pending, approved, rejected
    approved_by__employee_id uuid,
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

INSERT INTO app.form_data (
    id,
    form_id,
    submission_data,
    submission_status,
    stage,
    submitted_by__employee_id
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


COMMENT ON TABLE app.form_data IS 'Form submissions with approval workflow';