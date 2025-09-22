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
('Solar Installation Design Guide', 'Comprehensive design guide for residential solar installations including electrical schematics, structural requirements, and permit documentation', 'DESIGN-SOLAR-001', 'design', 'guide', '1.0', 'file', '/artifacts/designs/solar_installation_guide_v1.0.pdf', 'internal', 'approved', '2024-06-01', 'en', (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-003'), (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-003'), '["design", "solar", "electrical", "guide"]', '{"design_type": "installation_guide", "electrical_focus": true, "permits_included": true, "system_sizes": ["residential", "small_commercial"], "software": ["AutoCAD_Electrical", "SolarEdge_Designer"]}'),
('HVAC Maintenance Checklist Template', 'Standardized maintenance checklist template for quarterly HVAC system inspections including safety protocols and performance metrics', 'TEMPLATE-HVAC-MAINT-001', 'template', 'checklist', '1.2', 'file', '/artifacts/templates/hvac_maintenance_checklist_v1.2.pdf', 'internal', 'approved', '2024-04-10', 'en', (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-005'), (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-005'), '["template", "hvac", "maintenance", "checklist"]', '{"template_type": "maintenance_checklist", "inspection_frequency": "quarterly", "safety_focus": true, "performance_metrics": ["efficiency", "temperature", "airflow"], "compliance": ["TSSA", "ESA"]}'),
('Safety Training Certification Manual', 'Comprehensive safety training manual and certification procedures for all Huron Home Services field operations', 'MANUAL-SAFETY-001', 'manual', 'training', '3.0', 'file', '/artifacts/manuals/safety_training_manual_v3.0.pdf', 'internal', 'approved', '2024-02-15', 'en', (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-001'), (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-001'), '["manual", "safety", "training", "certification"]', '{"manual_type": "training_certification", "training_modules": ["ppe", "tool_safety", "emergency_procedures", "hazmat"], "certification_validity": "annual", "compliance": ["WSIB", "OSHA"], "updated_by": "James Miller"}'),
('Digital System Integration Blueprint', 'Technical blueprint for integrating digital systems across Huron Home Services operations including CRM, scheduling, and mobile workforce management', 'BLUEPRINT-DIGITAL-001', 'blueprint', 'system', '1.0', 'file', '/artifacts/blueprints/digital_integration_blueprint_v1.0.pdf', 'confidential', 'draft', '2024-08-20', 'en', (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-001'), (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-001'), '["blueprint", "digital", "integration", "systems"]', '{"blueprint_type": "system_integration", "systems": ["ServiceTitan", "QuickBooks", "Microsoft365", "Mobile_Apps"], "integration_phases": 3, "timeline": "12_months", "business_impact": "transformational"}'),
('Snow Removal Equipment Specifications', 'Technical specifications and procurement guidelines for commercial snow removal equipment including performance requirements and maintenance protocols', 'SPEC-SNOW-EQUIP-001', 'specification', 'equipment', '2.0', 'file', '/artifacts/specifications/snow_removal_equipment_spec_v2.0.pdf', 'internal', 'approved', '2024-09-01', 'en', (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-004'), (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-004'), '["specification", "snow", "equipment", "commercial"]', '{"spec_type": "equipment_procurement", "equipment_types": ["plows", "spreaders", "blowers"], "capacity_requirements": true, "maintenance_schedule": "included", "season": "winter_2024_2025"}');

-- ============================================================================
-- FALL 2025 LANDSCAPING CAMPAIGN ARTIFACTS
-- ============================================================================

-- Comprehensive artifacts for the Fall 2025 Landscaping Campaign project
INSERT INTO app.d_artifact (
  name, "descr", artifact_code, artifact_type, model_type, version, source_type,
  uri, confidentiality_level, approval_status, publication_date, language,
  author_employee_id, owner_employee_id, tags, attr
) VALUES
('Fall 2025 Landscaping Campaign Project Charter', 'Official project charter for the Fall 2025 Landscaping Campaign including scope, objectives, budget allocation, and success metrics', 'CHARTER-FALL-2025-LAND-001', 'document', 'charter', '1.0', 'file', '/artifacts/projects/fall_2025_landscaping_charter_v1.0.pdf', 'internal', 'approved', '2025-08-15', 'en', (SELECT id FROM app.d_employee WHERE name = 'James Miller'), (SELECT id FROM app.d_employee WHERE name = 'James Miller'), '["project_charter", "fall_2025", "landscaping", "campaign"]', '{"project_value": 450000, "timeline": "august_2025_to_november_2025", "target_clients": 25, "team_size": 5, "approval_date": "2025-08-15", "strategic_priority": "high"}'),

