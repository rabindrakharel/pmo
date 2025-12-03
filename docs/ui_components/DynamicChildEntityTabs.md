# DynamicChildEntityTabs Component

**Version:** 9.0.0 | **Location:** `apps/web/src/components/shared/entity/DynamicChildEntityTabs.tsx` | **Updated:** 2025-12-03

---

## Overview

DynamicChildEntityTabs provides JIRA-style horizontal tab navigation for child entities. It dynamically generates tabs from the parent entity's `child_entity_codes` metadata with count badges and active underline indicators.

**Core Principles:**
- Dynamic tab generation from entity metadata
- TanStack Query + Dexie cache (offline-first)
- Count badges for each child entity
- JIRA-style underline active indicator

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DYNAMICCHILDENTITYTABS ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Parent Entity: Project (id: abc-123)                                       │
│  child_entity_codes: ["task", "employee", "document"]                       │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  TAB BAR                                                                ││
│  │                                                                         ││
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      ││
│  │  │ 📋 Overview │ │ ✓ Tasks (5) │ │ 👤 Team (3) │ │ 📄 Docs (2) │      ││
│  │  │             │ │ ═══════════ │ │             │ │             │      ││
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘      ││
│  │                   ↑ Active tab                                          ││
│  │                   (blue underline)                                      ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  Navigation:                                                                │
│  Overview → /project/abc-123                                                │
│  Tasks    → /project/abc-123/task                                          │
│  Team     → /project/abc-123/employee                                      │
│  Docs     → /project/abc-123/document                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Props Interface

```typescript
interface DynamicChildEntityTabsProps {
  /** Page title */
  title: string;

  /** Parent entity type code */
  parentType: string;

  /** Parent entity instance ID */
  parentId: string;

  /** Parent entity display name */
  parentName?: string;

  /** Tab definitions */
  tabs: HeaderTab[];

  /** Additional CSS classes */
  className?: string;

  /** Show back navigation button */
  showBackButton?: boolean;

  /** Back button click handler */
  onBackClick?: () => void;
}

interface HeaderTab {
  /** Unique tab identifier */
  id: string;

  /** Display label */
  label: string;

  /** Child entity count (shows badge) */
  count?: number;

  /** Lucide icon component */
  icon?: React.ComponentType<any>;

  /** Navigation path */
  path: string;

  /** Disable tab interaction */
  disabled?: boolean;

  /** Hover tooltip */
  tooltip?: string;

  /** Display order */
  order?: number;
}
```

---

## useDynamicChildEntityTabs Hook

Automatically generates tabs from entity metadata:

```typescript
export function useDynamicChildEntityTabs(parentType: string, parentId: string) {
  const [tabs, setTabs] = React.useState<HeaderTab[]>([]);
  const [loading, setLoading] = React.useState(true);

  // v9.0.0: Use TanStack Query hook for entity codes
  const { getEntityByCode, isLoading: isEntityCodesLoading } = useEntityCodes();

  React.useEffect(() => {
    if (isEntityCodesLoading) return;

    // Get parent entity from cache
    const cachedEntity = getEntityByCode(parentType);

    if (cachedEntity?.child_entity_codes) {
      // Build tabs from child_entity_codes
      const generatedTabs = cachedEntity.child_entity_codes.map(childCode => ({
        id: childCode,
        label: getEntityByCode(childCode)?.ui_label || childCode,
        icon: getIconComponent(getEntityByCode(childCode)?.icon),
        path: `/${parentType}/${parentId}/${childCode}`,
        count: undefined // Fetched separately via API
      }));

      // Add Overview tab at start
      setTabs([
        { id: 'overview', label: 'Overview', path: `/${parentType}/${parentId}` },
        ...generatedTabs
      ]);
    }
  }, [parentType, parentId, isEntityCodesLoading]);

  return { tabs, loading };
}
```

---

## Tab States

### Normal State
```css
.tab-normal {
  color: #4b5563;            /* text-gray-600 */
}
.tab-normal:hover {
  color: #111827;            /* hover:text-gray-900 */
}
```

### Active State
```css
.tab-active {
  color: #2563eb;            /* text-blue-600 */
}
.tab-active::after {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;               /* h-0.5 */
  background: #2563eb;       /* bg-blue-600 */
}
```

### Disabled State
```css
.tab-disabled {
  color: #9ca3af;            /* text-gray-400 */
  cursor: not-allowed;
}
```

---

## Count Badge

```typescript
{tab.count !== undefined && (
  <span className={[
    'inline-flex items-center justify-center',
    'min-w-[20px] h-[20px] px-1.5',
    'rounded-full text-xs font-medium',
    isActive
      ? 'bg-blue-100 text-blue-600'
      : 'bg-gray-100 text-gray-600'
  ].join(' ')}>
    {tab.count}
  </span>
)}
```

---

## Usage Example

```tsx
import { DynamicChildEntityTabs, useDynamicChildEntityTabs } from '@/components/shared/entity/DynamicChildEntityTabs';

function ProjectDetailPage({ projectId }) {
  const { tabs, loading } = useDynamicChildEntityTabs('project', projectId);

  if (loading) return <TabSkeleton />;

  return (
    <DynamicChildEntityTabs
      title="Project Details"
      parentType="project"
      parentId={projectId}
      tabs={tabs}
    />
  );
}
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TAB GENERATION FLOW                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Hook called: useDynamicChildEntityTabs('project', 'abc-123')            │
│                                                                              │
│  2. Check TanStack Query cache:                                             │
│     getEntityByCode('project')                                              │
│     → Returns cached entity with child_entity_codes                         │
│                                                                              │
│  3. Build tabs from child_entity_codes:                                     │
│     ["task", "employee"] → [                                                │
│       { id: 'task', label: 'Tasks', path: '/project/abc-123/task' },        │
│       { id: 'employee', label: 'Team', path: '/project/abc-123/employee' }  │
│     ]                                                                        │
│                                                                              │
│  4. Fetch counts (optional API calls):                                      │
│     GET /api/v1/project/abc-123/task?limit=0 → total: 5                     │
│     → Update tab.count = 5                                                  │
│                                                                              │
│  5. Render tabs with counts and active state                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Related Components

| Component | Relationship |
|-----------|--------------|
| [EntitySpecificInstancePage](./EntitySpecificInstancePage.md) | Parent page using tabs |
| [Layout](./Layout.md) | Application shell |
| `useEntityCodes` | TanStack Query hook for entity metadata |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v9.0.0 | 2025-12-03 | TanStack Query + Dexie offline-first caching |
| v8.0.0 | 2025-11-20 | Dynamic tab generation from metadata |
| v1.0.0 | 2025-10-01 | Initial release |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
