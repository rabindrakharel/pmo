# EntityFormContainer Component - Architecture Documentation

> **Component**: `apps/web/src/components/shared/entity/EntityFormContainer.tsx`
> **Purpose**: Universal form container for entity detail pages and create forms
> **Version**: 4.0 (Zero-Config Architecture)

---

## Table of Contents

1. [Overview](#overview)
2. [Centralized Service Integration](#centralized-service-integration)
3. [Architecture Patterns](#architecture-patterns)
4. [Auto-Generation Flow](#auto-generation-flow)
5. [Known Issues & Fixes](#known-issues--fixes)
6. [Usage Examples](#usage-examples)

---

## Overview

EntityFormContainer is a **universal, reusable form component** that dynamically renders form fields based on entity data. It powers both:
- **Entity Detail Pages** (edit mode)
- **Entity Create Pages** (new entity forms)

### Key Features

✅ **100% Auto-Generated** - No manual field configuration needed
✅ **Centralized Formatting** - Uses `universalFormatterService` for all formatting
✅ **Dynamic Options Loading** - Auto-loads dropdowns from settings and entities
✅ **DAG Workflow Support** - Visualizes workflow stages (project stages, task funnels)
✅ **Type Detection** - Automatically detects field types (currency, dates, badges, etc.)

---

## Centralized Service Integration

### ✅ Confirmed: EntityFormContainer USES Centralized Formatting Service

The component **fully integrates** with the centralized `universalFormatterService`:

#### **Imports (Lines 12, 20-21)**

```typescript
// Line 12: Formatting utilities
import {
  formatRelativeTime,
  formatFriendlyDate,
  formatCurrency,
  isCurrencyField
} from '../../../lib/universalFormatterService';

// Line 20: View config generator (uses detectField internally)
import { generateFormConfig, type FormField } from '../../../lib/viewConfigGenerator';

// Line 21: Field detection
import { detectField } from '../../../lib/universalFormatterService';
```

#### **Usage Flow**

```
┌─────────────────────────────────────────────────────────────┐
│ EntityFormContainer (EntityFormContainer.tsx)               │
│                                                             │
│  1. Receives entity data (e.g., project, task)             │
│  2. Calls generateFormConfig(fieldKeys) ──────────┐        │
│                                                    │        │
│  3. generateFormConfig internally calls:          │        │
│     └─> detectField(fieldKey) ────────────────────┼───┐    │
│                                                    │   │    │
│  4. Renders fields with detected formats          │   │    │
│                                                    │   │    │
└────────────────────────────────────────────────────┼───┼────┘
                                                     │   │
              ┌──────────────────────────────────────┘   │
              │                                          │
              ▼                                          ▼
┌─────────────────────────────┐      ┌──────────────────────────────┐
│ viewConfigGenerator.ts      │      │ universalFormatterService.ts │
│                             │      │                              │
│ generateFormConfig()        │      │ detectField()                │
│  - Loops through fieldKeys  │      │  - budget_allocated_amt      │
│  - Calls detectField() ─────┼─────>│    → currency                │
│  - Returns FormConfig       │      │  - dl__project_stage         │
│                             │      │    → badge (DAG)             │
└─────────────────────────────┘      │  - created_ts → timestamp    │
                                     │  - project_id → reference    │
                                     └──────────────────────────────┘
```

### **Detection Examples**

When EntityFormContainer receives task data:

```json
{
  "id": "f1111111-1111-1111-1111-111111111111",
  "name": "CEO Performance Review",
  "budget_allocated_amt": 50000,
  "dl__task_stage": "in_progress",
  "project_id": "abc-123",
  "created_ts": "2025-01-15T10:30:00Z"
}
```

**Auto-detection via `detectField()`**:

| Field Key            | Detected Type | Format       | Component            |
|---------------------|---------------|--------------|---------------------|
| `budget_allocated_amt` | `currency`    | `$50,000.00` | Number input        |
| `dl__task_stage`     | `badge`       | 🟡 "In Progress" | DAGVisualizer   |
| `project_id`         | `reference`   | Entity link  | Select (project options) |
| `created_ts`         | `timestamp`   | "2 hours ago" | DateTime display   |

---

## Architecture Patterns

### 1. **Zero-Config Auto-Generation**

No manual field definitions needed:

```typescript
// ❌ OLD WAY (Manual configs)
const config = {
  fields: [
    { key: 'name', type: 'text', label: 'Name' },
    { key: 'budget_allocated_amt', type: 'currency', label: 'Budget' },
    // ...hundreds of lines...
  ]
};

// ✅ NEW WAY (Auto-generated)
<EntityFormContainer
  data={taskData}
  autoGenerateFields={true}
  isEditing={isEditing}
  onChange={handleChange}
/>
// All fields auto-detected from data!
```

### 2. **Convention Over Configuration**

Field behavior determined by naming convention:

| Convention | Behavior |
|-----------|----------|
| `*_amt`, `*_price` | Currency field with $ formatting |
| `dl__*` | Settings dropdown with badge rendering |
| `dl__*_stage`, `dl__*_funnel` | DAG workflow visualizer |
| `*_id` (UUID) | Entity reference with dropdown |
| `*_ts`, `*_at` | Timestamp with relative time |
| `metadata`, `attr` | JSONB metadata table |

### 3. **Dynamic Options Loading**

**File**: `EntityFormContainer.tsx:237-260`

```typescript
// Auto-loads entity options for reference fields
useEffect(() => {
  const loadAllOptions = async () => {
    // Find fields needing entity options
    const fieldsNeedingEntityOptions = fields.filter(
      field => field.loadOptionsFromEntity &&
               (field.type === 'select' || field.type === 'multiselect')
    );

    // Load entity options in parallel
    await Promise.all(
      fieldsNeedingEntityOptions.map(async (field) => {
        const response = await entityOptionsApi.getOptions(
          field.loadOptionsFromEntity!,
          { limit: 500 }
        );
        // Store in entitiesMap
      })
    );
  };

  loadAllOptions();
}, [fields]);
```

**Example**: Task form with `project_id` field automatically loads:
- Fetches `/api/v1/entity/project/entity-instance-lookup`
- Renders dropdown with all available projects
- No manual API call needed!

---

## Auto-Generation Flow

### **Step-by-Step Process**

```
┌──────────────────────────────────────────────────────────────┐
│ 1. EntityDetailPage renders                                  │
│    <EntityFormContainer data={taskData} autoGenerateFields />│
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. EntityFormContainer.tsx:95-122                            │
│    const fields = useMemo(() => {                            │
│      const fieldKeys = Object.keys(data); // Extract keys    │
│      const config = generateFormConfig(fieldKeys);           │
│      return config.editableFields;                           │
│    }, [data, ...]);                                          │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. viewConfigGenerator.ts:221-271                            │
│    generateFormConfig(fieldKeys) {                           │
│      fieldKeys.forEach(key => {                              │
│        const meta = detectField(key); // ← Centralized!      │
│        fields.push({                                         │
│          key, label: meta.fieldName,                         │
│          type: meta.inputType,                               │
│          loadFromEntity: meta.loadFromEntity                 │
│        });                                                   │
│      });                                                     │
│    }                                                         │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. universalFormatterService.ts:detectField()                │
│    - Detects: budget_allocated_amt → currency                │
│    - Detects: dl__task_stage → badge (settings)              │
│    - Detects: project_id → reference (entity)                │
│    - Returns: { inputType, fieldName, loadFromEntity, ... }  │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. EntityFormContainer renders fields                        │
│    - Currency fields → <input type="number" />               │
│    - Badge fields → <DAGVisualizer /> or <select />          │
│    - Reference fields → <select> with entity options         │
│    - Timestamps → formatRelativeTime() display               │
└──────────────────────────────────────────────────────────────┘
```

---

## Known Issues & Fixes

### ⚠️ **Issue #1: Infinite Loop on Entity Detail Pages**

**Symptom**: Page repeatedly calls `/api/v1/entity/*/entity-instance-lookup` endpoints in infinite loop

**Root Cause**: `fields` useMemo depends on entire `data` object (Line 122)

```typescript
// ❌ PROBLEM
const fields = useMemo(() => {
  if (autoGenerateFields && Object.keys(data).length > 0) {
    const fieldKeys = Object.keys(data);
    // ...
  }
}, [config, autoGenerateFields, data, dataTypes, requiredFields]);
//                              ^^^^ Object reference changes every render
```

**Why it loops**:
1. `data` object reference changes (even with same content)
2. `fields` recomputes → new array created
3. `useEffect(() => loadAllOptions(), [fields])` triggers
4. Options API calls complete → `setEntityOptions()` → re-render
5. **LOOP back to step 1**

**Fix**: Depend on field keys string, not entire object (See PR #XXX)

---

## Usage Examples

### **Example 1: Entity Detail Page (Edit Mode)**

```typescript
// apps/web/src/pages/shared/EntityDetailPage.tsx:881-888
<EntityFormContainer
  config={config}                    // Optional - can be omitted
  data={isEditing ? editedData : data}
  isEditing={isEditing}
  onChange={handleFieldChange}
  mode="edit"
  autoGenerateFields={true}          // ← Auto-detect all fields!
/>
```

**Result**: All task fields auto-rendered with correct input types

### **Example 2: Entity Create Page**

```typescript
// apps/web/src/pages/shared/EntityCreatePage.tsx
<EntityFormContainer
  data={formData}
  isEditing={true}
  onChange={(key, value) => setFormData({...formData, [key]: value})}
  mode="create"
  autoGenerateFields={true}
  requiredFields={['name', 'code']}  // Mark required fields
/>
```

### **Example 3: Custom Data Types (JSONB)**

```typescript
<EntityFormContainer
  data={projectData}
  autoGenerateFields={true}
  dataTypes={{ metadata: 'jsonb', tags: 'array' }}  // Override detection
  requiredFields={['name', 'budget_allocated_amt']}
  isEditing={isEditing}
  onChange={handleChange}
/>
```

---

## Integration Points

### **1. Universal Formatter Service**

**File**: `apps/web/src/lib/universalFormatterService.ts`

- `detectField(fieldKey)` - Auto-detect field type and format
- `formatCurrency(value)` - Format currency values
- `formatRelativeTime(timestamp)` - Format timestamps
- `formatFriendlyDate(date)` - Format dates

### **2. View Config Generator**

**File**: `apps/web/src/lib/viewConfigGenerator.ts`

- `generateFormConfig(fieldKeys)` - Generate form configuration
- Uses `detectField()` internally for each field
- Returns `FormConfig` with editable/visible/required fields

### **3. Entity Options API**

**File**: `apps/web/src/lib/api.ts`

- `entityOptionsApi.getOptions(entityType, { limit })` - Fetch entity options
- Auto-loads dropdowns for reference fields (`*_id`)
- Example: `project_id` → fetches all projects for dropdown

### **4. Settings Loader**

**File**: `apps/web/src/lib/settingsLoader.ts`

- `loadFieldOptions(fieldKey)` - Load settings options
- Auto-loads dropdowns for `dl__*` fields
- Example: `dl__task_stage` → fetches task stages from settings

---

## Performance Considerations

### **Optimization Strategies**

1. **useMemo for field computation** - Only recompute when keys change
2. **Parallel options loading** - All dropdown options fetch in parallel
3. **Conditional rendering** - Only render visible fields
4. **Lazy DAG loading** - DAG nodes loaded only for stage/funnel fields

### **Current Performance**

- **Field detection**: O(n) where n = number of fields
- **Options loading**: O(m) parallel requests where m = fields with options
- **Rendering**: O(n) fields rendered

---

## Future Enhancements

- [ ] Field-level caching for options (reduce API calls)
- [ ] Virtualized rendering for forms with 100+ fields
- [ ] Field dependency validation (e.g., end_date > start_date)
- [ ] Custom field renderers registry
- [ ] Form state persistence (localStorage)

---

**Last Updated**: 2025-01-17
**Maintainer**: PMO Platform Team
**Related Docs**:
- [Universal Formatter Service](../services/UNIVERSAL_FORMATTER_SERVICE.md)
- [View Config Generator](../services/VIEW_CONFIG_GENERATOR.md)
- [Entity Detail Page](./ENTITY_DETAIL_PAGE.md)
