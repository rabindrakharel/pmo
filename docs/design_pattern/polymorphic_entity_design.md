# Polymorphic Entity Design Pattern

> A loosely-coupled, foreign-key-free architecture for flexible entity relationships with hierarchical RBAC

## Executive Summary

The PMO platform uses a **polymorphic entity design** where all business entities (Projects, Tasks, Customers, Orders, etc.) are loosely coupled through a central linkage system rather than traditional foreign keys. This enables:

- **Flexible hierarchies**: Any entity can be a parent or child of any other
- **No cascade delete surprises**: Deleting a parent doesn't cascade to children
- **Dynamic UI generation**: Tabs, navigation, and forms are config-driven
- **Unified RBAC**: One permission system governs all 27+ entity types

---

## Part 1: The Four Infrastructure Tables

The entire entity system is powered by **4 infrastructure tables** that work together:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ENTITY INFRASTRUCTURE (4 Tables)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐         ┌─────────────────────┐                       │
│  │  app.entity     │         │  app.entity_instance │                       │
│  │  (TYPE metadata)│         │  (INSTANCE registry) │                       │
│  │                 │         │                      │                       │
│  │  • code (PK)    │         │  • entity_code       │                       │
│  │  • ui_label     │         │  • entity_instance_id│                       │
│  │  • ui_icon      │         │  • entity_name       │                       │
│  │  • child_entity │         │  • code              │                       │
│  │    _codes[]     │         │                      │                       │
│  │  • root_level   │         │                      │                       │
│  │    _entity_flag │         │                      │                       │
│  └────────┬────────┘         └──────────┬───────────┘                       │
│           │                             │                                   │
│           │ "What types exist?"         │ "What instances exist?"           │
│           │                             │                                   │
│  ┌────────┴─────────────────────────────┴───────────┐                       │
│  │              app.entity_instance_link            │                       │
│  │              (RELATIONSHIPS)                     │                       │
│  │                                                  │                       │
│  │  • entity_code + entity_instance_id (parent)    │                       │
│  │  • child_entity_code + child_entity_instance_id │                       │
│  │  • relationship_type                            │                       │
│  └──────────────────────┬───────────────────────────┘                       │
│                         │                                                   │
│                         │ "Who is linked to whom?"                          │
│                         │                                                   │
│  ┌──────────────────────┴───────────────────────────┐                       │
│  │              app.entity_rbac                     │                       │
│  │              (PERMISSIONS)                       │                       │
│  │                                                  │                       │
│  │  • role_id (who)                                │                       │
│  │  • entity_code + entity_instance_id (what)      │                       │
│  │  • permission (0-7)                             │                       │
│  │  • inheritance_mode (none/cascade/mapped)       │                       │
│  └──────────────────────────────────────────────────┘                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 `app.entity` — Type Metadata

**Purpose**: Defines what entity TYPES exist in the system.

| Column | Description |
|--------|-------------|
| `code` | Primary key, e.g., `'project'`, `'task'`, `'customer'` |
| `ui_label` | Display name for UI, e.g., `'Projects'` |
| `ui_icon` | Lucide icon name, e.g., `'FolderOpen'` |
| `db_table` | Physical table name, e.g., `'project'` |
| `child_entity_codes` | JSONB array of valid child types with `ownership_flag` |
| `root_level_entity_flag` | Boolean indicating if this is a root-level entity for traversal |

**Key Insight**: This table answers "What kinds of things can exist?" not "What things exist?"

#### Root-Level Entities

The `root_level_entity_flag` identifies entities that serve as **traversal roots** for permission inheritance. When the RBAC system walks up the ancestor chain, it stops at root-level entities.

**Root-Level Entities** (`root_level_entity_flag = true`):
- `business` — Top of organizational hierarchy
- `project` — Primary work container
- `customer` — Independent entity with its own permission scope

**Non-Root Entities** (`root_level_entity_flag = false`):
- `task` — Belongs to project, not a permission root
- `order` — Belongs to task/customer, not a permission root
- `wiki`, `artifact`, `form` — Supporting entities

