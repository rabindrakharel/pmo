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
    internal_url varchar(500),   -- Internal artifact URL: /artifact/{id} (authenticated access)
    shared_url varchar(500),     -- Public shared URL: /artifact/shared/{8-char-random} (presigned, no auth required)
    tags jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,

    -- Artifact classification
    artifact_type varchar(50) DEFAULT 'document', -- document, template, image, video, etc.
    file_format varchar(20), -- pdf, docx, xlsx, png, jpg, etc.
    file_size_bytes bigint,

    -- Relationships (will be mapped via entity_id_map)
    entity_type varchar(50), -- parent entity type and entity id - project, task, business, office
    entity_id uuid, 

    -- S3 backend 
    bucket_name varchar(100), -- e.g. 'artifacts-bucket'
    object_key varchar(500), -- /tenant_id={client_id}/entity={entity_name}/entity_id={entity_id from database}/attachment_id_hash.extension

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
    entity_type,
    entity_id,
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
    entity_type,
    entity_id,
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
    entity_type,
    entity_id,
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
    entity_type,
    entity_id,
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
    entity_type,
    entity_id,
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
    entity_type,
    entity_id,
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
    entity_type,
    entity_id,
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
);-- =====================================================
-- COMPREHENSIVE ARTIFACT DATA (50+ Artifacts)
-- Documents, templates, images, videos, and files across projects
-- =====================================================
--
-- This script generates realistic artifact data with:
-- - 50+ artifacts of various types
-- - Linked to projects, tasks, and other entities
-- - Different file formats and sizes
-- - Various visibility and security levels
-- - Version control examples
--
-- TO APPEND TO: 21_d_artifact.ddl (after existing INSERT statements)
-- =====================================================

DO $$
DECLARE
    v_artifact_types text[] := ARRAY['document', 'template', 'image', 'video', 'spreadsheet', 'presentation'];
    v_file_formats text[] := ARRAY['pdf', 'docx', 'xlsx', 'pptx', 'jpg', 'png', 'mp4', 'txt', 'csv'];
    v_visibility_levels text[] := ARRAY['public', 'internal', 'restricted', 'private'];
    v_security_levels text[] := ARRAY['general', 'confidential', 'restricted'];
    v_entity_types text[] := ARRAY['project', 'task', 'office', 'business'];

    v_artifact_names text[] := ARRAY[
        'Project Charter', 'Risk Assessment', 'Budget Forecast', 'Timeline Gantt Chart',
        'Client Agreement', 'Service Contract', 'Work Order', 'Change Request',
        'Safety Inspection Report', 'Equipment Checklist', 'Material Requisition', 'Purchase Order',
        'Technical Specifications', 'Design Drawings', 'Site Photos', 'Progress Photos',
        'Training Manual', 'Safety Procedures', 'Quality Standards', 'Best Practices Guide',
        'Financial Report', 'Cost Analysis', 'Invoice Template', 'Quote Template',
        'Marketing Brochure', 'Service Catalog', 'Price List', 'Product Sheet',
        'Meeting Minutes', 'Status Report', 'Weekly Update', 'Monthly Summary',
        'Before After Comparison', 'Site Survey', 'Inspection Results', 'Compliance Certificate',
        'Employee Handbook', 'Policy Manual', 'Procedure Guide', 'Training Video',
        'Customer Testimonial', 'Case Study', 'Project Portfolio', 'Success Story',
        'Warranty Information', 'Maintenance Schedule', 'Service Agreement', 'Support Guide'
    ];

    v_artifact_descriptions text[] := ARRAY[
        'Comprehensive documentation for project planning and execution',
        'Detailed assessment of potential risks and mitigation strategies',
        'Financial projection and budget allocation document',
        'Visual timeline showing project milestones and dependencies',
        'Legal agreement outlining terms of service and deliverables',
        'Contract template for standard service engagements',
        'Standardized work order form for field operations',
        'Template for requesting and approving project changes',
        'Safety compliance inspection report and findings',
        'Daily equipment inspection and maintenance checklist',
        'Material ordering and tracking form',
        'Purchase order template for procurement',
        'Technical requirements and specifications document',
        'Architectural and engineering design plans',
        'Photo documentation of work site conditions',
        'Before and after photographic evidence',
        'Comprehensive training guide for new employees',
        'Safety protocols and emergency procedures',
        'Quality assurance standards and metrics',
        'Industry best practices and recommendations'
    ];

    v_project_id uuid;
    v_artifact_count int := 0;
    v_artifact_type text;
    v_file_format text;
    v_artifact_name text;
    v_artifact_descr text;
    v_slug text;
    v_code text;
    v_tags jsonb;
    v_metadata jsonb;
    v_file_size bigint;
    v_visibility text;
    v_security text;
    v_entity_type text;
    v_entity_id uuid;
    i int;
