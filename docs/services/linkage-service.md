# Linkage Service

> **Centralized entity relationship management with idempotent operations**

**File**: `apps/api/src/services/linkage.service.ts`
**Type**: Core Infrastructure Service
**Pattern**: Create-Link-Edit

---

## Purpose

Manages parent-child entity relationships through the `d_entity_instance_link` table with idempotent create/delete operations. Enables flexible many-to-many relationships without foreign keys.

---

## Where Used

### Entity Creation Endpoints (12 modules)

The linkage service is called during entity creation when a parent context is provided:

| Module | Route | Usage Context |
|--------|-------|---------------|
| **Project** | `POST /api/v1/project` | Link project → business/customer |
| **Task** | `POST /api/v1/task` | Link task → project/employee |
| **Form** | `POST /api/v1/form` | Link form → project/task |
| **Artifact** | `POST /api/v1/artifact` | Link artifact → project/task/form |
| **Customer** | `POST /api/v1/cust` | Link customer → business |
| **Worksite** | `POST /api/v1/worksite` | Link worksite → business |
| **Employee** | `POST /api/v1/employee` | Link employee → office/role |
| **Role** | `POST /api/v1/role` | Link role → employee (assignments) |
| **Business** | `POST /api/v1/business` | Link business → office |
| **Reports** | `POST /api/v1/reports` | Link reports → entity |
| **Linkage API** | `POST /api/v1/linkage` | Direct linkage creation |
| **Linkage API** | `DELETE /api/v1/linkage/:id` | Direct linkage deletion |

### Integration Points

- **All entity POST endpoints** that accept `?parent_type=X&parent_id=Y` query params
- **Linkage module** for direct relationship management
- **Factory endpoints** (child entity endpoints use existing linkages)

---

## How It Works (Building Blocks)

### Block 1: Idempotent Creation

**Flow**:
1. Check if linkage already exists (parent + child combination)
2. **If exists and inactive** → Reactivate (set `active_flag = true`)
3. **If exists and active** → Return existing record (no-op)
4. **If not exists** → Create new linkage record

**Benefits**:
- No duplicate relationship errors
- Safe to call multiple times
- Handles soft-deleted relationships (reactivation)
- Consistent state regardless of call frequency

### Block 2: Relationship Structure

**Table**: `app.d_entity_instance_link`

**Fields Managed**:
- `parent_entity_type` - Parent entity type (business, project, etc.)
- `parent_entity_id` - Parent UUID
- `child_entity_type` - Child entity type (project, task, etc.)
- `child_entity_id` - Child UUID
- `relationship_type` - Relationship semantic (contains, assigned_to, etc.)
- `active_flag` - Soft delete flag

**Relationship Semantics**:
- `contains` - Hierarchical ownership (business contains projects)
- `assigned_to` - Assignment relationship (task assigned_to employee)
- `belongs_to` - Membership (employee belongs_to role)
- `references` - Cross-reference (form references project)

### Block 3: Soft Delete Pattern

**Flow**:
1. Locate linkage by ID
2. Set `active_flag = false` (soft delete)
3. Update `updated_ts` timestamp
4. Return deleted record

**Benefits**:
- Preserves relationship history
- Enables temporal queries (from_ts/to_ts support)
- Reversible operation (can reactivate)
- Maintains referential context for auditing

### Block 4: Integration with RBAC

**Permission Inheritance**:
- Parent-VIEW permission → Children gain VIEW
- Parent-CREATE permission → Children gain CREATE
- Linkage acts as permission propagation mechanism

**Example**:
```
1. Employee has VIEW on Business 'ABC Corp'
2. Projects linked to Business 'ABC Corp' via d_entity_instance_link
3. Employee automatically gains VIEW on all those projects
```

### Block 5: Integration with Entity Queries

**Parent-Child Filtering**:
- `unified_data_gate.parent_child_filtering_gate` queries `d_entity_instance_link`
- INNER JOIN filters children by parent relationship
- Active flag ensures only active relationships returned

**Query Pattern**:
```
SELECT child.*
FROM d_project child
INNER JOIN d_entity_instance_link eim ON (
  eim.child_entity_id = child.id
  AND eim.parent_entity_type = 'business'
  AND eim.parent_entity_id = 'business-uuid'
  AND eim.child_entity_type = 'project'
  AND eim.active_flag = true
)
```

---

## Operational Flow

