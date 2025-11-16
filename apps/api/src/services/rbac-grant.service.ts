/**
 * ============================================================================
 * RBAC GRANT SERVICE - Centralized Permission Management
 * ============================================================================
 *
 * Centralized service for granting RBAC permissions to users/roles on entities.
 * Used across all entity CREATE endpoints to auto-grant creator permissions.
 *
 * USAGE in entity routes (project, task, form, etc.):
 * ```typescript
 * import { grantPermission } from '@/services/rbac-grant.service.js';
 * import { Permission } from '@/lib/unified-data-gate.js';
 *
 * await grantPermission(db, {
 *   personEntityName: 'employee',
 *   personEntityId: userId,
 *   entityName: 'project',
 *   entityId: projectId,
 *   permission: Permission.OWNER
 * });
 * ```
 */

import type { DB } from '@/db/index.js';
import { sql } from 'drizzle-orm';

export interface GrantPermissionParams {
  personEntityName: 'employee' | 'role';
  personEntityId: string;
  entityName: string;
  entityId: string;
  permission: number;
  expiresTs?: string | null;
}

export interface RBACPermission {
  id: string;
  person_entity_name: string;
  person_entity_id: string;
  entity_name: string;
  entity_id: string;
  permission: number;
  active_flag: boolean;
  expires_ts: string | null;
  created_ts: string;
  updated_ts: string;
}

/**
 * Grant Permission to Person/Role on Entity (Idempotent)
 *
 * If permission already exists:
 * - Updates to new permission level if different
 * - Reactivates if inactive
 * - Returns existing if already active with same permission
 *
 * @param db - Database instance
 * @param params - Permission grant parameters
 * @returns The created or updated permission record
 */
export async function grantPermission(
  db: DB,
  params: GrantPermissionParams
): Promise<RBACPermission> {
  const {
    personEntityName,
    personEntityId,
    entityName,
    entityId,
    permission,
    expiresTs = null
  } = params;

  // Check if permission already exists
  const existingCheck = await db.execute(sql`
    SELECT * FROM app.d_entity_rbac
    WHERE person_entity_name = ${personEntityName}
      AND person_entity_id = ${personEntityId}::uuid
      AND entity_name = ${entityName}
      AND entity_id = ${entityId}::uuid
  `);

  if (existingCheck.length > 0) {
    const existing = existingCheck[0] as RBACPermission;

    // If permission exists but is inactive or has different permission level, update it
    if (!existing.active_flag || existing.permission !== permission) {
      const updated = await db.execute(sql`
        UPDATE app.d_entity_rbac
        SET
          permission = ${permission},
          active_flag = true,
          expires_ts = ${expiresTs},
          updated_ts = NOW()
        WHERE id = ${existing.id}
        RETURNING *
      `);
      return updated[0] as RBACPermission;
    }

    // If already active with same permission, return the existing record
    return existing;
  }

  // Create new permission grant
  const result = await db.execute(sql`
    INSERT INTO app.d_entity_rbac (
      person_entity_name,
      person_entity_id,
      entity_name,
      entity_id,
      permission,
      active_flag,
      expires_ts
    )
    VALUES (
      ${personEntityName},
      ${personEntityId}::uuid,
      ${entityName},
      ${entityId}::uuid,
      ${permission},
      true,
      ${expiresTs}
    )
    RETURNING *
  `);

  return result[0] as RBACPermission;
}

/**
 * Revoke Permission from Person/Role on Entity (Soft Delete)
 *
 * @param db - Database instance
 * @param params - Permission identification parameters
 * @returns The revoked permission record
 */
export async function revokePermission(
  db: DB,
  params: Omit<GrantPermissionParams, 'permission' | 'expiresTs'>
): Promise<RBACPermission | null> {
  const {
    personEntityName,
    personEntityId,
    entityName,
    entityId
  } = params;

  const result = await db.execute(sql`
    UPDATE app.d_entity_rbac
    SET
      active_flag = false,
      updated_ts = NOW()
    WHERE person_entity_name = ${personEntityName}
      AND person_entity_id = ${personEntityId}::uuid
      AND entity_name = ${entityName}
      AND entity_id = ${entityId}::uuid
      AND active_flag = true
    RETURNING *
  `);

  return result.length > 0 ? (result[0] as RBACPermission) : null;
}
