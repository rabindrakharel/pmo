# Backend Formatter Service

> **Single source of truth for field metadata generation** - Convention-driven pattern detection that transforms database column names into complete field specifications for frontend rendering.

---

## 1. Semantics & Business Context

### Purpose
The Backend Formatter Service analyzes database column names and generates complete field metadata that drives ALL frontend rendering. The backend is the **single source of truth** for how fields are displayed, formatted, and edited.

### Design Philosophy: Convention Over Configuration

**✅ Column name determines everything** (budget_allocated_amt → currency field)

**✅ Backend generates complete metadata** (renderType, inputType, format, validation)

**✅ Frontend is pure renderer** (no pattern detection, just follows instructions)

**✅ Zero frontend configuration** (add column to DB, frontend auto-adapts)

### Key Benefits

- **Single source of truth** - Backend controls all formatting logic
- **Zero frontend changes** - New field types added in backend only
- **35+ pattern rules** - Comprehensive auto-detection (*_amt, dl__*, *_date, etc.)
- **Cached metadata** - In-memory Map with per-entity caching
- **Type-safe** - Full TypeScript interfaces matching frontend

---

## 2. Tooling & Framework Architecture

### Stack
- **Language**: TypeScript (ESM modules)
- **Pattern Matching**: Wildcard string matching (*, prefix, suffix)
- **Caching**: In-memory Map (per-entity)
- **Integration**: Called from route handlers (LIST/GET endpoints)

### Service Location
```
apps/api/src/services/backend-formatter.service.ts (831 lines)
```

### Core Import
```typescript
import { getEntityMetadata } from '@/services/backend-formatter.service.js';
```

---

## 3. Architecture & System Design

### 3.1 Pattern Detection Flow

```
Database Column Name
        │
        ├─ "budget_allocated_amt"
        │
        ▼
┌──────────────────────────┐
│  Pattern Matcher         │
│  • *_amt → CURRENCY      │
│  • dl__* → BADGE         │
│  • *_date → DATE         │
│  • *_flag → BOOLEAN      │
│  • 35+ patterns...       │
└──────────────────────────┘
        │
        ▼
┌──────────────────────────┐
│  Metadata Generator      │
│  • renderType: currency  │
│  • inputType: currency   │
│  • format: { symbol }    │
│  • editable: true        │
│  • align: right          │
│  • width: 140px          │
└──────────────────────────┘
        │
        ▼
┌──────────────────────────┐
│  Complete Field Metadata │
│  BackendFieldMetadata    │
└──────────────────────────┘
```

### 3.2 Data Flow (Backend → Frontend)

```
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND LAYER                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Route Handler (e.g., GET /api/v1/office)                  │
│         │                                                    │
│         ├─ Execute SQL query                               │
│         │  SELECT id, code, name, budget_allocated_amt...   │
│         │                                                    │
│         ├─ Get sample row (offices[0])                     │
│         │                                                    │
│         ▼                                                    │
│  getEntityMetadata('office', sampleRow)                    │
│         │                                                    │
│         ├─ Analyze each column name                        │
│         ├─ Match against 35+ pattern rules                 │
│         ├─ Generate complete field metadata                │
│         │                                                    │
│         ▼                                                    │
│  Return {                                                   │
│    data: [...],                                            │
│    metadata: {                                             │
│      entity: "office",                                     │
│      fields: [                                             │
│        {                                                    │
│          key: "budget_allocated_amt",                      │
│          label: "Budget Allocated",                        │
│          renderType: "currency",                           │
│          inputType: "currency",                            │
│          format: { symbol: "$", decimals: 2 },            │
│          editable: true,                                   │
│          align: "right",                                   │
│          width: "140px"                                    │
│        },                                                   │
│        ...                                                  │
│      ]                                                      │
│    },                                                       │
│    total, limit, offset                                    │
│  }                                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTTP Response
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                           │
│  (Pure renderer - consumes metadata)                        │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Pattern Rules (35+ Patterns)

#### Financial Patterns
```typescript
'*_amt', '*_cost', '*_price' → currency
  renderType: 'currency'
  format: { symbol: '$', decimals: 2, locale: 'en-CA' }
  align: 'right'
  width: '140px'

'*_pct', '*_rate' → percentage
  renderType: 'percentage'
  format: { decimals: 1, suffix: '%' }
  align: 'right'
```

#### Settings/Badge Patterns
```typescript
'dl__*' → badge (settings-driven)
  renderType: 'badge'
  inputType: 'select'
  loadFromDataLabels: true
  settingsDatalabel: extracted from field name
  component: 'DAGVisualizer' (if *_stage or *_funnel)
