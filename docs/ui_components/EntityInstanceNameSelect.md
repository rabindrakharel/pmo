# EntityInstanceNameSelect

> Searchable single-select dropdown for entity references with portal rendering

**Location**: `apps/web/src/components/shared/ui/EntityInstanceNameSelect.tsx`

**Version**: 12.0.0 (Portal Rendering)

## Purpose

A searchable dropdown component for selecting a single entity instance (e.g., employee, project, client). Used for all entity foreign key fields (`*__employee_id`, `*__project_id`, etc.).

## Key Features

- **Portal Rendering**: Dropdown renders via `createPortal` to `document.body`, escaping parent container `overflow: hidden` clipping
- **Dynamic Positioning**: Opens upward or downward based on available viewport space
- **Position Updates**: Auto-updates position on scroll/resize events
- **Type-to-Search**: Filter options by typing in search box
- **Keyboard Navigation**: Arrow keys, Enter, Escape, Tab support
- **Local-First Pattern**: Immediate UI feedback before async state updates
- **TanStack Query Integration**: Uses `ref_data_entityInstance` cache

## Props

```typescript
interface EntityInstanceNameSelectProps {
  entityCode: string;       // Entity type: "employee", "project", "client"
  value: string;            // Current UUID
  currentLabel?: string;    // Display label (backwards compatibility)
  onChange: (uuid: string, label: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;      // Auto-open dropdown for inline editing
}
```

## Portal Rendering Pattern

The dropdown menu is rendered via React Portal to escape container clipping:

```tsx
{isOpen && !disabled && createPortal(
  <div
    ref={dropdownRef}
    data-dropdown-portal=""
    style={{
      position: 'absolute',
      top: `${dropdownPosition.top}px`,
      left: `${dropdownPosition.left}px`,
      width: `${dropdownPosition.width}px`,
      maxHeight: '400px',
      zIndex: 9999,
      boxShadow: dropdownPosition.openUpward
        ? '0 -4px 6px ...'  // Shadow above
        : '0 4px 6px ...',  // Shadow below
    }}
  >
    {/* Search input + Options list */}
  </div>,
  document.body
)}
```

### Position Calculation

```tsx
useEffect(() => {
  if (isOpen && triggerRef.current) {
    const updatePosition = () => {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 20;
      const spaceAbove = rect.top - 20;

      // Decide direction based on available space
      const shouldOpenUpward = spaceBelow < estimatedContentHeight && spaceAbove > spaceBelow;

      setDropdownPosition({
        top: shouldOpenUpward
          ? rect.top + window.scrollY - availableHeight - 4
          : rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
        openUpward: shouldOpenUpward,
      });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => { /* cleanup */ };
  }
}, [isOpen, options.length]);
```

### Click Outside Handling (with Portal)

```tsx
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    // Must check BOTH container AND portal-rendered dropdown
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
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);
```

## Usage

### In Entity Forms (via Metadata)

```yaml
# edit-type-mapping.yaml
manager__employee_id:
  inputType: EntityInstanceNameSelect
  lookupEntity: employee
  lookupSourceTable: entityInstance
```

### Direct Usage

```tsx
import { EntityInstanceNameSelect } from '@/components/shared/ui/EntityInstanceNameSelect';

<EntityInstanceNameSelect
  entityCode="employee"
  value={formData.manager__employee_id}
  onChange={(uuid, label) => handleChange('manager__employee_id', uuid)}
  placeholder="Select manager..."
/>
```

### In Inline Edit Mode (Table)

```tsx
<EntityInstanceNameSelect
  entityCode="employee"
  value={row.manager__employee_id}
  currentLabel={row.manager_name}  // Pre-resolved label
  onChange={(uuid, label) => saveCell(row.id, 'manager__employee_id', uuid)}
  autoFocus={true}  // Opens immediately
/>
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│  EntityInstanceNameSelect                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. useRefDataEntityInstanceOptions(entityCode)             │
│     └── TanStack Query → ref_data_entityInstance cache      │
│                                                              │
│  2. User types → filteredOptions (local filter)             │
│                                                              │
│  3. User selects:                                            │
│     ├── setLocalValue(uuid)      // Immediate UI            │
│     ├── setLocalLabel(label)     // Immediate UI            │
│     └── onChange(uuid, label)    // Parent notification     │
│                                                              │
│  4. Portal renders dropdown at calculated position           │
│     └── Escapes overflow:hidden containers                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Related Components

| Component | Purpose | Portal |
|-----------|---------|--------|
| `EntityInstanceNameSelect` | Single entity selection | ✓ |
| `EntityInstanceNameMultiSelect` | Multiple entity selection | ✓ |
| `BadgeDropdownSelect` | Datalabel/status dropdowns | ✓ |
| `DataLabelSelect` | Wrapper for BadgeDropdownSelect | ✓ (via child) |

## Troubleshooting

### Dropdown gets clipped by container

Ensure the component is using portal rendering (`createPortal`). Check for:
- `data-dropdown-portal` attribute on dropdown element
- Dropdown renders as direct child of `document.body` in DOM

### Dropdown position is wrong

Check that:
1. `triggerRef` is attached to the trigger button
2. Position update effect runs on `isOpen` change
3. Scroll/resize listeners are properly attached

### Click outside doesn't close

Ensure click handler checks both:
- `containerRef` (the component container)
- `dropdownRef` (the portal-rendered dropdown)

---

**Version History**:
- v12.0.0: Added portal rendering for overflow escape
- v11.0.0: TanStack Query integration with sync cache accessor
- v10.0.0: Local-first controlled component pattern
