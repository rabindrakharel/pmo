# UI Component Hierarchy

**Version:** 3.5.0 | **Architecture:** Base → Domain → Application

---

## Semantics

The UI Component Hierarchy follows a three-tier architecture pattern where components are organized by their level of abstraction and data awareness. Each layer has specific responsibilities and dependencies.

**Core Principle:** Base components have no data dependencies. Domain components fetch data. Application components compose everything.

---

## System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      COMPONENT HIERARCHY                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    APPLICATION LAYER                             │    │
│  │  EntityDataTable, EntityFormContainer, FilteredDataTable        │    │
│  │  (Business logic, data fetching, state management)              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              │ composes                                 │
│                              v                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      DOMAIN LAYER                                │    │
│  │  EntitySelect, EntityMultiSelect, DataLabelSelect               │    │
│  │  (Data-aware components with API integration)                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              │ wraps                                    │
│                              v                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                       BASE LAYER                                 │    │
│  │  Select, MultiSelect, SearchableMultiSelect                     │    │
│  │  (Generic, reusable, no business logic)                         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
Application Layer Data Flow
───────────────────────────

API Response               Application Component            Domain/Base
───────────                ─────────────────────            ───────────

{ data, metadata }    →    EntityDataTable
                                  │
                                  ├─→ renderField() (formatter service)
                                  │
                                  └─→ EntitySelect (for FK fields)
                                            │
                                            └─→ useQuery (react-query)
                                                    │
                                                    └─→ Select (base)


Domain Layer Data Flow
──────────────────────

Entity Code               Domain Component                  Base
───────────               ────────────────                  ────

"employee"      →         EntitySelect
                                │
                                └─→ useQuery(['entity-lookup', 'employee'])
                                        │
                                        └─→ GET /api/v1/entity/employee/instance-lookup
                                                │
                                                └─→ Transform to SelectOption[]
                                                        │
                                                        └─→ Select (base)
```

---

## Architecture Overview

### Base Layer Components

| Component | File | Purpose | Data Source |
|-----------|------|---------|-------------|
| Select | `ui/Select.tsx` | Single dropdown | Props (static options) |
| SearchableMultiSelect | `ui/SearchableMultiSelect.tsx` | Multi-select with tags | Props (static options) |

### Domain Layer Components

| Component | File | Purpose | Data Source |
|-----------|------|---------|-------------|
| EntitySelect | `ui/EntitySelect.tsx` | Entity reference picker | API (instance-lookup) |
| EntityMultiSelect | `ui/EntityMultiSelect.tsx` | Multiple entity refs | API (instance-lookup) |
| DataLabelSelect | `ui/DataLabelSelect.tsx` | Settings dropdown | API (setting) |

### Application Layer Components

| Component | File | Purpose | Data Source |
|-----------|------|---------|-------------|
| EntityDataTable | `ui/EntityDataTable.tsx` | Universal data table | API (entity list) |
| EntityFormContainer | `entity/EntityFormContainer.tsx` | Universal form | API (entity single) |
| FilteredDataTable | `ui/FilteredDataTable.tsx` | Filtered table | API (entity list) |

---

## Tooling Overview

### Base Layer Usage

```typescript
// Static options - no API calls
<Select
  value={selectedValue}
  onChange={handleChange}
  options={[
    { value: 'opt1', label: 'Option 1' },
    { value: 'opt2', label: 'Option 2' }
  ]}
/>
```

### Domain Layer Usage

```typescript
// Automatic API call to /api/v1/entity/employee/instance-lookup
<EntitySelect
  entityCode="employee"
  value={managerId}
  onChange={(uuid, label) => setManager({ id: uuid, name: label })}
/>

// Settings dropdown from /api/v1/setting?datalabel=dl__project_stage
<DataLabelSelect
  datalabel="dl__project_stage"
  value={currentStage}
  onChange={(newStage) => setStage(newStage)}
/>
```

### Application Layer Usage

```typescript
// Full table with metadata-driven rendering
<EntityDataTable
  entityCode="project"
  data={projects}
  metadata={metadata}
  onInlineEdit={handleEdit}
