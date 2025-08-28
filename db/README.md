# PMO Database Schema Documentation

## Overview

This database schema provides a complete project management office (PMO) system with comprehensive role-based access control (RBAC), hierarchical scoping, and Canadian organizational structure. The schema has been fully aligned with the finegrained API modules for seamless integration.

## Recent Updates (2025-08-27)

### Major Schema Changes
1. **Authentication System Added**: Employee table now includes `email` (unique) and `password_hash` fields for JWT authentication
2. **DDL File Updates**: All individual `db/*.ddl` files updated with authentication fields and consistent naming
3. **Field Standardization**: Changed all `"desc"` fields to `"descr"` across all DDL files and consolidated schema
4. **Password Security**: All users have bcrypt-hashed passwords (development password: `password123`)
5. **Email Authentication**: Users now login with email instead of usernames
6. **API Integration**: Employee API updated to handle email/password fields with proper validation
7. **Schema Consistency**: DDL files are now the source of truth, consolidated into `schema.sql` with data curation

## Database Structure

- **Database**: PostgreSQL 16+ with PostGIS extension
- **Schema**: `app` 
- **Total Tables**: 30 tables with proper dependency order and referential integrity
- **Extensions**: pgcrypto (UUID generation + password hashing), postgis (geospatial support)
- **Performance**: Comprehensive indexing strategy for optimal query performance
- **Authentication**: JWT-based with bcrypt password hashing and email login
- **Route Pages**: 23 comprehensive application routes with component mappings
- **User Permissions**: 70+ permission entries with scope-based access control
- **DDL Structure**: Individual `*.ddl` files in `db/` directory, consolidated into `schema.sql`

## Key Design Principles

1. **RBAC-First Architecture**: Scope-based permissions with `rel_user_scope` table driving all access control
2. **Hierarchical Access Control**: Parent scope permissions cascade to child scopes automatically
3. **Temporal Data Support**: Head/Records pattern for audit trails and versioning
4. **Canadian Geographic Structure**: Location hierarchy reflects Canadian organizational structure
5. **Finegrained API Integration**: Database perfectly aligned with API route modules
6. **Performance Optimized**: 25+ strategic indexes for high-performance queries

## Schema Installation

### Quick Start
```bash
# From the db/ directory
./install.sh
```

### Manual Installation
```bash
# Start database container
make up

# Install complete schema with data
psql "postgresql://app:app@localhost:5434/app" -f schema.sql
```

### Management Commands
```bash
./manage.sh status       # Show database status
./manage.sh connect      # Connect to database
./manage.sh sample-data  # View sample data
./manage.sh backup       # Create backup
./manage.sh reset        # Drop and recreate (WARNING: destroys data)
```

## Hierarchical Data Structure

### Business Hierarchy
```
TechCorp Inc. (Corporation)
├── Engineering Division (Division)
│   ├── Platform Engineering (Department)
│   │   └── Backend Team (Team)
│   └── Product Development (Department)
│       └── Frontend Team (Team)
└── Sales Division (Division)
```

### Location Hierarchy (Canadian Structure)
```
North America (Corp-Region)
└── Canada (Country)
    └── Ontario (Province)
        ├── Southern Ontario (Region)
        │   ├── London
        │   └── Sarnia
        ├── Eastern Ontario (Region)
        │   ├── Toronto
        │   └── Mississauga
        └── Northern Ontario (Region)
            ├── Thunder Bay
            └── Barrie
```

### HR Hierarchy
```
CEO Office (C-Level)
├── VP Engineering (VP Level)
│   └── Engineering Directors (Director)
│       └── Engineering Managers (Manager)
│           └── Senior Engineers (Senior Manager)
└── VP Sales (VP Level)
```

### Cross-Entity Relationships
- **Worksites** properly linked to both locations and business units
- **Projects** scoped to specific business units, locations, and worksites
- **Tasks** inherit permissions from their parent projects
- **Employee permissions** span multiple scope types for complex access patterns

## RBAC Permission System

### Permission Levels
- **0 (VIEW)**: Read access to entities and their details
- **1 (MODIFY)**: Update existing entity properties
- **2 (SHARE)**: Share entities with other users  
- **3 (DELETE)**: Soft delete or deactivate entities
- **4 (CREATE)**: Create new entities within scope

### Scope Types
- **app**: System-wide administration permissions
- **business**: Business hierarchy permissions
- **location**: Geographic/location permissions  
- **hr**: Human resources hierarchy permissions
- **project**: Project-specific permissions
- **task**: Task-specific permissions
- **worksite**: Physical worksite permissions
- **route_page**: Application page access (view-only: permission level 0)
- **component**: UI component access (view-only: permission level 0)
- **form**: Dynamic form permissions

