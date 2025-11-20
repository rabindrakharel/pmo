import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getIconComponent } from '../lib/iconMapping';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from './AuthContext';

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

  useEffect(() => {
    const fetchEntityMetadata = async () => {
      try {
        // ✅ FIX: Wait for auth validation to complete before fetching
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

        console.log('[EntityMetadataContext] Fetching entity metadata...');

        // ✅ UNIFIED ENDPOINT: /api/v1/entity/codes (no param = all entities)
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
              ui_label: entity.ui_label,
              ui_icon: entity.ui_icon,
              icon: getIconComponent(entity.ui_icon), // Resolve icon component
              display_order: entity.display_order,
              active_flag: entity.active_flag,
            });
          });

          setEntities(entityMap);
          console.log(`[EntityMetadataContext] ✅ Loaded ${entityMap.size} entity types`);
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
  }, [isAuthenticated, isAuthLoading]); // ✅ FIX: Re-fetch when auth state changes

  const getEntityMetadata = (entityCode: string): EntityMetadata | undefined => {
    return entities.get(entityCode);
  };

  return (
    <EntityMetadataContext.Provider value={{ entities, getEntityMetadata, loading }}>
      {children}
    </EntityMetadataContext.Provider>
  );
}
