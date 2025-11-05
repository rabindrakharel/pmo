-- =====================================================
-- EMPLOYEE CALENDAR MAPPING (d_employee_calendar) - ATTENDANCE & RESPONSE TRACKING
-- Many-to-many relationship between employees and calendar events
-- =====================================================
--
-- SEMANTICS:
-- Links employees to calendar events with attendance tracking, RSVP status, and notification preferences.
-- Supports meeting invitations, response tracking (accepted/declined/tentative), and organizer designation.
-- Each employee-event pair is a unique record with response status and reminder settings.
-- In-place updates for response changes, soft delete when attendee is removed from event.
--
-- DATABASE BEHAVIOR:
-- • CREATE: INSERT when employee is invited to calendar event
--   Example: INSERT INTO d_employee_calendar (employee_id, calendar_event_id, response_status, is_required)
--            VALUES ('8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
--                    '11111111-1111-1111-1111-111111111111',
--                    'accepted', true)
--
-- • UPDATE: Response status changes, reminder preferences
--   Example: UPDATE d_employee_calendar SET response_status='declined', declined_reason='Schedule conflict'
--            WHERE employee_id='...' AND calendar_event_id='...'
--
-- • DELETE: Soft delete when attendee removed from event
--   Example: UPDATE d_employee_calendar SET active_flag=false, to_ts=now()
--            WHERE employee_id='...' AND calendar_event_id='...'
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY (stable identifier)
-- • employee_id: uuid NOT NULL (references d_employee.id)
-- • calendar_event_id: uuid NOT NULL (references d_calendar.id)
-- • response_status: varchar(50) ('pending', 'accepted', 'declined', 'tentative', 'no-response')
-- • is_organizer: boolean (true if this employee created/owns the event)
-- • is_required: boolean (true for mandatory attendees, false for optional)
-- • attended_flag: boolean (actual attendance tracked after event)
-- • reminder_minutes_before: integer (custom reminder time per attendee)
-- • notification_sent_flag: boolean (tracking if invitation/reminder was sent)
--
-- UNIQUE CONSTRAINT:
-- • (employee_id, calendar_event_id) must be unique per active record
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • employee_id → d_employee.id
-- • calendar_event_id → d_calendar.id
--
-- BUSINESS RULES:
-- • Only one employee can be organizer (is_organizer=true) per event
-- • Response status transitions: pending → accepted/declined/tentative
-- • Attended flag only set after event end_ts has passed
-- • Reminders sent based on reminder_minutes_before setting
--
-- =====================================================

CREATE TABLE app.d_employee_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) UNIQUE NOT NULL,
  name varchar(200),
  descr text,
  metadata jsonb DEFAULT '{}'::jsonb,
  active_flag boolean DEFAULT true,
  from_ts timestamptz DEFAULT now(),
  to_ts timestamptz,
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now(),
  version integer DEFAULT 1,

  -- Core relationship fields
  employee_id uuid NOT NULL,
  calendar_event_id uuid NOT NULL,

  -- Attendance and response tracking
  response_status varchar(50) DEFAULT 'pending', -- pending, accepted, declined, tentative, no-response
  response_ts timestamptz,
  is_organizer boolean DEFAULT false,
  is_required boolean DEFAULT true, -- true = required attendee, false = optional

  -- Post-event tracking
  attended_flag boolean DEFAULT false,
  attended_duration_minutes integer, -- Actual time spent in meeting

  -- Notification and reminders
  reminder_minutes_before integer DEFAULT 15, -- Custom reminder per attendee
  notification_sent_flag boolean DEFAULT false,
  notification_sent_ts timestamptz,
  reminder_sent_flag boolean DEFAULT false,
  reminder_sent_ts timestamptz,

  -- Decline details
  declined_reason text,
  tentative_reason text,

  -- Availability check
  availability_checked_flag boolean DEFAULT false,
  has_conflict_flag boolean DEFAULT false,
  conflict_details jsonb,

  -- UNIQUE constraint on employee-event pair
  CONSTRAINT uq_employee_calendar_event UNIQUE (employee_id, calendar_event_id)
);

