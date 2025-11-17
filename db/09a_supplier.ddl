-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- d_supplier - Supplier/Vendor Entity
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- PURPOSE:
-- Manages supplier/vendor information for procurement, ordering, and vendor management.
-- Links to d_person for common contact/address fields.
--
-- DESIGN:
-- • Person Link: person_id references d_person for common fields
-- • Supplier-Specific: payment terms, lead times, ratings, certifications
-- • Universal Entity: Follows d_ prefix with code, name, metadata pattern
--
-- RELATIONSHIPS:
-- • Parent: d_person.id (for contact/address information)
-- • Referenced By: f_order.supplier_id (for dropship/procurement orders)
-- • RBAC: d_entity_rbac tracks permissions
--
-- USAGE PATTERNS:
-- • CREATE: Create d_person first, then d_supplier with person_id
-- • UPDATE: Update contact info in d_person, supplier-specific here
-- • QUERY: Join with d_person for complete supplier view
-- • ORDERS: Reference supplier_id in f_order for procurement tracking
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS app.d_supplier (
    -- ─────────────────────────────────────────────────────────────────────────
    -- Standard Entity Fields
    -- ─────────────────────────────────────────────────────────────────────────
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(100) UNIQUE NOT NULL,
    name varchar(255) NOT NULL,
    descr text,

    -- ─────────────────────────────────────────────────────────────────────────
    -- Supplier Identification
    -- ─────────────────────────────────────────────────────────────────────────
    supplier_number varchar(50), -- Vendor number / supplier code
    company_name varchar(255),
    tax_id varchar(50), -- GST/HST number, EIN, etc.
    website varchar(500),

    -- ─────────────────────────────────────────────────────────────────────────
    -- Procurement & Payment
    -- ─────────────────────────────────────────────────────────────────────────
    payment_terms varchar(100), -- Net 30, Net 60, COD, etc.
    currency varchar(10) DEFAULT 'CAD',
    credit_limit_amt numeric(15,2),
    discount_pct numeric(5,2),

    -- ─────────────────────────────────────────────────────────────────────────
    -- Supply Chain
    -- ─────────────────────────────────────────────────────────────────────────
    lead_time_days integer,
    minimum_order_amt numeric(15,2),
    dl__supplier_type varchar(50), -- manufacturer, distributor, wholesaler, service
    dl__delivery_method varchar(50), -- pickup, delivery, dropship

    -- ─────────────────────────────────────────────────────────────────────────
    -- Quality & Compliance
    -- ─────────────────────────────────────────────────────────────────────────
    dl__supplier_rating varchar(20), -- excellent, good, fair, poor
    is_preferred boolean DEFAULT false,
    is_certified boolean DEFAULT false,
    certification_details text,

    -- ─────────────────────────────────────────────────────────────────────────
    -- Contact Information (Primary Contact)
    -- ─────────────────────────────────────────────────────────────────────────
    primary_contact_name varchar(255),
    primary_contact_email varchar(255),
    primary_contact_phone varchar(50),

    -- ─────────────────────────────────────────────────────────────────────────
    -- Standard Metadata & Temporal Fields
    -- ─────────────────────────────────────────────────────────────────────────
    metadata jsonb DEFAULT '{}',
    active_flag boolean DEFAULT true,
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Indexes
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE INDEX idx_supplier_code ON app.d_supplier(code);
CREATE INDEX idx_supplier_name ON app.d_supplier(name);
CREATE INDEX idx_supplier_person_id ON app.d_supplier(person_id) WHERE person_id IS NOT NULL;
CREATE INDEX idx_supplier_number ON app.d_supplier(supplier_number) WHERE supplier_number IS NOT NULL;
CREATE INDEX idx_supplier_type ON app.d_supplier(dl__supplier_type) WHERE dl__supplier_type IS NOT NULL;
CREATE INDEX idx_supplier_rating ON app.d_supplier(dl__supplier_rating) WHERE dl__supplier_rating IS NOT NULL;
CREATE INDEX idx_supplier_preferred ON app.d_supplier(is_preferred) WHERE is_preferred = true;
CREATE INDEX idx_supplier_active ON app.d_supplier(active_flag) WHERE active_flag = true;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Comments
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMMENT ON TABLE app.d_supplier IS 'Supplier/vendor entity for procurement and vendor management';
COMMENT ON COLUMN app.d_supplier.id IS 'Unique identifier (UUID)';
COMMENT ON COLUMN app.d_supplier.code IS 'Unique supplier code (e.g., SUP-00001)';
COMMENT ON COLUMN app.d_supplier.name IS 'Supplier/vendor name';
COMMENT ON COLUMN app.d_supplier.descr IS 'Description of supplier';
COMMENT ON COLUMN app.d_supplier.person_id IS 'Link to d_person for contact/address information';
COMMENT ON COLUMN app.d_supplier.supplier_number IS 'Vendor number or supplier code';
COMMENT ON COLUMN app.d_supplier.company_name IS 'Legal company name';
COMMENT ON COLUMN app.d_supplier.tax_id IS 'Tax ID (GST/HST number, EIN, etc.)';
COMMENT ON COLUMN app.d_supplier.website IS 'Supplier website URL';
COMMENT ON COLUMN app.d_supplier.payment_terms IS 'Payment terms (Net 30, Net 60, COD)';
COMMENT ON COLUMN app.d_supplier.currency IS 'Currency code (CAD, USD, etc.)';
COMMENT ON COLUMN app.d_supplier.credit_limit_amt IS 'Credit limit amount';
COMMENT ON COLUMN app.d_supplier.discount_pct IS 'Default discount percentage';
COMMENT ON COLUMN app.d_supplier.lead_time_days IS 'Standard lead time in days';
COMMENT ON COLUMN app.d_supplier.minimum_order_amt IS 'Minimum order amount';
COMMENT ON COLUMN app.d_supplier.dl__supplier_type IS 'Supplier type (manufacturer, distributor, wholesaler, service)';
COMMENT ON COLUMN app.d_supplier.dl__delivery_method IS 'Delivery method (pickup, delivery, dropship)';
COMMENT ON COLUMN app.d_supplier.dl__supplier_rating IS 'Supplier rating (excellent, good, fair, poor)';
COMMENT ON COLUMN app.d_supplier.is_preferred IS 'Preferred supplier flag';
COMMENT ON COLUMN app.d_supplier.is_certified IS 'Certified supplier flag';
COMMENT ON COLUMN app.d_supplier.certification_details IS 'Certification details';
COMMENT ON COLUMN app.d_supplier.primary_contact_name IS 'Primary contact person name';
COMMENT ON COLUMN app.d_supplier.primary_contact_email IS 'Primary contact email';
COMMENT ON COLUMN app.d_supplier.primary_contact_phone IS 'Primary contact phone';
COMMENT ON COLUMN app.d_supplier.metadata IS 'Additional flexible attributes';
COMMENT ON COLUMN app.d_supplier.active_flag IS 'Soft delete flag (true = active)';
COMMENT ON COLUMN app.d_supplier.from_ts IS 'Valid from timestamp';
COMMENT ON COLUMN app.d_supplier.to_ts IS 'Valid to timestamp (NULL = current)';
COMMENT ON COLUMN app.d_supplier.created_ts IS 'Record creation timestamp';
COMMENT ON COLUMN app.d_supplier.updated_ts IS 'Last update timestamp';
