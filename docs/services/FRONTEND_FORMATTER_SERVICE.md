# Frontend Formatter Service

> **Pure renderer** - Consumes backend-provided metadata and renders exactly as instructed. Zero pattern detection, zero field type logic.

---

## 1. Semantics & Business Context

### Purpose
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

## 2. Tooling & Framework Architecture

### Stack
- **Language**: TypeScript + React 19
- **Styling**: Tailwind CSS v4
- **Pattern**: Functional components, pure functions
- **State**: Stateless (all state managed by parent components)

### Service Location
```
apps/web/src/lib/universalFormatterService.tsx (2,390 lines)
```

### Core Imports
```typescript
// Backend metadata consumption (NEW - metadata-driven)
import {
  renderFieldFromMetadata,      // View mode rendering
  renderInputFromMetadata,       // Edit mode rendering
  getFieldMetadataFromResponse,  // Extract field metadata
  hasBackendMetadata             // Type guard
} from '@/lib/universalFormatterService';

// Legacy functions (for backward compatibility with non-metadata entities)
import {
  detectField,                   // Pattern detection (DEPRECATED)
  renderField,                   // Old rendering (DEPRECATED)
  formatFieldValue               // String formatting (still used)
} from '@/lib/universalFormatterService';
```

---

## 3. Architecture & System Design

### 3.1 Metadata Consumption Flow

```
Backend API Response
        │
        ├─ { data: [...], metadata: { fields: [...] } }
        │
        ▼
┌──────────────────────────────────┐
│  hasBackendMetadata(response)    │
│  Type guard: check for metadata  │
└──────────────────────────────────┘
        │
        ├─ TRUE → Metadata-driven mode
        │
        ▼
┌──────────────────────────────────┐
│  getFieldMetadataFromResponse()  │
│  Extract metadata for field      │
└──────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────┐
│  VIEW MODE                       │
│  renderFieldFromMetadata()       │
│  • renderType: currency → $XX    │
│  • renderType: badge → 🟢 badge  │
│  • renderType: date → friendly   │
└──────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────┐
│  EDIT MODE                       │
│  renderInputFromMetadata()       │
│  • inputType: currency → input#  │
│  • inputType: select → dropdown  │
│  • inputType: date → date picker │
└──────────────────────────────────┘
        │
        ▼
    React Element
```

### 3.2 Component Integration Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    EntityMainPage                           │
│  • Fetches data from API                                    │
│  • Stores metadata in state                                 │
│  • Passes metadata down                                     │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ metadata prop
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  FilteredDataTable                          │
│  • Receives metadata from parent                            │
│  • Forwards to EntityDataTable                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ metadata prop
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  EntityDataTable                            │
│  • Generates columns from metadata.fields                   │
│  • Each column uses renderFieldFromMetadata()               │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│        For each field in each row:                          │
│                                                              │
│  const fieldMeta = metadata.fields.find(f => f.key === key) │
│                                                              │
│  VIEW:  renderFieldFromMetadata(value, fieldMeta, record)  │
│  EDIT:  renderInputFromMetadata(value, fieldMeta, onChange)│
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Render Type Mappings (View Mode)

#### renderFieldFromMetadata() Switch Logic

```typescript
switch (metadata.renderType) {
  case 'currency':
    return <span className="font-mono">${formatCurrency(value)}</span>;

  case 'percentage':
    return <span className="font-mono">{value.toFixed(1)}%</span>;

  case 'date':
  case 'timestamp':
    return <span className="text-sm">{formatFriendlyDate(value)}</span>;

  case 'boolean':
    return renderBadge(
      value ? metadata.format.trueLabel : metadata.format.falseLabel,
      value ? metadata.format.trueColor : metadata.format.falseColor
    );

  case 'badge':
    // Settings-driven badge (dl__* fields)
    if (metadata.loadFromSettings && metadata.settingsDatalabel) {
      return renderDataLabelBadge(value, metadata.settingsDatalabel);
    }
    return renderBadge(String(value), 'blue');

  case 'array':
    if (Array.isArray(value)) {
      return (
        <div className="flex flex-wrap gap-1">
          {value.map((item, idx) => (
            <span key={idx} className="badge">{String(item)}</span>
          ))}
        </div>
      );
    }

  case 'link':
    return <a href={value} target="_blank">{value}</a>;

  case 'json':
    return <pre className="json-viewer">{JSON.stringify(value, null, 2)}</pre>;

  case 'text':
  default:
    return <span>{String(value)}</span>;
}
```

