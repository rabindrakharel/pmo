# RCA: Entity Reference Fields Not Updating on EntitySpecificInstancePage

**Date:** 2025-12-04
**Reporter:** User
**Severity:** High
**Status:** Investigation In Progress

---

## Summary

Entity reference select dropdowns (EntityInstanceNameSelect) on the EntitySpecificInstancePage show up correctly but selections don't reflect/update. Specifically:

- ✅ **WORKS:** Budget Spent (currency field) updates correctly
- ❌ **FAILS:** Manager Employee Name (single UUID reference)
- ❌ **FAILS:** Sponsor Employee Name (single UUID reference)
- ❌ **FAILS:** Stakeholder Employee Ids (UUID array reference)

**URL:** `http://localhost:5173/project/61203bac-101b-28d6-7a15-2176c15a0b1c`

---

## Architecture Overview

### Data Flow for Entity Reference Fields

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ENTITY REFERENCE FIELD UPDATE FLOW (EntitySpecificInstancePage)           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. User clicks on "Manager Employee Name" field                           │
│     ↓                                                                       │
│  2. Long-press handler triggers (500ms)                                    │
│     EntityInstanceFormContainer.tsx:145-162                                │
│     → setInlineEditingField('manager__employee_id')                        │
│     ↓                                                                       │
│  3. FieldRenderer renders EditMode                                         │
│     FieldRenderer.tsx:159-172                                              │
│     → resolveEditComponent('EntityInstanceNameSelect', null)               │
│     → EditComponentRegistry.get('EntityInstanceNameSelect')                │
│     ↓                                                                       │
│  4. EntityInstanceNameSelectEdit wrapper renders                           │
│     registerComponents.tsx:220-250                                         │
│     → <EntityInstanceNameSelect                                            │
│          entityCode="employee"                                              │
│          value={value}                                                      │
│          onChange={(uuid) => onChange?.(uuid)}  ← LINE 245                 │
│       />                                                                    │
│     ↓                                                                       │
│  5. User selects "James Miller" (uuid: abc-123)                           │
│     EntityInstanceNameSelect.tsx:186-195                                   │
│     → selectOption(optionValue, optionLabel)                               │
│     → onChange("abc-123", "James Miller")  ← 2 PARAMETERS                  │
│     ↓                                                                       │
│  6. Wrapper receives onChange call                                         │
│     registerComponents.tsx:245                                             │
│     → onChange={(uuid) => onChange?.(uuid)}                                │
│     → Calls FieldRenderer's onChange with ONLY uuid                        │
│     ↓                                                                       │
│  7. FieldRenderer passes to EntityInstanceFormContainer                    │
│     EntityInstanceFormContainer.tsx:468-476                                │
│     → onChange={(v) => { handleInlineValueChange(v) }}                     │
│     → handleInlineValueChange("abc-123")                                   │
│     ↓                                                                       │
│  8. Inline value updated (local state)                                    │
│     EntityInstanceFormContainer.tsx:175-177                                │
│     → setInlineEditValue("abc-123")                                        │
│     ↓                                                                       │
│  9. User clicks outside OR presses Enter                                  │
│     EntityInstanceFormContainer.tsx:180-200                                │
│     → handleInlineSave()                                                   │
│     ↓                                                                       │
│  10. Optimistic update triggered                                          │
│      EntitySpecificInstancePage.tsx:824-834                                │
│      → handleInlineSave(fieldKey, value)                                   │
│      → optimisticUpdateEntity(id, { [fieldKey]: value })                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Root Cause Hypotheses

### Hypothesis 1: onChange Signature Mismatch ⚠️ **LIKELY**

