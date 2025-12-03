# SettingDetailPage

**Version:** 9.0.0 | **Location:** `apps/web/src/pages/setting/SettingDetailPage.tsx` | **Updated:** 2025-12-03

---

## Overview

SettingDetailPage displays and manages individual datalabel settings. It provides an inline-editable table for managing dropdown options with support for colors, hierarchy, and drag-drop reordering.

**Core Principles:**
- Dynamic routing based on datalabel name
- Inline editing with LabelsDataTable
- DRY backend updates (recompose entire metadata array)
- Hierarchical parent-child options

---

## Page Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SETTINGDETAILPAGE ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Route: /setting/{category}  (e.g., /setting/projectStage)                  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Layout Shell                                                           ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Header: {Icon} {Title}                         [Exit Settings]     │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  LabelsDataTable                                                    │││
│  │  │  ┌───────────────────────────────────────────────────────────────┐ │││
│  │  │  │  ⋮ │ Name      │ Description │ Color   │ Parent │ Actions   │ │││
│  │  │  │────┼───────────┼─────────────┼─────────┼────────┼───────────│ │││
│  │  │  │  ⋮ │ Planning  │ Initial...  │ 🔵 Blue │ -      │ [Edit][X] │ │││
│  │  │  │  ⋮ │ In Review │ Under...    │ 🟡 Amber│ -      │ [Edit][X] │ │││
│  │  │  │  ⋮ │ Active    │ Currently...│ 🟢 Green│ -      │ [Edit][X] │ │││
│  │  │  │  ⋮ │ Complete  │ Finished    │ 🟣 Purple│ -     │ [Edit][X] │ │││
│  │  │  └───────────────────────────────────────────────────────────────┘ │││
│  │  │  [+ Add Option]                                                     │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## URL to Datalabel Mapping

```typescript
// URL param (camelCase) → datalabel (snake_case with dl__ prefix)
// /setting/projectStage → dl__project_stage

function datalabelToCamelCase(datalabelName: string): string {
  const withoutPrefix = datalabelName.replace(/^dl__/, '');
  const parts = withoutPrefix.split('_');
  return parts[0] + parts.slice(1).map(p =>
    p.charAt(0).toUpperCase() + p.slice(1)
  ).join('');
}

// Example mappings:
// dl__project_stage → projectStage
// dl__task_status → taskStatus
// dl__product_product_category → productProductCategory
```

---

## Key Features

### 1. Dynamic Config Loading

```typescript
useEffect(() => {
  async function loadSettingConfig() {
    const categories = await fetchAllCategories();

    // Find datalabel matching URL param
    const found = categories.find((cat: any) => {
      const camelCaseName = datalabelToCamelCase(cat.datalabel_name);
      return camelCaseName === category;
    });

    setConfig({
      datalabel: found.datalabel_name,  // Keep dl__ prefix
      title: found.ui_label || found.datalabel_name,
      icon: found.ui_icon || 'Tag',
    });
  }
}, [category]);
```

### 2. Settings Service Integration

```typescript
import {
  fetchSettingItems,
  updateSettingItemMultiple,
  createSettingItem,
  deleteSettingItem,
  reorderSettingItems,
} from '../../services/settingsService';

// Fetch items for this datalabel
const items = await fetchSettingItems(config.datalabel);

// Update item - backend recomposes entire metadata array
await updateSettingItemMultiple(config.datalabel, id, updates);
```

### 3. Inline Editing

```typescript
const handleRowUpdate = async (id: string, updates: Partial<SettingItem>) => {
  if (updates._isNew) {
    // Create new item
    await createSettingItem(config.datalabel, {
      name: updates.name || '',
      descr: updates.descr,
      parent_id: updates.parent_id,
      color_code: updates.color_code || 'blue',
    });
  } else {
    // Update existing - backend handles metadata array
    await updateSettingItemMultiple(config.datalabel, id, updates);
  }

  // Refresh data
  const items = await fetchSettingItems(config.datalabel);
  setData(items);
};
```

---

## SettingItem Interface

```typescript
interface SettingItem {
  id: string | number;      // Position-based ID
  name: string;             // Display name
  descr?: string;           // Description
  parent_id?: string;       // Parent option ID (hierarchical)
  color_code?: string;      // Badge color (blue, green, amber, etc.)
  _isNew?: boolean;         // Flag for new rows
}
```

---

## Color Options

| Color Code | Display | Use Case |
|------------|---------|----------|
| `blue` | 🔵 Blue | Default, neutral |
| `green` | 🟢 Green | Success, active |
| `amber` | 🟡 Amber | Warning, pending |
| `red` | 🔴 Red | Error, critical |
| `purple` | 🟣 Purple | Special, complete |
| `gray` | ⚪ Gray | Inactive, archived |

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SETTING DETAIL DATA FLOW                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Route: /setting/projectStage                                            │
│     Extract category param → "projectStage"                                 │
│                                                                              │
│  2. Config Loading:                                                         │
│     fetchAllCategories() → find matching datalabel                          │
│     → dl__project_stage                                                     │
│                                                                              │
│  3. Data Loading:                                                           │
│     fetchSettingItems('dl__project_stage')                                  │
│     → Array of { id, name, descr, color_code }                              │
│                                                                              │
│  4. User Edit:                                                              │
│     User changes "Planning" → "Planning Phase"                              │
│     → handleRowUpdate(id, { name: 'Planning Phase' })                       │
│                                                                              │
│  5. Backend Update (DRY):                                                   │
│     updateSettingItemMultiple('dl__project_stage', id, updates)             │
│     Backend: fetch entire metadata → update item → save array               │
│                                                                              │
│  6. Refresh:                                                                │
│     fetchSettingItems() → setData() → re-render                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Related Pages

| Page | Relationship |
|------|--------------|
| [SettingsOverviewPage](./SettingsOverviewPage.md) | Settings hub (parent) |
| [DataLabelsVisualizationPage](./DataLabelsVisualizationPage.md) | Visual datalabel view |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v9.0.0 | 2025-12-03 | Settings service integration |
| v1.0.0 | 2025-10-01 | Initial release |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
