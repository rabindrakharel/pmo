# Product/Service/Quote/Work Order System - Technical Reference

**Audience:** Senior fullstack engineers maintaining or extending the feature
**Last Updated:** 2025-11-03
**Status:** ✅ Production Ready

---

## Architecture Overview

### Entity Hierarchy
```
d_service (15 records) ──┐
d_product (15 records) ──┼──> fact_quote.quote_items[] (6 quotes) ──> fact_work_order (6 orders)
                         │    (JSONB line items)
```

**Key Design Decisions:**
- **No foreign keys** - Intentional for flexibility; relationships tracked via JSONB and `entity_instance_link`
- **JSONB for line items** - Per-line discounts/taxes stored in `quote_items[]` array
- **DRY field generation** - Convention-based type detection (suffixes: `_amt`, `_pct`, `_date`, `dl__*`)
- **Universal components** - 3 pages handle all entities: `EntityListOfInstancesPage`, `EntitySpecificInstancePage`, `EntityCreatePage`
- **Entity instance registry** - All instances registered in `d_entity_instance_registry` for child-tabs and navigation

---

## Four Core Entities

### 1. Service Catalog (`d_service`)

**Purpose:** Billable services offered (HVAC, Electrical, Plumbing, Landscaping, General Contracting)

**Schema:**
```sql
id, code, name, descr, metadata
service_category              -- "HVAC", "Electrical", "Plumbing", etc.
standard_rate_amt             -- Default rate per service
estimated_hours               -- Time estimate
minimum_charge_amt            -- Minimum charge
taxable_flag, requires_certification_flag
active_flag, created_ts, updated_ts, version
```

**API:** `GET/POST/PUT/DELETE /api/v1/service`
**Frontend:** `/service` - List view with 15 services
**Records:** 15 curated services across 5 categories

---

### 2. Product Catalog (`d_product`)

**Purpose:** Materials and equipment for quotes/work orders

**Schema:**
```sql
id, code, name, descr, metadata
product_category              -- "HVAC Equipment", "Electrical", "Plumbing", etc.
unit_price_amt, cost_amt      -- Pricing
unit_of_measure               -- "each", "box", "gallon", etc.
on_hand_qty, reorder_level_qty, reorder_qty  -- Inventory
taxable_flag
supplier_name, supplier_part_number, warranty_months
active_flag, created_ts, updated_ts
```

**API:** `GET/POST/PUT/DELETE /api/v1/product`
**Frontend:** `/product` - List view with 15 products
**Records:** 15 curated products across 6 categories

---

### 3. Quote (`fact_quote`)

**Purpose:** Customer quotes with line items (services + products)

**Schema:**
```sql
id, code, name, descr, metadata
dl__quote_stage               -- Dropdown: Draft, Sent, Under Review, Negotiating, Accepted, Rejected, Expired, Cancelled
quote_items                   -- JSONB array (see structure below)
subtotal_amt, discount_pct, discount_amt
tax_pct, quote_tax_amt, quote_total_amt
valid_until_date, sent_date
customer_name, customer_email, customer_phone
internal_notes, customer_notes
active_flag, created_ts, updated_ts
```

**JSONB Structure:** `quote_items`
```typescript
interface QuoteItem {
  item_type: 'service' | 'product';
  item_id?: string;
  item_code: string;
  item_name: string;
  quantity: number;
  unit_rate: number;           // Base price
  discount_pct: number;         // 0-100
  discount_amt: number;         // Calculated
  subtotal: number;             // After discount
  tax_pct: number;              // Default 13% (Ontario HST)
  tax_amt: number;              // Calculated
  line_total: number;           // Final amount
  line_notes?: string;
}
```

**Calculation Logic:**
```typescript
discount_amt = unit_rate × quantity × (discount_pct / 100)
subtotal = (unit_rate × quantity) - discount_amt
tax_amt = subtotal × (tax_pct / 100)
line_total = subtotal + tax_amt
```

**API:** `GET/POST/PUT/DELETE /api/v1/quote`
**API (shareable):** `GET /api/v1/quote/shared/:code` (no auth)
**API (child entities):** `GET /api/v1/quote/:id/work_order`
**Frontend:** `/quote` - List, detail, kanban views
**Records:** 6 curated quotes with realistic London, Ontario pricing

