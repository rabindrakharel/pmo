-- =====================================================
-- FORM ENTITY (d_form_head) - HEAD TABLE
-- Multi-step form definitions with JSONB schemas and public/internal URLs
-- =====================================================
--
-- SEMANTICS:
-- Forms are dynamic data collection templates with multi-step JSONB schemas.
-- Each form has stable UUID and TWO URLs: internal (auth required) and shared (public, 8-char code).
-- Updates are in-place (same ID, version++), enabling stable URLs while tracking schema evolution.
-- Submissions (d_form_data) reference form_id; old submissions preserve original schema structure.
--
-- OPERATIONS:
-- • CREATE: POST /api/v1/form, INSERT with version=1, generates internal + shared URLs
-- • UPDATE: PUT /api/v1/form/{id}, same ID, version++, form_schema updated, updated_ts refreshes
-- • DELETE: DELETE /api/v1/form/{id}, active_flag=false, to_ts=now() (soft delete, disables URLs)
-- • LIST: GET /api/v1/form, filters by form_type/active_flag, RBAC enforced
--
-- FORM SCHEMA STRUCTURE:
-- {
--   "steps": [
--     {
--       "id": "step-1", "name": "step_1", "title": "General Information",
--       "fields": [
--         {"name": "text_1760648879230", "label": "Text Input", "type": "text", "required": false},
--         {"name": "datatable_1760648887217", "type": "datatable", "dataTableColumns": [...]}
--       ]
--     }
--   ]
-- }
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • Parent: project (via metadata.primary_entity_id or entity_instance_link)
-- • Children: d_form_data (submissions), artifact (attachments)
--
-- URL ACCESS MODES:
-- • Internal URL (/form/{uuid}): Requires authentication, enables editing/management
-- • Shared URL (/form/{8-char-code}): Public presigned URL, anyone can submit, no auth
--
-- =====================================================

CREATE TABLE app.form_head (
    id uuid DEFAULT gen_random_uuid(),
    code varchar(50),   -- No unique constraint
    name varchar(200),
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    internal_url varchar(500),   -- Internal form URL: /form/{id} (authenticated access)
    shared_url varchar(500),     -- Public shared URL: /form/{8-char-random} (presigned, no auth required)
    -- Form Type
    form_type varchar(50) DEFAULT 'multi_step',

    -- Parent entity linkage (for entity_instance_link population)
    primary_entity_code varchar(50),  -- Parent entity type (project, task, etc.)
    primary_entity_id uuid,           -- Parent entity instance ID

    -- Multi-Step Form Schema (JSONB)
    -- Structure: {"steps": [{"id":"step-1","name":"step_1","title":"Info","fields":[{...}]}]}
    form_schema jsonb DEFAULT '{"steps": []}'::jsonb,

    -- Temporal Tracking (NOT for archival, just audit)
    from_ts timestamptz DEFAULT now(),      -- Original creation time (never changes)
    to_ts timestamptz,                      -- Reserved (unused in current implementation)
    active_flag boolean DEFAULT true,       -- Soft delete flag
    created_ts timestamptz DEFAULT now(),   -- Original creation time
    updated_ts timestamptz DEFAULT now(),   -- Last modification time

    -- In-Place Version Counter
    -- Increments on schema changes, ID stays same
    version integer DEFAULT 1
);

-- =====================================================
-- DATA CURATION:
-- =====================================================

