# Database Naming Convention Standardization - Migration Plan

**Generated:** 2025-10-30
**Status:** DRAFT - Ready for Review
**Impact:** Schema-Breaking Changes - Requires Full Migration

---

## CRITICAL CORRECTIONS (Updated 2025-10-30)

**⚠️ THESE RULES ARE MANDATORY - NO EXCEPTIONS**

### 1. Remove tags and slug Columns

**ACTION:** DELETE these columns from ALL entity tables

```sql
-- ❌ REMOVE THESE:
slug varchar(255)
tags jsonb DEFAULT '[]'::jsonb
```

**Affected:** All 13 core entity tables (d_project, d_task, d_office, d_business, d_employee, d_cust, d_role, d_position, d_worksite, d_form_head, d_wiki, d_artifact, d_reports)

**Rationale:** Simplified data model, reduce unnecessary complexity

---

### 2. Datalabel Semantic Suffix Requirement

**RULE:** ALL `dl__*` columns MUST end with semantic suffix indicating what they represent

**Valid Semantic Suffixes:**
- `_stage` - Workflow stages (project_stage, task_stage)
- `_status` - Status values (publication_status, approval_status)
- `_level` - Hierarchy levels (office_level, position_level)
- `_tier` - Service/classification tiers (customer_tier)
- `_priority` - Priority levels (task_priority)
- `_sector` - Industry/business sectors (industry_sector)
- `_channel` - Channels (acquisition_channel)
- `_label` - Generic labels

**✅ CORRECT Examples:**
```sql
dl__project_stage text           -- ends with "_stage"
dl__customer_tier text            -- ends with "_tier"
dl__office_level text             -- ends with "_level"
dl__task_priority text            -- ends with "_priority"
dl__wiki_publication_status text  -- ends with "_status"
dl__industry_sector text          -- ends with "_sector"
dl__acquisition_channel text      -- ends with "_channel"
```

**❌ INCORRECT Examples:**
```sql
dl__project      -- missing semantic suffix
dl__customer     -- missing semantic suffix
dl__office       -- missing semantic suffix
dl__task         -- missing semantic suffix
```

---

### 3. Boolean Naming - NO is_* Patterns Allowed

**RULE:** ALL boolean columns MUST use `*_flag` suffix, ZERO exceptions

**✅ CORRECT Examples:**
```sql
system_role_flag boolean
active_flag boolean
management_flag boolean
public_flag boolean
background_check_required_flag boolean
```

**❌ INCORRECT Examples:**
```sql
is_system_role boolean        -- WRONG: uses is_* prefix
is_active boolean              -- WRONG: uses is_* prefix
is_management boolean          -- WRONG: uses is_* prefix
is_public boolean              -- WRONG: uses is_* prefix
```

**Rationale:**
- Consistency across ALL boolean columns
- Frontend auto-detection pattern: `*_flag` → BOOLEAN category
- `is_*` pattern breaks auto-detection and DRY principles

---

## Executive Summary

This document outlines a comprehensive standardization of database column naming conventions across all 39 DDL files. The standardization ensures consistency, improves code generation (field category auto-detection), and aligns with modern DRY principles.

### Naming Convention Rules

| Pattern | Rule | Example | Auto-Detection |
|---------|------|---------|----------------|
| **Booleans** | Must end with `_flag` | `active_flag`, `system_role_flag` | `*_flag` → BOOLEAN category |
| **Datalabels** | Must start with `dl__` (no `_name` suffix) | `dl__project_stage`, `dl__customer_tier` | `dl__*` → LABEL category |
| **Quantities** | Must end with `_qty` | `on_hand_qty`, `reorder_qty` | `*_qty` → NUMBER category |
| **Money** | Must end with `_amt` | `budget_allocated_amt`, `unit_price_amt` | `*_amt` → AMOUNT category |
| **Percentages** | Must end with `_pct` | `bonus_target_pct`, `tax_rate_pct` | `*_pct` → PERCENTAGE category |
| **Dates** | Must end with `_date` | `hire_date`, `due_date` | `*_date` → DATE category |
| **Timestamps** | Must end with `_ts` | `created_ts`, `updated_ts` | `*_ts` → TIMESTAMP category |

**Benefits:**
- ✅ Enables automatic field category detection in frontend
- ✅ Reduces frontend code by 70% (using `generateColumns()`)
- ✅ Ensures consistent rendering (currency format, date format, badges, etc.)
- ✅ Self-documenting schema (column name tells you everything)
- ✅ Prevents developer errors (wrong renderer, wrong alignment, etc.)

