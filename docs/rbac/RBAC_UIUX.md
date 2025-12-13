# RBAC UI/UX Design Reference

> Page architecture, component hierarchy, user interactions, wireframes, ownership model UI, and navigation flows

**Version**: 2.2.0 | **Updated**: 2025-12-13 | **Status**: Production

---

## Table of Contents

1. [Page Architecture](#1-page-architecture)
2. [Route Structure](#2-route-structure)
3. [Component Hierarchy](#3-component-hierarchy)
4. [User Interaction Flows](#4-user-interaction-flows)
5. [Wireframes](#5-wireframes)
6. [Ownership Model UI (v2.2.0)](#6-ownership-model-ui-v220)
7. [Component Specifications](#7-component-specifications)
8. [Visual Design System](#8-visual-design-system)

---

## 1. Page Architecture

### 1.1 Access Point

RBAC management is accessed exclusively through the Role detail page:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Role Detail Page: /role/:roleId                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  [Overview]  [People]  [Access Controls]                                ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  Overview Tab:       Role details (name, description, metadata)              │
│  People Tab:         Role members (EntityListOfInstancesTable for person)    │
│  Access Controls:    Permission Matrix (RoleAccessControlPanel)              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Layout (shared)                                                             │
│  ├── Sidebar (collapsed/expanded)                                            │
│  ├── Header (breadcrumb: Role > [Role Name] > Access Controls)               │
│  └── Main Content                                                            │
│      └── EntitySpecificInstancePage                                          │
│          ├── Entity Header (role name, edit button)                          │
│          ├── DynamicChildEntityTabs                                          │
│          │   └── [Overview] [People] [Access Controls]                       │
│          └── Tab Content                                                     │
│              └── RoleAccessControlPanel (when Access Controls selected)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Route Structure

| Route | Page | Tab | Component |
|-------|------|-----|-----------|
| `/role` | EntityListOfInstancesPage | - | Role list table |
| `/role/:id` | EntitySpecificInstancePage | Overview | EntityDetailView |
| `/role/:id/person` | EntitySpecificInstancePage | People | EntityListOfInstancesTable |
| `/role/:id/access-control` | EntitySpecificInstancePage | Access Controls | RoleAccessControlPanel |

### 2.1 Navigation Flow

```
/role (Role List)
    │
    └── Click row → /role/:id (Overview)
                        │
                        ├── Click "People" tab → /role/:id/person
                        │
                        └── Click "Access Controls" tab → /role/:id/access-control
                                                              │
                                                              └── RoleAccessControlPanel renders
```

---

## 3. Component Hierarchy

### 3.1 Full Component Tree

```
/role/:id/access-control
│
└── EntitySpecificInstancePage
    └── RoleAccessControlPanel
        └── HierarchicalRbacMatrix
            ├── Header
            │   ├── Search input
            │   ├── Save Changes button (if pending changes)
            │   └── Discard button (if pending changes)
            │
            └── Entity Sections (one per entity type with permissions)
                └── EntityPermissionSection
                    ├── Section Header
                    │   ├── Entity icon + name
                    │   ├── Permission count badge
                    │   ├── Expand/Collapse chevron
                    │   └── "Grant Permission" button
                    │
                    ├── Instance Picker (when granting)
                    │   ├── Search input
                    │   ├── "All [Entity]s" option (type-level)
                    │   ├── Instance checkboxes
                    │   ├── "Select all visible" checkbox
                    │   └── [Cancel] [Add (N)] buttons
                    │
                    └── PermissionMatrixTable
                        ├── Rows (one per permission)
                        │   ├── Target label + icon
                        │   ├── Permission level icons (8 columns)
                        │   └── Actions (Settings, Undo, Revoke)
                        │
                        └── Inline Inheritance Panel (when expanded)
                            └── InheritanceModeSelector
                                ├── None/Cascade/Mapped buttons
                                └── ChildPermissionMapper (if Mapped)
```

### 3.2 Component Files

| Component | File | Purpose |
|-----------|------|---------|
| `RoleAccessControlPanel` | `RoleAccessControlPanel.tsx` | Top-level panel for role detail |
| `HierarchicalRbacMatrix` | `HierarchicalRbacMatrix.tsx` | Container with search + entity sections |
| `EntityPermissionSection` | `EntityPermissionSection.tsx` | Per-entity collapsible section |
| `PermissionMatrixTable` | `PermissionMatrixTable.tsx` | Icon-only permission matrix |
| `InheritanceModeSelector` | `InheritanceModeSelector.tsx` | None/Cascade/Mapped selector |
| `ChildPermissionMapper` | `ChildPermissionMapper.tsx` | Per-child-type permission config |
| `PermissionLevelSelector` | `PermissionLevelSelector.tsx` | Bar chart permission picker |
| `GrantPermissionModal` | `GrantPermissionModal.tsx` | 4-step wizard (legacy, optional) |

---

## 4. User Interaction Flows

### 4.1 Viewing Permissions

```
USER ACTION                              SYSTEM RESPONSE
───────────────────────────────────────────────────────────────────────────────

1. Navigate to /role/:id/access-control  → Load RoleAccessControlPanel
                                         → Fetch hierarchical-permissions API
                                         → Display entity sections (collapsed)

2. Click entity section chevron          → Expand section
                                         → Show PermissionMatrixTable

3. Hover over permission icon            → Show tooltip with permission name
                                         → e.g., "EDIT: Modify data"

4. Type in search box                    → Filter entity sections by name
                                         → Real-time filtering
```

### 4.2 Granting New Permission (Two-Step Flow)

```
STEP 1: SELECT INSTANCES
───────────────────────────────────────────────────────────────────────────────

1. Click "Grant Permission to [Entity]"  → Open instance picker panel
                                         → Show "All [Entity]s" first (if available)
                                         → Load available instances

2. Type in search box                    → Filter instances by name

3. Check instances to grant              → Add to selection
                                         → Update "Add (N)" button count

4. Toggle "Select all visible"           → Check/uncheck all visible items

5. Click "Add (N)" button                → Close picker
                                         → Add pending rows to table
                                         → Rows show emerald background

STEP 2: CONFIGURE IN TABLE
───────────────────────────────────────────────────────────────────────────────

6. Click permission icon in pending row  → Set permission level
                                         → Icon glows at selected level

7. Click Settings icon                   → Expand inline inheritance panel
                                         → Select None/Cascade/Mapped

8. Click "Save (N)" in header            → POST grant-permission for each
                                         → Pending rows become normal
                                         → Success toast notification

OR Click "Discard"                       → Remove all pending rows
                                         → No API calls
```

### 4.3 Modifying Existing Permission

```
USER ACTION                              SYSTEM RESPONSE
───────────────────────────────────────────────────────────────────────────────

1. Click permission icon in existing row → Change permission level
                                         → Row turns amber with "modified" badge
                                         → "Save Changes" appears in header

2. Click higher inactive icon            → Set permission to that level
                                         → All icons up to that level activate

3. Click current (glowing) icon          → Reduce permission by 1
                                         → Minimum is VIEW (0)

4. Click Settings icon                   → Expand inline inheritance panel

5. Select inheritance mode               → None: Permission applies to target only
                                         → Cascade: Same level to all children
                                         → Mapped: Configure per-child-type

6. (If Mapped) Set child permissions     → Click icons in child entity rows
                                         → Each child type can have different level

7. Click Undo icon                       → Revert to original value
                                         → Remove amber highlighting

8. Click "Save Changes"                  → PUT permission/:id for changes
                                         → Clear pending state
                                         → Success notification
```

### 4.4 Revoking Permission

```
USER ACTION                              SYSTEM RESPONSE
───────────────────────────────────────────────────────────────────────────────

1. Click Trash icon on row               → Show confirmation dialog
                                         → "Revoke [ENTITY] permission?"

2. Confirm revocation                    → DELETE permission/:id
                                         → Remove row from table
                                         → Success notification

OR Cancel                                → Close dialog
                                         → No changes
```

---

## 5. Wireframes

### 5.1 Full Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ◀ Role > Admin Role > Access Controls                           [Edit Role] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────┐ ┌─────────┐ ┌──────────────────┐                               │
│  │Overview │ │ People  │ │ Access Controls ●│                               │
│  └─────────┘ └─────────┘ └──────────────────┘                               │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ [🔍 Search entities...]                    [Discard] [Save Changes (3)] ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ ▼ 📁 Project (3 permissions)                    [+ Grant Permission]    ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                          Vi Co Cn Ed Sh De Cr Ow    Actions             ││
│  │  🌐 All Projects         ◉  ◉  ◉  ◉  ◉  ◉  ●  ○     ⚙️  🗑️              ││
│  │  📄 Kitchen Renovation   ◉  ◉  ◉  ●  ○  ○  ○  ○     ⚙️  🗑️              ││
│  │  📄 Bathroom [modified]  ◉  ◉  ●  ○  ○  ○  ○  ○     ↩️ ⚙️  🗑️           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ ▶ 📋 Task (1 permission)                        [+ Grant Permission]    ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ ▶ 👤 Employee (2 permissions)                   [+ Grant Permission]    ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Permission Matrix Table

```
┌────────────────────────────────────────────────────────────────────────────┐
│                      (no header icons - clean)              Actions        │
├────────────────────────────────────────────────────────────────────────────┤
│ 🌐 All Projects      👁  💬  ➕  ✏️  🔗  🗑️  ✨  👑     ⚙️  🗑️             │
│                      ●   ●   ●   ●   ●   ●   ●   ○                         │
│                     glow ── active (opacity-80) ─── dim (opacity-30)       │
├────────────────────────────────────────────────────────────────────────────┤
│ 📄 Kitchen Reno      👁  💬  ➕  ✏️  🔗  🗑️  ✨  👑     ⚙️  🗑️             │
│                      ●   ●   ●   ●   ○   ○   ○   ○                         │
│                     ── active ───────┘ └── dim ──────                      │
├────────────────────────────────────────────────────────────────────────────┤
│ 📄 Bathroom [pending]👁  💬  ➕  ✏️  🔗  🗑️  ✨  👑     ⚙️  🗑️             │
│  emerald bg          ●   ●   ○   ○   ○   ○   ○   ○     pending badge      │
├────────────────────────────────────────────────────────────────────────────┤
│ 📄 Office [modified] 👁  💬  ➕  ✏️  🔗  🗑️  ✨  👑     ↩️ ⚙️  🗑️          │
│  amber bg            ●   ●   ●   ○   ○   ○   ○   ○     modified badge     │
│                     amber glow on current level                            │
└────────────────────────────────────────────────────────────────────────────┘

Icon Legend:
  👁 Eye          = VIEW (Slate)
  💬 MessageSquare = COMMENT (Sky)
  ➕ PlusCircle    = CONTRIBUTE (Cyan)
  ✏️ Pencil       = EDIT (Blue)
  🔗 Share2       = SHARE (Violet)
  🗑️ Trash2       = DELETE (Orange)
  ✨ Plus         = CREATE (Emerald)
  👑 Crown        = OWNER (Red)

State Legend:
  ● glow          = Current permission level (colored + drop-shadow)
  ● bright        = Active level below current (colored, opacity-80)
  ○ dim           = Inactive level (colored, opacity-30)
```

### 5.3 Instance Picker Panel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Select instances to grant permissions:                  [Cancel]  [Add(2)] │
├─────────────────────────────────────────────────────────────────────────────┤
│ [🔍 Search projects...]                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ☐  🌐 All Projects                                   (grants type-level)  │
│  ───────────────────────────────────────────────────────────────────────── │
│  ☑  📄 Basement Renovation                                                  │
│  ☑  📄 Deck Construction                                                    │
│  ☐  📄 Garage Addition                                                      │
│  ☐  📄 Kitchen Remodel                                                      │
│  ☐  📄 Master Bath                                                          │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  ☐ Select all visible (5)                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.4 Inheritance Configuration Panel (Inline)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📄 Kitchen Renovation   ●  ●  ●  ●  ○  ○  ○  ○     ⚙️ 🗑️                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ │ Inheritance to Child Entities:                                         ✕ │
│ │                                                                           │
│ │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                 │
│ │  │  ○   None     │  │  ↓  Cascade   │  │  ⑂  Mapped  ● │                 │
│ │  │               │  │               │  │               │                 │
│ │  │ No inheritance│  │ Same level    │  │ Per-type      │                 │
│ │  └───────────────┘  └───────────────┘  └───────────────┘                 │
│ │                                                                           │
│ │  ⑂ Child Entity Permissions:                                             │
│ │  ┌─────────────────────────────────────────────────────────────────────┐ │
│ │  │ Child Type      Vi Co Cn Ed Sh De Cr Ow                             │ │
│ │  │ 📋 Task         ●  ●  ●  ●  ○  ○  ○  ○                              │ │
│ │  │ 📄 Document     ●  ●  ○  ○  ○  ○  ○  ○                              │ │
│ │  │ 💬 Comment      ●  ○  ○  ○  ○  ○  ○  ○                              │ │
│ │  └─────────────────────────────────────────────────────────────────────┘ │
│ └───────────────────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.5 Permission Level Selector (Bar Chart Style)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Permission Level                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────┬────┬────┬────┬────┬────┬────┬────┐                                  │
│  │ 👁 │ 💬 │ ➕ │ ✏️ │ 🔗 │ 🗑️ │ ✨ │ 👑 │                                  │
│  │████│████│████│████│░░░░│░░░░│░░░░│░░░░│                                  │
│  │████│████│████│████│░░░░│░░░░│░░░░│░░░░│                                  │
│  │████│████│████│████│░░░░│░░░░│░░░░│░░░░│                                  │
│  │████│████│████│████│░░░░│░░░░│░░░░│░░░░│                                  │
│  └────┴────┴────┴────┴────┴────┴────┴────┘                                  │
│   VIEW COMMENT CONTRIBUTE EDIT SHARE DELETE CREATE OWNER                    │
│                          ▲                                                   │
│                     Current: EDIT (3)                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Ownership Model UI (v2.2.0)

### 6.1 Overview

The ownership model introduces visual indicators for permission inheritance control:

| UI Element | Purpose | Component |
|------------|---------|-----------|
| ROOT badge | Marks traversal boundary entities | EntityPermissionSection header |
| Owned child indicator | Full cascade permission | Cascade summary |
| Lookup child indicator | Capped at COMMENT (1) | Cascade summary + child rows |

### 6.2 ROOT Badge

Root-level entities (business, project, customer) display a ROOT badge in the section header:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ▼ 📁 PROJECT ACCESS                              [+ Grant Permission]       │
│    ┌────────┐                                                               │
│    │⚓ ROOT │  ← Emerald badge with anchor icon                             │
│    └────────┘                                                               │
│   3 permissions                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Styling:**
```typescript
// ROOT badge - appears when rootLevelEntityFlag=true
<span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 rounded-full flex items-center gap-1">
  <LucideIcons.Anchor className="h-3 w-3" />
  ROOT
</span>
```

**Tooltip:** "Root entity - traversal boundary for permission inheritance"

### 6.3 Cascade Summary (Owned vs Lookup)

When inheritance mode is `cascade`, the UI shows which child types are owned vs lookup:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Child types inherit based on ownership:                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ Owned:   ┌────────────────┐  ┌────────────────┐                             │
│          │ 📋 Task → EDIT │  │ 📄 Artifact → EDIT │                         │
│          └────────────────┘  └────────────────┘                             │
│          (violet badges - full cascade)                                      │
│                                                                              │
│ Lookup:  ┌─────────────────────────┐                                        │
│          │ 👤 Person → Comment 🔗 │                                         │
│          └─────────────────────────┘                                        │
│          (amber badges - capped, link icon)                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Badge Colors:**
- **Owned children:** `bg-violet-100 text-violet-600` - full cascade
- **Lookup children:** `bg-amber-100 text-amber-600` - capped at COMMENT, with Link2 icon

### 6.4 Mapped Mode Child Rows

In mapped mode, lookup children display "(lookup)" suffix and are capped:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ⑂ Child Entity Permissions:                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ Child Type            Vi Co Cn Ed Sh De Cr Ow                               │
│──────────────────────────────────────────────────────────────────────────── │
│ 📋 Task               ●  ●  ●  ●  ○  ○  ○  ○      ← Can select up to parent │
│ 📄 Artifact           ●  ●  ●  ●  ○  ○  ○  ○                                │
│ 👤 Person (lookup)    ●  ●  ╳  ╳  ╳  ╳  ╳  ╳      ← Max COMMENT, others disabled │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Lookup Child Behavior:**
- Label shows "(lookup)" suffix
- Permission icons beyond COMMENT (1) are disabled/crossed out
- `_maxLevel` property enforces cap in logic

### 6.5 API Response Integration

The UI consumes ownership data from the hierarchical-permissions API:

```typescript
// EntityPermissionSection props
interface EntityPermissionSectionProps {
  entityCode: string;
  entityLabel: string;
  entityIcon?: string;
  rootLevelEntityFlag?: boolean;      // ← Shows ROOT badge
  childEntityCodes: ChildEntityConfig[];  // ← Includes ownership_flag
  permissions: PermissionData[];
  roleId: string;
  // ... other props
}

interface ChildEntityConfig {
  entity: string;
  ui_label: string;
  ui_icon?: string;
  order?: number;
  ownership_flag: boolean;  // true=owned (cascade), false=lookup (COMMENT max)
}
```

### 6.6 User Interaction: Ownership Awareness

| User Action | Owned Child | Lookup Child |
|-------------|-------------|--------------|
| Select CASCADE mode | Full permission cascade | Capped at COMMENT |
| Configure MAPPED mode | Can set any level up to parent | Can only set VIEW or COMMENT |
| View cascade summary | Violet badge, arrow to permission | Amber badge, arrow to Comment, link icon |

---

## 7. Component Specifications

### 7.1 PermissionMatrixTable Props

```typescript
interface PermissionMatrixTableProps {
  rows: MatrixRow[];                              // Permission data
  pendingChanges: Record<string, number>;         // rowId -> pending level
  onPermissionChange: (rowId: string, level: number) => void;
  onRevoke?: (rowId: string) => void;
  onConfigureInheritance?: (rowId: string) => void;
  onUndo?: (rowId: string) => void;
  expandedConfigId?: string | null;               // Currently expanded row
  disabled?: boolean;
  compact?: boolean;                              // Smaller icons
}

interface MatrixRow {
  id: string;
  label: string;
  icon?: string;                                  // Lucide icon name
  permission: number;                             // 0-7
  isDeny?: boolean;
  isTypeLevel?: boolean;                          // "All [Entity]s"
  hasInheritanceConfig?: boolean;                 // Show settings icon
}
```

### 7.2 EntityPermissionSection Props

```typescript
interface EntityPermissionSectionProps {
  entityCode: string;
  entityLabel: string;
  entityIcon?: string;
  rootLevelEntityFlag?: boolean;        // v2.2.0: Shows ROOT badge
  childEntityCodes: ChildEntityConfig[];  // v2.2.0: Includes ownership_flag
  permissions: HierarchicalPermission[];
  roleId: string;
  onPermissionsGranted?: () => void;
  disabled?: boolean;
}

interface ChildEntityConfig {  // v2.2.0
  entity: string;
  ui_label: string;
  ui_icon?: string;
  order?: number;
  ownership_flag: boolean;  // true=owned (cascade), false=lookup (COMMENT max)
}
```

### 7.3 HierarchicalRbacMatrix Props

```typescript
interface HierarchicalRbacMatrixProps {
  roleId: string;
  roleName: string;
  disabled?: boolean;
}
```

---

## 8. Visual Design System

### 8.1 Permission Icon Colors

| Level | Permission | Icon | Color Class | Hex |
|-------|------------|------|-------------|-----|
| 0 | VIEW | Eye | `text-slate-600` | #475569 |
| 1 | COMMENT | MessageSquare | `text-sky-600` | #0284c7 |
| 2 | CONTRIBUTE | PlusCircle | `text-cyan-600` | #0891b2 |
| 3 | EDIT | Pencil | `text-blue-600` | #2563eb |
| 4 | SHARE | Share2 | `text-violet-600` | #7c3aed |
| 5 | DELETE | Trash2 | `text-orange-600` | #ea580c |
| 6 | CREATE | Plus | `text-emerald-600` | #059669 |
| 7 | OWNER | Crown | `text-red-600` | #dc2626 |

### 8.2 Icon States

| State | Styling | Description |
|-------|---------|-------------|
| Inactive | `{color} opacity-30` | Dim, keeps original color |
| Active (below current) | `{color} opacity-80` | Bright, slightly dim |
| Current Level | `{color} drop-shadow-[0_0_6px_currentColor]` | Glowing |
| Modified | `{color} drop-shadow-[0_0_6px_rgba(245,158,11,0.7)]` | Amber glow |
| Deny | `text-red-400` + Ban icon | All columns show Ban |

### 8.3 Row States

| State | Background | Badge | When |
|-------|------------|-------|------|
| Normal | White | None | Existing permission |
| Pending | `bg-emerald-50/50` | "pending" (emerald) | New, unsaved |
| Modified | `bg-amber-50` | "modified" (amber) | Changed, unsaved |
| Expanded | `bg-slate-100` + ring | None | Inheritance panel open |
| Deny | `bg-red-50` | "DENY" (red) | Explicit deny |

### 8.4 Icon Sizes

| Mode | Size | Tailwind Class |
|------|------|----------------|
| Normal | 16px | `h-4 w-4` |
| Compact | 14px | `h-3.5 w-3.5` |

### 8.5 Spacing

| Element | Padding/Margin |
|---------|----------------|
| Section header | `py-3 px-4` |
| Table row (normal) | `py-3 px-4` |
| Table row (compact) | `py-2 px-3` |
| Permission cell | `p-1.5` (normal), `p-1` (compact) |
| Actions cell | `px-3` |

---

## Related Documentation

| Document | Path | Purpose |
|----------|------|---------|
| Component Details | `docs/ui_components/RolePermissionsMatrix.md` | Component API reference |
| Backend RBAC | `docs/rbac/RBAC_INFRASTRUCTURE.md` | Permission system internals |
| State Management | `docs/state_management/STATE_MANAGEMENT.md` | TanStack Query patterns |

---

**Version**: 2.2.0 | **Updated**: 2025-12-13

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-10 | Initial UI/UX design reference |
| 2.2.0 | 2025-12-13 | **Ownership Model UI**: Added ROOT badge, owned/lookup child indicators, cascade summary with ownership awareness |
