-- =====================================================
-- OFFICE ENTITY (d_office) - LOCATION HIERARCHY
-- =====================================================
--
-- SEMANTICS:
-- • Physical office locations with 4-level hierarchy (Office→District→Region→Corporate)
-- • Houses employees, defines service areas, operational coordination
-- • Level 0 offices have full addresses; higher levels for org structure
--
-- OPERATIONS:
-- • CREATE: POST /api/v1/office, INSERT with version=1, active_flag=true
-- • UPDATE: PUT /api/v1/office/{id}, same ID, version++, in-place
-- • DELETE: active_flag=false, to_ts=now() (preserves employees/businesses)
-- • LIST: GET /api/v1/office, filters by level/province, RBAC enforced
-- • HIERARCHY: Recursive CTE on parent_id for tree traversal
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY (stable)
-- • code: varchar(50) UNIQUE ('CORP-HQ-001')
-- • dl__office_level: text (Office, District, Region, Corporate)
-- • parent_id: uuid (self-ref for hierarchy, NULL for Corporate)
-- • address_line1, city, province, postal_code: varchar (level 0 only)
-- • version: integer (audit trail)
--
-- RELATIONSHIPS:
-- • Self: parent_id → d_office.id (4-level hierarchy)
-- • Children: business, employee, task, artifact, wiki, form, cost, revenue
-- • RBAC: entity_id_rbac_map
--
-- =====================================================


CREATE TABLE app.d_office (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    active_flag boolean DEFAULT true,

    -- Hierarchy fields
    parent_id uuid ,
    dl__office_level text NOT NULL, -- References app.setting_datalabel (datalabel_name='office__level')

    -- Address fields (for level 0 - Office)
    address_line1 varchar(200),
    address_line2 varchar(200),
    city varchar(100),
    province varchar(100),
    postal_code varchar(20),
    country varchar(100) DEFAULT 'Canada',

    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);



-- Sample office hierarchy data for Canadian PMO company
-- Level 3: Corporate Headquarters
INSERT INTO app.d_office (
    code, name, descr,
    parent_id, dl__office_level,
    address_line1, city, province, postal_code, country
) VALUES (
    'CORP-HQ-001',
    'Corporate Headquarters',
    'Primary corporate headquarters facility for Huron Home Services, housing executive leadership and corporate functions',
    NULL, 'Corporate',
    '123 Executive Drive',
    'London',
    'Ontario',
    'N6A 1A1',
    'Canada'
);

-- Level 2: Ontario Region
INSERT INTO app.d_office (
    code, name, descr,
    parent_id, dl__office_level,
    address_line1, city, province, postal_code, country
) VALUES (
    'ON-REG-001',
    'Ontario Regional Office',
    'Regional coordination center for all Ontario operations, overseeing multiple districts across the province',
    '11111111-1111-1111-1111-111111111111', 'Region',
    '456 Regional Blvd',
    'Toronto',
    'Ontario',
    'M5V 3A1',
    'Canada'
);

-- Level 1: Southwestern Ontario District
INSERT INTO app.d_office (
    code, name, descr,
    parent_id, dl__office_level,
    address_line1, city, province, postal_code, country
) VALUES (
    'SWO-DIST-001',
    'Southwestern Ontario District',
    'District office managing operations across London, Windsor, Kitchener-Waterloo, and surrounding communities',
    '22222222-2222-2222-2222-222222222222', 'District',
    '789 District Avenue',
    'London',
    'Ontario',
    'N6C 2V1',
    'Canada'
);

-- Level 0: London Service Office
INSERT INTO app.d_office (
    code, name, descr,
    parent_id, dl__office_level,
    address_line1, city, province, postal_code, country
) VALUES (
    'LON-OFF-001',
    'London Service Office',
    'Primary service delivery office for London metropolitan area, housing field operations, customer service, and equipment storage',
    '33333333-3333-3333-3333-333333333333', 'Office',
    '321 Service Street',
    'London',
    'Ontario',
    'N6B 1M1',
    'Canada'
);

-- Additional offices for broader coverage
INSERT INTO app.d_office (
    code, name, descr,
    parent_id, dl__office_level,
    address_line1, city, province, postal_code, country
) VALUES (
    'KIT-OFF-001',
    'Kitchener Service Office',
    'Service delivery office for Kitchener-Waterloo region and surrounding communities',
    '33333333-3333-3333-3333-333333333333', 'Office',
    '567 Innovation Drive',
    'Kitchener',
    'Ontario',
    'N2G 4X1',
    'Canada'
);

COMMENT ON TABLE app.d_office IS 'Physical offices with 4-level hierarchy: Office → District → Region → Corporate';