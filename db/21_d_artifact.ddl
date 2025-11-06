-- =====================================================
-- ARTIFACT ENTITY (d_artifact) - CONTENT ENTITY
-- Document and file management with version control and access controls
-- =====================================================
--
-- SEMANTICS:
-- • Documents, templates, images, videos linked to projects/tasks
-- • Version control, security classification, visibility controls
-- • Files stored in MinIO/S3; this table tracks metadata/relationships
--
-- OPERATIONS:
-- • CREATE: POST /api/v1/artifact (multipart/form-data), uploads to S3, INSERT with version=1
-- • UPDATE: PUT /api/v1/artifact/{id}, metadata only, version++
-- • DELETE: active_flag=false, to_ts=now() (file remains in S3)
-- • LIST: Filter by artifact_type, entity_type, security_classification
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY
-- • artifact_type, attachment_format: text
-- • attachment_size_bytes: bigint
-- • attachment_object_bucket, attachment_object_key, attachment: text (S3 refs)
-- • entity_type, entity_id: text, uuid (parent entity link)
-- • visibility, security_classification: text
-- • latest_version_flag: boolean
--
-- RELATIONSHIPS:
-- • Parent: project, task, form, etc. (via entity_type/entity_id)
-- • RBAC: entity_id_rbac_map
--
-- =====================================================

CREATE TABLE app.d_artifact (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    active_flag boolean DEFAULT true,
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1,

    -- Artifact-specific fields
    artifact_type text,
    attachment_format text,
    attachment_size_bytes bigint,
    attachment_object_bucket text,
    attachment_object_key text,
    attachment text,
    entity_type text,
    entity_id uuid,
    visibility text,
    security_classification text,
    latest_version_flag boolean DEFAULT true
);

COMMENT ON TABLE app.d_artifact IS 'Artifact table for document and file management';

-- Sample artifact data
-- Artifact 3: Client Service Agreement Template
INSERT INTO app.d_artifact (
    id,
    code,
    name,
    descr,
    metadata,
    artifact_type,
    attachment_format,
    attachment_size_bytes,
    attachment_object_bucket,
    attachment_object_key,
    attachment,
    entity_type,
    entity_id,
    visibility,
    security_classification,
    latest_version_flag
) VALUES (
    '33a33333-3333-3333-3333-333333333333',
    'ART-FLC-003',
    'Client Service Agreement Template',
    'Legal service agreement template for fall landscaping contracts. Includes terms of service, payment terms, liability clauses, and cancellation policies compliant with Ontario regulations.',
    '{"created_by": "James Miller", "legal_review_date": "2024-07-15", "reviewed_by": "Legal Department", "jurisdiction": "Ontario", "version": "2024.1"}'::jsonb,
    'template',
    'docx',
    92000,
    'pmo-attachments',
    'artifacts/33a33333-3333-3333-3333-333333333333/file.docx',
    's3://pmo-attachments/artifacts/33a33333-3333-3333-3333-333333333333/file.docx',
    'project',
    '84215ccb-313d-48f8-9c37-4398f28c0b1f',
    'internal',
    'confidential',
    true
);

-- Artifact 4: Training Video - Aeration Techniques
INSERT INTO app.d_artifact (
    id,
    code,
    name,
    descr,
    metadata,
    artifact_type,
    attachment_format,
    attachment_size_bytes,
    attachment_object_bucket,
    attachment_object_key,
    attachment,
    entity_type,
    entity_id,
    visibility,
    security_classification,
    latest_version_flag
) VALUES (
    '44a44444-4444-4444-4444-444444444444',
    'ART-FLC-004',
    'Training Video - Aeration Techniques',
    'Comprehensive training video demonstrating proper aeration techniques for different soil types and lawn conditions. Covers equipment setup, operation, and safety procedures.',
    '{"created_by": "James Miller", "duration_minutes": 18, "resolution": "1080p", "language": "English", "subtitles":,
    '{"created_by": "James Miller", "photo_count": 45, "total_size_mb": 125, "usage_rights": "company_owned", "locations":,
    '{"created_by": "James Miller", "formula_version": "2024.2", "includes_macros": true, "update_frequency": "quarterly", "currency": "CAD"}'::jsonb,
    'document',
    'xlsx',
    487000,
    'pmo-attachments',
    'artifacts/66a66666-6666-6666-6666-666666666666/file.xlsx',
    's3://pmo-attachments/artifacts/66a66666-6666-6666-6666-666666666666/file.xlsx',
    'project',
    '84215ccb-313d-48f8-9c37-4398f28c0b1f',
    'restricted',
    'confidential',
    true
);

-- Artifact 7: Safety Incident Report Template
INSERT INTO app.d_artifact (
    id,
    code,
    name,
    descr,
    metadata,
    artifact_type,
    attachment_format,
    attachment_size_bytes,
    attachment_object_bucket,
    attachment_object_key,
    attachment,
    entity_type,
    entity_id,
    visibility,
    security_classification,
    latest_version_flag
) VALUES (
    '77a77777-7777-7777-7777-777777777777',
    'ART-FLC-007',
    'Safety Incident Report Template',
    'Official template for reporting workplace safety incidents and near-misses. Compliant with WSIB requirements and company safety protocols. Includes investigation and corrective action sections.',
    '{"created_by": "James Miller", "compliance_standard": "WSIB Ontario", "legal_review": "2024-06-01", "mandatory_fields": 15, "confidentiality": "high"}'::jsonb,
    'template',
    'pdf',
    245000,
    'pmo-attachments',
    'artifacts/77a77777-7777-7777-7777-777777777777/file.pdf',
    's3://pmo-attachments/artifacts/77a77777-7777-7777-7777-777777777777/file.pdf',
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
    v_artifact_types text,
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
INSERT INTO app.d_artifact (, code, name, descr, metadata,
    artifact_type, attachment_format, attachment_size_bytes,
    entity_type, entity_id,
    visibility, security_classification, is_latest_version
)
SELECT
    'marketing-' || lower(replace(name, ' ', '-')),
    'ART-MKT-' || lpad(row_number() OVER ()::text, 3, '0'),
    name,
    descr,
    '{"brand_approved": true, "languages":,
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
INSERT INTO app.d_artifact (, code, name, descr, metadata,
    artifact_type, attachment_format, attachment_size_bytes,
    entity_type, entity_id,
    visibility, security_classification, is_latest_version
)
SELECT
    'training-video-' || lower(replace(name, ' ', '-')),
    'ART-VID-' || lpad(row_number() OVER ()::text, 3, '0'),
    name,
    descr,
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

INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code entity_code)
SELECT 'artifact', id, name, code
FROM app.d_artifact
WHERE active_flag = true
ON CONFLICT (entity_type, entity_id) DO UPDATE
SET entity_name = EXCLUDED.entity_name,
    entity_code = EXCLUDED.entity_code
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
