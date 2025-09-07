# PMO Web Application - Hierarchical Navigation UI/UX

## 🎨 Modern React Enterprise Platform with Hierarchical Entity Management

A sophisticated, RBAC-integrated frontend for PMO Enterprise management, built with **React 19**, **TypeScript**, and **TailwindCSS**. Features hierarchical navigation, parent/action routing, global search, and comprehensive entity management across 12 core entity types.

---

## 🏗️ Technology Stack & Architecture

### 🔧 Core Technologies
- **Framework**: React 19.1.1 with TypeScript 5.5+
- **Build Tool**: Vite 6.1.5 (fast development and production builds)
- **Styling**: TailwindCSS 3.4.0 with modern component patterns
- **State Management**: React Context API + Local state management
- **HTTP Client**: Fetch API with RBAC token integration
- **Icons**: Lucide React 0.542.0 (comprehensive icon library)
- **Routing**: React Router DOM 7.8.2 with hierarchical routing

### 🎨 Design Philosophy
- **Hierarchical Navigation**: Parent/action entity routing with contextual tabs
- **RBAC Integration**: Permission-gated UI elements with helpful tooltips
- **Optimistic Interactions**: Fast UI updates with graceful rollback
- **Minimal Motion**: Subtle transitions and micro-animations
- **Keyboard-First**: ⌘K global search, keyboard navigation throughout

---

## 📊 Entity Architecture & Navigation

### 🗂️ 12 Core Entity Types (Sidebar Navigation)

**Organizational Entities (4)**
```typescript
{ name: 'Business', href: '/biz', icon: Building2, category: 'organizational' }
{ name: 'HR', href: '/hr', icon: Crown, category: 'organizational' }
{ name: 'Clients', href: '/client', icon: Star, category: 'organizational' }
{ name: 'Organization', href: '/org', icon: MapPin, category: 'organizational' }
```

**Operational Entities (3)**
```typescript
{ name: 'Projects', href: '/project', icon: FolderOpen, category: 'operational' }
{ name: 'Worksite', href: '/worksite', icon: Building2, category: 'operational' }
{ name: 'Tasks', href: '/task', icon: CheckSquare, category: 'operational' }
```

**Personnel Entities (2)**
```typescript
{ name: 'Roles', href: '/role', icon: UserCheck, category: 'personnel' }
{ name: 'Employees', href: '/employee', icon: Users, category: 'personnel' }
```

**Content Entities (3)**
```typescript
{ name: 'Wiki', href: '/wiki', icon: BookOpen, category: 'content' }
{ name: 'Forms', href: '/form', icon: FileText, category: 'content' }
{ name: 'Artifacts', href: '/artifact', icon: FileText, category: 'content' }
```

---

## 🧭 Hierarchical Routing Structure

### Parent/Action Route Patterns

**Project Context Routes**
```typescript
/project                    → ProjectPage (list view)
/project/:projectId         → ProjectDetailPage (overview)
/project/:projectId/tasks   → ProjectTasksPage (with Kanban toggle)
/project/:projectId/artifacts → ProjectArtifactsPage (preview + versioning)
/project/:projectId/wiki    → ProjectWikiPage
/project/:projectId/forms   → ProjectFormsPage
```

**Business Context Routes**
```typescript
/biz                        → BusinessPage (list view)
/biz/:bizId                 → BusinessDetailPage (overview)
/biz/:bizId/projects        → BusinessProjectsPage
/biz/:bizId/artifacts       → BusinessArtifactsPage
```

**Task Detail Routes**
```typescript
/project/:projectId/task/:taskId → TaskDetailPage (with tabs)
/project/:projectId/task/:taskId/notes → Case notes
/project/:projectId/task/:taskId/activity → Activity timeline
```

---

## 🧩 Core Component Architecture

### 🗂️ HeaderTabNavigation Component

**File**: `/components/common/HeaderTabNavigation.tsx`