('Soil Testing and Analysis Protocol', 'Comprehensive protocol for conducting soil tests and analysis during fall landscaping preparation including pH testing, nutrient analysis, and amendment recommendations', 'PROTOCOL-SOIL-TEST-001', 'procedure', 'protocol', '2.0', 'file', '/artifacts/procedures/soil_testing_protocol_v2.0.pdf', 'internal', 'approved', '2025-08-20', 'en', (SELECT id FROM app.d_employee WHERE name = 'James Miller'), (SELECT id FROM app.d_employee WHERE name = 'James Miller'), '["soil_testing", "analysis", "protocol", "landscaping"]', '{"testing_parameters": ["pH", "nutrients", "compaction", "drainage"], "equipment_required": ["pH_meter", "soil_auger", "testing_kit"], "analysis_turnaround": "24_hours", "accuracy_standard": "professional_grade"}'),

('Fall Landscaping Equipment Inventory List', 'Complete inventory list of equipment required for fall landscaping operations including specifications, rental information, and maintenance schedules', 'INVENTORY-FALL-EQUIP-001', 'template', 'inventory', '1.1', 'file', '/artifacts/templates/fall_landscaping_equipment_inventory_v1.1.xlsx', 'internal', 'approved', '2025-08-25', 'en', (SELECT id FROM app.d_employee WHERE name = 'James Miller'), (SELECT id FROM app.d_employee WHERE name = 'James Miller'), '["equipment", "inventory", "fall_landscaping", "template"]', '{"equipment_categories": ["aeration", "seeding", "planting", "maintenance"], "total_items": 45, "rental_equipment": 15, "owned_equipment": 30, "maintenance_schedule": "weekly"}'),

('Client Site Assessment Checklist', 'Standardized checklist for conducting comprehensive site assessments before beginning fall landscaping work including safety, soil, and design considerations', 'CHECKLIST-SITE-ASSESS-001', 'checklist', 'assessment', '1.3', 'file', '/artifacts/checklists/client_site_assessment_v1.3.pdf', 'internal', 'approved', '2025-08-30', 'en', (SELECT id FROM app.d_employee WHERE name = 'James Miller'), (SELECT id FROM app.d_employee WHERE name = 'James Miller'), '["site_assessment", "checklist", "client", "safety"]', '{"assessment_areas": ["safety_hazards", "soil_conditions", "existing_vegetation", "drainage", "access"], "completion_time": "45_minutes", "photo_documentation": true, "client_walkthrough": true}'),

('Cool-Season Grass Seed Selection Guide', 'Professional guide for selecting appropriate cool-season grass varieties based on site conditions, traffic patterns, and client preferences', 'GUIDE-GRASS-SEED-001', 'guide', 'selection', '1.0', 'file', '/artifacts/guides/cool_season_grass_selection_v1.0.pdf', 'internal', 'approved', '2025-09-01', 'en', (SELECT id FROM app.d_employee WHERE name = 'James Miller'), (SELECT id FROM app.d_employee WHERE name = 'James Miller'), '["grass_seed", "selection", "cool_season", "guide"]', '{"grass_varieties": ["tall_fescue", "perennial_ryegrass", "fine_fescue", "kentucky_bluegrass"], "selection_criteria": ["sun_exposure", "traffic_tolerance", "drought_resistance"], "seeding_rates": "included", "establishment_timeline": "detailed"}'),

('Seasonal Plant Installation Design Templates', 'Collection of design templates for seasonal plant installations including fall color displays and spring bulb arrangements', 'TEMPLATE-PLANT-DESIGN-001', 'template', 'design', '1.5', 'file', '/artifacts/templates/seasonal_plant_design_templates_v1.5.pdf', 'confidential', 'approved', '2025-09-05', 'en', (SELECT id FROM app.d_employee WHERE name = 'James Miller'), (SELECT id FROM app.d_employee WHERE name = 'James Miller'), '["plant_design", "seasonal", "template", "installation"]', '{"design_types": ["fall_color", "spring_bulbs", "winter_interest"], "plant_combinations": 25, "color_schemes": ["warm_autumn", "cool_winter", "bright_spring"], "maintenance_level": "low_to_moderate"}'),