CREATE INDEX idx_employee_calendar_employee ON app.d_employee_calendar(employee_id) WHERE active_flag = true;
CREATE INDEX idx_employee_calendar_event ON app.d_employee_calendar(calendar_event_id) WHERE active_flag = true;
CREATE INDEX idx_employee_calendar_response ON app.d_employee_calendar(response_status) WHERE active_flag = true;

COMMENT ON TABLE app.d_employee_calendar IS 'Employee-Calendar event mapping with attendance tracking and RSVP status';

-- =====================================================
-- SAMPLE EMPLOYEE-CALENDAR MAPPINGS (Next 3 Months)
-- =====================================================

-- CAL-001: Executive Team Weekly Meeting (James, Sarah, Michael, Lisa)
-- James Miller (CEO) - Organizer
INSERT INTO app.d_employee_calendar (
    code, name, employee_id, calendar_event_id,
    response_status, is_organizer, is_required, attended_flag,
    reminder_minutes_before, notification_sent_flag
) VALUES (
    'EMP-CAL-001',
    'James Miller - Executive Team Weekly Meeting',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '11111111-1111-1111-1111-111111111111',
    'accepted',
    true,
    true,
    false,
    15,
    true
);

-- Sarah Johnson (COO)
INSERT INTO app.d_employee_calendar (
    code, name, employee_id, calendar_event_id,
    response_status, is_organizer, is_required, attended_flag
) VALUES (
    'EMP-CAL-002',
    'Sarah Johnson - Executive Team Weekly Meeting',
    (SELECT id FROM app.d_employee WHERE email = 'sarah.johnson@huronhome.ca'),
    '11111111-1111-1111-1111-111111111111',
    'accepted',
    false,
    true,
    false
);

-- Michael Chen (CTO)
INSERT INTO app.d_employee_calendar (
    code, name, employee_id, calendar_event_id,
    response_status, is_organizer, is_required, attended_flag
) VALUES (
    'EMP-CAL-003',
    'Michael Chen - Executive Team Weekly Meeting',
    (SELECT id FROM app.d_employee WHERE email = 'michael.chen@huronhome.ca'),
    '11111111-1111-1111-1111-111111111111',
    'accepted',
    false,
    true,
    false
);

-- Lisa Rodriguez (VP Sales)
INSERT INTO app.d_employee_calendar (
    code, name, employee_id, calendar_event_id,
    response_status, is_organizer, is_required, attended_flag
) VALUES (
    'EMP-CAL-004',
    'Lisa Rodriguez - Executive Team Weekly Meeting',
    (SELECT id FROM app.d_employee WHERE email = 'lisa.rodriguez@huronhome.ca'),
    '11111111-1111-1111-1111-111111111111',
    'accepted',
    false,
    true,
    false
);

-- CAL-002: All-Hands Company Meeting (All active employees)
-- Insert all active employees as attendees
INSERT INTO app.d_employee_calendar (
    code, name, employee_id, calendar_event_id,
    response_status, is_organizer, is_required, attended_flag, notification_sent_flag
)
SELECT
    'EMP-CAL-AH-' || ROW_NUMBER() OVER (ORDER BY e.code),
    e.name || ' - All-Hands Company Meeting',
    e.id,
    '22222222-2222-2222-2222-222222222222',
    CASE
        WHEN e.id = '8260b1b0-5efc-4611-ad33-ee76c0cf7f13' THEN 'accepted'
        ELSE 'pending'
    END,
    CASE WHEN e.id = '8260b1b0-5efc-4611-ad33-ee76c0cf7f13' THEN true ELSE false END,
    true,
    false,
    true
