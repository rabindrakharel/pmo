# Debug Guide: Entity Reference Fields Not Updating

**Status:** Components ARE registered ✅ (confirmed in App.tsx:17)

Since component registration is working, the issue is likely in the **value syncing** or **metadata** flow.

---

## Quick Debug Test (Browser Console)

1. Open `http://localhost:5173/project/61203bac-101b-28d6-7a15-2176c15a0b1c`
2. Open DevTools Console
3. Paste this code:

```javascript
// Check if EntityInstanceNameSelect component is registered
const registry = window.__REACT_DEVTOOLS_GLOBAL_HOOK__?._renderers;
console.log('[DEBUG] React DevTools available:', !!registry);

// Log all registered edit components
console.log('[DEBUG] Checking component registration...');

// You'll need to check the actual EditComponentRegistry
// Add this temporary code to registerComponents.tsx after line 628
console.log('[REGISTRY] EntityInstanceNameSelect registered:',
  EditComponentRegistry.has('EntityInstanceNameSelect'));
```

---

## Add Debug Logging (Temporary Patches)

### Patch 1: EntityInstanceFormContainer.tsx

**Add after line 175:**

```typescript
const handleInlineValueChange = useCallback((value: any) => {
  console.log('[INLINE EDIT] Value changing:', {
    field: inlineEditingField,
    oldValue: inlineEditValue,
    newValue: value,
    valueType: typeof value
  });
  setInlineEditValue(value);
}, [inlineEditingField, inlineEditValue]);
```

**Add after line 180:**

```typescript
const handleInlineSave = useCallback(() => {
  if (!inlineEditingField) return;

  const originalValue = data[inlineEditingField];
  const newValue = inlineEditValue;

  console.log('[INLINE SAVE] Attempting save:', {
    field: inlineEditingField,
    originalValue,
    newValue,
    changed: newValue !== originalValue,
    originalType: typeof originalValue,
    newType: typeof newValue
  });

  // Only save if value actually changed
  if (newValue !== originalValue) {
    // Update local data immediately for UI feedback
    setLocalData(prev => {
      console.log('[INLINE SAVE] Updating localData:', {
        prev: prev[inlineEditingField],
        next: newValue
      });
      return { ...prev, [inlineEditingField]: newValue };
    });

    // Trigger optimistic update via callback
    if (onInlineSave) {
      console.log('[INLINE SAVE] Calling onInlineSave');
      onInlineSave(inlineEditingField, newValue);
    } else {
      console.warn('[INLINE SAVE] onInlineSave callback is undefined!');
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

### Patch 2: EntitySpecificInstancePage.tsx

**Add after line 824:**

```typescript
const handleInlineSave = useCallback(async (fieldKey: string, value: any) => {
  if (!id) return;

  console.log('[PAGE INLINE SAVE] Received:', {
    entityCode,
    entityId: id,
    fieldKey,
    value,
    valueType: typeof value
  });

  try {
    // Optimistic update: UI updates instantly, API syncs in background
    console.log('[PAGE INLINE SAVE] Calling optimisticUpdateEntity');
    await optimisticUpdateEntity(id, { [fieldKey]: value });
    console.log('[PAGE INLINE SAVE] Optimistic update completed');
  } catch (err) {
    // Error is handled by useOptimisticMutation's onError callback
    console.error('[PAGE INLINE SAVE] Inline save failed:', err);
  }
}, [id, optimisticUpdateEntity, entityCode]);
```

---

### Patch 3: registerComponents.tsx

**Replace lines 220-250 with:**

```typescript
/**
 * EntityInstanceNameSelect - Edit Mode
 * Searchable dropdown for single entity reference
 */
