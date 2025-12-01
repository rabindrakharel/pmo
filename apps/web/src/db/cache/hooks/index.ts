// ============================================================================
// Cache Hooks - Public API
// ============================================================================
// One hook per store, following unified cache architecture
// ============================================================================

// Global Settings
export {
  useGlobalSettings,
  prefetchGlobalSettings,
  clearGlobalSettingsCache,
  getGlobalSettingsSync,
  getSettingSync,
} from './useGlobalSettings';

// Datalabels
export {
  useDatalabel,
  useAllDatalabels,
  prefetchAllDatalabels,
  clearDatalabelCache,
  getDatalabelSync,
  setDatalabelSync,
} from './useDatalabel';

// Entity Codes
export {
  useEntityCodes,
  prefetchEntityCodes,
  clearEntityCodesCache,
  getEntityCodesSync,
  getEntityCodeSync,
  getChildEntityCodesSync,
} from './useEntityCodes';

// Entity Instance Data (On-Demand)
export {
  useEntityInstanceData,
  useEntityList, // Deprecated alias
  clearEntityInstanceDataCache,
} from './useEntityInstanceData';

// Re-export remaining sync functions from stores
export {
  getEntityInstanceNameSync,
  getEntityInstanceNamesForTypeSync,
  getChildIdsSync,
  getParentsSync,
  getEntityInstanceMetadataSync,
} from '../stores';
