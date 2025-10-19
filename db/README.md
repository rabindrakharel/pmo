# PMO Database Schema

> **Enterprise PostgreSQL Database with Universal Entity-Relationship Architecture**

## Overview

The PMO Database is a comprehensive PostgreSQL schema designed to support a complete Project Management Office system for Huron Home Services, a Canadian service company. The database features a flexible, relationship-driven architecture with no direct foreign keys between core entities, enabling dynamic parent-child relationships and fine-grained RBAC permissions.

**Total:** 40 DDL files defining 35+ tables across 3 categories

## Quick Facts

| Metric | Count | Description |
|--------|-------|-------------|
| **Total DDL Files** | 40 | Complete schema definition |
| **Setting Tables** | 16 | Configuration & dropdown options |
| **Core Entity Tables** | 13 | Business data entities |
| **Relationship Tables** | 4 | Entity mappings & RBAC |
| **Metadata Tables** | 2 | Entity type definitions |
| **Total Tables** | 35+ | All tables across schema |

## Database Architecture

### Schema: `app`

All tables live in the `app` schema for clean namespacing.

```sql
CREATE SCHEMA IF NOT EXISTS app;
SET search_path TO app;
```

### Table Categories

```
app (PostgreSQL schema)
├── Setting Tables (16)                    # Configuration & dropdowns
│   ├── setting_datalabel_project_stage
│   ├── setting_datalabel_task_stage
│   ├── setting_datalabel_customer_tier
│   └── ... 13 more settings
│
├── Core Entity Tables (13)                # Business data
│   ├── d_employee                         # Users & authentication
│   ├── d_project                          # Projects
│   ├── d_task                             # Tasks
│   ├── d_client                           # Clients/CRM
│   ├── d_biz (d_business)                 # Business units
│   ├── d_office                           # Office locations
│   ├── d_worksite                         # Work sites
│   ├── d_role                             # Organizational roles
│   ├── d_position                         # Employee positions
│   ├── d_wiki                             # Knowledge base
│   ├── d_form_head                        # Form definitions
│   ├── d_artifact                         # Documents
│   └── d_reports                          # Report definitions
│
├── Data Tables (4)                        # Submission/instance data
│   ├── d_task_data                        # Task submission data
│   ├── d_form_data                        # Form submission data
│   ├── d_wiki_data                        # Wiki page versions
│   └── d_artifact_data                    # Artifact versions
│
├── Relationship Tables (4)                # Mappings & permissions
│   ├── d_entity_id_map                    # Parent-child relationships
│   ├── d_entity_id_rbac_map               # RBAC permissions
│   ├── rel_emp_role                       # Employee-role assignments
│   └── d_entity_map (legacy)              # Deprecated
│
└── Metadata Tables (2)                    # Entity type definitions
    ├── d_entity                           # Entity type metadata
    └── d_entity_instance_id               # Entity instance registry
```

## Key Design Principles

### 1. No Direct Foreign Keys

**Principle:** All parent-child relationships are managed through `d_entity_id_map` table, not foreign keys.

**Why:**
- Flexibility to add new entity types without schema changes
- Dynamic parent-child relationships
- Support for many-to-many relationships
- No cascade delete issues

**Example:**

```sql
-- TRADITIONAL (NOT USED):
-- ALTER TABLE d_task ADD FOREIGN KEY (project_id) REFERENCES d_project(id);

-- PMO APPROACH (USED):
INSERT INTO app.d_entity_id_map (
  parent_entity_type, parent_entity_id,
  child_entity_type, child_entity_id,
  relationship_type
) VALUES (
  'project', '84215ccb-313d-48f8-9c37-4398f28c0b1f',
  'task', 'f1111111-1111-1111-1111-111111111111',
  'contains'
);
```

### 2. Universal Entity Structure

All core entity tables share a common field structure:

```sql
-- Identity & Naming
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
slug        VARCHAR(100) UNIQUE NOT NULL
code        VARCHAR(50) UNIQUE NOT NULL
name        VARCHAR(200) NOT NULL
descr       TEXT

-- Flexible Data Storage
tags        JSONB DEFAULT '[]'::JSONB    -- Searchable tags
metadata    JSONB DEFAULT '{}'::JSONB    -- Custom key-value data

-- Temporal Tracking (SCD Type 2)
from_ts     TIMESTAMPTZ DEFAULT NOW()
to_ts       TIMESTAMPTZ                  -- NULL = current version
active_flag BOOLEAN DEFAULT TRUE

-- Audit Fields
created_ts  TIMESTAMPTZ DEFAULT NOW()
updated_ts  TIMESTAMPTZ DEFAULT NOW()
version     INTEGER DEFAULT 1
```

