# Modal Component

**Version:** 10.0.0 | **Location:** `apps/web/src/components/shared/modal/Modal.tsx` | **Updated:** 2025-12-03

---

## Overview

Modal is the base overlay component for all dialogs in the application. It provides consistent styling, sizing, backdrop handling, and accessibility following design system v10.0.

**Core Principles:**
- Consistent design language across all modals
- Portal-based rendering for z-index management
- Backdrop click to close
- Flexible size options

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MODAL ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  BACKDROP (fixed, z-40)                                                 ││
│  │  - bg-black/50 backdrop-blur-sm                                         ││
│  │  - Click to close                                                       ││
│  │                                                                         ││
│  │  ┌─────────────────────────────────────────────────────────────────┐   ││
│  │  │  MODAL CONTAINER (z-50)                                         │   ││
│  │  │  - Centered flexbox                                             │   ││
│  │  │  - Size variants: sm/md/lg/xl                                   │   ││
│  │  │  - max-h-[90vh] with overflow scroll                            │   ││
│  │  │                                                                 │   ││
│  │  │  ┌───────────────────────────────────────────────────────────┐ │   ││
│  │  │  │  HEADER                                                   │ │   ││
│  │  │  │  [Title]                              [X Close Button]    │ │   ││
│  │  │  │  border-b border-dark-300                                 │ │   ││
│  │  │  └───────────────────────────────────────────────────────────┘ │   ││
│  │  │  ┌───────────────────────────────────────────────────────────┐ │   ││
│  │  │  │  CONTENT (flex-1, overflow-y-auto)                        │ │   ││
│  │  │  │  {children}                                               │ │   ││
│  │  │  └───────────────────────────────────────────────────────────┘ │   ││
│  │  │  ┌───────────────────────────────────────────────────────────┐ │   ││
│  │  │  │  FOOTER (optional)                                        │ │   ││
│  │  │  │  border-t border-dark-300                                 │ │   ││
│  │  │  │  {footer} - typically action buttons                      │ │   ││
│  │  │  └───────────────────────────────────────────────────────────┘ │   ││
│  │  └─────────────────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Props Interface

```typescript
interface ModalProps {
  /** Controls modal visibility */
  isOpen: boolean;

  /** Called when modal should close (backdrop click, X button, escape) */
  onClose: () => void;

  /** Modal title displayed in header */
  title: string;

  /** Modal content */
  children: React.ReactNode;

  /** Modal width variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';

  /** Optional footer content (typically buttons) */
  footer?: React.ReactNode;
}
```

---

## Size Variants

| Size | Max Width | Use Case |
|------|-----------|----------|
| `sm` | `max-w-md` (28rem) | Simple confirmations, alerts |
| `md` | `max-w-2xl` (42rem) | Standard forms, single entity edit |
| `lg` | `max-w-4xl` (56rem) | Complex forms, multi-section content |
| `xl` | `max-w-6xl` (72rem) | Full editors, data tables |

---

## Usage Examples

### Basic Modal

```tsx
import { Modal } from '@/components/shared/modal/Modal';
import { Button } from '@/components/shared/button/Button';

function ConfirmDeleteModal({ isOpen, onClose, onConfirm }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Delete"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>Delete</Button>
        </>
      }
    >
      <p className="text-dark-600">
        Are you sure you want to delete this item? This action cannot be undone.
      </p>
    </Modal>
  );
}
```

### Form Modal

```tsx
function EditEntityModal({ isOpen, onClose, entity }) {
  const [saving, setSaving] = useState(false);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit ${entity.name}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            Save Changes
          </Button>
        </>
      }
    >
      <EntityInstanceFormContainer
        entityCode={entity.code}
        entityId={entity.id}
        onSave={handleSave}
      />
    </Modal>
  );
}
```

---

## Styling (Design System v10.0)

### Backdrop
```css
/* Semi-transparent with blur */
.backdrop {
  background: rgba(0, 0, 0, 0.5);  /* bg-black/50 */
  backdrop-filter: blur(4px);      /* backdrop-blur-sm */
}
```

### Container
```css
.modal-container {
  background: var(--dark-100);     /* bg-dark-100 */
  border-radius: 12px;             /* rounded-xl */
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);  /* shadow-2xl */
  max-height: 90vh;
}
```

### Header
```css
.modal-header {
  padding: 1rem 1.5rem;            /* px-6 py-4 */
  border-bottom: 1px solid var(--dark-300);
}

.modal-title {
  font-size: 1.125rem;             /* text-lg */
  font-weight: 600;                /* font-semibold */
  color: var(--dark-700);
}
```

### Close Button
```css
.close-button {
  padding: 0.25rem;
  border-radius: 0.375rem;         /* rounded-md */
}
.close-button:hover {
  background: var(--dark-200);
}
```

---

## Accessibility

- **Backdrop click**: Closes modal
- **Click propagation**: Stopped on modal container
- **Focus management**: Consider adding focus trap
- **Escape key**: Consider adding keyboard handler

---

## Extended Modals

Built on this base:

| Modal | Purpose |
|-------|---------|
| [ShareModal](./ShareModal.md) | Entity sharing with users/roles |
| [EntityEditModal](./EntityEditModal.md) | Inline entity editing |
| [UnifiedLinkageModal](./UnifiedLinkageModal.md) | Parent/child relationship management |
| `PermissionManagementModal` | RBAC permission editing |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v10.0.0 | 2025-12-03 | Design system v10.0 dark theme |
| v1.0.0 | 2025-10-01 | Initial release |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
