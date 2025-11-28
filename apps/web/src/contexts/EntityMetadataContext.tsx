import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { getIconComponent } from '../lib/iconMapping';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from './AuthContext';
// v8.6.0: Use RxDB for entity codes (sync cache for non-hook access)
import { getEntityCodesSync, useRxEntityCodes } from '../db/rxdb';

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
  // v8.6.0: RxDB CACHE INTEGRATION
  // ============================================================================
  // Entity types are cached in RxDB IndexedDB via prefetchAllMetadata (login)
  // This provides offline-first caching and multi-tab sync
  // ============================================================================

  // Use RxDB hook for entity codes
  const { entityCodes, isLoading: isEntityCodesLoading } = useRxEntityCodes();

  useEffect(() => {
    // Wait for auth validation to complete
    if (isAuthLoading) {
      console.log('[EntityMetadataContext] Waiting for auth validation...');
      return;
    }

    if (!isAuthenticated) {
      console.warn('[EntityMetadataContext] Not authenticated, skipping entity metadata load');
      setLoading(false);
      return;
    }

    // Check if entity codes are loaded from RxDB
    if (isEntityCodesLoading) {
      console.log('[EntityMetadataContext] Waiting for RxDB entity codes...');
      return;
    }

    // Use entity codes from RxDB (populated via prefetchAllMetadata at login)
    const cachedTypes = entityCodes || getEntityCodesSync();

    if (cachedTypes && cachedTypes.length > 0) {
      console.log('[EntityMetadataContext] Using entity types from RxDB cache');
      console.log('[EntityMetadataContext] Cached entity codes:', cachedTypes.map((e: any) => e.code));

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

      console.log('[EntityMetadataContext] Entity map size:', entityMap.size);
      setEntities(entityMap);
      setLoading(false);
    } else {
      console.warn('[EntityMetadataContext] No entity codes in RxDB cache');
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
