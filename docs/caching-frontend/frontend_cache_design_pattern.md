# Frontend Cache Design Pattern

**Version:** 13.0.0 | **Updated:** 2025-12-07 | **Status:** Production

---

## Overview

This document consolidates all frontend caching architecture into a single source of truth. It describes the **Hydration Gate Pattern**, TanStack Query + Dexie architecture, TTL configuration, prefetch strategies, sync accessors, and component interaction patterns.

### Architecture Summary

```
+-----------------------------------------------------------------------------+
|                   FRONTEND CACHE ARCHITECTURE (v13.0.0)                      |
+-----------------------------------------------------------------------------+
|                                                                              |
|  1. HYDRATION GATE (v13.0.0)                                                |
|     - Blocks rendering until ALL session metadata is loaded                 |
|     - Guarantees getDatalabelSync() returns data (never null)               |
|     - Eliminates race conditions with unformatted data                      |
|                                                                              |
|  2. TANSTACK QUERY (In-Memory - SINGLE SOURCE OF TRUTH)                     |
|     - Server state management                                               |
|     - Automatic background refetch                                          |
|     - Stale-while-revalidate                                                |
|     - Sync accessor reads (getQueryData)                                    |
|                                                                              |
|  3. DEXIE (IndexedDB)                                                       |
|     - Persistent storage                                                    |
|     - Survives browser restart                                              |
|     - Offline-first access                                                  |
|     - Hydrates TanStack on startup                                          |
|                                                                              |
|  4. WEBSOCKET MANAGER (port 4001)                                           |
|     - Receives INVALIDATE messages from PubSub                              |
|     - Triggers queryClient.invalidateQueries()                              |
|     - TanStack Query auto-refetches -> Updates Dexie                        |
|                                                                              |
+-----------------------------------------------------------------------------+
```

### Key Benefits

| Feature | Benefit |
|---------|---------|
| **Hydration Gate** | Formatters GUARANTEED to have data - no null checks needed |
| **Single Entry Point** | All imports from `@/db/tanstack-index` |
| **Single In-Memory Cache** | TanStack Query only (no duplicate sync stores) |
| **Dual-Cache Optimistic Updates** | Immediate write to both TanStack Query AND Dexie |
| **Offline-First** | Full entity graph persisted in IndexedDB |
| **Real-Time Sync** | WebSocket-based cache invalidation |

---

## 1. Hydration Gate Pattern (v13.0.0)

### 1.1 Problem Statement

```
+-----------------------------------------------------------------------------+
|                    THE RACE CONDITION PROBLEM                                |
+-----------------------------------------------------------------------------+
|                                                                              |
|  BEFORE v13.0.0: Race Condition with Sync Accessors                         |
|                                                                              |
|  Timeline:                                                                   |
|  1. User logs in -> AuthContext starts prefetch                             |
|  2. App renders routes IMMEDIATELY (isReady = isHydrated)                   |
|  3. Component calls formatBadge() -> getDatalabelSync() -> NULL             |
|  4. Badge renders with gray default (BROKEN UI)                             |
|  5. Prefetch completes -> cache populated (TOO LATE)                        |
|                                                                              |
|  SYMPTOMS:                                                                   |
|  - Badges showing gray instead of colored                                   |
|  - Entity reference fields showing "uuid..." instead of names               |
|  - Dropdowns empty on first render                                          |
|  - UI "flashes" with unformatted data then corrects                        |
|                                                                              |
+-----------------------------------------------------------------------------+
```

### 1.2 Solution: Hydration Gate

```
+-----------------------------------------------------------------------------+
|                    HYDRATION GATE PATTERN (v13.0.0)                          |
+-----------------------------------------------------------------------------+
|                                                                              |
|  CONCEPT: Block rendering until ALL session metadata is loaded              |
|  Industry Examples: Linear, Notion, Vercel Dashboard                        |
|                                                                              |
|  FLOW:                                                                       |
|  1. User logs in                                                            |
|  2. AuthContext starts prefetch                                             |
|  3. ProtectedRoute wraps children in <MetadataGate>                         |
|  4. MetadataGate shows loading screen until isMetadataLoaded = true         |
|  5. AuthContext calls setMetadataLoaded(true) after ALL prefetch complete   |
|  6. Gate opens -> children render -> formatters have GUARANTEED data        |
|                                                                              |
|  GUARANTEES after gate opens:                                               |
|  - getDatalabelSync(key) -> ALWAYS returns data (never null)               |
|  - getEntityCodesSync() -> ALWAYS returns data (never null)                |
|  - getEntityInstanceNameSync() -> Returns names for prefetched entities     |
|  - All formatters render correctly on first render                          |
|                                                                              |
+-----------------------------------------------------------------------------+
```

