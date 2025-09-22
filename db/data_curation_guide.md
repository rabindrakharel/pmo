# 🎯 PMO System Data Curation Guide

## Overview

This guide provides step-by-step instructions for AI/LLM-based coders to enrich and curate data for business parent entities and action entities in the PMO system. The system uses a sophisticated 5-layer RBAC architecture that requires careful coordination across multiple DDL files.

## 🏗️ System Architecture Understanding

### 5-Layer RBAC Architecture
```
Layer 1: meta_entity_types (Foundation) → Entity type definitions
Layer 2: meta_entity_hierarchy (Rules) → Parent-child creation rules
Layer 3: meta_entity_hierarchy_permission_mapping (Permissions) → Permission matrix
Layer 4: entity_id_hierarchy_mapping (Instances) → Actual relationships
Layer 5: rel_employee_entity_action_rbac (Access Control) → User permissions
```

### Entity Categories
- **Organizational**: hr, biz, org, client (structural/hierarchical)
- **Operational**: project, task, worksite (execution/workflow)
- **Personnel**: employee, role (human resources)
- **Content**: wiki, form, artifact (information/knowledge)

---

# 📋 BUSINESS PARENT ENTITY DATA CURATION

## Step 1: Business Entity Creation/Update

### File: `20___d_biz.ddl`
**Purpose**: Create or update business units with comprehensive business context

```sql
-- Example: Add new business department
INSERT INTO app.d_biz (
  name, "descr", tags, attr,
  business_type, business_model, business_category,
  parent_id, level_num, level_name
) VALUES (
  'New Department Name',
  'Comprehensive description of department services and responsibilities',
  '["department", "service_type", "operational"]'::jsonb,
  '{"services": ["service1", "service2"], "peak_season": "season", "client_types": ["type1", "type2"]}'::jsonb,
  'department',
  'service_delivery',
  'operational',
  (SELECT id FROM app.d_biz WHERE name = 'Parent Division'),
  3, 'Department'
);
```

### Required Fields for Business Entities:
- **name**: Clear, descriptive department/division name
- **descr**: Comprehensive description of services and responsibilities
- **tags**: JSON array for categorization and search
- **attr**: JSON object with business-specific attributes
- **business_type**: 'corporation', 'division', 'department'
- **parent_id**: Reference to parent business unit (for hierarchy)

## Step 2: Entity Hierarchy Mapping

### File: `17___entity_id_hierarchy_mapping.ddl`
**Purpose**: Establish parent-child relationships for navigation and permissions

```sql
-- Business unit hierarchy relationships (self-referential)
INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
SELECT
  biz_child.id, 'biz',
  biz_child.parent_id, 'biz'
FROM app.d_biz biz_child
WHERE biz_child.active = true AND biz_child.parent_id IS NOT NULL;
```

### ⚠️ Critical Rules:
- Always map child business units to their parents
- Use consistent entity type codes ('biz' for business)
- Only map active entities (active = true)

## Step 3: RBAC Permissions for Business Entity

### File: `19___rel_employee_entity_rbac.ddl`
**Purpose**: Grant access permissions to employees for the business entity

```sql
-- CEO/Executive permissions (self-permissions)
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'ceo@company.com'),
  unnest(ARRAY['view', 'edit', 'share']) AS permission_action,
  'biz', biz.id, 'biz', biz.id,
  (SELECT id FROM app.d_employee WHERE email = 'ceo@company.com'),
  'CEO - Full access to [Business Unit Name]'
FROM app.d_biz biz
WHERE biz.name = 'Business Unit Name' AND biz.active = true;

-- Department Manager permissions
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'manager@company.com'),
  unnest(ARRAY['view', 'edit', 'share']) AS permission_action,
  'biz', biz.id, 'biz', biz.id,
  (SELECT id FROM app.d_employee WHERE email = 'ceo@company.com'),
  'Department Manager - Full departmental access'
FROM app.d_biz biz
WHERE biz.name = 'Business Unit Name' AND biz.active = true;
```

### Required RBAC Patterns:
- **Self-permissions**: view, edit, share on the business entity itself
- **CEO access**: Full permissions on all business units
- **Manager access**: Department-specific permissions
- **Granted by**: Always specify who granted the permission (usually CEO)

---

# 📋 PROJECT PARENT ENTITY DATA CURATION

## Step 1: Project Entity Creation/Update

### File: `35___d_project.ddl`
**Purpose**: Create projects with proper business unit assignment

