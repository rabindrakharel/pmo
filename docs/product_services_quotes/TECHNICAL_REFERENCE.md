# Product/Service/Quote System - Technical Reference

**Audience:** Senior fullstack engineers maintaining or extending the feature
**Last Updated:** 2025-11-02

---

## Architecture Overview

### Entity Hierarchy
```
d_service (catalog) ──┐
d_product (catalog) ──┼──> fact_quote.quote_items[] ──> fact_work_order
                      │    (JSONB line items)
```

**Key Design Decisions:**
- **No foreign keys** - Intentional for flexibility; relationships tracked via JSONB and `d_entity_id_map`
- **JSONB for line items** - Per-line discounts/taxes stored in `quote_items[]` array
- **DRY field generation** - Convention-based type detection (suffixes: `_amt`, `_pct`, `_date`, `dl__*`)
- **Universal components** - 3 pages handle all entities: `EntityMainPage`, `EntityDetailPage`, `EntityCreatePage`

---

## Database Schema

### Core Tables
```sql
-- Catalog (dimensions)
d_service:   service_category, standard_rate_amt, is_taxable_flag
d_product:   product_category, unit_price_amt, stock_qty

-- Transactions (facts)
fact_quote:       quote_items JSONB, subtotal_amt, discount_amt, tax_amt, total_amt
fact_work_order:  Execution of accepted quotes
```

### JSONB Structure: `quote_items`
```typescript
interface QuoteItem {
  item_type: 'service' | 'product';
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

---

## Frontend Architecture

### Component Hierarchy
```
EntityDetailPage
  └── EntityFormContainer
        └── QuoteItemsRenderer (for quote_items field)
              └── EntityAttributeInlineDataTable (generic JSONB table)
```

### Key Files

**Entity Configuration** (`/apps/web/src/lib/entityConfig.ts`)
```typescript
quote: {
  shareable: true,                           // Enable /quote/shared/:code
  supportedViews: ['table', 'kanban'],
  kanban: {
    groupByField: 'dl__quote_stage',
    metaTable: 'dl__quote_stage',            // Settings table
    cardFields: ['name', 'quote_total_amt']
  },
  fields: generateEntityFields([
    'quote_items',  // Auto-detected as JSONB → routed to QuoteItemsRenderer
    'subtotal_amt', // Auto-detected as number (suffix: _amt)
    'discount_pct', // Auto-detected as number (suffix: _pct)
    'dl__quote_stage' // Auto-detected as select (prefix: dl__)
  ])
}
```

**Special Field Rendering** (`/apps/web/src/components/shared/entity/EntityFormContainer.tsx`)
```typescript
// Lines 333-340 (View mode)
if (field.type === 'jsonb') {
  if (field.key === 'metadata') return <MetadataTable />;
  if (field.key === 'quote_items') return <QuoteItemsRenderer />;
  // Fallback: formatted JSON textarea
}

// Lines 478-497 (Edit mode)
if (field.key === 'quote_items') {
  return <QuoteItemsRenderer isEditing={true} onChange={...} />;
}
```

**Quote Items Renderer** (`/apps/web/src/components/shared/entity/QuoteItemsRenderer.tsx`)
- Wraps `EntityAttributeInlineDataTable` with quote-specific logic
- Loads services/products from API for dropdowns
- Auto-calculates discount, subtotal, tax on change
- Columns: Type | Code | Description | Qty | Rate | Disc% | Subtotal | Tax% | Total

**Generic JSONB Table** (`/apps/web/src/components/shared/ui/EntityAttributeInlineDataTable.tsx`)
- Reusable for ANY JSONB attribute (not just quote_items)
- Based on `SettingsDataTable` pattern
- Props: `columns`, `renderCell`, `onRowUpdate`, `onAddRow`, `onDeleteRow`

---

## Field Generation (DRY Pattern)

### Convention-Based Detection
```typescript
generateEntityFields(['discount_pct', 'subtotal_amt', 'dl__quote_stage'])
// Auto-generates:
{
  key: 'discount_pct',
  label: 'Discount %',
  type: 'number',           // ← suffix _pct
},
{
  key: 'subtotal_amt',
  label: 'Subtotal',
  type: 'number',           // ← suffix _amt
},
{
  key: 'dl__quote_stage',
  label: 'Quote Stage',
  type: 'select',           // ← prefix dl__
  loadOptionsFromSettings: 'dl__quote_stage'  // ← auto-linked to settings
}
```

### Detection Rules (Priority Order)
1. **Prefix `dl__`** → `select` + `loadOptionsFromSettings`
2. **Suffix `_pct`** → `number` (percentage)
3. **Suffix `_amt`** → `number` (currency)
4. **Suffix `_date`** → `date`
5. **Suffix `_flag`** → `boolean`
6. **Default** → `text`

### Override Mechanism
```typescript
generateEntityFields(
  ['quote_items', 'customer_notes'],
  {
    overrides: {
      quote_items: { type: 'jsonb' },      // Override detection
      customer_notes: { type: 'textarea' } // Override default text
    }
  }
)
```

---

## Design Patterns Applied

### 1. Shareable URLs
```typescript
// entityConfig.ts
quote: { shareable: true }