BEGIN
    -- Generate 50 artifacts
    FOR i IN 1..50 LOOP
        -- Select random properties
        v_artifact_type := v_artifact_types[1 + floor(random() * array_length(v_artifact_types, 1))::int];
        v_artifact_name := v_artifact_names[1 + floor(random() * array_length(v_artifact_names, 1))::int];
        v_artifact_descr := v_artifact_descriptions[1 + floor(random() * array_length(v_artifact_descriptions, 1))::int];

        -- Select file format based on artifact type
        v_file_format := CASE v_artifact_type
            WHEN 'document' THEN CASE floor(random() * 3)::int WHEN 0 THEN 'pdf' WHEN 1 THEN 'docx' ELSE 'txt' END
            WHEN 'template' THEN CASE floor(random() * 2)::int WHEN 0 THEN 'docx' ELSE 'pdf' END
            WHEN 'image' THEN CASE floor(random() * 2)::int WHEN 0 THEN 'jpg' ELSE 'png' END
            WHEN 'video' THEN 'mp4'
            WHEN 'spreadsheet' THEN 'xlsx'
            WHEN 'presentation' THEN 'pptx'
            ELSE 'pdf'
        END;

        -- Generate realistic file size
        v_file_size := CASE v_artifact_type
            WHEN 'document' THEN 50000 + floor(random() * 950000)::bigint  -- 50KB - 1MB
            WHEN 'template' THEN 30000 + floor(random() * 470000)::bigint  -- 30KB - 500KB
            WHEN 'image' THEN 500000 + floor(random() * 9500000)::bigint   -- 500KB - 10MB
            WHEN 'video' THEN 10000000 + floor(random() * 490000000)::bigint  -- 10MB - 500MB
            WHEN 'spreadsheet' THEN 100000 + floor(random() * 1900000)::bigint  -- 100KB - 2MB
            WHEN 'presentation' THEN 1000000 + floor(random() * 49000000)::bigint  -- 1MB - 50MB
            ELSE 100000::bigint
        END;

        v_visibility := v_visibility_levels[1 + floor(random() * array_length(v_visibility_levels, 1))::int];
        v_security := v_security_levels[1 + floor(random() * array_length(v_security_levels, 1))::int];

        v_slug := lower(replace(v_artifact_name, ' ', '-')) || '-' || i;
        v_code := 'ART-' || to_char(current_date, 'YYYY') || '-' || lpad(i::text, 4, '0');

        -- Generate tags
        v_tags := jsonb_build_array(
            v_artifact_type,
            CASE floor(random() * 5)::int
                WHEN 0 THEN 'important'
                WHEN 1 THEN 'archive'
                WHEN 2 THEN 'template'
                WHEN 3 THEN 'reference'
                ELSE 'active'
            END,
            to_char(current_date, 'YYYY')
        );

        -- Generate metadata
        v_metadata := jsonb_build_object(
            'created_by', 'James Miller',
            'version', '1.0',
            'last_accessed', current_date - (floor(random() * 30)::int || ' days')::interval,
            'download_count', floor(random() * 100)::int,
            'file_hash', md5(random()::text)
        );

        -- Select random entity to link to
        v_entity_type := v_entity_types[1 + floor(random() * array_length(v_entity_types, 1))::int];

        -- Get a random entity ID of that type
        EXECUTE format('SELECT id FROM app.d_%s WHERE active_flag = true ORDER BY random() LIMIT 1',
            CASE v_entity_type
                WHEN 'business' THEN 'business'
                ELSE v_entity_type
            END
        ) INTO v_entity_id;

        -- If no entity found, use project
        IF v_entity_id IS NULL THEN
            SELECT id INTO v_entity_id FROM app.d_project WHERE active_flag = true ORDER BY random() LIMIT 1;
            v_entity_type := 'project';
        END IF;

        -- Insert artifact
        INSERT INTO app.d_artifact (
            slug, code, name, descr, tags, metadata,
            artifact_type, file_format, file_size_bytes,
            entity_type, entity_id,
            visibility, security_classification, is_latest_version
        ) VALUES (
            v_slug,
            v_code,
            v_artifact_name || ' ' || i,
            v_artifact_descr,
            v_tags,
            v_metadata,
            v_artifact_type,
            v_file_format,
            v_file_size,
            v_entity_type,
            v_entity_id,
            v_visibility,
            v_security,
            true
        );

        v_artifact_count := v_artifact_count + 1;
    END LOOP;

    RAISE NOTICE '% artifacts generated successfully!', v_artifact_count;
