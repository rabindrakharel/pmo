import { useState, useEffect, useMemo } from 'react';

export interface EntityInstance {
  id: string;
  name: string;
  code?: string;
  descr?: string;
  email?: string;
  title?: string;
  role_code?: string;
}

interface UseEntityInstancePickerOptions {
  entityCode: string | null;
  enabled?: boolean;
  limit?: number;
}

interface UseEntityInstancePickerReturn {
  instances: EntityInstance[];
  filteredInstances: EntityInstance[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  refresh: () => void;
}

/**
 * Reusable hook for loading and filtering entity instances
 * Used by: UnifiedLinkageModal, PermissionManagementModal
 *
 * @example
 * const { instances, filteredInstances, loading } = useEntityInstancePicker({
 *   entityCode: 'project',
 *   enabled: true
 * });
 */
export function useEntityInstancePicker({
  entityCode,
  enabled = true,
  limit = 100
}: UseEntityInstancePickerOptions): UseEntityInstancePickerReturn {
  const [instances, setInstances] = useState<EntityInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  const token = localStorage.getItem('auth_token');

  // Map entity types to API endpoints (same as UnifiedLinkageModal.tsx:57-61)
  const getApiEndpoint = (type: string): string => {
    if (type === 'business') return 'biz';
    if (type === 'client' || type === 'customer') return 'cust';
    return type;
  };

  // Load instances when entity type changes
  const loadInstances = async () => {
    if (!entityCode || !enabled) {
      setInstances([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const endpoint = getApiEndpoint(entityCode);
      const response = await fetch(
        `${apiUrl}/api/v1/${endpoint}?limit=${limit}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) {
        throw new Error(`Failed to load ${entityCode} instances`);
      }

      const data = await response.json();
      const entities = (data.data || data.results || []).map((e: any) => ({
        id: e.id,
        name: e.name || e.title || e.email || 'Unnamed',
        code: e.code,
        descr: e.descr || e.description,
        email: e.email,
        title: e.title,
        role_code: e.role_code
      }));

      setInstances(entities);
    } catch (err) {
      console.error(`Error loading ${entityCode} instances:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load instances');
      setInstances([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load when entity type changes
  useEffect(() => {
    loadInstances();
  }, [entityCode, enabled]);

  // Filter instances based on search query
  const filteredInstances = useMemo(() => {
    if (!searchQuery.trim()) return instances;

    const query = searchQuery.toLowerCase();
    return instances.filter(instance =>
      instance.name.toLowerCase().includes(query) ||
      instance.code?.toLowerCase().includes(query) ||
      instance.descr?.toLowerCase().includes(query) ||
      instance.email?.toLowerCase().includes(query) ||
      instance.role_code?.toLowerCase().includes(query)
    );
  }, [instances, searchQuery]);

  return {
    instances,
    filteredInstances,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    refresh: loadInstances
  };
}
