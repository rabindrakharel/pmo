const fastify = require('fastify')({ logger: true });

// Declare a route
fastify.get('/', async (request, reply) => {
  return { 
    message: 'PMO API Server is running!',
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  };
});

fastify.get('/healthz', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

fastify.get('/v1/meta/task-stages', async (request, reply) => {
  return {
    data: [
      { id: '1', code: 'backlog', name: 'Backlog', sortId: 5, isDefault: true, isDone: false, isBlocked: false, color: 'gray' },
      { id: '2', code: 'todo', name: 'To Do', sortId: 10, isDefault: false, isDone: false, isBlocked: false, color: 'blue' },
      { id: '3', code: 'in_progress', name: 'In Progress', sortId: 20, isDefault: false, isDone: false, isBlocked: false, color: 'orange' },
      { id: '4', code: 'review', name: 'Review', sortId: 30, isDefault: false, isDone: false, isBlocked: false, color: 'purple' },
      { id: '5', code: 'done', name: 'Done', sortId: 40, isDefault: false, isDone: true, isBlocked: false, color: 'green' },
      { id: '6', code: 'blocked', name: 'Blocked', sortId: 50, isDefault: false, isDone: false, isBlocked: true, color: 'red' }
    ]
  };
});

fastify.get('/v1/projects', async (request, reply) => {
  return {
    data: [
      {
        id: '1',
        name: 'Sample Project',
        slug: 'sample-project',
        status: 'active',
        stage: 'in_progress',
        createdAt: '2025-01-01T00:00:00Z'
      }
    ]
  };
});

fastify.get('/v1/tasks', async (request, reply) => {
  return {
    data: [
      {
        id: '1',
        title: 'Welcome to PMO!',
        status: 'todo',
        stageCode: 'todo',
        projectId: '1',
        assignee: null,
        dueDate: null,
        tags: ['welcome'],
        createdAt: '2025-01-01T00:00:00Z'
      },
      {
        id: '2',
        title: 'Complete setup',
        status: 'in_progress',
        stageCode: 'in_progress',
        projectId: '1',
        assignee: null,
        dueDate: null,
        tags: ['setup'],
        createdAt: '2025-01-01T00:00:00Z'
      },
      {
        id: '3',
        title: 'Review architecture',
        status: 'done',
        stageCode: 'done',
        projectId: '1',
        assignee: null,
        dueDate: null,
        tags: ['architecture'],
        createdAt: '2025-01-01T00:00:00Z'
      }
    ]
  };
});

fastify.post('/v1/tasks/:id/move', async (request, reply) => {
  const { id } = request.params;
  const { stage_code } = request.body;
  
  return {
    data: {
      id: id,
      stage_code: stage_code,
      message: `Task ${id} moved to ${stage_code}`
    }
  };
});

// Run the server!
const start = async () => {
  try {
    const port = process.env.API_PORT || 4000;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 PMO API Server running on http://localhost:${port}`);
    console.log(`📊 API Docs: http://localhost:${port}/`);
    console.log(`❤️  Health Check: http://localhost:${port}/healthz`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();