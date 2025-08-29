-- ============================================================================
-- EXTENSIONS AND SCHEMA SETUP
-- ============================================================================
DROP SCHEMA app cascade;
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS postgis; -- PostGIS for geometry
CREATE SCHEMA IF NOT EXISTS app;
