# ShareModal

**Version:** 10.0.0 | **Location:** `apps/web/src/components/shared/modal/ShareModal.tsx` | **Updated:** 2025-12-03

---

## Overview

ShareModal provides a dialog for sharing entities with users, roles, or via public links. It integrates with the RBAC system to grant permissions and generates shareable URLs for public access.

**Core Principles:**
- Three share types: Public link, Specific users, Specific roles
- Integrates with entity_rbac for permission management
- URL generation for public sharing
- Built on base Modal component

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SHAREMODAL ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Modal Header: "Share {entityCode}"                           [X]       ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Entity Info                                                            ││
│  │  ┌───────────────────────────────────────────────────────────────────┐ ││
│  │  │  Sharing: {entityName}                                            │ ││
│  │  └───────────────────────────────────────────────────────────────────┘ ││
│  │                                                                         ││
│  │  Share Type Selection                                                   ││
│  │  ┌───────────────────────────────────────────────────────────────────┐ ││
│  │  │ [🔗] Anyone with the link                                ○        │ ││
│  │  │      Create a shareable link that anyone can access               │ ││
│  │  ├───────────────────────────────────────────────────────────────────┤ ││
│  │  │ [👤] Specific users                                      ○        │ ││
│  │  │      Choose specific people to share with                         │ ││
│  │  ├───────────────────────────────────────────────────────────────────┤ ││
│  │  │ [🛡️] Specific roles                                      ○        │ ││
│  │  │      Share with everyone in selected roles                        │ ││
│  │  └───────────────────────────────────────────────────────────────────┘ ││
│  │                                                                         ││
│  │  [Users/Roles Picker - shown when applicable]                          ││
│  │  [Copy URL - shown for public links]                                   ││
│  │                                                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Footer: [Cancel] [Share]                                               ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Props Interface

```typescript
interface ShareModalProps {
  /** Controls modal visibility */
  isOpen: boolean;

  /** Called when modal should close */
  onClose: () => void;

  /** Entity type code (e.g., 'project', 'task') */
  entityCode: string;

  /** Entity instance UUID */
  entityId: string;

  /** Entity display name (shown in modal) */
  entityName?: string;

  /** Existing shared URL (if already shared) */
  currentSharedUrl?: string;

  /** Callback when share is submitted */
  onShare: (shareData: ShareData) => Promise<void>;
}

interface ShareData {
  /** Type of sharing */
  shareType: 'public' | 'users' | 'roles';

  /** User UUIDs (when shareType='users') */
  userIds?: string[];

  /** Role UUIDs (when shareType='roles') */
  roleIds?: string[];

  /** Permissions to grant */
  permissions?: string[];  // ['view']
}
```

---

## Share Types

### 1. Public Link

```typescript
// Generates shareable URL via API
const response = await fetch(`${apiUrl}/api/v1/${entityCode}/${entityId}/share-url`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` }
});
const { sharedUrl } = await response.json();
// URL: /shared/{hash}
```

### 2. Specific Users

```typescript
// Loads employees for selection
const usersRes = await fetch(`${apiUrl}/api/v1/employee?limit=100`, {
  headers: { Authorization: `Bearer ${token}` }
});

// Creates entity_rbac entries for selected users
onShare({
  shareType: 'users',
  userIds: selectedUsers,
  permissions: ['view']
});
```

### 3. Specific Roles

```typescript
// Loads roles for selection
const rolesRes = await fetch(`${apiUrl}/api/v1/role?limit=100`, {
  headers: { Authorization: `Bearer ${token}` }
});

// Creates entity_rbac entries for selected roles
onShare({
  shareType: 'roles',
  roleIds: selectedRoles,
  permissions: ['view']
});
```

---

## Usage Example

```tsx
import { ShareModal } from '@/components/shared/modal';

function EntityDetailPage({ entityCode, entityId, entityName }) {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const handleShare = async (shareData: ShareData) => {
    // Create RBAC entries based on share type
    await fetch('/api/v1/entity-rbac', {
      method: 'POST',
      body: JSON.stringify({
        entity_code: entityCode,
        entity_id: entityId,
        ...shareData
      })
    });
  };

  return (
    <>
      <Button icon={Share2} onClick={() => setIsShareModalOpen(true)}>
        Share
      </Button>

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        entityCode={entityCode}
        entityId={entityId}
        entityName={entityName}
        onShare={handleShare}
      />
    </>
  );
}
```

---

## Copy URL Feature

```typescript
const handleCopyUrl = async () => {
  await navigator.clipboard.writeText(`${window.location.origin}${shareUrl}`);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};
```

---

## Related Components

| Component | Relationship |
|-----------|--------------|
| [Modal](./Modal.md) | Base modal component |
| [Button](./Button.md) | Action buttons |
| [EntitySpecificInstancePage](./EntitySpecificInstancePage.md) | Parent page |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v10.0.0 | 2025-12-03 | Design system v10.0 dark theme |
| v1.0.0 | 2025-10-01 | Initial release |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
