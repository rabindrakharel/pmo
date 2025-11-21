/**
 * ============================================================================
 * ENTITY CODE METADATA STORE
 * ============================================================================
 *
 * Purpose: Cache entity type definitions (sidebar navigation, entity registry)
 * TTL: Session-level (30 minutes)
 * Source: GET /api/v1/entity/types
 *
 * Usage:
 * ```typescript
 * const { getEntityCodes, setEntityCodes, getEntityByCode } = useEntityCodeMetadataStore();
 * const entities = getEntityCodes();
 * const projectEntity = getEntityByCode('project');
 * ```
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

export interface EntityCodeData {
  code: string;
  name: string;
  label: string;
  icon: string | null;
  descr?: string;
  child_entity_codes?: string[];
  parent_entity_codes?: string[];
  active_flag: boolean;
}

interface CacheEntry {
  data: EntityCodeData[];
  dataMap: Map<string, EntityCodeData>;
  timestamp: number;
  ttl: number;
}

interface EntityCodeMetadataState {
  entityCodes: CacheEntry | null;
}

interface EntityCodeMetadataActions {
  setEntityCodes: (entities: EntityCodeData[]) => void;
  getEntityCodes: () => EntityCodeData[] | null;
  getEntityCodesMap: () => Map<string, EntityCodeData> | null;
  getEntityByCode: (code: string) => EntityCodeData | null;
  isExpired: () => boolean;
  clear: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes (session-level)

// ============================================================================
// Store Implementation
// ============================================================================

export const useEntityCodeMetadataStore = create<EntityCodeMetadataState & EntityCodeMetadataActions>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State
        entityCodes: null,

        // Setters
        setEntityCodes: (entities: EntityCodeData[]) => {
          console.log(`%c[EntityCodeStore] Storing ${entities.length} entity types`, 'color: #be4bdb; font-weight: bold', {
            codes: entities.map((e) => e.code),
          });

          // Build a Map for O(1) lookups
          const dataMap = new Map<string, EntityCodeData>();
          entities.forEach((entity) => {
            dataMap.set(entity.code, entity);
          });

          set({
            entityCodes: {
              data: entities,
              dataMap,
              timestamp: Date.now(),
              ttl: CACHE_TTL,
            },
          });
        },

        // Getters
        getEntityCodes: () => {
          const { entityCodes } = get();
          if (!entityCodes) return null;

          if (get().isExpired()) {
            console.log('%c[EntityCodeStore] Cache expired', 'color: #fcc419');
            return null;
          }

          console.log('%c[EntityCodeStore] Cache HIT', 'color: #51cf66; font-weight: bold');
          return entityCodes.data;
        },

        getEntityCodesMap: () => {
          const { entityCodes } = get();
          if (!entityCodes) return null;

          if (get().isExpired()) {
            return null;
          }

          return entityCodes.dataMap;
        },

        getEntityByCode: (code: string) => {
          const { entityCodes } = get();
          if (!entityCodes || get().isExpired()) return null;

          const entity = entityCodes.dataMap.get(code);
          if (entity) {
            console.log(`%c[EntityCodeStore] Cache HIT: ${code}`, 'color: #51cf66; font-weight: bold');
          }
          return entity || null;
        },

        // Utilities
        isExpired: () => {
          const { entityCodes } = get();
          if (!entityCodes) return true;
          return Date.now() - entityCodes.timestamp > entityCodes.ttl;
        },

        clear: () => {
          console.log('%c[EntityCodeStore] Cleared', 'color: #ff6b6b');
          set({ entityCodes: null });
        },
      }),
      {
        name: 'pmo-entity-code-store',
        storage: createJSONStorage(() => sessionStorage),
        partialize: (state) => ({
          entityCodes: state.entityCodes
            ? {
                data: state.entityCodes.data,
                dataMap: Array.from(state.entityCodes.dataMap.entries()),
                timestamp: state.entityCodes.timestamp,
                ttl: state.entityCodes.ttl,
              }
            : null,
        }),
        merge: (persisted: any, current) => {
          if (persisted?.entityCodes?.dataMap) {
            persisted.entityCodes.dataMap = new Map(persisted.entityCodes.dataMap);
          }
          return { ...current, ...persisted };
        },
      }
    ),
    { name: 'EntityCodeMetadataStore' }
  )
);
