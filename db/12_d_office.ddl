-- =====================================================
-- OFFICE ENTITY (d_office) - HIERARCHICAL ENTITY
-- Physical office locations with 4-level organizational hierarchy
-- =====================================================
--
-- BUSINESS PURPOSE:
-- Manages physical office locations across a 4-level hierarchy (Office → District → Region → Corporate).
-- Offices house employees, serve as operational bases, and define geographic service areas.
-- Level 0 (Office) entries contain full address information; higher levels aggregate organizational structure.
--
-- API SEMANTICS & LIFECYCLE:
--
-- 1. CREATE OFFICE
--    • Endpoint: POST /api/v1/office
--    • Body: {name, code, slug, level_name, parent_id, address_line1, city, province, postal_code}
--    • Returns: {id: "new-uuid", version: 1, ...}
--    • Database: INSERT with version=1, active_flag=true, created_ts=now()
--    • RBAC: Requires permission 4 (create) on entity='office', entity_id='all'
--    • Business Rule: level_name must match setting_datalabel_office_level entries ("Office", "District", "Region", "Corporate")
--
-- 2. UPDATE OFFICE (Address Changes, Reassignment to Parent)
--    • Endpoint: PUT /api/v1/office/{id}
--    • Body: {name, address_line1, city, parent_id, tags}
--    • Returns: {id: "same-uuid", version: 2, updated_ts: "new-timestamp"}
--    • Database: UPDATE SET [fields], version=version+1, updated_ts=now() WHERE id=$1
--    • SCD Behavior: IN-PLACE UPDATE
--      - Same ID (preserves employee assignments and business unit relationships)
--      - version increments (audit trail)
--      - updated_ts refreshed
--      - NO archival (office can move from District A to District B)
--    • RBAC: Requires permission 1 (edit) on entity='office', entity_id={id} OR 'all'
--    • Business Rule: Changing parent_id restructures hierarchy
--
-- 3. SOFT DELETE OFFICE
--    • Endpoint: DELETE /api/v1/office/{id}
--    • Database: UPDATE SET active_flag=false, to_ts=now() WHERE id=$1
--    • RBAC: Requires permission 3 (delete)
--    • Business Rule: Hides from lists; preserves employee assignments and business units
--
-- 4. LIST OFFICES (Hierarchical or Flat)
--    • Endpoint: GET /api/v1/office?level_name=Office&province=Ontario&limit=50
--    • Database:
--      SELECT o.* FROM d_office o
--      WHERE o.active_flag=true
--        AND EXISTS (
--          SELECT 1 FROM entity_id_rbac_map rbac
--          WHERE rbac.empid=$user_id
--            AND rbac.entity='office'
--            AND (rbac.entity_id=o.id::text OR rbac.entity_id='all')
--            AND 0=ANY(rbac.permission)  -- View permission
--        )
--      ORDER BY o.level_name DESC, o.name ASC
--      LIMIT $1 OFFSET $2
--    • RBAC: User sees ONLY offices they have view access to
--    • Frontend: Renders in EntityMainPage with table view (tree structure optional)
--
-- 5. GET SINGLE OFFICE
--    • Endpoint: GET /api/v1/office/{id}
--    • Database: SELECT * FROM d_office WHERE id=$1 AND active_flag=true
--    • RBAC: Checks entity_id_rbac_map for view permission
--    • Frontend: EntityDetailPage renders fields + tabs for child offices/businesses
--
-- 6. GET OFFICE HIERARCHY (Recursive Tree)
--    • Endpoint: GET /api/v1/office/{id}/hierarchy
--    • Database: Recursive CTE traversing parent_id relationships
--      WITH RECURSIVE office_tree AS (
--        SELECT id, name, parent_id, level_name, 1 AS depth
--        FROM d_office WHERE id=$1
--        UNION ALL
--        SELECT o.id, o.name, o.parent_id, o.level_name, ot.depth+1
--        FROM d_office o
--        INNER JOIN office_tree ot ON o.parent_id = ot.id
--      )
--      SELECT * FROM office_tree ORDER BY depth, name
--    • Frontend: TreeView component or nested list
--
-- 7. GET OFFICE CHILDREN (Immediate Subordinates)
--    • Endpoint: GET /api/v1/office/{id}/children
--    • Database: SELECT * FROM d_office WHERE parent_id=$1 AND active_flag=true
--    • Business Rule: Returns only direct reports (District's Offices, Region's Districts, etc.)
--
-- KEY SCD FIELDS:
-- • id: Stable UUID (never changes, preserves employee and business unit assignments)
-- • version: Increments on updates (audit trail of address changes, hierarchy moves)
-- • from_ts: Office establishment date (never modified)
-- • to_ts: Office closure timestamp (NULL=active, timestamptz=closed)
-- • active_flag: Operational status (true=active, false=closed/archived)
-- • created_ts: Original creation time (never modified)
-- • updated_ts: Last modification time (refreshed on UPDATE)
--
-- KEY BUSINESS FIELDS:
-- • level_name: Hierarchy level ("Office", "District", "Region", "Corporate")
--   - Loaded from setting_datalabel_office_level via /api/v1/setting?category=office_level
--   - Determines position in organizational tree
--   - Only level 0 (Office) has full address details
-- • parent_id: Hierarchical relationship (NULL for Corporate, UUID for all others)
--   - Points to immediate parent office in tree
--   - Self-referencing foreign key pattern
-- • address_line1, city, province, postal_code: Physical location (level 0 only)
--   - Higher levels inherit geographic coverage from children
-- • tags: JSONB array for filtering (["service_office", "london", "field_operations"])
--
-- RELATIONSHIPS:
-- • parent_id → d_office (self-reference for 4-level hierarchy)
-- • office_id ← d_business (business units are assigned to offices)
-- • office_id ← d_employee (employees work at offices)
-- • office_id ← entity_id_map (child entities linked via mapping table)
--
-- =====================================================


