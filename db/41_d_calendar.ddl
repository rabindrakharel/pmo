-- =====================================================
-- CALENDAR ENTITY (d_calendar) - EVENT & SCHEDULING ENTITY
-- Calendar events, meetings, appointments, and time-off management
-- =====================================================
--
-- SEMANTICS:
-- Calendar events represent scheduled activities including meetings, appointments, training sessions,
-- holidays, and time-off. Events can be recurring or one-time, with support for virtual/physical locations.
-- Employee participation tracked via d_employee_calendar linkage table.
-- In-place updates (same ID, version++), soft delete for cancelled events preserving audit trail.
--
-- DATABASE BEHAVIOR:
-- • CREATE: INSERT with version=1, active_flag=true
--   Example: INSERT INTO d_calendar (id, code, name, event_type, start_ts, end_ts, organizer_employee_id)
--            VALUES ('c1111111-...', 'CAL-001', 'Executive Team Meeting', 'meeting',
--                    '2025-11-05 09:00:00-05', '2025-11-05 10:00:00-05',
--                    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13')
--
-- • UPDATE: Same ID, version++, updated_ts refreshes
--   Example: UPDATE d_calendar SET location='Conference Room B', meeting_url='https://zoom.us/j/123',
--            version=version+1 WHERE id='c1111111-...'
--
-- • SOFT DELETE: active_flag=false, to_ts=now() (for cancelled events)
--   Example: UPDATE d_calendar SET active_flag=false, to_ts=now(), dl__event_status='cancelled'
--            WHERE id='c1111111-...'
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY (stable forever)
-- • code: varchar(50) UNIQUE NOT NULL ('CAL-001')
-- • name: varchar(200) NOT NULL ('Executive Team Meeting')
-- • event_type: varchar(50) ('meeting', 'appointment', 'time-off', 'holiday', 'training', 'conference', 'review')
-- • start_ts, end_ts: timestamptz (event duration with timezone support)
-- • location: varchar(200) (physical location or 'Virtual')
-- • meeting_url: text (Zoom, Teams, Meet URLs for virtual meetings)
-- • is_all_day_event: boolean (true for holidays, time-off days)
-- • is_recurring: boolean (true for repeating events)
-- • recurrence_pattern: varchar(50) ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')
-- • recurrence_end_date: date (when recurring series ends)
-- • dl__event_status: text (setting_datalabel: 'scheduled', 'confirmed', 'cancelled', 'completed')
-- • dl__event_priority: text (setting_datalabel: 'low', 'medium', 'high', 'urgent')
-- • visibility: varchar(50) ('public', 'private', 'confidential')
-- • organizer_employee_id: uuid (employee who created/owns the event)
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • Organizer: organizer_employee_id → d_employee.id
-- • Attendees: via d_employee_calendar (many-to-many with response tracking)
-- • Optional: Link to projects, tasks via metadata or d_entity_id_map
--
-- RECURRING EVENTS:
-- • Master event stored with is_recurring=true and recurrence_pattern
-- • Each occurrence can be individually modified or cancelled
-- • Recurrence patterns: daily, weekly, biweekly, monthly, quarterly, yearly
--
-- =====================================================

CREATE TABLE app.d_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) UNIQUE NOT NULL,
  name varchar(200) NOT NULL,
  descr text,
  metadata jsonb DEFAULT '{}'::jsonb,
  active_flag boolean DEFAULT true,
  from_ts timestamptz DEFAULT now(),
  to_ts timestamptz,
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now(),
  version integer DEFAULT 1,

  -- Calendar event specific fields
  event_type varchar(50) DEFAULT 'meeting', -- meeting, appointment, time-off, holiday, training, conference, review
  start_ts timestamptz NOT NULL,
  end_ts timestamptz NOT NULL,

  -- Location and meeting details
  location varchar(200),
  meeting_url text,
  meeting_password varchar(100),
  is_all_day_event boolean DEFAULT false,

  -- Recurrence settings
  is_recurring boolean DEFAULT false,
  recurrence_pattern varchar(50), -- daily, weekly, biweekly, monthly, quarterly, yearly
  recurrence_end_date date,
  parent_event_id uuid, -- For recurring event instances that reference master event

  -- Status and priority
  dl__event_status text DEFAULT 'scheduled', -- scheduled, confirmed, cancelled, completed
  dl__event_priority text DEFAULT 'medium', -- low, medium, high, urgent

  -- Visibility and permissions
  visibility varchar(50) DEFAULT 'public', -- public, private, confidential

  -- Organizer
  organizer_employee_id uuid NOT NULL,

  -- Additional details
  agenda text,
  notes text,
  attachments_count integer DEFAULT 0,
  attendees_count integer DEFAULT 0,

  -- Reminders
  reminder_minutes_before integer DEFAULT 15,
  send_reminder_flag boolean DEFAULT true,

  -- Integration fields
  external_event_id varchar(200), -- For syncing with Google Calendar, Outlook, etc.
  external_calendar_source varchar(100) -- 'google', 'outlook', 'apple', 'internal'
);

