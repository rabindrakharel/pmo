# Editable Entity References - Solution Plan

**Version**: 1.0.0
**Date**: 2025-01-18
**Status**: 📋 Proposed Solution

## Problem Statement

Currently, entity reference fields in EntityFormContainer show resolved human-readable names but are **not editable**:

```typescript
// Data received from API (after resolution):
{
  id: "uuid",
  name: "Kitchen Renovation",

  // Hidden UUID fields (not in form)
  manager__employee_id: "aaaaa-uuid",
  stakeholder__employee_ids: ["bbbbb-uuid", "ccccc-uuid"],

  // Visible resolved fields (read-only)
  manager: "James Miller",              // ❌ Not editable
  stakeholder: [                         // ❌ Not editable
    { stakeholder__employee_id: "bbbbb-uuid", stakeholder: "Michael Chen" },
    { stakeholder__employee_id: "ccccc-uuid", stakeholder: "Emily Brown" }
  ]
}
```

**Goal**: Make `manager` and `stakeholder` fields editable with dropdowns/multi-selects, while submitting the underlying UUID values (`manager__employee_id`, `stakeholder__employee_ids`) to the API.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CURRENT DATA FLOW (READ-ONLY)                     │
│                                                                      │
│  API → EntityFormContainer → Display resolved names (read-only)     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                   PROPOSED DATA FLOW (EDITABLE)                      │
│                                                                      │
│  API → EntityFormContainer                                          │
│         ↓                                                            │
│     Detect entity reference fields                                  │
│         ↓                                                            │
│     Fetch options from /api/v1/entity/{entityCode}/entity-instance-lookup                │
│         ↓                                                            │
│     Render Select/MultiSelect                                       │
│         ↓                                                            │
│     User changes selection                                          │
│         ↓                                                            │
│     Update both label field (display) AND UUID field (hidden)       │
│         ↓                                                            │
│     On submit: Send only UUID fields (_id, _ids)                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Existing Infrastructure (Available Today)

### ✅ Backend APIs

| Endpoint | Purpose | Returns |
|----------|---------|---------|
| `GET /api/v1/entity/{entityCode}/entity-instance-lookup` | Get all options for entity type | `[{ id: "uuid", name: "..." }, ...]` |
| `POST /api/v1/entity/{entityCode}/entity-instance-lookup/bulk` | Bulk lookup by IDs | `[{ id: "uuid", name: "..." }, ...]` |
| `resolve_entity_references()` | Server-side UUID→name resolution | Enriched data with both UUIDs and names |

### ✅ Frontend Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `entityOptionsApi.getOptions()` | `apps/web/src/lib/api.ts:950` | Fetch entity options |
| `SearchableMultiSelect` | `apps/web/src/components/shared/ui/` | Multi-select dropdown |
| `loadFieldOptions()` | `apps/web/src/lib/settingsLoader.ts` | Load settings options |
| `detectField()` | `apps/web/src/lib/universalFormatterService.ts` | Auto-detect field types |

### ✅ Naming Convention

| Pattern | Example | Detected |
|---------|---------|----------|
| `{label}__{entity}_id` | `manager__employee_id` | ✅ |
| `{label}__{entity}_ids` | `stakeholder__employee_ids` | ✅ |
| Resolved label | `manager`, `stakeholder` | ✅ (by reverse lookup) |

---

## Solution Design

### Phase 1: Field Pairing Detection

**Goal**: Automatically detect which visible fields correspond to hidden UUID fields

