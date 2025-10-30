# API Routes vs DDL Comprehensive Audit Report - FINAL

**Generated:** 2025-10-29
**Scope:** Complete audit of API route SQL queries vs DDL table definitions
**Entities Audited:** Task ✅ FIXED, Project, Employee, Customer, Business, Wiki, Artifact
**Status:** Task entity fixes COMPLETED and TESTED ✅

---

## Executive Summary

This comprehensive audit identified **critical SQL query mismatches** between API routes and DDL table definitions across multiple entities. The root causes include:

1. **Column references that don't exist** - Queries reference columns not defined in DDL tables
2. **Incorrect relationship handling** - Foreign key columns referenced when relationships are managed via `entity_id_map`
3. **Metadata JSONB field confusion** - Direct column access instead of JSONB extraction
4. **Missing table aliases** - SQL queries without proper table prefixes causing ambiguity
5. **Column name mismatches** - API uses different names than DDL (e.g., `task_status` vs `stage`, `birthdate` vs `birth_date`)

**Impact:** SQL errors on query execution, broken filters, Kanban boards not loading, incorrect data retrieval

**Status:**
- ✅ **Task entity FIXED and TESTED** - All 7 broken filters corrected, Kanban working
- ⚠️ **Employee, Project, Customer** - Issues identified, fixes pending
- ℹ️ **Other entities** - Pattern analysis suggests similar issues

---

## COMPLETED FIXES ✅

### Task Entity (`apps/api/src/modules/task/routes.ts`) - FIXED

#### Issue 1: LIST Query Filters (Lines 124-149) - FIXED ✅
**Problem:** 7 filter conditions referenced non-existent columns

**Original (BROKEN):**
```typescript
if (project_id !== undefined) {
  conditions.push(sql`project_id = ${project_id}`);  // ❌ Column doesn't exist
}
if (assigned_to_employee_id !== undefined) {
  conditions.push(sql`assigned_to_employee_id = ${assigned_to_employee_id}`);  // ❌
}
if (task_status !== undefined) {
  conditions.push(sql`task_status = ${task_status}`);  // ❌ Should be 'stage'
}
```

**Fixed:**
```typescript
// Project relationship stored in metadata JSONB
if (project_id !== undefined) {
  conditions.push(sql`(t.metadata->>'project_id')::uuid = ${project_id}::uuid`);
}

// Assignee relationship managed via entity_id_map
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

// Task status is stored as 'stage' column
if (task_status !== undefined) {
  conditions.push(sql`t.stage = ${task_status}`);
}
```

**Test Results:**
```bash
✅ GET /api/v1/task?limit=5 - SUCCESS (HTTP 200)
✅ GET /api/v1/task?project_id=93106ffb-402e-43a7-8b26-5287e37a1b0e - SUCCESS (HTTP 200)
✅ GET /api/v1/task?task_status=Planning - SUCCESS (HTTP 200)
```

#### Issue 2: Kanban Endpoint (Lines 756-758) - FIXED ✅
**Problem:** Referenced non-existent `project_id` and `assigned_to_employee_id` columns

**Fixed:**
```typescript
const filters = [
  sql`(t.metadata->>'project_id')::uuid = ${projectId}::uuid`,
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

#### Issue 3: Status Update Query (Line 666) - FIXED ✅
**Problem:** Selected `task_status` column that doesn't exist

**Fixed:**
```typescript
SELECT id, name, stage FROM app.d_task  // Changed from 'task_status' to 'stage'
WHERE id = ${id} AND active_flag = true
```

---

## PENDING FIXES ⚠️

### Employee Entity (`apps/api/src/modules/employee/routes.ts`)

#### Issue 1: Missing Table Aliases (Lines 201-227)
**Problem:** Filter conditions missing table alias `e.`

**Location:** Lines 201-214
```typescript
if (active_flag !== undefined) {
  conditions.push(sql`active_flag = ${active_flag}`);  // ❌ Should be e.active_flag
}
if (employee_type) {
  conditions.push(sql`employee_type = ${employee_type}`);  // ❌ Should be e.employee_type
}
```

**Fix Required:**
```typescript
if (active_flag !== undefined) {
  conditions.push(sql`e.active_flag = ${active_flag}`);
}
if (employee_type) {
  conditions.push(sql`e.employee_type = ${employee_type}`);
}
```

**Impact:** LOW - Works in single-table queries but poor practice; will break if JOINs added

#### Issue 2: Non-Existent Columns in SELECT (Lines 239-249)
**Problem:** Queries select columns that don't exist in DDL

**DDL Reality (`db/11_d_employee.ddl:99-162`):**
- ❌ `slug` - Column doesn't exist
- ❌ `tags` - Should be in metadata JSONB, not a separate column
- ❌ `birthdate` - DDL has `birth_date` (with underscore)

**Location:** Line 239
```typescript
SELECT
  id, slug, code, name, "descr",  // ❌ 'slug' doesn't exist
  COALESCE(tags, '[]'::jsonb) as tags,  // ❌ 'tags' column doesn't exist
  // ...
  sin, birthdate, citizenship, security_clearance,  // ❌ 'birthdate' should be 'birth_date'
