# PMO Web Application - Frontend Architecture

## Overview

This is a React-based Project Management Office (PMO) web application built with TypeScript, Vite, and Tailwind CSS. The application follows a hierarchical entity-relationship model with role-based access control (RBAC) handled entirely at the API level.

## Core Architecture

### Security Model
- **Frontend**: No permission checking - displays all data provided by API
- **Backend**: Complete RBAC implementation via database joins
- **Single Source of Truth**: API determines what users can see and do
- **JWT Authentication**: All API calls authenticated with Bearer tokens


### 🏗️ **Layout Components**
```
apps/web/src/components/layout/
└── Layout.tsx                          # Main application layout with sidebar navigation
```

### 🧩 **UI Components**

#### **Core UI Primitives**
```
apps/web/src/components/ui/
├── DataTable.tsx                       # Enhanced data table with selection, sorting, filtering
├── GridView.tsx                        # Grid layout component for card-based displays
└── TreeView.tsx                        # Hierarchical tree view component
```

#### **Common Reusable Components**
```
apps/web/src/components/common/
├── ActionButtons.tsx                   # Individual action button components
├── ActionButtonsBar.tsx               # Action button bar layout (Create, Share, Delete)
├── Button.tsx                          # Base button component without RBAC
├── CreateButton.tsx                    # Create button component
├── DynamicChildEntityTabs.tsx         # Dynamic tab navigation for entity detail pages
├── EntityAssignmentDataTable.tsx      # Assignment data table for entity relationships
├── FloatingFullscreenToggle.tsx       # Floating fullscreen toggle button
├── FullscreenToggle.tsx               # Fullscreen toggle component
├── GlobalSearch.tsx                    # Global search functionality
├── InlineEditField.tsx                # Click-to-edit field component
├── RBACButton.tsx                      # RBAC-aware button component (legacy)
├── ScopeFilters.tsx                   # Scope filtering components
└── StatsGrid.tsx                      # Statistics grid layout for metrics cards
```

#### **Specialized Components**
```
apps/web/src/components/
├── FilteredDataTable.tsx              # Configuration-driven data table with action buttons
└── SimpleDataTable.tsx               # Basic data table component
```

#### **Authentication Components**
```
apps/web/src/components/auth/
└── LoginForm.tsx                      # User login form component
```

#### **Form Components**
```
apps/web/src/components/forms/
├── FormBuilder.tsx                    # Dynamic form builder interface
└── FormPreview.tsx                    # Form preview and rendering component
```

#### **Editor Components**
```
apps/web/src/components/editor/
├── CodeBlock.tsx                      # Code block editor component
└── ModularEditor.tsx                  # Modular rich text editor
```

#### **Wiki Components**
```
apps/web/src/components/wiki/
└── BlockEditor.tsx                    # Block-based wiki editor
```

---

## 📄 **Pages Directory Structure**

### 🏠 **Main Entity Pages** (List Views)
```
apps/web/src/pages/
├── DashboardPage.tsx                  # Main dashboard with overview metrics
├── ProjectPage.tsx                    # Projects list page with data table
├── BusinessPage.tsx                   # Business units list page
├── TaskPage.tsx                       # Tasks list page
├── EmployeePage.tsx                   # Employees list page
├── OrgPage.tsx                        # Organizations list page
├── RolePage.tsx                       # Roles list page
├── WikiPage.tsx                       # Wiki pages list
├── ArtifactPage.tsx                   # Artifacts list page
├── FormPage.tsx                       # Forms list page
├── MetaPage.tsx                       # Metadata management page
├── SecurityPage.tsx                   # Security and permissions page
├── SettingsPage.tsx                   # Application settings page
├── ProfilePage.tsx                    # User profile page
└── BillingPage.tsx                    # Billing and subscription page
```

### 🏢 **Business Entity Pages**
```
apps/web/src/pages/business/
├── index.ts                           # Business module exports
├── BusinessDetailPage.tsx             # Business unit detail page with editable fields
├── BusinessProjectPage.tsx           # Business unit projects (filtered)
├── BusinessTaskPage.tsx              # Business unit tasks (filtered)
├── BusinessWikiPage.tsx               # Business unit wiki pages (filtered)
├── BusinessArtifactPage.tsx           # Business unit artifacts (filtered)
└── BusinessFormPage.tsx               # Business unit forms (filtered)
```

### 📁 **Project Entity Pages**
```
apps/web/src/pages/project/
├── index.ts                           # Project module exports
├── ProjectDetailPage.tsx              # Project detail page with editable fields
├── ProjectTaskPage.tsx                # Project tasks with Kanban/Grid views
├── ProjectWikiPage.tsx                # Project wiki pages (filtered)
├── ProjectArtifactPage.tsx            # Project artifacts (filtered)
└── ProjectFormPage.tsx                # Project forms (filtered)
```

### ✅ **Task Entity Pages**
```
apps/web/src/pages/task/
├── TaskArtifactPage.tsx               # Task artifacts (filtered)
└── TaskFormPage.tsx                   # Task forms (filtered)
```

### 🏛️ **Organization Entity Pages**
```
apps/web/src/pages/org/
├── OrgDetailPage.tsx                  # Organization detail page
├── OrgEmployeePage.tsx                # Organization employees (filtered)
├── OrgTaskPage.tsx                    # Organization tasks (filtered)
├── OrgWikiPage.tsx                    # Organization wiki pages (filtered)
├── OrgArtifactPage.tsx                # Organization artifacts (filtered)
├── OrgFormPage.tsx                    # Organization forms (filtered)
└── OrgWorksitePage.tsx                # Organization worksites (filtered)
```