```typescript
// NEW: Entity Reference Field Detector
// Location: apps/web/src/lib/entityReferenceDetector.ts

export interface EntityReferenceField {
  labelField: string;         // 'manager'
  uuidField: string;          // 'manager__employee_id'
  entityType: string;         // 'employee'
  multiple: boolean;          // false
  currentUuids: string | string[];  // Current UUID value(s)
  currentLabels: string | any[];    // Current label value(s)
}

export function detectEntityReferenceFields(
  data: Record<string, any>,
  allFieldKeys: string[]
): EntityReferenceField[] {
  const referenceFields: EntityReferenceField[] = [];

  // Pattern 1: Single reference (manager + manager__employee_id)
  for (const labelKey of Object.keys(data)) {
    // Look for corresponding UUID field
    const uuidField = allFieldKeys.find(key => {
      // Match: {labelKey}__[entity]_id
      const regex = new RegExp(`^${labelKey}__([a-z_]+)_id$`);
      return regex.test(key);
    });

    if (uuidField && data[uuidField]) {
      const match = uuidField.match(/__([a-z_]+)_id$/);
      const entityType = match![1];

      referenceFields.push({
        labelField: labelKey,
        uuidField: uuidField,
        entityType: entityType,
        multiple: false,
        currentUuids: data[uuidField],
        currentLabels: data[labelKey]
      });
    }
  }

  // Pattern 2: Array reference (stakeholder + stakeholder__employee_ids)
  for (const labelKey of Object.keys(data)) {
    const uuidField = allFieldKeys.find(key => {
      const regex = new RegExp(`^${labelKey}__([a-z_]+)_ids$`);
      return regex.test(key);
    });

    if (uuidField && Array.isArray(data[uuidField]) && Array.isArray(data[labelKey])) {
      const match = uuidField.match(/__([a-z_]+)_ids$/);
      const entityType = match![1];

      referenceFields.push({
        labelField: labelKey,
        uuidField: uuidField,
        entityType: entityType,
        multiple: true,
        currentUuids: data[uuidField],
        currentLabels: data[labelKey]
      });
    }
  }

  return referenceFields;
}
```

**Usage in EntityFormContainer**:
```typescript
const referenceFields = useMemo(() => {
  const allKeys = [...Object.keys(data), ...fields.map(f => f.key)];
  return detectEntityReferenceFields(data, allKeys);
}, [data, fields]);
```

---

### Phase 2: Options Loading

**Goal**: Fetch available options for each entity reference field

```typescript
// NEW: Entity Reference Options Hook
// Location: apps/web/src/hooks/useEntityReferenceOptions.ts

import { useState, useEffect } from 'react';
import { entityOptionsApi } from '../lib/api';

export interface EntityOption {
  id: string;
  label: string;
}

export function useEntityReferenceOptions(
  entityType: string,
  enabled: boolean = true
): {
  options: EntityOption[];
  loading: boolean;
  error: Error | null;
} {
  const [options, setOptions] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const loadOptions = async () => {
      setLoading(true);
      try {
        // Call existing API: GET /api/v1/entity/{entityCode}/entity-instance-lookup
        const response = await entityOptionsApi.getOptions(entityType, {
          limit: 1000,
          active_only: true
        });

        // Transform response to { id, label } format
        const transformed = response.map((item: any) => ({
          id: item.id,
          label: item.name || item.label || item.code || item.id
        }));

        setOptions(transformed);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadOptions();
  }, [entityType, enabled]);

  return { options, loading, error };
}
```

**Usage in EntityFormContainer**:
```typescript
// Load options for all detected reference fields
const entityOptionsCache = useMemo(() => {
  const cache: Record<string, EntityOption[]> = {};

  referenceFields.forEach(field => {
    const { options } = useEntityReferenceOptions(field.entityType);
    cache[field.entityType] = options;
  });

  return cache;
}, [referenceFields]);
```

---

### Phase 3: Rendering Editable Inputs

**Goal**: Render appropriate input component based on field type

```typescript
// NEW: Entity Reference Field Renderer
// Location: apps/web/src/components/shared/entity/EntityReferenceField.tsx

import React from 'react';
import { SearchableMultiSelect } from '../ui/SearchableMultiSelect';
import type { EntityOption } from '../../../hooks/useEntityReferenceOptions';

interface EntityReferenceFieldProps {
  field: EntityReferenceField;
  options: EntityOption[];
  value: string | string[];  // Current UUID value(s)
  onChange: (newValue: string | string[]) => void;
  disabled?: boolean;
}

export const EntityReferenceField: React.FC<EntityReferenceFieldProps> = ({
  field,
  options,
  value,
  onChange,
  disabled = false
}) => {
  if (field.multiple) {
    // Render multi-select for array fields
    return (
      <SearchableMultiSelect
        options={options}
        value={Array.isArray(value) ? value : []}
        onChange={(newUuids: string[]) => {
          onChange(newUuids);
        }}
        placeholder={`Select ${field.labelField}...`}
        disabled={disabled}
      />
    );
  } else {
    // Render single select for single fields
    return (
      <select
        value={value as string || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-md"
      >
        <option value="">Select {field.labelField}...</option>
        {options.map(option => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
};
```

