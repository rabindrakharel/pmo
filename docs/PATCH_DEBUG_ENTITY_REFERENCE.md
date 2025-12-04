# Debug Patch for Entity Reference Fields

Apply these patches to trace the exact failure point in the value update chain.

---

## Patch 1: EntityInstanceNameSelect.tsx

**File:** `apps/web/src/components/shared/ui/EntityInstanceNameSelect.tsx`
**Line:** 186

**FIND:**
```typescript
  // Handle option selection
  const selectOption = useCallback((optionValue: string, optionLabel: string) => {
    // Update local state immediately for instant UI feedback
    setLocalValue(optionValue);
    setLocalLabel(optionLabel);
    // Notify parent (may be async if using Dexie drafts)
    onChange(optionValue, optionLabel);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  }, [onChange]);
```

**REPLACE WITH:**
```typescript
  // Handle option selection
  const selectOption = useCallback((optionValue: string, optionLabel: string) => {
    console.log('🎯 [EntityInstanceNameSelect] selectOption called:', {
      entityCode,
      optionValue,
      optionLabel,
      previousLocalValue: localValue,
      previousLocalLabel: localLabel
    });

    // Update local state immediately for instant UI feedback
    setLocalValue(optionValue);
    setLocalLabel(optionLabel);

    console.log('📞 [EntityInstanceNameSelect] Calling parent onChange...');

    // Notify parent (may be async if using Dexie drafts)
    onChange(optionValue, optionLabel);

    console.log('✅ [EntityInstanceNameSelect] Parent onChange called, closing dropdown');

    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  }, [onChange, entityCode, localValue, localLabel]);
```

---

## Patch 2: registerComponents.tsx

**File:** `apps/web/src/lib/fieldRenderer/registerComponents.tsx`
**Line:** 220

**FIND:**
```typescript
const EntityInstanceNameSelectEdit: React.FC<ComponentRendererProps> = ({
  value,
  field,
  onChange,
  disabled,
  readonly,
}) => {
  const entityCode = field.lookupEntity;

  if (!entityCode) {
    console.warn(`[EntityInstanceNameSelect] Missing lookupEntity for field ${field.key}`);
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
      onChange={(uuid) => onChange?.(uuid)}
      disabled={disabled || readonly}
      placeholder={`Select ${entityCode}...`}
    />
  );
};
```

**REPLACE WITH:**
```typescript
const EntityInstanceNameSelectEdit: React.FC<ComponentRendererProps> = ({
  value,
  field,
  onChange,
  disabled,
  readonly,
}) => {
  const entityCode = field.lookupEntity;

  console.log('🎨 [EntityInstanceNameSelectEdit] Rendering:', {
    fieldKey: field.key,
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
        console.log('🔗 [EntityInstanceNameSelectEdit] onChange triggered:', {
          fieldKey: field.key,
          uuid,
          label,
          hasOnChangeCallback: !!onChange
        });

        if (onChange) {
          console.log('📤 [EntityInstanceNameSelectEdit] Calling parent onChange with uuid:', uuid);
          onChange(uuid);
          console.log('✅ [EntityInstanceNameSelectEdit] Parent onChange completed');
        } else {
          console.error('❌ [EntityInstanceNameSelectEdit] onChange callback is UNDEFINED!');
        }
      }}
      disabled={disabled || readonly}
      placeholder={`Select ${entityCode}...`}
    />
  );
};
```

---

## Patch 3: EntityInstanceFormContainer.tsx (Part 1)

**File:** `apps/web/src/components/shared/entity/EntityInstanceFormContainer.tsx`
**Line:** 174

**FIND:**
```typescript
  // Handle inline field value change
  const handleInlineValueChange = useCallback((value: any) => {
    setInlineEditValue(value);
  }, []);
```