### 👤 **Employee & Role Pages**
```
apps/web/src/pages/
├── employee/
│   └── EmployeeDetailPage.tsx         # Employee detail page
└── role/
    └── RoleDetailPage.tsx             # Role detail page
```

### 🏗️ **Worksite Pages**
```
apps/web/src/pages/worksite/
├── WorksiteDetailPage.tsx             # Worksite detail page
├── WorksiteTaskPage.tsx               # Worksite tasks (filtered)
└── WorksiteFormPage.tsx               # Worksite forms (filtered)
```

### ⚙️ **Metadata Management Pages**
```
apps/web/src/pages/meta/
├── index.ts                           # Meta module exports
├── businessLevel.tsx                  # Business hierarchy levels
├── hrLevel.tsx                        # HR levels and roles
├── orgLevel.tsx                       # Organization levels
├── projectStage.tsx                   # Project stages configuration
├── projectStatus.tsx                  # Project status configuration
├── taskStage.tsx                      # Task stages configuration
└── taskStatus.tsx                     # Task status configuration
```

### 📝 **Standalone Detail Pages**
```
apps/web/src/pages/
└── TaskDetailPage.tsx                 # Standalone task detail page
```

### 📋 **Form-Related Pages**
```
apps/web/src/pages/
├── FormBuilderPage.tsx                # Form creation and building interface
├── FormEditPage.tsx                   # Form editing interface
└── FormViewPage.tsx                   # Form viewing and submission interface
```

### 📖 **Wiki-Related Pages**
```
apps/web/src/pages/
├── WikiEditorPage.tsx                 # Wiki page editor
└── WikiViewPage.tsx                   # Wiki page viewer
```

---

## 🗂️ **Organization Patterns**

### **Main Pages Structure**
Each main entity follows this pattern:
- **List Page**: `EntityPage.tsx` - Shows data table with action buttons
- **Detail Page**: `entity/EntityDetailPage.tsx` - Shows editable entity details
- **Child Pages**: `entity/EntityChildPage.tsx` - Shows filtered child entities

### **Navigation Flow**
```
Main Page (List) → Detail Page → Child Entity Pages
     ↓                 ↓              ↓
ProjectPage.tsx → ProjectDetailPage.tsx → ProjectTaskPage.tsx
                                       → ProjectWikiPage.tsx
                                       → ProjectArtifactPage.tsx
                                       → ProjectFormPage.tsx
```

### **Component Hierarchy**
```
Layout.tsx (Root Shell)
├── DynamicChildEntityTabs (Tab Navigation)
├── ActionButtonsBar (Action Buttons)
├── FilteredDataTable (Data Display)
├── StatsGrid (Metrics Display)
└── InlineEditField (Field Editing)
```

### **File Naming Conventions**
- **Pages**: `PascalCase` ending with `Page.tsx`
- **Components**: `PascalCase` descriptive names
- **Directories**: `lowercase` or `camelCase`
- **Index files**: `index.ts` for module exports



### Technology Stack
- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS
- **Backend**: Fastify + TypeScript + PostgreSQL + Redis
- **Database**: PostgreSQL 16+ with PostGIS, pgcrypto, uuid-ossp
- **Infrastructure**: Docker Compose (PostgreSQL, Redis, MinIO, MailHog)
- **Tooling**: pnpm workspaces, ESLint, Prettier, tsx
- **Authentication**: JWT with fastify-jwt
- **Package Manager**: pnpm 8.15.1+

### System Components
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Web     │───▶│   Fastify API   │───▶│  PostgreSQL DB  │
│   Port: 5173    │    │   Port: 4000    │    │   Port: 5434    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         │              │   Redis Cache   │              │
         │              │   Port: 6379    │              │
         │              └─────────────────┘              │
         │                                               │
         ▼                                               ▼
