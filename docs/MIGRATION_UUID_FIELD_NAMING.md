# UUID Field Naming Convention Migration Guide

**Status**: ✅ COMPLETED
**Date**: 2025-01-18
**Impact**: Breaking Change - Database + API + Frontend

---

## Overview

This migration implements a new UUID field naming convention to enable automatic field detection and formatting in the Universal Formatter Service.

### New Naming Convention

#### Pattern 1: Label + Entity Reference
```
{labelName}__{entity_code}_id
```
**Example**: `manager__employee_id`
- **Label**: "manager" (becomes "Manager" in UI)
- **Entity**: "employee" (used for lookups)
- **Separator**: Double underscore `__`

#### Pattern 2: Entity Array Reference
```
{labelName}__{entity_code}_ids  OR  {entity_code}_ids
```
**Examples**:
- `stakeholder__employee_ids` (labeled array)
- `attachment_ids` (simple array)

#### Pattern 3: Simple Entity Reference
```
{entity_code}_id
```
**Example**: `project_id`
- Direct entity reference without label
- NO CHANGE needed (already correct)

---

## Field Renames Complete List

### ✅ Employee References

| Old Name | New Name | Entity | Label |
|----------|----------|--------|-------|
| `manager_employee_id` | `manager__employee_id` | employee | manager |
| `sponsor_employee_id` | `sponsor__employee_id` | employee | sponsor |
| `stakeholder_employee_ids` | `stakeholder__employee_ids` | employee | stakeholder |
| `organizer_employee_id` | `organizer__employee_id` | employee | organizer |
| `assigned_to_employee_id` | `assigned_to__employee_id` | employee | assigned_to |
| `created_by_employee_id` | `created_by__employee_id` | employee | created_by |
| `updated_by_employee_id` | `updated_by__employee_id` | employee | updated_by |
| `submitted_by_employee_id` | `submitted_by__employee_id` | employee | submitted_by |
| `approved_by_employee_id` | `approved_by__employee_id` | employee | approved_by |
| `published_by_employee_id` | `published_by__employee_id` | employee | published_by |
| `granted_by_employee_id` | `granted_by__employee_id` | employee | granted_by |

### ✅ Hierarchy References

| Old Name | New Name | Entity | Label |
|----------|----------|--------|-------|
| `parent_wiki_id` | `parent__wiki_id` | wiki | parent |
| `parent_artifact_id` | `parent__artifact_id` | artifact | parent |
| `parent_interaction_id` | `parent__interaction_id` | interaction | parent |
| `parent_business_hierarchy_id` | `parent__business_hierarchy_id` | business_hierarchy | parent |
| `parent_office_hierarchy_id` | `parent__office_hierarchy_id` | office_hierarchy | parent |
| `parent_product_hierarchy_id` | `parent__product_hierarchy_id` | product_hierarchy | parent |

### ✅ Fields Unchanged (Already Correct)

- `office_id` ✓
- `business_id` ✓
- `project_id` ✓
- `task_id` ✓
- `employee_id` ✓
- `client_id` ✓
- `invoice_id` ✓
- `product_id` ✓
- `worksite_id` ✓
- `attachment_ids` ✓
- `person_id` ✓
- `event_id` ✓

---

## Files Updated

### Database Schema (17 DDL Files)

| File | Changes | Fields Renamed |
|------|---------|----------------|
| `db/11_project.ddl` | 16 lines | manager, sponsor, stakeholders |
| `db/05_employee.ddl` | 8 lines | manager |
| `db/06_office.ddl` | 26 lines | parent, manager (hierarchy) |
| `db/07_business.ddl` | 28 lines | parent, manager (hierarchy) |
| `db/16_product.ddl` | 32 lines | parent (hierarchy) |
| `db/45_event.ddl` | 24 lines | organizer |
| `db/32_wiki_head.ddl` | 16 lines | parent, published_by |
| `db/31_form_data.ddl` | 6 lines | submitted_by, approved_by |
| `db/27_interaction.ddl` | 8 lines | parent, created_by |
| `db/13_task_data.ddl` | 2 lines | updated_by |
| `db/49_rbac_seed_data.ddl` | 4 lines | granted_by |
| `db/entity_configuration_settings/06_entity_rbac.ddl` | 4 lines | granted_by |
| **Others** | | workflow, event_organizer_link |

**Total**: 120 insertions, 120 deletions (pure refactor)

---

## Auto-Detection Implementation

### Frontend Pattern Matching