## Current Permission Data

### User Permissions Sample (70 total records)
```sql
-- John Smith - SUPER ADMIN (61 total permissions)
-- System Administration
John Smith    | app         | System Administration        | {0,1,2,3,4} (super admin)

-- Business Hierarchy (7 units)
John Smith    | business    | TechCorp Inc. Scope          | {0,1,2,3,4} (full access)
John Smith    | business    | Engineering Division Scope   | {0,1,2,3,4} (full access)
John Smith    | business    | Sales Division Scope         | {0,1,2,3,4} (full access)
... (and 4 more business units)

-- Geographic Hierarchy (12 locations)
John Smith    | location    | North America Scope          | {0,1,2,3,4} (full access)
John Smith    | location    | Canada Scope                 | {0,1,2,3,4} (full access)
John Smith    | location    | Ontario Scope                | {0,1,2,3,4} (full access)
... (and 9 more locations)

-- HR Hierarchy (6 departments)
John Smith    | hr          | CEO Office Scope             | {0,1,2,3,4} (full access)
John Smith    | hr          | VP Engineering Scope         | {0,1,2,3,4} (full access)
... (and 4 more HR units)

-- Operations (6 entities)
John Smith    | project     | Platform Modernization Scope | {0,1,2,3,4} (full access)
John Smith    | worksite    | London HQ Scope              | {0,1,2,3,4} (full access)
... (and 4 more operational scopes)

-- Application Access (31 UI entities - view-only)
John Smith    | route_page  | Dashboard                    | {0}         (view access)
John Smith    | route_page  | Admin Dashboard              | {0}         (view access)
John Smith    | component   | DataTable                    | {0}         (view access)
... (and 28 more UI components/pages)

-- Other Users - Limited Permissions
Bob Wilson    | app         | System Administration        | {0,1,2,3,4} (admin permissions)
Jane Doe      | business    | Frontend Team Scope          | {0,1,2,4}   (team permissions)
Mike Chen     | business    | Backend Team Scope           | {0,1,4}     (developer)
```

### Role-Based Permissions (3 templates)
```sql
Project Manager      | project  | Platform Modernization Scope | {0,1,2,3,4}
Senior Developer     | business | Engineering Division Scope   | {0,1}
System Administrator | app      | System Administration        | {0,1,2,3,4}
```

## Sample Data

### Employees (6 total) - Authentication Enabled

1. **John Smith** - Senior Project Manager (Engineering Division) - `123 Richmond St, London, ON N6A 3K7` 
   - **Email**: `john.smith@techcorp.com`
   - **Password**: `password123` (hashed with bcrypt)
   - **Super Admin**: 61 permission entries across all scope types
   - **Authentication**: Full JWT authentication required

2. **Jane Doe** - Principal Frontend Developer (Frontend Team) - `456 King St W, Toronto, ON M5V 1M3`
   - **Email**: `jane.doe@techcorp.com`
   - **Password**: `password123` (hashed with bcrypt)

3. **Bob Wilson** - DevOps Engineer (System Administrator) - `789 Dundas St, London, ON N6A 1H3`
   - **Email**: `bob.wilson@techcorp.com`
   - **Password**: `password123` (hashed with bcrypt)

4. **Alice Johnson** - UX Designer (Product Development) - `321 Bay St, Toronto, ON M5H 2R2`
   - **Email**: `alice.johnson@techcorp.com`
   - **Password**: `password123` (hashed with bcrypt)

5. **Mike Chen** - Backend Engineer (Backend Team) - `654 Yonge St, Toronto, ON M4Y 2A6`
   - **Email**: `mike.chen@techcorp.com`
   - **Password**: `password123` (hashed with bcrypt)

6. **Sarah Lee** - QA Engineer (Engineering Division) - `987 Adelaide St W, Toronto, ON M6J 2S8`
   - **Email**: `sarah.lee@techcorp.com`
   - **Password**: `password123` (hashed with bcrypt)

### Projects (3 active)
1. **Platform Modernization 2024** - Infrastructure upgrade (Toronto Tech Center)
2. **Mobile App V2** - Customer-facing mobile application (Frontend Team)
3. **Ontario Client Portal** - Client management system (London HQ)

### Worksites
- **London HQ**: Main headquarters (London, TechCorp Inc.)
- **Toronto Tech Center**: Development center (Toronto, Engineering Division)
- **Mississauga Sales Office**: Regional sales (Mississauga, Sales Division)

### Clients (4 total)
- **Maple Industries** - contact@maple.ca, +1-519-555-0101
- **Northern Tech Solutions** - hello@northerntech.ca, +1-416-555-0202
- **Great Lakes Corp** - partnerships@greatlakes.ca, +1-905-555-0303
- **Ontario Innovation Hub** - info@innovationhub.on.ca, +1-647-555-0404

