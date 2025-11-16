# Product & Inventory Domain

> **Purpose**: Product catalog and inventory management for materials, equipment, and supplies. Foundation for quote/order fulfillment and cost tracking.

## Domain Overview

The Product & Inventory Domain manages the complete product catalog with SKU-level items, hierarchical categorization, and real-time stock level tracking across multiple warehouse locations. It provides the foundation for quoting, ordering, and fulfillment operations while enabling accurate cost control and inventory optimization.

### Business Value

- **Product Catalog Management** for 1000+ SKUs across HVAC, plumbing, electrical, landscaping, and general materials
- **4-Level Hierarchical Organization** (Division → Department → Class → Sub-Class) for easy navigation
- **Real-Time Inventory Tracking** with on-hand quantities by location
- **Reorder Management** with threshold alerts and automated reorder quantity recommendations
- **Multi-Location Support** for distributed warehouse and office inventory
- **Cost Foundation** for accurate quote pricing and job costing

## Entities

| Entity | DDL File | Table | Purpose |
|--------|----------|-------|---------|
| **Product** | XI_d_product.ddl | `d_product` | SKU-level product catalog with pricing, UPC, supplier info, and reorder levels |
| **Product Hierarchy** | XI_d_product.ddl | `d_product_hierarchy` | 4-level categorization: Division → Department → Class → Sub-Class |
| **Inventory** | XXVI_f_inventory.ddl | `f_inventory` | Stock levels by product by warehouse/office location with transaction tracking |

## Entity Relationships

```
┌──────────────────────────────────────────────────────────────────┐
│               PRODUCT & INVENTORY DOMAIN                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐                                       │
│  │ Product Hierarchy    │                                       │
│  │ (d_product_hierarchy)│                                       │
│  │                      │                                       │
│  │ 4-Level Structure:   │                                       │
│  │ • Division           │                                       │
│  │ • Department         │                                       │
│  │ • Class              │                                       │
│  │ • Sub-Class          │                                       │
│  └──────────────────────┘                                       │
│           │                                                      │
│           │ categorizes                                          │
│           ▼                                                      │
│  ┌──────────────────────┐         tracked by    ┌─────────────┐│
│  │      Product         │◄──────────────────────┤  Inventory  ││
│  │    (d_product)       │                       │(f_inventory)││
│  │                      │                       │             ││
│  │ • SKU                │                       │ • store_id  ││
│  │ • UPC                │                       │ • qty       ││
│  │ • Brand              │                       │ • location  ││
│  │ • Unit of Measure    │                       └─────────────┘│
│  │ • Reorder Levels     │                             │        │
│  │ • Supplier Part #    │                             │        │
│  └──────────────────────┘                             │        │
│           │                                            │        │
│           │                                            │        │
│           │ used in                          located at        │
│           ▼                                            ▼        │
│  ┌──────────────────────┐                    ┌──────────────┐ │
│  │  Quote Line Items    │                    │   Office     │ │
│  │  Order Line Items    │                    │ (Warehouse)  │ │
│  │  Work Order Details  │                    │              │ │
│  └──────────────────────┘                    └──────────────┘ │
│   (Order Fulfillment                          (Customer 360   │
│    Domain)                                     Domain)         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Relationship Rules

1. **Product Hierarchy → Product**: One-to-many
   - Each product links to one Sub-Class (or Class) via `product_category` field
   - Products can also link via `d_entity_instance_link` for polymorphic relationships
   - Hierarchy is self-referential with `parent_id` for tree structure

2. **Product ↔ Inventory**: One-to-many
   - Each product can have inventory at multiple locations (warehouses/offices)
   - Each inventory record tracks one product at one location
   - Grain: One row per product per store location

3. **Product → Quote/Order**: Many-to-many
   - Products referenced in `quote_items` JSONB array in `fact_quote`
   - Products referenced in order line items and work order details
   - No hard foreign keys - linkage via JSONB and `d_entity_instance_link`

4. **Inventory → Office**: Many-to-one
   - Each inventory record tied to one warehouse/office location
   - Uses `store_id` field linking to `d_office.id`
   - Supports multi-location inventory visibility

## Business Semantics

### Product Lifecycle

```
Draft → Active → Low Stock → Reorder → Restocked → Overstock
                      ↓                                 ↓
                 Out of Stock                    Clearance
                      ↓                                 ↓
                Discontinued                       Archived
