# Entity Linkage System - Complete Documentation

**Version:** 3.1.0
**Last Updated:** 2025-11-15
**Status:** Production Ready (Refactored with Reusable Components)

## Overview

The **Entity Linkage System** manages parent-child relationships between entity instances in the PMO platform. It provides both programmatic APIs and UI components for creating, viewing, and managing entity relationships.

### Key Concepts

**Two Types of Relationships:**

1. **Type-Level Configuration** (`d_entity_map`)
   - Defines which entity **TYPES** can be linked (e.g., "project" can contain "task")
   - Stored in: `app.d_entity_map` table
   - Purpose: Schema validation - prevents invalid linkages

2. **Instance-Level Linkages** (`d_entity_instance_link`)
   - Links specific entity **INSTANCES** (e.g., "Website Redesign Project" contains "Homepage Task")
   - Stored in: `app.d_entity_instance_link` table
   - Purpose: Actual data relationships

**Storage Pattern:**
- **NO foreign keys** in entity tables (e.g., `d_task.project_id` does NOT exist)
- **ALL relationships** stored in `d_entity_instance_link` table
- **Many-to-many** support (one task can belong to multiple projects)
- **Soft deletes** via `active_flag` (relationships can be reactivated)

---

## Database Schema

### Table: d_entity_map (Type-Level Relationships)

**Purpose:** Define valid parent-child entity type combinations

```sql
CREATE TABLE app.d_entity_map (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_entity_type varchar(20) NOT NULL,
    child_entity_type varchar(20) NOT NULL,
    active_flag boolean DEFAULT true,
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    UNIQUE(parent_entity_type, child_entity_type)
);
```

**Example Data:**
```sql
INSERT INTO app.d_entity_map (parent_entity_type, child_entity_type) VALUES
('project', 'task'),
('project', 'wiki'),
('project', 'artifact'),
('business', 'project'),
('office', 'business'),
('client', 'project');
```

**Valid Relationships:**
```
office    → business, employee
business  → project, employee, client
project   → task, wiki, artifact, form
client    → project, artifact, form
task      → artifact, form
worksite  → employee, task
```

### Table: d_entity_instance_link (Instance-Level Linkages)

**Purpose:** Store actual parent-child links between specific entity instances

```sql
CREATE TABLE app.d_entity_instance_link (
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
    version integer DEFAULT 1,
    UNIQUE(parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
);
```

**Example Data:**
```sql
INSERT INTO app.d_entity_instance_link
(parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
VALUES
('project', 'p1111111-1111-1111-1111-111111111111', 'task', 'a1111111-1111-1111-1111-111111111111', 'contains'),
('project', 'p1111111-1111-1111-1111-111111111111', 'wiki', 'w1111111-1111-1111-1111-111111111111', 'documents'),
('business', 'b1111111-1111-1111-1111-111111111111', 'project', 'p1111111-1111-1111-1111-111111111111', 'owns');
```

**Key Fields:**
- `parent_entity_type` / `parent_entity_id` - Parent entity reference
- `child_entity_type` / `child_entity_id` - Child entity reference
- `relationship_type` - Nature of relationship (contains, owns, documents, etc.)
- `active_flag` - Soft delete flag (false = unlinked)
- `UNIQUE` constraint - Prevents duplicate linkages
- **NO foreign key constraints** - Allows flexible many-to-many relationships

---

## API Endpoints

### 1. Create Linkage

```http
POST /api/v1/linkage
Content-Type: application/json
Authorization: Bearer <token>

{
  "parent_entity_type": "project",
  "parent_entity_id": "uuid",
  "child_entity_type": "task",
  "child_entity_id": "uuid",
  "relationship_type": "contains"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "linkage-uuid",
    "parent_entity_type": "project",
    "parent_entity_id": "uuid",
    "child_entity_type": "task",
    "child_entity_id": "uuid",
    "relationship_type": "contains",
    "active_flag": true,
    "created_ts": "2025-11-12T10:00:00Z"
  },
  "message": "Linkage created successfully"
}
```

**Validation:**
- ✅ Checks `d_entity_map` for valid parent-child type combination
- ✅ Requires RBAC edit permission `[1]` on both parent and child entities
- ✅ Reactivates if linkage exists but `active_flag = false`
- ✅ Returns existing linkage if already active

**Status Codes:**
- `201` - Linkage created successfully
- `200` - Linkage already exists (returned existing)
- `400` - Invalid entity type combination
- `403` - Insufficient RBAC permissions
- `404` - Parent or child entity not found
- `500` - Database error

