# Unified Cache Architecture

> **Version:** 3.0.0 | PMO Enterprise Platform
> **Status:** Implementation Complete
> **Date:** 2025-12-01

## Executive Summary

This document describes the **unified cache architecture** that consolidates TanStack Query, Dexie IndexedDB, and WebSocket real-time sync into a single, modular system. All cache operations are accessed through a **single public API**: `db/tanstack-index.ts`.

### Key Benefits

- **Single Entry Point** - All imports from `@/db/tanstack-index`
- **Zero redundant API calls** - Filtered queries derive from cached graph
- **Instant parent-child navigation** - Link graph enables O(1) lookups
- **Single source of truth** - Each entity stored once, referenced everywhere
- **Offline-first** - Full entity graph persisted in IndexedDB (Dexie)
- **Real-time sync** - WebSocket-based cache invalidation

---

## 1. Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      UNIFIED CACHE ARCHITECTURE (v3.0)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PUBLIC API: db/tanstack-index.ts                                           │
│  ════════════════════════════════                                           │
│  • Single import point for all cache operations                             │
│  • Exports hooks, stores, constants, types, utilities                       │
│  • Backward-compatible legacy aliases                                        │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         THREE LAYERS                                     ││
│  ├────────────────────┬────────────────────┬───────────────────────────────┤│
│  │   CACHE LAYER      │  PERSISTENCE LAYER │  REAL-TIME LAYER              ││
│  │   (db/cache/)      │  (db/persistence/) │  (db/realtime/)               ││
│  │                    │                    │                               ││
│  │   • TanStack Query │  • Dexie v5        │  • WebSocket Manager          ││
│  │   • Sync Stores    │  • IndexedDB       │  • Cache Invalidation         ││
│  │   • React Hooks    │  • Hydration       │  • Real-time Sync             ││
│  └────────────────────┴────────────────────┴───────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
apps/web/src/db/
├── tanstack-index.ts         # PUBLIC API - single entry point
├── TanstackCacheProvider.tsx # React context provider
├── index.ts                  # Module exports
│
├── cache/                    # CACHE LAYER
│   ├── index.ts              # Cache exports
│   ├── client.ts             # TanStack Query client
│   ├── constants.ts          # Stale times, GC times, TTLs
│   ├── keys.ts               # Query keys, Dexie keys
│   ├── stores.ts             # In-memory sync stores
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
│       └── useOfflineEntity.ts # Offline-only access
│
├── persistence/              # PERSISTENCE LAYER
│   ├── index.ts              # Persistence exports
│   ├── schema.ts             # Dexie v5 schema (8 tables)
│   ├── hydrate.ts            # Dexie → TanStack hydration
│   └── operations.ts         # Clear/cleanup operations
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
      ? [QUERY_KEYS.ENTITY_INSTANCE_DATA, entityCode, entityId]
      : [QUERY_KEYS.ENTITY_INSTANCE_DATA, entityCode],
  });
}
```

### 2.2 Sync Stores (In-Memory Cache)

Sync stores provide O(1) access to cached data outside React components (formatters, utilities).

```typescript
// db/cache/stores.ts

// ═══════════════════════════════════════════════════════════════════════════
// STORE DECLARATIONS
// ═══════════════════════════════════════════════════════════════════════════

// Session-level stores (prefetched at login)
export const globalSettingsStore: GlobalSettings | null = null;
export const datalabelStore: Map<string, DatalabelOption[]> = new Map();
export const entityCodesStore: Map<string, EntityCode> = new Map();
export const entityInstanceNamesStore: Map<string, Map<string, string>> = new Map();

// On-demand stores (populated as data is fetched)
export const entityLinksStore = {
  forward: new Map<string, string[]>(),  // parent:child → [childIds]
  reverse: new Map<string, Array<{...}>>(),
};
export const entityInstanceMetadataStore: Map<string, EntityInstanceMetadata> = new Map();

// ═══════════════════════════════════════════════════════════════════════════
// SYNC ACCESS FUNCTIONS (for formatters/utilities - outside React)
// ═══════════════════════════════════════════════════════════════════════════

export function getEntityCodeSync(code: string): EntityCode | null;
export function getEntityCodesSync(): EntityCode[];
export function getChildEntityCodesSync(parentCode: string): string[];
export function getDatalabelSync(key: string): DatalabelOption[] | null;
export function getGlobalSettingsSync(): GlobalSettings | null;
export function getEntityInstanceNameSync(entityCode: string, id: string): string | null;
export function getEntityInstanceNamesForTypeSync(entityCode: string): Map<string, string>;
export function getChildIdsSync(parentCode: string, parentId: string, childCode: string): string[];
export function getParentsSync(childCode: string, childId: string): ParentInfo[];
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
const taskIds = links?.filter(l => l.child_entity_code === 'task').map(l => l.child_entity_instance_id);