**REPLACE WITH:**
```typescript
  // Handle inline field value change
  const handleInlineValueChange = useCallback((value: any) => {
    console.log('🔄 [EntityInstanceFormContainer] handleInlineValueChange:', {
      field: inlineEditingField,
      newValue: value,
      previousValue: inlineEditValue,
      valueType: typeof value
    });
    setInlineEditValue(value);
    console.log('✅ [EntityInstanceFormContainer] inlineEditValue state updated');
  }, [inlineEditingField, inlineEditValue]);
```

---

## Patch 4: EntityInstanceFormContainer.tsx (Part 2)

**File:** `apps/web/src/components/shared/entity/EntityInstanceFormContainer.tsx`
**Line:** 179

**FIND:**
```typescript
  // Save inline edit (optimistic update)
  const handleInlineSave = useCallback(() => {
    if (!inlineEditingField) return;

    const originalValue = data[inlineEditingField];
    const newValue = inlineEditValue;

    // Only save if value actually changed
    if (newValue !== originalValue) {
      // Update local data immediately for UI feedback
      setLocalData(prev => ({ ...prev, [inlineEditingField]: newValue }));

      // Trigger optimistic update via callback
      if (onInlineSave) {
        onInlineSave(inlineEditingField, newValue);
      }
    }

    // Exit inline edit mode
    setInlineEditingField(null);
    setInlineEditValue(null);
  }, [inlineEditingField, inlineEditValue, data, onInlineSave]);
```

**REPLACE WITH:**
```typescript
  // Save inline edit (optimistic update)
  const handleInlineSave = useCallback(() => {
    console.log('💾 [EntityInstanceFormContainer] handleInlineSave triggered:', {
      inlineEditingField,
      inlineEditValue,
      hasOnInlineSaveCallback: !!onInlineSave
    });

    if (!inlineEditingField) {
      console.warn('⚠️  [EntityInstanceFormContainer] No field being edited, returning');
      return;
    }

    const originalValue = data[inlineEditingField];
    const newValue = inlineEditValue;

    console.log('📊 [EntityInstanceFormContainer] Comparing values:', {
      field: inlineEditingField,
      originalValue,
      newValue,
      changed: newValue !== originalValue,
      originalType: typeof originalValue,
      newType: typeof newValue
    });

    // Only save if value actually changed
    if (newValue !== originalValue) {
      console.log('✏️  [EntityInstanceFormContainer] Value changed, updating localData');

      // Update local data immediately for UI feedback
      setLocalData(prev => {
        const updated = { ...prev, [inlineEditingField]: newValue };
        console.log('📝 [EntityInstanceFormContainer] localData updated:', {
          field: inlineEditingField,
          from: prev[inlineEditingField],
          to: newValue
        });
        return updated;
      });

      // Trigger optimistic update via callback
      if (onInlineSave) {
        console.log('🚀 [EntityInstanceFormContainer] Calling onInlineSave callback');
        onInlineSave(inlineEditingField, newValue);
        console.log('✅ [EntityInstanceFormContainer] onInlineSave callback completed');
      } else {
        console.error('❌ [EntityInstanceFormContainer] onInlineSave callback is UNDEFINED!');
      }
    } else {
      console.log('ℹ️  [EntityInstanceFormContainer] No change detected, skipping save');
    }

    // Exit inline edit mode
    console.log('🔚 [EntityInstanceFormContainer] Exiting inline edit mode');
    setInlineEditingField(null);
    setInlineEditValue(null);
  }, [inlineEditingField, inlineEditValue, data, onInlineSave]);
```

---

## Patch 5: EntitySpecificInstancePage.tsx

**File:** `apps/web/src/pages/shared/EntitySpecificInstancePage.tsx`
**Line:** 824

**FIND:**
```typescript
  const handleInlineSave = useCallback(async (fieldKey: string, value: any) => {
    if (!id) return;

    try {
      // Optimistic update: UI updates instantly, API syncs in background
      await optimisticUpdateEntity(id, { [fieldKey]: value });
    } catch (err) {
      // Error is handled by useOptimisticMutation's onError callback
      console.error('Inline save failed:', err);
    }
  }, [id, optimisticUpdateEntity]);
```

