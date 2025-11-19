# Unified API Response Format - Complete Specification

**Version**: 1.0
**Date**: 2025-01-19
**Status**: Final Design

---

## 1. Complete Field Metadata Structure

Every field in the metadata includes ALL information the frontend needs to make rendering decisions:

```typescript
interface FieldMetadata {
  // === IDENTIFICATION ===
  key: string;                          // Column name (e.g., "budget_allocated_amt")
  label: string;                        // Human-readable label (e.g., "Budget Allocated")

  // === TYPE & FORMAT ===
  type: string;                         // Field type: currency, date, badge, reference, etc.
  format: Record<string, any>;          // Type-specific formatting config

  // === RENDERING ===
  editType: string;                     // Input type for forms: number, select, date, toggle, readonly
  viewType: string;                     // Display type for tables: text, badge, tags, link, json-viewer
  widget: WidgetConfig | null;          // Advanced widget (progress-bar, date-range-progress)

  // === BEHAVIOR ===
  editable: boolean;                    // Can user edit this field?
  sortable: boolean;                    // Can table sort by this column?
  visible: boolean;                     // Show in default views?
  required?: boolean;                   // Required in forms?

  // === LAYOUT ===
  align: 'left' | 'right' | 'center';   // Table cell alignment
  width?: string;                       // Suggested column width (e.g., "120px", "auto")

  // === OPTIONS (for dropdowns) ===
  optionsEndpoint?: string;             // API endpoint for dropdown options
  options?: Array<{                     // Static options (small lists)
    value: string | number;
    label: string;
    color?: string;                     // For badges
  }>;

  // === VIEW-SPECIFIC COMPONENTS ===
  component?: {
    dataTable?: string;                 // Component override for EntityDataTable
    entityFormContainer?: string;       // Component override for EntityFormContainer
    entityDetailPage?: string;          // Component override for EntityDetailPage
    kanbanBoard?: string;               // Component override for KanbanBoard
  };

  // === VALIDATION ===
  validation?: {
    min?: number;                       // Minimum value (numeric/date)
    max?: number;                       // Maximum value (numeric/date)
    minLength?: number;                 // Minimum string length
    maxLength?: number;                 // Maximum string length
    pattern?: string;                   // Regex pattern
    custom?: string;                    // Custom validation rule name
  };

  // === HELP TEXT ===
  help?: string;                        // Help text for forms
  placeholder?: string;                 // Placeholder text for inputs
}

interface WidgetConfig {
  type: string;                         // Widget type identifier
  config: Record<string, any>;          // Widget-specific configuration
}

interface EntityMetadata {
  entity: string;                       // Entity code (project, task, business, office)
  label: string;                        // Human-readable entity name
  labelPlural: string;                  // Plural form
  icon?: string;                        // Icon name/class
  fields: FieldMetadata[];              // Array of field metadata
  primaryKey: string;                   // Primary key field (usually "id")
  displayField: string;                 // Field to use for display (usually "name")
  generated_at: string;                 // ISO timestamp
}
```

---

## 2. Complete API Response Example (Project Entity)

