# Identity & Access Control Domain

> **Purpose**: Foundation for RBAC permissions, entity metadata, polymorphic relationships, and domain mapping. Powers unified entity system with row-level security and flexible parent-child hierarchies.

## Domain Overview

The Identity & Access Control Domain is the platform's foundational infrastructure providing entity type definitions, instance registries, polymorphic parent-child relationships, and granular row-level RBAC permissions. It enables the zero-config entity system, supports flexible cross-entity relationships without foreign keys, and enforces security through a permissions array model.

### Business Value

- **Row-Level RBAC** with granular permissions [view, edit, share, delete, create, owner]
- **Type-Level + Instance-Level** permissions for flexible access control
- **Zero Foreign Keys** architecture for flexible entity relationships
- **Polymorphic Parent-Child** linking across all entity types
- **Entity Metadata** single source of truth for UI icons, labels, and child entities
- **Domain Mapping** for logical grouping and navigation
- **Permission Delegation** with temporal expiration and audit trails

## Entities

| Entity | DDL File | Table | Purpose |
|--------|----------|-------|---------|
| **Entity** | XLV_d_entity.ddl | `d_entity` | Entity TYPE definitions with UI metadata (icons, labels, child entities, domain mapping) |
| **Entity Map** | XLIV_d_entity_map.ddl | `d_entity_map` | DEPRECATED: Legacy entity mapping (superseded by d_entity) |
| **Entity ID Map** | XLVIII_d_entity_instance_link.ddl | `d_entity_instance_link` | Polymorphic parent-child INSTANCE relationships (no foreign keys) |
| **Entity Instance ID** | XLVI_d_entity_instance_registry.ddl | `d_entity_instance_registry` | Central registry of all entity instances for search, validation, and stats |
| **Entity Instance Backfill** | XLVII_d_entity_instance_backfill.ddl | `d_entity_instance_backfill` | Historical data migration and backfill tracking |
| **Entity ID RBAC Map** | XLIX_d_d_entity_rbac.ddl | `d_entity_rbac` | Row-level permissions mapping employees to entity instances |

## Entity Relationships

