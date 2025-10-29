# EntityDataTable Component

> **Full-featured data table for entity pages**
> Comprehensive table with advanced filtering, sorting, inline editing, and dynamic column detection
> **NEW:** Inline editing now matches SettingsDataTable pattern (Edit icon → Check/Cancel)

---

## Overview

The **EntityDataTable** is the primary, feature-rich table component used throughout the PMO application for displaying and managing entity data. It provides enterprise-grade functionality including dynamic column detection, advanced filtering, inline editing, pagination, and RBAC integration.

**File Location:** `/home/rabin/projects/pmo/apps/web/src/components/shared/ui/EntityDataTable.tsx`

**Lines of Code:** ~1540

**Recent Updates:**
- ✅ **Inline editing pattern** now matches SettingsDataTable (Edit icon transforms into Check/Cancel icons)
- ✅ **Quick add row** at bottom with consistent styling
- ✅ **Maintains existing detailed create form** workflow (unchanged)

---

## When to Use

✅ **Use EntityDataTable for:**
- All entity pages (projects, tasks, clients, employees, offices, businesses, etc.)
- Tables with dynamic, variable schemas
- Complex data requiring filters, search, and pagination
- Tables with RBAC-controlled actions
- Data requiring inline editing with auto-type detection

❌ **Don't use for:**
- Settings/datalabel pages - use SettingsDataTable (73% smaller)
- Simple, fixed-schema tables
- Small datasets (< 20 rows) with minimal requirements

---

## Features

### Core Features
- ✅ **Dynamic Columns** - Detects column types automatically
- ✅ **Advanced Filtering** - Dropdown filters with multi-select chips
- ✅ **Inline Editing** - Edit any field directly in the table
- ✅ **Inline Row Addition** - Add new rows directly in the table with "+" button
- ✅ **Smart Type Detection** - Auto-detects currency, dates, settings fields
- ✅ **Sorting** - Client-side sorting with visual indicators
- ✅ **Pagination** - Full pagination support
- ✅ **Column Visibility** - Show/hide columns dynamically
- ✅ **Settings Integration** - Auto-loads dropdown options from settings API
- ✅ **Badge Rendering** - Colored badges for settings fields
- ✅ **Currency Formatting** - Auto-formats currency fields
- ✅ **Date Rendering** - Formats dates and timestamps
- ✅ **Row Actions** - View, edit, share, delete actions
- ✅ **RBAC Support** - Permission-based action visibility
- ✅ **Drag & Drop Reordering** - Optional row reordering
- ✅ **Empty States** - Friendly empty state messages

---

## Architecture

### Component Hierarchy

```
FilteredDataTable (wrapper)
  └── EntityDataTable (core)
       ├── ColoredDropdown (inline edit)
       ├── FilterDropdown (column filters)
       ├── ColumnSelector (show/hide columns)
       └── PaginationComponent (page controls)
```

### Data Flow

```
API → FilteredDataTable → EntityDataTable → Rendered Table
                ↓
        Auto-detects capabilities
                ↓
        Loads settings options
                ↓
        Applies badges & formatting
```

---

## Usage

### Basic Usage (via FilteredDataTable)

```tsx
import { FilteredDataTable } from '../../components/shared';

function ProjectsPage() {
  return (
    <FilteredDataTable
      entityType="project"
      showActionIcons={true}
      showEditIcon={true}
      inlineEditable={true}
    />
  );
}
```

### Direct Usage (Advanced)

```tsx
import { EntityDataTable } from '../../components/shared/ui/EntityDataTable';

function CustomTable() {
  const columns = [
    { key: 'id', title: 'ID', sortable: true },
    { key: 'name', title: 'Name', sortable: true, filterable: true },
    { key: 'project_stage', title: 'Stage', loadOptionsFromSettings: true }
  ];

  const rowActions = [
    { key: 'view', label: 'View', icon: Eye, onClick: (row) => navigate(`/project/${row.id}`) },
    { key: 'edit', label: 'Edit', icon: Edit, onClick: (row) => handleEdit(row.id) }
  ];

  return (
    <EntityDataTable
      data={projects}
      columns={columns}
      loading={loading}
      filterable={true}
      inlineEditable={true}
      rowActions={rowActions}
      onRowClick={(project) => navigate(`/project/${project.id}`)}
      onInlineEdit={handleInlineEdit}
    />
  );
}
```

---

## Props

### EntityDataTableProps

