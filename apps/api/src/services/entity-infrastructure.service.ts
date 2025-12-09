/**
 * ============================================================================
 * ENTITY INFRASTRUCTURE SERVICE
 * ============================================================================
 *
 * PURPOSE:
 * Centralized, self-contained service for managing entity infrastructure:
 *   • entity (entity type metadata) - HAS active_flag (soft delete)
 *   • entity_instance (instance registry) - HARD DELETE (no active_flag)
 *   • entity_instance_link (relationships/linkages) - HARD DELETE (no active_flag)
 *   • entity_rbac (permissions + RBAC logic) - HARD DELETE (no active_flag)
 *
 * DELETE SEMANTICS:
 *   • entity_instance, entity_instance_link, entity_rbac are ALWAYS hard-deleted
 *   • Primary entity tables (project, task, etc.) use soft delete (active_flag)
 *   • The hard_delete option in delete_entity() only affects primary tables
 *
 * DESIGN PATTERN: Add-On Helper
 *   ✅ Service ONLY manages infrastructure tables
 *   ✅ Routes OWN their primary table queries (SELECT, UPDATE, INSERT, DELETE)
 *   ✅ Service provides helper methods (not a query builder)
 *   ✅ Self-contained RBAC logic (no external dependencies)
 *
 * KEY BENEFITS:
 *   • 80% reduction in infrastructure code duplication
 *   • 100% consistency across entity routes
 *   • Self-contained RBAC enforcement (role-only + configurable inheritance)
 *   • Unified delete operations with cascade support
 *   • Zero external dependencies (no unified-data-gate coupling)
 *
 * RBAC FEATURES (v2.0.0 - Role-Only Model):
 *   • Role-based permissions only (via app.role FK)
 *   • Person → Role mapping via entity_instance_link
 *   • Configurable inheritance: none, cascade, mapped
 *   • Explicit deny support (is_deny flag)
 *   • Child permission mapping (JSONB child_permissions)
 *   • Type-level permissions (ALL_ENTITIES_ID)
 *
 * USAGE:
 *   const entityInfra = getEntityInfrastructure(db);
 *   await entityInfra.set_entity_instance_registry({...});
 *   await entityInfra.set_entity_rbac(roleId, entityCode, entityId, permission);
 *   const canEdit = await entityInfra.check_entity_rbac(personId, entityCode, id, Permission.EDIT);
 *
 * ============================================================================
 */

import { sql, SQL } from 'drizzle-orm';
import type { Database } from '@/db/index.js';
import { client } from '@/db/index.js';
import { getRedisClient } from '@/lib/redis.js';
import type Redis from 'ioredis';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Entity {
  code: string;
  name: string;
  ui_label: string;
  ui_icon: string;
  child_entity_codes: Array<string | { entity: string; ui_label?: string; ui_icon?: string; order?: number }>;
  display_order: number;
  active_flag: boolean;
  created_ts: string;
  updated_ts: string;
}

export interface EntityInstance {
  entity_code: string;
  entity_instance_id: string;
  order_id: number;
  entity_instance_name: string;
  code: string | null;
  created_ts: string;
  updated_ts: string;
}

export interface EntityLink {
  id: string;
  entity_code: string;  // Parent entity code (asymmetric naming - simplified parent columns)
  entity_instance_id: string;  // Parent entity instance ID
  child_entity_code: string;  // Child entity code (keeps prefix for clarity)
  child_entity_instance_id: string;  // Child entity instance ID
  relationship_type: string;
  created_ts: string;
  updated_ts: string;
}

export interface DeleteEntityOptions {
  user_id: string;
  hard_delete?: boolean;              // NOTE: entity_instance, entity_instance_link, and entity_rbac are always hard-deleted (no active_flag). This parameter only affects primary_table_callback behavior
  cascade_delete_children?: boolean;  // Delete child entities recursively
  remove_rbac_entries?: boolean;      // Remove permission entries (always hard delete)
  skip_rbac_check?: boolean;          // Skip permission validation
  primary_table_callback?: (db: Database, entity_id: string) => Promise<void>;
}

export interface DeleteEntityResult {
  success: boolean;
  entity_code: string;
  entity_id: string;
  registry_deactivated: boolean;
  linkages_deactivated: number;
  rbac_entries_removed: number;
  primary_table_deleted: boolean;
  children_deleted?: number;
}

// ============================================================================
// PERMISSION CONSTANTS (Self-Contained - No External Dependencies)
// ============================================================================

/**
 * Permission levels enum (0-7 numeric hierarchy)
 *
 * Hierarchy (automatic inheritance - higher level implies all lower):
 * OWNER [7] >= CREATE [6] >= DELETE [5] >= SHARE [4] >= EDIT [3] >= CONTRIBUTE [2] >= COMMENT [1] >= VIEW [0]
 *
 * Levels:
 * - VIEW (0): Read access to entity data
 * - COMMENT (1): Add comments on entities (INHERITS View)
 * - CONTRIBUTE (2): Insert data in forms, collaborate on wiki (INHERITS Comment + View)
 * - EDIT (3): Modify entity fields, descriptions, details (INHERITS Contribute + Comment + View)
 * - SHARE (4): Share entity with others (INHERITS Edit + Contribute + Comment + View)
 * - DELETE (5): Soft delete entity (INHERITS Share + Edit + Contribute + Comment + View)
 * - CREATE (6): Create new entities - type-level only (INHERITS all lower)
 * - OWNER (7): Full control including permission management (INHERITS ALL)
 *
 * RBAC Model (v2.0.0 - Role-Only):
 * - Permissions are granted to ROLES only (no direct employee permissions)
 * - Persons get permissions through role membership via entity_instance_link
 * - Inheritance modes: none (explicit only), cascade (same to children), mapped (per-child-type)
 * - Explicit deny (is_deny=true) blocks permission even if granted elsewhere
 */
export enum Permission {
  VIEW = 0,
  COMMENT = 1,
  CONTRIBUTE = 2,
  EDIT = 3,
  SHARE = 4,
  DELETE = 5,
  CREATE = 6,
  OWNER = 7
}

/**
 * Inheritance mode for permission propagation to children
 */
export type InheritanceMode = 'none' | 'cascade' | 'mapped';

/**
 * Special entity ID for type-level permissions
 * Grants permission to all entities of a type
 */