### 1.3 Component Architecture

```typescript
// apps/web/src/components/shared/gates/MetadataGate.tsx

export function MetadataGate({ children, loadingMessage }: MetadataGateProps) {
  const { isMetadataLoaded } = useCacheContext();

  // Gate: Block rendering until metadata is loaded
  if (!isMetadataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <EllipsisBounce size="lg" text={loadingMessage} />
      </div>
    );
  }

  // Gate passed - metadata is guaranteed available
  return <>{children}</>;
}
```

### 1.4 Integration Points

```
+-----------------------------------------------------------------------------+
|                    INTEGRATION ARCHITECTURE                                  |
+-----------------------------------------------------------------------------+
|                                                                              |
|  1. CacheProvider (db/Provider.tsx)                                         |
|     +-- Manages isMetadataLoaded state                                      |
|     +-- Exposes setMetadataLoaded(boolean) to AuthContext                   |
|     +-- clearCache() resets isMetadataLoaded to false                       |
|                                                                              |
|  2. AuthContext (contexts/AuthContext.tsx)                                  |
|     +-- login(): setMetadataLoaded(false) -> prefetch -> setMetadataLoaded(true)
|     +-- logout(): setMetadataLoaded(false) -> clearCache()                  |
|     +-- refreshUser(): prefetch -> setMetadataLoaded(true)                  |
|                                                                              |
|  3. ProtectedRoute (App.tsx)                                                |
|     +-- Checks isAuthenticated first                                        |
|     +-- Wraps children in <MetadataGate>                                    |
|                                                                              |
|  4. MetadataGate (components/shared/gates/MetadataGate.tsx)                 |
|     +-- Reads isMetadataLoaded from CacheContext                            |
|     +-- Blocks children until true                                          |
|                                                                              |
+-----------------------------------------------------------------------------+
```

### 1.5 Loading Sequence

```
LOGIN BUTTON CLICKED
        |
        v
+-----------------------------------------------------------------------------+
| AuthContext.login()                                                          |
| +-- setMetadataLoaded(false)  <- GATE CLOSED                                |
| +-- API: POST /api/v1/auth/login                                            |
| +-- setState({ isAuthenticated: true })                                     |
| +-- queryClient.clear() + resetDatabase()                                   |
| |                                                                            |
| +-- loadAllMetadata()                                                       |
| |   +-- prefetchAllDatalabels()      <- 58 datalabel sets                   |
| |   +-- prefetchEntityCodes()        <- 23 entity types                     |
| |   +-- prefetchGlobalSettings()     <- App config                          |
| |   +-- prefetchRefDataEntityInstances() <- 300+ entity names               |
| |                                                                            |
| +-- setMetadataLoaded(true)  <- GATE OPENS                                  |
|                                                                              |
+-----------------------------------------------------------------------------+
        |
        v
+-----------------------------------------------------------------------------+
| ProtectedRoute renders children                                              |
| +-- <MetadataGate> -> isMetadataLoaded = true -> render children            |
|     +-- EntityListOfInstancesPage renders                                   |
|         +-- formatBadge() -> getDatalabelSync() -> GUARANTEED DATA          |
+-----------------------------------------------------------------------------+
```

### 1.6 Prefetched Session Data

| Data Type | Prefetch Function | Sync Accessor | Purpose |
|-----------|-------------------|---------------|---------|
| **Datalabels** | `prefetchAllDatalabels()` | `getDatalabelSync(key)` | Badge colors, dropdown options |
| **Entity Codes** | `prefetchEntityCodes()` | `getEntityCodesSync()` | Entity type definitions, child tabs |
| **Global Settings** | `prefetchGlobalSettings()` | `getSettingSync(key)` | App config, feature flags |
| **Entity Names** | `prefetchRefDataEntityInstances()` | `getEntityInstanceNameSync()` | Dropdown labels |

