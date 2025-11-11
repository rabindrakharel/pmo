-- =====================================================
-- ENTITY PERSON CALENDAR (d_entity_person_calendar)
-- Universal calendar/booking system for employees and customers
-- =====================================================
--
-- SEMANTICS:
-- This table serves as a universal availability and booking calendar for employees, clients, and customers.
-- It defines WHEN and WHO for events, while d_event defines WHAT is happening.
--
-- KEY CONCEPTS:
-- 1. TIME SLOTS: Pre-seeded 15-minute intervals (9am-8pm) for scheduling
-- 2. AVAILABILITY: availability_flag=true means slot is open, false means booked
-- 3. EVENT LINKING: event_id links to d_event for full event details
-- 4. POLYMORPHIC PERSON: Supports employees, clients, and customers via person_entity_type/id
--
-- WORKFLOW:
-- 1. SEED SLOTS: Generate 15-minute slots for all active employees (9am-8pm, multiple days)
-- 2. CREATE EVENT: Define event in d_event table with details
-- 3. BOOK SLOTS: Update calendar slots with event_id and set availability_flag=false
-- 4. QUERY AVAILABILITY: Find open slots by filtering availability_flag=true
-- 5. CANCEL BOOKING: Set availability_flag=true, clear event_id
--
-- OPERATIONS:
-- • CREATE: POST /api/v1/calendar-slot, INSERT 15-minute slots with availability_flag=true
-- • UPDATE: PUT /api/v1/calendar-slot/{id}, book/unbook slots, update availability_flag
-- • DELETE: DELETE /api/v1/calendar-slot/{id}, active_flag=false (soft delete)
-- • LIST: GET /api/v1/calendar-slot, filters by person_entity_id/availability_flag/date range, RBAC enforced
-- • BOOK: POST /api/v1/calendar-slot/book, set availability_flag=false and link event_id
-- • CANCEL: POST /api/v1/calendar-slot/cancel, set availability_flag=true and clear event_id
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY (stable identifier)
-- • person_entity_type: varchar(50) ('employee', 'client', 'customer') - who this calendar belongs to
-- • person_entity_id: uuid NOT NULL - actual ID from d_employee, d_client, or d_cust
-- • from_ts: timestamptz NOT NULL - slot start time
-- • to_ts: timestamptz NOT NULL - slot end time
-- • timezone: varchar(50) DEFAULT 'America/Toronto' - timezone for the slot
-- • availability_flag: boolean DEFAULT true - true=available/open, false=booked/busy
-- • event_id: uuid - link to d_event for full event details (NULLABLE, set when booked)
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • person_entity_id → d_employee.id OR d_client.id OR d_cust.id (polymorphic)
-- • event_id → d_event.id (many calendar slots can reference one event)
-- • metadata can store additional context if needed
--
-- SEEDING STRATEGY:
-- • Generate 15-minute slots from 9am to 8pm (11 hours = 44 slots per day)
-- • Create for next 5 business days
-- • Apply to all active employees
-- • Total slots per employee: 44 slots/day × 5 days = 220 slots
--
-- MATCHING WORKFLOW:
-- 1. Customer requests appointment for Service X at Date Y, Time Z
-- 2. System queries: find employees with availability_flag=true, matching time range
-- 3. Present available slots to customer
-- 4. Create event in d_event with all details (action, medium, location, instructions)
-- 5. Update calendar slots: set availability_flag=false, link event_id
-- 6. Linked slots now show as booked and reference the event for full details
--
-- =====================================================

CREATE TABLE app.d_entity_person_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) UNIQUE NOT NULL,
  name varchar(200),
  descr text,
  metadata jsonb DEFAULT '{}'::jsonb,
  active_flag boolean DEFAULT true,
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now(),
  version integer DEFAULT 1,

  -- Person identification (polymorphic: employee, client, or customer)
  person_entity_type varchar(50) NOT NULL, -- 'employee', 'client', 'customer'
  person_entity_id uuid NOT NULL,

  -- Time slot details
  from_ts timestamptz NOT NULL,
  to_ts timestamptz NOT NULL,
  timezone varchar(50) DEFAULT 'America/Toronto',

  -- Availability tracking
  availability_flag boolean DEFAULT true, -- true=available/open, false=booked/busy

  -- Meeting/Appointment details (populated when booked)
  title varchar(200),

  -- Appointment logistics
  appointment_medium varchar(50), -- 'onsite', 'virtual'
  appointment_addr text, -- Physical address for onsite appointments
  instructions text, -- Special instructions, access codes, parking, pet info, etc.

  -- Link to event (references d_event.id)
  event_id uuid, -- Nullable: set when slot is booked to an event

  -- metadata structure (JSONB for flexibility):
  -- {
  --   "project_id": "uuid",
  --   "task_id": "uuid",
  --   "interaction_id": "uuid",
  --   "customer_id": "uuid",
  --   "booking_id": "uuid",
  --   "service_id": "uuid",
  --   "meeting_url": "https://zoom.us/...",
  --   "meeting_password": "...",
  --   "organizer_id": "uuid",
  --   "attendee_ids": ["uuid1", "uuid2"]
  -- }

  -- Notification tracking
  reminder_sent_flag boolean DEFAULT false,
  reminder_sent_ts timestamptz,
  confirmation_sent_flag boolean DEFAULT false,
  confirmation_sent_ts timestamptz,

  CONSTRAINT chk_person_entity_type CHECK (person_entity_type IN ('employee', 'client', 'customer')),
  CONSTRAINT chk_appointment_medium CHECK (appointment_medium IS NULL OR appointment_medium IN ('onsite', 'virtual')),
  CONSTRAINT chk_time_range CHECK (to_ts > from_ts)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

  WHERE active_flag = true AND person_entity_type = 'employee' AND availability_flag = true;

