# EntityFormContainer Component

**Version:** 8.2.0 | **Location:** `apps/web/src/components/shared/entity/EntityFormContainer.tsx`

---

## Semantics

EntityFormContainer is a universal form component for creating and editing entities. It uses the v8.2.0 `{ viewType, editType }` metadata structure via `extractViewType()` and `extractEditType()` helpers, handles entity references (`_ID`/`_IDS` structures), and supports FormattedRow data.

**Core Principle:** Backend metadata with `{ viewType, editType }` structure controls all form fields. Use `extractViewType()` for view mode, `extractEditType()` for edit mode inputs.

---

## System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   ENTITY FORM CONTAINER ARCHITECTURE (v8.2.0)            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    API Response Structure                        │    │
│  │  {                                                               │    │
│  │    data: {...},                                                  │    │
│  │    metadata: {                                                   │    │
│  │      entityFormContainer: {                                      │    │
│  │        viewType: { field: { renderType, behavior, style } },     │    │
│  │        editType: { field: { inputType, validation } }            │    │
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
│  │  │  Entity References (_ID - single)                          │  │    │
│  │  │  Uses editType[key].lookupSource === 'entityInstance'     │  │    │
│  │  │  <EntitySelect entityCode={editType[key].lookupEntity} /> │  │    │
│  │  └───────────────────────────────────────────────────────────┘  │    │
│  │                                                                  │    │
│  │  ┌───────────────────────────────────────────────────────────┐  │    │
│  │  │  Stage Fields (dl__*_stage)                                │  │    │
│  │  │  VIEW: DAGVisualizer (viewType[key].renderType === 'dag') │  │    │
│  │  │  EDIT: DataLabelSelect (editType[key].inputType === 'select')│    │
│  │  └───────────────────────────────────────────────────────────┘  │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Props Interface (v8.2.0)

```typescript
import type { FormattedRow } from '@/lib/formatters';

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
  renderType: string;     // 'text', 'currency', 'date', 'badge', 'dag', etc.
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

## Data Flow Diagram (v8.2.0)

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

## Field Type Mapping (v8.2.0)

| viewType.renderType | View Display | editType.inputType | Edit Component |
|---------------------|--------------|--------------------| ---------------|
| `currency` | `$50,000.00` | `number` | `<input type="number">` |
| `badge` | Badge with color | `select` | `<DataLabelSelect>` |
| `dag` | DAGVisualizer | `select` | `<DataLabelSelect>` |
| `date` | `Jan 15, 2025` | `date` | `<input type="date">` |
| `boolean` | Check/X icon | `checkbox` | `<input type="checkbox">` |
| `reference` | Entity name | `select` | `<EntitySelect>` |
| `text` | Plain text | `text` | `<input type="text">` |
| `textarea` | Multi-line text | `textarea` | `<textarea>` |

---

## Entity Reference Handling

### _ID Structure (Single Reference)

```typescript
// Backend sends:
data._ID = {
  manager: {
    entity_code: 'employee',
    manager__employee_id: 'uuid-123',
    manager: 'John Smith'
  }
};

// editType for this field:
editType['manager__employee_id'] = {
  inputType: 'select',
  lookupSource: 'entityInstance',
  lookupEntity: 'employee'
};

// Component renders EntitySelect based on editType
```

### _IDS Structure (Multiple References)

```typescript
// Backend sends:
data._IDS = {
  stakeholder: [
    {
      entity_code: 'employee',
      stakeholder__employee_id: 'uuid-1',
      stakeholder: 'Alice'
    },
    {
      entity_code: 'employee',
      stakeholder__employee_id: 'uuid-2',
      stakeholder: 'Bob'
    }
  ]
};

// Component renders EntityMultiSelect based on editType
```

---

## Usage Example (v8.2.0)

```typescript
import { useEntityInstance } from '@/lib/hooks/useEntityQuery';
import { EntityFormContainer } from '@/components/shared/entity/EntityFormContainer';

function ProjectDetailPage({ projectId }) {
  const { data: queryResult, isLoading } = useEntityInstance('project', projectId);

  // queryResult contains:
  // - data: raw entity data
  // - metadata: { entityFormContainer: { viewType, editType } }
  const data = queryResult?.data;
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
| Frontend pattern detection | Backend sends complete metadata |
| Hardcoded field list | Use `viewType` from backend |
| Manual entity reference dropdowns | Use `EntitySelect` with `editType.lookupEntity` |
| Fallback metadata generation | Backend MUST send metadata |

---

**Last Updated:** 2025-11-26 | **Version:** 8.2.0 | **Status:** Production Ready
