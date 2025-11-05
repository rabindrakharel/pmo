# PMO Platform Architecture - v3.1 Production State

> **Technical architecture documentation for staff engineers and AI agents** - Current state of DRY-first, config-driven universal entity system with inline create-then-link pattern.

**Last Updated:** 2025-11-04
**Version:** 3.1.0
**Status:** Production
**Primary Doc:** [Universal Entity System](./entity_design_pattern/universal_entity_system.md)

---

## 1. Semantics & Business Context

### Platform Purpose
Enterprise PMO system for Canadian home services industry managing projects, tasks, employees, clients, and operations through a universal entity architecture.

### Core Business Flows
1. **Entity Management** - CRUD operations for 18+ entity types via 3 universal pages
2. **Parent-Child Relationships** - Hierarchical linkages stored in `d_entity_id_map` table
3. **Inline Data Entry** - "Add Row" creates entities and establishes relationships atomically
4. **Role-Based Access** - Granular permissions via `entity_id_rbac_map` table
5. **Settings-Driven UI** - Dropdowns, workflows, and states managed by 16 settings tables

### v3.1 Key Enhancements
- **Inline Create-Then-Link:** Users create child entities directly in data tables with automatic linkage
- **Default-Editable Pattern:** All fields editable unless explicitly readonly (zero configuration)
- **Column Consistency:** Same columns shown regardless of navigation context

---

## 2. Architecture & DRY Design Patterns

### System Architecture

```
┌────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER                         │
│  React 19 + Vite + Tailwind CSS + TypeScript              │
├────────────────────────────────────────────────────────────┤
│  3 Universal Pages:                                        │
│    ┌─────────────────┐  ┌────────────────┐  ┌──────────┐ │
│    │ EntityMainPage  │  │EntityDetailPage│  │ Create   │ │
│    │  (List/Kanban)  │  │  (Detail+Tabs) │  │  Page    │ │
│    └─────────────────┘  └────────────────┘  └──────────┘ │
│                                                            │
│  1 Configuration File:                                     │
│    entityConfig.ts ← SINGLE SOURCE OF TRUTH               │
│                                                            │
│  Data Tables:                                              │
│    FilteredDataTable.tsx ← Handles inline create-link    │
│                                                            │
│  Field Detection:                                          │
│    data_transform_render.tsx ← 10-rule capability system │
├────────────────────────────────────────────────────────────┤
│                       API LAYER                            │
│  Fastify v5 + TypeScript (ESM) + Drizzle ORM              │
├────────────────────────────────────────────────────────────┤
│  31+ Modules:                                              │
│    /api/v1/{entity} ← CRUD operations                     │
│    /api/v1/linkage  ← Parent-child relationships          │
│    /api/v1/setting  ← Dynamic dropdown options            │
├────────────────────────────────────────────────────────────┤
│                     DATABASE LAYER                         │
│  PostgreSQL 14+ + app schema                              │
├────────────────────────────────────────────────────────────┤
│  52 Tables:                                                │
│    13 Core Entities (d_* prefix)                          │
│    16 Settings Tables (setting_datalabel_* prefix)        │
│    23 Infrastructure (linkage, RBAC, metadata)            │
└────────────────────────────────────────────────────────────┘
```

### DRY Pattern: Universal Entity System

**Problem:** Traditional approach requires 3 pages × 18 entities = 54 separate page files

**Solution:** 3 universal pages handle ALL entity types via configuration

```typescript
// SINGLE SOURCE OF TRUTH
// apps/web/src/lib/entityConfig.ts

export const entityConfigs: Record<string, EntityConfig> = {
  task: {
    name: 'task',
    displayName: 'Task',
    apiEndpoint: '/api/v1/task',

    // Define columns once
    columns: [
      { key: 'name', title: 'Task Name', sortable: true },
      { key: 'task_stage', title: 'Stage', loadOptionsFromSettings: true },
      { key: 'task_priority', title: 'Priority', loadOptionsFromSettings: true },
      { key: 'start_date', title: 'Start Date' },
      { key: 'end_date', title: 'Due Date' }
    ],

    // Define fields once
    fields: [
      { key: 'name', label: 'Task Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'task_stage', label: 'Stage', type: 'select',
        loadOptionsFromSettings: 'task_stage' }
    ],

    supportedViews: ['table', 'kanban', 'grid'],
    defaultView: 'table'
  }
};
```

