-- =====================================================
-- EVENT (d_event)
-- Universal parent entity for all event-related linkages
-- =====================================================
--
-- SEMANTICS:
-- This table manages all events, meetings, and appointments in the system.
-- Event serves as a PARENT ENTITY that can be linked to ANY other entity type.
-- Events define WHAT is happening, WHEN it happens, and WHERE it happens.
-- Person-event relationships are tracked in d_entity_event_person_calendar.
-- Entity linkages (event → task, project, customer, etc.) are tracked in d_entity_id_map.
--
-- KEY CONCEPTS:
-- 1. PARENT ENTITY: Event can be parent to any entity (service, customer, task, project, business, meeting, employee, supplier, equipment, etc.)
-- 2. TIME-BOUND: Every event has from_ts/to_ts defining when it occurs
-- 3. LOCATION-AWARE: event_addr stores physical address OR virtual meeting URL
-- 4. PLATFORM-SPECIFIC: event_platform_provider_name identifies the platform (Zoom, Teams, Google Meet, physical hall, etc.)
-- 5. POLYMORPHIC LINKAGE: d_entity_id_map tracks all parent-child relationships
--
-- USE CASES:
-- 1. SERVICE EVENT: Event → Service, Customer, Employee (e.g., HVAC repair for customer, assigned to employee)
-- 2. MANUFACTURING EVENT: Event → Meeting, Employee, Supplier, Equipment (e.g., manager meeting supplier about equipment purchase)
-- 3. PROJECT EVENT: Event → Project, Task, Employee (e.g., project kickoff meeting with team members)
-- 4. TRAINING EVENT: Event → Employee (e.g., safety training for field technicians)
-- 5. CUSTOMER EVENT: Event → Customer, Service (e.g., consultation appointment)
--
-- WORKFLOW:
-- 1. CREATE EVENT: Define event details (type, platform, address, time slot)
-- 2. LINK TO ENTITIES: Add entries to d_entity_id_map (event as parent, other entities as children)
--    Example: INSERT INTO d_entity_id_map (parent_entity_type='event', parent_entity_id=event_id, child_entity_type='service', child_entity_id=service_id)
-- 3. LINK TO PEOPLE: Add entries to d_entity_event_person_calendar (who is involved, RSVP status)
--    Example: INSERT INTO d_entity_event_person_calendar (event_id, person_entity_type='employee', person_entity_id=emp_id, event_rsvp_status='accepted')
-- 4. QUERY: Find all entities linked to an event via d_entity_id_map
-- 5. UPDATE: Modify event details, which affects all linked entities
-- 6. CANCEL: Set active_flag=false to soft-delete the event
--
-- DATABASE BEHAVIOR:
-- • CREATE: Define event with all details (type, platform, address, time, instructions, metadata)
-- • LINK ENTITIES: Use d_entity_id_map to establish event → entity relationships
-- • LINK PEOPLE: Use d_entity_event_person_calendar to track who is involved and their RSVP status
-- • UPDATE: Modify event details, cascades conceptually to all linked entities
-- • CANCEL: Set active_flag=false, handle cleanup in application logic
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY (stable identifier)
-- • code: varchar(50) UNIQUE - business identifier (e.g., 'EVT-HVAC-001')
-- • name: varchar(200) NOT NULL - event title/subject
-- • descr: text - detailed event description
-- • event_type: varchar(100) NOT NULL - 'onsite' or 'virtual'
-- • event_platform_provider_name: varchar(50) NOT NULL - 'zoom', 'teams', 'google_meet', 'physical_hall', 'office', etc.
-- • event_addr: text - physical address for onsite OR meeting URL for virtual events
-- • event_instructions: text - special instructions, access codes, preparation notes, parking info
-- • from_ts: timestamptz NOT NULL - event start time
-- • to_ts: timestamptz NOT NULL - event end time
-- • timezone: varchar(50) DEFAULT 'America/Toronto' - timezone for the event
-- • event_metadata: jsonb - flexible storage for additional context (organizer_id, meeting_password, equipment_ids, etc.)
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • d_entity_id_map: event (parent) → service, customer, task, project, business, meeting, employee, supplier, equipment, etc. (children)
-- • d_entity_event_person_calendar.event_id → d_event.id (tracks who is involved and RSVP status)
-- • event_metadata stores additional entity references as needed
--
-- INTEGRATION WITH OTHER TABLES:
-- • d_entity_id_map: Tracks event as parent of other entities
--   Example: event → service, event → customer, event → task, event → project
-- • d_entity_event_person_calendar: Tracks which people are involved in the event
--   Example: event_id + employee_id + RSVP status
-- • d_entity: Event registered as entity type with potential child entities
--
-- EXAMPLES:
-- 1. HVAC Repair Event:
--    - d_event: event_id = 'evt-001', type='onsite', platform='office', from_ts='2025-11-10 14:00', to_ts='2025-11-10 16:00'
--    - d_entity_id_map: (event='evt-001', child_type='service', child_id='hvac-repair-123')
--    - d_entity_id_map: (event='evt-001', child_type='customer', child_id='cust-456')
--    - d_entity_event_person_calendar: (event_id='evt-001', person_type='employee', person_id='emp-789', rsvp='accepted')
--
-- 2. Manager-Supplier Meeting:
--    - d_event: event_id = 'evt-002', type='virtual', platform='zoom', from_ts='2025-11-12 10:00', to_ts='2025-11-12 11:30'
--    - d_entity_id_map: (event='evt-002', child_type='meeting', child_id='mtg-001')
--    - d_entity_id_map: (event='evt-002', child_type='employee', child_id='mgr-123')
--    - d_entity_id_map: (event='evt-002', child_type='supplier', child_id='sup-456')
--    - d_entity_id_map: (event='evt-002', child_type='equipment', child_id='eqp-789')
--    - d_entity_id_map: (event='evt-002', child_type='business', child_id='biz-001')
--    - d_entity_event_person_calendar: (event_id='evt-002', person_type='employee', person_id='mgr-123', rsvp='accepted')
--
-- =====================================================

