# PMO Platform - Column & Table Naming Standards

> **Version**: 1.0.0
> **Last Updated**: 2025-11-27
> **Purpose**: Comprehensive naming conventions for database columns and tables to ensure consistent metadata generation and frontend rendering.

---

## Quick Reference Summary

| Suffix/Prefix | Business Type | Example | Database Type |
|---------------|---------------|---------|---------------|
| `_ts` | Timestamp | `created_ts`, `updated_ts` | `timestamptz` |
| `_flag` | Boolean | `active_flag`, `taxable_flag` | `boolean` |
| `_amt` | Currency | `budget_allocated_amt` | `decimal(15,2)` |
| `_qty` | Quantity | `reorder_level_qty` | `integer` |
| `_id` | Entity Reference | `manager__employee_id` | `uuid` |
| `_ids` | Entity References Array | `stakeholder__employee_ids` | `uuid[]` |
| `_date` | Date | `hire_date`, `birth_date` | `date` |
| `_name` | Name | `first_name`, `last_name` | `varchar` |
| `_pct` | Percentage | `discount_pct` | `float` |
| `_email` | Email | `primary_email` | `varchar(255)` |
| `_phone` | Phone | `mobile_phone` | `varchar(50)` |
| `_url` | URL | `website_url` | `text` |
| `_bytes` | File Size | `file_size_bytes` | `bigint` |
| `dl__*` | Datalabel (Dropdown) | `dl__project_stage` | `text` |
| `is_*` | Boolean | `is_active` | `boolean` |
| `s3_*` | S3 Storage | `s3_bucket`, `s3_key` | `varchar` |

---

## 1. Column Suffix Standards

### 1.1 Temporal Fields

| Suffix | Business Type | Description | SQL Type | Example |
|--------|---------------|-------------|----------|---------|
| `_ts` | `timestamp` | General timestamp | `timestamptz` | `scheduled_ts`, `approved_ts` |
| `created_ts` | `timestamp_readonly` | Record creation (system-managed) | `timestamptz DEFAULT now()` | Always `created_ts` |
| `updated_ts` | `timestamp_readonly` | Last update (system-managed) | `timestamptz DEFAULT now()` | Always `updated_ts` |
| `from_ts` | `systemInternal_ts` | Validity start (temporal) | `timestamptz DEFAULT now()` | Always `from_ts` |
| `to_ts` | `systemInternal_ts` | Validity end (temporal) | `timestamptz` | Always `to_ts` |
| `_at` | `timestamp` | Alternative timestamp suffix | `timestamptz` | `logged_at`, `sent_at` |
| `_datetime` | `timestamp` | DateTime field | `timestamptz` | `invoice_datetime` |
| `_date` | `date` | Date only (no time) | `date` | `hire_date`, `birth_date`, `due_date` |
| `_time` | `time` | Time only (no date) | `time` / `varchar` | `start_time`, `end_time` |

**Examples:**
```sql
created_ts timestamptz DEFAULT now(),      -- System timestamp (readonly)
updated_ts timestamptz DEFAULT now(),      -- System timestamp (readonly)
from_ts timestamptz DEFAULT now(),         -- Temporal validity (hidden)
to_ts timestamptz,                         -- Temporal validity (hidden)
hire_date date,                            -- User-editable date
planned_start_date date,                   -- User-editable date
invoice_datetime timestamptz DEFAULT now() -- User-editable timestamp
```

---

### 1.2 Boolean Fields

| Suffix/Prefix | Business Type | Description | SQL Type | Example |
|---------------|---------------|-------------|----------|---------|
| `_flag` | `boolean` | General boolean flag | `boolean DEFAULT true/false` | `taxable_flag`, `remote_work_eligible_flag` |
| `active_flag` | `systemInternal_flag` | Soft delete (hidden from UI) | `boolean DEFAULT true` | Always `active_flag` |
| `is_*` | `boolean` | Boolean with "is" prefix | `boolean` | `is_verified`, `is_primary` |

**Examples:**
```sql
active_flag boolean DEFAULT true,           -- System (hidden from UI)
taxable_flag boolean DEFAULT true,          -- User-editable
remote_work_eligible_flag boolean DEFAULT false,
is_verified boolean DEFAULT false
```

