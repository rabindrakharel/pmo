# PMO Data Model

> **PostgreSQL 14+ database schema with 50+ tables powering the Universal Entity System**

## Overview

The PMO platform uses a **PostgreSQL 14+** database with a carefully designed schema that supports:

- **4 Infrastructure Tables** - Entity metadata, registry, linkages, and RBAC
- **46+ Entity Tables** - Business data across 11 domains
- **20+ Settings Tables** - Dropdown options and datalabels
- **Zero Foreign Keys** - Flexible polymorphic relationships via linkage table
- **Temporal Fields** - `from_ts`, `to_ts`, `active_flag` for soft deletes and versioning

## Table Naming Conventions

| Prefix | Purpose | Examples |
|--------|---------|----------|
| `d_` | **Dimension tables** (entities) | `d_project`, `d_task`, `d_employee`, `d_business` |
| `f_` | **Fact tables** (transactions) | `f_expense`, `f_revenue`, `f_invoice`, `f_order` |
| `setting_datalabel_` | **Settings/dropdowns** | `setting_datalabel_project_stage`, `setting_datalabel_task_priority` |
| `entity*` | **Infrastructure tables** (no prefix) | `entity`, `entity_instance`, `entity_instance_link`, `entity_rbac` |

## 4 Infrastructure Tables (Zero-Config System)

### 1. entity - Entity TYPE Metadata

**Purpose**: Single source of truth for entity TYPE definitions

**Key Fields**:
- `code` (PK) - Entity type identifier (`project`, `task`, `business`)
- `name` - Entity name (`Project`, `Task`, `Business`)
- `ui_label` - Plural label for UI (`Projects`, `Tasks`, `Businesses`)
- `ui_icon` - Lucide icon name (`FolderOpen`, `CheckSquare`, `Building2`)
- `child_entity_codes` (JSONB array) - Array of child entity type codes (`["task", "wiki", "artifact"]`)
- `db_table` - Database table name (`project`, `task`, `expense`)
- `column_metadata` (JSONB) - Column definitions from information_schema
- `domain_id`, `domain_code`, `domain_name` - Domain categorization

**DDL**: `db/entity_configuration_settings/02_entity.ddl`

**Key Operations**:
```sql
-- Get entity type metadata
SELECT * FROM app.entity WHERE code = 'project';

-- Get all active entity types
SELECT * FROM app.entity WHERE active_flag = true ORDER BY display_order;

-- Get child entity metadata
SELECT child_entities FROM app.entity WHERE code = 'project';
-- Returns: [{"entity": "task", "ui_icon": "CheckSquare", "ui_label": "Tasks"}]
```

**Example Records**:
```sql
-- Project entity type
code: 'project'
name: 'Project'
ui_label: 'Projects'
ui_icon: 'FolderOpen'
child_entities: ["task", "wiki", "artifact", "form", "expense", "revenue"]
db_table: 'd_project'

-- Task entity type
code: 'task'
name: 'Task'
ui_label: 'Tasks'
ui_icon: 'CheckSquare'
child_entities: ["form", "artifact", "expense", "revenue"]
db_table: 'd_task'
```

### 2. entity_instance - Entity INSTANCE Registry

**Purpose**: Central registry of all entity instances with IDs and metadata

**Key Fields**:
- `entity_code` - Entity type code (`project`, `task`, `employee`)
- `entity_instance_id` - UUID of specific instance
- `entity_instance_name` - Cached name for search/display
- `code` - Cached entity code for search/display (e.g., `PROJ-001`, `EMP-123`)
- `order_id` - Auto-incrementing display order

**DDL**: `db/entity_configuration_settings/03_entity_instance.ddl`

**Key Operations**:
```sql
-- Register instance
INSERT INTO app.entity_instance
(entity_code, entity_instance_id, entity_instance_name, code)
VALUES ('project', '...uuid...', 'Kitchen Renovation', 'PROJ-001');

-- Global search across all entities
SELECT * FROM app.entity_instance
WHERE entity_instance_name ILIKE '%kitchen%';

-- Count entities by type
SELECT entity_code, COUNT(*) as count
FROM app.entity_instance
GROUP BY entity_code;
```

### 3. entity_instance_link - Parent-Child Relationships

**Purpose**: Polymorphic linkage table connecting any entity to any other