CREATE TABLE app.d_office (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(100) UNIQUE NOT NULL,
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    tags jsonb DEFAULT '[]'::jsonb,

    -- Hierarchy fields
    parent_id uuid ,
    level_name text NOT NULL, -- Office, District, Region, Corporate

    -- Address fields (for level 0 - Office)
    address_line1 varchar(200),
    address_line2 varchar(200),
    city varchar(100),
    province varchar(100),
    postal_code varchar(20),
    country varchar(100) DEFAULT 'Canada',

    -- Temporal fields
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);



-- Sample office hierarchy data for Canadian PMO company
-- Level 3: Corporate Headquarters
INSERT INTO app.d_office (
    id, slug, code, name, descr, tags,
    parent_id, level_name,
    address_line1, city, province, postal_code, country
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    'corporate-hq-london',
    'CORP-HQ-001',
    'Corporate Headquarters',
    'Primary corporate headquarters facility for Huron Home Services, housing executive leadership and corporate functions',
    '["corporate", "headquarters", "executive", "admin"]'::jsonb,
    NULL, 'Corporate',
    '123 Executive Drive',
    'London',
    'Ontario',
    'N6A 1A1',
    'Canada'
);

-- Level 2: Ontario Region
INSERT INTO app.d_office (
    id, slug, code, name, descr, tags,
    parent_id, level_name,
    address_line1, city, province, postal_code, country
) VALUES (
    '22222222-2222-2222-2222-222222222222',
    'ontario-region',
    'ON-REG-001',
    'Ontario Regional Office',
    'Regional coordination center for all Ontario operations, overseeing multiple districts across the province',
    '["regional", "ontario", "coordination", "operations"]'::jsonb,
    '11111111-1111-1111-1111-111111111111', 'Region',
    '456 Regional Blvd',
    'Toronto',
    'Ontario',
    'M5V 3A1',
    'Canada'
);

-- Level 1: Southwestern Ontario District
INSERT INTO app.d_office (
    id, slug, code, name, descr, tags,
    parent_id, level_name,
    address_line1, city, province, postal_code, country
) VALUES (
    '33333333-3333-3333-3333-333333333333',
    'sw-ontario-district',
    'SWO-DIST-001',
    'Southwestern Ontario District',
    'District office managing operations across London, Windsor, Kitchener-Waterloo, and surrounding communities',
    '["district", "southwestern_ontario", "field_ops", "service_delivery"]'::jsonb,
    '22222222-2222-2222-2222-222222222222', 'District',
    '789 District Avenue',
    'London',
    'Ontario',
    'N6C 2V1',
    'Canada'
);

-- Level 0: London Service Office
INSERT INTO app.d_office (
    id, slug, code, name, descr, tags,
    parent_id, level_name,
    address_line1, city, province, postal_code, country
) VALUES (
    '44444444-4444-4444-4444-444444444444',
    'london-service-office',
    'LON-OFF-001',
    'London Service Office',
    'Primary service delivery office for London metropolitan area, housing field operations, customer service, and equipment storage',
    '["service_office", "london", "field_operations", "customer_service", "equipment"]'::jsonb,
    '33333333-3333-3333-3333-333333333333', 'Office',
    '321 Service Street',
    'London',
    'Ontario',
    'N6B 1M1',
    'Canada'
);

-- Additional offices for broader coverage
INSERT INTO app.d_office (
    id, slug, code, name, descr, tags,
    parent_id, level_name,
    address_line1, city, province, postal_code, country
) VALUES (
    '55555555-5555-5555-5555-555555555555',
    'kitchener-service-office',
    'KIT-OFF-001',
    'Kitchener Service Office',
    'Service delivery office for Kitchener-Waterloo region and surrounding communities',
    '["service_office", "kitchener", "waterloo", "tech_corridor"]'::jsonb,
    '33333333-3333-3333-3333-333333333333', 'Office',
    '567 Innovation Drive',
    'Kitchener',
    'Ontario',
    'N2G 4X1',
    'Canada'
);

COMMENT ON TABLE app.d_office IS 'Physical offices with 4-level hierarchy: Office → District → Region → Corporate';