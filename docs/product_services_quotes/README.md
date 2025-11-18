# Product, Services, Quotes & Work Orders System

**Version:** 1.0.0
**Last Updated:** 2025-11-02
**Author:** System Architecture Team
**Status:** Production Ready

---

## Table of Contents

1. [Semantics & Business Context](#semantics--business-context)
2. [Architecture & DRY Design Patterns](#architecture--dry-design-patterns)
3. [Database, API & UI/UX Mapping](#database-api--uiux-mapping)
4. [DRY Principles & Entity Relationships](#dry-principles--entity-relationships)
5. [Central Configuration & Middleware](#central-configuration--middleware)
6. [User Interaction Flow Examples](#user-interaction-flow-examples)
7. [Critical Considerations When Building](#critical-considerations-when-building)

---

## Semantics & Business Context

### Purpose

This module implements a complete **Quote-to-Cash workflow** for the Canadian home services industry, enabling:

- **Service Catalog Management** - Standardized service offerings with rates and labor estimates
- **Product Catalog Management** - Materials, equipment, and supplies inventory
- **Quote Generation** - Customer quotes combining services and products via JSONB line items
- **Work Order Execution** - Actual service delivery tracking with labor, materials, and customer satisfaction

### Business Rules

1. **No Foreign Keys**: All relationships managed through `entity_instance_link` (following platform convention)
2. **JSONB Line Items**: Quote items stored as JSONB array, not linker tables
3. **Task-Centric**: Quotes and Work Orders are children of Tasks (via entity_id_map)
4. **RBAC-Enforced**: All operations require entity-level permissions via `entity_rbac`
5. **Temporal Tracking**: All entities include `created_ts`, `updated_ts`, `active_flag`

### Entity Semantics

| Entity | Type | Table | Purpose | Parent |
|--------|------|-------|---------|--------|
| **Service** | Dimension | `app.d_service` | Service catalog with standard rates | Independent |
| **Product** | Dimension | `app.d_product` | Product catalog with inventory | Independent |
| **Quote** | Fact | `app.fact_quote` | Customer quote with line items (JSONB) | Task |
| **Work Order** | Fact | `app.fact_work_order` | Actual service delivery tracking | Task |

### Workflow States

**Quote Stages** (`dl__quote_stage`):
```
Draft (0) → Sent (1) → Under Review (2) → Negotiating (3) → Accepted (4)
                                                           └→ Rejected (5)
```

**Work Order Statuses** (`dl__work_order_status`):
```
Scheduled (0) → Dispatched (1) → In Progress (2) → On Hold (3) → Completed (4)
                                                                 └→ Cancelled (5)
```

---

## Architecture & DRY Design Patterns

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT (React 19 + Vite)                     │
├─────────────────────────────────────────────────────────────────┤
│  EntityMainPage (Table View)                                    │
│    └─> entityConfig.ts (Centralized Configuration)              │
│         ├─> fieldGenerator.ts (NEW - DRY Field Generation)      │
│         └─> columnGenerator.ts (DRY Column Generation)          │
│                                                                  │
│  EntityDetailPage (Detail View with Tabs)                       │
│    └─> DynamicChildEntityTabs (Child entity relationships)      │
└─────────────────────────────────────────────────────────────────┘
                              ▼ HTTP/REST
┌─────────────────────────────────────────────────────────────────┐
│                   API LAYER (Fastify + TypeScript)              │
├─────────────────────────────────────────────────────────────────┤
│  Route Modules (Following Standard Pattern):                    │
│    • /api/v1/service     - Service CRUD                         │
│    • /api/v1/product     - Product CRUD + Inventory             │
│    • /api/v1/quote       - Quote CRUD + Child Work Orders       │
│    • /api/v1/work_order  - Work Order CRUD                      │
│                                                                  │
│  Middleware Chain:                                               │
│    1. fastify.authenticate (JWT verification)                   │
│    2. RBAC check (inline via entity_rbac query)          │
│    3. Route handler                                              │
│    4. filterUniversalColumns (response filtering)                │
└─────────────────────────────────────────────────────────────────┘
                              ▼ SQL
┌─────────────────────────────────────────────────────────────────┐
│                DATABASE (PostgreSQL 14+)                         │
├─────────────────────────────────────────────────────────────────┤
│  Schema: app                                                     │
│                                                                  │
│  Dimension Tables:                                               │
│    • d_service (18 curated services)                            │
│    • d_product (20 curated products)                            │
│                                                                  │
│  Fact Tables:                                                    │
│    • fact_quote (quote_items as JSONB)                          │
│    • fact_work_order (labor tracking)                           │
│                                                                  │
│  Relationship Management:                                        │
│    • entity_instance_link (Task → Quote, Task → Work Order)         │
│    • entity_rbac (Permission control)                    │
│    • d_entity_instance_registry (Global entity registry)             │
│                                                                  │
│  Settings:                                                       │
│    • setting_datalabel (dl__quote_stage, dl__work_order_status)│
└─────────────────────────────────────────────────────────────────┘
```

### NEW: Field Generator Pattern (DRY Innovation)

**File:** `/apps/web/src/lib/fieldGenerator.ts`

**Convention-Based Field Detection:**

```typescript
// Suffix-based type detection:
*_amt, *_amount     → number
*_date              → date
*_ts, *_timestamp   → timestamp (readonly)
*_email             → text (with email placeholder)
*_phone             → text (with phone placeholder)
*_name              → text
*_flag              → select (Yes/No) + coerceBoolean
dl__*               → select + loadOptionsFromSettings
descr, description  → richtext
metadata, *_json    → jsonb
```

**Universal Fields Auto-Injection:**

Every entity automatically receives:
- `metadata` (JSONB)
- `created_ts` (timestamp, readonly)
- `updated_ts` (timestamp, readonly)

**Usage Example:**

```typescript
// OLD WAY (26 lines):
fields: [
  { key: 'name', label: 'Service Name', type: 'text', required: true },
  { key: 'code', label: 'Service Code', type: 'text', required: true },
  { key: 'standard_rate_amt', label: 'Rate', type: 'number' },
  { key: 'taxable_flag', label: 'Taxable', type: 'select', options: [...], coerceBoolean: true },
  // ... 6 more fields ...
  { key: 'metadata', label: 'Metadata', type: 'jsonb' },
  { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
  { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
]

// NEW WAY (13 lines):
fields: generateEntityFields(
  ['name', 'code', 'descr', 'standard_rate_amt', 'estimated_hours',
   'minimum_charge_amt', 'taxable_flag', 'requires_certification_flag'],
  {
    overrides: {
      name: { label: 'Service Name' },
      code: { label: 'Service Code' }
    }
  }
)
// Universal fields (metadata, created_ts, updated_ts) auto-appended
```

**Benefits:**
- 50% reduction in field definition code
- Consistent field behavior across all entities
- Single source of truth for conventions
- Automatic label generation from field names

---

## Database, API & UI/UX Mapping

### Complete Stack Mapping

#### 1. Service Entity

**Database:** `app.d_service`
```sql
CREATE TABLE app.d_service (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name text NOT NULL,
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    service_category text,
    standard_rate_amt decimal(15,2),
    estimated_hours numeric(10,2),
    minimum_charge_amt decimal(15,2),
    taxable_flag boolean DEFAULT true,
    requires_certification_flag boolean DEFAULT false,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);
```

**API Endpoints:**
```
GET    /api/v1/service                    # List (RBAC: permission=0)
GET    /api/v1/service/:id                # Get single (RBAC: permission=0)
POST   /api/v1/service                    # Create (RBAC: permission=4, entity_id='all')
PUT    /api/v1/service/:id                # Update (RBAC: permission=1)
DELETE /api/v1/service/:id                # Delete (RBAC: permission=3)
```

**Frontend Config:** `apps/web/src/lib/entityConfig.ts:2184-2249`
```typescript
service: {
  name: 'service',
  apiEndpoint: '/api/v1/service',
  columns: generateStandardColumns([...]),
  fields: generateEntityFields([...]),  // Uses new field generator
  supportedViews: ['table'],
  defaultView: 'table'
}
```

**Route:** `/service` → `EntityMainPage` → `DataTable`

---

#### 2. Product Entity

**Database:** `app.d_product`
```sql
CREATE TABLE app.d_product (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name text NOT NULL,
    product_category text,
    unit_price_amt decimal(15,2),
    cost_amt decimal(15,2),
    unit_of_measure text DEFAULT 'each',
    on_hand_qty integer DEFAULT 0,
    reorder_level_qty integer DEFAULT 0,
    taxable_flag boolean DEFAULT true,
    supplier_name text,
    -- Universal columns
    active_flag boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);
```

**API Endpoints:**
```
GET    /api/v1/product                    # List (with filters: active, search, category)
GET    /api/v1/product/:id                # Get single
POST   /api/v1/product                    # Create
PUT    /api/v1/product/:id                # Update
DELETE /api/v1/product/:id                # Delete
```

**Frontend Config:** `apps/web/src/lib/entityConfig.ts:2254-2319`

**Route:** `/product` → `EntityMainPage` → `DataTable`

---

#### 3. Quote Entity (CRITICAL: JSONB Line Items)

**Database:** `app.fact_quote`
```sql
CREATE TABLE app.fact_quote (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name text NOT NULL,
    descr text,

    -- Workflow
    dl__quote_stage text,  -- References setting_datalabel

    -- CRITICAL: Line items stored as JSONB (NO linker tables)
    quote_items jsonb DEFAULT '[]'::jsonb,

    -- Financial calculations
    subtotal_amt decimal(15,2) DEFAULT 0.00,
    discount_pct numeric(5,2) DEFAULT 0.00,
    discount_amt decimal(15,2) DEFAULT 0.00,
    tax_pct numeric(5,2) DEFAULT 13.00,
    quote_tax_amt decimal(15,2) DEFAULT 0.00,
    quote_total_amt decimal(15,2) DEFAULT 0.00,

    -- Customer info
    customer_name text,
    customer_email text,
    customer_phone text,

    -- Dates
    valid_until_date date,
    sent_date date,
    accepted_date date,
    rejected_date date,

    -- Notes
    internal_notes text,
    customer_notes text,

    -- Universal
    active_flag boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);
```

**JSONB Structure for quote_items:**
```json
[
  {
    "item_type": "service",
    "item_id": "s1111111-1111-1111-1111-111111111111",
    "item_code": "SVC-HVAC-001",
    "item_name": "HVAC Installation",
    "quantity": 1.0,
    "unit_rate": 5500.00,
    "line_total": 5500.00,
    "line_notes": "3-ton AC unit installation"
  },
  {
    "item_type": "product",
    "item_id": "p1111111-1111-1111-1111-111111111111",
    "item_code": "PRD-HVAC-001",
    "item_name": "Carrier 3-Ton AC Unit",
    "quantity": 1.0,
    "unit_rate": 3200.00,
    "line_total": 3200.00
  }
]
```

**API Endpoints:**
```
GET    /api/v1/quote                      # List
GET    /api/v1/quote/:id                  # Get single
POST   /api/v1/quote                      # Create (quote_items as JSONB)
PUT    /api/v1/quote/:id                  # Update
DELETE /api/v1/quote/:id                  # Delete

# Child entity endpoint (factory-generated)
GET    /api/v1/quote/:id/work_order       # List work orders for quote
```

**Frontend Config:** `apps/web/src/lib/entityConfig.ts:2324-2395`

**Route:** `/quote` → `EntityMainPage` → `DataTable`

---

#### 4. Work Order Entity

**Database:** `app.fact_work_order`
```sql
CREATE TABLE app.fact_work_order (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name text NOT NULL,
    descr text,

    -- Workflow
    dl__work_order_status text,

    -- Scheduling
    scheduled_date date,
    scheduled_start_time time,
    scheduled_end_time time,
    started_ts timestamptz,
    completed_ts timestamptz,

    -- Assignment
    assigned_technician_name text,

    -- Labor tracking
    labor_hours numeric(10,2) DEFAULT 0.00,
    labor_cost_amt decimal(15,2) DEFAULT 0.00,
    materials_cost_amt decimal(15,2) DEFAULT 0.00,
    total_cost_amt decimal(15,2) DEFAULT 0.00,

    -- Customer
    customer_name text,
    customer_email text,
    customer_phone text,
    service_address_line1 text,
    service_city text,
    service_postal_code text,

    -- Completion
    customer_signature_flag boolean DEFAULT false,
    customer_satisfaction_rating integer,
    completion_notes text,
    internal_notes text,

    -- Universal
    active_flag boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);
```

**API Endpoints:**
```
GET    /api/v1/work_order                 # List (filters: active, search, status)
GET    /api/v1/work_order/:id             # Get single
POST   /api/v1/work_order                 # Create
PUT    /api/v1/work_order/:id             # Update
DELETE /api/v1/work_order/:id             # Delete
```

**Frontend Config:** `apps/web/src/lib/entityConfig.ts:2389-2485`

**Route:** `/work_order` → `EntityMainPage` → `DataTable`

---

### API Route Pattern (Standardized)

**File Structure:**
```
apps/api/src/modules/
├── service/
│   └── routes.ts
├── product/
│   └── routes.ts
├── quote/
│   └── routes.ts
└── work_order/
    └── routes.ts
```

**Standard Route Template:**
```typescript
import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { filterUniversalColumns } from '../../lib/universal-schema-metadata.js';
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';

export async function serviceRoutes(fastify: FastifyInstance) {
  // LIST - GET /api/v1/service
  fastify.get('/api/v1/service', {
    preHandler: [fastify.authenticate],
    schema: { querystring: Type.Object({ ... }) }
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;

    // RBAC check (inline via EXISTS subquery)
    const baseConditions = [
      sql`EXISTS (
        SELECT 1 FROM app.entity_rbac rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = 'service'
          AND (rbac.entity_id = s.id::text OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
          AND 0 = ANY(rbac.permission)
      )`
    ];

    // Query with RBAC filtering
    const services = await db.execute(sql`
      SELECT * FROM app.d_service s
      WHERE ${sql.join(baseConditions, sql` AND `)}
      ORDER BY s.name ASC
      LIMIT ${limit} OFFSET ${offset}
    `);

    return { data: services, total, limit, offset };
  });

  // CREATE - POST /api/v1/service
  fastify.post('/api/v1/service', {
    preHandler: [fastify.authenticate],
    schema: { body: CreateServiceSchema }
  }, async (request, reply) => {
    // RBAC check (permission=4, entity_id='all')
    const access = await db.execute(sql`
      SELECT 1 FROM app.entity_rbac rbac
      WHERE rbac.empid = ${userId}
        AND rbac.entity = 'service'
        AND rbac.entity_id = 'all'
        AND 4 = ANY(rbac.permission)
    `);

    if (access.length === 0) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    // Insert
    const result = await db.execute(sql`
      INSERT INTO app.d_service (...)
      VALUES (...) RETURNING *
    `);

    const newService = result[0];

    // Register in global entity registry
    await db.execute(sql`
      INSERT INTO app.d_entity_instance_registry (entity_type, entity_id, entity_name, entity_code)
      VALUES ('service', ${newService.id}::uuid, ${newService.name}, ${newService.code})
      ON CONFLICT (entity_type, entity_id) DO UPDATE
      SET entity_name = EXCLUDED.entity_name, entity_code = EXCLUDED.entity_code
    `);

    return reply.status(201).send(filterUniversalColumns(newService, {...}));
  });

  // DELETE - Factory-generated
  createEntityDeleteEndpoint(fastify, 'service');
}
```

**Key Patterns:**
1. **Inline RBAC**: No middleware, checks embedded in SQL via `EXISTS` subquery
2. **Entity Registration**: All creates/updates sync to `d_entity_instance_registry`
3. **TypeBox Validation**: Schema validation via `@sinclair/typebox`
4. **Factory Functions**: `createEntityDeleteEndpoint`, `createChildEntityEndpoint`

---

## DRY Principles & Entity Relationships

### Entity Relationship Diagram

```
┌─────────────┐
│    Task     │
│ (d_task)    │
└──────┬──────┘
       │
       │ (via entity_instance_link)
       │ parent_entity_type='task'
       │ child_entity_type='quote'
       ├─────────────────┐
       ▼                 ▼
┌─────────────┐   ┌─────────────┐
│    Quote    │   │ Work Order  │
│(fact_quote) │   │(fact_work_  │
│             │   │   order)    │
│ quote_items │   │             │
│   (JSONB)   │   │             │
└──────┬──────┘   └─────────────┘
       │
       │ References (via JSONB):
       ├─────────────┬─────────────┐
       ▼             ▼             ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Service  │  │ Product  │  │ Product  │
│(d_service│  │(d_product│  │(d_product│
│   )      │  │    )     │  │    )     │
└──────────┘  └──────────┘  └──────────┘
```

### Relationship Rules

**1. Task → Quote (Parent-Child)**
```sql
-- Stored in: app.entity_instance_link
INSERT INTO app.entity_instance_link (
  parent_entity_type, parent_entity_id,
  child_entity_type, child_entity_id,
  relationship_type
) VALUES (
  'task', 'a2222222-2222-2222-2222-222222222222',
  'quote', 'q1111111-1111-1111-1111-111111111111',
  'contains'
);
```

**2. Task → Work Order (Parent-Child)**
```sql
INSERT INTO app.entity_instance_link (
  parent_entity_type, parent_entity_id,
  child_entity_type, child_entity_id,
  relationship_type
) VALUES (
  'task', 'a2222222-2222-2222-2222-222222222222',
  'work_order', 'w1111111-1111-1111-1111-111111111111',
  'contains'
);
```

**3. Quote → Service/Product (JSONB References)**

**CRITICAL**: Services and products are NOT stored in linker tables. They are embedded in the `quote_items` JSONB array.

```json
{
  "id": "q1111111-1111-1111-1111-111111111111",
  "quote_items": [
    {
      "item_type": "service",
      "item_id": "s1111111-...",  // References d_service.id
      "item_code": "SVC-HVAC-001",
      "item_name": "HVAC Installation",
      "quantity": 1.0,
      "unit_rate": 5500.00,
      "line_total": 5500.00
    },
    {
      "item_type": "product",
      "item_id": "p1111111-...",  // References d_product.id
      "item_code": "PRD-HVAC-001",
      "item_name": "Carrier 3-Ton AC Unit",
      "quantity": 1.0,
      "unit_rate": 3200.00,
      "line_total": 3200.00
    }
  ],
  "subtotal_amt": 8700.00,
  "tax_pct": 13.00,
  "quote_tax_amt": 1131.00,
  "quote_total_amt": 9831.00
}
```

**Why JSONB?**
- Flexible line item structure
- No separate linker table overhead
- Easy to query with PostgreSQL JSONB operators
- Maintains quote integrity (line items are immutable snapshots)

### DRY Pattern: Field Generator

**Convention Over Configuration:**

Instead of defining every field manually, the system uses naming conventions:

```typescript
// File: apps/web/src/lib/fieldGenerator.ts

function detectFieldType(key: string): FieldDef['type'] {
  if (key.endsWith('_amt') || key.endsWith('_amount')) return 'number';
  if (key.endsWith('_date')) return 'date';
  if (key.endsWith('_ts') || key.endsWith('_timestamp')) return 'timestamp';
  if (key.endsWith('_email')) return 'text';
  if (key.endsWith('_phone')) return 'text';
  if (key.endsWith('_flag')) return 'select';
  if (key.startsWith('dl__')) return 'select';  // Datalabel
  if (key === 'descr' || key === 'description') return 'richtext';
  if (key === 'metadata' || key.endsWith('_json')) return 'jsonb';
  return 'text';
}
```

**Universal Fields Injection:**

Every entity automatically gets:
```typescript
function getUniversalFields(): FieldDef[] {
  return [
    { key: 'metadata', label: 'Metadata', type: 'jsonb' },
    { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
    { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
  ];
}
```

---

## Central Configuration & Middleware

### 1. Entity Configuration Registry

**File:** `apps/web/src/lib/entityConfig.ts`

**New Entities Added (lines 2184-2485):**

```typescript
export const entityConfigs: Record<string, EntityConfig> = {
  // ... existing entities ...

  service: {
    name: 'service',
    displayName: 'Service',
    pluralName: 'Services',
    apiEndpoint: '/api/v1/service',
    columns: generateStandardColumns([...]),
    fields: generateEntityFields([...]),  // NEW: Uses field generator
    supportedViews: ['table'],
    defaultView: 'table'
  },

  product: { ... },
  quote: { ... },
  work_order: { ... }
};
```

**Impact:**
- Automatic route generation: `/service`, `/product`, `/quote`, `/work_order`
- Automatic DataTable rendering with columns
- Automatic form rendering with field definitions
- Automatic CRUD operations

### 2. Field Generator (NEW)

**File:** `apps/web/src/lib/fieldGenerator.ts` (NEW - 269 lines)

**Exported Functions:**

```typescript
// Main function - generates entity fields with universal fields
export function generateEntityFields(
  entityFields: string[],
  options?: {
    overrides?: Record<string, Partial<FieldDef>>;
    includeUniversal?: boolean;  // Default: true
  }
): FieldDef[]

// Utility functions
export function getUniversalFields(): FieldDef[]
export function generateField(key: string, overrides?: Partial<FieldDef>): FieldDef
export function getBooleanField(key: string, label?: string): FieldDef
export function getDatalabelField(key: string, label?: string): FieldDef
export function getAmountField(key: string, label?: string): FieldDef
export function getEmailField(key: string, label?: string): FieldDef
export function getPhoneField(key: string, label?: string): FieldDef
export function getDateField(key: string, label?: string): FieldDef
```

**Convention Mapping:**

| Field Pattern | Auto-Detected Type | Special Properties |
|---------------|-------------------|-------------------|
| `*_amt`, `*_amount` | `number` | - |
| `*_date` | `date` | - |
| `*_ts`, `*_timestamp` | `timestamp` | `readonly: true` |
| `*_email` | `text` | `placeholder: 'user@example.com'` |
| `*_phone` | `text` | `placeholder: '(123) 456-7890'` |
| `*_name` | `text` | - |
| `*_flag` | `select` | `options: [Yes/No]`, `coerceBoolean: true` |
| `dl__*` | `select` | `loadOptionsFromSettings: true` |
| `descr`, `description` | `richtext` | - |
| `metadata`, `*_json` | `jsonb` | - |
| `name`, `code` | `text` | `required: true` |

### 3. Route Registration

**File:** `apps/api/src/modules/index.ts`

**Added (lines 30-33, 120-127):**

```typescript
// Imports
import { serviceRoutes } from './service/routes.js';
import { productRoutes } from './product/routes.js';
import { quoteRoutes } from './quote/routes.js';
import { workOrderRoutes } from './work_order/routes.js';

// Registration
export async function registerAllRoutes(fastify: FastifyInstance): Promise<void> {
  // ... existing routes ...

  // Product & Operations API routes
  await serviceRoutes(fastify);
  await productRoutes(fastify);
  await quoteRoutes(fastify);
  await workOrderRoutes(fastify);
}
```

### 4. Database Import Configuration

**File:** `tools/db-import.sh`

**Added (lines 227-228, 254-255):**

```bash
# Product & Operations dimension tables
execute_sql "$DB_PATH/d_service.ddl" "Service dimension table (service catalog)"
execute_sql "$DB_PATH/d_product.ddl" "Product dimension table (materials, equipment)"

# Fact tables (after dimensions)
execute_sql "$DB_PATH/fact_quote.ddl" "Quote fact table (customer quotes with line items)"
execute_sql "$DB_PATH/fact_work_order.ddl" "Work order fact table (service delivery tracking)"
```

### 5. Settings Configuration

**File:** `db/setting_datalabel.ddl`

**Added:**

```sql
-- Quote Stages
('dl__quote_stage', 'Quote Stages', 'FileText', '[
  {"id": 0, "name": "Draft", "descr": "Quote is being prepared", "color_code": "gray"},
  {"id": 1, "name": "Sent", "descr": "Quote sent to customer", "color_code": "blue"},
  {"id": 2, "name": "Under Review", "descr": "Customer reviewing", "color_code": "yellow"},
  {"id": 3, "name": "Negotiating", "descr": "In negotiation", "color_code": "orange"},
  {"id": 4, "name": "Accepted", "descr": "Customer accepted", "color_code": "green"},
  {"id": 5, "name": "Rejected", "descr": "Customer rejected", "color_code": "red"}
]'::jsonb),

-- Work Order Statuses
('dl__work_order_status', 'Work Order Statuses', 'Wrench', '[
  {"id": 0, "name": "Scheduled", "descr": "Work order scheduled", "color_code": "blue"},
  {"id": 1, "name": "Dispatched", "descr": "Technician dispatched", "color_code": "cyan"},
  {"id": 2, "name": "In Progress", "descr": "Work in progress", "color_code": "yellow"},
  {"id": 3, "name": "On Hold", "descr": "Work on hold", "color_code": "orange"},
  {"id": 4, "name": "Completed", "descr": "Work completed", "color_code": "green"},
  {"id": 5, "name": "Cancelled", "descr": "Work cancelled", "color_code": "red"}
]'::jsonb)
```

---

## User Interaction Flow Examples

### Flow 1: Creating a Quote

**User Journey:**

1. **Navigate to Quotes**
   ```
   User clicks "Quotes" in sidebar
   → Route: /quote
   → Component: EntityMainPage
   → Renders: DataTable with quote list (empty initially)
   ```

2. **Click "Create Quote"**
   ```
   User clicks "+ New Quote" button
   → Opens modal/drawer with form
   → Form fields generated from entityConfig.quote.fields
   → Uses generateEntityFields() for automatic field rendering
   ```

3. **Fill Quote Details**
   ```
   User enters:
   - Name: "HVAC Installation - 123 Main St"
   - Customer Name: "John Smith"
   - Customer Email: "john@example.com"
   - Quote Stage: "Draft" (dropdown from dl__quote_stage)
   ```

4. **Add Line Items**
   ```
   User clicks "Add Service"
   → Selects from service catalog: "HVAC Installation" ($5,500)
   → Quantity: 1

   User clicks "Add Product"
   → Selects from product catalog: "Carrier 3-Ton AC Unit" ($3,200)
   → Quantity: 1

   Frontend builds JSONB array:
   {
     "quote_items": [
       { "item_type": "service", "item_id": "...", "quantity": 1, "unit_rate": 5500 },
       { "item_type": "product", "item_id": "...", "quantity": 1, "unit_rate": 3200 }
     ]
   }
   ```

5. **Calculate Totals**
   ```
   Frontend or backend calculates:
   - Subtotal: $8,700.00
   - Tax (13%): $1,131.00
   - Total: $9,831.00
   ```

6. **Save Quote**
   ```
   POST /api/v1/quote
   {
     "name": "HVAC Installation - 123 Main St",
     "customer_name": "John Smith",
     "customer_email": "john@example.com",
     "dl__quote_stage": "Draft",
     "quote_items": [...],
     "subtotal_amt": 8700.00,
     "tax_pct": 13.00,
     "quote_tax_amt": 1131.00,
     "quote_total_amt": 9831.00
   }

   → API validates RBAC (permission=4)
   → Inserts into fact_quote
   → Registers in d_entity_instance_registry
   → Returns 201 Created with quote data
   ```

7. **View Quote**
   ```
   User sees quote in table
   Click on row → Navigate to /quote/:id
   → EntityDetailPage renders
   → Shows all fields in Notion-style layout
   → Shows child tabs (if configured)
   ```

---

### Flow 2: Converting Quote to Work Order

**User Journey:**

1. **Open Quote Details**
   ```
   Route: /quote/:quoteId
   → EntityDetailPage
   → Overview tab shows quote details
   → "Work Orders" tab shows child work orders
   ```

2. **Create Work Order from Quote**
   ```
   User clicks "Create Work Order" button
   → Opens work order form
   → Pre-fills customer info from quote
   → Pre-fills service address
   → Sets scheduled_date
   ```

3. **Save Work Order**
   ```
   POST /api/v1/work_order
   {
     "name": "HVAC Installation - 123 Main St",
     "customer_name": "John Smith",
     "customer_email": "john@example.com",
     "scheduled_date": "2025-11-15",
     "dl__work_order_status": "Scheduled"
   }

   → Creates work order
   → Links to task via entity_instance_link:
     parent_entity_type='task'
     child_entity_type='work_order'
   ```

4. **Track Work Progress**
   ```
   Technician updates status:
   "Scheduled" → "Dispatched" → "In Progress" → "Completed"

   PUT /api/v1/work_order/:id
   {
     "dl__work_order_status": "Completed",
     "labor_hours": 8.5,
     "labor_cost_amt": 680.00,
     "materials_cost_amt": 3200.00,
     "total_cost_amt": 3880.00,
     "customer_signature_flag": true,
     "customer_satisfaction_rating": 5,
     "completion_notes": "Installation completed successfully"
   }
   ```

---

### Flow 3: Viewing Service Catalog

**User Journey:**

1. **Navigate to Services**
   ```
   Route: /service
   → EntityMainPage with entityType='service'
   → DataTable renders with columns from entityConfig.service.columns
   ```

2. **View Service Details**
   ```
   Click on "HVAC Installation" row
   → Route: /service/:id
   → EntityDetailPage renders
   → Shows fields: name, code, standard_rate_amt, estimated_hours, etc.
   → Field labels auto-generated by fieldGenerator
   ```

3. **Edit Service**
   ```
   Click "Edit" button
   → Form fields rendered from entityConfig.service.fields
   → generateEntityFields() provides:
     - name (text, required)
     - code (text, required)
     - standard_rate_amt (number) - auto-detected from suffix
     - taxable_flag (select Yes/No) - auto-detected from suffix
     - metadata (jsonb) - universal field
     - created_ts (timestamp, readonly) - universal field

   User modifies standard_rate_amt: $5,500 → $5,800

   PUT /api/v1/service/:id
   {
     "standard_rate_amt": 5800
   }
   ```

---

## Critical Considerations When Building

### 1. RBAC Permission Model

**Permission Array:**
```typescript
permission: [0, 1, 2, 3, 4]
// 0 = VIEW
// 1 = EDIT
// 2 = SHARE
// 3 = DELETE
// 4 = CREATE
```

**CRITICAL**: CREATE (4) requires `entity_id = 'all'`, not a specific UUID.

**Query Pattern:**
```sql
-- For LIST/VIEW (permission=0)
WHERE EXISTS (
  SELECT 1 FROM app.entity_rbac rbac
  WHERE rbac.empid = $userId
    AND rbac.entity = 'service'
    AND (rbac.entity_id = s.id::text OR rbac.entity_id = 'all')
    AND 0 = ANY(rbac.permission)
)

-- For CREATE (permission=4)
WHERE EXISTS (
  SELECT 1 FROM app.entity_rbac rbac
  WHERE rbac.empid = $userId
    AND rbac.entity = 'service'
    AND rbac.entity_id = 'all'  -- MUST be 'all'
    AND 4 = ANY(rbac.permission)
)
```

### 2. Entity Instance Registration

**MANDATORY** after every CREATE or UPDATE:

```sql
INSERT INTO app.d_entity_instance_registry (entity_type, entity_id, entity_name, entity_code)
VALUES ('service', $newService.id::uuid, $newService.name, $newService.code)
ON CONFLICT (entity_type, entity_id) DO UPDATE
SET entity_name = EXCLUDED.entity_name,
    entity_code = EXCLUDED.entity_code,
    updated_ts = NOW()
```

**Why?**
- Global entity search across all types
- Cross-entity referencing
- Entity type metadata lookups

### 3. JSONB Quote Items Structure

**CRITICAL**: Quote items are NOT normalized. They are JSONB snapshots.

**Rationale:**
- Immutable pricing history (quote reflects prices at time of creation)
- No foreign key cascades
- Flexible line item structure
- Easy to display/print without joins

**Query Pattern:**
```sql
-- Get all quotes containing a specific service
SELECT * FROM app.fact_quote
WHERE quote_items @> '[{"item_id": "s1111111-1111-1111-1111-111111111111"}]'::jsonb

-- Extract line items
SELECT
  id,
  jsonb_array_elements(quote_items) AS line_item
FROM app.fact_quote
WHERE id = $quoteId
```

### 4. Field Generator Conventions

**DO:**
- Use `*_amt` for all monetary values
- Use `*_flag` for all booleans
- Use `dl__*` for all datalabel fields
- Use `*_date` for dates, `*_ts` for timestamps
- Use `descr` (not `description`) for rich text

**DON'T:**
- Mix naming conventions (e.g., `amount` vs `amt`)
- Use custom boolean field names (always use `*_flag`)
- Override `metadata`, `created_ts`, `updated_ts` (universal fields)

**Example:**
```typescript
// GOOD
fields: generateEntityFields([
  'name', 'code', 'descr',
  'standard_rate_amt',      // Auto-detected: number
  'estimated_hours',         // Auto-detected: number
  'taxable_flag'            // Auto-detected: boolean select
])

// BAD
fields: [
  { key: 'standard_rate_amount', ... },  // Wrong suffix
  { key: 'is_taxable', ... },            // Wrong naming
  { key: 'description', ... }            // Use 'descr'
]
```

### 5. Route Factory Functions

**Use factories for common operations:**

```typescript
// Delete endpoint (soft delete with active_flag)
createEntityDeleteEndpoint(fastify, 'service');

// Child entity listing
createChildEntityEndpoint(fastify, 'quote', 'work_order', 'fact_work_order');
```

**DON'T reimplement:**
- Soft delete logic
- RBAC checks for delete
- Entity instance cleanup
- Standard response filtering

### 6. Database Import Order

**CRITICAL**: DDL files must be imported in dependency order.

**Order:**
```
1. setting_datalabel (defines dl__quote_stage, dl__work_order_status)
2. d_service (dimension)
3. d_product (dimension)
4. fact_quote (references services/products via JSONB)
5. fact_work_order (fact table)
6. entity_instance_link (relationships)
7. entity_rbac (permissions)
```

**Run after schema changes:**
```bash
cd /home/rabin/projects/pmo
./tools/db-import.sh
```

### 7. Frontend Integration

**Automatic behaviors from entityConfig:**

```typescript
// Column rendering
columns: generateStandardColumns(['name', 'code', 'standard_rate_amt'])
// → Auto-formats amounts with formatCurrency()
// → Auto-aligns amounts to right
// → Auto-sets sortable, filterable based on category

// Field rendering
fields: generateEntityFields(['name', 'taxable_flag'])
// → taxable_flag becomes Yes/No select with coerceBoolean
// → Automatically adds metadata, created_ts, updated_ts
```

**DON'T:**
- Manually define universal fields
- Hardcode field types (use conventions)
- Override auto-generated labels without good reason

### 8. TypeBox Schema Validation

**Pattern:**
```typescript
const CreateServiceSchema = Type.Object({
  code: Type.Optional(Type.String({ minLength: 1 })),
  name: Type.Optional(Type.String({ minLength: 1 })),
  standard_rate_amt: Type.Optional(Type.Number()),
  taxable_flag: Type.Optional(Type.Boolean())
});

fastify.post('/api/v1/service', {
  schema: { body: CreateServiceSchema }
}, async (request, reply) => {
  // request.body is validated and typed
});
```

**CRITICAL**: All fields optional in create schema (defaults applied in route handler).

### 9. Response Filtering

**ALWAYS use filterUniversalColumns:**

```typescript
return reply.status(201).send(
  filterUniversalColumns(newService, {
    canSeePII: true,
    canSeeFinancial: true,
    canSeeSystemFields: true,
    canSeeSafetyInfo: true
  })
);
```

**Why?**
- Consistent field filtering across all entities
- PII protection
- Financial data access control
- System field visibility control

### 10. Testing Pattern

**Use test-api.sh for all endpoint testing:**

```bash
# List
./tools/test-api.sh GET /api/v1/service

# Get single
./tools/test-api.sh GET /api/v1/service/:id

# Create
./tools/test-api.sh POST /api/v1/service '{"name":"Test","code":"TEST-001"}'

# Update
./tools/test-api.sh PUT /api/v1/service/:id '{"standard_rate_amt":5800}'

# Delete
./tools/test-api.sh DELETE /api/v1/service/:id
```

**Authentication:** Automatic (uses james.miller@huronhome.ca / password123)

---

## Quick Reference

### File Locations

| Component | Path |
|-----------|------|
| **DDL Files** | `/db/{d_service,d_product,fact_quote,fact_work_order}.ddl` |
| **API Routes** | `/apps/api/src/modules/{service,product,quote,work_order}/routes.ts` |
| **Frontend Config** | `/apps/web/src/lib/entityConfig.ts:2184-2485` |
| **Field Generator** | `/apps/web/src/lib/fieldGenerator.ts` (NEW) |
| **Route Registration** | `/apps/api/src/modules/index.ts:30-33,120-127` |
| **DB Import Config** | `/tools/db-import.sh:227-228,254-255` |

### Key Conventions

| Pattern | Meaning | Example |
|---------|---------|---------|
| `d_*` | Dimension table | `d_service` |
| `fact_*` | Fact table | `fact_quote` |
| `dl__*` | Datalabel field | `dl__quote_stage` |
| `*_amt` | Currency amount | `standard_rate_amt` |
| `*_flag` | Boolean | `taxable_flag` |
| `*_ts` | Timestamp | `created_ts` |
| `*_date` | Date | `scheduled_date` |

### Common Commands

```bash
# Import database schema
cd /home/rabin/projects/pmo
./tools/db-import.sh

# Restart API
./tools/restart-api.sh

# Test endpoint
./tools/test-api.sh GET /api/v1/service

# View API logs
./tools/logs-api.sh 50
```

---

**Document Status:** Complete and production-ready
**Next Review:** When adding new entities or modifying field generator patterns