┌─────────────────┐                           ┌─────────────────┐
│   TailwindCSS   │                                       └─────────────────┘
```



## Navigation Structure

### Main Navigation Flow
1. **Application Load** → Dashboard with overview metrics
2. **Sidebar Click** → Entity Main Page with data table and action buttons
3. **Row Click** → Entity Detail Page with editable fields and child tabs
4. **Tab Click** → Child Entity filtered data tables
5. **Child Row Click** → Child Entity Detail Page (recursive structure)

### Sidebar Entities
Each sidebar button corresponds to a main entity type:

- **Dashboard** - Overview metrics and charts
- **Projects** - Project management and tracking
- **Business Units** - Organizational hierarchy management
- **Tasks** - Task management and assignment
- **Employees** - Personnel management
- **Organizations** - Client/partner organizations
- **Roles** - User role management
- **Wikis** - Knowledge base articles
- **Artifacts** - Document and file management
- **Forms** - Dynamic form management

## Page Architecture

### Main Pages (Entity List Views)

#### Structure Components
- **Page Header**: Entity icon, title, and description
- **Stats Grid**: Key metrics cards with icons and values
- **Action Buttons Bar**: Create, Share Selected, Delete Selected buttons
- **Data Table**: Searchable, filterable, sortable table with bulk selection

#### Data Flow
- **API Route**: `GET /api/v1/{entity}`
- **Hook**: Entity-specific API hooks (e.g., `projectApi.list()`)
- **State**: Pagination, loading, data arrays
- **Actions**: Individual row actions (View, Edit, Share, Delete) + bulk operations

#### Key Features
- **Bulk Selection**: Checkbox column with select all/none functionality
- **Action Buttons**: Create (top right), Share/Delete (appear when items selected)
- **Real-time Updates**: Auto-refresh after create/delete operations
- **Responsive Design**: Adaptive layouts for different screen sizes

### Detail Pages (Entity Edit Views)

#### Structure Components
- **Dynamic Child Entity Tabs**: Overview + child entity tabs with counts
- **Action Bar**: Edit, Share, and other entity-specific actions
- **Entity Information Cards**: Grouped editable fields by category
- **Inline Edit Fields**: Click-to-edit functionality with save/cancel
- **Child Entity Tables**: Filtered data tables for related entities

#### Data Flow
- **API Route**: `GET /api/v1/{entity}/{id}`
- **Hook**: `useDynamicChildEntityTabs()` for dynamic tab generation
- **State**: Entity data, editing states, field values
- **Navigation**: Dynamic routing based on entity relationships

#### Child Entity Relationships
- **Projects** → Tasks, Wiki, Artifacts, Forms
- **Business Units** → Projects, Employees, Tasks
- **Tasks** → Artifacts, Forms
- **Organizations** → Employees, Projects, Worksites

## Core Reusable Components

### ActionButtonsBar
**Purpose**: Consistent action button layout above data tables

**Features**:
- Create button (always visible) with entity-specific labeling
- Share Selected button (appears when items selected)
- Delete Selected button (appears when items selected)
- Selection count display
- Support for additional custom actions

**State Management**: Receives selection count and callbacks from parent component

### DataTable (Enhanced)
**Purpose**: Advanced data table with selection, sorting, filtering, and actions

**Features**:
- Bulk selection with checkboxes and select-all functionality
- Individual row actions (View, Edit, Share, Delete)
- Advanced filtering with dropdown options per column
- Column visibility toggle and ordering
- Responsive design with horizontal scrolling
- Sticky headers and action columns
- Loading states and empty data handling

**Selection System**: Checkbox column with indeterminate states for partial selections

### DynamicChildEntityTabs
**Purpose**: Dynamic tab navigation for entity detail pages

**Features**:
- Fetches dynamic child entity tabs from API to build tabs
- Shows entity counts per tab (e.g., "Tasks (5)")
- Back button navigation to parent entity
- Active tab highlighting
- Responsive design for mobile devices

**API Integration**: Uses `/api/v1/{entity}/{id}/dynamic-child-entity-tabs` endpoint

### FilteredDataTable
**Purpose**: Complete data table solution with optional action buttons, bulk operations, and inline editing

**Features**:
- Configuration-driven column definitions via entity configuration service
- Pre-filtered data based on parent entity relationship
- Built-in row actions and click handlers
- Optional action buttons bar (Create, Share Selected, Delete Selected)
- Bulk selection with checkbox column and select all/none functionality
- Integration with ActionButtonsBar component
- Supports all standard DataTable features (search, filter, sort, pagination)
- **Inline editing** support for quick field updates directly in the table
- Granular action icon visibility controls (Edit, Delete, View)

**Props**:
- `entityType` (required): The entity type for configuration lookup
- `parentType` (optional): Parent entity type for filtered data
- `parentId` (optional): Parent entity ID for filtered data
- `onRowClick` (optional): Custom row click handler
- `showActionButtons` (default: false): Show action button bar above table
- `createLabel` (optional): Custom create button label
- `onCreateClick` (optional): Custom create handler
- `createHref` (optional): Create button navigation link
- `onBulkShare` (optional): Bulk share handler
- `onBulkDelete` (optional): Bulk delete handler
- **`inlineEditable`** (default: false): Enable inline editing mode - when true, clicking edit icon allows editing fields directly in the table row
- **`showEditIcon`** (default: true): Show/hide edit icon in row actions
- **`showDeleteIcon`** (default: true): Show/hide delete icon in row actions
- **`showActionIcons`** (default: true): Show/hide view icon in row actions (master toggle for action column)

**Inline Editing Behavior**:
When `inlineEditable={true}`:
- Clicking the edit icon (pencil) activates inline editing for that row
- All editable fields in the row become input fields
- "Save" and "Cancel" buttons appear in the actions column
- Save button commits changes via PUT request to the entity API endpoint
- Cancel button discards changes and exits editing mode
- Only one row can be edited at a time

**Usage**: Primary component for main entity pages and child entity displays in detail page tabs

**Example - Settings Page with Inline Editing**:
```tsx
<FilteredDataTable
  entityType="businessLevel"
  inlineEditable={true}
  showEditIcon={true}
  showDeleteIcon={true}
  showActionIcons={false}  // Hide view icon for settings pages
/>
```

**Example - Standard List Page**:
```tsx
<FilteredDataTable
  entityType="project"
  showActionButtons={true}
  createLabel="New Project"
  onBulkDelete={handleBulkDelete}
