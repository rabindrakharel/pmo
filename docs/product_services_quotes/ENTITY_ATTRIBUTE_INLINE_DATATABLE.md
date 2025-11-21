# Entity Attribute Inline DataTable - Universal JSON Attribute Renderer

**Created:** 2025-11-02
**Status:** ✅ Implemented and Deployed
**Purpose:** Generic inline-editable table for JSONB/JSON attributes

---

## Overview

EntityAttributeInlineDataTable is a **universal, reusable component** for rendering and editing JSON attributes (JSONB fields) in the PMO platform. It replaces the need for creating separate table components for each JSON field type.

### Key Principle

⚠️ **IMPORTANT:** This component is designed **ONLY for JSON attributes** (JSONB fields), not full entities.

**Use for:**
- ✅ `metadata` JSONB field (key-value pairs)
- ✅ `quote_items` JSONB field (array of line items)
- ✅ Any other JSONB array/object that needs inline editing

**Don't use for:**
- ❌ Full entity tables (use EntityDataTable)
- ❌ Settings management (use SettingsDataTable)
- ❌ Paginated entity lists (use EntityListOfInstancesPage)

---

## Architecture

### Component Hierarchy

```
EntityAttributeInlineDataTable (generic, configurable)
    ├── Based on SettingsDataTable pattern
    ├── Extends DataTableBase (composition)
    └── Configurable columns, renderers, behaviors

Specialized Wrappers (specific implementations)
    ├── MetadataTable (for metadata field)
    └── QuoteItemsRenderer (for quote_items field)
```

### File Structure

```
apps/web/src/components/shared/
├── ui/
│   ├── EntityAttributeInlineDataTable.tsx  ← Generic component
│   ├── SettingsDataTable.tsx               ← Reference pattern
│   └── DataTableBase.tsx                   ← Base table component
└── entity/
    ├── MetadataTable.tsx                   ← Metadata wrapper (existing)
    ├── QuoteItemsRenderer.tsx              ← Quote items wrapper (NEW)
    └── EntityFormContainer.tsx             ← Renders fields, uses wrappers
```

---

## Implementation Details

### 1. EntityAttributeInlineDataTable Component

**Location:** `/apps/web/src/components/shared/ui/EntityAttributeInlineDataTable.tsx`

**Key Features:**
- ✅ Configurable columns via props
- ✅ Custom cell rendering via `renderCell` prop
- ✅ Inline editing (add/edit/delete rows)
- ✅ Drag-and-drop reordering (optional)
- ✅ Sorting (optional)
- ✅ Generic data structure (any JSON)

**Props Interface:**

```typescript
interface EntityAttributeInlineDataTableProps {
  data: AttributeRecord[];                    // Array of JSON objects
  columns: BaseColumn[];                      // Column definitions
  onRowUpdate?: (index: number, updates: Partial<AttributeRecord>) => void;
  onAddRow?: (newRecord: Partial<AttributeRecord>) => void;
  onDeleteRow?: (index: number) => void;
  onReorder?: (reorderedData: AttributeRecord[]) => void;
  renderCell?: (column: BaseColumn, record: AttributeRecord, isEditing: boolean, onUpdate: (field: string, value: any) => void) => React.ReactNode;
  getDefaultNewRow?: () => Partial<AttributeRecord>;
  allowAddRow?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  allowReorder?: boolean;
  emptyMessage?: string;
}
```

**Example Usage:**

```typescript
<EntityAttributeInlineDataTable
  data={items}
  columns={[
    { key: 'name', title: 'Name', sortable: true },
    { key: 'value', title: 'Value', sortable: false }
  ]}
  renderCell={(column, record, isEditing, onUpdate) => {
    // Custom rendering logic
  }}
  onRowUpdate={(index, updates) => { /* handle update */ }}
  onAddRow={(newRow) => { /* handle add */ }}
  onDeleteRow={(index) => { /* handle delete */ }}
  allowAddRow={true}
  allowEdit={true}
  allowDelete={true}
/>
```

---

### 2. QuoteItemsRenderer Component

