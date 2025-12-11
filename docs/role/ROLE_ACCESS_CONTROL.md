# Role Access Control - Complete Technical Reference

> Role-Only RBAC Model v2.3.6 - Unified Permission Matrix with icon-only display, two-step grant flow, and end-to-end data flow

**Version**: 2.3.6 | **Updated**: 2025-12-10 | **Status**: Production

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
│  └── Access Controls (CUSTOM tab - RoleAccessControlPanel)                   │
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
function getCustomTabsForEntity(parentType: string, parentId: string): HeaderTab[] {
  const customTabs: HeaderTab[] = [];

  if (parentType === 'role') {
    customTabs.push({
      id: 'access-control',
      label: 'Access Controls',
      path: `/${parentType}/${parentId}/access-control`,
      icon: getIconComponent('shield'),
      order: 1000
    });
  }

  return customTabs;
}
```

### 2.4 Custom Tab Rendering (EntitySpecificInstancePage.tsx)

```typescript
) : currentChildEntity === 'access-control' && entityCode === 'role' ? (
  <RoleAccessControlPanel
    roleId={id!}
    roleName={data?.name || ''}
  />
) : (
  <EntityListOfInstancesTable ... />
)
```

---

## 3. Component Architecture

### 3.1 Component Hierarchy (v2.3.2)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  RBAC Components (v2.3.2 - Unified Permission Matrix)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  apps/web/src/components/rbac/                                               │
│  ├── index.ts                      # Exports all components                  │
│  ├── HierarchicalRbacMatrix.tsx    # Top-level container                     │
│  ├── EntityPermissionSection.tsx   # Per-entity section + instance picker    │
│  ├── PermissionMatrixTable.tsx     # Reusable matrix table                   │
│  ├── PermissionLevelSelector.tsx   # Permission level picker (0-7)           │
│  ├── InheritanceModeSelector.tsx   # None/Cascade/Mapped selector            │
│  ├── ChildPermissionMapper.tsx     # Per-child-type permission config        │
│  ├── GrantPermissionModal.tsx      # 4-step wizard for granting              │
│  └── RoleAccessControlPanel.tsx    # Simplified panel for role detail        │
│                                                                              │
│  REMOVED COMPONENTS (v2.3.0):                                                │
│  ├── PermissionCard.tsx            # Replaced by PermissionMatrixTable       │
│  ├── PermissionRuleCard.tsx        # Replaced by EntityPermissionSection     │
│  ├── EffectiveAccessTable.tsx      # Effective access computed at runtime    │
│  └── RolePermissionsMatrix.tsx     # Replaced by HierarchicalRbacMatrix      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 RoleAccessControlPanel Component

**File**: `apps/web/src/components/rbac/RoleAccessControlPanel.tsx`

Simplified permission management panel showing only the Permission Matrix. Members are shown in the separate "People" tab.

**Props**:
```typescript
interface RoleAccessControlPanelProps {
  roleId: string;
  roleName: string;
}
```

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
│                  │  │                                                     │ │
│  ┌────────────┐  │  │  HierarchicalRbacMatrix                             │ │
│  │ CEO     ▸  │  │  │  └── EntityPermissionSection (for each entity)     │ │
│  │ PM         │  │  │      └── PermissionMatrixTable                      │ │
│  │ Engineer   │  │  │                                                     │ │
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
| `GET /api/v1/entity_rbac/role/:roleId/hierarchical-permissions` | GET | Get permissions grouped by entity type |
| `POST /api/v1/entity_rbac/grant-permission` | POST | Grant/upsert permission |
| `PUT /api/v1/entity_rbac/permission/:id` | PUT | Update permission (level, inheritance, etc.) |
| `PATCH /api/v1/entity_rbac/permission/:id/child-permissions` | PATCH | Update child permission mapping |
| `DELETE /api/v1/entity_rbac/permission/:id` | DELETE | Hard delete permission |

**Grant Permission Request**:
```typescript
POST /api/v1/entity_rbac/grant-permission
{
  role_id: "uuid",
  entity_code: "project",
  entity_instance_id: "11111111-1111-1111-1111-111111111111",
  permission: 7,
  inheritance_mode: "mapped",
  child_permissions: { "task": 3, "_default": 0 },
  is_deny: false,
  expires_ts: null
}
```

**Update Permission Request**:
```typescript
PUT /api/v1/entity_rbac/permission/:permissionId
{
  permission?: number,
  inheritance_mode?: string,
  child_permissions?: object,
  is_deny?: boolean,
  expires_ts?: string | null
}
```

**Update Child Permissions Request**:
```typescript
PATCH /api/v1/entity_rbac/permission/:permissionId/child-permissions
{
  child_entity_code: string,
  permission: number  // -1 to remove, 0-7 to set
}
```

### 5.3 Role Membership Management

Role membership is managed via universal entity APIs:

| Route | Method | Business Logic |
|-------|--------|----------------|
| `GET /api/v1/person?parent_entity_code=role&parent_entity_instance_id={roleId}` | GET | List role members |
| `POST /api/v1/entity_instance_link` | POST | Add person to role |
| `DELETE /api/v1/entity_instance_link/{linkId}` | DELETE | Remove person from role |

---

## 6. State Management

### 6.1 TanStack Query Cache Keys

| Query Key | Endpoint | Purpose |
|-----------|----------|---------|
| `['access-control', 'roles']` | `GET /api/v1/role` | Role list |
| `['access-control', 'role', roleId, 'hierarchical-permissions']` | `GET /api/v1/entity_rbac/role/:roleId/hierarchical-permissions` | Role's hierarchical permissions |

### 6.2 Cache Invalidation

```typescript
// After granting/revoking/updating permission
queryClient.invalidateQueries({
  queryKey: ['access-control', 'role', roleId, 'hierarchical-permissions']
});
```

### 6.3 Local State (HierarchicalRbacMatrix)

| State Variable | Type | Purpose |
|----------------|------|---------|
| `pendingChanges` | `Record<string, PendingChange>` | Track unsaved permission changes |
| `searchQuery` | `string` | Filter entities by name |

### 6.4 Local State (EntityPermissionSection)

| State Variable | Type | Purpose |
|----------------|------|---------|
| `isExpanded` | `boolean` | Section expand/collapse |
| `showInstancePicker` | `boolean` | Instance picker visibility |
| `selectedInstanceConfigs` | `Record<string, PendingInstanceConfig>` | Pending grant configurations |
| `expandedConfigId` | `string | null` | Expanded inheritance config row |

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
│     └── Renders <HierarchicalRbacMatrix roleId={roleId} ... />               │
│                                                                              │
│  3. HierarchicalRbacMatrix fetches data                                      │
│     └── useQuery(['access-control', 'role', roleId, 'hierarchical-permissions'])
│     └── GET /api/v1/entity_rbac/role/:roleId/hierarchical-permissions        │
│                                                                              │
│  4. Response contains permissions grouped by entity type                     │
│     └── Each entity section rendered as <EntityPermissionSection />          │
│     └── Permissions displayed in <PermissionMatrixTable />                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Granting Permission (Two-Step Flow v2.3.0)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Step 1: Select Instances                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. User clicks "Grant Permission to [Entity]" button                        │
│  2. Instance picker panel opens                                              │
│  3. User searches and checks instances to grant                              │
│  4. "All [Entity]s" appears first if not already granted                     │
│  5. User clicks "Add (N)" button                                             │
│  6. Selected instances added to pending config                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Step 2: Configure in Table                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Pending instances appear in unified table with emerald background        │
│  2. User clicks permission level cells to set access                         │
│  3. User clicks Settings icon to configure inheritance                       │
│  4. User clicks "Save (N)" button                                            │
│  5. POST /api/v1/entity_rbac/grant-permission called for each               │
│  6. queryClient.invalidateQueries() refreshes data                          │
│  7. Pending rows become normal rows                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Modifying Existing Permission

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  User modifies permission in matrix table                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Click permission level cell in table                                     │
│     └── Row highlights amber with "modified" badge                           │
│     └── Change tracked in pendingChanges state                               │
│                                                                              │
│  2. Click Settings icon for inheritance config                               │
│     └── Inline panel expands below row                                       │
│     └── Select None/Cascade/Mapped                                           │
│     └── For Mapped: configure child permissions                              │
│                                                                              │
│  3. Click "Save Changes" in header                                           │
│     └── PUT /api/v1/entity_rbac/permission/:id (for each change)            │
│     └── PATCH /api/v1/entity_rbac/permission/:id/child-permissions          │
│                                                                              │
│  4. On success                                                               │
│     └── pendingChanges cleared                                               │
│     └── Query invalidated, data refreshed                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. UI/UX Design Patterns

### 8.1 Permission Matrix Table (v2.3.4 - Icon Only)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                     (empty header - no icons)                  Actions     │
├────────────────────────────────────────────────────────────────────────────┤
│ 🌐 All Projects      ◉   ◉   ◉   ●   ○   ○   ○   ○     ⚙️  🗑️             │
│ 📄 Kitchen Reno      ◉   ◉   ●   ○   ○   ○   ○   ○     ⚙️  🗑️             │
│ 📄 Bathroom [pending]◉   ●   ○   ○   ○   ○   ○   ○     ⚙️  🗑️             │
└────────────────────────────────────────────────────────────────────────────┘

Legend:
  ● = Current level (colored icon with glow effect)
  ◉ = Active level below current (colored icon, slightly dim)
  ○ = Inactive level (dim gray icon)

Icon States (no headers, no checkboxes - icons only):
  Inactive       = colored but dim ({textColor} opacity-30)
  Active         = colored ({textColor} opacity-80)
  Current Level  = colored + glow (drop-shadow-[0_0_6px_currentColor])
  Modified       = colored + amber glow (drop-shadow amber)

NOTE: Icon colors NEVER change - each permission keeps its own color
      (slate, sky, cyan, blue, violet, orange, emerald, red)
      Only opacity changes between dim (30%) and bright (80-100%)

Icon Sizes (v2.3.6):
  Normal         = h-4 w-4 (16px)
  Compact        = h-3.5 w-3.5 (14px)

Permission Icons (hover shows name):
  Eye          = VIEW (Slate)       - Read-only access
  MessageSquare = COMMENT (Sky)     - Add comments (+ View)
  PlusCircle    = CONTRIBUTE (Cyan) - Add content (+ Comment)
  Pencil       = EDIT (Blue)        - Modify data (+ Contribute)
  Share2       = SHARE (Violet)     - Share with others (+ Edit)
  Trash2       = DELETE (Orange)    - Soft delete (+ Share)
  Plus         = CREATE (Emerald)   - Create new (type-level)
  Crown        = OWNER (Red)        - Full control

Row States:
  Normal      = White background
  Pending     = Emerald-50 background + "pending" badge
  Modified    = Amber-50 background + "modified" badge
  Expanded    = Slate-100 background + ring
  Deny        = Red-50 background + "DENY" badge (Ban icon for all)

Actions:
  ⚙️ Settings2  = Configure inheritance (expands inline panel)
  🗑️ Trash2     = Revoke/remove permission
  ↩️ Undo2      = Revert changes (if modified)
```

