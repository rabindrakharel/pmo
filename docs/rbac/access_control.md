# Access Control Page Design Document

> Next-generation interface for role management, person assignment, and RBAC grants/revokes

**Version**: 1.0.0
**Date**: 2025-12-08
**Status**: Design Phase

---

## 1. Executive Summary

The Access Control page is a **dedicated, standalone interface** for managing:
1. **Roles** - organizational functions and responsibilities
2. **Role-Person Assignments** - linking employees/persons to roles via `entity_instance_link`
3. **RBAC Grants/Revokes** - managing permissions in `entity_rbac` table

This page is **completely separate** from the existing entity/settings infrastructure and provides a purpose-built UI for access control administration.

---

## 2. Architecture Overview

### 2.1 Page Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ACCESS CONTROL PAGE (/settings/access-control)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────────────────────────────────────┐ │
│  │   ROLE LIST      │  │   ROLE DETAIL (Selected Role)                    │ │
│  │   ─────────────  │  │   ─────────────────────────────────────────────  │ │
│  │                  │  │                                                   │ │
│  │   [CEO]          │  │   Role: CEO - Chief Executive Officer            │ │
│  │   [COO]          │  │                                                   │ │
│  │   [CFO] ◀─────── │  │   ┌─────────────┬─────────────┐                  │ │
│  │   [CTO]          │  │   │ Permissions │   Persons   │                  │ │
│  │   [MGR-LAND]     │  │   └─────────────┴─────────────┘                  │ │
│  │   [MGR-HVAC]     │  │                                                   │ │
│  │   [SUP-FIELD]    │  │   ┌─────────────────────────────────────────────┐│ │
│  │   [TECH-FIELD]   │  │   │ [+ Add Permission]                         ││ │
│  │   ...            │  │   │                                             ││ │
│  │                  │  │   │ entity_code | permission | granted_by | ... ││ │
│  │   [+ Add Role]   │  │   │ ──────────────────────────────────────────  ││ │
│  │                  │  │   │ project     | Owner (7)  | James M.   | ... ││ │
│  │                  │  │   │ task        | Create (6) | James M.   | ... ││ │
│  │                  │  │   │ employee    | View (0)   | Sarah J.   | ... ││ │
│  │                  │  │   │                                             ││ │
│  │                  │  │   └─────────────────────────────────────────────┘│ │
│  │                  │  │                                                   │ │
│  └──────────────────┘  └──────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   app.role                    app.entity_rbac              app.entity_instance_link
│   ──────────                  ───────────────              ──────────────────────
│   id (uuid)                   id (uuid)                    id (uuid)
│   code                        person_code='role'           entity_code='role'
│   name ─────────────────────► person_id (role.id)          entity_instance_id (role.id)
│   role_code                   entity_code                  child_entity_code IN ('employee',
│   role_category               entity_instance_id             'customer', 'vendor', 'supplier')
│   ...                         permission (0-7)             child_entity_instance_id (person.id)
│                               granted_by__employee_id      relationship_type='has_member'
│                               granted_ts                   created_ts
│                               expires_ts
│                                                                              │
│   PERMISSIONS TAB:                     PERSONS TAB:                          │
│   SELECT from entity_rbac              SELECT from entity_instance_link      │
│   WHERE person_code='role'             WHERE entity_code='role'              │
│   AND person_id = <selected_role_id>   AND entity_instance_id = <role_id>    │
│                                        AND child_entity_code IN              │
│                                          ('employee','customer','vendor',    │
│                                           'supplier')                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Architecture

### 3.1 Page Components

```typescript
// apps/web/src/pages/settings/AccessControlPage.tsx

AccessControlPage
├── Layout (shared)
├── AccessControlRoleList          // Left sidebar - role listing
│   └── EntityListOfInstancesTable (reused)
└── AccessControlRoleDetail        // Right panel - selected role detail
    ├── RoleDetailHeader           // Role name, code, category
    └── AccessControlTabs
        ├── PermissionsTab         // RBAC grants for this role
        │   └── EntityListOfInstancesTable (reused, inline editing)
        └── PersonsTab             // Employees assigned to this role
            └── EntityListOfInstancesTable (reused, inline editing)
```

### 3.2 Route Configuration

```typescript
// apps/web/src/App.tsx (add to routes)

// Access Control - Dedicated page under settings
<Route path="/settings/access-control" element={<AccessControlPage />} />
<Route path="/settings/access-control/role/:roleId" element={<AccessControlPage />} />
<Route path="/settings/access-control/role/:roleId/:tab" element={<AccessControlPage />} />
```

