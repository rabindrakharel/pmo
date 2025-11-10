# PMO Data Model - Technical Reference

> **Database architecture, DDL standards, entity relationships, and reusable patterns for the PMO platform**

---

## Semantics

The PMO data model is a **NO FOREIGN KEY** PostgreSQL architecture (app schema) supporting 48 tables across 18 entity types with polymorphic relationships, granular RBAC, and DDL standardization. All entity relationships flow through `d_entity_id_map` for flexibility. Settings drive UI via `setting_datalabel`. All tables follow strict naming, column, and documentation conventions for consistency.

**Key Principles:**
- **NO Foreign Keys** - All relationships via `d_entity_id_map` (polymorphic linking)
- **Soft Deletes** - `active_flag=false`, `to_ts=now()` preserves history
- **In-Place Updates** - Same ID, `version++`, `updated_ts` refreshes
- **Convention-Based** - Naming patterns eliminate configuration
- **DDL Standardization** - All 48 DDL files follow identical structure

---

## DDL Standards & Patterns

### Standard DDL Structure

Every DDL file follows this exact structure:

```sql
-- =====================================================
-- ENTITY NAME (table_name) - TYPE
-- Brief description
-- =====================================================
--
-- SEMANTICS:
-- • Business purpose and domain meaning
-- • Key concepts and usage context
--
-- OPERATIONS:
-- • CREATE: POST /api/v1/entity, INSERT with version=1, active_flag=true
-- • UPDATE: PUT /api/v1/entity/{id}, same ID, version++, updated_ts refreshes
-- • DELETE: DELETE /api/v1/entity/{id}, active_flag=false, to_ts=now() (soft delete)
-- • LIST: GET /api/v1/entity, filters by key_field, RBAC enforced
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY (stable identifier)
-- • code: varchar(50) UNIQUE NOT NULL
-- • name: varchar(200) NOT NULL
-- • dl__entity_field: text (datalabel reference)
-- • specific_field: type (domain-specific)
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • Parent: entity_type (via d_entity_id_map)
-- • Children: entity_type (via d_entity_id_map)
-- • RBAC: entity_id_rbac_map
--
-- =====================================================

CREATE TABLE app.table_name (
    -- Standard identity columns
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,

    -- Temporal audit columns
    active_flag boolean DEFAULT true,
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1,

    -- Entity-specific columns
    ...
);

COMMENT ON TABLE app.table_name IS 'Purpose and semantics';

-- =====================================================
-- DATA CURATION:
-- =====================================================

INSERT INTO app.table_name (...) VALUES (...);
```

### Standard Column Patterns

**Identity Columns (REQUIRED):**
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()  -- Stable UUID, never changes
code varchar(50) UNIQUE NOT NULL               -- Business code (e.g., 'PROJ-001')
name varchar(200) NOT NULL                     -- Display name
descr text                                     -- Long description
metadata jsonb DEFAULT '{}'::jsonb             -- Flexible JSONB storage
```

**Temporal Audit Columns (REQUIRED):**
```sql
active_flag boolean DEFAULT true               -- Soft delete flag
from_ts timestamptz DEFAULT now()              -- Start timestamp
to_ts timestamptz                              -- End timestamp (NULL = active)
created_ts timestamptz DEFAULT now()           -- Creation time
updated_ts timestamptz DEFAULT now()           -- Last update time
version integer DEFAULT 1                      -- Optimistic locking version
```

**Naming Conventions:**
```
_id        → UUID references (e.g., employee_id, project_id)
_amt       → Monetary amounts (e.g., budget_amt, total_amt)
_qty       → Quantities (e.g., item_qty)
_ts        → Timestamps (e.g., started_ts, completed_ts)
_flag      → Boolean flags (e.g., active_flag, remote_eligible_flag)
_pct       → Percentages (e.g., completion_pct, tax_pct)
dl__       → Datalabel references (e.g., dl__project_stage, dl__task_priority)
```

---

## Entity Relationships (ER Model)

### Polymorphic Linking Pattern

All parent-child relationships flow through **`d_entity_id_map`**:

```
┌──────────────────────────────────────────────────────────┐
│                    d_entity_id_map                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │ parent_entity_type │ parent_entity_id │         │   │
│  │ child_entity_type  │ child_entity_id  │         │   │
│  │ relationship_type  │ metadata         │         │   │
│  └─────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
           ↑                              ↑
           │                              │
    ┌──────┴──────┐              ┌────────┴─────────┐
    │   PARENT    │              │      CHILD       │
    │  d_project  │              │     d_task       │
    │  d_business │              │   d_artifact     │
    │    d_cust   │              │     d_form       │
    └─────────────┘              │     d_wiki       │
                                 └──────────────────┘
```

**Example Relationships:**
```sql
-- Project → Task
parent_entity_type='project', parent_entity_id='proj-uuid'
child_entity_type='task', child_entity_id='task-uuid'

-- Business → Project
parent_entity_type='business', parent_entity_id='biz-uuid'
child_entity_type='project', child_entity_id='proj-uuid'