---

## 1. BOOLEAN COLUMNS → *_flag

### Files Affected
- `15_d_role.ddl` (13 columns)
- `16_d_position.ddl` (4 columns)
- `23_d_form_head.ddl` (1 column)
- `25_d_wiki.ddl` (1 column)

### Transformation Mapping

| Current Column | New Column | File | Impact | Auto-Detection |
|----------------|------------|------|--------|----------------|
| `is_system_role` | `system_role_flag` | 15_d_role.ddl | DDL + 10+ inserts | ✅ `*_flag` → BOOLEAN |
| `is_management_role` | `management_role_flag` | 15_d_role.ddl | DDL + 10+ inserts | ✅ `*_flag` → BOOLEAN |
| `is_client_facing` | `client_facing_flag` | 15_d_role.ddl | DDL + 10+ inserts | ✅ `*_flag` → BOOLEAN |
| `is_safety_critical` | `safety_critical_flag` | 15_d_role.ddl | DDL + 10+ inserts | ✅ `*_flag` → BOOLEAN |
| `requires_background_check` | `background_check_required_flag` | 15_d_role.ddl | DDL + 10+ inserts | ✅ `*_flag` → BOOLEAN |
| `requires_bonding` | `bonding_required_flag` | 15_d_role.ddl | DDL + 10+ inserts | ✅ `*_flag` → BOOLEAN |
| `requires_licensing` | `licensing_required_flag` | 15_d_role.ddl | DDL + 10+ inserts | ✅ `*_flag` → BOOLEAN |
| `equity_eligible` | `equity_eligible_flag` | 16_d_position.ddl | DDL + 8 inserts | ✅ `*_flag` → BOOLEAN |
| `remote_eligible` | `remote_eligible_flag` | 16_d_position.ddl | DDL + 8 inserts | ✅ `*_flag` → BOOLEAN |
| `is_leaf_level` | `leaf_level_flag` | 16_d_position.ddl | DDL + 8 inserts | ✅ `*_flag` → BOOLEAN |
| `is_root_level` | `root_level_flag` | 16_d_position.ddl | DDL + 8 inserts | ✅ `*_flag` → BOOLEAN |
| `is_management` | `management_flag` | 16_d_position.ddl | DDL + 8 inserts | ✅ `*_flag` → BOOLEAN |
| `is_executive` | `executive_flag` | 16_d_position.ddl | DDL + 8 inserts | ✅ `*_flag` → BOOLEAN |
| `is_latest_version` | `latest_version_flag` | 23_d_form_head.ddl | DDL only | ✅ `*_flag` → BOOLEAN |
| `is_public` | `public_flag` | 25_d_wiki.ddl | DDL only | ✅ `*_flag` → BOOLEAN |

**Total:** 15 columns × ~80 data insert statements = **~1200 column references**

**Frontend Impact:**
✅ Field category registry will auto-detect `*_flag` and render as ✓/✗ with center alignment

---

## 2. DATALABEL COLUMNS → dl__* (remove _name)

### Files Affected
- `14_d_cust.ddl` (4 columns)
- `12_d_office.ddl` (1 column)
- `13_d_business.ddl` (1 column)
- `16_d_position.ddl` (1 column)
- `18_d_project.ddl` (1 column)
- `19_d_task.ddl` (2 columns)
- `25_d_wiki.ddl` (1 column)

### Transformation Mapping

