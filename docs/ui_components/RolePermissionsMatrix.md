# RolePermissionsMatrix Component

> Interactive permission matrix table with 45° rotated headers, inline editing, and batch save functionality

**Version**: 1.0.0 | **Added**: 2025-12-09 | **Status**: Production

---

## Overview

`RolePermissionsMatrix` displays a role's RBAC permissions as an interactive matrix table. Users can click checkmarks to modify permission levels, with changes tracked locally until saved in batch.

**Location**: `apps/web/src/components/rbac/RolePermissionsMatrix.tsx`

## Features

| Feature | Description |
|---------|-------------|
| **45° Rotated Headers** | Permission columns (VIEW, COMMENT, CONTRIBUTE, EDIT, SHARE, DELETE, CREATE, OWNER) displayed at 45-degree angle |
| **Inline Editing** | Click any checkmark to change permission level |
| **Batch Save** | Changes tracked locally, saved together via "Save Changes" button |
| **Unsaved Indicators** | Amber highlighting for modified rows, "(modified)" badge |
| **Per-Row Undo** | Undo button appears for modified rows |
| **Search Filter** | Filter permissions by entity name |
| **Visual Indicators** | Green (inherited), Blue (current), Amber (modified), Red (denied) |

## Visual Layout

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

## Props

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

## Usage

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
    if (confirm('Are you sure you want to revoke this permission?')) {
      revokePermissionMutation.mutate(permissionId);
    }
  }}
/>
```

## Interaction Flow

### Editing Permissions

1. **Click a checkmark cell**:
   - If clicking an unchecked cell → Set permission to that level
   - If clicking the current level → Reduce by 1 (minimum 0)
   - If clicking a lower checked cell → Set permission to that level

2. **Visual feedback**:
   - Row background turns amber
   - Current level cell shows amber ring
   - "(modified)" text appears next to target
   - "X unsaved changes" badge appears in header

3. **Saving**:
   - Click "Save Changes" button
   - All pending changes sent to API in parallel
   - On success: cache invalidated, changes cleared
   - On error: retry option shown

4. **Discarding**:
   - Click "Discard" button → clears all pending changes
   - Click per-row Undo icon → reverts single row

## API Integration

### Batch Update

```typescript
// For each pending change, calls:
PUT /api/v1/entity_rbac/permission/:permissionId
{
  permission: number  // New permission level (0-7)
}

// Response:
{ id: string, message: "Permission updated successfully" }
```

### Cache Invalidation

After successful save:
```typescript
queryClient.invalidateQueries({
  queryKey: ['access-control', 'role', roleId, 'permissions']
});
```

## Column Styling

Permission level columns use color-coded text:

| Levels | Color | Meaning |
|--------|-------|---------|
| 0-2 (VIEW, COMMENT, CONTRIBUTE) | Slate | Read/Comment access |
| 3-4 (EDIT, SHARE) | Blue | Modification access |
| 5 (DELETE) | Orange | Destructive access |
| 6 (CREATE) | Emerald | Creation access |
| 7 (OWNER) | Red | Full control |

## Related Components

| Component | Purpose |
|-----------|---------|
| `PermissionLevelSelector` | Visual bar chart for selecting permission level |
| `PermissionRuleCard` | Card-based view of single permission |
| `InheritanceModeBadge` | Badge showing cascade/mapped inheritance |
| `GrantPermissionModal` | 4-step wizard for granting new permissions |

## Files

| File | Purpose |
|------|---------|
| `apps/web/src/components/rbac/RolePermissionsMatrix.tsx` | Component implementation |
| `apps/web/src/components/rbac/RoleAccessControlPanel.tsx` | Parent panel component |
| `apps/web/src/pages/setting/AccessControlPage.tsx` | Settings page usage |
| `apps/api/src/modules/rbac/routes.ts` | API endpoints |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0.0 | 2025-12-09 | Initial release with 45° headers, inline edit, batch save |
