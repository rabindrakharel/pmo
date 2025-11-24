import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { getIconComponent } from '../lib/iconMapping';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useEntityCodeMetadataStore } from '../stores/entityCodeMetadataStore';

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
  // ZUSTAND CACHE INTEGRATION
  // ============================================================================
  // Entity types are cached in entityCodeMetadataStore with 30-minute TTL
  // This provides cross-component cache sharing and persistence
  // ✅ INDUSTRY STANDARD: Use getState() to avoid store subscription re-renders
  // ============================================================================

  useEffect(() => {
    const fetchEntityMetadata = async () => {
      try {
        // Wait for auth validation to complete before fetching
        if (isAuthLoading) {
          console.log('[EntityMetadataContext] Waiting for auth validation...');
          return;
        }

        if (!isAuthenticated) {
          console.warn('[EntityMetadataContext] Not authenticated, skipping fetch');
          setLoading(false);
          return;
        }

        const token = localStorage.getItem('auth_token');
        if (!token) {
          console.warn('[EntityMetadataContext] No auth token in localStorage');
          setLoading(false);
          return;
        }

        // Check Zustand cache first (30-minute TTL) - use getState() to avoid subscription
        const cachedTypes = useEntityCodeMetadataStore.getState().getEntityCodes();
        console.log('[EntityMetadataContext] Cached types:', cachedTypes?.length || 0);
        if (cachedTypes && cachedTypes.length > 0) {
          console.log('[EntityMetadataContext] Using cached entity types from entityCodeMetadataStore');
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
          console.log('[EntityMetadataContext] Entity map keys:', Array.from(entityMap.keys()));
          setEntities(entityMap);
          setLoading(false);
          return;
        }

        console.log('[EntityMetadataContext] Fetching entity metadata from API...');

        // Fetch from API if cache miss
        const response = await fetch(`${API_BASE_URL}/api/v1/entity/codes`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          const entityMap = new Map<string, EntityMetadata>();

          data.forEach((entity: any) => {
            entityMap.set(entity.code, {
              code: entity.code,
              name: entity.name,
              ui_label: entity.ui_label || entity.label,
              ui_icon: entity.ui_icon || entity.icon,
              icon: getIconComponent(entity.ui_icon || entity.icon),
              display_order: entity.display_order || 0,
              active_flag: entity.active_flag,
            });
          });

          // Cache in entityCodeMetadataStore (30-minute TTL) - use getState() inside callback
          useEntityCodeMetadataStore.getState().setEntityCodes(data);

          setEntities(entityMap);
          console.log(`[EntityMetadataContext] Loaded ${entityMap.size} entity types from API`);
        } else {
          console.error('[EntityMetadataContext] Failed to fetch entity types:', response.status);
        }
      } catch (error) {
        console.error('[EntityMetadataContext] Error fetching entity metadata:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEntityMetadata();
  }, [isAuthenticated, isAuthLoading]); // Re-fetch when auth state changes

  const getEntityMetadata = (entityCode: string): EntityMetadata | undefined => {
    return entities.get(entityCode);
  };

  return (
    <EntityMetadataContext.Provider value={{ entities, getEntityMetadata, loading }}>
      {children}
    </EntityMetadataContext.Provider>
  );
}