/>
```

### InlineEditField
**Purpose**: Click-to-edit functionality for detail page fields

**Features**:
- Multiple input types (text, textarea, select, date, number)
- Save/cancel action buttons
- Validation and error handling
- Custom render functions for display values
- Loading states during save operations

**Interaction**: Click field → Edit mode → Save/Cancel → API update → Refresh display

### StatsGrid
**Purpose**: Metrics display with consistent card layout

**Features**:
- Responsive grid layout (1-4 columns)
- Icon integration with color theming
- Value formatting (numbers, percentages, currency)
- Hover effects and visual hierarchy

**Usage**: Main pages to show key entity metrics and KPIs

## API Integration Patterns

### Authentication Flow
1. Login request → JWT token storage
2. All subsequent requests include `Authorization: Bearer {token}` header
3. Token validation and user identification on backend
4. RBAC filtering applied to all data responses

### Data Fetching Patterns
- **List Endpoints**: `GET /api/v1/{entity}` with pagination and filtering
- **Detail Endpoints**: `GET /api/v1/{entity}/{id}` with related data
- **Child Endpoints**: `GET /api/v1/{parent}/{id}/{child}` for filtered relationships
- **Dynamic Child Entity Tabs**: `GET /api/v1/{entity}/{id}/dynamic-child-entity-tabs` for tab navigation

### State Management
- **React Hooks**: useState for local component state
- **API Hooks**: Custom hooks for entity-specific operations
- **Real-time Updates**: Immediate refetch after mutations
- **Optimistic Updates**: UI updates before API confirmation

## User Interaction Journey

### Typical User Flow
1. **Login** → JWT token obtained and stored
2. **Dashboard Load** → Overview metrics displayed
3. **Sidebar Navigation** → Click entity button (e.g., "Projects")
4. **Main Page Load** → Projects table with action buttons loads
5. **Bulk Selection** → Check multiple project rows
6. **Bulk Action** → Click "Delete Selected" → Confirmation dialog
7. **Individual Action** → Click project row → Navigate to detail page
8. **Detail Page** → Editable project fields with child entity tabs
9. **Tab Navigation** → Click "Tasks" tab → Filtered task table
10. **Child Navigation** → Click task row → Task detail page
11. **Edit Operations** → Click field → Edit mode → Save changes
12. **Navigation Back** → Back button or sidebar navigation

### Error Handling
- **Network Errors**: Toast notifications with retry options
- **Validation Errors**: Inline field error messages
- **Permission Errors**: API-level filtering (no frontend error needed)
- **Loading States**: Skeleton screens and loading indicators

## Configuration System

### Entity Configuration
- **Dynamic Field Definitions**: API-driven column and form configurations
- **UI Behavior Settings**: Visibility, editability, rendering options
- **Relationship Mappings**: Parent-child entity connections
- **Validation Rules**: Field-level validation and formatting

### Responsive Design
- **Mobile-First**: Designed for mobile devices with desktop enhancements
- **Flexible Layouts**: CSS Grid and Flexbox for adaptive designs
- **Touch-Friendly**: Appropriate touch targets and gestures
- **Performance Optimized**: Lazy loading and virtual scrolling for large datasets

This architecture provides a scalable, maintainable frontend that efficiently handles complex entity relationships while maintaining security through API-level RBAC enforcement.


Summary: DataTable Props Usage Across Different Pages

  Settings Pages (e.g., Customer Tier, Project Status)

  <FilteredDataTable
    entityType="customerTier"
    inlineEditable={true}        // ✅ Inline editing ENABLED
    showEditIcon={true}          // ✅ Show edit icon
    showDeleteIcon={false}       // ❌ Usually FALSE for settings
    showActionIcons={true}       // ✅ Show action icons
  />

  Why inline editing works well in settings:
  - Simple fields: level_id, level_name, level_descr, sort_order
  - No custom render functions: Fields display plain text
  - Quick edits: Users can edit directly without leaving the page

  ---
  Client/Project Pages (Regular Entity Pages)

  <FilteredDataTable
    entityType="client"
    inlineEditable={true}        // ✅ Can enable inline editing
    showEditIcon={true}          // ✅ Show edit icon
    showDeleteIcon={true}        // ✅ Show delete icon (soft delete)
    showActionIcons={true}       // ✅ Show action icons
  />

  Current issue with client page:
  - Complex columns: Custom render functions for badges, truncation, formatting
  - Many fields: name, descr, city, client_number, contact info, + 4 setting references
  - Inline editing shows input for ALL fields: Even fields with badges/custom rendering

  The fix I applied:
  - Added inlineEditable to the dependency array of rowActions useMemo in FilteredDataTable.tsx
  - This ensures the edit handler properly triggers inline editing mode

  ---
  Key Differences

  | Aspect           | Settings Pages                             | Client/Project Pages                        |
  |------------------|--------------------------------------------|---------------------------------------------|
  | Fields           | Simple (level_id, level_name, level_descr) | Complex (many fields, references, metadata) |
  | Render Functions | Minimal                                    | Many (badges, links, formatting)            |
  | Inline Editing   | Works great                                | Works but shows plain inputs                |
  | Delete           | Usually disabled                           | Enabled (soft delete)                       |
  | Use Case         | Quick config changes                       | Full entity management                      |

  ---
  The Inline Editing Flow (Fixed)

  1. User clicks Edit icon → rowActions[edit].onClick(record) called
  2. FilteredDataTable.handleAction('edit', record):
  if (inlineEditable) {
    setEditingRow(record.id);       // Mark this row as editing
    setEditedData({ ...record });   // Copy all fields to temp storage
  }
  3. DataTable receives updated props:
  editingRow={record.id}  // Now matches this row's ID
  4. DataTable detects isEditing=true (line 731):
  const isEditing = inlineEditable && editingRow === recordId;
  5. Row renders in edit mode (lines 801-808):
    - Background turns blue
    - All columns show <input> fields
    - Save/Cancel buttons appear in Actions column
  6. User edits field → onInlineEdit(rowId, field, value) called
  7. User clicks Save → onSaveInlineEdit(record) → API call
  8. User clicks Cancel → onCancelInlineEdit() → reset state


  Settings sidebar and Settings page:
  The Solution: 1 reusable component (SettingsPage.tsx) with 92 lines that handles ALL 12 settings using dynamic props.

  ---
  How It Works (The Magic Explained)

  Core Concept: Dynamic Entity Type Prop

  // Instead of 13 separate pages, ONE component handles everything:
  <FilteredDataTable
    entityType={activeTab}  // ← This changes based on selected tab
    inlineEditable={true}
  />

  When activeTab changes from 'projectStatus' to 'businessLevel':
  1. React re-renders FilteredDataTable with new entityType prop
  2. FilteredDataTable looks up configuration for that entity in entityConfig.ts
  3. Automatically fetches correct API endpoint
  4. Displays appropriate columns
  5. Enables inline editing functionality

  Same component, different data! 🎯

  ---
  The 4 Key Components

  1. State Management (SettingsPage.tsx:20-21)

  const [activeTab, setActiveTab] = useState<SettingTab>('projectStatus');
  - Single state variable tracks which setting is currently displayed
  - Changes when user clicks a tab

  2. Tab Configuration (SettingsPage.tsx:23-36)

  const tabs = [
    { id: 'projectStatus', label: 'Project Status', icon: KanbanSquare },
    { id: 'businessLevel', label: 'Business Level', icon: Building2 },
    // ... 10 more settings
  ];
  - Adding a new setting? Just add 1 line to this array!
  - Reordering tabs? Just rearrange array elements!

  3. Dynamic Tab Navigation (SettingsPage.tsx:54-77)

  {tabs.map((tab) => (
    <button onClick={() => setActiveTab(tab.id)}>
      <Icon /> {tab.label}
    </button>
  ))}
  - Automatically renders all tabs from configuration
  - Clicking a tab updates activeTab state
  - Active tab gets highlighted styling

  4. Reusable Data Table (SettingsPage.tsx:81-84)

  <FilteredDataTable
    entityType={activeTab}  // Dynamic!
    inlineEditable={true}
  />
  - This is where the DRY principle shines!
  - Same component instance reused for all 12 settings
  - Only the entityType prop changes
  - FilteredDataTable handles everything else automatically

---

## 🏗️ Central Configuration Architecture

This project leverages a **centralized, metadata-driven configuration system** that eliminates code duplication and provides a unified approach to handling 24+ entity types across the platform.

### Overview

Instead of creating separate page components, API handlers, and UI configurations for each of the 24+ entities (project, task, client, office, employee, settings, etc.), the system uses:

1. **Frontend Entity Config** (`entityConfig.ts`) - Single source of truth for UI behavior
2. **Backend Universal Schema** (`universal-schema-metadata.ts`) - Column-level metadata classification
3. **Settings Loader** (`settingsLoader.ts`) - Dynamic dropdown population from database
4. **Three Universal Page Components** - Reusable components that work for ANY entity type
5. **Dynamic Routing** - Routes map entity types to the same universal components

**Benefits:**
- 📉 **94% code reduction** - ~72 component files → 4 core files
- ✅ **Single source of truth** - Change once, applies everywhere
- 🚀 **Fast entity addition** - Add new entity in 4 steps (~50 lines of config)
- 🔒 **Type safety** - TypeScript interfaces ensure config consistency
- 🎯 **Consistent UX** - All entities look and behave the same way

---

### 1️⃣ Frontend Entity Configuration (`entityConfig.ts`)

**Location:** `/apps/web/src/lib/entityConfig.ts` (1,600+ lines)

**Purpose:** Centralized configuration that defines the complete behavior, appearance, and capabilities of ALL entities in the system. Acts as a "schema registry" or "metadata catalog" for the entire frontend application.

**Key Responsibilities:**

#### A. Column Definitions (Table View)
Defines how data appears in data tables, including rendering, sorting, and filtering:

```typescript
columns: [
  {
    key: 'name',
    title: 'Client Name',
    sortable: true,
    filterable: true,
    render: (value, record) => /* Custom rendering */
  },
  {
    key: 'customer_tier_id',
    title: 'Customer Tier',
    loadOptionsFromSettings: true,  // Loads from setting_customer_tier
    inlineEditable: true,            // Enable inline editing
    render: (value, record) => renderBadge(record.customer_tier_name, colorMap)
  }
]
```

**Features:**
- Custom render functions for badges, links, truncation
- `loadOptionsFromSettings: true` - Automatically loads dropdown options from settings tables
- `inlineEditable: true` - Enables click-to-edit in data tables
- Sortable and filterable column configuration

#### B. Field Definitions (Forms & Detail View)
Defines how data is edited and displayed on detail pages and forms:

```typescript
fields: [
  { key: 'name', label: 'Client Name', type: 'text', required: true },
  { key: 'opportunity_funnel_level_id', label: 'Opportunity Funnel',
    type: 'select', loadOptionsFromSettings: true },
  { key: 'tags', label: 'Tags', type: 'array' },
  { key: 'metadata', label: 'Metadata', type: 'jsonb' }
]
```

**Supported Field Types:**
- **Basic:** text, textarea, richtext, number, date
- **Selection:** select, multiselect (with static or dynamic options)
- **Complex:** jsonb (JSON editor), array (tag input)
- **Flags:** required, readonly, disabled, validation rules, placeholders

#### C. View Mode Configuration
Entities can support multiple view modes for different data visualization needs:

```typescript
supportedViews: ['table', 'kanban', 'grid'],
defaultView: 'table'
```

**View Modes:**
- **Table:** Sortable, filterable data table with bulk actions
- **Kanban:** Drag-and-drop board grouped by status/stage (task.stage, project.stage)
- **Grid:** Card-based grid layout with thumbnails (artifacts, employees)

#### D. Settings Integration
The `loadOptionsFromSettings` flag enables automatic dropdown population from database settings tables:

```typescript
{
  key: 'project_stage',
  type: 'select',
  loadOptionsFromSettings: true  // Loads from setting_project_stage via settingsLoader
}
```

**How it works:**
1. Field key `project_stage` maps to `setting_project_stage` via `FIELD_TO_SETTING_MAP`
2. `settingsLoader.ts` fetches `/api/v1/setting?category=projectStage`
3. Results are cached for 5 minutes to minimize API calls
4. Dropdown options auto-populate with active values from database

  E. Child Entity Relationships

  Defines which entities can be children (tabs on
  detail page):

  childEntities: ['project', 'task', 'wiki',
  'artifact', 'form']

  Example: Client entity (line 1007) can have
  projects, tasks, wikis, artifacts, and forms as
  children.

  F. Kanban-Specific Configuration

  For entities with kanban view support:

  kanban: {
    groupByField: 'stage',  // Field to group 
  cards by
    metaTable: 'setting_task_stage',  // Where 
  stage values come from
    cardFields: ['name', 'priority_level',
  'estimated_hours']  // Fields shown on cards
  }

  G. Grid-Specific Configuration

  For entities with grid view support:

  grid: {
    cardFields: ['name', 'email',
  'employee_number', 'phone'],
    imageField: 'uri'  // Optional image field for
   thumbnails
  }

  Helper Functions (lines 86-129)

  - formatDate(dateString): Formats dates as
  YYYY-MM-DD (Canadian format)
  - formatCurrency(amount, currency): Formats as
  $X,XXX.XX CAD
  - renderBadge(value, colorMap): Creates colored
  badge pills (green for "Active", red for
  "Blocked")
  - renderTags(tags[]): Renders tag chips with "+N
   more" for overflow

  Entity Registry

  24+ Entity Configurations (lines 135-1557):

  Core Entities (13):
  1. project - Project management with budget,
  timeline, stakeholders
  2. task - Tasks with priority, stages, hour
  tracking
  3. wiki - Knowledge base pages with publication
  status
  4. artifact - Document/file management
  5. form - Dynamic form definitions with schema
  6. biz - Business units (3-level hierarchy)
  7. office - Office locations (4-level hierarchy)
  8. employee - Employee directory
  9. role - Organizational roles
  10. worksite - Work site locations
  11. client - Customer relationship management
  12. position - Job positions
  13. (Plus more...)

  Settings/Meta Entities (11):
  - projectStage, projectStatus
  - taskStage, taskStatus
  - businessLevel, orgLevel, hrLevel, clientLevel,
   positionLevel
  - opportunityFunnelLevel, industrySector,
  acquisitionChannel, customerTier

  API Integration

  Each entity config includes apiEndpoint:

  apiEndpoint: '/api/v1/client'  // For core 
  entities
  apiEndpoint:
  '/api/v1/setting?category=customerTier'  // For 
  settings

  This tells the universal components which API
  endpoints to call.

  ---
  2. Universal Entity Components

  A. EntityMainPage.tsx (List/Index Page)

  Location: /home/rabin/projects/pmo/apps/web/src/
  pages/EntityMainPage.tsx (280 lines)

  Purpose: Universal listing page that works for
  ANY entity type. One component replaces 24+
  individual list pages.

  Key Features:

  1. Dynamic Data Loading (lines 45-65):
  const apiModule = (api as
  any)[`${entityType}Api`];
  const response = await apiModule.list({ page: 1,
   pageSize: 100 });

  2. Multi-View Support (lines 149-218):
    - Table View: Uses FilteredDataTable component
    - Kanban View: Uses KanbanBoard component with
   drag-and-drop
    - Grid View: Uses GridView component with card
   layout
  3. View Mode Persistence (line 33):
  const [view, setView] = useViewMode(entityType);
    // Persists to localStorage

  4. Dynamic Header (lines 224-256):
    - Entity icon (first letter or lucide icon)
    - Entity plural name (from config)
    - View switcher (only if multiple views
  supported)
    - Create button with dynamic label
  5. Bulk Operations (lines 75-90):
    - Bulk share handler
    - Bulk delete handler with confirmation

  Routing Example (lines 267-280):
  // Single component, multiple routes
  <Route path="/project" element={<EntityMainPage 
  entityType="project" />} />
  <Route path="/task" element={<EntityMainPage 
  entityType="task" />} />
  <Route path="/client" element={<EntityMainPage 
  entityType="client" />} />
  // ... 24+ entities, same component!

  B. EntityDetailPage.tsx (Detail/Show Page)

  Location: /home/rabin/projects/pmo/apps/web/src/
  pages/EntityDetailPage.tsx (542 lines)

  Purpose: Universal detail/show page that
  displays entity data and child entity tabs.

  Key Features:

  1. Dynamic Data Loading (lines 112-146):
  const apiModule = (api as
  any)[`${entityType}Api`];
  const response = await apiModule.get(id);

  2. Inline Editing (lines 148-168):
    - Toggle between view and edit mode
    - Field-level editing based on field type
    - Save/Cancel buttons
    - Special handling for form entities (navigate
   to edit page)
  3. Dynamic Field Rendering (lines 218-345):
    - View Mode: Formatted display (dates, badges,
   JSON)
    - Edit Mode: Input fields based on type (text,
   select, textarea, date, jsonb, array)
    - Custom rendering for each field type
  4. Child Entity Tabs (lines 59-104):
    - Overview tab (always first)
    - Dynamic tabs from API based on entity
  relationships
    - Special handling for form entity (Form Data,
   Edit Submission tabs)
  5. Special Entity Handlers:
    - Wiki (lines 424-429): WikiContentRenderer
  for rich content
    - Form (lines 430-466): InteractiveForm for
  live form preview
    - Task (lines 492-501): TaskDataContainer for
  task-specific data
  6. Nested Routing (line 522):
  <Outlet />  // Renders EntityChildListPage for 
  child entity tabs

  Routing Example (lines 529-542):
  <Route path="/project/:id"
  element={<EntityDetailPage entityType="project" 
  />}>
    <Route path="task" 
  element={<EntityChildListPage childType="task" 
  />} />
    <Route path="wiki" 
  element={<EntityChildListPage childType="wiki" 
  />} />
  </Route>

  C. EntityChildListPage.tsx

  Location: /home/rabin/projects/pmo/apps/web/src/
  pages/EntityChildListPage.tsx

  Purpose: Renders child entity lists within
  parent entity detail pages (e.g., tasks within a
   project).

  Key Features:

  1. Parent-Child Context:
  const { id: parentId } = useParams();  // Gets 
  parent ID from URL
  const parentType = 'project';  // Passed as prop
  const childType = 'task';  // Passed as prop

  2. Filtered Data Loading:
    - Calls API with parent context:
  /api/v1/project/{parentId}/task
    - FilteredDataTable receives parentId and
  parentType props
  3. Multi-View Support:
    - Table view (default)
    - Kanban view (if child entity supports it)
    - Grid view (if child entity supports it)

  ---
  3. Data Flow Architecture

  User clicks "/client"
           ↓
  App.tsx routes to: <EntityMainPage
  entityType="client" />
           ↓
  EntityMainPage.tsx:
    1. getEntityConfig('client') → Loads client
  configuration
    2. Determines current view mode
  (table/kanban/grid)
    3. For table view: Renders <FilteredDataTable
  entityType="client" />
    4. For other views: Calls clientApi.list() and
   renders appropriate view
           ↓
  FilteredDataTable.tsx:
    1. config = getEntityConfig('client')
    2. columns = config.columns → [name, city,
  customer_tier_name, ...]
    3. fetchData() → Calls /api/v1/client
    4. Renders DataTable with dynamic columns
           ↓
  DataTable.tsx:
    1. Renders table with sorting, filtering,
  pagination
    2. Applies custom render functions from column
   config
    3. Shows colored badges for customer_tier_name
    4. Handles inline editing (if enabled)

  ---
  4. Benefits of This Architecture

  ✅ DRY Principle (Don't Repeat Yourself)

  - Before: 24 entity types × 3 pages each (list,
  detail, edit) = 72+ component files
  - After: 3 universal components + 1 config file
  = 4 files total
  - Code Reduction: ~94% reduction in component
  files

  ✅ Single Source of Truth

  - All entity behavior defined in entityConfig.ts
  - Change once, applies everywhere
  - Example: Add new column to client? Edit one
  place in config, appears in table + forms

  ✅ Type Safety

  - TypeScript interfaces ensure config
  consistency
  - Compiler catches missing required fields
  - IntelliSense autocomplete for all config
  options

  ✅ Easy to Extend

  Adding a new entity requires:
  1. Add database table (DDL)
  2. Add API routes (backend)
  3. Add entity config (frontend) - ~50 lines
  4. Add route in App.tsx - 1 line

  Example: Adding "vendor" entity:
  // In entityConfig.ts
  vendor: {
    name: 'vendor',
    displayName: 'Vendor',
    pluralName: 'Vendors',
    apiEndpoint: '/api/v1/vendor',
    columns: [...],
    fields: [...],
    supportedViews: ['table', 'grid'],
    defaultView: 'table'
  }

  // In App.tsx
  <Route path="/vendor" element={<EntityMainPage 
  entityType="vendor" />} />
  <Route path="/vendor/:id" 
  element={<EntityDetailPage entityType="vendor" 
  />} />

  ✅ Consistent UX

  - All entities look and behave the same way
  - Users learn once, apply everywhere
  - Reduces cognitive load

  ✅ Testability

  - Test universal components once
  - Config changes don't require new tests
  - Easier to maintain

  ---
---

### 2️⃣ Backend Universal Schema Metadata (`universal-schema-metadata.ts`)

**Location:** `/apps/api/src/lib/universal-schema-metadata.ts` (790+ lines)

**Purpose:** Automatically classifies database columns based on naming conventions to apply consistent behavior for API restrictions, UI rendering, and permission handling across ALL entities without table-specific metadata.

**Key Features:**

#### Pattern-Based Column Classification
The system analyzes column names and automatically applies metadata:

```typescript
// Exact match patterns
'email': { 'api:pii_masking': true, 'ui:search': true, 'ui:email': true }
'password_hash': { 'api:auth_field': true }  // Never expose
'budget_allocated': { 'api:financial_masking': true, 'financial': true }

