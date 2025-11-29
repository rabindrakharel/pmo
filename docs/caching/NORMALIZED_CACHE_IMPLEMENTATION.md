# 4-Layer Normalized Cache - Implementation Guide

> **Implementation Status:** Complete - Modular Architecture
> **Version:** 2.0.0
> **Date:** 2025-11-29

## Overview

This document describes the implementation of the 4-layer normalized cache architecture for the PMO Enterprise Platform. The architecture is **decoupled, modular, and DRY** - cache can be enabled/disabled via configuration.

## Architecture

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
│                      │  • entityTypesStore   │                     │
│                      │  • entityInstancesStore│                    │
│                      │  • entityLinksStore   │                     │
│                      │  • entityNamesStore   │                     │
│                      └───────────┬───────────┘                     │
│                                  │                                  │
│                      ┌───────────▼───────────┐                     │
│                      │      React Hooks      │                     │
│                      │                       │                     │
│                      │  • useEntityTypes     │                     │
│                      │  • useEntityInstances │                     │
│                      │  • useEntityLinks     │                     │
│                      │  • useNormalizedList  │                     │
│                      └───────────────────────┘                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Files Structure

```
apps/web/src/db/normalized-cache/
├── types.ts           # All shared types and interfaces
├── config.ts          # CacheConfigProvider and context
├── stores.ts          # In-memory sync caches
├── hooks.ts           # All React hooks
├── index.ts           # Public API exports
└── adapters/
    ├── base.ts        # Base adapter interface
    ├── cache-adapter.ts  # Cache implementation (Dexie + TanStack)
    ├── api-adapter.ts    # API-only implementation
    └── index.ts       # Adapter exports
```

## Usage

### Basic Usage (Default Configuration)

```typescript
import { useEntityTypes, useNormalizedEntityList } from '@/db/normalized-cache';

function MyComponent() {
  const { data: entityTypes, isLoading } = useEntityTypes();
  const { data: tasks, isFromCache } = useNormalizedEntityList('task', {
    parentEntityCode: 'project',
    parentEntityInstanceId: projectId,
  });
}
```

### Enable/Disable Cache

```typescript
import { CacheConfigProvider } from '@/db/normalized-cache';

// Wrap app with provider
function App() {
  return (
    <CacheConfigProvider initialConfig={{
      enabled: true,           // Enable cache globally
      strategy: 'cache-first', // Try cache first, fall back to API
      layers: {
        entityTypes: true,
        entityInstances: true,
        entityLinks: true,
        entityInstanceNames: true,
      },
    }}>
      <MyApp />
    </CacheConfigProvider>
  );
}

// Disable cache entirely
<CacheConfigProvider initialConfig={{ enabled: false }}>
  <MyApp />
</CacheConfigProvider>
```

### Cache Strategies

| Strategy | Behavior |
|----------|----------|
| `cache-first` | Try cache first, API fallback if miss (default) |
| `api-first` | Always fetch from API, update cache |
| `cache-only` | Never call API, use only cached data |
| `api-only` | Never use cache, always fetch from API |

### Runtime Configuration

