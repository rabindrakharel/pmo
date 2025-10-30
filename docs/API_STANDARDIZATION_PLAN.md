# API Standardization Plan - DDL as Source of Truth

**Date:** 2025-10-29
**Principle:** DDL schema definitions are the single source of truth for all API implementations

---

## Executive Summary

Based on the comprehensive audit, the following API-related fixes can be made to align with DDL definitions:

1. **Query Parameter Standardization** - Align filter param names with DDL columns
2. **API Response Field Naming** - Match DDL column names exactly
3. **TypeScript Schema Alignment** - Remove/document fields not in DDL
4. **Consistent Filter Patterns** - Standardize across all entities
5. **Table Alias Enforcement** - Add to all remaining entities
6. **Metadata Field Documentation** - Clarify what goes in JSONB vs columns

---

## Category 1: Query Parameter Standardization

### Issue
Query parameters use different names than DDL columns, creating confusion.

### Examples from Audit

**Task Entity:**
```typescript
// CURRENT (Inconsistent):
GET /api/v1/task?task_status=Planning  // Param: task_status
// DDL column: stage

// SHOULD BE (Aligned with DDL):
GET /api/v1/task?stage=Planning  // Param matches column name
```

**Employee Entity:**
```typescript
// CURRENT:
GET /api/v1/employee?active_flag=true  // ✅ Matches DDL
GET /api/v1/employee?employee_type=full-time  // ✅ Matches DDL
GET /api/v1/employee?remote_work_eligible=true  // ✅ Matches DDL
// These are already correct!
```

### Fixes Required

#### Fix 1.1: Task Query Parameters
**File:** `apps/api/src/modules/task/routes.ts`

**Current:**
```typescript
schema: {
  querystring: Type.Object({
    task_status: Type.Optional(Type.String()),  // ❌ Should be 'stage'
    // ...
  })
}
```

**Fixed:**
```typescript
schema: {
  querystring: Type.Object({
    stage: Type.Optional(Type.String()),  // ✅ Matches DDL column
    // Keep task_status as deprecated alias for backwards compatibility
    task_status: Type.Optional(Type.String()),  // @deprecated Use 'stage'
    // ...
  })
}

// In handler:
const stage = request.query.stage || request.query.task_status;
if (stage !== undefined) {
  conditions.push(sql`t.stage = ${stage}`);
}
```

**Benefits:**
- API parameter names match DDL exactly
- Self-documenting (developers know which column is being filtered)
- Backwards compatible with deprecation path

---

## Category 2: API Response Field Naming

### Issue
API responses sometimes use different field names than DDL columns.

### Current State (Already Fixed)
Based on test results, responses already return DDL column names:
```json
{
  "stage": "Planning",           // ✅ DDL column name
  "birth_date": "1980-01-01",    // ✅ DDL column name (not birthdate)
  "active_flag": true,           // ✅ DDL column name
  "metadata": {...}              // ✅ DDL column name
}
```

**No fixes needed** - Responses already aligned ✅

---

## Category 3: TypeScript Schema Alignment with DDL

### Issue
TypeScript schemas define fields that don't exist as DDL columns, creating confusion.

### Employee Entity Schema Problems

**File:** `apps/api/src/modules/employee/routes.ts:13-66`

**Current Schema (Has 15+ non-DDL fields):**
```typescript
const EmployeeSchema = Type.Object({
  // ✅ These exist in DDL:
  id: Type.String(),
  name: Type.String(),
  employee_number: Type.String(),
  email: Type.String(),
  phone: Type.Optional(Type.String()),
  first_name: Type.String(),
  last_name: Type.String(),
  hire_date: Type.String(),
  termination_date: Type.Optional(Type.String()),
  employee_type: Type.String(),
  manager_employee_id: Type.Optional(Type.String()),

  // ❌ These DON'T exist in DDL:
  preferred_name: Type.Optional(Type.String()),           // Not in DDL
  date_of_birth: Type.Optional(Type.String()),            // DDL has birth_date
  employment_status: Type.String(),                       // Not in DDL
  hr_position_id: Type.Optional(Type.String()),           // Not in DDL
  primary_org_id: Type.Optional(Type.String()),           // Not in DDL
  reports_to_employee_id: Type.Optional(Type.String()),   // DDL has manager_employee_id
  salary_annual: Type.Optional(Type.Number()),            // DDL has salary_band (text)
  hourly_rate: Type.Optional(Type.Number()),              // Not in DDL
  overtime_eligible: Type.Optional(Type.Boolean()),       // Not in DDL
  benefits_eligible: Type.Optional(Type.Boolean()),       // Not in DDL
  certifications: Type.Array(Type.Any()),                 // Should be in metadata
  skills: Type.Array(Type.Any()),                         // Should be in metadata
  languages: Type.Array(Type.String()),                   // Not in DDL
  education_level: Type.Optional(Type.String()),          // Not in DDL
  remote_eligible: Type.Optional(Type.Boolean()),         // DDL has remote_work_eligible
  travel_required: Type.Optional(Type.Boolean()),         // Not in DDL
  security_clearance: Type.Optional(Type.String()),       // ✅ Exists in DDL
  emergency_contact: Type.Object({}),                     // DDL has emergency_contact_name + phone
});
```

