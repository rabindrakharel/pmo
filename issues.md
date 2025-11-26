# Critical Plumbing Issues: Backend-to-Frontend Metadata Coupling

**Date**: 2025-11-26
**Review Scope**: Metadata flow from `backend-formatter.service.ts` to UI components
**Severity Scale**: P0 (Critical), P1 (High), P2 (Medium), P3 (Low)

---

## Summary

The metadata coupling implementation reveals several architectural issues that cause silent failures, type safety gaps, and maintenance complexity. The v8.1.0 fix addressed the primary path mismatch but exposed deeper structural problems.

---

## Issue 1: Property Name Inconsistency in ViewMetadata

**Severity**: P1 (High)
**Location**: Backend → Frontend rendering

### Problem

Backend sends `renderType` but frontend code checks multiple property names with fallback chains:

```typescript
// Backend (backend-formatter.service.ts:539)
const view: ViewMetadata = {
  renderType: componentConfig.renderType || resolved.renderType || fieldBusinessType,
  ...
};

// Frontend (EntityFormContainer.tsx:177)
const renderType = viewMeta.renderType ?? viewMeta.viewType ?? viewMeta.format;

// Frontend (EntityDataTable.tsx columns useMemo)
const viewType = viewMeta.viewType ?? viewMeta.renderType ?? 'text';
```

### Impact
- Silent fallback chains mask missing metadata
- Developers unsure which property to use
- Legacy code uses `viewType`, new code uses `renderType`

### Recommendation
1. Standardize on `renderType` everywhere
2. Remove `viewType` and `format` fallbacks after migration
3. Add deprecation warnings when legacy properties detected

---

## Issue 2: Nested Style Property Access

**Severity**: P1 (High)
**Location**: `backend-formatter.service.ts` → `EntityDataTable.tsx`, `EntityFormContainer.tsx`

### Problem

Backend nests display properties in `style` object, but some frontend code expects flat access:

```typescript
// Backend sends (line 538-544)
view: {
  style: {
    width?: string;
    align?: 'left' | 'right' | 'center';
    symbol?: string;
    decimals?: number;
  }
}

// Frontend SOMETIMES expects flat
const width = viewMeta.width ?? viewMeta.style?.width;
const align = viewMeta.align ?? viewMeta.style?.align;
```

### Impact
- Currency fields missing `$` symbol if accessed wrong
- Date fields missing format string
- Column widths defaulting instead of using configured values

### Files Affected
- `EntityDataTable.tsx:columns useMemo` - needs consistent style access
- `valueFormatters.ts` - may expect flat properties
- `frontEndFormatterService.tsx` - renderer functions

### Recommendation
1. Update all frontend code to read from `style` object
2. Create helper: `getStyleProp(meta, 'width')` that handles both patterns
3. Remove flat property support after migration

---

## Issue 3: Heavy Type Coercion (`as any`)

**Severity**: P2 (Medium)
**Location**: Throughout frontend components

### Problem

After the v8.1.0 fix, code uses `as any` extensively to bypass TypeScript:

```typescript
// EntityFormContainer.tsx:157-158
.filter(([_, fieldMeta]: [string, any]) => {
  const visible = fieldMeta.behavior?.visible ?? fieldMeta.visible ?? true;

// EntityDataTable.tsx columns
const viewMeta = viewType[fieldKey] as any;
const editMeta = editType?.[fieldKey] as any;
```

### Impact
- No compile-time type checking for metadata access
- Silent runtime failures when properties missing
- Refactoring becomes dangerous

### Recommendation
1. Create discriminated union types:
```typescript
type ResolvedViewMeta = ViewFieldMetadata | LegacyFieldMetadata;
function isLegacyMeta(m: ResolvedViewMeta): m is LegacyFieldMetadata {
  return !('behavior' in m);
}
```
2. Remove `as any` casts after creating proper type guards

---

## Issue 4: Validation Rules Not Consumed

**Severity**: P1 (High)
**Location**: `backend-formatter.service.ts` → Form components

### Problem

Backend generates validation rules in `editType.validation`, but frontend forms don't read them:

```typescript
// Backend sends (line 86-87)
editType: {
  validation: {
    required?: boolean;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  }
}

// Frontend EntityFormContainer - NO validation consumption
// Form fields rendered without validation constraints
```

### Impact
- Invalid data can be submitted
- Min/max constraints ignored
- Required fields not enforced client-side
- Pattern validation not applied

### Recommendation
1. Read `editMeta.validation` in form field rendering
2. Pass to input components: `<input min={validation.min} required={validation.required} />`
3. Add client-side validation before submit

---

## Issue 5: Component vs viz_container Naming Mismatch

**Severity**: P2 (Medium)
**Location**: Backend metadata → Form rendering

### Problem

Backend uses `component` field for special renderers, frontend expects `EntityFormContainer_viz_container`:

```typescript
// Backend ViewMetadata (line 114)
component?: string;  // 'DAGVisualizer', 'MetadataTable', etc.

// Frontend EntityFormContainer.tsx:176
let vizContainer = viewMeta.EntityFormContainer_viz_container ?? editMeta?.component;
```

### Impact
- Special components like DAGVisualizer may not render
- Requires double fallback check
- Confusing naming convention

### Recommendation
1. Standardize on `component` (matches backend)
2. Remove `EntityFormContainer_viz_container` after migration
3. Document component name registry

---

## Issue 6: Legacy Fallback Metadata in Frontend

**Severity**: P2 (Medium)
**Location**: `EntityDataTable.tsx:58-74`

### Problem

Frontend `createFallbackMetadata()` returns OLD flat structure, not new nested format:

```typescript
// Returns legacy flat structure
function createFallbackMetadata(columnKey: string): BackendFieldMetadata {
  return {
    key: columnKey,
    renderType: 'text',
    inputType: 'text',
    visible: { EntityDataTable: true, ... },  // OLD format
    editable: true,
    align: 'left'
  };
}
```

### Impact
- When backend metadata missing, fallback is incompatible format
- Component must handle TWO different structures
- `visible` object format differs from new `behavior.visible` boolean

### Recommendation
1. Update fallback to return new nested format:
```typescript
function createFallbackMetadata(columnKey: string) {
  return {
    viewType: { [columnKey]: { behavior: { visible: true }, style: {} } },
    editType: { [columnKey]: { behavior: { editable: true }, validation: {} } }
  };
}
```

---

## Issue 7: Datalabel Key Naming Inconsistency

**Severity**: P2 (Medium)
**Location**: Multiple files

### Problem

Different names used for datalabel lookup key:

```typescript
// Backend editType (line 91)
datalabelKey?: string;

// Frontend types.ts ViewFieldMetadata (line 52)
settingsDatalabel?: string;

// Frontend EntityFormContainer.tsx:173
const datalabelKey = editMeta?.datalabelKey ?? viewMeta.datalabelKey ?? viewMeta.settingsDatalabel;
```

### Impact
- Triple fallback chain for one concept
- New code uses `datalabelKey`, old code uses `settingsDatalabel`
- Confusion about which to use

### Recommendation
1. Standardize on `datalabelKey` (matches backend)
2. Deprecate `settingsDatalabel`
3. Update type definitions to remove duplicate

---

## Issue 8: Cache Store Key Format Assumptions

**Severity**: P2 (Medium)
**Location**: `entityComponentMetadataStore.ts`

### Problem

Store uses `entityCode:componentName` key format but doesn't validate inputs:

```typescript
// Store key construction (line 138)
const cacheKey = `${entityCode}:${componentName}`;

// No validation that:
// - entityCode is lowercase
// - componentName matches ComponentName type
// - No special characters that could collide
```

### Impact
- Cache misses if casing differs
- Potential key collisions
- No type safety on cache keys

### Recommendation
1. Normalize keys: `${entityCode.toLowerCase()}:${componentName}`
2. Add validation on set/get
3. Create typed cache key type: `${EntityCode}:${ComponentName}`

---

## Issue 9: Documentation vs Implementation Mismatch

**Severity**: P3 (Low)
**Location**: `backend-formatter.service.ts` header comments

### Problem

API output structure in docs uses `type`, actual code uses `renderType`:

```typescript
// Documentation (lines 28-35)
*       "viewType": {
*         "budget_allocated_amt": {
*           "type": "currency",              // ← Documentation says "type"

// Actual code (line 539)
const view: ViewMetadata = {
  renderType: componentConfig.renderType || ...  // ← Code uses "renderType"
```

### Impact
- Developers following docs get wrong property name
- API consumers confused

### Recommendation
1. Update documentation to match implementation
2. Add API response examples in tests that verify structure

---

## Issue 10: YAML Mapping Files Not Validated at Startup

**Severity**: P3 (Low)
**Location**: `backend-formatter.service.ts:378-403`

### Problem

YAML mapping files loaded lazily with no schema validation:

```typescript
function loadPatternMapping(): PatternMappingYaml {
  if (!_patternMapping) {
    const content = readFileSync(filePath, 'utf-8');
    _patternMapping = yaml.load(content) as PatternMappingYaml;  // No validation!
  }
  return _patternMapping;
}
```

### Impact
- Malformed YAML causes runtime errors on first API call
- Missing required fields silently fail
- Type assertion hides invalid structure

### Recommendation
1. Add Zod/Joi schema validation on load
2. Validate at server startup, fail fast
3. Add YAML file validation to CI

---

## Quick Reference: Property Name Mapping

| Concept | Backend Property | Frontend Expected | Status |
|---------|-----------------|-------------------|--------|
| Display type | `renderType` | `renderType`/`viewType`/`format` | INCONSISTENT |
| Input type | `inputType` | `inputType`/`editType`/`type` | INCONSISTENT |
| Visible | `behavior.visible` | `behavior?.visible`/`visible` | FIXED (needs cleanup) |
| Editable | `behavior.editable` | `behavior?.editable`/`editable` | FIXED (needs cleanup) |
| Width | `style.width` | `style?.width`/`width` | INCONSISTENT |
| Datalabel | `datalabelKey` | `datalabelKey`/`settingsDatalabel` | INCONSISTENT |
| Component | `component` | `component`/`viz_container` | INCONSISTENT |

---

## Recommended Fix Order

1. **P1 Issues First** (1, 2, 4): Critical for correct rendering and data integrity
2. **P2 Issues Next** (3, 5, 6, 7, 8): Improve type safety and maintainability
3. **P3 Issues Last** (9, 10): Documentation and robustness improvements

---

## Files Requiring Changes

| File | Issues | Priority |
|------|--------|----------|
| `apps/web/src/lib/formatters/types.ts` | 1, 7 | P1 |
| `apps/web/src/components/shared/ui/EntityDataTable.tsx` | 1, 2, 3, 6 | P1 |
| `apps/web/src/components/shared/entity/EntityFormContainer.tsx` | 1, 2, 3, 4, 5 | P1 |
| `apps/web/src/lib/frontEndFormatterService.tsx` | 2, 4 | P1 |
| `apps/api/src/services/backend-formatter.service.ts` | 9, 10 | P3 |
| `apps/web/src/stores/entityComponentMetadataStore.ts` | 8 | P2 |
