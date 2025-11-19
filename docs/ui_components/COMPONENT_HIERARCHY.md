# UI Component Hierarchy - Complete Architecture

**Version**: 3.5.0
**Last Updated**: 2025-01-19

---

## Component Architecture Overview

Three-tier component hierarchy following **Base → Domain → Application** pattern.

```
┌──────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                             │
│  EntityDataTable, EntityFormContainer, FilteredDataTable         │
│  (Business logic, data fetching, state management)               │
└───────────────────────────────┬──────────────────────────────────┘
                                │
┌───────────────────────────────┴──────────────────────────────────┐
│                      DOMAIN LAYER                                 │
│  EntitySelect, EntityMultiSelect, DataLabelSelect                │
│  (Data-aware components with API integration)                    │
└───────────────────────────────┬──────────────────────────────────┘
                                │
┌───────────────────────────────┴──────────────────────────────────┐
│                       BASE LAYER                                  │
│  Select, MultiSelect, SearchableMultiSelect                      │
│  (Generic, reusable, no business logic)                          │
└──────────────────────────────────────────────────────────────────┘
```

---

## Base Components (Generic, Reusable)

### 1. Select

**File**: `apps/web/src/components/shared/ui/Select.tsx`

**Purpose**: Generic dropdown selector with no data dependencies.

**Interface**:
```typescript
interface SelectProps {
  value: string | number;           // Current selection
  onChange: (value: string) => void; // Selection callback
  options: SelectOption[];           // Static options array
  placeholder?: string;              // Default: "Select..."
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

interface SelectOption {
  value: string | number;
  label: string;
}
```

**Usage**:
```typescript
<Select
  value={selectedValue}
  onChange={handleChange}
  options={[
    { value: 'opt1', label: 'Option 1' },
    { value: 'opt2', label: 'Option 2' }
  ]}
  placeholder="Choose one..."
/>
```

**Styling**: Borderless, transparent background for forms.

---

### 2. MultiSelect

**File**: `apps/web/src/components/shared/ui/MultiSelect.tsx` (via SearchableMultiSelect)

**Purpose**: Generic multi-select with tag display.

**Interface**:
```typescript
interface SearchableMultiSelectProps {
  options: { value: string; label: string }[];
  value: string[];                  // Selected values
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
}
```

**Features**:
- Tag display for selected items
- Dropdown for selection
- Remove button on each tag
- Backdrop click to close

**Usage**:
```typescript
<SearchableMultiSelect
  options={[
    { value: 'tag1', label: 'Tag 1' },
    { value: 'tag2', label: 'Tag 2' }
  ]}
  value={['tag1']}
  onChange={(values) => setSelected(values)}
/>
```

---

## Domain Components (Data-Aware)

### 3. EntitySelect

**File**: `apps/web/src/components/shared/ui/EntitySelect.tsx`

**Purpose**: Single entity reference picker with automatic data loading.

**Interface**:
```typescript
interface EntitySelectProps {
  entityCode: string;     // e.g., "employee", "project"
  value: string;          // UUID
  currentLabel?: string;  // Display label (optional)
  onChange: (uuid: string, label: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
}
```

**Data Loading**:
```typescript
// Automatic API call
const { data: options } = useQuery({
  queryKey: ['entity-lookup', entityCode],
  queryFn: async () => {
    const response = await apiClient.get(
      `/api/v1/entity/${entityCode}/instance-lookup`,
      { params: { active_only: true, limit: 500 } }
    );
    return response.data.data.map((item: any) => ({
      value: item.id,
      label: item.name
    }));
  },
  staleTime: 2 * 60 * 1000  // 2-minute cache
});
```

**Usage Example**:
```typescript
// Single employee reference
<EntitySelect
  entityCode="employee"
  value={managerUuid}
  onChange={(newUuid, newLabel) => {
    setData(prev => ({
      ...prev,
      manager__employee_id: newUuid,
      manager: newLabel
    }));
  }}
/>
```

**Architecture**:
```
EntitySelect
    │
    ├─ useQuery (react-query) → Caches options
    ├─ Fetches from /api/v1/entity/{entityCode}/instance-lookup
    ├─ Transforms to SelectOption[]
    └─ Wraps base Select component
```

