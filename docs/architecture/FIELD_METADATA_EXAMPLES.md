# Field Metadata Examples - Business, Project, Task

**Version**: 1.0
**Date**: 2025-01-19
**Purpose**: Complete field-by-field metadata examples for the three pilot entities

---

## 1. Business Entity (`app.business`)

### DDL Columns

```sql
CREATE TABLE app.business (
    id uuid DEFAULT gen_random_uuid(),
    code varchar(50),
    name varchar(200),
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    active_flag boolean DEFAULT true,
    office_id uuid,
    current_headcount integer DEFAULT 0,
    operational_status text DEFAULT 'Active',
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);
```

### Generated Metadata

```json
{
  "entity": "business",
  "fields": [
    {
      "key": "id",
      "type": "uuid",
      "label": "ID",
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
      "type": "text",
      "label": "Code",
      "format": {},
      "editType": "text",
      "viewType": "text",
      "widget": null,
      "editable": true,
      "sortable": true,
      "visible": true,
      "align": "left"
    },
    {
      "key": "name",
      "type": "text",
      "label": "Name",
      "format": {},
      "editType": "text",
      "viewType": "text",
      "widget": null,
      "editable": true,
      "sortable": true,
      "visible": true,
      "align": "left"
    },
    {
      "key": "descr",
      "type": "text",
      "label": "Description",
      "format": {},
      "editType": "textarea",
      "viewType": "text",
      "widget": null,
      "editable": true,
      "sortable": false,
      "visible": true,
      "align": "left"
    },
    {
      "key": "metadata",
      "type": "json",
      "label": "Metadata",
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
      "key": "active_flag",
      "type": "boolean",
      "label": "Active",
      "format": {},
      "editType": "toggle",
      "viewType": "badge",
      "widget": null,
      "editable": true,
      "sortable": true,
      "visible": true,
      "align": "center"
    },
    {
      "key": "office_id",
      "type": "reference",
      "label": "Office",
      "format": { "entity": "office" },
      "editType": "select",
      "viewType": "text",
      "widget": null,
      "editable": true,
      "sortable": true,
      "visible": true,
      "align": "left",
      "optionsEndpoint": "/api/v1/entity/office/entity-instance-lookup"
    },
    {
      "key": "current_headcount",
      "type": "numeric",
      "label": "Current Headcount",
      "format": { "decimals": 0 },
      "editType": "number",
      "viewType": "text",
      "widget": null,
      "editable": true,
      "sortable": true,
      "visible": true,
      "align": "right"
    },
    {
      "key": "operational_status",
      "type": "text",
      "label": "Operational Status",
      "format": {},
      "editType": "text",
      "viewType": "text",
      "widget": null,
      "editable": true,
      "sortable": true,
      "visible": true,
      "align": "left"
    },
    {
      "key": "from_ts",
      "type": "timestamp",
      "label": "From",
      "format": { "style": "relative-time" },
      "editType": "readonly",
      "viewType": "text",
      "widget": null,
      "editable": false,
      "sortable": true,
      "visible": false,
      "align": "left"
    },
    {
      "key": "to_ts",
      "type": "timestamp",
      "label": "To",
      "format": { "style": "relative-time" },
      "editType": "readonly",
      "viewType": "text",
      "widget": null,
      "editable": false,
      "sortable": true,
      "visible": false,
      "align": "left"
    },
    {
      "key": "created_ts",
      "type": "timestamp",
      "label": "Created",
      "format": { "style": "datetime" },
      "editType": "readonly",
      "viewType": "text",
      "widget": null,
      "editable": false,
      "sortable": true,
      "visible": true,
      "align": "left"
    },
    {
      "key": "updated_ts",
      "type": "timestamp",
      "label": "Updated",
      "format": { "style": "datetime" },
      "editType": "readonly",
      "viewType": "text",
      "widget": null,
      "editable": false,
      "sortable": true,
      "visible": true,
      "align": "left"
    },
    {
      "key": "version",
      "type": "numeric",
      "label": "Version",
      "format": {},
      "editType": "readonly",
      "viewType": "text",
      "widget": null,
      "editable": false,
      "sortable": false,
      "visible": false,
      "align": "right"
    }
  ],
  "generated_at": "2025-01-19T12:00:00.000Z"
}
```

