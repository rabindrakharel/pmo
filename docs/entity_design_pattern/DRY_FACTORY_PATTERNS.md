# DRY Patterns & Factory Functions - Complete Reference

**Purpose:** Comprehensive guide to all reusable DRY (Don't Repeat Yourself) patterns and factory functions that eliminate code duplication across the platform.

**Last Updated:** 2025-01-11
**Architecture Version:** 3.1

---

## Table of Contents

1. [Frontend Column Generation Patterns](#1-frontend-column-generation-patterns)
2. [Frontend Field Generation Patterns](#2-frontend-field-generation-patterns)
3. [Field Category Registry](#3-field-category-registry)
4. [Settings & Options Loader](#4-settings--options-loader)
5. [Backend Route Factory Patterns](#5-backend-route-factory-patterns)
6. [API Client Factory Pattern](#6-api-client-factory-pattern)
7. [Usage Examples](#7-usage-examples)
8. [Pattern Selection Guide](#8-pattern-selection-guide)

---

## 1. Frontend Column Generation Patterns

**Location:** `apps/web/src/lib/columnGenerator.ts`

### Pattern: `generateStandardColumns()`

**Purpose:** Auto-generates complete column definitions from field keys with zero manual configuration.

**Features:**
- ✅ Auto-detects field category from key pattern
- ✅ Applies width, alignment, sortable, filterable, render function
- ✅ Controls visibility (system fields hidden, FK columns hidden)
- ✅ Auto-generates entity name columns for FK columns
- ✅ Ensures standard fields (name, code, descr) appear first
- ✅ Filters out system columns (id, timestamps, version, etc.)

**Signature:**
```typescript
function generateStandardColumns(
  fieldKeys: string[],
  options?: ColumnGenerationOptions
): ColumnDef[]

interface ColumnGenerationOptions {
  overrides?: Record<string, Partial<ColumnDef>>;
}
```

**Column Properties Auto-Generated:**
```typescript
interface ColumnDef {
  key: string;              // Field key from database
  title: string;            // Auto-generated human-readable title
  sortable: boolean;        // From field category
  filterable: boolean;      // From field category
  align: 'left'|'center'|'right'; // From field category
  width: string;            // From field category (e.g., '300px')
  visible: boolean;         // Auto-set based on column type
  render?: (value, record) => ReactNode; // From field category
  loadOptionsFromSettings?: boolean; // For dl__* fields
}
```

**Auto-Visibility Rules:**
- `visible=false`: Primary keys (id), Foreign keys (*_id), System fields (created_ts, updated_ts, version, from_ts, to_ts, active_flag)
- `visible=true`: All other columns (default)

**Foreign Key Intelligence:**
- Detects: `*_id` pattern (project_id, task_id, employee_id, etc.)
- Action: Marks FK column as `visible=false` (data fetched but hidden)
- Auto-generates: `*_name` column with `visible=true` (shows entity.name lookup)
- Handles complex patterns: `manager_employee_id` → extracts "employee" → generates `employee_name`

**Basic Usage:**
```typescript
// Input: Just field keys from database schema
columns: generateStandardColumns([
  'name', 'code', 'descr', 'project_id', 'dl__task_stage', 'budget_allocated_amt'
])

// Output: 7 auto-generated columns with all properties
// 1. name (visible, 300px, left, sortable, filterable)
// 2. code (visible, 150px, left, sortable, filterable)
// 3. descr (visible, 400px, left, sortable, filterable)
// 4. project_id (INVISIBLE, for API relationships)
// 5. project_name (AUTO-ADDED, visible, shows d_project.name)
// 6. dl__task_stage (visible, loadOptionsFromSettings, colored badge)
// 7. budget_allocated_amt (visible, currency render, right-align)
```

**With Overrides:**
```typescript
columns: generateStandardColumns(
  ['name', 'budget_allocated_amt', 'budget_spent_amt'],
  {
    overrides: {
      budget_allocated_amt: {
        title: 'Budget',
        render: (v, r) => formatCurrency(v, r.budget_currency)
      }
    }
  }
)
```

**Recognized Entity Types (for FK resolution):**
- employee, project, task, client, customer, cust
- office, business, biz, supplier, product, service
- artifact, wiki, form, event, calendar

---

## 2. Frontend Field Generation Patterns

**Location:** `apps/web/src/lib/fieldGenerator.ts`

### Pattern: `generateEntityFields()`

**Purpose:** Auto-generates form field definitions from field keys.

**Features:**
- ✅ Detects field type from key pattern
- ✅ Auto-configures text, textarea, select, date inputs
- ✅ Links dl__* fields to settings tables
- ✅ Provides validation rules
- ✅ Sets required/readonly flags

**Signature:**
```typescript
function generateEntityFields(
  fieldKeys: string[],
  options?: FieldGenerationOptions
): FieldDef[]

interface FieldDef {
  key: string;
  label: string;
  type: 'text'|'textarea'|'richtext'|'number'|'date'|'select'|'multiselect'|'jsonb'|'array';
  required?: boolean;
  readonly?: boolean;
  loadOptionsFromSettings?: boolean;
  loadOptionsFromEntity?: string;
}
```

**Usage:**
```typescript
fields: generateEntityFields([
  'name', 'code', 'descr', 'dl__project_stage', 'budget_allocated_amt'
])

// Auto-generates:
// - name: text input, required
// - code: text input
// - descr: textarea
// - dl__project_stage: select with options from setting_project_stage
// - budget_allocated_amt: number input, currency format
```

---

## 3. Field Category Registry

**Location:** `apps/web/src/lib/fieldCategoryRegistry.ts`

### Pattern: Field Category System

**Purpose:** Single source of truth for ALL field properties based on name patterns.

**Categories:**
```typescript
enum FieldCategory {
  NAME,           // name, title → 300px, left, sortable, filterable
  CODE,           // code → 150px, left, sortable, filterable
  DESCR,          // descr, description → 400px, left, sortable, filterable
  AMOUNT,         // *_amt, *_amount → 120px, right, currency render
  CURRENCY,       // *_currency → 100px, center
  PERCENTAGE,     // *_pct, *_percent → 100px, right, percentage render
  NUMBER,         // *_count, *_hours, *_quantity → 100px, right
  DATE,           // *_date → 120px, center, date render
  TIMESTAMP,      // *_ts, *_timestamp → 180px, left, relative time render
  LABEL,          // *_stage, *_status, *_priority → 150px, colored badge, loadOptionsFromSettings
  ENTITY_REF,     // *_id → FK handling, invisible
  JSON,           // metadata, attr, *_json → JSONB viewer
  ARRAY,          // tags, *_ids, *_list → tag renderer
  LONG_TEXT,      // content, notes, body → textarea
  BOOLEAN,        // *_flag, is_*, has_*, can_* → checkbox
  ID,             // id → primary key, invisible
  URL,            // *_url, *_link → link renderer
  EMAIL,          // *_email → email validation
  UNKNOWN         // default fallback
}
```

**Pattern Matching Rules:**
```typescript
// Examples of auto-detection:
'name'                  → NAME category → 300px, left-align
'budget_allocated_amt'  → AMOUNT category → 120px, right-align, currency render
'dl__task_stage'        → LABEL category → colored badge, dropdown
'created_ts'            → TIMESTAMP category → relative time ("3 days ago")
'project_id'            → ENTITY_REF category → invisible, FK handling
'tags'                  → ARRAY category → tag renderer
'active_flag'           → BOOLEAN category → checkbox (but hidden as system field)
```

**Functions:**
```typescript
// Get all properties for a field
getCategoryProperties(fieldKey: string): FieldCategoryConfig

// Generate human-readable title
generateFieldTitle(fieldKey: string): string
// Examples:
// 'name' → 'Name'
// 'dl__task_stage' → 'Task Stage'
// 'budget_allocated_amt' → 'Budget Allocated Amount'
// 'manager_employee_id' → 'Manager Employee'
```

---

## 4. Settings & Options Loader

**Location:** `apps/web/src/lib/settingsLoader.ts`

### Pattern: Dynamic Dropdown Options

**Purpose:** Loads dropdown options from settings tables at runtime.

**API Endpoint:**
```
GET /api/v1/entity/:type/options
```

**Response Format:**
```typescript
{
  "dl__project_stage": [
    { value: 'planning', label: 'Planning', color_code: '#3B82F6' },
    { value: 'active', label: 'Active', color_code: '#10B981' },
    { value: 'completed', label: 'Completed', color_code: '#6B7280' }
  ],
  "dl__project_priority": [
    { value: 'high', label: 'High', color_code: '#EF4444' },
    { value: 'medium', label: 'Medium', color_code: '#F59E0B' },
    { value: 'low', label: 'Low', color_code: '#6B7280' }
  ]
}
```

**Usage in Columns:**
```typescript
{
  key: 'dl__project_stage',
  loadOptionsFromSettings: true  // Auto-fetches from API
}
```

**Caching:**
- Options cached per entity type
- Cache cleared on entity type change
- Avoids redundant API calls

**Settings Table Pattern:**
```sql
-- Example: setting_project_stage
CREATE TABLE app.setting_project_stage (
  code varchar(50) PRIMARY KEY,
  ui_label varchar(100),
  color_code varchar(7),
  display_order int
);
```

---

## 5. Backend Route Factory Patterns

**Location:** `apps/api/src/lib/*.ts`

### Pattern 5.1: `createChildEntityEndpoint()`

**File:** `apps/api/src/lib/child-entity-route-factory.ts`

**Purpose:** Generates GET routes for parent-child entity relationships.

**Signature:**
```typescript
function createChildEntityEndpoint(
  fastify: FastifyInstance,
  parentEntity: string,
  childEntity: string,
  childTable: string
): void
```

**What It Generates:**
```
GET /api/v1/{parent}/:id/{child}
```

**Example:**
```typescript
// One-liner generates complete endpoint
createChildEntityEndpoint(fastify, 'project', 'task', 'd_task');

// Creates: GET /api/v1/project/:id/task
// With: RBAC checks, pagination, d_entity_instance_link joins, error handling
```

**Generated Features:**
- ✅ RBAC permission checks (hasPermissionOnEntityId)
- ✅ Pagination support (limit, offset, page)
- ✅ Joins via d_entity_instance_link
- ✅ Active flag filtering
- ✅ Error handling
- ✅ Count queries
- ✅ Sorted results

**Before (Manual - 80+ lines):**
```typescript
fastify.get('/api/v1/project/:id/task', async (request, reply) => {
  // RBAC check
  // Pagination parsing
  // Build query with joins
  // Execute count query
  // Execute data query
  // Error handling
  // Response formatting
});
```

**After (Factory - 1 line):**
```typescript
createChildEntityEndpoint(fastify, 'project', 'task', 'd_task');
```

---

### Pattern 5.2: `createEntityDeleteEndpoint()`

**File:** `apps/api/src/lib/entity-delete-route-factory.ts`

**Purpose:** Generates DELETE routes with cascading cleanup.

**Signature:**
```typescript
function createEntityDeleteEndpoint(
  fastify: FastifyInstance,
  entityType: string
): void
```

**What It Generates:**
```
DELETE /api/v1/{entity}/:id
```

**Example:**
```typescript
// One-liner generates complete delete endpoint
createEntityDeleteEndpoint(fastify, 'task');

// Creates: DELETE /api/v1/task/:id
// With: Soft delete + cascading cleanup of linkages
```

**Cascading Cleanup:**
1. Soft-deletes main entity (active_flag=false, to_ts=now())
2. Removes from d_entity_instance_registry registry
3. Removes parent linkages in d_entity_instance_link (where child_entity_id)
4. Removes child linkages in d_entity_instance_link (where parent_entity_id)

**Before (Manual - 60+ lines):**
```typescript
fastify.delete('/api/v1/task/:id', async (request, reply) => {
  // RBAC check
  // Soft delete main entity
  // Delete from registry
  // Delete parent linkages
  // Delete child linkages
  // Transaction handling
  // Error handling
});
```

**After (Factory - 1 line):**
```typescript
createEntityDeleteEndpoint(fastify, 'task');
```

---

## 6. API Client Factory Pattern

**Location:** `apps/web/src/lib/api-factory.ts`

### Pattern: `APIFactory.getAPI()`

**Purpose:** Type-safe API client generation for all entity types.

**Signature:**
```typescript
class APIFactory {
  static getAPI(entityType: string): EntityAPI;
}

interface EntityAPI {
  list(params?: ListParams): Promise<PaginatedResponse<any>>;
  get(id: string): Promise<any>;
  create(data: any): Promise<any>;
  update(id: string, data: any): Promise<any>;
  delete(id: string): Promise<void>;
}
```

**Usage:**
```typescript
// Before (unsafe dynamic access):
const apiModule = (api as any)[`${entityType}Api`];
const response = await apiModule.list({ page: 1 });

// After (type-safe factory):
const taskApi = APIFactory.getAPI('task');
const tasks = await taskApi.list({ page: 1, limit: 20 });
const task = await taskApi.get(taskId);
await taskApi.update(taskId, { status: 'COMPLETED' });
```

**Benefits:**
- ✅ Compile-time type checking
- ✅ Consistent API interface across all entities
- ✅ No runtime errors from typos
- ✅ IDE autocomplete support

---

## 7. Usage Examples

### Example 7.1: Adding a New Entity (Complete)

**Step 1: Create DDL file**
```sql
-- db/d_invoice.ddl
CREATE TABLE app.d_invoice (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) UNIQUE NOT NULL,
  name varchar(200) NOT NULL,
  descr text,
  project_id uuid,  -- FK to project
  client_id uuid,   -- FK to client
  dl__invoice_status varchar(50),  -- Settings-driven status
  invoice_amt numeric(15,2),
  invoice_date date,
  due_date date,
  paid_date date,
  from_ts timestamptz DEFAULT now(),
  to_ts timestamptz,
  active_flag boolean DEFAULT true,
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now(),
  version integer DEFAULT 1
);
```

**Step 2: Create API module (minimal)**
```typescript
// apps/api/src/modules/invoice/routes.ts
export async function invoiceRoutes(fastify: FastifyInstance) {
  // List invoices
  fastify.get('/api/v1/invoice', { /* auth */ }, async (request, reply) => {
    // Standard list endpoint with RBAC
  });

  // Get single invoice
  fastify.get('/api/v1/invoice/:id', { /* auth */ }, async (request, reply) => {
    // Standard get endpoint
  });

  // Create invoice
  fastify.post('/api/v1/invoice', { /* auth */ }, async (request, reply) => {
    // Standard create endpoint
  });

  // Update invoice
  fastify.put('/api/v1/invoice/:id', { /* auth */ }, async (request, reply) => {
    // Standard update endpoint
  });

  // Delete invoice (using factory!)
  createEntityDeleteEndpoint(fastify, 'invoice');

  // Child entities (using factory!)
  createChildEntityEndpoint(fastify, 'invoice', 'payment', 'd_payment');
  createChildEntityEndpoint(fastify, 'invoice', 'artifact', 'd_artifact');
}
```

**Step 3: Create entity config (MINIMAL CODE!)**
```typescript
// apps/web/src/config/entityConfigs.ts
export const entityConfigs = {
  // ... other entities

  invoice: {
    name: 'invoice',
    displayName: 'Invoice',
    pluralName: 'Invoices',
    apiEndpoint: '/api/v1/invoice',

    // THAT'S IT! One line generates all columns:
    columns: generateStandardColumns([
      'name', 'code', 'descr',
      'project_id',          // Auto-generates project_name column
      'client_id',           // Auto-generates client_name column
      'dl__invoice_status',  // Auto-loads from settings, colored badge
      'invoice_amt',         // Auto-formats as currency, right-align
      'invoice_date',        // Auto-formats as date
      'due_date',
      'paid_date'
    ]),

    // One line generates all form fields:
    fields: generateEntityFields([
      'name', 'code', 'descr',
      'project_id', 'client_id',
      'dl__invoice_status',
      'invoice_amt', 'invoice_date', 'due_date'
    ]),

    supportedViews: ['table', 'grid'],
    defaultView: 'table'
  }
}
```

**What You Get Automatically:**
- ✅ 11 columns with proper width, alignment, sorting, filtering, rendering
- ✅ project_name and client_name columns auto-generated (show entity lookups)
- ✅ project_id and client_id hidden but available for API
- ✅ invoice_status with colored badges and dropdown
- ✅ Currency formatting for invoice_amt
- ✅ Date formatting for all date fields
- ✅ System fields (id, timestamps) automatically hidden
- ✅ Form fields with proper input types
- ✅ Delete endpoint with cascading cleanup
- ✅ Child entity endpoints (payments, artifacts)

**Total Code: ~50 lines (vs 300+ lines manually)**

---

### Example 7.2: Task Entity with All Patterns

```typescript
// Frontend entity config
export const entityConfigs = {
  task: {
    name: 'task',
    displayName: 'Task',
    apiEndpoint: '/api/v1/task',

    // Auto-generates 10 columns from 7 field keys:
    columns: generateStandardColumns([
      'name', 'code', 'descr',
      'project_id',           // Hidden, auto-adds project_name (visible)
      'assignee_employee_id', // Hidden, auto-adds employee_name (visible)
      'dl__task_stage',       // Colored badge, loadOptionsFromSettings
      'dl__task_priority',    // Colored badge, loadOptionsFromSettings
      'estimated_hours',      // Number, right-align
      'actual_hours',         // Number, right-align
      'story_points'          // Number, right-align
    ]),

    fields: generateEntityFields([
      'name', 'code', 'descr', 'project_id', 'assignee_employee_id',
      'dl__task_stage', 'dl__task_priority', 'estimated_hours', 'story_points'
    ]),

    supportedViews: ['table', 'kanban'],
    defaultView: 'table',

    kanban: {
      groupByField: 'dl__task_stage',
      metaTable: 'setting_task_stage',
      cardFields: ['name', 'assignee_employee_id', 'estimated_hours']
    }
  }
}

// Backend API routes
export async function taskRoutes(fastify: FastifyInstance) {
  // ... standard CRUD endpoints ...

  // Factory-generated delete with cascading cleanup
  createEntityDeleteEndpoint(fastify, 'task');

  // Factory-generated child entity endpoints
  createChildEntityEndpoint(fastify, 'task', 'artifact', 'd_artifact');
  createChildEntityEndpoint(fastify, 'task', 'wiki', 'd_wiki');
  createChildEntityEndpoint(fastify, 'task', 'comment', 'd_task_data');
}
```

---

## 8. Pattern Selection Guide

### When to Use Each Pattern

| Pattern | Use When | Don't Use When |
|---------|----------|----------------|
| `generateStandardColumns()` | Adding entity config columns | Need completely custom column logic |
| `generateEntityFields()` | Adding entity config form fields | Need complex custom validation |
| Field Category Registry | Adding new field naming pattern | One-off special case |
| Settings Loader | dl__* fields with options | Hardcoded options (use `options` prop) |
| `createChildEntityEndpoint()` | Parent-child entity relationships | Complex custom query logic needed |
| `createEntityDeleteEndpoint()` | Soft delete with linkage cleanup | Hard delete or custom cleanup logic |
| `APIFactory.getAPI()` | Type-safe API calls in frontend | Direct axios/fetch needed |

### Benefits Summary

**Code Reduction:**
- Entity config: 300+ lines → 50 lines (83% reduction)
- Child endpoint: 80 lines → 1 line (99% reduction)
- Delete endpoint: 60 lines → 1 line (98% reduction)
- Total: Eliminates ~20,000 lines across platform

**Consistency:**
- All *_amt fields render as currency
- All dl__* fields load from settings
- All FK columns auto-resolve to entity names
- All delete endpoints clean up linkages

**Maintainability:**
- Change currency format in ONE place → affects ALL amount fields
- Change timestamp rendering in ONE place → affects ALL timestamp fields
- Fix delete bug in ONE place → affects ALL entities

**Type Safety:**
- APIFactory prevents runtime errors from typos
- FieldCategory enum provides compile-time checking
- ColumnDef interface enforces structure

---

## Source of Truth

**All patterns align with DDL CREATE TABLE statements:**
- Field keys come from database schema (db/*.ddl files)
- API SELECT queries match DDL columns exactly
- Entity configs reference only columns that exist in CREATE TABLE
- Pattern matching rules align with database naming conventions (dl__*, *_amt, *_id, etc.)

---

## Related Documentation

- [Universal Entity System](./universal_entity_system.md) - Overall entity architecture
- [Entity Metadata Coherence](./ENTITY_METADATA_COHERENCE.md) - d_entity table and dynamic metadata
- [Column Consistency Update](./COLUMN_CONSISTENCY_UPDATE.md) - Context-independent column behavior

---

**Last Review:** 2025-01-11
**Maintained By:** Platform Architecture Team
