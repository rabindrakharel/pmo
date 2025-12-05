# Inline Edit Performance: Action Plan to Industry Standard

> **Version**: 1.0.0 | **Created**: 2025-12-04
> **Goal**: Achieve industry-standard inline editing performance for 10K+ rows

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Critical Behavioral Requirements (9.4)](#2-critical-behavioral-requirements-94)
3. [Future State: Industry Standard](#3-future-state-industry-standard)
4. [Gap Analysis](#4-gap-analysis)
5. [Action Plan](#5-action-plan)
6. [Implementation Details](#6-implementation-details)
7. [Testing Checklist](#7-testing-checklist)

---

## 1. Current State Analysis

### 1.1 Current Architecture (Problem)

**File**: `apps/web/src/components/shared/ui/EntityListOfInstancesTable.tsx`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CURRENT STATE: Dual Source of Truth                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  User types in text field                                                    │
│         │                                                                    │
│         ▼                                                                    │
│  DebouncedInput (maintains local state for instant feedback)                │
│         │                                                                    │
│         ▼ (after 300ms debounce)                                            │
│  onChange(value) → handleCellValueChange(rowId, columnKey, value)           │
│         │                                                                    │
│         ├─────────────────────────────────────────────┐                     │
│         ▼                                             ▼                     │
│  setLocalCellValue(value)           onInlineEdit(rowId, columnKey, value)   │
│  [STATE UPDATE #1]                  [STATE UPDATE #2 → editedData]          │
│         │                                             │                     │
│         └─────────────────────┬───────────────────────┘                     │
│                               ▼                                              │
│              ENTIRE TABLE RE-RENDERS (2x per debounce)                      │
│                               │                                              │
│                               ▼                                              │
│              10,000 rows affected = SLUGGISH TYPING                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Current Code (Lines 466-472)

```typescript
// CURRENT: Updates TWO states on every debounced keystroke
const handleCellValueChange = useCallback((rowId: string, columnKey: string, value: any) => {
  setLocalCellValue(value);                    // ← State update #1 (re-render)
  if (onInlineEdit) {
    onInlineEdit(rowId, columnKey, value);     // ← State update #2 (re-render)
  }
}, [onInlineEdit]);
```

### 1.3 Current Value Source (Lines 1981, 2002)

```typescript
// CURRENT: Conditional value source = race condition risk
value={(isCellBeingEdited ? localCellValue : editedData[column.key]) ?? rawValue}
```

### 1.4 Current State Variables

| Variable | Location | Purpose | Problem |
|----------|----------|---------|---------|
| `localCellValue` | Line 364 | Current value during cell edit | Updated every debounce → re-render |
| `editedData` | Parent prop | Accumulated field changes | Updated every debounce → re-render |
| `editingCell` | Line 363 | Which cell is being edited | OK |
| `undoStack` | Line 369 | Undo history | OK |

### 1.5 Current Issues Summary

- **2 state updates per debounce** = 2 parent re-renders
- **Entire table re-renders** on each state update (even with virtualization)
- **Conditional value source** creates race conditions on fast typing
- **Options arrays recreated** every render (`.map()` inline)
- **No React.memo** on row components
- **10K rows = unusable** typing lag

---

## 2. Critical Behavioral Requirements (9.4)

These requirements MUST be preserved in the future state:

### 2.1 Edit Modes (MUST support both)

| Mode | Trigger | Behavior | State Used |
|------|---------|----------|------------|
| **Cell-Level** | Single-click cell | Edit THAT cell only | `editingCell`, `localCellValue` |
| **Row-Level** | Edit icon (✏️) or 'E' key | Edit entire row | `editingRow`, `editedData` |

### 2.2 Input Type Behaviors

| Input Type | Behavior | Save Trigger | Parent Updates |
|------------|----------|--------------|----------------|
| **Text/Textarea** | DebouncedInput (300ms) | Blur or Enter | Only on commit |
| **Dropdown** | Immediate selection | Selection click | Only on commit |
| **Date/DateTime** | Picker | Picker close | Only on commit |
| **Checkbox** | Toggle | Click | Only on commit |

### 2.3 Non-Negotiable Behaviors

```
✓ Dropdowns MUST save immediately (atomic action)
✓ Text fields MUST debounce (reduce re-renders)
✓ Undo MUST work (Cmd+Z restores previous value)
✓ Tab navigation MUST work (spreadsheet convention)
✓ Add Row MUST use editedData (accumulated for POST)
✓ Cell Save MUST use valueOverride (avoid stale state)
✓ Portal dropdowns MUST NOT close on option click
```

### 2.4 Critical Flows That Must Continue Working

```
1. CELL-LEVEL INLINE EDIT
   Click cell → type → blur → value saved to API

2. DROPDOWN SELECTION
   Click cell → dropdown opens → click option → saved immediately

3. ROW-LEVEL EDIT (Edit icon)
   Click ✏️ → edit multiple fields → click ✓ → all changes saved

4. ADD NEW ROW
   Click "+ Add" → fill fields → click ✓ → POST creates entity

5. UNDO (Cmd+Z)
   Edit cell → save → Cmd+Z → previous value restored

6. TAB NAVIGATION
   Edit cell → Tab → next editable cell focused

7. ESCAPE TO CANCEL
   Edit cell → Escape → original value restored
```

### 2.5 Dependencies on editedData

| Feature | Uses `editedData`? | Safe to Remove During Cell Edit? |
|---------|-------------------|----------------------------------|
| Cell-level save | No (uses `valueOverride`) | ✅ Yes |
| Row-level save | **Yes** (accumulates) | ❌ No |
| Add Row save | **Yes** (accumulates) | ❌ No |
| Undo | No (uses `undoStack`) | ✅ Yes |

---

## 3. Future State: Industry Standard

### 3.1 Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FUTURE STATE: Cell-Isolated Ephemeral State              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  User types in text field                                                    │
│         │                                                                    │
│         ▼                                                                    │
│  DebouncedInput (maintains LOCAL state for instant feedback)                │
│         │                                                                    │
│         │  ← User sees instant feedback (zero parent updates)               │
│         │                                                                    │
│         ▼ (on blur/Enter - COMMIT ONLY)                                     │
│  handleCellSave(rowId, columnKey, record, value)                            │
│         │                                    ↑                               │
│         │                           value passed directly                   │
│         ▼                           (no stale state)                        │
│  onCellSave(rowId, columnKey, valueToSave, record)                          │
│         │                                                                    │
│         ▼                                                                    │
│  Optimistic Update → Cache + API PATCH                                      │
│                                                                              │
│  RESULT: 0 re-renders during typing, instant feedback                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Future Code: handleCellValueChange

```typescript
// FUTURE: NO-OP for cell-level edits (cell manages own state)
const handleCellValueChange = useCallback((_rowId: string, _columnKey: string, _value: any) => {
  // NO-OP: DebouncedInput manages its own local state for instant feedback
  // Value is passed directly to handleCellSave on blur/enter via valueOverride
  // This eliminates ALL parent re-renders during typing

  // NOTE: Row-level and Add Row flows still use editedData via handleFieldChange
}, []);
```

### 3.3 Future Code: Text Field Rendering

```typescript
// FUTURE: Pass rawValue, let DebouncedInput manage local state
// On blur/change commit, call handleCellSave directly with value
renderEditModeFromMetadata(
  rawValue,  // ← Always use rawValue (DebouncedInput has its own local state)
  metadata,
  (val) => {
    // DebouncedInput calls this after debounce or on blur
    // Directly trigger save - no intermediate state updates
    handleCellSave(recordId, column.key, record, val);
  },
  {
    className: 'w-full px-2 py-1 text-sm border border-dark-300 rounded',
    autoFocus: isCellBeingEdited
  }
);
```

### 3.4 Future Code: Dropdown Rendering

```typescript
// FUTURE: Direct save on selection (already almost correct)
<BadgeDropdownSelect
  value={rawValue ?? ''}  // ← Use rawValue (dropdown saves immediately anyway)
  options={memoizedColumnOptions}  // ← Memoized (prevents re-render)
  onChange={(value) => {
    // Direct save - no handleCellValueChange needed
    handleCellSave(recordId, column.key, record, value);
  }}
  onClick={(e) => e.stopPropagation()}
/>
```

### 3.5 Future Code: Memoized Options

```typescript
// FUTURE: Memoize options arrays to prevent unnecessary re-renders
const memoizedColumnOptions = useMemo(() => {
  if (!columnOptions) return [];
  return columnOptions.map(opt => ({
    value: opt.value,
    label: opt.label,
    metadata: { color_code: opt.colorClass }
  }));
}, [columnOptions]);
```

### 3.6 Future Code: Memoized Row Component (Optional Enhancement)

```typescript
// FUTURE: Wrap row rendering in React.memo for large datasets
const MemoizedTableRow = React.memo<{
  record: T;
  columns: Column<T>[];
  index: number;
  // ... other props
}>(({ record, columns, index, ...props }) => {
  // Row rendering logic
  return (
    <tr>
      {columns.map(column => (
        <td key={column.key}>
          {/* Cell content */}
        </td>
      ))}
    </tr>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if this row's data changed
  return (
    prevProps.record.id === nextProps.record.id &&
    prevProps.record.updated_ts === nextProps.record.updated_ts &&
    prevProps.isEditing === nextProps.isEditing
  );
});
```

---

## 4. Gap Analysis

### 4.1 Feature Comparison

| Feature | Current | Future | Change Required |
|---------|---------|--------|-----------------|
| Cell-isolated state | ❌ Dual updates | ✅ Commit-only | **FIX** |
| Parent re-renders during typing | ❌ 2 per debounce | ✅ 0 | **FIX** |
| Virtualization | ✅ Have it | ✅ Keep | None |
| Memoized rows (React.memo) | ❌ Missing | ✅ Add | **ENHANCE** |
| Memoized options arrays | ❌ Inline `.map()` | ✅ useMemo | **FIX** |
| Memoized callbacks | ✅ useCallback | ✅ Keep | None |
| Row-level edit | ✅ Works | ✅ Unchanged | None |
| Add Row | ✅ Works | ✅ Unchanged | None |
| Undo/Redo | ✅ Works | ✅ Unchanged | None |

### 4.2 Performance Comparison

| Metric | Current | Future |
|--------|---------|--------|
| Re-renders per keystroke | 2 | 0 |
| State sources during edit | 2 (localCellValue + editedData) | 1 (cell-local) |
| Options array recreation | Every render | Once (memoized) |
| 10K row support | ❌ Sluggish | ✅ Smooth |

---

## 5. Action Plan

### Phase 1: Core Performance Fix (Critical)

| Step | Task | File | Lines | Priority |
|------|------|------|-------|----------|
| 1.1 | Modify `handleCellValueChange` to NO-OP | EntityListOfInstancesTable.tsx | 466-472 | **P0** |
| 1.2 | Update text field rendering to call `handleCellSave` directly | EntityListOfInstancesTable.tsx | 2001-2009 | **P0** |
| 1.3 | Update dropdown rendering to call `handleCellSave` directly | EntityListOfInstancesTable.tsx | 1987-1992 | **P0** |
| 1.4 | Simplify value source to use `rawValue` | EntityListOfInstancesTable.tsx | 1981, 2002 | **P0** |

### Phase 2: Memoization (Enhancement)

| Step | Task | File | Lines | Priority |
|------|------|------|-------|----------|
| 2.1 | Memoize column options with `useMemo` | EntityListOfInstancesTable.tsx | 1982-1986 | **P1** |
| 2.2 | Memoize dropdown onChange handler | EntityListOfInstancesTable.tsx | 1987-1993 | **P1** |
| 2.3 | Consider React.memo on row component | EntityListOfInstancesTable.tsx | TBD | **P2** |

### Phase 3: Validation & Testing

| Step | Task | Priority |
|------|------|----------|
| 3.1 | Test all 7 critical flows | **P0** |
| 3.2 | Test with 10K rows | **P0** |
| 3.3 | Verify row-level edit still works | **P0** |
| 3.4 | Verify add row still works | **P0** |
| 3.5 | Verify undo/redo works | **P1** |

---

## 6. Implementation Details

### 6.1 Step 1.1: Modify handleCellValueChange

**Location**: Lines 466-472

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// BEFORE
// ═══════════════════════════════════════════════════════════════════════════
const handleCellValueChange = useCallback((rowId: string, columnKey: string, value: any) => {
  setLocalCellValue(value);
  if (onInlineEdit) {
    onInlineEdit(rowId, columnKey, value);
  }
}, [onInlineEdit]);

// ═══════════════════════════════════════════════════════════════════════════
// AFTER
// ═══════════════════════════════════════════════════════════════════════════
const handleCellValueChange = useCallback((_rowId: string, _columnKey: string, _value: any) => {
  // v13.0.0: Cell-Isolated State Pattern (Industry Standard)
  // ─────────────────────────────────────────────────────────
  // NO-OP for cell-level edits. DebouncedInput manages its own local state.
  // Value is passed directly to handleCellSave on blur/enter via valueOverride.
  // This eliminates ALL parent re-renders during typing.
  //
  // NOTE: Row-level edit and Add Row flows still use editedData via their
  // own handlers (handleFieldChange). This change only affects cell-level edits.
}, []);
```

### 6.2 Step 1.2: Update Text Field Rendering

**Location**: Lines 1997-2012

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// BEFORE
// ═══════════════════════════════════════════════════════════════════════════
) : (
  // ALL OTHER FIELDS - Backend-driven renderer with auto-focus
  <div onClick={(e) => e.stopPropagation()}>
    {(() => {
      const metadata = (column as any).backendMetadata || { inputType: 'text', label: column.key };
      return renderEditModeFromMetadata(
        (isCellBeingEdited ? localCellValue : editedData[column.key]) ?? rawValue,
        metadata,
        (val) => handleCellValueChange(recordId, column.key, val),
        {
          className: 'w-full px-2 py-1 text-sm border border-dark-300 rounded focus:outline-none focus:border-dark-500',
          autoFocus: isCellBeingEdited
        }
      );
    })()}
  </div>
)

// ═══════════════════════════════════════════════════════════════════════════
// AFTER
// ═══════════════════════════════════════════════════════════════════════════
) : (
  // ALL OTHER FIELDS - Backend-driven renderer with auto-focus
  // v13.0.0: Cell-Isolated State - DebouncedInput manages local state,
  // onChange triggers handleCellSave directly (commit-only pattern)
  <div onClick={(e) => e.stopPropagation()}>
    {(() => {
      const metadata = (column as any).backendMetadata || { inputType: 'text', label: column.key };
      return renderEditModeFromMetadata(
        rawValue,  // ← Use rawValue only (DebouncedInput has its own local state)
        metadata,
        (val) => {
          // v13.0.0: Direct save on commit (blur/enter from DebouncedInput)
          handleCellSave(recordId, column.key, record, val);
        },
        {
          className: 'w-full px-2 py-1 text-sm border border-dark-300 rounded focus:outline-none focus:border-dark-500',
          autoFocus: isCellBeingEdited
        }
      );
    })()}
  </div>
)
```

### 6.3 Step 1.3: Update Dropdown Rendering

**Location**: Lines 1978-1995

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// BEFORE
// ═══════════════════════════════════════════════════════════════════════════
) : inputType === 'component' && hasLabelsMetadata ? (
  <BadgeDropdownSelect
    value={(isCellBeingEdited ? localCellValue : editedData[column.key]) ?? rawValue ?? ''}
    options={columnOptions.map(opt => ({
      value: opt.value,
      label: opt.label,
      metadata: { color_code: opt.colorClass }
    }))}
    onChange={(value) => {
      handleCellValueChange(recordId, column.key, value);
      if (isCellBeingEdited) {
        setTimeout(() => handleCellSave(recordId, column.key, record, value), 0);
      }
    }}
    onClick={(e) => e.stopPropagation()}
  />

// ═══════════════════════════════════════════════════════════════════════════
// AFTER
// ═══════════════════════════════════════════════════════════════════════════
) : inputType === 'component' && hasLabelsMetadata ? (
  // v13.0.0: Cell-Isolated State - Direct save on selection
  <BadgeDropdownSelect
    value={rawValue ?? ''}  // ← Use rawValue (dropdown saves immediately)
    options={columnOptions.map(opt => ({
      value: opt.value,
      label: opt.label,
      metadata: { color_code: opt.colorClass }
    }))}
    onChange={(value) => {
      // v13.0.0: Direct save - no intermediate state updates
      handleCellSave(recordId, column.key, record, value);
    }}
    onClick={(e) => e.stopPropagation()}
  />
```

### 6.4 Step 2.1: Memoize Column Options (Enhancement)

**Add near line 720** (before virtualization setup):

```typescript
// v13.0.0: Memoize column options to prevent unnecessary re-renders
// This is computed once per column config change, not on every render
const getColumnOptions = useCallback((column: Column<T>) => {
  const editType = extractEditType((column as any).backendMetadata);
  const lookupField = editType?.lookupField || column.key;
  const options = getDatalabelSync(lookupField);

  if (!options) return null;

  return options.map(opt => ({
    value: opt.value,
    label: opt.label,
    colorClass: opt.metadata?.color_code
      ? colorCodeToTailwindClass(opt.metadata.color_code)
      : 'bg-gray-100 text-gray-600'
  }));
}, []);
```

---

## 7. Testing Checklist

### 7.1 Critical Flow Tests

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 1 | Cell-level text edit | Click cell → type "test" → click outside | Value saved, no lag during typing |
| 2 | Cell-level dropdown | Click cell → select option | Saved immediately, dropdown closes |
| 3 | Row-level edit | Click ✏️ → edit multiple fields → click ✓ | All changes saved |
| 4 | Add new row | Click "+ Add" → fill fields → click ✓ | New entity created |
| 5 | Undo | Edit cell → save → Cmd+Z | Previous value restored |
| 6 | Tab navigation | Edit cell → Tab | Next editable cell focused |
| 7 | Escape to cancel | Edit cell → type → Escape | Original value restored |

### 7.2 Performance Tests

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 8 | Fast typing | Type rapidly in text field | Zero lag, instant feedback |
| 9 | 1K rows | Load 1,000 rows → edit cell | Smooth typing |
| 10 | 10K rows | Load 10,000 rows → edit cell | Smooth typing |
| 11 | Multiple edits | Edit 10 cells in sequence | Each edit responsive |

### 7.3 Edge Case Tests

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 12 | Portal click | Click dropdown option | Saves correctly, no premature close |
| 13 | Blur during debounce | Type → blur before debounce | Final value saved |
| 14 | Cancel during edit | Edit → Escape → re-edit | Clean state, no stale values |
| 15 | Concurrent edits | Edit cell A → Tab to B → edit → Tab to C | All values preserved |

---

## Summary

### Changes Required

| Priority | Change | Impact |
|----------|--------|--------|
| **P0** | `handleCellValueChange` → NO-OP | Eliminates 2 re-renders per debounce |
| **P0** | Text field → direct `handleCellSave` | Commit-only pattern |
| **P0** | Dropdown → direct `handleCellSave` | Remove redundant call |
| **P0** | Value source → `rawValue` | Eliminate conditional |
| **P1** | Memoize options arrays | Prevent recreation |
| **P2** | React.memo on rows | Further optimization |

### Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Re-renders per keystroke | 2 | 0 |
| 10K row editing | Sluggish | Smooth |
| Industry alignment | 50% | 90%+ |

### Files Modified

1. `apps/web/src/components/shared/ui/EntityListOfInstancesTable.tsx`
   - Lines 466-472: `handleCellValueChange`
   - Lines 1978-1995: Dropdown rendering
   - Lines 1997-2012: Text field rendering
   - Lines 2251-2284: Regular (non-virtualized) rendering

### Preserved Functionality

- ✅ Row-level edit (uses `editedData`)
- ✅ Add Row (uses `editedData`)
- ✅ Undo/Redo (uses `undoStack`)
- ✅ Tab navigation
- ✅ Escape to cancel
- ✅ Portal-aware click-outside
