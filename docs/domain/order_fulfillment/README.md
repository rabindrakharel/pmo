# Order & Fulfillment Domain

> **Purpose**: Quote-to-cash lifecycle management encompassing sales pipelines, order processing, shipment logistics, and invoicing. End-to-end revenue generation workflow.

## Domain Overview

The Order & Fulfillment Domain manages the complete sales lifecycle from initial customer quotation through order confirmation, warehouse fulfillment, shipment delivery, and final invoicing. It orchestrates the quote-to-cash process with integrated product pricing, inventory allocation, delivery logistics, and payment collection.

### Business Value

- **Quote-to-Cash Automation** streamlines sales from proposal to payment
- **Multi-Stage Quote Pipeline** tracks Draft → Sent → Accepted → Rejected
- **Order Processing** with line-item detail, pricing, discounts, and taxes
- **Shipment Tracking** with carrier integration and delivery confirmation
- **Invoicing** with payment terms, aging, and revenue recognition
- **Revenue Analytics** by customer, product, region, and sales rep

## Entities

| Entity | DDL File | Table | Purpose |
|--------|----------|-------|---------|
| **Quote** | XXX_fact_quote.ddl | `fact_quote` | Customer price proposals with line items, validity periods, and approval workflow |
| **Order** | XXVII_f_order.ddl | `f_order` | Customer purchase orders with fulfillment tracking and delivery management |
| **Shipment** | XXVIII_f_shipment.ddl | `f_shipment` | Outbound shipments with carrier tracking, delivery status, and proof of delivery |
| **Invoice** | XXIX_f_invoice.ddl | `f_invoice` | Customer invoices with payment tracking, aging, and revenue recognition |

## Entity Relationships

```
┌───────────────────────────────────────────────────────────────────────┐
│                  ORDER & FULFILLMENT DOMAIN                          │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────┐                                                        │
│  │  Quote   │ (Quote-to-Cash Pipeline)                               │
│  │(fact_quote)                                                        │
│  │          │                                                         │
│  │ Stages:  │                                                         │
│  │ • Draft  │                                                         │
│  │ • Sent   │                                                         │
│  │ • Accepted ──────────── converts to ───────►┌────────────┐       │
│  │ • Rejected                                   │   Order    │       │
│  └──────────┘                                   │  (f_order) │       │
│       │                                          │            │       │
│       │ references                               │ • Confirmed│       │
│       │                                          │ • Processing│      │
│       ▼                                          │ • Shipped  │       │
│  ┌──────────────┐                               │ • Delivered│       │
│  │   Product    │◄─────────────────────────────┤            │       │
│  │ (from Product│                               └────────────┘       │
│  │  & Inventory │                                     │              │
│  │   Domain)    │                                     │ fulfills     │
│  └──────────────┘                                     ▼              │
│       │                                          ┌────────────┐       │
│       │ stock check                              │  Shipment  │       │
│       ▼                                          │(f_shipment)│       │
│  ┌──────────────┐                               │            │       │
│  │  Inventory   │◄──────── allocated ──────────┤ • Picked   │       │
│  │(f_inventory) │                               │ • Packed   │       │
│  │              │                               │ • Shipped  │       │
│  └──────────────┘                               │ • Delivered│       │
│                                                  └────────────┘       │
│                                                        │              │
│                                                        │ generates    │
│                                                        ▼              │
│  ┌──────────────┐                               ┌────────────┐       │
│  │   Customer   │◄──────── bills ──────────────┤  Invoice   │       │
│  │  (d_client)  │                               │(f_invoice) │       │
│  │              │                               │            │       │
│  │ from Customer│                               │ • Unpaid   │       │
│  │ 360 Domain   │                               │ • Partial  │       │
│  └──────────────┘                               │ • Paid     │       │
│       ▲                                          └────────────┘       │
│       │ assigned to                                    │              │
│       │                                                │ recognizes   │
│       │                                                ▼              │
│  ┌──────────────┐                               ┌────────────┐       │
│  │   Project    │                               │  Revenue   │       │
│  │ (d_project)  │                               │(f_revenue) │       │
│  │              │                               │            │       │
│  │from Operations│                              │  Financial │       │
│  │   Domain     │                               │ Management │       │
│  └──────────────┘                               └────────────┘       │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Relationship Rules

1. **Quote → Order**: One-to-one conversion
   - Accepted Quote converts to Order
   - Quote line items → Order line items
   - Quote pricing/discounts → Order pricing
   - Quote ID tracked in Order metadata

2. **Order → Shipment**: One-to-many
   - Single order can have multiple partial shipments
   - Order line items allocated to shipments
   - Shipment tracks fulfillment status per line
   - Links via `d_entity_instance_link` or order_id reference

3. **Order → Invoice**: One-to-one or many-to-one
   - Each order generates one invoice (standard)
   - Multiple orders can be consolidated into single invoice
   - Invoice line items map to order line items
   - Payment status synced between Order and Invoice

4. **Shipment → Order**: Many-to-one
   - Multiple shipments can fulfill single order
   - Partial shipments update order fulfillment status
   - Final shipment completes order

5. **Quote/Order/Invoice → Customer**: Many-to-one
   - All entities link to d_client (Customer 360)
   - Customer denormalized fields for performance
   - RBAC permissions via customer assignment

6. **Quote/Order → Product**: Many-to-many
   - Line items stored in JSONB arrays
   - No hard foreign keys
   - Product pricing pulled at quote/order creation time

## Business Semantics

### Quote-to-Cash Lifecycle

```
┌─────────┐      ┌──────┐      ┌─────────┐      ┌──────────┐      ┌─────────┐
│ Quote   │ ───► │Order │ ───► │Shipment │ ───► │ Invoice  │ ───► │ Revenue │
│ Created │      │Placed│      │ Shipped │      │Generated │      │Recognized│
└─────────┘      └──────┘      └─────────┘      └──────────┘      └─────────┘
    │                │              │                 │                 │
    ▼                ▼              ▼                 ▼                 ▼
  Draft           Confirmed      Picked             Sent            Booked
  Sent            Processing     Packed             Due
  Accepted        Allocated      Shipped            Paid
  Rejected        Backordered    Delivered          Overdue