// Regex pattern rules
/_status$/ → { 'workflow': true, 'ui:status': true, 'ui:badge': true }
/_date$/ → { 'temporal': true, 'ui:date': true }
/^is_/ → { 'ui:toggle': true }
/_percentage$/ → { 'ui:percentage': true, 'ui:progress': true }
```

#### Metadata Categories

**API Restrictions:**
- `api:auth_field` - Never expose (password_hash, etc.)
- `api:pii_masking` - Mask PII unless authorized (email, phone, salary)
- `api:financial_masking` - Restrict financial data (budget, amounts)
- `api:system_field` - Read-only system fields (id, version, created_ts)

**UI Field Types:**
- `ui:email`, `ui:phone`, `ui:url`, `ui:date`, `ui:number`
- `ui:textarea`, `ui:json`, `ui:toggle`, `ui:multiselect`
- `ui:percentage`, `ui:currency`, `ui:geographic`

**UI Display Modes:**
- `ui:badge` - Colored badge/pill display
- `ui:progress` - Progress bar
- `ui:tags` - Tag chips
- `ui:status` - Status indicator
- `ui:timeline` - Timeline/date display

**Special Behaviors:**
- `flexible` - JSON/JSONB fields for key-value data
- `audit` - Audit trail fields (created_ts, updated_ts)
- `hierarchy` - Self-referencing parent fields
- `permission` - Permission-related arrays
- `financial` - Budget/cost fields
- `workflow` - Status/stage fields

#### Usage in API Endpoints
```typescript
import { filterUniversalColumns, getUniversalComponentProps } from './universal-schema-metadata';

