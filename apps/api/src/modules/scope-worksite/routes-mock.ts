import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';

const WorksiteSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  locationId: Type.Optional(Type.String()),
  businessId: Type.Optional(Type.String()),
  address: Type.Optional(Type.String()),
  coordinates: Type.Optional(Type.Object({
    lat: Type.Number(),
    lng: Type.Number(),
  })),
  capacity: Type.Optional(Type.Number()),
  active: Type.Boolean(),
  created: Type.String(),
  updated: Type.String(),
});

const CreateWorksiteSchema = Type.Object({
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  locationId: Type.Optional(Type.String()),
  businessId: Type.Optional(Type.String()),
  address: Type.Optional(Type.String()),
  coordinates: Type.Optional(Type.Object({
    lat: Type.Number(),
    lng: Type.Number(),
  })),
  capacity: Type.Optional(Type.Number()),
  active: Type.Boolean(),
});

const UpdateWorksiteSchema = Type.Partial(CreateWorksiteSchema);

export async function worksiteRoutes(fastify: FastifyInstance) {
  // List worksites with filtering
  fastify.get('/api/v1/worksite', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        locationId: Type.Optional(Type.String()),
        businessId: Type.Optional(Type.String()),
        active: Type.Optional(Type.Boolean()),
        limit: Type.Optional(Type.Number()),
        offset: Type.Optional(Type.Number()),
      }),
    },
  }, async (request, reply) => {
    const { locationId, businessId, active, limit = 50, offset = 0 } = request.query as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };


    try {
      // Mock worksites data - inherits from both location and business scopes
      const mockWorksites = [
        {
          id: 'ws-1',
          name: 'Toronto Development Center',
          desc: 'Main development facility in Toronto',
          locationId: 'loc-1',
          businessId: 'biz-1',
          address: '123 Tech Street, Toronto, ON M5V 3A8',
          coordinates: { lat: 43.6532, lng: -79.3832 },
          capacity: 200,
          active: true,
          created: '2024-01-01T00:00:00Z',
          updated: '2024-01-01T00:00:00Z',
        },
        {
          id: 'ws-2',
          name: 'London Research Lab',
          desc: 'R&D facility in London',
          locationId: 'loc-2',
          businessId: 'biz-1',
          address: '456 Innovation Drive, London, ON N6A 5B9',
          coordinates: { lat: 42.9849, lng: -81.2453 },
          capacity: 50,
          active: true,
          created: '2024-01-01T00:00:00Z',
          updated: '2024-01-01T00:00:00Z',
        },
        {
          id: 'ws-3',
          name: 'Sales Training Center',
          desc: 'Training facility for sales team',
          locationId: 'loc-1',
          businessId: 'biz-2',
          address: '789 Commerce Plaza, Toronto, ON M4W 1A8',
          capacity: 100,
          active: false,
          created: '2024-01-01T00:00:00Z',
          updated: '2024-03-01T00:00:00Z',
        },
      ];

      // Apply filters
      let filtered = mockWorksites;
      if (locationId) {
        filtered = filtered.filter(ws => ws.locationId === locationId);
      }
      if (businessId) {
        filtered = filtered.filter(ws => ws.businessId === businessId);
      }
      if (active !== undefined) {
        filtered = filtered.filter(ws => ws.active === active);
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
      fastify.log.error('Error fetching worksites:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Get single worksite
  fastify.get('/api/v1/worksite/:id', {
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


    try {
      const mockWorksite = {
        id,
        name: 'Toronto Development Center',
        desc: 'Main development facility in Toronto',
        locationId: 'loc-1',
        businessId: 'biz-1',
        address: '123 Tech Street, Toronto, ON M5V 3A8',
        coordinates: { lat: 43.6532, lng: -79.3832 },
        capacity: 200,
        active: true,
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
      };

      return mockWorksite;
    } catch (error) {
      fastify.log.error('Error fetching worksite:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Create worksite
  fastify.post('/api/v1/worksite', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateWorksiteSchema,
    },
  }, async (request, reply) => {
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };


    try {

      const newWorksite = {
        id: `ws-${Date.now()}`,
        ...data,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      };

      return reply.status(201).send(newWorksite);
    } catch (error) {
      fastify.log.error('Error creating worksite:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Update worksite
  fastify.put('/api/v1/worksite/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      body: UpdateWorksiteSchema,
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const userId = (request as any).user?.sub;

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' });
    };


    try {

      const updatedWorksite = {
        id,
        name: 'Toronto Development Center',
        desc: 'Main development facility in Toronto',
        locationId: 'loc-1',
        businessId: 'biz-1',
        address: '123 Tech Street, Toronto, ON M5V 3A8',
        coordinates: { lat: 43.6532, lng: -79.3832 },
        capacity: 200,
        active: true,
        created: '2024-01-01T00:00:00Z',
        updated: new Date().toISOString(),
        ...data,
      };

      return updatedWorksite;
    } catch (error) {
      fastify.log.error('Error updating worksite:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Delete worksite
  fastify.delete('/api/v1/worksite/:id', {
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


    try {
      return reply.status(204).send();
    } catch (error) {
      fastify.log.error('Error deleting worksite:');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}