### 2. List Linkages

```http
# Get children of a parent entity
GET /api/v1/linkage?parent_entity_type=project&parent_entity_id=<uuid>

# Get parents of a child entity
GET /api/v1/linkage?child_entity_type=task&child_entity_id=<uuid>

# Get all linkages for an entity type
GET /api/v1/linkage?parent_entity_type=project

# Pagination
GET /api/v1/linkage?parent_entity_type=project&page=1&limit=20
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
      "created_ts": "2025-11-10T10:00:00Z",
      "updated_ts": "2025-11-10T10:00:00Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

### 3. Delete Linkage (Soft Delete)

```http
DELETE /api/v1/linkage/:id
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Linkage deleted successfully"
}
```

**Behavior:**
- Sets `active_flag = false` (soft delete)
- Requires RBAC delete permission `[3]` on both parent and child
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

### 6. Get Child Entities (Filtered by Parent)

**New Unified Endpoint:**
```http
GET /api/v1/:parentEntity/:parentId/:childEntity
```

**Examples:**
```http
# Get tasks in a project
GET /api/v1/project/uuid/task?page=1&limit=20

# Get wiki pages in a project
GET /api/v1/project/uuid/wiki?page=1&limit=20

# Get artifacts in a task
GET /api/v1/task/uuid/artifact?page=1&limit=20

# Get forms linked to a client
GET /api/v1/client/uuid/form?page=1&limit=20
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (max: 100, default: 20)
- `search` - Full-text search across name/description
- `active` - Filter by active status (true/false)
- `sortBy` - Sort field (default: name)
- `sortOrder` - Sort direction (asc/desc)

**Response:**
```json
{
  "data": [
    {
      "id": "task-uuid",
      "name": "Homepage Design",
      "code": "TASK-001",
      "status": "in_progress",
      "assignee_name": "John Smith"
    }
  ],
  "total": 25,
  "limit": 20,
  "offset": 0,
  "parent_info": {
    "entity_type": "project",
    "entity_id": "uuid",
    "entity_name": "Website Redesign"
  }
}
```

**Query Strategy:**
All child entity queries use **linkage-based filtering** via `d_entity_instance_link`:
```sql
SELECT child.*
FROM app.d_task child
INNER JOIN app.d_entity_instance_link link
  ON link.child_entity_type = 'task'
  AND link.child_entity_id = child.id
WHERE link.parent_entity_type = 'project'
  AND link.parent_entity_id = $1
  AND link.active_flag = true
  AND child.active_flag = true
```

**RBAC Enforcement:**
- Requires view permission `[0]` on both parent and child entities
- Only returns child entities user has permission to view
- Filters results based on `d_entity_rbac`

---

## RBAC Integration

### Permission Model

All linkage operations respect the standard entity RBAC pattern via `d_entity_rbac`:

```sql
-- Permission array structure
ARRAY[0,1,2,3,4,5]
  [0] = View    - Can see linkages
  [1] = Edit    - Can create/modify linkages
  [2] = Share   - Can share linkage details
  [3] = Delete  - Can remove linkages
  [4] = Create  - Can create new linkages
  [5] = Owner   - Full control over linkages
```

### Operation Requirements

| Operation | Required Permission | Scope |
|-----------|---------------------|-------|
| **Create Linkage** | Edit `[1]` | Both parent AND child entities |
| **List Linkages** | View `[0]` | Parent OR child entity |
| **Delete Linkage** | Delete `[3]` | Both parent AND child entities |
| **View Child List** | View `[0]` | Both parent AND child entities |

### Example RBAC Queries

**Grant full linkage permissions:**
```sql
-- Allow user to link/unlink tasks to/from projects
INSERT INTO app.d_entity_rbac (empid, entity, entity_id, permission)
VALUES
  ('user-uuid', 'project', 'all', ARRAY[0,1,2,3,4,5]),  -- Full project access
  ('user-uuid', 'task', 'all', ARRAY[0,1,2,3,4,5]);     -- Full task access
```

**Grant view-only access:**
```sql
-- Allow user to view project-task linkages but not modify
INSERT INTO app.d_entity_rbac (empid, entity, entity_id, permission)
VALUES
  ('user-uuid', 'project', 'all', ARRAY[0]),  -- View projects
  ('user-uuid', 'task', 'all', ARRAY[0]);     -- View tasks
```