---

## 4. API Endpoints

### 4.1 Existing Endpoints (Reuse)

```typescript
// Role CRUD - already exists in apps/api/src/modules/role/routes.ts
GET    /api/v1/role                    // List all roles
GET    /api/v1/role/:id                // Get single role
POST   /api/v1/role                    // Create role
PATCH  /api/v1/role/:id                // Update role
DELETE /api/v1/role/:id                // Soft delete role

// RBAC Management - already exists in apps/api/src/modules/rbac/routes.ts
POST   /api/v1/entity_rbac/grant-permission     // Grant/update permission
DELETE /api/v1/entity_rbac/revoke-permission/:id // Revoke permission
GET    /api/v1/entity_rbac/permissions/:personType/:personId  // Get permissions for role/employee
```

### 4.2 New Endpoints Required

```typescript
// apps/api/src/modules/access-control/routes.ts

// 1. Get RBAC records for a specific role (with metadata for rendering)
GET /api/v1/access-control/role/:roleId/permissions
// Response: { data: RBACRecord[], metadata, ref_data_entityInstance }

// 2. Get persons (employee, customer, vendor, supplier) assigned to a role
GET /api/v1/access-control/role/:roleId/persons
// Response: { data: Person[], metadata, ref_data_entityInstance }
// Returns all person types linked via entity_instance_link

// 3. Assign person to role (create entity_instance_link)
POST /api/v1/access-control/role/:roleId/persons
// Body: { person_type: 'employee' | 'customer' | 'vendor' | 'supplier', person_id: uuid }
// Creates link in entity_instance_link with child_entity_code = person_type

// 4. Remove person from role (delete entity_instance_link)
DELETE /api/v1/access-control/role/:roleId/persons/:personType/:personId
// Hard deletes link from entity_instance_link
// personType: employee | customer | vendor | supplier

// 5. Bulk permission operations
POST /api/v1/access-control/role/:roleId/permissions/bulk
// Body: { permissions: Array<{entity_code, permission, expires_ts?}> }
```

---

## 5. Data Table Specifications

### 5.1 Permissions Tab DataTable

| Column | Source Field | Display | Edit Mode | Notes |
|--------|-------------|---------|-----------|-------|
| Entity Type | `entity_code` | Badge | EntityTypeSelect dropdown | Shows entity name from entity table |
| Instance | `entity_instance_id` | "ALL" or EntityInstanceName | EntityInstanceSelect | ALL_ENTITIES_ID → "Type-level" |
| Permission | `permission` | Badge with color | PermissionSelect dropdown | 0-7 with labels |
| Granted By | `granted_by__employee_id` | Employee name | Read-only | Uses ref_data_entityInstance |
| Granted At | `granted_ts` | Relative time | Read-only | Auto-set on create/update |
| Expires At | `expires_ts` | Date/time or "Never" | DateTimePicker | Optional expiration |
| Actions | - | Edit/Delete buttons | Save/Cancel | Standard row actions |

**Permission Level Rendering**:
```typescript
const PERMISSION_LEVELS = {
  0: { label: 'View', color: 'bg-slate-100 text-slate-700' },
  1: { label: 'Comment', color: 'bg-blue-100 text-blue-700' },
  3: { label: 'Edit', color: 'bg-green-100 text-green-700' },
  4: { label: 'Share', color: 'bg-yellow-100 text-yellow-700' },
  5: { label: 'Delete', color: 'bg-orange-100 text-orange-700' },
  6: { label: 'Create', color: 'bg-purple-100 text-purple-700' },
  7: { label: 'Owner', color: 'bg-red-100 text-red-700' },
};
```

### 5.2 Persons Tab DataTable

| Column | Source Field | Display | Edit Mode | Notes |
|--------|-------------|---------|-----------|-------|
| Person Type | `child_entity_code` | Badge (Employee/Customer/Vendor/Supplier) | PersonTypeSelect | Type of person |
| Person Name | `child_entity_instance_id` | Person name | Read-only (select to add) | Via entity_instance_link + person lookup |
| Code | person.code | Text | Read-only | Person code |
| Email | person.email | Text | Read-only | Person email |
| Assigned Since | `created_ts` | Relative time | Read-only | When added to role |
| Actions | - | Remove button | - | Removes from role |

