-- =====================================================
-- OFFICE ENTITY (d_office)
-- Represents physical offices with 4-level hierarchy
-- level[0] → Office, level[1] → District, level[2] → Region, level[3] → Corporate
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create app schema if not exists
CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE app.d_office (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(100) UNIQUE NOT NULL,
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    tags jsonb DEFAULT '[]'::jsonb,

    -- Hierarchy fields
    parent_id uuid REFERENCES app.d_office(id),
    level_id integer NOT NULL CHECK (level_id >= 0 AND level_id <= 3),
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

-- Indexes for office
CREATE INDEX idx_office_parent_id ON app.d_office(parent_id);
CREATE INDEX idx_office_level ON app.d_office(level_id, level_name);
CREATE INDEX idx_office_active ON app.d_office(active_flag);
CREATE INDEX idx_office_slug ON app.d_office(slug);
CREATE INDEX idx_office_code ON app.d_office(code);

-- Update trigger function
CREATE OR REPLACE FUNCTION app.update_updated_ts()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_ts = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update trigger for office
CREATE TRIGGER trg_office_updated_ts BEFORE UPDATE ON app.d_office
    FOR EACH ROW EXECUTE FUNCTION app.update_updated_ts();

COMMENT ON TABLE app.d_office IS 'Physical offices with 4-level hierarchy: Office → District → Region → Corporate';