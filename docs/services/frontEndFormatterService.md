# Frontend Formatter Service

**Version:** 5.0.0 | **Location:** `apps/web/src/lib/frontEndFormatterService.tsx`

---

## Semantics

The Frontend Formatter Service is a **pure renderer** that consumes backend metadata and renders React elements. It contains **zero pattern detection logic** - all rendering decisions come from the backend.

**Core Principle:** Frontend executes backend instructions exactly. No logic, no decisions, no pattern detection.

---

## System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FRONTEND FORMATTER SERVICE                            │
│                      (Pure Metadata Renderer)                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Backend Metadata Input                         │   │
│  │  { renderType, inputType, format, loadFromEntity, ... }          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│              ┌───────────────┴───────────────┐                          │
│              v                               v                          │
│  ┌───────────────────────┐    ┌───────────────────────┐                │
│  │   VIEW MODE           │    │   EDIT MODE           │                │
│  │   renderViewMode()    │    │   renderEditMode()    │                │
│  └───────────────────────┘    └───────────────────────┘                │
│              │                               │                          │
│              v                               v                          │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                     Render Type Switch                             │ │
│  │  currency│badge│date│timestamp│boolean│reference│json│file│...   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│              │                               │                          │
│              v                               v                          │
│  ┌───────────────────────┐    ┌───────────────────────┐                │
│  │  React.ReactNode      │    │  Input Component      │                │
│  │  (Display Element)    │    │  (Form Control)       │                │
│  └───────────────────────┘    └───────────────────────┘                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
API Response                  Frontend Service               React Output
───────────────               ─────────────────              ─────────────

metadata.renderType: 'currency'
value: 50000           ───>   renderViewMode()    ───>      <span>$50,000.00</span>

metadata.renderType: 'badge'
value: 'planning'      ───>   renderViewMode()    ───>      <Badge color="blue">Planning</Badge>

metadata.inputType: 'currency'
value: 50000           ───>   renderEditMode()    ───>      <input type="number" step="0.01" />

metadata.inputType: 'select'
loadFromDataLabels: true ───> renderEditMode()    ───>      <Select options={datalabels} />
```

---

## Architecture Overview

### Core Functions

| Function | Purpose | Input | Output |
|----------|---------|-------|--------|
| `renderViewModeFromMetadata()` | Renders view mode | value, metadata, record | ReactNode |
| `renderEditModeFromMetadata()` | Renders edit mode | value, metadata, onChange | ReactNode |
| `hasBackendMetadata()` | Type guard | API response | boolean |

### Render Types (11)

| renderType | View Mode Output | Description |
|------------|------------------|-------------|
| `currency` | `$50,000.00` | Formatted currency with symbol |
| `badge` | `<Badge>` | Colored badge component |
| `date` | `Jan 15, 2025` | Formatted date |
| `timestamp` | `Jan 15, 2025 10:30 AM` | Formatted datetime |
| `boolean` | `Yes` / `No` or toggle icon | Boolean display |
| `reference` | Entity name | Resolved reference label |
| `json` | `<MetadataTable>` | JSON table view |
| `file` | Download link | File reference |
| `link` | `<a href>` | Clickable link |
| `percentage` | `75%` | Percentage format |
| `text` | Raw value | Default text display |

### Input Types (11)

| inputType | Edit Mode Output | Description |
|-----------|------------------|-------------|
| `currency` | `<input type="number">` | Currency input |
| `select` | `<Select>` | Dropdown selector |
| `date` | `<input type="date">` | Date picker |
| `datetime` | `<input type="datetime-local">` | DateTime picker |
| `checkbox` | `<input type="checkbox">` | Toggle checkbox |
| `select-entity` | `<EntitySelect>` | Entity reference dropdown |
| `json` | `<textarea>` | JSON editor |
| `file` | `<FileUpload>` | File upload component |
| `textarea` | `<textarea>` | Multi-line text |
| `number` | `<input type="number">` | Numeric input |
| `text` | `<input type="text">` | Default text input |

---

## Tooling Overview

### Usage in Components

```typescript
import {
  renderViewModeFromMetadata,
  renderEditModeFromMetadata,
  hasBackendMetadata
} from '@/lib/frontEndFormatterService';

