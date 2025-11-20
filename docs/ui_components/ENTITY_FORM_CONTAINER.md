# EntityFormContainer Component - Architecture Documentation

> **Component**: `apps/web/src/components/shared/entity/EntityFormContainer.tsx`
> **Purpose**: Universal form container for entity detail pages and create forms
> **Version**: 5.0 (Metadata-Driven Architecture)

---

## Table of Contents

1. [Overview](#overview)
2. [Metadata-Driven Architecture](#metadata-driven-architecture)
3. [Composite Field Support](#composite-field-support)
4. [Architecture Patterns](#architecture-patterns)
5. [Usage Examples](#usage-examples)

---

## Overview

EntityFormContainer is a **universal, reusable form component** that dynamically renders form fields based on backend-provided metadata. It powers both:
- **Entity Detail Pages** (edit mode)
- **Entity Create Pages** (new entity forms)

### Key Features

✅ **100% Metadata-Driven** - Backend controls all field rendering
✅ **Object-Based Visibility** - Per-component visibility control (`visible.EntityFormContainer`)
✅ **Composite Field Support** - Auto-renders progress bars, date ranges from source fields
✅ **Zero Frontend Logic** - Pure renderer consuming backend instructions
✅ **Dynamic Options Loading** - Auto-loads dropdowns from backend metadata endpoints
✅ **DAG Workflow Support** - Visualizes workflow stages (project stages, task funnels)

---

## Metadata-Driven Architecture

### Backend is Source of Truth

EntityFormContainer is a **pure renderer** that consumes backend-provided metadata. It has **ZERO** pattern detection logic.

#### **Core Principle**

```
Backend generates metadata → Frontend renders exactly as instructed
```

#### **Architecture Flow**

```
┌──────────────────────────────────────────────────────────────┐
│                    BACKEND LAYER                              │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Route Handler (GET /api/v1/project/:id)                     │
│         │                                                     │
│         ├─ Execute SQL query                                 │
│         │  SELECT * FROM app.d_project WHERE id = ?          │
│         │                                                     │
│         ├─ Get entity data (project row)                     │
│         │                                                     │
│         ▼                                                     │
│  getEntityMetadata('project', sampleRow)                     │
│         │                                                     │
│         ├─ Analyze column names (start_date, end_date, ...)  │
│         ├─ Match against 35+ pattern rules                   │
│         ├─ Detect composite fields (start + end → progress)  │
│         ├─ Apply object-based visibility per component       │
│         │                                                     │
│         ▼                                                     │
│  Return {                                                     │
│    data: { id, name, start_date, end_date, ... },           │
│    metadata: {                                               │
│      fields: [                                               │
│        {                                                      │
│          key: "start_date",                                  │
│          label: "Start Date",                                │
│          inputType: "date",                                  │
│          visible: {                                          │
│            EntityDataTable: true,                            │
│            EntityDetailView: false,      // Hidden           │
│            EntityFormContainer: true,    // Show for edit    │
│            KanbanView: true,                                 │
│            CalendarView: true                                │
│          }                                                    │
│        },                                                     │
│        {                                                      │
│          key: "start_date_end_date_composite",               │
│          label: "Project Progress",                          │
│          renderType: "progress-bar",                         │
│          component: "ProgressBar",                           │
│          composite: true,                                    │
│          compositeConfig: {                                  │
│            composedFrom: ["start_date", "end_date"],         │
│            compositeType: "progress-bar",                    │
│            showPercentage: true,                             │
│            showDates: true,                                  │
│            highlightOverdue: true                            │
│          },                                                   │
│          visible: {                                          │
│            EntityDataTable: false,                           │
│            EntityDetailView: true,       // ONLY detail view │
│            EntityFormContainer: false,   // Hidden in form   │
│            KanbanView: false,                                │
│            CalendarView: false                               │
│          }                                                    │
│        }                                                      │
│      ]                                                        │
│    }                                                          │
│  }                                                            │
│                                                               │
└───────────────────────────────────────────────────────────────┘
                          │
                          │ HTTP Response
                          ▼
┌───────────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                             │
│  (Pure renderer - consumes metadata)                          │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  EntityFormContainer.tsx                                      │
│         │                                                     │
│         ├─ Receives response with metadata                   │
│         │                                                     │
│         ▼                                                     │
│  Filter fields by visibility                                  │
│         │                                                     │
│         ├─ metadata.fields.filter(f =>                       │
│         │    f.visible.EntityFormContainer === true)         │
│         │                                                     │
│         ▼                                                     │
│  Render fields using metadata                                 │
│         │                                                     │
│         ├─ For each field:                                   │
│         │    renderEditModeFromMetadata(value, fieldMeta)    │
│         │                                                     │
│         ▼                                                     │
│  Display form with:                                           │
│    ✓ start_date input (visible.EntityFormContainer = true)   │
│    ✓ end_date input (visible.EntityFormContainer = true)     │
│    ✗ progress bar (visible.EntityFormContainer = false)      │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### **Metadata Consumption**

```typescript
// EntityFormContainer.tsx - Metadata-driven field filtering
import { renderEditModeFromMetadata } from '@/lib/universalFormatterService';

const formFields = useMemo(() => {
  if (metadata?.fields) {
    return metadata.fields
      .filter(fieldMeta => {
        // ✅ Object-based visibility control
        if (typeof fieldMeta.visible === 'object' && fieldMeta.visible !== null) {
          return fieldMeta.visible.EntityFormContainer === true;
        }
        // Backward compatibility
        return fieldMeta.visible === true;
      })
      .filter(fieldMeta => !fieldMeta.composite)  // Exclude composite fields from edit form
      .filter(fieldMeta => fieldMeta.editable);    // Only editable fields
  }
  return [];
}, [metadata]);

// Render each field using backend metadata
{formFields.map(fieldMeta => (
  <div key={fieldMeta.key}>
    <label>{fieldMeta.label}</label>
    {renderEditModeFromMetadata(
      entity[fieldMeta.key],
      fieldMeta,
      (value) => handleChange(fieldMeta.key, value)
    )}
  </div>
))}
```

### **Backend Metadata Example**

When EntityFormContainer receives project data:

```json
{
  "data": {
    "id": "f1111111-1111-1111-1111-111111111111",
    "name": "Kitchen Renovation",
    "start_date": "2025-01-15",
    "end_date": "2025-03-30",
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

## Composite Field Support

### What Are Composite Fields?

**Composite fields** are virtual fields derived from multiple source fields. Backend auto-detects field pairs and creates composite fields with context-aware visibility.

### Detected Patterns

**Pattern 1: Progress Bar** (`start_date` + `end_date`)
```json
{
  "key": "start_date_end_date_composite",
  "label": "Project Progress",
  "type": "composite",
  "renderType": "progress-bar",
  "component": "ProgressBar",
  "composite": true,
  "compositeConfig": {
    "composedFrom": ["start_date", "end_date"],
    "compositeType": "progress-bar",
    "showPercentage": true,
    "showDates": true,
    "highlightOverdue": true
  },
  "visible": {
    "EntityDataTable": false,       // Too complex for table
    "EntityDetailView": true,        // Perfect for detail view
    "EntityFormContainer": false,    // Don't show in edit form
    "KanbanView": false,
    "CalendarView": false
  }
}
```

**Pattern 2: Date Range** (`from_ts` + `to_ts`)
```json
{
  "key": "from_ts_to_ts_composite",
  "label": "Active Period",
  "type": "composite",
  "renderType": "date-range",
  "component": "DateRangeVisualizer",
  "composite": true,
  "compositeConfig": {
    "composedFrom": ["from_ts", "to_ts"],
    "compositeType": "date-range"
  },
  "visible": {
    "EntityDataTable": false,
    "EntityDetailView": true,
    "EntityFormContainer": false,
    "KanbanView": false,
    "CalendarView": false
  }
}
```

### Form Rendering Strategy

**EntityFormContainer** automatically excludes composite fields because:
1. **Composite fields are read-only** - Derived from source fields
2. **Source fields are editable** - Users edit `start_date` and `end_date` directly
3. **Backend controls visibility** - `visible.EntityFormContainer = false` for composites

```typescript
// EntityFormContainer filters out composite fields
const formFields = metadata.fields
  .filter(f => f.visible.EntityFormContainer === true)
  .filter(f => !f.composite);  // ✅ Exclude composites from edit form

// Result: Form shows start_date and end_date inputs, NOT the progress bar
```

---

## Integration Points

### **1. Backend Formatter Service**

**File**: `apps/api/src/services/backend-formatter.service.ts`

- `getEntityMetadata(entityCode, sampleRow)` - Generate complete metadata
- `detectCompositeFields(fieldNames)` - Auto-detect field pairs
- `createDefaultVisibility()` - All components visible by default
- `createCompositeVisibility()` - Only EntityDetailView visible
- Pattern detection (35+ rules): `*_amt` → currency, `dl__*` → badge, etc.

### **2. Frontend Formatter Service**

**File**: `apps/web/src/lib/universalFormatterService.tsx`

- `renderEditModeFromMetadata(value, metadata, onChange)` - Edit mode rendering
- `renderViewModeFromMetadata(value, metadata, record)` - View mode rendering
- `hasBackendMetadata(response)` - Type guard for metadata presence

### **3. Entity API**

**File**: `apps/web/src/lib/api.ts`

Backend routes return metadata:
```typescript
GET /api/v1/project/:id
→ { data: {...}, metadata: { fields: [...] } }
```

### **4. Settings Loader**

**File**: `apps/web/src/lib/settingsLoader.ts`

- `loadFieldOptions(fieldKey)` - Load settings options
- Auto-loads dropdowns for `dl__*` fields
- Example: `dl__task_stage` → fetches task stages from settings

---

## Performance Considerations

### **Optimization Strategies**

1. **useMemo for field filtering** - Only refilter when metadata changes
2. **Parallel options loading** - All dropdown options fetch in parallel (from metadata.endpoint)
3. **Object-based visibility filtering** - Single pass filter by `visible.EntityFormContainer`
4. **Composite field exclusion** - Auto-exclude read-only composite fields from edit forms

### **Current Performance**

- **Field filtering**: O(n) where n = number of fields
- **Options loading**: O(m) parallel requests where m = fields with `loadFromDataLabels` or `loadFromEntity`
- **Rendering**: O(n) fields rendered (metadata-driven, zero pattern detection)

---

## Future Enhancements

- [ ] Frontend ProgressBar component for composite fields
- [ ] Field-level caching for options (reduce API calls)
- [ ] Virtualized rendering for forms with 100+ fields
- [ ] Field dependency validation (e.g., end_date > start_date)
- [ ] Form state persistence (localStorage)
- [ ] More composite patterns (full_name, full_address, budget_utilization)

---

**Last Updated**: 2025-01-20
**Version**: 5.0 (Metadata-Driven Architecture)
**Maintainer**: PMO Platform Team

**Related Docs**:
- [Backend Formatter Service](../services/BACKEND_FORMATTER_SERVICE.md)
- [Frontend Formatter Service](../services/FRONTEND_FORMATTER_SERVICE.md)
- [Anti-Pattern Prevention](../ANTI_PATTERNS_PREVENTION.md)
