# BadgeDropdownSelect Component

**Version:** 12.2.0 | **Location:** `apps/web/src/components/shared/ui/BadgeDropdownSelect.tsx`

> **Note:** As of v12.2.0, BadgeDropdownSelect is registered in the **EditComponentRegistry** and resolved automatically by FieldRenderer when `inputType='component'` with `component='BadgeDropdownSelect'`.

---

## Overview

BadgeDropdownSelect is a shared dropdown component for selecting datalabel values with colored badge rendering. It uses React Portal for rendering to avoid table overflow clipping and dynamically positions itself based on available viewport space.

**Core Principles:**
- Pure presentation component (no API calls)
- Portal rendering for table compatibility
- Options loaded from datalabel cache via `getDatalabelSync()`
- **v12.2.0:** Registered in `EditComponentRegistry` as `'BadgeDropdownSelect'`
- Backend metadata drives rendering via `inputType: 'component'` with `component: 'BadgeDropdownSelect'`

---

## Business Use Case

### The Problem: Datalabel Status Fields

In enterprise applications, status/stage/priority fields require:
1. **Visual distinction** - Color-coded badges for quick recognition (e.g., red = high priority, green = completed)
2. **Consistent options** - Dropdown with predefined values from database (`datalabel_*` tables)
3. **Reusability** - Same dropdown logic needed across tables, forms, kanban boards
4. **Table compatibility** - Dropdown must work inside scrollable tables without clipping

### The Solution: DRY Shared Component

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  BADGEDROPDOWNSELECT - DRY REUSABILITY                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Before v8.3.2:                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ EntityListOfInstancesTable │  │ EntityForm      │  │ LabelsDataTable │             │
│  │ (own dropdown)  │  │ (own dropdown)  │  │ (own dropdown)  │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                       │
│           ▼                    ▼                    ▼                       │
│    [Duplicated code: portal, positioning, badge styling, event handling]    │
│                                                                              │
│  After v8.3.2 (DRY):                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ EntityListOfInstancesTable │  │ EntityForm      │  │ LabelsDataTable │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                       │
│           └────────────────────┼────────────────────┘                       │
│                                ▼                                             │
│                    ┌─────────────────────┐                                  │
│                    │ BadgeDropdownSelect │ ◄── Single source of truth       │
│                    │ (shared component)  │                                  │
│                    └─────────────────────┘                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Consumers (DRY Principle)

| Consumer | Context | Use Case |
|----------|---------|----------|
| **EntityListOfInstancesTable** | Inline table editing | Edit `dl__project_stage` in entity list |
| **EntityInstanceFormContainer** | Form fields | Edit datalabel fields in entity detail page |
| **LabelsDataTable** | Settings admin | Select `color_code` for datalabel options |
| **KanbanView** | Card editing | Change status/stage via dropdown |

---

## Props Interface

```typescript
export interface BadgeDropdownSelectOption {
  value: string | number;
  label: string;
  metadata?: {
    color_code?: string;  // Tailwind classes (e.g., 'bg-blue-100 text-blue-700')
  };
}

export interface BadgeDropdownSelectProps {
  /** Current selected value */
  value: string;

  /** Array of selectable options with optional color metadata */
  options: BadgeDropdownSelectOption[];

  /** Callback when selection changes */
  onChange: (value: string) => void;

  /** Optional click handler (for event propagation control) */
  onClick?: (e: React.MouseEvent) => void;

  /** Placeholder text when no value selected */
  placeholder?: string;

  /** Disable the dropdown */
  disabled?: boolean;
}
```

---

## Key Features

### 1. Portal Rendering

Dropdown menu renders via `createPortal` to `document.body`, avoiding CSS `overflow: hidden` issues in tables:

```typescript
{dropdownOpen && createPortal(
  <div ref={dropdownRef} style={{ position: 'absolute', zIndex: 9999 }}>
    {/* Options */}
  </div>,
  document.body
)}
```

### 2. Dynamic Positioning

Automatically opens upward or downward based on available viewport space:

