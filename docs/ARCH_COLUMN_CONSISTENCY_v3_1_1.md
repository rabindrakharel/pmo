# Column Consistency Pattern v3.1.1 - Technical Architecture

> **For LLM agents and staff architects** - Current state of context-independent column rendering in FilteredDataTable

**Version:** v3.1.1
**Date:** 2025-11-04
**Status:** ✅ Production
**Pattern:** Context-Independent Design, Single Source of Truth, DRY Architecture

---

## 1. Semantics & Business Context

### Core Principle

**Child entity tables display identical columns to their main entity counterparts.**

Parent context (project ID, business ID, etc.) is already explicit in the URL and breadcrumbs. Adding a redundant "Parent ID" column wastes screen space and creates inconsistent UX.

### Design Philosophy

```
URL: /task
Columns: [Name, Code, Stage, Priority, Hours, Assignees]

URL: /project/abc123/task  ← Parent context is HERE (URL)
Columns: [Name, Code, Stage, Priority, Hours, Assignees]  ← SAME columns
```

**Rationale:** The breadcrumb "Project > ABC-2024-001 > Tasks" already communicates the parent relationship. No need for redundant information in the table.

---

## 2. Architecture & DRY Design Patterns

### System Layers

```
┌─────────────────────────────────────────────────────────────┐
│                      entityConfig.ts                         │
│              (Single Source of Truth)                        │
├─────────────────────────────────────────────────────────────┤
│ task: {                                                      │
│   columns: [                                                 │
│     { key: 'name', title: 'Name' },                          │
│     { key: 'code', title: 'Code' },                          │
│     { key: 'dl__task_stage', title: 'Stage' },               │
│     // ... defined ONCE                                      │
│   ]                                                          │
│ }                                                            │
└──────────────────┬──────────────────────────────────────────┘
                   │ ← Used by ALL contexts
                   │
       ┌───────────┴───────────┐
       │                       │
       ▼                       ▼
┌──────────────┐      ┌────────────────┐
│ EntityMainPage│      │EntityChildListPage│
│   /task      │      │/project/{id}/task│
└──────┬───────┘      └────────┬─────────┘
       │                       │
       └───────┬───────────────┘
               │ Both use FilteredDataTable
               ▼
┌─────────────────────────────────────────┐
│        FilteredDataTable                │
├─────────────────────────────────────────┤
│ const columns = config.columns;         │
│ // No modification based on context     │
└─────────────────────────────────────────┘
```

### Code Implementation (Current State)

**File:** `apps/web/src/components/shared/dataTable/FilteredDataTable.tsx:71-79`

```typescript
// Use columns directly from config (same columns for main and child entity tables)
const columns: Column[] = useMemo(() => {
  if (!config) return [];

  // Return columns from entity config without modification
  // When viewing child entities (e.g., /project/{id}/task), we don't need
  // to show parent ID since it's already in the URL context
  return config.columns as Column[];
}, [config]);
```

**Key:** `config` dependency only - NOT dependent on `parentType` or `parentId`.

### API Endpoint Strategy

**File:** `apps/web/src/components/shared/dataTable/FilteredDataTable.tsx:135-141`

```typescript
let endpoint: string;

if (parentType && parentId) {
  // Use filtered endpoint for parent-child relationships
  endpoint = `/api/v1/${parentType}/${parentId}/${entityType}`;
} else {
  // Use regular list endpoint
  endpoint = config.apiEndpoint;
}
```

**Pattern:** Different URLs, same data structure.

---

## 3. Database, API & UI/UX Mapping

### API Endpoint Comparison Table

| Context | Navigation | API Endpoint | SQL Filter | Response Structure |
|---------|-----------|-------------|-----------|-------------------|
| **Main Entity** | `/task` | `GET /api/v1/task` | None | `{data: Task[], total, page, limit}` |
| **Child Entity** | `/project/abc/task` | `GET /api/v1/project/abc/task` | `WHERE linked to project=abc` | `{data: Task[], total, page, limit}` ✅ SAME |

### Response Structure (Identical)

```json
// Both endpoints return identical structure:
{
  "data": [
    {
      "id": "uuid",
      "code": "TASK-001",
      "name": "Task name",
      "dl__task_stage": "Planning",
      "dl__task_priority": "High",
      "estimated_hours": 5,
      "actual_hours": 3,
      "assignee_employee_ids": ["uuid1", "uuid2"],
      "created_ts": "2025-11-04T10:00:00Z",
      "updated_ts": "2025-11-04T12:00:00Z"
    }
  ],
  "total": 2,  // Different: filtered count
  "page": 1,
  "limit": 20
}
```

**Critical Insight:** Field structure is identical. Only `total` differs (filtered count vs all count).

### Column Rendering (Visual)

