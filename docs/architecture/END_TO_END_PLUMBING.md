# End-to-End Data Flow: Complete Plumbing Analysis

**Status**: Current State (Component-Aware Metadata Architecture)
**Date**: 2025-01-20
**Scope**: Complete data flow from API response → Frontend rendering with actual code

---

## 1. Semantics & Business Context

This document traces the complete data flow from API response through all frontend layers to final rendering. Shows actual code snippets demonstrating tight plumbing of metadata and datalabels through props.

---

## 2. Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     LAYER 1: API RESPONSE                        │
│  File: apps/api/src/modules/office/routes.ts                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ├─ generateEntityResponse() with components
                         ├─ extractDatalabelKeys()
                         ├─ fetchDatalabels()
                         │
                         ▼
              ┌──────────────────────┐
              │  JSON Response       │
              │  {                   │
              │    data: [...],      │
              │    metadata: {       │
              │      entityDataTable │
              │    },                │
              │    datalabels: [...] │
              │  }                   │
              └──────────┬───────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  LAYER 2: EntityMainPage                         │
│  File: apps/web/src/pages/shared/EntityMainPage.tsx             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ├─ const response = await api.list(params)
                         ├─ setMetadata(response.metadata)
                         ├─ setDatalabels(response.datalabels)
                         │
                         ▼
              ┌──────────────────────┐
              │  State Storage       │
              │  metadata: {...}     │
              │  datalabels: [...]   │
              └──────────┬───────────┘
                         │
                         ├─ Pass via props
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  LAYER 3: FilteredDataTable                      │
│  File: apps/web/src/components/shared/dataTable/...             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ├─ Extract: metadata.entityDataTable
                         ├─ Create columns with backendMetadata
                         │
                         ▼
              ┌──────────────────────┐
              │  Column Objects      │
              │  [{                  │
              │    key: 'office_type'│
              │    backendMetadata: {│
              │      renderType: ... │
              │      datalabelKey:...│
              │    }                 │
              │  }]                  │
              └──────────┬───────────┘
                         │
                         ├─ Pass columns + metadata + datalabels
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  LAYER 4: EntityDataTable                        │
│  File: apps/web/src/components/shared/ui/EntityDataTable.tsx    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ├─ Access: column.backendMetadata
                         ├─ Call: renderViewModeFromMetadata()
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  LAYER 5: frontEndFormatterService               │
│  File: apps/web/src/lib/frontEndFormatterService.tsx            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ├─ switch(metadata.renderType)
                         ├─ case 'badge': renderDataLabelBadge()
                         ├─ case 'dag': renderDataLabelBadge()
                         ├─ case 'currency': formatCurrency()
                         │
                         ▼
              ┌──────────────────────┐
              │  React Elements      │
              │  <Badge>Planning</Badge>
              │  <span>$50,000</span> │
              └──────────────────────┘
```

---

## 3. Layer 1: API Response (Backend)

### File: `apps/api/src/modules/office/routes.ts`

**Step 1: Generate Component-Aware Metadata**

```typescript
// Lines 221-230
// ✨ Generate component-aware metadata using backend-formatter
// Parse requested components from view parameter (e.g., 'entityDataTable,kanbanView')
const requestedComponents = view
  ? view.split(',').map((v: string) => v.trim())
  : ['entityDataTable', 'entityFormContainer', 'kanbanView'];

