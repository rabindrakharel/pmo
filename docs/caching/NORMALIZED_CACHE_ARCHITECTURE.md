# 4-Layer Normalized Cache Architecture

> **Version:** 2.0.0 | PMO Enterprise Platform
> **Status:** Implementation Complete
> **Date:** 2025-11-29

## Executive Summary

This document describes a **4-layer normalized caching architecture** that mirrors the database infrastructure tables directly in the frontend cache. The architecture is **decoupled, modular, and DRY** - cache can be enabled/disabled via configuration.

### Key Benefits

- **Zero redundant API calls** - Filtered queries derive from cached graph
- **Instant parent-child navigation** - Link graph enables O(1) lookups
- **Single source of truth** - Each entity stored once, referenced everywhere
- **Offline-first** - Full entity graph persisted in IndexedDB
- **Configurable** - Enable/disable cache per feature or globally

---

## 1. Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    4-LAYER NORMALIZED CACHE ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LAYER 1: Entity Codes (Entity Type Metadata)                               │
│  ══════════════════════════════════════════════════════════════════════════ │
│  • Source: GET /api/v1/entity/types                                         │
│  • Contains: code, name, ui_label, ui_icon, child_entity_codes, db_table    │
│  • Lifecycle: Fetch at login → Persist → Rarely invalidated                 │
│  • Use: Navigation menus, tab generation, entity pickers, icon resolution   │
│                                                                              │
│  LAYER 2: Entity Instances (Entity Instance Registry)                       │
│  ══════════════════════════════════════════════════════════════════════════ │
│  • Source: GET /api/v1/entity-instance/all (or per-type endpoints)          │
│  • Contains: entity_code, entity_instance_id, entity_instance_name, code    │
│  • Lifecycle: Fetch at login → Persist → Upsert → Validate → Invalidate     │
│  • Use: Global search, entity existence validation, dropdown options        │
│                                                                              │
│  LAYER 3: Entity Links (Relationship Graph)                                 │
│  ══════════════════════════════════════════════════════════════════════════ │
│  • Source: GET /api/v1/entity-instance-link/all (or per-parent endpoints)   │
│  • Forward Index: parent_code:parent_id:child_code → [child_ids]            │
│  • Reverse Index: child_code:child_id → [parents]                           │
│  • Lifecycle: Fetch at login → Persist → Upsert → Validate → Invalidate     │
│  • Use: Parent-child filtering, tab counts, navigation, orphan detection    │
│                                                                              │
│  LAYER 4: Entity Instance Names (Name Lookup / ref_data_entityInstance)     │
│  ══════════════════════════════════════════════════════════════════════════ │
│  • Source: Extracted from API response.ref_data_entityInstance              │
│  • Contains: { [entity_instance_id]: entity_instance_name }                 │
│  • Lifecycle: Upsert → Validate → Invalidate (accumulated throughout)       │
│  • Use: Display names for UUID references, O(1) name resolution             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Modular Implementation Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Modular Cache Architecture                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐   ┌──────────────────┐   ┌─────────────────┐ │
│  │  CacheConfig     │   │  DataSource      │   │  WebSocket      │ │
│  │  Provider        │   │  Adapters        │   │  Invalidation   │ │
│  │                  │   │                  │   │                 │ │
│  │  • enabled       │   │  • CacheAdapter  │   │  • Granular     │ │
│  │  • strategy      │   │  • APIAdapter    │   │  • Per-instance │ │
│  │  • layers        │   │                  │   │                 │ │
│  └────────┬─────────┘   └────────┬─────────┘   └────────┬────────┘ │
│           │                      │                      │          │
│           └──────────────────────┼──────────────────────┘          │
│                                  │                                  │
│                      ┌───────────▼───────────┐                     │
│                      │     Sync Stores       │                     │
│                      │  (In-Memory Cache)    │                     │
│                      │                       │                     │
│                      │  • entityCodesStore   │                     │
│                      │  • entityInstancesStore│                    │
│                      │  • entityLinksStore   │                     │
│                      │  • entityNamesStore   │                     │
│                      └───────────┬───────────┘                     │
│                                  │                                  │
│                      ┌───────────▼───────────┐                     │
│                      │      React Hooks      │                     │
│                      │                       │                     │
│                      │  • useEntityCodes     │                     │
│                      │  • useEntityInstances │                     │
│                      │  • useEntityLinks     │                     │
│                      │  • useNormalizedList  │                     │
│                      └───────────────────────┘                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Design Patterns