### Frontend Rendering Examples

| Column | View Mode | Edit Mode |
|--------|-----------|-----------|
| `code` | `<span>BIZ-LAND-ALPHA</span>` | `<input type="text" value="BIZ-LAND-ALPHA" />` |
| `name` | `<span>Landscaping Team Alpha</span>` | `<input type="text" value="Landscaping Team Alpha" />` |
| `active_flag` | `<Badge color="green">Active</Badge>` | `<Toggle checked={true} />` |
| `office_id` | `<span>London Office</span>` | `<Select options={offices} value="uuid" />` |
| `current_headcount` | `<span style="text-align: right">8</span>` | `<input type="number" value="8" />` |
| `created_ts` | `<span>Jan 15, 2025, 2:30 PM</span>` | (readonly) |

---

## 2. Business Hierarchy Entity (`app.business_hierarchy`)

### DDL Columns

```sql
CREATE TABLE app.business_hierarchy (
    id uuid DEFAULT gen_random_uuid(),
    code varchar(50),
    name varchar(200),
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    active_flag boolean DEFAULT true,
    parent__business_hierarchy_id uuid,
    dl__business_hierarchy_level text,
    manager__employee_id uuid,
    budget_allocated_amt decimal(15,2),
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);
```

### Generated Metadata (Key Fields Only)

```json
{
  "entity": "business_hierarchy",
  "fields": [
    {
      "key": "parent__business_hierarchy_id",
      "type": "reference",
      "label": "Parent Business Hierarchy",
      "format": { "entity": "business_hierarchy" },
      "editType": "select",
      "viewType": "text",
      "widget": null,
      "editable": true,
      "sortable": true,
      "visible": true,
      "align": "left",
      "optionsEndpoint": "/api/v1/entity/business_hierarchy/entity-instance-lookup"
    },
    {
      "key": "dl__business_hierarchy_level",
      "type": "badge",
      "label": "Business Hierarchy Level",
      "format": { "loadFromSettings": true },
      "editType": "select",
      "viewType": "badge",
      "widget": null,
      "editable": true,
      "sortable": true,
      "visible": true,
      "align": "left",
      "optionsEndpoint": "/api/v1/entity/business_hierarchy_level/entity-instance-lookup"
    },
    {
      "key": "manager__employee_id",
      "type": "reference",
      "label": "Manager",
      "format": { "entity": "employee" },
      "editType": "select",
      "viewType": "text",
      "widget": null,
      "editable": true,
      "sortable": true,
      "visible": true,
      "align": "left",
      "optionsEndpoint": "/api/v1/entity/employee/entity-instance-lookup"
    },
    {
      "key": "budget_allocated_amt",
      "type": "currency",
      "label": "Budget Allocated",
      "format": { "symbol": "$", "decimals": 2 },
      "editType": "number",
      "viewType": "text",
      "widget": null,
      "editable": true,
      "sortable": true,
      "visible": true,
      "align": "right"
    }
  ]
}
```

### Frontend Rendering Examples

| Column | View Mode | Edit Mode |
|--------|-----------|-----------|
| `parent__business_hierarchy_id` | `<span>Service Operations Division</span>` | `<Select options={hierarchies} />` |
| `dl__business_hierarchy_level` | `<Badge color="blue">Division</Badge>` | `<Select options={levels} />` |
| `manager__employee_id` | `<span>James Miller</span>` | `<Select options={employees} />` |
| `budget_allocated_amt` | `<span style="text-align: right">$3,000,000.00</span>` | `<input type="number" value="3000000" />` |

---

## 3. Project Entity (`app.project`)

### DDL Columns

```sql
CREATE TABLE app.project (
    id uuid DEFAULT gen_random_uuid(),
    code varchar(50),
    name varchar(200),
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    dl__project_stage text,
    budget_allocated_amt decimal(15,2),
    budget_spent_amt decimal(15,2) DEFAULT 0,
    planned_start_date date,
    planned_end_date date,
    actual_start_date date,
    actual_end_date date,
    manager__employee_id uuid,
    sponsor__employee_id uuid,
    stakeholder__employee_ids uuid[] DEFAULT '{}',
    active_flag boolean DEFAULT true,
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);
```

