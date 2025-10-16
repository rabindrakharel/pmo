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
    approved_at timestamptz,

    -- Temporal fields
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);



COMMENT ON TABLE app.d_form_data IS 'Form submissions with approval workflow';