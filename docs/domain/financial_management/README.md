# Financial Management Domain

> **Purpose**: Revenue and expense tracking with CRA T2125 tax compliance. Complete financial visibility for profitability analysis, cost control, and Canadian business tax reporting.

## Domain Overview

The Financial Management Domain provides comprehensive financial tracking and reporting for Canadian home services operations. It captures all revenue and expense transactions with CRA T2125-compliant categorization, enabling accurate tax filing, profitability analysis, cost control, and financial forecasting across projects, customers, business units, and offices.

### Business Value

- **CRA T2125 Compliance** for accurate Canadian business tax reporting
- **Revenue Recognition** tracking by customer, project, product, and time period
- **Expense Management** with category-based cost control and budget tracking
- **Profitability Analysis** with margin calculations by entity (project, customer, business)
- **Tax Deductibility** tracking with GST/HST input tax credit (ITC) recovery
- **Financial Reporting** for P&L, balance sheet, cash flow, and budget variance

## Entities

| Entity | DDL File | Table | Purpose |
|--------|----------|-------|---------|
| **Revenue** | LII_f_revenue.ddl | `f_revenue` | Income transactions from invoices with CRA T2125 categorization and revenue recognition |
| **Expense** | LIII_f_expense.ddl | `f_expense` | Cost transactions with CRA T2125 categorization, tax deductibility, and receipt attachments |

## Entity Relationships

```
┌────────────────────────────────────────────────────────────────────┐
│              FINANCIAL MANAGEMENT DOMAIN                          │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────┐                   ┌──────────────────┐      │
│  │     Invoice      │──generates───────►│     Revenue      │      │
│  │   (f_invoice)    │                   │   (f_revenue)    │      │
│  │                  │                   │                  │      │
│  │ from Order &     │                   │ • CRA Category   │      │
│  │ Fulfillment      │                   │ • CRA Subcategory│      │
│  │ Domain           │                   │ • Margin         │      │
│  └──────────────────┘                   │ • Tax Amounts    │      │
│         │                                └──────────────────┘      │
│         │ linked to                              │                │
│         ▼                                        │ linked to      │
│  ┌──────────────────┐                           │                │
│  │    Customer      │◄──────────────────────────┘                │
│  │   (d_client)     │                                             │
│  │                  │                                             │
│  │ from Customer 360│◄──────────────────────────┐                │
│  │ Domain           │                            │                │
│  └──────────────────┘                            │ linked to      │
│         │                                        │                │
│         │ assigned to                            │                │
│         ▼                                        │                │
│  ┌──────────────────┐                   ┌──────────────────┐      │
│  │     Project      │──incurs costs────►│     Expense      │      │
│  │   (project)    │                   │   (f_expense)    │      │
│  │                  │                   │                  │      │
│  │ from Operations  │                   │ • CRA Category   │      │
│  │ Domain           │                   │ • CRA Subcategory│      │
│  └──────────────────┘                   │ • Deductibility  │      │
│         ▲                                │ • Tax Recovery   │      │
│         │                                │ • Receipt S3     │      │
│         │ allocated to                  └──────────────────┘      │
│         │                                        ▲                │
│  ┌──────────────────┐                           │                │
│  │    Employee      │──incurs expense───────────┘                │
│  │  (employee)    │                                             │
│  │                  │                                             │
│  │ from Customer 360│                                             │
│  │ Domain           │                                             │
│  └──────────────────┘                                             │
│         │                                                          │
│         │ assigned to                                             │
│         ▼                                                          │
│  ┌──────────────────┐        ┌──────────────────┐                │
│  │     Office       │        │    Business      │                │
│  │   (office)     │        │  (business)    │                │
│  │                  │        │                  │                │
│  │ P&L Rollup by:   │        │ P&L Rollup by:   │                │
│  │ • Office         │        │ • Business       │                │
│  │ • District       │        │ • Region         │                │
│  │ • Region         │        │ • Enterprise     │                │
│  │ • Corporate      │        └──────────────────┘                │
│  └──────────────────┘                                             │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │               CRA T2125 Tax Integration                    │  │
│  │                                                             │  │
│  │  Revenue Categories:              Expense Categories:      │  │
│  │  • Sales/Commissions/Fees         • Advertising            │  │
│  │  • Other Income                   • Meals & Entertainment  │  │
│  │  • Interest Income                • Vehicle Expenses       │  │
│  │                                   • Salaries & Wages       │  │
│  │  Tax Calculations:                • Rent                   │  │
│  │  • GST/HST/PST tracking           • Supplies               │  │
│  │  • Input Tax Credits (ITC)        • Insurance              │  │
│  │  • Deductibility %                • Professional Fees      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Relationship Rules

1. **Revenue → Invoice**: One-to-one
   - Each paid invoice generates revenue transaction
   - Invoice line items aggregate to revenue record
   - Revenue amount = Invoice total - taxes
   - Revenue recognized on payment date or recognition_date

2. **Revenue → Customer**: Many-to-one
   - All revenue transactions link to customer (d_client)
   - Customer denormalized for performance
   - Enables customer profitability analysis

3. **Revenue → Project**: Many-to-one (optional)
   - Revenue can be allocated to specific project
   - Enables project profitability tracking
   - Project P&L = Revenue - Expenses

4. **Expense → Employee**: Many-to-one
   - Each expense incurred by one employee
   - Employee expense reporting and reimbursement
   - Expense approval workflow by manager

5. **Expense → Project**: Many-to-one (optional)
   - Expenses allocated to projects for job costing
   - Material costs, labor, subcontractor fees
   - Project profitability = Revenue - Allocated Expenses

6. **Revenue/Expense → Office**: Many-to-one
   - All transactions tied to office location
   - Office-level P&L rollup (4 hierarchy levels)
   - Regional and corporate financial reporting

7. **Revenue/Expense → Business**: Many-to-one
   - All transactions tied to business unit
   - Business-level P&L rollup (3 hierarchy levels)
   - Multi-brand financial visibility

## Business Semantics

### Revenue Lifecycle

```
Invoice Created → Invoice Sent → Payment Received → Revenue Recognized → Booked
     │                                   │                    │
     ▼                                   ▼                    ▼
  Unpaid                             Partial Paid          Fully Paid
     │                                   │                    │
     ▼                                   ▼                    ▼