**Supported Person Types**:
- `employee` - Internal staff members
- `customer` - External customers
- `vendor` - External vendors
- `supplier` - External suppliers

### 5.3 Add Row Functionality

**Add Permission Row**:
```typescript
interface NewPermissionRow {
  entity_code: string;           // Required - dropdown of all entity types
  entity_instance_id: string;    // Default: ALL_ENTITIES_ID, or select instance
  permission: number;            // Required - 0-7 dropdown
  expires_ts?: string | null;    // Optional - datetime picker
}
```

**Add Person Row**:
```typescript
interface NewPersonAssignment {
  person_type: 'employee' | 'customer' | 'vendor' | 'supplier';  // Required - person type dropdown
  person_id: string;             // Required - person selector (filtered by type)
}
```

---

## 6. Frontend Implementation

### 6.1 Access Control Page Component

```typescript
// apps/web/src/pages/settings/AccessControlPage.tsx

import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/shared';
import { AccessControlRoleList } from './components/AccessControlRoleList';
import { AccessControlRoleDetail } from './components/AccessControlRoleDetail';

export function AccessControlPage() {
  const { roleId, tab = 'permissions' } = useParams();
  const navigate = useNavigate();

  const handleRoleSelect = useCallback((id: string) => {
    navigate(`/settings/access-control/role/${id}/permissions`);
  }, [navigate]);

  const handleTabChange = useCallback((newTab: string) => {
    if (roleId) {
      navigate(`/settings/access-control/role/${roleId}/${newTab}`);
    }
  }, [roleId, navigate]);

  return (
    <Layout title="Access Control">
      <div className="flex h-full">
        {/* Left Panel - Role List */}
        <div className="w-80 border-r border-slate-200 overflow-y-auto">
          <AccessControlRoleList
            selectedRoleId={roleId}
            onSelect={handleRoleSelect}
          />
        </div>

        {/* Right Panel - Role Detail */}
        <div className="flex-1 overflow-y-auto">
          {roleId ? (
            <AccessControlRoleDetail
              roleId={roleId}
              activeTab={tab}
              onTabChange={handleTabChange}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              Select a role to view details
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
```

### 6.2 Role List Component

```typescript
// apps/web/src/pages/settings/components/AccessControlRoleList.tsx

import React from 'react';
import { Shield, Plus } from 'lucide-react';
import { useEntityList } from '../../../db/tanstack-index';
import { Button } from '../../../components/shared/button/Button';

interface AccessControlRoleListProps {
  selectedRoleId?: string;
  onSelect: (roleId: string) => void;
}

export function AccessControlRoleList({ selectedRoleId, onSelect }: AccessControlRoleListProps) {
  const { data: roles, isLoading } = useEntityList('role', {
    limit: 100,
    sort: 'role_category,name'
  });

  // Group roles by category
  const groupedRoles = React.useMemo(() => {
    if (!roles?.data) return {};
    return roles.data.reduce((acc, role) => {
      const category = role.role_category || 'other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(role);
      return acc;
    }, {} as Record<string, any[]>);
  }, [roles?.data]);

  const categoryLabels: Record<string, string> = {
    executive: 'Executive',
    management: 'Management',
    operational: 'Operational',
    technical: 'Technical',
    administrative: 'Administrative',
    other: 'Other'
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Roles
        </h2>
        <Button variant="ghost" size="sm">
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="text-slate-500">Loading roles...</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedRoles).map(([category, categoryRoles]) => (
            <div key={category}>
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                {categoryLabels[category] || category}
              </h3>
              <div className="space-y-1">
                {categoryRoles.map((role: any) => (
                  <button
                    key={role.id}
                    onClick={() => onSelect(role.id)}
                    className={[
                      'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                      selectedRoleId === role.id
                        ? 'bg-slate-100 text-slate-900 font-medium'
                        : 'text-slate-700 hover:bg-slate-50'
                    ].join(' ')}
                  >
                    <div className="font-medium">{role.name}</div>
                    <div className="text-xs text-slate-500">{role.code}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 6.3 Role Detail Component

```typescript
// apps/web/src/pages/settings/components/AccessControlRoleDetail.tsx

import React from 'react';
import { Shield, Users } from 'lucide-react';
import { useEntity } from '../../../db/tanstack-index';
import { PermissionsTab } from './PermissionsTab';
import { PersonsTab } from './PersonsTab';

