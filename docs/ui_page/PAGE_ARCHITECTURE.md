# Page Architecture

**Version:** 8.5.0 | **Location:** `apps/web/src/pages/` | **Updated:** 2025-11-28

---

## Overview

The PMO platform uses **3 universal pages** to handle 27+ entity types dynamically. This architecture eliminates entity-specific page code.

**Core Principles:**
- **Config-driven, not code-driven** - All entity-specific behavior defined in `entityConfig.ts`
- **Offline-first** - RxDB (IndexedDB) for persistent client-side storage
- **Real-time sync** - WebSocket invalidation via PubSub service

---

## System Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PAGE ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    3 UNIVERSAL ENTITY PAGES                           │  │
│  ├───────────────────┬─────────────────────┬─────────────────────────────┤  │
│  │ EntityListOfInst  │ EntitySpecificInst  │  EntityCreatePage           │  │
│  │    Page           │     Page            │                             │  │
│  │ (List/Kanban/Grid)│ (Detail + Tabs)     │  (Create Form)              │  │
│  └───────────────────┴─────────────────────┴─────────────────────────────┘  │
│                              │                                              │
│                              v                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    ENTITY CONFIG                                      │  │
│  │             apps/web/src/lib/entityConfig.ts                          │  │
│  │    - columns, fields, supportedViews, kanban, grid, children          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Universal Entity Pages

### 1.1 EntityListOfInstancesPage

**Route:** `/:entityCode` (e.g., `/project`, `/task`, `/employee`)

**Purpose:** Displays entity list with multiple view modes (table, kanban, grid, calendar, graph)

**Component Architecture:**
```
EntityListOfInstancesPage
├── Layout                         // App shell with sidebar
├── ViewSwitcher                   // Toggle between view modes
├── useEntityInstanceList()        // React Query hook (data fetching)
├── EntityDataTable                // Table view (default)
│   ├── Pagination                 // Server-side pagination
│   └── InlineEdit                 // Direct cell editing
├── KanbanView                     // Kanban board
│   └── KanbanColumn[]             // Status columns
├── GridView                       // Card grid
├── CalendarView                   // Event calendar
└── HierarchyGraphView / DAGVisualizer  // Graph views
```

**Key Props:**
```typescript
interface EntityListOfInstancesPageProps {
  entityCode: string;      // Entity type from route
  defaultView?: ViewMode;  // Initial view mode
}
```

**Data Flow:**
1. `entityCode` passed via route → `getEntityConfig(entityCode)`
2. `useEntityInstanceList()` fetches data via React Query
3. Backend returns `{ data, metadata, total }`
4. ViewSwitcher determines which component renders

---

### 1.2 EntitySpecificInstancePage

**Route:** `/:entityCode/:id` (e.g., `/project/uuid`, `/task/uuid`)

**Purpose:** Detail view with dynamic child entity tabs, edit mode, and entity-specific renderers

**Component Architecture:**
```
EntitySpecificInstancePage
├── Layout
├── EntityMetadataRow              // Name, code, ID, timestamps
│   └── EntityMetadataField[]      // Copyable inline fields (debounced)
├── DynamicChildEntityTabs         // Tab navigation
│   └── useDynamicChildEntityTabs()// Fetch tabs from API
├── EntityFormContainer            // Overview tab content
│   └── frontEndFormatterService   // Field renderers
├── WikiContentRenderer            // Wiki entity special view
├── InteractiveForm                // Form entity special view
├── EmailTemplateRenderer          // Marketing entity special view
├── TaskDataContainer              // Task updates/comments
├── FilePreview                    // Artifact/cost/revenue preview
├── ShareModal                     // Sharing dialog
└── UnifiedLinkageModal            // Entity relationships
```

**Edit Mode Integration:**
```typescript
// Zustand edit store integration
const {
  isEditing,
  currentData,
  dirtyFields,
  startEdit,
  updateField,
  saveChanges,
  undo, redo
} = useEntityEditStore();

// Keyboard shortcuts
useKeyboardShortcuts({
  enableSave: true,    // Ctrl+S
  enableUndo: true,    // Ctrl+Z
  enableRedo: true,    // Ctrl+Shift+Z
  enableEscape: true   // Cancel edit
});
```

