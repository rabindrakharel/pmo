# SettingsDataTable Component Documentation

> **Specialized table component for settings/datalabel management with full CRUD operations**
> Complete DRY architecture with drag & drop reordering, inline editing, and array position-based ordering

---

## 1. Semantics & Business Context

### Purpose

The **SettingsDataTable** is a lightweight, purpose-built table component designed exclusively for managing settings and datalabels in the PMO platform. It implements the complete CRUD lifecycle (Create, Read, Update, Delete) with drag & drop reordering support, optimized for the fixed settings schema.

### Business Value

- **Centralized Settings Management**: Single component handles all 16 settings categories (project_stage, task_priority, customer_tier, etc.)
- **Visual Configuration**: Business users can manage workflow stages, priorities, and hierarchies with colored visual indicators
- **Order Control**: Drag & drop reordering allows business users to define display order for dropdowns and kanban boards
- **Real-time Updates**: Changes persist immediately to database and reflect across the entire platform

### Use Cases

| Settings Category | Business Purpose | Example Data |
|------------------|------------------|--------------|
| **project_stage** | Define project lifecycle phases | Initiation → Planning → Execution → Closure |
| **task_priority** | Task urgency levels | Low, Medium, High, Critical |
| **customer_tier** | Customer classification | Bronze, Silver, Gold, Platinum |
| **opportunity_funnel_stage** | Sales pipeline stages | Lead → Prospect → Proposal → Closed |
| **business_level** | Organizational hierarchy | Corporate, Regional, Local |

**File Location:** `/home/rabin/projects/pmo/apps/web/src/components/shared/ui/SettingsDataTable.tsx`

**Lines of Code:** ~600 (vs 1350+ for EntityDataTable)

---

## 2. Architecture, Block Diagrams & DRY Design Patterns

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SETTINGS DATA TABLE                          │
│                 (DRY-First CRUD Component)                      │
└─────────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────────┐
│                    SETTINGS SERVICE LAYER                       │
│              (Centralized API Communication)                    │
│                                                                 │
│  • fetchSettingItems()         - GET all items                 │
│  • updateSettingItemMultiple() - PUT entire metadata           │
│  • createSettingItem()         - POST new item                 │
│  • deleteSettingItem()         - DELETE item                   │
│  • reorderSettingItems()       - PUT reorder metadata          │
│  • fetchAllCategories()        - GET categories list           │
└─────────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────────┐
│                       BACKEND API                               │
│              (Metadata Recomposition Logic)                     │
│                                                                 │
│  GET    /api/v1/setting?datalabel=:name                        │
│  POST   /api/v1/setting/:datalabel                             │
│  PUT    /api/v1/setting/:datalabel/:id                         │
│  DELETE /api/v1/setting/:datalabel/:id                         │
│  PUT    /api/v1/setting/:datalabel/reorder                     │
│  GET    /api/v1/setting/categories                             │
└─────────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────────┐
│                       DATABASE                                  │
│         Table: app.setting_datalabel                            │
│         Column: metadata (JSONB array)                          │
│                                                                 │
│  • Array position determines display order                     │
│  • No sort_order column - array index IS the order             │
│  • Complete metadata recomposition on every update             │
└─────────────────────────────────────────────────────────────────┘
```

### DRY Design Pattern: Complete Metadata Recomposition

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
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ SERVICE: Fetch fresh data                                      │
│ GET /api/v1/setting?datalabel=project_stage                    │
│ Returns: Complete updated metadata array                       │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ COMPONENT: Update local state                                  │
│ setData(result.metadata)  ← Fresh from server                  │
└─────────────────────────────────────────────────────────────────┘
```

**Benefits:**
- ✅ No partial update race conditions
- ✅ Backend is single source of truth
- ✅ Frontend always has fresh data
- ✅ ONE service handles ALL datalabels
- ✅ Consistent behavior everywhere

### Component Architecture

