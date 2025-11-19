# Backend-Driven Metadata Architecture

**Version**: 1.0
**Date**: 2025-01-19
**Scope**: business, project, task entities
**Status**: Design Proposal

---

## Executive Summary

Shift formatting intelligence from frontend pattern detection to backend-driven metadata generation. The backend becomes the **single source of truth** for field schemas, sending explicit metadata alongside data. Frontend becomes a **pure renderer** that executes backend instructions.

**Key Change**: Backend generates field metadata based on column naming conventions → Frontend consumes and renders.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        API REQUEST                              │
│  GET /api/v1/project?limit=10                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              ENTITY ROUTE (routes.ts)                           │
│  • Query database (SELECT * FROM app.project)                   │
│  • RBAC filtering (Entity Infrastructure Service - UNCHANGED)   │
│  • Resolve references (_ID/_IDS)                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│         BACKEND FORMATTER SERVICE (NEW)                         │
│  • Analyzes column names (budget_allocated_amt → currency)      │
│  • Generates field metadata (type, format, editType, widget)    │
│  • Caches metadata by entity type (Redis, 5min TTL)             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   API RESPONSE                                  │
│  {                                                              │
│    "data": [...],                                               │
│    "metadata": {                                                │
│      "entity": "project",                                       │
│      "fields": [                                                │
│        {                                                        │
│          "key": "budget_allocated_amt",                         │
│          "type": "currency",                                    │
│          "format": { "symbol": "$", "decimals": 2 },            │
│          "editType": "number",                                  │
│          "viewType": "text",                                    │
│          "widget": null,                                        │
│          "editable": true,                                      │
│          "sortable": true                                       │
│        },                                                       │
│        {                                                        │
│          "key": "planned_start_date",                           │
│          "type": "date",                                        │
│          "format": { "style": "short" },                        │
│          "editType": "date",                                    │
│          "viewType": "text",                                    │
│          "widget": {                                            │
│            "type": "date-range-progress",                       │
│            "config": {                                          │
│              "startField": "planned_start_date",                │
│              "endField": "planned_end_date",                    │
│              "showPercentage": true                             │
│            }                                                    │
│          },                                                     │
│          "editable": true                                       │
│        }                                                        │
│      ]                                                          │
│    }                                                            │
│  }                                                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│         FRONTEND FORMATTER SERVICE (SIMPLIFIED)                 │
│  • Parse metadata from API response                             │
│  • Cache metadata by entity (React Query)                       │
│  • Render fields using metadata instructions                    │
│  • Fallback to naming patterns (if no metadata)                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              REACT COMPONENTS                                   │
│  • EntityFormContainer: renderField(metadata)                   │
│  • EntityDataTable: renderCell(metadata)                        │
│  • FilteredDataTable: renderColumn(metadata)                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Entity Infrastructure Service (UNCHANGED)

The Entity Infrastructure Service (`apps/api/src/services/entity-infrastructure.service.ts`) remains **100% unchanged**. It continues to handle:

1. **RBAC Operations**:
   - `check_entity_rbac()` - Permission checks
   - `get_entity_rbac_where_condition()` - SQL WHERE fragments
   - `set_entity_rbac_owner()` - Grant ownership

2. **Entity Instance Registry**:
   - `set_entity_instance_registry()` - Register instances
   - `update_entity_instance_registry()` - Sync name/code changes
   - `resolve_entity_references()` - Add _ID/_IDS metadata

3. **Entity Linkages**:
   - `set_entity_instance_link()` - Create parent-child links
   - `delete_entity_instance_link()` - Remove links

4. **Infrastructure Cleanup**:
   - `delete_all_entity_infrastructure()` - Cascade delete

**Key Point**: The Backend Formatter Service is a **separate, additive service**. Entity Infrastructure Service does NOT change.

---

## 3. Backend Formatter Service (NEW)

### 3.1 Location

`apps/api/src/services/backend-formatter.service.ts`

### 3.2 Purpose

Generate field metadata from column names using **convention over configuration**. This service inspects database schemas and applies naming pattern rules to produce structured field metadata.

### 3.3 Column Analysis (business, project, task)

