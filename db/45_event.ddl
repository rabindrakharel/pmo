-- =====================================================
-- EVENT (app.event)
-- Universal parent entity for all event-related linkages
-- =====================================================
--
-- SEMANTICS:
-- This table manages all events, meetings, and appointments in the system.
-- Event serves as a central entity that tracks WHAT is happening (via event_action_entity),
-- WHEN it happens (from_ts/to_ts), WHERE it happens (event_addr/venue_type),
-- WHO organized it (organizer_id/organizer_type), and WHO is involved (via d_entity_event_person_calendar).
--
-- BUSINESS CASE MODELING:
-- Events are modeled to capture three key relationships:
-- 1. ACTION ENTITY: What the event is ABOUT (event_action_entity_type + event_action_entity_id)
--    - Service appointment: event_action_entity_type='service', event_action_entity_id=service_id
--    - Task discussion: event_action_entity_type='task', event_action_entity_id=task_id
--    - Project meeting: event_action_entity_type='project', event_action_entity_id=project_id
--    - Quote review: event_action_entity_type='quote', event_action_entity_id=quote_id
--    - Product demo: event_action_entity_type='product', event_action_entity_id=product_id
--
-- 2. ORGANIZER: Who CREATED/ORGANIZED the event (organizer__employee_id)
--    - Employee organizer: organizer__employee_id=employee_id
--    - System-generated: organizer__employee_id can be NULL for automated events
--
-- 3. ATTENDEES: Who is INVOLVED in the event (via d_entity_event_person_calendar)
--    - Employees, customers, and clients with RSVP status tracking
--    - Attendees are linked separately from organizer
--
-- KEY CONCEPTS:
-- 1. ACTION-ORIENTED: event_action_entity captures the PRIMARY purpose/subject of the event
-- 2. TIME-BOUND: Every event has from_ts/to_ts defining when it occurs
-- 3. LOCATION-AWARE: event_addr stores physical address OR virtual meeting URL
-- 4. VENUE-CATEGORIZED: venue_type classifies the location (office, customer_site, warehouse, remote, etc.)
-- 5. PLATFORM-SPECIFIC: event_platform_provider_name identifies the platform (Zoom, Teams, office, etc.)
-- 6. ORGANIZER-TRACKED: organizer__employee_id captures which employee created/scheduled the event
--
-- USE CASES:
-- 1. CUSTOMER SERVICE APPOINTMENT:
--    - Customer self-schedules HVAC consultation
--    - event_action_entity_type='service', event_action_entity_id=hvac_service_id
--    - organizer__employee_id=assigned_technician_id
--    - Attendees: assigned technician (via d_entity_event_person_calendar)
--
-- 2. PROJECT REVIEW MEETING:
--    - Project manager schedules milestone review
--    - event_action_entity_type='project', event_action_entity_id=project_id
--    - organizer__employee_id=manager_id
--    - Attendees: team members, stakeholders
--
-- 3. TASK DISCUSSION:
--    - Team lead schedules task planning session
--    - event_action_entity_type='task', event_action_entity_id=task_id
--    - organizer__employee_id=team_lead_id
--    - Attendees: assigned employees
--
-- 4. QUOTE REVIEW:
--    - Sales rep schedules quote walkthrough with customer
--    - event_action_entity_type='quote', event_action_entity_id=quote_id
--    - organizer__employee_id=sales_rep_id
--    - Attendees: customer, approvers
--
-- 5. PRODUCT DEMO:
--    - Sales schedules product demonstration
--    - event_action_entity_type='product', event_action_entity_id=product_id
--    - organizer__employee_id=sales_rep_id
--    - Attendees: potential customers
--
-- WORKFLOW:
-- 1. CREATE EVENT: Define event details
--    - Set event_action_entity_type and event_action_entity_id (what the event is about)
--    - Set organizer__employee_id (who created/scheduled it)
--    - Set venue_type, event_addr, event_platform_provider_name (where/how)
--    - Set from_ts, to_ts, timezone (when)
--
-- 2. LINK ATTENDEES: Add entries to d_entity_event_person_calendar
--    - Track who is involved and their RSVP status
--    - Example: INSERT INTO d_entity_event_person_calendar (event_id, person_entity_type='employee', person_id=emp_id, event_rsvp_status='accepted')
--
-- 3. QUERY: Retrieve events by action entity, organizer, or attendees
--    - Find all events about a service: WHERE event_action_entity_type='service' AND event_action_entity_id=service_id
--    - Find all events organized by an employee: WHERE organizer__employee_id=emp_id
--    - Find all events involving a person: JOIN d_entity_event_person_calendar
--
-- 4. UPDATE: Modify event details
--    - Can change time, location, or action entity
--    - version++ and updated_ts refresh automatically
--
-- 5. CANCEL: Set active_flag=false to soft-delete the event
--    - RSVP records remain for historical tracking
--
-- OPERATIONS:
-- • CREATE: POST /api/v1/event, auto-grant Owner permission [5] to creator
-- • UPDATE: PUT /api/v1/event/{id}, same ID, version++, updated_ts refreshes
-- • DELETE: active_flag=false, to_ts=now() (soft delete)
-- • LIST: GET /api/v1/event, filters by event_type/platform, RBAC enforced
-- • LINK ENTITIES: Use entity_instance_link to establish event → entity relationships
-- • LINK PEOPLE: Use d_entity_event_person_calendar to track who is involved and their RSVP status
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • entity_instance_link: event (parent) → service, customer, task, project, business, meeting, employee, supplier, equipment, etc. (children)
-- • d_entity_event_person_calendar.event_id → d_event.id (tracks who is involved and RSVP status)
-- • event_metadata stores additional entity references as needed
--
-- INTEGRATION WITH OTHER TABLES:
-- • entity_instance_link: Tracks event as parent of other entities
--   Example: event → service, event → customer, event → task, event → project
-- • d_entity_event_person_calendar: Tracks which people are involved in the event
--   Example: event_id + employee_id + RSVP status
-- • d_entity: Event registered as entity type with potential child entities
--
-- EXAMPLES:
-- 1. HVAC Repair Event:
--    - d_event: event_id = 'evt-001', type='onsite', platform='office', from_ts='2025-11-10 14:00', to_ts='2025-11-10 16:00'
--    - entity_instance_link: (event='evt-001', child_type='service', child_id='hvac-repair-123')
--    - entity_instance_link: (event='evt-001', child_type='customer', child_id='cust-456')
--    - d_entity_event_person_calendar: (event_id='evt-001', person_type='employee', person_id='emp-789', rsvp='accepted')
--
-- 2. Manager-Supplier Meeting:
--    - d_event: event_id = 'evt-002', type='virtual', platform='zoom', from_ts='2025-11-12 10:00', to_ts='2025-11-12 11:30'
--    - entity_instance_link: (event='evt-002', child_type='meeting', child_id='mtg-001')
--    - entity_instance_link: (event='evt-002', child_type='employee', child_id='mgr-123')
--    - entity_instance_link: (event='evt-002', child_type='supplier', child_id='sup-456')
--    - entity_instance_link: (event='evt-002', child_type='equipment', child_id='eqp-789')
--    - entity_instance_link: (event='evt-002', child_type='business', child_id='biz-001')
--    - d_entity_event_person_calendar: (event_id='evt-002', person_type='employee', person_id='mgr-123', rsvp='accepted')
--
-- =====================================================