### Creating Entity with Parent Context

**Sequence**:
1. **Route receives** `POST /api/v1/project?parent_type=business&parent_id=abc-123`
2. **RBAC check** - Verify user can CREATE projects
3. **Insert entity** - Create project record in `d_project`
4. **Call linkage service** - Link project to business
5. **Auto-grant permission** - Creator gets OWNER permission on new project
6. **Return response** - New project with linkage metadata

**Idempotency Guarantee**:
- If same parent-child relationship created twice → Second call returns existing linkage
- No errors, no duplicates, consistent state

### Direct Linkage Management

**Via Linkage API**:
- `POST /api/v1/linkage` - Create/reactivate relationship
- `DELETE /api/v1/linkage/:id` - Soft delete relationship
- `GET /api/v1/linkage` - List all linkages (with filters)

**Use Cases**:
- Assign task to different project (re-parent)
- Link entity to multiple parents (many-to-many)
- Manage employee-role assignments
- Cross-reference entities (form → project)

---

## Key Design Principles

### 1. No Foreign Keys

**Why**:
- Enables soft deletes without cascade issues
- Supports many-to-many relationships natively
- Allows temporal versioning (from_ts/to_ts)
- Cross-schema flexibility

**Trade-off**:
- Referential integrity enforced at application layer
- Requires explicit linkage service calls

### 2. Idempotent Operations

**Why**:
- Safe concurrent creation attempts
- Handles network retries gracefully
- Simplifies client logic (no "already exists" errors)

**Implementation**:
- Check existence before insert
- Reactivate if soft-deleted
- Return existing if active

### 3. Relationship Semantics

**Why**:
- `relationship_type` field adds business meaning
- Enables filtered queries (e.g., only "assigned_to" relationships)
- Documents intent of relationship

**Examples**:
- `contains` - Ownership hierarchy
- `assigned_to` - Task assignments
- `belongs_to` - Memberships
- `references` - Cross-references

### 4. Active Flag Pattern

**Why**:
- Preserves history (audit trail)
- Reversible deletions
- Temporal queries (show active as of date)

**Query Impact**:
- All queries must filter `active_flag = true`
- Soft-deleted relationships hidden from normal operations
- Historical queries can include inactive relationships

---

## Dependencies

### Database Tables

- **d_entity_instance_link** - Relationship storage (primary table)
- **d_entity_rbac** - Permission inheritance checks
- **d_entity** - Entity metadata (validates entity types)

### Services

- **unified_data_gate** - Uses linkages for parent-child filtering
- **entity routes** - All create endpoints use linkage service

### Libraries

- **drizzle-orm** - SQL query building
- **Database connection** - PostgreSQL client

---

## Error Scenarios

### Not Found

**Scenario**: Delete linkage that doesn't exist
**Handling**: Throws error with linkage ID
**Impact**: Client receives 404-style error

### Invalid Entity Types

**Scenario**: Link incompatible entity types
**Handling**: Database constraint (if exists) or application validation
**Impact**: Prevented at application layer

### Orphaned Entities

**Scenario**: Child exists but parent deleted
**Handling**: Linkage remains (soft delete), parent still referenced
**Impact**: Parent filter returns empty (parent inactive)

---

## Performance Considerations

### Indexes Required

```sql
-- Parent lookups (find all children)
CREATE INDEX idx_eim_parent
ON app.d_entity_instance_link(parent_entity_type, parent_entity_id, active_flag);

-- Child lookups (find all parents)
CREATE INDEX idx_eim_child
ON app.d_entity_instance_link(child_entity_type, child_entity_id, active_flag);

-- Relationship lookups
CREATE INDEX idx_eim_relationship
ON app.d_entity_instance_link(parent_entity_id, child_entity_id, active_flag);
```

### Query Optimization

- **Composite indexes** - Include `active_flag` in all indexes
- **Partial indexes** - Only active relationships (`WHERE active_flag = true`)
- **UUID indexing** - PostgreSQL UUID type optimized

---

## Version History

- **v1.0.0** (2025-11-16): Initial extraction from linkage module
- **Pattern**: Create-Link-Edit established as standard
- **Adoption**: 12+ entity modules using service

---

**File Location**: `apps/api/src/services/linkage.service.ts`
**Documentation**: This file
**Related**: `docs/api/entity_endpoint_design.md`, `docs/universal_rbac_parent_child_filtering_gate.md`
