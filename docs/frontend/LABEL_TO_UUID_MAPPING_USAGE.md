# Label to UUID Field Mapping - Usage Guide

**Version**: 1.0.0
**Date**: 2025-01-18
**Status**: ✅ Ready to Use

## Overview

Dynamically generate mapping from label fields to UUID fields:

```typescript
{
  "manager": "manager__employee_id",
  "sponsor": "sponsor__employee_id",
  "stakeholder": "stakeholder__employee_ids"
}
```

This enables:
- **Form updates**: Know which UUID field to update when user selects from dropdown
- **Reverse lookup**: Get UUID field from label field
- **Dynamic detection**: Identify which fields are entity references
- **Type awareness**: Know if field is single or array

---

## Quick Start

### Installation

Files created:
- ✅ `apps/web/src/lib/labelToUuidFieldMapper.ts` - Core mapping logic
- ✅ `apps/web/src/hooks/useLabelToUuidMapping.ts` - React hooks

### Basic Usage

```typescript
import { useLabelToUuidMapping } from '@/hooks/useLabelToUuidMapping';

const MyComponent = ({ data }) => {
  const { mapping, getUuidFieldName } = useLabelToUuidMapping(data);

  // Get UUID field for "manager" label
  const managerUuidField = getUuidFieldName('manager');
  // Returns: "manager__employee_id"

  console.log(mapping);
  // {
  //   "manager": {
  //     uuidField: "manager__employee_id",
  //     entityType: "employee",
  //     multiple: false
  //   },
  //   "stakeholder": {
  //     uuidField: "stakeholder__employee_ids",
  //     entityType: "employee",
  //     multiple: true
  //   }
  // }
};
```

---

## Complete Examples

### Example 1: EntityFormContainer Integration

```typescript
// apps/web/src/components/shared/entity/EntityFormContainer.tsx

import { useEntityReferenceForm } from '@/hooks/useLabelToUuidMapping';
import { entityOptionsApi } from '@/lib/api';
import { useState, useEffect } from 'react';

interface EntityFormContainerProps {
  data: Record<string, any>;
  isEditing: boolean;
  onChange: (field: string, value: any) => void;
}

export const EntityFormContainer: React.FC<EntityFormContainerProps> = ({
  data,
  isEditing,
  onChange
}) => {
  // Get mapping and helper functions
  const {
    mapping,
    handleLabelChange,
    getUuidValue,
    getEntityTypeName,
    isMultiple
  } = useEntityReferenceForm(data, onChange);

  // Load options for all entity reference fields
  const [options, setOptions] = useState<Record<string, Array<{ id: string; name: string }>>>({});

  useEffect(() => {
    // Get unique entity types from mapping
    const entityTypes = new Set(
      Object.values(mapping).map(info => info.entityType)
    );

    // Load options for each entity type
    entityTypes.forEach(async (entityType) => {
      const response = await entityOptionsApi.getOptions(entityType, { limit: 1000 });
      setOptions(prev => ({
        ...prev,
        [entityType]: response.map((item: any) => ({
          id: item.id,
          name: item.name
        }))
      }));
    });
  }, [mapping]);

  return (
    <div className="space-y-4">
      {/* Render entity reference fields */}
      {Object.keys(mapping).map(labelField => {
        const entityType = getEntityTypeName(labelField);
        const currentUuidValue = getUuidValue(labelField);
        const fieldOptions = options[entityType] || [];
        const multiple = isMultiple(labelField);

        if (multiple) {
          // Render multi-select for array fields
          return (
            <div key={labelField} className="mb-4">
              <label className="block text-sm font-medium mb-1">
                {labelField.charAt(0).toUpperCase() + labelField.slice(1)}
              </label>
              <SearchableMultiSelect
                options={fieldOptions}
                value={Array.isArray(currentUuidValue) ? currentUuidValue : []}
                onChange={(newUuids: string[]) => {
                  handleLabelChange(labelField, newUuids, fieldOptions);
                }}
                disabled={!isEditing}
              />
            </div>
          );
        } else {
          // Render single select
          return (
            <div key={labelField} className="mb-4">
              <label className="block text-sm font-medium mb-1">
                {labelField.charAt(0).toUpperCase() + labelField.slice(1)}
              </label>
              <select
                value={typeof currentUuidValue === 'string' ? currentUuidValue : ''}
                onChange={(e) => {
                  handleLabelChange(labelField, e.target.value, fieldOptions);
                }}
                disabled={!isEditing}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">Select {labelField}...</option>
                {fieldOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
          );
        }
      })}

      {/* Render other fields (non-entity-references) */}
      {/* ... */}
    </div>
  );
};
```