CREATE TABLE app.event (
  id uuid DEFAULT gen_random_uuid(),
  code varchar(50),
  name varchar(200),
  descr text,
  active_flag boolean DEFAULT true,
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now(),
  version integer DEFAULT 1,

  -- Event action entity (what this event is about)
  event_action_entity_type varchar(100), -- 'service', 'product', 'project', 'task', 'quote'
  event_action_entity_id uuid, -- ID of the entity this event is about

  -- Organizer (who created/scheduled the event)
  organizer__employee_id uuid, -- Employee who organized the event

  -- Event specifics
  event_type varchar(100), -- 'onsite', 'virtual'
  event_platform_provider_name varchar(50), -- 'zoom', 'teams', 'google_meet', 'physical_hall', 'office', etc.
  venue_type varchar(100), -- 'conference_room', 'office', 'warehouse', 'customer_site', 'remote', etc.
  event_addr text, -- Physical address for onsite OR meeting URL for virtual
  event_instructions text, -- Access codes, parking info, preparation notes, etc.

  -- Time slot details
  from_ts timestamptz,
  to_ts timestamptz,
  timezone varchar(50) DEFAULT 'America/Toronto',

  -- Event metadata (stores related entity IDs)
  event_metadata jsonb DEFAULT '{}'::jsonb
);