**REPLACE WITH:**
```typescript
  const handleInlineSave = useCallback(async (fieldKey: string, value: any) => {
    console.log('🎯 [EntitySpecificInstancePage] handleInlineSave called:', {
      entityCode,
      entityId: id,
      fieldKey,
      value,
      valueType: typeof value
    });

    if (!id) {
      console.error('❌ [EntitySpecificInstancePage] No entity ID, cannot save');
      return;
    }

    try {
      console.log('🚀 [EntitySpecificInstancePage] Calling optimisticUpdateEntity...');

      // Optimistic update: UI updates instantly, API syncs in background
      await optimisticUpdateEntity(id, { [fieldKey]: value });

      console.log('✅ [EntitySpecificInstancePage] Optimistic update completed successfully');
    } catch (err) {
      // Error is handled by useOptimisticMutation's onError callback
      console.error('❌ [EntitySpecificInstancePage] Inline save failed:', err);
    }
  }, [id, optimisticUpdateEntity, entityCode]);
```

---

## How to Apply Patches

1. Open each file listed above
2. Find the code block using Ctrl+F
3. Replace with the new code (includes console.logs)
4. Save all files

---

## Testing Procedure

1. **Apply all 5 patches**
2. **Restart dev server** (if using hot reload, refresh browser)
3. **Open browser** to http://localhost:5173/project/61203bac-101b-28d6-7a15-2176c15a0b1c
4. **Open DevTools Console** (F12 → Console tab)
5. **Filter console** by typing `Entity` to see only our logs
6. **Clear console** (right-click → Clear console)
7. **Long-press** "Manager Employee Name" field (hold mouse down 500ms)
8. **Select** "James Miller" from dropdown
9. **Click outside** the field
10. **Copy entire console output**

---

## Expected Console Flow (If Working)

```
🎨 [EntityInstanceNameSelectEdit] Rendering: {...}
🎯 [EntityInstanceNameSelect] selectOption called: {...}
📞 [EntityInstanceNameSelect] Calling parent onChange...
🔗 [EntityInstanceNameSelectEdit] onChange triggered: {...}
📤 [EntityInstanceNameSelectEdit] Calling parent onChange with uuid: ...
✅ [EntityInstanceNameSelectEdit] Parent onChange completed
✅ [EntityInstanceNameSelect] Parent onChange called, closing dropdown
🔄 [EntityInstanceFormContainer] handleInlineValueChange: {...}
✅ [EntityInstanceFormContainer] inlineEditValue state updated
💾 [EntityInstanceFormContainer] handleInlineSave triggered: {...}
📊 [EntityInstanceFormContainer] Comparing values: {...}
✏️  [EntityInstanceFormContainer] Value changed, updating localData
📝 [EntityInstanceFormContainer] localData updated: {...}
🚀 [EntityInstanceFormContainer] Calling onInlineSave callback
🎯 [EntitySpecificInstancePage] handleInlineSave called: {...}
🚀 [EntitySpecificInstancePage] Calling optimisticUpdateEntity...
✅ [EntitySpecificInstancePage] Optimistic update completed successfully
✅ [EntityInstanceFormContainer] onInlineSave callback completed
🔚 [EntityInstanceFormContainer] Exiting inline edit mode
```

---

## What to Look For

**If console stops at:**
- `📞 Calling parent onChange` → EntityInstanceNameSelect onChange not firing
- `🔗 onChange triggered` → Wrapper not calling parent
- `🔄 handleInlineValueChange` → FieldRenderer not propagating
- `💾 handleInlineSave triggered` → Click-outside not working
- `🚀 Calling optimistic Update` → onInlineSave not passed correctly
- `✅ Optimistic update completed` → Display not re-rendering

Report the **LAST emoji you see** and I'll know exactly where the chain breaks.
