# Field Detection Consolidation Proposal

**Date:** 2025-01-17
**Status:** Proposed
**Impact:** Medium (Technical Debt Reduction)
**Effort:** 2-3 hours

---

## Problem Statement

The PMO codebase currently has **duplicate field detection logic** across two separate services, leading to:

1. **Code Duplication**: ~300 lines of identical pattern matching logic
2. **Maintenance Burden**: Changes must be made in two places
3. **Confusion**: Developers unsure which service to use
4. **Dead Code**: `detectFieldFormat()` exists but is never imported/used
5. **Inconsistency Risk**: Diverging logic could cause UI bugs

### Evidence of Duplication

Both services detect field types using **identical pattern matching**:

| Pattern | universalFormatterService.detectFieldFormat() | universalFieldDetector.detectField() |
|---------|----------------------------------------------|-------------------------------------|
| `*_amt` | `type: 'currency'` | `renderType: 'currency'` |
| `*_pct` | `type: 'percentage'` | `renderType: 'percentage'` |
| `dl__*` | `type: 'badge'` | `renderType: 'badge'` |
| `*_flag` | `type: 'boolean'` | `renderType: 'boolean'` |
| `*_ts` | `type: 'timestamp'` | `renderType: 'timestamp'` |
| `*_date` | `type: 'date'` | `renderType: 'date'` |

---

## Current Architecture (Flawed)

```
┌─────────────────────────────────────────────────────────────────┐
│ universalFormatterService.ts                                     │
├─────────────────────────────────────────────────────────────────┤
│ ❌ detectFieldFormat()      // NEVER USED! Dead code            │
│    - Has pattern matching logic                                  │
│    - Returns: { type, label, editType }                          │
│                                                                  │
│ ✅ formatCurrency()          // ACTIVELY USED                   │
│ ✅ formatRelativeTime()                                         │
│ ✅ renderSettingBadge()                                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ universalFieldDetector.ts                                        │
├─────────────────────────────────────────────────────────────────┤
│ ✅ detectField()             // ACTIVELY USED                   │
│    - Has DUPLICATE pattern matching logic                        │
│    - Returns: { renderType, inputType, format }                 │
│    - Used by: EntityFormContainer, viewConfigGenerator          │
└─────────────────────────────────────────────────────────────────┘

        ↓ DUPLICATION ↓
Both check: *_amt → currency
Both check: *_pct → percentage
Both check: dl__* → badge
Both check: *_flag → boolean
```

---

## Code Examples

### Current State: Duplicate Logic

**File 1:** `universalFormatterService.ts:192-209` (UNUSED)
```typescript
export function detectFieldFormat(columnName: string, dataType: string): FieldFormat {
  // ⚠️ DUPLICATE: Same pattern as detectField()
  if (FIELD_PATTERNS.currency.test(columnName)) {
    return {
      type: 'currency',
      label: generateFieldLabel(columnName),
      width: '120px',
      align: 'right',
      editable: true,
      editType: 'number'
    };
  }

  if (FIELD_PATTERNS.percentage.test(columnName)) {
    return {
      type: 'percentage',
      label: generateFieldLabel(columnName),
      width: '100px',
      align: 'right',
      editable: true,
      editType: 'number'
    };
  }
  // ... 200+ more lines of duplicate patterns
}

// ❌ PROBLEM: This function is exported but NEVER imported anywhere!
```

**File 2:** `universalFieldDetector.ts:336-409` (ACTIVELY USED)
```typescript
export function detectField(fieldKey: string, dataType?: string): UniversalFieldMetadata {
  const key = fieldKey.toLowerCase();

  // ⚠️ DUPLICATE: Same pattern matching logic!
  if (PATTERNS.currency.regex.test(key)) {
    return {
      fieldName: memoizedFieldTitle(fieldKey),
      visible: true,
      sortable: true,
      width: '120px',
      align: 'right',
      format: formatCurrency,  // ← Uses formatter service here
      renderType: 'currency',
      inputType: 'currency',
      editable: true,
      editType: 'currency',
      pattern: 'CURRENCY',
      category: 'financial'
    };
  }

  if (PATTERNS.percentage.regex.test(key)) {
    return {
      fieldName: memoizedFieldTitle(fieldKey),
      visible: true,
      sortable: true,
      width: '100px',
      align: 'right',
      format: formatPercentage,  // ← Uses formatter service here
      renderType: 'percentage',
      inputType: 'number',
      editable: true,
      pattern: 'PERCENTAGE',
      category: 'financial'
    };
  }
  // ... 200+ more lines of duplicate patterns
}
```