### Strategy Pattern: Data Source Adapters

The cache uses the **Strategy Pattern** to switch between different data sources:

```typescript
// Base adapter (Strategy interface)
abstract class BaseDataSourceAdapter {
  abstract fetchEntityCodes(): Promise<DataSourceResult<EntityCode[]>>;
  abstract getEntityCodeSync(code: string): EntityCode | null;
  abstract getAllEntityCodesSync(): EntityCode[] | null;
  // ... more methods for each layer
}

// Concrete strategies
class CacheDataSourceAdapter extends BaseDataSourceAdapter { /* Uses Dexie + TanStack */ }
class APIDataSourceAdapter extends BaseDataSourceAdapter { /* API only, no cache */ }
```

### Adapter Selection Based on Configuration

```typescript
function getAdapter(): BaseDataSourceAdapter {
  return isCacheEnabled() ? cacheAdapter : apiAdapter;
}
```

### Provider Pattern: Cache Configuration

```typescript
<CacheConfigProvider initialConfig={{
  enabled: true,
  strategy: 'cache-first',
  layers: {
    entityCodes: true,
    entityInstances: true,
    entityLinks: true,
    entityInstanceNames: true,
  },
}}>
  <App />
</CacheConfigProvider>
```

---

## 3. File Structure

```
apps/web/src/db/normalized-cache/
├── types.ts              # All shared types and interfaces
├── config.ts             # CacheConfigProvider and context
├── stores.ts             # In-memory sync caches (O(1) access)
├── hooks.ts              # All React hooks
├── index.ts              # Public API exports
└── adapters/
    ├── base.ts           # Base adapter interface
    ├── cache-adapter.ts  # Cache implementation (Dexie + TanStack)
    ├── api-adapter.ts    # API-only implementation
    └── index.ts          # Adapter exports
```

---

## 4. Layer Details

### Layer 1: Entity Codes (Entity Type Metadata)

**Database Table:** `app.entity`

```sql
CREATE TABLE app.entity (
    code varchar(50),                    -- 'project', 'task', 'employee'
    name varchar(100),                   -- 'Project', 'Task', 'Employee'
    ui_label varchar(100),               -- 'Projects', 'Tasks', 'Employees'
    ui_icon varchar(50),                 -- 'FolderOpen', 'CheckSquare', 'Users'
    db_table varchar(100),               -- 'project', 'task', 'employee'
    db_model_type varchar(2),            -- 'd', 'f', 'fh', 'fd'
    child_entity_codes jsonb,            -- '["task", "wiki", "artifact"]'
    display_order int4,
    active_flag boolean
);
```

**TypeScript Interface:**

```typescript
interface EntityCode {
  code: string;
  name: string;
  ui_label: string;
  ui_icon: string;
  db_table: string;
  db_model_type: 'd' | 'f' | 'fh' | 'fd' | 'dh';
  child_entity_codes: string[];
  display_order: number;
  domain_code?: string;
  column_metadata?: Record<string, unknown>;
  active_flag: boolean;
}
```

**Use Cases:**

| Use Case | Access Pattern |
|----------|----------------|
| Sidebar navigation | `useEntityCodes()` sorted by `display_order` |
| Entity picker dropdown | Filter by `db_model_type` |
| Get child types for tabs | `getChildEntityCodesSync(parentCode)` |
| Resolve entity icon | `getEntityCodeSync(code).ui_icon` |

### Layer 2: Entity Instances (Entity Instance Registry)

**Database Table:** `app.entity_instance`

```sql
CREATE TABLE app.entity_instance (
    order_id int4 GENERATED ALWAYS AS IDENTITY,
    entity_code varchar(50),             -- 'project', 'task'
    entity_instance_id uuid,             -- UUID of the instance
    entity_instance_name varchar(255),   -- 'Corporate Office Expansion'
    code varchar(100),                   -- 'COE-2024-001'
    created_ts timestamptz,
    updated_ts timestamptz
);
```

**TypeScript Interface:**

```typescript
interface EntityInstance {
  entity_code: string;
  entity_instance_id: string;
  entity_instance_name: string;
  code?: string;
  order_id?: number;
}
```

**Use Cases:**