```typescript
interface HeaderTabNavigationProps {
  title: string;              // Page title
  parentType: string;         // Entity type (project, biz, etc.)
  parentId: string;          // Parent entity UUID
  parentName?: string;       // Display name for breadcrumb
  tabs: HeaderTab[];         // Tab configuration
  className?: string;
}

interface HeaderTab {
  id: string;               // Tab identifier
  label: string;            // Display text
  count?: number;           // Entity count badge
  icon?: React.ComponentType<any>;
  path: string;             // Navigation path
  disabled?: boolean;       // RBAC-controlled
  tooltip?: string;         // Permission tooltip
}
```

**Usage in Pages**:
```typescript
// Project Detail Page
const { tabs, loading } = useHeaderTabs('project', projectId!);
<HeaderTabNavigation
  title="Project Overview"
  parentType="project"
  parentId={projectId!}
  parentName={projectData?.name}
  tabs={tabs}
/>
```

**API Integration**:
- Fetches tab data from `/api/v1/:parentType/:parentId/action-summaries`
- Automatically generates tabs based on entity hierarchy permissions
- Displays entity counts per tab with RBAC filtering

### 🔍 GlobalSearch Component

**File**: `/components/common/GlobalSearch.tsx`

```typescript
interface GlobalSearchProps {
  className?: string;
}

// Compact version for header
export function GlobalSearchCompact()
```

**Features**:
- **Keyboard Shortcut**: ⌘K or Ctrl+K to open
- **Typeahead Search**: Searches across all entity types
- **RBAC Filtered**: Only shows accessible entities
- **Breadcrumb Context**: Shows entity relationships
- **Keyboard Navigation**: ↑↓ to navigate, Enter to select

**API Integration**:
- Uses `/api/v1/search/global?q={query}&limit={n}`
- Returns entity type counts and match scores
- Respects user permissions automatically

### 🔐 RBAC Components

**File**: `/components/common/RBACButton.tsx`

**RBACButton Component**:
```typescript
interface RBACButtonProps {
  children: React.ReactNode;
  permission: RBACPermission;    // Permission requirement
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  tooltip?: string;             // Custom tooltip for denied access
}

interface RBACPermission {
  entityType: string;           // Entity type
  entityId?: string;           // Specific entity UUID
  action: 'create' | 'view' | 'edit' | 'share' | 'delete';
  parentEntityType?: string;    // For creation in parent context
  parentEntityId?: string;     // Parent entity UUID
}
```

**RBACCreateButton Component**:
```typescript
interface RBACCreateButtonProps {
  entityType: string;          // What to create
  parentEntityType?: string;   // Parent context
  parentEntityId?: string;     // Parent UUID
  onCreateClick?: () => void;
  createUrl?: string;
  size?: 'sm' | 'md' | 'lg';
}
```

**ActionBar Component**:
```typescript
interface ActionBarProps {
  title?: string;
  createButton?: {
    entityType: string;
    parentEntityType?: string;
    parentEntityId?: string;
    onCreateClick?: () => void;
    createUrl?: string;
  };
  scopeFilters?: React.ReactNode;
  additionalActions?: React.ReactNode;
}
```

### 📂 ScopeFilters Component

**File**: `/components/common/ScopeFilters.tsx`

```typescript
interface ScopeFiltersProps {
  entityType: string;          // Entity being filtered
  selectedScopes: string[];    // Selected scope IDs
  onScopeChange: (scopes: string[]) => void;
  className?: string;
}

interface FilterChipsProps {
  filters: Array<{
    id: string;
    label: string;
    count?: number;             // Optional count badge
    active: boolean;
    onClick: () => void;
  }>;
  className?: string;
}
```

**API Integration**:
- Fetches scope options from `/api/v1/filters/scopes?entity_type={type}`
- Returns business units, projects, and other contextual filters
- Shows entity counts per scope

---

## 📄 Page Component Architecture

