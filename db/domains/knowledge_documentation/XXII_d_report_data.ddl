-- =====================================================
-- REPORT DATA (d_report_data) - DATA TABLE
-- Report execution data with performance metrics
-- =====================================================

CREATE TABLE app.d_report_data (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id uuid NOT NULL  ON DELETE CASCADE,

    -- Report execution data
    execution_timestamp timestamptz NOT NULL DEFAULT now(),
    report_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    data_snapshot_size integer,

    -- Data stage
    stage varchar(20) NOT NULL DEFAULT 'saved', -- draft, saved

    -- Execution metadata
    executed_by_empid uuid,
    execution_trigger varchar(50) DEFAULT 'manual', -- manual, scheduled, api, event

    -- Data quality metrics
    data_freshness_hours decimal(8,2),
    data_completeness_percent decimal(5,2),
    data_accuracy_score decimal(5,2),

    -- Performance metrics
    query_execution_time_ms integer,
    data_processing_time_ms integer,

    -- Temporal fields
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);



COMMENT ON TABLE app.d_report_data IS 'Report execution data with performance metrics';