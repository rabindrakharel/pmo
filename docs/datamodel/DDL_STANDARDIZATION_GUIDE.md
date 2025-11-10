# DDL Standardization Guide - Column Naming & Type Conventions

**Purpose:** Centralized formatting middleware for consistent column naming, types, and patterns across all 48 DDL files

**Version:** 1.0.0
**Date:** 2025-11-10
**Total DDL Files:** 48 (Roman numerals I-XLVIII)

---

## 1. Core Column Patterns (Universal)

All entity tables MUST include these standard columns in this exact order:

### 1.1 Primary Identity Columns

```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
code varchar(50) UNIQUE NOT NULL,
name varchar(200) NOT NULL,  -- OR text NOT NULL (for longer names)
descr text,
metadata jsonb DEFAULT '{}'::jsonb,
active_flag boolean DEFAULT true,
```

**Rules:**
- `id`: ALWAYS uuid, ALWAYS PRIMARY KEY, ALWAYS gen_random_uuid()
- `code`: ALWAYS varchar(50), ALWAYS UNIQUE NOT NULL (business identifier like 'PRD-001', 'EMP-MILLER')
- `name`: varchar(200) for short names, text for long/variable length names
- `descr`: ALWAYS text (full description), nullable
- `metadata`: ALWAYS jsonb, ALWAYS default to empty object
- `active_flag`: ALWAYS boolean, ALWAYS default true (for soft deletes)

### 1.2 Temporal Columns (Audit Trail)

```sql
from_ts timestamptz DEFAULT now(),
to_ts timestamptz,
created_ts timestamptz DEFAULT now(),
updated_ts timestamptz DEFAULT now(),
version integer DEFAULT 1
```

**Rules:**
- `from_ts`: Effective date/time this record became valid (bitemporal modeling)
- `to_ts`: End date/time for validity (NULL = currently valid)
- `created_ts`: Record creation timestamp (immutable)
- `updated_ts`: Last update timestamp (auto-updated by trigger)
- `version`: Optimistic locking version counter (increment on UPDATE)

**Placement:** ALWAYS place temporal columns at the END of table definition, after all entity-specific fields

---

## 2. Entity-Specific Column Patterns

### 2.1 Hierarchy Tables

All hierarchy tables MUST include:

```sql
parent_id uuid,  -- Self-referential (NULL for top level)
dl__[entity]_hierarchy_level text NOT NULL  -- References app.setting_datalabel
```

**Examples:**
- `dl__product_hierarchy_level` → 'Division', 'Department', 'Class', 'Sub-Class'
- `dl__office_hierarchy_level` → 'Corporate', 'Region', 'District', 'Office'
- `dl__business_hierarchy_level` → 'Corporate', 'Division', 'Department'

**Rules:**
- `parent_id`: ALWAYS nullable uuid (NULL = root level)
- Level field: ALWAYS `dl__[entity]_hierarchy_level` pattern
- Level field references: `app.setting_datalabel (datalabel_name='dl__[entity]_hierarchy_level')`

### 2.2 Reference/Relationship Columns

```sql
-- Employee references
manager_employee_id uuid
assignee_employee_id uuid
created_by_employee_id uuid

-- Entity references (polymorphic via d_entity_id_map)
office_id uuid
business_id uuid
customer_id uuid
project_id uuid

-- Data label references (dropdown values from app.setting_datalabel)
dl__[entity]_[field] text
```

**Rules:**
- Employee refs: ALWAYS suffix with `_employee_id`
- Entity refs: ALWAYS suffix with `_id`, NEVER use foreign key constraints (use d_entity_id_map)
- Data labels: ALWAYS prefix with `dl__`, ALWAYS type `text`

### 2.3 Measurement & Quantity Columns

```sql
-- Amounts (financial)
budget_allocated_amt decimal(15,2)
unit_price_amt decimal(15,2)
cost_amt decimal(15,2)
total_amt decimal(15,2)

-- Quantities (countable)
on_hand_qty integer DEFAULT 0
reorder_level_qty integer DEFAULT 0
reorder_qty integer DEFAULT 0
capacity_employees integer

-- Measurements (physical)
square_footage integer
capacity_gallons integer
length_ft integer
weight_lbs integer
```

