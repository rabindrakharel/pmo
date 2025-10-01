# PMO Database Documentation

> **Enterprise Project Management Office (PMO) Database Schema**
> Version: 4.0 | Schema: `app` | PostgreSQL 14+

## 📋 Table of Contents

- [Overview](#overview)
- [Database Architecture](#database-architecture)
- [Entity Catalog](#entity-catalog)
- [Relationship Model](#relationship-model)
- [RBAC Permission System](#rbac-permission-system)
- [Query Patterns](#query-patterns)
- [ER Diagram](#er-diagram)
- [Import & Setup](#import--setup)

---

## Overview

The PMO database is designed to support a comprehensive Project Management Office system for **Huron Home Services**, a Canadian service company managing landscaping, HVAC, plumbing, and other home services. The database follows a **flexible, relationship-driven architecture** with no direct foreign keys between most entities.

### Key Design Principles

1. **No Direct Foreign Keys** - All entity relationships managed through `entity_id_map`
2. **Hierarchical Organizations** - Offices (4 levels), Business units (3 levels)
3. **Array-Based RBAC** - Permission arrays `{0,1,2,3,4}` for fine-grained access control
4. **Common Field Structure** - All entities share: `id`, `slug`, `code`, `name`, `descr`, `tags`, temporal fields
5. **Metadata-Driven** - Configurable hierarchies and stages via `meta_*` tables
6. **SCD Type 2** - Temporal tracking with `from_ts`, `to_ts`, `active_flag`

### Business Context

- **Organization:** Huron Home Services Corporation
- **Location:** Ontario, Canada
- **Services:** Landscaping, Snow Removal, HVAC, Plumbing, Solar Energy
- **Use Cases:** Project tracking, task management, employee RBAC, client management

---

## Database Architecture

### Schema Structure

```
app (schema)
├── Core Business Entities (13 tables)
│   ├── d_office, d_business, ops_project_head, ops_task_head
│   ├── d_employee, d_client, d_worksite
│   ├── d_role, d_position
│   └── d_artifact, d_wiki, ops_formlog_head, d_reports
│
├── Metadata/Configuration (5 tables)
│   ├── meta_office_level, meta_business_level
│   ├── meta_project_stage, meta_task_stage
│   └── meta_position_level
│
└── Relationships & RBAC (3 tables)
    ├── entity_id_hierarchy_mapping (parent-child relationships)
    ├── rel_employee_entity_action_rbac (permissions)
    └── rel_emp_role (employee-role assignments)
```

### Total: 21 Tables

| Category | Count | Purpose |
|----------|-------|---------|
| **Data Entities** | 13 | Core business objects |
| **Metadata** | 5 | Configuration & hierarchies |
| **Relationships** | 3 | Mappings & permissions |

---

## Entity Catalog

### 1️⃣ Core Business Entities (13 tables)

#### Organizational Entities

**`d_office`** - Physical Office Locations
- **Hierarchy:** 4 levels (Office → District → Region → Corporate)
- **Key Fields:** `id`, `code`, `name`, `level_id`, `parent_id`, `address`, `city`, `province`
- **Records:** 5 offices across Ontario
- **Purpose:** Geographic organization, office-based filtering

**`d_business`** - Business Units & Departments
- **Hierarchy:** 3 levels (Department → Division → Corporate)
- **Key Fields:** `id`, `code`, `name`, `level_id`, `parent_id`, `office_id`
- **Records:** 6 business units (Landscaping, HVAC, Plumbing, etc.)
- **Purpose:** Organizational hierarchy, business unit management

#### Project Management Entities

**`d_project`** - Projects
- **Key Fields:** `id`, `code`, `name`, `project_stage`, `budget_allocated`, `budget_spent`
- **Team Fields:** `manager_employee_id`, `sponsor_employee_id`, `stakeholder_employee_ids[]`
- **Timeline:** `planned_start_date`, `planned_end_date`, `actual_start_date`, `actual_end_date`
- **Records:** 5 active projects
- **Purpose:** Project tracking, budget management, timeline planning
- **Sample:** "Digital Transformation Initiative 2024", "Fall 2024 Landscaping Campaign"

**`d_task`** - Tasks
- **Key Fields:** `id`, `code`, `name`, `stage`, `priority_level`, `project_id`
- **Assignment:** `assignee_employee_ids[]`
- **Estimation:** `estimated_hours`, `actual_hours`, `story_points`
- **Dependencies:** `parent_task_id`, `dependency_task_ids[]`
- **Records:** 8 tasks across multiple projects
- **Purpose:** Task management, work tracking, dependency management

#### Personnel Entities

**`d_employee`** - Employees & User Accounts
- **Key Fields:** `id`, `email`, `password_hash`, `employee_number`
- **Authentication:** JWT-based, bcrypt password hashing
- **Contact:** `phone`, `mobile`, `emergency_contact_name`, `emergency_contact_phone`
- **Employment:** `employee_type`, `department`, `title`, `hire_date`, `manager_employee_id`
- **Records:** 5 employees including James Miller (CEO)
- **Purpose:** User authentication, RBAC, organizational chart

**`d_role`** - Organizational Roles
- **Key Fields:** `id`, `code`, `name`, `role_type`, `responsibilities`
- **Records:** 22 roles
- **Purpose:** Role definitions, responsibility assignment

**`d_position`** - Employee Positions
- **Key Fields:** `id`, `code`, `name`, `level_id`, `department`
- **Records:** 16 positions
- **Purpose:** Job titles, organizational structure

#### Client & Site Entities

**`d_client`** - Client Entities
- **Key Fields:** `id`, `code`, `name`, `client_type`, `contact_email`, `contact_phone`
- **Address:** `address_line1`, `city`, `province`, `postal_code`
- **Records:** 11 clients
- **Purpose:** Customer relationship management

**`d_worksite`** - Work Site Locations
- **Key Fields:** `id`, `code`, `name`, `site_type`, `client_id`
- **Location:** `address`, `city`, `province`, `latitude`, `longitude`
- **Records:** 6 worksites
- **Purpose:** Job site tracking, location management

#### Content Management Entities

**`d_artifact`** - Documents & Artifacts
- **Key Fields:** `id`, `name`, `artifact_type`, `file_path`, `mime_type`, `project_id`
- **Records:** 0 (ready for use)
- **Purpose:** File attachments, document management

**`d_wiki`** - Wiki Knowledge Base
- **Key Fields:** `id`, `title`, `slug`, `content`, `published`, `project_id`
- **Records:** 0 (ready for use)
- **Purpose:** Documentation, knowledge management

**`d_form_head`** - Form Definitions
- **Key Fields:** `id`, `name`, `form_type`, `schema`, `project_id`
- **Records:** 0 (ready for use)
- **Purpose:** Form templates, data collection

**`d_reports`** - Report Definitions
- **Key Fields:** `id`, `name`, `report_type`, `query_definition`
- **Records:** 0 (ready for use)
- **Purpose:** Report templates, analytics

---

### 2️⃣ Metadata & Configuration Tables (6 tables)

These tables define configurable hierarchies and workflow stages.

**`meta_office_level`** - Office Hierarchy Levels
- **Levels:** 4 (Office → District → Region → Corporate)
- **Records:** 4

**`meta_business_level`** - Business Hierarchy Levels
- **Levels:** 3 (Department → Division → Corporate)
- **Records:** 3

**`meta_project_stage`** - Project Lifecycle Stages
- **Stages:** Initiation, Planning, In Progress, On Hold, Completed, Cancelled, Archived
- **Records:** 7

**`meta_task_stage`** - Task Workflow Stages
- **Stages:** To Do, In Progress, In Review, Blocked, Done, Cancelled, Archived
- **Records:** 7

**`meta_client_level`** - Client Hierarchy Levels
- **Records:** 5

**`meta_position_level`** - Position Hierarchy Levels
- **Records:** 8

---

### 3️⃣ Relationship & RBAC Tables (4 tables)

**`entity_map`** - Central Entity Registry
- **Purpose:** Tracks all entity instances across the system
- **Key Fields:** `entity_type`, `entity_id`, `entity_name`, `entity_slug`, `entity_code`
- **Records:** 0 (legacy table, replaced by entity_id_map)

**`entity_id_map`** - Parent-Child Relationships
- **Purpose:** Maps relationships between entity instances (NO FOREIGN KEYS)
- **Key Fields:** `parent_entity_type`, `parent_entity_id`, `child_entity_type`, `child_entity_id`, `relationship_type`
- **Records:** 14 relationships
- **Examples:**
  - `business → project` (owns)
  - `project → task` (contains)
  - `project → artifact` (contains)
  - `office → business` (hosts)

**`entity_id_rbac_map`** - RBAC Permission System
- **Purpose:** Fine-grained access control for all entities
- **Key Fields:** `empid`, `entity`, `entity_id`, `permission[]`, `active_flag`
- **Permission Array:** `{0,1,2,3,4}` → `{View, Edit, Share, Delete, Create}`
- **Special Values:**
  - `entity_id = 'all'` → Type-level permissions (access to ALL instances)
  - `entity_id = '<uuid>'` → Instance-level permissions (access to ONE instance)
- **Records:** 16 for James Miller (CEO with full access)

**`rel_emp_role`** - Employee-Role Assignments
- **Purpose:** Links employees to organizational roles
- **Key Fields:** `employee_id`, `role_id`, `from_ts`, `to_ts`
- **Records:** 1

---

## Relationship Model

### No Direct Foreign Keys Design

Instead of traditional foreign keys, relationships are managed through the `entity_id_map` table:

```sql
-- Traditional approach (NOT USED):
-- ALTER TABLE d_task ADD FOREIGN KEY (project_id) REFERENCES d_project(id);

-- PMO approach (USED):
INSERT INTO entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
SELECT 'project', t.project_id, 'task', t.id
FROM d_task t;
```

### Entity Relationship Patterns

```
office (1) ──hosts──> business (N)
business (1) ──owns──> project (N)
project (1) ──contains──> task (N)
project (1) ──contains──> artifact (N)
project (1) ──contains──> wiki (N)
project (1) ──contains──> form (N)
employee (N) ──assigned_to──> task (N)
employee (N) ──assigned_to──> role (N)
```

### Hierarchical Relationships

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

---

## RBAC Permission System

### Permission Array Structure

```sql
permission integer[] = {0, 1, 2, 3, 4}
```

| Code | Name | Description | API Action |
|------|------|-------------|------------|
| **0** | View | Read access to entity data | `GET /api/v1/project/:id` |
| **1** | Edit | Modify existing entity data | `PUT /api/v1/project/:id` |
| **2** | Share | Share entity with other users | Custom share endpoints |
| **3** | Delete | Soft delete entity | `DELETE /api/v1/project/:id` |
| **4** | Create | Create new entities | `POST /api/v1/project` |

### Permission Scopes

**Type-Level Permissions** (`entity_id = 'all'`)
- Grants access to **ALL instances** of that entity type
- Example: James Miller has `entity='project', entity_id='all', permission={0,1,2,3,4}`
- Result: Can view, edit, share, delete, and create ANY project

**Instance-Level Permissions** (`entity_id = '<uuid>'`)
- Grants access to **ONE specific instance**
- Example: `entity='project', entity_id='93106ffb-...', permission={0,1}`
- Result: Can only view and edit that one specific project

### Permission Check Queries

**Can user view a specific project?**
```sql
SELECT EXISTS (
  SELECT 1 FROM app.entity_id_rbac_map
  WHERE empid = :user_id
    AND entity = 'project'
    AND (entity_id = :project_id OR entity_id = 'all')
    AND 0 = ANY(permission)  -- View permission
    AND active_flag = true
) AS has_view_permission;
```

**Can user create projects?**
```sql
SELECT EXISTS (
  SELECT 1 FROM app.entity_id_rbac_map
  WHERE empid = :user_id
    AND entity = 'project'
    AND entity_id = 'all'  -- Must be type-level
    AND 4 = ANY(permission)  -- Create permission
    AND active_flag = true
) AS has_create_permission;
```

**Can user create project AND assign to business?**
```sql
SELECT
  CASE WHEN (
    -- Permission 1: Can create projects
    EXISTS (
      SELECT 1 FROM app.entity_id_rbac_map
      WHERE empid = :user_id
        AND entity = 'project'
        AND entity_id = 'all'
        AND 4 = ANY(permission)
        AND active_flag = true
    )
    AND
    -- Permission 2: Can edit specific business
    EXISTS (
      SELECT 1 FROM app.entity_id_rbac_map
      WHERE empid = :user_id
        AND entity IN ('biz', 'business')
        AND (entity_id = :business_id OR entity_id = 'all')
        AND 1 = ANY(permission)
        AND active_flag = true
    )
  ) THEN 'AUTHORIZED'
  ELSE 'DENIED'
  END AS authorization_result;
```

---

## Query Patterns

### 1. List Projects with RBAC Filtering

```sql
-- Get all projects the user can view
SELECT p.*
FROM app.d_project p
WHERE p.active_flag = true
  AND EXISTS (
    SELECT 1 FROM app.entity_id_rbac_map rbac
    WHERE rbac.empid = :user_id
      AND rbac.entity = 'project'
      AND (rbac.entity_id = p.id::text OR rbac.entity_id = 'all')
      AND 0 = ANY(rbac.permission)  -- View permission
      AND rbac.active_flag = true
  )
ORDER BY p.name ASC;
```

### 2. Get Tasks for a Specific Project

```sql
-- Using entity_id_map for relationship
SELECT t.*
FROM app.d_task t
INNER JOIN app.entity_id_map eim
  ON eim.child_entity_type = 'task'
  AND eim.child_entity_id = t.id
WHERE eim.parent_entity_type = 'project'
  AND eim.parent_entity_id = :project_id
  AND eim.active_flag = true
  AND t.active_flag = true
ORDER BY t.priority_level DESC, t.created_ts DESC;
```

### 3. Get Project with Child Entity Counts

```sql
SELECT
  p.*,
  (SELECT COUNT(*) FROM app.entity_id_map eim
   WHERE eim.parent_entity_type = 'project'
     AND eim.parent_entity_id = p.id
     AND eim.child_entity_type = 'task'
     AND eim.active_flag = true) AS task_count,
  (SELECT COUNT(*) FROM app.entity_id_map eim
   WHERE eim.parent_entity_type = 'project'
     AND eim.parent_entity_id = p.id
     AND eim.child_entity_type = 'artifact'
     AND eim.active_flag = true) AS artifact_count
FROM app.d_project p
WHERE p.id = :project_id
  AND p.active_flag = true;
```

### 4. Hierarchical Office Query

```sql
-- Get all offices in a specific region
WITH RECURSIVE office_tree AS (
  -- Anchor: Start with region office
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

### 5. Employee Permissions Summary

```sql
-- Get all entity types an employee has access to
SELECT
  entity AS entity_type,
  entity_id AS scope,
  permission AS permissions,
  CASE
    WHEN entity_id = 'all' THEN 'Full access to ALL instances'
    ELSE 'Limited to specific instance'
  END AS access_description
FROM app.entity_id_rbac_map
WHERE empid = :user_id
  AND active_flag = true
ORDER BY entity;
```

### 6. Create Project with Relationship

```sql
-- Step 1: Insert project
INSERT INTO app.d_project (code, name, descr, business_id, manager_employee_id)
VALUES ('PRJ-001', 'New Project', 'Description', :business_id, :manager_id)
RETURNING id;

-- Step 2: Create relationship in entity_id_map
INSERT INTO app.entity_id_map (
  parent_entity_type, parent_entity_id,
  child_entity_type, child_entity_id,
  relationship_type
) VALUES (
  'business', :business_id,
  'project', :project_id,
  'owns'
);
```

---

## ER Diagram

### High-Level Entity Relationships

```
┌─────────────┐
│   Office    │ (4-level hierarchy)
└──────┬──────┘
       │ hosts
       ▼
┌─────────────┐
│  Business   │ (3-level hierarchy)
└──────┬──────┘
       │ owns
       ▼
┌─────────────┐       ┌─────────────┐
│   Project   │◄──────┤  Employee   │
└──────┬──────┘       └─────────────┘
       │ contains         │ assigned_to
       ├──────────────────┤
       ▼                  ▼
┌─────────────┐       ┌─────────────┐
│    Task     │       │    Role     │
└─────────────┘       └─────────────┘
       │ contains
       ├──────┬──────┬──────┐
       ▼      ▼      ▼      ▼
  ┌────────┐ ┌────┐ ┌────┐ ┌────────┐
  │Artifact│ │Wiki│ │Form│ │ Report │
  └────────┘ └────┘ └────┘ └────────┘

┌─────────────┐       ┌─────────────┐
│   Client    │       │  Worksite   │
└─────────────┘       └─────────────┘
```

### RBAC Model

```
┌──────────────────────────────────────────┐
│          entity_id_rbac_map              │
├──────────────────────────────────────────┤
│ empid (employee)                         │
│ entity (project, task, biz, etc.)        │
│ entity_id ('all' or specific UUID)       │
│ permission[] {0,1,2,3,4}                 │
│   0 = View, 1 = Edit, 2 = Share          │
│   3 = Delete, 4 = Create                 │
└──────────────────────────────────────────┘
```

---

## Import & Setup

### Quick Start

```bash
# 1. Start infrastructure (PostgreSQL, Redis)
docker-compose up -d

# 2. Import all DDL files (drops and recreates schema)
bash /home/rabin/projects/pmo/tools/db-import.sh

# 3. Verify import
psql -h localhost -p 5434 -U app -d app -c "\dt app.*"
```

### Import Order

The DDL files are imported in dependency order:

```
0. 0_initial_setup.ddl         - Drop and recreate schema
1. I-VI: meta_* tables         - Metadata configuration
2. VII: entity_map             - Entity registry framework
3. VIII: d_employee            - Employees (required for RBAC)
4. IX-XIV: Core entities       - Office, Business, Client, Role, etc.
5. XV-XVII: Project entities   - Projects, Tasks
6. XVIII-XXV: Content entities - Artifacts, Wiki, Forms, Reports
7. XXVI: entity_id_map         - Parent-child relationships
8. XXVII: entity_id_rbac_map   - RBAC permissions
9. XXVIII: rel_emp_role        - Employee-role assignments
```

### Default User Credentials

After import, you can log in with:

- **Email:** `james.miller@huronhome.ca`
- **Password:** `password123`
- **Role:** CEO / System Administrator
- **Permissions:** Full access to all 16 entity types

### Verification Queries

```sql
-- Check employee count
SELECT COUNT(*) FROM app.d_employee;  -- Expected: 5

-- Check RBAC for James Miller
SELECT entity, entity_id, permission
FROM app.entity_id_rbac_map
WHERE empid = '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
ORDER BY entity;  -- Expected: 16 rows

-- Check projects
SELECT id, code, name FROM app.d_project;  -- Expected: 5

-- Check entity relationships
SELECT parent_entity_type, child_entity_type, COUNT(*)
FROM app.entity_id_map
GROUP BY parent_entity_type, child_entity_type;  -- Expected: 14 total
```

---

## Common Field Structure

All entity tables share these common fields:

```sql
-- Identity & Naming
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
slug        varchar(100) UNIQUE NOT NULL
code        varchar(50) UNIQUE NOT NULL
name        varchar(200) NOT NULL
descr       text

-- Flexible Data Storage
tags        jsonb DEFAULT '[]'::jsonb    -- Array of tags
metadata    jsonb DEFAULT '{}'::jsonb    -- Flexible JSON data

-- Temporal Tracking (SCD Type 2)
from_ts     timestamptz DEFAULT now()
to_ts       timestamptz                  -- NULL = current version
active_flag boolean DEFAULT true

-- Audit Fields
created_ts  timestamptz DEFAULT now()
updated_ts  timestamptz DEFAULT now()
version     integer DEFAULT 1
```

---

## API Integration Notes

### REST API Patterns

The database supports these API patterns:

1. **List with RBAC:** `GET /api/v1/project` - Returns only projects user can view
2. **Get by ID:** `GET /api/v1/project/:id` - Checks user has view permission
3. **Create:** `POST /api/v1/project` - Checks user has create permission
4. **Update:** `PUT /api/v1/project/:id` - Checks user has edit permission
5. **Delete:** `DELETE /api/v1/project/:id` - Soft delete, checks delete permission
6. **Child entities:** `GET /api/v1/project/:id/task` - Returns tasks for project

### Authentication Flow

1. User logs in: `POST /api/v1/auth/login`
2. Server validates `d_employee.email` and `password_hash` (bcrypt)
3. Server generates JWT token with `{ sub: employee_id, email, name }`
4. Client includes token: `Authorization: Bearer <token>`
5. API middleware validates token, extracts `employee_id`
6. API queries `entity_id_rbac_map` to check permissions

---

## Maintenance & Best Practices

### Adding a New Entity Type

1. Create DDL file: `db/XX_d_<entity>.ddl`
2. Add to `db-import.sh` validation and import sections
3. Add RBAC entry in `XXVII_entity_id_rbac_map.ddl` for admin users
4. Update `entity_id_map` relationships if needed
5. Create corresponding API routes with RBAC checks

### Data Curation Guidelines

- Use meaningful `code` values (e.g., `PRJ-2024-001`)
- Generate unique `slug` from name (e.g., `digital-transformation-2024`)
- Store flexible data in `metadata` JSONB field
- Use `tags` array for searchable categorization
- Always set `active_flag = true` for current records
- Use `to_ts` for soft deletes or historical versions

---

## Support & Documentation

- **Database Tools:** `/home/rabin/projects/pmo/tools/`
- **DDL Files:** `/home/rabin/projects/pmo/db/`
- **API Documentation:** See `/home/rabin/projects/pmo/apps/api/README.md`
- **Import Script:** `tools/db-import.sh`
- **Test Script:** `tools/test-api-endpoints.sh`

---

**Last Updated:** 2025-01-30
**Schema Version:** 4.0
**Database:** PostgreSQL 14+
**Organization:** Huron Home Services Corporation