---

## 2. Cache Layer Architecture

### 2.1 Directory Structure

```
apps/web/src/db/
+-- tanstack-index.ts         # PUBLIC API - single entry point
+-- Provider.tsx              # React context provider (CacheProvider)
+-- index.ts                  # Module exports
|
+-- cache/                    # CACHE LAYER
|   +-- client.ts             # TanStack Query client
|   +-- constants.ts          # Stale times, GC times, TTLs
|   +-- keys.ts               # Query keys, Dexie keys
|   +-- stores.ts             # Sync accessor functions
|   +-- hooks/                # React hooks
|       +-- useDatalabel.ts
|       +-- useDraft.ts
|       +-- useEntity.ts
|       +-- useEntityCodes.ts
|       +-- useEntityInstanceData.ts
|       +-- useOptimisticMutation.ts
|       +-- useInlineAddRow.ts
|
+-- persistence/              # PERSISTENCE LAYER
|   +-- schema.ts             # Dexie v5 schema (8 tables)
|   +-- hydrate.ts            # Dexie -> TanStack hydration
|   +-- operations.ts         # Clear, cleanup operations
|
+-- realtime/                 # REAL-TIME LAYER
    +-- manager.ts            # WebSocket manager
```

### 2.2 TanStack Query Client

```typescript
// db/cache/client.ts
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

### 2.3 Sync Accessors (v13.0.0 - Guaranteed Non-Null)

**v13.0.0 Key Change:** After MetadataGate passes, sync accessors are GUARANTEED to return data for session-level stores.

```typescript
// db/cache/stores.ts

import { queryClient } from './client';
import { QUERY_KEYS } from './keys';

// v13.0.0: After MetadataGate, these are GUARANTEED to return data
export function getDatalabelSync(key: string): DatalabelOption[] | null {
  const normalizedKey = key.startsWith('dl__') ? key.slice(4) : key;
  return queryClient.getQueryData<DatalabelOption[]>(
    QUERY_KEYS.datalabel(normalizedKey)
  ) ?? null;
}

export function getEntityCodesSync(): EntityCode[] | null {
  return queryClient.getQueryData<EntityCode[]>(QUERY_KEYS.entityCodes()) ?? null;
}