**Rules:**
- Amounts: ALWAYS suffix `_amt`, ALWAYS `decimal(15,2)` (financial precision)
- Quantities: ALWAYS suffix `_qty`, ALWAYS `integer`, ALWAYS default to 0 if applicable
- Measurements: ALWAYS suffix with unit (`_ft`, `_lbs`, `_sqft`, `_gallons`)

### 2.4 Status & Classification Columns

```sql
-- Status fields (use data labels when possible)
dl__[entity]_status text
operational_status text DEFAULT 'Active'
publication_status text DEFAULT 'draft'

-- Classification fields
dl__[entity]_category text
dl__[entity]_type text
dl__[entity]_priority text

-- Level fields (hierarchy)
item_level text
tran_level text
dl__[entity]_hierarchy_level text
```

**Rules:**
- Status: Prefer `dl__[entity]_status` referencing app.setting_datalabel
- Fallback: Use direct text field with sensible DEFAULT
- Classification: ALWAYS reference app.setting_datalabel when possible

### 2.5 Contact Information Columns

```sql
-- Email addresses
email varchar(200)
primary_email varchar(200)
work_email varchar(200)

-- Phone numbers
phone varchar(50)
mobile_phone varchar(50)
work_phone varchar(50)

-- Addresses
address_line1 varchar(200) NOT NULL
address_line2 varchar(200)
city varchar(100) NOT NULL
province varchar(100) NOT NULL
postal_code varchar(20) NOT NULL
country varchar(100) DEFAULT 'Canada'
```

**Rules:**
- Email: ALWAYS `varchar(200)`, nullable unless required
- Phone: ALWAYS `varchar(50)` (accommodate extensions, formatting)
- Address: line1, city, province, postal_code NOT NULL for physical locations
- Country: ALWAYS default to 'Canada' (Canadian business context)

### 2.6 Product Identification Columns

```sql
-- Product/item identifiers
style text
sku text
upc text
supplier_part_number text
dl__product_brand text

-- Product attributes
item_level text
tran_level text
unit_of_measure text DEFAULT 'each'
```

**Rules:**
- Style/SKU/UPC: ALWAYS text (variable length, alphanumeric codes)
- Brand: ALWAYS `dl__product_brand` referencing app.setting_datalabel
- Unit of measure: Common values: 'each', 'box', 'linear_foot', 'square_foot', 'gallon', 'cubic_yard'

---

## 3. Naming Convention Rules

### 3.1 Table Naming

```
Pattern: [prefix]_[entity_name]

Prefixes:
- d_       → Dimension tables (entities)
- f_       → Fact tables (transactions, events)
- setting_ → Configuration/settings tables
- rel_     → Relationship/junction tables (rare, prefer d_entity_id_map)

Examples:
✅ d_product
✅ d_office_hierarchy
✅ f_inventory
✅ f_order
✅ setting_datalabel
❌ product (missing prefix)
❌ tbl_office (wrong prefix)
```

### 3.2 Column Naming (snake_case)

```
Pattern: [qualifier_][base_name][_suffix]

Suffixes:
- _id       → UUID references
- _amt      → Financial amounts (decimal)
- _qty      → Quantities (integer)
- _ts       → Timestamps (timestamptz)
- _flag     → Booleans
- _name     → Text names
- _code     → Business codes
- _level    → Classification levels
- _type     → Type classifications
- _status   → Status values

Prefixes:
- dl__      → Data label references (app.setting_datalabel)
- is_       → Boolean flags (alternative to _flag suffix)
- has_      → Boolean flags indicating possession

Examples:
✅ manager_employee_id (qualifier_base_suffix)
✅ budget_allocated_amt (qualifier_base_suffix)
✅ dl__product_brand (prefix_base)
✅ reorder_level_qty (qualifier_base_suffix)
✅ active_flag (base_suffix)
❌ managerId (camelCase not allowed)
❌ BudgetAmount (PascalCase not allowed)
❌ employee-id (hyphens not allowed)
```

### 3.3 Data Label Naming

