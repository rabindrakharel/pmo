-- =====================================================
-- OFFICE ENTITY (d_office) - PHYSICAL LOCATIONS
-- =====================================================
--
-- SEMANTICS:
-- Physical office locations (address-level) where employees work and operations are conducted.
-- These are actual brick-and-mortar locations with full address information.
--
-- **HIERARCHY CONCEPT**:
-- • d_office: Physical office locations (address-level entities)
-- • d_office_hierarchy: Organizational hierarchy (Corporate → Region → District → Office)
-- • Relationship: d_office links to d_office_hierarchy via d_entity_instance_link
-- • Example: "London Service Office" (d_office) links to "Southwestern Ontario District" (d_office_hierarchy)
--
-- OPERATIONS:
-- • CREATE: POST /api/v1/office, INSERT with version=1, active_flag=true
-- • UPDATE: PUT /api/v1/office/{id}, same ID, version++, in-place
-- • DELETE: active_flag=false, to_ts=now() (preserves employees/businesses)
-- • LIST: GET /api/v1/office, filters by province/city, RBAC enforced
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • Parent: d_office_hierarchy (via d_entity_instance_link)
-- • Children: employee, business, equipment
-- • RBAC: d_entity_rbac
--
-- =====================================================

CREATE TABLE app.d_office (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    active_flag boolean DEFAULT true,

    -- Address fields (ALL offices have full addresses)
    address_line1 varchar(200) NOT NULL,
    address_line2 varchar(200),
    city varchar(100) NOT NULL,
    province varchar(100) NOT NULL,
    postal_code varchar(20) NOT NULL,
    country varchar(100) DEFAULT 'Canada',

    -- Contact information
    phone varchar(50),
    email varchar(200),

    -- Operational details
    office_type text, -- Service Center, Warehouse, Administrative, Headquarters, Sales Office, etc.
    capacity_employees integer, -- Employee capacity
    square_footage integer, -- Office square footage

    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);

COMMENT ON TABLE app.d_office IS 'Physical office locations (address-level) with full address information';

-- =====================================================
-- OFFICE HIERARCHY (d_office_hierarchy) - ORGANIZATIONAL STRUCTURE
-- 4-level hierarchy: Corporate → Region → District → Office
-- =====================================================
--
-- SEMANTICS:
-- Office hierarchy provides a 4-level organizational structure for office management.
-- This hierarchy is separate from physical offices (d_office) and linked via d_entity_instance_link.
--
-- HIERARCHY LEVELS:
-- • Corporate: Top-level corporate entity (e.g., "Corporate Headquarters")
-- • Region: Regional coordination level (e.g., "Ontario Region")
-- • District: District management level (e.g., "Southwestern Ontario District")
-- • Office: Office level node (e.g., "London Service Offices Group")
--
-- DATABASE BEHAVIOR:
-- • CREATE: INSERT with parent_id pointing to parent hierarchy node
-- • HIERARCHY: Self-referential parent_id for tree structure
-- • TRAVERSE: Recursive CTE on parent_id for full hierarchy path
--
-- RELATIONSHIPS:
-- • Self: parent_id → d_office_hierarchy.id
-- • Children: d_office (via d_entity_instance_link)
--
-- =====================================================

CREATE TABLE app.d_office_hierarchy (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    active_flag boolean DEFAULT true,

    -- Hierarchy fields
    parent_id uuid, -- Self-referential for hierarchy (NULL for Corporate level)
    dl__office_hierarchy_level text NOT NULL, -- References app.setting_datalabel (datalabel_name='dl__office_hierarchy_level')

    -- Organizational fields
    manager_employee_id uuid, -- Manager of this hierarchy node
    budget_allocated_amt decimal(15,2), -- Budget allocated to this node

    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);

COMMENT ON TABLE app.d_office_hierarchy IS 'Office organizational hierarchy: Corporate → Region → District → Office';

-- =====================================================
-- DATA CURATION: Office Hierarchy
-- =====================================================

-- LEVEL 1: CORPORATE (Top-level)
INSERT INTO app.d_office_hierarchy (code, name, descr, parent_id, dl__office_hierarchy_level, manager_employee_id, budget_allocated_amt) VALUES
('OFF-HIE-CORP-HQ', 'Corporate Headquarters', 'Top-level corporate entity for Huron Home Services, housing executive leadership and corporate functions', NULL, 'Corporate', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 10000000.00);

-- LEVEL 2: REGION
INSERT INTO app.d_office_hierarchy (code, name, descr, parent_id, dl__office_hierarchy_level, manager_employee_id, budget_allocated_amt)
SELECT 'OFF-HIE-ON-REG', 'Ontario Region', 'Regional coordination center for all Ontario operations, overseeing multiple districts across the province', id, 'Region', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 7000000.00
FROM app.d_office_hierarchy WHERE code = 'OFF-HIE-CORP-HQ';

INSERT INTO app.d_office_hierarchy (code, name, descr, parent_id, dl__office_hierarchy_level, manager_employee_id, budget_allocated_amt)
SELECT 'OFF-HIE-QC-REG', 'Quebec Region', 'Regional coordination center for all Quebec operations', id, 'Region', NULL, 3000000.00
FROM app.d_office_hierarchy WHERE code = 'OFF-HIE-CORP-HQ';