---

### 4. EntityMultiSelect

**File**: `apps/web/src/components/shared/ui/EntityMultiSelect.tsx`

**Purpose**: Multiple entity reference picker with tag display.

**Interface**:
```typescript
interface EntityMultiSelectProps {
  entityCode: string;               // e.g., "employee"
  values: any[];                    // Array of structured references
  labelField: string;               // Field name (e.g., "stakeholder")
  onAdd: (uuid: string, label: string) => void;
  onRemove: (uuid: string) => void;
  disabled?: boolean;
  placeholder?: string;
}
```

**Value Structure**:
```typescript
// Expected format for values array
[
  {
    entity_code: "employee",
    stakeholder__employee_id: "uuid-1",
    stakeholder: "Alice Smith"
  },
  {
    entity_code: "employee",
    stakeholder__employee_id: "uuid-2",
    stakeholder: "Bob Johnson"
  }
]
```

**UUID Extraction**:
```typescript
// Automatically extracts UUIDs from structured format
const selectedUuids = values.map((value) => {
  const uuidField = Object.keys(value).find(k => k.endsWith('_id'));
  return uuidField ? value[uuidField] : null;
}).filter(Boolean);
```

**Usage Example**:
```typescript
// Multiple stakeholder references
<EntityMultiSelect
  entityCode="employee"
  values={data._IDS?.stakeholder || []}
  labelField="stakeholder"
  onAdd={(uuid, label) => {
    const currentArray = data._IDS?.stakeholder || [];
    setData(prev => ({
      ...prev,
      _IDS: {
        ...prev._IDS,
        stakeholder: [
          ...currentArray,
          {
            entity_code: 'employee',
            stakeholder__employee_id: uuid,
            stakeholder: label
          }
        ]
      }
    }));
  }}
  onRemove={(uuidToRemove) => {
    const filtered = (data._IDS?.stakeholder || []).filter(
      ref => ref.stakeholder__employee_id !== uuidToRemove
    );
    setData(prev => ({
      ...prev,
      _IDS: { ...prev._IDS, stakeholder: filtered }
    }));
  }}
/>
```

**Architecture**:
```
EntityMultiSelect
    │
    ├─ useQuery → Fetches entity options
    ├─ Extracts UUIDs from structured values
    ├─ Handles add/remove with UUID + label
    └─ Wraps SearchableMultiSelect
```

---

### 5. DataLabelSelect

**File**: `apps/web/src/components/shared/ui/DataLabelSelect.tsx`

**Purpose**: Settings/datalabel dropdown with automatic option loading.

**Interface**:
```typescript
interface DataLabelSelectProps {
  datalabel: string;      // e.g., "dl__project_stage", "project_stage"
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}
```

**Data Loading**:
```typescript
const { data: options } = useQuery({
  queryKey: ['datalabel', datalabel],
  queryFn: async () => {
    const response = await apiClient.get('/api/v1/setting', {
      params: { datalabel }
    });
    return response.data.data.map((item: any) => ({
      value: item.name,
      label: item.name
    }));
  },
  staleTime: 5 * 60 * 1000  // 5-minute cache
});
```

**Usage Example**:
```typescript
// Project stage dropdown
<DataLabelSelect
  datalabel="dl__project_stage"
  value={currentStage}
  onChange={(newStage) => setData({ ...data, project_stage: newStage })}
/>
```

**Architecture**:
```
DataLabelSelect
    │
    ├─ useQuery → Fetches datalabel options
    ├─ Fetches from /api/v1/setting?datalabel={datalabel}
    ├─ Transforms to SelectOption[]
    └─ Wraps base Select component
```

---

## Application Components (Business Logic)

### 6. EntityDataTable

**File**: `apps/web/src/components/shared/ui/EntityDataTable.tsx`

**Purpose**: Universal data table with inline editing, sorting, filtering, pagination.

