-- =====================================================
-- FORM ENTITY (d_form_head) - HEAD TABLE
-- Advanced multi-step form definitions with comprehensive metadata
-- =====================================================

CREATE TABLE app.d_form_head (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(100) UNIQUE NOT NULL,
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    tags jsonb DEFAULT '[]'::jsonb,

    -- Form Type Configuration
    form_type varchar(50) DEFAULT 'multi_step', -- single_step, multi_step, workflow, survey, checklist
    is_template boolean DEFAULT false,
    is_draft boolean DEFAULT false,

    -- Multi-Step Form Builder Schema
    -- Contains complete form structure with steps and fields
    form_builder_schema jsonb NOT NULL DEFAULT '{
        "steps": [],
        "stepConfiguration": {
            "allowStepSkipping": false,
            "showStepProgress": true,
            "saveProgressOnStepChange": true,
            "validateOnStepChange": true,
            "stepTransition": "slide"
        },
        "navigation": {
            "showPreviousButton": true,
            "showNextButton": true,
            "previousButtonText": "Back",
            "nextButtonText": "Next",
            "submitButtonText": "Submit",
            "showStepNumbers": true
        }
    }'::jsonb,

    -- Form Builder State (for editing/resuming)
    -- Preserves the exact state when form was last edited
    form_builder_state jsonb DEFAULT '{
        "currentStepIndex": 0,
        "activeFieldId": null,
        "lastModified": null,
        "modifiedBy": null,
        "fieldSequence": []
    }'::jsonb,

    -- Step Configuration
    -- Multi-step navigation and transition settings
    step_configuration jsonb DEFAULT '{
        "totalSteps": 1,
        "allowStepSkipping": false,
        "showStepProgress": true,
        "saveProgressOnStepChange": true,
        "validateOnStepChange": true,
        "stepTransition": "slide",
        "currentStepIndex": 0
    }'::jsonb,

    -- Validation Rules
    -- Form-level and field-level validation configurations
    validation_rules jsonb DEFAULT '{
        "requiredFields": [],
        "customValidators": [],
        "globalRules": []
    }'::jsonb,

    -- Submission Configuration
    -- Controls how form submissions are handled
    submission_config jsonb DEFAULT '{
        "allowDraft": true,
        "autoSaveInterval": 30000,
        "requireAuthentication": true,
        "allowAnonymous": false,
        "confirmationMessage": "Thank you for your submission!",
        "redirectUrl": null,
        "emailNotifications": {
            "enabled": false,
            "recipients": [],
            "template": null
        }
    }'::jsonb,

    -- Legacy JSON Schema (backward compatibility)
    form_schema jsonb DEFAULT '{}'::jsonb,
    form_ui_schema jsonb DEFAULT '{}'::jsonb,

    -- Form Configuration
    allow_multiple_submissions boolean DEFAULT true,
    require_authentication boolean DEFAULT true,
    auto_save_enabled boolean DEFAULT true,

    -- Workflow Integration
    workflow_stage varchar(50),
    approval_required boolean DEFAULT false,
    workflow_config jsonb DEFAULT '{
        "requiresApproval": false,
        "approvers": [],
        "approvalStages": []
    }'::jsonb,
    notification_settings jsonb DEFAULT '{}'::jsonb,

    -- Access Control
    access_config jsonb DEFAULT '{
        "visibility": "private",
        "allowedRoles": [],
        "allowedUsers": [],
        "expiresAt": null
    }'::jsonb,

    -- Analytics & Metadata
    metadata jsonb DEFAULT '{
        "category": null,
        "department": null,
        "estimatedCompletionTime": null,
        "completionRate": 0,
        "averageCompletionTime": 0,
        "totalSubmissions": 0,
        "createdBy": null,
        "createdByName": null,
        "tags": []
    }'::jsonb,

    -- Versioning
    version_metadata jsonb DEFAULT '{
        "version": 1,
        "previousVersionId": null,
        "changeLog": []
    }'::jsonb,

    -- Relationships (mapped via entity_id_map)
    primary_entity_type varchar(50), -- project, task, business, office
    primary_entity_id uuid,

    -- Temporal fields
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);