| Current Column | New Column | File | Setting Category | Auto-Detection |
|----------------|------------|------|------------------|----------------|
| **Customer Datalabels** |||||
| `opportunity_funnel_stage_name` | `dl__opportunity_funnel_stage` | 14_d_cust.ddl | `opportunity_funnel_stage` | ✅ `dl__*` → LABEL |
| `industry_sector_name` | `dl__industry_sector` | 14_d_cust.ddl | `industry_sector` | ✅ `dl__*` → LABEL |
| `acquisition_channel_name` | `dl__acquisition_channel` | 14_d_cust.ddl | `acquisition_channel` | ✅ `dl__*` → LABEL |
| `customer_tier_name` | `dl__customer_tier` | 14_d_cust.ddl | `customer_tier` | ✅ `dl__*` → LABEL |
| **Hierarchy Level Datalabels** |||||
| `level_name` (in d_office) | `dl__office_level` | 12_d_office.ddl | `office_level` | ✅ `dl__*_level` → LABEL |
| `level_name` (in d_business) | `dl__business_level` | 13_d_business.ddl | `business_level` | ✅ `dl__*_level` → LABEL |
| `level_name` (in d_position) | `dl__position_level` | 16_d_position.ddl | `position_level` | ✅ `dl__*_level` → LABEL |
| **Project/Task Datalabels** |||||
| `project_stage` | `dl__project_stage` | 18_d_project.ddl | `project_stage` | ✅ `dl__*_stage` → LABEL |
| `stage` (in d_task) | `dl__task_stage` | 19_d_task.ddl | `task_stage` | ✅ `dl__*_stage` → LABEL |
| `priority_level` (in d_task) | `dl__task_priority` | 19_d_task.ddl | `task_priority` | ✅ `dl__*_priority` → LABEL |
| **Wiki Datalabels** |||||
| `publication_status` | `dl__wiki_publication_status` | 25_d_wiki.ddl | `wiki_publication_status` | ✅ `dl__*_status` → LABEL |

**Note on level_name:**
`level_name` appears in 3 tables but represents DIFFERENT datalabel categories:
- In `d_office` → References `setting_datalabel_office_level`
- In `d_business` → References `setting_datalabel_business_level`
- In `d_position` → References `setting_datalabel_position_level`

Must be renamed contextually to avoid ambiguity.

