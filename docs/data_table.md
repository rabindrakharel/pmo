# DataTable Component - Complete Technical Documentation

> **Universal table component** with auto-detection, inline editing, sorting, filtering, and backend integration

**Component:** `apps/web/src/components/shared/ui/DataTable.tsx`
**Created:** 2025-10-23
**Last Updated:** 2025-10-29 (v2.6 - Database-Driven Badge Colors)
**Related:** [UI/UX Architecture](./ui_ux_route_api.md), [Settings System](./settings.md), [Settings Pattern 7 (Colors)](./settings.md#pattern-7-database-driven-badge-color-system-v25), [Styling Patterns](./styling_patterns.md)

---

## 📋 Table of Contents

1. [Overview & Architecture](#overview--architecture)
2. [Component Props Reference](#component-props-reference)
3. [Backend API Integration](#backend-api-integration)
4. [DRY Principles & Auto-Detection](#dry-principles--auto-detection)
5. [Inline Editing System](#inline-editing-system)
6. [Column Configuration](#column-configuration)
7. [Data Flow Examples](#data-flow-examples)
8. [Advanced Features](#advanced-features)
9. [Settings Table Enhancements (v2.4)](#settings-table-enhancements-v24) ⭐ NEW
10. [Drag & Drop System (v2.4)](#drag--drop-system-v24) ⭐ NEW
11. [Testing & Debugging](#testing--debugging)

---

## Overview & Architecture

### What is DataTable?

**DataTable** is a universal, feature-rich table component that powers ALL entity list views in the PMO platform. It's the core component used by `EntityMainPage` and `FilteredDataTable`.

### Key Features

- ✅ **Database-driven badge colors** (v2.6) - Automatic color rendering from database `color_code` field ([Pattern 7](./settings.md#pattern-7-database-driven-badge-color-system-v25))
- ✅ **Auto-detection** (v2.3) - Field capabilities detected by naming conventions
- ✅ **Inline editing** - Edit records without navigation (text, select, tags, files, numbers, dates)
- ✅ **Inline row adding** (v2.4) - Add new rows directly in settings tables
- ✅ **Drag & drop reordering** (v2.4) - Reorder rows with visual feedback and ID recalculation
- ✅ **Color picker** (v2.4) - Dropdown with predefined color options for settings
- ✅ **Sorting & filtering** - Client-side and server-side support
- ✅ **Pagination** - Configurable page sizes and navigation
- ✅ **Row actions** - View, edit, share, delete with permission control
- ✅ **Bulk selection** - Multi-row selection with checkboxes
- ✅ **Column selection** - Show/hide columns dynamically
- ✅ **Search** - Global search across all columns
- ✅ **Settings integration** - Auto-loads dropdown options from settings API
- ✅ **Responsive** - Sticky headers, horizontal scroll, mobile-friendly

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ EntityMainPage (Consumer)                                   │ │
│  │  - Loads entity config from entityConfig.ts                 │ │
│  │  - Fetches data from API                                    │ │
│  │  - Passes data & columns to DataTable                       │ │
│  └────────────┬───────────────────────────────────────────────┘ │
│               │                                                   │
│  ┌────────────▼───────────────────────────────────────────────┐ │
│  │ DataTable (Universal Component)                             │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │ 1. Auto-Detection (fieldCapabilities.ts)            │  │ │
│  │  │    - Detects editable fields by naming patterns     │  │ │
│  │  │    - Determines edit type (text/select/file/etc)    │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │ 2. Settings Loader (settingsLoader.ts)              │  │ │
│  │  │    - Loads dropdown options from settings API       │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │ 3. Rendering Engine                                  │  │ │
│  │  │    - Table: sorting, filtering, pagination          │  │ │
│  │  │    - Cells: display mode vs edit mode               │  │ │
│  │  │    - Actions: view, edit, share, delete             │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └────────────┬───────────────────────────────────────────────┘ │
└───────────────┼─────────────────────────────────────────────────┘
                │ Props: columns, data, onInlineEdit, etc.
                │
┌───────────────▼─────────────────────────────────────────────────┐
│                    BACKEND LAYER                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ API Endpoints                                               │ │
│  │  - GET /api/v1/{entity}?page=1&limit=20                   │ │
│  │  - PUT /api/v1/{entity}/:id (inline edit save)            │ │
│  │  - GET /api/v1/setting?category={category} (dropdown)     │ │
│  └────────────┬───────────────────────────────────────────────┘ │
│               │                                                   │
│  ┌────────────▼───────────────────────────────────────────────┐ │
│  │ Data Transformers (data-transformers.ts)                   │ │
│  │  - transformRequestBody: tags string → array              │ │
│  │  - Parse JSONB fields from database                        │ │
│  └────────────┬───────────────────────────────────────────────┘ │
│               │                                                   │
│  ┌────────────▼───────────────────────────────────────────────┐ │
│  │ Database (PostgreSQL)                                       │ │
│  │  - d_project, d_task, d_cust, etc. (13 core entities)     │ │
│  │  - setting_datalabel_* (16 settings tables)                │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
EntityMainPage
  └─ FilteredDataTable (wrapper with API integration)
      └─ DataTable (core component)
          ├─ TableHeader (sticky header with search/filters)
          ├─ TableBody
          │   └─ TableRow (for each record)
          │       ├─ SelectionCell (checkbox)
          │       ├─ DataCells (display or edit mode)
          │       │   ├─ InlineFileUploadCell (for files)
          │       │   ├─ SelectInput (for dropdowns)
          │       │   ├─ TextInput (for text/tags)
          │       │   ├─ NumberInput (for numbers)
          │       │   └─ DateInput (for dates)
          │       └─ ActionsCell (view/edit/share/delete)
          └─ Pagination (page navigation)
```

---

## Component Props Reference

### Core Props

#### `data: T[]` (Required)
**Type:** Array of records
**Purpose:** The data to display in the table
**Example:**
```typescript
const projects = [
  { id: 'uuid1', name: 'Project A', project_stage: 'Planning' },
  { id: 'uuid2', name: 'Project B', project_stage: 'Execution' }
];

<DataTable data={projects} columns={columns} />
```

**Backend Connection:**
- Data fetched from `GET /api/v1/{entity}?page=1&limit=20`
- API returns: `{ data: T[], total: number, page: number }`
- DRY: Same endpoint structure for ALL entities

---

#### `columns: Column<T>[]` (Required)
**Type:** Column configuration array
**Purpose:** Define what columns to display and how
**Example:**
```typescript
const columns: Column[] = [
  {
    key: 'name',
    title: 'Project Name',
    sortable: true,
    filterable: true,
    // ✅ v2.3: Auto-detected as editable (common field name)
  },
  {
    key: 'project_stage',
    title: 'Stage',
    sortable: true,
    loadOptionsFromSettings: true,
    // ✅ v2.3: Auto-detected as editable dropdown
    render: (value) => <Badge>{value}</Badge>
  },
  {
    key: 'tags',
    title: 'Tags',
    // ✅ v2.3: Auto-detected as editable tags field
    render: (value) => renderTags(value)
  }
];
```

**Backend Connection:**
- Column config stored in `entityConfig.ts` (single source of truth)
- `loadOptionsFromSettings: true` triggers: `GET /api/v1/setting?category={category}`
- DRY: Same settings API for ALL dropdown columns

**Column Interface:**
```typescript
interface Column<T = any> {
  key: string;                    // Field name (matches API response)
  title: string;                  // Display title
  sortable?: boolean;             // Enable sorting
  filterable?: boolean;           // Enable filtering
  render?: (value, record, allData) => ReactNode;  // Custom renderer
  width?: string | number;        // Column width
  align?: 'left' | 'center' | 'right';  // Text alignment
  loadOptionsFromSettings?: boolean;    // Trigger settings API
  // DEPRECATED: inlineEditable removed in v2.3 (auto-detected)
}
```

---

#### `inlineEditable: boolean` (Optional, default: false)
**Type:** Boolean flag
**Purpose:** Enable inline editing mode for the entire table
**Example:**
```typescript
<DataTable
  data={data}
  columns={columns}
  inlineEditable={true}
  editingRow={editingRowId}
  editedData={editedData}
  onInlineEdit={handleInlineEdit}
  onSaveInlineEdit={handleSave}
  onCancelInlineEdit={handleCancel}
/>
```

**v2.3 Auto-Detection:**
When `inlineEditable={true}`, DataTable automatically:
1. Detects which columns are editable using `fieldCapabilities.ts`
2. Determines edit type (text, select, tags, file, number, date)
3. Loads dropdown options for settings fields
4. Renders appropriate editor for each field type

**Backend Connection:**
- On save: `PUT /api/v1/{entity}/:id` with transformed data
- Data transformers convert: `{ tags: "tag1, tag2" }` → `{ tags: ["tag1", "tag2"] }`
- DRY: Same save endpoint for ALL entities

---

### Inline Editing Props

#### `editingRow: string | null`
**Purpose:** ID of the currently editing row
**Managed by:** Parent component (FilteredDataTable)
**Example:**
```typescript
const [editingRow, setEditingRow] = useState<string | null>(null);

// Start editing
const handleEdit = (record) => {
  setEditingRow(record.id);
  setEditedData({ ...record });
};
```

---

#### `editedData: any`
**Purpose:** Stores the edited field values
**Managed by:** Parent component
**Example:**
```typescript
const [editedData, setEditedData] = useState({});

// Update field
const handleInlineEdit = (rowId, field, value) => {
  setEditedData(prev => ({ ...prev, [field]: value }));
};
```

**Data Transformation:**
```typescript
// Before sending to API
import { transformForApi } from '@/lib/dataTransformers';

const handleSave = async (record) => {
  // Transform: tags string → array, etc.
  const transformedData = transformForApi(editedData, record);

  await fetch(`/api/v1/project/${record.id}`, {
    method: 'PUT',
    body: JSON.stringify(transformedData)
  });
};
```

---

#### `onInlineEdit: (rowId, field, value) => void`
**Purpose:** Callback when a field is edited
**Called by:** DataTable when user changes a field
**Example:**
```typescript
const handleInlineEdit = (rowId: string, field: string, value: any) => {
  setEditedData(prev => ({
    ...prev,
    [field]: value
  }));
};
```

---

#### `onSaveInlineEdit: (record) => void`
**Purpose:** Save edited data to backend
**Example:**
```typescript
const handleSave = async (record) => {
  const transformedData = transformForApi(editedData, record);

  const response = await fetch(`/api/v1/project/${record.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transformedData)
  });

  if (response.ok) {
    await fetchData(); // Refresh table
    setEditingRow(null);
    setEditedData({});
  }
};
```

---

### Action Props

#### `rowActions: RowAction[]`
**Type:** Custom action buttons
**Purpose:** Define custom row actions
**Example:**
```typescript
const rowActions: RowAction[] = [
  {
    key: 'approve',
    label: 'Approve',
    icon: <CheckCircle className="h-4 w-4" />,
    onClick: (record) => handleApprove(record),
    variant: 'primary',
    disabled: (record) => record.status === 'approved'
  }
];
```

---

#### `showDefaultActions: boolean` (default: true)
**Purpose:** Show built-in actions (view, edit, share, delete)
**Example:**
```typescript
<DataTable
  data={data}
  columns={columns}
  showDefaultActions={true}
  onView={(record) => navigate(`/project/${record.id}`)}
  onEdit={(record) => setEditingRow(record.id)}
  onShare={(record) => setShareModalOpen(true)}
  onDelete={(record) => handleDelete(record.id)}
/>
```

---

### Selection Props

#### `selectable: boolean`
**Purpose:** Enable row selection with checkboxes
**Example:**
```typescript
const [selectedRows, setSelectedRows] = useState<string[]>([]);

<DataTable
  data={data}
  columns={columns}
  selectable={true}
  selectedRows={selectedRows}
  onSelectionChange={setSelectedRows}
/>
```

---

### Pagination Props

#### `pagination: PaginationConfig`
**Type:** Pagination configuration object
**Example:**
```typescript
<DataTable
  data={data}
  columns={columns}
  pagination={{
    current: 1,
    pageSize: 20,
    total: 150,
    showSizeChanger: true,
    pageSizeOptions: [10, 20, 50, 100],
    onChange: (page, pageSize) => {
      fetchData({ page, limit: pageSize });
    }
  }}
/>
```

**Backend Connection:**
- Triggers: `GET /api/v1/project?page=2&limit=50`
- API returns: `{ data: [], total: 150, page: 2, limit: 50 }`
- DRY: Same pagination params for ALL entities

---

### Search & Filter Props

#### `searchable: boolean` (default: true)
**Purpose:** Enable global search input
**Behavior:** Client-side search across all columns

#### `filterable: boolean` (default: true)
**Purpose:** Enable column-specific filters
**Behavior:** Shows filter dropdowns for filterable columns

#### `columnSelection: boolean` (default: true)
**Purpose:** Enable column show/hide
**Behavior:** Shows column selector dropdown

---

## Backend API Integration

### Data Flow: Frontend → Backend

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Initial Load                                            │
├─────────────────────────────────────────────────────────────────┤
│ EntityMainPage                                                   │
│   └─ useEffect(() => { fetchData(); }, [])                      │
│        └─ GET /api/v1/project?page=1&limit=20                   │
│                                                                  │
│ Backend: apps/api/src/modules/project/routes.ts                 │
│   └─ SELECT * FROM app.d_project LIMIT 20 OFFSET 0             │
│        └─ Returns: { data: Project[], total: 150 }             │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Auto-Detection (v2.3)                                   │
├─────────────────────────────────────────────────────────────────┤
│ DataTable: detectColumnCapabilities(columns)                    │
│                                                                  │
│ For each column:                                                 │
│   - column.key = 'tags' → Detected as tags field               │
│   - column.key = 'project_stage' + loadOptionsFromSettings     │
│     → Detected as settings dropdown                             │
│   - column.key = 'invoice_attachment'                           │
│     → Detected as file upload                                   │
│                                                                  │
│ Source: apps/web/src/lib/fieldCapabilities.ts                   │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: Load Settings Options (if needed)                       │
├─────────────────────────────────────────────────────────────────┤
│ For columns with loadOptionsFromSettings:                       │
│   └─ GET /api/v1/setting?category=project_stage                │
│                                                                  │
│ Backend: apps/api/src/modules/setting/routes.ts                 │
│   └─ SELECT * FROM app.setting_datalabel_project_stage         │
│        WHERE active_flag = true ORDER BY sort_order             │
│        └─ Returns: [                                            │
│             { value: 'Planning', label: 'Planning' },          │
│             { value: 'Execution', label: 'Execution' }         │
│           ]                                                      │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: Render Table                                            │
├─────────────────────────────────────────────────────────────────┤
│ DataTable renders with:                                          │
│   - Display mode for all fields                                 │
│   - Edit icons if inlineEditable=true                           │
│   - Appropriate cell renderer for each field type               │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: User Edits Row                                          │
├─────────────────────────────────────────────────────────────────┤
│ User clicks Edit → editingRow = record.id                       │
│                                                                  │
│ DataTable renders edit mode:                                    │
│   - Tags field → Text input with comma separation              │
│   - project_stage → Dropdown with loaded options               │
│   - invoice_attachment → Drag-drop file upload                  │
│                                                                  │
│ User changes:                                                    │
│   - tags: "innovation, tech, healthcare"                        │
│   - project_stage: "Execution" (from dropdown)                  │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: Save Changes                                            │
├─────────────────────────────────────────────────────────────────┤
│ User clicks Save → onSaveInlineEdit(record)                     │
│                                                                  │
│ FilteredDataTable:                                               │
│   1. transformForApi(editedData, record)                        │
│      Input:  { tags: "innovation, tech, healthcare" }          │
│      Output: { tags: ["innovation", "tech", "healthcare"] }    │
│                                                                  │
│   2. PUT /api/v1/project/:id                                    │
│      Body: { tags: [...], project_stage: "Execution" }         │
│                                                                  │
│ Backend: apps/api/src/modules/project/routes.ts                 │
│   1. transformRequestBody(body) - ensures array format         │
│   2. UPDATE app.d_project                                       │
│      SET tags = '["innovation","tech","healthcare"]'::jsonb,   │
│          project_stage = 'Execution'                            │
│      WHERE id = :id                                             │
│   3. Return updated record                                      │
│                                                                  │
│   4. Parse JSONB fields for response                            │
│      if (typeof record.tags === 'string')                       │
│        record.tags = JSON.parse(record.tags)                   │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 7: Refresh Table                                           │
├─────────────────────────────────────────────────────────────────┤
│ FilteredDataTable:                                               │
│   └─ await fetchData() // Re-fetch from API                    │
│        └─ DataTable re-renders with updated data               │
└─────────────────────────────────────────────────────────────────┘
```

---

## DRY Principles & Auto-Detection

### DRY from Backend to Frontend

#### 1. Single Settings API for All Dropdowns

**Backend:** ONE endpoint for ALL settings
```typescript
// apps/api/src/modules/setting/routes.ts
fastify.get('/api/v1/setting', async (request, reply) => {
  const { category } = request.query;

  // DRY: Same logic for all 16 settings tables
  const tableName = `setting_datalabel_${category}`;
  const results = await db.query(`
    SELECT * FROM app.${tableName}
    WHERE active_flag = true
    ORDER BY sort_order
  `);

  return { data: results };
});
```

**Frontend:** DataTable automatically uses this API
```typescript
// Auto-detection in DataTable.tsx
if (column.loadOptionsFromSettings) {
  const options = await loadFieldOptions(column.key);
  // Dropdown automatically populated!
}
```

**Result:** Add new settings table in DB → Automatically works in ALL datatables

---

#### 2. Convention Over Configuration (v2.3)

**Backend Naming → Frontend Detection:**

| Backend Field Name | Auto-Detected As | Edit Type |
|-------------------|------------------|-----------|
| `tags` | Tags field | Text input (comma-separated) |
| `project_stage_name` | Settings dropdown | Select from `setting_datalabel_project_stage` |
| `customer_tier_name` | Settings dropdown | Select from `setting_datalabel_customer_tier` |
| `invoice_attachment` | File upload | Drag-drop upload to S3 |
| `budget_amount` | Number field | Number input |
| `due_date` | Date field | Date picker |
| `created_ts` | System field | Readonly (never editable) |

**Code:**
```typescript
// apps/web/src/lib/fieldCapabilities.ts
export function getFieldCapability(column: ColumnDef): FieldCapability {
  const key = column.key;

  // DRY: Convention rules apply to ALL entities
  if (/^tags$|_tags$/i.test(key)) {
    return { inlineEditable: true, editType: 'tags' };
  }

  if (/_name$|_stage$|_tier$/i.test(key) && column.loadOptionsFromSettings) {
    return {
      inlineEditable: true,
      editType: 'select',
      settingsCategory: extractSettingsCategory(key)
    };
  }

  // ... more convention rules
}
```

**Result:** Same field naming across entities → Same behavior everywhere

---

#### 3. Data Transformers (Bidirectional DRY)

**Frontend Transformer:**
```typescript
// apps/web/src/lib/dataTransformers.ts
export function transformForApi(data: Record<string, any>) {
  const transformed = { ...data };

  // DRY: Same transformation for ALL entities
  if (transformed.tags && typeof transformed.tags === 'string') {
    transformed.tags = transformed.tags.split(',').map(t => t.trim());
  }

  return transformed;
}
```

**Backend Transformer:**
```typescript
// apps/api/src/lib/data-transformers.ts
export function transformRequestBody(data: Record<string, any>) {
  const transformed = { ...data };

  // DRY: Same transformation for ALL entities
  if (transformed.tags && typeof transformed.tags === 'string') {
    transformed.tags = transformed.tags.split(',').map(t => t.trim());
  }

  return transformed;
}
```

**Result:** Tags transformation works for projects, tasks, customers, etc.

---

### Convention Rules Summary

```typescript
// Single source of truth: fieldCapabilities.ts
const DETECTION_RULES = {
  // Pattern → Behavior mapping (applies to ALL entities)

  tags: /^tags$|_tags$/i,
  // → ALL entities: tags field = editable comma-separated text

  settingsDropdown: /_name$|_stage$|_tier$|_level$|_status$/i,
  // → ALL entities: *_name fields with loadOptionsFromSettings = editable dropdown

  fileUpload: /(attachment|invoice|receipt|upload|document)/i,
  // → ALL entities: *attachment fields = drag-drop file upload

  readonly: /^(id|created_ts|updated_ts|from_ts|to_ts)$/i,
  // → ALL entities: system fields = never editable

  number: /_amount$|_count$|_qty$|_id$|sort_order$/i,
  // → ALL entities: numeric patterns = number input

  date: /_date$|_ts$/i (excluding readonly),
  // → ALL entities: date patterns = date picker
};
```

---

## Inline Editing System

### Edit Mode Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. DISPLAY MODE (Initial State)                                 │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Project Name   │ Stage      │ Tags                 │ [Edit] │ │
│ │ Innovation Hub │ Planning   │ tech, innovation     │        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ User clicks [Edit] button                                       │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. CAPABILITY DETECTION (Auto)                                   │
├─────────────────────────────────────────────────────────────────┤
│ DataTable calls: detectColumnCapabilities(columns)              │
│                                                                  │
│ Results:                                                         │
│   - name: { editable: true, editType: 'text' }                 │
│   - project_stage: { editable: true, editType: 'select' }      │
│   - tags: { editable: true, editType: 'tags' }                 │
│   - created_ts: { editable: false, editType: 'readonly' }      │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. EDIT MODE RENDERING                                          │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ [Input: Innovation Hub]  │ [Select▼] │ [Input: tech,...]  │ │
│ │                          │ Planning   │                     │ │
│ │                          │ Execution  │                     │ │
│ │                          │ Closure    │    [Save] [Cancel]  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Each field renders appropriate editor based on editType         │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. USER EDITS FIELDS                                            │
├─────────────────────────────────────────────────────────────────┤
│ User types: tags = "innovation, ai, machine-learning"          │
│                                                                  │
│ onInlineEdit('uuid', 'tags', 'innovation, ai, machine-learning')│
│   └─ setEditedData({ tags: 'innovation, ai, ...' })           │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. SAVE & TRANSFORM                                             │
├─────────────────────────────────────────────────────────────────┤
│ User clicks [Save]                                              │
│                                                                  │
│ onSaveInlineEdit(record)                                        │
│   1. transformForApi(editedData)                                │
│      - Convert tags string to array                             │
│      - Format dates, numbers, etc.                              │
│                                                                  │
│   2. PUT /api/v1/project/:id                                    │
│      - Send transformed data to backend                         │
│                                                                  │
│   3. Backend: transformRequestBody(body)                        │
│      - Additional server-side validation                        │
│      - Save to database                                         │
│                                                                  │
│   4. fetchData() - Refresh table with latest data               │
└─────────────────────────────────────────────────────────────────┘
```

### Field Type Renderers

```typescript
// DataTable.tsx - Cell rendering logic

const capability = columnCapabilities.get(column.key);

if (isEditing && capability.inlineEditable) {
  switch (capability.editType) {
    case 'file':
      return (
        <InlineFileUploadCell
          value={record[column.key]}
          onUploadComplete={(url) => onInlineEdit(rowId, column.key, url)}
        />
      );

    case 'select':
      return (
        <select
          value={editedData[column.key]}
          onChange={(e) => onInlineEdit(rowId, column.key, e.target.value)}
        >
          {settingOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );

    case 'tags':
      return (
        <input
          type="text"
          value={editedData[column.key]}
          onChange={(e) => onInlineEdit(rowId, column.key, e.target.value)}
          placeholder="Enter tags (comma-separated)"
        />
      );

    case 'number':
      return (
        <input
          type="number"
          value={editedData[column.key]}
          onChange={(e) => onInlineEdit(rowId, column.key, e.target.value)}
        />
      );

    case 'date':
      return (
        <input
          type="date"
          value={editedData[column.key]}
          onChange={(e) => onInlineEdit(rowId, column.key, e.target.value)}
        />
      );

    default: // 'text'
      return (
        <input
          type="text"
          value={editedData[column.key]}
          onChange={(e) => onInlineEdit(rowId, column.key, e.target.value)}
        />
      );
  }
}
```

---

## Column Configuration

### Basic Column

```typescript
{
  key: 'name',
  title: 'Project Name',
  sortable: true,
  filterable: true
}
```

### Column with Custom Renderer

```typescript
{
  key: 'budget_allocated',
  title: 'Budget',
  align: 'right',
  render: (value, record) => {
    return formatCurrency(value, record.currency || 'CAD');
  }
}
```

### Settings Dropdown Column

```typescript
{
  key: 'project_stage',
  title: 'Stage',
  sortable: true,
  loadOptionsFromSettings: true,  // ← Triggers settings API
  // ✅ v2.3: Auto-detected as editable dropdown
  render: (value) => <Badge color={getStageColor(value)}>{value}</Badge>
}
```

### Tags Column

```typescript
{
  key: 'tags',
  title: 'Tags',
  // ✅ v2.3: Auto-detected as editable tags field
  render: (value) => {
    if (!Array.isArray(value)) return null;
    return (
      <div className="flex gap-1 flex-wrap">
        {value.map(tag => (
          <Badge key={tag} variant="secondary">{tag}</Badge>
        ))}
      </div>
    );
  }
}
```

### File Upload Column

```typescript
{
  key: 'invoice_attachment',
  title: 'Invoice',
  // ✅ v2.3: Auto-detected as file upload field
  render: (value) => {
    if (!value) return <span className="text-gray-400">No file</span>;
    const ext = value.split('.').pop()?.toUpperCase();
    return (
      <div className="flex items-center gap-2">
        <FileIcon className="h-4 w-4" />
        <span>{ext}</span>
        <CheckCircle className="h-3 w-3 text-green-500" />
      </div>
    );
  }
}
```

---

## Data Flow Examples

### Example 1: Load Projects with Settings

```typescript
// EntityMainPage.tsx
const ProjectsPage = () => {
  const [data, setData] = useState([]);
  const config = getEntityConfig('project');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    // Backend: GET /api/v1/project
    const response = await fetch('/api/v1/project?page=1&limit=20');
    const json = await response.json();
    setData(json.data);
  };

  return (
    <DataTable
      data={data}
      columns={config.columns}
      inlineEditable={true}
    />
  );
};
```

**Backend Response:**
```json
{
  "data": [
    {
      "id": "uuid1",
      "name": "Innovation Hub",
      "project_stage": "Planning",
      "tags": ["tech", "innovation"],
      "created_ts": "2025-01-15T10:00:00Z"
    }
  ],
  "total": 1,
  "page": 1
}
```

**Auto-Detection:**
- `name` → Text input (common field name)
- `project_stage` → Dropdown (by `_stage` suffix + config)
- `tags` → Tags input (by name 'tags')
- `created_ts` → Readonly (system field)

---

### Example 2: Inline Edit with Tags

```typescript
// FilteredDataTable.tsx
const handleSaveInlineEdit = async (record) => {
  // User edited: tags = "innovation, ai, machine-learning"

  // Transform for API
  const transformedData = transformForApi(editedData, record);
  // Result: { tags: ["innovation", "ai", "machine-learning"] }

  // Send to backend
  const response = await fetch(`/api/v1/project/${record.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transformedData)
  });

  if (response.ok) {
    await fetchData(); // Refresh
    setEditingRow(null);
  }
};
```

**Backend Processing:**
```typescript
// apps/api/src/modules/project/routes.ts
fastify.put('/api/v1/project/:id', async (request, reply) => {
  const data = transformRequestBody(request.body);
  // Ensures tags is array format

  await db.execute(sql`
    UPDATE app.d_project
    SET tags = ${JSON.stringify(data.tags)}::jsonb,
        updated_ts = NOW()
    WHERE id = ${request.params.id}
  `);

  return { success: true };
});
```

---

## Advanced Features

### Sticky Header

```typescript
// Automatic in DataTable
<thead className="sticky top-0 z-10 bg-white">
  {/* Header always visible while scrolling */}
</thead>
```

### Column Reordering

```typescript
const [visibleColumns, setVisibleColumns] = useState(columns);

<DataTable
  data={data}
  columns={visibleColumns}
  columnSelection={true}
/>
```

### Bulk Actions

```typescript
const [selectedRows, setSelectedRows] = useState<string[]>([]);

const handleBulkDelete = async () => {
  await Promise.all(
    selectedRows.map(id =>
      fetch(`/api/v1/project/${id}`, { method: 'DELETE' })
    )
  );
  await fetchData();
  setSelectedRows([]);
};

<DataTable
  data={data}
  columns={columns}
  selectable={true}
  selectedRows={selectedRows}
  onSelectionChange={setSelectedRows}
/>

{selectedRows.length > 0 && (
  <button onClick={handleBulkDelete}>
    Delete {selectedRows.length} selected
  </button>
)}
```

---

## Settings Table Enhancements (v2.4)

### Overview

Version 2.4 introduces specialized features for **settings entities** (data label configuration tables), enabling inline row management, drag-and-drop reordering, and enhanced color selection. These features are automatically activated for settings tables while maintaining backward compatibility with regular entity tables.

### Settings Entity Detection

**Automatic Detection Pattern:**
```typescript
// FilteredDataTable.tsx
const isSettingsEntity = useMemo(() => {
  return config?.apiEndpoint?.includes('/api/v1/setting?datalabel=') || false;
}, [config]);
```

**When Detected:**
- API endpoint matches `/api/v1/setting?datalabel={category}`
- Automatically enables: inline row adding, reordering, color picker
- Automatically hides: view action icon (keeps edit/delete)

**Applies to all 13 settings entities:**
- `position_level`, `office_level`, `business_level`
- `project_stage`, `task_stage`, `task_priority`
- `customer_tier`, `client_status`
- `industry_sector`, `acquisition_channel`
- `opportunity_funnel_stage`
- `form_approval_status`, `form_submission_status`
- `wiki_publication_status`

---

### Feature 1: Inline Row Adding

**Purpose:** Add new settings rows directly in the table without navigation.

**UI Component:**
```tsx
{isSettingsEntity && (
  <div className="mb-4 flex justify-end">
    <button
      onClick={handleAddRow}
      disabled={!!editingRow}
      className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-normal rounded text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:bg-gray-100 disabled:text-gray-400"
    >
      <PlusIcon className="h-4 w-4 mr-2 stroke-[1.5]" />
      Add Row
    </button>
  </div>
)}
```

**Design:** Light gray border button (v2.5 standard - see [Styling Patterns](./styling_patterns.md))

**Implementation Flow:**
```typescript
// FilteredDataTable.tsx
const handleAddRow = () => {
  if (!isSettingsEntity) return;

  // Calculate next ID
  const maxId = data.length > 0
    ? Math.max(...data.map((d: any) => parseInt(d.id) || 0))
    : -1;
  const newId = (maxId + 1).toString();

  // Create empty row
  const newRow = {
    id: newId,
    name: '',
    descr: '',
    parent_id: null,
    color_code: 'gray'  // v2.5: Default gray color
  };

  // Add to state and enter edit mode
  setData([...data, newRow]);
  setEditingRow(newId);
  setEditedData(newRow);
  setIsAddingRow(true);
};

// Save new row via POST
const handleSaveNewRow = async () => {
  const datalabel = extractDatalabel(config.apiEndpoint);
  const createEndpoint = `/api/v1/setting/${datalabel}`;

  const response = await fetch(`${API_BASE_URL}${createEndpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(editedData)
  });

  if (response.ok) {
    await fetchData();
    setEditingRow(null);
    setEditedData({});
    setIsAddingRow(false);
  }
};
```

**User Experience:**
1. Click "Add Row" button
2. Empty row appears at bottom with auto-incremented ID
3. Row automatically enters edit mode
4. Fill in name, description, select color
5. Click Save (POST) or Cancel (removes row)

---

### Feature 2: Color Picker Dropdown

**Purpose:** Provide consistent color selection from predefined options.

**Color Options:**
```typescript
// settingsConfig.ts
export const COLOR_OPTIONS = [
  { value: 'blue', label: 'Blue' },
  { value: 'purple', label: 'Purple' },
  { value: 'green', label: 'Green' },
  { value: 'red', label: 'Red' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'orange', label: 'Orange' },
  { value: 'gray', label: 'Gray' },
  { value: 'cyan', label: 'Cyan' },
  { value: 'pink', label: 'Pink' },
  { value: 'amber', label: 'Amber' },
] as const;
```

**Rendering in DataTable:**
```typescript
// DataTable.tsx - Inline edit mode
{column.key === 'color_code' && colorOptions ? (
  <div className="relative w-full">
    <select
      value={editedData[column.key] ?? record[column.key] ?? ''}
      onChange={(e) => onInlineEdit?.(recordId, column.key, e.target.value)}
      className="w-full px-2.5 py-1.5 pr-8 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400/30 focus:border-gray-400"
    >
      <option value="">Select color...</option>
      {colorOptions.map(opt => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    <ChevronDown className="h-4 w-4 text-gray-500 absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />
  </div>
) : (
  // Other field types...
)}
```

**Benefits:**
- ✅ No typos (dropdown prevents free text)
- ✅ Consistent colors across platform
- ✅ Easy to add new colors (single source of truth)
- ✅ Visual consistency with color badges

---

### Feature 3: Row Reordering with ID Recalculation

**Purpose:** Allow users to reorder settings rows with automatic ID updates.

**Implementation:**
```typescript
// FilteredDataTable.tsx
const handleReorder = async (newData: any[]) => {
  if (!isSettingsEntity || !config) return;

  // Recalculate IDs based on new positions
  const reorderedData = newData.map((item, index) => ({
    ...item,  // Preserve ALL fields
    id: index.toString()  // Only override ID
  }));

  // Update local state immediately (optimistic UI)
  setData(reorderedData);

  // Update sequentially to avoid race conditions
  const datalabel = extractDatalabel(config.apiEndpoint);

  for (let newIndex = 0; newIndex < reorderedData.length; newIndex++) {
    const item = reorderedData[newIndex];
    const updateEndpoint = `/api/v1/setting/${datalabel}/${newIndex}`;

    await fetch(`${API_BASE_URL}${updateEndpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(item)  // Complete item with new ID
    });
  }

  // Refresh from server
  await fetchData();
};
```

**Key Design Decisions:**

1. **Preserve All Fields:**
   ```typescript
   // ✅ Correct - preserves all data
   { ...item, id: index.toString() }

   // ❌ Wrong - loses fields
   { id: '0', name: item.name, descr: item.descr }
   ```

2. **Sequential Updates:**
   ```typescript
   // ✅ Correct - sequential
   for (let i = 0; i < items.length; i++) {
     await updateItem(i);
   }

   // ❌ Wrong - parallel causes race conditions
   await Promise.all(items.map(updateItem));
   ```

3. **Complete Data Spread:**
   - All fields must be sent to API during reorder
   - Only `id` field gets overwritten
   - Prevents data loss or corruption

**Example:**
```
Before reorder:
  0: { id: "0", name: "Level 1", color: "blue", parent_id: null }
  1: { id: "1", name: "Level 2", color: "green", parent_id: "0" }
  2: { id: "2", name: "Level 3", color: "red", parent_id: "1" }

User drags row 2 to position 0

After reorder:
  0: { id: "0", name: "Level 3", color: "red", parent_id: "1" }
  1: { id: "1", name: "Level 1", color: "blue", parent_id: null }
  2: { id: "2", name: "Level 2", color: "green", parent_id: "0" }
```

---

### Feature 4: Hidden View Action

**Purpose:** Simplify settings table interface by removing view icon.

**Implementation:**
```typescript
// FilteredDataTable.tsx
const rowActions: RowAction[] = useMemo(() => {
  if (!config || !showActionIcons) return [];
  const actions: RowAction[] = [];

  // Don't show view icon for settings entities
  if (showActionIcons && !isSettingsEntity) {
    actions.push({
      key: 'view',
      label: 'View',
      icon: <Eye className="h-4 w-4" />,
      onClick: (record) => handleRowClick(record)
    });
  }

  // Edit and delete always shown
  if (showEditIcon) {
    actions.push({ key: 'edit', ... });
  }
  if (showDeleteIcon) {
    actions.push({ key: 'delete', ... });
  }

  return actions;
}, [config, isSettingsEntity, showActionIcons, showEditIcon, showDeleteIcon]);
```

**Rationale:**
- Settings rows are simple configuration data
- No detail page to navigate to
- Edit and delete are sufficient actions
- Cleaner, less cluttered interface

---

### Props Added for Settings Features

```typescript
// DataTable.tsx - New props interface
export interface DataTableProps<T = any> {
  // ... existing props

  // Settings entity support (v2.4)
  colorOptions?: { value: string; label: string }[];
  allowReordering?: boolean;
  onReorder?: (newData: T[]) => void;
}
```

**Usage Example:**
```typescript
<DataTable
  data={data}
  columns={columns}
  inlineEditable={true}
  editingRow={editingRow}
  onInlineEdit={handleInlineEdit}
  onSaveInlineEdit={handleSaveInlineEditWrapper}
  onCancelInlineEdit={handleCancelInlineEditWrapper}

  // Settings-specific props (passed only when isSettingsEntity = true)
  colorOptions={isSettingsEntity ? COLOR_OPTIONS : undefined}
  allowReordering={isSettingsEntity}
  onReorder={handleReorder}
/>
```

---

## Drag & Drop System (v2.4)

### Overview

Version 2.4 introduces an intuitive drag-and-drop reordering system for settings tables, featuring:
- **No drag handle column** - Entire row is draggable
- **Visual feedback** - Gray pulsing line shows drop position (v2.5: light gray styling)
- **Smooth animations** - Professional appearance
- **Data integrity** - All fields preserved during reorder

### Visual Design

**Hover State (v2.5):**
```css
/* Row becomes draggable on hover */
cursor: move;
background: rgb(243 244 246 / 0.4);  /* Light gray-100 */
box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
transition: all 200ms;
```

**Dragging State:**
```css
/* Dragged row appearance */
opacity: 0.4;
transform: scale(0.98);
background: rgb(243 244 246);  /* Gray-100 */
```

**Drop Target (v2.5 - Gray Styling):**
```css
/* Gray pulsing line above target row */
.drop-indicator {
  height: 4px;
  background: rgb(107 114 128);  /* Gray-500 */
  box-shadow: 0 0 8px rgba(107, 114, 128, 0.5);
  animation: pulse 1.5s infinite;
}

/* Target row background */
background: rgb(243 244 246 / 0.5);  /* Light gray-100 */
```

---

### Implementation

**Drag State Management:**
```typescript
// DataTable.tsx
const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
```

**Drag Handlers:**
```typescript
const handleDragStart = (e: React.DragEvent, index: number) => {
  if (!allowReordering) return;
  setDraggedIndex(index);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
};

const handleDragOver = (e: React.DragEvent, index: number) => {
  if (!allowReordering || draggedIndex === null) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  if (index !== dragOverIndex) {
    setDragOverIndex(index);
  }
};

const handleDrop = (e: React.DragEvent, dropIndex: number) => {
  if (!allowReordering || draggedIndex === null) return;
  e.preventDefault();

  if (draggedIndex !== dropIndex) {
    const newData = [...filteredAndSortedData];
    const draggedItem = newData[draggedIndex];

    // Remove from old position
    newData.splice(draggedIndex, 1);

    // Insert at new position
    newData.splice(dropIndex, 0, draggedItem);

    // Callback to parent with reordered data
    onReorder?.(newData);
  }

  setDraggedIndex(null);
  setDragOverIndex(null);
};

const handleDragEnd = () => {
  if (!allowReordering) return;
  setDraggedIndex(null);
  setDragOverIndex(null);
};
```

**Row Rendering:**
```typescript
<>
  {/* Drop indicator line (v2.5: gray styling) */}
  {isDragOver && draggedIndex !== null && (
    <tr className="relative pointer-events-none">
      <td colSpan={columns.length} className="p-0 h-0">
        <div
          className="absolute left-0 right-0 h-1 bg-gray-500 shadow-lg z-50 animate-pulse"
          style={{
            top: '-2px',
            boxShadow: '0 0 8px rgba(107, 114, 128, 0.5)'
          }}
        />
      </td>
    </tr>
  )}

  {/* Draggable row (v2.5: gray hover states) */}
  <tr
    draggable={allowReordering && !isEditing}
    onDragStart={(e) => handleDragStart(e, index)}
    onDragOver={(e) => handleDragOver(e, index)}
    onDragLeave={handleDragLeave}
    onDrop={(e) => handleDrop(e, index)}
    onDragEnd={handleDragEnd}
    className={`
      ${isDragging ? 'opacity-40 scale-[0.98] bg-gray-100' : ''}
      ${isDragOver ? 'bg-gray-100/50' : ''}
      ${allowReordering && !isEditing ? 'cursor-move hover:bg-gray-100/40 hover:shadow-md' : ''}
      transition-all duration-200
    `}
  >
    {/* Row cells */}
  </tr>
</>
```

---

### User Experience Flow

```
1. USER HOVERS OVER ROW
   └─> Cursor changes to move icon (⋮⋮)
   └─> Row background highlights in light gray (v2.5)
   └─> Subtle shadow appears

2. USER CLICKS AND HOLDS ROW
   └─> Row becomes semi-transparent (40%)
   └─> Row slightly scales down (98%)
   └─> Row background turns gray

3. USER DRAGS UP OR DOWN
   └─> Gray pulsing line appears above potential drop target (v2.5)
   └─> Target row background turns light gray (v2.5)
   └─> Clear visual indication of drop position

4. USER RELEASES MOUSE
   └─> Row drops into new position
   └─> All data moves with the row
   └─> IDs recalculated (0, 1, 2, 3...)
   └─> Sequential API updates (PUT for each row)
   └─> Data refreshed from server
   └─> Visual feedback disappears smoothly
```

---

### Key Design Decisions

**1. No Drag Handle Column**
- **Before:** Had dedicated ☰ column (40px wide)
- **After:** Entire row is draggable
- **Benefit:** More intuitive, less clutter

**2. Visual Drop Indicator**
- **Gray pulsing line** - Shows exact drop position (v2.5: light gray-500)
- **Target row highlight** - Confirms hover state
- **Animation** - Draws user's attention

**3. Prevent Drag While Editing**
```typescript
draggable={allowReordering && !isEditing}
```
- Can't drag a row that's being edited
- Prevents accidental drags during data entry

**4. Optimistic UI Update**
```typescript
// Update state immediately
setData(reorderedData);

// Then update API
for (let i = 0; i < reorderedData.length; i++) {
  await updateItem(i);
}

// Finally refresh from server
await fetchData();
```
- Instant visual feedback
- Server sync happens in background
- Final refresh ensures consistency

---

### Performance Considerations

**Sequential vs Parallel Updates:**
```typescript
// ✅ Sequential (chosen approach)
for (let i = 0; i < items.length; i++) {
  await updateItem(i);
}
// Pros: Prevents race conditions, data integrity
// Cons: Slower (~300-500ms for 6 rows)

// ❌ Parallel (not used)
await Promise.all(items.map(updateItem));
// Pros: Faster
// Cons: Race conditions, potential data corruption
```

**Why Sequential:**
- Settings tables typically have < 20 rows
- 500ms total time is acceptable
- Data integrity is critical
- Race conditions would cause bugs

**Optimization:**
- Optimistic UI update (instant visual feedback)
- Server refresh only after all updates complete
- Smooth 200ms transitions mask latency

---

### Testing Drag & Drop

**Manual Test:**
```bash
# 1. Start the app
./tools/start-all.sh

# 2. Navigate to settings page
open http://localhost:5173/setting?datalabel=position_level

# 3. Hover over row → See cursor change + highlight
# 4. Click and drag row → See transparency + gray line (v2.5)
# 5. Drop at target → See reorder + ID updates
# 6. Verify in database
./tools/run_query.sh "SELECT id, name FROM app.setting_datalabel_position_level ORDER BY id;"
```

**Console Debugging:**
```typescript
// Add to handleReorder in FilteredDataTable.tsx
console.log('Reorder triggered');
console.log('New data order:', newData.map(d => ({ id: d.id, name: d.name })));

// Should show:
// [
//   { id: '0', name: 'Senior' },
//   { id: '1', name: 'Junior' },
//   { id: '2', name: 'Executive' }
// ]
```

---

## Testing & Debugging

### Debug Auto-Detection

```typescript
// Add console.log in DataTable.tsx
const columnCapabilities = useMemo(() => {
  const caps = detectColumnCapabilities(initialColumns);
  console.log('Column Capabilities:', Array.from(caps.entries()));
  return caps;
}, [initialColumns]);

// Output:
// [
//   ['name', { inlineEditable: true, editType: 'text' }],
//   ['project_stage', { inlineEditable: true, editType: 'select' }],
//   ['tags', { inlineEditable: true, editType: 'tags' }]
// ]
```

### Test Inline Edit

```bash
# 1. Start the app
./tools/start-all.sh

# 2. Navigate to entity page
open http://localhost:5173/project

# 3. Click edit button on a row
# 4. Change tags field: "tag1, tag2, tag3"
# 5. Click save

# 6. Check API logs
./tools/logs-api.sh 50 | grep "PUT /api/v1/project"

# 7. Verify database
./tools/run_query.sh "SELECT id, name, tags FROM app.d_project LIMIT 1;"
```

### Common Issues

**Issue:** Dropdown not showing options
```typescript
// Check: Does column have loadOptionsFromSettings?
{ key: 'project_stage', loadOptionsFromSettings: true }

// Check: Does settings table exist?
./tools/run_query.sh "SELECT * FROM app.setting_datalabel_project_stage;"

// Check: Are options loaded?
console.log('Settings Options:', settingOptions);
```

**Issue:** Tags not saving as array
```typescript
// Check transformer is applied
const transformed = transformForApi({ tags: "a, b, c" });
console.log(transformed); // Should be { tags: ["a", "b", "c"] }
```

---

## Summary

### Key Takeaways

1. **Universal Component** - One DataTable handles ALL 13+ entity types
2. **Auto-Detection (v2.3)** - Zero manual config, field behavior determined by naming
3. **Settings Enhancements (v2.4)** - Inline row adding, reordering, color picker for settings tables
4. **Drag & Drop (v2.4)** - Intuitive row reordering with visual feedback and data integrity
5. **DRY Backend Integration** - Same endpoints, same transformers, same patterns
6. **Convention Over Configuration** - Field names dictate behavior
7. **Bidirectional Transformation** - Automatic data format conversion
8. **Settings Integration** - Dropdown options loaded from settings API
9. **Inline Editing** - Edit records without navigation
10. **Visual Feedback** - Gray pulsing drop indicators (v2.5), smooth animations

### Version History

| Version | Date | Changes |
|---------|------|---------|
| **v2.6** | 2025-10-29 | Database-driven badge colors |
| **v2.5** | 2025-10-29 | Color & border standardization (gray-300 universal) |
| **v2.4** | 2025-10-29 | Settings table enhancements, drag-and-drop, color picker |
| **v2.3** | 2025-10-28 | Auto-detection, convention over configuration |
| **v2.0** | 2025-10-23 | Initial DRY architecture, inline editing |

### Files Reference

| File | Purpose |
|------|---------|
| `apps/web/src/components/shared/ui/DataTable.tsx` | Core component with drag-drop |
| `apps/web/src/components/shared/dataTable/FilteredDataTable.tsx` | Wrapper with API integration + settings features |
| `apps/web/src/lib/settingsConfig.ts` | Settings registry, factory pattern, COLOR_OPTIONS |
| `apps/web/src/lib/fieldCapabilities.ts` | Auto-detection rules |
| `apps/web/src/lib/dataTransformers.ts` | Frontend transformers |
| `apps/web/src/lib/entityConfig.ts` | Column configurations |
| `apps/api/src/lib/data-transformers.ts` | Backend transformers |
| `apps/api/src/modules/{entity}/routes.ts` | Entity API endpoints |
| `apps/api/src/modules/setting/routes.ts` | Settings API with PUT/POST |

### v2.5 Feature Summary (Color & Border Standardization)

**Universal Changes:**
- ✅ All borders standardized to gray-300 (#D1D5DB)
- ✅ All buttons use light gray border style
- ✅ Gray pulsing line drop indicator (was blue)
- ✅ Gray hover states for drag-drop (was blue)
- ✅ Default color_code changed to 'gray' (was 'blue')

**Reference:** See [Styling Patterns v5.0](./styling_patterns.md)

### v2.4 Feature Summary

**Settings Tables Only:**
- ✅ Inline row adding with "Add Row" button
- ✅ Drag-and-drop row reordering (entire row draggable)
- ✅ Visual drop indicator with pulsing animation
- ✅ ID recalculation after reorder (0, 1, 2, 3...)
- ✅ Color picker dropdown (10 predefined colors)
- ✅ Hidden view icon (cleaner interface)
- ✅ Sequential API updates (data integrity)
- ✅ Optimistic UI updates (instant feedback)

**Regular Tables:**
- ✅ All v2.3 features remain unchanged
- ✅ No impact on existing functionality
- ✅ Backward compatible

---

**Last Updated:** 2025-10-29
**Version:** v2.4 - Settings Table Enhancements & Drag-Drop
**Status:** ✅ Production Ready
**Test Page:** http://localhost:5173/setting?datalabel=position_level