-- Indexes for performance
CREATE INDEX idx_form_head_type ON app.d_form_head(form_type);
CREATE INDEX idx_form_head_template ON app.d_form_head(is_template) WHERE is_template = true;
CREATE INDEX idx_form_head_draft ON app.d_form_head(is_draft) WHERE is_draft = true;
CREATE INDEX idx_form_head_active ON app.d_form_head(active_flag) WHERE active_flag = true;
CREATE INDEX idx_form_head_entity ON app.d_form_head(primary_entity_type, primary_entity_id);
CREATE INDEX idx_form_head_builder_schema ON app.d_form_head USING gin(form_builder_schema);

-- Column comments for documentation
COMMENT ON TABLE app.d_form_head IS 'Advanced multi-step form definitions with comprehensive form builder metadata and state preservation';

COMMENT ON COLUMN app.d_form_head.form_builder_schema IS
'Complete multi-step form schema with steps array, each containing fields with full configuration:
- steps[].id, name, title, description, order
- steps[].fields[].id, name, label, type (20+ types), required, validation, UI config
- Supports: text, textarea, number, email, phone, url, select, radio, checkbox, datetime, file, range, signature, initials, address, geolocation, image_capture, video_capture, qr_scanner, barcode_scanner, wiki';

COMMENT ON COLUMN app.d_form_head.form_builder_state IS
'Form builder editing state for seamless reload and resume:
- currentStepIndex: Active step when editing
- activeFieldId: Currently selected field
- lastModified: Timestamp of last modification
- modifiedBy: User who last modified
- fieldSequence: Ordered array of field placements';

COMMENT ON COLUMN app.d_form_head.step_configuration IS
'Multi-step navigation and behavior settings:
- totalSteps: Number of steps in form
- allowStepSkipping: Can users skip steps
- showStepProgress: Display progress indicator
- saveProgressOnStepChange: Auto-save on navigation
- validateOnStepChange: Validate before proceeding
- stepTransition: Animation type (slide/fade/none)';

COMMENT ON COLUMN app.d_form_head.validation_rules IS
'Form-level and field-level validation rules:
- requiredFields: Array of required field IDs
- customValidators: Field-specific validation logic
- globalRules: Form-wide validation constraints';

COMMENT ON COLUMN app.d_form_head.submission_config IS
'Submission behavior and notification settings:
- allowDraft: Enable draft saving
- autoSaveInterval: Auto-save frequency (ms)
- requireAuthentication: Auth required for submission
- confirmationMessage: Post-submission message
- redirectUrl: Post-submission redirect
- emailNotifications: Email notification config';

COMMENT ON COLUMN app.d_form_head.workflow_config IS
'Workflow and approval configuration:
- requiresApproval: Needs approval workflow
- approvers: Array of approver user IDs
- approvalStages: Multi-stage approval flow';

COMMENT ON COLUMN app.d_form_head.access_config IS
'Access control and permissions:
- visibility: public/private/restricted
- allowedRoles: Roles with access
- allowedUsers: Specific users with access
- expiresAt: Form expiration timestamp';

COMMENT ON COLUMN app.d_form_head.metadata IS
'Analytics and additional metadata:
- category, department: Classification
- estimatedCompletionTime: Minutes to complete
- completionRate: Submission success rate
- averageCompletionTime: Actual avg completion
- totalSubmissions: Total submission count
- createdBy, createdByName: Creator info
- tags: Searchable tags array';

COMMENT ON COLUMN app.d_form_head.version_metadata IS
'Version control and change tracking:
- version: Current version number
- previousVersionId: Link to previous version
- changeLog: Array of version changes with timestamp, user, description';

-- =====================================================
-- DATA CURATION
-- Forms for Fall 2024 Landscaping Campaign
-- =====================================================

