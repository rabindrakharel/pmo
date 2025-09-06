-- ============================================================================
-- DATABASE EXTENSIONS AND SCHEMA SETUP
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Database extensions and schema initialization for the PMO enterprise
--   platform. Provides foundational capabilities including UUID generation,
--   full-text search, geographic information systems, and JSON operations.
--
-- Extensions:
--   - pgcrypto: UUID generation and cryptographic functions
--   - pg_trgm: Full-text search with trigram matching
--   - postgis: Geographic information system capabilities
--   - btree_gin: Advanced indexing for multiple data types
--
-- Schema:
--   - app: Primary application schema for all tables and data
--
-- Integration:
--   - Must be loaded before all other DDL files
--   - Provides foundation for UUID primary keys across all tables
--   - Enables advanced search and geographic capabilities

-- ============================================================================
-- DDL:
-- ============================================================================

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- UUID generation and crypto functions
CREATE EXTENSION IF NOT EXISTS pg_trgm;       -- Full-text search with trigrams
CREATE EXTENSION IF NOT EXISTS postgis;       -- Geographic information system
CREATE EXTENSION IF NOT EXISTS btree_gin;     -- Advanced indexing support

-- Create application schema
DROP SCHEMA IF EXISTS app CASCADE;
CREATE SCHEMA IF NOT EXISTS app;

-- Set search path to prioritize app schema
SET search_path TO app, public;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA app TO PUBLIC;
GRANT CREATE ON SCHEMA app TO PUBLIC;

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- No data curation needed for extensions and schema setup