```typescript
import { useCacheConfig } from '@/db/normalized-cache';

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

## API Endpoints

### GET /api/v1/entity/types

**Purpose:** Layer 1 - Entity type metadata

**Response:**
```json
{
  "data": [
    {
      "code": "project",
      "name": "Project",
      "ui_label": "Projects",
      "child_entity_codes": ["task", "wiki"],
      "display_order": 1
    }
  ],
  "syncedAt": 1732900000000
}
```

### GET /api/v1/entity-instance/all

**Purpose:** Layer 2 - Entity instance registry

**Query Parameters:**
- `since` (optional): Unix timestamp for delta sync

**Response:**
```json
{
  "data": [
    {
      "entity_code": "project",
      "entity_instance_id": "uuid-here",
      "entity_instance_name": "Kitchen Renovation",
      "code": "PROJ-001"
    }
  ],
  "syncedAt": 1732900000000,
  "hasMore": false
}
```

### GET /api/v1/entity-instance-link/all

**Purpose:** Layer 3 - Relationship graph

**Response:**
```json
{
  "data": [
    {
      "id": "link-uuid",
      "entity_code": "project",
      "entity_instance_id": "project-uuid",
      "child_entity_code": "task",
      "child_entity_instance_id": "task-uuid",
      "relationship_type": "contains"
    }
  ],
  "syncedAt": 1732900000000
}
```

## WebSocket Invalidation

### Granular Invalidation

The WebSocket service sends granular invalidation messages based on `system_logging` and `system_subscription` tables:

```json
{
  "type": "NORMALIZED_INVALIDATE",
  "payload": {
    "table": "entity_instance",
    "action": "UPDATE",
    "entity_code": "project",
    "entity_instance_id": "specific-uuid"
  }
}
```

### Invalidation Handler

The `createInvalidationHandler` function provides granular cache invalidation:

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

### Invalidation Behavior

| Table | Action | Behavior |
|-------|--------|----------|
| `entity_instance` | `UPDATE` | Invalidate specific entity_instance_id |
| `entity_instance` | `DELETE` | Remove from cache, mark deleted in Dexie |
| `entity_instance` | `INSERT` | Invalidate entity type to trigger refetch |
| `entity_instance_link` | `INSERT/DELETE` | Optimistic update + invalidate links |

## Hooks Reference

### Layer 1: Entity Types

```typescript
// Hook
const { data, isLoading, getByCode, getChildCodes } = useEntityTypes();

// Sync access
const entityType = getEntityTypeSync('project');
const allTypes = getAllEntityTypesSync();
const childCodes = getChildEntityCodesSync('project');
```

### Layer 2: Entity Instances

```typescript
// Hook
const { data, isLoading, getByCode, getInstance } = useEntityInstances();

// Sync access
const instances = getEntityInstancesSync('project');
const instance = getEntityInstanceSync('project', 'uuid');
```

### Layer 3: Entity Links

```typescript
// Hook
const { isLoading, getChildIds, getParents, getTabCounts } = useEntityLinks();

// Sync access (O(1) - no API call!)
const taskIds = getChildIdsSync('project', 'project-uuid', 'task');
const parents = getParentsSync('task', 'task-uuid');
```

### Layer 4: Entity Instance Names

```typescript
// Hook
const { data, isLoading, getName } = useEntityInstanceNames('employee');

// Sync access
const name = getEntityInstanceNameSync('employee', 'uuid');
const allNames = getEntityInstanceNamesForTypeSync('employee');
```

### Derived Queries

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

## Lifecycle

### App Startup

1. `TanstackCacheProvider` mounts
2. `hydrateNormalizedCache()` loads all 4 layers from Dexie
3. App renders (isReady = true)

### Login

1. User authenticates
2. `connectWebSocket(token)` connects to PubSub (port 4001)
3. `prefetchNormalizedCache()` runs - fetches all layers

### Runtime

1. Components use hooks
2. Derived queries use cache for O(1) lookups
3. API fallback when cache misses
4. WebSocket invalidations update cache granularly

### Logout

1. `clearNormalizedCacheMemory()` called
2. WebSocket disconnects
3. All sync stores cleared
4. TanStack Query cache cleared

## Benefits

| Metric | Without Cache | With Cache |
|--------|---------------|------------|
| API calls per navigation | 1+ | 0 (cache hit) |
| Tab count calculation | API call | O(1) from index |
| Name resolution | Per-row lookup | O(1) from cache |
| Offline support | None | Full entity graph |
| Bundle flexibility | N/A | Enable/disable per feature |

## Migration from v1.0

The new modular architecture is backward compatible. Existing imports from `useNormalizedCache` continue to work:

```typescript
// Still works (re-exports from new module)
import { useEntityTypes } from '@/db/tanstack-hooks/useNormalizedCache';

// Recommended: Import from normalized-cache directly
import { useEntityTypes } from '@/db/normalized-cache';
```

New features available:
- `CacheConfigProvider` for enable/disable control
- `useCacheConfig` for runtime configuration
- Adapter pattern for custom implementations
- Granular invalidation per entity_instance_id
