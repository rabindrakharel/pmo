# Standardized Kanban System - Settings-Driven, DRY Architecture

> **Universal Kanban View** - No fallbacks, no hardcoded stages, single source of truth from unified settings table

---

## Overview

The PMO platform implements a **standardized, reusable Kanban system** that works for ANY entity with kanban configuration. All Kanban columns are loaded from the unified settings table (`setting_datalabel`) - **no hardcoded fallbacks**.

### Key Principles

✅ **DRY (Don't Repeat Yourself)** - Single implementation for all Kanban views
✅ **Settings-Driven** - All stages loaded from unified `setting_datalabel` table with JSONB metadata
✅ **No Fallbacks** - If settings fail, show error (prevents inconsistency)
✅ **Universal** - Works for tasks, projects, or any entity with Kanban config
✅ **Consistent** - Same columns across all views (main page, child lists)
✅ **Modern Naming** - Uses `dl__` prefix convention (e.g., `dl__task_stage`)

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                     useKanbanColumns Hook                    │
│  Loads stage settings from API → Creates Kanban columns     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                       KanbanView Component                   │
│  Universal Kanban renderer with loading/error states        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                       KanbanBoard Component                  │
│  Low-level drag-drop implementation                         │
└─────────────────────────────────────────────────────────────┘
```

### File Structure

```
apps/web/src/
├── lib/hooks/
│   └── useKanbanColumns.ts          ← Settings API loader + column builder
├── components/shared/ui/
│   ├── KanbanView.tsx               ← Universal Kanban view
│   ├── KanbanBoard.tsx              ← Drag-drop implementation
│   └── index.ts                     ← Exports
└── pages/shared/
    ├── EntityMainPage.tsx           ← Uses KanbanView (no custom logic)
    └── EntityChildListPage.tsx      ← Uses KanbanView (no custom logic)
```

---

## Implementation Details

### 1. useKanbanColumns Hook

**Location:** `apps/web/src/lib/hooks/useKanbanColumns.ts`

**Purpose:** Load stage configuration from settings API and build Kanban columns

**Key Features:**
- Extracts settings category from entity config
- Fetches from `/api/v1/setting?category={category}`
- Maps API response to Kanban column format
- Sorts columns by `sort_order` from settings
- Groups data items by stage value
- **NO fallbacks** - returns empty array if settings fail

**Usage:**
```typescript
const { columns, loading, error } = useKanbanColumns(config, data);
```

**API Flow:**
```typescript
// 1. Extract datalabel from entity config
config.kanban.metaTable = 'dl__task_stage'        // Consistent dl__ prefix
config.kanban.groupByField = 'dl__task_stage'     // Consistent dl__ prefix

// 2. Fetch settings from unified table
GET /api/v1/setting?datalabel=dl__task_stage

// 3. API queries setting_datalabel table
// Looks for: datalabel_name = 'dl__task_stage'
// Expands JSONB metadata array using WITH ORDINALITY to preserve order

// 4. API returns
{
  data: [
    { id: "0", name: "Backlog", descr: "", parent_id: null, color_code: "gray", position: 0 },
    { id: "1", name: "To Do", descr: "", parent_id: null, color_code: "blue", position: 1 },
    { id: "2", name: "In Progress", descr: "", parent_id: null, color_code: "orange", position: 2 },
    ...
  ],
  datalabel: "dl__task_stage"
}

// 5. Create Kanban columns
[
  { id: "Backlog", title: "Backlog", color: "#6B7280", items: [...] },
  { id: "To Do", title: "To Do", color: "#3B82F6", items: [...] },
  { id: "In Progress", title: "In Progress", color: "#F59E0B", items: [...] },
  ...
]
```

**Stage Color Mapping:**
```typescript
const STAGE_COLORS = {
  'Backlog': '#6B7280',      // Gray
  'To Do': '#3B82F6',        // Blue
  'In Progress': '#F59E0B',  // Orange
  'In Review': '#8B5CF6',    // Purple
  'Done': '#10B981',         // Green
  'Blocked': '#EF4444',      // Red
  'Cancelled': '#9CA3AF'     // Light Gray
};
```

### 2. KanbanView Component

**Location:** `apps/web/src/components/shared/ui/KanbanView.tsx`

**Purpose:** Universal, reusable Kanban renderer

**Props:**
```typescript
interface KanbanViewProps {
  config: EntityConfig;           // Entity configuration
  data: any[];                    // Items to display
  onCardClick?: (item) => void;   // Click handler
  onCardMove?: (id, from, to) => void;  // Drag-drop handler
  renderCard?: (item) => ReactNode;     // Custom card renderer
  emptyMessage?: string;          // Custom empty state
}
```

**States:**

1. **Loading State:**
   ```
   ┌────────────────────────────┐
   │   🔄 Loading Spinner        │
   │   "Loading Kanban          │
   │    configuration..."       │
   └────────────────────────────┘
   ```

2. **Error State (NO FALLBACK):**
   ```
   ┌────────────────────────────┐
   │   ❌ Error Message          │
   │   "Failed to load Kanban   │
   │    configuration"          │
   │                            │
   │   [Error details]          │
   │                            │
   │   "Please ensure stage     │
   │    settings are            │
   │    configured..."          │
   └────────────────────────────┘
   ```

3. **Empty Columns State:**
   ```
   ┌────────────────────────────┐
   │   ⚠️  No stages configured  │
   │   "Configure stage         │
   │    settings to enable      │
   │    Kanban view"            │
   └────────────────────────────┘
   ```

4. **Success State:**
   ```
   ┌──────────┬──────────┬──────────┬──────────┐
   │ Backlog  │  To Do   │In Progress│   Done   │
   │    3     │    5     │     8     │    12    │
   ├──────────┼──────────┼──────────┼──────────┤
   │ [Card 1] │ [Card A] │ [Card X] │ [Card M] │
   │ [Card 2] │ [Card B] │ [Card Y] │ [Card N] │
   │ [Card 3] │ [Card C] │          │          │
   └──────────┴──────────┴──────────┴──────────┘
   ```

**Usage:**
```typescript
// In EntityMainPage or EntityChildListPage
<KanbanView
  config={config}
  data={data}
  onCardClick={(task) => navigate(`/task/${task.id}`)}
  onCardMove={(taskId, fromStage, toStage) =>
    updateTask(taskId, { stage: toStage })
  }
/>
```

### 3. Page Integration

**EntityMainPage** (`apps/web/src/pages/shared/EntityMainPage.tsx`)

**Before (Hardcoded):**
```typescript
// ❌ OLD: Hardcoded stages with fallback
const kanbanColumns = useMemo(() => {
  const uniqueValues = [...new Set(data.map(item => item.stage))];
  const commonStages = [
    { id: 'Backlog', title: 'Backlog', color: '#6B7280' },
    // ... hardcoded stages
  ];
  const stages = uniqueValues.length > 0 ? uniqueValues : commonStages;
  // ...
}, [data]);

<KanbanBoard columns={kanbanColumns} ... />
```

**After (Settings-Driven):**
```typescript
// ✅ NEW: Settings-driven, no fallback
<KanbanView
  config={config}
  data={data}
  onCardClick={handleRowClick}
  onCardMove={handleCardMove}
/>
```

**Benefits:**
- ✅ Removed 30+ lines of duplicated code
- ✅ No more hardcoded stage definitions
- ✅ Automatically uses correct settings category
- ✅ Consistent across all entity types

---

## Settings API Configuration

### Entity Config → Settings Category Mapping

**How category is determined:**

```typescript
// Entity config with consistent dl__ prefix convention
entityConfigs.task.kanban = {
  groupByField: 'dl__task_stage',     // Field name in entity records (with dl__ prefix)
  metaTable: 'dl__task_stage',        // Settings category (with dl__ prefix - CONSISTENT!)
  cardFields: ['name', 'dl__task_priority']
}

// The hook extracts metaTable and uses it for API call:
// metaTable: 'dl__task_stage' → GET /api/v1/setting?datalabel=dl__task_stage
```

### Settings Table Structure

**Unified Settings Table:** `app.setting_datalabel`

All settings are now stored in a unified JSONB-based table with the following structure:

```sql
CREATE TABLE app.setting_datalabel (
    datalabel_name varchar(100) PRIMARY KEY,  -- e.g., 'dl__task_stage' (with dl__ prefix)
    ui_label text,                           -- Human-readable label (e.g., 'Task Stage')
    ui_icon text,                            -- Icon name (optional)
    metadata jsonb NOT NULL                  -- Array of setting items
);
```

**JSONB Metadata Structure:**
```json
[
  {
    "id": 0,
    "name": "Backlog",
    "descr": "Tasks awaiting prioritization",
    "parent_id": null,
    "color_code": "gray"
  },
  {
    "id": 1,
    "name": "To Do",
    "descr": "Ready to start",
    "parent_id": null,
    "color_code": "blue"
  },
  {
    "id": 2,
    "name": "In Progress",
    "descr": "Currently being worked on",
    "parent_id": null,
    "color_code": "orange"
  }
]
```

**Key Points:**
- **Consistent naming**: ALL references use `dl__` prefix (e.g., `dl__task_stage`)
- **Database**: `datalabel_name = 'dl__task_stage'`
- **API parameter**: `?datalabel=dl__task_stage`
- **Entity config**: `metaTable: 'dl__task_stage'` and `groupByField: 'dl__task_stage'`
- **Position tracking**: Array order defines display order; `position` field in response derived from array index
- **ID system**: IDs are integers (0-based) matching array positions

### API Response Format

```bash
GET /api/v1/setting?datalabel=dl__task_stage
```

**Response:**
```json
{
  "data": [
    {
      "id": "0",
      "name": "Backlog",
      "descr": "Tasks awaiting prioritization",
      "parent_id": null,
      "color_code": "gray",
      "position": 0
    },
    {
      "id": "1",
      "name": "To Do",
      "descr": "Ready to start",
      "parent_id": null,
      "color_code": "blue",
      "position": 1
    },
    {
      "id": "2",
      "name": "In Progress",
      "descr": "Currently being worked on",
      "parent_id": null,
      "color_code": "orange",
      "position": 2
    },
    {
      "id": "3",
      "name": "In Review",
      "descr": "Awaiting review",
      "parent_id": null,
      "color_code": "purple",
      "position": 3
    },
    {
      "id": "4",
      "name": "Blocked",
      "descr": "Cannot proceed",
      "parent_id": null,
      "color_code": "red",
      "position": 4
    },
    {
      "id": "5",
      "name": "Done",
      "descr": "Completed",
      "parent_id": null,
      "color_code": "green",
      "position": 5
    },
    {
      "id": "6",
      "name": "Cancelled",
      "descr": "Cancelled or abandoned",
      "parent_id": null,
      "color_code": "gray",
      "position": 6
    }
  ],
  "datalabel": "dl__task_stage"
}
```

**Notes:**
- `position` is derived from array index (WITH ORDINALITY in SQL)
- `id` is a string representation of the array position
- `color_code` values are used to map to hex colors in the UI
- Response includes actual `datalabel_name` from database (`dl__task_stage`)

---

## Benefits of Standardized System

### 1. Consistency Across All Views

**Before:**
```
/task                     → 3 columns (only stages with data)
/office/{id}/task         → 6 columns (hardcoded fallback)
/project/{id}/task        → Different columns (data-dependent)
```

**After:**
```
/task                     → 7 columns (all from settings)
/office/{id}/task         → 7 columns (all from settings)
/project/{id}/task        → 7 columns (all from settings)
```

### 2. Business User Control

Business users can now:
- Add new stages via settings UI
- Change stage names and colors
- Reorder stages
- Enable/disable stages

**Changes immediately reflect in all Kanban views after refresh.**

### 3. Code Reduction

**Lines of code removed:**
- EntityMainPage: 30 lines
- EntityChildListPage: 30 lines
- Total: **60 lines of duplicated code eliminated**

**Lines of code added:**
- useKanbanColumns hook: 120 lines
- KanbanView component: 120 lines
- Total: **240 lines of reusable code**

**Net benefit:** Removed duplication, added one universal implementation

### 4. Error Transparency

**Before:**
```
Settings API fails → Show hardcoded fallback → User doesn't know there's a problem
```

**After:**
```
Settings API fails → Show clear error → User/admin can fix configuration
```

### 5. Future-Proof

Adding Kanban view to new entities:

**Before:**
```typescript
// Copy 30+ lines of kanban logic
// Update hardcoded stages
// Hope it matches other views
```

**After:**
```typescript
// 1. Add settings entry to setting_datalabel table
INSERT INTO app.setting_datalabel (datalabel_name, ui_label, metadata)
VALUES (
  'dl__new_entity_status',
  'New Entity Status',
  '[
    {"id": 0, "name": "New", "descr": "", "parent_id": null, "color_code": "blue"},
    {"id": 1, "name": "Active", "descr": "", "parent_id": null, "color_code": "green"},
    {"id": 2, "name": "Complete", "descr": "", "parent_id": null, "color_code": "gray"}
  ]'::jsonb
);