### Example 2: Form Submission Filter

```typescript
// apps/web/src/pages/entity/EntityDetailPage.tsx

import { useLabelToUuidMapping } from '@/hooks/useLabelToUuidMapping';

const EntityDetailPage = () => {
  const [formData, setFormData] = useState({});
  const { getAllLabelFields } = useLabelToUuidMapping(formData);

  const handleSubmit = async () => {
    const labelFields = getAllLabelFields();

    // Filter out label fields, keep only UUID fields
    const dataToSubmit = Object.entries(formData).reduce((acc, [key, value]) => {
      // Skip label fields (they're just for display)
      if (labelFields.includes(key)) {
        return acc;
      }

      // Include everything else (UUID fields, regular fields)
      acc[key] = value;
      return acc;
    }, {} as Record<string, any>);

    // Submit to API (only UUID fields sent)
    await api.patch(`/api/v1/project/${id}`, dataToSubmit);
  };

  return (
    <div>
      <EntityFormContainer
        data={formData}
        onChange={(key, value) => setFormData({ ...formData, [key]: value })}
        isEditing={true}
      />
      <button onClick={handleSubmit}>Save</button>
    </div>
  );
};
```

### Example 3: Dynamic Field Detection

```typescript
// Detect which fields in a form are entity references

import { useLabelToUuidMapping } from '@/hooks/useLabelToUuidMapping';

const FormGenerator = ({ data, fields }) => {
  const {
    isLabelField,
    isUuidField,
    getEntityTypeName
  } = useLabelToUuidMapping(data);

  return (
    <div>
      {fields.map(field => {
        if (isUuidField(field.key)) {
          // This is a UUID field - hide it
          return null;
        }

        if (isLabelField(field.key)) {
          // This is a label field for an entity reference - render dropdown
          const entityType = getEntityTypeName(field.key);
          return (
            <EntityReferenceInput
              key={field.key}
              label={field.key}
              entityType={entityType}
              {...field}
            />
          );
        }

        // Regular field - render normally
        return <RegularInput key={field.key} {...field} />;
      })}
    </div>
  );
};
```

### Example 4: Get Simple Mapping

```typescript
// Get just the mapping without metadata

import { createSimpleMapping } from '@/lib/labelToUuidFieldMapper';

const data = {
  manager__employee_id: "uuid",
  manager: "Name",
  stakeholder__employee_ids: ["uuid1", "uuid2"],
  stakeholder: [{...}, {...}]
};

const simpleMapping = createSimpleMapping(data);
// Returns:
// {
//   "manager": "manager__employee_id",
//   "stakeholder": "stakeholder__employee_ids"
// }

// Use for form updates
Object.entries(formChanges).forEach(([labelField, newValue]) => {
  const uuidField = simpleMapping[labelField];
  if (uuidField) {
    // This is an entity reference - update UUID field
    updateField(uuidField, newValue);
  } else {
    // Regular field - update as-is
    updateField(labelField, newValue);
  }
});
```

### Example 5: Validate Form Data

