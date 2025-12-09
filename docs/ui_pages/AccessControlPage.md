# Access Control Page (RBAC UI)

> Role-Only RBAC Model v2.0.0 - Frontend architecture for managing role-based access control

**File**: `apps/web/src/pages/setting/AccessControlPage.tsx`
**Route**: `/settings/access-control`
**Version**: 2.0.0 | **Updated**: 2025-12-09

---

## Overview

The Access Control Page provides a two-panel interface for managing role-based permissions. All permissions are granted to **roles** (not directly to employees). People receive permissions through role membership via `entity_instance_link`.

**Core Principles:**
- Role-only permissions (no direct employee permissions)
- Visual inheritance indicators (none/cascade/mapped)
- Explicit deny support
- Three tabs: Permissions, Members, Effective Access

### RBAC Model
```
Role → entity_rbac (permissions) → Entity
  ↓
entity_instance_link (role → person membership)
  ↓
Person
```

---

## Page Layout Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Header: Back Button | Title | Create Role Button                       │
├──────────────────┬──────────────────────────────────────────────────────┤
│  LEFT PANEL      │  RIGHT PANEL                                         │
│  (w-80 fixed)    │  (flex-1)                                            │
│                  │                                                       │
│  ┌────────────┐  │  ┌─────────────────────────────────────────────────┐ │
│  │ Search     │  │  │ Role Header: Icon | Name | Code | View Role →  │ │
│  └────────────┘  │  ├─────────────────────────────────────────────────┤ │
│                  │  │ Tabs: [Permissions] [Members] [Effective Access]│ │
│  ┌────────────┐  │  ├─────────────────────────────────────────────────┤ │
│  │ ⭐ CEO  ▸  │  │  │                                                 │ │
│  │ PM         │  │  │  Tab Content Area                               │ │
│  │ Engineer   │  │  │  (scrollable)                                   │ │
│  │ ...        │  │  │                                                 │ │
│  └────────────┘  │  │                                                 │ │
│                  │  │                                                 │ │
│  ┌────────────┐  │  │                                                 │ │
│  │ X roles    │  │  └─────────────────────────────────────────────────┘ │
│  └────────────┘  │                                                       │
└──────────────────┴──────────────────────────────────────────────────────┘
```

---

## Permission Model v2.0.0

### Permission Levels

| Level | Name | Description | Color |
|-------|------|-------------|-------|
| 0 | VIEW | Read-only access | slate |
| 1 | COMMENT | Add comments (+ View) | sky |
| 2 | CONTRIBUTE | Add content (+ Comment) | cyan |
| 3 | EDIT | Modify data (+ Contribute) | blue |
| 4 | SHARE | Share with others (+ Edit) | violet |
| 5 | DELETE | Soft delete (+ Share) | orange |
| 6 | CREATE | Create new (type-level only) | emerald |
| 7 | OWNER | Full control | red |

### Inheritance Modes

| Mode | Description | Visual |
|------|-------------|--------|
| `none` | Permission applies only to target entity | Single dot |
| `cascade` | Same permission flows to all children | Tree with equal dots |
| `mapped` | Different permissions per child type | Tree with colored levels |

### Explicit Deny

When `is_deny = true`, the permission blocks access even if granted elsewhere through other roles or inheritance.

---

## State Management

### Local React State
| State Variable | Type | Purpose |
|----------------|------|---------|
| `selectedRoleId` | `string \| null` | Currently selected role UUID |
| `activeTab` | `'permissions' \| 'persons' \| 'effective'` | Active detail tab |
| `searchQuery` | `string` | Role list search filter |
| `showGrantModal` | `boolean` | GrantPermissionModal visibility |
| `showAssignPersonModal` | `boolean` | Add Member modal visibility |
| `selectedPersonId` | `string` | Selected person in add member dropdown |

### TanStack Query Cache Keys

| Query Key | Endpoint | Enabled Condition |
|-----------|----------|-------------------|
| `['access-control', 'roles']` | `GET /api/v1/role?limit=1000` | Always |
| `['access-control', 'role', roleId, 'permissions']` | `GET /api/v1/entity_rbac/role/:roleId/permissions` | `!!selectedRoleId` |
| `['access-control', 'role', roleId, 'members']` | `GET /api/v1/entity_rbac/role/:roleId/members` | `!!selectedRoleId` |
| `['access-control', 'role', roleId, 'effective']` | `GET /api/v1/entity_rbac/person/:personId/effective-access` | `!!selectedRoleId && activeTab === 'effective' && !!personsData` |
| `['access-control', 'available-persons']` | `GET /api/v1/person?limit=1000&active_flag=true` | `showAssignPersonModal` |
| `['access-control', 'entities']` | `GET /api/v1/entity/types` | Always |

### Mutations

| Mutation | Endpoint | Method | Invalidates |
|----------|----------|--------|-------------|
| `revokePermissionMutation` | `/api/v1/entity_rbac/permission/:id` | DELETE | `permissions`, `effective` |
| `addMemberMutation` | `/api/v1/entity_rbac/role/:roleId/members` | POST | `members` |
| `removeMemberMutation` | `/api/v1/entity_rbac/role/:roleId/members/:personId` | DELETE | `members` |

### Cache Invalidation Pattern

On successful mutation:
```typescript
queryClient.invalidateQueries({
  queryKey: ['access-control', 'role', selectedRoleId, 'permissions']
});
queryClient.invalidateQueries({
  queryKey: ['access-control', 'role', selectedRoleId, 'effective']
});
```

---

## API Integration

### Role Endpoints
| Route | Method | Business Logic |
|-------|--------|----------------|
| `/api/v1/role` | GET | List all roles from `app.role` table |
| `/role/new` | Navigation | Create new role (EntityFormPage) |
| `/role/:id` | Navigation | View role detail (EntitySpecificInstancePage) |

### RBAC Endpoints
| Route | Method | Business Logic |
|-------|--------|----------------|
| `/api/v1/entity_rbac/role/:roleId/permissions` | GET | Get all permissions granted to role from `entity_rbac` |
| `/api/v1/entity_rbac/role/:roleId/members` | GET | Get persons linked to role via `entity_instance_link` |
| `/api/v1/entity_rbac/role/:roleId/members` | POST | Create `entity_instance_link` (role → person) |
| `/api/v1/entity_rbac/role/:roleId/members/:personId` | DELETE | Delete `entity_instance_link` |
| `/api/v1/entity_rbac/permission/:id` | DELETE | Delete row from `entity_rbac` |
| `/api/v1/entity_rbac/person/:personId/effective-access` | GET | Compute resolved permissions after inheritance |
| `/api/v1/entity_rbac/grant-permission` | POST | Insert into `entity_rbac` with inheritance config |

### Supporting Endpoints
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/entity/types` | GET | Entity metadata for labels/icons |
| `/api/v1/person` | GET | Available persons for member assignment |

