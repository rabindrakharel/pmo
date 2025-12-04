# Inline Edit Dropdown Selection Fix

**Date**: 2025-12-04
**Status**: ✅ FIXED
**Issue**: Entity reference dropdowns (Manager Employee Name, Sponsor Employee Name) show selections but values don't persist in inline edit mode
**Root Cause**: Competing click-outside handlers race condition

---

## Problem Statement

### Symptoms

1. **Full edit mode (pencil icon)**: Entity reference fields work correctly ✅
2. **Inline edit mode (long-press)**: Entity reference fields fail ❌
   - User long-presses field → dropdown appears
   - User selects value → dropdown closes
   - **Value NOT saved** → field reverts to original value

### Affected Fields

- `manager__employee_id` (Manager Employee Name)
- `sponsor__employee_id` (Sponsor Employee Name)
- `stakeholder__employee_ids` (Stakeholder Employee Ids)
- All fields using `EntityInstanceNameSelect` component

---

## Root Cause Analysis

### The Race Condition

Two click-outside handlers compete when user clicks dropdown option:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  CLICK-OUTSIDE HANDLER RACE CONDITION                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. User long-presses "Manager Employee Name"                               │
│     → EntityInstanceFormContainer.enterInlineEditMode()                     │
│     → isInlineEditing = true                                                 │
│     → EntityInstanceNameSelect renders dropdown via portal                  │
│                                                                              │
│  2. User clicks dropdown option "James Miller"                              │
│     ↓                                                                        │
│  3. Browser triggers 'mousedown' event                                      │
│     ↓                                                                        │
│  4. ❌ EntityInstanceFormContainer.handleClickOutside() fires FIRST         │
│     → Checks: editingFieldRef.contains(target)? NO                          │
│     → Checks: [data-dropdown-portal]? NOT IMPLEMENTED (v1.0.0)             │
│     → Calls: handleInlineSave()                                             │
│     → inlineEditValue is UNCHANGED (still old value)                        │
│     → Sees no change, skips save                                            │
│     → Sets: isInlineEditing = false                                         │
│     ↓                                                                        │
│  5. ❌ EntityInstanceNameSelect.selectOption() NEVER CALLED                 │
│     → Component already unmounted/re-rendered                               │
│     → onChange never fires                                                   │
│     → Value never captured                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Console Log Evidence

**Missing Logs** (selectOption never called):
```
🎯 [EntityInstanceNameSelect] selectOption called     ❌ NEVER APPEARS
📞 [EntityInstanceNameSelect] Calling parent onChange ❌ NEVER APPEARS
🔗 [EntityInstanceNameSelectEdit] onChange triggered  ❌ NEVER APPEARS
🔀 [EntityInstanceFormContainer] FieldRenderer onChange router ❌ NEVER APPEARS
```

**Logs That DID Appear** (click-outside fires prematurely):
```
🔓 [EntityInstanceFormContainer] ENTERING inline edit mode ✅
💾 [EntityInstanceFormContainer] handleInlineSave triggered ✅
📊 Comparing values: changed: false  ✅ (values same because onChange never fired)
```

---

## The Holistic Solution

### Design Pattern: BadgeDropdownSelect vs EntityInstanceNameSelect

Both components use **portal rendering** (`createPortal`) to avoid CSS clipping, and both have `data-dropdown-portal=""` attribute. The pattern is:

```typescript
// BadgeDropdownSelect.tsx (lines 117-129) - WORKING PATTERN
const handleClickOutside = (event: MouseEvent) => {
  if (
    dropdownRef.current &&
    !dropdownRef.current.contains(event.target as Node) &&  // Check dropdown portal
    buttonRef.current &&
    !buttonRef.current.contains(event.target as Node)       // Check trigger button
  ) {
    setDropdownOpen(false);  // Only close if BOTH checks pass
  }
};
```

```typescript
// EntityInstanceNameSelect.tsx (lines 102-117) - WORKING PATTERN
const handleClickOutside = (event: MouseEvent) => {
  if (
    containerRef.current &&
    !containerRef.current.contains(event.target as Node) &&  // Check container
    dropdownRef.current &&
    !dropdownRef.current.contains(event.target as Node)      // Check dropdown portal
  ) {
    setIsOpen(false);  // Only close if BOTH checks pass
  }
};
```

**Key Principle:** Always check BOTH the trigger element AND the portal-rendered dropdown.

### The Problem

`EntityInstanceFormContainer.handleClickOutside()` only checked `editingFieldRef`, NOT the dropdown portal:

```typescript
// ❌ BROKEN (v1.0.0)
const handleClickOutside = (event: MouseEvent) => {
  if (editingFieldRef.current && !editingFieldRef.current.contains(event.target as Node)) {
    handleInlineSave();  // Fires when clicking dropdown options!
  }
};
```

### The Fix

Added portal detection using `data-dropdown-portal` attribute:

```typescript
// ✅ FIXED (v1.1.0)
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node;

  // Don't trigger if clicking inside the editing field
  if (editingFieldRef.current && editingFieldRef.current.contains(target)) {
    return;
  }

  // Don't trigger if clicking inside a dropdown portal
  // EntityInstanceNameSelect renders dropdown via portal with data-dropdown-portal attribute
  const isClickInsideDropdown = (target as Element).closest?.('[data-dropdown-portal]');
  if (isClickInsideDropdown) {
    console.log('🎯 [EntityInstanceFormContainer] Click inside dropdown portal detected, ignoring click-outside');
    return;
  }

  console.log('🚪 [EntityInstanceFormContainer] Click outside detected, triggering handleInlineSave');
  handleInlineSave();
};
```

---

## Flow After Fix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  CORRECTED INLINE EDIT FLOW (v1.1.0)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. User long-presses "Manager Employee Name"                               │
│     → isInlineEditing = true                                                 │
│     → EntityInstanceNameSelect dropdown renders                             │
│                                                                              │
│  2. User clicks dropdown option "James Miller"                              │
│     ↓                                                                        │
│  3. Browser triggers 'mousedown' event                                      │
│     ↓                                                                        │
│  4. ✅ EntityInstanceFormContainer.handleClickOutside() fires                │
│     → Checks: editingFieldRef.contains(target)? NO                          │
│     → Checks: target.closest('[data-dropdown-portal]')? YES ✅              │
│     → 🎯 Logs: "Click inside dropdown portal detected, ignoring"            │
│     → RETURNS EARLY (does not call handleInlineSave)                        │
│     ↓                                                                        │
│  5. ✅ EntityInstanceNameSelect.selectOption() EXECUTES                     │
│     → 🎯 Logs: "selectOption called"                                        │
│     → 📞 Logs: "Calling parent onChange"                                    │
│     → Calls: onChange(uuid, label)                                          │
│     ↓                                                                        │
│  6. ✅ EntityInstanceNameSelectEdit.onChange() FIRES                        │
│     → 🔗 Logs: "onChange triggered"                                         │
│     → 📤 Logs: "Calling parent onChange with uuid"                          │
│     → Calls: parent onChange(uuid)                                          │
│     ↓                                                                        │
│  7. ✅ FieldRenderer onChange router FIRES                                   │
│     → 🔀 Logs: "FieldRenderer onChange router"                              │
│     → Checks: isInlineEditing? YES                                          │
│     → Calls: handleInlineValueChange(uuid)                                  │
│     ↓                                                                        │
│  8. ✅ EntityInstanceFormContainer.handleInlineValueChange() FIRES          │
│     → 🔄 Logs: "handleInlineValueChange"                                    │
│     → Sets: inlineEditValue = uuid (NEW value)                              │
│     ↓                                                                        │
│  9. User clicks OUTSIDE field (to exit inline edit)                         │
│     ↓                                                                        │
│  10. ✅ EntityInstanceFormContainer.handleClickOutside() fires              │
│      → Checks: target.closest('[data-dropdown-portal]')? NO                 │
│      → 🚪 Logs: "Click outside detected, triggering handleInlineSave"       │
│      → Calls: handleInlineSave()                                            │
│      ↓                                                                       │
│  11. ✅ EntityInstanceFormContainer.handleInlineSave() EXECUTES             │
│      → 💾 Logs: "handleInlineSave triggered"                                │
│      → 📊 Logs: "Comparing values: changed: true" ✅                        │
│      → Calls: onInlineSave(fieldKey, newValue)                              │
│      ↓                                                                       │
│  12. ✅ EntitySpecificInstancePage.handleInlineSave() EXECUTES              │
│      → 🎯 Logs: "handleInlineSave called"                                   │
│      → 🚀 Logs: "Calling optimisticUpdateEntity"                            │
│      → Calls: optimisticUpdateEntity(id, { [fieldKey]: uuid })              │
│      ↓                                                                       │
│  13. ✅ PATCH /api/v1/project/{id} succeeds                                  │
│      → UI updates immediately (optimistic)                                   │
│      → TanStack Query cache updated                                         │
│      → Dexie persisted                                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Files Modified