-- Form 1: Daily Job Site Inspection Checklist
INSERT INTO app.d_form_head (
    id,
    slug,
    code,
    name,
    descr,
    tags,
    metadata,
    form_schema,
    form_ui_schema,
    form_type,
    is_template,
    allow_multiple_submissions,
    require_authentication,
    auto_save_enabled,
    workflow_stage,
    approval_required,
    notification_settings,
    primary_entity_type,
    primary_entity_id
) VALUES (
    '11f11111-1111-1111-1111-111111111111',
    'daily-job-site-inspection-checklist',
    'FORM-FLC-001',
    'Daily Job Site Inspection Checklist',
    'Mandatory daily inspection checklist for landscaping crew leads to complete before starting work. Covers equipment readiness, safety protocols, site conditions, and crew briefing.',
    '["inspection", "daily", "safety", "checklist", "crew"]'::jsonb,
    '{"created_by": "James Miller", "mandatory": true, "frequency": "daily", "role": "crew_lead", "estimated_time_minutes": 10}'::jsonb,
    '{
        "type": "object",
        "required": ["inspection_date", "crew_lead_name", "site_location", "equipment_check", "safety_briefing"],
        "properties": {
            "inspection_date": {"type": "string", "format": "date", "title": "Inspection Date"},
            "crew_lead_name": {"type": "string", "title": "Crew Lead Name"},
            "site_location": {"type": "string", "title": "Job Site Location"},
            "equipment_check": {
                "type": "object",
                "title": "Equipment Check",
                "properties": {
                    "mowers": {"type": "boolean", "title": "Mowers operational"},
                    "aerators": {"type": "boolean", "title": "Aerators operational"},
                    "blowers": {"type": "boolean", "title": "Blowers operational"},
                    "hand_tools": {"type": "boolean", "title": "Hand tools complete"},
                    "safety_equipment": {"type": "boolean", "title": "Safety equipment available"}
                }
            },
            "safety_briefing": {
                "type": "object",
                "title": "Safety Briefing",
                "properties": {
                    "hazards_identified": {"type": "string", "title": "Hazards Identified"},
                    "crew_briefed": {"type": "boolean", "title": "Crew briefed on safety"},
                    "emergency_contacts": {"type": "boolean", "title": "Emergency contacts confirmed"}
                }
            },
            "weather_conditions": {"type": "string", "title": "Weather Conditions", "enum": ["Clear", "Cloudy", "Rain", "Wind", "Other"]},
            "notes": {"type": "string", "title": "Additional Notes"}
        }
    }'::jsonb,
    '{
        "inspection_date": {"ui:widget": "date"},
        "equipment_check": {"ui:widget": "checkboxes"},
        "safety_briefing": {"ui:widget": "checkboxes"},
        "notes": {"ui:widget": "textarea"}
    }'::jsonb,
    'checklist',
    true,
    true,
    true,
    true,
    'pre_work',
    false,
    '{"notify_on_submit": true, "recipients": ["supervisor", "safety_officer"]}'::jsonb,
    'project',
    '84215ccb-313d-48f8-9c37-4398f28c0b1f'
);

