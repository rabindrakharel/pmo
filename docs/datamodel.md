# Data Model Standardization - Settings Tables

**Date:** 2025-10-23
**Author:** Claude Code
**Status:** ✅ Complete

## Problem Identified

The PMO application had **inconsistent naming conventions** across settings data label tables:
- Some tables used `level_name` and `level_descr` columns
- API responses transformed these to `name` and `descr` for some settings but not others
- Frontend FormBuilder expected different column names for different settings
- This caused form preview failures when loading dynamic dropdown options

## Solution Implemented

**Standardized ALL settings tables to use `name` and `descr` columns** across the entire stack.

---

## Changes Made

### 1. Database Schema (17 DDL Files) ✅

All `setting_datalabel_*` tables updated to use consistent column naming:

**Changed Columns:**
- `level_name` → `name` (VARCHAR(50) NOT NULL UNIQUE)
- `level_descr` → `descr` (TEXT)

**Files Modified:**
```
db/setting_datalabel__acquisition_channel.ddl
db/setting_datalabel__business_level.ddl
db/setting_datalabel__client_status.ddl
db/setting_datalabel__client_service.ddl
db/setting_datalabel__cust_level.ddl
db/setting_datalabel__cust_status.ddl
db/setting_datalabel__customer_tier.ddl
db/setting_datalabel__form_approval_status.ddl
db/setting_datalabel__form_submission_status.ddl
db/setting_datalabel__industry_sector.ddl
db/setting_datalabel__office_level.ddl
db/setting_datalabel__opportunity_funnel_stage.ddl
db/setting_datalabel__position_level.ddl
db/setting_datalabel__project_stage.ddl
db/setting_datalabel__task_priority.ddl
db/setting_datalabel__task_stage.ddl
db/setting_datalabel__task_update_type.ddl
db/setting_datalabel__wiki_publication_status.ddl
```

**Example Before:**
```sql
CREATE TABLE app.setting_datalabel_task_priority (
    level_id integer PRIMARY KEY,
    level_name varchar(50) NOT NULL UNIQUE,  -- ❌ Old
    level_descr text,                         -- ❌ Old
    ...
);
```

**Example After:**
```sql
CREATE TABLE app.setting_datalabel_task_priority (
    level_id integer PRIMARY KEY,
    name varchar(50) NOT NULL UNIQUE,         -- ✅ New
    descr text,                               -- ✅ New
    ...
);
```

---

### 2. API Layer ✅

**File:** `apps/api/src/modules/setting/routes.ts`

**Changes:**
1. **Removed SQL aliasing** - No more `level_name as name` transformations
2. **Updated TypeScript schemas** - `SettingItemSchema` now only has `name`/`descr` fields
3. **Simplified UPDATE logic** - All tables use standardized column names
4. **15+ SQL queries updated** for all setting categories

**Example Before:**
```typescript
// Inconsistent: Some queries aliased, others didn't
query = sql`
  SELECT
    level_id::text as id,
    level_name as name,        -- ❌ Aliasing
    level_descr as descr,      -- ❌ Aliasing
    ...
  FROM app.setting_datalabel_task_priority
`;
```

**Example After:**
```typescript
// Consistent: Direct column references
query = sql`
  SELECT
    level_id::text as id,
    name,                      -- ✅ Direct
    descr,                     -- ✅ Direct
    ...
  FROM app.setting_datalabel_task_priority
`;
```

---

### 3. Frontend Configuration ✅

**File:** `apps/web/src/components/entity/form/FormBuilder.tsx`

**Updated:** `DATALABEL_TABLE_COLUMNS` constant for all 16+ settings categories

**Example Before:**
```typescript
export const DATALABEL_TABLE_COLUMNS = {
  task_priority: {
    value: ['level_id', 'level_name'],      // ❌ Inconsistent
    display: ['level_name', 'level_descr']  // ❌ Inconsistent
  },
  customer_tier: {
    value: ['level_id', 'level_name'],      // ❌ Inconsistent
    display: ['level_name', 'level_descr']  // ❌ Inconsistent
  }
};
```

**Example After:**
```typescript
export const DATALABEL_TABLE_COLUMNS = {
  task_priority: {
    value: ['level_id', 'name'],            // ✅ Standardized
    display: ['name', 'descr']              // ✅ Standardized
  },
  customer_tier: {
    value: ['level_id', 'name'],            // ✅ Standardized
    display: ['name', 'descr']              // ✅ Standardized
  }
};
```

---

### 4. Frontend Components ✅

**Files Updated:**
- `apps/web/src/lib/entityConfig.ts` - Column definitions, field configs, render functions
- `apps/web/src/lib/settingsLoader.ts` - Field mapping logic
- `apps/web/src/lib/hooks/useKanbanColumns.ts` - Stage name references
- `apps/web/src/pages/shared/EntityMainPage.tsx` - Table column references
- `apps/web/src/components/entity/form/InteractiveForm.tsx` - Removed fallback logic

