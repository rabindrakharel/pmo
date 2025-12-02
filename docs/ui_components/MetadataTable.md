# MetadataTable Component

**Version:** 12.2.0 | **Location:** `apps/web/src/components/shared/entity/MetadataTable.tsx`

> **Note:** As of v12.2.0, MetadataTable is registered in both **ViewComponentRegistry** and **EditComponentRegistry**. It is resolved automatically by FieldRenderer when `vizContainer.view='MetadataTable'` or `vizContainer.edit='MetadataTable'`.

---

## Overview

MetadataTable is a reusable component for displaying and editing JSONB metadata fields as an inline editable key-value table. It provides view mode for display and edit mode for inline editing with type coercion.

**Core Principles:**
- Pure presentation component (no API calls)
- Receives data via props from EntityInstanceFormContainer
- Inline editing with automatic type coercion (boolean, number, JSON, string)
- **v12.2.0:** Registered in `ViewComponentRegistry` and `EditComponentRegistry`
- Backend metadata drives rendering via `renderType: 'component'` + `vizContainer.view: 'MetadataTable'`

---

## FieldRenderer Integration (v12.2.0)

### Component Registration

MetadataTable is registered in both VIEW and EDIT registries at app initialization:

```typescript
// apps/web/src/lib/fieldRenderer/registerComponents.tsx
import { registerViewComponent, registerEditComponent } from './ComponentRegistry';
import { MetadataTable } from '@/components/shared/entity/MetadataTable';

// VIEW mode: Read-only display
const MetadataTableView: FC<ComponentRendererProps> = ({ value }) => (
  <MetadataTable value={value || {}} isEditing={false} />
);

// EDIT mode: Inline editing
const MetadataTableEdit: FC<ComponentRendererProps> = ({ value, onChange }) => (
  <MetadataTable
    value={value || {}}
    onChange={onChange}
    isEditing={true}
  />
);

registerViewComponent('MetadataTable', MetadataTableView);
registerEditComponent('MetadataTable', MetadataTableEdit);
```

### Resolution Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  METADATATABLE FIELDRENDERER RESOLUTION (v12.2.0)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Backend Metadata:                                                           │
│  ─────────────────                                                          │
│  metadata: {                                                                 │
│    viewType: {                                                               │
│      renderType: 'component',                                                │
│      component: 'MetadataTable',       // vizContainer.view                  │
│      dtype: 'jsonb'                                                          │
│    },                                                                        │
│    editType: {                                                               │
│      inputType: 'component',                                                 │
│      component: 'MetadataTable'        // vizContainer.edit                  │
│    }                                                                         │
│  }                                                                           │
│                                                                              │
│  FieldRenderer Resolution (VIEW mode):                                       │
│  ─────────────────────────────────────                                      │
│  1. Check vizContainer.view → 'MetadataTable'                               │
│  2. ViewComponentRegistry.get('MetadataTable') → MetadataTableView          │
│  3. Render <MetadataTableView value={...} />                                │
│                                                                              │
│  FieldRenderer Resolution (EDIT mode):                                       │
│  ─────────────────────────────────────                                      │
│  1. Check vizContainer.edit → 'MetadataTable'                               │
│  2. EditComponentRegistry.get('MetadataTable') → MetadataTableEdit          │
│  3. Render <MetadataTableEdit value={...} onChange={...} />                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### FieldRenderer Usage

```typescript
// EntityInstanceFormContainer.tsx (v12.2.0)
import { FieldRenderer } from '@/lib/fieldRenderer';

{fields.map(field => (
  <FieldRenderer
    key={field.key}
    field={field}                    // { vizContainer: { view: 'MetadataTable', edit: 'MetadataTable' } }
    value={data[field.key]}          // { key1: "value1", key2: 42 }
    isEditing={isEditing}
    onChange={(v) => handleChange(field.key, v)}
  />
))}

// FieldRenderer internally resolves:
// VIEW: ViewComponentRegistry.get('MetadataTable') → MetadataTableView
// EDIT: EditComponentRegistry.get('MetadataTable') → MetadataTableEdit
```

---

## Architectural Truth (v12.2.0)

**Metadata properties control MetadataTable rendering:**

