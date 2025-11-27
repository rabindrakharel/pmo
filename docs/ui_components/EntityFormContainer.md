# EntityFormContainer Component

**Version:** 8.3.2 | **Location:** `apps/web/src/components/shared/entity/EntityFormContainer.tsx`

---

## Architectural Truth (v8.3.2)

**Metadata properties control datalabel field rendering:**

| Metadata | Property | Purpose |
|----------|----------|---------|
| **viewType** | `renderType` + `component` | Controls WHICH component renders (view mode) |
| **editType** | `inputType` + `component` | Controls WHICH component renders (edit mode) |
| **editType** | `lookupSource` + `datalabelKey` | Controls WHERE data comes from |

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  DATALABEL FIELD RENDERING ARCHITECTURE (v8.3.2)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  viewType.dl__project_stage:                                                 │
│  ┌────────────────────────────────┐                                          │
│  │ renderType: "component"        │──┐                                       │
│  │ component: "DAGVisualizer"     │──┼──► viewVizContainer = "DAGVisualizer" │
│  └────────────────────────────────┘  │                                       │
│                                      │                                       │
│                                      ▼                                       │
│          EntityFormContainer_viz_container: {                                │
│            view: "DAGVisualizer"   ◄── This is the ONLY switch              │
│          }                                                                   │
│                                      │                                       │
│                                      ▼                                       │
│          if (vizContainer?.view === 'DAGVisualizer') {                       │
│            return <DAGVisualizer nodes={...} />                              │
│          }                                                                   │
│                                                                              │
│  editType.dl__project_stage:                                                 │
│  ┌────────────────────────────────┐                                          │
│  │ inputType: "component"         │──┐                                       │
│  │ component: "BadgeDropdownSelect"│──┼──► editVizContainer = "BadgeDropdownSelect"│
│  │ lookupSource: "datalabel"      │──┼──► Filter for loading datalabel options│
│  │ datalabelKey: "dl__project_stage"│──► Cache key for options               │
│  └────────────────────────────────┘                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Semantics

EntityFormContainer is a universal form component for creating and editing entities. It uses the v8.3.2 `{ viewType, editType }` metadata structure, handles entity references via `ref_data_entityInstance`, and supports FormattedRow data.

**Core Principle:** Backend metadata with `{ viewType, editType }` structure controls all form fields. viewType controls WHICH component renders, editType controls WHERE data comes from.

---

## System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   ENTITY FORM CONTAINER ARCHITECTURE (v8.3.2)            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    API Response Structure                        │    │
│  │  {                                                               │    │
│  │    data: {...},                                                  │    │
│  │    ref_data_entityInstance: { employee: { "uuid": "James Miller" } },           │    │
│  │    metadata: {                                                   │    │
│  │      entityFormContainer: {                                      │    │
│  │        viewType: { field: { renderType, component, behavior } }, │    │
│  │        editType: { field: { inputType, lookupSource, datalabelKey } }│ │
│  │      }                                                           │    │
│  │    }                                                             │    │
│  │  }                                                               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              v                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    EntityFormContainer                           │    │
│  │                                                                  │    │
│  │  const viewType = extractViewType(metadata.entityFormContainer); │    │
│  │  const editType = extractEditType(metadata.entityFormContainer); │    │
│  │                                                                  │    │
│  │  ┌───────────────────────────────────────────────────────────┐  │    │
│  │  │  Standard Fields (from viewType/editType)                  │  │    │
│  │  │  VIEW: row.display[key] or formatted value                │  │    │
│  │  │  EDIT: renderEditModeFromMetadata(raw[key], editType[key]) │  │    │
│  │  └───────────────────────────────────────────────────────────┘  │    │
│  │                                                                  │    │
│  │  ┌───────────────────────────────────────────────────────────┐  │    │
│  │  │  Entity References                                         │  │    │
│  │  │  Uses editType[key].lookupSource === 'entityInstance'     │  │    │
│  │  │  <EntitySelect entityCode={editType[key].lookupEntity} /> │  │    │
│  │  └───────────────────────────────────────────────────────────┘  │    │
│  │                                                                  │    │
│  │  ┌───────────────────────────────────────────────────────────┐  │    │
│  │  │  Datalabel Fields (dl__*)                                  │  │    │
│  │  │  VIEW: viewType.renderType === 'component' &&              │  │    │
│  │  │        viewType.component === 'DAGVisualizer' → DAGVisualizer│   │
│  │  │  EDIT: BadgeDropdownSelect with cached options             │  │    │
│  │  │  DATA: editType.lookupSource === 'datalabel' → load options │  │    │
│  │  └───────────────────────────────────────────────────────────┘  │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Props Interface (v8.3.2)

