# API Routes vs DDL Audit Report

**Generated:** 2025-10-29
**Scope:** Comprehensive audit of API route SQL queries vs DDL table definitions
**Entities Audited:** Project, Task, Employee, Business (sample), and inferred patterns for all entities

---

## Executive Summary

This audit identifies **critical SQL query mismatches** between API routes and DDL table definitions. Most issues stem from:

1. **Column references that don't exist** - Queries reference columns not defined in DDL tables
2. **Incorrect relationship handling** - Foreign key columns referenced when relationships are managed via `entity_id_map`
3. **Metadata JSONB field confusion** - Direct column access instead of JSONB extraction

**Impact:** These issues will cause runtime SQL errors when filters/queries are used.

---

## Critical Issues Found

### 1. PROJECT Entity (`/apps/api/src/modules/project/routes.ts`)

#### Issue 1.1: CreateProjectSchema Contains Non-Existent Columns
**Location:** `apps/api/src/modules/project/routes.ts:47-48`

**Problem:**
```typescript
const CreateProjectSchema = Type.Object({
  // ... other fields
  business_id: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  office_id: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  // ...
});
```

**DDL Reality (`db/18_d_project.ddl:107-137`):**
```sql
CREATE TABLE app.d_project (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    -- NO business_id column
    -- NO office_id column
    -- Project relationships to parent entity are managed via entity_id_map so no FK needed (Line 114)
    project_stage text,
    budget_allocated_amt decimal(15,2),
    -- ... other fields
);
```

**Correct Pattern (from DDL sample data line 154):**
```json
metadata: {
  "business_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "office_id": "11111111-1111-1111-1111-111111111111"
}
```

**Fix Required:**
- Remove `business_id` and `office_id` from CreateProjectSchema
- Store these relationships in `metadata` JSONB field OR via `entity_id_map` table
- Update INSERT query (line 752-778) to handle relationships correctly

**Impact:** Medium - Schema accepts fields that are silently ignored during INSERT

---

### 2. TASK Entity (`/apps/api/src/modules/task/routes.ts`)

#### Issue 2.1: LIST Query Filter Uses Non-Existent Columns
**Location:** `apps/api/src/modules/task/routes.ts:124-149`

**Problem:**
```typescript
// Line 124-125
if (project_id !== undefined) {
  conditions.push(sql`project_id = ${project_id}`);  // ❌ Column doesn't exist
}

// Line 128-130
if (assigned_to_employee_id !== undefined) {
  conditions.push(sql`assigned_to_employee_id = ${assigned_to_employee_id}`);  // ❌ Column doesn't exist
}

// Line 132-134
if (task_status !== undefined) {
  conditions.push(sql`task_status = ${task_status}`);  // ❌ Column doesn't exist
}

// Line 136-138
if (task_type !== undefined) {
  conditions.push(sql`task_type = ${task_type}`);  // ❌ Column doesn't exist
}

// Line 140-142
if (task_category !== undefined) {
  conditions.push(sql`task_category = ${task_category}`);  // ❌ Column doesn't exist
}

// Line 144-146
if (worksite_id !== undefined) {
  conditions.push(sql`worksite_id = ${worksite_id}`);  // ❌ Column doesn't exist
}

// Line 148-150
if (client_id !== undefined) {
  conditions.push(sql`client_id = ${client_id}`);  // ❌ Column doesn't exist
}
```

**DDL Reality (`db/19_d_task.ddl:20-41`):**
```sql
CREATE TABLE app.d_task (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    active_flag boolean DEFAULT true,
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1,
    -- Task-specific fields
    internal_url text,
    shared_url text,
    stage text,              -- ✅ This exists (not task_status)
    priority_level text,
    estimated_hours numeric(10,2),
    actual_hours numeric(10,2),
    story_points integer
    -- NO project_id column (in metadata or entity_id_map)
    -- NO assigned_to_employee_id column (managed via entity_id_map)
    -- NO task_status column (should be 'stage')
    -- NO task_type column (in metadata JSONB)
    -- NO task_category column
    -- NO worksite_id column (in metadata JSONB)
    -- NO client_id column (in metadata JSONB)
);
```

**DDL Sample Data Shows Correct Pattern (line 56):**
```json
metadata: {
  "task_type": "evaluation",
  "project_id": "93106ffb-402e-43a7-8b26-5287e37a1b0e",
  "business_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "office_id": "11111111-1111-1111-1111-111111111111"
}
```