```typescript
interface EntityDataTableProps<T = any> {
  // Data
  data: T[];                                   // Array of records
  columns: Column<T>[];                        // Column definitions
  loading?: boolean;                           // Show loading state

  // Pagination
  pagination?: {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (page: number) => void;
  };

  // Filtering
  filterable?: boolean;                        // Enable column filters
  onFilterChange?: (filters: Record<string, string[]>) => void;

  // Sorting
  sortable?: boolean;                          // Enable sorting (default: true)

  // Row Actions
  rowActions?: RowAction<T>[];                 // Action buttons per row
  onRowClick?: (row: T) => void;               // Click handler for rows

  // Inline Editing
  inlineEditable?: boolean;                    // Enable inline editing
  onInlineEdit?: (id: string, field: string, value: any) => void;
  onCancelInlineEdit?: () => void;

  // Inline Row Addition
  allowAddRow?: boolean;                       // Enable inline row addition (default: false)
  onAddRow?: (newRecord: Partial<T>) => void;  // Callback for adding new row

  // Color Options (legacy, auto-detected now)
  colorOptions?: Record<string, string>;

  // Reordering
  allowReordering?: boolean;                   // Enable drag & drop
  onReorder?: (newData: T[]) => void;
}
```

### Column Interface

```typescript
interface Column<T = any> {
  key: string;                                 // Field key
  title: string;                               // Column header
  sortable?: boolean;                          // Enable sorting
  filterable?: boolean;                        // Enable filtering
  render?: (value: any, record: T, allData?: T[]) => React.ReactNode;
  width?: string | number;                     // Column width
  align?: 'left' | 'center' | 'right';        // Text alignment
  editable?: boolean;                          // Manual editable flag
  editType?: 'text' | 'select' | 'number' | 'date';
  loadOptionsFromSettings?: boolean;           // Auto-load dropdown options
  options?: SettingOption[];                   // Static options
  inlineEditable?: boolean;                    // Enable inline editing
}
```

### RowAction Interface

```typescript
interface RowAction<T = any> {
  key: string;                                 // Action identifier
  label: string;                               // Action label
  icon: React.ComponentType;                   // Lucide icon component
  onClick: (row: T, event?: React.MouseEvent) => void;
  variant?: 'default' | 'primary' | 'danger';  // Visual variant
  className?: string;                          // Custom classes
}
```

---

## Dynamic Column Detection

### Auto-Detection System

EntityDataTable automatically detects field capabilities based on naming conventions:

```typescript
// Convention Over Configuration
detectColumnCapabilities(columns: Column[]): Map<string, FieldCapability>
```

**Detection Rules:**

| Field Pattern | Detected Type | Auto-Features |
|---------------|---------------|---------------|
| `*_amt` | Currency | $ formatting, right-align |
| `*_date` | Date | Date formatting |
| `*_ts` | Timestamp | DateTime formatting |
| `*_stage` | Settings | Badge, dropdown, color cache |
| `*_status` | Settings | Badge, dropdown, color cache |
| `*_priority` | Settings | Badge, dropdown, color cache |
| `*_level` | Settings | Badge, dropdown, color cache |
| `*_tier` | Settings | Badge, dropdown, color cache |
| `tags` | Tags Array | Inline tag editing |

**Example:**

```typescript
const columns = [
  { key: 'budget_allocated_amt', title: 'Budget' },  // Auto: currency, $, right-align
  { key: 'start_date', title: 'Start' },             // Auto: date format
  { key: 'project_stage', title: 'Stage' },          // Auto: badge, dropdown, colors
  { key: 'created_ts', title: 'Created' },           // Auto: datetime format
];

// Result: All features applied automatically, no manual configuration!
```

---

## Filtering

### Column Filters

Click the filter icon in any filterable column header to open a dropdown with available values.

**Features:**
- ✅ Multi-select (select multiple values)
- ✅ Active filter chips shown below header
- ✅ Clear individual filters
- ✅ Clear all filters button
- ✅ Auto-populated from data
- ✅ Search within filter options

**Example:**

```tsx
// Enable filtering
<EntityDataTable
  data={projects}
  columns={columns}
  filterable={true}
  onFilterChange={(filters) => console.log(filters)}
/>

// User filters: Stage = "Planning", "Execution"
// Result: { project_stage: ["Planning", "Execution"] }
```

### Filter Implementation

```typescript
// Get unique values for filter column
const uniqueValues = Array.from(
  new Set(data.map(row => row[column.key]).filter(Boolean))
).sort();

// Apply filters
const filteredData = data.filter(row => {
  return Object.entries(dropdownFilters).every(([key, values]) => {
    if (!values.length) return true;
    const rowValue = String(row[key] || '');
    return values.includes(rowValue);
  });
});
```

