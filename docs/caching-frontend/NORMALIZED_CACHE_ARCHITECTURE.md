# Unified Cache Architecture

> **Version:** 4.0.0 | PMO Enterprise Platform
> **Status:** Implementation Complete
> **Date:** 2025-12-02

## Executive Summary

This document describes the **unified cache architecture** that consolidates TanStack Query + Dexie IndexedDB + WebSocket real-time sync into a single, streamlined system. All cache operations are accessed through a **single public API**: `db/tanstack-index.ts`.

### Key Changes in v11.0.0

- **Removed sync stores** - No more redundant Map-based in-memory caches
- **Single source of truth** - TanStack Query cache is the only in-memory cache
- **Sync accessors use queryClient.getQueryData()** - Direct cache access for formatters/utilities
- **Simpler hydration** - Only populates TanStack Query from Dexie

### Key Benefits

- **Single Entry Point** - All imports from `@/db/tanstack-index`
- **Single In-Memory Cache** - TanStack Query only (no duplicate sync stores)
- **Dual-Cache Optimistic Updates** - Immediate write to both TanStack Query AND Dexie
- **Zero redundant API calls** - Filtered queries derive from cached graph
- **Instant parent-child navigation** - Link graph enables O(1) lookups
- **Offline-first** - Full entity graph persisted in IndexedDB (Dexie)
- **Real-time sync** - WebSocket-based cache invalidation

---

## 1. Architecture Overview

### High-Level Architecture (v11.0.0)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  UNIFIED CACHE ARCHITECTURE (v11.0.0)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PUBLIC API: db/tanstack-index.ts                                           │
│  ════════════════════════════════                                           │
│  • Single import point for all cache operations                             │
│  • Exports hooks, sync accessors, constants, types, utilities               │
│  • Dual-cache optimistic mutations (TanStack + Dexie)                       │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         TWO LAYERS                                       ││
│  ├─────────────────────────────────────┬────────────────────────────────────┤│
│  │   IN-MEMORY LAYER                   │  PERSISTENT LAYER                  ││
│  │   (TanStack Query)                  │  (Dexie IndexedDB)                 ││
│  │                                     │                                    ││
│  │   • queryClient cache               │  • 8 tables                        ││
│  │   • React hooks                     │  • Survives browser restart        ││
│  │   • Sync accessors                  │  • Hydrates TanStack on startup    ││
│  │   • Auto-refetch                    │                                    ││
│  └─────────────────────────────────────┴────────────────────────────────────┘│
│                                                                              │
│  REAL-TIME LAYER: WebSocket Manager (port 4001)                             │
│  • INVALIDATE → queryClient.invalidateQueries()                             │
│  • Auto-refetch → Components re-render with fresh data                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
apps/web/src/db/
├── tanstack-index.ts         # PUBLIC API - single entry point
├── Provider.tsx              # React context provider (CacheProvider)
├── TanstackCacheProvider.tsx # Legacy provider
├── index.ts                  # Module exports
│
├── cache/                    # CACHE LAYER
│   ├── index.ts              # Cache exports
│   ├── client.ts             # TanStack Query client
│   ├── constants.ts          # Stale times, GC times, TTLs
│   ├── keys.ts               # Query keys, Dexie keys
│   ├── stores.ts             # Sync accessor functions (v11.0.0)
│   ├── types.ts              # Type definitions
│   └── hooks/                # React hooks
│       ├── index.ts          # Hook exports
│       ├── useDatalabel.ts   # Datalabel dropdown options
│       ├── useDraft.ts       # Draft persistence
│       ├── useEntity.ts      # Single entity data
│       ├── useEntityCodes.ts # Entity type metadata
│       ├── useEntityInstanceData.ts  # Entity list data
│       ├── useEntityInstanceNames.ts # Entity name resolution
│       ├── useEntityLinks.ts # Parent-child relationships
│       ├── useGlobalSettings.ts # App settings
│       ├── useOfflineEntity.ts # Offline-only access
│       └── useOptimisticMutation.ts # Dual-cache optimistic updates
│
├── persistence/              # PERSISTENCE LAYER
│   ├── index.ts              # Persistence exports
│   ├── schema.ts             # Dexie v5 schema (8 tables)
│   ├── hydrate.ts            # Dexie → TanStack hydration
│   └── operations.ts         # Clear, cleanup, granular update operations
│
└── realtime/                 # REAL-TIME LAYER
    ├── index.ts              # Realtime exports
    └── manager.ts            # WebSocket manager
