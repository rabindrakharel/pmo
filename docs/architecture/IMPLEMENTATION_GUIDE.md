# Backend Metadata Architecture - Implementation Guide

**Version**: 1.0
**Date**: 2025-01-19
**Entities**: business, project, task

---

## Quick Start Summary

This guide shows **exactly how to implement** the backend-driven metadata architecture for the PMO platform.

### What's Changing?

| Component | Before (v3.x) | After (v4.0) |
|-----------|---------------|--------------|
| **Detection Logic** | Frontend (universalFormatterService) | Backend (backendFormatterService) |
| **Metadata Source** | Naming patterns in frontend | API response metadata envelope |
| **Frontend Role** | Detect + Render | Render only |
| **Entity Infra Service** | ✅ Unchanged | ✅ Unchanged |

### What's NOT Changing?

- **Entity Infrastructure Service**: 100% unchanged (RBAC, linkage, registry)
- **Route Query Logic**: Routes still own SELECT/UPDATE/INSERT queries
- **Database Schema**: No DDL changes required
- **Universal Filter Builder**: Keeps working as-is

---

## Part 1: Backend Formatter Service

### File: `apps/api/src/services/backend-formatter.service.ts`

```typescript
/**
 * Backend Formatter Service
 *
 * RESPONSIBILITY:
 * Generate field metadata from database column names using convention-based pattern matching.
 *
 * NOT RESPONSIBLE FOR:
 * - RBAC (handled by Entity Infrastructure Service)
 * - Data queries (handled by route modules)
 * - Reference resolution (handled by Entity Infrastructure Service)
 */

import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface FieldMetadata {
  key: string;                      // Column name (e.g., "budget_allocated_amt")
  type: string;                     // Field type (currency, date, badge, reference, etc.)
  label: string;                    // Human-readable label ("Budget Allocated")
  format: Record<string, any>;      // Type-specific formatting rules
  editType: string;                 // Input type for forms (number, select, date, toggle)
  viewType: string;                 // Display type for tables (text, badge, tags, link)
  widget: WidgetConfig | null;      // Advanced widget configuration
  editable: boolean;                // Can user edit this field?
  sortable: boolean;                // Can table sort by this column?
  visible: boolean;                 // Show in default views?
  align?: 'left' | 'right' | 'center'; // Table cell alignment
  optionsEndpoint?: string;         // Endpoint for dropdown options (settings/entities)
}

export interface WidgetConfig {
  type: string;                     // Widget type (date-range-progress, progress-bar, tags)
  config: Record<string, any>;      // Widget-specific configuration
}

export interface EntityMetadata {
  entity: string;                   // Entity code (project, task, business)
  fields: FieldMetadata[];          // Array of field metadata
  generated_at: string;             // ISO timestamp
}

// ============================================================================
// PATTERN RULES - Convention Over Configuration
// ============================================================================

/**
 * Pattern matching rules for automatic field detection
 *
 * Format: 'pattern': { metadata overrides }
 * Patterns support * wildcard (e.g., "*_amt" matches "budget_allocated_amt")
 */
const PATTERN_RULES: Record<string, Partial<FieldMetadata>> = {
  // === CURRENCY FIELDS ===
  '*_amt': {
    type: 'currency',
    format: { symbol: '$', decimals: 2 },
    editType: 'number',
    viewType: 'text',
    align: 'right'
  },
  '*_price': {
    type: 'currency',
    format: { symbol: '$', decimals: 2 },
    editType: 'number',
    viewType: 'text',
    align: 'right'
  },
  '*_cost': {
    type: 'currency',
    format: { symbol: '$', decimals: 2 },
    editType: 'number',
    viewType: 'text',
    align: 'right'
  },

  // === BADGE FIELDS (Settings-driven) ===
  'dl__*': {
    type: 'badge',
    format: { loadFromSettings: true },
    editType: 'select',
    viewType: 'badge'
  },

  // === DATE/TIME FIELDS ===
  '*_date': {
    type: 'date',
    format: { style: 'short' },
    editType: 'date',
    viewType: 'text'
  },
  '*_ts': {
    type: 'timestamp',
    format: { style: 'relative-time' },
    editType: 'readonly',
    viewType: 'text'
  },
  'created_ts': {
    type: 'timestamp',
    format: { style: 'datetime' },
    editType: 'readonly',
    viewType: 'text'
  },
  'updated_ts': {
    type: 'timestamp',
    format: { style: 'datetime' },
    editType: 'readonly',
    viewType: 'text'
  },

  // === BOOLEAN FIELDS ===
  '*_flag': {
    type: 'boolean',
    format: {},
    editType: 'toggle',
    viewType: 'badge'
  },
  'is_*': {
    type: 'boolean',
    format: {},
    editType: 'toggle',
    viewType: 'badge'
  },

  // === NUMERIC FIELDS ===
  '*_hours': {
    type: 'numeric',
    format: { decimals: 2 },
    editType: 'number',
    viewType: 'text',
    align: 'right'
  },
  '*_points': {
    type: 'numeric',
    format: { decimals: 0 },
    editType: 'number',
    viewType: 'text',
    align: 'right'
  },
  '*_headcount': {
    type: 'numeric',
    format: { decimals: 0 },
    editType: 'number',
    viewType: 'text',
    align: 'right'
  },
  '*_pct': {
    type: 'percentage',
    format: { decimals: 1, symbol: '%' },
    editType: 'number',
    viewType: 'text',
    align: 'right'
  },

  // === REFERENCE FIELDS (Entity links) ===
  '*__employee_id': {
    type: 'reference',
    format: { entity: 'employee' },
    editType: 'select',
    viewType: 'text'
  },
  '*__employee_ids': {
    type: 'array-reference',
    format: { entity: 'employee' },
    editType: 'multiselect',
    viewType: 'tags'
  },
  'parent__*_id': {
    type: 'reference',
    format: { entity: 'auto' }, // Will auto-detect from field name
    editType: 'select',
    viewType: 'text'
  },
  '*_id': {
    type: 'reference',
    format: { entity: 'auto' },
    editType: 'select',
    viewType: 'text'
  },

  // === URL FIELDS ===
  '*_url': {
    type: 'url',
    format: {},
    editType: 'text',
    viewType: 'link'
  },

  // === JSON FIELDS ===
  'metadata': {
    type: 'json',
    format: {},
    editType: 'readonly',
    viewType: 'json-viewer',
    visible: false
  },

  // === SPECIAL FIELDS ===
  'id': {
    type: 'uuid',
    format: {},
    editType: 'readonly',
    viewType: 'text',
    visible: false,
    sortable: false
  },
  'code': {
    type: 'text',
    format: {},
    editType: 'text',
    viewType: 'text'
  },
  'version': {
    type: 'numeric',
    format: {},
    editType: 'readonly',
    viewType: 'text',
    visible: false
  }
};

// ============================================================================
// WIDGET RULES - Multi-Field Patterns
// ============================================================================

interface WidgetRule {
  pattern: string[];                // Field names to match
  widget: WidgetConfig;             // Widget configuration
  applyToFields: string[];          // Which fields receive the widget
}

/**
 * Widget rules detect multi-field patterns and apply advanced rendering
 *
 * Example: If both "planned_start_date" and "planned_end_date" exist,
 * attach a date-range-progress widget to both fields.
 */
const WIDGET_RULES: WidgetRule[] = [
  // === DATE RANGE PROGRESS ===
  {
    pattern: ['planned_start_date', 'planned_end_date'],
    widget: {
      type: 'date-range-progress',
      config: {
        startField: 'planned_start_date',
        endField: 'planned_end_date',
        showPercentage: true,
        color: 'blue'
      }
    },
    applyToFields: ['planned_start_date', 'planned_end_date']
  },
  {
    pattern: ['actual_start_date', 'actual_end_date'],
    widget: {
      type: 'date-range-progress',
      config: {
        startField: 'actual_start_date',
        endField: 'actual_end_date',
        showPercentage: true,
        color: 'green'
      }
    },
    applyToFields: ['actual_start_date', 'actual_end_date']
  },

  // === HOURS PROGRESS BAR ===
  {
    pattern: ['estimated_hours', 'actual_hours'],
    widget: {
      type: 'progress-bar',
      config: {
        maxField: 'estimated_hours',
        currentField: 'actual_hours',
        showPercentage: true,
        color: 'green',
        label: 'Hours Progress'
      }
    },
    applyToFields: ['actual_hours']
  },

  // === BUDGET PROGRESS BAR ===
  {
    pattern: ['budget_allocated_amt', 'budget_spent_amt'],
    widget: {
      type: 'progress-bar',
      config: {
        maxField: 'budget_allocated_amt',
        currentField: 'budget_spent_amt',
        showPercentage: true,
        color: 'orange',
        label: 'Budget Spent'
      }
    },
    applyToFields: ['budget_spent_amt']
  }
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Match field name against pattern (supports * wildcard)
 *
 * Examples:
 *   matchPattern("budget_allocated_amt", "*_amt") → true
 *   matchPattern("manager__employee_id", "*__employee_id") → true
 *   matchPattern("name", "*_amt") → false
 */
function matchPattern(fieldName: string, pattern: string): boolean {
  const regexPattern = pattern.replace(/\*/g, '.*');
  return new RegExp(`^${regexPattern}$`).test(fieldName);
}

/**
 * Generate human-readable label from field name
 *
 * Examples:
 *   generateLabel("budget_allocated_amt") → "Budget Allocated"
 *   generateLabel("dl__project_stage") → "Project Stage"
 *   generateLabel("manager__employee_id") → "Manager"
 */
function generateLabel(fieldName: string): string {
  let label = fieldName
    // Remove common prefixes
    .replace(/^dl__/, '')
    .replace(/^parent__/, 'Parent ')
    // Remove common suffixes
    .replace(/__employee_id(s)?$/, '')
    .replace(/_id$/, '')
    .replace(/_amt$/, '')
    .replace(/_date$/, '')
    .replace(/_ts$/, '')
    .replace(/_flag$/, '')
    .replace(/_url$/, '')
    .replace(/_hours$/, '')
    .replace(/_points$/, '');

  // Convert snake_case to Title Case
  return label
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Detect entity name from reference field
 *
 * Examples:
 *   detectEntityFromFieldName("office_id") → "office"
 *   detectEntityFromFieldName("manager__employee_id") → "employee"
 *   detectEntityFromFieldName("parent__business_hierarchy_id") → "business_hierarchy"
 */
function detectEntityFromFieldName(fieldName: string): string | null {
  // Pattern 1: *__entity_id → entity
  const match1 = fieldName.match(/^.*__(\w+)_id$/);
  if (match1) return match1[1];

  // Pattern 2: entity_id → entity
  const match2 = fieldName.match(/^(\w+)_id$/);
  if (match2 && match2[1] !== 'id') return match2[1];

  // Pattern 3: parent__entity_id → entity
  const match3 = fieldName.match(/^parent__(.+)_id$/);
  if (match3) return match3[1];

  return null;
}

/**
 * Add options endpoint for select/multiselect fields
 */
function addOptionsEndpoint(metadata: FieldMetadata): void {
  if (metadata.format.loadFromSettings) {
    // Settings-based dropdown (dl__* fields)
    const datalabel = metadata.key; // e.g., "dl__project_stage"
    metadata.optionsEndpoint = `/api/v1/entity/${metadata.key.split('__')[1]}/entity-instance-lookup`;
  } else if (metadata.format.entity && metadata.format.entity !== 'auto') {
    // Entity-based dropdown
    const entityCode = metadata.format.entity;
    metadata.optionsEndpoint = `/api/v1/entity/${entityCode}/entity-instance-lookup`;
  }
}

// ============================================================================
// CORE METADATA GENERATION
// ============================================================================

/**
 * Generate field metadata from column name + data type
 */
function generateFieldMetadata(fieldName: string, dataType: string): FieldMetadata {
  // Start with defaults
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

  // Apply pattern rules (first match wins)
  for (const [pattern, rules] of Object.entries(PATTERN_RULES)) {
    if (matchPattern(fieldName, pattern)) {
      metadata = { ...metadata, ...rules };

      // Auto-detect entity for reference fields
      if (metadata.format.entity === 'auto') {
        const detectedEntity = detectEntityFromFieldName(fieldName);
        if (detectedEntity) {
          metadata.format.entity = detectedEntity;
        }
      }

      break; // Stop at first match
    }
  }

  // Add options endpoint for dropdowns
  if (metadata.editType === 'select' || metadata.editType === 'multiselect') {
    addOptionsEndpoint(metadata);
  }

  // Override for specific data types
  if (dataType === 'uuid' && metadata.type === 'text') {
    metadata.type = 'uuid';
    metadata.editType = 'readonly';
  }
  if (dataType === 'jsonb') {
    metadata.type = 'json';
    metadata.editType = 'readonly';
    metadata.viewType = 'json-viewer';
  }

  return metadata;
}

/**
 * Apply widget rules to field metadata array
 */
function applyWidgetRules(fields: FieldMetadata[]): FieldMetadata[] {
  const fieldNames = fields.map(f => f.key);

  for (const rule of WIDGET_RULES) {
    // Check if all required fields exist
    const hasAllFields = rule.pattern.every(p => fieldNames.includes(p));
    if (!hasAllFields) continue;

    // Apply widget to target fields
    for (const targetField of rule.applyToFields) {
      const field = fields.find(f => f.key === targetField);
      if (field) {
        field.widget = rule.widget;
      }
    }
  }

  return fields;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Entity code → table name mapping
 */
const TABLE_MAP: Record<string, string> = {
  'business': 'business',
  'business_hierarchy': 'business_hierarchy',
  'project': 'project',
  'task': 'task'
};

/**
 * Generate metadata for an entity by inspecting database schema
 */
export async function generateEntityMetadata(entityCode: string): Promise<EntityMetadata> {
  const tableName = TABLE_MAP[entityCode];
  if (!tableName) {
    throw new Error(`Unknown entity: ${entityCode}`);
  }

  // Query PostgreSQL schema for columns
  const result = await db.execute<{ column_name: string; data_type: string }>(sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'app'
      AND table_name = ${tableName}
    ORDER BY ordinal_position
  `);

  // Generate field metadata for each column
  let fields: FieldMetadata[] = result.map(col =>
    generateFieldMetadata(col.column_name, col.data_type)
  );

  // Apply widget rules (cross-field patterns)
  fields = applyWidgetRules(fields);

  return {
    entity: entityCode,
    fields,
    generated_at: new Date().toISOString()
  };
}

