# Column Visibility System

**Feature:** Dynamic column selection and visibility management for all entity data tables
**Version:** 1.0.0
**Date:** 2025-11-11
**Status:** ✅ Production Ready

---

## Overview

The Column Visibility System provides users with complete control over which columns are displayed in entity data tables. This feature follows DRY principles by providing a reusable solution that works across all 30+ entity types in the PMO platform.

### Key Features

✅ **Show all available columns by default** - Users see all data immediately
✅ **Toggle individual columns** - Checkbox controls for each column
✅ **Quick actions** - Show All, Hide All, Reset to Default buttons
✅ **localStorage persistence** - Preferences saved per entity type
✅ **Dynamic column discovery** - Auto-detects columns from API response data
✅ **Smart labeling** - Converts snake_case to Title Case automatically
✅ **Reusable across all entities** - Single implementation for 30+ entity types
✅ **Settings entity support** - Respects specialized table types

---

## Architecture

### Components

```
Column Visibility System
├── useColumnVisibility (Hook)           # State management + localStorage
├── ColumnSelector (UI Component)        # Dropdown UI with checkboxes
└── FilteredDataTable (Integration)      # Applies visibility to tables
```

### Data Flow

```
1. Entity config provides base columns
   ↓
2. API returns data with all fields
   ↓
3. useColumnVisibility merges config + discovered columns
   ↓
4. User toggles column visibility
   ↓
5. Preferences saved to localStorage
   ↓
6. FilteredDataTable renders visible columns only
```

---

## Implementation

### 1. useColumnVisibility Hook

**Location:** `apps/web/src/lib/hooks/useColumnVisibility.ts`

**Purpose:** Manages column visibility state with localStorage persistence.

**Features:**
- Discovers all columns from data (even if not in entity config)
- Generates user-friendly labels from column keys
- Persists preferences to localStorage per entity type
- Defaults to showing all columns
- Provides utility functions for bulk operations

**API:**

```typescript
const {
  visibleColumns,      // Column[] - Columns to display
  allColumns,          // Column[] - All available columns
  toggleColumn,        // (key: string) => void
  showAllColumns,      // () => void
  hideAllColumns,      // () => void
  isColumnVisible,     // (key: string) => boolean
  resetToDefault       // () => void - Clears preferences
} = useColumnVisibility(
  entityType,          // string - 'project', 'task', etc.
  configuredColumns,   // Column[] - From entity config
  data                 // any[] - Current data records
);
```

**Column Discovery:**

```typescript
// Configured columns (from entityConfig.ts)
['name', 'code', 'status', 'created_ts']

// Data from API
[
  { id: 'uuid', name: 'Project A', code: 'PROJ-001', status: 'active',
    manager_name: 'John Doe', created_ts: '2025-11-11', budget_amt: 100000 }
]

// Discovered columns (merged)
['name', 'code', 'status', 'created_ts', 'id', 'manager_name', 'budget_amt']

// All columns become available for display ✅
```

**localStorage Structure:**

```json
// Key: column_visibility_[entityType]
{
  "column_visibility_project": {
    "name": true,
    "code": true,
    "status": true,
    "created_ts": false,
    "budget_amt": true,
    "manager_name": true
  }
}
```

### 2. ColumnSelector Component

**Location:** `apps/web/src/components/shared/ui/ColumnSelector.tsx`

**Purpose:** UI component for column visibility controls.

**Features:**
- Dropdown menu with smooth animation
- Checkbox for each column
- Shows column key (technical name) and label (user-friendly)
- Quick action buttons (Show All, Hide All, Reset)
- Displays count: "Showing X of Y columns"
- Click-outside-to-close behavior

**UI Structure:**

