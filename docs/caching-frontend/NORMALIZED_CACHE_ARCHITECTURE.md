# Unified Cache Architecture

> **Version:** 3.3.0 | PMO Enterprise Platform
> **Status:** Implementation Complete
> **Date:** 2025-12-01

## Executive Summary

This document describes the **unified cache architecture** that consolidates TanStack Query, Dexie IndexedDB, and WebSocket real-time sync into a single, modular system. All cache operations are accessed through a **single public API**: `db/tanstack-index.ts`.

### Key Benefits

- **Single Entry Point** - All imports from `@/db/tanstack-index`
- **Dual-Cache Optimistic Updates** - Immediate write to both TanStack Query AND Dexie
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
│                      UNIFIED CACHE ARCHITECTURE (v3.2)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PUBLIC API: db/tanstack-index.ts                                           │
│  ════════════════════════════════                                           │
│  • Single import point for all cache operations                             │
│  • Exports hooks, stores, constants, types, utilities                       │
│  • Dual-cache optimistic mutations (TanStack + Dexie)                       │
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
│       ├── useOfflineEntity.ts # Offline-only access
│       └── useOptimisticMutation.ts # Dual-cache optimistic updates
│
├── persistence/              # PERSISTENCE LAYER
│   ├── index.ts              # Persistence exports
│   ├── schema.ts             # Dexie v5 schema (8 tables)
│   ├── hydrate.ts            # Dexie → TanStack hydration
│   └── operations.ts         # Clear, cleanup, and granular update operations
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

// ═══════════════════════════════════════════════════════════════════════════
// OPTIMISTIC MUTATION HOOK (v9.5.2 - dual-cache updates)
// ═══════════════════════════════════════════════════════════════════════════

// Optimistic mutations with dual-cache (TanStack + Dexie)
const { updateEntity, deleteEntity, isUpdating, isDeleting } = useOptimisticMutation<Project>('project');

// Update: Immediate UI + IndexedDB update, then API call
updateEntity({ entityId: projectId, changes: { name: 'New Name' } });

// Delete: Immediate removal from both caches, then API call
deleteEntity({ entityId: projectId });
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

### 3.3 Persistence Operations

```typescript
// db/persistence/operations.ts

// ═══════════════════════════════════════════════════════════════════════════
// CLEANUP OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

// Clear all data except drafts (logout)
export async function clearAllExceptDrafts(): Promise<void>;

// Clear all stores including drafts
export async function clearAllStores(): Promise<void>;

// Clear stale data (background cleanup)
export async function clearStaleData(maxAge: number): Promise<void>;

// Clear entity-specific data (for error recovery)
export async function clearEntityInstanceData(entityCode: string): Promise<void>;

// ═══════════════════════════════════════════════════════════════════════════
// GRANULAR UPDATE OPERATIONS (v9.5.2 - for optimistic mutations)
// ═══════════════════════════════════════════════════════════════════════════

// Update single item across all cached lists for an entity type
export async function updateEntityInstanceDataItem<T extends { id: string }>(
  entityCode: string,
  entityId: string,
  updater: (item: T) => T
): Promise<number>;

// Delete single item from all cached lists
export async function deleteEntityInstanceDataItem(
  entityCode: string,
  entityId: string
): Promise<number>;

// Add new item to all cached lists (prepend or append)
export async function addEntityInstanceDataItem<T extends { id: string }>(
  entityCode: string,
  newItem: T,
  prepend?: boolean  // default: true
): Promise<number>;

// Replace temp item with real item (for CREATE success)
export async function replaceEntityInstanceDataItem<T extends { id: string }>(
  entityCode: string,
  tempId: string,
  realItem: T
): Promise<number>;
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

### 4.3 Optimistic Mutation Pattern (v9.5.2)

Dual-cache optimistic updates write to both TanStack Query AND Dexie immediately during mutations.

```typescript
// db/cache/hooks/useOptimisticMutation.ts