/**
 * In-memory cache (TODO: Replace with Redis in production)
 */
const metadataCache = new Map<string, EntityMetadata>();

/**
 * Get entity metadata (cached)
 */
export async function getEntityMetadata(entityCode: string): Promise<EntityMetadata> {
  // Check cache
  if (metadataCache.has(entityCode)) {
    return metadataCache.get(entityCode)!;
  }

  // Generate fresh metadata
  const metadata = await generateEntityMetadata(entityCode);

  // Cache it (5min TTL in production with Redis)
  metadataCache.set(entityCode, metadata);

  return metadata;
}

/**
 * Clear cache (call after DDL changes)
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

## Part 2: Route Integration

### Example: Project Routes (`apps/api/src/modules/project/routes.ts`)

**Key Changes**:
1. Import `getEntityMetadata` from backend formatter service
2. Add metadata to response envelope
3. **No changes** to Entity Infrastructure Service usage

```typescript
// apps/api/src/modules/project/routes.ts

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { sql } from 'drizzle-orm';
import { db } from '@/db/index.js';

// Universal libraries (UNCHANGED)
import { buildAutoFilters } from '../../lib/universal-filter-builder.js';

// Entity Infrastructure Service (UNCHANGED)
import {
  getEntityInfrastructure,
  Permission,
  ALL_ENTITIES_ID
} from '../../services/entity-infrastructure.service.js';

// Backend Formatter Service (NEW)
import { getEntityMetadata } from '../../services/backend-formatter.service.js';

// Factory functions (UNCHANGED)
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';
import { createChildEntityEndpointsFromMetadata } from '../../lib/child-entity-route-factory.js';

// Module constants
const ENTITY_CODE = 'project';
const TABLE_ALIAS = 'e';

export default async function (fastify: FastifyInstance) {
  const entityInfra = getEntityInfrastructure(db);

  // ==========================================================================
  // LIST ENDPOINT - GET /api/v1/project
  // ==========================================================================
  fastify.get('/api/v1/project', {
    schema: {
      querystring: Type.Object({
        limit: Type.Optional(Type.Number({ default: 50 })),
        offset: Type.Optional(Type.Number({ default: 0 })),
        dl__project_stage: Type.Optional(Type.String()),
        manager__employee_id: Type.Optional(Type.String()),
        budget_allocated_amt: Type.Optional(Type.Number()),
        search: Type.Optional(Type.String())
      })
    }
  }, async (request, reply) => {
    const userId = request.user.sub;
    const { limit = 50, offset = 0 } = request.query;

    // STEP 1: RBAC filtering (Entity Infrastructure Service - UNCHANGED)
    const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
      userId,
      ENTITY_CODE,
      Permission.VIEW,
      TABLE_ALIAS
    );

    // STEP 2: Build query filters (Universal Filter Builder - UNCHANGED)
    const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query);

    // STEP 3: Query database (Route owns this - UNCHANGED)
    const query = sql`
      SELECT
        ${TABLE_ALIAS}.*
      FROM app.project ${TABLE_ALIAS}
      WHERE ${rbacCondition}
        AND ${TABLE_ALIAS}.active_flag = true
        ${autoFilters.length > 0 ? sql`AND ${sql.join(autoFilters, sql` AND `)}` : sql``}
      ORDER BY ${TABLE_ALIAS}.created_ts DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const projects = await db.execute(query);

    // STEP 4: Resolve entity references (Entity Infrastructure Service - UNCHANGED)
    const resolved = await entityInfra.resolve_entity_references(projects, ENTITY_CODE);

    // STEP 5: Get metadata (Backend Formatter Service - NEW)
    const metadata = await getEntityMetadata(ENTITY_CODE);

    // STEP 6: Return with metadata envelope (NEW)
    return reply.send({
      data: resolved,
      metadata,
      pagination: {
        limit,
        offset,
        total: resolved.length
      }
    });
  });

  // ==========================================================================
  // GET SINGLE - GET /api/v1/project/:id
  // ==========================================================================
  fastify.get('/api/v1/project/:id', async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.sub;

    // RBAC check (Entity Infrastructure Service - UNCHANGED)
    const canView = await entityInfra.check_entity_rbac(
      userId,
      ENTITY_CODE,
      id,
      Permission.VIEW
    );

    if (!canView) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    // Query data (Route owns this - UNCHANGED)
    const result = await db.execute(sql`
      SELECT * FROM app.project WHERE id = ${id}
    `);

    if (result.length === 0) {
      return reply.status(404).send({ error: 'Not found' });
    }

    // Resolve references (Entity Infrastructure Service - UNCHANGED)
    const resolved = await entityInfra.resolve_entity_references([result[0]], ENTITY_CODE);

    // Get metadata (Backend Formatter Service - NEW)
    const metadata = await getEntityMetadata(ENTITY_CODE);

    // Return with metadata (NEW)
    return reply.send({
      data: resolved[0],
      metadata
    });
  });

  // ==========================================================================
  // CREATE - POST /api/v1/project
  // ==========================================================================
  fastify.post('/api/v1/project', {
    schema: {
      body: Type.Object({
        code: Type.String(),
        name: Type.String(),
        descr: Type.Optional(Type.String()),
        dl__project_stage: Type.Optional(Type.String()),
        budget_allocated_amt: Type.Optional(Type.Number()),
        planned_start_date: Type.Optional(Type.String()),
        planned_end_date: Type.Optional(Type.String()),
        manager__employee_id: Type.Optional(Type.String())
      }),
      querystring: Type.Object({
        parent_code: Type.Optional(Type.String()),
        parent_id: Type.Optional(Type.String())
      })
    }
  }, async (request, reply) => {
    const userId = request.user.sub;
    const data = request.body;
    const { parent_code, parent_id } = request.query;

    // 6-STEP CREATE PATTERN (Entity Infrastructure Service - UNCHANGED)

    // STEP 1: Type-level CREATE permission check
    const canCreate = await entityInfra.check_entity_rbac(
      userId,
      ENTITY_CODE,
      ALL_ENTITIES_ID,
      Permission.CREATE
    );
    if (!canCreate) {
      return reply.status(403).send({ error: 'Forbidden: No CREATE permission' });
    }

    // STEP 2: Parent EDIT permission check (if linking)
    if (parent_code && parent_id) {
      const canEditParent = await entityInfra.check_entity_rbac(
        userId,
        parent_code,
        parent_id,
        Permission.EDIT
      );
      if (!canEditParent) {
        return reply.status(403).send({ error: 'Forbidden: Cannot link to parent' });
      }
    }

    // STEP 3: Insert into primary table (Route owns this - UNCHANGED)
    const result = await db.execute(sql`
      INSERT INTO app.project (
        code, name, descr, dl__project_stage,
        budget_allocated_amt, planned_start_date, planned_end_date,
        manager__employee_id, active_flag
      ) VALUES (
        ${data.code}, ${data.name}, ${data.descr || null}, ${data.dl__project_stage || 'Planning'},
        ${data.budget_allocated_amt || 0}, ${data.planned_start_date || null}, ${data.planned_end_date || null},
        ${data.manager__employee_id || null}, true
      )
      RETURNING *
    `);

    const project = result[0];

    // STEP 4: Register in entity_instance (Entity Infrastructure Service - UNCHANGED)
    await entityInfra.set_entity_instance_registry({
      entity_type: ENTITY_CODE,
      entity_id: project.id,
      entity_name: project.name,
      entity_code: project.code
    });

    // STEP 5: Grant OWNER permission (Entity Infrastructure Service - UNCHANGED)
    await entityInfra.set_entity_rbac_owner(userId, ENTITY_CODE, project.id);

    // STEP 6: Link to parent (Entity Infrastructure Service - UNCHANGED)
    if (parent_code && parent_id) {
      await entityInfra.set_entity_instance_link({
        parent_entity_type: parent_code,
        parent_entity_id: parent_id,
        child_entity_type: ENTITY_CODE,
        child_entity_id: project.id,
        relationship_type: 'contains'
      });
    }

    // Get metadata (Backend Formatter Service - NEW)
    const metadata = await getEntityMetadata(ENTITY_CODE);

    // Return with metadata (NEW)
    return reply.status(201).send({
      data: project,
      metadata
    });
  });

  // ==========================================================================
  // UPDATE - PATCH /api/v1/project/:id
  // ==========================================================================
  fastify.patch('/api/v1/project/:id', async (request, reply) => {
    const { id } = request.params;
    const data = request.body;
    const userId = request.user.sub;

    // 3-STEP UPDATE PATTERN (Entity Infrastructure Service - UNCHANGED)

    // STEP 1: EDIT permission check
    const canEdit = await entityInfra.check_entity_rbac(
      userId,
      ENTITY_CODE,
      id,
      Permission.EDIT
    );
    if (!canEdit) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    // STEP 2: Update primary table (Route owns this - UNCHANGED)
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push(`name = $${values.length + 1}`);
      values.push(data.name);
    }
    if (data.descr !== undefined) {
      updates.push(`descr = $${values.length + 1}`);
      values.push(data.descr);
    }
    if (data.dl__project_stage !== undefined) {
      updates.push(`dl__project_stage = $${values.length + 1}`);
      values.push(data.dl__project_stage);
    }
    if (data.budget_allocated_amt !== undefined) {
      updates.push(`budget_allocated_amt = $${values.length + 1}`);
      values.push(data.budget_allocated_amt);
    }

    updates.push(`updated_ts = now()`);
    updates.push(`version = version + 1`);
    values.push(id);

    const result = await db.execute(sql`
      UPDATE app.project
      SET ${sql.raw(updates.join(', '))}
      WHERE id = $${values.length}
      RETURNING *
    `, values);

    // STEP 3: Sync entity_instance registry (Entity Infrastructure Service - UNCHANGED)
    if (data.name !== undefined || data.code !== undefined) {
      await entityInfra.update_entity_instance_registry(ENTITY_CODE, id, {
        entity_name: data.name,
        entity_code: data.code
      });
    }

    // Get metadata (Backend Formatter Service - NEW)
    const metadata = await getEntityMetadata(ENTITY_CODE);

    // Return with metadata (NEW)
    return reply.send({
      data: result[0],
      metadata
    });
  });

  // ==========================================================================
  // FACTORY ENDPOINTS (UNCHANGED)
  // ==========================================================================

  // Soft delete endpoint
  await createEntityDeleteEndpoint(fastify, {
    entityCode: ENTITY_CODE,
    tableName: 'app.project',
    primaryKey: 'id'
  });

  // Child entity endpoints
  await createChildEntityEndpointsFromMetadata(fastify, {
    parentEntityCode: ENTITY_CODE,
    parentTableName: 'app.project'
  });
}
```

---

## Part 3: Testing the Backend

### Test 1: Generate Metadata

```bash
# Start API server
./tools/start-all.sh

# Test with auth (use test-api.sh or get JWT first)
./tools/test-api.sh GET "/api/v1/project?limit=1&view=entityDataTable,entityFormContainer"

# Or manually:
curl -X GET "http://localhost:4000/api/v1/project?limit=1&view=entityDataTable" \
  -H "Authorization: Bearer YOUR_JWT" \
  | jq '.'
```

**Expected Response** (see `docs/services/backend-formatter.service.md` for full documentation):

```json
{
  "data": [
    {
      "id": "50192aab-000a-17c5-6904-1065b04a0a0b",
      "code": "CSE-2024-001",
      "name": "Customer Service Excellence Initiative",
      "dl__project_stage": "Execution",
      "budget_allocated_amt": 200000,
      "manager__employee_id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
      "_ID": { "manager": { "entity_code": "employee", "manager": "James Miller" } }
    }
  ],
  "fields": ["id", "code", "name", "dl__project_stage", "budget_allocated_amt", "..."],
  "metadata": {
    "entityDataTable": {
      "budget_allocated_amt": {
        "dtype": "float",
        "format": "currency",
        "viewType": "currency",
        "editType": "currency",
        "currencySymbol": "$",
        "decimals": 2,
        "locale": "en-CA",
        "visible": true,
        "editable": true,
        "filterable": true,
        "sortable": true,
        "align": "right",
        "width": "140px",
        "label": "Budget Allocated"
      },
      "dl__project_stage": {
        "dtype": "str",
        "format": "datalabel_lookup",
        "viewType": "badge",
        "editType": "select",
        "datalabelKey": "dl__project_stage",
        "visible": true,
        "editable": true,
        "label": "Project Stage"
      },
      "manager__employee_id": {
        "dtype": "uuid",
        "format": "reference",
        "viewType": "text",
        "editType": "select",
        "loadFromEntity": "employee",
        "endpoint": "/api/v1/entity/employee/entity-instance-lookup",
        "displayField": "name",
        "valueField": "id",
        "visible": true,
        "editable": true,
        "label": "Manager Employee Name"
      }
    }
  },
  "datalabels": [
    {
      "name": "dl__project_stage",
      "options": [
        { "id": 0, "name": "Initiation", "parent_id": null, "color_code": "blue" },
        { "id": 1, "name": "Planning", "parent_id": 0, "color_code": "purple" },
        { "id": 2, "name": "Execution", "parent_id": 1, "color_code": "yellow" }
      ]
    }
  ],
  "globalSettings": {
    "currency": { "symbol": "$", "decimals": 2, "locale": "en-CA" },
    "date": { "format": "MM/DD/YYYY", "locale": "en-US" },
    "boolean": { "trueLabel": "Yes", "falseLabel": "No" }
  },
  "total": 5,
  "limit": 1,
  "offset": 0
}
```

**Key Response Properties:**

| Property | Description |
|----------|-------------|
| `data` | Entity instances with resolved references (`_ID`, `_IDS`) |
| `fields` | Ordered field names from database |
| `metadata` | **Component-keyed** field metadata (e.g., `entityDataTable`, `entityFormContainer`) |
| `datalabels` | Dropdown options for `dl__*` fields with DAG structure (`parent_id`) |
| `globalSettings` | Global formatting config (currency, date, timestamp, boolean) |
| `total`, `limit`, `offset` | Pagination info |

---

## Summary

### What We Built

1. **Backend Formatter Service** (`apps/api/src/services/backend-formatter.service.ts`)
   - Pattern matching (35+ rules) for automatic field type detection
   - Component-aware metadata generation (`entityDataTable`, `entityFormContainer`, etc.)
   - Datalabel extraction and fetching for `dl__*` fields
   - Global settings for consistent formatting

2. **Route Integration**: All entity routes use the standard response pattern
   - `generateEntityResponse()` creates complete response with metadata
   - `extractDatalabelKeys()` identifies dropdown fields
   - `fetchDatalabels()` loads dropdown options with DAG structure
   - Entity Infrastructure Service handles RBAC and relationships

3. **Response Structure**: Component-keyed field metadata
   - `data` - Entity instances with resolved references (`_ID`, `_IDS`)
   - `fields` - Ordered field names from database
   - `metadata` - Component-specific field configurations
   - `datalabels` - Dropdown options with parent-child structure
   - `globalSettings` - Currency, date, timestamp, boolean formatting

### Documentation References

| Document | Description |
|----------|-------------|
| `docs/services/backend-formatter.service.md` | Complete API response documentation |
| `docs/services/entity-infrastructure.service.md` | RBAC and infrastructure operations |
| `docs/services/frontEndFormatterService.md` | Frontend rendering documentation |

### Next: Frontend Implementation

See `docs/services/frontEndFormatterService.md` for:
- Frontend formatter service (pure renderer - no pattern detection)
- Component updates (EntityDataTable, EntityFormContainer, EntityDetailView)
- Metadata-driven rendering (`renderViewModeFromMetadata`, `renderEditModeFromMetadata`)
- Integration with React Query caching

---

**End of Implementation Guide**