### 3.4 Input Type Mappings (Edit Mode)

#### renderInputFromMetadata() Switch Logic

```typescript
switch (metadata.inputType) {
  case 'currency':
  case 'number':
    return (
      <input
        type="number"
        step={metadata.inputType === 'currency' ? '0.01' : '1'}
        value={value ?? ''}
        onChange={(e) => onChange(parseFloat(e.target.value) || null)}
      />
    );

  case 'date':
    return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} />;

  case 'datetime':
    return <input type="datetime-local" value={value} onChange={(e) => onChange(e.target.value)} />;

  case 'checkbox':
    return <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />;

  case 'textarea':
    return <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />;

  case 'select':
    // Settings dropdown (dl__* fields)
    if (metadata.loadFromSettings && metadata.options) {
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select...</option>
          {metadata.options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    }

  case 'multiselect':
  case 'tags':
    return (
      <input
        type="text"
        value={Array.isArray(value) ? value.join(', ') : value}
        onChange={(e) => onChange(e.target.value.split(',').map(v => v.trim()))}
        placeholder="Comma-separated values"
      />
    );

  case 'readonly':
    return <span className="text-gray-500">{formatValueFromMetadata(value, metadata)}</span>;

  case 'text':
  default:
    return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />;
}
```

---

## 4. API Response Handling

### 4.1 Type Guard Pattern

```typescript
// In component
const response = await api.get('/api/v1/office');

if (hasBackendMetadata(response)) {
  // Metadata-driven mode (NEW)
  const fieldMeta = getFieldMetadataFromResponse(response, 'budget_allocated_amt');
  const rendered = renderFieldFromMetadata(50000, fieldMeta);
} else {
  // Legacy mode (fallback for non-metadata entities)
  const fieldMeta = detectField('budget_allocated_amt', 'numeric');
  const rendered = renderField({ fieldKey: 'budget_allocated_amt', value: 50000 });
}
```

### 4.2 EntityDataTable Integration

```typescript
// EntityDataTable.tsx - Metadata-driven column generation
const columns = useMemo(() => {
  // Priority 1: Backend metadata (pure metadata-driven)
  if (metadata?.fields) {
    return metadata.fields
      .filter(fieldMeta => fieldMeta.visible)
      .map(fieldMeta => ({
        key: fieldMeta.key,
        title: fieldMeta.label,
        width: fieldMeta.width,
        align: fieldMeta.align,
        sortable: fieldMeta.sortable,
        editable: fieldMeta.editable,
        // Pure metadata-driven rendering
        render: (value, record) => renderFieldFromMetadata(value, fieldMeta, record)
      }));
  }

  // Priority 2: Explicit columns (legacy overrides)
  if (initialColumns) return initialColumns;

  // Priority 3: Auto-generation (deprecated)
  if (autoGenerateColumns) {
    // Old pattern detection (DEPRECATED)
  }

  return [];
}, [metadata, initialColumns, autoGenerateColumns]);
```

---

## 5. Type Definitions

### API Response Types