**Tab System:**
1. Overview tab (always first) → Shows `EntityFormContainer`
2. Child tabs from `child_entity_codes` → Shows `EntityDataTable` directly (inline rendering)
3. Special tabs for form entity (`Form Data`, `Edit Submission`)

---

### 1.3 EntityCreatePage

**Route:** `/:entityCode/new` (e.g., `/project/new`, `/task/new`)

**Purpose:** Universal entity creation form with file upload support

**Component Architecture:**
```
EntityCreatePage
├── Layout
├── DragDropFileUpload             // For artifact/cost/revenue
│   └── useS3Upload()              // Presigned URL upload
├── EntityFormContainer            // Form fields from config
│   └── Fields auto-generated      // Based on entityConfig.fields
└── Button (Save/Cancel)
```

**Parent Context (Child Creation):**
```typescript
// Navigation state passed from child list page
interface ParentContext {
  parentType?: string;   // Parent entity code
  parentId?: string;     // Parent entity ID
  returnTo?: string;     // Return URL after creation
}

// After create → Link to parent via linkage API
await createParentChildLinkage(parentType, parentId, entityCode, createdId);
```

---

## 2. Settings Pages

Settings pages manage entity types and datalabel configurations.

### 2.1 SettingsOverviewPage

**Route:** `/setting/overview`

**Purpose:** Central hub for all system configuration with 5 main tabs

**Component Architecture:**
```
SettingsOverviewPage
├── Layout
├── Header
│   ├── Exit button → exitSettingsMode()
│   ├── Settings icon
│   └── Title/description
├── Tab Navigation
│   ├── [Entities] → Entity type management
│   ├── [Entity Mapping] → Linkage configuration
│   ├── [Secrets Vault] → Credentials (placeholder)
│   ├── [Integrations] → External services (placeholder)
│   └── [Access Control] → RBAC management
├── Entities Tab Content
│   ├── Search input
│   ├── Entity table
│   │   ├── Code, Name, UI Label, Domain
│   │   ├── Icon (with picker)
│   │   ├── Display Order
│   │   ├── Status toggle (active_flag)
│   │   ├── Children button → ChildEntitiesModal
│   │   └── Actions (Edit, Delete)
│   └── Add Entity row (inline)
├── Access Control Tab Content
│   ├── Roles Management card → /role
│   ├── Employee-Role Assignment card
│   ├── Permission Management card
│   ├── EntityDataTable (rbac entity)
│   └── RBAC Architecture Overview
├── Modals
│   ├── AddDatalabelModal          // Create new datalabel type
│   ├── ChildEntitiesModal         // Manage child_entity_codes
│   ├── EntityConfigurationModal   // Full entity config
│   └── PermissionManagementModal  // Grant RBAC permissions
```

**Entity Management Operations:**
```typescript
// Add entity
POST /api/v1/entity → { code, name, ui_label, ui_icon }

// Update entity
PUT /api/v1/entity/:code → { name?, ui_label?, ui_icon?, display_order?, active_flag? }

// Toggle active status
PUT /api/v1/entity/:code → { active_flag: !current }

// Delete entity (soft delete)
DELETE /api/v1/entity/:code

// Update child entities
PUT /api/v1/entity/:code/children → { child_entity_codes: [...], mode: 'append' | 'replace' }
```

**Tab Details:**

| Tab | Content | Purpose |
|-----|---------|---------|
| **Entities** | Entity type table with CRUD | Define entity types (project, task, etc.) |
| **Entity Mapping** | Configuration cards | Navigate to linkage page |
| **Secrets Vault** | Feature list (placeholder) | Credential management |
| **Integrations** | Feature list (placeholder) | External service connections |
| **Access Control** | RBAC cards + EntityDataTable | Role/permission management |

---

### 2.2 SettingDetailPage

**Route:** `/setting/:category` (e.g., `/setting/projectStage`, `/setting/taskPriority`)

**Purpose:** CRUD for datalabel items within a specific datalabel type

