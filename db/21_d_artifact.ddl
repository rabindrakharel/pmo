-- =====================================================
-- ARTIFACT ENTITY (d_artifact) - CONTENT ENTITY
-- Document and file management with version control and access controls
-- =====================================================
--
-- BUSINESS PURPOSE:
-- Manages documents, templates, images, videos, and other file artifacts linked to projects, tasks,
-- or standalone repositories. Supports version control, security classification, and visibility controls.
-- Actual file content stored separately (MinIO/S3); this table tracks metadata and relationships.
--
-- API SEMANTICS & LIFECYCLE:
--
-- 1. CREATE ARTIFACT (Upload Document/File)
--    • Endpoint: POST /api/v1/artifact (multipart/form-data)
--    • Body: {name, code, artifact_type, file, primary_entity_type, primary_entity_id, visibility, security_classification}
--    • Returns: {id: "new-uuid", version: 1, file_size_bytes, ...}
--    • Database: INSERT with version=1, active_flag=true, is_latest_version=true, created_ts=now()
--    • File Storage: Uploads file to MinIO/S3 bucket; stores reference in d_artifact_data
--    • RBAC: Requires permission 4 (create) on entity='artifact', entity_id='all'
--    • Business Rule: File metadata extracted (size, format); virus scanning may be applied
--
-- 2. UPDATE ARTIFACT METADATA (Rename, Recategorize, Change Visibility)
--    • Endpoint: PUT /api/v1/artifact/{id}
--    • Body: {name, descr, tags, visibility, security_classification}
--    • Returns: {id: "same-uuid", version: 2, updated_ts: "new-timestamp"}
--    • Database: UPDATE SET [fields], version=version+1, updated_ts=now() WHERE id=$1
--    • SCD Behavior: IN-PLACE UPDATE
--      - Same ID (preserves file reference and entity relationships)
--      - version increments (audit trail)
--      - updated_ts refreshed
--      - File content remains unchanged (only metadata updated)
--    • RBAC: Requires permission 1 (edit) on entity='artifact', entity_id={id} OR 'all'
--    • Business Rule: Metadata changes don't affect file content or download URL
--
-- 3. UPLOAD NEW VERSION (Replace File Content)
--    • Endpoint: POST /api/v1/artifact/{parent_id}/version (multipart/form-data)
--    • Body: {file}
--    • Returns: {id: "new-uuid", version: 1, parent_artifact_id: "parent_id", is_latest_version: true}
--    • Database:
--      - UPDATE old_artifact SET is_latest_version=false WHERE id=$parent_id
--      - INSERT new_artifact WITH parent_artifact_id=$parent_id, is_latest_version=true
--    • Business Rule: Creates NEW artifact record linking to parent; previous version remains accessible
--
-- 4. SOFT DELETE ARTIFACT
--    • Endpoint: DELETE /api/v1/artifact/{id}
--    • Database: UPDATE SET active_flag=false, to_ts=now() WHERE id=$1
--    • RBAC: Requires permission 3 (delete)
--    • Business Rule: Hides from lists; preserves file in storage for recovery/audit
--
-- 5. LIST ARTIFACTS (Filtered by Type, Entity, Security Level)
--    • Endpoint: GET /api/v1/artifact?artifact_type=document&primary_entity_id={uuid}&limit=50
--    • Database:
--      SELECT a.* FROM d_artifact a
--      WHERE a.active_flag=true
--        AND a.is_latest_version=true
--        AND EXISTS (
--          SELECT 1 FROM entity_id_rbac_map rbac
--          WHERE rbac.empid=$user_id
--            AND rbac.entity='artifact'
--            AND (rbac.entity_id=a.id::text OR rbac.entity_id='all')
--            AND 0=ANY(rbac.permission)  -- View permission
--        )
--      ORDER BY a.created_ts DESC
--      LIMIT $1 OFFSET $2
--    • RBAC: User sees ONLY artifacts they have view access to
--    • Frontend: Renders in EntityMainPage or EntityChildListPage with file icons
--
-- 6. GET SINGLE ARTIFACT (WITH DOWNLOAD URL)
--    • Endpoint: GET /api/v1/artifact/{id}
--    • Database: SELECT * FROM d_artifact WHERE id=$1 AND active_flag=true
--    • File Storage: Generates signed URL for download from MinIO/S3
--    • RBAC: Checks entity_id_rbac_map for view permission
--    • Frontend: Displays file details with download button
--
-- 7. DOWNLOAD ARTIFACT
--    • Endpoint: GET /api/v1/artifact/{id}/download
--    • File Storage: Returns file stream from MinIO/S3 via signed URL
--    • RBAC: Requires permission 0 (view) on entity='artifact', entity_id={id}
--    • Business Rule: Download tracked for audit; security_classification enforced
--
-- 8. GET ARTIFACT VERSION HISTORY
--    • Endpoint: GET /api/v1/artifact/{id}/versions
--    • Database:
--      SELECT a.* FROM d_artifact a
--      WHERE (a.id=$1 OR a.parent_artifact_id=$1)
--        AND a.active_flag=true
--      ORDER BY a.created_ts DESC
--    • Frontend: Version history list with restore option
--
-- KEY SCD FIELDS:
-- • id: Stable UUID (never changes for a version, preserves file reference)
-- • version: Increments on metadata updates (NOT file content changes)
-- • from_ts: Artifact creation timestamp (never modified)
-- • to_ts: Artifact deletion timestamp (NULL=active, timestamptz=deleted)
-- • active_flag: Artifact status (true=active, false=deleted)
-- • created_ts: Original creation time (never modified)
-- • updated_ts: Last modification time (refreshed on UPDATE)
--
-- KEY BUSINESS FIELDS:
-- • artifact_type: File classification ('document', 'template', 'image', 'video', etc.)
-- • file_format: Extension ('pdf', 'docx', 'xlsx', 'png', 'jpg', 'mp4', etc.)
-- • file_size_bytes: File size in bytes (for storage tracking and download estimates)
-- • visibility: Access level ('public', 'internal', 'restricted', 'private')
-- • security_classification: Confidentiality level ('general', 'confidential', 'restricted')
-- • parent_artifact_id: Version chain (NULL for original, UUID for versions)
-- • is_latest_version: Current version flag (only one record has true per version chain)
--
-- RELATIONSHIPS:
-- • parent_artifact_id → d_artifact (version chain for file updates)
-- • primary_entity_type, primary_entity_id: Links artifact to project/task/etc via entity_id_map
-- • artifact_id ← d_artifact_data (file content storage references)
--
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