```typescript
// Ensure UUID fields are set when label fields are present

import { useLabelToUuidMapping } from '@/hooks/useLabelToUuidMapping';

const validateEntityReferences = (data: Record<string, any>) => {
  const { mapping } = useLabelToUuidMapping(data);
  const errors: string[] = [];

  Object.entries(mapping).forEach(([labelField, info]) => {
    const { uuidField } = info;

    // Check if label is set but UUID is missing
    if (data[labelField] && !data[uuidField]) {
      errors.push(`${labelField} is set but ${uuidField} is missing`);
    }

    // Check if UUID is set but label is missing
    if (data[uuidField] && !data[labelField]) {
      errors.push(`${uuidField} is set but ${labelField} is missing`);
    }
  });

  return errors;
};
```

---

## API Reference

### `useLabelToUuidMapping(data, allFieldKeys?)`

Returns mapping and helper functions.

**Parameters**:
- `data: Record<string, any>` - The data object
- `allFieldKeys?: string[]` - Optional array of all field keys

**Returns**:
```typescript
{
  mapping: LabelToUuidMapping;           // Full mapping with metadata
  simpleMapping: Record<string, string>; // Just label → uuidField
  getUuidFieldName: (label: string) => string | undefined;
  getEntityTypeName: (label: string) => string | undefined;
  isMultiple: (label: string) => boolean;
  getAllLabelFields: () => string[];
  getAllUuidFields: () => string[];
  isLabelField: (fieldName: string) => boolean;
  isUuidField: (fieldName: string) => boolean;
}
```

### `useEntityReferenceForm(data, onChange)`

Returns form-specific helpers.

**Parameters**:
- `data: Record<string, any>` - The form data
- `onChange: (field: string, value: any) => void` - Change handler

**Returns**:
```typescript
{
  mapping: LabelToUuidMapping;
  handleLabelChange: (label: string, newUuid: string | string[], options: Array<{id, name}>) => void;
  getUuidValue: (label: string) => string | string[] | undefined;
  getLabelValue: (label: string) => any;
  getUuidFieldName: (label: string) => string | undefined;
  getEntityTypeName: (label: string) => string | undefined;
  isMultiple: (label: string) => boolean;
}
```

### `generateLabelToUuidMapping(data, allFieldKeys?)`

Low-level function to generate mapping.

**Parameters**:
- `data: Record<string, any>` - The data object
- `allFieldKeys?: string[]` - Optional array of all field keys

**Returns**: `LabelToUuidMapping`

### `createSimpleMapping(data)`

Generate simple label → uuid field mapping.

**Parameters**:
- `data: Record<string, any>` - The data object

**Returns**: `Record<string, string>`

---

## Pattern Detection

The mapper detects 4 patterns:

| Pattern | Example UUID Field | Example Label Field | Detected |
|---------|-------------------|---------------------|----------|
| Labeled single | `manager__employee_id` | `manager` | ✅ |
| Labeled array | `stakeholder__employee_ids` | `stakeholder` | ✅ |
| Simple single | `project_id` | `project` | ✅ |
| Simple array | `attachment_ids` | `attachment` | ✅ |

**Requirements**:
- UUID field must end with `_id` or `_ids`
- Label field must exist in data
- For labeled patterns: Must have double underscore `__`

---

## Data Flow Diagram

```
USER INTERACTION
   ↓
Select "Sarah Johnson" from dropdown (label: "manager")
   ↓
useLabelToUuidMapping → getUuidFieldName('manager')
   ↓
Returns: "manager__employee_id"
   ↓
handleLabelChange('manager', 'emp-999', options)
   ↓
Updates TWO fields:
  ├→ onChange('manager__employee_id', 'emp-999')  // UUID for API
  └→ onChange('manager', 'Sarah Johnson')          // Label for display
   ↓
Form data now has:
  {
    manager__employee_id: 'emp-999',
    manager: 'Sarah Johnson'
  }
   ↓
On submit → Filter out label fields
   ↓
API receives: { manager__employee_id: 'emp-999' }
```

---

## Performance Considerations

### Memoization

