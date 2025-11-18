/**
 * ============================================================================
 * PROJECT ROUTES MODULE - Universal Entity Pattern with Unified Data Gate
 * ============================================================================
 *
 * SEMANTICS & PURPOSE:
 * This module implements CRUD operations and metadata endpoints for the Project
 * entity following the PMO platform's Universal Entity System architecture.
 *
 * Projects represent work initiatives with defined scope, timeline, budget, and
 * stakeholders. They can be linked to parent entities (business units, offices)
 * and contain child entities (tasks, wiki, artifacts, forms, expenses, revenue).
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
 *   • PARENT_CHILD_FILTERING_GATE - Context-aware data filtering
 *     - Filters entities by parent relationship via entity_instance_link
 *     - Enables create-link-edit pattern (create child, link to parent)
 *
 * Usage Example:
 *   const canView = await unified_data_gate.rbac_gate.check_entity_rbac(
 *     db, userId, ENTITY_TYPE, id, Permission.VIEW
 *   );
 *
 * 2. CREATE-LINK-EDIT PATTERN (Parent-Child Relationships)
 * ─────────────────────────────────────────────────────────
 * Instead of nested creation endpoints, we use:
 *   1. Create entity independently: POST /api/v1/project
 *   2. Link to parent via entity_instance_link (automatic if parent_type/parent_id provided)
 *   3. Edit/view in context: GET /api/v1/project?parent_type=business&parent_id={id}
 *
 * Benefits:
 *   • Entities exist independently (no orphans when parent deleted)
 *   • Many-to-many relationships supported naturally
 *   • Simpler API surface (no custom nested endpoints)
 *
 * 3. FACTORY PATTERN (Child Entity Endpoints - Database-Driven)
 * ────────────────────────────────────────────────────────────
 * Child entity endpoints auto-generated via createChildEntityEndpointsFromMetadata():
 *   • Reads child_entity_codes from entity table (single source of truth)
 *   • Auto-creates: GET /api/v1/project/:id/task, /api/v1/project/:id/wiki, etc.
 *   • Zero maintenance - add child to entity DDL, routes auto-generated
 *
 * No manual endpoint code needed - factory handles:
 *   • RBAC filtering (unified_data_gate)
 *   • Parent-child JOIN via entity_instance_link
 *   • Pagination, search, sorting
 *
 * 4. UNIVERSAL AUTO-FILTER PATTERN (Zero-Config Filtering)
 * ──────────────────────────────────────────────────────────
 * Query parameters automatically converted to SQL filters based on naming conventions:
 *   • ?name=Kitchen → WHERE name = 'Kitchen'
 *   • ?dl__project_stage=planning → WHERE dl__project_stage = 'planning'
 *   • ?active=true → WHERE active_flag = true
 *   • ?manager_employee_id=uuid → WHERE manager_employee_id::uuid = 'uuid'::uuid
 *   • ?search=kitchen → WHERE (name ILIKE '%kitchen%' OR code ILIKE '%kitchen%' OR ...)
 *
 * See: apps/api/src/lib/universal-filter-builder.ts
 *
 * 5. MODULE-LEVEL CONSTANTS (DRY Principle)
 * ──────────────────────────────────────────
 *   const ENTITY_TYPE = 'project';  // Used in all DB queries and gates
 *   const TABLE_ALIAS = 'e';        // Consistent SQL alias
 *
 * ============================================================================
 * DATA MODEL
 * ============================================================================
 *
 * Primary Table: app.project
 *   • Core fields: id, code, name, descr, metadata
 *   • Project-specific: dl__project_stage, budget_allocated_amt, budget_spent_amt
 *   • Timeline: planned_start_date, planned_end_date, actual_start_date, actual_end_date
 *   • Team: manager_employee_id, sponsor_employee_id, stakeholder_employee_ids
 *   • Temporal: from_ts, to_ts, active_flag, created_ts, updated_ts, version
 *
 * Relationships (via entity_instance_link):
 *   • Parent entities: business, office
 *   • Child entities: task, wiki, artifact, form, expense, revenue
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
 *   GET    /api/v1/project                    - List projects (with RBAC + optional parent filter)
 *   GET    /api/v1/project/:id                - Get single project (RBAC checked)
 *   POST   /api/v1/project                    - Create project (with optional parent linking)
 *   PATCH  /api/v1/project/:id                - Update project (RBAC checked)
 *   DELETE /api/v1/project/:id                - Soft delete project (factory endpoint)
 *
 * METADATA:
 *   GET    /api/v1/project/:id/dynamic-child-entity-tabs  - Child tab counts
 *   GET    /api/v1/project/:id/creatable                  - Creatable child types (based on user permissions)
 *
 * CHILD ENTITIES (Factory-Generated):
 *   GET    /api/v1/project/:id/task          - List tasks for project
 *   GET    /api/v1/project/:id/wiki          - List wiki entries for project
 *   GET    /api/v1/project/:id/artifact      - List artifacts for project
 *   GET    /api/v1/project/:id/form          - List forms for project
 *
 * ============================================================================
 * PERMISSION FLOW EXAMPLES
 * ============================================================================
 *
 * Example 1: List Projects with RBAC
 *   1. User requests GET /api/v1/project
 *   2. unified_data_gate.rbac_gate.getWhereCondition() filters to accessible IDs
 *   3. SQL query includes: WHERE e.id = ANY(accessible_ids)
 *   4. Returns only projects user can view
 *
 * Example 2: Create Project in Business Context
 *   1. User requests POST /api/v1/project?parent_type=business&parent_id={id}
 *   2. Check: Can user CREATE projects? (type-level permission)
 *   3. Check: Can user EDIT parent business? (required to link child)
 *   4. Create project in d_project
 *   5. Link to business in entity_instance_link
 *   6. Auto-grant DELETE permission to creator
 *
 * Example 3: View Project Detail with Child Tabs
 *   1. User requests GET /api/v1/project/:id
 *   2. Check: Can user VIEW this project?
 *   3. Return project data
 *   4. Frontend calls /dynamic-child-entity-tabs to get counts
 *   5. Frontend calls /creatable to show "Add" buttons for allowed child types
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
  createPaginatedResponse,
  getColumnsByMetadata
} from '../../lib/universal-schema-metadata.js';
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';
import { createChildEntityEndpointsFromMetadata } from '../../lib/child-entity-route-factory.js';
// ✅ Centralized unified data gate - loosely coupled API
import { unified_data_gate, Permission, ALL_ENTITIES_ID } from '../../lib/unified-data-gate.js';
// ✨ Entity Infrastructure Service - centralized infrastructure operations
import { getEntityInfrastructure } from '../../services/entity-infrastructure.service.js';
// ✨ Universal auto-filter builder - zero-config query filtering
import { buildAutoFilters } from '../../lib/universal-filter-builder.js';

// Schema based on actual d_project table structure from db/XV_d_project.ddl
const ProjectSchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  // Project fields
  dl__project_stage: Type.Optional(Type.String()),
  budget_allocated_amt: Type.Optional(Type.Number()),
  budget_spent_amt: Type.Optional(Type.Number()),
  planned_start_date: Type.Optional(Type.String()),
  planned_end_date: Type.Optional(Type.String()),
  actual_start_date: Type.Optional(Type.String()),
  actual_end_date: Type.Optional(Type.String()),
  // Project team
  manager_employee_id: Type.Optional(Type.String()),
  sponsor_employee_id: Type.Optional(Type.String()),
  stakeholder_employee_ids: Type.Optional(Type.Array(Type.String())),
  // Temporal fields
  from_ts: Type.Optional(Type.String()),
  to_ts: Type.Optional(Type.String()),
  active_flag: Type.Optional(Type.Boolean()),
  created_ts: Type.Optional(Type.String()),
  updated_ts: Type.Optional(Type.String()),
  version: Type.Optional(Type.Number()),
});

const CreateProjectSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1 })),
  code: Type.Optional(Type.String({ minLength: 1 })),
  descr: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Any()),
  business_id: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  office_id: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  dl__project_stage: Type.Optional(Type.String()),
  budget_allocated: Type.Optional(Type.Number()),
  budget_spent: Type.Optional(Type.Number()),
  planned_start_date: Type.Optional(Type.Union([Type.String({ format: 'date' }), Type.Null()])),
  planned_end_date: Type.Optional(Type.Union([Type.String({ format: 'date' }), Type.Null()])),
  actual_start_date: Type.Optional(Type.Union([Type.String({ format: 'date' }), Type.Null()])),
  actual_end_date: Type.Optional(Type.Union([Type.String({ format: 'date' }), Type.Null()])),
  manager_employee_id: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  sponsor_employee_id: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  stakeholder_employee_ids: Type.Optional(Type.Union([Type.Array(Type.String({ format: 'uuid' })), Type.Null()])),
  active_flag: Type.Optional(Type.Boolean()),
});

const UpdateProjectSchema = Type.Partial(CreateProjectSchema);

// ============================================================================
// Module-level constants (DRY - used across all endpoints)
// ============================================================================
const ENTITY_TYPE = 'project';
const TABLE_ALIAS = 'e';

export async function projectRoutes(fastify: FastifyInstance) {
  // ✨ Initialize Entity Infrastructure Service
  const entityInfra = getEntityInfrastructure(db);

  // List projects with filtering
  fastify.get('/api/v1/project', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        dl__project_stage: Type.Optional(Type.String()),
        business_id: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        page: Type.Optional(Type.Number({ minimum: 1 })),
        parent_type: Type.Optional(Type.String()),
        parent_id: Type.Optional(Type.String({ format: 'uuid' })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(ProjectSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number(),
        }),
        403: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const {
      search, limit = 20, offset: queryOffset, page, parent_type, parent_id
    } = request.query as any;
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
      if (parent_type && parent_id) {
        const parentJoin = unified_data_gate.parent_child_filtering_gate.getJoinClause(
          ENTITY_TYPE,
          parent_type,
          parent_id,
          TABLE_ALIAS
        );
        joins.push(parentJoin);
      }

      // Build WHERE conditions array
      const conditions: SQL[] = [];

      // GATE 1: RBAC - Apply security filtering (REQUIRED)
      const rbacCondition = await unified_data_gate.rbac_gate.getWhereCondition(
        userId,
        ENTITY_TYPE,
        Permission.VIEW,
        TABLE_ALIAS
      );
      conditions.push(rbacCondition);

      // ✅ DEFAULT FILTER: Only show active records (not soft-deleted)
      // Can be overridden with ?active=false to show inactive records
      if (!('active' in (request.query as any))) {
        conditions.push(sql`${sql.raw(TABLE_ALIAS)}.active_flag = true`);
      }

      // ✨ UNIVERSAL AUTO-FILTER SYSTEM
      // Automatically builds filters from ANY query parameter based on field naming conventions
      // Supports: ?name=X, ?dl__project_stage=planning, ?active=true, ?manager_employee_id=uuid, etc.
      // See: apps/api/src/lib/universal-filter-builder.ts
      const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query as any, {
        // Optional: Override specific fields if needed (not required for standard conventions)
        overrides: {
          active: { column: 'active_flag', type: 'boolean' }  // Map 'active' param → 'active_flag' column
        }
      });
      conditions.push(...autoFilters);

      // Compose JOIN clause
      const joinClause = joins.length > 0 ? sql.join(joins, sql` `) : sql``;

      // Build WHERE clause
      const whereClause = conditions.length > 0
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
        : sql``;

      // Count query
      const countQuery = sql`
        SELECT COUNT(DISTINCT ${sql.raw(TABLE_ALIAS)}.id) as total
        FROM app.d_${sql.raw(ENTITY_TYPE)} ${sql.raw(TABLE_ALIAS)}
        ${joinClause}
        ${whereClause}
      `;

      // Data query
      const dataQuery = sql`
        SELECT DISTINCT ${sql.raw(TABLE_ALIAS)}.*
        FROM app.d_${sql.raw(ENTITY_TYPE)} ${sql.raw(TABLE_ALIAS)}
        ${joinClause}
        ${whereClause}
        ORDER BY ${sql.raw(TABLE_ALIAS)}.created_ts DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      // Execute queries in parallel
      const [countResult, dataResult] = await Promise.all([
        db.execute(countQuery),
        db.execute(dataQuery)
      ]);

      const total = Number(countResult[0]?.total || 0);
      const projects = dataResult;

      return createPaginatedResponse(projects, total, limit, offset);
    } catch (error) {
      fastify.log.error('Error fetching projects:', error as any);
      console.error('Full error details:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });


  // ============================================================================
  // Get Dynamic Child Entity Tabs (Metadata)
  // ============================================================================

  fastify.get('/api/v1/project/:id/dynamic-child-entity-tabs', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    const { id } = request.params as { id: string };

    // ═══════════════════════════════════════════════════════════════
    // ✅ ENTITY INFRASTRUCTURE SERVICE - RBAC check
    // ═══════════════════════════════════════════════════════════════
    const canView = await entityInfra.check_entity_rbac(userId, ENTITY_TYPE, id, Permission.VIEW);
    if (!canView) {
      return reply.status(403).send({ error: 'No permission to view this project' });
    }

    // ═══════════════════════════════════════════════════════════════
    // ✅ ENTITY INFRASTRUCTURE SERVICE - Get child entity metadata
    // Returns child entity types with labels/icons from entity
    // ═══════════════════════════════════════════════════════════════
    const tabs = await entityInfra.get_dynamic_child_entity_tabs(ENTITY_TYPE);
    return reply.send({ tabs });
  });

  // ============================================================================
  // Get Creatable Entities (Metadata)
  // ============================================================================

  fastify.get('/api/v1/project/:id/creatable', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    const { id } = request.params as { id: string };

    // ═══════════════════════════════════════════════════════════════
    // ✅ CENTRALIZED UNIFIED DATA GATE - Permission Check
    // Uses: RBAC_GATE only (checkPermission)
    // ═══════════════════════════════════════════════════════════════
    const canView = await entityInfra.check_entity_rbac(userId, ENTITY_TYPE, id, Permission.VIEW);
    if (!canView) {
      return reply.status(403).send({ error: 'No permission to view this project' });
    }

    // Get entity configuration
    const entityConfig = await db.execute(sql`
      SELECT child_entity_codes
      FROM app.entity
      WHERE code = ${ENTITY_TYPE}
        AND active_flag = true
    `);

    if (entityConfig.length === 0) {
      return reply.send({ creatable: [] });
    }

    const childEntities = (entityConfig[0].child_entity_codes || []) as string[];

    // ═══════════════════════════════════════════════════════════════
    // ✅ CENTRALIZED UNIFIED DATA GATE - Check CREATE permissions
    // Uses: RBAC_GATE only (checkPermission for each child type)
    // ═══════════════════════════════════════════════════════════════
    const creatableEntities = await Promise.all(
      childEntities.map(async (childType: string) => {
        const canCreate = await entityInfra.check_entity_rbac(userId, childType, ALL_ENTITIES_ID, Permission.CREATE);
        return canCreate ? childType : null;
      })
    );

    return reply.send({
      creatable: creatableEntities.filter(Boolean)
    });
  });




  // ============================================================================
  // Get Single Project
  // ============================================================================

  fastify.get('/api/v1/project/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      response: {
        200: ProjectSchema,
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    const { id } = request.params as { id: string };

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
        ENTITY_TYPE,
        id,
        Permission.VIEW
      );

      if (!canView) {
        return reply.status(403).send({ error: 'No permission to view this project' });
      }

      // Route owns the query
      const result = await db.execute(sql`
        SELECT *
        FROM app.project
        WHERE id = ${id}::uuid
          AND active_flag = true
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      return reply.send(result[0]);
    } catch (error) {
      fastify.log.error('Error fetching project:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Create Project
  // ============================================================================

  fastify.post('/api/v1/project', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        parent_type: Type.Optional(Type.String()),
        parent_id: Type.Optional(Type.String({ format: 'uuid' })),
      }),
      body: CreateProjectSchema,
      response: {
        201: ProjectSchema,
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    const { parent_type, parent_id } = request.query as any;
    const data = request.body as any;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK 1
      // Check: Can user CREATE projects?
      // ═══════════════════════════════════════════════════════════════
      const canCreate = await entityInfra.check_entity_rbac(userId, ENTITY_TYPE, ALL_ENTITIES_ID, Permission.CREATE);
      if (!canCreate) {
        return reply.status(403).send({ error: 'No permission to create projects' });
      }

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK 2
      // Check: If linking to parent, can user EDIT parent?
      // ═══════════════════════════════════════════════════════════════
      if (parent_type && parent_id) {
        const canEditParent = await entityInfra.check_entity_rbac(userId, parent_type, parent_id, Permission.EDIT);
        if (!canEditParent) {
          return reply.status(403).send({ error: `No permission to link project to this ${parent_type}` });
        }
      }
    } catch (err: any) {
      return reply.status(err.statusCode || 403).send({
        error: err.error || 'Forbidden',
        message: err.message
      });
    }

    // Auto-generate required fields if missing
    if (!data.name) data.name = 'Untitled';
    if (!data.code) data.code = `PROJECT-${Date.now()}`;

    // Move business_id and office_id into metadata if provided at top level
    if (data.business_id || data.office_id) {
      data.metadata = data.metadata || {};
      if (data.business_id) data.metadata.business_id = data.business_id;
      if (data.office_id) data.metadata.office_id = data.office_id;
    }

    try {
      // Check for unique project code if provided
      if (data.code) {
        const existingProject = await db.execute(sql`
          SELECT id FROM app.project WHERE code = ${data.code} AND active_flag = true
        `);
        if (existingProject.length > 0) {
          return reply.status(400).send({ error: 'Project with this code already exists' });
        }
      }

      const result = await db.execute(sql`
        INSERT INTO app.project (
          code, name, descr, metadata,
          dl__project_stage,
          budget_allocated_amt, budget_spent_amt,
          planned_start_date, planned_end_date, actual_start_date, actual_end_date,
          manager_employee_id, sponsor_employee_id, stakeholder_employee_ids,
          active_flag
        )
        VALUES (
          ${data.code || `PROJ-${Date.now()}`},
          ${data.name || 'Untitled Project'},
          ${data.descr || null},
          ${data.metadata ? JSON.stringify(data.metadata) : '{}'}::jsonb,
          ${data.dl__project_stage || null},
          ${data.budget_allocated || data.budget_allocated_amt || null},
          ${data.budget_spent || data.budget_spent_amt || 0},
          ${data.planned_start_date || null},
          ${data.planned_end_date || null},
          ${data.actual_start_date || null},
          ${data.actual_end_date || null},
          ${data.manager_employee_id || null},
          ${data.sponsor_employee_id || null},
          ${data.stakeholder_employee_ids && data.stakeholder_employee_ids.length > 0 ? `{${data.stakeholder_employee_ids.join(',')}}` : '{}'}::uuid[],
          ${data.active_flag !== false}
        )
        RETURNING *
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create project' });
      }

      const newProject = result[0] as any;
      const projectId = newProject.id;

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Register instance in registry
      // ═══════════════════════════════════════════════════════════════
      await entityInfra.set_entity_instance_registry({
        entity_type: ENTITY_TYPE,
        entity_id: projectId,
        entity_name: newProject.name,
        entity_code: newProject.code
      });

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Grant ownership to creator
      // ═══════════════════════════════════════════════════════════════
      await entityInfra.set_entity_rbac_owner(userId, ENTITY_TYPE, projectId);

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Link to parent (if provided)
      // ═══════════════════════════════════════════════════════════════
      if (parent_type && parent_id) {
        await entityInfra.set_entity_instance_link({
          parent_entity_type: parent_type,
          parent_entity_id: parent_id,
          child_entity_type: ENTITY_TYPE,
          child_entity_id: projectId,
          relationship_type: 'contains'
        });
      }

      return reply.status(201).send(newProject);
    } catch (error) {
      fastify.log.error('Error creating project:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Update Project
  // ============================================================================

  fastify.patch('/api/v1/project/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      body: UpdateProjectSchema,
      response: {
        200: ProjectSchema,
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    const { id } = request.params as { id: string };
    const updates = request.body as any;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK
      // Check: Can user EDIT this project?
      // ═══════════════════════════════════════════════════════════════
      const canEdit = await entityInfra.check_entity_rbac(userId, ENTITY_TYPE, id, Permission.EDIT);
      if (!canEdit) {
        return reply.status(403).send({ error: 'No permission to edit this project' });
      }

      // Build update fields
      const updateFields: any[] = [];
      if (updates.code !== undefined) updateFields.push(sql`code = ${updates.code}`);
      if (updates.name !== undefined) updateFields.push(sql`name = ${updates.name}`);
      if (updates.descr !== undefined) updateFields.push(sql`descr = ${updates.descr}`);
      if (updates.metadata !== undefined) updateFields.push(sql`metadata = ${updates.metadata}`);
      if (updates.dl__project_stage !== undefined) updateFields.push(sql`dl__project_stage = ${updates.dl__project_stage}`);
      if (updates.budget_allocated_amt !== undefined) updateFields.push(sql`budget_allocated_amt = ${updates.budget_allocated_amt}`);
      if (updates.budget_spent_amt !== undefined) updateFields.push(sql`budget_spent_amt = ${updates.budget_spent_amt}`);
      if (updates.planned_start_date !== undefined) updateFields.push(sql`planned_start_date = ${updates.planned_start_date}`);
      if (updates.planned_end_date !== undefined) updateFields.push(sql`planned_end_date = ${updates.planned_end_date}`);
      if (updates.actual_start_date !== undefined) updateFields.push(sql`actual_start_date = ${updates.actual_start_date}`);
      if (updates.actual_end_date !== undefined) updateFields.push(sql`actual_end_date = ${updates.actual_end_date}`);
      if (updates.manager_employee_id !== undefined) updateFields.push(sql`manager_employee_id = ${updates.manager_employee_id}`);
      if (updates.sponsor_employee_id !== undefined) updateFields.push(sql`sponsor_employee_id = ${updates.sponsor_employee_id}`);
      if (updates.stakeholder_employee_ids !== undefined) {
        const stakeholderArray = updates.stakeholder_employee_ids && updates.stakeholder_employee_ids.length > 0
          ? `{${updates.stakeholder_employee_ids.join(',')}}`
          : '{}';
        updateFields.push(sql`stakeholder_employee_ids = ${stakeholderArray}::uuid[]`);
      }
      if (updates.active_flag !== undefined) updateFields.push(sql`active_flag = ${updates.active_flag}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = now()`);
      updateFields.push(sql`version = version + 1`);

      // ✅ Route owns UPDATE query
      const updated = await db.execute(sql`
        UPDATE app.project
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (updated.length === 0) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Sync registry if name/code changed
      // ═══════════════════════════════════════════════════════════════
      if (updates.name !== undefined || updates.code !== undefined) {
        await entityInfra.update_entity_instance_registry(ENTITY_TYPE, id, {
          entity_name: updates.name,
          entity_code: updates.code
        });
      }

      return reply.send(updated[0]);
    } catch (error) {
      fastify.log.error('Error updating project:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // Update Project (PUT - alias to PATCH for frontend compatibility)
  // ============================================================================

  fastify.put('/api/v1/project/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      body: UpdateProjectSchema,
      response: {
        200: ProjectSchema,
        400: Type.Object({ error: Type.String() }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    const { id } = request.params as { id: string };
    const updates = request.body as any;

    if (!userId) {
      return reply.status(401).send({ error: 'User not authenticated' });
    }

    try {
      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - RBAC CHECK
      // Check: Can user EDIT this project?
      // ═══════════════════════════════════════════════════════════════
      const canEdit = await entityInfra.check_entity_rbac(userId, ENTITY_TYPE, id, Permission.EDIT);
      if (!canEdit) {
        return reply.status(403).send({ error: 'No permission to edit this project' });
      }

      // Build update fields
      const updateFields: any[] = [];
      if (updates.code !== undefined) updateFields.push(sql`code = ${updates.code}`);
      if (updates.name !== undefined) updateFields.push(sql`name = ${updates.name}`);
      if (updates.descr !== undefined) updateFields.push(sql`descr = ${updates.descr}`);
      if (updates.metadata !== undefined) updateFields.push(sql`metadata = ${updates.metadata}`);
      if (updates.dl__project_stage !== undefined) updateFields.push(sql`dl__project_stage = ${updates.dl__project_stage}`);
      if (updates.budget_allocated_amt !== undefined) updateFields.push(sql`budget_allocated_amt = ${updates.budget_allocated_amt}`);
      if (updates.budget_spent_amt !== undefined) updateFields.push(sql`budget_spent_amt = ${updates.budget_spent_amt}`);
      if (updates.planned_start_date !== undefined) updateFields.push(sql`planned_start_date = ${updates.planned_start_date}`);
      if (updates.planned_end_date !== undefined) updateFields.push(sql`planned_end_date = ${updates.planned_end_date}`);
      if (updates.actual_start_date !== undefined) updateFields.push(sql`actual_start_date = ${updates.actual_start_date}`);
      if (updates.actual_end_date !== undefined) updateFields.push(sql`actual_end_date = ${updates.actual_end_date}`);
      if (updates.manager_employee_id !== undefined) updateFields.push(sql`manager_employee_id = ${updates.manager_employee_id}`);
      if (updates.sponsor_employee_id !== undefined) updateFields.push(sql`sponsor_employee_id = ${updates.sponsor_employee_id}`);
      if (updates.stakeholder_employee_ids !== undefined) {
        const stakeholderArray = updates.stakeholder_employee_ids && updates.stakeholder_employee_ids.length > 0
          ? `{${updates.stakeholder_employee_ids.join(',')}}`
          : '{}';
        updateFields.push(sql`stakeholder_employee_ids = ${stakeholderArray}::uuid[]`);
      }
      if (updates.active_flag !== undefined) updateFields.push(sql`active_flag = ${updates.active_flag}`);

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated_ts = now()`);
      updateFields.push(sql`version = version + 1`);

      // ✅ Route owns UPDATE query
      const updated = await db.execute(sql`
        UPDATE app.project
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING *
      `);

      if (updated.length === 0) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      // ═══════════════════════════════════════════════════════════════
      // ✨ ENTITY INFRASTRUCTURE SERVICE - Sync registry if name/code changed
      // ═══════════════════════════════════════════════════════════════
      if (updates.name !== undefined || updates.code !== undefined) {
        await entityInfra.update_entity_instance_registry(ENTITY_TYPE, id, {
          entity_name: updates.name,
          entity_code: updates.code
        });
      }

      return reply.send(updated[0]);
    } catch (error) {
      fastify.log.error('Error updating project:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete project with cascading cleanup (soft delete)
  // Uses universal delete factory pattern - deletes from:
  // 1. app.project (base entity table)
  // 2. app.entity_instance (entity registry)
  // 3. app.entity_instance_link (linkages in both directions)
  createEntityDeleteEndpoint(fastify, 'project');

  // ========================================
  // CHILD ENTITY ENDPOINTS (Database-Driven)
  // ========================================
  // Auto-create all child entity endpoints from entity metadata
  // Reads project's child_entity_codes from database: ["task", "wiki", "artifact", "form", "expense", "revenue"]
  // Creates endpoints: /api/v1/project/:id/task, /api/v1/project/:id/wiki, etc.
  //
  // Benefits:
  // - Single source of truth: child relationships defined in entity DDL only
  // - Zero repetition: no manual endpoint declarations needed
  // - Self-maintaining: add child entity → update d_entity → routes auto-created
  await createChildEntityEndpointsFromMetadata(fastify, 'project');

  // ========================================
  // CHILD ENTITY CREATION
  // ========================================
  // Child entities (task, wiki, form, artifact) are created using:
  // 1. Universal entity create endpoint: POST /api/v1/:childType
  // 2. Linkage API: POST /api/v1/linkage to link child to parent
  // 3. Navigate to child detail page for editing
  // No special endpoints needed - reuses existing universal APIs
}