**Benefits:**
- 95%+ code reuse across all 18+ entity types
- Add new entity type in ~50 lines of config
- Zero duplication of page logic

### DRY Pattern: Inline Create-Then-Link (v3.1)

**Problem:** Creating child entities required multiple steps: create → navigate → link → navigate back

**Solution:** Two-step atomic operation within data table

```typescript
// apps/web/src/components/shared/dataTable/FilteredDataTable.tsx

const handleSaveInlineEdit = async (record: any) => {
  const isNewRow = isAddingRow || record.id.startsWith('temp_');

  if (isNewRow) {
    // STEP 1: Create entity
    const response = await fetch(`${API_BASE_URL}${config.apiEndpoint}`, {
      method: 'POST',
      body: JSON.stringify(transformedData)
    });

    const result = await response.json();
    const newEntityId = result.id;

    // STEP 2: Create linkage (if parent context exists)
    if (parentType && parentId && newEntityId) {
      await fetch(`${API_BASE_URL}/api/v1/linkage`, {
        method: 'POST',
        body: JSON.stringify({
          parent_entity_type: parentType,
          parent_entity_id: parentId,
          child_entity_type: entityType,
          child_entity_id: newEntityId,
          relationship_type: 'contains'
        })
      });
    }

    // STEP 3: Reload data
    await fetchData();
  }
};
```

**Benefits:**
- Seamless UX - no page navigation
- Automatic linkage - parent-child relationships established
- Error transparency - clear feedback if linkage fails
- Universal - works for all entity combinations

### DRY Pattern: Default-Editable (v3.1)

**Problem:** Manual configuration of field editability led to inconsistent "Add Row" behavior

**Solution:** Default to editable, explicit readonly exceptions

```typescript
// apps/web/src/lib/data_transform_render.tsx

export function getFieldCapability(column: ColumnDef): FieldCapability {
  const key = column.key;

  // Rule 1: System fields → readonly
  if (/^(id|created_ts|updated_ts|version)$/i.test(key)) {
    return { inlineEditable: false, editType: 'readonly' };
  }

  // Rule 2: Tags → text input
  if (/^tags$|_tags$/i.test(key)) {
    return { inlineEditable: true, editType: 'tags' };
  }

  // Rule 3: Files → drag-drop
  if (/^attachment/i.test(key)) {
    return { inlineEditable: true, editType: 'file', isFileUpload: true };
  }

  // Rule 4: Settings → dropdown
  if (column.loadOptionsFromSettings) {
    return { inlineEditable: true, editType: 'select' };
  }

  // Rule 5: Numbers → number input
  if (/_(amt|count|qty|price)$/i.test(key)) {
    return { inlineEditable: true, editType: 'number' };
  }

  // Rule 6: Dates → date picker
  if (/_(date|ts)$|^date_/i.test(key)) {
    return { inlineEditable: true, editType: 'date' };
  }

  // Rule 7: Computed fields → readonly
  if (/^(parent_id|child_count|total_|sum_)$/i.test(key)) {
    return { inlineEditable: false, editType: 'readonly' };
  }

  // DEFAULT: Editable as text
  return { inlineEditable: true, editType: 'text' };
}
```

**Benefits:**
- Zero configuration required
- Universal "Add Row" support
- Pattern-based input detection
- Consistent UX across entities

### DRY Pattern: Column Consistency (v3.1)

**Problem:** Child entity tables showed different columns than main views (redundant parent ID column)

**Solution:** Use config columns directly, no context-dependent modification

```typescript
// apps/web/src/components/shared/dataTable/FilteredDataTable.tsx

// ❌ OLD: Context-dependent (v3.0)
const columns = useMemo(() => {
  if (parentType && parentId) {
    const parentIdColumn = { key: 'parent_id', title: `Parent (${parentType})` };
    return [parentIdColumn, ...config.columns]; // Different!
  }
  return config.columns;
}, [config, parentType, parentId]);

// ✅ NEW: Context-independent (v3.1)
const columns = useMemo(() => {
  return config.columns; // Same everywhere
}, [config]);
```

**Benefits:**
- `/task` and `/project/{id}/task` show identical columns
- Single source of truth maintained
- More screen space (removed redundant column)
- DRY principle enforced

---

## 3. Database, API & UI/UX Mapping

### Database Architecture