```

**Stage Definitions**:

**Quote Stages** (`dl__quote_stage`):
- **Draft**: Quote being prepared, not yet sent to customer
- **Sent**: Quote delivered to customer, awaiting response
- **Accepted**: Customer accepted quote → triggers Order creation
- **Rejected**: Customer declined quote
- **Expired**: Quote validity period passed without acceptance
- **Revised**: Quote modified after initial send (increments version)

**Order Status** (`order_status`):
- **Quote**: Linked to accepted quote, pending confirmation
- **Pending**: Order created but not yet confirmed
- **Confirmed**: Order confirmed, ready for fulfillment
- **Processing**: Order being picked/packed in warehouse
- **Shipped**: All items shipped to customer
- **Delivered**: Customer received shipment
- **Cancelled**: Order cancelled before fulfillment
- **Returned**: Customer returned items

**Shipment Status** (`shipment_status`):
- **Pending**: Shipment created, not yet picked
- **Picking**: Warehouse picking items
- **Picked**: All items picked, ready for packing
- **Packing**: Items being packed
- **Ready**: Packed and ready for carrier pickup
- **Shipped**: In transit with carrier
- **Delivered**: Delivered to customer
- **Exception**: Delivery exception (address issue, refused, etc.)

**Invoice Status** (`payment_status`):
- **Unpaid**: Invoice sent, no payment received
- **Partial**: Partial payment received
- **Paid**: Fully paid
- **Overdue**: Past due date without payment
- **Refunded**: Payment refunded to customer
- **Written Off**: Bad debt, no longer pursuing

### Quote Line Items JSONB Structure

Quotes store line items in JSONB array for flexibility:

```json
{
  "quote_items": [
    {
      "item_type": "service",
      "item_id": "uuid-...",
      "item_code": "SVC-HVAC-001",
      "item_name": "HVAC Installation",
      "quantity": 1.0,
      "unit_rate": 5500.00,
      "discount_pct": 10.00,
      "discount_amt": 550.00,
      "subtotal": 4950.00,
      "tax_pct": 13.00,
      "tax_amt": 643.50,
      "line_total": 5593.50,
      "line_notes": "Includes labor and materials"
    },
    {
      "item_type": "product",
      "item_id": "uuid-...",
      "item_code": "PRD-HVAC-001",
      "item_name": "Carrier 3-Ton AC",
      "quantity": 1.0,
      "unit_rate": 3200.00,
      "discount_pct": 0.00,
      "discount_amt": 0.00,
      "subtotal": 3200.00,
      "tax_pct": 13.00,
      "tax_amt": 416.00,
      "line_total": 3616.00,
      "line_notes": ""
    }
  ],
  "subtotal_amt": 8150.00,
  "discount_amt": 550.00,
  "quote_tax_amt": 1059.50,
  "quote_total_amt": 9209.50
}
```

**Calculation Logic**:
1. Line Discount: `unit_rate × quantity × (discount_pct / 100)`
2. Line Subtotal: `(unit_rate × quantity) - discount_amt`
3. Line Tax: `subtotal × (tax_pct / 100)`
4. Line Total: `subtotal + tax_amt`
5. Quote Total: Sum all line totals

### Order Fulfillment Workflow

```
Order Confirmed
    │
    ▼