| Metadata | Property | Purpose |
|----------|----------|---------|
| **viewType** | `renderType: 'component'` + `component: 'MetadataTable'` | Controls WHICH component renders (view mode) |
| **editType** | `inputType: 'component'` + `component: 'MetadataTable'` | Controls WHICH component renders (edit mode) |

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  METADATA → FIELDRENDERER RESOLUTION (v12.2.0)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  viewType.metadata:                                                          │
│  ┌────────────────────────────────┐                                          │
│  │ renderType: "component"        │──┐                                       │
│  │ component: "MetadataTable"     │──┼──► vizContainer.view = "MetadataTable"│
│  │ dtype: "jsonb"                 │  │                                       │
│  └────────────────────────────────┘  │                                       │
│                                      │                                       │
│                                      ▼                                       │
│          FieldRenderer (VIEW mode):                                          │
│          ViewComponentRegistry.get('MetadataTable')                          │
│                      │                                                       │
│                      ▼                                                       │
│          <MetadataTableView value={...} isEditing={false} />                │
│                                                                              │
│  editType.metadata:                                                          │
│  ┌────────────────────────────────┐                                          │
│  │ inputType: "component"         │──┐                                       │
│  │ component: "MetadataTable"     │──┼──► vizContainer.edit = "MetadataTable"│
│  └────────────────────────────────┘  │                                       │
│                                      │                                       │
│                                      ▼                                       │
│          FieldRenderer (EDIT mode):                                          │
│          EditComponentRegistry.get('MetadataTable')                          │
│                      │                                                       │
│                      ▼                                                       │
│          <MetadataTableEdit value={...} onChange={...} isEditing={true} />  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Props Interface

```typescript
interface MetadataTableProps {
  /**
   * JSONB value to display/edit - REQUIRED
   * Object with key-value pairs
   */
  value: Record<string, any>;

  /**
   * Callback when metadata changes (required for edit mode)
   * Receives the updated object
   */
  onChange?: (newValue: Record<string, any>) => void;

  /**
   * Enable edit mode with inline editing
   * Default: false (view mode)
   */
  isEditing?: boolean;
}
```

---

## Features

### View Mode (`isEditing={false}`)
- Displays key-value pairs in a compact table
- Color-coded values by type:
  - Purple: boolean (`true`/`false`)
  - Green: number
  - Orange: object/array (JSON)
  - Gray: string
- Shows "No metadata" when empty

### Edit Mode (`isEditing={true}`)
- Inline editing: click on key or value to edit
- Add new key-value pairs via "Add field" button
- Delete existing pairs with hover trash icon
- Type coercion on save:
  - `"true"`/`"false"` → boolean
  - Numeric strings → number
  - `{...}` or `[...]` → parsed JSON
  - Everything else → string
- Keyboard navigation:
  - `Enter` to save
  - `Escape` to cancel
  - `Tab` to move between fields

---

## Visual Design

### Table Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Key              │  Value                      │  Actions  │
├─────────────────────────────────────────────────────────────┤
│  office_id        │  22222222-2222-...          │  🗑️       │
│  task_type        │  process_improvement        │  🗑️       │
│  training_required│  true                       │  🗑️       │
├─────────────────────────────────────────────────────────────┤
│  [+ Add field]                                              │
└─────────────────────────────────────────────────────────────┘
```

### Value Type Colors

| Type | Color | Example |
|------|-------|---------|
| Boolean | `text-purple-600` | `true`, `false` |
| Number | `text-green-600` | `42`, `3.14` |
| Object/Array | `text-orange-600` | `{"key": "value"}` |
| String | `text-dark-600` | `"hello"` |

---

## Integration with EntityInstanceFormContainer

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  DATA FLOW                                                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  API Response                                                            │
│  ─────────────                                                           │
│  {                                                                       │
│    data: {                                                               │
│      metadata: {                  ◄── JSONB value from entity table      │
│        office_id: "uuid",                                                │
│        task_type: "process_improvement",                                 │
│        training_required: true                                           │
│      }                                                                   │
│    },                                                                    │
│    metadata: {                                                           │
│      entityInstanceFormContainer: {                                              │
│        viewType: {                                                       │
│          metadata: {                                                     │
│            dtype: "jsonb",                                               │
│            renderType: "component",                                      │
│            component: "MetadataTable"  ◄── Tells EntityInstanceFormContainer    │
│          }                                                               │
│        },                                                                │
│        editType: {                                                       │
│          metadata: {                                                     │
│            inputType: "component",                                       │
│            component: "MetadataTable"                                    │
│          }                                                               │
│        }                                                                 │
│      }                                                                   │
│    }                                                                     │
│  }                                                                       │
│                                                                          │
│  EntityInstanceFormContainer                                                     │
│  ───────────────────                                                     │
│  // VIEW mode check (before field.type === 'jsonb')                      │
│  if (vizContainer?.view === 'MetadataTable') {                           │
│    return <MetadataTable value={value || {}} isEditing={false} />;       │
│  }                                                                       │
│                                                                          │
│  // EDIT mode check (case 'component':)                                  │
│  if (vizContainer?.edit === 'MetadataTable') {                           │
│    return (                                                              │
│      <MetadataTable                                                      │
│        value={value || {}}                                               │
│        onChange={(newValue) => handleFieldChange(field.key, newValue)}   │
│        isEditing={true}                                                  │
│      />                                                                  │
│    );                                                                    │
│  }                                                                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### EntityInstanceFormContainer Integration (v8.3.2)

```typescript
// EntityInstanceFormContainer.tsx - VIEW mode
// v8.3.2: Check vizContainer.view BEFORE field.type === 'jsonb'
if (vizContainer?.view === 'MetadataTable') {
  return <MetadataTable value={value || {}} isEditing={false} />;
}

