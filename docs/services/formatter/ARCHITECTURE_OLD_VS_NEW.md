# Architecture: Old vs New System

## The Old Data Transform Code is REUSED, Not Replaced!

### Current Architecture (Delegation Pattern)

```
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE (PostgreSQL)                     │
│  budget_allocated_amt NUMERIC, dl__project_stage VARCHAR    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         schema-builder.service.ts (NEW - Backend)           │
│  - Introspects database schema                              │
│  - Detects: budget_allocated_amt → format.type = 'currency' │
│  - Detects: dl__project_stage → format.type = 'badge'       │
│  - Returns: EntitySchema with all metadata                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         schemaFormatters.tsx (NEW - Frontend)               │
│  - Receives: formatFieldValue(value, column)                │
│  - Checks: column.format.type                               │
│  - Delegates to OLD formatters ────────┐                    │
└────────────────────────────────────────┼────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────┐
│      data_transform_render.tsx (OLD - STILL ACTIVE!)        │
│  ✅ formatCurrency(value)           ← REUSED                │
│  ✅ formatRelativeTime(value)       ← REUSED                │
│  ✅ renderSettingBadge(...)         ← REUSED                │
│  ✅ getSettingColor(...)            ← REUSED                │
│  ✅ All other existing formatters   ← REUSED                │
└─────────────────────────────────────────────────────────────┘
```

---

## Code Reuse in Action

### schemaFormatters.tsx (NEW)

```typescript
// Import OLD formatters
import {
  formatCurrency,        // ← From data_transform_render.tsx
  formatRelativeTime,    // ← From data_transform_render.tsx
  renderSettingBadge,    // ← From data_transform_render.tsx
  getSettingColor        // ← From data_transform_render.tsx
} from './data_transform_render';

export function formatFieldValue(value: any, column: SchemaColumn) {
  const formatType = column.format?.type;

  switch (formatType) {
    // ✅ REUSE: Delegates to OLD formatCurrency()
    case 'currency':
      return formatCurrency(value);

    // ✅ REUSE: Delegates to OLD formatRelativeTime()
    case 'relative-time':
      return formatRelativeTime(value);

    // ✅ REUSE: Delegates to OLD renderSettingBadge()
    case 'badge':
      const datalabel = column.format.settingsDatalabel;
      const colorCode = getSettingColor(datalabel, String(value));
      return renderSettingBadge(colorCode, String(value));

    // ... other cases also delegate to OLD code
  }
}
```

---

## What Happens to Old Code?

### ✅ KEPT (Still Used)

**File**: `apps/web/src/lib/data_transform_render.tsx`

**Status**: **ACTIVE - All formatters still in use!**

**Functions REUSED by new system**:
1. ✅ `formatCurrency(value)` - Currency formatting
2. ✅ `formatRelativeTime(value)` - "2 hours ago"
3. ✅ `renderSettingBadge(color, label)` - Colored badges
4. ✅ `getSettingColor(datalabel, code)` - Badge colors
5. ✅ All other formatters still work

**Why keep it?**
- ✅ Already tested and working
- ✅ No need to duplicate formatting logic
- ✅ Gradual migration (old components still work)
- ✅ Single source of truth for formatting rules

---

## Migration Strategy: Gradual, Not Big Bang

### Phase 1: New System Uses Old Formatters (CURRENT)

```typescript
// NEW schema system
const schema = await buildEntitySchema(db, 'project', 'd_project');

// Frontend formatting (NEW wrapper)
formatFieldValue(50000, { format: { type: 'currency' } })
  ↓
// Delegates to OLD formatter
formatCurrency(50000)  // ← from data_transform_render.tsx
  ↓
// Returns: "$50,000.00"
```

### Phase 2: Old Components Continue Working (CURRENT)

```typescript
// OLD entity config (still works!)
const projectConfig = {
  columns: [
    {
      key: 'budget_allocated_amt',
      render: (value) => formatCurrency(value)  // ← Still works!
    }
  ]
};
```

### Phase 3: Gradual Replacement (FUTURE)

As components are updated to use schema system:
- OLD: `entityConfig.ts` columns with render functions
- NEW: Auto-generated schema columns

Both systems coexist peacefully!

---

## Benefits of This Approach

### 1. Zero Code Duplication

```typescript
// ❌ BAD: Duplicate formatting logic
// data_transform_render.tsx
export function formatCurrency(value) { /* ... */ }

// schemaFormatters.tsx
export function formatCurrency(value) { /* ... DUPLICATE! */ }

// ✅ GOOD: Reuse existing logic
// data_transform_render.tsx
export function formatCurrency(value) { /* ... */ }

// schemaFormatters.tsx
import { formatCurrency } from './data_transform_render';
export function formatFieldValue(value, column) {
  return formatCurrency(value);  // ← REUSED!
}
```

### 2. Consistent Formatting

Both old and new systems use the **same formatters** → guaranteed consistency!

```typescript
// Old component
<span>{formatCurrency(project.budget_allocated_amt)}</span>
// Output: "$50,000.00"

// New component (schema-driven)
<span>{formatFieldValue(project.budget_allocated_amt, column)}</span>
// Output: "$50,000.00"  ← SAME RESULT!
```

### 3. Gradual Migration

Old components still work while new ones use schema system:

```typescript
// Old component (entityConfig.ts)
<FilteredDataTable
  entityType="project"
  config={{
    columns: [
      { key: 'budget', render: (v) => formatCurrency(v) }  // ← Still works!
    ]
  }}
/>

// New component (schema-driven)
<FilteredDataTable
  entityType="project"
  // No config needed - uses schema!
/>
```