```sql
INSERT INTO app.d_project (
  name, "descr", slug, project_code, project_type, priority_level,
  budget_allocated, budget_currency, biz_id,
  planned_start_date, planned_end_date, estimated_hours,
  security_classification, compliance_requirements, risk_assessment,
  tags, attr
) VALUES (
  'Project Name',
  'Comprehensive project description with objectives and scope',
  'project-slug',
  'PROJ-CODE-2025',
  'strategic', -- 'strategic', 'operational', 'seasonal', 'service'
  'high', -- 'low', 'medium', 'high', 'critical'
  500000.00,
  'CAD',
  (SELECT id FROM app.d_biz WHERE name = 'Business Unit Name'),
  '2025-01-01', '2025-12-31', 2000.0,
  'internal', -- 'public', 'internal', 'confidential', 'restricted'
  '["Regulation 1", "Standard 2", "Compliance 3"]'::jsonb,
  '{"risk_type": "level", "mitigation": "strategy"}'::jsonb,
  '["project_category", "domain", "type"]',
  '{"key": "value", "attributes": "specific_to_project"}'::jsonb
);
```

### Critical Project Fields:
- **biz_id**: Must reference existing business unit
- **project_code**: Unique identifier following naming convention
- **project_type**: Categorization for filtering and management
- **priority_level**: Impact on resource allocation and scheduling

## Step 2: Project Hierarchy Mapping

### File: `17___entity_id_hierarchy_mapping.ddl`
**Purpose**: Link projects to their parent business units

```sql
-- Projects to business unit assignments (project → biz)
INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
SELECT
  proj.id, 'project',
  proj.biz_id, 'biz'
FROM app.d_project proj
WHERE proj.active = true AND proj.biz_id IS NOT NULL;
```

## Step 3: Project RBAC Permissions

### File: `19___rel_employee_entity_rbac.ddl`
**Purpose**: Grant comprehensive project access and creation permissions

```sql
-- CEO: Full access to all projects (self-permissions)
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'ceo@company.com'),
  unnest(ARRAY['view', 'edit', 'share']) AS permission_action,
  'project', proj.id, 'project', proj.id,
  (SELECT id FROM app.d_employee WHERE email = 'ceo@company.com'),
  'CEO - Full project access'
FROM app.d_project proj
WHERE proj.active = true;

-- Business Unit Manager: Creation permissions from business to projects
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'manager@company.com'),
  'create',
  'biz', biz.id,
  'project', proj.id,
  (SELECT id FROM app.d_employee WHERE email = 'ceo@company.com'),
  'Business Manager - Project creation permissions'
FROM app.d_biz biz
CROSS JOIN app.d_project proj
WHERE biz.name = 'Business Unit Name' AND biz.active = true
  AND proj.biz_id = biz.id AND proj.active = true;
```

---

# 📋 ACTION ENTITY DATA CURATION

## Supported Action Entities
- **Tasks**: `ops_task_head` (File: `53___ops_task_head.ddl`)
- **Wiki**: `d_wiki` (File: `54___d_wiki.ddl`)
- **Artifacts**: `d_artifact` (File: `27___d_artifact.ddl`)
- **Forms**: `ops_formlog_head` (File: `50___ops_formlog_head.ddl`)

## Universal Action Entity Pattern

### Step 1: Entity Creation
Create entities with proper parent relationships:

```sql
-- Example for Task entity
INSERT INTO app.ops_task_head (
  name, "descr", tags, attr,
  project_id, task_code, priority_level, task_type,
  status, planned_start_date, planned_end_date, estimated_hours
) VALUES (
  'Task Name',
  'Detailed task description',
  '["task_category", "domain"]'::jsonb,
  '{"task_specific": "attributes"}'::jsonb,
  (SELECT id FROM app.d_project WHERE project_code = 'PROJ-CODE'),
  'TASK-CODE-001',
  'high',
  'field_work', -- 'field_work', 'administrative', 'logistics'
  'planned', -- 'planned', 'in_progress', 'completed', 'cancelled'
  '2025-01-01', '2025-01-05', 40
);
```

### Step 2: Hierarchy Mapping
```sql
-- Tasks to project assignments (task → project)
INSERT INTO app.entity_id_hierarchy_mapping (action_entity_id, action_entity, parent_entity_id, parent_entity)
SELECT
  task.id, 'task',
  task.project_id, 'project'
FROM app.ops_task_head task
WHERE task.active = true AND task.project_id IS NOT NULL;
```

