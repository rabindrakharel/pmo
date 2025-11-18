/**
 * ============================================================================
 * LINKAGE SERVICE - Centralized Entity Relationship Management
 * ============================================================================
 *
 * Extracted from /modules/linkage/routes.ts to be reusable across all modules.
 * Both the linkage API endpoints and entity creation endpoints use this service.
 *
 * USAGE in entity routes (project, task, etc.):
 * ```typescript
 * import { createLinkage } from '@/services/linkage.service.js';
 *
 * await createLinkage(db, {
 *   parent_entity_type: 'business',
 *   parent_entity_id: businessId,
 *   child_entity_type: 'project',
 *   child_entity_id: projectId
 * });
 * ```
 */

import type { DB } from '@/db/index.js';
import { sql } from 'drizzle-orm';

export interface CreateLinkageParams {
  parent_entity_type: string;
  parent_entity_id: string;
  child_entity_type: string;
  child_entity_id: string;
  relationship_type?: string;
}

export interface Linkage {
  id: string;
  parent_entity_type: string;
  parent_entity_id: string;
  child_entity_type: string;
  child_entity_id: string;
  relationship_type: string;
  active_flag: boolean;
  created_ts: string;
  updated_ts: string;
}

/**
 * Create or Reactivate Entity Linkage (Idempotent)
 *
 * If linkage already exists:
 * - Reactivates if inactive
 * - Returns existing if already active
 */
export async function createLinkage(
  db: DB,
  params: CreateLinkageParams
): Promise<Linkage> {
  const {
    parent_entity_type,
    parent_entity_id,
    child_entity_type,
    child_entity_id,
    relationship_type = 'contains'
  } = params;

  // Check if linkage already exists
  const existingCheck = await db.execute(sql`
    SELECT * FROM app.entity_instance_link
    WHERE parent_entity_type = ${parent_entity_type}
      AND parent_entity_id = ${parent_entity_id}
      AND child_entity_type = ${child_entity_type}
      AND child_entity_id = ${child_entity_id}
  `);

  if (existingCheck.length > 0) {
    // If linkage exists but is inactive, reactivate it
    if (!existingCheck[0].active_flag) {
      const reactivated = await db.execute(sql`
        UPDATE app.entity_instance_link
        SET active_flag = true, updated_ts = now()
        WHERE id = ${existingCheck[0].id}
        RETURNING *
      `);
      return reactivated[0] as Linkage;
    }
    // If already active, return the existing linkage
    return existingCheck[0] as Linkage;
  }

  // Create new linkage
  const result = await db.execute(sql`
    INSERT INTO app.entity_instance_link
    (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type, active_flag)
    VALUES (${parent_entity_type}, ${parent_entity_id}, ${child_entity_type}, ${child_entity_id}, ${relationship_type}, true)
    RETURNING *
  `);

  return result[0] as Linkage;
}

/**
 * Delete Entity Linkage (Soft Delete)
 */
export async function deleteLinkage(
  db: DB,
  linkageId: string
): Promise<Linkage> {
  const result = await db.execute(sql`
    UPDATE app.entity_instance_link
    SET active_flag = false, updated_ts = now()
    WHERE id = ${linkageId}
    RETURNING *
  `);

  if (result.length === 0) {
    throw new Error(`Linkage not found: ${linkageId}`);
  }

  return result[0] as Linkage;
}
