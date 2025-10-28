# Centralized Field Renderers - Date & Timestamp Display

**Date:** 2025-10-28
**Approach:** Convention Over Configuration with Centralized Render Functions
**Status:** ✅ Implemented

---

## Overview

Field visualization is now **centralized in entityConfig.ts** through the `render` prop on column definitions. DataTable remains a pure display component with zero formatting logic.

---

## Architecture Principle

> **"Field visualization must be centralized and come from props, don't change DataTable!"**

### ✅ Correct Approach (Implemented)

```typescript
// entityConfig.ts - Single source of truth for ALL field rendering
export const renderTimestamp = (value?: string) => {
  return formatRelativeTime(value);
};

export const renderDate = (value?: string) => {
  return formatFriendlyDate(value);
};

// Project entity config
columns: [
  {
    key: 'created_ts',
    title: 'Created',
    render: renderTimestamp  // ← Centralized render function
  },
  {
    key: 'planned_start_date',
    title: 'Start Date',
    render: renderDate  // ← Centralized render function
  }
]
```

### ❌ Wrong Approach (Avoided)

```typescript
// DataTable.tsx - DO NOT DO THIS!
if (column.key.endsWith('_ts')) {
  return formatRelativeTime(value);  // ❌ Hardcoded logic in component
}
```

**Why Wrong:**
- DataTable becomes opinionated and less reusable
- Format logic scattered across components
- Hard to override or customize per entity
- Violates separation of concerns

---

## Centralized Render Functions

**Location:** `/home/rabin/projects/pmo/apps/web/src/lib/entityConfig.ts`

### Timestamp Renderer

```typescript
/**
 * Render timestamps as relative time
 * Used for: created_ts, updated_ts, last_executed_at, etc.
 * Examples: "3 days ago", "just now", "2 hours ago"
 */
export const renderTimestamp = (value?: string) => {
  return formatRelativeTime(value);
};
```

**Usage:**
```typescript
{
  key: 'created_ts',
  title: 'Created',
  render: renderTimestamp
}
```

**Output:** `"3 days ago"`, `"just now"`, `"2 hours ago"`

### Date Renderer

```typescript
/**
 * Render dates in friendly format
 * Used for: planned_start_date, order_date, invoice_date, etc.
 * Examples: "Nov 30, 2024", "Dec 15, 2024"
 */
export const renderDate = (value?: string) => {
  return formatFriendlyDate(value);
};
```

**Usage:**
```typescript
{
  key: 'planned_start_date',
  title: 'Start Date',
  render: renderDate
}
```

**Output:** `"Nov 30, 2024"`, `"Dec 15, 2024"`

---

## Convention Rules

| Field Name Pattern | Render Function | Display Format | Example Output |
|-------------------|----------------|----------------|----------------|
| `*_ts` | `renderTimestamp` | Relative time | "3 days ago" |
| `*_at` | `renderTimestamp` | Relative time | "2 hours ago" |
| `*_date` | `renderDate` | Friendly date | "Nov 30, 2024" |

---

## Implementation Details

### Files Modified

**1. `/home/rabin/projects/pmo/apps/web/src/lib/entityConfig.ts`**

Added centralized render functions:
```typescript
import { formatRelativeTime, formatFriendlyDate } from './dataTransformers';

export const renderTimestamp = (value?: string) => {
  return formatRelativeTime(value);
};

export const renderDate = (value?: string) => {
  return formatFriendlyDate(value);
};
```

Updated all column definitions:
- **Timestamp columns** (`created_ts`, `updated_ts`, `last_executed_at`): Use `renderTimestamp`
- **Date columns** (`planned_start_date`, `order_date`, `invoice_date`, etc.): Use `renderDate`

**Total updates:**
- 8 timestamp columns updated to use `renderTimestamp`
- 6 date columns updated to use `renderDate`

### DataTable Behavior

DataTable simply executes the `render` prop if provided:

```typescript
// DataTable.tsx - Pure display logic
{column.render
  ? column.render((record as any)[column.key], record, data)
  : (record as any)[column.key]?.toString() || (
    <span className="text-gray-400 italic">—</span>
  )
}
```

**No formatting logic in DataTable!** ✅

---

## Benefits

### 1. **Single Source of Truth**
All field rendering logic lives in `entityConfig.ts`
```typescript
// Change display format globally by updating one function
export const renderTimestamp = (value?: string) => {
  return formatRelativeTime(value);  // Easy to change!
};
```

### 2. **Per-Entity Customization**
Each entity can customize rendering as needed:
```typescript
// Project entity - use standard renderer
{ key: 'created_ts', render: renderTimestamp }

// Special entity - custom renderer
{ key: 'created_ts', render: (value) => `Created: ${formatRelativeTime(value)}` }
```

### 3. **DataTable Remains Pure**
DataTable is a generic, reusable component with zero business logic:
```typescript
// Can be used anywhere with any render function
<DataTable
  columns={[
    { key: 'date', render: (v) => new Date(v).toISOString() },
    { key: 'timestamp', render: (v) => moment(v).fromNow() }
  ]}
/>
```