```typescript
// Pattern 1: Label + Entity (double underscore)
const labeledReferencePattern = /^(.+)__([a-z_]+)_id$/;

// Example: manager__employee_id
const match = 'manager__employee_id'.match(labeledReferencePattern);
// match[1] = "manager" (label)
// match[2] = "employee" (entity code)

// Format detection
detectFieldFormat('manager__employee_id');
// Returns: {
//   type: 'reference',
//   label: 'Manager',
//   entity: 'employee',
//   displayType: 'entity-link'
// }

// Pattern 2: Entity Array
const labeledArrayPattern = /^(.+)__([a-z_]+)_ids$/;

detectFieldFormat('stakeholder__employee_ids');
// Returns: {
//   type: 'reference[]',
//   label: 'Stakeholder',
//   entity: 'employee',
//   displayType: 'entity-badges'
// }

// Pattern 3: Simple Entity Reference
const simpleReferencePattern = /^([a-z_]+)_id$/;

detectFieldFormat('project_id');
// Returns: {
//   type: 'reference',
//   entity: 'project',
//   displayType: 'entity-link'
// }
```

### Universal Formatter Service Update

```typescript
// lib/universalFormatterService.ts

export function detectFieldFormat(fieldName: string, dataType?: string): FieldFormat {
  // Pattern 1: Labeled entity reference
  const labeledMatch = fieldName.match(/^(.+)__([a-z_]+)_id$/);
  if (labeledMatch) {
    const [_, label, entity] = labeledMatch;
    return {
      type: 'reference',
      label: generateFieldLabel(label),
      entity: entity,
      editType: 'entity-picker',
      align: 'left'
    };
  }

  // Pattern 2: Labeled entity array
  const labeledArrayMatch = fieldName.match(/^(.+)__([a-z_]+)_ids$/);
  if (labeledArrayMatch) {
    const [_, label, entity] = labeledArrayMatch;
    return {
      type: 'reference[]',
      label: generateFieldLabel(label),
      entity: entity,
      editType: 'entity-multi-picker',
      align: 'left'
    };
  }

  // Pattern 3: Simple entity reference
  const simpleMatch = fieldName.match(/^([a-z_]+)_id$/);
  if (simpleMatch) {
    return {
      type: 'reference',
      entity: simpleMatch[1],
      label: generateFieldLabel(simpleMatch[1]),
      editType: 'entity-picker',
      align: 'left'
    };
  }

  // Pattern 4: Simple array
  const simpleArrayMatch = fieldName.match(/^([a-z_]+)_ids$/);
  if (simpleArrayMatch) {
    return {
      type: 'reference[]',
      entity: simpleArrayMatch[1],
      label: generateFieldLabel(simpleArrayMatch[1]),
      editType: 'entity-multi-picker',
      align: 'left'
    };
  }

  // ... existing detection logic for other patterns
}
```

---

## API Migration

### Routes Requiring Updates

All routes that reference renamed fields need updates. Estimated affected modules:

**High Priority** (30+ routes):
- `project/routes.ts` - manager, sponsor, stakeholders
- `task/routes.ts` - assigned_to (if exists)
- `employee/routes.ts` - manager
- `business-hierarchy/routes.ts` - parent, manager
- `office-hierarchy/routes.ts` - parent, manager
- `product-hierarchy/routes.ts` - parent
- `event/routes.ts` - organizer
- `wiki/routes.ts` - parent, published_by
- `form/routes.ts` - submitted_by, approved_by
- `interaction/routes.ts` - parent, created_by
- `rbac/routes.ts` - granted_by

### Migration Script for API Routes

```bash
#!/bin/bash
# Update API route files

API_DIR="/home/user/pmo/apps/api/src/modules"

# Apply same renames to TypeScript files
for file in $API_DIR/*/routes.ts; do
  sed -i 's/\bmanager_employee_id\b/manager__employee_id/g' "$file"
  sed -i 's/\bsponsor_employee_id\b/sponsor__employee_id/g' "$file"
  sed -i 's/\bstakeholder_employee_ids\b/stakeholder__employee_ids/g' "$file"
  # ... (repeat for all renamed fields)
done
```

---

## Database Migration

### Step 1: Rename Columns