**Grant ownership of specific linkage:**
```sql
-- User owns a specific project and all its linkages
INSERT INTO app.d_entity_rbac (empid, entity, entity_id, permission)
VALUES
  ('user-uuid', 'project', 'project-uuid-123', ARRAY[0,1,2,3,4,5]);
```

---

## Frontend Integration (UI Components)

### Architecture Overview

The linkage system uses a **reusable component architecture** with shared hooks for entity instance loading:

```
┌─────────────────────────────────────────────────────┐
│ useEntityInstancePicker (Shared Hook)              │
│ • Entity loading logic                             │
│ • Search/filter functionality                      │
│ • Loading states                                   │
└─────────────────────────────────────────────────────┘
                      ↓ used by
┌─────────────────────────────────────────────────────┐
│ UnifiedLinkageModal                                 │
│ • Link/unlink UI logic                             │
│ • Uses hook for entity instances                   │
│ • Manages linkage state                            │
└─────────────────────────────────────────────────────┘
```

### Hook: useEntityInstancePicker

**Location:** `/apps/web/src/hooks/useEntityInstancePicker.ts`

**Purpose:** Reusable hook for loading and filtering entity instances

**Features:**
- Auto-fetches entity instances when entity type changes
- Client-side search/filtering
- Loading and error state management
- Automatic endpoint mapping (`business` → `biz`, `client` → `cust`)

**API:**
```typescript
const {
  instances,           // All loaded instances
  filteredInstances,   // Filtered by search query
  loading,            // Loading state
  error,              // Error message
  searchQuery,        // Current search query
  setSearchQuery,     // Update search
  refresh             // Manual refresh
} = useEntityInstancePicker({
  entityType: 'project',  // Entity type to load
  enabled: true,          // Enable/disable fetching
  limit: 100              // Max instances to load
});
```

**Usage Example:**
```typescript
import { useEntityInstancePicker } from '@/hooks/useEntityInstancePicker';

function MyComponent({ entityType }) {
  const {
    filteredInstances,
    loading,
    searchQuery,
    setSearchQuery
  } = useEntityInstancePicker({
    entityType: entityType || null,
    enabled: !!entityType
  });

  return (
    <div>
      <input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search..."
      />
      {loading ? (
        <div>Loading...</div>
      ) : (
        <ul>
          {filteredInstances.map(entity => (
            <li key={entity.id}>{entity.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### Component: UnifiedLinkageModal

**Location:** `/apps/web/src/components/shared/modal/UnifiedLinkageModal.tsx`

**Purpose:** Reusable modal for creating/managing entity linkages

**Architecture:** Uses `useEntityInstancePicker` hook for entity loading (no duplicate code)

**Usage Pattern:**
```tsx
import { UnifiedLinkageModal } from '@/components/shared/modal/UnifiedLinkageModal';
import { useLinkageModal } from '@/hooks/useLinkageModal';

function ProjectDetailPage({ project }) {
  const linkageModal = useLinkageModal({
    onLinkageChange: () => {
      // Refetch child entities when linkages change
      refetchTasks();
    }
  });

  return (
    <div>
      <h1>{project.name}</h1>

      <button
        onClick={() => linkageModal.openManageChildren({
          parentEntityType: 'project',
          parentEntityId: project.id,
          parentEntityName: project.name,
          allowedEntityTypes: ['task', 'wiki', 'artifact']
        })}
      >
        Add Children
      </button>

      <UnifiedLinkageModal {...linkageModal.modalProps} />
    </div>
  );
}
```

**Modal Props:**
```typescript
interface UnifiedLinkageModalProps {
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
  allowedEntityTypes?: string[];  // Restrict entity types
  onLinkageChange?: () => void;   // Callback on linkage change
}
```

**Two Modes:**

1. **Assign Parent** (Child → Parent)
   - Use case: "This task needs to belong to a project"
   - Opens from child entity context
   - Shows available parent entities to link to

2. **Manage Children** (Parent → Children)
   - Use case: "This project should have these tasks"
   - Opens from parent entity context
   - Shows available child entities to link/unlink

### Hook: useLinkageModal

**Location:** `/apps/web/src/hooks/useLinkageModal.ts`

**API:**
```typescript
const linkageModal = useLinkageModal({
  onLinkageChange?: () => void;  // Optional callback
});

