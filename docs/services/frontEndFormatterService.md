# Frontend Formatter Service

> **Pure renderer** - Consumes backend-provided metadata and renders exactly as instructed. Zero pattern detection, zero field type logic.

**File**: `apps/web/src/lib/frontEndFormatterService.tsx` (646 lines)

---

## 1. Purpose

The Frontend Formatter Service is a **pure rendering engine** that transforms backend metadata into React elements. It has **ZERO** business logic for determining field types, formats, or behavior—all intelligence lives in the backend.

### Design Philosophy: Pure Renderer Pattern

**✅ Backend sends complete instructions** (metadata with renderType, inputType, format)

**✅ Frontend executes instructions exactly** (no interpretation, no decisions)

**✅ Zero pattern detection** (no column name analysis)

**✅ Zero configuration** (no field mappings, no type definitions)

### Key Benefits

- **Single responsibility** - Rendering only, no logic
- **Zero maintenance** - New field types added in backend only
- **Type-safe** - BackendFieldMetadata interface from API
- **Testable** - Pure functions (metadata in, React element out)
- **Predictable** - Same metadata always produces same output

---

## 2. Core Functions

### View Mode Rendering

```typescript
import { renderViewModeFromMetadata } from '@/lib/frontEndFormatterService';

// Backend metadata drives rendering
renderViewModeFromMetadata(value, metadata, record?)
// Returns: React element based on metadata.renderType
```

**Render Types Supported** (11 types):
- `'text'` - Plain text
- `'currency'` - Formatted currency ($50,000.00)
- `'percentage'` - Percentage with decimals (75.5%)
- `'date'` - Friendly date (Jan 15, 2025)
- `'timestamp'` - Relative time (2 hours ago)
- `'boolean'` - Badge with true/false labels
- `'badge'` - Colored badge (from datalabels or direct)
- `'array'` - Array of badges
- `'link'` - Clickable hyperlink
- `'json'` - JSON viewer
- `'reference'` - Entity reference (displays name)

### Edit Mode Rendering

```typescript
import { renderEditModeFromMetadata } from '@/lib/frontEndFormatterService';

// Backend metadata drives edit control
renderEditModeFromMetadata(value, metadata, onChange, options?)
// Returns: Form control based on metadata.inputType
```

**Input Types Supported** (11 types):
- `'text'` - Text input
- `'textarea'` - Multi-line text
- `'number'` - Numeric input
- `'currency'` - Currency input (step=0.01)
- `'date'` - Date picker
- `'datetime'` - DateTime picker
- `'checkbox'` - Boolean toggle
- `'select'` - Dropdown (with datalabel options)
- `'multiselect'` - Multi-select dropdown
- `'file'` - File upload
- `'reference'` - Entity reference dropdown

---

## 3. Backend-Driven Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. BACKEND API                                                  │
│    const fieldMetadata = getEntityMetadata('project', record);  │
│    return { data: [...], metadata: fieldMetadata };             │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. API RESPONSE WITH METADATA                                   │
│    {                                                            │
│      data: [{ budget_allocated_amt: 50000 }],                   │
│      metadata: {                                                │
│        entity: "project",                                       │
│        fields: [{                                               │
│          key: "budget_allocated_amt",                           │
│          renderType: "currency",                                │
│          inputType: "currency",                                 │
│          format: { symbol: "$", decimals: 2 }                   │
│        }]                                                       │
│      }                                                          │
│    }                                                            │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. FRONTEND - EntityDataTable                                  │
│    import { renderViewModeFromMetadata } from '@/lib/frontEndFormatterService';
│                                                                 │
│    const columns = metadata.fields.map(fieldMeta => ({         │
│      key: fieldMeta.key,                                        │
│      render: (value, record) =>                                 │
│        renderViewModeFromMetadata(value, fieldMeta, record)     │
│    }));                                                         │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. RENDERED OUTPUT                                              │
│    VIEW MODE: <span className="font-mono">$50,000.00</span>    │
│    EDIT MODE: <input type="number" step="0.01" />              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Component Integration