**DDL Reality** (`db/11_d_employee.ddl:99-162`):
```sql
CREATE TABLE app.d_employee (
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

  -- Employee-specific fields
  employee_number varchar(50) UNIQUE,
  email varchar(255) UNIQUE NOT NULL,
  password_hash varchar(255),
  first_name varchar(100),
  last_name varchar(100),

  -- Contact information
  phone varchar(20),
  mobile varchar(20),
  emergency_contact_name varchar(200),
  emergency_contact_phone varchar(20),

  -- Address information
  address_line1 varchar(200),
  address_line2 varchar(200),
  city varchar(100),
  province varchar(100),
  postal_code varchar(20),
  country varchar(100) DEFAULT 'Canada',

  -- Employment details
  employee_type varchar(50) DEFAULT 'full-time',
  department varchar(100),
  title varchar(200),
  hire_date date,
  termination_date date,

  -- Compensation and HR
  salary_band varchar(50),
  pay_grade varchar(20),
  manager_employee_id uuid,

  -- Authentication and security
  last_login_ts timestamptz,
  password_reset_token varchar(255),
  password_reset_expires_ts timestamptz,
  failed_login_attempts integer DEFAULT 0,
  account_locked_until_ts timestamptz,

  -- Compliance and tracking
  sin varchar(20),
  birth_date date,
  citizenship varchar(100),
  security_clearance varchar(50),

  -- Work preferences and attributes
  remote_work_eligible boolean DEFAULT false,
  time_zone varchar(50) DEFAULT 'America/Toronto',
  preferred_language varchar(10) DEFAULT 'en'
);
```

### Fix 3.1: Align Employee Schema with DDL

**Option A: Strict Alignment (Recommended)**
```typescript
// Only include fields that exist as DDL columns
const EmployeeSchema = Type.Object({
  // Standard fields
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  metadata: Type.Object({}),
  active_flag: Type.Boolean(),
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Number(),

  // Employee identification
  employee_number: Type.String(),
  email: Type.String(),
  password_hash: Type.Optional(Type.String()),  // Never returned in GET
  first_name: Type.String(),
  last_name: Type.String(),

  // Contact information (MATCH DDL EXACTLY)
  phone: Type.Optional(Type.String()),
  mobile: Type.Optional(Type.String()),
  emergency_contact_name: Type.Optional(Type.String()),
  emergency_contact_phone: Type.Optional(Type.String()),

  // Address information (MATCH DDL EXACTLY)
  address_line1: Type.Optional(Type.String()),
  address_line2: Type.Optional(Type.String()),
  city: Type.Optional(Type.String()),
  province: Type.Optional(Type.String()),
  postal_code: Type.Optional(Type.String()),
  country: Type.Optional(Type.String()),

  // Employment details (MATCH DDL EXACTLY)
  employee_type: Type.String(),
  department: Type.Optional(Type.String()),
  title: Type.Optional(Type.String()),
  hire_date: Type.Optional(Type.String()),
  termination_date: Type.Optional(Type.String()),

  // Compensation and HR (MATCH DDL EXACTLY)
  salary_band: Type.Optional(Type.String()),
  pay_grade: Type.Optional(Type.String()),
  manager_employee_id: Type.Optional(Type.String()),

  // Authentication and security (MATCH DDL EXACTLY)
  last_login_ts: Type.Optional(Type.String()),
  failed_login_attempts: Type.Optional(Type.Number()),
  account_locked_until_ts: Type.Optional(Type.String()),

  // Compliance and tracking (MATCH DDL EXACTLY)
  sin: Type.Optional(Type.String()),
  birth_date: Type.Optional(Type.String()),  // ✅ NOT date_of_birth
  citizenship: Type.Optional(Type.String()),
  security_clearance: Type.Optional(Type.String()),

  // Work preferences (MATCH DDL EXACTLY)
  remote_work_eligible: Type.Optional(Type.Boolean()),  // ✅ NOT remote_eligible
  time_zone: Type.Optional(Type.String()),
  preferred_language: Type.Optional(Type.String()),
});

// For flexible fields, document in metadata schema
interface EmployeeMetadata {
  tags?: string[];
  skills?: Array<{name: string, level: string}>;
  certifications?: Array<{name: string, expiry_date: string}>;
  hr_position_id?: string;  // If needed, store in metadata
  primary_org_id?: string;  // If needed, store in metadata
}
```