## Data Quality and Integrity

### Referential Integrity
- **35 tables** successfully created with proper foreign key constraints
- **All hierarchical relationships** correctly linked with parent_id references
- **Cross-entity relationships** properly maintained (worksites ↔ locations ↔ business units)
- **Permission data** referentially consistent with employee and scope records

### Performance Optimization  
- **25+ strategic indexes** added for high-performance queries
- **Partial indexes** on active records for optimal filtering
- **Composite indexes** on frequently joined columns (scope_type, scope_name)
- **Foreign key indexes** for efficient relationship traversal

### Temporal Data Support
- **from_ts/to_ts** fields for effective dating and audit trails
- **active** flags for soft deletion across all entities
- **created/updated** timestamps for change tracking
- **Head/Records pattern** for project and task versioning

## 🏗️ Entity Relationship Diagram (ERD)

### **Core Entity Groups and Relationships**

```
📊 META TABLES (Configuration)
├── meta_biz_level     → d_scope_business(level_id)
├── meta_loc_level     → d_scope_location(level_id) 
├── meta_hr_level      → d_scope_hr(level_id)
├── meta_project_*     → ops_project_records(status_id/stage_id)
└── meta_task_*        → ops_task_records(status_id/stage_id)

🏢 SCOPE HIERARCHIES (Self-Referencing Trees)
├── d_scope_business   ⟷ d_scope_business(parent_id) [SELF-REF]
├── d_scope_location   ⟷ d_scope_location(parent_id) [SELF-REF]
├── d_scope_hr         ⟷ d_scope_hr(parent_id) [SELF-REF]
└── Cross-Scope Bridge: rel_hr_biz_loc

👥 IDENTITY & ACCESS MANAGEMENT  
├── d_emp (email, password_hash) → rel_user_scope(emp_id) [1:M]
├── d_role                       → rel_emp_role(role_id)  [1:M]
├── rel_emp_role: d_emp ⟷ d_role [M:M BRIDGE]
└── rel_user_scope: RBAC ENGINE (emp_id → scope permissions)

🏭 OPERATIONAL ENTITIES
├── d_worksite → d_scope_location(loc_id) + d_scope_business(biz_id)
├── d_client + d_client_grp → ops_task_head(client_group_id)
└── PROJECT-TASK HIERARCHY:
    ├── ops_project_head → ops_project_records [1:M HEAD/RECORDS]
    ├── ops_task_head    → ops_task_records   [1:M HEAD/RECORDS]  
    └── ops_task_head(parent_head_id) [SELF-REF TASK TREE]

📱 APPLICATION LAYER
├── app_scope_d_route_page(parent_route_id) [SELF-REF ROUTE TREE]
├── app_scope_d_component
├── rel_route_component: routes ⟷ components [M:M BRIDGE]
└── d_app_permission (CREATE/MODIFY/DELETE/VIEW/GRANT)

🔐 PERMISSION SYSTEM (RBAC Core)
├── rel_user_scope:  emp_id → scope_type + scope_permission[]
├── rel_role_scope:  role_id → scope_type + scope_permission[]  
└── rel_scope_permission: scope definitions + metadata
```

### **Key Relationship Patterns**

#### **1. Hierarchical Self-References (Tree Structures)**
```sql
-- Business Hierarchy: TechCorp → Engineering → Backend Team
d_scope_business(parent_id) → d_scope_business(id)

-- Location Hierarchy: Canada → Ontario → London → HQ
d_scope_location(parent_id) → d_scope_location(id)

-- Task Hierarchy: Parent Task → Sub-tasks → Sub-sub-tasks  
ops_task_head(parent_head_id) → ops_task_head(id)

-- Route Hierarchy: /admin → /admin/users → /admin/users/permissions
app_scope_d_route_page(parent_route_id) → app_scope_d_route_page(id)
```

#### **2. Head/Records Pattern (Temporal Versioning)**
```sql
-- Project Management with History
ops_project_head(id) → ops_project_records(head_id) [1:M]
-- Each project head can have multiple record versions over time

-- Task Management with History  
ops_task_head(id) → ops_task_records(head_id) [1:M]
-- Each task head can have multiple record versions as status changes
```

#### **3. Cross-Scope Reference Network**
```sql
-- Worksites Bridge Location + Business
d_worksite.loc_id  → d_scope_location(id)
d_worksite.biz_id  → d_scope_business(id)

-- Projects Reference Multiple Scopes
ops_project_head.location_id → d_scope_location(id)
ops_project_head.biz_id      → d_scope_business(id)  
ops_project_head.worksite_id → d_worksite(id)

-- Tasks Reference Projects + Employees + Worksites
ops_task_head.proj_head_id → ops_project_head(id)
ops_task_head.assignee     → d_emp(id)
ops_task_head.worksite_id  → d_worksite(id)
```