---

## Sorting

### How Sorting Works

1. Click any sortable column header
2. First click: Sort ascending
3. Second click: Sort descending
4. Third click: Clear sort

**Sort Indicators:**
- ⬆️ ChevronUp icon = Ascending
- ⬇️ ChevronDown icon = Descending

### Sort Types

```typescript
// Numeric sort
{ key: 'id', title: 'ID', sortable: true }  // 1, 2, 10, 20 (not 1, 10, 2, 20)

// Alphabetic sort
{ key: 'name', title: 'Name', sortable: true }  // A-Z or Z-A

// Date sort
{ key: 'created_ts', title: 'Created', sortable: true }  // Oldest to newest
```

---

## Inline Row Addition

### Add New Row Feature

The EntityDataTable supports inline row addition with a "+" button at the bottom of the table.

**How it works:**
1. Enable with `allowAddRow={true}` and provide `onAddRow` callback
2. A "+" button appears in the last row of the table
3. Click the "+" button to add a new empty row inline
4. Edit the new row fields based on column definitions
5. `onAddRow` callback is triggered when user saves
6. Table updates locally after API call

**Visual Design:**
- Last row has a "+" button in the first column
- Clicking "+" converts the row to editable fields
- All editable columns become input fields
- Settings fields show dropdowns
- Save/Cancel buttons appear for the new row
- Validation ensures required fields are filled

### Usage Example

```tsx
const handleAddRow = async (newRecord: Partial<Project>) => {
  // API call to create new entity
  const response = await fetch('/api/v1/project', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newRecord)
  });

  const created = await response.json();

  // Update local state
  setData(prev => [...prev, created.data]);
};

<EntityDataTable
  data={projects}
  columns={columns}
  inlineEditable={true}
  allowAddRow={true}
  onAddRow={handleAddRow}
/>
```

### Combining with FilteredDataTable

```tsx
<FilteredDataTable
  entityType="project"
  showActionIcons={true}
  inlineEditable={true}
  allowAddRow={true}
  onAddRow={handleAddRow}
/>
```

## Inline Editing

### Auto-Detection

Fields are automatically made editable based on:

1. **`inlineEditable: true`** prop on table
2. **Field naming conventions** (e.g., `*_stage`, `*_priority`)
3. **`loadOptionsFromSettings`** flag on column
4. **`options`** array provided

### Edit Types

| Field Type | Edit UI | Example |
|------------|---------|---------|
| **Settings Field** | Colored dropdown | `project_stage` → Dropdown with badges |
| **Text Field** | Text input | `name`, `descr` |
| **Number Field** | Number input | `budget_allocated_amt` |
| **Date Field** | Date picker | `start_date` |

### Settings Field Editing

```tsx
// Auto-detected: project_stage is a settings field
<EntityDataTable
  columns={[
    { key: 'project_stage', title: 'Stage', loadOptionsFromSettings: true }
  ]}
  inlineEditable={true}
  onInlineEdit={(id, field, value) => {
    // API call to update
    updateProject(id, { [field]: value });
  }}
/>
```

**Result:**
- Clicking "Planning" badge opens dropdown
- Dropdown shows all stages with colored badges
- Selecting "Execution" triggers `onInlineEdit`
- Table updates immediately

---

## Database-Driven Color & Formatting System

### Architecture: NO HARDCODING

**Core Principle:** All colors, badges, and formatting come from the database via API. Nothing is hardcoded in the frontend.

### Complete Data Flow (5 Layers)

