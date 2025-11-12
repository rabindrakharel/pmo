-- =====================================================
-- Revenue Fact Table (f_revenue)
-- =====================================================
--
-- SEMANTICS:
-- Header-level fact table capturing all revenue transactions aggregated from invoices.
-- Represents income events by category and subcategory following CRA T2125 classification.
-- Grain: One row per revenue transaction (aggregated from f_invoice line items).
--
-- BUSINESS CONTEXT:
-- - Records all income across projects, clients, and products
-- - Supports revenue recognition, financial reporting, and tax compliance
-- - Tracks revenue by CRA T2125 categories for accurate tax filing
-- - Enables profitability analysis and revenue forecasting
-- - Foundation for Canadian business tax reporting (T2125)
--
-- RELATIONSHIPS:
-- - Links to f_invoice (source transactions)
-- - Links to d_client (customer generating revenue)
-- - Links to d_project (project generating revenue)
-- - Links to d_employee (responsible employee)
-- - Links to d_business (business unit)
-- - Links to d_office (office/location)
--
-- METRICS:
-- - Total revenue amount by category/subcategory
-- - Revenue by client, project, employee, period
-- - Tax-reportable revenue (CRA line numbers)
-- - Revenue trends and forecasts
--
-- =====================================================

DROP TABLE IF EXISTS app.f_revenue CASCADE;

CREATE TABLE app.f_revenue (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Revenue Identification
    revenue_number VARCHAR(50) NOT NULL UNIQUE,        -- Human-readable revenue transaction number (e.g., "REV-2025-00123")
    revenue_type VARCHAR(50) DEFAULT 'standard',       -- 'standard', 'recurring', 'one_time', 'adjustment', 'refund'

    -- Date/Time Dimensions
    revenue_date DATE NOT NULL,                         -- Date revenue was recognized
    revenue_datetime TIMESTAMP NOT NULL DEFAULT NOW(),  -- Precise revenue timestamp
    recognition_date DATE,                              -- Accounting revenue recognition date
    fiscal_year INTEGER,                                -- Fiscal year
    accounting_period VARCHAR(20),                      -- Accounting period (e.g., "2025-01", "Q1-2025")

    -- CRA T2125 Classification
    dl__revenue_category VARCHAR(100),                  -- Revenue category (Sales/Commissions/Fees, Other Income, etc.)
    dl__revenue_subcategory VARCHAR(100),               -- Revenue subcategory (Retail Sales, Online Sales, etc.)
    dl__revenue_code VARCHAR(50),                       -- Internal revenue code
    cra_line VARCHAR(20),                               -- CRA T2125 line number (if applicable)

    -- Entity Linkages
    invoice_id UUID,                                    -- Link to f_invoice (source invoice)
    invoice_number VARCHAR(50),                         -- Denormalized invoice number
    client_id UUID,                                     -- Link to d_client
    client_name VARCHAR(255),                           -- Denormalized client name
    client_type VARCHAR(50),                            -- 'residential', 'commercial', 'government'
    project_id UUID,                                    -- Link to d_project
    project_name VARCHAR(255),                          -- Denormalized project name
    employee_id UUID,                                   -- Responsible employee
    employee_name VARCHAR(255),                         -- Denormalized employee name
    business_id UUID,                                   -- Link to d_business
    business_name VARCHAR(255),                         -- Denormalized business name
    office_id UUID,                                     -- Link to d_office
    office_name VARCHAR(255),                           -- Denormalized office name

    -- Revenue Metrics (Canadian Dollars)
    revenue_amount_cad DECIMAL(15,2) NOT NULL,          -- Total revenue amount
    cost_amount_cad DECIMAL(15,2) DEFAULT 0,            -- Associated cost (for margin calculation)
    margin_amount_cad DECIMAL(15,2),                    -- Margin (revenue - cost)
    margin_percent DECIMAL(5,2),                        -- Margin percentage

    -- Tax Information
    tax_amount_cad DECIMAL(12,2) DEFAULT 0,             -- GST/HST/PST
    gst_amount_cad DECIMAL(12,2) DEFAULT 0,             -- GST component
    pst_amount_cad DECIMAL(12,2) DEFAULT 0,             -- PST component
    hst_amount_cad DECIMAL(12,2) DEFAULT 0,             -- HST component
    tax_rate DECIMAL(5,2),                              -- Effective tax rate
    tax_exempt_flag BOOLEAN DEFAULT false,              -- Tax exempt revenue

    -- Revenue Status
    revenue_status VARCHAR(50) DEFAULT 'recognized',    -- 'pending', 'recognized', 'deferred', 'reversed', 'adjusted'
    payment_status VARCHAR(50),                         -- 'unpaid', 'partial', 'paid' (from linked invoice)

    -- Metadata
    notes TEXT,                                         -- Internal notes
    description TEXT,                                   -- Revenue description
    tags TEXT[],                                        -- Searchable tags

    -- Timestamps
    created_ts TIMESTAMPTZ DEFAULT NOW(),
    updated_ts TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,                                    -- Employee who created record
    last_modified_by UUID
);

