# Unified API Response Format - Production Specification

**Version**: 2.0
**Date**: 2025-01-19
**Status**: Production Ready

---

## 1. Complete Field Metadata Structure

Based on current `frontEndFormatterService.tsx` implementation:

```typescript
interface FieldMetadata {
  // === IDENTIFICATION ===
  key: string;                          // Column name (e.g., "budget_allocated_amt")
  label: string;                        // Human-readable label (e.g., "Budget Allocated")

  // === TYPE & FORMAT ===
  type: FieldType;                      // Field type: currency, date, badge, reference, etc.
  dataType?: string;                    // Database data type (varchar, numeric, uuid, etc.)
  format: FormatConfig;                 // Type-specific formatting configuration

  // === RENDERING (View Mode) ===
  renderType: RenderType;               // Display renderer for tables/detail views
  viewType: ViewType;                   // Display type variant
  component?: ComponentType;            // Special component override

  // === INPUT (Edit Mode) ===
  inputType: InputType;                 // Input type for forms
  editType?: EditType;                  // Edit mode input component

  // === BEHAVIOR ===
  visible: boolean;                     // Show in default views?
  sortable: boolean;                    // Can table sort by this column?
  filterable: boolean;                  // Can be filtered?
  searchable: boolean;                  // Included in text search?
  editable: boolean;                    // Can user edit this field?
  required?: boolean;                   // Required in forms?

  // === LAYOUT ===
  align: 'left' | 'right' | 'center';   // Table cell alignment
  width: string;                        // Column width (e.g., "120px", "auto")

  // === OPTIONS (for dropdowns/selects) ===
  endpoint?: string;                    // API endpoint for dynamic options
  loadFromSettings?: boolean;           // Load from settings table (dl__* fields)
  loadFromEntity?: string;              // Load from entity (for references)
  settingsDatalabel?: string;           // Datalabel name for settings
  options?: StaticOption[];             // Static options (small lists)

  // === TRANSFORMATION ===
  toApi?: (value: any) => any;          // Transform frontend → API
  toDisplay?: (value: any) => any;      // Transform API → frontend

  // === VALIDATION ===
  validation?: ValidationRules;         // Validation rules

  // === HELP ===
  help?: string;                        // Help text for forms
  placeholder?: string;                 // Placeholder text for inputs

  // === PATTERN METADATA ===
  pattern?: PatternType;                // Detection pattern matched
  category?: CategoryType;              // Field category
}

// === TYPES (from frontEndFormatterService.tsx) ===

type FieldType =
  | 'text' | 'currency' | 'percentage' | 'date' | 'timestamp'
  | 'boolean' | 'reference' | 'array-reference' | 'badge'
  | 'json' | 'url' | 'uuid';

type RenderType =
  | 'text' | 'badge' | 'currency' | 'percentage' | 'date' | 'timestamp'
  | 'boolean' | 'json' | 'array' | 'dag' | 'link' | 'truncated';

type ViewType =
  | 'text' | 'badge' | 'tags' | 'link' | 'json-viewer';

type InputType =
  | 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'time'
  | 'select' | 'multiselect' | 'checkbox' | 'textarea' | 'richtext'
  | 'tags' | 'jsonb' | 'file' | 'dag-select' | 'readonly';

type EditType =
  | 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'time'
  | 'select' | 'multiselect' | 'checkbox' | 'textarea'
  | 'tags' | 'jsonb' | 'datatable' | 'file' | 'dag-select';

type ComponentType =
  | 'DAGVisualizer'           // For dl__*_stage (workflow visualization)
  | 'MetadataTable'           // For metadata JSONB fields
  | 'TagsInput'               // For array fields
  | 'DateRangeVisualizer'     // For date range pairs
  | 'FileUpload'              // For file fields
  | 'RichTextEditor'          // For rich text content
  | 'SearchableMultiSelect';  // For large multiselect lists

type PatternType =
  | 'CURRENCY' | 'PERCENTAGE' | 'TIMESTAMP' | 'DATE' | 'BOOLEAN'
  | 'FOREIGN_KEY' | 'COUNT' | 'DATALABEL' | 'STANDARD'
  | 'JSONB' | 'ARRAY' | 'SYSTEM' | 'UNKNOWN';

type CategoryType =
  | 'identity' | 'financial' | 'temporal' | 'reference' | 'boolean'
  | 'quantitative' | 'standard' | 'structured' | 'system' | 'content';

interface FormatConfig {
  // Currency
  symbol?: string;                      // e.g., "$", "€"
  decimals?: number;                    // Decimal places
  locale?: string;                      // Locale for formatting

  // Date/Time
  style?: 'short' | 'long' | 'relative' | 'datetime';
  timeZone?: string;

  // Badge (dl__* fields)
  loadFromSettings?: boolean;           // Load colors from settings
  colorMap?: Record<string, string>;    // Static color mapping

  // Boolean
  trueLabel?: string;                   // Label for true
  falseLabel?: string;                  // Label for false
  trueColor?: string;                   // Badge color for true
  falseColor?: string;                  // Badge color for false

  // Reference
  entity?: string;                      // Referenced entity code
  displayField?: string;                // Field to display (usually 'name')
}

interface StaticOption {
  value: string | number | boolean;
  label: string;
  color?: string;                       // For badges
  icon?: string;                        // For enhanced display
  order?: number;                       // Display order
}

interface ValidationRules {
  min?: number;                         // Minimum value (numeric/date)
  max?: number;                         // Maximum value (numeric/date)
  minLength?: number;                   // Minimum string length
  maxLength?: number;                   // Maximum string length
  pattern?: string;                     // Regex pattern
  custom?: string;                      // Custom validation function name
}

interface EntityMetadata {
  entity: string;                       // Entity code (project, task, business, office)
  label: string;                        // Human-readable entity name
  labelPlural: string;                  // Plural form
  icon?: string;                        // Icon name/class
  fields: FieldMetadata[];              // Array of field metadata
  primaryKey: string;                   // Primary key field (usually "id")
  displayField: string;                 // Field to use for display (usually "name")
  apiEndpoint: string;                  // Base API endpoint
  supportedViews?: string[];            // Supported views (table, kanban, calendar, grid)
  defaultView?: string;                 // Default view
  generated_at: string;                 // ISO timestamp
}
```

