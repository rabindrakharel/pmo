# PMO Data Model Reference

> **Database schema, entity relationships, and data standards**
> Single source of truth for all data structures

---

## Data Modeling Design

### Schema: `app`
All tables reside in the `app` PostgreSQL schema.

### Table Prefixes

| Prefix | Type | Purpose | Examples |
|--------|------|---------|----------|
| `d_` | Dimension | Core business entities | `d_project`, `d_task`, `d_employee`, `d_office` |
| `f_` | Fact | Transactional data with metrics | `f_order`, `f_invoice`, `f_shipment`, `f_inventory` |
| `setting_datalabel_*` | Settings | Configuration tables for dropdowns | `setting_datalabel` (unified) |
| `rel_` | Relationship | Many-to-many mappings | `rel_emp_role`, `rel_proj_emp` |
| *None* | Infrastructure | System tables | `entity_id_map`, `entity_id_rbac_map` |

### Relationship Capture Strategy

**NO FOREIGN KEYS** - Relationships managed through linker tables:

```sql
-- entity_id_map: Links any entity to any entity
CREATE TABLE app.entity_id_map (
    entity_type VARCHAR(50),      -- e.g., 'project', 'task'
    entity_id UUID,                -- Entity UUID
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    relationship_type VARCHAR(50)  -- e.g., 'parent', 'child', 'depends_on'
);

-- Example: Project has tasks
INSERT INTO entity_id_map VALUES
('project', 'proj-uuid-1', 'task', 'task-uuid-1', 'child'),
('task', 'task-uuid-1', 'project', 'proj-uuid-1', 'parent');
```

---

## Data Standards

### Naming Conventions (MANDATORY)

| Data Type | Pattern | Example | Rendering |
|-----------|---------|---------|-----------|
| **Datalabel** | `dl__entity_attribute` | `dl__project_stage`, `dl__task_priority` | Colored badge from settings |
| **Boolean** | `*_flag` | `active_flag`, `system_role_flag` | ✓ or ✗ (centered) |
| **Money** | `*_amt` | `budget_allocated_amt`, `unit_price_amt` | `$250,000.00 CAD` |
| **Quantity** | `*_qty` | `on_hand_qty`, `reorder_qty` | `1,234` (right-aligned) |
| **Percentage** | `*_pct` | `bonus_target_pct`, `tax_rate_pct` | `25.5%` |
| **Date** | `*_date` | `hire_date`, `due_date` | `Mar 15, 2025` |
| **Timestamp** | `*_ts` | `created_ts`, `updated_ts` | `3 minutes ago` |
| **JSON** | `metadata`, `*_json` | `metadata`, `config_json` | Formatted JSON |

**Critical:** Column names auto-detected by frontend - NO manual configuration needed.

### Standard Entity Table Structure

```sql
CREATE TABLE app.d_entity_name (
    -- Identity
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Core identification
    code varchar(100),                    -- Business code (PROJ-2024-001)
    name text NOT NULL,                   -- Display name
    descr text,                           -- Description

    -- Metadata
    metadata jsonb DEFAULT '{}'::jsonb,   -- Extensible attributes

    -- Temporal (SCD Type 2)
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,                    -- NULL = current version
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),

    -- State
    active_flag boolean DEFAULT true,
    version int DEFAULT 1,

    -- Entity-specific columns...
);
```

### Datalabel Standards

**Database Column Format:** `dl__entity_attribute`
**Settings Table Format:** `dl__entity_attribute` (SAME as database column - perfect 1:1 alignment)

```sql
-- Entity table
CREATE TABLE app.d_project (
    dl__project_stage text  -- Column name
);

-- Settings table (MUST match database column exactly)
INSERT INTO app.setting_datalabel (datalabel_name, ui_label, icon, metadata) VALUES
('dl__project_stage', 'Project Stages', 'GitBranch', '[
  {"id": 0, "name": "Initiation", "color_code": "blue"},
  {"id": 1, "name": "Planning", "color_code": "purple"},
  {"id": 2, "name": "Execution", "color_code": "yellow"}
]'::jsonb);

-- API endpoint
GET /api/v1/setting?category=dl__project__stage

-- Response
{
  "datalabel": "dl__project__stage",  -- Matches database column exactly
  "data": [...]
}
```