**Component Architecture:**
```
SettingDetailPage
├── Layout
├── Header
│   ├── ExitButton → exitSettingsMode()
│   ├── Icon (from datalabel config)
│   └── Title (from ui_label)
└── LabelsDataTable
    ├── Columns: ID, Name, Description, Parent ID, Color
    ├── Inline editing
    ├── Color picker
    ├── Drag-to-reorder
    ├── Add row button
    └── Delete row button
```

**URL Conversion:**
```typescript
// URL param (camelCase) → datalabel name (snake_case with prefix)
// /setting/projectStage → dl__project_stage
// /setting/taskPriority → dl__task_priority
// /setting/productProductCategory → dl__product_product_category

function datalabelToCamelCase(datalabelName: string): string {
  const withoutPrefix = datalabelName.replace(/^dl__/, '');
  const parts = withoutPrefix.split('_');
  return parts[0] + parts.slice(1).map(p => p[0].toUpperCase() + p.slice(1)).join('');
}
```

**Data Operations:**
```typescript
// Fetch items
const items = await fetchSettingItems(datalabel); // e.g., 'dl__project_stage'

// Create item
await createSettingItem(datalabel, { name, descr, parent_id, color_code });

// Update item
await updateSettingItemMultiple(datalabel, id, { name?, descr?, color_code? });

// Delete item
await deleteSettingItem(datalabel, id);

// Reorder items
await reorderSettingItems(datalabel, reorderedData);
```

**LabelsDataTable Props:**
```typescript
<LabelsDataTable
  data={data}                      // Array of LabelRecord
  onRowUpdate={handleRowUpdate}    // Save entire row
  onAddRow={handleAddRow}          // Add new row
  onDeleteRow={handleDeleteRow}    // Delete row
  onReorder={handleReorder}        // Drag-to-reorder
  allowAddRow={true}
  allowEdit={true}
  allowDelete={true}
  allowReorder={true}
/>
```

**Position-Based IDs (Critical):**
```typescript
// IDs are array positions, NOT permanent
// After delete/reorder, IDs are reassigned

// Before delete: [0: A, 1: B, 2: C]
deleteItem(1);
// After delete: [0: A, 1: C]  ← C's ID changed from 2 to 1

// ALWAYS refetch after mutations
await deleteItem(1);
const fresh = await fetchSettingItems(datalabel);
setData(fresh);  // Get reassigned IDs from server
```

---

## 3. Wiki Pages (Special Entity)

Wiki has dedicated pages with Notion-like block editor instead of universal entity pages.

### 3.1 WikiViewPage

**Route:** `/wiki/:id`

**Purpose:** Read-only wiki content display with cover image and metadata

**Component Architecture:**
```
WikiViewPage
├── Layout
├── Cover Image                    // Gradient or custom cover
│   └── Configurable via page.attr.cover
├── Page Header
│   ├── Icon (emoji)               // page.attr.icon
│   ├── Title (h1)                 // page.name
│   └── Updated timestamp
├── Action Buttons
│   ├── Edit → navigate(/wiki/:id/edit)
│   └── Back → navigate(/wiki)
└── Article Content
    └── dangerouslySetInnerHTML    // Rendered HTML from content_html
```

**Data Flow:**
1. Fetch wiki via `wikiApi.get(id)`
2. Display cover, icon, title
3. Render HTML content via `dangerouslySetInnerHTML`

---

### 3.2 WikiEditorPage

**Route:** `/wiki/:id/edit` (edit) or `/wiki/new` (create)

**Purpose:** Notion-style block editor for wiki content

**Component Architecture:**
```
WikiEditorPage
├── WikiDesigner                   // Full-page editor (no Layout wrapper)
│   ├── Cover picker               // Gradient/image covers
│   ├── Icon picker                // Emoji selector
│   ├── Title input
│   ├── Block editor               // Notion-style blocks
│   │   ├── Paragraph blocks
│   │   ├── Heading blocks (H1, H2, H3)
│   │   ├── List blocks (bullet, numbered)
│   │   ├── Code blocks
│   │   ├── Image blocks
│   │   └── Divider blocks
│   ├── Save button
│   └── Exit button
├── ShareModal                     // Share wiki publicly
├── UnifiedLinkageModal            // Link to parent entities
└── Exit Confirmation Modal        // Unsaved changes warning
```