```

Products flow through lifecycle stages:
- **Draft**: New products being configured before activation
- **Active**: Available for quoting and ordering
- **Low Stock**: Quantity below `reorder_level_qty` threshold
- **Reorder**: Purchase order triggered for `reorder_qty` units
- **Restocked**: Inventory replenished to target levels
- **Overstock**: Quantity significantly above normal levels
- **Out of Stock**: Zero on-hand quantity
- **Clearance**: Product being phased out with discounted pricing
- **Discontinued**: No longer sold, but historical data preserved
- **Archived**: Soft deleted (`active_flag = false`)

### Product Hierarchy Structure

The **4-level hierarchy** organizes products:

**Level 1 - Division** (Top-level groupings):
- HVAC Products
- Plumbing Products
- Electrical Products
- Landscaping Products
- General Materials

**Level 2 - Department** (Major categories):
- HVAC: Residential HVAC, HVAC Supplies
- Plumbing: Equipment, Fixtures, Materials
- Electrical: Panels, Lighting, Wire & Cable

**Level 3 - Class** (Product classes):
- Central Air Conditioning
- Thermostats
- Air Filters
- Water Heaters
- Kitchen Faucets

**Level 4 - Sub-Class** (Detailed classifications):
- 3-Ton AC Units
- Smart Thermostats
- MERV 11 Filters
- 50-Gallon Water Heaters

**Use Cases**:
- Browse products by category
- Filter quotes/orders by product hierarchy
- Analyze sales by division/department
- Manage inventory by product class

### Inventory Tracking Patterns

**Stock Levels**:
- **On-Hand Qty**: Current physical inventory count
- **Reorder Level**: Threshold qty that triggers reorder alert
- **Reorder Qty**: Standard reorder quantity for replenishment
- **Overstock**: Qty > (Reorder Level × 3)
- **Low Stock**: Qty < Reorder Level
- **Out of Stock**: Qty = 0

**Inventory Transactions** (future enhancement):
- Receipts: Increase inventory from purchase orders
- Issues: Decrease inventory for work orders/projects
- Adjustments: Cycle count corrections
- Transfers: Move inventory between locations
- Returns: Return to supplier or from customer

## Data Patterns

### Product SKU Naming Convention

Products use structured SKU codes for easy identification:

```
PRD-{CATEGORY}-{SEQUENCE}

Examples:
- PRD-HVAC-001: Carrier 3-Ton Central Air Conditioner
- PRD-HVAC-002: Honeywell Smart Thermostat
- PRD-HVAC-003: HVAC Air Filter 20x25x1
- PRD-PLUMB-001: Rheem 50-Gallon Water Heater
- PRD-ELEC-001: Square D 200A Main Breaker Panel
- PRD-LAND-001: Premium Mulch - Cubic Yard
- PRD-GEN-001: Premium Paint Gallon - Interior
```

### Units of Measure

Products support various UOM for accurate quantity tracking:

- **each**: Individual units (HVAC equipment, thermostats, faucets)
- **box**: Packaged quantities (air filters, tiles)
- **roll**: Wire, PEX tubing, cable
- **gallon**: Paint, chemicals
- **cubic_yard**: Mulch, soil
- **square_foot**: Flooring, carpet
- **linear_foot**: Trim, molding
- **bag**: Fertilizer, cement
- **pound (lb)**: Fasteners, screws

### Brand Integration

Products track brand via settings-driven `dl__product_brand` field:

- **HVAC**: Carrier, Trane, Lennox, Honeywell, Filtrete
- **Plumbing**: Rheem, Kohler, Delta, Moen, Uponor
- **Electrical**: Square D, Halo, Southwire, Leviton
- **Landscaping**: Rain Bird, TurfMaster, Nature's Way
- **General**: Sherwin Williams, Benjamin Moore, YellaWood, DalTile

All brands managed in `setting_datalabel` table with entity prefix `product__brand`.

### Inventory Snapshot Model

Inventory uses a **snapshot** model (not transactional):
- One row per product per location
- `qty` field represents current on-hand quantity
- `updated_at` timestamp tracks last inventory update
- Future enhancement: `f_inventory_transaction` for audit trail

**Query Patterns**:
```sql
-- Current stock for product across all locations
SELECT store_id, qty
FROM app.f_inventory
WHERE product_id = 'xxx' AND active_flag = true;

-- Low stock items for reordering
SELECT p.code, p.name, i.qty, p.reorder_level_qty, p.reorder_qty
FROM app.f_inventory i
JOIN app.d_product p ON p.id = i.product_id
WHERE i.qty < p.reorder_level_qty
  AND p.active_flag = true;

-- Inventory value by location
SELECT o.name as warehouse,
       SUM(i.qty * p.unit_cost) as inventory_value