### Usage Analysis

```bash
# detectFieldFormat usage:
$ grep -r "detectFieldFormat" apps/web/src --include="*.tsx"
# Result: 0 matches (NEVER USED!)

# detectField usage:
$ grep -r "detectField" apps/web/src --include="*.tsx"
# Result: 13 matches across 3 critical files:
#   - EntityFormContainer.tsx
#   - viewConfigGenerator.ts
#   - ColumnMetadataEditor.tsx
```

---

## Proposed Solution

### Architecture: Single Source of Truth

```
┌────────────────────────────────────────────────────────────────┐
│ NEW: universalFormatterService.ts (Consolidated)              │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 1. PATTERN DETECTION (Single Source)                     │ │
│ │    detectFieldType(columnName) → FieldTypeInfo          │ │
│ │    - Centralized pattern matching                        │ │
│ │    - Returns: type, category, isReadonly                 │ │
│ └──────────────────────────────────────────────────────────┘ │
│                           ↓                                    │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 2. METADATA GENERATION (For Views)                       │ │
│ │    generateFieldMetadata(columnName) → FieldMetadata     │ │
│ │    - Calls detectFieldType()                             │ │
│ │    - Adds: width, align, visible, sortable              │ │
│ └──────────────────────────────────────────────────────────┘ │
│                           ↓                                    │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 3. VALUE FORMATTING (Display)                            │ │
│ │    formatFieldValue(value, type) → string                │ │
│ │    - formatCurrency(), formatRelativeTime(), etc.        │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                                │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ DEPRECATED: universalFieldDetector.ts                         │
├────────────────────────────────────────────────────────────────┤
│ ❌ Remove detectField() → Use generateFieldMetadata()        │
│ ❌ Remove duplicate pattern logic                             │
│ ✅ Keep optimizations (caching, memoization)                 │
└────────────────────────────────────────────────────────────────┘
```

### Implementation Plan

**Step 1: Add Core Detection Function to universalFormatterService.ts**

```typescript
// ============================================================================
// CORE: Field Type Detection (Single Source of Truth)
// ============================================================================

export interface FieldTypeInfo {
  type: 'currency' | 'percentage' | 'badge' | 'boolean' | 'timestamp' | 'date' | 'text';
  category: 'financial' | 'temporal' | 'system' | 'settings' | 'general';
  isReadonly: boolean;
  pattern: string;
}

/**
 * Detect field type from column name (Single Source of Truth)
 *
 * @example
 * detectFieldType('budget_allocated_amt')
 * // → { type: 'currency', category: 'financial', isReadonly: false }
 */
export function detectFieldType(columnName: string): FieldTypeInfo {
  const key = columnName.toLowerCase();
  const isReadonly = READONLY_FIELDS.has(key);

  // Pattern matching (ONE place only)
  if (FIELD_PATTERNS.currency.test(key)) {
    return {
      type: 'currency',
      category: 'financial',
      isReadonly,
      pattern: 'CURRENCY'
    };
  }

  if (FIELD_PATTERNS.percentage.test(key)) {
    return {
      type: 'percentage',
      category: 'financial',
      isReadonly,
      pattern: 'PERCENTAGE'
    };
  }

  if (FIELD_PATTERNS.settings.test(key)) {
    return {
      type: 'badge',
      category: 'settings',
      isReadonly,
      pattern: 'SETTINGS'
    };
  }

  if (FIELD_PATTERNS.boolean.test(key)) {
    return {
      type: 'boolean',
      category: 'general',
      isReadonly,
      pattern: 'BOOLEAN'
    };
  }

  if (FIELD_PATTERNS.timestamp.test(key)) {
    return {
      type: 'timestamp',
      category: 'temporal',
      isReadonly: true,  // Timestamps always readonly
      pattern: 'TIMESTAMP'
    };
  }

  if (FIELD_PATTERNS.date.test(key)) {
    return {
      type: 'date',
      category: 'temporal',
      isReadonly,
      pattern: 'DATE'
    };
  }

  return {
    type: 'text',
    category: 'general',
    isReadonly,
    pattern: 'TEXT'
  };
}
```