**Core Entity Tables** (13 tables with `d_` prefix):
```
d_project       - Projects
d_task          - Tasks
d_employee      - Employees
d_client        - Clients (customers)
d_worksite      - Work locations
d_role          - Employee roles
d_position      - Job positions
d_artifact      - File attachments
d_wiki          - Documentation pages
d_form_head     - Form definitions
d_form_data     - Form submissions
d_cost          - Cost tracking
d_revenue       - Revenue tracking
```

**Linkage Table** (Parent-Child Relationships):
```sql
CREATE TABLE app.d_entity_id_map (
  id UUID PRIMARY KEY,
  parent_entity_type VARCHAR(20) NOT NULL,  -- e.g., 'project'
  parent_entity_id TEXT NOT NULL,           -- UUID of parent
  child_entity_type VARCHAR(20) NOT NULL,   -- e.g., 'task'
  child_entity_id TEXT NOT NULL,            -- UUID of child
  relationship_type VARCHAR(50) DEFAULT 'contains',
  active_flag BOOLEAN DEFAULT true,
  created_ts TIMESTAMPTZ DEFAULT NOW()
);
```

**Settings Tables** (16 tables with `setting_datalabel_` prefix):
```
setting_datalabel_project_stage          - Project lifecycle stages
setting_datalabel_task_stage             - Task workflow stages
setting_datalabel_task_priority          - Task priority levels
setting_datalabel_client_status          - Client relationship status
setting_datalabel_office_level           - Office hierarchy
setting_datalabel_business_level         - Business unit hierarchy
... (10 more)
```

### API Endpoints

**Entity CRUD:**
```
GET    /api/v1/{entity}           - List all (with pagination)
GET    /api/v1/{entity}/{id}      - Get single
POST   /api/v1/{entity}           - Create new
PUT    /api/v1/{entity}/{id}      - Update existing
DELETE /api/v1/{entity}/{id}      - Delete (soft)
```

**Parent-Child Filtering:**
```
GET /api/v1/{parent}/{parentId}/{child}
Examples:
  GET /api/v1/project/{uuid}/task     - Tasks for specific project
  GET /api/v1/business/{uuid}/project - Projects for specific business
```

**Linkage Management (v3.1):**
```
POST   /api/v1/linkage               - Create linkage
GET    /api/v1/linkage               - List linkages (with filters)
DELETE /api/v1/linkage/{id}          - Delete linkage (soft)
```

**Settings/Dropdown Options:**
```
GET /api/v1/setting?category={name}  - Get dropdown options
Examples:
  GET /api/v1/setting?category=task_stage
  GET /api/v1/setting?category=task_priority
```

### UI/UX Mapping

**URL Structure:**
```
/{entity}                  - EntityMainPage (list view)
/{entity}/new              - EntityCreatePage (create form)
/{entity}/{id}             - EntityDetailPage (detail + tabs)
/{entity}/{id}/{childType} - EntityChildListPage (filtered child list)
```

**Data Flow - Inline Create (v3.1):**
```
User Action: Click "Add Row" at /project/{id}/task
     ↓
FilteredDataTable adds empty row with temp ID
     ↓
User fills fields (name, priority, stage, dates)
     ↓
User clicks ✓ (save)
     ↓
POST /api/v1/task { name, priority, stage, start_date, end_date }
     ↓
Response: { id: "abc-123", name: "New Task", ... }
     ↓
POST /api/v1/linkage {
  parent_entity_type: "project",
  parent_entity_id: "{project-id}",
  child_entity_type: "task",
  child_entity_id: "abc-123",
  relationship_type: "contains"
}
     ↓
Response: { id: "xyz-789", success: true }
     ↓
FilteredDataTable reloads: GET /api/v1/project/{id}/task
     ↓
New task appears in table with linkage established
```

---

## 4. Central Configuration & Middleware

### Entity Configuration (Single Source of Truth)

**File:** `apps/web/src/lib/entityConfig.ts`

```typescript
export interface EntityConfig {
  name: string;                    // Internal identifier
  displayName: string;             // UI display name
  pluralName: string;              // Plural form
  apiEndpoint: string;             // API base path
  icon?: React.ComponentType;      // Lucide icon

  columns: ColumnDef[];            // Table columns (used everywhere)
  fields: FieldDef[];              // Form fields

  supportedViews: ViewMode[];      // ['table', 'kanban', 'grid']
  defaultView: ViewMode;           // Default view

  kanban?: {
    groupByField: string;
    settingsCategory?: string;
  };
}
```