// App.tsx routes
<Route path="/quote/shared/:code" element={<SharedURLEntityPage />} />

// API: GET /api/v1/quote/shared/:code (no auth required)
```

### 2. Kanban Views
```typescript
kanban: {
  groupByField: 'dl__quote_stage',        // Field to group by
  metaTable: 'dl__quote_stage',           // Settings table for columns
  cardFields: ['name', 'quote_total_amt'] // Fields on cards
}
```

**Sequential State Enforcement:**
- Frontend validates: Draft (0) → Sent (1) → Accepted (4) | Rejected (5)
- Uses `setting_datalabel.data_label[].id` for ordering

### 3. Multi-Select Employee Assignment
```typescript
{
  key: 'assigned_technician_ids',
  type: 'multiselect',
  loadOptionsFromEntity: 'employee'  // Loads from /api/v1/employee
}
```

**Database:** `uuid[]` array
**Rendering:** `renderEmployeeNames()` joins names from IDs

---

## API Integration

### Entity API Client (`/apps/web/src/lib/api.ts`)
```typescript
// Lines 729-760: Quote API
export const quoteApi = {
  async list(params) { /* ... */ },
  async get(id) { /* ... */ },
  async create(data) { /* ... */ },
  async update(id, data) { /* ... */ },
  async delete(id) { /* ... */ },

  // Child entity support
  async getWorkOrders(quoteId, params) {
    return apiClient.get(`/api/v1/quote/${quoteId}/work_order`, { params });
  }
};

// Lines 1037-1040: Factory registration
APIFactory.register('quote', quoteApi);
APIFactory.register('work_order', workOrderApi);
```

### Backend Routes (`/apps/api/src/modules/quote/routes.ts`)
```typescript
// Standard CRUD
GET    /api/v1/quote
POST   /api/v1/quote
GET    /api/v1/quote/:id
PATCH  /api/v1/quote/:id
DELETE /api/v1/quote/:id

// Public sharing
GET    /api/v1/quote/shared/:code  // No auth

// Child entities
GET    /api/v1/quote/:id/work_order
```

---

## Extension Patterns

### Adding a New JSONB Field Renderer

**Example:** Custom `task_updates` renderer

1. **Create Renderer Component:**
```typescript
// /apps/web/src/components/shared/entity/TaskUpdatesRenderer.tsx
export function TaskUpdatesRenderer({ value, onChange, isEditing }) {
  const columns = [
    { key: 'timestamp', title: 'Time' },
    { key: 'update_text', title: 'Update' }
  ];

  return (
    <EntityAttributeInlineDataTable
      data={value || []}
      columns={columns}
      onRowUpdate={...}
      allowEdit={isEditing}
    />
  );
}
```

2. **Register in EntityFormContainer:**
```typescript
// EntityFormContainer.tsx - View mode
if (field.key === 'task_updates') {
  return <TaskUpdatesRenderer value={value} isEditing={false} />;
}

// Edit mode
if (field.key === 'task_updates') {
  return <TaskUpdatesRenderer value={value} onChange={...} isEditing={true} />;
}
```

3. **Entity Config:**
```typescript
task: {
  fields: [
    ...generateEntityFields(['task_updates'], {
      overrides: { task_updates: { type: 'jsonb' } }
    })
  ]
}
```

### Adding a New Entity

1. **Database DDL** (`/db/new_entity.ddl`)
2. **Insert into `d_entity`** table (sidebar navigation)
3. **Entity Config** (`entityConfig.ts`)
4. **API Module** (`/apps/api/src/modules/new_entity/`)
5. **Frontend API Client** (`api.ts` + `APIFactory.register()`)
6. **Update `coreEntities`** array in `App.tsx`

---

## Testing & Validation

### Database Validation
```bash
# Import schema
./tools/db-import.sh