**Key Fields**:
- `id` (PK) - Linkage UUID
- `parent_entity_type`, `parent_entity_id` - Parent entity
- `child_entity_type`, `child_entity_id` - Child entity
- `relationship_type` - Relationship label (`contains`, `assigned_to`, `relates_to`)
- `active_flag` - Soft delete flag

**DDL**: `db/entity_configuration_settings/05_entity_instance_link.ddl`

**Why No Foreign Keys**:
- ✅ Flexible cross-entity linking without constraints
- ✅ Soft deletes preserve children when parent deleted
- ✅ Temporal versioning with `from_ts`/`to_ts`
- ✅ Performance - no FK validation on inserts

**Key Operations**:
```sql
-- Create linkage (idempotent)
INSERT INTO app.entity_instance_link
(parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
VALUES ('business', '...uuid...', 'project', '...uuid...', 'contains')
ON CONFLICT (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
DO UPDATE SET active_flag = true, updated_ts = now();

-- Get children of specific type
SELECT child_entity_id
FROM app.entity_instance_link
WHERE parent_entity_type = 'project'
  AND parent_entity_id = '...uuid...'
  AND child_entity_type = 'task'
  AND active_flag = true;

-- Count children for tab badges
SELECT child_entity_type, COUNT(*) as count
FROM app.entity_instance_link
WHERE parent_entity_type = 'project'
  AND parent_entity_id = '...uuid...'
  AND active_flag = true
GROUP BY child_entity_type;
```

**Example Relationships**:
```sql
-- Business → Project
parent_entity_type: 'business'
parent_entity_id: '...'
child_entity_type: 'project'
child_entity_id: '...'
relationship_type: 'owns'

-- Project → Task
parent_entity_type: 'project'
parent_entity_id: '...'
child_entity_type: 'task'
child_entity_id: '...'
relationship_type: 'contains'

-- Task → Employee (assignment)
parent_entity_type: 'task'
parent_entity_id: '...'
child_entity_type: 'employee'
child_entity_id: '...'
relationship_type: 'assigned_to'
```

### 4. entity_rbac - Person-Based RBAC System

**Purpose**: Row-level permissions with role inheritance and person-based access control

**Key Fields**:
- `person_code` - `'employee'`, `'role'`, `'customer'`, `'vendor'`, or `'supplier'`
- `person_id` - UUID of person (employee, role, customer, vendor, supplier)
- `entity_code` - Target entity type (`project`, `task`, `business`, `office`)
- `entity_instance_id` - Target entity UUID (or `'11111111-1111-1111-1111-111111111111'` for type-level)
- `permission` - Integer 0-7 (VIEW, COMMENT, EDIT, SHARE, DELETE, CREATE, OWNER)
- `granted_by_employee_id` - Employee who granted this permission (delegation tracking)
- `granted_ts` - Timestamp when permission was granted
- `expires_ts` - Optional expiration for temporary permissions

**DDL**: `db/entity_configuration_settings/06_entity_rbac.ddl`

**Permission Hierarchy** (Automatic Inheritance):
```
OWNER (7) >= CREATE (6) >= DELETE (5) >= SHARE (4) >= EDIT (3) >= COMMENT (1) >= VIEW (0)
```

**Permission Checks** (using >= operator):
- **View**: `permission >= 0` (everyone with any permission)
- **Comment**: `permission >= 1` (add comments on entities)
- **Edit/Contribute**: `permission >= 3` (modify entity, form submission, task updates, wiki edits)
- **Share**: `permission >= 4` (share entity with others)
- **Delete**: `permission >= 5` (soft delete entity)
- **Create**: `permission >= 6` (create new entities - **type-level only**, requires `entity_instance_id='11111111-1111-1111-1111-111111111111'`)
- **Owner**: `permission >= 7` (full control including permission management)

**Type-Level Permissions** (grants access to ALL entities of a type):
```sql
-- Grant CREATE permission on ALL projects (type-level only)
INSERT INTO app.entity_rbac
(person_code, person_id, entity_code, entity_instance_id, permission)
VALUES ('employee', '...userId...', 'project', '11111111-1111-1111-1111-111111111111', 6);  -- Level 6 = CREATE

-- Grant VIEW permission to a role on ALL tasks
INSERT INTO app.entity_rbac
(person_code, person_id, entity_code, entity_instance_id, permission)
VALUES ('role', '...roleId...', 'task', '11111111-1111-1111-1111-111111111111', 0);  -- Level 0 = VIEW
```