Inventory Allocated ──► [Sufficient Stock?] ──No──► Backorder Created
    │                          │
    │                         Yes
    ▼                          │
Picking Started ◄──────────────┘
    │
    ▼
Items Picked ──► Quality Check ──► Items Packed
    │                                     │
    ▼                                     ▼
Shipment Created                   Label Generated
    │                                     │
    ▼                                     ▼
Carrier Picked Up                  Tracking # Assigned
    │                                     │
    ▼                                     ▼
In Transit                          Customer Notified
    │                                     │
    ▼                                     ▼
Delivered                           Invoice Generated
    │                                     │
    ▼                                     ▼
Order Complete                      Payment Due
```

### Payment Terms

Standard Canadian payment terms (`payment_terms`):

- **Due on Receipt**: Payment due immediately
- **Net 15**: Payment due within 15 days
- **Net 30**: Payment due within 30 days (most common)
- **Net 60**: Payment due within 60 days (large commercial)
- **COD**: Cash on delivery
- **Prepaid**: Payment before shipment
- **2/10 Net 30**: 2% discount if paid within 10 days, else net 30

## Data Patterns

### Quote Numbering Convention

Quotes use year-based sequential numbering:

```
QT-{YEAR}-{SEQUENCE}

Examples:
- QT-2025-00001
- QT-2025-00002
- QT-2025-00123
```

### Order Numbering Convention

Orders use year-based sequential numbering:

```
ORD-{YEAR}-{SEQUENCE}

Examples:
- ORD-2025-00001
- ORD-2025-00456
- ORD-2025-01234
```

### Invoice Numbering Convention

Invoices use year-based sequential numbering:

```
INV-{YEAR}-{SEQUENCE}

