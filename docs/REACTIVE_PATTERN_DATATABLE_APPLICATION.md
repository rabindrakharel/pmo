# Reactive Entity Field Pattern - Data Table Application

**Version**: 1.0.0
**Date**: 2025-12-04
**Component**: EntityListOfInstancesTable
**Pattern**: Same 5-layer architecture applies

---

## Summary

✅ **YES**, the **Reactive Entity Field Pattern** applies to data tables (EntityListOfInstancesTable) with the same 5-layer architecture. The table already implements all required patterns as of the current codebase.

---

## Layer-by-Layer Application

### Layer 1: Metadata Fetching (Nullable Types) ✅ IMPLEMENTED

**File**: `apps/web/src/pages/shared/EntityListOfInstancesPage.tsx`

```typescript
const {
  viewType: tableViewType,
  editType: tableEditType,
  isLoading: metadataLoading,
} = useEntityInstanceMetadata(entityCode, 'entityListOfInstancesTable');

// Consumer checks for undefined
const tableMetadata = useMemo(() => {
  if (!tableViewType) {
    console.log('[EntityListOfInstancesPage] Metadata still loading');
    return null;
  }
  return { viewType: tableViewType, editType: tableEditType };
}, [tableViewType, tableEditType]);

// Render logic
if (!tableMetadata) {
  return <LoadingSpinner />;  // Shows loading during metadata fetch
}
```

**Status**: ✅ Already using nullable types pattern (v1.1.0)

---

### Layer 2: Reactive Formatting (Format-at-Read) ✅ IMPLEMENTED

**File**: `apps/web/src/pages/shared/EntityListOfInstancesPage.tsx`

```typescript
// v12.6.0: Reactive formatting with datalabel cache subscription
const { data: formattedData } = useFormattedEntityData(
  rawData,
  tableMetadata,
  entityCode
);
// Auto re-formats when:
// - Badge colors change in settings
// - Entity reference names update
// - Datalabel cache invalidates
```

**How It Works**:
1. **TanStack Query** stores raw data: `[{ dl__stage: 'planning' }]`
2. **useFormattedEntityData** hook subscribes to datalabel cache
3. **Auto re-formats** when cache updates (e.g., user changes badge color)
4. **Output**: `{ raw, display: { dl__stage: 'Planning' }, styles: { dl__stage: 'bg-blue-100' } }`

**Status**: ✅ Already using reactive formatting (v12.6.0)

---

### Layer 3: Component Registry (Metadata-Driven) ✅ IMPLEMENTED

**File**: `apps/web/src/components/shared/ui/EntityListOfInstancesTable.tsx`

The table uses **FieldRenderer** for both VIEW and EDIT modes:

```typescript
// VIEW MODE (lines 1850-1870)
<FieldRenderer
  field={fieldProps}
  value={cellValue}
  isEditing={false}
  formattedData={{
    display: formattedRow.display,
    styles: formattedRow.styles
  }}
/>

// EDIT MODE (lines 1900-1950)
<FieldRenderer
  field={fieldProps}
  value={editedData[column.key] ?? cellValue}
  isEditing={true}
  onChange={(v) => handleCellEdit(rowIndex, column.key, v)}
  options={columnOptions}
/>
```

**Component Resolution**:
- `field.renderType = 'badge'` → ViewFieldRenderer renders badge
- `field.inputType = 'BadgeDropdownSelect'` → EditComponentRegistry.get('BadgeDropdownSelect')
- `field.inputType = 'EntityInstanceNameSelect'` → EditComponentRegistry.get('EntityInstanceNameSelect')

**Status**: ✅ Already using FieldRenderer + Component Registry (v12.2.0)

---

### Layer 4: Portal Rendering (React Portal) ✅ IMPLEMENTED

All dropdown components used in the table use portal rendering:

| Component | Portal? | data-dropdown-portal? | Used In |
|-----------|---------|----------------------|---------|
| **BadgeDropdownSelect** | ✅ Yes | ✅ Yes (line 169) | Inline edit datalabel fields |
| **EntityInstanceNameSelect** | ✅ Yes | ✅ Yes (line 311) | Inline edit entity references |
| **EntityInstanceNameMultiSelect** | ✅ Yes | ✅ Yes | Inline edit multi-references |

**Why Portal Rendering?**
- Tables often have `overflow-x: auto` for horizontal scrolling
- Dropdowns would be clipped by table container
- Portal renders at `document.body` → no clipping

**Status**: ✅ All dropdowns use portal pattern

---

### Layer 5: Portal-Aware Handlers (Defense in Depth) ✅ IMPLEMENTED

**File**: `apps/web/src/components/shared/ui/EntityListOfInstancesTable.tsx:763-790`

```typescript
// Cell editing click-outside handler
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement;

  // Check 1: Inside editing cell?
  if (editingCellRef.current?.contains(target)) return;

  // Check 2: Inside ANY portal dropdown? ✅ CRITICAL
  if (target.closest?.('[data-dropdown-portal]')) return;

  // Truly outside - save and close
  const record = paginatedData.find((r, idx) => getRowKey(r, idx) === activeEditingCell.rowId);
  if (record) {
    handleCellSave(activeEditingCell.rowId, activeEditingCell.columnKey, record);
  } else {
    handleCellCancel();
  }
};

// Use mousedown (fires BEFORE click)
document.addEventListener('mousedown', handleClickOutside);
```

**Status**: ✅ Already implements portal-aware pattern (line 770)

---

## Complete Data Table Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                ENTITYLISTOFINSTANCESTABLE INLINE EDIT FLOW                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  USER: Click cell "Project Stage"                                           │
│  ──────────────────────────────────                                         │
│  ↓                                                                           │
│  LAYER 1: Metadata Already Loaded                                           │
│  ────────────────────────────────────                                       │
│  • useEntityInstanceMetadata('project', 'entityListOfInstancesTable')       │
│  • tableMetadata = { viewType, editType }                                   │
│  ↓                                                                           │
│  LAYER 2: Data Already Formatted                                            │
│  ─────────────────────────────────                                          │
│  • useFormattedEntityData(rawData, metadata)                                │
│  • formattedRow = { raw, display, styles }                                  │
│  ↓                                                                           │
│  LAYER 3: FieldRenderer Resolution                                          │
│  ────────────────────────────────────                                       │
│  • isEditing = true                                                          │
│  • field.inputType = 'BadgeDropdownSelect'                                  │
│  • EditComponentRegistry.get('BadgeDropdownSelect')                         │
│  • Renders: <BadgeDropdownSelectEdit />                                     │
│  ↓                                                                           │
│  LAYER 4: Portal Dropdown Renders                                           │
│  ──────────────────────────────────                                         │
│  • BadgeDropdownSelect.setIsOpen(true)                                      │
│  • createPortal(<div data-dropdown-portal ref={dropdownRef}>...</div>)      │
│  ↓                                                                           │
│  USER: Click dropdown option "In Progress"                                  │
│  ───────────────────────────────────────                                    │
│  ↓                                                                           │
│  LAYER 5: Portal-Aware Click-Outside                                        │
│  ─────────────────────────────────────                                      │
│  • mousedown event fires                                                    │
│  • EntityListOfInstancesTable.handleClickOutside():                         │
│    - editingCellRef.contains(option)? NO                                    │
│    - option.closest('[data-dropdown-portal]')? YES ✅                       │
│    - RETURN EARLY (does not call handleCellSave)                            │
│  • BadgeDropdownSelect.handleClickOutside():                                │
│    - buttonRef.contains(option)? NO                                         │
│    - dropdownRef.contains(option)? YES ✅                                   │
│    - RETURN EARLY (does not close dropdown)                                 │
│  • click event fires                                                        │
│  • BadgeDropdownSelect.selectOption():                                      │
│    - onChange('in_progress') fires                                          │
│    - handleCellEdit(rowIndex, 'dl__project_stage', 'in_progress')          │
│    - editedData state updated ✅                                            │
│    - setIsOpen(false)                                                       │
│  ↓                                                                           │
│  USER: Click outside cell (or press Enter)                                  │
│  ──────────────────────────────────────────                                 │
│  • mousedown event fires                                                    │
│  • EntityListOfInstancesTable.handleClickOutside():                         │
│    - target.closest('[data-dropdown-portal]')? NO                           │
│    - handleCellSave(rowId, columnKey, record) executes ✅                   │
│  • onCellSave(rowId, columnKey, value, record) callback                     │
│  • EntityListOfInstancesPage.handleCellSave():                              │
│    - transformForApi({ dl__project_stage: 'in_progress' })                 │
│    - await updateEntity(rowId, transformedData)                             │
│  • PATCH /api/v1/project/{id}                                               │
│  • TanStack Query cache updated                                             │
│  • UI updates immediately (optimistic) ✅                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Differences: Form vs Table