**Child Entities:** Work Orders (1:many relationship)

**Settings Dropdown:** 8 stages with sequential state progression
- Draft (gray) → Sent (blue) → Under Review (purple) → Negotiating (yellow)
- → Accepted (green) | Rejected (red) | Expired (orange) | Cancelled (red)

---

### 4. Work Order (`fact_work_order`)

**Purpose:** Execution tracking for accepted quotes

**Schema:**
```sql
id, code, name, descr, metadata
dl__work_order_status         -- Dropdown: Scheduled, Confirmed, In Progress, On Hold, Completed, Cancelled, Rescheduled
scheduled_date, scheduled_start_time, scheduled_end_time
assigned_technician_name, assigned_technician_ids  -- uuid[] array
started_ts, completed_ts, labor_hours
labor_cost_amt, materials_cost_amt, total_cost_amt
customer_name, customer_email, customer_phone
service_address_line1, service_city, service_province, service_postal_code
customer_signature_flag, customer_satisfaction_rating (1-5)
completion_notes, follow_up_required_flag
internal_notes, special_instructions
active_flag, created_ts, updated_ts
```

**API:** `GET/POST/PUT/DELETE /api/v1/work_order`
**Frontend:** `/work_order` - List, detail, **kanban** views
**Records:** 6 curated work orders (Completed, In Progress, Scheduled)

**Settings Dropdown:** 7 statuses with workflow progression
- Scheduled (blue) → Confirmed (green) → In Progress (yellow)
- → On Hold (orange) → Completed (green) | Cancelled (red) | Rescheduled (purple)

**Parent Entity:** Quote (many:1 relationship)

---

## Frontend Architecture

### Component Hierarchy
```
EntitySpecificInstancePage
  └── EntityFormContainer
        ├── QuoteItemsRenderer (for quote_items field)
        │     └── EntityAttributeInlineDataTable (generic JSONB table)
        └── MetadataTable (for metadata field)
              └── EntityAttributeInlineDataTable (generic JSONB table)
```

### Key Files

**Entity Configuration** (`/apps/web/src/lib/entityConfig.ts`)

**Service Config (line 2118):**
```typescript
service: {
  name: 'service',
  apiEndpoint: '/api/v1/service',
  fields: generateEntityFields([
    'name', 'code', 'descr',
    'service_category',
    'standard_rate_amt',          // Auto: number
    'estimated_hours',
    'minimum_charge_amt',          // Auto: number
    'taxable_flag',                // Auto: boolean select
    'requires_certification_flag'  // Auto: boolean select
  ])
}
```

**Product Config (line 2181):**
```typescript
product: {
  name: 'product',
  apiEndpoint: '/api/v1/product',
  fields: generateEntityFields([
    'name', 'code', 'descr',
    'product_category',
    'unit_price_amt', 'cost_amt',  // Auto: number
    'unit_of_measure',
    'on_hand_qty', 'reorder_level_qty', 'reorder_qty',
    'taxable_flag',                 // Auto: boolean select
    'supplier_name', 'supplier_part_number', 'warranty_months'
  ])
}
```

**Quote Config (line 2251):**
```typescript
quote: {
  name: 'quote',
  apiEndpoint: '/api/v1/quote',
  shareable: true,  // ← Enables /quote/shared/:code
  fields: generateEntityFields([
    'name', 'code', 'descr',
    'dl__quote_stage',        // Auto: select + loadOptionsFromSettings
    'customer_name', 'customer_email', 'customer_phone',
    'quote_items',            // ← Special renderer: QuoteItemsRenderer
    'subtotal_amt', 'discount_pct', 'discount_amt',
    'tax_pct', 'quote_tax_amt', 'quote_total_amt',
    'valid_until_date', 'sent_date',
    'internal_notes', 'customer_notes'
  ], {
    overrides: {
      quote_items: { type: 'jsonb' },
      internal_notes: { type: 'textarea' },
      customer_notes: { type: 'textarea' }
    }
  })
}
```