### EntityDataTable Integration

```typescript
// apps/web/src/components/shared/ui/EntityDataTable.tsx
import {
  renderViewModeFromMetadata,
  renderEditModeFromMetadata
} from '@/lib/frontEndFormatterService';

// Priority 1: Backend Metadata (PURE METADATA-DRIVEN)
const columns = useMemo(() => {
  if (metadata?.fields) {
    return metadata.fields
      .filter(f => f.visible.EntityDataTable === true)
      .map(fieldMeta => ({
        key: fieldMeta.key,
        title: fieldMeta.label,
        backendMetadata: fieldMeta,  // Store for rendering
        // Backend tells frontend how to render
        render: (value, record) =>
          renderViewModeFromMetadata(value, fieldMeta, record)
      }));
  }
  return [];
}, [metadata]);

// Edit mode uses same metadata
const handleEdit = (value, onChange) => {
  const backendMeta = column.backendMetadata;
  return renderEditModeFromMetadata(value, backendMeta, onChange);
};
```

### FilteredDataTable Integration

```typescript
// apps/web/src/components/shared/dataTable/FilteredDataTable.tsx
import {
  transformForApi,
  transformFromApi,
  loadSettingsColors
} from '@/lib/frontEndFormatterService';

// Only imports transform utilities - NO pattern detection
// Delegates rendering to EntityDataTable/SettingsDataTable
```

---

## 5. Helper Functions

### Data Transformation

```typescript
// Transform frontend data for API submission
transformForApi(data: Record<string, any>, originalRecord?: Record<string, any>)
// • Converts comma-separated strings → arrays
// • Validates and formats dates
// • Handles null/undefined values

// Transform API data for frontend display
transformFromApi(data: Record<string, any>)
// • Converts arrays → comma-separated strings (for editing)
// • Formats dates for form inputs
```

### Value Formatting

```typescript
// Format currency values
formatCurrency(value: number, currency = 'CAD'): string
// Example: 50000 → "$50,000.00"

// Format relative timestamps
formatRelativeTime(dateString: string | Date): string
// Example: "2025-01-17T10:00:00Z" → "2 hours ago"

// Format friendly dates
formatFriendlyDate(dateString: string | Date): string
// Example: "2025-01-17" → "Jan 17, 2025"
```

### Badge Rendering

```typescript
// Render colored badge (generic)
renderBadge(value: string, color?: string): React.Element
// Example: renderBadge("Active", "green") → <Badge color="green">Active</Badge>

// Render datalabel badge (settings-driven)
renderDataLabelBadge(value: string, datalabel: string, metadata?: BackendFieldMetadata)
// Example: renderDataLabelBadge("planning", "project_stage")
// → Fetches color from settings cache → <Badge color="blue">Planning</Badge>
```

### Settings Color Management

```typescript
// Load colors for datalabel badges
loadSettingsColors(datalabels: string[]): Promise<void>
// • Fetches settings from /api/v1/entity/:entityCode/entity-instance-lookup
// • Caches color mappings in memory
// • Used by EntityDataTable for preloading badge colors

// Get cached color for datalabel value
getSettingColor(datalabel: string, value: string): string | undefined
// Example: getSettingColor("project_stage", "planning") → "blue"
```

---

## 6. Backend Metadata Interface

### BackendFieldMetadata Structure

```typescript
interface BackendFieldMetadata {
  key: string;                    // Field key (column name)
  label: string;                  // Display label
  renderType: RenderType;         // View mode type
  inputType: InputType;           // Edit mode type
  format?: {                      // Optional format config
    symbol?: string;              // Currency symbol
    decimals?: number;            // Decimal places
    trueLabel?: string;           // Boolean true label
    falseLabel?: string;          // Boolean false label
    trueColor?: string;           // Boolean true color
    falseColor?: string;          // Boolean false color
  };
  visible: ComponentVisibility;   // Per-component visibility
  editable: boolean;              // Can edit in inline mode
  sortable?: boolean;             // Sortable column
  filterable?: boolean;           // Filterable column
  align?: 'left' | 'center' | 'right';
  width?: string;
  loadFromDataLabels?: boolean;   // Load options from datalabel
  settingsDatalabel?: string;     // Datalabel name
  loadFromEntity?: string;        // Load from entity lookup
  accept?: string;                // File upload accept types
  colorMap?: Record<string, string>; // Color mappings
}
```