// Filter response data based on user permissions
const filtered = filterUniversalColumns(data, {
  canSeePII: user.role === 'admin',
  canSeeFinancial: user.hasPermission('view_financials')
});

// Get UI props for dynamic forms
const props = getUniversalComponentProps('email');
// Returns: { type: 'email', searchable: true, category: 'contact' }
```

**Benefits:**
- ✅ **Zero configuration** - Works automatically for new columns following naming conventions
- 🔒 **Security by default** - PII and financial data automatically protected
- 🎨 **Consistent UI** - Same field names render the same way across entities
- 📊 **Smart defaults** - Searchable, sortable, filterable fields auto-detected

---

### 3️⃣ Settings Loader (`settingsLoader.ts`)

**Location:** `/apps/web/src/lib/settingsLoader.ts` (270 lines)

**Purpose:** Provides centralized, cached loading of dropdown options from database settings tables for forms, inline editing, and filters.

#### Key Features

**Field-to-Settings Mapping:**
```typescript
const FIELD_TO_SETTING_MAP = {
  'project_stage': 'projectStage',        // → setting_project_stage
  'opportunity_funnel_level_id': 'opportunityFunnelLevel',
  'customer_tier_id': 'customerTier',
  'industry_sector_id': 'industrySector'
  // ... 13 total settings categories
};
```

**Automatic API Endpoint Resolution:**
```typescript
loadFieldOptions('project_stage')
  ↓ maps to category 'projectStage'
  ↓ resolves to endpoint '/api/v1/setting?category=projectStage'
  ↓ fetches and caches results for 5 minutes
  ↓ returns [{value: 0, label: 'Initiation'}, {value: 1, label: 'Planning'}, ...]