```

#### Temporal Patterns
```typescript
'*_date' → date
  renderType: 'date'
  inputType: 'date'
  format: { style: 'friendly' }

'*_ts', '*_at' → timestamp
  renderType: 'timestamp'
  inputType: 'datetime'
  format: { style: 'relative' }
```

#### Boolean Patterns
```typescript
'is_*', '*_flag' → boolean
  renderType: 'boolean'
  inputType: 'checkbox'
  format: { trueLabel: 'Yes', falseLabel: 'No' }
```

#### Reference Patterns
```typescript
'*__employee_id' → entity reference (single)
  renderType: 'reference'
  inputType: 'select'
  loadFromEntity: 'employee'
  endpoint: '/api/v1/entity/employee/entity-instance-lookup'

'*__employee_ids' → entity reference (multiple)
  renderType: 'array'
  inputType: 'multiselect'
  component: 'SearchableMultiSelect'
  loadFromEntity: 'employee'
```

#### Data Structure Patterns
```typescript
'metadata', '*_json' → JSON viewer
  renderType: 'json'
  inputType: 'jsonb'
  component: 'MetadataTable'

'tags', arrays → tags display
  renderType: 'array'
  inputType: 'tags'
  format: { style: 'badges' }
```

### 3.4 Metadata Caching Strategy

```typescript
// In-memory Map (per-entity)
const metadataCache = new Map<string, EntityMetadata>();

// Cache key: entity code
// Cache duration: Until service restart (stateless)
// Cache invalidation: clearMetadataCache(entityCode)
```

**Why Caching?**
- Metadata rarely changes (schema-driven)
- Pattern detection is CPU-intensive
- Same metadata used for all rows in entity
- 100x performance improvement on large lists

### 3.5 Composite Field Auto-Detection

**Purpose**: Automatically detect field pairs and create virtual composite fields for better UX.

#### Detected Patterns

**Pattern 1: Progress Bar** (`start_date` + `end_date`)
```typescript
// Backend detects both fields exist → creates composite
{
  key: "start_date_end_date_composite",
  label: "Progress",
  renderType: "progress-bar",
  component: "ProgressBar",
  composite: true,
  compositeConfig: {
    composedFrom: ["start_date", "end_date"],
    compositeType: "progress-bar",
    showPercentage: true,
    showDates: true,
    highlightOverdue: true
  },
  visible: {
    EntityDataTable: false,       // Too complex for table
    EntityDetailView: true,        // Perfect for detail view
    EntityFormContainer: false,    // Edit source fields instead
    KanbanView: false,
    CalendarView: false
  }
}
```

**Pattern 2: Date Range** (`from_ts` + `to_ts`)
```typescript
{
  key: "from_ts_to_ts_composite",
  label: "Date Range",
  renderType: "date-range",
  component: "DateRangeVisualizer",
  compositeConfig: {
    composedFrom: ["from_ts", "to_ts"],
    compositeType: "date-range"
  },
  visible: {
    EntityDataTable: false,
    EntityDetailView: true,
    EntityFormContainer: false,
    KanbanView: false,
    CalendarView: false
  }
}
```

#### Source Field Visibility Update

When composite field is created, source fields automatically get updated visibility:

```typescript
// start_date visibility becomes:
{
  EntityDataTable: true,          // Show in table
  EntityDetailView: false,        // Hide (composite shows instead)
  EntityFormContainer: true,      // Show in form for editing
  KanbanView: true,
  CalendarView: true
}
```

#### Helper Functions

```typescript
// Create default visibility (all true)
createDefaultVisibility()
→ { EntityDataTable: true, EntityDetailView: true, ... }

// Create composite visibility (only detail view)
createCompositeVisibility()
→ { EntityDataTable: false, EntityDetailView: true, EntityFormContainer: false, ... }

// Create source field visibility (hide from detail)
createSourceFieldVisibility()
→ { EntityDataTable: true, EntityDetailView: false, EntityFormContainer: true, ... }

// Detect composite fields from field names
detectCompositeFields(fieldNames: string[])
→ FieldMetadata[] (array of virtual composite fields)

// Update source field visibility
updateSourceFieldVisibility(fields, compositeFields)
→ Modifies source fields to hide from detail view
```

#### Data Flow

```
1. generateEntityMetadata('project', sampleRow)
         ↓
2. Generate metadata for all regular fields
   (start_date, end_date, budget_allocated_amt, ...)
         ↓
3. detectCompositeFields(['start_date', 'end_date', ...])
   → Creates: start_date_end_date_composite
         ↓
4. updateSourceFieldVisibility(fields, compositeFields)
   → start_date.visible.EntityDetailView = false
   → end_date.visible.EntityDetailView = false
         ↓
