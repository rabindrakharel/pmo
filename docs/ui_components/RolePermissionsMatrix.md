# RBAC Permission Management Components

> Unified Permission Matrix with entity sections, instance picker, ownership model, and inline editing (v2.4.0)

**Version**: 2.4.0 | **Updated**: 2025-12-13 | **Status**: Production

---

## Overview

The RBAC Permission Management system provides a hierarchical, entity-based permission matrix for managing role permissions. All permissions are granted to **roles**, not directly to users.

**Location**: `apps/web/src/components/rbac/`

**Architecture**: `HierarchicalRbacMatrix` → `EntityPermissionSection` → `PermissionMatrixTable`

---

## 1. Component Hierarchy (v2.3.2)

```
apps/web/src/components/rbac/
├── index.ts                      # Exports all components
├── HierarchicalRbacMatrix.tsx    # Top-level container
├── EntityPermissionSection.tsx   # Per-entity section with instance picker
├── PermissionMatrixTable.tsx     # Reusable matrix table
├── PermissionLevelSelector.tsx   # Permission level picker + PERMISSION_LEVELS config
├── InheritanceModeSelector.tsx   # Inheritance mode picker (None/Cascade/Mapped)
├── ChildPermissionMapper.tsx     # Per-child-type permission configuration
├── GrantPermissionModal.tsx      # 4-step wizard for granting permissions
└── RoleAccessControlPanel.tsx    # Simplified panel for role detail page
```

### Removed Components (v2.3.0)

The following components were removed in favor of the unified matrix approach:

| Removed Component | Replaced By |
|-------------------|-------------|
| `PermissionCard.tsx` | `PermissionMatrixTable` with row-based display |
| `PermissionRuleCard.tsx` | `EntityPermissionSection` with matrix table |
| `EffectiveAccessTable.tsx` | Effective access computed at runtime |
| `RolePermissionsMatrix.tsx` | `HierarchicalRbacMatrix` with entity sections |

---

## 2. HierarchicalRbacMatrix Component (v2.3.0)

**File**: `HierarchicalRbacMatrix.tsx`

Top-level container that orchestrates the permission matrix display.

### Features

| Feature | Description |
|---------|-------------|
| **Entity Sections** | Collapsible sections for each entity type |
| **Batch Save** | Track changes locally, save all at once |
| **Search Filter** | Filter by entity type or instance name |
| **Unsaved Indicator** | Amber badge shows pending change count |

### Props

```typescript
interface HierarchicalRbacMatrixProps {
  roleId: string;                                    // Role UUID
  roleName: string;                                  // Role display name
  onRevoke?: (permissionId: string) => void;         // Revoke callback
  onGrantPermission?: (entityCode: string, scope: 'all' | 'specific') => void;
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
  onGrantPermission={() => setShowGrantModal(true)}
/>
```

### API Endpoint

```typescript
GET /api/v1/entity_rbac/role/:roleId/hierarchical-permissions

// Response (v2.4.0 - includes ownership model)
{
  role_id: string;
  role_name: string;
  role_code?: string;
  entities: [{
    entity_code: string;
    entity_label: string;
    entity_icon?: string;
    root_level_entity_flag: boolean;   // v2.4.0: Is this a traversal root? (business, project, customer)
    child_entity_codes: [{
      entity: string;
      ui_label: string;
      ui_icon?: string;
      order?: number;
      ownership_flag: boolean;         // v2.4.0: true=owned (cascade), false=lookup (COMMENT max)
    }];
    permissions: [{
      id: string;
      entity_instance_id: string;
      entity_instance_name: string | null;
      permission: number;
      permission_label: string;
      inheritance_mode: 'none' | 'cascade' | 'mapped';
      child_permissions: Record<string, number>;
      is_deny: boolean;
      granted_ts?: string;
      expires_ts?: string | null;
    }]
  }]
}
```

---

## 3. EntityPermissionSection Component (v2.4.0)