```
Permission Traversal (walks UP to root, then stops):

        Business (ROOT)
            │
            ▼
        Project (ROOT) ← STOP here (root reached)
            │
            ▼
          Task
            │
            ▼
         Order  ← Start here, walk UP

Checking permission on Order:
  Order → Task → Project (ROOT) ← STOP, check permissions here

Alternative path:
        Customer (ROOT) ← STOP (Customer is also a root)
            │
            ▼
         Order  ← Start here, walk UP
```

**Why This Matters**: Prevents infinite traversal and defines clear permission boundaries. A customer's orders don't inherit permissions from unrelated projects just because both share a common ancestor.

### 1.2 `app.entity_instance` — Instance Registry

**Purpose**: Central registry of all entity INSTANCES across the system.

| Column | Description |
|--------|-------------|
| `entity_code` | Type of entity, e.g., `'project'` |
| `entity_instance_id` | UUID of the specific instance |
| `entity_instance_name` | Cached display name |
| `code` | Business code, e.g., `'PROJ-001'` |

**Key Insight**: This table answers "What specific things exist?" It's a denormalized cache for fast lookups across all entity types.

**Delete Semantics**: HARD DELETE. When a project is deleted, its registry entry is physically removed.

### 1.3 `app.entity_instance_link` — Relationships

**Purpose**: Maps parent-child relationships between entity INSTANCES.

| Column | Description |
|--------|-------------|
| `entity_code` | Parent entity type |
| `entity_instance_id` | Parent instance UUID |
| `child_entity_code` | Child entity type |
| `child_entity_instance_id` | Child instance UUID |
| `ownership_flag` | Denormalized from `entity.child_entity_codes` — determines traversal behavior |

#### `ownership_flag` Semantics

The `ownership_flag` is copied from the parent entity's `child_entity_codes` configuration at link creation time. This denormalization enables fast permission traversal without joining to the entity table.

| `ownership_flag` | Meaning | Traversal Behavior |
|------------------|---------|-------------------|
| `true` | Parent OWNS child | Permission traversal continues through this link |
| `false` | Parent REFERENCES child (lookup only) | Permission traversal STOPS here — no deeper access |

```
Example: Project → Task (ownership_flag: true)
  └─→ Traversal ALLOWED: Task permissions can cascade to Task's children

Example: Task → Customer (ownership_flag: false)
  └─→ Traversal BLOCKED: Customer is lookup only, no access to Customer's children
```

**Key Insight**: NO FOREIGN KEYS. This is intentional:
- Deleting a parent doesn't cascade to children
- Children can exist independently after unlinking
- Any entity can link to any other entity
- `ownership_flag` controls permission inheritance depth

**Delete Semantics**: HARD DELETE. Unlinking removes the relationship record; the child entity remains.

### 1.4 `app.entity_rbac` — Permissions

**Purpose**: Role-based access control for all entities.

| Column | Description |
|--------|-------------|
| `role_id` | The role receiving permission |
| `entity_code` | Target entity type |
| `entity_instance_id` | Target instance (or `ALL_ENTITIES_ID`) |
| `permission` | Level 0-7 (VIEW → OWNER) |
| `inheritance_mode` | `'none'`, `'cascade'`, `'mapped'` |
| `child_permissions` | JSONB for mapped mode |

**Key Insight**: Permissions are granted to ROLES, not directly to users. Users get permissions through role membership.

---

## Part 2: Why No Foreign Keys?

Traditional database design would use foreign keys:

```sql
-- Traditional approach (NOT USED)
CREATE TABLE task (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES project(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customer(id) ON DELETE SET NULL
);
```

**Problems with this approach:**

1. **Rigid hierarchies**: A task can only belong to ONE project
2. **Cascade chaos**: Deleting a project deletes all its tasks
3. **Cross-entity complexity**: Linking task → customer requires schema changes
4. **Permission overhead**: Each relationship needs separate RBAC logic

**Our approach — Polymorphic Links:**

```sql
-- Our approach: entity_instance_link
INSERT INTO entity_instance_link
  (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id)
VALUES
  ('project', 'proj-uuid', 'task', 'task-uuid'),      -- Project owns Task
  ('customer', 'cust-uuid', 'task', 'task-uuid'),     -- Customer also linked to Task
  ('task', 'task-uuid', 'order', 'order-uuid');       -- Task owns Order
```