export function getEntityInstanceNameSync(
  entityCode: string,
  entityInstanceId: string
): string | null {
  const names = queryClient.getQueryData<Record<string, string>>(
    QUERY_KEYS.entityInstanceNames(entityCode)
  );
  return names?.[entityInstanceId] ?? null;
}
```

---

## 3. TTL Configuration

All cache timing is centralized in `apps/web/src/db/cache/constants.ts`.

### 3.1 Session-Level Stores

Prefetched on login, background refresh enabled.

```typescript
export const SESSION_STORE_CONFIG = {
  staleTime: 10 * 60 * 1000,           // 10 minutes
  gcTime: 60 * 60 * 1000,              // 1 hour
  backgroundRefreshInterval: 10 * 60 * 1000,
  persistMaxAge: 24 * 60 * 60 * 1000,  // 24 hours (Dexie TTL)
};
```

### 3.2 On-Demand Stores

Fetched when component mounts.

```typescript
export const ONDEMAND_STORE_CONFIG = {
  staleTime: 1 * 60 * 1000,            // 1 minute
  gcTime: 30 * 60 * 1000,              // 30 minutes
  persistMaxAge: 30 * 60 * 1000,       // 30 minutes (Dexie TTL)
};
```

### 3.3 Hydration Configuration

```typescript
export const HYDRATION_CONFIG = {
  maxAge: 30 * 60 * 1000,  // 30 minutes - older data skipped
};
```

### 3.4 Per-Store TTL Matrix

| Store | Stale Time | GC Time | Dexie TTL |
|-------|------------|---------|-----------|
| `globalSettings` | 10 min | 1 hour | 24 hours |
| `datalabel` | 10 min | 1 hour | 24 hours |
| `entityCodes` | 30 min | 1 hour | 24 hours |
| `entityInstanceNames` | 10 min | 1 hour | 24 hours |
| `entityLinks` | 5 min | 1 hour | 24 hours |
| `entityInstanceMetadata` | 1 min | 1 hour | 24 hours |
| `entityInstanceData` | 1 min | 30 min | 30 min |

---

## 4. Query Keys & Dexie Keys

### 4.1 TanStack Query Keys

```typescript
export const QUERY_KEYS = {
  // Session-Level Stores
  globalSettings: () => ['globalSettings'] as const,
  datalabel: (key: string) => ['datalabel', key] as const,
  datalabelAll: () => ['datalabel', '__all__'] as const,
  entityCodes: () => ['entityCodes'] as const,
  entityInstanceNames: (entityCode: string) =>
    ['entityInstanceNames', entityCode] as const,
  entityInstanceMetadata: (entityCode: string, component: string) =>
    ['entityInstanceMetadata', entityCode, component] as const,

  // On-Demand Store
  entityInstanceData: (entityCode: string, params: Record<string, unknown>) =>
    ['entityInstanceData', entityCode, params] as const,
  entityInstance: (entityCode: string, entityId: string) =>
    ['entityInstance', entityCode, entityId] as const,

  // Draft Store
  draft: (entityCode: string, entityId: string) =>
    ['draft', entityCode, entityId] as const,
};
```

### 4.2 Dexie Keys

```typescript
export const DEXIE_KEYS = {
  globalSettings: () => 'settings',
  datalabel: (key: string) => (key.startsWith('dl__') ? key.slice(4) : key),
  entityCodes: () => 'all',
  entityInstanceName: (entityCode: string, entityInstanceId: string) =>
    `${entityCode}:${entityInstanceId}`,
  draft: (entityCode: string, entityId: string) =>
    `draft:${entityCode}:${entityId}`,
};
```

---

## 5. Dexie Schema (v5)

8 tables with unified naming aligned to TanStack Query keys.

```typescript
// db/persistence/schema.ts
export const db = new Dexie('pmo-cache-v5');