**Work Order Config (line 2360):**
```typescript
work_order: {
  name: 'work_order',
  apiEndpoint: '/api/v1/work_order',
  shareable: true,
  supportedViews: ['table', 'kanban'],  // ← Kanban support!
  kanban: {
    groupByField: 'dl__work_order_status',
    metaTable: 'dl__work_order_status',
    cardFields: ['name', 'scheduled_date', 'assigned_technician_ids', 'total_cost_amt', 'customer_name']
  },
  fields: generateEntityFields([
    'name', 'code', 'descr',
    'dl__work_order_status',  // Auto: select + loadOptionsFromSettings
    'scheduled_date', 'scheduled_start_time', 'scheduled_end_time',
    'assigned_technician_ids',  // ← Multi-select: loadOptionsFromEntity: 'employee'
    'started_ts', 'completed_ts', 'labor_hours',
    'labor_cost_amt', 'materials_cost_amt', 'total_cost_amt',
    'customer_name', 'customer_email', 'customer_phone',
    'service_address_line1', 'service_city', 'service_province', 'service_postal_code',
    'customer_signature_flag', 'customer_satisfaction_rating',
    'completion_notes', 'follow_up_required_flag',
    'internal_notes', 'special_instructions'
  ])
}
```

---

**Settings Loader** (`/apps/web/src/lib/settingsLoader.ts`)

**Critical Mappings (lines 109-115):**
```typescript
export const FIELD_TO_SETTING_MAP: Record<string, string> = {
  // ... other mappings

  // Quote fields
  'dl__quote_stage': 'dl__quote_stage',
  'quote_stage': 'dl__quote_stage',

  // Work Order fields
  'dl__work_order_status': 'dl__work_order_status',
  'work_order_status': 'dl__work_order_status',
};
```

**How It Works:**
1. Field generator detects `dl__` prefix → sets `loadOptionsFromSettings: true`
2. Settings loader maps field key → datalabel → API endpoint
3. Calls: `GET /api/v1/datalabel?name=dl__quote_stage`
4. Returns options with colors for dropdown rendering

---

**Quote Items Renderer** (`/apps/web/src/components/shared/entity/QuoteItemsRenderer.tsx`)

**Purpose:** Specialized renderer for `quote_items` JSONB field

**Features:**
- ✅ Service/product dropdown selection (loads from API)
- ✅ Inline quantity editing
- ✅ **Automatic discount, subtotal, tax calculation** (13% HST)
- ✅ Type icons (Wrench for services, Package for products)
- ✅ Subtotal row at bottom
- ✅ Add/edit/delete line items
- ✅ Currency formatting (CAD)

**Columns:**
```
Type | Code | Description | Qty | Rate | Disc% | Subtotal | Tax% | Total
```

**Usage in EntityFormContainer:**
```typescript
// View mode (line 333-340)
if (field.key === 'quote_items') {
  return <QuoteItemsRenderer value={value || []} isEditing={false} />;
}

// Edit mode (line 478-497)
if (field.key === 'quote_items') {
  return <QuoteItemsRenderer value={value || []} onChange={onChange} isEditing={true} />;
}
```

---

**Generic JSONB Table** (`/apps/web/src/components/shared/ui/EntityAttributeInlineDataTable.tsx`)

**Purpose:** Reusable for ANY JSONB attribute (not just quote_items)

**Props:**
```typescript
interface EntityAttributeInlineDataTableProps {
  data: AttributeRecord[];                    // Array of JSON objects
  columns: BaseColumn[];                      // Column definitions
  onRowUpdate?: (index: number, updates: Partial<AttributeRecord>) => void;
  onAddRow?: (newRecord: Partial<AttributeRecord>) => void;
  onDeleteRow?: (index: number) => void;
  onReorder?: (reorderedData: AttributeRecord[]) => void;
  renderCell?: (column: BaseColumn, record: AttributeRecord, isEditing: boolean, onUpdate: (field: string, value: any) => void) => React.ReactNode;
  getDefaultNewRow?: () => Partial<AttributeRecord>;
  allowAddRow?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  allowReorder?: boolean;
  emptyMessage?: string;
}
```

**Used By:**
- QuoteItemsRenderer (quote_items field)
- MetadataTable (metadata field)
- Any future JSONB field renderers