// 2. Update entityConfig.ts
entityConfigs.newEntity.kanban = {
  groupByField: 'dl__new_entity_status',  // Consistent dl__ prefix
  metaTable: 'dl__new_entity_status',     // Consistent dl__ prefix
  cardFields: ['name', 'priority']
};

// 3. Use in page component (no changes needed!)
<KanbanView config={config} data={data} ... />
```

---

## Usage Examples

### Example 1: Task Kanban in Main Page

```typescript
// Route: /task
<EntityMainPage entityType="task" />

// Entity config:
entityConfigs.task.kanban = {
  groupByField: 'dl__task_stage',
  metaTable: 'dl__task_stage',  // Consistent dl__ prefix
  cardFields: ['name', 'dl__task_priority', 'estimated_hours', 'assignee_employee_ids']
}

// Automatically:
// 1. Loads config.kanban.metaTable = 'dl__task_stage'
// 2. Fetches GET /api/v1/setting?datalabel=dl__task_stage
// 3. API queries WHERE datalabel_name = 'dl__task_stage'
// 4. Creates 7 columns (Backlog, To Do, In Progress, In Review, Blocked, Done, Cancelled)
// 5. Groups tasks by 'dl__task_stage' field
// 6. Allows drag-drop to update task.dl__task_stage
```

### Example 2: Task Kanban Under Project

```typescript
// Route: /project/93106ffb.../task
<EntityChildListPage parentType="project" childType="task" />