-- Trigger to calculate derived fields
CREATE OR REPLACE FUNCTION app.calculate_f_revenue_fields() RETURNS TRIGGER AS $$
BEGIN
    -- Calculate margin
    NEW.margin_amount_cad := NEW.revenue_amount_cad - COALESCE(NEW.cost_amount_cad, 0);

    IF NEW.revenue_amount_cad > 0 THEN
        NEW.margin_percent := (NEW.margin_amount_cad / NEW.revenue_amount_cad) * 100;
    ELSE
        NEW.margin_percent := 0;
    END IF;

    -- Set accounting period
    NEW.accounting_period := TO_CHAR(NEW.revenue_date, 'YYYY-MM');
    NEW.fiscal_year := EXTRACT(YEAR FROM NEW.revenue_date);

    -- Set recognition date if not provided
    IF NEW.recognition_date IS NULL THEN
        NEW.recognition_date := NEW.revenue_date;
    END IF;

    NEW.updated_ts := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER f_revenue_calculate_fields BEFORE INSERT OR UPDATE ON app.f_revenue
    FOR EACH ROW EXECUTE FUNCTION app.calculate_f_revenue_fields();

-- Indexes for performance
CREATE INDEX idx_f_revenue_date ON app.f_revenue(revenue_date);
CREATE INDEX idx_f_revenue_category ON app.f_revenue(dl__revenue_category);
CREATE INDEX idx_f_revenue_subcategory ON app.f_revenue(dl__revenue_subcategory);
CREATE INDEX idx_f_revenue_client_id ON app.f_revenue(client_id);
CREATE INDEX idx_f_revenue_project_id ON app.f_revenue(project_id);
CREATE INDEX idx_f_revenue_invoice_id ON app.f_revenue(invoice_id);
CREATE INDEX idx_f_revenue_period ON app.f_revenue(accounting_period);
CREATE INDEX idx_f_revenue_fiscal_year ON app.f_revenue(fiscal_year);

-- =====================================================
-- SAMPLE DATA: Curated Revenue Transactions
-- Based on CRA T2125 Revenue Categories
-- =====================================================

INSERT INTO app.f_revenue (
    revenue_number, revenue_type, revenue_date, revenue_datetime,
    dl__revenue_category, dl__revenue_subcategory, dl__revenue_code,
    client_name, client_type, employee_name,
    revenue_amount_cad, cost_amount_cad, tax_rate,
    revenue_status, payment_status, description
) VALUES
-- Sales, Commissions, or Fees
('REV-2025-00001', 'standard', '2025-01-15', '2025-01-15 16:00:00',
 'Sales, Commissions, or Fees', 'Retail Sales', 'RETAIL-001',
 'Smith Residence Renovation', 'residential', 'James Miller',
 15000.00, 9500.00, 13.00,
 'recognized', 'paid', 'Residential framing and materials sale'),

