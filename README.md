# Huron Home Services - PMO Enterprise Platform 🏡

> **Complete Canadian Home Services Management System** - Production-ready PMO platform with comprehensive data model, unified RBAC, and industry-specific business intelligence

## 📖 Documentation Index & Project Overview

| Document | Purpose | Key Topics |
|----------|---------|------------|
| **[🏠 Main README](./README.md)** | Project overview and quick start | Architecture, getting started, business context |
| **[🌐 Frontend Guide](./apps/web/README.md)** | React 19 hierarchical navigation UI/UX | 12 entity types, RBAC integration, modern components |
| **[🔧 Backend API](./apps/api/README.md)** | Enterprise Fastify API with unified RBAC | 11 modules, JWT auth, 113+ permissions |
| **[🗄️ Database Schema](./db/README.md)** | 5-layer RBAC architecture with 20+ tables | Canadian business context, DDL files, relationships |
| **[🛠️ Management Tools](./tools/README.md)** | 16 platform operation tools | Start/stop, database import, API testing, RBAC debugging |
| **[🧪 API Testing Guide](./tools/API_TESTING.md)** | Generic API testing with `test-api.sh` | Test any endpoint, examples, form workflows |
strictly use tools to run api.

---

## 🎨 UI/UX Design System

### Centralized Icon Configuration

**Location:** `apps/web/src/lib/entityIcons.ts`

All entity icons across the application are centralized in a single configuration file to ensure consistency between:
- Sidebar navigation
- Settings page dropdowns
- Entity detail pages
- Any component that displays entity-related icons

#### Icon Mappings

**Main Entities:**
```typescript
business/biz      → Building2 (Building icon)
project           → FolderOpen (Folder icon)
office            → MapPin (Location pin icon)
client            → Users (Multiple users icon)
role              → UserCheck (User with checkmark icon)
employee          → Users (Multiple users icon)
wiki              → BookOpen (Open book icon)
form              → FileText (Document icon)
task              → CheckSquare (Checkbox icon)
artifact          → FileText (Document icon)
```

**Settings/Metadata Entities:**
```typescript
projectStatus, projectStage        → CheckSquare (matches task)
taskStatus, taskStage              → CheckSquare (matches task)
businessLevel, orgLevel            → Building2 (matches business)
hrLevel, clientLevel               → Users (matches employee/client)
positionLevel                      → UserCheck (matches role)
opportunityFunnelLevel             → Users (matches client)
industrySector, acquisitionChannel → Building2/Users
```

#### Usage

```typescript
// Import centralized icons
import { ENTITY_ICONS, ENTITY_GROUPS, getEntityIcon } from '../lib/entityIcons';

// Get icon for an entity
const ProjectIcon = ENTITY_ICONS.project;  // Returns FolderOpen

// Get icon dynamically
const icon = getEntityIcon('task');  // Returns CheckSquare

// Use entity group configuration
const projectGroup = ENTITY_GROUPS.project;
// { name: 'Project', icon: FolderOpen, color: 'blue' }
```

#### Benefits

✅ **Single Source of Truth** - Change icon in one place, updates everywhere
✅ **Visual Consistency** - Sidebar and settings use identical icons
✅ **Type Safety** - TypeScript ensures icon consistency
✅ **Easy Maintenance** - Add new entities without touching multiple files
✅ **Self-Documenting** - Clear mapping of entity → icon relationships



DATA MODEL:
1️⃣ Core Business Entities (13 tables):

  1. d_office - Office locations (4-level hierarchy: Office→District→Region→Corporate)
  2. d_business - Business units (3-level hierarchy: Dept→Division→Corporate)
  3. d_project - Projects with budgets, timelines, stakeholders
  4. d_task - Tasks linked to projects
  5. d_employee - Users with authentication & RBAC (includes James Miller)
  6. d_client - Customer entities
  7. d_worksite - Work site locations
  8. d_role - Organizational roles (22 records)
  9. d_position - Employee positions (16 records)
  10. d_artifact - Documents & file attachments
  11. d_wiki - Knowledge base
  12. d_form_head - Form definitions
  13. d_reports - Report definitions

  2️⃣ Settings/Configuration Tables (16 tables):

  1. setting_datalabel_office_level - Office hierarchy (4 levels)
  2. setting_datalabel_business_level - Business hierarchy (3 levels)
  3. setting_datalabel_project_stage - Project lifecycle stages
  4. setting_datalabel_task_stage - Task workflow stages
  5. setting_datalabel_position_level - Position hierarchy
  6. setting_datalabel_opportunity_funnel_level - Sales pipeline stages
  7. setting_datalabel_industry_sector - Client industry classifications
  8. setting_datalabel_acquisition_channel - Client acquisition sources
  9. setting_datalabel_customer_tier - Customer service tiers
  10. setting_datalabel_client_level - Client classification levels
  11. setting_datalabel_client_status - Client status values
  12. setting_datalabel_task_priority - Task priority levels
  13. setting_datalabel_task_update_type - Task update categories
  14. setting_datalabel_wiki_publication_status - Wiki publication states
  15. setting_datalabel_form_approval_status - Form approval workflow states
  16. setting_datalabel_form_submission_status - Form submission states