/>

// Universal form with auto-field generation
<EntityFormContainer
  entityCode="project"
  data={project}
  metadata={metadata}
  onSave={handleSave}
/>
```

---

## Database/API/UI Mapping

### Component to API Mapping

| Component | API Endpoint | Cache Time |
|-----------|--------------|------------|
| EntitySelect | `/api/v1/entity/{code}/instance-lookup` | 2 min |
| EntityMultiSelect | `/api/v1/entity/{code}/instance-lookup` | 2 min |
| DataLabelSelect | `/api/v1/setting?datalabel={name}` | 5 min |
| EntityDataTable | `/api/v1/{entityCode}?view=entityDataTable` | 2 min |
| EntityFormContainer | `/api/v1/{entityCode}/{id}` | 2 min |

### Field Type to Component Mapping

| Field Pattern | View Mode | Edit Mode |
|---------------|-----------|-----------|
| `*__employee_id` | Name text | EntitySelect |
| `*__project_id` | Name text | EntitySelect |
| `dl__*` | Badge | DataLabelSelect |
| `*_ids` (array) | Tag list | EntityMultiSelect |
| `*_amt` | Currency text | Number input |
| `*_date` | Formatted date | Date picker |

---

## User Interaction Flow

```
Entity Reference Selection
──────────────────────────

1. User clicks EntitySelect dropdown
   │
2. EntitySelect component:
   ├── Check React Query cache for 'entity-lookup-employee'
   │   └── If cached and fresh → Use cached options
   │   └── If stale or missing → Fetch from API
   │
3. Display options in Select (base component)
   │
4. User selects option
   │
5. onChange callback:
   └── Returns (uuid, label) to parent


Inline Edit Flow
────────────────

1. User clicks edit icon on table row
   │
2. EntityDataTable enters edit mode
   │
3. For each editable column:
   ├── Reference fields → EntitySelect
   ├── Datalabel fields → DataLabelSelect
   └── Other fields → Input/Textarea
   │
4. User modifies values
   │
5. User clicks save
   │
6. PATCH /api/v1/{entity}/{id}
   │
7. React Query invalidates, table refetches
```

---

## Critical Considerations

### Design Principles

1. **Separation of Concerns** - Base = UI, Domain = Data, Application = Business
2. **Direct Imports** - No wrapper functions, import components directly
3. **React Query Caching** - All domain components use react-query
4. **Universal Rendering** - Application components delegate to formatter service

### Layer Responsibilities

| Layer | Has | Does NOT Have |
|-------|-----|---------------|
| Base | Props-driven options | API calls |
| Base | onChange handlers | Business logic |
| Domain | useQuery hooks | State management |
| Domain | API endpoint calls | Custom business logic |
| Application | State management | Hardcoded field configs |
| Application | Business logic | Direct API calls |

### Component Dependencies

| Component | Depends On |
|-----------|------------|
| Select | None |
| SearchableMultiSelect | None |
| EntitySelect | Select, React Query |
| EntityMultiSelect | SearchableMultiSelect, React Query |
| DataLabelSelect | Select, React Query |
| EntityDataTable | EntitySelect, DataLabelSelect, Formatter Service |
| EntityFormContainer | EntitySelect, EntityMultiSelect, DataLabelSelect, Formatter Service |

### File Locations

```
apps/web/src/components/shared/
├── ui/
│   ├── Select.tsx                  (Base)
│   ├── SearchableMultiSelect.tsx   (Base)
│   ├── EntitySelect.tsx            (Domain)
│   ├── EntityMultiSelect.tsx       (Domain)
│   ├── DataLabelSelect.tsx         (Domain)
│   ├── EntityDataTable.tsx         (Application)
│   └── ColoredDropdown.tsx         (Special)
│
└── entity/
    ├── EntityFormContainer.tsx     (Application)
    └── MetadataTable.tsx           (Special)
```

---

**Last Updated:** 2025-11-21 | **Status:** Production Ready