```

---

## 2. Cache Layer (db/cache/)

### 2.1 TanStack Query Client

The query client manages all in-memory caching with automatic refetch, stale-while-revalidate, and cache invalidation.

```typescript
// db/cache/client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,     // 5 minutes
      gcTime: 10 * 60 * 1000,       // 10 minutes (garbage collection)
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// Invalidate specific store
export function invalidateStore(storeKey: string) {
  queryClient.invalidateQueries({ queryKey: [storeKey] });
}

// Invalidate entity-specific queries
export function invalidateEntityQueries(entityCode: string, entityId?: string) {
  queryClient.invalidateQueries({
    queryKey: entityId
      ? ['entityInstance', entityCode, entityId]
      : ['entityInstanceData', entityCode],
  });
}
```

### 2.2 Sync Accessors (v11.0.0)

**v11.0.0 Key Change:** Sync accessors now read directly from `queryClient.getQueryData()` instead of separate Map-based stores.

```typescript
// db/cache/stores.ts

import { queryClient } from './client';
import { QUERY_KEYS } from './keys';

// ═══════════════════════════════════════════════════════════════════════════
// SYNC ACCESS FUNCTIONS (for formatters/utilities - outside React)
// v11.0.0: Read directly from queryClient.getQueryData()
// ═══════════════════════════════════════════════════════════════════════════

export function getGlobalSettingsSync(): GlobalSettings | null {
  return queryClient.getQueryData<GlobalSettings>(QUERY_KEYS.globalSettings()) ?? null;
}

export function getDatalabelSync(key: string): DatalabelOption[] | null {
  const normalizedKey = key.startsWith('dl__') ? key.slice(4) : key;
  return queryClient.getQueryData<DatalabelOption[]>(QUERY_KEYS.datalabel(normalizedKey)) ?? null;
}

export function getEntityCodesSync(): EntityCode[] | null {
  return queryClient.getQueryData<EntityCode[]>(QUERY_KEYS.entityCodes()) ?? null;
}

export function getEntityCodeSync(code: string): EntityCode | null {
  const codes = getEntityCodesSync();
  return codes?.find(c => c.code === code) ?? null;
}

export function getChildEntityCodesSync(parentCode: string): string[] {
  const entity = getEntityCodeSync(parentCode);
  return entity?.child_entity_codes ?? [];
}

export function getEntityInstanceNameSync(entityCode: string, entityInstanceId: string): string | null {
  const names = queryClient.getQueryData<Record<string, string>>(
    QUERY_KEYS.entityInstanceNames(entityCode)
  );
  return names?.[entityInstanceId] ?? null;
}

export function getEntityInstanceNamesForTypeSync(entityCode: string): Record<string, string> {
  return queryClient.getQueryData<Record<string, string>>(
    QUERY_KEYS.entityInstanceNames(entityCode)
  ) ?? {};
}

export function getEntityInstanceMetadataSync(entityCode: string): EntityInstanceMetadata | null {
  return queryClient.getQueryData<EntityInstanceMetadata>(
    QUERY_KEYS.entityInstanceMetadata(entityCode)
  ) ?? null;
}

// Cache statistics for debugging
export function getCacheStats(): {
  globalSettings: boolean;
  datalabelKeys: string[];
  entityCodesCount: number;
  entityInstanceNamesTypes: string[];
  entityInstanceMetadataTypes: string[];
};
```

### 2.3 React Hooks

All hooks follow the TanStack Query pattern with Dexie persistence.

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// SESSION-LEVEL HOOKS (prefetched at login)
// ═══════════════════════════════════════════════════════════════════════════

// Entity type metadata
const { data: entityCodes, isLoading } = useEntityCodes();
const entityCode = entityCodes?.find(e => e.code === 'project');
const childCodes = entityCode?.child_entity_codes || [];

// Datalabel dropdown options
const { data: options, isLoading } = useDatalabel('project_stage');
// Returns: [{ code: 'planning', label: 'Planning', color: '#blue' }, ...]

// Global application settings
const { data: settings } = useGlobalSettings();

// Entity instance name resolution
const { data: names } = useEntityInstanceNames('employee');
const name = names?.get(employeeId);

// ═══════════════════════════════════════════════════════════════════════════
// ON-DEMAND HOOKS (fetched when components mount)
// ═══════════════════════════════════════════════════════════════════════════

// Single entity data
const { data: project, isLoading } = useEntity<Project>('project', projectId);

// Entity list with pagination
const { data, total, isLoading } = useEntityInstanceData<Project>('project', {
  limit: 20,
  offset: 0,
  parent_entity_code: 'business',
  parent_entity_instance_id: businessId,
});

// Parent-child relationships
const { data: links } = useEntityLinks(parentCode, parentId);

// Draft persistence (undo/redo, survives page refresh)
const { data: draft, updateField, undo, redo, hasChanges, save, discard } = useDraft('project', projectId);

// Offline-only access
const { data, isStale } = useOfflineEntity<Project>('project', projectId);

// ═══════════════════════════════════════════════════════════════════════════
// OPTIMISTIC MUTATION HOOK (dual-cache updates)
// ═══════════════════════════════════════════════════════════════════════════

// Optimistic mutations with dual-cache (TanStack + Dexie)
const { updateEntity, deleteEntity, isUpdating, isDeleting } = useOptimisticMutation<Project>('project');

// Update: Immediate UI + IndexedDB update, then API call
updateEntity({ entityId: projectId, changes: { name: 'New Name' } });

// Delete: Immediate removal from both caches, then API call
deleteEntity({ entityId: projectId });
```