---

## Tab Content Panels

### 1. Permissions Tab
Displays all permissions granted to the selected role, grouped by entity type.

**Components Used**:
- `PermissionRuleCard` - Individual permission display
- `PermissionRuleCardSkeleton` - Loading state

**Data Flow**:
```
permissionsData?.data → groupedPermissions (useMemo) → PermissionRuleCard[]
```

**Grouping Logic**: Permissions grouped by `entity_code`, sorted alphabetically.

**Stats Computed** (memoized):
- `total` - Total permission count
- `typeLevel` - Permissions where `entity_instance_id === ALL_ENTITIES_ID`
- `instanceLevel` - Permissions for specific instances
- `withInheritance` - Permissions where `inheritance_mode !== 'none'`
- `denied` - Permissions where `is_deny === true`

### 2. Members Tab
Shows people assigned to the role with role membership management.

**Table Columns**: Person | Code | Email | Assigned | Actions

**Business Logic**:
- Adding member creates `entity_instance_link` between role and person
- Removing member deletes the link (person retains other role memberships)
- Members inherit ALL permissions assigned to the role

### 3. Effective Access Tab
Shows computed/resolved permissions for the first member after inheritance calculation.

**Components Used**:
- `EffectiveAccessTable` - Filterable table with direct/inherited indicators

**Note**: Only enabled when role has at least one member. Uses first member's ID to query effective permissions.

---

## Grant Permission Wizard (4 Steps)

**Component**: `GrantPermissionModal` (`apps/web/src/components/rbac/GrantPermissionModal.tsx`)

### Steps

| Step | Label | Description | Components |
|------|-------|-------------|------------|
| 1 | Target | Entity type + scope (all/specific) | Entity dropdown, Scope radio, EntityInstancePicker |
| 2 | Permission | Access level selection | PermissionLevelSelector |
| 3 | Inheritance | Child entity behavior | InheritanceModeSelector, ChildPermissionMapper |
| 4 | Options | Deny toggle + expiration | Checkbox, datetime input |