---

## Database Schema Details

### Entity Instance Registry

**Table:** `d_entity_instance_registry`

**Purpose:** Universal registry for all entity instances (enables child-tabs, global search, cross-entity references)

**Schema:**
```sql
id (PK, auto-generated UUID)
entity_type   -- 'service', 'product', 'quote', 'work_order', etc.
entity_id     -- UUID of the entity instance
entity_name   -- Display name (for search/navigation)
entity_code   -- Business code (for search/references)
created_ts, updated_ts
UNIQUE (entity_type, entity_id)
```

**Records by Type:**
```sql
service:     15
product:     15
quote:        6
work_order:   6
-- Plus: project (5), task (7), employee (505), etc.
```

**Backfill Script:** `/db/32_d_entity_instance_backfill.ddl`
```sql
-- This file runs AFTER d_entity_instance_registry table is created
-- It backfills all existing records from the 4 entity tables

INSERT INTO app.d_entity_instance_registry (entity_type, entity_id, entity_name, entity_code)
SELECT 'quote', id, name, code FROM app.fact_quote
ON CONFLICT (entity_type, entity_id) DO UPDATE
SET entity_name = EXCLUDED.entity_name, entity_code = EXCLUDED.entity_code, updated_ts = NOW();

-- Similar for service, product, work_order
```

**Import Order (critical!):**
```bash
# /tools/db-import.sh
execute_sql "d_service.ddl"           # Line 227
execute_sql "d_product.ddl"           # Line 228
execute_sql "fact_quote.ddl"          # Line 254
execute_sql "fact_work_order.ddl"     # Line 255
# ...
execute_sql "31_d_entity_instance_registry.ddl"      # Line 264 - Creates table
execute_sql "32_d_entity_instance_backfill.ddl" # Line 265 - Backfills data!
```

---

### Entity Type Metadata

**Table:** `d_entity`

**Purpose:** Defines entity types, icons, parent-child relationships

**Quote Entry:**
```sql
INSERT INTO app.entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'quote', 'quote', 'Quotes', 'FileText',
  '[
    {"entity": "work_order", "ui_label": "Work Orders", "ui_icon": "ClipboardCheck", "order": 1}
  ]'::jsonb,
  120
);
```

**This enables:**
- Sidebar navigation: "Quotes" with FileText icon
- Detail page child tabs: "Work Orders" tab on quote detail page
- Child entity API: `/api/v1/entity/child-tabs/quote/:id`

---

## API Integration

### Entity API Client (`/apps/web/src/lib/api.ts`)

**Quote API (lines 729-760):**
```typescript
export const quoteApi = {
  async list(params) { /* ... */ },
  async get(id) { /* ... */ },
  async create(data) {
    // Automatically registers in d_entity_instance_registry on backend
  },
  async update(id, data) { /* ... */ },
  async delete(id) { /* ... */ },

  // Child entity support
  async getWorkOrders(quoteId, params) {
    return apiClient.get(`/api/v1/quote/${quoteId}/work_order`, { params });
  }
};

// Factory registration (line 1039)
APIFactory.register('quote', quoteApi);
APIFactory.register('work_order', workOrderApi);
APIFactory.register('service', serviceApi);
APIFactory.register('product', productApi);
```

---

### Backend Routes

**Quote Routes** (`/apps/api/src/modules/quote/routes.ts`)

**Standard CRUD:**
```typescript
GET    /api/v1/quote              // List with RBAC filtering
POST   /api/v1/quote              // Create + auto-register in d_entity_instance_registry
GET    /api/v1/quote/:id          // Get single with RBAC
PUT    /api/v1/quote/:id          // Update
DELETE /api/v1/quote/:id          // Soft delete
```

**Public Sharing:**
```typescript
GET    /api/v1/quote/shared/:code  // No auth required
```

**Child Entities:**
```typescript
GET    /api/v1/quote/:id/work_order  // Get work orders for this quote
```