### 4. Tested Code Reused

Why rewrite formatters that already work?
- ✅ `formatCurrency()` already handles null/undefined
- ✅ `formatRelativeTime()` already handles edge cases
- ✅ `renderSettingBadge()` already styled correctly
- ✅ All battle-tested in production

---

## Old vs New: Side-by-Side Comparison

### OLD System (Still Works)

```typescript
// apps/web/src/lib/entityConfig.ts
export const projectConfig = {
  columns: [
    {
      key: 'budget_allocated_amt',
      title: 'Budget Allocated',        // ❌ Manually specified
      width: '120px',                   // ❌ Manually specified
      align: 'right',                   // ❌ Manually specified
      sortable: true,                   // ❌ Manually specified
      render: (value) => formatCurrency(value)  // ✅ Uses old formatter
    },
    {
      key: 'dl__project_stage',
      title: 'Project Stage',           // ❌ Manually specified
      width: '150px',                   // ❌ Manually specified
      align: 'center',                  // ❌ Manually specified
      render: (value, record) => {      // ✅ Uses old formatter
        const color = getSettingColor('project_stage', value);
        return renderSettingBadge(color, value);
      }
    }
  ]
};
```

### NEW System (Auto-Generated)

```typescript
// Database introspection
const schema = await buildEntitySchema(db, 'project', 'd_project');

// Auto-generated schema
{
  columns: [
    {
      key: 'budget_allocated_amt',
      title: 'Budget Allocated',        // ✅ Auto-generated
      width: '120px',                   // ✅ Auto-detected
      align: 'right',                   // ✅ Auto-detected
      sortable: true,                   // ✅ Auto-detected
      format: { type: 'currency' }      // ✅ Auto-detected
      // Rendering: formatFieldValue() → formatCurrency() ✅ Reuses old formatter
    },
    {
      key: 'dl__project_stage',
      title: 'Project Stage',           // ✅ Auto-generated
      width: '150px',                   // ✅ Auto-detected
      align: 'center',                  // ✅ Auto-detected
      format: {
        type: 'badge',
        settingsDatalabel: 'project_stage'
      }
      // Rendering: formatFieldValue() → renderSettingBadge() ✅ Reuses old formatter
    }
  ]
}
```

**Key Difference**:
- OLD: Manual configuration, but same formatters
- NEW: Auto-generated configuration, **still uses same formatters**

---

## What Gets Replaced?

### ❌ REPLACED: Manual Column Configuration

```typescript
// OLD: Manual column definitions in entityConfig.ts
columns: [
  { key: 'budget_allocated_amt', title: 'Budget Allocated', render: ... },
  { key: 'dl__project_stage', title: 'Project Stage', render: ... },
  // ... 20+ columns manually defined
]

// NEW: Auto-generated from database
// NO manual configuration needed!
```

### ❌ REPLACED: Repetitive Field Detection

```typescript
// OLD: Detect field type in multiple places
// In entityConfig.ts
if (key.endsWith('_amt')) { align: 'right', width: '120px' }

// In data_transform_render.tsx
if (field.endsWith('_amt')) { return formatCurrency(value) }

// NEW: Detect once in schema-builder.service.ts
if (/_amt$/.test(columnName)) {
  return {
    align: 'right',
    width: '120px',
    format: { type: 'currency' }
  };
}
```

### ✅ KEPT: All Formatting Functions

```typescript
// ✅ KEPT: All functions in data_transform_render.tsx
export function formatCurrency(value) { ... }      // ← STILL USED
export function formatRelativeTime(value) { ... }  // ← STILL USED
export function renderSettingBadge(...) { ... }    // ← STILL USED
export function getSettingColor(...) { ... }       // ← STILL USED
// ... all other formatters STILL USED
```

---

## Summary

### What Happens to Old Data Transform Code?

**Answer**: **It's REUSED, not replaced!**

| Component | Status | Reason |
|-----------|--------|--------|
| `data_transform_render.tsx` | ✅ **ACTIVE** | Formatters reused by new system |
| `formatCurrency()` | ✅ **ACTIVE** | Called by `schemaFormatters.tsx` |
| `formatRelativeTime()` | ✅ **ACTIVE** | Called by `schemaFormatters.tsx` |
| `renderSettingBadge()` | ✅ **ACTIVE** | Called by `schemaFormatters.tsx` |
| `getSettingColor()` | ✅ **ACTIVE** | Called by `schemaFormatters.tsx` |
| `entityConfig.ts` columns | ⚠️ **LEGACY** | Old components still use it |
| Manual column definitions | ❌ **REPLACED** | Auto-generated from database |

### Architecture Benefits

1. ✅ **No Code Duplication** - Formatters used by both old and new
2. ✅ **Consistent Formatting** - Same formatters = same results
3. ✅ **Gradual Migration** - Old components still work
4. ✅ **Battle-Tested Code** - Reuse proven formatters
5. ✅ **Maintainability** - One place to update formatting logic

### The Flow

```
Database Column
    ↓
schema-builder.service.ts (detects type → format.type = 'currency')
    ↓
schemaFormatters.tsx (delegates based on format.type)
    ↓
data_transform_render.tsx (OLD FORMATTER - still active!)
    ↓
Formatted Output
```

**Result**: Old formatters never die - they just get called by the new system! 🎉