**File**: `EntityPermissionSection.tsx`

Individual entity type section with two-step grant flow, unified permissions table, and ownership model indicators.

### Features

| Feature | Description |
|---------|-------------|
| **Collapsible Section** | Expand/collapse per entity type |
| **ROOT Badge** | Shows emerald badge with anchor icon for root-level entities (v2.4.0) |
| **Unified Permissions Table** | Existing + pending grants in one view |
| **Instance Picker** | Search and select instances to grant permissions |
| **"All [Entity]s" Option** | Type-level permission merged into instance picker |
| **Inline Inheritance Config** | Settings icon expands inheritance panel |
| **Owned vs Lookup Display** | Cascade summary shows owned (violet) vs lookup (amber) children (v2.4.0) |
| **Lookup Child Capping** | Lookup children capped at COMMENT permission (v2.4.0) |
| **Per-Section Save** | Save button for pending grants |

### Visual Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Icon] PROJECT ACCESS                                         [▼]   │
│ 3 permissions • unsaved changes                                     │
├─────────────────────────────────────────────────────────────────────┤
│ Permissions (2 granted, 1 pending)              [Clear] [Save(1)]   │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Target              Vi Co Cn Ed Sh De Cr Ow  Actions            │ │
│ │ 🌐 All Projects      ✓  ✓  ✓  ●                ⚙️  🗑️             │ │
│ │ 📄 Kitchen Reno      ✓  ✓  ●                   ⚙️  🗑️             │ │
│ │ 📄 Bathroom [pending]✓  ●                      ⚙️  🗑️             │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ [+ Grant Permission to Project]                                     │
│                                                                     │
│ ┌───────────────────────────────────────────────────────────────────│
│ │ Select instances to grant permissions:          [Cancel] [Add(2)]│
│ │ [🔍 Search instances...]                                         │
│ │ ┌─────────────────────────────────────────────────────────────┐  │
│ │ │ ☐ 🌐 All Projects                                           │  │
│ │ │ ☑ 📄 Basement Reno                                          │  │
│ │ │ ☑ 📄 Deck Construction                                      │  │
│ │ │ ☐ 📄 Garage Addition                                        │  │
│ │ └─────────────────────────────────────────────────────────────┘  │
│ └───────────────────────────────────────────────────────────────────│
└─────────────────────────────────────────────────────────────────────┘
```

### Two-Step Grant Flow (v2.3.0)

**Step 1: Select Instances**
- Click "Grant Permission to [Entity]" button
- Instance picker opens with search
- "All [Entity]s" appears first (if not already granted)
- Check instances to grant
- Click "Add (N)" to add to pending

**Step 2: Configure in Table**
- Selected instances appear as pending rows (emerald background)
- Click permission level cells to set access
- Click Settings icon for inheritance config
- Click Save to persist all pending grants

### Props (v2.4.0)

```typescript
// Child entity config with ownership flag
interface ChildEntityConfig {
  entity: string;
  ui_label: string;
  ui_icon?: string;
  order?: number;
  ownership_flag: boolean;  // v2.4.0: true=owned (cascade), false=lookup (COMMENT max)
}

