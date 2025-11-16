# RBAC DDL Data Curation Fix Summary

## Problem

The Access Control modal in Settings was showing **0 RBAC permissions** despite the DDL file (`06_d_entity_rbac.ddl`) containing comprehensive INSERT statements for seed data.

### Root Cause

**Dependency Order Issue**: The RBAC DDL file was being executed **before** the tables it referenced:

```
Line 234: ✅ 06_d_entity_rbac.ddl executes
          ↓ (INSERT statements reference d_role and d_employee)
          ↓ (but these tables don't exist yet!)
          ❌ INSERT returns 0 rows

Line 238: ✅ 05_employee.ddl executes (creates d_employee table)
Line 242: ✅ 09_role.ddl executes (creates d_role table)
```

The INSERT statements in `06_d_entity_rbac.ddl` used:
```sql
SELECT ... FROM app.d_role r WHERE r.role_code = 'CEO'
SELECT ... FROM app.d_employee e WHERE e.email = 'james.miller@huronhome.ca'
```

Since these tables didn't exist yet, the SELECT returned 0 rows → INSERT 0 rows.

---

## Solution

**Separated Table Creation from Data Curation**

### Changes Made

#### 1. Created New Seed Data File: `db/49_rbac_seed_data.ddl`
- **Purpose**: RBAC permission seed data (runs AFTER all entity tables)
- **Location**: `/home/rabin/projects/pmo/db/49_rbac_seed_data.ddl`
- **Execution Order**: File #49 (last file in import sequence)
- **Content**: All INSERT statements for RBAC permissions
- **Records Inserted**: ~104 RBAC permissions
  - 98 role-based permissions
  - 6 employee-specific permissions

#### 2. Updated Original DDL: `db/entity_configuration_settings/06_d_entity_rbac.ddl`
- **Removed**: All INSERT statements (lines 112-220)
- **Kept**: Table creation, indexes, comments
- **Added**: Documentation noting seed data moved to `49_rbac_seed_data.ddl`

#### 3. Updated Import Script: `tools/db-import.sh`
- **Added**: `49_rbac_seed_data.ddl` to business_entity_files array (line 175)
- **Added**: Execution at line 309 (after all entity tables)
- **Updated**: File count from 54 → 55 DDL files
- **Updated**: Business entities count from 44 → 45 files

---

## Verification Results

### Database Import Output
```bash
✅ 06: RBAC permission mapping
🌱 RBAC Seed Data...
✅ 49: RBAC permission seed data (roles & employees)
✅ All 55 DDL files imported successfully in flat structure!
RBAC permissions: 104 ✅ (was 0 before)
```

### API Verification
```bash
$ ./tools/test-api.sh GET "/api/v1/rbac?limit=5"
Response (HTTP 200):
{
  "data": [...],
  "total": 104 ✅
}
```

### Database Summary
```sql
SELECT person_entity_name, COUNT(*) FROM d_entity_rbac GROUP BY person_entity_name;

 person_entity_name | count
--------------------+-------
 employee           |     6  ← James Miller (CEO) direct permissions
 role               |    98  ← CEO, Manager, Supervisor, Technician roles
```

---

## Seed Data Breakdown

### Role-Based Permissions (98 records)

**CEO Role** (24 entities × 1 role = 24 records)
- Permission Level: **5 (Owner)** on all entities
- Entities: office, business, project, task, worksite, cust, role, artifact, wiki, form, reports, employee, expense, revenue, service, product, quote, work_order, order, invoice, shipment, inventory, interaction, message_schema

**Manager Roles** (DEPT-MGR, MGR-LAND, MGR-SNOW, MGR-HVAC, MGR-PLUMB, MGR-SOLAR)
- **Level 4 (Create)**: project, task
- **Level 2 (Share)**: worksite, cust, artifact, wiki, form, reports
- **Level 1 (Edit)**: employee

**Supervisor Roles** (SUP-FIELD, TECH-SR)
- **Level 4 (Create)**: task
- **Level 2 (Share)**: worksite, cust, artifact, form
- **Level 1 (Edit)**: reports

**Technician Roles** (TECH-FIELD)
- **Level 1 (Edit)**: task, worksite, form, reports
- **Level 0 (View)**: cust

**Admin Roles** (COORD-PROJ, COORD-HR)
- **Level 4 (Create)**: task
- **Level 2 (Share)**: project, cust, artifact, form, reports

### Employee-Specific Permissions (6 records)

**James Miller (CEO)** - Direct permissions
- **Level 5 (Owner)**: office, business, employee, role, project, task
- Purpose: Ensures CEO has full access regardless of role assignments

---

## Access Control UI Impact

### Before Fix
```
Settings → Access Control → Permission Management
Table: "No data available" (0 records)
API Response: {"data": [], "total": 0}
```

### After Fix
```
Settings → Access Control → Permission Management
Table: Shows 104 permission records
- Employee permissions (6 records)
- Role permissions (98 records)
- Permission levels: 0-5 (View → Owner)
- Entity types: 24 different entities
API Response: {"data": [...], "total": 104}
```

---

## Files Modified

### Created
- ✅ `/home/rabin/projects/pmo/db/49_rbac_seed_data.ddl` (166 lines)

### Modified
- ✅ `/home/rabin/projects/pmo/db/entity_configuration_settings/06_d_entity_rbac.ddl`
  - Removed: INSERT statements (108 lines removed)
  - Added: Documentation comment (8 lines)
  - Net: -100 lines

- ✅ `/home/rabin/projects/pmo/tools/db-import.sh`
  - Added: 49_rbac_seed_data.ddl to file list (line 175)
  - Added: Execution step (line 309)
  - Updated: File counts (3 locations)

---

## Testing Checklist

- [x] RBAC table created successfully
- [x] Role table populated before RBAC seed data
- [x] Employee table populated before RBAC seed data
- [x] RBAC seed data executes without errors
- [x] 104 RBAC records inserted
- [x] API endpoint `/api/v1/rbac` returns data
- [x] Access Control UI displays permission table
- [x] Database import runs cleanly (no errors)
- [x] File count updated to 55 DDL files

---

## Future db-import.sh Runs

**Automatic Seed Data Loading**: Every time `./tools/db-import.sh` runs, the RBAC seed data will be **automatically inserted** after all entity tables are created.

**No Manual Steps Required**: The fix ensures proper dependency order:
1. Create RBAC table (file 06, line 234)
2. Create and populate employee table (file 05, line 238)
3. Create and populate role table (file 09, line 242)
4. Insert RBAC seed data (file 49, line 309) ✅

---

## Summary

**Problem**: RBAC seed data not loading due to dependency order
**Solution**: Separated seed data into file #49 (runs after entity tables)
**Result**: 104 RBAC permissions automatically loaded on every import

**Before**: 0 RBAC records → Access Control UI empty
**After**: 104 RBAC records → Access Control UI fully populated

---

**Fixed**: 2025-11-15
**Files Created**: 1
**Files Modified**: 2
**Import Status**: ✅ Working
**API Status**: ✅ Returning data
**UI Status**: ✅ Displaying permissions