The hook uses `useMemo` to avoid recalculating mapping on every render:

```typescript
const { mapping } = useLabelToUuidMapping(data);
// Mapping only recalculated when `data` changes
```

### Minimal Re-renders

Only helper functions that change trigger re-renders:

```typescript
const { getUuidFieldName } = useLabelToUuidMapping(data);
// getUuidFieldName is stable (doesn't change on every render)
```

---

## TypeScript Support

Full type safety:

```typescript
import type { LabelToUuidMapping } from '@/lib/labelToUuidFieldMapper';

const mapping: LabelToUuidMapping = {
  manager: {
    uuidField: 'manager__employee_id',
    entityType: 'employee',
    multiple: false
  }
};

// Type-safe access
const info = mapping['manager'];
// Type: { uuidField: string; entityType: string; multiple: boolean; } | undefined
```

---

## Testing

### Unit Tests

```typescript
import { generateLabelToUuidMapping } from '@/lib/labelToUuidFieldMapper';

describe('generateLabelToUuidMapping', () => {
  it('detects single reference field', () => {
    const data = {
      manager__employee_id: 'uuid',
      manager: 'James Miller'
    };

    const mapping = generateLabelToUuidMapping(data);

    expect(mapping.manager).toEqual({
      uuidField: 'manager__employee_id',
      entityType: 'employee',
      multiple: false
    });
  });

  it('detects array reference field', () => {
    const data = {
      stakeholder__employee_ids: ['uuid1', 'uuid2'],
      stakeholder: [{...}, {...}]
    };

    const mapping = generateLabelToUuidMapping(data);

    expect(mapping.stakeholder).toEqual({
      uuidField: 'stakeholder__employee_ids',
      entityType: 'employee',
      multiple: true
    });
  });

  it('ignores primary id field', () => {
    const data = {
      id: 'primary-uuid',
      manager__employee_id: 'uuid',
      manager: 'Name'
    };

    const mapping = generateLabelToUuidMapping(data);

    expect(mapping.id).toBeUndefined();
  });
});
```

### Integration Tests

```typescript
import { renderHook } from '@testing-library/react-hooks';
import { useLabelToUuidMapping } from '@/hooks/useLabelToUuidMapping';

describe('useLabelToUuidMapping', () => {
  it('provides helper functions', () => {
    const data = {
      manager__employee_id: 'uuid',
      manager: 'Name'
    };

    const { result } = renderHook(() => useLabelToUuidMapping(data));

    expect(result.current.getUuidFieldName('manager')).toBe('manager__employee_id');
    expect(result.current.getEntityTypeName('manager')).toBe('employee');
    expect(result.current.isMultiple('manager')).toBe(false);
  });
});
```

---

## Migration Guide

### Before (Manual Mapping)

```typescript
// Had to manually track which field corresponds to which
const handleManagerChange = (newUuid: string) => {
  onChange('manager__employee_id', newUuid);  // Hardcoded
  onChange('manager', getNameForUuid(newUuid));
};
```

### After (Dynamic Mapping)

```typescript
// Automatic detection
const { handleLabelChange, getUuidFieldName } = useEntityReferenceForm(data, onChange);

const handleManagerChange = (newUuid: string) => {
  handleLabelChange('manager', newUuid, options);  // Handles both fields automatically
};

// Or even simpler:
<select onChange={(e) => handleLabelChange('manager', e.target.value, options)} />
```

---

## Summary

**The Label→UUID Mapping Solution**:

1. ✅ **Zero Configuration**: Automatic detection via naming convention
2. ✅ **Type Safe**: Full TypeScript support
3. ✅ **Performance**: Memoized calculations
4. ✅ **Flexible**: Works with all 4 naming patterns
5. ✅ **Testable**: Pure functions with unit tests
6. ✅ **React Integration**: Ready-to-use hooks

**Result**: Know exactly which UUID field to update when user interacts with dropdown, with zero manual configuration!