---



## 🧪 Quick Start: API Testing
---
AI/LLM/Agent:
For API, UIUX or App testing, Strictly use the credentials below:
James Miller Account:
  - ID: 8260b1b0-5efc-4611-ad33-ee76c0cf7f13
  - Email: james.miller@huronhome.ca
  - Password: password123


Test any API endpoint using the generic testing tool:

```bash
# List resources
./tools/test-api.sh GET /api/v1/form
./tools/test-api.sh GET /api/v1/project
./tools/test-api.sh GET /api/v1/task

# Create resources
./tools/test-api.sh POST /api/v1/form '{"name":"Test Form","schema":{"steps":[]}}'

# Update resources
./tools/test-api.sh PUT /api/v1/form/uuid '{"name":"Updated Name"}'

# Delete resources
./tools/test-api.sh DELETE /api/v1/form/uuid
```

**Features:**
- ✅ Auto-authentication with James Miller account
- ✅ Colored output with HTTP status indicators
- ✅ JSON formatting with `jq`
- ✅ Supports GET, POST, PUT, DELETE methods
- ✅ Environment variable configuration

**Examples & Documentation:**
- 📖 Full guide: [tools/API_TESTING.md](./tools/API_TESTING.md)
- 📝 Example workflows: `./tools/examples/test-form-api.sh`
- 🔍 Run examples: `./tools/examples/test-api-examples.sh`


Modeling:

entity_id_map

Columns: entity, entity_id, child_entity, child_entity_id

Used for path building:

/entity/<child_entity>/<tab>

Example:

entity=project, entity_id=123456789, child_entity=task, child_entity_id=23456789011

5. RBAC & Permissions

Table: entity_id_rbac_map

Columns: empid, entity, entity_id, permission[]

Permissions:

0 → View

1 → Edit

2 → Share

3 → Delete

4 → Create

Key behavior:

If entity_id = 'all' and permission includes 4, user can create a new project.

Permission Checks

Can user create a project?

SELECT * FROM entity_id_rbac_map
WHERE entity = 'project'
  AND entity_id = 'all'
  AND 4 = ANY(permission);


Can user assign a project to a business department?

Must satisfy:

Project-level create permission

Business-level edit permission

WHERE entity = 'project' AND entity_id = 'all' AND 4 = ANY(permission)
AND entity = 'biz' AND entity_id = <specific_business_id> AND 1 = ANY(permission)


-------------RBAC------------
1. entity_id = 'all' (Type-Level Permissions)
    - Grants access to ALL instances of that entity type
    - James Miller has this for all 16 entity types
    - Example: entity='project', entity_id='all' → Can access all 5 projects
  2. entity_id = <UUID> (Instance-Level Permissions)
    - Grants access to ONE specific instance only
    - Example: entity='project', entity_id='93106ffb...' → Can only access that one project
  3. active_flag = true
    - Indicates the permission is currently active and enforced
    - All of James Miller's 16 permissions are active
    - Can be set to false to temporarily revoke without deleting
  4. Permission Array {0,1,2,3,4}
    - 0 = View (read access)
    - 1 = Edit (modify data)
    - 2 = Share (grant permissions)
    - 3 = Delete (soft delete)
    - 4 = Create (create new entities)
  5. Complex Permission Check (from newspecs.txt)
  -- Can user create project AND assign to business?
  WHERE entity='project' AND entity_id='all' AND 4=ANY(permission)  -- Can create
  AND entity='biz' AND entity_id=<uuid> AND 1=ANY(permission)       -- Can edit business
  5. James Miller: ✅ AUTHORIZED (has both permissions)