```
┌────────────────────────────────────────────────────────────────────────┐
│           IDENTITY & ACCESS CONTROL DOMAIN                            │
│               (Platform Infrastructure)                                │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌───────────────────────┐                                            │
│  │    d_entity (TYPE)    │ (Entity TYPE Metadata)                     │
│  │                       │                                             │
│  │ • code: 'project'     │                                             │
│  │ • name: 'Project'     │                                             │
│  │ • ui_label: 'Projects'│                                             │
│  │ • ui_icon: 'Folder'   │                                             │
│  │ • child_entities JSONB│                                             │
│  │ • domain_id, domain_code, domain_name                              │
│  │                       │                                             │
│  │ Powers:               │                                             │
│  │ • Navigation menus    │                                             │
│  │ • Dynamic child tabs  │                                             │
│  │ • Entity pickers      │                                             │
│  │ • Domain filtering    │                                             │
│  └───────────────────────┘                                             │
│           │                                                            │
│           │ defines types for                                          │
│           ▼                                                            │
│  ┌───────────────────────┐                                            │
│  │ d_entity_instance_registry  │ (Entity INSTANCE Registry)                 │
│  │                       │                                             │
│  │ • entity_code: 'project'                                           │
│  │ • entity_id: uuid                                                  │
│  │ • entity_name: 'HVAC Installation'                                 │
│  │ • entity_code: 'PROJ-2025-001'                                     │
│  │ • active_flag: true   │                                             │
│  │                       │                                             │
│  │ Powers:               │                                             │
│  │ • Global search       │                                             │
│  │ • Entity validation   │                                             │
│  │ • Dashboard stats     │                                             │
│  │ • Cross-entity lookup │                                             │
│  └───────────────────────┘                                             │
│           │                                                            │
│           │ instances linked by                                        │
│           ▼                                                            │
│  ┌───────────────────────┐                                            │
│  │  d_entity_instance_link      │ (Parent-Child INSTANCE Relationships)      │
│  │                       │                                             │
│  │ • parent_entity_code: 'project'                                    │
│  │ • parent_entity_id: uuid                                           │
│  │ • child_entity_code: 'task'                                        │
│  │ • child_entity_id: uuid                                            │
│  │ • relationship_type: 'contains'                                    │
│  │                       │                                             │
│  │ Enables:              │                                             │
│  │ • NO foreign keys     │                                             │
│  │ • Flexible hierarchies│                                             │
│  │ • Soft delete safety  │                                             │
│  │ • Dynamic child tabs  │                                             │
│  │ • Cross-entity queries│                                             │
│  └───────────────────────┘                                             │
│           │                                                            │
│           │ secured by                                                 │
│           ▼                                                            │
│  ┌───────────────────────┐                                            │
│  │ d_entity_rbac    │ (Row-Level Permissions)                    │
│  │                       │                                             │
│  │ • empid: uuid         │                                             │
│  │ • entity: 'project'   │                                             │
│  │ • entity_id: uuid OR 'all'                                         │
│  │ • permission: [0,1,2,3,4,5]                                        │
│  │                       │                                             │
│  │ Permission Array:     │                                             │
│  │ [0] = View            │                                             │
│  │ [1] = Edit            │                                             │
│  │ [2] = Share           │                                             │
│  │ [3] = Delete          │                                             │
│  │ [4] = Create          │                                             │
│  │ [5] = Owner           │                                             │
│  │                       │                                             │
│  │ Patterns:             │                                             │
│  │ • Type-level: entity_id='all'                                      │
│  │ • Instance-level: entity_id={uuid}                                 │
│  │ • Temporal expiration │                                             │
│  │ • Delegation tracking │                                             │
│  └───────────────────────┘                                             │
│           │                                                            │
│           │ grants access to                                           │
│           ▼                                                            │
│  ┌───────────────────────┐                                            │
│  │    Employee           │                                             │
│  │  (d_employee)         │                                             │
│  │                       │                                             │
│  │ from Customer 360     │                                             │
│  │ Domain                │                                             │
│  │                       │                                             │
│  │ JWT token contains:   │                                             │
│  │ • sub: employee_id    │                                             │
│  │ • role: role_id       │                                             │
│  │                       │                                             │
│  │ Every API call checks:│                                             │
│  │ • empid from JWT      │                                             │
│  │ • entity + entity_id  │                                             │
│  │ • required permission │                                             │
│  └───────────────────────┘                                             │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                  Authorization Flow                            │   │
│  │                                                                 │   │
│  │  1. User requests: PUT /api/v1/project/123                     │   │
│  │  2. Middleware extracts empid from JWT                         │   │
│  │  3. Query d_entity_rbac:                                  │   │
│  │     WHERE empid = {JWT.sub}                                    │   │
│  │       AND entity = 'project'                                   │   │
│  │       AND (entity_id = 'all' OR entity_id = '123')             │   │
│  │       AND 1 = ANY(permission)  -- Edit permission              │   │
│  │  4. Allow if permission exists, else deny (403)                │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Relationship Rules

1. **d_entity → d_entity_instance_registry**: One-to-many
   - Entity TYPE defines metadata (once per type: 'project', 'task')
   - Entity instances registered for each created entity
   - Type code matches instance entity_code field

2. **d_entity_instance_registry → d_entity_instance_link**: One-to-many (both as parent and child)
   - Each instance can be parent to many children
   - Each instance can be child to many parents
   - Enables flexible many-to-many hierarchies

3. **Employee → d_entity_rbac**: One-to-many
   - Each employee has multiple permission grants
   - Permissions can be type-level ('all') or instance-level (UUID)
   - Temporal expiration supported (expires_ts)

4. **d_entity_rbac → Entity Instances**: Many-to-one
   - Permissions grant access to entity instances
   - 'all' grants access to all instances of that type
   - Specific UUID grants access to single instance

5. **d_entity (child_entities) → Navigation**: Powers dynamic UI
   - Child entities JSONB defines which children to show in tabs
   - UI icons and labels pulled from d_entity
   - Order determines tab sequence

## Business Semantics

### Permission Array Model

The platform uses a **6-element permission array** for granular access control:

```
permission: [0, 1, 2, 3, 4, 5]
             │  │  │  │  │  └─ [5] Owner: Full control including permission management
             │  │  │  │  └──── [4] Create: Create new entities of this type
             │  │  │  └─────── [3] Delete: Soft delete entities
             │  │  └────────── [2] Share: Share entities with other users
             │  └───────────── [1] Edit: Modify existing entity data
             └──────────────── [0] View: Read-only access
