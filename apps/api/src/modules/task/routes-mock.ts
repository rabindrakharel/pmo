import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { checkScopeAccess, Permission } from '../rbac/scope-auth.js';

const TaskSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  projectId: Type.String(),
  assigneeId: Type.Optional(Type.String()),
  status: Type.String(), // 'pending', 'in-progress', 'review', 'completed', 'blocked'
  priority: Type.String(), // 'low', 'medium', 'high', 'urgent'
  estimatedHours: Type.Optional(Type.Number()),
  actualHours: Type.Optional(Type.Number()),
  dueDate: Type.Optional(Type.String()),
  completedDate: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  parentTaskId: Type.Optional(Type.String()),
  dependencies: Type.Optional(Type.Array(Type.String())),
  active: Type.Boolean(),
  created: Type.String(),
  updated: Type.String(),
});

const CreateTaskSchema = Type.Object({
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  projectId: Type.String(),
  assigneeId: Type.Optional(Type.String()),
  status: Type.String(),
  priority: Type.String(),
  estimatedHours: Type.Optional(Type.Number()),
  dueDate: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  parentTaskId: Type.Optional(Type.String()),
  dependencies: Type.Optional(Type.Array(Type.String())),
  active: Type.Boolean(),
});

const UpdateTaskSchema = Type.Partial(CreateTaskSchema);