db.version(1).stores({
  // Session-level stores
  globalSettings: '_id',
  datalabel: '_id, key',
  entityCodes: '_id',
  entityInstanceNames: '_id, [entityCode+entityInstanceId]',

  // On-demand stores
  entityInstanceData: '_id, entityCode',
  entityInstanceMetadata: '_id, entityCode',

  // Relationship stores
  entityLinkForward: '_id, [parentCode+parentId+childCode]',
  entityLinkReverse: '_id, [childCode+childId]',

  // User data (survives logout)
  draft: '_id, [entityCode+entityId]',
});
```

---

## 6. Data Flow Patterns

### 6.1 Flow: Component Reads Data

```
+-----------------------------------------------------------------------------+
|                    COMPONENT DATA READ FLOW                                   |
+-----------------------------------------------------------------------------+
|                                                                               |
|  EntityListOfInstancesPage                                                    |
|       |                                                                       |
|       v                                                                       |
|  useEntityInstanceData('project', { limit: 20 })                             |
|       |                                                                       |
|       v                                                                       |
|  useQuery({                                                                   |
|    queryKey: ['entityInstanceData', 'project', { limit: 20 }],               |
|    queryFn: async () => {                                                     |
|      // 1. Check Dexie cache first                                           |
|      const cached = await getEntityInstanceData('project', params);          |
|      if (cached && !isStale(cached.syncedAt)) return cached;                 |
|                                                                               |
|      // 2. Fetch from API                                                     |
|      const response = await apiClient.get('/api/v1/project', { params });    |
|                                                                               |
|      // 3. Persist to Dexie                                                   |
|      await setEntityInstanceData('project', params, response.data);          |
|                                                                               |
|      // 4. Upsert ref_data_entityInstance to TanStack Query cache            |
|      upsertRefDataEntityInstance(response.ref_data_entityInstance);          |
|                                                                               |
|      return response;                                                         |
|    },                                                                         |
|    staleTime: 1 * 60 * 1000,                                                 |
|  })                                                                           |
|       |                                                                       |
|       v                                                                       |
|  Component renders with { data, isLoading, refetch }                         |
|                                                                               |
+-----------------------------------------------------------------------------+
```

### 6.2 Flow: Sync Accessor (v13.0.0 Guaranteed)

```
+-----------------------------------------------------------------------------+
|                    SYNC ACCESSOR FLOW (v13.0.0)                              |
|                    CACHE MISS NO LONGER POSSIBLE                             |
+-----------------------------------------------------------------------------+
|                                                                               |
|  PRECONDITION: MetadataGate has passed (isMetadataLoaded === true)           |
|  GUARANTEE: getDatalabelSync() will ALWAYS return data (never null)          |
|                                                                               |
|  formatBadge(value, { lookupField: 'dl__project_stage' })                    |
|       |                                                                       |
|       v                                                                       |
|  getDatalabelSync('dl__project_stage')                                       |
|       |                                                                       |
|       v                                                                       |
|  queryClient.getQueryData(['datalabel', 'dl__project_stage'])                |
|       |                                                                       |
|       +-- ALWAYS Cache HIT -> DatalabelOption[]                              |
|               |                                                               |
|               v                                                               |
|           Find option by name -> get color_code -> Tailwind class            |
|                                                                               |
+-----------------------------------------------------------------------------+
```

### 6.3 Flow: Prefetch on Login (v13.0.0)

```
+-----------------------------------------------------------------------------+
|                    PREFETCH ON LOGIN FLOW (v13.0.0)                           |
+-----------------------------------------------------------------------------+
|                                                                               |
|  AuthContext.login()                                                          |
|       |                                                                       |
|       v                                                                       |
|  setMetadataLoaded(false)  <- GATE CLOSED                                    |
|       |                                                                       |
|       v                                                                       |
|  API login -> setState({ isAuthenticated: true })                             |
|       |                                                                       |
|       v                                                                       |
|  loadAllMetadata()                                                            |
|       |                                                                       |
|       v                                                                       |
|  await Promise.all([                                                          |
|    prefetchAllDatalabels(),    <- GET /api/v1/datalabel/all                  |
|    prefetchEntityCodes(),      <- GET /api/v1/entity/types                   |
|    prefetchGlobalSettings(),   <- GET /api/v1/settings                       |
|  ])                                                                           |
|       |                                                                       |
|       v                                                                       |
|  await prefetchRefDataEntityInstances([                                       |
|    'employee', 'project', 'business', 'office', 'role', 'customer'           |
|  ])                                                                           |
|       |                                                                       |
|       v                                                                       |
|  setMetadataLoaded(true)  <- GATE OPENS                                      |
|                               ALL sync accessors are GUARANTEED to work      |
|                                                                               |
+-----------------------------------------------------------------------------+
```

### 6.4 Flow: WebSocket Invalidation

```
+-----------------------------------------------------------------------------+
|                    WEBSOCKET INVALIDATION FLOW                                |
+-----------------------------------------------------------------------------+
|                                                                               |
|  PubSub Service (:4001)                                                       |
|       |                                                                       |
|       v                                                                       |
|  WebSocket message: { type: 'INVALIDATE', payload: { entityCode: 'project' }}|
|       |                                                                       |
|       v                                                                       |
|  WebSocketManager.handleInvalidate(payload)                                   |
|       |                                                                       |
|       v                                                                       |
|  queryClient.invalidateQueries({                                              |
|    queryKey: ['entityInstanceData', 'project']                               |
|  })                                                                           |
|       |                                                                       |
|       v                                                                       |
|  TanStack Query marks queries as stale                                        |
|       |                                                                       |
|       v                                                                       |
|  Active queries auto-refetch -> API -> Update cache -> Component re-renders  |
|                                                                               |
+-----------------------------------------------------------------------------+
```

---

## 7. React Hooks API

### 7.1 Session-Level Hooks (Prefetched at Login)

```typescript
// Entity type metadata
const { data: entityCodes, isLoading } = useEntityCodes();

// Datalabel dropdown options
const { data: options, isLoading } = useDatalabel('project_stage');