### 3. Array-Based RBAC

Permissions stored as integer arrays in `d_entity_id_rbac_map`:

```sql
permission INTEGER[] DEFAULT '{}'

-- Permission codes:
-- 0 = View (read access)
-- 1 = Edit (modify data)
-- 2 = Share (grant permissions)
-- 3 = Delete (soft delete)
-- 4 = Create (create new entities)

-- Example: Full access
permission = '{0,1,2,3,4}'

-- Example: Read-only
permission = '{0}'
```

### 4. Hierarchical Organizations

**Office Hierarchy (4 levels):**
```
Corporate (level_id: 3, parent_id: NULL)
└── Region (level_id: 2, parent_id: corporate_id)
    └── District (level_id: 1, parent_id: region_id)
        └── Office (level_id: 0, parent_id: district_id)
```

**Business Hierarchy (3 levels):**
```
Corporate (level_id: 2, parent_id: NULL)
└── Division (level_id: 1, parent_id: corporate_id)
    └── Department (level_id: 0, parent_id: division_id)
```

### 5. Settings-Driven Configuration

16 settings tables provide dynamic dropdown options:

```sql
-- Example: Project stages
SELECT * FROM app.setting_datalabel_project_stage;

-- Result:
level_id | level_name    | color_code | sort_order
---------|---------------|------------|------------
0        | Initiation    | #3B82F6    | 0
1        | Planning      | #10B981    | 1
2        | Execution     | #F59E0B    | 2
3        | Monitoring    | #8B5CF6    | 3
4        | Closure       | #6B7280    | 4
```

## DDL File Organization

### Import Order (40 files)

**Files are imported in dependency order by `/home/rabin/projects/pmo/tools/db-import.sh`**

```
1. Schema Creation
   └── 0_schemaCreate.ddl                   # DROP SCHEMA app CASCADE; CREATE SCHEMA app;

2. Settings Tables (16 files)
   ├── setting_datalabel__office_level.ddl
   ├── setting_datalabel__business_level.ddl
   ├── setting_datalabel__project_stage.ddl
   ├── setting_datalabel__task_stage.ddl
   ├── setting_datalabel__task_priority.ddl
   ├── setting_datalabel__client_level.ddl
   ├── setting_datalabel__client_status.ddl
   ├── setting_datalabel__customer_tier.ddl
   ├── setting_datalabel__position_level.ddl
   ├── setting_datalabel__opportunity_funnel_level.ddl
   ├── setting_datalabel__industry_sector.ddl
   ├── setting_datalabel__acquisition_channel.ddl
   ├── setting_datalabel__task_update_type.ddl
   ├── setting_datalabel__form_submission_status.ddl
   ├── setting_datalabel__form_approval_status.ddl
   └── setting_datalabel__wiki_publication_status.ddl

3. Entity Registry Framework (1 file)
   └── 29_d_entity_map.ddl                  # Legacy entity registry

4. Core Entity Tables (23 files)
   ├── 11_d_employee.ddl                    # Employees (required first for RBAC)
   ├── 12_d_office.ddl                      # Office locations
   ├── 13_d_business.ddl                    # Business units
   ├── 14_d_client.ddl                      # Clients
   ├── 15_d_role.ddl                        # Roles
   ├── 16_d_position.ddl                    # Positions
   ├── 17_d_worksite.ddl                    # Worksites
   ├── 18_d_project.ddl                     # Projects
   ├── 19_d_task.ddl                        # Task definitions
   ├── 20_d_task_data.ddl                   # Task submissions
   ├── 21_d_artifact.ddl                    # Artifact definitions
   ├── 22_d_artifact_data.ddl               # Artifact versions
   ├── 23_d_form_head.ddl                   # Form definitions
   ├── 24_d_form_data.ddl                   # Form submissions
   ├── 25_d_wiki.ddl                        # Wiki page definitions
   ├── 26_d_wiki_data.ddl                   # Wiki page versions
   ├── 27_d_reports.ddl                     # Report definitions
   ├── 28_d_report_data.ddl                 # Report instances
   ├── 30_d_entity.ddl                      # Entity type metadata (NEW)
   ├── 31_d_entity_instance_id.ddl          # Entity instance registry
   ├── 33_d_entity_id_map.ddl               # Parent-child relationships
   ├── 34_d_entity_id_rbac_map.ddl          # RBAC permissions
   └── 35_rel_emp_role.ddl                  # Employee-role assignments
```