export async function taskRoutes(fastify: FastifyInstance) {
  // List tasks with filtering
  fastify.get('/api/v1/task', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        projectId: Type.Optional(Type.String()),
        assigneeId: Type.Optional(Type.String()),
        status: Type.Optional(Type.String()),
        priority: Type.Optional(Type.String()),
        parentTaskId: Type.Optional(Type.String()),
        active: Type.Optional(Type.Boolean()),
        search: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number()),
        offset: Type.Optional(Type.Number()),
      }),
    },
  }, async (request, reply) => {
    const { 
      projectId, assigneeId, status, priority, parentTaskId, 
      active, search, limit = 50, offset = 0 
    } = request.query as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };

    const scopeAccess = await checkScopeAccess(userId, 'task', 'view', undefined);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Mock tasks data - inherits permissions from project scope
      const mockTasks = [
        {
          id: 'task-1',
          name: 'Design User Authentication System',
          desc: 'Design and implement secure user authentication with JWT tokens',
          projectId: 'proj-1',
          assigneeId: 'emp-1',
          status: 'in-progress',
          priority: 'high',
          estimatedHours: 40,
          actualHours: 32,
          dueDate: '2024-04-15T00:00:00Z',
          tags: ['backend', 'security', 'authentication'],
          parentTaskId: null,
          dependencies: [],
          active: true,
          created: '2024-01-15T00:00:00Z',
          updated: '2024-03-01T00:00:00Z',
        },
        {
          id: 'task-2',
          name: 'Create API Documentation',
          desc: 'Document all REST API endpoints with OpenAPI specification',
          projectId: 'proj-1',
          assigneeId: 'emp-2',
          status: 'pending',
          priority: 'medium',
          estimatedHours: 16,
          dueDate: '2024-04-20T00:00:00Z',
          tags: ['documentation', 'api'],
          parentTaskId: null,
          dependencies: [],
          active: true,
          created: '2024-02-01T00:00:00Z',
          updated: '2024-02-01T00:00:00Z',
        },
        {
          id: 'task-3',
          name: 'Mobile UI Prototype',
          desc: 'Create interactive prototypes for mobile application',
          projectId: 'proj-2',
          assigneeId: 'emp-3',
          status: 'completed',
          priority: 'high',
          estimatedHours: 24,
          actualHours: 28,
          dueDate: '2024-03-30T00:00:00Z',
          completedDate: '2024-03-28T00:00:00Z',
          tags: ['mobile', 'ui', 'prototype'],
          active: true,
          created: '2024-02-01T00:00:00Z',
          updated: '2024-03-28T00:00:00Z',
        },
      ];

      // Apply filters
      let filtered = mockTasks;
      if (projectId) {
        filtered = filtered.filter(task => task.projectId === projectId);
      }
      if (assigneeId) {
        filtered = filtered.filter(task => task.assigneeId === assigneeId);
      }
      if (status) {
        filtered = filtered.filter(task => task.status === status);
      }
      if (priority) {
        filtered = filtered.filter(task => task.priority === priority);
      }
      if (parentTaskId) {
        filtered = filtered.filter(task => task.parentTaskId === parentTaskId);
      }
      if (active !== undefined) {
        filtered = filtered.filter(task => task.active === active);
      }
      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(task => 
          task.name.toLowerCase().includes(searchLower) ||
          task.desc?.toLowerCase().includes(searchLower) ||
          task.tags?.some(tag => tag.toLowerCase().includes(searchLower))
        );
      }

      const total = filtered.length;
      const paginated = filtered.slice(offset, offset + limit);

      return {
        data: paginated,
        total,
        limit,
        offset,
      };
    } catch (error) {
      fastify.log.error('Error fetching tasks:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single task
  fastify.get('/api/v1/task/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };

    const scopeAccess = await checkScopeAccess(userId, 'task', 'view', id);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const mockTask = {
        id,
        name: 'Design User Authentication System',
        desc: 'Design and implement secure user authentication with JWT tokens',
        projectId: 'proj-1',
        assigneeId: 'emp-1',
        status: 'in-progress',
        priority: 'high',
        estimatedHours: 40,
        actualHours: 32,
        dueDate: '2024-04-15T00:00:00Z',
        tags: ['backend', 'security', 'authentication'],
        dependencies: [],
        active: true,
        created: '2024-01-15T00:00:00Z',
        updated: '2024-03-01T00:00:00Z',
      };

      return mockTask;
    } catch (error) {
      fastify.log.error('Error fetching task:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create task
  fastify.post('/api/v1/task', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateTaskSchema,
    },
  }, async (request, reply) => {
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };

    const scopeAccess = await checkScopeAccess(userId, 'task', 'create', undefined);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Validate project access (tasks inherit from project scope)
      const projectAccess = await checkScopeAccess(userId, 'project', 'view', data.projectId);
      if (!projectAccess.allowed) {
        return reply.status(403).send({ error: 'Insufficient project permissions' });
      }

      // Validate parent task access if specified
      if (data.parentTaskId) {
        const parentAccess = await checkScopeAccess(userId, 'task', 'view', data.parentTaskId);
        if (!parentAccess.allowed) {
          return reply.status(403).send({ error: 'Insufficient access to parent task' });
        }
      }

      // Validate assignee permissions if specified
      if (data.assigneeId) {
        const assigneeAccess = await checkScopeAccess(userId, 'employee', 'view', data.assigneeId);
        if (!assigneeAccess.allowed) {
          return reply.status(403).send({ error: 'Insufficient access to assignee' });
        }
      }

      const newTask = {
        id: `task-${Date.now()}`,
        ...data,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      };

      return reply.status(201).send(newTask);
    } catch (error) {
      fastify.log.error('Error creating task:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update task
  fastify.put('/api/v1/task/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      body: UpdateTaskSchema,
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };

    const scopeAccess = await checkScopeAccess(userId, 'task', 'modify', id);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      // Validate project access for updated fields
      if (data.projectId) {
        const projectAccess = await checkScopeAccess(userId, 'project', 'view', data.projectId);
        if (!projectAccess.allowed) {
          return reply.status(403).send({ error: 'Insufficient project permissions' });
        }
      }

      // Validate assignee permissions if updated
      if (data.assigneeId) {
        const assigneeAccess = await checkScopeAccess(userId, 'employee', 'view', data.assigneeId);
        if (!assigneeAccess.allowed) {
          return reply.status(403).send({ error: 'Insufficient access to assignee' });
        }
      }

      // Update actualHours and completedDate if status changed to completed
      const updateData = { ...data };
      if (data.status === 'completed' && !data.completedDate) {
        updateData.completedDate = new Date().toISOString();
      }

      const updatedTask = {
        id,
        name: 'Design User Authentication System',
        desc: 'Design and implement secure user authentication with JWT tokens',
        projectId: 'proj-1',
        assigneeId: 'emp-1',
        status: 'in-progress',
        priority: 'high',
        estimatedHours: 40,
        actualHours: 32,
        dueDate: '2024-04-15T00:00:00Z',
        tags: ['backend', 'security', 'authentication'],
        dependencies: [],
        active: true,
        created: '2024-01-15T00:00:00Z',
        updated: new Date().toISOString(),
        ...updateData,
      };

      return updatedTask;
    } catch (error) {
      fastify.log.error('Error updating task:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete task
  fastify.delete('/api/v1/task/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };

    const scopeAccess = await checkScopeAccess(userId, 'task', 'delete', id);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting task:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get task dependencies
  fastify.get('/api/v1/task/:id/dependencies', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };

    const scopeAccess = await checkScopeAccess(userId, 'task', 'view', id);
    if (!scopeAccess.allowed) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    try {
      const mockDependencies = {
        task: {
          id,
          name: 'Create API Documentation',
          status: 'pending',
        },
        dependencies: [
          {
            id: 'task-1',
            name: 'Design User Authentication System',
            status: 'in-progress',
            blocking: true,
          },
        ],
        dependents: [
          {
            id: 'task-4',
            name: 'Integration Testing',
            status: 'pending',
            waitingOn: id,
          },
        ],
      };

      return mockDependencies;
    } catch (error) {
      fastify.log.error('Error fetching task dependencies:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}