---

### 1.3 Currency & Monetary Fields

| Suffix | Business Type | Description | SQL Type | Example |
|--------|---------------|-------------|----------|---------|
| `_amt` | `currency` | Monetary amount (CAD) | `decimal(15,2)` | `budget_allocated_amt` |
| `_amount` | `currency` | Alternative amount suffix | `decimal(15,2)` | `total_amount` |
| `_price` | `currency` | Price value | `decimal(15,2)` | `unit_price` |
| `_cost` | `currency` | Cost value | `decimal(15,2)` | `labor_cost` |
| `_charge` | `currency` | Charge/fee | `decimal(15,2)` | `service_charge` |
| `_total` | `currency` | Total value | `decimal(12,2)` | `invoice_total` |
| `_subtotal` | `currency` | Subtotal value | `decimal(12,2)` | `line_subtotal` |
| `_cad` | `currency` | Explicit CAD currency | `decimal(12,2)` | `amount_paid_cad` |
| `_cents` | `currency_cents` | Amount in cents | `integer` | `tip_cents` |
| `budget_*` | `currency` | Budget-related fields | `decimal(15,2)` | `budget_spent_amt` |
| `credit_limit_amt` | `currency` | Credit limit | `decimal(15,2)` | Exact match |
| `discount_amt` | `currency` | Discount amount | `decimal(15,2)` | Exact match |

**Examples:**
```sql
budget_allocated_amt decimal(15,2),         -- Currency: $50,000.00
budget_spent_amt decimal(15,2) DEFAULT 0,   -- Currency: $0.00
total_amount_cad decimal(12,2),             -- Currency (CAD explicit)
unit_price decimal(10,2),                   -- Currency
```

---

### 1.4 Quantity & Count Fields

| Suffix | Business Type | Description | SQL Type | Example |
|--------|---------------|-------------|----------|---------|
| `_qty` | `quantity` | Quantity | `integer` | `reorder_level_qty`, `order_qty` |
| `qty` | `quantity` | Standalone quantity | `integer` | `qty` |
| `_count` | `count` | Count/tally | `integer` | `item_count`, `failed_login_attempts` |
| `_num` | `number` | General number | `integer` | `invoice_num` |

**Examples:**
```sql
reorder_level_qty integer DEFAULT 0,
reorder_qty integer DEFAULT 0,
item_count integer,
failed_login_attempts integer DEFAULT 0
```

---

### 1.5 Percentage & Rate Fields

| Suffix | Business Type | Description | SQL Type | Example |
|--------|---------------|-------------|----------|---------|
| `_pct` | `percentage` | Percentage (0-100) | `numeric(5,2)` | `completion_pct` |
| `_percent` | `percentage` | Alternative percentage | `numeric(5,2)` | `discount_percent` |
| `_rate` | `percentage` | Rate value | `numeric(5,4)` | `tax_rate`, `interest_rate` |
| `margin_percent` | `percentage` | Exact match | `numeric(5,2)` | |
| `discount_percent` | `percentage` | Exact match | `numeric(5,2)` | |
| `tax_rate` | `percentage` | Exact match | `numeric(5,4)` | |

**Examples:**
```sql
completion_pct numeric(5,2),               -- 85.50%
discount_percent numeric(5,2),             -- 10.00%
tax_rate numeric(5,4)                      -- 0.1300 (13%)
```

---

### 1.6 Duration Fields

| Suffix | Business Type | Description | SQL Type | Example |
|--------|---------------|-------------|----------|---------|
| `duration` | `duration` | General duration (minutes) | `integer` | `duration` |
| `_duration` | `duration` | Suffixed duration | `integer` | `call_duration` |
| `_minutes` | `duration_minutes` | Duration in minutes | `integer` | `estimated_minutes` |
| `_hours` | `duration_hours` | Duration in hours | `numeric(10,2)` | `estimated_hours` |
| `_seconds` | `duration_seconds` | Duration in seconds | `integer` | `response_seconds` |
| `_ms` | `duration_ms` | Duration in milliseconds | `integer` | `latency_ms` |