**Instance-Level Permissions** (grants access to specific entity instances):
```sql
-- Grant OWNER permission to project creator
INSERT INTO app.entity_rbac
(person_code, person_id, entity_code, entity_instance_id, permission, granted_ts)
VALUES ('employee', '...userId...', 'project', '...projectId...', 7, now());  -- Level 7 = OWNER

-- Grant EDIT permission on specific task
INSERT INTO app.entity_rbac
(person_code, person_id, entity_code, entity_instance_id, permission)
VALUES ('employee', '...userId...', 'task', '...taskId...', 3);  -- Level 3 = EDIT
```

**Permission Resolution** (UNION of sources, MAX permission wins):
1. **Direct Person Permissions** - `person_code='employee'` with specific person_id
2. **Role-Based Permissions** - `person_code='role'` (resolved via `entity_instance_link` to find user's roles)
3. **Type-Level Fallback** - Check `entity_instance_id='11111111-1111-1111-1111-111111111111'` for type-level permissions
4. **Highest Permission Wins** - If user has multiple permissions, take MAX(permission)

**Key Operations**:
```sql
-- Check if user can EDIT specific entity (permission >= 3)
SELECT EXISTS(
  SELECT 1 FROM app.entity_rbac
  WHERE person_code = 'employee'
    AND person_id = '...userId...'
    AND entity_code = 'project'
    AND entity_instance_id IN ('...projectId...', '11111111-1111-1111-1111-111111111111')
    AND permission >= 3  -- Check for EDIT permission (level 3)
);

-- Get all entities user can VIEW (permission >= 0)
SELECT e.* FROM app.project e
INNER JOIN app.entity_rbac r
  ON r.entity_code = 'project'
  AND r.entity_instance_id IN (e.id, '11111111-1111-1111-1111-111111111111')
WHERE r.person_code = 'employee'
  AND r.person_id = '...userId...'
  AND r.permission >= 0;  -- VIEW permission
```

**Seed Data**: See `db/49_rbac_seed_data.ddl` for realistic role-based permissions

## Standard Entity Table Fields

All entity tables follow a consistent schema pattern:

### Core Fields (Required)

| Field | Type | Purpose |
|-------|------|---------|
| `id` | `uuid` | Primary key (auto-generated) |
| `code` | `varchar(100)` | Unique business code |
| `name` | `varchar(255)` | Entity name/title |
| `descr` | `text` | Description/notes |
| `metadata` | `jsonb` | Flexible JSON metadata |

### Temporal Fields (Required)

| Field | Type | Purpose |
|-------|------|---------|
| `from_ts` | `timestamptz` | Effective start timestamp |
| `to_ts` | `timestamptz` | Effective end timestamp (NULL = current) |
| `active_flag` | `boolean` | Soft delete flag (true = active) |
| `created_ts` | `timestamptz` | Record creation timestamp |
| `updated_ts` | `timestamptz` | Last update timestamp |
| `version` | `integer` | Optimistic locking version |

### Settings Fields (Common Pattern)

Fields starting with `dl__` reference settings dropdown options:

| Field | Purpose | Settings Table |
|-------|---------|----------------|
| `dl__project_stage` | Project workflow stage | `setting_datalabel_project_stage` |
| `dl__task_priority` | Task priority level | `setting_datalabel_task_priority` |
| `dl__task_stage` | Task workflow stage | `setting_datalabel_task_stage` |
| `dl__employee_status` | Employee status | `setting_datalabel_employee_status` |

## 11 Domain Categories

### 1. Customer 360 (`customer_360`)

**Purpose**: Unified people, organizations, and business structures

**Tables**:
- `d_cust` - Customers/clients
- `d_business` - Business units/divisions
- `d_employee` - Employees
- `d_role` - User roles
- `d_office` - Physical locations
- `d_worksite` - Work sites

### 2. Operations (`operations`)

**Purpose**: Internal operational execution

**Tables**:
- `d_project` - Projects
- `d_task` - Tasks/work items
- `fact_work_order` - Work orders
- `d_service` - Services offered

### 3. Product & Inventory (`product_inventory`)

**Purpose**: Products, stock, materials

**Tables**:
- `d_product` - Products/SKUs
- `f_inventory` - Inventory transactions
- `d_product_hierarchy` - Product categorization

### 4. Order & Fulfillment (`order_fulfillment`)

**Purpose**: Sales pipelines, purchasing, delivery

**Tables**:
- `fact_quote` - Quotes/estimates
- `f_order` - Orders
- `f_shipment` - Shipments
- `f_invoice` - Invoices

### 5. Financial Management (`financial_management`)

**Purpose**: Cost control, profitability, billing

**Tables**:
- `f_expense` - Expenses
- `f_revenue` - Revenue

### 6. Communication & Interaction (`communication_interaction`)

**Purpose**: Messaging, engagement, interaction logs

**Tables**:
- `d_message_schema` - Message templates
- `f_message_data` - Sent messages
- `f_customer_interaction` - Customer interactions

### 7. Knowledge & Documentation (`knowledge_documentation`)

**Purpose**: Wikis, forms, artifacts, reports

**Tables**:
- `d_wiki` - Wiki pages
- `d_artifact` - File attachments
- `d_form_head` - Forms
- `d_reports` - Reports

### 8. Identity & Access Control (`identity_access_control`)

**Purpose**: RBAC, entity definitions

**Tables**:
- `entity_rbac` - Permissions
- `d_entity` - Entity metadata

### 9. Automation & Workflow (`automation_workflow`)

**Purpose**: DAG workflows, automation engine

**Tables**:
- `d_workflow_automation` - Workflow definitions

### 10. Event & Calendar (`event_calendar`)

**Purpose**: Events, appointments, scheduling

**Tables**:
- `d_event` - Events
- `d_entity_person_calendar` - Person calendars

### 11. Service Delivery (`service_delivery`)

**Purpose**: Service execution, logging

**Tables**:
- `d_task_data` - Task activity logs, case notes

## Example Entity Tables

### d_project

**DDL**: `db/11_project.ddl`

**Purpose**: Project management with budget tracking, timeline, and team assignment

**Key Fields**:
```sql
-- Standard fields
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
code varchar(100) NOT NULL UNIQUE
name varchar(255) NOT NULL
descr text
metadata jsonb DEFAULT '{}'::jsonb

-- Project-specific fields
dl__project_stage varchar(100)  -- workflow stage (planning, execution, completed)
budget_allocated_amt numeric(15,2)
budget_spent_amt numeric(15,2) DEFAULT 0
planned_start_date date
planned_end_date date
actual_start_date date
actual_end_date date
manager_employee_id uuid
sponsor_employee_id uuid
stakeholder_employee_ids uuid[]

-- Temporal fields
from_ts timestamptz DEFAULT now()
to_ts timestamptz
active_flag boolean DEFAULT true
created_ts timestamptz DEFAULT now()
updated_ts timestamptz DEFAULT now()
version integer DEFAULT 1
```

**Relationships** (via `entity_instance_link`):
- **Parents**: `business`, `office`
- **Children**: `task`, `wiki`, `artifact`, `form`, `expense`, `revenue`

### d_task

**DDL**: `db/12_task.ddl`

**Purpose**: Work items with effort tracking, priority, and workflow stages

**Key Fields**:
```sql
-- Standard fields
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
code varchar(100) NOT NULL UNIQUE
name varchar(255) NOT NULL
descr text
metadata jsonb DEFAULT '{}'::jsonb

-- Task-specific fields
dl__task_stage varchar(100)     -- workflow stage (todo, in_progress, done)
dl__task_priority varchar(100)  -- priority level (low, medium, high, critical)
estimated_hours numeric(8,2)
actual_hours numeric(8,2) DEFAULT 0
story_points integer
internal_url varchar(500)
shared_url varchar(500)

-- Temporal fields
from_ts timestamptz DEFAULT now()
to_ts timestamptz
active_flag boolean DEFAULT true
created_ts timestamptz DEFAULT now()
updated_ts timestamptz DEFAULT now()
version integer DEFAULT 1
```

**Relationships** (via `entity_instance_link`):
- **Parents**: `project`, `business`, `office`, `worksite`, `cust`
- **Children**: `form`, `artifact`, `expense`, `revenue`
- **Assignees**: `employee` (relationship_type='assigned_to')

### d_business

**DDL**: `db/07_business.ddl`

**Purpose**: Business units/divisions with headcount and operational status

**Key Fields**:
```sql
-- Standard fields
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
code varchar(100) NOT NULL UNIQUE
name varchar(255) NOT NULL
descr text
metadata jsonb DEFAULT '{}'::jsonb

-- Business-specific fields
office_id uuid  -- reference to d_office (via linkage, not FK)
current_headcount integer
operational_status varchar(50)

-- Temporal fields
from_ts timestamptz DEFAULT now()
to_ts timestamptz
active_flag boolean DEFAULT true
created_ts timestamptz DEFAULT now()
updated_ts timestamptz DEFAULT now()
version integer DEFAULT 1
```

**Relationships** (via `entity_instance_link`):
- **Parents**: `office`
- **Children**: `project`, `expense`, `revenue`

## Settings Tables Pattern

All settings tables follow this structure:

### setting_datalabel_project_stage

**DDL**: `db/03_setting_datalabel.ddl`

```sql
CREATE TABLE app.setting_datalabel_project_stage (
  id serial PRIMARY KEY,
  label varchar(50) NOT NULL UNIQUE,
  display_order int4,
  metadata jsonb DEFAULT '{}'::jsonb,  -- {color_code: 'blue', description: '...'}
  active_flag boolean DEFAULT true,
  from_ts timestamptz DEFAULT now(),
  to_ts timestamptz,
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now()
);

-- Example data
INSERT INTO app.setting_datalabel_project_stage (label, display_order, metadata)
VALUES
  ('Planning', 1, '{"color_code": "blue"}'),
  ('In Progress', 2, '{"color_code": "orange"}'),
  ('On Hold', 3, '{"color_code": "yellow"}'),
  ('Completed', 4, '{"color_code": "green"}'),
  ('Cancelled', 5, '{"color_code": "red"}');
```

**API Endpoint**: `GET /api/v1/entity/project/entity-instance-lookup?field=project_stage`

**Frontend Usage**:
```typescript
// Auto-loads options from settings table
<Select field="dl__project_stage" options={/* from API */} />
```

## Data Curation & Seeding

### Infrastructure Tables

All 4 infrastructure tables are auto-populated from entity tables:

```sql
-- Seed d_entity_instance_registry from all entity tables
INSERT INTO app.d_entity_instance_registry (entity_type, entity_id, entity_name, entity_code)
SELECT 'project', id, name, code FROM app.d_project WHERE active_flag = true;

INSERT INTO app.d_entity_instance_registry (entity_type, entity_id, entity_name, entity_code)
SELECT 'task', id, name, code FROM app.d_task WHERE active_flag = true;
-- ... for all 46+ entity tables

-- Seed entity_instance_link from existing relationships
INSERT INTO app.entity_instance_link (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
SELECT 'business', business_id, 'project', id
FROM app.d_project
WHERE business_id IS NOT NULL;
```

### RBAC Seed Data

**DDL**: `db/49_rbac_seed_data.ddl`

Default permissions for system roles and users.

## Database Import Process

### Using db-import.sh

```bash
# Import all 50+ tables in order
./tools/db-import.sh
```

**Import Order**:
1. Schema creation (`01_schema_create.ddl`)
2. Domain definitions (`02_domain.ddl`)
3. Settings tables (`03_setting_datalabel.ddl`)
4. Infrastructure tables (`02_entity.ddl`, `03_d_entity_instance_registry.ddl`, etc.)
5. Entity tables (`05_employee.ddl` through `48_event_person_calendar.ddl`)
6. RBAC seed data (`49_rbac_seed_data.ddl`)

### After DDL Changes

```bash
# ALWAYS run after modifying .ddl files
./tools/db-import.sh
```

## Anti-Patterns (Avoid)

❌ **Adding Foreign Keys**:
```sql
-- WRONG - No foreign keys allowed
ALTER TABLE d_project
ADD CONSTRAINT fk_business
FOREIGN KEY (business_id) REFERENCES d_business(id);
```
Use `entity_instance_link` instead.

❌ **Hardcoding Relationships in Application Code**:
```typescript
// WRONG - Hardcoded relationships
const children = ['task', 'wiki', 'artifact'];
```
Read from `d_entity.child_entities` instead.

❌ **Skipping db-import.sh After DDL Changes**:
```bash
# WRONG - Manual SQL execution
psql -f db/11_project.ddl

# CORRECT - Use import script
./tools/db-import.sh
```

## Related Documentation

- **DDL Files**: `db/*.ddl` (50+ files)
- **Entity Infrastructure Service**: `/docs/services/ENTITY_INFRASTRUCTURE_SERVICE.md`
- **Tools Documentation**: `/docs/tools.md`
- **API Patterns**: `/docs/api/entity_endpoint_design.md`

## Version History

- **2025-01-17** - Complete documentation rewrite based on actual DDL files
- **Coverage**: 4 infrastructure tables + 46+ entity tables + 20+ settings tables