**Benefits:**

1. **Flexible hierarchies**: A task can be linked to multiple parents
2. **Safe deletes**: Unlinking ≠ deleting; children survive
3. **Zero schema changes**: New relationships are just INSERT statements
4. **Unified RBAC**: One permission check works for all entity types

---

## Part 3: Owned vs Lookup Children (Ownership Flag)

Not all parent-child relationships are equal. We distinguish between:

### 3.1 Owned Children (`ownership_flag: true`)

**Definition**: The parent OWNS the child. The child's lifecycle is tied to the parent.

**Examples**:
- Project → Task (tasks belong to projects)
- Order → Invoice (invoices belong to orders)
- Form → FormData (submissions belong to forms)

**Characteristics**:
- Child typically doesn't make sense without parent
- Permissions CASCADE from parent to child
- Deleting parent may cascade to children (business decision)

### 3.2 Lookup Children (`ownership_flag: false`)

**Definition**: The parent REFERENCES the child. The child exists independently.

**Examples**:
- Task → Customer (task references a customer, but customer exists independently)
- Project → Employee (project has team members, but employees exist independently)
- Order → Product (order contains products, but products exist independently)

**Characteristics**:
- Child exists in its own right, independent of parent
- Permissions do NOT fully cascade (limited COMMENT access only)
- Deleting parent NEVER affects child
- Lookup children are a "dead end" — permissions stop here, never cascade further

### 3.3 Schema Representation

The `ownership_flag` in `child_entity_codes` distinguishes these:

```json
// app.entity.child_entity_codes for 'task' entity
[
  {"entity": "order", "ui_label": "Orders", "ui_icon": "ShoppingCart", "order": 1, "ownership_flag": true},
  {"entity": "customer", "ui_label": "Customers", "ui_icon": "Users", "order": 2, "ownership_flag": false}
]
```

**Default**: If `ownership_flag` is not specified, it defaults to `true` for backwards compatibility.

---

## Part 4: RBAC Mechanism (Role-Based Access Control)

### 4.1 Permission Levels

```
┌─────────────────────────────────────────────────────────────────┐
│  Level │ Name       │ Capabilities                             │
├────────┼────────────┼──────────────────────────────────────────┤
│   0    │ VIEW       │ Read-only access                         │
│   1    │ COMMENT    │ Add comments (implies VIEW)              │
│   2    │ CONTRIBUTE │ Submit data, fill forms (implies COMMENT)│
│   3    │ EDIT       │ Modify entity (implies CONTRIBUTE)       │
│   4    │ SHARE      │ Share with others (implies EDIT)         │
│   5    │ DELETE     │ Soft delete (implies SHARE)              │
│   6    │ CREATE     │ Create new instances (implies DELETE)    │
│   7    │ OWNER      │ Full control (implies CREATE)            │
└─────────────────────────────────────────────────────────────────┘

Hierarchy: permission >= required_level → ALLOWED
Example: User with EDIT (3) can VIEW (0), COMMENT (1), CONTRIBUTE (2)
```

### 4.2 Role-Only Model

Permissions are NEVER granted directly to users. Instead:

```
┌──────────────┐      ┌──────────────────────┐      ┌─────────────┐
│   Person     │ ──── │ entity_instance_link │ ──── │    Role     │
│  (James)     │      │  (role membership)   │      │ (PM Role)   │
└──────────────┘      └──────────────────────┘      └──────┬──────┘
                                                          │
                                                          │ has
                                                          ▼
                                                   ┌──────────────┐
                                                   │ entity_rbac  │
                                                   │ (permissions)│
                                                   └──────────────┘
```

**Flow**: Person → Role (via link) → Permissions (via entity_rbac)

### 4.3 Instance-Level Role Naming Convention

For entities that need granular access control, we create **instance-level roles** following a naming convention:

```
{entity_code}_{instance_name_alias}_{access_level}
```

#### Standard Role Tiers