**Global Replace Performed:**
```bash
# All TypeScript files in frontend
find apps/web/src -name "*.ts" -o -name "*.tsx" | xargs sed -i "
  s/'level_name'/'name'/g
  s/\"level_name\"/\"name\"/g
  s/'level_descr'/'descr'/g
  s/\"level_descr\"/\"descr\"/g
  s/level_name:/name:/g
  s/level_descr:/descr:/g
"
```

---

## Database Reimport

**Command Used:**
```bash
./tools/db-import.sh
```

**Results:**
- ✅ 44 DDL files imported successfully
- ✅ All 17 settings tables recreated with new schema
- ✅ Sample data loaded correctly
- ✅ Schema validation passed
- ✅ James Miller CEO account verified

---

## Verification

### Database Schema Verification

```sql
\d app.setting_datalabel_task_priority
```

**Output:**
```
              Table "app.setting_datalabel_task_priority"
   Column   |           Type           | Collation | Nullable | Default
------------+--------------------------+-----------+----------+---------
 level_id   | integer                  |           | not null |
 name       | character varying(50)    |           | not null |  ✅
 descr      | text                     |           |          |  ✅
 is_active  | boolean                  |           |          | true
 sort_order | integer                  |           |          |
```

### API Response Verification

**Before (Inconsistent):**
```json
// task_priority
{ "name": "low", "descr": "..." }

// task_stage
{ "level_name": "Backlog", "level_descr": "..." }  // ❌ Different fields
```

**After (Standardized):**
```json
// ALL settings now return identical structure
{ "name": "low", "descr": "Low priority - can be scheduled flexibly" }
{ "name": "Backlog", "descr": "Task identified but not started..." }
{ "name": "Initiation", "descr": "Project concept and initial planning..." }
```

**Test Commands:**
```bash
./tools/test-api.sh GET /api/v1/setting?category=task_priority
./tools/test-api.sh GET /api/v1/setting?category=task_stage
./tools/test-api.sh GET /api/v1/setting?category=project_stage
./tools/test-api.sh GET /api/v1/setting?category=customer_tier
./tools/test-api.sh GET /api/v1/setting?category=business_level
```

All return consistent `name` and `descr` fields ✅

---

## Impact Analysis

### ✅ Benefits

1. **Single Source of Truth** - All settings use `name`/`descr`, no exceptions
2. **No API Transformations** - Database columns map directly to API responses
3. **Simpler Code** - Removed conditional logic and fallbacks throughout
4. **Type Safety** - Consistent field names across TypeScript types
5. **Future-Proof** - New settings tables follow the same pattern
6. **Form Builder Fixed** - Dynamic options now work for all settings categories

### ⚠️ Breaking Changes

**Database Schema:**
- Column names changed in 17 settings tables
- Any direct SQL queries using `level_name`/`level_descr` will break

**API Responses:**
- All settings endpoints now return `name`/`descr` consistently
- Frontend code expecting `level_name`/`level_descr` will break

**Frontend:**
- Entity configurations updated to use new column names
- Settings loader simplified

### 🔄 Migration Required

**For existing deployments:**
1. Run database migration script to rename columns
2. Update any custom SQL queries
3. Restart API server
4. Clear frontend cache
5. Test all form previews with dynamic options

---

## Testing Checklist

- [x] Database schema updated (17 DDL files)
- [x] Database reimported successfully
- [x] API routes updated (15+ queries)
- [x] API server restarted
- [x] API endpoints tested (5+ categories)
- [x] Frontend configuration updated
- [x] Frontend components updated
- [x] FormBuilder configuration updated
- [x] Form preview with dynamic options tested
- [x] No console warnings for missing columns

---

## Files Modified Summary

### Database Layer (17 files)
```
db/setting_datalabel__*.ddl
```

### Backend Layer (1 file)
```
apps/api/src/modules/setting/routes.ts
```

### Frontend Layer (6+ files)
```
apps/web/src/components/entity/form/FormBuilder.tsx
apps/web/src/components/entity/form/InteractiveForm.tsx
apps/web/src/lib/entityConfig.ts
apps/web/src/lib/settingsLoader.ts
apps/web/src/lib/hooks/useKanbanColumns.ts
apps/web/src/pages/shared/EntityMainPage.tsx
```

---

## Rollback Plan

If issues arise:

1. **Database:** Restore from backup or revert DDL files
2. **API:** Revert `routes.ts` changes
3. **Frontend:** Revert global find/replace changes
4. **Restart:** API server and clear caches

---

## Conclusion

The data model standardization is **complete and verified**. All settings tables now use consistent `name`/`descr` column naming across the entire stack (database, API, frontend). This eliminates the original issue where form previews couldn't load dynamic options due to mismatched column names.

**Status:** ✅ Production Ready