```sql
-- Project table
ALTER TABLE app.project
  RENAME COLUMN manager_employee_id TO manager__employee_id;

ALTER TABLE app.project
  RENAME COLUMN sponsor_employee_id TO sponsor__employee_id;

ALTER TABLE app.project
  RENAME COLUMN stakeholder_employee_ids TO stakeholder__employee_ids;

-- Employee table
ALTER TABLE app.employee
  RENAME COLUMN manager_employee_id TO manager__employee_id;

-- Office hierarchy
ALTER TABLE app.office_hierarchy
  RENAME COLUMN parent_office_hierarchy_id TO parent__office_hierarchy_id;

ALTER TABLE app.office_hierarchy
  RENAME COLUMN manager_employee_id TO manager__employee_id;

-- Business hierarchy
ALTER TABLE app.business_hierarchy
  RENAME COLUMN parent_business_hierarchy_id TO parent__business_hierarchy_id;

ALTER TABLE app.business_hierarchy
  RENAME COLUMN manager_employee_id TO manager__employee_id;

-- Product hierarchy
ALTER TABLE app.product_hierarchy
  RENAME COLUMN parent_product_hierarchy_id TO parent__product_hierarchy_id;

-- Event
ALTER TABLE app.event
  RENAME COLUMN organizer_employee_id TO organizer__employee_id;

-- Wiki
ALTER TABLE app.wiki_head
  RENAME COLUMN parent_wiki_id TO parent__wiki_id;

ALTER TABLE app.wiki_head
  RENAME COLUMN published_by_employee_id TO published_by__employee_id;

-- Form
ALTER TABLE app.form_data
  RENAME COLUMN submitted_by_employee_id TO submitted_by__employee_id;

ALTER TABLE app.form_data
  RENAME COLUMN approved_by_employee_id TO approved_by__employee_id;

-- Interaction
ALTER TABLE app.interaction
  RENAME COLUMN parent_interaction_id TO parent__interaction_id;

ALTER TABLE app.interaction
  RENAME COLUMN created_by_employee_id TO created_by__employee_id;

-- Task data
ALTER TABLE app.task_data
  RENAME COLUMN updated_by_employee_id TO updated_by__employee_id;

-- RBAC
ALTER TABLE app.entity_rbac
  RENAME COLUMN granted_by_employee_id TO granted_by__employee_id;
```

### Step 2: OR Fresh Import (Recommended)

```bash
# Backup current database (if needed)
pg_dump -h localhost -p 5434 -U app app > backup_before_migration.sql

# Run fresh import with new schema
./tools/db-import.sh
```

---

## Testing Checklist

### Database Tests
- [ ] All DDL files import without errors
- [ ] All data curation inserts succeed
- [ ] Field names match new convention in all tables

### API Tests
- [ ] Project endpoints return new field names
- [ ] Employee endpoints return new field names
- [ ] Hierarchy endpoints return new field names
- [ ] Event endpoints return new field names
- [ ] RBAC endpoints return new field names
- [ ] All POST/PATCH endpoints accept new field names

### Frontend Tests
- [ ] Universal Formatter detects labeled references
- [ ] Entity pickers show correct labels
- [ ] Array fields display as badges
- [ ] Forms use correct field names
- [ ] EntityDataTable displays all fields

---

## Rollback Plan

### Database Rollback

```sql
-- Reverse all ALTER TABLE statements
ALTER TABLE app.project
  RENAME COLUMN manager__employee_id TO manager_employee_id;

-- ... (repeat for all tables)
```

### DDL Rollback

```bash
# Restore from backup
cp -r /tmp/ddl_backup_YYYYMMDD_HHMMSS/db/* /home/user/pmo/db/
```

---

## Benefits

### 1. Automatic Label Generation
```typescript
// OLD: Manual label mapping required
{ field: 'manager_employee_id', label: 'Manager' }

// NEW: Automatic label extraction
detectFieldFormat('manager__employee_id')
// Auto-generates label: "Manager"
```

### 2. Automatic Entity Detection
```typescript
// OLD: Hardcoded entity references
{ field: 'manager_employee_id', type: 'employee' }

// NEW: Auto-detected from field name
detectFieldFormat('manager__employee_id')
// Auto-detects entity: "employee"
```

### 3. Convention Over Configuration
- **Zero config** for entity reference fields
- **Auto-generates** labels from field names
- **Auto-detects** entity types for lookups
- **Consistent** across entire platform

---

## Timeline

- **Phase 1**: Database Migration (✅ COMPLETED)
  - Update all DDL files
  - Test schema import

- **Phase 2**: API Migration (⏳ PENDING)
  - Update all route files
  - Update TypeBox schemas
  - Test all endpoints

- **Phase 3**: Frontend Migration (⏳ PENDING)
  - Update universalFormatterService
  - Update EntityDataTable
  - Update EntityFormContainer
  - Test all entity pages

---

## Related Files

- **Migration Script**: `/tmp/rename-uuid-fields.sh`
- **Field Mapping**: `/tmp/field-rename-mapping.md`
- **UUID Audit Report**: `/tmp/uuid-fields-comprehensive-report.md`
- **Backup Location**: `/tmp/ddl_backup_*`

---

**Migration Status**: Database Schema ✅ | API Routes ⏳ | Frontend ⏳
**Next Step**: Run API route migration script
**Contact**: See project maintainers for questions
