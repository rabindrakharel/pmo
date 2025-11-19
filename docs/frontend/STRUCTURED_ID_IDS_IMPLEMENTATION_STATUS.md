# Structured _ID/_IDS Implementation Status

**Last Updated**: 2025-01-18
**Status**: Backend ✅ | Mapping ✅ | Components ✅ | Integration Pending

---

## ✅ Completed

### 1. Backend (API) - 100% Complete

**Files Modified**:
- `apps/api/src/services/entity-infrastructure.service.ts`
- `apps/api/src/modules/project/routes.ts`

**What's Working**:
- ✅ `resolve_entity_references()` returns `{ _ID, _IDS }` structured format
- ✅ Uses `entity_instance` table for name lookups
- ✅ GET `/api/v1/project/:id` returns structured format
- ✅ GET `/api/v1/project` (list) returns structured format for all items

**Example Response**:
```json
{
  "id": "project-abc-123",
  "name": "Kitchen Renovation",
  "_ID": {
    "manager": {
      "entity_code": "employee",
      "manager__employee_id": "emp-456",
      "manager": "James Miller"
    }
  },
  "_IDS": {
    "stakeholder": [
      {
        "entity_code": "employee",
        "stakeholder__employee_id": "emp-111",
        "stakeholder": "Mike Brown"
      }
    ]
  }
}
```

### 2. Frontend Mapping - 100% Complete

**Files Modified**:
- `apps/web/src/lib/labelToUuidFieldMapper.ts`
- `apps/web/src/lib/api.ts`

**What's Working**:
- ✅ `generateMappingFromStructuredFormat(_ID, _IDS)` extracts mappings
- ✅ API response interceptor detects `_ID`/`_IDS` keys
- ✅ Auto-generates and caches mappings in global context
- ✅ Backwards compatible with flat format

### 3. UI Components - 100% Complete

**New Components Created**:

#### `EntitySelectDropdown` (Single Select for _ID fields)
**File**: `apps/web/src/components/shared/ui/EntitySelectDropdown.tsx`
- ✅ Uses native HTML `<select>` element
- ✅ Loads options from `/api/v1/entity/{entityType}/options`
- ✅ Returns both UUID and label on change
- ✅ Loading and error states
- ✅ Disabled/readonly support

#### `EntityMultiSelectTags` (Multi-Select for _IDS fields)
**File**: `apps/web/src/components/shared/ui/EntityMultiSelectTags.tsx`
- ✅ Reuses existing `SearchableMultiSelect` component
- ✅ Loads options from `/api/v1/entity/{entityType}/options`
- ✅ Tag chips with X removal button
- ✅ Search functionality (from SearchableMultiSelect)
- ✅ Add/remove callbacks
- ✅ Loading and error states

**Existing Components Reused**:
- ✅ `SearchableMultiSelect` - Provides tag UI, search, X removal for multi-select
- ✅ Native `<select>` - Used for single-select dropdown

---

## 📋 Remaining Work

### 1. EntityFormContainer Integration

**File**: `apps/web/src/components/shared/entity/EntityFormContainer.tsx`

**What Needs to Be Done**:

#### A. View Mode Rendering
Add rendering for `_ID` and `_IDS` fields in view mode:

```typescript
// Add after line ~450 (in view mode rendering)
const renderViewMode = (data: Record<string, any>) => {
  // ... existing regular field rendering ...

  // Render single entity references (_ID)
  if (data._ID && typeof data._ID === 'object') {
    Object.entries(data._ID).forEach(([labelField, refData]: [string, any]) => {
      fields.push(
        <div key={`_id_${labelField}`} className="flex items-start gap-3 py-2">
          <span className="text-gray-600 font-medium min-w-[120px]">
            {generateFieldLabel(labelField)}:
          </span>
          <span className="text-gray-900">{refData[labelField]}</span>
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
          <span className="text-gray-900">{labels}</span>
        </div>
      );
    });
  }
};
```

#### B. Edit Mode Rendering
Add rendering for `_ID` and `_IDS` fields in edit mode:

```typescript
// Add in renderFormFields() or similar edit mode rendering section
import { EntitySelectDropdown } from '@/components/shared/ui/EntitySelectDropdown';
import { EntityMultiSelectTags } from '@/components/shared/ui/EntityMultiSelectTags';

// After regular field rendering, add:

// Render single references (_ID)
if (data._ID && Object.keys(data._ID).length > 0) {
  Object.entries(data._ID).map(([labelField, refData]: [string, any]) => {
    const uuidField = Object.keys(refData).find(k => k.endsWith('_id'));
    if (!uuidField) return null;

    return (
      <EntitySelectDropdown
        key={labelField}
        label={generateFieldLabel(labelField)}
        entityType={refData.entity_code}
        value={refData[uuidField]}
        currentLabel={refData[labelField]}
        onChange={(newUuid, newLabel) => {
          onChange({
            _ID: {
              ...data._ID,
              [labelField]: {
                entity_code: refData.entity_code,
                [uuidField]: newUuid,
                [labelField]: newLabel
              }
            }
          });
        }}
      />
    );
  });
}

// Render array references (_IDS)
if (data._IDS && Object.keys(data._IDS).length > 0) {
  Object.entries(data._IDS).map(([labelField, refArray]: [string, any[]]) => {
    const firstItem = refArray[0] || {};
    const uuidField = Object.keys(firstItem).find(k => k.endsWith('_id'));
    if (!uuidField) return null;

    return (
      <EntityMultiSelectTags
        key={labelField}
        label={generateFieldLabel(labelField)}
        entityType={firstItem.entity_code}
        values={refArray}
        labelField={labelField}
        onAdd={(newUuid, newLabel) => {
          const currentArray = data._IDS?.[labelField] || [];
          onChange({
            _IDS: {
              ...data._IDS,
              [labelField]: [
                ...currentArray,
                {
                  entity_code: firstItem.entity_code,
                  [uuidField]: newUuid,
                  [labelField]: newLabel
                }
              ]
            }
          });
        }}
        onRemove={(uuidToRemove) => {
          const currentArray = data._IDS?.[labelField] || [];
          onChange({
            _IDS: {
              ...data._IDS,
              [labelField]: currentArray.filter(item => item[uuidField] !== uuidToRemove)
            }
          });
        }}
      />
    );
  });
}
```