---

## 3. Persistence Layer (db/persistence/)

### 3.1 Dexie Schema (v5)

8 tables with unified naming aligned to TanStack Query keys.

```typescript
// db/persistence/schema.ts
import Dexie from 'dexie';

export const db = new Dexie('pmo-cache-v5');

db.version(1).stores({
  // Session-level stores
  globalSettings: '_id',                                   // Single record
  datalabel: '_id, key',                                   // dl__project_stage
  entityCodes: '_id',                                      // entity type metadata
  entityInstanceNames: '_id, [entityCode+entityInstanceId]', // name resolution

  // On-demand stores
  entityInstanceData: '_id, entityCode',                   // list data cache
  entityInstanceMetadata: '_id, entityCode',               // field metadata

  // Relationship stores
  entityLinkForward: '_id, [parentCode+parentId+childCode]', // parent → children
  entityLinkReverse: '_id, [childCode+childId]',             // child → parents

  // User data
  draft: '_id, [entityCode+entityId]',                       // form drafts
});
```

### 3.2 Hydration (v11.0.0)

Load from Dexie into TanStack Query on app startup.

```typescript
// db/persistence/hydrate.ts

export async function hydrateFromDexie(): Promise<HydrationResult> {
  const maxAge = HYDRATION_CONFIG.maxAge;
  const now = Date.now();

  // Load session-level data from IndexedDB
  const [settings, datalabels, codes, names] = await Promise.all([
    db.globalSettings.get('settings'),
    db.datalabel.filter(d => now - d.syncedAt < maxAge).toArray(),
    db.entityCodes.get('all'),
    db.entityInstanceNames.filter(r => now - r.syncedAt < maxAge).toArray(),
  ]);

  // v11.0.0: Only populate TanStack Query cache (no sync stores)
  if (settings) {
    queryClient.setQueryData(QUERY_KEYS.globalSettings(), settings.settings);
  }

  datalabels.forEach(d => {
    queryClient.setQueryData(QUERY_KEYS.datalabel(d.key), d.options);
  });

  if (codes) {
    queryClient.setQueryData(QUERY_KEYS.entityCodes(), codes.codes);
  }

  // Group entity names by entity code
  const namesByEntity = new Map<string, Record<string, string>>();
  names.forEach(n => {
    if (!namesByEntity.has(n.entityCode)) {
      namesByEntity.set(n.entityCode, {});
    }
    namesByEntity.get(n.entityCode)![n.entityInstanceId] = n.name;
  });
  namesByEntity.forEach((names, code) => {
    queryClient.setQueryData(QUERY_KEYS.entityInstanceNames(code), names);
  });

  return { success: true, counts, errors: [] };
}
```

---

## 4. Real-time Layer (db/realtime/)

### 4.1 WebSocket Manager

Connects to PubSub service for cache invalidation.

```typescript
// db/realtime/manager.ts

export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4001';

class WebSocketManager {
  connect(token: string): void {
    this.ws = new WebSocket(`${WS_URL}?token=${token}`);

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'INVALIDATE') {
        this.handleInvalidate(message.payload);
      }
    };
  }

  handleInvalidate(payload: InvalidatePayload): void {
    const { entityCode, entityId, action } = payload;

    // v11.0.0: Invalidate TanStack Query cache directly (no sync stores)
    if (entityId) {
      invalidateEntityQueries(entityCode, entityId);
    } else {
      invalidateEntityQueries(entityCode);
    }
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}

export const wsManager = new WebSocketManager();
```

