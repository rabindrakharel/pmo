import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '@/lib/config.js';
import { logger } from '@/lib/logger.js';

// Import all schemas
import * as metaSchema from './schema/meta.js';
import * as dimensionsSchema from './schema/dimensions.js';
import * as operationsSchema from './schema/operations.js';

// Create the postgres client
const client = postgres(config.DATABASE_URL, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
});

// Export client for raw SQL queries
export { client };

// Create drizzle instance with all schemas
export const db = drizzle(client, {
  schema: {
    ...metaSchema,
    ...dimensionsSchema,
    ...operationsSchema,
  },
  logger: config.NODE_ENV === 'development',
});

// Test database connection
export async function testConnection() {
  try {
    await client`SELECT 1`;
    logger.info('✅ Database connection successful');
    return true;
  } catch (error) {
    logger.error('❌ Database connection failed', { error });
    return false;
  }
}

// Graceful shutdown
export async function closeConnection() {
  try {
    await client.end();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database connection', { error });
  }
}

// Export types
export type Database = typeof db;
export * from './schema/meta.js';
export * from './schema/dimensions.js';
export * from './schema/operations.js';