-- =====================================================
-- REPORTS ENTITY (d_reports) - ANALYTICS
-- =====================================================
--
-- SEMANTICS:
-- • Report definitions for dashboards, charts, tables, KPIs
-- • Configuration objects: data sources, queries, refresh schedules, visualizations
-- • Actual data/results stored in d_report_data; this table tracks config
--
-- OPERATIONS:
-- • CREATE: POST /api/v1/reports, INSERT with auto_refresh_enabled=true, schedules execution
-- • UPDATE: PUT /api/v1/reports/{id}, same ID, version++, invalidates cached results
-- • EXECUTE: POST /api/v1/reports/{id}/execute, runs query, stores in d_report_data
-- • DISABLE: Update auto_refresh_enabled=false, stops scheduled execution
-- • DELETE: active_flag=false, to_ts=now(), stops execution, preserves d_report_data
-- • LIST: Filter by category/type, RBAC enforced
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY (stable)
-- • code: varchar, report_type, report_category: varchar
-- • data_source_config, query_definition: jsonb (SQL/query configuration)
-- • visualization_config: jsonb (chart type, axes, filters)
-- • chart_type: varchar (line, bar, pie, table, kpi)
-- • refresh_frequency: varchar (hourly, daily, weekly, manual)
-- • auto_refresh_enabled: boolean
-- • last_execution_ts: timestamptz
-- • email_subscribers: text[] (notification list)
--
-- RELATIONSHIPS:
-- • Data: d_report_data (execution results)
-- • RBAC: entity_id_rbac_map
--    • Database:
--      SELECT r.* FROM d_reports r
--      WHERE r.active_flag=true
--        AND EXISTS (
--          SELECT 1 FROM entity_id_rbac_map rbac
--          WHERE rbac.empid=$user_id
--            AND rbac.entity='reports'
--            AND (rbac.entity_id=r.id::text OR rbac.entity_id='all')
--            AND 0=ANY(rbac.permission)  -- View permission
--        )
--      ORDER BY r.report_category, r.name ASC
--      LIMIT $1 OFFSET $2
--    • RBAC: User sees ONLY reports they have view access to
--    • Frontend: Renders in EntityMainPage with table view + dashboard previews
--
-- 7. GET SINGLE REPORT (WITH LATEST DATA)
--    • Endpoint: GET /api/v1/reports/{id}
--    • Database:
--      - SELECT * FROM d_reports WHERE id=$1 AND active_flag=true
--      - JOIN d_report_data to fetch latest execution results
--    • RBAC: Checks entity_id_rbac_map for view permission
--    • Frontend: Renders chart/table/dashboard with latest data; shows last_execution_ts
--
-- 8. GET REPORT EXECUTION HISTORY
--    • Endpoint: GET /api/v1/reports/{id}/history?limit=10
--    • Database:
--      SELECT rd.* FROM d_report_data rd
--      WHERE rd.report_id=$1
--      ORDER BY rd.execution_timestamp DESC
--      LIMIT $2
--    • Frontend: Shows execution timeline, duration trends, error history
--
-- 9. SUBSCRIBE TO REPORT (Email Notifications)
--    • Endpoint: POST /api/v1/reports/{id}/subscribe
--    • Body: {employee_id}
--    • Database: UPDATE SET email_subscribers=array_append(email_subscribers, $1) WHERE id=$2
--    • Business Rule: User receives email with report results after each scheduled execution
--
-- KEY SCD FIELDS:
-- • id: Stable UUID (never changes, preserves report URL and subscriptions)
-- • version: Increments on configuration updates (audit trail of query/viz changes)
-- • from_ts: Report creation timestamp (never modified)
-- • to_ts: Report deletion timestamp (NULL=active, timestamptz=deleted)
-- • active_flag: Report status (true=active, false=deleted)
-- • created_ts: Original creation time (never modified)
-- • updated_ts: Last modification time (refreshed on UPDATE)
--
-- KEY BUSINESS FIELDS:
-- • report_type: Classification ('dashboard', 'chart', 'table', 'summary', 'kpi')
-- • report_category: Business domain ('operational', 'financial', 'performance', 'compliance')
-- • data_source_config: JSONB defining data source (tables, joins, filters)
-- • query_definition: JSONB defining SQL query or aggregation logic
-- • refresh_frequency: Execution schedule ('real-time', 'hourly', 'daily', 'weekly', 'monthly')
-- • chart_type: Visualization ('bar', 'line', 'pie', 'scatter', 'table', 'gauge')
-- • visualization_config: JSONB defining chart options (colors, axes, legends)
-- • auto_refresh_enabled: Scheduler flag (true=auto-execute, false=manual only)
-- • email_subscribers: ARRAY of employee UUIDs receiving email notifications
-- • last_execution_ts, execution_duration_ms: Performance tracking
--
-- RELATIONSHIPS:
-- • email_subscribers[] → d_employee (who receives email notifications)
-- • primary_entity_type, primary_entity_id: Links report to project/task/etc via entity_id_map
-- • report_id ← d_report_data (execution results and historical data)
--
-- =====================================================

CREATE TABLE app.d_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
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
    public_flag boolean DEFAULT false,
    auto_refresh_enabled_flag boolean DEFAULT true,
    email_subscribers uuid[] DEFAULT '{}',

    -- Performance tracking
    last_execution_ts timestamptz,
    execution_duration_ms integer,
    last_error_message text,

    -- Relationships (mapped via entity_id_map)
    primary_entity_type varchar(50), -- project, task, business, office
    primary_entity_id uuid,

    -- Temporal fields
    active_flag boolean DEFAULT true,
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);



COMMENT ON TABLE app.d_reports IS 'Report definitions with data source configuration';