```
┌───────────────────────────────────────────────────────────────┐
│ LAYER 1: DATABASE                                             │
│ Table: app.setting_datalabel                                  │
│ Field: metadata (JSONB array)                                 │
│                                                               │
│ [{                                                            │
│   "id": 1,                                                    │
│   "name": "Planning",                                         │
│   "descr": "Detailed project planning",                       │
│   "parent_id": 0,                                             │
│   "color_code": "purple"  ← Source of truth!                 │
│ }, ...]                                                       │
└───────────────────────────────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────────────────┐
│ LAYER 2: BACKEND API                                          │
│ Route: /api/v1/setting?datalabel=project_stage              │
│ File: /apps/api/src/modules/setting/routes.ts               │
│                                                               │
│ SQL extracts from JSONB:                                      │
│   SELECT elem->>'color_code' as color_code                   │
│   FROM app.setting_datalabel,                                │
│        jsonb_array_elements(metadata) as elem                │
│   WHERE datalabel_name = 'project__stage'                    │
│                                                               │
│ Response includes color_code:                                 │
│ {                                                             │
│   "data": [                                                   │
│     { "id": "1", "name": "Planning", "color_code": "purple" } │
│   ]                                                           │
│ }                                                             │
└───────────────────────────────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────────────────┐
│ LAYER 3: FRONTEND MIDDLEWARE                                  │
│ File: /apps/web/src/lib/settingsLoader.ts                    │
│                                                               │
│ loadSettingOptions(datalabel):                                │
│   - Fetches from API: /api/v1/setting?datalabel=X           │
│   - Caches for 5 minutes to reduce API calls                 │
│   - Returns SettingOption[] with metadata                     │
│                                                               │
│ colorCodeToTailwindClass(colorCode):                          │
│   'purple' → 'bg-purple-100 text-purple-800'                 │
│                                                               │
│ Returns:                                                      │
│ [                                                             │
│   {                                                           │
│     value: 'Planning',                                        │
│     label: 'Planning',                                        │
│     colorClass: 'bg-purple-100 text-purple-800',             │
│     metadata: { color_code: 'purple' }                        │
│   }                                                           │
│ ]                                                             │
└───────────────────────────────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────────────────┐
│ LAYER 4: FRONTEND RENDERING                                   │
│ File: /apps/web/src/lib/data_transform_render.tsx            │
│                                                               │
│ COLOR_MAP (Master Tailwind Mapping):                          │
│ {                                                             │
│   'blue': 'bg-blue-100 text-blue-800 border ...',           │
│   'purple': 'bg-purple-100 text-purple-800 border ...',      │
│   'green': 'bg-green-100 text-green-800 border ...',         │
│   'red': 'bg-red-100 text-red-800 border ...',              │
│   'yellow': 'bg-yellow-100 text-yellow-800 border ...',      │
│   'orange': 'bg-orange-100 text-orange-800 border ...',      │
│   'gray': 'bg-gray-100 text-gray-800 border ...',           │
│   'cyan': 'bg-cyan-100 text-cyan-800 border ...',           │
│   'pink': 'bg-pink-100 text-pink-800 border ...',           │
│   'amber': 'bg-amber-100 text-amber-800 border ...'          │
│ }                                                             │
│                                                               │
│ Functions:                                                    │
│   loadSettingsColors(datalabel)                               │
│     → Preloads colors into cache for performance              │
│                                                               │
│   getSettingColor(datalabel, value)                           │
│     → Retrieves color_code from cache                        │
│                                                               │
│   renderSettingBadge(colorCode, label)                        │
│     → Universal badge renderer                                │
│                                                               │
│ Color Cache Structure:                                        │
│   Map<datalabel, Map<value, color_code>>                     │
│                                                               │
│ Example:                                                      │
│   settingsColorCache.set('project_stage', new Map([          │
│     ['Initiation', 'blue'],                                   │
│     ['Planning', 'purple'],                                   │
│     ['Execution', 'yellow']                                   │
│   ]));                                                        │
└───────────────────────────────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────────────────┐
│ LAYER 5: UI RENDERING (EntityDataTable)                       │
│                                                               │
│ Badge Rendering:                                              │
│   render: (value) => renderSettingBadge(value, {             │
│     datalabel: 'project_stage'                                │
│   })                                                          │
│                                                               │
│ Inline Edit Dropdown:                                         │
│   ColoredDropdown with options from loadSettingOptions()      │
│   Each option shows colored badge                             │
│                                                               │
│ Final HTML:                                                   │
│   <span class="inline-flex items-center rounded-full         │
│                font-medium bg-purple-100 text-purple-800     │
│                border border-purple-200 px-2.5 py-0.5 text-xs">│
│     Planning                                                  │
│   </span>                                                     │
└───────────────────────────────────────────────────────────────┘
```

### Step-by-Step Example: Project Stage Badge in Entity Table

**Step 1: Database Storage**
```sql
-- setting_datalabel table
datalabel_name: 'project__stage'
metadata: [
  {
    "id": 1,
    "name": "Planning",
    "descr": "Detailed project planning and resource allocation",
    "parent_id": 0,
    "color_code": "purple"
  }
]
```

**Step 2: Entity Data References Settings**
```sql
-- d_project table
SELECT id, name, project_stage FROM app.d_project;
-- Returns: { id: 'abc123', name: 'Website Redesign', project_stage: 'Planning' }
```