```

**Usage in Components:**
```typescript
import { loadFieldOptions, clearSettingsCache } from '@/lib/settingsLoader';

// Load options for a field
const options = await loadFieldOptions('project_stage');

// Batch load multiple fields
const optionsMap = await batchLoadFieldOptions(['project_stage', 'customer_tier_id']);

// Clear cache after updates
clearSettingsCache('projectStage');
```

**Benefits:**
- ⚡ **Performance** - 5-minute cache minimizes database queries
- 🔄 **Real-time** - Dropdown options reflect current database state
- 🎯 **Single source of truth** - Settings managed in database, not hardcoded
- 🧩 **Reusable** - One function works for all setting-driven fields

---

### 🔄 Complete Data Flow Example

**Scenario:** User edits "Project Stage" field on a project

```
1. Frontend (EntityDetailPage)
   - Renders edit form with field: { key: 'project_stage', loadOptionsFromSettings: true }
   ↓
2. Settings Loader
   - Detects loadOptionsFromSettings flag
   - Maps 'project_stage' → 'projectStage' category
   - Checks cache, if miss fetches: /api/v1/setting?category=projectStage
   ↓
3. Backend API (/api/v1/setting)
   - Universal settings endpoint
   - Queries: SELECT * FROM setting_project_stage WHERE active=true
   - Applies universal-schema-metadata to classify columns
   - Returns: [{level_id: 0, level_name: 'Initiation', color_code: '#3B82F6'}, ...]
   ↓