-- =====================================================
-- DATA CURATION: Sample events covering various use cases
-- =====================================================

-- Event 1: HVAC Consultation (Onsite)
INSERT INTO app.event (
  code, name, descr,
  event_action_entity_type, event_action_entity_id,
  event_type, event_platform_provider_name, venue_type, event_addr, event_instructions,
  from_ts, to_ts, timezone,
  event_metadata
) VALUES (
  'EVT-HVAC-001',
  'HVAC System Consultation - Thompson Residence',
  'Initial consultation for HVAC system replacement at residential property. Assess current system, discuss options, provide estimate.',
  'service',
  '93106ffb-402e-43a7-8b26-5287e37a1b0e'::uuid, -- Service ID for HVAC consultation
  'onsite',
  'office',
  'customer_site',
  '123 Main Street, Toronto, ON M4W 1N4',
  'Ring doorbell at main entrance. Park in visitor lot on west side. Client has two dogs (friendly). Bring tablet for digital quote.',
  CURRENT_DATE + interval '1 day' + interval '14 hours',
  CURRENT_DATE + interval '1 day' + interval '16 hours',
  'America/Toronto',
  jsonb_build_object(
    'project_id', '93106ffb-402e-43a7-8b26-5287e37a1b0e',
    'service_category', 'HVAC',
    'estimated_duration_minutes', 120,
    'lead_technician_id', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
  )
);

-- Event 2: Virtual Project Review Meeting
INSERT INTO app.event (
  code, name, descr,
  event_action_entity_type, event_action_entity_id,
  event_type, event_platform_provider_name, venue_type, event_addr, event_instructions,
  from_ts, to_ts, timezone,
  event_metadata
) VALUES (
  'EVT-PROJ-002',
  'Solar Installation Phase 2 Review',
  'Quarterly progress review for commercial solar installation project. Review Phase 2 completion, discuss Phase 3 planning, address any concerns.',
  'project',
  '93106ffb-402e-43a7-8b26-5287e37a1b0e'::uuid, -- Project ID for Solar Installation
  'virtual',
  'zoom',
  'remote',
  'https://zoom.us/j/meeting-solar-review-001',
  'Zoom link provided above. Meeting password: Solar2025! Please have Q3 progress report ready.',
  CURRENT_DATE + interval '2 days' + interval '10 hours',
  CURRENT_DATE + interval '2 days' + interval '11 hours',
  'America/Toronto',
  jsonb_build_object(
    'meeting_url', 'https://zoom.us/j/meeting-solar-review-001',
    'meeting_password', 'Solar2025!',
    'organizer_id', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    'estimated_duration_minutes', 60
  )
);

-- Event 3: Emergency Service Call (Onsite)
INSERT INTO app.event (
  code, name, descr,
  event_action_entity_type, event_action_entity_id,
  event_type, event_platform_provider_name, venue_type, event_addr, event_instructions,
  from_ts, to_ts, timezone,
  event_metadata
) VALUES (
  'EVT-EMERG-003',
  'Emergency Plumbing Repair - Burst Pipe',
  'EMERGENCY: Burst water pipe in basement. Customer reports significant water damage. Immediate response required.',
  'service',
  'a1b2c3d4-e5f6-4a5b-8c7d-9e8f7a6b5c4d'::uuid, -- Emergency plumbing service ID
  'onsite',
  'office',
  'customer_site',
  '456 Oak Avenue, Mississauga, ON L5B 2K3',
  'EMERGENCY CALL. Customer will be home. Access through side gate. Water main shutoff required. Bring pipe repair kit and wet vac. Customer phone: 416-555-9876',
  CURRENT_DATE + interval '4 hours',
  CURRENT_DATE + interval '6 hours',
  'America/Toronto',
  jsonb_build_object(
    'urgency_level', 'emergency',
    'service_category', 'Plumbing',
    'customer_phone', '416-555-9876',
    'estimated_duration_minutes', 120,
    'required_equipment', json_build_array('pipe_repair_kit', 'wet_vac', 'pipe_wrench_set')
  )
);