// Returns
{
  isOpen: boolean;
  mode: 'assign-parent' | 'manage-children';
  openAssignParent: (params) => void;
  openManageChildren: (params) => void;
  close: () => void;
  modalProps: { ...propsToSpread };  // Spread onto UnifiedLinkageModal
}
```

**Example Usage:**
```tsx
// Assign parent to child (task → project)
linkageModal.openAssignParent({
  childEntityType: 'task',
  childEntityId: task.id,
  childEntityName: task.name,
  allowedEntityTypes: ['project']  // Only allow project parents
});

// Manage children of parent (project → tasks)
linkageModal.openManageChildren({
  parentEntityType: 'project',
  parentEntityId: project.id,
  parentEntityName: project.name,
  allowedEntityTypes: ['task', 'wiki', 'artifact']  // Restrict child types
});
```

---

## Child Entity Tabs (DynamicChildEntityTabs)

### Overview

Child entity tabs on entity detail pages are configured via the `d_entity.child_entities` JSONB field. This allows dynamic tab generation without code changes.

### Database Configuration

**Table:** `app.d_entity`

```sql
CREATE TABLE app.d_entity (
    id uuid PRIMARY KEY,
    code varchar(50) NOT NULL UNIQUE,
    name varchar(100) NOT NULL,
    ui_label varchar(100),
    ui_icon varchar(50),
    child_entities jsonb,  -- Child tab configuration
    display_order integer,
    active_flag boolean DEFAULT true
);
```

**child_entities Structure:**
```json
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
  },
  {
    "entity": "artifact",
    "ui_icon": "Paperclip",
    "ui_label": "Artifacts",
    "order": 3
  }
]
```

### Frontend Component

**Component:** `DynamicChildEntityTabs`
**Location:** `/apps/web/src/components/shared/tabs/DynamicChildEntityTabs.tsx`

**Usage:**
```tsx
import { DynamicChildEntityTabs } from '@/components/shared/tabs/DynamicChildEntityTabs';

export function EntityDetailPage({ entityType, entityId }) {
  return (
    <div>
      {/* Entity header and overview */}

      <DynamicChildEntityTabs
        entityType={entityType}
        entityId={entityId}
      />
    </div>
  );
}
```

**Behavior:**
1. Fetches entity metadata: `GET /api/v1/entity/type/{entityType}`
2. Reads `child_entities` array from response
3. Generates tabs dynamically based on configuration
4. Each tab fetches child data: `GET /api/v1/{entityType}/{entityId}/{childEntityType}`
5. Displays child entities in table with inline editing

**Example Tab Generation:**

For a `project` entity with `child_entities` config above:
```
┌──────────────────────────────────────────┐
│ Overview │ Tasks (12) │ Wiki (3) │ Artifacts (8) │
└──────────────────────────────────────────┘
```

Each tab shows:
- Entity count badge
- Filterable/sortable data table
- "Add Row" button (opens UnifiedLinkageModal)
- Inline editing capabilities

---

## Code Reusability & Architecture

### Shared Component Pattern

The linkage system follows a **DRY (Don't Repeat Yourself)** architecture with reusable hooks and components:

**Before v3.1.0:**
```typescript
// ❌ DUPLICATE CODE: Each modal had its own entity loading logic
const UnifiedLinkageModal = () => {
  const [entities, setEntities] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const loadEntities = async () => {
    setLoading(true);
    const response = await fetch(`/api/v1/${entityType}`);
    // ... 30+ lines of duplicate code
  };

  const filteredEntities = useMemo(() => {
    // ... 8 lines of duplicate filtering logic
  }, [entities, searchQuery]);

  // Total: ~60 lines of duplicate code per modal
};
```

**After v3.1.0:**
```typescript
// ✅ REUSABLE HOOK: Single source of truth
const UnifiedLinkageModal = () => {
  const {
    filteredInstances: filteredEntities,
    loading,
    searchQuery,
    setSearchQuery
  } = useEntityInstancePicker({
    entityType: selectedEntityType || null,
    enabled: !!selectedEntityType
  });

  // Only 5 lines needed - hook handles the rest!
};
```

### Benefits

**Code Reduction:**
- **Before:** ~136 lines of duplicate code across 2 modals
- **After:** ~72 lines total (62 in hook, 10 in consumers)
- **Savings:** 47% code reduction ✅

**Maintainability:**
- Bug fixes in hook automatically apply to all consumers
- Consistent behavior across all entity pickers
- Single place to add features (pagination, infinite scroll, etc.)

**Reusability:**
- `useEntityInstancePicker` can be used by ANY component needing entity instances
- `EntityInstancePicker` UI component also available for quick integration
- Both used by:
  - UnifiedLinkageModal (parent-child linking)
  - PermissionManagementModal (RBAC permission grants)
  - Future components (entity transfer, bulk operations, etc.)

### Using the Hook in Your Component

```typescript
import { useEntityInstancePicker } from '@/hooks/useEntityInstancePicker';