### Form State

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `entityCode` | string | `''` | Target entity type |
| `scope` | `'all' \| 'specific'` | `'all'` | Type-level vs instance-level |
| `entityInstanceId` | string | `null` | Specific instance UUID |
| `permission` | number | `0` | Permission level (0-7) |
| `inheritanceMode` | `'none' \| 'cascade' \| 'mapped'` | `'none'` | Inheritance behavior |
| `childPermissions` | `Record<string, number>` | `{ _default: 0 }` | Per-child-type permissions |
| `isDeny` | boolean | `false` | Explicit deny flag |
| `expiresTs` | string | `''` | Expiration timestamp |

### Backend Call
```typescript
POST /api/v1/entity_rbac/grant-permission
{
  role_id: roleId,
  entity_code: entityCode,
  entity_instance_id: scope === 'all' ? ALL_ENTITIES_ID : entityInstanceId,
  permission,
  inheritance_mode: inheritanceMode,
  child_permissions: inheritanceMode === 'mapped' ? childPermissions : {},
  is_deny: isDeny,
  expires_ts: expiresTs || null
}
```

---

## RBAC Component Library

### Components (`apps/web/src/components/rbac/`)

| Component | Purpose |
|-----------|---------|
| `PermissionLevelSelector` | Visual bar chart permission selector (0-7) |
| `InheritanceModeSelector` | Icon-based selector for none/cascade/mapped |
| `ChildPermissionMapper` | Configure per-child-type permissions |
| `PermissionRuleCard` | Display permission with inheritance visualization |
| `EffectiveAccessTable` | Show resolved permissions after inheritance |
| `GrantPermissionModal` | 4-step wizard for granting permissions |

### PermissionLevelSelector
**File**: `apps/web/src/components/rbac/PermissionLevelSelector.tsx`

**Exports**:
- `PermissionLevelSelector` - Full visual selector
- `PermissionBadge` - Inline badge display
- `getPermissionLabel(level)` - Get label for level
- `getPermissionColor(level)` - Get color class for level
- `PERMISSION_LEVELS` - Configuration array

### InheritanceModeSelector
**File**: `apps/web/src/components/rbac/InheritanceModeSelector.tsx`

**Exports**:
- `InheritanceModeSelector` - Full selector
- `InheritanceModeBadge` - Inline badge
- `InheritanceMode` - Type definition

### ChildPermissionMapper
**File**: `apps/web/src/components/rbac/ChildPermissionMapper.tsx`

**Features**:
- Default permission for unlisted types (`_default`)
- Per-entity-code overrides
- Add/remove override buttons
- Visual preview

### PermissionRuleCard
**File**: `apps/web/src/components/rbac/PermissionRuleCard.tsx`

Card display for a single permission rule with:
- Entity icon and name
- Type-level indicator (All/Specific)
- Permission badge
- Inheritance mode badge
- Visual permission bar (0-7 scale)
- Expandable child permission details
- Metadata (granted date, expiry, granter)
- Actions (Revoke)

**Props**:
| Prop | Type | Purpose |
|------|------|---------|
| `permission` | Permission | Permission data object |
| `entityName` | string | Display name |
| `entityIcon` | string | Lucide icon name |
| `entityLabels` | Record | Entity code → label map |
| `isTypeLevel` | boolean | ALL_ENTITIES_ID check |
| `onRevoke` | () => void | Revoke callback |

### EffectiveAccessTable
**File**: `apps/web/src/components/rbac/EffectiveAccessTable.tsx`

Table showing resolved permissions after inheritance calculation.

**Features**:
- Search filter by entity type
- Source filter (All/Direct/Inherited)
- Visual permission bars
- Source indicators (Direct = Target icon, Inherited = GitBranch icon)
- Inherited-from tracking

**Columns**: Entity Type | Access Level | Source

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

## Constants

```typescript
const ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111';
// Used for type-level permissions (applies to all instances of an entity type)
```

---

## Navigation Integration

**Entry Points**:
- Settings page button → `/settings/access-control`
- Direct URL navigation

**Exit Points**:
- Back arrow → `/settings`
- Create Role → `/role/new`
- View Role → `/role/:id`

---

## Related Documentation

| Document | Path |
|----------|------|
| RBAC Backend Service | `docs/services/entity-infrastructure.service.md` |
| RBAC Model Overview | `docs/rbac/access_control.md` |
| API Routes | `apps/api/src/modules/rbac/routes.ts` |
| DDL Schema | `db/entity_configuration_settings/06_entity_rbac.ddl` |
| State Management | `docs/state_management/STATE_MANAGEMENT.md` |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v2.0.0 | 2025-12-09 | Complete rewrite for role-only model with inheritance |
| v1.0.0 | 2025-10-01 | Initial release with employee/role dual model |