```typescript
const shouldOpenUpward = spaceBelow < estimatedContentHeight && spaceAbove > spaceBelow;

// Position calculation
if (shouldOpenUpward) {
  top = rect.top + window.scrollY - availableHeight - 4;
} else {
  top = rect.bottom + window.scrollY + 4;
}
```

### 3. Auto-Update on Scroll/Resize

Position updates when user scrolls or resizes window:

```typescript
useEffect(() => {
  if (dropdownOpen) {
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }
}, [dropdownOpen]);
```

### 4. Colored Badge Options

Each option renders as a colored badge using Tailwind classes:

```typescript
<span className={`rounded-full text-xs font-medium ${opt.metadata?.color_code || 'bg-gray-100 text-gray-600'}`}>
  {opt.label}
</span>
```

---

## FieldRenderer Integration (v12.2.0)

### Component Registration

BadgeDropdownSelect is registered in the EditComponentRegistry at app initialization:

```typescript
// apps/web/src/lib/fieldRenderer/registerComponents.tsx
import { registerEditComponent } from './ComponentRegistry';
import { BadgeDropdownSelect } from '@/components/shared/ui/BadgeDropdownSelect';

// Wrapper to conform to ComponentRendererProps interface
const BadgeDropdownSelectEdit: FC<ComponentRendererProps> = ({
  value,
  options,
  onChange,
  disabled,
}) => (
  <BadgeDropdownSelect
    value={value ?? ''}
    options={options?.map(opt => ({
      value: opt.value,
      label: opt.label,
      metadata: { color_code: opt.colorClass },
    })) ?? []}
    onChange={onChange}
    disabled={disabled}
  />
);

registerEditComponent('BadgeDropdownSelect', BadgeDropdownSelectEdit);
```

### Resolution Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  BADGEDROPDOWNSELECT RESOLUTION (v12.2.0)                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Backend Metadata (editType):                                                │
│  ─────────────────────────────                                              │
│  dl__project_stage: {                                                        │
│    inputType: 'component',                 // MUST be 'component' when component is set │
│    component: 'BadgeDropdownSelect',                                         │
│    lookupSourceTable: 'datalabel',                                           │
│    lookupField: 'dl__project_stage'                                          │
│  }                                                                           │
│                                                                              │
│  FieldRenderer Resolution:                                                   │
│  ─────────────────────────                                                   │
│  1. Check vizContainer.edit → 'BadgeDropdownSelect'                         │
│  2. EditComponentRegistry.get('BadgeDropdownSelect') → BadgeDropdownSelectEdit │
│  3. Render <BadgeDropdownSelectEdit value={...} options={...} onChange={...}/> │
│                                                                              │
│  Options Loading (Sync):                                                     │
│  ───────────────────────                                                    │
│  const options = getDatalabelSync('dl__project_stage');                      │
│  // Returns: [{ value, label, colorClass }, ...]                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### FieldRenderer Usage

With v12.2.0, no switch statement is needed. FieldRenderer handles resolution:

```typescript
// EntityInstanceFormContainer.tsx (v12.2.0)
import { FieldRenderer } from '@/lib/fieldRenderer';

{fields.map(field => (
  <FieldRenderer
    key={field.key}
    field={field}                    // { inputType: 'component', component: 'BadgeDropdownSelect' }
    value={data[field.key]}
    isEditing={true}
    onChange={(v) => handleChange(field.key, v)}
    options={labelsMetadata.get(field.key)}  // Pre-loaded from getDatalabelSync()
  />
))}

// FieldRenderer internally calls:
// EditComponentRegistry.get('BadgeDropdownSelect') → renders <BadgeDropdownSelectEdit />
```

---

## Integration Patterns (Legacy)

> **Note:** These patterns are from v11.x and earlier. v12.2.0 uses FieldRenderer instead.

### With EntityListOfInstancesTable (Inline Editing)

```typescript
// EntityListOfInstancesTable.tsx - Inline cell editing (legacy v11.x)
case 'select':
  if (hasLabelsMetadata) {
    return (
      <BadgeDropdownSelect
        value={editedData[column.key] ?? rawValue ?? ''}
        options={columnOptions.map(opt => ({
          value: opt.value,
          label: opt.label,
          metadata: { color_code: opt.colorClass }
        }))}
        onChange={(newValue) => handleCellEdit(rowIndex, column.key, newValue)}
      />
    );
  }
```