**Key Features**:
- **100% Universal Rendering**: Uses `renderField()` for all cells
- **Inline Editing**: Edit mode with check/cancel icons
- **Auto-Detection**: Field types detected from column names
- **Column Hints**: `loadDataLabels` overrides auto-detection
- **Special Components**: File upload, color picker, settings dropdown

**Rendering Architecture**:
```typescript
// View mode
{renderField({
  fieldKey: column.key,
  value: record[column.key],
  mode: 'view',
  customRender: column.render,
  loadDataLabels: column.loadDataLabels,  // ← Column hint
  data: record
})}

// Edit mode
{renderField({
  fieldKey: column.key,
  value: editedData[column.key],
  mode: 'edit',
  onChange: (key, val) => onInlineEdit(recordId, key, val),
  inlineMode: true,  // ← Table-style bordered inputs
  data: record
})}

// Special cases (NOT handled by renderField)
{editType === 'file' ? (
  <InlineFileUploadCell ... />
) : editType === 'select' && hasSettingOptions ? (
  <ColoredDropdown ... />
) : column.key === 'color_code' ? (
  <select>...</select>  // Color picker
) : (
  renderField(...)  // Universal renderer
)}
```

**Column Configuration**:
```typescript
interface Column {
  key: string;
  title: string;
  visible?: boolean;
  sortable?: boolean;
  editable?: boolean;
  editType?: EditType;
  loadDataLabels?: boolean;  // ← Force badge rendering
  loadFromEntity?: string;   // Entity code for FK fields
  render?: (value, record, allData) => React.ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
}
```

**Data Flow**:
```
User clicks Edit
    ↓
Row enters edit mode
    ↓
renderField(..., mode: 'edit', inlineMode: true)
    ↓
User modifies value
    ↓
onChange(key, value)
    ↓
onInlineEdit(recordId, key, value)
    ↓
API PATCH /api/v1/{entity}/{id}
    ↓
Refetch data
```

---

### 7. EntityFormContainer

**File**: `apps/web/src/components/shared/entity/EntityFormContainer.tsx`

**Purpose**: Universal form for creating/editing entities.

**Key Features**:
- **Auto-Field Generation**: Uses `generateFormConfig()` from viewConfigGenerator
- **_ID/_IDS Support**: Renders entity references with EntitySelect/EntityMultiSelect
- **Universal Rendering**: Uses `renderField()` for all standard fields
- **Sequential States**: DAG workflow stage visualization

**Field Rendering Architecture**:
```typescript
// Standard fields
{visibleFields.map(field => (
  <div key={field}>
    <label>{generateFieldLabel(field)}</label>
    {renderField({
      fieldKey: field,
      value: data[field],
      mode: isEditing ? 'edit' : 'view',
      onChange: (key, val) => setData({ ...data, [key]: val }),
      inlineMode: false,  // ← Form-style borderless inputs
      loadDataLabels: field.startsWith('dl__')
    })}
  </div>
))}

// _ID fields (single references)
{Object.entries(data._ID || {}).map(([labelField, refData]) => {
  const entityCode = refData.entity_code;
  const uuidField = Object.keys(refData).find(k => k.endsWith('_id'));

  return (
    <EntitySelect
      entityCode={entityCode}
      value={refData[uuidField]}
      onChange={(newUuid, newLabel) => {
        setData(prev => ({
          ...prev,
          _ID: {
            ...prev._ID,
            [labelField]: {
              entity_code: entityCode,
              [uuidField]: newUuid,
              [labelField]: newLabel
            }
          }
        }));
      }}
    />
  );
})}

// _IDS fields (multiple references)
{Object.entries(data._IDS || {}).map(([labelField, refArray]) => {
  const entityCode = refArray[0]?.entity_code;
  const uuidField = Object.keys(refArray[0] || {}).find(k => k.endsWith('_id'));

  return (
    <EntityMultiSelect
      entityCode={entityCode}
      values={refArray}
      labelField={labelField}
      onAdd={(uuid, label) => { /* add logic */ }}
      onRemove={(uuid) => { /* remove logic */ }}
    />
  );
})}
```

**Data Transformation**:
```typescript
// On submit
const handleSave = async () => {
  const apiData = transformForApi(data);  // Flatten _ID/_IDS
  await apiClient.patch(`/api/v1/${entityCode}/${id}`, apiData);
};
```