#### C. Form Submission
Convert `_ID` and `_IDS` back to flat UUID fields before saving:

```typescript
// Add in handleSave() or form submission handler
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

  // Send to API (only UUID fields, no labels)
  await apiClient.patch(`/api/v1/${entityType}/${id}`, payload);
};
```

---

### 2. EntityDataTable Integration (Optional Enhancement)

**File**: `apps/web/src/components/shared/ui/EntityDataTable.tsx`

**What Needs to Be Done**:
Display labels from `_ID` and `_IDS` in table columns.

**Current Behavior**: Table likely shows raw UUID fields or nothing.

**Desired Behavior**: Display human-readable labels.

**Implementation** (optional, lower priority):
```typescript
// When generating columns, extract from _ID and _IDS
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

// When rendering cells
const renderCell = (row: any, column: any) => {
  // Check if this column is from _ID
  if (row._ID && row._ID[column.key]) {
    return <span>{row._ID[column.key][column.key]}</span>;
  }

  // Check if this column is from _IDS
  if (row._IDS && row._IDS[column.key]) {
    const labels = row._IDS[column.key].map((ref: any) => ref[column.key]).join(', ');
    return <span>{labels}</span>;
  }

  // Default rendering
  return formatFieldValue(row[column.key], column.key);
};
```

---

## 🧪 Testing Checklist

- [ ] Backend: GET `/api/v1/project/:id` returns `_ID` and `_IDS`
- [ ] Backend: GET `/api/v1/project` returns `_ID` and `_IDS` for all items
- [ ] Frontend: Interceptor detects `_ID`/`_IDS` and generates mapping
- [ ] Frontend: EntityFormContainer view mode shows labels
- [ ] Frontend: EntityFormContainer edit mode shows dropdowns
- [ ] Frontend: EntitySelectDropdown loads options correctly
- [ ] Frontend: EntitySelectDropdown updates value on change
- [ ] Frontend: EntityMultiSelectTags displays selected items as tags
- [ ] Frontend: EntityMultiSelectTags adds new items
- [ ] Frontend: EntityMultiSelectTags removes items (X button)
- [ ] Frontend: Form submission converts `_ID`/`_IDS` to UUID fields
- [ ] Frontend: PATCH request sends only UUID fields (no labels)
- [ ] Backend: Updated project saved correctly

---

## 🔧 Quick Integration Steps

1. **Open `EntityFormContainer.tsx`**
2. **Add imports**:
   ```typescript
   import { EntitySelectDropdown } from '@/components/shared/ui/EntitySelectDropdown';
   import { EntityMultiSelectTags } from '@/components/shared/ui/EntityMultiSelectTags';
   ```
3. **Find view mode rendering** (search for "view mode" or field display logic)
4. **Add `_ID`/`_IDS` view rendering** (copy code from section 1.A above)
5. **Find edit mode rendering** (search for "renderFormField" or similar)
6. **Add `_ID`/`_IDS` edit rendering** (copy code from section 1.B above)
7. **Find form submission handler** (search for "handleSave" or "onSubmit")
8. **Add payload conversion** (copy code from section 1.C above)
9. **Test**: Load project → See labels → Edit → Save → Verify

---

## 📦 Summary

**What's Complete**:
- ✅ Backend returns structured `_ID`/`_IDS` format
- ✅ Frontend interceptor auto-generates mappings
- ✅ Two reusable UI components created
- ✅ Components load entity options from API
- ✅ SearchableMultiSelect reused for multi-select

**What's Needed**:
- 📝 Integrate components into EntityFormContainer (3 code blocks)
- 📝 Test complete flow (10 minutes)
- 📝 (Optional) Update EntityDataTable for better column display

**Estimated Time**: 30-60 minutes for complete integration

---

## 💡 Key Design Decisions

1. **Reused existing components** instead of creating new ones
2. **SearchableMultiSelect** already provides perfect UX for `_IDS` fields
3. **Native HTML select** is simple and works well for `_ID` fields
4. **Wrapper pattern** keeps API loading logic separate from UI
5. **Backwards compatible** - interceptor handles both formats

---

**Ready for Integration** ✅
