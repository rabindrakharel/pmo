-- =====================================================
-- REPORTS ENTITY (d_reports) - HEAD TABLE
-- Analytical and insight tables
-- =====================================================

CREATE TABLE app.d_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(100) UNIQUE NOT NULL,
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    tags jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,

    -- Report definition
    report_type varchar(50) DEFAULT 'dashboard', -- dashboard, chart, table, summary, kpi
    report_category varchar(100), -- operational, financial, performance, compliance

    -- Data source configuration
    data_source_config jsonb DEFAULT '{}'::jsonb,
    query_definition jsonb DEFAULT '{}'::jsonb,
    refresh_frequency varchar(50) DEFAULT 'daily', -- real-time, hourly, daily, weekly, monthly

    -- Visualization settings
    chart_type varchar(50), -- bar, line, pie, scatter, table, gauge
    visualization_config jsonb DEFAULT '{}'::jsonb,

    -- Access and scheduling
    is_public boolean DEFAULT false,
    auto_refresh_enabled boolean DEFAULT true,
    email_subscribers uuid[] DEFAULT '{}',

    -- Performance tracking
    last_execution_time timestamptz,
    execution_duration_ms integer,
    last_error_message text,

    -- Relationships (mapped via entity_id_map)
    primary_entity_type varchar(50), -- project, task, business, office
    primary_entity_id uuid,

    -- Temporal fields
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);

-- Indexes for reports
CREATE INDEX idx_reports_type ON app.d_reports(report_type);
CREATE INDEX idx_reports_category ON app.d_reports(report_category);
CREATE INDEX idx_reports_refresh_frequency ON app.d_reports(refresh_frequency);
CREATE INDEX idx_reports_last_execution ON app.d_reports(last_execution_time);
CREATE INDEX idx_reports_primary_entity ON app.d_reports(primary_entity_type, primary_entity_id);
CREATE INDEX idx_reports_active ON app.d_reports(active_flag);
CREATE INDEX idx_reports_slug ON app.d_reports(slug);
CREATE INDEX idx_reports_code ON app.d_reports(code);

-- Update trigger for reports
CREATE TRIGGER trg_reports_updated_ts BEFORE UPDATE ON app.d_reports
    FOR EACH ROW EXECUTE FUNCTION app.update_updated_ts();

COMMENT ON TABLE app.d_reports IS 'Report definitions with data source configuration';