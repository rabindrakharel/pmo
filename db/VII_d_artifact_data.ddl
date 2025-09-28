-- =====================================================
-- ARTIFACT DATA (d_artifact_data) - DATA TABLE
-- Artifact content storage with binary and text support
-- =====================================================

CREATE TABLE app.d_artifact_data (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id uuid NOT NULL REFERENCES app.d_artifact(id) ON DELETE CASCADE,

    -- Content storage
    content_text text, -- For text-based artifacts
    content_binary bytea, -- For binary files
    content_url varchar(500), -- For external references
    content_metadata jsonb DEFAULT '{}'::jsonb,

    -- Data stage
    stage varchar(20) NOT NULL DEFAULT 'draft', -- draft, saved

    -- Update information
    updated_by_empid uuid NOT NULL,
    update_type varchar(50) DEFAULT 'content_update', -- content_update, metadata_update, version_update
    update_notes text,

    -- File handling
    file_hash varchar(64), -- SHA-256 hash for integrity
    compression_type varchar(20), -- gzip, none

    -- Temporal fields
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

-- Indexes for artifact data
CREATE INDEX idx_artifact_data_artifact_id ON app.d_artifact_data(artifact_id);
CREATE INDEX idx_artifact_data_updated_by ON app.d_artifact_data(updated_by_empid);
CREATE INDEX idx_artifact_data_stage ON app.d_artifact_data(stage);
CREATE INDEX idx_artifact_data_created ON app.d_artifact_data(created_ts DESC);

-- Update trigger for artifact data
CREATE TRIGGER trg_artifact_data_updated_ts BEFORE UPDATE ON app.d_artifact_data
    FOR EACH ROW EXECUTE FUNCTION app.update_updated_ts();

COMMENT ON TABLE app.d_artifact_data IS 'Artifact content storage with binary and text support';