FROM app.d_employee e
WHERE e.active_flag = true
LIMIT 50; -- Limit to first 50 for sample data

-- CAL-003: Operations Review Meeting (Operations team members)
INSERT INTO app.d_employee_calendar (
    code, name, employee_id, calendar_event_id,
    response_status, is_organizer, is_required, attended_flag
)
SELECT
    'EMP-CAL-OPS-' || ROW_NUMBER() OVER (ORDER BY e.code),
    e.name || ' - Operations Review Meeting',
    e.id,
    '33333333-3333-3333-3333-333333333333',
    'accepted',
    CASE WHEN e.id = '8260b1b0-5efc-4611-ad33-ee76c0cf7f13' THEN true ELSE false END,
    true,
    false
FROM app.d_employee e
WHERE e.active_flag = true
  AND (e.department IN ('Operations', 'Landscaping', 'Snow Removal', 'HVAC', 'Plumbing', 'Solar Energy')
       OR e.id = '8260b1b0-5efc-4611-ad33-ee76c0cf7f13')
LIMIT 15;

-- CAL-004: Q4 Technology Planning Session (IT/Tech team)
INSERT INTO app.d_employee_calendar (
    code, name, employee_id, calendar_event_id,
    response_status, is_organizer, is_required, attended_flag
)
SELECT
    'EMP-CAL-TECH-' || ROW_NUMBER() OVER (ORDER BY e.code),
    e.name || ' - Q4 Technology Planning Session',
    e.id,
    '44444444-4444-4444-4444-444444444444',
    'accepted',
    CASE WHEN e.id = '8260b1b0-5efc-4611-ad33-ee76c0cf7f13' THEN true ELSE false END,
    true,
    false
FROM app.d_employee e
WHERE e.active_flag = true
  AND (e.department IN ('Technology', 'IT')
       OR e.id = '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
       OR e.email = 'michael.chen@huronhome.ca')
LIMIT 8;

-- CAL-005: Sales Excellence Training Workshop (Sales team)
INSERT INTO app.d_employee_calendar (
    code, name, employee_id, calendar_event_id,
    response_status, is_organizer, is_required, attended_flag
)
SELECT
    'EMP-CAL-SALES-' || ROW_NUMBER() OVER (ORDER BY e.code),
    e.name || ' - Sales Excellence Training Workshop',
    e.id,
    '55555555-5555-5555-5555-555555555555',
    'accepted',
    CASE WHEN e.email = 'lisa.rodriguez@huronhome.ca' THEN true ELSE false END,
    true,
    false
FROM app.d_employee e
WHERE e.active_flag = true
  AND (e.department = 'Sales'
       OR e.email = 'lisa.rodriguez@huronhome.ca')
LIMIT 25;

-- CAL-006: Remembrance Day - All employees marked for holiday
INSERT INTO app.d_employee_calendar (
    code, name, employee_id, calendar_event_id,
    response_status, is_organizer, is_required, attended_flag, notification_sent_flag
)
SELECT
    'EMP-CAL-RD-' || ROW_NUMBER() OVER (ORDER BY e.code),
    e.name || ' - Remembrance Day',
    e.id,
    '66666666-6666-6666-6666-666666666666',
    'accepted',
    CASE WHEN e.id = '8260b1b0-5efc-4611-ad33-ee76c0cf7f13' THEN true ELSE false END,
    false,
    false,
    true
FROM app.d_employee e
WHERE e.active_flag = true
LIMIT 50;

-- CAL-007: PMO Software Implementation Review (Project team)
INSERT INTO app.d_employee_calendar (
    code, name, employee_id, calendar_event_id,
    response_status, is_organizer, is_required, attended_flag
) VALUES
('EMP-CAL-PMO-001', 'James Miller - PMO Software Implementation Review',
 '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', '77777777-7777-7777-7777-777777777777',
 'accepted', true, true, false),
