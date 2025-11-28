# Migration Plan: RxDB → TanStack Query + Dexie

> **Version**: 1.0.0
> **Created**: 2025-11-28
> **Status**: Planning
> **Target**: v9.0.0

## Executive Summary

This document outlines the migration from RxDB to TanStack Query + Dexie for the PMO platform's client-side state management. The goal is to achieve the same offline-first, real-time sync capabilities with a simpler, more maintainable architecture.

---

## 1. Current Architecture (RxDB - v8.6.0)

```
┌─────────────────────────────────────────────────────────────┐
│                  Current: RxDB Architecture                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              RxDB (Single Source of Truth)           │    │
│  │  • Entity instances (project, task, employee, etc.) │    │
│  │  • Metadata (datalabels, entity types, settings)    │    │
│  │  • Drafts (unsaved edits with undo/redo)            │    │
│  └─────────────────────────────────────────────────────┘    │
│                            ↓                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              IndexedDB (RxDB Storage)                │    │
│  └─────────────────────────────────────────────────────┘    │
│                            ↓                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              RxJS Observables (Reactivity)           │    │
│  │  • Collections emit on document changes              │    │
│  │  • Hooks subscribe to observables                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                            ↓                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              React Hooks (useRx*)                    │    │
│  │  • useRxEntity, useRxEntityList                      │    │
│  │  • useRxDatalabel, useRxEntityCodes                  │    │
│  │  • useRxDraft                                        │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  WebSocket Sync:                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ReplicationManager                                  │    │
│  │  • Receives INVALIDATE from PubSub (port 4001)      │    │
│  │  • Fetches fresh data from REST API                  │    │
│  │  • Upserts to RxDB → Observable emits → UI updates  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Current File Structure

```
apps/web/src/db/rxdb/
├── index.ts                    # RxDBProvider, database init
├── schema.ts                   # RxDB collection schemas
├── replication.ts              # ReplicationManager (WebSocket)
├── hooks/
│   ├── useRxEntity.ts          # Single entity hook
│   ├── useRxEntityList.ts      # Entity list hook
│   ├── useRxDatalabel.ts       # Datalabel lookup hook
│   ├── useRxEntityCodes.ts     # Entity types hook
│   ├── useRxGlobalSettings.ts  # Global settings hook
│   └── useRxDraft.ts           # Draft persistence hook
└── sync/
    └── syncCache.ts            # Sync cache for non-hook access
```

### Pain Points with RxDB

| Issue | Impact |
|-------|--------|
| **Bundle size** | RxDB + RxJS ≈ 150KB gzipped |
| **RxJS complexity** | Steep learning curve, unfamiliar to React devs |
| **Schema migrations** | Complex versioning system |
| **Limited DevTools** | No visual debugging like React Query DevTools |
| **Replication complexity** | Custom ReplicationManager required |
| **Memory overhead** | RxDB maintains in-memory cache + IndexedDB |

---

## 2. Target Architecture (TanStack Query + Dexie)

```
┌─────────────────────────────────────────────────────────────┐
│             Target: TanStack Query + Dexie                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         TanStack Query (In-Memory Cache)             │    │
│  │  • Server state management                           │    │
│  │  • Automatic background refetching                   │    │
│  │  • Deduplication of requests                         │    │
│  │  • Cache invalidation API                            │    │
│  └─────────────────────────────────────────────────────┘    │
│                            ↓                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Dexie (IndexedDB Wrapper)               │    │
│  │  • Offline persistence layer                         │    │
│  │  • useLiveQuery for reactive reads                   │    │
│  │  • Simple schema definitions                         │    │
│  │  • Built-in multi-tab sync                           │    │
│  └─────────────────────────────────────────────────────┘    │
│                            ↓                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              React Hooks (use*)                      │    │
│  │  • useEntity, useEntityList (TanStack Query)         │    │
│  │  • useDatalabel, useEntityCodes                      │    │
│  │  • useDraft (Dexie + useLiveQuery)                   │    │
│  │  • useOfflineEntity (Dexie only)                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  WebSocket Sync:                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  WebSocketManager                                    │    │
│  │  • Receives INVALIDATE from PubSub (port 4001)      │    │
│  │  • Calls queryClient.invalidateQueries()            │    │
│  │  • TanStack Query auto-refetches active queries     │    │
│  │  • Fresh data persisted to Dexie                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Target File Structure

```
apps/web/src/db/
├── dexie/
│   └── database.ts             # Dexie schema & tables
├── query/
│   └── queryClient.ts          # TanStack Query client config
├── sync/
│   └── WebSocketManager.ts     # WebSocket connection & invalidation
├── hooks/
│   ├── useEntity.ts            # Single entity (TanStack + Dexie)
│   ├── useEntityList.ts        # Entity list (TanStack + Dexie)
│   ├── useOfflineEntity.ts     # Offline-first (Dexie only)
│   ├── useDatalabel.ts         # Datalabel lookup
│   ├── useEntityCodes.ts       # Entity types
│   ├── useGlobalSettings.ts    # Global settings
│   ├── useDraft.ts             # Draft persistence (Dexie)
│   └── index.ts                # Re-exports
├── CacheProvider.tsx           # Main provider component
└── index.ts                    # Public API exports
```

---

## 3. Architecture Comparison

### 3.1 Data Flow Comparison

```
CURRENT (RxDB):
API Response → RxDB Collection → IndexedDB → RxJS Observable → Hook State → Component

TARGET (TanStack + Dexie):
API Response → TanStack Cache → Hook State → Component
                    ↓
              Dexie/IndexedDB (persistence)
```

### 3.2 Cache Invalidation Flow