#### **4. RBAC Permission Matrix**
```sql
-- User Permissions (Primary RBAC Engine)
rel_user_scope: emp_id + scope_type + scope_id + scope_permission[]
-- Example: John Smith → 'business' scope → 'Engineering Division' → [0,1,2,3,4]

-- Role-Based Permissions (Secondary)
rel_role_scope: role_id + scope_type + scope_id + scope_permission[]  
-- Example: 'Project Manager' role → 'project' scope → specific projects → [0,1,2]
```

### **Authentication & Authorization Flow**

```
🔐 LOGIN FLOW
1. d_emp.email + password_hash (bcrypt) → JWT token
2. JWT.sub → d_emp.id → rel_user_scope lookup
3. scope_permission[] → API endpoint authorization

📊 PERMISSION LEVELS  
[0: VIEW, 1: MODIFY, 2: SHARE, 3: DELETE, 4: CREATE]
- Route pages/components: VIEW only (level 0)  
- All other scopes: Full permission arrays [0,1,2,3,4]
```

## API Integration Readiness

The database is fully aligned with the finegrained API modules:

### Scope-Based Route Support
- **Scope-location routes** can query `d_scope_location` with hierarchical filtering
- **Scope-business routes** can query `d_scope_business` with parent-child relationships  
- **Employee routes** can access `rel_user_scope` for permission validation
- **Project routes** can perform cross-scope validation using linked entities

### Permission Query Performance
- **rel_user_scope queries** optimized with emp_id, scope_type indexes
- **Hierarchical traversal** efficient with parent_id indexes on all scope tables
- **Cross-scope validation** fast with composite indexes on relationship tables
- **Active record filtering** optimized with partial indexes

### RBAC Function Support
- `checkScopeAccess()` - Fast user permission lookups with indexed queries

## 🔗 **Detailed Table Relationships (LLM Reference)**

### **📋 Complete Foreign Key Mapping**

```sql
-- HIERARCHICAL SELF-REFERENCES
d_scope_location.parent_id        → d_scope_location.id        (ON DELETE SET NULL)
d_scope_business.parent_id        → d_scope_business.id        (ON DELETE SET NULL)  
d_scope_hr.parent_id              → d_scope_hr.id              (ON DELETE SET NULL)
ops_task_head.parent_head_id      → ops_task_head.id           (ON DELETE SET NULL)
app_scope_d_route_page.parent_route_id → app_scope_d_route_page.id (ON DELETE SET NULL)

-- META → SCOPE LEVEL DEFINITIONS  
d_scope_location.level_id         → meta_loc_level.level_id
d_scope_business.level_id         → meta_biz_level.level_id
d_scope_hr.level_id               → meta_hr_level.level_id

-- WORKSITE → SCOPE REFERENCES
d_worksite.loc_id                 → d_scope_location.id        (ON DELETE SET NULL)
d_worksite.biz_id                 → d_scope_business.id        (ON DELETE SET NULL)

-- CROSS-SCOPE BRIDGE TABLE
rel_hr_biz_loc.hr_id              → d_scope_hr.id              (ON DELETE CASCADE)
rel_hr_biz_loc.biz_id             → d_scope_business.id        (ON DELETE SET NULL)
rel_hr_biz_loc.loc_id             → d_scope_location.id        (ON DELETE SET NULL)

-- EMPLOYEE & ROLE SYSTEM
rel_emp_role.emp_id               → d_emp.id                   (ON DELETE CASCADE)
rel_emp_role.role_id              → d_role.id                  (ON DELETE CASCADE)

-- RBAC PERMISSION SYSTEM (Primary)
rel_user_scope.emp_id             → d_emp.id                   (ON DELETE CASCADE)
rel_role_scope.role_id            → d_role.id                  (ON DELETE CASCADE)

-- PROJECT SYSTEM (Head/Records Pattern)
ops_project_head.location_id      → d_scope_location.id        (ON DELETE SET NULL)
ops_project_head.biz_id           → d_scope_business.id        (ON DELETE SET NULL)
ops_project_head.worksite_id      → d_worksite.id              
ops_project_records.head_id       → ops_project_head.id        (ON DELETE CASCADE)
ops_project_records.status_id     → meta_project_status.id
ops_project_records.stage_id      → meta_project_stage.level_id

-- TASK SYSTEM (Head/Records Pattern)  
ops_task_head.proj_head_id        → ops_project_head.id        (ON DELETE CASCADE)
ops_task_head.assignee            → d_emp.id                   (ON DELETE SET NULL)
ops_task_head.worksite_id         → d_worksite.id              (ON DELETE SET NULL)
ops_task_head.client_group_id     → d_client_grp.id            (ON DELETE SET NULL)
ops_task_records.head_id          → ops_task_head.id           (ON DELETE CASCADE)
ops_task_records.status_id        → meta_task_status.id
ops_task_records.stage_id         → meta_task_stage.id

-- CLIENT SYSTEM
d_client_grp.task_head_id         → ops_task_head.id           (ON DELETE CASCADE)

-- APPLICATION LAYER
rel_route_component.route_id      → app_scope_d_route_page.id  (ON DELETE CASCADE)
rel_route_component.component_id  → app_scope_d_component.id   (ON DELETE CASCADE)
```