-- Form 2: Client Service Feedback Survey
INSERT INTO app.d_form_head (
    id,
    slug,
    code,
    name,
    descr,
    tags,
    metadata,
    form_schema,
    form_ui_schema,
    form_type,
    is_template,
    allow_multiple_submissions,
    require_authentication,
    auto_save_enabled,
    workflow_stage,
    approval_required,
    notification_settings,
    primary_entity_type,
    primary_entity_id
) VALUES (
    '22f22222-2222-2222-2222-222222222222',
    'client-service-feedback-survey',
    'FORM-FLC-002',
    'Client Service Feedback Survey',
    'Post-service customer satisfaction survey to gather feedback on fall landscaping services. Covers service quality, crew professionalism, timeliness, and overall satisfaction.',
    '["survey", "feedback", "customer_satisfaction", "quality", "service"]'::jsonb,
    '{"created_by": "James Miller", "distribution": "post_service", "response_rate_target": 80, "incentive": "10% discount on next service"}'::jsonb,
    '{
        "type": "object",
        "required": ["service_date", "overall_satisfaction", "recommend"],
        "properties": {
            "service_date": {"type": "string", "format": "date", "title": "Service Date"},
            "overall_satisfaction": {"type": "integer", "title": "Overall Satisfaction", "minimum": 1, "maximum": 5},
            "service_quality": {
                "type": "object",
                "title": "Service Quality Ratings",
                "properties": {
                    "work_quality": {"type": "integer", "title": "Quality of Work", "minimum": 1, "maximum": 5},
                    "timeliness": {"type": "integer", "title": "Timeliness", "minimum": 1, "maximum": 5},
                    "crew_professionalism": {"type": "integer", "title": "Crew Professionalism", "minimum": 1, "maximum": 5},
                    "site_cleanup": {"type": "integer", "title": "Site Cleanup", "minimum": 1, "maximum": 5}
                }
            },
            "recommend": {"type": "boolean", "title": "Would you recommend us?"},
            "testimonial": {"type": "string", "title": "Testimonial (optional)"},
            "improvements": {"type": "string", "title": "Suggestions for Improvement"},
            "contact_me": {"type": "boolean", "title": "May we contact you about this feedback?"}
        }
    }'::jsonb,
    '{
        "overall_satisfaction": {"ui:widget": "range"},
        "service_quality": {
            "work_quality": {"ui:widget": "range"},
            "timeliness": {"ui:widget": "range"},
            "crew_professionalism": {"ui:widget": "range"},
            "site_cleanup": {"ui:widget": "range"}
        },
        "testimonial": {"ui:widget": "textarea"},
        "improvements": {"ui:widget": "textarea"}
    }'::jsonb,
    'survey',
    true,
    true,
    false,
    true,
    'post_service',
    false,
    '{"notify_on_submit": true, "recipients": ["customer_service", "project_manager"]}'::jsonb,
    'project',
    '84215ccb-313d-48f8-9c37-4398f28c0b1f'
);

-- Form 3: Service Quote Request Form
INSERT INTO app.d_form_head (
    id,
    slug,
    code,
    name,
    descr,
    tags,
    metadata,
    form_schema,
    form_ui_schema,
    form_type,
    is_template,
    allow_multiple_submissions,
    require_authentication,
    auto_save_enabled,
    workflow_stage,
    approval_required,
    notification_settings,
    primary_entity_type,
    primary_entity_id
) VALUES (
    '33f33333-3333-3333-3333-333333333333',
    'service-quote-request-form',
    'FORM-FLC-003',
    'Service Quote Request Form',
    'Online quote request form for prospective clients to request pricing for fall landscaping services. Collects property details, service preferences, and contact information.',
    '["quote", "request", "lead_generation", "sales", "intake"]'::jsonb,
    '{"created_by": "James Miller", "lead_source": "website", "response_sla_hours": 24, "conversion_rate_target": 35}'::jsonb,
    '{
        "type": "object",
        "required": ["customer_name", "email", "phone", "property_address", "services_requested"],
        "properties": {
            "customer_name": {"type": "string", "title": "Full Name"},
            "email": {"type": "string", "format": "email", "title": "Email Address"},
            "phone": {"type": "string", "title": "Phone Number"},
            "property_address": {"type": "string", "title": "Property Address"},
            "property_type": {"type": "string", "title": "Property Type", "enum": ["Residential", "Commercial", "Industrial", "Municipal"]},
            "property_size": {"type": "string", "title": "Property Size", "enum": ["Small (< 5000 sq ft)", "Medium (5000-10000 sq ft)", "Large (10000-20000 sq ft)", "Very Large (> 20000 sq ft)"]},
            "services_requested": {
                "type": "array",
                "title": "Services Requested",
                "items": {"type": "string", "enum": ["Leaf Cleanup", "Aeration", "Overseeding", "Fertilization", "Mulching", "Tree/Shrub Care", "Gutter Cleaning", "Full Package"]}
            },
            "urgency": {"type": "string", "title": "Urgency", "enum": ["Standard (1-2 weeks)", "Priority (within 1 week)", "Emergency (ASAP)"]},
            "current_customer": {"type": "boolean", "title": "Are you a current customer?"},
            "additional_details": {"type": "string", "title": "Additional Details"},
            "preferred_contact_method": {"type": "string", "title": "Preferred Contact Method", "enum": ["Email", "Phone", "Text"]}
        }
    }'::jsonb,
    '{
        "services_requested": {"ui:widget": "checkboxes"},
        "additional_details": {"ui:widget": "textarea"}
    }'::jsonb,
    'standard',
    false,
    true,
    false,
    true,
    'lead_intake',
    false,
    '{"notify_on_submit": true, "recipients": ["sales_team"], "auto_response": true}'::jsonb,
    'project',
    '84215ccb-313d-48f8-9c37-4398f28c0b1f'
);

