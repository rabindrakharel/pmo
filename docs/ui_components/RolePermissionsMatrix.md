# RBAC Permission Visualization Components

> Interactive permission visualization components: Card-based (HierarchicalRbacMatrix) and Table-based (RolePermissionsMatrix)

**Version**: 2.0.0 | **Updated**: 2025-12-10 | **Status**: Production

---

## Overview

Two visualization approaches for RBAC permissions:

| Component | Style | Use Case |
|-----------|-------|----------|
| `HierarchicalRbacMatrix` | Card-based | AccessControlPage - rich visualization with mode selection |
| `RolePermissionsMatrix` | Table-based | RoleAccessControlPanel - compact grid with 45° headers |

**Location**: `apps/web/src/components/rbac/`

---

## 1. HierarchicalRbacMatrix (Card-Based) - v2.2.0

**File**: `HierarchicalRbacMatrix.tsx`

Card-based hierarchical permission visualization with fold/unfold capability.

### Features

| Feature | Description |
|---------|-------------|
| **Collapsible Entity Types** | Entity types as accordion sections with expand/collapse |
| **Permission Cards** | Visual cards with permission bars and mode selection |
| **Mode-First Selection** | Choose inheritance mode (None/Cascade/Mapped) before child customization |
| **Mapped Child Permissions** | Expandable child permission sliders (only for Mapped mode) |
| **Cascade Summary** | Shows inheritance summary without expansion |
| **Batch Save** | Save all changes together, amber highlighting for pending |
| **Filter & Search** | Filter by entity type or instance name |
| **Expand/Collapse All** | Quick controls to expand or collapse all sections |

### Visual Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Permission Overview  [5 permissions]  [● 1 unsaved]     [Discard] [Save]    │
├─────────────────────────────────────────────────────────────────────────────┤
│ [🔍 Filter by entity type or instance...]                                    │
│ [Expand All] [Collapse All]                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ ┌─ 📁 Project (2 permissions) ───────────────────────────── [▼ Expand] ────┐│
│ │                                                                          ││
│ │  ┌───────────────────────────────────────────────────────────────────┐   ││
│ │  │ 📦 All Projects                                            [🗑️]   │   ││
│ │  │ Permission Level                                                   │   ││
│ │  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░  OWNER                   │   ││
│ │  │                                                                    │   ││
│ │  │ Child Entity Inheritance                                           │   ││
│ │  │ [ None ] [ Cascade ] [ ●Mapped ]                                   │   ││
│ │  │                                                                    │   ││
│ │  │ ┌ Child Permissions (3 types) ───────────── [▼ Expand] ──────────┐ │   ││
│ │  │ │  📋 Task      ▓▓▓▓▓▓▓▓░░░░░░  EDIT                             │ │   ││
│ │  │ │  📎 Artifact  ▓▓▓▓░░░░░░░░░░  VIEW                             │ │   ││
│ │  │ │  👤 Employee  ▓▓░░░░░░░░░░░░  COMMENT                          │ │   ││
│ │  │ └────────────────────────────────────────────────────────────────┘ │   ││
│ │  └───────────────────────────────────────────────────────────────────┘   ││
│ │                                                                          ││
│ │  ┌───────────────────────────────────────────────────────────────────┐   ││
│ │  │ 📄 Kitchen Renovation                        [Modified] [🗑️]       │   ││
│ │  │ Permission Level                                                   │   ││
│ │  │ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  EDIT *                │   ││
│ │  │                                                                    │   ││
│ │  │ Child Entity Inheritance                                           │   ││
│ │  │ [ ●None ] [ Cascade ] [ Mapped ]                                   │   ││
│ │  └───────────────────────────────────────────────────────────────────┘   ││
│ └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│ ┌─ ✅ Task (1 permission) ───────────────────────────────── [▶ Collapsed] ─┐│
│ └──────────────────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────────┤
│ Quick Reference:                                                             │
│   Permission Bar: ▓▓▓▓▓▓░░░░ = EDIT                                         │
│   Inheritance: ⬜ None  🟣 Cascade (same to all)  🔵 Mapped (customize)      │
│   Status: 🟠 Modified (unsaved)  🔴 Explicit DENY                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Props

```typescript
interface HierarchicalRbacMatrixProps {
  roleId: string;       // Role UUID
  roleName: string;     // Role display name
  onRevoke?: (permissionId: string) => void;  // Revoke callback
}
```

### Usage

```tsx
import { HierarchicalRbacMatrix } from '@/components/rbac';

<HierarchicalRbacMatrix
  roleId={selectedRoleId}
  roleName={selectedRole?.name || ''}
  onRevoke={(permissionId) => {
    if (confirm('Revoke this permission?')) {
      revokePermissionMutation.mutate(permissionId);
    }
  }}
/>
```

### API Endpoint