```typescript
import type { FormattedRow } from '@/lib/formatters';
import type { RefData } from '@/lib/hooks/useRefData';

interface EntityFormContainerProps {
  /** Entity configuration (optional - can derive from metadata) */
  config?: EntityConfig;

  /** Entity data (can be raw or FormattedRow) */
  data: Record<string, any>;

  /** Is form in edit mode? */
  isEditing: boolean;

  /** Field change handler */
  onChange: (fieldKey: string, value: any) => void;

  /** Form mode */
  mode?: 'create' | 'edit';

  // ============================================================================
  // PRIORITY 1: Backend Metadata (v8.2.0 Architecture)
  // ============================================================================
  /**
   * Backend-generated metadata with { viewType, editType } structure (REQUIRED)
   * Component uses extractViewType() and extractEditType() helpers
   */
  metadata?: EntityMetadata;

  /** Datalabel options (cached in datalabelMetadataStore) */
  datalabels?: DatalabelData[];

  /** Pre-formatted data from format-at-read (optional) */
  formattedData?: FormattedRow<Record<string, any>>;

  /**
   * v8.3.0: Reference data lookup table for entity reference resolution
   * Used to resolve UUIDs to display names for *_id and *_ids fields
   * Structure: { entity_code: { uuid: name } }
   */
  ref_data_entityInstance?: RefData;
}

// EntityMetadata from API response (v8.2.0)
interface EntityMetadata {
  entityFormContainer: ComponentMetadata;
  entityDataTable?: ComponentMetadata;
}

// ComponentMetadata structure (v8.2.0 - REQUIRED)
interface ComponentMetadata {
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
}
```

---

## Metadata Types (v8.2.0)

### ViewFieldMetadata

```typescript
interface ViewFieldMetadata {
  dtype: 'str' | 'float' | 'int' | 'bool' | 'uuid' | 'date' | 'timestamp' | 'jsonb';
  label: string;
  renderType: string;     // 'text', 'currency', 'date', 'badge', 'boolean', 'component', etc.
  component?: string;     // Component name when renderType='component' (e.g., 'DAGVisualizer')
  behavior: {
    visible?: boolean;    // Show in form
  };
  style: Record<string, any>;
  datalabelKey?: string;  // For badge fields
}
```

### EditFieldMetadata

```typescript
interface EditFieldMetadata {
  dtype: string;
  label: string;
  inputType: string;      // 'text', 'number', 'select', 'date', 'checkbox', 'textarea', etc.
  behavior: {
    editable?: boolean;   // Allow editing
  };
  validation: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
  };
  lookupSource?: 'datalabel' | 'entityInstance';
  datalabelKey?: string;    // For datalabel select fields
  lookupEntity?: string;    // For entity reference fields
}
```

---

## Data Flow Diagram (v8.3.0)

```
Field Generation Flow
─────────────────────

Backend Metadata                     extractViewType/editType       Form Field
────────────────                     ─────────────────────────       ──────────

metadata.entityFormContainer: {  →   viewType = extractViewType()  →  VIEW MODE:
  viewType: {                        editType = extractEditType()      row.display[key]
    budget_amt: {                                                      or formatted value
      dtype: 'float',                // v8.2.0: REQUIRED
      label: 'Budget',               // Returns viewType or null
      renderType: 'currency',        // Logs error if invalid        EDIT MODE:
      behavior: { visible: true }                                      renderEditModeFromMetadata(
    }                                                                    data[key],
  },                                                                     editType[key],
  editType: {                                                            onChange
    budget_amt: {                                                      )
      inputType: 'number',
      validation: { min: 0 }
    }
  }
}


ref_data_entityInstance Pattern (v8.3.0)
─────────────────────────

API Response                         EntityFormContainer
────────────                         ───────────────────

{                                    const { resolveFieldDisplay } = useRefData(ref_data_entityInstance);
  data: {
    manager__employee_id: 'uuid-123'   // Field value: UUID
  },
  ref_data_entityInstance: {                        // Resolution:
    employee: {                      // ref_data_entityInstance['employee']['uuid-123'] → 'John Smith'
      'uuid-123': 'John Smith'
    }
  },
  metadata: {
    entityFormContainer: {
      viewType: {
        manager__employee_id: {
          lookupEntity: 'employee',  // ← Determines ref_data_entityInstance lookup key
          lookupSource: 'entityInstance'
        }
      }
    }
  }
}


FormattedRow Support (v8.2.0)
─────────────────────────────

API Response         format-at-read          EntityFormContainer
────────────         ───────────────         ───────────────────

{ data: {...} }  →   FormattedRow = {    →   // Check for FormattedRow
                       raw: { budget: 50000 },
                       display: { budget: '$50,000.00' },
                       styles: {}
                     }

                     // View mode uses display
                     // Edit mode uses raw
```

