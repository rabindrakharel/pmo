/**
 * Sync Bridge - Bridges Zustand (sync) ↔ RxDB (async)
 *
 * This bridge allows gradual migration from Zustand to RxDB:
 * 1. Zustand stores remain for synchronous access (getState())
 * 2. RxDB provides persistence and sync
 * 3. Bridge syncs changes between them
 *
 * After full migration, Zustand stores can be removed.
 */
import type { PMODatabase } from './index';

// ============================================================================
// Sync Bridge Types
// ============================================================================

interface SyncBridgeState {
  isInitialized: boolean;
  database: PMODatabase | null;
}

const state: SyncBridgeState = {
  isInitialized: false,
  database: null
};

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the sync bridge with a database instance
 *
 * Called by DatabaseProvider after database is ready.
 * Loads RxDB data into Zustand stores for sync access.
 */
export async function initializeSyncBridge(db: PMODatabase): Promise<void> {
  if (state.isInitialized) {
    console.log('[SyncBridge] Already initialized');
    return;
  }

  state.database = db;

  try {
    console.log('%c[SyncBridge] Initializing...', 'color: #7c3aed');

    // Load datalabels from RxDB into Zustand
    await syncDatalabelsToZustand(db);

    // Load entity types from RxDB into Zustand
    await syncEntityTypesToZustand(db);

    // Load global settings from RxDB local document
    await syncGlobalSettingsToZustand(db);

    state.isInitialized = true;
    console.log('%c[SyncBridge] ✅ Initialized', 'color: #22c55e');
  } catch (error) {
    console.error('[SyncBridge] Initialization failed:', error);
    throw error;
  }
}

/**
 * Reset the sync bridge (on logout)
 */
export function resetSyncBridge(): void {
  state.isInitialized = false;
  state.database = null;
  console.log('[SyncBridge] Reset');
}

// ============================================================================
// Datalabels Sync
// ============================================================================

async function syncDatalabelsToZustand(db: PMODatabase): Promise<void> {
  const { useDatalabelMetadataStore } = await import('../stores/datalabelMetadataStore');

  // Query all datalabels from RxDB
  const datalabels = await db.datalabel.find().exec();

  if (datalabels.length === 0) {
    console.log('[SyncBridge] No datalabels in RxDB yet');
    return;
  }

  // Group by datalabel key
  const grouped: Record<string, Array<{ name: string; color_code: string; sort_order: number }>> = {};

  for (const doc of datalabels) {
    const key = doc.datalabel_key;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push({
      name: doc.name,
      color_code: doc.color_code || '',
      sort_order: doc.sort_order || 0
    });
  }

  // Sort each group by sort_order
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => a.sort_order - b.sort_order);
  }

  // Set all datalabels in Zustand
  useDatalabelMetadataStore.getState().setAllDatalabels(grouped);

  console.log(`[SyncBridge] Synced ${Object.keys(grouped).length} datalabel keys to Zustand`);
}

/**
 * Write datalabels from Zustand back to RxDB
 *
 * Called when API fetches new datalabels and updates Zustand.
 */
export async function syncDatalabelsToRxDB(
  datalabels: Record<string, Array<{ name: string; color_code?: string; sort_order?: number }>>
): Promise<void> {
  if (!state.database) {
    console.warn('[SyncBridge] Database not initialized, skipping RxDB sync');
    return;
  }

  const db = state.database;

  try {
    // Upsert all datalabels
    const docs = [];
    for (const [key, options] of Object.entries(datalabels)) {
      for (const opt of options) {
        docs.push({
          id: `${key}::${opt.name}`,
          datalabel_key: key,
          name: opt.name,
          color_code: opt.color_code || '',
          sort_order: opt.sort_order || 0,
          active_flag: true,
          updated_ts: new Date().toISOString()
        });
      }
    }

    await db.datalabel.bulkUpsert(docs);
    console.log(`[SyncBridge] Wrote ${docs.length} datalabels to RxDB`);
  } catch (error) {
    console.error('[SyncBridge] Failed to sync datalabels to RxDB:', error);
  }
}