4. Settings Loader (continued)
   - Transforms to: [{value: 0, label: 'Initiation'}, {value: 1, label: 'Planning'}, ...]
   - Caches results for 5 minutes
   ↓
5. Frontend (continued)
   - Dropdown populates with options
   - User selects "Execution" (value: 2)
   - Saves via PUT /api/v1/project/:id
   ↓
6. Backend API (PUT /api/v1/project/:id)
   - Receives: { project_stage: 2 }
   - Validates against setting_project_stage
   - Updates database
   - Clears relevant caches
```

---

### 📚 Entity Configuration Complete Example

**Client Entity Configuration:**

```typescript
client: {
  name: 'client',
  apiEndpoint: '/api/v1/client',

  columns: [
    { key: 'name', title: 'Client Name', sortable: true, filterable: true },
    {
      key: 'customer_tier_id',
      title: 'Customer Tier',
      loadOptionsFromSettings: true,  // Auto-loads from setting_customer_tier
      inlineEditable: true,            // Click-to-edit in table
      render: (v, record) => renderBadge(record.customer_tier_name)
    }
  ],

  fields: [
    { key: 'name', label: 'Client Name', type: 'text', required: true },
    { key: 'customer_tier_id', type: 'select', loadOptionsFromSettings: true }
  ],

  supportedViews: ['table', 'grid'],
  defaultView: 'table',
  childEntities: ['project', 'task']
}
```

**Routing:**
```typescript
// App.tsx - Single universal component handles all clients
<Route path="/client" element={<EntityMainPage entityType="client" />} />
<Route path="/client/:id" element={<EntityDetailPage entityType="client" />}>
  <Route path="project" element={<EntityChildListPage childType="project" />} />
</Route>
```

**Result:**
- `/client` → Client list with inline editable customer tier
- `/client/:id` → Client detail with dropdown populated from database
- `/client/:id/project` → Projects for that client
- All powered by ~50 lines of config + universal components