### **🏢 Scope Hierarchy Traversal Patterns**

```sql  
-- BUSINESS HIERARCHY EXAMPLE
TechCorp Inc. (level_id=1, parent_id=NULL)
├── Engineering Division (level_id=2, parent_id=<TechCorp>)
│   ├── Backend Team (level_id=3, parent_id=<Engineering>)
│   └── Frontend Team (level_id=3, parent_id=<Engineering>)
└── Sales Division (level_id=2, parent_id=<TechCorp>)

-- LOCATION HIERARCHY EXAMPLE  
Canada (level_id=1, parent_id=NULL)
└── Ontario (level_id=2, parent_id=<Canada>)
    ├── London (level_id=3, parent_id=<Ontario>)
    │   └── London HQ (level_id=4, parent_id=<London>)
    └── Toronto (level_id=3, parent_id=<Ontario>)
        └── Toronto Tech Center (level_id=4, parent_id=<Toronto>)

-- TASK HIERARCHY EXAMPLE
Platform Modernization Task (parent_head_id=NULL)
├── Database Migration (parent_head_id=<Platform Modernization>)
│   ├── Schema Updates (parent_head_id=<Database Migration>)
│   └── Data Migration (parent_head_id=<Database Migration>)
└── API Refactoring (parent_head_id=<Platform Modernization>)
```

### **👥 User Permission Resolution Chain**

```sql
-- JOHN SMITH PERMISSION EXAMPLE
1. Login: john.smith@techcorp.com → d_emp.id = '1faf84de...'

2. Permission Lookup:
   SELECT scope_type, scope_id, scope_name, scope_permission 
   FROM rel_user_scope 
   WHERE emp_id = '1faf84de...' AND active = true

3. Sample Results (61 permission entries):
   - scope_type='app', scope_permission=[0,1,2,3,4] (Full admin)
   - scope_type='business', scope_id='<Engineering>', scope_permission=[0,1,2,3,4]
   - scope_type='location', scope_id='<London HQ>', scope_permission=[0,1,2,3,4] 
   - scope_type='route_page', scope_id='<Admin Dashboard>', scope_permission=[0]
   - scope_type='component', scope_id='<User Management>', scope_permission=[0]

4. API Authorization:
   checkScopeAccess('1faf84de...', 'business', 'delete', '<Engineering ID>')
   → Returns: { allowed: true, permissions: [0,1,2,3,4] }
```

### **🗂️ Data Dictionary: Key Table Purposes**

| **Table Category** | **Table Name** | **Primary Purpose** | **Key Relationships** |
|-------------------|----------------|-------------------|----------------------|
| **Meta** | `meta_*_level` | Define hierarchy levels for scopes | Referenced by scope tables |
| **Meta** | `meta_*_status/stage` | Define workflow states | Referenced by record tables |
| **Core Scopes** | `d_scope_location` | Geographic hierarchy | Self-ref + worksite/project refs |
| **Core Scopes** | `d_scope_business` | Organizational hierarchy | Self-ref + worksite/project refs |
| **Core Scopes** | `d_scope_hr` | Human resources hierarchy | Self-ref + bridge to biz/loc |
| **Identity** | `d_emp` | Employee master with auth | → rel_user_scope (RBAC engine) |
| **Identity** | `d_role` | Role definitions | → rel_emp_role, rel_role_scope |
| **Operations** | `d_worksite` | Physical service locations | → location + business scopes |
| **Operations** | `ops_project_head` | Project metadata | → multiple scopes + worksites |
| **Operations** | `ops_project_records` | Project temporal data | → project head (versioning) |
| **Operations** | `ops_task_head` | Task metadata + hierarchy | → project + employee + worksite |
| **Operations** | `ops_task_records` | Task temporal data | → task head (versioning) |
| **Client** | `d_client` | Client master data | Referenced by client groups |
| **Client** | `d_client_grp` | Client groupings per task | → tasks (many clients per task) |
| **App Layer** | `app_scope_d_route_page` | UI route definitions + hierarchy | Self-ref + component mapping |
| **App Layer** | `app_scope_d_component` | Reusable UI components | Referenced by routes |
| **RBAC Core** | `rel_user_scope` | **Primary permission engine** | emp_id → scope + permissions |
| **RBAC Core** | `rel_role_scope` | Role-based permissions | role_id → scope + permissions |
| **Bridges** | `rel_*` | Many-to-many relationships | Connect entities across domains |