// Same behavior as Example 1
// Shows ALL 7 stages (even if project has 0 tasks)
```

### Example 3: Task Kanban Under Office

```typescript
// Route: /office/55555555.../task
<EntityChildListPage parentType="office" childType="task" />

// Even with 0 tasks linked to office:
// Shows all 7 configured stages
// Users can drag-drop tasks into any stage
```

### Example 4: Custom Entity Kanban

```typescript
// 1. Create settings in database
INSERT INTO app.setting_datalabel (datalabel_name, ui_label, metadata)
VALUES (
  'dl__opportunity_funnel_stage',
  'Opportunity Funnel Stage',
  '[
    {"id": 0, "name": "Lead", "descr": "Initial contact", "parent_id": null, "color_code": "gray"},
    {"id": 1, "name": "Qualified", "descr": "Qualified prospect", "parent_id": null, "color_code": "blue"},
    {"id": 2, "name": "Proposal", "descr": "Proposal sent", "parent_id": null, "color_code": "purple"},
    {"id": 3, "name": "Negotiation", "descr": "In negotiation", "parent_id": null, "color_code": "orange"},
    {"id": 4, "name": "Closed Won", "descr": "Deal won", "parent_id": null, "color_code": "green"},
    {"id": 5, "name": "Closed Lost", "descr": "Deal lost", "parent_id": null, "color_code": "red"}
  ]'::jsonb
);