Revenue Status:                  Revenue Status:      Revenue Status:
  Pending                          Recognized           Recognized
```

**Revenue Status** (`revenue_status`):
- **Pending**: Invoice sent but unpaid (revenue not yet recognized)
- **Recognized**: Payment received, revenue recorded
- **Deferred**: Payment received but revenue deferred to future period
- **Reversed**: Revenue reversal (refund, chargeback)
- **Adjusted**: Revenue adjustment (discount, credit note)

**Revenue Recognition Methods**:
1. **Cash Basis**: Revenue recognized on payment date (default for small business)
2. **Accrual Basis**: Revenue recognized on invoice date or service delivery date
3. **Percentage of Completion**: Revenue recognized as project progresses (long-term projects)

### Expense Lifecycle

```
Expense Incurred → Receipt Uploaded → Submitted → Approved → Paid → Recognized
     │                    │                │          │        │          │
     ▼                    ▼                ▼          ▼        ▼          ▼
   Draft              Attached         Pending    Approved   Paid      Booked
```

**Expense Status** (`expense_status`):
- **Draft**: Expense being entered, not yet submitted
- **Submitted**: Expense submitted for approval
- **Approved**: Manager approved expense
- **Rejected**: Manager rejected expense (reason in notes)
- **Paid**: Expense paid (reimbursement or vendor payment)
- **Cancelled**: Expense cancelled before payment

**Expense Types** (`expense_type`):
- **Standard**: Regular business expense (materials, supplies)
- **Recurring**: Recurring expense (rent, insurance, subscriptions)
- **One-Time**: Non-recurring expense (equipment purchase)
- **Reimbursement**: Employee out-of-pocket expense requiring reimbursement
- **Adjustment**: Expense correction or adjustment

### CRA T2125 Classification

The platform follows **CRA T2125 Statement of Business or Professional Activities** structure for tax compliance.

**Revenue Categories** (`dl__revenue_category`):
- **Sales/Commissions/Fees**: Primary business income from services and products
- **Other Income**: Miscellaneous business income
- **Interest Income**: Interest earned on business accounts
- **Rental Income**: Income from renting equipment or property

**Revenue Subcategories** (`dl__revenue_subcategory`):
- Retail Sales
- Online Sales
- Service Fees
- Installation Revenue
- Maintenance Contracts
- Warranty Revenue

**Expense Categories** (`dl__expense_category`) with CRA T2125 Line Numbers:

| Category | CRA Line | Deductibility | Description |
|----------|----------|---------------|-------------|
| Advertising | 8521 | 100% | Marketing, ads, promotional materials |
| Meals & Entertainment | 8523 | 50% | Business meals, client entertainment |
| Bad Debts | 8590 | 100% | Uncollectible customer invoices |
| Insurance | 9804 | 100% | Business liability, vehicle, property |
| Interest & Bank Charges | 8710 | 100% | Loan interest, banking fees |
| Business Tax & Licenses | 9270 | 100% | Business licenses, permits |
| Office Expenses | 8810 | 100% | Office supplies, equipment |
| Professional Fees | 8862 | 100% | Legal, accounting, consulting |
| Rent | 9281 | 100% | Office rent, warehouse lease |
| Repairs & Maintenance | 9936 | 100% | Equipment repairs, building maintenance |
| Salaries & Wages | 9060 | 100% | Employee payroll, contractors |
| Supplies | 8804 | 100% | Materials, inventory, consumables |
| Telephone & Utilities | 9220 | 100% | Phone, internet, hydro, gas |
| Travel | 9200 | 100% | Business travel, accommodations |
| Vehicle Expenses | 9281 | 100% | Fuel, maintenance, insurance |
| Capital Cost Allowance | 9936 | Varies | Depreciation on capital assets |

**Tax Deductibility** (`deductibility_percent`):
- Most expenses: **100% deductible**
- Meals & Entertainment: **50% deductible** (CRA rule)
- Personal use portion: **0% deductible** (must be excluded)

### Tax Calculations (Canadian)

**GST/HST Input Tax Credits (ITC)**:
- Businesses can recover GST/HST paid on expenses
- Tracked in `tax_recoverable_flag` field
- ITC reduces net tax owed to CRA

**Provincial Tax Rates**:

| Province | Tax Type | Rate | Recoverable |
|----------|----------|------|-------------|
| Ontario | HST | 13% | Yes (ITC) |
| Quebec | GST + QST | 5% + 9.975% | Yes (both) |
| Alberta | GST | 5% | Yes (ITC) |
| BC | GST + PST | 5% + 7% | GST yes, PST no |
| Manitoba | GST + PST | 5% + 7% | GST yes, PST no |

**Example Expense with Tax Recovery**:
```
Expense: Office Supplies = $1,000
HST (13%): $130
Total Paid: $1,130