```

**Permission Levels**:

| Level | Permissions | Array | Use Case |
|-------|-------------|-------|----------|
| **Owner** | All | `[0,1,2,3,4,5]` | Entity creator, project manager |
| **Editor** | View, Edit, Share, Create | `[0,1,2,4]` | Team member with edit access |
| **Contributor** | View, Edit, Create | `[0,1,4]` | Standard employee |
| **Viewer** | View only | `[0]` | Read-only access, external stakeholders |
| **None** | No access | `[]` | No permissions |

**Examples**:

```sql
-- Grant James Miller full access to ALL projects
INSERT INTO d_entity_rbac (empid, entity, entity_id, permission)
VALUES ('james-uuid', 'project', 'all', ARRAY[0,1,2,3,4,5]);

-- Grant John Doe view/edit access to SPECIFIC project
INSERT INTO d_entity_rbac (empid, entity, entity_id, permission)
VALUES ('john-uuid', 'project', 'proj-123-uuid', ARRAY[0,1]);

-- Grant Sarah Admin view-only access to ALL customers
INSERT INTO d_entity_rbac (empid, entity, entity_id, permission)
VALUES ('sarah-uuid', 'cust', 'all', ARRAY[0]);
```

### Type-Level vs Instance-Level Permissions

**Type-Level Permissions** (`entity_id = 'all'`):
- Grants access to ALL instances of entity type
- Required for **Create** permission [4]
- Typically granted to managers, admins
- Example: "Can create and view all tasks"

```sql
INSERT INTO d_entity_rbac (empid, entity, entity_id, permission)
VALUES ('manager-uuid', 'task', 'all', ARRAY[0,1,4]);
-- Manager can view [0], edit [1], and create [4] ALL tasks
```

**Instance-Level Permissions** (`entity_id = {uuid}`):
- Grants access to SPECIFIC entity instance
- Used for task assignment, project ownership
- More granular than type-level
- Example: "Can edit this specific task"

```sql
INSERT INTO d_entity_rbac (empid, entity, entity_id, permission)
VALUES ('employee-uuid', 'task', 'task-uuid-123', ARRAY[0,1]);
-- Employee can view [0] and edit [1] ONLY this task
```

**Combining Both**:
- Employee can have BOTH type-level and instance-level permissions
- Instance-level permissions are additive
- Query uses `OR` logic: `entity_id = 'all' OR entity_id = {specific_uuid}`

### Permission Delegation and Expiration

**Delegation** (`granted_by_empid`):
- Track who granted permission
- Enables audit trail
- Supports revocation by delegator

**Temporal Expiration** (`expires_ts`):
- Permissions can have expiration timestamp
- Useful for temporary access (contractors, consultants)
- System auto-revokes on expiration

**Example**:
```sql
-- Grant contractor temporary access for 30 days
INSERT INTO d_entity_rbac (
    empid, entity, entity_id, permission,
    granted_by_empid, expires_ts
)
VALUES (
    'contractor-uuid',
    'project',
    'proj-456-uuid',
    ARRAY[0,1],
    'manager-uuid',
    now() + INTERVAL '30 days'
);
```

### Entity Type Metadata (d_entity)

Each entity type has rich metadata in `d_entity`:

```sql
{
  "code": "project",
  "name": "Project",
  "ui_label": "Projects",
  "ui_icon": "FolderOpen",
  "child_entities": [
    {"entity": "task", "ui_icon": "CheckSquare", "ui_label": "Tasks", "order": 1},
    {"entity": "wiki", "ui_icon": "BookOpen", "ui_label": "Wiki", "order": 2},
    {"entity": "artifact", "ui_icon": "FileText", "ui_label": "Artifacts", "order": 3},
    {"entity": "expense", "ui_icon": "Receipt", "ui_label": "Expenses", "order": 4},
    {"entity": "revenue", "ui_icon": "TrendingUp", "ui_label": "Revenue", "order": 5}
  ],
  "domain_id": 2,
  "domain_code": "operations",
  "domain_name": "Operations"
}
```

**Uses**:
- **Navigation**: Generate sidebar menu items
- **Child Tabs**: Render dynamic child entity tabs on detail pages
- **Entity Pickers**: Show icon + label in dropdowns
- **Domain Filtering**: Filter entities by domain

### Polymorphic Parent-Child Relationships

`d_entity_instance_link` enables flexible parent-child relationships WITHOUT foreign keys:

**Relationship Types** (`relationship_type`):
- **contains**: Parent contains child (Project → Task)
- **owns**: Parent owns child (Business → Project)
- **assigned_to**: Child assigned to parent (Task → Employee)
- **hosts**: Parent hosts child (Office → Business)
- **documents**: Child documents parent (Wiki → Project)

**Benefits of NO Foreign Keys**:
1. **Soft Delete Safety**: Deleting parent preserves children
2. **Cross-Schema Linking**: Link entities across different schemas
3. **Temporal Versioning**: Track relationship history with from_ts/to_ts
4. **Performance**: No FK validation overhead on inserts
5. **Flexibility**: Change relationships without schema migrations

**Valid Parent-Child Patterns**:
```
Business → Project
Project → Task, Wiki, Artifact, Form, Expense, Revenue
Office → Task, Artifact, Wiki, Form, Expense, Revenue
Customer → Project, Artifact, Form, Expense, Revenue
Task → Form, Artifact, Employee, Expense, Revenue
Employee → Event
```

## Data Patterns

### Authorization Query Pattern

Every API call performs RBAC check:

```sql
-- Check if employee can VIEW project
SELECT EXISTS (
    SELECT 1 FROM d_entity_rbac
    WHERE empid = $jwt_employee_id
      AND entity = 'project'
      AND (entity_id = 'all' OR entity_id = $project_id)
      AND 0 = ANY(permission)  -- View [0]
      AND active_flag = true
      AND (expires_ts IS NULL OR expires_ts > now())
);