**Usage Across System:**
- `EntityMainPage` - Uses `columns` for table, `supportedViews` for view toggle
- `EntityDetailPage` - Uses `fields` for overview tab
- `EntityCreatePage` - Uses `fields` for create form
- `FilteredDataTable` - Uses `columns` for table structure (v3.1: no modification)
- API calls - Uses `apiEndpoint` for all CRUD operations

### Field Capability Detection (Zero Configuration)

**File:** `apps/web/src/lib/data_transform_render.tsx`

**10-Rule System:**
1. System fields (id, timestamps) → readonly
2. Tags fields → text input (comma-separated)
3. File fields → drag-drop upload
4. Settings fields (loadOptionsFromSettings) → dropdown
5. Number fields (*_amt, *_count) → number input
6. Date fields (*_date, *_ts) → date picker
7. Explicit flags → respect configuration
8. Simple text fields (name, descr) → text input
9. Computed fields (parent_id, child_count) → readonly
10. **Default → text input** (enables universal Add Row)

**Impact:** Zero manual configuration, all fields editable unless explicitly readonly

### Settings Loader (Dropdown Population)

**File:** `apps/web/src/lib/settingsLoader.ts`

```typescript
// Auto-loads dropdown options from settings tables
export async function loadSettings(category: string) {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/setting?category=${category}`
  );
  return response.json();
}

// Usage in entity config
fields: [
  {
    key: 'task_stage',
    label: 'Stage',
    type: 'select',
    loadOptionsFromSettings: 'task_stage' // Auto-populates from DB
  }
]
```

### Authentication & RBAC Middleware

**API Middleware Chain:**
```typescript
// apps/api/src/modules/{entity}/routes.ts

fastify.get('/api/v1/task', {
  preHandler: [
    fastify.authenticate,          // JWT verification
    fastify.checkPermission('task', 0)  // RBAC check (0=view)
  ]
}, async (request, reply) => {
  // Handler
});
```

**Permission Levels:**
- 0 = View
- 1 = Edit
- 2 = Share
- 3 = Delete
- 4 = Create

---

## 5. User Interaction Flow Examples

### Flow 1: View Tasks for a Project

**User Journey:**
```
1. Navigate to /project/{id}
2. Click "Tasks" tab
   → URL: /project/{id}/task
3. See filtered task table
```

**Technical Flow:**
```
URL: /project/{id}/task
     ↓
React Router → EntityChildListPage
                props: { parentType: 'project', childType: 'task' }
     ↓
FilteredDataTable
  - columns = entityConfig.task.columns (NO modification)
  - API call: GET /api/v1/project/{id}/task
     ↓
Backend filters:
  SELECT t.* FROM d_task t
  JOIN d_entity_id_map m ON t.id = m.child_entity_id
  WHERE m.parent_entity_id = {id}
    AND m.parent_entity_type = 'project'
    AND m.child_entity_type = 'task'
    AND m.active_flag = true
     ↓
Returns: [{ id, name, task_stage, priority, ... }]
     ↓
Table renders with SAME columns as /task main view
```

### Flow 2: Create Task via "Add Row" (v3.1)

**User Journey:**
```
1. At /project/{id}/task
2. Scroll to table bottom
3. Click "Add Row" button
4. Fill in: name, stage, priority, dates
5. Click ✓ (checkmark)
6. Task created AND linked to project
```

**Technical Flow:**
```
User clicks "Add Row"
     ↓
FilteredDataTable.handleAddEntityRow()
  - Adds row: { id: 'temp_123', _isNew: true }
  - setIsAddingRow(true)
  - setEditingRow('temp_123')
     ↓
User edits fields inline
     ↓
User clicks ✓
     ↓
FilteredDataTable.handleSaveInlineEdit()
  - Detects isNewRow = true
  - Removes parent fields from payload
  - POST /api/v1/task { name, stage, priority, ... }
     ↓
API Response: { id: "abc-123", name: "New Task", ... }
     ↓
FilteredDataTable.handleSaveInlineEdit() continues
  - Detects parentType="project", parentId="{id}"
  - POST /api/v1/linkage {
      parent_entity_type: "project",
      parent_entity_id: "{id}",
      child_entity_type: "task",
      child_entity_id: "abc-123",
      relationship_type: "contains"
    }
     ↓
Linkage API Response: { id: "xyz-789", success: true, data: {...} }
     ↓