**Key Features:**
```typescript
// Navigation history integration
const { pushEntity, updateCurrentEntityName, goBack } = useNavigationHistory();

// Linkage modal for parent assignment
const linkageModal = useLinkageModal({
  onLinkageChange: () => console.log('Wiki linkage changed')
});

// Save handler
const handleSave = async (pageData) => {
  if (editing) {
    await wikiApi.update(id, pageData);
  } else {
    const created = await wikiApi.create(pageData);
    window.history.replaceState(null, '', `/wiki/${created.id}/edit`);
  }
};
```

**Wiki Content Structure:**
```typescript
interface WikiPage {
  id: string;
  name: string;
  content: {                       // Block-based content
    type: 'blocks';
    blocks: Block[];
  };
  content_html: string;            // Pre-rendered HTML (read-only views)
  content_md: string;              // Markdown source
  metadata: {
    attr: {
      icon: string;                // '📄', '🏠', etc.
      cover: string;               // 'gradient-purple', 'emerald', etc.
      path: string;                // '/wiki'
    };
  };
  publication_status: 'draft' | 'published';
  visibility: 'internal' | 'public';
  wiki_type: 'page' | 'template';
}
```

---

## 4. Form Pages (Special Entity)

Form has dedicated pages for building and managing interactive forms.

### 4.1 FormBuilderPage

**Route:** `/form/:id/edit`

**Purpose:** Drag-and-drop form schema editor

**Component Architecture:**
```
FormBuilderPage
├── Layout (hidden sidebar)
├── FormBuilder
│   ├── Toolbar                    // Field type palette
│   │   ├── Text field
│   │   ├── Number field
│   │   ├── Select field
│   │   ├── Date field
│   │   ├── File upload field
│   │   └── Section divider
│   ├── Canvas                     // Drop zone for fields
│   │   └── FormField[]            // Draggable/configurable
│   ├── Field Properties Panel     // Edit selected field
│   │   ├── Label, placeholder
│   │   ├── Validation rules
│   │   └── Options (for select)
│   └── Preview toggle
├── Save/Exit buttons
└── ShareModal
```

### 4.2 FormViewPage / InteractiveForm

**Route:** `/form/:id` (embedded in EntitySpecificInstancePage)

**Purpose:** Render form for submission

**Component Architecture:**
```
InteractiveForm
├── Form Schema Parser             // JSON → React components
├── FormField[]                    // Dynamic field rendering
│   ├── Text/Number inputs
│   ├── Select dropdowns
│   ├── Date pickers
│   ├── File upload
│   └── Validation display
├── Multi-step Navigation          // For multi_step form_type
│   ├── Step indicator
│   ├── Next/Previous buttons
│   └── Step validation
└── Submit button
```

### 4.3 FormDataPreviewPage

**Route:** `/form/:id/form-data`

**Purpose:** View/manage form submissions

**Component Architecture:**
```
FormDataPreviewPage
├── Layout
├── EntityDataTable                // Submissions list
│   ├── Columns from form_schema
│   ├── Submission timestamp
│   ├── Submitter info
│   └── Status column
└── FormSubmissionEditor           // Edit individual submission
```

### 4.4 PublicFormPage

**Route:** `/form/public/:shareId`

**Purpose:** Public form submission (no auth required)

---

## 5. Artifact Pages (File Entity)

Artifacts use universal pages with file upload/preview integration.

**Routes:**
| Route | Page | Purpose |
|-------|------|---------|
| `/artifact/new` | EntityCreatePage | Upload new file |
| `/artifact/:id` | EntitySpecificInstancePage | Preview + metadata |

