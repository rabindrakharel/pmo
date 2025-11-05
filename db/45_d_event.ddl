-- =====================================================
-- EVENT (d_event)
-- Core event/meeting/appointment management system
-- =====================================================
--
-- SEMANTICS:
-- This table manages all events, meetings, and appointments in the system.
-- It serves as the master event record that can be linked to calendar slots, projects, tasks, and customers.
-- Events define WHAT is happening, while d_entity_person_calendar defines WHEN and WHO.
--
-- USE CASES:
-- 1. SCHEDULED APPOINTMENTS: Customer service calls, consultations, installations
-- 2. INTERNAL MEETINGS: Team meetings, project reviews, training sessions
-- 3. PROJECT MILESTONES: Kickoff meetings, progress reviews, final walkthroughs
-- 4. CUSTOMER INTERACTIONS: Sales meetings, follow-ups, support calls
--
-- WORKFLOW:
-- 1. CREATE EVENT: Define event details (action, medium, location, instructions)
-- 2. LINK TO CALENDAR: Associate with d_entity_person_calendar slots (via event_id)
-- 3. TRACK NOTIFICATIONS: Mark when reminders and confirmations are sent
-- 4. UPDATE METADATA: Store project_id, task_id, customer_id, attendee lists
--
-- DATABASE BEHAVIOR:
-- • CREATE: Define event with all details (medium, location, instructions, metadata)
-- • LINK: Reference this event_id in d_entity_person_calendar entries
-- • NOTIFY: Update reminder/confirmation flags when notifications are sent
-- • UPDATE: Modify event details, which cascade to all linked calendar slots
-- • CANCEL: Set active_flag=false to soft-delete the event
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY (stable identifier)
-- • code: varchar(50) UNIQUE - business identifier (e.g., 'EVT-HVAC-001')
-- • name: varchar(200) - event title/subject
-- • descr: text - detailed event description
-- • event_entity_action: varchar(100) - what needs to happen (e.g., 'hvac_repair', 'consultation', 'team_meeting')
-- • event_medium: varchar(50) - 'onsite' or 'virtual'
-- • event_addr: text - physical address for onsite, or meeting URL for virtual
-- • event_instructions: text - special instructions, access codes, preparation notes
-- • event_metadata: jsonb - stores project_id, task_id, customer_id, attendee_ids, etc.
-- • reminder_sent_flag/ts: tracking when reminder notifications were sent
-- • confirmation_sent_flag/ts: tracking when confirmation notifications were sent
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • d_entity_person_calendar.event_id → d_event.id (many calendar slots can reference one event)
-- • event_metadata->>'project_id' → d_project.id
-- • event_metadata->>'task_id' → d_task.id
-- • event_metadata->>'customer_id' → d_cust.id
-- • event_metadata->'attendee_ids' → array of d_employee.id or d_client.id
--
-- INTEGRATION WITH CALENDAR:
-- • One event can span multiple calendar slots (e.g., 2-hour meeting = 8 slots of 15 minutes each)
-- • Calendar slots link to event via event_id foreign key
-- • Event defines WHAT and WHERE, calendar slots define WHEN and WHO
-- • Deleting/canceling an event should update linked calendar slots (handle in application logic)
--
-- =====================================================

CREATE TABLE app.d_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) UNIQUE NOT NULL,
  name varchar(200) NOT NULL,
  descr text,
  metadata jsonb DEFAULT '{}'::jsonb,
  active_flag boolean DEFAULT true,
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now(),
  version integer DEFAULT 1,

  -- Event specifics
  event_entity_action varchar(100), -- 'hvac_repair', 'consultation', 'team_meeting', 'project_kickoff', etc.
  event_medium varchar(50) NOT NULL, -- 'onsite', 'virtual'
  event_addr text, -- Physical address for onsite OR meeting URL for virtual
  event_instructions text, -- Access codes, parking info, preparation notes, etc.

  -- Event metadata (stores related entity IDs)
  event_metadata jsonb DEFAULT '{}'::jsonb, -- project_id, task_id, customer_id, attendee_ids, etc.

  -- Notification tracking
  reminder_sent_flag boolean DEFAULT false,
  reminder_sent_ts timestamptz,
  confirmation_sent_flag boolean DEFAULT false,
  confirmation_sent_ts timestamptz

);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_event_code ON app.d_event(code) WHERE active_flag = true;
CREATE INDEX idx_event_medium ON app.d_event(event_medium) WHERE active_flag = true;
CREATE INDEX idx_event_action ON app.d_event(event_entity_action) WHERE active_flag = true;
CREATE INDEX idx_event_notifications ON app.d_event(reminder_sent_flag, confirmation_sent_flag) WHERE active_flag = true;