```json
{
  "data": [
    {
      "id": "93106ffb-402e-43a7-8b26-5287e37a1b0e",
      "code": "DT-2024-001",
      "name": "Digital Transformation Initiative 2024",
      "descr": "Comprehensive digital transformation project to modernize operations...",
      "metadata": {
        "project_type": "strategic",
        "priority": "high",
        "complexity": "high"
      },
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
    "fields": [
      {
        "key": "id",
        "label": "ID",
        "type": "uuid",
        "format": {},
        "editType": "readonly",
        "viewType": "text",
        "widget": null,
        "editable": false,
        "sortable": false,
        "visible": false,
        "align": "left"
      },

      {
        "key": "code",
        "label": "Code",
        "type": "text",
        "format": {},
        "editType": "text",
        "viewType": "text",
        "widget": null,
        "editable": true,
        "sortable": true,
        "visible": true,
        "required": true,
        "align": "left",
        "width": "120px",
        "validation": {
          "maxLength": 50,
          "pattern": "^[A-Z0-9-]+$"
        },
        "help": "Unique project code (e.g., DT-2024-001)",
        "placeholder": "Enter project code"
      },

      {
        "key": "name",
        "label": "Project Name",
        "type": "text",
        "format": {},
        "editType": "text",
        "viewType": "text",
        "widget": null,
        "editable": true,
        "sortable": true,
        "visible": true,
        "required": true,
        "align": "left",
        "width": "auto",
        "validation": {
          "maxLength": 200,
          "minLength": 3
        },
        "help": "Full project name",
        "placeholder": "Enter project name"
      },

      {
        "key": "descr",
        "label": "Description",
        "type": "text",
        "format": {},
        "editType": "textarea",
        "viewType": "text",
        "widget": null,
        "editable": true,
        "sortable": false,
        "visible": true,
        "required": false,
        "align": "left",
        "help": "Detailed project description",
        "placeholder": "Enter project description"
      },

      {
        "key": "dl__project_stage",
        "label": "Project Stage",
        "type": "badge",
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
        "editType": "select",
        "viewType": "badge",
        "widget": null,
        "editable": true,
        "sortable": true,
        "visible": true,
        "required": true,
        "align": "left",
        "width": "140px",
        "optionsEndpoint": "/api/v1/entity/project/entity-instance-lookup?field=dl__project_stage",
        "options": [
          { "value": "Planning", "label": "Planning", "color": "gray" },
          { "value": "Initiation", "label": "Initiation", "color": "blue" },
          { "value": "In Progress", "label": "In Progress", "color": "yellow" },
          { "value": "Execution", "label": "Execution", "color": "orange" },
          { "value": "Completed", "label": "Completed", "color": "green" },
          { "value": "On Hold", "label": "On Hold", "color": "red" }
        ],
        "component": {
          "kanbanBoard": "KanbanColumn",
          "entityDetailPage": "StageTimeline"
        },
        "help": "Current stage in the project lifecycle"
      },

      {
        "key": "budget_allocated_amt",
        "label": "Budget Allocated",
        "type": "currency",
        "format": {
          "symbol": "$",
          "decimals": 2,
          "locale": "en-US"
        },
        "editType": "number",
        "viewType": "text",
        "widget": null,
        "editable": true,
        "sortable": true,
        "visible": true,
        "required": false,
        "align": "right",
        "width": "140px",
        "validation": {
          "min": 0,
          "max": 100000000
        },
        "help": "Total budget allocated for this project",
        "placeholder": "0.00"
      },

      {
        "key": "budget_spent_amt",
        "label": "Budget Spent",
        "type": "currency",
        "format": {
          "symbol": "$",
          "decimals": 2,
          "locale": "en-US"
        },
        "editType": "number",
        "viewType": "text",
        "widget": {
          "type": "progress-bar",
          "config": {
            "maxField": "budget_allocated_amt",
            "currentField": "budget_spent_amt",
            "showPercentage": true,
            "showValues": true,
            "color": "orange",
            "warningThreshold": 80,
            "dangerThreshold": 100,
            "label": "Budget Progress"
          }
        },
        "editable": true,
        "sortable": true,
        "visible": true,
        "required": false,
        "align": "right",
        "width": "180px",
        "validation": {
          "min": 0
        },
        "component": {
          "dataTable": "ProgressBarCell",
          "entityDetailPage": "BudgetProgressWidget"
        },
        "help": "Amount of budget spent to date"
      },

      {
        "key": "planned_start_date",
        "label": "Planned Start Date",
        "type": "date",
        "format": {
          "style": "short",
          "locale": "en-US"
        },
        "editType": "date",
        "viewType": "text",
        "widget": {
          "type": "date-range-progress",
          "config": {
            "startField": "planned_start_date",
            "endField": "planned_end_date",
            "showPercentage": true,
            "showDaysRemaining": true,
            "color": "blue",
            "label": "Planned Timeline"
          }
        },
        "editable": true,
        "sortable": true,
        "visible": true,
        "required": false,
        "align": "left",
        "width": "140px",
        "component": {
          "dataTable": "DateRangeProgressCell",
          "entityDetailPage": "TimelineWidget"
        },
        "help": "Planned project start date"
      },

      {
        "key": "planned_end_date",
        "label": "Planned End Date",
        "type": "date",
        "format": {
          "style": "short",
          "locale": "en-US"
        },
        "editType": "date",
        "viewType": "text",
        "widget": {
          "type": "date-range-progress",
          "config": {
            "startField": "planned_start_date",
            "endField": "planned_end_date",
            "showPercentage": true,
            "showDaysRemaining": true,
            "color": "blue",
            "label": "Planned Timeline"
          }
        },
        "editable": true,
        "sortable": true,
        "visible": true,
        "required": false,
        "align": "left",
        "width": "140px",
        "validation": {
          "custom": "endDateAfterStartDate"
        },
        "component": {
          "dataTable": "DateRangeProgressCell",
          "entityDetailPage": "TimelineWidget"
        },
        "help": "Planned project end date"
      },

      {
        "key": "actual_start_date",
        "label": "Actual Start Date",
        "type": "date",
        "format": {
          "style": "short",
          "locale": "en-US"
        },
        "editType": "date",
        "viewType": "text",
        "widget": {
          "type": "date-range-progress",
          "config": {
            "startField": "actual_start_date",
            "endField": "actual_end_date",
            "showPercentage": true,
            "showDaysRemaining": true,
            "color": "green",
            "label": "Actual Timeline"
          }
        },
        "editable": true,
        "sortable": true,
        "visible": true,
        "required": false,
        "align": "left",
        "width": "140px",
        "help": "Actual project start date"
      },

      {
        "key": "actual_end_date",
        "label": "Actual End Date",
        "type": "date",
        "format": {
          "style": "short",
          "locale": "en-US"
        },
        "editType": "date",
        "viewType": "text",
        "widget": {
          "type": "date-range-progress",
          "config": {
            "startField": "actual_start_date",
            "endField": "actual_end_date",
            "showPercentage": true,
            "showDaysRemaining": true,
            "color": "green",
            "label": "Actual Timeline"
          }
        },
        "editable": true,
        "sortable": true,
        "visible": true,
        "required": false,
        "align": "left",
        "width": "140px",
        "help": "Actual project completion date"
      },

      {
        "key": "manager__employee_id",
        "label": "Manager",
        "type": "reference",
        "format": {
          "entity": "employee",
          "displayField": "name"
        },
        "editType": "select",
        "viewType": "text",
        "widget": null,
        "editable": true,
        "sortable": true,
        "visible": true,
        "required": false,
        "align": "left",
        "width": "150px",
        "optionsEndpoint": "/api/v1/entity/employee/entity-instance-lookup",
        "help": "Project manager responsible for execution"
      },

      {
        "key": "sponsor__employee_id",
        "label": "Sponsor",
        "type": "reference",
        "format": {
          "entity": "employee",
          "displayField": "name"
        },
        "editType": "select",
        "viewType": "text",
        "widget": null,
        "editable": true,
        "sortable": true,
        "visible": true,
        "required": false,
        "align": "left",
        "width": "150px",
        "optionsEndpoint": "/api/v1/entity/employee/entity-instance-lookup",
        "help": "Executive sponsor for the project"
      },

      {
        "key": "stakeholder__employee_ids",
        "label": "Stakeholders",
        "type": "array-reference",
        "format": {
          "entity": "employee",
          "displayField": "name"
        },
        "editType": "multiselect",
        "viewType": "tags",
        "widget": null,
        "editable": true,
        "sortable": false,
        "visible": true,
        "required": false,
        "align": "left",
        "width": "auto",
        "optionsEndpoint": "/api/v1/entity/employee/entity-instance-lookup",
        "component": {
          "dataTable": "TagsCell",
          "entityFormContainer": "MultiSelectTags"
        },
        "help": "Key stakeholders for this project"
      },

      {
        "key": "active_flag",
        "label": "Active",
        "type": "boolean",
        "format": {
          "trueLabel": "Active",
          "falseLabel": "Inactive",
          "trueColor": "green",
          "falseColor": "gray"
        },
        "editType": "toggle",
        "viewType": "badge",
        "widget": null,
        "editable": true,
        "sortable": true,
        "visible": true,
        "required": false,
        "align": "center",
        "width": "100px",
        "help": "Whether this project is currently active"
      },

      {
        "key": "metadata",
        "label": "Metadata",
        "type": "json",
        "format": {},
        "editType": "readonly",
        "viewType": "json-viewer",
        "widget": null,
        "editable": false,
        "sortable": false,
        "visible": false,
        "align": "left"
      },

      {
        "key": "from_ts",
        "label": "Valid From",
        "type": "timestamp",
        "format": {
          "style": "relative-time"
        },
        "editType": "readonly",
        "viewType": "text",
        "widget": null,
        "editable": false,
        "sortable": true,
        "visible": false,
        "align": "left",
        "width": "120px"
      },

      {
        "key": "to_ts",
        "label": "Valid To",
        "type": "timestamp",
        "format": {
          "style": "relative-time"
        },
        "editType": "readonly",
        "viewType": "text",
        "widget": null,
        "editable": false,
        "sortable": true,
        "visible": false,
        "align": "left",
        "width": "120px"
      },

      {
        "key": "created_ts",
        "label": "Created",
        "type": "timestamp",
        "format": {
          "style": "datetime",
          "locale": "en-US"
        },
        "editType": "readonly",
        "viewType": "text",
        "widget": null,
        "editable": false,
        "sortable": true,
        "visible": true,
        "align": "left",
        "width": "160px"
      },

      {
        "key": "updated_ts",
        "label": "Last Updated",
        "type": "timestamp",
        "format": {
          "style": "datetime",
          "locale": "en-US"
        },
        "editType": "readonly",
        "viewType": "text",
        "widget": null,
        "editable": false,
        "sortable": true,
        "visible": true,
        "align": "left",
        "width": "160px"
      },

      {
        "key": "version",
        "label": "Version",
        "type": "numeric",
        "format": {
          "decimals": 0
        },
        "editType": "readonly",
        "viewType": "text",
        "widget": null,
        "editable": false,
        "sortable": false,
        "visible": false,
        "align": "right",
        "width": "80px"
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

## 3. All Field Types Across All Entities

### Business Entity

| Field | Type | Widget | Component Overrides |
|-------|------|--------|---------------------|
| `code` | text | - | - |
| `name` | text | - | - |
| `descr` | text | - | - |
| `active_flag` | boolean | - | dataTable: "BooleanBadge" |
| `office_id` | reference | - | - |
| `current_headcount` | numeric | - | - |
| `operational_status` | text | - | dataTable: "StatusBadge" |

### Office Entity

| Field | Type | Widget | Component Overrides |
|-------|------|--------|---------------------|
| `code` | text | - | - |
| `name` | text | - | - |
| `address_line1` | text | - | - |
| `address_line2` | text | - | - |
| `city` | text | - | - |
| `province` | text | - | - |
| `postal_code` | text | - | - |
| `country` | text | - | - |
| `phone` | text | - | dataTable: "PhoneLink" |
| `email` | text | - | dataTable: "EmailLink" |
| `office_type` | text | - | - |
| `capacity_employees` | numeric | - | - |
| `square_footage` | numeric | - | - |

### Project Entity

| Field | Type | Widget | Component Overrides |
|-------|------|--------|---------------------|
| `dl__project_stage` | badge | - | kanbanBoard: "KanbanColumn", entityDetailPage: "StageTimeline" |
| `budget_allocated_amt` | currency | - | - |
| `budget_spent_amt` | currency | progress-bar | dataTable: "ProgressBarCell", entityDetailPage: "BudgetProgressWidget" |
| `planned_start_date` | date | date-range-progress | dataTable: "DateRangeProgressCell", entityDetailPage: "TimelineWidget" |
| `planned_end_date` | date | date-range-progress | dataTable: "DateRangeProgressCell", entityDetailPage: "TimelineWidget" |
| `actual_start_date` | date | date-range-progress | - |
| `actual_end_date` | date | date-range-progress | - |
| `manager__employee_id` | reference | - | - |
| `sponsor__employee_id` | reference | - | - |
| `stakeholder__employee_ids` | array-reference | - | dataTable: "TagsCell", entityFormContainer: "MultiSelectTags" |

### Task Entity

| Field | Type | Widget | Component Overrides |
|-------|------|--------|---------------------|
| `internal_url` | url | - | dataTable: "LinkCell" |
| `shared_url` | url | - | dataTable: "LinkCell" |
| `dl__task_stage` | badge | - | kanbanBoard: "KanbanColumn" |
| `dl__task_priority` | badge | - | - |
| `estimated_hours` | numeric | - | - |
| `actual_hours` | numeric | progress-bar | dataTable: "ProgressBarCell" |
| `story_points` | numeric | - | - |

---

## 4. Frontend Rendering Decision Tree

```typescript
// Frontend formatter service
function renderField(
  value: any,
  metadata: FieldMetadata,
  rowData: Record<string, any>,
  view: 'dataTable' | 'entityFormContainer' | 'entityDetailPage' | 'kanbanBoard'
) {
  // STEP 1: Check for component override
  if (metadata.component?.[view]) {
    const Component = getComponent(metadata.component[view]);
    return <Component value={value} metadata={metadata} rowData={rowData} />;
  }

  // STEP 2: Check for widget (only in dataTable and entityDetailPage)
  if (metadata.widget && ['dataTable', 'entityDetailPage'].includes(view)) {
    switch (metadata.widget.type) {
      case 'progress-bar':
        return <ProgressBar metadata={metadata} rowData={rowData} />;
      case 'date-range-progress':
        return <DateRangeProgress metadata={metadata} rowData={rowData} />;
    }
  }

  // STEP 3: Check viewType
  switch (metadata.viewType) {
    case 'badge':
      return <Badge value={value} options={metadata.options} format={metadata.format} />;
    case 'tags':
      return <TagsList values={value} />;
    case 'link':
      return <a href={value}>{value}</a>;
    case 'json-viewer':
      return <JSONViewer data={value} />;
    default:
      // STEP 4: Format value based on type
      const formatted = formatValue(value, metadata);
      return <span>{formatted}</span>;
  }
}
```

---

## 5. Key Design Decisions

### Component Override Strategy

The `component` field allows view-specific rendering overrides:

```json
{
  "component": {
    "dataTable": "ProgressBarCell",         // Use ProgressBarCell in tables
    "entityDetailPage": "BudgetProgressWidget",  // Use full widget in detail pages
    "entityFormContainer": "MultiSelectTags",    // Use tag selector in forms
    "kanbanBoard": "KanbanColumn"          // Use as kanban column grouping
  }
}
```

### Widget vs Component Override

- **Widget**: General-purpose, works across multiple views (progress bars, date ranges)
- **Component Override**: View-specific custom component (e.g., timeline viz in detail page)

### Options: Static vs Dynamic

**Static options** (small lists, cached):
```json
{
  "options": [
    { "value": "Planning", "label": "Planning", "color": "gray" },
    { "value": "In Progress", "label": "In Progress", "color": "yellow" }
  ]
}
```

**Dynamic options** (large lists, fetched on-demand):
```json
{
  "optionsEndpoint": "/api/v1/entity/employee/entity-instance-lookup"
}
```

### Validation Rules

All validation rules in metadata:
```json
{
  "validation": {
    "min": 0,
    "max": 100000000,
    "minLength": 3,
    "maxLength": 200,
    "pattern": "^[A-Z0-9-]+$",
    "custom": "endDateAfterStartDate"
  }
}
```

Frontend validates using metadata before submission.

---

## 6. Minimal API Response (for performance)

For list views where full metadata is already cached:

```json
{
  "data": [...],
  "metadata": {
    "entity": "project",
    "generated_at": "2025-01-19T12:00:00.000Z"
  },
  "pagination": { ... }
}
```

Frontend checks cache first:
- If metadata exists in cache → Use it
- If cache miss → Fetch full metadata from `/api/v1/metadata/project`

---

## 7. Complete Type Definitions (TypeScript)

```typescript
// Full type definitions for copy-paste
export type FieldType =
  | 'text'
  | 'currency'
  | 'date'
  | 'timestamp'
  | 'boolean'
  | 'numeric'
  | 'percentage'
  | 'badge'
  | 'reference'
  | 'array-reference'
  | 'url'
  | 'json'
  | 'uuid';