-- Task → Artifact
parent_entity_type='task', parent_entity_id='task-uuid'
child_entity_type='artifact', child_entity_id='artifact-uuid'
```

### Core Entity Hierarchy

```
d_office (Physical Locations)
  ↓ d_entity_id_map
d_business (Business Units)
  ↓ d_entity_id_map
d_project (Work Containers)
  ↓ d_entity_id_map
d_task (Kanban Items)
  ↓ d_entity_id_map
d_artifact, d_form, d_wiki, d_quote, d_work_order
```

### RBAC Permission Model

```
┌─────────────────────────────────────┐
│      entity_id_rbac_map             │
│  ┌────────────────────────────┐    │
│  │ empid       │ Employee UUID │    │
│  │ entity      │ 'project'     │    │
│  │ entity_id   │ UUID or 'all' │    │
│  │ permission  │ integer[]     │    │
│  └────────────────────────────┘    │
└─────────────────────────────────────┘
         ↓
  Permission Array: [0, 1, 2, 3, 4, 5]

  0 = View
  1 = Edit
  2 = Audit
  3 = Delete
  4 = Create
  5 = Owner (full control)
```

---

## Table Catalog (48 Tables)

### Core Entity Tables (13)

| Table | Type | Relationships | Key Fields |
|-------|------|---------------|------------|
| `d_employee` | Dimension | role, position (via map) | email, password_hash, department |
| `d_business` | Dimension | office → business (via map) | business_number, dl__business_type |
| `d_office` | Dimension | Hierarchy root | office_code, addr, latitude, longitude |
| `d_project` | Dimension | business → project → task (via map) | project_code, dl__project_stage, budget_amt |
| `d_task` | Dimension | project → task (via map) | dl__task_status, dl__task_priority, assignee_id |
| `d_cust` | Dimension | cust → project (via map) | cust_number, cust_type, dl__customer_tier |
| `d_role` | Dimension | role → employee (via map) | role_code, role_category, management_flag |
| `d_position` | Dimension | Self-referencing hierarchy | dl__position_level, parent_id, salary_band |
| `d_worksite` | Dimension | Project locations | worksite_type, addr, latitude, longitude |
| `d_product` | Dimension | Inventory items | sku, dl__product_category, unit_price_amt |
| `d_service` | Dimension | Service catalog | service_code, dl__service_category, hourly_rate_amt |
| `d_artifact` | Dimension | File attachments | s3_key, presigned_url, file_size_bytes |
| `d_wiki` | Dimension | Documentation | content_html, tags |

### Form & Workflow Tables (6)

| Table | Purpose | Schema |
|-------|---------|--------|
| `d_form_head` | Form definitions | JSONB schema: `{"steps": [...]}` |
| `d_form_data` | Form submissions | JSONB data: `{"step-1": {...}}` |
| `d_industry_workflow_graph_head` | Workflow templates | JSONB graph: `[{id, entity_name, parent_ids}]` |
| `d_industry_workflow_graph_data` | Workflow instances | JSONB entities: `[{id, entity_id, entity_stage}]` |
| `f_industry_workflow_events` | Workflow event log | event_type, from_state_id, to_state_id |
| `d_workflow_automation` | Automation rules | trigger_conditions, actions |

### Financial Tables (4)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `fact_quote` | Sales quotes | dl__quote_stage, total_amt, valid_until_date |
| `fact_work_order` | Work performed | dl__work_order_status, labor_hours, total_cost_amt |
| `f_invoice` | Invoices | invoice_number, dl__invoice_status, total_amt |
| `f_order` | Orders | order_number, dl__order_status, total_amt |

### Event & Calendar Tables (3)

| Table | Purpose | Polymorphic Links |
|-------|---------|-------------------|
| `d_event` | Universal events | Links to any entity via d_entity_id_map |
| `d_entity_person_calendar` | Availability slots | person_entity_type, person_entity_id, event_id |
| `d_entity_event_person_calendar` | Event attendees | event_id, person_entity_id, event_rsvp_status |

### Infrastructure Tables (16)

| Table | Purpose | Pattern |
|-------|---------|---------|
| `d_entity_id_map` | Polymorphic links | parent_entity_type + child_entity_type |
| `entity_id_rbac_map` | RBAC permissions | empid + entity + entity_id + permission[] |
| `d_entity_instance_id` | Entity registry | entity_type + entity_id + entity_name |
| `d_entity` | Entity type catalog | code, ui_icon, child_entities (JSONB) |
| `setting_datalabel` | Universal settings | datalabel_name, datalabel_value, display_order |
| `orchestrator_session` | AI orchestrator | session_id, context (JSONB) |
| `orchestrator_state` | Workflow state | state_name, state_data (JSONB) |
| `orchestrator_agents` | AI agents | agent_type, capabilities (JSONB) |
| `orchestrator_agent_log` | Agent logs | log_level, message, metadata |
| `orchestrator_summary` | Session summary | summary_type, summary_data (JSONB) |

### Settings Tables (6)

All settings use `setting_datalabel` table with `datalabel_name` as category key:

| Datalabel Name | Purpose | Values |
|----------------|---------|--------|
| `dl__project_stage` | Project lifecycle | Initiation, Planning, Execution, Monitoring, Closure |
| `dl__task_status` | Task states | To Do, In Progress, Code Review, Testing, Done |
| `dl__task_priority` | Task urgency | Critical, High, Medium, Low |
| `dl__customer_tier` | Service tiers | Bronze, Silver, Gold, Platinum |
| `dl__opportunity_funnel` | Sales pipeline | Lead, Qualified, Proposal, Negotiation, Closed Won/Lost |

---

## Reusable Patterns

### 1. Polymorphic Entity Linking

**Pattern:** Link any parent entity to any child entity without foreign keys

```sql
-- Create linkage
INSERT INTO app.d_entity_id_map (
    parent_entity_type, parent_entity_id,
    child_entity_type, child_entity_id,
    relationship_type
) VALUES (
    'project', '93106ffb-402e-43a7-8b26-5287e37a1b0e',
    'task', 'a2222222-2222-2222-2222-222222222222',
    'contains'
);

