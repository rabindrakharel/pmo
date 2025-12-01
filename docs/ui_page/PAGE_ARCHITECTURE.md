# Page Architecture

**Version:** 9.3.0 | **Location:** `apps/web/src/pages/` | **Updated:** 2025-12-01

---

## Overview

The PMO platform uses **3 universal pages** to handle 27+ entity types dynamically. This architecture eliminates entity-specific page code.

**Core Principles:**
- **Config-driven, not code-driven** - All entity-specific behavior defined in `entityConfig.ts`
- **Offline-first** - Dexie (IndexedDB) for persistent client-side storage
- **Real-time sync** - WebSocket invalidation via PubSub service (port 4001)
- **Format-at-read** - Raw data cached, transformation happens in page via `useMemo`

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

## Data Flow: Format-at-Read Pattern

The platform follows a **format-at-read** pattern where raw data is cached and transformation happens at the page level:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FORMAT-AT-READ DATA FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. API Response (raw data + metadata + refData)                            │
│     └── { data: [...], metadata: {...}, ref_data_entityInstance: {...} }    │
│                              │                                              │
│                              v                                              │
│  2. useEntityInstanceData Hook (TanStack Query + Dexie)                     │
│     └── Stores RAW data in cache (smaller, canonical, editable)             │
│     └── Returns: { data, metadata, refData, isLoading, ... }                │
│                              │                                              │
│                              v                                              │
│  3. Page useMemo Transform (format-at-read)                                 │
│     └── formatDataset(rawData, componentMetadata, refData)                  │
│     └── Memoized: only recalculates when dependencies change                │
│                              │                                              │
│                              v                                              │
│  4. FormattedRow[] → Component renders                                      │
│     └── { raw: T, display: {...}, styles: {...} }                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

SEPARATION OF CONCERNS:
• Cache (hook)    = Stores raw data, handles persistence & sync
• Page (useMemo)  = Transforms raw → formatted (format-at-read)
• Component       = Pure renderer, consumes FormattedRow[]
```

### Why Format-at-Read?

| Benefit | Description |
|---------|-------------|
| Smaller cache | Raw data is more compact than formatted strings |
| Canonical source | Single source of truth for values |
| Edit-friendly | Raw values available for form inputs |
| Fresh formatting | Datalabel colors/names resolve fresh on each read |

---

## 1. Universal Entity Pages

### 1.1 EntityListOfInstancesPage

**Route:** `/:entityCode` (e.g., `/project`, `/task`, `/employee`)

**Purpose:** Displays entity list with multiple view modes (table, kanban, grid, calendar, graph)

**Component Architecture:**
```
EntityListOfInstancesPage
├── Layout                           // App shell with sidebar
├── ViewSwitcher                     // Toggle between view modes
├── useEntityInstanceData()          // TanStack Query hook (returns raw data)
├── useMemo(formatDataset)           // Format-at-read transformation
├── EntityListOfInstancesTable       // Table view (default)
│   ├── Pagination                   // Client-side pagination
│   └── InlineEdit                   // Direct cell editing
├── KanbanView                       // Kanban board
│   └── KanbanColumn[]               // Status columns
├── GridView                         // Card grid
├── CalendarView                     // Event calendar
└── HierarchyGraphView / DAGVisualizer  // Graph views
```

**Key Code Pattern (Format-at-Read):**
```typescript
// EntityListOfInstancesPage.tsx:101-119

// Step 1: Fetch raw data from cache hook
const {
  data: rawData,
  metadata,
  refData,
  total: totalRecords,
  isLoading: loading,
} = useEntityInstanceData(entityCode, queryParams);

// Step 2: Format data on read (memoized) - transformation happens HERE
const formattedData = useMemo(() => {
  if (!rawData || rawData.length === 0) return [];
  const componentMetadata = metadata?.[mappedView] as ComponentMetadata | null;
  return formatDataset(rawData, componentMetadata, refData);
}, [rawData, metadata, mappedView, refData]);

// Step 3: Dual data paths for view vs edit mode
const tableData = editingRow || isAddingRow
  ? data          // Raw data for editing (form inputs)
  : formattedData; // Formatted data for viewing (display)
```

**Key Props:**
```typescript
interface EntityListOfInstancesPageProps {
  entityCode: string;      // Entity type from route
  defaultView?: ViewMode;  // Initial view mode
}
```

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
│   └── useEntityChildren()        // Fetch tabs from entity.child_entity_codes
├── EntityInstanceFormContainer    // Overview tab content
│   └── frontEndFormatterService   // Field renderers
├── WikiContentRenderer            // Wiki entity special view
├── InteractiveForm                // Form entity special view
├── EmailTemplateRenderer          // Marketing entity special view
├── TaskDataContainer              // Task updates/comments
├── FilePreview                    // Artifact/cost/revenue preview
├── ShareModal                     // Sharing dialog
└── UnifiedLinkageModal            // Entity relationships
```

