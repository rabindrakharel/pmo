// ============================================================================
// Persistence Layer - Public API
// ============================================================================
// Dexie IndexedDB operations and hydration
// ============================================================================

// Database
export {
  db,
  CacheDatabase,
  isDatabaseReady,
  getDatabaseStats,
  closeDatabase,
  type GlobalSettingsRecord,
  type DatalabelRecord,
  type EntityCodesRecord,
  type EntityInstanceNameRecord,
  type EntityLinkForwardRecord,
  type EntityLinkReverseRecord,
  type EntityInstanceMetadataRecord,
  type EntityInstanceDataRecord,
  type DraftRecord,
} from './schema';

// Operations
export {
  // Global Settings
  getGlobalSettings,
  setGlobalSettings,
  clearGlobalSettings,
  // Datalabels
  getDatalabel,
  setDatalabel,
  getAllDatalabels,
  clearDatalabel,
  // Entity Codes
  getEntityCodes,
  setEntityCodes,
  clearEntityCodes,
  // Entity Instance Names
  getEntityInstanceName,
  setEntityInstanceName,
  getEntityInstanceNamesForType,
  bulkSetEntityInstanceNames,
  clearEntityInstanceNames,
  // Entity Links
  getEntityLinkForward,
  setEntityLinkForward,
  getEntityLinkReverse,
  setEntityLinkReverse,
  clearEntityLinks,
  // Entity Instance Metadata
  getEntityInstanceMetadata,
  setEntityInstanceMetadata,
  clearEntityInstanceMetadata,
  // Entity Instance Data
  getEntityInstanceData,
  setEntityInstanceData,
  clearEntityInstanceData,
  clearStaleEntityInstanceData,
  // Drafts
  getDraft,
  setDraft,
  updateDraft,
  deleteDraft,
  getAllDrafts,
  getDraftsForEntity,
  clearDrafts,
  // Bulk Operations
  clearAllExceptDrafts,
  clearAllStores,
  clearStaleData,
} from './operations';

// Hydration
export {
  hydrateFromDexie,
  persistToGlobalSettings,
  persistToDatalabel,
  persistToEntityCodes,
  persistToEntityInstanceNames,
  persistToEntityInstanceMetadata,
  persistToEntityInstanceData,
  type HydrationResult,
} from './hydrate';
