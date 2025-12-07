-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- app.supplier - Supplier/Vendor Entity
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- PURPOSE:
-- Manages supplier/vendor information for procurement, ordering, and vendor management.
-- Supplier is a BUSINESS entity (not a person). Primary contact links to app.person
-- for authentication if they need portal access.
--
-- DESIGN:
-- • Business Entity: Supplier is a company, not a person
-- • Person Link: person_id references app.person for PRIMARY CONTACT authentication
-- • Supplier-Specific: payment terms, lead times, ratings, certifications
-- • Universal Entity: Standard code, name, metadata pattern
--
-- RELATIONSHIPS:
-- • Primary Contact: person_id references app.person (if contact needs auth)
-- • Referenced By: f_order.supplier_id (for dropship/procurement orders)
-- • RBAC: entity_rbac tracks permissions via person table
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS app.supplier (
    -- ─────────────────────────────────────────────────────────────────────────
    -- Standard Entity Fields
    -- ─────────────────────────────────────────────────────────────────────────
    id uuid DEFAULT gen_random_uuid(),
    code varchar(100),
    name varchar(255),
    descr text,

    -- ─────────────────────────────────────────────────────────────────────────
    -- Link to Person (for primary contact auth)
    -- ─────────────────────────────────────────────────────────────────────────
    person_id uuid, -- References app.person.id (primary contact auth hub)

    -- ─────────────────────────────────────────────────────────────────────────
    -- Supplier Identification
    -- ─────────────────────────────────────────────────────────────────────────
    supplier_number varchar(50),
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
    -- Address Information (Business Address)
    -- ─────────────────────────────────────────────────────────────────────────
    address_line1 varchar(255),
    address_line2 varchar(255),
    city varchar(100),
    province varchar(50),
    postal_code varchar(20),
    country varchar(50) DEFAULT 'Canada',

    -- ─────────────────────────────────────────────────────────────────────────
    -- Primary Contact Information (stored HERE for display)
    -- If contact needs auth access, they have a person_id record
    -- ─────────────────────────────────────────────────────────────────────────
    primary_contact_first_name varchar(100),
    primary_contact_last_name varchar(100),
    primary_contact_name varchar(255), -- Computed/display name
    primary_contact_email varchar(255),
    primary_contact_phone varchar(50),

    -- ─────────────────────────────────────────────────────────────────────────
    -- Secondary Contact
    -- ─────────────────────────────────────────────────────────────────────────
    secondary_contact_name varchar(255),
    secondary_contact_email varchar(255),
    secondary_contact_phone varchar(50),

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

CREATE INDEX IF NOT EXISTS idx_supplier_person_id ON app.supplier(person_id) WHERE person_id IS NOT NULL;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Comments
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMMENT ON TABLE app.supplier IS 'Supplier/vendor entity for procurement and vendor management. Primary contact auth via app.person (person_id)';
COMMENT ON COLUMN app.supplier.id IS 'Unique identifier (UUID)';
COMMENT ON COLUMN app.supplier.code IS 'Unique supplier code (e.g., SUP-00001)';
COMMENT ON COLUMN app.supplier.name IS 'Supplier/vendor name';
COMMENT ON COLUMN app.supplier.person_id IS 'Link to app.person for primary contact authentication';
COMMENT ON COLUMN app.supplier.supplier_number IS 'Vendor number or supplier code';
COMMENT ON COLUMN app.supplier.company_name IS 'Legal company name';
COMMENT ON COLUMN app.supplier.tax_id IS 'Tax ID (GST/HST number, EIN, etc.)';
COMMENT ON COLUMN app.supplier.primary_contact_first_name IS 'Primary contact first name';
COMMENT ON COLUMN app.supplier.primary_contact_last_name IS 'Primary contact last name';
COMMENT ON COLUMN app.supplier.primary_contact_name IS 'Primary contact display name';
COMMENT ON COLUMN app.supplier.primary_contact_email IS 'Primary contact email';
COMMENT ON COLUMN app.supplier.primary_contact_phone IS 'Primary contact phone';
