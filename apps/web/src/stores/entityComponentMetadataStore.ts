/**
 * ============================================================================
 * ENTITY COMPONENT METADATA STORE
 * ============================================================================
 *
 * Purpose: Cache field metadata for entities, keyed by entityCode:componentName
 * TTL: Session-level (15 minutes)
 * Source: Entity API responses (metadata field)
 *
 * Cache Key Format: "project:entityDataTable", "task:entityFormContainer"
 *
 * v8.2.0: Only supports nested ComponentMetadata structure from backend
 * Backend MUST send: { viewType: {...}, editType: {...} }
 *
 * Usage:
 * ```typescript
 * const { getComponentMetadata, setComponentMetadata } = useEntityComponentMetadataStore();
 * const tableMetadata = getComponentMetadata('project', 'entityDataTable');
 * // Returns: { viewType: {...}, editType: {...} }
 *
 * // To get viewType for rendering:
 * import { extractViewType } from '@/lib/formatters/types';
 * const viewType = extractViewType(tableMetadata);
 * ```
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';
import type {
  ComponentMetadata,
  ViewFieldMetadata,
  EditFieldMetadata,
} from '../lib/formatters/types';
import { isValidComponentMetadata } from '../lib/formatters/types';

// ============================================================================
// Types
// ============================================================================

export type ComponentName =
  | 'entityDataTable'
  | 'entityFormContainer'
  | 'kanbanView'
  | 'calendarView'
  | 'gridView'
  | 'dagView'
  | 'hierarchyGraphView';

interface CacheEntry {
  data: ComponentMetadata;
  timestamp: number;
  ttl: number;
  entityCode: string;
  componentName: string;
}

interface EntityComponentMetadataState {
  metadata: Record<string, CacheEntry>; // key: entityCode:componentName
}

interface EntityComponentMetadataActions {
  setComponentMetadata: (entityCode: string, componentName: string, metadata: ComponentMetadata) => void;
  setAllComponentMetadata: (entityCode: string, allMetadata: Record<string, ComponentMetadata>) => void;
  getComponentMetadata: (entityCode: string, componentName: string) => ComponentMetadata | null;
  getAllComponentMetadata: (entityCode: string) => Record<string, ComponentMetadata> | null;
  isExpired: (entityCode: string, componentName: string) => boolean;
  getExpiredKeys: () => string[];
  invalidateEntity: (entityCode: string) => void;
  clear: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes (metadata)

// ============================================================================
// Store Implementation
// ============================================================================

export const useEntityComponentMetadataStore = create<EntityComponentMetadataState & EntityComponentMetadataActions>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State
        metadata: {},

        // Setters
        setComponentMetadata: (entityCode: string, componentName: string, metadata: ComponentMetadata) => {
          const cacheKey = `${entityCode}:${componentName}`;
          const fieldCount = Object.keys(metadata.viewType || {}).length;

          console.log(`%c[EntityComponentStore] Storing: ${cacheKey}`, 'color: #be4bdb; font-weight: bold', {
            fieldCount,
            isValid: isValidComponentMetadata(metadata),
          });

          const { metadata: currentMetadata } = get();
          set({
            metadata: {
              ...currentMetadata,
              [cacheKey]: {
                data: metadata,
                timestamp: Date.now(),
                ttl: CACHE_TTL,
                entityCode,
                componentName,
              },
            },
          });
        },

        setAllComponentMetadata: (entityCode: string, allMetadata: Record<string, ComponentMetadata>) => {
          const componentNames = Object.keys(allMetadata);
          console.log(`%c[EntityComponentStore] Storing all for ${entityCode}:`, 'color: #be4bdb; font-weight: bold', componentNames);

          const { metadata: currentMetadata } = get();
          const timestamp = Date.now();
          const newEntries: Record<string, CacheEntry> = {};

          Object.entries(allMetadata).forEach(([componentName, componentMetadata]) => {
            const cacheKey = `${entityCode}:${componentName}`;
            newEntries[cacheKey] = {
              data: componentMetadata,
              timestamp,
              ttl: CACHE_TTL,
              entityCode,
              componentName,
            };
          });

          set({
            metadata: {
              ...currentMetadata,
              ...newEntries,
            },
          });
        },

        // Getters
        getComponentMetadata: (entityCode: string, componentName: string) => {
          const cacheKey = `${entityCode}:${componentName}`;
          const { metadata } = get();
          const entry = metadata[cacheKey];

          if (!entry) return null;

          if (get().isExpired(entityCode, componentName)) {
            console.log(`%c[EntityComponentStore] Cache expired: ${cacheKey}`, 'color: #fcc419');
            return null;
          }

          console.log(`%c[EntityComponentStore] Cache HIT: ${cacheKey}`, 'color: #51cf66; font-weight: bold', {
            isValid: isValidComponentMetadata(entry.data),
          });
          return entry.data;
        },

        getAllComponentMetadata: (entityCode: string) => {
          const { metadata } = get();
          const result: Record<string, ComponentMetadata> = {};
          let hasValidEntries = false;

          Object.entries(metadata).forEach(([_cacheKey, entry]) => {
            if (entry.entityCode === entityCode && !get().isExpired(entityCode, entry.componentName)) {
              result[entry.componentName] = entry.data;
              hasValidEntries = true;
            }
          });

          if (!hasValidEntries) return null;

          console.log(`%c[EntityComponentStore] Cache HIT (all ${entityCode}):`, 'color: #51cf66; font-weight: bold', Object.keys(result));
          return result;
        },

        // Utilities
        isExpired: (entityCode: string, componentName: string) => {
          const cacheKey = `${entityCode}:${componentName}`;
          const { metadata } = get();
          const entry = metadata[cacheKey];
          if (!entry) return true;
          return Date.now() - entry.timestamp > entry.ttl;
        },

        getExpiredKeys: () => {
          const { metadata } = get();
          const now = Date.now();
          return Object.entries(metadata)
            .filter(([_, entry]) => now - entry.timestamp > entry.ttl)
            .map(([key]) => key);
        },

        invalidateEntity: (entityCode: string) => {
          console.log(`%c[EntityComponentStore] Invalidating: ${entityCode}`, 'color: #ff6b6b');
          const { metadata } = get();
          const newMetadata: Record<string, CacheEntry> = {};

          Object.entries(metadata).forEach(([cacheKey, entry]) => {
            if (entry.entityCode !== entityCode) {
              newMetadata[cacheKey] = entry;
            }
          });

          set({ metadata: newMetadata });
        },

        clear: () => {
          console.log('%c[EntityComponentStore] Cleared all', 'color: #ff6b6b');
          set({ metadata: {} });
        },
      }),
      {
        name: 'pmo-entity-component-metadata-store',
        storage: createJSONStorage(() => sessionStorage),
        partialize: (state) => ({ metadata: state.metadata }),
      }
    ),
    { name: 'EntityComponentMetadataStore' }
  )
);

// ============================================================================
// Re-export types for convenience
// ============================================================================
export type { ComponentMetadata, ViewFieldMetadata, EditFieldMetadata };