| Aspect | EntityInstanceFormContainer | EntityListOfInstancesTable |
|--------|----------------------------|---------------------------|
| **Edit Mode** | Long-press (500ms hold) | Click cell |
| **State Tracking** | `inlineEditingField` + `inlineEditValue` | `editingCell` + `editedData` |
| **Ref Used** | `editingFieldRef` | `editingCellRef` |
| **Save Trigger** | Click outside | Click outside OR Enter key |
| **Portal Detection** | ✅ Line 295 | ✅ Line 770 |
| **Pattern Version** | v1.1.0 (just fixed) | v1.0.0 (already had it) |

---

## Cell Editing Modes (Table-Specific)

EntityListOfInstancesTable supports TWO editing modes:

### Mode 1: Cell-Level Save (Dropdowns)

**Trigger**: Immediate save on dropdown selection
**Callback**: `onCellSave(rowId, columnKey, value, record)`
**Use Case**: BadgeDropdownSelect, EntityInstanceNameSelect

```typescript
// EntityListOfInstancesPage.tsx
const handleCellSave = useCallback(async (
  rowId: string,
  columnKey: string,
  value: any,
  record: any
) => {
  // Value passed directly - no stale state issues!
  const changeData = { [columnKey]: value };
  const transformedData = transformForApi(changeData, record.raw || record);
  await updateEntity(rowId, transformedData);
}, [updateEntity]);

<EntityListOfInstancesTable
  onCellSave={handleCellSave}  // ✅ Preferred for dropdowns
  // ...
/>
```

### Mode 2: Row-Level Save (Text Fields)

**Trigger**: Explicit Save button or Enter key
**Callback**: `onSaveInlineEdit(record)`
**Use Case**: Text inputs, number inputs

```typescript
const handleSave = useCallback(async (record: any) => {
  // Reads from editedData state
  const transformedData = transformForApi(editedData, record.raw || record);
  await updateEntity(record.id, transformedData);
}, [editedData, updateEntity]);

<EntityListOfInstancesTable
  onSaveInlineEdit={handleSave}  // Fallback for text fields
  // ...
/>
```

**Why Two Modes?**
- **Dropdowns**: Selection is atomic → immediate save preferred
- **Text fields**: User may type multiple characters → save on blur/Enter

---

## Pattern Compliance Checklist (Table-Specific)

### ✅ Layer 1: Metadata Fetching
- [x] Returns `undefined` during load (not `{}`)
- [x] Consumer checks `if (!tableViewType) return null;`
- [x] Uses `useEntityInstanceMetadata(entityCode, 'entityListOfInstancesTable')`

### ✅ Layer 2: Reactive Formatting
- [x] Uses `useFormattedEntityData()` hook
- [x] Subscribes to datalabel cache for badge colors
- [x] Auto re-formats on cache updates