| Use Case | Access Pattern |
|----------|----------------|
| Global search | `getEntityInstancesSync(entityCode)` with text match |
| Entity picker dropdown | `useEntityInstances().getByCode(entityCode)` |
| Validate entity exists | `getEntityInstanceSync(code, id)` |
| Get instance name by ID | `getEntityInstanceSync(code, id).entity_instance_name` |

### Layer 3: Entity Links (Relationship Graph)

**Database Table:** `app.entity_instance_link`

```sql
CREATE TABLE app.entity_instance_link (
    id uuid DEFAULT gen_random_uuid(),
    entity_code varchar(50),             -- Parent: 'project'
    entity_instance_id uuid,             -- Parent ID
    child_entity_code varchar(50),       -- Child: 'task'
    child_entity_instance_id uuid,       -- Child ID
    relationship_type varchar(50),       -- 'contains', 'assigned_to', 'owns'
    created_ts timestamptz
);
```

**Index Structures:**

```typescript
// Forward Index: Parent → Children
interface LinkForwardIndex {
  parentCode: string;
  parentId: string;
  childCode: string;
  childIds: string[];
  relationships: Record<string, string>;  // { childId: relationship_type }
}

// Reverse Index: Child → Parents
interface LinkReverseIndex {
  childCode: string;
  childId: string;
  parents: Array<{
    entity_code: string;
    entity_instance_id: string;
    relationship_type: string;
  }>;
}
```

**Use Cases:**

| Use Case | Access Pattern |
|----------|----------------|
| Get tasks for project | `getChildIdsSync('project', projectId, 'task')` |
| Get tab counts | `getTabCountsSync(parentCode, parentId)` |
| Get all parents of entity | `getParentsSync(childCode, childId)` |

### Layer 4: Entity Instance Names (Name Lookup)

**Source:** Accumulated from `ref_data_entityInstance` in API responses

**Cache Structure:**

```typescript
type EntityInstanceNameMap = Record<string, string>;
// { [entity_instance_id]: entity_instance_name }
```

**Use Cases:**

| Use Case | Access Pattern |
|----------|----------------|
| Display manager name | `getEntityInstanceNameSync('employee', managerId)` |
| Display project name | `getEntityInstanceNameSync('project', projectId)` |
| Resolve any UUID to name | `getEntityInstanceNameSync(entityCode, uuid)` |

---

## 5. Data Flow

### App Startup (Hydration)

```
┌─────────────────────────────────────────────────────────────────┐
│                      HYDRATION FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. TanstackCacheProvider mounts                                │
│                    ↓                                             │
│  2. hydrateNormalizedCache() called                             │
│                    ↓                                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Load from Dexie (IndexedDB) → Sync Stores → TanStack    │   │
│  │                                                           │   │
│  │  • Layer 1: dexie.entityTypes → entityCodesStore         │   │
│  │  • Layer 2: dexie.entityInstances → entityInstancesStore │   │
│  │  • Layer 3: dexie.entityLinksForward/Reverse             │   │
│  │  • Layer 4: dexie.entityInstanceNames                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                    ↓                                             │
│  3. App renders (isReady = true)                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Login (Prefetch)

```
┌─────────────────────────────────────────────────────────────────┐
│                      PREFETCH FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User authenticates                                          │
│                    ↓                                             │
│  2. connectWebSocket(token) - Connect to PubSub (port 4001)     │
│                    ↓                                             │
│  3. prefetchNormalizedCache()                                   │
│                    ↓                                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Parallel API Fetches (with delta sync)                   │   │
│  │                                                           │   │
│  │  • GET /api/v1/entity/types                               │   │
│  │  • GET /api/v1/entity-instance/all?since=timestamp        │   │
│  │  • GET /api/v1/entity-instance-link/all?since=timestamp   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                    ↓                                             │
│  4. Update Sync Stores + TanStack Query + Dexie                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Runtime (Query Derivation)

