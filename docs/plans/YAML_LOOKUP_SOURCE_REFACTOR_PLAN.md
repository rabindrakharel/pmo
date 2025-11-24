# YAML Lookup Source Refactor Plan

## Overview

Unify the disparate `loadFromDataLabels: true` and `loadFromEntity: true` boolean flags into a single, consistent `lookupSource` property that explicitly declares where field options are fetched from.

## Current State Analysis

### Problem 1: Inconsistent Property Names

```yaml
# edit-type-mapping.yaml - Current
datalabel:
  loadFromDataLabels: true     # Boolean flag

entityInstance_Id:
  loadFromEntity: true         # Boolean flag (actual entity is auto-detected)
```

### Problem 2: Scattered Loading Logic

The frontend must check multiple properties to determine data source:
```typescript
// frontEndFormatterService.tsx:452
if (metadata.datalabelKey || metadata.loadFromDataLabels) {
  // Load from datalabel store
}

// Backend dynamically sets:
// - loadFromEntity: 'employee'
// - endpoint: '/api/v1/entity/employee/entity-instance-lookup'
```

### Problem 3: No "None" Option

Free-flow input fields (e.g., custom text dropdowns) have no explicit marker—they're inferred by absence of the above flags.

---

## Proposed Solution: Unified `lookupSource`

### New Property Structure

```yaml
lookupSource:
  type: datalabel | entityInstance | static | none
  key?: string           # For datalabel: the dl__* key
  entity?: string        # For entityInstance: the entity code
  endpoint?: string      # Override default endpoint
  displayField?: string  # Field to display (default: name)
  valueField?: string    # Field for value (default: id)
```

### Field Type Mappings

| Field Pattern | lookupSource.type | Additional Properties |
|---------------|-------------------|----------------------|
| `dl__*` | `datalabel` | `key: <field_name>` |
| `*__entity_id` | `entityInstance` | `entity: <auto-detected>` |
| `*_id` | `entityInstance` | `entity: <auto-detected>` |
| static dropdowns | `static` | options in `format.options` |
| free text | `none` | — |

---

## Implementation Plan

### Phase 1: YAML Schema Changes

#### 1.1 Edit-Type-Mapping.yaml Changes

**Before:**
```yaml
datalabel:
  dtype: str
  <<: *editable
  loadFromDataLabels: true
  entityDataTable: { inputType: select, component: DatalabelSelect }
  entityFormContainer: { inputType: select, component: DatalabelSelect, format: { showColor: true, searchable: true } }
  kanbanView: { inputType: select, component: InlineSelect }
  dagView: { inputType: select, component: DAGNodeSelect }
```

**After:**
```yaml
datalabel:
  dtype: str
  <<: *editable
  lookupSource:
    type: datalabel
    # key is set dynamically from field name (e.g., dl__project_stage)
  entityDataTable: { inputType: select, component: DatalabelSelect }
  entityFormContainer: { inputType: dag_select, component: DatalabelDAGSelect -- use the actual component here, format: { showColor: true, searchable: true, showHierarchy: true } }
  kanbanView: { inputType: select, component: InlineSelect }
  dagView: { inputType: select, component: DAGNodeSelect }
```

**Before:**
```yaml
entityInstance_Id:
  dtype: uuid
  <<: *editable
  loadFromEntity: true
  entityDataTable: { inputType: entity_select, component: EntitySelect }
  entityFormContainer: { inputType: entity_select, component: EntitySelect, format: { searchable: true, clearable: true, displayField: name } }
  kanbanView: { inputType: entity_select, component: InlineEntitySelect }
```

**After:**
```yaml
entityInstance_Id:
  dtype: uuid
  <<: *editable
  lookupSource:
    type: entityInstance
    # entity is set dynamically from field name (e.g., manager__employee_id → employee)
    displayField: name
    valueField: id
  entityDataTable: { inputType: entity_select, component: EntitySelect }
  entityFormContainer: { inputType: entity_select, component: EntitySelect, format: { searchable: true, clearable: true } }
  kanbanView: { inputType: entity_select, component: InlineEntitySelect }
```

**New: Static Options Type**
```yaml
static_select:
  dtype: str
  <<: *editable
  lookupSource:
    type: static
    # options defined in format.options per component
  entityDataTable: { inputType: select, component: StaticSelect }
  entityFormContainer: { inputType: select, component: StaticSelect }
```

