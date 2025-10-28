# Date Field Inline Editing Fix

**Date:** 2025-10-28
**Issue:** Date fields sending full ISO timestamps instead of yyyy-MM-dd format
**Status:** ✅ Fixed

---

## Problem Description

### Error Encountered

```
The specified value "2024-11-30T00:00:00.000Z" does not conform to the required format, "yyyy-MM-dd"

Failed to update record: Bad Request
{
  "statusCode": 400,
  "code": "FST_ERR_VALIDATION",
  "error": "Bad Request",
  "message": "body/actual_start_date must match format \"date\", body/actual_start_date must be null, body/actual_start_date must match a schema in anyOf"
}
```

### Root Cause

1. **Browser HTML5 Date Input Requirement:** The `<input type="date">` element requires values in `yyyy-MM-dd` format, but was receiving full ISO timestamps like `2024-11-30T00:00:00.000Z`

2. **API Validation:** The backend API schema validates date fields to strictly match `yyyy-MM-dd` format, rejecting ISO timestamps

3. **Missing Data Transformation:** No transformation logic existed to convert ISO timestamps to date-only format before:
   - Displaying in date input elements
   - Sending to API endpoints

---

## Solution Implemented

### 1. Backend Data Transformer (`apps/web/src/lib/dataTransformers.ts`)

Added automatic date field transformation when sending data to API:

```typescript
// NEW: Date field transformation (ISO timestamp → yyyy-MM-dd)
else if (isDateField(key) && typeof value === 'string') {
  transformed[key] = transformDateField(value);
}
```

**New Helper Functions:**

```typescript
/**
 * Checks if a field is a date field based on naming convention
 * Matches fields ending with _date or _ts, or starting with date_
 */
function isDateField(key: string): boolean {
  return /_(date|ts)$|^date_/i.test(key);
}

/**
 * Transforms date field from various formats to yyyy-MM-dd format
 * Handles:
 * - ISO timestamps: "2024-11-30T00:00:00.000Z" → "2024-11-30"
 * - Already formatted: "2024-11-30" → "2024-11-30"
 * - Date objects: new Date() → "2024-11-30"
 */
export function transformDateField(value: any): string | null {
  if (!value) return null;

  try {
    // If already in yyyy-MM-dd format, return as-is
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

    // Parse date and format to yyyy-MM-dd
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error transforming date field:', error);
    return null;
  }
}
```

### 2. DataTable Component (`apps/web/src/components/shared/ui/DataTable.tsx`)

Fixed date input value formatting:

```typescript
// BEFORE (Line 965)
value={editedData[column.key] ?? (record as any)[column.key] ?? ''}

// AFTER
value={(() => {
  const dateValue = editedData[column.key] ?? (record as any)[column.key];
  if (!dateValue) return '';
  // Format to yyyy-MM-dd if it's a full ISO timestamp
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
})()}
```

### 3. InlineEditField Component (`apps/web/src/components/shared/view/InlineEditField.tsx`)

Added date value formatting:

```typescript
value={(() => {
  if (!editValue) return '';
  // Format to yyyy-MM-dd if it's a full ISO timestamp
  try {
    const date = new Date(editValue);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch {
    return editValue;
  }
})()}
```

### 4. InlineEdit Date Component (`apps/web/src/components/shared/designer/InlineEdit.tsx`)

Fixed initial state and cancel handler:

```typescript
// BEFORE
const [editValue, setEditValue] = useState(value || '');

// AFTER
const [editValue, setEditValue] = useState(() => {
  // Format initial value to yyyy-MM-dd for date input
  if (!value) return '';
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch {
    return value;
  }
});

// Updated handleCancel to properly format dates
const handleCancel = () => {
  if (value) {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        setEditValue(date.toISOString().split('T')[0]);
      } else {
        setEditValue(value);
      }
    } catch {
      setEditValue(value);
    }
  } else {
    setEditValue('');
  }
  setIsEditing(false);
};
```

---

## Convention Over Configuration

The date transformation follows the DRY principle and field capability auto-detection system:

### Date Field Pattern Recognition