**Option B: Backwards Compatible (Deprecated Fields)**
```typescript
const EmployeeSchema = Type.Object({
  // ... all DDL fields as above ...

  // @deprecated - Use manager_employee_id instead
  reports_to_employee_id: Type.Optional(Type.String()),

  // @deprecated - Use birth_date instead
  date_of_birth: Type.Optional(Type.String()),

  // @deprecated - Use remote_work_eligible instead
  remote_eligible: Type.Optional(Type.Boolean()),
});
```

### Fix 3.2: Project Schema - Document Metadata Pattern

**Current Schema:**
```typescript
const CreateProjectSchema = Type.Object({
  name: Type.String(),
  code: Type.String(),
  business_id: Type.Optional(Type.String()),  // ❌ Not a DDL column
  office_id: Type.Optional(Type.String()),     // ❌ Not a DDL column
  // ...
});
```

**Fixed (Document Pattern):**
```typescript
const CreateProjectSchema = Type.Object({
  name: Type.String(),
  code: Type.String(),

  // These are automatically moved to metadata JSONB by the handler
  // See DDL comment: "Project relationships to parent entity are managed via entity_id_map"
  business_id: Type.Optional(Type.String()),  // Stored in metadata.business_id
  office_id: Type.Optional(Type.String()),    // Stored in metadata.office_id

  // Explicitly allow metadata object
  metadata: Type.Optional(Type.Object({
    business_id: Type.Optional(Type.String()),
    office_id: Type.Optional(Type.String()),
    project_type: Type.Optional(Type.String()),
    priority: Type.Optional(Type.String()),
    // ... other flexible fields
  })),

  // ... actual DDL columns
  project_stage: Type.Optional(Type.String()),
  budget_allocated_amt: Type.Optional(Type.Number()),
  // ...
});
```

---

## Category 4: Consistent Filter Pattern Enforcement

### Issue
Some entities have table aliases, some don't. Need consistency across all entities.

### Entities Already Fixed ✅
- Task: Uses `t.` alias
- Employee: Uses `e.` alias
- Customer: Uses `c.` alias
- Project: Uses `p.` alias (to be verified)

### Entities Needing Fixes

**Office, Business, Worksite, Wiki, Artifact, Form, Role, Position, Reports**

### Standard Filter Pattern Template

```typescript
// Standard pattern for all entities:
fastify.get('/api/v1/{entity}', async (request, reply) => {
  const { active, search, limit = 50, offset = 0, /* entity-specific filters */ } = request.query;

  const conditions = [];

  // 1. Active flag filter (if exists in DDL)
  if (active !== undefined) {
    conditions.push(sql`e.active_flag = ${active}`);  // Use table alias
  }

  // 2. Search filter (searchable columns from DDL)
  if (search) {
    const searchConditions = [
      sql`COALESCE(e.name, '') ILIKE ${`%${search}%`}`,
      sql`COALESCE(e."descr", '') ILIKE ${`%${search}%`}`,
      sql`COALESCE(e.code, '') ILIKE ${`%${search}%`}`,
      // Add other searchable DDL columns
    ];
    conditions.push(sql`(${sql.join(searchConditions, sql` OR `)})`);
  }

  // 3. Entity-specific filters (only DDL columns or metadata fields)
  // Examples:
  // - Direct column: if (status) conditions.push(sql`e.status = ${status}`);
  // - Metadata field: if (type) conditions.push(sql`e.metadata->>'type' = ${type}`);
  // - Relationship: if (parent_id) conditions.push(sql`e.parent_id = ${parent_id}::uuid`);

  // 4. Execute query with table alias
  const results = await db.execute(sql`
    SELECT e.* FROM app.d_{entity} e
    ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
    ORDER BY e.name ASC NULLS LAST
    LIMIT ${limit} OFFSET ${offset}
  `);
});
```

