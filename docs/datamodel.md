# PMO Data Model - Complete Reference

**Version:** 3.0
**Last Updated:** 2025-10-30
**Status:** Production

---

## Table of Contents

1. [Semantics & Business Context](#1-semantics--business-context)
2. [Architecture & DRY Design Patterns](#2-architecture--dry-design-patterns)
3. [Database, API & UI/UX Mapping](#3-database-api--uiux-mapping)
4. [Entity Relationships](#4-entity-relationships)
5. [Central Configuration & Middleware](#5-central-configuration--middleware)
6. [User Interaction Flow Examples](#6-user-interaction-flow-examples)
7. [Critical Considerations When Building](#7-critical-considerations-when-building)

---

## 1. Semantics & Business Context

### 1.1 Purpose

The PMO database is designed for **Huron Home Services**, a Canadian home services company managing:
- Construction projects and task workflows
- Employee assignments and role-based access control
- Customer relationships and opportunity funnels
- Office hierarchies and business units
- Work sites, forms, wiki documentation, and file attachments

### 1.2 Core Business Concepts

| Concept | Business Purpose | Database Representation |
|---------|------------------|------------------------|
| **Projects** | Client engagements, construction jobs | `d_project` (dimension) |
| **Tasks** | Work items, deliverables, action items | `d_task` (dimension) |
| **Employees** | Personnel, contractors, consultants | `d_employee` (dimension) |
| **Customers** | Clients, prospects in sales funnel | `d_cust` (dimension) |
| **Offices** | Physical locations, service areas | `d_office` (dimension, hierarchical) |
| **Roles** | Job functions, responsibilities | `d_role` (dimension) |
| **Positions** | Organizational hierarchy levels | `d_position` (dimension, hierarchical) |
| **Inventory** | Stock levels, warehouse tracking | `f_inventory` (fact table) |
| **Orders** | Customer purchase transactions | `f_order`, `fact_order` (fact tables) |
| **Invoices** | Billing, revenue recognition | `f_invoice`, `fact_invoice` (fact tables) |

### 1.3 Dimensional Modeling Principles

**Dimensions (d_*)** - Descriptive context entities:
- **WHO**: Employee, Customer, Role, Position
- **WHAT**: Product, Artifact, Form, Wiki
- **WHERE**: Office, Business, Worksite
- **WHEN**: Date dimension (via temporal columns)

**Facts (f_*)** - Transactional measurements:
- **HOW MUCH**: Order amounts, invoice totals, inventory quantities
- **HOW MANY**: Order line items, task counts, shipment volumes
- Characteristics: Rapidly growing, contain metrics, reference multiple dimensions

**❌ Incorrectly Classified Removed:**
- `36_d_cost.ddl` - Cost is transactional data (should be `f_cost` fact table)
- `37_d_revenue.ddl` - Revenue is transactional data (should be `f_revenue` fact table)

---

## 2. Architecture & DRY Design Patterns

### 2.1 Naming Convention Standards

**⚠️ CRITICAL RULES (Enforced Across Entire Stack):**

| Data Type | Pattern | Example | Why |
|-----------|---------|---------|-----|
| **Boolean** | `*_flag` | `active_flag`, `system_role_flag` | ✅ Auto-detected by frontend, NO `is_*` allowed |
| **Datalabel** | `dl__*` + semantic suffix | `dl__project_stage`, `dl__customer_tier` | ✅ Auto-loads from settings API, colored badge rendering |
| **Money** | `*_amt` | `budget_allocated_amt`, `unit_price_amt` | ✅ Currency formatting ($250,000.00 CAD) |
| **Quantity** | `*_qty` | `on_hand_qty`, `reorder_qty` | ✅ Right-aligned number formatting |
| **Percentage** | `*_pct` | `bonus_target_pct`, `tax_rate_pct` | ✅ Percentage formatting (25.5%) |
| **Date** | `*_date` | `hire_date`, `due_date` | ✅ Friendly date (Mar 15, 2025) |
| **Timestamp** | `*_ts` | `created_ts`, `updated_ts` | ✅ Relative time (3 mins ago) |

**Semantic Suffix Requirements for Datalabels:**

Datalabel columns MUST end with one of these semantic suffixes:

| Suffix | Purpose | Examples |
|--------|---------|----------|
| `_stage` | Workflow stages | `dl__project_stage`, `dl__task_stage` |
| `_status` | Status values | `dl__wiki_publication_status`, `dl__form_approval_status` |
| `_level` | Hierarchy levels | `dl__office_level`, `dl__position_level`, `dl__business_level` |
| `_tier` | Service/classification tiers | `dl__customer_tier` |
| `_priority` | Priority levels | `dl__task_priority` |
| `_sector` | Industry/business sectors | `dl__industry_sector` |
| `_channel` | Acquisition/communication channels | `dl__acquisition_channel` |
| `_label` | Generic labels | `dl__generic_label` (use as fallback) |

**Anti-Patterns (DO NOT USE):**

| ❌ Wrong | ✅ Correct | Reason |
|---------|-----------|--------|
| `is_active`, `is_management` | `active_flag`, `management_flag` | NO `is_*` pattern allowed |
| `project_stage` (if datalabel) | `dl__project_stage` | Missing `dl__` prefix and semantic suffix |
| `dl__project`, `dl__customer` | `dl__project_stage`, `dl__customer_tier` | Missing semantic suffix |
| `quantity`, `on_hand_quantity` | `on_hand_qty` | Must use `_qty` suffix |

### 2.2 Standard Column Pattern (All Entity Tables)

```sql
CREATE TABLE app.d_entity_name (
  -- Identity
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Standard identification (always first)
  code varchar(100),                        -- Business code (PROJ-2024-001)
  name text NOT NULL,                       -- Primary display name
  descr text,                               -- Description

  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,       -- Extensible attributes

  -- Temporal tracking (SCD Type 2)
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,                        -- NULL = current version
  created_ts timestamptz NOT NULL DEFAULT now(),
  updated_ts timestamptz NOT NULL DEFAULT now(),

  -- State management
  active_flag boolean NOT NULL DEFAULT true,
  version int DEFAULT 1,

  -- Entity-specific columns follow...
);
```

**Removed Standard Columns:**
- `slug varchar(255)` - Removed for simplification
- `tags jsonb` - Removed for simplification

### 2.3 DRY Principle: Column Names = Configuration

The database column name **IS** the configuration:

```
Column Name              Auto-Detected As       Rendered In Frontend As
───────────────────────  ─────────────────────  ──────────────────────────
dl__project_stage     →  LABEL category      →  [Execution] (purple badge)
budget_allocated_amt  →  AMOUNT category     →  $250,000.00 CAD
active_flag           →  BOOLEAN category    →  ✓ (center-aligned)
created_ts            →  TIMESTAMP category  →  "3 minutes ago"
```

**Zero manual configuration needed.** Frontend `fieldCategoryRegistry.ts` scans column names and applies rendering automatically.

---

## 3. Database, API & UI/UX Mapping

### 3.1 Three-Layer Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ DATABASE LAYER (PostgreSQL)                                     │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ CREATE TABLE app.d_project (                                │ │
│ │   id uuid PRIMARY KEY,                                      │ │
│ │   name text NOT NULL,                                       │ │
│ │   dl__project_stage text,                                   │ │
│ │   budget_allocated_amt numeric(15,2),                       │ │
│ │   active_flag boolean,                                      │ │
│ │   created_ts timestamptz                                    │ │
│ │ );                                                          │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            ↓ 1:1 Mapping
┌─────────────────────────────────────────────────────────────────┐
│ API LAYER (Fastify + TypeScript)                                │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ GET /api/v1/project/{id}                                    │ │
│ │ Response:                                                   │ │
│ │ {                                                           │ │
│ │   "id": "uuid",                                             │ │
│ │   "name": "PMO Implementation",                             │ │
│ │   "dl__project_stage": "Execution",                         │ │
│ │   "budget_allocated_amt": 250000.00,                        │ │
│ │   "active_flag": true,                                      │ │
│ │   "created_ts": "2025-01-15T10:30:00Z"                      │ │
│ │ }                                                           │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            ↓ Auto-Detection
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND LAYER (React + TypeScript)                             │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ fieldCategoryRegistry.ts detects:                           │ │
│ │ - "dl__project_stage" → LABEL → Colored badge + dropdown   │ │
│ │ - "budget_allocated_amt" → AMOUNT → $250,000.00 CAD        │ │
│ │ - "active_flag" → BOOLEAN → ✓                              │ │
│ │ - "created_ts" → TIMESTAMP → "3 minutes ago"               │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Datalabel System Integration

**Settings Table:**
```sql
CREATE TABLE app.setting_datalabel_project_stage (
  level_id integer PRIMARY KEY,
  name varchar(50) NOT NULL UNIQUE,  -- "Initiation", "Planning", "Execution"
  descr text,
  sort_order integer,
  ui_color varchar(7),  -- "#9333ea" (purple)
  is_active boolean DEFAULT true
);
```

**API Endpoint:**
```bash
GET /api/v1/setting?category=project_stage
Response:
[
  { "id": "1", "name": "Initiation", "color": "#3b82f6", "sortOrder": 1 },
  { "id": "2", "name": "Planning", "color": "#f59e0b", "sortOrder": 2 },
  { "id": "3", "name": "Execution", "color": "#9333ea", "sortOrder": 3 },
  { "id": "4", "name": "Closure", "color": "#10b981", "sortOrder": 4 }
]
```

**Frontend Auto-Detection:**
```typescript
// entityConfig.ts
columns: generateStandardColumns([
  'name',
  'dl__project_stage',  // ← Auto-detects LABEL category
  'budget_allocated_amt',
  'active_flag'
])

// fieldCategoryRegistry.ts auto-applies:
// - Colored badge rendering
// - Dropdown loaded from /api/v1/setting?category=project_stage
// - Inline editing with stage transitions
```

**Rendered UI:**
```
┌─────────────────┬──────────────┬────────────────┬────────┐
│ Name            │ Stage        │ Budget         │ Active │
├─────────────────┼──────────────┼────────────────┼────────┤
│ PMO Impl.       │ [Execution]  │ $250,000.00    │   ✓    │
│                 │  (purple)    │    (right)     │ (cntr) │
└─────────────────┴──────────────┴────────────────┴────────┘
```

---

## 4. Entity Relationships

### 4.1 Entity Classification

| Entity Type | Table Count | Examples | Purpose |
|-------------|-------------|----------|---------|
| **Core Dimensions** | 13 | `d_project`, `d_task`, `d_employee`, `d_cust` | Primary business entities |
| **Fact Tables** | 8 | `f_inventory`, `f_order`, `fact_invoice` | Transactional measurements |
| **Settings/Datalabels** | 16 | `setting_datalabel_project_stage` | Dropdown options, workflow states |
| **Relationship Tables** | 3 | `rel_emp_role`, `entity_id_map` | Many-to-many mappings |
| **Support Tables** | 12 | `entity_id_rbac_map`, `d_workflow_automation` | RBAC, automation, metadata |
| **TOTAL DDL Files** | 46 | (was 48 before cost/revenue removal) | Complete schema |

### 4.2 Core Dimension Entities (13)

| Entity | Table Name | Hierarchical? | Key Datalabels | Boolean Flags |
|--------|------------|---------------|----------------|---------------|
| **Project** | `d_project` | No | `dl__project_stage` | None |
| **Task** | `d_task` | No | `dl__task_stage`, `dl__task_priority` | None |
| **Office** | `d_office` | ✅ Yes (parent_id) | `dl__office_level` | None |
| **Business** | `d_business` | ✅ Yes (parent_id) | `dl__business_level` | None |
| **Employee** | `d_employee` | No | None | None |
| **Customer** | `d_cust` | No | `dl__customer_tier`, `dl__opportunity_funnel_stage`, `dl__industry_sector`, `dl__acquisition_channel` | None |
| **Role** | `d_role` | No | None | `system_role_flag`, `management_role_flag`, `client_facing_flag`, `safety_critical_flag`, `background_check_required_flag`, `bonding_required_flag`, `licensing_required_flag` |
| **Position** | `d_position` | ✅ Yes (parent_id) | `dl__position_level` | `leaf_level_flag`, `root_level_flag`, `management_flag`, `executive_flag`, `equity_eligible_flag`, `remote_eligible_flag` |
| **Worksite** | `d_worksite` | No | None | None |
| **Form** | `d_form_head` | No | None | `latest_version_flag` |
| **Wiki** | `d_wiki` | No | `dl__wiki_publication_status` | `public_flag` |
| **Artifact** | `d_artifact` | No | None | None |
| **Report** | `d_reports` | No | None | None |

### 4.3 Fact Tables (8)

| Fact Table | Purpose | Key Measures | Dimension Links |
|------------|---------|--------------|----------------|
| `f_inventory` | Stock levels by location | `on_hand_qty`, `reorder_qty` | product_id, office_id |
| `f_order` | Customer purchase orders | `qty_ordered`, `order_amt` | customer_id, product_id, date_id |
| `fact_order` | Alternate order tracking | Similar to f_order | Similar linkages |
| `f_invoice` | Billing transactions | `qty_billed`, `invoice_amt` | customer_id, project_id, date_id |
| `fact_invoice` | Alternate invoice tracking | Similar to f_invoice | Similar linkages |
| `f_shipment` | Delivery logistics | `qty_shipped`, `shipping_cost_amt` | customer_id, carrier_id, date_id |
| `fact_shipment` | Alternate shipment tracking | Similar to f_shipment | Similar linkages |
| `fact_inventory` | Alternate inventory snapshot | `quantity` → `qty` (migrated) | Similar linkages |

**⚠️ Removed Misclassified Dimensions:**
- `36_d_cost.ddl` (should be `f_cost` fact table)
- `37_d_revenue.ddl` (should be `f_revenue` fact table)

**Rationale:** Cost and revenue are transactional measurements (facts), not descriptive attributes (dimensions). They:
- Record business events (transactions)
- Contain monetary amounts
- Reference multiple dimensions (project, employee, date)
- Grow continuously over time

### 4.4 Settings Tables (16)

All settings tables use the `setting_datalabel_` prefix:

| Table | Mapped To Entity | Semantic Suffix |
|-------|------------------|-----------------|
| `setting_datalabel_project_stage` | `d_project.dl__project_stage` | `_stage` |
| `setting_datalabel_task_stage` | `d_task.dl__task_stage` | `_stage` |
| `setting_datalabel_task_priority` | `d_task.dl__task_priority` | `_priority` |
| `setting_datalabel_office_level` | `d_office.dl__office_level` | `_level` |
| `setting_datalabel_business_level` | `d_business.dl__business_level` | `_level` |
| `setting_datalabel_position_level` | `d_position.dl__position_level` | `_level` |
| `setting_datalabel_customer_tier` | `d_cust.dl__customer_tier` | `_tier` |
| `setting_datalabel_opportunity_funnel_stage` | `d_cust.dl__opportunity_funnel_stage` | `_stage` |
| `setting_datalabel_industry_sector` | `d_cust.dl__industry_sector` | `_sector` |
| `setting_datalabel_acquisition_channel` | `d_cust.dl__acquisition_channel` | `_channel` |
| `setting_datalabel_wiki_publication_status` | `d_wiki.dl__wiki_publication_status` | `_status` |
| `setting_datalabel_form_approval_status` | `d_form_head.dl__form_approval_status` | `_status` |
| `setting_datalabel_form_submission_status` | `d_form_submission.dl__form_submission_status` | `_status` |
| `setting_datalabel_task_update_type` | Task update metadata | `_type` |
| `setting_datalabel_client_level` | Client classification | `_level` |
| `setting_datalabel_client_status` | Client status tracking | `_status` |

**Standard Settings Table Schema:**
```sql
CREATE TABLE app.setting_datalabel_{category} (
  level_id integer PRIMARY KEY,
  name varchar(50) NOT NULL UNIQUE,     -- Display name
  descr text,                            -- Description
  sort_order integer,                    -- Sequential ordering
  ui_color varchar(7),                   -- Hex color (#9333ea)
  is_active boolean DEFAULT true,        -- Active/inactive
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now()
);
```

### 4.5 Relationship Patterns

**1. Parent-Child (entity_id_map):**
```sql
CREATE TABLE app.entity_id_map (
  id uuid PRIMARY KEY,
  parent_entity_type text NOT NULL,  -- 'project'
  parent_entity_id uuid NOT NULL,
  child_entity_type text NOT NULL,   -- 'task'
  child_entity_id uuid NOT NULL,
  relationship_type text,
  created_ts timestamptz DEFAULT now()
);
```

**Example Query:**
```sql
-- Get all tasks for a project
SELECT t.*
FROM app.d_task t
JOIN app.entity_id_map eim
  ON eim.child_entity_id = t.id
  AND eim.child_entity_type = 'task'
WHERE eim.parent_entity_type = 'project'
  AND eim.parent_entity_id = $1
  AND t.active_flag = true;
```

**2. Many-to-Many (rel_* tables):**
```sql
CREATE TABLE app.rel_emp_role (
  employee_id uuid NOT NULL,
  role_id uuid NOT NULL,
  effective_from_ts timestamptz DEFAULT now(),
  effective_to_ts timestamptz,
  PRIMARY KEY (employee_id, role_id, effective_from_ts)
);
```

**3. Self-Referencing Hierarchy:**
```sql
-- Office hierarchy example
CREATE TABLE app.d_office (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  dl__office_level text NOT NULL,  -- 'Office', 'District', 'Region', 'Corporate'
  parent_id uuid,  -- Self-reference
  -- ...
);

-- Recursive query for hierarchy
WITH RECURSIVE office_tree AS (
  SELECT id, name, parent_id, dl__office_level, 1 AS depth
  FROM app.d_office
  WHERE id = $1
  UNION
  SELECT o.id, o.name, o.parent_id, o.dl__office_level, ot.depth + 1
  FROM app.d_office o
  JOIN office_tree ot ON o.parent_id = ot.id
)
SELECT * FROM office_tree ORDER BY depth, name;
```

---

## 5. Central Configuration & Middleware

### 5.1 Field Category Auto-Detection

**File:** `apps/web/src/lib/fieldCategoryRegistry.ts`

The registry scans column names and auto-assigns categories:

| Column Pattern | Category | Auto-Applied Behavior |
|----------------|----------|----------------------|
| `name`, `title` | NAME | 200px width, left-align, sortable, filterable, searchable |
| `code` | CODE | 120px, left-align, sortable, filterable |
| `descr`, `description` | DESCR | 250px, left-align, sortable, filterable |
| `dl__*` + suffix | LABEL | 130px, colored badge, settings dropdown, sortable, filterable |
| `*_amt` | AMOUNT | 120px, right-align, currency format, sortable, filterable |
| `*_qty` | NUMBER | 100px, right-align, number format, sortable, filterable |
| `*_pct` | PERCENTAGE | 100px, right-align, % format, sortable, filterable |
| `*_date` | DATE | 120px, friendly date, sortable, filterable |
| `*_ts` | TIMESTAMP | 150px, relative time, sortable, NOT filterable |
| `*_flag` | BOOLEAN | 80px, center-align, ✓/✗, sortable, filterable |

### 5.2 Column Generation

**File:** `apps/web/src/lib/columnGenerator.ts`

```typescript
// Automatically generates column configs from field names
const columns = generateStandardColumns([
  'name',
  'dl__project_stage',
  'budget_allocated_amt',
  'active_flag',
  'created_ts'
]);

// Result: Fully configured columns with rendering, width, alignment
```

### 5.3 Entity Configuration

**File:** `apps/web/src/lib/entityConfig.ts`

```typescript
export const entityConfig: EntityConfigs = {
  project: {
    entityType: 'project',
    displayName: 'Project',
    apiPath: '/api/v1/project',

    // Auto-generated columns
    columns: generateStandardColumns([
      'name',
      'code',
      'descr',
      'dl__project_stage',
      'budget_allocated_amt',
      'active_flag'
    ]),

    // Datalabel fields automatically load from settings
    fields: [
      {
        id: 'dl__project_stage',
        label: 'Stage',
        type: 'select',
        category: 'LABEL',
        loadOptionsFromSettings: 'project_stage'  // ← Auto-loads dropdown
      }
    ]
  }
};
```

### 5.4 Settings Loader

**File:** `apps/web/src/lib/settingsLoader.ts`

Automatically loads settings for datalabel fields:
```typescript
// Extracts "project_stage" from "dl__project_stage"
// Calls GET /api/v1/setting?category=project_stage
// Returns options: [{ id, name, color, sortOrder }]
```

---

## 6. User Interaction Flow Examples

### 6.1 Creating a Project with Stage Selection

**User Action:**
1. Click "New Project" button on `/project` page
2. Form modal opens

**Frontend Behavior:**
```typescript
// entityConfig.ts detects dl__project_stage field
// Automatically calls:
GET /api/v1/setting?category=project_stage

// Renders dropdown with colored options:
// [ ] Initiation (blue)
// [ ] Planning (orange)
// [✓] Execution (purple)  ← User selects
// [ ] Closure (green)
```

**User Submits:**
```json
POST /api/v1/project
{
  "name": "Website Redesign",
  "dl__project_stage": "Execution",  // ← Value stored as name, not ID
  "budget_allocated_amt": 75000.00
}
```

**Database Insert:**
```sql
INSERT INTO app.d_project (name, dl__project_stage, budget_allocated_amt)
VALUES ('Website Redesign', 'Execution', 75000.00);
```

**UI Renders:**
```
┌─────────────────┬──────────────┬────────────────┐
│ Name            │ Stage        │ Budget         │
├─────────────────┼──────────────┼────────────────┤
│ Website Redesign│ [Execution]  │ $75,000.00 CAD │
│                 │  (purple)    │    (right)     │
└─────────────────┴──────────────┴────────────────┘
```

### 6.2 Filtering Tasks by Priority

**User Action:**
1. Navigate to `/task` page
2. Click priority column filter dropdown

**Frontend Behavior:**
```typescript
// fieldCategoryRegistry.ts detects dl__task_priority
// Auto-loads filter options:
GET /api/v1/setting?category=task_priority

// Renders filter dropdown:
// [ ] critical (red)
// [ ] high (orange)
// [✓] medium (yellow)  ← User selects
// [ ] low (green)
```

**API Request:**
```
GET /api/v1/task?dl__task_priority=medium
```

**SQL Query:**
```sql
SELECT * FROM app.d_task
WHERE dl__task_priority = 'medium'
  AND active_flag = true
ORDER BY created_ts DESC;
```

### 6.3 Updating Role Flags

**User Action:**
1. Navigate to `/role/{id}` detail page
2. Toggle "Management Role" checkbox

**Frontend Behavior:**
```typescript
// fieldCategoryRegistry.ts detects management_role_flag
// Renders as checkbox
// User toggles: false → true
```

**API Request:**
```json
PATCH /api/v1/role/{id}
{
  "management_role_flag": true
}
```

**Database Update:**
```sql
UPDATE app.d_role
SET management_role_flag = true,
    updated_ts = now()
WHERE id = $1;
```

---

## 7. Critical Considerations When Building

### 7.1 Naming Convention Enforcement

**⚠️ CRITICAL - Always Follow These Rules:**

1. **Booleans MUST use `*_flag` pattern**
   ```sql
   -- ✅ CORRECT
   active_flag boolean
   management_role_flag boolean

   -- ❌ WRONG - Will NOT auto-detect
   is_active boolean
   is_management_role boolean
   ```

2. **Datalabels MUST use `dl__*` prefix AND semantic suffix**
   ```sql
   -- ✅ CORRECT
   dl__project_stage text        -- ends with "_stage"
   dl__customer_tier text         -- ends with "_tier"
   dl__office_level text          -- ends with "_level"

   -- ❌ WRONG - Missing prefix or suffix
   project_stage text             -- Missing dl__ prefix
   dl__project text               -- Missing semantic suffix
   ```

3. **Money MUST use `*_amt` suffix**
   ```sql
   -- ✅ CORRECT
   budget_allocated_amt numeric(15,2)

   -- ❌ WRONG
   budget_amount numeric(15,2)
   budget numeric(15,2)
   ```

4. **Quantities MUST use `*_qty` suffix**
   ```sql
   -- ✅ CORRECT
   on_hand_qty integer

   -- ❌ WRONG
   quantity integer
   on_hand_quantity integer
   ```

### 7.2 DDL File Changes

**When Adding New Entity:**

1. Create DDL file following standard pattern
2. Include all standard columns (id, name, descr, timestamps, flags)
3. Use proper naming conventions for all columns
4. Add to `tools/db-import.sh` validation array
5. Run `./tools/db-import.sh` to verify

**When Adding Datalabel Field:**

1. Create settings table: `setting_datalabel_{category}.ddl`
2. Add entity column: `dl__{category}_{suffix}` (e.g., `dl__project_stage`)
3. Update `tools/db-import.sh` to include settings DDL
4. Frontend will auto-detect and load options

### 7.3 API Route Changes

**When Column Name Changes:**

1. Update all SQL SELECT queries
2. Update all INSERT statements (column list + VALUES)
3. Update all UPDATE operations (SET clause)
4. Update TypeBox schemas (request/response validation)
5. Test with `./tools/test-api.sh`

**Example API Update:**
```typescript
// SELECT query
const result = await sql`
  SELECT
    id,
    name,
    management_role_flag,  // ← Updated from is_management_role
    dl__office_level       // ← Updated from level_name
  FROM app.d_role
  WHERE id = ${id}
`;

// INSERT statement
await sql`
  INSERT INTO app.d_role (name, management_role_flag)
  VALUES (${name}, ${managementFlag})
`;

// TypeBox schema
const RoleSchema = Type.Object({
  name: Type.String(),
  managementRoleFlag: Type.Optional(Type.Boolean()),  // ← Updated
  dlOfficeLevel: Type.Optional(Type.String())         // ← Updated
});
```

### 7.4 Frontend Configuration

**When Adding New Entity:**

Add to `entityConfig.ts`:
```typescript
newEntity: {
  entityType: 'newEntity',
  displayName: 'New Entity',
  apiPath: '/api/v1/newentity',

  // Use generateStandardColumns for auto-detection
  columns: generateStandardColumns([
    'name',
    'code',
    'dl__entity_status',  // ← Will auto-detect LABEL
    'budget_amt',         // ← Will auto-detect AMOUNT
    'active_flag'         // ← Will auto-detect BOOLEAN
  ])
}
```

**No manual configuration needed** - column names drive everything.

### 7.5 Database Import Workflow

**Every DDL change requires reimport:**

```bash
# 1. Make DDL changes
vim db/15_d_role.ddl

# 2. Test import
./tools/db-import.sh

# 3. Check for errors
# ✅ Schema validation completed successfully
# 🎉 Database import completed successfully!

# 4. Verify API
./tools/test-api.sh GET /api/v1/role

# 5. Test frontend
npm run dev
# Navigate to http://localhost:5173/role
```

### 7.6 Dimension vs Fact Classification

**How to Decide:**

| Ask These Questions | Dimension (d_*) | Fact (f_*) |
|---------------------|-----------------|------------|
| Does it describe WHO/WHAT/WHERE/WHEN? | ✅ Yes | ❌ No |
| Does it measure HOW MUCH/HOW MANY? | ❌ No | ✅ Yes |
| Does it change slowly over time? | ✅ Yes | ❌ No (grows rapidly) |
| Does it contain numeric metrics? | ❌ No | ✅ Yes |
| Can it be reused across multiple facts? | ✅ Yes | ❌ No |

**Examples:**
- **Employee** → Dimension (describes WHO)
- **Project** → Dimension (describes WHAT)
- **Cost Transaction** → Fact (measures HOW MUCH was spent)
- **Revenue Transaction** → Fact (measures HOW MUCH was earned)
- **Order** → Fact (measures HOW MANY items, HOW MUCH total)

### 7.7 Breaking Changes Protocol

**When Making Breaking Schema Changes:**

1. **Document Impact**: List all affected API endpoints
2. **Update API Routes**: Modify SQL queries + TypeBox schemas
3. **Update Frontend**: Adjust entityConfig.ts if needed
4. **Create Migration Summary**: Document old → new mappings
5. **Test Full Stack**: Database → API → Frontend
6. **Update Documentation**: This file + related docs

**Recent Example (2025-10-30):**
- Changed 15 boolean columns from `is_*` to `*_flag`
- Changed 11 datalabel columns to `dl__*` pattern
- Removed `slug` and `tags` from all entities
- Updated 19 DDL files, 13 API modules, 1 frontend config
- Documented in `/tmp/COMPLETE_MIGRATION_SUMMARY.md`

---

## Appendix: File Reference

### DDL Files by Category

**Core Entities (13):**
- `11_d_employee.ddl`
- `12_d_office.ddl`
- `13_d_business.ddl`
- `14_d_cust.ddl`
- `15_d_role.ddl`
- `16_d_position.ddl`
- `17_d_worksite.ddl`
- `18_d_product.ddl`
- `19_d_project.ddl`
- `20_d_task.ddl`
- `21_d_artifact.ddl`
- `22_d_wiki.ddl`
- `23_d_form_head.ddl`
- `24_d_reports.ddl`

**Fact Tables (8):**
- `f_inventory.ddl`
- `f_order.ddl`
- `f_invoice.ddl`
- `f_shipment.ddl`
- `fact_order.ddl`
- `fact_invoice.ddl`
- `fact_shipment.ddl`
- `fact_inventory.ddl`

**Settings Tables (16):**
- All prefixed with `setting_datalabel_*`
- See section 4.4 for complete list

**Total Active DDL Files:** 46 (after removal of cost/revenue dimensions)

---

**Document Status:** Production
**Last Migration:** 2025-10-30 (Naming Convention Standardization + Cost/Revenue Removal)
**Maintenance:** Update when schema changes occur
**Authority:** Authoritative reference for PMO data model
