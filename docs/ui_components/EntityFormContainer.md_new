# EntityFormContainer Component

**Version:** 4.0.0 | **Location:** `apps/web/src/components/shared/entity/EntityFormContainer.tsx`

---

## Semantics

EntityFormContainer is a universal form component for creating and editing entities. It generates form fields from backend metadata, handles entity references (`_ID`/`_IDS` structures), and renders workflow stages with DAGVisualizer.

**Core Principle:** Auto-field generation from metadata. Entity references via domain components. Zero hardcoded field configs.

---

## System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   ENTITY FORM CONTAINER ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    API Response                                  │    │
│  │  { data: {...}, metadata: { fields: [...] }, datalabels }       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              v                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    EntityFormContainer                           │    │
│  │                                                                  │    │
│  │  ┌───────────────────────────────────────────────────────────┐  │    │
│  │  │  Standard Fields (from metadata.fields)                    │  │    │
│  │  │  ┌─────────────────────────────────────────────────────┐  │  │    │
│  │  │  │ renderEditModeFromMetadata(value, fieldMeta, onChange) │  │    │
│  │  │  └─────────────────────────────────────────────────────┘  │  │    │
│  │  └───────────────────────────────────────────────────────────┘  │    │
│  │                                                                  │    │
│  │  ┌───────────────────────────────────────────────────────────┐  │    │
│  │  │  Entity References (_ID - single)                          │  │    │
│  │  │  <EntitySelect entityCode={ref.entity_code} ... />         │  │    │
│  │  └───────────────────────────────────────────────────────────┘  │    │
│  │                                                                  │    │
│  │  ┌───────────────────────────────────────────────────────────┐  │    │
│  │  │  Entity References (_IDS - multiple)                       │  │    │
│  │  │  <EntityMultiSelect entityCode={ref.entity_code} ... />    │  │    │
│  │  └───────────────────────────────────────────────────────────┘  │    │
│  │                                                                  │    │
│  │  ┌───────────────────────────────────────────────────────────┐  │    │
│  │  │  Stage Fields (dl__*_stage)                                │  │    │
│  │  │  <DAGVisualizer stages={...} currentStage={...} />         │  │    │
│  │  └───────────────────────────────────────────────────────────┘  │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
Form Field Generation Flow
──────────────────────────

Backend Metadata                  Form Field                     Rendered Input
────────────────                  ──────────────                 ──────────────

metadata.fields: [         →      For each field:        →       ┌──────────────┐
  {                               <div>                          │ Budget       │
    key: "budget_amt",              <label>Budget</label>        │ $|50000.00  |│
    label: "Budget",                {renderEditMode(...)}        │              │
    inputType: "currency"         </div>                         └──────────────┘
  }
]


Entity Reference Flow (_ID)
───────────────────────────

data._ID: {                 →     <EntitySelect             →    ┌──────────────┐
  manager: {                        entityCode="employee"        │ Manager      │
    entity_code: "employee",        value={uuid}                 │ [John Smith▼]│
    manager__employee_id: uuid,     onChange={(uuid, label) =>   └──────────────┘
    manager: "John Smith"             update _ID.manager}
  }                               />
}


Entity Reference Flow (_IDS)
────────────────────────────

data._IDS: {                →     <EntityMultiSelect        →    ┌──────────────┐
  stakeholder: [                    entityCode="employee"        │ Stakeholders │
    {                               values={array}               │ [Alice][Bob] │
      entity_code: "employee",      onAdd={...}                  │ [+ Add     ▼]│
      stakeholder__employee_id,     onRemove={...}               └──────────────┘
      stakeholder: "Alice"        />
    }
  ]
}
```

---

## Architecture Overview

### Field Types

| Source | Component | Description |
|--------|-----------|-------------|
| Standard fields | `renderEditModeFromMetadata()` | Text, number, date, select |
| `_ID` references | `EntitySelect` | Single entity reference |
| `_IDS` references | `EntityMultiSelect` | Multiple entity references |
| `dl__*_stage` | `DAGVisualizer` + `DataLabelSelect` | Workflow stages |
| `metadata` field | `MetadataTable` | JSON key-value editor |

### Data Structure

| Structure | Purpose | Example |
|-----------|---------|---------|
| `data.{field}` | Standard field value | `data.name = "Project A"` |
| `data._ID.{label}` | Single reference | `data._ID.manager = { entity_code, uuid, name }` |
| `data._IDS.{label}` | Multiple references | `data._IDS.stakeholder = [{ entity_code, uuid, name }]` |

### Form States

| Mode | Trigger | Behavior |
|------|---------|----------|
| View | `isEditing = false` | Display values, no inputs |
| Edit | `isEditing = true` | Editable inputs |
| Create | `data.id = undefined` | Empty form, all editable |

---

## Tooling Overview

### Basic Usage

```typescript
<EntityFormContainer
  entityCode="project"
  data={project}
  metadata={metadata}
  datalabels={datalabels}
  isEditing={isEditing}
  onChange={(field, value) => updateData(field, value)}
  onSave={handleSave}