Examples:
- INV-2025-00001
- INV-2025-00789
- INV-2025-02345
```

### Shipment Tracking Pattern

Shipments track carrier and tracking number:

```
{
  "carrier": "Canada Post",
  "tracking_number": "1234567890123456",
  "service_level": "Expedited Parcel",
  "estimated_delivery": "2025-01-20",
  "tracking_url": "https://www.canadapost.ca/track?pin=1234567890123456"
}
```

### Canadian Tax Calculation

Orders and invoices calculate taxes based on province:

| Province | Tax Type | Rate | Calculation |
|----------|----------|------|-------------|
| Ontario | HST | 13% | subtotal × 0.13 |
| Quebec | GST + QST | 5% + 9.975% | subtotal × 0.14975 |
| Alberta | GST | 5% | subtotal × 0.05 |
| BC | GST + PST | 5% + 7% | subtotal × 0.12 |
| Manitoba | GST + PST | 5% + 7% | subtotal × 0.12 |
| Saskatchewan | GST + PST | 5% + 6% | subtotal × 0.11 |

Tax exempt customers (`tax_exempt_flag = true`) skip tax calculation.

## Use Cases

### UC-1: Quote Creation and Approval

**Actors**: Sales Rep, Customer, Manager

**Flow**:
1. Sales Rep creates Quote for customer HVAC installation
2. Adds line items:
   - Service: HVAC Installation (1× $5,500)
   - Product: Carrier 3-Ton AC (1× $3,200)
3. System calculates:
   - Subtotal: $8,700
   - Discount: 10% on service = $550
   - Tax (13% HST Ontario): $1,059.50
   - Total: $9,209.50
4. Quote saved as "Draft"
5. Sales Rep reviews and sets validity period (30 days)
6. Quote status → "Sent", customer receives PDF via email
7. Customer reviews and accepts quote online
8. Quote status → "Accepted"
9. System auto-creates Order from accepted Quote
10. Order status = "Confirmed", inventory allocated
11. Customer and Sales Rep notified

**Entities Touched**: Quote, Product, Service, Customer, Order

### UC-2: Order Fulfillment with Partial Shipment

**Actors**: Warehouse Manager, Picker, Packer, Customer

**Flow**:
1. Order created with 3 line items:
   - 10× Air Filters (in stock)
   - 1× Water Heater (in stock)
   - 1× Smart Thermostat (backordered)
2. Warehouse Manager reviews order, sees partial stock
3. Creates Shipment #1 for available items (filters + water heater)
4. Picker receives pick list, locates items in warehouse
5. Items scanned and marked "Picked" in system
6. Packer receives items, packs in boxes
7. Shipping label generated with Canada Post tracking #
8. Shipment #1 status → "Shipped"
9. Customer notified: "Partial shipment on the way, tracking: 123456"
10. Order status → "Partial" (1 item still backordered)
11. Smart Thermostat arrives from supplier 5 days later
12. Shipment #2 created for backordered item
13. Same fulfillment process, Shipment #2 shipped
14. Order status → "Shipped" (all items fulfilled)
15. Customer receives both shipments
16. Order status → "Delivered"
17. Invoice generated with payment terms Net 30

**Entities Touched**: Order, Product, Inventory, Shipment, Invoice, Customer

### UC-3: Invoice Payment Tracking

**Actors**: Accounting Clerk, Customer, System

**Flow**:
1. Order delivered, Invoice auto-generated
2. Invoice details:
   - Number: INV-2025-00123
   - Amount: $9,209.50
   - Terms: Net 30
   - Due Date: 2025-02-15
3. Invoice status = "Unpaid"
4. Invoice sent to customer via email (PDF attachment)
5. Customer pays $5,000 on 2025-02-01
6. Accounting Clerk records payment in system
7. Invoice status → "Partial"
8. Invoice aging report shows:
   - Total: $9,209.50
   - Paid: $5,000.00
   - Balance: $4,209.50
   - Days Outstanding: 15
9. Customer pays remaining $4,209.50 on 2025-02-14
10. Accounting Clerk records second payment
11. Invoice status → "Paid"
12. Revenue recognized in Financial Management domain
13. Customer payment history updated

**Entities Touched**: Invoice, Order, Customer, Revenue (Financial Management)

## Technical Architecture

### Key Tables

```sql
-- Quote (fact_quote)
CREATE TABLE app.fact_quote (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,               -- 'QT-2025-00001'
    name text NOT NULL,
    dl__quote_stage text,                           -- Draft/Sent/Accepted/Rejected

    -- Line items
    quote_items jsonb DEFAULT '[]'::jsonb,          -- Array of services/products

    -- Financial fields
    subtotal_amt decimal(15,2) DEFAULT 0.00,
    discount_pct numeric(5,2) DEFAULT 0.00,
    discount_amt decimal(15,2) DEFAULT 0.00,
    tax_pct numeric(5,2) DEFAULT 13.00,             -- HST for Ontario
    quote_tax_amt decimal(15,2) DEFAULT 0.00,
    quote_total_amt decimal(15,2) DEFAULT 0.00,

    -- Quote lifecycle
    valid_until_date date,
    sent_date date,
    accepted_date date,
    rejected_date date,

    -- Customer context
    customer_name text,
    customer_email text,
    customer_phone text,

    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);

