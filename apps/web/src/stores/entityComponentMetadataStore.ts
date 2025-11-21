/**
 * ============================================================================
 * ENTITY COMPONENT METADATA STORE
 * ============================================================================
 *
 * Purpose: Cache field metadata for entities, keyed by entityCode:componentName
 * TTL: Session-level (30 minutes)
 * Source: Entity API responses (metadata field)
 *
 * Cache Key Format: "project:entityDataTable", "task:entityFormContainer"
 *
 * Usage:
 * ```typescript
 * const { getComponentMetadata, setComponentMetadata } = useEntityComponentMetadataStore();
 * const tableMetadata = getComponentMetadata('project', 'entityDataTable');
 * ```
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

export interface FieldMetadata {
  dtype: string;
  format: string;
  internal: boolean;
  visible: boolean;
  filterable: boolean;
  sortable: boolean;
  editable: boolean;
  viewType: string;
  editType: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  searchable?: boolean;
  required?: boolean;
  placeholder?: string;
  help?: string;
  currencySymbol?: string;
  decimals?: number;
  locale?: string;
  dateFormat?: string;
  timestampFormat?: string;
  trueLabel?: string;
  falseLabel?: string;
  trueColor?: string;
  falseColor?: string;
  loadFromEntity?: string;
  datalabelKey?: string;
  endpoint?: string;
  displayField?: string;
  valueField?: string;
}

export type ComponentName =
  | 'entityDataTable'
  | 'entityFormContainer'
  | 'entityDetailView'
  | 'kanbanView'
  | 'calendarView'
  | 'gridView'
  | 'dagView'
  | 'hierarchyGraphView';

export type ComponentMetadata = Record<string, FieldMetadata>;

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
  invalidateEntity: (entityCode: string) => void;
  clear: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes (session-level)

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
          console.log(`%c[EntityComponentStore] Storing: ${cacheKey}`, 'color: #be4bdb; font-weight: bold', {
            fieldCount: Object.keys(metadata).length,
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

          console.log(`%c[EntityComponentStore] Cache HIT: ${cacheKey}`, 'color: #51cf66; font-weight: bold');
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