-- =====================================================
-- DATA CURATION
-- Artifacts for Fall 2024 Landscaping Campaign
-- =====================================================

-- Artifact 1: Fall Service Package Brochure
INSERT INTO app.d_artifact (
    id,
    slug,
    code,
    name,
    descr,
    tags,
    metadata,
    artifact_type,
    file_format,
    file_size_bytes,
    primary_entity_type,
    primary_entity_id,
    visibility,
    security_classification,
    is_latest_version
) VALUES (
    '11a11111-1111-1111-1111-111111111111',
    'fall-service-package-brochure-2024',
    'ART-FLC-001',
    'Fall Service Package Brochure 2024',
    'Professional marketing brochure showcasing fall landscaping service packages including leaf cleanup, aeration, overseeding, and winterization. Designed for residential and commercial clients.',
    '["marketing", "brochure", "services", "packages", "fall_2024"]'::jsonb,
    '{"created_by": "James Miller", "design_version": "v2.1", "print_ready": true, "languages": ["en"], "page_count": 4}'::jsonb,
    'document',
    'pdf',
    2458000,
    'project',
    '84215ccb-313d-48f8-9c37-4398f28c0b1f',
    'public',
    'general',
    true
);

-- Artifact 2: Equipment Inspection Form Template
INSERT INTO app.d_artifact (
    id,
    slug,
    code,
    name,
    descr,
    tags,
    metadata,
    artifact_type,
    file_format,
    file_size_bytes,
    primary_entity_type,
    primary_entity_id,
    visibility,
    security_classification,
    is_latest_version
) VALUES (
    '22a22222-2222-2222-2222-222222222222',
    'equipment-inspection-form-template',
    'ART-FLC-002',
    'Equipment Inspection Form Template',
    'Standardized inspection form template for daily equipment checks. Covers mowers, aerators, blowers, and hand tools. Ensures WSIB compliance and equipment safety.',
    '["template", "inspection", "equipment", "safety", "compliance"]'::jsonb,
    '{"created_by": "James Miller", "form_type": "checklist", "compliance_standard": "WSIB Ontario", "fillable": true}'::jsonb,
    'template',
    'pdf',
    185000,
    'project',
    '84215ccb-313d-48f8-9c37-4398f28c0b1f',
    'internal',
    'general',
    true
);

-- Artifact 3: Client Service Agreement Template
INSERT INTO app.d_artifact (
    id,
    slug,
    code,
    name,
    descr,
    tags,
    metadata,
    artifact_type,
    file_format,
    file_size_bytes,
    primary_entity_type,
    primary_entity_id,
    visibility,
    security_classification,
    is_latest_version
) VALUES (
    '33a33333-3333-3333-3333-333333333333',
    'client-service-agreement-template',
    'ART-FLC-003',
    'Client Service Agreement Template',
    'Legal service agreement template for fall landscaping contracts. Includes terms of service, payment terms, liability clauses, and cancellation policies compliant with Ontario regulations.',
    '["template", "contract", "legal", "service_agreement", "terms"]'::jsonb,
    '{"created_by": "James Miller", "legal_review_date": "2024-07-15", "reviewed_by": "Legal Department", "jurisdiction": "Ontario", "version": "2024.1"}'::jsonb,
    'template',
    'docx',
    92000,
    'project',
    '84215ccb-313d-48f8-9c37-4398f28c0b1f',
    'internal',
    'confidential',
    true
);