```typescript
// Matches backend types from api-factory.ts
interface BackendFieldMetadata {
  key: string;
  label: string;
  type: string;
  dataType?: string;
  format: Record<string, any>;
  renderType: string;         // View mode: currency, badge, date, etc.
  viewType?: string;
  component?: string;
  inputType: string;          // Edit mode: currency, select, date, etc.
  editType?: string;
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
  searchable: boolean;
  editable: boolean;
  required?: boolean;
  align: 'left' | 'right' | 'center';
  width: string;
  endpoint?: string;
  loadFromSettings?: boolean;
  loadFromEntity?: string;
  settingsDatalabel?: string;
  options?: Array<{ value: any; label: string; color?: string }>;
  validation?: Record<string, any>;
  help?: string;
  placeholder?: string;
  pattern?: string;
  category?: string;
}

interface EntityMetadata {
  entity: string;
  label: string;
  labelPlural: string;
  icon?: string;
  fields: BackendFieldMetadata[];
  primaryKey: string;
  displayField: string;
  apiEndpoint: string;
  supportedViews?: string[];
  defaultView?: string;
  generated_at: string;
}

interface ApiResponseWithMetadata {
  data: any;
  metadata?: EntityMetadata;
  total?: number;
  limit?: number;
  offset?: number;
}
```

---

## 6. Function Reference

### Metadata Consumption Functions (NEW)

#### `getFieldMetadataFromResponse(response, fieldKey)`
Extract specific field metadata from API response.

**Returns:** `BackendFieldMetadata | undefined`

#### `getAllFieldMetadataFromResponse(response)`
Get all field metadata as array.

**Returns:** `BackendFieldMetadata[]`

#### `hasBackendMetadata(response)`
Type guard to check if response contains metadata.

**Returns:** `boolean`

### Rendering Functions (NEW - Metadata-Driven)

#### `renderFieldFromMetadata(value, metadata, record?)`
Render field value as React element using backend metadata (view mode).

**Parameters:**
- `value` - Field value to render
- `metadata` - BackendFieldMetadata from API
- `record?` - Optional full record object

**Returns:** `React.ReactNode`

**Render Types:** currency, percentage, date, timestamp, boolean, badge, array, link, json, text

#### `renderInputFromMetadata(value, metadata, onChange, options?)`
Render input control for editing using backend metadata (edit mode).

**Parameters:**
- `value` - Current field value
- `metadata` - BackendFieldMetadata from API
- `onChange` - Callback function: `(newValue: any) => void`
- `options?` - Optional: `{ required, disabled, className }`

**Returns:** `React.ReactNode`

**Input Types:** currency, number, date, datetime, time, checkbox, textarea, select, multiselect, tags, readonly, text

### Value Formatting Functions

#### `formatValueFromMetadata(value, metadata)`
Format value as string using backend metadata (for display/export).

**Returns:** `string`

### Legacy Functions (DEPRECATED)

These functions are **deprecated** and should only be used for entities that haven't been migrated to metadata-driven architecture:

- `detectField()` - Pattern detection (OLD)
- `renderField()` - Old rendering (OLD)
- `renderFieldDisplay()` - Old display (OLD)
- `renderFieldView()` - Old view mode (OLD)
- `renderFieldEdit()` - Old edit mode (OLD)

**Migration Path:** Update backend routes to return metadata, then replace legacy calls with metadata-driven functions.

---

## 7. Critical Considerations for Developers

### Adding New Render/Input Types

**DO NOT add to frontend** - Add to backend formatter service instead.

**Example (WRONG):**
```typescript
// ❌ Do not add cases to renderFieldFromMetadata()
case 'new-type':  // NO!
```

**Example (CORRECT):**
```typescript
// ✅ Add to backend-formatter.service.ts PATTERN_RULES
'*_score': {
  renderType: 'badge',  // Uses existing render type
  inputType: 'number',  // Uses existing input type
  format: { min: 0, max: 100, color: 'gradient' }
}
// Frontend automatically supports it
```

### Component Integration Checklist

**When building new components:**
1. ✅ Accept `metadata` prop from parent
2. ✅ Use `hasBackendMetadata()` type guard
3. ✅ Call `renderFieldFromMetadata()` for view mode
4. ✅ Call `renderInputFromMetadata()` for edit mode
5. ✅ Never call `detectField()` or old functions

