# Unified Linkage System - Complete Documentation

> **Reusable Entity Relationship Management** - Single modal component with LinkagePage-style UI handling all parent-child linkage scenarios across the PMO platform

**Last Updated:** 2025-10-24
**Version:** 2.0.0 (Updated with button-based entity selection UI)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Component API](#component-api)
4. [Usage Examples](#usage-examples)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Migration Guide](#migration-guide)
8. [Best Practices](#best-practices)

---

## Overview

### What is the Linkage System?

The **Unified Linkage System** provides a centralized way to manage parent-child relationships between entity instances in the PMO platform. It consists of:

- **UnifiedLinkageModal** - Single reusable modal component
- **useLinkageModal** - Custom React hook for state management
- **Unified Backend API** - `/api/v1/linkage` endpoints
- **Database Tables** - `d_entity_map` (types) and `d_entity_id_map` (instances)

### Why Unified?

**Before:**
- Multiple linkage components with duplicated logic
- Inconsistent UI/UX across different entity types
- Hard to maintain and extend

**After:**
- Single source of truth for all linkage operations
- Consistent experience across the platform
- Easy to add new entity relationships
- Centralized validation and RBAC

---

## Architecture

### System Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    UNIFIED LINKAGE SYSTEM                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🎨 PRESENTATION LAYER                                      │
│  ├─ UnifiedLinkageModal (React Component)                  │
│  │  ├─ Mode: "assign-parent"                               │
│  │  ├─ Mode: "manage-children"                             │
│  │  ├─ UI: Entity type buttons with icons                  │
│  │  ├─ UI: Data table (Name, Code, Desc, Status, Action)   │
│  │  └─ UI: Plus (+) / X icons for link/unlink              │
│  ├─ LinkagePage (Full-page split-panel management)         │
│  │  ├─ Left: Parent entity selection                       │
│  │  └─ Right: Child entity selection                       │
│  ├─ useLinkageModal (Custom Hook)                          │
│  │  ├─ openAssignParent()                                  │
│  │  ├─ openManageChildren()                                │
│  │  └─ close()                                             │
│  └─ Integration Points                                      │
│     ├─ EntityDetailPage                                     │
│     ├─ FormEditPage                                         │
│     ├─ WikiEditorPage                                       │
│     └─ Custom entity pages                                 │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔌 API LAYER (Fastify)                                    │
│  ├─ GET /api/v1/linkage (list linkages)                    │
│  ├─ POST /api/v1/linkage (create linkage)                  │
│  ├─ DELETE /api/v1/linkage/:id (remove linkage)            │
│  ├─ GET /api/v1/linkage/children/:type (valid children)    │
│  └─ GET /api/v1/linkage/parents/:type (valid parents)      │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  💾 DATABASE LAYER (PostgreSQL)                            │
│  ├─ d_entity_map                                           │
│  │  └─ Defines valid TYPE-to-TYPE relationships            │
│  │     (e.g., "project" can contain "task")                │
│  └─ d_entity_id_map                                        │
│     └─ Stores actual INSTANCE-to-INSTANCE links            │
│        (e.g., Project A → Task B)                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Two Modes

#### Mode 1: Assign Parent

**Use Case:** "This task needs to belong to a project"

```typescript
// User has a child entity (task) and wants to assign/change its parent (project)
linkageModal.openAssignParent({
  childEntityType: 'task',
  childEntityId: taskId,
  childEntityName: taskName
});
```

**UI Flow:**
1. Modal shows current linkage status
2. User sees entity type buttons with icons (Office, Business, Client, Project, etc.)
3. User clicks entity type button to select parent type
4. Table displays all available parent entities (Name, Code, Description, Status, Action)
5. User searches/filters entities if needed
6. User clicks Plus (+) icon to link or X icon to unlink
7. Linked entities show blue background with "Linked" badge

#### Mode 2: Manage Children

**Use Case:** "This project should have these tasks"

```typescript
// User has a parent entity (project) and wants to add/remove its children (tasks)
linkageModal.openManageChildren({
  parentEntityType: 'project',
  parentEntityId: projectId,
  parentEntityName: projectName,
  allowedEntityTypes: ['task', 'wiki', 'artifact'] // Optional filter
});
```

**UI Flow:**
1. Modal shows current children count
2. User sees entity type buttons with icons (Task, Wiki, Artifact, Form, etc.)
3. User clicks entity type button to select child type
4. Table displays all available child entities (Name, Code, Description, Status, Action)
5. User searches/filters entities if needed
6. User clicks Plus (+) icon to link or X icon to unlink
7. Linked entities show blue background with "Linked" badge
8. Multiple children can be managed simultaneously

---

## Component API

### UI Design

The UnifiedLinkageModal uses a **button-based entity selector** matching the LinkagePage design:

**Entity Type Buttons:**
- Display entity type icons (Office 🏢, Business 🏭, Client 🏢, Project 📁, Task ✓, etc.)
- Blue highlight when selected (`bg-blue-50 border-blue-400 text-blue-700`)
- Small compact design (`text-xs`, `px-2 py-1`)

**Data Table:**
| Column | Purpose |
|--------|---------|
| Name | Entity name (text-xs) |
| Code | Entity code (text-xs) |
| Description | Entity description (text-xs, truncated) |
| Status | "Linked" badge or "-" (text-[10px]) |
| Action | Plus (+) or X icon (h-3.5 w-3.5) |

**Visual Indicators:**
- Linked rows: Blue background (`bg-blue-50`)
- Linked badge: Blue pill with checkmark (`bg-blue-100 text-blue-700`)
- Link button: Green plus icon on hover (`text-green-600`)
- Unlink button: Red X icon on hover (`text-red-600`)

### UnifiedLinkageModal Props

```typescript
interface UnifiedLinkageModalProps {
  // Required
  isOpen: boolean;
  onClose: () => void;
  mode: 'assign-parent' | 'manage-children';

  // For "assign-parent" mode
  childEntityType?: string;
  childEntityId?: string;
  childEntityName?: string;

  // For "manage-children" mode
  parentEntityType?: string;
  parentEntityId?: string;
  parentEntityName?: string;

  // Optional
  allowedEntityTypes?: string[]; // Restrict which entity types can be linked
  onLinkageChange?: () => void;  // Callback when linkage is created/deleted
}
```

### useLinkageModal Hook

```typescript
const linkageModal = useLinkageModal({
  onLinkageChange: () => {
    // Refetch data when linkages change
  }
});

// Returns
{
  isOpen: boolean;
  mode: 'assign-parent' | 'manage-children';
  openAssignParent: (params) => void;
  openManageChildren: (params) => void;
  close: () => void;
  modalProps: { ...propsToSpread }; // Spread onto UnifiedLinkageModal
}
```

---

## Usage Examples

### Example 1: Task Detail Page - Assign to Project

```tsx
import { UnifiedLinkageModal } from '@/components/shared/modal/UnifiedLinkageModal';
import { useLinkageModal } from '@/hooks/useLinkageModal';
import { Button } from '@/components/shared/button/Button';
import { Link as LinkIcon } from 'lucide-react';

function TaskDetailPage({ task }) {
  const linkageModal = useLinkageModal({
    onLinkageChange: () => {
      // Refetch task to get updated project_id
      refetchTask();
    }
  });

  return (
    <div>
      <div className="flex items-center gap-4">
        <h1>{task.name}</h1>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => linkageModal.openAssignParent({
            childEntityType: 'task',
            childEntityId: task.id,
            childEntityName: task.name,
            allowedEntityTypes: ['project', 'worksite'] // Only these parent types
          })}
        >
          <LinkIcon className="h-4 w-4 mr-2" />
          Assign to Project
        </Button>
      </div>

      {/* Rest of task detail page */}

      <UnifiedLinkageModal {...linkageModal.modalProps} />
    </div>
  );
}
```

### Example 2: Project Detail Page - Manage Tasks

```tsx
function ProjectDetailPage({ project }) {
  const [tasks, setTasks] = useState([]);
  const linkageModal = useLinkageModal({
    onLinkageChange: () => {
      // Refetch tasks for this project
      loadProjectTasks();
    }
  });

  const loadProjectTasks = async () => {
    const response = await fetch(
      `/api/v1/project/${project.id}/task`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json();
    setTasks(data.data);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1>{project.name}</h1>
        <Button
          onClick={() => linkageModal.openManageChildren({
            parentEntityType: 'project',
            parentEntityId: project.id,
            parentEntityName: project.name,
            allowedEntityTypes: ['task', 'wiki', 'artifact', 'form']
          })}
        >
          Add Children
        </Button>
      </div>

      {/* Display tasks */}
      <div className="mt-4">
        <h2>Tasks ({tasks.length})</h2>
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>

      <UnifiedLinkageModal {...linkageModal.modalProps} />
    </div>
  );
}
```

### Example 3: Entity Table Row Actions

```tsx
function EntityTableRow({ entity, entityType }) {
  const linkageModal = useLinkageModal({
    onLinkageChange: () => {
      // Refresh table or update badge counts
      refetchTable();
    }
  });

  return (
    <tr>
      <td>{entity.name}</td>
      <td>
        <button
          onClick={(e) => {
            e.stopPropagation();
            linkageModal.openManageChildren({
              parentEntityType: entityType,
              parentEntityId: entity.id,
              parentEntityName: entity.name
            });
          }}
          className="p-1 hover:bg-gray-100 rounded"
        >
          Manage Children
        </button>

        <UnifiedLinkageModal {...linkageModal.modalProps} />
      </td>
    </tr>
  );
}
```

### Example 4: Kanban Card Quick Link

```tsx
function KanbanCard({ task }) {
  const linkageModal = useLinkageModal();

  return (
    <div className="kanban-card">
      <div className="flex items-center justify-between">
        <h4>{task.name}</h4>
        <button
          onClick={() => linkageModal.openAssignParent({
            childEntityType: 'task',
            childEntityId: task.id,
            childEntityName: task.name,
            allowedEntityTypes: ['project']
          })}
        >
          <LinkIcon className="h-3 w-3" />
        </button>
      </div>

      <UnifiedLinkageModal {...linkageModal.modalProps} />
    </div>
  );
}
```

---

## Database Schema

### d_entity_map (Type-to-Type Relationships)

**Purpose:** Define which entity TYPES can be linked together

```sql
CREATE TABLE app.d_entity_map (
    id uuid PRIMARY KEY,
    parent_entity_type varchar(20) NOT NULL,
    child_entity_type varchar(20) NOT NULL,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

-- Example Data
INSERT INTO app.d_entity_map (parent_entity_type, child_entity_type) VALUES
('project', 'task'),
('project', 'wiki'),
('project', 'artifact'),
('business', 'project'),
('office', 'business'),
('task', 'artifact');
```

**Valid Relationships:**
```
business → project
project  → task, artifact, wiki, form
office   → task, artifact, wiki, form, business
client   → project, artifact, form
role     → employee
task     → form, artifact
form     → artifact
```

### d_entity_id_map (Instance-to-Instance Linkages)

**Purpose:** Store actual parent-child links between specific entity instances

```sql
CREATE TABLE app.d_entity_id_map (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_entity_type varchar(20) NOT NULL,
    parent_entity_id text NOT NULL,
    child_entity_type varchar(20) NOT NULL,
    child_entity_id text NOT NULL,
    relationship_type varchar(50) DEFAULT 'contains',
    from_ts timestamptz NOT NULL DEFAULT now(),
    to_ts timestamptz,
    active_flag boolean NOT NULL DEFAULT true,
    created_ts timestamptz NOT NULL DEFAULT now(),
    updated_ts timestamptz NOT NULL DEFAULT now(),
    UNIQUE(parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
);

-- Example Data
INSERT INTO app.d_entity_id_map
(parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
VALUES
('project', 'p1111111-1111-1111-1111-111111111111', 'task', 'a1111111-1111-1111-1111-111111111111', 'contains'),
('project', 'p1111111-1111-1111-1111-111111111111', 'wiki', 'w1111111-1111-1111-1111-111111111111', 'documents'),
('business', 'b1111111-1111-1111-1111-111111111111', 'project', 'p1111111-1111-1111-1111-111111111111', 'owns');
```

**Key Fields:**
- `parent_entity_type` / `parent_entity_id` - The parent entity
- `child_entity_type` / `child_entity_id` - The child entity
- `relationship_type` - Nature of relationship ('contains', 'owns', 'documents', etc.)
- `active_flag` - Soft delete flag
- `UNIQUE` constraint prevents duplicate linkages

---

## API Endpoints

### 1. List Linkages

```http
GET /api/v1/linkage?parent_entity_type=project&parent_entity_id=<uuid>
GET /api/v1/linkage?child_entity_type=task&child_entity_id=<uuid>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "parent_entity_type": "project",
      "parent_entity_id": "uuid",
      "child_entity_type": "task",
      "child_entity_id": "uuid",
      "relationship_type": "contains",
      "active_flag": true,
      "created_ts": "2025-10-24T10:00:00Z",
      "updated_ts": "2025-10-24T10:00:00Z"
    }
  ],
  "total": 1
}
```

### 2. Create Linkage

```http
POST /api/v1/linkage
Content-Type: application/json

{
  "parent_entity_type": "project",
  "parent_entity_id": "uuid",
  "child_entity_type": "task",
  "child_entity_id": "uuid",
  "relationship_type": "contains"
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* linkage object */ },
  "message": "Linkage created successfully"
}
```

**Validation:**
- Checks `d_entity_map` for valid parent-child type combination
- Requires edit permission on both parent and child entities
- Reactivates if linkage exists but is inactive
- Returns existing linkage if already active

### 3. Delete Linkage (Soft Delete)

```http
DELETE /api/v1/linkage/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Linkage deleted successfully"
}
```

**Behavior:**
- Sets `active_flag = false` (soft delete)
- Requires delete permission on both parent and child entities
- Child entity remains accessible in global lists
- Can be reactivated by creating linkage again

### 4. Get Valid Child Types for Parent

```http
GET /api/v1/linkage/children/project
```

**Response:**
```json
{
  "success": true,
  "data": ["task", "wiki", "artifact", "form"]
}
```

**Source:** Queries `d_entity_map` table

### 5. Get Valid Parent Types for Child

```http
GET /api/v1/linkage/parents/task
```

**Response:**
```json
{
  "success": true,
  "data": ["project", "worksite"]
}
```

**Source:** Queries `d_entity_map` table

### Important: API Endpoint Mapping

Some entity types use different API endpoints than their entity type name:

| Entity Type | API Endpoint |
|-------------|--------------|
| `business` | `/api/v1/biz` |
| `client` | `/api/v1/cust` |
| All others | `/api/v1/{entityType}` |

**Implementation:**
```typescript
const getApiEndpoint = (entityType: string): string => {
  if (entityType === 'business') return 'biz';
  if (entityType === 'client') return 'cust';
  return entityType;
};
```

**API Limits:**
- Maximum `limit` parameter: **100** (not 200)
- Requests with `limit > 100` will return 400 Bad Request

---

## Migration Guide

### Migrating from Old Linkage Components

#### Step 1: Identify Current Usage

Find all uses of old linkage components:
```bash
# Search for LinkModal usage
grep -r "LinkModal" apps/web/src/

# Search for manual linkage API calls
grep -r "POST.*linkage" apps/web/src/
```

#### Step 2: Replace with UnifiedLinkageModal

**Before (Old LinkModal):**
```tsx
import { LinkModal } from '@/components/shared/modal/LinkModal';

function TaskPage({ task }) {
  const [showLinkModal, setShowLinkModal] = useState(false);

  return (
    <>
      <button onClick={() => setShowLinkModal(true)}>
        Link to Project
      </button>

      <LinkModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        childEntityType="task"
        childEntityId={task.id}
        childEntityName={task.name}
      />
    </>
  );
}
```

**After (UnifiedLinkageModal):**
```tsx
import { UnifiedLinkageModal } from '@/components/shared/modal/UnifiedLinkageModal';
import { useLinkageModal } from '@/hooks/useLinkageModal';

function TaskPage({ task }) {
  const linkageModal = useLinkageModal({
    onLinkageChange: () => refetchTask()
  });

  return (
    <>
      <button onClick={() => linkageModal.openAssignParent({
        childEntityType: 'task',
        childEntityId: task.id,
        childEntityName: task.name
      })}>
        Link to Project
      </button>

      <UnifiedLinkageModal {...linkageModal.modalProps} />
    </>
  );
}
```

#### Step 3: Update EntityDetailPage Integration

Add linkage management to all EntityDetailPage instances:

```tsx
// In EntityDetailPage.tsx
import { UnifiedLinkageModal } from '@/components/shared/modal/UnifiedLinkageModal';
import { useLinkageModal } from '@/hooks/useLinkageModal';

export function EntityDetailPage({ entityType, entityId }) {
  const linkageModal = useLinkageModal({
    onLinkageChange: () => {
      // Refetch child counts for tab badges
      refetchChildCounts();
    }
  });

  return (
    <Layout>
      <div className="entity-header">
        <h1>{entity.name}</h1>
        <Button onClick={() => linkageModal.openManageChildren({
          parentEntityType: entityType,
          parentEntityId: entityId,
          parentEntityName: entity.name
        })}>
          Manage Children
        </Button>
      </div>

      {/* Dynamic child tabs */}

      <UnifiedLinkageModal {...linkageModal.modalProps} />
    </Layout>
  );
}
```

#### Step 4: Remove Old Components

After migration is complete:
```bash
# Archive old components (don't delete immediately)
mv apps/web/src/components/shared/modal/LinkModal.tsx apps/web/src/components/_archive/
mv apps/web/src/pages/LinkagePage.tsx apps/web/src/pages/_archive/
```

---

## Best Practices

### 1. Always Use the Hook

**✅ Good:**
```tsx
const linkageModal = useLinkageModal();
<UnifiedLinkageModal {...linkageModal.modalProps} />
```

**❌ Bad:**
```tsx
const [isOpen, setIsOpen] = useState(false);
<UnifiedLinkageModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  // ... manually managing all props
/>
```

### 2. Handle Linkage Changes

Always provide `onLinkageChange` to refresh data:

```tsx
const linkageModal = useLinkageModal({
  onLinkageChange: () => {
    refetchData();        // ✅ Refetch from API
    invalidateQueries();  // ✅ If using React Query
    // Don't forget to update tab badges, counts, etc.
  }
});
```

### 3. Restrict Entity Types When Appropriate

```tsx
// ✅ Good: Only allow linking to projects
linkageModal.openAssignParent({
  childEntityType: 'task',
  childEntityId: taskId,
  childEntityName: taskName,
  allowedEntityTypes: ['project'] // Restrict choices
});

// ❌ Less ideal: Allow all valid parent types when user only needs one
linkageModal.openAssignParent({
  childEntityType: 'task',
  childEntityId: taskId,
  childEntityName: taskName
  // No restriction = user sees 'project' AND 'worksite'
});
```

### 4. Use Descriptive Entity Names

```tsx
// ✅ Good: Include helpful context
linkageModal.openManageChildren({
  parentEntityType: 'project',
  parentEntityId: project.id,
  parentEntityName: `${project.name} (${project.code})` // Includes code
});

// ❌ Less helpful: Just the name
parentEntityName: project.name
```

### 5. Stop Event Propagation in Tables/Lists

```tsx
// ✅ Good: Prevent row click when opening modal
<button
  onClick={(e) => {
    e.stopPropagation(); // Don't trigger row navigation
    linkageModal.openManageChildren({...});
  }}
>
  Manage Links
</button>
```

### 6. Single Modal Instance Per Page

```tsx
// ✅ Good: One modal at page/component root
function ProjectPage() {
  const linkageModal = useLinkageModal();

  return (
    <div>
      {/* Multiple buttons can use same modal */}
      <Button onClick={() => linkageModal.openManageChildren({...})}>
        Manage Tasks
      </Button>
      <Button onClick={() => linkageModal.openManageChildren({...})}>
        Manage Wiki
      </Button>

      <UnifiedLinkageModal {...linkageModal.modalProps} />
    </div>
  );
}

// ❌ Bad: Multiple modal instances
function TaskCard({ task }) {
  const linkageModal = useLinkageModal();
  return (
    <div>
      <button onClick={...}>Link</button>
      <UnifiedLinkageModal {...linkageModal.modalProps} /> {/* ❌ Don't repeat */}
    </div>
  );
}
```

---

## Troubleshooting

### Issue: "No valid parent/child types available"

**Cause:** No relationships defined in `d_entity_map` table

**Solution:**
```sql
-- Add relationship to d_entity_map
INSERT INTO app.d_entity_map (parent_entity_type, child_entity_type)
VALUES ('your_parent_type', 'your_child_type');
```

### Issue: "Failed to create link" (403 Forbidden)

**Cause:** User lacks RBAC permissions

**Solution:** Grant edit permission on both parent and child entities:
```sql
-- Check permissions
SELECT * FROM app.entity_id_rbac_map
WHERE empid = 'user-id'
  AND entity IN ('parent_type', 'child_type');

-- Grant permission (example)
INSERT INTO app.entity_id_rbac_map (empid, entity, entity_id, permission)
VALUES ('user-id', 'project', 'all', ARRAY[0,1,2,3,4]);
```

### Issue: Modal shows but search returns no results

**Cause:** Entity API endpoint not responding or user lacks view permission

**Solution:**
- Check API logs: `./tools/logs-api.sh`
- Verify entity endpoint: `./tools/test-api.sh GET /api/v1/task`
- Check RBAC permissions for entity type

### Issue: 400 Bad Request - "querystring/limit must be <= 100"

**Cause:** API has maximum limit of 100 items per request

**Solution:** The UnifiedLinkageModal already uses `limit=100`. If you're making manual API calls, ensure you don't exceed this limit:
```typescript
// ✅ Good
fetch(`/api/v1/project?limit=100`)

// ❌ Bad - will fail
fetch(`/api/v1/project?limit=200`)
```

### Issue: 404 Not Found for `/api/v1/client`

**Cause:** Wrong endpoint - client entities use the `cust` endpoint

**Solution:** Always use the `getApiEndpoint()` helper function:
```typescript
const endpoint = getApiEndpoint('client'); // Returns 'cust'
fetch(`/api/v1/${endpoint}`) // /api/v1/cust ✅
```

**Endpoint Mappings:**
- `business` → `/api/v1/biz`
- `client` → `/api/v1/cust`
- All others use their entity type name

---

## Future Enhancements

### Planned Features

1. **Bulk Linkage Operations**
   - Link multiple children to one parent in single operation
   - Endpoint: `POST /api/v1/linkage/bulk`

2. **Relationship Type Selection**
   - Allow user to choose relationship type (contains, owns, documents, etc.)
   - Add dropdown in modal

3. **Link History & Audit Trail**
   - Track when linkages were created/deleted
   - Show who made changes

4. **Smart Suggestions**
   - "You might want to link this task to Project X" based on patterns

5. **Drag-and-Drop Linking**
   - Drag task cards onto project cards to create linkage

6. **Linkage Preview**
   - Show what will happen before creating link
   - Display warnings for complex scenarios

---

## Summary

The **Unified Linkage System** provides:

✅ **Single Reusable Modal** - One component for all linkage scenarios
✅ **Two Modes** - Assign parent OR manage children
✅ **Unified API** - All operations use `/api/v1/linkage` endpoints
✅ **Type Safety** - Validates against `d_entity_map` rules
✅ **RBAC Integration** - Respects entity permissions
✅ **Easy Integration** - Simple hook-based API
✅ **Consistent UX** - Same experience across all entity types

**Key Files:**
- `/apps/web/src/components/shared/modal/UnifiedLinkageModal.tsx` - Main component
- `/apps/web/src/hooks/useLinkageModal.ts` - Custom hook
- `/apps/api/src/modules/linkage/routes.ts` - API endpoints
- `/db/29_d_entity_map.ddl` - Type relationships
- `/db/33_d_entity_id_map.ddl` - Instance linkages

**Next Steps:**
1. Integrate into EntityDetailPage for all entity types
2. Add to table row actions in EntityMainPage
3. Replace existing LinkModal usages
4. Test with all entity combinations
5. Monitor usage and gather feedback

---

## Recent Changes (v2.0.0)

### UI/UX Updates
- **Replaced dropdown with button-based entity selector** - Matches LinkagePage UI exactly
- **Added entity type icons** - Visual indicators for Office, Business, Client, Project, Task, etc.
- **Updated table styling** - Smaller padding (`px-3 py-1.5`), smaller fonts (`text-xs`)
- **Refined search bar** - Compact design matching LinkagePage
- **Improved visual hierarchy** - Blue highlights for selected buttons and linked rows

### Technical Updates
- **Added helper functions:**
  - `getEntityLabel()` - Get display name for entity type
  - `getEntityIconComponent()` - Get Lucide icon for entity type
  - `getApiEndpoint()` - Map entity types to correct API endpoints
- **Fixed endpoint mappings:**
  - `business` → `/api/v1/biz`
  - `client` → `/api/v1/cust`
- **Updated API limit:** Changed from 200 to 100 (API maximum)
- **Restored LinkagePage:** Full-page split-panel interface at `/linkage`

### Migration Notes
If you're using UnifiedLinkageModal from before v2.0.0:
- No prop changes required - fully backward compatible
- UI will automatically update to button-based selector
- Entity type filtering still works the same way
- All existing integrations (EntityDetailPage, FormEditPage, WikiEditorPage) continue to work

---

**Last Updated:** 2025-10-24
**Version:** 2.0.0
**Maintainer:** PMO Platform Team