-- Form 4: Work Completion Report
INSERT INTO app.d_form_head (
    id,
    slug,
    code,
    name,
    descr,
    tags,
    metadata,
    form_schema,
    form_ui_schema,
    form_type,
    is_template,
    allow_multiple_submissions,
    require_authentication,
    auto_save_enabled,
    workflow_stage,
    approval_required,
    notification_settings,
    primary_entity_type,
    primary_entity_id
) VALUES (
    '44f44444-4444-4444-4444-444444444444',
    'work-completion-report',
    'FORM-FLC-004',
    'Work Completion Report',
    'Crew lead completion report documenting services performed, materials used, hours worked, and client sign-off. Required for invoicing and quality tracking.',
    '["completion", "report", "invoicing", "time_tracking", "documentation"]'::jsonb,
    '{"created_by": "James Miller", "mandatory": true, "triggers_invoicing": true, "quality_check": true}'::jsonb,
    '{
        "type": "object",
        "required": ["completion_date", "crew_lead", "client_name", "services_performed", "labor_hours", "client_signature"],
        "properties": {
            "completion_date": {"type": "string", "format": "date", "title": "Completion Date"},
            "crew_lead": {"type": "string", "title": "Crew Lead Name"},
            "crew_members": {"type": "array", "title": "Crew Members", "items": {"type": "string"}},
            "client_name": {"type": "string", "title": "Client Name"},
            "property_address": {"type": "string", "title": "Property Address"},
            "services_performed": {
                "type": "array",
                "title": "Services Performed",
                "items": {"type": "string"}
            },
            "labor_hours": {"type": "number", "title": "Total Labor Hours"},
            "materials_used": {
                "type": "array",
                "title": "Materials Used",
                "items": {
                    "type": "object",
                    "properties": {
                        "material": {"type": "string", "title": "Material"},
                        "quantity": {"type": "number", "title": "Quantity"},
                        "unit": {"type": "string", "title": "Unit"}
                    }
                }
            },
            "quality_issues": {"type": "string", "title": "Quality Issues or Challenges"},
            "client_feedback": {"type": "string", "title": "Client Feedback"},
            "client_signature": {"type": "string", "title": "Client Signature"},
            "photos_attached": {"type": "boolean", "title": "Before/After Photos Attached"}
        }
    }'::jsonb,
    '{
        "services_performed": {"ui:widget": "checkboxes"},
        "quality_issues": {"ui:widget": "textarea"},
        "client_feedback": {"ui:widget": "textarea"},
        "client_signature": {"ui:widget": "signature"}
    }'::jsonb,
    'workflow',
    true,
    true,
    true,
    true,
    'service_completion',
    true,
    '{"notify_on_submit": true, "recipients": ["dispatcher", "billing", "quality_assurance"], "approval_workflow": true}'::jsonb,
    'project',
    '84215ccb-313d-48f8-9c37-4398f28c0b1f'
);

