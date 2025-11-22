# Customer 360 Domain

> **Purpose**: Unified view of people, organizations, and business structures. The foundational domain for managing all human and organizational entities across the platform.

## Domain Overview

Customer 360 is the core identity domain that maintains a complete, unified view of all people (customers, employees), organizational structures (offices, businesses, roles), and physical locations (worksites). It serves as the foundation for all other domains by providing consistent identity and organizational context.

### Business Value

- **Single Source of Truth** for all people and organizational data
- **360-Degree View** of customer relationships and touchpoints
- **Organizational Hierarchy** management for multi-location, multi-business operations
- **Role-Based Context** for permissions and workflows
- **Worksite Management** for field service delivery

## Entities

| Entity | DDL File | Table | Purpose |
|--------|----------|-------|---------|
| **Customer** | VI_d_cust.ddl | `d_client` | Customer/client master with contact info, addresses, and relationships |
| **Business** | V_d_business.ddl | `d_business` | Business unit master with 3-level hierarchy (Business → Region → Enterprise) |
| **Employee** | III_d_employee.ddl | `d_employee` | Employee master with authentication, roles, and org assignments |
| **Role** | VII_d_role.ddl | `d_role` | Role definitions for employees (CEO, Project Manager, Technician, etc.) |
| **Office** | IV_d_office.ddl | `d_office` | Office locations with 4-level hierarchy (Office → District → Region → Corporate) |
| **Worksite** | IX_d_worksite.ddl | `d_worksite` | Customer site locations for field service delivery |

## Entity Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                     CUSTOMER 360 DOMAIN                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────┐                              ┌──────────────┐  │
│  │  Customer  │◄──────has many─────────────►│  Worksite    │  │
│  │  (d_client)│                              │(d_worksite)  │  │
│  └────────────┘                              └──────────────┘  │
│       │                                                         │
│       │ assigned to                                            │
│       ▼                                                         │
│  ┌────────────────┐         belongs to       ┌──────────────┐  │
│  │   Business     │◄────────────────────────►│   Office     │  │
│  │ (d_business)   │                          │  (d_office)  │  │
│  │                │                          │              │  │
│  │ 3-Level Hier:  │                          │ 4-Level Hier:│  │
│  │ • Business     │                          │ • Office     │  │
│  │ • Region       │                          │ • District   │  │
│  │ • Enterprise   │                          │ • Region     │  │
│  └────────────────┘                          │ • Corporate  │  │
│       ▲                                      └──────────────┘  │
│       │                                             ▲          │
│       │                                             │          │
│       │ assigned to                    assigned to │          │
│       │                                             │          │
│  ┌────────────────┐         has         ┌──────────────────┐  │
│  │   Employee     │◄────────────────────►│      Role       │  │
│  │  (d_employee)  │      1:many          │    (d_role)     │  │
│  │                │                      │                 │  │
│  │ • email/auth   │                      │ • CEO           │  │
│  │ • name         │                      │ • PM            │  │
│  │ • phone        │                      │ • Technician    │  │
│  └────────────────┘                      └──────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Relationship Rules

1. **Customer → Worksite**: One-to-many
   - Each customer can have multiple service worksites
   - Worksites linked via `d_entity_instance_link` (no foreign keys)

2. **Employee → Role**: Many-to-one
   - Each employee has exactly one primary role
   - Roles define permissions and capabilities

3. **Employee → Office**: Many-to-one
   - Each employee is assigned to one office location
   - Office assignment determines regional context

4. **Employee → Business**: Many-to-one (optional)
   - Employees can be assigned to specific business units
   - Business assignment determines P&L context

5. **Business ↔ Office**: Many-to-many
   - Business units can operate across multiple offices
   - Offices can house multiple business units

## Business Semantics

### Customer Lifecycle

```
Prospect → Lead → Qualified → Active → Dormant → Reactivated
                                    ↓
                                Churned
```

