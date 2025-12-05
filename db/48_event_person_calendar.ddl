-- =====================================================
-- ENTITY EVENT PERSON CALENDAR (app.entity_event_person_calendar)
-- Event-person mapping with RSVP tracking
-- =====================================================
--
-- SEMANTICS:
-- This table serves as the mapping between events and people (employees, clients, customers).
-- It tracks WHO is involved in an event and their RSVP status (accepted, declined, pending).
-- This is NOT a calendar availability table - it's purely event-person linkage.
--
-- KEY CONCEPTS:
-- 1. EVENT-PERSON MAPPING: Links events to specific people with RSVP status
-- 2. POLYMORPHIC PERSON: Supports employees, clients, and customers via person_entity_type/id
-- 3. RSVP TRACKING: Tracks whether person accepted, declined, or is pending response
-- 4. TIME COMMITMENT: from_ts/to_ts tracks the specific time this person is committed to the event
--
-- WORKFLOW:
-- 1. CREATE EVENT: First, create event in d_event table
-- 2. INVITE PEOPLE: Create entries in this table for each person invited to the event
-- 3. TRACK RSVP: Update event_rsvp_status when people respond (accepted, declined)
-- 4. QUERY ATTENDANCE: Find all people for an event, or all events for a person
-- 5. UPDATE STATUS: Change RSVP status as people respond
--
-- OPERATIONS:
-- • CREATE: POST /api/v1/event/:id/invite, add person to event with status='pending'
-- • UPDATE: PUT /api/v1/event/:id/rsvp, update event_rsvp_status (accepted/declined)
-- • DELETE: active_flag=false (remove person from event)
-- • LIST: GET /api/v1/event/:id/attendees, list all people for an event
-- • QUERY: GET /api/v1/person/:id/events, list all events for a person
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • person_id → employee.id OR d_client.id OR d_cust.id (polymorphic)
-- • event_id → d_event.id (many people can be linked to one event)
-- • metadata can store additional context if needed
--
-- USAGE EXAMPLES:
-- 1. HVAC Consultation Event:
--    - Event created in d_event (event_id = 'evt-001')
--    - Employee invited: INSERT (event_id='evt-001', person_type='employee', person_id='emp-123', rsvp='pending')
--    - Customer invited: INSERT (event_id='evt-001', person_type='customer', person_id='cust-456', rsvp='pending')
--    - Employee accepts: UPDATE SET rsvp='accepted' WHERE event_id='evt-001' AND person_id='emp-123'
--
-- 2. Manager-Supplier Meeting:
--    - Event created in d_event (event_id = 'evt-002')
--    - Manager invited: INSERT (event_id='evt-002', person_type='employee', person_id='mgr-001', rsvp='accepted')
--    - Supplier contact invited: INSERT (event_id='evt-002', person_type='client', person_id='sup-contact-001', rsvp='pending')
--
-- DIFFERENCE FROM d_entity_person_calendar:
-- • d_entity_person_calendar: Availability calendar with 15-minute slots (WHO is available WHEN)
-- • d_entity_event_person_calendar: Event-person mapping with RSVP (WHO is attending WHAT event)
--
-- =====================================================

CREATE TABLE app.entity_event_person_calendar (
  id uuid DEFAULT gen_random_uuid(),
  code varchar(50),
  name varchar(200),
  descr text,
  metadata jsonb DEFAULT '{}'::jsonb,
  active_flag boolean DEFAULT true,
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now(),
  version integer DEFAULT 1,

  -- Person identification (polymorphic: employee, client, or customer)
  person_entity_type varchar(50), -- 'employee', 'client', 'customer'
  person_id uuid,

  -- Event linkage
  event_id uuid, -- Link to d_event.id

  -- RSVP tracking
  event_rsvp_status varchar(50) DEFAULT 'pending', -- 'accepted', 'declined', 'pending'

  -- Time commitment for this person
  from_ts timestamptz,
  to_ts timestamptz,
  timezone varchar(50) DEFAULT 'America/Toronto'
);

-- =====================================================
-- DATA CURATION: Sample event-person mappings
-- =====================================================

