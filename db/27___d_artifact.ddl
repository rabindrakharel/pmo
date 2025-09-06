-- ============================================================================
-- ARTIFACT DIMENSION - SIMPLIFIED VERSION
-- ============================================================================

CREATE TABLE app.d_artifact (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Standard fields (audit, metadata, SCD type 2) - ALWAYS FIRST
  name text NOT NULL,
  "descr" text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),

  -- Artifact identification
  artifact_code text NOT NULL,
  artifact_type text NOT NULL DEFAULT 'document',
  -- Options: 'document','form','wiki','design','blueprint','specification','model','template','standard','guide','manual','report'
  -- 'analysis','dataset','script','tool','sow','contract','policy','procedure','checklist','onboarding','training','other'
  model_type text,
  
  -- Version and source management
  version text DEFAULT '1.0',
  source_type text DEFAULT 'file',
  storage text DEFAULT 'local',
  uri text,
  checksum text,
  file_size_bytes bigint,
  
  -- Content attributes
  mime_type text,
  confidentiality_level text DEFAULT 'internal',
  approval_status text DEFAULT 'draft',
  language text DEFAULT 'en',
  
  -- Temporal attributes
  publication_date date,
  expiry_date date,
  review_date date,
  
  -- Ownership and relationships
  author_employee_id uuid,
  owner_employee_id uuid,
  
  
  -- Usage and analytics
  access_count int DEFAULT 0,
  download_count int DEFAULT 0,
  last_accessed_ts timestamptz

);

-- Sample artifact data for testing
INSERT INTO app.d_artifact (
  name, "descr", artifact_code, artifact_type, model_type, version, source_type,
  uri, confidentiality_level, approval_status, publication_date, language,
  author_employee_id, owner_employee_id, tags, attr
) VALUES
('Landscape Design Template - Residential Premium', 'Standardized landscape design template for premium residential clients including plant selection, hardscape elements, and seasonal considerations', 'DESIGN-LAND-RES-001', 'design', 'template', '2.1', 'file', '/artifacts/designs/landscape_residential_premium_v2.1.pdf', 'confidential', 'approved', '2024-03-15', 'en', (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-001'), (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-001'), '["design", "landscape", "residential", "template"]', '{"design_type": "landscape_template", "client_segment": "premium_residential", "includes": ["plant_selection", "hardscape", "seasonal_planning"], "software": "AutoCAD", "format": "PDF", "created_by": "James Miller", "business_impact": "high"}'),
('Commercial Plaza Design Standards', 'Design standards and guidelines for commercial plaza landscaping projects including accessibility compliance and maintenance considerations', 'DESIGN-LAND-COM-001', 'design', 'standards', '1.3', 'file', '/artifacts/designs/commercial_plaza_standards_v1.3.pdf', 'internal', 'approved', '2024-01-20', 'en', (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-001'), (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-001'), '["design", "standards", "commercial", "plaza"]', '{"design_type": "standards_document", "compliance": ["accessibility", "municipal"], "maintenance_focus": true, "plaza_types": ["retail", "office", "mixed_use"], "approved_by": "James Miller"}'),
('Solar Installation Design Guide', 'Comprehensive design guide for residential solar installations including electrical schematics, structural requirements, and permit documentation', 'DESIGN-SOLAR-001', 'design', 'guide', '1.0', 'file', '/artifacts/designs/solar_installation_guide_v1.0.pdf', 'internal', 'approved', '2024-06-01', 'en', (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-003'), (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-003'), '["design", "solar", "electrical", "guide"]', '{"design_type": "installation_guide", "electrical_focus": true, "permits_included": true, "system_sizes": ["residential", "small_commercial"], "software": ["AutoCAD_Electrical", "SolarEdge_Designer"]}');