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
    parent_artifact_id uuid ,
    is_latest_version boolean DEFAULT true,

    -- Temporal fields
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);



COMMENT ON TABLE app.d_artifact IS 'Document and file management with version control';