// 2. Add Kanban to entity config
entityConfigs.opportunity = {
  name: 'opportunity',
  displayName: 'Opportunity',
  pluralName: 'Opportunities',
  apiEndpoint: '/api/v1/opportunity',
  // ... other config
  supportedViews: ['table', 'kanban'],
  defaultView: 'table',
  kanban: {
    groupByField: 'dl__opportunity_funnel_stage',  // Consistent dl__ prefix
    metaTable: 'dl__opportunity_funnel_stage',     // Consistent dl__ prefix
    cardFields: ['name', 'value', 'probability']
  }
};

// 3. Use in page (works automatically!)
<KanbanView config={opportunityConfig} data={opportunities} ... />

// Automatically loads from dl__opportunity_funnel_stage settings
```

---

## Error Handling

### Scenario 1: Settings API Error

**Trigger:** Settings API returns 500 error

**Display:**
```
┌────────────────────────────────────────────────┐
│ ❌ Failed to load Kanban configuration         │
│                                                │
│ Failed to load stage settings: task_stage     │
│                                                │
│ Please ensure stage settings are configured   │
│ for this entity. Contact your system          │
│ administrator if the problem persists.        │
└────────────────────────────────────────────────┘
```

**Resolution:** Admin checks settings table and API endpoint

### Scenario 2: Empty Settings Response

**Trigger:** Settings API returns `{ data: [] }`

**Display:**
```
┌────────────────────────────────────────────────┐
│ ⚠️  No Kanban stages configured                │
│                                                │
│ Configure stage settings to enable Kanban     │
│ view for Tasks.                                │
└────────────────────────────────────────────────┘
```

**Resolution:** Admin adds records to `setting_datalabel_task_stage`

### Scenario 3: Missing Entity Config

**Trigger:** `config.kanban` is undefined

**Display:**
```
┌────────────────────────────────────────────────┐
│ ℹ️  Kanban view not supported                  │
│                                                │
│ This entity does not support Kanban view.     │
│ Use table or grid view instead.               │
└────────────────────────────────────────────────┘
```

**Resolution:** Add `kanban` configuration to entity config

---

## Testing Guide

### Test 1: Main Task Kanban

```bash
# 1. Navigate to tasks
http://localhost:5173/task