**Examples:**
```sql
estimated_hours numeric(10,2),             -- 8.50 hours
actual_hours numeric(10,2),                -- 6.25 hours
call_duration integer,                     -- 45 (minutes by default)
response_ms integer                        -- 250 (milliseconds)
```

---

### 1.7 Entity Reference Fields (Foreign Keys)

| Pattern | Business Type | Description | SQL Type | Example |
|---------|---------------|-------------|----------|---------|
| `*__*_id` | `entityInstance_Id` | Prefixed reference (role + entity) | `uuid` | `manager__employee_id` |
| `*__*_ids` | `entityInstance_Ids` | Prefixed array reference | `uuid[]` | `stakeholder__employee_ids` |
| `*_id` | `entityInstance_Id` | Simple entity reference | `uuid` | `cust_id`, `project_id` |
| `*_ids` | `entityInstance_Ids` | Simple array reference | `uuid[]` | `assigned_employee_ids` |

**Naming Convention for Prefixed References:**
- Format: `{role}__{entity_code}_id` or `{role}__{entity_code}_ids`
- The prefix describes the **role** the referenced entity plays
- Examples:
  - `manager__employee_id` - The employee who is the manager
  - `sponsor__employee_id` - The employee who is the sponsor
  - `stakeholder__employee_ids` - Employees who are stakeholders

**Examples:**
```sql
-- Prefixed references (show role relationship)
manager__employee_id uuid,                   -- Employee acting as manager
sponsor__employee_id uuid,                   -- Employee acting as sponsor
stakeholder__employee_ids uuid[] DEFAULT '{}', -- Employees as stakeholders
parent__product_hierarchy_id uuid,           -- Self-reference with role

-- Simple references (direct relationship)
cust_id uuid,                                -- Customer reference
project_id uuid,                             -- Project reference
office_id uuid,                              -- Office reference
uploaded_by_employee_id uuid                 -- Employee reference
```

---

### 1.8 Contact & Address Fields

| Suffix/Pattern | Business Type | Description | SQL Type | Example |
|----------------|---------------|-------------|----------|---------|
| `email` | `email` | Email address | `varchar(255)` | `email` |
| `_email` | `email` | Suffixed email | `varchar(255)` | `primary_email` |
| `phone` | `phone` | Phone number | `varchar(50)` | `phone` |
| `mobile` | `phone` | Mobile number | `varchar(50)` | `mobile` |
| `fax` | `phone` | Fax number | `varchar(50)` | `fax` |
| `_phone` | `phone` | Suffixed phone | `varchar(50)` | `emergency_contact_phone` |
| `website` | `url` | Website URL | `text` | `website` |
| `_url` | `url` | Suffixed URL | `text` | `profile_url` |
| `address` | `address` | Full address | `text` | `address` |
| `_address` | `address` | Suffixed address | `text` | `billing_address` |
| `address_line1` | `text` | Address line 1 | `varchar(200)` | `address_line1` |
| `address_line2` | `text` | Address line 2 | `varchar(200)` | `address_line2` |
| `city` | `text` | City name | `varchar(100)` | `city` |
| `province` | `text` | Province/State | `varchar(100)` | `province` |
| `country` | `country` | Country | `varchar(100)` | `country` |
| `postal_code` | `postal_code` | Postal/ZIP code | `varchar(20)` | `postal_code` |
| `zipcode` | `postal_code` | US ZIP code | `varchar(10)` | `zipcode` |

**Examples:**
```sql
email varchar(255),
primary_email varchar(255),
phone varchar(50),
mobile varchar(50),
emergency_contact_phone varchar(50),
address_line1 varchar(200),
address_line2 varchar(200),
city varchar(100),
province varchar(100),
postal_code varchar(20),
country varchar(100) DEFAULT 'Canada'
```

---

### 1.9 Name & Text Fields