**Step 3: API Provides Settings with Colors**
```bash
# EntityDataTable requests settings for dropdown options
GET /api/v1/setting?datalabel=project_stage

# Response includes color_code
{
  "data": [
    { "id": "1", "name": "Planning", "color_code": "purple" }
  ]
}
```

**Step 4: Frontend Middleware Transforms**
```typescript
// settingsLoader.ts
const options = await loadSettingOptions('project_stage');

// Transformed to SettingOption[]
[
  {
    value: 'Planning',
    label: 'Planning',
    colorClass: 'bg-purple-100 text-purple-800',
    metadata: { color_code: 'purple', id: 1, descr: '...', parent_id: 0 }
  }
]

// Cached for 5 minutes
settingsCache.set('project_stage', { data: options, timestamp: now() });
```

**Step 5: Color Preloading on Mount**
```typescript
// EntityDataTable.tsx
useEffect(() => {
  // Detect all settings columns
  const settingsColumns = columns.filter(col =>
    col.loadOptionsFromSettings || col.key.match(/_stage$|_status$|_priority$/)
  );

  // Extract datalabels
  const datalabels = settingsColumns.map(col =>
    extractSettingsDatalabel(col.key)
  );
  // ['project_stage', 'task_priority', ...]

  // Preload all colors in parallel
  await Promise.all(
    datalabels.map(dl => loadSettingsColors(dl))
  );
}, [columns]);
```

**Step 6: Color Cache Built**
```typescript
// data_transform_render.tsx
await loadSettingsColors('project_stage');

// Builds cache
settingsColorCache.set('project_stage', new Map([
  ['Initiation', 'blue'],
  ['Planning', 'purple'],
  ['Execution', 'yellow'],
  ['Monitoring', 'orange'],
  ['Closure', 'green']
]));
```

**Step 7: Badge Rendering in Table**
```typescript
// Column configuration in entityConfig.ts
{
  key: 'project_stage',
  title: 'Stage',
  loadOptionsFromSettings: true,
  render: (value) => renderSettingBadge(value, { datalabel: 'project_stage' })
}

// renderSettingBadge internal flow:
1. value = 'Planning'
2. datalabel = 'project_stage'
3. colorCode = getSettingColor('project_stage', 'Planning')  // → 'purple'
4. colorClass = COLOR_MAP['purple']  // → 'bg-purple-100 text-purple-800 ...'
5. return <span className={colorClass}>Planning</span>
```

**Step 8: Final Output**
```html
<!-- Rendered in EntityDataTable -->
<span class="inline-flex items-center rounded-full font-medium
             bg-purple-100 text-purple-800 border border-purple-200
             px-2.5 py-0.5 text-xs">
  Planning
</span>
```

### Auto-Loading Options

EntityDataTable automatically detects and loads dropdown options for settings fields:

```typescript
// 1. Auto-detects settings fields by pattern
const isSettingsField = col.key.match(/_stage$|_status$|_priority$|_level$|_tier$/);

// 2. Loads options from API
const options = await loadFieldOptions('project_stage');
// → Calls /api/v1/setting?datalabel=project_stage
// → Returns SettingOption[] with color_code in metadata

// 3. Caches for 5 minutes (performance optimization)
settingOptions.set('project_stage', options);

// 4. Preloads colors for badges (O(1) lookup during render)
await loadSettingsColors('project_stage');
```

### Color Caching & Performance

**Cache Structure:**
```typescript
// Map<datalabel, Map<value, color_code>>
const settingsColorCache = new Map();

settingsColorCache.set('project_stage', new Map([
  ['Initiation', 'blue'],
  ['Planning', 'purple'],
  ['Execution', 'yellow'],
  ['Monitoring', 'orange'],
  ['Closure', 'green']
]));
```

**Fast Lookup During Render:**
```typescript
// O(1) lookup, no API call
const color = getSettingColor('project_stage', 'Planning');  // → 'purple'
```

**Preloading Strategy:**
```typescript
// EntityDataTable preloads all settings colors on mount
useEffect(() => {
  const datalabels = columns
    .filter(col => col.loadOptionsFromSettings)
    .map(col => extractSettingsDatalabel(col.key));

  // Load all in parallel (Promise.all)
  await Promise.all(datalabels.map(dl => loadSettingsColors(dl)));
}, [columns]);
```

### Badge Rendering

Settings fields automatically render as colored badges:

```tsx
// Auto-detected column with settings field
{ key: 'project_stage', title: 'Stage', loadOptionsFromSettings: true }

// Rendered as colored badge
// project_stage = "Planning" with color_code = "purple"
// Result: <span class="bg-purple-100 text-purple-800">Planning</span>
```