# 2. Switch to Kanban view
Click "Kanban" in view switcher

# Expected:
✅ Shows 7 columns: Backlog, To Do, In Progress, In Review, Blocked, Done, Cancelled
✅ All columns visible even if some are empty
✅ Tasks grouped correctly by stage
✅ Can drag tasks between columns
✅ Column counts show correct numbers
```

### Test 2: Office Task Kanban (Empty)

```bash
# 1. Navigate to office tasks
http://localhost:5173/office/55555555-5555-5555-5555-555555555555/task

# 2. Switch to Kanban view
Click "Kanban" in view switcher

# Expected:
✅ Shows 7 columns (same as main view)
✅ All columns show "No items"
✅ Columns in same order
✅ Same colors
✅ Can create tasks and drag into any column
```

### Test 3: Project Task Kanban

```bash
# 1. Navigate to project tasks
http://localhost:5173/project/93106ffb-402e-43a7-8b26-5287e37a1b0e/task

# 2. Switch to Kanban view

# Expected:
✅ Shows 7 columns
✅ Only tasks for this project
✅ Same column configuration as other views
```

### Test 4: Settings Change Propagation

```bash
# 1. Update settings in unified table
# Find and update the item in the JSONB array
UPDATE app.setting_datalabel
SET metadata = jsonb_set(
  metadata,
  '{1,name}',
  '"Ready to Start"'
)
WHERE datalabel_name = 'dl__task_stage';

# Or use the API:
PUT /api/v1/setting/dl__task_stage/1
{
  "name": "Ready to Start"
}

# 2. Refresh any Kanban view
http://localhost:5173/task