---

## Category 5: Metadata Field Standardization

### Issue
Inconsistent patterns for storing flexible fields (some in metadata, some attempted as columns).

### Solution: Document Metadata Schemas Per Entity

**Create:** `docs/metadata-schemas/`

#### Example: Task Metadata Schema

**File:** `docs/metadata-schemas/task.md`
```markdown
# Task Metadata Schema

Fields stored in `d_task.metadata` JSONB column:

## Relationship References
- `project_id` (uuid) - Parent project UUID
- `business_id` (uuid) - Associated business unit
- `office_id` (uuid) - Associated office location
- `worksite_id` (uuid) - Associated worksite
- `client_id` (uuid) - Associated customer

## Task Classification
- `task_type` (string) - Type of task (evaluation, research, design, etc.)
- `task_category` (string) - Category classification
- `deliverable` (string) - Expected deliverable description

## Kanban Board
- `kanban_position` (number) - Position within stage column
- `kanban_moved_at` (timestamp) - Last time moved
- `kanban_moved_by` (uuid) - Employee who moved it

## Custom Fields
- Any additional fields can be added by API consumers
```

#### Example: Employee Metadata Schema

**File:** `docs/metadata-schemas/employee.md`
```markdown
# Employee Metadata Schema

Fields stored in `d_employee.metadata` JSONB column:

## Tags and Classification
- `tags` (array<string>) - Employee tags for filtering/grouping

## Skills and Qualifications
- `skills` (array<object>) - Employee skills
  - `name` (string) - Skill name
  - `level` (string) - Proficiency level
  - `years_experience` (number) - Years of experience
- `certifications` (array<object>) - Professional certifications
  - `name` (string) - Certification name
  - `issuer` (string) - Issuing organization
  - `issue_date` (date) - Date obtained
  - `expiry_date` (date) - Expiration date

## Organizational Context (if not using entity_id_map)
- `hr_position_id` (uuid) - HR system position reference
- `primary_org_id` (uuid) - Primary organizational unit

## Preferences and Settings
- `notification_methods` (array<string>) - Preferred notification channels
- `work_hours` (object) - Preferred working hours
  - `start` (string) - Start time
  - `end` (string) - End time
- `signature` (string) - Email signature

## Authority and Permissions
- `authority_levels` (object) - Spending/approval authorities
  - `budget_authority` (string) - Budget approval level
  - `hiring_authority` (string) - Hiring decision level
  - `approval_limit_amt` (number) - Financial approval limit
```

---

## Category 6: Query Parameter Validation Against DDL

### Issue
No runtime validation that query parameters match DDL columns.

### Solution: Add Validation Middleware