Tax Deductible: $1,000 (100% deductibility)
ITC Recoverable: $130 (HST recovery)
Net Cost: $1,000 ($1,130 - $130 ITC)
```

## Data Patterns

### Revenue Numbering Convention

```
REV-{YEAR}-{SEQUENCE}

Examples:
- REV-2025-00001
- REV-2025-00456
- REV-2025-12345
```

### Expense Numbering Convention

```
EXP-{YEAR}-{SEQUENCE}

Examples:
- EXP-2025-00001
- EXP-2025-00789
- EXP-2025-09876
```

### Fiscal Period Tracking

Revenue and expense records track fiscal periods for reporting:

```
fiscal_year: 2025
accounting_period: "2025-01" (January 2025)
                  "Q1-2025" (Quarter 1, 2025)
                  "2025-H1" (First half, 2025)
```

### Margin Calculation

Revenue records calculate margin:

```
margin_amount_cad = revenue_amount_cad - cost_amount_cad
margin_percent = (margin_amount_cad / revenue_amount_cad) × 100

Example:
Revenue: $10,000
Cost: $6,500
Margin: $3,500 (35%)
```

### Receipt Attachment Pattern

Expenses support S3 receipt attachments:

```sql
attachment: "s3://pmo-receipts/2025/01/EXP-2025-00123-receipt.pdf"
attachment_format: "pdf"
attachment_size_bytes: 245678
attachment_object_bucket: "pmo-receipts"
attachment_object_key: "2025/01/EXP-2025-00123-receipt.pdf"
```

Attachment uploaded via presigned S3 URL, stored securely, accessible via download link.

## Use Cases

### UC-1: Invoice Payment and Revenue Recognition

**Actors**: Customer, Accounting Clerk, System

**Flow**:
1. Customer pays Invoice INV-2025-00123 for $9,209.50
2. Accounting Clerk records payment in system
3. Invoice status → "Paid"
4. System auto-creates Revenue record:
   - Revenue Number: REV-2025-00045
   - Revenue Date: 2025-01-15 (payment date)
   - Recognition Date: 2025-01-15 (cash basis)
   - Client: Huron Retail Inc.
   - Project: HVAC Installation - Store #12
   - Category: Sales/Commissions/Fees
   - Subcategory: Installation Revenue
   - Revenue Amount: $8,150.00 (before tax)
   - Tax Amount: $1,059.50 (13% HST)
   - Total: $9,209.50
   - Margin: $3,500 (43% margin)
5. Revenue status = "Recognized"
6. Financial reports updated with new revenue
7. Revenue appears in:
   - Customer profitability report
   - Project P&L
   - Monthly revenue report
   - CRA T2125 tax reporting

**Entities Touched**: Invoice (Order & Fulfillment), Revenue, Customer, Project

### UC-2: Employee Expense Reimbursement

**Actors**: Employee, Manager, Accounting Clerk

**Flow**:
1. Employee purchases office supplies at Staples for $113.00 ($100 + $13 HST)
2. Employee uploads receipt photo via mobile app
3. Employee creates Expense record:
   - Expense Number: EXP-2025-00234
   - Expense Date: 2025-01-10
   - Category: Office Expenses (CRA Line 8810)
   - Subcategory: Office Supplies
   - Expense Amount: $100.00
   - HST Amount: $13.00
   - Total: $113.00
   - Deductibility: 100%
   - Tax Recoverable: Yes (ITC)
   - Attachment: Receipt uploaded to S3
4. Expense status = "Submitted"
5. Manager receives notification, reviews expense
6. Manager approves expense
7. Expense status → "Approved"
8. Accounting Clerk processes reimbursement
9. Employee receives $113.00 via direct deposit
10. Expense status → "Paid"
11. Expense recognized in financial reports:
    - Deductible Amount: $100.00 (for tax purposes)
    - HST ITC: $13.00 (recoverable from CRA)
    - Net Cost: $100.00
12. Expense appears in:
    - Employee expense report
    - Office P&L (if allocated to office)
    - Monthly expense report
    - CRA T2125 Line 8810 (Office Expenses)

**Entities Touched**: Expense, Employee, Office, Attachment (S3)

### UC-3: Project Profitability Analysis

**Actors**: Project Manager, Finance Team, Executive

**Flow**:
1. Finance Team runs Project Profitability Report for Project #450
2. System queries Revenue and Expense records linked to Project #450:

**Revenue**:
- Invoice #1: $15,000 (HVAC Installation)
- Invoice #2: $3,500 (Additional Work)
- Total Revenue: $18,500

**Expenses**:
- Materials (Products): $7,200
  - Carrier AC Unit: $3,200
  - Thermostat: $450
  - Supplies: $3,550
- Labor (Employee Time): $4,500
  - Technician 1: 20 hours × $75/hr = $1,500
  - Technician 2: 20 hours × $75/hr = $1,500
  - Lead Tech: 20 hours × $75/hr = $1,500
- Subcontractor (Electrical): $1,800
- Vehicle Expenses: $200
- Total Expenses: $13,700

**Profitability**:
- Revenue: $18,500
- Cost: $13,700
- Gross Profit: $4,800
- Gross Margin: 26%

3. Report shows:
   - Project is profitable
   - Margin is below target (30% target)
   - Material costs higher than estimated
4. Project Manager reviews and adjusts future quotes
5. Executive dashboard updated with project performance

**Entities Touched**: Revenue, Expense, Project, Product, Employee

## Technical Architecture

### Key Tables

```sql
-- Revenue (f_revenue)
CREATE TABLE app.f_revenue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identification
    revenue_number VARCHAR(50) NOT NULL UNIQUE,     -- 'REV-2025-00123'
    revenue_type VARCHAR(50) DEFAULT 'standard',

    -- Dates
    revenue_date DATE NOT NULL,
    recognition_date DATE,
    fiscal_year INTEGER,
    accounting_period VARCHAR(20),

    -- CRA T2125 Classification
    dl__revenue_category VARCHAR(100),              -- Sales/Commissions/Fees
    dl__revenue_subcategory VARCHAR(100),           -- Installation Revenue
    dl__revenue_code VARCHAR(50),
    cra_line VARCHAR(20),                           -- T2125 line number

    -- Entity Linkages
    invoice_id UUID,
    client_id UUID,
    client_name VARCHAR(255),
    project_id UUID,
    project_name VARCHAR(255),
    employee_id UUID,
    business_id UUID,
    office_id UUID,

    -- Revenue Metrics (CAD)
    revenue_amount_cad DECIMAL(15,2) NOT NULL,
    cost_amount_cad DECIMAL(15,2) DEFAULT 0,
    margin_amount_cad DECIMAL(15,2),
    margin_percent DECIMAL(5,2),

    -- Tax Information
    tax_amount_cad DECIMAL(12,2) DEFAULT 0,
    gst_amount_cad DECIMAL(12,2) DEFAULT 0,
    pst_amount_cad DECIMAL(12,2) DEFAULT 0,
    hst_amount_cad DECIMAL(12,2) DEFAULT 0,
    tax_exempt_flag BOOLEAN DEFAULT false,

    -- Status
    revenue_status VARCHAR(50) DEFAULT 'recognized',
    payment_status VARCHAR(50),

    created_ts TIMESTAMPTZ DEFAULT NOW(),
    updated_ts TIMESTAMPTZ DEFAULT NOW()
);