// Global application settings
const { data: settings } = useGlobalSettings();

// Entity instance name resolution
const { data: names } = useEntityInstanceNames('employee');
```

### 7.2 On-Demand Hooks

```typescript
// Single entity data
const { data: project, isLoading } = useEntity<Project>('project', projectId);

// Entity list with pagination
const { data, total, isLoading } = useEntityInstanceData<Project>('project', {
  limit: 20,
  offset: 0,
  parent_entity_code: 'business',
  parent_entity_instance_id: businessId,
});

// Draft persistence (survives page refresh)
const { currentData, updateField, undo, redo, hasChanges, save } =
  useDraft('project', projectId);
```

### 7.3 Optimistic Mutation Hook

```typescript
const { createEntity, updateEntity, deleteEntity, isUpdating } =
  useOptimisticMutation<Project>('project');

// Create with existingTempId (for inline add row)
createEntity(data, { existingTempId: 'temp_123' });

// Update with immediate UI feedback
updateEntity({ entityId: projectId, changes: { name: 'New Name' } });

// Delete with immediate removal
deleteEntity({ entityId: projectId });
```

### 7.4 Inline Add Row Hook (v11.3.1)

```typescript
const {
  editingRow,
  editedData,
  isAddingRow,
  handleAddRow,
  handleEditRow,
  handleFieldChange,
  handleSave,
  handleCancel,
} = useInlineAddRow({
  entityCode: 'project',
  createEntity,
  updateEntity,
});

// Add new row
const newRow = createTempRow<Project>({
  defaults: { dl__project_stage: 'planning' },
  generateName: () => 'New Project',
});
handleAddRow(newRow);

// Block navigation to temp rows
if (shouldBlockNavigation(row.id)) return;
```

---

## 8. Sign-In/Sign-Out Cache Management

### 8.1 Sign-In Flow

```
CacheProvider (on mount)
   hydrateFromDexie()          -> Load IndexedDB -> TanStack
        (Only hydrates data < 30 min old)

AuthContext.login()
   1. authApi.login()
   2. localStorage.setItem('auth_token')
   3. setMetadataLoaded(false)  <- GATE CLOSED
   4. loadAllMetadata() (parallel)
          prefetchAllDatalabels()  -> API -> TanStack + Dexie
          prefetchEntityCodes()    -> API -> TanStack + Dexie
          prefetchGlobalSettings() -> API -> TanStack + Dexie
   5. prefetchRefDataEntityInstances() (awaited)
   6. setMetadataLoaded(true)   <- GATE OPENS
```

### 8.2 Sign-Out Flow

```
AuthContext.logout()
   1. setMetadataLoaded(false)           <- GATE CLOSED
   2. authApi.logout()                   -> API call to server
   3. localStorage.removeItem('auth_token')
   4. clearCache()                       -> CacheProvider
          wsManager.disconnect()
          clearQueryCache()              -> TanStack Query
          clearAllExceptDrafts()         -> Dexie IndexedDB