### DDL File Structure

Each DDL file follows a 3-section format:

```sql
-- ===============================
-- SECTION 1: SEMANTICS
-- ===============================
-- Why this table exists
-- How it relates to other tables
-- How frontend/API/business logic use it

-- ===============================
-- SECTION 2: DDL
-- ===============================
CREATE TABLE app.d_project (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  ...
);

-- ===============================
-- SECTION 3: DATA CURATION
-- ===============================
INSERT INTO app.d_project (id, code, name, ...) VALUES
('84215ccb-313d-48f8-9c37-4398f28c0b1f', 'PRJ-2024-001', 'Fall 2024 Landscaping Campaign', ...);
```

## Core Entity Tables (13 tables)

### d_employee - User Accounts & Authentication

**Purpose:** User authentication, RBAC, organizational chart

**Key Fields:**
- `id` - UUID (referenced in RBAC)
- `email` - Unique login identifier
- `password_hash` - bcrypt hashed password
- `employee_number` - Business identifier
- `manager_employee_id` - Self-referencing hierarchy

**Sample Data:** 5 employees including James Miller (CEO)

**DDL File:** `11_d_employee.ddl`

### d_project - Project Management

**Purpose:** Project tracking, budget management, timeline planning

**Key Fields:**
- `project_stage` - References `setting_datalabel_project_stage`
- `budget_allocated`, `budget_spent` - Financial tracking
- `manager_employee_id`, `sponsor_employee_id` - Ownership
- `stakeholder_employee_ids[]` - Array of stakeholders
- `planned_start_date`, `actual_start_date` - Timeline

**Sample Data:** 5 projects including "Fall 2024 Landscaping Campaign"

**DDL File:** `18_d_project.ddl`

### d_task - Task Management

**Purpose:** Task tracking, work assignment, dependency management

**Key Fields:**
- `stage` - References `setting_datalabel_task_stage`
- `priority_level` - References `setting_datalabel_task_priority`
- `assignee_employee_ids[]` - Array of assignees
- `estimated_hours`, `actual_hours` - Time tracking
- `parent_task_id` - Self-referencing for subtasks
- `dependency_task_ids[]` - Task dependencies

**Sample Data:** 8 tasks across multiple projects

**DDL File:** `19_d_task.ddl`

### d_client - Client/CRM Management

**Purpose:** Customer relationship management, sales pipeline

**Key Fields:**
- `client_type` - Residential, Commercial, etc.
- `client_status` - References `setting_datalabel_client_status`
- `customer_tier_id` - References `setting_datalabel_customer_tier`
- `opportunity_funnel_level_id` - Sales pipeline stage
- `industry_sector_id` - Industry classification
- `acquisition_channel_id` - Marketing source

**Sample Data:** 3 clients (Thompson Family, Martinez Family, Square One Shopping)

**DDL File:** `14_d_client.ddl`

### d_biz (d_business) - Business Unit Hierarchy

**Purpose:** Organizational hierarchy, business unit management

**Key Fields:**
- `level_id` - References `setting_datalabel_business_level` (0-2)
- `parent_id` - Self-referencing hierarchy
- `office_id` - Primary office location

**Hierarchy Levels:**
- 0 = Department
- 1 = Division
- 2 = Corporate

**Sample Data:** 6 business units (Landscaping, HVAC, Plumbing, etc.)

**DDL File:** `13_d_business.ddl`

### d_office - Office Location Hierarchy

**Purpose:** Geographic organization, office-based filtering

**Key Fields:**
- `level_id` - References `setting_datalabel_office_level` (0-3)
- `parent_id` - Self-referencing hierarchy
- `address`, `city`, `province`, `postal_code` - Location data

**Hierarchy Levels:**
- 0 = Office
- 1 = District
- 2 = Region
- 3 = Corporate

**Sample Data:** 5 offices across Ontario

**DDL File:** `12_d_office.ddl`

### Other Core Entities