**Entity Registration (Create endpoint, lines 237-242):**
```typescript
// After creating quote in fact_quote table:
await db.execute(sql`
  INSERT INTO app.d_entity_instance_registry (entity_type, entity_id, entity_name, entity_code)
  VALUES ('quote', ${newQuote.id}::uuid, ${newQuote.name}, ${newQuote.code})
  ON CONFLICT (entity_type, entity_id) DO UPDATE
  SET entity_name = EXCLUDED.entity_name, entity_code = EXCLUDED.entity_code, updated_ts = NOW()
`);
```

**Similar pattern for:** service, product, work_order routes

---

### Child Entity Endpoint

**Universal Endpoint:** `/api/v1/entity/child-tabs/:entity_type/:entity_id`

**Purpose:** Fetch child entity tabs for any parent entity

**Example:** `GET /api/v1/entity/child-tabs/quote/341540d1-d150-463e-ac9e-30a995b93a8c`

**Response:**
```json
{
  "parent_entity_type": "quote",
  "parent_entity_id": "341540d1-d150-463e-ac9e-30a995b93a8c",
  "tabs": [
    {
      "entity": "work_order",
      "ui_icon": "ClipboardCheck",
      "ui_label": "Work Orders",
      "count": 2,
      "order": 1
    }
  ],
  "parent_name": "Complete HVAC System Installation Quote",
  "parent_ui_label": "Quotes",
  "parent_ui_icon": "FileText"
}
```

**How It Works:**
1. Checks `d_entity_instance_registry` for parent entity existence
2. Loads `child_entities` JSONB from `d_entity` table
3. Counts child records from `entity_instance_link` table
4. Returns formatted tab metadata

---

## Testing & Validation

### Database Validation
```bash
# Import schema
./tools/db-import.sh

# Verify entity instance registry
psql -c "SELECT entity_type, COUNT(*) FROM app.d_entity_instance_registry GROUP BY entity_type;"
# Expected: service (15), product (15), quote (6), work_order (6)

# Verify quote structure
psql -c "SELECT jsonb_pretty(quote_items) FROM app.fact_quote WHERE code='QT-2024-001';"

# Check totals
psql -c "SELECT code, subtotal_amt, discount_amt, quote_tax_amt, quote_total_amt FROM app.fact_quote;"
```

---

### API Testing
```bash
# List services
./tools/test-api.sh GET /api/v1/service

# List products
./tools/test-api.sh GET /api/v1/product

# List quotes
./tools/test-api.sh GET /api/v1/quote

# Get specific quote
./tools/test-api.sh GET /api/v1/quote/341540d1-d150-463e-ac9e-30a995b93a8c

# Get child tabs for quote
./tools/test-api.sh GET /api/v1/entity/child-tabs/quote/341540d1-d150-463e-ac9e-30a995b93a8c

# Update quote items
./tools/test-api.sh PUT /api/v1/quote/341540d1-d150-463e-ac9e-30a995b93a8c '{"quote_items":[...]}'
```

---

### Frontend Testing

**Service:** http://localhost:5173/service
1. ✅ List view with 15 services
2. ✅ Click row → Detail page
3. ✅ Toggle Edit mode
4. ✅ Modify fields (auto-detected types work)
5. ✅ Save changes

**Product:** http://localhost:5173/product
1. ✅ List view with 15 products
2. ✅ Click row → Detail page
3. ✅ Edit pricing, inventory fields
4. ✅ Boolean flags render as Yes/No dropdowns
5. ✅ Save changes

**Quote:** http://localhost:5173/quote
1. ✅ List view with 6 quotes
2. ✅ Click row → Detail page with "Work Orders" tab
3. ✅ Toggle Edit mode
4. ✅ Modify `quote_items`:
   - Change quantity → verify recalculation
   - Edit discount % → verify subtotal/tax/total update
   - Add new line item → verify dropdown population (services + products)
5. ✅ Switch to Kanban view (8 columns by stage)
6. ✅ Test shareable URL: `/quote/shared/{code}`

**Work Order:** http://localhost:5173/work_order
1. ✅ List view with 6 work orders
2. ✅ Click row → Detail page
3. ✅ Status dropdown shows 7 options with colors
4. ✅ Multi-select technician assignment works
5. ✅ Switch to Kanban view (7 columns by status)
6. ✅ Drag-drop between status columns
7. ✅ Save changes

