# PMO Data Model - Complete Reference

> **Authoritative source for database schema, entity relationships, and data standards**

---

## Table of Contents

1. [Semantics & Business Context](#semantics--business-context)
2. [Architecture & DRY Design Patterns](#architecture--dry-design-patterns)
3. [Database, API & UI/UX Mapping](#database-api--uiux-mapping)
4. [Entity Relationships](#entity-relationships)
5. [Central Configuration & Middleware](#central-configuration--middleware)
6. [User Interaction Flow Examples](#user-interaction-flow-examples)
7. [Critical Considerations When Building](#critical-considerations-when-building)

---

## Semantics & Business Context

### What Is This System?

The PMO Data Model is a **NO FOREIGN KEY**, **DRY-first** database architecture supporting flexible entity relationships, granular RBAC, and convention-based UI rendering. All tables reside in the `app` PostgreSQL schema and follow strict naming conventions that eliminate manual configuration.

### Core Business Entities (13)

| Entity | Table | Purpose | Real Example |
|--------|-------|---------|--------------|
| **Project** | `d_project` | Work containers with budgets, timelines, teams | `'DT-2024-001'` - Digital Transformation ($750K budget) |
| **Task** | `d_task` | Kanban work items with priorities, time tracking | `'DT-TASK-002'` - Vendor Evaluation (60hrs estimated) |
| **Employee** | `d_employee` | Users, auth, RBAC identity | `'james.miller@huronhome.ca'` - CEO (id: `8260b1b0-...`) |
| **Business** | `d_business` | Business units, divisions | Corporate HQ, Regional Divisions |
| **Office** | `d_office` | Physical locations | London HQ, Toronto Branch |
| **Customer** | `d_cust` | Clients, prospects | Residential, Commercial sectors |
| **Role** | `d_role` | Job functions | CEO, Project Manager, Technician |
| **Position** | `d_position` | Org hierarchy levels | C-Level, VP, Director |
| **Worksite** | `d_worksite` | Project locations | Customer sites, service locations |
| **Artifact** | `d_artifact` | File attachments | S3/MinIO presigned URLs |
| **Form** | `d_form_head` | JSONB dynamic forms | Multi-step data collection |
| **Wiki** | `d_wiki` | Documentation pages | Knowledge base articles |
| **Reports** | `d_reports` | Report definitions | Business intelligence templates |

### Infrastructure Tables (3 Critical)

| Table | Purpose | Example Usage |
|-------|---------|---------------|
| **`d_entity_id_map`** | Parent-child instance links (NO FK) | Project `93106ffb-...` → Task `a2222222-...` |
| **`entity_id_rbac_map`** | Permission arrays per employee | Employee `8260b1b0-...` → project='all', permission=[0,1,2,3,4] |
| **`setting_datalabel`** | Unified settings for all datalabels | `dl__project_stage`: Initiation, Planning, Execution, ... |

### Settings System (1 Unified Table)

**`setting_datalabel`** - Single table replacing 16+ separate settings tables.

| datalabel_name | ui_label | Values |
|----------------|----------|--------|
| `dl__project_stage` | Project Stages | Initiation, Planning, Execution, Monitoring, Closure, On Hold, Cancelled |
| `dl__task_stage` | Task Stages | Backlog, Planning, To Do, In Progress, In Review, Completed, Blocked |
| `dl__task_priority` | Task Priorities | low, medium, high, critical |
| `dl__form_submission_status` | Form Statuses | draft, submitted, under_review, approved, rejected |
| `dl__customer_tier` | Customer Tiers | Bronze, Silver, Gold, Platinum |
| `dl__opportunity_funnel_stage` | Sales Funnel | Lead, Qualified, Proposal, Negotiation, Closed Won/Lost |

**Critical:** Column names in entity tables MUST match `datalabel_name` exactly.

```sql
-- Entity table column
CREATE TABLE d_project (
    dl__project_stage text  -- MUST match setting_datalabel.datalabel_name
);

-- Settings entry
INSERT INTO setting_datalabel (datalabel_name, ui_label, metadata) VALUES
('dl__project_stage', 'Project Stages', '[{"id": 0, "name": "Planning", "color_code": "purple"}, ...]');
```

---

## Architecture & DRY Design Patterns

### 1. NO FOREIGN KEYS Architecture

**Why?**
- **Flexibility**: Link entities across schemas/databases
- **Soft Deletes**: Parent deletion doesn't cascade
- **Temporal Relationships**: Support versioning with `from_ts`/`to_ts`
- **Performance**: No FK validation overhead on high-volume inserts

**Pattern:**
```sql
-- ❌ NEVER do this
CREATE TABLE d_task (
    project_id uuid REFERENCES d_project(id)  -- FORBIDDEN
);

-- ✅ ALWAYS do this
CREATE TABLE d_entity_id_map (
    parent_entity_type varchar(20),  -- 'project'
    parent_entity_id text,            -- '93106ffb-...'
    child_entity_type varchar(20),    -- 'task'
    child_entity_id text              -- 'a2222222-...'
);
```

### 2. Convention-Based Column Naming = Zero Config

Frontend auto-detects column types from naming patterns. **NO manual configuration needed.**

| Pattern | Type | Frontend Rendering | Example |
|---------|------|-------------------|---------|
| `dl__*` | Datalabel | Colored badge from `setting_datalabel` | `dl__project_stage` → 🟣 Planning |
| `*_flag` | Boolean | ✓ or ✗ (centered) | `active_flag` → ✓ |
| `*_amt` | Money | `$250,000.00 CAD` | `budget_allocated_amt` → $750,000.00 |
| `*_qty` | Quantity | `1,234` (right-aligned) | `on_hand_qty` → 150 |
| `*_pct` | Percentage | `25.5%` | `tax_rate_pct` → 13.0% |
| `*_date` | Date | `Mar 15, 2025` | `planned_start_date` → Jan 15, 2024 |
| `*_ts` | Timestamp | `3 minutes ago` | `updated_ts` → 2 hours ago |
| `metadata` | JSONB | Formatted JSON viewer | `{"priority": "high"}` |

### 3. In-Place Updates (NOT Type-2 SCD)

All core entities use **in-place updates** with version tracking, NOT historical archival.

```sql
-- Entity record lifecycle
CREATE: id='93106ffb-...', version=1, active_flag=true, created_ts=now()

UPDATE: id='93106ffb-...' (SAME),  -- ← ID NEVER changes
        version=2,                  -- ← Version increments
        updated_ts=now()            -- ← Timestamp refreshes

SOFT DELETE: id='93106ffb-...' (SAME),
             active_flag=false,     -- ← Hides from queries
             to_ts=now()            -- ← Deletion timestamp
```

**Why?**
- **Stable URLs**: Form shared URLs never break (`/form/ee8a6cfd-...`)
- **Preserved Relationships**: Child entities remain linked to same parent ID
- **Simple Queries**: No temporal joins needed (`WHERE active_flag=true`)

### 4. Soft Deletes Everywhere

```sql
-- All dimension tables
active_flag boolean DEFAULT true,
to_ts timestamptz,  -- NULL = active, timestamp = deleted

-- Query active records
SELECT * FROM d_project WHERE active_flag = true;

-- Soft delete (preserves audit trail)
UPDATE d_project SET active_flag = false, to_ts = now() WHERE id = '93106ffb-...';
```

### 5. RBAC Permission Arrays

```sql
-- Permission model: integer array
permission integer[] = [0, 1, 2, 3, 4]
--                      │  │  │  │  └─ Create
--                      │  │  │  └──── Delete
--                      │  │  └─────── Share
--                      │  └────────── Edit
--                      └───────────── View

-- Type-level permission (all instances)
INSERT INTO entity_id_rbac_map (empid, entity, entity_id, permission)
VALUES ('8260b1b0-...', 'project', 'all', ARRAY[0,1,2,3,4]);
-- Result: James Miller can CRUD ALL projects

-- Instance-level permission (specific UUID)
INSERT INTO entity_id_rbac_map (empid, entity, entity_id, permission)
VALUES ('john-uuid', 'project', '93106ffb-...', ARRAY[0,1]);
-- Result: John can VIEW and EDIT ONLY project 93106ffb-...
```

---

## Database, API & UI/UX Mapping

### Data Flow: Database → API → Frontend

```
┌─────────────────────────────────────────────────────────────────┐
│ DATABASE (PostgreSQL)                                           │
│                                                                 │
│  • Column: dl__project_stage TEXT                               │
│  • Value: 'Planning'                                            │
│  • Setting: datalabel_name = 'dl__project_stage'                │
│  • Perfect 1:1 alignment (no transformation)                    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ API (Fastify)                                                   │
│                                                                 │
│  GET /api/v1/project/{id}                                       │
│  → {dl__project_stage: "Planning", budget_allocated_amt: 750000}│
│                                                                 │
│  GET /api/v1/setting?datalabel=dl__project_stage                │
│  → {datalabel: "dl__project_stage", data: [                     │
│       {id: 0, name: "Initiation", color_code: "blue"},          │
│       {id: 1, name: "Planning", color_code: "purple"}, ...      │
│     ]}                                                          │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (React)                                                │
│                                                                 │
│  • Auto-detects column types from names                         │
│  • Loads settings for dl__* columns                             │
│  • Renders:                                                     │
│    - Colored badges: Planning (purple), Execution (yellow)      │
│    - Currency: $750,000.00 CAD                                  │
│    - Dates: Jan 15, 2024                                        │
│    - Booleans: ✓ or ✗                                           │
└─────────────────────────────────────────────────────────────────┘
```

### API Endpoints Pattern

```
GET    /api/v1/{entity}              → List all (RBAC filtered)
GET    /api/v1/{entity}/{id}         → Get single
POST   /api/v1/{entity}              → Create new
PUT    /api/v1/{entity}/{id}         → Update existing
DELETE /api/v1/{entity}/{id}         → Soft delete

GET    /api/v1/{entity}/{id}/{child} → Get filtered children
GET    /api/v1/setting?datalabel=dl__task_stage → Get settings
```

### RBAC Enforcement in API

```javascript
// Middleware extracts employee.id from JWT
const empid = req.user.sub;  // From JWT: {sub: "8260b1b0-...", email: "james.miller@..."}

// Check permission before allowing operation
const hasPermission = await db.query(`
  SELECT 1 FROM entity_id_rbac_map
  WHERE empid = $1
    AND entity = 'project'
    AND (entity_id = 'all' OR entity_id = $2)
    AND 1 = ANY(permission)  -- Edit permission
`, [empid, projectId]);

if (!hasPermission) throw new ForbiddenError();
```

---

## Entity Relationships

### Parent-Child Hierarchy (via `d_entity_id_map`)

```
office
 ├─ business
 │   └─ project
 │       ├─ task
 │       │   ├─ artifact
 │       │   ├─ form
 │       │   └─ employee (assignees)
 │       ├─ artifact
 │       ├─ wiki
 │       └─ form
 │
 └─ task (can be office-level without project)

client
 ├─ project
 ├─ artifact
 └─ form

role
 └─ employee

employee
 └─ (self-reference: manager_employee_id)
```

### Querying Children

```sql
-- Get all tasks for project 93106ffb-...
SELECT t.*
FROM d_task t
INNER JOIN d_entity_id_map eim ON eim.child_entity_id = t.id::text
WHERE eim.parent_entity_id = '93106ffb-...'
  AND eim.parent_entity_type = 'project'
  AND eim.child_entity_type = 'task'
  AND eim.active_flag = true
  AND t.active_flag = true
ORDER BY t.created_ts DESC;

-- Count children for tab badges
SELECT
  child_entity_type,
  COUNT(*) as count
FROM d_entity_id_map
WHERE parent_entity_id = '93106ffb-...'
  AND parent_entity_type = 'project'
  AND active_flag = true
GROUP BY child_entity_type;
-- Result: task: 8, wiki: 3, artifact: 5, form: 2
```

### Standard Entity Table Structure

```sql
CREATE TABLE app.d_{entity_name} (
    -- Identity
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,           -- Business code: 'DT-2024-001'
    name text NOT NULL,                         -- Display name
    descr text,                                 -- Description

    -- Metadata
    metadata jsonb DEFAULT '{}'::jsonb,         -- Flexible attributes

    -- Temporal (SCD Type 2 fields, used for soft delete only)
    from_ts timestamptz DEFAULT now(),          -- Creation timestamp
    to_ts timestamptz,                          -- NULL = active, timestamptz = deleted
    created_ts timestamptz DEFAULT now(),       -- Never modified
    updated_ts timestamptz DEFAULT now(),       -- Refreshed on UPDATE

    -- State
    active_flag boolean DEFAULT true,           -- Soft delete control
    version int DEFAULT 1,                      -- Increments on updates

    -- Entity-specific columns...
    dl__entity_stage text,                      -- References setting_datalabel
    budget_allocated_amt decimal(15,2),
    planned_start_date date,
    -- ...
);
```

---

## Central Configuration & Middleware

### 1. Authentication Flow

```
1. User submits: POST /api/v1/auth/login
   Body: {email: "james.miller@huronhome.ca", password: "password123"}

2. API queries: SELECT id, email, password_hash, name FROM d_employee
                WHERE email = $1 AND active_flag = true

3. Verify: bcrypt.compare(password, password_hash)

4. Generate JWT: {
     sub: "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",  ← employee.id
     email: "james.miller@huronhome.ca",
     name: "James Miller"
   }

5. All subsequent requests:
   - Include JWT in Authorization header
   - Middleware extracts empid from JWT.sub
   - RBAC checks use empid for permission queries
```

### 2. RBAC Middleware Pattern

```javascript
// apps/api/src/middleware/rbac.ts
async function checkPermission(req, entity, requiredPermission) {
  const empid = req.user.sub;  // From JWT
  const entityId = req.params.id || 'all';

  const result = await db.query(`
    SELECT permission
    FROM entity_id_rbac_map
    WHERE empid = $1
      AND entity = $2
      AND (entity_id = 'all' OR entity_id = $3)
      AND active_flag = true
      AND (expires_ts IS NULL OR expires_ts > now())
  `, [empid, entity, entityId]);

  if (!result.rows.length) return false;

  // Check if requiredPermission exists in permission array
  return result.rows.some(row =>
    row.permission.includes(requiredPermission)
  );
}

// Route usage
app.put('/api/v1/project/:id', async (req, res) => {
  if (!await checkPermission(req, 'project', 1)) {  // 1 = Edit
    return res.status(403).json({error: 'Forbidden'});
  }
  // ... perform update
});
```

### 3. Entity Configuration (Frontend)

```typescript
// apps/web/src/lib/entityConfig.ts
export const entityConfigs: EntityConfigs = {
  project: {
    baseApiPath: '/api/v1/project',
    displayName: 'Project',
    icon: 'FolderKanban',
    columns: [
      {
        key: 'code',
        label: 'Code',
        type: 'text',
        sortable: true,
        filterable: true
      },
      {
        key: 'dl__project_stage',  // ← Convention: dl__* → auto-loads from settings
        label: 'Stage',
        type: 'datalabel',
        loadOptionsFromSettings: 'dl__project_stage',
        filterable: true,
        renderAsTag: true,  // ← Auto-renders colored badge
        kanbanColumn: true  // ← Drives Kanban board columns
      },
      {
        key: 'budget_allocated_amt',  // ← Convention: *_amt → currency formatter
        label: 'Budget',
        type: 'currency',
        sortable: true
      },
      // ...
    ],
    actionEntities: ['task', 'wiki', 'artifact', 'form'],  // Child tabs
    rbacEntity: 'project'  // For permission checks
  },
  // ... other entities
};
```

---

## User Interaction Flow Examples

### Example 1: Creating a Task Under a Project

```
┌─────────────────────────────────────────────────────────────────┐
│ USER ACTION: Navigate to /project/93106ffb-..., click "Add Task"│
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND                                                        │
│  • Opens TaskForm modal                                         │
│  • Loads settings: GET /api/v1/setting?datalabel=dl__task_stage│
│  • Loads settings: GET /api/v1/setting?datalabel=dl__task_priority│
│  • Pre-fills project_id in metadata                             │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ USER ACTION: Fills form, submits                               │
│  {name: "Fix API bug", dl__task_stage: "To Do",                 │
│   dl__task_priority: "high", estimated_hours: 8}                │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ API: POST /api/v1/task                                          │
│                                                                 │
│ 1. RBAC Check:                                                  │
│    - Check empid has Edit permission on parent project         │
│    - Check empid has Create permission on task entity_id='all' │
│                                                                 │
│ 2. INSERT INTO d_task (id, code, name, dl__task_stage, ...)    │
│    VALUES ('a3333333-...', 'TASK-003', 'Fix API bug', ...)     │
│                                                                 │
│ 3. INSERT INTO d_entity_id_map                                  │
│    (parent_entity_type, parent_entity_id,                       │
│     child_entity_type, child_entity_id)                         │
│    VALUES ('project', '93106ffb-...',                           │
│           'task', 'a3333333-...')                               │
│                                                                 │
│ 4. Return: {id: "a3333333-...", version: 1, ...}                │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: Refreshes Tasks tab                                  │
│  • Badge updates: Tasks (9) ← was (8)                           │
│  • New task appears in filtered list                            │
│  • Task rendered with colored priority badge: 🟠 high           │
└─────────────────────────────────────────────────────────────────┘
```

### Example 2: Drag-Drop Task in Kanban Board

```
┌─────────────────────────────────────────────────────────────────┐
│ USER ACTION: Drag task from "To Do" to "In Progress" column    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND                                                        │
│  • Optimistic UI update (instant visual feedback)               │
│  • Sends: PUT /api/v1/task/a2222222-...                         │
│    Body: {dl__task_stage: "In Progress"}                        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ API: PUT /api/v1/task/a2222222-...                              │
│                                                                 │
│ 1. RBAC Check: empid has Edit permission on task?              │
│                                                                 │
│ 2. UPDATE d_task                                                │
│    SET dl__task_stage = 'In Progress',                          │
│        version = version + 1,                                   │
│        updated_ts = now()                                       │
│    WHERE id = 'a2222222-...'                                    │
│                                                                 │
│ 3. Return: {id: "a2222222-...", version: 2, ...}                │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: Confirms update                                      │
│  • Task remains in "In Progress" column                         │
│  • Badge color updates: 🟡 In Progress                          │
│  • Updated timestamp shows: "Just now"                          │
└─────────────────────────────────────────────────────────────────┘
```

### Example 3: Filtering by RBAC Permissions

```
┌─────────────────────────────────────────────────────────────────┐
│ USER ACTION: John visits /project (John is NOT admin)          │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ API: GET /api/v1/project                                        │
│                                                                 │
│ 1. Extract empid from JWT: 'john-uuid'                          │
│                                                                 │
│ 2. Query with RBAC filter:                                      │
│    SELECT p.* FROM d_project p                                  │
│    WHERE p.active_flag = true                                   │
│      AND EXISTS (                                               │
│        SELECT 1 FROM entity_id_rbac_map rbac                    │
│        WHERE rbac.empid = 'john-uuid'                           │
│          AND rbac.entity = 'project'                            │
│          AND (rbac.entity_id = 'all' OR rbac.entity_id = p.id::text)│
│          AND 0 = ANY(rbac.permission)  -- View permission       │
│          AND rbac.active_flag = true                            │
│      )                                                          │
│    ORDER BY p.name ASC                                          │
│                                                                 │
│ 3. Result: Only projects John has View permission for           │
│    (e.g., 2 projects out of 50 total)                           │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: Renders 2 projects                                   │
│  • John sees ONLY projects he can access                        │
│  • Navigation restricted to authorized entities                 │
│  • Action buttons reflect permissions (no Edit if missing perm) │
└─────────────────────────────────────────────────────────────────┘
```

---

## Critical Considerations When Building

### ✅ DO

```sql
-- 1. Use dl__ prefix for datalabel columns
CREATE TABLE app.d_project (
  dl__project_stage text  -- ✅ Matches setting_datalabel.datalabel_name
);

-- 2. Match settings table entry EXACTLY
INSERT INTO app.setting_datalabel (datalabel_name, ui_label, metadata) VALUES
('dl__project_stage', 'Project Stages', '[...]'::jsonb);  -- ✅ Same as column

-- 3. Use snake_case for all names
CREATE TABLE app.d_project (
  budget_allocated_amt numeric,  -- ✅ Correct
  planned_start_date date         -- ✅ Correct
);

-- 4. Always use *_flag for booleans
active_flag boolean DEFAULT true,  -- ✅ Correct
remote_work_eligible_flag boolean  -- ✅ Correct

-- 5. NO FOREIGN KEYS - use d_entity_id_map
INSERT INTO d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
VALUES ('project', 'proj-uuid', 'task', 'task-uuid');  -- ✅ Correct

-- 6. Soft delete pattern
UPDATE d_project SET active_flag = false, to_ts = now() WHERE id = 'uuid';  -- ✅ Preserves data
```

### ❌ DON'T

```sql
-- ❌ Missing dl__ prefix (won't load settings)
CREATE TABLE app.d_project (
  project_stage text  -- ❌ Should be dl__project_stage
);

-- ❌ Wrong format in settings
INSERT INTO setting_datalabel (datalabel_name) VALUES
('project_stage');  -- ❌ Should be dl__project_stage

-- ❌ Don't use is_* for booleans
CREATE TABLE app.d_employee (
  is_active boolean  -- ❌ Should be active_flag
);

-- ❌ Don't use foreign keys
CREATE TABLE app.d_task (
  project_id uuid REFERENCES d_project(id)  -- ❌ FORBIDDEN
);

-- ❌ Don't hard delete
DELETE FROM d_project WHERE id = 'uuid';  -- ❌ Destroys audit trail
```

### Performance Considerations

```sql
-- Index parent/child lookups
CREATE INDEX idx_entity_id_map_parent
ON d_entity_id_map(parent_entity_type, parent_entity_id)
WHERE active_flag = true;

CREATE INDEX idx_entity_id_map_child
ON d_entity_id_map(child_entity_type, child_entity_id)
WHERE active_flag = true;

-- Index RBAC lookups
CREATE INDEX idx_rbac_empid_entity
ON entity_id_rbac_map(empid, entity)
WHERE active_flag = true;

-- JSONB indexing for settings
CREATE INDEX idx_setting_datalabel_metadata
ON setting_datalabel USING GIN (metadata);
```

### Schema Change Workflow

```bash
# 1. Edit DDL file
vim db/18_d_project.ddl

# 2. Update semantics section (keep short, crisp, with examples)

# 3. Reimport database
./tools/db-import.sh

# 4. Test API endpoints
./tools/test-api.sh GET /api/v1/project
./tools/test-api.sh POST /api/v1/project '{"name":"Test","code":"TEST-001"}'

# 5. Verify frontend rendering
# - Check column auto-detection
# - Verify datalabel badge colors
# - Test RBAC filtering
```

### Adding New Entity Type

```sql
-- 1. Create DDL file: db/XX_d_newentity.ddl
CREATE TABLE app.d_newentity (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name text NOT NULL,
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,

    -- Datalabels (if needed)
    dl__newentity_status text,  -- Must match setting_datalabel entry

    -- Standard temporal fields
    active_flag boolean DEFAULT true,
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);

-- 2. Add settings (if using datalabels)
INSERT INTO setting_datalabel (datalabel_name, ui_label, metadata) VALUES
('dl__newentity_status', 'Status', '[{"id": 0, "name": "Active", "color_code": "green"}]'::jsonb);

-- 3. Add to d_entity_id_map relationships (if has parents/children)

-- 4. Add RBAC permissions
INSERT INTO entity_id_rbac_map (empid, entity, entity_id, permission)
VALUES ('admin-empid', 'newentity', 'all', ARRAY[0,1,2,3,4]);

-- 5. Create API module: apps/api/src/modules/newentity/routes.ts

-- 6. Add frontend config: apps/web/src/lib/entityConfig.ts
```

---

## File Inventory

| File Pattern | Count | Purpose |
|-------------|-------|---------|
| `db/1*_d_*.ddl` | 13 | Core dimension entities |
| `db/2*_d_*.ddl` | 5 | Product/operations dimensions |
| `db/*_d_*_data.ddl` | 4 | Data tables (task_data, form_data, wiki_data, report_data) |
| `db/f_*.ddl`, `db/fact_*.ddl` | 8 | Fact tables (orders, invoices, inventory, shipments) |
| `db/3*_d_entity*.ddl` | 4 | Infrastructure (entity, entity_instance_id, entity_id_map, entity_id_rbac_map) |
| `db/setting_datalabel.ddl` | 1 | Unified settings table |

**Total:** 39 DDL files in `/home/rabin/projects/pmo/db/`

---

## Quick Reference

### Common Queries

```sql
-- Get all projects for employee
SELECT p.* FROM d_project p
WHERE active_flag = true
  AND EXISTS (
    SELECT 1 FROM entity_id_rbac_map
    WHERE empid = $empid
      AND entity = 'project'
      AND (entity_id = 'all' OR entity_id = p.id::text)
      AND 0 = ANY(permission)
  );

-- Get task count per project stage
SELECT dl__task_stage, COUNT(*) as count
FROM d_task
WHERE active_flag = true
GROUP BY dl__task_stage;

-- Get project hierarchy
SELECT
  p.name as project_name,
  COUNT(t.id) as task_count,
  SUM(t.estimated_hours) as total_hours
FROM d_project p
LEFT JOIN d_entity_id_map eim ON eim.parent_entity_id = p.id::text
LEFT JOIN d_task t ON t.id = eim.child_entity_id::uuid
WHERE p.active_flag = true
  AND (eim.child_entity_type = 'task' OR eim.child_entity_type IS NULL)
GROUP BY p.id, p.name;
```

### API Testing

```bash
# List projects
./tools/test-api.sh GET /api/v1/project

# Get single project
./tools/test-api.sh GET /api/v1/project/93106ffb-402e-43a7-8b26-5287e37a1b0e

# Create task
./tools/test-api.sh POST /api/v1/task '{
  "name": "New Task",
  "code": "TASK-999",
  "dl__task_stage": "To Do",
  "dl__task_priority": "high"
}'

# Update task stage
./tools/test-api.sh PUT /api/v1/task/a2222222-2222-2222-2222-222222222222 '{
  "dl__task_stage": "In Progress"
}'

# Get settings
./tools/test-api.sh GET "/api/v1/setting?datalabel=dl__task_stage"
```

---

**Last Updated:** 2025-10-31
**Schema:** `app`
**Total Tables:** 39
**Database:** PostgreSQL 14+
**Status:** Production Ready