### Step 3: RBAC Permissions
```sql
-- Self-permissions for action entities
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'user@company.com'),
  unnest(ARRAY['view', 'edit', 'share']) AS permission_action,
  'task', task.id, 'task', task.id,
  (SELECT id FROM app.d_employee WHERE email = 'ceo@company.com'),
  'User - Task management permissions'
FROM app.ops_task_head task
WHERE task.active = true;

-- Creation permissions from parent to action entities
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'user@company.com'),
  'create',
  'project', proj.id,
  'task', task.id,
  (SELECT id FROM app.d_employee WHERE email = 'ceo@company.com'),
  'User - Task creation permissions from project'
FROM app.d_project proj
CROSS JOIN app.ops_task_head task
WHERE proj.active = true AND task.project_id = proj.id AND task.active = true;
```

---

# 🔄 COMPLETE DATA CURATION WORKFLOW

## Recommended Execution Order

### Phase 1: Foundation Setup
1. **Business Entity** (`20___d_biz.ddl`)
2. **Project Entity** (`35___d_project.ddl`)
3. **Action Entities** (various DDL files)

### Phase 2: Relationship Mapping
4. **Entity Hierarchy Mapping** (`17___entity_id_hierarchy_mapping.ddl`)

### Phase 3: Access Control
5. **RBAC Permissions** (`19___rel_employee_entity_rbac.ddl`)

## Verification Steps

### 1. Data Integrity Check
```sql
-- Verify business unit exists
SELECT id, name FROM app.d_biz WHERE name = 'Your Business Unit';

-- Verify project assignment
SELECT p.name, b.name as business_unit
FROM app.d_project p
JOIN app.d_biz b ON p.biz_id = b.id
WHERE p.project_code = 'YOUR-PROJECT-CODE';

-- Verify hierarchy mapping
SELECT action_entity, parent_entity, COUNT(*)
FROM app.entity_id_hierarchy_mapping
GROUP BY action_entity, parent_entity;
```

### 2. RBAC Verification
```sql
-- Check permissions for specific employee
SELECT
  emp.name,
  rbac.permission_action,
  rbac.parent_entity,
  rbac.action_entity,
  rbac.grant_reason
FROM app.rel_employee_entity_action_rbac rbac
JOIN app.d_employee emp ON rbac.employee_id = emp.id
WHERE emp.email = 'user@company.com';
```

---

# ⚠️ CRITICAL CONSIDERATIONS

## Data Consistency Rules
1. **Always use existing business units** - verify biz_id references
2. **Maintain hierarchy integrity** - child entities must reference valid parents
3. **Follow naming conventions** - consistent project codes, task codes
4. **Temporal data respect** - use active = true for current entities

## RBAC Security Rules
1. **Explicit permissions only** - no implicit inheritance
2. **CEO gets full access** - always grant comprehensive permissions to CEO
3. **Manager scope limits** - limit permissions to their business units
4. **Creation follows hierarchy** - creation permissions must match entity hierarchy rules

## Common Pitfalls to Avoid
1. **Missing hierarchy mappings** - breaks navigation and breadcrumbs
2. **Incomplete RBAC permissions** - users can't access entities they should see
3. **Wrong entity type codes** - use exact codes from meta_entity_types
4. **Circular references** - avoid parent-child loops in business hierarchy
5. **Missing parent assignments** - action entities must reference valid parents

## Performance Considerations
1. **Batch inserts** - use single INSERT statements with multiple VALUES
2. **Index-friendly queries** - use indexed columns in WHERE clauses
3. **Minimize cross-joins** - be cautious with CROSS JOIN operations in RBAC
4. **Active entity filtering** - always filter by active = true

---

# 📚 QUICK REFERENCE

## File Summary
| **Entity Type** | **DDL File** | **Purpose** |
|----------------|--------------|-------------|
| Business Units | `20___d_biz.ddl` | Organizational structure |
| Projects | `35___d_project.ddl` | Project definitions |
| Tasks | `53___ops_task_head.ddl` | Work item management |
| Wiki | `54___d_wiki.ddl` | Knowledge documentation |
| Artifacts | `27___d_artifact.ddl` | Document/asset management |
| Forms | `50___ops_formlog_head.ddl` | Data collection forms |
| Hierarchy | `17___entity_id_hierarchy_mapping.ddl` | Relationship mapping |
| RBAC | `19___rel_employee_entity_rbac.ddl` | Access permissions |

## Key Employee References
```sql
-- CEO (James Miller)
(SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca')

-- Landscaping Manager (Carlos Martinez)
(SELECT id FROM app.d_employee WHERE email = 'carlos.martinez@huronhome.ca')
```

## Entity Type Codes
- **biz**: Business units
- **project**: Projects
- **task**: Tasks
- **wiki**: Wiki pages
- **artifact**: Documents/assets
- **form**: Forms
- **employee**: Personnel
- **role**: Organizational roles

---

This guide provides the complete framework for systematic data curation in the PMO system. Follow the patterns, respect the architecture, and maintain data integrity across all layers.