-- GIN index for JSONB metadata queries

-- =====================================================
-- HELPER FUNCTION: Generate 15-minute slots for date range
-- =====================================================

CREATE OR REPLACE FUNCTION app.generate_calendar_slots(
  p_person_entity_type varchar(50),
  p_person_entity_id uuid,
  p_start_date date,
  p_end_date date,
  p_timezone varchar(50) DEFAULT 'America/Toronto'
)
RETURNS void AS $$
DECLARE
  v_current_date date;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
  v_slot_counter integer;
  v_code_base varchar(20);
BEGIN
  -- Generate code base from person_entity_type
  v_code_base := CASE p_person_entity_type
    WHEN 'employee' THEN 'EMP-CAL'
    WHEN 'client' THEN 'CLI-CAL'
    WHEN 'customer' THEN 'CUS-CAL'
  END;

  -- Loop through each date
  v_current_date := p_start_date;
  WHILE v_current_date <= p_end_date LOOP
    -- Generate 44 slots per day (9am to 8pm, 15-minute intervals)
    -- 9:00, 9:15, 9:30, ..., 19:45 (last slot ends at 20:00)
    FOR v_slot_counter IN 0..43 LOOP
      -- Calculate slot start time
      v_slot_start := (v_current_date::text || ' 09:00:00')::timestamp AT TIME ZONE p_timezone + (v_slot_counter * interval '15 minutes');
      v_slot_end := v_slot_start + interval '15 minutes';

      -- Insert slot
      INSERT INTO app.d_entity_person_calendar (
        code,
        name,
        person_entity_type,
        person_entity_id,
        from_ts,
        to_ts,
        timezone,
        availability_flag,
        event_id
      ) VALUES (
        v_code_base || '-' || to_char(v_slot_start, 'YYYYMMDD-HH24MI') || '-' || substr(p_person_entity_id::text, 1, 8),
        'Available Slot - ' || to_char(v_slot_start, 'YYYY-MM-DD HH24:MI'),
        p_person_entity_type,
        p_person_entity_id,
        v_slot_start,
        v_slot_end,
        p_timezone,
        true,
        NULL
      )
      ON CONFLICT (code) DO NOTHING;
    END LOOP;

    -- Move to next date
    v_current_date := v_current_date + interval '1 day';
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION app.generate_calendar_slots IS 'Generate 15-minute calendar slots (9am-8pm) for a person across date range';

-- =====================================================
-- DATA CURATION:
-- =====================================================

DO $$
DECLARE
  v_start_date date := CURRENT_DATE;
  v_end_date date := CURRENT_DATE + interval '4 days';
  v_employee_id uuid;
BEGIN
  -- Generate slots for James Miller (CEO)
  PERFORM app.generate_calendar_slots(
    'employee',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    v_start_date,
    v_end_date,
    'America/Toronto'
  );

  -- Generate slots for other active employees (first 10)
  FOR v_employee_id IN
    SELECT id FROM app.d_employee
    WHERE active_flag = true
      AND id != '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
    LIMIT 10
  LOOP
    PERFORM app.generate_calendar_slots(
      'employee',
      v_employee_id,
      v_start_date,
      v_end_date,
      'America/Toronto'
    );
  END LOOP;
END;
$$;

-- =====================================================
-- SAMPLE BOOKINGS: Link calendar slots to events
-- =====================================================
-- Note: These updates link calendar slots to events created in 45_d_event.ddl
-- They must be run AFTER d_event is populated

-- Booking 1: James Miller - HVAC Consultation (Event EVT-HVAC-001)
UPDATE app.d_entity_person_calendar
SET
  availability_flag = false,
  event_id = (SELECT id FROM app.d_event WHERE code = 'EVT-HVAC-001'),
  name = 'HVAC Consultation - Thompson Residence'
WHERE person_entity_id = '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
  AND person_entity_type = 'employee'
  AND from_ts >= (CURRENT_DATE + interval '1 day' + interval '14 hours')
  AND to_ts <= (CURRENT_DATE + interval '1 day' + interval '15 hours')
  AND active_flag = true
  AND availability_flag = true;

-- Booking 2: James Miller - Virtual Project Review (Event EVT-PROJ-002)
UPDATE app.d_entity_person_calendar
SET
  availability_flag = false,
  event_id = (SELECT id FROM app.d_event WHERE code = 'EVT-PROJ-002'),
  name = 'Solar Installation Phase 2 Review'
