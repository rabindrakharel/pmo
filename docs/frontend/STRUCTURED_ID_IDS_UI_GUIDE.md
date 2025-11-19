# Structured _ID/_IDS UI Implementation Guide

**Status**: Backend Complete ✅ | Frontend Mapping Complete ✅ | UI Components Pending

**Last Updated**: 2025-01-18
**Version**: 1.0.0

---

## Summary

Backend now returns entity references in structured format:
```json
{
  "id": "project-abc-123",
  "name": "Kitchen Renovation",
  "_ID": {
    "manager": { "entity_code": "employee", "manager__employee_id": "uuid", "manager": "James Miller" }
  },
  "_IDS": {
    "stakeholder": [
      { "entity_code": "employee", "stakeholder__employee_id": "uuid", "stakeholder": "Mike" }
    ]
  }
}
```

---

## Completed Work

### ✅ Backend (API)

**File**: `apps/api/src/services/entity-infrastructure.service.ts`
- `resolve_entity_references()` returns `{ _ID, _IDS }` structured format
- Uses `entity_instance` table for name lookups
- Bulk queries for performance

**File**: `apps/api/src/modules/project/routes.ts`
- GET `/api/v1/project/:id` resolves and returns _ID/_IDS
- GET `/api/v1/project` (list) resolves for all projects

### ✅ Frontend (Mapping)

**File**: `apps/web/src/lib/labelToUuidFieldMapper.ts`
- `generateMappingFromStructuredFormat(_ID, _IDS)` - Extracts mapping

**File**: `apps/web/src/lib/api.ts`
- Response interceptor detects `_ID`/_IDS and auto-generates mappings
- Backwards compatible with flat format

---

## Remaining Work

### 1. EntityFormContainer - View Mode

**File**: `apps/web/src/components/shared/entity/EntityFormContainer.tsx`

**Requirement**: Display labels from `_ID` and `_IDS` (hide UUID fields)

**Implementation**:

```typescript
const renderViewMode = (data: Record<string, any>) => {
  const fields: JSX.Element[] = [];

  // Render regular fields (id, name, code, etc.)
  Object.entries(data).forEach(([key, value]) => {
    // Skip _ID, _IDS, and UUID fields
    if (key === '_ID' || key === '_IDS' || key.endsWith('_id') || key.endsWith('_ids')) {
      return;
    }

    fields.push(
      <div key={key} className="flex items-start gap-3 py-2">
        <span className="text-gray-600 font-medium min-w-[120px]">
          {generateFieldLabel(key)}:
        </span>
        <span className="text-gray-900">
          {formatFieldValue(value, key)}
        </span>
      </div>
    );
  });

  // Render single entity references (_ID)
  if (data._ID && typeof data._ID === 'object') {
    Object.entries(data._ID).forEach(([labelField, refData]: [string, any]) => {
      fields.push(
        <div key={`_id_${labelField}`} className="flex items-start gap-3 py-2">
          <span className="text-gray-600 font-medium min-w-[120px]">
            {generateFieldLabel(labelField)}:
          </span>
          <span className="text-gray-900">
            {refData[labelField]}
          </span>
        </div>
      );
    });
  }

  // Render array entity references (_IDS)
  if (data._IDS && typeof data._IDS === 'object') {
    Object.entries(data._IDS).forEach(([labelField, refArray]: [string, any[]]) => {
      const labels = refArray.map(ref => ref[labelField]).join(', ');
      fields.push(
        <div key={`_ids_${labelField}`} className="flex items-start gap-3 py-2">
          <span className="text-gray-600 font-medium min-w-[120px]">
            {generateFieldLabel(labelField)}:
          </span>
          <span className="text-gray-900">
            {labels}
          </span>
        </div>
      );
    });
  }

  return <div className="space-y-1">{fields}</div>;
};
```

---

### 2. EntityFormContainer - Edit Mode

**File**: `apps/web/src/components/shared/entity/EntityFormContainer.tsx`

**Requirement**:
- `_ID` fields → Single-select dropdown
- `_IDS` fields → Multi-select with tag chips

