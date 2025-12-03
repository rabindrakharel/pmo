# UnifiedLinkageModal

**Version:** 10.0.0 | **Location:** `apps/web/src/components/shared/modal/UnifiedLinkageModal.tsx` | **Updated:** 2025-12-03

---

## Overview

UnifiedLinkageModal provides a dialog for managing parent-child relationships between entities. It supports two modes: assigning a parent to a child entity, or managing children of a parent entity. It integrates with the entity_instance_link table for relationship management.

**Core Principles:**
- Two modes: 'assign-parent' and 'manage-children'
- Dynamic entity type filtering based on valid relationships
- Uses useEntityInstancePicker hook for entity selection
- Real-time linkage creation/removal

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   UNIFIEDLINKAGEMODAL ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Mode: assign-parent                     Mode: manage-children              │
│  "Assign Parent to {Child}"              "Manage Children of {Parent}"      │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Modal Header: "{Mode Title}"                                 [X]       ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Entity Type Selector (tabs/buttons)                                    ││
│  │  [Office] [Business] [Project] [Client] ...                            ││
│  │   ═══════                                                               ││
│  │  (Only valid parent/child types shown)                                  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Existing Linkages                                                      ││
│  │  ┌───────────────────────────────────────────────────────────────────┐ ││
│  │  │  [📁 Project] Kitchen Renovation                      [Unlink]   │ ││
│  │  │  [🏢 Business] Huron Home Services                    [Unlink]   │ ││
│  │  └───────────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Add New Linkage                                                        ││
│  │  ┌───────────────────────────────────────────────────────────────────┐ ││
│  │  │  🔍 Search {entityType} by name...                                │ ││
│  │  └───────────────────────────────────────────────────────────────────┘ ││
│  │  ┌───────────────────────────────────────────────────────────────────┐ ││
│  │  │  Name          │ Code    │ Description      │ Action             │ ││
│  │  │────────────────┼─────────┼──────────────────┼────────────────────│ ││
│  │  │  Project A     │ PRJ-001 │ Main renovation  │ [Link]             │ ││
│  │  │  Project B     │ PRJ-002 │ Kitchen upgrade  │ [Link]             │ ││
│  │  └───────────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  [Success/Error Messages]                                               ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Props Interface

```typescript
interface UnifiedLinkageModalProps {
  /** Controls modal visibility */
  isOpen: boolean;

  /** Called when modal should close */
  onClose: () => void;

  /** Linkage mode */
  mode: 'assign-parent' | 'manage-children';

  // For "assign-parent" mode:
  /** Child entity type code */
  childEntityType?: string;
  /** Child entity instance UUID */
  childEntityId?: string;
  /** Child entity display name */
  childEntityName?: string;

  // For "manage-children" mode:
  /** Parent entity type code */
  parentEntityType?: string;
  /** Parent entity instance UUID */
  parentEntityId?: string;
  /** Parent entity display name */
  parentEntityName?: string;

  /** Restrict which entity types can be linked */
  allowedEntityTypes?: string[];

  /** Callback when linkage changes */
  onLinkageChange?: () => void;
}
```

---

## Linkage Modes

### 1. Assign Parent Mode

Use when you want to assign a parent to a child entity:

```tsx
<UnifiedLinkageModal
  isOpen={true}
  onClose={() => {}}
  mode="assign-parent"
  childEntityType="task"
  childEntityId="task-uuid"
  childEntityName="Kitchen Renovation Task"
  onLinkageChange={refetchData}
/>
```

### 2. Manage Children Mode

Use when you want to add/remove children from a parent entity:

```tsx
<UnifiedLinkageModal
  isOpen={true}
  onClose={() => {}}
  mode="manage-children"
  parentEntityType="project"
  parentEntityId="project-uuid"
  parentEntityName="Kitchen Renovation Project"
  onLinkageChange={refetchData}
/>
```

---

## Key Features

### 1. Valid Entity Types Loading

```typescript
// Get valid parent/child types from API
const loadValidEntityTypes = async () => {
  if (mode === 'assign-parent') {
    // GET /api/v1/linkage/parents/{childEntityType}
    const response = await fetch(`${apiUrl}/api/v1/linkage/parents/${childEntityType}`);
    const { data: types } = await response.json();
    setValidEntityTypes(types);
  } else {
    // GET /api/v1/linkage/children/{parentEntityType}
    const response = await fetch(`${apiUrl}/api/v1/linkage/children/${parentEntityType}`);
    const { data: types } = await response.json();
    setValidEntityTypes(types);
  }
};
```