| Role Suffix | Permission Level | Use Case | Applicable Entities |
|-------------|------------------|----------|---------------------|
| `_external` | COMMENT (1) | External stakeholders, view + comment only | All |
| `_crew` | CONTRIBUTE (2) | Team members who submit data, fill forms | All |
| `_lead` | EDIT (3) | Team leads who can modify the entity | All |
| `_accounts` | EDIT (3) + financial access | Finance/accounting staff, access to revenue & expense | `business`, `project` only |
| `_owner` | OWNER (7) | Full control, can delete and manage access | All |

**Note on `_accounts` role**: This role has EDIT (3) level on the parent entity but with **mapped inheritance** that grants higher access specifically to `revenue` and `expense` child entities. The accounts role cannot delete the business/project itself, but can fully manage financial records.

#### Examples

```
Business: "Huron Home Services" (alias: huron_home)
├── business_huron_home_external   → COMMENT (1)
├── business_huron_home_crew       → CONTRIBUTE (2)
├── business_huron_home_lead       → EDIT (3)
├── business_huron_home_accounts   → EDIT (3) + mapped{revenue: 7, expense: 7}  ← Finance team
└── business_huron_home_owner      → OWNER (7)

Project: "Kitchen Renovation" (alias: kitchen_reno)
├── project_kitchen_reno_external  → COMMENT (1)
├── project_kitchen_reno_crew      → CONTRIBUTE (2)
├── project_kitchen_reno_lead      → EDIT (3)
├── project_kitchen_reno_accounts  → EDIT (3) + mapped{revenue: 7, expense: 7}  ← Project accountant
└── project_kitchen_reno_owner     → OWNER (7)

Task: "Install Cabinets" (alias: install_cabinets)
├── task_install_cabinets_external → COMMENT (1)
├── task_install_cabinets_crew     → CONTRIBUTE (2)
├── task_install_cabinets_lead     → EDIT (3)
└── task_install_cabinets_owner    → OWNER (7)
    (No _accounts role - tasks inherit financial access from project)
```

**`_accounts` Role RBAC Record Example**:
```json
{
  "role_id": "project_kitchen_reno_accounts",
  "entity_code": "project",
  "entity_instance_id": "kitchen-reno-uuid",
  "permission": 3,
  "inheritance_mode": "mapped",
  "child_permissions": {
    "revenue": 7,
    "expense": 7,
    "_default": 0
  }
}
```
This grants:
- EDIT (3) on the project itself
- OWNER (7) on revenue records under the project
- OWNER (7) on expense records under the project
- VIEW (0) on other child entities (tasks, wiki, etc.)

#### Which Entities Need Instance Roles?

**Entities that SHOULD have instance-level roles:**
- `business` — Organization-level access control
- `project` — Project team membership
- `task` — Task assignment and collaboration
- `customer` — Customer relationship management

**Entities that typically DON'T need instance-level roles:**
- `wiki`, `artifact` — Inherit from parent entity
- `order`, `invoice` — Transactional, inherit from parent
- `form_data` — Submissions inherit from form
- `product`, `service` — Catalog items, usually type-level access

#### Role Creation Pattern

When a new project "Alpha Launch" is created:

```sql
-- Auto-generate instance roles
INSERT INTO app.role (code, name, descr) VALUES
  ('project_alpha_launch_external', 'Alpha Launch - External', 'External stakeholder access'),
  ('project_alpha_launch_crew', 'Alpha Launch - Crew', 'Project team member'),
  ('project_alpha_launch_lead', 'Alpha Launch - Lead', 'Project lead'),
  ('project_alpha_launch_owner', 'Alpha Launch - Owner', 'Project owner');

-- Grant permissions to roles
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode)
SELECT r.id, 'project', 'alpha-launch-uuid',
  CASE r.code
    WHEN 'project_alpha_launch_external' THEN 1  -- COMMENT
    WHEN 'project_alpha_launch_crew' THEN 2      -- CONTRIBUTE
    WHEN 'project_alpha_launch_lead' THEN 3      -- EDIT
    WHEN 'project_alpha_launch_owner' THEN 7     -- OWNER
  END,
  'cascade'
FROM app.role r
WHERE r.code LIKE 'project_alpha_launch_%';
```

### 4.4 Inheritance Modes

When a role has permission on a parent entity, how do children inherit?

#### Mode: `none`

Permission applies ONLY to the target entity. Children get nothing.