-- LEVEL 3: DISTRICT
INSERT INTO app.d_office_hierarchy (code, name, descr, parent_id, dl__office_hierarchy_level, manager_employee_id, budget_allocated_amt)
SELECT 'OFF-HIE-SWO-DIST', 'Southwestern Ontario District', 'District managing operations across London, Windsor, Kitchener-Waterloo, and surrounding communities', id, 'District', NULL, 3000000.00
FROM app.d_office_hierarchy WHERE code = 'OFF-HIE-ON-REG';

INSERT INTO app.d_office_hierarchy (code, name, descr, parent_id, dl__office_hierarchy_level, manager_employee_id, budget_allocated_amt)
SELECT 'OFF-HIE-GTA-DIST', 'Greater Toronto Area District', 'District managing operations across Toronto, Mississauga, Brampton, and GTA municipalities', id, 'District', NULL, 4000000.00
FROM app.d_office_hierarchy WHERE code = 'OFF-HIE-ON-REG';

-- LEVEL 4: OFFICE (Hierarchy nodes for grouping physical offices)
INSERT INTO app.d_office_hierarchy (code, name, descr, parent_id, dl__office_hierarchy_level, manager_employee_id, budget_allocated_amt)
SELECT 'OFF-HIE-LONDON-GRP', 'London Service Offices Group', 'Group node for all London-area service offices', id, 'Office', NULL, 1500000.00
FROM app.d_office_hierarchy WHERE code = 'OFF-HIE-SWO-DIST';

INSERT INTO app.d_office_hierarchy (code, name, descr, parent_id, dl__office_hierarchy_level, manager_employee_id, budget_allocated_amt)
SELECT 'OFF-HIE-KW-GRP', 'Kitchener-Waterloo Offices Group', 'Group node for Kitchener-Waterloo area offices', id, 'Office', NULL, 1000000.00
FROM app.d_office_hierarchy WHERE code = 'OFF-HIE-SWO-DIST';

-- =====================================================
-- DATA CURATION: Physical Offices
-- =====================================================

-- London Service Office (Main)
INSERT INTO app.d_office (
    code, name, descr,
    address_line1, address_line2, city, province, postal_code, country,
    phone, email, office_type, capacity_employees, square_footage
) VALUES (
    'LON-OFF-001',
    'London Service Office - Main',
    'Primary service delivery office for London metropolitan area, housing field operations, customer service, and equipment storage',
    '321 Service Street', NULL, 'London', 'Ontario', 'N6B 1M1', 'Canada',
    '519-555-1001', 'london@huronhome.ca', 'Service Center', 50, 15000
);

-- London Warehouse
INSERT INTO app.d_office (
    code, name, descr,
    address_line1, address_line2, city, province, postal_code, country,
    phone, email, office_type, capacity_employees, square_footage
) VALUES (
    'LON-OFF-002',
    'London Central Warehouse',
    'Central warehouse and distribution center for London region, inventory management and equipment staging',
    '890 Industrial Parkway', 'Unit 5', 'London', 'Ontario', 'N5V 4T1', 'Canada',
    '519-555-1002', 'londonwarehouse@huronhome.ca', 'Warehouse', 15, 25000
);

-- Kitchener Service Office
INSERT INTO app.d_office (
    code, name, descr,
    address_line1, address_line2, city, province, postal_code, country,
    phone, email, office_type, capacity_employees, square_footage
) VALUES (
    'KIT-OFF-001',
    'Kitchener Service Office',
    'Service delivery office for Kitchener-Waterloo region and surrounding communities',
    '567 Innovation Drive', 'Suite 200', 'Kitchener', 'Ontario', 'N2G 4X1', 'Canada',
    '519-555-2001', 'kitchener@huronhome.ca', 'Service Center', 35, 12000
);

-- Toronto Downtown Office
INSERT INTO app.d_office (
    code, name, descr,
    address_line1, address_line2, city, province, postal_code, country,
    phone, email, office_type, capacity_employees, square_footage
) VALUES (
    'TOR-OFF-001',
    'Toronto Downtown Office',
    'Sales and administrative office serving downtown Toronto and surrounding area',
    '123 Bay Street', '12th Floor', 'Toronto', 'Ontario', 'M5J 2R8', 'Canada',
    '416-555-3001', 'toronto@huronhome.ca', 'Sales Office', 25, 8000
);

-- Mississauga Service Center
INSERT INTO app.d_office (
    code, name, descr,
    address_line1, address_line2, city, province, postal_code, country,
    phone, email, office_type, capacity_employees, square_footage
) VALUES (
    'MIS-OFF-001',
    'Mississauga Service Center',
    'Full-service center for Mississauga and western GTA, including field operations and customer service',
    '456 Dundas Street West', NULL, 'Mississauga', 'Ontario', 'L5B 1H8', 'Canada',
    '905-555-4001', 'mississauga@huronhome.ca', 'Service Center', 40, 14000
);

-- Corporate Office (Physical location for executives)
INSERT INTO app.d_office (
    code, name, descr,
    address_line1, address_line2, city, province, postal_code, country,
    phone, email, office_type, capacity_employees, square_footage
) VALUES (
    'CORP-OFF-001',
    'Corporate Office - London',
    'Corporate headquarters physical location housing C-suite executives, finance, HR, and administrative functions',
    '123 Executive Drive', 'Penthouse Suite', 'London', 'Ontario', 'N6A 1A1', 'Canada',
    '519-555-9000', 'corporate@huronhome.ca', 'Headquarters', 30, 10000
);

COMMENT ON TABLE app.d_office IS 'Physical office locations (address-level) with full address information';
COMMENT ON TABLE app.d_office_hierarchy IS 'Office organizational hierarchy: Corporate → Region → District → Office';