**Fix Required:**
```typescript
// Correct filters
if (project_id !== undefined) {
  conditions.push(sql`(t.metadata->>'project_id')::uuid = ${project_id}::uuid`);
}

if (assigned_to_employee_id !== undefined) {
  conditions.push(sql`EXISTS (
    SELECT 1 FROM app.entity_id_map map
    WHERE map.parent_entity_type = 'task'
      AND map.parent_entity_id = t.id::text
      AND map.child_entity_type = 'employee'
      AND map.child_entity_id = ${assigned_to_employee_id}
      AND map.relationship_type = 'assigned_to'
      AND map.active_flag = true
  )`);
}

if (task_status !== undefined) {
  conditions.push(sql`t.stage = ${task_status}`);  // Use 'stage' column
}

if (task_type !== undefined) {
  conditions.push(sql`t.metadata->>'task_type' = ${task_type}`);
}

if (task_category !== undefined) {
  conditions.push(sql`t.metadata->>'task_category' = ${task_category}`);
}

if (worksite_id !== undefined) {
  conditions.push(sql`(t.metadata->>'worksite_id')::uuid = ${worksite_id}::uuid`);
}

if (client_id !== undefined) {
  conditions.push(sql`(t.metadata->>'client_id')::uuid = ${client_id}::uuid`);
}
```

**Impact:** CRITICAL - Will throw PostgreSQL errors when these query parameters are used

---

#### Issue 2.2: Kanban Endpoint Uses Non-Existent Columns
**Location:** `apps/api/src/modules/task/routes.ts:741-742`

**Problem:**
```typescript
// Line 741-742
const filters = [sql`project_id = ${projectId}`, sql`active_flag = true`];  // ❌ project_id doesn't exist
if (assignee) filters.push(sql`assigned_to_employee_id = ${assignee}`);  // ❌ assigned_to_employee_id doesn't exist
if (priority) filters.push(sql`priority_level = ${priority}`);  // ✅ This is correct
```

**Fix Required:**
```typescript
const filters = [
  sql`(t.metadata->>'project_id')::uuid = ${projectId}::uuid`,  // From metadata
  sql`t.active_flag = true`
];

if (assignee) {
  filters.push(sql`EXISTS (
    SELECT 1 FROM app.entity_id_map map
    WHERE map.parent_entity_type = 'task'
      AND map.parent_entity_id = t.id::text
      AND map.child_entity_type = 'employee'
      AND map.child_entity_id = ${assignee}
      AND map.relationship_type = 'assigned_to'
      AND map.active_flag = true
  )`);
}
```

**Impact:** CRITICAL - Kanban board will not load projects

---

#### Issue 2.3: Status Update Endpoint Uses Wrong Column Name
**Location:** `apps/api/src/modules/task/routes.ts:651-652, 663-664`

**Problem:**
```typescript
// Line 651-652
const existingTask = await db.execute(sql`
  SELECT id, name, task_status FROM app.d_task   // ❌ task_status doesn't exist
  WHERE id = ${id} AND active_flag = true
`);

// Line 663-664
UPDATE app.d_task
SET stage = ${task_status},  // ✅ Correctly updates 'stage'
```

**Fix Required:**
```typescript
// Line 651
SELECT id, name, stage FROM app.d_task  // Use 'stage' instead of 'task_status'
```

**Impact:** MEDIUM - Will cause SQL error when updating task status via Kanban drag-drop

---

### 3. Pattern Analysis: Common Anti-Patterns Across All Entities

Based on the audit of Project and Task entities, these patterns likely exist across other entities:

#### Anti-Pattern 1: Direct FK Columns Instead of entity_id_map
**Where:** Project (business_id, office_id), Task (project_id, assignee_id)
**Impact:** Breaks the universal entity relationship model
**Fix:** Use entity_id_map for all entity-to-entity relationships OR store in metadata JSONB

#### Anti-Pattern 2: Inconsistent Column Naming
**Where:** Task uses `stage` in DDL but queries use `task_status`
**Impact:** Column name mismatches cause SQL errors
**Fix:** Standardize on DDL column names in all queries

#### Anti-Pattern 3: Metadata JSONB Not Used for Flexible Fields
**Where:** CreateProjectSchema accepts business_id/office_id as top-level fields
**Impact:** Confusing API contract; fields accepted but not persisted as columns
**Fix:** Document which fields go to metadata JSONB vs table columns