export function useOptimisticMutation<T extends { id: string }>(entityCode: string) {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (params: { entityId: string; changes: Partial<T> }) =>
      api.patch(`/api/v1/${entityCode}/${params.entityId}`, params.changes),

    onMutate: async ({ entityId, changes }) => {
      // 1. Cancel in-flight queries
      await queryClient.cancelQueries({
        queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
      });

      // 2. Snapshot previous TanStack state (for rollback)
      const previousData = queryClient.getQueriesData({
        queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
      });

      // 3. IMMEDIATE: Update TanStack Query (in-memory) - UI updates instantly
      queryClient.setQueriesData(
        { queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode) },
        (old: EntityListResponse<T> | undefined) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((item) =>
              item.id === entityId ? { ...item, ...changes } : item
            ),
          };
        }
      );

      // 4. IMMEDIATE: Update Dexie (IndexedDB) in parallel
      updateEntityInstanceDataItem<T>(entityCode, entityId, (item) => ({
        ...item,
        ...changes,
      })).catch(() => clearEntityInstanceData(entityCode));

      return { previousData };
    },

    onError: (_err, _vars, context) => {
      // Rollback TanStack on error
      context?.previousData?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      // Clear Dexie to ensure consistency (will repopulate on next fetch)
      clearEntityInstanceData(entityCode);
    },

    onSettled: () => {
      // Refetch to get server-confirmed data
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
      });
    },
  });

  return { updateEntity: updateMutation.mutate };
}
```

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    OPTIMISTIC MUTATION FLOW (v9.5.2)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  User Action (e.g., inline edit)                                            │
│                    ↓                                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  onMutate (IMMEDIATE - before API call)                              │   │
│  │                                                                       │   │
│  │  1. Cancel in-flight queries                                         │   │
│  │  2. Snapshot TanStack state (for rollback)                           │   │
│  │  3. Update TanStack Query (in-memory) → UI renders instantly         │   │
│  │  4. Update Dexie (IndexedDB) in parallel → Survives page refresh     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                    ↓                                                         │
│  API Call: PATCH /api/v1/{entity}/{id}                                      │
│                    ↓                                                         │
│  ┌────────────────────────────────────────────────────────────┐             │
│  │  onSuccess                        │  onError               │             │
│  │  ───────────                      │  ───────               │             │
│  │  • Server confirmed               │  • Rollback TanStack   │             │
│  │  • Invalidate queries             │  • Clear Dexie         │             │
│  │  • Refetch for fresh data         │  • Refetch stale data  │             │
│  └────────────────────────────────────────────────────────────┘             │
│                                                                              │
│  Result: User sees update instantly, persists across refresh                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Benefits of Dual-Cache Optimistic Updates:**

| Scenario | TanStack Only | TanStack + Dexie |
|----------|---------------|------------------|
| User edits inline | Instant UI update | Instant UI update |
| Page refresh during API call | Shows stale data | Shows optimistic data |
| API succeeds | Refetch confirms | Refetch confirms |
| API fails | Rollback to stale | Rollback + clear Dexie |
| Offline edit | Not supported | Persists in IndexedDB |

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
│    parent_entity_code: 'project',                                           │
│    parent_entity_instance_id: projectId                                     │
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

### 5.4 Child Entity Tabs (Two-Query Architecture v9.7.0)

Child entity tabs (e.g., `/project/:id/task`) use a two-query pattern where metadata
and data are fetched separately. This is required because data endpoints return
`metadata: {}` by design.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│               CHILD ENTITY TAB - TWO-QUERY PATTERN (v9.7.0)                  │
│               Route: /project/:id/task                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  QUERY 1: Data (5-min cache)                                                │
│  ────────────────────────────                                                │
│  useEntityInstanceData('task', {                                            │
│    parent_entity_code: 'project',                                           │
│    parent_entity_instance_id: projectId                                     │
│  })                                                                          │
│                    ↓                                                         │
│  Backend: GET /api/v1/task?parent_entity_code=project&parent_entity_...     │
│                    ↓                                                         │
│  SQL: SELECT FROM task t                                                    │
│       INNER JOIN entity_instance_link eil ON ...                            │
│       WHERE eil.entity_code = 'project'                                     │
│         AND eil.entity_instance_id = :projectId                             │
│                    ↓                                                         │
│  Returns: { data: [...tasks], ref_data_entityInstance: {...}, metadata: {} }│
│                                                                              │
│                                                                              │
│  QUERY 2: Metadata (30-min cache)                                           │
│  ─────────────────────────────────                                           │
│  useEntityInstanceMetadata('task', 'entityListOfInstancesTable')            │
│                    ↓                                                         │
│  Backend: GET /api/v1/task?content=metadata                                 │
│                    ↓                                                         │
│  Returns: { fields: [...], metadata: { viewType: {...}, editType: {...} } } │
│                                                                              │
│                                                                              │
│  PAGE COMBINES:                                                              │
│  ─────────────                                                               │
│  childData (from Query 1) + childMetadata (from Query 2)                    │
│                    ↓                                                         │
│  <EntityListOfInstancesTable                                                 │
│    data={childDisplayData}                                                   │
│    metadata={childMetadata}       ← From separate metadata query            │
│    ref_data_entityInstance={childRefData}                                   │
│    loading={childLoading || childMetadataLoading}                           │
│  />                                                                          │
│                                                                              │
│  KEY POINTS:                                                                 │
│  ───────────                                                                 │
│  • Metadata is entity-TYPE level (same for all tasks, regardless of parent) │
│  • Data is filtered by parent context (different for each parent)           │
│  • Different cache lifetimes: metadata 30-min, data 5-min                   │
│  • Data endpoint returns metadata: {} by design - must fetch separately     │
│  • TanStack Query cache keys differ: data includes parent params            │
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
  useOptimisticMutation,    // Dual-cache optimistic updates (v9.5.2)

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
  clearEntityInstanceData,  // Clear entity-specific data

  // Granular update operations (v9.5.2 - for optimistic mutations)
  updateEntityInstanceDataItem,  // Update single item in all cached lists
  deleteEntityInstanceDataItem,  // Remove single item from all cached lists
  addEntityInstanceDataItem,     // Add new item to all cached lists
  replaceEntityInstanceDataItem, // Replace temp item with real item

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

### 7.3 Optimistic Mutations (v9.5.2)

```typescript
import { useOptimisticMutation } from '@/db/tanstack-index';