```
Project A [EDIT, mode: none]
├── Task 1 → NO permission (must be granted separately)
└── Wiki 1 → NO permission (must be granted separately)
```

#### Mode: `cascade` (with Ownership Flag distinction)

Permission flows to children, but differently based on ownership:

```
Project A [EDIT (3), mode: cascade]
│
├── 📋 Task (ownership_flag: true)
│   └─→ Gets: EDIT (3) ✓ [same as parent, cascades further]
│   │
│   └── 📦 Order (ownership_flag: true by Task)
│       └─→ Gets: EDIT (3) ✓ [cascades from Task]
│
└── 👤 Customer (ownership_flag: false)
    └─→ Gets: COMMENT (1) ✓ [lookup access only, STOPS HERE]
    │
    └── 📦 Order (ownership_flag: true by Customer)
        └─→ Gets: NOTHING ✗ [blocked - parent was lookup]
```

**Cascade Rules**:

| Parent Permission | Owned Child (`ownership_flag: true`) | Lookup Child (`ownership_flag: false`) |
|-------------------|--------------------------------------|----------------------------------------|
| VIEW (0) | No cascade | No cascade |
| COMMENT (1) | No cascade | No cascade |
| CONTRIBUTE (2)+ | **Same as parent** (continues) | **COMMENT (1)** (STOPS) |

**Key Rule**: Lookup children NEVER cascade further. They are a "dead end" for permission inheritance.

#### Mode: `mapped`

Different permission levels per child type, specified in `child_permissions` JSONB:

```json
{
  "inheritance_mode": "mapped",
  "child_permissions": {
    "task": 3,       // EDIT
    "wiki": 0,       // VIEW
    "customer": 1,   // COMMENT
    "_default": 0    // VIEW for unlisted types
  }
}
```

```
Project A [OWNER (7), mode: mapped]
├── Task → EDIT (3) from child_permissions["task"]
├── Wiki → VIEW (0) from child_permissions["wiki"]
├── Customer → COMMENT (1) from child_permissions["customer"]
└── Artifact → VIEW (0) from child_permissions["_default"]
```

### 4.5 Permission Resolution Algorithm

When checking if a person can perform an action:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  check_entity_rbac(person_id, entity_code, entity_id, required_permission)  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 1: FIND PERSON'S ROLES                                               │
│  ────────────────────────────                                              │
│  SELECT role_id FROM entity_instance_link                                  │
│  WHERE entity_code = 'role'                                                │
│    AND child_entity_code = 'person'                                        │
│    AND child_entity_instance_id = person_id                                │
│  → Returns: ['pm-role-uuid', 'employee-role-uuid']                         │
│                                                                             │
│  STEP 2: CHECK EXPLICIT DENY                                               │
│  ───────────────────────────                                               │
│  SELECT 1 FROM entity_rbac                                                 │
│  WHERE role_id IN (person_roles)                                           │
│    AND entity_code = target_entity_code                                    │
│    AND is_deny = true                                                      │
│  → If found: return DENIED (deny always wins)                              │
│                                                                             │
│  STEP 3: CHECK DIRECT PERMISSIONS                                          │
│  ─────────────────────────────────                                         │
│  SELECT MAX(permission) FROM entity_rbac                                   │
│  WHERE role_id IN (person_roles)                                           │
│    AND entity_code = target_entity_code                                    │
│    AND entity_instance_id IN (target_id, ALL_ENTITIES_ID)                  │
│  → direct_permission = result                                              │
│                                                                             │
│  STEP 4: CHECK INHERITED PERMISSIONS (via ancestor chain)                  │
│  ──────────────────────────────────────────────────────────                │
│  Traverse UP entity_instance_link to find ancestors:                       │
│    Target Entity → Parent → Grandparent → ...                              │
│    STOP when reaching a root_level_entity_flag = true entity               │
│                                                                             │
│  For each ancestor with cascade/mapped mode:                               │
│    - If owned path AND mode=cascade AND permission >= 2:                   │
│        inherited = parent_permission (continue traversing)                 │
│    - If lookup path AND mode=cascade AND permission >= 2:                  │
│        inherited = 1 (COMMENT), STOP traversing                            │
│    - If mode=mapped:                                                       │
│        inherited = child_permissions[entity_code] ?? _default              │
│                                                                             │
│  STEP 5: RETURN MAX                                                        │
│  ──────────────────                                                        │
│  effective = MAX(direct_permission, inherited_permission)                  │
│  return effective >= required_permission                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.6 Type-Level vs Instance-Level Permissions