5. Return { entity: 'project', fields: [...fields, ...compositeFields] }
```

---

## 4. API Integration Pattern

### 4.1 Route Handler Integration

```typescript
// In any entity route (e.g., office, business, project, task)
import { getEntityMetadata } from '@/services/backend-formatter.service.js';

const ENTITY_CODE = 'office';

// LIST Endpoint
fastify.get('/api/v1/office', async (request, reply) => {
  // 1. Execute your SQL query
  const offices = await db.execute(sql`SELECT * FROM app.office...`);

  // 2. Generate metadata from first row (or empty object)
  const fieldMetadata = offices.length > 0
    ? getEntityMetadata(ENTITY_CODE, offices[0])
    : getEntityMetadata(ENTITY_CODE);

  // 3. Return with metadata
  return {
    ...createPaginatedResponse(offices, total, limit, offset),
    metadata: fieldMetadata
  };
});

// GET Endpoint
fastify.get('/api/v1/office/:id', async (request, reply) => {
  const office = await db.execute(sql`SELECT * FROM app.office WHERE id = ${id}`);

  const fieldMetadata = getEntityMetadata(ENTITY_CODE, office[0]);

  return {
    data: office[0],
    metadata: fieldMetadata
  };
});
```

### 4.2 Response Structure

```typescript
// LIST response
{
  data: [
    { id: "uuid", code: "TOR-01", name: "Toronto Office", budget_allocated_amt: 50000, ... },
    { id: "uuid", code: "MTL-02", name: "Montreal Office", budget_allocated_amt: 75000, ... }
  ],
  metadata: {
    entity: "office",
    label: "Office",
    labelPlural: "Offices",
    fields: [
      {
        key: "id",
        label: "ID",
        renderType: "text",
        visible: {
          EntityDataTable: false,      // Hide system fields from table
          EntityDetailView: true,
          EntityFormContainer: false,
          KanbanView: false,
          CalendarView: false
        },
        ...
      },
      {
        key: "code",
        label: "Code",
        renderType: "text",
        editable: true,
        visible: { EntityDataTable: true, EntityDetailView: true, EntityFormContainer: true, KanbanView: true, CalendarView: true },
        ...
      },
      {
        key: "name",
        label: "Name",
        renderType: "text",
        editable: true,
        visible: { EntityDataTable: true, EntityDetailView: true, EntityFormContainer: true, KanbanView: true, CalendarView: true },
        ...
      },
      {
        key: "budget_allocated_amt",
        label: "Budget Allocated",
        renderType: "currency",
        visible: { EntityDataTable: true, EntityDetailView: true, EntityFormContainer: true, KanbanView: true, CalendarView: true },
        ...
      }
    ],
    primaryKey: "id",
    displayField: "name",
    apiEndpoint: "/api/v1/office",
    generated_at: "2025-01-20T10:30:00Z"
  },
  total: 50,
  limit: 20,
  offset: 0
}

// GET response
{
  data: { id: "uuid", code: "TOR-01", name: "Toronto Office", ... },
  metadata: { entity: "office", fields: [...] }
}
```

---

## 5. Type Definitions

### ComponentVisibility
```typescript
/**
 * Object-based visibility control - Backend tells each component what to show
 * Explicit per-component visibility ensures type-safety and clarity
 */
interface ComponentVisibility {
  EntityDataTable: boolean;        // Data table (list view)
  EntityDetailView: boolean;        // Detail view (single entity)
  EntityFormContainer: boolean;     // Create/edit forms
  KanbanView: boolean;              // Kanban board
  CalendarView: boolean;            // Calendar view
}
```

### CompositeFieldConfig
```typescript
/**
 * Configuration for composite fields derived from multiple source fields
 * Backend auto-detects field pairs and creates virtual composite fields
 */
interface CompositeFieldConfig {
  composedFrom: string[];           // Source field keys (e.g., ['start_date', 'end_date'])
  compositeType: 'progress-bar' | 'date-range' | 'address' | 'full-name' | 'calculated';
  calculation?: string;             // Optional calculation formula
  showPercentage?: boolean;         // Show percentage (progress bars)
  showDates?: boolean;              // Show date labels (progress bars)
  highlightOverdue?: boolean;       // Highlight overdue items (progress bars)
  startField?: string;              // Start field name (date ranges)
  endField?: string;                // End field name (date ranges)
}
```

### BackendFieldMetadata
```typescript
interface BackendFieldMetadata {
  // Identity
  key: string;                    // Column name
  label: string;                  // Display label (auto-generated from key)