```
┌─────────────────────────────────┐
│ Columns (12/15) ▼               │  ← Trigger Button
└─────────────────────────────────┘
      ↓ (click to open)
┌─────────────────────────────────┐
│ Column Visibility                │  ← Header
│ Select which columns to display  │
├─────────────────────────────────┤
│ [Show All] [Hide All] [Reset]   │  ← Quick Actions
├─────────────────────────────────┤
│ ☑ Name                     name  │  ← Column Checkboxes
│ ☑ Code                     code  │
│ ☑ Status                 status  │
│ ☐ Created         created_ts     │
│ ☑ Budget          budget_amt     │
│ ☑ Manager       manager_name     │
│ ...                              │
├─────────────────────────────────┤
│ Showing 12 of 15 columns         │  ← Footer
└─────────────────────────────────┘
```

**Styling:**
- Lucide icons for visual clarity
- Dark theme colors matching PMO design system
- Hover states for interactivity
- Max height with scroll for long column lists

### 3. FilteredDataTable Integration

**Location:** `apps/web/src/components/shared/dataTable/FilteredDataTable.tsx`

**Changes:**

```typescript
// Before: Static columns from config
const columns = config.columns;

// After: Dynamic columns with visibility management
const {
  visibleColumns,
  allColumns,
  toggleColumn,
  showAllColumns,
  hideAllColumns,
  isColumnVisible,
  resetToDefault
} = useColumnVisibility(entityType, configuredColumns, data);

const columns = visibleColumns; // Only visible columns rendered
```

**UI Integration:**

```tsx
<div className="flex items-center justify-between px-6 pt-4">
  {/* Action buttons (left side) */}
  {showActionButtons && <ActionButtonsBar ... />}

  {/* Column selector (right side) */}
  {!isSettingsEntity && (
    <ColumnSelector
      allColumns={allColumns}
      isColumnVisible={isColumnVisible}
      toggleColumn={toggleColumn}
      showAllColumns={showAllColumns}
      hideAllColumns={hideAllColumns}
      resetToDefault={resetToDefault}
    />
  )}
</div>
```

**Positioning:**
- Right-aligned when no action buttons
- Right side of action bar when both present
- Hidden for settings entities (specialized table)

---

## User Workflow

### Basic Usage

1. **Navigate to any entity list page** (e.g., `/project`, `/task`, `/office-hierarchy`)
2. **Click "Columns" button** in top-right corner
3. **Toggle checkboxes** to show/hide columns
4. **Use quick actions** for bulk operations:
   - **Show All**: Display all available columns
   - **Hide All**: Hide all except system columns
   - **Reset**: Restore default visibility (show all)
5. **Preferences auto-save** to localStorage immediately
6. **Refresh page** - Your column preferences persist ✅

### Advanced Scenarios

**Scenario 1: Hiding Noisy Columns**

User wants to focus on key project fields only:
1. Click "Columns" button
2. Click "Hide All"
3. Check only: Name, Code, Status, Manager
4. Click outside to close

Result: Clean, focused view with 4 columns

**Scenario 2: Discovering All Fields**

User wants to see ALL data returned from API:
1. Navigate to entity page (e.g., `/project`)
2. Data loads with default visible columns
3. Click "Columns" button
4. See full list of 15+ columns (including computed fields)
5. Check any hidden columns to reveal them

Result: Complete transparency of all API data

**Scenario 3: Per-Entity Customization**

User wants different columns for different entities:
1. Configure projects: Show budget, timeline, manager
2. Configure tasks: Show assignee, priority, due_date
3. Configure events: Show from_ts, to_ts, platform

Result: Each entity type has independent column preferences

---

## Technical Details

### Column Discovery Algorithm

```typescript
function discoverColumnsFromData(data: any[]): string[] {
  if (!data || data.length === 0) return [];

  // Merge keys from ALL records (handles partial data)
  const allKeys = new Set<string>();
  data.forEach(record => {
    Object.keys(record).forEach(key => allKeys.add(key));
  });

  return Array.from(allKeys);
}
```

**Why this approach?**
- Some records may have optional fields
- Computed fields (JOINs) only appear in data, not config
- New API fields auto-discovered without code changes

### Label Generation