```typescript
SettingsDataTable
├── State Management
│   ├── sortField & sortDirection (disabled when reordering)
│   ├── editingRowId & editingData (inline edit state)
│   ├── isAddingRow & newRowData (add row state)
│   └── draggedIndex & dragOverIndex (drag & drop state)
│
├── Sub-Components
│   └── ColoredDropdown (inline color picker with visual badges)
│
├── CRUD Callbacks
│   ├── onRowUpdate: (id, updates) => void      // DRY: All fields at once
│   ├── onInlineEdit: (id, field, value) => void // Legacy: One field
│   ├── onAddRow: (newRecord) => void            // Create new item
│   ├── onDeleteRow: (id) => void                // Delete item
│   └── onReorder: (reorderedData) => void       // Drag & drop save
│
└── Feature Flags
    ├── allowAddRow (default: false)
    ├── allowEdit (default: true)
    ├── allowDelete (default: false)
    └── allowReorder (default: false)
```

### Array Position-Based Ordering

**Critical Design Decision:** Display order is determined by array position, NOT by ID or sort_order column.

```sql
-- Backend Query with WITH ORDINALITY
SELECT
  (elem.value->>'id')::text as id,
  elem.value->>'name' as name,
  elem.value->>'color_code' as color_code,
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

// Disable column header sorting when reordering
onClick={() => col.sortable && !allowReorder && handleSort(col.key)}
```

**Why This Matters:**
- ✅ Drag & drop reflects actual database array order
- ✅ No confusion between sorted view and actual order
- ✅ Reorder endpoint receives correct array sequence
- ✅ Database array position is preserved on save

---

## 3. Database, API & UI/UX Mapping

### Database Schema

```sql
-- Table: app.setting_datalabel
CREATE TABLE app.setting_datalabel (
    datalabel_name VARCHAR(100) PRIMARY KEY,  -- 'project__stage'
    ui_label VARCHAR(100) NOT NULL,            -- 'Project Stages'
    ui_icon VARCHAR(50),                       -- 'Briefcase'
    metadata JSONB NOT NULL,                   -- Array of items
    updated_ts TIMESTAMPTZ DEFAULT now()
);

-- Metadata Array Format
[
  {
    "id": 0,
    "name": "Initiation",
    "descr": "Project concept and initial planning",
    "parent_id": null,
    "color_code": "blue"
  },
  {
    "id": 1,
    "name": "Planning",
    "descr": "Detailed project planning",
    "parent_id": 0,
    "color_code": "purple"
  }
]
```

### API Endpoints

| Method | Endpoint | Purpose | Request Body | Response |
|--------|----------|---------|--------------|----------|
| **GET** | `/api/v1/setting?datalabel=:name` | Fetch all items | - | `{ data: SettingItem[] }` |
| **GET** | `/api/v1/setting/categories` | List all categories | - | `{ data: Category[] }` |
| **POST** | `/api/v1/setting/:datalabel` | Create new item | `{ name, descr?, parent_id?, color_code? }` | `{ success, data: SettingItem }` |
| **PUT** | `/api/v1/setting/:datalabel/:id` | Update item fields | `{ name?, descr?, parent_id?, color_code? }` | `{ success, data: SettingItem }` |
| **DELETE** | `/api/v1/setting/:datalabel/:id` | Delete item | - | `{ success, message }` |
| **PUT** | `/api/v1/setting/:datalabel/reorder` | Reorder array | `{ order: [{ id, position }] }` | `{ success, message }` |

### UI/UX Component Mapping

```typescript
interface SettingsRecord {
  id: string | number;        // → ID Column (non-editable, centered)
  name: string;               // → Name Column (colored badge, editable)
  descr?: string;             // → Description Column (text, editable)
  parent_id?: number | null;  // → Parent ID Column (number, editable)
  color_code: string;         // → Color Column (colored badge, dropdown editor)
  position?: number;          // → Array position (not displayed, used for ordering)
}
```

**Column Rendering:**