-- Landscaping Form (linked to Fall Campaign Marketing Strategy task)
INSERT INTO app.form_head (
    id,
    code,
    name,
    descr,
    internal_url,
    shared_url,
    primary_entity_code,
    primary_entity_id,
    form_type,
    form_schema,
    version,
    active_flag
) VALUES (
    'ee8a6cfd-9d31-4705-b8f3-ad2d5589802c',
    'FORM-LAND-001',
    'Landscaping Service Request Form',
    'Customer intake form for landscaping service requests - captures property details, service preferences, and scheduling',
    '/form/ee8a6cfd-9d31-4705-b8f3-ad2d5589802c',
    '/form/aB3xK9mZ',
    'task',
    'b1111111-1111-1111-1111-111111111111',  -- Fall Campaign Marketing Strategy task
    'multi_step',
    '{
        "steps": [
            {
                "id": "step-1",
                "name": "step_1",
                "title": "Customer Information",
                "description": "Basic contact and property details",
                "fields": [
                    {"name": "customer_name", "label": "Customer Name", "type": "text", "required": true},
                    {"name": "email", "label": "Email Address", "type": "email", "required": true},
                    {"name": "phone", "label": "Phone Number", "type": "text", "required": false},
                    {"name": "property_address", "label": "Property Address", "type": "textarea", "required": true}
                ]
            },
            {
                "id": "step-2",
                "name": "step_2",
                "title": "Service Details",
                "description": "Landscaping service preferences",
                "fields": [
                    {"name": "service_type", "label": "Service Type", "type": "select", "required": true, "options": ["Fall Cleanup", "Winterization", "Spring Prep", "Full Season"]},
                    {"name": "property_size", "label": "Property Size (sq ft)", "type": "number", "required": false},
                    {"name": "preferred_date", "label": "Preferred Service Date", "type": "date", "required": false},
                    {"name": "special_requests", "label": "Special Requests", "type": "textarea", "required": false}
                ]
            }
        ],
        "currentStepIndex": 0
    }'::jsonb,
    1,
    true
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    descr = EXCLUDED.descr,
    internal_url = EXCLUDED.internal_url,
    shared_url = EXCLUDED.shared_url,
    primary_entity_code = EXCLUDED.primary_entity_code,
    primary_entity_id = EXCLUDED.primary_entity_id,
    form_type = EXCLUDED.form_type,
    form_schema = EXCLUDED.form_schema,
    updated_ts = now();

-- PMO Vendor Evaluation Form (linked to PMO Software Vendor Evaluation task)
INSERT INTO app.form_head (
    id,
    code,
    name,
    descr,
    internal_url,
    shared_url,
    primary_entity_code,
    primary_entity_id,
    form_type,
    form_schema,
    version,
    active_flag
) VALUES (
    'ff8a7dfe-0e42-5816-c9g4-be3e6690913d',
    'FORM-PMO-001',
    'PMO Vendor Evaluation Scorecard',
    'Standardized evaluation form for scoring PMO software vendors on functionality, integration, cost, and implementation',
    '/form/ff8a7dfe-0e42-5816-c9g4-be3e6690913d',
    '/form/cD4yL2nR',
    'task',
    'a2222222-2222-2222-2222-222222222222',  -- PMO Software Vendor Evaluation task
    'multi_step',
    '{
        "steps": [
            {
                "id": "step-1",
                "name": "step_1",
                "title": "Vendor Information",
                "description": "Basic vendor details",
                "fields": [
                    {"name": "vendor_name", "label": "Vendor Name", "type": "text", "required": true},
                    {"name": "product_name", "label": "Product Name", "type": "text", "required": true},
                    {"name": "evaluator", "label": "Evaluator Name", "type": "text", "required": true},
                    {"name": "eval_date", "label": "Evaluation Date", "type": "date", "required": true}
                ]
            },
            {
                "id": "step-2",
                "name": "step_2",
                "title": "Scoring",
                "description": "Score each criteria (1-10)",
                "fields": [
                    {"name": "functionality_score", "label": "Functionality Score (1-10)", "type": "number", "required": true},
                    {"name": "integration_score", "label": "Integration Score (1-10)", "type": "number", "required": true},
                    {"name": "cost_score", "label": "Cost Score (1-10)", "type": "number", "required": true},
                    {"name": "implementation_score", "label": "Implementation Score (1-10)", "type": "number", "required": true},
                    {"name": "recommendation", "label": "Recommendation", "type": "select", "options": ["Strongly Recommend", "Recommend", "Neutral", "Not Recommended"]}
                ]
            }
        ],
        "currentStepIndex": 0
    }'::jsonb,
    1,
    true
);

