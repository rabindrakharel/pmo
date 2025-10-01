-- =====================================================
-- OFFICE ENTITY (d_office)
-- Represents physical offices with 4-level hierarchy
-- level[0] → Office, level[1] → District, level[2] → Region, level[3] → Corporate
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create app schema if not exists
DROP SCHEMA app;
CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE app.d_office (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(100) UNIQUE NOT NULL,
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    tags jsonb DEFAULT '[]'::jsonb,

    -- Hierarchy fields
    parent_id uuid ,
    level_id integer NOT NULL ,
    level_name varchar(50) NOT NULL, -- Office, District, Region, Corporate

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
    parent_id, level_id, level_name,
    address_line1, city, province, postal_code, country
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    'corporate-hq-london',
    'CORP-HQ-001',
    'Corporate Headquarters',
    'Primary corporate headquarters facility for Huron Home Services, housing executive leadership and corporate functions',
    '["corporate", "headquarters", "executive", "admin"]'::jsonb,
    NULL, 3, 'Corporate',
    '123 Executive Drive',
    'London',
    'Ontario',
    'N6A 1A1',
    'Canada'
);

-- Level 2: Ontario Region
INSERT INTO app.d_office (
    id, slug, code, name, descr, tags,
    parent_id, level_id, level_name,
    address_line1, city, province, postal_code, country
) VALUES (
    '22222222-2222-2222-2222-222222222222',
    'ontario-region',
    'ON-REG-001',
    'Ontario Regional Office',
    'Regional coordination center for all Ontario operations, overseeing multiple districts across the province',
    '["regional", "ontario", "coordination", "operations"]'::jsonb,
    '11111111-1111-1111-1111-111111111111', 2, 'Region',
    '456 Regional Blvd',
    'Toronto',
    'Ontario',
    'M5V 3A1',
    'Canada'
);

-- Level 1: Southwestern Ontario District
INSERT INTO app.d_office (
    id, slug, code, name, descr, tags,
    parent_id, level_id, level_name,
    address_line1, city, province, postal_code, country
) VALUES (
    '33333333-3333-3333-3333-333333333333',
    'sw-ontario-district',
    'SWO-DIST-001',
    'Southwestern Ontario District',
    'District office managing operations across London, Windsor, Kitchener-Waterloo, and surrounding communities',
    '["district", "southwestern_ontario", "field_ops", "service_delivery"]'::jsonb,
    '22222222-2222-2222-2222-222222222222', 1, 'District',
    '789 District Avenue',
    'London',
    'Ontario',
    'N6C 2V1',
    'Canada'
);

-- Level 0: London Service Office
INSERT INTO app.d_office (
    id, slug, code, name, descr, tags,
    parent_id, level_id, level_name,
    address_line1, city, province, postal_code, country
) VALUES (
    '44444444-4444-4444-4444-444444444444',
    'london-service-office',
    'LON-OFF-001',
    'London Service Office',
    'Primary service delivery office for London metropolitan area, housing field operations, customer service, and equipment storage',
    '["service_office", "london", "field_operations", "customer_service", "equipment"]'::jsonb,
    '33333333-3333-3333-3333-333333333333', 0, 'Office',
    '321 Service Street',
    'London',
    'Ontario',
    'N6B 1M1',
    'Canada'
);

-- Additional offices for broader coverage
INSERT INTO app.d_office (
    id, slug, code, name, descr, tags,
    parent_id, level_id, level_name,
    address_line1, city, province, postal_code, country
) VALUES (
    '55555555-5555-5555-5555-555555555555',
    'kitchener-service-office',
    'KIT-OFF-001',
    'Kitchener Service Office',
    'Service delivery office for Kitchener-Waterloo region and surrounding communities',
    '["service_office", "kitchener", "waterloo", "tech_corridor"]'::jsonb,
    '33333333-3333-3333-3333-333333333333', 0, 'Office',
    '567 Innovation Drive',
    'Kitchener',
    'Ontario',
    'N2G 4X1',
    'Canada'
);

COMMENT ON TABLE app.d_office IS 'Physical offices with 4-level hierarchy: Office → District → Region → Corporate';