-- =====================================================
-- REPORTS ENTITY (d_reports) - ANALYTICS ENTITY
-- Report definitions with data source configuration and visualization settings
-- =====================================================
--
-- BUSINESS PURPOSE:
-- Manages report definitions for dashboards, charts, tables, summaries, and KPIs. Reports are
-- configuration objects that define data sources, queries, refresh schedules, and visualization settings.
-- Actual report data/results stored in d_report_data; this table tracks metadata and configuration.
--
-- API SEMANTICS & LIFECYCLE:
--
-- 1. CREATE REPORT
--    • Endpoint: POST /api/v1/reports
--    • Body: {name, code, report_type, report_category, data_source_config, query_definition, chart_type, refresh_frequency}
--    • Returns: {id: "new-uuid", version: 1, auto_refresh_enabled: true, ...}
--    • Database: INSERT with version=1, active_flag=true, auto_refresh_enabled=true, created_ts=now()
--    • RBAC: Requires permission 4 (create) on entity='reports', entity_id='11111111-1111-1111-1111-111111111111'
--    • Business Rule: Report scheduled for execution based on refresh_frequency
--
-- 2. UPDATE REPORT CONFIGURATION (Query Changes, Visualization Updates)
--    • Endpoint: PUT /api/v1/reports/{id}
--    • Body: {name, query_definition, visualization_config, refresh_frequency, email_subscribers}
--    • Returns: {id: "same-uuid", version: 2, updated_ts: "new-timestamp"}
--    • Database: UPDATE SET [fields], version=version+1, updated_ts=now() WHERE id=$1
--    • SCD Behavior: IN-PLACE UPDATE
--      - Same ID (preserves report URL and entity relationships)
--      - version increments (audit trail of configuration changes)
--      - updated_ts refreshed
--      - Query changes trigger re-execution on next refresh cycle
--    • RBAC: Requires permission 1 (edit) on entity='reports', entity_id={id} OR '11111111-1111-1111-1111-111111111111'
--    • Business Rule: Configuration updates invalidate cached results; next execution uses new config
--
-- 3. EXECUTE REPORT (Manual Refresh)
--    • Endpoint: POST /api/v1/reports/{id}/execute
--    • Database:
--      - Runs query_definition against data_source_config
--      - Stores results in d_report_data
--      - UPDATE SET last_execution_ts=now(), execution_duration_ms=$1 WHERE id=$2
--    • RBAC: Requires permission 0 (view) on entity='reports', entity_id={id}
--    • Business Rule: Manual execution bypasses refresh_frequency schedule
--
-- 4. DISABLE/ENABLE AUTO-REFRESH
--    • Endpoint: PUT /api/v1/reports/{id}
--    • Body: {auto_refresh_enabled: false}
--    • Database: UPDATE SET auto_refresh_enabled=$1, updated_ts=now() WHERE id=$2
--    • Business Rule: Disables scheduled execution; manual execution still available
--
-- 5. SOFT DELETE REPORT
--    • Endpoint: DELETE /api/v1/reports/{id}
--    • Database: UPDATE SET active_flag=false, to_ts=now(), auto_refresh_enabled=false WHERE id=$1
--    • RBAC: Requires permission 3 (delete)
--    • Business Rule: Stops scheduled execution; preserves report data in d_report_data
--
-- 6. LIST REPORTS (Filtered by Category, Type)
--    • Endpoint: GET /api/v1/reports?report_category=operational&limit=50
--    • Database:
--      SELECT r.* FROM d_reports r
--      WHERE r.active_flag=true
--        AND EXISTS (
--          SELECT 1 FROM entity_rbac rbac
--          WHERE rbac.person_entity_name='employee' AND rbac.person_entity_id=$user_id
--            AND rbac.entity='reports'
--            AND (rbac.entity_id=r.id::text OR rbac.entity_id='11111111-1111-1111-1111-111111111111')
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
--    • RBAC: Checks entity_rbac for view permission
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
-- • email_subscribers[] → app.employee (who receives email notifications)
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