-- Customer Service Feedback Form (linked to Customer Service Process Optimization task)
INSERT INTO app.form_head (
    id,
    code,
    name,
    descr,
    internal_url,
    shared_url,
    primary_entity_code,
    primary_entity_id,
    form_type,
    form_schema,
    version,
    active_flag
) VALUES (
    '11111111-aaaa-bbbb-cccc-dddddddddddd',
    'FORM-CSE-001',
    'Customer Service Feedback Survey',
    'Post-service feedback form to measure customer satisfaction and identify improvement areas',
    '/form/11111111-aaaa-bbbb-cccc-dddddddddddd',
    '/form/eF5zM3pQ',
    'task',
    'e1111111-1111-1111-1111-111111111111',  -- Customer Service Process Optimization task
    'multi_step',
    '{
        "steps": [
            {
                "id": "step-1",
                "name": "step_1",
                "title": "Service Information",
                "description": "Details about the service received",
                "fields": [
                    {"name": "service_date", "label": "Service Date", "type": "date", "required": true},
                    {"name": "service_type", "label": "Service Type", "type": "select", "options": ["HVAC", "Landscaping", "Property Maintenance", "Other"]},
                    {"name": "technician_name", "label": "Technician Name", "type": "text", "required": false}
                ]
            },
            {
                "id": "step-2",
                "name": "step_2",
                "title": "Satisfaction Rating",
                "description": "Rate your experience",
                "fields": [
                    {"name": "overall_satisfaction", "label": "Overall Satisfaction (1-5)", "type": "number", "required": true},
                    {"name": "response_time_rating", "label": "Response Time Rating (1-5)", "type": "number", "required": true},
                    {"name": "quality_rating", "label": "Service Quality Rating (1-5)", "type": "number", "required": true},
                    {"name": "would_recommend", "label": "Would Recommend", "type": "select", "options": ["Yes", "No", "Maybe"]},
                    {"name": "comments", "label": "Additional Comments", "type": "textarea", "required": false}
                ]
            }
        ],
        "currentStepIndex": 0
    }'::jsonb,
    1,
    true
);

-- HVAC Site Assessment Form (linked to Smart HVAC Market Research task)
INSERT INTO app.form_head (
    id,
    code,
    name,
    descr,
    internal_url,
    shared_url,
    primary_entity_code,
    primary_entity_id,
    form_type,
    form_schema,
    version,
    active_flag
) VALUES (
    '22222222-aaaa-bbbb-cccc-dddddddddddd',
    'FORM-HVAC-001',
    'HVAC Site Assessment Checklist',
    'On-site assessment form for evaluating HVAC system requirements and modernization opportunities',
    '/form/22222222-aaaa-bbbb-cccc-dddddddddddd',
    '/form/gH6aN4rS',
    'task',
    'c1111111-1111-1111-1111-111111111111',  -- Smart HVAC Market Research task
    'multi_step',
    '{
        "steps": [
            {
                "id": "step-1",
                "name": "step_1",
                "title": "Site Information",
                "description": "Basic site and building details",
                "fields": [
                    {"name": "site_address", "label": "Site Address", "type": "textarea", "required": true},
                    {"name": "building_type", "label": "Building Type", "type": "select", "options": ["Residential", "Commercial", "Industrial"]},
                    {"name": "building_size", "label": "Building Size (sq ft)", "type": "number", "required": true},
                    {"name": "year_built", "label": "Year Built", "type": "number", "required": false}
                ]
            },
            {
                "id": "step-2",
                "name": "step_2",
                "title": "Current System",
                "description": "Existing HVAC system details",
                "fields": [
                    {"name": "current_system_type", "label": "Current System Type", "type": "text", "required": true},
                    {"name": "system_age", "label": "System Age (years)", "type": "number", "required": false},
                    {"name": "smart_thermostat", "label": "Has Smart Thermostat", "type": "select", "options": ["Yes", "No"]},
                    {"name": "modernization_interest", "label": "Modernization Interest Level", "type": "select", "options": ["High", "Medium", "Low"]},
                    {"name": "notes", "label": "Assessment Notes", "type": "textarea", "required": false}
                ]
            }
        ],
        "currentStepIndex": 0
    }'::jsonb,
    1,
    true
);