**Render Function:**
```typescript
// In entityConfig.ts
render: (value) => renderSettingBadge(value, { datalabel: 'project_stage' })

// renderSettingBadge:
// 1. Looks up color from cache: getSettingColor('project_stage', 'Planning') → 'purple'
// 2. Maps to Tailwind: COLOR_MAP['purple'] → 'bg-purple-100 text-purple-800 ...'
// 3. Renders badge: <span className={tailwindClasses}>{value}</span>
```

### Color Options (All 10 Available)

| color_code | Tailwind Classes | Visual | Typical Use |
|------------|------------------|--------|-------------|
| `blue` | `bg-blue-100 text-blue-800` | 🔵 | Initiation, Lead, Info |
| `purple` | `bg-purple-100 text-purple-800` | 🟣 | Planning, Review, Important |
| `yellow` | `bg-yellow-100 text-yellow-800` | 🟡 | Execution, In Progress |
| `orange` | `bg-orange-100 text-orange-800` | 🟠 | Monitoring, Warning |
| `green` | `bg-green-100 text-green-800` | 🟢 | Closure, Done, Success |
| `red` | `bg-red-100 text-red-800` | 🔴 | Cancelled, High, Error |
| `gray` | `bg-gray-100 text-gray-800` | ⚪ | On Hold, Inactive |
| `cyan` | `bg-cyan-100 text-cyan-800` | 🔷 | Information, Secondary |
| `pink` | `bg-pink-100 text-pink-800` | 🩷 | Special categories |
| `amber` | `bg-amber-100 text-amber-800` | 🟨 | Tiers, Alerts |

### Key Files in Color Flow

| Layer | File Path | Purpose |
|-------|-----------|---------|
| **Database** | `/db/setting_datalabel.ddl` | Stores color_code in JSONB |
| **Backend API** | `/apps/api/src/modules/setting/routes.ts` | Extracts color_code from JSONB |
| **Middleware** | `/apps/web/src/lib/settingsLoader.ts` | Loads & caches settings with colors |
| **Rendering** | `/apps/web/src/lib/data_transform_render.tsx` | COLOR_MAP, caching, badge rendering |
| **Component** | `/apps/web/src/components/shared/ui/EntityDataTable.tsx` | Displays badges |
| **Entity Config** | `/apps/web/src/lib/entityConfig.ts` | Column definitions with render functions |

### Why This Architecture?

✅ **Single Source of Truth** - Database controls all colors
✅ **No Hardcoding** - All colors fetched from API
✅ **Performance** - 5-minute cache + preloading
✅ **Consistent** - Same COLOR_MAP across all tables
✅ **Maintainable** - Update database, reflects everywhere
✅ **Fast Rendering** - O(1) color lookups from cache
✅ **Automatic** - Auto-detects settings fields by pattern

---

## Currency Formatting

### Auto-Detection

Fields ending in `_amt` are automatically formatted as currency:

```typescript
// Column: budget_allocated_amt
// Value: 250000
// Rendered: "$250,000.00"
```

### Format Function

```typescript
function formatCurrency(value: any): string {
  const num = Number(value);
  if (isNaN(num)) return '-';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}
```

---

## Date & Time Rendering

### Date Fields

```typescript
// Field: start_date
// Value: "2025-03-15"
// Rendered: "Mar 15, 2025"

// Field: planned_end_date
// Value: "2025-12-31"
// Rendered: "Dec 31, 2025"
```

### Timestamp Fields

```typescript
// Field: created_ts
// Value: "2025-01-23T14:30:00Z"
// Rendered: "Jan 23, 2025 2:30 PM"

// Field: updated_ts
// Value: "2025-01-24T09:15:00Z"
// Rendered: "Jan 24, 2025 9:15 AM"
```

### Format Functions

```typescript
function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}
```

---

## Row Actions

### Standard Actions

```typescript
const rowActions: RowAction[] = [
  {
    key: 'view',
    label: 'View',
    icon: Eye,
    onClick: (row) => navigate(`/project/${row.id}`)
  },
  {
    key: 'edit',
    label: 'Edit',
    icon: Edit,
    onClick: (row) => openEditModal(row.id)
  },
  {
    key: 'share',
    label: 'Share',
    icon: Share,
    onClick: (row) => openShareDialog(row.id)
  },
  {
    key: 'delete',
    label: 'Delete',
    icon: Trash2,
    variant: 'danger',
    onClick: (row) => confirmDelete(row.id)
  }
];
```

### RBAC Integration