---

## 2. Universal Component Library (Production)

Based on current `frontEndFormatterService.tsx` and component files:

### 2.1 RenderType → Component Mapping

| RenderType | Component/Renderer | File Path | Usage |
|------------|-------------------|-----------|-------|
| `text` | Plain text renderer | Built-in | Standard text fields |
| `badge` | `<Badge>` with color mapping | Built-in | dl__* fields, boolean flags |
| `currency` | `formatCurrency()` → `"$50,000.00"` | `lib/frontEndFormatterService.tsx` | *_amt, *_price, *_cost |
| `percentage` | `formatPercentage()` → `"75.0%"` | `lib/frontEndFormatterService.tsx` | *_pct, *_rate |
| `date` | `formatFriendlyDate()` → `"Jan 15, 2025"` | `lib/frontEndFormatterService.tsx` | *_date fields |
| `timestamp` | `formatRelativeTime()` → `"2 hours ago"` | `lib/frontEndFormatterService.tsx` | *_ts, created_ts, updated_ts |
| `boolean` | `formatBooleanBadge()` | `lib/frontEndFormatterService.tsx` | active_flag, is_* fields |
| `json` | `<MetadataTable>` | `components/shared/entity/MetadataTable.tsx` | metadata JSONB fields |
| `array` | `formatTagsList()` → Tags display | `lib/frontEndFormatterService.tsx` | Array fields, *_ids |
| `dag` | `<DAGVisualizer>` | `components/workflow/DAGVisualizer.tsx` | dl__*_stage fields |
| `link` | `<a>` element | Built-in | URL fields |
| `truncated` | Truncated text with "..." | Built-in | Long text fields (descr) |

### 2.2 ComponentType → React Component

| ComponentType | React Component | File Path | Usage |
|---------------|----------------|-----------|-------|
| `DAGVisualizer` | `<DAGVisualizer>` | `components/workflow/DAGVisualizer.tsx` | dl__*_stage (workflow stages) |
| `MetadataTable` | `<MetadataTable>` | `components/shared/entity/MetadataTable.tsx` | metadata JSONB field |
| `TagsInput` | `<EditableTags>` | `components/shared/ui/EditableTags.tsx` | Array fields (edit mode) |
| `DateRangeVisualizer` | `<DateRangeVisualizer>` | `components/shared/ui/DateRangeVisualizer.tsx` | Date range pairs |
| `FileUpload` | `<DragDropFileUpload>` | `components/shared/file/DragDropFileUpload.tsx` | File upload fields |
| `RichTextEditor` | `<ModularEditor>` | `components/shared/editor/ModularEditor.tsx` | Rich text content |
| `SearchableMultiSelect` | `<SearchableMultiSelect>` | `components/shared/ui/SearchableMultiSelect.tsx` | Large multiselect lists |

