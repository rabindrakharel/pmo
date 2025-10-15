-- =====================================================
-- SETTING: CLIENT STATUS
-- Defines available client status values
-- =====================================================

CREATE TABLE IF NOT EXISTS app.setting_datalabel_client_status (
    level_id integer PRIMARY KEY,
    level_name varchar(50) NOT NULL UNIQUE,
    level_descr text,
    is_active boolean DEFAULT true,
    sort_order integer,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

-- Client status values
INSERT INTO app.setting_datalabel_client_status (level_id, level_name, level_descr, sort_order) VALUES
(0, 'active', 'Active client with ongoing business', 0),
(1, 'inactive', 'Inactive client - no current engagement', 1),
(2, 'prospect', 'Prospective client - not yet converted', 2),
(3, 'archived', 'Archived client - historical record only', 3),
(4, 'suspended', 'Suspended - temporary hold on services', 4),
(5, 'churned', 'Churned - client lost to competition', 5);

COMMENT ON TABLE app.setting_datalabel_client_status IS 'Client status setting values for d_client.client_status';