export type EditType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime'
  | 'toggle'
  | 'select'
  | 'multiselect'
  | 'readonly';

export type ViewType =
  | 'text'
  | 'badge'
  | 'tags'
  | 'link'
  | 'json-viewer';

export type WidgetType =
  | 'progress-bar'
  | 'date-range-progress'
  | 'timeline'
  | 'kanban-column';

export interface FieldMetadata {
  key: string;
  label: string;
  type: FieldType;
  format: Record<string, any>;
  editType: EditType;
  viewType: ViewType;
  widget: WidgetConfig | null;
  editable: boolean;
  sortable: boolean;
  visible: boolean;
  required?: boolean;
  align: 'left' | 'right' | 'center';
  width?: string;
  optionsEndpoint?: string;
  options?: Array<{ value: string | number; label: string; color?: string }>;
  component?: Record<string, string>;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    custom?: string;
  };
  help?: string;
  placeholder?: string;
}

export interface WidgetConfig {
  type: WidgetType;
  config: Record<string, any>;
}

export interface EntityMetadata {
  entity: string;
  label: string;
  labelPlural: string;
  icon?: string;
  fields: FieldMetadata[];
  primaryKey: string;
  displayField: string;
  generated_at: string;
}

export interface ApiResponse<T = any> {
  data: T[];
  metadata: EntityMetadata;
  pagination?: {
    limit: number;
    offset: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
```

---

**End of Unified API Response Format**
