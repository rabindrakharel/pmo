# Data Table Architecture - Complete Guide

> **Comprehensive documentation for the PMO DataTable system**
> OOP-style composition pattern with database-driven configuration

---

## 1. Semantics & Business Context

### Overview

The PMO DataTable architecture implements an **OOP-style composition pattern** in React using two specialized components optimized for different use cases:

1. **EntityDataTable** - Full-featured table for dynamic entity data (projects, tasks, clients, etc.)
2. **SettingsDataTable** - Lightweight table for fixed-schema settings/datalabel management

Both components share a unified **database-driven color and formatting system** where ALL visual styling comes from the database via API—nothing is hardcoded.

### Business Value

| Component | Business Purpose | Use Cases |
|-----------|------------------|-----------|
| **EntityDataTable** | Manage operational entities with complex filtering, search, and RBAC | All 13 core entities: projects, tasks, clients, employees, offices, businesses, worksites, roles, positions, artifacts, wiki, forms, reports |
| **SettingsDataTable** | Configure platform dropdowns, workflows, and hierarchies | All 16 settings categories: project_stage, task_priority, customer_tier, opportunity_funnel_stage, etc. |

### Key Design Principle

**Database as Single Source of Truth:**
- Colors come from `app.setting_datalabel.metadata[].color_code`
- Formats based on field naming conventions (auto-detection)
- Dropdown options loaded from settings API
- No hardcoded visual configuration in frontend code

---

## 2. Architecture, Block Diagrams & DRY Design Patterns

### Component Hierarchy (OOP-Style Composition)

```
┌─────────────────────────────────────────────────────────────────┐
│                   DATA TABLE ARCHITECTURE                        │
│            (Composition-Based "OOP" Pattern in React)            │
└─────────────────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────────────────┐
    │         SHARED UTILITIES (Reusable Patterns)             │
    ├──────────────────────────────────────────────────────────┤
    │  • ColoredDropdown.tsx      - Inline edit dropdown       │
    │  • data_transform_render.ts - COLOR_MAP, badge rendering │
    │  • settingsLoader.ts        - API caching, options       │
    │  • settingsService.ts       - CRUD service layer         │
    │  • settingsConfig.ts        - Color badge renderer       │
    └──────────────────────────────────────────────────────────┘
                              ↑  ↑
                              │  │
                    ┌─────────┘  └─────────┐
                    │                      │
    ┌───────────────────────┐  ┌───────────────────────┐
    │  SettingsDataTable    │  │  EntityDataTable      │
    │  (Specialized)        │  │  (Specialized)        │
    ├───────────────────────┤  ├───────────────────────┤
    │ • 600 LOC, 12 KB      │  │ • 1540 LOC, 45 KB     │
    │ • Fixed 5-col schema  │  │ • Dynamic columns     │
    │ • Array ordering      │  │ • Capability detect   │
    │ • Simple editing      │  │ • Complex filtering   │
    │ • Drag & drop         │  │ • Settings loading    │
    │ • Color badges        │  │ • File uploads        │
    │ • No pagination       │  │ • Pagination          │
    │ • Small datasets      │  │ • Large datasets      │
    └───────────────────────┘  └───────────────────────┘
           ↑                              ↑
           │                              │
  Used by Settings Pages        Used by Entity Pages
  /setting/projectStage         /project, /task, /client
```

### Why Composition Over Inheritance?

**Traditional OOP (Classes):**
```typescript
// ❌ Not idiomatic in React
class DataTableBase extends Component {
  render() { /* base rendering */ }
}

class EntityDataTable extends DataTableBase {
  render() { /* entity-specific rendering */ }
}
```

**React Composition (Hooks + Components):**
```typescript
// ✅ Idiomatic React pattern
function EntityDataTable() {
  // Shared utilities via imports
  const renderBadge = renderSettingBadge;
  const colors = await loadSettingsColors('project_stage');

  // Component-specific logic
  const capabilities = detectColumnCapabilities(columns);

  return <table>...</table>;
}
```

**Benefits:**
- ✅ Better TypeScript support
- ✅ Easier testing (utilities can be tested independently)
- ✅ More flexible (can mix multiple utilities)
- ✅ Follows React best practices
- ✅ No "this" context issues
- ✅ Tree-shakable imports