```
Pattern: dl__[entity]_[attribute]

Examples:
✅ dl__product_brand
✅ dl__product_hierarchy_level
✅ dl__business_hierarchy_level
✅ dl__office_hierarchy_level
✅ dl__task_stage
✅ dl__task_priority
✅ dl__project_stage
❌ dl__product__brand (double underscore after prefix)
❌ product_brand (missing dl__ prefix)
❌ dl_product_brand (single underscore after dl)
```

**Setting_datalabel table reference:**
```sql
-- In app.setting_datalabel
datalabel_name = 'dl__product_brand'

-- In d_product table
dl__product_brand text  -- References app.setting_datalabel
```

---

## 4. Data Type Standards

### 4.1 Required Data Types by Purpose

| Purpose | Data Type | Default | Notes |
|---------|-----------|---------|-------|
| Primary key | `uuid` | `gen_random_uuid()` | ALWAYS uuid, never serial/bigserial |
| Business code | `varchar(50)` | - | UNIQUE NOT NULL |
| Short name | `varchar(200)` | - | NOT NULL |
| Long name/description | `text` | - | Nullable |
| Flag/boolean | `boolean` | `true` or `false` | ALWAYS have default |
| Financial amount | `decimal(15,2)` | - | 2 decimal precision |
| Quantity | `integer` | `0` if applicable | Whole numbers |
| Timestamp | `timestamptz` | `now()` | ALWAYS with timezone |
| JSON metadata | `jsonb` | `'{}'::jsonb` | ALWAYS jsonb (indexed), never json |
| Email | `varchar(200)` | - | RFC 5321 max length |
| Phone | `varchar(50)` | - | Accommodate extensions |
| Postal code | `varchar(20)` | - | International formats |
| Data label reference | `text` | - | References app.setting_datalabel |

### 4.2 Type Selection Decision Tree

```
Identifier/Code?
  → Short (< 50 chars)? → varchar(50)
  → Variable length? → text

Name/Label?
  → Short (< 200 chars)? → varchar(200)
  → Long/variable? → text

Number?
  → Money/price? → decimal(15,2)
  → Quantity/count? → integer
  → Measurement? → integer (with unit suffix)

Date/Time?
  → ALWAYS → timestamptz (with timezone)
  → NEVER → date, time, timestamp (without tz)

Yes/No?
  → ALWAYS → boolean (never char(1), integer)

Structured data?
  → ALWAYS → jsonb (never json, text)
```

---

## 5. Constraint & Index Standards

### 5.1 Constraint Removal Policy

**IMPORTANT:** As of 2025-11-10, ALL DDL files have had foreign key constraints and indexes removed.

**Rationale:**
- Relationships managed via `d_entity_id_map` (polymorphic)
- No foreign keys enforce entity relationships
- Indexes created separately for performance tuning

**Rules:**
- ❌ NO FOREIGN KEY constraints in any DDL file
- ❌ NO CREATE INDEX statements in DDL files
- ✅ PRIMARY KEY constraints allowed (on `id` column)
- ✅ UNIQUE constraints allowed (on `code` column)

### 5.2 Allowed Constraints

```sql
-- ✅ ALLOWED: Primary key
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

-- ✅ ALLOWED: Unique constraint
code varchar(50) UNIQUE NOT NULL,

-- ✅ ALLOWED: NOT NULL constraint
name varchar(200) NOT NULL,

-- ✅ ALLOWED: DEFAULT values
active_flag boolean DEFAULT true,
metadata jsonb DEFAULT '{}'::jsonb,

-- ❌ FORBIDDEN: Foreign keys
-- office_id uuid REFERENCES app.d_office(id),  -- NO!

-- ❌ FORBIDDEN: Check constraints (manage in application layer)
-- CHECK (status IN ('active', 'inactive'))  -- NO!

-- ❌ FORBIDDEN: Indexes (create separately)
-- CREATE INDEX idx_employee_office ON app.d_employee(office_id);  -- NO!
```

---

## 6. DDL File Structure Standards

### 6.1 Required Sections (in order)