| Suffix/Pattern | Business Type | Description | SQL Type | Example |
|----------------|---------------|-------------|----------|---------|
| `name` | `name` | Display name (exact) | `varchar(200)` | `name` |
| `_name` | `name` | Suffixed name | `varchar(200)` | `client_name`, `project_name` |
| `first_name` | `name` | First name | `varchar(100)` | `first_name` |
| `last_name` | `name` | Last name | `varchar(100)` | `last_name` |
| `full_name` | `name` | Full name | `varchar(200)` | `full_name` |
| `title` | `title` | Title | `varchar(200)` | `title` |
| `subject` | `subject` | Subject line | `varchar(255)` | `subject` |
| `descr` | `description` | Description | `text` | `descr` |
| `description` | `description` | Alt description | `text` | `description` |
| `summary` | `summary` | Summary text | `text` | `summary` |
| `notes` | `text_long` | Notes | `text` | `notes` |
| `_notes` | `text_long` | Suffixed notes | `text` | `customer_notes` |
| `instructions` | `text_long` | Instructions | `text` | `instructions` |
| `_text` | `text_long` | Long text | `text` | `body_text` |
| `content` | `rich_text` | Rich content | `text` | `content` |

**Examples:**
```sql
name varchar(200),                          -- Required display name
first_name varchar(100),
last_name varchar(100),
title varchar(200),
descr text,                                 -- Short description
notes text,                                 -- Internal notes
customer_notes text,                        -- Customer-facing notes
terms_and_conditions text                   -- Long text content
```

---

### 1.10 File & Storage Fields

| Suffix/Pattern | Business Type | Description | SQL Type | Example |
|----------------|---------------|-------------|----------|---------|
| `_bytes` | `file_size` | Size in bytes | `bigint` | `file_size_bytes` |
| `file_hash` | `hash` | File hash | `varchar(128)` | `file_hash` |
| `_hash` | `hash` | General hash | `varchar(128)` | `password_hash` |
| `mime_type` | `mime_type` | MIME type | `varchar(255)` | `mime_type` |
| `file_extension` | `file_extension` | Extension | `varchar(50)` | `file_extension` |
| `s3_bucket` | `s3_bucket` | S3 bucket | `varchar(255)` | `s3_bucket` |
| `s3_key` | `s3_key` | S3 object key | `varchar(1000)` | `s3_key` |
| `s3_url` | `s3_url` | S3 URL | `text` | `s3_url` |
| `s3_region` | `s3_region` | S3 region | `varchar(50)` | `s3_region` |
| `_object_bucket` | `s3_bucket` | Alt S3 bucket | `varchar(100)` | `attachment_object_bucket` |
| `_object_key` | `s3_key` | Alt S3 key | `varchar(500)` | `attachment_object_key` |

**Examples:**
```sql
file_size_bytes bigint,
mime_type varchar(255),
file_extension varchar(50),
file_hash varchar(128),                     -- SHA256
s3_bucket varchar(255),
s3_key varchar(1000),
s3_region varchar(50) DEFAULT 'us-east-1',
s3_url text
```

---

### 1.11 Measurement Fields

| Suffix | Business Type | Description | SQL Type | Example |
|--------|---------------|-------------|----------|---------|
| `_sqft` | `area_sqft` | Square footage | `numeric` | `square_footage_sqft` |
| `square_footage` | `area_sqft` | Exact match | `numeric` | `square_footage` |
| `_m3` | `volume_m3` | Cubic meters | `numeric` | `tank_volume_m3` |
| `_cm` | `dimension_cm` | Centimeters | `varchar` | `width_cm` |
| `_kg` | `weight_kg` | Kilograms | `numeric` | `weight_kg` |
| `capacity_*` | `capacity` | Capacity | `integer` | `capacity_gallons` |

**Examples:**
```sql
square_footage numeric,
volume_m3 numeric(10,3),
width_cm varchar(20),
weight_kg numeric(10,2)
```

---

### 1.12 Rating & Score Fields

| Suffix/Pattern | Business Type | Description | SQL Type | Example |
|----------------|---------------|-------------|----------|---------|
| `rating` | `rating` | Rating (1-5) | `numeric(3,2)` | `rating` |
| `_rating` | `rating` | Suffixed rating | `numeric(3,2)` | `customer_rating` |
| `_score` | `score` | Score value | `numeric` | `performance_score` |
| `story_points` | `score` | Agile points | `integer` | `story_points` |