### 8.2 Instance Picker

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Select instances to grant permissions:                   [Cancel] [Add(2)]  │
│ [🔍 Search instances...]                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ☐ 🌐 All Projects           (type-level, first if not granted)         │ │
│ │ ☑ 📄 Basement Renovation                                                │ │
│ │ ☑ 📄 Deck Construction                                                  │ │
│ │ ☐ 📄 Garage Addition                                                    │ │
│ │ ☐ 📄 Kitchen Remodel                                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ [ ] Select all visible (4)                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Inheritance Configuration Panel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ⚙️ Inheritance: Kitchen Renovation                                      ✕   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Inheritance to Child Entities:                                               │
│ ┌─────────────┐  ┌───────────────┐  ┌─────────────┐                         │
│ │ ○   None    │  │ ↓  Cascade    │  │ ⑂  Mapped   │                         │
│ └─────────────┘  └───────────────┘  └─────────────┘                         │
│                                                                              │
│ [If Cascade selected:]                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ↓ All 3 child types inherit EDIT                                        │ │
│ │ [Task] [Document] [Comment]                                             │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ [If Mapped selected:]                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ⑂ Child Entity Permissions (3 types)                                    │ │
│ │ Target         Vi Co Cn Ed Sh De Cr Ow                                  │ │
│ │ Task            ✓  ✓  ✓  ●                                              │ │
│ │ Document        ✓  ●                                                    │ │
│ │ Comment         ✓  ✓  ●                                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.4 Permission Level Visual

