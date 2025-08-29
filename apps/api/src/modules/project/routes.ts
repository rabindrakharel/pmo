import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { checkScopeAccess, Permission } from '../rbac/scope-auth.js';
import { db } from '@/db/index.js';
import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm';

// Project Head Schema (Immutable project definition)
const ProjectHeadSchema = Type.Object({
  id: Type.String(),
  tenantId: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  slug: Type.Optional(Type.String()),
  projectCode: Type.Optional(Type.String()),
  projectType: Type.Optional(Type.String()),
  priorityLevel: Type.Optional(Type.String()),
  clientId: Type.Optional(Type.String()),
  budgetAllocated: Type.Optional(Type.Number()),
  budgetCurrency: Type.Optional(Type.String()),
  businessScopeId: Type.Optional(Type.String()),
  locationScopeId: Type.Optional(Type.String()),
  worksiteScopeId: Type.Optional(Type.String()),
  projectManagerId: Type.Optional(Type.String()),
  projectSponsorId: Type.Optional(Type.String()),
  technicalLeadId: Type.Optional(Type.String()),
  clientContacts: Type.Optional(Type.Array(Type.Any())),
  stakeholders: Type.Optional(Type.Array(Type.String())),
  approvers: Type.Optional(Type.Array(Type.String())),
  plannedStartDate: Type.Optional(Type.String({ format: 'date' })),
  plannedEndDate: Type.Optional(Type.String({ format: 'date' })),
  estimatedHours: Type.Optional(Type.Number()),
  securityClassification: Type.Optional(Type.String()),
  complianceRequirements: Type.Optional(Type.Array(Type.Any())),
  riskAssessment: Type.Optional(Type.Any()),
  tags: Type.Optional(Type.Array(Type.String())),
  attr: Type.Optional(Type.Any()),
  active: Type.Boolean(),
  created: Type.String(),
  updated: Type.String(),
});

// Project Record Schema (Mutable project state)
const ProjectRecordSchema = Type.Object({
  id: Type.String(),
  headId: Type.String(),
  statusId: Type.String(),
  stageId: Type.Optional(Type.Number()),
  phaseName: Type.Optional(Type.String()),
  completionPercentage: Type.Optional(Type.Number()),
  actualStartDate: Type.Optional(Type.String({ format: 'date' })),
  actualEndDate: Type.Optional(Type.String({ format: 'date' })),
  actualHours: Type.Optional(Type.Number()),
  budgetSpent: Type.Optional(Type.Number()),
  milestonesAchieved: Type.Optional(Type.Array(Type.Any())),
  deliverablesCompleted: Type.Optional(Type.Array(Type.Any())),
  nextMilestone: Type.Optional(Type.Any()),
  qualityMetrics: Type.Optional(Type.Any()),
  performanceIndicators: Type.Optional(Type.Any()),
  clientSatisfactionScore: Type.Optional(Type.Number()),
  dates: Type.Optional(Type.Any()),
  tags: Type.Optional(Type.Array(Type.String())),
  attr: Type.Optional(Type.Any()),
  active: Type.Boolean(),
  fromTs: Type.String(),
  toTs: Type.Optional(Type.String()),
  created: Type.String(),
  updated: Type.String(),
});

// Combined project with current status
const ProjectWithStatusSchema = Type.Object({
  head: ProjectHeadSchema,
  currentRecord: Type.Optional(ProjectRecordSchema),
  statusName: Type.Optional(Type.String()),
  stageName: Type.Optional(Type.String()),
});

// Create schemas
const CreateProjectSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  descr: Type.Optional(Type.String()),
  slug: Type.Optional(Type.String()),
  projectCode: Type.Optional(Type.String()),
  projectType: Type.Optional(Type.String()),
  priorityLevel: Type.Optional(Type.String()),
  clientId: Type.Optional(Type.String({ format: 'uuid' })),
  budgetAllocated: Type.Optional(Type.Number({ minimum: 0 })),
  budgetCurrency: Type.Optional(Type.String()),
  businessScopeId: Type.Optional(Type.String({ format: 'uuid' })),
  locationScopeId: Type.Optional(Type.String({ format: 'uuid' })),
  worksiteScopeId: Type.Optional(Type.String({ format: 'uuid' })),
  projectManagerId: Type.Optional(Type.String({ format: 'uuid' })),
  projectSponsorId: Type.Optional(Type.String({ format: 'uuid' })),
  technicalLeadId: Type.Optional(Type.String({ format: 'uuid' })),
  clientContacts: Type.Optional(Type.Array(Type.Any())),
  stakeholders: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  approvers: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  plannedStartDate: Type.Optional(Type.String({ format: 'date' })),
  plannedEndDate: Type.Optional(Type.String({ format: 'date' })),
  estimatedHours: Type.Optional(Type.Number({ minimum: 0 })),
  securityClassification: Type.Optional(Type.String()),
  complianceRequirements: Type.Optional(Type.Array(Type.Any())),
  riskAssessment: Type.Optional(Type.Any()),
  tags: Type.Optional(Type.Array(Type.String())),
  attr: Type.Optional(Type.Any()),
  // Initial status record fields
  statusId: Type.String({ format: 'uuid' }),
  stageId: Type.Optional(Type.Number()),
  phaseName: Type.Optional(Type.String()),
});

const UpdateProjectHeadSchema = Type.Partial(Type.Pick(CreateProjectSchema, [
  'name', 'descr', 'slug', 'projectCode', 'projectType', 'priorityLevel',
  'clientId', 'budgetAllocated', 'budgetCurrency', 'businessScopeId',
  'locationScopeId', 'worksiteScopeId', 'projectManagerId', 'projectSponsorId',
  'technicalLeadId', 'clientContacts', 'stakeholders', 'approvers',
  'plannedStartDate', 'plannedEndDate', 'estimatedHours', 'securityClassification',
  'complianceRequirements', 'riskAssessment', 'tags', 'attr'
]));

const CreateProjectRecordSchema = Type.Object({
  statusId: Type.String({ format: 'uuid' }),
  stageId: Type.Optional(Type.Number()),
  phaseName: Type.Optional(Type.String()),
  completionPercentage: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
  actualStartDate: Type.Optional(Type.String({ format: 'date' })),
  actualEndDate: Type.Optional(Type.String({ format: 'date' })),
  actualHours: Type.Optional(Type.Number({ minimum: 0 })),
  budgetSpent: Type.Optional(Type.Number({ minimum: 0 })),
  milestonesAchieved: Type.Optional(Type.Array(Type.Any())),
  deliverablesCompleted: Type.Optional(Type.Array(Type.Any())),
  nextMilestone: Type.Optional(Type.Any()),
  qualityMetrics: Type.Optional(Type.Any()),
  performanceIndicators: Type.Optional(Type.Any()),
  clientSatisfactionScore: Type.Optional(Type.Number({ minimum: 1, maximum: 5 })),
  dates: Type.Optional(Type.Any()),
  tags: Type.Optional(Type.Array(Type.String())),
  attr: Type.Optional(Type.Any()),
});

