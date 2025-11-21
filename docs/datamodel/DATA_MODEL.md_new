# PMO Platform Data Model

**Version:** 3.0.0 | **Schema:** `app` | **Tables:** 50+ | **DDL Files:** 50

---

## Semantics

The PMO Platform uses a PostgreSQL schema with Roman numeral prefixed DDL files for deterministic import ordering. The data model follows a **no foreign keys** architecture where all relationships are managed via `entity_instance_link`.

**Core Principle:** No FK constraints. All relationships via linkage table. Soft deletes only.

---

## System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DATA MODEL ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    ENTITY TABLES (d_*)                           │    │
│  │  d_project, d_task, d_employee, d_office, d_business, etc.      │    │
│  │  (17 core business entities)                                     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              │ linked via                               │
│                              v                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    INFRASTRUCTURE TABLES                         │    │
│  │  ┌─────────────┬──────────────────┬─────────────────────────┐   │    │
│  │  │   entity    │ entity_instance  │ entity_instance_link    │   │    │
│  │  │  (types)    │    (registry)    │   (relationships)       │   │    │
│  │  └─────────────┴──────────────────┴─────────────────────────┘   │    │
│  │                                                                  │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │              entity_rbac (permissions)                   │    │    │
│  │  └─────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    FACT TABLES (f_*)                             │    │
│  │  f_order, f_invoice, f_inventory, f_interaction, etc.           │    │
│  │  (10 transactional tables)                                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    SETTINGS TABLE                                │    │
│  │  setting_datalabel (all dropdowns/workflows)                    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
Entity Relationship Flow (No Foreign Keys)
──────────────────────────────────────────

d_project                entity_instance_link              d_task
─────────                ────────────────────              ──────

id: uuid-1          →    parent_entity_type: 'project'    ←    id: uuid-2
name: "Website"          parent_entity_id: uuid-1               name: "Design"
                         child_entity_type: 'task'
                         child_entity_id: uuid-2


RBAC Permission Flow
────────────────────

User Request              entity_rbac                      Access Result
────────────              ───────────                      ─────────────

User: emp-uuid       →    entity_type: 'project'      →   permission[1] = 1
Entity: project           entity_id: uuid-1                EDIT allowed
Action: EDIT              employee_id: emp-uuid
                         permission: [1,1,0,0,0,0]
```

---

## Architecture Overview

### DDL File Categories

| Range | Purpose | Example |
|-------|---------|---------|
| I-II | Schema & Settings | `I_schemaCreate.ddl`, `II_setting_datalabel.ddl` |
| III-IX | People & Organization | `d_employee`, `d_office`, `d_business` |
| X-XIV | Products & Projects | `d_product`, `d_project`, `d_task` |
| XV-XXV | Content & Workflow | `d_artifact`, `d_form_head`, `d_wiki` |
| XXVI-XXXIII | Facts | `f_order`, `f_invoice`, `f_inventory` |
| XXXIV-XLIII | Events & Messaging | `d_event`, `d_message_schema` |
| XLIV-XLIX | Entity Infrastructure | `entity`, `entity_instance_link`, `entity_rbac` |
| L-LI | Operations | `d_cost`, `f_logging` |

### Core Tables Summary

| Table | Type | Purpose |
|-------|------|---------|
| `d_project` | Entity | Projects |
| `d_task` | Entity | Tasks |
| `d_employee` | Entity | Employees |
| `d_office` | Entity | Offices |
| `d_business` | Entity | Business units |
| `d_cust` | Entity | Customers |
| `entity` | Infrastructure | Entity type metadata |
| `entity_instance_link` | Infrastructure | Parent-child relationships |
| `entity_rbac` | Infrastructure | Permissions |
| `setting_datalabel` | Settings | Dropdowns/workflows |
| `f_order` | Fact | Orders |
| `f_invoice` | Fact | Invoices |

---

## Tooling Overview

### Standard Entity DDL Pattern

```sql
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
```

### Column Naming Conventions

| Pattern | Type | Example |
|---------|------|---------|
| `*_flag` | Boolean | `active_flag`, `is_completed` |
| `dl__*` | Settings FK | `dl__project_stage`, `dl__task_priority` |
| `*_id` | UUID reference | `employee_id`, `project_id` |
| `*_amt` | Currency | `total_amt`, `budget_amt` |
| `*_pct` | Percentage | `completion_pct` |
| `*_ts` | Timestamp | `created_ts`, `from_ts` |
| `*_date` | Date | `start_date`, `due_date` |
| `*_empid` | Employee ref | `assigned_empid` |

### Database Commands

```bash
# Import all DDL files
./tools/db-import.sh