function MyCustomComponent() {
  const [selectedType, setSelectedType] = useState('project');

  const {
    filteredInstances,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    refresh
  } = useEntityInstancePicker({
    entityType: selectedType,
    enabled: !!selectedType,
    limit: 100
  });

  return (
    <div>
      <select value={selectedType} onChange={e => setSelectedType(e.target.value)}>
        <option value="project">Projects</option>
        <option value="task">Tasks</option>
      </select>

      <input
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="Search..."
      />

      {loading && <div>Loading...</div>}
      {error && <div>Error: {error}</div>}

      <ul>
        {filteredInstances.map(entity => (
          <li key={entity.id}>
            {entity.name} ({entity.code})
          </li>
        ))}
      </ul>

      <button onClick={refresh}>Refresh</button>
    </div>
  );
}
```

### Using the EntityInstancePicker Component

For even faster integration, use the pre-built UI component:

```typescript
import { EntityInstancePicker } from '@/components/shared/EntityInstancePicker';

function QuickIntegration() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <EntityInstancePicker
      entityType="project"
      selectedInstanceId={selectedId}
      onSelect={(id) => setSelectedId(id)}
      showAllOption={true}
      allOptionLabel="All Projects"
      placeholder="Search projects..."
      maxHeight="400px"
    />
  );
}
```

**Features:**
- ✅ Built-in search
- ✅ Loading/error states
- ✅ Click-to-select or button-to-select
- ✅ Optional "All instances" row
- ✅ Responsive design with scroll

---

## Common Use Cases

### Use Case 1: Link Task to Project

**Scenario:** User creates a task and wants to assign it to a project

```bash
# API Call
curl -X POST http://localhost:4000/api/v1/linkage \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parent_entity_type": "project",
    "parent_entity_id": "p1111111-1111-1111-1111-111111111111",
    "child_entity_type": "task",
    "child_entity_id": "a1111111-1111-1111-1111-111111111111",
    "relationship_type": "contains"
  }'
```

**Database Result:**
```sql
SELECT * FROM app.d_entity_instance_link
WHERE parent_entity_id = 'p1111111-1111-1111-1111-111111111111'
  AND child_entity_id = 'a1111111-1111-1111-1111-111111111111';

-- Returns:
-- parent_entity_type: 'project'
-- parent_entity_id: 'p1111111-1111-1111-1111-111111111111'
-- child_entity_type: 'task'
-- child_entity_id: 'a1111111-1111-1111-1111-111111111111'
-- relationship_type: 'contains'
-- active_flag: true
```

### Use Case 2: Get All Tasks in a Project

**Scenario:** Display all tasks belonging to a project

```bash
# API Call
curl -X GET "http://localhost:4000/api/v1/project/p1111111-1111-1111-1111-111111111111/task?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

**Query Execution:**
```sql
SELECT task.*
FROM app.d_task task
INNER JOIN app.d_entity_instance_link link
  ON link.child_entity_type = 'task'
  AND link.child_entity_id = task.id
WHERE link.parent_entity_type = 'project'
  AND link.parent_entity_id = 'p1111111-1111-1111-1111-111111111111'
  AND link.active_flag = true
  AND task.active_flag = true
ORDER BY task.name ASC
LIMIT 20 OFFSET 0;
```

### Use Case 3: Unlink Task from Project

**Scenario:** Remove task from project (soft delete linkage)

```bash
# Get linkage ID
curl -X GET "http://localhost:4000/api/v1/linkage?parent_entity_type=project&parent_entity_id=p1111&child_entity_type=task&child_entity_id=a1111" \
  -H "Authorization: Bearer $TOKEN"

# Delete linkage
curl -X DELETE "http://localhost:4000/api/v1/linkage/linkage-uuid" \
  -H "Authorization: Bearer $TOKEN"
```

**Database Result:**
```sql
UPDATE app.d_entity_instance_link
SET active_flag = false,
    to_ts = now(),
    updated_ts = now()
WHERE id = 'linkage-uuid';
```