-- Order (f_order)
CREATE TABLE app.f_order (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Order identification
    order_number VARCHAR(50) NOT NULL UNIQUE,       -- 'ORD-2025-00001'
    order_line_number INTEGER DEFAULT 1,            -- Line item sequence
    order_type VARCHAR(50) DEFAULT 'standard',

    -- Dates
    order_date DATE NOT NULL,
    requested_delivery_date DATE,
    promised_delivery_date DATE,
    actual_delivery_date DATE,

    -- Customer
    client_id UUID,
    client_name VARCHAR(255),

    -- Product
    product_id UUID NOT NULL,
    product_code VARCHAR(50),
    product_name VARCHAR(255),

    -- Quantities
    qty_ordered DECIMAL(12,3) NOT NULL,
    qty_shipped DECIMAL(12,3) DEFAULT 0,
    quantity_backordered DECIMAL(12,3) DEFAULT 0,

    -- Pricing
    unit_list_price_cad DECIMAL(12,2) NOT NULL,
    unit_sale_price_cad DECIMAL(12,2) NOT NULL,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    extended_sale_price_cad DECIMAL(12,2),
    tax_amount_cad DECIMAL(12,2) DEFAULT 0,
    line_total_cad DECIMAL(12,2),

    -- Status
    order_status VARCHAR(50) DEFAULT 'pending',
    fulfillment_status VARCHAR(50) DEFAULT 'unfulfilled',
    payment_status VARCHAR(50) DEFAULT 'unpaid',

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Shipment (f_shipment)
CREATE TABLE app.f_shipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Shipment identification
    shipment_number VARCHAR(50) NOT NULL UNIQUE,    -- 'SHP-2025-00001'
    tracking_number VARCHAR(100),                   -- Carrier tracking #

    -- Carrier
    carrier VARCHAR(100),                           -- Canada Post, UPS, FedEx
    carrier_service VARCHAR(100),                   -- Expedited, Standard, Express

    -- Dates
    ship_date DATE,
    estimated_delivery_date DATE,
    actual_delivery_date DATE,

    -- Status
    shipment_status VARCHAR(50) DEFAULT 'pending',

    -- Delivery address
    delivery_address_line1 VARCHAR(255),
    delivery_city VARCHAR(100),
    delivery_province VARCHAR(2),
    delivery_postal_code VARCHAR(7),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Invoice (f_invoice)
CREATE TABLE app.f_invoice (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Invoice identification
    invoice_number VARCHAR(50) NOT NULL UNIQUE,     -- 'INV-2025-00001'

    -- Dates
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    paid_date DATE,

    -- Customer
    client_id UUID,
    client_name VARCHAR(255),

    -- Amounts
    subtotal_amt DECIMAL(15,2),
    tax_amt DECIMAL(15,2),
    total_amt DECIMAL(15,2),
    amount_paid DECIMAL(15,2) DEFAULT 0,
    balance_due DECIMAL(15,2),

    -- Payment
    payment_status VARCHAR(50) DEFAULT 'unpaid',
    payment_terms VARCHAR(50) DEFAULT 'net_30',

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints

```
# Quote
GET    /api/v1/quote                   # List quotes
GET    /api/v1/quote/:id               # Get quote detail
POST   /api/v1/quote                   # Create quote
PATCH  /api/v1/quote/:id               # Update quote
DELETE /api/v1/quote/:id               # Soft delete quote
POST   /api/v1/quote/:id/send          # Send quote to customer
POST   /api/v1/quote/:id/accept        # Accept quote → create order
POST   /api/v1/quote/:id/reject        # Reject quote

# Order
GET    /api/v1/order                   # List orders
GET    /api/v1/order/:id               # Get order detail
POST   /api/v1/order                   # Create order
PATCH  /api/v1/order/:id               # Update order
DELETE /api/v1/order/:id               # Cancel order
POST   /api/v1/order/:id/confirm       # Confirm order
POST   /api/v1/order/:id/ship          # Mark shipped

# Shipment
GET    /api/v1/shipment                # List shipments
GET    /api/v1/shipment/:id            # Get shipment detail
POST   /api/v1/shipment                # Create shipment
PATCH  /api/v1/shipment/:id            # Update shipment
POST   /api/v1/shipment/:id/track      # Get tracking updates

# Invoice
GET    /api/v1/invoice                 # List invoices
GET    /api/v1/invoice/:id             # Get invoice detail
POST   /api/v1/invoice                 # Create invoice
PATCH  /api/v1/invoice/:id             # Update invoice
POST   /api/v1/invoice/:id/payment     # Record payment
GET    /api/v1/invoice/aging           # Aging report
```

## Integration Points

### Upstream Dependencies

- **Customer 360 Domain**: Customer (client), Employee (sales rep), Office (selling location)
- **Product & Inventory Domain**: Product (catalog), Inventory (stock allocation)
- **Service Delivery Domain**: Service (for quote line items)

### Downstream Dependencies

- **Financial Management Domain**: Revenue recognition from paid invoices
- **Operations Domain**: Project/Task linkage for job-based orders

### Cross-Domain Workflows

**Quote → Order → Revenue**:
1. Quote created in Order & Fulfillment
2. Quote accepted → Order created
3. Order fulfilled → Shipment created
4. Shipment delivered → Invoice generated
5. Invoice paid → Revenue recognized in Financial Management

**Project → Order → Inventory**:
1. Project Manager creates Project (Operations)
2. Project requires materials → Order created
3. Order pulls from Inventory (Product & Inventory)
4. Inventory allocated to Project
5. Project cost updated with Order line items

## Data Volume & Performance

### Expected Data Volumes

- Quotes: 5,000 - 50,000 per year
- Orders: 10,000 - 100,000 per year (includes order line items)
- Shipments: 5,000 - 50,000 per year
- Invoices: 5,000 - 50,000 per year

### Indexing Strategy

```sql
-- Quote indexes
CREATE INDEX idx_quote_stage ON app.fact_quote(dl__quote_stage);
CREATE INDEX idx_quote_customer ON app.fact_quote(customer_email);
CREATE INDEX idx_quote_dates ON app.fact_quote(sent_date, valid_until_date);

-- Order indexes
CREATE INDEX idx_order_number ON app.f_order(order_number);
CREATE INDEX idx_order_client ON app.f_order(client_id);
CREATE INDEX idx_order_product ON app.f_order(product_id);
CREATE INDEX idx_order_status ON app.f_order(order_status);
CREATE INDEX idx_order_date ON app.f_order(order_date);

-- Shipment indexes
CREATE INDEX idx_shipment_tracking ON app.f_shipment(tracking_number);
CREATE INDEX idx_shipment_status ON app.f_shipment(shipment_status);
CREATE INDEX idx_shipment_date ON app.f_shipment(ship_date);

-- Invoice indexes
CREATE INDEX idx_invoice_number ON app.f_invoice(invoice_number);
CREATE INDEX idx_invoice_client ON app.f_invoice(client_id);
CREATE INDEX idx_invoice_status ON app.f_invoice(payment_status);
CREATE INDEX idx_invoice_due_date ON app.f_invoice(due_date);
```

## Future Enhancements

1. **Quote Templates**: Pre-configured quote templates for common services
2. **Dynamic Pricing**: Volume discounts, customer-specific pricing, seasonal promotions
3. **Purchase Orders**: Supplier PO management for product procurement
4. **Backorder Automation**: Auto-create PO when inventory insufficient
5. **Shipping Integration**: Real-time carrier API for rates and tracking
6. **Payment Gateway**: Stripe/Square integration for online payment
7. **Recurring Orders**: Subscription-based automatic reordering
8. **Order Portal**: Customer self-service portal for order tracking
9. **Advanced Workflows**: Multi-approval quote process for large deals
10. **Packing Slips**: Auto-generated packing slips for warehouse

---

**Domain Owner**: Sales & Fulfillment Teams
**Last Updated**: 2025-11-13
**Related Domains**: Customer 360, Product & Inventory, Financial Management, Operations