```
Main Entity View: /task
┌───────────┬──────────┬──────────┬──────────┬────────────┬────────────┐
│   Name    │   Code   │  Stage   │ Priority │  Est Hours │  Assignees │
├───────────┼──────────┼──────────┼──────────┼────────────┼────────────┤
│ Task A    │ T-001    │ Planning │ High     │    5h      │ John, Jane │
│ Task B    │ T-002    │ Done     │ Low      │    2h      │ Alice      │
│ Task C    │ T-003    │ In Prog  │ Medium   │    3h      │ Bob        │
└───────────┴──────────┴──────────┴──────────┴────────────┴────────────┘
Total: 8 tasks

Child Entity View: /project/abc123/task
┌───────────┬──────────┬──────────┬──────────┬────────────┬────────────┐
│   Name    │   Code   │  Stage   │ Priority │  Est Hours │  Assignees │ ← IDENTICAL HEADERS
├───────────┼──────────┼──────────┼──────────┼────────────┼────────────┤
│ Task A    │ T-001    │ Planning │ High     │    5h      │ John, Jane │
│ Task C    │ T-003    │ In Prog  │ Medium   │    3h      │ Bob        │
└───────────┴──────────┴──────────┴──────────┴────────────┴────────────┘
Total: 2 tasks (filtered)

No "Parent ID" column added ✅
```

---

## 4. Central Configuration & Middleware

### Entity Configuration Structure

**File:** `apps/web/src/lib/entityConfig.ts`

```typescript
export interface EntityConfig {
  name: string;
  displayName: string;
  pluralName: string;
  apiEndpoint: string;

  // ← THESE columns used in ALL contexts
  columns: ColumnDef[];

  fields: FieldDef[];
  supportedViews: ViewMode[];
  defaultView: ViewMode;
  // ... other metadata
}

// Example: Task entity
export const entityConfigs: Record<string, EntityConfig> = {
  task: {
    name: 'task',
    displayName: 'Task',
    apiEndpoint: '/api/v1/task',

    // These columns rendered in:
    // - /task (EntityMainPage)
    // - /project/{id}/task (EntityChildListPage)
    // - /employee/{id}/task (EntityChildListPage)
    // - /client/{id}/task (EntityChildListPage)
    // - ANY parent/{id}/task context
    columns: [
      { key: 'name', title: 'Task Name', sortable: true },
      { key: 'code', title: 'Code', sortable: true },
      { key: 'dl__task_stage', title: 'Stage', loadOptionsFromSettings: true },
      { key: 'dl__task_priority', title: 'Priority', loadOptionsFromSettings: true },
      { key: 'estimated_hours', title: 'Est. Hours', render: (v) => `${v}h` },
      { key: 'assignee_employee_ids', title: 'Assignees', render: renderEmployees }
    ]
  }
};
```

### FilteredDataTable Props Interface

```typescript
export interface FilteredDataTableProps {
  entityType: string;           // Required: Determines which config to load
  parentType?: string;          // Optional: Used ONLY for API filtering
  parentId?: string;            // Optional: Used ONLY for API filtering
  onRowClick?: (record: any) => void;

  // Action controls
  showActionButtons?: boolean;
  inlineEditable?: boolean;
  // ... other UI controls
}
```

**Key Insight:** `parentType` and `parentId` affect API calls but NOT column rendering.

---

## 5. User Interaction Flow Examples

### Flow 1: Navigate to Child Entity Tab

```
Step 1: User clicks "Tasks" tab on project detail page
URL: /project/abc123 → /project/abc123/task

Step 2: React Router renders EntityChildListPage
Props: { parentType: 'project', parentId: 'abc123', childType: 'task' }

Step 3: EntityChildListPage renders FilteredDataTable
<FilteredDataTable
  entityType="task"
  parentType="project"
  parentId="abc123"
/>

Step 4: FilteredDataTable loads config
const config = getEntityConfig('task');
const columns = config.columns;  // No modification!

Step 5: FilteredDataTable makes API call
GET /api/v1/project/abc123/task?page=1&limit=20

Step 6: API returns filtered tasks
{ data: [task1, task2], total: 2 }

Step 7: EntityDataTable renders
Columns: [Name, Code, Stage, Priority, Hours, Assignees] ← From config
Data: Only 2 tasks (filtered by project)

User sees: Identical columns to /task, but filtered data
```

### Flow 2: Inline Add Row in Child Entity

```
Step 1: User in /project/abc123/task clicks "+ Add Row"

Step 2: FilteredDataTable creates temp row
{ id: 'temp_1730739600', _isNew: true, ...emptyFields }

Step 3: User fills fields
Name: "New Task", Code: "T-009", Stage: "Backlog"

Step 4: User clicks Save (checkmark icon)

Step 5: FilteredDataTable transforms data
POST /api/v1/task
Body: {
  name: "New Task",
  code: "T-009",
  dl__task_stage: "Backlog",
  parent_type: "project",  // ← Auto-attached from props
  parent_id: "abc123"      // ← Auto-attached from props
}

Step 6: API creates task + linkage
- Creates task in d_task
- Creates linkage in d_entity_id_map
- Returns: { success: true, data: {...} }

Step 7: FilteredDataTable reloads
GET /api/v1/project/abc123/task  ← Filtered endpoint
Response: { data: [task1, task2, newTask], total: 3 }

Step 8: Table updates
New row appears with same columns as existing rows
```

---

## 6. Critical Considerations When Building