Customers flow through lifecycle stages tracked via `dl__customer_status` settings field. Each stage triggers different workflows and permissions.

### Office Hierarchy

The **4-level office hierarchy** supports:
- **Office Level**: Individual office locations (street address)
- **District Level**: Group of offices in geographic district
- **Region Level**: Collection of districts (e.g., Ontario, Quebec)
- **Corporate Level**: Enterprise-wide HQ

**Use Cases**:
- Regional revenue rollups
- District-level resource allocation
- Corporate-wide reporting
- Territory management

### Business Hierarchy

The **3-level business hierarchy** supports:
- **Business Level**: Individual business unit (e.g., HVAC Division)
- **Region Level**: Regional business operations
- **Enterprise Level**: Parent company

**Use Cases**:
- Multi-brand operations
- P&L by business unit
- Cross-business resource sharing
- Acquisition integration

### Employee Authentication Flow

```
1. User enters email: james.miller@huronhome.ca
2. System queries: SELECT * FROM d_employee WHERE email = ?
3. Password verified via bcrypt hash
4. JWT token issued with employee_id + role_id
5. RBAC checked via d_entity_rbac for all operations
```

## Data Patterns

### Polymorphic Parent Linking

All Customer 360 entities can be **parents** to entities in other domains:

- Customer → Project (operations)
- Customer → Quote (order_fulfillment)
- Customer → Invoice (order_fulfillment)
- Office → Task (operations)
- Business → Project (operations)
- Employee → Event (event_calendar)

Linkage via `d_entity_instance_link` table:
```sql
SELECT * FROM d_entity_instance_link
WHERE parent_entity_type = 'cust'
  AND parent_entity_instance_id = 12345
  AND child_entity_type = 'project';
```

### Settings-Driven Dropdowns

Customer 360 entities use settings for dropdown fields:

- `dl__customer_status`: Prospect, Lead, Active, Dormant, Churned
- `dl__employee_status`: Active, On Leave, Terminated
- `dl__office_type`: Branch, District HQ, Regional HQ, Corporate HQ
- `dl__business_type`: Division, Subsidiary, Joint Venture

All settings managed in `datalabel` table with entity prefix (e.g., `cust__status`).

## Use Cases

### UC-1: Customer Onboarding

**Actors**: Sales Rep, Customer, System

**Flow**:
1. Sales rep creates Customer record in CRM
2. Customer status = "Lead"
3. If qualified, status → "Qualified"
4. Create first Worksite for service location
5. Assign to Employee (account manager)
6. Link to primary Business unit
7. Status → "Active" upon first order

**Entities Touched**: Customer, Worksite, Employee

### UC-2: Employee Provisioning

**Actors**: HR Manager, New Hire, IT System

**Flow**:
1. HR creates Employee record with email
2. Assign Role (e.g., "Technician")
3. Assign to Office (determines region)
4. Optionally assign to Business (determines P&L)
5. System auto-generates temp password
6. Employee receives welcome email
7. Employee logs in, sets permanent password
8. RBAC permissions auto-granted based on Role

**Entities Touched**: Employee, Role, Office, Business

### UC-3: Multi-Location Customer Setup

**Actors**: Account Manager, Customer, System

**Flow**:
1. Create Customer master record (HQ address)
2. Create Worksite for each service location (5 retail stores)
3. Each Worksite linked to Customer via `d_entity_instance_link`
4. Assign different Employees to each Worksite (territory routing)
5. Create Projects per Worksite for installations
6. Revenue rolls up to Customer level

**Entities Touched**: Customer, Worksite (5x), Employee, Office

## Technical Architecture

### Key Tables