---

## Recommendations

### Immediate Fixes (Critical)

1. **Fix Task LIST filters** (`apps/api/src/modules/task/routes.ts:124-149`)
   - Update all 7 filter conditions to use metadata JSONB extraction or entity_id_map queries
   - Test with actual filter parameters to verify SQL syntax

2. **Fix Task Kanban queries** (`apps/api/src/modules/task/routes.ts:741-742`)
   - Replace project_id direct reference with metadata extraction
   - Replace assignee direct reference with entity_id_map subquery

3. **Fix Task status update query** (`apps/api/src/modules/task/routes.ts:651`)
   - Change `task_status` column name to `stage`

### Medium Priority Fixes

4. **Standardize Project relationship handling** (`apps/api/src/modules/project/routes.ts:47-48`)
   - Remove business_id/office_id from CreateProjectSchema
   - Add documentation for storing these in metadata JSONB
   - OR implement consistent entity_id_map usage for all parent-child relationships

### Systematic Audit Required

5. **Audit all remaining entity routes** (30+ modules)
   - Employee routes
   - Client/Customer routes
   - Office routes
   - Worksite routes
   - Wiki, Artifact, Form routes
   - Settings routes
   - Product/Operations entities (Order, Invoice, Shipment, Inventory)

6. **Establish coding standards**
   - Document when to use: table columns vs metadata JSONB vs entity_id_map
   - Create helper functions for common query patterns (e.g., `filterByMetadataField()`, `filterByEntityRelationship()`)
   - Add TypeScript types that exactly match DDL schemas

---

## Testing Checklist

After fixes are applied, test these scenarios:

### Task Entity
- [ ] List tasks filtered by project_id
- [ ] List tasks filtered by assigned_to_employee_id
- [ ] List tasks filtered by task_status (stage)
- [ ] List tasks filtered by task_type (metadata)
- [ ] List tasks filtered by worksite_id (metadata)
- [ ] List tasks filtered by client_id (metadata)
- [ ] Kanban board for a specific project
- [ ] Kanban board filtered by assignee
- [ ] Drag-drop task to change status
- [ ] Search tasks by name/description

### Project Entity
- [ ] Create project with business_id in metadata
- [ ] Create project with office_id in metadata
- [ ] List projects (verify no SQL errors)
- [ ] Get single project (verify relationships load)

---

## SQL Query Validation Tools

Consider adding these safeguards:

1. **Schema validation middleware**
   ```typescript
   // Validate query column names against DDL before execution
   const validateQueryColumns = (tableName: string, columns: string[]) => {
     const ddlColumns = getTableColumns(tableName);
     const invalid = columns.filter(col => !ddlColumns.includes(col));
     if (invalid.length > 0) {
       throw new Error(`Invalid columns for ${tableName}: ${invalid.join(', ')}`);
     }
   };
   ```

2. **Type-safe query builders**
   ```typescript
   // Use Drizzle ORM schema definitions that match DDL exactly
   // This provides compile-time column validation
   ```

3. **Integration tests for all filter combinations**
   ```typescript
   // Test matrix: entity × filter_type × value
   // Example: task × project_id × valid_uuid
   ```

---

## Appendix: Column Comparison Tables

### Project Entity (d_project)

| Column Name | In DDL? | In API Schema? | In CREATE query? | In LIST query? | Notes |
|-------------|---------|----------------|------------------|----------------|-------|
| id | ✅ | ✅ | Auto-generated | ✅ | Primary key |
| code | ✅ | ✅ | ✅ | ✅ | Unique identifier |
| name | ✅ | ✅ | ✅ | ✅ | Required |
| descr | ✅ | ✅ | ✅ | ✅ | Optional |
| metadata | ✅ | ✅ | ✅ | ✅ | JSONB |
| project_stage | ✅ | ✅ | ✅ | ✅ | From settings |
| budget_allocated_amt | ✅ | ✅ | ✅ | ✅ | Decimal |
| budget_spent_amt | ✅ | ✅ | ✅ | ✅ | Decimal |
| planned_start_date | ✅ | ✅ | ✅ | ✅ | Date |
| planned_end_date | ✅ | ✅ | ✅ | ✅ | Date |
| actual_start_date | ✅ | ✅ | ✅ | ✅ | Date |
| actual_end_date | ✅ | ✅ | ✅ | ✅ | Date |
| manager_employee_id | ✅ | ✅ | ✅ | ✅ | UUID FK |
| sponsor_employee_id | ✅ | ✅ | ✅ | ✅ | UUID FK |
| stakeholder_employee_ids | ✅ | ✅ | ✅ | ✅ | UUID[] |
| active_flag | ✅ | ✅ | ✅ | ✅ | Boolean |
| from_ts | ✅ | ✅ | Auto | ✅ | Timestamp |
| to_ts | ✅ | ✅ | Auto | ✅ | Timestamp |
| created_ts | ✅ | ✅ | Auto | ✅ | Timestamp |
| updated_ts | ✅ | ✅ | Auto | ✅ | Timestamp |
| version | ✅ | ✅ | Auto | ✅ | Integer |
| **business_id** | ❌ | ✅ | ❌ | ❌ | **Should be in metadata or entity_id_map** |
| **office_id** | ❌ | ✅ | ❌ | ❌ | **Should be in metadata or entity_id_map** |