### Comparison: EntityDataTable vs SettingsDataTable

| Feature | EntityDataTable | SettingsDataTable |
|---------|-----------------|-------------------|
| **Lines of Code** | ~1540 | ~600 |
| **Bundle Size** | 45 KB | 12 KB (73% smaller) |
| **Schema** | Dynamic (any columns) | Fixed (5 columns) |
| **Complexity** | High (full-featured) | Low (focused) |
| **Sorting** | Advanced (multiple fields) | Simple (disabled when reordering) |
| **Filtering** | Multi-column with chips | None (not needed) |
| **Pagination** | Full pagination | None (small datasets) |
| **Column Detection** | Auto-detect capabilities | Fixed schema |
| **Settings Loading** | Auto-load from API | Uses COLOR_OPTIONS |
| **File Uploads** | Yes (InlineFileUploadCell) | No |
| **Ordering** | Standard ID-based | Array position-based |
| **Drag & Drop** | Optional | Yes (array reordering) |
| **Use Case** | Entity CRUD operations | Settings/datalabel management |
| **Typical Data Size** | 100-1000+ rows | 5-20 rows |

### Why Keep Two Separate Components?

**Decision:** Keep `SettingsDataTable` and `EntityDataTable` as separate components instead of forcing them into a single universal component.

**Reasons:**

1. **Different Use Cases**
   - Settings: Fixed schema, small datasets, array ordering
   - Entities: Dynamic schema, large datasets, complex filtering

2. **Performance**
   - SettingsDataTable is 73% smaller (600 vs 1540 LOC)
   - No unnecessary capability detection for fixed schemas
   - No pagination overhead for small datasets

3. **Maintainability**
   - Easier to understand (single responsibility)
   - Changes to entity logic don't affect settings
   - Simpler testing

4. **Type Safety**
   - SettingsDataTable: Strongly typed 5-field schema
   - EntityDataTable: Generic T with dynamic columns

---

## 3. Database, API & UI/UX Mapping