WHERE person_entity_id = '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
  AND person_entity_type = 'employee'
  AND from_ts >= (CURRENT_DATE + interval '2 days' + interval '10 hours')
  AND to_ts <= (CURRENT_DATE + interval '2 days' + interval '11 hours')
  AND active_flag = true
  AND availability_flag = true;

-- Booking 3: Field technician - Emergency Plumbing (Event EVT-EMERG-003)
UPDATE app.d_entity_person_calendar
SET
  availability_flag = false,
  event_id = (SELECT id FROM app.d_event WHERE code = 'EVT-EMERG-003'),
  name = 'Emergency Plumbing Repair - Burst Pipe'
WHERE person_entity_type = 'employee'
  AND person_entity_id IN (
    SELECT id FROM app.d_employee
    WHERE department = 'Plumbing'
      AND active_flag = true
    LIMIT 1
  )
  AND from_ts >= (CURRENT_DATE + interval '9 hours')
  AND to_ts <= (CURRENT_DATE + interval '11 hours')
  AND active_flag = true
  AND availability_flag = true;

-- =====================================================
-- REGISTER IN d_entity_instance_id
-- =====================================================

INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
SELECT 'person_calendar', id, name, code
FROM app.d_entity_person_calendar
WHERE active_flag = true
ON CONFLICT (entity_type, entity_id) DO UPDATE
SET entity_name = EXCLUDED.entity_name,
    entity_code = EXCLUDED.entity_code,
    updated_ts = now();

-- =====================================================
-- USEFUL QUERIES
-- =====================================================

-- Query 1: Find available employee slots for a specific date/time range
-- SELECT * FROM app.d_entity_person_calendar
-- WHERE person_entity_type = 'employee'
--   AND availability_flag = true
--   AND from_ts >= '2025-11-06 14:00:00-05'::timestamptz
--   AND to_ts <= '2025-11-06 16:00:00-05'::timestamptz
--   AND active_flag = true
-- ORDER BY person_entity_id, from_ts;

-- Query 2: Get employee's booked appointments with event details
-- SELECT
--   e.name as employee_name,
--   c.from_ts,
--   c.to_ts,
--   c.name as slot_name,
--   ev.name as event_name,
--   ev.event_type,
--   ev.event_addr,
--   ev.event_instructions
-- FROM app.d_entity_person_calendar c
-- JOIN app.d_employee e ON c.person_entity_id = e.id
-- LEFT JOIN app.d_event ev ON c.event_id = ev.id
-- WHERE c.person_entity_type = 'employee'
--   AND c.availability_flag = false
--   AND c.active_flag = true
--   AND c.from_ts >= CURRENT_DATE
-- ORDER BY c.from_ts;

-- Query 3: Employee availability summary
-- SELECT
--   e.name,
--   COUNT(*) FILTER (WHERE c.availability_flag = true) as available_slots,
--   COUNT(*) FILTER (WHERE c.availability_flag = false) as booked_slots,
--   ROUND(100.0 * COUNT(*) FILTER (WHERE c.availability_flag = false) / COUNT(*), 2) as utilization_pct
-- FROM app.d_employee e
-- LEFT JOIN app.d_entity_person_calendar c ON e.id = c.person_entity_id
--   AND c.person_entity_type = 'employee'
--   AND c.active_flag = true
--   AND c.from_ts >= CURRENT_DATE
-- WHERE e.active_flag = true
-- GROUP BY e.id, e.name
-- ORDER BY utilization_pct DESC;

-- Query 4: Get all calendar slots for a specific event
-- SELECT
--   c.person_entity_id,
--   e.name as employee_name,
--   c.from_ts,
--   c.to_ts,
--   c.timezone
-- FROM app.d_entity_person_calendar c
-- JOIN app.d_employee e ON c.person_entity_id = e.id
-- WHERE c.event_id = '<event-uuid>'
--   AND c.active_flag = true
-- ORDER BY c.from_ts;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE app.d_entity_person_calendar IS 'Universal calendar/booking system with 15-minute slot granularity (9am-8pm). Pre-seeded availability slots that link to d_event when booked. Defines WHEN and WHO for events.';
COMMENT ON COLUMN app.d_entity_person_calendar.person_entity_type IS 'Type of person: employee, client, or customer';
COMMENT ON COLUMN app.d_entity_person_calendar.person_entity_id IS 'Polymorphic reference to d_employee, d_client, or d_cust';
COMMENT ON COLUMN app.d_entity_person_calendar.availability_flag IS 'true=available/open slot, false=booked/busy';
COMMENT ON COLUMN app.d_entity_person_calendar.event_id IS 'Link to d_event.id for full event details (null when slot is available, populated when booked)';
COMMENT ON COLUMN app.d_entity_person_calendar.from_ts IS 'Slot start time (timestamptz)';
COMMENT ON COLUMN app.d_entity_person_calendar.to_ts IS 'Slot end time (timestamptz)';
COMMENT ON COLUMN app.d_entity_person_calendar.timezone IS 'Timezone for the slot (default: America/Toronto)';
