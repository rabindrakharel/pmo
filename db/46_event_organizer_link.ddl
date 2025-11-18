-- =====================================================
-- EVENT (d_event) - Add organizer_employee_id column
-- Universal parent entity for all event-related linkages
-- =====================================================
--
-- MIGRATION: Add organizer_employee_id, venue_type, and event_action_entity columns to existing d_event table
--

-- Add organizer_employee_id column to track which employee organized the event
ALTER TABLE app.event
ADD COLUMN IF NOT EXISTS organizer_employee_id uuid;

-- Add venue_type column for better event categorization
ALTER TABLE app.event
ADD COLUMN IF NOT EXISTS venue_type varchar(100);

-- Add event_action_entity columns to track what entity the event is about
ALTER TABLE app.event
ADD COLUMN IF NOT EXISTS event_action_entity_type varchar(100);

ALTER TABLE app.event
ADD COLUMN IF NOT EXISTS event_action_entity_id uuid;

-- Update existing events to set organizer_employee_id from RBAC Owner permission
UPDATE app.event e
SET organizer_employee_id = r.person_id
FROM app.entity_rbac r
WHERE r.entity_code = 'event'
  AND r.entity_instance_id = e.id
  AND r.permission = 7
  AND r.person_code = 'employee'
  AND e.organizer_employee_id IS NULL;

-- Add comments for new columns
COMMENT ON COLUMN app.event.organizer_employee_id IS 'UUID of the employee who organized the event';
COMMENT ON COLUMN app.event.venue_type IS 'Type of venue: conference_room, office, warehouse, customer_site, remote, etc.';
COMMENT ON COLUMN app.event.event_action_entity_type IS 'Type of entity this event is about: service, product, project, task, or quote';
COMMENT ON COLUMN app.event.event_action_entity_id IS 'UUID of the entity this event is about (service ID, task ID, quote ID, etc.)';

-- =====================================================
-- USEFUL QUERIES WITH ORGANIZER
-- =====================================================

-- Query: Get events with organizer details
-- SELECT
--   e.*,
--   emp.name as organizer_name,
--   emp.email as organizer_email
-- FROM app.event e
-- LEFT JOIN app.app.employee emp ON e.organizer_employee_id = emp.id
-- WHERE e.active_flag = true;