FilteredDataTable.handleSaveInlineEdit() completes
  - await fetchData() - Reloads table
  - setEditingRow(null)
  - setIsAddingRow(false)
     ↓
New task appears in table
Linkage exists in d_entity_id_map
```

### Flow 3: Edit Existing Task Inline

**User Journey:**
```
1. At /project/{id}/task
2. Click on task_stage cell
3. Select new stage from dropdown
4. Click ✓
5. Task updated
```

**Technical Flow:**
```
User clicks cell
     ↓
FilteredDataTable.handleInlineEdit()
  - setEditingRow(taskId)
  - setEditedData({ ...task, task_stage: currentStage })
     ↓
Cell renders as dropdown (detected via loadOptionsFromSettings)
  - Options loaded from setting_datalabel_task_stage
     ↓
User selects new value
     ↓
User clicks ✓
     ↓
FilteredDataTable.handleSaveInlineEdit()
  - Detects isNewRow = false
  - PUT /api/v1/task/{id} { task_stage: newStage }
     ↓
API updates database
     ↓
FilteredDataTable reloads
  - await fetchData()
     ↓
Updated task shows new stage with colored badge
```

---

## 6. Critical Considerations for Developers

### When Adding New Entity Type

1. **Add to entityConfig.ts** - Define columns, fields, views (~50 lines)
2. **Create DDL file** - `db/XX_d_{entity}.ddl` with table schema
3. **Create API module** - `apps/api/src/modules/{entity}/routes.ts`
4. **Add to App.tsx** - Include in `coreEntities` array for auto-routing
5. **Run db-import** - `./tools/db-import.sh` to apply schema
6. **Test** - All 3 pages work automatically

**That's it!** No page files needed, universal pages handle everything.

### When Adding Parent-Child Relationship

1. **Update DynamicChildEntityTabs.tsx** - Add to `entityConfig` map
2. **Or use API-driven tabs** - Add to `d_entity_map` table
3. **No code changes needed** - FilteredDataTable handles linkage automatically

### When Adding New Settings Category

1. **Create DDL** - `db/setting_datalabel_{name}.ddl`
2. **Register in settingsConfig.ts** - Add to `SETTINGS_REGISTRY`
3. **Use in entityConfig** - `loadOptionsFromSettings: '{name}'`
4. **Run db-import** - Schema and seed data applied

### Column Consistency Rules (v3.1)

**DO:**
- Define columns once in `entityConfig.ts`
- Let `FilteredDataTable` use columns directly
- Trust API to filter data based on parent context

**DON'T:**
- Modify columns based on `parentType` or `parentId`
- Add redundant parent ID columns
- Create context-specific column logic

### Inline Create Rules (v3.1)

**DO:**
- Remove `parent_type` and `parent_id` from entity payload
- Create linkage separately via `/api/v1/linkage`
- Handle linkage failures gracefully (warn user, don't fail entity creation)
- Verify linkage in console logs

**DON'T:**
- Send parent fields to entity creation endpoint
- Fail entire operation if linkage fails
- Skip linkage step in parent-child contexts

### Field Editability Rules (v3.1)

**DO:**
- Let `getFieldCapability()` auto-detect editability
- Add explicit readonly patterns if needed
- Trust the default (editable as text)

**DON'T:**
- Manually set `inlineEditable` flags in config
- Create restrictive defaults
- Hardcode field-specific rendering logic outside `data_transform_render.tsx`

---

## Change Log

### v3.1.0 (2025-11-04) - Current Production State

**Major Features:**
- Inline Create-Then-Link pattern
- Default-Editable pattern (10-rule system)
- Column Consistency pattern

**Files Modified:**
- `FilteredDataTable.tsx` - Added create-then-link logic, removed column modification
- `data_transform_render.tsx` - Changed default from readonly to editable
- `entityConfig.ts` - No changes needed (that's the point!)

**Database Impact:**
- `d_entity_id_map` - Now populated via inline "Add Row" functionality
- No schema changes required

**Benefits:**
- Seamless inline entity creation across all parent-child combinations
- Universal "Add Row" support with appropriate input types
- Consistent column sets regardless of navigation context
- 95%+ code reuse maintained

---

**For complete v3.1 details, see:** [Universal Entity System](./entity_design_pattern/universal_entity_system.md)

**For legacy v2.x architecture, see:** [entity_ui_ux_route_api.md](./entity_ui_ux_route_api.md)