-- Check if employee can EDIT task
SELECT EXISTS (
    SELECT 1 FROM d_entity_rbac
    WHERE empid = $jwt_employee_id
      AND entity = 'task'
      AND (entity_id = 'all' OR entity_id = $task_id)
      AND 1 = ANY(permission)  -- Edit [1]
      AND active_flag = true
      AND (expires_ts IS NULL OR expires_ts > now())
);

-- Check if employee can CREATE project
SELECT EXISTS (
    SELECT 1 FROM d_entity_rbac
    WHERE empid = $jwt_employee_id
      AND entity = 'project'
      AND entity_id = 'all'  -- Create requires type-level
      AND 4 = ANY(permission)  -- Create [4]
      AND active_flag = true
      AND (expires_ts IS NULL OR expires_ts > now())
);
```

### Entity Instance Registration

When entity created, instance auto-registered:

```sql
-- Trigger on d_project INSERT
INSERT INTO d_entity_instance_registry (
    entity_code,
    entity_id,
    entity_name,
    entity_code,
    active_flag
) VALUES (
    'project',
    $new_project_id,
    $project_name,
    $project_code,
    true
);

-- Auto-grant creator OWNER permissions
INSERT INTO d_entity_rbac (
    empid,
    entity,
    entity_id,
    permission,
    granted_by_empid
) VALUES (
    $creator_empid,
    'project',
    $new_project_id,
    ARRAY[0,1,2,3,4,5],  -- Full owner permissions
    $creator_empid
);
```

### Child Entity Filtering

Filter child entities by parent:

```sql
-- Get all tasks for project
SELECT t.*
FROM d_task t
JOIN d_entity_instance_link m
  ON m.child_entity_code = 'task'
  AND m.child_entity_id = t.id::text
