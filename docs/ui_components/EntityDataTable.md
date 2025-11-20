# EntityDataTable - Backend-Driven Universal Component

> **Backend metadata-driven, zero frontend pattern detection**
> Backend generates complete field metadata, frontend executes rendering instructions exactly

**Tags:** `#datatable` `#backend-metadata` `#zero-pattern-detection` `#composition` `#settings` `#DRY`

---

## 1. Architecture Overview

### Purpose
Universal data table component that renders all entity types using **backend-generated metadata**. Zero frontend pattern detection - backend is the single source of truth for ALL field rendering decisions.

### Business Value
- **Zero Frontend Configuration**: Backend sends metadata → Frontend renders automatically
- **100% Backend-Driven**: No column name parsing or pattern detection in frontend
- **Single Source of Truth**: Backend formatter service generates all field metadata
- **Perfect Consistency**: All tables use identical backend-driven rendering
- **Type-Safe**: TypeScript with BackendFieldMetadata interface
- **Maintainable**: Change backend patterns → affects all tables automatically

---

## 2. Component Hierarchy

```
DataTableBase (Pure Base Component)
    ├── NO formatting logic
    ├── NO pattern detection
    ├── Table structure (thead, tbody, pagination)
    ├── Sorting UI
    ├── Inline editing pattern
    ├── Drag & drop infrastructure
    └── Common styling

        ↓ Uses composition

EntityDataTable (Entity Data - Backend Metadata)
    ├── Consumes metadata from API response
    ├── Uses renderViewModeFromMetadata()
    ├── Uses renderEditModeFromMetadata()
    ├── Zero pattern detection
    └── Pure metadata renderer

SettingsDataTable (Datalabel Data)
    ├── Specialized for settings
    └── Uses renderDataLabelBadge()
```

### FilteredDataTable (Wrapper)
```typescript
// Minimal wrapper that delegates to specialized tables
FilteredDataTable
    ├── Uses EntityDataTable for entity data
    ├── Uses SettingsDataTable for datalabel data
    ├── Only imports: transformForApi, transformFromApi, loadSettingsColors
    └── NO pattern detection or formatting logic
```

---

## 3. Backend-Driven Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. DATABASE                                                     │
│    • Entity Column: budget_allocated_amt NUMERIC(15,2)          │
│    • Entity Column: dl__project_stage TEXT                      │
│    • Entity Column: start_date DATE                             │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. BACKEND API (Route Handler)                                 │
│    import { getEntityMetadata } from '@/services/backend-formatter.service.js';
│                                                                 │
│    const projects = await db.execute(sql`SELECT * FROM app.d_project...`);
│                                                                 │
│    // Backend generates complete metadata from column names    │
│    const fieldMetadata = projects.length > 0                   │
│      ? getEntityMetadata('project', projects[0])               │
│      : getEntityMetadata('project');                            │
│                                                                 │
│    return { data: projects, metadata: fieldMetadata };         │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. API RESPONSE WITH METADATA                                  │
│    {                                                            │
│      "data": [{ budget_allocated_amt: 50000, ... }],           │
│      "metadata": {                                              │
│        "entity": "project",                                     │
│        "fields": [                                              │
│          {                                                      │
│            "key": "budget_allocated_amt",                       │
│            "label": "Budget Allocated",                         │
│            "renderType": "currency",                            │
│            "inputType": "currency",                             │
│            "format": { "symbol": "$", "decimals": 2 },          │
│            "visible": {                                         │
│              "EntityDataTable": true,                           │
│              "EntityDetailView": true,                          │
│              "EntityFormContainer": true                        │
│            },                                                   │
│            "editable": true,                                    │
│            "align": "right"                                     │
│          },                                                     │
│          {                                                      │
│            "key": "dl__project_stage",                          │
│            "label": "Stage",                                    │
│            "renderType": "badge",                               │
│            "inputType": "select",                               │
│            "loadFromDataLabels": true,                          │
│            "settingsDatalabel": "project_stage",                │
│            "visible": { "EntityDataTable": true, ... },         │
│            "editable": true                                     │
│          }                                                      │
│        ]                                                        │
│      }                                                          │
│    }                                                            │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. FRONTEND (EntityDataTable.tsx)                              │
│    import { renderViewModeFromMetadata, renderEditModeFromMetadata }
│                                                                 │
│    // Priority 1: Backend Metadata (PURE METADATA-DRIVEN)      │
│    const columns = useMemo(() => {                             │
│      if (metadata?.fields) {                                   │
│        return metadata.fields                                  │
│          .filter(f => f.visible.EntityDataTable === true)      │
│          .map(fieldMeta => ({                                  │
│            key: fieldMeta.key,                                 │
│            title: fieldMeta.label,                             │
│            backendMetadata: fieldMeta, // Store for rendering  │
│            // Backend tells frontend how to render             │
│            render: (value, record) =>                          │
│              renderViewModeFromMetadata(value, fieldMeta, record)
│          }));                                                  │
│      }                                                         │
│      return [];                                                │
│    }, [metadata]);                                             │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. UI RENDERING (Pure Metadata Execution)                      │
│    • View Mode: renderViewModeFromMetadata() reads renderType  │
│      - 'currency' → formatCurrency($50,000.00)                 │
│      - 'badge' → renderDataLabelBadge(with color)              │
│      - 'date' → formatFriendlyDate()                           │
│    • Edit Mode: renderEditModeFromMetadata() reads inputType   │
│      - 'currency' → <input type="number" step="0.01" />        │
│      - 'select' → <ColoredDropdown with options />             │
│      - 'date' → <DatePicker />                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Backend Metadata Architecture