```sql
-- =====================================================
-- [ENTITY NAME] ([TABLE NAME]) - [ONE-LINE PURPOSE]
-- =====================================================
--
-- SEMANTICS:
-- [Comprehensive documentation of business purpose]
-- [Database behavior and patterns]
-- [Key concepts and relationships]
--
-- **HIERARCHY CONCEPT** (if applicable):
-- • [Explain base entity vs hierarchy separation]
-- • [Explain relationship via d_entity_id_map]
-- • [Provide concrete examples]
--
-- OPERATIONS:
-- • CREATE: [HTTP method and endpoint]
-- • UPDATE: [HTTP method and behavior]
-- • DELETE: [Soft delete behavior]
-- • LIST: [Query filters and RBAC]
--
-- KEY FIELDS:
-- • field_name: type - description
-- • ...
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • Parent: [entity] (via d_entity_id_map)
-- • Children: [entities]
-- • RBAC: entity_id_rbac_map
--
-- =====================================================

CREATE TABLE app.[table_name] (
  -- Column definitions following standards above
);

COMMENT ON TABLE app.[table_name] IS '[concise table description]';

-- =====================================================
-- DATA CURATION
-- =====================================================

INSERT INTO app.[table_name] VALUES (...);
-- Curated data inserts with examples

-- =====================================================
-- COMMENTS (optional, if needed for specific columns)
-- =====================================================

COMMENT ON COLUMN app.[table_name].[column] IS '...';
```

### 6.2 Section Requirements

**SEMANTICS Section:**
- Explain business purpose (WHY this table exists)
- Describe key concepts and relationships
- Document any special patterns (hierarchy, temporal, polymorphic)

**OPERATIONS Section:**
- Document CRUD operations with HTTP endpoints
- Specify soft delete behavior (active_flag = false)
- List common query filters
- Note RBAC enforcement

**KEY FIELDS Section:**
- List ALL important fields with type and description
- Use bullet format: `• field_name: type - description`
- Focus on business-relevant fields (omit standard columns if obvious)

**RELATIONSHIPS Section:**
- ALWAYS state "NO FOREIGN KEYS"
- List parent entities (via d_entity_id_map)
- List child entities
- Note RBAC integration (entity_id_rbac_map)

**DATA CURATION Section:**
- ALWAYS provide sample data
- Use realistic business examples (Huron Home Services context)
- For hierarchy tables: show full 3-4 level structure
- Use SELECT subqueries for parent_id references

---

## 7. Common Patterns & Examples

### 7.1 Base Entity + Hierarchy Pattern

```sql
-- Base Entity (operational/SKU-level)
CREATE TABLE app.d_product (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name text NOT NULL,
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    active_flag boolean DEFAULT true,

    -- Product-specific fields (NO hierarchy fields)
    style text,
    sku text,
    upc text,
    dl__product_brand text,

    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);

-- Hierarchy Entity (organizational structure)
CREATE TABLE app.d_product_hierarchy (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    active_flag boolean DEFAULT true,

    -- Hierarchy fields
    parent_id uuid,
    dl__product_hierarchy_level text NOT NULL,

    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);

-- Linkage via d_entity_id_map (NOT foreign keys)
-- INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
```

### 7.2 Contact Information Pattern

```sql
CREATE TABLE app.d_office (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,

    -- Address (for physical locations - ALL NOT NULL)
    address_line1 varchar(200) NOT NULL,
    address_line2 varchar(200),
    city varchar(100) NOT NULL,
    province varchar(100) NOT NULL,
    postal_code varchar(20) NOT NULL,
    country varchar(100) DEFAULT 'Canada',

    -- Contact
    phone varchar(50),
    email varchar(200),

    -- Standard temporal columns
    from_ts timestamptz DEFAULT now(),
    ...
);
```

### 7.3 Status & Classification Pattern

```sql
CREATE TABLE app.d_task (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name text NOT NULL,

    -- Status via data labels (preferred)
    dl__task_stage text,  -- References 'dl__task_stage' in app.setting_datalabel
    dl__task_priority text,  -- References 'dl__task_priority' in app.setting_datalabel

    -- Direct status field (when data labels not applicable)
    operational_status text DEFAULT 'Active',

    -- Standard temporal columns
    ...
);
```

---

## 8. Verification Checklist