### 🏗️ Project Detail Pages

**ProjectDetailPage** (`/pages/project/ProjectDetailPage.tsx`)
```typescript
// Route: /project/:projectId
const { projectId } = useParams<{ projectId: string }>();
const { tabs, loading } = useHeaderTabs('project', projectId!);

// Layout Structure:
<Layout>
  <HeaderTabNavigation />
  <ActionBar createButton={{ entityType: 'project' }} />
  <ProjectOverviewContent />
</Layout>
```

**ProjectTasksPage** (`/pages/project/ProjectTasksPage.tsx`)
```typescript
// Route: /project/:projectId/tasks
// Features: Grid ↔ Kanban toggle
const [viewMode, setViewMode] = useState<'grid' | 'kanban'>('grid');

// Kanban Implementation:
<KanbanBoard projectId={projectId!} />  // Drag-drop status updates
```

**ProjectArtifactsPage** (`/pages/project/ProjectArtifactsPage.tsx`)
```typescript
// Route: /project/:projectId/artifacts
// Features: Artifact preview modal, type filtering

interface Artifact {
  id: string;
  name: string;
  artifact_type: string;
  file_size?: number;
  mime_type?: string;
}

<ArtifactCard onPreview={setPreviewArtifact} />
<ArtifactPreview artifact={previewArtifact} onClose={() => setPreviewArtifact(null)} />
```

### 🏢 Business Detail Pages

**BusinessDetailPage** (`/pages/business/BusinessDetailPage.tsx`)
```typescript
// Route: /biz/:bizId
const { bizId } = useParams<{ bizId: string }>();
const { tabs } = useHeaderTabs('biz', bizId!);
```

**BusinessProjectsPage** (`/pages/business/BusinessProjectsPage.tsx`)
```typescript
// Route: /biz/:bizId/projects
// Shows projects filtered by business unit
```

### 📋 Task Detail Page

**TaskDetailPage** (`/pages/TaskDetailPage.tsx`)
```typescript
// Route: /project/:projectId/task/:taskId
const { projectId, taskId } = useParams<{ projectId: string; taskId: string }>();

// Tab Configuration:
const tabs = [
  { id: 'details', label: 'Details', icon: FileText },
  { id: 'notes', label: 'Case Notes', icon: MessageSquare },
  { id: 'forms', label: 'Forms', icon: FileText },
  { id: 'artifacts', label: 'Artifacts', icon: FileText },
  { id: 'activity', label: 'Activity', icon: Activity },
];
```

---

## 🎛️ Layout System

### 🏠 Main Layout Component

**File**: `/components/layout/Layout.tsx`

```typescript
interface LayoutProps {
  children: ReactNode;
  showFullscreenToggle?: boolean;
  fullscreenHeader?: ReactNode;
  hideFloatingToggle?: boolean;
  createButton?: CreateButtonConfig;
}
```

**Layout Structure**:
```jsx
<Layout>
  {/* Collapsible Sidebar */}
  <div className="sidebar">
    <LogoSection />
    <EntityNavigation />        // 12 entity types
    <UserProfileSection />
  </div>

  {/* Main Content Area */}
  <div className="main-content">
    <header>                   // Global header bar
      <GlobalSearchCompact />  // ⌘K search
      <ActionButtons />        // RBAC-gated actions
    </header>
    <main>
      {children}              // Page content
    </main>
  </div>
</Layout>
```

**Navigation Items**:
```typescript
const mainNavigationItems = [
  // All 12 entity types with proper categorization
  { name: 'Business', href: '/biz', icon: Building2, category: 'organizational' },
  { name: 'Projects', href: '/project', icon: FolderOpen, category: 'operational' },
  // ... remaining 10 entities
];
```

---

## 🔗 API Integration Patterns

### 🌐 API Endpoints Mapping