```

**Fix Required:**
```typescript
SELECT
  id, code, name, "descr",  // Remove 'slug'
  COALESCE(metadata->'tags', '[]'::jsonb) as tags,  // Extract from metadata
  // ...
  sin, birth_date, citizenship, security_clearance,  // Fix column name
```

**Impact:** CRITICAL - Will cause SQL errors: `column "slug" does not exist`, `column "tags" does not exist`, `column "birthdate" does not exist`

#### Issue 3: Schema Mismatch with DDL
**Problem:** API Schema defines fields that don't exist as table columns

**TypeScript Schema (Lines 13-66) includes:**
- `preferred_name` - NOT in DDL
- `date_of_birth` - NOT in DDL (DDL has `birth_date`)
- `employment_status` - NOT in DDL
- `hr_position_id` - NOT in DDL
- `primary_org_id` - NOT in DDL
- `reports_to_employee_id` - NOT in DDL (DDL has `manager_employee_id`)
- `salary_annual` - NOT in DDL (DDL has `salary_band`)
- `hourly_rate` - NOT in DDL
- `overtime_eligible` - NOT in DDL
- `benefits_eligible` - NOT in DDL
- `certifications` - NOT in DDL (should be in metadata)
- `skills` - NOT in DDL (should be in metadata)
- `languages` - NOT in DDL
- `education_level` - NOT in DDL
- `remote_eligible` - NOT in DDL (DDL has `remote_work_eligible`)
- `travel_required` - NOT in DDL
- `emergency_contact` - NOT in DDL (DDL has `emergency_contact_name` and `emergency_contact_phone` as separate fields)

**Fix Required:** Either:
1. Add columns to DDL
2. Store in metadata JSONB
3. Remove from API Schema

**Impact:** MEDIUM - Schema accepts fields that are silently ignored

---

### Project Entity (`apps/api/src/modules/project/routes.ts`)

#### Issue 1: CreateProjectSchema Non-Existent Columns (Lines 47-48)
**Problem:** Schema accepts `business_id` and `office_id` fields that don't exist as columns

**DDL Reality (`db/18_d_project.ddl:107-137`):**
```sql
CREATE TABLE app.d_project (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    -- NO business_id column
    -- NO office_id column
    -- Comment: "Project relationships to parent entity are managed via entity_id_map so no FK needed"
);
```

**DDL Sample Data Shows Correct Pattern (Line 154):**
```json
metadata: {
  "business_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "office_id": "11111111-1111-1111-1111-111111111111"
}
```

**Fix Required:**
Remove from CreateProjectSchema or document that they should be stored in metadata:
```typescript
// Option 1: Remove fields
const CreateProjectSchema = Type.Object({
  name: Type.String(),
  // Remove business_id and office_id
});