END $$;

-- =====================================================
-- SPECIFIC ARTIFACT TYPES FOR COMMON SCENARIOS
-- =====================================================

-- Safety and Compliance Documents
INSERT INTO app.d_artifact (
    slug, code, name, descr, tags, metadata,
    artifact_type, file_format, file_size_bytes,
    entity_type, entity_id,
    visibility, security_classification, is_latest_version
)
SELECT
    'safety-' || lower(replace(name, ' ', '-')),
    'ART-SAFE-' || lpad(row_number() OVER ()::text, 3, '0'),
    name,
    descr,
    '["safety", "compliance", "mandatory", "wsib"]'::jsonb,
    '{"compliance_standard": "WSIB Ontario", "review_cycle": "annual", "mandatory_reading": true}'::jsonb,
    'document',
    'pdf',
    250000 + floor(random() * 500000)::bigint,
    'office',
    (SELECT id FROM app.d_office WHERE active_flag = true ORDER BY random() LIMIT 1),
    'internal',
    'confidential',
    true
FROM (VALUES
    ('Workplace Safety Manual', 'Comprehensive guide to workplace safety procedures and protocols'),
    ('Emergency Response Plan', 'Procedures for handling workplace emergencies and evacuations'),
    ('WSIB Incident Reporting Guide', 'Step-by-step guide for reporting workplace injuries'),
    ('PPE Requirements Checklist', 'Personal protective equipment requirements by job role'),
    ('Hazardous Materials Handling', 'Safe handling procedures for hazardous materials and chemicals')
) AS t(name, descr);

-- Marketing and Sales Materials
INSERT INTO app.d_artifact (
    slug, code, name, descr, tags, metadata,
    artifact_type, file_format, file_size_bytes,
    entity_type, entity_id,
    visibility, security_classification, is_latest_version
)
SELECT
    'marketing-' || lower(replace(name, ' ', '-')),
    'ART-MKT-' || lpad(row_number() OVER ()::text, 3, '0'),
    name,
    descr,
    '["marketing", "sales", "customer-facing", "branding"]'::jsonb,
    '{"brand_approved": true, "languages": ["en", "fr"], "print_ready": true}'::jsonb,
    artifact_type,
    file_format,
    file_size,
    'project',
    (SELECT id FROM app.d_project WHERE active_flag = true ORDER BY random() LIMIT 1),
    'public',
    'general',
    true
FROM (VALUES
    ('Service Portfolio Brochure', 'Comprehensive overview of all service offerings', 'document', 'pdf', 3500000),
    ('Residential Services Flyer', 'Marketing flyer for residential customers', 'document', 'pdf', 1200000),
    ('Commercial Solutions Guide', 'Detailed guide to commercial service packages', 'document', 'pdf', 5800000),
    ('Customer Success Stories', 'Case studies and testimonials from satisfied clients', 'document', 'pdf', 2400000),
    ('Before After Photo Gallery', 'Visual portfolio of completed projects', 'image', 'jpg', 15000000)
) AS t(name, descr, artifact_type, file_format, file_size);

-- Technical Documentation
INSERT INTO app.d_artifact (
    slug, code, name, descr, tags, metadata,
    artifact_type, file_format, file_size_bytes,
    entity_type, entity_id,
    visibility, security_classification, is_latest_version
)
SELECT
    'technical-' || lower(replace(name, ' ', '-')),
    'ART-TECH-' || lpad(row_number() OVER ()::text, 3, '0'),
    name,
    descr,
    '["technical", "reference", "documentation", "engineering"]'::jsonb,
    '{"technical_review": true, "revision_date": current_date, "approved_by": "Engineering"}'::jsonb,
    'document',
    'pdf',
    400000 + floor(random() * 1600000)::bigint,
    'project',
    (SELECT id FROM app.d_project WHERE active_flag = true ORDER BY random() LIMIT 1),
    'internal',
    'confidential',
    true