#### Business (`app.business`):
| Column | Pattern | Type | Format | Edit Type | Widget |
|--------|---------|------|--------|-----------|--------|
| `id` | `id` | uuid | - | readonly | - |
| `code` | - | text | - | text | - |
| `name` | - | text | - | text | - |
| `descr` | - | text | - | textarea | - |
| `metadata` | `metadata` | json | - | readonly | - |
| `active_flag` | `*_flag` | boolean | - | toggle | - |
| `office_id` | `*_id` (uuid) | reference | entity: office | select | - |
| `current_headcount` | `*_headcount` | numeric | - | number | - |
| `operational_status` | `*_status` | text | - | text | - |
| `from_ts` | `*_ts` | timestamp | relative-time | readonly | - |
| `to_ts` | `*_ts` | timestamp | relative-time | readonly | - |
| `created_ts` | `created_ts` | timestamp | datetime | readonly | - |
| `updated_ts` | `updated_ts` | timestamp | datetime | readonly | - |
| `version` | `version` | numeric | - | readonly | - |

#### Business Hierarchy (`app.business_hierarchy`):
| Column | Pattern | Type | Format | Edit Type | Widget |
|--------|---------|------|--------|-----------|--------|
| `parent__business_hierarchy_id` | `parent__*_id` | reference | entity: business_hierarchy | select | - |
| `dl__business_hierarchy_level` | `dl__*` | badge | loadFromSettings: true | select | - |
| `manager__employee_id` | `*__employee_id` | reference | entity: employee | select | - |
| `budget_allocated_amt` | `*_amt` | currency | symbol: $, decimals: 2 | number | - |

#### Project (`app.project`):
| Column | Pattern | Type | Format | Edit Type | Widget |
|--------|---------|------|--------|-----------|--------|
| `dl__project_stage` | `dl__*` | badge | loadFromSettings: true | select | - |
| `budget_allocated_amt` | `*_amt` | currency | symbol: $, decimals: 2 | number | - |
| `budget_spent_amt` | `*_amt` | currency | symbol: $, decimals: 2 | number | - |
| `planned_start_date` | `*_date` | date | style: short | date | date-range-progress (paired) |
| `planned_end_date` | `*_date` | date | style: short | date | date-range-progress (paired) |
| `actual_start_date` | `*_date` | date | style: short | date | - |
| `actual_end_date` | `*_date` | date | style: short | date | - |
| `manager__employee_id` | `*__employee_id` | reference | entity: employee | select | - |
| `sponsor__employee_id` | `*__employee_id` | reference | entity: employee | select | - |
| `stakeholder__employee_ids` | `*__employee_ids` | array-reference | entity: employee | multiselect | tags |

#### Task (`app.task`):
| Column | Pattern | Type | Format | Edit Type | Widget |
|--------|---------|------|--------|-----------|--------|
| `internal_url` | `*_url` | url | - | text | link |
| `shared_url` | `*_url` | url | - | text | link |
| `dl__task_stage` | `dl__*` | badge | loadFromSettings: true | select | - |
| `dl__task_priority` | `dl__*` | badge | loadFromSettings: true | select | - |
| `estimated_hours` | `*_hours` | numeric | decimals: 2 | number | - |
| `actual_hours` | `*_hours` | numeric | decimals: 2 | number | progress-bar (paired) |
| `story_points` | `*_points` | numeric | decimals: 0 | number | - |

### 3.4 Pattern Detection Rules

