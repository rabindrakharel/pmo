# API Response Samples

This directory contains actual API responses from the PMO platform demonstrating the metadata structure for format-on-read pattern.

## Sample Files

| File | Entity | Description |
|------|--------|-------------|
| [project-api-response.json](./project-api-response.json) | Project | Full project response with budget, dates, employee refs |
| [task-api-response.json](./task-api-response.json) | Task | Task response with stage, priority, hours tracking |
| [office-api-response.json](./office-api-response.json) | Office | Office hierarchy with levels and parent refs |
| [business-api-response.json](./business-api-response.json) | Business | Business entity with industry sector |

## Response Structure

All responses follow this structure:

```json
{
  "data": [...],           // Raw entity data (1+ rows)
  "fields": [...],         // Field names in order
  "metadata": {
    "entityDataTable": {   // Component-specific metadata
      "viewType": {...},   // How to DISPLAY each field
      "editType": {...}    // How to EDIT each field
    },
    "entityFormContainer": {...},
    "kanbanView": {...}
  },
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

---

## Field Type Examples (from actual responses)

### Currency Field (`budget_allocated_amt`)
```json
// viewType
{
  "dtype": "float",
  "label": "Budget Allocated",
  "type": "currency",
  "behavior": { "visible": true, "sortable": true, "filterable": true },
  "style": { "width": "140px", "align": "right", "symbol": "$", "decimals": 2, "locale": "en-CA" }
}

// editType
{
  "dtype": "float",
  "label": "Budget Allocated",
  "type": "number",
  "behavior": { "editable": true },
  "style": { "symbol": "$", "step": 0.01 },
  "validation": { "min": 0 }
}
```

### Datalabel Field (`dl__project_stage`)
```json
// viewType
{
  "dtype": "str",
  "label": "Project Stage",
  "type": "component",
  "component": "BadgeCell",
  "behavior": { "visible": true, "sortable": true, "filterable": true },
  "style": { "width": "140px", "colorFromData": true }
}

// editType
{
  "dtype": "str",
  "label": "Project Stage",
  "type": "select",
  "component": "DataLabelSelect",
  "behavior": { "editable": true },
  "style": { "showColor": true, "searchable": true },
  "validation": {},
  "lookupSource": "datalabel",
  "datalabelKey": "dl__project_stage"
}
```

### Entity Reference Field (`manager__employee_id`)
```json
// viewType
{
  "dtype": "uuid",
  "label": "Manager Employee Name",
  "type": "component",
  "component": "EntityLookupCell",
  "behavior": { "visible": true, "sortable": true, "filterable": true },
  "style": { "width": "150px", "displayField": "name", "linkToEntity": true }
}

// editType
{
  "dtype": "uuid",
  "label": "Manager Employee Name",
  "type": "select",
  "component": "EntitySelect",
  "behavior": { "editable": true },
  "style": { "searchable": true, "clearable": true },
  "validation": {},
  "lookupSource": "entityInstance",
  "lookupEntity": "employee"
}
```

### Date Field (`planned_start_date`)
```json
// viewType
{
  "dtype": "date",
  "label": "Planned Start",
  "type": "date",
  "behavior": { "visible": true, "sortable": true, "filterable": true },
  "style": { "width": "120px", "format": "short", "locale": "en-CA" }
}

// editType
{
  "dtype": "date",
  "label": "Planned Start",
  "type": "date",
  "behavior": { "editable": true },
  "style": {},
  "validation": {}
}
```

### Boolean Field (`active_flag`)
```json
// viewType
{
  "dtype": "bool",
  "label": "Active",
  "type": "boolean",
  "behavior": { "visible": true, "sortable": true, "filterable": true },
  "style": {
    "width": "100px",
    "align": "center",
    "trueLabel": "Active",
    "falseLabel": "Inactive",
    "trueColor": "green",
    "falseColor": "red"
  }
}

// editType
{
  "dtype": "bool",
  "label": "Active",
  "type": "checkbox",
  "behavior": { "editable": true },
  "style": {},
  "validation": {}
}
```

### Timestamp Field (`created_ts`)
```json
// viewType
{
  "dtype": "timestamp",
  "label": "Created",
  "type": "timestamp",
  "behavior": { "visible": true, "sortable": true, "filterable": false },
  "style": { "width": "140px", "format": "relative" }
}

// editType
{
  "dtype": "timestamp",
  "label": "Created",
  "type": "readonly",
  "behavior": { "editable": false },
  "style": {},
  "validation": {}
}
```

### JSON/Metadata Field (`metadata`)
```json
// viewType
{
  "dtype": "jsonb",
  "label": "Metadata",
  "type": "component",
  "component": "JsonPreviewCell",
  "behavior": { "visible": false, "sortable": false, "filterable": false }
}

// editType
{
  "dtype": "jsonb",
  "label": "Metadata",
  "type": "component",
  "component": "JsonEditor",
  "behavior": { "editable": true },
  "style": {},
  "validation": {}
}
```

---

## Entity-Specific Field Summary

### Project Fields
| Field | viewType | editType | Notes |
|-------|----------|----------|-------|
| `budget_allocated_amt` | currency | number | CAD currency |
| `budget_spent_amt` | currency | number | CAD currency |
| `dl__project_stage` | BadgeCell | DataLabelSelect | Workflow stage |
| `manager__employee_id` | EntityLookupCell | EntitySelect | Employee reference |
| `sponsor__employee_id` | EntityLookupCell | EntitySelect | Employee reference |
| `planned_start_date` | date | date | Date picker |
| `planned_end_date` | date | date | Date picker |

### Task Fields
| Field | viewType | editType | Notes |
|-------|----------|----------|-------|
| `dl__task_stage` | BadgeCell | DataLabelSelect | Workflow stage |
| `dl__task_priority` | BadgeCell | DataLabelSelect | Priority level |
| `estimated_hours` | number | number | Hours tracking |
| `actual_hours` | number | number | Hours tracking |
| `story_points` | number | number | Agile points |
| `project_id` | EntityLookupCell | EntitySelect | Parent project |
| `business_id` | EntityLookupCell | EntitySelect | Parent business |

### Office Fields
| Field | viewType | editType | Notes |
|-------|----------|----------|-------|
| `dl__office_level` | BadgeCell | DataLabelSelect | Hierarchy level |
| `parent__office_id` | EntityLookupCell | EntitySelect | Parent office |
| `address` | text | textarea | Location |

### Business Fields
| Field | viewType | editType | Notes |
|-------|----------|----------|-------|
| `dl__business_level` | BadgeCell | DataLabelSelect | Hierarchy level |
| `dl__industry_sector` | BadgeCell | DataLabelSelect | Industry |
| `parent__business_id` | EntityLookupCell | EntitySelect | Parent business |

---

## Generated On
**Date:** 2025-11-25
**API Version:** v10.0.0
**Backend Formatter:** v10.0.0
