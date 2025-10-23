-- =====================================================
-- SETTING BUSINESS LEVEL TABLE
-- Business hierarchy levels: Department, Division, Corporate
-- =====================================================

CREATE TABLE app.setting_datalabel_business_level (
    level_id integer PRIMARY KEY,
    name varchar(50) NOT NULL UNIQUE,
    descr text,
    sort_order integer,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now()
);

-- Index for setting business level

-- Initial data for business levels
INSERT INTO app.setting_datalabel_business_level (level_id, name, descr, sort_order) VALUES
(0, 'Department', 'Operational department within division', 1),
(1, 'Division', 'Business division within corporate', 2),
(2, 'Corporate', 'Corporate business entity', 3);

COMMENT ON TABLE app.setting_datalabel_business_level IS 'Business hierarchy levels: Department → Division → Corporate';