### 2.3 InputType → Form Component

| InputType | Component | File Path | Usage |
|-----------|-----------|-----------|-------|
| `text` | `<input type="text">` | Built-in | Standard text fields |
| `number` | `<input type="number">` | Built-in | Numeric fields |
| `currency` | `<input type="number">` + formatter | Built-in | *_amt fields |
| `date` | `<input type="date">` | Built-in | Date fields |
| `datetime` | `<input type="datetime-local">` | Built-in | Timestamp fields |
| `time` | `<input type="time">` | Built-in | Time fields |
| `select` | `<DataLabelSelect>` | `components/shared/ui/DataLabelSelect.tsx` | Dropdown (single) - for dl__* |
| `select` | `<EntitySelect>` | `components/shared/ui/EntitySelect.tsx` | Dropdown (single) - for references |
| `multiselect` | `<MultiSelect>` | `components/shared/ui/MultiSelect.tsx` | Dropdown (multiple) - small lists |
| `multiselect` | `<SearchableMultiSelect>` | `components/shared/ui/SearchableMultiSelect.tsx` | Dropdown (multiple) - large lists |
| `checkbox` | `<input type="checkbox">` | Built-in | Boolean fields |
| `textarea` | `<textarea>` | Built-in | Long text (descr) |
| `richtext` | `<ModularEditor>` | `components/shared/editor/ModularEditor.tsx` | Rich content |
| `tags` | `<EditableTags>` | `components/shared/ui/EditableTags.tsx` | Array fields |
| `jsonb` | `<MetadataTable>` | `components/shared/entity/MetadataTable.tsx` | JSONB fields |
| `file` | `<DragDropFileUpload>` | `components/shared/file/DragDropFileUpload.tsx` | File uploads |
| `dag-select` | `<DataLabelSelect>` + DAG viz | `components/shared/ui/DataLabelSelect.tsx` | Workflow stages |
| `readonly` | Read-only display | Built-in | System fields |

### 2.4 EditType → Edit Mode Component

| EditType | Component | File Path | Usage |
|----------|-----------|-----------|-------|
| `text` | `<InlineEditField>` | `components/shared/view/InlineEditField.tsx` | Editable text |
| `number` | `<InlineEditField>` | `components/shared/view/InlineEditField.tsx` | Numeric edit |
| `currency` | `<InlineEditField>` | `components/shared/view/InlineEditField.tsx` | Money edit |
| `date` | `<InlineEditField>` | `components/shared/view/InlineEditField.tsx` | Date edit |
| `datetime` | `<InlineEditField>` | `components/shared/view/InlineEditField.tsx` | Timestamp edit |
| `time` | `<InlineEditField>` | `components/shared/view/InlineEditField.tsx` | Time edit |
| `select` | `<InlineEditField>` | `components/shared/view/InlineEditField.tsx` | Single select edit |
| `multiselect` | `<InlineEditField>` | `components/shared/view/InlineEditField.tsx` | Multi-select edit |
| `checkbox` | `<InlineEditField>` | `components/shared/view/InlineEditField.tsx` | Boolean edit |
| `textarea` | `<InlineEditField>` | `components/shared/view/InlineEditField.tsx` | Long text edit |
| `tags` | Inline tags editor | `components/shared/ui/EditableTags.tsx` | Array edit |
| `jsonb` | Modal metadata editor | `components/shared/entity/MetadataTable.tsx` | JSONB edit |
| `datatable` | Inline data table | `components/shared/ui/EntityListOfInstancesTable.tsx` | Complex nested data |
| `file` | File upload modal | `components/shared/file/DragDropFileUpload.tsx` | File edit |
| `dag-select` | Inline stage selector | `components/shared/ui/DataLabelSelect.tsx` | Workflow edit |

---

## 3. Field Type Detection Patterns (Backend)

Based on column naming conventions:

```typescript
// Pattern matching rules (backend formatter service)
const DETECTION_PATTERNS = {
  // === CURRENCY ===
  '*_amt': {
    type: 'currency',
    renderType: 'currency',
    inputType: 'currency',
    align: 'right',
    width: '140px',
    pattern: 'CURRENCY',
    category: 'financial'
  },
  '*_price': {
    type: 'currency',
    renderType: 'currency',
    inputType: 'currency',
    align: 'right',
    width: '120px',
    pattern: 'CURRENCY',
    category: 'financial'
  },
  '*_cost': {
    type: 'currency',
    renderType: 'currency',
    inputType: 'currency',
    align: 'right',
    width: '120px',
    pattern: 'CURRENCY',
    category: 'financial'
  },

  // === PERCENTAGE ===
  '*_pct': {
    type: 'percentage',
    renderType: 'percentage',
    inputType: 'number',
    align: 'right',
    width: '100px',
    pattern: 'PERCENTAGE',
    category: 'quantitative'
  },
  '*_rate': {
    type: 'percentage',
    renderType: 'percentage',
    inputType: 'number',
    align: 'right',
    width: '100px',
    pattern: 'PERCENTAGE',
    category: 'quantitative'
  },

  // === DATE/TIME ===
  '*_date': {
    type: 'date',
    renderType: 'date',
    inputType: 'date',
    format: { style: 'short' },
    align: 'left',
    width: '120px',
    pattern: 'DATE',
    category: 'temporal'
  },
  '*_ts': {
    type: 'timestamp',
    renderType: 'timestamp',
    inputType: 'readonly',
    format: { style: 'relative' },
    align: 'left',
    width: '120px',
    pattern: 'TIMESTAMP',
    category: 'temporal'
  },
  'created_ts': {
    type: 'timestamp',
    renderType: 'timestamp',
    inputType: 'readonly',
    format: { style: 'datetime' },
    align: 'left',
    width: '160px',
    visible: true,
    pattern: 'TIMESTAMP',
    category: 'temporal'
  },
  'updated_ts': {
    type: 'timestamp',
    renderType: 'timestamp',
    inputType: 'readonly',
    format: { style: 'datetime' },
    align: 'left',
    width: '160px',
    visible: true,
    pattern: 'TIMESTAMP',
    category: 'temporal'
  },
  'from_ts': {
    type: 'timestamp',
    renderType: 'timestamp',
    inputType: 'readonly',
    format: { style: 'relative' },
    align: 'left',
    width: '120px',
    visible: false,
    pattern: 'TIMESTAMP',
    category: 'temporal'
  },
  'to_ts': {
    type: 'timestamp',
    renderType: 'timestamp',
    inputType: 'readonly',
    format: { style: 'relative' },
    align: 'left',
    width: '120px',
    visible: false,
    pattern: 'TIMESTAMP',
    category: 'temporal'
  },

  // === BOOLEAN ===
  '*_flag': {
    type: 'boolean',
    renderType: 'boolean',
    viewType: 'badge',
    inputType: 'checkbox',
    align: 'center',
    width: '100px',
    pattern: 'BOOLEAN',
    category: 'boolean'
  },
  'is_*': {
    type: 'boolean',
    renderType: 'boolean',
    viewType: 'badge',
    inputType: 'checkbox',
    align: 'center',
    width: '100px',
    pattern: 'BOOLEAN',
    category: 'boolean'
  },

  // === BADGE (Settings) ===
  'dl__*': {
    type: 'badge',
    renderType: 'badge',
    viewType: 'badge',
    inputType: 'select',
    editType: 'select',
    loadFromSettings: true,
    align: 'left',
    width: '140px',
    pattern: 'DATALABEL',
    category: 'standard',
    // Check if stage/funnel for DAG component
    component: (fieldKey) =>
      fieldKey.includes('_stage') || fieldKey.includes('_funnel')
        ? 'DAGVisualizer'
        : undefined
  },

  // === REFERENCE (Foreign Keys) ===
  '*__employee_id': {
    type: 'reference',
    renderType: 'text',
    inputType: 'select',
    format: { entity: 'employee', displayField: 'name' },
    loadFromEntity: 'employee',
    endpoint: '/api/v1/entity/employee/entity-instance',
    align: 'left',
    width: '150px',
    pattern: 'FOREIGN_KEY',
    category: 'reference'
  },
  '*__employee_ids': {
    type: 'array-reference',
    renderType: 'array',
    viewType: 'tags',
    inputType: 'multiselect',
    component: 'SearchableMultiSelect',
    format: { entity: 'employee', displayField: 'name' },
    loadFromEntity: 'employee',
    endpoint: '/api/v1/entity/employee/entity-instance',
    align: 'left',
    width: 'auto',
    sortable: false,
    pattern: 'ARRAY',
    category: 'reference'
  },
  '*_id': {
    type: 'reference',
    renderType: 'text',
    inputType: 'select',
    // Auto-detect entity from field name prefix
    align: 'left',
    width: '150px',
    pattern: 'FOREIGN_KEY',
    category: 'reference'
  },

  // === URL ===
  '*_url': {
    type: 'url',
    renderType: 'link',
    viewType: 'link',
    inputType: 'text',
    align: 'left',
    width: 'auto',
    pattern: 'STANDARD',
    category: 'reference'
  },

  // === JSON ===
  'metadata': {
    type: 'json',
    renderType: 'json',
    viewType: 'json-viewer',
    inputType: 'jsonb',
    component: 'MetadataTable',
    visible: false,
    editable: false,
    align: 'left',
    width: 'auto',
    pattern: 'JSONB',
    category: 'structured'
  },

  // === SYSTEM ===
  'id': {
    type: 'uuid',
    renderType: 'text',
    inputType: 'readonly',
    visible: false,
    sortable: false,
    editable: false,
    align: 'left',
    width: 'auto',
    pattern: 'SYSTEM',
    category: 'identity'
  },
  'version': {
    type: 'text',
    renderType: 'text',
    inputType: 'readonly',
    visible: false,
    sortable: false,
    editable: false,
    align: 'right',
    width: '80px',
    pattern: 'SYSTEM',
    category: 'system'
  },

  // === STANDARD ===
  'code': {
    type: 'text',
    renderType: 'text',
    inputType: 'text',
    align: 'left',
    width: '120px',
    visible: true,
    sortable: true,
    searchable: true,
    pattern: 'STANDARD',
    category: 'identity'
  },
  'name': {
    type: 'text',
    renderType: 'text',
    inputType: 'text',
    align: 'left',
    width: 'auto',
    visible: true,
    sortable: true,
    searchable: true,
    pattern: 'STANDARD',
    category: 'identity'
  },
  'descr': {
    type: 'text',
    renderType: 'truncated',
    inputType: 'textarea',
    align: 'left',
    width: 'auto',
    visible: true,
    sortable: false,
    searchable: true,
    pattern: 'STANDARD',
    category: 'content'
  }
};
```