Actions respect user permissions automatically when used with FilteredDataTable:

```tsx
<FilteredDataTable
  entityType="project"
  showActionIcons={true}    // Checks user permissions
  showEditIcon={true}       // Only shown if user has edit permission
  showShareIcon={true}      // Only shown if user has share permission
  showDeleteIcon={true}     // Only shown if user has delete permission
/>
```

---

## Column Visibility

### Show/Hide Columns

Click the columns icon (⚙️) in the table header to toggle column visibility.

**Features:**
- ✅ Checkbox for each column
- ✅ Persists in component state
- ✅ Hidden columns removed from table
- ✅ Filters and sorts still work

```tsx
// Initial state: all columns visible
const [visibleColumns, setVisibleColumns] = useState(
  new Set(columns.map(col => col.key))
);

// User unchecks "Description" column
setVisibleColumns(prev => {
  const next = new Set(prev);
  next.delete('descr');
  return next;
});

// Result: Description column hidden
```

---

## Pagination

### Pagination Configuration

```tsx
<EntityDataTable
  data={currentPageData}
  pagination={{
    currentPage: 1,
    totalPages: 10,
    pageSize: 50,
    totalItems: 487,
    onPageChange: (page) => setCurrentPage(page)
  }}
/>
```

### Pagination Controls

```
[<< First] [< Previous] Page 1 of 10 [Next >] [Last >>]

Showing 1-50 of 487 items
```

**Features:**
- ✅ First/Last page buttons
- ✅ Previous/Next buttons
- ✅ Current page indicator
- ✅ Total items count
- ✅ Page size display

---

## Drag & Drop Reordering

### Enable Reordering

```tsx
<EntityDataTable
  data={items}
  allowReordering={true}
  onReorder={(newData) => {
    // Save new order to API
    saveOrder(newData);
  }}
/>
```

### How It Works

1. User drags a row
2. Drop zones appear between rows
3. User drops row in new position
4. `onReorder` callback triggered with new array
5. Table updates immediately

**Visual Feedback:**
- Dragging row: Semi-transparent
- Drop target: Blue highlight
- Cursor: Grab hand

---

## Performance Optimization

### Memoization

```typescript
// Column capabilities detected once
const columnCapabilities = useMemo(
  () => detectColumnCapabilities(columns),
  [columns]
);

// Filtered data computed once per filter change
const filteredData = useMemo(
  () => applyFilters(data, dropdownFilters),
  [data, dropdownFilters]
);

// Sorted data computed once per sort change
const sortedData = useMemo(
  () => applySorting(filteredData, sortField, sortDirection),
  [filteredData, sortField, sortDirection]
);
```

### Color Preloading

```typescript
// Preload all colors on mount
useEffect(() => {
  const settingsColumns = columns.filter(col =>
    col.loadOptionsFromSettings
  );

  const datalabels = settingsColumns.map(col =>
    extractSettingsDatalabel(col.key)
  );

  // Load all colors in parallel
  await Promise.all(
    datalabels.map(datalabel =>
      loadSettingsColors(datalabel)
    )
  );
}, [columns]);
```

### Virtual Scrolling (Future)

Currently not implemented. Could be added for very large datasets (>1000 rows).

---

## Styling

### Table Classes

```tsx
<table className="min-w-full divide-y divide-gray-200">
  <thead className="bg-gray-50">
    <tr>
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
        Name
      </th>
    </tr>
  </thead>
  <tbody className="bg-white divide-y divide-gray-200">
    <tr className="hover:bg-gray-50 transition-colors cursor-pointer">
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        Project Alpha
      </td>
    </tr>
  </tbody>
</table>
```

### Badge Classes

```typescript
const COLOR_MAP = {
  blue: 'bg-blue-100 text-blue-800 border-blue-200',
  purple: 'bg-purple-100 text-purple-800 border-purple-200',
  green: 'bg-green-100 text-green-800 border-green-200',
  red: 'bg-red-100 text-red-800 border-red-200',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  orange: 'bg-orange-100 text-orange-800 border-orange-200',
  gray: 'bg-gray-100 text-gray-800 border-gray-200',
  cyan: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  pink: 'bg-pink-100 text-pink-800 border-pink-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-200'
};
```

---

## Examples

### Example 1: Project Table