| Column | Display Mode | Edit Mode | Visual |
|--------|--------------|-----------|--------|
| **ID** | `<span>{id}</span>` | Non-editable | Plain text, centered |
| **Name** | `renderColorBadge(color_code, name)` | `<input type="text">` | Colored badge |
| **Description** | `<span>{descr \|\| '-'}</span>` | `<input type="text">` | Plain text |
| **Parent ID** | `<span>{parent_id \|\| '-'}</span>` | `<input type="number">` | Plain text, centered |
| **Color** | `renderColorBadge(color_code, capitalize(color_code))` | `<ColoredDropdown>` | Colored badge + dropdown |
| **Actions** | Edit/Delete icons | Save/Cancel icons | Gray icon buttons |

### Complete Data Flow Example

```
USER VISITS: /setting/projectStage

1. SettingDetailPage fetches config
   GET /api/v1/setting/categories
   → Find datalabel matching "projectStage" → "project__stage"

2. SettingDetailPage fetches data
   GET /api/v1/setting?datalabel=project_stage
   → Returns array in array position order (WITH ORDINALITY)

3. SettingsDataTable renders rows
   • If allowReorder=true → Display in array order (no sorting)
   • If allowReorder=false → Allow column header sorting

4. USER DRAGS row 3 to position 1

5. SettingsDataTable calls onReorder
   onReorder([item3, item0, item1, item2, item4])
   → New array order sent to backend

6. Backend reorders metadata array
   PUT /api/v1/setting/project_stage/reorder
   Body: { order: [
     { id: 3, position: 0 },
     { id: 0, position: 1 },
     { id: 1, position: 2 },
     { id: 2, position: 3 },
     { id: 4, position: 4 }
   ]}
   → Database metadata array reordered

7. Frontend updates local state
   setData(reorderedArray)
   → UI immediately reflects new order

8. USER REFRESHES PAGE
   → Data fetched in new array order (persisted)
```

---

## 4. Central Configuration & Middleware

### Settings Service Layer

**File:** `/home/rabin/projects/pmo/apps/web/src/services/settingsService.ts`

**Purpose:** DRY service layer for all settings operations. Single source of truth for API communication.

```typescript
// Core Functions
export async function fetchSettingItems(datalabel: string): Promise<SettingItem[]>
export async function updateSettingItemMultiple(datalabel, itemId, updates): Promise<SettingDatalabel | null>
export async function createSettingItem(datalabel, newItem): Promise<SettingItem | null>
export async function deleteSettingItem(datalabel, itemId): Promise<boolean>
export async function reorderSettingItems(datalabel, reorderedItems): Promise<boolean>
export async function fetchAllCategories(): Promise<Category[]>

// Type Definitions
export interface SettingItem {
  id: string | number;
  name: string;
  descr?: string;
  parent_id?: number | null;
  color_code: string;
  position?: number;  // Array position from backend
}

export interface SettingDatalabel {
  datalabel_name: string;
  ui_label: string;
  ui_icon: string | null;
  metadata: SettingItem[];
  updated_ts?: string;
}
```

**Authentication Middleware:**

```typescript
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}
```

### Color Configuration

**File:** `/home/rabin/projects/pmo/apps/web/src/lib/settingsConfig.ts`

**Purpose:** Central color mapping for all settings badges.

```typescript
// Master Color Map
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
export function renderColorBadge(colorCode: string, label: string): React.ReactElement {
  const colorClass = COLOR_MAP[colorCode] || COLOR_MAP.gray;
  return (
    <span className={`inline-flex items-center rounded-full font-medium px-2.5 py-0.5 text-xs ${colorClass}`}>
      {label}
    </span>
  );
}

// Color Options for Dropdown
export const COLOR_OPTIONS = [
  { value: 'blue', label: 'Blue', metadata: { color_code: 'blue' } },
  { value: 'purple', label: 'Purple', metadata: { color_code: 'purple' } },
  { value: 'green', label: 'Green', metadata: { color_code: 'green' } },
  { value: 'red', label: 'Red', metadata: { color_code: 'red' } },
  { value: 'yellow', label: 'Yellow', metadata: { color_code: 'yellow' } },
  { value: 'orange', label: 'Orange', metadata: { color_code: 'orange' } },
  { value: 'gray', label: 'Gray', metadata: { color_code: 'gray' } },
  { value: 'cyan', label: 'Cyan', metadata: { color_code: 'cyan' } },
  { value: 'pink', label: 'Pink', metadata: { color_code: 'pink' } },
  { value: 'amber', label: 'Amber', metadata: { color_code: 'amber' } }
];
```