---

## 4. Complete API Response Example (Project Entity)

```json
{
  "data": [
    {
      "id": "93106ffb-402e-43a7-8b26-5287e37a1b0e",
      "code": "DT-2024-001",
      "name": "Digital Transformation Initiative 2024",
      "descr": "Comprehensive digital transformation project...",
      "metadata": { "project_type": "strategic", "priority": "high" },
      "dl__project_stage": "In Progress",
      "budget_allocated_amt": 750000.00,
      "budget_spent_amt": 285000.00,
      "planned_start_date": "2024-01-15",
      "planned_end_date": "2024-12-31",
      "actual_start_date": "2024-01-20",
      "actual_end_date": null,
      "manager__employee_id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
      "manager__employee_id_NAME": "James Miller",
      "sponsor__employee_id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
      "sponsor__employee_id_NAME": "James Miller",
      "stakeholder__employee_ids": ["8260b1b0-5efc-4611-ad33-ee76c0cf7f13"],
      "stakeholder__employee_ids_NAMES": ["James Miller"],
      "active_flag": true,
      "from_ts": "2024-01-10T10:00:00Z",
      "to_ts": null,
      "created_ts": "2024-01-10T10:00:00Z",
      "updated_ts": "2024-11-19T12:00:00Z",
      "version": 5
    }
  ],

  "metadata": {
    "entity": "project",
    "label": "Project",
    "labelPlural": "Projects",
    "icon": "briefcase",
    "primaryKey": "id",
    "displayField": "name",
    "apiEndpoint": "/api/v1/project",
    "supportedViews": ["table", "kanban", "grid"],
    "defaultView": "table",
    "fields": [
      {
        "key": "dl__project_stage",
        "label": "Project Stage",
        "type": "badge",
        "dataType": "text",
        "format": {
          "loadFromSettings": true,
          "colorMap": {
            "Planning": "gray",
            "Initiation": "blue",
            "In Progress": "yellow",
            "Execution": "orange",
            "Completed": "green",
            "On Hold": "red"
          }
        },
        "renderType": "badge",
        "viewType": "badge",
        "inputType": "select",
        "editType": "select",
        "component": "DAGVisualizer",
        "visible": true,
        "sortable": true,
        "filterable": true,
        "searchable": false,
        "editable": true,
        "required": true,
        "align": "left",
        "width": "140px",
        "loadFromSettings": true,
        "settingsDatalabel": "dl__project_stage",
        "endpoint": "/api/v1/datalabel?name=dl__project_stage",
        "options": [
          { "value": "Planning", "label": "Planning", "color": "gray", "order": 1 },
          { "value": "Initiation", "label": "Initiation", "color": "blue", "order": 2 },
          { "value": "In Progress", "label": "In Progress", "color": "yellow", "order": 3 },
          { "value": "Execution", "label": "Execution", "color": "orange", "order": 4 },
          { "value": "Completed", "label": "Completed", "color": "green", "order": 5 },
          { "value": "On Hold", "label": "On Hold", "color": "red", "order": 6 }
        ],
        "help": "Current stage in the project lifecycle",
        "pattern": "DATALABEL",
        "category": "standard"
      },

      {
        "key": "budget_allocated_amt",
        "label": "Budget Allocated",
        "type": "currency",
        "dataType": "numeric",
        "format": { "symbol": "$", "decimals": 2, "locale": "en-CA" },
        "renderType": "currency",
        "viewType": "text",
        "inputType": "currency",
        "editType": "number",
        "visible": true,
        "sortable": true,
        "filterable": true,
        "searchable": false,
        "editable": true,
        "required": false,
        "align": "right",
        "width": "140px",
        "validation": { "min": 0, "max": 100000000 },
        "help": "Total budget allocated for this project",
        "placeholder": "0.00",
        "pattern": "CURRENCY",
        "category": "financial"
      },

      {
        "key": "stakeholder__employee_ids",
        "label": "Stakeholders",
        "type": "array-reference",
        "dataType": "uuid[]",
        "format": { "entity": "employee", "displayField": "name" },
        "renderType": "array",
        "viewType": "tags",
        "inputType": "multiselect",
        "editType": "multiselect",
        "component": "SearchableMultiSelect",
        "visible": true,
        "sortable": false,
        "filterable": false,
        "searchable": false,
        "editable": true,
        "required": false,
        "align": "left",
        "width": "auto",
        "loadFromEntity": "employee",
        "endpoint": "/api/v1/entity/employee/entity-instance",
        "help": "Key stakeholders for this project",
        "pattern": "ARRAY",
        "category": "reference"
      }
    ],
    "generated_at": "2025-01-19T12:00:00.000Z"
  },

  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

---

## 5. Frontend Rendering Decision Logic

```typescript
// Frontend formatter service
function renderField(
  value: any,
  metadata: FieldMetadata,
  record?: any
): React.ReactNode {
  // STEP 1: Check for special component
  if (metadata.component) {
    switch (metadata.component) {
      case 'DAGVisualizer':
        return <DAGVisualizer value={value} />;
      case 'MetadataTable':
        return <MetadataTable data={value} />;
      case 'TagsInput':
        return <EditableTags tags={value} />;
      case 'DateRangeVisualizer':
        return <DateRangeVisualizer start={record.start} end={record.end} />;
      case 'SearchableMultiSelect':
        return <SearchableMultiSelect values={value} />;
    }
  }

  // STEP 2: Check renderType
  switch (metadata.renderType) {
    case 'badge':
      return renderDataLabelBadge(value, metadata.settingsDatalabel);

    case 'currency':
      return <span>{formatCurrency(value)}</span>;

    case 'percentage':
      return <span>{formatPercentage(value)}</span>;

    case 'date':
      return <span>{formatFriendlyDate(value)}</span>;

    case 'timestamp':
      if (metadata.format.style === 'relative') {
        return <span>{formatRelativeTime(value)}</span>;
      }
      return <span>{formatTimestamp(value)}</span>;

    case 'boolean':
      return formatBooleanBadge(value, metadata.format);

    case 'array':
      return formatTagsList(value);

    case 'link':
      return <a href={value} target="_blank">{value}</a>;

    case 'truncated':
      return <span title={value}>{truncate(value, 100)}</span>;

    default:
      return <span>{value}</span>;
  }
}
```

---

## 6. Key Changes from v1.0

1. ✅ **Changed `optionsEndpoint` → `endpoint`** (consistent naming)
2. ✅ **Added production components** (DAGVisualizer, MetadataTable, SearchableMultiSelect)
3. ✅ **Added pattern & category** (from universalFormatterService)
4. ✅ **Added dataType** (database column type)
5. ✅ **Aligned with current codebase** (renderType, inputType, editType)
6. ✅ **Added complete component library** (with file paths)
7. ✅ **Documented actual components in use** (DataLabelSelect, EntitySelect, InlineEditField)

---

**End of Unified API Response Format - Production Specification**