COMMENT ON TABLE app.d_calendar IS 'Calendar events including meetings, appointments, time-off, and holidays';

-- =====================================================
-- SAMPLE CALENDAR DATA (Next 3 Months)
-- =====================================================

-- Executive Team Meetings (Weekly - Every Monday 9:00 AM)
INSERT INTO app.d_calendar (
    id, code, name, descr, event_type, start_ts, end_ts,
    location, meeting_url, is_recurring, recurrence_pattern, recurrence_end_date,
    dl__event_status, dl__event_priority, visibility, organizer_employee_id,
    agenda, attendees_count, metadata
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    'CAL-001',
    'Executive Team Weekly Meeting',
    'Weekly executive leadership team meeting to review company performance, strategic initiatives, and critical decisions.',
    'meeting',
    '2025-11-10 09:00:00-05',
    '2025-11-10 10:30:00-05',
    'Executive Boardroom',
    'https://zoom.us/j/executive-team-001',
    true,
    'weekly',
    '2026-02-10',
    'confirmed',
    'high',
    'confidential',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    'Weekly review: 1) KPIs and metrics, 2) Strategic initiatives update, 3) Department reports, 4) Open issues',
    4,
    '{"project_review": true, "requires_prep": true, "recording_enabled": true}'::jsonb
);

-- All-Hands Company Meeting (Monthly - First Friday)
INSERT INTO app.d_calendar (
    id, code, name, descr, event_type, start_ts, end_ts,
    location, meeting_url, is_recurring, recurrence_pattern, recurrence_end_date,
    dl__event_status, dl__event_priority, visibility, organizer_employee_id,
    agenda, attendees_count, metadata
) VALUES (
    '22222222-2222-2222-2222-222222222222',
    'CAL-002',
    'All-Hands Company Meeting',
    'Monthly all-staff meeting for company updates, recognition, and Q&A with leadership.',
    'meeting',
    '2025-11-07 14:00:00-05',
    '2025-11-07 15:00:00-05',
    'Virtual',
    'https://zoom.us/j/all-hands-monthly',
    true,
    'monthly',
    '2026-02-07',
    'confirmed',
    'high',
    'public',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '1) CEO opening remarks, 2) Company performance updates, 3) Department highlights, 4) Employee recognition, 5) Q&A',
    520,
    '{"mandatory_attendance": true, "recording_enabled": true, "qa_session": true}'::jsonb
);

-- Operations Review Meeting (Biweekly - Every other Tuesday)
INSERT INTO app.d_calendar (
    id, code, name, descr, event_type, start_ts, end_ts,
    location, meeting_url, is_recurring, recurrence_pattern, recurrence_end_date,
    dl__event_status, dl__event_priority, visibility, organizer_employee_id,
    attendees_count, metadata
) VALUES (
    '33333333-3333-3333-3333-333333333333',
    'CAL-003',
    'Operations Review Meeting',
    'Biweekly operations review covering field operations, project status, resource allocation, and operational challenges.',
    'meeting',
    '2025-11-11 10:00:00-05',
    '2025-11-11 11:30:00-05',
    'Operations Center - Conference Room A',
    NULL,
    true,
    'biweekly',
    '2026-02-11',
    'confirmed',
    'high',
    'internal',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    15,
    '{"departments": ["Landscaping", "Snow Removal", "HVAC", "Plumbing", "Solar Energy"]}'::jsonb
);

-- Technology Planning Session
INSERT INTO app.d_calendar (
    id, code, name, descr, event_type, start_ts, end_ts,
    location, meeting_url, dl__event_status, dl__event_priority, visibility,
    organizer_employee_id, attendees_count, metadata
) VALUES (
    '44444444-4444-4444-4444-444444444444',
    'CAL-004',
    'Q4 Technology Planning Session',
    'Quarterly technology strategy and planning session to review infrastructure, security, and innovation initiatives.',
    'meeting',
    '2025-11-15 13:00:00-05',
    '2025-11-15 16:00:00-05',
    'IT Department - Conference Room',
    'https://teams.microsoft.com/tech-planning-q4',
    'scheduled',
    'high',
    'internal',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    8,
    '{"quarter": "Q4-2025", "budget_review": true, "security_audit": true}'::jsonb
);