---

## Performance Considerations

**JSONB Indexing:**
```sql
-- If querying within quote_items becomes slow:
CREATE INDEX idx_quote_items_gin ON app.fact_quote USING gin(quote_items);

-- Query examples that benefit:
SELECT * FROM fact_quote WHERE quote_items @> '[{"item_type":"service"}]';
SELECT * FROM fact_quote WHERE quote_items @> '[{"item_code":"SVC-HVAC-001"}]';
```

**API Pagination:**
- Default: 20 items per page
- Override: `?page=2&pageSize=50`
- Max: 100 items per page

**Frontend Optimization:**
- `EntityAttributeInlineDataTable` renders all rows (no virtualization)
- For >100 line items, consider virtualization (react-window)
- Settings options cached for 5 minutes (settingsLoader.ts)

---

## Common Pitfalls & Solutions

### 1. ❌ Entity Not Showing in Child Tabs

**Symptom:** 404 error on `/api/v1/entity/child-tabs/quote/:id`

**Cause:** Quote not registered in `d_entity_instance_registry`

**Solution:** Run backfill or create via API (auto-registers)
```bash
./tools/db-import.sh  # Runs backfill script automatically
```

---

### 2. ❌ Dropdown Not Showing for dl__ Field

**Symptom:** Field renders as text input instead of dropdown

**Cause:** Missing mapping in `FIELD_TO_SETTING_MAP`

**Solution:** Add to `/apps/web/src/lib/settingsLoader.ts`
```typescript
export const FIELD_TO_SETTING_MAP: Record<string, string> = {
  'dl__quote_stage': 'dl__quote_stage',  // ← Add this
  // ...
};
```

---

### 3. ❌ Duplicate Entity Config Warning

**Symptom:** Vite warns: `Duplicate key "product" in object literal`

**Cause:** Two product configs in entityConfig.ts

**Solution:** Remove old/duplicate config, keep only the DRY version

---

### 4. ❌ Invalid UUIDs in DDL

**Symptom:** Database import fails with UUID constraint error

**Solution:** Let database generate UUIDs
```sql
-- ❌ Wrong
INSERT INTO fact_quote (id, ...) VALUES ('q1111111-...', ...);

-- ✅ Correct
INSERT INTO fact_quote (code, name, ...) VALUES ('QT-2024-001', ...);
```

---

### 5. ❌ Field Type Detection Conflicts

**Symptom:** `discount_amount` incorrectly detected as `text` instead of `number`

**Solution:** Override in entity config
```typescript
fields: generateEntityFields(['discount_amount'], {
  overrides: {
    discount_amount: { type: 'number' }
  }
})
```

---

### 6. ❌ Missing API Registration

**Symptom:** `API not found for entity type: 'quote'`

**Solution:** Register in APIFactory
```typescript
// /apps/web/src/lib/api.ts
APIFactory.register('quote', quoteApi);  // ← Add this
```

---

### 7. ❌ JSONB Field Not Rendering

**Symptom:** quote_items shows as raw JSON textarea

**Solution:** Add special renderer in EntityFormContainer
```typescript
// EntityFormContainer.tsx
if (field.key === 'quote_items') {
  return <QuoteItemsRenderer value={value} onChange={...} isEditing={isEditing} />;
}
```

---

## File Map (Critical Paths)