// EntityInstanceFormContainer.tsx - EDIT mode
// v8.3.2: Handle inputType === 'component' case
case 'component':
  if (vizContainer?.edit === 'MetadataTable') {
    return (
      <MetadataTable
        value={value || {}}
        onChange={(newValue) => handleFieldChange(field.key, newValue)}
        isEditing={true}
      />
    );
  }
```

---

## Type Coercion Logic

When saving values, MetadataTable automatically coerces types:

```typescript
const handleUpdateValue = (key: string, newVal: string) => {
  let parsedValue: any = newVal;

  try {
    // Boolean detection
    if (newVal === 'true') parsedValue = true;
    else if (newVal === 'false') parsedValue = false;

    // Number detection
    else if (!isNaN(Number(newVal)) && newVal.trim() !== '') {
      parsedValue = Number(newVal);
    }

    // JSON detection
    else if (newVal.startsWith('{') || newVal.startsWith('[')) {
      parsedValue = JSON.parse(newVal);
    }
  } catch (e) {
    // Keep as string if parsing fails
  }

  onChange({ ...metadata, [key]: parsedValue });
};
```

---

## Usage Examples

### Direct Usage

```typescript
import { MetadataTable } from '@/components/shared/entity/MetadataTable';

// View mode
<MetadataTable
  value={{ key1: "value1", key2: 42, key3: true }}
  isEditing={false}
/>

// Edit mode
<MetadataTable
  value={metadata}
  onChange={(newMetadata) => setMetadata(newMetadata)}
  isEditing={true}
/>
```

### Via EntityInstanceFormContainer (Recommended)

```typescript
// Backend sends metadata with viewType/editType
// EntityInstanceFormContainer automatically renders MetadataTable
// when vizContainer.view === 'MetadataTable' or vizContainer.edit === 'MetadataTable'

<EntityInstanceFormContainer
  data={entityData}
  metadata={apiMetadata}
  isEditing={isEditing}
  onChange={handleChange}
/>
```

---

## Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Checking `field.key === 'metadata'` | Use `vizContainer?.view === 'MetadataTable'` |
| Checking `field.type === 'jsonb'` first | Check `vizContainer?.view` BEFORE `field.type` |
| Hardcoding field names | Backend metadata specifies component via `component` property |
| Direct API calls in MetadataTable | Pass data via props from parent component |

---

## Troubleshooting

### MetadataTable Not Rendering

**Symptom:** Raw JSON displayed instead of table

**Cause:** `field.type` derived from `editMeta.inputType` is `'component'`, not `'jsonb'`. The `field.type === 'jsonb'` check is never reached.

**Fix:** EntityInstanceFormContainer must check `vizContainer?.view === 'MetadataTable'` BEFORE checking `field.type`:

```typescript
// CORRECT: Check vizContainer first
if (vizContainer?.view === 'MetadataTable') {
  return <MetadataTable value={value || {}} isEditing={false} />;
}
if (field.type === 'jsonb') { ... }  // Fallback for generic JSONB

// WRONG: field.type check blocks MetadataTable
if (field.type === 'jsonb') {
  if (field.key === 'metadata') { ... }  // Never reached when inputType='component'
}
```

### Edit Mode Not Working

**Symptom:** Clicking on values doesn't open edit mode

**Cause:** `isEditing` prop not passed or `onChange` callback missing

**Fix:** Ensure both props are provided:
```typescript
<MetadataTable
  value={value}
  onChange={(newValue) => handleFieldChange(field.key, newValue)}
  isEditing={true}  // Must be true for edit mode
/>
```

---

**Last Updated:** 2025-12-02 | **Version:** 12.2.0 | **Status:** Production Ready

**Recent Updates:**
- v12.2.0 (2025-12-02):
  - Registered in ViewComponentRegistry and EditComponentRegistry
  - FieldRenderer integration - automatic component resolution
  - Added FieldRenderer Integration section with registration code
  - Updated Architectural Truth to reflect FieldRenderer resolution flow
- v1.0.0 (2025-11-27): Initial documentation
  - Documented v8.3.2 metadata-driven rendering pattern
  - Added integration with EntityInstanceFormContainer
  - Documented type coercion logic
  - Added troubleshooting for common issues
