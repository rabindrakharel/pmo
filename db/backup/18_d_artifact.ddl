-- ============================================================================
-- ARTIFACT DIMENSION
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Enterprise knowledge artifacts including RFPs, proposals, SOWs, designs,
--   onboarding guides, and models. Core artifact table contains essential
--   artifact data while relationships are managed through separate
--   relationship tables for maximum flexibility.
--
-- Artifact Types:
--   - Design: Technical and creative design documents
--   - RFP: Request for Proposal documents
--   - Proposal: Business proposals and responses
--   - SOW: Statement of Work documents  
--   - Onboarding: Employee and client onboarding materials
--   - Model: Business process and data models
--   - Policy: Company policies and procedures
--
-- Integration:
--   - Uses separate relationship tables for all entity associations
--   - Enables artifacts to belong to multiple projects, organizations, etc.
--   - Supports complex permission models via role and employee relationships
--   - Eliminates foreign key constraints for maximum flexibility

-- ============================================================================
-- DDL:
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
  artifact_code text UNIQUE,
  artifact_type text NOT NULL,
  model_type text,
  version text DEFAULT '1.0',
  
  -- Content and storage
  source_type text NOT NULL DEFAULT 'url',
  uri text,
  content_hash text,
  file_size bigint,
  mime_type text,
  
  -- Metadata
  language text DEFAULT 'en',
  confidentiality_level text DEFAULT 'internal',
  retention_period_years int,
  
  -- Status and lifecycle
  approval_status text DEFAULT 'draft',
  publication_date date,
  expiry_date date,
  review_date date,
  
  -- Collaboration and access
  author_employee_id uuid,
  owner_employee_id uuid,
  last_modified_by_employee_id uuid,
  
  -- Storage and attachments
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  external_references jsonb DEFAULT '[]'::jsonb
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Huron Home Services Artifact Portfolio

-- Design Artifacts
INSERT INTO app.d_artifact (
  name, "descr", artifact_code, artifact_type, model_type, version, source_type,
  uri, confidentiality_level, approval_status, publication_date, language,
  tags, attr
) VALUES
('Landscape Design Template - Residential Premium', 'Standardized landscape design template for premium residential clients including plant selection, hardscape elements, and seasonal considerations', 'DESIGN-LAND-RES-001', 'design', 'template', '2.1', 'file', '/artifacts/designs/landscape_residential_premium_v2.1.pdf', 'confidential', 'approved', '2024-03-15', 'en',
'["design", "landscape", "residential", "template"]',
'{"design_type": "landscape_template", "client_segment": "premium_residential", "includes": ["plant_selection", "hardscape", "seasonal_planning"], "software": "AutoCAD", "format": "PDF"}'),

('Commercial Plaza Design Standards', 'Design standards and guidelines for commercial plaza landscaping projects including accessibility compliance and maintenance considerations', 'DESIGN-LAND-COM-001', 'design', 'standards', '1.3', 'file', '/artifacts/designs/commercial_plaza_standards_v1.3.pdf', 'internal', 'approved', '2024-01-20', 'en',
'["design", "standards", "commercial", "plaza"]',
'{"design_type": "standards_document", "compliance": ["accessibility", "municipal"], "maintenance_focus": true, "plaza_types": ["retail", "office", "mixed_use"]}'),

('Solar Installation Design Guide', 'Comprehensive design guide for residential solar installations including electrical schematics, structural requirements, and permit documentation', 'DESIGN-SOLAR-001', 'design', 'guide', '1.0', 'file', '/artifacts/designs/solar_installation_guide_v1.0.pdf', 'internal', 'approved', '2024-06-01', 'en',
'["design", "solar", "electrical", "guide"]',
'{"design_type": "installation_guide", "electrical_focus": true, "permits_included": true, "system_sizes": ["residential", "small_commercial"], "software": ["AutoCAD_Electrical", "SolarEdge_Designer"]}');

-- RFP and Proposal Artifacts
INSERT INTO app.d_artifact (
  name, "descr", artifact_code, artifact_type, version, source_type, uri,
  confidentiality_level, approval_status, publication_date, review_date, language,
  tags, attr
) VALUES
('City of Mississauga Parks RFP Response', 'Comprehensive response to City of Mississauga RFP for parks maintenance and landscaping services covering 45 municipal parks', 'RFP-RESP-MISS-001', 'proposal', '1.0', 'file', '/artifacts/proposals/mississauga_parks_rfp_response.pdf', 'confidential', 'submitted', '2024-08-15', '2025-02-15', 'en',
'["proposal", "municipal", "parks", "mississauga"]',
'{"rfp_number": "MISS-2024-PARKS-001", "contract_value": 2500000, "contract_duration_years": 3, "parks_count": 45, "services": ["landscaping", "maintenance", "seasonal"], "submission_date": "2024-08-15"}'),