('Quality Control Inspection Forms', 'Standardized forms for conducting quality control inspections at various stages of fall landscaping projects', 'FORM-QC-INSPECT-001', 'form', 'inspection', '2.1', 'file', '/artifacts/forms/quality_control_inspection_v2.1.pdf', 'internal', 'approved', '2025-09-10', 'en', (SELECT id FROM app.d_employee WHERE name = 'James Miller'), (SELECT id FROM app.d_employee WHERE name = 'James Miller'), '["quality_control", "inspection", "form", "landscaping"]', '{"inspection_stages": ["site_prep", "soil_work", "seeding", "planting", "completion"], "scoring_system": "1_to_10", "photo_requirements": true, "client_signoff": true, "corrective_actions": "documented"}'),

('Client Communication Timeline Template', 'Template for establishing communication schedules and touchpoints with clients throughout the fall landscaping campaign', 'TEMPLATE-COMM-TIMELINE-001', 'template', 'communication', '1.0', 'file', '/artifacts/templates/client_communication_timeline_v1.0.pdf', 'internal', 'approved', '2025-09-12', 'en', (SELECT id FROM app.d_employee WHERE name = 'James Miller'), (SELECT id FROM app.d_employee WHERE name = 'James Miller'), '["communication", "timeline", "client", "template"]', '{"communication_frequency": "weekly", "touchpoint_types": ["email", "phone", "site_visit"], "milestone_communications": true, "weather_updates": true, "satisfaction_surveys": "included"}'),

('Fall Fertilizer Application Schedule', 'Detailed schedule and application rates for fall fertilizer programs optimized for root development and winter hardiness', 'SCHEDULE-FERTILIZER-001', 'schedule', 'application', '1.2', 'file', '/artifacts/schedules/fall_fertilizer_application_v1.2.pdf', 'internal', 'approved', '2025-09-15', 'en', (SELECT id FROM app.d_employee WHERE name = 'James Miller'), (SELECT id FROM app.d_employee WHERE name = 'James Miller'), '["fertilizer", "schedule", "application", "fall"]', '{"fertilizer_types": ["fall_blend", "root_stimulator", "potassium_boost"], "application_windows": ["early_fall", "mid_fall", "late_fall"], "weather_dependencies": true, "equipment_requirements": "detailed"}'),

('Winter Protection and Mulching Guide', 'Comprehensive guide for applying winter protection measures including mulching techniques, plant wrapping, and seasonal cleanup', 'GUIDE-WINTER-PROTECT-001', 'guide', 'protection', '1.1', 'file', '/artifacts/guides/winter_protection_mulching_v1.1.pdf', 'internal', 'approved', '2025-09-18', 'en', (SELECT id FROM app.d_employee WHERE name = 'James Miller'), (SELECT id FROM app.d_employee WHERE name = 'James Miller'), '["winter_protection", "mulching", "guide", "seasonal"]', '{"protection_methods": ["mulching", "wrapping", "windscreens"], "mulch_types": ["hardwood", "leaf_mold", "pine_needles"], "application_depth": "2_to_4_inches", "timing": "before_first_hard_frost"}'),

('Campaign Progress Tracking Dashboard', 'Digital dashboard template for tracking campaign progress including task completion, budget utilization, and client satisfaction metrics', 'DASHBOARD-PROGRESS-001', 'tool', 'dashboard', '1.0', 'digital', '/artifacts/tools/campaign_progress_dashboard_v1.0.xlsx', 'internal', 'approved', '2025-09-20', 'en', (SELECT id FROM app.d_employee WHERE name = 'James Miller'), (SELECT id FROM app.d_employee WHERE name = 'James Miller'), '["dashboard", "progress", "tracking", "campaign"]', '{"metrics_tracked": ["task_completion", "budget_utilization", "client_satisfaction", "revenue"], "update_frequency": "daily", "automated_alerts": true, "visual_reporting": "charts_and_graphs"}'),

('Safety Protocols for Fall Landscaping Operations', 'Specific safety protocols and procedures for fall landscaping operations including equipment safety, weather considerations, and emergency procedures', 'PROTOCOL-SAFETY-FALL-001', 'procedure', 'safety', '1.0', 'file', '/artifacts/procedures/fall_landscaping_safety_v1.0.pdf', 'internal', 'approved', '2025-08-28', 'en', (SELECT id FROM app.d_employee WHERE name = 'James Miller'), (SELECT id FROM app.d_employee WHERE name = 'James Miller'), '["safety", "protocol", "fall_landscaping", "emergency"]', '{"safety_areas": ["equipment_operation", "weather_conditions", "chemical_handling", "client_property"], "ppe_requirements": "detailed", "emergency_contacts": true, "incident_reporting": "procedures_included"}');