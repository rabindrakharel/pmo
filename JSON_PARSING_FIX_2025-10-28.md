# JSON Field Parsing Fix - Entity Detail Page

**Date:** 2025-10-28
**Issue:** Tags, metadata, and timestamp fields displaying incorrectly on entity detail pages
**Status:** ✅ Fixed

---

## Problem Description

On entity detail pages (e.g., `/project/:id`), several fields were displaying incorrectly:

### 1. Tags Field
- **Raw API Response:** `"[\"corporate\",\"expansion\",\"headquarters\"]"` (JSON string)
- **Expected Display:** Tag chips or comma-separated list
- **Actual Display:** Raw JSON string showing in textarea

### 2. Metadata/Attr Field
- **Raw API Response:** `"{\"internal\":true,\"priority\":\"medium\"}"` (JSON string)
- **Expected Display:** Formatted JSON in textarea
- **Actual Display:** Escaped JSON string

### 3. Timestamp Fields (created_ts, updated_ts)
- **Expected Display:** "3 days ago" (relative time)
- **Actual Display:** ISO timestamp or dash (-)

---

## Root Cause

### Issue 1: No JSON Parsing After API Fetch

**EntityDetailPage.tsx** was not parsing JSON string fields from API responses:

```typescript
// API returns:
{
  tags: "[\"corporate\",\"expansion\"]",      // ❌ String
  metadata: "{\"internal\":true}",           // ❌ String
  created_ts: "2025-10-28T15:52:44.317Z"     // ✓ String (OK)
}

// EntityFormContainer expects:
{
  tags: ["corporate", "expansion"],          // ✓ Array
  metadata: { internal: true },              // ✓ Object
  created_ts: "2025-10-28T15:52:44.317Z"     // ✓ String
}
```

### Issue 2: No Timestamp Type Handler

**EntityFormContainer.tsx** had no `case 'timestamp':` handler, so timestamp fields fell through to the default case showing raw value instead of formatted relative time.

---

## Solution Implemented

### Fix 1: Parse JSON Fields in EntityDetailPage

**File:** `/home/rabin/projects/pmo/apps/web/src/pages/shared/EntityDetailPage.tsx`

**Added JSON parsing** after fetching data from API:

```typescript
const loadData = async () => {
  const api = APIFactory.getAPI(entityType);
  const response = await api.get(id!);
  let responseData = response.data || response;

  // ... existing form_schema parsing ...

  // NEW: Parse tags if it's a string
  if (responseData.tags && typeof responseData.tags === 'string') {
    try {
      responseData.tags = JSON.parse(responseData.tags);
    } catch (e) {
      console.error('Failed to parse tags:', e);
      responseData.tags = [];
    }
  }

  // NEW: Parse metadata (or attr alias) if it's a string
  const metadataField = responseData.metadata || responseData.attr;
  if (metadataField && typeof metadataField === 'string') {
    try {
      const parsed = JSON.parse(metadataField);
      responseData.metadata = parsed;
      responseData.attr = parsed;
    } catch (e) {
      console.error('Failed to parse metadata:', e);
      responseData.metadata = {};
      responseData.attr = {};
    }
  }

  setData(responseData);
};
```

### Fix 2: Add Timestamp Type Handler in EntityFormContainer

**File:** `/home/rabin/projects/pmo/apps/web/src/components/shared/entity/EntityFormContainer.tsx`

**Added `case 'timestamp':`** to render relative time:

```typescript
const renderFieldInput = (field: FieldDef, value: any) => {
  switch (field.type) {
    // ... existing cases ...

    case 'timestamp':
      // Timestamp fields are readonly and show relative time
      return (
        <span
          className="text-gray-600"
          title={value ? formatFriendlyDate(value) : undefined}
        >
          {value ? formatRelativeTime(value) : '-'}
        </span>
      );

    default:
      return <span>{value || '-'}</span>;
  }
};
```

---

## Data Flow (After Fix)

### Tags Field

```
API Response
"[\"corporate\",\"expansion\"]"
         ↓ JSON.parse() in EntityDetailPage
["corporate", "expansion"]
         ↓ EntityFormContainer (case 'array')
Display: "corporate, expansion" (editable textarea)
```

### Metadata Field