---

## Component Implementation (v8.2.0)

### Field Generation with Extractors

```typescript
import { extractViewType, extractEditType, isValidComponentMetadata } from '@/lib/formatters';

function EntityFormContainer({ data, metadata, isEditing, onChange, formattedData }: Props) {
  // Get component-specific metadata
  const componentMetadata = metadata?.entityFormContainer;

  // v8.2.0: Use extractors to get viewType and editType
  const viewType = extractViewType(componentMetadata);
  const editType = extractEditType(componentMetadata);

  // Generate field list from metadata
  const fields = useMemo(() => {
    if (!viewType) {
      console.error('[EntityFormContainer] No viewType - backend must send { viewType, editType }');
      return [];
    }

    return Object.entries(viewType)
      .filter(([_, fieldMeta]) => fieldMeta.behavior?.visible !== false)
      .map(([fieldKey, viewMeta]) => {
        const editMeta = editType?.[fieldKey];

        return {
          key: fieldKey,
          label: viewMeta.label,
          dtype: viewMeta.dtype,
          renderType: viewMeta.renderType,
          inputType: editMeta?.inputType ?? 'text',
          editable: editMeta?.behavior?.editable ?? false,
          validation: editMeta?.validation ?? {},
          lookupSource: editMeta?.lookupSource,
          datalabelKey: viewMeta.datalabelKey || editMeta?.datalabelKey,
          lookupEntity: editMeta?.lookupEntity,
        };
      });
  }, [viewType, editType]);

  return (
    <div className="space-y-4">
      {fields.map(field => (
        <FormField
          key={field.key}
          field={field}
          value={data[field.key]}
          displayValue={formattedData?.display?.[field.key]}
          isEditing={isEditing}
          onChange={(value) => onChange(field.key, value)}
        />
      ))}
    </div>
  );
}
```

### Field Rendering

```typescript
function FormField({ field, value, displayValue, isEditing, onChange }) {
  // VIEW MODE
  if (!isEditing) {
    // Use pre-formatted display value if available
    if (displayValue !== undefined) {
      return <span>{displayValue}</span>;
    }

    // Fallback to renderViewModeFromMetadata
    return renderViewModeFromMetadata(value, {
      renderType: field.renderType,
      label: field.label,
      datalabelKey: field.datalabelKey,
    });
  }

  // EDIT MODE - use editType metadata
  const editMeta = {
    inputType: field.inputType,
    label: field.label,
    validation: field.validation,
    lookupSource: field.lookupSource,
    datalabelKey: field.datalabelKey,
    lookupEntity: field.lookupEntity,
  };

  // Special handling for entity references
  if (field.lookupSource === 'entityInstance') {
    return (
      <EntitySelect
        entityCode={field.lookupEntity}
        value={value}
        onChange={onChange}
      />
    );
  }

  // Special handling for datalabel selects
  if (field.lookupSource === 'datalabel') {
    return (
      <DataLabelSelect
        datalabelKey={field.datalabelKey}
        value={value}
        onChange={onChange}
      />
    );
  }

  // Standard field - use backend metadata
  return renderEditModeFromMetadata(value, editMeta, onChange);
}
```

---

## Field Type Mapping (v8.3.2)