-- Sales Team Training
INSERT INTO app.d_calendar (
    id, code, name, descr, event_type, start_ts, end_ts,
    location, meeting_url, dl__event_status, dl__event_priority, visibility,
    organizer_employee_id, agenda, attendees_count, metadata
) VALUES (
    '55555555-5555-5555-5555-555555555555',
    'CAL-005',
    'Sales Excellence Training Workshop',
    'Full-day training workshop on advanced sales techniques, customer relationship management, and pipeline optimization.',
    'training',
    '2025-11-20 09:00:00-05',
    '2025-11-20 17:00:00-05',
    'Training Center - Main Hall',
    NULL,
    'confirmed',
    'medium',
    'internal',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '1) Advanced sales techniques (9-11am), 2) CRM best practices (11-12pm), 3) Lunch (12-1pm), 4) Pipeline management (1-3pm), 5) Role-playing exercises (3-5pm)',
    25,
    '{"training_type": "sales", "certification": false, "catering_required": true}'::jsonb
);

-- Holiday: Remembrance Day (Canada)
INSERT INTO app.d_calendar (
    id, code, name, descr, event_type, start_ts, end_ts,
    is_all_day_event, dl__event_status, dl__event_priority, visibility,
    organizer_employee_id, attendees_count, metadata
) VALUES (
    '66666666-6666-6666-6666-666666666666',
    'CAL-006',
    'Remembrance Day (Statutory Holiday)',
    'Canadian statutory holiday honoring armed forces members. All offices closed.',
    'holiday',
    '2025-11-11 00:00:00-05',
    '2025-11-11 23:59:59-05',
    true,
    'confirmed',
    'high',
    'public',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    520,
    '{"country": "Canada", "statutory_holiday": true, "paid_holiday": true}'::jsonb
);

-- Project Review: PMO Software Implementation
INSERT INTO app.d_calendar (
    id, code, name, descr, event_type, start_ts, end_ts,
    location, meeting_url, dl__event_status, dl__event_priority, visibility,
    organizer_employee_id, agenda, attendees_count, metadata
) VALUES (
    '77777777-7777-7777-7777-777777777777',
    'CAL-007',
    'PMO Software Implementation Review',
    'Project review meeting for PMO software implementation progress, challenges, and next steps.',
    'review',
    '2025-11-18 14:00:00-05',
    '2025-11-18 15:30:00-05',
    'Conference Room C',
    'https://zoom.us/j/pmo-review-001',
    'scheduled',
    'high',
    'internal',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '1) Implementation progress update, 2) User adoption metrics, 3) Technical challenges, 4) Training needs, 5) Timeline review',
    12,
    '{"project_id": "93106ffb-402e-43a7-8b26-5287e37a1b0e", "milestone_review": true}'::jsonb
);

-- Customer Success Conference
INSERT INTO app.d_calendar (
    id, code, name, descr, event_type, start_ts, end_ts,
    location, dl__event_status, dl__event_priority, visibility,
    organizer_employee_id, attendees_count, metadata
) VALUES (
    '88888888-8888-8888-8888-888888888888',
    'CAL-008',
    'Home Services Industry Conference 2025',
    'Annual home services industry conference in Toronto featuring keynotes, workshops, and networking opportunities.',
    'conference',
    '2025-12-03 08:00:00-05',
    '2025-12-05 17:00:00-05',
    'Metro Toronto Convention Centre',
    'scheduled',
    'medium',
    'public',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    10,
    '{"conference_name": "HSIC 2025", "registration_required": true, "travel_required": true, "hotel_booked": false}'::jsonb
);

-- Year-End Performance Reviews
INSERT INTO app.d_calendar (
    id, code, name, descr, event_type, start_ts, end_ts,
    location, dl__event_status, dl__event_priority, visibility,
    organizer_employee_id, metadata
) VALUES (
    '99999999-9999-9999-9999-999999999999',
    'CAL-009',
    'Annual Performance Review - Executive Team',
    'Year-end performance reviews and goal-setting for executive leadership team.',
    'review',
    '2025-12-16 09:00:00-05',
    '2025-12-16 17:00:00-05',
    'Executive Boardroom',
    'scheduled',
    'high',
    'confidential',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '{"review_period": "2025", "compensation_review": true, "goals_setting": true}'::jsonb
);

-- Holiday: Christmas Day
INSERT INTO app.d_calendar (
    id, code, name, descr, event_type, start_ts, end_ts,
    is_all_day_event, dl__event_status, dl__event_priority, visibility,
    organizer_employee_id, attendees_count, metadata
) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'CAL-010',
    'Christmas Day (Statutory Holiday)',
    'Canadian statutory holiday. All offices closed.',
    'holiday',
    '2025-12-25 00:00:00-05',
    '2025-12-25 23:59:59-05',
    true,
    'confirmed',
    'high',
    'public',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    520,
    '{"country": "Canada", "statutory_holiday": true, "paid_holiday": true}'::jsonb
);

