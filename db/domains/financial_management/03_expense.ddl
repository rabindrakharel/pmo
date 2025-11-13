-- =====================================================
-- Expense Fact Table (f_expense)
-- =====================================================
--
-- SEMANTICS:
-- Header-level fact table capturing all expense transactions.
-- Represents cost and expense events by category and subcategory following CRA T2125 classification.
-- Grain: One row per expense transaction.
--
-- BUSINESS CONTEXT:
-- - Records all expenses across projects, clients, and operations
-- - Supports expense tracking, cost control, and financial reporting
-- - Tracks expenses by CRA T2125 categories for accurate tax filing
-- - Enables cost analysis, budget tracking, and expense forecasting
-- - Foundation for Canadian business tax reporting (T2125)
--
-- RELATIONSHIPS:
-- - Links to f_invoice (associated expenses for invoiced work)
-- - Links to d_employee (employee incurring expense)
-- - Links to d_project (project expense allocation)
-- - Links to d_business (business unit)
-- - Links to d_office (office/location)
-- - Links to d_client (client-related expenses)
--
-- METRICS:
-- - Total expense amount by category/subcategory
-- - Expense by project, employee, period
-- - Tax-deductible expenses (CRA line numbers)
-- - Expense trends and budget variance
--
-- =====================================================

DROP TABLE IF EXISTS app.f_expense CASCADE;

CREATE TABLE app.f_expense (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Expense Identification
    expense_number VARCHAR(50) NOT NULL UNIQUE,        -- Human-readable expense transaction number (e.g., "EXP-2025-00123")
    expense_type VARCHAR(50) DEFAULT 'standard',       -- 'standard', 'recurring', 'one_time', 'adjustment', 'reimbursement'

    -- Date/Time Dimensions
    expense_date DATE NOT NULL,                         -- Date expense was incurred
    expense_datetime TIMESTAMP NOT NULL DEFAULT NOW(),  -- Precise expense timestamp
    recognition_date DATE,                              -- Accounting expense recognition date
    fiscal_year INTEGER,                                -- Fiscal year
    accounting_period VARCHAR(20),                      -- Accounting period (e.g., "2025-01", "Q1-2025")

    -- CRA T2125 Classification
    dl__expense_category VARCHAR(100),                  -- Expense category (Advertising, Meals and Entertainment, etc.)
    dl__expense_subcategory VARCHAR(100),               -- Expense subcategory (Google Ads, Business Meals, etc.)
    dl__expense_code VARCHAR(50),                       -- Internal expense code
    cra_line VARCHAR(20),                               -- CRA T2125 line number (8521, 8523, etc.)
    deductibility_percent DECIMAL(5,2) DEFAULT 100.00,  -- Tax deductibility % (50% for meals, 100% for others)

    -- Entity Linkages
    invoice_id UUID,                                    -- Link to f_invoice (if expense relates to billable work)
    invoice_number VARCHAR(50),                         -- Denormalized invoice number
    project_id UUID,                                    -- Link to d_project
    project_name VARCHAR(255),                          -- Denormalized project name
    employee_id UUID,                                   -- Employee who incurred expense
    employee_name VARCHAR(255),                         -- Denormalized employee name
    client_id UUID,                                     -- Link to d_client (if client-related)
    client_name VARCHAR(255),                           -- Denormalized client name
    business_id UUID,                                   -- Link to d_business
    business_name VARCHAR(255),                         -- Denormalized business name
    office_id UUID,                                     -- Link to d_office
    office_name VARCHAR(255),                           -- Denormalized office name

    -- Expense Metrics (Canadian Dollars)
    expense_amount_cad DECIMAL(15,2) NOT NULL,          -- Total expense amount
    deductible_amount_cad DECIMAL(15,2),                -- Tax-deductible amount (expense_amount * deductibility_percent / 100)
    reimbursable_flag BOOLEAN DEFAULT false,            -- Is this expense reimbursable to employee?
    reimbursed_flag BOOLEAN DEFAULT false,              -- Has this expense been reimbursed?
    reimbursed_date DATE,                               -- Date reimbursed

    -- Tax Information
    tax_amount_cad DECIMAL(12,2) DEFAULT 0,             -- GST/HST/PST
    gst_amount_cad DECIMAL(12,2) DEFAULT 0,             -- GST component
    pst_amount_cad DECIMAL(12,2) DEFAULT 0,             -- PST component
    hst_amount_cad DECIMAL(12,2) DEFAULT 0,             -- HST component
    tax_rate DECIMAL(5,2),                              -- Effective tax rate
    tax_recoverable_flag BOOLEAN DEFAULT true,          -- Can GST/HST be recovered as ITC?

    -- Payment Status
    expense_status VARCHAR(50) DEFAULT 'submitted',     -- 'draft', 'submitted', 'approved', 'rejected', 'paid', 'cancelled'
    payment_status VARCHAR(50) DEFAULT 'unpaid',        -- 'unpaid', 'partial', 'paid'
    payment_method VARCHAR(50),                         -- 'credit_card', 'cheque', 'eft', 'cash', 'wire'
    payment_reference VARCHAR(100),                     -- Payment reference number
    paid_date DATE,                                     -- Date paid

    -- Standardized S3 Attachment Fields (receipts, invoices)
    attachment TEXT,                                     -- Full S3 URI: s3://bucket/key
    attachment_format VARCHAR(20),                       -- File extension: pdf, png, jpg, etc.
    attachment_size_bytes BIGINT,                        -- File size in bytes
    attachment_object_bucket VARCHAR(100),               -- S3 bucket name
    attachment_object_key VARCHAR(500),                  -- S3 object key

    -- Metadata
    notes TEXT,                                         -- Internal notes
    description TEXT,                                   -- Expense description
    tags TEXT[],                                        -- Searchable tags
    vendor_name VARCHAR(255),                           -- Vendor/supplier name

    -- Timestamps
    created_ts TIMESTAMPTZ DEFAULT NOW(),
    updated_ts TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,                                    -- Employee who created record
    last_modified_by UUID,
    approved_by UUID,                                   -- Manager who approved expense
    approved_date DATE                                  -- Approval date
);