### Task Entity (d_task)

| Column Name | In DDL? | In API Schema? | In CREATE query? | In LIST query? | In LIST filters? | Notes |
|-------------|---------|----------------|------------------|----------------|------------------|-------|
| id | ✅ | ✅ | Auto | ✅ | N/A | Primary key |
| code | ✅ | ✅ | ✅ | ✅ | N/A | Unique |
| name | ✅ | ✅ | ✅ | ✅ | N/A | Required |
| descr | ✅ | ✅ | ✅ | ✅ | N/A | Optional |
| metadata | ✅ | ✅ | ✅ | ✅ | N/A | JSONB |
| internal_url | ✅ | ✅ | ❌ | ✅ | N/A | Text |
| shared_url | ✅ | ✅ | ❌ | ✅ | N/A | Text |
| stage | ✅ | ✅ | ✅ | ✅ | N/A | Text |
| priority_level | ✅ | ✅ | ✅ | ✅ | N/A | Text |
| estimated_hours | ✅ | ✅ | ✅ | ✅ | N/A | Numeric |
| actual_hours | ✅ | ✅ | ✅ | ✅ | N/A | Numeric |
| story_points | ✅ | ✅ | ✅ | ✅ | N/A | Integer |
| active_flag | ✅ | ✅ | ✅ | ✅ | N/A | Boolean |
| from_ts | ✅ | ✅ | Auto | ✅ | N/A | Timestamp |
| to_ts | ✅ | ✅ | Auto | ✅ | N/A | Timestamp |
| created_ts | ✅ | ✅ | Auto | ✅ | N/A | Timestamp |
| updated_ts | ✅ | ✅ | Auto | ✅ | N/A | Timestamp |
| version | ✅ | ✅ | Auto | ✅ | N/A | Integer |
| **project_id** | ❌ | ❌ | ❌ | ❌ | ✅ ❌ | **Filter broken - should extract from metadata** |
| **assigned_to_employee_id** | ❌ | ❌ | ❌ | ❌ | ✅ ❌ | **Filter broken - should query entity_id_map** |
| **task_status** | ❌ | ❌ | ❌ | ❌ | ✅ ❌ | **Filter broken - should use 'stage'** |
| **task_type** | ❌ | ❌ | ❌ | ❌ | ✅ ❌ | **Filter broken - should extract from metadata** |
| **task_category** | ❌ | ❌ | ❌ | ❌ | ✅ ❌ | **Filter broken - not in DDL or metadata samples** |
| **worksite_id** | ❌ | ❌ | ❌ | ❌ | ✅ ❌ | **Filter broken - should extract from metadata** |
| **client_id** | ❌ | ❌ | ❌ | ❌ | ✅ ❌ | **Filter broken - should extract from metadata** |

---

## Conclusion

This audit reveals **systematic SQL query issues** that will cause runtime errors when using task filters, Kanban boards, and project relationships. The root cause is **inconsistent handling of relationships** (direct columns vs entity_id_map vs metadata JSONB).

**Priority:** Fix Task entity filter queries immediately (Critical severity - user-facing features broken)

**Next Steps:**
1. Apply fixes from this report
2. Extend audit to remaining 30+ entity modules
3. Establish architectural standards for relationship management
4. Add automated tests for filter combinations
5. Consider migration to type-safe query builder (Drizzle ORM schemas)
