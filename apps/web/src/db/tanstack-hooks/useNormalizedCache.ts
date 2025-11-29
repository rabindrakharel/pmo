// ============================================================================
// 4-Layer Normalized Cache Hooks - Legacy Re-exports
// ============================================================================
// This file re-exports from the modular normalized-cache module
// for backward compatibility with existing imports.
//
// New code should import directly from '@/db/normalized-cache'
// ============================================================================

// Re-export everything from the modular architecture
export {
  // Types
  type EntityCode,
  type EntityInstance,
  type EntityLink,

  // Layer 1: Entity Codes
  useEntityCodes,
  getEntityCodeSync,
  getAllEntityCodesSync,
  getChildEntityCodesSync,
  prefetchEntityCodes,

  // Layer 2: Entity Instances
  useEntityInstances,
  getEntityInstancesSync,
  getEntityInstanceSync,
  prefetchEntityInstances,

  // Layer 3: Entity Links
  useEntityLinks,
  getChildIdsSync,
  getParentsSync,
  prefetchEntityLinks,

  // Layer 4: Entity Instance Names
  useEntityInstanceNames,
  getEntityInstanceNameSync,
  getEntityInstanceNamesForTypeSync,
  mergeEntityInstanceNames,

  // Derived Queries
  useNormalizedEntityList,

  // Lifecycle
  hydrateNormalizedCache,
  prefetchNormalizedCache,
  clearNormalizedCacheMemory,

  // Invalidation
  invalidateEntityInstance,
  invalidateEntityLinks,
  addLinkToCache,
  removeLinkFromCache,
} from '../normalized-cache';

// Re-export query keys for backward compatibility
import { QUERY_KEYS } from '../normalized-cache/adapters/cache-adapter';

export const ENTITY_CODES_KEY = QUERY_KEYS.ENTITY_CODES;
export const ENTITY_INSTANCES_KEY = QUERY_KEYS.ENTITY_INSTANCES;
export const ENTITY_LINKS_KEY = QUERY_KEYS.ENTITY_LINKS;
export const ENTITY_INSTANCE_NAMES_KEY = QUERY_KEYS.ENTITY_INSTANCE_NAMES;