WHERE m.parent_entity_code = 'project'
  AND m.parent_entity_id = $project_id
  AND m.active_flag = true
  AND t.active_flag = true;

-- Count children for tab badges
SELECT
    child_entity_code,
    COUNT(*) as count
FROM d_entity_instance_link
WHERE parent_entity_code = 'project'
  AND parent_entity_id = $project_id
  AND active_flag = true
GROUP BY child_entity_code;
```

### Global Search Pattern

Search across all entity types:

```sql
-- Full-text search across entities
SELECT
    entity_code,
    entity_id,
    entity_name,
    entity_code,
    ts_rank(
        to_tsvector('english', entity_name),
        plainto_tsquery('english', $search_query)
    ) as rank
FROM d_entity_instance_registry
WHERE active_flag = true
  AND to_tsvector('english', entity_name) @@ plainto_tsquery('english', $search_query)
  AND entity_code = ANY($entity_codes)  -- Filter by type if specified
ORDER BY rank DESC
LIMIT 50;

-- Post-filter by RBAC permissions
-- (Application layer checks d_entity_rbac for each result)
```

## Use Cases

### UC-1: Grant Project Access to Team Member

**Actors**: Project Manager, Team Member, System

**Flow**:
1. PM views Project #450 detail page
2. PM clicks "Share" button
3. Share modal opens with employee picker
4. PM selects "John Doe" from employee list
5. PM selects permission level: "Editor" (View, Edit, Create)
6. PM clicks "Grant Access"
7. System creates RBAC entry:
   ```sql
   INSERT INTO d_entity_rbac (empid, entity, entity_id, permission, granted_by_empid)
   VALUES ('john-uuid', 'project', 'proj-450-uuid', ARRAY[0,1,4], 'pm-uuid');
   ```
8. John receives notification: "You have been granted access to Project #450"
9. Project #450 now appears in John's project list
10. John can view, edit, and create tasks under Project #450
11. John CANNOT delete project (missing permission [3])

**Entities Touched**: d_entity_rbac, Employee, Project

### UC-2: Create Task Under Project (Parent-Child Linking)

**Actors**: Employee, System

**Flow**:
1. Employee views Project #450 detail page
2. Employee clicks "Tasks" child tab
3. Employee clicks "+ Create Task" button
4. System checks permissions:
   - Check if employee can CREATE tasks (type-level):
     ```sql
     WHERE empid = $employee_id AND entity = 'task' AND entity_id = 'all' AND 4 = ANY(permission)
     ```
   - Check if employee can EDIT project (instance-level):
     ```sql
     WHERE empid = $employee_id AND entity = 'project' AND entity_id = 'proj-450-uuid' AND 1 = ANY(permission)
     ```
5. Both checks pass → Allow task creation
6. Employee fills task form, clicks "Save"
7. System creates Task #789
8. System registers task instance:
   ```sql
   INSERT INTO d_entity_instance_registry (entity_code, entity_id, entity_name, entity_code)
   VALUES ('task', 'task-789-uuid', 'Install AC Unit', 'TASK-2025-00789');
   ```
9. System creates parent-child link:
   ```sql
   INSERT INTO d_entity_instance_link (parent_entity_code, parent_entity_id, child_entity_code, child_entity_id, relationship_type)
   VALUES ('project', 'proj-450-uuid', 'task', 'task-789-uuid', 'contains');
   ```
10. System grants creator OWNER permissions on task:
    ```sql
    INSERT INTO d_entity_rbac (empid, entity, entity_id, permission)
    VALUES ('employee-uuid', 'task', 'task-789-uuid', ARRAY[0,1,2,3,4,5]);
    ```
11. Task appears in Project #450 Tasks tab
12. Task count badge increments: "Tasks (5)" → "Tasks (6)"

**Entities Touched**: d_entity_rbac, d_entity_instance_link, d_entity_instance_registry, Task, Project

### UC-3: Global Search Across Entities

**Actors**: User, System

**Flow**:
1. User types "HVAC" in global search bar
2. System queries `d_entity_instance_registry`:
   ```sql
   SELECT * FROM d_entity_instance_registry
   WHERE to_tsvector('english', entity_name) @@ plainto_tsquery('english', 'HVAC')
     AND active_flag = true
   ORDER BY ts_rank(...) DESC
   LIMIT 50;
   ```
3. System finds 23 results:
   - 5 Projects: "HVAC Installation - Store #12", etc.
   - 12 Tasks: "HVAC Maintenance", etc.
   - 3 Customers: "HVAC Corp Inc.", etc.
   - 2 Products: "Carrier HVAC Unit", etc.
   - 1 Wiki: "HVAC Installation Guide"
4. For each result, system checks RBAC permissions:
   ```sql
   WHERE empid = $user_id AND entity = $result_entity_code
     AND (entity_id = 'all' OR entity_id = $result_entity_id)
     AND 0 = ANY(permission)  -- View
   ```
5. System filters out results user cannot view
6. 18 results remain (5 filtered due to no permissions)
7. Results grouped by entity type:
   - Projects (5)
   - Tasks (10)
   - Customers (2)
   - Wiki (1)
8. User clicks "Project: HVAC Installation - Store #12"
9. Navigates to Project detail page

**Entities Touched**: d_entity_instance_registry, d_entity_rbac, d_entity (for icons/labels)

## Technical Architecture

### Key Tables

```sql
-- Entity TYPE metadata
CREATE TABLE app.d_entity (
    code varchar(50) NOT NULL PRIMARY KEY,          -- 'project', 'task'
    name varchar(100) NOT NULL,                     -- 'Project', 'Task'
    ui_label varchar(100) NOT NULL,                 -- 'Projects', 'Tasks'
    ui_icon varchar(50),                            -- Lucide icon
    child_entities jsonb DEFAULT '[]'::jsonb,       -- Child entity metadata
    display_order int4 NOT NULL DEFAULT 999,
    domain_id int4,
    domain_code varchar(50),
    domain_name varchar(100),
    column_metadata jsonb DEFAULT '[]'::jsonb,
    active_flag boolean DEFAULT true
);

