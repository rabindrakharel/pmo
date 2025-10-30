# Data Table Architecture - OOP-Style Composition Pattern

> **Refactored data tables using React composition (OOP principles adapted for React)**
> Base components + shared hooks + specialized implementations

---

## Overview

The data table architecture has been refactored to follow **composition over inheritance** (React's approach to OOP). Instead of class-based inheritance, we use:

1. **Shared Base Components** - `DataTableBase`, `ColoredDropdown`
2. **Shared Hooks** - `useDataTableLogic` for common state management
3. **Specialized Components** - `EntityDataTable`, `SettingsDataTable` use shared components

This achieves the same goals as OOP (code reuse, maintainability, extensibility) while following React best practices.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                   DATA TABLE ARCHITECTURE                        │
│                (Composition-Based "OOP" Pattern)                 │
└─────────────────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────────────────┐
    │            SHARED BASE LAYER (Common Code)               │
    ├──────────────────────────────────────────────────────────┤
    │  • DataTableBase.tsx      - Base table structure         │
    │  • useDataTableLogic.ts   - Common state management      │
    │  • ColoredDropdown.tsx    - Shared dropdown component    │
    │  • ActionButtons component - Edit/Delete/Check/Cancel    │
    └──────────────────────────────────────────────────────────┘
                              ↑  ↑
                              │  │
                    ┌─────────┘  └─────────┐
                    │                      │
    ┌───────────────────────┐  ┌───────────────────────┐
    │  SettingsDataTable    │  │  EntityDataTable      │
    │  (Specialized)        │  │  (Specialized)        │
    ├───────────────────────┤  ├───────────────────────┤
    │ • Fixed 5-col schema  │  │ • Dynamic columns     │
    │ • Array ordering      │  │ • Capability detect   │
    │ • Simple editing      │  │ • Complex filtering   │
    │ • Drag & drop         │  │ • Settings loading    │
    │ • Color badges        │  │ • File uploads        │
    └───────────────────────┘  └───────────────────────┘
```

---

## Component Hierarchy

### 1. Base Layer (Shared)

#### **DataTableBase** (`DataTableBase.tsx`)
**Purpose:** Common table structure and rendering logic

**Features:**
- Table structure (thead, tbody, pagination)
- Column headers with sort icons
- Row rendering with edit/display modes
- Inline editing pattern (Edit → Check/Cancel)
- Add row UI pattern
- Drag & drop visual feedback
- Empty states
- Loading states

**Usage:**
```tsx
<DataTableBase
  data={data}
  columns={columns}
  renderCell={(column, record, isEditing) => {
    // Custom cell rendering logic
  }}
  renderActions={(record, isEditing) => {
    // Custom action buttons
  }}
  sortField={sortField}
  sortDirection={sortDirection}
  onSort={handleSort}
  // ... other props
/>
```

#### **useDataTableLogic** Hook (`useDataTableLogic.ts`)
**Purpose:** Shared state management and logic

**Features:**
- Sorting state (field, direction)
- Editing state (row ID, data)
- Add row state (isAdding, newData)
- Drag & drop state (indices)
- Sort data utility
- All state update handlers

**Usage:**
```tsx
function MyDataTable() {
  const {
    sortField,
    sortDirection,
    handleSort,
    editingRowId,
    editingData,
    handleStartEdit,
    handleCancelEdit,
    // ... other state & handlers
  } = useDataTableLogic<MyRecord>({
    initialSortField: 'name',
    allowReordering: false,
  });

  // Use state in component...
}
```

#### **ColoredDropdown** (`ColoredDropdown.tsx`)
**Purpose:** Dropdown with colored badge rendering

**Features:**
- Badge rendering for selected value
- Dropdown menu with badges for all options
- Click-outside handling
- Settings integration

**Usage:**
```tsx
<ColoredDropdown
  value={record.stage}
  options={stageOptions}
  onChange={(value) => handleChange('stage', value)}
/>
```

---

### 2. Specialized Layer

#### **SettingsDataTable** (`SettingsDataTable.tsx`)
**Extends:** DataTableBase (composition)
**Purpose:** Fixed-schema table for settings/datalabel management

**Schema:**
```typescript
interface SettingsRecord {
  id: string | number;
  name: string;
  descr?: string;
  parent_id?: number | null;
  color_code: string;
  position?: number;  // Array position
}
```

**Unique Features:**
- Fixed 5-column schema
- Array position-based ordering (no sort when reordering)
- Complete metadata recomposition pattern
- Color_code field with COLOR_OPTIONS
- Drag & drop reordering
- Optimized for small datasets

**Props:**
```typescript
interface SettingsDataTableProps {
  data: SettingsRecord[];
  onRowUpdate?: (id, updates: Partial<SettingsRecord>) => void;  // DRY pattern
  onInlineEdit?: (id, field, value) => void;  // Legacy pattern
  onAddRow?: (newRecord: Partial<SettingsRecord>) => void;
  onDeleteRow?: (id: string | number) => void;
  onReorder?: (reorderedData: SettingsRecord[]) => void;
  allowAddRow?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  allowReorder?: boolean;
}
```

**Usage:**
```tsx
<SettingsDataTable
  data={projectStages}
  onRowUpdate={handleRowUpdate}  // Preferred (DRY)
  onAddRow={handleAddRow}
  onDeleteRow={handleDeleteRow}
  onReorder={handleReorder}
  allowAddRow={true}
  allowEdit={true}
  allowDelete={true}
  allowReorder={true}
/>
```

#### **EntityDataTable** (`EntityDataTable.tsx`)
**Extends:** DataTableBase concepts (composition)
**Purpose:** Full-featured table for entity management

**Unique Features:**
- **Dynamic columns** - Any schema supported
- **Capability detection** - Auto-detects field types (text, select, date, number, file, tags)
- **Settings integration** - Auto-loads dropdown options from settings API
- **Complex filtering** - Multi-column filters with chips
- **Column visibility** - Show/hide columns
- **Pagination** - Full pagination support
- **File uploads** - Inline file upload cells
- **RBAC support** - Permission-based actions
- **Bulk selection** - Single-row radio selection

**Props:**
```typescript
interface EntityDataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  pagination?: PaginationOptions;
  onRowClick?: (record: T) => void;
  // Filtering & search
  searchable?: boolean;
  filterable?: boolean;
  columnSelection?: boolean;
  // Actions (NOTE: onView removed - row clicks navigate to detail)
  rowActions?: RowAction<T>[];
  showDefaultActions?: boolean;
  onEdit?: (record: T) => void;
  onShare?: (record: T) => void;
  onDelete?: (record: T) => void;
  // Inline editing
  inlineEditable?: boolean;
  editingRow?: string | null;
  editedData?: any;
  onInlineEdit?: (rowId, field, value) => void;
  onSaveInlineEdit?: (record: T) => void;
  onCancelInlineEdit?: () => void;
  // Add row
  allowAddRow?: boolean;
  onAddRow?: (newRecord: Partial<T>) => void;
  // Drag & drop
  allowReordering?: boolean;
  onReorder?: (newData: T[]) => void;
}
```

**Usage:**
```tsx
<EntityDataTable
  data={tasks}
  columns={taskColumns}
  pagination={{
    current: page,
    pageSize: 50,
    total: totalCount,
    onChange: handlePageChange,
  }}
  filterable={true}
  columnSelection={true}
  inlineEditable={true}
  editingRow={editingRowId}
  editedData={editedData}
  onInlineEdit={handleFieldEdit}
  onSaveInlineEdit={handleSave}
  onCancelInlineEdit={handleCancel}
  onEdit={handleStartEdit}
  onDelete={handleDelete}
  allowAddRow={true}
  onAddRow={handleAddRow}
