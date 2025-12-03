# EntityEditModal

**Version:** 10.0.0 | **Location:** `apps/web/src/components/shared/modal/EntityEditModal.tsx` | **Updated:** 2025-12-03

---

## Overview

EntityEditModal is a reusable modal that displays the entity edit form for any entity type. It uses EntityInstanceFormContainer for consistency with EntitySpecificInstancePage and supports both create and edit modes.

**Core Principles:**
- Works with any entity type
- Uses EntityInstanceFormContainer for form rendering
- Supports create mode (entityId=null or 'new')
- Matches EntitySpecificInstancePage styling

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ENTITYEDITMODAL ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Header (sticky)                                                        ││
│  │  ┌───────────────────────────────────────────────────────────────────┐ ││
│  │  │  {entityName || "Create New {Entity}"}  {Entity} · {id}...        │ ││
│  │  │                                           [Cancel] [Save]         │ ││
│  │  └───────────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Content (scrollable, max-height: 90vh - 80px)                         ││
│  │                                                                         ││
│  │  [Error Banner - if error]                                             ││
│  │                                                                         ││
│  │  ┌───────────────────────────────────────────────────────────────────┐ ││
│  │  │  EntityInstanceFormContainer                                      │ ││
│  │  │  - config from getEntityConfig(entityCode)                        │ ││
│  │  │  - data: editedData                                               │ ││
│  │  │  - isEditing: true (always in edit mode)                          │ ││
│  │  │  - mode: 'create' | 'edit'                                        │ ││
│  │  └───────────────────────────────────────────────────────────────────┘ ││
│  │                                                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Props Interface

```typescript
interface EntityEditModalProps {
  /** Entity type code (e.g., 'project', 'task') */
  entityCode: string;

  /** Entity instance UUID (null or 'new' for create mode) */
  entityId: string | null;

  /** Controls modal visibility */
  isOpen: boolean;

  /** Called when modal should close */
  onClose: () => void;

  /** Called after successful save */
  onSave?: () => void;
}
```

---

## Key Features

### 1. Create vs Edit Mode

```typescript
const isCreateMode = !entityId || entityId === 'new';

useEffect(() => {
  if (isOpen) {
    if (isCreateMode) {
      // Create mode: Initialize with empty data
      setData({});
      setEditedData({});
    } else {
      // Edit mode: Load existing data
      loadData();
    }
  }
}, [isOpen, entityId, entityCode, isCreateMode]);
```

### 2. Data Loading (Edit Mode)

```typescript
const loadData = async () => {
  const api = APIFactory.getAPI(entityCode);
  const response = await api.get(entityId);
  setData(response.data || response);
  setEditedData(response.data || response);
};
```

### 3. Date Field Normalization

```typescript
// Normalize date fields to YYYY-MM-DD format for API validation
const normalizedData = { ...editedData };

config.fields.forEach(field => {
  if (field.inputType === 'date' && normalizedData[field.key]) {
    const value = normalizedData[field.key];
    if (value.includes('T')) {
      normalizedData[field.key] = value.split('T')[0];
    } else if (value instanceof Date) {
      normalizedData[field.key] = value.toISOString().split('T')[0];
    }
  }
});
```

### 4. Save Operation

```typescript
const handleSave = async () => {
  const api = APIFactory.getAPI(entityCode);

  if (isCreateMode) {
    await api.create(normalizedData);
  } else {
    await api.update(entityId!, normalizedData);
  }

  onSave?.();
  onClose();
};
```

---

## Usage Example

```tsx
import { EntityEditModal } from '@/components/shared/modal/EntityEditModal';

function TaskListPage() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleEdit = (taskId: string) => {
    setEditingId(taskId);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingId('new');  // or null
    setIsModalOpen(true);
  };

  return (
    <>
      <Button onClick={handleCreate}>Create Task</Button>

      <EntityEditModal
        entityCode="task"
        entityId={editingId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={() => {
          refreshList();
          setIsModalOpen(false);
        }}
      />
    </>
  );
}
```

---

## Styling

### Header
```css
.modal-header {
  background: var(--dark-100);
  border-bottom: 1px solid var(--dark-300);
  padding: 1rem 1.5rem;
  position: sticky;
  top: 0;
  z-index: 10;
}
```

### Buttons (matching EntitySpecificInstancePage)
```css
.cancel-button {
  border: 1px solid var(--dark-400);
  background: white;
  color: var(--dark-600);
}

.save-button {
  background: var(--slate-600);
  color: white;
  border: none;
}
```

---

## Related Components

| Component | Relationship |
|-----------|--------------|
| [Modal](./Modal.md) | Base modal styling |
| [EntityInstanceFormContainer](./EntityInstanceFormContainer.md) | Form rendering |
| [Button](./Button.md) | Action buttons |
| [EntitySpecificInstancePage](./EntitySpecificInstancePage.md) | Styling reference |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v10.0.0 | 2025-12-03 | Design system v10.0 |
| v1.0.0 | 2025-10-01 | Initial release |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