-- GIN index for JSONB event_metadata queries
CREATE INDEX idx_event_metadata ON app.d_event USING gin(event_metadata);

-- =====================================================
-- SAMPLE DATA: Curated events covering various use cases
-- =====================================================

-- Event 1: HVAC Consultation (Onsite)
INSERT INTO app.d_event (
  code, name, descr,
  event_entity_action, event_medium, event_addr, event_instructions,
  event_metadata,
  reminder_sent_flag, confirmation_sent_flag
) VALUES (
  'EVT-HVAC-001',
  'HVAC System Consultation - Thompson Residence',
  'Initial consultation for HVAC system replacement at residential property. Assess current system, discuss options, provide estimate.',
  'hvac_consultation',
  'onsite',
  '123 Main Street, Toronto, ON M4W 1N4',
  'Ring doorbell at main entrance. Park in visitor lot on west side. Client has two dogs (friendly). Bring tablet for digital quote.',
  jsonb_build_object(
    'project_id', '93106ffb-402e-43a7-8b26-5287e37a1b0e',
    'customer_id', (SELECT id FROM app.d_cust WHERE code = 'CL-RES-001' LIMIT 1),
    'service_category', 'HVAC',
    'estimated_duration_minutes', 60,
    'lead_technician_id', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
  ),
  true,
  false
);

-- Event 2: Virtual Project Review Meeting
INSERT INTO app.d_event (
  code, name, descr,
  event_entity_action, event_medium, event_addr, event_instructions,
  event_metadata,
  reminder_sent_flag, confirmation_sent_flag
) VALUES (
  'EVT-PROJ-002',
  'Solar Installation Phase 2 Review',
  'Quarterly progress review for commercial solar installation project. Review Phase 2 completion, discuss Phase 3 planning, address any concerns.',
  'project_review',
  'virtual',
  'https://zoom.us/j/meeting-solar-review-001',
  'Zoom link will be sent 15 minutes before meeting. Please have Q3 progress report ready. Meeting password: Solar2025!',
  jsonb_build_object(
    'project_id', (SELECT id FROM app.d_project WHERE code = 'PROJ-004' LIMIT 1),
    'task_id', (SELECT id FROM app.d_task WHERE code = 'TASK-001' LIMIT 1),
    'meeting_url', 'https://zoom.us/j/meeting-solar-review-001',
    'meeting_password', 'Solar2025!',
    'organizer_id', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    'attendee_ids', json_build_array(
      (SELECT id FROM app.d_employee WHERE email = 'sarah.johnson@huronhome.ca'),
      (SELECT id FROM app.d_employee WHERE email = 'michael.chen@huronhome.ca')
    ),
    'estimated_duration_minutes', 60
  ),
  true,
  true
);

-- Event 3: Emergency Service Call (Onsite)
INSERT INTO app.d_event (
  code, name, descr,
  event_entity_action, event_medium, event_addr, event_instructions,
  event_metadata,
  reminder_sent_flag, confirmation_sent_flag
) VALUES (
  'EVT-EMERG-003',
  'Emergency Plumbing Repair - Burst Pipe',
  'EMERGENCY: Burst water pipe in basement. Customer reports significant water damage. Immediate response required.',
  'emergency_repair',
  'onsite',
  '456 Oak Avenue, Mississauga, ON L5B 2K3',
  'EMERGENCY CALL. Customer will be home. Access through side gate. Water main shutoff required. Bring pipe repair kit and wet vac. Customer phone: 416-555-9876',
  jsonb_build_object(
    'urgency_level', 'emergency',
    'service_category', 'Plumbing',
    'customer_phone', '416-555-9876',
    'estimated_duration_minutes', 120,
    'required_equipment', json_build_array('pipe_repair_kit', 'wet_vac', 'pipe_wrench_set'),
    'assigned_technician_id', (SELECT id FROM app.d_employee WHERE department = 'Plumbing' AND active_flag = true LIMIT 1)
  ),
  false,
  false
);

