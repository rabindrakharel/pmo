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

| Pattern | Purpose | Examples |
|---------|---------|----------|
| `app.{entity}` | **Business entity tables** | `app.project`, `app.task`, `app.employee`, `app.business` |
| `app.{entity}_hierarchy` | **Hierarchy tables** | `app.office_hierarchy`, `app.business_hierarchy`, `app.product_hierarchy` |
| `app.{entity}_head` / `{entity}_data` | **Head/data tables** | `app.invoice_head`, `app.invoice_data`, `app.form_head`, `app.form_data` |
| `app.setting_datalabel` | **Settings/dropdowns** | `app.setting_datalabel` (single table with type field) |
| `app.entity*` | **Infrastructure tables** | `app.entity`, `app.entity_instance`, `app.entity_instance_link`, `app.entity_rbac` |
| `app.d_domain` | **Domain metadata** | `app.d_domain` (one of few tables with `d_` prefix) |

## 4 Infrastructure Tables (Zero-Config System)

### 1. entity - Entity TYPE Metadata

**Purpose**: Single source of truth for entity TYPE definitions

**Key Fields**:
- `code` (PK) - Entity type identifier (`project`, `task`, `business`)
- `name` - Entity name (`Project`, `Task`, `Business`)
- `ui_label` - Plural label for UI (`Projects`, `Tasks`, `Businesses`)
- `ui_icon` - Lucide icon name (`FolderOpen`, `CheckSquare`, `Building2`)
- `child_entity_codes` (JSONB array) - Array of child entity type codes (`["task", "wiki", "artifact"]`)
- `db_table` - Physical table name without schema prefix (`project`, `task`, `expense`)
- `db_model_type` - Data model classification: `d`=dimension, `dh`=dimension hierarchy, `f`=fact, `fh`=fact head, `fd`=fact data
- `column_metadata` (JSONB) - Column definitions from information_schema
- `domain_id`, `domain_code`, `domain_name` - Domain categorization

**DDL**: `db/entity_configuration_settings/02_entity.ddl`

**Key Operations**:
```sql
-- Get entity type metadata
SELECT * FROM app.entity WHERE code = 'project';

-- Get all active entity types
SELECT * FROM app.entity WHERE active_flag = true ORDER BY display_order;

-- Get child entity codes
SELECT child_entity_codes FROM app.entity WHERE code = 'project';
-- Returns: ["task", "wiki", "artifact", "form", "expense", "revenue"]
```

**Example Records**:
```sql
-- Project entity type
code: 'project'
name: 'Project'
ui_label: 'Projects'
ui_icon: 'FolderOpen'
child_entity_codes: ["task", "wiki", "artifact", "form", "expense", "revenue"]
db_table: 'project'
db_model_type: 'f'

-- Task entity type
code: 'task'
name: 'Task'
ui_label: 'Tasks'
ui_icon: 'CheckSquare'
child_entity_codes: ["form", "artifact", "expense", "revenue", "employee"]
db_table: 'task'
db_model_type: 'f'
```

### 2. entity_instance - Entity INSTANCE Registry

**Purpose**: Central registry of all entity instances with IDs and metadata

**Key Fields**:
- `entity_type` - Entity type code (`project`, `task`, `employee`)
- `entity_id` - UUID of specific instance
- `entity_name` - Cached name for search/display
- `entity_code` - Cached business code for search/display (e.g., `PROJ-001`, `EMP-123`)
- `order_id` - Auto-incrementing display order

**DDL**: `db/entity_configuration_settings/03_entity_instance.ddl`

**Key Operations**:
```sql
-- Register instance
INSERT INTO app.entity_instance
(entity_type, entity_id, entity_name, entity_code)
VALUES ('project', '...uuid...', 'Kitchen Renovation', 'PROJ-001');

-- Global search across all entities
SELECT * FROM app.entity_instance
WHERE entity_name ILIKE '%kitchen%';

-- Count entities by type
SELECT entity_type, COUNT(*) as count
FROM app.entity_instance
GROUP BY entity_type;
```

### 3. entity_instance_link - Parent-Child Relationships

**Purpose**: Polymorphic linkage table connecting any entity to any other

**Key Fields**:
- `id` (PK) - Linkage UUID
- `parent_entity_type`, `parent_entity_id` - Parent entity (e.g., `'project'`, uuid)
- `child_entity_type`, `child_entity_id` - Child entity (e.g., `'task'`, uuid)
- `relationship_type` - Relationship label (`contains`, `assigned_to`, `relates_to`)
- **NO active_flag** - Hard deletes only (DELETE removes row completely)

**DDL**: `db/entity_configuration_settings/05_entity_instance_link.ddl`

**Why No Foreign Keys**:
- ✅ Flexible cross-entity linking without constraints
- ✅ Polymorphic relationships (any entity → any entity)
- ✅ No cascading deletes - explicit relationship management
- ✅ Performance - no FK validation on inserts
- ✅ Idempotent linkage via UNIQUE constraint on (parent_type, parent_id, child_type, child_id)