-- Expense (f_expense)
CREATE TABLE app.f_expense (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identification
    expense_number VARCHAR(50) NOT NULL UNIQUE,     -- 'EXP-2025-00123'
    expense_type VARCHAR(50) DEFAULT 'standard',

    -- Dates
    expense_date DATE NOT NULL,
    recognition_date DATE,
    fiscal_year INTEGER,
    accounting_period VARCHAR(20),

    -- CRA T2125 Classification
    dl__expense_category VARCHAR(100),              -- Office Expenses
    dl__expense_subcategory VARCHAR(100),           -- Office Supplies
    dl__expense_code VARCHAR(50),
    cra_line VARCHAR(20),                           -- 8810
    deductibility_percent DECIMAL(5,2) DEFAULT 100.00,

    -- Entity Linkages
    invoice_id UUID,
    project_id UUID,
    employee_id UUID,
    client_id UUID,
    business_id UUID,
    office_id UUID,

    -- Expense Metrics (CAD)
    expense_amount_cad DECIMAL(15,2) NOT NULL,
    deductible_amount_cad DECIMAL(15,2),
    reimbursable_flag BOOLEAN DEFAULT false,
    reimbursed_flag BOOLEAN DEFAULT false,

    -- Tax Information
    tax_amount_cad DECIMAL(12,2) DEFAULT 0,
    tax_recoverable_flag BOOLEAN DEFAULT true,      -- ITC eligible

    -- Status
    expense_status VARCHAR(50) DEFAULT 'submitted',
    payment_status VARCHAR(50) DEFAULT 'unpaid',

    -- S3 Attachment (receipt)
    attachment TEXT,                                -- s3://bucket/key
    attachment_format VARCHAR(20),
    attachment_size_bytes BIGINT,
    attachment_object_bucket VARCHAR(100),
    attachment_object_key VARCHAR(500),

    created_ts TIMESTAMPTZ DEFAULT NOW(),
    updated_ts TIMESTAMPTZ DEFAULT NOW()
);
```

### API Endpoints

```
# Revenue
GET    /api/v1/revenue                  # List revenue transactions
GET    /api/v1/revenue/:id              # Get revenue detail
POST   /api/v1/revenue                  # Create revenue (usually auto from invoice)
PATCH  /api/v1/revenue/:id              # Update revenue
DELETE /api/v1/revenue/:id              # Delete revenue
GET    /api/v1/revenue/reports/summary  # Revenue summary report