**File Upload Flow:**
```typescript
// 1. Select file
const [selectedFile, setSelectedFile] = useState<File | null>(null);

// 2. Upload to S3 via presigned URL
const { uploadToS3 } = useS3Upload();
const objectKey = await uploadToS3({
  entityCode: 'artifact',
  entityId: tempId,
  file: selectedFile,
  fileName: selectedFile.name,
  contentType: selectedFile.type,
  uploadType: 'artifact',
  tenantId: 'demo'
});

// 3. Create artifact record with S3 key
await api.create({
  name: selectedFile.name,
  attachment_object_key: objectKey,
  attachment_object_bucket: 'bucket-name',
  attachment_format: fileExtension,
  attachment_size_bytes: selectedFile.size
});
```

**FilePreview Component:**
```typescript
<FilePreview
  objectKey={artifact.attachment_object_key}
  bucket={artifact.attachment_object_bucket}
  contentType={artifact.attachment_format}
  fileName={artifact.name}
/>
// Supports: PDF, images, text, code files
```

---

## 6. Component Patterns

### 6.1 Layout Component

Every page wraps content in `<Layout>`:
```typescript
<Layout>
  <div className="w-[97%] max-w-[1536px] mx-auto">
    {/* Page content */}
  </div>
</Layout>
```

**Layout provides:**
- Sidebar navigation
- Top navigation bar
- User menu
- Responsive container

### 6.2 EntityDataTable Component

Primary data display component (used directly by pages):
```typescript
<EntityDataTable
  data={data}                     // Entity records from API
  metadata={backendMetadata}      // Field metadata from API response
  loading={isLoading}             // Loading state
  pagination={pagination}         // { page, pageSize, total }
  inlineEditable={true}           // Enable cell editing
  allowAddRow={true}              // Show add row button
  onRowClick={handleRowClick}     // Navigation handler
  editingRow={editingRow}         // Currently editing row ID
  editedData={editedData}         // Edited field values
  onInlineEdit={handleInlineEdit} // Field change handler
  onSaveInlineEdit={handleSave}   // Save handler
  onCancelInlineEdit={handleCancel} // Cancel handler
/>
```

### 6.3 EntityFormContainer Component

Universal form renderer:
```typescript
<EntityFormContainer
  config={config}                  // From entityConfig.ts
  metadata={backendMetadata}       // Backend field metadata
  data={isEditing ? editedData : data}
  isEditing={isEditing}
  onChange={handleFieldChange}
  mode="edit" | "create"
  autoGenerateFields={true}        // Fallback if no metadata
/>
```

---

## 7. Routing Structure

```typescript
// App.tsx route structure
<Route path="/:entityCode" element={<EntityListOfInstancesPage />} />
<Route path="/:entityCode/new" element={<EntityCreatePage />} />
<Route path="/:entityCode/:id/*" element={<EntitySpecificInstancePage />} />
// Note: Child tabs handled inline via URL parsing, not nested routes

// Settings routes
<Route path="/setting/overview" element={<SettingsOverviewPage />} />
<Route path="/setting/:category" element={<SettingDetailPage />} />

// Special entity routes
<Route path="/wiki/:id/edit" element={<WikiEditorPage />} />
<Route path="/form/:id/edit" element={<FormBuilderPage />} />
<Route path="/form/public/:shareId" element={<PublicFormPage />} />
```

---

## 8. Data Fetching Patterns (v8.5.0)

### Entity Hooks (RxDB Backend)

All entity hooks now use RxDB internally for offline-first storage:

| Hook | Purpose | Backend | Survives Refresh |
|------|---------|---------|------------------|
| `useEntityInstanceList()` | Entity list (React Query API, RxDB storage) | RxDB | ✅ Yes |
| `useEntityInstance()` | Single entity (React Query API, RxDB storage) | RxDB | ✅ Yes |
| `useFormattedEntityList()` | Formatted entity list | RxDB + format | ✅ Yes |
| `useFormattedEntityInstance()` | Formatted single entity | RxDB + format | ✅ Yes |
| `useRxDraft()` | Persist unsaved edits | RxDB | ✅ Yes |

### Direct RxDB Hooks (Advanced)