const EntityInstanceNameSelectEdit: React.FC<ComponentRendererProps> = ({
  value,
  field,
  onChange,
  disabled,
  readonly,
}) => {
  const entityCode = field.lookupEntity;

  console.log('[EntityInstanceNameSelectEdit] Rendering:', {
    field: field.key,
    value,
    entityCode,
    hasOnChange: !!onChange,
    disabled,
    readonly
  });

  if (!entityCode) {
    console.warn(`[EntityInstanceNameSelectEdit] Missing lookupEntity for field ${field.key}`, field);
    const displayValue = value && typeof value === 'string' && value.length > 8
      ? value.substring(0, 8) + '...'
      : value;
    return (
      <span className="text-dark-600 text-base tracking-tight">
        {displayValue || '-'}
      </span>
    );
  }

  return (
    <EntityInstanceNameSelect
      entityCode={entityCode}
      value={value ?? ''}
      onChange={(uuid, label) => {
        console.log('[EntityInstanceNameSelectEdit] onChange triggered:', {
          field: field.key,
          uuid,
          label,
          hasOnChangeCallback: !!onChange
        });
        if (onChange) {
          onChange(uuid);
          console.log('[EntityInstanceNameSelectEdit] Parent onChange called with uuid:', uuid);
        } else {
          console.error('[EntityInstanceNameSelectEdit] onChange callback is undefined!');
        }
      }}
      disabled={disabled || readonly}
      placeholder={`Select ${entityCode}...`}
    />
  );
};
```

---

### Patch 4: EntityInstanceNameSelect.tsx

**Add after line 186:**

```typescript
const selectOption = useCallback((optionValue: string, optionLabel: string) => {
  console.log('[EntityInstanceNameSelect] selectOption called:', {
    entityCode,
    optionValue,
    optionLabel,
    previousValue: localValue
  });

  // Update local state immediately for instant UI feedback
  setLocalValue(optionValue);
  setLocalLabel(optionLabel);

  console.log('[EntityInstanceNameSelect] Calling onChange:', {
    param1: optionValue,
    param2: optionLabel
  });

  // Notify parent (may be async if using Dexie drafts)
  onChange(optionValue, optionLabel);

  console.log('[EntityInstanceNameSelect] onChange called, closing dropdown');

  setIsOpen(false);
  setSearchTerm('');
  setHighlightedIndex(-1);
}, [onChange, entityCode, localValue]);
```

---

## Testing Procedure

1. **Apply all 4 patches above**
2. **Restart dev server** (`npm run dev`)
3. **Open browser** to `http://localhost:5173/project/61203bac-101b-28d6-7a15-2176c15a0b1c`
4. **Open DevTools Console** (F12 → Console tab)
5. **Clear console** (right-click → Clear console)
6. **Long-press** on "Manager Employee Name" field (hold for 500ms)
7. **Watch console** for:
   ```
   [EntityInstanceNameSelectEdit] Rendering: {...}
   ```
8. **Select a value** (e.g., "Jane Doe")
9. **Watch console** for complete flow:
   ```
   [EntityInstanceNameSelect] selectOption called: {...}
   [EntityInstanceNameSelect] Calling onChange: {...}
   [EntityInstanceNameSelectEdit] onChange triggered: {...}
   [EntityInstanceNameSelectEdit] Parent onChange called with uuid: ...
   [INLINE EDIT] Value changing: {...}
   ```
10. **Click outside** the field
11. **Watch console** for:
    ```
    [INLINE SAVE] Attempting save: {...}
    [INLINE SAVE] Updating localData: {...}
    [INLINE SAVE] Calling onInlineSave
    [PAGE INLINE SAVE] Received: {...}
    [PAGE INLINE SAVE] Calling optimisticUpdateEntity
    [PAGE INLINE SAVE] Optimistic update completed
    ```

---

## Expected Console Output (Success Case)

```
[EntityInstanceNameSelectEdit] Rendering: {field: "manager__employee_id", value: "old-uuid", entityCode: "employee", hasOnChange: true}
[EntityInstanceNameSelect] selectOption called: {entityCode: "employee", optionValue: "new-uuid", optionLabel: "Jane Doe"}
[EntityInstanceNameSelect] Calling onChange: {param1: "new-uuid", param2: "Jane Doe"}
[EntityInstanceNameSelectEdit] onChange triggered: {field: "manager__employee_id", uuid: "new-uuid", label: "Jane Doe", hasOnChangeCallback: true}
[EntityInstanceNameSelectEdit] Parent onChange called with uuid: new-uuid
[INLINE EDIT] Value changing: {field: "manager__employee_id", oldValue: null, newValue: "new-uuid"}
[INLINE SAVE] Attempting save: {field: "manager__employee_id", originalValue: "old-uuid", newValue: "new-uuid", changed: true}
[INLINE SAVE] Updating localData: {prev: "old-uuid", next: "new-uuid"}
[INLINE SAVE] Calling onInlineSave
[PAGE INLINE SAVE] Received: {entityCode: "project", entityId: "...", fieldKey: "manager__employee_id", value: "new-uuid"}
[PAGE INLINE SAVE] Calling optimisticUpdateEntity
[PAGE INLINE SAVE] Optimistic update completed
```