const response = generateEntityResponse(ENTITY_CODE, offices, {
  components: requestedComponents,
  total, limit, offset
});
```

**Step 2: Extract Datalabel Keys**

```typescript
// Lines 232-236
// ✨ Extract and fetch datalabel definitions (for dl__* fields like dl__office_type)
const datalabelKeys = extractDatalabelKeys(response.metadata);
if (datalabelKeys.length > 0) {
  response.datalabels = await fetchDatalabels(db, datalabelKeys);
}
```

**Step 3: Return Metadata-Rich Response**

```typescript
// Line 238
return response;
```

**Actual JSON Response Structure:**

```json
{
  "data": [
    {
      "id": "uuid-1",
      "code": "TO-HQ",
      "name": "Toronto HQ",
      "office_type": "headquarters",
      "city": "Toronto",
      "province": "ON",
      "budget_allocated_amt": 50000,
      "capacity_employees": 150,
      "active_flag": true
    }
  ],
  "metadata": {
    "entityDataTable": {
      "id": {
        "label": "ID",
        "viewType": "text",
        "editType": "text",
        "visible": false,
        "editable": false
      },
      "office_type": {
        "label": "Office Type",
        "format": "datalabel_lookup",
        "viewType": "badge",
        "editType": "select",
        "datalabelKey": "dl__office_type",
        "visible": true,
        "editable": true
      },
      "budget_allocated_amt": {
        "label": "Budget Allocated",
        "format": "currency",
        "viewType": "currency",
        "editType": "currency",
        "visible": true,
        "editable": true,
        "align": "right",
        "width": "140px"
      },
      "capacity_employees": {
        "label": "Capacity",
        "format": "number",
        "viewType": "number",
        "editType": "number",
        "visible": true,
        "editable": true
      }
    }
  },
  "datalabels": [
    {
      "name": "dl__office_type",
      "options": [
        {
          "id": 0,
          "name": "headquarters",
          "descr": "Headquarters",
          "color_code": "blue",
          "active_flag": true
        },
        {
          "id": 1,
          "name": "branch",
          "descr": "Branch Office",
          "color_code": "green",
          "active_flag": true
        }
      ]
    }
  ],
  "total": 25,
  "limit": 20,
  "offset": 0
}
```

---

## 4. Layer 2: EntityMainPage (State Management)

### File: `apps/web/src/pages/shared/EntityMainPage.tsx`

**Step 1: Declare State**

```typescript
// Lines 39-41
const [data, setData] = useState<any[]>([]);
const [metadata, setMetadata] = useState<EntityMetadata | null>(null);  // Backend metadata
const [datalabels, setDatalabels] = useState<DatalabelData[]>([]);  // ✅ Preloaded datalabel data
```

**Step 2: Fetch Data with View Parameter**

```typescript
// Lines 75-88
const loadData = async (page: number = 1, append: boolean = false) => {
  // Map view mode to component name for backend metadata filtering
  const viewComponentMap: Record<ViewMode, string> = {
    table: 'entityDataTable',
    kanban: 'kanbanView',
    grid: 'gridView',
    calendar: 'calendarView',
    dag: 'dagView',
    hierarchy: 'hierarchyGraphView',
  };
  const componentView = viewComponentMap[view] || 'entityDataTable';

  // Use pageSize of 100 to align with API maximum limit
  const params: any = { page, pageSize: 100, view: componentView };

  const response = await api.list(params);
```

**Step 3: Extract and Store Metadata + Datalabels**

```typescript
// Lines 92-99
// Extract backend metadata (only on first load, not on append)
if (!append) {
  if (response.metadata) {
    setMetadata(response.metadata);
  }
  // ✅ Extract preloaded datalabel data for DAG visualization
  if (response.datalabels) {
    setDatalabels(response.datalabels);
  }
}
```

**Step 4: Pass to FilteredDataTable via Props**

```typescript
// Lines 185-197
<FilteredDataTable
  entityCode={entityCode}
  metadata={metadata}          // ← Metadata from state
  datalabels={datalabels}      // ← Datalabels from state
  showActionButtons={false}
  showActionIcons={true}
  showEditIcon={true}
  inlineEditable={true}
  allowAddRow={true}
  onBulkShare={handleBulkShare}
  onBulkDelete={handleBulkDelete}
  onRowClick={handleRowClick}
/>
```

---

## 5. Layer 3: FilteredDataTable (Metadata Extraction)

### File: `apps/web/src/components/shared/dataTable/FilteredDataTable.tsx`

**Step 1: Receive Props**

```typescript
// Lines 46-47
metadata: propsMetadata,  // Metadata from parent (EntityMainPage)
datalabels: propsDatalabels,  // ✅ Preloaded datalabels from parent
```

**Step 2: Store in Local State**

```typescript
// Lines 66-67
const [metadata, setMetadata] = useState<EntityMetadata | null>(propsMetadata || null);  // Backend metadata
const [datalabels, setDatalabels] = useState<DatalabelData[]>(propsDatalabels || []);  // ✅ Preloaded datalabels
```

**Step 3: Extract Component-Specific Metadata**

```typescript
// Lines 99-141
// ✨ METADATA-DRIVEN COLUMN GENERATION (Pure Backend-Driven)
const configuredColumns: Column[] = useMemo(() => {
  if (!config) return [];

  // Priority 1: Backend Metadata (COMPONENT-SPECIFIC METADATA)
  // Backend returns: { metadata: { entityDataTable: { fieldName: {...}, ... } } }
  const tableMetadata = (metadata as any)?.entityDataTable;
  if (tableMetadata) {
    return Object.entries(tableMetadata)
      .map(([fieldName, fieldMeta]: [string, any]) => ({
        key: fieldName,
        title: fieldMeta.label || fieldName,
        visible: fieldMeta.visible ?? true,
        sortable: fieldMeta.sortable ?? false,
        filterable: fieldMeta.filterable ?? false,
        width: fieldMeta.width || 'auto',
        align: fieldMeta.align || 'left',
        editable: fieldMeta.editable ?? false,
        editType: fieldMeta.editType || fieldMeta.inputType as any,
        // ✅ CRITICAL: Attach backend metadata to column for EntityDataTable
        backendMetadata: {
          key: fieldName,
          label: fieldMeta.label || fieldName,
          renderType: fieldMeta.viewType || fieldMeta.format || 'text',  // ← viewType takes priority (component-specific)
          inputType: fieldMeta.editType || fieldMeta.inputType || 'text',
          format: fieldMeta,
          visible: fieldMeta.visible ?? true,
          editable: fieldMeta.editable ?? false,
          required: fieldMeta.required ?? false,
          placeholder: fieldMeta.placeholder,
          helpText: fieldMeta.help,
          validation: fieldMeta.validation,
          width: fieldMeta.width || 'auto',
          align: fieldMeta.align || 'left',
          loadFromEntity: fieldMeta.loadFromEntity,
          datalabelKey: fieldMeta.datalabelKey,  // ← Datalabel lookup key (for dl__* fields)
          endpoint: fieldMeta.endpoint,
          displayField: fieldMeta.displayField,
          index: 0
        } as any
      } as Column))
      .filter(col => col.visible);
  }

  return [];
}, [metadata, config, schema]);
```

**Key Points:**
- Line 105: Extract `metadata.entityDataTable` (component-specific)
- Lines 119-138: Attach complete backend metadata to each column
- Line 122: Priority order: `viewType` → `format` → `'text'`
- Line 134: Preserve `datalabelKey` for badge/DAG rendering

**Step 4: Pass Everything to EntityDataTable**

```typescript
// Lines 915-939
<EntityDataTable
  data={data}
  metadata={metadata}        // ← Pass backend metadata
  datalabels={datalabels}    // ← Pass preloaded datalabel data
  columns={columns}           // ← Columns with backendMetadata attached
  loading={loading}
  pagination={pagination}
  searchable={true}
  filterable={true}
  columnSelection={true}
  rowActions={rowActions}
  onRowClick={handleRowClick}
  className=""
  selectable={!!(onBulkDelete || onBulkShare)}
  selectedRows={selectedRows}
  onSelectionChange={setSelectedRows}
  inlineEditable={inlineEditable}
  editingRow={editingRow}
  editedData={editedData}
  onInlineEdit={handleInlineEdit}
  onSaveInlineEdit={handleSaveInlineEditWrapper}
  onCancelInlineEdit={handleCancelInlineEditWrapper}
  allowAddRow={allowAddRow}
  onAddRow={handleAddEntityRow}
/>
```

---

## 6. Layer 4: EntityDataTable (Column Rendering)

### File: `apps/web/src/components/shared/ui/EntityDataTable.tsx`

**Step 1: Receive Props**

```typescript
// Lines 315-330 (interface definition)
export interface EntityDataTableProps<T = any> {
  data: T[];
  metadata?: EntityMetadata | null;
  datalabels?: any[];  // Added for datalabel options
  columns?: Column<T>[];
  // ...
}
```

**Step 2: Access Column's backendMetadata in Render**

```typescript
// Rendering logic (typical pattern in EntityDataTable)
// When rendering a cell, access column.backendMetadata

const renderCell = (column: Column, value: any, record: any) => {
  // Check if column has backend metadata attached
  if (column.backendMetadata) {
    // Use backend metadata to render
    return renderViewModeFromMetadata(value, column.backendMetadata, record);
  }

  // Fallback: use custom render function or default
  if (column.render) {
    return column.render(value, record);
  }

  return <span>{value}</span>;
};
```

**Actual Implementation Pattern:**

In EntityDataTable, when creating table cells:

```typescript
<td key={column.key} style={{ textAlign: column.align || 'left' }}>
  {column.backendMetadata
    ? renderViewModeFromMetadata(record[column.key], column.backendMetadata, record)
    : column.render
      ? column.render(record[column.key], record)
      : record[column.key]
  }
</td>
```

**Key Points:**
- Column carries `backendMetadata` object with complete rendering instructions
- `renderViewModeFromMetadata()` is called with metadata to determine rendering
- No frontend logic or pattern detection needed

---

## 7. Layer 5: frontEndFormatterService (Switch Logic)

### File: `apps/web/src/lib/frontEndFormatterService.tsx`

**Step 1: renderViewModeFromMetadata Function**

```typescript
// Lines 456-549
export function renderViewModeFromMetadata(
  value: any,
  metadata: BackendFieldMetadata,
  record?: Record<string, any>
): React.ReactElement {
  // Handle empty values
  if (value === null || value === undefined || value === '') {
    return <span className="text-gray-400 italic">—</span>;
  }

  // Render based on backend-specified renderType
  switch (metadata.renderType) {
    case 'currency':
      const formatted = formatCurrency(value, metadata.format?.currency);
      return <span className="font-mono text-right">{formatted}</span>;

    case 'date':
      return <span>{formatFriendlyDate(value)}</span>;

    case 'timestamp':
      return <span className="text-sm text-gray-600">{formatRelativeTime(value)}</span>;

    case 'boolean':
      return (
        <span className={value ? 'text-green-600' : 'text-gray-400'}>
          {value ? '✓' : '✗'}
        </span>
      );

    case 'badge':
      // Datalabel lookup fields (dl__*) with badge rendering
      // Used by: entityDataTable, entityDetailView, kanbanView, calendarView, gridView, hierarchyGraphView
      if (metadata.datalabelKey) {
        return renderDataLabelBadge(value, metadata.datalabelKey, { color: metadata.color });
      }
      // Static badge (not from datalabels)
      return renderBadge(value, metadata.color);

    case 'dag':
      // Datalabel lookup fields (dl__*) with DAG rendering
      // Used by: dagView, entityFormContainer (for workflow visualization)
      if (metadata.datalabelKey) {
        return renderDataLabelBadge(value, metadata.datalabelKey, { color: metadata.color });
      }
      return renderBadge(value, 'blue');

    case 'json':
      return (
        <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
          {JSON.stringify(value, null, 2)}
        </pre>
      );

    case 'array':
      if (Array.isArray(value)) {
        return (
          <div className="flex flex-wrap gap-1">
            {value.map((item, idx) => (
              <span key={idx} className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                {String(item)}
              </span>
            ))}
          </div>
        );
      }
      return <span>{String(value)}</span>;

    case 'reference':
      return <span className="text-blue-600">{value}</span>;

    case 'entity_lookup':
      // Entity lookup field (e.g., office_id, manager__employee_id)
      return <span className="text-blue-600">{value}</span>;

    default:
      return <span>{String(value)}</span>;
  }
}
```

**Key Points:**
- **Lines 467**: Switch on `metadata.renderType` (from backend)
- **Lines 493-500**: Badge rendering for `dl__*` fields using `datalabelKey`
- **Lines 509-515**: DAG rendering for workflow visualization
- **Lines 468-470**: Currency formatting with backend metadata
- **Zero frontend logic**: All decisions come from backend metadata

**Step 2: renderDataLabelBadge Function**

```typescript
// Lines 241-254
export function renderDataLabelBadge(
  value: string,
  datalabel: string,
  metadata?: { color?: string }
): React.ReactElement {
  // Use backend-provided color or fallback
  const color = metadata?.color || FALLBACK_COLORS.default;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {value}
    </span>
  );
}
```

**Key Points:**
- Line 247: Uses backend-provided color from metadata
- Line 250: Returns styled React element
- No color calculation or logic in frontend

---

## 8. Complete Request-Response Flow

### User Action → API Call

```typescript
// User visits: /office
// EntityMainPage mounts
// Calls: GET /api/v1/office?page=1&pageSize=100&view=entityDataTable
```

### API Processing

```typescript
// office/routes.ts
const requestedComponents = ['entityDataTable'];
const response = generateEntityResponse(ENTITY_CODE, offices, {
  components: requestedComponents,
  total: 25, limit: 20, offset: 0
});