```
CURRENT (RxDB):
WebSocket INVALIDATE
    ↓
ReplicationManager.handleInvalidate()
    ↓
Fetch from API
    ↓
RxDB.upsert() → IndexedDB write
    ↓
RxJS Observable emits
    ↓
Hook receives new value
    ↓
Component re-renders

TARGET (TanStack + Dexie):
WebSocket INVALIDATE
    ↓
WebSocketManager.handleInvalidate()
    ↓
queryClient.invalidateQueries(['entity', code, id])
    ↓
TanStack Query auto-refetches (if active)
    ↓
queryFn fetches from API
    ↓
Data persisted to Dexie (in queryFn)
    ↓
Hook state updates
    ↓
Component re-renders
```

### 3.3 Feature Comparison

| Feature | RxDB | TanStack Query + Dexie |
|---------|------|------------------------|
| **In-memory cache** | RxDB internal | TanStack Query |
| **IndexedDB persistence** | Built-in | Dexie |
| **Reactivity mechanism** | RxJS Observables | React state + useLiveQuery |
| **Cache invalidation** | Manual upsert | `invalidateQueries()` |
| **Background refetch** | Manual | Built-in |
| **Request deduplication** | Manual | Built-in |
| **Stale-while-revalidate** | Manual | Built-in |
| **DevTools** | Limited | React Query DevTools |
| **Bundle size** | ~150KB | ~70KB total |
| **Multi-tab sync** | LeaderElection plugin | Dexie built-in |
| **Offline mutations** | Complex | Dexie + optimistic updates |
| **Learning curve** | Steep (RxJS) | Moderate (familiar patterns) |

---

## 4. Detailed Implementation Plan

### Phase 1: Foundation Setup (Day 1)

#### 1.1 Install Dependencies

```bash
pnpm add @tanstack/react-query dexie dexie-react-hooks
pnpm add -D @tanstack/react-query-devtools
```

#### 1.2 Create Dexie Database Schema

**File**: `apps/web/src/db/dexie/database.ts`

```typescript
import Dexie, { Table } from 'dexie';

// Entity cache record
export interface CachedEntity {
  _id: string;                    // `${entityCode}:${entityId}`
  entityCode: string;
  entityId: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
  refData?: Record<string, any>;
  version: number;
  syncedAt: number;
  isDeleted?: boolean;
}

// Entity list query cache
export interface CachedEntityList {
  _id: string;                    // `${entityCode}:${queryHash}`
  entityCode: string;
  queryHash: string;
  params: Record<string, any>;
  entityIds: string[];
  total: number;
  metadata?: Record<string, any>;
  syncedAt: number;
}

// Metadata cache (datalabels, entity types, settings)
export interface CachedMetadata {
  _id: string;                    // 'datalabel:key', 'entityCodes', etc.
  type: 'datalabel' | 'entityCodes' | 'globalSettings';
  key?: string;
  data: any;
  syncedAt: number;
}

// Draft persistence
export interface CachedDraft {
  _id: string;                    // `draft:${entityCode}:${entityId}`
  entityCode: string;
  entityId: string;
  originalData: Record<string, any>;
  currentData: Record<string, any>;
  undoStack: Record<string, any>[];
  redoStack: Record<string, any>[];
  updatedAt: number;
}

export class PMODatabase extends Dexie {
  entities!: Table<CachedEntity, string>;
  entityLists!: Table<CachedEntityList, string>;
  metadata!: Table<CachedMetadata, string>;
  drafts!: Table<CachedDraft, string>;

  constructor() {
    super('pmo-cache');

    this.version(1).stores({
      entities: '_id, entityCode, entityId, syncedAt, isDeleted',
      entityLists: '_id, entityCode, queryHash, syncedAt',
      metadata: '_id, type, key',
      drafts: '_id, entityCode, entityId, updatedAt'
    });
  }
}

export const db = new PMODatabase();
```

#### 1.3 Create TanStack Query Client

**File**: `apps/web/src/db/query/queryClient.ts`

```typescript
import { QueryClient } from '@tanstack/react-query';
import { db } from '../dexie/database';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 minutes
      gcTime: 30 * 60 * 1000,          // 30 minutes
      refetchOnWindowFocus: false,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,
    },
  },
});

// Hydrate TanStack Query cache from Dexie on startup
export async function hydrateQueryCache(): Promise<void> {
  const maxAge = 30 * 60 * 1000; // 30 minutes
  const now = Date.now();

  // Hydrate entity cache
  const entities = await db.entities
    .filter(e => !e.isDeleted && (now - e.syncedAt) < maxAge)
    .toArray();

  for (const entity of entities) {
    queryClient.setQueryData(
      ['entity', entity.entityCode, entity.entityId],
      {
        data: entity.data,
        metadata: entity.metadata,
        ref_data_entityInstance: entity.refData
      }
    );
  }

  // Hydrate metadata cache
  const metadata = await db.metadata.toArray();
  for (const meta of metadata) {
    if (meta.type === 'datalabel' && meta.key) {
      queryClient.setQueryData(['datalabel', meta.key], meta.data);
    } else if (meta.type === 'entityCodes') {
      queryClient.setQueryData(['entityCodes'], meta.data);
    } else if (meta.type === 'globalSettings') {
      queryClient.setQueryData(['globalSettings'], meta.data);
    }
  }

  console.log(`[QueryClient] Hydrated ${entities.length} entities from Dexie`);
}

// Clear all caches (for logout)
export async function clearAllCaches(): Promise<void> {
  queryClient.clear();
  await db.entities.clear();
  await db.entityLists.clear();
  await db.metadata.clear();
  await db.drafts.clear();
}
```

---

### Phase 2: WebSocket Integration (Day 2 - Morning)

#### 2.1 WebSocket Manager

**File**: `apps/web/src/db/sync/WebSocketManager.ts`