('REV-2025-00002', 'standard', '2025-01-18', '2025-01-18 10:30:00',
 'Sales, Commissions, or Fees', 'Service Income', 'SERVICE-001',
 'Downtown Office Building', 'commercial', 'James Miller',
 25000.00, 14000.00, 13.00,
 'recognized', 'paid', 'Commercial electrical installation services'),

('REV-2025-00003', 'standard', '2025-01-20', '2025-01-20 14:00:00',
 'Sales, Commissions, or Fees', 'Project Income', 'PROJECT-001',
 'Johnson Family Home', 'residential', 'James Miller',
 35000.00, 22000.00, 13.00,
 'recognized', 'partial', 'HVAC installation project milestone payment'),

('REV-2025-00004', 'recurring', '2025-01-22', '2025-01-22 09:00:00',
 'Sales, Commissions, or Fees', 'Commissions Earned', 'COMMISSION-001',
 'Real Estate Referral Network', 'commercial', 'James Miller',
 5000.00, 500.00, 13.00,
 'recognized', 'paid', 'Referral commission from real estate partner'),

-- Other Income
('REV-2025-00005', 'one_time', '2025-01-25', '2025-01-25 11:00:00',
 'Other Income', 'Miscellaneous Income', 'MISC-001',
 'Various', 'residential', 'James Miller',
 1200.00, 0.00, 13.00,
 'recognized', 'paid', 'Equipment rental income'),

('REV-2025-00006', 'adjustment', '2025-01-26', '2025-01-26 15:30:00',
 'Other Income', 'Refunds and Rebates', 'REBATE-001',
 'Supplier Network', 'commercial', 'James Miller',
 850.00, 0.00, 0.00,
 'recognized', 'paid', 'Supplier volume rebate for Q4 2024'),

('REV-2025-00007', 'recurring', '2025-02-01', '2025-02-01 10:00:00',
 'Other Income', 'Rental Income', 'RENTAL-001',
 'Storage Customer', 'commercial', 'James Miller',
 2500.00, 500.00, 13.00,
 'recognized', 'paid', 'Monthly warehouse storage rental'),

-- Interest Income
('REV-2025-00008', 'recurring', '2025-01-31', '2025-01-31 23:59:00',
 'Interest Income', 'Bank Interest', 'INTEREST-001',
 'Royal Bank of Canada', 'government', 'James Miller',
 125.50, 0.00, 0.00,
 'recognized', 'paid', 'Monthly business account interest'),

('REV-2025-00009', 'recurring', '2025-01-31', '2025-01-31 23:59:00',
 'Interest Income', 'Investment Interest', 'INVEST-001',
 'TD Canada Trust', 'government', 'James Miller',
 450.00, 0.00, 0.00,
 'recognized', 'paid', 'GIC interest income'),

-- Grants or Subsidies
('REV-2025-00010', 'one_time', '2025-01-28', '2025-01-28 14:00:00',
 'Grants or Subsidies', 'Training or Program Grant', 'GRANT-001',
 'Government of Canada', 'government', 'James Miller',
 10000.00, 0.00, 0.00,
 'recognized', 'paid', 'Skills development training grant'),

-- Inventory Adjustments
('REV-2025-00011', 'adjustment', '2025-01-31', '2025-01-31 17:00:00',
 'Inventory Adjustments', 'Inventory Gain', 'INV-ADJ-001',
 'Internal', 'residential', 'James Miller',
 750.00, 0.00, 0.00,
 'recognized', 'paid', 'Inventory revaluation gain - year-end count');

-- Update timestamps
UPDATE app.f_revenue SET updated_ts = NOW();

COMMENT ON TABLE app.f_revenue IS 'Revenue fact table at header level with CRA T2125 category classification';
COMMENT ON COLUMN app.f_revenue.dl__revenue_category IS 'CRA T2125 revenue category (Sales/Commissions/Fees, Other Income, Interest Income, etc.)';
COMMENT ON COLUMN app.f_revenue.dl__revenue_subcategory IS 'CRA T2125 revenue subcategory (Retail Sales, Service Income, etc.)';
COMMENT ON COLUMN app.f_revenue.cra_line IS 'CRA T2125 form line number for tax reporting';