/>
```

### Reference Handling

```typescript
// _ID update (single reference)
onChange('_ID', {
  ...data._ID,
  manager: {
    entity_code: 'employee',
    manager__employee_id: newUuid,
    manager: newLabel
  }
});

// _IDS update (add to array)
onChange('_IDS', {
  ...data._IDS,
  stakeholder: [
    ...data._IDS.stakeholder,
    { entity_code: 'employee', stakeholder__employee_id: uuid, stakeholder: label }
  ]
});
```

---

## Database/API/UI Mapping

### Field to Component Mapping

| Field Pattern | Form Component |
|---------------|----------------|
| `*_amt`, `*_price` | Currency input |
| `*_date` | Date picker |
| `*_ts` | DateTime picker (readonly) |
| `is_*`, `*_flag` | Checkbox |
| `dl__*` | DataLabelSelect |
| `dl__*_stage` | DataLabelSelect + DAGVisualizer |
| `*__employee_id` | EntitySelect (employee) |
| `*__project_id` | EntitySelect (project) |
| `descr`, `*_text` | Textarea |
| `metadata` | MetadataTable |
| Default | Text input |

### Hidden Fields

| Field | Reason |
|-------|--------|
| `id` | System identifier |
| `created_ts` | Auto-generated |
| `updated_ts` | Auto-generated |
| `version` | Optimistic locking |
| `active_flag` | System flag |

---

## User Interaction Flow

```
Create Entity Flow
──────────────────

1. User navigates to /project/new
   │
2. EntityFormPage loads with empty data
   │
3. EntityFormContainer renders:
   ├── Standard fields (empty)
   ├── _ID references (empty dropdowns)
   └── _IDS references (empty tag lists)
   │
4. User fills form:
   ├── Types in text fields
   ├── Selects dates
   ├── Picks entity references from dropdowns
   └── Adds multiple stakeholders
   │
5. User clicks Save
   │
6. Form transforms data for API:
   {
     name: "Project A",
     budget_amt: 50000,
     manager__employee_id: "uuid-1",
     stakeholder__employee_ids: ["uuid-2", "uuid-3"]
   }
   │
7. POST /api/v1/project
   │
8. Navigate to /project/:newId


Edit Entity Flow
────────────────

1. User clicks Edit on project detail
   │
2. GET /api/v1/project/:id
   Response includes _ID, _IDS structures
   │
3. EntityFormContainer renders:
   ├── Standard fields (populated)
   ├── _ID references (selected values)
   └── _IDS references (tag list)
   │
4. User modifies values
   │
5. User clicks Save
   │
6. PATCH /api/v1/project/:id
   Only changed fields sent
   │
7. Exit edit mode, refetch data
```

---

## Critical Considerations

### Design Principles

1. **Metadata-Driven** - All fields from backend metadata
2. **Reference Structures** - `_ID`/`_IDS` for entity relations
3. **Domain Components** - EntitySelect, DataLabelSelect for data-aware fields
4. **DAG Integration** - Stage fields show workflow visualization
5. **Transform on Save** - Flatten `_ID`/`_IDS` to API format

### Reference Pattern

| Pattern | Structure | API Transform |
|---------|-----------|---------------|
| Single FK | `_ID.manager.manager__employee_id` | `manager__employee_id: uuid` |
| Multiple FK | `_IDS.stakeholder[].stakeholder__employee_id` | `stakeholder__employee_ids: [uuid]` |

### Validation

| Source | Validation |
|--------|------------|
| `metadata.required` | Field must have value |
| `metadata.validation` | Custom validation rules |
| `inputType` | Input type constraints |

### Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Hardcoded field list | Use metadata.fields |
| Direct FK UUID inputs | Use EntitySelect |
| Manual stage dropdowns | Use DataLabelSelect + DAG |
| Custom reference handling | Use _ID/_IDS pattern |

---

**Last Updated:** 2025-11-21 | **Status:** Production Ready