**Note on wiki_type and form_type:**
These are NOT datalabel columns (they're hardcoded enums, not loaded from settings). Keep as-is.

**Total:** 11 columns × ~200 total references (DDL + semantics + data + queries)

**Frontend Impact:**
✅ Field category registry will auto-detect `dl__*` pattern and:
- Render as colored badge
- Load options from settings API: `/api/v1/setting?category={extracted_from_column_name}`
- Enable inline dropdown editing

---

## 3. QUANTITY COLUMNS → *_qty

### Files Affected
- `fact_inventory.ddl` (3 columns)
- `fact_order.ddl` (1 column)
- `fact_invoice.ddl` (1 column)
- `fact_shipment.ddl` (1 column)

### Transformation Mapping

| Current Column | New Column | File | Notes | Auto-Detection |
|----------------|------------|------|-------|----------------|
| `on_hand_quantity` | `on_hand_qty` | fact_inventory.ddl | Inventory tracking | ✅ `*_qty` → NUMBER |
| `quantity_after` | `qty_after` | fact_inventory.ddl | Transaction result | ✅ `*_qty` → NUMBER |
| `reorder_quantity` | `reorder_qty` | fact_inventory.ddl | Reorder threshold | ✅ `*_qty` → NUMBER |
| `quantity_ordered` | `qty_ordered` | fact_order.ddl | Order line item | ✅ `*_qty` → NUMBER |
| `quantity_billed` | `qty_billed` | fact_invoice.ddl | Invoice line item | ✅ `*_qty` → NUMBER |
| `quantity_shipped` | `qty_shipped` | fact_shipment.ddl | Shipment line item | ✅ `*_qty` → NUMBER |

**Exclusions (keep as-is):**
- `cust_number` - Customer identifier, not quantity
- `employee_number` - Employee identifier, not quantity
- `phone_number` - Phone, not quantity
- `invoice_line_number` - Line sequence, not quantity
- `order_line_number` - Line sequence, not quantity
- `word_count` - Keep as-is (metadata field, not business quantity)

**Total:** 6 columns × ~150 references (DDL + inserts + triggers)

**Frontend Impact:**
✅ Field category registry will auto-detect `*_qty` and render as right-aligned number

---

## 4. MONEY COLUMNS → *_amt (verify consistency)

### Status
✅ **ALREADY STANDARDIZED** - All money columns already use `_amt` suffix

### Verify These Edge Cases

| Current Pattern | Should Be | File | Action |
|-----------------|-----------|------|--------|
| `v_unit_price` (variable) | `unit_price_amt` | fact_* trigger functions | Rename variables |
| `v_unit_cost` (variable) | `unit_cost_amt` | fact_* trigger functions | Rename variables |

**Action Required:** Verify all money columns in DDL files end with `_amt`, rename any variables in PL/pgSQL functions

**Frontend Impact:**
✅ Already working - `*_amt` pattern auto-detected as AMOUNT category with currency formatting

---

## 5. PERCENTAGE COLUMNS → *_pct (verify consistency)

### Files Affected
- Various (low priority)

### Transformation Mapping

| Current Column | New Column | File | Notes | Auto-Detection |
|----------------|------------|------|-------|----------------|
| `data_completeness_percent` | `data_completeness_pct` | (find file) | Reporting metric | ✅ `*_pct` → PERCENTAGE |
| `bonus_target_pct` | N/A - Already standardized | 16_d_position.ddl | ✅ Correct | ✅ `*_pct` → PERCENTAGE |

**Note on exchange_rate:**
`exchange_rate numeric(10,6)` is NOT a percentage - it's a decimal multiplier (e.g., 1.25 = CAD to USD conversion).
**Action:** Keep as-is, do NOT rename to `exchange_rate_pct`

**Total:** 1 column (low impact)

**Frontend Impact:**
✅ Field category registry will auto-detect `*_pct` and render as percentage with % suffix

---

## 6. DATE COLUMNS (verify consistency)

### Status
✅ **ALREADY STANDARDIZED** - All date columns use `_date` suffix

### Patterns Confirmed
- `hire_date`, `birth_date`, `start_date`, `end_date` ✅
- `due_date`, `invoice_date`, `order_date` ✅
- `shipped_date`, `estimated_delivery_date`, `actual_delivery_date` ✅

**Action Required:** No changes needed - verify all `date` type columns end with `_date`

**Frontend Impact:**
✅ Already working - `*_date` pattern auto-detected as DATE category with friendly formatting

---

## 7. TIMESTAMP COLUMNS (verify consistency)

### Status
✅ **ALREADY STANDARDIZED** - All timestamp columns use `_ts` suffix

### Patterns Confirmed
- `created_ts`, `updated_ts`, `from_ts`, `to_ts` ✅
- `last_login_ts`, `approved_ts`, `published_ts` ✅
- `expires_ts`, `granted_ts` ✅

### Minor Cleanup

| Current Pattern | Should Be | File | Action |
|-----------------|-----------|------|--------|
| `execution_timestamp` | `execution_ts` | (find file) | Rename for consistency |

**Total:** 1 column (low impact)

**Frontend Impact:**
✅ Already working - `*_ts` pattern auto-detected as TIMESTAMP category with relative time ("3 mins ago")

---

## 8. REMOVE TAGS AND SLUG COLUMNS

### Files Affected
ALL 13 core entity DDL files

### Transformation Mapping

| Current Column | Action | File | Impact |
|----------------|--------|------|--------|
| `slug varchar(255)` | DELETE | All d_* tables | DDL only (no data dependencies) |
| `tags jsonb DEFAULT '[]'::jsonb` | DELETE | All d_* tables | DDL only (no data dependencies) |

### Affected Tables

| Table | Columns to Remove | Data Impact |
|-------|------------------|-------------|
| `d_project` | slug, tags | None (no data uses these) |
| `d_task` | slug, tags | None |
| `d_office` | slug, tags | None |
| `d_business` | slug, tags | None |
| `d_employee` | slug, tags | None |
| `d_cust` | slug, tags | None |
| `d_role` | slug, tags | None |
| `d_position` | slug, tags | None |
| `d_worksite` | slug, tags | None |
| `d_form_head` | slug, tags | None |
| `d_wiki` | slug, tags | None |
| `d_artifact` | slug, tags | None |
| `d_reports` | slug, tags | None |

**Total:** 26 column deletions (2 per table × 13 tables)

**Frontend Impact:**
- Remove any references to `tags` field in entityConfig.ts
- Remove any tag-related UI components (if any)
- No impact on field category auto-detection

**Backend Impact:**
- Remove `slug` and `tags` from INSERT statements (if any)
- Remove from API response models (if included)

**Rationale:**
- Simplify data model
- `slug` not actively used in current routing/URL structure
- `tags` functionality can be replaced with dedicated tagging system if needed later
- Reduces standard column overhead from 14 to 12 columns

---

## Migration Impact Analysis

### Database Objects Affected

| Object Type | Count | Examples |
|-------------|-------|----------|
| **Tables** | 12 | d_role, d_position, d_cust, d_office, d_business, d_project, d_task, d_wiki, fact_* tables |
| **Columns** | ~40 | Boolean (15), Datalabel (11), Quantity (6), Percentage (1), Other (7) |
| **INSERT Statements** | ~200+ | All curated data rows |
| **Semantics Documentation** | ~500+ lines | Comments, examples, business rules |
| **API Endpoints** | ~15 | Routes accepting/returning renamed columns |
| **Frontend Components** | ~20 | EntityConfig, field definitions, forms |

### Critical Files Requiring Changes

#### Backend (Database)
1. ✅ `15_d_role.ddl` - 13 boolean columns, ~10 data inserts
2. ✅ `16_d_position.ddl` - 7 boolean columns + 1 datalabel, ~8 data inserts
3. ✅ `14_d_cust.ddl` - 4 datalabel columns, ~5 data inserts
4. ✅ `12_d_office.ddl` - 1 datalabel column, ~5 data inserts
5. ✅ `13_d_business.ddl` - 1 datalabel column, ~7 data inserts
6. ✅ `18_d_project.ddl` - 1 datalabel column, ~5 data inserts
7. ✅ `19_d_task.ddl` - 2 datalabel columns, ~10 data inserts
8. ✅ `25_d_wiki.ddl` - 2 columns (1 boolean + 1 datalabel), ~3 data inserts
9. ✅ `23_d_form_head.ddl` - 1 boolean column
10. ✅ `fact_inventory.ddl` - 3 quantity columns
11. ✅ `fact_order.ddl` - 1 quantity column
12. ✅ `fact_invoice.ddl` - 1 quantity column
13. ✅ `fact_shipment.ddl` - 1 quantity column

#### Frontend (Apps)
1. ✅ `apps/web/src/lib/entityConfig.ts` - Field definitions (35 field references)
2. ✅ `apps/web/src/lib/fieldCategoryRegistry.ts` - Update detection patterns if needed
3. ✅ API integration code for renamed columns

---

## Execution Plan

### Phase 1: Preparation ✅
- ✅ Complete column inventory
- ✅ Create transformation mapping
- ⏳ **Review and approve mapping** ← YOU ARE HERE
- ⏳ Backup database

### Phase 2: DDL File Updates
For each affected DDL file:
1. Update table definitions (CREATE TABLE statements)
2. Update data curation (INSERT statements)
3. Update semantics documentation (comments)
4. Update example queries
5. Update trigger definitions (if any)

### Phase 3: Frontend Updates
1. Update `entityConfig.ts` field definitions
2. Update `fieldCategoryRegistry.ts` detection patterns (if needed)
3. Update form schemas
4. Update API call payloads
5. Search for hardcoded column references

### Phase 4: Testing & Deployment
1. Run `./tools/db-import.sh --dry-run` - verify syntax
2. Run `./tools/db-import.sh` - import database
3. Test all entity CRUD operations (create, read, update, delete)
4. Verify field category auto-detection works correctly
5. Run frontend build - verify no TypeScript errors
6. Manual UAT testing on all affected pages

---

## Risk Assessment

### HIGH RISK
- ❗ **Breaking change** - requires full database rebuild
- ❗ All existing data must be recreated
- ❗ API contracts change - frontend must be updated simultaneously

### MEDIUM RISK
- ⚠️ ~200+ INSERT statements must be updated
- ⚠️ Semantics documentation must stay in sync
- ⚠️ Field category auto-detection patterns must be verified

### LOW RISK
- ℹ️ TypeScript will catch most frontend errors at compile time
- ℹ️ DDL syntax errors will be caught by db-import.sh
- ℹ️ Isolated development environment (no production impact yet)

---

## Rollback Plan

If migration fails:
1. **Git revert** - Revert all commits (DDL files + frontend code)
2. **Re-import** - Run `./tools/db-import.sh` with reverted DDL files
3. **Rebuild frontend** - Run `npm run build` to restore old column names

---

## Approval Checklist

**Before proceeding to Phase 2, confirm:**
- [ ] Transformation mappings are correct
- [ ] All affected files have been identified
- [ ] Backup strategy is in place (Git commits are backup)
- [ ] Timeline for migration is acceptable
- [ ] Team is aware of breaking changes
- [ ] Frontend team ready to update entityConfig.ts simultaneously

---

## Next Steps

**Upon approval:**
1. Create automated sed/awk scripts for bulk find-replace
2. Execute Phase 2 (DDL file updates)
3. Execute Phase 3 (Frontend updates)
4. Execute Phase 4 (Testing & Deployment)

**Estimated Time:**
- Phase 2: 3-4 hours (automated scripts + manual verification)
- Phase 3: 2 hours (frontend updates)
- Phase 4: 2 hours (testing)
- **Total:** ~7-8 hours

---

**Document Status:** READY FOR REVIEW
**Next Action:** Await approval to proceed with automated migration scripts