```sql
-- Customer (d_client)
CREATE TABLE app.d_client (
    client_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address_json JSONB,
    dl__customer_status VARCHAR(50), -- settings dropdown
    business_id INT4, -- soft link to d_business
    created_ts TIMESTAMPTZ DEFAULT now()
);

-- Employee (d_employee)
CREATE TABLE app.d_employee (
    employee_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role_id INT4, -- soft link to d_role
    office_id INT4, -- soft link to d_office
    business_id INT4, -- soft link to d_business
    dl__employee_status VARCHAR(50),
    created_ts TIMESTAMPTZ DEFAULT now()
);

-- Office (d_office) - 4-level hierarchy
CREATE TABLE app.d_office (
    office_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    parent_office_id INT4, -- self-referential hierarchy
    hierarchy_level INT4, -- 1=Office, 2=District, 3=Region, 4=Corporate
    address_json JSONB,
    created_ts TIMESTAMPTZ DEFAULT now()
);
```

### API Endpoints

```
GET    /api/v1/cust              # List customers
GET    /api/v1/cust/:id          # Get customer detail
POST   /api/v1/cust              # Create customer
PATCH  /api/v1/cust/:id          # Update customer
DELETE /api/v1/cust/:id          # Soft delete customer

GET    /api/v1/employee          # List employees
POST   /api/v1/employee          # Create employee
POST   /api/v1/employee/login    # Login (email/password)
GET    /api/v1/employee/me       # Get current logged-in employee

GET    /api/v1/office            # List offices (with hierarchy)
GET    /api/v1/office/:id        # Get office + all child offices

GET    /api/v1/business          # List business units
GET    /api/v1/role              # List roles
GET    /api/v1/worksite          # List worksites
```

### RBAC Integration

Customer 360 entities are the **identity foundation** for RBAC:

```sql
-- Permission check example
SELECT has_permission(
    employee_id := 42,
    entity_type := 'project',
    entity_instance_id := 100,
    required_permission := 'edit' -- 2
);
```

Permissions array: `[view, edit, share, delete, create]`
- **Owner [5]**: Full permissions = `[1,1,1,1,1]`
- **Editor [4]**: All except delete = `[1,1,1,0,1]`
- **Viewer [1]**: View only = `[1,0,0,0,0]`

## Integration Points

### Upstream Dependencies

- **None** - Customer 360 is the foundational domain

### Downstream Dependencies

- **Operations Domain**: Projects/Tasks assigned to Customers, Employees
- **Service Delivery Domain**: Services delivered to Worksites
- **Order & Fulfillment**: Quotes/Orders for Customers
- **Financial Management**: Revenue/Expenses by Customer, Business, Office
- **Event & Calendar**: Events scheduled for Employees, Customers

## Data Volume & Performance

### Expected Data Volumes

- Customers: 10,000 - 100,000 records
- Employees: 50 - 5,000 records
- Offices: 10 - 500 locations
- Businesses: 5 - 50 business units
- Roles: 10 - 30 role definitions
- Worksites: 50,000 - 500,000 locations

### Indexing Strategy

```sql
-- Critical indexes for performance
CREATE INDEX idx_employee_email ON app.d_employee(email);
CREATE INDEX idx_employee_role ON app.d_employee(role_id);
CREATE INDEX idx_employee_office ON app.d_employee(office_id);
CREATE INDEX idx_client_status ON app.d_client(dl__customer_status);
CREATE INDEX idx_office_parent ON app.d_office(parent_office_id);
CREATE INDEX idx_business_parent ON app.d_business(parent_business_id);
```

## Future Enhancements

1. **Customer Segmentation**: ML-based customer clustering
2. **Org Chart Visualization**: D3.js-based interactive org charts
3. **Territory Management**: Automated territory assignment based on zipcode
4. **Contact Management**: Multiple contacts per customer with roles
5. **Employee Skills Matrix**: Track certifications and capabilities
6. **Audit Trail**: Track all changes to customer/employee records

---

**Domain Owner**: Customer Success & HR Teams
**Last Updated**: 2025-11-13
**Related Domains**: All domains depend on Customer 360 for identity