### With EntityInstanceFormContainer (Form Fields)

```typescript
// EntityInstanceFormContainer.tsx - Form field rendering (legacy v11.x)
case 'BadgeDropdownSelect':
case 'select':
  if (hasLabelsMetadata && options.length > 0) {
    const coloredOptions = options.map(opt => ({
      value: opt.value,
      label: opt.label,
      metadata: { color_code: opt.colorClass || 'bg-gray-100 text-gray-600' }
    }));

    return (
      <BadgeDropdownSelect
        value={value ?? ''}
        options={coloredOptions}
        onChange={(newValue) => handleFieldChange(field.key, newValue)}
        placeholder="Select..."
        disabled={field.disabled}
      />
    );
  }
```

### With LabelsDataTable (Settings Admin)

```typescript
// LabelsDataTable.tsx - Color picker for datalabel options
case 'color_code':
  return (
    <BadgeDropdownSelect
      value={String(editValue)}
      options={COLOR_OPTIONS}  // From settingsConfig.tsx
      onChange={(newValue) => setEditingData({ ...editingData, color_code: newValue })}
      placeholder="Select color..."
    />
  );
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  DATA FLOW: Datalabel → BadgeDropdownSelect                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. LOGIN: Datalabels fetched once via GET /api/v1/datalabel/all            │
│     └── Stored in TanStack Query + Dexie (v12.0.0)                          │
│     └── TTL: 1 hour                                                          │
│                                                                              │
│  2. API RESPONSE:                                                            │
│     metadata.entityInstanceFormContainer.editType.dl__project_stage = {     │
│       inputType: "component",                                                │
│       component: "BadgeDropdownSelect",                                      │
│       lookupSourceTable: "datalabel",                                        │
│       lookupField: "dl__project_stage"                                       │
│     }                                                                        │
│                                                                              │
│  3. COMPONENT MOUNT: Read from TanStack sync cache (v12.0.0)                │
│     const cachedOptions = getDatalabelSync('dl__project_stage');            │
│     // Returns: [{id, name, color_code, sort_order, ...}]                    │
│                                                                              │
│  4. TRANSFORM: DatalabelOption[] → BadgeDropdownSelectOption[]              │
│     const options = cachedOptions.map(opt => ({                             │
│       value: opt.name,           // Use name as value                        │
│       label: opt.name,           // Display label                            │
│       metadata: {                                                            │
│         color_code: colorCodeToTailwindClass(opt.color_code)                │
│       }                                                                      │
│     }));                                                                     │
│                                                                              │
│  5. RENDER: <BadgeDropdownSelect options={options} ... />                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## YAML Configuration

Backend metadata configures BadgeDropdownSelect via `edit-type-mapping.yaml`:

```yaml
# Standard datalabel fields (non-DAG)
datalabel:
  dtype: str
  lookupSourceTable: datalabel    # v12.0.0: renamed from lookupSource
  entityListOfInstancesTable:
    renderType: badge
    inputType: component           # MUST be 'component' when component is specified
    component: DataLabelSelect
    behavior: { editable: true, filterable: true }
  entityInstanceFormContainer:
    inputType: component
    component: DataLabelSelect
  # lookupField auto-set by backend-formatter.service.ts

# DAG datalabels (stage/state/status with parent-child)
datalabel_dag:
  dtype: str
  lookupSourceTable: datalabel    # v12.0.0: renamed from lookupSource
  entityListOfInstancesTable:
    renderType: component
    component: DAGVisualizer
  entityInstanceFormContainer:
    inputType: component           # MUST be 'component' when component is specified
    component: BadgeDropdownSelect
  # lookupField auto-set by backend-formatter.service.ts