| Entity | Purpose | Key Features | DDL File |
|--------|---------|--------------|----------|
| **d_worksite** | Work site locations | GPS coordinates, site types | `17_d_worksite.ddl` |
| **d_role** | Organizational roles | 22 predefined roles | `15_d_role.ddl` |
| **d_position** | Employee positions | 16 positions with levels | `16_d_position.ddl` |
| **d_wiki** | Knowledge base | Rich text content, publication status | `25_d_wiki.ddl` |
| **d_form_head** | Form definitions | JSON schema, multi-step forms | `23_d_form_head.ddl` |
| **d_artifact** | Document management | File paths, MIME types, versioning | `21_d_artifact.ddl` |
| **d_reports** | Report definitions | SQL queries, visualization configs | `27_d_reports.ddl` |

## Settings Tables (16 tables)

All settings tables follow the same structure:

```sql
CREATE TABLE app.setting_datalabel_<name> (
  level_id INTEGER PRIMARY KEY,
  level_name VARCHAR(100) NOT NULL,
  level_descr TEXT,
  color_code VARCHAR(7),           -- Hex color for badges
  sort_order INTEGER,
  active_flag BOOLEAN DEFAULT TRUE,
  created_ts TIMESTAMPTZ DEFAULT NOW(),
  updated_ts TIMESTAMPTZ DEFAULT NOW()
);
```

### Settings Table Registry

| Table | Values | Purpose | API Category |
|-------|--------|---------|--------------|
| `setting_datalabel_project_stage` | 7 | Project lifecycle stages | `projectStage` |
| `setting_datalabel_task_stage` | 7 | Task workflow stages | `taskStage` |
| `setting_datalabel_task_priority` | 5 | Task priorities | `taskPriority` |
| `setting_datalabel_task_update_type` | 7 | Task activity types | `taskUpdateType` |
| `setting_datalabel_office_level` | 4 | Office hierarchy | `officeLevel` |
| `setting_datalabel_business_level` | 3 | Business hierarchy | `businessLevel` |
| `setting_datalabel_position_level` | 8 | Position hierarchy | `positionLevel` |
| `setting_datalabel_client_level` | 5 | Client classification | `clientLevel` |
| `setting_datalabel_client_status` | 6 | Client lifecycle status | `clientStatus` |
| `setting_datalabel_customer_tier` | 6 | Service tiers | `customerTier` |
| `setting_datalabel_opportunity_funnel_level` | 8 | Sales pipeline stages | `opportunityFunnelLevel` |
| `setting_datalabel_industry_sector` | 8 | Industry classifications | `industrySector` |
| `setting_datalabel_acquisition_channel` | 15+ | Marketing channels | `acquisitionChannel` |
| `setting_datalabel_form_submission_status` | 6 | Form submission workflow | `formSubmissionStatus` |
| `setting_datalabel_form_approval_status` | 5 | Form approval workflow | `formApprovalStatus` |
| `setting_datalabel_wiki_publication_status` | 6 | Wiki content lifecycle | `wikiPublicationStatus` |

### Settings API Integration

Frontend loads settings via universal API endpoint:

```typescript
// Frontend request
GET /api/v1/setting?category=projectStage

// Response
[
  { "level_id": 0, "level_name": "Initiation", "color_code": "#3B82F6" },
  { "level_id": 1, "level_name": "Planning", "color_code": "#10B981" },
  ...
]
```

## Relationship Tables

### d_entity_id_map - Parent-Child Relationships

**Purpose:** Universal parent-child relationship mapping (replaces foreign keys)

**Structure:**

```sql
CREATE TABLE app.d_entity_id_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_entity_type VARCHAR(50) NOT NULL,      -- 'project', 'biz', 'office'
  parent_entity_id TEXT NOT NULL,                -- UUID as text
  child_entity_type VARCHAR(50) NOT NULL,        -- 'task', 'artifact', 'wiki'
  child_entity_id TEXT NOT NULL,                 -- UUID as text
  relationship_type VARCHAR(50),                 -- 'contains', 'owns', 'assigned_to'
  active_flag BOOLEAN DEFAULT TRUE,
  created_ts TIMESTAMPTZ DEFAULT NOW(),
  updated_ts TIMESTAMPTZ DEFAULT NOW()
);
```

**Example Data:**

```sql
-- Project contains tasks
parent_entity_type = 'project'
parent_entity_id = '84215ccb-313d-48f8-9c37-4398f28c0b1f'
child_entity_type = 'task'
child_entity_id = 'f1111111-1111-1111-1111-111111111111'

-- Business owns project
parent_entity_type = 'biz'
parent_entity_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
child_entity_type = 'project'
child_entity_id = '84215ccb-313d-48f8-9c37-4398f28c0b1f'
```