// Draft persistence (undo/redo, survives page refresh)
const { data: draft, updateField, undo, redo, hasChanges, save, discard } = useDraft('project', projectId);

// Offline-only access
const { data, isStale } = useOfflineEntity<Project>('project', projectId);
```

### 2.4 Query Keys

Centralized key management for cache consistency.

```typescript
// db/cache/keys.ts

export const QUERY_KEYS = {
  // Session-level
  GLOBAL_SETTINGS: 'globalSettings',
  DATALABEL: 'datalabel',
  ENTITY_CODES: 'entityCodes',
  ENTITY_INSTANCE_NAMES: 'entityInstanceNames',

  // On-demand
  ENTITY_INSTANCE_DATA: 'entityInstanceData',
  ENTITY_INSTANCE_METADATA: 'entityInstanceMetadata',
  ENTITY_LINKS: 'entityLinks',
  DRAFT: 'draft',
} as const;

export const DEXIE_KEYS = {
  GLOBAL_SETTINGS: 'globalSettings',
  DATALABEL: 'datalabel',
  ENTITY_CODES: 'entityCodes',
  ENTITY_INSTANCE_NAMES: 'entityInstanceNames',
  ENTITY_INSTANCE_DATA: 'entityInstanceData',
  ENTITY_INSTANCE_METADATA: 'entityInstanceMetadata',
  ENTITY_LINK_FORWARD: 'entityLinkForward',
  ENTITY_LINK_REVERSE: 'entityLinkReverse',
  DRAFT: 'draft',
} as const;

// Query hash for entity instance data
export function createQueryHash(entityCode: string, params: Record<string, any>): string;
```

### 2.5 Constants

Configurable stale times and TTLs.

```typescript
// db/cache/constants.ts

export const STORE_STALE_TIMES = {
  globalSettings: 30 * 60 * 1000,  // 30 minutes
  datalabel: 10 * 60 * 1000,       // 10 minutes
  entityCodes: 30 * 60 * 1000,     // 30 minutes
  entityInstanceNames: 10 * 60 * 1000,
  entityInstanceData: 5 * 60 * 1000, // 5 minutes
  entityLinks: 10 * 60 * 1000,
};

export const STORE_GC_TIMES = {
  default: 10 * 60 * 1000,  // 10 minutes
};

export const STORE_PERSIST_TTL = {
  default: 24 * 60 * 60 * 1000,  // 24 hours
};

// Session stores: prefetched at login
export const SESSION_STORE_CONFIG = {
  staleTime: STORE_STALE_TIMES.datalabel,
  gcTime: STORE_GC_TIMES.default,
};

// On-demand stores: fetched when needed
export const ONDEMAND_STORE_CONFIG = {
  staleTime: STORE_STALE_TIMES.entityInstanceData,
  gcTime: STORE_GC_TIMES.default,
};
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
  globalSettings: 'id',                                    // Single record
  datalabel: 'key',                                        // dl__project_stage
  entityCodes: 'code',                                     // entity type metadata
  entityInstanceNames: '[entityCode+entityId]',            // name resolution

  // On-demand stores
  entityInstanceData: 'hash, entityCode',                  // list data cache
  entityInstanceMetadata: 'entityCode',                    // field metadata

  // Relationship stores
  entityLinkForward: '[parentCode+parentId+childCode]',    // parent → children
  entityLinkReverse: '[childCode+childId]',                // child → parents

  // User data
  draft: '[entityCode+entityId]',                          // form drafts
});

// Type-safe table accessors
export interface GlobalSettingsRecord { id: string; data: GlobalSettings; updatedAt: number; }
export interface DatalabelRecord { key: string; options: DatalabelOption[]; updatedAt: number; }
export interface EntityCodesRecord { code: string; data: EntityCode; updatedAt: number; }
export interface EntityInstanceNameRecord { entityCode: string; entityId: string; name: string; }
export interface EntityInstanceDataRecord { hash: string; entityCode: string; data: any[]; total: number; updatedAt: number; }
export interface EntityInstanceMetadataRecord { entityCode: string; metadata: any; updatedAt: number; }
export interface EntityLinkForwardRecord { parentCode: string; parentId: string; childCode: string; childIds: string[]; }
export interface EntityLinkReverseRecord { childCode: string; childId: string; parents: ParentInfo[]; }
export interface DraftRecord { entityCode: string; entityId: string; data: any; history: any[]; historyIndex: number; }
```

### 3.2 Hydration

Load from Dexie into TanStack Query on app startup.

```typescript
// db/persistence/hydrate.ts

