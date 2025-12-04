# MultiSelect

> Basic multi-select dropdown with portal rendering

**Location**: `apps/web/src/components/shared/ui/MultiSelect.tsx`

**Version**: 12.0.0 (Portal Rendering)

## Purpose

A basic multi-select component that displays selected values as removable tags with an "Add" button dropdown. Foundation component for simple multi-value selection without search functionality.

## Key Features

- **Portal Rendering**: Dropdown renders via `createPortal` to `document.body`, escaping parent container `overflow: hidden` clipping
- **Dynamic Positioning**: Opens upward or downward based on available viewport space
- **Position Updates**: Auto-updates position on scroll/resize events
- **Tag Display**: Selected items shown as removable tags
- **Add Button**: Dropdown triggered by "+ Add" button
- **Simple API**: No search, just click to select

## Props

```typescript
interface MultiSelectProps {
  values: string[];           // Currently selected values
  onChange: (values: string[]) => void;
  options: SelectOption[];    // { value: string | number, label: string }[]
  placeholder?: string;       // Label for add button
  disabled?: boolean;
}
```

## Portal Rendering Pattern

The dropdown menu is rendered via React Portal to escape container clipping:

```tsx
{isOpen && createPortal(
  <div
    ref={dropdownRef}
    data-dropdown-portal=""
    className="bg-white border border-gray-200 rounded-md overflow-auto"
    style={{
      position: 'absolute',
      top: `${dropdownPosition.top}px`,
      left: `${dropdownPosition.left}px`,
      width: `${dropdownPosition.width}px`,  // 256px (w-64)
      maxHeight: '240px',
      zIndex: 9999,
      boxShadow: dropdownPosition.openUpward
        ? '0 -4px 6px ...'  // Shadow above
        : '0 4px 6px ...',  // Shadow below
    }}
  >
    {availableOptions.map(opt => (
      <button onClick={() => handleAdd(opt.value)}>
        {opt.label}
      </button>
    ))}
  </div>,
  document.body
)}
```

### Position Calculation

```tsx
useEffect(() => {
  if (isOpen && buttonRef.current) {
    const updatePosition = () => {
      const rect = buttonRef.current.getBoundingClientRect();
      const maxDropdownHeight = 240;
      const spaceBelow = window.innerHeight - rect.bottom - 20;
      const spaceAbove = rect.top - 20;

      const availableOptions = options.filter(opt => !values.includes(String(opt.value)));
      const estimatedContentHeight = Math.min(availableOptions.length * 36, maxDropdownHeight);
      const shouldOpenUpward = spaceBelow < estimatedContentHeight && spaceAbove > spaceBelow;

      setDropdownPosition({
        top: shouldOpenUpward
          ? rect.top + window.scrollY - availableHeight - 4
          : rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: 256,  // Fixed width (w-64)
        openUpward: shouldOpenUpward,
      });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => { /* cleanup */ };
  }
}, [isOpen, options, values]);
```

### Click Outside Handling (with Portal)

```tsx
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (
      buttonRef.current &&
      !buttonRef.current.contains(event.target as Node) &&
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
import { MultiSelect } from '@/components/shared/ui/MultiSelect';

const options = [
  { value: '1', label: 'Tag 1' },
  { value: '2', label: 'Tag 2' },
  { value: '3', label: 'Tag 3' },
];

<MultiSelect
  values={selectedValues}
  onChange={setSelectedValues}
  options={options}
  placeholder="tag"
/>
```

### With Custom Placeholder

```tsx
<MultiSelect
  values={selectedCategories}
  onChange={setSelectedCategories}
  options={categoryOptions}
  placeholder="category"  // Shows "+ Add category" button
/>
```

## Visual Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Selected Tags                                               │
│  ┌──────────────┐ ┌──────────────┐                          │
│  │ Tag 1      × │ │ Tag 2      × │                          │
│  └──────────────┘ └──────────────┘                          │
│                                                              │
│  ┌─────────────┐                                            │
│  │ + Add tag   │  ← Button triggers dropdown                │
│  └─────────────┘                                            │
└─────────────────────────────────────────────────────────────┘
                    ↓ Portal renders to body
┌─────────────────────────────────────────────────────────────┐
│  Tag 3                                                       │
│  Tag 4                                                       │
│  Tag 5                                                       │
└─────────────────────────────────────────────────────────────┘
```

## Differences from SearchableMultiSelect

| Feature | MultiSelect | SearchableMultiSelect |
|---------|-------------|----------------------|
| Search | No | Yes |
| Trigger | Add button | Full trigger area |
| Selected Display | Tags above button | Chips in trigger |
| Dropdown Width | Fixed (256px) | Matches trigger |
| Checkbox UI | No | Yes |

## Related Components

| Component | Purpose | Portal |
|-----------|---------|--------|
| `MultiSelect` | Basic multi-select | Yes |
| `SearchableMultiSelect` | Multi-select with search | Yes |
| `EntityInstanceNameMultiSelect` | Entity reference multi-select | Yes |
| `EntityMultiSelect` | Entity-aware wrapper | Uses MultiSelect |

---

**Version History**:
- v12.0.0: Added portal rendering for overflow escape
- v1.0.0: Initial implementation