**Examples:**
```sql
rating numeric(3,2),                        -- 4.50 out of 5
customer_rating numeric(3,2),
story_points integer                        -- 8 points
```

---

### 1.13 Order & Version Fields

| Suffix/Pattern | Business Type | Description | SQL Type | Example |
|----------------|---------------|-------------|----------|---------|
| `sort_order` | `sort_order` | Sort order | `integer` | `sort_order` |
| `display_order` | `sort_order` | Display order | `integer` | `display_order` |
| `execution_order` | `sort_order` | Execution order | `integer` | `execution_order` |
| `version` | `version` | Version number | `integer DEFAULT 1` | `version` |
| `_version` | `version` | Suffixed version | `integer` | `schema_version` |

**Examples:**
```sql
sort_order integer,
display_order integer,
version integer DEFAULT 1                   -- Optimistic locking
```

---

### 1.14 Identification Numbers

| Pattern | Business Type | Description | SQL Type | Example |
|---------|---------------|-------------|----------|---------|
| `sin` | `sensitive_id` | Social Insurance # | `varchar(20)` | `sin` |
| `tax_id` | `tax_id` | Tax ID | `varchar(50)` | `tax_id` |
| `gst_hst_number` | `tax_id` | GST/HST number | `varchar(50)` | `gst_hst_number` |
| `_number` | `reference_number` | Reference number | `varchar(100)` | `invoice_number` |
| `invoice_number` | `invoice_number` | Invoice # | `varchar(50)` | `invoice_number` |
| `order_number` | `order_number` | Order # | `varchar(50)` | `order_number` |
| `po_number` | `po_number` | Purchase order # | `varchar(100)` | `po_number` |
| `tracking_number` | `tracking_number` | Tracking # | `varchar(100)` | `tracking_number` |
| `sku` | `sku` | SKU | `text` | `sku` |
| `upc` | `upc` | UPC barcode | `text` | `upc` |
| `barcode` | `barcode` | Barcode | `text` | `barcode` |

**Examples:**
```sql
sin varchar(20),                            -- Masked in UI
invoice_number varchar(50),
order_number varchar(50),
tracking_number varchar(100),
sku text,
upc text
```

---

### 1.15 Color & UI Fields

| Pattern | Business Type | Description | SQL Type | Example |
|---------|---------------|-------------|----------|---------|
| `color` | `color` | Color value | `varchar(20)` | `color` |
| `_color` | `color` | Suffixed color | `varchar(20)` | `background_color` |
| `color_code` | `color` | Color code | `varchar(20)` | `color_code` |
| `ui_icon` | `icon` | Icon name | `varchar(50)` | `ui_icon` |
| `ui_label` | `label` | Display label | `varchar(100)` | `ui_label` |

**Examples:**
```sql
color varchar(20),                          -- #FF5733 or "red"
ui_icon varchar(50),                        -- "FolderOpen" (Lucide icon)
ui_label varchar(100)                       -- "Projects"
```

---

### 1.16 Authentication & Security Fields

| Pattern | Business Type | Description | SQL Type | Example |
|---------|---------------|-------------|----------|---------|
| `username` | `username` | Username | `varchar(100)` | `username` |
| `password_hash` | `password_hash` | Hashed password | `varchar(255)` | `password_hash` |
| `_token` | `token` | Auth token | `varchar(255)` | `password_reset_token` |
| `ip` | `ip_address` | IP address | `varchar(50)` | `ip` |
| `_ip` | `ip_address` | Suffixed IP | `varchar(50)` | `client_ip` |
| `user_agent` | `user_agent` | Browser UA | `text` | `user_agent` |

**Examples:**
```sql
email varchar(255),                         -- Login email
password_hash varchar(255),                 -- bcrypt hash (hidden)
password_reset_token varchar(255),
last_login_ts timestamptz,
failed_login_attempts integer DEFAULT 0,
account_locked_until_ts timestamptz
```

---

## 2. Column Prefix Standards

### 2.1 Datalabel Prefix (`dl__`)

**Pattern:** `dl__{entity}_{attribute}`

Datalabel fields link to the unified `app.datalabel` table for settings-driven dropdowns with colored badges.