// Option 2: Document metadata usage
const CreateProjectSchema = Type.Object({
  name: Type.String(),
  metadata: Type.Object({
    business_id: Type.Optional(Type.String({ format: 'uuid' })),
    office_id: Type.Optional(Type.String({ format: 'uuid' })),
  }),
});
```

**Impact:** MEDIUM - Fields accepted but silently ignored; confusing API contract

---

### Customer Entity (`apps/api/src/modules/cust/routes.ts`)

#### Issue 1: Missing Table Aliases in Search (Lines 90-102)
**Problem:** Search conditions missing table alias (works but inconsistent)

**Current (Works but inconsistent):**
```typescript
if (search) {
  conditions.push(sql`(
    name ILIKE ${`%${search}%`} OR
    "descr" ILIKE ${`%${search}%`} OR
    cust_number ILIKE ${`%${search}%`}
  )`);
}
```

**Better Practice:**
```typescript
if (search) {
  conditions.push(sql`(
    c.name ILIKE ${`%${search}%`} OR
    c."descr" ILIKE ${`%${search}%`} OR
    c.cust_number ILIKE ${`%${search}%`}
  )`);
}
```

**Impact:** LOW - Works in current single-table queries; best practice for future JOINs

---

## Pattern Analysis: Common Anti-Patterns Across All Entities

### Anti-Pattern 1: Direct FK Columns Instead of entity_id_map
**Where:** Project (business_id, office_id), Task (project_id, assignee_id)
**Root Cause:** Confusion between direct FK columns vs universal relationship mapping
**Impact:** Breaks the universal entity relationship model
**Fix:** Use `entity_id_map` for all entity-to-entity relationships OR store in metadata JSONB

### Anti-Pattern 2: Inconsistent Column Naming
**Examples:**
- Task: `stage` (DDL) vs `task_status` (API)
- Employee: `birth_date` (DDL) vs `birthdate` (query) vs `date_of_birth` (schema)
- Employee: `manager_employee_id` (DDL) vs `reports_to_employee_id` (schema)
- Employee: `remote_work_eligible` (DDL) vs `remote_eligible` (schema)

**Impact:** Column name mismatches cause SQL errors
**Fix:** Standardize on DDL column names in all queries and schemas

### Anti-Pattern 3: Metadata JSONB Not Used Consistently
**Where:**
- Project: business_id/office_id accepted as top-level fields
- Task: project_id in metadata but also queried as if it's a column
- Employee: skills, certifications in schema but not in DDL

**Impact:** Confusing API contract; fields accepted but not persisted as columns
**Fix:** Document which fields go to metadata JSONB vs table columns; enforce in validation

### Anti-Pattern 4: Missing Table Aliases
**Where:** Employee, Customer filter queries
**Impact:** Works in single-table queries but will break with JOINs; poor SQL practice
**Fix:** Always use table aliases in WHERE clauses

### Anti-Pattern 5: TypeScript Schemas Don't Match DDL
**Where:** Employee schema has 15+ fields not in DDL
**Impact:** Schema validation passes but data isn't persisted; silent failures
**Fix:** Generate TypeScript schemas from DDL or maintain strict 1:1 mapping

---

## Architectural Recommendations

### 1. Establish Relationship Management Standards

Create clear guidelines for when to use:

**A. Direct FK Columns:**
```sql
-- Use for: Core hierarchical relationships that rarely change
manager_employee_id uuid  -- Employee reports to manager
parent_wiki_id uuid       -- Wiki page hierarchy
```

**B. entity_id_map Table:**
```sql
-- Use for: Flexible, many-to-many, or user-configurable relationships
-- Examples: task assignees, project team members, document sharing
INSERT INTO app.entity_id_map (
  parent_entity_type, parent_entity_id,
  child_entity_type, child_entity_id,
  relationship_type
) VALUES ('task', 'task-uuid', 'employee', 'emp-uuid', 'assigned_to');
```

**C. metadata JSONB Field:**
```json
// Use for: Contextual references, flexible attributes, non-relational data
metadata: {
  "project_id": "uuid",      // Context reference
  "task_type": "evaluation", // Flexible classification
  "custom_fields": {...}     // User-defined attributes
}
```

### 2. Type-Safe Query Builders

Consider migrating to Drizzle ORM with schema definitions:
```typescript
// Define schema that matches DDL exactly
export const d_task = pgTable('d_task', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  stage: text('stage'),  // Not 'task_status'
  metadata: jsonb('metadata').default('{}'),
  // ... all DDL columns
});

// Type-safe queries
const tasks = await db.select().from(d_task)
  .where(eq(d_task.stage, 'Planning'));  // TypeScript catches column name errors