-- Event 1: HVAC Consultation (EVT-HVAC-001)
-- Employee: James Miller (accepted)
INSERT INTO app.d_entity_event_person_calendar (
  code, name, descr,
  person_entity_type, person_id, event_id,
  event_rsvp_status,
  from_ts, to_ts, timezone
) VALUES (
  'EPC-HVAC-001-EMP',
  'James Miller - HVAC Consultation',
  'James Miller assigned to HVAC consultation at Thompson Residence',
  'employee',
  '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
  (SELECT id FROM app.event WHERE code = 'EVT-HVAC-001'),
  'accepted',
  CURRENT_DATE + interval '1 day' + interval '14 hours',
  CURRENT_DATE + interval '1 day' + interval '16 hours',
  'America/Toronto'
);

-- Event 2: Virtual Project Review (EVT-PROJ-002)
-- Employee: James Miller (accepted)
INSERT INTO app.d_entity_event_person_calendar (
  code, name, descr,
  person_entity_type, person_id, event_id,
  event_rsvp_status,
  from_ts, to_ts, timezone
) VALUES (
  'EPC-PROJ-002-EMP1',
  'James Miller - Solar Phase 2 Review',
  'James Miller attending Solar Installation Phase 2 Review meeting',
  'employee',
  '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
  (SELECT id FROM app.event WHERE code = 'EVT-PROJ-002'),
  'accepted',
  CURRENT_DATE + interval '2 days' + interval '10 hours',
  CURRENT_DATE + interval '2 days' + interval '11 hours',
  'America/Toronto'
);

-- Employee: Sarah Johnson (accepted)
INSERT INTO app.d_entity_event_person_calendar (
  code, name, descr,
  person_entity_type, person_id, event_id,
  event_rsvp_status,
  from_ts, to_ts, timezone
) VALUES (
  'EPC-PROJ-002-EMP2',
  'Sarah Johnson - Solar Phase 2 Review',
  'Sarah Johnson attending Solar Installation Phase 2 Review meeting',
  'employee',
  (SELECT id FROM app.app.employee WHERE email = 'sarah.johnson@huronhome.ca'),
  (SELECT id FROM app.event WHERE code = 'EVT-PROJ-002'),
  'accepted',
  CURRENT_DATE + interval '2 days' + interval '10 hours',
  CURRENT_DATE + interval '2 days' + interval '11 hours',
  'America/Toronto'
);

-- Employee: Michael Chen (pending)
INSERT INTO app.d_entity_event_person_calendar (
  code, name, descr,
  person_entity_type, person_id, event_id,
  event_rsvp_status,
  from_ts, to_ts, timezone
) VALUES (
  'EPC-PROJ-002-EMP3',
  'Michael Chen - Solar Phase 2 Review',
  'Michael Chen invited to Solar Installation Phase 2 Review meeting',
  'employee',
  (SELECT id FROM app.app.employee WHERE email = 'michael.chen@huronhome.ca'),
  (SELECT id FROM app.event WHERE code = 'EVT-PROJ-002'),
  'pending',
  CURRENT_DATE + interval '2 days' + interval '10 hours',
  CURRENT_DATE + interval '2 days' + interval '11 hours',
  'America/Toronto'
);

-- Event 3: Emergency Plumbing (EVT-EMERG-003)
-- First available plumbing technician (accepted)
INSERT INTO app.d_entity_event_person_calendar (
  code, name, descr,
  person_entity_type, person_id, event_id,
  event_rsvp_status,
  from_ts, to_ts, timezone
) VALUES (
  'EPC-EMERG-003-EMP',
  'Plumbing Technician - Emergency Repair',
  'Plumbing technician assigned to emergency burst pipe repair',
  'employee',
  (SELECT id FROM app.app.employee WHERE department = 'Plumbing' AND active_flag = true LIMIT 1),
  (SELECT id FROM app.event WHERE code = 'EVT-EMERG-003'),
  'accepted',
  CURRENT_DATE + interval '4 hours',
  CURRENT_DATE + interval '6 hours',
  'America/Toronto'
);