-- Entity INSTANCE registry
CREATE TABLE app.d_entity_instance_registry (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_code varchar(50) NOT NULL,               -- 'project', 'task'
    entity_id uuid NOT NULL,                        -- UUID from source table
    entity_name varchar(255),
    entity_code varchar(100),
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    UNIQUE(entity_code, entity_id)
);

-- Parent-child INSTANCE relationships
CREATE TABLE app.d_entity_instance_link (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_entity_code varchar(20) NOT NULL,
    parent_entity_id text NOT NULL,
    child_entity_code varchar(20) NOT NULL,
    child_entity_id text NOT NULL,
    relationship_type varchar(50) DEFAULT 'contains',
    from_ts timestamptz NOT NULL DEFAULT now(),
    to_ts timestamptz,
    active_flag boolean NOT NULL DEFAULT true
);

-- Row-level RBAC permissions
CREATE TABLE app.d_entity_rbac (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empid uuid NOT NULL,                            -- Employee UUID
    entity varchar(50) NOT NULL,                    -- Entity type
    entity_id text NOT NULL,                        -- 'all' or specific UUID
    permission integer[] NOT NULL DEFAULT '{}',     -- [0,1,2,3,4,5]
    granted_by_empid uuid,
    granted_ts timestamptz NOT NULL DEFAULT now(),
    expires_ts timestamptz,
    active_flag boolean NOT NULL DEFAULT true
);
```

### API Endpoints

```
# Entity Metadata
GET    /api/v1/entity/codes             # List all entity types
GET    /api/v1/entity/codes/:code       # Get entity type metadata