FROM app.f_inventory i
JOIN app.d_product p ON p.id = i.product_id
JOIN app.d_office o ON o.id = i.store_id
GROUP BY o.name;
```

## Use Cases

### UC-1: Product Catalog Browsing

**Actors**: Sales Rep, Project Manager, Estimator

**Flow**:
1. User navigates to Products entity page
2. System loads all active products with hierarchy breadcrumbs
3. User filters by Division → Department → Class → Sub-Class
4. User searches by SKU, name, brand, or category
5. Product grid displays: SKU, Name, Brand, Category, UOM, Current Stock
6. User clicks product for detailed view with full specifications
7. Detail page shows: Pricing, inventory levels across locations, reorder thresholds
8. User can add product to quote or order from detail page

**Entities Touched**: Product, Product Hierarchy, Inventory

### UC-2: Inventory Reorder Workflow

**Actors**: Warehouse Manager, Purchasing Agent, System

**Flow**:
1. System runs nightly job to check inventory levels
2. Query identifies products with `qty < reorder_level_qty`
3. System generates "Low Stock Alert" report with reorder recommendations
4. Warehouse Manager reviews report in dashboard
5. Manager selects products to reorder (auto-fills `reorder_qty`)
6. System creates Purchase Order draft with:
   - Product codes and supplier part numbers
   - Recommended quantities
   - Supplier contact info
7. Purchasing Agent reviews and submits PO to supplier
8. Upon receipt, warehouse updates inventory quantities
9. System marks reorder complete and updates stock levels

**Entities Touched**: Inventory, Product, Office (warehouse), Purchase Order (future)

### UC-3: Multi-Location Stock Check for Quote

**Actors**: Sales Rep, Customer, System

**Flow**:
1. Sales Rep creates quote for customer HVAC installation
2. Quote requires: 1× Carrier 3-Ton AC + 1× Smart Thermostat + 4× Air Filters
3. System queries inventory across all locations:
   ```
   Product: Carrier 3-Ton AC
   - Main Warehouse: 2 units
   - East Branch: 1 unit
   - West Branch: 0 units
   Total Available: 3 units ✓
   ```
4. All products in stock → Quote marked "Ready to Fulfill"
5. If any product out of stock → Quote marked "Backorder Required"
6. Sales Rep can see which location has stock for job planning
7. Project Manager assigns work order to crew at location with inventory
8. Upon job completion, inventory decremented at that location

**Entities Touched**: Product, Inventory, Quote (Order Fulfillment), Office

## Technical Architecture

### Key Tables

```sql
-- Product (d_product)
CREATE TABLE app.d_product (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,              -- 'PRD-HVAC-001'
    name text NOT NULL,                             -- 'Carrier 3-Ton Central AC'
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    active_flag boolean DEFAULT true,

    -- Product identifiers
    style text,                                     -- Product style/model
    sku text,                                       -- Stock Keeping Unit
    upc text,                                       -- Universal Product Code

    -- Categorization
    product_category text,                          -- Links to hierarchy
    dl__product_brand text,                         -- Brand (settings)

    -- Inventory management
    unit_of_measure text DEFAULT 'each',            -- each, box, gallon, etc.
    reorder_level_qty integer DEFAULT 0,            -- Reorder threshold
    reorder_qty integer DEFAULT 0,                  -- Standard reorder qty

    -- Flags
    taxable_flag boolean DEFAULT true,

    -- Supplier info
    supplier_part_number text,                      -- Supplier's SKU

    -- Timestamps
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);

-- Product Hierarchy (d_product_hierarchy)
CREATE TABLE app.d_product_hierarchy (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,               -- 'PROD-HIE-HVAC-DIV'
    name varchar(200) NOT NULL,                     -- 'HVAC Products'
    descr text,

    -- Hierarchy fields
    parent_id uuid,                                 -- Self-referential
    dl__product_hierarchy_level text NOT NULL,      -- Division/Department/Class/Sub-Class

    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);

-- Inventory (f_inventory)
CREATE TABLE app.f_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Location & Product
    store_id UUID,                                  -- Link to d_office
    product_id UUID,                                -- Link to d_product

    -- Stock Level
    qty DECIMAL(12,3) DEFAULT 0,                    -- On-hand quantity

    -- Metadata
    notes TEXT,
    active_flag BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID,                                -- Employee
    last_modified_by UUID
);
```

### API Endpoints

```
# Product Entity
GET    /api/v1/product                 # List products with filters
GET    /api/v1/product/:id             # Get product detail
POST   /api/v1/product                 # Create product
PATCH  /api/v1/product/:id             # Update product
DELETE /api/v1/product/:id             # Soft delete product

# Product Options
GET    /api/v1/entity/product/options  # Dropdown options (brands, categories, UOM)

# Product Hierarchy
GET    /api/v1/product_hierarchy       # List hierarchy nodes
GET    /api/v1/product_hierarchy/:id   # Get hierarchy node + children
POST   /api/v1/product_hierarchy       # Create hierarchy node

# Inventory
GET    /api/v1/inventory                # List inventory across locations
GET    /api/v1/inventory/:id            # Get inventory record
POST   /api/v1/inventory                # Create inventory record
PATCH  /api/v1/inventory/:id            # Update stock quantity
DELETE /api/v1/inventory/:id            # Soft delete inventory record