CREATE TABLE app.d_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL,
  name varchar(200) NOT NULL,
  descr text,
  active_flag boolean DEFAULT true,
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now(),
  version integer DEFAULT 1,

  -- Event specifics
  event_type varchar(100) NOT NULL, -- 'onsite', 'virtual'
  event_platform_provider_name varchar(50) NOT NULL, -- 'zoom', 'teams', 'google_meet', 'physical_hall', 'office', etc.
  event_addr text, -- Physical address for onsite OR meeting URL for virtual
  event_instructions text, -- Access codes, parking info, preparation notes, etc.

  -- Time slot details
  from_ts timestamptz NOT NULL,
  to_ts timestamptz NOT NULL,
  timezone varchar(50) DEFAULT 'America/Toronto',

  -- Event metadata (stores related entity IDs)
  event_metadata jsonb DEFAULT '{}'::jsonb
);

-- =====================================================
-- DATA CURATION: Sample events covering various use cases
-- =====================================================

-- Event 1: HVAC Consultation (Onsite)
INSERT INTO app.d_event (
  code, name, descr,
  event_type, event_platform_provider_name, event_addr, event_instructions,
  from_ts, to_ts, timezone,
  event_metadata
) VALUES (
  'EVT-HVAC-001',
  'HVAC System Consultation - Thompson Residence',
  'Initial consultation for HVAC system replacement at residential property. Assess current system, discuss options, provide estimate.',
  'onsite',
  'office',
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
INSERT INTO app.d_event (
  code, name, descr,
  event_type, event_platform_provider_name, event_addr, event_instructions,
  from_ts, to_ts, timezone,
  event_metadata
) VALUES (
  'EVT-PROJ-002',
  'Solar Installation Phase 2 Review',
  'Quarterly progress review for commercial solar installation project. Review Phase 2 completion, discuss Phase 3 planning, address any concerns.',
  'virtual',
  'zoom',
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
INSERT INTO app.d_event (
  code, name, descr,
  event_type, event_platform_provider_name, event_addr, event_instructions,
  from_ts, to_ts, timezone,
  event_metadata
) VALUES (
  'EVT-EMERG-003',
  'Emergency Plumbing Repair - Burst Pipe',
  'EMERGENCY: Burst water pipe in basement. Customer reports significant water damage. Immediate response required.',
  'onsite',
  'office',
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
INSERT INTO app.d_event (
  code, name, descr,
  event_type, event_platform_provider_name, event_addr, event_instructions,
  from_ts, to_ts, timezone,
  event_metadata
) VALUES (
  'EVT-TRAIN-004',
  'Q1 Safety Training - Fall Protection',
  'Mandatory quarterly safety training for all field technicians. Topics: fall protection, ladder safety, PPE requirements, incident reporting.',
  'virtual',
  'teams',
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
INSERT INTO app.d_event (
  code, name, descr,
  event_type, event_platform_provider_name, event_addr, event_instructions,
  from_ts, to_ts, timezone,
  event_metadata
) VALUES (
  'EVT-KICK-005',
  'Commercial HVAC Installation - Project Kickoff',
  'Initial kickoff meeting for large commercial HVAC installation at office building. Meet with building manager, review site access, discuss timeline and coordination.',
  'onsite',
  'physical_hall',
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
INSERT INTO app.d_event (
  code, name, descr,
  event_type, event_platform_provider_name, event_addr, event_instructions,
  from_ts, to_ts, timezone,
  event_metadata
) VALUES (
  'EVT-SUPP-006',
  'Manufacturing Equipment Purchase Discussion',
  'Meeting between manufacturing manager and equipment supplier to discuss new CNC machine purchase. Review specs, pricing, delivery timeline, and training requirements.',
  'virtual',
  'google_meet',
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
-- REGISTER IN d_entity_instance_id
-- =====================================================

INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
SELECT 'event', id, name, code
FROM app.d_event
WHERE active_flag = true
ON CONFLICT (entity_type, entity_id) DO UPDATE
SET entity_name = EXCLUDED.entity_name,
    entity_code = EXCLUDED.entity_code,
    updated_ts = now();

-- =====================================================
-- USEFUL QUERIES
-- =====================================================

-- Query 1: Get all upcoming events with time and location
-- SELECT
--   code, name, event_type, event_platform_provider_name,
--   from_ts, to_ts, timezone, event_addr,
--   event_metadata
-- FROM app.d_event
-- WHERE active_flag = true
--   AND from_ts >= now()
-- ORDER BY from_ts;

-- Query 2: Find all entities linked to a specific event (via d_entity_id_map)
-- SELECT
--   e.code as event_code,
--   e.name as event_name,
--   eim.child_entity_type,
--   eim.child_entity_id,
--   eim.relationship_type
-- FROM app.d_event e
-- JOIN app.d_entity_id_map eim ON eim.parent_entity_type = 'event' AND eim.parent_entity_id = e.id::text
-- WHERE e.code = 'EVT-HVAC-001'
--   AND e.active_flag = true
--   AND eim.active_flag = true;

-- Query 3: Find all people involved in an event (via d_entity_event_person_calendar)
-- SELECT
--   e.code as event_code,
--   e.name as event_name,
--   epc.person_entity_type,
--   epc.person_entity_id,
--   epc.event_rsvp_status,
--   epc.from_ts,
--   epc.to_ts
-- FROM app.d_event e
-- JOIN app.d_entity_event_person_calendar epc ON epc.event_id = e.id
-- WHERE e.code = 'EVT-PROJ-002'
--   AND e.active_flag = true
--   AND epc.active_flag = true;

-- Query 4: Event summary by type and platform
-- SELECT
--   event_type,
--   event_platform_provider_name,
--   COUNT(*) as event_count
-- FROM app.d_event
-- WHERE active_flag = true
-- GROUP BY event_type, event_platform_provider_name
-- ORDER BY event_count DESC;

-- Query 5: Find events happening in a specific time range
-- SELECT
--   code, name, event_type, from_ts, to_ts, event_addr
-- FROM app.d_event
-- WHERE active_flag = true
--   AND from_ts >= '2025-11-10 00:00:00'::timestamptz
--   AND to_ts <= '2025-11-15 23:59:59'::timestamptz
-- ORDER BY from_ts;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE app.d_event IS 'Universal parent entity for events/meetings/appointments. Can be linked to ANY entity type via d_entity_id_map. Defines WHAT, WHEN, and WHERE.';
COMMENT ON COLUMN app.d_event.event_type IS 'Event location type: onsite (physical location) or virtual (online meeting)';
COMMENT ON COLUMN app.d_event.event_platform_provider_name IS 'Platform/provider: zoom, teams, google_meet, physical_hall, office, etc.';
COMMENT ON COLUMN app.d_event.event_addr IS 'Physical address for onsite events OR meeting URL for virtual events';
COMMENT ON COLUMN app.d_event.event_instructions IS 'Detailed instructions: access codes, parking, preparation notes, contact info, equipment needs';
COMMENT ON COLUMN app.d_event.from_ts IS 'Event start time (timestamptz)';
COMMENT ON COLUMN app.d_event.to_ts IS 'Event end time (timestamptz)';
COMMENT ON COLUMN app.d_event.timezone IS 'Timezone for the event (default: America/Toronto)';
COMMENT ON COLUMN app.d_event.event_metadata IS 'JSONB storing additional context: meeting_password, organizer_id, equipment_ids, budget, etc.';
