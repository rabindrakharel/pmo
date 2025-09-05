# Database Table Creation User Guide
## PMO Enterprise PostgreSQL Schema Standards

### 📋 Table of Contents

1. [Overview](#overview)
2. [Mandatory Standards](#mandatory-standards)
3. [File Structure Requirements](#file-structure-requirements)
4. [Table Design Patterns](#table-design-patterns)
5. [Field Standards](#field-standards)
6. [Naming Conventions](#naming-conventions)
7. [Data Types & Constraints](#data-types--constraints)
8. [Relationship Patterns](#relationship-patterns)
9. [Indexing Guidelines](#indexing-guidelines)
10. [Data Curation Requirements](#data-curation-requirements)
11. [Integration Requirements](#integration-requirements)
12. [Common Mistakes to Avoid](#common-mistakes-to-avoid)
13. [Approval Checklist](#approval-checklist)

---

## Overview

This guide defines the **mandatory standards and patterns** for creating new database tables in the PMO Enterprise PostgreSQL schema. All tables must follow these conventions to ensure consistency, maintainability, and integration with the existing 25-table enterprise architecture.

### 🎯 Core Design Principles
- **Consistency**: Every table follows identical patterns for audit, metadata, and temporal data
- **Integration**: All tables integrate seamlessly with the unified RBAC permission system
- **Canadian Compliance**: PIPEDA-compliant privacy handling and regulatory requirements
- **Real-World Data**: Realistic sample data that supports actual business operations
- **Enterprise Scale**: Designed for production use with proper indexing and performance considerations

---

## Mandatory Standards

### ✅ **REQUIRED - Non-Negotiable**

#### 1. Three-Section DDL Structure
Every DDL file MUST follow this exact format:

```sql
-- ============================================================================
-- SEMANTICS:
-- ============================================================================
-- Business context explanation with key features and integration points

-- ============================================================================
-- DDL:
-- ============================================================================
-- Clean table definitions with standard field ordering

-- ============================================================================
-- DATA CURATION:
-- ============================================================================
-- Realistic sample data demonstrating operational scenarios
```

#### 2. Standard Field Set
Every dimension table MUST include these fields in this exact order:

```sql
CREATE TABLE app.your_table_name (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Standard fields (audit, metadata, SCD type 2) - ALWAYS FIRST
  name text NOT NULL,
  "descr" text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  -- Table-specific fields follow...
)
```

#### 3. Schema Prefix
All tables MUST be created in the `app` schema:
```sql
CREATE TABLE app.table_name (...)
```

#### 4. UUID Primary Keys
All tables MUST use UUID primary keys with `gen_random_uuid()`:
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
```

### ❌ **FORBIDDEN - Never Allow**

1. **No `id` fields of type `serial`, `int`, or `bigint`** - Only UUID allowed
2. **No tables outside `app` schema** - All tables must be `app.table_name`
3. **No foreign key fields named `id`** - Use descriptive names like `parent_id`, `employee_id`
4. **No missing standard fields** - Every dimension table needs the complete standard field set
5. **No tables without real sample data** - Every table must include realistic data curation
6. **No missing SEMANTICS section** - Business context is mandatory
7. **No hardcoded indexes in DDL** - Comment out indexes with "-- Indexes removed for simplified import"

---

## File Structure Requirements

### File Naming Convention
Files must follow dependency-optimized numbering:
- `00-13_*.ddl` - Existing sequence (DO NOT MODIFY)
- `14_*.ddl` - New tables (continue sequence)
- `15_*.ddl` - Next new table, etc.

### Loading Order Dependencies
New tables must respect dependency order:

```
00_extensions.ddl         # Extensions and schema
01_meta.ddl              # Meta configuration (7 tables)
02-05_scope_tables.ddl   # Scope hierarchy tables  
06-07_domain_tables.ddl  # Employee, client tables
08-09_operational.ddl    # Project, task operations
10-11_application.ddl    # Forms, app components
12-13_permissions.ddl    # RBAC and relationships
14+_your_new_tables.ddl  # New tables here
```

**Rule**: If your table references another table, your DDL file number must be higher.

---

## Table Design Patterns

### Pattern 1: Dimension Tables (Scope/Domain)
For business entities like clients, vendors, assets:

```sql
CREATE TABLE app.d_your_entity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Standard fields (exact order required)
  name text NOT NULL,
  "descr" text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  -- Entity-specific fields
  your_field1 text,
  your_field2 jsonb NOT NULL DEFAULT '{}'::jsonb,
  parent_id uuid REFERENCES app.d_your_entity(id) ON DELETE SET NULL, -- If hierarchical
  level_id int REFERENCES app.meta_your_level(level_id) -- If using meta levels
);
```

### Pattern 2: Meta Configuration Tables
For reference data and system configuration:

```sql
CREATE TABLE app.meta_your_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id int NOT NULL UNIQUE,  -- Or code/key field
  name text NOT NULL,
  "descr" text,
  sort_order int NOT NULL DEFAULT 0,
  -- Config-specific fields
  your_config_field boolean NOT NULL DEFAULT false,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);
```

### Pattern 3: Operational Tables (Head/Records)
For transactional data with audit trails:

```sql
-- Head table (immutable definitions)
CREATE TABLE app.ops_your_head (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Core definition fields
  name text NOT NULL,
  "descr" text,
  your_code text,
  -- Foreign keys to other entities
  related_entity_id uuid REFERENCES app.d_related_entity(id),
  -- Standard temporal fields
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- Records table (mutable state tracking)
CREATE TABLE app.ops_your_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  head_id uuid NOT NULL REFERENCES app.ops_your_head(id) ON DELETE CASCADE,
  -- State tracking fields
  status_name text,
  completion_percentage numeric(5,2),
  actual_start_date date,
  actual_end_date date,
  -- Audit trail fields
  log_owner_id uuid REFERENCES app.d_employee(id),
  log_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created timestamptz NOT NULL DEFAULT now()
);
```

### Pattern 4: Relationship Tables
For many-to-many relationships:

```sql
CREATE TABLE app.rel_entity1_entity2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity1_id uuid NOT NULL REFERENCES app.d_entity1(id) ON DELETE CASCADE,
  entity2_id uuid NOT NULL REFERENCES app.d_entity2(id) ON DELETE CASCADE,
  -- Relationship-specific fields
  assignment_type text,
  assignment_pct numeric(5,2),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  -- Standard fields
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);
```

---

## Field Standards

### Standard Field Definitions (Copy Exactly)

```sql
-- REQUIRED on ALL dimension tables
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
name text NOT NULL,
"descr" text,  -- Note: "descr" in quotes because it's a reserved word
tags jsonb NOT NULL DEFAULT '[]'::jsonb,
attr jsonb NOT NULL DEFAULT '{}'::jsonb,
from_ts timestamptz NOT NULL DEFAULT now(),
to_ts timestamptz,
active boolean NOT NULL DEFAULT true,
created timestamptz NOT NULL DEFAULT now(),
updated timestamptz NOT NULL DEFAULT now()
```

### Common Field Patterns

```sql
-- Hierarchical relationships
parent_id uuid REFERENCES app.same_table(id) ON DELETE SET NULL,

-- Meta level integration
level_id int REFERENCES app.meta_your_level(level_id),
level_name text,  -- Denormalized for performance

-- Employee references
assignee_id uuid REFERENCES app.d_employee(id),
reporter_id uuid REFERENCES app.d_employee(id),
manager_emp_id uuid REFERENCES app.d_employee(id),

-- Multi-value references (arrays)
reviewers uuid[],
approvers uuid[],
collaborators uuid[],

-- Contact information (use JSONB)
contact jsonb NOT NULL DEFAULT '{}'::jsonb,
emergency_contacts jsonb NOT NULL DEFAULT '[]'::jsonb,

-- Geographic fields (PostGIS integration)
geom geometry(Geometry, 4326),
addr text,
postal_code text,
country_code text DEFAULT 'CA',
province_code text,
time_zone text DEFAULT 'America/Toronto',

-- Financial fields
budget_allocated numeric(15,2),
approval_limit numeric(15,2),
cost_center_code text,

-- Code/identifier fields
your_entity_code text,
slug text,
```

---

## Naming Conventions

### Table Naming
```sql
-- Dimension/Domain tables
app.d_entity_name          -- d_employee, d_client, d_vendor

-- Meta configuration tables  
app.meta_config_name       -- meta_client_level, meta_status_type

-- Operational tables
app.ops_entity_head        -- ops_project_head, ops_task_head
app.ops_entity_records     -- ops_project_records, ops_task_records

-- Relationship tables
app.rel_entity1_entity2    -- rel_hr_biz_loc, rel_employee_scope_unified

-- Scope tables
app.d_scope_type          -- d_scope_business, d_scope_location
```

### Field Naming
```sql
-- Primary keys
id                        -- Always UUID

-- Foreign keys (be descriptive)
parent_id                 -- Self-referencing
employee_id               -- Reference to d_employee
client_parent_id          -- Specific parent reference
proj_head_id             -- Reference to ops_project_head

-- Boolean fields
is_active, is_leaf_level, is_management
has_budget, has_authority
approval_authority, contract_authority

-- Date fields
created, updated          -- Timestamps
from_ts, to_ts           -- Temporal validity
start_date, end_date     -- Business dates
hire_date, birth_date    -- Specific dates

-- JSON fields
tags                     -- Array of strings: ["tag1", "tag2"]
attr                     -- Object: {"key": "value"}
contact                  -- Contact information object
emergency_contacts       -- Array of contact objects

-- Text fields
name                     -- Display name (required)
"descr"                  -- Description (optional)
addr                     -- Address
email, phone, mobile     -- Contact fields
```

### Code/Reference Fields
```sql
-- Codes should be descriptive
emp_code                 -- Employee code
project_code            -- Project code  
worksite_code           -- Worksite code
cost_center_code        -- Cost center code

-- Status/type fields
status                  -- Current status
employment_type         -- Type of employment
assignment_type         -- Type of assignment
```

---

## Data Types & Constraints

### Required Data Types

```sql
-- Primary keys
id uuid PRIMARY KEY DEFAULT gen_random_uuid()

-- Text fields
name text NOT NULL                    -- Required display name
"descr" text                         -- Optional description
code_field text                      -- Codes and identifiers
email text UNIQUE                    -- Unique email addresses

-- Timestamps (use timestamptz for timezone awareness)
created timestamptz NOT NULL DEFAULT now()
updated timestamptz NOT NULL DEFAULT now()
from_ts timestamptz NOT NULL DEFAULT now()
to_ts timestamptz

-- JSON fields
tags jsonb NOT NULL DEFAULT '[]'::jsonb      -- Array of tags
attr jsonb NOT NULL DEFAULT '{}'::jsonb      -- Attribute object
contact jsonb NOT NULL DEFAULT '{}'::jsonb   -- Contact information

-- Numeric fields
numeric(15,2)            -- Financial amounts
numeric(5,2)             -- Percentages
int                      -- Counts, levels, sort orders

-- Boolean fields
active boolean NOT NULL DEFAULT true
is_leaf_level boolean NOT NULL DEFAULT false

-- Geographic (PostGIS)
geom geometry(Geometry, 4326)        -- WGS84 coordinate system

-- Arrays
uuid[]                   -- Arrays of UUIDs for multi-references
text[]                   -- Arrays of text values
```

### Required Constraints

```sql
-- Foreign key constraints with appropriate actions
REFERENCES app.parent_table(id) ON DELETE SET NULL     -- Optional parent
REFERENCES app.parent_table(id) ON DELETE CASCADE      -- Required parent
REFERENCES app.parent_table(id)                        -- Default RESTRICT

-- NOT NULL constraints on required fields
name text NOT NULL
created timestamptz NOT NULL DEFAULT now()
tags jsonb NOT NULL DEFAULT '[]'::jsonb

-- DEFAULT values for all applicable fields
active boolean NOT NULL DEFAULT true
created timestamptz NOT NULL DEFAULT now()
from_ts timestamptz NOT NULL DEFAULT now()
```

---

## Relationship Patterns

### 1. Hierarchical Self-References
For organizational hierarchies:

```sql
CREATE TABLE app.d_your_hierarchy (
  -- Standard fields...
  parent_id uuid REFERENCES app.d_your_hierarchy(id) ON DELETE SET NULL,
  level_id int REFERENCES app.meta_your_level(level_id),
  level_name text
);
```

### 2. Meta Level Integration
Link to meta configuration tables:

```sql
-- First create the meta table
CREATE TABLE app.meta_your_level (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id int NOT NULL UNIQUE,
  name text NOT NULL,
  "descr" text,
  sort_order int NOT NULL DEFAULT 0,
  is_leaf_level boolean NOT NULL DEFAULT false,
  -- Meta-specific fields...
);

-- Then reference from dimension table
CREATE TABLE app.d_your_entity (
  -- Standard fields...
  level_id int REFERENCES app.meta_your_level(level_id),
  level_name text  -- Denormalized for performance
);
```

### 3. Employee References
Standard patterns for employee relationships:

```sql
-- Single employee reference
assignee_id uuid REFERENCES app.d_employee(id),
manager_id uuid REFERENCES app.d_employee(id),
created_by_id uuid REFERENCES app.d_employee(id),

-- Multiple employee references (arrays)
reviewers uuid[],        -- Array of employee IDs
approvers uuid[],        -- Array of employee IDs  
collaborators uuid[],    -- Array of employee IDs
```

### 4. Cross-Dimensional References
Reference multiple scope dimensions:

```sql
-- Business unit reference
business_id uuid REFERENCES app.d_scope_business(id),

-- Location references
location_id uuid REFERENCES app.d_scope_location(id),
locations uuid[],        -- Array for multiple locations

-- Worksite reference
worksite_id uuid REFERENCES app.d_scope_worksite(id),
worksites uuid[],        -- Array for multiple worksites
```

---

## Indexing Guidelines

### ❌ Do NOT Create Indexes in DDL Files
All DDL files must end with this comment:
```sql
-- Indexes removed for simplified import
```

### 📝 Document Required Indexes
Include index recommendations in comments:

```sql
-- ============================================================================
-- RECOMMENDED INDEXES (create separately after import):
-- ============================================================================
--
-- Performance indexes:
-- CREATE INDEX idx_your_table_parent_id ON app.your_table(parent_id);
-- CREATE INDEX idx_your_table_level_id ON app.your_table(level_id);
-- CREATE INDEX idx_your_table_active ON app.your_table(active) WHERE active = true;
--
-- Search indexes:
-- CREATE INDEX idx_your_table_name_trgm ON app.your_table USING gin(name gin_trgm_ops);
-- CREATE INDEX idx_your_table_tags ON app.your_table USING gin(tags);
--
-- Spatial indexes (if using PostGIS):
-- CREATE INDEX idx_your_table_geom ON app.your_table USING gist(geom);
```

---

## Data Curation Requirements

### ✅ **MANDATORY - Every Table Must Include**

1. **Realistic Business Data**: Not Lorem ipsum or fake data
2. **Canadian Context**: Addresses, phone numbers, postal codes
3. **Complete Hierarchy**: If hierarchical, show all levels
4. **Operational Scenarios**: Data that supports real business workflows
5. **Integration Examples**: Show relationships to other tables

### Sample Data Standards

```sql
-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Insert realistic data that demonstrates:
-- 1. Complete business hierarchy (if applicable)
-- 2. Real Canadian addresses, phone numbers, postal codes  
-- 3. Proper foreign key relationships
-- 4. Realistic operational scenarios
-- 5. Integration with existing data

INSERT INTO app.your_table (name, "descr", your_field, tags, attr) VALUES

-- Primary entities (top level)
('Huron Home Services - Your Entity', 
 'Real business description with operational context', 
 'realistic_value', 
 '["business", "primary", "operational"]', 
 '{"business_context": "real_data", "integration_point": "other_tables"}'),

-- Secondary entities showing hierarchy
('Sub Entity - Department Level', 
 'Realistic department or division entity', 
 'dept_value', 
 '["department", "secondary", "hierarchy"]', 
 '{"parent_relationship": "primary_entity", "operational_role": "specific_function"}'),

-- Operational entities (detail level)
('Individual Asset/Unit/Item', 
 'Specific operational entity with real-world context', 
 'item_value', 
 '["operational", "detail", "active"]', 
 '{"usage_context": "daily_operations", "maintenance_required": true}');
```

### Canadian Data Requirements

```sql
-- Use real Canadian geography
addr => '1250 South Service Rd, Mississauga, ON L5E 1V4'
postal_code => 'L5E 1V4'  
country_code => 'CA'
province_code => 'ON'
time_zone => 'America/Toronto'

-- Use real Canadian phone numbers
phone => '+1-905-555-1001'
mobile => '+1-905-555-1002'

-- Use realistic Canadian business context
'{"regulatory_compliance": ["PIPEDA", "AODA"], "tax_jurisdiction": "ontario"}'
```

---

## Integration Requirements

### RBAC Permission Integration
If your table should be scope-controlled, ensure it can integrate with the permission system:

```sql
-- Your table needs fields that can be referenced by permissions
CREATE TABLE app.d_your_entity (
  -- Standard fields including name...
  -- The 'name' field will be used as scope_name in permissions
  
  -- Optional: Add specific permission control fields
  is_public boolean NOT NULL DEFAULT false,
  access_level text DEFAULT 'internal',
  requires_approval boolean NOT NULL DEFAULT false
);
```

### API Integration Readiness
Structure fields to support automatic API generation:

```sql
-- Standard fields enable automatic CRUD APIs
name text NOT NULL,           -- Used for display and search
"descr" text,                -- Used for detailed display
tags jsonb NOT NULL DEFAULT '[]'::jsonb,  -- Used for filtering/search
active boolean NOT NULL DEFAULT true,     -- Used for soft deletes

-- Specific API support fields
slug text,                   -- For URL-friendly identifiers
external_id text,           -- For external system integration
api_metadata jsonb NOT NULL DEFAULT '{}'::jsonb  -- API-specific settings
```

### UI Component Integration
Fields that enable automatic UI generation:

```sql
-- Display fields
name text NOT NULL,          -- Primary display
"descr" text,               -- Secondary display  
sort_order int,             -- Custom ordering

-- Status/categorization
status text,                -- For status badges
priority text,              -- For priority indicators
category text,              -- For grouping/filtering

-- Visual customization
color_hex text,             -- For UI color coding
icon text,                  -- For icon references
```

---

## Common Mistakes to Avoid

### ❌ **Critical Errors (Will Cause Rejection)**

1. **Wrong Primary Key Type**
   ```sql
   -- WRONG
   id serial PRIMARY KEY
   id int PRIMARY KEY
   
   -- CORRECT
   id uuid PRIMARY KEY DEFAULT gen_random_uuid()
   ```

2. **Missing Standard Fields**
   ```sql
   -- WRONG - Missing required standard fields
   CREATE TABLE app.d_example (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     name text NOT NULL
   );
   
   -- CORRECT - Complete standard field set
   CREATE TABLE app.d_example (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     name text NOT NULL,
     "descr" text,
     tags jsonb NOT NULL DEFAULT '[]'::jsonb,
     attr jsonb NOT NULL DEFAULT '{}'::jsonb,
     from_ts timestamptz NOT NULL DEFAULT now(),
     to_ts timestamptz,
     active boolean NOT NULL DEFAULT true,
     created timestamptz NOT NULL DEFAULT now(),
     updated timestamptz NOT NULL DEFAULT now()
   );
   ```

3. **Wrong Schema**
   ```sql
   -- WRONG
   CREATE TABLE public.example_table (...)
   CREATE TABLE example_table (...)
   
   -- CORRECT  
   CREATE TABLE app.example_table (...)
   ```

4. **Poor Foreign Key Names**
   ```sql
   -- WRONG - Non-descriptive
   other_id uuid REFERENCES app.d_other(id)
   id2 uuid REFERENCES app.d_employee(id)
   
   -- CORRECT - Descriptive
   parent_id uuid REFERENCES app.d_same_table(id)
   employee_id uuid REFERENCES app.d_employee(id)
   manager_emp_id uuid REFERENCES app.d_employee(id)
   ```

### ⚠️ **Common Issues (Fix Before Submission)**

1. **Inconsistent Field Order**
   - Standard fields must be first, in the exact order specified
   - Table-specific fields come after standard fields

2. **Missing JSONB Defaults**
   ```sql
   -- WRONG
   tags jsonb
   attr jsonb
   
   -- CORRECT
   tags jsonb NOT NULL DEFAULT '[]'::jsonb
   attr jsonb NOT NULL DEFAULT '{}'::jsonb
   ```

3. **Wrong Timestamp Types**
   ```sql
   -- WRONG
   created timestamp
   from_ts timestamp
   
   -- CORRECT  
   created timestamptz NOT NULL DEFAULT now()
   from_ts timestamptz NOT NULL DEFAULT now()
   ```

4. **Missing Business Context**
   - SEMANTICS section must explain business purpose
   - Data curation must include realistic scenarios
   - Integration points must be documented

---

## Approval Checklist

### 📋 **Pre-Submission Checklist**

#### File Structure
- [ ] DDL file follows `XX_descriptive_name.ddl` naming convention
- [ ] File number respects dependency order
- [ ] Three-section structure: SEMANTICS → DDL → DATA CURATION

#### Table Structure  
- [ ] Table created in `app` schema
- [ ] UUID primary key with `gen_random_uuid()`
- [ ] Complete standard field set in correct order
- [ ] All required NOT NULL constraints
- [ ] All required DEFAULT values

#### Field Standards
- [ ] All JSONB fields have proper defaults
- [ ] All timestamp fields use `timestamptz`
- [ ] Foreign key fields have descriptive names
- [ ] No hardcoded indexes in DDL

#### Data Curation
- [ ] Realistic Canadian business data
- [ ] Complete hierarchy demonstrated (if applicable)
- [ ] Proper integration with existing tables
- [ ] Real addresses, phone numbers, postal codes
- [ ] Operational scenarios represented

#### Documentation
- [ ] SEMANTICS section explains business purpose
- [ ] Integration points documented
- [ ] Relationship patterns explained
- [ ] Index recommendations commented
- [ ] Business value clearly articulated

#### Integration Readiness
- [ ] Compatible with RBAC permission system
- [ ] Field names follow established conventions
- [ ] JSON structures match existing patterns
- [ ] Foreign keys properly reference existing tables

### 🔍 **Review Process**

1. **Technical Review**: Verify all standards compliance
2. **Business Review**: Confirm realistic data and operational value  
3. **Integration Review**: Test relationships with existing tables
4. **Documentation Review**: Ensure complete business context
5. **Performance Review**: Validate field types and constraint choices

### 📝 **Submission Requirements**

Submit the following:
1. **Complete DDL file** following all standards
2. **Integration notes** explaining relationships to existing tables
3. **Business justification** for the new table
4. **Sample queries** demonstrating intended usage
5. **Permission requirements** if scope-controlled access needed

---

## Summary

This guide ensures all new database tables integrate seamlessly with the existing 25-table PMO enterprise architecture. Following these standards guarantees:

- **Consistency** across all database objects
- **Integration** with existing RBAC and operational systems  
- **Performance** through proper data types and structure
- **Maintainability** through standardized patterns
- **Compliance** with Canadian regulatory requirements
- **Business Value** through realistic operational data

**Remember**: Every standard in this guide is based on analysis of the existing production database. Deviating from these patterns will break integration and require rework.

For questions or clarifications, reference the existing DDL files in `/db/*.ddl` as examples of proper implementation.