**Location:** `/apps/web/src/components/shared/entity/QuoteItemsRenderer.tsx`

**Purpose:** Specialized renderer for `quote_items` JSONB field

**Data Structure:**

```typescript
interface QuoteItem {
  item_type: 'service' | 'product';
  item_id: string;
  item_code: string;
  item_name: string;
  quantity: number;
  unit_rate: number;
  line_total: number;
  line_notes?: string;
}
```

**Features:**
- ✅ Service/product dropdown selection (loads from API)
- ✅ Inline quantity editing
- ✅ Automatic line_total calculation (quantity × unit_rate)
- ✅ Type icons (Wrench for services, Package for products)
- ✅ Subtotal row at bottom
- ✅ Add/edit/delete line items
- ✅ Currency formatting (CAD)

**Usage:**

```typescript
<QuoteItemsRenderer
  value={quote.quote_items || []}
  onChange={(newItems) => handleFieldChange('quote_items', newItems)}
  isEditing={true}
/>
```

---

### 3. Integration with EntityFormContainer

**Location:** `/apps/web/src/components/shared/entity/EntityFormContainer.tsx`

**Changes Made:**

1. **Import QuoteItemsRenderer:**
   ```typescript
   import { QuoteItemsRenderer } from './QuoteItemsRenderer';
   ```

2. **View Mode Rendering** (lines 333-340):
   ```typescript
   if (field.type === 'jsonb') {
     // Special renderers for specific JSONB fields
     if (field.key === 'metadata') {
       return <MetadataTable value={value || {}} isEditing={false} />;
     }
     if (field.key === 'quote_items') {
       return <QuoteItemsRenderer value={value || []} isEditing={false} />;
     }
     // Other JSONB fields show as formatted JSON
     ...
   }
   ```

3. **Edit Mode Rendering** (lines 478-497):
   ```typescript
   case 'jsonb':
     // Special renderers for specific JSONB fields in edit mode
     if (field.key === 'metadata') {
       return (
         <MetadataTable
           value={value || {}}
           onChange={(newValue) => onChange(field.key, newValue)}
           isEditing={true}
         />
       );
     }
     if (field.key === 'quote_items') {
       return (
         <QuoteItemsRenderer
           value={value || []}
           onChange={(newValue) => onChange(field.key, newValue)}
           isEditing={true}
         />
       );
     }
     // Other JSONB fields use textarea with JSON
     ...
   ```

---

## Usage Patterns

### Pattern 1: Metadata Field (Key-Value Pairs)

**Entity Config:**
```typescript
fields: [
  { key: 'metadata', label: 'Metadata', type: 'jsonb' }
]
```

**Rendering:** Automatically uses `MetadataTable` (existing)

---

### Pattern 2: Quote Items Field (Line Items)

**Entity Config:**
```typescript
fields: [
  { key: 'quote_items', label: 'Quote Items', type: 'jsonb' }
]
```

**Rendering:** Automatically uses `QuoteItemsRenderer` (new)

---

### Pattern 3: Custom JSONB Field (Generic)

**Entity Config:**
```typescript
fields: [
  { key: 'custom_data', label: 'Custom Data', type: 'jsonb' }
]
```

**Rendering:** Falls back to textarea with formatted JSON (default behavior)

**To Add Custom Renderer:**

1. Create wrapper component (e.g., `CustomDataRenderer.tsx`)
2. Import in `EntityFormContainer.tsx`
3. Add special case in renderField function:
   ```typescript
   if (field.key === 'custom_data') {
     return <CustomDataRenderer value={value} isEditing={isEditing} onChange={...} />;
   }
   ```

---

## Benefits Achieved

### Code Reusability
- ✅ Single generic component for all JSON attributes
- ✅ No need to create separate table components for each field
- ✅ Consistent behavior across all JSONB fields

### Developer Experience
- ✅ Simple to add new JSONB fields
- ✅ Consistent API across all renderers
- ✅ Easy to create specialized wrappers
- ✅ Type-safe interfaces

