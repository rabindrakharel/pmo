# DataTable Component - Complete Technical Documentation

> **Universal table component** with auto-detection, inline editing, sorting, filtering, and backend integration

**Component:** `apps/web/src/components/shared/ui/DataTable.tsx`
**Created:** 2025-10-23
**Last Updated:** 2025-10-28 (v2.3 - Convention Over Configuration)
**Related:** [UI/UX Architecture](./ui_ux_route_api.md), [Settings System](./settings.md), [Field Capabilities](../apps/web/src/lib/fieldCapabilities.ts)

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
9. [Testing & Debugging](#testing--debugging)

---

## Overview & Architecture

### What is DataTable?

**DataTable** is a universal, feature-rich table component that powers ALL entity list views in the PMO platform. It's the core component used by `EntityMainPage` and `FilteredDataTable`.

### Key Features

- ✅ **Auto-detection** (v2.3) - Field capabilities detected by naming conventions
- ✅ **Inline editing** - Edit records without navigation (text, select, tags, files, numbers, dates)
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
3. **DRY Backend Integration** - Same endpoints, same transformers, same patterns
4. **Convention Over Configuration** - Field names dictate behavior
5. **Bidirectional Transformation** - Automatic data format conversion
6. **Settings Integration** - Dropdown options loaded from settings API
7. **Inline Editing** - Edit records without navigation

### Files Reference

| File | Purpose |
|------|---------|
| `apps/web/src/components/shared/ui/DataTable.tsx` | Core component |
| `apps/web/src/components/shared/dataTable/FilteredDataTable.tsx` | Wrapper with API integration |
| `apps/web/src/lib/fieldCapabilities.ts` | Auto-detection rules |
| `apps/web/src/lib/dataTransformers.ts` | Frontend transformers |
| `apps/web/src/lib/entityConfig.ts` | Column configurations |
| `apps/api/src/lib/data-transformers.ts` | Backend transformers |
| `apps/api/src/modules/{entity}/routes.ts` | Entity API endpoints |
| `apps/api/src/modules/setting/routes.ts` | Settings API |

---

**Last Updated:** 2025-10-28
**Version:** v2.3 - TRUE DRY with Convention Over Configuration
**Status:** ✅ Production Ready