```
API Response
"{\"internal\":true,\"priority\":\"medium\"}"
         ↓ JSON.parse() in EntityDetailPage
{ internal: true, priority: "medium" }
         ↓ EntityFormContainer (case 'jsonb')
Display: Formatted JSON in textarea
{
  "internal": true,
  "priority": "medium"
}
```

### Timestamp Fields

```
API Response
"2025-10-28T15:52:44.317Z"
         ↓ EntityDetailPage (no parsing needed)
"2025-10-28T15:52:44.317Z"
         ↓ EntityFormContainer (case 'timestamp')
         ↓ formatRelativeTime()
Display: "3 days ago" (with hover tooltip showing friendly date)
```

---

## Field Type Mapping

| Field Type | API Format | Parsed Format | Display Format |
|------------|-----------|---------------|----------------|
| `array` | JSON string | Array | "item1, item2, item3" |
| `jsonb` | JSON string | Object | Formatted JSON |
| `timestamp` | ISO string | ISO string | "3 days ago" |
| `date` | ISO string | ISO string | Date picker (yyyy-MM-dd) |

---

## Fields Fixed

### Project Entity
- ✅ `tags` - Now shows as editable comma-separated list
- ✅ `metadata` - Now shows as formatted JSON
- ✅ `created_ts` - Now shows "3 days ago"
- ✅ `updated_ts` - Now shows "just now" or relative time

### All Entities with These Fields
- ✅ Any entity with `tags` field
- ✅ Any entity with `metadata` or `attr` field
- ✅ Any entity with `created_ts`, `updated_ts` timestamp fields

---

## Edge Cases Handled

### 1. Invalid JSON Strings
```typescript
try {
  responseData.tags = JSON.parse(responseData.tags);
} catch (e) {
  console.error('Failed to parse tags:', e);
  responseData.tags = [];  // ✅ Fallback to empty array
}
```

### 2. Metadata vs Attr Alias
```typescript
const metadataField = responseData.metadata || responseData.attr;
// Handles both field names used in different API responses
```

### 3. Already Parsed Data
```typescript
if (responseData.tags && typeof responseData.tags === 'string') {
  // Only parse if it's a string
  responseData.tags = JSON.parse(responseData.tags);
}
// If already an array, no parsing needed ✅
```

---

## Testing Checklist

- ✅ **Tags field** displays as comma-separated list, not JSON string
- ✅ **Metadata field** displays as formatted JSON, not escaped string
- ✅ **created_ts** shows "X days ago", not ISO timestamp
- ✅ **updated_ts** shows relative time with hover tooltip
- ✅ **Edit mode** works correctly for all field types
- ✅ **Invalid JSON** doesn't crash, uses fallback values
- ✅ **TypeScript** compilation passes
- ✅ **Already parsed data** doesn't get double-parsed

---

## Files Modified

1. **`/home/rabin/projects/pmo/apps/web/src/pages/shared/EntityDetailPage.tsx`**
   - Added JSON parsing for `tags` field
   - Added JSON parsing for `metadata`/`attr` fields
   - Location: `loadData()` function after API fetch

2. **`/home/rabin/projects/pmo/apps/web/src/components/shared/entity/EntityFormContainer.tsx`**
   - Added `case 'timestamp':` handler
   - Renders relative time with hover tooltip
   - Location: `renderFieldInput()` switch statement

---

## Related Issues

This fix resolves the "messed up" display of:
- Tags showing as raw JSON strings
- Metadata showing as escaped JSON
- Timestamps showing as "-" or raw ISO strings
- All fields on entity detail pages affected

---

## Prevention

To prevent this issue in the future:

### 1. API Response Type Consistency
Ensure API returns proper types:
- Arrays as arrays (not JSON strings)
- Objects as objects (not JSON strings)

### 2. Type-Safe Parsing
Use TypeScript interfaces to catch type mismatches:
```typescript
interface ProjectData {
  tags: string[];        // Array, not string
  metadata: object;      // Object, not string
  created_ts: string;    // ISO string
}
```

### 3. Backend Serialization
Check backend serialization in API routes:
```typescript
// ❌ Wrong
const tags = JSON.stringify(record.tags);

// ✓ Correct
const tags = record.tags;  // Let JSON response handle it
```

---

## Version

**Platform Version:** 2.3.4
**Fix Applied:** 2025-10-28
**Status:** Production Ready ✅