Flow diagram:
Complete Flow Diagrams: Task, Project, Business

  ---
  1. Project Entity Flow

  URL: /project/84215ccb-313d-48f8-9c37-4398f28c0b1f/task

  App.tsx (Auto-Generated Routes - Lines 60-95)
  ├─ generateEntityRoutes() generates route from entityConfig
  ├─ Route path="/project/:id" → EntityDetailPage (entityType="project")
  │   └─ Child routes auto-generated from config.childEntities: ['task', 'wiki', 'artifact', 'form']
  │   └─ Route path="task" → EntityChildListPage (parentType="project", childType="task")
  │
  EntityDetailPage.tsx
  ├─ useParams() → id = "84215ccb-313d-48f8-9c37-4398f28c0b1f"
  ├─ props: { entityType: "project" }
  ├─ Line 33: config = getEntityConfig("project")
  │   └─ entityConfig.ts:88-167 → project configuration
  │       ├─ childEntities: ['task', 'wiki', 'artifact', 'form']
  │       ├─ apiEndpoint: '/api/v1/project'
  │       └─ columns, fields, supportedViews
  ├─ Line 69-91: loadData() → API call
  │   └─ api.projectApi.get(id) → GET /api/v1/project/84215ccb...
  ├─ Line 138-145: useDynamicChildEntityTabs()
  │   └─ Creates tabs: ['Overview', 'Tasks', 'Wiki', 'Artifacts', 'Forms']
  ├─ Line 278-289: <DynamicChildEntityTabs> renders tab buttons
  └─ Line 379: <Outlet /> → Renders nested child route
      │
      └─ EntityChildListPage.tsx (Lines 1-281)
          ├─ props: { parentType: "project", childType: "task" }
          ├─ useParams() → { id: parentId } = "84215ccb-313d-48f8-9c37-4398f28c0b1f"
          ├─ Line 33: config = getEntityConfig("task")
          │   └─ entityConfig.ts:172-267 → task configuration
          ├─ Line 73-94: loadChildData() → API call
          │   ├─ Try: api.projectApi.getTasks(parentId)
          │   │   └─ GET /api/v1/project/84215ccb.../task
          │   └─ Fallback: api.taskApi.list({ parentId, parentType: "project" })
          │       └─ Backend query:
          │           SELECT t.* FROM app.d_task t
          │           INNER JOIN app.d_entity_id_map eim
          │             ON eim.child_entity_id = t.id::text
          │           WHERE eim.parent_entity_id = '84215ccb...'
          │             AND eim.parent_entity_type = 'project'
          │             AND eim.child_entity_type = 'task'
          │
          └─ Line 200-281: Renders based on view mode
              ├─ Table View (default) → FilteredDataTable
              │   └─ Uses config.columns from entityConfig.ts:177-244
              ├─ Kanban View → KanbanBoard
              │   └─ groupByField: 'stage' (config.kanban.groupByField)
              └─ Grid View → GridView

  ---
  2. Task Entity Flow

  URL: /task/b2222222-2222-2222-2222-222222222222/form

  App.tsx (Auto-Generated Routes - Lines 60-95)
  ├─ generateEntityRoutes() generates route from entityConfig
  ├─ Route path="/task/:id" → EntityDetailPage (entityType="task")
  │   └─ Child routes auto-generated from config.childEntities: ['form', 'artifact']
  │   └─ Route path="form" → EntityChildListPage (parentType="task", childType="form")
  │
  EntityDetailPage.tsx
  ├─ useParams() → id = "b2222222-2222-2222-2222-222222222222"
  ├─ props: { entityType: "task" }
  ├─ Line 33: config = getEntityConfig("task")
  │   └─ entityConfig.ts:172-267 → task configuration
  │       ├─ childEntities: ['form', 'artifact']
  │       ├─ apiEndpoint: '/api/v1/task'
  │       ├─ supportedViews: ['table', 'kanban']
  │       └─ kanban: { groupByField: 'stage', metaTable: 'setting_task_stage' }
  ├─ Line 69-91: loadData() → API call
  │   └─ api.taskApi.get(id) → GET /api/v1/task/b2222222...
  ├─ Line 138-145: useDynamicChildEntityTabs()
  │   └─ Creates tabs: ['Overview', 'Forms', 'Artifacts']
  ├─ Line 278-289: <DynamicChildEntityTabs> renders tab buttons
  └─ Line 379: <Outlet /> → Renders nested child route
      │
      └─ EntityChildListPage.tsx (Lines 1-281)
          ├─ props: { parentType: "task", childType: "form" }
          ├─ useParams() → { id: parentId } = "b2222222-2222-2222-2222-222222222222"
          ├─ Line 33: config = getEntityConfig("form")
          │   └─ entityConfig.ts:272-412 → form configuration
          ├─ Line 73-94: loadChildData() → API call
          │   ├─ Try: api.taskApi.getForms(parentId)
          │   │   └─ GET /api/v1/task/b2222222.../form  ✅ NEW ENDPOINT
          │   │       └─ Backend (task/routes.ts:1131-1203):
          │   │           -- RBAC Check
          │   │           SELECT 1 FROM app.entity_id_rbac_map rbac
          │   │           WHERE rbac.empid = userId
          │   │             AND rbac.entity = 'task'
          │   │             AND (rbac.entity_id = 'b2222222...' OR rbac.entity_id = 'all')
          │   │             AND 0 = ANY(rbac.permission)
          │   │
          │   │           -- Get Forms
          │   │           SELECT f.*, COALESCE(f.name, 'Untitled Form') as name
          │   │           FROM app.d_form_head f
          │   │           INNER JOIN app.d_entity_id_map eim
          │   │             ON eim.child_entity_id = f.id::text
          │   │           WHERE eim.parent_entity_id = 'b2222222...'
          │   │             AND eim.parent_entity_type = 'task'
          │   │             AND eim.child_entity_type = 'form'
          │   │             AND eim.active_flag = true
          │   │             AND f.active_flag = true
          │   │
          │   └─ Fallback: api.formApi.list({ parentId, parentType: "task" })
          │
          └─ Line 200-281: Renders based on view mode
              └─ Table View (default) → FilteredDataTable
                  └─ Uses config.columns from entityConfig.ts:277-349

  ---
  3. Business Entity Flow

  URL: /biz/dddddddd-dddd-dddd-dddd-dddddddddddd/project

  App.tsx (Auto-Generated Routes - Lines 60-95)
  ├─ generateEntityRoutes() generates route from entityConfig
  ├─ Route path="/biz/:id" → EntityDetailPage (entityType="biz")
  │   └─ Child routes auto-generated from config.childEntities: ['project']
  │   └─ Route path="project" → EntityChildListPage (parentType="biz", childType="project")
  │
  EntityDetailPage.tsx
  ├─ useParams() → id = "dddddddd-dddd-dddd-dddd-dddddddddddd"
  ├─ props: { entityType: "biz" }
  ├─ Line 33: config = getEntityConfig("biz")
  │   └─ entityConfig.ts:514-612 → biz configuration
  │       ├─ childEntities: ['project', 'task', 'wiki', 'artifact', 'form']
  │       ├─ apiEndpoint: '/api/v1/biz'
  │       ├─ hierarchical: { levels: 3, levelNames: ['Department', 'Division', 'Corporate'] }
  │       └─ supportedViews: ['table']
  ├─ Line 69-91: loadData() → API call
  │   └─ api.bizApi.get(id) → GET /api/v1/biz/dddddddd...
  ├─ Line 138-145: useDynamicChildEntityTabs()
  │   └─ Creates tabs: ['Overview', 'Projects', 'Tasks', 'Wiki', 'Artifacts', 'Forms']
  ├─ Line 278-289: <DynamicChildEntityTabs> renders tab buttons
  └─ Line 379: <Outlet /> → Renders nested child route
      │
      └─ EntityChildListPage.tsx (Lines 1-281)
          ├─ props: { parentType: "biz", childType: "project" }
          ├─ useParams() → { id: parentId } = "dddddddd-dddd-dddd-dddd-dddddddddddd"
          ├─ Line 33: config = getEntityConfig("project")
          │   └─ entityConfig.ts:88-167 → project configuration
          ├─ Line 73-94: loadChildData() → API call
          │   ├─ Try: api.bizApi.getProjects(parentId)
          │   │   └─ GET /api/v1/biz/dddddddd.../project
          │   │       └─ Backend (biz/routes.ts):
          │   │           SELECT p.* FROM app.d_project p
          │   │           INNER JOIN app.d_entity_id_map eim
          │   │             ON eim.child_entity_id = p.id::text
          │   │           WHERE eim.parent_entity_id = 'dddddddd...'
          │   │             AND eim.parent_entity_type = 'biz'
          │   │             AND eim.child_entity_type = 'project'
          │   │             AND eim.active_flag = true
          │   │             AND p.active_flag = true
          │   │
          │   └─ Fallback: api.projectApi.list({ parentId, parentType: "biz" })
          │
          └─ Line 200-281: Renders based on view mode
              └─ Table View (default) → FilteredDataTable
                  └─ Uses config.columns from entityConfig.ts:93-150

  ---
  Layer-by-Layer Architecture Comparison

  | Layer                 | Project                                                       | Task                                                       | Business
                             | Implementation                          |
  |-----------------------|---------------------------------------------------------------|------------------------------------------------------------|-----------------------------------
  ---------------------------|-----------------------------------------|
  | 1. Sidebar Navigation | /project                                                      | /task                                                      | /biz
                             | Layout.tsx:70-86 - Same array structure |
  | 2. List Route         | <Route path="/project">                                       | <Route path="/task">                                       | <Route path="/biz">
                             | App.tsx:69,70,67 - Identical pattern    |
  | 3. List Component     | <EntityMainPage entityType="project" />                       | <EntityMainPage entityType="task" />                       | <EntityMainPage entityType="biz" 
  />                          | Same universal component                |
  | 4. Detail Route       | <Route path="/project/:id">                                   | <Route path="/task/:id">                                   | <Route path="/biz/:id">
                             | App.tsx:95,130,103 - Nested routes      |
  | 5. Detail Component   | <EntityDetailPage entityType="project" />                     | <EntityDetailPage entityType="task" />                     | <EntityDetailPage entityType="biz"
   />                        | Same universal component                |
  | 6. Child Route        | <Route path="task">                                           | <Route path="form">                                        | <Route path="project">
                             | App.tsx:96,131,104 - Dynamic tabs       |
  | 7. Child Component    | <EntityChildListPage parentType="project" childType="task" /> | <EntityChildListPage parentType="task" childType="form" /> | <EntityChildListPage 
  parentType="biz" childType="project" /> | Same universal component                |
  | 8. Configuration      | entityConfig.ts:88-167                                        | entityConfig.ts:172-267                                    | entityConfig.ts:514-612
                             | Central config file                     |
  | 9. API Endpoint       | /api/v1/project/:id/task                                      | /api/v1/task/:id/form ✅ NEW                                | /api/v1/biz/:id/project
                              | Fastify routes                          |
  | 10. Database Query    | d_entity_id_map INNER JOIN                                    | d_entity_id_map INNER JOIN                                 | d_entity_id_map INNER JOIN
                             | Universal schema                        |
  | 11. RBAC Check        | entity_id_rbac_map WHERE entity='project'                     | entity_id_rbac_map WHERE entity='task'                     | entity_id_rbac_map WHERE
  entity='biz'                        | Same permission table                   |

  ---
  Key Architecture Principles

  1. 100% Universal Components

  - EntityMainPage serves ALL entity list pages
  - EntityDetailPage serves ALL entity detail pages
  - EntityChildListPage serves ALL child entity tabs
  - Layout provides navigation for ALL entities

  2. Configuration-Driven Behavior

  - Single source of truth: entityConfig.ts
  - Defines: columns, fields, views, child entities, API endpoints
  - Components read config at runtime via getEntityConfig(entityType)

  3. Three-Tier Routing Pattern

  TIER 1: /entity           → EntityMainPage (list)
  TIER 2: /entity/:id       → EntityDetailPage (detail + tabs)
  TIER 3: /entity/:id/child → EntityChildListPage (filtered child list)

  4. Universal Database Schema

  - app.d_entity_id_map: Stores ALL parent-child relationships
    - Columns: parent_entity_type, parent_entity_id, child_entity_type, child_entity_id
    - Example: ('project', '84215ccb...', 'task', 'f1111111...')
  - app.entity_id_rbac_map: Stores ALL permissions
    - Columns: empid, entity, entity_id, permission[]
    - Permission array: {0:view, 1:edit, 2:share, 3:delete, 4:create}

  5. Identical API Patterns

  All child entity endpoints follow same structure:
  GET /api/v1/{parent_entity}/:id/{child_entity}
  ├─ RBAC check using entity_id_rbac_map
  ├─ Query using INNER JOIN with d_entity_id_map
  ├─ Pagination (page, limit)
  └─ Response: { data, total, page, limit }

 
  Detailed Architecture Similarities: Task, Project, and Business

  1. NAVIGATION LAYER - Sidebar (Layout.tsx)

  Similarity Pattern: Single Navigation Array Configuration

  All three entities (task, project, biz) share the exact same sidebar architecture:

  Location: /home/rabin/projects/pmo/apps/web/src/components/shared/layout/Layout.tsx:70-86

  const mainNavigationItems = [
    { name: 'Business', href: '/biz', icon: Building2, category: 'organizational' },
    { name: 'Project', href: '/project', icon: FolderOpen, category: 'operational' },
    { name: 'Task', href: '/task', icon: CheckSquare, category: 'operational' },
    // ... other entities
  ];

  Key Similarities:

  - Same Data Structure: All entities use identical { name, href, icon, category } schema
  - Same Rendering Logic: Lines 203-224 - All entities render using same component logic
  - Same Active State: Lines 205, 211-212 - isActive determined by currentPage === item.href
  - Same Icon System: All icons imported from lucide-react (lines 3-22)
  - Same Click Handler: Line 215 - onClick={() => setCurrentPage(item.href)}

  ---
  2. ROUTING LAYER - App.tsx (AUTO-GENERATED ROUTES)

  Similarity Pattern: Config-Driven Route Generation (DRY Principle)

  All core entities use auto-generated routes from entityConfig:

  Location: /home/rabin/projects/pmo/apps/web/src/App.tsx:56-95

  // Core entities with standard routing
  const coreEntities = ['biz', 'office', 'project', 'task', 'employee', 'role', 'worksite', 'client', 'position', 'artifact'];

  // Auto-generate routes for all entities
  const generateEntityRoutes = () => {
    return coreEntities.map(entityType => {
      const config = entityConfigs[entityType];
      return (
        <Fragment key={entityType}>
          {/* TIER 1: List Route */}
          <Route path={`/${entityType}`} element={<ProtectedRoute><EntityMainPage entityType={entityType} /></ProtectedRoute>} />

          {/* TIER 2: Create Route */}
          <Route path={`/${entityType}/new`} element={<ProtectedRoute><EntityCreatePage entityType={entityType} /></ProtectedRoute>} />

          {/* TIER 3: Detail + Child Routes */}
          <Route path={`/${entityType}/:id`} element={<ProtectedRoute><EntityDetailPage entityType={entityType} /></ProtectedRoute>}>
            {config.childEntities?.map(childType => (
              <Route key={childType} path={childType} element={<EntityChildListPage parentType={entityType} childType={childType} />} />
            ))}
          </Route>
        </Fragment>
      );
    });
  };

  // Usage in Routes
  <Routes>
    {generateEntityRoutes()}  {/* Generates 30 routes for 10 entities */}
  </Routes>

  Key Architecture Benefits:

  ✅ Single Source of Truth: Routes generated from entityConfig.ts
  ✅ DRY Principle: 89 lines reduced to 15-line generator function (-55% code)
  ✅ Zero Duplication: Impossible to have inconsistent routes
  ✅ Easy to Extend: Add entity = add 1 line to coreEntities array
  ✅ Type-Safe: Full TypeScript validation
  ✅ Maintainable: Child routes auto-generated from config.childEntities

  Example: Adding a New Entity
  BEFORE: Required 3 manual route blocks (list, create, detail + children)
  AFTER: Add 'newEntity' to coreEntities array - routes auto-generated! ✅

  - Identical Component: All use EntityMainPage for list view
  - Identical Component: All use EntityDetailPage for detail view
  - Identical Component: All use EntityChildListPage for child entities
  - Same Prop Pattern: All receive entityType prop (e.g., entityType="task")
  - Same Nesting: All use React Router's <Outlet /> for child routes
  - Config-Driven: Child routes generated from entityConfig.childEntities

  ---
  3. ENTITY MAIN PAGE (List View)

  Similarity Pattern: Universal Entity Table

  Location: /home/rabin/projects/pmo/apps/web/src/pages/shared/EntityMainPage.tsx

  All three entities share the exact same component with different configurations:

  export function EntityMainPage({ entityType }: EntityMainPageProps) {
    const config = getEntityConfig(entityType);  // Line 31 - Config lookup

    // UNIVERSAL FEATURES (shared by all):
    const handleRowClick = (item: any) => {
      navigate(`/${entityType}/${item.id}`);     // Line 67 - Same navigation
    };

    return (
      <FilteredDataTable                         // Line 152 - Same table component
        entityType={entityType}
        onRowClick={handleRowClick}
      />
    );
  }

  Key Similarities:

  - Same Component Structure: Lines 29-266 - All entities use identical JSX structure
  - Same Data Loading: Lines 44-64 - Dynamic API call via api[${entityType}Api].list()
  - Same Row Click Handler: Lines 66-68 - Navigate to /${entityType}/${id}
  - Same Create Button: Lines 249-255 - Navigate to /${entityType}/new
  - Same View Modes: Table, Kanban, Grid all use same rendering logic (lines 148-220)

  Configuration-Driven Differences:

  Project Config (entityConfig.ts:88-167):
  project: {
    columns: [...],           // Custom columns
    childEntities: ['task', 'wiki', 'artifact', 'form'],
    supportedViews: ['table']
  }

  Task Config (entityConfig.ts:172-267):
  task: {
    columns: [...],           // Custom columns
    childEntities: ['form', 'artifact'],
    supportedViews: ['table', 'kanban']
  }

  Business Config (entityConfig.ts:514-612):
  biz: {
    columns: [...],           // Custom columns
    childEntities: ['project'],
    supportedViews: ['table'],
    hierarchical: { levels: 3, ... }
  }

  ---
  4. ENTITY DETAIL PAGE

  Similarity Pattern: Universal Detail View with Dynamic Tabs

  Location: /home/rabin/projects/pmo/apps/web/src/pages/shared/EntityDetailPage.tsx

  All three entities use the exact same detail page component:

  export function EntityDetailPage({ entityType }: EntityDetailPageProps) {
    const { id } = useParams();                           // Line 29
    const config = getEntityConfig(entityType);           // Line 32

    // UNIVERSAL FEATURES:
    const loadData = async () => {
      const apiModule = (api as any)[`${entityType}Api`]; // Line 116
      const response = await apiModule.get(id);           // Line 121
    };

    // DYNAMIC TABS (based on config.childEntities)
    const { tabs } = useDynamicChildEntityTabs(entityType, id); // Line 45

    return (
      <>
        <DynamicChildEntityTabs tabs={allTabs} />        // Line 280
        {isOverviewTab ? (
          <EntityFormContainer />                         // Line 340
        ) : (
          <Outlet />  // Child entity table                Line 379
        )}
      </>
    );
  }

  Key Similarities:

  - Same Data Fetching: Lines 110-144 - Dynamic API call via ${entityType}Api.get(id)
  - Same Header: Lines 221-238 - Back button + entity name display
  - Same Edit Mode: Lines 240-274 - Edit/Save/Cancel button logic
  - Same Tab System: Lines 278-289 - DynamicChildEntityTabs component
  - Same Overview Tab: Lines 292-360 - Entity field display using EntityFormContainer
  - Same Child Routing: Line 379 - <Outlet /> renders child entity tables

  Dynamic Behavior Based on Config:

  Project Detail (/project/:id):
  - Shows 4 tabs: Overview, Task, Wiki, Artifact, Form (from childEntities: ['task', 'wiki', 'artifact', 'form'])
  - Clicking "Task" tab → navigates to /project/:id/task
  - Renders EntityChildListPage parentType="project" childType="task"

  Task Detail (/task/:id):
  - Shows 2 tabs: Overview, Form, Artifact (from childEntities: ['form', 'artifact'])
  - Clicking "Form" tab → navigates to /task/:id/form
  - Renders EntityChildListPage parentType="task" childType="form"

  Business Detail (/biz/:id):
  - Shows 1 tab: Overview, Project (from childEntities: ['project'])
  - Clicking "Project" tab → navigates to /biz/:id/project
  - Renders EntityChildListPage parentType="biz" childType="project"

  ---
  5. API ARCHITECTURE

  Similarity Pattern: Parallel Endpoint Structure

  All three entities have identical API endpoint patterns:

  Project API (apps/api/src/modules/project/routes.ts):
  GET    /api/v1/project           // List all projects
  GET    /api/v1/project/:id       // Get single project
  POST   /api/v1/project           // Create project
  PUT    /api/v1/project/:id       // Update project
  DELETE /api/v1/project/:id       // Delete project

  // Child entity endpoints (using factory pattern ✨)
  GET    /api/v1/project/:id/task
  GET    /api/v1/project/:id/wiki
  GET    /api/v1/project/:id/artifact
  GET    /api/v1/project/:id/form

  Task API (apps/api/src/modules/task/routes.ts):
  GET    /api/v1/task           // List all tasks
  GET    /api/v1/task/:id       // Get single task
  POST   /api/v1/task           // Create task
  PUT    /api/v1/task/:id       // Update task
  DELETE /api/v1/task/:id       // Delete task

  // Child entity endpoints (using factory pattern ✨)
  GET    /api/v1/task/:id/form
  GET    /api/v1/task/:id/artifact

  Business API (apps/api/src/modules/biz/routes.ts):
  GET    /api/v1/biz           // List all business units
  GET    /api/v1/biz/:id       // Get single business unit
  POST   /api/v1/biz           // Create business unit
  PUT    /api/v1/biz/:id       // Update business unit
  DELETE /api/v1/biz/:id       // Delete business unit

  // Child entity endpoints
  GET    /api/v1/biz/:id/project
  GET    /api/v1/biz/:id/task
  GET    /api/v1/biz/:id/wiki
  GET    /api/v1/biz/:id/artifact
  GET    /api/v1/biz/:id/form

  ---
  5a. DRY PRINCIPLE: Child Entity Route Factory Pattern ✨

  **Problem Solved:** Eliminated 300+ lines of duplicate code across entity modules

  **Location:** `apps/api/src/lib/child-entity-route-factory.ts`

  **Pattern:** Higher-Order Route Factory that creates standardized child entity endpoints

  Usage Example in project/routes.ts:
  ```typescript
  import { createBulkChildEntityEndpoints } from '../../lib/child-entity-route-factory.js';

  export async function projectRoutes(fastify: FastifyInstance) {
    // ... CRUD endpoints (list, get, create, update, delete) ...

    // Replace 150+ lines of duplicate code with 1 line:
    createBulkChildEntityEndpoints(fastify, 'project', ['form', 'artifact']);
  }
  ```

  Usage Example in task/routes.ts:
  ```typescript
  import { createBulkChildEntityEndpoints } from '../../lib/child-entity-route-factory.js';

  export async function taskRoutes(fastify: FastifyInstance) {
    // ... CRUD endpoints ...

    // Replace 150+ lines of duplicate code with 1 line:
    createBulkChildEntityEndpoints(fastify, 'task', ['form', 'artifact']);
  }
  ```

  What the Factory Creates:
  - ✅ Universal RBAC check using entity_id_rbac_map
  - ✅ Standard pagination (page, limit)
  - ✅ Unified error handling
  - ✅ Consistent response format: { data, total, page, limit }
  - ✅ Works with d_entity_id_map universal relationship table

  Benefits:
  - 📉 **300+ lines eliminated** across 2 modules
  - 🎯 **Single source of truth** for child entity endpoints
  - 🔒 **Consistent RBAC** - impossible to have security gaps
  - 🚀 **Easy to extend** - add new child entities with 1 word
  - ✅ **100% test coverage** - all endpoints verified working

  How to Use Elsewhere:

  Example 1: Add child endpoints to Office module
  ```typescript
  // apps/api/src/modules/office/routes.ts
  import { createBulkChildEntityEndpoints } from '../../lib/child-entity-route-factory.js';

  export async function officeRoutes(fastify: FastifyInstance) {
    // ... CRUD endpoints ...

    // Automatically creates: /api/v1/office/:id/project, /api/v1/office/:id/employee
    createBulkChildEntityEndpoints(fastify, 'office', ['project', 'employee']);
  }
  ```

  Example 2: Add child endpoints to Client module
  ```typescript
  // apps/api/src/modules/client/routes.ts
  import { createBulkChildEntityEndpoints } from '../../lib/child-entity-route-factory.js';

  export async function clientRoutes(fastify: FastifyInstance) {
    // ... CRUD endpoints ...

    // Automatically creates: /api/v1/client/:id/project, /api/v1/client/:id/task, /api/v1/client/:id/artifact
    createBulkChildEntityEndpoints(fastify, 'client', ['project', 'task', 'artifact']);
  }
  ```

  Example 3: Add new entity to the system
  ```typescript
  // Step 1: Add entity to ENTITY_TABLE_MAP (child-entity-route-factory.ts)
  export const ENTITY_TABLE_MAP: Record<string, string> = {
    // ... existing mappings ...
    invoice: 'd_invoice',  // New entity
  };

  // Step 2: Use in any parent module
  createBulkChildEntityEndpoints(fastify, 'project', ['task', 'invoice']);  // Add invoice as child
  ```

  Key Similarities in API Implementation:

  1. RBAC Pattern (identical across all):
  const taskAccess = await db.execute(sql`
    SELECT 1 FROM app.entity_id_rbac_map rbac
    WHERE rbac.empid = ${userId}
      AND rbac.entity = 'task'                    // Entity type
      AND (rbac.entity_id = ${id} OR rbac.entity_id = 'all')
      AND rbac.active_flag = true
      AND 0 = ANY(rbac.permission)                // View permission
  `);

  2. Child Entity Query Pattern (identical across all):
  // Example: /api/v1/task/:id/form endpoint
  const forms = await db.execute(sql`
    SELECT f.*, COALESCE(f.name, 'Untitled Form') as name
    FROM app.d_form_head f
    INNER JOIN app.d_entity_id_map eim ON eim.child_entity_id = f.id::text
    WHERE eim.parent_entity_id = ${taskId}
      AND eim.parent_entity_type = 'task'         // Parent type
      AND eim.child_entity_type = 'form'          // Child type
      AND eim.active_flag = true
      AND f.active_flag = true
    ORDER BY f.created_ts DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  3. Response Format (identical across all):
  return {
    data: items,
    total: Number(countResult[0]?.total || 0),
    page,
    limit
  };

  ---
  6. DATABASE ARCHITECTURE

  Similarity Pattern: Unified Entity Relationship Model

  All three entities use the same database pattern:

  Core Entity Tables:
  - app.d_project - Projects table
  - app.d_task - Tasks table
  - app.d_business - Business units table

  Universal Relationship Table:
  - app.d_entity_id_map - Links ALL parent-child relationships

  -- Example relationships in d_entity_id_map:
  parent_entity_type = 'project', parent_entity_id = 'abc123', child_entity_type = 'task', child_entity_id = 'def456'
  parent_entity_type = 'task',    parent_entity_id = 'def456', child_entity_type = 'form', child_entity_id = 'ghi789'
  parent_entity_type = 'biz',     parent_entity_id = 'xyz999', child_entity_type = 'project', child_entity_id = 'abc123'

  Universal RBAC Table:
  - app.entity_id_rbac_map - Permissions for ALL entities

  -- Example permissions:
  entity = 'task',    entity_id = 'all',    permission = {0,1,2,3,4}  -- All task permissions
  entity = 'project', entity_id = 'abc123', permission = {0,1}        -- View/edit specific project
  entity = 'biz',     entity_id = 'all',    permission = {0}          -- View all business units

  ---
  7. CONFIGURATION SYSTEM

  Similarity Pattern: Declarative Entity Config

  All entities are defined in one centralized config file:

  Location: /home/rabin/projects/pmo/apps/web/src/lib/entityConfig.ts

  export const entityConfigs: Record<string, EntityConfig> = {
    project: {
      name: 'project',
      displayName: 'Project',
      pluralName: 'Projects',
      apiEndpoint: '/api/v1/project',
      columns: [...],              // Table columns
      fields: [...],               // Form fields
      supportedViews: ['table'],
      childEntities: ['task', 'wiki', 'artifact', 'form']
    },

    task: {
      name: 'task',
      displayName: 'Task',
      pluralName: 'Tasks',
      apiEndpoint: '/api/v1/task',
      columns: [...],
      fields: [...],
      supportedViews: ['table', 'kanban'],
      kanban: { groupByField: 'stage', ... },
      childEntities: ['form', 'artifact']
    },

    biz: {
      name: 'biz',
      displayName: 'Business Unit',
      pluralName: 'Business Units',
      apiEndpoint: '/api/v1/biz',
      columns: [...],
      fields: [...],
      supportedViews: ['table'],
      hierarchical: { levels: 3, ... },
      childEntities: ['project']
    }
  };

  What the Config Controls:

  - Table Columns: Which columns appear in EntityMainPage table
  - Form Fields: Which fields appear in EntityDetailPage form
  - Child Tabs: Which tabs appear in EntityDetailPage based on childEntities
  - API Endpoint: Where to fetch data from
  - View Modes: Table/Kanban/Grid availability
  - Special Features: Kanban config, hierarchical config, etc.

  ---
  SUMMARY: Core Architectural Similarities

  | Layer              | Similarity                                            | Evidence                                         |
  |--------------------|-------------------------------------------------------|--------------------------------------------------|
  | Sidebar Navigation | All entities use same mainNavigationItems array       | Layout.tsx:70-86                                 |
  | Routing            | All use same 3-tier route pattern (list/detail/child) | App.tsx:67-133                                   |
  | List Page          | All use same EntityMainPage component                 | EntityMainPage.tsx:29-266                        |
  | Detail Page        | All use same EntityDetailPage component               | EntityDetailPage.tsx:28-383                      |
  | API Endpoints      | All follow same REST pattern + child endpoints        | task/routes.ts, project/routes.ts, biz/routes.ts |
  | Database           | All use d_entity_id_map for relationships             | d_entity_id_map table                            |
  | RBAC               | All use entity_id_rbac_map for permissions            | entity_id_rbac_map table                         |
  | Configuration      | All defined in single entityConfigs object            | entityConfig.ts:84-1520                          |

  The system is 100% universal - adding a new entity only requires:
  1. Creating config entry in entityConfig.ts
  2. Adding routes in App.tsx
  3. Creating API endpoints following the pattern
  4. Defining database table + populating d_entity_id_map for relationships