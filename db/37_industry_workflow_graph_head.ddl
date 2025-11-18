-- =====================================================
-- WORKFLOW TEMPLATE ENTITY (d_industry_workflow_graph_head) - CORE ENTITY
-- Industry-specific workflow state graph templates for business process lifecycles
-- =====================================================
--
-- SEMANTICS:
-- Workflow templates define complete business process lifecycles as directed graphs (DAGs).
-- Each industry (home services, construction, HVAC, plumbing) has unique workflows defining
-- the sequence of business events and which entities get created at each stage.
-- Examples: Lead → Customer → Quote → Work Order → Task → Invoice → Payment
--
-- OPERATIONS:
-- • CREATE: POST /api/v1/workflow-template, INSERT with version=1, active_flag=true
-- • UPDATE: PUT /api/v1/workflow-template/{id}, same ID, version++, updated_ts refreshes
-- • DELETE: DELETE /api/v1/workflow-template/{id}, active_flag=false, to_ts=now() (soft delete)
-- • LIST: GET /api/v1/workflow-template, filters by industry_sector/active_workflow_flag, RBAC enforced
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • Referenced by: d_industry_workflow_graph_data (workflow instances)
-- • Referenced by: f_industry_workflow_events (event tracking)
-- • Semantic link to: setting_datalabel (industry_sector values)
--
-- WORKFLOW_GRAPH STRUCTURE (JSONB):
-- Array of state nodes defining the business process:
-- [{
--   "id": 0,                          // Unique state ID within workflow
--   "name": "customer_onboard",       // Descriptive state name
--   "descr": "Customer onboarding",   // Human-readable description
--   "parent_ids": [],               // Previous state IDs (null for start state, single ID or array)
--   "child_ids": [1, 2],              // Next possible state IDs
--   "entity_name": "cust",             // Which entity gets created at this state
--   "terminal_flag": false            // Is this an end state?
-- }]
--
-- =====================================================

CREATE TABLE app.industry_workflow_graph_head (
    -- Standard identity fields
    id uuid DEFAULT gen_random_uuid(),
    code varchar(50),
    name text,
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,

    -- Industry classification
    industry_sector text,
    industry_subsector text,

    -- Workflow graph structure
    workflow_graph jsonb,

    -- Workflow configuration
    workflow_version varchar(20) DEFAULT '1.0',
    active_workflow_flag boolean DEFAULT true,
    default_workflow_flag boolean DEFAULT false,

    -- Performance metrics
    avg_duration_days integer,
    success_rate_pct decimal(5,2),

    -- Audit fields
    created_by_employee_id uuid,
    updated_by_employee_id uuid,

    -- Standard temporal fields
    active_flag boolean DEFAULT true,
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);

-- =====================================================
-- DATA CURATION:
-- =====================================================

-- Home Services Standard Workflow
INSERT INTO app.d_industry_workflow_graph_head (
    id,
    code,
    name,
    descr,
    industry_sector,
    industry_subsector,
    workflow_version,
    active_workflow_flag,
    default_workflow_flag,
    avg_duration_days,
    success_rate_pct,
    workflow_graph,
    created_by_employee_id,
    metadata
) VALUES (
    '550e8400-e29b-41d4-a716-446655440001',
    'HS_STD',
    'Home Services - Standard Project',
    'Standard workflow for home services projects covering the complete customer journey from lead capture through payment collection. Includes quote approval, work order creation, task execution, and invoicing stages.',
    'home_services',
    'general',
    '1.0',
    true,
    true,
    14,
    87.50,
    '[
        {"id": 0, "entity_name": "cust", "parent_ids": []},
        {"id": 1, "entity_name": "quote", "parent_ids": [0]},
        {"id": 2, "entity_name": "work_order", "parent_ids": [1]},
        {"id": 3, "entity_name": "task", "parent_ids": [2]},
        {"id": 4, "entity_name": "invoice", "parent_ids": [3]}
    ]'::jsonb,
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '{"tags": ["standard", "residential", "commercial"], "industry_type": "multi_service"}'::jsonb
);