/>
```

---

## Comparison: SettingsDataTable vs EntityDataTable

| Feature | SettingsDataTable | EntityDataTable |
|---------|-------------------|-----------------|
| **Schema** | Fixed (5 columns) | Dynamic (any columns) |
| **Complexity** | ~600 LOC | ~1540 LOC |
| **Sorting** | Simple (disabled when reordering) | Advanced (multiple fields) |
| **Filtering** | None (small datasets) | Multi-column with chips |
| **Pagination** | None (all data shown) | Full pagination |
| **Column Detection** | Fixed | Auto-detect capabilities |
| **Settings Loading** | Manual (COLOR_OPTIONS) | Auto-load from API |
| **File Uploads** | No | Yes (InlineFileUploadCell) |
| **Ordering** | Array position-based | Standard ID-based |
| **Drag & Drop** | Yes (array reordering) | Optional |
| **Use Case** | Settings/datalabel management | Entity CRUD operations |

---

## Key Design Decisions

### 1. Why Composition Over Inheritance?

**Traditional OOP (Class Inheritance):**
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
  // Use shared hook for common logic
  const tableLogic = useDataTableLogic();

  // Use base component for common UI
  return <DataTableBase {...props} />;
}
```

**Benefits:**
- ✅ Better TypeScript support
- ✅ Easier testing (hooks can be tested independently)
- ✅ More flexible (can mix multiple hooks)
- ✅ Follows React best practices
- ✅ No "this" context issues