**Step 2: Add Metadata Generation (Replaces universalFieldDetector)**

```typescript
// ============================================================================
// VIEW METADATA: Generate complete field metadata for UI components
// ============================================================================

export interface UniversalFieldMetadata {
  fieldName: string;
  type: FieldTypeInfo['type'];
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
  searchable: boolean;
  width: string;
  align: 'left' | 'center' | 'right';
  editable: boolean;
  editType: 'text' | 'number' | 'currency' | 'select' | 'checkbox' | 'readonly';
  renderType: 'text' | 'badge' | 'currency' | 'timestamp';
  inputType: 'text' | 'number' | 'select' | 'checkbox' | 'readonly';
  category: FieldTypeInfo['category'];
  pattern: string;

  // Formatting functions
  format: (value: any) => string | React.ReactNode;
  toApi: (value: any) => any;
  toDisplay: (value: any) => any;

  // Settings integration
  loadFromSettings?: boolean;
  settingsDatalabel?: string;
}

/**
 * Generate complete field metadata for UI components
 * Replaces: universalFieldDetector.detectField()
 *
 * @example
 * generateFieldMetadata('budget_allocated_amt')
 * // → { fieldName: 'Budget Allocated', type: 'currency', format: fn, ... }
 */
export function generateFieldMetadata(
  columnName: string,
  dataType?: string
): UniversalFieldMetadata {
  const typeInfo = detectFieldType(columnName);  // ← Single source
  const label = generateFieldLabel(columnName);
  const isInvisible = isInvisibleField(columnName);

  // Base metadata
  const base = {
    fieldName: label,
    type: typeInfo.type,
    visible: !isInvisible,
    sortable: true,
    filterable: true,
    searchable: typeInfo.type === 'text',
    editable: !typeInfo.isReadonly,
    category: typeInfo.category,
    pattern: typeInfo.pattern
  };

  // Type-specific configurations
  switch (typeInfo.type) {
    case 'currency':
      return {
        ...base,
        width: '120px',
        align: 'right',
        renderType: 'currency',
        inputType: 'currency',
        editType: 'currency',
        format: formatCurrency,
        toApi: (v) => parseFloat(v) || 0,
        toDisplay: (v) => v
      };

    case 'percentage':
      return {
        ...base,
        width: '100px',
        align: 'right',
        renderType: 'text',
        inputType: 'number',
        editType: 'number',
        format: formatPercentage,
        toApi: (v) => parseFloat(v) || 0,
        toDisplay: (v) => v
      };

    case 'badge':
      return {
        ...base,
        width: '150px',
        align: 'center',
        renderType: 'badge',
        inputType: 'select',
        editType: 'select',
        format: (v) => renderSettingBadge(columnName, v),
        toApi: (v) => v,
        toDisplay: (v) => v,
        loadFromSettings: true,
        settingsDatalabel: columnName.replace('dl__', '')
      };

    case 'boolean':
      return {
        ...base,
        width: '100px',
        align: 'center',
        renderType: 'badge',
        inputType: 'checkbox',
        editType: 'checkbox',
        format: formatBooleanBadge,
        toApi: (v) => Boolean(v),
        toDisplay: (v) => v
      };

    case 'timestamp':
      return {
        ...base,
        width: '150px',
        align: 'left',
        renderType: 'timestamp',
        inputType: 'readonly',
        editType: 'readonly',
        format: formatRelativeTime,
        toApi: (v) => v,
        toDisplay: (v) => v,
        editable: false
      };

    case 'date':
      return {
        ...base,
        width: '120px',
        align: 'center',
        renderType: 'text',
        inputType: 'date',
        editType: 'date',
        format: formatFriendlyDate,
        toApi: (v) => v,
        toDisplay: (v) => v
      };

    default: // text
      return {
        ...base,
        width: '200px',
        align: 'left',
        renderType: 'text',
        inputType: 'text',
        editType: 'text',
        format: (v) => String(v || ''),
        toApi: (v) => v,
        toDisplay: (v) => v
      };
  }
}
```

**Step 3: Update viewConfigGenerator.ts (Minimal Change)**