**New: Free-flow (None) Type**
```yaml
text_select:
  dtype: str
  <<: *editable
  lookupSource:
    type: none
  entityDataTable: { inputType: text, component: TextInput }
  entityFormContainer: { inputType: combobox, component: ComboboxInput, format: { allowCustom: true } }
```

#### 1.2 View-Type-Mapping.yaml Changes

Add `lookupSource` to view configurations for consistency:

```yaml
datalabel:
  dtype: str
  lookupSource:
    type: datalabel
  entityDataTable: { <<: *table_default, component: BadgeCell, width: "140px", format: { colorFromData: true } }
  entityFormContainer: { <<: *form_default, component: DatalabelDAG, , format: { showHierarchy: true } }
  kanbanView: { visible: true, component: Badge }
  gridView: { visible: true, component: Badge }
  calendarView: { visible: true, component: EventBadge }
  dagView: { visible: true, component: DAGNode }

entityInstance_Id:
  dtype: uuid
  lookupSource:
    type: entityInstance
    displayField: name
  entityDataTable: { <<: *table_default, component: EntityLookupCell, width: "150px", format: { linkToEntity: true } }
  entityFormContainer: { <<: *form_default, component: EntityLookupField }
  kanbanView: { visible: true, component: EntityBadge }
  gridView: { visible: true, component: EntityLink }
```

---

### Phase 2: Backend Formatter Service Changes

#### 2.1 Type Definitions Update

**File:** `apps/api/src/services/backend-formatter.service.ts`

```typescript
// NEW: Unified lookup source type
export interface LookupSource {
  type: 'datalabel' | 'entityInstance' | 'static' | 'none';
  key?: string;           // For datalabel: the dl__* key
  entity?: string;        // For entityInstance: the entity code
  endpoint?: string;      // API endpoint for options
  displayField?: string;  // Field to display (default: name)
  valueField?: string;    // Field for value (default: id)
}

export interface FieldMetadataBase {
  dtype: string;
  format: string;
  // ... existing fields ...

  // DEPRECATED (keep for backward compat, remove in v9)
  loadFromEntity?: string;
  loadFromDataLabels?: boolean;

  // NEW: Unified lookup source
  lookupSource?: LookupSource;

  // Moved to lookupSource
  // endpoint?: string;      → lookupSource.endpoint
  // displayField?: string;  → lookupSource.displayField
  // valueField?: string;    → lookupSource.valueField
  // datalabelKey?: string;  → lookupSource.key
}
```

#### 2.2 YAML Type Updates

```typescript
interface EditTypeMapping {
  dtype: string;
  inherit?: string;
  editable?: boolean;

  // DEPRECATED
  loadFromDataLabels?: boolean;
  loadFromEntity?: boolean;

  // NEW
  lookupSource?: {
    type: 'datalabel' | 'entityInstance' | 'static' | 'none';
    displayField?: string;
    valueField?: string;
  };

  entityDataTable?: Record<string, any>;
  entityFormContainer?: Record<string, any>;
  kanbanView?: Record<string, any>;
  dagView?: Record<string, any>;
}
```

#### 2.3 Metadata Generation Logic

**Update `generateFieldMetadataForComponent()`:**