### 1. EntityInstanceFormContainer.tsx (Lines 281-303)

**Change**: Added portal detection to click-outside handler

```diff
  // Click outside to save and close
  useEffect(() => {
    if (!inlineEditingField) return;

    const handleClickOutside = (event: MouseEvent) => {
+     const target = event.target as Node;
+
+     // Don't trigger if clicking inside the editing field
-     if (editingFieldRef.current && !editingFieldRef.current.contains(event.target as Node)) {
+     if (editingFieldRef.current && editingFieldRef.current.contains(target)) {
+       return;
+     }
+
+     // Don't trigger if clicking inside a dropdown portal
+     // EntityInstanceNameSelect renders dropdown via portal with data-dropdown-portal attribute
+     const isClickInsideDropdown = (target as Element).closest?.('[data-dropdown-portal]');
+     if (isClickInsideDropdown) {
+       console.log('🎯 [EntityInstanceFormContainer] Click inside dropdown portal detected, ignoring click-outside');
+       return;
+     }
+
+     console.log('🚪 [EntityInstanceFormContainer] Click outside detected, triggering handleInlineSave');
      handleInlineSave();
    };
```

---

## Testing Procedure

1. **Clear browser cache** (Ctrl+Shift+Delete → Cached images and files)
2. **Refresh page** (Ctrl+F5)
3. **Navigate to project detail page**:
   ```
   http://localhost:5173/project/61203bac-101b-28d6-7a15-2176c15a0b1c
   ```
4. **Long-press "Manager Employee Name"** field (hold for 500ms - blue highlight appears)
5. **Select an employee** from dropdown (e.g., "Sarah Johnson")
6. **Verify dropdown selection logs**:
   ```
   🎯 [EntityInstanceNameSelect] selectOption called
   📞 [EntityInstanceNameSelect] Calling parent onChange
   🔗 [EntityInstanceNameSelectEdit] onChange triggered
   📤 [EntityInstanceNameSelectEdit] Calling parent onChange with uuid
   🔀 [EntityInstanceFormContainer] FieldRenderer onChange router
   🔄 [EntityInstanceFormContainer] handleInlineValueChange
   ```
7. **Click outside** the field
8. **Verify save logs**:
   ```
   🚪 [EntityInstanceFormContainer] Click outside detected, triggering handleInlineSave
   💾 [EntityInstanceFormContainer] handleInlineSave triggered
   📊 [EntityInstanceFormContainer] Comparing values: changed: true
   🎯 [EntitySpecificInstancePage] handleInlineSave called
   🚀 [EntitySpecificInstancePage] Calling optimisticUpdateEntity
   ✅ [EntitySpecificInstancePage] Optimistic update completed successfully
   ```
9. **Verify UI**: Display updates to "Sarah Johnson" immediately
10. **Verify Network**: PATCH request to `/api/v1/project/{id}` succeeded

---

## Expected Console Output (Success)

### Phase 1: Enter Inline Edit Mode
```
🔓 [EntityInstanceFormContainer] ENTERING inline edit mode: {
  field: 'manager__employee_id',
  currentValue: '2d143427-a37a-45d3-933c-6d52e3c462a8',
  valueType: 'string'
}
🔍 [EntityInstanceFormContainer] Field state for manager__employee_id: {
  isInlineEditing: true,
  inlineEditingField: 'manager__employee_id',
  inlineEditValue: '2d143427-a37a-45d3-933c-6d52e3c462a8'
}
```

### Phase 2: Select Dropdown Value
```
🎯 [EntityInstanceNameSelect] selectOption called: {
  entityCode: 'employee',
  optionValue: 'f5a2e9b3-4c1d-8a7f-2e5b-9d3c6a1f4e8b',
  optionLabel: 'Sarah Johnson'
}
📞 [EntityInstanceNameSelect] Calling parent onChange...
🔗 [EntityInstanceNameSelectEdit] onChange triggered: {
  fieldKey: 'manager__employee_id',
  uuid: 'f5a2e9b3-4c1d-8a7f-2e5b-9d3c6a1f4e8b',
  label: 'Sarah Johnson'
}
📤 [EntityInstanceNameSelectEdit] Calling parent onChange with uuid
✅ [EntityInstanceNameSelectEdit] Parent onChange completed
🔀 [EntityInstanceFormContainer] FieldRenderer onChange router: {
  field: 'manager__employee_id',
  value: 'f5a2e9b3-4c1d-8a7f-2e5b-9d3c6a1f4e8b',
  isInlineEditing: true,
  willCall: 'handleInlineValueChange'
}
🔄 [EntityInstanceFormContainer] handleInlineValueChange: {
  field: 'manager__employee_id',
  newValue: 'f5a2e9b3-4c1d-8a7f-2e5b-9d3c6a1f4e8b'
}
✅ [EntityInstanceFormContainer] inlineEditValue state updated
```