```typescript
// BEFORE: Used universalFieldDetector
import { detectField } from './universalFieldDetector';

export function generateFormConfig(fieldKeys: string[]) {
  return fieldKeys.map(key => detectField(key));  // Old way
}

// AFTER: Use universalFormatterService
import { generateFieldMetadata } from './universalFormatterService';

export function generateFormConfig(fieldKeys: string[]) {
  return fieldKeys.map(key => generateFieldMetadata(key));  // New way - ONE LINE CHANGE!
}
```

**Step 4: Update EntityFormContainer.tsx**

```typescript
// BEFORE: Multiple imports
import { formatCurrency, formatRelativeTime } from '../../../lib/universalFormatterService';
import { detectField } from '../../../lib/universalFieldDetector';

// AFTER: Single import
import {
  generateFieldMetadata,
  formatCurrency,
  formatRelativeTime
} from '../../../lib/universalFormatterService';

// Usage stays the same - just source changes
const fields = useMemo(() => {
  if (autoGenerateFields && Object.keys(data).length > 0) {
    return Object.keys(data).map(key => generateFieldMetadata(key));
  }
  return [];
}, [autoGenerateFields, data]);
```

**Step 5: Remove Dead Code**

```typescript
// DELETE from universalFormatterService.ts
// ❌ Remove: detectFieldFormat() (lines 192-300)
//    Reason: Never imported, fully replaced by generateFieldMetadata()

// DELETE file: universalFieldDetector.ts
// ❌ Remove entire file
//    Reason: All functionality moved to universalFormatterService
//    Keep: Caching/memoization logic if needed (copy to formatter service)
```

---

## Migration Example

### Before: Product Detail Page (Current)

```typescript
// apps/web/src/lib/viewConfigGenerator.ts
import { detectField } from './universalFieldDetector';  // ← Separate service

export function generateFormConfig(fieldKeys: string[]) {
  const fields = fieldKeys.map(key => {
    const meta = detectField(key);  // ← Detection in separate file
    return {
      key,
      label: meta.fieldName,
      type: meta.inputType,
      editable: meta.editable
    };
  });
  return { editableFields: fields };
}

// Problem: Pattern logic duplicated across 2 files
// - universalFieldDetector.ts (detection)
// - universalFormatterService.ts (unused detectFieldFormat)
```

### After: Product Detail Page (Consolidated)

```typescript
// apps/web/src/lib/viewConfigGenerator.ts
import { generateFieldMetadata } from './universalFormatterService';  // ← Single service

export function generateFormConfig(fieldKeys: string[]) {
  const fields = fieldKeys.map(key => {
    const meta = generateFieldMetadata(key);  // ← All logic in ONE place
    return {
      key,
      label: meta.fieldName,
      type: meta.inputType,
      editable: meta.editable
    };
  });
  return { editableFields: fields };
}

// Benefits:
// ✅ ONE source of truth for field detection
// ✅ NO duplicate pattern matching
// ✅ Formatting functions in same service
// ✅ Easier to maintain/extend
```

---

## Benefits

### Code Quality
- ✅ **-300 lines**: Remove duplicate pattern matching
- ✅ **-1 file**: Delete universalFieldDetector.ts
- ✅ **Single Source**: All detection logic in one place
- ✅ **Consistency**: Impossible for detection logic to diverge

### Developer Experience
- ✅ **Clear API**: One function to detect, one to format
- ✅ **Easy Discovery**: All field logic in universalFormatterService
- ✅ **Less Confusion**: No more "which service do I use?"
- ✅ **Better Types**: Shared FieldTypeInfo interface

### Maintainability
- ✅ **Add New Pattern Once**: Change in one place
- ✅ **Easier Testing**: One function to test
- ✅ **Clearer Documentation**: Single service to document

### Example: Adding New Field Type

**BEFORE (Current - Change 2 Files):**
```typescript
// File 1: universalFieldDetector.ts
if (PATTERNS.phone.regex.test(key)) {
  return { renderType: 'phone', inputType: 'tel', ... };
}

// File 2: universalFormatterService.ts
if (FIELD_PATTERNS.phone.test(key)) {
  return { type: 'phone', editType: 'tel', ... };
}
// ⚠️ Easy to forget one file → inconsistency!
```