```

---

## Color System

### Predefined Colors (settingsConfig.tsx)

```typescript
export const COLOR_OPTIONS = [
  { value: 'blue', label: 'Blue', metadata: { color_code: 'bg-blue-100 text-blue-700' } },
  { value: 'purple', label: 'Purple', metadata: { color_code: 'bg-purple-100 text-purple-800' } },
  { value: 'green', label: 'Green', metadata: { color_code: 'bg-green-100 text-green-800' } },
  { value: 'red', label: 'Red', metadata: { color_code: 'bg-red-100 text-red-700' } },
  { value: 'yellow', label: 'Yellow', metadata: { color_code: 'bg-yellow-100 text-yellow-800' } },
  { value: 'orange', label: 'Orange', metadata: { color_code: 'bg-orange-100 text-orange-700' } },
  { value: 'gray', label: 'Gray', metadata: { color_code: 'bg-gray-100 text-gray-600' } },
  { value: 'cyan', label: 'Cyan', metadata: { color_code: 'bg-cyan-100 text-cyan-700' } },
  { value: 'pink', label: 'Pink', metadata: { color_code: 'bg-pink-100 text-pink-700' } },
  { value: 'amber', label: 'Amber', metadata: { color_code: 'bg-amber-100 text-amber-700' } },
];
```

### Color Conversion (valueFormatters.ts)

Database stores simple color names; frontend converts to Tailwind classes:

```typescript
export function colorCodeToTailwindClass(colorCode: string): string {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-700',
    // ...
  };
  return colorMap[colorCode] || 'bg-gray-100 text-gray-600';
}
```

---

## Visual Design

### Selected Value Display

```
┌────────────────────────────────────────────┐
│  [In Progress ▾]                           │ ← Colored badge + chevron
└────────────────────────────────────────────┘
```

### Dropdown Menu (Portal Rendered)

```
┌────────────────────────────────────────────┐
│  [Planning]      ← Gray badge              │
│  [In Progress]   ← Blue badge (selected)   │
│  [Review]        ← Yellow badge            │
│  [Completed]     ← Green badge             │
│  [Cancelled]     ← Red badge               │
└────────────────────────────────────────────┘
```

---

## Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Inline dropdown in table (clipped) | Use BadgeDropdownSelect with portal |
| Duplicate dropdown code across components | Import shared BadgeDropdownSelect |
| Hardcoded color strings | Use `colorCodeToTailwindClass()` |
| Fetch options on every render | Read from datalabel cache synchronously |
| Fixed dropdown position | Dynamic positioning based on viewport |

---

## Troubleshooting

### Dropdown Clipped by Table

**Symptom:** Dropdown options hidden behind table container

**Cause:** Parent element has `overflow: hidden`

**Fix:** BadgeDropdownSelect uses `createPortal(menu, document.body)` - ensure this is working and z-index is sufficient (`zIndex: 9999`)

### Options Not Showing

**Symptom:** Empty dropdown or "No options"

**Cause:** Datalabel cache not populated

**Fix:** Ensure login flow calls `GET /api/v1/datalabel/all` and stores in `datalabelMetadataStore`

### Colors Not Rendering

**Symptom:** All badges gray

**Cause:** `color_code` field empty in database or not converted to Tailwind classes

**Fix:** Use `colorCodeToTailwindClass(opt.color_code)` to convert database values

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v12.2.0 | 2025-12-02 | Registered in EditComponentRegistry, FieldRenderer integration |
| v8.3.2 | 2025-11-27 | Renamed from ColoredDropdown to BadgeDropdownSelect |
| v8.3.0 | 2025-11-25 | Extracted as shared component (DRY) |
| v8.0.0 | 2025-11-20 | Original inline implementation per component |

---

**Last Updated:** 2025-12-02 | **Version:** 12.2.0 | **Status:** Production Ready

**Related Documentation:**
- [EntityInstanceFormContainer.md](./EntityInstanceFormContainer.md) - Form field rendering
- [DAGVisualizer.md](./DAGVisualizer.md) - Stage visualization (view mode)
- [FIELD_RENDERER_ARCHITECTURE.md](../design_pattern/FIELD_RENDERER_ARCHITECTURE.md) - FieldRenderer component registry