**Entity Management**:
```typescript
GET /api/v1/:entityType                     // List entities
GET /api/v1/:entityType/:id                 // Get single entity
POST /api/v1/:entityType                    // Create entity
PUT /api/v1/:entityType/:id                 // Update entity
DELETE /api/v1/:entityType/:id              // Delete entity
```

**Hierarchical Operations**:
```typescript
GET /api/v1/:parentType/:parentId/:actionType          // List action entities
GET /api/v1/:parentType/:parentId/action-summaries     // Header tab data
POST /api/v1/:parentType/:parentId/:actionType         // Create in context
```

**Specialized Endpoints**:
```typescript
GET /api/v1/search/global?q={query}                    // Global search
GET /api/v1/filters/scopes?entity_type={type}          // Scope filters
PATCH /api/v1/task/:taskId/status                      // Kanban status update
GET /api/v1/project/:projectId/tasks/kanban            // Kanban data
GET /api/v1/artifact/:artifactId/preview               // Artifact preview
```

### 🔐 RBAC API Integration

**Permission Checking**:
```typescript
POST /api/v1/rbac/check-permission
{
  "entity_type": "project",
  "entity_id": "uuid",
  "action": "view"
}

POST /api/v1/rbac/check-creation
{
  "parent_entity_type": "project",
  "parent_entity_id": "uuid",
  "action_entity_type": "task"
}
```

**Token Management**:
```typescript
// All requests include Bearer token
headers: {
  'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
  'Content-Type': 'application/json',
}
```

---

## 🎨 Component Props Reference

### HeaderTabNavigation Props
```typescript
title: string                    // Page title
parentType: string               // 'project', 'biz', etc.
parentId: string                 // UUID
parentName?: string              // Display name
tabs: HeaderTab[]                // Tab configuration
className?: string               // Additional styling
```

### RBACButton Props
```typescript
permission: RBACPermission       // Permission requirement
onClick?: () => void             // Click handler
variant?: ButtonVariant          // Styling variant
size?: ButtonSize               // Size variant
icon?: LucideIcon               // Optional icon
tooltip?: string                // Custom permission tooltip
```

### ScopeFilters Props
```typescript
entityType: string              // Entity being filtered
selectedScopes: string[]        // Selected scope IDs
onScopeChange: (string[]) => void  // Selection handler
className?: string              // Additional styling
```

### ActionBar Props
```typescript
title?: string                  // Optional title
createButton?: CreateConfig     // Create button config
scopeFilters?: ReactNode        // Filter components
additionalActions?: ReactNode   // Extra action buttons
className?: string              // Additional styling
```

---

## 🚀 Key Features & Capabilities

### ✅ Implemented Features

**Hierarchical Navigation**
- 12 entity types in organized sidebar
- Parent/action routing patterns
- Dynamic tab generation from API
- RBAC-integrated navigation

**Global Search (⌘K)**
- Cross-entity typeahead search
- Keyboard navigation support
- RBAC-filtered results
- Breadcrumb context display

**RBAC Integration**
- Permission-gated UI elements
- Contextual tooltips for denied access
- Parent/child creation permissions
- Entity-specific action controls

**Kanban Views**
- Drag-drop task status updates
- Real-time API synchronization
- Visual status columns
- Optimistic UI updates

**Artifact Management**
- Preview modal system
- Version tracking support
- Type-based filtering
- Contextual artifact organization

**Enhanced Components**
- Responsive design throughout
- Loading states and error handling
- Keyboard accessibility
- Professional visual design

### 🔧 Architecture Strengths

**Type Safety**: Full TypeScript integration with proper interfaces
**Modularity**: Reusable, prop-driven component architecture
**Performance**: Efficient rendering and API integration
**Accessibility**: Keyboard navigation and ARIA compliance
**Maintainability**: Clear separation of concerns and consistent patterns

This refactored PMO web application provides a **sophisticated, hierarchical navigation system** with comprehensive RBAC integration, global search capabilities, and contextual entity management suitable for enterprise-scale project management operations.