**Implementation**:

```typescript
const renderEditMode = (data: Record<string, any>, onChange: (updates: Record<string, any>) => void) => {
  // Handle single reference change
  const handleSingleReferenceChange = (labelField: string, uuidField: string, newUuid: string, newLabel: string) => {
    onChange({
      _ID: {
        ...data._ID,
        [labelField]: {
          entity_code: data._ID[labelField].entity_code,
          [uuidField]: newUuid,
          [labelField]: newLabel
        }
      }
    });
  };

  // Handle array reference add
  const handleArrayReferenceAdd = (labelField: string, newItem: any) => {
    const currentArray = data._IDS?.[labelField] || [];
    onChange({
      _IDS: {
        ...data._IDS,
        [labelField]: [...currentArray, newItem]
      }
    });
  };

  // Handle array reference remove
  const handleArrayReferenceRemove = (labelField: string, uuidToRemove: string) => {
    const currentArray = data._IDS?.[labelField] || [];
    const uuidField = Object.keys(currentArray[0] || {}).find(k => k.endsWith('_id'));

    onChange({
      _IDS: {
        ...data._IDS,
        [labelField]: currentArray.filter(item => item[uuidField] !== uuidToRemove)
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Regular fields */}
      {Object.entries(data).map(([key, value]) => {
        if (key === '_ID' || key === '_IDS' || key === 'id') return null;
        return <input key={key} name={key} value={value} onChange={...} />;
      })}

      {/* Single references (_ID) */}
      {data._ID && Object.entries(data._ID).map(([labelField, refData]: [string, any]) => (
        <SingleSelectDropdown
          key={labelField}
          label={generateFieldLabel(labelField)}
          entityType={refData.entity_code}
          value={refData[Object.keys(refData).find(k => k.endsWith('_id'))!]}
          currentLabel={refData[labelField]}
          onChange={(newUuid, newLabel) => {
            const uuidField = Object.keys(refData).find(k => k.endsWith('_id'))!;
            handleSingleReferenceChange(labelField, uuidField, newUuid, newLabel);
          }}
        />
      ))}

      {/* Array references (_IDS) */}
      {data._IDS && Object.entries(data._IDS).map(([labelField, refArray]: [string, any[]]) => (
        <MultiSelectTags
          key={labelField}
          label={generateFieldLabel(labelField)}
          entityType={refArray[0]?.entity_code}
          values={refArray}
          labelField={labelField}
          onAdd={(newUuid, newLabel) => {
            const firstItem = refArray[0] || {};
            const uuidField = Object.keys(firstItem).find(k => k.endsWith('_id'));
            handleArrayReferenceAdd(labelField, {
              entity_code: firstItem.entity_code,
              [uuidField]: newUuid,
              [labelField]: newLabel
            });
          }}
          onRemove={(uuidToRemove) => {
            handleArrayReferenceRemove(labelField, uuidToRemove);
          }}
        />
      ))}
    </div>
  );
};
```

---

### 3. SingleSelectDropdown Component

**File**: `apps/web/src/components/shared/ui/SingleSelectDropdown.tsx` (NEW)

**Props**:
```typescript
interface SingleSelectDropdownProps {
  label: string;
  entityType: string;
  value: string;           // Current UUID
  currentLabel: string;    // Current display label
  onChange: (uuid: string, label: string) => void;
}
```

**Complete Implementation**:

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api';