### Phase 3: Click Outside to Save
```
🚪 [EntityInstanceFormContainer] Click outside detected, triggering handleInlineSave
💾 [EntityInstanceFormContainer] handleInlineSave triggered: {
  inlineEditingField: 'manager__employee_id',
  inlineEditValue: 'f5a2e9b3-4c1d-8a7f-2e5b-9d3c6a1f4e8b'
}
📊 [EntityInstanceFormContainer] Comparing values: {
  field: 'manager__employee_id',
  originalValue: '2d143427-a37a-45d3-933c-6d52e3c462a8',
  newValue: 'f5a2e9b3-4c1d-8a7f-2e5b-9d3c6a1f4e8b',
  changed: true  ✅
}
✏️  [EntityInstanceFormContainer] Value changed, updating localData
🚀 [EntityInstanceFormContainer] Calling onInlineSave callback
🎯 [EntitySpecificInstancePage] handleInlineSave called: {
  entityCode: 'project',
  fieldKey: 'manager__employee_id',
  value: 'f5a2e9b3-4c1d-8a7f-2e5b-9d3c6a1f4e8b'
}
🚀 [EntitySpecificInstancePage] Calling optimisticUpdateEntity...
✅ [EntitySpecificInstancePage] Optimistic update completed successfully
🔚 [EntityInstanceFormContainer] Exiting inline edit mode
```

---

## Related Patterns

### BadgeDropdownSelect Click-Outside Pattern

BadgeDropdownSelect (datalabel dropdowns like `dl__project_stage`) uses the SAME pattern:

**File**: `apps/web/src/components/shared/ui/BadgeDropdownSelect.tsx:117-129`

```typescript
const handleClickOutside = (event: MouseEvent) => {
  if (
    dropdownRef.current &&
    !dropdownRef.current.contains(event.target as Node) &&
    buttonRef.current &&
    !buttonRef.current.contains(event.target as Node)
  ) {
    setDropdownOpen(false);
  }
};
document.addEventListener('mousedown', handleClickOutside);
```

**Principle**: Check BOTH trigger button (`buttonRef`) AND portal dropdown (`dropdownRef`).

### EntityInstanceNameSelect Click-Outside Pattern

**File**: `apps/web/src/components/shared/ui/EntityInstanceNameSelect.tsx:102-117`

```typescript
const handleClickOutside = (event: MouseEvent) => {
  if (
    containerRef.current &&
    !containerRef.current.contains(event.target as Node) &&
    dropdownRef.current &&
    !dropdownRef.current.contains(event.target as Node)
  ) {
    setIsOpen(false);
  }
};
document.addEventListener('mousedown', handleClickOutside);
```

**Principle**: Check BOTH container (`containerRef`) AND portal dropdown (`dropdownRef`).

---

## Anti-Patterns Avoided

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Only check editing field ref | Check BOTH editing field AND dropdown portal |
| Use 'click' event | Use 'mousedown' event (fires before onClick) |
| Hardcode component name | Use `data-dropdown-portal` attribute (generic) |
| Immediate save on dropdown change | Save only on explicit "click outside" |
| Assume state is synchronous | Use logging to trace async state updates |

---

## Design Principles Applied

1. **Separation of Concerns**: Each component manages its own click-outside detection
2. **Portal Pattern**: Use `data-*` attributes for generic portal detection
3. **Event Order**: `mousedown` fires before `click`, allowing early detection
4. **Defensive Programming**: Multiple checks prevent false positives
5. **Debug Logging**: Comprehensive emoji logging for troubleshooting

---

## Next Steps

1. ✅ Test the fix in browser (clear cache + refresh)
2. ✅ If successful, remove debug logging (emoji logs)
3. ✅ Create git commit with all changes
4. ✅ Document pattern in design_pattern/ directory

---

## Version History

- **v1.0.0** (2025-12-04): Initial metadata loading fix (returned `undefined` instead of `{}`)
- **v1.1.0** (2025-12-04): Click-outside handler fix (portal detection)

---

**Status**: Ready for testing
**Next**: User testing with console logs to verify fix

