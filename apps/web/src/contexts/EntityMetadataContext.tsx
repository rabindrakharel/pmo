import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { getIconComponent } from '../lib/iconMapping';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from './AuthContext';
// v9.0.0: Use TanStack Query + Dexie for entity codes (sync cache for non-hook access)
import { useEntityCodes, getEntityCodesSync } from '../db/tanstack-index';

interface EntityMetadata {
  code: string;
  name: string;
  ui_label: string;
  ui_icon: string | null;
  icon: LucideIcon; // Resolved Lucide icon component
  display_order: number;
  active_flag: boolean;
}

interface EntityMetadataContextType {
  entities: Map<string, EntityMetadata>;
  getEntityMetadata: (entityCode: string) => EntityMetadata | undefined;
  loading: boolean;
}

const EntityMetadataContext = createContext<EntityMetadataContextType>({
  entities: new Map(),
  getEntityMetadata: () => undefined,
  loading: true,
});

export function useEntityMetadata() {
  return useContext(EntityMetadataContext);
}

interface EntityMetadataProviderProps {
  children: ReactNode;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export function EntityMetadataProvider({ children }: EntityMetadataProviderProps) {
  const [entities, setEntities] = useState<Map<string, EntityMetadata>>(new Map());
  const [loading, setLoading] = useState(true);
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // ============================================================================
  // v9.0.0: TANSTACK QUERY + DEXIE CACHE INTEGRATION
  // ============================================================================
  // Entity types are cached in Dexie IndexedDB via prefetchEntityCodes (login)
  // This provides offline-first caching with TanStack Query's stale-while-revalidate
  // ============================================================================

  // Use TanStack Query hook for entity codes (only fetch when authenticated)
  const { entityCodes, isLoading: isEntityCodesLoading } = useEntityCodes({
    enabled: isAuthenticated && !isAuthLoading,
  });

  useEffect(() => {
    // Wait for auth validation to complete
    if (isAuthLoading) {
      return;
    }

    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    // Check if entity codes are loaded from TanStack Query
    if (isEntityCodesLoading) {
      return;
    }

    // Use entity codes from TanStack Query (populated via prefetchEntityCodes at login)
    const cachedTypes = entityCodes || getEntityCodesSync();

    if (cachedTypes && cachedTypes.length > 0) {
      const entityMap = new Map<string, EntityMetadata>();
      cachedTypes.forEach((entity: any) => {
        entityMap.set(entity.code, {
          code: entity.code,
          name: entity.name,
          ui_label: entity.label,
          ui_icon: entity.icon,
          icon: getIconComponent(entity.icon),
          display_order: entity.display_order || 0,
          active_flag: entity.active_flag,
        });
      });

      setEntities(entityMap);
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, isAuthLoading, entityCodes, isEntityCodesLoading]);

  const getEntityMetadata = (entityCode: string): EntityMetadata | undefined => {
    return entities.get(entityCode);
  };

  return (
    <EntityMetadataContext.Provider value={{ entities, getEntityMetadata, loading }}>
      {children}
    </EntityMetadataContext.Provider>
  );
}
