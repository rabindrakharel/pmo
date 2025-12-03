# EntityInstancePicker Component

**Version:** 10.0.0 | **Location:** `apps/web/src/components/shared/EntityInstancePicker.tsx` | **Updated:** 2025-12-03

---

## Overview

EntityInstancePicker is a reusable entity instance selection widget with search functionality. It displays a searchable table of entity instances and allows single selection. Used by UnifiedLinkageModal, PermissionManagementModal, and other components requiring entity selection.

**Core Principles:**
- Search-as-you-type filtering
- Table display with Name, Code, Description columns
- Uses useEntityInstancePicker hook for data fetching
- Optional "All instances" row for type-level permissions

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ENTITYINSTANCEPICKER ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Search Bar                                                             ││
│  │  ┌───────────────────────────────────────────────────────────────────┐ ││
│  │  │  🔍 Search project by name...                                     │ ││
│  │  └───────────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Instance Table (scrollable, max-height: 300px)                        ││
│  │  ┌───────────────────────────────────────────────────────────────────┐ ││
│  │  │  Name          │ Code    │ Description       │ Action            │ ││
│  │  │────────────────┼─────────┼───────────────────┼───────────────────│ ││
│  │  │  All Projects  │         │ Type-level perm   │ [Select]          │ ││
│  │  │────────────────┼─────────┼───────────────────┼───────────────────│ ││
│  │  │  Kitchen Reno  │ PRJ-001 │ Main renovation   │ [✓ Selected]      │ ││
│  │  │  Bathroom Up   │ PRJ-002 │ Master bath       │ [Select]          │ ││
│  │  │  Basement Fin  │ PRJ-003 │ Full basement     │ [Select]          │ ││
│  │  └───────────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Summary: Showing 15 project instance(s)                               ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Props Interface

```typescript
interface EntityInstancePickerProps {
  /** Entity type code (e.g., 'project', 'task', 'employee') */
  entityCode: string;

  /** Currently selected instance UUID (null if none selected) */
  selectedInstanceId: string | null;

  /** Called when an instance is selected */
  onSelect: (instanceId: string) => void;

  /** Show "All instances" option for type-level permissions */
  showAllOption?: boolean;

  /** Label for the "All" option row */
  allOptionLabel?: string;  // Default: 'All instances'

  /** Placeholder text for search input */
  placeholder?: string;

  /** Max height of the instance table */
  maxHeight?: string;  // Default: '300px'
}
```

---

## Key Features

### 1. useEntityInstancePicker Hook Integration

```typescript
const {
  filteredInstances,  // Instances matching search query
  loading,            // Loading state
  error,              // Error message
  searchQuery,        // Current search query
  setSearchQuery      // Update search query
} = useEntityInstancePicker({
  entityCode,
  enabled: true
});
```

### 2. Search Functionality

```typescript
<input
  type="text"
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  placeholder={`Search ${entityCode} by name...`}
/>
```

### 3. "All Instances" Option

For type-level permissions (entity_id = 'all'):

```tsx
<EntityInstancePicker
  entityCode="project"
  selectedInstanceId={selectedId}
  onSelect={setSelectedId}
  showAllOption={true}
  allOptionLabel="All Projects"
/>
```

---

## Usage Examples

### Basic Usage

```tsx
import { EntityInstancePicker } from '@/components/shared/EntityInstancePicker';

function ProjectSelector() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  return (
    <EntityInstancePicker
      entityCode="project"
      selectedInstanceId={selectedProjectId}
      onSelect={setSelectedProjectId}
    />
  );
}
```

### With Type-Level Permission Option

```tsx
<EntityInstancePicker
  entityCode="employee"
  selectedInstanceId={selectedId}
  onSelect={handleSelect}
  showAllOption={true}
  allOptionLabel="All Employees"
  placeholder="Search employee by name or email..."
  maxHeight="400px"
/>
```

### In Permission Management Modal

```tsx
function PermissionManagementModal({ isOpen, entityCode }) {
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);

  return (
    <Modal isOpen={isOpen} title="Grant Permission">
      <EntityInstancePicker
        entityCode={entityCode}
        selectedInstanceId={selectedInstanceId}
        onSelect={setSelectedInstanceId}
        showAllOption={true}
        allOptionLabel={`All ${entityCode}s (type-level)`}
      />
      {/* Permission level selector */}
      {/* Save button */}
    </Modal>
  );
}
```

---

## Table Columns

| Column | Source | Notes |
|--------|--------|-------|
| Name | `instance.name` | With email suffix for employees |
| Code | `instance.code` or `instance.role_code` | Fallback to '-' |
| Description | `instance.descr` | Truncated, fallback to '-' |
| Action | Selection state | "Select" or "Selected" badge |

---

## Styling

### Search Input
```css
.search-input {
  padding-left: 1.75rem;  /* space for icon */
  padding-right: 0.5rem;
  padding-top: 0.375rem;
  padding-bottom: 0.375rem;
  font-size: 0.75rem;
  border: 1px solid var(--dark-400);
  border-radius: 0.25rem;
}

.search-input:focus {
  border-color: var(--blue-500);
  ring: 1px var(--blue-500);
}
```

### Table Row
```css
.table-row {
  transition: background-color 150ms;
}

.table-row:hover {
  background: var(--blue-50);
}

.table-row.selected {
  background: var(--blue-100);
}
```

### Selected Badge
```css
.selected-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  background: var(--blue-100);
  color: var(--blue-800);
}
```

---

## Loading & Empty States

### Loading
```
[Spinner]
Loading {entityCode} instances...
```

### Empty (No Results)
```
No {entityCode} instances found
{searchQuery ? `No results for "${searchQuery}"` : "Create one first"}
```

---

## Related Components

| Component | Relationship |
|-----------|--------------|
| [UnifiedLinkageModal](./UnifiedLinkageModal.md) | Primary consumer |
| `useEntityInstancePicker` | Data fetching hook |
| PermissionManagementModal | Consumer for RBAC |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v10.0.0 | 2025-12-03 | Design system v10.0 |
| v2.0.0 | 2025-11-15 | Extracted to shared component |
| v1.0.0 | 2025-10-01 | Initial release |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
