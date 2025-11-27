// ============================================================================
// RxDB Module Exports
// ============================================================================
// Offline-first, persistent storage with real-time sync
// ============================================================================

// Database
export {
  getDatabase,
  closeDatabase,
  clearDatabase,
  type PMODatabase,
  type EntityCollection,
  type DraftCollection,
  type MetadataCollection,
  type DatabaseCollections,
} from './database';

// Replication
export {
  getReplicationManager,
  initializeReplication,
  ReplicationManager,
  type ReplicationStatus,
} from './replication';

// Schemas
export {
  entitySchema,
  createEntityId,
  parseEntityId,
  type EntityDocType,
} from './schemas/entity.schema';

export {
  draftSchema,
  createDraftId,
  type DraftDocType,
} from './schemas/draft.schema';

export {
  metadataSchema,
  createMetadataId,
  isMetadataValid,
  METADATA_TTL,
  type MetadataDocType,
} from './schemas/metadata.schema';

// Hooks
export {
  useRxEntity,
  useRxEntityList,
  useRxEntityMutation,
  type UseRxEntityResult,
  type UseRxEntityListResult,
  type UseRxEntityMutationResult,
} from './hooks/useRxEntity';

export {
  useRxDraft,
  useRecoverDraft,
  type UseRxDraftResult,
} from './hooks/useRxDraft';