---

## Entity List (39 DDL Files)

### Core Dimensions (13)

| Entity | Table | DDL File | Purpose |
|--------|-------|----------|---------|
| Business | `d_business` | `13_d_business.ddl` | Business units, divisions |
| Office | `d_office` | `12_d_office.ddl` | Physical locations |
| Employee | `d_employee` | `11_d_employee.ddl` | Personnel, contractors |
| Customer | `d_cust` | `14_d_cust.ddl` | Clients, prospects |
| Role | `d_role` | `15_d_role.ddl` | Job functions |
| Position | `d_position` | `16_d_position.ddl` | Org hierarchy levels |
| Worksite | `d_worksite` | `17_d_worksite.ddl` | Project locations |
| Project | `d_project` | `18_d_project.ddl` | Client engagements |
| Task | `d_task` | `19_d_task.ddl` | Work items |
| Artifact | `d_artifact` | `20_d_artifact.ddl` | File attachments |
| Form | `d_form_head` | `22_d_form_head.ddl` | Dynamic forms |
| Wiki | `d_wiki` | `24_d_wiki.ddl` | Documentation |
| Reports | `d_reports` | `26_d_reports.ddl` | Report definitions |

### Product/Operations Dimensions (5)

| Entity | Table | DDL File | Purpose |
|--------|-------|----------|---------|
| Product | `d_product` | `28_d_product.ddl` | Product catalog |
| Supplier | `d_supplier` | `30_d_supplier.ddl` | Vendors, suppliers |
| Warehouse | `d_warehouse` | `32_d_warehouse.ddl` | Inventory locations |
| Carrier | `d_carrier` | `34_d_carrier.ddl` | Shipping carriers |
| *Cost* | ~~`d_cost`~~ | ❌ `36_d_cost.ddl` | **Should be `f_cost`** |
| *Revenue* | ~~`d_revenue`~~ | ❌ `37_d_revenue.ddl` | **Should be `f_revenue`** |

### Fact Tables (6)

| Entity | Table | DDL File | Purpose |
|--------|-------|----------|---------|
| Inventory | `f_inventory`, `fact_inventory` | `33_f_inventory.ddl` | Stock levels |
| Order | `f_order`, `fact_order` | `29_f_order.ddl` | Customer orders |
| Invoice | `f_invoice`, `fact_invoice` | `f_invoice.ddl` | Billing transactions |
| Shipment | `f_shipment`, `fact_shipment` | `35_f_shipment.ddl` | Delivery tracking |

### Settings Tables (1 Unified)

| Table | DDL File | Purpose |
|-------|----------|---------|
| `setting_datalabel` | `setting_datalabel.ddl` | Unified settings for all datalabel columns |

**16 Datalabel Categories:**
- `dl__project_stage`, `dl__task_stage`, `dl__task_priority`, `dl__task_update_type`
- `dl__opportunity_funnel_stage`, `dl__industry_sector`, `dl__acquisition_channel`, `dl__customer_tier`
- `dl__client_status`, `dl__client_service`
- `dl__business_level`, `dl__office_level`, `dl__position_level`
- `dl__form_submission_status`, `dl__form_approval_status`
- `dl__wiki_publication_status`

### Infrastructure Tables (8)

| Table | DDL File | Purpose |
|-------|----------|---------|
| `entity_id_map` | `01_entity_id_map.ddl` | Universal relationship linker |
| `entity_id_rbac_map` | `02_entity_id_rbac_map.ddl` | Row-level permissions |
| `rel_emp_role` | `rel_emp_role.ddl` | Employee-Role mapping |
| `rel_proj_emp` | `rel_proj_emp.ddl` | Project-Employee assignments |
| `rel_task_emp` | `rel_task_emp.ddl` | Task-Employee assignments |
| `rel_emp_office` | `rel_emp_office.ddl` | Employee-Office mapping |
| `rel_cust_emp` | `rel_cust_emp.ddl` | Customer-Employee (account mgmt) |
| `rel_proj_task` | `rel_proj_task.ddl` | Project-Task hierarchy |