```typescript
import { queryClient } from '../query/queryClient';
import { db } from '../dexie/database';
import { apiClient } from '@/lib/api';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface InvalidatePayload {
  entityCode: string;
  changes: Array<{
    entityId: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    version: number;
  }>;
}

interface WebSocketMessage {
  type: 'INVALIDATE' | 'SUBSCRIBED' | 'PONG' | 'TOKEN_EXPIRING_SOON' | 'ERROR';
  payload?: any;
}

type StatusListener = (status: ConnectionStatus) => void;
type TokenExpiryListener = (expiresIn: number) => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private status: ConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  private pendingSubscriptions = new Map<string, Set<string>>();
  private activeSubscriptions = new Map<string, Set<string>>();
  private processedVersions = new Map<string, number>();

  private statusListeners = new Set<StatusListener>();
  private tokenExpiryListeners = new Set<TokenExpiryListener>();

  // Connection management
  connect(token: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    this.token = token;
    this.setStatus('connecting');

    const wsUrl = `${import.meta.env.VITE_WS_URL || 'ws://localhost:4001'}?token=${token}`;

    try {
      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers();
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      this.setStatus('error');
      this.scheduleReconnect();
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('[WebSocket] Connected');
      this.setStatus('connected');
      this.reconnectAttempts = 0;
      this.startPingInterval();
      this.flushPendingSubscriptions();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log('[WebSocket] Disconnected:', event.code, event.reason);
      this.cleanup();
      this.setStatus('disconnected');

      if (this.token) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      this.setStatus('error');
    };
  }

  private async handleMessage(message: WebSocketMessage): Promise<void> {
    switch (message.type) {
      case 'INVALIDATE':
        await this.handleInvalidate(message.payload as InvalidatePayload);
        break;

      case 'SUBSCRIBED':
        console.log('[WebSocket] Subscription confirmed:', message.payload);
        break;

      case 'PONG':
        // Heartbeat received
        break;

      case 'TOKEN_EXPIRING_SOON':
        this.tokenExpiryListeners.forEach(l => l(message.payload?.expiresIn || 300));
        break;

      case 'ERROR':
        console.error('[WebSocket] Server error:', message.payload);
        break;
    }
  }

  private async handleInvalidate(payload: InvalidatePayload): Promise<void> {
    const { entityCode, changes } = payload;
    console.log(`[WebSocket] Invalidate ${entityCode}:`, changes.length, 'changes');

    const entitiesToRefetch: string[] = [];
    const entitiesToDelete: string[] = [];

    for (const change of changes) {
      const versionKey = `${entityCode}:${change.entityId}`;
      const lastVersion = this.processedVersions.get(versionKey) || 0;

      // Skip stale updates (version tracking)
      if (change.version <= lastVersion) {
        console.log(`[WebSocket] Skipping stale update: ${versionKey}`);
        continue;
      }

      this.processedVersions.set(versionKey, change.version);

      if (change.action === 'DELETE') {
        entitiesToDelete.push(change.entityId);
      } else {
        entitiesToRefetch.push(change.entityId);
      }
    }

    // Handle deletions
    for (const entityId of entitiesToDelete) {
      await this.handleDelete(entityCode, entityId);
    }

    // Handle updates/creates - invalidate TanStack Query cache
    // TanStack Query will auto-refetch if there are active observers
    if (entitiesToRefetch.length > 0) {
      // Invalidate individual entity queries
      for (const entityId of entitiesToRefetch) {
        queryClient.invalidateQueries({
          queryKey: ['entity', entityCode, entityId],
          refetchType: 'active', // Only refetch if component is mounted
        });
      }

      // Invalidate list queries for this entity type
      queryClient.invalidateQueries({
        queryKey: ['entity-list', entityCode],
        refetchType: 'active',
      });
    }
  }

  private async handleDelete(entityCode: string, entityId: string): Promise<void> {
    const cacheKey = `${entityCode}:${entityId}`;

    // Mark as deleted in Dexie
    await db.entities.update(cacheKey, { isDeleted: true });

    // Remove from TanStack Query cache
    queryClient.removeQueries({
      queryKey: ['entity', entityCode, entityId],
    });

    // Invalidate list queries
    queryClient.invalidateQueries({
      queryKey: ['entity-list', entityCode],
      refetchType: 'active',
    });
  }

  // Subscription management
  subscribe(entityCode: string, entityIds: string[]): void {
    if (entityIds.length === 0) return;

    if (this.status !== 'connected') {
      // Queue for later
      const pending = this.pendingSubscriptions.get(entityCode) || new Set();
      entityIds.forEach(id => pending.add(id));
      this.pendingSubscriptions.set(entityCode, pending);
      return;
    }

    // Track active subscriptions
    const active = this.activeSubscriptions.get(entityCode) || new Set();
    const newIds = entityIds.filter(id => !active.has(id));

    if (newIds.length === 0) return;

    newIds.forEach(id => active.add(id));
    this.activeSubscriptions.set(entityCode, active);

    this.send({
      type: 'SUBSCRIBE',
      payload: { entityCode, entityIds: newIds },
    });
  }

  unsubscribe(entityCode: string, entityIds?: string[]): void {
    if (entityIds) {
      const active = this.activeSubscriptions.get(entityCode);
      if (active) {
        entityIds.forEach(id => active.delete(id));
      }
    } else {
      this.activeSubscriptions.delete(entityCode);
    }

    this.send({
      type: entityIds ? 'UNSUBSCRIBE' : 'UNSUBSCRIBE_ALL',
      payload: entityIds ? { entityCode, entityIds } : undefined,
    });
  }

  private flushPendingSubscriptions(): void {
    for (const [entityCode, entityIds] of this.pendingSubscriptions) {
      if (entityIds.size > 0) {
        this.subscribe(entityCode, Array.from(entityIds));
      }
    }
    this.pendingSubscriptions.clear();
  }

  // Token refresh
  refreshToken(newToken: string): void {
    this.token = newToken;
    this.send({
      type: 'TOKEN_REFRESH',
      payload: { token: newToken },
    });
  }

  // Status management
  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.statusListeners.forEach(l => l(status));
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status); // Immediately call with current status
    return () => this.statusListeners.delete(listener);
  }

  onTokenExpiring(listener: TokenExpiryListener): () => void {
    this.tokenExpiryListeners.add(listener);
    return () => this.tokenExpiryListeners.delete(listener);
  }

  // Utilities
  private send(message: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      this.send({ type: 'PING' });
    }, 30000); // 30 seconds
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.token) {
        this.connect(this.token);
      }
    }, delay);
  }

  private cleanup(): void {
    this.stopPingInterval();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  disconnect(): void {
    this.cleanup();
    this.token = null;
    this.activeSubscriptions.clear();
    this.pendingSubscriptions.clear();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.setStatus('disconnected');
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();
```