### Backend Formatter Service (Single Source of Truth)

**File**: `apps/api/src/services/backend-formatter.service.ts`

```typescript
import { getEntityMetadata } from '@/services/backend-formatter.service.js';

// LIST endpoint
fastify.get('/api/v1/project', async (request, reply) => {
  const projects = await db.execute(sql`SELECT * FROM app.d_project...`);

  // Generate metadata from first row (or empty object)
  const fieldMetadata = projects.length > 0
    ? getEntityMetadata('project', projects[0])
    : getEntityMetadata('project');

  return {
    data: projects,
    metadata: fieldMetadata,  // ← Backend sends complete rendering instructions
    total, limit, offset
  };
});
```

### 35+ Backend Pattern Rules

| Pattern | Generated Metadata | Example |
|---------|-------------------|---------|
| `*_amt`, `*_price`, `*_cost` | `renderType: 'currency'`, `inputType: 'currency'` | $50,000.00 input |
| `dl__*` | `renderType: 'badge'`, `loadFromDataLabels: true` | Badge with color |
| `*_date` | `renderType: 'date'`, `inputType: 'date'` | Date picker |
| `*_ts`, `*_at` | `renderType: 'timestamp'`, `inputType: 'datetime'` | DateTime picker |
| `is_*`, `*_flag` | `renderType: 'boolean'`, `inputType: 'checkbox'` | Toggle |
| `*__employee_id` | `renderType: 'reference'`, `loadFromEntity: 'employee'` | Dropdown |
| `metadata` (field) | `renderType: 'json'`, `component: 'MetadataTable'` | JSON table |

**See**: `docs/services/backend-formatter.service.md` for complete pattern rules

---

## 5. Frontend Renderer (Pure Metadata Consumer)

### Frontend Formatter Service

**File**: `apps/web/src/lib/frontEndFormatterService.tsx`

```typescript
import {
  renderViewModeFromMetadata,    // View mode (reads metadata.renderType)
  renderEditModeFromMetadata,     // Edit mode (reads metadata.inputType)
  hasBackendMetadata              // Type guard
} from '@/lib/frontEndFormatterService';

// EntityDataTable.tsx - Pure metadata-driven rendering
const columns = useMemo(() => {
  if (metadata?.fields) {
    return metadata.fields
      .filter(f => f.visible.EntityDataTable === true)
      .map(fieldMeta => ({
        key: fieldMeta.key,
        title: fieldMeta.label,
        width: fieldMeta.width,
        align: fieldMeta.align,
        backendMetadata: fieldMeta,  // Store for use in edit mode
        // Backend tells frontend how to render
        render: (value, record) => renderViewModeFromMetadata(value, fieldMeta, record)
      }));
  }
  return [];
}, [metadata]);
```

### View Mode Rendering

```typescript
// Backend says: renderType: 'currency'
renderViewModeFromMetadata(50000, fieldMeta)
// Returns: <span className="font-mono">$50,000.00</span>

// Backend says: renderType: 'badge', loadFromDataLabels: true
renderViewModeFromMetadata('planning', fieldMeta)
// Returns: <Badge color="blue">Planning</Badge>
```

### Edit Mode Rendering

```typescript
// Backend says: inputType: 'currency'
renderEditModeFromMetadata(50000, fieldMeta, onChange)
// Returns: <input type="number" step="0.01" />

// Backend says: inputType: 'select', loadFromDataLabels: true
renderEditModeFromMetadata('planning', fieldMeta, onChange)
// Returns: <ColoredDropdown><option>Planning</option>...</ColoredDropdown>
```