```typescript
GET /api/v1/entity_rbac/role/:roleId/hierarchical-permissions

// Response
{
  role_id: string;
  role_name: string;
  entities: [{
    entity_code: string;
    entity_label: string;
    entity_icon?: string;
    child_entity_codes: [{
      entity: string;
      ui_label: string;
      ui_icon?: string;
    }];
    permissions: [{
      id: string;
      entity_instance_id: string;
      entity_instance_name: string | null;
      permission: number;
      inheritance_mode: 'none' | 'cascade' | 'mapped';
      child_permissions: Record<string, number>;
      is_deny: boolean;
    }]
  }]
}
```

---

## 2. PermissionCard Component - v2.2.0

**File**: `PermissionCard.tsx`

Card component for visualizing a single permission with mode selection.

### Features

| Feature | Description |
|---------|-------------|
| **Visual Permission Bar** | Clickable segments for permission levels (0-7) |
| **Mode Selection** | Three buttons: None, Cascade, Mapped |
| **Child Permissions** | Expandable section for Mapped mode only |
| **Cascade Summary** | Shows all children inherit same level |
| **Pending Changes** | Amber highlighting for modified values |
| **Type-Level Support** | Special "All [Entity]s" display |

### Inheritance Mode Behavior

| Mode | Visual | Behavior |
|------|--------|----------|
| **None** | Gray circle | Permission stops at this entity |
| **Cascade** | Violet arrow | Shows summary: "All X child types inherit [LEVEL]" |
| **Mapped** | Cyan branch | Expandable section with per-child-type sliders |

### Props

```typescript
interface PermissionCardProps {
  id: string;                                   // Permission UUID
  entityInstanceId: string;                     // Target instance UUID
  entityInstanceName: string | null;            // Display name
  entityLabel: string;                          // Entity type label
  permission: number;                           // Current level (0-7)
  inheritanceMode: InheritanceMode;             // 'none' | 'cascade' | 'mapped'
  childPermissions: Record<string, number>;     // Child type → level mapping
  childEntityCodes: ChildEntityConfig[];        // Available child types
  isDeny: boolean;                              // Explicit deny flag
  isTypeLevel: boolean;                         // Type-level vs instance-level
  hasPendingChange: boolean;                    // Permission level modified
  hasModePendingChange: boolean;                // Mode modified
  pendingPermission?: number;                   // Pending permission level
  pendingMode?: InheritanceMode;                // Pending mode
  pendingChildPermissions?: Record<string, number>; // Pending child changes
  onPermissionChange: (level: number) => void;
  onModeChange: (mode: InheritanceMode) => void;
  onChildPermissionChange: (childCode: string, level: number) => void;
  onRevoke: () => void;
  disabled?: boolean;
}
```

---

## 3. PermissionBar Component - v2.2.0

**File**: `PermissionCard.tsx` (exported)

Visual bar for displaying and editing permission levels.

### Features

- 8 clickable segments (VIEW through OWNER)
- Color-coded by permission level
- Amber highlighting for modified values
- Compact mode for child permission sliders
- Label display with asterisk for modifications

### Props

```typescript
interface PermissionBarProps {
  level: number;                    // Current permission level (0-7)
  onChange?: (level: number) => void; // Click handler
  disabled?: boolean;               // Disable interaction
  compact?: boolean;                // Smaller size for child rows
  showLabel?: boolean;              // Show level label (default: true)
  pendingLevel?: number;            // Pending value (amber highlight)
}
```

### Click Behavior

| Action | Result |
|--------|--------|
| Click unchecked segment | Set permission to that level |
| Click current level | Reduce by 1 (minimum 0) |
| Click lower segment | Set to that level |

### Color Scheme

| Level | Color | Description |
|-------|-------|-------------|
| 0-2 (VIEW, COMMENT, CONTRIBUTE) | Slate | Read/Comment access |
| 3-4 (EDIT, SHARE) | Blue | Modification access |
| 5 (DELETE) | Orange | Destructive access |
| 6 (CREATE) | Emerald | Creation access |
| 7 (OWNER) | Red | Full control |

---

## 4. RolePermissionsMatrix (Table-Based) - v2.1.0

**File**: `RolePermissionsMatrix.tsx`

Interactive matrix table with 45° rotated column headers and inline editing.

### Features

| Feature | Description |
|---------|-------------|
| **45° Rotated Headers** | Permission columns displayed at angle |
| **Checkmark Indicators** | Visual checkmarks for each permission level |
| **Inline Editing** | Click any checkmark to change permission level |
| **Batch Save** | Changes tracked locally, saved together |
| **Unsaved Indicators** | Amber highlighting for modified rows |
| **Per-Row Undo** | Undo button for individual rows |
| **Search Filter** | Filter permissions by entity name |
| **Visual Legend** | Color-coded legend for status indicators |