---

## Failure Scenarios

### Scenario A: Missing lookupEntity

```
[EntityInstanceNameSelectEdit] Missing lookupEntity for field manager__employee_id
```

**Fix:** Check metadata generation in `entity-component-metadata.service.ts` - ensure `*__employee_id` pattern detection sets `lookupEntity: 'employee'`

---

### Scenario B: onChange Not Called

```
[EntityInstanceNameSelect] selectOption called: {...}
[EntityInstanceNameSelect] Calling onChange: {...}
// ❌ No subsequent logs
```

**Fix:** Check if EntityInstanceFormContainer is passing onChange correctly to FieldRenderer

---

### Scenario C: Value Changes But Doesn't Save

```
[INLINE EDIT] Value changing: {...}
[INLINE SAVE] Attempting save: {...changed: true...}
[INLINE SAVE] Calling onInlineSave
// ❌ No [PAGE INLINE SAVE] logs
```

**Fix:** Check if `onInlineSave` prop is passed from EntitySpecificInstancePage to EntityInstanceFormContainer (line 1383)

---

### Scenario D: Optimistic Update Fails

```
[PAGE INLINE SAVE] Received: {...}
[PAGE INLINE SAVE] Calling optimisticUpdateEntity
[PAGE INLINE SAVE] Inline save failed: Error: ...
```

**Fix:** Check useOptimisticMutation implementation and network requests

---

## Metadata Verification

If you see "Missing lookupEntity", check the metadata response:

```bash
# When API is running
curl "http://localhost:4000/api/v1/project/61203bac-101b-28d6-7a15-2176c15a0b1c?content=metadata" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  | jq '.metadata.entityInstanceFormContainer.editType | to_entries | .[] | select(.key | contains("employee"))'
```

**Expected:**
```json
{
  "key": "manager__employee_id",
  "value": {
    "inputType": "EntityInstanceNameSelect",
    "lookupEntity": "employee",
    "lookupSourceTable": "entityInstance",
    "behavior": {
      "editable": true
    }
  }
}
```

---

## Network Request Verification

After clicking outside, check Network tab for:

**Request:**
```
PATCH /api/v1/project/61203bac-101b-28d6-7a15-2176c15a0b1c
Content-Type: application/json

{
  "manager__employee_id": "new-uuid-here"
}
```

**Response (success):**
```json
{
  "id": "61203bac-101b-28d6-7a15-2176c15a0b1c",
  "manager__employee_id": "new-uuid-here",
  ...
}
```

---

## Common Issues & Solutions

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| Dropdown doesn't appear | Missing `lookupEntity` in metadata | Fix backend pattern detection |
| Dropdown appears but empty | `useRefDataEntityInstanceOptions` returns empty | Check `ref_data_entityInstance` API |
| Selection works but display doesn't update | Local state not syncing | Check `setLocalValue` in EntityInstanceNameSelect |
| Display updates but reverts after save | Optimistic update failed | Check Network tab for API errors |
| Display updates, save works, but value doesn't persist | Cache not invalidating | Check TanStack Query invalidation logic |

---

## Next Steps After Debugging

Once you've identified which console log is missing, report back with:

1. **Last successful log line** (e.g., "[INLINE EDIT] Value changing")
2. **First missing log line** (e.g., "[INLINE SAVE] Attempting save")
3. **Any error messages** in console
4. **Network requests** (any failed PATCH requests)

This will pinpoint the exact location of the bug.