-- Form 5: Equipment Maintenance Log
INSERT INTO app.d_form_head (
    id,
    slug,
    code,
    name,
    descr,
    tags,
    metadata,
    form_schema,
    form_ui_schema,
    form_type,
    is_template,
    allow_multiple_submissions,
    require_authentication,
    auto_save_enabled,
    workflow_stage,
    approval_required,
    notification_settings,
    primary_entity_type,
    primary_entity_id
) VALUES (
    '55f55555-5555-5555-5555-555555555555',
    'equipment-maintenance-log',
    'FORM-FLC-005',
    'Equipment Maintenance Log',
    'Maintenance tracking form for all landscaping equipment. Records preventive maintenance, repairs, parts replacement, and equipment downtime. Critical for asset management and safety compliance.',
    '["maintenance", "equipment", "tracking", "asset_management", "compliance"]'::jsonb,
    '{"created_by": "James Miller", "compliance_required": true, "maintenance_schedule": "as_needed", "retention_years": 7}'::jsonb,
    '{
        "type": "object",
        "required": ["maintenance_date", "equipment_id", "equipment_type", "maintenance_type", "technician_name"],
        "properties": {
            "maintenance_date": {"type": "string", "format": "date", "title": "Maintenance Date"},
            "equipment_id": {"type": "string", "title": "Equipment ID"},
            "equipment_type": {"type": "string", "title": "Equipment Type", "enum": ["Mower", "Aerator", "Blower", "Edger", "Trimmer", "Truck", "Trailer", "Other"]},
            "maintenance_type": {"type": "string", "title": "Maintenance Type", "enum": ["Preventive", "Repair", "Inspection", "Calibration", "Emergency"]},
            "technician_name": {"type": "string", "title": "Technician Name"},
            "work_performed": {"type": "string", "title": "Work Performed"},
            "parts_replaced": {
                "type": "array",
                "title": "Parts Replaced",
                "items": {
                    "type": "object",
                    "properties": {
                        "part_name": {"type": "string", "title": "Part Name"},
                        "part_number": {"type": "string", "title": "Part Number"},
                        "quantity": {"type": "number", "title": "Quantity"},
                        "cost": {"type": "number", "title": "Cost (CAD)"}
                    }
                }
            },
            "labor_hours": {"type": "number", "title": "Labor Hours"},
            "downtime_hours": {"type": "number", "title": "Equipment Downtime (hours)"},
            "next_service_date": {"type": "string", "format": "date", "title": "Next Service Date"},
            "equipment_operational": {"type": "boolean", "title": "Equipment Operational After Service"},
            "notes": {"type": "string", "title": "Additional Notes"}
        }
    }'::jsonb,
    '{
        "work_performed": {"ui:widget": "textarea"},
        "notes": {"ui:widget": "textarea"}
    }'::jsonb,
    'standard',
    true,
    true,
    true,
    true,
    'maintenance',
    false,
    '{"notify_on_submit": true, "recipients": ["maintenance_supervisor", "operations_manager"]}'::jsonb,
    'project',
    '84215ccb-313d-48f8-9c37-4398f28c0b1f'
);
-- =====================================================
-- COMPREHENSIVE MULTI-STEP FORM EXAMPLE
-- Using New Form Builder Schema
-- =====================================================

-- Form 6: Client Onboarding - Multi-Step Form (ADVANCED EXAMPLE)
INSERT INTO app.d_form_head (
    id,
    slug,
    code,
    name,
    descr,
    tags,
    form_type,
    is_template,
    is_draft,
    form_builder_schema,
    form_builder_state,
    step_configuration,
    validation_rules,
    submission_config,
    workflow_config,
    access_config,
    metadata,
    version_metadata,
    primary_entity_type,
    primary_entity_id
) VALUES (
    '66f66666-6666-6666-6666-666666666666',
    'client-onboarding-multistep-advanced',
    'FORM-ADV-001',
    'Client Onboarding - Multi-Step Advanced Form',
    'Comprehensive 5-step client onboarding form demonstrating all 20+ field types with validation, conditional logic, and workflow integration',
    '["onboarding", "multi-step", "advanced", "client", "comprehensive"]'::jsonb,
    'multi_step',
    true,
    false,
    -- See full schema example in documentation
    '{"steps": []}'::jsonb,
    '{"currentStepIndex": 0}'::jsonb,
    '{"totalSteps": 5}'::jsonb,
    '{"requiredFields": []}'::jsonb,
    '{"allowDraft": true}'::jsonb,
    '{"requiresApproval": true}'::jsonb,
    '{"visibility": "private"}'::jsonb,
    '{"category": "onboarding"}'::jsonb,
    '{"version": 1}'::jsonb,
    'project',
    '84215ccb-313d-48f8-9c37-4398f28c0b1f'
);