Use this checklist when creating or reviewing DDL files:

### 8.1 Table Structure
- [ ] Table name follows `[prefix]_[entity]` pattern (d_, f_, setting_)
- [ ] All standard columns present (id, code, name, descr, metadata, active_flag)
- [ ] Temporal columns at END of definition (from_ts, to_ts, created_ts, updated_ts, version)
- [ ] NO foreign key constraints
- [ ] NO index definitions

### 8.2 Column Naming
- [ ] All columns use snake_case
- [ ] All ID columns end with `_id`
- [ ] All amount columns end with `_amt` (decimal 15,2)
- [ ] All quantity columns end with `_qty` (integer)
- [ ] All timestamp columns end with `_ts` (timestamptz)
- [ ] All flag columns end with `_flag` (boolean)
- [ ] All data label refs start with `dl__` (text)

### 8.3 Data Types
- [ ] Primary key: uuid with gen_random_uuid()
- [ ] Code: varchar(50) UNIQUE NOT NULL
- [ ] Metadata: jsonb DEFAULT '{}'::jsonb
- [ ] Timestamps: timestamptz (with timezone)
- [ ] Financial amounts: decimal(15,2)
- [ ] Booleans: boolean (with DEFAULT)

### 8.4 Documentation
- [ ] SEMANTICS section explains business purpose
- [ ] OPERATIONS section documents CRUD endpoints
- [ ] KEY FIELDS section lists important fields
- [ ] RELATIONSHIPS section notes "NO FOREIGN KEYS"
- [ ] DATA CURATION section provides sample data
- [ ] COMMENT ON TABLE statement present

### 8.5 Data Curation
- [ ] Sample data uses realistic Huron Home Services examples
- [ ] Hierarchy examples show 3-4 level structures
- [ ] Parent references use SELECT subqueries (not hardcoded UUIDs)
- [ ] All data follows Canadian business context

---

## 9. Anti-Patterns (Things to AVOID)

### 9.1 Naming Anti-Patterns

```sql
-- ❌ WRONG: camelCase
employeeId uuid

-- ✅ CORRECT: snake_case
employee_id uuid

-- ❌ WRONG: Missing suffix on amount
budget decimal(15,2)

-- ✅ CORRECT: _amt suffix
budget_amt decimal(15,2)

-- ❌ WRONG: Generic "type" without entity prefix
type text

-- ✅ CORRECT: Entity-specific type
dl__product_type text

-- ❌ WRONG: Abbreviations without context
emp_id uuid

-- ✅ CORRECT: Full descriptive name
employee_id uuid
```

### 9.2 Type Anti-Patterns

```sql
-- ❌ WRONG: Using serial/bigserial for IDs
id serial PRIMARY KEY

-- ✅ CORRECT: Using uuid
id uuid PRIMARY KEY DEFAULT gen_random_uuid()

-- ❌ WRONG: Using json instead of jsonb
metadata json

-- ✅ CORRECT: Using jsonb (indexed, faster)
metadata jsonb DEFAULT '{}'::jsonb

-- ❌ WRONG: Using timestamp without timezone
created_at timestamp

-- ✅ CORRECT: Using timestamptz
created_ts timestamptz DEFAULT now()

-- ❌ WRONG: Using varchar for money
price varchar(20)

-- ✅ CORRECT: Using decimal for financial amounts
price_amt decimal(15,2)

-- ❌ WRONG: Using integer for boolean flags
active integer DEFAULT 1

-- ✅ CORRECT: Using boolean
active_flag boolean DEFAULT true
```

### 9.3 Constraint Anti-Patterns

```sql
-- ❌ WRONG: Foreign key constraints
office_id uuid REFERENCES app.d_office(id)

-- ✅ CORRECT: No foreign keys, use d_entity_id_map
office_id uuid  -- Linked via d_entity_id_map

-- ❌ WRONG: Check constraints in DDL
status text CHECK (status IN ('active', 'inactive'))

-- ✅ CORRECT: Use data labels or application layer validation
dl__entity_status text  -- References app.setting_datalabel

-- ❌ WRONG: Indexes in DDL file
CREATE INDEX idx_employee_office ON app.d_employee(office_id);

-- ✅ CORRECT: Create indexes separately (not in DDL)
-- (managed by DBA, not in entity DDL files)
```