**See**: `docs/services/frontEndFormatterService.md` for complete documentation

---

## 6. Options Loading (Backend Metadata-Driven)

### Deprecated Approach (Removed)

```typescript
// ❌ REMOVED - Frontend pattern detection
const columnCapabilities = useMemo(() => {
  const capabilities = new Map();
  columns.forEach(col => {
    capabilities.set(col.key, getFieldCapability(col.key, col.editType));  // ❌ PURGED
  });
  return capabilities;
}, [columns]);
```

### Current Approach (Backend Metadata)

```typescript
// ✅ CURRENT - Backend metadata-driven
const [settingOptions, setSettingOptions] = useState<Map<string, SettingOption[]>>(new Map());

useEffect(() => {
  const loadAllSettingOptions = async () => {
    const optionsMap = new Map();

    // Find columns that need dynamic settings using backend metadata
    const columnsNeedingSettings = columns.filter(col => {
      const backendMeta = col.backendMetadata as BackendFieldMetadata | undefined;
      // Check backend metadata first, fallback to column.loadDataLabels
      return backendMeta?.loadFromDataLabels || col.loadDataLabels;
    });

    // Load options for each column
    await Promise.all(
      columnsNeedingSettings.map(async (col) => {
        const backendMeta = col.backendMetadata as BackendFieldMetadata | undefined;
        // Get datalabel from backend metadata
        const datalabel = backendMeta?.settingsDatalabel || extractSettingsDatalabel(col.key);
        const options = await loadFieldOptions(datalabel);
        if (options.length > 0) {
          optionsMap.set(col.key, options);
        }
      })
    );

    setSettingOptions(optionsMap);
  };

  if (inlineEditable) {
    loadAllSettingOptions();
  }
}, [columns, inlineEditable]);
```

---

## 7. Cell Rendering (Backend Metadata-Driven)

### Deprecated Approach (Removed)

```typescript
// ❌ REMOVED - Pattern-based capability detection
const capability = columnCapabilities.get(column.key);  // ❌ PURGED
const fieldEditable = capability?.inlineEditable || false;
const editType = capability?.editType || 'text';
const isFileField = capability?.isFileUpload || false;
```

### Current Approach (Backend Metadata)

```typescript
// ✅ CURRENT - Backend metadata for ALL rendering decisions
const backendMeta = column.backendMetadata as BackendFieldMetadata | undefined;
const fieldEditable = backendMeta?.editable ?? column.editable ?? false;
const editType = backendMeta?.inputType ?? column.editType ?? 'text';
const isFileField = editType === 'file';

return (
  <td>
    {isEditing && fieldEditable ? (
      // EDIT MODE - Backend-driven renderer
      editType === 'file' ? (
        <InlineFileUploadCell accept={backendMeta?.accept} ... />
      ) : editType === 'select' && hasSettingOptions ? (
        <ColoredDropdown options={columnOptions} ... />
      ) : (
        // ALL OTHER FIELDS - Backend metadata-driven
        <div onClick={(e) => e.stopPropagation()}>
          {renderEditModeFromMetadata(value, backendMeta || createFallbackMetadata(column.key), onChange)}
        </div>
      )
    ) : (
      // VIEW MODE - Backend metadata-driven
      renderViewModeFromMetadata(value, backendMeta || createFallbackMetadata(column.key), record)
    )}
  </td>
);
```

---

## 8. Fallback Metadata (Minimal)

### When Backend Doesn't Send Metadata

```typescript
// Minimal fallback - NO PATTERN DETECTION
// Backend should ALWAYS send metadata via getEntityMetadata()
// This fallback is only for non-integrated routes
function createFallbackMetadata(columnKey: string): BackendFieldMetadata {
  return {
    key: columnKey,
    label: columnKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    renderType: 'text',  // Plain text only
    inputType: 'text',
    visible: {
      EntityDataTable: true,
      EntityDetailView: true,
      EntityFormContainer: true,
      KanbanView: true,
      CalendarView: true
    },
    editable: true,
    align: 'left'
  };
}
```

**Key**: Fallback has ZERO pattern detection - just plain text. Backend is responsible for ALL field type detection.

---

## 9. Integration Status

### Integrated Routes (Send Backend Metadata)