---

## Component Dependency Graph

```
Application Layer
├─ EntityDataTable
│  ├─ renderField (universalFormatterService)
│  ├─ ColoredDropdown (special case)
│  ├─ InlineFileUploadCell (special case)
│  └─ Custom color picker (special case)
│
├─ EntityFormContainer
│  ├─ renderField (universalFormatterService)
│  ├─ EntitySelect (domain layer)
│  ├─ EntityMultiSelect (domain layer)
│  └─ DAGVisualizer (special case)
│
└─ FilteredDataTable
   └─ renderField (universalFormatterService)

Domain Layer
├─ EntitySelect
│  ├─ useQuery (react-query)
│  └─ Select (base layer)
│
├─ EntityMultiSelect
│  ├─ useQuery (react-query)
│  └─ SearchableMultiSelect (base layer)
│
└─ DataLabelSelect
   ├─ useQuery (react-query)
   └─ Select (base layer)

Base Layer
├─ Select (pure component, no dependencies)
└─ SearchableMultiSelect (pure component, portal rendering)
```

---

## Naming Convention Summary

| Component | Layer | Data Source | Caching |
|-----------|-------|-------------|---------|
| **Select** | Base | Props (static options) | None |
| **SearchableMultiSelect** | Base | Props (static options) | None |
| **EntitySelect** | Domain | API `/entity/{code}/instance-lookup` | 2 min (react-query) |
| **EntityMultiSelect** | Domain | API `/entity/{code}/instance-lookup` | 2 min (react-query) |
| **DataLabelSelect** | Domain | API `/setting?datalabel={name}` | 5 min (react-query) |

---

## Critical Design Decisions

### ✅ Architectural Principles

1. **Separation of Concerns**: Base = UI, Domain = Data, Application = Business
2. **No Backwards Compatibility**: Clean break from old component names
3. **Direct Imports**: No wrapper functions, import components directly
4. **React Query**: All domain components use caching via react-query
5. **Universal Rendering**: Application components delegate to `renderField()`

### ✅ Component Responsibilities

**Base Layer**:
- Pure presentation
- No API calls
- No business logic
- Highly reusable

**Domain Layer**:
- Data fetching via react-query
- API integration
- Transform API data → SelectOption[]
- Wrap base components

**Application Layer**:
- Business logic
- State management
- Compose domain + base components
- Handle user interactions

---

## Breaking Changes (v3.5.0)

### REMOVED Components (No Backwards Compatibility)

```typescript
// ❌ REMOVED - Use EntitySelect
import { EntitySelectDropdown } from '...';

// ❌ REMOVED - Use EntityMultiSelect
import { EntityMultiSelectTags } from '...';
```

### Migration

```typescript
// OLD
<EntitySelectDropdown
  entityCode="employee"
  value={uuid}
  onChange={handleChange}
/>

// NEW
<EntitySelect
  entityCode="employee"
  value={uuid}
  onChange={(uuid, label) => handleChange(uuid, label)}
/>

---

// OLD
<EntityMultiSelectTags
  entityCode="employee"
  values={values}
  labelField="stakeholder"
  onAdd={handleAdd}
  onRemove={handleRemove}
/>

// NEW
<EntityMultiSelect
  entityCode="employee"
  values={values}
  labelField="stakeholder"
  onAdd={handleAdd}
  onRemove={handleRemove}
/>
```

---

## File Locations

```
apps/web/src/components/shared/
├─ ui/
│  ├─ Select.tsx                  (Base)
│  ├─ SearchableMultiSelect.tsx   (Base)
│  ├─ EntitySelect.tsx            (Domain)
│  ├─ EntityMultiSelect.tsx       (Domain)
│  ├─ DataLabelSelect.tsx         (Domain)
│  ├─ EntityDataTable.tsx         (Application)
│  └─ ColoredDropdown.tsx         (Special case)
│
└─ entity/
   ├─ EntityFormContainer.tsx     (Application)
   └─ MetadataTable.tsx           (Special case)
```

---

**End of Document**
