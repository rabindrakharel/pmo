/**
 * ============================================================================
 * USE ENTITY SCHEMA HOOK - Enhanced with Retry & Cache
 * ============================================================================
 *
 * React hook for fetching entity schema from the API.
 * Features:
 * - Automatic retry with exponential backoff
 * - Enhanced caching with validation and TTL
 * - Type-safe error handling
 * - Manual refresh capability
 *
 * USAGE:
 * ```typescript
 * const { schema, loading, error, refresh } = useEntitySchema('project');
 *
 * if (loading) return <TableSkeleton />;
 * if (error) return <SchemaErrorFallback error={error} entityType="project" onRetry={refresh} />;
 * if (schema) return <Table columns={schema.columns} />;
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import type { EntitySchema } from '../types/table';
import { API_CONFIG, API_ENDPOINTS } from '../config/api';
import { schemaCache } from '../cache/SchemaCache';

/**
 * Fetch with exponential backoff retry
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = API_CONFIG.RETRY_ATTEMPTS
): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Success
      if (response.ok) {
        return response;
      }

      // Don't retry 4xx errors (client errors - invalid request)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Client error ${response.status}: ${response.statusText}`);
      }

      // Retry 5xx errors (server errors)
      if (attempt < retries - 1) {
        const delay = API_CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt); // 1s, 2s, 4s
        console.log(`[useEntitySchema] Retry ${attempt + 1}/${retries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw new Error(`Server error ${response.status}: ${response.statusText}`);
    } catch (err) {
      // If this was the last attempt, throw the error
      if (attempt === retries - 1) {
        throw err;
      }

      // If it's a client error, don't retry
      if (err instanceof Error && err.message.includes('Client error')) {
        throw err;
      }

      // Retry on network errors
      const delay = API_CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt);
      console.log(`[useEntitySchema] Network error, retry ${attempt + 1}/${retries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Max retries exceeded');
}

export interface UseEntitySchemaResult {
  schema: EntitySchema | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useEntitySchema(entityType: string | undefined): UseEntitySchemaResult {
  const [schema, setSchema] = useState<EntitySchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  /**
   * Manual refresh - clears cache and refetches
   */
  const refresh = useCallback(() => {
    if (entityType) {
      schemaCache.delete(entityType);
      setRefreshTrigger(prev => prev + 1);
    }
  }, [entityType]);

  useEffect(() => {
    // No entity type provided
    if (!entityType) {
      setLoading(false);
      setSchema(null);
      setError(null);
      return;
    }

    // Check cache first
    const cached = schemaCache.get(entityType);
    if (cached) {
      setSchema(cached);
      setLoading(false);
      setError(null);
      return;
    }

    // Fetch schema from API
    const fetchSchema = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem('auth_token');
        const headers: HeadersInit = {
          'Content-Type': 'application/json'
        };

        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetchWithRetry(
          API_ENDPOINTS.entity.schema(entityType),
          { headers }
        );

        const schemaData = await response.json();

        // Cache the schema
        schemaCache.set(entityType, schemaData);

        setSchema(schemaData);
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        setSchema(null);
        console.error(`[useEntitySchema] Failed to fetch schema for ${entityType}:`, err);
      } finally {
        setLoading(false);
      }
    };

    fetchSchema();
  }, [entityType, refreshTrigger]);

  return { schema, loading, error, refresh };
}

/**
 * Clear all cached schemas
 */
export function clearSchemaCache() {
  schemaCache.clear();
}

/**
 * Get cache statistics (for debugging/monitoring)
 */
export function getSchemaCacheStats() {
  return schemaCache.getStats();
}
