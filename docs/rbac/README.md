# RBAC Access Control - End-to-End Design Pattern

> Complete implementation guide for the Access Control page with role management, permission grants, and multi-person-type assignments

**Version**: 1.0.0
**Last Updated**: 2025-12-08
**Status**: Implemented

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Data Model](#3-data-model)
4. [API Endpoints](#4-api-endpoints)
5. [Frontend Components](#5-frontend-components)
6. [Styling Patterns](#6-styling-patterns)
7. [Permission Levels](#7-permission-levels)
8. [Person Types](#8-person-types)
9. [File Locations](#9-file-locations)
10. [Usage Guide](#10-usage-guide)

---

## 1. Overview

The Access Control page is a **dedicated, standalone interface** for managing Role-Based Access Control (RBAC):

- **Role Selection**: Browse and search roles in a left sidebar
- **Permission Management**: Grant/revoke entity-level permissions via `entity_rbac` table
- **Person Assignment**: Assign employees, customers, vendors, suppliers to roles via `entity_instance_link` table

### Key Features

- Two-panel layout (role list + role detail)
- Tabbed interface for Permissions and Persons
- Modal dialogs for adding permissions and assigning persons
- Support for ALL person types (not just employees)
- Type-level permissions (ALL_ENTITIES_ID) and instance-level permissions

---

## 2. Architecture

### 2.1 System Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ACCESS CONTROL FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐     ┌──────────────────┐     ┌────────────────────────┐  │
│   │   Frontend   │────>│   API Endpoints  │────>│      Database          │  │
│   │              │<────│                  │<────│                        │  │
│   └──────────────┘     └──────────────────┘     └────────────────────────┘  │
│                                                                              │
│   AccessControlPage    /api/v1/access-control   app.role                    │
│   ├── RoleList         /api/v1/role             app.entity_rbac             │
│   ├── RoleDetail                                 app.entity_instance_link   │
│   │   ├── PermissionsTab                         app.entity                 │
│   │   └── PersonsTab                             app.employee               │
│   └── Modals                                     app.cust                   │
│       ├── AddPermissionModal                                                │
│       └── AssignPersonModal                                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Hierarchy

```
AccessControlPage.tsx
├── Layout (shared component)
├── Left Panel - Role List
│   ├── Search Input
│   └── Role Items (clickable)
└── Right Panel - Role Detail
    ├── Role Header (name, code, link to role page)
    ├── Tab Navigation (Permissions | Persons)
    ├── Permissions Tab
    │   ├── Grant Permission Button
    │   └── Permissions Table
    └── Persons Tab
        ├── Assign Person Button
        └── Persons Table
```

---

## 3. Data Model

### 3.1 Tables Involved

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `app.role` | Role definitions | `id`, `name`, `code`, `active_flag` |
| `app.entity_rbac` | Permission grants | `person_code`, `person_id`, `entity_code`, `entity_instance_id`, `permission` |
| `app.entity_instance_link` | Role-Person assignments | `entity_code='role'`, `entity_instance_id`, `child_entity_code`, `child_entity_instance_id` |
| `app.entity` | Entity type metadata | `code`, `name`, `ui_label`, `ui_icon` |
| `app.employee` | Employee records | `id`, `name`, `code`, `email` |
| `app.cust` | Customer records | `id`, `name`, `code`, `email` |

### 3.2 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA RELATIONSHIPS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   app.role                    app.entity_rbac              app.entity_instance_link
│   ──────────                  ───────────────              ──────────────────────
│   id (uuid)                   person_code='role'           entity_code='role'
│   name                        person_id → role.id          entity_instance_id → role.id
│   code ──────────────────────────────────────────────────────────────────────►
│                               entity_code                  child_entity_code IN ('employee',
│                               entity_instance_id             'cust', 'vendor', 'supplier')
│                               permission (0-7)             child_entity_instance_id
│                                                                              │
│   PERMISSIONS TAB queries:              PERSONS TAB queries:                 │
│   SELECT FROM entity_rbac               SELECT FROM entity_instance_link     │
│   WHERE person_code='role'              WHERE entity_code='role'             │
│   AND person_id=<roleId>                AND entity_instance_id=<roleId>      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. API Endpoints

### 4.1 Access Control Module Routes

**Base Path**: `/api/v1/access-control`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/role/:roleId/permissions` | Get all RBAC permissions for a role |
| POST | `/role/:roleId/permissions` | Grant permission to a role |
| POST | `/role/:roleId/permissions/bulk` | Bulk grant permissions |
| GET | `/role/:roleId/persons` | Get all persons assigned to a role |
| POST | `/role/:roleId/persons` | Assign a person to a role |
| DELETE | `/role/:roleId/persons/:personType/:personId` | Remove person from role |
| GET | `/entities` | Get all entity types for dropdown |
| GET | `/employees` | Get all employees for dropdown |
| GET | `/customers` | Get all customers for dropdown |

### 4.2 Request/Response Examples

**Grant Permission**
```typescript
// POST /api/v1/access-control/role/{roleId}/permissions
{
  "entity_code": "project",
  "entity_instance_id": "11111111-1111-1111-1111-111111111111", // ALL_ENTITIES_ID
  "permission": 7, // Owner
  "expires_ts": null
}
```

**Assign Person**
```typescript
// POST /api/v1/access-control/role/{roleId}/persons
{
  "person_type": "employee", // or 'cust', 'vendor', 'supplier'
  "person_id": "uuid-here"
}
```

**Remove Person**
```typescript
// DELETE /api/v1/access-control/role/{roleId}/persons/{personType}/{personId}
// Example: DELETE /api/v1/access-control/role/abc123/persons/employee/def456
```

---

## 5. Frontend Components

### 5.1 State Management

Uses **TanStack Query** for server state:

```typescript
// Query Keys Pattern
['access-control', 'roles']                           // All roles
['access-control', 'role', roleId, 'permissions']    // Role permissions
['access-control', 'role', roleId, 'persons']        // Role persons
['access-control', 'entities']                        // Entity dropdown options
['access-control', 'employees']                       // Employee dropdown options
['access-control', 'customers']                       // Customer dropdown options
```

### 5.2 Mutations

```typescript
// Grant Permission
grantPermissionMutation = useMutation({
  mutationFn: async (data) => POST /api/v1/access-control/role/{roleId}/permissions,
  onSuccess: () => invalidateQueries(['access-control', 'role', roleId, 'permissions'])
});

// Revoke Permission
revokePermissionMutation = useMutation({
  mutationFn: async (permissionId) => DELETE /api/v1/entity_rbac/revoke-permission/{id},
  onSuccess: () => invalidateQueries(['access-control', 'role', roleId, 'permissions'])
});

// Assign Person
assignPersonMutation = useMutation({
  mutationFn: async (data) => POST /api/v1/access-control/role/{roleId}/persons,
  onSuccess: () => invalidateQueries(['access-control', 'role', roleId, 'persons'])
});

// Remove Person
removePersonMutation = useMutation({
  mutationFn: async ({personType, personId}) => DELETE .../persons/{personType}/{personId},
  onSuccess: () => invalidateQueries(['access-control', 'role', roleId, 'persons'])
});
```

---

## 6. Styling Patterns

Following `docs/design_pattern/styling_patterns.md`:

### 6.1 Color Palette

```css
/* Primary - Slate (neutral professional) */
bg-slate-600, bg-slate-100, text-slate-700, border-slate-600

/* Secondary - Emerald (success actions) */
bg-emerald-600, bg-emerald-100, text-emerald-700

/* Danger - Red */
text-red-500, hover:text-red-700, hover:bg-red-50

/* Neutral - Dark (grays) */
bg-dark-50, bg-dark-100, text-dark-600, text-dark-800, border-dark-200
```

### 6.2 Component Patterns

**Buttons**
```typescript
// Primary Action
className="px-3 py-1.5 text-sm font-medium bg-slate-600 text-white rounded-md hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none transition-colors shadow-sm"

// Success Action
className="px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:outline-none transition-colors shadow-sm"

// Danger Icon Button
className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
```

**Cards/Panels**
```typescript
className="bg-white border border-dark-200 rounded-lg shadow-sm"
```

**Tables**
```typescript
// Header
className="bg-dark-50"
<th className="px-4 py-2.5 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">

// Body
className="divide-y divide-dark-100"
<tr className="hover:bg-dark-50">
```

**Modals**
```typescript
// Overlay
className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"

// Modal Container
className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 border border-dark-200"

// Footer
className="flex items-center justify-end gap-3 px-6 py-4 border-t border-dark-200 bg-dark-50"
```

### 6.3 Badge Patterns

```typescript
// Permission Badges
const PERMISSION_CONFIG = {
  0: { label: 'View', className: 'bg-slate-100 text-slate-700' },
  1: { label: 'Comment', className: 'bg-sky-100 text-sky-700' },
  3: { label: 'Edit', className: 'bg-blue-100 text-blue-700' },
  4: { label: 'Share', className: 'bg-violet-100 text-violet-700' },
  5: { label: 'Delete', className: 'bg-orange-100 text-orange-700' },
  6: { label: 'Create', className: 'bg-emerald-100 text-emerald-700' },
  7: { label: 'Owner', className: 'bg-red-100 text-red-700' },
};

// Person Type Badges
const PERSON_TYPE_CONFIG = {
  employee: { label: 'Employee', className: 'bg-blue-100 text-blue-700' },
  cust: { label: 'Customer', className: 'bg-green-100 text-green-700' },
  vendor: { label: 'Vendor', className: 'bg-purple-100 text-purple-700' },
  supplier: { label: 'Supplier', className: 'bg-orange-100 text-orange-700' },
};
```

---

## 7. Permission Levels

| Level | Name | Description | Badge Color |
|-------|------|-------------|-------------|
| 0 | View | Read-only access | Slate |
| 1 | Comment | Add comments | Sky |
| 3 | Edit | Modify records | Blue |
| 4 | Share | Share with others | Violet |
| 5 | Delete | Soft delete records | Orange |
| 6 | Create | Create new records | Emerald |
| 7 | Owner | Full control | Red |

### Special Constants

```typescript
// Type-level permission (applies to ALL instances of an entity type)
const ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111';
```

---

## 8. Person Types

The system supports assigning **four person types** to roles:

| Type | Table | Description |
|------|-------|-------------|
| `employee` | `app.employee` | Internal staff members |
| `cust` | `app.cust` | External customers |
| `vendor` | `app.person` | External vendors |
| `supplier` | `app.person` | External suppliers |

### Assignment Flow

1. Select person type from dropdown
2. System fetches available persons of that type
3. Select specific person
4. Creates `entity_instance_link` record with:
   - `entity_code = 'role'`
   - `entity_instance_id = <role_id>`
   - `child_entity_code = <person_type>`
   - `child_entity_instance_id = <person_id>`
   - `relationship_type = 'has_member'`

---

## 9. File Locations

### Backend

| File | Purpose |
|------|---------|
| `apps/api/src/modules/access-control/routes.ts` | API endpoints |
| `apps/api/src/modules/index.ts` | Route registration |

### Frontend

| File | Purpose |
|------|---------|
| `apps/web/src/pages/setting/AccessControlPage.tsx` | Main page component |
| `apps/web/src/pages/setting/index.ts` | Page exports |
| `apps/web/src/App.tsx` | Route `/settings/access-control` |
| `apps/web/src/pages/setting/SettingsOverviewPage.tsx` | Navigation link |

### Documentation

| File | Purpose |
|------|---------|
| `docs/rbac/README.md` | This file - End-to-end design pattern |
| `docs/rbac/access_control.md` | Original design document |
| `docs/rbac/RBAC_INFRASTRUCTURE.md` | RBAC tables and infrastructure |

---

## 10. Usage Guide

### 10.1 Accessing the Page

1. Navigate to `/settings` from the sidebar
2. Click "Access Control" tab
3. Click "Open Full Access Control Page" button
4. Or navigate directly to `/settings/access-control`

### 10.2 Managing Role Permissions

1. Select a role from the left panel
2. Click "Permissions" tab
3. Click "Grant Permission" button
4. Select entity type, permission level, and optional scope
5. Click "Grant Permission"

To revoke: Click the trash icon on any permission row.

### 10.3 Managing Role Persons

1. Select a role from the left panel
2. Click "Persons" tab
3. Click "Assign Person" button
4. Select person type (Employee, Customer, Vendor, Supplier)
5. Select the specific person from dropdown
6. Click "Assign Person"

To remove: Click the user-minus icon on any person row.

---

## Related Documentation

- [RBAC Infrastructure](./RBAC_INFRASTRUCTURE.md) - Tables and permission system
- [Access Control Design](./access_control.md) - Original design document
- [Entity Infrastructure Service](../services/entity-infrastructure.service.md) - Core service
- [Styling Patterns](../design_pattern/styling_patterns.md) - UI conventions

---

**Version History**:
- v1.0.0 (2025-12-08): Initial implementation with full RBAC support for all person types
