# PMO Platform - Complete UI/UX, Routing & API Architecture

> **Comprehensive mapping of the entire PMO platform architecture** - From database tables to frontend components, showing how all layers work together using DRY principles.
>
> **Last Updated:** 2025-10-27 | **Status:** Production v2.1 (Hierarchy Mapping + Security Fixes)
>
> **v2.1 Updates (2025-10-27):**
> - ✅ Parent-child entity endpoints with automatic relationship detection
> - ✅ Dual query strategy: foreign_key vs linkage-based relationships
> - ✅ SQL injection vulnerability fixed (parameterized queries)
> - ✅ Entity metadata styling consistency (DRY principles)
> - ✅ Flexible JSONB schema validation for dynamic fields
>
> **v2.0 Updates:**
> - ✅ Edit, Share, and Link buttons now available on ALL entity detail pages
> - ✅ ShareModal no longer conditional (removed config.shareable restriction)
> - ✅ LinkModal universally accessible for relationship management
> - ✅ Consistent UX across all 18+ entity types

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Database Layer (52 DDL Files)](#database-layer-52-ddl-files)
4. [API Layer (31+ Modules)](#api-layer-31-modules)
5. [Frontend Layer (Universal Components)](#frontend-layer-universal-components)
6. [Complete Data Flow Examples](#complete-data-flow-examples)
7. [Entity Configuration System](#entity-configuration-system)
8. [Settings & Sequential States](#settings--sequential-states)
9. [Routing Architecture](#routing-architecture)
10. [RBAC & Permissions](#rbac--permissions)
11. [Deployment Architecture](#deployment-architecture)
12. [DRY Principles Implementation](#dry-principles-implementation)

---

## Architecture Overview

### System Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER (React 19)                     │
│  • 3 Universal Pages (EntityMainPage, EntityDetailPage, etc.)    │
│  • Single Entity Config (entityConfig.ts - 2,244 lines)          │
│  • Centralized Icons (entityIcons.ts - 103 lines)                │
│  • Auto-generated Routes (App.tsx)                               │
└─────────────────────────────────────────────────────────────────┘
                              ↕ HTTP/REST
┌─────────────────────────────────────────────────────────────────┐
│                    API LAYER (Fastify)                           │
│  • 31 API Modules (auth, entities, settings, RBAC, etc.)         │
│  • JWT Authentication                                             │
│  • Entity-based RBAC middleware                                  │
│  • Unified endpoint structure                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↕ SQL
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER (PostgreSQL 14+)               │
│  • 52 DDL Files (13 core entities, 16 settings, 23 support)      │
│  • Unified RBAC tables (entity_id_rbac_map)                      │
│  • Relationship mapping (entity_id_map)                          │
│  • Schema: app                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**DRY Principle:** Each entity is configured ONCE in `entityConfig.ts` and automatically propagates to routes, pages, API calls, and UI components.

---

## Technology Stack

### Frontend (`apps/web`)
- **Framework:** React 19 with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS v4
- **Icons:** Lucide React
- **Routing:** React Router v6
- **State:** React Context + Hooks
- **HTTP:** Fetch API with centralized client
- **Port:** 5173 (dev), 5173 (production via nginx)

### Backend (`apps/api`)
- **Framework:** Fastify v5
- **Language:** TypeScript (ESM modules)
- **Database:** PostgreSQL 14+ via node-postgres
- **Authentication:** JWT (jsonwebtoken)
- **File Storage:** AWS S3 (unified backend for all uploads - artifacts, forms, signatures)
- **Email:** NodeMailer with MailHog (local) / AWS SES (production)
- **Port:** 4000

### Database (`db`)
- **Engine:** PostgreSQL 14+
- **Schema:** `app`
- **Files:** 52 DDL files with dependencies
- **Import Tool:** `./tools/db-import.sh`
- **Port:** 5434 (Docker), 5432 (RDS production)

### Infrastructure (`infra-tf`)
- **IaC:** Terraform (AWS provider)
- **Hosting:** EC2 t3.medium (Ubuntu 22.04)
- **Storage:** AWS S3 for artifacts, forms, signatures, code bundles (unified S3AttachmentService)
- **Database:** Docker PostgreSQL (dev), RDS Postgres (planned)
- **Deployment:** Automated via `deploy-code.sh` script
- **Monitoring:** CloudWatch logs, EventBridge automation

---

## Database Layer (52 DDL Files)

### File Organization

```
db/
├── Core Entity Tables (13 files)
│   ├── 11_d_employee.ddl          - Employees with auth
│   ├── 12_d_office.ddl            - Office locations (4-level hierarchy)
│   ├── 13_d_business.ddl          - Business units (3-level hierarchy)
│   ├── 14_d_cust.ddl              - Customers/clients
│   ├── 15_d_role.ddl              - Organizational roles
│   ├── 16_d_position.ddl          - Employee positions
│   ├── 17_d_worksite.ddl          - Work site locations
│   ├── 18_d_project.ddl           - Projects with budgets/timelines
│   ├── 19_d_task.ddl              - Tasks linked to projects
│   ├── 21_d_artifact.ddl          - Documents & attachments
│   ├── 23_d_form_head.ddl         - Form definitions
│   ├── 25_d_wiki.ddl              - Knowledge base articles
│   └── 35_d_email_template.ddl    - Email templates
│
├── Settings/Configuration Tables (16 files)
│   ├── setting_datalabel__office_level.ddl
│   ├── setting_datalabel__business_level.ddl
│   ├── setting_datalabel__project_stage.ddl
│   ├── setting_datalabel__task_stage.ddl
│   ├── setting_datalabel__task_priority.ddl
│   ├── setting_datalabel__position_level.ddl
│   ├── setting_datalabel__opportunity_funnel_stage.ddl
│   ├── setting_datalabel__industry_sector.ddl
│   ├── setting_datalabel__acquisition_channel.ddl
│   ├── setting_datalabel__customer_tier.ddl
│   ├── setting_datalabel__client_level.ddl
│   ├── setting_datalabel__client_status.ddl
│   ├── setting_datalabel__task_update_type.ddl
│   ├── setting_datalabel__wiki_publication_status.ddl
│   ├── setting_datalabel__form_approval_status.ddl
│   └── setting_datalabel__form_submission_status.ddl
│
└── Support/Infrastructure Tables (23 files)
    ├── 01_extensions.ddl           - PostgreSQL extensions
    ├── 02_schema.ddl               - Schema creation
    ├── 03_d_entity.ddl             - Entity type metadata
    ├── 33_d_entity_id_map.ddl      - Parent-child relationships
    ├── 34_d_entity_id_rbac_map.ddl - Permission system
    ├── 37_rel_emp_role.ddl         - Employee-role assignments
    └── ... (other support tables)
```

### Key Tables by Purpose

#### Core Data Tables (Prefix: `d_`)

| Table | Stores | Key Fields | Sample Count |
|-------|--------|------------|--------------|
| `d_employee` | User accounts | id, email, password_hash, name | 5 employees |
| `d_office` | Office locations | id, name, office_level_id, parent_id | 4-level hierarchy |
| `d_business` | Business units | id, name, business_level_id, parent_id | 3-level hierarchy |
| `d_project` | Projects | id, name, code, project_stage, budget_allocated | 5 projects |
| `d_task` | Tasks | id, name, stage, priority_level, assigned_to | 8 tasks |
| `d_client` (`d_cust`) | Customers | id, name, cust_level, opportunity_funnel_stage | Sample data |
| `d_role` | Organizational roles | id, name, role_level | 22 roles |
| `d_position` | Employee positions | id, name, position_level | 16 positions |
| `d_worksite` | Work sites | id, name, location | Sample data |
| `d_artifact` | Documents/files | id, name, file_path, entity_id, entity_type | Linked artifacts |
| `d_wiki` | Knowledge base | id, title, content, publication_status | Wiki articles |
| `d_form_head` | Form definitions | id, name, schema (JSONB), approval_status | Dynamic forms |
| `d_email_template` | Email templates | id, name, subject, body_html | Marketing emails |

#### Settings Tables (Prefix: `setting_datalabel_`)

| Table | Category | Purpose | Fields |
|-------|----------|---------|--------|
| `setting_datalabel_project_stage` | `project_stage` | Project lifecycle | level_id, level_name, sort_order, parent_id |
| `setting_datalabel_task_stage` | `task_stage` | Task workflow | stage_id, stage_name, sort_order, color_code |
| `setting_datalabel_task_priority` | `task_priority` | Task priority levels | level_id, level_name, sort_order |
| `setting_datalabel_office_level` | `office_level` | Office hierarchy (4 levels) | level_id, level_name, parent_id |
| `setting_datalabel_business_level` | `business_level` | Business hierarchy (3 levels) | level_id, level_name, parent_id |
| `setting_datalabel_opportunity_funnel_stage` | `opportunity_funnel_stage` | Sales pipeline | stage_id, stage_name, sort_order |

**All settings tables follow this structure:**
```sql
CREATE TABLE app.setting_datalabel_<category> (
  level_id INT PRIMARY KEY,        -- Unique identifier
  level_name TEXT NOT NULL,        -- Display name
  slug TEXT,                        -- URL-friendly name
  sort_order INT,                   -- Sequential ordering
  parent_id INT,                    -- Hierarchical parent (optional)
  level_descr TEXT,                 -- Description
  active_flag BOOLEAN DEFAULT true, -- Soft delete
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Infrastructure Tables

| Table | Purpose | Key Usage |
|-------|---------|-----------|
| `d_entity` | Entity type metadata | Icons, display names, parent-child config |
| `entity_id_map` | Parent-child relationships | Links projects→tasks, etc. |
| `entity_id_rbac_map` | RBAC permissions | Stores {empid, entity, entity_id, permission[]} |
| `rel_emp_role` | Employee-role assignments | Many-to-many relationship |

---

## API Layer (31+ Modules)

### Module Structure

Located in `apps/api/src/modules/`, each module follows this pattern:
```
module-name/
├── routes.ts       - Fastify route definitions
├── service.ts      - Business logic (optional)
└── schema.ts       - Request/response schemas (optional)
```

### Core Modules (apps/api/src/modules/index.ts)

#### Authentication & Core Services
```typescript
// Authentication (no auth required)
authRoutes → /api/v1/auth
  POST /login        - JWT login
  POST /register     - User registration
  GET  /me          - Current user info

// Configuration
configRoutes → /api/v1/config
  GET /             - Frontend configuration

// Schema introspection
schemaRoutes → /api/v1/schema
  GET /:entityType  - Database schema for entity
```

#### Entity-Based CRUD Modules (13 core entities)

Each entity module provides standard REST endpoints:

```typescript
// Employee module
empRoutes → /api/v1/employee
  GET    /              - List employees (with RBAC filtering)
  GET    /:id           - Get employee by ID
  POST   /              - Create employee (requires permission 4)
  PUT    /:id           - Update employee (requires permission 1)
  DELETE /:id           - Delete employee (requires permission 3)
  GET    /:id/tasks     - Get employee's tasks
  GET    /:id/projects  - Get employee's projects

// Project module
projectRoutes → /api/v1/project
  GET    /              - List projects
  GET    /:id           - Get project by ID
  POST   /              - Create project
  PUT    /:id           - Update project
  DELETE /:id           - Delete project
  GET    /:id/tasks     - Get project tasks
  GET    /:id/employees - Get project team members

// Task module
taskRoutes → /api/v1/task
  GET    /              - List tasks (supports ?parentId=X&parentType=Y)
  GET    /:id           - Get task by ID
  POST   /              - Create task
  PUT    /:id           - Update task
  PATCH  /:id/stage     - Update task stage (for kanban)
  DELETE /:id           - Delete task

// All 13 entity modules:
• empRoutes         → /api/v1/employee
• projectRoutes     → /api/v1/project
• taskRoutes        → /api/v1/task
• roleRoutes        → /api/v1/role
• custRoutes        → /api/v1/cust
• formRoutes        → /api/v1/form
• wikiRoutes        → /api/v1/wiki
• artifactRoutes    → /api/v1/artifact
• bizRoutes         → /api/v1/biz
• officeRoutes      → /api/v1/office
• positionRoutes    → /api/v1/position
• worksiteRoutes    → /api/v1/worksite
• emailTemplateRoutes → /api/v1/email-template
```

#### Universal/Shared Modules

```typescript
// Settings (centralized dropdown options)
settingRoutes → /api/v1/setting
  GET /?category=X  - Get settings by category
  Examples:
    /api/v1/setting?category=project_stage
    /api/v1/setting?category=task_stage
    /api/v1/setting?category=customer_tier

// Entity metadata (parent-child relationships, icons)
entityRoutes → /api/v1/entity
  GET /                        - List all entity types
  GET /child-tabs/:entityType/:entityId - Get child tabs for entity

// Entity options (universal dropdown/select options)
entityOptionsRoutes → /api/v1/entity
  GET /:entityType/options     - Get {id, name} pairs for entity
  Example: /api/v1/entity/employee/options
    Returns: [{ id: 'uuid', name: 'John Doe' }, ...]

// Parent-Action Entity Routes (Hierarchical Relationships)
parentActionEntityRoutes → /api/v1/:parentEntity/:parentId/:actionEntity
  GET /:parentEntity/:parentId/:actionEntity
    - List child entities within parent context
    - Supports both foreign_key and linkage-based relationships
    - Automatically determines relationship type from configuration
    - Examples:
      /api/v1/project/uuid/task     → Tasks in project (foreign_key)
      /api/v1/task/uuid/form        → Forms linked to task (linkage)
      /api/v1/task/uuid/artifact    → Artifacts linked to task (linkage)

  Relationship Types:
    • foreign_key: Direct JOIN via foreign key column
      Example: task.project_id → project.id

    • linkage: JOIN via app.d_entity_id_map table
      Example: task → form (through entity_id_map)

  Supported Relationships:
    project → task, form, wiki*, artifact*
    biz → project, task, form, client, employee, wiki*, artifact*
    worksite → task, form, employee
    org → worksite, employee
    hr → employee, role*
    client → project*, task
    task → form*, artifact*
    role → employee*

    * = Uses linkage table (app.d_entity_id_map)

  Query Parameters:
    ?page=1&limit=20    - Pagination
    ?search=term        - Full-text search
    ?active=true        - Filter by active status
    ?sortBy=name        - Sort field
    ?sortOrder=asc      - Sort direction

// RBAC permission checking
rbacRoutes → /api/v1/rbac
  GET /check                   - Check permission
  POST /grant                  - Grant permission
  POST /revoke                 - Revoke permission

// Shared URLs (public entity viewing)
sharedRoutes → /api/v1/shared
  GET /:code                   - Get shared entity by code
  POST /create                 - Create shared URL

// S3 Backend API (Unified Upload System) - DRY principle
s3BackendRoutes → /api/v1/s3-backend
  POST /presigned-upload       - Get presigned upload URL
  POST /presigned-download     - Get presigned download URL
  GET  /list/:entityType/:entityId - List attachments by entity
  DELETE /attachment           - Delete attachment from S3
  GET  /health                 - S3 connectivity check
```

#### Product & Operations Modules (5 additional entities)

```typescript
productRoutes    → /api/v1/product     - Product catalog
inventoryRoutes  → /api/v1/inventory   - Inventory management
orderRoutes      → /api/v1/order       - Order processing
shipmentRoutes   → /api/v1/shipment    - Shipment tracking
invoiceRoutes    → /api/v1/invoice     - Invoice management
```

### API Middleware Stack

```typescript
// Request flow
1. CORS middleware (all origins in dev)
2. JWT authentication (except /auth and /shared)
3. RBAC permission check (entity-based)
4. Request validation (schemas)
5. Route handler
6. Response serialization
7. Error handling
```

### RBAC Permission Checking

Every entity endpoint checks permissions:

```typescript
// Example: GET /api/v1/project/:id
async function getProject(request, reply) {
  const { id } = request.params;
  const userId = request.user.id; // From JWT

  // Check view permission (0)
  const hasPermission = await checkEntityPermission(
    userId,
    'project',
    id,      // Specific project OR 'all' for type-level
    0        // 0=view, 1=edit, 2=share, 3=delete, 4=create
  );

  if (!hasPermission) {
    return reply.status(403).send({ error: 'Forbidden' });
  }

  // Fetch project
  const project = await db.query(
    'SELECT * FROM app.d_project WHERE id = $1',
    [id]
  );

  return reply.send(project);
}
```

---

## Frontend Layer (Universal Components)

### Component Architecture

```
apps/web/src/
├── components/
│   ├── shared/
│   │   ├── layout/
│   │   │   └── Layout.tsx              - Main app layout + sidebar
│   │   ├── entity/
│   │   │   ├── EntityFormContainer.tsx - Universal form wrapper
│   │   │   ├── SequentialStateVisualizer.tsx - Timeline component
│   │   │   └── DynamicChildEntityTabs.tsx    - Dynamic tab system
│   │   ├── modal/                      - **NEW: Universal Modal System**
│   │   │   ├── Modal.tsx               - Base modal component
│   │   │   ├── ShareModal.tsx          - Share to users/roles/public
│   │   │   ├── LinkModal.tsx           - Entity linkage management
│   │   │   └── index.ts                - Modal exports
│   │   ├── table/
│   │   │   ├── DataTable.tsx           - Reusable table component
│   │   │   └── FilteredDataTable.tsx   - Table with filtering
│   │   ├── ui/
│   │   │   ├── KanbanView.tsx          - Kanban board component
│   │   │   └── SearchableMultiSelect.tsx - Multi-select dropdown
│   │   └── button/
│   │       └── Button.tsx              - Standardized button
│   └── entity/
│       └── form/
│           ├── FormBuilder.tsx         - Dynamic form generator
│           └── InteractiveForm.tsx     - Form submission viewer
│
├── lib/
│   ├── entityConfig.ts                 - **SINGLE SOURCE OF TRUTH**
│   ├── entityIcons.ts                  - Centralized icon mappings
│   ├── sequentialStateConfig.ts        - Sequential state patterns
│   ├── api.ts                          - API client factory
│   ├── settingsLoader.ts               - Settings cache/loader
│   └── hooks/
│       └── useKanbanColumns.ts         - Kanban column management
│
└── pages/
    └── shared/
        ├── EntityMainPage.tsx          - List view (table/kanban/grid)
        ├── EntityDetailPage.tsx        - Detail view with tabs
        ├── EntityCreatePage.tsx        - Create form
        └── EntityChildListPage.tsx     - Filtered child list
```

### 3 Universal Pages Handle All Entities

#### 1. EntityMainPage (List View)

**File:** `apps/web/src/pages/shared/EntityMainPage.tsx`

**Purpose:** Display list of entities in table, kanban, or grid view

**Features:**
- ✅ Auto-loads entity config from `getEntityConfig(entityType)`
- ✅ Supports 3 view modes: table, kanban, grid
- ✅ Row click → Navigate to detail page
- ✅ Create button (if user has permission 4)
- ✅ Bulk actions (share, delete)
- ✅ Inline editing for configured columns

**Used by:** All 13+ entity types

**Example URLs:**
- `/project` → Lists all projects
- `/task` → Lists all tasks
- `/employee` → Lists all employees

**Code:**
```tsx
export function EntityMainPage({ entityType }: { entityType: string }) {
  const config = getEntityConfig(entityType); // Load config
  const api = APIFactory.getAPI(entityType);  // Create API client
  const [data, setData] = useState([]);
  const [viewMode, setViewMode] = useState<ViewMode>(config.defaultView);

  useEffect(() => {
    // Load data
    api.list().then(setData);
  }, []);

  const handleRowClick = (item: any) => {
    navigate(`/${entityType}/${item.id}`);
  };

  // Render based on view mode
  if (viewMode === 'table') {
    return <DataTable columns={config.columns} data={data} onRowClick={handleRowClick} />;
  } else if (viewMode === 'kanban') {
    return <KanbanBoard config={config.kanban} data={data} />;
  } else {
    return <GridView data={data} />;
  }
}
```

#### 2. EntityDetailPage (Detail View)

**File:** `apps/web/src/pages/shared/EntityDetailPage.tsx`

**Purpose:** Show individual entity with dynamic tabs for child entities

**Features:**
- ✅ **Enhanced Header (NEW v2.0)** - Redesigned for better UX
  - Entity type + name displayed prominently
  - Code, slug, ID shown with one-click copy buttons
  - Editable in edit mode (saves with form fields)
- ✅ **Universal Action Buttons (NEW v2.0)** - Available for ALL entity types
  - **Link button** - Opens LinkModal for entity relationship management
  - **Share button** - Opens ShareModal for sharing/permissions (no longer conditional)
  - **Edit button** - Enables inline editing mode with Save/Cancel
  - Special buttons for specific entities:
    - Download button (artifacts with object_key)
    - Design Email button (marketing entity)
- ✅ **Overview tab** - Compact Notion-style field layout (50% space reduction)
  - Striped dividers (15% opacity) for subtle separation
  - Reduced spacing: py-4 → py-1.5, p-8 → p-4
  - Excludes header fields (name, code, slug, id) from form
- ✅ **Dynamic child entity tabs** (loaded from API)
- ✅ **Inline edit mode** with visual field highlighting
- ✅ **Share Modal** - Share to users, roles, or generate public links
- ✅ **Link Modal** - Manage entity relationships with search
- ✅ **Special renderers:**
  - Wiki → `WikiContentRenderer` (rich text)
  - Form → `InteractiveForm` (form submission viewer)
  - Artifact → Preview with fixed fetch loop (useRef pattern)
- ✅ **Sequential state visualization** for workflow fields

**Used by:** All 13+ entity types

**Example URLs:**
- `/project/84215ccb-313d-48f8-9c37-4398f28c0b1f` → Project detail with tabs
- `/task/f1111111-1111-1111-1111-111111111111` → Task detail
- `/employee/59c0e4ca-a2d0-4c96-963e-dde1396ceea2` → Employee detail

**Tab System:**
```tsx
// Dynamic tabs loaded from API
GET /api/v1/entity/child-tabs/project/84215ccb...
→ Returns: ['task', 'wiki', 'artifact', 'employee', 'assignment']

// Renders tabs:
┌─────────────────────────────────────────────────────────────┐
│ Overview │ Task │ Wiki │ Artifact │ Employee │ Assignment  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Project Name: Roofing Replacement Project                 │
│  Stage: ○──○──●──○──○ (Execution)                          │
│  Budget: $150,000.00                                        │
│  ...                                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 3. EntityChildListPage (Filtered Child View)

**File:** `apps/web/src/pages/shared/EntityChildListPage.tsx`

**Purpose:** Show filtered list of child entities under a parent

**Features:**
- ✅ Filtered by parent ID and type
- ✅ Supports same view modes as EntityMainPage
- ✅ Create button adds child linked to parent
- ✅ Breadcrumb navigation

**Used by:** All parent-child relationships

**Example URL:**
- `/project/84215ccb.../task` → Tasks belonging to this project
- `/employee/59c0e4ca.../task` → Tasks assigned to this employee

**API Call:**
```typescript
// When viewing /project/84215ccb.../task
GET /api/v1/task?parentId=84215ccb...&parentType=project

// Backend filters using entity_id_map:
SELECT t.* FROM app.d_task t
JOIN app.entity_id_map m ON t.id = m.child_entity_id
WHERE m.entity_id = '84215ccb...'
  AND m.entity = 'project'
  AND m.child_entity = 'task';
```

---

### Universal Modal System (NEW)

**Added:** 2025-10-24 | **Version:** 2.0

The platform now includes a reusable modal system following DRY principles, with three main components:

#### 1. Base Modal Component

**File:** `apps/web/src/components/shared/modal/Modal.tsx`

**Purpose:** Reusable modal shell for all modal dialogs

**Features:**
- ✅ Backdrop blur with click-outside-to-close
- ✅ ESC key support for closing
- ✅ Responsive sizing (sm, md, lg, xl)
- ✅ Optional footer for action buttons
- ✅ Consistent styling across all modals

**Usage:**
```tsx
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Modal Title"
  size="md"
  footer={
    <>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button variant="primary" onClick={onSave}>Save</Button>
    </>
  }
>
  <div>Modal content here</div>
</Modal>
```

#### 2. ShareModal Component

**File:** `apps/web/src/components/shared/modal/ShareModal.tsx`

**Purpose:** Universal sharing functionality for all entity types

**Availability:** ✅ **Now available for ALL entity types** (v2.0 update)
- Previously restricted to entities with `config.shareable` flag
- Now universally accessible via Share button on all EntityDetailPage instances
- Works seamlessly with projects, tasks, employees, clients, and all other entities

**Features:**
- ✅ **Public Link Sharing** - Generate shareable public URLs
  - Copy link to clipboard
  - Visual feedback (checkmark for 2 seconds)
  - No authentication required for access
- ✅ **User-Specific Sharing** - Share with selected employees
  - Checkbox list of users
  - Shows name + email
  - Multi-select support
- ✅ **Role-Based Sharing** - Share with entire roles
  - Checkbox list of roles
  - All users in role get access
  - Hierarchical support

**API Integration:**
```typescript
// Generate public share URL
POST /api/v1/{entityType}/{id}/share-url
Response: { "sharedUrl": "/shared/abc123..." }

// Load users for sharing
GET /api/v1/employee?limit=100

// Load roles for sharing
GET /api/v1/role?limit=100
```

**Usage in EntityDetailPage:**
```tsx
const [isShareModalOpen, setIsShareModalOpen] = useState(false);

<button onClick={() => setIsShareModalOpen(true)}>
  <Share2 /> Share
</button>

<ShareModal
  isOpen={isShareModalOpen}
  onClose={() => setIsShareModalOpen(false)}
  entityType={entityType}
  entityId={id}
  entityName={data?.name || data?.title}
  currentSharedUrl={data?.shared_url}
  onShare={handleShare}
/>
```

#### 3. LinkModal Component

**File:** `apps/web/src/components/shared/modal/LinkModal.tsx`

**Purpose:** Universal entity relationship management

**Availability:** ✅ **Available for ALL entity types** (v2.0)
- Universally accessible via Link button on all EntityDetailPage instances
- Supports bidirectional relationships between any entity types
- Real-time synchronization with entity_id_map table

**Features:**
- ✅ **View Current Links** - Shows all parent entities linked to this child
  - Visual indicators (link icon + entity type label)
  - One-click unlink button
  - Real-time count display
- ✅ **Add New Links** - Search and link to parent entities
  - Entity type selector (project, task, business, office, client)
  - Real-time search (triggers after 2+ characters)
  - Shows entity name + code
  - Prevents duplicate links
- ✅ **Link Management** - Full CRUD for relationships
  - Create: POST /api/v1/linkage
  - Read: GET /api/v1/linkage?child_entity_type={type}&child_entity_id={id}
  - Delete: DELETE /api/v1/linkage/{linkageId}

**API Integration:**
```typescript
// Load existing links
GET /api/v1/linkage?child_entity_type=task&child_entity_id={id}
Response: {
  "data": [
    {
      "id": "linkage-uuid",
      "parent_entity_type": "project",
      "parent_entity_id": "project-uuid",
      "parent_entity_name": "Workspace Renovation",
      "relationship_type": "contains"
    }
  ]
}

// Create link
POST /api/v1/linkage
Body: {
  "parent_entity_type": "project",
  "parent_entity_id": "project-uuid",
  "child_entity_type": "task",
  "child_entity_id": "task-uuid",
  "relationship_type": "contains"
}

// Delete link
DELETE /api/v1/linkage/{linkageId}

// Search entities to link
GET /api/v1/{entityType}?search={query}&limit=20
```

**Usage in EntityDetailPage:**
```tsx
const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

<button onClick={() => setIsLinkModalOpen(true)}>
  <LinkIcon /> Link
</button>

<LinkModal
  isOpen={isLinkModalOpen}
  onClose={() => setIsLinkModalOpen(false)}
  childEntityType={entityType}
  childEntityId={id}
  childEntityName={data?.name || data?.title}
/>
```

#### Modal System Benefits

**DRY Principles:**
- Single base Modal component reused everywhere
- ShareModal and LinkModal work across all 18+ entity types
- ~90% code reuse vs entity-specific modals
- Consistent UX across platform
- **Universal availability** - All action buttons (Edit, Share, Link) available on every entity

**Performance:**
- Lazy loading of user/role lists
- Debounced search in LinkModal
- Optimistic UI updates
- Real-time refresh after operations

**Developer Experience:**
- Simple props interface
- TypeScript type safety
- Clear separation of concerns
- Easy to extend with new modals

**User Experience:**
- Predictable button layout across all entities
- No need to remember which entities support sharing/linking
- Unified interaction patterns throughout the platform

**See Also:** [Project_Task.md](./Project_Task.md) for detailed modal implementation documentation

---

## Complete Data Flow Examples

### Example 1: View Project List

**User Action:** Click "Project" in sidebar

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Sidebar Click (UI Layer)                            │
│ File: apps/web/src/components/shared/layout/Layout.tsx:78   │
├─────────────────────────────────────────────────────────────┤
│ <Link href="/project">                                      │
│   <FolderOpen /> Project                                    │
│ </Link>                                                      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Route Match (Navigation Layer)                      │
│ File: apps/web/src/App.tsx:80                               │
├─────────────────────────────────────────────────────────────┤
│ <Route path="/project"                                      │
│        element={<EntityMainPage entityType="project" />} /> │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Load Entity Config (Config Layer)                   │
│ File: apps/web/src/lib/entityConfig.ts:395                  │
├─────────────────────────────────────────────────────────────┤
│ const config = getEntityConfig('project');                  │
│ → {                                                          │
│     name: 'project',                                         │
│     displayName: 'Project',                                  │
│     apiEndpoint: '/api/v1/project',                          │
│     columns: [...],                                          │
│     fields: [...],                                           │
│     supportedViews: ['table']                                │
│   }                                                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: API Request (Data Layer)                            │
│ File: apps/web/src/lib/api.ts                               │
├─────────────────────────────────────────────────────────────┤
│ const api = APIFactory.getAPI('project');                   │
│ const projects = await api.list();                          │
│ → GET http://localhost:4000/api/v1/project                  │
│   Headers: { Authorization: 'Bearer eyJhbGc...' }            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 5: API Route Handler (Backend Layer)                   │
│ File: apps/api/src/modules/project/routes.ts                │
├─────────────────────────────────────────────────────────────┤
│ fastify.get('/api/v1/project', async (request, reply) => {  │
│   // 1. Check RBAC permission                               │
│   const hasPermission = await checkEntityPermission(        │
│     request.user.id, 'project', 'all', 0                    │
│   );                                                         │
│                                                              │
│   // 2. Query database                                      │
│   const projects = await db.query(`                         │
│     SELECT * FROM app.d_project                             │
│     WHERE active_flag = true                                │
│   `);                                                        │
│                                                              │
│   return reply.send({ data: projects.rows });               │
│ });                                                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 6: Database Query (Data Storage)                       │
│ File: db/18_d_project.ddl                                    │
├─────────────────────────────────────────────────────────────┤
│ Table: app.d_project                                         │
│ Columns: id, name, code, project_stage, budget_allocated,   │
│          start_date, end_date, ...                           │
│                                                              │
│ Returns:                                                     │
│ [                                                            │
│   {                                                          │
│     id: '84215ccb-313d-48f8-9c37-4398f28c0b1f',             │
│     name: 'Roofing Replacement Project',                    │
│     code: 'PRJ-2025-001',                                    │
│     project_stage: 'Execution',                              │
│     budget_allocated: 150000.00,                             │
│     ...                                                      │
│   },                                                         │
│   ... (4 more projects)                                      │
│ ]                                                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 7: Render Table (UI Layer)                             │
│ File: apps/web/src/components/shared/table/DataTable.tsx    │
├─────────────────────────────────────────────────────────────┤
│ <DataTable                                                   │
│   columns={config.columns}                                   │
│   data={projects}                                            │
│   onRowClick={(project) => navigate(`/project/${project.id}`)} │
│ />                                                           │
│                                                              │
│ Displays:                                                    │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Name              | Code        | Stage    | Budget  │   │
│ ├──────────────────────────────────────────────────────┤   │
│ │ Roofing Replace.. | PRJ-2025-001| Execution| $150k   │   │
│ │ HVAC Upgrade      | PRJ-2025-002| Planning | $200k   │   │
│ │ ...                                                   │   │
│ └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Total Files Touched:** 7 files (1 config, 1 icon, 1 page, 1 API, 1 table, 1 DDL, 1 route)

**DRY Benefit:** Same flow works for ALL 13 entity types without code duplication

---

### Example 2: Create Artifact with File Upload

**User Action:** Click "+ Create Artifact" → Upload file → Fill metadata → Save

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Navigate to Create Page                             │
│ URL: /artifact/new                                           │
├─────────────────────────────────────────────────────────────┤
│ Route: <Route path="/artifact/new"                          │
│               element={<EntityCreatePage                     │
│                         entityType="artifact" />} />         │
│                                                              │
│ → Renders: EntityCreatePage with artifact-specific file     │
│            upload section (conditional rendering)            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: User Selects File                                   │
│ File: apps/web/src/pages/shared/EntityCreatePage.tsx:73     │
├─────────────────────────────────────────────────────────────┤
│ <input type="file" onChange={handleFileSelect} />          │
│                                                              │
│ State:                                                       │
│ setSelectedFile(File { name: "blueprint.pdf", size: 2.4MB })│
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Upload File to S3 (Before Creating Entity)          │
│ File: apps/web/src/lib/hooks/useS3Upload.ts:57              │
├─────────────────────────────────────────────────────────────┤
│ // Get presigned upload URL                                 │
│ POST /api/v1/s3-backend/presigned-upload                    │
│ Body: {                                                      │
│   tenantId: "demo",                                          │
│   entityType: "artifact",                                    │
│   entityId: "temp-1761269465311",                           │
│   fileName: "blueprint.pdf",                                 │
│   contentType: "application/pdf"                             │
│ }                                                            │
│                                                              │
│ Response: {                                                  │
│   url: "https://cohuron-attachments-prod.s3.../presigned",  │
│   objectKey: "tenant_id=demo/entity=artifact/entity_id=.../ │
│              dd6ad07c5a798b45035869fc29728edc.pdf",         │
│   expiresIn: 3600                                            │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Direct Upload to S3 (Client → S3)                   │
│ File: apps/web/src/lib/hooks/useS3Upload.ts:101             │
├─────────────────────────────────────────────────────────────┤
│ PUT https://cohuron-attachments-prod-957207443425.s3...     │
│ Headers: { 'Content-Type': 'application/pdf' }              │
│ Body: <binary file data>                                     │
│                                                              │
│ → File stored at:                                            │
│   s3://cohuron-attachments-prod-957207443425/                │
│   tenant_id=demo/entity=artifact/entity_id=temp-.../         │
│   dd6ad07c5a798b45035869fc29728edc.pdf                      │
│                                                              │
│ State:                                                       │
│ setUploadedObjectKey("tenant_id=demo/entity=artifact/...")  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 5: User Fills Metadata & Clicks "Create Artifact"      │
│ File: apps/web/src/pages/shared/EntityCreatePage.tsx:120    │
├─────────────────────────────────────────────────────────────┤
│ Form Data:                                                   │
│ {                                                            │
│   name: "Project Blueprint",                                 │
│   descr: "Main architectural plan",                          │
│   artifact_type: "blueprint",                                │
│   tags: ["architecture", "phase1"],                          │
│   // Auto-added from upload:                                 │
│   object_key: "tenant_id=demo/entity=artifact/...",          │
│   bucket_name: "cohuron-attachments-prod-957207443425",      │
│   file_size_bytes: 2458000,                                  │
│   file_format: "pdf"                                         │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 6: Create Artifact in Database                         │
│ File: apps/api/src/modules/artifact/routes.ts:160           │
├─────────────────────────────────────────────────────────────┤
│ POST /api/v1/artifact                                        │
│                                                              │
│ SQL:                                                         │
│ INSERT INTO app.d_artifact (                                 │
│   slug, code, name, descr, tags, artifact_type,              │
│   file_format, file_size_bytes, bucket_name, object_key,    │
│   version, active_flag, is_latest_version                    │
│ ) VALUES (                                                   │
│   'artifact-1761269465311',                                  │
│   'ART-1761269465311',                                       │
│   'Project Blueprint',                                       │
│   'Main architectural plan',                                 │
│   '["architecture","phase1"]'::jsonb,                        │
│   'blueprint',                                               │
│   'pdf', 2458000,                                            │
│   'cohuron-attachments-prod-957207443425',                   │
│   'tenant_id=demo/entity=artifact/...',                      │
│   1, true, true                                              │
│ ) RETURNING *;                                               │
│                                                              │
│ Returns: { id: "a1111111-...", version: 1, ... }             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 7: Navigate to Detail Page                             │
│ File: apps/web/src/pages/shared/EntityCreatePage.tsx:98     │
├─────────────────────────────────────────────────────────────┤
│ navigate(`/artifact/a1111111-1111-1111-1111-111111111111`)  │
│ → Shows artifact details with "Download" button             │
└─────────────────────────────────────────────────────────────┘
```

**Key Points:**
- **File uploads BEFORE entity creation** (S3 first, then database)
- **Presigned URLs** avoid proxying files through API server
- **Object key stored in database** for download references
- **Version 1 automatically assigned** on creation
- **Same flow for all file types** (PDFs, images, videos, etc.)

**Files Involved:** 6 files (EntityCreatePage, useS3Upload, S3AttachmentService, artifact routes, DDL, config)

---

### Example 3: Edit Artifact → Upload New Version

**User Action:** View artifact → Click "Edit" → Upload new file → Save

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: View Artifact Detail Page                           │
│ URL: /artifact/a1111111-1111-1111-1111-111111111111          │
├─────────────────────────────────────────────────────────────┤
│ Displays:                                                    │
│ • Name: "Project Blueprint"                                  │
│ • Version: 1                                                 │
│ • Download button (appears if object_key exists)             │
│ • Edit button                                                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Click "Edit" Button                                 │
│ File: apps/web/src/pages/shared/EntityDetailPage.tsx:413    │
├─────────────────────────────────────────────────────────────┤
│ setIsEditing(true)                                           │
│                                                              │
│ → Conditionally renders "Upload New Version" section:        │
│   (entityType === 'artifact' && isEditing)                   │
│                                                              │
│ Shows:                                                       │
│ ⚠️ "Uploading a new file will create Version 2"             │
│ [File picker button]                                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: User Selects New File                               │
│ File: apps/web/src/pages/shared/EntityDetailPage.tsx:332    │
├─────────────────────────────────────────────────────────────┤
│ <input type="file" onChange={handleFileSelect} />          │
│                                                              │
│ State:                                                       │
│ setSelectedFile(File {                                       │
│   name: "blueprint_updated.pdf",                             │
│   size: 3100000                                              │
│ })                                                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Upload to S3 (Same as Create Flow)                  │
├─────────────────────────────────────────────────────────────┤
│ POST /api/v1/s3-backend/presigned-upload                    │
│ → GET presigned URL                                          │
│                                                              │
│ PUT https://cohuron-attachments-prod...                     │
│ → Upload file directly to S3                                 │
│                                                              │
│ setUploadedObjectKey("tenant_id=demo/...")                  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 5: Click "Save" → Create New Version                   │
│ File: apps/web/src/pages/shared/EntityDetailPage.tsx:154    │
├─────────────────────────────────────────────────────────────┤
│ // Detects uploadedObjectKey && selectedFile                │
│ POST /api/v1/artifact/a1111111.../new-version               │
│ Body: {                                                      │
│   fileName: "blueprint_updated.pdf",                         │
│   contentType: "application/pdf",                            │
│   fileSize: 3100000,                                         │
│   descr: "Updated with client feedback"                      │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 6: Backend Creates New Version (SCD Type 2)            │
│ File: apps/api/src/modules/artifact/routes.ts:525           │
├─────────────────────────────────────────────────────────────┤
│ BEGIN TRANSACTION;                                           │
│                                                              │
│ -- Mark old version inactive                                │
│ UPDATE app.d_artifact                                        │
│ SET active_flag = false,                                     │
│     is_latest_version = false,                               │
│     to_ts = NOW()                                            │
│ WHERE id = 'a1111111...';                                    │
│                                                              │
│ -- Create new version row (NEW ID!)                         │
│ INSERT INTO app.d_artifact (                                 │
│   name, descr, tags, artifact_type,                          │
│   parent_artifact_id,  -- Links to v1 (root)                │
│   version,             -- 2                                  │
│   active_flag,         -- true                               │
│   is_latest_version,   -- true                               │
│   from_ts,             -- NOW()                              │
│   to_ts,               -- NULL                               │
│   object_key,          -- NEW S3 object                      │
│   bucket_name, file_size_bytes, file_format                 │
│ ) VALUES (                                                   │
│   'Project Blueprint',                                       │
│   'Updated with client feedback',                            │
│   '["architecture","phase1"]'::jsonb,                        │
│   'blueprint',                                               │
│   'a1111111...',  -- parent = v1                            │
│   2,              -- version                                 │
│   true, true,                                                │
│   NOW(), NULL,                                               │
│   'tenant_id=demo/entity=artifact/.../new-hash.pdf',         │
│   'cohuron-attachments-prod-957207443425',                   │
│   3100000, 'pdf'                                             │
│ ) RETURNING *;                                               │
│                                                              │
│ COMMIT;                                                      │
│                                                              │
│ Returns: {                                                   │
│   oldArtifact: { id: "a1111...", version: 1, ... },         │
│   newArtifact: { id: "b2222...", version: 2, ... }          │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 7: Navigate to New Version                             │
│ File: apps/web/src/pages/shared/EntityDetailPage.tsx:180    │
├─────────────────────────────────────────────────────────────┤
│ alert("New version created: v2")                             │
│ navigate(`/artifact/b2222222-2222-2222-2222-222222222222`)  │
│                                                              │
│ → Shows new version with:                                    │
│   • Version: 2                                               │
│   • Download button (new file)                               │
│   • Active status                                            │
└─────────────────────────────────────────────────────────────┘
```

**Database State After New Version:**

| ID (UUID) | Version | Active | From TS | To TS | Object Key |
|-----------|---------|--------|---------|-------|------------|
| a1111... | 1 | ❌ false | 2025-01-01 | 2025-01-02 | .../hash1.pdf |
| b2222... | 2 | ✅ true | 2025-01-02 | NULL | .../hash2.pdf |

**Key Points:**
- **New file = new version** (SCD Type 2 pattern)
- **New UUID for each version** (not just incrementing version number)
- **Old version preserved** with temporal tracking (to_ts set)
- **Only one active_flag=true** per version chain
- **Parent relationship** maintained via parent_artifact_id
- **Both files kept in S3** (no overwrites)

**Metadata-Only Updates (No New Version):**
- If user clicks "Edit" and changes description WITHOUT uploading file
- Regular UPDATE query (no new version created)
- Same ID, same version, same object_key

---

### Example 4: Click Project Row → View Tasks Tab

**User Action:** Click row → Click "Task" tab

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Row Click (Navigate to Detail)                      │
├─────────────────────────────────────────────────────────────┤
│ onClick={() => navigate('/project/84215ccb...')}            │
│ → URL: /project/84215ccb-313d-48f8-9c37-4398f28c0b1f        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Detail Page Route                                   │
│ File: apps/web/src/App.tsx:84                               │
├─────────────────────────────────────────────────────────────┤
│ <Route path="/project/:id"                                  │
│        element={<EntityDetailPage entityType="project" />}> │
│   <Route path=":childType"                                  │
│          element={<EntityChildListPage />} />               │
│ </Route>                                                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Load Entity + Child Tabs                            │
│ File: apps/web/src/pages/shared/EntityDetailPage.tsx:67     │
├─────────────────────────────────────────────────────────────┤
│ // Load project data                                         │
│ GET /api/v1/project/84215ccb...                             │
│                                                              │
│ // Load child tabs                                           │
│ GET /api/v1/entity/child-tabs/project/84215ccb...           │
│ → Returns: ['task', 'wiki', 'artifact', 'employee']         │
│                                                              │
│ // Render tabs                                               │
│ <DynamicChildEntityTabs                                      │
│   entityType="project"                                       │
│   entityId="84215ccb..."                                     │
│   childTypes={['task', 'wiki', 'artifact', 'employee']}     │
│ />                                                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Click "Task" Tab                                    │
├─────────────────────────────────────────────────────────────┤
│ onClick={() => navigate('/project/84215ccb.../task')}       │
│ → URL: /project/84215ccb.../task                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 5: Child List Page (Nested Route)                      │
│ File: apps/web/src/pages/shared/EntityChildListPage.tsx:30  │
├─────────────────────────────────────────────────────────────┤
│ const { id: parentId } = useParams(); // 84215ccb...        │
│ const config = getEntityConfig('task');                     │
│                                                              │
│ // Load tasks for this project                              │
│ GET /api/v1/task?parentId=84215ccb...&parentType=project    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 6: API Filters by Parent                               │
│ File: apps/api/src/modules/task/routes.ts                   │
├─────────────────────────────────────────────────────────────┤
│ fastify.get('/api/v1/task', async (request, reply) => {     │
│   const { parentId, parentType } = request.query;           │
│                                                              │
│   // Query tasks linked to parent via entity_id_map         │
│   const tasks = await db.query(`                            │
│     SELECT t.*                                               │
│     FROM app.d_task t                                        │
│     JOIN app.entity_id_map m                                 │
│       ON t.id = m.child_entity_id                            │
│     WHERE m.entity_id = $1                                   │
│       AND m.entity = $2                                      │
│       AND m.child_entity = 'task'                            │
│       AND t.active_flag = true                               │
│   `, [parentId, parentType]);                                │
│                                                              │
│   return reply.send({ data: tasks.rows });                  │
│ });                                                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 7: Render Filtered Tasks                               │
├─────────────────────────────────────────────────────────────┤
│ <FilteredDataTable                                           │
│   columns={config.columns}                                   │
│   data={tasks}                                               │
│   parentId="84215ccb..."                                     │
│   parentType="project"                                       │
│   childType="task"                                           │
│ />                                                           │
│                                                              │
│ Shows only tasks for this specific project:                 │
│ - Task 1: Replace roof shingles (In Progress)               │
│ - Task 2: Inspect attic ventilation (To Do)                 │
│ - Task 3: Install gutters (Backlog)                         │
└─────────────────────────────────────────────────────────────┘
```

**Key Tables Used:**
1. `d_project` - Parent project data
2. `d_task` - Child task data
3. `entity_id_map` - Parent-child linkage
4. `entity_id_rbac_map` - Permission checking

---

## Entity Configuration System

### Single Source of Truth: entityConfig.ts

**File:** `apps/web/src/lib/entityConfig.ts` (2,244 lines)

**Purpose:** Define ALL entity metadata in one place

**Structure:**
```typescript
export const entityConfigs: Record<string, EntityConfig> = {
  project: {
    name: 'project',
    displayName: 'Project',
    pluralName: 'Projects',
    apiEndpoint: '/api/v1/project',

    // Table columns (used in EntityMainPage)
    columns: [
      {
        key: 'name',
        title: 'Project Name',
        sortable: true,
        filterable: true,
        inlineEditable: false
      },
      {
        key: 'project_stage',
        title: 'Stage',
        sortable: true,
        loadOptionsFromSettings: true, // Auto-loads from settings
        inlineEditable: true,           // Can edit in table
        render: (value) => renderBadge(value, stageColors)
      },
      {
        key: 'budget_allocated',
        title: 'Budget',
        align: 'right',
        render: (value) => formatCurrency(value, 'CAD')
      },
      // ... more columns
    ],

    // Form fields (used in EntityCreatePage, EntityDetailPage)
    fields: [
      {
        key: 'name',
        label: 'Project Name',
        type: 'text',
        required: true,
        placeholder: 'Enter project name'
      },
      {
        key: 'project_stage',
        label: 'Stage',
        type: 'select',
        loadOptionsFromSettings: true,  // Triggers SequentialStateVisualizer
        required: true
      },
      {
        key: 'budget_allocated',
        label: 'Budget Allocated',
        type: 'number',
        placeholder: '0.00'
      },
      // ... more fields
    ],

    // View configuration
    supportedViews: ['table'],
    defaultView: 'table',

    // Sharing configuration (DEPRECATED in v2.0)
    // NOTE: shareable flag no longer controls Share button visibility
    // Share button now available for ALL entities via EntityDetailPage
    shareable: true,

    // Child entity relationships (loaded dynamically from API)
  },

  task: {
    name: 'task',
    displayName: 'Task',
    pluralName: 'Tasks',
    apiEndpoint: '/api/v1/task',
    columns: [...],
    fields: [...],
    supportedViews: ['table', 'kanban'],
    defaultView: 'kanban',

    // Kanban configuration
    kanban: {
      groupByField: 'stage',
      cardTitleField: 'name',
      cardFields: ['priority_level', 'assigned_to'],
      allowDragDrop: true
    }
  },

  // ... 11 more entities
};
```

**All Configured Entities (13 core + 5 product):**

1. `project` - Projects with budgets and timelines
2. `task` - Tasks with kanban support
3. `employee` - User accounts with RBAC
4. `biz` - Business units (3-level hierarchy)
5. `office` - Office locations (4-level hierarchy)
6. `cust` - Customers/clients
7. `role` - Organizational roles
8. `position` - Employee positions
9. `worksite` - Work site locations
10. `artifact` - Documents and attachments
11. `wiki` - Knowledge base articles
12. `form` - Dynamic form definitions
13. `marketing` - Email templates
14. `product` - Product catalog
15. `inventory` - Inventory management
16. `order` - Order processing
17. `shipment` - Shipment tracking
18. `invoice` - Invoice management

---

## Settings & Sequential States

### Settings Integration

**Flow:**
```
Field Definition → Settings Loader → API Call → Database Table → Dropdown Options
```

**Example: Project Stage Field**

```typescript
// 1. Field definition (entityConfig.ts)
{
  key: 'project_stage',
  label: 'Stage',
  type: 'select',
  loadOptionsFromSettings: true  // ← Magic flag
}

// 2. Settings loader detects field (settingsLoader.ts)
const category = mapFieldToCategory('project_stage');
// → 'project_stage'

// 3. API call
GET /api/v1/setting?category=project_stage

// 4. Backend queries database (apps/api/src/modules/setting/routes.ts)
SELECT level_id, level_name, sort_order, parent_id
FROM app.setting_datalabel_project_stage
WHERE active_flag = true
ORDER BY sort_order;

// 5. Returns options
[
  { value: 'Initiation', label: 'Initiation', sort_order: 1 },
  { value: 'Planning', label: 'Planning', sort_order: 2 },
  { value: 'Execution', label: 'Execution', sort_order: 3 },
  { value: 'Monitoring', label: 'Monitoring', sort_order: 4 },
  { value: 'Closure', label: 'Closure', sort_order: 5 }
]

// 6. Renders as sequential state visualizer
○ ──── ○ ──── ● ──── ○ ──── ○
Init  Plan  Exec  Monitor Close
              ↑ Current stage
```

### Sequential State Visualizer

**File:** `apps/web/src/components/shared/entity/SequentialStateVisualizer.tsx`

**Automatically Used For Fields Matching Patterns:**
```typescript
// sequentialStateConfig.ts
SEQUENTIAL_STATE_PATTERNS = [
  'stage',      // project_stage, task_stage
  'funnel',     // opportunity_funnel_stage
  'pipeline',   // sales_pipeline
  'status',     // publication_status, approval_status
  'level'       // office_level, business_level
]
```

**Visual Design:**
- **Consistent gray color** (`#6B7280`) for all states
- **Hollow circles** for past/future states
- **Filled circle** with checkmark for current state
- **Solid lines** for completed progression
- **Dotted lines** for future states
- **Interactive** in edit mode (click to change)

**Example: Task Stage Field**

```
Display Mode (EntityDetailPage):
○ ──── ○ ──── ● ──── ○ ──── ○ ──── ○
Backlog To Do In Prog Review Done  Block
              ↑ Current

Edit Mode (EntityCreatePage):
Hover effect + clickable to jump states
```

---

## Routing Architecture

### Route Pattern

```
/{entity}                    → EntityMainPage (list view)
/{entity}/new                → EntityCreatePage (create form)
/{entity}/:id                → EntityDetailPage (detail + tabs)
/{entity}/:id/:childType     → EntityChildListPage (filtered child)
/{entity}/shared/:code       → SharedURLEntityPage (public view)
```

### Auto-Generated Routes (App.tsx:69-105)

```typescript
const coreEntities = [
  'biz', 'office', 'project', 'task', 'employee',
  'role', 'worksite', 'cust', 'position', 'artifact',
  'wiki', 'form', 'marketing', 'product', 'inventory',
  'order', 'invoice', 'shipment'
];

const generateEntityRoutes = () => {
  return coreEntities.map(entityType => (
    <Fragment key={entityType}>
      {/* List view */}
      <Route path={`/${entityType}`}
             element={<EntityMainPage entityType={entityType} />} />

      {/* Create form */}
      <Route path={`/${entityType}/new`}
             element={<EntityCreatePage entityType={entityType} />} />

      {/* Detail view with nested child routes */}
      <Route path={`/${entityType}/:id`}
             element={<EntityDetailPage entityType={entityType} />}>
        {/* Child entity tab (e.g., /project/:id/task) */}
        <Route path=":childType"
               element={<EntityChildListPage />} />
      </Route>
    </Fragment>
  ))
};
```

**Result:** 54+ routes auto-generated from 18 entity types × 3 routes each

---

## RBAC & Permissions

### Permission Model

**Table:** `entity_id_rbac_map`

**Structure:**
```sql
CREATE TABLE app.entity_id_rbac_map (
  empid UUID NOT NULL,              -- Employee ID
  entity TEXT NOT NULL,             -- Entity type (e.g., 'project')
  entity_id TEXT NOT NULL,          -- 'all' OR specific UUID
  permission INT[] NOT NULL,        -- Array of permission levels
  active_flag BOOLEAN DEFAULT true,
  PRIMARY KEY (empid, entity, entity_id)
);
```

**Permission Levels:**
- `0` = View (read access)
- `1` = Edit (modify data)
- `2` = Share (generate shared URLs)
- `3` = Delete (soft delete)
- `4` = Create (create new entities)

**Permission Scopes:**

1. **Type-level:** `entity_id = 'all'`
   - Grants access to ALL instances of entity type
   - Example: James Miller has `entity='project', entity_id='all', permission={0,1,2,3,4}`
   - Can view, edit, share, delete, create ANY project

2. **Instance-level:** `entity_id = <UUID>`
   - Grants access to ONE specific instance
   - Example: `entity='project', entity_id='84215ccb...', permission={0,1}`
   - Can only view and edit that ONE specific project

### Permission Checking Flow

```typescript
// Example: Can user create a project and assign it to a business?

// Required permissions:
1. entity='project', entity_id='all', permission CONTAINS 4 (create)
2. entity='biz', entity_id=<business_uuid>, permission CONTAINS 1 (edit)

// SQL check:
SELECT COUNT(*) FROM app.entity_id_rbac_map
WHERE empid = '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
  AND (
    (entity='project' AND entity_id='all' AND 4=ANY(permission))
    AND
    (entity='biz' AND entity_id='...' AND 1=ANY(permission))
  );

// If count >= 2, user is authorized
```

### James Miller's Permissions (Test User)

**User ID:** `8260b1b0-5efc-4611-ad33-ee76c0cf7f13`
**Email:** `james.miller@huronhome.ca`
**Password:** `password123`

**Permissions:** Full access to all 13 entity types

```sql
-- Type-level permissions (entity_id = 'all')
INSERT INTO app.entity_id_rbac_map (empid, entity, entity_id, permission) VALUES
('8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 'project',  'all', '{0,1,2,3,4}'),
('8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 'task',     'all', '{0,1,2,3,4}'),
('8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 'employee', 'all', '{0,1,2,3,4}'),
('8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 'biz',      'all', '{0,1,2,3,4}'),
('8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 'office',   'all', '{0,1,2,3,4}'),
-- ... (8 more entity types)
```

**Result:** James Miller can perform ALL operations on ALL entities

---

## Deployment Architecture

### AWS Infrastructure (Terraform)

**Location:** `infra-tf/`

**Components:**
```
┌─────────────────────────────────────────────────────────────┐
│                       AWS Cloud (us-east-1)                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐      ┌──────────────────┐             │
│  │  S3 Bucket      │      │  Lambda Function │             │
│  │  cohuron-deploy │─────▶│  code-deployer   │             │
│  │  (code bundles) │      │  (Node.js 20)    │             │
│  └─────────────────┘      └──────────────────┘             │
│         ↑                           │                        │
│         │                           ↓                        │
│         │                  ┌──────────────────┐             │
│  deploy-code.sh            │  EventBridge Rule│             │
│  (git bundle + upload)     │  (triggers Lambda)│             │
│                            └──────────────────┘             │
│                                     │                        │
│                                     ↓                        │
│                            ┌──────────────────┐             │
│                            │  EC2 Instance    │             │
│                            │  t3.medium       │             │
│                            │  Ubuntu 22.04    │             │
│                            ├──────────────────┤             │
│                            │  • Docker        │             │
│                            │  • PostgreSQL    │             │
│                            │  • Node.js 20    │             │
│                            │  • pnpm          │             │
│                            │  • nginx         │             │
│                            └──────────────────┘             │
│                                     │                        │
│                            Public IP: 100.26.224.246         │
│                            http://100.26.224.246:5173        │
└─────────────────────────────────────────────────────────────┘
```

### Deployment Flow

```bash
# 1. Developer commits code
git add .
git commit -m "Add new feature"

# 2. Run deployment script
./infra-tf/deploy-code.sh

# What happens:
# → Creates tar.gz bundle of current branch
# → Uploads to S3 (s3://cohuron-deployment-us-east-1/cohuron-main-abc123.tar.gz)
# → EventBridge rule triggers Lambda
# → Lambda SSHs to EC2
# → Downloads bundle, extracts, installs deps, restarts services
# → Platform live at http://100.26.224.246:5173
```

### Production Services

**EC2 Instance:**
- **Type:** t3.medium (2 vCPU, 4 GB RAM)
- **OS:** Ubuntu 22.04 LTS
- **Public IP:** 100.26.224.246
- **Security Groups:**
  - Port 22 (SSH)
  - Port 4000 (API)
  - Port 5173 (Web)
  - Port 5434 (PostgreSQL - internal only)

**Running Services:**
```bash
# Docker containers
docker ps
- postgres:14      → Port 5434 (PostgreSQL)
- redis:7          → Port 6379 (Cache)
- minio/minio      → Port 9000/9001 (S3-compatible storage, optional dev only)

# Node.js services
pnpm dev:api       → Port 4000 (Fastify API)
pnpm dev:web       → Port 5173 (Vite dev server)
```

**Access URLs:**
- Web App: http://100.26.224.246:5173
- API: http://100.26.224.246:4000
- API Docs: http://100.26.224.246:4000/docs

---

## DRY Principles Implementation

### 1. Single Source of Truth

**Configuration Defined Once, Used Everywhere:**

| What | Where Defined | Where Used |
|------|---------------|------------|
| Entity metadata | `entityConfig.ts` | Pages, API, routes, forms, tables |
| Icons | `entityIcons.ts` | Sidebar, tabs, settings, breadcrumbs |
| Sequential patterns | `sequentialStateConfig.ts` | All workflow fields |
| Settings categories | Database tables | All dropdowns, filters |
| RBAC permissions | `entity_id_rbac_map` | All API endpoints |

### 2. Universal Components

**3 Pages Handle All Entities:**
- `EntityMainPage` → 18 entity types × list view = 18 pages
- `EntityDetailPage` → 18 entity types × detail view = 18 pages
  - **NEW v2.0:** Universal action buttons (Edit, Share, Link) on all detail pages
- `EntityChildListPage` → All parent-child relationships

**Modal System (v2.0):**
- `ShareModal` → Works with all 18+ entity types (no longer conditional)
- `LinkModal` → Universal relationship management for all entities
- `EntityEditModal` → Reusable edit form for all entities

**Code Reuse:** 97% (6 universal components vs 54+ specialized pages + modals)

### 3. Auto-Generated Routing

**From 18 Entities to 54+ Routes:**
```typescript
coreEntities.map(entity => (
  <Route path={`/${entity}`} /> +
  <Route path={`/${entity}/new`} /> +
  <Route path={`/${entity}/:id`} />
)) = 54 routes from 1 config array
```

### 4. Centralized Rendering

**5 Shared Render Functions:**
```typescript
renderBadge(value, colorMap)        // Used in 15+ columns
renderTags(tags)                    // Used in 8+ columns
renderEmployeeNames(names, record)  // Used in 10+ columns
formatDate(dateString)              // Used in 20+ columns
formatCurrency(amount, currency)    // Used in 5+ columns
```

**Result:** 1 change updates 50+ locations

### 5. Database-Driven Options

**16 Settings Tables → 50+ Dropdowns:**

No hardcoded options anywhere. All dropdowns load from:
```
GET /api/v1/setting?category=<name>
→ Queries: setting_datalabel_<category>
→ Returns: Options for dropdown
```

**Add New Option:** Insert row in DB → Appears everywhere automatically

---

## Project Statistics

### Codebase Size

| Layer | Files | Lines of Code |
|-------|-------|---------------|
| **Database** | 52 DDL files | ~15,000 lines SQL |
| **Backend API** | 31 modules | ~8,000 lines TS |
| **Frontend** | ~100 components | ~12,000 lines TSX |
| **Config** | 3 files | ~2,500 lines |
| **Total** | ~186 files | ~37,500 lines |

### Entity Coverage

- **Core Entities:** 13 (project, task, employee, biz, office, etc.)
- **Product Entities:** 5 (product, inventory, order, shipment, invoice)
- **Settings Tables:** 16 (stages, levels, statuses, etc.)
- **Total Entities:** 18 with full CRUD + RBAC

### API Endpoints

- **Entity CRUD:** 13 entities × 5 endpoints = 65 endpoints
- **Settings:** 16 categories × 1 endpoint = 16 endpoints
- **Shared/Universal:** 20+ endpoints (auth, RBAC, entity metadata, etc.)
- **Total:** 100+ API endpoints

### Routes

- **Frontend:** 54+ auto-generated routes
- **Backend:** 100+ API endpoints
- **Total:** 150+ routes

---

## Quick Reference

### Key Files (Single Sources of Truth)

| File | Lines | Purpose |
|------|-------|---------|
| `apps/web/src/lib/entityConfig.ts` | 2,244 | Entity metadata (ALL entities) |
| `apps/web/src/lib/entityIcons.ts` | 103 | Icon mappings |
| `apps/web/src/lib/sequentialStateConfig.ts` | ~200 | Sequential state patterns |
| `apps/web/src/App.tsx` | 249 | Auto-generated routes |
| `apps/api/src/modules/index.ts` | 123 | API module registration |
| `db/README.md` | - | Database schema documentation |

### Testing Credentials

**Test Account:** James Miller
- **Email:** `james.miller@huronhome.ca`
- **Password:** `password123`
- **ID:** `8260b1b0-5efc-4611-ad33-ee76c0cf7f13`
- **Permissions:** Full access to all entities

### Common Commands

```bash
# Start platform (Docker + API + Web)
./tools/start-all.sh

# Import database schema (52 DDL files)
./tools/db-import.sh

# Test API endpoint
./tools/test-api.sh GET /api/v1/project
./tools/test-api.sh POST /api/v1/task '{"name":"New Task"}'

# View logs
./tools/logs-api.sh 100
./tools/logs-web.sh -f

# Deploy to production
./infra-tf/deploy-code.sh
```

### Service Ports

| Service | Port | URL |
|---------|------|-----|
| Web App | 5173 | http://localhost:5173 |
| API Server | 4000 | http://localhost:4000 |
| API Docs | 4000 | http://localhost:4000/docs |
| PostgreSQL | 5434 | localhost:5434 |
| Redis | 6379 | localhost:6379 |
| MinIO Console | 9001 | http://localhost:9001 | Optional (dev only, production uses AWS S3) |

---

## Summary: Why This Architecture Works

### ✅ DRY Principles
- **1 config file** defines 18 entities
- **3 pages** handle all CRUD operations
- **1 icon file** used in 10+ locations
- **16 settings tables** populate 50+ dropdowns

### ✅ Scalability
- Add new entity: 1 config object + 1 DDL file
- Auto-generates routes, API, forms, tables
- No code duplication

### ✅ Maintainability
- Change propagates automatically
- Single source of truth
- Self-documenting configuration

### ✅ Type Safety
- TypeScript end-to-end
- Centralized type definitions
- Compile-time error checking

### ✅ Security
- Unified RBAC system
- Entity-based permissions
- JWT authentication
- Instance-level access control
- **Parameterized SQL queries** - All database operations use prepared statements to prevent SQL injection
  - Example: `sql\`${sql.identifier([key])} = ${value}\`` (safe)
  - Never: `name = '${data.name}'` (vulnerable to SQL injection)
- **Dual relationship handling** - Automatic detection of foreign_key vs linkage relationships
- **Schema validation** - Flexible JSONB field handling for dynamic entity data

### 📋 API Best Practices

#### SQL Query Security (Updated 2025-10-27)

All API modules now follow secure SQL patterns:

**✅ Correct (Parameterized):**
```typescript
// Using sql template literals
const result = await db.execute(sql`
  UPDATE app.d_artifact
  SET ${sql.join(setClauses, sql`, `)}
  WHERE id = ${id}
  RETURNING *
`);

// With sql.identifier for column names
sql`${sql.identifier(['column_name'])} = ${value}`
```

**❌ Incorrect (Vulnerable to SQL Injection):**
```typescript
// String concatenation - NEVER DO THIS
const query = `UPDATE app.d_artifact SET name = '${data.name}'`;
await db.execute(sql.raw(query));
```

#### Relationship Handling

The platform automatically detects and handles two types of entity relationships:

**1. Foreign Key Relationships:**
- Direct column reference (e.g., `task.project_id → project.id`)
- Uses simple JOIN on foreign key column
- Example: Project → Tasks, Business → Projects

**2. Linkage Relationships:**
- Uses `app.d_entity_id_map` mapping table
- Supports many-to-many and flexible hierarchies
- Example: Task → Forms, Task → Artifacts, Project → Wiki

Configuration managed in `RELATIONSHIP_MAP` constant (see `parent-action-entity-routes.ts`).

---

**Last Updated:** 2025-10-27
**Project:** Huron Home Services PMO Platform
**Version:** Production v2.1 (Hierarchy Mapping + Security Fixes)
**Architecture:** DRY-first, Config-driven, Universal Components