# Entity Instances
GET    /api/v1/entity/instances         # List entity instances
GET    /api/v1/entity/instances/:id     # Get entity instance
GET    /api/v1/entity/stats             # Entity counts by type

# Entity Relationships
GET    /api/v1/entity/:type/:id/children/:child_type  # Get children
POST   /api/v1/entity/link              # Create parent-child link
DELETE /api/v1/entity/link/:id          # Remove link

# RBAC Permissions
GET    /api/v1/rbac/permissions         # List user's permissions
POST   /api/v1/rbac/grant               # Grant permission
DELETE /api/v1/rbac/revoke/:id          # Revoke permission
GET    /api/v1/rbac/check               # Check if user has permission

# Global Search
GET    /api/v1/search                   # Search across entities
```

## Integration Points

### Upstream Dependencies

- **Customer 360 Domain**: Employee (identity, permissions)

### Downstream Dependencies

- **All Domains**: All entities use RBAC, entity metadata, and polymorphic relationships

## Data Volume & Performance

### Expected Data Volumes

- Entity Types (d_entity): 30 - 50 types
- Entity Instances (d_entity_instance_registry): 100,000 - 1,000,000 instances
- Entity Relationships (d_entity_instance_link): 500,000 - 5,000,000 links
- RBAC Permissions (d_entity_rbac): 50,000 - 500,000 grants

### Indexing Strategy

```sql
-- Entity instance indexes
CREATE INDEX idx_entity_instance_type ON app.d_entity_instance_registry(entity_code);
CREATE INDEX idx_entity_instance_name ON app.d_entity_instance_registry USING GIN(to_tsvector('english', entity_name));
CREATE UNIQUE INDEX idx_entity_instance_unique ON app.d_entity_instance_registry(entity_code, entity_id);

-- Entity map indexes
CREATE INDEX idx_entity_map_parent ON app.d_entity_instance_link(parent_entity_code, parent_entity_id);
CREATE INDEX idx_entity_map_child ON app.d_entity_instance_link(child_entity_code, child_entity_id);

-- RBAC indexes
CREATE INDEX idx_rbac_empid ON app.d_entity_rbac(empid);
CREATE INDEX idx_rbac_entity ON app.d_entity_rbac(entity, entity_id);
CREATE INDEX idx_rbac_permission ON app.d_entity_rbac USING GIN(permission);
```

## Future Enhancements

1. **Role-Based Permissions**: Pre-defined permission templates by role
2. **Permission Groups**: Group permissions for team-based access
3. **Advanced Delegation**: Multi-level delegation chains
4. **Permission Analytics**: Track permission usage and audit logs
5. **Conditional Permissions**: Rule-based permissions (if/then)
6. **Dynamic RBAC**: Permissions based on entity attributes
7. **Permission Requests**: Self-service permission request workflow
8. **External Identity**: SSO integration with Azure AD, Okta
9. **API Key Management**: Service account permissions for API access
10. **Compliance Reporting**: SOC2, GDPR permission audit reports

---

**Domain Owner**: Platform Engineering & Security Teams
**Last Updated**: 2025-11-13
**Related Domains**: All domains depend on Identity & Access Control
