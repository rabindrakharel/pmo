# Settings & Data Labels

> Dynamic dropdown system with runtime configuration - no code deployment required for new dropdowns

[![Version](https://img.shields.io/badge/version-4.0-blue.svg)](https://github.com/yourusername/pmo)
[![Status](https://img.shields.io/badge/status-production-success.svg)](http://localhost:5173)

**Related:** [SettingsDataTable](./settings_datatable.md) • [EntityDataTable](./entity_datatable.md) • [Overview](./data_table.md)

**v4.0:** Runtime datalabel creation • Entity validation • Icon picker • Auto-navigation • Empty metadata support

---

## Quick Reference

| Component | Route | API | Purpose |
|-----------|-------|-----|---------|
| **Settings Overview** | `/setting/overview` | `GET /api/v1/setting/categories` | List all datalabels |
| **Settings Detail** | `/setting/:category` | `GET /api/v1/setting?datalabel=dl__*` | Manage datalabel items |
| **Add Datalabel Modal** | Modal component | `POST /api/v1/setting/category` | Create new datalabel |

**Key Concepts:** Unified table (`setting_datalabel`) • JSONB metadata • `dl__` prefix • Position-based IDs

---

## Core Architecture

### Database Schema

```sql
CREATE TABLE app.setting_datalabel (
    datalabel_name VARCHAR(100) PRIMARY KEY,  -- dl__{entity}_{label}
    ui_label VARCHAR(100) NOT NULL,
    ui_icon VARCHAR(50),
    metadata JSONB NOT NULL,                  -- [{id, name, descr, parent_id, color_code}]
    updated_ts TIMESTAMPTZ DEFAULT now()
);
```

**Naming:** `dl__{entity}_{label}` (e.g., `dl__task_stage`, `dl__employee_employment_type`)

### Key Features

| Feature | Description |
|---------|-------------|
| **Runtime Creation** | Create new datalabels without code deployment |
| **Entity Validation** | Only entities from `entity` can have datalabels |
| **Sequential Workflows** | `parent_id` enables stage progression visualization |
| **Inline Editing** | Fields with `loadOptionsFromSettings` auto-become dropdowns |
| **Position-Based IDs** | Item ID = array position (reassigned after mutations) |
| **Color Badges** | Visual indicators with 10 predefined colors |

---

## Flow Diagram

```
Settings Overview (/setting/overview)
    │
    ├─→ [+ Create Datalabel]
    │       └─→ AddDatalabelModal → POST /api/v1/setting/category
    │           └─→ Auto-navigate to /setting/{camelCase}
    │
    └─→ [Click Datalabel] → SettingDetailPage
            └─→ SettingsDataTable (CRUD operations)
                ├─→ Add Row (temp_* ID)
                ├─→ Inline Edit
                ├─→ Color Picker
                ├─→ Drag Reorder
                └─→ Delete Row
```

---

## API Endpoints

### Datalabel Management

| Method | Endpoint | Request Body | Response |
|--------|----------|--------------|----------|
| **GET** | `/api/v1/setting/categories` | - | `[{datalabel_name, ui_label, ui_icon, item_count}]` |
| **GET** | `/api/v1/setting?datalabel=dl__*` | - | `{data: [{id, name, descr, parent_id, color_code}], datalabel}` |
| **POST** | `/api/v1/setting/category` | `{entity_code, label_name, ui_label, ui_icon}` | `{success, data: {datalabel_name}}` |
| **POST** | `/api/v1/setting/:datalabel` | `{name, descr, color_code, parent_id?}` | `{success, data: {id, ...}}` |
| **PUT** | `/api/v1/setting/:datalabel/:id` | `{name?, descr?, color_code?, parent_id?}` | `{success, data: {...}}` |
| **PUT** | `/api/v1/setting/:datalabel/reorder` | `{order: [{id, position}]}` | `{success, message}` |
| **DELETE** | `/api/v1/setting/:datalabel/:id` | - | `{success, message}` (IDs reassigned) |

### Entity Management

| Method | Endpoint | Purpose |
|--------|----------|---------|
| **GET** | `/api/v1/entity/types` | List all entities from `entity` |
| **GET** | `/api/v1/entity/type/:type` | Get entity with child relationships |
| **PUT** | `/api/v1/entity/:id` | Update entity metadata |

---

## User Workflows

### Create New Datalabel

**Example:** HR needs "Employment Types" for Employee entity

```
1. /setting/overview → Click "+ Create Datalabel"
2. Select Entity: "Employee" (from entity table)
3. Enter Label: "employment_type" (auto snake_case)
4. Display Name: "Employment Types"
5. Choose Icon: "Users" (visual picker with search)
6. Click "Create" → POST /api/v1/setting/category
7. Auto-navigate to /setting/employeeEmploymentType
8. Empty SettingsDataTable loads (ready for data)
```

**Result:** `dl__employee_employment_type` created with `metadata: []`

### Add & Manage Items

```
1. Click "Add Row" → temp_* ID
2. Enter: Name, Description, Color (picker), Parent ID
3. Click Save → POST /api/v1/setting/dl__*
4. Server assigns ID (position in array)
5. Inline edit any field → PUT /api/v1/setting/dl__*/:id
6. Drag to reorder → PUT /api/v1/setting/dl__*/reorder
7. Delete row → DELETE (IDs reassigned)
```

### Use in Entity Forms

```typescript
// apps/web/src/lib/entityConfig.ts
employee: {
  columns: [
    {
      key: 'employment_type',
      title: 'Employment Type',
      loadOptionsFromSettings: 'dl__employee_employment_type'  // Auto-loads dropdown
    }
  ]
}
```

**Result:** Dropdown with color badges, inline editing, no code deployment needed

---

## Implementation Guide

### Adding New Icons

**3-Step Process:**

```typescript
// 1. apps/web/src/lib/iconMapping.ts
import { YourIcon } from 'lucide-react';
export const iconMap = { ...existing, YourIcon: YourIcon };

// 2. AddDatalabelModal.tsx
const AVAILABLE_ICON_NAMES = [...existing, 'YourIcon'].sort();

// 3. Test rendering
const Icon = getIconComponent('YourIcon');
```

### URL Conversion

```typescript
// Database: dl__product_category
// URL: /setting/productCategory (camelCase)
// API: /api/v1/setting?datalabel=dl__product_category (with prefix)

function toCamelCase(datalabel: string): string {
  const parts = datalabel.replace(/^dl__/, '').split('_');
  return parts[0] + parts.slice(1).map(p => p[0].toUpperCase() + p.slice(1)).join('');
}
```

### Empty Metadata Handling

```typescript
// ✅ Correct: Return [] for new datalabels
const exists = await db.execute(sql`SELECT datalabel_name FROM setting_datalabel WHERE ...`);
if (exists.length === 0) return 404;  // Datalabel doesn't exist

const items = await db.execute(sql`...jsonb_array_elements...`);
return { data: items, datalabel };  // items may be []

// ❌ Wrong: Return 404 when metadata is empty
```

---

## Critical Considerations

### Position-Based IDs (⚠️ CRITICAL)

**IDs are NOT permanent** - they equal array position and reassign after mutations:

```typescript
// Before delete: [0: A, 1: B, 2: C]
deleteItem(1);  // Delete B
// After delete: [0: A, 1: C]  ← C's ID changed from 2 to 1!

// ✅ ALWAYS refetch after mutations
await deleteItem(1);
const fresh = await fetchItems();  // IDs may have changed
setData(fresh);

// ❌ NEVER cache IDs across mutations
const id = 2;
await deleteItem(1);
await updateItem(id, {...});  // WRONG - ID 2 may not exist!
```

### Naming Rules

| Component | Format | Example | Validation |
|-----------|--------|---------|------------|
| **entity_code** | lowercase, underscores | `employee`, `task` | Must exist in `entity.code` |
| **label_name** | snake_case | `employment_type` | Lowercase, underscores only |
| **datalabel_name** | `dl__{entity}_{label}` | `dl__employee_employment_type` | Auto-generated by backend |
| **URL param** | camelCase | `employeeEmploymentType` | Converted for routing |

### DRY Patterns

| Pattern | Implementation | Benefit |
|---------|---------------|---------|
| **SSOT** | One table (`setting_datalabel`) replaces 17+ tables | No migrations for new datalabels |
| **Entity Validation** | Only entities from `entity` can have datalabels | Prevents orphaned datalabels |
| **Auto-Navigation** | Redirect to data table after creation | Zero extra clicks |
| **Empty Metadata** | Return `[]` for new datalabels, not 404 | Consistent API behavior |
| **Icon Picker** | Curated visual grid with search | Prevents typos |
| **Prefix Preservation** | `dl__` throughout stack, camelCase in URLs | Clear identification |
| **Temporary IDs** | New rows use `temp_{timestamp}` until saved | Optimistic updates |
| **Metadata Refresh** | Refetch after mutations | Server truth |

---

## Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **SettingsOverviewPage** | `apps/web/src/pages/setting/SettingsOverviewPage.tsx` | List all datalabels, create new |
| **SettingDetailPage** | `apps/web/src/pages/setting/SettingDetailPage.tsx` | Load config, manage items |
| **AddDatalabelModal** | `apps/web/src/components/settings/AddDatalabelModal.tsx` | Creation form with validation |
| **SettingsDataTable** | `apps/web/src/components/shared/ui/SettingsDataTable.tsx` | CRUD operations, inline editing |

---

## Testing

```bash
# 1. Create datalabel
curl -X POST http://localhost:4000/api/v1/setting/category \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"entity_code":"test","label_name":"status","ui_label":"Test Status","ui_icon":"Tag"}'

# 2. Verify empty metadata
curl "http://localhost:4000/api/v1/setting?datalabel=dl__test_status" \
  -H "Authorization: Bearer $TOKEN"
# Expected: { data: [], datalabel: "dl__test_status" }

# 3. Add item
curl -X POST http://localhost:4000/api/v1/setting/dl__test_status \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Active","descr":"Active status","color_code":"green"}'

# 4. Update item
curl -X PUT http://localhost:4000/api/v1/setting/dl__test_status/0 \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"color_code":"blue"}'

# 5. Add second item
curl -X POST http://localhost:4000/api/v1/setting/dl__test_status \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Inactive","descr":"Inactive status","color_code":"gray"}'

# 6. Reorder
curl -X PUT http://localhost:4000/api/v1/setting/dl__test_status/reorder \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"order":[{"id":1,"position":0},{"id":0,"position":1}]}'

# 7. Delete
curl -X DELETE http://localhost:4000/api/v1/setting/dl__test_status/0 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Available Colors

**Predefined in `apps/web/src/lib/settingsConfig.ts:141-154`:**

`gray` • `blue` • `green` • `yellow` • `red` • `purple` • `pink` • `indigo` • `cyan` • `orange`

---

## Quick Tips

### ✅ DO

- Refetch data after every mutation (delete, reorder)
- Use `loadOptionsFromSettings` in entity config for auto-dropdowns
- Add icons to both `iconMapping.ts` AND `AVAILABLE_ICON_NAMES`
- Return `[]` for new datalabels (not 404)
- Keep `dl__` prefix in API calls, use camelCase in URLs
- Validate entity exists in `entity` before creating datalabel

### ❌ DON'T

- Cache IDs across mutations (they change!)
- Return 404 for empty metadata
- Use kebab-case or camelCase in datalabel names
- Skip icon registration in both files
- Create datalabels for non-existent entities
- Forget to handle temp_* IDs in save logic

---

## Architecture Notes

### Entity Relationships

**entity table** stores:
- Entity code (e.g., `task`, `project`)
- UI metadata (label, icon, display order)
- Child entity relationships (JSONB array)

**setting_datalabel table** stores:
- Datalabel name (`dl__{entity}_{label}`)
- UI metadata (label, icon)
- Label items (JSONB array with metadata)

### URL Routing

```
/setting/overview → SettingsOverviewPage (list all datalabels)
/setting/taskStage → SettingDetailPage (dl__task_stage)
/setting/productCategory → SettingDetailPage (dl__product_category)
/setting/employeeEmploymentType → SettingDetailPage (dl__employee_employment_type)
```

### Authentication

All settings API routes require JWT authentication via `fastify.authenticate` middleware.

---

**Version:** 4.0
**Last Updated:** 2025-10-31
**Status:** Production-Ready

**Previous Versions:**
- v3.2: Entity registry management, centralized icon system
- v3.1: Child entity relationships, linkage mapping
- v3.0: Unified settings table with JSONB metadata
