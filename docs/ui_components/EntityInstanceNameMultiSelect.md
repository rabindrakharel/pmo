# EntityInstanceNameMultiSelect

> Searchable multi-select dropdown for entity reference arrays with portal rendering

**Location**: `apps/web/src/components/shared/ui/EntityInstanceNameMultiSelect.tsx`

**Version**: 12.0.0 (Portal Rendering)

## Purpose

A searchable multi-select dropdown component for selecting multiple entity instances (e.g., employees, projects, clients). Used for all entity foreign key array fields (`stakeholder__employee_ids`, `assigned__employee_ids`, etc.).

## Key Features

- **Portal Rendering**: Dropdown renders via `createPortal` to `document.body`, escaping parent container `overflow: hidden` clipping
- **Dynamic Positioning**: Opens upward or downward based on available viewport space
- **Position Updates**: Auto-updates position on scroll/resize events
- **Type-to-Search**: Filter options by typing in search box
- **Multi-Select**: Checkbox-based selection with selected count footer
- **Chip Display**: Selected items shown as removable chips with overflow handling
- **Local-First Pattern**: Immediate UI feedback before async state updates
- **TanStack Query Integration**: Uses `ref_data_entityInstance` cache

## Props

```typescript
interface EntityInstanceNameMultiSelectProps {
  entityCode: string;         // Entity type: "employee", "project", "client"
  value: string[];            // Current array of UUIDs
  onChange: (uuids: string[]) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  maxDisplayed?: number;      // Max chips to show before "+N more" (default: 5)
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
    {/* Search input + Options list + Footer */}
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
      setSearchTerm('');
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
stakeholder__employee_ids:
  inputType: EntityInstanceNameMultiSelect
  lookupEntity: employee
  lookupSourceTable: entityInstance
```

### Direct Usage

```tsx
import { EntityInstanceNameMultiSelect } from '@/components/shared/ui/EntityInstanceNameMultiSelect';

<EntityInstanceNameMultiSelect
  entityCode="employee"
  value={formData.stakeholder__employee_ids || []}
  onChange={(uuids) => handleChange('stakeholder__employee_ids', uuids)}
  placeholder="Select stakeholders..."
  maxDisplayed={3}
/>
```

## Visual Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Trigger (shows chips)                                       │
│  ┌──────┐ ┌──────┐ ┌──────┐ +2 more                    ▼    │
│  │ John │ │ Jane │ │ Bob  │                                  │
│  └──────┘ └──────┘ └──────┘                                  │
└─────────────────────────────────────────────────────────────┘
                    ↓ Portal renders to body
┌─────────────────────────────────────────────────────────────┐
│  🔍 Search employees...                                      │
├─────────────────────────────────────────────────────────────┤
│  ☑ John Smith                                               │
│  ☑ Jane Doe                                                 │
│  ☑ Bob Wilson                                               │
│  ☐ Alice Brown                                              │
│  ☐ Charlie Davis                                            │
├─────────────────────────────────────────────────────────────┤
│  3 selected                                                  │
└─────────────────────────────────────────────────────────────┘
```

## Related Components

| Component | Purpose | Portal |
|-----------|---------|--------|
| `EntityInstanceNameSelect` | Single entity selection | Yes |
| `EntityInstanceNameMultiSelect` | Multiple entity selection | Yes |
| `BadgeDropdownSelect` | Datalabel/status dropdowns | Yes |
| `SearchableMultiSelect` | Generic multi-select | Yes |

---

**Version History**:
- v12.0.0: Added portal rendering for overflow escape
- v11.0.0: TanStack Query integration with sync cache accessor
- v10.0.0: Local-first controlled component pattern