export async function hydrateFromDexie(): Promise<void> {
  // Load session-level data from IndexedDB
  const [settings, datalabels, codes, names] = await Promise.all([
    db.globalSettings.toArray(),
    db.datalabel.toArray(),
    db.entityCodes.toArray(),
    db.entityInstanceNames.toArray(),
  ]);

  // Populate sync stores
  if (settings[0]) globalSettingsStore = settings[0].data;

  datalabels.forEach(d => datalabelStore.set(d.key, d.options));
  codes.forEach(c => entityCodesStore.set(c.code, c.data));

  // Group entity names by entity code
  const namesByEntity = new Map<string, Map<string, string>>();
  names.forEach(n => {
    if (!namesByEntity.has(n.entityCode)) {
      namesByEntity.set(n.entityCode, new Map());
    }
    namesByEntity.get(n.entityCode)!.set(n.entityId, n.name);
  });
  namesByEntity.forEach((names, code) => entityInstanceNamesStore.set(code, names));

  // Hydrate TanStack Query cache
  queryClient.setQueryData([QUERY_KEYS.GLOBAL_SETTINGS], settings[0]?.data);
  datalabels.forEach(d => queryClient.setQueryData([QUERY_KEYS.DATALABEL, d.key], d.options));
  queryClient.setQueryData([QUERY_KEYS.ENTITY_CODES], Array.from(entityCodesStore.values()));
}

// Persist individual stores to Dexie
export async function persistToGlobalSettings(data: GlobalSettings): Promise<void>;
export async function persistToDatalabel(key: string, options: DatalabelOption[]): Promise<void>;
export async function persistToEntityCodes(codes: EntityCode[]): Promise<void>;
export async function persistToEntityInstanceNames(entityCode: string, names: Map<string, string>): Promise<void>;
export async function persistToEntityInstanceData(hash: string, entityCode: string, data: any[], total: number): Promise<void>;
```

### 3.3 Cleanup Operations

```typescript
// db/persistence/operations.ts

// Clear all data except drafts (logout)
export async function clearAllExceptDrafts(): Promise<void>;

// Clear all stores including drafts
export async function clearAllStores(): Promise<void>;

// Clear stale data (background cleanup)
export async function clearStaleData(maxAge: number): Promise<void>;
```

---

## 4. Real-time Layer (db/realtime/)

### 4.1 WebSocket Manager

Connects to PubSub service for cache invalidation.

```typescript
// db/realtime/manager.ts

export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4001';