```

### 8.3 What Gets Cleared on Sign-Out

| Cache Layer | Cleared? | Details |
|-------------|----------|---------|
| TanStack Query (in-memory) | Yes | `queryClient.clear()` |
| Dexie - globalSettings | Yes | Cleared |
| Dexie - datalabel | Yes | Cleared |
| Dexie - entityCodes | Yes | Cleared |
| Dexie - entityInstanceNames | Yes | Cleared |
| Dexie - entityInstanceData | Yes | Cleared |
| Dexie - **draft** | **No** | Survives logout intentionally |
| localStorage auth_token | Yes | Removed |

---

## 9. Public API Reference

### 9.1 Imports from `@/db/tanstack-index`

```typescript
import {
  // React Hooks
  useEntityCodes,
  useDatalabel,
  useGlobalSettings,
  useEntityInstanceNames,
  useEntity,
  useEntityInstanceData,
  useDraft,
  useOptimisticMutation,
  useInlineAddRow,
  createTempRow,
  shouldBlockNavigation,

  // Sync Accessors (v13.0.0: guaranteed after MetadataGate)
  getGlobalSettingsSync,
  getSettingSync,
  getDatalabelSync,
  getEntityCodesSync,
  getEntityCodeSync,
  getEntityInstanceNameSync,
  getEntityInstanceNamesForTypeSync,
  getCacheStats,

  // Query Client
  queryClient,
  invalidateStore,
  invalidateEntityQueries,
  clearQueryCache,

  // Persistence (Dexie)
  db,
  hydrateFromDexie,
  clearAllExceptDrafts,

  // Real-Time
  wsManager,
  WS_URL,

  // Provider
  CacheProvider,
  useCacheContext,
  useIsAppReady,
  useIsMetadataLoaded,

  // Constants & Types
  STORE_STALE_TIMES,
  STORE_GC_TIMES,
  QUERY_KEYS,
  DEXIE_KEYS,
} from '@/db/tanstack-index';
```

---

## 10. Component -> Cache Mapping

| Component | Cache Query Key | Hook | v13.0.0 Guarantee |
|-----------|-----------------|------|-------------------|
| `EntityListOfInstancesPage` | `['entityInstanceData', code, params]` | `useEntityInstanceData` | Data formatted correctly |
| `EntitySpecificInstancePage` | `['entityInstance', code, id]` | `useEntity` | References resolved |
| `EntityCreatePage` | Dexie `draft` table | `useDraft` | Dropdowns populated |
| `EntitySelect` | `['entityInstanceNames', code]` | `useEntityInstanceNames` | Names available |
| `BadgeDropdownSelect` | `['datalabel', key]` | `useDatalabel` | Colors available |
| `SettingsDataTable` | `['datalabel', category]` | `useDatalabel` | Options loaded |
| All formatters | Sync accessors | `getDatalabelSync`, etc. | **GUARANTEED non-null** |

---

## 11. Key Design Principles

### 11.1 Hydration Gate First (v13.0.0)

```
1. Block rendering until isMetadataLoaded = true
2. Formatters NEVER see null from sync accessors
3. No defensive fallbacks needed in formatters
4. Clean, simple formatter code
```

### 11.2 Single QueryClient

```
- ONE QueryClient from db/cache/client.ts
- CacheProvider wraps with QueryClientProvider
- All hooks read/write to SAME cache
- Anti-pattern: Creating multiple QueryClient instances
```

### 11.3 Upsert Always Merges

```typescript
// CORRECT: Merge pattern
queryClient.setQueryData(key, (old) => ({ ...(old || {}), ...new }));

// WRONG: Replace pattern (loses existing data)
queryClient.setQueryData(key, newData);
```

### 11.4 Format-at-Read, Not Format-at-Fetch

```
- Cache stores RAW data (small, canonical)
- Formatting happens via TanStack Query's select option
- Memoized by React Query
```

### 11.5 Prefetch is Awaited

```typescript
// AuthContext.tsx
await prefetchRefDataEntityInstances(queryClient, ['employee', 'project', ...]);
// Page renders AFTER cache is populated (gate opens)
```

---

## 12. Console Debugging

```javascript
// Check cache statistics
import { getCacheStats } from '@/db/tanstack-index';
getCacheStats();  // { globalSettings: true, datalabelKeys: [...], ... }

// Debug ref_data_entityInstance cache
window.__debugRefDataEntityInstance();

// React Query DevTools (in development)
// Shows all cached queries, stale state, fetch status

// Check Dexie tables
const { db } = await import('@/db/persistence/schema');
await db.datalabel.toArray();
await db.entityInstanceNames.toArray();
await db.draft.toArray();
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 13.0.0 | 2025-12-07 | **Hydration Gate Pattern**: MetadataGate blocks rendering until all session metadata loaded. Sync accessors guaranteed non-null. Removed defensive fallbacks from formatters. |
| 11.3.1 | 2025-12-03 | Inline add row pattern with `useInlineAddRow` hook |
| 11.1.0 | 2025-12-02 | Flat metadata format for table and form components |
| 11.0.0 | 2025-12-01 | Removed sync stores - TanStack Query single source of truth |
| 9.1.0 | 2025-11-28 | TanStack Query + Dexie migration (replaced RxDB) |

---

**Version:** 13.0.0 | **Updated:** 2025-12-07 | **Status:** Production
