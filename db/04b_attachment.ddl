-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- app.attachment - File Attachments Entity
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- PURPOSE:
-- Manages file attachments that can be linked to any entity (invoices, artifacts, interactions, etc.)
-- Provides centralized file metadata storage with S3 integration.
--
-- DESIGN:
-- • File Storage: S3 bucket/key for actual file storage
-- • Metadata: file_name, file_size, mime_type, file_hash for integrity
-- • Universal Linking: Via entity_instance_link (NO foreign keys for loose coupling)
-- • Versioning: Supports version tracking via metadata
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • Parent: None (independent entity)
-- • Linkage: ALL attachment relationships managed via entity_instance_link
-- • Optional tracking: attached_to_entity_code/attached_to_entity_id (no FK, just metadata)
-- • Uploaded by: uploaded_by_employee_id (no FK, just reference)
--
-- USAGE PATTERNS:
-- • UPLOAD: Create attachment record with S3 presigned URL
-- • ATTACH: Reference attachment_id in parent entity
-- • DELETE: Soft delete (mark inactive), S3 cleanup via lifecycle policy
-- • QUERY: Join with parent entities to get file metadata
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS app.attachment (
    -- ─────────────────────────────────────────────────────────────────────────
    -- Standard Entity Fields
    -- ─────────────────────────────────────────────────────────────────────────
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(100) UNIQUE NOT NULL,

    -- ─────────────────────────────────────────────────────────────────────────
    -- File Metadata
    -- ─────────────────────────────────────────────────────────────────────────
    file_name varchar(500) NOT NULL,
    file_size_bytes bigint,
    mime_type varchar(255),
    file_extension varchar(50),
    file_hash varchar(128), -- SHA256 hash for integrity verification

    -- ─────────────────────────────────────────────────────────────────────────
    -- S3 Storage Information
    -- ─────────────────────────────────────────────────────────────────────────
    s3_bucket varchar(255),
    s3_key varchar(1000),
    s3_region varchar(50) DEFAULT 'us-east-1',
    s3_url text, -- Full S3 URL or CloudFront URL

    -- ─────────────────────────────────────────────────────────────────────────
    -- Attachment Classification
    -- ─────────────────────────────────────────────────────────────────────────
    dl__attachment_type varchar(50), -- document, image, video, pdf, spreadsheet, etc.
    category varchar(100), -- invoice, contract, photo, report, etc.
    descr text,

    -- ─────────────────────────────────────────────────────────────────────────
    -- Attachment Context (Optional - for tracking what it's attached to)
    -- ─────────────────────────────────────────────────────────────────────────
    attached_to_entity_code varchar(100), -- Entity type (project, invoice, etc.)
    attached_to_entity_id uuid, -- Specific entity instance ID

    -- ─────────────────────────────────────────────────────────────────────────
    -- Versioning & Ownership
    -- ─────────────────────────────────────────────────────────────────────────
    version integer DEFAULT 1,
    uploaded_by_employee_id uuid,
    uploaded_ts timestamptz DEFAULT now(),

    -- ─────────────────────────────────────────────────────────────────────────
    -- Standard Metadata & Temporal Fields
    -- ─────────────────────────────────────────────────────────────────────────
    metadata jsonb DEFAULT '{}',
    active_flag boolean DEFAULT true,
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Indexes
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE INDEX idx_attachment_code ON app.attachment(code);
CREATE INDEX idx_attachment_s3_key ON app.attachment(s3_key) WHERE s3_key IS NOT NULL;
CREATE INDEX idx_attachment_file_hash ON app.attachment(file_hash) WHERE file_hash IS NOT NULL;
CREATE INDEX idx_attachment_type ON app.attachment(dl__attachment_type) WHERE dl__attachment_type IS NOT NULL;
CREATE INDEX idx_attachment_category ON app.attachment(category) WHERE category IS NOT NULL;
CREATE INDEX idx_attachment_active ON app.attachment(active_flag) WHERE active_flag = true;
CREATE INDEX idx_attachment_uploaded_by ON app.attachment(uploaded_by_employee_id) WHERE uploaded_by_employee_id IS NOT NULL;
CREATE INDEX idx_attachment_attached_to ON app.attachment(attached_to_entity_code, attached_to_entity_id)
    WHERE attached_to_entity_code IS NOT NULL AND attached_to_entity_id IS NOT NULL;
CREATE INDEX idx_attachment_uploaded_ts ON app.attachment(uploaded_ts);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Comments
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMMENT ON TABLE app.attachment IS 'File attachments entity for universal file management across all entities';
COMMENT ON COLUMN app.attachment.id IS 'Unique identifier (UUID)';
COMMENT ON COLUMN app.attachment.code IS 'Unique attachment code (e.g., ATT-00001)';
COMMENT ON COLUMN app.attachment.file_name IS 'Original file name';
COMMENT ON COLUMN app.attachment.file_size_bytes IS 'File size in bytes';
COMMENT ON COLUMN app.attachment.mime_type IS 'MIME type (e.g., application/pdf, image/jpeg)';
COMMENT ON COLUMN app.attachment.file_extension IS 'File extension (pdf, jpg, docx, etc.)';
COMMENT ON COLUMN app.attachment.file_hash IS 'SHA256 hash for integrity verification';
COMMENT ON COLUMN app.attachment.s3_bucket IS 'S3 bucket name';
COMMENT ON COLUMN app.attachment.s3_key IS 'S3 object key/path';
COMMENT ON COLUMN app.attachment.s3_region IS 'S3 region (default: us-east-1)';
COMMENT ON COLUMN app.attachment.s3_url IS 'Full S3 URL or CloudFront URL for access';
COMMENT ON COLUMN app.attachment.dl__attachment_type IS 'Attachment type (document, image, video, pdf, spreadsheet)';
COMMENT ON COLUMN app.attachment.category IS 'Category/purpose (invoice, contract, photo, report)';
COMMENT ON COLUMN app.attachment.descr IS 'Description of attachment';
COMMENT ON COLUMN app.attachment.attached_to_entity_code IS 'Entity code this is attached to (optional tracking)';
COMMENT ON COLUMN app.attachment.attached_to_entity_id IS 'Entity instance ID this is attached to (optional tracking)';
COMMENT ON COLUMN app.attachment.version IS 'Version number for file versioning';
COMMENT ON COLUMN app.attachment.uploaded_by_employee_id IS 'Employee who uploaded this attachment';
COMMENT ON COLUMN app.attachment.uploaded_ts IS 'Upload timestamp';
COMMENT ON COLUMN app.attachment.metadata IS 'Additional flexible attributes';
COMMENT ON COLUMN app.attachment.active_flag IS 'Soft delete flag (true = active)';
COMMENT ON COLUMN app.attachment.from_ts IS 'Valid from timestamp';
COMMENT ON COLUMN app.attachment.to_ts IS 'Valid to timestamp (NULL = current)';
COMMENT ON COLUMN app.attachment.created_ts IS 'Record creation timestamp';
COMMENT ON COLUMN app.attachment.updated_ts IS 'Last update timestamp';