| Hook | Purpose | Storage | Survives Refresh |
|------|---------|---------|------------------|
| `useRxEntityList()` | Direct RxDB query for entity list | IndexedDB | ✅ Yes |
| `useRxEntity()` | Direct RxDB query for single entity | IndexedDB | ✅ Yes |
| `useRecoverDraft()` | Check for existing draft | IndexedDB | ✅ Yes |

### Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PAGE DATA FLOW (v8.5.0)                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Page mounts → useRxEntityList('project')                                │
│     └── RxDB queries IndexedDB (instant if cached)                          │
│     └── If empty/stale → ReplicationManager.fetchEntityList()               │
│                                                                              │
│  2. API response → ReplicationManager stores in RxDB                        │
│     └── db.entities.upsert(doc) for each entity                             │
│     └── WebSocket SUBSCRIBE sent for loaded entity IDs                      │
│                                                                              │
│  3. RxDB reactive query emits → UI auto-updates                             │
│     └── No manual setState needed                                           │
│                                                                              │
│  4. Another user edits → WebSocket INVALIDATE received                      │
│     └── ReplicationManager.fetchEntity() → RxDB upsert → UI updates         │
│                                                                              │
│  5. User edits → useRxDraft() creates draft in IndexedDB                   │
│     └── Survives page refresh!                                              │
│     └── Only dirty fields sent in PATCH                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Metadata Hooks (Zustand + React Query)

| Hook | Purpose | Storage |
|------|---------|---------|
| `useDatalabels()` | Fetch dropdown options | Zustand (memory) |
| `useDynamicChildEntityTabs()` | Fetch child tabs from entity.child_entity_codes | React Query |
| `useEntityMetadata()` | Entity type configurations | Zustand (memory) |

### Prefetching

```typescript
// Prefetch on row hover for instant navigation
const { prefetchEntity } = usePrefetch();

const handleRowHover = (item) => {
  prefetchEntity(entityCode, item.id);
};
```

---

## 9. Navigation Flow

```
User clicks sidebar → EntityListOfInstancesPage (/:entityCode)
       │
       ├── [Row Click] → EntitySpecificInstancePage (/:entityCode/:id)
       │                        │
       │                        ├── [Tab Click] → EntityDataTable (inline, same page)
       │                        │                        │
       │                        │                        └── [Create] → Create-Link-Redirect
       │                        │
       │                        └── [Edit Button] → Edit mode (same page)
       │
       └── [Create Button] → EntityCreatePage (/:entityCode/new)
```

---

## 10. Page-Component Matrix

| Page | Primary Components | View Modes |
|------|-------------------|------------|
| EntityListOfInstancesPage | EntityDataTable, KanbanView, GridView, CalendarView | table, kanban, grid, calendar, graph |
| EntitySpecificInstancePage | EntityFormContainer, DynamicChildEntityTabs, EntityDataTable (child tabs) | - |
| EntityCreatePage | EntityFormContainer, DragDropFileUpload | - |
| SettingsOverviewPage | Entity table, EntityDataTable (rbac), Modals | 5 tabs |
| SettingDetailPage | LabelsDataTable (drag-to-reorder) | - |
| WikiViewPage | Cover, Article, Action buttons | - |
| WikiEditorPage | WikiDesigner (block editor), ShareModal, LinkageModal | - |
| FormBuilderPage | FormBuilder, Toolbar, Canvas, Properties Panel | - |
| FormDataPreviewPage | EntityDataTable, FormSubmissionEditor | - |

---

## 11. Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Creating entity-specific pages | Use universal pages with entityConfig |
| Hardcoding field visibility | Use backend metadata |
| Direct API calls in components | Use React Query hooks |
| Manual cache management | Use `useCacheInvalidation()` |
| Entity-specific view logic | Configure via entityConfig |

---

**Version:** 8.5.0 | **Last Updated:** 2025-11-28 | **Status:** Production Ready

**Recent Updates:**
- v8.5.0 (2025-11-28): RxDB offline-first architecture with IndexedDB persistent storage
- v8.4.0 (2025-11-27): WebSocket real-time sync via PubSub service
- v8.3.0 (2025-11-26): ref_data_entityInstance pattern for entity reference resolution