### Use Case 4: Multi-Parent Linkage

**Scenario:** Link one task to multiple projects (many-to-many)

```bash
# Link task to Project A
curl -X POST http://localhost:4000/api/v1/linkage \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parent_entity_type": "project",
    "parent_entity_id": "project-a-uuid",
    "child_entity_type": "task",
    "child_entity_id": "task-uuid",
    "relationship_type": "contains"
  }'

# Link same task to Project B
curl -X POST http://localhost:4000/api/v1/linkage \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parent_entity_type": "project",
    "parent_entity_id": "project-b-uuid",
    "child_entity_type": "task",
    "child_entity_id": "task-uuid",
    "relationship_type": "contains"
  }'
```

**Database Result:**
```sql
SELECT * FROM app.d_entity_instance_link
WHERE child_entity_type = 'task'
  AND child_entity_id = 'task-uuid'
  AND active_flag = true;

-- Returns 2 rows:
-- 1. project-a-uuid → task-uuid
-- 2. project-b-uuid → task-uuid
```

---

## Best Practices

### 1. Always Use Linkage Table (No Foreign Keys)

**✅ Correct:**
```sql
-- Store relationship in d_entity_instance_link
INSERT INTO app.d_entity_instance_link
(parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
VALUES ('project', 'proj-uuid', 'task', 'task-uuid');
```

**❌ Incorrect:**
```sql
-- DON'T add foreign key columns to entity tables
ALTER TABLE app.d_task ADD COLUMN project_id uuid REFERENCES app.d_project(id);
```

**Reason:** Foreign keys prevent many-to-many relationships and make schema changes difficult.

### 2. Validate Against d_entity_map

**✅ Correct:**
```typescript
// Check if relationship is valid before creating
const validRelationship = await checkEntityMap('project', 'task');
if (!validRelationship) {
  throw new Error('Invalid parent-child relationship');
}
```

**❌ Incorrect:**
```typescript
// Directly create linkage without validation
await createLinkage('project', projId, 'artifact', artId);  // May fail
```

### 3. Use Soft Deletes

**✅ Correct:**
```sql
-- Soft delete by setting active_flag = false
UPDATE app.d_entity_instance_link
SET active_flag = false, to_ts = now()
WHERE id = 'linkage-uuid';
```

**❌ Incorrect:**
```sql
-- Hard delete removes audit trail
DELETE FROM app.d_entity_instance_link WHERE id = 'linkage-uuid';
```

### 4. Query with RBAC Filtering

**✅ Correct:**
```sql
-- Filter by both linkage and RBAC permissions
SELECT child.*
FROM app.d_task child
INNER JOIN app.d_entity_instance_link link ON link.child_entity_id = child.id
INNER JOIN app.d_entity_rbac rbac ON rbac.entity = 'task'
WHERE link.parent_entity_id = $1
  AND link.active_flag = true
  AND rbac.empid = $2
  AND 0 = ANY(rbac.permission);  -- View permission
```

**❌ Incorrect:**
```sql
-- No RBAC check - exposes unauthorized data
SELECT child.*
FROM app.d_task child
INNER JOIN app.d_entity_instance_link link ON link.child_entity_id = child.id
WHERE link.parent_entity_id = $1;
```

### 5. Provide onLinkageChange Callback

**✅ Correct:**
```tsx
const linkageModal = useLinkageModal({
  onLinkageChange: () => {
    refetchChildEntities();
    updateTabBadges();
  }
});
```

**❌ Incorrect:**
```tsx
// No callback - UI won't update after linkage changes
const linkageModal = useLinkageModal();
```

---

## Troubleshooting

### Issue: "No valid parent/child types available"

**Cause:** Missing type-level relationship in `d_entity_map`

**Solution:**
```sql
-- Add valid relationship
INSERT INTO app.d_entity_map (parent_entity_type, child_entity_type)
VALUES ('your_parent_type', 'your_child_type');

-- Verify
SELECT * FROM app.d_entity_map
WHERE parent_entity_type = 'your_parent_type'
  AND child_entity_type = 'your_child_type';
```

### Issue: "Failed to create link" (403 Forbidden)

**Cause:** User lacks RBAC permissions