### Database-Driven Color & Formatting System (5-Layer Architecture)

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1: DATABASE (Single Source of Truth)                      │
│ Table: app.setting_datalabel                                    │
│ ┌──────────────┬────────────┬─────────────────────────────────┐ │
│ │ datalabel_   │ ui_label   │ metadata (JSONB array)          │ │
│ │ name         │            │                                 │ │
│ ├──────────────┼────────────┼─────────────────────────────────┤ │
│ │ project__    │ Project    │ [{                              │ │
│ │ stage        │ Stages     │   "id": 1,                      │ │
│ │              │            │   "name": "Planning",           │ │
│ │              │            │   "descr": "...",               │ │
│ │              │            │   "parent_id": 0,               │ │
│ │              │            │   "color_code": "purple" ← DB!  │ │
│ │              │            │ }, ...]                         │ │
│ └──────────────┴────────────┴─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 2: BACKEND API (JSONB Extraction)                         │
│ Route: /api/v1/setting?datalabel=project_stage                 │
│                                                                 │
│ SQL Query:                                                      │
│   SELECT                                                        │
│     (elem->>'id')::text as id,                                 │
│     elem->>'name' as name,                                     │
│     elem->>'color_code' as color_code  ← Extract from JSONB    │
│   FROM app.setting_datalabel,                                  │
│        jsonb_array_elements(metadata) as elem                  │
│   WHERE datalabel_name = 'project__stage'                      │
│                                                                 │
│ Response JSON:                                                  │
│ {                                                               │
│   "data": [                                                     │
│     { "id": "1", "name": "Planning", "color_code": "purple" }  │
│   ]                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 3: FRONTEND MIDDLEWARE (Caching & Transformation)         │
│ File: /apps/web/src/lib/settingsLoader.ts                      │
│                                                                 │
│ loadSettingOptions(datalabel):                                  │
│   • Fetches from API                                           │
│   • Caches for 5 minutes to reduce API calls                   │
│   • Transforms to SettingOption[] with metadata                 │
│                                                                 │
│ Returns:                                                        │
│ [                                                               │
│   {                                                             │
│     value: 'Planning',                                          │
│     label: 'Planning',                                          │
│     colorClass: 'bg-purple-100 text-purple-800',               │
│     metadata: { color_code: 'purple' }                          │
│   }                                                             │
│ ]                                                               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 4: FRONTEND RENDERING (COLOR_MAP & Badge Rendering)       │
│ File: /apps/web/src/lib/data_transform_render.tsx              │
│                                                                 │
│ COLOR_MAP (Master Tailwind Mapping):                            │
│ {                                                               │
│   'purple': 'bg-purple-100 text-purple-800 border-purple-200', │
│   'blue': 'bg-blue-100 text-blue-800 border-blue-200',        │
│   ... (10 colors total)                                        │
│ }                                                               │
│                                                                 │
│ Functions:                                                      │
│   loadSettingsColors(datalabel)  → Preload into cache          │
│   getSettingColor(datalabel, value) → O(1) cache lookup        │
│   renderSettingBadge(colorCode, label) → JSX badge             │
│                                                                 │
│ Color Cache:                                                    │
│   Map<datalabel, Map<value, color_code>>                       │
│   Example: ('project_stage' → ('Planning' → 'purple'))         │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 5: UI RENDERING (Components)                              │
│ EntityDataTable & SettingsDataTable                             │
│                                                                 │
│ EntityDataTable:                                                │
│   render: (value) => renderSettingBadge(value, {               │
│     datalabel: 'project_stage'                                  │
│   })                                                            │
│                                                                 │
│ SettingsDataTable:                                              │
│   renderColorBadge(record.color_code, record.name)              │
│                                                                 │
│ Final HTML:                                                     │
│   <span class="inline-flex items-center rounded-full           │
│                font-medium bg-purple-100 text-purple-800       │
│                border border-purple-200 px-2.5 py-0.5 text-xs">│
│     Planning                                                    │
│   </span>                                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Auto-Detection Conventions

Both components use naming conventions to automatically detect field types:

| Pattern | Detected Type | Auto-Features | Example |
|---------|---------------|---------------|---------|
| `*_amt`, `*_amount`, `*_cost`, `*_price` | Currency | $, right-align, formatting | `budget_allocated_amt` → `$250,000.00` |
| `*_date`, `date_*` | Date | Date formatting | `start_date` → `Mar 15, 2025` |
| `*_ts` | Timestamp | DateTime formatting | `created_ts` → `Jan 23, 2025 2:30 PM` |
| `*_stage`, `*_status`, `*_priority` | Settings | Badge, dropdown, colors | `project_stage` → Purple badge |
| `*_level`, `*_tier` | Settings | Badge, dropdown, colors | `customer_tier` → Amber badge |
| `tags`, `*_tags` | Tags Array | Inline tag editing | `project_tags` → Tag chips |

### EntityDataTable Schema

```typescript
interface Column<T = any> {
  key: string;                           // Field key
  title: string;                         // Column header
  sortable?: boolean;                    // Enable sorting
  filterable?: boolean;                  // Enable filtering
  render?: (value: any, record: T) => React.ReactNode;
  width?: string | number;               // Column width
  align?: 'left' | 'center' | 'right';  // Text alignment
  editable?: boolean;                    // Manual editable flag
  editType?: 'text' | 'select' | 'number' | 'date';
  loadOptionsFromSettings?: boolean;     // Auto-load dropdown options
  options?: SettingOption[];             // Static options
  inlineEditable?: boolean;              // Enable inline editing
}
```

### SettingsDataTable Schema (Fixed)

```typescript
interface SettingsRecord {
  id: string | number;        // Auto-generated ID (non-editable)
  name: string;               // Display name (editable, required)
  descr?: string;             // Description (editable, optional)
  parent_id?: number | null;  // Hierarchy (editable, optional)
  color_code: string;         // Badge color (editable, required)
  position?: number;          // Array position (from backend, non-editable)
}
```

### Add Row Feature (Inline Editing Pattern)

Both components now support **inline row addition** using the same inline editing pattern:

**How It Works:**

```
1. User clicks "+ Add new row" button at bottom of table

2. Component creates temporary row with ID: temp_{timestamp}
   const tempRow = { id: 'temp_1234567890', _isNew: true, ... }

3. Component adds row to data array and enters edit mode
   setData([...data, tempRow]);
   setEditingRow(tempRow.id);

4. User edits fields inline in the table row
   - All editable columns become input fields
   - Settings fields show dropdowns
   - Save (✓) and Cancel (✗) appear in actions column

5. User clicks ✓ Save

6. Component detects new row by temp_ ID prefix
   const isNewRow = record.id.toString().startsWith('temp_');

7. Component does POST (not PUT) to create entity
   if (isNewRow) {
     POST /api/v1/{entityType}
   } else {
     PUT /api/v1/{entityType}/{id}
   }

8. Backend creates entity with real ID

9. Component reloads data from server
   fetchData(); // Fresh data with real IDs

10. New row appears with real ID
```

**Unified Save Handler (FilteredDataTable):**

```typescript
const handleSaveInlineEdit = async (record: any) => {
  // Check if this is a new row
  const isNewRow = record.id.toString().startsWith('temp_') || record._isNew;

  // Transform data
  const transformedData = transformForApi(editedData, record);

  // Add parent relationship for child entities
  if (parentType && parentId && isNewRow) {
    transformedData.parent_type = parentType;
    transformedData.parent_id = parentId;
  }

  // Remove temporary fields
  delete transformedData._isNew;
  if (isNewRow) {
    delete transformedData.id; // Let backend generate real ID
  }

  let response;

  if (isNewRow) {
    // POST - Create new entity
    response = await fetch(`${API_BASE_URL}${config.apiEndpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(transformedData)
    });
  } else {
    // PUT - Update existing entity
    response = await fetch(`${API_BASE_URL}${config.apiEndpoint}/${record.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(transformedData)
    });
  }

  // Reload data
  await fetchData();
};
```

---

## 4. DRY Principles & Entity Relationships

### Complete Metadata Recomposition Pattern (Settings)

**Core Principle:** Always work with the COMPLETE metadata array, never partial updates.

```
┌─────────────────────────────────────────────────────────────────┐
│ USER ACTION: Edit item name and color                          │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ COMPONENT: Collect all changed fields                          │
│ onRowUpdate(id: 2, { name: "New Name", color_code: "cyan" })   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ SERVICE: Send ONE API call with all updates                    │
│ PUT /api/v1/setting/project_stage/2                            │
│ Body: { name: "New Name", color_code: "cyan" }                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND: Fetch → Update → Save                                 │
│ 1. Fetch entire metadata array from database                   │
│ 2. Find item by ID in array                                    │
│ 3. Update fields in that item                                  │
│ 4. Save ENTIRE metadata array back to database                 │
└─────────────────────────────────────────────────────────────────┘
```

**Benefits:**
- ✅ No partial update race conditions
- ✅ Backend is single source of truth
- ✅ Frontend always has fresh data
- ✅ ONE service handles ALL datalabels
- ✅ Consistent behavior everywhere

### Settings Service Layer (DRY)

**File:** `/apps/web/src/services/settingsService.ts`

```typescript
// Core Functions
export async function fetchSettingItems(datalabel: string): Promise<SettingItem[]>
export async function updateSettingItemMultiple(datalabel, itemId, updates): Promise<SettingDatalabel | null>
export async function createSettingItem(datalabel, newItem): Promise<SettingItem | null>
export async function deleteSettingItem(datalabel, itemId): Promise<boolean>
export async function reorderSettingItems(datalabel, reorderedItems): Promise<boolean>
export async function fetchAllCategories(): Promise<Category[]>
```

### Array Position-Based Ordering (Settings)

**Critical Design Decision:** Display order is determined by array position, NOT by ID or sort_order column.

```sql
-- Backend Query with WITH ORDINALITY
SELECT
  (elem.value->>'id')::text as id,
  elem.value->>'name' as name,
  elem.ordinality - 1 as position
FROM app.setting_datalabel,
  jsonb_array_elements(metadata) WITH ORDINALITY as elem
WHERE datalabel_name = 'project__stage'
ORDER BY elem.ordinality  -- Array order, NOT ID order!
```

**Frontend: Disable Sorting When Reordering**

```typescript
// When allowReorder=true, display in array position order (no sorting)
const sortedData = allowReorder ? [...data] : [...data].sort((a, b) => {
  // ... sorting logic only when reordering is disabled
});
```

**Why This Matters:**
- ✅ Drag & drop reflects actual database array order
- ✅ No confusion between sorted view and actual order
- ✅ Reorder endpoint receives correct array sequence
- ✅ Database array position is preserved on save

---

## 5. Central Configuration & Middleware

### Color Configuration

**File:** `/apps/web/src/lib/settingsConfig.ts` and `/apps/web/src/lib/data_transform_render.tsx`

```typescript
// Master Color Map (10 Colors Available)
const COLOR_MAP: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-800 border border-blue-200',
  purple: 'bg-purple-100 text-purple-800 border border-purple-200',
  green: 'bg-green-100 text-green-800 border border-green-200',
  red: 'bg-red-100 text-red-800 border border-red-200',
  yellow: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  orange: 'bg-orange-100 text-orange-800 border border-orange-200',
  gray: 'bg-gray-100 text-gray-800 border border-gray-200',
  cyan: 'bg-cyan-100 text-cyan-800 border border-cyan-200',
  pink: 'bg-pink-100 text-pink-800 border border-pink-200',
  amber: 'bg-amber-100 text-amber-800 border border-amber-200'
};

// Badge Renderer
export function renderSettingBadge(colorCode: string, label: string): React.ReactElement {
  const colorClass = COLOR_MAP[colorCode] || COLOR_MAP.gray;
  return (
    <span className={`inline-flex items-center rounded-full font-medium px-2.5 py-0.5 text-xs ${colorClass}`}>
      {label}
    </span>
  );
}
```

### Performance Optimizations

**1. API Response Caching (5 minutes)**

```typescript
// settingsLoader.ts
const cached = settingsCache.get(datalabel);
if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
  return cached.data;  // Return from cache
}
```

**2. Color Preloading on Mount**

```typescript
// EntityDataTable.tsx
useEffect(() => {
  const datalabels = columns
    .filter(col => col.loadOptionsFromSettings)
    .map(col => extractSettingsDatalabel(col.key));

  // Load all in parallel (Promise.all)
  await Promise.all(datalabels.map(dl => loadSettingsColors(dl)));
}, [columns]);
```

**3. In-Memory Color Cache**

```typescript
// data_transform_render.tsx
const settingsColorCache = new Map<string, Map<string, string>>();

// O(1) lookup during rendering
const color = settingsColorCache.get(datalabel)?.get(value);
```

**4. Memoization**

```typescript
// EntityDataTable uses useMemo for expensive operations
const columnCapabilities = useMemo(
  () => detectColumnCapabilities(columns),
  [columns]
);
```

---

## 6. User Interaction Flow Examples

### Flow 1: Entity Table - Inline Add Row

```
1. USER navigates to /project

2. ENTITYDATATABLE renders with "+ Add new row" button at bottom

3. USER clicks "+ Add new row"

4. COMPONENT creates temporary row
   const tempId = `temp_${Date.now()}`;
   const newRow = { id: tempId, _isNew: true };

5. COMPONENT adds to data and enters edit mode
   setData([...data, newRow]);
   setEditingRow(tempId);

6. UI shows new row with all fields editable
   • Name: <input>
   • Code: <input>
   • Project Stage: <ColoredDropdown>
   • Budget: <input type="number">
   • Start Date: <input type="date">
   • Save (✓) and Cancel (✗) icons

7. USER fills fields
   • Name: "Website Redesign"
   • Code: "WEB-2025-001"
   • Project Stage: "Planning" (from dropdown)
   • Budget: 75000
   • Start Date: 2025-03-01

8. USER clicks ✓ Save

9. COMPONENT detects new row by temp_ ID
   const isNewRow = tempId.startsWith('temp_');

10. COMPONENT sends POST request
    POST /api/v1/project
    Body: {
      name: "Website Redesign",
      code: "WEB-2025-001",
      project_stage: "Planning",
      budget_allocated_amt: 75000,
      start_date: "2025-03-01"
    }

11. BACKEND creates project with real UUID
    Returns: { id: "abc-def-123", ... }

12. COMPONENT reloads data
    fetchData(); // Fresh from server

13. UI shows new project with real ID
    • Row now has UUID instead of temp_
    • Exit edit mode
    • New project persisted!
```

### Flow 2: Settings Table - Drag & Drop Reorder

```
1. USER visits /setting/projectStage

2. SETTINGSDATATABLE renders in reorder mode
   allowReorder={true}
   • Sorting disabled
   • Rows draggable

3. USER drags row ID 3 to position 1

4. COMPONENT updates local state immediately
   const newOrder = [item3, item0, item1, item2, item4];
   setData(newOrder);

5. COMPONENT calls onReorder
   onReorder(newOrder);

6. SERVICE sends reorder request
   PUT /api/v1/setting/project_stage/reorder
   Body: {
     order: [
       { id: 3, position: 0 },
       { id: 0, position: 1 },
       { id: 1, position: 2 },
       { id: 2, position: 3 },
       { id: 4, position: 4 }
     ]
   }

7. BACKEND reorders metadata array
   • Parse order array
   • Sort by position ascending
   • Build new metadata array
   • Save entire array to database

8. UI reflects new order
   • Item 3 now appears first
   • Order persists across page refreshes
```

### Flow 3: Settings Table - Inline Add Row

```
1. USER visits /setting/taskPriority

2. SETTINGSDATATABLE renders with "+ Add new row" button

3. USER clicks "+ Add new row"

4. COMPONENT creates temporary row
   const tempId = `temp_${Date.now()}`;
   const newRow = {
     id: tempId,
     name: '',
     descr: '',
     parent_id: null,
     color_code: 'blue'
   };

5. COMPONENT adds to data and enters edit mode
   setData([...data, newRow]);
   setEditingRow(tempId);

6. UI shows new row with editable fields
   • Name: <input> (required)
   • Description: <input>
   • Parent ID: <input type="number">
   • Color: <ColoredDropdown> (shows all 10 colors with badges)
   • Save (✓) and Cancel (✗) icons

7. USER fills fields
   • Name: "Urgent"
   • Description: "Requires immediate attention"
   • Parent ID: (empty)
   • Color: red (from dropdown)

8. USER clicks ✓ Save

9. COMPONENT validates
   if (!newRow.name) alert('Name is required');

10. COMPONENT calls onRowUpdate (detects temp_ ID)
    onRowUpdate(tempId, { name, descr, parent_id, color_code });

11. PAGE HANDLER detects new row and calls createSettingItem
    const created = await createSettingItem('task_priority', {
      name: 'Urgent',
      descr: 'Requires immediate attention',
      parent_id: null,
      color_code: 'red'
    });

12. BACKEND adds to metadata array
    • Fetch current metadata
    • Find next available ID (maxId + 1)
    • Push new item to end of array
    • Save entire array to database

13. PAGE HANDLER fetches fresh data
    const items = await fetchSettingItems('task_priority');
    setData(items);

14. UI shows new priority with real ID
    • Row now has real ID instead of temp_
    • Red badge shows "Urgent"
    • Exit edit mode
```

---

## 7. Critical Considerations When Building

### ⚠️ CRITICAL: Inline Add Row Pattern

**DO (✅):**
```typescript
// EntityDataTable: POST creates entity
const handleAddRow = (newRow: any) => {
  setData([...data, newRow]); // Add temp row
  setEditingRow(newRow.id); // Enter edit mode
};

const handleSaveInlineEdit = async (record: any) => {
  const isNewRow = record.id.toString().startsWith('temp_');

  if (isNewRow) {
    // POST to create
    await fetch('/api/v1/project', {
      method: 'POST',
      body: JSON.stringify(transformedData)
    });
  } else {
    // PUT to update
    await fetch(`/api/v1/project/${record.id}`, {
      method: 'PUT',
      body: JSON.stringify(transformedData)
    });
  }

  await fetchData(); // Reload fresh data
};
```

**DON'T (❌):**
```typescript
// Don't use separate form UI
const handleAddRow = () => {
  setShowAddForm(true); // ❌ Breaks inline pattern
};
```

### ⚠️ CRITICAL: Array Position vs Sorting (Settings)

**Problem:** If you allow sorting while reordering is enabled, drag & drop will reorder a sorted view, not the actual array order!

**Solution:**
```typescript
// Disable sorting when allowReorder is true
const sortedData = allowReorder ? [...data] : [...data].sort((a, b) => {
  // ... sorting logic
});

// Disable column header clicks when reordering
onClick={() => col.sortable && !allowReorder && handleSort(col.key)}
```

### ⚠️ CRITICAL: Complete Metadata Recomposition (Settings)

**Don't Do This (❌):**
```typescript
// Multiple API calls for different fields
onInlineEdit(id, 'name', newName);
onInlineEdit(id, 'descr', newDescr);
onInlineEdit(id, 'color_code', newColor);
```

**Do This Instead (✅):**
```typescript
// ONE API call with all updates
onRowUpdate(id, {
  name: newName,
  descr: newDescr,
  color_code: newColor
});
```

### ⚠️ CRITICAL: Fresh Data After Mutations

**Pattern for Create/Delete:**
```typescript
const handleAddRow = async (newRecord) => {
  const created = await createItem(newRecord);

  if (created) {
    // ✅ Fetch fresh data from server
    const items = await fetchItems();
    setData(items);

    // ❌ DON'T just append locally
    // setData(prev => [...prev, created])
  }
};
```

**Why:** Backend may modify data (auto-generate IDs, calculate positions). Always fetch fresh data after mutations.

### ⚠️ Backend WITH ORDINALITY Query (Settings)

**Critical SQL Pattern:**
```sql
SELECT
  (elem.value->>'id')::text as id,
  elem.value->>'name' as name,
  elem.ordinality - 1 as position
FROM app.setting_datalabel,
  jsonb_array_elements(metadata) WITH ORDINALITY as elem
WHERE datalabel_name = 'project__stage'
ORDER BY elem.ordinality  -- ← CRITICAL: Array order, not ID order!
```

**Why:** WITHOUT ORDINALITY would order by ID, breaking drag & drop persistence.

### ⚠️ Database-Driven Colors: NO HARDCODING

**Don't Do This (❌):**
```typescript
// ❌ NEVER hardcode colors
const getStageColor = (stage: string) => {
  if (stage === 'Planning') return 'purple';
  if (stage === 'Execution') return 'yellow';
};
```

**Do This Instead (✅):**
```typescript
// ✅ Always fetch from database
const color = getSettingColor('project_stage', 'Planning');
// → Looks up in cache from database color_code
```

---

## 8. Component API Reference

### EntityDataTable Props

```typescript
interface EntityDataTableProps<T = any> {
  // Data
  data: T[];
  columns: Column<T>[];
  loading?: boolean;

  // Pagination
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
  };

  // Features
  searchable?: boolean;
  filterable?: boolean;
  columnSelection?: boolean;

  // Inline Editing
  inlineEditable?: boolean;
  editingRow?: string | null;
  editedData?: any;
  onInlineEdit?: (rowId: string, field: string, value: any) => void;
  onSaveInlineEdit?: (record: T) => void;
  onCancelInlineEdit?: () => void;

  // Inline Row Addition
  allowAddRow?: boolean;
  onAddRow?: (newRow: Partial<T>) => void;

  // Actions
  rowActions?: RowAction<T>[];
  onRowClick?: (record: T) => void;

  // Drag & Drop
  allowReordering?: boolean;
  onReorder?: (newData: T[]) => void;
}
```

### SettingsDataTable Props

```typescript
interface SettingsDataTableProps {
  data: SettingsRecord[];

  // CRUD Callbacks (DRY Pattern)
  onRowUpdate?: (id: string | number, updates: Partial<SettingsRecord>) => void;
  onInlineEdit?: (id: string | number, field: string, value: any) => void; // Legacy
  onAddRow?: (newRecord: Partial<SettingsRecord>) => void;
  onDeleteRow?: (id: string | number) => void;
  onReorder?: (reorderedData: SettingsRecord[]) => void;

  // Feature Flags
  allowAddRow?: boolean;   // Default: false
  allowEdit?: boolean;     // Default: true
  allowDelete?: boolean;   // Default: false
  allowReorder?: boolean;  // Default: false
}
```

---

## 9. Usage Examples

### Example 1: Entity Table with Inline Add Row

```typescript
import { FilteredDataTable } from '@/components/shared';

function ProjectsPage() {
  return (
    <FilteredDataTable
      entityType="project"
      showActionIcons={true}
      showEditIcon={true}
      inlineEditable={true}
      allowAddRow={true}  // Enable "+ Add new row" button
    />
  );
}
```

### Example 2: Settings Table with All Features

```typescript
import { SettingsDataTable } from '@/components/shared/ui/SettingsDataTable';
import { fetchSettingItems, updateSettingItemMultiple, createSettingItem, deleteSettingItem, reorderSettingItems } from '@/services/settingsService';

function SettingDetailPage() {
  const [data, setData] = useState<SettingsRecord[]>([]);

  // Load data
  useEffect(() => {
    async function loadData() {
      const items = await fetchSettingItems('project_stage');
      setData(items);
    }
    loadData();
  }, []);

  // CRUD handlers
  const handleRowUpdate = async (id, updates) => {
    const result = await updateSettingItemMultiple('project_stage', id, updates);
    if (result) setData(result.metadata);
  };

  const handleAddRow = async (newRecord) => {
    const created = await createSettingItem('project_stage', newRecord);
    if (created) {
      const items = await fetchSettingItems('project_stage');
      setData(items);
    }
  };

  const handleDeleteRow = async (id) => {
    await deleteSettingItem('project_stage', id);
    const items = await fetchSettingItems('project_stage');
    setData(items);
  };

  const handleReorder = async (reorderedData) => {
    await reorderSettingItems('project_stage', reorderedData);
    setData(reorderedData);
  };

  return (
    <SettingsDataTable
      data={data}
      onRowUpdate={handleRowUpdate}
      onAddRow={handleAddRow}
      onDeleteRow={handleDeleteRow}
      onReorder={handleReorder}
      allowAddRow={true}
      allowEdit={true}
      allowDelete={true}
      allowReorder={true}
    />
  );
}
```

---

## Summary

The PMO DataTable system provides two optimized components following **OOP-style composition patterns**:

- **EntityDataTable**: Full-featured, 1540 lines, 45 KB, for all entity pages
- **SettingsDataTable**: Lightweight, 600 lines, 12 KB, for settings pages only

Both components share:

✅ **Unified inline add row pattern** (temp_ ID → edit mode → POST/PUT)
✅ **Database-driven color system** (no hardcoding)
✅ **Automatic type detection** (currency, dates, settings)
✅ **Performance optimizations** (caching, preloading, memoization)
✅ **Consistent visual styling** (COLOR_MAP, badge rendering)
✅ **DRY principles** (shared utilities, service layers)

**Key Architectural Principles:**

1. **Composition over Inheritance** - React hooks + shared utilities
2. **Database as Single Source of Truth** - All colors from JSONB metadata
3. **Complete Metadata Recomposition** - Backend always works with full arrays (Settings)
4. **Array Position-Based Ordering** - Display order from array index (Settings)
5. **Auto-Detection Conventions** - Field naming drives capabilities
6. **Inline Editing Pattern** - Click Edit → All fields editable → Save/Cancel
7. **Inline Add Row Pattern** - Click + → Temp row → Edit inline → POST to API

---

## Related Files

| Layer | File Path | Purpose |
|-------|-----------|---------|
| **Components** | `/apps/web/src/components/shared/ui/EntityDataTable.tsx` | Full-featured entity table |
| **Components** | `/apps/web/src/components/shared/ui/SettingsDataTable.tsx` | Lightweight settings table |
| **Middleware** | `/apps/web/src/lib/settingsLoader.ts` | API caching, options loading |
| **Middleware** | `/apps/web/src/lib/data_transform_render.tsx` | COLOR_MAP, badge rendering, color cache |
| **Middleware** | `/apps/web/src/lib/settingsConfig.ts` | Color badge renderer |
| **Service** | `/apps/web/src/services/settingsService.ts` | DRY CRUD service layer |
| **Wrapper** | `/apps/web/src/components/shared/dataTable/FilteredDataTable.tsx` | EntityDataTable wrapper with data fetching |
| **Page** | `/apps/web/src/pages/setting/SettingDetailPage.tsx` | Universal settings page |
| **Backend** | `/apps/api/src/modules/setting/routes.ts` | Settings API endpoints |
| **Database** | `/db/setting_datalabel.ddl` | Settings table schema |

---

**Last Updated:** 2025-10-29
**Architecture Version:** 3.0 (OOP Composition + Inline Add Row)
**Status:** Production Ready
