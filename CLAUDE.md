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

Strictly run API using tools

# PMO Platform Management Tools

Complete toolkit for platform operations, database management, API testing, and monitoring.

---

## 📁 Tools Directory

```
tools/
├── README.md          # This guide
├── start-all.sh       # Start all services (DB + API + Web)
├── db-import.sh       # Import database schema (28 DDL files)
├── test-api.sh        # Generic API testing tool
├── logs-api.sh        # View API server logs
└── logs-web.sh        # View web application logs
```

---

## 🚀 Quick Start

### Start the Platform

```bash
./tools/start-all.sh
```

**What it does:**
- Starts Docker services (PostgreSQL, Redis, MinIO, MailHog)
- Imports database schema with all 28 DDL files
- Starts API server on port 4000
- Starts web application on port 5173

**Access:**
- Web App: http://localhost:5173
- API: http://localhost:4000
- API Docs: http://localhost:4000/docs

---

## 🧪 Test API Endpoints

### Quick Testing

```bash
# Test any endpoint
./tools/test-api.sh <METHOD> <ENDPOINT> [JSON_DATA]

# Examples
./tools/test-api.sh GET /api/v1/form
./tools/test-api.sh POST /api/v1/form '{"name":"Test","schema":{"steps":[]}}'
./tools/test-api.sh PUT /api/v1/form/uuid '{"name":"Updated"}'
./tools/test-api.sh DELETE /api/v1/form/uuid
```

**Features:**
- Auto-authentication with James Miller account
- Colored HTTP status indicators
- JSON formatting with `jq`
- Supports GET, POST, PUT, DELETE

**More examples:** See commands below or test different endpoints

---

## 🗄️ Database Management

### Import/Reset Database

```bash
./tools/db-import.sh
```

**What it does:**
- Drops existing schema
- Imports 28 DDL files in dependency order
- Validates schema integrity
- Loads sample data (5 employees, 5 projects, 8 tasks, etc.)

**Options:**
```bash
./tools/db-import.sh --dry-run       # Validate without importing
./tools/db-import.sh --verbose       # Detailed output
./tools/db-import.sh --skip-validation  # Skip post-import checks
```

**When to use:**
- Initial setup
- After schema changes
- Data corruption recovery
- Development data refresh

---

## 📊 View Logs

### API Server Logs

```bash
./tools/logs-api.sh [lines]      # View last N lines (default: 100)
./tools/logs-api.sh -f           # Follow logs in real-time
```

### Web Application Logs

```bash
./tools/logs-web.sh [lines]      # View last N lines (default: 100)
./tools/logs-web.sh -f           # Follow logs in real-time
```

---

## 📋 Common Workflows

### Development Setup
```bash
# 1. Start everything
./tools/start-all.sh

# 2. Test API is working
./tools/test-api.sh GET /api/v1/form

# 3. Monitor API logs
./tools/logs-api.sh -f
```

### After Schema Changes
```bash
# 1. Reimport database
./tools/db-import.sh

# 2. Restart platform (stop and start-all)
./tools/start-all.sh

# 3. Test endpoints
./tools/test-api.sh GET /api/v1/project
```

### Debugging Issues
```bash
# 1. Check API logs
./tools/logs-api.sh

# 2. Check web logs
./tools/logs-web.sh

# 3. Test specific endpoint
./tools/test-api.sh GET /api/v1/employee
```

---

## 🔧 Environment Variables

### Database Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | Database host |
| `DB_PORT` | `5434` | Database port |
| `DB_USER` | `app` | Database user |
| `DB_PASSWORD` | `app` | Database password |
| `DB_NAME` | `app` | Database name |

### API Testing Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `API_URL` | `http://localhost:4000` | API base URL |
| `API_TEST_EMAIL` | `james.miller@huronhome.ca` | Login email |
| `API_TEST_PASSWORD` | `password123` | Login password |
| `NO_AUTH` | (unset) | Skip authentication |

**Example:**
```bash
API_URL=http://staging.api.com ./tools/test-api.sh GET /api/v1/form
```

---

## 🌐 Service Ports

| Service | Port | URL |
|---------|------|-----|
| Web Application | 5173 | http://localhost:5173 |
| API Server | 4000 | http://localhost:4000 |
| API Documentation | 4000 | http://localhost:4000/docs |
| PostgreSQL | 5434 | localhost:5434 |
| Redis | 6379 | localhost:6379 |
| MinIO Console | 9001 | http://localhost:9001 |
| MailHog | 8025 | http://localhost:8025 |

**Default Credentials:**
- Database: `app` / `app`
- MinIO: `minio` / `minio123`
- Test Account: `james.miller@huronhome.ca` / `password123`

---

## 📚 Additional Documentation

- **[Database Schema](../db/README.md)** - DDL files and data model
- **[API Documentation](../apps/api/README.md)** - Backend architecture
- **[Frontend Guide](../apps/web/README.md)** - UI/UX documentation
- **[Main README](../README.md)** - Project overview




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

  URL: /project/84215ccb-313d-48f8-9c37-4398f28c0b1f/task

  App.tsx (Line 152-157)
  ├─ Route path="/project/:id" → EntityDetailPage (parentType="project")
  │   └─ Route path="task" → EntityChildListPage (parentType="project", childType="task")
  │
  EntityDetailPage.tsx
  ├─ useParams() → id = "84215ccb-313d-48f8-9c37-4398f28c0b1f"
  ├─ props: { entityType: "project" }
  ├─ Renders tabs at top
  └─ Line 376: <Outlet /> → This renders the nested child route
      │
      └─ EntityChildListPage.tsx (Line 30)
          ├─ props: { parentType: "project", childType: "task" }
          ├─ useParams() → id = "84215ccb-313d-48f8-9c37-4398f28c0b1f" (inherited from parent route)
          ├─ Line 33: config = getEntityConfig("task")
          ├─ Line 67-103: loadChildData() → Calls API
          └─ Renders one of three views:
              ├─ Table View → FilteredDataTable
              ├─ Kanban View → KanbanBoard
              └─ Grid View → GridView

  Step-by-step breakdown:

  1. App.tsx:152-157 - Routing configuration
  <Route path="/project/:id" element={<EntityDetailPage entityType="project" />}>
    <Route path="task" element={<EntityChildListPage parentType="project" childType="task" />} />
  </Route>
  2. EntityDetailPage receives:
    - entityType="project" as a prop (from route element)
    - id from URL params via useParams()
    - Renders <Outlet /> at line 376 which is where child routes render
  3. EntityChildListPage receives:
    - parentType="project" as a prop (from route element)
    - childType="task" as a prop (from route element)
    - id from URL params via useParams() - this gets the parent's ID from the URL
    - Accesses parent ID as parentId via const { id: parentId } = useParams()
  4. Data loading in EntityChildListPage:
    - Line 73-94: Tries to call projectApi.getTasks(parentId)
    - If that doesn't exist, falls back to taskApi.list({ parentId, parentType: "project" })
  5. Rendering based on view mode (lines 200+):
    - Table view: <FilteredDataTable parentId={parentId} parentType={parentType} childType={childType} />
    - Kanban view: <KanbanBoard columns={kanbanColumns} onCardMove={handleCardMove} />
    - Grid view: <GridView items={data} titleField={...} />