-- Trigger to calculate derived fields
CREATE OR REPLACE FUNCTION app.calculate_f_expense_fields() RETURNS TRIGGER AS $$
BEGIN
    -- Calculate deductible amount
    NEW.deductible_amount_cad := NEW.expense_amount_cad * (COALESCE(NEW.deductibility_percent, 100) / 100.0);

    -- Set accounting period
    NEW.accounting_period := TO_CHAR(NEW.expense_date, 'YYYY-MM');
    NEW.fiscal_year := EXTRACT(YEAR FROM NEW.expense_date);

    -- Set recognition date if not provided
    IF NEW.recognition_date IS NULL THEN
        NEW.recognition_date := NEW.expense_date;
    END IF;

    NEW.updated_ts := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER f_expense_calculate_fields BEFORE INSERT OR UPDATE ON app.f_expense
    FOR EACH ROW EXECUTE FUNCTION app.calculate_f_expense_fields();

-- Indexes for performance
CREATE INDEX idx_f_expense_date ON app.f_expense(expense_date);
CREATE INDEX idx_f_expense_category ON app.f_expense(dl__expense_category);
CREATE INDEX idx_f_expense_subcategory ON app.f_expense(dl__expense_subcategory);
CREATE INDEX idx_f_expense_project_id ON app.f_expense(project_id);
CREATE INDEX idx_f_expense_employee_id ON app.f_expense(employee_id);
CREATE INDEX idx_f_expense_client_id ON app.f_expense(client_id);
CREATE INDEX idx_f_expense_period ON app.f_expense(accounting_period);
CREATE INDEX idx_f_expense_fiscal_year ON app.f_expense(fiscal_year);
CREATE INDEX idx_f_expense_status ON app.f_expense(expense_status);
CREATE INDEX idx_f_expense_payment_status ON app.f_expense(payment_status);

-- =====================================================
-- SAMPLE DATA: Curated Expense Transactions
-- Based on CRA T2125 Expense Categories
-- =====================================================

INSERT INTO app.f_expense (
    expense_number, expense_type, expense_date, expense_datetime,
    dl__expense_category, dl__expense_subcategory, dl__expense_code, cra_line, deductibility_percent,
    employee_name, vendor_name,
    expense_amount_cad, tax_rate,
    expense_status, payment_status, description
) VALUES
-- Advertising Expenses (CRA Line 8521 - 100% deductible)
('EXP-2025-00001', 'recurring', '2025-01-05', '2025-01-05 10:00:00',
 'Advertising', 'Google Ads', 'ADV-GOOGLE', '8521', 100.00,
 'James Miller', 'Google LLC',
 2500.00, 13.00,
 'approved', 'paid', 'January Google Ads campaign - home services keywords'),

('EXP-2025-00002', 'recurring', '2025-01-08', '2025-01-08 14:30:00',
 'Advertising', 'Facebook/Instagram Ads', 'ADV-META', '8521', 100.00,
 'James Miller', 'Meta Platforms Inc.',
 1800.00, 13.00,
 'approved', 'paid', 'January social media advertising campaign'),