-- Event 4: Team Training Session (Virtual)
INSERT INTO app.d_event (
  code, name, descr,
  event_entity_action, event_medium, event_addr, event_instructions,
  event_metadata,
  reminder_sent_flag, confirmation_sent_flag
) VALUES (
  'EVT-TRAIN-004',
  'Q1 Safety Training - Fall Protection',
  'Mandatory quarterly safety training for all field technicians. Topics: fall protection, ladder safety, PPE requirements, incident reporting.',
  'training_session',
  'virtual',
  'https://teams.microsoft.com/l/meetup-join/safety-training-q1',
  'All field technicians must attend. Session will be recorded for those unable to attend live. Quiz will follow training. CPD credits available.',
  jsonb_build_object(
    'training_category', 'safety',
    'mandatory_flag', true,
    'cpdcredits', 2,
    'trainer_id', (SELECT id FROM app.d_employee WHERE email = 'sarah.johnson@huronhome.ca'),
    'target_audience', json_build_array('field_technician', 'supervisor'),
    'estimated_duration_minutes', 90,
    'meeting_url', 'https://teams.microsoft.com/l/meetup-join/safety-training-q1'
  ),
  true,
  true
);

-- Event 5: Project Kickoff Meeting (Onsite)
INSERT INTO app.d_event (
  code, name, descr,
  event_entity_action, event_medium, event_addr, event_instructions,
  event_metadata,
  reminder_sent_flag, confirmation_sent_flag
) VALUES (
  'EVT-KICK-005',
  'Commercial HVAC Installation - Project Kickoff',
  'Initial kickoff meeting for large commercial HVAC installation at office building. Meet with building manager, review site access, discuss timeline and coordination.',
  'project_kickoff',
  'onsite',
  '789 Business Park Drive, Building 3, Suite 200, Toronto, ON M9W 5G8',
  'Meet at main lobby. Security check required (bring photo ID). Building manager contact: Jane Smith (416-555-1234). Parking validation available.',
  jsonb_build_object(
    'project_id', (SELECT id FROM app.d_project WHERE code = 'PROJ-003' LIMIT 1),
    'customer_id', (SELECT id FROM app.d_cust WHERE code = 'CL-COM-001' LIMIT 1),
    'building_contact_name', 'Jane Smith',
    'building_contact_phone', '416-555-1234',
    'attendee_ids', json_build_array(
      '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
      (SELECT id FROM app.d_employee WHERE email = 'michael.chen@huronhome.ca')
    ),
    'estimated_duration_minutes', 120,
    'parking_available', true
  ),
  true,
  false
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

-- Query 1: Get all upcoming events with notification status
-- SELECT
--   code, name, event_medium, event_entity_action,
--   reminder_sent_flag, confirmation_sent_flag,
--   event_metadata->>'project_id' as project_id,
--   event_metadata->>'customer_id' as customer_id
-- FROM app.d_event
-- WHERE active_flag = true
-- ORDER BY created_ts DESC;

-- Query 2: Find events needing reminders (24 hours before)
-- SELECT e.*, c.from_ts
-- FROM app.d_event e
-- JOIN app.d_entity_person_calendar c ON c.event_id = e.id
-- WHERE e.reminder_sent_flag = false
--   AND e.active_flag = true
--   AND c.from_ts BETWEEN now() AND now() + interval '24 hours'
-- ORDER BY c.from_ts;

-- Query 3: Event summary by type
-- SELECT
--   event_entity_action,
--   event_medium,
--   COUNT(*) as event_count,
--   COUNT(*) FILTER (WHERE reminder_sent_flag = true) as reminders_sent,
--   COUNT(*) FILTER (WHERE confirmation_sent_flag = true) as confirmations_sent
-- FROM app.d_event
-- WHERE active_flag = true
-- GROUP BY event_entity_action, event_medium
-- ORDER BY event_count DESC;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE app.d_event IS 'Master event/meeting/appointment table defining WHAT is happening. Links to d_entity_person_calendar for WHEN and WHO.';
COMMENT ON COLUMN app.d_event.event_entity_action IS 'Type of action/event: hvac_consultation, project_review, emergency_repair, training_session, project_kickoff, etc.';
COMMENT ON COLUMN app.d_event.event_medium IS 'onsite (physical location) or virtual (online meeting)';
COMMENT ON COLUMN app.d_event.event_addr IS 'Physical address for onsite events OR meeting URL for virtual events';
COMMENT ON COLUMN app.d_event.event_instructions IS 'Detailed instructions: access codes, parking, preparation notes, contact info, equipment needs';
COMMENT ON COLUMN app.d_event.event_metadata IS 'JSONB storing project_id, task_id, customer_id, attendee_ids, meeting details, equipment requirements';
COMMENT ON COLUMN app.d_event.reminder_sent_flag IS 'true when reminder notification has been sent to participants';
COMMENT ON COLUMN app.d_event.reminder_sent_ts IS 'Timestamp when reminder was sent';
COMMENT ON COLUMN app.d_event.confirmation_sent_flag IS 'true when confirmation notification has been sent';
COMMENT ON COLUMN app.d_event.confirmation_sent_ts IS 'Timestamp when confirmation was sent';
