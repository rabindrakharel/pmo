-- =====================================================
-- SETTING OFFICE LEVEL TABLE
-- Office hierarchy levels: Office, District, Region, Corporate
-- =====================================================

CREATE TABLE app.setting_datalabel_office_level (
    level_id integer PRIMARY KEY,
    name varchar(50) NOT NULL UNIQUE,
    descr text,
    sort_order integer,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now()
);

-- Index for setting office level

-- Initial data for office levels
INSERT INTO app.setting_datalabel_office_level (level_id, name, descr, sort_order) VALUES
(0, 'Office', 'Physical office location with address', 1),
(1, 'District', 'District-level grouping of offices', 2),
(2, 'Region', 'Regional grouping of districts', 3),
(3, 'Corporate', 'Corporate headquarters level', 4);

COMMENT ON TABLE app.setting_datalabel_office_level IS 'Office hierarchy levels: Office → District → Region → Corporate';