# Inventory by Product
GET    /api/v1/product/:id/inventory    # Get stock levels for product across all locations

# Inventory by Location
GET    /api/v1/office/:id/inventory     # Get all inventory at warehouse/office

# Low Stock Report
GET    /api/v1/inventory/reports/low-stock  # Products below reorder level
```

### Field Detection Patterns

The Universal Field Detector automatically handles Product & Inventory fields:

```typescript
// Product fields
'sku'                  → Text field
'upc'                  → Text field with barcode icon
'dl__product_brand'    → Settings dropdown (brand options)
'product_category'     → Hierarchy picker
'unit_of_measure'      → Dropdown (each, box, gallon, etc.)
'reorder_level_qty'    → Number input
'reorder_qty'          → Number input
'taxable_flag'         → Boolean toggle
'supplier_part_number' → Text field

// Inventory fields
'qty'                  → Number input (decimal)
'store_id'             → Entity reference (Office)
'product_id'           → Entity reference (Product)
```

## Integration Points

### Upstream Dependencies

- **Customer 360 Domain**: Office (warehouse locations)

### Downstream Dependencies

- **Order & Fulfillment Domain**: Products used in quotes, orders, shipments
- **Financial Management Domain**: Product costs flow to expense tracking
- **Operations Domain**: Products assigned to projects and tasks (materials)
- **Service Delivery Domain**: Products used in service delivery (parts/materials)

### Cross-Domain Workflows

**Quote Creation**:
1. Sales Rep creates Quote (Order Fulfillment)
2. Adds product line items from Product catalog
3. System validates inventory availability
4. Quote pricing pulls product unit costs
5. Upon quote acceptance → Order created
6. Order fulfillment decrements Inventory

**Project Costing**:
1. Project Manager creates Project (Operations)
2. Assigns products/materials needed
3. Products link to Project via `d_entity_instance_link`
4. Product costs flow to Project cost tracking
5. Inventory issued from warehouse to project
6. Actual product costs recorded in Financial Management

## Data Volume & Performance

### Expected Data Volumes

- Products: 1,000 - 10,000 SKUs
- Product Hierarchy Nodes: 100 - 500 nodes across 4 levels
- Inventory Records: 5,000 - 50,000 records (products × locations)
- Daily Inventory Transactions: 500 - 5,000 (future enhancement)

### Indexing Strategy

```sql
-- Product indexes
CREATE INDEX idx_product_code ON app.d_product(code);
CREATE INDEX idx_product_sku ON app.d_product(sku);
CREATE INDEX idx_product_upc ON app.d_product(upc);
CREATE INDEX idx_product_category ON app.d_product(product_category);
CREATE INDEX idx_product_brand ON app.d_product(dl__product_brand);
CREATE INDEX idx_product_active ON app.d_product(active_flag);

-- Hierarchy indexes
CREATE INDEX idx_hierarchy_parent ON app.d_product_hierarchy(parent_id);
CREATE INDEX idx_hierarchy_level ON app.d_product_hierarchy(dl__product_hierarchy_level);

-- Inventory indexes
CREATE INDEX idx_inventory_product ON app.f_inventory(product_id);
CREATE INDEX idx_inventory_store ON app.f_inventory(store_id);
CREATE INDEX idx_inventory_qty ON app.f_inventory(qty);
CREATE INDEX idx_inventory_updated ON app.f_inventory(updated_at);
CREATE UNIQUE INDEX idx_inventory_product_store ON app.f_inventory(product_id, store_id);
```

### Performance Optimizations

- **Denormalized Fields**: Product name/code duplicated in inventory for fast queries
- **Materialized Views**: Pre-computed low stock reports for dashboard
- **Caching**: Product catalog cached in Redis with 1-hour TTL
- **Partitioning**: Inventory table partitioned by `store_id` for large deployments

## Future Enhancements

1. **Inventory Transactions**: Full audit trail with receipts, issues, transfers, adjustments
2. **Lot/Serial Tracking**: Track individual product lots and serial numbers for warranty
3. **Supplier Management**: Supplier entity with lead times, pricing, and PO automation
4. **Pricing Tiers**: Volume-based pricing, customer-specific pricing, promotional pricing
5. **Product Bundles**: Kits with multiple products sold as single unit
6. **Barcode Scanning**: Mobile app for warehouse inventory counts
7. **Product Images**: S3-hosted product photos for catalog and quotes
8. **Product Substitutions**: Alternative products when primary out of stock
9. **Forecasting**: ML-based demand forecasting for reorder optimization
10. **Multi-Currency Support**: Product costs in USD/CAD with exchange rates

---

**Domain Owner**: Inventory & Purchasing Teams
**Last Updated**: 2025-11-13
**Related Domains**: Customer 360 (Office), Order & Fulfillment, Financial Management, Operations
