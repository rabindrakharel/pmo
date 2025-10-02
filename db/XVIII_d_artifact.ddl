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