---

### Phase 3: Core Hooks (Day 2 - Afternoon)

#### 3.1 Entity Hook

**File**: `apps/web/src/db/hooks/useEntity.ts`

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { db } from '../dexie/database';
import { wsManager } from '../sync/WebSocketManager';
import { apiClient } from '@/lib/api';

interface UseEntityOptions {
  enabled?: boolean;
  staleTime?: number;
  refetchOnMount?: boolean;
}

interface EntityResponse<T> {
  data: T;
  metadata?: Record<string, any>;
  ref_data_entityInstance?: Record<string, Record<string, string>>;
}

export function useEntity<T = any>(
  entityCode: string,
  entityId: string | undefined,
  options: UseEntityOptions = {}
) {
  const queryClient = useQueryClient();
  const { enabled = true, staleTime, refetchOnMount = true } = options;

  const query = useQuery<EntityResponse<T>>({
    queryKey: ['entity', entityCode, entityId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/v1/${entityCode}/${entityId}`);

      // Persist to Dexie for offline access
      await db.entities.put({
        _id: `${entityCode}:${entityId}`,
        entityCode,
        entityId: entityId!,
        data: response.data,
        metadata: response.metadata,
        refData: response.ref_data_entityInstance,
        version: response.data.version || Date.now(),
        syncedAt: Date.now(),
      });

      return response;
    },
    enabled: enabled && !!entityId,
    staleTime,
    refetchOnMount,
    // Hydrate from Dexie if available
    initialData: () => {
      const cached = queryClient.getQueryData<EntityResponse<T>>(['entity', entityCode, entityId]);
      return cached;
    },
    placeholderData: (previousData) => previousData,
  });

  // Auto-subscribe to WebSocket updates
  useEffect(() => {
    if (entityId && query.isSuccess) {
      wsManager.subscribe(entityCode, [entityId]);
    }

    return () => {
      // Optional: unsubscribe on unmount
      // wsManager.unsubscribe(entityCode, [entityId]);
    };
  }, [entityCode, entityId, query.isSuccess]);

  return {
    data: query.data?.data,
    metadata: query.data?.metadata,
    refData: query.data?.ref_data_entityInstance,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
```

#### 3.2 Entity List Hook

**File**: `apps/web/src/db/hooks/useEntityList.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { db } from '../dexie/database';
import { wsManager } from '../sync/WebSocketManager';
import { apiClient } from '@/lib/api';

interface UseEntityListParams {
  limit?: number;
  offset?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  [key: string]: any;
}

interface UseEntityListOptions {
  enabled?: boolean;
  staleTime?: number;
  refetchOnMount?: boolean;
}

interface EntityListResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  metadata?: Record<string, any>;
  ref_data_entityInstance?: Record<string, Record<string, string>>;
}

export function useEntityList<T = any>(
  entityCode: string,
  params: UseEntityListParams = {},
  options: UseEntityListOptions = {}
) {
  const { enabled = true, staleTime = 2 * 60 * 1000, refetchOnMount = true } = options;

  // Stable query hash for caching
  const queryHash = useMemo(() => JSON.stringify(params), [params]);

  const query = useQuery<EntityListResponse<T>>({
    queryKey: ['entity-list', entityCode, params],
    queryFn: async () => {
      const response = await apiClient.get(`/api/v1/${entityCode}`, { params });

      // Persist individual entities to Dexie
      const batch = response.data.map((item: any) => ({
        _id: `${entityCode}:${item.id}`,
        entityCode,
        entityId: item.id,
        data: item,
        version: item.version || Date.now(),
        syncedAt: Date.now(),
      }));

      await db.entities.bulkPut(batch);

      // Persist list query result
      await db.entityLists.put({
        _id: `${entityCode}:${queryHash}`,
        entityCode,
        queryHash,
        params,
        entityIds: response.data.map((d: any) => d.id),
        total: response.total,
        metadata: response.metadata,
        syncedAt: Date.now(),
      });

      return response;
    },
    enabled,
    staleTime,
    refetchOnMount,
    placeholderData: (previousData) => previousData,
  });

  // Auto-subscribe to all loaded entity IDs
  useEffect(() => {
    if (query.data?.data) {
      const entityIds = query.data.data.map((d: any) => d.id);
      if (entityIds.length > 0) {
        wsManager.subscribe(entityCode, entityIds);
      }
    }
  }, [entityCode, query.data]);

  return {
    data: query.data?.data,
    total: query.data?.total ?? 0,
    limit: query.data?.limit ?? params.limit ?? 20,
    offset: query.data?.offset ?? params.offset ?? 0,
    metadata: query.data?.metadata,
    refData: query.data?.ref_data_entityInstance,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
```

#### 3.3 Offline Entity Hook (Dexie only)

**File**: `apps/web/src/db/hooks/useOfflineEntity.ts`

```typescript
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../dexie/database';

/**
 * Offline-first hook that reads directly from Dexie/IndexedDB
 * Use when you need reactive updates from local cache only
 */
export function useOfflineEntity<T = any>(
  entityCode: string,
  entityId: string | undefined
) {
  const cached = useLiveQuery(
    async () => {
      if (!entityId) return null;
      const entity = await db.entities.get(`${entityCode}:${entityId}`);
      return entity?.isDeleted ? null : entity;
    },
    [entityCode, entityId]
  );

  const isStale = cached
    ? Date.now() - cached.syncedAt > 5 * 60 * 1000 // 5 minutes
    : true;

  return {
    data: cached?.data as T | undefined,
    metadata: cached?.metadata,
    refData: cached?.refData,
    isLoading: cached === undefined,
    isStale,
    syncedAt: cached?.syncedAt,
    version: cached?.version,
  };
}

/**
 * Offline-first list hook - reads all entities of a type from Dexie
 */
export function useOfflineEntityList<T = any>(entityCode: string) {
  const items = useLiveQuery(
    async () => {
      return db.entities
        .where('entityCode')
        .equals(entityCode)
        .and(item => !item.isDeleted)
        .sortBy('syncedAt');
    },
    [entityCode]
  );

  return {
    data: items?.map(i => i.data) as T[] | undefined,
    isLoading: items === undefined,
    count: items?.length ?? 0,
  };
}
```

---

### Phase 4: Metadata Hooks (Day 3 - Morning)

#### 4.1 Datalabel Hook

**File**: `apps/web/src/db/hooks/useDatalabel.ts`

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../dexie/database';
import { apiClient } from '@/lib/api';

interface DatalabelOption {
  code: string;
  label: string;
  color?: string;
  sort_order?: number;
  metadata?: Record<string, any>;
}

export function useDatalabel(datalabelKey: string) {
  const query = useQuery<DatalabelOption[]>({
    queryKey: ['datalabel', datalabelKey],
    queryFn: async () => {
      const response = await apiClient.get(`/api/v1/datalabel/${datalabelKey}`);

      // Persist to Dexie
      await db.metadata.put({
        _id: `datalabel:${datalabelKey}`,
        type: 'datalabel',
        key: datalabelKey,
        data: response.data,
        syncedAt: Date.now(),
      });

      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });

  return {
    options: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    getOption: (code: string) => query.data?.find(o => o.code === code),
    getLabel: (code: string) => query.data?.find(o => o.code === code)?.label ?? code,
    getColor: (code: string) => query.data?.find(o => o.code === code)?.color,
  };
}

// ============================================
// Sync access for non-hook contexts (formatters, utilities)
// ============================================

let datalabelSyncCache = new Map<string, DatalabelOption[]>();

export function getDatalabelSync(key: string): DatalabelOption[] | null {
  return datalabelSyncCache.get(key) ?? null;
}

export function setDatalabelSync(key: string, options: DatalabelOption[]): void {
  datalabelSyncCache.set(key, options);
}

export async function prefetchAllDatalabels(): Promise<void> {
  try {
    const response = await apiClient.get('/api/v1/datalabel/all');

    for (const [key, options] of Object.entries(response.data)) {
      const opts = options as DatalabelOption[];
      datalabelSyncCache.set(key, opts);

      await db.metadata.put({
        _id: `datalabel:${key}`,
        type: 'datalabel',
        key,
        data: opts,
        syncedAt: Date.now(),
      });
    }

    console.log(`[Datalabel] Prefetched ${Object.keys(response.data).length} datalabels`);
  } catch (error) {
    console.error('[Datalabel] Prefetch failed:', error);

    // Fallback to Dexie cache
    const cached = await db.metadata
      .where('type')
      .equals('datalabel')
      .toArray();

    for (const item of cached) {
      if (item.key) {
        datalabelSyncCache.set(item.key, item.data);
      }
    }
  }
}

export function clearDatalabelCache(): void {
  datalabelSyncCache.clear();
}
```

#### 4.2 Entity Codes Hook

**File**: `apps/web/src/db/hooks/useEntityCodes.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { db } from '../dexie/database';
import { apiClient } from '@/lib/api';

interface EntityType {
  code: string;
  label: string;
  label_plural: string;
  icon?: string;
  child_entity_codes?: string[];
  metadata?: Record<string, any>;
}

export function useEntityCodes() {
  const query = useQuery<EntityType[]>({
    queryKey: ['entityCodes'],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/entity/types');

      await db.metadata.put({
        _id: 'entityCodes',
        type: 'entityCodes',
        data: response.data,
        syncedAt: Date.now(),
      });

      return response.data;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });

  return {
    entityCodes: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    getEntityByCode: (code: string) => query.data?.find(e => e.code === code),
    getLabel: (code: string) => query.data?.find(e => e.code === code)?.label ?? code,
    getIcon: (code: string) => query.data?.find(e => e.code === code)?.icon,
    getChildCodes: (code: string) => query.data?.find(e => e.code === code)?.child_entity_codes ?? [],
  };
}

// ============================================
// Sync access for non-hook contexts
// ============================================

let entityCodesSyncCache: EntityType[] | null = null;

export function getEntityCodesSync(): EntityType[] | null {
  return entityCodesSyncCache;
}

export function getEntityByCodeSync(code: string): EntityType | undefined {
  return entityCodesSyncCache?.find(e => e.code === code);
}

export async function prefetchEntityCodes(): Promise<void> {
  try {
    const response = await apiClient.get('/api/v1/entity/types');
    entityCodesSyncCache = response.data;

    await db.metadata.put({
      _id: 'entityCodes',
      type: 'entityCodes',
      data: response.data,
      syncedAt: Date.now(),
    });

    console.log(`[EntityCodes] Prefetched ${response.data.length} entity types`);
  } catch (error) {
    console.error('[EntityCodes] Prefetch failed:', error);

    // Fallback to Dexie cache
    const cached = await db.metadata.get('entityCodes');
    if (cached) {
      entityCodesSyncCache = cached.data;
    }
  }
}

export function clearEntityCodesCache(): void {
  entityCodesSyncCache = null;
}
```

#### 4.3 Global Settings Hook

**File**: `apps/web/src/db/hooks/useGlobalSettings.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { db } from '../dexie/database';
import { apiClient } from '@/lib/api';

interface GlobalSettings {
  currency: string;
  dateFormat: string;
  timeFormat: string;
  timezone: string;
  locale: string;
  [key: string]: any;
}

export function useGlobalSettings() {
  const query = useQuery<GlobalSettings>({
    queryKey: ['globalSettings'],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/settings/global');

      await db.metadata.put({
        _id: 'globalSettings',
        type: 'globalSettings',
        data: response.data,
        syncedAt: Date.now(),
      });

      return response.data;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  return {
    settings: query.data,
    isLoading: query.isLoading,
    getSetting: <T = any>(key: string, defaultValue?: T): T =>
      (query.data?.[key] ?? defaultValue) as T,
  };
}

// Sync access
let globalSettingsSyncCache: GlobalSettings | null = null;

export function getGlobalSettingsSync(): GlobalSettings | null {
  return globalSettingsSyncCache;
}

export function getSettingSync<T = any>(key: string, defaultValue?: T): T | undefined {
  return (globalSettingsSyncCache?.[key] ?? defaultValue) as T | undefined;
}

export async function prefetchGlobalSettings(): Promise<void> {
  try {
    const response = await apiClient.get('/api/v1/settings/global');
    globalSettingsSyncCache = response.data;

    await db.metadata.put({
      _id: 'globalSettings',
      type: 'globalSettings',
      data: response.data,
      syncedAt: Date.now(),
    });
  } catch (error) {
    console.error('[GlobalSettings] Prefetch failed:', error);

    const cached = await db.metadata.get('globalSettings');
    if (cached) {
      globalSettingsSyncCache = cached.data;
    }
  }
}
```

---

### Phase 5: Draft Persistence (Day 3 - Afternoon)

#### 5.1 Draft Hook

**File**: `apps/web/src/db/hooks/useDraft.ts`

```typescript
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo } from 'react';
import { db, CachedDraft } from '../dexie/database';

interface UseDraftOptions {
  maxUndoStack?: number;
}

export function useDraft<T extends Record<string, any>>(
  entityCode: string,
  entityId: string | undefined,
  originalData?: T,
  options: UseDraftOptions = {}
) {
  const { maxUndoStack = 50 } = options;
  const draftId = entityId ? `draft:${entityCode}:${entityId}` : undefined;

  // Reactive draft from Dexie
  const draft = useLiveQuery(
    async () => {
      if (!draftId) return null;
      return db.drafts.get(draftId);
    },
    [draftId]
  );

  const currentData = useMemo(() =>
    draft?.currentData ?? originalData,
    [draft, originalData]
  );

  const hasChanges = useMemo(() => {
    if (!draft || !originalData) return false;
    return JSON.stringify(draft.currentData) !== JSON.stringify(originalData);
  }, [draft, originalData]);

  const updateField = useCallback(async (field: string, value: any) => {
    if (!draftId || !originalData) return;

    const existing = await db.drafts.get(draftId);
    const prevData = existing?.currentData ?? originalData;
    const newData = { ...prevData, [field]: value };

    // Limit undo stack size
    const undoStack = [...(existing?.undoStack ?? []), prevData].slice(-maxUndoStack);

    await db.drafts.put({
      _id: draftId,
      entityCode,
      entityId: entityId!,
      originalData,
      currentData: newData,
      undoStack,
      redoStack: [], // Clear redo on new change
      updatedAt: Date.now(),
    });
  }, [draftId, entityCode, entityId, originalData, maxUndoStack]);

  const updateFields = useCallback(async (updates: Partial<T>) => {
    if (!draftId || !originalData) return;

    const existing = await db.drafts.get(draftId);
    const prevData = existing?.currentData ?? originalData;
    const newData = { ...prevData, ...updates };

    const undoStack = [...(existing?.undoStack ?? []), prevData].slice(-maxUndoStack);

    await db.drafts.put({
      _id: draftId,
      entityCode,
      entityId: entityId!,
      originalData,
      currentData: newData,
      undoStack,
      redoStack: [],
      updatedAt: Date.now(),
    });
  }, [draftId, entityCode, entityId, originalData, maxUndoStack]);

  const undo = useCallback(async () => {
    if (!draftId) return;

    const existing = await db.drafts.get(draftId);
    if (!existing?.undoStack.length) return;

    const prevData = existing.undoStack[existing.undoStack.length - 1];

    await db.drafts.put({
      ...existing,
      currentData: prevData,
      undoStack: existing.undoStack.slice(0, -1),
      redoStack: [...existing.redoStack, existing.currentData],
      updatedAt: Date.now(),
    });
  }, [draftId]);

  const redo = useCallback(async () => {
    if (!draftId) return;

    const existing = await db.drafts.get(draftId);
    if (!existing?.redoStack.length) return;

    const nextData = existing.redoStack[existing.redoStack.length - 1];

    await db.drafts.put({
      ...existing,
      currentData: nextData,
      undoStack: [...existing.undoStack, existing.currentData],
      redoStack: existing.redoStack.slice(0, -1),
      updatedAt: Date.now(),
    });
  }, [draftId]);

  const reset = useCallback(async () => {
    if (!draftId || !originalData) return;

    const existing = await db.drafts.get(draftId);
    if (!existing) return;

    await db.drafts.put({
      ...existing,
      currentData: originalData,
      undoStack: [...existing.undoStack, existing.currentData],
      redoStack: [],
      updatedAt: Date.now(),
    });
  }, [draftId, originalData]);

  const discard = useCallback(async () => {
    if (draftId) {
      await db.drafts.delete(draftId);
    }
  }, [draftId]);

  return {
    currentData: currentData as T,
    hasChanges,
    canUndo: (draft?.undoStack.length ?? 0) > 0,
    canRedo: (draft?.redoStack.length ?? 0) > 0,
    updateField,
    updateFields,
    undo,
    redo,
    reset,
    discard,
    isDraftLoading: draft === undefined,
  };
}

// Recover unsaved drafts on page load
export function useRecoverDrafts() {
  const drafts = useLiveQuery(
    () => db.drafts.orderBy('updatedAt').reverse().toArray()
  );

  const recoverDraft = useCallback(async (draftId: string) => {
    return db.drafts.get(draftId);
  }, []);

  const discardDraft = useCallback(async (draftId: string) => {
    await db.drafts.delete(draftId);
  }, []);

  const discardAllDrafts = useCallback(async () => {
    await db.drafts.clear();
  }, []);

  return {
    drafts: drafts ?? [],
    recoverDraft,
    discardDraft,
    discardAllDrafts,
    hasDrafts: (drafts?.length ?? 0) > 0,
  };
}
```

---

### Phase 6: Provider Setup (Day 4)

#### 6.1 Cache Provider

**File**: `apps/web/src/db/CacheProvider.tsx`

```typescript
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode
} from 'react';
import { queryClient, hydrateQueryCache, clearAllCaches } from './query/queryClient';
import { wsManager } from './sync/WebSocketManager';
import { prefetchAllDatalabels, clearDatalabelCache } from './hooks/useDatalabel';
import { prefetchEntityCodes, clearEntityCodesCache } from './hooks/useEntityCodes';
import { prefetchGlobalSettings } from './hooks/useGlobalSettings';
import { useAuth } from '@/lib/hooks/useAuth';

type SyncStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface CacheContextValue {
  syncStatus: SyncStatus;
  isHydrated: boolean;
  isMetadataLoaded: boolean;
  clearCache: () => Promise<void>;
}

const CacheContext = createContext<CacheContextValue>({
  syncStatus: 'disconnected',
  isHydrated: false,
  isMetadataLoaded: false,
  clearCache: async () => {},
});

interface CacheProviderProps {
  children: ReactNode;
}

export function CacheProvider({ children }: CacheProviderProps) {
  const { token, isAuthenticated, user } = useAuth();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('disconnected');
  const [isHydrated, setIsHydrated] = useState(false);
  const [isMetadataLoaded, setIsMetadataLoaded] = useState(false);

  // Hydrate from Dexie on mount
  useEffect(() => {
    hydrateQueryCache()
      .then(() => {
        setIsHydrated(true);
        console.log('[CacheProvider] Hydration complete');
      })
      .catch((error) => {
        console.error('[CacheProvider] Hydration failed:', error);
        setIsHydrated(true); // Continue anyway
      });
  }, []);

  // Connect WebSocket and prefetch metadata when authenticated
  useEffect(() => {
    if (isAuthenticated && token && isHydrated) {
      // Connect WebSocket
      wsManager.connect(token);

      // Prefetch all metadata in parallel
      Promise.all([
        prefetchAllDatalabels(),
        prefetchEntityCodes(),
        prefetchGlobalSettings(),
      ])
        .then(() => {
          setIsMetadataLoaded(true);
          console.log('[CacheProvider] Metadata prefetch complete');
        })
        .catch((error) => {
          console.error('[CacheProvider] Metadata prefetch failed:', error);
          setIsMetadataLoaded(true); // Continue with cached data
        });
    }

    return () => {
      if (!isAuthenticated) {
        wsManager.disconnect();
      }
    };
  }, [isAuthenticated, token, isHydrated]);

  // Track connection status
  useEffect(() => {
    return wsManager.onStatusChange(setSyncStatus);
  }, []);

  // Handle token refresh
  useEffect(() => {
    return wsManager.onTokenExpiring((expiresIn) => {
      console.log(`[CacheProvider] Token expiring in ${expiresIn}s`);
      // Trigger token refresh via auth hook
    });
  }, []);

  // Clear all caches (for logout)
  const clearCache = useCallback(async () => {
    wsManager.disconnect();
    clearDatalabelCache();
    clearEntityCodesCache();
    await clearAllCaches();
    setIsMetadataLoaded(false);
  }, []);

  const contextValue: CacheContextValue = {
    syncStatus,
    isHydrated,
    isMetadataLoaded,
    clearCache,
  };

  return (
    <QueryClientProvider client={queryClient}>
      <CacheContext.Provider value={contextValue}>
        {children}
      </CacheContext.Provider>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

// Hook to access cache context
export function useCacheContext() {
  return useContext(CacheContext);
}

// Hook for sync status only
export function useSyncStatus() {
  const { syncStatus } = useContext(CacheContext);
  return syncStatus;
}

// Hook to check if app is ready
export function useIsAppReady() {
  const { isHydrated, isMetadataLoaded } = useContext(CacheContext);
  return isHydrated && isMetadataLoaded;
}
```

#### 6.2 Hooks Index

**File**: `apps/web/src/db/hooks/index.ts`

```typescript
// Entity hooks
export { useEntity } from './useEntity';
export { useEntityList } from './useEntityList';
export { useOfflineEntity, useOfflineEntityList } from './useOfflineEntity';

// Metadata hooks
export {
  useDatalabel,
  getDatalabelSync,
  setDatalabelSync,
  prefetchAllDatalabels,
  clearDatalabelCache,
} from './useDatalabel';

export {
  useEntityCodes,
  getEntityCodesSync,
  getEntityByCodeSync,
  prefetchEntityCodes,
  clearEntityCodesCache,
} from './useEntityCodes';

export {
  useGlobalSettings,
  getGlobalSettingsSync,
  getSettingSync,
  prefetchGlobalSettings,
} from './useGlobalSettings';

// Draft hooks
export { useDraft, useRecoverDrafts } from './useDraft';
```

#### 6.3 Main Index

**File**: `apps/web/src/db/index.ts`

```typescript
// Database
export { db } from './dexie/database';
export type {
  CachedEntity,
  CachedEntityList,
  CachedMetadata,
  CachedDraft
} from './dexie/database';

// Query client
export { queryClient, hydrateQueryCache, clearAllCaches } from './query/queryClient';

// WebSocket manager
export { wsManager } from './sync/WebSocketManager';

// Provider
export {
  CacheProvider,
  useCacheContext,
  useSyncStatus,
  useIsAppReady
} from './CacheProvider';

// All hooks
export * from './hooks';
```

---

### Phase 7: Migration of Existing Files (Day 5)

#### 7.1 Files to Update

| File | Change |
|------|--------|
| `App.tsx` | Replace `RxDBProvider` with `CacheProvider` |
| `EntityListOfInstancesPage.tsx` | `useRxEntityList` → `useEntityList` |
| `EntitySpecificInstancePage.tsx` | `useRxEntity` → `useEntity` |
| `EntityInstanceFormContainer.tsx` | `useRxDraft` → `useDraft` |
| `DynamicChildEntityTabs.tsx` | `useRxEntityCodes` → `useEntityCodes` |
| `frontEndFormatterService.tsx` | Verify `getDatalabelSync` API compatibility |
| All badge/dropdown components | `useRxDatalabel` → `useDatalabel` |

#### 7.2 Migration Script

```typescript
// Migration helper - run once then remove
// apps/web/src/db/migrateFromRxDB.ts

import { db as dexieDb } from './dexie/database';

export async function migrateFromRxDB(): Promise<void> {
  // Check if migration needed
  const migrationKey = 'pmo-rxdb-to-dexie-migration';
  if (localStorage.getItem(migrationKey)) {
    return;
  }

  try {
    // Open old RxDB database
    const oldDbRequest = indexedDB.open('pmo-rxdb');

    oldDbRequest.onsuccess = async (event) => {
      const oldDb = (event.target as IDBOpenDBRequest).result;

      // Migrate each collection...
      // (Implementation depends on RxDB schema)

      oldDb.close();

      // Delete old database
      indexedDB.deleteDatabase('pmo-rxdb');

      localStorage.setItem(migrationKey, Date.now().toString());
      console.log('[Migration] RxDB to Dexie complete');
    };
  } catch (error) {
    console.error('[Migration] Failed:', error);
  }
}
```

---

## 5. Testing Strategy

### 5.1 Unit Tests

```typescript
// apps/web/src/db/__tests__/useEntity.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { useEntity } from '../hooks/useEntity';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useEntity', () => {
  it('fetches entity and persists to Dexie', async () => {
    const { result } = renderHook(
      () => useEntity('project', 'test-id'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeDefined();
  });
});
```

### 5.2 Integration Tests

- WebSocket connection/reconnection
- Cache invalidation flow
- Offline persistence and recovery
- Multi-tab synchronization
- Draft persistence across page refresh

### 5.3 E2E Tests

- Full CRUD flow with real-time sync
- Offline mode editing
- Browser refresh with cache hydration

---

## 6. Rollback Plan

If issues arise during migration:

1. **Feature flag**: Wrap new implementation in feature flag
2. **Parallel running**: Run both systems temporarily
3. **Data export**: Export Dexie data back to RxDB format
4. **Quick revert**: Keep RxDB code in separate branch

```typescript
// Feature flag approach
const USE_NEW_CACHE = import.meta.env.VITE_USE_TANSTACK_DEXIE === 'true';

export const useEntityData = USE_NEW_CACHE ? useEntity : useRxEntity;
```

---

## 7. Timeline

| Day | Phase | Deliverables |
|-----|-------|--------------|
| 1 | Foundation | Dexie schema, QueryClient, basic setup |
| 2 | WebSocket + Core Hooks | WebSocketManager, useEntity, useEntityList |
| 3 | Metadata + Drafts | useDatalabel, useEntityCodes, useDraft |
| 4 | Provider + Integration | CacheProvider, App.tsx update |
| 5 | Migration + Testing | Update consumers, tests, cleanup |

---

## 8. Success Criteria

- [ ] All existing functionality preserved
- [ ] Bundle size reduced by 50%+ (150KB → ~70KB)
- [ ] React Query DevTools working
- [ ] Offline persistence verified
- [ ] Real-time sync via WebSocket working
- [ ] Multi-tab sync working
- [ ] Draft persistence across refresh working
- [ ] No RxDB/RxJS imports remaining
- [ ] All tests passing

---

## 9. References

- [TanStack Query v5 Docs](https://tanstack.com/query/latest)
- [Dexie.js Docs](https://dexie.org/)
- [dexie-react-hooks](https://dexie.org/docs/dexie-react-hooks/useLiveQuery())
- Current RxDB implementation: `apps/web/src/db/rxdb/`
- Current WebSocket docs: `docs/caching/RXDB_SYNC_ARCHITECTURE.md`

---

**Document Version**: 1.0.0
**Last Updated**: 2025-11-28
**Author**: Claude Code Assistant