```
Database:
  /db/d_service.ddl                  ← Service catalog (15 records)
  /db/d_product.ddl                  ← Product catalog (15 records)
  /db/fact_quote.ddl                 ← Quotes with JSONB line items (6 records)
  /db/fact_work_order.ddl            ← Work order execution (6 records)
  /db/30_d_entity.ddl                ← Entity type metadata (parent-child relationships)
  /db/31_d_entity_instance_registry.ddl    ← Entity instance registry (table creation)
  /db/32_d_entity_instance_backfill.ddl ← Backfill existing records ⚠️ NEW!
  /db/33_entity_instance_link.ddl         ← Instance relationships
  /db/34_d_entity_rbac.ddl    ← RBAC permissions

Frontend Config:
  /apps/web/src/lib/entityConfig.ts  ← Entity definitions (service, product, quote, work_order)
  /apps/web/src/lib/fieldGenerator.ts ← DRY field generation
  /apps/web/src/lib/settingsLoader.ts ← Settings mappings ⚠️ UPDATED!
  /apps/web/src/App.tsx              ← Routes (add new entities here)

Frontend Components:
  /apps/web/src/pages/shared/EntitySpecificInstancePage.tsx
  /apps/web/src/components/shared/entity/EntityFormContainer.tsx  ← Field rendering logic
  /apps/web/src/components/shared/entity/QuoteItemsRenderer.tsx   ← Quote-specific table
  /apps/web/src/components/shared/ui/EntityAttributeInlineDataTable.tsx ← Generic JSONB table

Frontend API:
  /apps/web/src/lib/api.ts           ← API clients + APIFactory registration

Backend API:
  /apps/api/src/modules/quote/routes.ts
  /apps/api/src/modules/product/routes.ts
  /apps/api/src/modules/service/routes.ts
  /apps/api/src/modules/work_order/routes.ts
  /apps/api/src/modules/entity/routes.ts ← child-tabs endpoint
  /apps/api/src/modules/index.ts     ← Route registration

Tools:
  /tools/db-import.sh                ← DDL import script ⚠️ UPDATED!
  /tools/test-api.sh                 ← API testing utility
```

---

## Migration & Compatibility

**Backward Compatibility:**
- Old quotes without discount fields: Frontend defaults to 0% discount, 13% tax
- JSONB structure validated on read; missing fields auto-filled
- Entity instance registry backfilled on db-import.sh

**Future Enhancements:**
- Line-item notes modal (expand beyond `line_notes` text)
- Bulk discount application across all items
- Tax exemption flags per line
- Multi-currency support (currently CAD only)
- Work order → invoice flow
- Inventory depletion on work order completion

---

## Quick Reference: JSONB Quote Items

**View Raw Data:**
```sql
SELECT jsonb_pretty(quote_items) FROM app.fact_quote WHERE id = 'uuid';
```

**Update Single Line Item:**
```typescript
const items = quote.quote_items;
items[0].discount_pct = 15;
const calc = calculateLineItem(items[0].quantity, items[0].unit_rate, 15, 13);
items[0] = { ...items[0], ...calc };
await quoteApi.update(quoteId, { quote_items: items });
```

**Calculation Function:**
```typescript
// /apps/web/src/components/shared/entity/QuoteItemsRenderer.tsx:116-124
const calculateLineItem = (quantity, rate, discountPct, taxPct) => {
  const grossAmount = Math.round(quantity * rate * 100) / 100;
  const discountAmt = Math.round(grossAmount * (discountPct / 100) * 100) / 100;
  const subtotal = Math.round((grossAmount - discountAmt) * 100) / 100;
  const taxAmt = Math.round(subtotal * (taxPct / 100) * 100) / 100;
  const lineTotal = Math.round((subtotal + taxAmt) * 100) / 100;
  return { discountAmt, subtotal, taxAmt, lineTotal };
};
```

---

## Summary Statistics

**Database:**
- 4 new tables: d_service, d_product, fact_quote, fact_work_order
- 42 curated records: 15 services + 15 products + 6 quotes + 6 work orders
- 1 backfill script: 32_d_entity_instance_backfill.ddl
- 2 settings tables: dl__quote_stage (8 stages), dl__work_order_status (7 statuses)

**Frontend:**
- 4 entity configs: service, product, quote, work_order
- 2 new components: QuoteItemsRenderer, EntityAttributeInlineDataTable
- 2 settings mappings: dl__quote_stage, dl__work_order_status
- 1 shareable entity: quote (public URL support)
- 1 kanban entity: work_order (7-column kanban board)

**Backend:**
- 4 API modules: service, product, quote, work_order
- 1 universal endpoint: /api/v1/entity/child-tabs/:type/:id
- 4 APIFactory registrations

**Tools:**
- 1 updated script: db-import.sh (added backfill step)

---

**Status:** ✅ Production Ready
**Last Updated:** 2025-11-03
**Maintainer:** PMO Platform Team
**Support:** See `/docs/` for detailed guides