interface EntityPermissionSectionProps {
  entityCode: string;
  entityLabel: string;
  entityIcon?: string;
  rootLevelEntityFlag?: boolean;        // v2.4.0: Shows ROOT badge when true
  childEntityCodes: ChildEntityConfig[];  // v2.4.0: Includes ownership_flag
  permissions: HierarchicalPermission[];
  roleId: string;
  pendingPermissions: Record<string, number>;
  pendingModes: Record<string, InheritanceMode>;
  pendingChildPermissions: Record<string, Record<string, number>>;
  onPermissionChange: (permissionId: string, level: number) => void;
  onModeChange: (permissionId: string, mode: InheritanceMode) => void;
  onChildPermissionChange: (permissionId: string, childCode: string, level: number) => void;
  onRevoke?: (permissionId: string) => void;
  onGrantPermission?: (entityCode: string, scope: 'all' | 'specific') => void;
  onPermissionsGranted?: () => void;
  disabled?: boolean;
}
```

### Ownership Model Visual Elements (v2.4.0)

#### ROOT Badge

Root-level entities display an emerald badge with anchor icon:

```tsx
{rootLevelEntityFlag && (
  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 rounded-full flex items-center gap-1">
    <Anchor className="h-3 w-3" />
    ROOT
  </span>
)}
```

#### Cascade Summary with Ownership

When inheritance mode is `cascade`, the UI shows owned vs lookup children:

- **Owned children** (`ownership_flag: true`): Violet badges, show full permission cascade
- **Lookup children** (`ownership_flag: false`): Amber badges with link icon, show "→ Comment" (max)

#### Mapped Mode Lookup Capping

In mapped mode, lookup children:
- Display "(lookup)" suffix in label
- Have permission icons beyond COMMENT (1) disabled
- `_maxLevel` property enforces cap in logic

---

## 4. PermissionMatrixTable Component (v2.3.6)

**File**: `PermissionMatrixTable.tsx`

Reusable matrix table with icon-only permission display and inline editing.

### Features

| Feature | Description |
|---------|-------------|
| **Icon-Only Display** | Permission columns show only icons (no headers, no checkboxes) |
| **Consistent Colors** | Icons always keep their permission color - only opacity changes |
| **Dim/Highlighted States** | Inactive icons are dim (`opacity-30`), active icons are bright with glow |
| **Compact Icons** | Icons are 15% smaller than default (h-4 w-4 normal, h-3.5 w-3.5 compact) |
| **Hover Tooltips** | Permission name appears on hover |
| **Click to Change** | Click higher level to set, click current to decrease |
| **Row States** | Normal, pending (emerald), modified (amber), expanded, deny (red) |
| **Actions Column** | Settings, Undo, Revoke buttons |

### Permission Icons (v2.3.6 - Consistent Colors)

| Level | Icon | Color | Active State | Inactive State |
|-------|------|-------|--------------|----------------|
| 0 VIEW | Eye | Slate | `text-slate-600` + glow | `text-slate-600 opacity-30` |
| 1 COMMENT | MessageSquare | Sky | `text-sky-600` + glow | `text-sky-600 opacity-30` |
| 2 CONTRIBUTE | PlusCircle | Cyan | `text-cyan-600` + glow | `text-cyan-600 opacity-30` |
| 3 EDIT | Pencil | Blue | `text-blue-600` + glow | `text-blue-600 opacity-30` |
| 4 SHARE | Share2 | Violet | `text-violet-600` + glow | `text-violet-600 opacity-30` |
| 5 DELETE | Trash2 | Orange | `text-orange-600` + glow | `text-orange-600 opacity-30` |
| 6 CREATE | Plus | Emerald | `text-emerald-600` + glow | `text-emerald-600 opacity-30` |
| 7 OWNER | Crown | Red | `text-red-600` + glow | `text-red-600 opacity-30` |

### Icon States

| State | Styling |
|-------|---------|
| Inactive | `{textColor} opacity-30` (dim, keeps original color) |
| Active (not current level) | `{textColor} opacity-80` |
| Active (current level) | `{textColor} drop-shadow-[0_0_6px_currentColor]` (glowing) |
| Modified (current level) | `{textColor} drop-shadow-[0_0_6px_rgba(245,158,11,0.7)]` (amber glow) |
| Deny | `text-red-400` (Ban icon for all columns) |

### Icon Sizes

| Mode | Size |
|------|------|
| Normal | `h-4 w-4` (16px) |
| Compact | `h-3.5 w-3.5` (14px) |

### Row Styling

| State | Background | Badge |
|-------|------------|-------|
| Normal | White | None |
| Pending | `bg-emerald-50/50` | "pending" |
| Modified | `bg-amber-50` | "modified" |
| Expanded | `bg-slate-100` + ring | None |
| Deny | `bg-red-50` | "DENY" |

### Props

```typescript
interface MatrixRow {
  id: string;
  label: string;
  icon?: string;
  permission: number;
  isDeny?: boolean;
  isTypeLevel?: boolean;
  hasInheritanceConfig?: boolean;
}