export async function projectRoutes(fastify: FastifyInstance) {
  // List projects with current status
  fastify.get('/api/v1/project', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        businessScopeId: Type.Optional(Type.String()),
        locationScopeId: Type.Optional(Type.String()),
        worksiteScopeId: Type.Optional(Type.String()),
        projectManagerId: Type.Optional(Type.String()),
        statusId: Type.Optional(Type.String()),
        projectType: Type.Optional(Type.String()),
        priorityLevel: Type.Optional(Type.String()),
        active: Type.Optional(Type.Boolean()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        search: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(ProjectWithStatusSchema),
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
      businessScopeId, locationScopeId, worksiteScopeId, projectManagerId,
      statusId, projectType, priorityLevel, active, limit = 50, offset = 0, search 
    } = request.query as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    const scopeAccess = await checkScopeAccess(userId, 'project', 'view', undefined);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Build query conditions
      const conditions = [];
      
      if (businessScopeId !== undefined) {
        conditions.push(sql`ph.business_scope_id = ${businessScopeId}`);
      }
      
      if (locationScopeId !== undefined) {
        conditions.push(sql`ph.location_scope_id = ${locationScopeId}`);
      }
      
      if (worksiteScopeId !== undefined) {
        conditions.push(sql`ph.worksite_scope_id = ${worksiteScopeId}`);
      }
      
      if (projectManagerId !== undefined) {
        conditions.push(sql`ph.project_manager_id = ${projectManagerId}`);
      }
      
      if (statusId !== undefined) {
        conditions.push(sql`pr.status_id = ${statusId}`);
      }
      
      if (projectType !== undefined) {
        conditions.push(sql`ph.project_type = ${projectType}`);
      }
      
      if (priorityLevel !== undefined) {
        conditions.push(sql`ph.priority_level = ${priorityLevel}`);
      }
      
      if (active !== undefined) {
        conditions.push(sql`ph.active = ${active}`);
      }
      
      if (search) {
        conditions.push(sql`(ph.name ILIKE ${`%${search}%`} OR ph."descr" ILIKE ${`%${search}%`} OR ph.project_code ILIKE ${`%${search}%`})`);
      }

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(DISTINCT ph.id) as total 
        FROM app.ops_project_head ph
        LEFT JOIN app.ops_project_records pr ON ph.id = pr.head_id AND pr.active = true
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      // Get paginated results with current status
      const projects = await db.execute(sql`
        SELECT 
          ph.id,
          ph.tenant_id as "tenantId",
          ph.name,
          ph."descr",
          ph.slug,
          ph.project_code as "projectCode",
          ph.project_type as "projectType",
          ph.priority_level as "priorityLevel",
          ph.client_id as "clientId",
          ph.budget_allocated as "budgetAllocated",
          ph.budget_currency as "budgetCurrency",
          ph.business_scope_id as "businessScopeId",
          ph.location_scope_id as "locationScopeId",
          ph.worksite_scope_id as "worksiteScopeId",
          ph.project_manager_id as "projectManagerId",
          ph.project_sponsor_id as "projectSponsorId",
          ph.technical_lead_id as "technicalLeadId",
          ph.client_contacts as "clientContacts",
          ph.stakeholders,
          ph.approvers,
          ph.planned_start_date as "plannedStartDate",
          ph.planned_end_date as "plannedEndDate",
          ph.estimated_hours as "estimatedHours",
          ph.security_classification as "securityClassification",
          ph.compliance_requirements as "complianceRequirements",
          ph.risk_assessment as "riskAssessment",
          ph.tags,
          ph.attr,
          ph.active,
          ph.created,
          ph.updated,
          
          pr.id as "recordId",
          pr.status_id as "statusId",
          pr.stage_id as "stageId",
          pr.phase_name as "phaseName",
          pr.completion_percentage as "completionPercentage",
          pr.actual_start_date as "actualStartDate",
          pr.actual_end_date as "actualEndDate",
          pr.actual_hours as "actualHours",
          pr.budget_spent as "budgetSpent",
          pr.milestones_achieved as "milestonesAchieved",
          pr.deliverables_completed as "deliverablesCompleted",
          pr.next_milestone as "nextMilestone",
          pr.quality_metrics as "qualityMetrics",
          pr.performance_indicators as "performanceIndicators",
          pr.client_satisfaction_score as "clientSatisfactionScore",
          pr.dates as "recordDates",
          pr.tags as "recordTags",
          pr.attr as "recordAttr",
          pr.active as "recordActive",
          pr.from_ts as "fromTs",
          pr.to_ts as "toTs",
          pr.created as "recordCreated",
          pr.updated as "recordUpdated",
          
          mps.name as "statusName",
          mpsg.name as "stageName"
          
        FROM app.ops_project_head ph
        LEFT JOIN app.ops_project_records pr ON ph.id = pr.head_id AND pr.active = true
        LEFT JOIN app.meta_project_status mps ON pr.status_id = mps.id
        LEFT JOIN app.meta_project_stage mpsg ON pr.stage_id = mpsg.level_id
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY ph.name ASC
        LIMIT ${limit} OFFSET ${offset}
      `);

      // Transform results to match schema
      const transformedData = projects.map(row => ({
        head: {
          id: row.id,
          tenantId: row.tenantId,
          name: row.name,
          descr: row.descr,
          slug: row.slug,
          projectCode: row.projectCode,
          projectType: row.projectType,
          priorityLevel: row.priorityLevel,
          clientId: row.clientId,
          budgetAllocated: row.budgetAllocated,
          budgetCurrency: row.budgetCurrency,
          businessScopeId: row.businessScopeId,
          locationScopeId: row.locationScopeId,
          worksiteScopeId: row.worksiteScopeId,
          projectManagerId: row.projectManagerId,
          projectSponsorId: row.projectSponsorId,
          technicalLeadId: row.technicalLeadId,
          clientContacts: row.clientContacts,
          stakeholders: row.stakeholders,
          approvers: row.approvers,
          plannedStartDate: row.plannedStartDate,
          plannedEndDate: row.plannedEndDate,
          estimatedHours: row.estimatedHours,
          securityClassification: row.securityClassification,
          complianceRequirements: row.complianceRequirements,
          riskAssessment: row.riskAssessment,
          tags: row.tags,
          attr: row.attr,
          active: row.active,
          created: row.created,
          updated: row.updated,
        },
        currentRecord: row.recordId ? {
          id: row.recordId,
          headId: row.id,
          statusId: row.statusId,
          stageId: row.stageId,
          phaseName: row.phaseName,
          completionPercentage: row.completionPercentage,
          actualStartDate: row.actualStartDate,
          actualEndDate: row.actualEndDate,
          actualHours: row.actualHours,
          budgetSpent: row.budgetSpent,
          milestonesAchieved: row.milestonesAchieved,
          deliverablesCompleted: row.deliverablesCompleted,
          nextMilestone: row.nextMilestone,
          qualityMetrics: row.qualityMetrics,
          performanceIndicators: row.performanceIndicators,
          clientSatisfactionScore: row.clientSatisfactionScore,
          dates: row.recordDates,
          tags: row.recordTags,
          attr: row.recordAttr,
          active: row.recordActive,
          fromTs: row.fromTs,
          toTs: row.toTs,
          created: row.recordCreated,
          updated: row.recordUpdated,
        } : undefined,
        statusName: row.statusName,
        stageName: row.stageName,
      }));

      return {
        data: transformedData,
        total,
        limit,
        offset,
      };
    } catch (error) {
      fastify.log.error('Error fetching projects:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single project with current status
  fastify.get('/api/v1/project/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: ProjectWithStatusSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    const scopeAccess = await checkScopeAccess(userId, 'project', 'view', id);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const result = await db.execute(sql`
        SELECT 
          ph.id,
          ph.tenant_id as "tenantId",
          ph.name,
          ph."descr",
          ph.slug,
          ph.project_code as "projectCode",
          ph.project_type as "projectType",
          ph.priority_level as "priorityLevel",
          ph.client_id as "clientId",
          ph.budget_allocated as "budgetAllocated",
          ph.budget_currency as "budgetCurrency",
          ph.business_scope_id as "businessScopeId",
          ph.location_scope_id as "locationScopeId",
          ph.worksite_scope_id as "worksiteScopeId",
          ph.project_manager_id as "projectManagerId",
          ph.project_sponsor_id as "projectSponsorId",
          ph.technical_lead_id as "technicalLeadId",
          ph.client_contacts as "clientContacts",
          ph.stakeholders,
          ph.approvers,
          ph.planned_start_date as "plannedStartDate",
          ph.planned_end_date as "plannedEndDate",
          ph.estimated_hours as "estimatedHours",
          ph.security_classification as "securityClassification",
          ph.compliance_requirements as "complianceRequirements",
          ph.risk_assessment as "riskAssessment",
          ph.tags,
          ph.attr,
          ph.active,
          ph.created,
          ph.updated,
          
          pr.id as "recordId",
          pr.status_id as "statusId",
          pr.stage_id as "stageId",
          pr.phase_name as "phaseName",
          pr.completion_percentage as "completionPercentage",
          pr.actual_start_date as "actualStartDate",
          pr.actual_end_date as "actualEndDate",
          pr.actual_hours as "actualHours",
          pr.budget_spent as "budgetSpent",
          pr.milestones_achieved as "milestonesAchieved",
          pr.deliverables_completed as "deliverablesCompleted",
          pr.next_milestone as "nextMilestone",
          pr.quality_metrics as "qualityMetrics",
          pr.performance_indicators as "performanceIndicators",
          pr.client_satisfaction_score as "clientSatisfactionScore",
          pr.dates as "recordDates",
          pr.tags as "recordTags",
          pr.attr as "recordAttr",
          pr.active as "recordActive",
          pr.from_ts as "fromTs",
          pr.to_ts as "toTs",
          pr.created as "recordCreated",
          pr.updated as "recordUpdated",
          
          mps.name as "statusName",
          mpsg.name as "stageName"
          
        FROM app.ops_project_head ph
        LEFT JOIN app.ops_project_records pr ON ph.id = pr.head_id AND pr.active = true
        LEFT JOIN app.meta_project_status mps ON pr.status_id = mps.id
        LEFT JOIN app.meta_project_stage mpsg ON pr.stage_id = mpsg.level_id
        WHERE ph.id = ${id} AND ph.active = true
      `);

      if (result.length === 0) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      const row = result[0];
      return {
        head: {
          id: row.id,
          tenantId: row.tenantId,
          name: row.name,
          descr: row.descr,
          slug: row.slug,
          projectCode: row.projectCode,
          projectType: row.projectType,
          priorityLevel: row.priorityLevel,
          clientId: row.clientId,
          budgetAllocated: row.budgetAllocated,
          budgetCurrency: row.budgetCurrency,
          businessScopeId: row.businessScopeId,
          locationScopeId: row.locationScopeId,
          worksiteScopeId: row.worksiteScopeId,
          projectManagerId: row.projectManagerId,
          projectSponsorId: row.projectSponsorId,
          technicalLeadId: row.technicalLeadId,
          clientContacts: row.clientContacts,
          stakeholders: row.stakeholders,
          approvers: row.approvers,
          plannedStartDate: row.plannedStartDate,
          plannedEndDate: row.plannedEndDate,
          estimatedHours: row.estimatedHours,
          securityClassification: row.securityClassification,
          complianceRequirements: row.complianceRequirements,
          riskAssessment: row.riskAssessment,
          tags: row.tags,
          attr: row.attr,
          active: row.active,
          created: row.created,
          updated: row.updated,
        },
        currentRecord: row.recordId ? {
          id: row.recordId,
          headId: row.id,
          statusId: row.statusId,
          stageId: row.stageId,
          phaseName: row.phaseName,
          completionPercentage: row.completionPercentage,
          actualStartDate: row.actualStartDate,
          actualEndDate: row.actualEndDate,
          actualHours: row.actualHours,
          budgetSpent: row.budgetSpent,
          milestonesAchieved: row.milestonesAchieved,
          deliverablesCompleted: row.deliverablesCompleted,
          nextMilestone: row.nextMilestone,
          qualityMetrics: row.qualityMetrics,
          performanceIndicators: row.performanceIndicators,
          clientSatisfactionScore: row.clientSatisfactionScore,
          dates: row.recordDates,
          tags: row.recordTags,
          attr: row.recordAttr,
          active: row.recordActive,
          fromTs: row.fromTs,
          toTs: row.toTs,
          created: row.recordCreated,
          updated: row.recordUpdated,
        } : undefined,
        statusName: row.statusName,
        stageName: row.stageName,
      };
    } catch (error) {
      fastify.log.error('Error fetching project:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create project with initial status record
  fastify.post('/api/v1/project', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateProjectSchema,
      response: {
        201: ProjectWithStatusSchema,
        403: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    const scopeAccess = await checkScopeAccess(userId, 'project', 'create', undefined);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Validate referenced entities if specified
      if (data.businessScopeId) {
        const businessExists = await db.execute(sql`
          SELECT id FROM app.d_scope_business WHERE id = ${data.businessScopeId} AND active = true
        `);
        if (businessExists.length === 0) {
          return reply.status(400).send({ error: 'Referenced business unit does not exist' });
        }
      }

      if (data.locationScopeId) {
        const locationExists = await db.execute(sql`
          SELECT id FROM app.d_scope_location WHERE id = ${data.locationScopeId} AND active = true
        `);
        if (locationExists.length === 0) {
          return reply.status(400).send({ error: 'Referenced location does not exist' });
        }
      }

      if (data.worksiteScopeId) {
        const worksiteExists = await db.execute(sql`
          SELECT id FROM app.d_scope_worksite WHERE id = ${data.worksiteScopeId} AND active = true
        `);
        if (worksiteExists.length === 0) {
          return reply.status(400).send({ error: 'Referenced worksite does not exist' });
        }
      }

      if (data.clientId) {
        const clientExists = await db.execute(sql`
          SELECT id FROM app.d_client WHERE id = ${data.clientId} AND active = true
        `);
        if (clientExists.length === 0) {
          return reply.status(400).send({ error: 'Referenced client does not exist' });
        }
      }

      // Validate employee references
      const employeeFields = ['projectManagerId', 'projectSponsorId', 'technicalLeadId'];
      for (const field of employeeFields) {
        if (data[field]) {
          const empExists = await db.execute(sql`
            SELECT id FROM app.d_emp WHERE id = ${data[field]} AND active = true
          `);
          if (empExists.length === 0) {
            return reply.status(400).send({ error: `Referenced employee (${field}) does not exist` });
          }
        }
      }

      // Validate status
      const statusExists = await db.execute(sql`
        SELECT id FROM app.meta_project_status WHERE id = ${data.statusId} AND active = true
      `);
      if (statusExists.length === 0) {
        return reply.status(400).send({ error: 'Referenced project status does not exist' });
      }

      // Generate slug if not provided
      let slug = data.slug;
      if (!slug && data.name) {
        slug = data.name.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }

      // Check for unique slug if provided
      if (slug) {
        const existingSlug = await db.execute(sql`
          SELECT id FROM app.ops_project_head WHERE slug = ${slug} AND active = true
        `);
        if (existingSlug.length > 0) {
          return reply.status(400).send({ error: 'Project with this slug already exists' });
        }
      }

      // Check for unique project code if provided
      if (data.projectCode) {
        const existingCode = await db.execute(sql`
          SELECT id FROM app.ops_project_head WHERE project_code = ${data.projectCode} AND active = true
        `);
        if (existingCode.length > 0) {
          return reply.status(400).send({ error: 'Project with this code already exists' });
        }
      }

      // Begin transaction to create both head and initial record
      const headResult = await db.execute(sql`
        INSERT INTO app.ops_project_head (
          tenant_id, name, "descr", slug, project_code, project_type, priority_level,
          client_id, budget_allocated, budget_currency, business_scope_id, 
          location_scope_id, worksite_scope_id, project_manager_id, project_sponsor_id,
          technical_lead_id, client_contacts, stakeholders, approvers,
          planned_start_date, planned_end_date, estimated_hours, 
          security_classification, compliance_requirements, risk_assessment, tags, attr
        )
        VALUES (
          gen_random_uuid(), ${data.name}, ${data.descr || null}, ${slug || null}, 
          ${data.projectCode || null}, ${data.projectType || 'development'}, 
          ${data.priorityLevel || 'medium'}, ${data.clientId || null},
          ${data.budgetAllocated || null}, ${data.budgetCurrency || 'CAD'}, 
          ${data.businessScopeId || null}, ${data.locationScopeId || null}, 
          ${data.worksiteScopeId || null}, ${data.projectManagerId || null}, 
          ${data.projectSponsorId || null}, ${data.technicalLeadId || null},
          ${JSON.stringify(data.clientContacts || [])}, 
          ${data.stakeholders ? `{${data.stakeholders.join(',')}}` : '{}'},
          ${data.approvers ? `{${data.approvers.join(',')}}` : '{}'},
          ${data.plannedStartDate || null}, ${data.plannedEndDate || null},
          ${data.estimatedHours || null}, ${data.securityClassification || 'internal'},
          ${JSON.stringify(data.complianceRequirements || [])},
          ${JSON.stringify(data.riskAssessment || {})},
          ${JSON.stringify(data.tags || [])}, ${JSON.stringify(data.attr || {})}
        )
        RETURNING id
      `);

      if (headResult.length === 0) {
        return reply.status(500).send({ error: 'Failed to create project head' });
      }

      const projectId = headResult[0].id;

      // Create initial status record
      const recordResult = await db.execute(sql`
        INSERT INTO app.ops_project_records (
          head_id, status_id, stage_id, phase_name, from_ts, completion_percentage
        )
        VALUES (
          ${projectId}, ${data.statusId}, ${data.stageId || null}, 
          ${data.phaseName || null}, NOW(), 0.0
        )
        RETURNING id
      `);

      if (recordResult.length === 0) {
        // Clean up head if record creation fails
        await db.execute(sql`DELETE FROM app.ops_project_head WHERE id = ${projectId}`);
        return reply.status(500).send({ error: 'Failed to create initial project status' });
      }

      // Fetch the created project with status
      const createdProject = await db.execute(sql`
        SELECT 
          ph.id,
          ph.tenant_id as "tenantId",
          ph.name,
          ph."descr",
          ph.slug,
          ph.project_code as "projectCode",
          ph.project_type as "projectType",
          ph.priority_level as "priorityLevel",
          ph.client_id as "clientId",
          ph.budget_allocated as "budgetAllocated",
          ph.budget_currency as "budgetCurrency",
          ph.business_scope_id as "businessScopeId",
          ph.location_scope_id as "locationScopeId",
          ph.worksite_scope_id as "worksiteScopeId",
          ph.project_manager_id as "projectManagerId",
          ph.project_sponsor_id as "projectSponsorId",
          ph.technical_lead_id as "technicalLeadId",
          ph.client_contacts as "clientContacts",
          ph.stakeholders,
          ph.approvers,
          ph.planned_start_date as "plannedStartDate",
          ph.planned_end_date as "plannedEndDate",
          ph.estimated_hours as "estimatedHours",
          ph.security_classification as "securityClassification",
          ph.compliance_requirements as "complianceRequirements",
          ph.risk_assessment as "riskAssessment",
          ph.tags,
          ph.attr,
          ph.active,
          ph.created,
          ph.updated,
          
          pr.id as "recordId",
          pr.status_id as "statusId",
          pr.stage_id as "stageId",
          pr.phase_name as "phaseName",
          pr.completion_percentage as "completionPercentage",
          pr.actual_start_date as "actualStartDate",
          pr.actual_end_date as "actualEndDate",
          pr.actual_hours as "actualHours",
          pr.budget_spent as "budgetSpent",
          pr.milestones_achieved as "milestonesAchieved",
          pr.deliverables_completed as "deliverablesCompleted",
          pr.next_milestone as "nextMilestone",
          pr.quality_metrics as "qualityMetrics",
          pr.performance_indicators as "performanceIndicators",
          pr.client_satisfaction_score as "clientSatisfactionScore",
          pr.dates as "recordDates",
          pr.tags as "recordTags",
          pr.attr as "recordAttr",
          pr.active as "recordActive",
          pr.from_ts as "fromTs",
          pr.to_ts as "toTs",
          pr.created as "recordCreated",
          pr.updated as "recordUpdated",
          
          mps.name as "statusName",
          mpsg.name as "stageName"
          
        FROM app.ops_project_head ph
        LEFT JOIN app.ops_project_records pr ON ph.id = pr.head_id AND pr.active = true
        LEFT JOIN app.meta_project_status mps ON pr.status_id = mps.id
        LEFT JOIN app.meta_project_stage mpsg ON pr.stage_id = mpsg.level_id
        WHERE ph.id = ${projectId}
      `);

      if (createdProject.length === 0) {
        return reply.status(500).send({ error: 'Failed to retrieve created project' });
      }

      const row = createdProject[0];
      const result = {
        head: {
          id: row.id,
          tenantId: row.tenantId,
          name: row.name,
          descr: row.descr,
          slug: row.slug,
          projectCode: row.projectCode,
          projectType: row.projectType,
          priorityLevel: row.priorityLevel,
          clientId: row.clientId,
          budgetAllocated: row.budgetAllocated,
          budgetCurrency: row.budgetCurrency,
          businessScopeId: row.businessScopeId,
          locationScopeId: row.locationScopeId,
          worksiteScopeId: row.worksiteScopeId,
          projectManagerId: row.projectManagerId,
          projectSponsorId: row.projectSponsorId,
          technicalLeadId: row.technicalLeadId,
          clientContacts: row.clientContacts,
          stakeholders: row.stakeholders,
          approvers: row.approvers,
          plannedStartDate: row.plannedStartDate,
          plannedEndDate: row.plannedEndDate,
          estimatedHours: row.estimatedHours,
          securityClassification: row.securityClassification,
          complianceRequirements: row.complianceRequirements,
          riskAssessment: row.riskAssessment,
          tags: row.tags,
          attr: row.attr,
          active: row.active,
          created: row.created,
          updated: row.updated,
        },
        currentRecord: {
          id: row.recordId,
          headId: row.id,
          statusId: row.statusId,
          stageId: row.stageId,
          phaseName: row.phaseName,
          completionPercentage: row.completionPercentage,
          actualStartDate: row.actualStartDate,
          actualEndDate: row.actualEndDate,
          actualHours: row.actualHours,
          budgetSpent: row.budgetSpent,
          milestonesAchieved: row.milestonesAchieved,
          deliverablesCompleted: row.deliverablesCompleted,
          nextMilestone: row.nextMilestone,
          qualityMetrics: row.qualityMetrics,
          performanceIndicators: row.performanceIndicators,
          clientSatisfactionScore: row.clientSatisfactionScore,
          dates: row.recordDates,
          tags: row.recordTags,
          attr: row.recordAttr,
          active: row.recordActive,
          fromTs: row.fromTs,
          toTs: row.toTs,
          created: row.recordCreated,
          updated: row.recordUpdated,
        },
        statusName: row.statusName,
        stageName: row.stageName,
      };

      return reply.status(201).send(result);
    } catch (error) {
      fastify.log.error('Error creating project:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update project head 
  fastify.put('/api/v1/project/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: UpdateProjectHeadSchema,
      response: {
        200: ProjectWithStatusSchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    const scopeAccess = await checkScopeAccess(userId, 'project', 'modify', id);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Check if project exists
      const existing = await db.execute(sql`
        SELECT id FROM app.ops_project_head WHERE id = ${id} AND active = true
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      // Validate referenced entities if specified
      if (data.businessScopeId) {
        const businessExists = await db.execute(sql`
          SELECT id FROM app.d_scope_business WHERE id = ${data.businessScopeId} AND active = true
        `);
        if (businessExists.length === 0) {
          return reply.status(400).send({ error: 'Referenced business unit does not exist' });
        }
      }

      if (data.locationScopeId) {
        const locationExists = await db.execute(sql`
          SELECT id FROM app.d_scope_location WHERE id = ${data.locationScopeId} AND active = true
        `);
        if (locationExists.length === 0) {
          return reply.status(400).send({ error: 'Referenced location does not exist' });
        }
      }

      if (data.worksiteScopeId) {
        const worksiteExists = await db.execute(sql`
          SELECT id FROM app.d_scope_worksite WHERE id = ${data.worksiteScopeId} AND active = true
        `);
        if (worksiteExists.length === 0) {
          return reply.status(400).send({ error: 'Referenced worksite does not exist' });
        }
      }

      // Check for unique slug on update
      if (data.slug) {
        const existingSlug = await db.execute(sql`
          SELECT id FROM app.ops_project_head WHERE slug = ${data.slug} AND active = true AND id != ${id}
        `);
        if (existingSlug.length > 0) {
          return reply.status(400).send({ error: 'Project with this slug already exists' });
        }
      }

      // Check for unique project code on update
      if (data.projectCode) {
        const existingCode = await db.execute(sql`
          SELECT id FROM app.ops_project_head WHERE project_code = ${data.projectCode} AND active = true AND id != ${id}
        `);
        if (existingCode.length > 0) {
          return reply.status(400).send({ error: 'Project with this code already exists' });
        }
      }

      // Build update fields
      const updateFields = [];
      
      if (data.name !== undefined) {
        updateFields.push(sql`name = ${data.name}`);
      }
      
      if (data.descr !== undefined) {
        updateFields.push(sql`"descr" = ${data.descr}`);
      }
      
      if (data.slug !== undefined) {
        updateFields.push(sql`slug = ${data.slug}`);
      }
      
      if (data.projectCode !== undefined) {
        updateFields.push(sql`project_code = ${data.projectCode}`);
      }
      
      if (data.projectType !== undefined) {
        updateFields.push(sql`project_type = ${data.projectType}`);
      }
      
      if (data.priorityLevel !== undefined) {
        updateFields.push(sql`priority_level = ${data.priorityLevel}`);
      }
      
      if (data.clientId !== undefined) {
        updateFields.push(sql`client_id = ${data.clientId}`);
      }
      
      if (data.budgetAllocated !== undefined) {
        updateFields.push(sql`budget_allocated = ${data.budgetAllocated}`);
      }
      
      if (data.budgetCurrency !== undefined) {
        updateFields.push(sql`budget_currency = ${data.budgetCurrency}`);
      }
      
      if (data.businessScopeId !== undefined) {
        updateFields.push(sql`business_scope_id = ${data.businessScopeId}`);
      }
      
      if (data.locationScopeId !== undefined) {
        updateFields.push(sql`location_scope_id = ${data.locationScopeId}`);
      }
      
      if (data.worksiteScopeId !== undefined) {
        updateFields.push(sql`worksite_scope_id = ${data.worksiteScopeId}`);
      }
      
      if (data.projectManagerId !== undefined) {
        updateFields.push(sql`project_manager_id = ${data.projectManagerId}`);
      }
      
      if (data.projectSponsorId !== undefined) {
        updateFields.push(sql`project_sponsor_id = ${data.projectSponsorId}`);
      }
      
      if (data.technicalLeadId !== undefined) {
        updateFields.push(sql`technical_lead_id = ${data.technicalLeadId}`);
      }
      
      if (data.clientContacts !== undefined) {
        updateFields.push(sql`client_contacts = ${JSON.stringify(data.clientContacts)}`);
      }
      
      if (data.stakeholders !== undefined) {
        updateFields.push(sql`stakeholders = ${data.stakeholders ? `{${data.stakeholders.join(',')}}` : '{}'}`);
      }
      
      if (data.approvers !== undefined) {
        updateFields.push(sql`approvers = ${data.approvers ? `{${data.approvers.join(',')}}` : '{}'}`);
      }
      
      if (data.plannedStartDate !== undefined) {
        updateFields.push(sql`planned_start_date = ${data.plannedStartDate}`);
      }
      
      if (data.plannedEndDate !== undefined) {
        updateFields.push(sql`planned_end_date = ${data.plannedEndDate}`);
      }
      
      if (data.estimatedHours !== undefined) {
        updateFields.push(sql`estimated_hours = ${data.estimatedHours}`);
      }
      
      if (data.securityClassification !== undefined) {
        updateFields.push(sql`security_classification = ${data.securityClassification}`);
      }
      
      if (data.complianceRequirements !== undefined) {
        updateFields.push(sql`compliance_requirements = ${JSON.stringify(data.complianceRequirements)}`);
      }
      
      if (data.riskAssessment !== undefined) {
        updateFields.push(sql`risk_assessment = ${JSON.stringify(data.riskAssessment)}`);
      }
      
      if (data.tags !== undefined) {
        updateFields.push(sql`tags = ${JSON.stringify(data.tags)}`);
      }
      
      if (data.attr !== undefined) {
        updateFields.push(sql`attr = ${JSON.stringify(data.attr)}`);
      }

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated = NOW()`);

      // Update project head
      await db.execute(sql`
        UPDATE app.ops_project_head 
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
      `);

      // Return updated project with current status
      const result = await db.execute(sql`
        SELECT 
          ph.id,
          ph.tenant_id as "tenantId",
          ph.name,
          ph."descr",
          ph.slug,
          ph.project_code as "projectCode",
          ph.project_type as "projectType",
          ph.priority_level as "priorityLevel",
          ph.client_id as "clientId",
          ph.budget_allocated as "budgetAllocated",
          ph.budget_currency as "budgetCurrency",
          ph.business_scope_id as "businessScopeId",
          ph.location_scope_id as "locationScopeId",
          ph.worksite_scope_id as "worksiteScopeId",
          ph.project_manager_id as "projectManagerId",
          ph.project_sponsor_id as "projectSponsorId",
          ph.technical_lead_id as "technicalLeadId",
          ph.client_contacts as "clientContacts",
          ph.stakeholders,
          ph.approvers,
          ph.planned_start_date as "plannedStartDate",
          ph.planned_end_date as "plannedEndDate",
          ph.estimated_hours as "estimatedHours",
          ph.security_classification as "securityClassification",
          ph.compliance_requirements as "complianceRequirements",
          ph.risk_assessment as "riskAssessment",
          ph.tags,
          ph.attr,
          ph.active,
          ph.created,
          ph.updated,
          
          pr.id as "recordId",
          pr.status_id as "statusId",
          pr.stage_id as "stageId",
          pr.phase_name as "phaseName",
          pr.completion_percentage as "completionPercentage",
          pr.actual_start_date as "actualStartDate",
          pr.actual_end_date as "actualEndDate",
          pr.actual_hours as "actualHours",
          pr.budget_spent as "budgetSpent",
          pr.milestones_achieved as "milestonesAchieved",
          pr.deliverables_completed as "deliverablesCompleted",
          pr.next_milestone as "nextMilestone",
          pr.quality_metrics as "qualityMetrics",
          pr.performance_indicators as "performanceIndicators",
          pr.client_satisfaction_score as "clientSatisfactionScore",
          pr.dates as "recordDates",
          pr.tags as "recordTags",
          pr.attr as "recordAttr",
          pr.active as "recordActive",
          pr.from_ts as "fromTs",
          pr.to_ts as "toTs",
          pr.created as "recordCreated",
          pr.updated as "recordUpdated",
          
          mps.name as "statusName",
          mpsg.name as "stageName"
          
        FROM app.ops_project_head ph
        LEFT JOIN app.ops_project_records pr ON ph.id = pr.head_id AND pr.active = true
        LEFT JOIN app.meta_project_status mps ON pr.status_id = mps.id
        LEFT JOIN app.meta_project_stage mpsg ON pr.stage_id = mpsg.level_id
        WHERE ph.id = ${id}
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to retrieve updated project' });
      }

      const row = result[0];
      return {
        head: {
          id: row.id,
          tenantId: row.tenantId,
          name: row.name,
          descr: row.descr,
          slug: row.slug,
          projectCode: row.projectCode,
          projectType: row.projectType,
          priorityLevel: row.priorityLevel,
          clientId: row.clientId,
          budgetAllocated: row.budgetAllocated,
          budgetCurrency: row.budgetCurrency,
          businessScopeId: row.businessScopeId,
          locationScopeId: row.locationScopeId,
          worksiteScopeId: row.worksiteScopeId,
          projectManagerId: row.projectManagerId,
          projectSponsorId: row.projectSponsorId,
          technicalLeadId: row.technicalLeadId,
          clientContacts: row.clientContacts,
          stakeholders: row.stakeholders,
          approvers: row.approvers,
          plannedStartDate: row.plannedStartDate,
          plannedEndDate: row.plannedEndDate,
          estimatedHours: row.estimatedHours,
          securityClassification: row.securityClassification,
          complianceRequirements: row.complianceRequirements,
          riskAssessment: row.riskAssessment,
          tags: row.tags,
          attr: row.attr,
          active: row.active,
          created: row.created,
          updated: row.updated,
        },
        currentRecord: row.recordId ? {
          id: row.recordId,
          headId: row.id,
          statusId: row.statusId,
          stageId: row.stageId,
          phaseName: row.phaseName,
          completionPercentage: row.completionPercentage,
          actualStartDate: row.actualStartDate,
          actualEndDate: row.actualEndDate,
          actualHours: row.actualHours,
          budgetSpent: row.budgetSpent,
          milestonesAchieved: row.milestonesAchieved,
          deliverablesCompleted: row.deliverablesCompleted,
          nextMilestone: row.nextMilestone,
          qualityMetrics: row.qualityMetrics,
          performanceIndicators: row.performanceIndicators,
          clientSatisfactionScore: row.clientSatisfactionScore,
          dates: row.recordDates,
          tags: row.recordTags,
          attr: row.recordAttr,
          active: row.recordActive,
          fromTs: row.fromTs,
          toTs: row.toTs,
          created: row.recordCreated,
          updated: row.recordUpdated,
        } : undefined,
        statusName: row.statusName,
        stageName: row.stageName,
      };
    } catch (error) {
      fastify.log.error('Error updating project:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete project (soft delete)
  fastify.delete('/api/v1/project/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        204: Type.Null(),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };

    const scopeAccess = await checkScopeAccess(userId, 'project', 'delete', id);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Check if project exists
      const existing = await db.execute(sql`
        SELECT id FROM app.ops_project_head WHERE id = ${id} AND active = true
      `);
      
      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      // Check if project has active tasks
      const activeTasks = await db.execute(sql`
        SELECT COUNT(*) as count FROM app.ops_task_head 
        WHERE proj_head_id = ${id} AND active = true
      `);
      
      if (Number(activeTasks[0]?.count || 0) > 0) {
        return reply.status(400).send({ error: 'Cannot delete project with active tasks' });
      }

      // Soft delete
      await db.execute(sql`
        UPDATE app.ops_project_head 
        SET active = false, updated = NOW()
        WHERE id = ${id}
      `);

      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting project:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create project status record (update project status)
  fastify.post('/api/v1/project/:id/record', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: CreateProjectRecordSchema,
      response: {
        201: ProjectWithStatusSchema,
        403: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    const scopeAccess = await checkScopeAccess(userId, 'project', 'modify', id);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Check if project exists
      const project = await db.execute(sql`
        SELECT id FROM app.ops_project_head WHERE id = ${id} AND active = true
      `);
      
      if (project.length === 0) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      // Validate status exists
      const statusExists = await db.execute(sql`
        SELECT id FROM app.meta_project_status WHERE id = ${data.statusId} AND active = true
      `);
      if (statusExists.length === 0) {
        return reply.status(400).send({ error: 'Referenced project status does not exist' });
      }

      // Deactivate current active record
      await db.execute(sql`
        UPDATE app.ops_project_records 
        SET active = false, to_ts = NOW(), updated = NOW()
        WHERE head_id = ${id} AND active = true
      `);

      // Create new status record
      const fromTs = new Date().toISOString();
      const recordResult = await db.execute(sql`
        INSERT INTO app.ops_project_records (
          head_id, status_id, stage_id, phase_name, completion_percentage,
          actual_start_date, actual_end_date, actual_hours, budget_spent,
          milestones_achieved, deliverables_completed, next_milestone,
          quality_metrics, performance_indicators, client_satisfaction_score,
          dates, tags, attr, from_ts
        )
        VALUES (
          ${id}, ${data.statusId}, ${data.stageId || null}, ${data.phaseName || null},
          ${data.completionPercentage || 0}, ${data.actualStartDate || null},
          ${data.actualEndDate || null}, ${data.actualHours || null}, ${data.budgetSpent || null},
          ${JSON.stringify(data.milestonesAchieved || [])}, 
          ${JSON.stringify(data.deliverablesCompleted || [])},
          ${JSON.stringify(data.nextMilestone || {})},
          ${JSON.stringify(data.qualityMetrics || {})},
          ${JSON.stringify(data.performanceIndicators || {})},
          ${data.clientSatisfactionScore || null},
          ${JSON.stringify(data.dates || {})}, ${JSON.stringify(data.tags || [])},
          ${JSON.stringify(data.attr || {})}, ${fromTs}
        )
        RETURNING id
      `);

      if (recordResult.length === 0) {
        return reply.status(500).send({ error: 'Failed to create project status record' });
      }

      // Fetch the updated project with new status
      const result = await db.execute(sql`
        SELECT 
          ph.id,
          ph.tenant_id as "tenantId",
          ph.name,
          ph."descr",
          ph.slug,
          ph.project_code as "projectCode",
          ph.project_type as "projectType",
          ph.priority_level as "priorityLevel",
          ph.client_id as "clientId",
          ph.budget_allocated as "budgetAllocated",
          ph.budget_currency as "budgetCurrency",
          ph.business_scope_id as "businessScopeId",
          ph.location_scope_id as "locationScopeId",
          ph.worksite_scope_id as "worksiteScopeId",
          ph.project_manager_id as "projectManagerId",
          ph.project_sponsor_id as "projectSponsorId",
          ph.technical_lead_id as "technicalLeadId",
          ph.client_contacts as "clientContacts",
          ph.stakeholders,
          ph.approvers,
          ph.planned_start_date as "plannedStartDate",
          ph.planned_end_date as "plannedEndDate",
          ph.estimated_hours as "estimatedHours",
          ph.security_classification as "securityClassification",
          ph.compliance_requirements as "complianceRequirements",
          ph.risk_assessment as "riskAssessment",
          ph.tags,
          ph.attr,
          ph.active,
          ph.created,
          ph.updated,
          
          pr.id as "recordId",
          pr.status_id as "statusId",
          pr.stage_id as "stageId",
          pr.phase_name as "phaseName",
          pr.completion_percentage as "completionPercentage",
          pr.actual_start_date as "actualStartDate",
          pr.actual_end_date as "actualEndDate",
          pr.actual_hours as "actualHours",
          pr.budget_spent as "budgetSpent",
          pr.milestones_achieved as "milestonesAchieved",
          pr.deliverables_completed as "deliverablesCompleted",
          pr.next_milestone as "nextMilestone",
          pr.quality_metrics as "qualityMetrics",
          pr.performance_indicators as "performanceIndicators",
          pr.client_satisfaction_score as "clientSatisfactionScore",
          pr.dates as "recordDates",
          pr.tags as "recordTags",
          pr.attr as "recordAttr",
          pr.active as "recordActive",
          pr.from_ts as "fromTs",
          pr.to_ts as "toTs",
          pr.created as "recordCreated",
          pr.updated as "recordUpdated",
          
          mps.name as "statusName",
          mpsg.name as "stageName"
          
        FROM app.ops_project_head ph
        LEFT JOIN app.ops_project_records pr ON ph.id = pr.head_id AND pr.active = true
        LEFT JOIN app.meta_project_status mps ON pr.status_id = mps.id
        LEFT JOIN app.meta_project_stage mpsg ON pr.stage_id = mpsg.level_id
        WHERE ph.id = ${id}
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to retrieve updated project' });
      }

      const row = result[0];
      const response = {
        head: {
          id: row.id,
          tenantId: row.tenantId,
          name: row.name,
          descr: row.descr,
          slug: row.slug,
          projectCode: row.projectCode,
          projectType: row.projectType,
          priorityLevel: row.priorityLevel,
          clientId: row.clientId,
          budgetAllocated: row.budgetAllocated,
          budgetCurrency: row.budgetCurrency,
          businessScopeId: row.businessScopeId,
          locationScopeId: row.locationScopeId,
          worksiteScopeId: row.worksiteScopeId,
          projectManagerId: row.projectManagerId,
          projectSponsorId: row.projectSponsorId,
          technicalLeadId: row.technicalLeadId,
          clientContacts: row.clientContacts,
          stakeholders: row.stakeholders,
          approvers: row.approvers,
          plannedStartDate: row.plannedStartDate,
          plannedEndDate: row.plannedEndDate,
          estimatedHours: row.estimatedHours,
          securityClassification: row.securityClassification,
          complianceRequirements: row.complianceRequirements,
          riskAssessment: row.riskAssessment,
          tags: row.tags,
          attr: row.attr,
          active: row.active,
          created: row.created,
          updated: row.updated,
        },
        currentRecord: {
          id: row.recordId,
          headId: row.id,
          statusId: row.statusId,
          stageId: row.stageId,
          phaseName: row.phaseName,
          completionPercentage: row.completionPercentage,
          actualStartDate: row.actualStartDate,
          actualEndDate: row.actualEndDate,
          actualHours: row.actualHours,
          budgetSpent: row.budgetSpent,
          milestonesAchieved: row.milestonesAchieved,
          deliverablesCompleted: row.deliverablesCompleted,
          nextMilestone: row.nextMilestone,
          qualityMetrics: row.qualityMetrics,
          performanceIndicators: row.performanceIndicators,
          clientSatisfactionScore: row.clientSatisfactionScore,
          dates: row.recordDates,
          tags: row.recordTags,
          attr: row.recordAttr,
          active: row.recordActive,
          fromTs: row.fromTs,
          toTs: row.toTs,
          created: row.recordCreated,
          updated: row.recordUpdated,
        },
        statusName: row.statusName,
        stageName: row.stageName,
      };

      return reply.status(201).send(response);
    } catch (error) {
      fastify.log.error('Error creating project status record:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get project with current status and details
  fastify.get('/api/v1/project/:id/status', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          project: ProjectHeadSchema,
          currentStatus: Type.Optional(Type.Object({
            statusId: Type.String(),
            statusName: Type.String(),
            stageId: Type.Optional(Type.Number()),
            stageName: Type.Optional(Type.String()),
            completionPercentage: Type.Optional(Type.Number()),
            dates: Type.Optional(Type.Any()),
          })),
        }),
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };

    const scopeAccess = await checkScopeAccess(userId, 'project', 'view', id);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Get project
      const project = await db.execute(sql`
        SELECT 
          id,
          tenant_id as "tenantId",
          name,
          "descr",
          slug,
          project_code as "projectCode",
          project_type as "projectType",
          priority_level as "priorityLevel",
          client_id as "clientId",
          budget_allocated as "budgetAllocated",
          budget_currency as "budgetCurrency",
          business_scope_id as "businessScopeId",
          location_scope_id as "locationScopeId",
          worksite_scope_id as "worksiteScopeId",
          project_manager_id as "projectManagerId",
          project_sponsor_id as "projectSponsorId",
          technical_lead_id as "technicalLeadId",
          client_contacts as "clientContacts",
          stakeholders,
          approvers,
          planned_start_date as "plannedStartDate",
          planned_end_date as "plannedEndDate",
          estimated_hours as "estimatedHours",
          security_classification as "securityClassification",
          compliance_requirements as "complianceRequirements",
          risk_assessment as "riskAssessment",
          tags,
          attr,
          active,
          created,
          updated
        FROM app.ops_project_head 
        WHERE id = ${id} AND active = true
      `);

      if (project.length === 0) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      // Get current status
      const currentStatus = await db.execute(sql`
        SELECT 
          pr.status_id as "statusId",
          mps.name as "statusName",
          pr.stage_id as "stageId",
          mpsg.name as "stageName",
          pr.completion_percentage as "completionPercentage",
          pr.dates
        FROM app.ops_project_records pr
        JOIN app.meta_project_status mps ON pr.status_id = mps.id
        LEFT JOIN app.meta_project_stage mpsg ON pr.stage_id = mpsg.level_id
        WHERE pr.head_id = ${id} AND pr.active = true
        ORDER BY pr.from_ts DESC
        LIMIT 1
      `);

      return {
        project: project[0],
        currentStatus: currentStatus.length > 0 ? currentStatus[0] : undefined,
      };
    } catch (error) {
      fastify.log.error('Error fetching project status:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}