export const SingleSelectDropdown: React.FC<SingleSelectDropdownProps> = ({
  label,
  entityType,
  value,
  currentLabel,
  onChange
}) => {
  const [options, setOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load options from /api/v1/entity/{entityType}/entity-instance-lookup
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const response = await apiClient.get(`/api/v1/entity/${entityType}/entity-instance-lookup`, {
          params: { active_only: true }
        });
        setOptions(response.data || []);
      } catch (error) {
        console.error(`Error loading ${entityType} options:`, error);
        setOptions([]);
      }
    };

    loadOptions();
  }, [entityType]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options based on search term
  const filteredOptions = options.filter(opt =>
    opt.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-left flex items-center justify-between hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className="text-gray-900">{currentLabel || 'Select...'}</span>
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Options list */}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-2 text-gray-500 text-sm">No options found</div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.id}
                  onClick={() => {
                    onChange(option.id, option.name);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className={`px-4 py-2 cursor-pointer hover:bg-blue-50 ${
                    option.id === value ? 'bg-blue-100 text-blue-900' : 'text-gray-900'
                  }`}
                >
                  {option.name}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
```

---

### 4. MultiSelectTags Component

**File**: `apps/web/src/components/shared/ui/MultiSelectTags.tsx` (NEW)

**Props**:
```typescript
interface MultiSelectTagsProps {
  label: string;
  entityType: string;
  values: any[];
  labelField: string;
  onAdd: (uuid: string, label: string) => void;
  onRemove: (uuid: string) => void;
}
```

**Complete Implementation**:

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api';

export const MultiSelectTags: React.FC<MultiSelectTagsProps> = ({
  label,
  entityType,
  values,
  labelField,
  onAdd,
  onRemove
}) => {
  const [options, setOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load options from /api/v1/entity/{entityType}/entity-instance-lookup
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const response = await apiClient.get(`/api/v1/entity/${entityType}/entity-instance-lookup`, {
          params: { active_only: true }
        });
        setOptions(response.data || []);
      } catch (error) {
        console.error(`Error loading ${entityType} options:`, error);
        setOptions([]);
      }
    };

    loadOptions();
  }, [entityType]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get selected UUIDs
  const selectedUuids = values.map((value) => {
    const uuidField = Object.keys(value).find(k => k.endsWith('_id'));
    return value[uuidField];
  });

  // Filter options (exclude already selected)
  const availableOptions = options.filter(opt =>
    !selectedUuids.includes(opt.id) &&
    opt.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>

      <div className="flex flex-wrap gap-2 p-2 border border-gray-300 rounded-md min-h-[42px]">
        {/* Existing tags */}
        {values.map((value) => {
          const uuidField = Object.keys(value).find(k => k.endsWith('_id'));
          const uuid = value[uuidField];
          const displayLabel = value[labelField];

          return (
            <div
              key={uuid}
              className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
            >
              <span>{displayLabel}</span>
              <button
                type="button"
                onClick={() => onRemove(uuid)}
                className="text-blue-600 hover:text-blue-900 focus:outline-none"
              >
                ✕
              </button>
            </div>
          );
        })}

        {/* Add button */}
        <button
          type="button"
          onClick={() => setShowDropdown(!showDropdown)}
          className="inline-flex items-center gap-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded-full text-sm"
        >
          <span>+</span>
          <span>Add</span>
        </button>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Options list */}
          <div className="max-h-48 overflow-y-auto">
            {availableOptions.length === 0 ? (
              <div className="px-4 py-2 text-gray-500 text-sm">
                {searchTerm ? 'No matching options' : 'All options selected'}
              </div>
            ) : (
              availableOptions.map((option) => (
                <div
                  key={option.id}
                  onClick={() => {
                    onAdd(option.id, option.name);
                    setShowDropdown(false);
                    setSearchTerm('');
                  }}
                  className="px-4 py-2 cursor-pointer hover:bg-blue-50 text-gray-900"
                >
                  {option.name}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
```

---

### 5. EntityDataTable Updates

**File**: `apps/web/src/components/shared/ui/EntityDataTable.tsx`

**Requirement**: Display labels from `_ID` and `_IDS` in table columns

**Changes Needed**:

```typescript
// When rendering table cells, detect _ID and _IDS fields
const renderCell = (row: any, column: any) => {
  const value = row[column.key];

  // Skip rendering _ID and _IDS columns directly
  if (column.key === '_ID' || column.key === '_IDS') {
    return null;
  }

  // Check if this column is a label field from _ID
  if (row._ID && row._ID[column.key]) {
    return <span>{row._ID[column.key][column.key]}</span>;
  }

  // Check if this column is a label field from _IDS
  if (row._IDS && row._IDS[column.key]) {
    const labels = row._IDS[column.key].map((ref: any) => ref[column.key]).join(', ');
    return <span>{labels}</span>;
  }

  // Default rendering
  return formatFieldValue(value, column.key);
};

// When generating columns, extract label fields from _ID and _IDS
const generateColumns = (data: any[]) => {
  if (data.length === 0) return [];

  const firstRow = data[0];
  const columns: any[] = [];

  // Add regular columns (exclude _ID, _IDS, UUID fields)
  Object.keys(firstRow).forEach(key => {
    if (key === '_ID' || key === '_IDS' || key.endsWith('_id') || key.endsWith('_ids')) {
      return;
    }
    columns.push({ key, label: generateFieldLabel(key) });
  });

  // Add columns from _ID
  if (firstRow._ID) {
    Object.keys(firstRow._ID).forEach(labelField => {
      columns.push({ key: labelField, label: generateFieldLabel(labelField) });
    });
  }

  // Add columns from _IDS
  if (firstRow._IDS) {
    Object.keys(firstRow._IDS).forEach(labelField => {
      columns.push({ key: labelField, label: generateFieldLabel(labelField) });
    });
  }

  return columns;
};
```

---

## Saving Changes (Form Submission)

When user saves the form, convert `_ID` and `_IDS` back to flat UUID fields:

```typescript
const handleSave = async (formData: Record<string, any>) => {
  const payload: Record<string, any> = {
    ...formData
  };

  // Convert _ID to flat UUID fields
  if (formData._ID) {
    Object.entries(formData._ID).forEach(([labelField, refData]: [string, any]) => {
      const uuidField = Object.keys(refData).find(k => k.endsWith('_id'));
      if (uuidField) {
        payload[uuidField] = refData[uuidField];
      }
    });
    delete payload._ID;
  }

  // Convert _IDS to flat UUID array fields
  if (formData._IDS) {
    Object.entries(formData._IDS).forEach(([labelField, refArray]: [string, any[]]) => {
      const firstItem = refArray[0] || {};
      const uuidField = Object.keys(firstItem).find(k => k.endsWith('_id'));
      if (uuidField) {
        const pluralUuidField = uuidField.replace(/_id$/, '_ids');
        payload[pluralUuidField] = refArray.map(ref => ref[uuidField]);
      }
    });
    delete payload._IDS;
  }

  // Send to API
  await apiClient.patch(`/api/v1/project/${id}`, payload);
};
```

---

## Testing Checklist

- [ ] Backend: GET /api/v1/project/:id returns _ID/_IDS
- [ ] Backend: GET /api/v1/project (list) returns _ID/_IDS for all items
- [ ] Frontend: Interceptor detects _ID/_IDS and generates mapping
- [ ] Frontend: EntityFormContainer view mode shows labels
- [ ] Frontend: EntityFormContainer edit mode shows dropdowns
- [ ] Frontend: SingleSelectDropdown loads options and changes value
- [ ] Frontend: MultiSelectTags adds/removes items
- [ ] Frontend: EntityDataTable displays labels in columns
- [ ] Frontend: Save converts _ID/_IDS back to UUID fields
- [ ] Frontend: PATCH request sends only UUID fields (no labels)

---

## Next Steps

1. Create `SingleSelectDropdown.tsx` component (copy code above)
2. Create `MultiSelectTags.tsx` component (copy code above)
3. Update `EntityFormContainer.tsx` with view/edit mode logic
4. Update `EntityDataTable.tsx` with _ID/_IDS column handling
5. Test complete flow: load → view → edit → save
6. Add loading states and error handling
7. Add validation (required fields, etc.)

---

## Notes

- Always send **UUIDs** to backend on save (not labels)
- Backend uses `entity_instance` table for name resolution
- Frontend mapping cache auto-populated via interceptor
- All components use `/api/v1/entity/:entityCode/entity-instance-lookup` for dropdowns
- Backwards compatible with flat format (interceptor handles both)

---

**Status**: Ready for UI implementation
**Estimated Time**: 2-4 hours for complete UI integration