### User Experience
- ✅ Consistent inline editing UX
- ✅ Specialized renderers for complex fields
- ✅ Automatic field type detection
- ✅ Responsive, accessible tables

---

## Testing

### Manual Testing Checklist

#### Quote Items (http://localhost:5173/quote/:id)

**View Mode:**
- [ ] Quote items display in table format
- [ ] Service icons (Wrench) show for services
- [ ] Product icons (Package) show for products
- [ ] Currency values formatted correctly
- [ ] Subtotal row displays correct total
- [ ] Empty state shows "No line items"

**Edit Mode:**
- [ ] Click Edit button
- [ ] Add new line item using + button
- [ ] Select service/product from dropdown
- [ ] Change quantity - line total updates automatically
- [ ] Delete line item using trash icon
- [ ] Save changes - data persists to database
- [ ] Cancel edit - changes discarded

---

## Comparison with Alternatives

### vs. SettingsDataTable

| Feature | SettingsDataTable | EntityAttributeInlineDataTable |
|---------|-------------------|-------------------------------|
| **Schema** | Fixed (id, name, descr, parent_id, color_code) | Dynamic (configurable columns) |
| **Data Source** | Settings entities | JSON attributes |
| **Rendering** | Fixed cell types | Custom renderCell prop |
| **Use Case** | Settings/datalabel management | Any JSON attribute |

### vs. EntityDataTable

| Feature | EntityDataTable | EntityAttributeInlineDataTable |
|---------|----------------|-------------------------------|
| **Data Type** | Full entities | JSON attributes only |
| **Pagination** | Yes | No (all rows inline) |
| **Filters** | Complex filters | Simple sorting |
| **API Calls** | Direct API integration | Parent handles data |

---

## Future Enhancements

### Potential Improvements

1. **Additional Specialized Renderers:**
   - `TaskUpdatesRenderer` for `task_updates` field
   - `WorkOrderItemsRenderer` for work order line items
   - `FormFieldsRenderer` for form schema visualization

2. **Enhanced Features:**
   - Bulk operations (select multiple rows)
   - Export to CSV/Excel
   - Search/filter within table
   - Column visibility toggles

3. **Performance Optimizations:**
   - Virtualization for large datasets
   - Lazy loading for dropdowns
   - Debounced updates

---

## Migration Guide

### Adding EntityAttributeInlineDataTable to New Entity

**Step 1:** Define JSONB field in entity config:
```typescript
// entityConfig.ts
fields: [
  { key: 'my_items', label: 'My Items', type: 'jsonb' }
]
```

**Step 2:** Create specialized renderer (optional):
```typescript
// MyItemsRenderer.tsx
import { EntityAttributeInlineDataTable } from '../ui/EntityAttributeInlineDataTable';

export function MyItemsRenderer({ value, onChange, isEditing }) {
  const columns = [
    { key: 'name', title: 'Name' },
    { key: 'value', title: 'Value' }
  ];

  return (
    <EntityAttributeInlineDataTable
      data={value || []}
      columns={columns}
      onRowUpdate={(index, updates) => {
        const newData = [...value];
        newData[index] = { ...newData[index], ...updates };
        onChange(newData);
      }}
      allowAddRow={isEditing}
      allowEdit={isEditing}
      allowDelete={isEditing}
    />
  );
}
```

**Step 3:** Register in EntityFormContainer:
```typescript
// EntityFormContainer.tsx
import { MyItemsRenderer } from './MyItemsRenderer';

// In renderField function:
if (field.key === 'my_items') {
  return <MyItemsRenderer value={value} onChange={...} isEditing={isEditing} />;
}
```

---

## Related Documentation

- **[Field Generator Guide](./FIELD_GENERATOR_GUIDE.md)** - How to configure entity fields
- **[Settings System](../settings/settings.md)** - Settings/datalabel architecture
- **[Data Model](../datamodel/datamodel.md)** - Database schema and JSONB fields
- **[Design Patterns Audit](./DESIGN_PATTERNS_AUDIT.md)** - Entity design consistency

---

**Status:** ✅ Complete
**Last Updated:** 2025-11-02
**Author:** PMO Platform Development Team