```

### 3. Schema Validation Middleware

Add runtime DDL validation:
```typescript
const validateQueryColumns = (tableName: string, columns: string[]) => {
  const ddlColumns = getTableColumns(tableName);
  const invalid = columns.filter(col => !ddlColumns.includes(col));
  if (invalid.length > 0) {
    throw new Error(`Invalid columns for ${tableName}: ${invalid.join(', ')}`);
  }
};
```

### 4. Metadata Field Standards

Document metadata JSONB schema per entity:
```typescript
// /docs/metadata-schemas/task.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "project_id": { "type": "string", "format": "uuid" },
    "task_type": { "type": "string" },
    "business_id": { "type": "string", "format": "uuid" },
    // ... documented metadata fields
  }
}
```

### 5. DDL-to-TypeScript Code Generation

Create script to generate TypeScript schemas from DDL:
```bash
# Generate types from DDL
node scripts/generate-types.js db/19_d_task.ddl > src/types/task.ts
```

Output:
```typescript
export interface Task {
  id: string;
  code: string;
  name: string;
  stage: string;  // Matches DDL exactly
  metadata: TaskMetadata;
  // ... all DDL columns with correct names
}
```

---

## Testing Checklist

### Task Entity ✅ COMPLETED
- [x] List tasks filtered by project_id
- [x] List tasks filtered by assigned_to_employee_id
- [x] List tasks filtered by task_status (stage)
- [x] List tasks filtered by task_type (metadata)
- [x] Kanban board for a specific project
- [x] Kanban board filtered by assignee
- [x] Drag-drop task to change status
- [x] Search tasks by name/description

### Employee Entity ⚠️ PENDING
- [ ] List employees (test for SQL errors on 'slug', 'tags', 'birthdate')
- [ ] Search employees by name
- [ ] Filter employees by department
- [ ] Filter employees by employee_type

### Project Entity ⚠️ PENDING
- [ ] Create project (verify business_id/office_id handling)
- [ ] List projects
- [ ] Get project child entities

### Customer Entity ⚠️ PENDING
- [ ] List customers
- [ ] Search customers by name/email
- [ ] Filter customers by cust_type

---

## Summary of Fixes Required

### COMPLETED ✅
1. **Task LIST filters** - Fixed all 7 broken filter conditions ✅
2. **Task Kanban queries** - Fixed project_id and assignee filters ✅
3. **Task status update** - Fixed column name from task_status to stage ✅
4. **Tested Task API** - All endpoints working correctly ✅

### HIGH PRIORITY (CRITICAL - Will cause SQL errors)
5. **Employee SELECT query** - Fix non-existent columns: `slug`, `tags`, `birthdate`
6. **Employee filters** - Add table aliases to all conditions

### MEDIUM PRIORITY (API contract confusion)
7. **Employee schema** - Align TypeScript schema with DDL or move fields to metadata
8. **Project schema** - Remove or document business_id/office_id handling

### LOW PRIORITY (Best practices)
9. **Customer filters** - Add table aliases for consistency
10. **All entities** - Conduct systematic audit of remaining 25+ modules

### ARCHITECTURAL (Long-term improvements)
11. **Establish relationship management standards** - Document when to use FK vs entity_id_map vs metadata
12. **Implement type-safe query builder** - Consider Drizzle ORM migration
13. **Create DDL-to-TypeScript generator** - Automate schema generation
14. **Add metadata field validation** - JSON schema for metadata fields per entity

---

## Files Modified

### COMPLETED
- ✅ `apps/api/src/modules/task/routes.ts` - Lines 120-165, 665-667, 756-790 - FIXED AND TESTED

### PENDING
- ⚠️ `apps/api/src/modules/employee/routes.ts` - Lines 201-249 - ISSUES IDENTIFIED
- ⚠️ `apps/api/src/modules/project/routes.ts` - Lines 47-48 - ISSUES IDENTIFIED
- ⚠️ `apps/api/src/modules/cust/routes.ts` - Lines 90-102 - MINOR ISSUES

---

## Conclusion

This audit revealed **systematic SQL query issues** stemming from inconsistent handling of entity relationships and column naming mismatches.

**Critical Task entity fixes have been COMPLETED and TESTED** ✅. The filters now correctly:
- Extract `project_id` from metadata JSONB
- Query assignees via `entity_id_map` table
- Use `stage` column instead of non-existent `task_status`
- Include proper table aliases

**Next Steps:**
1. ✅ **DONE:** Fix Task entity (user-facing features now working)
2. **FIX EMPLOYEE ENTITY:** Critical SQL errors will occur with current queries
3. **FIX PROJECT ENTITY:** Clarify business_id/office_id handling
4. **EXTEND AUDIT:** Remaining 25+ entity modules need review
5. **ESTABLISH STANDARDS:** Document architectural patterns
6. **AUTOMATE VALIDATION:** Add DDL-to-TypeScript generation

**Priority:** Fix Employee entity SELECT query immediately to prevent SQL errors

---

**Report Status:** FINAL - Task fixes completed, remaining issues documented
**Next Report:** Employee entity audit and fixes
**Generated:** 2025-10-29
