-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- d_person - Base Entity for All People
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- PURPOSE:
-- Base entity that merges common fields across all person types (employee, customer, vendor, supplier).
-- Eliminates duplication and provides unified person management.
--
-- DESIGN:
-- • Common Fields: name, email, phone, address shared across all person types
-- • Multi-Role Support: person_types[] array allows one person to have multiple roles
-- • Specialized Entities: d_employee, d_cust extend with role-specific fields
-- • Standard Entity: Follows d_ prefix with code, name, metadata pattern
--
-- RELATIONSHIPS:
-- • Parent: None (base entity)
-- • Children: d_employee.person_id, d_cust.person_id (future: d_vendor, d_supplier)
-- • RBAC: d_entity_rbac.person_id references this table
--
-- USAGE PATTERNS:
-- • CREATE: Person created first, then specialized role entity
-- • UPDATE: Common fields updated here, role-specific in specialized tables
-- • QUERY: Join with d_employee/d_cust for complete person view
-- • MULTI-ROLE: Person can be both employee and customer via person_types array
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS app.d_person (
    -- ─────────────────────────────────────────────────────────────────────────
    -- Standard Entity Fields
    -- ─────────────────────────────────────────────────────────────────────────
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(100) UNIQUE NOT NULL,

    -- ─────────────────────────────────────────────────────────────────────────
    -- Person Identification
    -- ─────────────────────────────────────────────────────────────────────────
    first_name varchar(100),
    last_name varchar(100),
    full_name varchar(255) GENERATED ALWAYS AS (
        CASE
            WHEN first_name IS NOT NULL AND last_name IS NOT NULL
            THEN first_name || ' ' || last_name
            WHEN first_name IS NOT NULL THEN first_name
            WHEN last_name IS NOT NULL THEN last_name
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
    -- Person Type Management (Multi-Role Support)
    -- ─────────────────────────────────────────────────────────────────────────
    person_types varchar[] DEFAULT '{}', -- ['employee', 'customer', 'vendor', 'supplier']

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

CREATE INDEX idx_person_code ON app.d_person(code);
CREATE INDEX idx_person_email ON app.d_person(email) WHERE email IS NOT NULL;
CREATE INDEX idx_person_full_name ON app.d_person(full_name) WHERE full_name IS NOT NULL;
CREATE INDEX idx_person_types ON app.d_person USING GIN(person_types);
CREATE INDEX idx_person_active ON app.d_person(active_flag) WHERE active_flag = true;
CREATE INDEX idx_person_postal_code ON app.d_person(postal_code) WHERE postal_code IS NOT NULL;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Comments
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMMENT ON TABLE app.d_person IS 'Base entity for all people (employees, customers, vendors, suppliers) with common fields';
COMMENT ON COLUMN app.d_person.id IS 'Unique identifier (UUID)';
COMMENT ON COLUMN app.d_person.code IS 'Unique person code (e.g., PER-00001)';
COMMENT ON COLUMN app.d_person.first_name IS 'First name';
COMMENT ON COLUMN app.d_person.last_name IS 'Last name';
COMMENT ON COLUMN app.d_person.full_name IS 'Generated full name (first + last)';
COMMENT ON COLUMN app.d_person.email IS 'Primary email address';
COMMENT ON COLUMN app.d_person.phone IS 'Primary phone number';
COMMENT ON COLUMN app.d_person.mobile IS 'Mobile phone number';
COMMENT ON COLUMN app.d_person.addr_line1 IS 'Address line 1';
COMMENT ON COLUMN app.d_person.addr_line2 IS 'Address line 2 (unit, suite, etc.)';
COMMENT ON COLUMN app.d_person.city IS 'City';
COMMENT ON COLUMN app.d_person.province IS 'Province/State';
COMMENT ON COLUMN app.d_person.postal_code IS 'Postal code / ZIP code';
COMMENT ON COLUMN app.d_person.country IS 'Country (default: Canada)';
COMMENT ON COLUMN app.d_person.person_types IS 'Array of person types/roles (employee, customer, vendor, supplier) for multi-role support';
COMMENT ON COLUMN app.d_person.metadata IS 'Additional flexible attributes';
COMMENT ON COLUMN app.d_person.active_flag IS 'Soft delete flag (true = active)';
COMMENT ON COLUMN app.d_person.from_ts IS 'Valid from timestamp';
COMMENT ON COLUMN app.d_person.to_ts IS 'Valid to timestamp (NULL = current)';
COMMENT ON COLUMN app.d_person.created_ts IS 'Record creation timestamp';
COMMENT ON COLUMN app.d_person.updated_ts IS 'Last update timestamp';