```
┌─────────────────────────────────────────────────────────────────┐
│  entity_instance_id                    │ Meaning               │
├────────────────────────────────────────┼───────────────────────┤
│  '11111111-1111-1111-1111-111111111111'│ ALL instances (type)  │
│  'a1b2c3d4-...actual-uuid...'          │ ONE specific instance │
└─────────────────────────────────────────────────────────────────┘
```

**Type-Level** (ALL_ENTITIES_ID): "Can CREATE any project"
**Instance-Level**: "Can EDIT project-123 specifically"

The system checks both and takes the MAX permission.

---

## Part 5: Visual Examples

### 5.1 Complete Entity Hierarchy with Roles

```
Business: Huron Home Services (ROOT)
│
│  Roles: business_huron_home_external (COMMENT)
│         business_huron_home_crew (CONTRIBUTE)
│         business_huron_home_lead (EDIT)
│         business_huron_home_owner (OWNER) ← James Miller
│
├── Project: Kitchen Renovation (ROOT) [EDIT permission, cascade mode]
│   │
│   │  Roles: project_kitchen_reno_external (COMMENT)
│   │         project_kitchen_reno_crew (CONTRIBUTE)
│   │         project_kitchen_reno_lead (EDIT) ← Sarah Lead
│   │         project_kitchen_reno_owner (OWNER) ← James Miller
│   │
│   ├── 📋 Task: Install Cabinets (ownership_flag: true)
│   │   │   └─→ Permission: EDIT (3) ✓ [cascaded from Project]
│   │   │
│   │   │  Roles: task_install_cabinets_crew (CONTRIBUTE) ← Mike Worker
│   │   │
│   │   ├── 📦 Order: Cabinet Order (ownership_flag: true by Task)
│   │   │       └─→ Permission: EDIT (3) ✓ [cascaded from Task]
│   │   │
│   │   └── 👤 Customer: John Smith (ownership_flag: false by Task)
│   │           └─→ Permission: COMMENT (1) ✓ [lookup, STOPS]
│   │           │
│   │           └── 📦 Customer's Other Order
│   │                   └─→ Permission: NONE ✗ [blocked at lookup]
│   │
│   ├── 📄 Wiki: Project Specs (ownership_flag: true)
│   │       └─→ Permission: EDIT (3) ✓ [cascaded from Project]
│   │
│   └── 👤 Customer: John Smith (ownership_flag: false)
│           └─→ Permission: COMMENT (1) ✓ [lookup access only]
│
└── Customer: John Smith (ROOT) — Has own permission scope
        │
        │  Roles: customer_john_smith_external (COMMENT) ← John himself
        │         customer_john_smith_owner (OWNER) ← Account Manager
        │
        └── 📦 Order: John's Direct Order
                └─→ Permission from Customer roles, NOT from Project
```

### 5.2 Delete vs Unlink

```
┌────────────────────────────────────────────────────────────────┐
│  OPERATION  │  What Happens                                   │
├─────────────┼─────────────────────────────────────────────────┤
│  UNLINK     │  DELETE FROM entity_instance_link               │
│  (remove    │  WHERE parent = X AND child = Y                 │
│  relationship)│                                                │
│             │  Child entity REMAINS in system                 │
│             │  Requires: EDIT on PARENT                       │
├─────────────┼─────────────────────────────────────────────────┤
│  DELETE     │  DELETE FROM primary_table WHERE id = Y         │
│  (destroy   │  DELETE FROM entity_instance WHERE id = Y       │
│  entity)    │  DELETE FROM entity_instance_link (all links)   │
│             │  DELETE FROM entity_rbac WHERE entity_id = Y    │
│             │                                                 │
│             │  Child entity REMOVED from system               │
│             │  Requires: DELETE on CHILD                      │
└─────────────┴─────────────────────────────────────────────────┘
```