('EMP-CAL-PMO-002', 'Michael Chen - PMO Software Implementation Review',
 (SELECT id FROM app.d_employee WHERE email = 'michael.chen@huronhome.ca'),
 '77777777-7777-7777-7777-777777777777', 'accepted', false, true, false),
('EMP-CAL-PMO-003', 'Sarah Johnson - PMO Software Implementation Review',
 (SELECT id FROM app.d_employee WHERE email = 'sarah.johnson@huronhome.ca'),
 '77777777-7777-7777-7777-777777777777', 'accepted', false, true, false),
('EMP-CAL-PMO-004', 'David Thompson - PMO Software Implementation Review',
 (SELECT id FROM app.d_employee WHERE email = 'david.thompson@huronhome.ca'),
 '77777777-7777-7777-7777-777777777777', 'tentative', false, false, false);

-- CAL-008: Home Services Industry Conference (Executive team + department heads)
INSERT INTO app.d_employee_calendar (
    code, name, employee_id, calendar_event_id,
    response_status, is_organizer, is_required, attended_flag
) VALUES
('EMP-CAL-CONF-001', 'James Miller - Home Services Industry Conference',
 '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', '88888888-8888-8888-8888-888888888888',
 'accepted', true, false, false),
('EMP-CAL-CONF-002', 'Sarah Johnson - Home Services Industry Conference',
 (SELECT id FROM app.d_employee WHERE email = 'sarah.johnson@huronhome.ca'),
 '88888888-8888-8888-8888-888888888888', 'accepted', false, false, false),
('EMP-CAL-CONF-003', 'Michael Chen - Home Services Industry Conference',
 (SELECT id FROM app.d_employee WHERE email = 'michael.chen@huronhome.ca'),
 '88888888-8888-8888-8888-888888888888', 'accepted', false, false, false),
('EMP-CAL-CONF-004', 'Lisa Rodriguez - Home Services Industry Conference',
 (SELECT id FROM app.d_employee WHERE email = 'lisa.rodriguez@huronhome.ca'),
 '88888888-8888-8888-8888-888888888888', 'accepted', false, false, false);

-- CAL-009: Annual Performance Review - Executive Team
INSERT INTO app.d_employee_calendar (
    code, name, employee_id, calendar_event_id,
    response_status, is_organizer, is_required, attended_flag
) VALUES
('EMP-CAL-PERF-001', 'James Miller - Annual Performance Review',
 '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', '99999999-9999-9999-9999-999999999999',
 'accepted', true, true, false),
('EMP-CAL-PERF-002', 'Sarah Johnson - Annual Performance Review',
 (SELECT id FROM app.d_employee WHERE email = 'sarah.johnson@huronhome.ca'),
 '99999999-9999-9999-9999-999999999999', 'accepted', false, true, false),
('EMP-CAL-PERF-003', 'Michael Chen - Annual Performance Review',
 (SELECT id FROM app.d_employee WHERE email = 'michael.chen@huronhome.ca'),
 '99999999-9999-9999-9999-999999999999', 'accepted', false, true, false),
('EMP-CAL-PERF-004', 'Lisa Rodriguez - Annual Performance Review',
 (SELECT id FROM app.d_employee WHERE email = 'lisa.rodriguez@huronhome.ca'),
 '99999999-9999-9999-9999-999999999999', 'accepted', false, true, false);

-- CAL-010 & CAL-011: Christmas and Boxing Day - All employees
INSERT INTO app.d_employee_calendar (
    code, name, employee_id, calendar_event_id,
    response_status, is_organizer, is_required, attended_flag, notification_sent_flag
)
SELECT
    'EMP-CAL-XMAS-' || ROW_NUMBER() OVER (ORDER BY e.code),
    e.name || ' - Christmas Day',
    e.id,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'accepted',
    CASE WHEN e.id = '8260b1b0-5efc-4611-ad33-ee76c0cf7f13' THEN true ELSE false END,
    false,
    false,
    true