```typescript
function generateColumnLabel(key: string): string {
  // Remove technical prefixes
  let label = key.replace(/^(dl__|f_|d_)/, '');

  // Convert snake_case to Title Case
  label = label
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return label;
}

// Examples:
generateColumnLabel('manager_employee_id')    // → "Manager Employee Id"
generateColumnLabel('dl__project_status')     // → "Project Status"
generateColumnLabel('created_ts')             // → "Created Ts"
```

### Column Merging

```typescript
function mergeColumns(
  configuredColumns: Column[],
  discoveredKeys: string[]
): Column[] {
  const columnMap = new Map<string, Column>();

  // Priority 1: Configured columns (have proper settings)
  configuredColumns.forEach(col => {
    const key = typeof col === 'string' ? col : col.key;
    columnMap.set(key, typeof col === 'string' ?
      { key: col, title: generateColumnLabel(col) } : col
    );
  });

  // Priority 2: Discovered columns (auto-generated settings)
  discoveredKeys.forEach(key => {
    if (!columnMap.has(key)) {
      columnMap.set(key, {
        key,
        title: generateColumnLabel(key),
        sortable: true,
        filterable: true
      });
    }
  });

  return Array.from(columnMap.values());
}
```

**Merge Strategy:**
- Configured columns retain their full configuration (titles, types, etc.)
- Discovered columns get sensible defaults
- No duplicates (Map ensures uniqueness)
- Order preserved: configured first, then discovered

---

## Configuration

### Entity Config

No changes needed! The system automatically works with existing entity configs.

**Before:**
```typescript
project: {
  name: 'project',
  columns: ['name', 'code', 'status', 'manager_name'],
  // ...
}
```

**After:**
```typescript
// Same config, but now users can toggle these columns
// AND see additional columns from API that aren't in config
project: {
  name: 'project',
  columns: ['name', 'code', 'status', 'manager_name'],
  // ...
}
```

### Default Visibility

```typescript
// Show all columns by default (current behavior)
useColumnVisibility(entityType, configuredColumns, data, true);

// Hide all by default (if needed)
useColumnVisibility(entityType, configuredColumns, data, false);
```

### Excluded Entities

Settings entities use specialized SettingsDataTable and don't show ColumnSelector:

```typescript
{!isSettingsEntity && <ColumnSelector ... />}
```

**Why?**
- Settings tables have fixed columns for color coding, ordering, etc.
- Column visibility doesn't make sense for settings management

---

## Benefits

### For Users

✅ **Complete data visibility** - See all fields returned by API
✅ **Customizable views** - Hide noise, focus on what matters
✅ **Persistent preferences** - Don't reconfigure every session
✅ **Per-entity control** - Different columns for different entities
✅ **Quick bulk actions** - Show/hide all with one click

### For Developers

✅ **Zero configuration** - Works with existing entity configs
✅ **DRY principle** - One implementation for all entities
✅ **Auto-discovery** - New API fields appear automatically
✅ **Type-safe** - Full TypeScript support
✅ **Maintainable** - Centralized hook + component

### For Platform

✅ **Transparency** - Users see all available data
✅ **Flexibility** - No need to hardcode "perfect" column sets
✅ **Future-proof** - New columns discovered dynamically
✅ **Accessibility** - Clear labels and controls
✅ **Performance** - localStorage caching

---

## Testing

### Manual Testing Checklist

**Basic Functionality:**
- [ ] Open `/project` page
- [ ] Click "Columns" button
- [ ] Toggle columns on/off
- [ ] Verify table updates immediately
- [ ] Refresh page - preferences persist

**Quick Actions:**
- [ ] Click "Show All" - all columns visible
- [ ] Click "Hide All" - minimal columns visible
- [ ] Click "Reset" - back to defaults

**Multi-Entity:**
- [ ] Configure `/project` columns
- [ ] Navigate to `/task`
- [ ] Verify separate preferences
- [ ] Go back to `/project`
- [ ] Verify project preferences retained

**Column Discovery:**
- [ ] Open entity with computed fields (e.g., `manager_name`)
- [ ] Click "Columns" button
- [ ] Verify computed fields appear in list
- [ ] Toggle computed field visibility