  // Type Information
  type: string;                   // High-level category
  dataType?: string;              // SQL data type
  pattern?: PatternType;          // Matched pattern rule
  category?: CategoryType;        // Field category

  // Rendering (View Mode)
  renderType: RenderType;         // How to display: currency, badge, date, progress-bar, etc.
  viewType?: ViewType;            // View variant: badge, table, tags
  component?: ComponentType;      // Special component: DAGVisualizer, MetadataTable, ProgressBar
  format: Record<string, any>;    // Format config: { symbol, decimals, style, compositeType }

  // Input (Edit Mode)
  inputType: InputType;           // Input control: select, currency, date, etc.
  editType?: EditType;            // Edit type variant
  endpoint?: string;              // API endpoint for options
  loadFromDataLabels?: boolean;   // Load from settings table
  loadFromEntity?: string;        // Load from entity (for references)
  settingsDatalabel?: string;     // Settings datalabel key
  options?: Array<{               // Static options
    value: any;
    label: string;
    color?: string;
  }>;

  // Component Visibility (Object-Based) - ✅ NEW in v3.5+
  visible: ComponentVisibility;   // Explicit per-component visibility control
  composite?: boolean;            // Is this a composite field?
  compositeConfig?: CompositeFieldConfig;  // Composite field configuration

  // Behavior
  sortable: boolean;              // Allow sorting
  filterable: boolean;            // Allow filtering
  searchable: boolean;            // Include in search
  align: 'left' | 'right' | 'center';
  width: string;                  // Column width

  // Edit Behavior
  editable: boolean;              // Allow inline editing
  required?: boolean;             // Required field
  validation?: Record<string, any>;
  help?: string;                  // Help text
  placeholder?: string;           // Placeholder text
}
```

### EntityMetadata
```typescript
interface EntityMetadata {
  entity: string;                 // Entity code
  label: string;                  // Singular label
  labelPlural: string;            // Plural label
  icon?: string;                  // UI icon
  fields: BackendFieldMetadata[]; // All field metadata
  primaryKey: string;             // PK field name
  displayField: string;           // Display field name
  apiEndpoint: string;            // API base path
  supportedViews?: string[];      // Supported view modes
  defaultView?: string;           // Default view mode
  generated_at: string;           // Generation timestamp
}
```

---

## 6. Critical Considerations for Developers

### Adding New Pattern Rules

**Edit PATTERN_RULES constant** in `backend-formatter.service.ts`:

```typescript
const PATTERN_RULES: Record<string, PatternRule> = {
  // Add new pattern
  '*_score': {
    type: 'score',
    renderType: 'badge',
    inputType: 'number',
    format: { min: 0, max: 100, color: 'gradient' },
    align: 'center',
    width: '100px',
    pattern: 'SCORE',
    category: 'quantitative'
  },
  // Existing patterns...
};
```

**Frontend automatically adapts** - No frontend changes needed.

### Modifying Entity-Specific Config

**Edit ENTITY_CONFIG constant** for per-entity overrides:

```typescript
const ENTITY_CONFIG: Record<string, Partial<EntityMetadata>> = {
  office: {
    label: 'Office',
    labelPlural: 'Offices',
    icon: 'building',
    supportedViews: ['table', 'grid', 'map'],
    defaultView: 'table'
  }
};
```

### Cache Management

**Clear cache** after schema changes:
```typescript
clearMetadataCache('office');  // Single entity
clearMetadataCache();          // All entities
```

### Performance Tuning

- **Use sample row** - Pass first data row to getEntityMetadata() for better type detection
- **Cache aggressively** - Metadata rarely changes, cache indefinitely
- **Pattern order matters** - More specific patterns should come before generic ones
- **Minimize regex** - Use simple string matching (* wildcards) instead of regex

### Integration Checklist

**When adding metadata to an entity:**
1. ✅ Import `getEntityMetadata` in routes file
2. ✅ Call in LIST endpoint with sample row
3. ✅ Call in GET endpoint with actual row
4. ✅ Return `{ data, metadata, ...pagination }`
5. ✅ Test frontend renders correctly
6. ✅ Verify inline editing works

**⚠️ Common Mistakes:**
- ❌ Forgetting to pass sample row (less accurate detection)
- ❌ Not returning metadata in response envelope
- ❌ Modifying frontend formatter (should never be needed)
- ❌ Hardcoding field configs (defeats convention-driven approach)

---

## 7. Related Services

**Entity Infrastructure Service** - Handles RBAC, linkage, registry (UNCHANGED by metadata architecture)

**Frontend Formatter Service** - Pure renderer that consumes backend metadata

**Universal Filter Builder** - Auto-generates SQL WHERE clauses (separate concern)