-- Event 4: Team Training Session (Virtual)
INSERT INTO app.event (
  code, name, descr,
  event_action_entity_type, event_action_entity_id,
  event_type, event_platform_provider_name, venue_type, event_addr, event_instructions,
  from_ts, to_ts, timezone,
  event_metadata
) VALUES (
  'EVT-TRAIN-004',
  'Q1 Safety Training - Fall Protection',
  'Mandatory quarterly safety training for all field technicians. Topics: fall protection, ladder safety, PPE requirements, incident reporting.',
  'task',
  'b2c3d4e5-f6a7-4b5c-8d9e-0f1a2b3c4d5e'::uuid, -- Training task ID
  'virtual',
  'teams',
  'remote',
  'https://teams.microsoft.com/l/meetup-join/safety-training-q1',
  'All field technicians must attend. Session will be recorded for those unable to attend live. Quiz will follow training. CPD credits available.',
  CURRENT_DATE + interval '3 days' + interval '13 hours',
  CURRENT_DATE + interval '3 days' + interval '14 hours' + interval '30 minutes',
  'America/Toronto',
  jsonb_build_object(
    'training_category', 'safety',
    'mandatory_flag', true,
    'cpd_credits', 2,
    'target_audience', json_build_array('field_technician', 'supervisor'),
    'estimated_duration_minutes', 90,
    'meeting_url', 'https://teams.microsoft.com/l/meetup-join/safety-training-q1'
  )
);

-- Event 5: Project Kickoff Meeting (Onsite)
INSERT INTO app.event (
  code, name, descr,
  event_action_entity_type, event_action_entity_id,
  event_type, event_platform_provider_name, venue_type, event_addr, event_instructions,
  from_ts, to_ts, timezone,
  event_metadata
) VALUES (
  'EVT-KICK-005',
  'Commercial HVAC Installation - Project Kickoff',
  'Initial kickoff meeting for large commercial HVAC installation at office building. Meet with building manager, review site access, discuss timeline and coordination.',
  'project',
  'c3d4e5f6-a7b8-4c5d-9e0f-1a2b3c4d5e6f'::uuid, -- Commercial HVAC installation project ID
  'onsite',
  'physical_hall',
  'customer_site',
  '789 Business Park Drive, Building 3, Suite 200, Toronto, ON M9W 5G8',
  'Meet at main lobby. Security check required (bring photo ID). Building manager contact: Jane Smith (416-555-1234). Parking validation available.',
  CURRENT_DATE + interval '5 days' + interval '9 hours',
  CURRENT_DATE + interval '5 days' + interval '11 hours',
  'America/Toronto',
  jsonb_build_object(
    'building_contact_name', 'Jane Smith',
    'building_contact_phone', '416-555-1234',
    'estimated_duration_minutes', 120,
    'parking_available', true
  )
);

-- Event 6: Manager-Supplier Meeting for Equipment Purchase (Virtual)
INSERT INTO app.event (
  code, name, descr,
  event_action_entity_type, event_action_entity_id,
  event_type, event_platform_provider_name, venue_type, event_addr, event_instructions,
  from_ts, to_ts, timezone,
  event_metadata
) VALUES (
  'EVT-SUPP-006',
  'Manufacturing Equipment Purchase Discussion',
  'Meeting between manufacturing manager and equipment supplier to discuss new CNC machine purchase. Review specs, pricing, delivery timeline, and training requirements.',
  'product',
  'd4e5f6a7-b8c9-4d5e-0f1a-2b3c4d5e6f7a'::uuid, -- CNC machine product ID
  'virtual',
  'google_meet',
  'remote',
  'https://meet.google.com/abc-defg-hij',
  'Google Meet link provided above. Please review equipment spec sheet before meeting. Supplier will present 3 options.',
  CURRENT_DATE + interval '7 days' + interval '15 hours',
  CURRENT_DATE + interval '7 days' + interval '16 hours' + interval '30 minutes',
  'America/Toronto',
  jsonb_build_object(
    'meeting_url', 'https://meet.google.com/abc-defg-hij',
    'supplier_name', 'TechEquip Industries',
    'equipment_category', 'CNC Machine',
    'estimated_budget', 150000,
    'estimated_duration_minutes', 90
  )
);