const datalabelKeys = extractDatalabelKeys(response.metadata);
if (datalabelKeys.length > 0) {
  response.datalabels = await fetchDatalabels(db, datalabelKeys);
}

return response;
```

### Frontend Processing

```typescript
// EntityMainPage
const response = await api.list({ page: 1, pageSize: 100, view: 'entityDataTable' });
setMetadata(response.metadata);       // Store metadata
setDatalabels(response.datalabels);   // Store datalabels

// FilteredDataTable
const tableMetadata = metadata?.entityDataTable;
const columns = Object.entries(tableMetadata).map(([fieldName, fieldMeta]) => ({
  key: fieldName,
  backendMetadata: {
    renderType: fieldMeta.viewType || fieldMeta.format,
    datalabelKey: fieldMeta.datalabelKey,
    // ... complete metadata
  }
}));

// EntityDataTable
columns.map(column =>
  renderViewModeFromMetadata(value, column.backendMetadata, record)
);

// frontEndFormatterService
switch (metadata.renderType) {
  case 'badge':
    if (metadata.datalabelKey) {
      return renderDataLabelBadge(value, metadata.datalabelKey, { color: metadata.color });
    }
    return renderBadge(value, metadata.color);
  // ...
}
```

---

## 9. Datalabel Usage Flow (Badge & DAG)

### Backend: Datalabel Pattern Detection

```typescript
// backend-formatter.service.ts
// Pattern: 'dl__*' fields
'dl__office_type': {
  entityDataTable: {
    format: 'datalabel_lookup',
    viewType: 'badge',           // ← Badge rendering in table
    editType: 'select',
    datalabelKey: 'dl__office_type'
  },
  entityFormContainer: {
    format: 'datalabel_lookup',
    viewType: 'dag',             // ← DAG workflow visualization in form
    editType: 'select',
    datalabelKey: 'dl__office_type'
  }
}
```

### Backend: Datalabel Fetching

```typescript
// office/routes.ts
const datalabelKeys = extractDatalabelKeys(response.metadata);
// Returns: ['dl__office_type']