---

## Relationship Patterns

### Parent-Child Hierarchies

```sql
-- Office hierarchy (self-referencing)
CREATE TABLE app.d_office (
    id uuid PRIMARY KEY,
    name text,
    parent_id uuid,  -- Points to parent office
    dl__office_level text  -- 'Corporate', 'Region', 'District', 'Office'
);

-- Captured in entity_id_map
INSERT INTO entity_id_map VALUES
('office', 'region-uuid', 'office', 'corporate-uuid', 'parent'),
('office', 'district-uuid', 'office', 'region-uuid', 'parent');
```

### Many-to-Many Relationships

```sql
-- Employee assigned to multiple roles
CREATE TABLE app.rel_emp_role (
    employee_id uuid,
    role_id uuid,
    from_ts timestamptz,
    to_ts timestamptz,
    PRIMARY KEY (employee_id, role_id, from_ts)
);

-- Project assigned to multiple employees
CREATE TABLE app.rel_proj_emp (
    project_id uuid,
    employee_id uuid,
    assignment_type varchar(50),  -- 'owner', 'contributor', 'viewer'
    from_ts timestamptz,
    to_ts timestamptz
);
```

### Permission Relationships (RBAC)

```sql
-- entity_id_rbac_map: Row-level permissions
CREATE TABLE app.entity_id_rbac_map (
    entity_type VARCHAR(50),
    entity_id VARCHAR(255),  -- UUID or 'all' for type-wide
    employee_id UUID,
    permissions INTEGER[],   -- [0:view, 1:edit, 2:share, 3:delete, 4:create]
    from_ts TIMESTAMPTZ,
    to_ts TIMESTAMPTZ
);

-- Example: James has full access to all projects
INSERT INTO entity_id_rbac_map VALUES
('project', 'all', 'james-uuid', ARRAY[0,1,2,3,4], now(), NULL);

-- Example: John can only view specific project
INSERT INTO entity_id_rbac_map VALUES
('project', 'proj-uuid-1', 'john-uuid', ARRAY[0], now(), NULL);
```

---

## Entity Metadata (JSONB)

All entities have a `metadata` JSONB column for flexible attributes:

```sql
-- Project metadata examples
{
  "project_type": "construction",
  "budget_notes": "Contingency fund approved",
  "custom_field_1": "value",
  "tags": ["urgent", "high-priority"],
  "parent_project_id": "uuid"
}

-- Task metadata examples
{
  "task_type": "evaluation",
  "deliverable": "vendor_comparison_matrix",
  "ceo_approval": true,
  "story_points": 13
}

-- Employee metadata examples
{
  "emergency_contact": {...},
  "certifications": ["PMP", "LEED"],
  "skills": ["project_management", "construction"]
}
```

---

## Temporal Patterns (SCD Type 2)

All dimension tables support temporal tracking:

```sql
-- Track historical changes
UPDATE app.d_employee
SET to_ts = now()
WHERE id = 'emp-uuid' AND to_ts IS NULL;

INSERT INTO app.d_employee (id, name, dl__position_level, from_ts, version)
VALUES ('emp-uuid', 'John Doe', 'Senior Manager', now(), 2);

-- Query current version
SELECT * FROM d_employee WHERE to_ts IS NULL;

-- Query version at specific time
SELECT * FROM d_employee
WHERE from_ts <= '2024-06-01' AND (to_ts IS NULL OR to_ts > '2024-06-01');
```

---

## Data Flow