---

## Part 6: Benefits Summary

| Aspect | Traditional FK Design | Polymorphic Link Design |
|--------|----------------------|------------------------|
| **Flexibility** | Rigid, schema changes needed | Any entity links to any entity |
| **Cascade Deletes** | Dangerous, hard to predict | Controlled, explicit choice |
| **Multi-Parent** | Complex junction tables | Natural, just add links |
| **RBAC** | Per-entity-type logic | Unified, one system |
| **UI Generation** | Hardcoded per entity | Config-driven, dynamic |
| **Performance** | FK validation on every INSERT | No FK overhead |
| **Audit Trail** | Scattered across tables | Centralized in link table |

---

## Part 7: Implementation Reference

### Key Files

| File | Purpose |
|------|---------|
| `db/entity_configuration_settings/02_entity.ddl` | Entity type definitions |
| `db/entity_configuration_settings/03_entity_instance.ddl` | Instance registry |
| `db/entity_configuration_settings/05_entity_instance_link.ddl` | Relationship links |
| `db/entity_configuration_settings/06_entity_rbac.ddl` | RBAC permissions |
| `apps/api/src/services/entity-infrastructure.service.ts` | Backend service |
| `apps/web/src/components/rbac/` | Frontend RBAC UI |

### Key Service Methods

```typescript
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID }
  from '@/services/entity-infrastructure.service.js';

const entityInfra = getEntityInfrastructure(db);

// Check permission
const canEdit = await entityInfra.check_entity_rbac(
  personId, 'project', projectId, Permission.EDIT
);

// Create entity (transactional: primary + registry + rbac + link)
await entityInfra.create_entity({
  entity_code: 'task',
  creator_id: userId,
  parent_entity_code: 'project',
  parent_entity_id: projectId,
  primary_table: 'app.task',
  primary_data: { name: 'New Task', ... }
});

// Delete entity (transactional: all 4 tables)
await entityInfra.delete_entity({
  entity_code: 'task',
  entity_id: taskId,
  user_id: userId,
  primary_table: 'app.task'
});

// Unlink only (relationship removal, child survives)
await entityInfra.delete_entity_instance_link({
  entity_code: 'project',
  entity_instance_id: projectId,
  child_entity_code: 'task',
  child_entity_instance_id: taskId
});
```

---

## Part 8: Schema Summary

### `app.entity` Columns (v2.2.0)

| Column | Type | Description |
|--------|------|-------------|
| `code` | varchar(50) PK | Entity type identifier |
| `name` | varchar(100) | Entity name |
| `ui_label` | varchar(100) | Plural UI label |
| `ui_icon` | varchar(50) | Lucide icon name |
| `db_table` | varchar(100) | Physical table name |
| `db_model_type` | varchar(2) | d/dh/f/fh/fd |
| `child_entity_codes` | jsonb | Child types with `ownership_flag` |
| `root_level_entity_flag` | boolean | Is this a traversal root? |
| `config_datatable` | jsonb | List view settings |
| `active_flag` | boolean | Soft delete flag |

### `child_entity_codes` JSONB Structure

```json
[
  {
    "entity": "task",
    "ui_label": "Tasks",
    "ui_icon": "CheckSquare",
    "order": 1,
    "ownership_flag": true
  },
  {
    "entity": "customer",
    "ui_label": "Customers",
    "ui_icon": "Users",
    "order": 2,
    "ownership_flag": false
  }
]
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-12 | Initial documentation |
| 1.1.0 | 2025-12-12 | Added `root_level_entity_flag` for traversal boundaries |
| - | - | Renamed `owned` → `ownership_flag` for clarity |
| - | - | Added instance-level role naming convention |
| - | - | Added role tiers: external/crew/lead/owner |
| 2.2.0 | 2025-12-13 | **Implementation complete** - All API routes and UI components updated |
| - | - | API: `hierarchical-permissions` returns `ownership_flag` and `root_level_entity_flag` |
| - | - | UI: ROOT badge, owned vs lookup cascade summary, lookup children capped at COMMENT |
| - | - | Backend: `set_entity_instance_link` auto-populates `ownership_flag` from parent config |