**Integration in EntityFormContainer**:
```typescript
// In the field rendering loop (around line 671)
{visibleFields.map((field, index) => {
  // Check if this is an entity reference field
  const referenceField = referenceFields.find(
    rf => rf.labelField === field.key
  );

  if (referenceField) {
    // Render entity reference input
    const options = entityOptionsCache[referenceField.entityType] || [];

    return (
      <div key={field.key} className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {field.title || field.key}
        </label>
        <EntityReferenceField
          field={referenceField}
          options={options}
          value={data[referenceField.uuidField]}  // Use UUID value
          onChange={(newValue) => {
            // Update BOTH the UUID field and the label field
            handleEntityReferenceChange(referenceField, newValue, options);
          }}
          disabled={!isEditing}
        />
      </div>
    );
  }

  // ... existing field rendering logic
})}
```

---

### Phase 4: State Management

**Goal**: Maintain sync between UUID fields and label fields

```typescript
// In EntityFormContainer

const handleEntityReferenceChange = (
  referenceField: EntityReferenceField,
  newUuids: string | string[],
  options: EntityOption[]
) => {
  if (referenceField.multiple && Array.isArray(newUuids)) {
    // Array field: Update both _ids field and label field
    onChange(referenceField.uuidField, newUuids);

    // Resolve UUIDs to labels for display
    const resolvedLabels = newUuids.map(uuid => {
      const option = options.find(opt => opt.id === uuid);
      return {
        [referenceField.uuidField.replace('_ids', '_id')]: uuid,
        [referenceField.labelField]: option?.label || 'Unknown'
      };
    });

    onChange(referenceField.labelField, resolvedLabels);

  } else if (!referenceField.multiple && typeof newUuids === 'string') {
    // Single field: Update both _id field and label field
    onChange(referenceField.uuidField, newUuids);

    const option = options.find(opt => opt.id === newUuids);
    onChange(referenceField.labelField, option?.label || 'Unknown');
  }
};
```

---

### Phase 5: Form Submission

**Goal**: Submit only UUID fields, exclude resolved label fields

```typescript
// In EntityDetailPage or EntityCreatePage (parent component)

const handleSubmit = async (formData: Record<string, any>) => {
  // Filter: Keep UUID fields (_id, _ids), remove label fields
  const dataToSubmit = Object.entries(formData).reduce((acc, [key, value]) => {
    // Include UUID reference fields
    if (key.endsWith('_id') || key.endsWith('_ids')) {
      acc[key] = value;
      return acc;
    }

    // Exclude resolved label fields if they have a corresponding UUID field
    const hasUuidField = Object.keys(formData).some(k =>
      k === `${key}__employee_id` ||
      k === `${key}__employee_ids` ||
      k.match(new RegExp(`^${key}__[a-z_]+_ids?$`))
    );

    if (!hasUuidField) {
      // No corresponding UUID field, include as-is
      acc[key] = value;
    }
    // else: Skip this field (it's a resolved label)

    return acc;
  }, {} as Record<string, any>);

  // Submit to API
  await api.patch(`/api/v1/project/${id}`, dataToSubmit);
};
```

---

## Implementation Checklist

### Backend (No Changes Needed!)

- [x] `GET /api/v1/entity/{entityCode}/entity-instance-lookup` - Already exists
- [x] `POST /api/v1/entity/{entityCode}/entity-instance-lookup/bulk` - Already exists
- [x] `resolve_entity_references()` - Already exists
- [x] API accepts UUID fields in POST/PATCH - Already works

### Frontend (New Code Required)

- [ ] **1. Create Entity Reference Detector**
  - File: `apps/web/src/lib/entityReferenceDetector.ts`
  - Function: `detectEntityReferenceFields()`
  - Pattern matching for field pairing

- [ ] **2. Create Options Loading Hook**
  - File: `apps/web/src/hooks/useEntityReferenceOptions.ts`
  - Hook: `useEntityReferenceOptions(entityType)`
  - Caching and error handling