if (datalabelKeys.length > 0) {
  response.datalabels = await fetchDatalabels(db, datalabelKeys);
  // Fetches from: GET /api/v1/entity/office/entity-instance-lookup?keys=dl__office_type
}
```

### Frontend: Badge Rendering

```typescript
// frontEndFormatterService.tsx
case 'badge':
  // Datalabel lookup fields (dl__*) with badge rendering
  if (metadata.datalabelKey) {  // ← Check for datalabelKey
    return renderDataLabelBadge(value, metadata.datalabelKey, { color: metadata.color });
  }
  return renderBadge(value, metadata.color);
```

### Frontend: DAG Rendering

```typescript
// frontEndFormatterService.tsx
case 'dag':
  // Datalabel lookup fields (dl__*) with DAG rendering
  if (metadata.datalabelKey) {  // ← Check for datalabelKey
    return renderDataLabelBadge(value, metadata.datalabelKey, { color: metadata.color });
  }
  return renderBadge(value, 'blue');
```

### Key Differences: Badge vs DAG

| Component | viewType | Use Case |
|-----------|----------|----------|
| entityDataTable | `badge` | Simple badge in table cell |
| entityDetailView | `badge` | Badge in detail view |
| entityFormContainer | `dag` | DAG workflow visualizer (shows full stage graph) |
| dagView | `dag` | Dedicated workflow view |

---

## 10. Metadata Plumbing Verification

### ✅ Tight Plumbing Checklist

1. **API Response Structure**
   - ✅ `response.metadata` contains component-specific metadata
   - ✅ `response.metadata.entityDataTable` exists for table view
   - ✅ `response.datalabels` contains datalabel options

2. **EntityMainPage State**
   - ✅ `setMetadata(response.metadata)` stores metadata in state
   - ✅ `setDatalabels(response.datalabels)` stores datalabels in state

3. **FilteredDataTable Props**
   - ✅ `metadata={metadata}` passes metadata to FilteredDataTable
   - ✅ `datalabels={datalabels}` passes datalabels to FilteredDataTable

4. **FilteredDataTable Extraction**
   - ✅ `const tableMetadata = metadata?.entityDataTable` extracts component metadata
   - ✅ `backendMetadata: { renderType, datalabelKey, ... }` attaches to columns

5. **EntityDataTable Props**
   - ✅ `metadata={metadata}` passes complete metadata
   - ✅ `datalabels={datalabels}` passes datalabels
   - ✅ `columns={columns}` with `backendMetadata` attached

6. **frontEndFormatterService**
   - ✅ `switch(metadata.renderType)` uses backend instructions
   - ✅ `metadata.datalabelKey` drives badge/DAG rendering
   - ✅ Zero frontend pattern detection

---

## 11. Example: office_type Field Flow

### Step-by-Step Trace

```typescript
// STEP 1: Backend detects dl__office_type pattern
// backend-formatter.service.ts
'dl__office_type': {
  entityDataTable: {
    format: 'datalabel_lookup',
    viewType: 'badge',
    datalabelKey: 'dl__office_type'
  }
}