### **🔍 LLM Query Patterns for Common Operations**

```sql
-- Find all employees with admin permissions  
SELECT DISTINCT e.name, e.email
FROM d_emp e 
JOIN rel_user_scope rus ON e.id = rus.emp_id
WHERE rus.scope_type = 'app' AND 4 = ANY(rus.scope_permission) AND rus.active = true;

-- Get project hierarchy with location context
SELECT ph.name as project, sl.name as location, sb.name as business_unit
FROM ops_project_head ph
LEFT JOIN d_scope_location sl ON ph.location_id = sl.id  
LEFT JOIN d_scope_business sb ON ph.biz_id = sb.id
WHERE ph.active = true;

-- Find task assignees within location scope
SELECT th.id, tr.title, e.name as assignee, sl.name as location
FROM ops_task_head th
JOIN ops_task_records tr ON th.id = tr.head_id AND tr.active = true
LEFT JOIN d_emp e ON th.assignee = e.id
LEFT JOIN d_worksite w ON th.worksite_id = w.id
LEFT JOIN d_scope_location sl ON w.loc_id = sl.id;

-- Check user permissions for specific business unit
SELECT scope_permission 
FROM rel_user_scope
WHERE emp_id = $1 AND scope_type = 'business' AND scope_id = $2 AND active = true;
```

## 📐 **Database Constraints & Dependencies**

### **🔒 Foreign Key Constraint Behaviors**

| **Constraint Pattern** | **ON DELETE Behavior** | **Purpose** |
|------------------------|------------------------|-------------|
| `ON DELETE CASCADE` | Child records deleted with parent | Hard dependencies (records, roles) |
| `ON DELETE SET NULL` | Foreign key set to NULL | Soft references (optional relationships) |
| No ON DELETE | Prevent deletion if references exist | Strong integrity (meta tables) |

### **⚡ Table Creation Dependency Order**

```sql
-- LEVEL 1: Extensions and Meta Tables (No Dependencies)
CREATE EXTENSION pgcrypto, postgis;
CREATE SCHEMA app;
meta_biz_level, meta_loc_level, meta_hr_level
meta_project_status, meta_project_stage
meta_task_status, meta_task_stage, meta_tasklog_*
d_app_permission

-- LEVEL 2: Core Scope Tables (Self-Referencing)
d_scope_location      -- References meta_loc_level + self
d_scope_business      -- References meta_biz_level + self  
d_scope_hr           -- References meta_hr_level + self

-- LEVEL 3: Cross-Scope Bridge + Core Entities
rel_hr_biz_loc       -- References all 3 scope tables
d_worksite           -- References location + business scopes
d_emp                -- No external dependencies (authentication)
d_role               -- No external dependencies

-- LEVEL 4: Relationship Tables  
rel_emp_role         -- References d_emp + d_role

-- LEVEL 5: Client System
d_client             -- No external dependencies
d_client_grp         -- References ops_task_head (forward reference)

-- LEVEL 6: Project System (Head/Records)
ops_project_head     -- References scopes + worksite
ops_project_records  -- References project head + meta statuses

-- LEVEL 7: Task System (Head/Records)
ops_task_head        -- References projects + employees + worksites + clients
ops_task_records     -- References task head + meta statuses

-- LEVEL 8: Application Layer
app_scope_d_route_page   -- Self-referencing (parent routes)
app_scope_d_component    -- No dependencies
rel_route_component      -- References routes + components

-- LEVEL 9: Permission System (Final Layer)
rel_scope_permission     -- Metadata table for scope definitions
rel_role_scope           -- References roles (role-based permissions)
rel_user_scope           -- References employees (primary RBAC engine)
```

### **🔄 Circular Reference Handling**

```sql
-- HANDLED VIA FORWARD REFERENCES:
d_client_grp.task_head_id → ops_task_head.id
-- Created first without FK, then ALTER TABLE ADD CONSTRAINT

-- SELF-REFERENCING WITH NULL PARENT:
parent_id fields allow NULL for root nodes in hierarchies
```

### **🎯 RBAC Function Support**
- `getUserScopes()` - Efficient scope enumeration for users
- `applyScopeFiltering()` - Optimized scope ID filtering for database queries
- `isUserAdmin()` - Quick admin permission checks via app-scope permissions
- `checkScopeAccess()` - Fast user permission lookups with indexed queries