# Expense
GET    /api/v1/expense                  # List expenses
GET    /api/v1/expense/:id              # Get expense detail
POST   /api/v1/expense                  # Create expense
PATCH  /api/v1/expense/:id              # Update expense
DELETE /api/v1/expense/:id              # Delete expense
POST   /api/v1/expense/:id/approve      # Approve expense
POST   /api/v1/expense/:id/reject       # Reject expense
POST   /api/v1/expense/:id/reimburse    # Mark as reimbursed
GET    /api/v1/expense/reports/summary  # Expense summary report

# Financial Reports
GET    /api/v1/financial/pl             # P&L statement
GET    /api/v1/financial/pl/project/:id # Project P&L
GET    /api/v1/financial/pl/customer/:id # Customer profitability
GET    /api/v1/financial/pl/office/:id  # Office P&L
GET    /api/v1/financial/pl/business/:id # Business P&L
GET    /api/v1/financial/tax/t2125      # CRA T2125 report

# Receipt Upload
POST   /api/v1/expense/:id/upload       # Get presigned S3 URL
GET    /api/v1/expense/:id/receipt      # Download receipt
```

## Integration Points

### Upstream Dependencies

- **Order & Fulfillment Domain**: Invoice (triggers revenue creation)
- **Customer 360 Domain**: Customer, Employee, Office, Business
- **Operations Domain**: Project (for cost/revenue allocation)
- **Product & Inventory Domain**: Product costs for expense tracking

### Downstream Dependencies

- **None** - Financial Management is a terminal domain

### Cross-Domain Workflows

**Invoice → Revenue**:
1. Invoice paid in Order & Fulfillment
2. Payment triggers Revenue creation in Financial Management
3. Revenue linked to Invoice, Customer, Project
4. Revenue appears in financial reports

**Project Costing**:
1. Project created in Operations
2. Expenses allocated to Project (materials, labor, subcontractors)
3. Revenue recognized from Project invoices
4. Project P&L = Revenue - Expenses
5. Profitability tracked in Financial Management

## Data Volume & Performance

### Expected Data Volumes

- Revenue Transactions: 5,000 - 50,000 per year
- Expense Transactions: 10,000 - 100,000 per year

### Indexing Strategy

```sql
-- Revenue indexes
CREATE INDEX idx_revenue_number ON app.f_revenue(revenue_number);
CREATE INDEX idx_revenue_client ON app.f_revenue(client_id);
CREATE INDEX idx_revenue_project ON app.f_revenue(project_id);
CREATE INDEX idx_revenue_date ON app.f_revenue(revenue_date);
CREATE INDEX idx_revenue_period ON app.f_revenue(accounting_period);
CREATE INDEX idx_revenue_category ON app.f_revenue(dl__revenue_category);