export const wsManager = {
  socket: null as WebSocket | null,
  isConnected: false,
  reconnectAttempts: 0,

  connect(token: string): void {
    this.socket = new WebSocket(`${WS_URL}?token=${token}`);

    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'INVALIDATE') {
        this.handleInvalidate(message.payload);
      }
    };
  },

  handleInvalidate(payload: InvalidatePayload): void {
    const { entityCode, entityId, action } = payload;

    // Invalidate TanStack Query cache
    if (entityId) {
      invalidateEntityQueries(entityCode, entityId);
    } else {
      invalidateEntityQueries(entityCode);
    }

    // Update sync stores
    if (action === 'DELETE' && entityId) {
      entityInstanceNamesStore.get(entityCode)?.delete(entityId);
    }
  },

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
    this.isConnected = false;
  },
};
```

### 4.2 Invalidation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REAL-TIME INVALIDATION FLOW                               │
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
│     └── Update sync stores                                                  │
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
│                           HYDRATION FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. TanstackCacheProvider mounts                                            │
│                    ↓                                                         │
│  2. hydrateFromDexie() called                                               │
│                    ↓                                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Load from Dexie (IndexedDB) → Sync Stores → TanStack Query Cache    │   │
│  │                                                                       │   │
│  │  • globalSettings → globalSettingsStore → queryClient                │   │
│  │  • datalabel → datalabelStore → queryClient                          │   │
│  │  • entityCodes → entityCodesStore → queryClient                      │   │
│  │  • entityInstanceNames → entityInstanceNamesStore                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                    ↓                                                         │
│  3. App renders (isReady = true)                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Login (Prefetch Session Data)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PREFETCH FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. User authenticates                                                       │
│                    ↓                                                         │
│  2. connectWebSocket(token)                                                  │
│     └── Connect to PubSub (port 4001)                                       │
│                    ↓                                                         │
│  3. prefetchAllMetadata()                                                    │
│                    ↓                                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Parallel API Fetches:                                                │   │
│  │                                                                       │   │
│  │  • GET /api/v1/entity/types → entityCodesStore + Dexie               │   │
│  │  • GET /api/v1/datalabel/all → datalabelStore + Dexie                │   │
│  │  • GET /api/v1/settings → globalSettingsStore + Dexie                │   │
│  │  • GET /api/v1/entity-instance/names → entityInstanceNamesStore      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                    ↓                                                         │
│  4. Session data ready (isMetadataLoaded = true)                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Component Mounts (On-Demand Data)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ON-DEMAND DATA FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Component: useEntityInstanceData('task', {                                 │
│    parentEntityCode: 'project',                                             │
│    parentEntityInstanceId: projectId                                        │
│  })                                                                          │
│                    ↓                                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  1. Check TanStack Query Cache                                        │   │
│  │     └── queryClient.getQueryData(['entityInstanceData', 'task', ...]) │   │
│  │                                                                       │   │
│  │  2. If STALE or MISS:                                                 │   │
│  │     └── Fetch from API: GET /api/v1/task?parent_entity_code=project  │   │
│  │     └── Update queryClient cache                                      │   │
│  │     └── Persist to Dexie (background)                                 │   │
│  │     └── Update entityInstanceNamesStore from ref_data                 │   │
│  │                                                                       │   │
│  │  3. Return data to component                                          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
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

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNC ACCESS (for formatters/utilities - outside React)
  // ═══════════════════════════════════════════════════════════════════════════

  getEntityCodeSync,        // Get entity type by code
  getEntityCodesSync,       // Get all entity types
  getChildEntityCodesSync,  // Get child types for entity
  getDatalabelSync,         // Get datalabel options
  getGlobalSettingsSync,    // Get app settings
  getEntityInstanceNameSync,// Get entity name by UUID
  getChildIdsSync,          // Get child IDs from link graph

  // ═══════════════════════════════════════════════════════════════════════════
  // STORES
  // ═══════════════════════════════════════════════════════════════════════════

  globalSettingsStore,
  datalabelStore,
  entityCodesStore,
  entityInstanceNamesStore,
  entityLinksStore,
  entityInstanceMetadataStore,
  clearAllSyncStores,
  getSyncStoreStats,

  // ═══════════════════════════════════════════════════════════════════════════
  // QUERY CLIENT
  // ═══════════════════════════════════════════════════════════════════════════

  queryClient,
  invalidateStore,
  invalidateEntityQueries,

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSISTENCE (Dexie)
  // ═══════════════════════════════════════════════════════════════════════════

  db,                       // Dexie database instance
  hydrateFromDexie,
  clearAllExceptDrafts,
  clearAllStores,
  clearStaleData,

  // ═══════════════════════════════════════════════════════════════════════════
  // REAL-TIME
  // ═══════════════════════════════════════════════════════════════════════════

  wsManager,
  WS_URL,
  WS_RECONNECT_DELAY,

  // ═══════════════════════════════════════════════════════════════════════════
  // PROVIDER
  // ═══════════════════════════════════════════════════════════════════════════

  TanstackCacheProvider,
  useCacheContext,
  useSyncStatus,
  useIsAppReady,
  useIsMetadataLoaded,
  connectWebSocket,
  disconnectWebSocket,
  prefetchAllMetadata,

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTANTS
  // ═══════════════════════════════════════════════════════════════════════════

  STORE_STALE_TIMES,
  STORE_GC_TIMES,
  STORE_PERSIST_TTL,
  SESSION_STORE_CONFIG,
  ONDEMAND_STORE_CONFIG,

  // ═══════════════════════════════════════════════════════════════════════════
  // KEYS
  // ═══════════════════════════════════════════════════════════════════════════

  QUERY_KEYS,
  DEXIE_KEYS,
  createQueryHash,

  // ═══════════════════════════════════════════════════════════════════════════
  // TYPES
  // ═══════════════════════════════════════════════════════════════════════════

} from '@/db/tanstack-index';

// Type exports
export type {
  GlobalSettings,
  DatalabelOption,
  EntityCode,
  EntityInstance,
  EntityInstanceMetadata,
  EntityLink,
  Draft,
  EntityListResponse,
} from '@/db/tanstack-index';
```