**Evidence:**
- EntityInstanceNameSelect calls `onChange(uuid, label)` with **2 parameters** ([EntityInstanceNameSelect.tsx:191](file:///home/rabin/projects/pmo/apps/web/src/components/shared/ui/EntityInstanceNameSelect.tsx#L191))
- Wrapper only captures first parameter: `onChange={(uuid) => onChange?.(uuid)}` ([registerComponents.tsx:245](file:///home/rabin/projects/pmo/apps/web/src/lib/fieldRenderer/registerComponents.tsx#L245))
- The label parameter is **discarded** ❌

**Comparison with Working Field:**
```typescript
// Budget field (number input) - WORKS ✓
<input type="number" onChange={(e) => onChange(Number(e.target.value))} />
// ↑ Single parameter, direct value

// Manager field (EntityInstanceNameSelect) - FAILS ✗
<EntityInstanceNameSelect onChange={(uuid, label) => onChange(uuid)} />
// ↑ Two parameters, label discarded
```

**Impact:** This should still work because only the UUID is needed for the API update. The label is for display only. So this is **not the root cause** but should be noted for consistency.

---

### Hypothesis 2: Component Registration Not Loaded ⚠️ **POSSIBLE**

**Evidence:**
- `registerAllComponents()` defined in [registerComponents.tsx:596-644](file:///home/rabin/projects/pmo/apps/web/src/lib/fieldRenderer/registerComponents.tsx#L596-L644)
- Line 643 commented out: `// registerAllComponents();`
- No grep results for `registerAllComponents()` usage in .tsx files

**Investigation Needed:**
```bash
# Check if registerAllComponents is called in App.tsx or main.tsx
grep -r "registerAllComponents" /home/rabin/projects/pmo/apps/web/src
```

**If Not Registered:**
- `EditComponentRegistry.get('EntityInstanceNameSelect')` returns `undefined`
- `resolveEditComponent()` returns `null` ([ComponentRegistry.ts:312-331](file:///home/rabin/projects/pmo/apps/web/src/lib/fieldRenderer/ComponentRegistry.ts#L312-L331))
- Falls back to `renderEditField()` ([FieldRenderer.tsx:172](file:///home/rabin/projects/pmo/apps/web/src/lib/fieldRenderer/FieldRenderer.tsx#L172))
- `renderEditField()` only handles HTML5 input types ([EditFieldRenderer.tsx:72-308](file:///home/rabin/projects/pmo/apps/web/src/lib/fieldRenderer/EditFieldRenderer.tsx#L72-L308))
- **Result:** Renders as plain text input instead of dropdown ❌

---

### Hypothesis 3: Metadata Missing `inputType` or `lookupEntity` 🔍 **NEEDS VERIFICATION**

**Required Metadata:**
```json
{
  "manager__employee_id": {
    "inputType": "EntityInstanceNameSelect",
    "lookupEntity": "employee",
    "lookupSourceTable": "entityInstance"
  }
}
```

**Investigation Needed:**
```bash
# Check actual metadata from API (when API is running)
curl "http://localhost:4000/api/v1/project/61203bac-101b-28d6-7a15-2176c15a0b1c?content=metadata" \
  | jq '.metadata.entityInstanceFormContainer.editType.manager__employee_id'
```

**If Metadata Missing:**
- FieldRenderer doesn't know to use EntityInstanceNameSelect
- Falls back to default text input
- User sees a text input instead of dropdown

---

### Hypothesis 4: Inline Edit Value Not Syncing ⚠️ **POSSIBLE**

**Flow Analysis:**
1. User selects value → `setInlineEditValue("abc-123")` (local state)
2. User clicks outside → `handleInlineSave()` triggers
3. `onInlineSave(fieldKey, value)` called → optimistic update
4. TanStack Query cache updated → Dexie updated
5. **Component should re-render with new value**

**Potential Issues:**
- Cache update not triggering re-render
- `inlineEditValue` not being reset after save
- Optimistic update failing silently
- Value reverting to original due to stale cache

**Investigation Needed:**
```typescript
// Add console.logs in EntityInstanceFormContainer.tsx
console.log('[INLINE SAVE] Field:', inlineEditingField, 'Value:', inlineEditValue);
console.log('[OPTIMISTIC UPDATE] ID:', entityId, 'Updates:', { [fieldKey]: value });
```

---

## Debugging Steps

### Step 1: Verify Component Registration

```bash
# Search for registerAllComponents usage
grep -r "registerAllComponents" /home/rabin/projects/pmo/apps/web/src

# Check App.tsx for initialization
cat /home/rabin/projects/pmo/apps/web/src/App.tsx | grep -A 5 -B 5 "register"
```

**Expected:** Should find `registerAllComponents()` called in App.tsx or main.tsx
**If Missing:** Add to App.tsx initialization

---

### Step 2: Test in Browser DevTools

1. Open `http://localhost:5173/project/61203bac-101b-28d6-7a15-2176c15a0b1c`
2. Open DevTools Console
3. Click on "Manager Employee Name" field (long-press 500ms)
4. Check console for:
   ```
   [EntityInstanceNameSelect] Missing lookupEntity for field manager__employee_id
   ```
5. If dropdown appears, select a value and watch console:
   ```typescript
   // Should see in EntityInstanceFormContainer.tsx
   [INLINE EDIT] Field: manager__employee_id, Value: <uuid>
   [INLINE SAVE] Triggering optimistic update...
   ```

---

### Step 3: Inspect Metadata

```typescript
// In browser console
const field = document.querySelector('[data-field="manager__employee_id"]');
// Check React props (if React DevTools installed)
// Or add console.log in EntityInstanceFormContainer.tsx line 306
```

---

### Step 4: Check Network Requests

1. Open Network tab
2. Click outside field to trigger save
3. Check for PATCH request to `/api/v1/project/{id}`
4. Verify payload contains:
   ```json
   {
     "manager__employee_id": "new-uuid-value"
   }
   ```

---

## Expected vs Actual Behavior

### Expected ✓

1. User long-presses "Manager Employee Name"
2. Dropdown appears with searchable employee list
3. User selects "Jane Doe"
4. Display updates immediately to "Jane Doe" (optimistic)
5. Click outside → PATCH request sent
6. If success → value persists
7. If failure → reverts to original value

### Actual ✗

1. User long-presses "Manager Employee Name"
2. **Either:**
   - Dropdown doesn't appear (component not registered)
   - Dropdown appears but empty (metadata missing)
   - Dropdown appears, selection works, but display doesn't update (state sync issue)

---

## Recommended Fixes

### Fix 1: Ensure Component Registration (CRITICAL)

**File:** `apps/web/src/App.tsx`

```typescript
import { registerAllComponents } from './lib/fieldRenderer/registerComponents';

// Call ONCE at app initialization (before rendering)
registerAllComponents();

function App() {
  // ... rest of app
}
```

**Rationale:** Without registration, EntityInstanceNameSelect component is not available in the registry.

---

### Fix 2: Verify Metadata Generation (Backend)

**File:** `apps/api/src/services/entity-component-metadata.service.ts`

Ensure pattern detection correctly identifies entity reference fields:

```typescript
// Pattern: *__employee_id, *__project_id, etc.
if (columnName.endsWith('__employee_id')) {
  return {
    renderType: 'entityLink',
    inputType: 'EntityInstanceNameSelect',
    lookupEntity: 'employee',
    lookupSourceTable: 'entityInstance'
  };
}

// Pattern: *__employee_ids (array)
if (columnName.endsWith('__employee_ids')) {
  return {
    renderType: 'entityLinks',
    inputType: 'EntityInstanceNameMultiSelect',
    lookupEntity: 'employee',
    lookupSourceTable: 'entityInstance'
  };
}
```

---

### Fix 3: Add Debug Logging

**File:** `apps/web/src/components/shared/entity/EntityInstanceFormContainer.tsx`

```typescript
// Line 180: handleInlineSave
const handleInlineSave = useCallback(() => {
  if (!inlineEditingField) return;

  console.log('[INLINE SAVE] Field:', inlineEditingField, 'New Value:', inlineEditValue, 'Original:', data[inlineEditingField]);

  const originalValue = data[inlineEditingField];
  const newValue = inlineEditValue;

  // Only save if value actually changed
  if (newValue !== originalValue) {
    console.log('[INLINE SAVE] Value changed, triggering optimistic update');

    // Update local data immediately for UI feedback
    setLocalData(prev => ({ ...prev, [inlineEditingField]: newValue }));

    // Trigger optimistic update via callback
    if (onInlineSave) {
      console.log('[INLINE SAVE] Calling onInlineSave:', inlineEditingField, newValue);
      onInlineSave(inlineEditingField, newValue);
    }
  } else {
    console.log('[INLINE SAVE] No change detected, skipping save');
  }

  // Exit inline edit mode
  setInlineEditingField(null);
  setInlineEditValue(null);
}, [inlineEditingField, inlineEditValue, data, onInlineSave]);
```

---

### Fix 4: Fix onChange Signature (Optional - Consistency)

**File:** `apps/web/src/lib/fieldRenderer/registerComponents.tsx`

```typescript
// Line 245: Current (discards label)
onChange={(uuid) => onChange?.(uuid)}

// Improved (captures label for logging/debugging)
onChange={(uuid, label) => {
  console.log('[EntityInstanceNameSelect] Selected:', label, '(', uuid, ')');
  onChange?.(uuid);
}}
```

**Note:** This doesn't fix the bug but improves debuggability.

---

## Next Steps

1. ✅ **PRIORITY 1:** Check if `registerAllComponents()` is called
2. ✅ **PRIORITY 2:** Add debug logging to EntityInstanceFormContainer
3. ✅ **PRIORITY 3:** Test in browser and capture console logs
4. ✅ **PRIORITY 4:** Verify metadata from API response
5. ✅ **PRIORITY 5:** Fix identified root cause

---

## Related Files

| File | Relevance | Line Numbers |
|------|-----------|--------------|
| [EntityInstanceNameSelect.tsx](file:///home/rabin/projects/pmo/apps/web/src/components/shared/ui/EntityInstanceNameSelect.tsx) | Component implementation | 41-250 |
| [registerComponents.tsx](file:///home/rabin/projects/pmo/apps/web/src/lib/fieldRenderer/registerComponents.tsx) | Registration logic | 220-250, 628 |
| [ComponentRegistry.ts](file:///home/rabin/projects/pmo/apps/web/src/lib/fieldRenderer/ComponentRegistry.ts) | Registry pattern | 312-331 |
| [FieldRenderer.tsx](file:///home/rabin/projects/pmo/apps/web/src/lib/fieldRenderer/FieldRenderer.tsx) | Component resolution | 159-172 |
| [EntityInstanceFormContainer.tsx](file:///home/rabin/projects/pmo/apps/web/src/components/shared/entity/EntityInstanceFormContainer.tsx) | Inline edit logic | 110-251, 464-483 |
| [EntitySpecificInstancePage.tsx](file:///home/rabin/projects/pmo/apps/web/src/pages/shared/EntitySpecificInstancePage.tsx) | Page component | 824-834 |
| [EditFieldRenderer.tsx](file:///home/rabin/projects/pmo/apps/web/src/lib/fieldRenderer/EditFieldRenderer.tsx) | Fallback renderer | 32-308 |

---

## Appendix: Field Type Comparison

| Field | Database Type | inputType | Component | Status |
|-------|---------------|-----------|-----------|--------|
| budget_spent_amt | decimal | number | DebouncedNumberInputEdit | ✅ WORKS |
| manager__employee_id | uuid | EntityInstanceNameSelect | EntityInstanceNameSelectEdit | ❌ FAILS |
| sponsor__employee_id | uuid | EntityInstanceNameSelect | EntityInstanceNameSelectEdit | ❌ FAILS |
| stakeholder__employee_ids | uuid[] | EntityInstanceNameMultiSelect | EntityInstanceNameMultiSelectEdit | ❌ FAILS |

**Pattern:** All entity reference fields fail, primitive fields work.

---

**Status:** Investigation in progress. Awaiting browser testing results.
