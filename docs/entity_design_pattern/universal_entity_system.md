# Universal Entity System - Complete Design Pattern Documentation

> **Comprehensive guide to the PMO Platform's universal entity architecture** - DRY-first, config-driven system handling 18+ entity types with 3 universal pages

**Last Updated:** 2025-11-04
**Version:** 3.0.0
**Related Docs:** [UI/UX Architecture](../ui_ux_route_api.md), [Data Model](../datamodel.md)

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Three Universal Pages](#three-universal-pages)
3. [Create-Link-Edit Pattern](#create-link-edit-pattern)
4. [Entity Configuration System](#entity-configuration-system)
5. [Navigation & Routing](#navigation--routing)
6. [Share & Link Modals](#share--link-modals)
7. [Inline Editing System](#inline-editing-system)
8. [Technical Implementation](#technical-implementation)
9. [API Integration](#api-integration)
10. [Best Practices](#best-practices)

---

## System Overview

### Core Philosophy

The PMO Platform uses a **DRY-first, config-driven architecture** where:
- **3 universal pages** handle ALL entity operations (list, detail, create)
- **1 configuration file** defines entity behavior (`entityConfig.ts`)
- **Zero duplication** - write once, works for all 18+ entity types
- **Convention over configuration** - smart defaults with entity-specific overrides

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Entity Configuration                      │
│                   (entityConfig.ts)                         │
│  Defines: columns, fields, views, relationships             │
└───────────────────┬─────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌───────────────┐       ┌──────────────┐
│ EntityMainPage│       │EntityDetailPage│
│  (List View)  │◄─────►│  (Detail View) │
└───────┬───────┘       └───────┬────────┘
        │                       │
        │                       ├──► Share Modal
        │                       ├──► Link Modal
        │                       └──► Child Tabs
        │                               │
        ▼                               ▼
┌──────────────────┐         ┌──────────────────┐
│ EntityCreatePage │         │EntityChildListPage│
│  (Create Form)   │         │   (Child Tabs)    │
└──────────────────┘         └──────────────────┘
```

### Key Statistics

| Metric | Count | Savings |
|--------|-------|---------|
| **Entity Types** | 18+ | - |
| **Universal Pages** | 3 | vs 54 (18×3) separate pages |
| **Configuration Files** | 1 | Single source of truth |
| **Code Reuse** | 95%+ | Massive reduction in duplication |
| **Lines of Code** | ~12,000 | vs ~50,000+ without DRY |

---

## Three Universal Pages

### 1. EntityMainPage - List View

**Purpose:** Display entity lists with table/kanban/grid views

**URL Pattern:** `/{entityType}`

**Examples:**
- `/project` - List all projects
- `/task` - List all tasks
- `/form` - List all forms

**Features:**
- ✅ Table view with sorting, filtering, pagination
- ✅ Kanban view (drag-drop, column grouping)
- ✅ Grid view (card layout)
- ✅ Search bar
- ✅ Create button → navigates to EntityCreatePage
- ✅ Row click → navigates to EntityDetailPage
- ✅ Bulk operations (share, delete)
- ✅ View mode persistence (localStorage)

**Code Location:** `apps/web/src/pages/shared/EntityMainPage.tsx`

---

### 2. EntityDetailPage - Detail View

**Purpose:** Display single entity details with child tabs

**URL Pattern:** `/{entityType}/{id}`

**Examples:**
- `/project/abc123` - Project detail page
- `/task/def456` - Task detail page
- `/form/ghi789` - Form detail page

**Features:**
- ✅ Sticky header with metadata (name, code, ID)
- ✅ Copy-to-clipboard for all header fields
- ✅ Inline editing mode
- ✅ Action buttons (Edit, Share, Link, Delete)
- ✅ Dynamic child entity tabs
- ✅ Overview tab (entity fields)
- ✅ Child tabs (tasks, wiki, artifacts, etc.)
- ✅ Entity-specific renderers (wiki content, form preview)
- ✅ File preview (artifacts, cost, revenue)
- ✅ Navigation history tracking

**Code Location:** `apps/web/src/pages/shared/EntityDetailPage.tsx`

---

### 3. EntityCreatePage - Create Form

**Purpose:** Create new entities with full form

**URL Pattern:** `/{entityType}/new`

**Examples:**
- `/project/new` - Create new project
- `/task/new` - Create new task
- `/artifact/new` - Upload new artifact

**Features:**
- ✅ Dynamic form generation from config
- ✅ Field validation (required, types)
- ✅ Settings-driven dropdowns
- ✅ File upload (artifacts, cost, revenue)
- ✅ Parent context handling (when creating from child tab)
- ✅ Auto-linkage to parent entity
- ✅ Success navigation (detail or parent page)

**Code Location:** `apps/web/src/pages/shared/EntityCreatePage.tsx`

---

## Create-Link-Edit Pattern

### Overview

**Universal pattern for creating child entities from parent detail pages**

### User Flow

```
1. User on Task Detail Page
   URL: /task/f1111111-1111-1111-1111-111111111111

2. User clicks "Forms" tab
   Shows: List of forms linked to this task

3. User clicks "Create Form" button
   ↓
4. System creates draft form with defaults
   POST /api/v1/form { name: "Untitled Form", ... }
   ↓
5. System links form to task
   POST /api/v1/linkage { parent: task, child: form, ... }
   ↓
6. System navigates to appropriate edit view
   - Form → /form/{id}/edit (FormEditPage)
   - Wiki → /wiki/{id}/edit (WikiEditorPage)
   - Standard → /{entity}/{id} (auto-edit mode)
```

### Implementation

**File:** `apps/web/src/pages/shared/EntityChildListPage.tsx`

```typescript
const handleCreateClick = async () => {
  // Entities requiring full create page (file uploads)
  const requiresFullCreatePage = ['artifact', 'cost', 'revenue'];

  if (requiresFullCreatePage.includes(childType)) {
    navigate(`/${childType}/new`, {
      state: { parentType, parentId, returnTo: `/${parentType}/${parentId}/${childType}` }
    });
    return;
  }

  try {
    setLoading(true);
    const token = localStorage.getItem('auth_token');

    // STEP 1: Create child entity with minimal/empty data
    let createPayload: any;

    if (childType === 'form') {
      createPayload = {
        name: 'Untitled Form',
        descr: '',
        form_type: 'multi_step',
        form_schema: { steps: [] },
        approval_status: 'draft'
      };
    } else if (childType === 'wiki') {
      createPayload = {
        name: 'Untitled Wiki Page',
        descr: '',
        content_md: '',
        publication_status: 'draft'
      };
    } else {
      // Standard entities
      createPayload = {
        name: 'Untitled',
        code: `${childType.toUpperCase()}-${Date.now()}`,
        descr: '',
        metadata: {}
      };
    }

    const createResponse = await fetch(`${API_BASE_URL}/api/v1/${childType}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(createPayload)
    });

    if (!createResponse.ok) {
      throw new Error('Failed to create entity');
    }

    const newEntity = await createResponse.json();
    const newEntityId = newEntity.id;

    // STEP 2: Create parent-child linkage
    const linkageResponse = await fetch(`${API_BASE_URL}/api/v1/linkage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        parent_entity_type: parentType,
        parent_entity_id: parentId,
        child_entity_type: childType,
        child_entity_id: newEntityId,
        relationship_type: 'contains'
      })
    });

    if (!linkageResponse.ok) {
      console.error('Linkage creation failed, but entity created');
    } else {
      console.log(`✅ Created and linked ${childType} to ${parentType}`);
    }

    // STEP 3: Redirect to appropriate edit/detail page
    if (childType === 'form') {
      navigate(`/form/${newEntityId}/edit`);
    } else if (childType === 'wiki') {
      navigate(`/wiki/${newEntityId}/edit`);
    } else {
      navigate(`/${childType}/${newEntityId}`, { state: { autoEdit: true } });
    }

  } catch (err) {
    console.error(`Failed to create ${childType}:`, err);
    alert(err instanceof Error ? err.message : `Failed to create ${childType}`);
  } finally {
    setLoading(false);
  }
};
```

### Entity-Specific Behavior

| Entity Type | Create Payload | Edit Destination | Notes |
|------------|----------------|------------------|-------|
| **Form** | `{ name, form_schema: { steps: [] }, approval_status: 'draft' }` | `/form/{id}/edit` | Opens form designer |
| **Wiki** | `{ name, content_md: '', publication_status: 'draft' }` | `/wiki/{id}/edit` | Opens markdown editor |
| **Task** | `{ name: 'Untitled', code, descr: '' }` | `/{entity}/{id}` (auto-edit) | Detail page in edit mode |
| **Project** | `{ name: 'Untitled', code, descr: '' }` | `/{entity}/{id}` (auto-edit) | Detail page in edit mode |
| **Artifact** | Navigate to create page | `/artifact/new` | Requires file upload |
| **Cost** | Navigate to create page | `/cost/new` | Requires invoice upload |
| **Revenue** | Navigate to create page | `/revenue/new` | Requires receipt upload |

### Key Benefits

✅ **Universal** - Works for all entity types
✅ **Reusable** - Single implementation in EntityChildListPage
✅ **DRY** - No code duplication
✅ **Entity-Aware** - Respects each entity's unique requirements
✅ **Clean** - Special pages (FormBuilderPage, WikiEditorPage) remain unchanged
✅ **Automatic Linking** - Parent-child relationships created automatically
✅ **Type-Safe** - TypeScript validation

---

## Entity Configuration System

### Configuration File

**Location:** `apps/web/src/lib/entityConfig.ts`

**Purpose:** Single source of truth for entity metadata, fields, views, relationships

### Configuration Structure

```typescript
export interface EntityConfig {
  name: string;                    // Internal name (singular)
  displayName: string;             // UI display name (singular)
  pluralName: string;              // Plural form
  apiEndpoint: string;             // API base path
  icon?: React.ComponentType;      // Lucide icon

  // Table view
  columns: ColumnDef[];            // Table columns

  // Form view
  fields: FieldDef[];              // Editable fields

  // View modes
  supportedViews: ViewMode[];      // ['table', 'kanban', 'grid']
  defaultView: ViewMode;           // Default view mode

  // Kanban configuration
  kanban?: {
    groupByField: string;          // Field to group by
    settingsCategory?: string;     // Settings table for columns
  };

  // Grid configuration
  grid?: {
    cardFields: string[];          // Fields to show on cards
    imageField?: string;           // Optional image field
  };

  // Child entities (for detail page tabs)
  childEntities?: string[];        // Array of child entity types
}
```

### Example Configuration

```typescript
export const entityConfigs: Record<string, EntityConfig> = {
  task: {
    name: 'task',
    displayName: 'Task',
    pluralName: 'Tasks',
    apiEndpoint: '/api/v1/task',
    icon: CheckSquare,

    columns: [
      { key: 'name', title: 'Task Name', sortable: true },
      { key: 'task_stage', title: 'Stage', loadOptionsFromSettings: true },
      { key: 'task_priority', title: 'Priority', loadOptionsFromSettings: true },
      { key: 'start_date', title: 'Start Date', sortable: true },
      { key: 'end_date', title: 'Due Date', sortable: true }
    ],

    fields: [
      { key: 'name', label: 'Task Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'task_stage', label: 'Stage', type: 'select', loadOptionsFromSettings: 'task_stage' },
      { key: 'task_priority', label: 'Priority', type: 'select', loadOptionsFromSettings: 'task_priority' },
      { key: 'start_date', label: 'Start Date', type: 'date' },
      { key: 'end_date', label: 'Due Date', type: 'date' },
      { key: 'assignee_employee_ids', label: 'Assignees', type: 'multiselect', loadOptionsFromAPI: 'employee' }
    ],

    supportedViews: ['table', 'kanban', 'grid'],
    defaultView: 'table',

    kanban: {
      groupByField: 'task_stage',
      settingsCategory: 'task_stage'
    },

    grid: {
      cardFields: ['name', 'descr', 'task_stage', 'task_priority'],
      imageField: undefined
    },

    childEntities: ['form', 'artifact']
  }
};
```

### Usage in Components

```typescript
// Get entity configuration
import { getEntityConfig } from '../../lib/entityConfig';

const config = getEntityConfig(entityType);

// Use configuration
<h1>{config.displayName}</h1>
<DataTable columns={config.columns} />
<EntityForm fields={config.fields} />
```

---

## Navigation & Routing

### Route Structure

**Auto-Generated Routes** (from App.tsx):

```typescript
const coreEntities = [
  'biz', 'office', 'project', 'task', 'employee', 'role', 'worksite',
  'cust', 'position', 'service', 'product', 'quote', 'work_order',
  'inventory', 'order', 'invoice', 'shipment', 'cost', 'revenue'
];

// For each entity, generate:
<Fragment key={entityType}>
  {/* List Route */}
  <Route
    path={`/${entityType}`}
    element={<EntityMainPage entityType={entityType} />}
  />

  {/* Create Route */}
  <Route
    path={`/${entityType}/new`}
    element={<EntityCreatePage entityType={entityType} />}
  />

  {/* Detail Route with Child Entity Routes */}
  <Route
    path={`/${entityType}/:id`}
    element={<EntityDetailPage entityType={entityType} />}
  >
    {/* Wildcard route for any child entity type */}
    <Route
      path=":childType"
      element={<EntityChildListPage parentType={entityType} />}
    />
  </Route>
</Fragment>
```

### Special Routes (Custom Pages)

**Form Entity:**
```typescript
<Route path="/form" element={<EntityMainPage entityType="form" />} />
<Route path="/form/new" element={<FormBuilderPage />} />
<Route path="/form/:id" element={<EntityDetailPage entityType="form" />} />
<Route path="/form/:id/edit" element={<FormEditPage />} />
```

**Wiki Entity:**
```typescript
<Route path="/wiki" element={<EntityMainPage entityType="wiki" />} />
<Route path="/wiki/new" element={<WikiEditorPage />} />
<Route path="/wiki/:id" element={<EntityDetailPage entityType="wiki" />} />
<Route path="/wiki/:id/edit" element={<WikiEditorPage />} />
```

**Artifact Entity:**
```typescript
<Route path="/artifact" element={<EntityMainPage entityType="artifact" />} />
<Route path="/artifact/new" element={<EntityCreatePage entityType="artifact" />} />
<Route path="/artifact/:id" element={<EntityDetailPage entityType="artifact" />} />
```

### Navigation Examples

```typescript
// Navigate to entity list
navigate('/project');

// Navigate to entity detail
navigate(`/project/${projectId}`);

// Navigate to child tab
navigate(`/project/${projectId}/task`);

// Navigate to create page
navigate('/project/new');

// Navigate to create page with parent context
navigate('/form/new', {
  state: {
    parentType: 'task',
    parentId: taskId,
    returnTo: `/task/${taskId}/form`
  }
});

// Navigate to detail with auto-edit
navigate(`/task/${taskId}`, { state: { autoEdit: true } });
```

---

## Share & Link Modals

### Share Modal

**Purpose:** Share entities with users, roles, or generate public links

**Features:**
- ✅ Share with specific users
- ✅ Share with specific roles
- ✅ Generate public shareable link
- ✅ Copy link to clipboard
- ✅ Universal (works for all entity types)

**Usage:**
```typescript
<ShareModal
  isOpen={isShareModalOpen}
  onClose={() => setIsShareModalOpen(false)}
  entityType={entityType}
  entityId={id}
  entityName={data?.name || data?.title}
  currentSharedUrl={data?.shared_url}
  onShare={async (shareData) => {
    if (shareData.shareType === 'public') {
      // Generate public URL
    } else if (shareData.shareType === 'users') {
      // Grant permissions to users
    } else if (shareData.shareType === 'roles') {
      // Grant permissions to roles
    }
  }}
/>
```

**Code Location:** `apps/web/src/components/shared/modal/ShareModal.tsx`

---

### Link Modal (Unified Linkage Modal)

**Purpose:** Manage entity relationships (parent-child links)

**Features:**
- ✅ View existing links
- ✅ Unlink entities
- ✅ Search and link to new parents
- ✅ Support for multiple parent types
- ✅ Real-time link updates
- ✅ Entity preview on hover

**Usage:**
```typescript
const linkageModal = useLinkageModal({
  onLinkageChange: () => {
    // Refetch entity data
    loadData();
  }
});

// Open modal to assign parent
<button
  onClick={() => linkageModal.openAssignParent({
    childEntityType: entityType,
    childEntityId: id,
    childEntityName: data?.name || data?.title
  })}
>
  Manage links
</button>

// Modal component
<UnifiedLinkageModal {...linkageModal.modalProps} />
```

**Code Location:** `apps/web/src/components/shared/modal/UnifiedLinkageModal.tsx`

---

## Inline Editing System

### Convention Over Configuration

**v2.3 Enhancement:** Auto-detection of editable fields by naming patterns

**Zero Manual Configuration:**
- ❌ No `inlineEditable` flags in entityConfig
- ✅ Auto-detects editable fields by suffix patterns
- ✅ Bidirectional data transformers
- ✅ Settings-driven dropdowns

### Field Detection Patterns

**File:** `apps/web/src/lib/fieldCapabilities.ts`

```typescript
// Auto-detect if field is editable based on naming conventions
export function isFieldInlineEditable(fieldKey: string): boolean {
  const editableSuffixes = [
    '_stage',      // task_stage, project_stage
    '_status',     // client_status, publication_status
    '_priority',   // task_priority
    '_type',       // task_update_type
    '_level',      // office_level, business_level
    '_tier',       // customer_tier
    '_funnel_level', // opportunity_funnel_level
    '_channel',    // acquisition_channel
    '_sector',     // industry_sector
    '_code',       // color_code
    '_tags'        // tags field (array type)
  ];

  return editableSuffixes.some(suffix => fieldKey.endsWith(suffix));
}

// Transform display value to API format
export function transformValueForAPI(value: any, fieldKey: string): any {
  if (fieldKey.endsWith('_tags')) {
    // Tags: "tag1, tag2, tag3" → ["tag1", "tag2", "tag3"]
    if (typeof value === 'string') {
      return value.split(',').map(t => t.trim()).filter(Boolean);
    }
  }
  return value;
}

// Transform API value to display format
export function transformValueForDisplay(value: any, fieldKey: string): any {
  if (fieldKey.endsWith('_tags')) {
    // Tags: ["tag1", "tag2", "tag3"] → "tag1, tag2, tag3"
    if (Array.isArray(value)) {
      return value.join(', ');
    }
  }
  return value;
}
```

### Inline Edit Flow

```typescript
// 1. User clicks cell in table
<td onClick={() => handleCellClick(record.id, column.key)}>
  {renderCellContent(record, column)}
</td>

// 2. Cell enters edit mode (dropdown or text input)
{isEditing ? (
  <select
    value={editValue}
    onChange={(e) => setEditValue(e.target.value)}
    onBlur={handleSave}
  >
    {options.map(opt => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
) : (
  <span>{displayValue}</span>
)}

// 3. On blur or Enter, save to API
const handleSave = async () => {
  const transformedValue = transformValueForAPI(editValue, fieldKey);
  await api.update(entityId, { [fieldKey]: transformedValue });
  setIsEditing(false);
  refreshData();
};
```

### Supported Field Types

| Field Pattern | Input Type | Example | Transform |
|--------------|------------|---------|-----------|
| `*_stage` | Dropdown | `task_stage` | Settings lookup |
| `*_status` | Dropdown | `client_status` | Settings lookup |
| `*_priority` | Dropdown | `task_priority` | Settings lookup |
| `*_tags` | Text input | `tags` | String ↔ Array |
| `*_code` | Dropdown | `color_code` | Static options |

---

## Technical Implementation

### Component File Structure

```
apps/web/src/
├── pages/
│   ├── shared/
│   │   ├── EntityMainPage.tsx           # List view
│   │   ├── EntityDetailPage.tsx         # Detail view
│   │   ├── EntityChildListPage.tsx      # Child tabs
│   │   └── EntityCreatePage.tsx         # Create form
│   ├── form/
│   │   ├── FormBuilderPage.tsx          # Form designer (create)
│   │   └── FormEditPage.tsx             # Form designer (edit)
│   └── wiki/
│       └── WikiEditorPage.tsx           # Wiki markdown editor
├── components/
│   ├── shared/
│   │   ├── entity/
│   │   │   ├── EntityFormContainer.tsx  # Form field renderer
│   │   │   ├── DynamicChildEntityTabs.tsx # Tab navigation
│   │   │   ├── MetadataField.tsx        # Header field component
│   │   │   ├── MetadataRow.tsx          # Header row component
│   │   │   └── MetadataSeparator.tsx    # Header separator
│   │   ├── modal/
│   │   │   ├── Modal.tsx                # Base modal
│   │   │   ├── ShareModal.tsx           # Share functionality
│   │   │   └── UnifiedLinkageModal.tsx  # Link management
│   │   ├── table/
│   │   │   ├── DataTable.tsx            # Universal data table
│   │   │   └── FilteredDataTable.tsx    # Table with filters
│   │   ├── ui/
│   │   │   ├── KanbanView.tsx           # Kanban board
│   │   │   ├── GridView.tsx             # Grid cards
│   │   │   └── ViewSwitcher.tsx         # View mode toggle
│   │   └── preview/
│   │       ├── FilePreview.tsx          # File preview
│   │       └── DragDropFileUpload.tsx   # File upload
│   └── entity/
│       ├── form/
│       │   ├── FormDesigner.tsx         # Form builder UI
│       │   ├── InteractiveForm.tsx      # Form submission
│       │   └── FormDataTable.tsx        # Submission viewer
│       ├── wiki/
│       │   └── WikiContentRenderer.tsx  # Markdown renderer
│       └── task/
│           └── TaskDataContainer.tsx    # Task updates
└── lib/
    ├── entityConfig.ts                  # Entity configurations
    ├── fieldCapabilities.ts             # Inline edit detection
    ├── settingsConfig.ts                # Settings registry
    ├── settingsLoader.ts                # Settings API loader
    ├── columnGenerator.ts               # Dynamic columns
    ├── fieldGenerator.ts                # Dynamic fields
    ├── api.ts                           # API factory
    └── hooks/
        ├── useViewMode.ts               # View persistence
        ├── useLinkageModal.ts           # Linkage modal hook
        └── useS3Upload.ts               # File upload hook
```

### State Management

**No Redux/MobX - Using React Hooks:**

```typescript
// Entity data
const [data, setData] = useState<any>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

// Edit mode
const [isEditing, setIsEditing] = useState(false);
const [editedData, setEditedData] = useState<any>({});

// Modal state
const [isShareModalOpen, setIsShareModalOpen] = useState(false);
const linkageModal = useLinkageModal({ onLinkageChange: loadData });

// View mode (persisted to localStorage)
const [view, setView] = useViewMode(`${entityType}_view`);

// Settings (context)
const { getOptions } = useSettings();
```

### Data Loading Pattern

```typescript
// Load entity data
const loadData = async () => {
  try {
    setLoading(true);
    setError(null);

    const api = APIFactory.getAPI(entityType);
    const response = await api.get(id);

    setData(response.data || response);
    setEditedData(response.data || response);
  } catch (err) {
    console.error(`Failed to load ${entityType}:`, err);
    setError(err instanceof Error ? err.message : 'Failed to load data');
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  if (id) {
    loadData();
  }
}, [id, entityType]);
```

### Save Pattern

```typescript
const handleSave = async () => {
  try {
    // Normalize data (e.g., date formatting)
    const normalizedData = normalizeEntityData(editedData, config);

    // Update via API
    const api = APIFactory.getAPI(entityType);
    await api.update(id, normalizedData);

    // Reload data
    const updatedData = await api.get(id);
    setData(updatedData);
    setEditedData(updatedData);
    setIsEditing(false);
  } catch (err) {
    console.error(`Failed to update ${entityType}:`, err);
    alert(err instanceof Error ? err.message : 'Failed to update');
  }
};
```

---

## API Integration

### API Factory Pattern

**File:** `apps/web/src/lib/api.ts`

```typescript
// Type-safe API factory
export class APIFactory {
  static getAPI(entityType: string): BaseEntityAPI {
    switch (entityType) {
      case 'project': return projectApi;
      case 'task': return taskApi;
      case 'form': return formApi;
      case 'wiki': return wikiApi;
      // ... other entities
      default: return genericEntityApi(entityType);
    }
  }
}

// Base API interface
interface BaseEntityAPI {
  list(params?: ListParams): Promise<ListResponse>;
  get(id: string): Promise<Entity>;
  create(data: Partial<Entity>): Promise<Entity>;
  update(id: string, data: Partial<Entity>): Promise<Entity>;
  delete(id: string): Promise<void>;
}

// Usage
const api = APIFactory.getAPI('project');
const projects = await api.list({ page: 1, pageSize: 20 });
const project = await api.get(projectId);
const created = await api.create({ name: 'New Project' });
await api.update(projectId, { name: 'Updated Name' });
await api.delete(projectId);
```

### Endpoints Used

| Endpoint | Method | Purpose | Component |
|----------|--------|---------|-----------|
| `/api/v1/{entity}` | GET | List entities | EntityMainPage |
| `/api/v1/{entity}` | POST | Create entity | EntityCreatePage, EntityChildListPage |
| `/api/v1/{entity}/{id}` | GET | Get entity | EntityDetailPage |
| `/api/v1/{entity}/{id}` | PUT | Update entity | EntityDetailPage |
| `/api/v1/{entity}/{id}` | DELETE | Delete entity | EntityDetailPage |
| `/api/v1/linkage` | GET | Get links | UnifiedLinkageModal |
| `/api/v1/linkage` | POST | Create link | EntityCreatePage, EntityChildListPage |
| `/api/v1/linkage/{id}` | DELETE | Delete link | UnifiedLinkageModal |
| `/api/v1/entity/child-tabs/{type}/{id}` | GET | Get child tabs | DynamicChildEntityTabs |
| `/api/v1/setting?category={cat}` | GET | Get settings | settingsLoader |
| `/api/v1/{entity}/{id}/share-url` | POST | Generate share URL | ShareModal |
| `/api/v1/artifact/{id}/preview` | GET | Get preview URL | FilePreview |
| `/api/v1/artifact/{id}/download` | GET | Get download URL | EntityDetailPage |

---

## Best Practices

### 1. Adding a New Entity Type

**Step 1:** Add configuration to `entityConfig.ts`
```typescript
export const entityConfigs: Record<string, EntityConfig> = {
  // ... existing configs

  my_entity: {
    name: 'my_entity',
    displayName: 'My Entity',
    pluralName: 'My Entities',
    apiEndpoint: '/api/v1/my_entity',
    icon: MyIcon,

    columns: [
      { key: 'name', title: 'Name', sortable: true },
      { key: 'status', title: 'Status', loadOptionsFromSettings: true }
    ],

    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'status', label: 'Status', type: 'select', loadOptionsFromSettings: 'my_entity_status' }
    ],

    supportedViews: ['table', 'kanban'],
    defaultView: 'table',

    kanban: {
      groupByField: 'status',
      settingsCategory: 'my_entity_status'
    }
  }
};
```

**Step 2:** Add to core entities list in `App.tsx`
```typescript
const coreEntities = [
  // ... existing entities
  'my_entity'
];
```

**Step 3:** Create backend API module
```bash
# Create module at apps/api/src/modules/my_entity/
```

**Step 4:** Create database table
```sql
-- Create DDL file at db/XX_d_my_entity.ddl
CREATE TABLE app.d_my_entity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  descr TEXT,
  status VARCHAR(100),
  created_ts TIMESTAMPTZ DEFAULT NOW(),
  updated_ts TIMESTAMPTZ DEFAULT NOW()
);
```

**That's it!** All universal pages now work for `my_entity`:
- `/my_entity` - List page ✅
- `/my_entity/new` - Create page ✅
- `/my_entity/{id}` - Detail page ✅
- `/my_entity/{id}/{childType}` - Child tabs ✅

---

### 2. Adding Child Entity Relationships

**In entityConfig.ts:**
```typescript
export const entityConfigs: Record<string, EntityConfig> = {
  project: {
    // ... existing config
    childEntities: ['task', 'wiki', 'form', 'artifact']
  },

  task: {
    // ... existing config
    childEntities: ['form', 'artifact']
  }
};
```

**Result:** Child tabs automatically appear on detail pages

---

### 3. Adding Custom Edit Pages

**For entities needing special editors (like Form, Wiki):**

**Step 1:** Create custom edit page
```typescript
// apps/web/src/pages/my_entity/MyEntityEditPage.tsx
export function MyEntityEditPage() {
  const { id } = useParams();
  // ... custom editor logic
}
```

**Step 2:** Add route in `App.tsx`
```typescript
<Route path="/my_entity/:id/edit" element={<ProtectedRoute><MyEntityEditPage /></ProtectedRoute>} />
```

**Step 3:** Update EntityDetailPage edit button
```typescript
// In EntityDetailPage.tsx
<button
  onClick={() => {
    if (entityType === 'my_entity') {
      navigate(`/my_entity/${id}/edit`);
    } else {
      setIsEditing(true);
    }
  }}
>
  Edit
</button>
```

**Step 4:** Update EntityChildListPage create handler
```typescript
// In handleCreateClick
if (childType === 'my_entity') {
  navigate(`/my_entity/${newEntityId}/edit`);
}
```

---

### 4. Adding Settings-Driven Fields

**Step 1:** Create settings table
```sql
-- db/setting_datalabel_my_field.ddl
CREATE TABLE app.setting_datalabel_my_field (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label VARCHAR(100) NOT NULL,
  value VARCHAR(100) NOT NULL,
  color_code VARCHAR(20),
  order_seq INTEGER
);
```

**Step 2:** Register in settingsConfig.ts
```typescript
export const SETTINGS_REGISTRY: SettingsCategory[] = [
  // ... existing settings
  {
    category: 'my_field',
    table: 'setting_datalabel_my_field',
    label: 'My Field Options'
  }
];
```

**Step 3:** Use in entityConfig
```typescript
fields: [
  {
    key: 'my_field',
    label: 'My Field',
    type: 'select',
    loadOptionsFromSettings: 'my_field'
  }
]
```

**Result:** Dropdown automatically populated from settings table ✅

---

### 5. Performance Optimization

**Lazy Loading:**
```typescript
// Load child tabs only when needed
const { tabs, loading } = useDynamicChildEntityTabs(entityType, id);
```

**Memoization:**
```typescript
// Memoize expensive computations
const visibleFields = React.useMemo(() => {
  return config.fields.filter(f => !excludedFields.includes(f.key));
}, [config.fields]);
```

**Virtual Scrolling:**
```typescript
// For large lists (1000+ items), use react-window
import { FixedSizeList } from 'react-window';
```

**Debounced Search:**
```typescript
// Debounce search input
const debouncedSearch = useMemo(
  () => debounce((value: string) => {
    setSearchQuery(value);
  }, 300),
  []
);
```

---

## Summary

### Key Achievements

1. **Universal Architecture** - 3 pages handle 18+ entity types
2. **Create-Link-Edit Pattern** - Automatic parent-child linking with smart navigation
3. **Zero Configuration** - Convention-based inline editing
4. **DRY Principles** - 95%+ code reuse across entities
5. **Type Safety** - Full TypeScript coverage
6. **Performance** - Lazy loading, memoization, debouncing
7. **Maintainability** - Single source of truth (entityConfig.ts)

### Files by Category

**Core Universal Pages:**
- `EntityMainPage.tsx` (list view)
- `EntityDetailPage.tsx` (detail view)
- `EntityChildListPage.tsx` (child tabs)
- `EntityCreatePage.tsx` (create form)

**Configuration:**
- `entityConfig.ts` (entity definitions)
- `settingsConfig.ts` (settings registry)
- `fieldCapabilities.ts` (inline edit detection)

**Modals:**
- `ShareModal.tsx` (sharing)
- `UnifiedLinkageModal.tsx` (linking)

**Specialized Pages:**
- `FormBuilderPage.tsx` (form designer)
- `FormEditPage.tsx` (form editor)
- `WikiEditorPage.tsx` (wiki editor)

### Impact

- **Development Speed**: 10x faster to add new entity types
- **Code Quality**: Single implementation, consistent behavior
- **User Experience**: Uniform interface across all entities
- **Maintainability**: Changes in one place affect all entities
- **Scalability**: Easily handle 50+ entity types without code bloat

---

**End of Documentation**
