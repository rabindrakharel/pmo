-- =====================================================
-- ARTIFACT ENTITY (d_artifact) - HEAD TABLE
-- Document and file management with head/data pattern
-- =====================================================

CREATE TABLE app.d_artifact (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(100) UNIQUE NOT NULL,
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    tags jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,

    -- Artifact classification
    artifact_type varchar(50) DEFAULT 'document', -- document, template, image, video, etc.
    file_format varchar(20), -- pdf, docx, xlsx, png, jpg, etc.
    file_size_bytes bigint,

    -- Relationships (will be mapped via entity_id_map)
    primary_entity_type varchar(50), -- project, task, business, office
    primary_entity_id uuid,

    -- Access control
    visibility varchar(20) DEFAULT 'internal', -- public, internal, restricted, private
    security_classification varchar(20) DEFAULT 'general', -- general, confidential, restricted

    -- Version control
    parent_artifact_id uuid REFERENCES app.d_artifact(id),
    is_latest_version boolean DEFAULT true,

    -- Temporal fields
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);

-- Indexes for artifact
CREATE INDEX idx_artifact_type ON app.d_artifact(artifact_type);
CREATE INDEX idx_artifact_format ON app.d_artifact(file_format);
CREATE INDEX idx_artifact_primary_entity ON app.d_artifact(primary_entity_type, primary_entity_id);
CREATE INDEX idx_artifact_parent ON app.d_artifact(parent_artifact_id);
CREATE INDEX idx_artifact_latest ON app.d_artifact(is_latest_version);
CREATE INDEX idx_artifact_active ON app.d_artifact(active_flag);
CREATE INDEX idx_artifact_slug ON app.d_artifact(slug);
CREATE INDEX idx_artifact_code ON app.d_artifact(code);

-- Update trigger for artifact
CREATE TRIGGER trg_artifact_updated_ts BEFORE UPDATE ON app.d_artifact
    FOR EACH ROW EXECUTE FUNCTION app.update_updated_ts();

COMMENT ON TABLE app.d_artifact IS 'Document and file management with version control';