```
┌─────────────────────────────────────────────────────────────────┐
│                   DERIVED QUERY FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Component: useNormalizedEntityList('task', {                   │
│    parentEntityCode: 'project',                                 │
│    parentEntityInstanceId: projectId                            │
│  })                                                              │
│                    ↓                                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  1. Check Link Graph (Layer 3)                            │   │
│  │     getChildIdsSync('project', projectId, 'task')         │   │
│  │     → ['task-1', 'task-2', 'task-3']                      │   │
│  │                                                           │   │
│  │  2. Resolve Instances (Layer 2)                           │   │
│  │     For each childId:                                     │   │
│  │       getEntityInstanceSync('task', childId)              │   │
│  │                                                           │   │
│  │  3. Return Derived Data                                   │   │
│  │     { data: [...tasks], total: 3, isFromCache: true }     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Cache Hit: O(1) - No API call!                                 │
│  Cache Miss: Fallback to API, update cache                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### WebSocket Invalidation

```
┌─────────────────────────────────────────────────────────────────┐
│               WEBSOCKET INVALIDATION FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Server: CRUD operation on entity_instance                      │
│                    ↓                                             │
│  Database Trigger: INSERT INTO system_logging                   │
│                    ↓                                             │
│  LogWatcher: Polls every 60s, sends to WebSocket clients        │
│                    ↓                                             │
│  WebSocket Message:                                              │
│  {                                                               │
│    "type": "NORMALIZED_INVALIDATE",                             │
│    "payload": {                                                  │
│      "table": "entity_instance",                                │
│      "action": "UPDATE",                                        │
│      "entity_code": "project",                                  │
│      "entity_instance_id": "uuid"                               │
│    }                                                             │
│  }                                                               │
│                    ↓                                             │
│  WebSocketManager.handleNormalizedInvalidate()                  │
│                    ↓                                             │
│  createInvalidationHandler(cacheAdapter)(invalidation)          │
│                    ↓                                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Granular Cache Update:                                   │   │
│  │  • Remove from sync store                                 │   │
│  │  • Mark deleted in Dexie                                  │   │
│  │  • Invalidate TanStack Query                              │   │
│  │  • Components auto-refetch if needed                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Configuration

### Cache Strategies

| Strategy | Behavior |
|----------|----------|
| `cache-first` | Try cache first, API fallback if miss (default) |
| `api-first` | Always fetch from API, update cache |
| `cache-only` | Never call API, use only cached data |
| `api-only` | Never use cache, always fetch from API |

### Enable/Disable Cache

```typescript
// Enable cache with specific layers
<CacheConfigProvider initialConfig={{
  enabled: true,
  strategy: 'cache-first',
  layers: {
    entityCodes: true,
    entityInstances: true,
    entityLinks: true,
    entityInstanceNames: true,
  },
}}>
  <App />
</CacheConfigProvider>

// Disable cache entirely
<CacheConfigProvider initialConfig={{ enabled: false }}>
  <App />
</CacheConfigProvider>
```

### Runtime Configuration

```typescript
function SettingsPanel() {
  const { config, setEnabled, setLayerEnabled, setStrategy } = useCacheConfig();

  return (
    <div>
      <Toggle
        label="Enable Cache"
        checked={config.enabled}
        onChange={setEnabled}
      />
      <Select
        value={config.strategy}
        onChange={setStrategy}
        options={['cache-first', 'api-first', 'cache-only', 'api-only']}
      />
    </div>
  );
}
```

---

## 7. API Reference

### Hooks

#### Layer 1: Entity Codes

```typescript
// Hook
const { data, isLoading, getByCode, getChildCodes } = useEntityCodes();

// Sync access (for formatters, utilities)
const entityCode = getEntityCodeSync('project');
const allCodes = getAllEntityCodesSync();
const childCodes = getChildEntityCodesSync('project');
```

#### Layer 2: Entity Instances

```typescript
// Hook
const { data, isLoading, getByCode, getInstance } = useEntityInstances();

// Sync access
const instances = getEntityInstancesSync('project');
const instance = getEntityInstanceSync('project', 'uuid');
```

#### Layer 3: Entity Links

```typescript
// Hook
const { isLoading, getChildIds, getParents, getTabCounts } = useEntityLinks();

// Sync access (O(1) - no API call!)
const taskIds = getChildIdsSync('project', 'project-uuid', 'task');
const parents = getParentsSync('task', 'task-uuid');
```

#### Layer 4: Entity Instance Names

```typescript
// Hook
const { data, isLoading, getName } = useEntityInstanceNames('employee');

// Sync access
const name = getEntityInstanceNameSync('employee', 'uuid');
const allNames = getEntityInstanceNamesForTypeSync('employee');
```

#### Derived Queries

```typescript
// Get filtered list - tries cache first, falls back to API
const { data, total, isLoading, isFromCache } = useNormalizedEntityList<Task>('task', {
  parentEntityCode: 'project',
  parentEntityInstanceId: 'project-uuid',
  limit: 50,
  offset: 0,
  skipCache: false, // Force API call if true
});
```