**Solution:**
```sql
-- Check current permissions
SELECT * FROM app.d_entity_rbac
WHERE empid = 'user-uuid'
  AND entity IN ('parent_type', 'child_type');

-- Grant edit permission [1] on both entities
INSERT INTO app.d_entity_rbac (empid, entity, entity_id, permission)
VALUES
  ('user-uuid', 'project', 'all', ARRAY[0,1,2,3,4,5]),
  ('user-uuid', 'task', 'all', ARRAY[0,1,2,3,4,5]);
```

### Issue: Child entities not appearing in tabs

**Cause:** Missing configuration in `d_entity.child_entities`

**Solution:**
```sql
-- Check current child_entities config
SELECT code, child_entities FROM app.d_entity WHERE code = 'project';

-- Add child entity configuration
UPDATE app.d_entity
SET child_entities = '[
  {"entity": "task", "ui_icon": "CheckSquare", "ui_label": "Tasks", "order": 1},
  {"entity": "wiki", "ui_icon": "FileText", "ui_label": "Wiki", "order": 2}
]'::jsonb
WHERE code = 'project';
```

### Issue: Duplicate linkage error

**Cause:** UNIQUE constraint on (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)

**Solution:**
```sql
-- Check existing linkage
SELECT * FROM app.d_entity_instance_link
WHERE parent_entity_type = 'project'
  AND parent_entity_id = 'proj-uuid'
  AND child_entity_type = 'task'
  AND child_entity_id = 'task-uuid';

-- If active_flag = false, reactivate it
UPDATE app.d_entity_instance_link
SET active_flag = true, from_ts = now(), updated_ts = now()
WHERE id = 'existing-linkage-uuid';
```

### Issue: Query returns empty results despite linkages existing

**Cause:** RBAC filtering or inactive linkages

**Solution:**
```sql
-- Check linkage status
SELECT * FROM app.d_entity_instance_link
WHERE parent_entity_id = 'parent-uuid'
  AND child_entity_type = 'child-type';

-- Verify RBAC permissions
SELECT * FROM app.d_entity_rbac
WHERE empid = 'user-uuid'
  AND entity = 'child-type';

-- Check if entities are active
SELECT id, name, active_flag FROM app.d_child_type
WHERE id IN (SELECT child_entity_id FROM app.d_entity_instance_link WHERE parent_entity_id = 'parent-uuid');
```

---

## Testing

### Unit Test: Create Linkage

```bash
# Test valid linkage creation
./tools/test-api.sh POST /api/v1/linkage '{
  "parent_entity_type": "project",
  "parent_entity_id": "p1111111-1111-1111-1111-111111111111",
  "child_entity_type": "task",
  "child_entity_id": "a1111111-1111-1111-1111-111111111111",
  "relationship_type": "contains"
}'

# Expected: 201 Created
```

### Unit Test: Query Child Entities

```bash
# Test filtered child query
./tools/test-api.sh GET /api/v1/project/p1111111-1111-1111-1111-111111111111/task

# Expected: 200 OK with task array
```

### Unit Test: Delete Linkage

```bash
# Get linkage ID first
LINKAGE_ID=$(./tools/test-api.sh GET /api/v1/linkage?parent_entity_type=project | jq -r '.data[0].id')

# Delete linkage
./tools/test-api.sh DELETE /api/v1/linkage/$LINKAGE_ID

# Expected: 200 OK
```

### Integration Test: End-to-End Linkage Flow

```bash
# 1. Create project
PROJECT_ID=$(./tools/test-api.sh POST /api/v1/project '{"name":"Test Project","code":"PROJ001"}' | jq -r '.data.id')

# 2. Create task
TASK_ID=$(./tools/test-api.sh POST /api/v1/task '{"name":"Test Task","code":"TASK001"}' | jq -r '.data.id')

# 3. Link task to project
./tools/test-api.sh POST /api/v1/linkage "{
  \"parent_entity_type\": \"project\",
  \"parent_entity_id\": \"$PROJECT_ID\",
  \"child_entity_type\": \"task\",
  \"child_entity_id\": \"$TASK_ID\"
}"

# 4. Verify linkage
./tools/test-api.sh GET /api/v1/project/$PROJECT_ID/task

# 5. Cleanup
./tools/test-api.sh DELETE /api/v1/linkage/$(./tools/test-api.sh GET /api/v1/linkage?parent_entity_id=$PROJECT_ID | jq -r '.data[0].id')
```

---

## Migration from Foreign Keys

### Before (Foreign Key Pattern)

