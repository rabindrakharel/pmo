-- ============================================================================
-- Entity Instance Registry Backfill (v8.3.2)
-- ============================================================================
-- Populates entity_instance table with all existing entity instances from
-- primary tables. This enables:
--   - Entity dropdown caches (prefetchEntityInstances on login)
--   - ref_data_entityInstance resolution in API responses
--   - Entity name lookups for foreign key references
--
-- Import Order: Run AFTER 03_entity_instance.ddl and all business entity DDLs
-- ============================================================================

-- ============================================================================
-- CUSTOMER 360 DOMAIN
-- ============================================================================

-- Backfill employees (primary entity for dropdowns)
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'employee', id, name, code
FROM app.employee
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill offices
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'office', id, name, code
FROM app.office
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill businesses
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'business', id, name, code
FROM app.business
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill customers
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'cust', id, name, code
FROM app.cust
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill roles
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'role', id, name, code
FROM app.role
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill suppliers
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'supplier', id, name, code
FROM app.supplier
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill worksites
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'worksite', id, name, code
FROM app.worksite
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- ============================================================================
-- OPERATIONS DOMAIN
-- ============================================================================

-- Backfill projects
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'project', id, name, code
FROM app.project
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill tasks
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'task', id, name, code
FROM app.task
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill work orders
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'work_order', id, name, code
FROM app.work_order
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill services
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'service', id, name, code
FROM app.service
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PRODUCT & INVENTORY DOMAIN
-- ============================================================================

-- Backfill products
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'product', id, name, code
FROM app.product
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill inventory
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'inventory', id, name, code
FROM app.inventory
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ORDER & FULFILLMENT DOMAIN
-- ============================================================================

-- Backfill quotes
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'quote', id, name, code
FROM app.quote
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill orders
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'order', id, name, code
FROM app.order
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill shipments
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'shipment', id, name, code
FROM app.shipment
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill invoices
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'invoice', id, name, code
FROM app.invoice
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- ============================================================================
-- FINANCIAL DOMAIN
-- ============================================================================

-- Backfill revenue
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'revenue', id, name, code
FROM app.revenue
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- Backfill expenses
INSERT INTO app.entity_instance (entity_code, entity_instance_id, entity_instance_name, code)
SELECT 'expense', id, name, code
FROM app.expense
WHERE active_flag = true
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Verification query (run manually to check results)
-- ============================================================================
-- SELECT entity_code, COUNT(*) as count
-- FROM app.entity_instance
-- GROUP BY entity_code
-- ORDER BY count DESC;