✅ **task** - `/api/v1/task` sends metadata
✅ **project** - `/api/v1/project` sends metadata
✅ **business** - `/api/v1/business` sends metadata
✅ **office** - `/api/v1/office` sends metadata

### Non-Integrated Routes (Use Fallback)

⚠️ **employee**, **client**, **role**, etc. - Use createFallbackMetadata (plain text)

**Migration Path**: Add `getEntityMetadata()` call to route → Send in response → Frontend automatically uses backend metadata

---

## 10. Performance Optimizations

1. **Backend Metadata Caching** - In-memory cache per entity (100x faster)
2. **5-Minute Settings Cache** - Prevents redundant API calls
3. **Parallel Options Loading** - All settings load simultaneously
4. **O(1) Color Lookups** - settingsColorCache for instant rendering
5. **useMemo for Columns** - Computed once from metadata
6. **Portal Rendering** - Dropdown DOM updates isolated from table

---

## 11. Critical Implementation Rules

### ✅ DO - Current Patterns

```typescript
// ✅ Use backend metadata for all rendering decisions
const backendMeta = column.backendMetadata as BackendFieldMetadata | undefined;
const fieldEditable = backendMeta?.editable ?? false;

// ✅ Check backend metadata for datalabels
const isSettingsField = backendMeta?.loadFromDataLabels || column.loadDataLabels;

// ✅ Get datalabel from backend metadata
const datalabel = backendMeta?.settingsDatalabel || extractSettingsDatalabel(columnKey);

// ✅ Use backend metadata renderers
renderViewModeFromMetadata(value, backendMeta, record);
renderEditModeFromMetadata(value, backendMeta, onChange);

// ✅ Import from frontEndFormatterService (correct name)
import { renderViewModeFromMetadata } from '@/lib/frontEndFormatterService';
```

### ❌ DON'T - Deprecated Patterns

```typescript
// ❌ DON'T use pattern detection functions (PURGED)
const capability = getFieldCapability(col.key, col.editType);  // ❌ REMOVED
const capabilities = columnCapabilities.get(col.key);          // ❌ REMOVED
detectField(columnKey);                                        // ❌ REMOVED
renderFieldView(value);                                        // ❌ REMOVED
renderFieldEdit(value);                                        // ❌ REMOVED

// ❌ DON'T detect field types in frontend (backend's job)
if (columnKey.includes('_amt')) { ... }                        // ❌ WRONG
if (columnKey.startsWith('dl__')) { ... }                      // ❌ WRONG

// ❌ DON'T import from universalFormatterService (renamed)
import { ... } from '@/lib/universalFormatterService';         // ❌ OLD NAME
```

---

## 12. Key Files

| File | Purpose | Pattern |
|------|---------|---------|
| **Backend** | | |
| `apps/api/src/services/backend-formatter.service.ts` | **Metadata generation** | 35+ pattern rules, single source of truth |
| `apps/api/src/modules/project/routes.ts` | Example integrated route | Calls getEntityMetadata(), sends in response |
| **Frontend** | | |
| `apps/web/src/lib/frontEndFormatterService.tsx` | **Metadata renderer** | Pure renderer, zero pattern detection |
| `apps/web/src/components/shared/ui/EntityDataTable.tsx` | Entity data table | Consumes backend metadata |
| `apps/web/src/components/shared/ui/DataTableBase.tsx` | Pure base component | NO formatting logic |
| `apps/web/src/components/shared/ui/SettingsDataTable.tsx` | Datalabel table | Specialized for settings |
| `apps/web/src/components/shared/dataTable/FilteredDataTable.tsx` | Wrapper component | Routes to correct table type |

---

## Summary

**Architecture**: 100% Backend-Driven Metadata

```
Backend (backend-formatter.service.ts)
  → getEntityMetadata() generates all metadata from column names (35+ pattern rules)
  → API routes return { data, metadata }

Frontend (EntityDataTable + frontEndFormatterService)
  → Consumes metadata.fields
  → Stores backendMetadata in columns
  → Renders via renderViewModeFromMetadata/renderEditModeFromMetadata
  → createFallbackMetadata() for non-integrated routes (NO pattern detection)
```

**Key Principles:**
- ✅ Backend is single source of truth for ALL field metadata
- ✅ Frontend is pure renderer - executes backend instructions exactly
- ✅ Zero frontend pattern detection or configuration
- ✅ Add column to DB → Backend generates metadata automatically

**Last Updated:** 2025-11-20 (v4.0 - Backend Metadata Architecture)
**Status:** ✅ Production Ready - getFieldCapability purged, 100% backend-driven