**Query Pattern:**

```sql
-- Get tasks for a project
SELECT t.*
FROM app.d_task t
INNER JOIN app.d_entity_id_map eim
  ON eim.child_entity_id = t.id::TEXT
WHERE eim.parent_entity_id = '84215ccb-313d-48f8-9c37-4398f28c0b1f'
  AND eim.parent_entity_type = 'project'
  AND eim.child_entity_type = 'task'
  AND eim.active_flag = TRUE
  AND t.active_flag = TRUE;
```

**DDL File:** `33_d_entity_id_map.ddl`

### d_entity_id_rbac_map - RBAC Permissions

**Purpose:** Fine-grained access control for all entities

**Structure:**

```sql
CREATE TABLE app.d_entity_id_rbac_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empid UUID NOT NULL,                           -- Employee ID
  entity VARCHAR(50) NOT NULL,                   -- Entity type
  entity_id TEXT NOT NULL,                       -- 'all' or specific UUID
  permission INTEGER[] DEFAULT '{}',             -- {0,1,2,3,4}
  active_flag BOOLEAN DEFAULT TRUE,
  created_ts TIMESTAMPTZ DEFAULT NOW(),
  updated_ts TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(empid, entity, entity_id)
);

-- Composite index for fast permission lookups
CREATE INDEX idx_rbac_emp_entity ON app.d_entity_id_rbac_map(empid, entity, entity_id);
```

**Permission Scopes:**

```sql
-- Type-level: Access to ALL projects
entity = 'project'
entity_id = 'all'
permission = '{0,1,2,3,4}'  -- Full access

-- Instance-level: Access to ONE specific project
entity = 'project'
entity_id = '84215ccb-313d-48f8-9c37-4398f28c0b1f'
permission = '{0,1}'  -- View and edit only
```

**Query Pattern:**

```sql
-- Check if user can view a project
SELECT EXISTS (
  SELECT 1 FROM app.d_entity_id_rbac_map
  WHERE empid = '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
    AND entity = 'project'
    AND (entity_id = '84215ccb-313d-48f8-9c37-4398f28c0b1f' OR entity_id = 'all')
    AND 0 = ANY(permission)
    AND active_flag = TRUE
) AS can_view;
```

**DDL File:** `34_d_entity_id_rbac_map.ddl`

### rel_emp_role - Employee-Role Assignments

**Purpose:** Many-to-many relationship between employees and roles

**Structure:**

```sql
CREATE TABLE app.rel_emp_role (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  role_id UUID NOT NULL,
  from_ts TIMESTAMPTZ DEFAULT NOW(),
  to_ts TIMESTAMPTZ,
  active_flag BOOLEAN DEFAULT TRUE
);
```

**DDL File:** `35_rel_emp_role.ddl`

## Metadata Tables

### d_entity - Entity Type Metadata (NEW)

**Purpose:** Database-driven entity metadata (icons, labels, child relationships)

**Replaces:** Hardcoded `entityConfig.childEntities` in frontend

**Structure:**

```sql
CREATE TABLE app.d_entity (
  entity_type VARCHAR(50) NOT NULL PRIMARY KEY,
  entity_name VARCHAR(100) NOT NULL,
  entity_slug VARCHAR(100) NOT NULL,
  ui_label VARCHAR(100) NOT NULL,              -- "Projects", "Tasks"
  ui_icon VARCHAR(50),                          -- "FolderOpen", "CheckSquare"
  child_entities JSONB DEFAULT '[]'::JSONB,    -- Child entity metadata
  display_order INTEGER NOT NULL DEFAULT 999,
  active_flag BOOLEAN DEFAULT TRUE,
  created_ts TIMESTAMPTZ DEFAULT NOW(),
  updated_ts TIMESTAMPTZ DEFAULT NOW()
);
```

**Example Data:**

```sql
INSERT INTO app.d_entity (entity_type, entity_name, ui_label, ui_icon, child_entities)
VALUES (
  'project',
  'Project',
  'Projects',
  'FolderOpen',
  '[
    {"entity": "task", "ui_icon": "CheckSquare", "ui_label": "Tasks", "order": 1},
    {"entity": "wiki", "ui_icon": "BookOpen", "ui_label": "Wiki", "order": 2},
    {"entity": "artifact", "ui_icon": "FileText", "ui_label": "Artifacts", "order": 3}
  ]'::JSONB
);
```