```tsx
const columns = [
  { key: 'id', title: 'ID', sortable: true, width: '80px' },
  { key: 'name', title: 'Project Name', sortable: true, filterable: true },
  { key: 'project_stage', title: 'Stage', sortable: true, filterable: true },
  { key: 'budget_allocated_amt', title: 'Budget', sortable: true },
  { key: 'start_date', title: 'Start Date', sortable: true },
  { key: 'planned_end_date', title: 'End Date', sortable: true }
];

<FilteredDataTable
  entityType="project"
  showActionIcons={true}
  showEditIcon={true}
  inlineEditable={true}
/>
```

### Example 2: Task Table

```tsx
const columns = [
  { key: 'id', title: 'ID', sortable: true },
  { key: 'title', title: 'Title', sortable: true, filterable: true },
  { key: 'task_stage', title: 'Stage', sortable: true, filterable: true },
  { key: 'priority_level', title: 'Priority', sortable: true, filterable: true },
  { key: 'due_date', title: 'Due Date', sortable: true }
];

<FilteredDataTable
  entityType="task"
  showActionIcons={true}
  inlineEditable={true}
/>
```

### Example 3: Client Table

```tsx
const columns = [
  { key: 'id', title: 'ID', sortable: true },
  { key: 'client_name', title: 'Client', sortable: true, filterable: true },
  { key: 'client_status', title: 'Status', sortable: true, filterable: true },
  { key: 'customer_tier', title: 'Tier', sortable: true, filterable: true },
  { key: 'total_revenue_amt', title: 'Revenue', sortable: true }
];

<FilteredDataTable
  entityType="client"
  showActionIcons={true}
/>
```

---

## Troubleshooting

### Colors Not Loading

**Problem:** Settings field badges show as gray

**Solution:**
1. Check field name matches pattern (`*_stage`, `*_priority`, etc.)
2. Verify `loadOptionsFromSettings` is true or auto-detected
3. Ensure API endpoint `/api/v1/setting?datalabel=X` returns data
4. Check browser console for color loading errors

### Inline Edit Not Working

**Problem:** Clicking field doesn't open editor

**Solution:**
1. Verify `inlineEditable={true}` on table
2. Check `onInlineEdit` prop is provided
3. Ensure field is detected as editable (settings field or manual flag)
4. Check browser console for JavaScript errors

### Filters Not Showing

**Problem:** Filter icon not appearing in headers

**Solution:**
1. Verify `filterable={true}` on table
2. Check column has `filterable: true` property
3. Ensure data has values for that column
4. Verify data is array, not empty

### Pagination Not Working

**Problem:** Page controls don't change data

**Solution:**
1. Check `pagination.onPageChange` is provided
2. Verify handler updates currentPage state
3. Ensure data is sliced correctly for current page
4. Check totalPages calculation is correct

---

## Best Practices

### DO ✅

- Use FilteredDataTable wrapper for standard use cases
- Let auto-detection handle field types
- Preload settings colors on component mount
- Provide loading states during data fetch
- Handle API errors in onInlineEdit
- Use appropriate column widths for different field types
- Enable filtering for large datasets (>50 rows)
- Use pagination for datasets >100 rows

### DON'T ❌

- Don't bypass FilteredDataTable unless you have custom requirements
- Don't manually configure what auto-detection can handle
- Don't forget onInlineEdit prop if inlineEditable is true
- Don't use EntityDataTable for settings pages (use SettingsDataTable)
- Don't render too many columns (>15 gets crowded)
- Don't skip error handling in callbacks
- Don't forget to update local state after successful API calls

---

## Summary

The **EntityDataTable** is the most comprehensive and powerful table component in the PMO application. With automatic field detection, advanced filtering, inline editing, and deep integration with the settings system, it provides a rich, enterprise-grade data management experience for all entity pages.

**Key Takeaways:**
- ✅ Use for all entity pages
- ✅ Auto-detects field types and capabilities
- ✅ Integrates with settings API for dropdowns
- ✅ Supports inline editing with colored badges
- ✅ Supports inline row addition with "+" button
- ✅ Full filtering, sorting, and pagination
- ✅ RBAC-aware row actions
- ✅ 45 KB bundle (use SettingsDataTable for settings)

For settings/datalabel pages with fixed schemas, use **SettingsDataTable** instead (73% smaller).

---

## Related Documentation

- **SettingsDataTable**: `/home/rabin/projects/pmo/docs/settings_datatable.md`
- **FilteredDataTable**: Integration wrapper for EntityDataTable
- **Data Transform & Render**: `/home/rabin/projects/pmo/docs/data_transform_render.md`
- **Settings System**: `/home/rabin/projects/pmo/docs/settings.md`
- **Entity Configuration**: `/home/rabin/projects/pmo/docs/entity_config.md`
