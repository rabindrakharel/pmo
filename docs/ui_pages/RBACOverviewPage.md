# RBACOverviewPage

**Version:** 9.0.0 | **Location:** `apps/web/src/pages/RBACOverviewPage.tsx` | **Updated:** 2025-12-03

---

## Overview

RBACOverviewPage displays the RBAC permissions list using the universal EntityListOfInstancesPage with `entityCode="rbac"`. It leverages the universal page architecture for consistent CRUD operations.

**Core Principles:**
- Uses universal EntityListOfInstancesPage
- No custom implementation needed
- Full CRUD via universal components
- Consistent with all other entity list pages

---

## Page Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       RBACOVERVIEWPAGE ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Route: /rbac                                                               │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  EntityListOfInstancesPage (entityCode="rbac")                          ││
│  │                                                                         ││
│  │  All universal page features apply:                                     ││
│  │  - Table view with sorting/filtering                                    ││
│  │  - Inline editing                                                       ││
│  │  - Row actions (edit, delete)                                           ││
│  │  - Pagination                                                           ││
│  │  - Search                                                               ││
│  │  - Create button                                                        ││
│  │                                                                         ││
│  │  See EntityListOfInstancesPage documentation for full details.          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation

```typescript
import React from 'react';
import { EntityListOfInstancesPage } from './shared';

/**
 * RBAC Overview & Management Page
 * Uses universal EntityListOfInstancesPage with entityCode="rbac"
 */
export function RBACOverviewPage() {
  return <EntityListOfInstancesPage entityCode="rbac" />;
}
```

---

## RBAC Entity Fields

| Field | Type | Description |
|-------|------|-------------|
| `entity_code` | string | Entity type (project, task, etc.) |
| `entity_id` | uuid | Entity instance ID or 'all' |
| `person_code` | string | 'employee' or 'role' |
| `person_id` | uuid | Employee or role UUID |
| `permission_level` | number | 0-7 permission level |
| `active_flag` | boolean | Active status |

---

## Permission Levels

| Level | Permission | Description |
|-------|------------|-------------|
| 0 | VIEW | Read-only access |
| 1 | EDIT | Modify entity |
| 2 | SHARE | Share with others |
| 3 | DELETE | Soft delete |
| 4 | CREATE | Create new (type-level) |
| 5 | OWNER | Full control |

---

## Related Pages

| Page | Relationship |
|------|--------------|
| [RBACManagementPage](./RBACManagementPage.md) | Advanced management |
| [SettingsOverviewPage](./SettingsOverviewPage.md) | Access Control tab |
| [EntityListOfInstancesPage](./EntityListOfInstancesPage.md) | Universal page |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v9.0.0 | 2025-12-03 | Simplified to use universal page |
| v1.0.0 | 2025-10-01 | Initial release |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
