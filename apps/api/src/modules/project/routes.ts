import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { checkScopeAccess, Permission } from '../rbac/scope-auth.js';
import { db } from '@/db/index.js';
import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm';

const ProjectSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  slug: Type.Optional(Type.String()),
  locationSpecific: Type.Boolean(),
  locationId: Type.Optional(Type.String()),
  businessSpecific: Type.Boolean(),
  bizId: Type.Optional(Type.String()),
  worksiteSpecific: Type.Boolean(),
  worksiteId: Type.Optional(Type.String()),
  active: Type.Boolean(),
  created: Type.String(),
  updated: Type.String(),
});

const CreateProjectSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  slug: Type.Optional(Type.String()),
  locationSpecific: Type.Optional(Type.Boolean()),
  locationId: Type.Optional(Type.String({ format: 'uuid' })),
  businessSpecific: Type.Optional(Type.Boolean()),
  bizId: Type.Optional(Type.String({ format: 'uuid' })),
  worksiteSpecific: Type.Optional(Type.Boolean()),
  worksiteId: Type.Optional(Type.String({ format: 'uuid' })),
  active: Type.Optional(Type.Boolean()),
});

const UpdateProjectSchema = Type.Partial(CreateProjectSchema);

export async function projectRoutes(fastify: FastifyInstance) {
  // List projects with filtering
  fastify.get('/api/v1/project', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        locationId: Type.Optional(Type.String()),
        bizId: Type.Optional(Type.String()),
        worksiteId: Type.Optional(Type.String()),
        active: Type.Optional(Type.Boolean()),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
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
    const { locationId, bizId, worksiteId, active, limit = 50, offset = 0 } = request.query as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };

    const scopeAccess = await checkScopeAccess(userId, 'project', 'view', undefined);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Build query conditions
      const conditions = [];
      
      if (locationId !== undefined) {
        conditions.push(sql`location_specific = true AND location_id = ${locationId}`);
      }
      
      if (bizId !== undefined) {
        conditions.push(sql`business_specific = true AND biz_id = ${bizId}`);
      }
      
      if (worksiteId !== undefined) {
        conditions.push(sql`worksite_specific = true AND worksite_id = ${worksiteId}`);
      }
      
      if (active !== undefined) {
        conditions.push(sql`active = ${active}`);
      }

      // Get total count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total 
        FROM app.ops_project_head 
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      `);
      const total = Number(countResult[0]?.total || 0);

      // Get paginated results
      const projects = await db.execute(sql`
        SELECT 
          id,
          name,
          slug,
          location_specific as "locationSpecific",
          location_id as "locationId",
          business_specific as "businessSpecific",
          biz_id as "bizId",
          worksite_specific as "worksiteSpecific",
          worksite_id as "worksiteId",
          active,
          created,
          updated
        FROM app.ops_project_head 
        ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        ORDER BY name ASC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return {
        data: projects,
        total,
        limit,
        offset,
      };
    } catch (error) {
      fastify.log.error('Error fetching projects:', error as any);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single project
  fastify.get('/api/v1/project/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: ProjectSchema,
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
      const project = await db.execute(sql`
        SELECT 
          id,
          name,
          slug,
          location_specific as "locationSpecific",
          location_id as "locationId",
          business_specific as "businessSpecific",
          biz_id as "bizId",
          worksite_specific as "worksiteSpecific",
          worksite_id as "worksiteId",
          active,
          created,
          updated
        FROM app.ops_project_head 
        WHERE id = ${id} AND active = true
      `);

      if (project.length === 0) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      return project[0];
    } catch (error) {
      fastify.log.error('Error fetching project:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create project
  fastify.post('/api/v1/project', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateProjectSchema,
      response: {
        201: ProjectSchema,
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
    };

    const scopeAccess = await checkScopeAccess(userId, 'project', 'create', undefined);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Validate referenced entities if specified
      if (data.locationId) {
        const locationExists = await db.execute(sql`
          SELECT id FROM app.d_scope_location WHERE id = ${data.locationId} AND active = true
        `);
        if (locationExists.length === 0) {
          return reply.status(400).send({ error: 'Referenced location does not exist' });
        }
      }

      if (data.bizId) {
        const businessExists = await db.execute(sql`
          SELECT id FROM app.d_scope_business WHERE id = ${data.bizId} AND active = true
        `);
        if (businessExists.length === 0) {
          return reply.status(400).send({ error: 'Referenced business unit does not exist' });
        }
      }

      if (data.worksiteId) {
        const worksiteExists = await db.execute(sql`
          SELECT id FROM app.d_worksite WHERE id = ${data.worksiteId} AND active = true
        `);
        if (worksiteExists.length === 0) {
          return reply.status(400).send({ error: 'Referenced worksite does not exist' });
        }
      }

      // Generate slug if not provided
      let slug = data.slug;
      if (!slug) {
        slug = data.name.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }

      // Check for unique slug
      const existingSlug = await db.execute(sql`
        SELECT id FROM app.ops_project_head WHERE slug = ${slug} AND active = true
      `);
      if (existingSlug.length > 0) {
        return reply.status(400).send({ error: 'Project with this slug already exists' });
      }

      const result = await db.execute(sql`
        INSERT INTO app.ops_project_head (
          tenant_id, name, slug, location_specific, location_id, 
          business_specific, biz_id, worksite_specific, worksite_id, active
        )
        VALUES (
          gen_random_uuid(), ${data.name}, ${slug}, 
          ${data.locationSpecific || false}, ${data.locationId || null},
          ${data.businessSpecific || false}, ${data.bizId || null},
          ${data.worksiteSpecific || false}, ${data.worksiteId || null},
          ${data.active !== false}
        )
        RETURNING 
          id,
          name,
          slug,
          location_specific as "locationSpecific",
          location_id as "locationId",
          business_specific as "businessSpecific",
          biz_id as "bizId",
          worksite_specific as "worksiteSpecific",
          worksite_id as "worksiteId",
          active,
          created,
          updated
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to create project' });
      }

      return reply.status(201).send(result[0]);
    } catch (error) {
      fastify.log.error('Error creating project:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update project
  fastify.put('/api/v1/project/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
      body: UpdateProjectSchema,
      response: {
        200: ProjectSchema,
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
    };

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
      if (data.locationId) {
        const locationExists = await db.execute(sql`
          SELECT id FROM app.d_scope_location WHERE id = ${data.locationId} AND active = true
        `);
        if (locationExists.length === 0) {
          return reply.status(400).send({ error: 'Referenced location does not exist' });
        }
      }

      if (data.bizId) {
        const businessExists = await db.execute(sql`
          SELECT id FROM app.d_scope_business WHERE id = ${data.bizId} AND active = true
        `);
        if (businessExists.length === 0) {
          return reply.status(400).send({ error: 'Referenced business unit does not exist' });
        }
      }

      if (data.worksiteId) {
        const worksiteExists = await db.execute(sql`
          SELECT id FROM app.d_worksite WHERE id = ${data.worksiteId} AND active = true
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

      // Build update fields
      const updateFields = [];
      
      if (data.name !== undefined) {
        updateFields.push(sql`name = ${data.name}`);
      }
      
      if (data.slug !== undefined) {
        updateFields.push(sql`slug = ${data.slug}`);
      }
      
      if (data.locationSpecific !== undefined) {
        updateFields.push(sql`location_specific = ${data.locationSpecific}`);
      }
      
      if (data.locationId !== undefined) {
        updateFields.push(sql`location_id = ${data.locationId}`);
      }
      
      if (data.businessSpecific !== undefined) {
        updateFields.push(sql`business_specific = ${data.businessSpecific}`);
      }
      
      if (data.bizId !== undefined) {
        updateFields.push(sql`biz_id = ${data.bizId}`);
      }
      
      if (data.worksiteSpecific !== undefined) {
        updateFields.push(sql`worksite_specific = ${data.worksiteSpecific}`);
      }
      
      if (data.worksiteId !== undefined) {
        updateFields.push(sql`worksite_id = ${data.worksiteId}`);
      }
      
      if (data.active !== undefined) {
        updateFields.push(sql`active = ${data.active}`);
      }

      if (updateFields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updateFields.push(sql`updated = NOW()`);

      const result = await db.execute(sql`
        UPDATE app.ops_project_head 
        SET ${sql.join(updateFields, sql`, `)}
        WHERE id = ${id}
        RETURNING 
          id,
          name,
          slug,
          location_specific as "locationSpecific",
          location_id as "locationId",
          business_specific as "businessSpecific",
          biz_id as "bizId",
          worksite_specific as "worksiteSpecific",
          worksite_id as "worksiteId",
          active,
          created,
          updated
      `);

      if (result.length === 0) {
        return reply.status(500).send({ error: 'Failed to update project' });
      }

      return result[0];
    } catch (error) {
      fastify.log.error('Error updating project:');
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
      fastify.log.error('Error deleting project:');
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
          project: ProjectSchema,
          currentStatus: Type.Object({
            statusId: Type.String(),
            statusName: Type.String(),
            stageId: Type.Optional(Type.Number()),
            stageName: Type.Optional(Type.String()),
            dates: Type.Object({}),
          }),
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
          name,
          slug,
          location_specific as "locationSpecific",
          location_id as "locationId",
          business_specific as "businessSpecific",
          biz_id as "bizId",
          worksite_specific as "worksiteSpecific",
          worksite_id as "worksiteId",
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
          mps2.name as "stageName",
          pr.dates
        FROM app.ops_project_records pr
        JOIN app.meta_project_status mps ON pr.status_id = mps.id
        LEFT JOIN app.meta_project_stage mps2 ON pr.stage_id = mps2.level_id
        WHERE pr.head_id = ${id} AND pr.active = true
        ORDER BY pr.from_ts DESC
        LIMIT 1
      `);

      if (currentStatus.length === 0) {
        return reply.status(404).send({ error: 'Project status not found' });
      }

      return {
        project: project[0],
        currentStatus: currentStatus[0],
      };
    } catch (error) {
      fastify.log.error('Error fetching project status:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}