```sql
-- Old schema with foreign keys
CREATE TABLE app.d_task (
    id uuid PRIMARY KEY,
    name varchar(200),
    project_id uuid REFERENCES app.d_project(id),  -- ❌ Foreign key
    active_flag boolean
);

-- Query tasks in project
SELECT * FROM app.d_task WHERE project_id = 'proj-uuid';
```

### After (Linkage Pattern)

```sql
-- New schema without foreign keys
CREATE TABLE app.d_task (
    id uuid PRIMARY KEY,
    name varchar(200),
    -- NO project_id column
    active_flag boolean
);

-- Query tasks in project (via linkage)
SELECT task.*
FROM app.d_task task
INNER JOIN app.d_entity_instance_link link
  ON link.child_entity_type = 'task'
  AND link.child_entity_id = task.id
WHERE link.parent_entity_type = 'project'
  AND link.parent_entity_id = 'proj-uuid'
  AND link.active_flag = true;
```

### Migration Steps

1. **Add linkage table entries:**
```sql
INSERT INTO app.d_entity_instance_link
(parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
SELECT 'project', project_id, 'task', id
FROM app.d_task
WHERE project_id IS NOT NULL;
```

2. **Update API queries to use linkage:**
```typescript
// Before
const tasks = await db.query('SELECT * FROM app.d_task WHERE project_id = $1', [projectId]);

// After
const tasks = await db.query(`
  SELECT task.*
  FROM app.d_task task
  INNER JOIN app.d_entity_instance_link link
    ON link.child_entity_id = task.id
  WHERE link.parent_entity_type = 'project'
    AND link.parent_entity_id = $1
    AND link.active_flag = true
`, [projectId]);
```

3. **Drop foreign key column:**
```sql
ALTER TABLE app.d_task DROP COLUMN project_id;
```

---

## Quick Reference

### Create Linkage
```bash
POST /api/v1/linkage
{
  "parent_entity_type": "project",
  "parent_entity_id": "uuid",
  "child_entity_type": "task",
  "child_entity_id": "uuid"
}
```

### Get Child Entities
```bash
GET /api/v1/project/{projectId}/task?page=1&limit=20
```

### Delete Linkage
```bash
DELETE /api/v1/linkage/{linkageId}
```

### Check Valid Relationships
```bash
GET /api/v1/linkage/children/project  # Returns: ["task","wiki","artifact"]
GET /api/v1/linkage/parents/task      # Returns: ["project","worksite"]
```

---

## Support

**Documentation:** `/docs/linkage/UnifiedLinkageSystem.md`
**API Docs:** `http://localhost:4000/docs`
**Test Script:** `./tools/test-api.sh`
**Database Import:** `./tools/db-import.sh`

**Related Docs:**
- Entity System: `/docs/entity_design_pattern/universal_entity_system.md`
- RBAC System: `/docs/datamodel/datamodel.md`
- API Architecture: `/docs/entity_ui_ux_route_api.md`
- Database Schema: `/db/README.md`

**Key Tables:**
- `app.d_entity_map` - Type-level relationships (DDL: `db/29_d_entity_map.ddl`)
- `app.d_entity_instance_link` - Instance-level linkages (DDL: `db/33_d_entity_instance_link.ddl`)
- `app.d_entity_rbac` - RBAC permissions (DDL: `db/32_d_entity_rbac.ddl`)

---

**Last Updated:** 2025-11-15
**Version:** 3.1.0
**Status:** ✅ Production Ready (Refactored)

**Key Changes in v3.1.0:**
- ✅ **Major Refactor:** Extracted `useEntityInstancePicker` reusable hook
- ✅ **Code Reduction:** Removed ~60 lines of duplicate code from UnifiedLinkageModal
- ✅ **Reusability:** Same hook used by PermissionManagementModal and UnifiedLinkageModal
- ✅ **DRY Principle:** Single source of truth for entity instance loading
- ✅ **Improved Maintainability:** Bug fixes in hook apply to all consumers
- ✅ **Better Performance:** Optimized filtering and memoization in shared hook
- ✅ **Documentation Update:** Reflects current refactored architecture

**Key Changes in v3.0.0:**
- Complete rewrite focusing on current production architecture
- Removed outdated modal UI sections (no longer accurate)
- Emphasized NO foreign keys pattern (all relationships via d_entity_instance_link)
- Simplified to focus on API usage and database patterns
- Removed deprecated v2.x features and components
- Added comprehensive RBAC integration section
- Added migration guide from foreign key pattern
- Enhanced troubleshooting and testing sections