**API Endpoint:**
```
GET /api/v1/entity/child-tabs/:entityType/:entityId
```

**DDL File:** `30_d_entity.ddl`

## Database Setup

### Import All DDL Files

```bash
# Full schema import (drops and recreates)
./tools/db-import.sh

# Dry run (validation only)
./tools/db-import.sh --dry-run

# Verbose output
./tools/db-import.sh --verbose

# Skip post-import validation
./tools/db-import.sh --skip-validation
```

**What it does:**
1. Drops `app` schema (CASCADE)
2. Creates fresh `app` schema
3. Imports 40 DDL files in dependency order
4. Validates schema integrity
5. Displays import summary

### Database Connection

**Default PostgreSQL Configuration:**

```bash
Host: localhost
Port: 5434
Database: app
User: app
Password: app
Schema: app
```

**Connection String:**
```
postgresql://app:app@localhost:5434/app
```

### Manual Schema Import

```bash
# Connect to database
psql -h localhost -p 5434 -U app -d app

# Import single DDL file
\i /home/rabin/projects/pmo/db/18_d_project.ddl

# Import all files manually
\i /home/rabin/projects/pmo/db/0_schemaCreate.ddl
\i /home/rabin/projects/pmo/db/setting_datalabel__project_stage.ddl
... (repeat for all 40 files)
```

## Sample Data

### Test User Account

**James Miller (CEO / System Administrator)**

```sql
-- Credentials
Email: james.miller@huronhome.ca
Password: password123 (bcrypt hashed in database)
ID: 8260b1b0-5efc-4611-ad33-ee76c0cf7f13

-- Permissions: Full access to 16 entity types
SELECT entity, entity_id, permission
FROM app.d_entity_id_rbac_map
WHERE empid = '8260b1b0-5efc-4611-ad33-ee76c0cf7f13';

-- Result: 16 rows with entity_id='all' and permission='{0,1,2,3,4}'
```

### Test Project

**Fall 2024 Landscaping Campaign**

```sql
ID: 84215ccb-313d-48f8-9c37-4398f28c0b1f
Code: PRJ-2024-001
Name: Fall 2024 Landscaping Campaign
Manager: James Miller
```

### Sample Entity Counts

```sql
SELECT COUNT(*) FROM app.d_employee;    -- 5 employees
SELECT COUNT(*) FROM app.d_project;     -- 5 projects
SELECT COUNT(*) FROM app.d_task;        -- 8 tasks
SELECT COUNT(*) FROM app.d_client;      -- 3 clients
SELECT COUNT(*) FROM app.d_role;        -- 22 roles
SELECT COUNT(*) FROM app.d_position;    -- 16 positions
```

## Query Patterns

### 1. List Projects with RBAC Filtering

```sql
SELECT p.*
FROM app.d_project p
WHERE p.active_flag = TRUE
  AND EXISTS (
    SELECT 1 FROM app.d_entity_id_rbac_map rbac
    WHERE rbac.empid = :user_id
      AND rbac.entity = 'project'
      AND (rbac.entity_id = p.id::TEXT OR rbac.entity_id = 'all')
      AND 0 = ANY(rbac.permission)
      AND rbac.active_flag = TRUE
  )
ORDER BY p.name ASC;
```

### 2. Get Child Entities

```sql
-- Get tasks for a project
SELECT t.*
FROM app.d_task t
INNER JOIN app.d_entity_id_map eim
  ON eim.child_entity_id = t.id::TEXT
WHERE eim.parent_entity_id = :project_id
  AND eim.parent_entity_type = 'project'
  AND eim.child_entity_type = 'task'
  AND eim.active_flag = TRUE
  AND t.active_flag = TRUE
ORDER BY t.created_ts DESC;
```

### 3. Get Child Entity Counts

```sql
SELECT
  p.id,
  p.name,
  (SELECT COUNT(*) FROM app.d_entity_id_map eim
   WHERE eim.parent_entity_type = 'project'
     AND eim.parent_entity_id = p.id::TEXT
     AND eim.child_entity_type = 'task'
     AND eim.active_flag = TRUE) AS task_count,
  (SELECT COUNT(*) FROM app.d_entity_id_map eim
   WHERE eim.parent_entity_type = 'project'
     AND eim.parent_entity_id = p.id::TEXT
     AND eim.child_entity_type = 'wiki'
     AND eim.active_flag = TRUE) AS wiki_count
FROM app.d_project p
WHERE p.id = :project_id;
```