interface PermissionMatrixTableProps {
  rows: MatrixRow[];
  pendingChanges: Record<string, number>;
  onPermissionChange: (rowId: string, level: number) => void;
  onRevoke?: (rowId: string) => void;
  onConfigureInheritance?: (rowId: string) => void;
  onUndo?: (rowId: string) => void;
  expandedConfigId?: string | null;
  disabled?: boolean;
  compact?: boolean;
}
```

### Click Behavior

| Action | Result |
|--------|--------|
| Click inactive icon | Set permission to that level |
| Click current level (glowing) | Reduce by 1 (minimum 0) |
| Click lower active icon | Set to that level |

---

## 5. PermissionLevelSelector Component

**File**: `PermissionLevelSelector.tsx`

Visual bar chart selector for permission levels (0-7).

### PERMISSION_LEVELS Configuration

```typescript
export const PERMISSION_LEVELS = [
  { value: 0, label: 'VIEW', shortLabel: 'Vi', bgColor: 'bg-slate-500', textColor: 'text-slate-600', ringColor: 'ring-slate-300', description: 'Read-only access' },
  { value: 1, label: 'COMMENT', shortLabel: 'Co', bgColor: 'bg-sky-500', textColor: 'text-sky-600', ringColor: 'ring-sky-300', description: 'Add comments' },
  { value: 2, label: 'CONTRIBUTE', shortLabel: 'Cn', bgColor: 'bg-cyan-500', textColor: 'text-cyan-600', ringColor: 'ring-cyan-300', description: 'Insert data' },
  { value: 3, label: 'EDIT', shortLabel: 'Ed', bgColor: 'bg-blue-500', textColor: 'text-blue-600', ringColor: 'ring-blue-300', description: 'Modify data' },
  { value: 4, label: 'SHARE', shortLabel: 'Sh', bgColor: 'bg-violet-500', textColor: 'text-violet-600', ringColor: 'ring-violet-300', description: 'Share access' },
  { value: 5, label: 'DELETE', shortLabel: 'De', bgColor: 'bg-orange-500', textColor: 'text-orange-600', ringColor: 'ring-orange-300', description: 'Soft delete' },
  { value: 6, label: 'CREATE', shortLabel: 'Cr', bgColor: 'bg-emerald-500', textColor: 'text-emerald-600', ringColor: 'ring-emerald-300', description: 'Create new' },
  { value: 7, label: 'OWNER', shortLabel: 'Ow', bgColor: 'bg-red-500', textColor: 'text-red-600', ringColor: 'ring-red-300', description: 'Full control' },
];
```

### Exports

```typescript
export { PermissionLevelSelector };  // Bar chart selector component
export { PermissionBadge };          // Inline badge display
export { getPermissionLabel };       // Get label by value
export { getPermissionColor };       // Get color by value
export { PERMISSION_LEVELS };        // Configuration array
```

---

## 6. InheritanceModeSelector Component

**File**: `InheritanceModeSelector.tsx`

Visual selector for inheritance modes.

### Inheritance Modes

| Mode | Icon | Description |
|------|------|-------------|
| `none` | Circle | Permission applies only to target |
| `cascade` | ArrowDownCircle | Same permission to all children |
| `mapped` | GitBranch | Different permission per child type |

### Exports

```typescript
export { InheritanceModeSelector };  // Full selector component
export { InheritanceModeBadge };     // Inline badge display
export type { InheritanceMode };     // 'none' | 'cascade' | 'mapped'
```

---

## 7. Where Components Are Used

| Component | Page | Usage |
|-----------|------|-------|
| `HierarchicalRbacMatrix` | `RoleAccessControlPanel` | Role detail tab |
| `GrantPermissionModal` | `RoleAccessControlPanel` | Grant new permissions |
| `EntityPermissionSection` | Inside `HierarchicalRbacMatrix` | Per-entity sections |
| `PermissionMatrixTable` | Inside `EntityPermissionSection` | Matrix table display |

> **Note (v2.3.7)**: AccessControlPage was removed. All RBAC management is now done through the Role detail page's "Access Controls" tab.

---

## 8. API Integration

### Grant Permission

```typescript
POST /api/v1/entity_rbac/grant-permission
{
  role_id: string;
  entity_code: string;
  entity_instance_id: string;  // UUID or ALL_ENTITIES_ID
  permission: number;          // 0-7
  inheritance_mode: 'none' | 'cascade' | 'mapped';
  child_permissions: Record<string, number>;
  is_deny: boolean;
}
```

### Update Permission

```typescript
PUT /api/v1/entity_rbac/permission/:permissionId
{
  permission?: number;
  inheritance_mode?: string;
  child_permissions?: object;
  is_deny?: boolean;
  expires_ts?: string | null;
}
```

### Update Child Permissions

```typescript
PATCH /api/v1/entity_rbac/permission/:permissionId/child-permissions
{
  child_entity_code: string;
  permission: number;  // -1 to remove, 0-7 to set
}
```

### Revoke Permission

```typescript
DELETE /api/v1/entity_rbac/permission/:permissionId
```

### Cache Invalidation

```typescript
queryClient.invalidateQueries({
  queryKey: ['access-control', 'role', roleId, 'hierarchical-permissions']
});
```

---

## 9. Related Files

| File | Purpose |
|------|---------|
| `apps/web/src/components/rbac/RoleAccessControlPanel.tsx` | Role detail panel |
| `apps/api/src/modules/rbac/routes.ts` | API endpoints |
| `db/entity_configuration_settings/06_entity_rbac.ddl` | Database schema |
| `docs/role/ROLE_ACCESS_CONTROL.md` | Complete RBAC reference |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v2.4.0 | 2025-12-13 | **Ownership Model UI** - Added `root_level_entity_flag` and `ownership_flag` to API response; ROOT badge for root entities; owned vs lookup child display in cascade summary; lookup children capped at COMMENT |
| v2.3.7 | 2025-12-10 | **Removed AccessControlPage** - Settings Access Control page removed; all RBAC management via Role detail page's "Access Controls" tab |
| v2.3.6 | 2025-12-10 | **Consistent icon colors** - Icons always keep their permission color (slate, sky, cyan, etc.); only opacity changes for dim/highlight states |
| v2.3.5 | 2025-12-10 | **Icon refinement** - Increased inactive icon visibility (`opacity-50`), reduced icon size by 15% (h-4 w-4 normal, h-3.5 w-3.5 compact) |
| v2.3.4 | 2025-12-10 | **Icon-only matrix** - Removed header icons and checkboxes; icons show dim (inactive) vs highlighted with glow (active); current level has colored drop-shadow |
| v2.3.3 | 2025-12-10 | Icon-based permission headers with hover tooltips, removed "Target" label |
| v2.3.2 | 2025-12-10 | Unified permissions table (existing + pending in one view), fixed grant-permission endpoint URL |
| v2.3.1 | 2025-12-10 | "All [Entity]s" merged into instance picker dropdown |
| v2.3.0 | 2025-12-09 | Two-step grant flow, inline inheritance config, removed card-based components |
| v2.2.0 | 2025-12-08 | Permission Matrix UI with entity sections |
| v2.1.0 | 2025-12-07 | 45° rotated headers, batch save |
| v2.0.0 | 2025-12-06 | Role-Only RBAC Model |