- [ ] **3. Create Reference Field Component**
  - File: `apps/web/src/components/shared/entity/EntityReferenceField.tsx`
  - Component: `EntityReferenceField`
  - Single select + multi-select support

- [ ] **4. Update EntityFormContainer**
  - File: `apps/web/src/components/shared/entity/EntityFormContainer.tsx`
  - Integrate detector (line ~100)
  - Load options (line ~200)
  - Render inputs (line ~671)
  - Handle changes (new handler)

- [ ] **5. Update Form Submission Logic**
  - Files: EntityDetailPage, EntityCreatePage
  - Filter submitted data to exclude label fields
  - Keep only UUID fields

- [ ] **6. Add TypeScript Types**
  - File: `apps/web/src/types/entityReference.ts`
  - Export all interfaces

---

## Data Flow Example

### Initial Load

```typescript
// 1. API returns enriched data
{
  id: "project-uuid",
  name: "Kitchen Renovation",
  manager__employee_id: "emp-123",
  manager: "James Miller",
  stakeholder__employee_ids: ["emp-456", "emp-789"],
  stakeholder: [
    { stakeholder__employee_id: "emp-456", stakeholder: "Michael Chen" },
    { stakeholder__employee_id: "emp-789", stakeholder: "Emily Brown" }
  ]
}

// 2. Detector identifies reference fields
referenceFields = [
  {
    labelField: "manager",
    uuidField: "manager__employee_id",
    entityType: "employee",
    multiple: false,
    currentUuids: "emp-123",
    currentLabels: "James Miller"
  },
  {
    labelField: "stakeholder",
    uuidField: "stakeholder__employee_ids",
    entityType: "employee",
    multiple: true,
    currentUuids: ["emp-456", "emp-789"],
    currentLabels: [...]
  }
]

// 3. Load options
options['employee'] = await entityOptionsApi.getOptions('employee');
// Returns: [
//   { id: "emp-123", name: "James Miller" },
//   { id: "emp-456", name: "Michael Chen" },
//   { id: "emp-789", name: "Emily Brown" },
//   { id: "emp-999", name: "Sarah Johnson" }
// ]

// 4. Render select inputs
<select value="emp-123">
  <option value="emp-123">James Miller</option>
  <option value="emp-456">Michael Chen</option>
  <option value="emp-789">Emily Brown</option>
  <option value="emp-999">Sarah Johnson</option>
</select>
```

### User Changes Manager

```typescript
// 1. User selects "Sarah Johnson" from dropdown
onChange("manager__employee_id", "emp-999");

// 2. Handler updates both fields
formData = {
  ...formData,
  manager__employee_id: "emp-999",  // UUID updated
  manager: "Sarah Johnson"           // Label updated
}

// 3. UI re-renders with new selection
<select value="emp-999">  {/* Now shows Sarah Johnson */}
```

### Form Submission

```typescript
// 1. User clicks "Save"
// 2. Filter function removes label fields
dataToSubmit = {
  id: "project-uuid",
  name: "Kitchen Renovation",
  manager__employee_id: "emp-999",           // ✅ Sent
  stakeholder__employee_ids: ["emp-456"]     // ✅ Sent
  // manager: "Sarah Johnson"                // ❌ Filtered out
  // stakeholder: [...]                      // ❌ Filtered out
}

// 3. API receives only UUID fields
PATCH /api/v1/project/project-uuid
{
  manager__employee_id: "emp-999",
  stakeholder__employee_ids: ["emp-456"]
}

// 4. API updates database with UUIDs
// 5. API returns enriched data with new resolved names
// 6. UI updates to show "Sarah Johnson"
```

---

## Performance Considerations

### Options Caching

```typescript
// Cache options per entity type (not per field)
const optionsCache = {
  'employee': [...],  // Loaded once, shared by manager + stakeholder
  'project': [...],
  'client': [...]
};
```

### Lazy Loading

```typescript
// Only load options when field becomes editable
const { options } = useEntityReferenceOptions(
  entityType,
  enabled: isEditing  // Don't load in read-only mode
);
```

### Search/Filter