-- Event 4: Safety Training (EVT-TRAIN-004)
-- Multiple field technicians invited
INSERT INTO app.d_entity_event_person_calendar (
  code, name, descr,
  person_entity_type, person_id, event_id,
  event_rsvp_status,
  from_ts, to_ts, timezone
)
SELECT
  'EPC-TRAIN-004-' || substr(e.id, 1, 8),
  e.name || ' - Safety Training',
  e.name || ' invited to Q1 Safety Training session',
  'employee',
  e.id,
  (SELECT id FROM app.event WHERE code = 'EVT-TRAIN-004'),
  CASE WHEN e.email = 'sarah.johnson@huronhome.ca' THEN 'accepted' ELSE 'pending' END,
  CURRENT_DATE + interval '3 days' + interval '13 hours',
  CURRENT_DATE + interval '3 days' + interval '14 hours' + interval '30 minutes',
  'America/Toronto'
FROM app.app.employee e
WHERE e.active_flag = true
  AND e.department IN ('Operations', 'Plumbing', 'HVAC', 'Electrical')
LIMIT 5;

-- Event 5: Project Kickoff (EVT-KICK-005)
-- James Miller (accepted)
INSERT INTO app.d_entity_event_person_calendar (
  code, name, descr,
  person_entity_type, person_id, event_id,
  event_rsvp_status,
  from_ts, to_ts, timezone
) VALUES (
  'EPC-KICK-005-EMP1',
  'James Miller - HVAC Installation Kickoff',
  'James Miller attending Commercial HVAC Installation kickoff meeting',
  'employee',
  '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
  (SELECT id FROM app.event WHERE code = 'EVT-KICK-005'),
  'accepted',
  CURRENT_DATE + interval '5 days' + interval '9 hours',
  CURRENT_DATE + interval '5 days' + interval '11 hours',
  'America/Toronto'
);

-- Michael Chen (accepted)
INSERT INTO app.d_entity_event_person_calendar (
  code, name, descr,
  person_entity_type, person_id, event_id,
  event_rsvp_status,
  from_ts, to_ts, timezone
) VALUES (
  'EPC-KICK-005-EMP2',
  'Michael Chen - HVAC Installation Kickoff',
  'Michael Chen attending Commercial HVAC Installation kickoff meeting',
  'employee',
  (SELECT id FROM app.app.employee WHERE email = 'michael.chen@huronhome.ca'),
  (SELECT id FROM app.event WHERE code = 'EVT-KICK-005'),
  'accepted',
  CURRENT_DATE + interval '5 days' + interval '9 hours',
  CURRENT_DATE + interval '5 days' + interval '11 hours',
  'America/Toronto'
);

-- Event 6: Manager-Supplier Meeting (EVT-SUPP-006)
-- Manufacturing Manager (accepted)
INSERT INTO app.d_entity_event_person_calendar (
  code, name, descr,
  person_entity_type, person_id, event_id,
  event_rsvp_status,
  from_ts, to_ts, timezone
) VALUES (
  'EPC-SUPP-006-MGR',
  'Manufacturing Manager - Equipment Purchase Meeting',
  'Manufacturing manager meeting with supplier about CNC machine purchase',
  'employee',
  (SELECT id FROM app.app.employee WHERE department = 'Manufacturing' AND active_flag = true LIMIT 1),
  (SELECT id FROM app.event WHERE code = 'EVT-SUPP-006'),
  'accepted',
  CURRENT_DATE + interval '7 days' + interval '15 hours',
  CURRENT_DATE + interval '7 days' + interval '16 hours' + interval '30 minutes',
  'America/Toronto'
);

-- =====================================================
-- REGISTER IN entity_instance
-- =====================================================

INSERT INTO app.entity_instance (entity_type, entity_id, entity_name, entity_code)
SELECT 'event_person_calendar', id, name, code
FROM app.d_entity_event_person_calendar
WHERE active_flag = true
ON CONFLICT (entity_type, entity_id) DO UPDATE
SET entity_name = EXCLUDED.entity_name,
    entity_code = EXCLUDED.entity_code,
    updated_ts = now();

-- =====================================================
-- USEFUL QUERIES
-- =====================================================