('EXP-2025-00003', 'one_time', '2025-01-12', '2025-01-12 09:00:00',
 'Advertising', 'Print – Flyers/Brochures', 'ADV-PRINT', '8521', 100.00,
 'James Miller', 'PrintShop Canada',
 450.00, 13.00,
 'approved', 'paid', '5,000 full-color service brochures'),

('EXP-2025-00004', 'recurring', '2025-01-15', '2025-01-15 11:00:00',
 'Advertising', 'Website Promotions/SEO', 'ADV-SEO', '8521', 100.00,
 'James Miller', 'Digital Marketing Agency',
 1200.00, 13.00,
 'approved', 'paid', 'Monthly SEO optimization and content marketing'),

('EXP-2025-00005', 'one_time', '2025-01-20', '2025-01-20 16:00:00',
 'Advertising', 'Sponsorships', 'ADV-SPONSOR', '8521', 100.00,
 'James Miller', 'Toronto Home Show',
 3500.00, 13.00,
 'approved', 'paid', 'Gold sponsorship package - Toronto Home Show 2025'),

-- Meals and Entertainment (CRA Line 8523 - 50% deductible)
('EXP-2025-00006', 'standard', '2025-01-18', '2025-01-18 12:30:00',
 'Meals and Entertainment (50%)', 'Business Meals', 'MEAL-CLIENT', '8523', 50.00,
 'James Miller', 'The Keg Steakhouse',
 185.00, 13.00,
 'approved', 'paid', 'Client lunch meeting - discuss Q1 renovation project'),

('EXP-2025-00007', 'standard', '2025-01-22', '2025-01-22 19:00:00',
 'Meals and Entertainment (50%)', 'Client Entertainment', 'ENT-CLIENT', '8523', 50.00,
 'James Miller', 'Blue Jays Stadium',
 420.00, 13.00,
 'approved', 'paid', 'Client entertainment - season ticket seats with major commercial client'),

('EXP-2025-00008', 'one_time', '2025-01-25', '2025-01-25 18:30:00',
 'Meals and Entertainment (50%)', 'Staff Functions (50%)', 'MEAL-STAFF', '8523', 50.00,
 'James Miller', 'Boston Pizza',
 650.00, 13.00,
 'approved', 'paid', 'Team dinner - celebrate Q4 performance (15 staff)'),

-- Additional Advertising Expenses
('EXP-2025-00009', 'one_time', '2025-01-28', '2025-01-28 10:00:00',
 'Advertising', 'Radio Advertising', 'ADV-RADIO', '8521', 100.00,
 'James Miller', 'CBC Radio',
 2200.00, 13.00,
 'submitted', 'unpaid', '2-week radio spot campaign on CBC - weekday mornings'),

('EXP-2025-00010', 'standard', '2025-02-01', '2025-02-01 15:00:00',
 'Advertising', 'TV Advertising', 'ADV-TV', '8521', 100.00,
 'James Miller', 'CTV Network',
 5500.00, 13.00,
 'submitted', 'unpaid', 'Local TV commercial - February promotional campaign'),

-- More Meals and Entertainment
('EXP-2025-00011', 'standard', '2025-02-03', '2025-02-03 12:00:00',
 'Meals and Entertainment (50%)', 'Business Meals', 'MEAL-CLIENT', '8523', 50.00,
 'James Miller', 'Harbour Sixty Steakhouse',
 320.00, 13.00,
 'submitted', 'unpaid', 'Business lunch with prospective commercial client'),

('EXP-2025-00012', 'standard', '2025-02-05', '2025-02-05 13:00:00',
 'Meals and Entertainment (50%)', 'Business Meals', 'MEAL-CLIENT', '8523', 50.00,
 'James Miller', 'Starbucks',
 45.00, 13.00,
 'approved', 'paid', 'Coffee meeting with supplier - negotiate volume discounts');

-- Update timestamps
UPDATE app.f_expense SET updated_ts = NOW();

COMMENT ON TABLE app.f_expense IS 'Expense fact table at header level with CRA T2125 category classification';
COMMENT ON COLUMN app.f_expense.dl__expense_category IS 'CRA T2125 expense category (Advertising, Meals and Entertainment, etc.)';
COMMENT ON COLUMN app.f_expense.dl__expense_subcategory IS 'CRA T2125 expense subcategory (Google Ads, Business Meals, etc.)';
COMMENT ON COLUMN app.f_expense.cra_line IS 'CRA T2125 form line number for tax reporting (8521, 8523, etc.)';
COMMENT ON COLUMN app.f_expense.deductibility_percent IS 'Tax deductibility percentage (50% for meals/entertainment, 100% for most others)';
COMMENT ON COLUMN app.f_expense.deductible_amount_cad IS 'Tax-deductible amount after applying deductibility percentage';