```typescript
// Pattern → Field Metadata Mapping
const PATTERN_RULES = {
  // Currency
  '*_amt': { type: 'currency', format: { symbol: '$', decimals: 2 }, editType: 'number' },
  '*_price': { type: 'currency', format: { symbol: '$', decimals: 2 }, editType: 'number' },
  '*_cost': { type: 'currency', format: { symbol: '$', decimals: 2 }, editType: 'number' },

  // Badge (Settings-based)
  'dl__*': { type: 'badge', format: { loadFromSettings: true }, editType: 'select' },

  // Date/Time
  '*_date': { type: 'date', format: { style: 'short' }, editType: 'date' },
  '*_ts': { type: 'timestamp', format: { style: 'relative-time' }, editType: 'readonly' },
  'created_ts': { type: 'timestamp', format: { style: 'datetime' }, editType: 'readonly' },
  'updated_ts': { type: 'timestamp', format: { style: 'datetime' }, editType: 'readonly' },

  // Boolean
  '*_flag': { type: 'boolean', format: {}, editType: 'toggle' },
  'is_*': { type: 'boolean', format: {}, editType: 'toggle' },

  // Numeric
  '*_hours': { type: 'numeric', format: { decimals: 2 }, editType: 'number' },
  '*_points': { type: 'numeric', format: { decimals: 0 }, editType: 'number' },
  '*_headcount': { type: 'numeric', format: { decimals: 0 }, editType: 'number' },
  '*_pct': { type: 'percentage', format: { decimals: 1 }, editType: 'number' },

  // References (Entity)
  '*__employee_id': { type: 'reference', format: { entity: 'employee' }, editType: 'select' },
  '*__employee_ids': { type: 'array-reference', format: { entity: 'employee' }, editType: 'multiselect', viewType: 'tags' },
  '*_id': { type: 'reference', format: { entity: 'auto' }, editType: 'select' }, // Auto-detect entity from prefix

  // URL
  '*_url': { type: 'url', format: {}, editType: 'text', viewType: 'link' },

  // JSON
  'metadata': { type: 'json', format: {}, editType: 'readonly', viewType: 'json-viewer' },

  // Special
  'id': { type: 'uuid', format: {}, editType: 'readonly' },
  'code': { type: 'text', format: {}, editType: 'text' },
  'version': { type: 'numeric', format: {}, editType: 'readonly' },
};
```

### 3.5 Widget Detection (Advanced)

Certain field combinations trigger **widget generation**:

```typescript
// Widget Rules (multi-field patterns)
const WIDGET_RULES = [
  // Date Range Progress Bar
  {
    pattern: ['*_start_date', '*_end_date'],
    widget: {
      type: 'date-range-progress',
      config: {
        startField: 'planned_start_date',
        endField: 'planned_end_date',
        showPercentage: true,
        color: 'blue'
      }
    },
    applyToFields: ['*_start_date', '*_end_date']
  },

  // Hours Progress (estimated vs actual)
  {
    pattern: ['estimated_hours', 'actual_hours'],
    widget: {
      type: 'progress-bar',
      config: {
        maxField: 'estimated_hours',
        currentField: 'actual_hours',
        showPercentage: true,
        color: 'green'
      }
    },
    applyToFields: ['actual_hours']
  },

  // Budget Progress
  {
    pattern: ['budget_allocated_amt', 'budget_spent_amt'],
    widget: {
      type: 'progress-bar',
      config: {
        maxField: 'budget_allocated_amt',
        currentField: 'budget_spent_amt',
        showPercentage: true,
        color: 'orange'
      }
    },
    applyToFields: ['budget_spent_amt']
  }
];
```

### 3.6 Implementation (Backend Formatter Service)

