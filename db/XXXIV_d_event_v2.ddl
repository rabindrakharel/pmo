-- =====================================================
-- EVENT (d_event) - V2 with Organizer Support
-- Universal parent entity for all event-related linkages
-- =====================================================
--
-- MIGRATION: Add organizer_id to existing d_event table
--

-- Add organizer_id column to track who organized the event
ALTER TABLE app.d_event
ADD COLUMN IF NOT EXISTS organizer_id uuid;

-- Add organizer_type column to support polymorphic organizer (employee/customer)
ALTER TABLE app.d_event
ADD COLUMN IF NOT EXISTS organizer_type varchar(50) DEFAULT 'employee';

-- Add constraint for organizer_type
ALTER TABLE app.d_event
ADD CONSTRAINT chk_organizer_type CHECK (organizer_type IN ('employee', 'customer', 'client'));

-- Update existing events to set organizer from RBAC Owner permission
UPDATE app.d_event e
SET organizer_id = r.empid,
    organizer_type = 'employee'
FROM app.entity_id_rbac_map r
WHERE r.entity = 'event'
  AND r.entity_id = e.id::text
  AND r.permission @> ARRAY[5]
  AND e.organizer_id IS NULL;

-- Add comments for new columns
COMMENT ON COLUMN app.d_event.organizer_id IS 'UUID of the person who organized the event (polymorphic: employee, customer, or client)';
COMMENT ON COLUMN app.d_event.organizer_type IS 'Type of organizer: employee, customer, or client';

-- =====================================================
-- USEFUL QUERIES WITH ORGANIZER
-- =====================================================

-- Query: Get events with organizer details
-- SELECT
--   e.*,
--   CASE
--     WHEN e.organizer_type = 'employee' THEN emp.name
--     WHEN e.organizer_type = 'customer' THEN cust.name
--   END as organizer_name
-- FROM app.d_event e
-- LEFT JOIN app.d_employee emp ON e.organizer_id = emp.id AND e.organizer_type = 'employee'
-- LEFT JOIN app.d_cust cust ON e.organizer_id = cust.id AND e.organizer_type = 'customer'
-- WHERE e.active_flag = true;