```typescript
function generateFieldMetadataForComponent(
  fieldName: string,
  component: ComponentName,
  yamlMappings: YamlMappings,
  explicitConfig?: FieldConfig
): FieldMetadataBase {
  // ... existing pattern detection ...

  // Build lookupSource from YAML config
  const lookupSource = buildLookupSource(fieldName, resolved, yamlMetadata);

  if (lookupSource) {
    yamlMetadata.lookupSource = lookupSource;

    // BACKWARD COMPAT: Also set deprecated fields
    if (lookupSource.type === 'datalabel') {
      yamlMetadata.loadFromDataLabels = true;
      yamlMetadata.datalabelKey = lookupSource.key;
    } else if (lookupSource.type === 'entityInstance') {
      yamlMetadata.loadFromEntity = lookupSource.entity;
      yamlMetadata.endpoint = lookupSource.endpoint;
      yamlMetadata.displayField = lookupSource.displayField;
      yamlMetadata.valueField = lookupSource.valueField;
    }
  }

  return yamlMetadata;
}

function buildLookupSource(
  fieldName: string,
  resolved: EditTypeMapping,
  yamlMetadata: FieldMetadataBase
): LookupSource | null {
  // Priority 1: Explicit lookupSource in YAML
  if (resolved.lookupSource) {
    const ls = { ...resolved.lookupSource };

    // Auto-fill key for datalabel
    if (ls.type === 'datalabel' && !ls.key && fieldName.startsWith('dl__')) {
      ls.key = fieldName;
    }

    // Auto-detect entity for entityInstance
    if (ls.type === 'entityInstance' && !ls.entity) {
      ls.entity = detectEntityFromFieldName(fieldName);
      ls.endpoint = `/api/v1/entity/${ls.entity}/entity-instance-lookup`;
      ls.displayField = ls.displayField || 'name';
      ls.valueField = ls.valueField || 'id';
    }

    return ls;
  }

  // Priority 2: Legacy loadFromDataLabels
  if (resolved.loadFromDataLabels) {
    return {
      type: 'datalabel',
      key: fieldName
    };
  }

  // Priority 3: Legacy loadFromEntity
  if (resolved.loadFromEntity) {
    const entity = detectEntityFromFieldName(fieldName);
    return {
      type: 'entityInstance',
      entity,
      endpoint: `/api/v1/entity/${entity}/entity-instance-lookup`,
      displayField: 'name',
      valueField: 'id'
    };
  }

  // Priority 4: Pattern-based auto-detection
  if (fieldName.startsWith('dl__')) {
    return { type: 'datalabel', key: fieldName };
  }

  if (fieldName.match(/__[a-z]+_id$/) || fieldName.match(/_id$/)) {
    const entity = detectEntityFromFieldName(fieldName);
    if (entity) {
      return {
        type: 'entityInstance',
        entity,
        endpoint: `/api/v1/entity/${entity}/entity-instance-lookup`,
        displayField: 'name',
        valueField: 'id'
      };
    }
  }

  return null;
}
```

---

### Phase 3: Frontend Changes

#### 3.1 Type Definitions

**File:** `apps/web/src/lib/formatters/types.ts`

```typescript
export interface LookupSource {
  type: 'datalabel' | 'entityInstance' | 'static' | 'none';
  key?: string;
  entity?: string;
  endpoint?: string;
  displayField?: string;
  valueField?: string;
}

export interface FieldMetadata {
  // ... existing ...

  // DEPRECATED
  loadFromEntity?: string;
  loadFromDataLabels?: boolean;
  datalabelKey?: string;

  // NEW
  lookupSource?: LookupSource;
}
```

#### 3.2 Frontend Formatter Service

**File:** `apps/web/src/lib/frontEndFormatterService.tsx`

```typescript
// Helper to check lookup source (handles both new and legacy)
function getLookupSource(metadata: FieldMetadata): LookupSource | null {
  // Prefer new lookupSource
  if (metadata.lookupSource) {
    return metadata.lookupSource;
  }

  // Legacy fallback: datalabel
  if (metadata.loadFromDataLabels || metadata.datalabelKey) {
    return {
      type: 'datalabel',
      key: metadata.datalabelKey || metadata.key
    };
  }

  // Legacy fallback: entityInstance
  if (metadata.loadFromEntity) {
    return {
      type: 'entityInstance',
      entity: metadata.loadFromEntity,
      endpoint: metadata.endpoint,
      displayField: metadata.displayField || 'name',
      valueField: metadata.valueField || 'id'
    };
  }

  return null;
}

// Update edit mode rendering
function renderEditModeFromMetadata(...) {
  const lookupSource = getLookupSource(metadata);

  if (metadata.editType === 'select') {
    if (lookupSource?.type === 'datalabel') {
      return renderDatalabelSelect(value, metadata, lookupSource, onChange);
    }

    if (lookupSource?.type === 'entityInstance') {
      return renderEntitySelect(value, metadata, lookupSource, onChange);
    }

    if (lookupSource?.type === 'static') {
      return renderStaticSelect(value, metadata, onChange);
    }

    // lookupSource.type === 'none' or no lookupSource
    return renderFreeTextSelect(value, metadata, onChange);
  }
}
```

#### 3.3 Component Updates

Components should read from `lookupSource` instead of scattered properties:

