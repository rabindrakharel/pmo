-- =====================================================
-- Invoice Head Table (invoice)
-- =====================================================
--
-- SEMANTICS:
-- Invoice header table capturing invoice-level metadata and document information.
-- Represents the overall invoice entity with payment status, customer, and attachment.
-- Grain: One row per invoice.
--
-- BUSINESS CONTEXT:
-- - Stores invoice header information (dates, customer, status)
-- - Links to invoice PDF attachment via artifact fields
-- - Tracks payment status and accounting information
-- - Foundation for AR reporting and collections
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- - Links to customer via customer_id (no FK, loose coupling)
-- - Links to project via project_id (no FK, loose coupling)
-- - Links to invoice_data via invoice_number (no FK)
-- - Links to attachment via attachment_id (no FK)
--
-- =====================================================

CREATE TABLE app.invoice (
    -- Primary Key
    id uuid DEFAULT gen_random_uuid(),
    code varchar(100),

    -- Invoice Identification
    invoice_number varchar(50),
    invoice_type varchar(50) DEFAULT 'standard',        -- 'standard', 'progress', 'final', 'credit_memo', 'debit_memo'
    billing_cycle varchar(50),                          -- 'one_time', 'monthly', 'milestone', 'completion'

    -- Date/Time Dimensions
    invoice_date date,
    invoice_datetime timestamptz DEFAULT now(),
    due_date date,
    payment_terms varchar(50) DEFAULT 'net_30',         -- 'due_on_receipt', 'net_30', 'net_60', 'net_90'
    service_period_start_date date,
    service_period_end_date date,

    -- Customer Dimension
    customer_id uuid,
    client_name varchar(255),
    client_type varchar(50),                            -- 'residential', 'commercial', 'government'
    client_tier varchar(50),

    -- Project/Job Association
    project_id uuid,
    project_name varchar(255),

    -- Sales/Project Team
    project_manager_id uuid,
    project_manager_name varchar(255),
    sales_rep_id uuid,
    sales_rep_name varchar(255),
    office_id uuid,
    office_name varchar(255),

    -- Invoice Status & Payment
    invoice_status varchar(50) DEFAULT 'draft',         -- 'draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'void', 'written_off'
    payment_status varchar(50) DEFAULT 'unpaid',        -- 'unpaid', 'partial', 'paid', 'refunded', 'written_off'
    sent_date date,
    viewed_date date,
    paid_date date,
    void_date date,

    -- Payment Tracking (Invoice-level totals)
    total_amount_cad decimal(12,2),                     -- Total invoice amount (sum of line items)
    amount_paid_cad decimal(12,2) DEFAULT 0,            -- Total amount paid
    amount_outstanding_cad decimal(12,2),               -- Remaining balance
    payment_method varchar(50),                         -- 'credit_card', 'cheque', 'eft', 'cash', 'wire'
    payment_reference varchar(100),                     -- Check number, transaction ID, etc.

    -- Aging Analysis
    days_outstanding integer,
    aging_bucket varchar(20),                           -- 'current', '1-30', '31-60', '61-90', '90+'

    -- Customer References
    customer_po_number varchar(100),
    customer_reference varchar(100),

    -- Billing Address (snapshot at time of invoice)
    billing_address_line1 varchar(255),
    billing_address_line2 varchar(255),
    billing_city varchar(100),
    billing_province varchar(2),
    billing_postal_code varchar(7),
    billing_country varchar(2) DEFAULT 'CA',

    -- Accounting Integration
    accounting_period varchar(20),
    fiscal_year integer,
    revenue_recognition_date date,
    gl_account varchar(50),
    cost_center varchar(50),

    -- Artifact Fields (Invoice PDF Document)
    attachment_id uuid,                                  -- Link to attachment table
    dl__artifact_type text,                              -- Artifact type classification
    attachment text,                                     -- Full S3 URI: s3://bucket/key
    attachment_format varchar(20),                       -- File extension: pdf, png, jpg, etc.
    attachment_size_bytes bigint,                        -- File size in bytes
    attachment_object_bucket varchar(100),               -- S3 bucket name
    attachment_object_key varchar(500),                  -- S3 object key

    -- Standard Fields
    metadata jsonb DEFAULT '{}',
    active_flag boolean DEFAULT true,
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    created_by uuid,
    last_modified_by uuid,
    sent_by uuid,

    -- Notes
    notes text,                                         -- Internal invoice notes
    customer_notes text,                                -- Notes visible to customer
    terms_and_conditions text                           -- T&C text (snapshot)
);

COMMENT ON TABLE app.invoice IS 'Invoice header table with one row per invoice, includes artifact fields for invoice PDF';
COMMENT ON COLUMN app.invoice.id IS 'Unique identifier (UUID)';
COMMENT ON COLUMN app.invoice.code IS 'Unique invoice code';
COMMENT ON COLUMN app.invoice.invoice_number IS 'Human-readable invoice number (e.g., INV-2025-00123)';
COMMENT ON COLUMN app.invoice.invoice_type IS 'Invoice type: standard, progress, final, credit_memo, debit_memo';
COMMENT ON COLUMN app.invoice.dl__artifact_type IS 'Artifact type classification for the invoice document';
COMMENT ON COLUMN app.invoice.attachment IS 'Full S3 URI for invoice PDF (s3://bucket/key)';
COMMENT ON COLUMN app.invoice.attachment_format IS 'File extension of invoice document (pdf, png, jpg)';
COMMENT ON COLUMN app.invoice.attachment_size_bytes IS 'File size of invoice document in bytes';
COMMENT ON COLUMN app.invoice.attachment_object_bucket IS 'S3 bucket name for invoice document';
COMMENT ON COLUMN app.invoice.attachment_object_key IS 'S3 object key/path for invoice document';