### Generated Metadata (Key Fields Only)

```json
{
  "entity": "project",
  "fields": [
    {
      "key": "dl__project_stage",
      "type": "badge",
      "label": "Project Stage",
      "format": { "loadFromSettings": true },
      "editType": "select",
      "viewType": "badge",
      "widget": null,
      "editable": true,
      "sortable": true,
      "visible": true,
      "align": "left",
      "optionsEndpoint": "/api/v1/entity/project/entity-instance-lookup"
    },
    {
      "key": "budget_allocated_amt",
      "type": "currency",
      "label": "Budget Allocated",
      "format": { "symbol": "$", "decimals": 2 },
      "editType": "number",
      "viewType": "text",
      "widget": null,
      "editable": true,
      "sortable": true,
      "visible": true,
      "align": "right"
    },
    {
      "key": "budget_spent_amt",
      "type": "currency",
      "label": "Budget Spent",
      "format": { "symbol": "$", "decimals": 2 },
      "editType": "number",
      "viewType": "text",
      "widget": {
        "type": "progress-bar",
        "config": {
          "maxField": "budget_allocated_amt",
          "currentField": "budget_spent_amt",
          "showPercentage": true,
          "color": "orange",
          "label": "Budget Progress"
        }
      },
      "editable": true,
      "sortable": true,
      "visible": true,
      "align": "right"
    },
    {
      "key": "planned_start_date",
      "type": "date",
      "label": "Planned Start",
      "format": { "style": "short" },
      "editType": "date",
      "viewType": "text",
      "widget": {
        "type": "date-range-progress",
        "config": {
          "startField": "planned_start_date",
          "endField": "planned_end_date",
          "showPercentage": true,
          "color": "blue"
        }
      },
      "editable": true,
      "sortable": true,
      "visible": true,
      "align": "left"
    },
    {
      "key": "planned_end_date",
      "type": "date",
      "label": "Planned End",
      "format": { "style": "short" },
      "editType": "date",
      "viewType": "text",
      "widget": {
        "type": "date-range-progress",
        "config": {
          "startField": "planned_start_date",
          "endField": "planned_end_date",
          "showPercentage": true,
          "color": "blue"
        }
      },
      "editable": true,
      "sortable": true,
      "visible": true,
      "align": "left"
    },
    {
      "key": "actual_start_date",
      "type": "date",
      "label": "Actual Start",
      "format": { "style": "short" },
      "editType": "date",
      "viewType": "text",
      "widget": {
        "type": "date-range-progress",
        "config": {
          "startField": "actual_start_date",
          "endField": "actual_end_date",
          "showPercentage": true,
          "color": "green"
        }
      },
      "editable": true,
      "sortable": true,
      "visible": true,
      "align": "left"
    },
    {
      "key": "actual_end_date",
      "type": "date",
      "label": "Actual End",
      "format": { "style": "short" },
      "editType": "date",
      "viewType": "text",
      "widget": {
        "type": "date-range-progress",
        "config": {
          "startField": "actual_start_date",
          "endField": "actual_end_date",
          "showPercentage": true,
          "color": "green"
        }
      },
      "editable": true,
      "sortable": true,
      "visible": true,
      "align": "left"
    },
    {
      "key": "manager__employee_id",
      "type": "reference",
      "label": "Manager",
      "format": { "entity": "employee" },
      "editType": "select",
      "viewType": "text",
      "widget": null,
      "editable": true,
      "sortable": true,
      "visible": true,
      "align": "left",
      "optionsEndpoint": "/api/v1/entity/employee/entity-instance-lookup"
    },
    {
      "key": "sponsor__employee_id",
      "type": "reference",
      "label": "Sponsor",
      "format": { "entity": "employee" },
      "editType": "select",
      "viewType": "text",
      "widget": null,
      "editable": true,
      "sortable": true,
      "visible": true,
      "align": "left",
      "optionsEndpoint": "/api/v1/entity/employee/entity-instance-lookup"
    },
    {
      "key": "stakeholder__employee_ids",
      "type": "array-reference",
      "label": "Stakeholders",
      "format": { "entity": "employee" },
      "editType": "multiselect",
      "viewType": "tags",
      "widget": null,
      "editable": true,
      "sortable": false,
      "visible": true,
      "align": "left",
      "optionsEndpoint": "/api/v1/entity/employee/entity-instance-lookup"
    }
  ]
}
```