### 4.2 Invalidation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REAL-TIME INVALIDATION FLOW (v11.0.0)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. API writes to database                                                   │
│     └── INSERT/UPDATE/DELETE on app.project                                 │
│                                                                              │
│  2. PostgreSQL trigger fires                                                 │
│     └── INSERT INTO app.system_logging (entity_code, entity_id, operation)  │
│     └── pg_notify('entity_changes', payload)                                │
│                                                                              │
│  3. PubSub service receives notification                                     │
│     └── Broadcasts via WebSocket to subscribed clients                      │
│                                                                              │
│  4. WebSocketManager.handleInvalidate()                                      │
│     └── invalidateEntityQueries(entityCode, entityId)                       │
│     └── queryClient marks queries as stale                                  │
│     └── (v11.0.0: No sync store updates - TanStack is single source)        │
│                                                                              │
│  5. TanStack Query auto-refetches stale queries                              │
│     └── Fresh data rendered to components                                   │
│     └── Dexie updated via persistence hooks                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Data Flow

### 5.1 App Startup (Hydration)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     HYDRATION FLOW (v11.0.0)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. CacheProvider mounts                                                     │
│                    ↓                                                         │
│  2. hydrateFromDexie() called                                               │
│                    ↓                                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Load from Dexie (IndexedDB) → TanStack Query Cache                   │   │
│  │                                                                       │   │
│  │  • globalSettings → queryClient.setQueryData(...)                    │   │
│  │  • datalabel → queryClient.setQueryData(...)                         │   │
│  │  • entityCodes → queryClient.setQueryData(...)                       │   │
│  │  • entityInstanceNames → queryClient.setQueryData(...)               │   │
│  │                                                                       │   │
│  │  (v11.0.0: No separate sync stores - TanStack Query is the cache)    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                    ↓                                                         │
│  3. App renders (isReady = true)                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Sync Accessor Usage (v11.0.0)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SYNC ACCESSOR FLOW (v11.0.0)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Formatter calls: getEntityInstanceNameSync('employee', 'uuid-james')       │
│                              │                                               │
│                              ▼                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  function getEntityInstanceNameSync(entityCode, entityInstanceId) {   │   │
│  │    const names = queryClient.getQueryData<Record<string, string>>(   │   │
│  │      QUERY_KEYS.entityInstanceNames(entityCode)                      │   │
│  │    );                                                                 │   │
│  │    return names?.[entityInstanceId] ?? null;                         │   │
│  │  }                                                                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                              │                                               │
│                              ▼                                               │
│  Returns: "James Miller"                                                     │
│                                                                              │
│  Benefits of v11.0.0 approach:                                              │
│  • Single source of truth (TanStack Query cache)                            │
│  • No duplicate data in Map-based stores                                    │
│  • Automatically stays in sync with React hooks                             │
│  • Memory savings (~50KB for typical usage)                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. API Reference

### 6.1 Public API (tanstack-index.ts)

```typescript
import {
  // ═══════════════════════════════════════════════════════════════════════════
  // REACT HOOKS
  // ═══════════════════════════════════════════════════════════════════════════

  // Session-level (prefetched at login)
  useEntityCodes,           // Entity type metadata
  useDatalabel,             // Dropdown options
  useGlobalSettings,        // App settings
  useEntityInstanceNames,   // Name resolution

  // On-demand (fetched when needed)
  useEntity,                // Single entity
  useEntityInstanceData,    // Entity list with pagination
  useEntityLinks,           // Parent-child relationships
  useDraft,                 // Form drafts with undo/redo
  useOfflineEntity,         // Offline-only access
  useOptimisticMutation,    // Dual-cache optimistic updates

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNC ACCESSORS (v11.0.0: read from queryClient.getQueryData())
  // ═══════════════════════════════════════════════════════════════════════════

  getGlobalSettingsSync,        // Get app settings
  getSettingSync,               // Get specific setting
  getDatalabelSync,             // Get datalabel options
  getEntityCodesSync,           // Get all entity types
  getEntityCodeSync,            // Get entity type by code
  getChildEntityCodesSync,      // Get child types for entity
  getEntityInstanceNameSync,    // Get entity name by UUID
  getEntityInstanceNamesForTypeSync, // Get all names for entity type
  getChildIdsSync,              // Get child IDs from link graph
  getParentsSync,               // Get parents from link graph
  getEntityInstanceMetadataSync, // Get entity metadata
  getCacheStats,                // Get cache statistics (debugging)

  // ═══════════════════════════════════════════════════════════════════════════
  // QUERY CLIENT
  // ═══════════════════════════════════════════════════════════════════════════

  queryClient,
  invalidateStore,
  invalidateEntityQueries,
  clearQueryCache,

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSISTENCE (Dexie)
  // ═══════════════════════════════════════════════════════════════════════════

  db,                       // Dexie database instance
  hydrateFromDexie,
  clearAllExceptDrafts,
  clearAllStores,

  // Granular update operations (for optimistic mutations)
  updateEntityInstanceDataItem,
  deleteEntityInstanceDataItem,
  addEntityInstanceDataItem,
  replaceEntityInstanceDataItem,

  // ═══════════════════════════════════════════════════════════════════════════
  // REAL-TIME
  // ═══════════════════════════════════════════════════════════════════════════

  wsManager,
  WS_URL,

  // ═══════════════════════════════════════════════════════════════════════════
  // PROVIDER
  // ═══════════════════════════════════════════════════════════════════════════

  TanstackCacheProvider,
  useCacheContext,
  useIsAppReady,
  useIsMetadataLoaded,
  connectWebSocket,
  disconnectWebSocket,
  prefetchAllMetadata,

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTANTS & TYPES
  // ═══════════════════════════════════════════════════════════════════════════

  STORE_STALE_TIMES,
  STORE_GC_TIMES,
  QUERY_KEYS,
  DEXIE_KEYS,

} from '@/db/tanstack-index';
```

