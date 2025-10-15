-- ============================================================================
-- 0. INITIAL SETUP - DROP AND RECREATE SCHEMA
-- ============================================================================
--
-- Purpose:
--   Clean slate setup for the PMO Enterprise database.
--   Drops existing app schema and recreates it fresh.
--   This ensures a consistent starting point for all DDL imports.
--
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing schema if it exists (CASCADE removes all dependent objects)
DROP SCHEMA IF EXISTS app CASCADE;

-- Recreate the app schema
CREATE SCHEMA app;

-- Set search path to app schema for convenience
SET search_path TO app, public;

COMMENT ON SCHEMA app IS 'PMO Enterprise application schema - Contains all business entities, metadata, and RBAC system';