### Frontend Rendering Examples

#### Data Table View

| Column | Rendered Output |
|--------|-----------------|
| `code` | `DT-2024-001` |
| `name` | `Digital Transformation Initiative 2024` |
| `dl__project_stage` | `🟡 In Progress` (colored badge) |
| `budget_allocated_amt` | `$750,000.00` (right-aligned) |
| `budget_spent_amt` | `$285,000.00` + 🟧 **38%** progress bar |
| `planned_start_date` | `Jan 15, 2024` + 🟦 **92%** progress bar (shared with end date) |
| `planned_end_date` | `Dec 31, 2024` + 🟦 **92%** progress bar (shared with start date) |
| `manager__employee_id` | `James Miller` (from `_ID_NAME`) |
| `stakeholder__employee_ids` | `James Miller` `Sarah Johnson` (tags) |

#### Form View (Edit Mode)

| Column | Input Type | Example |
|--------|------------|---------|
| `code` | Text input | `<input type="text" value="DT-2024-001" />` |
| `name` | Text input | `<input type="text" value="Digital Transformation..." />` |
| `dl__project_stage` | Dropdown | `<select><option>Planning</option><option>In Progress</option>...` |
| `budget_allocated_amt` | Number input | `<input type="number" value="750000" step="0.01" />` |
| `budget_spent_amt` | Number input | `<input type="number" value="285000" step="0.01" />` |
| `planned_start_date` | Date picker | `<input type="date" value="2024-01-15" />` |
| `planned_end_date` | Date picker | `<input type="date" value="2024-12-31" />` |
| `manager__employee_id` | Dropdown | `<select><option>James Miller</option>...` |
| `stakeholder__employee_ids` | Multi-select | `<MultiSelect values={[...]} options={employees} />` |

#### Detail View

| Column | Rendered Output |
|--------|-----------------|
| `budget_spent_amt` | **Budget Spent**: $285,000.00<br/>**Budget Allocated**: $750,000.00<br/>🟧 **38.0%** ████░░░░░░ |
| `planned_start_date` + `planned_end_date` | **Planned Timeline**:<br/>Start: Jan 15, 2024<br/>End: Dec 31, 2024<br/>🟦 **92.0%** █████████░ (time elapsed) |

---

## 4. Task Entity (`app.task`)

### DDL Columns

```sql
CREATE TABLE app.task (
    id uuid DEFAULT gen_random_uuid(),
    code varchar(50),
    name varchar(200),
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    active_flag boolean DEFAULT true,
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1,
    internal_url text,
    shared_url text,
    dl__task_stage text,
    dl__task_priority text,
    estimated_hours numeric(10,2),
    actual_hours numeric(10,2),
    story_points integer
);
```

### Generated Metadata (Key Fields Only)

```json
{
  "entity": "task",
  "fields": [
    {
      "key": "internal_url",
      "type": "url",
      "label": "Internal URL",
      "format": {},
      "editType": "text",
      "viewType": "link",
      "widget": null,
      "editable": true,
      "sortable": false,
      "visible": true,
      "align": "left"
    },
    {
      "key": "shared_url",
      "type": "url",
      "label": "Shared URL",
      "format": {},
      "editType": "text",
      "viewType": "link",
      "widget": null,
      "editable": true,
      "sortable": false,
      "visible": true,
      "align": "left"
    },
    {
      "key": "dl__task_stage",
      "type": "badge",
      "label": "Task Stage",
      "format": { "loadFromSettings": true },
      "editType": "select",
      "viewType": "badge",
      "widget": null,
      "editable": true,
      "sortable": true,
      "visible": true,
      "align": "left",
      "optionsEndpoint": "/api/v1/entity/task/entity-instance-lookup"
    },
    {
      "key": "dl__task_priority",
      "type": "badge",
      "label": "Task Priority",
      "format": { "loadFromSettings": true },
      "editType": "select",
      "viewType": "badge",
      "widget": null,
      "editable": true,
      "sortable": true,
      "visible": true,
      "align": "left",
      "optionsEndpoint": "/api/v1/entity/task/entity-instance-lookup"
    },
    {
      "key": "estimated_hours",
      "type": "numeric",
      "label": "Estimated Hours",
      "format": { "decimals": 2 },
      "editType": "number",
      "viewType": "text",
      "widget": null,
      "editable": true,
      "sortable": true,
      "visible": true,
      "align": "right"
    },
    {
      "key": "actual_hours",
      "type": "numeric",
      "label": "Actual Hours",
      "format": { "decimals": 2 },
      "editType": "number",
      "viewType": "text",
      "widget": {
        "type": "progress-bar",
        "config": {
          "maxField": "estimated_hours",
          "currentField": "actual_hours",
          "showPercentage": true,
          "color": "green",
          "label": "Hours Progress"
        }
      },
      "editable": true,
      "sortable": true,
      "visible": true,
      "align": "right"
    },
    {
      "key": "story_points",
      "type": "numeric",
      "label": "Story Points",
      "format": { "decimals": 0 },
      "editType": "number",
      "viewType": "text",
      "widget": null,
      "editable": true,
      "sortable": true,
      "visible": true,
      "align": "right"
    }
  ]
}
```