-- Artifact 4: Training Video - Aeration Techniques
INSERT INTO app.d_artifact (
    id,
    slug,
    code,
    name,
    descr,
    tags,
    metadata,
    artifact_type,
    file_format,
    file_size_bytes,
    primary_entity_type,
    primary_entity_id,
    visibility,
    security_classification,
    is_latest_version
) VALUES (
    '44a44444-4444-4444-4444-444444444444',
    'training-video-aeration-techniques',
    'ART-FLC-004',
    'Training Video - Aeration Techniques',
    'Comprehensive training video demonstrating proper aeration techniques for different soil types and lawn conditions. Covers equipment setup, operation, and safety procedures.',
    '["training", "video", "aeration", "equipment", "tutorial"]'::jsonb,
    '{"created_by": "James Miller", "duration_minutes": 18, "resolution": "1080p", "language": "English", "subtitles": ["en", "fr"]}'::jsonb,
    'video',
    'mp4',
    458000000,
    'project',
    '84215ccb-313d-48f8-9c37-4398f28c0b1f',
    'internal',
    'general',
    true
);

-- Artifact 5: Before/After Photo Gallery
INSERT INTO app.d_artifact (
    id,
    slug,
    code,
    name,
    descr,
    tags,
    metadata,
    artifact_type,
    file_format,
    file_size_bytes,
    primary_entity_type,
    primary_entity_id,
    visibility,
    security_classification,
    is_latest_version
) VALUES (
    '55a55555-5555-5555-5555-555555555555',
    'before-after-photo-gallery-2024',
    'ART-FLC-005',
    'Before/After Photo Gallery 2024',
    'Marketing photo gallery showcasing transformation results from fall landscaping services. High-quality images for website, social media, and client presentations.',
    '["marketing", "photos", "gallery", "before_after", "portfolio"]'::jsonb,
    '{"created_by": "James Miller", "photo_count": 45, "total_size_mb": 125, "usage_rights": "company_owned", "locations": ["London", "Kitchener", "Guelph"]}'::jsonb,
    'image',
    'jpg',
    125000000,
    'project',
    '84215ccb-313d-48f8-9c37-4398f28c0b1f',
    'public',
    'general',
    true
);

-- Artifact 6: Pricing Calculator Spreadsheet
INSERT INTO app.d_artifact (
    id,
    slug,
    code,
    name,
    descr,
    tags,
    metadata,
    artifact_type,
    file_format,
    file_size_bytes,
    primary_entity_type,
    primary_entity_id,
    visibility,
    security_classification,
    is_latest_version
) VALUES (
    '66a66666-6666-6666-6666-666666666666',
    'pricing-calculator-spreadsheet',
    'ART-FLC-006',
    'Pricing Calculator Spreadsheet',
    'Automated pricing calculator for quoting fall landscaping services. Includes labor costs, equipment costs, materials, overhead, and profit margins. Supports package pricing and custom quotes.',
    '["pricing", "calculator", "spreadsheet", "quotes", "revenue"]'::jsonb,
    '{"created_by": "James Miller", "formula_version": "2024.2", "includes_macros": true, "update_frequency": "quarterly", "currency": "CAD"}'::jsonb,
    'document',
    'xlsx',
    487000,
    'project',
    '84215ccb-313d-48f8-9c37-4398f28c0b1f',
    'restricted',
    'confidential',
    true
);

-- Artifact 7: Safety Incident Report Template
INSERT INTO app.d_artifact (
    id,
    slug,
    code,
    name,
    descr,
    tags,
    metadata,
    artifact_type,
    file_format,
    file_size_bytes,
    primary_entity_type,
    primary_entity_id,
    visibility,
    security_classification,
    is_latest_version
) VALUES (
    '77a77777-7777-7777-7777-777777777777',
    'safety-incident-report-template',
    'ART-FLC-007',
    'Safety Incident Report Template',
    'Official template for reporting workplace safety incidents and near-misses. Compliant with WSIB requirements and company safety protocols. Includes investigation and corrective action sections.',
    '["safety", "incident", "report", "template", "compliance", "WSIB"]'::jsonb,
    '{"created_by": "James Miller", "compliance_standard": "WSIB Ontario", "legal_review": "2024-06-01", "mandatory_fields": 15, "confidentiality": "high"}'::jsonb,
    'template',
    'pdf',
    245000,
    'project',
    '84215ccb-313d-48f8-9c37-4398f28c0b1f',
    'internal',
    'confidential',
    true
);