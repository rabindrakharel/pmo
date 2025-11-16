# PMO Platform Data Model

**Version:** 3.0.0
**Last Updated:** 2025-11-12
**Status:** Current Production Schema

---

## Table of Contents

1. [Overview](#overview)
2. [DDL File Structure](#ddl-file-structure)
3. [Complete DDL Catalog](#complete-ddl-catalog)
4. [Standard DDL Patterns](#standard-ddl-patterns)
5. [Column Naming Conventions](#column-naming-conventions)
6. [Table Categories](#table-categories)
7. [Entity Relationships](#entity-relationships)
8. [RBAC Permission Model](#rbac-permission-model)
9. [Standard Column Patterns](#standard-column-patterns)
10. [Temporal & Audit Fields](#temporal--audit-fields)
11. [Data Examples](#data-examples)

---

## Overview

The PMO Platform uses a **50-table PostgreSQL schema** organized with Roman numeral prefixes for deterministic import ordering. The data model follows these core principles:

- **No Foreign Keys:** All relationships via `d_entity_instance_link` (polymorphic linkage)
- **Soft Deletes:** `active_flag` for logical deletion
- **In-Place Versioning:** `version` column for optimistic locking
- **Temporal Tracking:** `from_ts`/`to_ts` for time-based queries
- **Audit Trail:** `created_ts`/`updated_ts` for change tracking
- **Universal RBAC:** `d_entity_rbac` for all entity permissions

**Schema:** `app`
**Database:** PostgreSQL 14+
**Total DDL Files:** 50
**Import Order:** Roman numerals I-LI (1-51)

---

## DDL File Structure

### Naming Convention

```
{ROMAN_NUMERAL}_{table_name}.ddl
```

**Examples:**
- `I_schemaCreate.ddl` - Creates app schema
- `II_setting_datalabel.ddl` - Settings/datalabel master table
- `III_d_employee.ddl` - Employee entity
- `XLV_d_entity.ddl` - Entity metadata registry
- `LI_f_logging.ddl` - Logging fact table

### Import Order Rationale

**Roman numerals ensure deterministic execution order:**

1. **I (1)** - Schema creation
2. **II-VII (2-7)** - Settings and foundational entities
3. **VIII-XL (8-40)** - Core business entities and facts
4. **XLI-XLIX (41-49)** - Entity system infrastructure, orchestrator
5. **L-LI (50-51)** - Operational tables (cost, logging)

**Dependencies Flow:**
```
Schema → Settings → Core Entities → Entity Infrastructure → RBAC → Operations
```

---

## Complete DDL Catalog

### Schema & Settings (I-II)

| File | Table | Purpose |
|------|-------|---------|
| **I_schemaCreate.ddl** | `app` schema | PostgreSQL schema creation |
| **II_setting_datalabel.ddl** | `setting_datalabel` | Universal settings/dropdown master table |

### Core Entities - People & Organization (III-IX)

| File | Table | Purpose |
|------|-------|---------|
| **III_d_employee.ddl** | `d_employee` | Employee records |
| **IV_d_office.ddl** | `d_office` | Office locations |
| **V_d_business.ddl** | `d_business` | Business units |
| **VI_d_cust.ddl** | `d_cust` | Customer records |
| **VII_d_role.ddl** | `d_role` | User roles |
| **IX_d_worksite.ddl** | `d_worksite` | Job sites |

### Core Entities - Products & Services (X-XI)

| File | Table | Purpose |
|------|-------|---------|
| **X_d_service.ddl** | `d_service` | Service catalog |
| **XI_d_product.ddl** | `d_product` | Product catalog |

### Core Entities - Project Management (XII-XIV)

| File | Table | Purpose |
|------|-------|---------|
| **XII_d_project.ddl** | `d_project` | Projects |
| **XIII_d_task.ddl** | `d_task` | Tasks |
| **XIV_d_task_data.ddl** | `d_task_data` | Task extended data (JSONB) |

### Core Entities - Content Management (XV-XX)

| File | Table | Purpose |
|------|-------|---------|
| **XV_d_artifact.ddl** | `d_artifact` | Document/artifact metadata |
| **XVI_d_artifact_data.ddl** | `d_artifact_data` | Artifact file data (S3 references) |
| **XVII_d_form_head.ddl** | `d_form_head` | Form definitions |
| **XVIII_d_form_data.ddl** | `d_form_data` | Form submissions (JSONB) |
| **XIX_d_wiki.ddl** | `d_wiki` | Wiki pages |
| **XX_d_wiki_data.ddl** | `d_wiki_data` | Wiki content (Y.js CRDT) |

### Core Entities - Reporting & Workflow (XXI-XXV)

| File | Table | Purpose |
|------|-------|---------|
| **XXI_d_reports.ddl** | `d_reports` | Report definitions |
| **XXII_d_report_data.ddl** | `d_report_data` | Report results |
| **XXIII_d_workflow_automation.ddl** | `d_workflow_automation` | Workflow rules |
| **XXIV_d_industry_workflow_graph_head.ddl** | `d_industry_workflow_graph_head` | Workflow graph metadata |
| **XXV_d_industry_workflow_graph_data.ddl** | `d_industry_workflow_graph_data` | Workflow graph nodes/edges |

### Financial Facts (XXVI-XXX)

| File | Table | Purpose |
|------|-------|---------|
| **XXVI_f_inventory.ddl** | `f_inventory` | Inventory transactions |
| **XXVII_f_order.ddl** | `f_order` | Orders |
| **XXVIII_f_shipment.ddl** | `f_shipment` | Shipments |
| **XXIX_f_invoice.ddl** | `f_invoice` | Invoices |
| **XXX_fact_quote.ddl** | `fact_quote` | Quotes |

### Operational Facts (XXXI-XXXIII)

| File | Table | Purpose |
|------|-------|---------|
| **XXXI_fact_work_order.ddl** | `fact_work_order` | Work orders |
| **XXXII_f_industry_workflow_events.ddl** | `f_industry_workflow_events` | Workflow event log |
| **XXXIII_f_interaction.ddl** | `f_interaction` | Customer interactions |

### Event & Calendar System (XXXIV-XXXVI)

| File | Table | Purpose |
|------|-------|---------|
| **XXXIV_d_event.ddl** | `d_event` | Event master table |
| **XXXV_d_entity_person_calendar.ddl** | `d_entity_person_calendar` | Person calendar slots |
| **XXXVI_d_entity_event_person_calendar.ddl** | `d_entity_event_person_calendar` | Event attendee RSVP |

### Orchestrator & AI (XXXVII-XLI)

| File | Table | Purpose |
|------|-------|---------|
| **XXXVII_orchestrator_session.ddl** | `orchestrator_session` | AI session state |
| **XXXVIII_orchestrator_state.ddl** | `orchestrator_state` | Orchestrator state machine |
| **XXXIX_orchestrator_agent_log.ddl** | `orchestrator_agent_log` | Agent execution log |
| **XL_orchestrator_summary.ddl** | `orchestrator_summary` | Session summaries |
| **XLI_orchestrator_agents.ddl** | `orchestrator_agents` | Agent definitions |

### Messaging (XLII-XLIII)

| File | Table | Purpose |
|------|-------|---------|
| **XLII_d_message_schema.ddl** | `d_message_schema` | Message templates |
| **XLIII_f_message_data.ddl** | `f_message_data` | Sent messages log |

### Entity System Infrastructure (XLIV-XLIX)

| File | Table | Purpose |
|------|-------|---------|
| **XLIV_d_entity_map.ddl** | `d_entity_map` | Entity type definitions (DEPRECATED - use XLV) |
| **XLV_d_entity.ddl** | `d_entity` | Entity metadata registry (source of truth) |
| **XLVI_d_entity_instance_registry.ddl** | `d_entity_instance_registry` | Entity instance registry |
| **XLVII_d_entity_instance_backfill.ddl** | `d_entity_instance_backfill` | Instance backfill tracking |
| **XLVIII_d_entity_instance_link.ddl** | `d_entity_instance_link` | Parent-child entity linkages |
| **XLIX_d_d_entity_rbac.ddl** | `d_entity_rbac` | Entity permissions (RBAC) |

### Operational Tables (L-LI)

| File | Table | Purpose |
|------|-------|---------|
| **L_d_cost.ddl** | `d_cost` | Cost tracking |
| **LI_f_logging.ddl** | `f_logging` | Application logs |

---

## Standard DDL Patterns

### Common DDL Structure

Every entity DDL file follows this pattern:

```sql
-- 1. SEMANTICS HEADER
/*
Table: d_{entity}
Purpose: {Brief description}
Entity Type: {CORE|FACT|SETTING|INFRASTRUCTURE}
Relationships: {Parent/child entities}
*/

-- 2. DROP TABLE
DROP TABLE IF EXISTS app.d_{entity} CASCADE;

-- 3. CREATE TABLE
CREATE TABLE app.d_{entity} (
    -- Identity columns
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(100) UNIQUE NOT NULL,
    name varchar(255) NOT NULL,
    descr text,

    -- Business columns
    {entity_specific_columns},

    -- Metadata
    metadata jsonb DEFAULT '{}',

    -- Temporal & Audit
    active_flag boolean DEFAULT true,
    from_ts timestamp DEFAULT now(),
    to_ts timestamp,
    created_ts timestamp DEFAULT now(),
    updated_ts timestamp DEFAULT now(),
    version int4 DEFAULT 1
);

-- 4. CREATE INDEXES
CREATE INDEX idx_{entity}_code ON app.d_{entity}(code);
CREATE INDEX idx_{entity}_active ON app.d_{entity}(active_flag);
CREATE INDEX idx_{entity}_created ON app.d_{entity}(created_ts);

-- 5. GRANT PERMISSIONS
GRANT SELECT, INSERT, UPDATE, DELETE ON app.d_{entity} TO app;

-- 6. SEED DATA
INSERT INTO app.d_{entity} (code, name, descr, ...) VALUES
    ('code1', 'Name 1', 'Description 1', ...),
    ('code2', 'Name 2', 'Description 2', ...);
```

---

## Column Naming Conventions

### Universal Patterns

| Pattern | Usage | Examples |
|---------|-------|----------|
| **`_flag`** | Boolean fields | `active_flag`, `availability_flag`, `is_completed` |
| **`dl__*`** | Datalabel/settings foreign keys | `dl__project_stage`, `dl__task_priority` |
| **`*_id`** | UUID foreign keys | `employee_id`, `project_id`, `parent_wiki_id` |
| **`*_amt`** | Monetary amounts (numeric) | `total_amt`, `cost_amt`, `budget_amt` |
| **`*_qty`** | Quantities (numeric) | `quantity_qty`, `stock_qty` |
| **`*_pct`** | Percentages (numeric 0-100) | `completion_pct`, `discount_pct` |
| **`*_ts`** | Timestamps | `created_ts`, `from_ts`, `to_ts`, `published_ts` |
| **`*_date`** | Dates (no time) | `start_date`, `due_date` |
| **`*_empid`** | Employee references | `created_by_empid`, `assigned_empid` |
| **`*_metadata`** | JSONB extended data | `event_metadata`, `form_metadata` |

### Standard Identity Columns

Every entity table includes:

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- Surrogate key
code varchar(100) UNIQUE NOT NULL,              -- Business key
name varchar(255) NOT NULL,                     -- Display name
descr text                                       -- Description
```

### Standard Temporal Columns

```sql
active_flag boolean DEFAULT true,    -- Soft delete
from_ts timestamp DEFAULT now(),     -- Effective start
to_ts timestamp,                      -- Effective end
created_ts timestamp DEFAULT now(),   -- Record creation
updated_ts timestamp DEFAULT now(),   -- Last modification
version int4 DEFAULT 1                -- Optimistic locking
```

---

## Table Categories

### Core Entities (d_*)

**17 Core Business Entities:**

1. `d_employee` - Employees
2. `d_office` - Offices
3. `d_business` - Business units
4. `d_cust` - Customers
5. `d_role` - Roles
6. `d_worksite` - Work sites
7. `d_service` - Services
8. `d_product` - Products
9. `d_project` - Projects
10. `d_task` - Tasks
11. `d_artifact` - Documents/files
12. `d_form_head` - Forms
13. `d_wiki` - Wiki pages
14. `d_reports` - Reports
15. `d_event` - Events
16. `d_message_schema` - Message templates
17. `d_cost` - Costs

### Facts (f_*)

**Transactional tables (immutable after creation):**

- `f_inventory` - Inventory transactions
- `f_order` - Orders
- `f_shipment` - Shipments
- `f_invoice` - Invoices
- `f_interaction` - Customer interactions
- `f_message_data` - Sent messages
- `f_logging` - Application logs
- `f_industry_workflow_events` - Workflow events
- `fact_quote` - Quotes
- `fact_work_order` - Work orders

### Settings

**Dropdown/configuration master table:**

- `setting_datalabel` - Universal settings table

**Query Pattern:**
```sql
SELECT id, code, name, descr, datalabel, parent_ids, sort_order, color, metadata
FROM app.setting_datalabel
WHERE datalabel = 'dl__project_stage'
ORDER BY sort_order;
```

### Infrastructure Tables

**Entity System:**
- `d_entity` - Entity type metadata (icons, labels, child entities)
- `d_entity_instance_registry` - Entity instance registry
- `d_entity_instance_link` - Parent-child relationships
- `d_entity_rbac` - Permissions

**Orchestrator:**
- `orchestrator_session` - AI session state
- `orchestrator_state` - State machine
- `orchestrator_agent_log` - Agent logs
- `orchestrator_summary` - Session summaries
- `orchestrator_agents` - Agent definitions

---

## Entity Relationships

### No Foreign Keys Architecture

**Why No Foreign Keys?**
- Polymorphic relationships (1 task → N parents: project, customer, worksite)
- Flexible entity linkages
- Simplified schema evolution
- Performance (no cascade locks)

### d_entity_instance_link: Universal Linkage Table

**Purpose:** Store all parent-child entity relationships

```sql
CREATE TABLE app.d_entity_instance_link (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_entity_type varchar(50) NOT NULL,  -- 'PROJECT', 'CUSTOMER', etc.
    parent_entity_id uuid NOT NULL,
    child_entity_type varchar(50) NOT NULL,   -- 'TASK', 'ARTIFACT', etc.
    child_entity_id uuid NOT NULL,
    relationship_type varchar(50),             -- 'OWNS', 'ASSIGNED_TO', etc.
    metadata jsonb DEFAULT '{}',
    active_flag boolean DEFAULT true,
    created_ts timestamp DEFAULT now()
);
```

**Example: Project → Task Relationship**

```sql
-- Create project
INSERT INTO app.d_project (code, name)
VALUES ('PRJ-001', 'Website Redesign')
RETURNING id; -- Returns: abc-123-uuid

-- Create task
INSERT INTO app.d_task (code, name)
VALUES ('TASK-001', 'Design Homepage')
RETURNING id; -- Returns: def-456-uuid

-- Link task to project
INSERT INTO app.d_entity_instance_link (
    parent_entity_type, parent_entity_id,
    child_entity_type, child_entity_id
) VALUES (
    'PROJECT', 'abc-123-uuid',
    'TASK', 'def-456-uuid'
);
```

**Query: Get All Tasks for Project**

```sql
SELECT t.*
FROM app.d_task t
JOIN app.d_entity_instance_link map
    ON map.child_entity_id = t.id
    AND map.child_entity_type = 'TASK'
WHERE map.parent_entity_type = 'PROJECT'
  AND map.parent_entity_id = 'abc-123-uuid'
  AND map.active_flag = true
  AND t.active_flag = true;
```

---

## RBAC Permission Model

### d_entity_rbac: Universal Permissions

**Purpose:** Store entity-level permissions for all resources

```sql
CREATE TABLE app.d_entity_rbac (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type varchar(50) NOT NULL,     -- 'PROJECT', 'TASK', 'all'
    entity_id varchar(50) NOT NULL,       -- UUID or 'all' for type-wide
    employee_id uuid NOT NULL,            -- Who has permission
    permission int4[] NOT NULL,           -- {0,1,2,3,4,5}
    active_flag boolean DEFAULT true,
    created_ts timestamp DEFAULT now()
);
```

### Permission Array Schema

**Indexed permissions (array position = permission type):**

```
permission[0] = VIEW      (1=allowed, 0=denied)
permission[1] = EDIT      (1=allowed, 0=denied)
permission[2] = SHARE     (1=allowed, 0=denied)
permission[3] = DELETE    (1=allowed, 0=denied)
permission[4] = CREATE    (1=allowed, 0=denied)
permission[5] = OWNER     (1=allowed, 0=denied)
```

### Permission Examples

**Example 1: Full Access to All Projects**

```sql
INSERT INTO app.d_entity_rbac (
    entity_type, entity_id, employee_id, permission
) VALUES (
    'PROJECT', 'all', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    ARRAY[1,1,1,1,1,1]  -- All permissions
);
```

**Example 2: Read-Only Access to Specific Task**

```sql
INSERT INTO app.d_entity_rbac (
    entity_type, entity_id, employee_id, permission
) VALUES (
    'TASK', 'def-456-uuid', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    ARRAY[1,0,0,0,0,0]  -- View only
);
```

**Example 3: Event Owner Permissions**

```sql
-- Assigned employee gets owner permissions (permission[5] = 1)
INSERT INTO app.d_entity_rbac (
    entity_type, entity_id, employee_id, permission
) VALUES (
    'EVENT', 'event-uuid', 'assigned-employee-uuid',
    ARRAY[1,1,1,1,1,1]  -- Full ownership
);
```

### Permission Check Query

```sql
-- Check if employee can edit project
SELECT COALESCE(MAX(permission[1]), 0) AS can_edit
FROM app.d_entity_rbac
WHERE entity_type = 'PROJECT'
  AND (entity_id = 'abc-123-uuid' OR entity_id = 'all')
  AND employee_id = '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
  AND active_flag = true;
```

---

## Standard Column Patterns

### Hierarchical Entities

**Columns for self-referential hierarchies:**

```sql
parent_{entity}_id uuid,          -- Parent record
level int4,                        -- Depth in hierarchy
path varchar(500),                 -- Materialized path (e.g., '/1/2/5')
sort_order int4                    -- Display order
```

**Example: Wiki Pages**

```sql
CREATE TABLE app.d_wiki (
    id uuid PRIMARY KEY,
    parent_wiki_id uuid,           -- Parent page
    page_path varchar(500),        -- '/docs/api/rest'
    sort_order int4,               -- Sibling order
    ...
);
```

### Multi-Tenancy Columns

```sql
office_id uuid,                    -- Office assignment
business_id uuid,                  -- Business unit
tenant_id uuid                     -- Multi-tenant isolation
```

### Assignment & Ownership

```sql
assigned_empid uuid,               -- Current assignee
created_by_empid uuid,             -- Creator
owned_by_empid uuid,               -- Owner
approved_by_empid uuid             -- Approver
```

### Workflow State Tracking

```sql
dl__status varchar(50),            -- Current state (from settings)
dl__stage varchar(50),             -- Workflow stage
dl__priority varchar(50),          -- Priority level
completion_pct numeric(5,2)        -- Progress percentage
```

### File/Media References

```sql
file_path varchar(500),            -- S3 key
file_name varchar(255),            -- Original filename
file_size_bytes int8,              -- File size
file_mime_type varchar(100),       -- Content type
s3_bucket varchar(100),            -- S3 bucket name
s3_key varchar(500)                -- S3 object key
```

---

## Temporal & Audit Fields

### Soft Delete Pattern

**Never physically delete records - use soft delete:**

```sql
UPDATE app.d_project
SET active_flag = false,
    to_ts = now(),
    updated_ts = now()
WHERE id = 'abc-123-uuid';
```

**Query Active Records Only:**

```sql
SELECT * FROM app.d_project
WHERE active_flag = true;
```

### Temporal Validity (from_ts / to_ts)

**Track when records are effective:**

```sql
-- Get current active records
SELECT * FROM app.d_employee
WHERE active_flag = true
  AND from_ts <= now()
  AND (to_ts IS NULL OR to_ts > now());
```

**Historical Query (point-in-time):**

```sql
-- Who was assigned to this project on 2024-06-01?
SELECT e.*
FROM app.d_employee e
WHERE e.from_ts <= '2024-06-01'
  AND (e.to_ts IS NULL OR e.to_ts > '2024-06-01');
```

### Optimistic Locking (version)

**Prevent concurrent update conflicts:**

```sql
-- Read record with version
SELECT id, name, version FROM app.d_task WHERE id = 'task-uuid';
-- Returns: version = 5

-- Update with version check
UPDATE app.d_task
SET name = 'Updated Task Name',
    version = version + 1,
    updated_ts = now()
WHERE id = 'task-uuid'
  AND version = 5;  -- Only update if version hasn't changed

-- If no rows updated, conflict occurred (another user modified)
```

---

## Data Examples

### Example 1: Project with Tasks and Artifacts

**1. Create Project**

```sql
INSERT INTO app.d_project (id, code, name, descr, dl__project_stage, active_flag)
VALUES (
    '550e8400-e29b-41d4-a716-446655440001',
    'PRJ-2025-001',
    'Website Redesign',
    'Complete redesign of company website',
    'planning',
    true
);
```

**2. Create Tasks**

```sql
INSERT INTO app.d_task (id, code, name, dl__task_priority, dl__task_stage, assigned_empid)
VALUES
    ('550e8400-e29b-41d4-a716-446655440002', 'TASK-001', 'Design Homepage', 'high', 'in_progress', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'),
    ('550e8400-e29b-41d4-a716-446655440003', 'TASK-002', 'Setup Backend API', 'medium', 'backlog', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13');
```

**3. Link Tasks to Project**

```sql
INSERT INTO app.d_entity_instance_link (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
VALUES
    ('PROJECT', '550e8400-e29b-41d4-a716-446655440001', 'TASK', '550e8400-e29b-41d4-a716-446655440002'),
    ('PROJECT', '550e8400-e29b-41d4-a716-446655440001', 'TASK', '550e8400-e29b-41d4-a716-446655440003');
```

**4. Create Artifact**

```sql
INSERT INTO app.d_artifact (id, code, name, file_name, s3_bucket, s3_key)
VALUES (
    '550e8400-e29b-41d4-a716-446655440004',
    'ART-001',
    'Homepage Mockup',
    'homepage-v1.figma',
    'pmo-artifacts-prod',
    'projects/prj-2025-001/homepage-v1.figma'
);
```

**5. Link Artifact to Project**

```sql
INSERT INTO app.d_entity_instance_link (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
VALUES
    ('PROJECT', '550e8400-e29b-41d4-a716-446655440001', 'ARTIFACT', '550e8400-e29b-41d4-a716-446655440004');
```

**6. Grant Permissions**

```sql
-- Project owner (full permissions)
INSERT INTO app.d_entity_rbac (entity_type, entity_id, employee_id, permission)
VALUES (
    'PROJECT', '550e8400-e29b-41d4-a716-446655440001',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    ARRAY[1,1,1,1,1,1]
);

-- Task permissions (view + edit)
INSERT INTO app.d_entity_rbac (entity_type, entity_id, employee_id, permission)
VALUES (
    'TASK', '550e8400-e29b-41d4-a716-446655440002',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    ARRAY[1,1,0,0,0,0]
);
```

**7. Query Full Project Hierarchy**

```sql
SELECT
    p.code AS project_code,
    p.name AS project_name,
    p.dl__project_stage,
    t.code AS task_code,
    t.name AS task_name,
    t.dl__task_stage,
    a.code AS artifact_code,
    a.name AS artifact_name
FROM app.d_project p
LEFT JOIN app.d_entity_instance_link task_map
    ON task_map.parent_entity_id = p.id
    AND task_map.parent_entity_type = 'PROJECT'
    AND task_map.child_entity_type = 'TASK'
LEFT JOIN app.d_task t ON t.id = task_map.child_entity_id
LEFT JOIN app.d_entity_instance_link art_map
    ON art_map.parent_entity_id = p.id
    AND art_map.parent_entity_type = 'PROJECT'
    AND art_map.child_entity_type = 'ARTIFACT'
LEFT JOIN app.d_artifact a ON a.id = art_map.child_entity_id
WHERE p.id = '550e8400-e29b-41d4-a716-446655440001'
  AND p.active_flag = true;
```

**Result:**

```
project_code | project_name      | dl__project_stage | task_code | task_name          | dl__task_stage | artifact_code | artifact_name
-------------|-------------------|-------------------|-----------|--------------------|----------------|---------------|------------------
PRJ-2025-001 | Website Redesign  | planning          | TASK-001  | Design Homepage    | in_progress    | ART-001       | Homepage Mockup
PRJ-2025-001 | Website Redesign  | planning          | TASK-002  | Setup Backend API  | backlog        | ART-001       | Homepage Mockup
```

---

### Example 2: Event with Person Calendar and RSVP

**1. Create Event**

```sql
INSERT INTO app.d_event (
    id, code, name, event_type, event_platform_provider_name,
    event_addr, from_ts, to_ts, timezone
)
VALUES (
    '660e8400-e29b-41d4-a716-446655440001',
    'EVT-BK-2025-001',
    'Home Inspection Consultation',
    'onsite',
    'office',
    '123 Main St, Toronto, ON',
    '2025-11-15 10:00:00',
    '2025-11-15 11:00:00',
    'America/Toronto'
);
```

**2. Book Calendar Slots**

```sql
INSERT INTO app.d_entity_person_calendar (
    id, person_entity_type, person_entity_id,
    from_ts, to_ts, availability_flag, event_id
)
VALUES
    -- Slot 1: 10:00-10:15
    (gen_random_uuid(), 'EMPLOYEE', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
     '2025-11-15 10:00:00', '2025-11-15 10:15:00', false, '660e8400-e29b-41d4-a716-446655440001'),
    -- Slot 2: 10:15-10:30
    (gen_random_uuid(), 'EMPLOYEE', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
     '2025-11-15 10:15:00', '2025-11-15 10:30:00', false, '660e8400-e29b-41d4-a716-446655440001'),
    -- Slot 3: 10:30-10:45
    (gen_random_uuid(), 'EMPLOYEE', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
     '2025-11-15 10:30:00', '2025-11-15 10:45:00', false, '660e8400-e29b-41d4-a716-446655440001'),
    -- Slot 4: 10:45-11:00
    (gen_random_uuid(), 'EMPLOYEE', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
     '2025-11-15 10:45:00', '2025-11-15 11:00:00', false, '660e8400-e29b-41d4-a716-446655440001');
```

**3. Link Attendees (RSVP)**

```sql
INSERT INTO app.d_entity_event_person_calendar (
    event_id, person_entity_type, person_entity_id, event_rsvp_status
)
VALUES
    -- Employee (accepted)
    ('660e8400-e29b-41d4-a716-446655440001', 'EMPLOYEE', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 'accepted'),
    -- Customer (pending)
    ('660e8400-e29b-41d4-a716-446655440001', 'CUSTOMER', 'customer-uuid-here', 'pending');
```

**4. Set Event Owner Permissions**

```sql
INSERT INTO app.d_entity_rbac (entity_type, entity_id, employee_id, permission)
VALUES (
    'EVENT', '660e8400-e29b-41d4-a716-446655440001',
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    ARRAY[1,1,1,1,1,1]  -- Full ownership
);
```

**5. Query Enriched Calendar with Event Details**

```sql
SELECT
    pc.id AS calendar_slot_id,
    pc.from_ts,
    pc.to_ts,
    pc.availability_flag,
    e.code AS event_code,
    e.name AS event_name,
    e.event_type,
    e.event_platform_provider_name,
    e.event_addr,
    emp.name AS employee_name,
    STRING_AGG(att_emp.name, ', ') AS attendees
FROM app.d_entity_person_calendar pc
LEFT JOIN app.d_event e ON e.id = pc.event_id
LEFT JOIN app.d_employee emp
    ON emp.id = pc.person_entity_id
    AND pc.person_entity_type = 'EMPLOYEE'
LEFT JOIN app.d_entity_event_person_calendar rsvp ON rsvp.event_id = e.id
LEFT JOIN app.d_employee att_emp
    ON att_emp.id = rsvp.person_entity_id
    AND rsvp.person_entity_type = 'EMPLOYEE'
WHERE pc.person_entity_id = '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
  AND pc.person_entity_type = 'EMPLOYEE'
  AND pc.from_ts >= '2025-11-15 00:00:00'
  AND pc.from_ts < '2025-11-16 00:00:00'
GROUP BY pc.id, pc.from_ts, pc.to_ts, pc.availability_flag,
         e.code, e.name, e.event_type, e.event_platform_provider_name,
         e.event_addr, emp.name
ORDER BY pc.from_ts;
```

---

### Example 3: Settings-Based Workflow (Project Stages)

**1. Define Project Stages in Settings**

```sql
INSERT INTO app.setting_datalabel (
    id, code, name, descr, datalabel, parent_ids, sort_order, color, metadata
)
VALUES
    ('stage-1', 'initiation', 'Initiation', 'Project kickoff and planning', 'dl__project_stage', NULL, 1, '#3B82F6', '{}'),
    ('stage-2', 'planning', 'Planning', 'Detailed planning phase', 'dl__project_stage', ARRAY['stage-1'], 2, '#10B981', '{}'),
    ('stage-3', 'execution', 'Execution', 'Active development', 'dl__project_stage', ARRAY['stage-2'], 3, '#F59E0B', '{}'),
    ('stage-4', 'closure', 'Closure', 'Project completion', 'dl__project_stage', ARRAY['stage-3'], 4, '#6366F1', '{}');
```

**2. Query Workflow Graph**

```sql
SELECT
    code,
    name,
    sort_order,
    color,
    parent_ids,
    CASE
        WHEN parent_ids IS NULL THEN 'Start Node'
        ELSE 'Child Node'
    END AS node_type
FROM app.setting_datalabel
WHERE datalabel = 'dl__project_stage'
ORDER BY sort_order;
```

**Result:**

```
code       | name       | sort_order | color   | parent_ids  | node_type
-----------|------------|------------|---------|-------------|------------
initiation | Initiation | 1          | #3B82F6 | NULL        | Start Node
planning   | Planning   | 2          | #10B981 | {stage-1}   | Child Node
execution  | Execution  | 3          | #F59E0B | {stage-2}   | Child Node
closure    | Closure    | 4          | #6366F1 | {stage-3}   | Child Node
```

**3. DAG Visualization in Frontend**

```typescript
// Frontend auto-detects dl__* pattern and renders DAGVisualizer
<EntityFormContainer
  entityType="project"
  fieldConfigs={[
    {
      name: 'dl__project_stage',
      label: 'Project Stage',
      type: 'dag',  // Auto-detected from dl__ prefix
      loadOptionsFromSettings: true,
      settingsCategory: 'dl__project_stage'
    }
  ]}
/>
```

---

## Database Management

### Import All DDL Files

```bash
# Import/reset entire database (50 DDL files)
./tools/db-import.sh

# Options
./tools/db-import.sh --dry-run       # Preview without executing
./tools/db-import.sh --verbose       # Show detailed output
./tools/db-import.sh --skip-validation  # Skip validation checks
```

### Verify Schema

```sql
-- Count all tables in app schema
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'app';

-- List all entity tables (d_*)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'app'
  AND table_name LIKE 'd_%'
ORDER BY table_name;

-- List all fact tables (f_*)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'app'
  AND table_name LIKE 'f_%'
ORDER BY table_name;
```

### Database Connection

```bash
# Connect to PostgreSQL
PGPASSWORD='app' psql -h localhost -p 5434 -U app -d app

# Common queries
\dt app.*              # List all tables
\d app.d_project       # Describe table structure
\di app.*              # List all indexes
```

---

## Migration Guidelines

### Adding New Entity Table

**1. Create DDL File**

```bash
# Determine next Roman numeral (current max: LI = 51)
# Next: LII (52)

touch db/LII_d_new_entity.ddl
```

**2. Follow Standard DDL Pattern**

```sql
-- LII_d_new_entity.ddl
/*
Table: d_new_entity
Purpose: Brief description
Entity Type: CORE
Relationships: Parent/child entities
*/

DROP TABLE IF EXISTS app.d_new_entity CASCADE;

CREATE TABLE app.d_new_entity (
    -- Standard identity
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(100) UNIQUE NOT NULL,
    name varchar(255) NOT NULL,
    descr text,

    -- Business columns
    custom_field1 varchar(255),
    custom_field2 numeric(10,2),

    -- Metadata
    metadata jsonb DEFAULT '{}',

    -- Standard temporal & audit
    active_flag boolean DEFAULT true,
    from_ts timestamp DEFAULT now(),
    to_ts timestamp,
    created_ts timestamp DEFAULT now(),
    updated_ts timestamp DEFAULT now(),
    version int4 DEFAULT 1
);

CREATE INDEX idx_new_entity_code ON app.d_new_entity(code);
CREATE INDEX idx_new_entity_active ON app.d_new_entity(active_flag);

GRANT SELECT, INSERT, UPDATE, DELETE ON app.d_new_entity TO app;
```

**3. Update db-import.sh**

Add new file to DDL list in `tools/db-import.sh`:

```bash
ddl_files=(
    # ... existing files ...
    "LI_f_logging.ddl"
    "LII_d_new_entity.ddl"  # Add new file
)
```

**4. Re-import Database**

```bash
./tools/db-import.sh
```

**5. Register in d_entity Table**

```sql
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order, active_flag)
VALUES (
    'new_entity',
    'New Entity',
    'New Entities',
    'FileText',  -- Lucide icon name
    '[]',        -- Child entities (empty for now)
    99,          -- Display order
    true
);
```

### Modifying Existing Tables

**DON'T:**
- Add foreign keys (use d_entity_instance_link instead)
- Remove standard columns (id, code, name, active_flag, etc.)
- Change column data types without migration plan

**DO:**
- Add nullable columns
- Add indexes for performance
- Add JSONB metadata fields for flexibility
- Use migrations for backward-incompatible changes

---

## Summary

**Key Takeaways:**

1. **50 DDL Files:** Roman numerals I-LI ensure deterministic import order
2. **No Foreign Keys:** All relationships via `d_entity_instance_link`
3. **Universal RBAC:** `d_entity_rbac` for all entity permissions
4. **Soft Deletes:** `active_flag` for logical deletion
5. **Temporal Tracking:** `from_ts`/`to_ts` for time-based queries
6. **Audit Trail:** `created_ts`/`updated_ts` for change tracking
7. **Standard Patterns:** Every entity follows same DDL structure
8. **Settings-Driven:** All dropdowns/workflows from `setting_datalabel`
9. **Metadata Extensions:** JSONB `metadata` column for flexibility
10. **d_entity Registry:** Single source of truth for entity metadata

**Tools:**
- Import: `./tools/db-import.sh`
- Test: `./tools/test-api.sh GET /api/v1/entity/types`
- Connect: `PGPASSWORD='app' psql -h localhost -p 5434 -U app -d app`

---

**Last Updated:** 2025-11-12
**Schema Version:** 3.0.0
**Total Tables:** 50+
**Total DDL Files:** 50
