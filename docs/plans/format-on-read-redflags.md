# 🚨 RED FLAGS: Backend-Frontend Metadata Compatibility Issues

**Created:** 2025-11-25 | **Status:** ✅ RESOLVED | **Severity:** Was CRITICAL

---

## Executive Summary

~~The backend metadata response structure does not match what the frontend expects.~~

**RESOLVED (v3.0.0):** Backend and frontend now use consistent naming:
- Container names: `viewType`, `editType`
- Property names inside: `renderType`, `inputType`

---

## Issue Tracker

| # | Issue | Severity | Status | Resolution |
|---|-------|----------|--------|------------|
| 1 | Property name mismatch (`type` vs `renderType`/`inputType`) | 🔴 CRITICAL | ✅ RESOLVED | Backend fixed |
| 2 | Frontend property names (`viewType`/`editType` vs `renderType`/`inputType`) | 🔴 CRITICAL | ✅ RESOLVED | Frontend fixed |
| 3 | Edit mode broken (`inputType` undefined) | 🔴 CRITICAL | ✅ RESOLVED | Fixed with #1 |
| 4 | Lookup source mismatch | 🟡 MEDIUM | ✅ RESOLVED | Frontend renamed to match backend |
| 5 | Style properties nested differently | 🟡 MEDIUM | ⏳ PENDING | Flatten or adapt |

---

## ✅ RESOLVED: Issue #1 - Backend Property Name

### Problem (Was)

Backend used `type:` property in code but interfaces defined `renderType`/`inputType`.

### Resolution

**File:** `apps/api/src/services/backend-formatter.service.ts`

All occurrences of `type:` changed to `renderType:` or `inputType:`:

| Line | Before | After | Status |
|------|--------|-------|--------|
| 540 | `type: componentConfig.renderType...` | `renderType: componentConfig.renderType...` | ✅ |
| 596 | `type: componentConfig?.inputType...` | `inputType: componentConfig?.inputType...` | ✅ |
| 1678 | `type: config.renderType \|\| 'text'` | `renderType: config.renderType \|\| 'text'` | ✅ |
| 1690 | `type: config.inputType \|\| 'text'` | `inputType: config.inputType \|\| 'text'` | ✅ |
| 1751 | `type: fieldBusinessType` | `renderType: fieldBusinessType` | ✅ |
| 1758 | `type: fieldBusinessType` | `inputType: fieldBusinessType` | ✅ |
| 1799 | `type: 'text'` | `renderType: 'text'` | ✅ |
| 1811 | `type: 'text'` | `inputType: 'text'` | ✅ |
| 1843 | `type: componentRule.viewType...` | `renderType: componentRule.viewType...` | ✅ |
| 1854 | `type: componentRule.editType...` | `inputType: componentRule.editType...` | ✅ |

---

## ✅ RESOLVED: Issue #2 - Frontend Property Names

### Problem (Was)

Frontend used `viewType`/`editType` as property names, but backend sends `renderType`/`inputType` inside containers.

### Resolution

Updated all frontend files to use `renderType`/`inputType`:

| File | Before | After | Status |
|------|--------|-------|--------|
| `types.ts` | `viewType?: string` | `renderType?: string` | ✅ |
| `types.ts` | `editType?: string` | `inputType?: string` | ✅ |
| `datasetFormatter.ts` | `metadata?.viewType` | `metadata?.renderType` | ✅ |
| `api-factory.ts` | `viewType: string` | `renderType: string` | ✅ |
| `api-factory.ts` | `editType: string` | `inputType: string` | ✅ |
| `frontEndFormatterService.tsx` | `metadata.editType` | `metadata.inputType` | ✅ |

---

## ✅ RESOLVED: Issue #3 - Edit Mode

### Problem (Was)

Frontend `switch(metadata.inputType)` received `undefined` because property name was wrong.

### Resolution

Fixed automatically when Issue #1 and #2 were resolved. Now:
- Backend sends `inputType: "number"` in editType container
- Frontend reads `metadata.inputType` correctly

---

## Current API Response Structure (Correct)

```json
{
  "metadata": {
    "entityDataTable": {
      "viewType": {
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "renderType": "currency",
          "behavior": { "visible": true },
          "style": { "symbol": "$" }
        }
      },
      "editType": {
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "inputType": "number",
          "behavior": { "editable": true },
          "style": { "symbol": "$" }
        }
      }
    }
  }
}
```

---

## ✅ RESOLVED: Issue #4 - Lookup Source Properties

### Problem (Was)

| Backend Property | Frontend Property | Match |
|------------------|-------------------|-------|
| `lookupSource: "datalabel"` | `loadFromDataLabels: boolean` | ❌ NO |
| `lookupSource: "entityInstance"` | `loadFromEntity: string` | ❌ NO |
| `datalabelKey: "dl__project_stage"` | `datalabelKey: string` | ✅ YES |
| `lookupEntity: "employee"` | `loadFromEntity: string` | 🟡 PARTIAL |

### Resolution

Frontend property names changed to match backend exactly:

| Backend Property | Frontend Property (New) | Match |
|------------------|-------------------------|-------|
| `lookupSource: 'datalabel' \| 'entityInstance'` | `lookupSource: 'datalabel' \| 'entityInstance'` | ✅ YES |
| `lookupEntity: "employee"` | `lookupEntity: string` | ✅ YES |
| `datalabelKey: "dl__project_stage"` | `datalabelKey: string` | ✅ YES |

**Files Updated:**

| File | Old Property | New Property |
|------|--------------|--------------|
| `types.ts` | `loadFromDataLabels`, `loadFromEntity` | `lookupSource`, `lookupEntity` |
| `api-factory.ts` | `loadFromDataLabels`, `loadFromEntity` | `lookupSource`, `lookupEntity` |
| `frontEndFormatterService.tsx` | `loadFromDataLabels`, `loadFromEntity` | `lookupSource`, `lookupEntity` |
| `entityComponentMetadataStore.ts` | `loadFromDataLabels`, `loadFromEntity` | `lookupSource`, `lookupEntity` |
| `EntityFormContainer.tsx` | `loadFromDataLabels`, `loadFromEntity` | `lookupSource`, `lookupEntity` |
| `EntityFormContainerWithStore.tsx` | `loadFromDataLabels`, `loadFromEntity` | `lookupSource`, `lookupEntity` |
| `EntityDataTable.tsx` | `loadFromDataLabels`, `loadFromEntity` | `lookupSource`, `lookupEntity` |

**Backward Compatibility:** Column interface maintains deprecated `loadDataLabels` and `loadFromEntity` properties for backward compatibility.

### Status: ✅ RESOLVED

---

## MEDIUM ISSUE #5: Style Properties Nested (Still Pending)

### Problem

Backend nests style properties under `style` object. Some frontend components expect them at top level.

### Backend Style Structure

```json
{
  "viewType": {
    "budget_allocated_amt": {
      "style": {
        "symbol": "$",
        "decimals": 2,
        "align": "right"
      }
    }
  }
}
```

### Resolution (When Needed)

Flatten in adapter:

```typescript
function adaptMetadata(field) {
  return {
    ...field,
    ...field.style,  // Spread style to top level
    currencySymbol: field.style?.symbol  // Legacy alias
  };
}
```

### Status: ⏳ PENDING (not blocking)

---

## Final Naming Convention

| Layer | Container Name | Property Inside |
|-------|----------------|-----------------|
| View/Display | `viewType` | `renderType` |
| Edit/Input | `editType` | `inputType` |

**Example:**
```json
{
  "viewType": {
    "field_name": { "renderType": "currency", ... }
  },
  "editType": {
    "field_name": { "inputType": "number", ... }
  }
}
```

---

## Files Modified

### Backend

| File | Changes |
|------|---------|
| `apps/api/src/services/backend-formatter.service.ts` | `ViewMetadata.renderType`, `EditMetadata.inputType` |

### Frontend

| File | Changes |
|------|---------|
| `apps/web/src/lib/formatters/types.ts` | `renderType`, `inputType`, `lookupSource`, `lookupEntity` |
| `apps/web/src/lib/formatters/datasetFormatter.ts` | Uses `renderType` |
| `apps/web/src/lib/api-factory.ts` | `renderType`, `inputType`, `lookupSource`, `lookupEntity` |
| `apps/web/src/lib/frontEndFormatterService.tsx` | Uses `inputType`, `lookupSource`, `lookupEntity` |
| `apps/web/src/stores/entityComponentMetadataStore.ts` | `lookupSource`, `lookupEntity` |
| `apps/web/src/components/shared/entity/EntityFormContainer.tsx` | `lookupSource`, `lookupEntity` |
| `apps/web/src/components/shared/entity/EntityFormContainerWithStore.tsx` | `lookupSource`, `lookupEntity` |
| `apps/web/src/components/shared/ui/EntityDataTable.tsx` | `lookupSource`, `lookupEntity` (with deprecated aliases) |

---

## Verification

```bash
# Test API response
./tools/test-api.sh GET "/api/v1/project?limit=1" 2>&1 | grep -E '"(renderType|inputType)"'
```

Expected output:
```
"renderType": "text",
"renderType": "currency",
"inputType": "readonly",
"inputType": "number",
...
```

---

## Change Log

| Date | Issue | Change | By |
|------|-------|--------|-----|
| 2025-11-25 | ALL | Initial red flag document created | Claude |
| 2025-11-25 | #1 | Identified exact lines with `type:` bug | Claude |
| 2025-11-25 | #2 | Added transformMetadata solution | Claude |
| 2025-11-25 | #1 | ✅ RESOLVED - Backend fixed to use `renderType`/`inputType` | Claude |
| 2025-11-25 | #2 | ✅ RESOLVED - Frontend fixed to use `renderType`/`inputType` | Claude |
| 2025-11-25 | #3 | ✅ RESOLVED - Edit mode now works | Claude |
| 2025-11-25 | #4 | ✅ RESOLVED - Frontend renamed `loadFromDataLabels`/`loadFromEntity` to `lookupSource`/`lookupEntity` | Claude |
