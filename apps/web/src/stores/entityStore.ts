/**
 * Entity Store - Zustand State Management
 *
 * Provides centralized state management for entities with:
 * - Optimistic updates
 * - Field-level change tracking
 * - Local storage persistence
 * - Partial updates (PATCH)
 * - Cache management
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';
import { getChangedFields, preparePatchData } from '../lib/changeDetection';
import { api } from '../lib/api';

// ============================================================================
// Types
// ============================================================================

interface EntityData {
  id: string;
  [key: string]: any;
}

interface EntityState {
  // Current entity being viewed/edited
  currentEntity: EntityData | null;

  // Original entity data (for change detection)
  originalEntity: EntityData | null;

  // Entity list cache (for list views)
  entities: Map<string, EntityData[]>;

  // Loading states
  isLoading: boolean;
  isSaving: boolean;

  // Error state
  error: string | null;

  // Edit mode tracking
  isEditing: boolean;
  dirtyFields: Set<string>;

  // Last fetch timestamps (for cache invalidation)
  lastFetch: Map<string, number>;
}

interface EntityActions {
  // Fetching
  fetchEntity: (entityType: string, entityId: string, force?: boolean) => Promise<void>;
  fetchEntities: (entityType: string, params?: Record<string, any>, force?: boolean) => Promise<void>;

  // Editing
  startEdit: () => void;
  cancelEdit: () => void;
  updateField: (fieldKey: string, value: any) => void;
  saveChanges: (entityType: string, entityId: string) => Promise<boolean>;

  // Optimistic updates
  applyOptimisticUpdate: (entityType: string, entityId: string, changes: Partial<EntityData>) => void;
  revertOptimisticUpdate: (entityType: string, entityId: string) => void;

  // Cache management
  invalidateCache: (entityType: string) => void;
  clearCache: () => void;

  // Utilities
  hasChanges: () => boolean;
  getChanges: () => Record<string, any>;
  reset: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const useEntityStore = create<EntityState & EntityActions>()(
  devtools(
    persist(
      (set, get) => ({
        // ========================================================================
        // Initial State
        // ========================================================================
        currentEntity: null,
        originalEntity: null,
        entities: new Map(),
        isLoading: false,
        isSaving: false,
        error: null,
        isEditing: false,
        dirtyFields: new Set(),
        lastFetch: new Map(),

        // ========================================================================
        // Actions
        // ========================================================================

        /**
         * Fetch a single entity (with caching)
         */
        fetchEntity: async (entityType: string, entityId: string, force = false) => {
          const cacheKey = `${entityType}:${entityId}`;
          const lastFetchTime = get().lastFetch.get(cacheKey);

          // Check cache validity
          if (!force && lastFetchTime && Date.now() - lastFetchTime < CACHE_TTL) {
            // Use cached data if available
            const cached = get().entities.get(entityType);
            if (cached) {
              const entity = cached.find(e => e.id === entityId);
              if (entity) {
                set({
                  currentEntity: entity,
                  originalEntity: { ...entity },
                  error: null
                });
                return;
              }
            }
          }

          set({ isLoading: true, error: null });

          try {
            const response = await api.get(
              `/api/v1/${entityType}/${entityId}?view=entityFormContainer`
            );

            const entity = response.data || response;

            // Update cache
            const entities = new Map(get().entities);
            const entityList = entities.get(entityType) || [];
            const index = entityList.findIndex(e => e.id === entityId);
            if (index >= 0) {
              entityList[index] = entity;
            } else {
              entityList.push(entity);
            }
            entities.set(entityType, entityList);

            // Update last fetch time
            const lastFetch = new Map(get().lastFetch);
            lastFetch.set(cacheKey, Date.now());

            set({
              currentEntity: entity,
              originalEntity: { ...entity },
              entities,
              lastFetch,
              isLoading: false,
              error: null
            });
          } catch (error: any) {
            set({
              isLoading: false,
              error: error.message || 'Failed to fetch entity'
            });
          }
        },

        /**
         * Fetch entity list (with caching)
         */
        fetchEntities: async (entityType: string, params = {}, force = false) => {
          const cacheKey = `${entityType}:list`;
          const lastFetchTime = get().lastFetch.get(cacheKey);

          // Check cache validity
          if (!force && lastFetchTime && Date.now() - lastFetchTime < CACHE_TTL) {
            return; // Use cached data
          }

          set({ isLoading: true, error: null });

          try {
            const response = await api.get(`/api/v1/${entityType}`, { params });
            const entityList = response.data?.data || response.data || [];

            // Update cache
            const entities = new Map(get().entities);
            entities.set(entityType, entityList);

            // Update last fetch time
            const lastFetch = new Map(get().lastFetch);
            lastFetch.set(cacheKey, Date.now());

            set({
              entities,
              lastFetch,
              isLoading: false,
              error: null
            });
          } catch (error: any) {
            set({
              isLoading: false,
              error: error.message || 'Failed to fetch entities'
            });
          }
        },

        /**
         * Start editing mode
         */
        startEdit: () => {
          set({
            isEditing: true,
            dirtyFields: new Set()
          });
        },

        /**
         * Cancel editing (revert to original)
         */
        cancelEdit: () => {
          const { originalEntity } = get();
          set({
            currentEntity: originalEntity ? { ...originalEntity } : null,
            isEditing: false,
            dirtyFields: new Set()
          });
        },

        /**
         * Update a single field (with change tracking)
         */
        updateField: (fieldKey: string, value: any) => {
          const { currentEntity, originalEntity, dirtyFields } = get();

          if (!currentEntity) return;

          // Update current entity
          const updatedEntity = {
            ...currentEntity,
            [fieldKey]: value
          };

          // Track dirty field
          const newDirtyFields = new Set(dirtyFields);
          if (originalEntity && originalEntity[fieldKey] !== value) {
            newDirtyFields.add(fieldKey);
          } else {
            newDirtyFields.delete(fieldKey);
          }

          set({
            currentEntity: updatedEntity,
            dirtyFields: newDirtyFields
          });
        },

        /**
         * Save changes (PATCH request with only changed fields)
         */
        saveChanges: async (entityType: string, entityId: string) => {
          const { currentEntity, originalEntity } = get();

          if (!currentEntity || !originalEntity) {
            console.error('No entity to save');
            return false;
          }

          // Get only changed fields
          const changes = preparePatchData(originalEntity, currentEntity);

          if (Object.keys(changes).length === 0) {
            console.log('No changes to save');
            set({ isEditing: false });
            return true;
          }

          set({ isSaving: true, error: null });

          // Apply optimistic update
          get().applyOptimisticUpdate(entityType, entityId, changes);

          try {
            console.log(`Saving changes to ${entityType}/${entityId}:`, changes);

            // Send PATCH request with only changed fields
            const response = await api.put(`/api/v1/${entityType}/${entityId}`, changes);
            const updatedEntity = response.data || response;

            // Update state with server response
            const entities = new Map(get().entities);
            const entityList = entities.get(entityType) || [];
            const index = entityList.findIndex(e => e.id === entityId);
            if (index >= 0) {
              entityList[index] = updatedEntity;
            }
            entities.set(entityType, entityList);

            set({
              currentEntity: updatedEntity,
              originalEntity: { ...updatedEntity },
              entities,
              isSaving: false,
              isEditing: false,
              dirtyFields: new Set(),
              error: null
            });

            return true;
          } catch (error: any) {
            console.error('Save failed:', error);

            // Revert optimistic update on failure
            get().revertOptimisticUpdate(entityType, entityId);

            set({
              isSaving: false,
              error: error.response?.data?.error || error.message || 'Failed to save changes'
            });

            return false;
          }
        },

        /**
         * Apply optimistic update (immediate UI update)
         */
        applyOptimisticUpdate: (entityType: string, entityId: string, changes: Partial<EntityData>) => {
          const { entities, currentEntity } = get();

          // Update in entity list
          const entityList = entities.get(entityType) || [];
          const index = entityList.findIndex(e => e.id === entityId);
          if (index >= 0) {
            entityList[index] = { ...entityList[index], ...changes };
          }

          // Update current entity if it matches
          if (currentEntity?.id === entityId) {
            set({
              currentEntity: { ...currentEntity, ...changes }
            });
          }

          // Update entities map
          const newEntities = new Map(entities);
          newEntities.set(entityType, [...entityList]);
          set({ entities: newEntities });
        },

        /**
         * Revert optimistic update (on error)
         */
        revertOptimisticUpdate: (entityType: string, entityId: string) => {
          const { originalEntity } = get();

          if (originalEntity?.id === entityId) {
            set({
              currentEntity: { ...originalEntity }
            });
          }
        },

        /**
         * Invalidate cache for an entity type
         */
        invalidateCache: (entityType: string) => {
          const lastFetch = new Map(get().lastFetch);

          // Remove all cache entries for this entity type
          Array.from(lastFetch.keys())
            .filter(key => key.startsWith(`${entityType}:`))
            .forEach(key => lastFetch.delete(key));

          set({ lastFetch });
        },

        /**
         * Clear entire cache
         */
        clearCache: () => {
          set({
            entities: new Map(),
            lastFetch: new Map()
          });
        },

        /**
         * Check if there are unsaved changes
         */
        hasChanges: () => {
          const { currentEntity, originalEntity } = get();
          if (!currentEntity || !originalEntity) return false;

          const changes = getChangedFields(originalEntity, currentEntity);
          return Object.keys(changes).length > 0;
        },

        /**
         * Get current changes
         */
        getChanges: () => {
          const { currentEntity, originalEntity } = get();
          if (!currentEntity || !originalEntity) return {};

          return getChangedFields(originalEntity, currentEntity);
        },

        /**
         * Reset store to initial state
         */
        reset: () => {
          set({
            currentEntity: null,
            originalEntity: null,
            entities: new Map(),
            isLoading: false,
            isSaving: false,
            error: null,
            isEditing: false,
            dirtyFields: new Set(),
            lastFetch: new Map()
          });
        }
      }),
      {
        name: 'entity-storage',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          // Only persist entity cache and fetch times
          entities: state.entities,
          lastFetch: state.lastFetch
        }),
        version: 1
      }
    ),
    {
      name: 'entity-store'
    }
  )
);

// ============================================================================
// Selectors (for performance optimization)
// ============================================================================

export const useCurrentEntity = () => useEntityStore(state => state.currentEntity);
export const useIsEditing = () => useEntityStore(state => state.isEditing);
export const useIsSaving = () => useEntityStore(state => state.isSaving);
export const useEntityError = () => useEntityStore(state => state.error);
export const useHasChanges = () => useEntityStore(state => state.hasChanges());
export const useDirtyFields = () => useEntityStore(state => state.dirtyFields);

/**
 * Get entities for a specific type
 */
export const useEntities = (entityType: string) => {
  return useEntityStore(state => state.entities.get(entityType) || []);
};

/**
 * Get a specific entity by ID
 */
export const useEntity = (entityType: string, entityId: string) => {
  const entities = useEntities(entityType);
  return entities.find(e => e.id === entityId) || null;
};