interface AccessControlRoleDetailProps {
  roleId: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function AccessControlRoleDetail({
  roleId,
  activeTab,
  onTabChange
}: AccessControlRoleDetailProps) {
  const { data: role, isLoading } = useEntity('role', roleId);

  const tabs = [
    { id: 'permissions', label: 'Permissions', icon: Shield },
    { id: 'persons', label: 'Persons', icon: Users },
  ];

  if (isLoading) {
    return <div className="p-6">Loading role details...</div>;
  }

  if (!role) {
    return <div className="p-6 text-red-600">Role not found</div>;
  }

  return (
    <div className="p-6">
      {/* Role Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{role.name}</h1>
        <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
          <span className="px-2 py-1 bg-slate-100 rounded">{role.code}</span>
          <span>{role.role_category}</span>
        </div>
        {role.descr && (
          <p className="mt-2 text-slate-600">{role.descr}</p>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-200 mb-6">
        <nav className="flex gap-4">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={[
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  isActive
                    ? 'border-slate-700 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                ].join(' ')}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'permissions' && <PermissionsTab roleId={roleId} />}
      {activeTab === 'persons' && <PersonsTab roleId={roleId} />}
    </div>
  );
}
```

### 6.4 Permissions Tab Component

```typescript
// apps/web/src/pages/settings/components/PermissionsTab.tsx

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { EntityListOfInstancesTable } from '../../../components/shared';
import { Button } from '../../../components/shared/button/Button';
import { AddPermissionModal } from './AddPermissionModal';
import { API_CONFIG } from '../../../lib/config/api';

interface PermissionsTabProps {
  roleId: string;
}

export function PermissionsTab({ roleId }: PermissionsTabProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch permissions for this role
  const { data, isLoading, error } = useQuery({
    queryKey: ['access-control', 'role', roleId, 'permissions'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_CONFIG.baseUrl}/api/v1/access-control/role/${roleId}/permissions`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('Failed to fetch permissions');
      return response.json();
    },
  });

  // Revoke permission mutation
  const revokeMutation = useMutation({
    mutationFn: async (permissionId: string) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_CONFIG.baseUrl}/api/v1/entity_rbac/revoke-permission/${permissionId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (!response.ok) throw new Error('Failed to revoke permission');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['access-control', 'role', roleId, 'permissions']);
    },
  });

  // Update permission mutation (inline edit)
  const updateMutation = useMutation({
    mutationFn: async (params: { id: string; updates: any }) => {
      const token = localStorage.getItem('auth_token');
      // Use grant-permission endpoint which upserts
      const response = await fetch(
        `${API_CONFIG.baseUrl}/api/v1/entity_rbac/grant-permission`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            person_code: 'role',
            person_id: roleId,
            ...params.updates
          })
        }
      );
      if (!response.ok) throw new Error('Failed to update permission');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['access-control', 'role', roleId, 'permissions']);
    },
  });

  // Row actions for the data table
  const rowActions = [
    {
      id: 'delete',
      label: 'Revoke',
      icon: 'Trash2',
      variant: 'danger',
      onClick: (row: any) => {
        if (confirm('Are you sure you want to revoke this permission?')) {
          revokeMutation.mutate(row.id);
        }
      }
    }
  ];

  return (
    <div>
      {/* Header with Add button */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-slate-800">RBAC Permissions</h3>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsAddModalOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Permission
        </Button>
      </div>

      {/* Permissions Table */}
      {isLoading ? (
        <div>Loading permissions...</div>
      ) : error ? (
        <div className="text-red-600">Failed to load permissions</div>
      ) : (
        <EntityListOfInstancesTable
          entityCode="rbac"
          data={data?.data || []}
          metadata={data?.metadata}
          refData={data?.ref_data_entityInstance}
          columns={[
            'entity_code',
            'entity_instance_id',
            'permission',
            'granted_by__employee_id',
            'granted_ts',
            'expires_ts'
          ]}
          rowActions={rowActions}
          enableInlineEdit={true}
          onRowUpdate={(id, updates) => updateMutation.mutate({ id, updates })}
          hideCreateButton={true}
        />
      )}

      {/* Add Permission Modal */}
      <AddPermissionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        roleId={roleId}
        onSuccess={() => {
          setIsAddModalOpen(false);
          queryClient.invalidateQueries(['access-control', 'role', roleId, 'permissions']);
        }}
      />
    </div>
  );
}
```

### 6.5 Persons Tab Component

```typescript
// apps/web/src/pages/settings/components/PersonsTab.tsx

import React, { useState } from 'react';
import { Plus, UserMinus } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { EntityListOfInstancesTable } from '../../../components/shared';
import { Button } from '../../../components/shared/button/Button';
import { AssignPersonModal } from './AssignPersonModal';
import { API_CONFIG } from '../../../lib/config/api';

// Person type badge colors
const PERSON_TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  employee: { label: 'Employee', className: 'bg-blue-100 text-blue-700' },
  customer: { label: 'Customer', className: 'bg-green-100 text-green-700' },
  vendor: { label: 'Vendor', className: 'bg-purple-100 text-purple-700' },
  supplier: { label: 'Supplier', className: 'bg-orange-100 text-orange-700' },
};

interface PersonsTabProps {
  roleId: string;
}

export function PersonsTab({ roleId }: PersonsTabProps) {
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch ALL person types assigned to this role
  const { data, isLoading, error } = useQuery({
    queryKey: ['access-control', 'role', roleId, 'persons'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_CONFIG.baseUrl}/api/v1/access-control/role/${roleId}/persons`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('Failed to fetch persons');
      return response.json();
    },
  });

  // Remove person from role mutation - requires person_type and person_id
  const removeMutation = useMutation({
    mutationFn: async ({ personType, personId }: { personType: string; personId: string }) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_CONFIG.baseUrl}/api/v1/access-control/role/${roleId}/persons/${personType}/${personId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (!response.ok) throw new Error('Failed to remove person from role');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['access-control', 'role', roleId, 'persons']);
    },
  });

  // Row actions - need both person_type and person_id for deletion
  const rowActions = [
    {
      id: 'remove',
      label: 'Remove from Role',
      icon: 'UserMinus',
      variant: 'danger',
      onClick: (row: any) => {
        if (confirm('Are you sure you want to remove this person from the role?')) {
          removeMutation.mutate({
            personType: row.person_type,  // 'employee', 'customer', 'vendor', 'supplier'
            personId: row.person_id
          });
        }
      }
    }
  ];

  return (
    <div>
      {/* Header with Add button */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-slate-800">Assigned Persons</h3>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsAssignModalOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Assign Person
        </Button>
      </div>

      {/* Persons Table - supports all person types */}
      {isLoading ? (
        <div>Loading persons...</div>
      ) : error ? (
        <div className="text-red-600">Failed to load persons</div>
      ) : (
        <EntityListOfInstancesTable
          entityCode="person"  // Generic person entity
          data={data?.data || []}
          metadata={data?.metadata}
          refData={data?.ref_data_entityInstance}
          columns={['person_type', 'name', 'code', 'email', 'assigned_ts']}
          rowActions={rowActions}
          enableInlineEdit={false}
          hideCreateButton={true}
        />
      )}

      {/* Assign Person Modal - supports selecting person type */}
      <AssignPersonModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        roleId={roleId}
        onSuccess={() => {
          setIsAssignModalOpen(false);
          queryClient.invalidateQueries(['access-control', 'role', roleId, 'persons']);
        }}
      />
    </div>
  );
}
```

---

## 7. Backend Implementation

### 7.1 Access Control Routes Module

```typescript
// apps/api/src/modules/access-control/routes.ts

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import {
  getEntityInfrastructure,
  Permission,
  ALL_ENTITIES_ID
} from '@/services/entity-infrastructure.service.js';
import { generateEntityResponse } from '@/services/entity-component-metadata.service.js';

const PERMISSION_LABELS: Record<number, string> = {
  0: 'View',
  1: 'Comment',
  3: 'Edit',
  4: 'Share',
  5: 'Delete',
  6: 'Create',
  7: 'Owner',
};

export async function accessControlRoutes(fastify: FastifyInstance) {
  const entityInfra = getEntityInfrastructure(db);

  // ============================================================================
  // GET /api/v1/access-control/role/:roleId/permissions
  // Get all RBAC permissions granted to a specific role
  // ============================================================================
  fastify.get('/api/v1/access-control/role/:roleId/permissions', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        roleId: Type.String({ format: 'uuid' })
      }),
    },
  }, async (request, reply) => {
    const { roleId } = request.params as { roleId: string };
    const userId = (request as any).user?.sub;

    // Verify role exists
    const roleCheck = await db.execute(sql`
      SELECT id, name, code FROM app.role WHERE id = ${roleId} AND active_flag = true
    `);

    if (roleCheck.length === 0) {
      return reply.status(404).send({ error: 'Role not found' });
    }

    // Get all permissions for this role
    const permissions = await db.execute(sql`
      SELECT
        r.id,
        r.person_code,
        r.person_id,
        r.entity_code,
        r.entity_instance_id,
        r.permission,
        r.granted_by__employee_id,
        r.granted_ts,
        r.expires_ts,
        r.created_ts,
        r.updated_ts,
        e.name as entity_name,
        e.ui_label as entity_ui_label
      FROM app.entity_rbac r
      LEFT JOIN app.entity e ON r.entity_code = e.code
      WHERE r.person_code = 'role'
        AND r.person_id = ${roleId}
      ORDER BY r.entity_code ASC, r.permission DESC
    `);

    // Build ref_data_entityInstance for granted_by lookup
    const grantedByIds = [...new Set(
      permissions
        .filter(p => p.granted_by__employee_id)
        .map(p => p.granted_by__employee_id as string)
    )];

    let refData: Record<string, Record<string, string>> = { employee: {} };

    if (grantedByIds.length > 0) {
      const employees = await db.execute(sql`
        SELECT id, name FROM app.employee WHERE id = ANY(${grantedByIds}::uuid[])
      `);

      employees.forEach((emp: any) => {
        refData.employee[emp.id] = emp.name;
      });
    }

    // Generate response with metadata
    const response = await generateEntityResponse('rbac', Array.from(permissions), {
      resultFields: [
        { name: 'id' },
        { name: 'entity_code' },
        { name: 'entity_instance_id' },
        { name: 'permission' },
        { name: 'granted_by__employee_id' },
        { name: 'granted_ts' },
        { name: 'expires_ts' },
      ],
    });

    return reply.send({
      ...response,
      ref_data_entityInstance: refData,
    });
  });

  // ============================================================================
  // GET /api/v1/access-control/role/:roleId/persons
  // Get ALL person types (employee, customer, vendor, supplier) assigned to a role
  // ============================================================================
  fastify.get('/api/v1/access-control/role/:roleId/persons', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        roleId: Type.String({ format: 'uuid' })
      }),
    },
  }, async (request, reply) => {
    const { roleId } = request.params as { roleId: string };

    // Verify role exists
    const roleCheck = await db.execute(sql`
      SELECT id FROM app.role WHERE id = ${roleId} AND active_flag = true
    `);

    if (roleCheck.length === 0) {
      return reply.status(404).send({ error: 'Role not found' });
    }

    // Supported person types that can be assigned to roles
    const PERSON_TYPES = ['employee', 'customer', 'vendor', 'supplier'];

    // Get ALL person types assigned to this role via entity_instance_link
    // Uses UNION to query each person type table
    const persons = await db.execute(sql`
      SELECT
        l.child_entity_code as person_type,
        l.child_entity_instance_id as person_id,
        p.name,
        p.code,
        p.email,
        l.created_ts as assigned_ts,
        l.id as link_id
      FROM app.entity_instance_link l
      JOIN app.person p ON l.child_entity_instance_id = p.id
      WHERE l.entity_code = 'role'
        AND l.entity_instance_id = ${roleId}
        AND l.child_entity_code IN ('employee', 'customer', 'vendor', 'supplier')
        AND p.active_flag = true
      ORDER BY l.child_entity_code ASC, p.name ASC
    `);

    // Generate response with metadata
    const response = await generateEntityResponse('person', Array.from(persons), {
      resultFields: [
        { name: 'person_type' },
        { name: 'person_id' },
        { name: 'name' },
        { name: 'code' },
        { name: 'email' },
        { name: 'assigned_ts' },
        { name: 'link_id' },
      ],
    });

    return reply.send(response);
  });

  // ============================================================================
  // POST /api/v1/access-control/role/:roleId/persons
  // Assign a person (any type) to a role
  // ============================================================================
  fastify.post('/api/v1/access-control/role/:roleId/persons', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        roleId: Type.String({ format: 'uuid' })
      }),
      body: Type.Object({
        person_type: Type.Union([
          Type.Literal('employee'),
          Type.Literal('customer'),
          Type.Literal('vendor'),
          Type.Literal('supplier')
        ]),
        person_id: Type.String({ format: 'uuid' })
      }),
    },
  }, async (request, reply) => {
    const { roleId } = request.params as { roleId: string };
    const { person_type, person_id } = request.body as {
      person_type: 'employee' | 'customer' | 'vendor' | 'supplier';
      person_id: string;
    };

    // Verify role exists
    const roleCheck = await db.execute(sql`
      SELECT id FROM app.role WHERE id = ${roleId} AND active_flag = true
    `);

    if (roleCheck.length === 0) {
      return reply.status(404).send({ error: 'Role not found' });
    }

    // Verify person exists in the person table (central auth table)
    const personCheck = await db.execute(sql`
      SELECT id, name, entity_code FROM app.person
      WHERE id = ${person_id}
        AND entity_code = ${person_type}
        AND active_flag = true
    `);

    if (personCheck.length === 0) {
      return reply.status(400).send({
        error: `${person_type} not found or inactive`
      });
    }

    // Check if assignment already exists
    const existingLink = await db.execute(sql`
      SELECT id FROM app.entity_instance_link
      WHERE entity_code = 'role'
        AND entity_instance_id = ${roleId}
        AND child_entity_code = ${person_type}
        AND child_entity_instance_id = ${person_id}
    `);

    if (existingLink.length > 0) {
      return reply.status(400).send({
        error: `${person_type} is already assigned to this role`
      });
    }

    // Create the link using entity infrastructure service
    const link = await entityInfra.set_entity_instance_link({
      entity_code: 'role',
      entity_instance_id: roleId,
      child_entity_code: person_type,
      child_entity_instance_id: person_id,
      relationship_type: 'has_member',
    });

    return reply.status(201).send({
      message: `${person_type} assigned to role successfully`,
      link,
    });
  });

  // ============================================================================
  // DELETE /api/v1/access-control/role/:roleId/persons/:personType/:personId
  // Remove a person (any type) from a role
  // ============================================================================
  fastify.delete('/api/v1/access-control/role/:roleId/persons/:personType/:personId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        roleId: Type.String({ format: 'uuid' }),
        personType: Type.Union([
          Type.Literal('employee'),
          Type.Literal('customer'),
          Type.Literal('vendor'),
          Type.Literal('supplier')
        ]),
        personId: Type.String({ format: 'uuid' })
      }),
    },
  }, async (request, reply) => {
    const { roleId, personType, personId } = request.params as {
      roleId: string;
      personType: 'employee' | 'customer' | 'vendor' | 'supplier';
      personId: string;
    };

    // Delete the link (hard delete)
    const result = await db.execute(sql`
      DELETE FROM app.entity_instance_link
      WHERE entity_code = 'role'
        AND entity_instance_id = ${roleId}
        AND child_entity_code = ${personType}
        AND child_entity_instance_id = ${personId}
      RETURNING id
    `);

    if (result.length === 0) {
      return reply.status(404).send({ error: 'Assignment not found' });
    }

    return reply.send({ message: 'Person removed from role successfully' });
  });

  // ============================================================================
  // POST /api/v1/access-control/role/:roleId/permissions/bulk
  // Bulk grant permissions to a role
  // ============================================================================
  fastify.post('/api/v1/access-control/role/:roleId/permissions/bulk', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        roleId: Type.String({ format: 'uuid' })
      }),
      body: Type.Object({
        permissions: Type.Array(Type.Object({
          entity_code: Type.String(),
          entity_instance_id: Type.Optional(Type.String()),
          permission: Type.Number({ minimum: 0, maximum: 7 }),
          expires_ts: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        }))
      }),
    },
  }, async (request, reply) => {
    const { roleId } = request.params as { roleId: string };
    const { permissions } = request.body as {
      permissions: Array<{
        entity_code: string;
        entity_instance_id?: string;
        permission: number;
        expires_ts?: string | null;
      }>
    };
    const userId = (request as any).user?.sub;

    // Verify role exists
    const roleCheck = await db.execute(sql`
      SELECT id FROM app.role WHERE id = ${roleId} AND active_flag = true
    `);

    if (roleCheck.length === 0) {
      return reply.status(404).send({ error: 'Role not found' });
    }

    // Grant each permission (upsert pattern)
    const results = [];
    for (const perm of permissions) {
      const entityInstanceId = perm.entity_instance_id || ALL_ENTITIES_ID;

      const result = await db.execute(sql`
        INSERT INTO app.entity_rbac (
          person_code,
          person_id,
          entity_code,
          entity_instance_id,
          permission,
          granted_by__employee_id,
          granted_ts,
          expires_ts
        ) VALUES (
          'role',
          ${roleId},
          ${perm.entity_code},
          ${entityInstanceId},
          ${perm.permission},
          ${userId},
          NOW(),
          ${perm.expires_ts || null}
        )
        ON CONFLICT (person_code, person_id, entity_code, entity_instance_id)
        DO UPDATE SET
          permission = EXCLUDED.permission,
          granted_by__employee_id = EXCLUDED.granted_by__employee_id,
          granted_ts = NOW(),
          expires_ts = EXCLUDED.expires_ts,
          updated_ts = NOW()
        RETURNING id, entity_code, permission
      `);

      results.push(result[0]);
    }

    return reply.status(201).send({
      message: `${results.length} permission(s) granted successfully`,
      permissions: results,
    });
  });
}
```

### 7.2 Register Routes

```typescript
// apps/api/src/modules/index.ts (add to existing)

import { accessControlRoutes } from './access-control/routes.js';

// In the registerRoutes function:
await server.register(accessControlRoutes);
```

---

## 8. Metadata Configuration

### 8.1 RBAC Entity Metadata (for Permission Rendering)

The RBAC table uses the existing pattern-detection system. Key fields:

| Field | Pattern Detection | viewType | editType |
|-------|------------------|----------|----------|
| `entity_code` | `*_code` → text | text | EntityTypeSelect |
| `entity_instance_id` | uuid | text (with "ALL" special display) | EntityInstanceSelect |
| `permission` | integer | PermissionBadge (custom) | PermissionSelect (custom) |
| `granted_by__employee_id` | `*__employee_id` | entityInstanceId | readonly |
| `granted_ts` | `*_ts` | timestamp | readonly |
| `expires_ts` | `*_ts` | timestamp | datetime-local |

### 8.2 Custom Permission Renderer

```typescript
// apps/web/src/components/shared/ui/PermissionBadge.tsx

import React from 'react';

interface PermissionBadgeProps {
  level: number;
}

const PERMISSION_CONFIG: Record<number, { label: string; className: string }> = {
  0: { label: 'View', className: 'bg-slate-100 text-slate-700' },
  1: { label: 'Comment', className: 'bg-blue-100 text-blue-700' },
  3: { label: 'Edit', className: 'bg-green-100 text-green-700' },
  4: { label: 'Share', className: 'bg-yellow-100 text-yellow-700' },
  5: { label: 'Delete', className: 'bg-orange-100 text-orange-700' },
  6: { label: 'Create', className: 'bg-purple-100 text-purple-700' },
  7: { label: 'Owner', className: 'bg-red-100 text-red-700' },
};

export function PermissionBadge({ level }: PermissionBadgeProps) {
  const config = PERMISSION_CONFIG[level] || { label: `Level ${level}`, className: 'bg-gray-100 text-gray-700' };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${config.className}`}>
      {config.label} ({level})
    </span>
  );
}
```

---

## 9. Implementation Checklist

### Phase 1: Backend API
- [ ] Create `apps/api/src/modules/access-control/routes.ts`
- [ ] Register routes in `apps/api/src/modules/index.ts`
- [ ] Test endpoints with test credentials

### Phase 2: Frontend Components
- [ ] Create `apps/web/src/pages/settings/AccessControlPage.tsx`
- [ ] Create `AccessControlRoleList.tsx`
- [ ] Create `AccessControlRoleDetail.tsx`
- [ ] Create `PermissionsTab.tsx`
- [ ] Create `PersonsTab.tsx`
- [ ] Create `AddPermissionModal.tsx`
- [ ] Create `AssignPersonModal.tsx`

### Phase 3: Metadata & Rendering
- [ ] Create `PermissionBadge.tsx` component
- [ ] Create `PermissionSelect.tsx` component
- [ ] Update entity-component-metadata for permission field handling

### Phase 4: Routes & Navigation
- [ ] Add routes to `App.tsx`
- [ ] Add navigation link to settings sidebar

### Phase 5: Testing
- [ ] Test role listing
- [ ] Test permission grant/revoke
- [ ] Test person assignment/removal
- [ ] Test inline editing
- [ ] Test with different user roles

---

## 10. Related Documentation

- [RBAC Infrastructure](./RBAC_INFRASTRUCTURE.md)
- [Entity Infrastructure Service](../services/entity-infrastructure.service.md)
- [Entity Component Metadata Service](../services/entity-component-metadata.service.md)
- [ref_data_entityInstance Pattern](../caching-frontend/ref_data_entityInstance.md)

---

**Version History**:
- v1.0.0 (2025-12-08): Initial design document