### ✅ Layer 3: Component Registry
- [x] Uses `FieldRenderer` for VIEW and EDIT modes
- [x] Dropdowns resolved via `EditComponentRegistry`
- [x] No hardcoded switch statements

### ✅ Layer 4: Portal Rendering
- [x] All dropdowns use `createPortal(menu, document.body)`
- [x] All dropdowns have `data-dropdown-portal` attribute
- [x] Dropdowns check BOTH `buttonRef` + `dropdownRef`

### ✅ Layer 5: Portal-Aware Handlers
- [x] Uses `target.closest('[data-dropdown-portal]')`
- [x] Returns early if portal detected
- [x] Uses `mousedown` event (not `click`)
- [x] Cleanup in useEffect return

---

## Table-Specific Edge Cases

### Edge Case 1: Filter Dropdown Click-Outside

**Location**: Lines 839-855

The table has a SECOND click-outside handler for filter dropdowns. This one does NOT need portal detection because:
1. Filter dropdowns are NOT portal-rendered
2. They use `filterContainerRef` containment check
3. They only close their own dropdowns (no save action)

```typescript
// Filter dropdown handler - NO portal check needed
const handleClickOutside = (event: MouseEvent) => {
  if (filterContainerRef.current && !filterContainerRef.current.contains(event.target as Node)) {
    setShowFilterDropdown(false);  // Just closes dropdown, no save
  }
};
```

### Edge Case 2: Add Row Inline Edit

**Location**: Lines 1324+

When user clicks "Add Row" button, a new empty row is added with inline editing enabled. This uses the SAME portal-aware pattern:

```typescript
const handleAddRow = () => {
  const newRow = createEmptyRow();
  setEditingCell({ rowId: newRow.id, columnKey: 'name' });  // Auto-focus first field
};
```

The portal detection ensures dropdown selections work correctly for newly added rows.

---

## Migration Status

| Component | Pattern Version | Portal Detection | Status |
|-----------|----------------|------------------|--------|
| **EntityInstanceFormContainer** | v1.1.0 | ✅ Added (2025-12-04) | Just fixed |
| **EntityListOfInstancesTable** | v1.0.0 | ✅ Already had it | No changes needed |
| **BadgeDropdownSelect** | v1.0.0 | ✅ Already had it | No changes needed |
| **EntityInstanceNameSelect** | v1.0.0 | ✅ Already had it | No changes needed |

**Conclusion**: The table was already implementing the correct pattern. The recent fix only applied to **EntityInstanceFormContainer** (form fields, not tables).

---

## Testing Data Tables

To verify the pattern works in tables:

1. Navigate to: `http://localhost:5173/project`
2. Click on a **"Project Stage"** cell (datalabel dropdown)
3. Select a new stage (e.g., "In Progress")
4. **Expected**: Value saves immediately, badge color updates
5. Click on **"Manager Employee Name"** cell (entity reference dropdown)
6. Select a different employee
7. **Expected**: Value saves immediately, display name updates

**Console Logs to Verify**:
```
🎯 Click inside dropdown portal detected, ignoring click-outside  ← Table handler
🎯 [EntityInstanceNameSelect] selectOption called                 ← Dropdown handler
📞 [EntityInstanceNameSelect] Calling parent onChange
✅ Cell value updated
```

---

## Related Documentation

- [REACTIVE_ENTITY_FIELD_PATTERN.md](design_pattern/REACTIVE_ENTITY_FIELD_PATTERN.md) - Main unified pattern
- [BadgeDropdownSelect.md](ui_components/BadgeDropdownSelect.md) - Dropdown component pattern
- [frontend_datasetFormatter.md](services/frontend_datasetFormatter.md) - Reactive formatting hooks
- [EntityListOfInstancesPage.md](ui_pages/EntityListOfInstancesPage.md) - Page-level integration

---

**Last Updated**: 2025-12-04
**Status**: Pattern already implemented in tables
**Action Required**: None - tables already compliant

