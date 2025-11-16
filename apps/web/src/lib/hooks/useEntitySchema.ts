/**
 * ============================================================================
 * USE ENTITY SCHEMA HOOK
 * ============================================================================
 *
 * React hook for fetching entity schema from the API.
 * Schemas are cached and reused across components.
 *
 * USAGE:
 * ```typescript
 * const { schema, loading, error } = useEntitySchema('project');
 *
 * if (loading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error}</div>;
 * if (schema) return <Table columns={schema.columns} />;
 * ```
 */

import { useState, useEffect } from 'react';
import type { EntitySchema } from '../types/schema';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// Schema cache to avoid redundant API calls
const schemaCache = new Map<string, EntitySchema>();

export function useEntitySchema(entityType: string | undefined) {
  const [schema, setSchema] = useState<EntitySchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!entityType) {
      setLoading(false);
      return;
    }

    // Check cache first
    if (schemaCache.has(entityType)) {
      setSchema(schemaCache.get(entityType)!);
      setLoading(false);
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

        const response = await fetch(
          `${API_BASE_URL}/api/v1/entity/${entityType}/schema`,
          { headers }
        );

        if (response.ok) {
          const schemaData = await response.json();

          // Cache the schema
          schemaCache.set(entityType, schemaData);

          setSchema(schemaData);
        } else {
          const errorText = await response.text();
          setError(`Failed to load schema: ${response.statusText}`);
          console.error(`Failed to fetch schema for ${entityType}:`, errorText);
        }
      } catch (err) {
        setError('An error occurred while fetching schema');
        console.error('Error fetching schema:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSchema();
  }, [entityType]);

  return { schema, loading, error };
}

/**
 * Clear schema cache (useful for testing or force refresh)
 */
export function clearSchemaCache() {
  schemaCache.clear();
}