```
┌──────────────────────────────────────────────────────────┐
│ DATABASE (PostgreSQL)                                    │
│  • Entity Column: dl__project_stage TEXT                 │
│  • Settings: datalabel_name = 'dl__project_stage'        │
│  • Perfect 1:1 alignment (no transformation needed)      │
│  • Relationships: entity_id_map, rel_* tables            │
└──────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│ API (Fastify)                                            │
│  • GET /api/v1/project → {dl__project_stage: "Planning"} │
│  • GET /api/v1/setting?category=dl__project_stage        │
│  • Direct lookup: WHERE datalabel_name = 'dl__project_stage' │
└──────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│ FRONTEND (React)                                         │
│  • Auto-detects column types from names                  │
│  • Loads settings for dl__* columns                      │
│  • Renders: colored badges, currency, dates, booleans    │
└──────────────────────────────────────────────────────────┘
```

---

## Critical Rules

### ✅ DO

```sql
-- Use dl__ prefix for datalabel columns
CREATE TABLE app.d_project (
  dl__project_stage text  -- ✅ Correct
);

-- Settings table MUST match database column exactly (with dl__ prefix)
INSERT INTO app.setting_datalabel (datalabel_name, ui_label, icon, metadata) VALUES
('dl__project_stage', 'Project Stages', 'GitBranch', '[
  {"id": 0, "name": "Planning", "color_code": "purple"}
]'::jsonb);  -- ✅ Correct: dl__entity_attribute (matches column name)

-- Use snake_case for all names
CREATE TABLE app.d_project (
  budget_allocated_amt numeric,  -- ✅ Correct
  hire_date date                 -- ✅ Correct
);
```

### ❌ DON'T

```sql
-- ❌ Missing dl__ prefix in entity table
CREATE TABLE app.d_project (
  project_stage text  -- ❌ Should be dl__project_stage
);

-- ❌ Wrong format in settings table
INSERT INTO app.setting_datalabel (datalabel_name) VALUES
('project_stage');  -- ❌ Missing dl__ prefix - should be dl__project_stage

INSERT INTO app.setting_datalabel (datalabel_name) VALUES
('project__stage');  -- ❌ Wrong: project__stage should be dl__project_stage

-- ❌ Don't use is_* for booleans
CREATE TABLE app.d_employee (
  is_active boolean  -- ❌ Should be active_flag
);

-- ❌ Don't use foreign keys
CREATE TABLE app.d_task (
  project_id uuid REFERENCES d_project(id)  -- ❌ Use entity_id_map instead
);
```

---

## Key Files

| File Pattern | Count | Purpose |
|-------------|-------|---------|
| `db/1*_d_*.ddl` | 13 | Core dimension entities |
| `db/2*_d_*.ddl` | 5 | Product/operations dimensions |
| `db/*_f_*.ddl` | 6 | Fact tables |
| `db/fact_*.ddl` | 3 | Additional fact tables |
| `db/rel_*.ddl` | 8 | Relationship linkers |
| `db/setting_datalabel.ddl` | 1 | Unified settings table |
| `db/0*_entity_*.ddl` | 2 | Infrastructure tables |

**Total:** 39 DDL files

---

## Summary

**Data Modeling Principles:**
1. **No Foreign Keys** - Use `entity_id_map` and `rel_*` tables
2. **Column Names = Configuration** - Frontend auto-detects from naming patterns
3. **Unified Settings** - Single `setting_datalabel` table for all dropdowns
4. **Temporal Support** - SCD Type 2 with `from_ts`/`to_ts`
5. **Flexible Metadata** - JSONB column for extensible attributes
6. **RBAC at Row Level** - `entity_id_rbac_map` controls access

**Naming Standards:**
- `dl__entity_attribute` → Datalabel columns AND settings table names (perfect 1:1 alignment)
- `*_amt` → Money (currency formatted)
- `*_flag` → Booleans (✓ or ✗)
- `*_ts` → Timestamps (relative time)
- `*_date` → Dates (friendly format)

**Last Updated:** 2025-10-30
**Schema:** `app`
**Total Tables:** 39
**Status:** Production Ready