-- Holiday: Boxing Day
INSERT INTO app.d_calendar (
    id, code, name, descr, event_type, start_ts, end_ts,
    is_all_day_event, dl__event_status, dl__event_priority, visibility,
    organizer_employee_id, attendees_count, metadata
) VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'CAL-011',
    'Boxing Day (Statutory Holiday)',
    'Canadian statutory holiday. All offices closed.',
    'holiday',
    '2025-12-26 00:00:00-05',
    '2025-12-26 23:59:59-05',
    true,
    'confirmed',
    'high',
    'public',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    520,
    '{"country": "Canada", "statutory_holiday": true, "paid_holiday": true}'::jsonb
);

-- New Year Strategy Planning
INSERT INTO app.d_calendar (
    id, code, name, descr, event_type, start_ts, end_ts,
    location, dl__event_status, dl__event_priority, visibility,
    organizer_employee_id, agenda, attendees_count, metadata
) VALUES (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'CAL-012',
    '2026 Strategic Planning Offsite',
    'Two-day executive offsite for 2026 strategic planning, goal setting, and leadership alignment.',
    'meeting',
    '2026-01-07 09:00:00-05',
    '2026-01-08 17:00:00-05',
    'Blue Mountain Resort - Conference Center',
    'confirmed',
    'urgent',
    'confidential',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    'Day 1: Vision, mission review, market analysis, competitive positioning. Day 2: Goal setting, budget allocation, initiative prioritization',
    5,
    '{"offsite_location": "Blue Mountain", "accommodation_required": true, "budget": 15000, "strategic_planning": true}'::jsonb
);

-- Safety Training (Monthly - Recurring)
INSERT INTO app.d_calendar (
    id, code, name, descr, event_type, start_ts, end_ts,
    location, is_recurring, recurrence_pattern, recurrence_end_date,
    dl__event_status, dl__event_priority, visibility,
    organizer_employee_id, attendees_count, metadata
) VALUES (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'CAL-013',
    'Monthly Safety Training Session',
    'Mandatory monthly safety training for field operations staff covering safety protocols, equipment handling, and incident prevention.',
    'training',
    '2025-11-27 13:00:00-05',
    '2025-11-27 15:00:00-05',
    'Training Center - Room B',
    true,
    'monthly',
    '2026-02-27',
    'confirmed',
    'high',
    'internal',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    45,
    '{"mandatory": true, "certification_required": true, "wsib_compliant": true}'::jsonb
);

-- Board of Directors Meeting (Quarterly)
INSERT INTO app.d_calendar (
    id, code, name, descr, event_type, start_ts, end_ts,
    location, meeting_url, dl__event_status, dl__event_priority, visibility,
    organizer_employee_id, agenda, attendees_count, metadata
) VALUES (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'CAL-014',
    'Q4 2025 Board of Directors Meeting',
    'Quarterly board meeting to review financial performance, strategic initiatives, and governance matters.',
    'meeting',
    '2025-12-12 10:00:00-05',
    '2025-12-12 14:00:00-05',
    'Executive Boardroom',
    'https://zoom.us/j/board-meeting-q4',
    'confirmed',
    'urgent',
    'confidential',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    '1) Financial review Q4, 2) Strategic initiatives update, 3) Risk assessment, 4) Governance matters, 5) Executive compensation',
    8,
    '{"board_meeting": true, "financial_report_required": true, "confidential_materials": true}'::jsonb
);

-- Customer Appreciation Event
INSERT INTO app.d_calendar (
    id, code, name, descr, event_type, start_ts, end_ts,
    location, dl__event_status, dl__event_priority, visibility,
    organizer_employee_id, attendees_count, metadata
) VALUES (
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'CAL-015',
    'Annual Customer Appreciation Event',
    'Year-end customer appreciation event featuring networking, dinner, and recognition of long-term partnerships.',
    'meeting',
    '2025-12-10 18:00:00-05',
    '2025-12-10 22:00:00-05',
    'The Grand Victorian - Ballroom',
    'scheduled',
    'medium',
    'public',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    150,
    '{"event_type": "customer_appreciation", "catering": true, "budget": 25000, "invitations_sent": 200}'::jsonb
);

-- =====================================================
-- REGISTER CALENDAR EVENTS IN d_entity_instance_id
-- =====================================================

INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
SELECT 'calendar', id, name, code
FROM app.d_calendar
WHERE active_flag = true
ON CONFLICT (entity_type, entity_id) DO UPDATE
SET entity_name = EXCLUDED.entity_name,
    entity_code = EXCLUDED.entity_code,
    updated_ts = now();

COMMENT ON TABLE app.d_calendar IS 'Calendar events with curated data for next 3 months including meetings, holidays, training, and conferences';