---

## 7. Usage Examples

### 7.1 Basic Usage in Components

```typescript
import {
  useEntityCodes,
  useEntityInstanceData,
  useDatalabel,
} from '@/db/tanstack-index';

function ProjectList() {
  const { data: entityCodes } = useEntityCodes();
  const projectEntity = entityCodes?.find(e => e.code === 'project');

  const { data: projects, total, isLoading } = useEntityInstanceData<Project>('project', {
    limit: 20,
    offset: 0,
  });

  const { data: stageOptions } = useDatalabel('project_stage');

  if (isLoading) return <Spinner />;

  return (
    <div>
      <h1>{projectEntity?.ui_label}</h1>
      <table>
        {projects?.map(project => (
          <tr key={project.id}>
            <td>{project.name}</td>
            <td>
              <Badge color={stageOptions?.find(o => o.code === project.dl__project_stage)?.color}>
                {project.dl__project_stage}
              </Badge>
            </td>
          </tr>
        ))}
      </table>
    </div>
  );
}
```

### 7.2 Sync Access in Formatters

```typescript
import {
  getEntityInstanceNameSync,
  getDatalabelSync,
} from '@/db/tanstack-index';

// Used in table cell formatters, value formatters, etc.
function formatManagerName(managerId: string): string {
  return getEntityInstanceNameSync('employee', managerId) || 'Unknown';
}

function formatProjectStage(stageCode: string): { label: string; color: string } {
  const options = getDatalabelSync('project_stage');
  const option = options?.find(o => o.code === stageCode);
  return {
    label: option?.label || stageCode,
    color: option?.color || '#gray',
  };
}
```

### 7.3 Draft Persistence with Undo/Redo

```typescript
import { useDraft } from '@/db/tanstack-index';

function ProjectForm({ projectId }: { projectId: string }) {
  const {
    data: draft,
    updateField,
    undo,
    redo,
    canUndo,
    canRedo,
    hasChanges,
    save,
    discard,
  } = useDraft('project', projectId);

  return (
    <form onSubmit={save}>
      <input
        value={draft?.name || ''}
        onChange={(e) => updateField('name', e.target.value)}
      />

      <div>
        <button type="button" onClick={undo} disabled={!canUndo}>Undo</button>
        <button type="button" onClick={redo} disabled={!canRedo}>Redo</button>
      </div>

      <div>
        <button type="button" onClick={discard} disabled={!hasChanges}>Discard</button>
        <button type="submit" disabled={!hasChanges}>Save</button>
      </div>
    </form>
  );
}
```

---

## 8. Benefits Summary

| Metric | Without Cache | With Cache |
|--------|---------------|------------|
| API calls per navigation | 1+ | 0 (cache hit) |
| Tab count calculation | API call | O(1) from index |
| Name resolution | Per-row lookup | O(1) from cache |
| Offline support | None | Full entity graph |
| Bundle size | N/A | ~25KB (TanStack + Dexie) |
| Memory for 100 entities | 100 × N duplicates | 100 entries + link indexes |

---

## 9. Migration from Previous Architecture

### 9.1 Import Changes

```typescript
// OLD (v2.0 - deleted directories)
import { useEntityCodes } from '@/db/normalized-cache';
import { useEntity } from '@/db/tanstack-hooks';
import { queryClient } from '@/db/query/queryClient';

// NEW (v3.0 - unified)
import {
  useEntityCodes,
  useEntity,
  queryClient,
} from '@/db/tanstack-index';
```

### 9.2 Removed Features

- `CacheConfigProvider` - Cache is always enabled
- `useCacheConfig` - No runtime cache configuration
- Adapter pattern - Single implementation
- `normalized-cache/` directory - Consolidated into `cache/`
- `tanstack-hooks/` directory - Consolidated into `cache/hooks/`

### 9.3 New Features

- Single public API entry point
- Unified query keys (`QUERY_KEYS`, `DEXIE_KEYS`)
- Consolidated hook structure
- Improved type safety
- Legacy aliases for backward compatibility

---

**Version:** 3.0.0
**Last Updated:** 2025-12-01
**Status:** Implementation Complete

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-25 | Initial 4-layer normalized cache |
| 2.0.0 | 2025-11-29 | Added adapters, configuration, WebSocket |
| 3.0.0 | 2025-12-01 | Unified architecture with single entry point |