### Testing Metadata-Driven Rendering

```typescript
// Test view mode
const mockMetadata: BackendFieldMetadata = {
  key: 'budget_allocated_amt',
  renderType: 'currency',
  format: { symbol: '$', decimals: 2 },
  // ... other required fields
};

const rendered = renderFieldFromMetadata(50000, mockMetadata);
// Expect: <span className="font-mono">$50,000.00</span>

// Test edit mode
const handleChange = jest.fn();
const input = renderInputFromMetadata(50000, mockMetadata, handleChange);
// Expect: <input type="number" step="0.01" value={50000} ... />
```

### Performance Considerations

- **Metadata is immutable** - Safe to cache at component level
- **Memoize columns** - Use `useMemo()` for column generation
- **Avoid inline functions** - `renderFieldFromMetadata` is already optimized
- **Settings badges** - Pre-load colors with `preloadSettingsColors()`

### Common Integration Patterns

**Pattern 1: Table Rendering**
```typescript
// Generate columns from metadata
const columns = metadata.fields
  .filter(f => f.visible)
  .map(fieldMeta => ({
    key: fieldMeta.key,
    title: fieldMeta.label,
    render: (value, record) => renderFieldFromMetadata(value, fieldMeta, record)
  }));
```

**Pattern 2: Form Generation**
```typescript
// Generate form inputs from metadata
{metadata.fields
  .filter(f => f.editable)
  .map(fieldMeta => (
    <div key={fieldMeta.key}>
      <label>{fieldMeta.label}</label>
      {renderInputFromMetadata(
        formData[fieldMeta.key],
        fieldMeta,
        (newValue) => setFormData({ ...formData, [fieldMeta.key]: newValue })
      )}
    </div>
  ))
}
```

**Pattern 3: Detail View**
```typescript
// Render key-value pairs
{metadata.fields
  .filter(f => f.visible)
  .map(fieldMeta => (
    <div key={fieldMeta.key} className="detail-row">
      <dt>{fieldMeta.label}</dt>
      <dd>{renderFieldFromMetadata(data[fieldMeta.key], fieldMeta, data)}</dd>
    </div>
  ))
}
```

---

## 8. Migration from Legacy Pattern Detection

### Before (Legacy - Pattern Detection)
```typescript
// ❌ OLD: Frontend detects field types
const fieldMeta = detectField('budget_allocated_amt', 'numeric');
const rendered = renderField({
  fieldKey: 'budget_allocated_amt',
  value: 50000,
  mode: 'view'
});
```

### After (Metadata-Driven)
```typescript
// ✅ NEW: Backend provides metadata, frontend renders
const fieldMeta = getFieldMetadataFromResponse(response, 'budget_allocated_amt');
const rendered = renderFieldFromMetadata(50000, fieldMeta);
```

### Migration Checklist

**Backend (Required):**
1. ✅ Add `getEntityMetadata()` call in route handler
2. ✅ Return `{ data, metadata }` in response
3. ✅ Test API returns metadata

**Frontend (Required):**
1. ✅ Accept `metadata` prop in component
2. ✅ Replace `detectField()` with `getFieldMetadataFromResponse()`
3. ✅ Replace `renderField()` with `renderFieldFromMetadata()`
4. ✅ Replace edit mode with `renderInputFromMetadata()`
5. ✅ Test rendering matches original

**Frontend (Optional):**
1. ⚪ Remove unused `detectField` imports (after full migration)
2. ⚪ Remove `autoGenerateColumns` prop (after full migration)
3. ⚪ Remove `dataTypes` prop (after full migration)

---

## 9. Related Services

**Backend Formatter Service** - Generates metadata from database schema (single source of truth)

**Entity Infrastructure Service** - Handles RBAC, linkage, registry (separate concern, UNCHANGED)

**Entity Config** - Legacy field configurations (being phased out in favor of metadata)
