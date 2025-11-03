-- ============================================================================
-- Entity Instance Registry Backfill
-- ============================================================================
-- This file backfills d_entity_instance_id with all existing entity instances
-- from entity tables that were imported before the registry table was created.
--
-- Purpose: Enable child-tabs API and entity navigation for quotes, work orders,
--          services, and products.
--
-- Import Order: This file MUST run AFTER 31_d_entity_instance_id.ddl
-- ============================================================================

-- Register all quotes
INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
SELECT 'quote', id, name, code
FROM app.fact_quote
ON CONFLICT (entity_type, entity_id) DO UPDATE
SET entity_name = EXCLUDED.entity_name, entity_code = EXCLUDED.entity_code, updated_ts = NOW();

-- Register all work orders
INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
SELECT 'work_order', id, name, code
FROM app.fact_work_order
ON CONFLICT (entity_type, entity_id) DO UPDATE
SET entity_name = EXCLUDED.entity_name, entity_code = EXCLUDED.entity_code, updated_ts = NOW();

-- Register all services
INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
SELECT 'service', id, name, code
FROM app.d_service
ON CONFLICT (entity_type, entity_id) DO UPDATE
SET entity_name = EXCLUDED.entity_name, entity_code = EXCLUDED.entity_code, updated_ts = NOW();

-- Register all products
INSERT INTO app.d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
SELECT 'product', id, name, code
FROM app.d_product
ON CONFLICT (entity_type, entity_id) DO UPDATE
SET entity_name = EXCLUDED.entity_name, entity_code = EXCLUDED.entity_code, updated_ts = NOW();

COMMENT ON EXTENSION IF EXISTS plpgsql IS 'Entity instance backfill completed for quote, work_order, service, and product entities';