# Verify quote structure
psql -c "SELECT jsonb_pretty(quote_items) FROM app.fact_quote WHERE code='QT-2024-001';"

# Check totals
psql -c "SELECT code, subtotal_amt, discount_amt, quote_tax_amt, quote_total_amt FROM app.fact_quote;"
```

### API Testing
```bash
# List quotes
./tools/test-api.sh GET /api/v1/quote

# Get specific quote
./tools/test-api.sh GET /api/v1/quote/{uuid}

# Update quote items
./tools/test-api.sh PATCH /api/v1/quote/{uuid} '{"quote_items":[...]}'
```

### Frontend Testing
1. Navigate to `/quote`
2. Click row → Detail page
3. Toggle Edit mode
4. Modify `quote_items`:
   - Change quantity → verify recalculation
   - Edit discount % → verify subtotal/tax/total update
   - Add new line item → verify dropdown population
5. Switch to Kanban view
6. Test shareable URL: `/quote/shared/{code}`

---

## Performance Considerations

**JSONB Indexing:**
```sql
-- If querying within quote_items becomes slow:
CREATE INDEX idx_quote_items_gin ON app.fact_quote USING gin(quote_items);
```

**API Pagination:**
- Default: 20 items per page
- Override: `?page=2&pageSize=50`
- Max: 100 items per page

**Frontend Optimization:**
- `EntityAttributeInlineDataTable` renders all rows (no virtualization)
- For >100 line items, consider virtualization (react-window)

---

## Common Pitfalls

### 1. Invalid UUIDs in DDL
❌ **Wrong:** `INSERT INTO fact_quote (id, ...) VALUES ('q1111111-...', ...)`
✅ **Correct:** `INSERT INTO fact_quote (code, ...) VALUES (...)` (let DB generate UUID)

### 2. Field Type Detection Conflicts
If `discount_amount` incorrectly detected as `text`:
```typescript
// Override in entity config
overrides: {
  discount_amount: { type: 'number' }
}
```

### 3. Missing API Registration
```typescript
// Symptoms: "API not found for entity type: 'quote'"
// Fix: Register in APIFactory
APIFactory.register('quote', quoteApi);
```

### 4. JSONB Field Not Rendering
Check `EntityFormContainer.tsx` for special field handling:
```typescript
if (field.key === 'your_jsonb_field') {
  return <YourCustomRenderer />;
}
```

---

## File Map (Critical Paths)

```
Database:
  /db/d_service.ddl                  ← Service catalog
  /db/d_product.ddl                  ← Product catalog
  /db/fact_quote.ddl                 ← Quotes with JSONB line items
  /db/fact_work_order.ddl            ← Work order execution

Frontend Config:
  /apps/web/src/lib/entityConfig.ts  ← Entity definitions (shareable, kanban, fields)
  /apps/web/src/App.tsx              ← Routes (add new entities here)

Frontend Components:
  /apps/web/src/pages/shared/EntityDetailPage.tsx
  /apps/web/src/components/shared/entity/EntityFormContainer.tsx  ← Field rendering logic
  /apps/web/src/components/shared/entity/QuoteItemsRenderer.tsx   ← Quote-specific table
  /apps/web/src/components/shared/ui/EntityAttributeInlineDataTable.tsx  ← Generic JSONB table

Frontend API:
  /apps/web/src/lib/api.ts           ← API clients + APIFactory registration

Backend API:
  /apps/api/src/modules/quote/routes.ts
  /apps/api/src/modules/product/routes.ts
  /apps/api/src/modules/service/routes.ts
```

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

## Migration & Compatibility

**Backward Compatibility:**
- Old quotes without discount fields: Frontend defaults to 0% discount, 13% tax
- JSONB structure validated on read; missing fields auto-filled

**Future Enhancements:**
- Line-item notes modal (expand beyond `line_notes` text)
- Bulk discount application across all items
- Tax exemption flags per line
- Multi-currency support (currently CAD only)

---

**Status:** Production-ready
**Maintainer:** PMO Platform Team
**Support:** See `/docs/` for detailed guides