```
Permission Levels (color-coded):
  0 VIEW       = Slate   (read-only)
  1 COMMENT    = Sky     (add comments)
  2 CONTRIBUTE = Cyan    (insert data)
  3 EDIT       = Blue    (modify)
  4 SHARE      = Violet  (share access)
  5 DELETE     = Orange  (soft delete)
  6 CREATE     = Emerald (create new)
  7 OWNER      = Red     (full control)
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
| RBAC Components | `docs/ui_components/RolePermissionsMatrix.md` | Component architecture |
| Entity Infrastructure Service | `docs/services/entity-infrastructure.service.md` | Service API |
| State Management | `docs/state_management/STATE_MANAGEMENT.md` | TanStack Query patterns |
| DDL Schema | `db/entity_configuration_settings/06_entity_rbac.ddl` | Database schema |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v2.3.6 | 2025-12-10 | **Consistent icon colors** - Icons always keep their permission color; only opacity changes for dim/highlight states |
| v2.3.5 | 2025-12-10 | **Icon Refinement** - Increased inactive icon visibility (`opacity-50`), reduced icon size by 15% (h-4 w-4 normal, h-3.5 w-3.5 compact) |
| v2.3.4 | 2025-12-10 | **Icon-only Matrix** - Removed header icons and checkboxes; icons show dim (inactive) vs highlighted with glow (active) |
| v2.3.3 | 2025-12-10 | **Icon Headers** - Permission columns show Lucide icons with colored backgrounds and hover tooltips; removed "Target" label |
| v2.3.2 | 2025-12-10 | **Unified Permissions Table** - Existing + pending in one view, fixed grant-permission endpoint URL, fixed JSONB child_permissions storage |
| v2.3.1 | 2025-12-10 | "All [Entity]s" merged into instance picker dropdown |
| v2.3.0 | 2025-12-09 | **Two-step grant flow** - Instance picker → Configure in table; removed card-based components |
| v2.2.0 | 2025-12-08 | Permission Matrix UI with entity sections |
| v2.1.0 | 2025-12-07 | 45° rotated headers, batch save |
| v2.0.0 | 2025-12-06 | Role-Only RBAC Model with custom tab architecture |
| v1.0.0 | 2025-10-01 | Initial release |