### Lifecycle Functions

```typescript
// Hydrate from Dexie at app startup
await hydrateNormalizedCache();

// Prefetch all layers at login
await prefetchNormalizedCache();

// Clear all caches at logout
clearNormalizedCacheMemory();
```

### Invalidation Functions

```typescript
// Invalidate specific entity instance
invalidateEntityInstance(entityCode, entityInstanceId);

// Invalidate all links (triggers refetch)
invalidateEntityLinks();

// Optimistic link updates
addLinkToCache(link);
removeLinkFromCache(link);
```

---

## 8. API Endpoints

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `GET /api/v1/entity/types` | All entity type metadata | `{ data: EntityCode[] }` |
| `GET /api/v1/entity-instance/all?since=timestamp` | Delta sync entity instances | `{ data: EntityInstance[], hasMore: boolean }` |
| `GET /api/v1/entity-instance-link/all?since=timestamp` | Delta sync links | `{ data: EntityLink[] }` |

---

## 9. WebSocket Messages

### NORMALIZED_INVALIDATE

```json
{
  "type": "NORMALIZED_INVALIDATE",
  "payload": {
    "table": "entity_instance",
    "action": "UPDATE",
    "entity_code": "project",
    "entity_instance_id": "uuid"
  }
}
```

### LINK_CHANGE

```json
{
  "type": "LINK_CHANGE",
  "payload": {
    "action": "CREATE",
    "entity_code": "project",
    "entity_instance_id": "uuid",
    "child_entity_code": "task",
    "child_entity_instance_id": "uuid"
  }
}
```

### Invalidation Behavior

| Table | Action | Behavior |
|-------|--------|----------|
| `entity` | `UPDATE` | Invalidate all entity codes (rare - admin action) |
| `entity_instance` | `UPDATE` | Invalidate specific entity_instance_id |
| `entity_instance` | `DELETE` | Remove from cache, mark deleted in Dexie |
| `entity_instance` | `INSERT` | Invalidate entity type to trigger refetch |
| `entity_instance_link` | `INSERT/DELETE` | Optimistic update + invalidate links |

---

## 10. Benefits Summary

| Metric | Without Cache | With Cache |
|--------|---------------|------------|
| API calls per navigation | 1+ | 0 (cache hit) |
| Tab count calculation | API call | O(1) from index |
| Name resolution | Per-row lookup | O(1) from cache |
| Offline support | None | Full entity graph |
| Bundle flexibility | N/A | Enable/disable per feature |
| Memory for 100 tasks across 10 projects | 100 × 10 = 1000 entries | 100 entries + 10 link indexes |

---

## 11. Usage Examples

### Basic Usage

```typescript
import { useEntityCodes, useNormalizedEntityList } from '@/db/normalized-cache';

function MyComponent() {
  const { data: entityCodes, isLoading } = useEntityCodes();
  const { data: tasks, isFromCache } = useNormalizedEntityList('task', {
    parentEntityCode: 'project',
    parentEntityInstanceId: projectId,
  });
}
```

### Sync Access in Formatters

```typescript
import { getEntityInstanceNameSync } from '@/db/normalized-cache';

function formatManagerName(managerId: string): string {
  return getEntityInstanceNameSync('employee', managerId) || 'Unknown';
}
```

### WebSocket Invalidation Handler

```typescript
import { createInvalidationHandler, cacheAdapter } from '@/db/normalized-cache';

const handler = createInvalidationHandler(cacheAdapter);

// On WebSocket message
handler({
  action: 'UPDATE',
  table: 'entity_instance',
  entity_code: 'project',
  entity_instance_id: 'uuid',
  timestamp: Date.now(),
});
```

---

## 12. Migration

### From Legacy Imports

```typescript
// Still works (re-exports from new module)
import { useEntityCodes } from '@/db/tanstack-hooks/useNormalizedCache';

// Recommended: Import from normalized-cache directly
import { useEntityCodes } from '@/db/normalized-cache';
```

### New Features Available

- `CacheConfigProvider` for enable/disable control
- `useCacheConfig` for runtime configuration
- Adapter pattern for custom implementations
- Granular invalidation per entity_instance_id

---

**Version:** 2.0.0
**Last Updated:** 2025-11-29
**Status:** Implementation Complete