### Rule #1: Never Modify Columns Based on Context

```typescript
// ✅ CORRECT
const columns = config.columns;

// ❌ WRONG - Do not do this
const columns = useMemo(() => {
  const base = config.columns;
  if (parentType) {
    return [{ key: 'parent_id', title: 'Parent' }, ...base];
  }
  return base;
}, [config, parentType]);
```

### Rule #2: Use Parent Context Only for API Filtering

```typescript
// ✅ CORRECT - Different endpoints for filtering
const endpoint = parentType && parentId
  ? `/api/v1/${parentType}/${parentId}/${entityType}`
  : config.apiEndpoint;

// ❌ WRONG - Do not filter columns
const columns = parentType
  ? config.columns.filter(c => c.key !== 'parentInfo')
  : config.columns;
```

### Rule #3: Maintain Identical Response Structure

```typescript
// ✅ CORRECT - Both endpoints return same structure
GET /api/v1/task → { data: Task[], total, page, limit }
GET /api/v1/project/{id}/task → { data: Task[], total, page, limit }

// ❌ WRONG - Different structures
GET /api/v1/task → { data: Task[] }
GET /api/v1/project/{id}/task → { data: { parentInfo: {}, tasks: Task[] } }
```

### Rule #4: Parent Context Belongs in URL/Breadcrumbs

```
✅ CORRECT: Context in URL
URL: /project/abc123/task
Breadcrumb: Home > Projects > ABC-2024-001 > Tasks
Table: [Name | Code | Stage | Priority | Hours]

❌ WRONG: Context in table column
URL: /project/abc123/task
Table: [Parent ID | Name | Code | Stage | Priority | Hours]
         ↑ Redundant!
```

### Testing Verification Commands

```bash
# 1. Verify column count in browser DevTools
document.querySelectorAll('/task thead th').length
document.querySelectorAll('/project/abc/task thead th').length
# Should return SAME number

# 2. Compare API response structures
./tools/test-api.sh GET /api/v1/task | jq '.data[0] | keys | sort'
./tools/test-api.sh GET /api/v1/project/abc/task | jq '.data[0] | keys | sort'
# Should return IDENTICAL key arrays

# 3. Verify FilteredDataTable implementation
grep -A 10 "Use columns directly" apps/web/src/components/shared/dataTable/FilteredDataTable.tsx
# Should show: return config.columns as Column[];
```

### When Extending with New Entity Types

```typescript
// Step 1: Define columns ONCE in entityConfig.ts
myNewEntity: {
  name: 'myNewEntity',
  columns: [
    { key: 'name', title: 'Name' },
    { key: 'status', title: 'Status' }
  ]
}

// Step 2: That's it!
// FilteredDataTable automatically:
// - Renders /myNewEntity with these columns
// - Renders /parent/{id}/myNewEntity with SAME columns
// - Handles API filtering via different endpoints
// - Maintains column consistency across all contexts
```

### Common Anti-Patterns to Avoid

```typescript
// ❌ ANTI-PATTERN 1: Conditional columns
if (isChildView) {
  columns = [...config.columns, extraColumn];
}

// ❌ ANTI-PATTERN 2: Context-aware rendering
const render = (value, record) => {
  if (hasParent) return <ParentInfo {...record} />;
  return <span>{value}</span>;
};

// ❌ ANTI-PATTERN 3: Different configs
const config = isChildView
  ? getEntityConfig(`${entityType}_child`)
  : getEntityConfig(entityType);

// ✅ CORRECT PATTERN: Context-independent
const config = getEntityConfig(entityType);
const columns = config.columns;
```

---

## Documentation References

### Primary Documents (Updated for v3.1.1)

1. **[FilteredDataTable Architecture](./datatable/filtered_data_table_architecture.md)** ← NEW comprehensive guide
2. **[Entity UI/UX Architecture](./entity_ui_ux_route_api.md)** ← Updated with v3.1.1 notes
3. **[Universal Entity System](./entity_design_pattern/universal_entity_system.md)** ← Updated version to v3.1.1
4. **[DataTable System](./datatable/datatable.md)** ← Updated component hierarchy

### Code Locations

- **FilteredDataTable:** `apps/web/src/components/shared/dataTable/FilteredDataTable.tsx:71-79`
- **Entity Config:** `apps/web/src/lib/entityConfig.ts`
- **EntityMainPage:** `apps/web/src/pages/shared/EntityMainPage.tsx`
- **EntityChildListPage:** `apps/web/src/pages/shared/EntityChildListPage.tsx`

### Settings Source of Truth

- **Settings Documentation:** `/home/rabin/projects/pmo/docs/settings/settings.md`
- **Settings DDL:** `/home/rabin/projects/pmo/db/setting_datalabel.ddl`
- **Settings API:** `apps/api/src/modules/setting/routes.ts`

---

**For LLM Agents:** This document reflects the **current production state** as of 2025-11-04. Historical implementations are not documented - only the working system.

**Pattern Name:** Context-Independent Column Rendering
**Pattern Status:** ✅ Production
**Pattern Version:** v3.1.1
**Last Verified:** 2025-11-04