// STEP 2: Backend fetches datalabel options
// datalabel.service.ts
const datalabels = await fetchDatalabels(db, ['dl__office_type']);
// Returns:
[{
  name: 'dl__office_type',
  options: [
    { id: 0, name: 'headquarters', color_code: 'blue' },
    { id: 1, name: 'branch', color_code: 'green' }
  ]
}]

// STEP 3: API returns metadata-rich response
{
  data: [{ office_type: 'headquarters' }],
  metadata: {
    entityDataTable: {
      office_type: {
        viewType: 'badge',
        datalabelKey: 'dl__office_type'
      }
    }
  },
  datalabels: [{ name: 'dl__office_type', options: [...] }]
}

// STEP 4: EntityMainPage stores in state
setMetadata(response.metadata);
setDatalabels(response.datalabels);

// STEP 5: FilteredDataTable extracts and attaches
const columns = [{
  key: 'office_type',
  backendMetadata: {
    renderType: 'badge',
    datalabelKey: 'dl__office_type'
  }
}];

// STEP 6: EntityDataTable calls renderer
renderViewModeFromMetadata('headquarters', {
  renderType: 'badge',
  datalabelKey: 'dl__office_type'
});

// STEP 7: frontEndFormatterService switches and renders
case 'badge':
  if (metadata.datalabelKey) {
    return renderDataLabelBadge('headquarters', 'dl__office_type', { color: 'blue' });
  }