### Visual Layout

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ Permission Matrix  [2 rules]  [● 1 unsaved change]     [Discard] [Save Changes]│
├────────────────────────────────────────────────────────────────────────────────┤
│ [🔍 Filter by entity...]                                                        │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ ┌──────────┬──────────────────┬────────────────────────────────────┬─────────┐ │
│ │ Entity   │ Target           │ V  C  Co Ed Sh De Cr Ow            │ Actions │ │
│ │          │                  │ ╱  ╱  ╱  ╱  ╱  ╱  ╱  ╱  (rotated) │         │ │
│ ├──────────┼──────────────────┼────────────────────────────────────┼─────────┤ │
│ │ 📁 Project│ All Projects    │ ✓  ✓  ✓  ✓  ✓  ✓  ✓  ·            │ 🗑️      │ │
│ │          │ Kitchen Reno 🔄  │ ✓  ✓  ✓  ·  ·  ·  ·  · (modified) │ ↩️ 🗑️    │ │
│ │ ✅ Task  │ All Tasks        │ ✓  ✓  ·  ·  ·  ·  ·  ·            │ 🗑️      │ │
│ └──────────┴──────────────────┴────────────────────────────────────┴─────────┘ │
│                                                                                 │
│ Legend:                                                                         │
│   ✓ Green  = Granted (inherited)                                               │
│   ✓ Blue   = Current level                                                     │
│   ✓ Amber  = Modified (unsaved)                                                │
│   ✕ Red    = Explicit DENY                                                     │
│   📦 Layers = Type-level (all instances)                                        │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Props

```typescript
interface RolePermissionsMatrixProps {
  roleId: string;                              // Role UUID
  roleName: string;                            // Role display name
  permissions: Permission[];                   // Array of permission objects
  isLoading?: boolean;                         // Show loading skeleton
  entityLabels?: Record<string, string>;       // Entity code → label mapping
  entityIcons?: Record<string, string>;        // Entity code → Lucide icon name
  onRevoke?: (permissionId: string) => void;   // Callback when revoke clicked
}

interface Permission {
  id: string;
  entity_code: string;
  entity_instance_id: string;
  entity_display?: string;
  entity_name?: string;
  permission: number;                          // 0-7
  permission_label?: string;
  inheritance_mode: 'none' | 'cascade' | 'mapped';
  child_permissions?: Record<string, number>;
  is_deny: boolean;
  granted_ts?: string;
  expires_ts?: string | null;
  granted_by_name?: string;
}
```

### Usage

```tsx
import { RolePermissionsMatrix } from '@/components/rbac';

<RolePermissionsMatrix
  roleId={selectedRoleId}
  roleName={selectedRole?.name || ''}
  permissions={permissionsData?.data || []}
  isLoading={permissionsLoading}
  entityLabels={entityLabels}
  entityIcons={entityIcons}
  onRevoke={(permissionId) => {
    if (confirm('Revoke this permission?')) {
      revokePermissionMutation.mutate(permissionId);
    }
  }}
/>
```

### Batch Save Flow

1. Click checkmarks to modify permissions (tracked locally)
2. Amber highlighting shows modified rows
3. "Save Changes" button appears in header
4. Click Save to persist all changes via batch API calls
5. Click Discard or per-row Undo to revert

---

## 5. Where Components Are Used

| Component | Page | Tab |
|-----------|------|-----|
| `HierarchicalRbacMatrix` | AccessControlPage | Permission Matrix |
| `RolePermissionsMatrix` | RoleAccessControlPanel | Permission Matrix |
| `PermissionRuleCard` | Both | Permissions |
| `GrantPermissionModal` | Both | Permissions (via button) |

---

## 6. API Integration

### Update Permission

```typescript
PUT /api/v1/entity_rbac/permission/:permissionId
{
  permission?: number,           // 0-7 permission level
  inheritance_mode?: string,     // 'none' | 'cascade' | 'mapped'
  child_permissions?: object,    // { "task": 3, "_default": 0 }
  is_deny?: boolean,             // Explicit deny flag
  expires_ts?: string | null     // Expiration timestamp
}

// Response
{ id: string, message: "Permission updated successfully" }
```

### Update Child Permissions

```typescript
PATCH /api/v1/entity_rbac/permission/:permissionId/child-permissions
{
  child_entity_code: string,     // Child entity type code
  permission: number             // -1 to remove, 0-7 to set
}

// Response
{ success: true, child_permissions: {...} }
```

### Cache Invalidation

After successful save:
```typescript
queryClient.invalidateQueries({
  queryKey: ['access-control', 'role', roleId, 'permissions']
});
queryClient.invalidateQueries({
  queryKey: ['access-control', 'role', roleId, 'hierarchical-permissions']
});
```

---

## 7. Related Files

| File | Purpose |
|------|---------|
| `apps/web/src/components/rbac/HierarchicalRbacMatrix.tsx` | Card-based matrix |
| `apps/web/src/components/rbac/PermissionCard.tsx` | Permission card + bar |
| `apps/web/src/components/rbac/RolePermissionsMatrix.tsx` | Table-based matrix |
| `apps/web/src/components/rbac/RoleAccessControlPanel.tsx` | Role detail panel |
| `apps/web/src/pages/setting/AccessControlPage.tsx` | Settings page |
| `apps/api/src/modules/rbac/routes.ts` | API endpoints |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v2.0.0 | 2025-12-10 | Added HierarchicalRbacMatrix, PermissionCard, PermissionBar; restructured doc |
| v1.0.0 | 2025-12-09 | Initial release with RolePermissionsMatrix table-based view |