---

## 7. Quick Reference Tables

### 7.1 Data Flow by Store Type

| Store | TanStack Query Key | Dexie Table | When Populated | Stale Time |
|-------|-------------------|-------------|----------------|------------|
| Global Settings | `globalSettings` | `globalSettings` | Login | 30 min |
| Datalabels | `['datalabel', key]` | `datalabel` | Login | 10 min |
| Entity Codes | `entityCodes` | `entityCodes` | Login | 30 min |
| Entity Instance Names | `['entityInstanceNames', code]` | `entityInstanceNames` | On API response | 10 min |
| Entity Instance Data | `['entityInstanceData', code, ...]` | `entityInstanceData` | On component mount | 5 min |
| Entity Instance Metadata | `['entityInstanceMetadata', code]` | `entityInstanceMetadata` | On component mount | 30 min |
| Entity Links | `['entityLinks', ...]` | `entityLinkForward/Reverse` | On component mount | 10 min |
| Draft | `['draft', code, id]` | `draft` | On user edit | N/A |

### 7.2 Access Patterns

| Use Case | React Component | Non-React (Formatter) |
|----------|----------------|----------------------|
| App settings | `useGlobalSettings()` | `getGlobalSettingsSync()` |
| Dropdown options | `useDatalabel(key)` | `getDatalabelSync(key)` |
| Entity metadata | `useEntityCodes()` | `getEntityCodeSync(code)` |
| UUID → Name | `useEntityInstanceNames(code)` | `getEntityInstanceNameSync(code, id)` |
| Entity data | `useEntity(code, id)` | N/A |
| Entity list | `useEntityInstanceData(code, params)` | N/A |
| Form editing | `useDraft(code, id)` | N/A |

---

## 8. Migration from v10.x to v11.0.0

### 8.1 What Changed

| v10.x | v11.0.0 |
|-------|---------|
| Sync stores (Map-based) | Removed - use queryClient.getQueryData() |
| `entityInstanceNamesStore.merge()` | `queryClient.setQueryData()` |
| `globalSettingsStore.get()` | `getGlobalSettingsSync()` |
| `clearAllSyncStores()` | Removed - clear TanStack Query cache instead |
| Dual in-memory caches | Single in-memory cache (TanStack Query) |

### 8.2 Code Migration

**Before (v10.x):**
```typescript
import { entityInstanceNamesStore } from '@/db/cache/stores';
const name = entityInstanceNamesStore.getName('employee', uuid);
```

**After (v11.0.0):**
```typescript
import { getEntityInstanceNameSync } from '@/db/cache/stores';
const name = getEntityInstanceNameSync('employee', uuid);
```

### 8.3 Benefits

1. **Single source of truth** - TanStack Query cache is the only in-memory cache
2. **No duplicate data** - Removes ~50KB of redundant cached objects
3. **Simpler hydration** - Only populate TanStack Query from Dexie
4. **No race conditions** - No sync between two caches
5. **Better DevTools** - React Query DevTools shows all cached data

---

**Version:** 4.0.0
**Last Updated:** 2025-12-02
**Status:** Implementation Complete

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-25 | Initial 4-layer normalized cache |
| 2.0.0 | 2025-11-29 | Added adapters, configuration, WebSocket |
| 3.0.0 | 2025-12-01 | Unified architecture with single entry point |
| 3.3.0 | 2025-12-01 | Dual-cache optimistic updates, granular Dexie operations |
| 4.0.0 | 2025-12-02 | **v11.0.0: Removed sync stores** - TanStack Query cache is single source of truth. Sync accessors now read from queryClient.getQueryData() instead of separate Map-based stores. |