-- HVAC Emergency Service Workflow
INSERT INTO app.d_industry_workflow_graph_head (
    id,
    code,
    name,
    descr,
    industry_sector,
    industry_subsector,
    workflow_version,
    active_workflow_flag,
    default_workflow_flag,
    avg_duration_days,
    success_rate_pct,
    workflow_graph,
    created_by_employee_id,
    metadata
) VALUES (
    '550e8400-e29b-41d4-a716-446655440002',
    'HVAC_EMERG',
    'HVAC - Emergency Service',
    'Fast-track workflow for HVAC emergency service calls requiring immediate dispatch and same-day resolution. Optimized for rapid response with verbal approvals and on-site payment collection.',
    'hvac',
    'emergency_service',
    '1.0',
    true,
    false,
    1,
    92.30,
    '[
        {
            "id": 0,
            "name": "emergency_call",
            "descr": "Emergency service call received",
            "parent_ids": [],
            "child_ids": [1],
            "entity_name": "cust",
            "terminal_flag": false
        },
        {
            "id": 1,
            "name": "dispatch_immediate",
            "descr": "Technician dispatched immediately",
            "parent_ids": [0],
            "child_ids": [2],
            "entity_name": "work_order",
            "terminal_flag": false
        },
        {
            "id": 2,
            "name": "on_site_diagnosis",
            "descr": "Technician diagnoses issue on-site",
            "parent_ids": [1],
            "child_ids": [3, 98],
            "entity_name": "task",
            "terminal_flag": false
        },
        {
            "id": 3,
            "name": "verbal_approval",
            "descr": "Customer approves repair verbally",
            "parent_ids": [2],
            "child_ids": [4],
            "entity_name": "quote",
            "terminal_flag": false
        },
        {
            "id": 4,
            "name": "repair_in_progress",
            "descr": "Repair work in progress",
            "parent_ids": [3],
            "child_ids": [5],
            "entity_name": "task",
            "terminal_flag": false
        },
        {
            "id": 5,
            "name": "repair_completed",
            "descr": "Repair completed and verified",
            "parent_ids": [4],
            "child_ids": [6],
            "entity_name": "work_order",
            "terminal_flag": false
        },
        {
            "id": 6,
            "name": "invoice_on_site",
            "descr": "Invoice generated on-site",
            "parent_ids": [5],
            "child_ids": [7],
            "entity_name": "invoice",
            "terminal_flag": false
        },
        {
            "id": 7,
            "name": "payment_collected",
            "descr": "Payment collected, service complete",
            "parent_ids": [6],
            "child_ids": [],
            "entity_name": "invoice",
            "terminal_flag": true
        },
        {
            "id": 98,
            "name": "parts_required",
            "descr": "Parts must be ordered, escalate to standard workflow",
            "parent_ids": [2],
            "child_ids": [],
            "entity_name": "task",
            "terminal_flag": true
        }
    ]'::jsonb,
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '{"tags": ["emergency", "same_day", "high_priority"], "response_time_minutes": 60}'::jsonb
);

-- Construction - New Home Build Workflow
INSERT INTO app.d_industry_workflow_graph_head (
    id,
    code,
    name,
    descr,
    industry_sector,
    industry_subsector,
    workflow_version,
    active_workflow_flag,
    default_workflow_flag,
    avg_duration_days,
    success_rate_pct,
    workflow_graph,
    created_by_employee_id,
    metadata
) VALUES (
    '550e8400-e29b-41d4-a716-446655440003',
    'CONST_HOME',
    'Construction - New Home Build',
    'Complete workflow for new residential home construction from contract signing through occupancy permit. Includes design, permitting, foundation, framing, MEP installation, finishing, and final inspection stages.',
    'construction',
    'residential_new_build',
    '1.0',
    true,
    true,
    180,
    78.20,
    '[
        {
            "id": 0,
            "name": "client_contract",
            "descr": "Client signs construction contract",
            "parent_ids": [],
            "child_ids": [1],
            "entity_name": "cust",
            "terminal_flag": false
        },
        {
            "id": 1,
            "name": "design_phase",
            "descr": "Architectural design and planning",
            "parent_ids": [0],
            "child_ids": [2],
            "entity_name": "project",
            "terminal_flag": false
        },
        {
            "id": 2,
            "name": "permit_application",
            "descr": "Building permits submitted",
            "parent_ids": [1],
            "child_ids": [3],
            "entity_name": "task",
            "terminal_flag": false
        },
        {
            "id": 3,
            "name": "permits_approved",
            "descr": "All permits received and approved",
            "parent_ids": [2],
            "child_ids": [4],
            "entity_name": "task",
            "terminal_flag": false
        },
        {
            "id": 4,
            "name": "foundation_work",
            "descr": "Foundation and site work",
            "parent_ids": [3],
            "child_ids": [5],
            "entity_name": "work_order",
            "terminal_flag": false
        },
        {
            "id": 5,
            "name": "framing_complete",
            "descr": "Structural framing completed",
            "parent_ids": [4],
            "child_ids": [6],
            "entity_name": "work_order",
            "terminal_flag": false
        },
        {
            "id": 6,
            "name": "mep_installation",
            "descr": "Mechanical, electrical, plumbing installation",
            "parent_ids": [5],
            "child_ids": [7],
            "entity_name": "work_order",
            "terminal_flag": false
        },
        {
            "id": 7,
            "name": "interior_finishing",
            "descr": "Drywall, flooring, painting, fixtures",
            "parent_ids": [6],
            "child_ids": [8],
            "entity_name": "work_order",
            "terminal_flag": false
        },
        {
            "id": 8,
            "name": "final_inspection",
            "descr": "Municipal final inspection",
            "parent_ids": [7],
            "child_ids": [9, 98],
            "entity_name": "task",
            "terminal_flag": false
        },
        {
            "id": 9,
            "name": "occupancy_permit",
            "descr": "Certificate of occupancy received",
            "parent_ids": [8],
            "child_ids": [10],
            "entity_name": "task",
            "terminal_flag": false
        },
        {
            "id": 10,
            "name": "handover_complete",
            "descr": "Keys handed to homeowner",
            "parent_ids": [9],
            "child_ids": [11],
            "entity_name": "project",
            "terminal_flag": false
        },
        {
            "id": 11,
            "name": "final_payment",
            "descr": "Final payment received, project complete",
            "parent_ids": [10],
            "child_ids": [],
            "entity_name": "invoice",
            "terminal_flag": true
        },
        {
            "id": 98,
            "name": "deficiency_repairs",
            "descr": "Inspection failed, repairs required, loop back",
            "parent_ids": [8],
            "child_ids": [8],
            "entity_name": "task",
            "terminal_flag": false
        }
    ]'::jsonb,
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '{"tags": ["construction", "new_build", "residential"], "permit_types": ["building", "electrical", "plumbing"]}'::jsonb
);

