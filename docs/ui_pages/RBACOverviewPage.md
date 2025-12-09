# RBACOverviewPage (Access Control)

**Version:** 2.0.0 | **Location:** `apps/web/src/pages/setting/AccessControlPage.tsx` | **Updated:** 2025-12-09

---

## Overview

AccessControlPage is the primary interface for managing Role-Based Access Control (RBAC) in the system. It implements the **Role-Only RBAC Model v2.0.0** where all permissions are granted to roles, and people receive permissions through role membership.

**Core Principles:**
- Role-only permissions (no direct employee permissions)
- Visual inheritance indicators (none/cascade/mapped)
- Explicit deny support
- Three tabs: Permissions, Members, Effective Access

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                       ACCESS CONTROL PAGE ARCHITECTURE (v2.0.0)                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌──────────────────────┐  ┌──────────────────────────────────────────────────────┐ │
│  │  ROLES LIST          │  │  ROLE DETAIL                                         │ │
│  │  ────────────────    │  │  ──────────────────────────────────────────────────  │ │
│  │                      │  │                                                      │ │
│  │  🔍 Search...        │  │  ┌─────────────┬─────────────┬─────────────────────┐ │ │
│  │                      │  │  │ Permissions │   Members   │  Effective Access   │ │ │
│  │  ┌────────────────┐  │  │  └─────────────┴─────────────┴─────────────────────┘ │ │
│  │  │ ⭐ CEO         │◄─┤  │                                                      │ │
│  │  └────────────────┘  │  │  Permission Rules:                                   │ │
│  │  ┌────────────────┐  │  │  ┌──────────────────────────────────────────────┐    │ │
│  │  │   PM           │  │  │  │  PermissionRuleCard                          │    │ │
│  │  └────────────────┘  │  │  │  - Visual inheritance indicators             │    │ │
│  │  ┌────────────────┐  │  │  │  - Expandable child permissions              │    │ │
│  │  │   Engineer     │  │  │  │  - Edit/Revoke actions                       │    │ │
│  │  └────────────────┘  │  │  └──────────────────────────────────────────────┘    │ │
│  │                      │  │                                                      │ │
│  └──────────────────────┘  └──────────────────────────────────────────────────────┘ │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Components

### Main Page: AccessControlPage

**Location:** `apps/web/src/pages/setting/AccessControlPage.tsx`

Two-panel layout with role list (left) and role detail (right).

### RBAC Components (`apps/web/src/components/rbac/`)

| Component | Purpose |
|-----------|---------|
| `PermissionLevelSelector` | Visual bar chart permission selector (0-7) |
| `InheritanceModeSelector` | Icon-based selector for none/cascade/mapped |
| `ChildPermissionMapper` | Configure per-child-type permissions |
| `PermissionRuleCard` | Display permission with inheritance visualization |
| `EffectiveAccessTable` | Show resolved permissions after inheritance |
| `GrantPermissionModal` | 4-step wizard for granting permissions |

---

## Permission Model v2.0.0

### Permission Levels

| Level | Name | Description |
|-------|------|-------------|
| 0 | VIEW | Read-only access |
| 1 | COMMENT | Add comments (+ View) |
| 2 | CONTRIBUTE | Add content (+ Comment) |
| 3 | EDIT | Modify data (+ Contribute) |
| 4 | SHARE | Share with others (+ Edit) |
| 5 | DELETE | Soft delete (+ Share) |
| 6 | CREATE | Create new (type-level only) |
| 7 | OWNER | Full control |

### Inheritance Modes

| Mode | Description |
|------|-------------|
| `none` | Permission applies only to the target entity |
| `cascade` | Same permission level flows to all children |
| `mapped` | Different permission levels per child entity type |

### Explicit Deny

When `is_deny = true`, the permission blocks access even if granted elsewhere through other roles or inheritance.

---

## Grant Permission Wizard (4 Steps)

### Step 1: Target Selection
- Select entity type (project, task, etc.)
- Choose scope: All instances (type-level) or specific instance

### Step 2: Permission Level
- Visual bar chart selector
- Shows permission hierarchy

### Step 3: Child Inheritance
- None: No inheritance
- Cascade: Same permission to children
- Mapped: Configure per-child-type permissions

### Step 4: Special Options
- Explicit DENY toggle
- Expiration date (optional)
- Preview of grant

---

## API Integration

### Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/role` | GET | List all roles |
| `/api/v1/entity_rbac/role/:id/permissions` | GET | Get role permissions |
| `/api/v1/entity_rbac/role/:id/members` | GET | Get role members |
| `/api/v1/entity_rbac/role/:id/members` | POST | Add member to role |
| `/api/v1/entity_rbac/role/:id/members/:personId` | DELETE | Remove member |
| `/api/v1/entity_rbac/grant-permission` | POST | Grant permission |
| `/api/v1/entity_rbac/permission/:id` | DELETE | Revoke permission |
| `/api/v1/entity_rbac/person/:id/effective-access` | GET | Get effective permissions |

---

## Data Structures

### Permission

```typescript
interface Permission {
  id: string;
  entity_code: string;
  entity_instance_id: string;  // UUID or ALL_ENTITIES_ID
  permission: number;          // 0-7
  inheritance_mode: 'none' | 'cascade' | 'mapped';
  child_permissions: Record<string, number>;  // { "task": 3, "_default": 0 }
  is_deny: boolean;
  granted_ts: string;
  expires_ts?: string | null;
}
```

### Role Member

```typescript
interface PersonAssignment {
  person_id: string;
  person_name: string;
  person_code?: string;
  person_email?: string;
  assigned_ts: string;
  link_id: string;
}
```

---

## Related Documentation

| Document | Path |
|----------|------|
| RBAC Backend Service | `docs/services/entity-infrastructure.service.md` |
| Permission Inheritance Design | `docs/design_pattern/PERMISSION_INHERITANCE_IMPLEMENTATION.md` |
| API Routes | `apps/api/src/modules/rbac/routes.ts` |
| DDL Schema | `db/entity_configuration_settings/06_entity_rbac.ddl` |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v2.0.0 | 2025-12-09 | Complete rewrite for role-only model with inheritance |
| v1.0.0 | 2025-10-01 | Initial release with employee/role dual model |

---

**Last Updated:** 2025-12-09 | **Status:** Production Ready