## Table Creation Order (Dependency Levels)

### Level 1: Meta Tables (9 tables)
- `meta_biz_level`, `meta_loc_level`, `meta_hr_level`
- `meta_project_status`, `meta_project_stage`
- `meta_task_status`, `meta_task_stage`
- `meta_tasklog_state`, `meta_tasklog_type`

### Level 2: App Permissions (1 table)
- `d_app_permission`

### Level 3: Scope Hierarchies (3 tables)
- `d_scope_location`, `d_scope_business`, `d_scope_hr`

### Level 4: Worksites (1 table)
- `d_worksite` (references location + business)

### Level 5: Cross-Dimensional Relations (1 table)
- `rel_hr_biz_loc`

### Level 6: Identity Management (3 tables)
- `d_emp`, `d_role`, `rel_emp_role`

### Level 7: Client Management (2 tables)
- `d_client`, `d_client_grp`

### Level 8: Project Management (2 tables)
- `ops_project_head`, `ops_project_records`

### Level 9: Task Management (2 tables)
- `ops_task_head`, `ops_task_records`

### Level 10: Employee Groups (1 table)
- `d_emp_grp`

### Level 11: Task Logging (2 tables)
- `ops_tasklog_head`, `ops_tasklog_records`

### Level 12: Form Management (2 tables)
- `ops_formlog_head`, `ops_formlog_records`

### Level 13: UI/UX Management (3 tables)
- `app_d_route_page`, `app_d_component`, `rel_route_component`

### Level 14: Unified Permissions (3 tables)
- `rel_scope_permission`, `rel_role_scope`, `rel_user_scope`

## Common Queries

### Check User Permissions
```sql
SELECT 
  e.name as employee,
  rus.scope_type,
  rus.scope_name,
  rus.scope_permission,
  CASE 
    WHEN 0 = ANY(rus.scope_permission) THEN 'VIEW '
    ELSE ''
  END ||
  CASE 
    WHEN 1 = ANY(rus.scope_permission) THEN 'MODIFY '
    ELSE ''
  END ||
  CASE 
    WHEN 2 = ANY(rus.scope_permission) THEN 'SHARE '
    ELSE ''
  END ||
  CASE 
    WHEN 3 = ANY(rus.scope_permission) THEN 'DELETE '
    ELSE ''
  END ||
  CASE 
    WHEN 4 = ANY(rus.scope_permission) THEN 'CREATE'
    ELSE ''
  END as permissions_text
FROM app.rel_user_scope rus
JOIN app.d_emp e ON rus.emp_id = e.id
WHERE rus.active = true
ORDER BY e.name, rus.scope_type;
```

### View Business Hierarchy
```sql
WITH RECURSIVE business_tree AS (
  SELECT id, name, level_id, 0 as depth, ARRAY[name] as path
  FROM app.d_scope_business 
  WHERE parent_id IS NULL
  
  UNION ALL
  
  SELECT b.id, b.name, b.level_id, bt.depth + 1, bt.path || b.name
  FROM app.d_scope_business b
  JOIN business_tree bt ON b.parent_id = bt.id
)
SELECT 
  REPEAT('  ', depth) || name as hierarchy,
  level_id
FROM business_tree 
ORDER BY path;
```

### View Location Hierarchy
```sql
WITH RECURSIVE location_tree AS (
  SELECT id, name, addr, level_id, 0 as depth, ARRAY[name] as path
  FROM app.d_scope_location 
  WHERE parent_id IS NULL
  
  UNION ALL
  
  SELECT l.id, l.name, l.addr, l.level_id, lt.depth + 1, lt.path || l.name
  FROM app.d_scope_location l
  JOIN location_tree lt ON l.parent_id = lt.id
)
SELECT 
  REPEAT('  ', depth) || name as hierarchy,
  addr as address
FROM location_tree 
ORDER BY path;
```

### View Project Assignments with Permissions
```sql
SELECT 
  p.name as project,
  e.name as assignee,
  tr.title as task,
  mts.name as status,
  tr.due_date,
  CASE 
    WHEN rus.scope_permission IS NOT NULL THEN 'Has Permissions'
    ELSE 'No Direct Permissions'
  END as access_level
FROM app.ops_project_head p
JOIN app.ops_task_head th ON p.id = th.proj_head_id
JOIN app.ops_task_records tr ON th.id = tr.head_id
JOIN app.d_emp e ON th.assignee = e.id
JOIN app.meta_task_status mts ON tr.status_id = mts.id
LEFT JOIN app.rel_user_scope rus ON rus.emp_id = e.id 
  AND rus.scope_type = 'project' 
  AND rus.scope_id = p.id
  AND rus.active = true
WHERE tr.active = true
ORDER BY tr.due_date;
```