**AFTER (Proposed - Change 1 Function):**
```typescript
// universalFormatterService.ts - detectFieldType()
if (FIELD_PATTERNS.phone.test(key)) {
  return { type: 'phone', category: 'contact', isReadonly: false };
}

// generateFieldMetadata() automatically handles it:
case 'phone':
  return {
    ...base,
    format: formatPhoneNumber,  // ← Same service!
    editType: 'tel'
  };
// ✅ Change once, works everywhere!
```

---

## Testing Plan

### Unit Tests
```typescript
describe('generateFieldMetadata', () => {
  it('detects currency fields', () => {
    const meta = generateFieldMetadata('budget_allocated_amt');
    expect(meta.type).toBe('currency');
    expect(meta.format(50000)).toBe('$50,000.00');
  });

  it('detects badge fields', () => {
    const meta = generateFieldMetadata('dl__project_stage');
    expect(meta.type).toBe('badge');
    expect(meta.loadFromSettings).toBe(true);
  });

  it('detects timestamp fields', () => {
    const meta = generateFieldMetadata('created_ts');
    expect(meta.type).toBe('timestamp');
    expect(meta.editable).toBe(false);
  });
});
```

### Integration Tests
```typescript
describe('Product detail page', () => {
  it('auto-generates form fields', async () => {
    const response = await api.get('/api/v1/product/uuid');
    const fieldKeys = Object.keys(response.data);

    const fields = fieldKeys.map(generateFieldMetadata);

    expect(fields.find(f => f.fieldName === 'Reorder Level Qty')).toBeTruthy();
    expect(fields.find(f => f.type === 'boolean')).toBeTruthy();
  });
});
```

---

## Implementation Checklist

- [ ] **Phase 1: Add New Functions** (Non-breaking)
  - [ ] Add `detectFieldType()` to universalFormatterService.ts
  - [ ] Add `generateFieldMetadata()` to universalFormatterService.ts
  - [ ] Export new functions alongside existing ones
  - [ ] Write unit tests

- [ ] **Phase 2: Update Consumers** (Breaking changes)
  - [ ] Update viewConfigGenerator.ts to use `generateFieldMetadata()`
  - [ ] Update EntityFormContainer.tsx imports
  - [ ] Update ColumnMetadataEditor.tsx imports
  - [ ] Test all entity detail pages (product, quote, work_order, etc.)

- [ ] **Phase 3: Cleanup** (Remove dead code)
  - [ ] Delete `detectFieldFormat()` from universalFormatterService.ts
  - [ ] Delete universalFieldDetector.ts file
  - [ ] Update documentation
  - [ ] Remove unused imports

- [ ] **Phase 4: Documentation**
  - [ ] Update CLAUDE.md with new architecture
  - [ ] Update API documentation
  - [ ] Add examples to docs/services/

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Break existing forms | High | Thorough testing of all entity pages before deployment |
| Performance regression | Low | Copy memoization/caching from universalFieldDetector |
| Import errors | Medium | Update all imports in single commit, test build |
| Type mismatches | Low | Strong TypeScript types, compile-time checks |

---

## Timeline

- **Estimated Effort**: 2-3 hours
- **Phase 1 (Add)**: 30 minutes
- **Phase 2 (Migrate)**: 60 minutes
- **Phase 3 (Cleanup)**: 15 minutes
- **Phase 4 (Testing)**: 45 minutes

---

## Conclusion

This consolidation eliminates 300+ lines of duplicate code, removes unused functions, and creates a single source of truth for field detection. The migration is straightforward (mostly import changes) and significantly improves code maintainability.

**Recommendation:** Proceed with implementation. The benefits far outweigh the migration effort.

---

## References

- Current Code:
  - `apps/web/src/lib/universalFormatterService.ts` (lines 192-300)
  - `apps/web/src/lib/universalFieldDetector.ts` (lines 336-647)
  - `apps/web/src/lib/viewConfigGenerator.ts` (line 105, 147, 233)

- Related Documentation:
  - `docs/services/UNIVERSAL_FORMATTER_SERVICE.md`
  - `CLAUDE.md` (Universal Formatter Service section)

- Similar Patterns:
  - Backend: `universal-filter-builder.ts` (single detection function)
  - Backend: `entity-infrastructure.service.ts` (centralized operations)