**Edit Mode Integration (Dexie Drafts):**
```typescript
// Dexie draft integration (persistent, survives page refresh)
const {
  hasDraft: isEditing,
  currentData,
  dirtyFields,
  startEdit,
  updateField,
  discardDraft,
  getChanges,
  undo, redo,
  canUndo, canRedo,
  hasChanges
} = useDraft(entityCode, entityId);
```

**Tab System:**
1. Overview tab (always first) → Shows `EntityInstanceFormContainer`
2. Child tabs from `child_entity_codes` → Shows `EntityListOfInstancesTable` directly (inline rendering)
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
├── EntityInstanceFormContainer    // Form fields from config
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

## 2. Cache Integration Architecture

### TanStack Query + Dexie Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              CACHE INTEGRATION ARCHITECTURE (v9.3.0)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  TanStack Query (In-Memory)                                             ││
│  │  ─────────────────────────                                              ││
│  │  • Server state management                                              ││
│  │  • Automatic background refetch                                         ││
│  │  • Stale-while-revalidate                                               ││
│  │  • Cache invalidation via queryClient.invalidateQueries()               ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                              │                                              │
│                              v                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Dexie (IndexedDB) - Persistence Layer                                  ││
│  │  ─────────────────────────────────────                                  ││
│  │  • Survives browser restart                                             ││
│  │  • Offline-first access                                                 ││
│  │  • Multi-tab sync                                                       ││
│  │  • 30-min TTL for entity data                                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                              │                                              │
│                              v                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  WebSocketManager (Real-time Sync)                                      ││
│  │  ─────────────────────────────────                                      ││
│  │  • INVALIDATE message → queryClient.invalidateQueries()                 ││
│  │  • Pre-subscribes before fetch (close race window)                      ││
│  │  • Port 4001 (PubSub service)                                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  Bundle Size: ~25KB (TanStack + Dexie)                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cache Hooks (Primary API)

| Hook | Purpose | Store | Stale Time |
|------|---------|-------|------------|
| `useEntityInstanceData()` | Entity list with pagination | On-demand | 5 min |
| `useEntityMetadata()` | Field metadata only (content=metadata API) | Session | 30 min |
| `useDatalabel()` | Dropdown options | Session | 30 min |
| `useEntityCodes()` | Entity type definitions | Session | 30 min |
| `useGlobalSettings()` | App settings | Session | 30 min |
| `useEntityChildren()` | Child entities for tabs | On-demand | 5 min |
| `useDraft()` | Persist unsaved edits | Dexie only | Until saved |
| `useEntityMutation()` | CRUD operations | N/A | N/A |

### Sync Stores (Non-Hook Access)

For formatters and utilities that can't use hooks:

```typescript
import { getDatalabelSync, getEntityCodesSync, getEntityInstanceNameSync } from '@/db/tanstack-index';

// Sync access to cached data (returns null if not loaded)
const options = getDatalabelSync('project_stage');
const codes = getEntityCodesSync();
const name = getEntityInstanceNameSync('employee', 'uuid-here');
```

---

## 3. Settings Pages

Settings pages manage entity types and datalabel configurations.

### 3.1 SettingsOverviewPage

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
│   ├── EntityListOfInstancesTable (rbac entity)
│   └── RBAC Architecture Overview
├── Modals
│   ├── AddDatalabelModal          // Create new datalabel type
│   ├── ChildEntitiesModal         // Manage child_entity_codes
│   ├── EntityConfigurationModal   // Full entity config
│   └── PermissionManagementModal  // Grant RBAC permissions
```

### 3.2 SettingDetailPage

**Route:** `/setting/:category` (e.g., `/setting/projectStage`, `/setting/taskPriority`)

**Purpose:** CRUD for datalabel items within a specific datalabel type

**URL Conversion:**
```typescript
// URL param (camelCase) → datalabel name (snake_case with prefix)
// /setting/projectStage → dl__project_stage
// /setting/taskPriority → dl__task_priority