## Performance Indexes

### Permission System Indexes
```sql
-- rel_user_scope performance
CREATE INDEX idx_rel_user_scope_emp ON app.rel_user_scope(emp_id);
CREATE INDEX idx_rel_user_scope_scope ON app.rel_user_scope(scope_type, scope_name);
CREATE INDEX idx_rel_user_scope_type ON app.rel_user_scope(scope_type);
CREATE INDEX idx_rel_user_scope_active ON app.rel_user_scope(active) WHERE active = true;

-- rel_role_scope performance  
CREATE INDEX idx_rel_role_scope_role ON app.rel_role_scope(role_id);
CREATE INDEX idx_rel_role_scope_scope ON app.rel_role_scope(scope_type, scope_name);
```

### Hierarchy Indexes
```sql
-- Scope hierarchy traversal
CREATE INDEX idx_d_scope_location_parent ON app.d_scope_location(parent_id);
CREATE INDEX idx_d_scope_business_parent ON app.d_scope_business(parent_id);
CREATE INDEX idx_d_scope_hr_parent ON app.d_scope_hr(parent_id);

-- Active record filtering
CREATE INDEX idx_d_scope_location_active ON app.d_scope_location(active) WHERE active = true;
CREATE INDEX idx_d_scope_business_active ON app.d_scope_business(active) WHERE active = true;
```

## Maintenance

### Backup
```bash
./manage.sh backup
# Creates timestamped backup in backups/ directory
```

### Health Check
```bash
./manage.sh health
# Verifies container, database connectivity, schema existence, and table count
```

### Verification Commands
```sql
-- Check table count (should be 35)
SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'app';

-- Verify permission data integrity
SELECT COUNT(*) as user_permissions FROM app.rel_user_scope;
SELECT COUNT(*) as role_permissions FROM app.rel_role_scope;
SELECT COUNT(*) as employees FROM app.d_emp;

-- Check hierarchy integrity
SELECT COUNT(*) as locations_with_parents 
FROM app.d_scope_location 
WHERE parent_id IS NOT NULL;

SELECT COUNT(*) as business_with_parents 
FROM app.d_scope_business 
WHERE parent_id IS NOT NULL;
```

## Development

### Adding New Users with Permissions
```sql
-- 1. Create employee
INSERT INTO app.d_emp (name, email) VALUES ('New User', 'new@company.com');

-- 2. Grant permissions
INSERT INTO app.rel_user_scope (emp_id, scope_type, scope_id, scope_name, scope_permission) 
VALUES (
  (SELECT id FROM app.d_emp WHERE name = 'New User'),
  'business',
  (SELECT id FROM app.d_scope_business WHERE name = 'Engineering Division'),
  'Engineering Division Scope',
  ARRAY[0,1]::smallint[] -- VIEW and MODIFY permissions
);
```

### Extending Scope Types
1. Add new scope type to permission queries in API
2. Create corresponding scope tables if needed
3. Update indexes for new scope type
4. Add sample permission data

### Schema Changes
- Always maintain dependency order when adding tables
- Update performance indexes for new query patterns
- Test permission inheritance for new scope types
- Verify API integration after schema changes

## Troubleshooting

### Common Issues
1. **Permission denied errors**: Check `rel_user_scope` for proper permissions
2. **Hierarchical query failures**: Verify `parent_id` relationships are correct
3. **Foreign key violations**: Ensure proper dependency order
4. **Performance issues**: Check if indexes are being used in query plans

### Debugging Queries
```sql
-- Find users without any permissions
SELECT e.name 
FROM app.d_emp e 
LEFT JOIN app.rel_user_scope rus ON e.id = rus.emp_id AND rus.active = true
WHERE rus.id IS NULL;

-- Check broken hierarchy relationships
SELECT name, parent_id 
FROM app.d_scope_business 
WHERE parent_id IS NOT NULL 
  AND parent_id NOT IN (SELECT id FROM app.d_scope_business);

-- Verify index usage
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM app.rel_user_scope 
WHERE emp_id = $1 AND scope_type = $2 AND active = true;
```

## API Module Integration

The database fully supports the finegrained API module architecture:

- **`/api/v1/scope/location`** - Direct queries against `d_scope_location` with hierarchy support
- **`/api/v1/scope/business`** - Business unit management with parent-child relationships
- **`/api/v1/emp`** - Employee management with scope permission lookups
- **`/api/v1/role`** - Role management with permission template support
- **`/api/v1/project`** - Project operations with cross-scope validation

The RBAC system is fully operational and ready to support finegrained API routes with optimal performance! 🎯