// ============================================================================
// Entity Types Sync
// ============================================================================

async function syncEntityTypesToZustand(db: PMODatabase): Promise<void> {
  const { useEntityCodeMetadataStore } = await import('../stores/entityCodeMetadataStore');

  // Query all entity types from RxDB
  const entityTypes = await db.entity_type.find().exec();

  if (entityTypes.length === 0) {
    console.log('[SyncBridge] No entity types in RxDB yet');
    return;
  }

  // Convert to Zustand format
  const entities = entityTypes.map(doc => ({
    code: doc.code,
    name: doc.name,
    label: doc.label || doc.name,
    label_plural: doc.label_plural,
    icon: doc.icon,
    active_flag: doc.active_flag,
    child_entity_codes: doc.child_entity_codes || []
  }));

  // Set in Zustand
  useEntityCodeMetadataStore.getState().setEntities(entities);

  console.log(`[SyncBridge] Synced ${entities.length} entity types to Zustand`);
}

/**
 * Write entity types from Zustand back to RxDB
 */
export async function syncEntityTypesToRxDB(
  entities: Array<{
    code: string;
    name: string;
    label?: string;
    label_plural?: string;
    icon?: string;
    active_flag?: boolean;
    child_entity_codes?: string[];
  }>
): Promise<void> {
  if (!state.database) {
    console.warn('[SyncBridge] Database not initialized, skipping RxDB sync');
    return;
  }

  const db = state.database;

  try {
    const docs = entities.map(e => ({
      code: e.code,
      name: e.name,
      label: e.label || e.name,
      label_plural: e.label_plural || e.name + 's',
      icon: e.icon || 'folder',
      active_flag: e.active_flag ?? true,
      child_entity_codes: e.child_entity_codes || [],
      updated_ts: new Date().toISOString()
    }));

    await db.entity_type.bulkUpsert(docs);
    console.log(`[SyncBridge] Wrote ${docs.length} entity types to RxDB`);
  } catch (error) {
    console.error('[SyncBridge] Failed to sync entity types to RxDB:', error);
  }
}

// ============================================================================
// Global Settings Sync
// ============================================================================

async function syncGlobalSettingsToZustand(db: PMODatabase): Promise<void> {
  const { useGlobalSettingsMetadataStore } = await import('../stores/globalSettingsMetadataStore');

  try {
    // Try to get global settings from local document
    const localDoc = await db.project.getLocal('global-settings');

    if (!localDoc) {
      console.log('[SyncBridge] No global settings in RxDB yet');
      return;
    }

    const settings = localDoc.toJSON().data;
    if (settings) {
      useGlobalSettingsMetadataStore.getState().setGlobalSettings(settings);
      console.log('[SyncBridge] Synced global settings to Zustand');
    }
  } catch (error) {
    console.log('[SyncBridge] No global settings in RxDB:', error);
  }
}

/**
 * Write global settings from Zustand to RxDB local document
 */
export async function syncGlobalSettingsToRxDB(settings: Record<string, unknown>): Promise<void> {
  if (!state.database) {
    console.warn('[SyncBridge] Database not initialized, skipping RxDB sync');
    return;
  }

  const db = state.database;

  try {
    await db.project.upsertLocal('global-settings', {
      data: settings,
      _updatedAt: Date.now()
    });
    console.log('[SyncBridge] Wrote global settings to RxDB');
  } catch (error) {
    console.error('[SyncBridge] Failed to sync global settings to RxDB:', error);
  }
}

// ============================================================================
// Export State Accessors
// ============================================================================

export function isSyncBridgeInitialized(): boolean {
  return state.isInitialized;
}

export function getSyncBridgeDatabase(): PMODatabase | null {
  return state.database;
}