('Hamilton Market Expansion Proposal', 'Business proposal for market expansion into Hamilton region including market analysis, service offerings, and financial projections', 'PROP-HAM-EXP-001', 'proposal', '2.0', 'file', '/artifacts/proposals/hamilton_expansion_proposal_v2.0.pdf', 'confidential', 'approved', '2024-09-01', '2024-12-01', 'en',
'["proposal", "expansion", "hamilton", "strategy"]',
'{"expansion_type": "geographic", "target_market": "hamilton_cma", "investment_required": 750000, "revenue_projection_year1": 2000000, "services": ["landscaping", "snow_removal", "hvac"], "competitive_analysis": true}'),

('Oakville Luxury Residential SOW', 'Statement of Work for premium landscaping services in Oakville luxury residential market including custom design and installation', 'SOW-OAK-LUX-001', 'sow', '1.2', 'file', '/artifacts/sow/oakville_luxury_residential_sow_v1.2.pdf', 'confidential', 'approved', '2024-07-20', '2025-01-20', 'en',
'["sow", "oakville", "luxury", "residential"]',
'{"client_segment": "luxury_residential", "project_duration_months": 8, "custom_design": true, "premium_materials": true, "services": ["design", "installation", "maintenance"], "warranty_years": 5}');

-- Onboarding and Training Artifacts
INSERT INTO app.d_artifact (
  name, "descr", artifact_code, artifact_type, version, source_type, uri,
  confidentiality_level, approval_status, publication_date, language,
  tags, attr
) VALUES
('New Employee Onboarding Guide', 'Comprehensive onboarding guide for new employees covering company culture, safety procedures, and role-specific training requirements', 'ONBOARD-EMP-001', 'onboarding', '3.1', 'wiki', '/wiki/onboarding/new_employee_guide', 'internal', 'approved', '2024-02-01', 'en',
'["onboarding", "employee", "training", "safety"]',
'{"audience": "all_new_employees", "duration_days": 5, "includes_safety": true, "role_specific_modules": true, "languages_available": ["en", "fr"], "interactive_elements": true}'),

('HVAC Technician Certification Guide', 'Training and certification guide for HVAC technicians including technical procedures, safety protocols, and licensing requirements', 'TRAIN-HVAC-001', 'onboarding', '2.0', 'file', '/artifacts/training/hvac_technician_certification_v2.0.pdf', 'internal', 'approved', '2024-04-10', 'en',
'["training", "hvac", "certification", "technical"]',
'{"certification_type": "hvac_technician", "prerequisites": ["trade_school", "apprenticeship"], "duration_hours": 120, "practical_component": true, "licensing_prep": ["g2_gas", "refrigeration"], "safety_focus": true}'),

('Client Onboarding Process Model', 'Process model and documentation for client onboarding across all service lines including intake, assessment, and service initiation', 'ONBOARD-CLIENT-001', 'model', '1.5', 'wiki', '/wiki/processes/client_onboarding_model', 'internal', 'approved', '2024-05-15', 'en',
'["onboarding", "client", "process", "model"]',
'{"process_type": "client_onboarding", "service_lines": "all", "duration_typical_days": 7, "touchpoints": ["intake", "assessment", "proposal", "contract", "kickoff"], "automation_level": "high"});

-- Policy and Procedure Artifacts  
INSERT INTO app.d_artifact (
  name, "descr", artifact_code, artifact_type, version, source_type, uri,
  confidentiality_level, approval_status, publication_date, review_date, language,
  tags, attr
) VALUES
('Safety Management System Policy', 'Comprehensive safety management system policy covering all operational activities, emergency procedures, and regulatory compliance', 'POLICY-SAFETY-001', 'policy', '2.3', 'wiki', '/wiki/policies/safety_management_system', 'internal', 'approved', '2024-01-15', '2025-01-15', 'en',
'["policy", "safety", "compliance", "emergency"]',
'{"policy_type": "safety_management", "regulatory_compliance": ["wsib", "ohsa", "ministry_of_labour"], "emergency_procedures": true, "training_requirements": true, "audit_schedule": "quarterly"}'),

('Customer Privacy Protection Policy', 'Privacy protection policy ensuring compliance with PIPEDA and provincial privacy legislation for customer data handling', 'POLICY-PRIVACY-001', 'policy', '1.8', 'wiki', '/wiki/policies/customer_privacy_protection', 'confidential', 'approved', '2024-03-01', '2025-03-01', 'en',
'["policy", "privacy", "pipeda", "compliance"]',
'{"policy_type": "privacy_protection", "legislation_compliance": ["pipeda", "ontario_privacy"], "data_types": ["customer", "employee", "financial"], "retention_schedules": true, "breach_procedures": true}'),

('Quality Assurance Standards Manual', 'Quality assurance standards and procedures manual covering all service lines with inspection checklists and corrective action procedures', 'MANUAL-QA-001', 'policy', '1.4', 'file', '/artifacts/manuals/quality_assurance_standards_v1.4.pdf', 'internal', 'approved', '2024-06-15', '2024-12-15', 'en',
'["manual", "quality", "standards", "procedures"]',
'{"manual_type": "quality_assurance", "service_lines": "all", "inspection_checklists": true, "corrective_actions": true, "customer_satisfaction": true, "continuous_improvement": true});

-- Indexes removed for simplified import