# Connect to database
PGPASSWORD='app' psql -h localhost -p 5434 -U app -d app

# List tables
\dt app.*
```

---

## Database/API/UI Mapping

### Entity Table to API Mapping

| Table | API Endpoint | Entity Code |
|-------|--------------|-------------|
| `d_project` | `/api/v1/project` | `project` |
| `d_task` | `/api/v1/task` | `task` |
| `d_employee` | `/api/v1/employee` | `employee` |
| `d_office` | `/api/v1/office` | `office` |
| `d_business` | `/api/v1/business` | `business` |
| `d_cust` | `/api/v1/cust` | `cust` |

### Infrastructure Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `entity` | Entity type metadata | code, name, icon, child_entity_codes |
| `entity_instance` | Instance registry | entity_code, entity_id, entity_instance_name |
| `entity_instance_link` | Relationships | parent_entity_type, parent_entity_id, child_entity_type, child_entity_id |
| `entity_rbac` | Permissions | employee_id, entity_type, entity_id, permission[] |

### Permission Array

| Index | Permission | Value |
|-------|------------|-------|
| 0 | VIEW | Read access |
| 1 | EDIT | Modify access |
| 2 | SHARE | Share access |
| 3 | DELETE | Delete access |
| 4 | CREATE | Create access |
| 5 | OWNER | Full control |

---

## User Interaction Flow

```
Create Entity with Linkage
──────────────────────────

1. User creates task under project
   │
2. API receives: POST /api/v1/task?parent_code=project&parent_id=uuid
   │
3. Database operations:
   │
   ├── INSERT INTO app.d_task (...)
   │   RETURNING id = task-uuid
   │
   ├── INSERT INTO app.entity_instance (...)
   │   { entity_code: 'task', entity_id: task-uuid, entity_instance_name: 'Task Name' }
   │
   ├── INSERT INTO app.entity_rbac (...)
   │   { entity_type: 'task', entity_id: task-uuid, employee_id: creator-uuid, permission: [1,1,1,1,0,1] }
   │
   └── INSERT INTO app.entity_instance_link (...)
       { parent_entity_type: 'project', parent_entity_id: project-uuid,
         child_entity_type: 'task', child_entity_id: task-uuid }


Query with RBAC
───────────────

1. User requests: GET /api/v1/project
   │
2. Query with RBAC filtering:
   │
   SELECT p.* FROM app.d_project p
   WHERE p.active_flag = true
     AND EXISTS (
       SELECT 1 FROM app.entity_rbac r
       WHERE r.entity_type = 'project'
         AND (r.entity_id = p.id::text OR r.entity_id = 'all')
         AND r.employee_id = {user-uuid}
         AND r.permission[0] = 1  -- VIEW permission
     )
   │
3. Return only accessible projects
```

---

## Critical Considerations

### Design Principles

1. **No Foreign Keys** - All relationships via `entity_instance_link`
2. **Soft Deletes** - `active_flag = false`, never physical delete
3. **Temporal Tracking** - `from_ts`/`to_ts` for validity periods
4. **Audit Trail** - `created_ts`/`updated_ts` on all records
5. **Universal RBAC** - `entity_rbac` for all permissions

### Standard Columns (Required)

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | Primary key |
| `code` | varchar | Business identifier |
| `name` | varchar | Display name |
| `active_flag` | boolean | Soft delete |
| `created_ts` | timestamp | Creation time |
| `updated_ts` | timestamp | Last update |
| `version` | int4 | Optimistic locking |

### Relationship Rules

| Rule | Implementation |
|------|----------------|
| Parent-child | Use `entity_instance_link` |
| One-to-many | Multiple link rows |
| Many-to-many | Multiple link rows |
| Self-reference | parent_type = child_type |
| Deletion | Hard delete link rows |

### Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Add FK constraints | Use entity_instance_link |
| Physical delete | Soft delete (active_flag) |
| Direct permission check | Use entity_rbac |
| Skip entity_instance registry | Always register instances |

---

**Last Updated:** 2025-11-21 | **Status:** Production Ready