**File:** `apps/api/src/lib/ddl-column-validator.ts` (NEW)
```typescript
import { sql } from 'drizzle-orm';

// DDL column definitions (can be auto-generated from DDL files)
const DDL_COLUMNS: Record<string, string[]> = {
  d_task: [
    'id', 'code', 'name', 'descr', 'metadata', 'active_flag',
    'from_ts', 'to_ts', 'created_ts', 'updated_ts', 'version',
    'internal_url', 'shared_url', 'stage', 'priority_level',
    'estimated_hours', 'actual_hours', 'story_points'
  ],
  d_employee: [
    'id', 'code', 'name', 'descr', 'metadata', 'active_flag',
    'from_ts', 'to_ts', 'created_ts', 'updated_ts', 'version',
    'employee_number', 'email', 'password_hash', 'first_name', 'last_name',
    'phone', 'mobile', 'emergency_contact_name', 'emergency_contact_phone',
    'address_line1', 'address_line2', 'city', 'province', 'postal_code', 'country',
    'employee_type', 'department', 'title', 'hire_date', 'termination_date',
    'salary_band', 'pay_grade', 'manager_employee_id',
    'last_login_ts', 'failed_login_attempts', 'account_locked_until_ts',
    'sin', 'birth_date', 'citizenship', 'security_clearance',
    'remote_work_eligible', 'time_zone', 'preferred_language'
  ],
  // ... other entities
};

// Metadata fields (documented, not validated against DDL)
const METADATA_FIELDS: Record<string, string[]> = {
  task: ['project_id', 'business_id', 'office_id', 'worksite_id', 'client_id', 'task_type', 'task_category'],
  employee: ['tags', 'skills', 'certifications', 'hr_position_id', 'primary_org_id'],
  // ... other entities
};

export function validateFilterParams(
  table: string,
  entityType: string,
  filterParams: Record<string, any>
): { valid: boolean; invalidFields: string[]; warnings: string[] } {
  const validColumns = DDL_COLUMNS[table] || [];
  const validMetadata = METADATA_FIELDS[entityType] || [];

  const invalidFields: string[] = [];
  const warnings: string[] = [];

  for (const param of Object.keys(filterParams)) {
    // Skip pagination params
    if (['limit', 'offset', 'page', 'search', 'active'].includes(param)) continue;

    // Check if it's a DDL column
    if (validColumns.includes(param)) continue;

    // Check if it's a known metadata field
    if (validMetadata.includes(param)) {
      warnings.push(`Filter '${param}' uses metadata field - ensure index exists for performance`);
      continue;
    }

    // Unknown field
    invalidFields.push(param);
  }

  return {
    valid: invalidFields.length === 0,
    invalidFields,
    warnings
  };
}
```

**Usage in routes:**
```typescript
fastify.get('/api/v1/task', async (request, reply) => {
  const validation = validateFilterParams('d_task', 'task', request.query);

  if (!validation.valid) {
    return reply.status(400).send({
      error: 'Invalid filter parameters',
      invalidFields: validation.invalidFields,
      hint: 'Use DDL column names or documented metadata fields'
    });
  }

  if (validation.warnings.length > 0) {
    fastify.log.warn('Filter warnings:', validation.warnings);
  }

  // Continue with query...
});
```

---

## Implementation Priority

### Phase 1: Critical (Immediate) ✅ DONE
- [x] Fix Task filter column references
- [x] Fix Employee SELECT non-existent columns
- [x] Fix Project business_id/office_id handling
- [x] Add table aliases to Customer

### Phase 2: High Priority (This Round)
1. **Standardize Query Parameters**
   - Rename `task_status` → `stage` (with backwards compatibility)
   - Document deprecated parameters

2. **Align TypeScript Schemas with DDL**
   - Fix Employee schema (remove 15 non-DDL fields)
   - Document which fields go to metadata

3. **Add Table Aliases to Remaining Entities**
   - Office, Business, Worksite
   - Wiki, Artifact, Form
   - Role, Position

### Phase 3: Medium Priority (Next Sprint)
4. **Create Metadata Schema Documentation**
   - Document each entity's metadata structure
   - Add JSON schema validation

5. **Add DDL Column Validator**
   - Runtime validation middleware
   - Development-time warnings

### Phase 4: Low Priority (Future Enhancement)
6. **Auto-generate TypeScript from DDL**
   - Script to parse DDL files
   - Generate matching TypeScript interfaces

7. **Migrate to Drizzle ORM**
   - Type-safe queries
   - Compile-time column validation

---

## Summary of Actionable Fixes

### Immediate Actions (Can Do Now)

1. **Align Employee TypeScript Schema** - Remove non-DDL fields
2. **Rename task_status Parameter** - Use `stage` (DDL name)
3. **Add Table Aliases** - Office, Business, Worksite, Wiki, Artifact, Form entities
4. **Create Metadata Documentation** - Document JSONB schema per entity
5. **Add Query Validation** - Warn on non-DDL filter parameters

All changes maintain backwards compatibility while improving API consistency.

---

**Next Steps:**
1. Review and approve this plan
2. Apply fixes systematically (one entity at a time)
3. Test each change
4. Update API documentation
