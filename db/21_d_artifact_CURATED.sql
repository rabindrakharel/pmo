-- =====================================================
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
            primary_entity_type, primary_entity_id,
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
    primary_entity_type, primary_entity_id,
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
    primary_entity_type, primary_entity_id,
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
    primary_entity_type, primary_entity_id,
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
    primary_entity_type, primary_entity_id,
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
    a.primary_entity_type,
    a.primary_entity_id::text,
    'artifact',
    a.id::text,
    'contains'
FROM app.d_artifact a
WHERE a.primary_entity_id IS NOT NULL
  AND a.primary_entity_type IS NOT NULL
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
    primary_entity_type,
    COUNT(*) as artifact_count,
    array_agg(DISTINCT artifact_type) as artifact_types
FROM app.d_artifact
WHERE active_flag = true
  AND primary_entity_type IS NOT NULL
GROUP BY primary_entity_type
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
