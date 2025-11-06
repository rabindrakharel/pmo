-- =====================================================
-- ARTIFACT DATA (d_artifact_data) - CONTENT STORAGE
-- =====================================================
--
-- SEMANTICS:
-- • Artifact content: text, binary, or external URLs
-- • Supports versioning, file integrity (SHA-256), compression
--
-- KEY FIELDS:
-- • artifact_id: uuid (FK with CASCADE)
-- • content_text, content_binary, content_url: storage options
-- • file_hash: varchar(64) (SHA-256)
-- • compression_type: varchar (gzip, none)
-- • update_type: varchar (content_update, metadata_update, version_update)
--
-- =====================================================

CREATE TABLE app.d_artifact_data (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id uuid NOT NULL  ON DELETE CASCADE,

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



COMMENT ON TABLE app.d_artifact_data IS 'Artifact content storage with binary and text support';