**Edge Cases:**
- [ ] Empty data - no errors
- [ ] Entity with 1 column - works
- [ ] Entity with 50+ columns - scrolls properly
- [ ] localStorage full - graceful degradation

---

## API Impact

**None.** This feature is entirely client-side.

- ✅ No API changes required
- ✅ No database changes required
- ✅ Works with existing API responses
- ✅ Backward compatible with all entities

---

## Browser Compatibility

**localStorage Support:**
- Chrome/Edge: ✅
- Firefox: ✅
- Safari: ✅
- IE11: ⚠️ (fallback to session-only)

**Fallback Behavior:**
- If localStorage unavailable, preferences reset on page refresh
- All functionality still works within same session

---

## Future Enhancements

### Potential Features

1. **Column Reordering**
   - Drag-and-drop to rearrange columns
   - Save custom order to localStorage

2. **Column Pinning**
   - Pin important columns to left/right
   - Frozen columns during horizontal scroll

3. **Column Presets**
   - Save multiple column configurations
   - Quick switch between presets (e.g., "Detailed", "Summary", "Finance")

4. **Column Groups**
   - Organize columns into categories
   - Expand/collapse groups in selector

5. **Export Preferences**
   - Download column config as JSON
   - Share with team members
   - Import saved configurations

6. **Smart Defaults**
   - Learn from user behavior
   - Suggest commonly used columns

---

## Troubleshooting

### Issue: Columns not persisting

**Solution:**
1. Check browser localStorage enabled
2. Check localStorage quota not exceeded
3. Try "Reset" button to clear corrupted state

### Issue: Missing columns in selector

**Possible causes:**
- Data not loaded yet (wait for API response)
- Field not in API response (check network tab)
- Entity config override hiding field

**Debug:**
```javascript
// In browser console:
localStorage.getItem('column_visibility_project')
// Should show: {"name":true,"code":true,...}

// Check if column in data:
console.log(Object.keys(data[0]))
// Should list all fields from API
```

### Issue: ColumnSelector not appearing

**Check:**
- Is this a settings entity? (ColumnSelector hidden for settings)
- FilteredDataTable receiving correct props?
- Component imported correctly?

---

## Code Locations

| File | Purpose |
|------|---------|
| `apps/web/src/lib/hooks/useColumnVisibility.ts` | Hook for state management |
| `apps/web/src/components/shared/ui/ColumnSelector.tsx` | UI component |
| `apps/web/src/components/shared/dataTable/FilteredDataTable.tsx` | Integration point |
| `apps/web/src/lib/hooks/index.ts` | Hook exports |

---

## Commit History

- **2025-11-11** - Initial implementation (v1.0.0)
  - Created useColumnVisibility hook
  - Created ColumnSelector component
  - Integrated into FilteredDataTable
  - Added localStorage persistence
  - Enabled for all non-settings entities

---

## Related Documentation

- [Universal Entity System](./entity_design_pattern/universal_entity_system.md) - DRY entity architecture
- [Entity Coherence Analysis](./ENTITY_COHERENCE_ANALYSIS.md) - DDL/API/Config consistency
- [Column Consistency Update](./entity_design_pattern/COLUMN_CONSISTENCY_UPDATE.md) - Context-independent columns
- [UI/UX Architecture](./entity_ui_ux_route_api.md) - Complete system architecture

---

## Summary

The Column Visibility System provides a **reusable, user-friendly solution** for managing which columns appear in entity data tables. It follows **DRY principles** by working automatically across all 30+ entity types with **zero configuration required**.

**Key Achievements:**
- ✅ Shows all available columns by default
- ✅ Persists user preferences per entity
- ✅ Auto-discovers columns from API data
- ✅ Provides intuitive UI controls
- ✅ Works across entire platform

**Impact:** Users now have complete control over their data views, improving productivity and transparency across the PMO platform.

**Date:** 2025-11-11
**Status:** Production Ready ✅
**Version:** 1.0.0