### 9.4 Structure Anti-Patterns

```sql
-- ❌ WRONG: Temporal columns in middle of definition
CREATE TABLE app.d_product (
    id uuid PRIMARY KEY,
    code varchar(50),
    from_ts timestamptz DEFAULT now(),  -- TOO EARLY!
    style text,
    sku text
);

-- ✅ CORRECT: Temporal columns at END
CREATE TABLE app.d_product (
    id uuid PRIMARY KEY,
    code varchar(50),
    style text,
    sku text,
    from_ts timestamptz DEFAULT now(),  -- AT END
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);
```

---

## 10. Migration Path for Non-Compliant DDLs

If you find a DDL file that doesn't follow these standards:

### 10.1 Assessment Phase
1. Read the DDL file completely
2. Identify non-compliant patterns using Section 9 (Anti-Patterns)
3. Check against verification checklist (Section 8)
4. Document all violations

### 10.2 Refactoring Phase
1. **Column Renaming:**
   - Update column names to follow snake_case and suffix conventions
   - Update all INSERT statements referencing renamed columns

2. **Type Corrections:**
   - Change serial → uuid
   - Change json → jsonb
   - Change timestamp → timestamptz
   - Add DEFAULT values where missing

3. **Structure Reorganization:**
   - Move temporal columns to end of table definition
   - Ensure standard columns in correct order

4. **Constraint Removal:**
   - Remove all FOREIGN KEY constraints
   - Remove all CREATE INDEX statements
   - Keep PRIMARY KEY and UNIQUE constraints only

5. **Documentation Update:**
   - Add missing SEMANTICS section
   - Add missing OPERATIONS section
   - Update KEY FIELDS section
   - Ensure RELATIONSHIPS notes "NO FOREIGN KEYS"

6. **Data Curation:**
   - Update sample data to match new column names
   - Ensure Canadian business context
   - Add hierarchy examples if applicable

### 10.3 Testing Phase
1. Run `./tools/db-import.sh --dry-run` to validate syntax
2. Run `./tools/db-import.sh` to execute import
3. Verify sample data loaded correctly
4. Test API endpoints affected by changes

---

## 11. Reference Examples

### 11.1 Perfect Entity DDL Template

```sql
-- =====================================================
-- [ENTITY NAME] (d_[entity]) - [PURPOSE]
-- =====================================================
--
-- SEMANTICS:
-- [Business purpose explanation]
--
-- OPERATIONS:
-- • CREATE: POST /api/v1/[entity], INSERT with version=1, active_flag=true
-- • UPDATE: PUT /api/v1/[entity]/{id}, same ID, version++, in-place
-- • DELETE: active_flag=false, to_ts=now() (soft delete)
-- • LIST: GET /api/v1/[entity], filters by X, RBAC enforced
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY (stable)
-- • code: varchar(50) UNIQUE ('XXX-001')
-- • name: varchar(200) NOT NULL ('Display Name')
-- • [entity-specific fields]
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • Parent: [entity] (via d_entity_id_map)
-- • Children: [entities]
-- • RBAC: entity_id_rbac_map
--
-- =====================================================

CREATE TABLE app.d_[entity] (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    active_flag boolean DEFAULT true,

    -- Entity-specific fields here
    -- (amounts, quantities, data labels, etc.)

    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);

COMMENT ON TABLE app.d_[entity] IS '[Concise description]';

-- =====================================================
-- DATA CURATION
-- =====================================================

INSERT INTO app.d_[entity] (code, name, descr, [...]) VALUES
('[CODE-001]', '[Name]', '[Description]', [...]);

COMMENT ON TABLE app.d_[entity] IS '[Description]';
```

---

**Last Updated:** 2025-11-10
**Maintained By:** PMO Platform Team
**Next Review:** Quarterly (or when adding new entities)

**Related Documents:**
- `DDL_ROMAN_NUMERAL_MAPPING.md` - File naming and dependency order
- `datamodel.md` - Complete data model documentation
- `entity_ui_ux_route_api.md` - API integration patterns
