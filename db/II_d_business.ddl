-- =====================================================
-- BUSINESS ENTITY (d_business, alias biz)
-- Represents departments and business units with 3-level hierarchy
-- level[0] → Department, level[1] → Division, level[2] → Corporate
-- =====================================================

CREATE TABLE app.d_business (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(100) UNIQUE NOT NULL,
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    tags jsonb DEFAULT '[]'::jsonb,

    -- Hierarchy fields
    parent_id uuid REFERENCES app.d_business(id),
    level_id integer NOT NULL CHECK (level_id >= 0 AND level_id <= 2),
    level_name varchar(50) NOT NULL, -- Department, Division, Corporate

    -- Office relationship
    office_id uuid REFERENCES app.d_office(id),

    -- Business fields
    budget_allocated decimal(15,2),
    manager_employee_id uuid, -- Will be added later when employee system is defined

    -- Temporal fields
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);

-- Indexes for business
CREATE INDEX idx_business_parent_id ON app.d_business(parent_id);
CREATE INDEX idx_business_level ON app.d_business(level_id, level_name);
CREATE INDEX idx_business_office_id ON app.d_business(office_id);
CREATE INDEX idx_business_active ON app.d_business(active_flag);
CREATE INDEX idx_business_slug ON app.d_business(slug);
CREATE INDEX idx_business_code ON app.d_business(code);

-- Update trigger for business
CREATE TRIGGER trg_business_updated_ts BEFORE UPDATE ON app.d_business
    FOR EACH ROW EXECUTE FUNCTION app.update_updated_ts();

COMMENT ON TABLE app.d_business IS 'Business units with 3-level hierarchy: Department → Division → Corporate';