-- Expense indexes
CREATE INDEX idx_expense_number ON app.f_expense(expense_number);
CREATE INDEX idx_expense_employee ON app.f_expense(employee_id);
CREATE INDEX idx_expense_project ON app.f_expense(project_id);
CREATE INDEX idx_expense_date ON app.f_expense(expense_date);
CREATE INDEX idx_expense_category ON app.f_expense(dl__expense_category);
CREATE INDEX idx_expense_status ON app.f_expense(expense_status);
```

## Future Enhancements

1. **Budget Management**: Budget allocation, variance tracking, alerts
2. **Forecasting**: ML-based revenue and expense forecasting
3. **Cash Flow**: Cash flow projections and working capital management
4. **AP/AR Automation**: Automated payables and receivables processing
5. **Multi-Currency**: Support for USD, EUR with exchange rate tracking
6. **Cost Allocation**: Advanced cost allocation across projects/departments
7. **Financial Dashboard**: Real-time financial KPIs and metrics
8. **Audit Trail**: Complete audit trail for all financial transactions
9. **Tax Automation**: Automated CRA T2125 form generation
10. **Integration**: QuickBooks, Xero, Sage accounting integration

---

**Domain Owner**: Finance & Accounting Teams
**Last Updated**: 2025-11-13
**Related Domains**: Order & Fulfillment (Invoice), Customer 360, Operations (Project), Product & Inventory