### Page Integration

**File:** `/home/rabin/projects/pmo/apps/web/src/pages/setting/SettingDetailPage.tsx`

**Purpose:** Universal settings page for all datalabel categories.

```typescript
export function SettingDetailPage() {
  const { category } = useParams<{ category: string }>();
  const [config, setConfig] = useState<SettingConfig | null>(null);
  const [data, setData] = useState<SettingsRecord[]>([]);

  // Load category config
  useEffect(() => {
    async function loadSettingConfig() {
      const categories = await fetchAllCategories();
      const found = categories.find(cat =>
        convertDatalabelFormat(cat.datalabel_name) === categoryToSnakeCase(category)
      );
      setConfig({
        datalabel: convertDatalabelFormat(found.datalabel_name),
        title: found.ui_label,
        icon: found.ui_icon
      });
    }
    loadSettingConfig();
  }, [category]);

  // Load data
  useEffect(() => {
    if (!config) return;
    async function loadData() {
      const items = await fetchSettingItems(config.datalabel);
      setData(items);
    }
    loadData();
  }, [config]);

  // CRUD handlers using service layer
  const handleRowUpdate = async (id, updates) => {
    const result = await updateSettingItemMultiple(config.datalabel, id, updates);
    if (result) setData(result.metadata);
  };

  const handleAddRow = async (newRecord) => {
    const created = await createSettingItem(config.datalabel, newRecord);
    if (created) {
      const items = await fetchSettingItems(config.datalabel);
      setData(items);
    }
  };

  const handleDeleteRow = async (id) => {
    await deleteSettingItem(config.datalabel, id);
    const items = await fetchSettingItems(config.datalabel);
    setData(items);
  };

  const handleReorder = async (reorderedData) => {
    await reorderSettingItems(config.datalabel, reorderedData);
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

## 5. User Interaction Flow Examples

### Flow 1: Edit Multiple Fields

```
1. USER clicks Edit icon (✏️) on row ID 2

2. COMPONENT enters edit mode
   • All fields become editable inputs
   • Edit icon changes to Save (✓) and Cancel (✗)
   • Row background changes to light gray

3. USER edits multiple fields
   • Name: "Initiation" → "Project Initiation"
   • Description: "Initial phase" → "Initial project setup and planning"
   • Color: blue → cyan

4. USER clicks Save (✓)

5. COMPONENT collects all changes
   const updates = {
     name: "Project Initiation",
     descr: "Initial project setup and planning",
     color_code: "cyan"
   };

6. COMPONENT calls onRowUpdate(2, updates)

7. SERVICE sends ONE API call
   PUT /api/v1/setting/project_stage/2
   Body: { name: "...", descr: "...", color_code: "cyan" }

8. BACKEND recomposes entire metadata
   • Fetch entire metadata array
   • Find item ID 2 in array
   • Update all three fields
   • Save entire array back to database

9. SERVICE fetches fresh data
   GET /api/v1/setting?datalabel=project_stage

10. COMPONENT updates local state
    setData(result.metadata)

11. UI reflects changes
    • Row shows updated name, descr, and cyan color
    • Exit edit mode
```

### Flow 2: Add New Row

```
1. USER clicks "+" button at bottom of table

2. COMPONENT enters add mode
   • New row appears with empty fields
   • All fields are editable
   • Save (✓) and Cancel (✗) buttons appear

3. USER fills in fields
   • Name: "Archived"
   • Description: "Archived projects"
   • Parent ID: (empty)
   • Color: gray

4. USER clicks Save (✓)

5. COMPONENT validates required fields
   • Name is required → Valid ✓

6. COMPONENT calls onAddRow({ name, descr, parent_id, color_code })