-- =====================================================
-- REGISTER IN entity_instance
-- =====================================================

INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'event', id, name, code
FROM app.event
WHERE active_flag = true
ON CONFLICT (entity_code, entity_instance_id) DO UPDATE
SET entity_instance_name = EXCLUDED.entity_instance_name,
    code = EXCLUDED.code,
    updated_ts = now();

-- =====================================================
-- USEFUL QUERIES
-- =====================================================

-- Query 1: Get all upcoming events with time and location
-- SELECT
--   code, name, event_type, event_platform_provider_name,
--   from_ts, to_ts, timezone, event_addr,
--   event_metadata
-- FROM app.event
-- WHERE active_flag = true
--   AND from_ts >= now()
-- ORDER BY from_ts;

-- Query 2: Find all entities linked to a specific event (via entity_instance_link)
-- SELECT
--   e.code as event_code,
--   e.name as event_name,
--   eim.child_entity_code,
--   eim.child_entity_instance_id,
--   eim.relationship_type
-- FROM app.event e
-- JOIN app.entity_instance_link eim ON eim.entity_code = 'event' AND eim.entity_instance_id = e.id
-- WHERE e.code = 'EVT-HVAC-001'
--   AND e.active_flag = true
--   AND eim.active_flag = true;

-- Query 3: Find all people involved in an event (via d_entity_event_person_calendar)
-- SELECT
--   e.code as event_code,
--   e.name as event_name,
--   epc.person_entity_type,
--   epc.person_id,
--   epc.event_rsvp_status,
--   epc.from_ts,
--   epc.to_ts
-- FROM app.event e
-- JOIN app.d_entity_event_person_calendar epc ON epc.event_id = e.id
-- WHERE e.code = 'EVT-PROJ-002'
--   AND e.active_flag = true
--   AND epc.active_flag = true;

-- Query 4: Event summary by type and platform
-- SELECT
--   event_type,
--   event_platform_provider_name,
--   COUNT(*) as event_count
-- FROM app.event
-- WHERE active_flag = true
-- GROUP BY event_type, event_platform_provider_name
-- ORDER BY event_count DESC;

-- Query 5: Find events happening in a specific time range
-- SELECT
--   code, name, event_type, from_ts, to_ts, event_addr
-- FROM app.event
-- WHERE active_flag = true
--   AND from_ts >= '2025-11-10 00:00:00'::timestamptz
--   AND to_ts <= '2025-11-15 23:59:59'::timestamptz
-- ORDER BY from_ts;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE app.event IS 'Universal parent entity for events/meetings/appointments. Can be linked to ANY entity type via entity_instance_link. Defines WHAT, WHEN, and WHERE.';
COMMENT ON COLUMN app.event.event_type IS 'Event location type: onsite (physical location) or virtual (online meeting)';
COMMENT ON COLUMN app.event.event_platform_provider_name IS 'Platform/provider: zoom, teams, google_meet, physical_hall, office, etc.';
COMMENT ON COLUMN app.event.event_addr IS 'Physical address for onsite events OR meeting URL for virtual events';
COMMENT ON COLUMN app.event.event_instructions IS 'Detailed instructions: access codes, parking, preparation notes, contact info, equipment needs';
COMMENT ON COLUMN app.event.from_ts IS 'Event start time (timestamptz)';
COMMENT ON COLUMN app.event.to_ts IS 'Event end time (timestamptz)';
COMMENT ON COLUMN app.event.timezone IS 'Timezone for the event (default: America/Toronto)';
COMMENT ON COLUMN app.event.event_metadata IS 'JSONB storing additional context: meeting_password, organizer_id, equipment_ids, budget, etc.';
