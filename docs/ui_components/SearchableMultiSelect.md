# SearchableMultiSelect

> Generic searchable multi-select dropdown with portal rendering

**Location**: `apps/web/src/components/shared/ui/SearchableMultiSelect.tsx`

**Version**: 12.0.0 (Portal Rendering)

## Purpose

A generic searchable multi-select dropdown component for selecting multiple options from a provided list. Used for general-purpose multi-selection where options are passed as props (not fetched from entity cache).

## Key Features

- **Portal Rendering**: Dropdown renders via `createPortal` to `document.body`, escaping parent container `overflow: hidden` clipping
- **Dynamic Positioning**: Opens upward or downward based on available viewport space
- **Position Updates**: Auto-updates position on scroll/resize events
- **Type-to-Search**: Filter options by typing in search box
- **Checkbox Selection**: Visual checkboxes for multi-select
- **Chip Display**: Selected items shown as removable chips
- **Tooltip Support**: Optional tooltips on chips and options

## Props

```typescript
interface SearchableMultiSelectProps {
  options: Option[];          // { value: string, label: string }[]
  value: string[];            // Currently selected values
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  showTooltips?: boolean;     // Show tooltips on hover (default: true)
}
```

## Portal Rendering Pattern

The dropdown menu is rendered via React Portal to escape container clipping:

```tsx
{isOpen && !disabled && !readonly && createPortal(
  <div
    ref={dropdownRef}
    data-dropdown-portal=""
    className="bg-white border border-gray-200 rounded overflow-hidden"
    style={{
      position: 'absolute',
      top: `${dropdownPosition.top}px`,
      left: `${dropdownPosition.left}px`,
      width: `${dropdownPosition.width}px`,
      maxHeight: '300px',
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
      const maxDropdownHeight = 300;
      const spaceBelow = window.innerHeight - rect.bottom - 20;
      const spaceAbove = rect.top - 20;

      const estimatedContentHeight = Math.min(options.length * 36, maxDropdownHeight);
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

### Basic Usage

```tsx
import { SearchableMultiSelect } from '@/components/shared/ui/SearchableMultiSelect';

const options = [
  { value: 'tag1', label: 'Important' },
  { value: 'tag2', label: 'Urgent' },
  { value: 'tag3', label: 'Review' },
];

<SearchableMultiSelect
  options={options}
  value={selectedTags}
  onChange={setSelectedTags}
  placeholder="Select tags..."
/>
```

### With Readonly Mode

```tsx
<SearchableMultiSelect
  options={options}
  value={selectedTags}
  onChange={setSelectedTags}
  readonly={true}  // Displays chips but cannot modify
/>
```

### Without Tooltips

```tsx
<SearchableMultiSelect
  options={options}
  value={selectedTags}
  onChange={setSelectedTags}
  showTooltips={false}
/>
```

## Visual Structure

```
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────┐ ┌────────┐ ┌────────┐                    ▼    │
│  │ Important│ │ Urgent │ │ Review │                         │
│  └──────────┘ └────────┘ └────────┘                         │
└─────────────────────────────────────────────────────────────┘
                    ↓ Portal renders to body
┌─────────────────────────────────────────────────────────────┐
│  🔍 Search...                                                │
├─────────────────────────────────────────────────────────────┤
│  ☑ Important                                                │
│  ☑ Urgent                                                   │
│  ☑ Review                                                   │
│  ☐ Low Priority                                             │
│  ☐ Documentation                                            │
└─────────────────────────────────────────────────────────────┘
```

## Differences from EntityInstanceNameMultiSelect

| Feature | SearchableMultiSelect | EntityInstanceNameMultiSelect |
|---------|----------------------|------------------------------|
| Data Source | Props (`options`) | TanStack Query cache |
| Entity Aware | No | Yes (`entityCode`) |
| Cache Fallback | No | Yes (sync accessor) |
| Use Case | Generic selection | Entity foreign keys |

## Related Components

| Component | Purpose | Portal |
|-----------|---------|--------|
| `SearchableMultiSelect` | Generic multi-select | Yes |
| `EntityInstanceNameMultiSelect` | Entity reference multi-select | Yes |
| `MultiSelect` | Basic multi-select (no search) | Yes |

---

**Version History**:
- v12.0.0: Added portal rendering for overflow escape
- v9.8.0: Added reusable Chip component integration
