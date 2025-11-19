/**
 * ============================================================================
 * SCHEMA CACHE - Enhanced Cache with Validation & TTL
 * ============================================================================
 *
 * Centralized schema caching with:
 * - TTL (time-to-live) expiration
 * - Schema validation
 * - Type safety
 * - Cache statistics
 */

import type { EntitySchema } from '../types/table';
import { API_CONFIG } from '../config/api';

interface CacheEntry {
  schema: EntitySchema;
  timestamp: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

/**
 * Enhanced schema cache with validation and TTL
 */
class SchemaCache {
  private cache = new Map<string, CacheEntry>();
  private stats: CacheStats = { hits: 0, misses: 0, size: 0 };
  private readonly TTL = API_CONFIG.SCHEMA_CACHE_TTL;

  /**
   * Get schema from cache
   * Returns null if not found or expired
   */
  get(entityCode: string): EntitySchema | null {
    const cached = this.cache.get(entityCode);

    if (!cached) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    const age = Date.now() - cached.timestamp;
    if (age > this.TTL) {
      this.cache.delete(entityCode);
      this.stats.size = this.cache.size;
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return cached.schema;
  }

  /**
   * Set schema in cache with validation
   */
  set(entityCode: string, schema: EntitySchema): void {
    // Validate schema before caching
    if (!this.isValidSchema(schema)) {
      console.error('[SchemaCache] Invalid schema for entity:', entityCode, schema);
      return;
    }

    this.cache.set(entityCode, {
      schema,
      timestamp: Date.now()
    });

    this.stats.size = this.cache.size;
  }

  /**
   * Check if entity schema exists in cache (not expired)
   */
  has(entityCode: string): boolean {
    return this.get(entityCode) !== null;
  }

  /**
   * Delete specific entity schema from cache
   */
  delete(entityCode: string): boolean {
    const result = this.cache.delete(entityCode);
    this.stats.size = this.cache.size;
    return result;
  }

  /**
   * Clear all cached schemas
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, size: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get cache hit rate (0-1)
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total === 0 ? 0 : this.stats.hits / total;
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    let removed = 0;
    const now = Date.now();

    for (const [entityCode, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.TTL) {
        this.cache.delete(entityCode);
        removed++;
      }
    }

    this.stats.size = this.cache.size;
    return removed;
  }

  /**
   * Validate schema structure
   */
  private isValidSchema(schema: any): schema is EntitySchema {
    if (!schema || typeof schema !== 'object') {
      return false;
    }

    if (typeof schema.entityCode !== 'string' || !schema.entityCode) {
      console.error('[SchemaCache] Invalid entityCode:', schema.entityCode);
      return false;
    }

    if (typeof schema.tableName !== 'string' || !schema.tableName) {
      console.error('[SchemaCache] Invalid tableName:', schema.tableName);
      return false;
    }

    if (!Array.isArray(schema.columns)) {
      console.error('[SchemaCache] Invalid columns (not an array):', schema.columns);
      return false;
    }

    // Validate each column
    for (const col of schema.columns) {
      if (!this.isValidColumn(col)) {
        console.error('[SchemaCache] Invalid column:', col);
        return false;
      }
    }

    return true;
  }

  /**
   * Validate column structure
   */
  private isValidColumn(column: any): boolean {
    return (
      column &&
      typeof column.key === 'string' &&
      typeof column.title === 'string' &&
      typeof column.dataType === 'string' &&
      typeof column.visible === 'boolean' &&
      typeof column.editable === 'boolean' &&
      typeof column.sortable === 'boolean' &&
      typeof column.filterable === 'boolean' &&
      column.format &&
      typeof column.format.type === 'string' &&
      typeof column.editType === 'string'
    );
  }
}

/**
 * Singleton instance
 */
export const schemaCache = new SchemaCache();

// Auto-cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    const removed = schemaCache.cleanup();
    if (removed > 0) {
      console.log(`[SchemaCache] Cleaned up ${removed} expired entries`);
    }
  }, 5 * 60 * 1000);
}