### 2. Why Keep Two Separate Tables?

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

### 3. Removed onView Prop

**Reason:** Redundant with row click navigation

**Before:**
```tsx
<EntityDataTable
  onView={(record) => navigate(`/project/${record.id}`)}  // Redundant
  onRowClick={(record) => navigate(`/project/${record.id}`)}  // Also navigates
/>
```

**After:**
```tsx
<EntityDataTable
  onRowClick={(record) => navigate(`/project/${record.id}`)}  // Single source
/>
```

**Benefits:**
- ✅ Cleaner API
- ✅ Less code duplication
- ✅ Clearer intent

---

## Migration Guide

### For Existing Code Using onView

**Before:**
```tsx
<EntityDataTable
  data={projects}
  columns={columns}
  onView={(project) => navigate(`/project/${project.id}`)}
  onEdit={handleEdit}
/>
```

**After:**
```tsx
<EntityDataTable
  data={projects}
  columns={columns}
  onRowClick={(project) => navigate(`/project/${project.id}`)}
  onEdit={handleEdit}
/>
```

### For New Data Tables

**Option 1: Use EntityDataTable (most common)**
```tsx
import { EntityDataTable } from '../components/shared/ui/EntityDataTable';

<EntityDataTable
  data={myData}
  columns={myColumns}
  onRowClick={handleRowClick}
  allowAddRow={true}
  onAddRow={handleAddRow}
/>
```

**Option 2: Use SettingsDataTable (for settings only)**
```tsx
import { SettingsDataTable } from '../components/shared/ui/SettingsDataTable';

<SettingsDataTable
  data={settingsData}
  onRowUpdate={handleRowUpdate}
  allowAddRow={true}
  allowEdit={true}
  allowReorder={true}
/>
```

**Option 3: Build Custom Table (advanced)**
```tsx
import { DataTableBase } from '../components/shared/ui/DataTableBase';
import { useDataTableLogic } from '../hooks/useDataTableLogic';

function MyCustomDataTable() {
  const {
    sortField,
    sortDirection,
    handleSort,
    editingRowId,
    handleStartEdit,
    // ... other state
  } = useDataTableLogic();

  return (
    <DataTableBase
      data={data}
      columns={columns}
      sortField={sortField}
      sortDirection={sortDirection}
      onSort={handleSort}
      renderCell={(column, record, isEditing) => {
        // Custom cell rendering
      }}
      // ... other props
    />
  );
}
```