**Key Operations**:
```sql
-- Create linkage (idempotent via UNIQUE constraint)
INSERT INTO app.entity_instance_link
(parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
VALUES ('business', '...uuid...', 'project', '...uuid...', 'contains')
ON CONFLICT (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
DO NOTHING;

-- Get children of specific type
SELECT child_entity_id
FROM app.entity_instance_link
WHERE parent_entity_type = 'project'
  AND parent_entity_id = '...uuid...';
  AND child_entity_type = 'task';

-- Count children for tab badges
SELECT child_entity_type, COUNT(*) as count
FROM app.entity_instance_link
WHERE parent_entity_type = 'project'
  AND parent_entity_id = '...uuid...'
GROUP BY child_entity_type;

-- Delete linkage (hard delete)
DELETE FROM app.entity_instance_link
WHERE parent_entity_type = 'project'
  AND parent_entity_id = '...uuid...'
  AND child_entity_type = 'task'
  AND child_entity_id = '...taskId...';
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
- `app.cust` - Customers/clients
- `app.business` - Business units/divisions
- `app.employee` - Employees
- `app.role` - User roles
- `app.office` - Physical locations
- `app.worksite` - Work sites

### 2. Operations (`operations`)

**Purpose**: Internal operational execution

**Tables**:
- `app.project` - Projects
- `app.task` - Tasks/work items
- `app.work_order` - Work orders
- `app.service` - Services offered

### 3. Product & Inventory (`product_inventory`)

**Purpose**: Products, stock, materials

**Tables**:
- `app.product` - Products/SKUs
- `app.inventory` - Inventory transactions
- `app.product_hierarchy` - Product categorization

### 4. Order & Fulfillment (`order_fulfillment`)

**Purpose**: Sales pipelines, purchasing, delivery

**Tables**:
- `app.quote` - Quotes/estimates
- `app.order` - Orders
- `app.shipment` - Shipments
- `app.invoice_head` - Invoices (head table)
- `app.invoice_data` - Invoice line items (data table)

### 5. Financial Management (`financial_management`)

**Purpose**: Cost control, profitability, billing

**Tables**:
- `app.expense` - Expenses
- `app.revenue` - Revenue

### 6. Communication & Interaction (`communication_interaction`)

**Purpose**: Messaging, engagement, interaction logs

**Tables**:
- `app.message_schema` - Message templates
- `app.message_data` - Sent messages
- `app.interaction` - Customer interactions

### 7. Knowledge & Documentation (`knowledge_documentation`)

**Purpose**: Wikis, forms, artifacts, reports

**Tables**:
- `app.wiki_head` - Wiki pages (head table)
- `app.wiki_data` - Wiki content (data table)
- `app.artifact` - File attachments
- `app.form_head` - Forms (head table)
- `app.form_data` - Form submissions (data table)

### 8. Identity & Access Control (`identity_access_control`)

**Purpose**: RBAC, entity definitions

**Tables**:
- `app.entity_rbac` - Permissions
- `app.entity` - Entity metadata
- `app.entity_instance` - Entity instance registry
- `app.entity_instance_link` - Entity relationships

### 9. Automation & Workflow (`automation_workflow`)

**Purpose**: DAG workflows, automation engine

**Tables**:
- `app.industry_workflow_graph_head` - Workflow definitions (head table)
- `app.industry_workflow_graph_data` - Workflow nodes/edges (data table)
- `app.industry_workflow_events` - Workflow execution events

### 10. Event & Calendar (`event_calendar`)

**Purpose**: Events, appointments, scheduling

**Tables**:
- `app.event` - Events
- `app.person_calendar` - Person calendars
- `app.entity_event_person_calendar` - Event-calendar link table
- `app.event_organizer_link` - Event organizer relationships

### 11. Service Delivery (`service_delivery`)

**Purpose**: Service execution, logging

**Tables**:
- `app.task_data` - Task activity logs, case notes
- `app.person` - Person records (base table)
- `app.attachment` - File attachments
- `app.logging` - System audit logs

## Example Entity Tables

### app.project

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

### app.task

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
- **Children**: `form`, `artifact`, `expense`, `revenue`, `employee` (assignees)
- **Assignees**: `employee` (relationship_type='assigned_to')

### app.business

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
office_id uuid  -- reference to app.office (via linkage, not FK)
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

**API Endpoint**: `GET /api/v1/entity/project/options?field=project_stage`

**Frontend Usage**:
```typescript
// Auto-loads options from settings table
<Select field="dl__project_stage" options={/* from API */} />
```

## Data Curation & Seeding

### Infrastructure Tables

All 4 infrastructure tables are auto-populated from entity tables:

```sql
-- Seed entity_instance from all entity tables
INSERT INTO app.entity_instance (entity_type, entity_id, entity_name, entity_code)
SELECT 'project', id, name, code FROM app.project WHERE active_flag = true;

INSERT INTO app.entity_instance (entity_type, entity_id, entity_name, entity_code)
SELECT 'task', id, name, code FROM app.task WHERE active_flag = true;
-- ... for all 46+ entity tables

-- Seed entity_instance_link from existing relationships
INSERT INTO app.entity_instance_link (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
SELECT 'business', business_id, 'project', id
FROM app.project
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
1. Schema creation (`db/01_schema_create.ddl`)
2. Settings tables (`db/03_setting_datalabel.ddl`)
3. Supporting tables (`db/04a_person.ddl`, `db/04b_attachment.ddl`, `db/04_logging.ddl`)
4. Infrastructure tables (`db/entity_configuration_settings/02_domain.ddl`, `02_entity.ddl`, `03_entity_instance.ddl`, `05_entity_instance_link.ddl`, `06_entity_rbac.ddl`)
5. Entity tables (`db/05_employee.ddl` through `db/48_event_person_calendar.ddl`)
6. RBAC seed data (`db/49_rbac_seed_data.ddl`)

### After DDL Changes

```bash
# ALWAYS run after modifying .ddl files
./tools/db-import.sh
```

## Anti-Patterns (Avoid)

❌ **Adding Foreign Keys**:
```sql
-- WRONG - No foreign keys allowed
ALTER TABLE app.project
ADD CONSTRAINT fk_business
FOREIGN KEY (business_id) REFERENCES app.business(id);
```
Use `entity_instance_link` instead.

❌ **Hardcoding Relationships in Application Code**:
```typescript
// WRONG - Hardcoded relationships
const children = ['task', 'wiki', 'artifact'];
```
Read from `app.entity.child_entity_codes` instead.

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