function datalabelToCamelCase(datalabelName: string): string {
  const withoutPrefix = datalabelName.replace(/^dl__/, '');
  const parts = withoutPrefix.split('_');
  return parts[0] + parts.slice(1).map(p => p[0].toUpperCase() + p.slice(1)).join('');
}
```

---

## 4. Wiki Pages (Special Entity)

Wiki has dedicated pages with Notion-like block editor instead of universal entity pages.

### 4.1 WikiViewPage

**Route:** `/wiki/:id`

**Purpose:** Read-only wiki content display with cover image and metadata

### 4.2 WikiEditorPage

**Route:** `/wiki/:id/edit` (edit) or `/wiki/new` (create)

**Purpose:** Notion-style block editor for wiki content

---

## 5. Form Pages (Special Entity)

### 5.1 FormBuilderPage

**Route:** `/form/:id/edit`

**Purpose:** Drag-and-drop form schema editor

### 5.2 FormViewPage / InteractiveForm

**Route:** `/form/:id` (embedded in EntitySpecificInstancePage)

**Purpose:** Render form for submission

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

### 6.2 EntityListOfInstancesTable Component

Primary data display component (used directly by pages):
```typescript
<EntityListOfInstancesTable
  data={tableData}              // FormattedRow[] (view) or raw[] (edit)
  metadata={metadata}           // Field metadata from API
  loading={isLoading}           // Loading state
  pagination={pagination}       // { page, pageSize, total }
  inlineEditable={true}         // Enable cell editing
  allowAddRow={true}            // Show add row button
  onRowClick={handleRowClick}   // Navigation handler
  editingRow={editingRow}       // Currently editing row ID
  editedData={editedData}       // Edited field values
  onInlineEdit={handleInlineEdit}     // Field change handler
  onSaveInlineEdit={handleSave}       // Save handler
  onCancelInlineEdit={handleCancel}   // Cancel handler
/>
```

### 6.3 EntityInstanceFormContainer Component

Universal form renderer:
```typescript
<EntityInstanceFormContainer
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

## 8. Navigation Flow

```
User clicks sidebar → EntityListOfInstancesPage (/:entityCode)
       │
       ├── [Row Click] → EntitySpecificInstancePage (/:entityCode/:id)
       │                        │
       │                        ├── [Tab Click] → EntityListOfInstancesTable (inline, same page)
       │                        │                        │
       │                        │                        └── [Create] → Create-Link-Redirect
       │                        │
       │                        └── [Edit Button] → Edit mode (same page)
       │
       └── [Create Button] → EntityCreatePage (/:entityCode/new)
```

---

## 9. Page-Component Matrix

| Page | Primary Components | View Modes |
|------|-------------------|------------|
| EntityListOfInstancesPage | EntityListOfInstancesTable, KanbanView, GridView, CalendarView | table, kanban, grid, calendar, graph |
| EntitySpecificInstancePage | EntityInstanceFormContainer, DynamicChildEntityTabs, EntityListOfInstancesTable (child tabs) | - |
| EntityCreatePage | EntityInstanceFormContainer, DragDropFileUpload | - |
| SettingsOverviewPage | Entity table, EntityListOfInstancesTable (rbac), Modals | 5 tabs |
| SettingDetailPage | LabelsDataTable (drag-to-reorder) | - |
| WikiViewPage | Cover, Article, Action buttons | - |
| WikiEditorPage | WikiDesigner (block editor), ShareModal, LinkageModal | - |
| FormBuilderPage | FormBuilder, Toolbar, Canvas, Properties Panel | - |
| FormDataPreviewPage | EntityListOfInstancesTable, FormSubmissionEditor | - |

---

## 10. Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Creating entity-specific pages | Use universal pages with entityConfig |
| Hardcoding field visibility | Use backend metadata |
| Formatting in cache hook | Format in page via `useMemo(formatDataset)` |
| Manual cache management | Let TanStack Query + WebSocket handle invalidation |
| Entity-specific view logic | Configure via entityConfig |
| Pattern detection in frontend | Backend sends complete metadata |

---

## Related Documents

| Document | Purpose |
|----------|---------|
| `docs/ui_page/Layout_Component_Architecture.md` | Component hierarchy and rendering |
| `docs/services/frontend_datasetFormatter.md` | formatDataset implementation |
| `docs/state_management/STATE_MANAGEMENT.md` | TanStack Query + Dexie architecture |
| `docs/caching/TANSTACK_DEXIE_SYNC_ARCHITECTURE.md` | Cache sync architecture |

---

**Version:** 9.3.0 | **Last Updated:** 2025-12-01 | **Status:** Production Ready

**Recent Updates:**
- v9.3.0 (2025-12-01): Documented format-at-read pattern, TanStack Query + Dexie integration
- v9.2.0 (2025-11-30): Redis field caching, content=metadata API
- v9.1.0 (2025-11-28): RxDB removed, TanStack Query + Dexie only
- v9.0.0 (2025-11-28): Migrated from RxDB to TanStack Query + Dexie