7. SERVICE sends POST request
   POST /api/v1/setting/project_stage
   Body: {
     name: "Archived",
     descr: "Archived projects",
     parent_id: null,
     color_code: "gray"
   }

8. BACKEND adds to metadata array
   • Fetch current metadata
   • Find next available ID (maxId + 1)
   • Push new item to end of array
   • Save entire array back to database

9. SERVICE fetches fresh data
   const items = await fetchSettingItems(config.datalabel);

10. COMPONENT updates local state
    setData(items)

11. UI shows new row
    • New item appears at bottom of table
    • Exit add mode
```

### Flow 3: Drag & Drop Reorder

```
1. USER clicks and holds on row ID 3

2. COMPONENT sets draggedIndex = 3
   • Row becomes 40% transparent
   • Cursor changes to "grabbing"

3. USER drags over row ID 1

4. COMPONENT sets dragOverIndex = 1
   • Blue drop indicator line appears above row 1

5. USER releases mouse

6. COMPONENT calculates new order
   Original: [item0, item1, item2, item3, item4]
   New:      [item0, item3, item1, item2, item4]

7. COMPONENT calls onReorder(newArray)

8. SERVICE sends reorder request
   PUT /api/v1/setting/project_stage/reorder
   Body: {
     order: [
       { id: 0, position: 0 },
       { id: 3, position: 1 },
       { id: 1, position: 2 },
       { id: 2, position: 3 },
       { id: 4, position: 4 }
     ]
   }

9. BACKEND reorders metadata array
   • Fetch current metadata
   • Build new array based on position order
   • Save entire array back to database

10. COMPONENT updates local state
    setData(newArray)

11. UI reflects new order
    • Item 3 now appears at position 1
    • All other items shifted accordingly
    • Visual feedback cleared (opacity back to 100%)

12. USER refreshes page
    • Data fetches in new array order (persisted!)
```

### Flow 4: Delete Row

```
1. USER clicks Delete icon (🗑️) on row ID 4

2. COMPONENT shows confirmation
   confirm("Are you sure you want to delete this row?")

3. USER clicks OK

4. COMPONENT calls onDeleteRow(4)

5. SERVICE sends DELETE request
   DELETE /api/v1/setting/project_stage/4

6. BACKEND removes from metadata array
   • Fetch current metadata
   • Find item ID 4 in array
   • Remove from array using splice()
   • Save entire array back to database

7. SERVICE fetches fresh data
   const items = await fetchSettingItems(config.datalabel);

8. COMPONENT updates local state
   setData(items)

9. UI reflects deletion
   • Row ID 4 removed from table
   • Remaining rows re-rendered
```

---

## 6. Critical Considerations When Building

### ⚠️ CRITICAL: Array Position vs Sorting

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

**Why:** Backend stores items in array position order. UI must display in that same order for drag & drop to work correctly.

### ⚠️ CRITICAL: Complete Metadata Recomposition

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

**Why:** Backend fetches entire metadata array, updates the item, and saves the entire array back. Multiple partial updates can cause race conditions.

### ⚠️ CRITICAL: Fresh Data After Mutations

**Pattern for Create/Delete:**
```typescript
const handleAddRow = async (newRecord) => {
  const created = await createSettingItem(config.datalabel, newRecord);

  if (created) {
    // ✅ Fetch fresh data from server (includes all items with correct positions)
    const items = await fetchSettingItems(config.datalabel);
    setData(items);

    // ❌ DON'T just append locally: setData(prev => [...prev, created])
    // Why: Positions may have changed, IDs may not be sequential
  }
};
```

**Why:** Backend may modify data (auto-generate IDs, calculate positions). Always fetch fresh data after mutations.

### ⚠️ Backend WITH ORDINALITY Query

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

### ⚠️ Reorder Endpoint Logic

**Backend must:**
1. Parse `order` array: `[{ id, position }, ...]`
2. Sort by `position` ascending
3. Build new metadata array in position order
4. Save entire array (not individual items)

```typescript
// Frontend sends
{ order: [
  { id: 3, position: 0 },
  { id: 0, position: 1 },
  { id: 1, position: 2 }
]}

