# Field Auto-Detection - Tech Lead Summary

## Current State Analysis

### ✅ What Works Well
- **Single detection function exists**: `detectFieldCategory()` in `fieldCategoryRegistry.ts` (715 LOC)
- **Pattern matching centralized**: 15+ field categories detected by name patterns
- **DRY principle applied**: One category definition → affects all fields of that type

### ⚠️ Problem: Logic Duplication Across 4 Files

**2,716 total LOC spread across:**
1. `fieldCategoryRegistry.ts` (715 LOC) - Column properties for tables
2. `columnGenerator.ts` (231 LOC) - Column generation, FK detection
3. `data_transform_render.tsx` (1,117 LOC) - Data transformation, field capabilities
4. `EntityFormContainer.tsx` (653 LOC) - Form rendering, multiple `isFooField()` functions

**Duplicate detection logic:**
```typescript
// fieldCategoryRegistry.ts
if (key.endsWith('_amt')) return FieldCategory.AMOUNT;

// EntityFormContainer.tsx
const isCurrencyField = (k) => k.endsWith('_amt') || k.endsWith('_price');

// data_transform_render.tsx
if (key.endsWith('_amt')) return { editType: 'currency' };
```

---

## Recommended Consolidation

### Single Universal Detector

```typescript
// NEW: apps/web/src/lib/fieldTypeDetector.ts (~150 LOC)

export interface FieldTypeMetadata {
  category: FieldCategory;           // Column behavior (table)
  inputType: FormInputType;          // Form input type
  editCapability: EditCapability;    // Inline edit config
  transformers: {
    toApi: (value: any) => any;      // Frontend → API
    toDisplay: (value: any) => any;  // API → Frontend
  };
  renderConfig: {
    component: ComponentType;         // DAGVisualizer, TagsInput, etc.
    width: string;
    align: 'left' | 'center' | 'right';
    format: (value: any) => string;  // Display formatting
  };
}

export function detectFieldType(fieldKey: string): FieldTypeMetadata {
  const key = fieldKey.toLowerCase();

  // Single switch/case for ALL detection
  if (key.endsWith('_amt') || key.endsWith('_price') || key.endsWith('_cost')) {
    return {
      category: FieldCategory.AMOUNT,
      inputType: 'currency',
      editCapability: { editable: true, editType: 'currency' },
      transformers: { toApi: parseCurrency, toDisplay: formatCurrency },
      renderConfig: {
        component: 'CurrencyInput',
        width: '120px',
        align: 'right',
        format: (v) => formatCurrency(v)
      }
    };
  }

  if (key.startsWith('dl__') && (key.includes('stage') || key.includes('funnel'))) {
    return {
      category: FieldCategory.LABEL,
      inputType: 'dag-select',
      editCapability: { editable: true, editType: 'select' },
      transformers: { toApi: identity, toDisplay: identity },
      renderConfig: {
        component: 'DAGVisualizer',
        width: '130px',
        align: 'left',
        format: (v) => v
      }
    };
  }

  // ... 15+ more patterns
}
```

---

## Benefits

### Before (Current)
- **4 files**, 2,716 LOC
- **Duplicate logic** in 3 places for each pattern
- **Maintenance burden**: Change `*_amt` detection? Update 3 files
- **Inconsistency risk**: Different files may detect differently

### After (Proposed)
- **1 file**, ~150 LOC core detector
- **Single source of truth** for all detection
- **Maintenance**: Change once, applies everywhere
- **Guaranteed consistency**: Same detection logic everywhere

---

## Migration Strategy

### Phase 1: Create Universal Detector (1-2 hours)
1. Create `fieldTypeDetector.ts`
2. Consolidate all pattern matching into `detectFieldType()`
3. Export single interface `FieldTypeMetadata`

### Phase 2: Refactor Consumers (2-3 hours)
1. `fieldCategoryRegistry.ts`: Import `detectFieldType()`, use `.category`
2. `columnGenerator.ts`: Use `.renderConfig` for column generation
3. `data_transform_render.tsx`: Use `.transformers` + `.editCapability`
4. `EntityFormContainer.tsx`: Use `.inputType` + `.renderConfig.component`

### Phase 3: Remove Duplication (1 hour)
1. Delete duplicate `isFooField()` functions
2. Remove redundant pattern matching
3. Update tests

**Total effort**: 4-6 hours
**LOC reduction**: 2,716 → ~800 LOC (70% reduction)

---

## Key Centralizations

| Concern | Before (4 files) | After (1 file) |
|---------|------------------|----------------|
| **Pattern detection** | `fieldCategoryRegistry.ts`, `EntityFormContainer.tsx`, `data_transform_render.tsx` | `fieldTypeDetector.ts` only |
| **Column properties** | `fieldCategoryRegistry.ts` (715 LOC) | Derived from `detectFieldType()` |
| **Form input type** | `EntityFormContainer.tsx` (multiple `isFooField()`) | `detectFieldType().inputType` |
| **Data transform** | `data_transform_render.tsx` (scattered logic) | `detectFieldType().transformers` |
| **FK detection** | `columnGenerator.ts` (separate logic) | `detectFieldType()` (pattern match) |
| **Visibility rules** | `columnGenerator.ts` (hardcoded) | `detectFieldType().renderConfig.visible` |

---

## Example: Adding New Field Type

### Before (Current - 4 file changes)
```typescript
// 1. fieldCategoryRegistry.ts
if (key.endsWith('_rating')) return FieldCategory.RATING;
FIELD_CATEGORY_REGISTRY[FieldCategory.RATING] = { width: '100px', ... };

// 2. EntityFormContainer.tsx
const isRatingField = (k) => k.endsWith('_rating');
if (isRatingField(field.key)) return <StarRating />;

// 3. data_transform_render.tsx
if (key.endsWith('_rating')) return { editType: 'rating' };

// 4. columnGenerator.ts
if (key.endsWith('_rating')) column.render = renderStars;
```

### After (Proposed - 1 file change)
```typescript
// fieldTypeDetector.ts ONLY
if (key.endsWith('_rating')) {
  return {
    category: FieldCategory.RATING,
    inputType: 'star-rating',
    editCapability: { editable: true, editType: 'rating' },
    transformers: { toApi: identity, toDisplay: identity },
    renderConfig: { component: 'StarRating', width: '100px', ... }
  };
}
// Done! All consumers automatically use it
```

---

## Recommendation

**Priority**: HIGH
**Effort**: 4-6 hours
**ROI**: 70% code reduction, eliminates maintenance burden

**Action Items:**
1. ✅ Approve consolidation approach
2. Create `fieldTypeDetector.ts` with universal `detectFieldType()`
3. Migrate consumers one by one (can be done incrementally)
4. Remove duplicate code
5. Update documentation

**Risk**: LOW (can migrate incrementally, test each consumer separately)

---

**Last Updated**: 2025-11-11
**Status**: Proposal - Awaiting approval