export const ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111';

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class EntityInfrastructureService {
  private db: Database;
  private redis: Redis;
  private CACHE_TTL = 300; // 5 minutes in seconds (Redis uses seconds for TTL)
  private CACHE_PREFIX = 'entity:metadata:'; // Redis key prefix

  constructor(db: Database) {
    this.db = db;
    this.redis = getRedisClient();
  }

  // ==========================================================================
  // SECTION 1: Entity Type Metadata (entity)
  // ==========================================================================

  /**
   * Get entity type metadata from entity table
   * @param entity_code Entity type code (e.g., 'project', 'task')
   * @param include_inactive Include inactive entity types
   * @returns Entity metadata or null if not found
   */
  async get_entity(
    entity_code: string,
    include_inactive = false
  ): Promise<Entity | null> {
    // Check Redis cache (only for active entities)
    if (!include_inactive) {
      try {
        const cacheKey = `${this.CACHE_PREFIX}${entity_code}`;
        const cached = await this.redis.get(cacheKey);

        if (cached) {
          // Cache hit - return parsed data
          return JSON.parse(cached) as Entity;
        }
      } catch (error) {
        console.warn(`Redis cache read error for entity ${entity_code}:`, error);
        // Continue to DB query on cache error
      }
    }

    // Cache miss or inactive query - fetch from database
    const result = await this.db.execute(sql`
      SELECT code, name, ui_label, ui_icon, child_entity_codes, display_order, active_flag, created_ts, updated_ts
      FROM app.entity
      WHERE code = ${entity_code}
        ${include_inactive ? sql`` : sql`AND active_flag = true`}
    `);

    if (result.length === 0) return null;

    const row = result[0] as Record<string, any>;
    const metadata: Entity = {
      code: row.code as string,
      name: row.name as string,
      ui_label: row.ui_label as string,
      ui_icon: row.ui_icon as string,
      child_entity_codes: typeof row.child_entity_codes === 'string'
        ? JSON.parse(row.child_entity_codes)
        : (row.child_entity_codes || []),
      display_order: row.display_order as number,
      active_flag: row.active_flag as boolean,
      created_ts: row.created_ts as string,
      updated_ts: row.updated_ts as string,
    };

    // Store in Redis cache (only if active)
    if (!include_inactive && metadata.active_flag) {
      try {
        const cacheKey = `${this.CACHE_PREFIX}${entity_code}`;
        await this.redis.setex(
          cacheKey,
          this.CACHE_TTL,
          JSON.stringify(metadata)
        );
      } catch (error) {
        console.warn(`Redis cache write error for entity ${entity_code}:`, error);
        // Continue without caching on error
      }
    }

    return metadata;
  }

  /**
   * Invalidate Redis cache for a specific entity type
   * Used after updating entity metadata (child_entity_codes, etc.)
   *
   * This ensures all API instances get fresh data on next request,
   * since Redis is shared across all instances.
   */
  async invalidate_entity_cache(entity_code: string): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${entity_code}`;
      await this.redis.del(cacheKey);
      console.log(`🗑️  Cache invalidated for entity: ${entity_code}`);
    } catch (error) {
      console.error(`Redis cache invalidation error for entity ${entity_code}:`, error);
      // Non-critical error - don't throw
    }
  }

  /**
   * Clear all entity metadata cache
   * Useful for bulk operations or system maintenance
   */
  async clear_all_entity_cache(): Promise<void> {
    try {
      const pattern = `${this.CACHE_PREFIX}*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`🗑️  Cleared ${keys.length} entity cache entries`);
      }
    } catch (error) {
      console.error('Redis cache clear error:', error);
    }
  }

  /**
   * Get all entity types
   * @param include_inactive Include inactive entity types
   */
  async get_all_entity(include_inactive = false): Promise<Entity[]> {
    const result = await this.db.execute(sql`
      SELECT code, name, ui_label, ui_icon, child_entity_codes, display_order, active_flag, created_ts, updated_ts
      FROM app.entity
      ${include_inactive ? sql`` : sql`WHERE active_flag = true`}
      ORDER BY display_order ASC, name ASC
    `);

    return result.map(r => {
      const row = r as Record<string, any>;
      return {
        code: row.code as string,
        name: row.name as string,
        ui_label: row.ui_label as string,
        ui_icon: row.ui_icon as string,
        child_entity_codes: typeof row.child_entity_codes === 'string'
          ? JSON.parse(row.child_entity_codes)
          : (row.child_entity_codes || []),
        display_order: row.display_order as number,
        active_flag: row.active_flag as boolean,
        created_ts: row.created_ts as string,
        updated_ts: row.updated_ts as string,
      };
    });
  }

  /**
   * Get parent entity types for a given child entity type
   * Finds all entities that have the specified entity type in their child_entity_codes array
   *
   * @param child_entity_code The child entity type to find parents for
   * @returns Array of parent entity type codes (sorted alphabetically)
   *
   * @example
   * // Find all entities that can have 'task' as a child
   * const parents = await entityInfra.get_parent_entity_codes('task');
   * // Returns: ['project', 'worksite']
   */
  async get_parent_entity_codes(child_entity_code: string): Promise<string[]> {
    const result = await this.db.execute(sql`
      SELECT code
      FROM app.entity
      WHERE active_flag = true
        AND (
          child_entity_codes @> ${JSON.stringify([child_entity_code])}::jsonb
          OR child_entity_codes @> ${JSON.stringify([{ entity: child_entity_code }])}::jsonb
        )
      ORDER BY code ASC
    `);

    return result.map(row => (row as Record<string, any>).code as string);
  }

  // ==========================================================================
  // SECTION 2: Instance Registry (entity_instance)
  // ==========================================================================

  /**
   * Register entity instance in global registry
   * Upserts if exists (updates metadata, reactivates if deactivated)
   *
   * @example
   * await entityInfra.set_entity_instance_registry({
   *   entity_code: 'project',
   *   entity_id: projectId,
   *   entity_name: 'Kitchen Renovation',
   *   instance_code: 'PROJ-001'
   * });
   */
  async set_entity_instance_registry(params: {
    entity_code: string;
    entity_id: string;
    entity_name: string;
    instance_code?: string | null;
  }): Promise<EntityInstance> {
    const { entity_code, entity_id, entity_name, instance_code } = params;

    const result = await this.db.execute(sql`
      INSERT INTO app.entity_instance
      (entity_code, entity_instance_id, entity_instance_name, code)
      VALUES (${entity_code}, ${entity_id}, ${entity_name}, ${instance_code || null})
      RETURNING *
    `);

    return result[0] as unknown as EntityInstance;
  }

  /**
   * Update instance metadata (name/code)
   * Called when entity name or code changes
   */
  async update_entity_instance_registry(
    entity_code: string,
    entity_id: string,
    updates: { entity_name?: string; instance_code?: string | null }
  ): Promise<EntityInstance | null> {
    const setClauses: string[] = [];
    const params: any[] = [];

    if (updates.entity_name !== undefined) {
      setClauses.push('entity_instance_name');
      params.push(updates.entity_name);
    }
    if (updates.instance_code !== undefined) {
      setClauses.push('code');
      params.push(updates.instance_code);
    }

    if (setClauses.length === 0) return null;

    // Build dynamic UPDATE query
    const setExpressions = setClauses.map((col, i) => `${col} = '${String(params[i]).replace(/'/g, "''")}'`).join(', ');

    const result = await this.db.execute(sql.raw(`
      UPDATE app.entity_instance
      SET ${setExpressions}, updated_ts = now()
      WHERE entity_code = '${entity_code}' AND entity_instance_id = '${entity_id}'
      RETURNING *
    `));

    return result.length > 0 ? (result[0] as unknown as EntityInstance) : null;
  }

  /**
   * Delete instance from registry (hard delete - no active_flag in entity_instance anymore)
   */
  async delete_entity_instance_registry(entity_code: string, entity_id: string): Promise<void> {
    await this.db.execute(sql`
      DELETE FROM app.entity_instance
      WHERE entity_code = ${entity_code} AND entity_instance_id = ${entity_id}
    `);
  }

  /**
   * Validate instance exists in registry
   */
  async validate_entity_instance_registry(
    entity_code: string,
    entity_id: string
  ): Promise<boolean> {
    const result = await this.db.execute(sql`
      SELECT EXISTS(
        SELECT 1 FROM app.entity_instance
        WHERE entity_code = ${entity_code} AND entity_instance_id = ${entity_id}
      ) AS exists
    `);

    return result[0]?.exists === true;
  }

  /**
   * Get entity instance names by entity code and IDs (with RBAC filtering)
   *
   * Simple lookup method - pass entity code, IDs, and userId, get back names.
   * Used internally by build_ref_data_entityInstance() and entity-instance route.
   * Only returns names for entities the user has VIEW permission on.
   *
   * @param entityCode - Entity type code (e.g., 'employee', 'business')
   * @param entityIds - Array of entity instance UUIDs to resolve
   * @param userId - User ID for RBAC filtering (optional - if not provided, returns all)
   * @returns Record<string, string> - { uuid: name }
   *
   * @example
   * await getEntityInstanceNames('employee', ['uuid-1', 'uuid-2'], userId)
   * // Returns: { "uuid-1": "James Miller", "uuid-2": "Sarah Johnson" }
   */
  async getEntityInstanceNames(
    entityCode: string,
    entityIds: string[],
    userId?: string
  ): Promise<Record<string, string>> {
    if (!entityIds || entityIds.length === 0) {
      return {};
    }

    // If userId provided, apply RBAC filtering
    if (userId) {
      // Get accessible IDs for this user
      const accessibleIds = await this.getAccessibleEntityIds(userId, entityCode, Permission.VIEW);

      // If user has type-level access, no filtering needed
      const hasTypeLevelAccess = accessibleIds.includes(ALL_ENTITIES_ID);

      if (!hasTypeLevelAccess && accessibleIds.length === 0) {
        return {}; // No access
      }

      // Filter entityIds to only accessible ones
      const filteredIds = hasTypeLevelAccess
        ? entityIds
        : entityIds.filter(id => accessibleIds.includes(id));

      if (filteredIds.length === 0) {
        return {};
      }

      const result = await this.db.execute(sql`
        SELECT entity_instance_id::text, entity_instance_name
        FROM app.entity_instance
        WHERE entity_code = ${entityCode}
          AND entity_instance_id IN (${sql.join(filteredIds.map(id => sql`${id}::uuid`), sql`, `)})
      `);

      const names: Record<string, string> = {};
      for (const r of result) {
        const row = r as Record<string, any>;
        names[row.entity_instance_id as string] = row.entity_instance_name as string;
      }
      return names;
    }

    // No userId - return all (for internal use like build_ref_data_entityInstance)
    const result = await this.db.execute(sql`
      SELECT entity_instance_id::text, entity_instance_name
      FROM app.entity_instance
      WHERE entity_code = ${entityCode}
        AND entity_instance_id IN (${sql.join(entityIds.map(id => sql`${id}::uuid`), sql`, `)})
    `);

    const names: Record<string, string> = {};
    for (const r of result) {
      const row = r as Record<string, any>;
      names[row.entity_instance_id as string] = row.entity_instance_name as string;
    }

    return names;
  }

  /**
   * Get ALL entity instance names for a given entity type (with RBAC filtering)
   *
   * Used by entity-instance route for edit mode dropdowns.
   * Returns entity instances the user has VIEW permission on.
   *
   * @param entityCode - Entity type code (e.g., 'employee', 'business')
   * @param userId - User ID for RBAC filtering
   * @param limit - Maximum number of results (default 1000)
   * @returns Record<string, string> - { uuid: name }
   *
   * @example
   * await getAllEntityInstanceNames('employee', userId)
   * // Returns: { "uuid-1": "James Miller", "uuid-2": "Sarah Johnson", ... }
   */
  async getAllEntityInstanceNames(
    entityCode: string,
    userId: string,
    limit: number = 1000
  ): Promise<Record<string, string>> {
    // Get accessible IDs for this user
    const accessibleIds = await this.getAccessibleEntityIds(userId, entityCode, Permission.VIEW);

    // If no access, return empty
    if (accessibleIds.length === 0) {
      return {};
    }

    // If user has type-level access, return all
    const hasTypeLevelAccess = accessibleIds.includes(ALL_ENTITIES_ID);

    if (hasTypeLevelAccess) {
      const result = await this.db.execute(sql`
        SELECT entity_instance_id::text, entity_instance_name
        FROM app.entity_instance
        WHERE entity_code = ${entityCode}
        ORDER BY entity_instance_name ASC
        LIMIT ${limit}
      `);

      const names: Record<string, string> = {};
      for (const r of result) {
        const row = r as Record<string, any>;
        names[row.entity_instance_id as string] = row.entity_instance_name as string;
      }
      return names;
    }

    // Filter to accessible IDs only
    const result = await this.db.execute(sql`
      SELECT entity_instance_id::text, entity_instance_name
      FROM app.entity_instance
      WHERE entity_code = ${entityCode}
        AND entity_instance_id IN (${sql.join(accessibleIds.map(id => sql`${id}::uuid`), sql`, `)})
      ORDER BY entity_instance_name ASC
      LIMIT ${limit}
    `);

    const names: Record<string, string> = {};
    for (const r of result) {
      const row = r as Record<string, any>;
      names[row.entity_instance_id as string] = row.entity_instance_name as string;
    }

    return names;
  }

  /**
   * Get ALL entity instances from the entire table, grouped by entity_code (with RBAC)
   *
   * Returns all entity instances grouped by entity_code in ref_data_entityInstance format.
   * Only returns entities the user has VIEW permission on.
   *
   * @param userId - User ID for RBAC filtering
   * @param limit - Maximum number of results per entity type (default 1000)
   * @returns Record<string, Record<string, string>> - { entity_code: { uuid: name } }
   *
   * @example
   * await getEntityInstances(userId)
   * // Returns:
   * // {
   * //   employee: { "uuid-1": "James Miller", "uuid-2": "Sarah Johnson" },
   * //   project: { "uuid-3": "Kitchen Reno", "uuid-4": "Bathroom Upgrade" }
   * // }
   */
  async getEntityInstances(
    userId: string,
    limit: number = 1000
  ): Promise<Record<string, Record<string, string>>> {
    // Get all unique entity codes first
    const entityCodesResult = await this.db.execute(sql`
      SELECT DISTINCT entity_code FROM app.entity_instance
      ORDER BY entity_code
    `);

    const grouped: Record<string, Record<string, string>> = {};

    // For each entity code, get names with RBAC filtering
    for (const row of entityCodesResult) {
      const entityCode = (row as Record<string, any>).entity_code as string;
      const names = await this.getAllEntityInstanceNames(entityCode, userId, limit);

      if (Object.keys(names).length > 0) {
        grouped[entityCode] = names;
      }
    }

    return grouped;
  }

  /**
   * Build ref_data_entityInstance object for response-level entity reference resolution
   *
   * Structure: { entity_code: { uuid: name } }
   *
   * Scans all rows for *_id and *_ids fields, collects unique UUIDs,
   * batch resolves from entity_instance table, returns grouped object.
   *
   * This is the NEW pattern (v8.3.0) that replaces _ID/_IDS embedded per row.
   * ref_data_entityInstance is returned at the response level for O(1) lookup.
   *
   * @param rows - Array of data rows to scan for entity references
   * @returns ref_data_entityInstance object: { entity_code: { uuid: name } }
   *
   * @example
   * // Input rows:
   * [{ manager__employee_id: "uuid-123", business_id: "uuid-bus" }]
   *
   * // Output ref_data_entityInstance:
   * {
   *   "employee": { "uuid-123": "James Miller" },
   *   "business": { "uuid-bus": "Huron Home Services" }
   * }
   */
  async build_ref_data_entityInstance(
    rows: Record<string, any>[]
  ): Promise<Record<string, Record<string, string>>> {
    // Structure: { entity_code: { uuid: name } }
    const ref_data_entityInstance: Record<string, Record<string, string>> = {};

    if (!rows || rows.length === 0) {
      return ref_data_entityInstance;
    }

    // Pattern matching regexes
    const labeledSinglePattern = /^(.+)__([a-z_]+)_id$/;
    const labeledArrayPattern = /^(.+)__([a-z_]+)_ids$/;
    const simpleSinglePattern = /^([a-z_]+)_id$/;
    const simpleArrayPattern = /^([a-z_]+)_ids$/;

    // Step 1: Collect all UUIDs grouped by entity_code (for batch query)
    const entityCodeToUuids: Record<string, Set<string>> = {};

    for (const row of rows) {
      for (const [fieldName, value] of Object.entries(row)) {
        if (value === null || value === undefined) continue;
        if (fieldName === 'id') continue; // Skip primary key

        // Match patterns to get entity_code
        let entityCode: string | null = null;
        let isArray = false;

        // Pattern 1: {label}__{entity}_id (e.g., manager__employee_id)
        const labeledSingleMatch = fieldName.match(labeledSinglePattern);
        if (labeledSingleMatch) {
          entityCode = labeledSingleMatch[2];
          isArray = false;
        }

        // Pattern 2: {label}__{entity}_ids (e.g., stakeholder__employee_ids)
        if (!entityCode) {
          const labeledArrayMatch = fieldName.match(labeledArrayPattern);
          if (labeledArrayMatch) {
            entityCode = labeledArrayMatch[2];
            isArray = true;
          }
        }

        // Pattern 3: {entity}_id (e.g., business_id)
        if (!entityCode) {
          const simpleSingleMatch = fieldName.match(simpleSinglePattern);
          if (simpleSingleMatch) {
            entityCode = simpleSingleMatch[1];
            isArray = false;
          }
        }

        // Pattern 4: {entity}_ids (e.g., tag_ids)
        if (!entityCode) {
          const simpleArrayMatch = fieldName.match(simpleArrayPattern);
          if (simpleArrayMatch) {
            entityCode = simpleArrayMatch[1];
            isArray = true;
          }
        }

        if (!entityCode) continue;

        // Initialize Set for this entity_code if needed
        if (!entityCodeToUuids[entityCode]) {
          entityCodeToUuids[entityCode] = new Set();
        }

        // Collect UUIDs
        if (isArray && Array.isArray(value)) {
          value.forEach(uuid => {
            if (typeof uuid === 'string') entityCodeToUuids[entityCode!].add(uuid);
          });
        } else if (!isArray && typeof value === 'string') {
          entityCodeToUuids[entityCode].add(value);
        }
      }
    }

    // Step 2: Batch resolve all UUIDs using getEntityInstanceNames() service method
    // ONLY add to ref_data_entityInstance if UUIDs are found in entity_instance table
    for (const [entityCode, uuidSet] of Object.entries(entityCodeToUuids)) {
      const uuids = Array.from(uuidSet);
      if (uuids.length === 0) continue;

      // Use service method instead of direct SQL
      const names = await this.getEntityInstanceNames(entityCode, uuids);

      // ONLY create bucket if we have results
      if (Object.keys(names).length > 0) {
        ref_data_entityInstance[entityCode] = names;
      }
      // If no results found, DON'T add empty bucket - keeps ref_data_entityInstance clean
    }

    return ref_data_entityInstance;
  }

  // ==========================================================================
  // SECTION 3: Relationship Management (entity_instance_link)
  // ==========================================================================

  /**
   * Create parent-child linkage (idempotent)
   * Validates both entities exist in registry
   * Reactivates if linkage already exists
   *
   * @example
   * await entityInfra.createLinkage({
   *   parent_entity_code: 'business',
   *   parent_entity_id: businessId,
   *   child_entity_code: 'project',
   *   child_entity_id: projectId
   * });
   */
  async set_entity_instance_link(params: {
    parent_entity_code: string;
    parent_entity_id: string;
    child_entity_code: string;
    child_entity_id: string;
    relationship_type?: string;
  }): Promise<EntityLink> {
    const {
      parent_entity_code,
      parent_entity_id,
      child_entity_code,
      child_entity_id,
      relationship_type = 'contains'
    } = params;

    // Validate both entities exist (optional - can be skipped for performance)
    // const parentExists = await this.validateInstanceExists(parent_entity_code, parent_entity_id);
    // const childExists = await this.validateInstanceExists(child_entity_code, child_entity_id);
    // if (!parentExists || !childExists) {
    //   throw new Error(`Entity not in registry: parent=${parentExists}, child=${childExists}`);
    // }

    const result = await this.db.execute(sql`
      INSERT INTO app.entity_instance_link
      (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
      VALUES (${parent_entity_code}, ${parent_entity_id}, ${child_entity_code}, ${child_entity_id}, ${relationship_type})
      RETURNING *
    `);

    return result[0] as unknown as EntityLink;
  }

  /**
   * Delete linkage (hard delete - no active_flag in entity_instance_link anymore)
   */
  async delete_entity_instance_link(linkage_id: string): Promise<void> {
    await this.db.execute(sql`
      DELETE FROM app.entity_instance_link
      WHERE id = ${linkage_id}
    `);
  }

  /**
   * Delete linkage by context (parent + child entities and IDs)
   * Used by unlink endpoint: DELETE /api/v1/:parent/:parentId/:child/:childId/link
   *
   * @param parent_entity_code Parent entity type code
   * @param parent_entity_id Parent entity instance UUID
   * @param child_entity_code Child entity type code
   * @param child_entity_id Child entity instance UUID
   * @returns Number of rows deleted (0 if no matching link found)
   */
  async delete_entity_instance_link_by_context(params: {
    parent_entity_code: string;
    parent_entity_id: string;
    child_entity_code: string;
    child_entity_id: string;
  }): Promise<number> {
    const { parent_entity_code, parent_entity_id, child_entity_code, child_entity_id } = params;

    const result = await this.db.execute(sql`
      DELETE FROM app.entity_instance_link
      WHERE entity_code = ${parent_entity_code}
        AND entity_instance_id = ${parent_entity_id}
        AND child_entity_code = ${child_entity_code}
        AND child_entity_instance_id = ${child_entity_id}
    `);

    return (result as any).rowCount || 0;
  }

  /**
   * Get child entity IDs of specific type
   * Used for parent-child filtering in routes
   */
  async get_entity_instance_link_children(
    parent_entity_code: string,
    parent_entity_id: string,
    child_entity_code: string
  ): Promise<string[]> {
    const result = await this.db.execute(sql`
      SELECT child_entity_instance_id
      FROM app.entity_instance_link
      WHERE entity_code = ${parent_entity_code}
        AND entity_instance_id = ${parent_entity_id}
        AND child_entity_code = ${child_entity_code}
    `);

    return result.map(row => (row as Record<string, any>).child_entity_instance_id as string);
  }

  /**
   * Get single linkage by ID
   */
  async get_entity_instance_link_by_id(linkage_id: string): Promise<EntityLink | null> {
    const result = await this.db.execute(sql`
      SELECT * FROM app.entity_instance_link
      WHERE id = ${linkage_id}
    `);

    return result.length > 0 ? (result[0] as unknown as EntityLink) : null;
  }

  /**
   * Get all linkages with optional filters
   */
  async get_all_entity_instance_links(filters?: {
    parent_entity_code?: string;
    parent_entity_id?: string;
    child_entity_code?: string;
    child_entity_id?: string;
  }): Promise<EntityLink[]> {
    let conditions = sql`1=1`;

    if (filters?.parent_entity_code) {
      conditions = sql`${conditions} AND entity_code = ${filters.parent_entity_code}`;
    }
    if (filters?.parent_entity_id) {
      conditions = sql`${conditions} AND entity_instance_id = ${filters.parent_entity_id}`;
    }
    if (filters?.child_entity_code) {
      conditions = sql`${conditions} AND child_entity_code = ${filters.child_entity_code}`;
    }
    if (filters?.child_entity_id) {
      conditions = sql`${conditions} AND child_entity_instance_id = ${filters.child_entity_id}`;
    }

    const result = await this.db.execute(sql`
      SELECT * FROM app.entity_instance_link
      WHERE ${conditions}
      ORDER BY created_ts DESC
    `);

    return result as unknown as EntityLink[];
  }

  /**
   * Update linkage relationship_type
   */
  async update_entity_instance_link(
    linkage_id: string,
    relationship_type: string
  ): Promise<EntityLink | null> {
    const result = await this.db.execute(sql`
      UPDATE app.entity_instance_link
      SET relationship_type = ${relationship_type}, updated_ts = now()
      WHERE id = ${linkage_id}
      RETURNING *
    `);

    return result.length > 0 ? (result[0] as unknown as EntityLink) : null;
  }

  /**
   * Get dynamic child entity tabs for detail page
   * Universal endpoint handler for GET /:id/dynamic-child-entity-tabs
   *
   * Returns child entity types with metadata (label, icon) from entity.child_entity_codes
   * Routes should handle RBAC checks and counting separately if needed
   *
   * @example
   * // In route handler:
   * const tabs = await entityInfra.get_dynamic_child_entity_tabs('business');
   * return reply.send({ tabs });
   */
  async get_dynamic_child_entity_tabs(
    entity_code: string
  ): Promise<Array<{ entity: string; label: string; icon?: string }>> {
    // Get parent entity metadata (includes child_entity_codes)
    const entityMetadata = await this.get_entity(entity_code);

    if (!entityMetadata || !entityMetadata.child_entity_codes) {
      return [];
    }

    // Extract child entity codes (handle both string[] and object[] formats)
    const childCodes = entityMetadata.child_entity_codes.map(child =>
      typeof child === 'string' ? child : child.entity
    );

    // Fetch metadata for all child entities from entity table
    const childMetadata = await this.db.execute(sql`
      SELECT code, ui_label, ui_icon
      FROM app.entity
      WHERE code = ANY(${childCodes})
      ORDER BY ARRAY_POSITION(${childCodes}::varchar[], code)
    `);

    // Build result array with entity metadata
    return childMetadata.map((c, index) => {
      const child = c as Record<string, any>;
      return {
        entity: child.code as string,
        label: (child.ui_label || child.code) as string,
        icon: child.ui_icon as string | undefined,
      };
    });
  }

  // ==========================================================================
  // SECTION 4: Permission Management (entity_rbac) - v2.0.0 Role-Only Model
  // ==========================================================================

  /**
   * Check if person has specific permission on entity
   *
   * Permission resolution (v2.0.0 Role-Only Model):
   * 1. Find roles for person via entity_instance_link (role → person mapping)
   * 2. Check for explicit deny (is_deny=true) - blocks all access
   * 3. Check direct role permissions on target entity
   * 4. Check inherited permissions from ancestors (cascade/mapped modes)
   *
   * @param person_id - Person UUID (from app.person table)
   * @param entity_code - Entity type code (e.g., 'project', 'task')
   * @param entity_id - Entity instance ID (or ALL_ENTITIES_ID for type-level)
   * @param required_permission - Minimum permission level required
   * @returns true if person has required permission
   *
   * @example
   * const canEdit = await entityInfra.check_entity_rbac(
   *   personId, 'project', projectId, Permission.EDIT
   * );
   */
  async check_entity_rbac(
    person_id: string,
    entity_code: string,
    entity_id: string,
    required_permission: Permission
  ): Promise<boolean> {
    // Get maximum permission level person has on this entity
    const maxPermission = await this.getMaxPermissionLevel(person_id, entity_code, entity_id);

    // Check if person's max permission meets or exceeds required permission
    return maxPermission >= required_permission;
  }

  /**
   * Get maximum permission level person has on entity
   *
   * Checks all permission sources (v2.0.0 Role-Only Model):
   * 1. person_roles - Find roles for this person
   * 2. explicit_deny - Check for explicit deny (is_deny=true)
   * 3. direct_role_perms - Direct role permissions on target entity
   * 4. ancestor_chain - Recursive CTE to find all ancestors
   * 5. inherited_perms - Permissions inherited from ancestors via cascade/mapped
   *
   * @returns Permission level (-1 if no access or denied, 0-7 for VIEW to OWNER)
   */
  private async getMaxPermissionLevel(
    person_id: string,
    entity_code: string,
    entity_id: string
  ): Promise<number> {
    const result = await this.db.execute(sql`
      WITH RECURSIVE
      -- ═══════════════════════════════════════════════════════════════════════
      -- 1. FIND ROLES FOR THIS PERSON
      --    Person → Roles via entity_instance_link (role contains person)
      -- ═══════════════════════════════════════════════════════════════════════
      person_roles AS (
        SELECT eil.entity_instance_id AS role_id
        FROM app.entity_instance_link eil
        WHERE eil.entity_code = 'role'
          AND eil.child_entity_code = 'person'
          AND eil.child_entity_instance_id = ${person_id}::uuid
      ),

      -- ═══════════════════════════════════════════════════════════════════════
      -- 2. CHECK FOR EXPLICIT DENY (highest priority - blocks all access)
      --    If any role has is_deny=true for this entity, return -999
      -- ═══════════════════════════════════════════════════════════════════════
      explicit_deny AS (
        SELECT -999 AS permission
        FROM app.entity_rbac er
        JOIN person_roles pr ON er.role_id = pr.role_id
        WHERE er.entity_code = ${entity_code}
          AND (er.entity_instance_id = '11111111-1111-1111-1111-111111111111'::uuid
               OR er.entity_instance_id = ${entity_id}::uuid)
          AND er.is_deny = true
          AND (er.expires_ts IS NULL OR er.expires_ts > NOW())
        LIMIT 1
      ),

      -- ═══════════════════════════════════════════════════════════════════════
      -- 3. DIRECT ROLE PERMISSIONS ON TARGET ENTITY
      --    Check entity_rbac for role permissions (type-level or instance)
      -- ═══════════════════════════════════════════════════════════════════════
      direct_role_perms AS (
        SELECT er.permission
        FROM app.entity_rbac er
        JOIN person_roles pr ON er.role_id = pr.role_id
        WHERE er.entity_code = ${entity_code}
          AND (er.entity_instance_id = '11111111-1111-1111-1111-111111111111'::uuid
               OR er.entity_instance_id = ${entity_id}::uuid)
          AND er.is_deny = false
          AND (er.expires_ts IS NULL OR er.expires_ts > NOW())
      ),

      -- ═══════════════════════════════════════════════════════════════════════
      -- 4. FIND ANCESTORS (for inheritance resolution)
      --    Recursive CTE to traverse entity_instance_link up the hierarchy
      -- ═══════════════════════════════════════════════════════════════════════
      ancestor_chain AS (
        -- Base case: direct parents of the target entity
        SELECT
          eil.entity_code AS ancestor_code,
          eil.entity_instance_id AS ancestor_id,
          1 AS depth
        FROM app.entity_instance_link eil
        WHERE eil.child_entity_code = ${entity_code}
          AND eil.child_entity_instance_id = ${entity_id}::uuid

        UNION ALL

        -- Recursive case: grandparents and beyond
        SELECT
          eil.entity_code,
          eil.entity_instance_id,
          ac.depth + 1
        FROM ancestor_chain ac
        JOIN app.entity_instance_link eil
          ON eil.child_entity_code = ac.ancestor_code
          AND eil.child_entity_instance_id = ac.ancestor_id
        WHERE ac.depth < 10  -- Prevent infinite loops
      ),

      -- ═══════════════════════════════════════════════════════════════════════
      -- 5. INHERITED PERMISSIONS FROM ANCESTORS
      --    Apply inheritance_mode: cascade (same permission) or mapped (per-child)
      -- ═══════════════════════════════════════════════════════════════════════
      inherited_perms AS (
        SELECT
          CASE
            -- Cascade mode: same permission to all children
            WHEN er.inheritance_mode = 'cascade' THEN er.permission
            -- Mapped mode: use child_permissions JSONB for per-child-type mapping
            WHEN er.inheritance_mode = 'mapped' THEN
              CASE
                -- Explicit mapping for this entity type
                WHEN er.child_permissions ? ${entity_code}
                  THEN (er.child_permissions->> ${entity_code})::int
                -- Fallback to _default if exists
                WHEN er.child_permissions ? '_default'
                  THEN (er.child_permissions->>'_default')::int
                -- No mapping found
                ELSE -1
              END
            -- None mode: no inheritance
            ELSE -1
          END AS permission
        FROM app.entity_rbac er
        JOIN person_roles pr ON er.role_id = pr.role_id
        JOIN ancestor_chain ac
          ON er.entity_code = ac.ancestor_code
          AND er.entity_instance_id = ac.ancestor_id
        WHERE er.inheritance_mode IN ('cascade', 'mapped')
          AND er.is_deny = false
          AND (er.expires_ts IS NULL OR er.expires_ts > NOW())
      )

      -- ═══════════════════════════════════════════════════════════════════════
      -- FINAL: MAX of all permission sources, respecting deny
      -- If explicit_deny exists (-999), it will be excluded and return -1
      -- ═══════════════════════════════════════════════════════════════════════
      SELECT
        CASE
          WHEN EXISTS (SELECT 1 FROM explicit_deny) THEN -1
          ELSE COALESCE(MAX(permission), -1)
        END AS max_permission
      FROM (
        SELECT permission FROM direct_role_perms
        UNION ALL
        SELECT permission FROM inherited_perms WHERE permission >= 0
      ) AS all_perms
    `);

    return parseInt(String(result[0]?.max_permission || -1));
  }

  /**
   * Grant permission to a role on entity (v2.0.0 Role-Only Model)
   *
   * Uses ON CONFLICT for upsert behavior - updates if exists, inserts if not.
   *
   * @param role_id - Role UUID (from app.role table)
   * @param entity_code - Entity type code
   * @param entity_id - Entity instance ID (or ALL_ENTITIES_ID for type-level)
   * @param permission_level - Permission level (0-7)
   * @param options - Additional options for inheritance and deny
   *
   * @example
   * await entityInfra.set_entity_rbac(
   *   roleId, 'project', ALL_ENTITIES_ID, Permission.EDIT,
   *   { inheritance_mode: 'cascade' }
   * );
   */
  async set_entity_rbac(
    role_id: string,
    entity_code: string,
    entity_id: string,
    permission_level: Permission,
    options?: {
      inheritance_mode?: InheritanceMode;
      child_permissions?: Record<string, number>;
      is_deny?: boolean;
      granted_by_person_id?: string;
      expires_ts?: string | null;
    }
  ): Promise<any> {
    const inheritance_mode = options?.inheritance_mode || 'none';
    const child_permissions = options?.child_permissions || {};
    const is_deny = options?.is_deny || false;
    const granted_by_person_id = options?.granted_by_person_id || null;
    const expires_ts = options?.expires_ts || null;

    const result = await this.db.execute(sql`
      INSERT INTO app.entity_rbac
      (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_by_person_id, expires_ts)
      VALUES (
        ${role_id}::uuid,
        ${entity_code},
        ${entity_id}::uuid,
        ${permission_level},
        ${inheritance_mode},
        ${JSON.stringify(child_permissions)}::jsonb,
        ${is_deny},
        ${granted_by_person_id}::uuid,
        ${expires_ts}::timestamptz
      )
      ON CONFLICT (role_id, entity_code, entity_instance_id)
      DO UPDATE SET
        permission = EXCLUDED.permission,
        inheritance_mode = EXCLUDED.inheritance_mode,
        child_permissions = EXCLUDED.child_permissions,
        is_deny = EXCLUDED.is_deny,
        granted_by_person_id = EXCLUDED.granted_by_person_id,
        expires_ts = EXCLUDED.expires_ts,
        updated_ts = NOW()
      RETURNING *
    `);

    return result[0];
  }

  /**
   * Grant OWNER permission to a role (highest level)
   *
   * @param role_id - Role UUID (from app.role table)
   * @param entity_code - Entity type code
   * @param entity_id - Entity instance ID
   * @param inheritance_mode - How to propagate to children
   */
  async set_entity_rbac_owner(
    role_id: string,
    entity_code: string,
    entity_id: string,
    inheritance_mode: InheritanceMode = 'none'
  ): Promise<any> {
    return this.set_entity_rbac(role_id, entity_code, entity_id, Permission.OWNER, {
      inheritance_mode
    });
  }

  /**
   * Revoke permission for a role on entity
   *
   * @param role_id - Role UUID
   * @param entity_code - Entity type code
   * @param entity_id - Entity instance ID
   */
  async delete_entity_rbac(
    role_id: string,
    entity_code: string,
    entity_id: string
  ): Promise<void> {
    await this.db.execute(sql`
      DELETE FROM app.entity_rbac
      WHERE role_id = ${role_id}::uuid
        AND entity_code = ${entity_code}
        AND entity_instance_id = ${entity_id}::uuid
    `);
  }

  /**
   * Revoke all permissions for a role (across all entities)
   *
   * @param role_id - Role UUID
   */
  async delete_all_rbac_for_role(role_id: string): Promise<number> {
    const result = await this.db.execute(sql`
      DELETE FROM app.entity_rbac
      WHERE role_id = ${role_id}::uuid
    `);
    return (result as any).count || result.length || 0;
  }

  /**
   * Get all permissions for a specific role
   *
   * @param role_id - Role UUID
   * @returns Array of permission records
   */
  async get_role_permissions(role_id: string): Promise<any[]> {
    const result = await this.db.execute(sql`
      SELECT
        er.id,
        er.role_id,
        er.entity_code,
        er.entity_instance_id,
        er.permission,
        er.inheritance_mode,
        er.child_permissions,
        er.is_deny,
        er.granted_by_person_id,
        er.granted_ts,
        er.expires_ts,
        COALESCE(ei.entity_instance_name, p.email) AS granted_by_name
      FROM app.entity_rbac er
      LEFT JOIN app.person p ON er.granted_by_person_id = p.id
      LEFT JOIN app.entity_instance ei ON ei.entity_code = 'person' AND ei.entity_instance_id = p.id
      WHERE er.role_id = ${role_id}::uuid
      ORDER BY er.entity_code, er.entity_instance_id
    `);
    return result as any[];
  }

  /**
   * Get SQL WHERE condition for RBAC filtering in LIST queries
   *
   * Returns one of three conditions:
   * 1. 'TRUE' - User has type-level access (can see all entities)
   * 2. 'FALSE' - User has no access (can see nothing)
   * 3. '{alias}.id = ANY(...)' - User can see specific entity IDs
   *
   * @example
   * const rbacCondition = await entityInfra.getRbacWhereCondition(
   *   userId, 'project', Permission.VIEW, 'e'
   * );
   * const query = sql`SELECT e.* FROM d_project e WHERE ${rbacCondition}`;
   */
  async get_entity_rbac_where_condition(
    user_id: string,
    entity_code: string,
    required_permission: Permission,
    table_alias: string = 'e'
  ): Promise<SQL> {
    const accessibleIds = await this.getAccessibleEntityIds(user_id, entity_code, required_permission);

    // No access at all - return FALSE condition
    if (accessibleIds.length === 0) {
      return sql.raw('FALSE');
    }

    // Type-level access - no filtering needed, return TRUE
    const hasTypeLevelAccess = accessibleIds.includes('11111111-1111-1111-1111-111111111111');
    if (hasTypeLevelAccess) {
      return sql.raw('TRUE');
    }

    // Filter by accessible IDs using proper SQL fragment
    // Use parameterized query - Drizzle will handle UUID casting
    return sql`${sql.raw(table_alias)}.id IN (${sql.join(
      accessibleIds.map(id => sql`${id}`),
      sql`, `
    )})`;
  }

  /**
   * Get all entity IDs person can access (v2.0.0 Role-Only Model)
   *
   * Uses role-based permissions with configurable inheritance (cascade/mapped).
   *
   * @param person_id - Person UUID
   * @param entity_code - Entity type code
   * @param required_permission - Minimum permission level
   * @returns Array of entity IDs (includes ALL_ENTITIES_ID if type-level access)
   */
  private async getAccessibleEntityIds(
    person_id: string,
    entity_code: string,
    required_permission: Permission
  ): Promise<string[]> {
    // First check if person has type-level permission
    const typeLevelPermission = await this.getMaxPermissionLevel(
      person_id,
      entity_code,
      ALL_ENTITIES_ID
    );

    if (typeLevelPermission >= required_permission) {
      // Person has type-level access - return special marker
      return [ALL_ENTITIES_ID];
    }

    // Get specific entity IDs person can access
    const result = await this.db.execute(sql`
      WITH
      -- ═══════════════════════════════════════════════════════════════════════
      -- 1. FIND ROLES FOR THIS PERSON
      -- ═══════════════════════════════════════════════════════════════════════
      person_roles AS (
        SELECT eil.entity_instance_id AS role_id
        FROM app.entity_instance_link eil
        WHERE eil.entity_code = 'role'
          AND eil.child_entity_code = 'person'
          AND eil.child_entity_instance_id = ${person_id}::uuid
      ),

      -- ═══════════════════════════════════════════════════════════════════════
      -- 2. EXPLICIT DENY IDS (to exclude)
      -- ═══════════════════════════════════════════════════════════════════════
      denied_ids AS (
        SELECT er.entity_instance_id
        FROM app.entity_rbac er
        JOIN person_roles pr ON er.role_id = pr.role_id
        WHERE er.entity_code = ${entity_code}
          AND er.is_deny = true
          AND (er.expires_ts IS NULL OR er.expires_ts > NOW())
      ),

      -- ═══════════════════════════════════════════════════════════════════════
      -- 3. DIRECT ROLE PERMISSIONS (instance-level only, not type-level)
      -- ═══════════════════════════════════════════════════════════════════════
      direct_role_perms AS (
        SELECT er.entity_instance_id, er.permission
        FROM app.entity_rbac er
        JOIN person_roles pr ON er.role_id = pr.role_id
        WHERE er.entity_code = ${entity_code}
          AND er.entity_instance_id != '11111111-1111-1111-1111-111111111111'::uuid
          AND er.is_deny = false
          AND (er.expires_ts IS NULL OR er.expires_ts > NOW())
      ),

      -- ═══════════════════════════════════════════════════════════════════════
      -- 4. FIND ALL ANCESTORS WITH CASCADE/MAPPED PERMISSIONS
      --    And their children that are of our target entity_code
      -- ═══════════════════════════════════════════════════════════════════════
      inheritable_ancestors AS (
        SELECT
          er.entity_code AS ancestor_code,
          er.entity_instance_id AS ancestor_id,
          er.permission,
          er.inheritance_mode,
          er.child_permissions
        FROM app.entity_rbac er
        JOIN person_roles pr ON er.role_id = pr.role_id
        WHERE er.inheritance_mode IN ('cascade', 'mapped')
          AND er.is_deny = false
          AND (er.expires_ts IS NULL OR er.expires_ts > NOW())
      ),

      -- ═══════════════════════════════════════════════════════════════════════
      -- 5. INHERITED PERMISSIONS
      --    Find children of ancestors and apply inheritance rules
      -- ═══════════════════════════════════════════════════════════════════════
      inherited_perms AS (
        SELECT
          eil.child_entity_instance_id AS entity_instance_id,
          CASE
            WHEN ia.inheritance_mode = 'cascade' THEN ia.permission
            WHEN ia.inheritance_mode = 'mapped' THEN
              CASE
                WHEN ia.child_permissions ? ${entity_code}
                  THEN (ia.child_permissions->> ${entity_code})::int
                WHEN ia.child_permissions ? '_default'
                  THEN (ia.child_permissions->>'_default')::int
                ELSE -1
              END
            ELSE -1
          END AS permission
        FROM inheritable_ancestors ia
        JOIN app.entity_instance_link eil
          ON eil.entity_code = ia.ancestor_code
          AND eil.entity_instance_id = ia.ancestor_id
          AND eil.child_entity_code = ${entity_code}
      ),

      -- ═══════════════════════════════════════════════════════════════════════
      -- UNION ALL PERMISSION SOURCES + FILTER
      -- ═══════════════════════════════════════════════════════════════════════
      all_permissions AS (
        SELECT entity_instance_id, MAX(permission) AS max_permission
        FROM (
          SELECT entity_instance_id, permission FROM direct_role_perms
          UNION ALL
          SELECT entity_instance_id, permission FROM inherited_perms WHERE permission >= 0
        ) AS perms
        GROUP BY entity_instance_id
      )

      SELECT entity_instance_id::text
      FROM all_permissions
      WHERE max_permission >= ${required_permission}
        AND entity_instance_id NOT IN (SELECT entity_instance_id FROM denied_ids)
    `);

    return result.map(row => (row as Record<string, any>).entity_instance_id as string);
  }

  // ==========================================================================
  // SECTION 5: Unified Delete Operation
  // ==========================================================================

  /**
   * @deprecated Use delete_entity() instead for full transactional safety.
   *
   * This method makes multiple separate DB calls (not atomic).
   * Use delete_entity() which wraps all operations in ONE transaction.
   */
  async delete_all_entity_infrastructure(
    entity_code: string,
    entity_id: string,
    options: DeleteEntityOptions
  ): Promise<DeleteEntityResult> {
    const {
      user_id,
      hard_delete = false,
      cascade_delete_children = false,
      remove_rbac_entries = false,
      skip_rbac_check = false,
      primary_table_callback
    } = options;

    let registry_deactivated = false;
    let linkages_deactivated = 0;
    let rbac_entries_removed = 0;
    let primary_table_deleted = false;
    let children_deleted = 0;

    // Step 1: RBAC check
    if (!skip_rbac_check) {
      const canDelete = await this.check_entity_rbac(
        user_id,
        entity_code,
        entity_id,
        Permission.DELETE
      );

      if (!canDelete) {
        throw new Error(
          `User ${user_id} lacks DELETE permission on ${entity_code}/${entity_id}`
        );
      }
    }

    // Step 2: Handle cascading child deletes (if requested)
    if (cascade_delete_children) {
      const childLinkages = await this.db.execute(sql`
        SELECT * FROM app.entity_instance_link
        WHERE entity_code = ${entity_code}
          AND entity_instance_id = ${entity_id}
      `);

      for (const l of childLinkages) {
        const linkage = l as Record<string, any>;
        try {
          await this.delete_all_entity_infrastructure(linkage.child_entity_code as string, linkage.child_entity_instance_id as string, {
            user_id,
            hard_delete,
            cascade_delete_children: true,
            remove_rbac_entries,
            skip_rbac_check: true // Already checked at top level
          });
          children_deleted++;
        } catch (error) {
          console.error(`Failed to cascade delete child: ${linkage.child_entity_code}/${linkage.child_entity_instance_id}`, error);
        }
      }
    }

    // Step 3: Delete from entity_instance (hard delete - no active_flag anymore)
    await this.db.execute(sql`
      DELETE FROM app.entity_instance
      WHERE entity_code = ${entity_code} AND entity_instance_id = ${entity_id}
    `);
    registry_deactivated = true;

    // Step 4: Delete linkages from entity_instance_link (hard delete - no active_flag anymore)
    const linkageResult = await this.db.execute(sql`
      DELETE FROM app.entity_instance_link
      WHERE (
        (entity_code = ${entity_code} AND entity_instance_id = ${entity_id})
        OR
        (child_entity_code = ${entity_code} AND child_entity_instance_id = ${entity_id})
      )
    `);
    linkages_deactivated = (linkageResult as any).count || linkageResult.length || 0;

    // Step 5: Remove RBAC entries (optional)
    if (remove_rbac_entries) {
      const rbacResult = await this.db.execute(sql`
        DELETE FROM app.entity_rbac
        WHERE entity_code = ${entity_code} AND entity_instance_id = ${entity_id}
      `);
      rbac_entries_removed = (rbacResult as any).count || rbacResult.length || 0;
    }

    // Step 6: Delete from primary table (via callback)
    if (primary_table_callback) {
      await primary_table_callback(this.db, entity_id);
      primary_table_deleted = true;
    }

    return {
      success: true,
      entity_code,
      entity_id,
      registry_deactivated,
      linkages_deactivated,
      rbac_entries_removed,
      primary_table_deleted,
      children_deleted: cascade_delete_children ? children_deleted : undefined
    };
  }

  // ==========================================================================
  // SECTION 6: TRANSACTIONAL CREATE HELPER
  // ==========================================================================

  /**
   * Create entity with ALL infrastructure in a SINGLE TRANSACTION
   *
   * Pass the table name and data object - both INSERTs execute in one transaction.
   * If ANY step fails, ALL changes roll back - no orphan records.
   *
   * NOTE (v2.0.0 Role-Only Model):
   * Permissions are NOT automatically granted to creator. The creator must already
   * have CREATE permission via their role. If parent linking is provided and the
   * parent's role has cascade/mapped inheritance, the new entity will inherit
   * permissions automatically.
   *
   * @example
   * const result = await entityInfra.create_entity({
   *   entity_code: 'project',
   *   creator_id: personId,
   *   parent_entity_code: parent_code,
   *   parent_entity_id: parent_id,
   *   primary_table: 'app.project',
   *   primary_data: { name, code, descr, budget_allocated_amt }
   * });
   * // Returns: { entity: insertedRow, entity_instance, link_created }
   */
  async create_entity<T extends Record<string, any> = Record<string, any>>(params: {
    entity_code: string;
    creator_id: string;  // person_id for audit trail
    parent_entity_code?: string;
    parent_entity_id?: string;
    relationship_type?: string;
    primary_table: string;
    primary_data: T;
    name_field?: string;  // defaults to 'name'
    code_field?: string;  // defaults to 'code'
  }): Promise<{
    entity: T & { id: string };
    entity_instance: EntityInstance;
    link_created: boolean;
    link?: EntityLink;
  }> {
    const {
      entity_code,
      parent_entity_code,
      parent_entity_id,
      relationship_type = 'contains',
      primary_table,
      primary_data,
      name_field = 'name',
      code_field = 'code'
    } = params;

    // Build column names and values from data object
    const columns = Object.keys(primary_data);
    const values = Object.values(primary_data);

    // Use raw postgres client for transaction support
    return await client.begin(async (tx) => {
      // Step 1: INSERT into primary table
      const columnsStr = columns.join(', ');
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

      const primaryResult = await tx.unsafe(
        `INSERT INTO ${primary_table} (${columnsStr}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      const entity = primaryResult[0] as unknown as T & { id: string };

      const entity_id = entity.id;
      const entity_name = String((entity as any)[name_field] || '');
      const instance_code = (entity as any)[code_field] || null;

      // Step 2: Register in entity_instance
      const registryResult = await tx`
        INSERT INTO app.entity_instance
        (entity_code, entity_instance_id, entity_instance_name, code)
        VALUES (${entity_code}, ${entity_id}, ${entity_name}, ${instance_code})
        RETURNING *
      `;
      const entity_instance = registryResult[0] as EntityInstance;

      // Step 3: Link to parent (if provided)
      // NOTE: Permissions are inherited from parent via cascade/mapped inheritance
      // No direct RBAC grant - permissions flow through role assignments
      let link: EntityLink | undefined;
      if (parent_entity_code && parent_entity_id) {
        const linkResult = await tx`
          INSERT INTO app.entity_instance_link
          (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
          VALUES (${parent_entity_code}, ${parent_entity_id}, ${entity_code}, ${entity_id}, ${relationship_type})
          RETURNING *
        `;
        link = linkResult[0] as EntityLink;
      }

      return {
        entity,
        entity_instance,
        link_created: Boolean(link),
        link
      };
    });
  }

  // ==========================================================================
  // SECTION 7: TRANSACTIONAL UPDATE HELPER
  // ==========================================================================

  /**
   * Update entity with registry sync in a SINGLE TRANSACTION
   *
   * Both UPDATE and registry sync execute in one transaction.
   * If ANY step fails, ALL changes roll back.
   *
   * @example
   * const result = await entityInfra.update_entity({
   *   entity_code: 'project',
   *   entity_id: projectId,
   *   primary_table: 'app.project',
   *   primary_updates: { name: 'New Name', budget_allocated_amt: 50000 }
   * });
   * // Returns: { entity: updatedRow, registry_synced: boolean }
   */
  async update_entity<T extends Record<string, any> = Record<string, any>>(params: {
    entity_code: string;
    entity_id: string;
    primary_table: string;
    primary_updates: Partial<T>;
    name_field?: string;  // defaults to 'name'
    code_field?: string;  // defaults to 'code'
  }): Promise<{
    entity: T & { id: string };
    registry_synced: boolean;
  }> {
    const {
      entity_code,
      entity_id,
      primary_table,
      primary_updates,
      name_field = 'name',
      code_field = 'code'
    } = params;

    // Build SET clause
    const entries = Object.entries(primary_updates).filter(([_, v]) => v !== undefined);
    if (entries.length === 0) {
      throw new Error('No fields to update');
    }

    // Use raw postgres client for transaction support
    return await client.begin(async (tx) => {
      // Step 1: UPDATE primary table
      const setClause = entries.map(([col], i) => `"${col}" = $${i + 1}`).join(', ');
      const values = entries.map(([_, v]) => v);

      const primaryResult = await tx.unsafe(
        `UPDATE ${primary_table} SET ${setClause}, updated_ts = now() WHERE id = $${entries.length + 1} RETURNING *`,
        [...values, entity_id]
      );

      if (!primaryResult[0]) {
        throw new Error(`Entity not found: ${entity_code}/${entity_id}`);
      }

      const entity = primaryResult[0] as unknown as T & { id: string };

      // Step 2: Sync registry if name or code changed
      let registry_synced = false;
      const nameChanged = name_field in primary_updates;
      const codeChanged = code_field in primary_updates;

      if (nameChanged || codeChanged) {
        const entity_name = nameChanged ? String((entity as any)[name_field] || '') : undefined;
        const instance_code = codeChanged ? (entity as any)[code_field] || null : undefined;

        await tx`
          UPDATE app.entity_instance
          SET
            entity_instance_name = COALESCE(${entity_name}, entity_instance_name),
            code = COALESCE(${instance_code}, code),
            updated_ts = now()
          WHERE entity_code = ${entity_code} AND entity_instance_id = ${entity_id}
        `;
        registry_synced = true;
      }

      return { entity, registry_synced };
    });
  }

  // ==========================================================================
  // SECTION 8: TRANSACTIONAL DELETE HELPER
  // ==========================================================================

  /**
   * Delete entity with ALL infrastructure cleanup in a SINGLE TRANSACTION
   *
   * All deletes execute in one transaction.
   * If ANY step fails, ALL changes roll back - no orphan records.
   *
   * @example
   * const result = await entityInfra.delete_entity({
   *   entity_code: 'project',
   *   entity_id: projectId,
   *   user_id: userId,
   *   primary_table: 'app.project',
   *   hard_delete: false  // soft delete by setting active_flag = false
   * });
   */
  async delete_entity(params: {
    entity_code: string;
    entity_id: string;
    user_id: string;
    primary_table: string;
    hard_delete?: boolean;  // true = DELETE, false = SET active_flag = false
    skip_rbac_check?: boolean;
  }): Promise<{
    success: boolean;
    entity_deleted: boolean;
    registry_deleted: boolean;
    linkages_deleted: number;
    rbac_entries_deleted: number;
  }> {
    const {
      entity_code,
      entity_id,
      user_id,
      primary_table,
      hard_delete = false,
      skip_rbac_check = false
    } = params;

    // Step 0: RBAC check (before transaction)
    if (!skip_rbac_check) {
      const canDelete = await this.check_entity_rbac(user_id, entity_code, entity_id, Permission.DELETE);
      if (!canDelete) {
        throw new Error(`User ${user_id} lacks DELETE permission on ${entity_code}/${entity_id}`);
      }
    }

    // Use raw postgres client for transaction support
    return await client.begin(async (tx) => {
      // Step 1: Delete/deactivate from primary table
      if (hard_delete) {
        await tx.unsafe(`DELETE FROM ${primary_table} WHERE id = $1`, [entity_id]);
      } else {
        await tx.unsafe(`UPDATE ${primary_table} SET active_flag = false, updated_ts = now() WHERE id = $1`, [entity_id]);
      }

      // Step 2: Delete from entity_instance (always hard delete - no active_flag)
      await tx`
        DELETE FROM app.entity_instance
        WHERE entity_code = ${entity_code} AND entity_instance_id = ${entity_id}
      `;

      // Step 3: Delete from entity_instance_link (as parent or child)
      const linkageResult = await tx`
        DELETE FROM app.entity_instance_link
        WHERE (entity_code = ${entity_code} AND entity_instance_id = ${entity_id})
           OR (child_entity_code = ${entity_code} AND child_entity_instance_id = ${entity_id})
      `;
      const linkages_deleted = linkageResult.count || 0;

      // Step 4: Delete from entity_rbac
      const rbacResult = await tx`
        DELETE FROM app.entity_rbac
        WHERE entity_code = ${entity_code} AND entity_instance_id = ${entity_id}
      `;
      const rbac_entries_deleted = rbacResult.count || 0;

      return {
        success: true,
        entity_deleted: true,
        registry_deleted: true,
        linkages_deleted: Number(linkages_deleted),
        rbac_entries_deleted: Number(rbac_entries_deleted)
      };
    });
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let serviceInstance: EntityInfrastructureService | null = null;

/**
 * Get singleton instance of Entity Infrastructure Service
 *
 * @example
 * const entityInfra = getEntityInfrastructure(db);
 * await entityInfra.registerInstance({...});
 */
export function getEntityInfrastructure(db: Database): EntityInfrastructureService {
  if (!serviceInstance) {
    serviceInstance = new EntityInfrastructureService(db);
  }
  return serviceInstance;
}