| viewType.renderType | viewType.component | View Display | editType.inputType | Edit Component |
|---------------------|--------------------|--------------|--------------------|----------------|
| `currency` | - | `$50,000.00` | `number` | `<DebouncedInput type="number">` |
| `badge` | - | Badge with color | `select` | `<BadgeDropdownSelect>` |
| `component` | `DAGVisualizer` | DAGVisualizer graph | `select` | Interactive `<DAGVisualizer>` or `<BadgeDropdownSelect>` |
| `date` | - | `Jan 15, 2025` | `date` | `<input type="date">` |
| `boolean` | - | Check/X icon | `checkbox` | `<input type="checkbox">` |
| `reference` | - | Entity name (via ref_data_entityInstance) | `select` | `<EntitySelect>` |
| `text` | - | Plain text | `text` | `<DebouncedInput type="text">` |
| `textarea` | - | Multi-line text | `textarea` | `<DebouncedTextarea>` |
| `jsonb` | `MetadataTable` | JSON viewer | `jsonb` | `<MetadataTable isEditing={true}>` |
| `jsonb` | `QuoteItemsRenderer` | Quote items | `jsonb` | `<QuoteItemsRenderer isEditing={true}>` |
| `array` | - | Badge list | `array` | `<DebouncedInput>` (comma-separated) |
| `timestamp` | - | Relative time | `timestamp` | Read-only display |

**Notes:**
- `viewType.renderType === 'component'` + `viewType.component === 'DAGVisualizer'` → renders DAGVisualizer
- `editType.lookupSource === 'datalabel'` → loads options from datalabel cache
- `editType.inputType === 'BadgeDropdownSelect'` is also supported as explicit type
- `vizContainer?.edit === 'DAGVisualizer'` → renders interactive DAGVisualizer with `onNodeClick`
- `vizContainer?.edit === 'MetadataTable'` → renders editable MetadataTable for JSONB fields

---

## Entity Reference Handling (v8.3.0)

### ref_data_entityInstance Pattern (Current)

```typescript
// Backend sends:
{
  data: {
    manager__employee_id: 'uuid-123',
    stakeholder__employee_ids: ['uuid-1', 'uuid-2']
  },
  ref_data_entityInstance: {
    employee: {
      'uuid-123': 'John Smith',
      'uuid-1': 'Alice',
      'uuid-2': 'Bob'
    }
  },
  metadata: {
    entityFormContainer: {
      viewType: {
        manager__employee_id: {
          lookupEntity: 'employee',
          lookupSource: 'entityInstance'
        }
      }
    }
  }
}

// Component uses useRefData hook:
const { resolveFieldDisplay, isRefField, getEntityCode } = useRefData(ref_data_entityInstance);

// Resolution: ref_data_entityInstance['employee']['uuid-123'] → 'John Smith'
```

### useRefData Hook

```typescript
import { useRefData, type RefData } from '@/lib/hooks/useRefData';

function EntityFormContainer({ ref_data_entityInstance, metadata, ... }) {
  // Hook provides utilities for entity reference resolution
  const { resolveFieldDisplay, isRefField, getEntityCode } = useRefData(ref_data_entityInstance);

  // Resolve using metadata (NOT field name pattern detection)
  const fieldMeta = metadata.entityFormContainer.viewType.manager__employee_id;
  const displayName = resolveFieldDisplay(fieldMeta, uuid);  // → "John Smith"
}
```

### Deprecated: _ID/_IDS Structure

```typescript
// DEPRECATED (v8.2.x) - Use ref_data_entityInstance pattern instead
data._ID = { manager: { ... } };   // ❌ Deprecated
data._IDS = { stakeholder: [...] }; // ❌ Deprecated
```

---

## Usage Example (v8.3.0)

```typescript
import { useEntityInstance } from '@/lib/hooks/useEntityQuery';
import { EntityFormContainer } from '@/components/shared/entity/EntityFormContainer';

function ProjectDetailPage({ projectId }) {
  const { data: queryResult, isLoading } = useEntityInstance('project', projectId);

  // queryResult contains:
  // - data: raw entity data
  // - ref_data_entityInstance: { entity_code: { uuid: name } } for entity reference resolution
  // - metadata: { entityFormContainer: { viewType, editType } }
  const data = queryResult?.data;
  const ref_data_entityInstance = queryResult?.ref_data_entityInstance;
  const metadata = queryResult?.metadata;

  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState(data);

  const handleChange = (fieldKey: string, value: any) => {
    setEditedData(prev => ({ ...prev, [fieldKey]: value }));
  };

  return (
    <EntityFormContainer
      data={isEditing ? editedData : data}
      metadata={metadata}
      ref_data_entityInstance={ref_data_entityInstance}
      isEditing={isEditing}
      onChange={handleChange}
    />
  );
}
```

---

## User Interaction Flow (v8.2.0)