function ProjectTable() {
  const { updateEntity, deleteEntity, isUpdating } = useOptimisticMutation<Project>('project');

  const handleInlineEdit = (projectId: string, field: string, value: any) => {
    // Instantly updates both TanStack (UI) and Dexie (IndexedDB)
    // Then calls API in background
    updateEntity({
      entityId: projectId,
      changes: { [field]: value },
    });
  };

  const handleDelete = (projectId: string) => {
    // Instantly removes from both caches
    // Then calls API in background
    deleteEntity({ entityId: projectId });
  };

  return (
    <table>
      {projects.map((project) => (
        <tr key={project.id}>
          <td>
            <InlineEdit
              value={project.name}
              onSave={(value) => handleInlineEdit(project.id, 'name', value)}
            />
          </td>
          <td>
            <button onClick={() => handleDelete(project.id)}>Delete</button>
          </td>
        </tr>
      ))}
    </table>
  );
}
```

### 7.4 Draft Persistence with Undo/Redo

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

## 8. Quick Reference Tables

### 8.1 Store Types & Data Flow

| Store                          | Type      | TanStack Query Key                      | Dexie Table                             | Hydration Source              | API Endpoint                           |
|--------------------------------|-----------|-----------------------------------------|-----------------------------------------|-------------------------------|----------------------------------------|
| `globalSettingsStore`          | Session   | `globalSettings`                        | `globalSettings`                        | Dexie → TanStack at app start | `GET /api/v1/settings`                 |
| `datalabelStore`               | Session   | `['datalabel', key]`                    | `datalabel`                             | Dexie → TanStack at app start | `GET /api/v1/datalabel/{key}`          |
| `entityCodesStore`             | Session   | `entityCodes`                           | `entityCodes`                           | Dexie → TanStack at app start | `GET /api/v1/entity/types`             |
| `entityInstanceNamesStore`     | Session   | `['entityInstanceNames', code]`         | `entityInstanceNames`                   | Dexie → TanStack at app start | `GET /api/v1/entity-instance/names`    |
| `entityLinksStore`             | On-Demand | `['entityLinks', parent, id]`           | `entityLinkForward`, `entityLinkReverse`| API on first access           | `GET /api/v1/entity-instance-link`     |
| `entityInstanceMetadataStore`  | On-Demand | `['entityInstanceMetadata', code]`      | `entityInstanceMetadata`                | API on first access           | `GET /api/v1/{entity}?content=metadata`|
| `entityInstance` (no store)    | On-Demand | `['entity', code, id]`                  | `entityInstanceData`                    | API on component mount        | `GET /api/v1/{entity}/{id}`            |
| `entityInstanceData` (no store)| On-Demand | `['entityInstanceData', code, params]`  | `entityInstanceData`                    | API on component mount        | `GET /api/v1/{entity}`                 |
| `draft` (no store)             | User Data | `['draft', code, id]`                   | `draft`                                 | Dexie only (never API)        | N/A (local only)                       |

### 8.2 Lifecycle & Timing

| Store                          | When Hydrated       | When API Called              | Stale Time | Persist TTL |
|--------------------------------|---------------------|------------------------------|------------|-------------|
| `globalSettingsStore`          | App startup         | Login (`prefetchAllMetadata`)| 30 min     | 24 hours    |
| `datalabelStore`               | App startup         | Login (`prefetchAllMetadata`)| 10 min     | 24 hours    |
| `entityCodesStore`             | App startup         | Login (`prefetchAllMetadata`)| 30 min     | 24 hours    |
| `entityInstanceNamesStore`     | App startup         | Login (`prefetchAllMetadata`)| 10 min     | 24 hours    |
| `entityLinksStore`             | Never (on-demand)   | Component mounts             | 10 min     | 24 hours    |
| `entityInstanceMetadataStore`  | Never (on-demand)   | Component mounts             | 30 min     | 24 hours    |
| `entityInstance`               | Never (on-demand)   | Component mounts             | 5 min      | 24 hours    |
| `entityInstanceData`           | Never (on-demand)   | Component mounts             | 5 min      | 24 hours    |
| `draft`                        | App startup         | Never                        | N/A        | Until saved |

### 8.3 Access Patterns

| Store                          | React Hook                                                  | Sync Function (non-React)                                                              | Use Case                       |
|--------------------------------|-------------------------------------------------------------|----------------------------------------------------------------------------------------|--------------------------------|
| `globalSettingsStore`          | `useGlobalSettings()`                                       | `getGlobalSettingsSync()`                                                              | App configuration              |
| `datalabelStore`               | `useDatalabel(key)`                                         | `getDatalabelSync(key)`                                                                | Dropdown options, badge colors |
| `entityCodesStore`             | `useEntityCodes()`                                          | `getEntityCodeSync(code)`, `getEntityCodesSync()`, `getChildEntityCodesSync(code)`     | Navigation, child tabs         |
| `entityInstanceNamesStore`     | `useEntityInstanceNames(code)`                              | `getEntityInstanceNameSync(code, id)`, `getEntityInstanceNamesForTypeSync(code)`       | UUID → display name            |
| `entityLinksStore`             | `useEntityLinks(parent, id)`                                | `getChildIdsSync(parent, parentId, child)`, `getParentsSync(child, childId)`           | Parent-child navigation        |
| `entityInstanceMetadataStore`  | `useEntityMetadata(code)`                                   | N/A                                                                                    | Field metadata for forms/tables|
| `entityInstance`               | `useEntity(code, id)`                                       | N/A                                                                                    | Single entity detail view      |
| `entityInstanceData`           | `useEntityInstanceData(code, params)`                       | N/A                                                                                    | Entity list views              |
| `draft`                        | `useDraft(code, id)`                                        | N/A                                                                                    | Form editing with undo/redo    |

### 8.4 Cache Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CACHE DATA FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  APP STARTUP                           LOGIN                                 │
│  ──────────                            ─────                                 │
│  1. TanstackCacheProvider mounts       1. prefetchAllMetadata()              │
│  2. hydrateFromDexie()                 2. Parallel API calls:                │
│     ↓                                     • /api/v1/entity/types             │
│  Dexie → Sync Stores → TanStack           • /api/v1/datalabel/all           │
│                                           • /api/v1/settings                 │
│                                           • /api/v1/entity-instance/names    │
│                                        3. Update Sync Stores + Dexie         │
│                                                                              │
│  COMPONENT MOUNT (On-Demand)           WEBSOCKET INVALIDATE                  │
│  ───────────────────────────           ────────────────────                  │
│  1. useEntityInstanceData('task')      1. wsManager receives INVALIDATE      │
│  2. Check TanStack cache               2. invalidateEntityQueries()          │
│  3. If STALE/MISS → API call           3. TanStack marks queries stale       │
│  4. Update TanStack + Dexie            4. Active components auto-refetch     │
│  5. Update entityInstanceNamesStore    5. Dexie updated in background        │
│     from ref_data_entityInstance                                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Performance Benefits

| Metric | Without Cache | With Cache |
|--------|---------------|------------|
| API calls per navigation | 1+ | 0 (cache hit) |
| Tab count calculation | API call | O(1) from index |
| Name resolution | Per-row lookup | O(1) from cache |
| Offline support | None | Full entity graph |
| Bundle size | N/A | ~25KB (TanStack + Dexie) |
| Memory for 100 entities | 100 × N duplicates | 100 entries + link indexes |

---

## 10. Implementation Notes

### 10.1 Public API Import

```typescript
// All cache operations from single entry point
import {
  // Hooks
  useEntityCodes,
  useEntity,
  useEntityInstanceData,
  useDatalabel,
  useOptimisticMutation,
  useDraft,

  // Sync access (outside React)
  getEntityCodeSync,
  getDatalabelSync,
  getEntityInstanceNameSync,

  // Query client
  queryClient,
  invalidateEntityQueries,

  // Persistence operations
  updateEntityInstanceDataItem,
  deleteEntityInstanceDataItem,
  addEntityInstanceDataItem,
  clearEntityInstanceData,
} from '@/db/tanstack-index';
```

### 10.2 Architecture Decisions

- **Single entry point** - All imports from `@/db/tanstack-index`
- **Unified query keys** - `QUERY_KEYS` and `DEXIE_KEYS` for consistency
- **Dual-cache optimistic mutations** - Write to both TanStack and Dexie immediately
- **Granular Dexie updates** - Item-level operations instead of full cache clears
- **Error recovery** - Falls back to clearing Dexie on update failures

### 10.3 Design Principles

- **TanStack Query** for server state management (in-memory, auto-refetch)
- **Dexie (IndexedDB)** for persistence (offline-first, survives refresh)
- **WebSocket** for real-time cache invalidation
- **Sync stores** for O(1) access outside React components

---

**Version:** 3.3.0
**Last Updated:** 2025-12-01
**Status:** Implementation Complete

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-25 | Initial 4-layer normalized cache |
| 2.0.0 | 2025-11-29 | Added adapters, configuration, WebSocket |
| 3.0.0 | 2025-12-01 | Unified architecture with single entry point |
| 3.1.0 | 2025-12-01 | Added quick reference tables (stores, lifecycle, access patterns) |
| 3.2.0 | 2025-12-01 | **Dual-cache optimistic updates (v9.5.2)**: Write to both TanStack Query AND Dexie immediately during mutations. Added granular Dexie operations: `updateEntityInstanceDataItem`, `deleteEntityInstanceDataItem`, `addEntityInstanceDataItem`, `replaceEntityInstanceDataItem`. Removed legacy references. |
| 3.3.0 | 2025-12-01 | **Child entity tabs two-query pattern (v9.7.0)**: Added section 5.4 documenting how child entity tabs use separate queries for data (with `parent_entity_code`/`parent_entity_instance_id` params) and metadata (`content=metadata`). Data endpoints return `metadata: {}` by design - metadata must be fetched separately. |
