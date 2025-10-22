# Datalabel Settings Table Column Reference

**Verified: 2025-10-22**

This document maps all 17 datalabel settings tables to their actual database columns for use in dynamic form fields.

## Summary of Tables

| Table Name | Value Columns | Display Columns | Notes |
|-----------|---------------|-----------------|-------|
| `cust_service` | level_id, level_name, slug | level_name, slug, level_descr | Has slug field |
| `cust_status` | level_id, level_name | level_name, level_descr | Standard format |
| `cust_level` | id, level_id, level_name, slug | level_name, slug | UUID primary key |
| `customer_tier` | level_id, level_name | level_name, level_descr | Standard format |
| `task_stage` | level_id, level_name | level_name, level_descr | Standard format |
| `task_priority` | level_id, level_name | level_name, level_descr | Standard format |
| `task_update_type` | level_id, level_name | level_name, level_descr | Standard format |
| `project_stage` | level_id, level_name | level_name, level_descr | Standard format |
| `business_level` | level_id, level_name | level_name, level_descr | Standard format |
| `office_level` | level_id, level_name | level_name, level_descr | Standard format |
| `position_level` | id, level_id, level_name, slug | level_name, slug | UUID primary key |
| `opportunity_funnel_stage` | stage_id, stage_name | stage_name, stage_descr | Uses stage_* not level_* |
| `industry_sector` | level_id, level_name | level_name, level_descr | Standard format |
| `acquisition_channel` | level_id, level_name | level_name, level_descr | Standard format |
| `form_submission_status` | level_id, level_name | level_name, level_descr | Standard format |
| `form_approval_status` | level_id, level_name | level_name, level_descr | Standard format |
| `wiki_publication_status` | level_id, level_name | level_name, level_descr | Standard format |

## Important Notes

### Naming Conventions

1. **Customer vs Client**: Database uses `cust_*` prefix, not `client_*`
   - ❌ `client_service` → ✅ `cust_service`
   - ❌ `client_status` → ✅ `cust_status`
   - ❌ `client_level` → ✅ `cust_level`

2. **Column Names**: Two patterns exist
   - **Standard**: `level_id`, `level_name`, `level_descr` (14 tables)
   - **Stage-based**: `stage_id`, `stage_name`, `stage_descr` (only `opportunity_funnel_stage`)

3. **Primary Keys**: Two patterns
   - **Integer**: Most tables use `level_id` or `stage_id` as primary key
   - **UUID**: `cust_level` and `position_level` use UUID `id` column

### API Endpoints

All settings are accessed via:
```
GET /api/v1/setting?category=<table_name>
```

Examples:
- `GET /api/v1/setting?category=project_stage`
- `GET /api/v1/setting?category=cust_service`
- `GET /api/v1/setting?category=opportunity_funnel_stage`

### Common Configuration Patterns

#### Pattern 1: Standard Level-based Table
```json
{
  "datalabelTable": "project_stage",
  "datalabelValueColumn": "level_id",
  "datalabelDisplayColumn": "level_name"
}
```

#### Pattern 2: Stage-based Table (Opportunity Funnel)
```json
{
  "datalabelTable": "opportunity_funnel_stage",
  "datalabelValueColumn": "stage_id",
  "datalabelDisplayColumn": "stage_name"
}
```

#### Pattern 3: Tables with Slug
```json
{
  "datalabelTable": "cust_service",
  "datalabelValueColumn": "slug",
  "datalabelDisplayColumn": "level_name"
}
```

## Verified Sample Data

### project_stage
Returns: `level_id`, `level_name`, `level_descr`
- Initiation (0)
- Planning (1)
- Execution (2)
- Monitoring (3)
- Closure (4)
- On Hold (5)
- Cancelled (6)

### opportunity_funnel_stage
Returns: `stage_id`, `stage_name`, `stage_descr`
- Lead (0)
- Qualified (1)
- Site Visit Scheduled (2)
- Proposal Sent (3)
- Negotiation (4)
- Contract Signed (5)
- Lost (6)
- On Hold (7)

### task_stage
Returns: `level_id`, `level_name`, `level_descr`
- Backlog (0)
- To Do (1)
- In Progress (2)
- In Review (3)
- Blocked (4)
- Done (5)
- Cancelled (6)

## Implementation in Form Builder

The form builder now includes:

1. **Dynamic Column Dropdowns**: Column options automatically adjust based on selected table
2. **Grouped Table Selection**: Tables organized by category (Customer/Client, Task Management, etc.)
3. **Validation Warnings**: Console warnings if configured columns don't exist in response data
4. **Visual Column Reference**: Info box shows available columns for selected table

## Troubleshooting

### Issue: Empty dropdown options
**Solution**: Check that:
1. Table name matches database exactly (e.g., `cust_service` not `client_service`)
2. Value column exists in that table's schema
3. Display column exists in that table's schema

### Issue: Column not found warnings
**Example**: `⚠️ Column 'stage_name' not found in project_stage data`
**Solution**: `project_stage` uses `level_name`, not `stage_name`. Update field configuration.

### Issue: No data returned
**Possible causes**:
1. Settings table has no seed data
2. Table name misspelled in API call
3. Authentication token missing or expired