// View mode rendering
{metadata.fields.map(fieldMeta => (
  <td key={fieldMeta.key}>
    {renderViewModeFromMetadata(record[fieldMeta.key], fieldMeta, record)}
  </td>
))}

// Edit mode rendering
{metadata.fields.map(fieldMeta => (
  <div key={fieldMeta.key}>
    {renderEditModeFromMetadata(data[fieldMeta.key], fieldMeta, handleChange)}
  </div>
))}
```

### Type Guard Usage

```typescript
const response = await api.get('/api/v1/project');

if (hasBackendMetadata(response.data)) {
  // Use metadata-driven rendering
  const columns = response.data.metadata.fields;
} else {
  // Fallback (should not occur in production)
}
```

---

## Database/API/UI Mapping

### Metadata to Component Mapping

| Backend Metadata | View Component | Edit Component |
|------------------|----------------|----------------|
| `renderType: 'currency'` | `<span className="font-mono">` | `<input type="number">` |
| `renderType: 'badge'` | `<Badge>` | `<DataLabelSelect>` |
| `renderType: 'date'` | Formatted date string | `<input type="date">` |
| `renderType: 'boolean'` | Icon or Yes/No | `<input type="checkbox">` |
| `renderType: 'reference'` | Entity name | `<EntitySelect>` |
| `renderType: 'json'` | `<MetadataTable>` | `<textarea>` |

### Component Integration Points

| Component | Uses renderViewMode | Uses renderEditMode |
|-----------|---------------------|---------------------|
| EntityDataTable | Yes (cells) | Yes (inline edit) |
| EntityFormContainer | No (form layout) | Yes (form fields) |
| EntityDetailView | Yes (read-only display) | No |
| KanbanBoard | Yes (card content) | No |

---

## User Interaction Flow

```
1. Component receives API response with metadata
   │
2. Component checks hasBackendMetadata()
   │
3. For each field in metadata.fields:
   │
   ├── VIEW MODE (isEditing = false)
   │   │
   │   └── renderViewModeFromMetadata(value, fieldMeta, record)
   │       │
   │       ├── Switch on fieldMeta.renderType
   │       ├── Apply fieldMeta.format options
   │       └── Return React element
   │
   └── EDIT MODE (isEditing = true)
       │
       └── renderEditModeFromMetadata(value, fieldMeta, onChange)
           │
           ├── Switch on fieldMeta.inputType
           ├── Apply fieldMeta.validation rules
           └── Return form control with onChange handler
   │
4. Component renders returned React elements
```

---

## Critical Considerations

### Design Principles

1. **Pure Renderer** - No business logic, no pattern detection
2. **Metadata-Driven** - All decisions from backend metadata
3. **Type-Safe** - Full TypeScript support
4. **Stateless** - No internal state management
5. **Component Agnostic** - Works with any parent component

### What This Service Does NOT Do

| Responsibility | Where It Lives |
|----------------|----------------|
| Pattern detection | Backend Formatter Service |
| Field visibility decisions | Backend metadata |
| Validation rules | Backend metadata |
| Dropdown options | Backend datalabels |
| Entity reference resolution | Backend API |

### Error Handling

| Scenario | Behavior |
|----------|----------|
| Unknown renderType | Returns raw value as string |
| Missing value | Returns empty string or null |
| Invalid metadata | Falls back to text rendering |
| Missing datalabels | Shows value without badge |

### Performance Considerations

- No API calls within render functions
- Memoization handled by parent components
- Datalabels pre-fetched by API response
- Minimal re-renders with stable function references

---

**Last Updated:** 2025-11-21 | **Status:** Production Ready