```
Form Load Flow
──────────────

1. Page loads entity data
   │
2. useEntityInstance returns:
   ├── data: raw entity data
   └── metadata: { entityFormContainer: { viewType, editType } }
   │
3. EntityFormContainer extracts metadata:
   const viewType = extractViewType(metadata.entityFormContainer);
   const editType = extractEditType(metadata.entityFormContainer);
   │
4. Fields generated from viewType (visible, label, renderType)
   │
5. VIEW MODE: Uses viewType.renderType for display
   EDIT MODE: Uses editType.inputType for inputs


Edit Flow
─────────

1. User clicks Edit button
   │
2. isEditing = true
   │
3. For each visible field:
   ├── editType[key].inputType determines input component
   ├── editType[key].lookupSource determines data source
   └── editType[key].validation determines constraints
   │
4. User modifies values
   │
5. onChange(fieldKey, value) updates local state
   │
6. User clicks Save → PATCH /api/v1/project/:id
   │
7. Query invalidation, form refreshes
```

---

## Critical Considerations

### Design Principles (v8.2.0)

1. **extractViewType()** - Always use helper to access viewType
2. **extractEditType()** - Always use helper to access editType
3. **FormattedRow Support** - Can use `formattedData.display[key]` in view mode
4. **Raw Values** - Edit mode uses `data[key]` for original values
5. **Backend Required** - Metadata must contain `{ viewType, editType }`
6. **Datalabel Store** - Use cached datalabels from `datalabelMetadataStore`

### Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Direct `metadata.viewType` access | Use `extractViewType(metadata)` |
| Frontend pattern detection (e.g., `_id` suffix) | Backend sends `lookupEntity` in metadata |
| Hardcoded field list | Use `viewType` from backend |
| Manual entity reference dropdowns | Use `EntitySelect` with `editType.lookupEntity` |
| Fallback metadata generation | Backend MUST send metadata |
| Using `_ID`/`_IDS` embedded objects | Use `ref_data_entityInstance` lookup table |
| Pattern detection for DAG fields | Use `viewType.renderType === 'component'` + `viewType.component` |

---

## Memoization Strategy

The component uses `React.memo` with a custom `arePropsEqual` function to prevent unnecessary re-renders during editing:

```typescript
function arePropsEqual(prevProps, nextProps): boolean {
  // Re-render triggers:
  // - isEditing changes
  // - mode changes
  // - metadata changes (structure)
  // - config changes
  // - datalabels changes
  // - ref_data_entityInstance changes (v8.3.0)
  // - data KEYS change (not values during editing)

  // Does NOT trigger re-render:
  // - onChange function reference changes (captured in useCallback)
  // - data VALUES change during editing (handled by local state)

  return true; // if none of the above changed
}

export const EntityFormContainer = React.memo(EntityFormContainerInner, arePropsEqual);
```

**Key insight:** During editing, text inputs use `DebouncedInput`/`DebouncedTextarea` components that manage their own local state. This allows instant typing feedback while debouncing parent updates, preventing re-renders on every keystroke.

---

**Last Updated:** 2025-11-27 | **Version:** 8.3.2 | **Status:** Production Ready

**Recent Updates:**
- v8.3.2 (2025-11-27): **Component-Driven Rendering Architecture**
  - viewType controls WHICH component renders (`renderType: 'component'` + `component`)
  - editType controls WHERE data comes from (`lookupSource: 'datalabel'` + `datalabelKey`)
  - Fixed DAGVisualizer rendering: check `vizContainer?.view === 'DAGVisualizer'` BEFORE `field.type === 'select'`
  - Fixed MetadataTable rendering: check `vizContainer?.view === 'MetadataTable'` BEFORE `field.type === 'jsonb'`
  - Added `case 'component':` in edit mode switch for `inputType: 'component'` fields
  - Added `BadgeDropdownSelect` as explicit `field.type` case in switch statement
  - `EntityFormContainer_viz_container: { view: string, edit: string }` object structure
- v8.3.0 (2025-11-26): **ref_data_entityInstance Pattern**
  - Added `ref_data_entityInstance?: RefData` prop for entity reference resolution
  - Added `useRefData` hook integration for `resolveFieldDisplay`, `isRefField`, `getEntityCode`
  - Deprecated `_ID`/`_IDS` embedded object pattern
  - Added `ref_data_entityInstance` to `arePropsEqual` memoization check
- v8.2.0 (2025-11-25): **viewType/editType Architecture**
  - Backend metadata REQUIRED with `{ viewType, editType }` structure
  - Added `extractViewType()` and `extractEditType()` helper functions
  - `formattedData.display[key]` for pre-formatted view mode values