```typescript
// apps/api/src/services/backend-formatter.service.ts

import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';

/**
 * Field metadata structure sent to frontend
 */
export interface FieldMetadata {
  key: string;                    // Column name
  type: string;                   // currency, date, badge, reference, etc.
  label: string;                  // Human-readable label
  format: Record<string, any>;    // Type-specific format config
  editType: string;               // number, select, date, toggle, readonly
  viewType: string;               // text, badge, tags, link, json-viewer
  widget: WidgetConfig | null;    // Advanced rendering (progress bars, etc.)
  editable: boolean;              // Can user edit this field?
  sortable: boolean;              // Can table sort by this field?
  visible: boolean;               // Show in default views?
  align?: 'left' | 'right' | 'center'; // Table alignment
}

export interface WidgetConfig {
  type: string;                   // date-range-progress, progress-bar, tags
  config: Record<string, any>;    // Widget-specific configuration
}

export interface EntityMetadata {
  entity: string;                 // Entity code (project, task, business)
  fields: FieldMetadata[];        // Array of field metadata
  generated_at: string;           // ISO timestamp
}

/**
 * Pattern matching rules for field detection
 */
const PATTERN_RULES: Record<string, Partial<FieldMetadata>> = {
  // Currency
  '*_amt': { type: 'currency', format: { symbol: '$', decimals: 2 }, editType: 'number', align: 'right' },
  '*_price': { type: 'currency', format: { symbol: '$', decimals: 2 }, editType: 'number', align: 'right' },
  '*_cost': { type: 'currency', format: { symbol: '$', decimals: 2 }, editType: 'number', align: 'right' },

  // Badge (Settings)
  'dl__*': { type: 'badge', format: { loadFromSettings: true }, editType: 'select', viewType: 'badge' },

  // Date/Time
  '*_date': { type: 'date', format: { style: 'short' }, editType: 'date', viewType: 'text' },
  '*_ts': { type: 'timestamp', format: { style: 'relative-time' }, editType: 'readonly', viewType: 'text' },
  'created_ts': { type: 'timestamp', format: { style: 'datetime' }, editType: 'readonly', viewType: 'text' },
  'updated_ts': { type: 'timestamp', format: { style: 'datetime' }, editType: 'readonly', viewType: 'text' },

  // Boolean
  '*_flag': { type: 'boolean', format: {}, editType: 'toggle', viewType: 'badge' },
  'is_*': { type: 'boolean', format: {}, editType: 'toggle', viewType: 'badge' },

  // Numeric
  '*_hours': { type: 'numeric', format: { decimals: 2 }, editType: 'number', align: 'right' },
  '*_points': { type: 'numeric', format: { decimals: 0 }, editType: 'number', align: 'right' },
  '*_headcount': { type: 'numeric', format: { decimals: 0 }, editType: 'number', align: 'right' },
  '*_pct': { type: 'percentage', format: { decimals: 1, symbol: '%' }, editType: 'number', align: 'right' },

  // References
  '*__employee_id': { type: 'reference', format: { entity: 'employee' }, editType: 'select', viewType: 'text' },
  '*__employee_ids': { type: 'array-reference', format: { entity: 'employee' }, editType: 'multiselect', viewType: 'tags' },
  'parent__*_id': { type: 'reference', format: { entity: 'auto' }, editType: 'select', viewType: 'text' },
  '*_id': { type: 'reference', format: { entity: 'auto' }, editType: 'select', viewType: 'text' },

  // URL
  '*_url': { type: 'url', format: {}, editType: 'text', viewType: 'link' },

  // JSON
  'metadata': { type: 'json', format: {}, editType: 'readonly', viewType: 'json-viewer' },

  // Special
  'id': { type: 'uuid', format: {}, editType: 'readonly', viewType: 'text', visible: false },
  'code': { type: 'text', format: {}, editType: 'text', viewType: 'text' },
  'version': { type: 'numeric', format: {}, editType: 'readonly', viewType: 'text', visible: false },
};

/**
 * Widget rules - detect multi-field patterns
 */
interface WidgetRule {
  pattern: string[];              // Field names to match (supports wildcards)
  widget: WidgetConfig;           // Widget configuration
  applyToFields: string[];        // Which fields get the widget
}

const WIDGET_RULES: WidgetRule[] = [
  // Date range progress
  {
    pattern: ['planned_start_date', 'planned_end_date'],
    widget: {
      type: 'date-range-progress',
      config: { startField: 'planned_start_date', endField: 'planned_end_date', showPercentage: true }
    },
    applyToFields: ['planned_start_date', 'planned_end_date']
  },
  {
    pattern: ['actual_start_date', 'actual_end_date'],
    widget: {
      type: 'date-range-progress',
      config: { startField: 'actual_start_date', endField: 'actual_end_date', showPercentage: true }
    },
    applyToFields: ['actual_start_date', 'actual_end_date']
  },

  // Hours progress
  {
    pattern: ['estimated_hours', 'actual_hours'],
    widget: {
      type: 'progress-bar',
      config: { maxField: 'estimated_hours', currentField: 'actual_hours', showPercentage: true, color: 'green' }
    },
    applyToFields: ['actual_hours']
  },

  // Budget progress
  {
    pattern: ['budget_allocated_amt', 'budget_spent_amt'],
    widget: {
      type: 'progress-bar',
      config: { maxField: 'budget_allocated_amt', currentField: 'budget_spent_amt', showPercentage: true, color: 'orange' }
    },
    applyToFields: ['budget_spent_amt']
  }
];

/**
 * Match field name against pattern (supports * wildcard)
 */
function matchPattern(fieldName: string, pattern: string): boolean {
  const regexPattern = pattern.replace(/\*/g, '.*');
  return new RegExp(`^${regexPattern}$`).test(fieldName);
}

/**
 * Generate human-readable label from field name
 */
function generateLabel(fieldName: string): string {
  // Remove prefixes
  let label = fieldName
    .replace(/^dl__/, '')
    .replace(/^parent__/, 'Parent ')
    .replace(/__employee_id(s)?$/, '')
    .replace(/_id$/, '')
    .replace(/_amt$/, '')
    .replace(/_date$/, '')
    .replace(/_ts$/, '')
    .replace(/_flag$/, '')
    .replace(/_url$/, '');

  // Convert snake_case to Title Case
  return label
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Detect entity name from *_id field
 * Example: office_id → office, manager__employee_id → employee
 */
function detectEntityFromFieldName(fieldName: string): string | null {
  // Pattern: *__entity_id → entity
  const match1 = fieldName.match(/^.*__(\w+)_id$/);
  if (match1) return match1[1];

  // Pattern: entity_id → entity
  const match2 = fieldName.match(/^(\w+)_id$/);
  if (match2 && match2[1] !== 'id') return match2[1];

  // Pattern: parent__entity_id → entity
  const match3 = fieldName.match(/^parent__(\w+)_id$/);
  if (match3) return match3[1];

  return null;
}

/**
 * Generate field metadata from column name
 */
function generateFieldMetadata(fieldName: string, dataType: string): FieldMetadata {
  // Default metadata
  let metadata: FieldMetadata = {
    key: fieldName,
    type: 'text',
    label: generateLabel(fieldName),
    format: {},
    editType: 'text',
    viewType: 'text',
    widget: null,
    editable: true,
    sortable: true,
    visible: true,
    align: 'left'
  };

  // Apply pattern rules
  for (const [pattern, rules] of Object.entries(PATTERN_RULES)) {
    if (matchPattern(fieldName, pattern)) {
      metadata = { ...metadata, ...rules };

      // Auto-detect entity for references
      if (metadata.format.entity === 'auto') {
        const detectedEntity = detectEntityFromFieldName(fieldName);
        if (detectedEntity) {
          metadata.format.entity = detectedEntity;
        }
      }

      break; // Use first matching pattern
    }
  }

  // Override editType based on data type constraints
  if (dataType === 'uuid' && metadata.type === 'text') {
    metadata.type = 'uuid';
    metadata.editType = 'readonly';
  }

  return metadata;
}

/**
 * Apply widget rules to field metadata array
 */
function applyWidgetRules(fields: FieldMetadata[]): FieldMetadata[] {
  const fieldNames = fields.map(f => f.key);

  for (const rule of WIDGET_RULES) {
    // Check if all pattern fields exist
    const hasAllFields = rule.pattern.every(p => fieldNames.includes(p));
    if (!hasAllFields) continue;

    // Apply widget to specified fields
    for (const targetField of rule.applyToFields) {
      const field = fields.find(f => f.key === targetField);
      if (field) {
        field.widget = rule.widget;
      }
    }
  }

  return fields;
}

/**
 * Generate metadata for an entity type
 */
export async function generateEntityMetadata(entityCode: string): Promise<EntityMetadata> {
  // Map entity code to table name
  const tableMap: Record<string, string> = {
    'business': 'app.business',
    'business_hierarchy': 'app.business_hierarchy',
    'project': 'app.project',
    'task': 'app.task'
  };

  const tableName = tableMap[entityCode];
  if (!tableName) {
    throw new Error(`Unknown entity: ${entityCode}`);
  }

  // Query database schema
  const columns = await db.execute<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'app'
       AND table_name = $1
     ORDER BY ordinal_position`,
    [tableName.replace('app.', '')]
  );

  // Generate field metadata
  let fields: FieldMetadata[] = columns.map(col =>
    generateFieldMetadata(col.column_name, col.data_type)
  );

  // Apply widget rules
  fields = applyWidgetRules(fields);

  return {
    entity: entityCode,
    fields,
    generated_at: new Date().toISOString()
  };
}

