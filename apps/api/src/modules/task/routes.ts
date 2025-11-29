/**
 * ============================================================================
 * TASK ROUTES MODULE - Universal Entity Pattern with Unified Data Gate
 * ============================================================================
 *
 * SEMANTICS & PURPOSE:
 * This module implements CRUD operations and metadata endpoints for the Task
 * entity following the PMO platform's Universal Entity System architecture.
 *
 * Tasks represent discrete work units with effort tracking (hours, story points),
 * priority levels, workflow stages, and assignee management. Tasks can be linked
 * to projects, business units, and worksites. They support kanban workflows,
 * case notes, activity timelines, and rich metadata.
 *
 * ============================================================================
 * DESIGN PATTERNS & ARCHITECTURE
 * ============================================================================
 *
 * 1. UNIFIED DATA GATE PATTERN (Security & Filtering)
 * ───────────────────────────────────────────────────
 * All endpoints use centralized permission checking via unified-data-gate.ts:
 *
 *   • RBAC_GATE - Row-level security with role inheritance
 *     - Direct employee permissions
 *     - Role-based permissions (employee → role → permissions)
 *     - Parent-VIEW inheritance (if parent has VIEW, children gain VIEW)
 *     - Parent-CREATE inheritance (if parent has CREATE, children gain CREATE)
 *
 * Usage Example:
 *   const canView = await entityInfra.check_entity_rbac(
 *     db, userId, ENTITY_CODE, id, Permission.VIEW
 *   );
 *
 * 2. CREATE-LINK-EDIT PATTERN (Parent-Child Relationships)
 * ─────────────────────────────────────────────────────────
 * Instead of nested creation endpoints, we use:
 *   1. Create entity independently: POST /api/v1/task
 *   2. Link to parent via entity_instance_link (automatic if parent context)
 *   3. Link assignees via entity_instance_link (relationship_type='assigned_to')
 *   4. Edit/view in context: GET /api/v1/project/:id/task
 *
 * Benefits:
 *   • Tasks exist independently (no orphans when parent deleted)
 *   • Many-to-many relationships supported naturally (task → multiple projects)
 *   • Assignee management via universal linkage API
 *
 * 3. MODULE-LEVEL CONSTANTS (DRY Principle)
 * ──────────────────────────────────────────
 *   const ENTITY_CODE = 'task';  // Used in all DB queries and gates
 *   const TABLE_ALIAS = 't';     // Consistent SQL alias
 *
 * ============================================================================
 * DATA MODEL
 * ============================================================================
 *
 * Primary Table: app.task
 *   • Core fields: id, code, name, descr, metadata, internal_url, shared_url
 *   • Workflow fields: dl__task_stage, dl__task_priority
 *   • Effort tracking: estimated_hours, actual_hours, story_points
 *   • Temporal: from_ts, to_ts, active_flag, created_ts, updated_ts, version
 *
 * Relationships (via entity_instance_link):
 *   • Parent entities: project, business, office, worksite, client
 *   • Child entities: artifact, form
 *   • Assignees: employee (relationship_type='assigned_to')
 *
 * Related Tables:
 *   • d_task_data - Case notes, rich editor content, activity logs
 *
 * Permissions (via entity_rbac):
 *   • Supports both entity-level (entity_id = 'all') and instance-level permissions
 *   • Permission levels: 0=VIEW, 1=EDIT, 2=SHARE, 3=DELETE, 4=CREATE, 5=OWNER
 *
 * ============================================================================
 * ENDPOINT CATALOG
 * ============================================================================
 *
 * CORE CRUD:
 *   GET    /api/v1/task                          - List tasks (with RBAC filtering)
 *   GET    /api/v1/task/:id                      - Get single task (RBAC checked)
 *   POST   /api/v1/task                          - Create task
 *   PUT    /api/v1/task/:id                      - Update task (RBAC checked)
 *   DELETE /api/v1/task/:id                      - Soft delete task (factory endpoint)
 *
 * KANBAN WORKFLOW:
 *   PATCH  /api/v1/task/:id/status               - Update task stage (Kanban drag-drop)
 *   GET    /api/v1/project/:projectId/tasks/kanban  - Get tasks for Kanban view
 *
 * CASE NOTES & ACTIVITY:
 *   GET    /api/v1/task/:taskId/case-notes       - Get case notes timeline
 *   POST   /api/v1/task/:taskId/case-notes       - Add case note with mentions
 *   GET    /api/v1/task/:taskId/activity         - Get activity timeline
 *
 * ASSIGNEE MANAGEMENT:
 *   GET    /api/v1/task/:id/assignees            - Get task assignees
 *   POST   /api/v1/linkage                       - Link employee to task (universal API)
 *   DELETE /api/v1/linkage/:id                   - Unlink assignee (universal API)
 *
 * FILTERING:
 *   GET    /api/v1/task?project_id={id}          - Filter by project
 *   GET    /api/v1/task?assigned_to__employee_id={id}  - Filter by assignee
 *   GET    /api/v1/task?dl__task_stage={stage}   - Filter by workflow stage
 *
 * ============================================================================
 * PERMISSION FLOW EXAMPLES
 * ============================================================================
 *
 * Example 1: List Tasks with RBAC
 *   1. User requests GET /api/v1/task
 *   2. entityInfra.get_entity_rbac_where_condition() generates SQL WHERE condition
 *   3. SQL query includes RBAC filtering via entity_rbac table
 *   4. Returns only tasks user can view
 *
 * Example 2: Create Task and Link to Project
 *   1. User requests POST /api/v1/task (with project_id in metadata)
 *   2. entityInfra.check_entity_rbac(Permission.CREATE) validates
 *   3. Create task in task table
 *   4. Frontend calls POST /api/v1/linkage to link task → project
 *   5. Frontend calls POST /api/v1/linkage to assign employee
 *
 * Example 3: Update Task Stage (Kanban)
 *   1. User drags task card to new column
 *   2. Frontend calls PATCH /api/v1/task/:id/status
 *   3. entityInfra.check_entity_rbac(Permission.EDIT) validates
 *   4. Update dl__task_stage with audit metadata
 *   5. Return updated task for optimistic UI
 *
 * Example 4: View Task Case Notes
 *   1. User opens task detail page
 *   2. Frontend calls GET /api/v1/task/:id/case-notes
 *   3. RBAC check: Can user VIEW this task?
 *   4. Query d_task_data for case_note and rich_note records
 *   5. Return chronological timeline with author info
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql, SQL } from 'drizzle-orm';
import {
  getUniversalColumnMetadata,
  filterUniversalColumns,
  getColumnsByMetadata
} from '../../lib/universal-schema-metadata.js';
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';
// ✅ Child entity factory for parent-child relationships
import { createChildEntityEndpointsFromMetadata } from '../../lib/child-entity-route-factory.js';
// ✅ Centralized unified data gate - loosely coupled API
// ✨ Entity Infrastructure Service - centralized infrastructure operations
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '../../services/entity-infrastructure.service.js';
// ✨ Universal auto-filter builder - zero-config query filtering
import { buildAutoFilters } from '../../lib/universal-filter-builder.js';
// ✨ Backend Formatter Service - component-aware metadata generation
import { generateEntityResponse } from '../../services/backend-formatter.service.js';
// ✨ Centralized Pagination Config
import { PAGINATION_CONFIG, getEntityLimit } from '../../lib/pagination.js';
// ✨ Datalabel Service - fetch datalabel options for dropdowns and DAG visualization

const TaskSchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  internal_url: Type.Optional(Type.String()),
  shared_url: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),

  // Status and priority
  dl__task_stage: Type.Optional(Type.String()),
  dl__task_priority: Type.Optional(Type.String()),

  // Effort tracking
  estimated_hours: Type.Optional(Type.Number()),
  actual_hours: Type.Optional(Type.Number()),
  story_points: Type.Optional(Type.Number()),

  // Temporal fields
  from_ts: Type.String(),
  to_ts: Type.Optional(Type.String()),
  active_flag: Type.Boolean(),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  version: Type.Number()
});

// Response schema for metadata-driven endpoints
const TaskWithMetadataSchema = Type.Object({
  data: TaskSchema,
  fields: Type.Array(Type.String()),  // Field names list
  metadata: Type.Any(),  // EntityMetadata - component-specific field metadata
});

// Task Records are deprecated - using single table approach from DDL

const CreateTaskSchema = Type.Object({
  code: Type.Optional(Type.String({ minLength: 1 })),
  name: Type.Optional(Type.String({ minLength: 1 })),
  descr: Type.Optional(Type.String()),
  internal_url: Type.Optional(Type.String()),
  shared_url: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),

  // Status and priority
  dl__task_stage: Type.Optional(Type.String()),
  dl__task_priority: Type.Optional(Type.String()),

  // Effort tracking
  estimated_hours: Type.Optional(Type.Number()),
  actual_hours: Type.Optional(Type.Number()),
  story_points: Type.Optional(Type.Number())});

const UpdateTaskSchema = Type.Partial(CreateTaskSchema);

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_CODE = 'task';
const TABLE_ALIAS = 't';

export async function taskRoutes(fastify: FastifyInstance) {
  // ✨ Initialize Entity Infrastructure Service
  const entityInfra = getEntityInfrastructure(db);

  // List tasks with filtering
  fastify.get('/api/v1/task', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        project_id: Type.Optional(Type.String()),
        assigned_to__employee_id: Type.Optional(Type.String()),
        dl__task_stage: Type.Optional(Type.String()),  // DDL column name (not task_status)
        task_type: Type.Optional(Type.String()),
        task_category: Type.Optional(Type.String()),
        worksite_id: Type.Optional(Type.String()),
        client_id: Type.Optional(Type.String()),
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100000 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        page: Type.Optional(Type.Number({ minimum: 1 })),
        parent_entity_code: Type.Optional(Type.String()),
        parent_entity_id: Type.Optional(Type.String({ format: 'uuid' })),
        view: Type.Optional(Type.String())  // 'entityListOfInstancesTable,kanbanView' or 'entityInstanceFormContainer'
      }),
      response: {
        200: Type.Object({
          data: Type.Array(TaskSchema),
          fields: Type.Array(Type.String()),
          metadata: Type.Any(),  // EntityMetadata - component-specific field metadata
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number()
        }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const {
      project_id, assigned_to__employee_id, dl__task_stage, task_type, task_category,
      worksite_id, client_id, active, search, limit = getEntityLimit(ENTITY_CODE), offset: queryOffset, page,
      parent_entity_code, parent_entity_id, view
    } = request.query as any;

    // Support both page (new standard) and offset (legacy) - NO fallback to unlimited
    const offset = page ? (page - 1) * limit : (queryOffset !== undefined ? queryOffset : 0);

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // NEW PATTERN: Route builds SQL, gates augment it
      // ═══════════════════════════════════════════════════════════════

      // Build JOINs array
      const joins: SQL[] = [];

      // GATE 2: PARENT-CHILD FILTERING (MANDATORY when parent context provided)
      if (parent_entity_code && parent_entity_id) {
        const parentJoin = sql`
        INNER JOIN app.entity_instance_link eil
          ON eil.child_entity_code = ${ENTITY_CODE}
          AND eil.child_entity_instance_id = ${sql.raw(TABLE_ALIAS
         || 'TABLE_ALIAS')}.id
          AND eil.entity_code = ${parent_entity_code}
          AND eil.entity_instance_id = ${parent_entity_id}
      `;
        joins.push(parentJoin);
      }

      // Build WHERE conditions array
      const conditions: SQL[] = [];

      // GATE 1: RBAC - Apply security filtering (REQUIRED)
      const rbacWhereClause = await entityInfra.get_entity_rbac_where_condition(userId, ENTITY_CODE, Permission.VIEW, TABLE_ALIAS
      );
      conditions.push(rbacWhereClause);

      // ✅ DEFAULT FILTER: Only show active records (not soft-deleted)
      // Can be overridden with ?active=false to show inactive records
      if (!('active' in (request.query as any))) {
        conditions.push(sql`${sql.raw(TABLE_ALIAS)}.active_flag = true`);
      }

      // ✨ UNIVERSAL AUTO-FILTER SYSTEM
      // Automatically builds filters from ANY query parameter based on field naming conventions
      // Supports: ?dl__task_stage=X, ?project_id=Y, ?active=true, ?search=keyword, etc.
      // See: apps/api/src/lib/universal-filter-builder.ts
      const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query as any, {
        overrides: {
          active: { column: 'active_flag', type: 'boolean' }
        },
        searchFields: ['name', 'descr', 'code']
      });
      conditions.push(...autoFilters);

      // Custom filter: assignee via entity_instance_link (requires complex EXISTS clause)
      if (assigned_to__employee_id !== undefined) {
        conditions.push(sql`EXISTS (
          SELECT 1 FROM app.entity_instance_link map
          WHERE map.entity_code = 'task'
            AND map.entity_instance_id = ${sql.raw(TABLE_ALIAS)}.id
            AND map.child_entity_code = 'employee'
            AND map.child_entity_instance_id = ${assigned_to__employee_id}::uuid
            AND map.relationship_type = 'assigned_to'
        )`);
      }

      // Compose JOIN clause
      const joinClause = joins.length > 0 ? sql.join(joins, sql` `) : sql``;

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM app.task t
        ${joinClause}
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      // Get paginated tasks with assignee names from entity_id_map
      const tasks = await db.execute(sql`
        SELECT
          t.id, t.code, t.name, t.descr,
          t.internal_url, t.shared_url,
          COALESCE(t.metadata, '{}'::jsonb) as metadata,
          -- Get assignee IDs from entity_instance_link
          COALESCE(
            (
              SELECT json_agg(map.child_entity_instance_id ORDER BY e.name)
              FROM app.entity_instance_link map
              JOIN app.employee e ON e.id = map.child_entity_instance_id
              WHERE map.entity_code = 'task'
                AND map.entity_instance_id = t.id
                AND map.child_entity_code = 'employee'
                AND map.relationship_type = 'assigned_to'
            ),
            '[]'::json
          ) as assignee_employee_ids,
          -- Get assignee names from entity_instance_link
          COALESCE(
            (
              SELECT json_agg(e.name ORDER BY e.name)
              FROM app.entity_instance_link map
              JOIN app.employee e ON e.id = map.child_entity_instance_id
              WHERE map.entity_code = 'task'
                AND map.entity_instance_id = t.id
                AND map.child_entity_code = 'employee'
                AND map.relationship_type = 'assigned_to'
            ),
            '[]'::json
          ) as assignee_employee_names,
          t.dl__task_stage,
          t.dl__task_priority,
          t.estimated_hours, t.actual_hours,
          t.story_points,
          -- Extract IDs from metadata JSONB
          (t.metadata->>'project_id')::text as project_id,
          (t.metadata->>'business_id')::text as business_id,
          (t.metadata->>'office_id')::text as office_id,
          t.from_ts, t.to_ts,
          t.active_flag,
          t.created_ts, t.updated_ts,
          t.version
        FROM app.task t
        ${joinClause}
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY t.created_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      // ═══════════════════════════════════════════════════════════════
      // ✨ BACKEND FORMATTER SERVICE V5.0 - Component-aware metadata
      // Parse requested view (convert view names to component names)
      // ═══════════════════════════════════════════════════════════════
      const requestedComponents = view
        ? view.split(',').map((v: string) => v.trim())
        : ['entityListOfInstancesTable', 'entityInstanceFormContainer', 'kanbanView'];

      // Generate response with metadata for requested components only
      const response = generateEntityResponse(ENTITY_CODE, tasks, {
        components: requestedComponents,
        total,
        limit,
        offset
      });

      return response;
    } catch (error) {
      fastify.log.error('Error fetching tasks:', error);
      console.error('Detailed task error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single task
  fastify.get('/api/v1/task/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      querystring: Type.Object({
        view: Type.Optional(Type.String()),  // 'entityInstanceFormContainer' or 'entityListOfInstancesTable'
      }),
      response: {
        200: TaskWithMetadataSchema,  // ✅ Fixed: Use metadata-driven schema
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { view } = request.query as any;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✅ CENTRALIZED UNIFIED DATA GATE - RBAC gate check
      // Uses: RBAC_GATE only (checkPermission)
      // ═══════════════════════════════════════════════════════════════
      const canView = await entityInfra.check_entity_rbac(
        userId,
        ENTITY_CODE,
        id,
        Permission.VIEW
      );

      if (!canView) {
        return reply.status(403).send({ error: 'No permission to view this task' });
      }

      // Get single task with assignee names from entity_id_map
      const task = await db.execute(sql`
        SELECT
          t.id, t.code, t.name, t.descr,
          t.internal_url, t.shared_url,
          COALESCE(t.metadata, '{}'::jsonb) as metadata,
          -- Get assignee IDs from entity_instance_link
          COALESCE(
            (
              SELECT json_agg(map.child_entity_instance_id ORDER BY e.name)
              FROM app.entity_instance_link map
              JOIN app.employee e ON e.id = map.child_entity_instance_id
              WHERE map.entity_code = 'task'
                AND map.entity_instance_id = t.id
                AND map.child_entity_code = 'employee'
                AND map.relationship_type = 'assigned_to'
            ),
            '[]'::json
          ) as assignee_employee_ids,
          -- Get assignee names from entity_instance_link
          COALESCE(
            (
              SELECT json_agg(e.name ORDER BY e.name)
              FROM app.entity_instance_link map
              JOIN app.employee e ON e.id = map.child_entity_instance_id
              WHERE map.entity_code = 'task'
                AND map.entity_instance_id = t.id
                AND map.child_entity_code = 'employee'
                AND map.relationship_type = 'assigned_to'
            ),
            '[]'::json
          ) as assignee_employee_names,
          t.dl__task_stage, t.dl__task_priority,
          t.estimated_hours, t.actual_hours, t.story_points,
          -- Extract IDs from metadata JSONB
          (t.metadata->>'project_id')::text as project_id,
          (t.metadata->>'business_id')::text as business_id,
          (t.metadata->>'office_id')::text as office_id,
          t.from_ts, t.to_ts, t.active_flag,
          t.created_ts, t.updated_ts, t.version
        FROM app.task t
        WHERE t.id = ${id}
      `);

      if (task.length === 0) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true
      };

      // ═══════════════════════════════════════════════════════════════
      // ✨ BACKEND FORMATTER SERVICE V5.0 - Component-aware metadata
      // Parse requested view (default to formContainer)
      // ═══════════════════════════════════════════════════════════════
      const requestedComponents = view
        ? view.split(',').map((v: string) => v.trim())
        : ['entityInstanceFormContainer'];

      const response = generateEntityResponse(ENTITY_CODE, [filterUniversalColumns(task[0], userPermissions)], {
        components: requestedComponents,
        total: 1,
        limit: 1,
        offset: 0
      });

      // Return first item (single entity)
      return {
        data: response.data[0],
        fields: response.fields,
        metadata: response.metadata,
      };
    } catch (error) {
      fastify.log.error('Error fetching task:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create task
  fastify.post('/api/v1/task', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateTaskSchema,
      response: {
        201: Type.Any(),  // Success response with created task
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const data = request.body as any;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // ═══════════════════════════════════════════════════════════════
    // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK
    // Check: Can user CREATE tasks?
    // ═══════════════════════════════════════════════════════════════
    const canCreate = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, ALL_ENTITIES_ID, Permission.CREATE);
    if (!canCreate) {
      return reply.status(403).send({ error: 'No permission to create tasks' });
    }

    // Auto-generate required fields if missing
    if (!data.name) data.name = 'Untitled';
    if (!data.code) data.code = `TASK-${Date.now()}`;

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - TRANSACTIONAL CREATE
      // All 4 steps (INSERT + registry + RBAC + linkage) in ONE transaction
      // ═══════════════════════════════════════════════════════════════
      const result = await entityInfra.create_entity({
        entity_code: ENTITY_CODE,
        creator_id: userId,
        primary_table: 'app.task',
        primary_data: {
          code: data.code || `TASK-${Date.now()}`,
          name: data.name || 'Untitled Task',
          descr: data.descr || null,
          metadata: data.metadata ? JSON.stringify(data.metadata) : '{}',
          dl__task_stage: data.dl__task_stage || null,
          dl__task_priority: data.dl__task_priority || 'medium',
          estimated_hours: data.estimated_hours || null,
          actual_hours: data.actual_hours || 0,
          story_points: data.story_points || null,
          active_flag: true
        }
      });

      // NOTE: Assignees should be managed separately via the Linkage API
      // POST /api/v1/linkage with parent_entity_type='task', child_entity_type='employee'

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true};

      return reply.status(201).send(filterUniversalColumns(result.entity, userPermissions));
    } catch (error) {
      fastify.log.error('Error creating task:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Update Task (PATCH)
  // ============================================================================

  fastify.patch('/api/v1/task/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })}),
      body: UpdateTaskSchema,
      response: {
        200: TaskSchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // ═══════════════════════════════════════════════════════════════
    // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK
    // Check: Can user EDIT this task?
    // ═══════════════════════════════════════════════════════════════
    const canEdit = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, id, Permission.EDIT);
    if (!canEdit) {
      return reply.status(403).send({ error: 'No permission to edit this task' });
    }

    try {
      // Check if task exists
      const existing = await db.execute(sql`
        SELECT id FROM app.task WHERE id = ${id}
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      const updateFields = [];

      // Update only fields that exist in d_task DDL (19_d_task.ddl)
      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`descr = ${data.descr}`);
      if (data.code !== undefined) updateFields.push(sql`code = ${data.code}`);
      if (data.internal_url !== undefined) updateFields.push(sql`internal_url = ${data.internal_url}`);
      if (data.shared_url !== undefined) updateFields.push(sql`shared_url = ${data.shared_url}`);
      if (data.metadata !== undefined) updateFields.push(sql`metadata = ${JSON.stringify(data.metadata)}::jsonb`);
      if (data.dl__task_stage !== undefined) updateFields.push(sql`dl__task_stage = ${data.dl__task_stage}`);
      if (data.dl__task_priority !== undefined) updateFields.push(sql`dl__task_priority = ${data.dl__task_priority}`);
      if (data.estimated_hours !== undefined) updateFields.push(sql`estimated_hours = ${data.estimated_hours}`);
      if (data.actual_hours !== undefined) updateFields.push(sql`actual_hours = ${data.actual_hours}`);
      if (data.story_points !== undefined) updateFields.push(sql`story_points = ${data.story_points}`);
      if (data.active_flag !== undefined) updateFields.push(sql`active_flag = ${data.active_flag}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = NOW()`);

      // ✅ Route owns UPDATE query
      const result = await db.execute(sql`
        UPDATE app.task
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update task' });
      }

      const updatedTask = result[0] as any;

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Sync registry if name/code changed
      // ═══════════════════════════════════════════════════════════════
      if (data.name !== undefined || data.code !== undefined) {
        await entityInfra.update_entity_instance_registry(ENTITY_CODE, id, {
          entity_name: data.name,
          instance_code: data.code
        });
      }

      // NOTE: Assignees should be managed separately via the Linkage API
      // POST /api/v1/linkage to add assignees
      // DELETE /api/v1/linkage/:id to remove assignees

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true};

      return filterUniversalColumns(updatedTask, userPermissions);
    } catch (error) {
      fastify.log.error('Error updating task:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Update Task (PUT - alias to PATCH for frontend compatibility)
  // ============================================================================

  fastify.put('/api/v1/task/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })}),
      body: UpdateTaskSchema,
      response: {
        200: TaskSchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;

    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // ═══════════════════════════════════════════════════════════════
    // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK
    // Check: Can user EDIT this task?
    // ═══════════════════════════════════════════════════════════════
    const canEdit = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, id, Permission.EDIT);
    if (!canEdit) {
      return reply.status(403).send({ error: 'No permission to edit this task' });
    }

    try {
      // Check if task exists
      const existing = await db.execute(sql`
        SELECT id FROM app.task WHERE id = ${id}
      `);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      const updateFields = [];

      // Update only fields that exist in d_task DDL (19_d_task.ddl)
      if (data.name !== undefined) updateFields.push(sql`name = ${data.name}`);
      if (data.descr !== undefined) updateFields.push(sql`descr = ${data.descr}`);
      if (data.code !== undefined) updateFields.push(sql`code = ${data.code}`);
      if (data.internal_url !== undefined) updateFields.push(sql`internal_url = ${data.internal_url}`);
      if (data.shared_url !== undefined) updateFields.push(sql`shared_url = ${data.shared_url}`);
      if (data.metadata !== undefined) updateFields.push(sql`metadata = ${JSON.stringify(data.metadata)}::jsonb`);
      if (data.dl__task_stage !== undefined) updateFields.push(sql`dl__task_stage = ${data.dl__task_stage}`);
      if (data.dl__task_priority !== undefined) updateFields.push(sql`dl__task_priority = ${data.dl__task_priority}`);
      if (data.estimated_hours !== undefined) updateFields.push(sql`estimated_hours = ${data.estimated_hours}`);
      if (data.actual_hours !== undefined) updateFields.push(sql`actual_hours = ${data.actual_hours}`);
      if (data.story_points !== undefined) updateFields.push(sql`story_points = ${data.story_points}`);
      if (data.active_flag !== undefined) updateFields.push(sql`active_flag = ${data.active_flag}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = NOW()`);

      // ✅ Route owns UPDATE query
      const result = await db.execute(sql`
        UPDATE app.task
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update task' });
      }

      const updatedTask = result[0] as any;

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Sync registry if name/code changed
      // ═══════════════════════════════════════════════════════════════
      if (data.name !== undefined || data.code !== undefined) {
        await entityInfra.update_entity_instance_registry(ENTITY_CODE, id, {
          entity_name: data.name,
          instance_code: data.code
        });
      }

      // NOTE: Assignees should be managed separately via the Linkage API
      // POST /api/v1/linkage to add assignees
      // DELETE /api/v1/linkage/:id to remove assignees

      const userPermissions = {
        canSeePII: true,
        canSeeFinancial: true,
        canSeeSystemFields: true,
        canSeeSafetyInfo: true};

      return filterUniversalColumns(updatedTask, userPermissions);
    } catch (error) {
      fastify.log.error('Error updating task:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Delete Task (Soft Delete via Factory)
  // ============================================================================
  // Delete task with cascading cleanup (soft delete)
  // Uses universal delete factory pattern - deletes from:
  // 1. app.task (base entity table)
  // 2. app.entity_instance (entity registry)
  // 3. app.entity_instance_link (linkages in both directions)
  createEntityDeleteEndpoint(fastify, ENTITY_CODE);

  // Kanban status update endpoint (for drag-drop operations)
  fastify.patch('/api/v1/task/:id/status', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['task', 'kanban'],
      summary: 'Update task status (Kanban)',
      description: 'Updates task status for Kanban drag-drop operations with optimistic UI support',
      params: Type.Object({
        id: Type.String({ format: 'uuid' })}),
      body: Type.Object({
        task_status: Type.String({ enum: ['backlog', 'in_progress', 'blocked', 'done', 'completed'] }),
        position: Type.Optional(Type.Number()),
        moved_by: Type.Optional(Type.String())}),
      response: {
        200: Type.Object({
          id: Type.String(),
          task_status: Type.String(),
          updated: Type.String()}),
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { task_status, position, moved_by } = request.body as any;
      const userId = (request as any).user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // ═══════════════════════════════════════════════════════════════
      // ✅ CENTRALIZED UNIFIED DATA GATE - RBAC GATE
      // Uses: RBAC_GATE only (checkPermission)
      // Check: Can user EDIT this task?
      // ═══════════════════════════════════════════════════════════════
      const canEdit = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, id, Permission.EDIT);
      if (!canEdit) {
        return reply.status(403).send({ error: 'No permission to edit this task' });
      }

      // Validate task exists
      const existingTask = await db.execute(sql`
        SELECT id, name, dl__task_stage FROM app.task
        WHERE id = ${id} AND active_flag = true
      `);

      if (existingTask.length === 0) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      // Update task status with audit info
      const updateResult = await db.execute(sql`
        UPDATE app.task
        SET
          dl__task_stage = ${task_status},
          updated_ts = NOW(),
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'kanban_moved_at', NOW()::text,
            'kanban_moved_by', ${moved_by || userId},
            'kanban_position', ${position || 0}
          )
        WHERE id = ${id}
        RETURNING id, dl__task_stage as task_status, updated_ts as updated
      `);

      if (updateResult.length === 0) {
        return reply.status(404).send({ error: 'Failed to update task' });
      }

      return {
        id: String(updateResult[0].id),
        task_status: String(updateResult[0].task_status),
        updated: String(updateResult[0].updated)};
    } catch (error) {
      fastify.log.error('Error updating task status:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Update Task Status (PUT - alias to PATCH for frontend compatibility)
  // ============================================================================

  fastify.put('/api/v1/task/:id/status', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['task', 'kanban'],
      summary: 'Update task status (Kanban)',
      description: 'Updates task status for Kanban drag-drop operations with optimistic UI support',
      params: Type.Object({
        id: Type.String({ format: 'uuid' })}),
      body: Type.Object({
        task_status: Type.String({ enum: ['backlog', 'in_progress', 'blocked', 'done', 'completed'] }),
        position: Type.Optional(Type.Number()),
        moved_by: Type.Optional(Type.String())}),
      response: {
        200: Type.Object({
          id: Type.String(),
          task_status: Type.String(),
          updated: Type.String()}),
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { task_status, position, moved_by } = request.body as any;
      const userId = (request as any).user?.sub;

      if (!userId) {
        return reply.status(401).send({ error: 'User not authenticated' });
      }

      // ═══════════════════════════════════════════════════════════════
      // ✅ CENTRALIZED UNIFIED DATA GATE - RBAC GATE
      // Uses: RBAC_GATE only (checkPermission)
      // Check: Can user EDIT this task?
      // ═══════════════════════════════════════════════════════════════
      const canEdit = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, id, Permission.EDIT);
      if (!canEdit) {
        return reply.status(403).send({ error: 'No permission to edit this task' });
      }

      // Validate task exists
      const existingTask = await db.execute(sql`
        SELECT id, name, dl__task_stage FROM app.task
        WHERE id = ${id} AND active_flag = true
      `);

      if (existingTask.length === 0) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      // Update task status with audit info
      const updateResult = await db.execute(sql`
        UPDATE app.task
        SET
          dl__task_stage = ${task_status},
          updated_ts = NOW(),
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'kanban_moved_at', NOW()::text,
            'kanban_moved_by', ${moved_by || userId},
            'kanban_position', ${position || 0}
          )
        WHERE id = ${id}
        RETURNING id, dl__task_stage as task_status, updated_ts as updated
      `);

      if (updateResult.length === 0) {
        return reply.status(404).send({ error: 'Failed to update task' });
      }

      return {
        id: String(updateResult[0].id),
        task_status: String(updateResult[0].task_status),
        updated: String(updateResult[0].updated)};
    } catch (error) {
      fastify.log.error('Error updating task status:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get Kanban view data for project
  fastify.get('/api/v1/project/:projectId/tasks/kanban', {
    
    schema: {
      tags: ['task', 'kanban', 'project'],
      summary: 'Get tasks for Kanban view',
      description: 'Returns tasks grouped by status for Kanban board display',
      params: Type.Object({
        projectId: Type.String({ format: 'uuid' })}),
      querystring: Type.Object({
        assignee: Type.Optional(Type.String()),
        priority: Type.Optional(Type.String())}),
      response: {
        200: Type.Object({
          project: Type.Object({
            id: Type.String(),
            name: Type.String()}),
          columns: Type.Object({
            backlog: Type.Array(TaskSchema),
            in_progress: Type.Array(TaskSchema),
            blocked: Type.Array(TaskSchema),
            done: Type.Array(TaskSchema)}),
          stats: Type.Object({
            total: Type.Number(),
            by_status: Type.Record(Type.String(), Type.Number())})}),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const { assignee, priority } = request.query as any;
      const employeeId = (request as any).user?.sub;

      // Get project info
      const project = await db.execute(sql`
        SELECT id, name FROM app.project 
        WHERE id = ${projectId} AND active_flag = true
      `);

      if (project.length === 0) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      // Build filter conditions
      // Project relationship stored in metadata JSONB
      const filters = [
        sql`(t.metadata->>'project_id')::uuid = ${projectId}::uuid`,
        sql`t.active_flag = true`
      ];

      // Assignee relationship managed via entity_instance_link
      if (assignee) {
        filters.push(sql`EXISTS (
          SELECT 1 FROM app.entity_instance_link map
          WHERE map.entity_code = 'task'
            AND map.entity_instance_id = t.id
            AND map.child_entity_code = 'employee'
            AND map.child_entity_instance_id = ${assignee}::uuid
            AND map.relationship_type = 'assigned_to'
        )`);
      }

      if (priority) filters.push(sql`t.dl__task_priority = ${priority}`);

      // Get all tasks for the project
      const tasks = await db.execute(sql`
        SELECT t.* FROM app.task t
        WHERE ${sql.join(filters, sql` AND `)}
        ORDER BY
          CASE t.dl__task_stage
            WHEN 'backlog' THEN 1
            WHEN 'in_progress' THEN 2
            WHEN 'blocked' THEN 3
            WHEN 'done' THEN 4
            ELSE 5
          END,
          (t.metadata->>'kanban_position')::int NULLS LAST,
          t.created_ts
      `);

      // Group tasks by status
      const columns = {
        backlog: tasks.filter(t => t.dl__task_stage === 'backlog'),
        in_progress: tasks.filter(t => t.dl__task_stage === 'in_progress'),
        blocked: tasks.filter(t => t.dl__task_stage === 'blocked'),
        done: tasks.filter(t => ['done', 'completed'].includes(String(t.dl__task_stage)))};

      // Calculate stats
      const stats = {
        total: tasks.length,
        by_status: {
          backlog: columns.backlog.length,
          in_progress: columns.in_progress.length,
          blocked: columns.blocked.length,
          done: columns.done.length}};

      return {
        project: {
          id: String(project[0].id),
          name: String(project[0].name)},
        columns,
        stats};
    } catch (error) {
      fastify.log.error('Error fetching Kanban data:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Case notes for tasks (rich editor support)
  fastify.get('/api/v1/task/:taskId/case-notes', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['task', 'case-notes'],
      summary: 'Get task case notes',
      description: 'Returns case notes timeline with rich content for task detail view',
      params: Type.Object({
        taskId: Type.String({ format: 'uuid' })}),
      response: {
        200: Type.Object({
          task_id: Type.String(),
          notes: Type.Array(Type.Object({
            id: Type.String(),
            content: Type.String(),
            content_type: Type.String(),
            author_id: Type.String(),
            author_name: Type.String(),
            created_at: Type.String(),
            updated_at: Type.String(),
            mentions: Type.Array(Type.String()),
            attachments: Type.Array(Type.Object({
              id: Type.String(),
              filename: Type.String(),
              size: Type.Number(),
              mime_type: Type.String()}))}))}),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const { taskId } = request.params as { taskId: string };
      const employeeId = (request as any).user?.sub;

      // RBAC check for task access using centralized service
      const canView = await entityInfra.check_entity_rbac(employeeId, ENTITY_CODE, taskId, Permission.VIEW);

      if (!canView) {
        return reply.status(404).send({ error: 'Task not found or access denied' });
      }

      // Get case notes from task records table
      const notes = await db.execute(sql`
        SELECT
          tr.id,
          tr.record_content as content,
          tr.record_type as content_type,
          tr.created_by__employee_id as author_id,
          e.name as author_name,
          tr.created as created_at,
          tr.updated as updated_at,
          COALESCE(tr.metadata->>'mentions', '[]')::jsonb as mentions,
          COALESCE(tr.metadata->>'attachments', '[]')::jsonb as attachments
        FROM app.task_data tr
        LEFT JOIN app.employee e ON e.id = tr.created_by__employee_id
        WHERE tr.task_id = ${taskId}
          AND tr.record_type IN ('case_note', 'rich_note')
          AND tr.active_flag = true
        ORDER BY tr.created DESC
      `);

      const formattedNotes = notes.map(note => ({
        id: String(note.id),
        content: String(note.content),
        content_type: String(note.content_type),
        author_id: String(note.author_id),
        author_name: String(note.author_name || 'Unknown'),
        created_at: String(note.created_at),
        updated_at: String(note.updated_at),
        mentions: Array.isArray(note.mentions) ? note.mentions.map(String) : [],
        attachments: Array.isArray(note.attachments) ? note.attachments : []}));

      return {
        task_id: taskId,
        notes: formattedNotes};
    } catch (error) {
      fastify.log.error('Error fetching case notes:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Add case note to task
  fastify.post('/api/v1/task/:taskId/case-notes', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['task', 'case-notes'],
      summary: 'Add case note to task',
      description: 'Adds a new case note with rich content and mentions to task',
      params: Type.Object({
        taskId: Type.String({ format: 'uuid' })}),
      body: Type.Object({
        content: Type.String({ minLength: 1 }),
        content_type: Type.Optional(Type.String({ enum: ['case_note', 'rich_note', 'log_entry'] })),
        mentions: Type.Optional(Type.Array(Type.String())),
        attachments: Type.Optional(Type.Array(Type.Object({
          filename: Type.String(),
          size: Type.Number(),
          mime_type: Type.String(),
          data: Type.Optional(Type.String())})))}),
      response: {
        201: Type.Object({
          id: Type.String(),
          content: Type.String(),
          author_name: Type.String(),
          created_at: Type.String()}),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const { taskId } = request.params as { taskId: string };
      const { content, content_type = 'case_note', mentions = [], attachments = [] } = request.body as any;
      const employeeId = (request as any).user?.sub;

      // RBAC check for task edit access using centralized service
      const canEdit = await entityInfra.check_entity_rbac(employeeId, ENTITY_CODE, taskId, Permission.EDIT);

      if (!canEdit) {
        return reply.status(404).send({ error: 'Task not found or access denied' });
      }

      // Get author name
      const authorResult = await db.execute(sql`
        SELECT name FROM app.employee WHERE id = ${employeeId}
      `);
      const authorName = authorResult[0]?.name || 'Unknown';

      // Insert case note
      const noteResult = await db.execute(sql`
        INSERT INTO app.d_task_data (
          task_id,
          project_id,
          record_type,
          record_content,
          updated_by__employee_id,
          metadata,
          active_flag
        ) VALUES (
          ${taskId}::uuid,
          (SELECT (metadata->>'project_id')::uuid FROM app.task WHERE id = ${taskId}::uuid),
          ${content_type},
          ${content},
          ${employeeId}::uuid,
          ${JSON.stringify({ mentions, attachments })}::jsonb,
          true
        )
        RETURNING id, created_ts as created
      `);

      return reply.status(201).send({
        id: String(noteResult[0].id),
        content,
        author_name: String(authorName),
        created_at: String(noteResult[0].created)});
    } catch (error) {
      fastify.log.error('Error adding case note:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Activity timeline for task
  fastify.get('/api/v1/task/:taskId/activity', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['task', 'activity'],
      summary: 'Get task activity timeline',
      description: 'Returns chronological activity feed for task with system and user events',
      params: Type.Object({
        taskId: Type.String({ format: 'uuid' })}),
      response: {
        200: Type.Object({
          task_id: Type.String(),
          activities: Type.Array(Type.Object({
            id: Type.String(),
            activity_type: Type.String(),
            description: Type.String(),
            actor_id: Type.Optional(Type.String()),
            actor_name: Type.Optional(Type.String()),
            timestamp: Type.String(),
            changes: Type.Optional(Type.Object({})),
            metadata: Type.Optional(Type.Object({}))}))}),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })}}}, async (request, reply) => {
    try {
      const { taskId } = request.params as { taskId: string };
      const employeeId = (request as any).user?.sub;

      // RBAC check for task access using centralized service
      const canView = await entityInfra.check_entity_rbac(employeeId, ENTITY_CODE, taskId, Permission.VIEW);

      if (!canView) {
        return reply.status(404).send({ error: 'Task not found or access denied' });
      }

      // Get all task records for activity feed
      const activities = await db.execute(sql`
        SELECT
          tr.id,
          tr.record_type as activity_type,
          tr.record_content as description,
          tr.updated_by__employee_id as actor_id,
          e.name as actor_name,
          tr.created_ts as timestamp,
          tr.metadata
        FROM app.task_data tr
        LEFT JOIN app.employee e ON e.id = tr.updated_by__employee_id
        WHERE tr.task_id = ${taskId}
          AND tr.active_flag = true

        UNION ALL

        -- Add system events from task updates
        SELECT
          gen_random_uuid() as id,
          'system_update' as activity_type,
          CASE
            WHEN t.created_ts = t.updated_ts THEN 'Task created'
            ELSE 'Task updated'
          END as description,
          NULL as actor_id,
          'System' as actor_name,
          t.updated_ts as timestamp,
          t.metadata
        FROM app.task t
        WHERE t.id = ${taskId}
          AND t.active_flag = true

        ORDER BY timestamp DESC
        LIMIT 50
      `);

      const formattedActivities = activities.map(activity => ({
        id: String(activity.id),
        activity_type: String(activity.activity_type),
        description: String(activity.description),
        actor_id: activity.actor_id ? String(activity.actor_id) : undefined,
        actor_name: String(activity.actor_name || 'Unknown'),
        timestamp: String(activity.timestamp),
        changes: undefined, // TODO: Implement change tracking
        metadata: activity.metadata ? JSON.parse(String(activity.metadata)) : undefined}));

      return {
        task_id: taskId,
        activities: formattedActivities};
    } catch (error) {
      fastify.log.error('Error fetching task activity:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ========================================
  // TASK ASSIGNEES (via entity_id_map)
  // ========================================

  // Get task assignees
  fastify.get('/api/v1/task/:id/assignees', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })}),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
            email: Type.Optional(Type.String()),
            linkage_id: Type.String()
          }))
        }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    // Check RBAC permission to view task using centralized service
    const canViewTask = await entityInfra.check_entity_rbac(userId, ENTITY_CODE, id, Permission.VIEW);

    if (!canViewTask) {
      return reply.status(403).send({ error: 'Insufficient permissions to view this task' });
    }

    try {
      // Get assignees from entity_instance_link
      const assignees = await db.execute(sql`
        SELECT
          e.id,
          e.name,
          e.email,
          map.id as linkage_id
        FROM app.entity_instance_link map
        INNER JOIN app.employee e ON e.id = map.child_entity_instance_id
        WHERE map.entity_code = 'task'
          AND map.entity_instance_id = ${id}::uuid
          AND map.child_entity_code = 'employee'
          AND map.relationship_type = 'assigned_to'
        ORDER BY e.name
      `);

      return reply.send({
        success: true,
        data: assignees.map(a => ({
          id: String(a.id),
          name: String(a.name),
          email: a.email ? String(a.email) : undefined,
          linkage_id: String(a.linkage_id)}))});
    } catch (error) {
      fastify.log.error('Error fetching task assignees:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ========================================
  // CHILD ENTITY CREATION
  // ========================================
  // Child entities (form, artifact) are created using:
  // 1. Universal entity create endpoint: POST /api/v1/:childType
  // 2. Linkage API: POST /api/v1/linkage to link child to parent
  // 3. Navigate to child detail page for editing
  // No special endpoints needed - reuses existing universal APIs

  // ============================================================================
  // Child Entity Endpoints (Auto-Generated from entity metadata)
  // ============================================================================
  // Creates: GET /api/v1/task/:id/{child} for each child in entity table.child_entity_codes
  // Uses Entity Infrastructure Service for RBAC + entity_instance_link for parent-child filtering
  await createChildEntityEndpointsFromMetadata(fastify, ENTITY_CODE);
}