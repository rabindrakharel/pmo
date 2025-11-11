# Unified Linkage System - Complete Documentation

> **Reusable Entity Relationship Management** - Single modal component with LinkagePage-style UI handling all parent-child linkage scenarios across the PMO platform

**Last Updated:** 2025-10-29
**Version:** 2.3.0 (Entity Preview System with large modal popup)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Component API](#component-api)
4. [Usage Examples](#usage-examples)
5. [Child Entity Tab Management (NEW v2.2.0)](#child-entity-tab-management-new-v220)
6. [Entity Preview System (NEW v2.3.0)](#entity-preview-system-new-v230)
7. [Database Schema](#database-schema)
8. [API Endpoints](#api-endpoints)
   - [Parent-Action Entity Routes](#parent-action-entity-routes)
   - [Entity Type Child Management](#entity-type-child-management)
9. [Migration Guide](#migration-guide)
10. [Best Practices](#best-practices)
11. [Recent Changes](#recent-changes)

---

## Overview

### What is the Linkage System?

The **Unified Linkage System** provides a centralized way to manage parent-child relationships between entity instances in the PMO platform. It consists of:

- **UnifiedLinkageModal** - Single reusable modal component for instance linking
- **LinkagePage** - Full-page child tab management with multi-checkbox dropdowns
- **useLinkageModal** - Custom React hook for state management
- **Unified Backend API** - `/api/v1/linkage` and `/api/v1/entity` endpoints
- **Database Tables** - `d_entity` (entity types), `d_entity_map` (valid relationships), `d_entity_id_map` (instance links)

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

## Child Entity Tab Management (NEW v2.2.0)

### Overview

The LinkagePage at `/linkage` provides a dedicated interface for managing which entity types can appear as child tabs on entity detail pages. This system allows administrators to configure **which child entity types** (like tasks, wiki, artifacts) appear as tabs on parent entity types (like projects, offices, businesses).

### Two-Level Hierarchy

The system manages two levels of relationships:

1. **Type-Level Configuration** (LinkagePage)
   - Defines which entity TYPES can contain other entity TYPES
   - Stored in `d_entity.child_entities` JSONB field
   - Configured via multi-checkbox dropdowns
   - Example: "Project" entity type can have tabs for "Tasks", "Wiki", "Artifacts"

2. **Instance-Level Linking** (UnifiedLinkageModal)
   - Links specific entity INSTANCES to each other
   - Stored in `d_entity_id_map` table
   - Example: "Website Redesign Project" contains "Homepage Task"

### UI Components

#### Multi-Checkbox Dropdown System

The LinkagePage features two control buttons at the top of the right panel:

**Add+ Button (Green):**
- Opens dropdown showing ALL entity types
- Checkboxes allow multi-selection
- Shows "Already linked" for entity types already configured as child tabs
- Disabled checkboxes for already-linked types
- Bulk add operation with counter: "Add (N)"

**Remove Button (Red Checkmark):**
- Opens dropdown showing CURRENT child entity types
- Checkboxes allow multi-selection
- Shows order number for each child tab
- Bulk remove operation with counter: "Remove (N)"
- Confirmation dialog before removal

**Visual States:**
```
Normal:  [Add+] [✓]  (gray borders)
Add Open: [Add+] [✓]  (Add+ has green background)
Remove Open: [Add+] [✓]  (Checkmark has red background)
```

### Workflow Example

**Scenario:** Configure Project entity to show Tasks, Wiki, and Artifacts tabs

```
1. Navigate to /linkage
2. Select "Project" from left panel
3. Click "Add+" button
4. Dropdown shows:
   ☐ Office      (disabled - parent type)
   ☐ Business    Businesses
   ☑ Task        Tasks          ← Check
   ☑ Wiki        Wiki Pages     ← Check
   ☑ Artifact    Artifacts      ← Check
   ☐ Form        Already linked (disabled)
5. Click "Add (3)"
6. Tabs now appear: Tasks, Wiki, Artifacts
7. Order automatically assigned: 1, 2, 3
```

**Removing Tabs:**
```
1. Click checkmark button (✓)
2. Dropdown shows:
   ☑ Tasks       Order: 1
   ☐ Wiki        Order: 2
   ☑ Artifacts   Order: 3
3. Select which to remove
4. Click "Remove (2)"
5. Confirmation dialog appears
6. Remaining tabs auto-reorder
```

### Database Structure

**d_entity table (Entity Type Metadata):**
```sql
CREATE TABLE app.d_entity (
    id uuid PRIMARY KEY,
    code varchar(50) NOT NULL UNIQUE,
    name varchar(100) NOT NULL,
    ui_label varchar(100),
    ui_icon varchar(50),
    child_entities jsonb,  -- Array of child tab config
    display_order integer,
    active_flag boolean DEFAULT true
);

-- child_entities structure:
[
  {
    "entity": "task",
    "ui_icon": "CheckSquare",
    "ui_label": "Tasks",
    "order": 1
  },
  {
    "entity": "wiki",
    "ui_icon": "FileText",
    "ui_label": "Wiki",
    "order": 2
  }
]
```

### API Endpoints

#### Get Entity Type Metadata
```http
GET /api/v1/entity/type/:entity_type

Response:
{
  "code": "project",
  "name": "Project",
  "ui_label": "Project",
  "ui_icon": "Folder",
  "child_entities": [
    {"entity": "task", "ui_icon": "CheckSquare", "ui_label": "Tasks", "order": 1},
    {"entity": "wiki", "ui_icon": "FileText", "ui_label": "Wiki", "order": 2}
  ],
  "display_order": 3,
  "active_flag": true
}
```

#### Update Child Entity Types (Bulk)
```http
PUT /api/v1/entity/:code/children
Content-Type: application/json

{
  "child_entities": [
    {"entity": "task", "ui_icon": "CheckSquare", "ui_label": "Tasks", "order": 1},
    {"entity": "wiki", "ui_icon": "FileText", "ui_label": "Wiki", "order": 2},
    {"entity": "artifact", "ui_icon": "Paperclip", "ui_label": "Artifacts", "order": 3}
  ]
}

Response:
{
  "success": true,
  "message": "Updated child entities for project",
  "data": { /* updated entity metadata */ }
}
```

### Key Features

✅ **Multi-Selection** - Add/remove multiple child types at once
✅ **Already Linked Detection** - Prevents duplicate child tabs
✅ **Auto-Ordering** - New tabs get next available order number
✅ **Auto-Reordering** - Removing tabs renumbers remaining ones
✅ **Bulk Operations** - Efficient batch updates
✅ **State Management** - Button states reflect dropdown status
✅ **Confirmation Dialogs** - Prevents accidental removals
✅ **Success Messages** - Visual feedback after operations

### Integration with Entity Detail Pages

The `child_entities` configuration in `d_entity` drives the DynamicChildEntityTabs component:

```tsx
// EntityDetailPage.tsx
<DynamicChildEntityTabs
  entityType="project"
  entityId={projectId}
/>

// Fetches from: GET /api/v1/entity/child-tabs/project/:id
// Returns tabs based on child_entities config
```

### Benefits

1. **No Code Changes Needed** - Configure tabs via UI, no deployment required
2. **Type-Safe** - Only valid child types can be added (validated against d_entity_map)
3. **User-Friendly** - Intuitive multi-checkbox interface
4. **Consistent** - Same experience across all entity types
5. **Flexible** - Different parent types can have different child tabs

---

## Entity Preview System (NEW v2.3.0)

### Overview

The **Entity Preview System** provides a quick way to preview entity details in a large modal popup without navigating away from the current page. When you select an entity instance (e.g., clicking a row in LinkagePage), a preview button becomes active. Clicking the preview button opens a full-screen modal showing the complete EntityDetailPage content.

**Key Features:**
- ✅ Large centered modal popup (95% of screen)
- ✅ Shows complete entity detail page with all tabs
- ✅ Preview button activates when entity selected
- ✅ Keyboard shortcuts (ESC to close)
- ✅ Click outside to close
- ✅ Open in new tab button

---

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   ENTITY PREVIEW SYSTEM                  │
└──────────────────────────────────────────────────────────┘
                          │
                          ├─── EntityPreviewContext.tsx
                          │    (State management)
                          │
                          ├─── EntityPreviewPanel.tsx
                          │    (Large modal popup UI)
                          │
                          └─── LinkagePage.tsx
                               (Local preview button)
```

### Components

#### 1. EntityPreviewContext (`/contexts/EntityPreviewContext.tsx`)
**Purpose:** Centralized state management for preview system

**State:**
```typescript
interface EntityPreviewData {
  entityType: string;    // e.g., 'project', 'task', 'biz', 'cust'
  entityId: string;      // Entity UUID
  label?: string;        // Optional display label
}

interface EntityPreviewContextValue {
  entityPreviewData: EntityPreviewData | null;
  isEntityPreviewOpen: boolean;
  setPreviewData: (entity: EntityPreviewData | null) => void;
  openEntityPreview: (entity: EntityPreviewData) => void;
  closeEntityPreview: () => void;
}
```

**Usage:**
```typescript
import { useEntityPreview } from '../contexts/EntityPreviewContext';

function MyComponent() {
  const { setPreviewData, openEntityPreview } = useEntityPreview();

  // When instance is selected (activates preview button)
  const handleInstanceClick = (instance) => {
    setPreviewData({
      entityType: 'project',
      entityId: instance.id,
      label: `Project: ${instance.name}`
    });
  };

  // Preview button click handler
  const handlePreviewClick = () => {
    if (entityPreviewData && !isEntityPreviewOpen) {
      openEntityPreview(entityPreviewData);
    }
  };

  return (
    <>
      <button onClick={handleInstanceClick}>Select Instance</button>
      <button
        onClick={handlePreviewClick}
        disabled={!entityPreviewData}
      >
        Preview
      </button>
    </>
  );
}
```

#### 2. EntityPreviewPanel (`/components/shared/preview/EntityPreviewPanel.tsx`)
**Purpose:** Large centered modal popup UI component

**Features:**
- Centered modal (95vw × 95vh)
- Embeds full EntityDetailPage in iframe
- Shows all tabs, editing, child entities
- Backdrop with click-outside to close
- ESC key to close
- Open in new tab button

**Rendering:**
- Modal with backdrop overlay
- Header with entity icon, label, and action buttons
- iframe loading the entity detail page URL
- Smooth scale animation (95% → 100%)

**Visual Design:**
```css
/* Modal dimensions */
max-width: 95vw
height: 95vh
position: fixed, centered
z-index: 50

/* Animations */
transition: opacity 300ms, transform 300ms
scale-95 (hidden) → scale-100 (visible)

/* Backdrop */
z-index: 40
opacity: 0.4
background: black
```

#### 3. Preview Button in LinkagePage (`/pages/LinkagePage.tsx`)
**Purpose:** Local preview button specific to LinkagePage

**Behavior:**
- **Disabled** when no entity selected (gray, cursor-not-allowed)
- **Active** when entity selected (hover effects, clickable)
- Located in page header next to "Entity Linkage Management"

**Visual States:**
```typescript
// Disabled
className="bg-gray-50 text-gray-400 cursor-not-allowed"

// Active
className="bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900"
```

---

### Usage Patterns

#### Pattern 1: Activate Preview from Row Click

**Scenario:** User clicks on an entity row in LinkagePage

```typescript
import { useEntityPreview } from '../contexts/EntityPreviewContext';

function LinkagePage() {
  const { setPreviewData } = useEntityPreview();

  const handleParentInstanceSelect = (instance: EntityInstance) => {
    setSelectedParentId(instance.id);
    setSelectedParentInstance(instance);

    // Activate preview button (but don't open panel yet)
    if (selectedParentTypes.length > 0) {
      const parentType = selectedParentTypes[0];
      const apiEndpoint = getApiEndpoint(parentType);
      setPreviewData({
        entityType: apiEndpoint,
        entityId: instance.id,
        label: `${getEntityLabel(parentType)}: ${instance.name}`
      });
    }
  };

  return (
    <table>
      {instances.map(instance => (
        <tr onClick={() => handleParentInstanceSelect(instance)}>
          <td>{instance.name}</td>
        </tr>
      ))}
    </table>
  );
}
```

#### Pattern 2: Open Preview from Button Click

**Scenario:** User clicks the preview button

```typescript
import { useEntityPreview } from '../contexts/EntityPreviewContext';

function LinkagePage() {
  const { entityPreviewData, isEntityPreviewOpen, openEntityPreview } = useEntityPreview();

  return (
    <button
      onClick={() => {
        if (entityPreviewData && !isEntityPreviewOpen) {
          openEntityPreview(entityPreviewData);
        }
      }}
      disabled={!entityPreviewData}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
        entityPreviewData
          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          : 'bg-gray-50 text-gray-400 cursor-not-allowed'
      }`}
    >
      <Eye className="h-4 w-4" />
      <span>Preview</span>
    </button>
  );
}
```

#### Pattern 3: Clear Preview Selection

**Scenario:** User navigates away or deselects entity

```typescript
import { useEntityPreview } from '../contexts/EntityPreviewContext';

function MyComponent() {
  const { setPreviewData } = useEntityPreview();

  useEffect(() => {
    // Clear preview when unmounting
    return () => {
      setPreviewData(null);
    };
  }, [setPreviewData]);

  return <div>Content</div>;
}
```

---

### User Flow

#### Flow 1: Row Click → Preview Button Activation → Preview Modal

```
1. USER views LinkagePage with entity instances
   ↓
2. USER clicks on "Website Redesign Project" row
   ↓
3. SYSTEM calls setPreviewData({
     entityType: 'project',
     entityId: 'abc-123',
     label: 'Project: Website Redesign'
   })
   ↓
4. SYSTEM updates context state
   • entityPreviewData = { entityType, entityId, label }
   • Preview button becomes ACTIVE (no longer gray)
   ↓
5. USER sees preview button is now enabled in page header
   ↓
6. USER clicks "Preview" button
   ↓
7. SYSTEM calls openEntityPreview(entityPreviewData)
   • Opens large centered modal popup
   • Loads /project/abc-123 in iframe
   • Shows complete EntityDetailPage with all tabs
   ↓
8. USER views project details in modal
   ↓
9. USER can:
   • Navigate tabs within the iframe
   • Edit entity (if permissions allow)
   • View child entities
   • Click "Open in new tab" icon
   • Press ESC to close
   • Click outside to close
   • Click X button to close
```

#### Flow 2: No Entity Selected

```
1. USER loads LinkagePage
   ↓
2. SYSTEM state:
   • entityPreviewData = null
   • Preview button is DISABLED (gray)
   ↓
3. USER hovers over preview button
   ↓
4. SYSTEM shows tooltip:
   "Select an entity to preview"
   ↓
5. USER cannot click (disabled state)
```

---

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **ESC** | Close preview modal |

---

### Styling & Visual Design

#### Preview Button States

```typescript
// Disabled (no entity selected)
<button
  disabled
  className="bg-gray-50 text-gray-400 cursor-not-allowed"
>
  <Eye className="h-4 w-4" />
  Preview
</button>

// Active (entity selected)
<button
  className="bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900"
>
  <Eye className="h-4 w-4" />
  Preview
</button>
```

#### Large Modal Popup

```css
/* Modal dimensions */
max-width: 95vw
height: 95vh
position: fixed (centered)
z-index: 50
border-radius: 0.75rem

/* Animations */
transition: opacity 300ms, transform 300ms
scale(0.95) (hidden) → scale(1) (visible)
opacity: 0 (hidden) → opacity: 1 (visible)

/* Backdrop */
z-index: 40
opacity: 0.4
background: black
```

---

### Integration with LinkagePage

#### In LinkagePage Header

```typescript
import { useEntityPreview } from '../contexts/EntityPreviewContext';

export function LinkagePage() {
  const { entityPreviewData, isEntityPreviewOpen, setPreviewData, openEntityPreview } = useEntityPreview();

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-gray-600 stroke-[1.5]" />
          <div>
            <h1 className="text-sm font-normal text-gray-800">Entity Linkage Management</h1>
            <p className="text-sm text-gray-500">Manage relationships between parent and child entities</p>
          </div>
        </div>

        {/* Entity Preview Button - Local to this page */}
        <button
          onClick={() => {
            if (entityPreviewData && !isEntityPreviewOpen) {
              openEntityPreview(entityPreviewData);
            }
          }}
          disabled={!entityPreviewData}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            entityPreviewData
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900'
              : 'bg-gray-50 text-gray-400 cursor-not-allowed'
          }`}
          title={entityPreviewData ? 'Quick preview (Show entity details)' : 'Select an entity to preview'}
        >
          <Eye className="h-4 w-4" />
          <span>Preview</span>
        </button>
      </div>
    </div>
  );
}
```

---

### Benefits

1. **✅ Context Preservation**
   - User stays on LinkagePage
   - Can compare multiple entities quickly
   - No navigation disruption

2. **✅ Complete View**
   - Shows exact EntityDetailPage content
   - All tabs available (Overview, Child entities)
   - Edit mode works if user has permissions

3. **✅ Large & Immersive**
   - 95% of screen size
   - Centered modal for focus
   - Backdrop darkens background

4. **✅ Keyboard Friendly**
   - ESC to close
   - Tab navigation within iframe

5. **✅ Flexible Integration**
   - Preview button is local to each page
   - Can be added to any page that selects entities
   - Consistent pattern across the platform

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

### 6. Parent-Action Entity Routes (NEW v2.1.0)

**Added:** 2025-10-27

The platform now includes unified parent-child entity endpoints that automatically handle both foreign key and linkage-based relationships:

```http
GET /api/v1/:parentEntity/:parentId/:actionEntity
```

**Examples:**
```http
# Foreign key relationship (task.project_id → project.id)
GET /api/v1/project/uuid/task?page=1&limit=20

# Linkage relationship (via d_entity_id_map)
GET /api/v1/task/uuid/form?page=1&limit=20
GET /api/v1/task/uuid/artifact?page=1&limit=20
GET /api/v1/project/uuid/wiki?page=1&limit=20
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (max: 100)
- `search` - Full-text search across name/description
- `active` - Filter by active status (true/false)
- `sortBy` - Sort field (default: name)
- `sortOrder` - Sort direction (asc/desc)

**Response Format:**
```json
{
  "data": [
    { /* child entity objects */ }
  ],
  "total": 25,
  "limit": 20,
  "offset": 0,
  "parent_info": {
    "entity_type": "task",
    "entity_id": "uuid",
    "entity_name": "Task Name"
  }
}
```

**Automatic Relationship Detection:**

The endpoint automatically determines whether to use foreign key or linkage based on the `RELATIONSHIP_MAP` configuration:

**Foreign Key Relationships:**
- project → task, form
- biz → project, task, form, client, employee
- worksite → task, form, employee
- org → worksite, employee
- client → task

**Linkage Relationships (via d_entity_id_map):**
- project → wiki, artifact
- biz → wiki, artifact
- task → form, artifact
- hr → role
- role → employee
- client → project

**Implementation Details:**

```typescript
// Configuration in parent-action-entity-routes.ts
const RELATIONSHIP_MAP = {
  'task': {
    'form': { type: 'linkage' },
    'artifact': { type: 'linkage' }
  },
  'project': {
    'task': { type: 'foreign_key', foreignKeyColumn: 'project_id' },
    'form': { type: 'foreign_key', foreignKeyColumn: 'project_id' },
    'wiki': { type: 'linkage' },
    'artifact': { type: 'linkage' }
  }
  // ... more relationships
};
```

**Usage in Frontend:**

```typescript
// Fetch tasks in a project (foreign key)
const response = await fetch(
  `/api/v1/project/${projectId}/task?page=1&limit=20`,
  { headers: { Authorization: `Bearer ${token}` } }
);

// Fetch forms linked to a task (linkage)
const response = await fetch(
  `/api/v1/task/${taskId}/form?page=1&limit=20`,
  { headers: { Authorization: `Bearer ${token}` } }
);
```

**RBAC Enforcement:**
- Requires view permission (0) on both parent and child entities
- Only returns child entities user has permission to view
- Filters results based on `entity_id_rbac_map`

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
✅ **Parent-Action Routes (NEW)** - Automatic child entity listing with `/api/v1/:parent/:id/:child`
✅ **Dual Relationship Handling** - Foreign key AND linkage-based relationships
✅ **Type Safety** - Validates against `d_entity_map` rules
✅ **RBAC Integration** - Respects entity permissions
✅ **Easy Integration** - Simple hook-based API
✅ **Consistent UX** - Same experience across all entity types
✅ **SQL Security** - Parameterized queries prevent injection attacks

**Key Files:**
- `/apps/web/src/components/shared/modal/UnifiedLinkageModal.tsx` - Main component
- `/apps/web/src/hooks/useLinkageModal.ts` - Custom hook
- `/apps/api/src/modules/linkage/routes.ts` - Linkage API endpoints
- `/apps/api/src/modules/entity/parent-action-entity-routes.ts` - Parent-child endpoints (NEW)
- `/db/29_d_entity_map.ddl` - Type relationships
- `/db/33_d_entity_id_map.ddl` - Instance linkages

**New in v2.1.0:**
- 40+ parent-child endpoint combinations
- Automatic foreign_key vs linkage detection
- Comprehensive RELATIONSHIP_MAP configuration
- Fixed 401 errors on child entity tabs
- SQL injection vulnerability patched

**Next Steps:**
1. ✅ Integrate into EntityDetailPage for all entity types (DONE)
2. ✅ Parent-action routes for direct child access (DONE)
3. Add to table row actions in EntityMainPage
4. Test with all entity combinations
5. Monitor usage and gather feedback

---

## Recent Changes

### v2.3.0 (2025-10-29)

#### Entity Preview System

**New Features:**
- **Large Modal Popup Preview** - 95% of screen size centered modal
  - Shows complete EntityDetailPage content in iframe
  - All tabs, editing, and child entities available
  - Preview button activates when entity instance selected
  - Opens only when preview button clicked

**UI/UX Improvements:**
- **Contextual Preview Button** - Local to each page (e.g., LinkagePage header)
  - Disabled (gray) when no entity selected
  - Active (clickable) when entity selected
  - Tooltip shows current state
- **Large & Immersive Modal** - Centered popup with backdrop
  - 95vw × 95vh dimensions
  - Rounded corners with smooth animations
  - Click outside or ESC to close
  - "Open in new tab" button

**Architecture:**
- **EntityPreviewContext** - State management with two functions:
  - `setPreviewData()` - Activates preview button without opening
  - `openEntityPreview()` - Opens the modal popup
- **EntityPreviewPanel** - Modal component with iframe
- **Preview Button Integration** - Added to LinkagePage header

**Files Changed:**
- `/apps/web/src/contexts/EntityPreviewContext.tsx` - Added setPreviewData function
- `/apps/web/src/components/shared/preview/EntityPreviewPanel.tsx` - Large modal with iframe
- `/apps/web/src/pages/LinkagePage.tsx` - Local preview button
- `/apps/web/src/components/shared/layout/Layout.tsx` - Removed global preview button
- `/docs/UnifiedLinkageSystem.md` - Added Entity Preview System documentation

### v2.2.0 (2025-10-29)

#### Child Entity Tab Management System

**New Features:**
- **Multi-Checkbox Dropdown Controls** - Add/Remove buttons with bulk selection capability
  - Add+ button (green) - Select multiple entity types to add as child tabs
  - Remove button (red checkmark) - Select multiple child tabs to remove
  - "Already linked" detection prevents duplicate configurations
  - Auto-ordering and auto-reordering of tabs

**UI/UX Improvements:**
- **State Management** - Button visual states reflect dropdown open/closed status
  - Add+ normal: gray border → Add+ active: green background
  - Remove normal: gray border → Remove active: red background
- **Bulk Operations** - Counter shows selected items: "Add (3)", "Remove (2)"
- **Confirmation Dialogs** - Prevents accidental removal of child tabs
- **Success Messages** - Visual feedback after add/remove operations

**API Updates:**
- Enhanced `PUT /api/v1/entity/:code/children` for bulk updates
- JSONB parsing for `child_entities` field in all entity type endpoints
- Fixed schema validation errors for child_entities

**Database:**
- Stores child tab configuration in `d_entity.child_entities` JSONB field
- Each child config includes: entity code, ui_icon, ui_label, order

**Files Changed:**
- `/apps/web/src/pages/LinkagePage.tsx` - Multi-checkbox dropdown system
- `/apps/api/src/modules/entity/routes.ts` - JSONB parsing and bulk operations
- `/docs/UnifiedLinkageSystem.md` - Complete documentation update

### v2.1.0 (2025-10-27)

#### New Features
- **Parent-Action Entity Routes** - Unified endpoints for listing child entities within parent context
  - Automatic relationship detection (foreign_key vs linkage)
  - Comprehensive RELATIONSHIP_MAP configuration
  - Single endpoint pattern: `/api/v1/:parentEntity/:parentId/:actionEntity`
  - Supports pagination, search, filtering, and sorting
  - RBAC-enforced access control

#### Technical Updates
- **Dual Query Strategy** - Automatically selects optimal query approach:
  - Foreign Key: Direct JOIN via FK column (e.g., `task.project_id`)
  - Linkage: JOIN through `app.d_entity_id_map` table (e.g., task→form)
- **SQL Security** - All queries use parameterized statements to prevent SQL injection
- **Schema Flexibility** - JSONB fields validated flexibly to support dynamic entity data
- **Authentication** - Added `preHandler: [fastify.authenticate]` to all parent-child endpoints

#### Bug Fixes
- Fixed 401 authentication errors on child entity tab loading
- Fixed SQL injection vulnerability in artifact update endpoint
- Corrected linkage table reference (`app.d_entity_id_map`)
- Fixed missing task→form, task→artifact relationship support

#### API Enhancements
- 40+ new parent-child endpoint combinations
- Comprehensive query parameter support
- Automatic relationship type detection
- Consistent response format across all endpoints

### v2.0.0 (2025-10-24)

#### UI/UX Updates
- **Replaced dropdown with button-based entity selector** - Matches LinkagePage UI exactly
- **Added entity type icons** - Visual indicators for Office, Business, Client, Project, Task, etc.
- **Updated table styling** - Smaller padding (`px-3 py-1.5`), smaller fonts (`text-xs`)
- **Refined search bar** - Compact design matching LinkagePage
- **Improved visual hierarchy** - Blue highlights for selected buttons and linked rows

#### Technical Updates
- **Added helper functions:**
  - `getEntityLabel()` - Get display name for entity type
  - `getEntityIconComponent()` - Get Lucide icon for entity type
  - `getApiEndpoint()` - Map entity types to correct API endpoints
- **Fixed endpoint mappings:**
  - `business` → `/api/v1/biz`
  - `client` → `/api/v1/cust`
- **Updated API limit:** Changed from 200 to 100 (API maximum)
- **Restored LinkagePage:** Full-page split-panel interface at `/linkage`

#### Migration Notes
If you're using UnifiedLinkageModal from before v2.0.0:
- No prop changes required - fully backward compatible
- UI will automatically update to button-based selector
- Entity type filtering still works the same way
- All existing integrations (EntityDetailPage, FormEditPage, WikiEditorPage) continue to work

---

**Last Updated:** 2025-10-29
**Version:** 2.3.0
**Maintainer:** PMO Platform Team