// Backend builds
const reorderedMetadata = order
  .sort((a, b) => a.position - b.position)
  .map(orderItem => itemMap.get(String(orderItem.id)))
  .filter(Boolean);

// Save entire array
UPDATE app.setting_datalabel
SET metadata = :reorderedMetadata
WHERE datalabel_name = :datalabelName;
```

### ⚠️ DRY Service Layer Usage

**Page-level handlers should ONLY call service functions:**

```typescript
// ✅ Correct: Use service layer
const handleRowUpdate = async (id, updates) => {
  const result = await updateSettingItemMultiple(config.datalabel, id, updates);
  if (result) setData(result.metadata);
};

// ❌ Wrong: Direct fetch calls in page
const handleRowUpdate = async (id, updates) => {
  const response = await fetch(`/api/v1/setting/${config.datalabel}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
  // ... manual parsing, error handling, etc.
};
```

**Why:** Service layer provides:
- ✅ Authentication headers
- ✅ Error handling
- ✅ Consistent patterns
- ✅ Single source of truth
- ✅ Easy to test/mock

### ⚠️ Feature Flag Patterns

**Enable features based on business requirements:**

```typescript
<SettingsDataTable
  data={data}
  onRowUpdate={handleRowUpdate}
  onAddRow={handleAddRow}        // Only provide if needed
  onDeleteRow={handleDeleteRow}  // Only provide if needed
  onReorder={handleReorder}      // Only provide if needed
  allowAddRow={true}             // Enable "+" button
  allowEdit={true}               // Enable Edit icons (always on)
  allowDelete={true}             // Enable Delete icons
  allowReorder={true}            // Enable drag & drop + disable sorting
/>
```

**Why:** Not all settings need all features. For example, `customer_tier` may need reordering but not deletion (preserve historical data).

### ⚠️ Standard Gray Theme

**All UI buttons must use standard gray colors:**

```typescript
// ✅ Correct: Standard gray theme
className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"

// ❌ Wrong: Bright colors
className="p-1 text-blue-600 hover:bg-blue-50"
```

**Why:** Consistent with platform-wide design system. Bright colors are reserved for badges/status indicators.

### ⚠️ Validation Requirements

**Name field is always required:**

```typescript
const handleSaveNewRow = () => {
  if (!newRowData.name || !newRowData.name.trim()) {
    alert('Name is required');
    return;
  }
  onAddRow?.(newRowData);
};
```

**Why:** Settings items must have a display name. Other fields are optional.

### ⚠️ Color Code Defaults

**Always provide color_code default:**

```typescript
const [newRowData, setNewRowData] = useState<Partial<SettingsRecord>>({
  name: '',
  descr: '',
  parent_id: null,
  color_code: 'blue'  // ← Default color
});
```

**Why:** `color_code` is used for badge rendering. Must never be null/undefined.

---

## Summary

The **SettingsDataTable** is a specialized, DRY-first component optimized for settings management with:

- ✅ **Full CRUD Operations**: Create, Read, Update, Delete with DRY service layer
- ✅ **Drag & Drop Reordering**: Array position-based ordering with persistence
- ✅ **Inline Editing**: All fields editable with colored badge support
- ✅ **Complete Metadata Recomposition**: Backend is single source of truth
- ✅ **Universal Component**: ONE component handles ALL 16 settings categories
- ✅ **Lightweight**: 600 LOC vs 1350+ for EntityDataTable

**Key Files:**
- Component: `/apps/web/src/components/shared/ui/SettingsDataTable.tsx`
- Service: `/apps/web/src/services/settingsService.ts`
- Page: `/apps/web/src/pages/setting/SettingDetailPage.tsx`
- Config: `/apps/web/src/lib/settingsConfig.ts`
- Backend: `/apps/api/src/modules/setting/routes.ts`
- Database: `/db/setting_datalabel.ddl`

**Architecture Documentation:** See `/docs/settings_dry_architecture.md` for complete DRY design details.