-- Query 1: Get all people invited to a specific event with RSVP status
-- SELECT
--   e.code as event_code,
--   e.name as event_name,
--   epc.person_entity_type,
--   epc.person_id,
--   epc.name as person_name,
--   epc.event_rsvp_status,
--   epc.from_ts,
--   epc.to_ts
-- FROM app.event e
-- JOIN app.d_entity_event_person_calendar epc ON epc.event_id = e.id
-- WHERE e.code = 'EVT-PROJ-002'
--   AND e.active_flag = true
--   AND epc.active_flag = true
-- ORDER BY epc.event_rsvp_status, epc.person_entity_type;

-- Query 2: Get all events for a specific person
-- SELECT
--   e.code as event_code,
--   e.name as event_name,
--   e.event_type,
--   e.from_ts,
--   e.to_ts,
--   epc.event_rsvp_status
-- FROM app.d_entity_event_person_calendar epc
-- JOIN app.event e ON e.id = epc.event_id
-- WHERE epc.person_entity_type = 'employee'
--   AND epc.person_id = '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
--   AND epc.active_flag = true
--   AND e.active_flag = true
-- ORDER BY e.from_ts;

-- Query 3: Get RSVP summary for an event
-- SELECT
--   e.code as event_code,
--   e.name as event_name,
--   COUNT(*) as total_invited,
--   COUNT(*) FILTER (WHERE epc.event_rsvp_status = 'accepted') as accepted,
--   COUNT(*) FILTER (WHERE epc.event_rsvp_status = 'declined') as declined,
--   COUNT(*) FILTER (WHERE epc.event_rsvp_status = 'pending') as pending
-- FROM app.event e
-- JOIN app.d_entity_event_person_calendar epc ON epc.event_id = e.id
-- WHERE e.active_flag = true
--   AND epc.active_flag = true
-- GROUP BY e.id, e.code, e.name
-- ORDER BY e.from_ts;

-- Query 4: Find all pending RSVPs for upcoming events
-- SELECT
--   e.code as event_code,
--   e.name as event_name,
--   e.from_ts,
--   epc.person_entity_type,
--   epc.name as person_name
-- FROM app.d_entity_event_person_calendar epc
-- JOIN app.event e ON e.id = epc.event_id
-- WHERE epc.event_rsvp_status = 'pending'
--   AND e.from_ts >= now()
--   AND epc.active_flag = true
--   AND e.active_flag = true
-- ORDER BY e.from_ts;

-- Query 5: Get employee's upcoming accepted events
-- SELECT
--   emp.name as employee_name,
--   e.code as event_code,
--   e.name as event_name,
--   e.event_type,
--   e.from_ts,
--   e.to_ts,
--   e.event_addr
-- FROM app.d_entity_event_person_calendar epc
-- JOIN app.event e ON e.id = epc.event_id
-- JOIN app.app.employee emp ON emp.id = epc.person_id
-- WHERE epc.person_entity_type = 'employee'
--   AND epc.event_rsvp_status = 'accepted'
--   AND e.from_ts >= now()
--   AND epc.active_flag = true
--   AND e.active_flag = true
-- ORDER BY emp.name, e.from_ts;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE app.d_entity_event_person_calendar IS 'Event-person mapping with RSVP tracking. Links events to people (employees, clients, customers) with their response status.';
COMMENT ON COLUMN app.d_entity_event_person_calendar.person_entity_type IS 'Type of person: employee, client, or customer';
COMMENT ON COLUMN app.d_entity_event_person_calendar.person_id IS 'Polymorphic reference to d_employee, d_client, or d_cust';
COMMENT ON COLUMN app.d_entity_event_person_calendar.event_id IS 'Link to d_event.id - the event this person is invited to';
COMMENT ON COLUMN app.d_entity_event_person_calendar.event_rsvp_status IS 'RSVP status: pending, accepted, or declined';
COMMENT ON COLUMN app.d_entity_event_person_calendar.from_ts IS 'Start time of this person''s commitment to the event';
COMMENT ON COLUMN app.d_entity_event_person_calendar.to_ts IS 'End time of this person''s commitment to the event';
COMMENT ON COLUMN app.d_entity_event_person_calendar.timezone IS 'Timezone for the time commitment (default: America/Toronto)';