-- Query children
SELECT t.*
FROM app.d_task t
JOIN app.d_entity_id_map m
  ON m.child_entity_id = t.id::text
 AND m.child_entity_type = 'task'
WHERE m.parent_entity_type = 'project'
  AND m.parent_entity_id = '93106ffb-402e-43a7-8b26-5287e37a1b0e'
  AND m.active_flag = true;
```

### 2. RBAC Permission Check

**Pattern:** Check if employee has permission for entity

```sql
-- Check view permission (0)
SELECT EXISTS (
  SELECT 1
  FROM app.entity_id_rbac_map
  WHERE empid = $1
    AND entity = 'project'
    AND (entity_id = $2::text OR entity_id = 'all')
    AND 0 = ANY(permission)
) AS has_view_permission;
```

### 3. Soft Delete Pattern

**Pattern:** Mark records inactive instead of hard delete

```sql
-- Soft delete
UPDATE app.d_project
   SET active_flag = false,
       to_ts = now(),
       version = version + 1,
       updated_ts = now()
 WHERE id = $1;

-- Query active only
SELECT * FROM app.d_project WHERE active_flag = true;
```

### 4. In-Place Update Pattern

**Pattern:** Same ID, increment version, refresh timestamp

```sql
-- Update project stage
UPDATE app.d_project
   SET dl__project_stage = 'Execution',
       version = version + 1,
       updated_ts = now()
 WHERE id = $1;
```

### 5. Datalabel Settings Pattern

**Pattern:** Load dropdown options from unified settings

```sql
-- Get project stage options
SELECT datalabel_value, datalabel_value_label, display_order
  FROM app.setting_datalabel
 WHERE datalabel_name = 'dl__project_stage'
   AND active_flag = true
 ORDER BY display_order;
```

### 6. JSONB Flexible Schema

**Pattern:** Store complex nested data without rigid structure

```sql
-- Form schema (multi-step)
{
  "steps": [
    {
      "id": "step-1",
      "title": "General Information",
      "fields": [
        {"name": "text_1", "type": "text", "required": true},
        {"name": "select_1", "type": "select", "options": [...]}
      ]
    }
  ]
}

-- Metadata (flexible attributes)
{
  "lifetime_value": 250000,
  "acquisition_channel": "Referral",
  "tags": ["enterprise", "priority"],
  "custom_field_1": "value"
}
```

---

## Verification & Compliance

**Current Standardization Status:**
- **Compliant Files:** 21/48 (43%)
- **Target:** 100% standardization

**Verification Command:**
```bash
./tools/verify-ddl-standards-simple.sh
```

**Standard Checks:**
- ✅ SEMANTICS section present
- ✅ OPERATIONS section with HTTP endpoints
- ✅ KEY FIELDS section
- ✅ RELATIONSHIPS (NO FOREIGN KEYS) section
- ✅ DATA CURATION section
- ✅ Standard columns: id, metadata, active_flag, from_ts, created_ts, version
- ✅ COMMENT ON TABLE statement

---

## For AI/LLM Agents

**Critical Constraints:**
- **NEVER add foreign key constraints** - all relationships via `d_entity_id_map`
- **NEVER hard delete** - always soft delete with `active_flag=false`, `to_ts=now()`
- **ALWAYS increment version** - in-place updates must increment `version` column
- **ALWAYS use standard columns** - id, code, name, descr, metadata, temporal audit columns
- **ALWAYS follow DDL structure** - SEMANTICS → OPERATIONS → KEY FIELDS → RELATIONSHIPS → DATA CURATION

**Common Queries:**
- Parent-child linkage: Query `d_entity_id_map` with entity_type filters
- RBAC check: Query `entity_id_rbac_map` with empid + entity + permission array
- Settings/dropdowns: Query `setting_datalabel` with datalabel_name filter
- Active records only: Filter `active_flag = true`

**References:**
- DDL Standards: `/docs/datamodel/DDL_STANDARDIZATION_GUIDE.md`
- Entity Configuration: `/apps/web/src/config/entityConfigs.ts`
- API Implementation: `/apps/api/src/modules/{entity}/`
- Database Files: `/db/*.ddl` (48 files in Roman numeral order)