FROM app.d_employee e
WHERE e.active_flag = true
LIMIT 50;

INSERT INTO app.d_employee_calendar (
    code, name, employee_id, calendar_event_id,
    response_status, is_organizer, is_required, attended_flag, notification_sent_flag
)
SELECT
    'EMP-CAL-BOXING-' || ROW_NUMBER() OVER (ORDER BY e.code),
    e.name || ' - Boxing Day',
    e.id,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'accepted',
    CASE WHEN e.id = '8260b1b0-5efc-4611-ad33-ee76c0cf7f13' THEN true ELSE false END,
    false,
    false,
    true
FROM app.d_employee e
WHERE e.active_flag = true
LIMIT 50;

-- CAL-012: 2026 Strategic Planning Offsite (Executive team only)
INSERT INTO app.d_employee_calendar (
    code, name, employee_id, calendar_event_id,
    response_status, is_organizer, is_required, attended_flag
) VALUES
('EMP-CAL-STRAT-001', 'James Miller - Strategic Planning Offsite',
 '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
 'accepted', true, true, false),
('EMP-CAL-STRAT-002', 'Sarah Johnson - Strategic Planning Offsite',
 (SELECT id FROM app.d_employee WHERE email = 'sarah.johnson@huronhome.ca'),
 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'accepted', false, true, false),
('EMP-CAL-STRAT-003', 'Michael Chen - Strategic Planning Offsite',
 (SELECT id FROM app.d_employee WHERE email = 'michael.chen@huronhome.ca'),
 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'accepted', false, true, false),
('EMP-CAL-STRAT-004', 'Lisa Rodriguez - Strategic Planning Offsite',
 (SELECT id FROM app.d_employee WHERE email = 'lisa.rodriguez@huronhome.ca'),
 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'accepted', false, true, false),
('EMP-CAL-STRAT-005', 'David Thompson - Strategic Planning Offsite',
 (SELECT id FROM app.d_employee WHERE email = 'david.thompson@huronhome.ca'),
 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'tentative', false, false, false);

-- CAL-013: Monthly Safety Training Session (Field operations staff)
INSERT INTO app.d_employee_calendar (
    code, name, employee_id, calendar_event_id,
    response_status, is_organizer, is_required, attended_flag
)
SELECT
    'EMP-CAL-SAFETY-' || ROW_NUMBER() OVER (ORDER BY e.code),
    e.name || ' - Monthly Safety Training',
    e.id,
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'accepted',
    CASE WHEN e.email = 'sarah.johnson@huronhome.ca' THEN true ELSE false END,
    true,
    false
FROM app.d_employee e
WHERE e.active_flag = true
  AND e.department IN ('Landscaping', 'Snow Removal', 'HVAC', 'Plumbing', 'Solar Energy', 'Operations')
LIMIT 45;

-- CAL-014: Q4 Board of Directors Meeting (Executives + Board members)
INSERT INTO app.d_employee_calendar (
    code, name, employee_id, calendar_event_id,
    response_status, is_organizer, is_required, attended_flag
) VALUES
('EMP-CAL-BOARD-001', 'James Miller - Board Meeting Q4',
 '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
 'accepted', true, true, false),
('EMP-CAL-BOARD-002', 'Sarah Johnson - Board Meeting Q4',
 (SELECT id FROM app.d_employee WHERE email = 'sarah.johnson@huronhome.ca'),
 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'accepted', false, true, false),
('EMP-CAL-BOARD-003', 'Michael Chen - Board Meeting Q4',
 (SELECT id FROM app.d_employee WHERE email = 'michael.chen@huronhome.ca'),
 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'accepted', false, true, false),
('EMP-CAL-BOARD-004', 'Lisa Rodriguez - Board Meeting Q4',
 (SELECT id FROM app.d_employee WHERE email = 'lisa.rodriguez@huronhome.ca'),
 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'accepted', false, false, false);