| Pattern | Business Type | Description | Example |
|---------|---------------|-------------|---------|
| `dl__*_stage` | `datalabel_dag` | Workflow stage (DAG) | `dl__project_stage`, `dl__task_stage` |
| `dl__*_state` | `datalabel_dag` | Workflow state (DAG) | `dl__form_state` |
| `dl__*_status` | `datalabel_dag` | Workflow status (DAG) | `dl__quote_status` |
| `dl__*` | `datalabel` | Generic datalabel | `dl__task_priority`, `dl__customer_tier` |

**Examples:**
```sql
dl__project_stage text,                     -- DAG: Initiation → Planning → Execution → Closure
dl__task_priority text,                     -- Simple: low, medium, high, critical
dl__employee_employment_type text,          -- Full-time, Part-time, Contract
dl__product_brand text,                     -- Carrier, Trane, Lennox
```

**Datalabel Naming Convention:**
- Datalabel name in `app.datalabel.datalabel_name` must match column name exactly
- Entity code is extracted from the datalabel name for grouping
- Example: Column `dl__task_priority` → datalabel_name: `dl__task_priority`

---

### 2.2 S3 Storage Prefix (`s3_`)

| Pattern | Business Type | Description | Example |
|---------|---------------|-------------|---------|
| `s3_bucket` | `s3_bucket` | S3 bucket name | `s3_bucket` |
| `s3_key` | `s3_key` | S3 object key | `s3_key` |
| `s3_url` | `s3_url` | Full S3 URL | `s3_url` |
| `s3_region` | `s3_region` | AWS region | `s3_region` |

---

### 2.3 Boolean Prefix (`is_`)

Alternative to `_flag` suffix for boolean fields.

```sql
is_verified boolean DEFAULT false,
is_primary boolean DEFAULT false,
is_active boolean DEFAULT true              -- Prefer active_flag for consistency
```

---

## 3. Standard Entity Table Structure

Every entity table MUST include these standard fields:

```sql
CREATE TABLE app.{entity_name} (
    -- Primary Key
    id uuid DEFAULT gen_random_uuid(),

    -- Business Identity
    code varchar(50),                        -- Business code: PROJ-001
    name varchar(200),                       -- Display name
    descr text,                              -- Description

    -- Extensibility
    metadata jsonb DEFAULT '{}'::jsonb,      -- Flexible attributes

    -- Soft Delete & Temporal
    active_flag boolean DEFAULT true,        -- Soft delete flag
    from_ts timestamptz DEFAULT now(),       -- Valid from
    to_ts timestamptz,                       -- Valid until

    -- Audit Timestamps
    created_ts timestamptz DEFAULT now(),    -- Created when
    updated_ts timestamptz DEFAULT now(),    -- Last modified

    -- Optimistic Locking
    version integer DEFAULT 1,               -- Version for concurrency

    -- Entity-specific fields below...
);
```

---

## 4. Table Naming Conventions

| Prefix | Type | Description | Example |
|--------|------|-------------|---------|
| `d_` | Dimension | Core entity tables | `d_project`, `d_employee` |
| (none) | Standard | Entity tables (current convention) | `project`, `task`, `employee` |
| `datalabel_` | Settings | Lookup/settings tables | `datalabel` (unified) |
| `entity_*` | Infrastructure | System tables | `entity`, `entity_instance`, `entity_rbac` |
| `*_head` | Fact Head | Header for head/data pattern | `invoice_head`, `form_head` |
| `*_data` | Fact Data | Detail rows for head/data pattern | `invoice_data`, `form_data` |
| `*_hierarchy` | Hierarchy | Hierarchical structures | `product_hierarchy`, `office_hierarchy` |

---

## 5. JSON/JSONB Field Patterns