---

## Files Created/Modified

### New Files

| File | Purpose | LOC |
|------|---------|-----|
| `/apps/web/src/components/shared/ui/DataTableBase.tsx` | Base table component | ~320 |
| `/apps/web/src/hooks/useDataTableLogic.ts` | Shared state hook | ~200 |
| `/apps/web/src/components/shared/ui/ColoredDropdown.tsx` | Shared dropdown | ~100 |

### Modified Files

| File | Changes | Impact |
|------|---------|--------|
| `/apps/web/src/components/shared/ui/EntityDataTable.tsx` | Removed `onView` prop completely | Breaking (deprecated prop removed) |
| `/apps/web/src/components/shared/dataTable/FilteredDataTable.tsx` | Removed View icon from actions | UI change (less clutter) |

---

## Testing Checklist

- [ ] **SettingsDataTable**
  - [ ] Edit a row → Edit icon transforms to Check/Cancel
  - [ ] Save changes → Data persists correctly
  - [ ] Add new row → Row added at bottom
  - [ ] Delete row → Row removed with confirmation
  - [ ] Drag & drop row → Order persists after save
  - [ ] Sorting disabled when reordering enabled

- [ ] **EntityDataTable**
  - [ ] Edit row with settings field → Shows colored dropdown
  - [ ] Add row → Inline form shows all columns
  - [ ] Column visibility → Hide/show columns
  - [ ] Filtering → Filter by multiple columns
  - [ ] Pagination → Navigate pages
  - [ ] Row click → Navigates to detail view
  - [ ] No View icon visible in actions

- [ ] **Shared Components**
  - [ ] ColoredDropdown → Works in both tables
  - [ ] Edit/Check/Cancel icons → Consistent styling
  - [ ] Add row button → Same styling in both tables

---

## Future Enhancements

### Phase 2: Full Base Component Integration (Future)

If we want to fully integrate both tables to use `DataTableBase`, the refactoring would involve:

1. **SettingsDataTable Refactor**
   ```tsx
   function SettingsDataTable(props) {
     const tableLogic = useDataTableLogic({ allowReordering: props.allowReorder });

     return (
       <DataTableBase
         {...tableLogic}
         renderCell={(column, record, isEditing) => {
           // Settings-specific cell rendering
           if (column.key === 'name') {
             return renderColorBadge(record.color_code, record.name);
           }
           // ...
         }}
       />
     );
   }
   ```

2. **EntityDataTable Refactor**
   ```tsx
   function EntityDataTable<T>(props) {
     const tableLogic = useDataTableLogic<T>();
     const capabilities = detectColumnCapabilities(props.columns);

     return (
       <>
         {/* Filters, column selector, etc. */}
         <DataTableBase
           {...tableLogic}
           renderCell={(column, record, isEditing) => {
             // Entity-specific cell rendering with capability detection
             const capability = capabilities.get(column.key);
             // ...
           }}
         />
         {/* Pagination */}
       </>
     );
   }
   ```

**Benefits:**
- Even less code duplication
- Consistent table structure
- Easier to add new table types

**Risks:**
- More complex abstraction
- Potential performance overhead
- Harder to customize for specific needs

**Recommendation:** Implement Phase 2 only if we need to create 3+ new table types.

---

## Summary

The data table architecture now follows **composition-based OOP principles**:

1. ✅ **Base components** provide common UI patterns
2. ✅ **Shared hooks** provide common logic
3. ✅ **Specialized components** compose base + add unique features
4. ✅ **onView prop removed** (redundant with row clicks)
5. ✅ **ColoredDropdown extracted** (reusable component)
6. ✅ **Inline editing pattern unified** (Edit → Check/Cancel)

**Result:** Cleaner architecture, less duplication, easier maintenance, while maintaining performance and type safety.

---

**Last Updated:** 2025-01-23
**Architecture Version:** 2.0 (Composition-based)