```typescript
// For large option sets (>100 items), add search
<SearchableMultiSelect
  options={options}
  searchable={options.length > 100}
  onSearch={(query) => {
    // Optional: Server-side search
    entityOptionsApi.getOptions(entityType, { search: query });
  }}
/>
```

---

## Edge Cases & Error Handling

### Missing Options

```typescript
// If entity instance not in entity_instance table
{
  currentUuids: "unknown-uuid",
  currentLabels: "Unknown"  // Fallback
}

// Show warning in UI
if (!options.find(opt => opt.id === currentUuid)) {
  return (
    <div className="text-yellow-600">
      ⚠️ Current value not found in available options
    </div>
  );
}
```

### Null/Empty Values

```typescript
// Allow clearing selection
<select value={value || ''}>
  <option value="">None</option>
  {options.map(...)}
</select>
```

### Permission Checks

```typescript
// Disable editing if user lacks permission
<EntityReferenceField
  disabled={!canEdit || !isEditing}
  field={referenceField}
/>
```

---

## Alternative Approaches Considered

### ❌ Approach 1: Manual Config

```typescript
// Requires manual configuration for each field
{
  key: 'manager',
  type: 'entity-reference',
  entityType: 'employee',
  referenceField: 'manager__employee_id'
}
```

**Rejected**: Violates zero-config principle

### ❌ Approach 2: GraphQL-style Field Selection

```typescript
// Client specifies which fields to resolve
GET /api/v1/project/123?resolve=manager,stakeholder
```

**Rejected**: Adds complexity to API, breaks existing pattern

### ✅ Approach 3: Auto-Detection (Selected)

- Automatic field pairing via naming convention
- Zero frontend configuration
- Uses existing infrastructure
- Backward compatible

---

## Testing Strategy

### Unit Tests

```typescript
describe('detectEntityReferenceFields', () => {
  it('detects single reference field', () => {
    const data = {
      manager__employee_id: "uuid",
      manager: "Name"
    };
    const fields = detectEntityReferenceFields(data, Object.keys(data));
    expect(fields).toHaveLength(1);
    expect(fields[0].entityType).toBe('employee');
  });

  it('detects array reference field', () => {
    const data = {
      stakeholder__employee_ids: ["uuid1", "uuid2"],
      stakeholder: [...]
    };
    const fields = detectEntityReferenceFields(data, Object.keys(data));
    expect(fields[0].multiple).toBe(true);
  });
});
```

### Integration Tests

```typescript
describe('EntityFormContainer with entity references', () => {
  it('renders select for single reference', async () => {
    render(<EntityFormContainer data={projectData} isEditing={true} />);

    const select = screen.getByLabelText(/manager/i);
    expect(select.tagName).toBe('SELECT');
    expect(select).toHaveValue('emp-123');
  });

  it('updates UUID field when selection changes', async () => {
    const onChange = jest.fn();
    render(<EntityFormContainer onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/manager/i), {
      target: { value: 'emp-999' }
    });

    expect(onChange).toHaveBeenCalledWith('manager__employee_id', 'emp-999');
  });
});
```

---

## Migration Path

### Phase 1: Backend Ready ✅ (Already Complete)
- Entity options API exists
- Resolution service works
- No backend changes needed

### Phase 2: Create Helper Libraries (Week 1)
- [ ] Entity reference detector
- [ ] Options loading hook
- [ ] TypeScript types

### Phase 3: Create Components (Week 2)
- [ ] EntityReferenceField component
- [ ] Integration with EntityFormContainer

### Phase 4: Update Form Logic (Week 2)
- [ ] Submission filtering
- [ ] State management
- [ ] Error handling

### Phase 5: Testing & Rollout (Week 3)
- [ ] Unit tests
- [ ] Integration tests
- [ ] Documentation
- [ ] Gradual rollout

---

## Summary

**The solution leverages existing infrastructure**:
- ✅ Backend APIs already support this
- ✅ Naming convention enables auto-detection
- ✅ Zero backend changes needed
- ✅ Zero manual configuration needed

**Key Innovation**:
- Auto-detect field pairs via naming pattern
- Maintain both UUID (for submission) and label (for display)
- Render appropriate input automatically
- Filter label fields on submission

**Result**: Drop-in solution that makes entity reference fields editable with **zero configuration** - just follow the naming convention!
