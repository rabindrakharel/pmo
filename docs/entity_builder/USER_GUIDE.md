# Dynamic Entity Builder - User Guide

> **Step-by-step guide for creating custom entities** without writing code

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Step-by-Step Walkthrough](#step-by-step-walkthrough)
4. [Entity Type Selection](#entity-type-selection)
5. [Column Design](#column-design)
6. [Relationship Configuration](#relationship-configuration)
7. [Icon & Display Settings](#icon--display-settings)
8. [Preview & Create](#preview--create)
9. [Common Use Cases](#common-use-cases)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The **Dynamic Entity Builder** lets you create custom entity types (data tables) through a visual interface. Think of entities as different types of information your business needs to track.

**Examples:**
- Customer feedback entries
- Equipment maintenance records
- Training certifications
- Vendor contracts
- Safety incidents

After creating an entity, it will:
- ✅ Appear in the sidebar navigation
- ✅ Have its own list/detail pages
- ✅ Support create/edit/delete operations
- ✅ Link to other entities (parent-child relationships)
- ✅ Be accessible via API endpoints

**No code deployment required!**

---

## Getting Started

### Prerequisites

- ✅ Admin or Entity Manager role
- ✅ Access to Settings area
- ✅ Understanding of what data you want to track

### Accessing Entity Designer

1. Click your profile picture (top right)
2. Select **Settings** from dropdown
3. Navigate to **Entity Designer** section
4. Click **"Create New Entity"** button

**OR**

- Direct URL: `https://your-domain.com/entity-designer`

---

## Step-by-Step Walkthrough

### Complete Flow Example: Creating "Training Certification" Entity

Let's create a custom entity to track employee training certifications.

---

## Entity Type Selection

**Question:** What kind of entity are you creating?

### Option 1: Attribute-based Entity
**Use when:** Storing properties, characteristics, or reference data

**Examples:**
- Settings and categories (product types, task priorities)
- People and organizations (employees, clients, vendors)
- Locations and hierarchies (offices, departments)
- Reference data that changes slowly

**For training certifications:** ✅ Choose this! (It's descriptive data about employees)

### Option 2: Transactional Entity
**Use when:** Storing events, measurements, or time-series data

**Examples:**
- Business transactions (orders, invoices, payments)
- Activities and events (tasks, meetings)
- Measurements and metrics (performance data)
- Data that accumulates over time

**For training certifications:** ❌ Not this (certifications aren't transactions)

### Making the Choice

**Select:** "Attribute-based Entity" (radio button)

**Why?** Training certifications are descriptive attributes of employees, not time-series transactions.

---

## Column Design

All entities automatically include **standard columns**:

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Unique identifier |
| `code` | VARCHAR(50) | Business code (e.g., "CERT-2025-001") |
| `name` | VARCHAR(255) | Display name (e.g., "First Aid Training") |
| `description` | TEXT | Long description |
| `active_flag` | BOOLEAN | Soft delete flag |
| `created_ts` | TIMESTAMP | When created |
| `updated_ts` | TIMESTAMP | When last updated |
| `created_by_id` | UUID | Who created it |
| `updated_by_id` | UUID | Who last updated it |

### Adding Custom Columns

**Example for Training Certification:**

#### Column 1: Certification Type
- **Column Name:** `certification_type`
- **Data Type:** Text (VARCHAR)
- **Description:** Type of certification (Safety, Technical, Compliance)
- **Required:** ✅ Yes

#### Column 2: Expiry Date
- **Column Name:** `expiry_date`
- **Data Type:** Date (TIMESTAMP)
- **Description:** When certification expires
- **Required:** ✅ Yes

#### Column 3: Issuing Authority
- **Column Name:** `issuing_authority`
- **Data Type:** Text (VARCHAR)
- **Description:** Organization that issued certification
- **Required:** ❌ No

#### Column 4: Certificate Number
- **Column Name:** `certificate_number`
- **Data Type:** Text (VARCHAR)
- **Description:** Official certificate number
- **Required:** ❌ No

#### Column 5: Training Hours
- **Column Name:** `training_hours`
- **Data Type:** Number (INTEGER)
- **Description:** Number of training hours completed
- **Required:** ❌ No

#### Column 6: Additional Notes
- **Column Name:** `notes`
- **Data Type:** JSON (JSONB)
- **Description:** Structured additional information
- **Required:** ❌ No

### Data Type Guide

| Data Type | SQL Type | Use For | Example |
|-----------|----------|---------|---------|
| **Text** | VARCHAR(255) | Short text, names, codes | "First Aid Training" |
| **Number** | INTEGER/DECIMAL | Counts, amounts, IDs | 24 (hours) |
| **Date** | TIMESTAMP | Dates, timestamps | 2025-12-31 |
| **Boolean** | BOOLEAN | Yes/No flags | true/false |
| **JSON** | JSONB | Structured data, arrays | `{"instructor": "John", "location": "Office A"}` |

### Column Naming Rules

✅ **Good:**
- `certification_type`
- `expiry_date`
- `training_hours`

❌ **Bad:**
- `CertificationType` (use lowercase)
- `expiry-date` (use underscores, not hyphens)
- `select` (SQL reserved word)

---

## Relationship Configuration

Define how this entity relates to others.

### Parent Entities (This entity belongs to...)

**Question:** What entities can a certification belong to?

**For Training Certification:**
- ✅ **Employee** (each certification belongs to an employee)
- ✅ **Project** (optional: certifications required for specific projects)

**How to configure:**
1. Scroll to "Parent Entities" section
2. Find "Employee" in the list
3. Check **"Can be parent"** checkbox
4. Optionally check "Project" if applicable

**Result:** When creating a certification, you'll select which employee it belongs to.

### Child Entities (This entity can contain...)

**Question:** What entities can belong to a certification?

**For Training Certification:**
- ✅ **Artifact** (attach certificate PDFs, photos)
- ✅ **Wiki** (training materials, study guides)

**How to configure:**
1. Scroll to "Child Entities" section
2. Find "Artifact" in the list
3. Check **"Can be child"** checkbox
4. Also check "Wiki" if applicable

**Result:** Certification detail pages will have tabs for "Artifacts" and "Wiki".

### Relationship Examples

#### Example 1: Equipment Maintenance Entity
- **Parents:** Equipment (belongs to specific equipment)
- **Children:** Task (maintenance tasks), Artifact (photos, receipts), Wiki (repair guides)

#### Example 2: Vendor Contract Entity
- **Parents:** Client (contract for which client), Business (which business unit)
- **Children:** Invoice (invoices from contract), Artifact (signed documents)

#### Example 3: Safety Incident Entity
- **Parents:** Project (incident on which project), Office (incident at which office)
- **Children:** Task (follow-up tasks), Form (incident report form), Artifact (photos)

---

## Icon & Display Settings

### Choosing an Icon

Icons represent your entity throughout the UI (sidebar, cards, tabs).

**Available Icons (29 total):**

| Category | Icons |
|----------|-------|
| **Core** | FileText, FolderOpen, CheckSquare, Users, Building2, MapPin, BookOpen, Briefcase |
| **Product** | Package, Warehouse, ShoppingCart, Truck, Receipt |
| **Communication** | Mail, Phone, MessageSquare, Calendar |
| **System** | Settings, Database, Activity, GitBranch, Network |
| **Business** | Target, Award, TrendingUp, PieChart, BarChart |

**For Training Certification:**
- ✅ **Award** (good choice - represents certification/achievement)
- ✅ **BookOpen** (alternative - represents training/learning)
- ✅ **CheckSquare** (alternative - represents completion)

**How to select:**
1. Current icon is shown in large preview
2. Click **"Change icon"** button
3. Browse categorized icon grid
4. Click desired icon
5. Preview updates immediately

### Setting Display Order

Display order controls where the entity appears in the sidebar (lower numbers = higher position).

**Typical Ranges:**
- **1-50:** Primary entities (Project, Task, Client)
- **51-100:** Secondary entities (Wiki, Form, Artifact)
- **101-200:** Product & Operations entities
- **201+:** Settings and metadata entities

**For Training Certification:**
- **Suggested:** `110` (after core entities, with other HR/employee-related entities)

**How to set:**
1. Enter number in "Display Order" field (0-9999)
2. See guidelines for typical ranges
3. Preview shows how entity will appear

**Example Sidebar Order:**
```
Display Order    Entity
----------       ------
10               Project
20               Task
30               Client
40               Employee
110              Training Certification  ← Your new entity
120              Equipment
```

---

## Preview & Create

### Step 1: Preview Generated SQL (DDL)

Before creating the entity, review the SQL that will be executed.

**Click "Preview SQL" button**

**Example DDL for Training Certification:**

```sql
-- Create training_certification entity table
CREATE TABLE IF NOT EXISTS app.d_training_certification (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Custom columns
    certification_type VARCHAR(255) NOT NULL,
    expiry_date TIMESTAMP NOT NULL,
    issuing_authority VARCHAR(255),
    certificate_number VARCHAR(255),
    training_hours INTEGER,
    notes JSONB,

    -- Standard audit columns
    active_flag BOOLEAN DEFAULT true,
    created_ts TIMESTAMP DEFAULT now(),
    updated_ts TIMESTAMP DEFAULT now(),
    created_by_id UUID REFERENCES app.d_employee(id),
    updated_by_id UUID REFERENCES app.d_employee(id)
);

-- Create indexes
CREATE INDEX idx_training_certification_code ON app.d_training_certification(code);
CREATE INDEX idx_training_certification_active ON app.d_training_certification(active_flag);
CREATE INDEX idx_training_certification_expiry ON app.d_training_certification(expiry_date);

-- Create trigger for entity instance registry
CREATE TRIGGER tr_training_certification_registry
    AFTER INSERT OR UPDATE ON app.d_training_certification
    FOR EACH ROW
    EXECUTE FUNCTION app.fn_register_entity_instance();

-- Insert entity metadata
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, display_order, child_entities)
VALUES (
    'training_certification',
    'Training Certification',
    'Training Certifications',
    'Award',
    110,
    '[{"entity":"artifact","ui_icon":"FileText","ui_label":"Artifacts","order":1},
      {"entity":"wiki","ui_icon":"BookOpen","ui_label":"Wiki","order":2}]'::jsonb
);
```

**What to check:**
- ✅ Table name is correct (`d_training_certification`)
- ✅ All custom columns are present
- ✅ Data types match expectations
- ✅ Required columns have NOT NULL constraint
- ✅ Indexes are created on important columns
- ✅ Entity metadata includes correct icon and child entities

**Actions:**
- **Copy SQL** - Copy to clipboard for review
- **Close** - Return to designer to make changes
- **Proceed to create** - Continue to final step

### Step 2: Create Entity

**Click "Create Entity" button**

**Confirmation Dialog:**
```
Create New Entity?

This will:
✓ Create database table: d_training_certification
✓ Generate API endpoints: /api/v1/training_certification/*
✓ Add entity to sidebar navigation
✓ Configure parent-child relationships
✓ Enable full CRUD operations

This action cannot be easily undone. Continue?

[Cancel]  [Create Entity]
```

**Click "Create Entity" to proceed**

### Step 3: Success!

**Success Message:**
```
✓ Entity Created Successfully!

Training Certification entity has been created and is now available.

What you can do now:
• View in sidebar: Navigate to Training Certifications
• Create first record: Click "Add Certification"
• Link to employees: Select parent employee when creating
• Attach documents: Use Artifacts tab on detail page

[Go to Training Certifications]  [Create Another Entity]
```

---

## Common Use Cases

### Use Case 1: Customer Feedback Tracking

**Entity Type:** Transactional (it's an event/interaction)

**Custom Columns:**
- `feedback_type` (Text): Complaint, Suggestion, Praise
- `feedback_date` (Date): When feedback was received
- `channel` (Text): Phone, Email, In-person, Website
- `rating` (Number): 1-5 satisfaction rating
- `resolved_flag` (Boolean): Has issue been resolved?
- `feedback_text` (JSON): Structured feedback data

**Parents:** Client (feedback from which client)
**Children:** Task (follow-up tasks), Artifact (screenshots, documents)

**Icon:** MessageSquare
**Display Order:** 105

---

### Use Case 2: Equipment Maintenance Log

**Entity Type:** Transactional (maintenance events over time)

**Custom Columns:**
- `maintenance_type` (Text): Preventive, Corrective, Emergency
- `maintenance_date` (Date): When service was performed
- `technician_name` (Text): Who performed maintenance
- `hours_spent` (Number): Labor hours
- `parts_replaced` (JSON): List of parts replaced
- `cost` (Number): Total cost

**Parents:** Equipment (which equipment was serviced)
**Children:** Task (follow-up maintenance), Invoice (parts/labor invoice), Artifact (photos, receipts)

**Icon:** Settings
**Display Order:** 115

---

### Use Case 3: Vendor Evaluation

**Entity Type:** Attribute-based (vendor properties/ratings)

**Custom Columns:**
- `vendor_category` (Text): Supplier, Contractor, Consultant
- `evaluation_score` (Number): Overall score 1-100
- `quality_rating` (Number): Quality score 1-5
- `delivery_rating` (Number): On-time delivery score 1-5
- `support_rating` (Number): Customer support score 1-5
- `evaluation_notes` (JSON): Detailed evaluation criteria

**Parents:** Client (evaluating which vendor/client)
**Children:** Artifact (evaluation forms, certificates), Wiki (vendor documentation)

**Icon:** Target
**Display Order:** 120

---

### Use Case 4: Safety Incident Reporting

**Entity Type:** Transactional (incidents are time-series events)

**Custom Columns:**
- `incident_type` (Text): Near Miss, Injury, Equipment Damage, Spill
- `incident_date` (Date): When incident occurred
- `severity` (Text): Low, Medium, High, Critical
- `location_details` (Text): Specific location description
- `witnesses` (JSON): List of witnesses
- `corrective_actions` (JSON): Actions taken

**Parents:** Project (incident on which project), Office (at which office)
**Children:** Task (corrective action tasks), Form (incident report form), Artifact (photos, investigation documents)

**Icon:** AlertTriangle (if available) or Activity
**Display Order:** 90

---

## Best Practices

### Naming Conventions

✅ **Entity Codes:**
- Use descriptive, singular names: `training_certification` not `certs`
- Lowercase with underscores: `vendor_evaluation`
- Avoid abbreviations unless universally understood
- Max 50 characters

✅ **Column Names:**
- Descriptive and specific: `expiry_date` not `date`
- Prefix related columns: `quality_rating`, `delivery_rating`, `support_rating`
- Use consistent suffixes: `_date`, `_flag`, `_type`, `_id`

### Data Type Selection

**Text (VARCHAR):**
- ✅ Names, codes, categories, short descriptions
- ❌ Long paragraphs (use description field instead)
- ❌ Structured data (use JSON)

**Number (INTEGER/DECIMAL):**
- ✅ Counts, quantities, ratings, scores
- ✅ IDs, reference numbers
- ❌ Phone numbers (use Text - can have formatting)

**Date (TIMESTAMP):**
- ✅ Dates, expiry dates, event timestamps
- ✅ Automatically stores timezone
- ❌ Durations (use Number for hours/days)

**Boolean (TRUE/FALSE):**
- ✅ Yes/No flags: `resolved_flag`, `approved_flag`
- ✅ Status indicators: `active`, `completed`
- ❌ Multi-state fields (use Text with categories instead)

**JSON (JSONB):**
- ✅ Structured data: `{"key": "value", "nested": {...}}`
- ✅ Arrays: `["item1", "item2", "item3"]`
- ✅ Dynamic fields that vary by record
- ❌ Simple text (unnecessary overhead)

### Relationship Design

**Parent Entities:**
- Choose entities that this entity **belongs to**
- Usually 1-3 parent types maximum
- Example: Task belongs to Project, Client

**Child Entities:**
- Choose entities that **belong to** this entity
- Can have many child types
- Example: Project contains Tasks, Forms, Artifacts, Wiki entries

**Common Patterns:**
```
PROJECT (parent)
  ├── TASK (child)
  ├── FORM (child)
  ├── ARTIFACT (child)
  └── WIKI (child)

EMPLOYEE (parent)
  ├── TASK (child - assigned tasks)
  ├── TRAINING_CERTIFICATION (child)
  └── BOOKING (child - time off requests)

CLIENT (parent)
  ├── PROJECT (child)
  ├── INVOICE (child)
  └── FEEDBACK (child)
```

### Display Order Strategy

**Group related entities:**
```
1-50:    Core business entities (Project, Task, Client, Employee)
51-100:  Content & collaboration (Wiki, Form, Artifact)
101-150: HR & operations (Training, Equipment, Booking)
151-200: Product & inventory (Product, Order, Shipment)
201+:    Settings & metadata (Categories, Hierarchies)
```

---

## Troubleshooting

### Common Issues

#### Issue: "Entity code already exists"
**Cause:** Another entity with the same code already exists
**Solution:** Choose a different, unique code (e.g., `training_cert_v2`)

#### Issue: "Cannot create table"
**Cause:** Database permissions or table already exists
**Solution:** Contact system administrator

#### Issue: "Invalid column name"
**Cause:** Column name uses SQL reserved word (e.g., `select`, `table`)
**Solution:** Use different name (e.g., `selection_type` instead of `select`)

#### Issue: "Entity not appearing in sidebar"
**Cause:** Display order is very high, entity below visible area
**Solution:** Edit entity metadata, set lower display order

#### Issue: "Cannot link to parent entity"
**Cause:** Parent entity not selected during entity creation
**Solution:** Requires database update to add relationship (contact admin)

### Validation Errors

**Column name contains invalid characters:**
- Use only lowercase letters, numbers, underscores
- Must start with letter

**Column name conflicts with standard column:**
- Cannot use: `id`, `code`, `name`, `description`, `active_flag`, `created_ts`, `updated_ts`, `created_by_id`, `updated_by_id`

**Duplicate column names:**
- Each column name must be unique within entity

**Entity code too long:**
- Max 50 characters
- Keep it concise and descriptive

### Getting Help

1. Check this guide for usage instructions
2. Review [Architecture documentation](./ARCHITECTURE.md) for technical details
3. Contact system administrator for:
   - Database issues
   - Permission problems
   - Entity not appearing
   - API errors

---

## Next Steps

After creating your entity:

1. **Create first record** - Test the entity by adding data
2. **Configure settings** - Add categories, statuses, priorities
3. **Set up workflows** - Define approval processes if needed
4. **Train users** - Show team members how to use new entity
5. **Monitor usage** - Check if entity meets requirements

---

**Questions?** See [README](./README.md) for documentation index or contact your system administrator.

**Last Updated:** 2025-11-10
**Version:** 1.0
