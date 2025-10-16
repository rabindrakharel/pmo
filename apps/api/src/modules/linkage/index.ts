import type { FastifyInstance } from 'fastify';
import { linkageRoutes } from './routes.js';
import { typeLinkageRoutes } from './type-routes.js';

export async function linkageModule(fastify: FastifyInstance) {
  // Register instance linkage routes (entity_id_map)
  await linkageRoutes(fastify);

  // Register type linkage routes (entity_type_linkage_map)
  await typeLinkageRoutes(fastify);
}