```typescript
// EntitySelect.tsx
interface EntitySelectProps {
  lookupSource: LookupSource;
  value: string | null;
  onChange: (value: string | null) => void;
}

function EntitySelect({ lookupSource, value, onChange }: EntitySelectProps) {
  const { data: options } = useQuery({
    queryKey: ['entity-options', lookupSource.entity],
    queryFn: () => api.get(lookupSource.endpoint!),
    enabled: lookupSource.type === 'entityInstance' && !!lookupSource.endpoint
  });

  return (
    <Select
      options={options?.map(o => ({
        value: o[lookupSource.valueField || 'id'],
        label: o[lookupSource.displayField || 'name']
      }))}
      value={value}
      onChange={onChange}
    />
  );
}
```

---

### Phase 4: Store Updates

#### 4.1 Entity Component Metadata Store

**File:** `apps/web/src/stores/entityComponentMetadataStore.ts`

```typescript
export interface FieldMetadata {
  // Add lookupSource type
  lookupSource?: {
    type: 'datalabel' | 'entityInstance' | 'static' | 'none';
    key?: string;
    entity?: string;
    endpoint?: string;
    displayField?: string;
    valueField?: string;
  };

  // Keep deprecated for backward compat
  loadFromEntity?: string;
  datalabelKey?: string;
}
```

---

### Phase 5: Documentation Updates

#### Files to Update:
1. `docs/services/backend-formatter.service.md` - Add lookupSource documentation
2. `docs/architecture/UNIFIED_API_RESPONSE_FORMAT.md` - Update field metadata examples
3. `docs/ui_components_layout/datalabels.md` - Update with new pattern
4. `CLAUDE.md` - Add lookupSource to field metadata section

---

## Migration Strategy

### Step 1: Add New Property (Non-Breaking)
- Add `lookupSource` property alongside existing flags
- Backend outputs BOTH new and deprecated properties
- Frontend checks `lookupSource` first, falls back to legacy

### Step 2: Update YAML Files
- Modify `edit-type-mapping.yaml` and `view-type-mapping.yaml`
- Add `lookupSource` configurations
- Keep `loadFromDataLabels` and `loadFromEntity` temporarily

### Step 3: Update Backend Service
- Implement `buildLookupSource()` function
- Generate both new and legacy metadata
- Test all entity endpoints

### Step 4: Update Frontend
- Add `getLookupSource()` helper
- Update `frontEndFormatterService.tsx`
- Update components to use `lookupSource`

### Step 5: Remove Deprecated Properties (v9.0)
- Remove `loadFromDataLabels`, `loadFromEntity` from YAML
- Remove legacy fallbacks from backend
- Remove legacy checks from frontend

---

## Testing Checklist

- [ ] Datalabel fields (dl__project_stage) render correctly in table
- [ ] Datalabel fields show DAG selector in forms
- [ ] Entity reference fields (manager__employee_id) show entity select
- [ ] Simple reference fields (office_id) show entity select
- [ ] Multi-select entity fields work (stakeholder__employee_ids)
- [ ] Static dropdown fields work
- [ ] Free-text combobox fields work
- [ ] Kanban view badges render correctly
- [ ] Calendar view events render correctly
- [ ] All existing API responses maintain backward compatibility

---

## Files to Modify

### Backend (apps/api)
1. `src/services/backend-formatter.service.ts` - Core changes
2. `src/services/edit-type-mapping.yaml` - Add lookupSource
3. `src/services/view-type-mapping.yaml` - Add lookupSource
4. `src/config/entity-field-config.ts` - Update types

### Frontend (apps/web)
1. `src/lib/formatters/types.ts` - Add LookupSource type
2. `src/lib/frontEndFormatterService.tsx` - Update rendering logic
3. `src/stores/entityComponentMetadataStore.ts` - Update types
4. `src/lib/api-factory.ts` - Update types

### Documentation (docs)
1. `services/backend-formatter.service.md`
2. `architecture/UNIFIED_API_RESPONSE_FORMAT.md`
3. `ui_components_layout/datalabels.md`
4. `CLAUDE.md`

---

## Version Notes

- **v8.1.0**: Add `lookupSource` property (backward compatible)
- **v9.0.0**: Remove deprecated `loadFromDataLabels`, `loadFromEntity`