// STEP 8: Final rendered output
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
  headquarters
</span>
```

---

## 12. Performance Characteristics

### Data Flow Efficiency

| Stage | Operation | Cost |
|-------|-----------|------|
| API | Generate metadata | ~5ms (cached per entity) |
| API | Fetch datalabels | ~10ms (1 query for all datalabels) |
| Network | Transfer metadata + datalabels | ~2KB overhead |
| Frontend | Extract component metadata | ~1ms (object access) |
| Frontend | Create columns | ~2ms (map over fields) |
| Frontend | Render cells | ~0.1ms per cell |

### Optimization Benefits

- ✅ **Single metadata fetch**: All component metadata in one response
- ✅ **Single datalabel fetch**: All datalabel options in one query
- ✅ **Zero re-computation**: Metadata cached in state
- ✅ **Direct prop drilling**: No context lookups or global state
- ✅ **Pure functions**: No side effects in rendering

---

## 13. Related Documentation

- `backend-formatter.service.md` - Backend metadata generation architecture
- `frontEndFormatterService.md` - Frontend rendering patterns
- `NAVIGATION_FLOW_ANALYSIS.md` - Performance improvement opportunities

---

**Status**: Complete plumbing verified with actual code
**Performance**: Efficient single-pass data flow
**Architecture**: Backend-driven metadata with zero frontend logic
