-- =====================================================
-- BOOKING ENTITY (d_booking)
-- Service appointment bookings from AI widget and other channels
-- =====================================================
--
-- SEMANTICS:
-- Booking represents service appointment requests created by customers through various channels
-- (AI chat widget, phone, email, web form). Tracks complete lifecycle from request to completion.
-- In-place updates (same ID, version++), soft delete for cancelled bookings preserving audit trail.
--
-- DATABASE BEHAVIOR:
-- • CREATE: INSERT with version=1, active_flag=true, booking_status='pending'
--   Example: INSERT INTO d_booking (id, booking_number, customer_name, customer_phone, service_id, requested_date)
--            VALUES ('b1111111-...', 'BK-2025-000001', 'David Chen', '416-555-1234', 'svc-uuid', '2025-11-11')
--
-- • UPDATE: Same ID, version++, updated_ts refreshes (status changes, assignments)
--   Example: UPDATE d_booking SET booking_status='confirmed', assigned_employee_id='emp-uuid',
--            version=version+1, confirmed_ts=now() WHERE id='b1111111-...'
--
-- • SOFT DELETE: active_flag=false, to_ts=now() (for cancelled bookings)
--   Example: UPDATE d_booking SET active_flag=false, to_ts=now(), booking_status='cancelled',
--            cancelled_ts=now(), cancellation_reason='Customer request' WHERE id='b1111111-...'
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY (stable identifier)
-- • booking_number: varchar(50) UNIQUE NOT NULL (human-readable: 'BK-2025-000001')
-- • booking_source: varchar(50) ('ai_widget', 'phone', 'email', 'web_form')
-- • customer_id: uuid (links to d_cust if existing customer, NULL for new prospects)
-- • service_id: uuid NOT NULL (links to d_service)
-- • requested_date: date NOT NULL (customer's preferred date)
-- • booking_status: varchar(50) ('pending', 'confirmed', 'assigned', 'in_progress', 'completed', 'cancelled', 'no_show')
-- • assigned_employee_id: uuid (links to d_employee when assigned)
-- • calendar_event_id: uuid (links to d_calendar when scheduled)
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • customer_id → d_cust.id
-- • service_id → d_service.id
-- • assigned_employee_id → d_employee.id
-- • calendar_event_id → d_calendar.id
-- • interaction_session_id → f_customer_interaction.id (links to chat conversation)
--
-- LIFECYCLE FLOW:
-- 1. pending → confirmed (admin confirms booking)
-- 2. confirmed → assigned (employee assigned)
-- 3. assigned → in_progress (employee starts service)
-- 4. in_progress → completed (service finished)
-- Alternative paths: any status → cancelled (customer/admin cancels)
--
-- =====================================================

CREATE TABLE app.d_booking (
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

    -- Booking identification
    booking_number varchar(50) UNIQUE NOT NULL,
    booking_source varchar(50) DEFAULT 'ai_widget',

    -- Customer information (may be new prospect without d_cust record)
    customer_id uuid,
    customer_name varchar(200) NOT NULL,
    customer_email varchar(200),
    customer_phone varchar(50) NOT NULL,
    customer_address text,
    customer_city varchar(100),
    customer_province varchar(50),
    customer_postal_code varchar(20),

    -- Service details
    service_id uuid NOT NULL,
    service_name varchar(200) NOT NULL,
    service_category varchar(100),

    -- Scheduling
    requested_date date NOT NULL,
    requested_time_start time,
    requested_time_end time,
    scheduled_ts timestamptz,
    actual_start_ts timestamptz,
    actual_end_ts timestamptz,

    -- Assignment
    assigned_employee_id uuid,
    assigned_employee_name varchar(200),
    assigned_team_id uuid,

    -- Status tracking
    booking_status varchar(50) DEFAULT 'pending',

    -- Pricing
    estimated_cost_amt decimal(15,2),
    quoted_cost_amt decimal(15,2),
    final_cost_amt decimal(15,2),
    deposit_amt decimal(15,2),
    deposit_paid_flag boolean DEFAULT false,

    -- Customer requirements
    special_instructions text,
    urgency_level varchar(20) DEFAULT 'normal',
    property_access_instructions text,
    parking_instructions text,
    pet_information text,

    -- Lifecycle timestamps
    confirmed_ts timestamptz,
    confirmed_by_employee_id uuid,
    assigned_ts timestamptz,
    assigned_by_employee_id uuid,
    started_ts timestamptz,
    completed_ts timestamptz,
    cancelled_ts timestamptz,
    cancellation_reason text,
    cancelled_by_employee_id uuid,

    -- Related entities
    calendar_event_id uuid,
    interaction_session_id uuid,
    project_id uuid,

    -- Notification tracking
    confirmation_email_sent_flag boolean DEFAULT false,
    confirmation_email_sent_ts timestamptz,
    confirmation_sms_sent_flag boolean DEFAULT false,
    confirmation_sms_sent_ts timestamptz,
    reminder_sent_flag boolean DEFAULT false,
    reminder_sent_ts timestamptz,

    -- Follow-up & satisfaction
    follow_up_required_flag boolean DEFAULT false,
    follow_up_completed_flag boolean DEFAULT false,
    follow_up_notes text,
    customer_rating integer,
    customer_feedback text,
    would_recommend_flag boolean,

    -- Weather & external factors
    weather_conditions varchar(100),
    weather_impact_flag boolean DEFAULT false,
    rescheduled_flag boolean DEFAULT false,
    rescheduled_from_date date,
    reschedule_reason text,

    CONSTRAINT chk_booking_status CHECK (booking_status IN
        ('pending', 'confirmed', 'assigned', 'in_progress', 'completed', 'cancelled', 'no_show')),
    CONSTRAINT chk_urgency_level CHECK (urgency_level IN ('low', 'normal', 'high', 'emergency')),
    CONSTRAINT chk_customer_rating CHECK (customer_rating BETWEEN 1 AND 5)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_booking_number ON app.d_booking(booking_number);
CREATE INDEX idx_booking_customer ON app.d_booking(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_booking_service ON app.d_booking(service_id);
CREATE INDEX idx_booking_employee ON app.d_booking(assigned_employee_id) WHERE assigned_employee_id IS NOT NULL;
CREATE INDEX idx_booking_date ON app.d_booking(requested_date) WHERE active_flag = true;
CREATE INDEX idx_booking_scheduled_ts ON app.d_booking(scheduled_ts) WHERE scheduled_ts IS NOT NULL;
CREATE INDEX idx_booking_status ON app.d_booking(booking_status) WHERE active_flag = true;
CREATE INDEX idx_booking_calendar ON app.d_booking(calendar_event_id) WHERE calendar_event_id IS NOT NULL;
CREATE INDEX idx_booking_interaction ON app.d_booking(interaction_session_id) WHERE interaction_session_id IS NOT NULL;
CREATE INDEX idx_booking_source ON app.d_booking(booking_source);
CREATE INDEX idx_booking_created_ts ON app.d_booking(created_ts DESC);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_ts timestamp
CREATE OR REPLACE FUNCTION app.update_booking_updated_ts() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_ts := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_update_timestamp
    BEFORE UPDATE ON app.d_booking
    FOR EACH ROW EXECUTE FUNCTION app.update_booking_updated_ts();

-- =====================================================
-- SAMPLE DATA (for testing)
-- =====================================================

-- Booking 1: Pending booking from AI widget
INSERT INTO app.d_booking (
    code, name, booking_number, booking_source,
    customer_name, customer_email, customer_phone, customer_address,
    customer_city, customer_province, customer_postal_code,
    service_id, service_name, service_category,
    requested_date, requested_time_start,
    booking_status, estimated_cost_amt, urgency_level,
    special_instructions
) VALUES (
    'BK-001',
    'HVAC Maintenance - Nov 11, 2025',
    'BK-2025-000001',
    'ai_widget',
    'David Chen',
    'david.chen@example.com',
    '416-555-1234',
    '123 Main St',
    'Toronto',
    'ON',
    'M4W 1N4',
    (SELECT id FROM app.d_service WHERE code = 'SVC-HVAC-002'),
    'HVAC Maintenance Service',
    'HVAC',
    '2025-11-11',
    '14:00:00',
    'pending',
    250.00,
    'normal',
    'Please call 10 minutes before arrival'
);

-- Booking 2: Confirmed booking with employee assigned
INSERT INTO app.d_booking (
    code, name, booking_number, booking_source,
    customer_id, customer_name, customer_email, customer_phone,
    service_id, service_name, service_category,
    requested_date, requested_time_start, scheduled_ts,
    assigned_employee_id, assigned_employee_name,
    booking_status, estimated_cost_amt, confirmed_ts
) VALUES (
    'BK-002',
    'Plumbing Repair - Nov 12, 2025',
    'BK-2025-000002',
    'phone',
    (SELECT id FROM app.d_cust WHERE code = 'CL-RES-001'),
    'Robert Thompson',
    'robert.thompson@email.com',
    '416-555-0101',
    (SELECT id FROM app.d_service WHERE code = 'SVC-PLUMB-002'),
    'Drain Cleaning Service',
    'Plumbing',
    '2025-11-12',
    '10:00:00',
    '2025-11-12 10:00:00-05',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    'James Miller',
    'confirmed',
    350.00,
    now()
);

-- =====================================================
-- REGISTER IN d_entity_instance_id
-- =====================================================

INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
SELECT 'booking', id, name, code
FROM app.d_booking
WHERE active_flag = true
ON CONFLICT (entity_type, entity_id) DO UPDATE
SET entity_name = EXCLUDED.entity_name,
    entity_code = EXCLUDED.entity_code,
    updated_ts = now();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE app.d_booking IS 'Service appointment bookings from AI widget and other channels';
COMMENT ON COLUMN app.d_booking.booking_number IS 'Human-readable booking identifier (BK-2025-000001)';
COMMENT ON COLUMN app.d_booking.booking_source IS 'Channel through which booking was created (ai_widget, phone, email, web_form)';
COMMENT ON COLUMN app.d_booking.customer_id IS 'Link to d_cust if existing customer, NULL for new prospects';
COMMENT ON COLUMN app.d_booking.interaction_session_id IS 'Link to f_customer_interaction for AI chat conversation that created this booking';
COMMENT ON COLUMN app.d_booking.calendar_event_id IS 'Link to d_calendar when booking is scheduled as calendar event';
COMMENT ON COLUMN app.d_booking.booking_status IS 'Current status: pending, confirmed, assigned, in_progress, completed, cancelled, no_show';