### ComponentVisibility Object

```typescript
interface ComponentVisibility {
  EntityDataTable: boolean;       // Show in data table
  EntityDetailView: boolean;      // Show in detail view
  EntityFormContainer: boolean;   // Show in form
  KanbanView: boolean;            // Show in kanban
  CalendarView: boolean;          // Show in calendar
}
```

---

## 7. Render Type Examples

### Currency

```typescript
// Backend metadata
{ renderType: 'currency', format: { symbol: '$', decimals: 2 } }

// Rendered output
<span className="font-mono text-right">$50,000.00</span>
```

### Badge (Datalabel-Driven)

```typescript
// Backend metadata
{
  renderType: 'badge',
  loadFromDataLabels: true,
  settingsDatalabel: 'project_stage',
  colorMap: { "planning": "blue", "execution": "yellow" }
}

// Rendered output (color from backend)
<Badge color="blue">Planning</Badge>
```

### Date

```typescript
// Backend metadata
{ renderType: 'date' }

// Rendered output
<span className="text-sm text-gray-600">Jan 17, 2025</span>
```

### Boolean

```typescript
// Backend metadata
{
  renderType: 'boolean',
  format: {
    trueLabel: 'Active',
    falseLabel: 'Inactive',
    trueColor: 'green',
    falseColor: 'red'
  }
}

// Rendered output
<Badge color="green">Active</Badge>
```

### Array

```typescript
// Backend metadata
{ renderType: 'array' }

// Rendered output
<div className="flex flex-wrap gap-1">
  <Badge>Tag1</Badge>
  <Badge>Tag2</Badge>
</div>
```

---

## 8. Input Type Examples

### Currency Input

```typescript
// Backend metadata
{ inputType: 'currency', format: { symbol: '$', decimals: 2 } }

// Rendered edit control
<input
  type="number"
  step="0.01"
  value={value}
  onChange={onChange}
  className="..."
/>
```

### Select (Datalabel Options)

```typescript
// Backend metadata
{
  inputType: 'select',
  loadFromDataLabels: true,
  settingsDatalabel: 'project_stage'
}

// Rendered edit control (options loaded from datalabel)
<ColoredDropdown
  value={value}
  options={settingsOptions}  // From loadFieldOptions()
  onChange={onChange}
/>
```

### Date Picker

```typescript
// Backend metadata
{ inputType: 'date' }

// Rendered edit control
<input
  type="date"
  value={value}
  onChange={onChange}
  className="..."
/>
```

### Checkbox

```typescript
// Backend metadata
{ inputType: 'checkbox' }

// Rendered edit control
<input
  type="checkbox"
  checked={!!value}
  onChange={onChange}
  className="..."
/>
```

---

## 9. Type Guards & Utilities

### Check for Backend Metadata

```typescript
import { hasBackendMetadata } from '@/lib/frontEndFormatterService';

// Type guard to check if response includes metadata
if (hasBackendMetadata(response)) {
  // response.metadata is available
  const fieldMeta = response.metadata.fields.find(f => f.key === 'budget_allocated_amt');
}
```

### Extract Field Metadata

```typescript
import { getFieldMetadataFromResponse } from '@/lib/frontEndFormatterService';

// Extract metadata for specific field
const fieldMeta = getFieldMetadataFromResponse(response, 'budget_allocated_amt');
if (fieldMeta) {
  const rendered = renderViewModeFromMetadata(value, fieldMeta);
}
```

### Get All Field Metadata