-- Plumbing - Standard Service Call
INSERT INTO app.d_industry_workflow_graph_head (
    id,
    code,
    name,
    descr,
    industry_sector,
    industry_subsector,
    workflow_version,
    active_workflow_flag,
    default_workflow_flag,
    avg_duration_days,
    success_rate_pct,
    workflow_graph,
    created_by_employee_id,
    metadata
) VALUES (
    '550e8400-e29b-41d4-a716-446655440004',
    'PLUMB_STD',
    'Plumbing - Standard Service',
    'Standard plumbing service workflow for scheduled repairs and installations. Covers initial call, on-site assessment, quote approval, repair execution, and payment collection.',
    'plumbing',
    'service_repair',
    '1.0',
    true,
    true,
    3,
    91.70,
    '[
        {
            "id": 0,
            "name": "service_call",
            "descr": "Customer calls for plumbing service",
            "parent_ids": [],
            "child_ids": [1],
            "entity_name": "cust",
            "terminal_flag": false
        },
        {
            "id": 1,
            "name": "appointment_scheduled",
            "descr": "Service appointment scheduled",
            "parent_ids": [0],
            "child_ids": [2],
            "entity_name": "work_order",
            "terminal_flag": false
        },
        {
            "id": 2,
            "name": "assessment_complete",
            "descr": "Plumber assesses issue on-site",
            "parent_ids": [1],
            "child_ids": [3],
            "entity_name": "task",
            "terminal_flag": false
        },
        {
            "id": 3,
            "name": "quote_provided",
            "descr": "Quote provided to customer",
            "parent_ids": [2],
            "child_ids": [4, 98],
            "entity_name": "quote",
            "terminal_flag": false
        },
        {
            "id": 4,
            "name": "quote_accepted",
            "descr": "Customer accepts quote",
            "parent_ids": [3],
            "child_ids": [5],
            "entity_name": "quote",
            "terminal_flag": false
        },
        {
            "id": 5,
            "name": "repair_complete",
            "descr": "Repair work completed",
            "parent_ids": [4],
            "child_ids": [6],
            "entity_name": "task",
            "terminal_flag": false
        },
        {
            "id": 6,
            "name": "invoice_sent",
            "descr": "Invoice sent to customer",
            "parent_ids": [5],
            "child_ids": [7],
            "entity_name": "invoice",
            "terminal_flag": false
        },
        {
            "id": 7,
            "name": "payment_complete",
            "descr": "Payment received, service complete",
            "parent_ids": [6],
            "child_ids": [],
            "entity_name": "invoice",
            "terminal_flag": true
        },
        {
            "id": 98,
            "name": "quote_declined",
            "descr": "Customer declined quote, no repair",
            "parent_ids": [3],
            "child_ids": [],
            "entity_name": "quote",
            "terminal_flag": true
        }
    ]'::jsonb,
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '{"tags": ["plumbing", "service", "scheduled"], "service_types": ["repair", "installation", "maintenance"]}'::jsonb
);