### 4. **Easy Testing**
Render functions can be unit tested independently:
```typescript
describe('renderTimestamp', () => {
  it('shows relative time', () => {
    expect(renderTimestamp('2025-10-25T10:00:00Z')).toBe('3 days ago');
  });
});
```

---

## Updated Entities

### Project Entity
```typescript
columns: [
  { key: 'planned_start_date', render: renderDate },      // "Nov 30, 2024"
  { key: 'planned_end_date', render: renderDate },        // "Dec 15, 2024"
]
```

### Artifact Entity
```typescript
columns: [
  { key: 'created_ts', render: renderTimestamp },   // "3 days ago"
  { key: 'updated_ts', render: renderTimestamp },   // "just now"
]
```

### Form Entity
```typescript
columns: [
  { key: 'updated_ts', render: renderTimestamp },   // "2 hours ago"
]
```

### Order Entity
```typescript
columns: [
  { key: 'order_date', render: renderDate },   // "Nov 30, 2024"
]
```

### Shipment Entity
```typescript
columns: [
  { key: 'shipment_date', render: renderDate },   // "Dec 1, 2024"
]
```

### Invoice Entity
```typescript
columns: [
  { key: 'invoice_date', render: renderDate },   // "Nov 15, 2024"
  { key: 'due_date', render: renderDate },       // "Dec 15, 2024"
]
```

### Workflow Automation Entity
```typescript
columns: [
  { key: 'last_executed_at', render: renderTimestamp },   // "5 minutes ago"
]
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────┐
│           entityConfig.ts (Source of Truth)          │
│                                                      │
│  export const renderTimestamp = (value) => {         │
│    return formatRelativeTime(value);                 │
│  };                                                  │
│                                                      │
│  columns: [                                          │
│    { key: 'created_ts', render: renderTimestamp }    │
│  ]                                                   │
└─────────────────────────────────────────────────────┘
                         ↓ Props
┌─────────────────────────────────────────────────────┐
│              DataTable Component (Pure)              │
│                                                      │
│  {column.render                                      │
│    ? column.render(value, record, data)              │
│    : value?.toString()                               │
│  }                                                   │
└─────────────────────────────────────────────────────┘
                         ↓ Render
┌─────────────────────────────────────────────────────┐
│                   User Sees                          │
│                                                      │
│  Created: 3 days ago                                 │
│  Start Date: Nov 30, 2024                            │
└─────────────────────────────────────────────────────┘
```

---

## Customization Examples

### Example 1: Custom Timestamp Format

```typescript
// Want different format for specific entity?
// Just define custom renderer in that entity's config
columns: [
  {
    key: 'created_ts',
    title: 'Created',
    render: (value) => `📅 ${formatRelativeTime(value)}`  // Custom!
  }
]
```

### Example 2: Conditional Formatting

```typescript
columns: [
  {
    key: 'due_date',
    title: 'Due Date',
    render: (value, record) => {
      const isOverdue = new Date(value) < new Date();
      return (
        <span className={isOverdue ? 'text-red-600 font-bold' : ''}>
          {formatFriendlyDate(value)}
        </span>
      );
    }
  }
]
```

### Example 3: Override Global Renderer

```typescript
// Use old format for one specific entity
columns: [
  {
    key: 'created_ts',
    title: 'Created',
    render: (value) => new Date(value).toISOString()  // Override!
  }
]
```

---

## Testing Checklist

- ✅ **TypeScript type checking passes**
- ✅ **All timestamp fields show relative time** ("3 days ago")
- ✅ **All date fields show friendly dates** ("Nov 30, 2024")
- ✅ **DataTable has zero formatting logic**
- ✅ **Render functions defined in entityConfig only**
- ✅ **Per-entity customization possible**
- ✅ **14 columns updated across 7 entity types**

---

## Maintainability

### Adding New Date/Timestamp Column

**Step 1:** Add column to entity config with appropriate render function
```typescript
columns: [
  {
    key: 'modified_at',
    title: 'Modified',
    render: renderTimestamp  // ← Use centralized function
  }
]
```

**Step 2:** That's it! No DataTable changes needed. ✅

### Changing Global Format

**Step 1:** Update centralized function in entityConfig.ts
```typescript
export const renderTimestamp = (value?: string) => {
  // Change format globally for ALL entities
  return moment(value).fromNow();  // Using moment.js
};
```

**Step 2:** All entities automatically use new format! ✅

---

## Related Documentation

- **Data Transformers:** `/home/rabin/projects/pmo/apps/web/src/lib/dataTransformers.ts`
- **Entity Config:** `/home/rabin/projects/pmo/apps/web/src/lib/entityConfig.ts`
- **DataTable Component:** `/home/rabin/projects/pmo/apps/web/src/components/shared/ui/DataTable.tsx`

---

## Version

**Platform Version:** 2.3.3
**Feature:** Centralized Field Renderers
**Date:** 2025-10-28
**Status:** Production Ready ✅

---

## Summary

✅ **Centralized:** All render logic in `entityConfig.ts`
✅ **Consistent:** Same format across all entities
✅ **Flexible:** Easy per-entity customization
✅ **Maintainable:** Single source of truth
✅ **Pure Components:** DataTable has zero business logic