```typescript
import { getAllFieldMetadataFromResponse } from '@/lib/frontEndFormatterService';

// Extract all field metadata
const allFields = getAllFieldMetadataFromResponse(response);
// Returns: BackendFieldMetadata[]
```

---

## 10. Critical Implementation Rules

### ✅ DO - Current Patterns

```typescript
// ✅ Import from frontEndFormatterService (current name)
import { renderViewModeFromMetadata } from '@/lib/frontEndFormatterService';

// ✅ Use backend metadata for all rendering
const backendMeta = column.backendMetadata as BackendFieldMetadata;
return renderViewModeFromMetadata(value, backendMeta, record);

// ✅ Check metadata before rendering
if (metadata?.fields) {
  // Use backend metadata
}

// ✅ Store backend metadata in columns
backendMetadata: fieldMeta

// ✅ Use helper functions for specific formatting
formatCurrency(value);
formatFriendlyDate(date);
```

### ❌ DON'T - Deprecated Patterns

```typescript
// ❌ DON'T import from universalFormatterService (old name)
import { ... } from '@/lib/universalFormatterService';  // ❌ RENAMED

// ❌ DON'T use deprecated pattern detection functions (PURGED)
detectField(columnKey);                                  // ❌ REMOVED
renderField({ fieldKey, value });                        // ❌ REMOVED
renderFieldView(value);                                  // ❌ REMOVED
renderFieldEdit(value);                                  // ❌ REMOVED
formatFieldValue(value);                                 // ❌ REMOVED
getFieldCapability(columnKey);                           // ❌ REMOVED

// ❌ DON'T detect field types in frontend (backend's job)
if (columnKey.includes('_amt')) { ... }                  // ❌ WRONG

// ❌ DON'T hardcode field type decisions
const isEditable = columnKey !== 'id';                   // ❌ WRONG (use metadata.editable)
```

---

## 11. Performance Optimizations

1. **5-Minute Settings Cache** - `settingsCache` prevents redundant API calls
2. **Color Cache** - `settingsColorCache` for O(1) color lookups
3. **Parallel Preloading** - All datalabel colors load simultaneously
4. **Pure Functions** - Memoizable, predictable rendering
5. **Conditional Loading** - Only load options when needed

---

## 12. Integration Status

### Integrated Components (Use Backend Metadata)

✅ **EntityDataTable** - Full backend metadata integration
✅ **EntityDetailView** - Uses renderViewModeFromMetadata
✅ **EntityFormContainer** - Uses renderEditModeFromMetadata
✅ **FilteredDataTable** - Passes metadata to EntityDataTable

### Components Without Pattern Detection

✅ **SettingsDataTable** - Only uses renderDataLabelBadge
✅ **ColoredDropdown** - Pure component, no pattern detection
✅ **DAGVisualizer** - No pattern detection

---

## 13. Key Files

| File | Purpose |
|------|---------|
| `apps/web/src/lib/frontEndFormatterService.tsx` | Main service (646 lines) |
| `apps/web/src/components/shared/ui/EntityDataTable.tsx` | Primary consumer |
| `apps/web/src/components/shared/dataTable/FilteredDataTable.tsx` | Wrapper |
| `apps/api/src/services/backend-formatter.service.ts` | Metadata generator |

---

## Summary

**Architecture**: Pure Backend-Driven Renderer

```
Backend: Generate metadata (getEntityMetadata)
         ↓
API: Return { data, metadata }
         ↓
Frontend: Consume metadata
         ↓
Renderer: renderViewModeFromMetadata / renderEditModeFromMetadata
         ↓
React: Render exactly as instructed
```

**Key Principles:**
- ✅ Zero pattern detection in frontend
- ✅ Backend metadata is single source of truth
- ✅ Pure rendering functions (metadata in, React element out)
- ✅ Type-safe with BackendFieldMetadata interface

**Status:** ✅ Production Ready - v4.0 Backend Metadata Architecture
**Last Updated:** 2025-11-20 - All deprecated functions purged
