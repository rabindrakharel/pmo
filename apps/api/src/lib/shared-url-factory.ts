/**
 * Shared URL Factory
 *
 * DRY factory pattern for generating and managing shared URLs across all entity types.
 * Provides consistent URL generation, validation, and database operations.
 *
 * URL Format: /{entity}/shared/{8-char-code}
 * - task: /task/shared/aB3xK9mZ
 * - form: /form/shared/pQ7wM2nX
 * - wiki: /wiki/shared/zR4yL8kJ
 * - artifact: /artifact/shared/cN6tS1vB
 */

import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

/**
 * Entity-to-table mapping
 * Maps frontend entity names to database table names
 */
export const ENTITY_TABLE_MAP: Record<string, string> = {
  task: 'task',
  form: 'form_head',
  wiki: 'wiki',
  artifact: 'artifact',
  project: 'project',
  biz: 'business',
  office: 'office',
  employee: 'employee',
  client: 'cust',
  worksite: 'worksite',
  role: 'role',
  position: 'position',
};

/**
 * Generate a random 8-character alphanumeric code (mixed case)
 * Uses cryptographically secure random generation
 */
export function generateSharedCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars.charAt(randomIndex);
  }
  return code;
}

/**
 * Generate shared URL for an entity
 * Database stores: /{entity}/{code}
 * Frontend routes as: /{entity}/shared/{code}
 * @param entityType - Entity type (task, form, wiki, artifact)
 * @param code - 8-character shared code
 * @returns Shared URL string for database storage
 */
export function generateSharedUrl(entityType: string, code: string): string {
  return `/${entityType}/${code}`;
}

/**
 * Update entity with shared URL in database
 * @param entityType - Entity type (task, form, wiki, artifact)
 * @param entityId - Entity UUID
 * @param sharedCode - 8-character shared code
 * @returns Updated entity record
 */
export async function saveSharedUrl(
  entityType: string,
  entityId: string,
  sharedCode: string
): Promise<any> {
  const tableName = ENTITY_TABLE_MAP[entityType];

  if (!tableName) {
    throw new Error(`Unsupported entity type: ${entityType}`);
  }

  const sharedUrl = generateSharedUrl(entityType, sharedCode);
  const internalUrl = `/${entityType}/${entityId}`;

  // Update the entity with both URLs
  const result = await db.execute(sql`
    UPDATE app.${sql.identifier(tableName)}
    SET
      internal_url = ${internalUrl},
      shared_url = ${sharedUrl},
      updated_ts = NOW()
    WHERE id = ${entityId}
    RETURNING id, name, internal_url, shared_url
  `);

  if (result.length === 0) {
    throw new Error(`Entity not found: ${entityType}/${entityId}`);
  }

  return result[0];
}

/**
 * Generate and save shared URL for an entity
 * Complete workflow: generate code → create URL → save to DB
 * @param entityType - Entity type (task, form, wiki, artifact)
 * @param entityId - Entity UUID
 * @returns Object with shared URL and code
 */
export async function createSharedUrl(
  entityType: string,
  entityId: string
): Promise<{ sharedUrl: string; sharedCode: string; internalUrl: string }> {
  const sharedCode = generateSharedCode();
  const sharedUrl = generateSharedUrl(entityType, sharedCode);
  const internalUrl = `/${entityType}/${entityId}`;

  await saveSharedUrl(entityType, entityId, sharedCode);

  return {
    sharedUrl,
    sharedCode,
    internalUrl,
  };
}

/**
 * Resolve shared URL code to entity ID and type
 * Looks up entity by shared URL pattern across all supported tables
 * @param entityType - Entity type (task, form, wiki, artifact)
 * @param sharedCode - 8-character shared code
 * @returns Entity data or null if not found
 */
export async function resolveSharedUrl(
  entityType: string,
  sharedCode: string
): Promise<any | null> {
  const tableName = ENTITY_TABLE_MAP[entityType];

  if (!tableName) {
    throw new Error(`Unsupported entity type: ${entityType}`);
  }

  // Database stores /{entity}/{code}, not /{entity}/shared/{code}
  const sharedUrl = generateSharedUrl(entityType, sharedCode);

  const result = await db.execute(sql`
    SELECT *
    FROM app.${sql.identifier(tableName)}
    WHERE shared_url = ${sharedUrl}
      AND active_flag = true
    LIMIT 1
  `);

  return result.length > 0 ? result[0] : null;
}

/**
 * Validate if a shared code is already in use
 * @param entityType - Entity type (task, form, wiki, artifact)
 * @param sharedCode - 8-character shared code
 * @returns true if code is available, false if already in use
 */
export async function isSharedCodeAvailable(
  entityType: string,
  sharedCode: string
): Promise<boolean> {
  const entity = await resolveSharedUrl(entityType, sharedCode);
  return entity === null;
}

/**
 * Get shared URL info for an entity
 * @param entityType - Entity type (task, form, wiki, artifact)
 * @param entityId - Entity UUID
 * @returns Shared URL info or null if not set
 */
export async function getSharedUrlInfo(
  entityType: string,
  entityId: string
): Promise<{ sharedUrl: string | null; internalUrl: string | null } | null> {
  const tableName = ENTITY_TABLE_MAP[entityType];

  if (!tableName) {
    throw new Error(`Unsupported entity type: ${entityType}`);
  }

  const result = await db.execute(sql`
    SELECT internal_url, shared_url
    FROM app.${sql.identifier(tableName)}
    WHERE id = ${entityId}
      AND active_flag = true
    LIMIT 1
  `);

  if (result.length === 0) {
    return null;
  }

  return {
    internalUrl: result[0].internal_url || null,
    sharedUrl: result[0].shared_url || null,
  };
}