/**
 * Get cached metadata or generate fresh
 * TODO: Add Redis caching (5min TTL)
 */
let metadataCache: Map<string, EntityMetadata> = new Map();

export async function getEntityMetadata(entityCode: string): Promise<EntityMetadata> {
  // Check cache
  if (metadataCache.has(entityCode)) {
    return metadataCache.get(entityCode)!;
  }

  // Generate fresh metadata
  const metadata = await generateEntityMetadata(entityCode);

  // Cache it
  metadataCache.set(entityCode, metadata);

  return metadata;
}

/**
 * Clear metadata cache (call after DDL changes)
 */
export function clearMetadataCache(entityCode?: string): void {
  if (entityCode) {
    metadataCache.delete(entityCode);
  } else {
    metadataCache.clear();
  }
}
```

---

## 4. Route Integration (Modified Response)

Routes now include metadata in responses:

```typescript
// apps/api/src/modules/project/routes.ts

import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '@/services/entity-infrastructure.service.js';
import { getEntityMetadata } from '@/services/backend-formatter.service.js'; // NEW

const ENTITY_CODE = 'project';

// LIST endpoint
fastify.get('/api/v1/project', async (request, reply) => {
  const userId = request.user.sub;
  const { limit = 50, offset = 0 } = request.query;

  const entityInfra = getEntityInfrastructure(db);

  // 1. RBAC check (Entity Infrastructure Service - UNCHANGED)
  const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
    userId, ENTITY_CODE, Permission.VIEW, 'e'
  );

  // 2. Query data (Route owns this - UNCHANGED)
  const projects = await db.execute(sql`
    SELECT e.*
    FROM app.project e
    WHERE ${rbacCondition}
      AND e.active_flag = true
    ORDER BY e.created_ts DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  // 3. Resolve references (Entity Infrastructure Service - UNCHANGED)
  const resolved = await entityInfra.resolve_entity_references(projects, ENTITY_CODE);

  // 4. Generate metadata (Backend Formatter Service - NEW)
  const metadata = await getEntityMetadata(ENTITY_CODE);

  // 5. Return with metadata envelope
  return reply.send({
    data: resolved,
    metadata,
    pagination: { limit, offset, total: resolved.length }
  });
});
```

---

## 5. Frontend Formatter Service (SIMPLIFIED)

The frontend service becomes a **pure renderer** - no logic, just execution.

### 5.1 Location

`apps/web/src/lib/frontendFormatterService.ts`

### 5.2 Implementation

```typescript
// apps/web/src/lib/frontendFormatterService.ts

import type { FieldMetadata, EntityMetadata } from './types';

/**
 * Cache for entity metadata from backend
 */
const metadataCache = new Map<string, EntityMetadata>();

/**
 * Load metadata from API response
 */
export function loadMetadata(entityCode: string, metadata: EntityMetadata): void {
  metadataCache.set(entityCode, metadata);
}

/**
 * Get cached metadata for entity
 */
export function getMetadata(entityCode: string): EntityMetadata | null {
  return metadataCache.get(entityCode) || null;
}

/**
 * Get field metadata by key
 */
export function getFieldMetadata(entityCode: string, fieldKey: string): FieldMetadata | null {
  const entityMetadata = getMetadata(entityCode);
  if (!entityMetadata) return null;

  return entityMetadata.fields.find(f => f.key === fieldKey) || null;
}

/**
 * Format currency value
 */
function formatCurrency(value: number, format: Record<string, any>): string {
  const symbol = format.symbol || '$';
  const decimals = format.decimals || 2;
  return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/**
 * Format date value
 */
function formatDate(value: string, format: Record<string, any>): string {
  const date = new Date(value);
  const style = format.style || 'short';

  if (style === 'short') {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  }
  return date.toLocaleDateString();
}

/**
 * Format timestamp as relative time
 */
function formatRelativeTime(value: string): string {
  const now = new Date();
  const past = new Date(value);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
  return `${Math.floor(diffMins / 1440)} days ago`;
}

/**
 * Format value based on metadata type
 */
export function formatValue(value: any, metadata: FieldMetadata): string {
  if (value === null || value === undefined) return '-';

  switch (metadata.type) {
    case 'currency':
      return formatCurrency(value, metadata.format);

    case 'date':
      return formatDate(value, metadata.format);

    case 'timestamp':
      if (metadata.format.style === 'relative-time') {
        return formatRelativeTime(value);
      }
      return new Date(value).toLocaleString();

    case 'boolean':
      return value ? 'Yes' : 'No';

    case 'numeric':
    case 'percentage':
      const decimals = metadata.format.decimals || 0;
      const formatted = Number(value).toFixed(decimals);
      return metadata.type === 'percentage' ? `${formatted}%` : formatted;

    case 'url':
      return value;

    case 'array-reference':
    case 'tags':
      return Array.isArray(value) ? value.join(', ') : value;

    default:
      return String(value);
  }
}

/**
 * Render field as React element (view mode)
 */
export function renderFieldView(
  value: any,
  metadata: FieldMetadata,
  rowData?: Record<string, any>
): React.ReactNode {
  // Handle widgets
  if (metadata.widget) {
    switch (metadata.widget.type) {
      case 'date-range-progress':
        return <DateRangeProgress metadata={metadata} rowData={rowData} />;

      case 'progress-bar':
        return <ProgressBar metadata={metadata} rowData={rowData} />;

      case 'tags':
        return <TagsList values={value} />;
    }
  }

  // Handle view types
  switch (metadata.viewType) {
    case 'badge':
      return <Badge value={value} metadata={metadata} />;

    case 'link':
      return <a href={value} target="_blank" rel="noopener noreferrer">{value}</a>;

    case 'tags':
      return <TagsList values={value} />;

    case 'json-viewer':
      return <JSONViewer data={value} />;

    default:
      return <span>{formatValue(value, metadata)}</span>;
  }
}

/**
 * Render field as input (edit mode)
 */
export function renderFieldEdit(
  value: any,
  metadata: FieldMetadata,
  onChange: (newValue: any) => void
): React.ReactNode {
  if (metadata.editType === 'readonly') {
    return renderFieldView(value, metadata);
  }

  switch (metadata.editType) {
    case 'number':
      return <input type="number" value={value} onChange={e => onChange(e.target.value)} />;

    case 'date':
      return <input type="date" value={value} onChange={e => onChange(e.target.value)} />;

    case 'toggle':
      return <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} />;

    case 'select':
      // Load options from metadata.format.entity or loadFromSettings
      return <Select value={value} onChange={onChange} metadata={metadata} />;

    case 'multiselect':
      return <MultiSelect values={value} onChange={onChange} metadata={metadata} />;

    case 'textarea':
      return <textarea value={value} onChange={e => onChange(e.target.value)} />;

    default:
      return <input type="text" value={value} onChange={e => onChange(e.target.value)} />;
  }
}
```

---

## 6. Component Integration

### 6.1 EntityDataTable (Modified)

```typescript
// apps/web/src/components/EntityDataTable.tsx

import { useEffect } from 'react';
import { loadMetadata, getFieldMetadata, renderFieldView } from '@/lib/frontendFormatterService';

interface EntityDataTableProps {
  entityCode: string;
  data: any[];
  metadata?: EntityMetadata; // From API response
}

export function EntityDataTable({ entityCode, data, metadata }: EntityDataTableProps) {
  // Load metadata into cache
  useEffect(() => {
    if (metadata) {
      loadMetadata(entityCode, metadata);
    }
  }, [entityCode, metadata]);

  // Get visible fields
  const visibleFields = metadata?.fields.filter(f => f.visible) || [];

  return (
    <table>
      <thead>
        <tr>
          {visibleFields.map(field => (
            <th key={field.key} style={{ textAlign: field.align }}>
              {field.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, idx) => (
          <tr key={idx}>
            {visibleFields.map(field => {
              const fieldMeta = getFieldMetadata(entityCode, field.key);
              return (
                <td key={field.key} style={{ textAlign: field.align }}>
                  {fieldMeta ? renderFieldView(row[field.key], fieldMeta, row) : row[field.key]}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### 6.2 EntityFormContainer (Modified)

```typescript
// apps/web/src/components/EntityFormContainer.tsx

import { loadMetadata, getFieldMetadata, renderFieldEdit } from '@/lib/frontendFormatterService';

export function EntityFormContainer({ entityCode, initialData, metadata }: Props) {
  const [formData, setFormData] = useState(initialData);

  // Load metadata
  useEffect(() => {
    if (metadata) {
      loadMetadata(entityCode, metadata);
    }
  }, [entityCode, metadata]);

  // Get editable fields
  const editableFields = metadata?.fields.filter(f => f.editable) || [];

  return (
    <form>
      {editableFields.map(field => {
        const fieldMeta = getFieldMetadata(entityCode, field.key);
        if (!fieldMeta) return null;

        return (
          <div key={field.key}>
            <label>{field.label}</label>
            {renderFieldEdit(
              formData[field.key],
              fieldMeta,
              (newValue) => setFormData({ ...formData, [field.key]: newValue })
            )}
          </div>
        );
      })}
    </form>
  );
}
```

---

## 7. Widget Components (NEW)

Custom React components for advanced widgets:

```typescript
// apps/web/src/components/widgets/DateRangeProgress.tsx

interface DateRangeProgressProps {
  metadata: FieldMetadata;
  rowData: Record<string, any>;
}

export function DateRangeProgress({ metadata, rowData }: DateRangeProgressProps) {
  const { startField, endField, showPercentage } = metadata.widget!.config;

  const start = new Date(rowData[startField]);
  const end = new Date(rowData[endField]);
  const now = new Date();

  const total = end.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();
  const percentage = Math.min(100, Math.max(0, (elapsed / total) * 100));

  return (
    <div style={{ width: '100%' }}>
      <div style={{
        width: '100%',
        height: '20px',
        backgroundColor: '#e0e0e0',
        borderRadius: '4px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          backgroundColor: percentage > 100 ? 'red' : 'blue',
          transition: 'width 0.3s'
        }} />
      </div>
      {showPercentage && (
        <span style={{ fontSize: '12px', color: '#666' }}>
          {percentage.toFixed(1)}%
        </span>
      )}
    </div>
  );
}
```

```typescript
// apps/web/src/components/widgets/ProgressBar.tsx

export function ProgressBar({ metadata, rowData }: ProgressBarProps) {
  const { maxField, currentField, showPercentage, color } = metadata.widget!.config;

  const max = Number(rowData[maxField]);
  const current = Number(rowData[currentField]);
  const percentage = max > 0 ? (current / max) * 100 : 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{
        flex: 1,
        height: '20px',
        backgroundColor: '#e0e0e0',
        borderRadius: '4px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${Math.min(100, percentage)}%`,
          height: '100%',
          backgroundColor: percentage > 100 ? 'red' : color,
          transition: 'width 0.3s'
        }} />
      </div>
      {showPercentage && (
        <span style={{ fontSize: '12px', minWidth: '50px' }}>
          {percentage.toFixed(1)}%
        </span>
      )}
    </div>
  );
}
```

---

## 8. Implementation Phases

### Phase 1: Backend Foundation (Days 1-2)
1. Create `backend-formatter.service.ts`
2. Implement pattern detection rules
3. Implement widget detection rules
4. Add metadata generation logic
5. Add caching (in-memory → Redis later)
6. Unit tests for pattern matching

### Phase 2: Route Integration (Day 2)
1. Update `project/routes.ts` to include metadata
2. Update `business/routes.ts`
3. Update `task/routes.ts`
4. Test API responses with Postman

### Phase 3: Frontend Service (Day 3)
1. Create `frontendFormatterService.ts`
2. Implement metadata caching
3. Implement formatValue() for all types
4. Implement renderFieldView() for all viewTypes
5. Implement renderFieldEdit() for all editTypes

### Phase 4: Widget Components (Day 3)
1. Create DateRangeProgress component
2. Create ProgressBar component
3. Create TagsList component
4. Create JSONViewer component

### Phase 5: Component Integration (Day 4)
1. Update EntityDataTable to use metadata
2. Update EntityFormContainer to use metadata
3. Update FilteredDataTable
4. Test all views (list, detail, form)

### Phase 6: Testing & Refinement (Day 5)
1. End-to-end testing across all entities
2. Performance testing (metadata caching)
3. Edge case handling (missing fields, null values)
4. Documentation updates

---

## 9. Benefits

1. **Single Source of Truth**: Backend controls all field behavior
2. **Zero Frontend Config**: Add column to DB → Metadata auto-generates
3. **Consistent Formatting**: Same rules across all views
4. **Advanced Widgets**: Progress bars, timelines, etc. (view-specific)
5. **Easy to Extend**: Add new pattern → Works everywhere
6. **Cache-Friendly**: Metadata cached per entity (fast)
7. **Type-Safe**: Full TypeScript support

---

## 10. Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| Larger API payloads | Cache metadata separately; send only once per entity |
| Breaking changes if patterns change | Version metadata schema; support fallbacks |
| Frontend complexity | Keep frontend as pure renderer; logic in backend |
| Performance overhead | Redis caching (5min TTL); pre-generate metadata |

---

## 11. Next Steps

1. **Review & Approve**: Stakeholder review of design
2. **POC Implementation**: Start with `project` entity only
3. **Testing**: Validate metadata generation + rendering
4. **Rollout**: Extend to `business`, `task`, then all entities
5. **Documentation**: Update CLAUDE.md and service docs

---

**End of Design Document**