FROM (VALUES
    ('HVAC System Design Specifications', 'Technical specifications for HVAC system installations'),
    ('Electrical Code Compliance Guide', 'Ontario electrical code compliance requirements'),
    ('Plumbing Installation Standards', 'Standard procedures for plumbing installations'),
    ('Solar Panel Installation Manual', 'Comprehensive guide to solar panel installation'),
    ('Building Envelope Details', 'Technical details for building envelope construction')
) AS t(name, descr);

-- Training Videos
INSERT INTO app.d_artifact (
    slug, code, name, descr, tags, metadata,
    artifact_type, file_format, file_size_bytes,
    entity_type, entity_id,
    visibility, security_classification, is_latest_version
)
SELECT
    'training-video-' || lower(replace(name, ' ', '-')),
    'ART-VID-' || lpad(row_number() OVER ()::text, 3, '0'),
    name,
    descr,
    '["training", "video", "education", "onboarding"]'::jsonb,
    jsonb_build_object(
        'duration_minutes', duration,
        'resolution', '1080p',
        'language', 'English',
        'subtitles', ARRAY['en', 'fr'],
        'training_category', category
    ),
    'video',
    'mp4',
    duration * 1000000 * 8::bigint, -- ~8MB per minute
    'office',
    (SELECT id FROM app.d_office WHERE active_flag = true ORDER BY random() LIMIT 1),
    'internal',
    'general',
    true
FROM (VALUES
    ('New Employee Orientation', 'Welcome and introduction for new team members', 25, 'onboarding'),
    ('Safety Training Fundamentals', 'Basic workplace safety training', 45, 'safety'),
    ('HVAC Troubleshooting Techniques', 'Common HVAC problems and solutions', 35, 'technical'),
    ('Customer Service Excellence', 'Best practices for customer interactions', 30, 'soft-skills'),
    ('Equipment Operation Certification', 'Safe operation of company equipment', 60, 'certification')
) AS t(name, descr, duration, category);

-- =====================================================
-- REGISTER ARTIFACTS IN d_entity_id_map
-- =====================================================

-- Link all artifacts to their parent entities
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT
    a.entity_type,
    a.entity_id::text,
    'artifact',
    a.id::text,
    'contains'
FROM app.d_artifact a
WHERE a.entity_id IS NOT NULL
  AND a.entity_type IS NOT NULL
  AND a.active_flag = true
ON CONFLICT DO NOTHING;

-- =====================================================
-- REGISTER ARTIFACTS IN d_entity_instance_id
-- =====================================================

INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_slug, entity_code)
SELECT 'artifact', id, name, slug, code
FROM app.d_artifact
WHERE active_flag = true
ON CONFLICT (entity_type, entity_id) DO UPDATE
SET entity_name = EXCLUDED.entity_name,
    entity_slug = EXCLUDED.entity_slug,
    entity_code = EXCLUDED.entity_code,
    updated_ts = now();

-- =====================================================
-- ARTIFACT STATISTICS
-- =====================================================

-- Show artifact summary by type
SELECT
    artifact_type,
    COUNT(*) as artifact_count,
    SUM(file_size_bytes) as total_size_bytes,
    AVG(file_size_bytes) as avg_size_bytes,
    MAX(file_size_bytes) as max_size_bytes
FROM app.d_artifact
WHERE active_flag = true
GROUP BY artifact_type
ORDER BY artifact_count DESC;

-- Show artifact distribution by entity type
SELECT
    entity_type,
    COUNT(*) as artifact_count,
    array_agg(DISTINCT artifact_type) as artifact_types
FROM app.d_artifact
WHERE active_flag = true
  AND entity_type IS NOT NULL
GROUP BY entity_type
ORDER BY artifact_count DESC;

-- Show visibility and security distribution
SELECT
    visibility,
    security_classification,
    COUNT(*) as artifact_count
FROM app.d_artifact
WHERE active_flag = true
GROUP BY visibility, security_classification
ORDER BY visibility, security_classification;

COMMENT ON TABLE app.d_artifact IS 'Artifact table with 50+ curated documents, images, videos, and files across entities';