-- CAL-015: Annual Customer Appreciation Event (Sales + Leadership)
INSERT INTO app.d_employee_calendar (
    code, name, employee_id, calendar_event_id,
    response_status, is_organizer, is_required, attended_flag
)
SELECT
    'EMP-CAL-CUST-' || ROW_NUMBER() OVER (ORDER BY e.code),
    e.name || ' - Customer Appreciation Event',
    e.id,
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'accepted',
    CASE WHEN e.email = 'lisa.rodriguez@huronhome.ca' THEN true ELSE false END,
    CASE WHEN e.department IN ('Sales', 'Executive') THEN true ELSE false END,
    false
FROM app.d_employee e
WHERE e.active_flag = true
  AND (e.department IN ('Sales', 'Executive', 'Customer Service')
       OR e.id = '8260b1b0-5efc-4611-ad33-ee76c0cf7f13')
LIMIT 30;

-- =====================================================
-- REGISTER IN d_entity_id_map (Link employees to calendar events)
-- =====================================================

INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT
    'calendar',
    ec.calendar_event_id::text,
    'employee',
    ec.employee_id::text,
    'attendee'
FROM app.d_employee_calendar ec
WHERE ec.active_flag = true
ON CONFLICT DO NOTHING;

-- =====================================================
-- REGISTER IN d_entity_instance_id
-- =====================================================

INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
SELECT 'employee_calendar', id, name, code
FROM app.d_employee_calendar
WHERE active_flag = true
ON CONFLICT (entity_type, entity_id) DO UPDATE
SET entity_name = EXCLUDED.entity_name,
    entity_code = EXCLUDED.entity_code,
    updated_ts = now();

-- =====================================================
-- STATISTICS AND VALIDATION
-- =====================================================

-- Show calendar event attendance summary
SELECT
    c.name as event_name,
    c.event_type,
    c.start_ts,
    COUNT(ec.id) as total_attendees,
    SUM(CASE WHEN ec.response_status = 'accepted' THEN 1 ELSE 0 END) as accepted,
    SUM(CASE WHEN ec.response_status = 'declined' THEN 1 ELSE 0 END) as declined,
    SUM(CASE WHEN ec.response_status = 'tentative' THEN 1 ELSE 0 END) as tentative,
    SUM(CASE WHEN ec.response_status = 'pending' THEN 1 ELSE 0 END) as pending
FROM app.d_calendar c
LEFT JOIN app.d_employee_calendar ec ON c.id = ec.calendar_event_id AND ec.active_flag = true
WHERE c.active_flag = true
GROUP BY c.id, c.name, c.event_type, c.start_ts
ORDER BY c.start_ts;

-- Show employee calendar load
SELECT
    e.name as employee_name,
    e.department,
    COUNT(ec.id) as total_events,
    SUM(CASE WHEN ec.is_required THEN 1 ELSE 0 END) as required_events,
    SUM(CASE WHEN ec.is_organizer THEN 1 ELSE 0 END) as organized_events
FROM app.d_employee e
LEFT JOIN app.d_employee_calendar ec ON e.id = ec.employee_id AND ec.active_flag = true
WHERE e.active_flag = true
  AND e.id IN (
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    (SELECT id FROM app.d_employee WHERE email = 'sarah.johnson@huronhome.ca'),
    (SELECT id FROM app.d_employee WHERE email = 'michael.chen@huronhome.ca'),
    (SELECT id FROM app.d_employee WHERE email = 'lisa.rodriguez@huronhome.ca'),
    (SELECT id FROM app.d_employee WHERE email = 'david.thompson@huronhome.ca')
  )
GROUP BY e.id, e.name, e.department
ORDER BY total_events DESC;

COMMENT ON TABLE app.d_employee_calendar IS 'Employee-Calendar mapping with curated attendance data for 15 events across 3 months';
