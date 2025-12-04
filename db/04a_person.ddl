-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- app.person - Base Entity for All People
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- PURPOSE:
-- Base entity that merges common fields across all person types (employee, customer, vendor, supplier).
-- Eliminates duplication and provides unified person management.
--
-- DESIGN:
-- • Common Fields: name, email, phone, address shared across all person types
-- • Single Type: type_code field identifies primary person type (employee, customer, vendor, supplier)
-- • Specialized Entities: employee, cust extend with role-specific fields
-- • Standard Entity: Standard code, name, metadata pattern
--
-- RELATIONSHIPS:
-- • Parent: None (base entity)
-- • Children: d_employee.person_id, d_cust.person_id (future: d_vendor, d_supplier)
-- • RBAC: entity_rbac.person_id references this table
--
-- USAGE PATTERNS:
-- • CREATE: Person created first, then specialized role entity
-- • UPDATE: Common fields updated here, role-specific in specialized tables
-- • QUERY: Join with employee/cust for complete person view
-- • TYPE: Person has single primary type_code (employee, customer, vendor, supplier)
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS app.person (
    -- ─────────────────────────────────────────────────────────────────────────
    -- Standard Entity Fields
    -- ─────────────────────────────────────────────────────────────────────────
    id uuid DEFAULT gen_random_uuid(),
    code varchar(100),

    -- ─────────────────────────────────────────────────────────────────────────
    -- Person Identification
    -- ─────────────────────────────────────────────────────────────────────────
    first_name varchar(100),
    last_name varchar(100),
    full_name varchar(255) GENERATED ALWAYS AS (
        CASE
            WHEN first_name IS AND last_name IS
            THEN first_name || ' ' || last_name
            WHEN first_name IS THEN first_name
            WHEN last_name IS THEN last_name
            ELSE NULL
        END
    ) STORED,

    -- ─────────────────────────────────────────────────────────────────────────
    -- Contact Information (Common across all person types)
    -- ─────────────────────────────────────────────────────────────────────────
    email varchar(255),
    phone varchar(50),
    mobile varchar(50),
    fax varchar(50),

    -- ─────────────────────────────────────────────────────────────────────────
    -- Address Information (Common across all person types)
    -- ─────────────────────────────────────────────────────────────────────────
    addr_line1 varchar(255),
    addr_line2 varchar(255),
    city varchar(100),
    province varchar(50),
    postal_code varchar(20),
    country varchar(50) DEFAULT 'Canada',

    -- ─────────────────────────────────────────────────────────────────────────
    -- Person Type (Single Primary Type)
    -- ─────────────────────────────────────────────────────────────────────────
    type_code varchar(100), -- Primary person type: 'employee', 'customer', 'vendor', 'supplier'

    -- ─────────────────────────────────────────────────────────────────────────
    -- Role References (person references specialized role entities - NO FKs for loose coupling)
    -- ─────────────────────────────────────────────────────────────────────────
    employee_id uuid, -- If this person is an employee (references employee.id)
    customer_id uuid,     -- If this person is a customer (references customer.id)
    supplier_id uuid, -- If this person is a supplier (references supplier.id)

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


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Comments
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMMENT ON TABLE app.person IS 'Base entity for all people (employees, customers, vendors, suppliers) with common fields';
COMMENT ON COLUMN app.person.id IS 'Unique identifier (UUID)';
COMMENT ON COLUMN app.person.code IS 'Unique person code (e.g., PER-00001)';
COMMENT ON COLUMN app.person.first_name IS 'First name';
COMMENT ON COLUMN app.person.last_name IS 'Last name';
COMMENT ON COLUMN app.person.full_name IS 'Generated full name (first + last)';
COMMENT ON COLUMN app.person.email IS 'Primary email address';
COMMENT ON COLUMN app.person.phone IS 'Primary phone number';
COMMENT ON COLUMN app.person.mobile IS 'Mobile phone number';
COMMENT ON COLUMN app.person.addr_line1 IS 'Address line 1';
COMMENT ON COLUMN app.person.addr_line2 IS 'Address line 2 (unit, suite, etc.)';
COMMENT ON COLUMN app.person.city IS 'City';
COMMENT ON COLUMN app.person.province IS 'Province/State';
COMMENT ON COLUMN app.person.postal_code IS 'Postal code / ZIP code';
COMMENT ON COLUMN app.person.country IS 'Country (default: Canada)';
COMMENT ON COLUMN app.person.type_code IS 'Primary person type code: employee, customer, vendor, or supplier';
COMMENT ON COLUMN app.person.metadata IS 'Additional flexible attributes';
COMMENT ON COLUMN app.person.active_flag IS 'Soft delete flag (true = active)';
COMMENT ON COLUMN app.person.from_ts IS 'Valid from timestamp';
COMMENT ON COLUMN app.person.to_ts IS 'Valid to timestamp (NULL = current)';
COMMENT ON COLUMN app.person.created_ts IS 'Record creation timestamp';
COMMENT ON COLUMN app.person.updated_ts IS 'Last update timestamp';
