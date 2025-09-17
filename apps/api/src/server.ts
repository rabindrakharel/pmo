import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { config } from '@/lib/config.js';
import { logger } from '@/lib/logger.js';
import { testConnection, closeConnection } from '@/db/index.js';

// Import plugins and new API modules
import { registerAllRoutes } from '@/modules/index.js';

const fastify = Fastify({
  logger: config.NODE_ENV === 'development' ? {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
      },
    },
  } : true,
}).withTypeProvider<TypeBoxTypeProvider>();

// Security
await fastify.register(helmet, {
  contentSecurityPolicy: false, // Disable for development
});

// CORS - allow frontend origin explicitly
await fastify.register(cors, {
  origin: (origin, cb) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return cb(null, true);
    
    // Allow localhost development origins
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return cb(null, true);
    }
    
    // Allow configured origins
    const allowedOrigins = [config.WEB_ORIGIN, config.API_ORIGIN];
    if (allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    
    return cb(new Error("Not allowed by CORS"), false);
  },
  credentials: true,
});

// Rate limiting
await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

// JWT
await fastify.register(jwt, {
  secret: config.JWT_SECRET,
});

// Abilities plugin removed - using on-demand RBAC instead

// Swagger
await fastify.register(swagger, {
  swagger: {
    info: {
      title: 'PMO API',
      description: 'Enterprise PMO Task Management Platform API',
      version: '1.0.0',
    },
    host: config.NODE_ENV === 'production' ? 'api.pmo.com' : `localhost:${config.PORT}`,
    schemes: [config.NODE_ENV === 'production' ? 'https' : 'http'],
    consumes: ['application/json'],
    produces: ['application/json'],
    tags: [
      { name: 'clients', description: 'Client management' },
      { name: 'locations', description: 'Location hierarchy management' },
      { name: 'businesses', description: 'Business hierarchy management' },
      { name: 'projects', description: 'Project management' },
      { name: 'tasks', description: 'Task management' },
      { name: 'employees', description: 'Employee and role management' },
      { name: 'worksites', description: 'Worksite management' },
      { name: 'meta', description: 'Metadata and configuration' },
      { name: 'admin', description: 'Administration and configuration' },
      { name: 'system', description: 'System endpoints' },
      { name: 'health', description: 'Health checks' },
    ],
  },
});

await fastify.register(swaggerUI, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false,
  },
});

// Health checks
fastify.get('/healthz', {
  schema: {
    tags: ['health'],
    summary: 'Liveness check',
    response: {
      200: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          timestamp: { type: 'string' },
        },
      },
    },
  },
}, async () => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
});

fastify.get('/readyz', {
  schema: {
    tags: ['health'],
    summary: 'Readiness check',
    response: {
      200: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          timestamp: { type: 'string' },
          checks: { type: 'object' },
        },
      },
      503: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          timestamp: { type: 'string' },
          checks: { type: 'object' },
        },
      },
    },
  },
}, async (request, reply) => {
  const checks = {
    database: await testConnection(),
    // Add other checks here (Redis, S3, etc.)
  };

  const allHealthy = Object.values(checks).every(check => check === true);
  const status = allHealthy ? 'ready' : 'not ready';
  const code = allHealthy ? 200 : 503;

  reply.status(code);
  return {
    status,
    timestamp: new Date().toISOString(),
    checks,
  };
});

// JWT authentication decorator
fastify.decorate('authenticate', async function(request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'User not authenticated' });
  }
});

// Register new RBAC-based API routes
await registerAllRoutes(fastify);

// Error handling
fastify.setErrorHandler((error, request, reply) => {
  logger.error('Unhandled error', { 
    error: error.message, 
    stack: error.stack,
    url: request.url,
    method: request.method,
  });

  reply.status(500).send({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  
  try {
    await fastify.close();
    await closeConnection();
    logger.info('Server shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
try {
  await fastify.listen({ 
    host: config.HOST, 
    port: config.PORT 
  });
  
  logger.info(`🚀 PMO API Server running on http://${config.HOST}:${config.PORT}`);
  logger.info(`📖 API Documentation: http://${config.HOST}:${config.PORT}/docs`);
  
  // Test database connection on startup
  await testConnection();
  
} catch (error) {
  logger.error('Error starting server', { error });
  process.exit(1);
}