### Frontend Rendering Examples

#### Data Table View

| Column | Rendered Output |
|--------|-----------------|
| `code` | `DT-TASK-002` |
| `name` | `PMO Software Vendor Evaluation` |
| `internal_url` | `🔗 /task/a2222222-...` (clickable link) |
| `shared_url` | `🔗 /task/mK7wL3vP` (clickable link) |
| `dl__task_stage` | `🟡 Planning` (colored badge) |
| `dl__task_priority` | `🔴 Critical` (colored badge) |
| `estimated_hours` | `60.00` (right-aligned) |
| `actual_hours` | `15.00` + 🟢 **25%** progress bar |
| `story_points` | `13` (right-aligned) |

#### Form View (Edit Mode)

| Column | Input Type | Example |
|--------|------------|---------|
| `internal_url` | Text input | `<input type="text" value="/task/a2222222-..." />` |
| `shared_url` | Text input | `<input type="text" value="/task/mK7wL3vP" />` |
| `dl__task_stage` | Dropdown | `<select><option>Planning</option><option>In Progress</option>...` |
| `dl__task_priority` | Dropdown | `<select><option>Low</option><option>Critical</option>...` |
| `estimated_hours` | Number input | `<input type="number" value="60" step="0.01" />` |
| `actual_hours` | Number input | `<input type="number" value="15" step="0.01" />` |
| `story_points` | Number input | `<input type="number" value="13" step="1" />` |

#### Detail View

| Column | Rendered Output |
|--------|-----------------|
| `actual_hours` | **Actual Hours**: 15.00 hrs<br/>**Estimated Hours**: 60.00 hrs<br/>🟢 **25.0%** ██░░░░░░░░ |
| `dl__task_stage` | **Stage**: 🟡 Planning |
| `dl__task_priority` | **Priority**: 🔴 Critical |
| `internal_url` | **Internal URL**: [🔗 /task/a2222222-2222-2222-2222-222222222222](/task/a2222222-2222-2222-2222-222222222222) |

---

## 5. Pattern Detection Summary

### All Entities Share These Patterns

| Pattern | Example Field | Detected Metadata |
|---------|---------------|-------------------|
| `id` | `id` | UUID, readonly, hidden |
| `code` | `code` | Text, editable, visible |
| `name` | `name` | Text, editable, visible |
| `descr` | `descr` | Text, textarea, visible |
| `metadata` | `metadata` | JSON, readonly, hidden |
| `active_flag` | `active_flag` | Boolean, toggle, badge |
| `*_ts` | `from_ts`, `to_ts` | Timestamp, readonly, relative-time |
| `created_ts` | `created_ts` | Timestamp, readonly, datetime |
| `updated_ts` | `updated_ts` | Timestamp, readonly, datetime |
| `version` | `version` | Numeric, readonly, hidden |

### Entity-Specific Patterns