```typescript
// From fieldCapabilities.ts
date: /_(date|ts)$|^date_/i
```

**Matches:**
- `actual_start_date`
- `actual_end_date`
- `planned_start_date`
- `created_ts`
- `updated_ts`
- `date_modified`
- Any field ending with `_date` or `_ts`
- Any field starting with `date_`

**No manual configuration needed!** The system automatically:
1. Detects date fields by naming convention
2. Renders them with `<input type="date">`
3. Formats values to `yyyy-MM-dd` for display
4. Transforms ISO timestamps to `yyyy-MM-dd` before API submission

---

## Data Flow

### Before Fix (❌ Broken)

```
Database → API Response
"2024-11-30T00:00:00.000Z"
         ↓
Frontend Date Input
value="2024-11-30T00:00:00.000Z"  ❌ Browser warning!
         ↓
User edits date
         ↓
Frontend sends to API
{ actual_start_date: "2024-11-30T00:00:00.000Z" }  ❌ API validation error!
```

### After Fix (✅ Working)

```
Database → API Response
"2024-11-30T00:00:00.000Z"
         ↓
Frontend Date Input (with formatting)
value="2024-11-30"  ✅ Correct format!
         ↓
User edits date
         ↓
transformDateField() applied
         ↓
Frontend sends to API
{ actual_start_date: "2024-11-30" }  ✅ API accepts!
```

---

## Testing Checklist

- ✅ **TypeScript Type Checking:** All changes pass `pnpm typecheck`
- ✅ **Date Input Display:** No browser console warnings about date format
- ✅ **API Validation:** Date fields accepted by backend schema validation
- ✅ **Inline Editing:** Date fields can be edited in DataTable rows
- ✅ **Entity Detail Page:** Date fields editable in InlineEditField component
- ✅ **Form Designer:** Date fields work in InlineEdit component
- ✅ **Null Handling:** Empty date fields properly handled
- ✅ **Already Formatted:** yyyy-MM-dd dates pass through unchanged

---

## Convention Rules Summary

| Field Name Pattern | Auto-Detected As | Input Type | Format Sent to API |
|-------------------|------------------|------------|-------------------|
| `*_date` | Date | `<input type="date">` | `yyyy-MM-dd` |
| `*_ts` | Date | `<input type="date">` | `yyyy-MM-dd` |
| `date_*` | Date | `<input type="date">` | `yyyy-MM-dd` |

**Examples:**
- `actual_start_date` → Date field → `"2024-11-30"`
- `planned_end_date` → Date field → `"2024-12-15"`
- `created_ts` → Date field → `"2024-10-28"`
- `date_modified` → Date field → `"2024-10-28"`

---

## Files Modified

1. `/home/rabin/projects/pmo/apps/web/src/lib/dataTransformers.ts`
   - Added `isDateField()` helper function
   - Added `transformDateField()` transformation function
   - Integrated date transformation into `transformForApi()`

2. `/home/rabin/projects/pmo/apps/web/src/components/shared/ui/DataTable.tsx`
   - Fixed date input value formatting (line 965)

3. `/home/rabin/projects/pmo/apps/web/src/components/shared/view/InlineEditField.tsx`
   - Added date value formatting for date input (line 125)

4. `/home/rabin/projects/pmo/apps/web/src/components/shared/designer/InlineEdit.tsx`
   - Fixed initial state to format dates (line 455)
   - Updated handleCancel to format dates (line 487)

---

## Related Documentation

- **DRY Inline Editing System:** `/home/rabin/projects/pmo/DRY_INLINE_EDIT_TRANSFORMATION.md`
- **Field Capabilities:** `/home/rabin/projects/pmo/apps/web/src/lib/fieldCapabilities.ts`
- **Data Table Guide:** `/home/rabin/projects/pmo/docs/data_table.md`
- **Data Transformers:** `/home/rabin/projects/pmo/apps/web/src/lib/dataTransformers.ts`

---

## Version

**Platform Version:** 2.3.1
**Fix Applied:** 2025-10-28
**Status:** Production Ready ✅
