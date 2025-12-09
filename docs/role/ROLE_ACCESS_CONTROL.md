# Role Access Control - Complete Technical Reference

> Role-Only RBAC Model v2.1.0 - Custom tab architecture, Permission Matrix, component design, and end-to-end data flow

**Version**: 2.1.0 | **Updated**: 2025-12-09 | **Status**: Production

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Custom Tab Architecture](#2-custom-tab-architecture)
3. [Component Architecture](#3-component-architecture)
4. [Permission System](#4-permission-system)
5. [API Routes Reference](#5-api-routes-reference)
6. [State Management](#6-state-management)
7. [End-to-End Data Flow](#7-end-to-end-data-flow)
8. [UI/UX Design Patterns](#8-uiux-design-patterns)
9. [Database Schema](#9-database-schema)
10. [Related Documentation](#10-related-documentation)

---

## 1. Architecture Overview

### 1.1 Role-Only Model Principle

All permissions are granted to **roles**, not directly to people. People receive permissions through role membership via `entity_instance_link`.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ROLE-ONLY RBAC DATA FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   app.role ──────────────► app.entity_rbac ◄──────────── app.entity          │
│   (who holds)               (permissions)                (what is protected) │
│        │                         │                                           │
│        │                         │ role_id FK                                │
│        ▼                         ▼                                           │
│   entity_instance_link      RBAC checks resolve                              │
│   (role → person)           person → roles → permissions                     │
│        │                                                                     │
│        ▼                                                                     │
│   app.person ──────────────────────────────────────────────────────────────► │
│   (employees, customers)                                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Infrastructure Tables

| Table | Delete Behavior | Purpose |
|-------|-----------------|---------|
| `app.entity_rbac` | Hard delete | Role → Entity permission grants |
| `app.entity_instance_link` | Hard delete | Role → Person membership |
| `app.role` | Soft delete (`active_flag`) | Role definitions |
| `app.person` | Soft delete (`active_flag`) | People (employees, customers, vendors) |

### 1.3 Two Access Points

| Entry Point | Route | Purpose |
|-------------|-------|---------|
| **Settings Page** | `/settings/access-control` | Global RBAC management (all roles) |
| **Role Detail Tab** | `/role/:id/access-control` | Role-specific RBAC management |

---

## 2. Custom Tab Architecture

### 2.1 Custom Tab Pattern (v9.5.0)

The "Access Controls" tab on the Role detail page is a **custom non-entity tab** - it doesn't render `EntityListOfInstancesTable` like entity child tabs. Instead, it renders a specialized RBAC component.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Role Detail Page: /role/:roleId                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  DynamicChildEntityTabs                                                      │
│  ├── Overview (entity overview)                                              │
│  ├── People (entity child tab - EntityListOfInstancesTable)                  │
│  └── Access Controls (CUSTOM tab - RoleAccessControlPanel)     ◄── NEW      │
│                                                                              │
│  Route Pattern:                                                              │
│  /role/:id              → Overview tab                                       │
│  /role/:id/person       → People tab (entity child)                          │
│  /role/:id/access-control → Access Controls tab (custom component)           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Implementation Files

| File | Purpose |
|------|---------|
| `apps/web/src/components/shared/entity/DynamicChildEntityTabs.tsx` | Tab generation with custom tab support |
| `apps/web/src/pages/shared/EntitySpecificInstancePage.tsx` | Custom tab rendering logic |
| `apps/web/src/components/rbac/RoleAccessControlPanel.tsx` | Access Controls tab component |

### 2.3 Tab Generation (DynamicChildEntityTabs.tsx)

```typescript
/**
 * Get custom (non-entity) tabs for specific entity types.
 * These tabs render custom components instead of EntityListOfInstancesTable.
 *
 * v9.5.0: Added 'Access Controls' tab for role entity
 */
function getCustomTabsForEntity(parentType: string, parentId: string): HeaderTab[] {
  const customTabs: HeaderTab[] = [];

  // Role entity: Add "Access Controls" tab for RBAC management
  if (parentType === 'role') {
    customTabs.push({
      id: 'access-control',
      label: 'Access Controls',
      path: `/${parentType}/${parentId}/access-control`,
      icon: getIconComponent('shield'),
      order: 1000 // After entity tabs
    });
  }

  return customTabs;
}
```

### 2.4 Custom Tab Rendering (EntitySpecificInstancePage.tsx)

```typescript
// In the main render JSX, after entity child tab checks:
) : currentChildEntity === 'access-control' && entityCode === 'role' ? (
  // v9.5.0: Custom Access Controls tab for role entity (RBAC management)
  <RoleAccessControlPanel
    roleId={id!}
    roleName={data?.name || ''}
  />
) : (
  // Default: EntityListOfInstancesTable for entity child tabs
  <EntityListOfInstancesTable ... />
)
```

### 2.5 Adding Custom Tabs to Other Entities

To add a custom tab for another entity type:

1. **Add to `getCustomTabsForEntity()`**:
```typescript
if (parentType === 'your-entity') {
  customTabs.push({
    id: 'your-custom-tab',
    label: 'Custom Tab Label',
    path: `/${parentType}/${parentId}/your-custom-tab`,
    icon: getIconComponent('icon-name'),
    order: 1000
  });
}
```

2. **Add render condition in `EntitySpecificInstancePage.tsx`**:
```typescript
) : currentChildEntity === 'your-custom-tab' && entityCode === 'your-entity' ? (
  <YourCustomComponent entityId={id!} />
)
```

---

## 3. Component Architecture

### 3.1 Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Access Control Components                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TWO ENTRY POINTS:                                                           │
│                                                                              │
│  1. AccessControlPage (/settings/access-control)                             │
│     ├── Left Panel: Role list with search                                    │
│     └── Right Panel: Selected role details                                   │
│                                                                              │
│  2. RoleAccessControlPanel (/role/:id/access-control)                        │
│     └── Same right panel content, no role selector                           │
│                                                                              │
│  SHARED COMPONENTS (apps/web/src/components/rbac/):                          │
│  ├── PermissionLevelSelector  - Visual bar chart permission picker (0-7)    │
│  ├── PermissionBadge          - Inline permission level badge               │
│  ├── InheritanceModeSelector  - None/Cascade/Mapped selector                │
│  ├── InheritanceModeBadge     - Inline inheritance mode badge               │
│  ├── ChildPermissionMapper    - Per-child-type permission table             │
│  ├── PermissionRuleCard       - Display single permission with inheritance  │
│  ├── PermissionRuleCardSkeleton - Loading state                             │
│  ├── RolePermissionsMatrix    - Matrix table with inline edit (v2.1.0)  ◄── │
│  ├── EffectiveAccessTable     - Show resolved permissions with source       │
│  └── GrantPermissionModal     - 4-step wizard for granting permissions      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 RoleAccessControlPanel Component

**File**: `apps/web/src/components/rbac/RoleAccessControlPanel.tsx`

**Purpose**: Extracted from AccessControlPage's right panel for use in Role detail page tabs. Shows permissions and effective access for a specific role.

**Props**:
```typescript
interface RoleAccessControlPanelProps {
  roleId: string;    // Role UUID
  roleName: string;  // Role display name
}
```

**Two Tabs** (Members removed - shown in separate People tab):
1. **Permissions** - View/grant/revoke RBAC permissions (card-based view)
2. **Permission Matrix** - Interactive matrix table with inline editing (v2.1.0)

### 3.3 AccessControlPage Layout

**File**: `apps/web/src/pages/setting/AccessControlPage.tsx`
**Route**: `/settings/access-control`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Header: Back Button | Title | Create Role Button                           │
├──────────────────┬──────────────────────────────────────────────────────────┤
│  LEFT PANEL      │  RIGHT PANEL                                             │
│  (w-80 fixed)    │  (flex-1)                                                │
│                  │                                                           │
│  ┌────────────┐  │  ┌─────────────────────────────────────────────────────┐ │
│  │ Search     │  │  │ Role Header: Icon | Name | Code | View Role →      │ │
│  └────────────┘  │  ├─────────────────────────────────────────────────────┤ │
│                  │  │ Tabs: [Permissions] [Members] [Effective Access]    │ │
│  ┌────────────┐  │  ├─────────────────────────────────────────────────────┤ │
│  │ CEO     ▸  │  │  │                                                     │ │
│  │ PM         │  │  │  Tab Content Area                                   │ │
│  │ Engineer   │  │  │  (scrollable)                                       │ │
│  │ ...        │  │  │                                                     │ │
│  └────────────┘  │  │                                                     │ │
│                  │  │                                                     │ │
│  ┌────────────┐  │  │                                                     │ │
│  │ X roles    │  │  └─────────────────────────────────────────────────────┘ │
│  └────────────┘  │                                                           │
└──────────────────┴──────────────────────────────────────────────────────────┘
```

### 3.4 Grant Permission Wizard (4 Steps)

**Component**: `GrantPermissionModal`
**File**: `apps/web/src/components/rbac/GrantPermissionModal.tsx`

| Step | Label | Description | Components |
|------|-------|-------------|------------|
| 1 | Target | Entity type + scope (all/specific) | Entity dropdown, Scope radio, EntityInstancePicker |
| 2 | Permission | Access level selection | PermissionLevelSelector |
| 3 | Inheritance | Child entity behavior | InheritanceModeSelector, ChildPermissionMapper |
| 4 | Options | Deny toggle + expiration | Checkbox, datetime input |

**Form State**:
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

---

## 4. Permission System

### 4.1 Permission Levels (0-7)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Level  Name        Implies              Use Case                           │
│  ─────  ────        ───────              ────────                           │
│    0    VIEW        -                    Read-only access                   │
│    1    COMMENT     VIEW                 Add comments to records            │
│    2    CONTRIBUTE  COMMENT              Insert form data                   │
│    3    EDIT        CONTRIBUTE           Modify existing records            │
│    4    SHARE       EDIT                 Share with other users             │
│    5    DELETE      SHARE                Soft delete records                │
│    6    CREATE      DELETE               Create new instances (type-level)  │
│    7    OWNER       ALL                  Full control                       │
└─────────────────────────────────────────────────────────────────────────────┘

Permission Check: user.level >= required_level → ALLOWED
```

### 4.2 Type-Level vs Instance-Level

| Scope | `entity_instance_id` | Example |
|-------|---------------------|---------|
| Type-level | `11111111-1111-1111-1111-111111111111` (ALL_ENTITIES_ID) | "Can CREATE any project" |
| Instance-level | Specific UUID | "Can EDIT project X only" |

### 4.3 Inheritance Modes

| Mode | Description | SQL Logic |
|------|-------------|-----------|
| `none` | Permission applies only to target | Direct lookup only |
| `cascade` | Same permission flows to all children | Recursive join via `entity_instance_link` |
| `mapped` | Different permission per child type | `child_permissions` JSONB lookup |

**Mapped Mode Example**:
```json
{
  "inheritance_mode": "mapped",
  "child_permissions": {
    "task": 3,
    "employee": 0,
    "_default": 0
  }
}
```

### 4.4 Explicit Deny

When `is_deny = true`, blocks permission even if granted elsewhere. Checked **first** in resolution flow.

### 4.5 Permission Resolution Flow

```
check_entity_rbac(personId, entityCode, entityId, requiredLevel)
│
├─► 1. Find Person's Roles
│      Query entity_instance_link WHERE entity_code='role' AND child_entity_code='person'
│      Result: Array of role_ids
│
├─► 2. Check Explicit Deny (highest priority)
│      Query entity_rbac WHERE role_id IN (roles) AND is_deny=true
│      If found → DENIED (stop)
│
├─► 3. Check Direct Permissions
│      Query entity_rbac WHERE role_id IN (roles)
│        AND entity_code = target AND entity_instance_id IN (targetId, ALL_ENTITIES_ID)
│
├─► 4. Check Inherited Permissions (if inheritance_mode != 'none')
│      Recursive ancestor walk via entity_instance_link
│      For cascade: same permission level
│      For mapped: lookup child_permissions[entityCode] or _default
│
└─► 5. Return MAX(all permissions found) >= requiredLevel
```

---

## 5. API Routes Reference

### 5.1 Route File

**Location**: `apps/api/src/modules/rbac/routes.ts`

### 5.2 Role Permission Management

| Route | Method | Business Logic |
|-------|--------|----------------|
| `GET /api/v1/entity_rbac/role/:roleId/permissions` | GET | List role's permissions |
| `POST /api/v1/entity_rbac/grant-permission` | POST | Grant/upsert permission |
| `PUT /api/v1/entity_rbac/permission/:id` | PUT | Update permission (level, inheritance, etc.) |
| `DELETE /api/v1/entity_rbac/permission/:id` | DELETE | Hard delete permission |

**Update Permission Request** (v2.1.0):
```typescript
PUT /api/v1/entity_rbac/permission/:permissionId
{
  permission?: number,           // 0-7 permission level
  inheritance_mode?: string,     // 'none' | 'cascade' | 'mapped'
  child_permissions?: object,    // { "task": 3, "_default": 0 }
  is_deny?: boolean,             // Explicit deny flag
  expires_ts?: string | null     // Expiration timestamp
}
// Response: { id: string, message: "Permission updated successfully" }
```

**Grant Permission Request**:
```typescript
POST /api/v1/entity_rbac/grant-permission
{
  role_id: "uuid",
  entity_code: "project",
  entity_instance_id: "11111111-1111-1111-1111-111111111111", // ALL_ENTITIES_ID
  permission: 7,
  inheritance_mode: "mapped",
  child_permissions: { "task": 3, "_default": 0 },
  is_deny: false,
  expires_ts: null
}
```

### 5.3 Role Membership Management

Role membership is managed via universal entity APIs:

| Route | Method | Business Logic |
|-------|--------|----------------|
| `GET /api/v1/person?parent_entity_code=role&parent_entity_instance_id={roleId}` | GET | List role members |
| `POST /api/v1/entity_instance_link` | POST | Add person to role |
| `DELETE /api/v1/entity_instance_link/{linkId}` | DELETE | Remove person from role |

### 5.4 Effective Access

| Route | Method | Business Logic |
|-------|--------|----------------|
| `GET /api/v1/entity_rbac/person/:personId/effective-access` | GET | Compute resolved permissions after inheritance |

---

## 6. State Management

### 6.1 TanStack Query Cache Keys

| Query Key | Endpoint | Purpose |
|-----------|----------|---------|
| `['access-control', 'roles']` | `GET /api/v1/role` | Role list |
| `['access-control', 'role', roleId, 'permissions']` | `GET /api/v1/entity_rbac/role/:roleId/permissions` | Role's permissions |
| `['access-control', 'role', roleId, 'members']` | `GET /api/v1/person?parent_entity_code=role&...` | Role's members |
| `['access-control', 'role', roleId, 'effective']` | `GET /api/v1/entity_rbac/person/:personId/effective-access` | Resolved permissions |
| `['access-control', 'entities']` | `GET /api/v1/entity/types` | Entity metadata |

### 6.2 Cache Invalidation

```typescript
// After granting/revoking permission
queryClient.invalidateQueries(['access-control', 'role', roleId, 'permissions']);
queryClient.invalidateQueries(['access-control', 'role', roleId, 'effective']);

// After adding/removing member (AccessControlPage only)
queryClient.invalidateQueries(['access-control', 'role', roleId, 'members']);
```

### 6.3 Local State (RoleAccessControlPanel)

| State Variable | Type | Purpose |
|----------------|------|---------|
| `activeTab` | `'permissions' \| 'effective'` | Active detail tab |
| `showGrantModal` | `boolean` | GrantPermissionModal visibility |

---

## 7. End-to-End Data Flow

### 7.1 Viewing Permissions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  User navigates to /role/:roleId/access-control                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. EntitySpecificInstancePage renders                                       │
│     └── Detects currentChildEntity === 'access-control' && entityCode === 'role'
│     └── Renders <RoleAccessControlPanel roleId={id} roleName={name} />       │
│                                                                              │
│  2. RoleAccessControlPanel mounts                                            │
│     └── useQuery(['access-control', 'role', roleId, 'permissions'])          │
│     └── GET /api/v1/entity_rbac/role/:roleId/permissions                     │
│                                                                              │
│  3. API handler (rbac/routes.ts)                                             │
│     └── entityInfra.get_role_permissions(roleId)                             │
│     └── SELECT * FROM entity_rbac WHERE role_id = $roleId                    │
│                                                                              │
│  4. Response flows back                                                      │
│     └── TanStack Query caches at ['access-control', 'role', roleId, 'permissions']
│     └── Component renders PermissionRuleCard for each permission             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Granting Permission

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  User clicks "Grant Permission" button                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. GrantPermissionModal opens (4-step wizard)                               │
│     └── Step 1: Select entity type + scope                                   │
│     └── Step 2: Select permission level (0-7)                                │
│     └── Step 3: Configure inheritance mode                                   │
│     └── Step 4: Optional deny/expiration                                     │
│                                                                              │
│  2. User completes wizard, clicks "Grant Permission"                         │
│     └── POST /api/v1/entity_rbac/grant-permission                            │
│     └── Body: { role_id, entity_code, entity_instance_id, permission, ... }  │
│                                                                              │
│  3. API handler                                                              │
│     └── Validate role exists and is active                                   │
│     └── entityInfra.set_entity_rbac() → UPSERT into entity_rbac              │
│                                                                              │
│  4. On success                                                               │
│     └── Modal closes                                                         │
│     └── queryClient.invalidateQueries(['access-control', 'role', roleId, ...])
│     └── Permissions list auto-refetches                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Checking Effective Access

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  User clicks "Effective Access" tab                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Tab change triggers query                                                │
│     └── First: Fetch members (GET /api/v1/person?parent_entity_code=role...) │
│     └── Then: Fetch effective access for first member                        │
│                                                                              │
│  2. GET /api/v1/entity_rbac/person/:personId/effective-access                │
│     └── Computes resolved permissions after inheritance                      │
│     └── Walks ancestor chain via entity_instance_link                        │
│     └── Returns: [{ entity_code, permission, source: 'direct'|'inherited' }] │
│                                                                              │
│  3. EffectiveAccessTable renders                                             │
│     └── Shows each permission with source indicator                          │
│     └── Direct = Target icon, Inherited = GitBranch icon                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. UI/UX Design Patterns

### 8.1 Permission Level Visual Selector

```
                                              ┌───────┐
                                              │ OWNER │
                                     ┌───────┐│   7   │
                                     │CREATE ││       │
                            ┌───────┐│   6   ││       │
                            │DELETE ││       ││       │
                   ┌───────┐│   5   ││       ││       │
                   │ SHARE ││       ││       ││       │
          ┌───────┐│   4   ││       ││       ││       │
          │ EDIT  ││       ││       ││       ││       │
 ┌───────┐│   3   ││       ││       ││       ││       │
 │COMMENT││       ││       ││       ││       ││       │
 │   1   ││       ││       ││       ││       ││       │
─┴───────┴┴───────┴┴───────┴┴───────┴┴───────┴┴───────┴─
     ▲ Selected (click to change)
```

### 8.2 Inheritance Mode Visual Selector

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│        ●        │  │        ●        │  │    ●   ●   ●    │
│                 │  │       /|\       │  │   /|\ /|\ /|\   │
│                 │  │      / | \      │  │  E=3 W=0 T=5    │
│                 │  │     ●  ●  ●     │  │  ●   ●   ●      │
│                 │  │   (same level)  │  │ (different)     │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│      NONE       │  │     CASCADE     │  │     MAPPED      │
│  This entity    │  │  Same to all    │  │  Different per  │
│  only           │  │  children       │  │  child type     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 8.3 Permission Card Display

```
┌─────────────────────────────────────────────────────────────────┐
│  🏢 Office (All Instances)                           OWNER (7)  │
│                                                                  │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│                                                                  │
│  Inheritance: Mapped                                             │
│  ├─ Business     DELETE (5)   ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░            │
│  ├─ Project      EDIT (3)     ▓▓▓▓▓▓░░░░░░░░░░░░░░░░            │
│  ├─ Task         EDIT (3)     ▓▓▓▓▓▓░░░░░░░░░░░░░░░░            │
│  └─ _default     VIEW (0)     ▓░░░░░░░░░░░░░░░░░░░░░            │
│                                                                  │
│  Granted: 2025-01-15                         [Edit] [Revoke]    │
└─────────────────────────────────────────────────────────────────┘
```

### 8.4 RolePermissionsMatrix (v2.1.0)

**File**: `apps/web/src/components/rbac/RolePermissionsMatrix.tsx`

Interactive matrix table with 45° rotated column headers and inline editing.

**Features**:
- 45° rotated permission column headers (VIEW, COMMENT, CONTRIBUTE, EDIT, SHARE, DELETE, CREATE, OWNER)
- Checkmark indicators for each permission level
- Click to change permission level (batch edit mode)
- Unsaved changes tracked with amber highlighting
- Save Changes / Discard buttons appear when changes pending
- Per-row Undo button
- Revoke button per permission

**Visual Layout**:
```
┌──────────┬──────────────────┬────────────────────────────────────┬─────────┐
│ Entity   │ Target           │ V  C  Co Ed Sh De Cr Ow            │ Actions │
│          │                  │ ╱  ╱  ╱  ╱  ╱  ╱  ╱  ╱  (rotated) │         │
├──────────┼──────────────────┼────────────────────────────────────┼─────────┤
│ 📁 Project│ All Projects    │ ✓  ✓  ✓  ✓  ✓  ✓  ✓  ·            │ 🗑️      │
│          │ Kitchen Reno 🔄  │ ✓  ✓  ✓  ·  ·  ·  ·  ·            │ ↩️ 🗑️    │
│ ✅ Task  │ All Tasks        │ ✓  ✓  ·  ·  ·  ·  ·  ·            │ 🗑️      │
└──────────┴──────────────────┴────────────────────────────────────┴─────────┘
                                🔄 = cascade inheritance indicator

Legend:
  ✓ Green = Granted (inherited)
  ✓ Blue  = Current level
  ✓ Amber = Modified (unsaved)
  ✕ Red   = Explicit DENY
```

**Batch Save Flow**:
1. Click checkmarks to modify permissions (tracked locally)
2. Amber highlighting shows modified rows
3. "Save Changes" button appears in header
4. Click Save to persist all changes via batch API calls
5. Click Discard or per-row Undo to revert

**Props**:
```typescript
interface RolePermissionsMatrixProps {
  roleId: string;
  roleName: string;
  permissions: Permission[];
  isLoading?: boolean;
  entityLabels?: Record<string, string>;
  entityIcons?: Record<string, string>;
  onRevoke?: (permissionId: string) => void;
}
```

### 8.5 Effective Access Table

```
┌─────────────────────────────────────────────────────────────────┐
│  Effective Access for "CEO Role"                                 │
├─────────────────────────────────────────────────────────────────┤
│  Entity Type     Access Level   Source                          │
├─────────────────────────────────────────────────────────────────┤
│  Office          OWNER (7)      Direct                          │
│  Business        DELETE (5)     ← Inherited from Office         │
│  Project         EDIT (3)       ← Inherited from Office         │
│  Task            EDIT (3)       ← Inherited from Project        │
│  Wiki            ⛔ DENIED      Direct (Explicit Deny)          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Database Schema

### 9.1 entity_rbac Table

```sql
CREATE TABLE app.entity_rbac (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES app.role(id) ON DELETE CASCADE,
  entity_code varchar(50) NOT NULL,
  entity_instance_id uuid NOT NULL,  -- UUID or ALL_ENTITIES_ID
  permission integer NOT NULL DEFAULT 0,  -- 0-7
  inheritance_mode varchar(20) NOT NULL DEFAULT 'none',
  child_permissions jsonb NOT NULL DEFAULT '{}',
  is_deny boolean NOT NULL DEFAULT false,
  granted_by_person_id uuid REFERENCES app.person(id),
  granted_ts timestamptz DEFAULT now(),
  expires_ts timestamptz,
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now()
);

-- Unique: one permission per role per entity instance
CREATE UNIQUE INDEX idx_entity_rbac_unique
ON app.entity_rbac (role_id, entity_code, entity_instance_id);
```

### 9.2 Role Membership (entity_instance_link)

```sql
-- Role → Person membership
INSERT INTO app.entity_instance_link (
  entity_code,              -- 'role'
  entity_instance_id,       -- role.id
  child_entity_code,        -- 'person'
  child_entity_instance_id, -- person.id
  relationship_type         -- 'member'
) VALUES ('role', $roleId, 'person', $personId, 'member');
```

---

## 10. Related Documentation

| Document | Path | Purpose |
|----------|------|---------|
| Entity Infrastructure Service | `docs/services/entity-infrastructure.service.md` | Service API |
| State Management | `docs/state_management/STATE_MANAGEMENT.md` | TanStack Query patterns |
| Page Architecture | `docs/design_pattern/PAGE_LAYOUT_COMPONENT_ARCHITECTURE.md` | Universal page patterns |
| DDL Schema | `db/entity_configuration_settings/06_entity_rbac.ddl` | Database schema |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v2.1.0 | 2025-12-09 | **RolePermissionsMatrix** - Interactive matrix table with 45° headers, inline editing, batch save |
| v2.0.0 | 2025-12-09 | Role-Only Model with custom tab architecture, merged access_control.md and AccessControlPage.md |
| v1.0.0 | 2025-10-01 | Initial release with employee/role dual model |