### 2. Existing Linkages Display

```typescript
const loadExistingLinkages = async () => {
  let url = `${apiUrl}/api/v1/linkage?`;

  if (mode === 'assign-parent') {
    url += `child_entity_type=${childEntityType}&child_entity_id=${childEntityId}`;
  } else {
    url += `parent_entity_type=${parentEntityType}&parent_entity_id=${parentEntityId}`;
  }

  const { data: linkages } = await (await fetch(url)).json();
  setExistingLinkages(linkages);
};
```

### 3. Link/Unlink Operations

```typescript
const handleLink = async (entityId: string) => {
  const linkData = mode === 'assign-parent'
    ? {
        parent_entity_type: selectedEntityType,
        parent_entity_id: entityId,
        child_entity_type: childEntityType,
        child_entity_id: childEntityId,
        relationship_type: 'contains'
      }
    : {
        parent_entity_type: parentEntityType,
        parent_entity_id: parentEntityId,
        child_entity_type: selectedEntityType,
        child_entity_id: entityId,
        relationship_type: 'contains'
      };

  await fetch(`${apiUrl}/api/v1/linkage`, {
    method: 'POST',
    body: JSON.stringify(linkData)
  });

  onLinkageChange?.();
};

const handleUnlink = async (linkageId: string) => {
  await fetch(`${apiUrl}/api/v1/linkage/${linkageId}`, {
    method: 'DELETE'
  });

  onLinkageChange?.();
};
```

---

## Entity Type Icons

```typescript
const entityTypes = [
  { value: 'office', label: 'Office', IconComponent: MapPin },
  { value: 'business', label: 'Business', IconComponent: Building2 },
  { value: 'client', label: 'Client', IconComponent: Building },
  { value: 'project', label: 'Project', IconComponent: FolderOpen },
  { value: 'task', label: 'Task', IconComponent: CheckSquare },
  { value: 'worksite', label: 'Worksite', IconComponent: MapPin },
  { value: 'employee', label: 'Employee', IconComponent: Users },
  { value: 'role', label: 'Role', IconComponent: Shield },
  { value: 'wiki', label: 'Wiki', IconComponent: BookOpen },
  { value: 'artifact', label: 'Artifact', IconComponent: FileText },
  { value: 'form', label: 'Form', IconComponent: FileText }
];
```

---

## Usage with useLinkageModal Hook

```tsx
import { useLinkageModal } from '@/hooks/useLinkageModal';
import { UnifiedLinkageModal } from '@/components/shared/modal/UnifiedLinkageModal';

function EntityDetailPage({ entityCode, entityId }) {
  const linkageModal = useLinkageModal({
    onLinkageChange: () => {
      refetch();
      invalidateEntity(entityCode, entityId);
    }
  });

  return (
    <>
      <Button icon={LinkIcon} onClick={() => linkageModal.openManageChildren(
        entityCode, entityId, entityName
      )}>
        Manage Links
      </Button>

      <UnifiedLinkageModal
        isOpen={linkageModal.isOpen}
        onClose={linkageModal.close}
        mode={linkageModal.mode}
        parentEntityType={linkageModal.parentEntityType}
        parentEntityId={linkageModal.parentEntityId}
        parentEntityName={linkageModal.parentEntityName}
        childEntityType={linkageModal.childEntityType}
        childEntityId={linkageModal.childEntityId}
        childEntityName={linkageModal.childEntityName}
        onLinkageChange={linkageModal.onLinkageChange}
      />
    </>
  );
}
```

---

## Related Components

| Component | Relationship |
|-----------|--------------|
| [Modal](./Modal.md) | Base modal component |
| [EntityInstancePicker](./EntityInstancePicker.md) | Entity selection widget |
| [Button](./Button.md) | Action buttons |
| [EntitySpecificInstancePage](./EntitySpecificInstancePage.md) | Parent page |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v10.0.0 | 2025-12-03 | Design system v10.0 |
| v2.0.0 | 2025-11-15 | useEntityInstancePicker integration |
| v1.0.0 | 2025-10-01 | Initial release |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