# Expected:
✅ Column renamed to "Ready to Start"
✅ Change appears in ALL Kanban views
✅ Order preserved (still position 1)
```

### Test 5: Error Handling

```bash
# 1. Break settings API (temporarily)
# Stop API or modify table name

# 2. Try to load Kanban view

# Expected:
✅ Error message displayed
✅ Clear explanation of problem
✅ NO hardcoded fallback
✅ Guidance for resolution
```

---

## Migration Notes

### Files Changed

**Removed:**
- Hardcoded stage arrays in EntityMainPage (lines 119-126)
- Hardcoded stage arrays in EntityChildListPage (lines 244-251)
- Kanban column generation logic (both files)

**Added:**
- `apps/web/src/lib/hooks/useKanbanColumns.ts` (new)
- `apps/web/src/components/shared/ui/KanbanView.tsx` (new)
- `apps/web/src/components/shared/ui/index.ts` (updated exports)

**Updated:**
- `apps/web/src/pages/shared/EntityMainPage.tsx`
- `apps/web/src/pages/shared/EntityChildListPage.tsx`

### Breaking Changes

**None!** This is a backwards-compatible enhancement.

Existing functionality:
- ✅ Drag-drop still works
- ✅ Card rendering unchanged
- ✅ Click handlers preserved
- ✅ View switching intact

New behavior:
- ✅ Columns now load from settings API
- ✅ Empty views show all configured columns
- ✅ Errors display instead of silent fallback

---

## Future Enhancements

### 1. Stage Color Customization

Add `color_code` column to all `setting_datalabel_*` tables:

```sql
ALTER TABLE app.setting_datalabel_task_stage
ADD COLUMN color_code varchar(7);

UPDATE app.setting_datalabel_task_stage SET color_code = '#3B82F6' WHERE level_name = 'To Do';
```

### 2. Kanban Swimlanes

Group Kanban by multiple dimensions:

```typescript
kanban: {
  groupByField: 'stage',
  swimlaneField: 'priority_level',  // NEW
  metaTable: 'setting_datalabel_task_stage'
}
```

### 3. Settings UI

Build admin UI to manage stage settings:
- Add/edit/delete stages
- Reorder via drag-drop
- Change colors with color picker
- Toggle active/inactive

### 4. Kanban Filters

Filter Kanban cards by criteria:

```typescript
<KanbanView
  config={config}
  data={data}
  filters={{
    assignee: userId,
    priority: 'high'
  }}
/>
```

---

## Summary

**The standardized Kanban system achieves:**

✅ **Single implementation** for all Kanban views
✅ **Settings-driven** columns with no hardcoded stages
✅ **Consistent UX** across all entity contexts
✅ **Business user control** via unified settings table
✅ **Error transparency** instead of silent fallbacks
✅ **60 lines of duplicated code eliminated**
✅ **Future-proof** for new entities
✅ **Consistent naming** - `dl__` prefix used everywhere

**Key Files:**
- `useKanbanColumns.ts` - Settings loader + column builder
- `KanbanView.tsx` - Universal Kanban renderer
- `EntityMainPage.tsx` - Uses KanbanView
- `EntityChildListPage.tsx` - Uses KanbanView
- `entityConfig.ts` - Entity configuration with `dl__` prefixed metaTable
- `routes.ts` - Settings API with `dl__` prefix handling

**Critical Naming Convention:**
- ✅ **Entity config**: `metaTable: 'dl__task_stage'`
- ✅ **Entity config**: `groupByField: 'dl__task_stage'`
- ✅ **API call**: `GET /api/v1/setting?datalabel=dl__task_stage`
- ✅ **Database**: `datalabel_name = 'dl__task_stage'`
- ✅ **Entity record field**: `task.dl__task_stage`

**Consistency Rule:** The `dl__` prefix is used in ALL locations - no exceptions, no variations. This ensures perfect alignment across the entire stack from database to UI.

**Result:** One true Kanban implementation that adapts to any entity with kanban configuration, using consistent `dl__` prefixed naming throughout the entire system.