| Entity | Pattern | Example Field | Metadata |
|--------|---------|---------------|----------|
| **Business** | `*_headcount` | `current_headcount` | Numeric (0 decimals) |
| **Business** | `*_id` | `office_id` | Reference (office) |
| **Business Hierarchy** | `dl__*` | `dl__business_hierarchy_level` | Badge (settings) |
| **Business Hierarchy** | `*__employee_id` | `manager__employee_id` | Reference (employee) |
| **Business Hierarchy** | `*_amt` | `budget_allocated_amt` | Currency ($, 2 decimals) |
| **Project** | `*_amt` | `budget_allocated_amt`, `budget_spent_amt` | Currency + Widget (progress-bar) |
| **Project** | `*_date` | `planned_start_date`, `planned_end_date` | Date + Widget (date-range-progress) |
| **Project** | `*__employee_ids` | `stakeholder__employee_ids` | Array-reference (tags) |
| **Task** | `*_url` | `internal_url`, `shared_url` | URL (link) |
| **Task** | `dl__*` | `dl__task_stage`, `dl__task_priority` | Badge (settings) |
| **Task** | `*_hours` | `estimated_hours`, `actual_hours` | Numeric + Widget (progress-bar) |
| **Task** | `*_points` | `story_points` | Numeric (0 decimals) |

---

## 6. Widget Applications

### Budget Progress Bar (Project)

**Trigger**: Both `budget_allocated_amt` AND `budget_spent_amt` exist

**Config**:
```json
{
  "type": "progress-bar",
  "config": {
    "maxField": "budget_allocated_amt",
    "currentField": "budget_spent_amt",
    "showPercentage": true,
    "color": "orange"
  }
}
```

**Applied to**: `budget_spent_amt` field

**Rendered**:
```
$285,000.00  🟧 38% ████░░░░░░  ($750,000.00)
```

---

### Date Range Progress (Project)

**Trigger**: Both `planned_start_date` AND `planned_end_date` exist

**Config**:
```json
{
  "type": "date-range-progress",
  "config": {
    "startField": "planned_start_date",
    "endField": "planned_end_date",
    "showPercentage": true,
    "color": "blue"
  }
}
```

**Applied to**: Both `planned_start_date` and `planned_end_date`

**Rendered**:
```
Jan 15, 2024  🟦 92%  █████████░  Dec 31, 2024
```

---

### Hours Progress Bar (Task)

**Trigger**: Both `estimated_hours` AND `actual_hours` exist

**Config**:
```json
{
  "type": "progress-bar",
  "config": {
    "maxField": "estimated_hours",
    "currentField": "actual_hours",
    "showPercentage": true,
    "color": "green"
  }
}
```

**Applied to**: `actual_hours` field

**Rendered**:
```
15.00 hrs  🟢 25%  ██░░░░░░░░  (60.00 hrs)
```

---

## 7. Rendering Decision Tree

```
Field Metadata
      │
      ├─ Has widget?
      │     ├─ Yes → Render custom widget component
      │     │         (DateRangeProgress, ProgressBar, etc.)
      │     └─ No → Check viewType
      │              ├─ badge → <Badge />
      │              ├─ tags → <TagsList />
      │              ├─ link → <a href={value}>{value}</a>
      │              ├─ json-viewer → <JSONViewer />
      │              └─ text → <span>{formatValue(value, metadata)}</span>
      │
      └─ formatValue() uses metadata.format
            ├─ currency → "$50,000.00"
            ├─ date → "Jan 15, 2024"
            ├─ timestamp → "2 hours ago" or "Jan 15, 2025, 2:30 PM"
            ├─ boolean → "Yes" / "No"
            ├─ numeric → "15.00" (with decimals from metadata)
            └─ text → String(value)
```

---

## 8. API Response Example (Complete)

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
      "created_ts": "2024-01-10T10:00:00Z",
      "updated_ts": "2024-11-19T12:00:00Z",
      "version": 5
    }
  ],
  "metadata": {
    "entity": "project",
    "fields": [
      { "key": "code", "type": "text", "label": "Code", ... },
      { "key": "budget_spent_amt", "type": "currency", "widget": { "type": "progress-bar", ... }, ... },
      { "key": "dl__project_stage", "type": "badge", "optionsEndpoint": "/api/v1/entity/project/...", ... }
    ],
    "generated_at": "2025-01-19T12:00:00.000Z"
  },
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 1
  }
}
```

---

**End of Field Metadata Examples**
