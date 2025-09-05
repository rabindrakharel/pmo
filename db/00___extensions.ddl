-- ============================================================================
-- EXTENSIONS AND SCHEMA SETUP
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- 🗄️ **DATABASE FOUNDATION**
-- • PostgreSQL extensions setup
-- • Schema initialization
-- • Core database capabilities
--
-- 🔧 **EXTENSIONS ENABLED**
-- • pgcrypto: UUID generation & cryptographic functions
-- • PostGIS: Geographic & spatial data support
--
-- 📊 **SCHEMA STRUCTURE**
-- • app: Main application schema
-- • Clean slate approach (drop/recreate)
--
-- 🌍 **SPATIAL CAPABILITIES**
-- • Location-based queries
-- • Geographic distance calculations
-- • Worksite spatial relationships
-- • Multi-site coordination support

-- ============================================================================
-- DDL:
-- ============================================================================

-- Clean slate: Remove existing schema
DROP SCHEMA IF EXISTS app CASCADE;

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid(), cryptographic functions
CREATE EXTENSION IF NOT EXISTS postgis;   -- PostGIS for spatial/geographic data

-- Create main application schema
CREATE SCHEMA IF NOT EXISTS app;

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- No data curation needed for extensions and schema setup