| Pattern | Business Type | Description | Example |
|---------|---------------|-------------|---------|
| `metadata` | `json` | Extensible attributes | `metadata` |
| `_metadata` | `json` | Suffixed metadata | `field_metadata` |
| `_schema` | `json_schema` | JSON schema | `form_schema` |
| `_data` | `json` | JSON data | `graph_data` |
| `_graph` | `json` | Graph structure | `workflow_graph` |
| `_snapshot` | `json` | Point-in-time snapshot | `state_snapshot` |
| `_context` | `json` | Context object | `execution_context` |
| `tags` | `tags` | Array of tags | `tags` |
| `keywords` | `tags` | Keywords array | `keywords` |
| `_tags` | `tags` | Suffixed tags | `search_tags` |

**Examples:**
```sql
metadata jsonb DEFAULT '{}'::jsonb,
tags text[] DEFAULT ARRAY[]::text[],
form_schema jsonb,
workflow_graph jsonb
```

---

## 6. Coordinate & Geolocation Fields

| Pattern | Business Type | Description | SQL Type | Example |
|---------|---------------|-------------|----------|---------|
| `lat` | `latitude` | Latitude | `numeric(10,6)` | `lat` |
| `latitude` | `latitude` | Full name | `numeric(10,6)` | `latitude` |
| `lng` | `longitude` | Longitude | `numeric(10,6)` | `lng` |
| `lon` | `longitude` | Alt longitude | `numeric(10,6)` | `lon` |
| `longitude` | `longitude` | Full name | `numeric(10,6)` | `longitude` |
| `geo_coordinates` | `geolocation` | Combined | `text` | `geo_coordinates` |

---

## 7. Status & Category Fields

| Pattern | Business Type | Description | Example |
|---------|---------------|-------------|---------|
| `status` | `status` | General status | `status` |
| `_status` | `status` | Suffixed status | `payment_status` |
| `stage` | `stage` | Workflow stage | `stage` |
| `_stage` | `stage` | Suffixed stage | `approval_stage` |
| `_state` | `state_workflow` | State machine | `order_state` |
| `type` | `type` | Type classification | `type` |
| `_type` | `type` | Suffixed type | `invoice_type` |
| `category` | `category` | Category | `category` |
| `_category` | `category` | Suffixed category | `expense_category` |

**Note:** For dropdown/badge rendering, prefer `dl__*` pattern with datalabel lookup.

---

## 8. Best Practices Summary

### DO:

1. **Use consistent suffixes** - Always use `_ts` for timestamps, `_amt` for currency, `_flag` for booleans
2. **Use `dl__` prefix** for settings-driven dropdowns that need colored badges
3. **Use prefixed entity references** (`manager__employee_id`) when the role relationship matters
4. **Include standard fields** (id, code, name, descr, metadata, active_flag, timestamps, version)
5. **Use meaningful prefixes** in entity references to describe the relationship role
6. **Document with comments** - Add COMMENT ON COLUMN for complex fields

### DON'T:

1. **Don't mix conventions** - Pick one suffix (`_date` vs `_dt`) and use it consistently
2. **Don't use `_id` for non-references** - Reserve `_id` suffix for UUID entity references
3. **Don't hardcode dropdown values** - Use datalabel pattern for settings-driven dropdowns
4. **Don't skip standard fields** - Every entity needs id, code, name, timestamps
5. **Don't use foreign keys** - Use entity_instance_link for relationships (loose coupling)
6. **Don't create entity-specific datalabel tables** - Use unified `app.datalabel` table

---

## 9. Pattern Detection Priority

When detecting field types from column names, patterns are matched in this priority order:

1. **Exact matches first** - `id`, `code`, `name`, `created_ts`, `updated_ts`
2. **Specific patterns** - `dl__*_stage`, `*__*_id`, `budget_*`
3. **General suffixes** - `*_ts`, `*_amt`, `*_flag`, `*_id`
4. **Default fallback** - `text`

See `apps/api/src/services/pattern-mapping.yaml` for the complete pattern matching configuration.

---

## 10. Related Documentation

- **pattern-mapping.yaml** - Column name to fieldBusinessType mapping
- **view-type-mapping.yaml** - View mode rendering configuration
- **edit-type-mapping.yaml** - Edit mode input configuration
- **CLAUDE.md** - Platform specifications and API patterns
- **entity-infrastructure.service.md** - Entity CRUD operations

---

**Version History:**
- v1.0.0 (2025-11-27): Initial documentation of naming standards