### 4. Hierarchical Query (Office Tree)

```sql
WITH RECURSIVE office_tree AS (
  -- Anchor: Start with region
  SELECT * FROM app.d_office
  WHERE level_id = 2 AND id = :region_id

  UNION ALL

  -- Recursive: Get child offices
  SELECT o.* FROM app.d_office o
  INNER JOIN office_tree ot ON o.parent_id = ot.id
)
SELECT * FROM office_tree
ORDER BY level_id DESC, name ASC;
```

### 5. Permission Summary

```sql
SELECT
  entity,
  entity_id,
  permission,
  CASE
    WHEN entity_id = 'all' THEN 'Full access to all instances'
    ELSE 'Limited to specific instance'
  END AS access_scope
FROM app.d_entity_id_rbac_map
WHERE empid = :user_id
  AND active_flag = TRUE
ORDER BY entity, entity_id;
```

## Database Maintenance

### Adding New DDL File

1. **Create file** in `/home/rabin/projects/pmo/db/`
   - Follow naming: `<number>_d_<entity>.ddl` or `setting_datalabel_<name>.ddl`
   - Include 3 sections: semantics, DDL, data curation

2. **Add to import script** in `/home/rabin/projects/pmo/tools/db-import.sh`
   ```bash
   DDL_FILES=(
     ...existing files...
     "41_d_myentity.ddl"
   )
   ```

3. **Run import**
   ```bash
   ./tools/db-import.sh
   ```

### Data Curation Guidelines

**IMPORTANT:** Only curate data for test user James Miller

```sql
-- Always use James Miller's ID
empid = '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'

-- Always use Fall 2024 project for test data
project_id = '84215ccb-313d-48f8-9c37-4398f28c0b1f'
```

**Best Practices:**
- Use meaningful `code` values (e.g., `PRJ-2024-001`)
- Generate unique `slug` from name (e.g., `fall-2024-landscaping`)
- Set `active_flag = TRUE` for current records
- Use `to_ts` for soft deletes
- Store flexible data in `metadata` JSONB field
- Use `tags` array for searchable categorization

## Indexes & Performance

### Composite Indexes

```sql
-- RBAC lookups
CREATE INDEX idx_rbac_emp_entity
  ON app.d_entity_id_rbac_map(empid, entity, entity_id);

-- Entity relationships
CREATE INDEX idx_entity_map_parent
  ON app.d_entity_id_map(parent_entity_id, child_entity_type);

CREATE INDEX idx_entity_map_child
  ON app.d_entity_id_map(child_entity_id);

-- Active flag filtering
CREATE INDEX idx_project_active ON app.d_project(active_flag) WHERE active_flag = TRUE;
CREATE INDEX idx_task_active ON app.d_task(active_flag) WHERE active_flag = TRUE;
```

### Query Optimization

- All RBAC checks use indexed columns
- `entity_id_map` queries use indexed joins
- Partial indexes on `active_flag` for performance
- JSONB GIN indexes on `tags` and `metadata` fields

## Troubleshooting

### Connection Issues

```bash
# Check if Postgres is running
docker ps | grep postgres

# Test connection
psql -h localhost -p 5434 -U app -d app -c "SELECT NOW();"
```

### Schema Validation

```bash
# Check table count
psql -h localhost -p 5434 -U app -d app -c "\dt app.*"

# Verify sample data
psql -h localhost -p 5434 -U app -d app -c "SELECT COUNT(*) FROM app.d_employee;"
```

### Import Issues

```bash
# Dry run first
./tools/db-import.sh --dry-run

# Verbose output
./tools/db-import.sh --verbose

# Check logs
./tools/logs-api.sh
```

## Support & Documentation

- **Main README:** `/home/rabin/projects/pmo/README.md`
- **API Documentation:** `/home/rabin/projects/pmo/apps/api/README.md`
- **Frontend Guide:** `/home/rabin/projects/pmo/apps/web/README.md`
- **Management Tools:** `/home/rabin/projects/pmo/tools/README.md`
- **Import Script:** `/home/rabin/projects/pmo/tools/db-import.sh`

---

**Last Updated:** 2025-10-18
**Schema Version:** 4.1
**Database:** PostgreSQL 14+
**Total DDL Files:** 40
**Total Tables:** 35+
**Organization:** Huron Home Services Corporation
