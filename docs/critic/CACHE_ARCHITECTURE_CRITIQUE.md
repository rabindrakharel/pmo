# Cache Architecture Critical Analysis

**Document Version:** 1.0
**Analysis Date:** 2025-12-03
**Scope:** Backend (Redis) + Frontend (TanStack Query + Dexie) + WebSocket Sync
**Reviewer:** Architecture Review

---

## Executive Summary

The PMO platform implements a **three-layer caching architecture**:

1. **Backend**: Redis for field metadata (24h) and API response caching (3s)
2. **Frontend Memory**: TanStack Query for server state management
3. **Frontend Persistence**: Dexie/IndexedDB for offline-first data

**Overall Assessment**: The architecture demonstrates solid foundational choices but exhibits several patterns that deviate from industry best practices. The system works but carries technical debt that will compound as the application scales.

| Category | Grade | Notes |
|----------|-------|-------|
| **Cache Coherence** | B- | Eventual consistency with gaps in invalidation |
| **Memory Management** | C+ | No bounded caches, potential memory leaks |
| **Error Handling** | B | Graceful degradation exists but is inconsistent |
| **Observability** | D | Minimal logging, no metrics, no cache hit/miss tracking |
| **Performance** | B+ | Good TTL choices, but no read-through optimization |
| **Scalability** | C | Single Redis instance, no sharding strategy |

---

## Part 1: Backend Redis Caching Critique

### 1.1 What You're Doing Right

**Graceful Degradation Pattern**
```typescript
// Your implementation (entity-component-metadata.service.ts:445-520)
try {
  const cached = await redis.get(cacheKey);
  return cached ? JSON.parse(cached) : null;
} catch (error) {
  console.warn(`Redis read error`);
  return null; // Fallback to compute
}
```

This is correct. Industry standard demands that cache failures never break the application.

**Appropriate TTL Differentiation**
- Field cache: 24 hours (low-change metadata)
- Response cache: 3 seconds (frequently changing data)

This tiered approach aligns with the Cache-Aside Pattern for different data volatility.

### 1.2 Critical Issues

#### Issue #1: No Cache Stampede Protection

**Problem**: When cached data expires, multiple concurrent requests can hit the database simultaneously.

```
Time T0: Cache expires
Time T1: Request A → cache miss → starts DB query
Time T2: Request B → cache miss → starts DB query
Time T3: Request C → cache miss → starts DB query
         ...
         All N concurrent requests hammer the database
```

**Industry Standard Solution**: Probabilistic Early Expiration (PER) or Mutex/Locking

```typescript
// Industry pattern: Mutex-based cache refresh
async function getWithStampedeProtection(key: string, compute: () => Promise<T>, ttl: number) {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const lockKey = `lock:${key}`;
  const lockAcquired = await redis.set(lockKey, '1', 'NX', 'EX', 10);

  if (!lockAcquired) {
    // Another process is computing - wait and retry
    await sleep(100);
    return getWithStampedeProtection(key, compute, ttl);
  }

  try {
    const value = await compute();
    await redis.setex(key, ttl, JSON.stringify(value));
    return value;
  } finally {
    await redis.del(lockKey);
  }
}
```

**Your Risk Level**: Medium. With 27+ entity types and multiple concurrent users, cache stampedes on field metadata expiration could cause database connection pool exhaustion.

---

#### Issue #2: No Read-Through Caching

**Current Pattern** (Cache-Aside):
```typescript
// Your approach
const cached = await getCachedFieldNames(entityCode);
if (!cached) {
  const computed = await computeFieldNames();
  await cacheFieldNames(entityCode, computed);
  return computed;
}
```

**Industry Standard** (Read-Through with Loader):
```typescript
// Industry pattern: Cache loader
const cache = new NodeCache({
  stdTTL: 86400,
  useClones: false,
  fetchMethod: async (key) => {
    return await computeFieldNames(key);
  }
});

// Usage - single call handles miss + compute + cache
const fields = await cache.fetch(entityCode);
```

**Why This Matters**: Read-through centralizes cache population logic, eliminates scattered `if (!cached)` checks, and naturally handles stampede protection.

---

#### Issue #3: Cache Key Collision Risk

**Current Key Pattern**:
```
entity:fields:{entityCode}
api:metadata:/api/v1/{entity}?content=metadata
```

**Problems**:
1. No namespace versioning for cache invalidation during deployments
2. API path keys can collide with query parameter ordering (`?a=1&b=2` vs `?b=2&a=1`)

**Industry Standard**:
```typescript
// Versioned namespace
const CACHE_VERSION = 'v2';
const key = `pmo:${CACHE_VERSION}:entity:fields:${entityCode}`;

// Normalized query params
function normalizeKey(path: string, params: Record<string, any>) {
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  return `pmo:${CACHE_VERSION}:api:${path}?${sorted}`;
}
```

---

#### Issue #4: No Cache Metrics

**Missing Observability**:
```typescript
// You have this
console.warn(`[FieldCache] Redis read error...`);

// You're missing this
metrics.increment('cache.field.hit');
metrics.increment('cache.field.miss');
metrics.timing('cache.field.latency', duration);
metrics.gauge('cache.field.size', await redis.dbsize());
```

**Industry Standard**: Every production cache should expose:
- Hit/miss ratio (target: >95% for metadata caches)
- Latency percentiles (p50, p95, p99)
- Memory usage
- Eviction rate

**Recommendation**: Integrate with Prometheus/Grafana or use `prom-client` for Node.js.

---

#### Issue #5: Inconsistent Serialization

**Current**: Direct `JSON.stringify/parse` with no validation

```typescript
// Your code
return cached ? JSON.parse(cached) : null;
```

**Industry Standard**: Type-safe serialization with schema validation

```typescript
// Industry pattern: Validated deserialization
import { z } from 'zod';

const FieldCacheSchema = z.array(z.string());

function deserialize(cached: string | null): string[] | null {
  if (!cached) return null;
  const result = FieldCacheSchema.safeParse(JSON.parse(cached));
  if (!result.success) {
    logger.error('Cache corruption detected', { cached, error: result.error });
    return null; // Force recompute
  }
  return result.data;
}
```

**Risk**: Corrupted cache data causes runtime crashes instead of graceful fallback.

---

### 1.3 Backend Cache Scorecard

| Criterion | Industry Standard | Your Implementation | Gap |
|-----------|-------------------|---------------------|-----|
| Stampede Protection | Mutex/PER algorithm | None | Critical |
| Cache Pattern | Read-Through | Cache-Aside | Moderate |
| Key Namespacing | Versioned + normalized | Unversioned | Moderate |
| Metrics | Full observability | console.warn only | Critical |
| Serialization | Schema-validated | Raw JSON | Minor |
| TTL Strategy | Tiered by volatility | ✓ Implemented | None |
| Graceful Degradation | Always fallback | ✓ Implemented | None |

---

## Part 2: Frontend TanStack Query Critique

### 2.1 What You're Doing Right

**Two-Tier Store Architecture**
```typescript
// Session stores: 10 min stale, 1 hour GC
// On-demand stores: 1 min stale, 30 min GC
```

This correctly differentiates between low-volatility metadata and high-volatility entity data.

**Query Key Factory Pattern**
```typescript
QUERY_KEYS.entityInstanceData(entityCode, params)
QUERY_KEYS.datalabel(key)
```

Centralized key generation prevents typos and enables type-safe invalidation.

**Unified Naming with Dexie**
```
TanStack Query key → Dexie table name
```

This 1:1 mapping simplifies debugging and prevents desync issues.

### 2.2 Critical Issues

#### Issue #6: Unbounded Query Cache

**Current Configuration**:
```typescript
gcTime: 30 * 60 * 1000 // 30 minutes
// No maxSize configuration
```

**Problem**: TanStack Query's cache is unbounded by default. A user browsing 500 entities creates 500 cache entries, all persisting for 30 minutes.

**Industry Standard**: LRU (Least Recently Used) eviction

```typescript
// Industry pattern: Bounded cache with LRU
import LRU from 'lru-cache';

const queryCache = new LRU({
  max: 500,              // Max 500 queries cached
  maxSize: 50_000_000,   // 50MB max
  sizeCalculation: (value) => JSON.stringify(value).length,
  ttl: 30 * 60 * 1000,
});
```

**Note**: TanStack Query v5 doesn't natively support LRU. You need a custom `QueryCache` implementation or periodic cleanup.

**Recommendation**:
```typescript
// Manual cleanup for large caches
function cleanupOldQueries() {
  const cache = queryClient.getQueryCache();
  const queries = cache.getAll();

  if (queries.length > 500) {
    const sorted = queries.sort((a, b) =>
      a.state.dataUpdatedAt - b.state.dataUpdatedAt
    );
    sorted.slice(0, queries.length - 500).forEach(q => cache.remove(q));
  }
}

// Run every 5 minutes
setInterval(cleanupOldQueries, 5 * 60 * 1000);
```

---

#### Issue #7: Missing Structural Sharing Verification

**TanStack Query Feature**: Structural sharing compares new data with old, preventing re-renders for unchanged data.

**Your Configuration**:
```typescript
// Not explicitly configured
// TanStack Query enables by default
```

**Concern**: Deep objects with functions or circular references break structural sharing silently.

**Industry Standard**: Explicit verification
```typescript
// Test that structural sharing works
const query1 = queryClient.getQueryData(['project', '123']);
const query2 = await queryClient.fetchQuery(['project', '123']);
console.assert(query1.unchangedField === query2.unchangedField, 'Structural sharing failed');
```

---

#### Issue #8: No Request Deduplication Strategy

**Scenario**: User navigates Project List → Project Detail → Back to Project List

**Current Behavior**:
- Each navigation triggers new API call (after stale time)
- Same data fetched multiple times

**Industry Standard**: Request Deduplication + Smart Prefetching

```typescript
// Industry pattern: Prefetch on hover
function ProjectListItem({ project }) {
  const queryClient = useQueryClient();

  return (
    <Link
      to={`/project/${project.id}`}
      onMouseEnter={() => {
        // Prefetch before navigation
        queryClient.prefetchQuery({
          queryKey: ['project', project.id],
          queryFn: () => fetchProject(project.id),
          staleTime: 60 * 1000,
        });
      }}
    />
  );
}
```

**Your Code**: No evidence of systematic prefetching strategy.

---

#### Issue #9: Optimistic Update Implementation Missing

**Current Pattern**: Wait for server response before updating UI

```typescript
// Standard mutation
mutation.mutate(data, {
  onSuccess: () => queryClient.invalidateQueries({ queryKey })
});
```

**Industry Standard**: Optimistic updates for perceived performance

```typescript
// Industry pattern: Optimistic updates
mutation.mutate(data, {
  onMutate: async (newData) => {
    await queryClient.cancelQueries({ queryKey });
    const previous = queryClient.getQueryData(queryKey);

    // Optimistically update
    queryClient.setQueryData(queryKey, (old) => ({
      ...old,
      ...newData,
    }));

    return { previous };
  },
  onError: (err, newData, context) => {
    // Rollback on error
    queryClient.setQueryData(queryKey, context.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey });
  },
});
```

**Impact**: Your UI feels sluggish on entity updates compared to apps with optimistic updates.

---

### 2.3 Frontend Query Cache Scorecard

| Criterion | Industry Standard | Your Implementation | Gap |
|-----------|-------------------|---------------------|-----|
| Store Tiering | Volatility-based TTLs | ✓ Implemented | None |
| Key Factory | Centralized generation | ✓ Implemented | None |
| Cache Bounding | LRU with max size | Unbounded | Critical |
| Prefetching | Hover + route prefetch | Not implemented | Moderate |
| Optimistic Updates | Immediate UI feedback | Not implemented | Moderate |
| Structural Sharing | Verified working | Assumed working | Minor |

---

## Part 3: Dexie/IndexedDB Persistence Critique

### 3.1 What You're Doing Right

**Unified Schema Design**
```typescript
// 8 tables aligned with TanStack Query keys
datalabel, entityCode, globalSetting, entityInstanceData,
entityInstanceMetadata, entityInstance, entityLink, draft
```

Clean separation of concerns with clear data ownership.

**Timestamp-Based Staleness Check**
```typescript
if (now - record.syncedAt > maxAge) {
  return 0; // Skip stale records
}
```

Prevents hydrating obsolete data on app startup.

**Draft Preservation Strategy**
```typescript
// Drafts survive logout
clearAllExceptDrafts()
```

Excellent UX choice - users don't lose unsaved work.

### 3.2 Critical Issues

#### Issue #10: No Storage Quota Management

**IndexedDB Quotas**:
- Chrome: Up to 80% of total disk space (per origin)
- Firefox: Up to 50% of free disk space
- Safari: 1GB (can prompt for more)

**Your Implementation**: No quota checking

**Industry Standard**: Proactive quota management

```typescript
// Industry pattern: Storage quota check
async function checkStorageQuota() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    const percentUsed = (estimate.usage / estimate.quota) * 100;

    if (percentUsed > 80) {
      // Evict old data
      await evictOldestEntityInstanceData(1000); // Remove 1000 records
      console.warn(`Storage at ${percentUsed}%, evicted old data`);
    }
  }
}

// Run on app startup and periodically
```

**Risk**: Users with heavy usage hit quota, causing silent write failures.

---

#### Issue #11: No IndexedDB Transaction Batching

**Current Pattern**: Individual writes

```typescript
// Your approach (inferred)
await db.entityInstanceData.put(record1);
await db.entityInstanceData.put(record2);
await db.entityInstanceData.put(record3);
```

**Industry Standard**: Batched transactions

```typescript
// Industry pattern: Batch writes
await db.transaction('rw', [db.entityInstanceData, db.entityInstanceNames], async () => {
  await db.entityInstanceData.bulkPut(records);
  await db.entityInstanceNames.bulkPut(names);
});
```

**Performance Impact**: Individual writes create separate transactions (disk I/O per operation). Batching reduces I/O by 10-100x for bulk operations.

---

#### Issue #12: Hydration Race Condition

**Current Pattern**:
```typescript
// On app startup
await hydrateFromDexie();  // Load from IndexedDB
// Components render with stale data
// API fetch triggers (background)
// Components re-render with fresh data
```

**Problem**: Brief flash of stale data (can be seconds old or days old).

**Industry Standard**: Stale-While-Revalidate with Visual Indicator

```typescript
// Industry pattern: Show staleness indicator
function EntityList() {
  const { data, isStale, isRefetching } = useEntityList('project');

  return (
    <div className={isStale ? 'opacity-80' : ''}>
      {isRefetching && <RefreshSpinner />}
      {data.map(item => <EntityRow key={item.id} {...item} />)}
    </div>
  );
}
```

**Recommendation**: Add visual feedback when showing potentially stale data.

---

#### Issue #13: No Data Migration Strategy

**Current Schema**:
```typescript
const db = new Dexie('pmo-cache-v5');
// v5 implies previous versions exist
```

**Missing**: Migration handlers for schema changes

**Industry Standard**: Versioned migrations

```typescript
// Industry pattern: Dexie migrations
db.version(5).stores({
  entityInstanceData: '_id, entityCode, queryHash, syncedAt',
});

db.version(6).stores({
  entityInstanceData: '_id, entityCode, queryHash, syncedAt, [entityCode+syncedAt]',
}).upgrade(tx => {
  // Migrate existing data
  return tx.table('entityInstanceData').toCollection().modify(record => {
    record.migratedAt = Date.now();
  });
});
```

**Risk**: Schema changes without migration handlers cause data loss or corruption.

---

### 3.3 Dexie Persistence Scorecard

| Criterion | Industry Standard | Your Implementation | Gap |
|-----------|-------------------|---------------------|-----|
| Schema Design | Normalized + indexed | ✓ Well designed | None |
| Staleness Check | Timestamp validation | ✓ Implemented | None |
| Draft Preservation | Survives logout | ✓ Implemented | None |
| Quota Management | Proactive eviction | Not implemented | Critical |
| Transaction Batching | Bulk operations | Partial (bulkPut exists) | Moderate |
| Stale Data UX | Visual indicators | Not implemented | Minor |
| Schema Migrations | Versioned handlers | Not verified | Moderate |

---

## Part 4: WebSocket Sync Critique

### 4.1 What You're Doing Right

**Version Tracking for Out-of-Order Messages**
```typescript
private processedVersions = new Map<string, { version: number; timestamp: number }>();
```

Correctly handles network reordering and duplicate messages.

**Exponential Backoff Reconnection**
```typescript
maxReconnectAttempts: 10,
initialReconnectDelay: 1 second,
maxReconnectDelay: 30 seconds,
```

Industry-standard reconnection strategy.

**Memory Management for Version Tracking**
```typescript
maxVersionEntries: 1000,
versionEntryTtl: 10 minutes,
```

Prevents unbounded memory growth from long sessions.

### 4.2 Critical Issues

#### Issue #14: No Offline Queue for Mutations

**Current Behavior**: When WebSocket disconnects, mutations still hit API, but invalidation may not propagate.

**Problem**:
1. User A updates entity (WebSocket down)
2. User B (WebSocket up) doesn't get invalidation
3. User B sees stale data until manual refresh

**Industry Standard**: Offline mutation queue

```typescript
// Industry pattern: Queue mutations when offline
class MutationQueue {
  private queue: Array<{ mutation: any; timestamp: number }> = [];
  private isOnline = navigator.onLine;

  async enqueue(mutation: () => Promise<any>) {
    if (this.isOnline && wsManager.isConnected()) {
      return mutation();
    }

    this.queue.push({ mutation, timestamp: Date.now() });
    await this.persistQueue(); // Store in IndexedDB
    return { queued: true };
  }

  async processQueue() {
    while (this.queue.length > 0) {
      const { mutation } = this.queue.shift();
      await mutation();
    }
    await this.persistQueue();
  }
}

// Process queue when WebSocket reconnects
wsManager.on('connected', () => mutationQueue.processQueue());
```

---

#### Issue #15: No Heartbeat Failure Detection

**Current**: Ping every 30 seconds

```typescript
pingInterval: 30 seconds,
```

**Missing**: Pong timeout detection

**Industry Standard**: Bidirectional heartbeat with timeout

```typescript
// Industry pattern: Heartbeat with timeout
let pongReceived = false;

setInterval(() => {
  if (!pongReceived) {
    console.warn('Pong timeout - reconnecting');
    ws.close();
    reconnect();
    return;
  }

  pongReceived = false;
  ws.send(JSON.stringify({ type: 'PING' }));
}, 30_000);

ws.on('message', (msg) => {
  if (msg.type === 'PONG') {
    pongReceived = true;
  }
});
```

**Risk**: "Half-open" connections where server thinks client is connected but client can't receive messages.

---

#### Issue #16: No Message Acknowledgment

**Current**: Fire-and-forget invalidation messages

**Problem**: If message is lost during processing, client never knows.

**Industry Standard**: ACK-based delivery

```typescript
// Industry pattern: Message acknowledgment
// Server sends:
{ type: 'INVALIDATE', messageId: 'abc123', entityCode: 'project', entityId: '...' }

// Client responds:
{ type: 'ACK', messageId: 'abc123' }

// Server retries unacked messages after timeout
```

---

### 4.3 WebSocket Sync Scorecard

| Criterion | Industry Standard | Your Implementation | Gap |
|-----------|-------------------|---------------------|-----|
| Version Tracking | Prevents duplicates | ✓ Implemented | None |
| Reconnection | Exponential backoff | ✓ Implemented | None |
| Memory Bounding | TTL cleanup | ✓ Implemented | None |
| Offline Queue | Persist + replay | Not implemented | Critical |
| Heartbeat Timeout | Detect half-open | Not implemented | Moderate |
| Message ACK | Guaranteed delivery | Not implemented | Moderate |
| Subscription Restore | Resubscribe on reconnect | ✓ Implemented | None |

---

## Part 5: Cross-Cutting Concerns

### 5.1 Cache Coherence Model

**Your Model**: Eventual Consistency with WebSocket

```
Write → API → Database → Trigger → PubSub → WebSocket → Invalidate → Refetch
```

**Latency**: 100-500ms from write to all clients updated

**Gap Analysis**:

| Scenario | Expected | Actual | Issue |
|----------|----------|--------|-------|
| Single user, single tab | Immediate | ~100ms | Acceptable |
| Single user, multi-tab | Immediate | Relies on WebSocket | OK if connected |
| Multi-user | Eventually consistent | Eventually consistent | OK |
| User offline | Stale until refresh | Stale until refresh | No offline indicators |
| WebSocket down | Stale until reconnect | Stale until reconnect | No polling fallback |

**Industry Standard Addition**: Polling fallback when WebSocket fails

```typescript
// Industry pattern: Hybrid sync
if (!wsManager.isConnected()) {
  // Fall back to polling
  setInterval(() => {
    queryClient.invalidateQueries({ queryKey: activeQueryKeys });
  }, 30_000); // Poll every 30 seconds
}
```

---

### 5.2 Memory Leak Vectors

| Vector | Risk | Mitigation Status |
|--------|------|-------------------|
| TanStack Query cache growth | High | ❌ No LRU |
| Dexie table growth | Medium | ❌ No quota management |
| WebSocket version map | Low | ✓ TTL cleanup |
| Event listeners | Low | Not verified |
| Draft accumulation | Low | Manual discard only |

**Recommendation**: Add memory profiling to CI/CD pipeline.

---

### 5.3 Security Considerations

**Positive**:
- JWT in WebSocket authentication
- No sensitive data in cache keys

**Missing**:
- No cache encryption for sensitive data in IndexedDB
- No cache expiration on logout (except explicit clear)

**Industry Standard**: Encrypt sensitive cached data

```typescript
// Industry pattern: Encrypted storage
import { encrypt, decrypt } from 'crypto-helpers';

async function putEncrypted(key: string, data: any) {
  const encrypted = await encrypt(JSON.stringify(data), userKey);
  await db.secureData.put({ key, encrypted });
}
```

---

## Part 6: Comparative Analysis

### 6.1 Industry Reference Architectures

| Company | Pattern | Your Similarity |
|---------|---------|-----------------|
| **Facebook/Meta** | Relay (normalized cache) | Low - no normalization |
| **Netflix** | Falcor (JSON Graph) | Low - no graph model |
| **Notion** | Operational Transform + IndexedDB | Medium - offline-first |
| **Linear** | TanStack Query + IndexedDB | High - similar stack |
| **Figma** | CRDT + WebSocket | Low - no CRDT |

**Closest Match**: Linear's architecture (TanStack Query + IndexedDB + WebSocket)

**Key Difference**: Linear implements:
- Normalized cache (single source of truth per entity)
- Optimistic updates everywhere
- Conflict resolution for offline edits

---

### 6.2 Pattern Comparison

| Pattern | Industry Examples | Your Implementation |
|---------|-------------------|---------------------|
| **Cache-Aside** | Redis typical usage | ✓ Used |
| **Read-Through** | CDNs, Guava Cache | ❌ Not used |
| **Write-Through** | Financial systems | ❌ Not used |
| **Write-Behind** | High-throughput systems | ❌ Not used |
| **Refresh-Ahead** | Content systems | ❌ Not used (would help stampede) |

---

## Part 7: Prioritized Recommendations

### 7.1 Critical (Do Within 2 Weeks)

1. **Add Cache Stampede Protection**
   - Impact: Prevents database overload on cache expiry
   - Effort: 1-2 days
   - Location: [entity-component-metadata.service.ts](apps/api/src/services/entity-component-metadata.service.ts)

2. **Implement TanStack Query Cache Bounding**
   - Impact: Prevents memory leaks in long sessions
   - Effort: 0.5 days
   - Location: [client.ts](apps/web/src/db/cache/client.ts)

3. **Add IndexedDB Quota Management**
   - Impact: Prevents silent storage failures
   - Effort: 1 day
   - Location: [persistence/operations.ts](apps/web/src/db/persistence/operations.ts)

### 7.2 High Priority (Do Within 1 Month)

4. **Add Cache Metrics/Observability**
   - Impact: Enables performance monitoring and debugging
   - Effort: 2-3 days
   - Add: Prometheus metrics for hit/miss ratios, latency

5. **Implement Offline Mutation Queue**
   - Impact: Better offline experience
   - Effort: 3-4 days
   - Location: New module in [realtime/](apps/web/src/db/realtime/)

6. **Add WebSocket Heartbeat Timeout Detection**
   - Impact: Faster recovery from half-open connections
   - Effort: 0.5 days
   - Location: [manager.ts](apps/web/src/db/realtime/manager.ts)

### 7.3 Medium Priority (Do Within Quarter)

7. **Implement Optimistic Updates**
   - Impact: Perceived performance improvement
   - Effort: 3-5 days per entity type
   - Location: Mutation hooks

8. **Add Prefetching Strategy**
   - Impact: Faster navigation
   - Effort: 2-3 days
   - Location: List components

9. **Add Stale Data Visual Indicators**
   - Impact: Better UX for cache staleness
   - Effort: 1 day
   - Location: Components

### 7.4 Low Priority (Backlog)

10. **Cache Key Versioning**
11. **Schema-Validated Deserialization**
12. **Encrypted Sensitive Cache**
13. **Polling Fallback for WebSocket**

---

## Part 8: Architecture Decision Records

### ADR-001: TanStack Query vs Apollo Client

**Context**: Both manage server state with caching.

**Decision**: TanStack Query

**Rationale**:
- Not GraphQL-bound
- Simpler mental model
- Better TypeScript support
- Smaller bundle (~12KB vs ~40KB)

**Assessment**: ✅ Good choice for REST API

---

### ADR-002: Dexie vs RxDB

**Context**: Both provide IndexedDB abstraction.

**Decision**: Dexie (v9.1.0 migration from RxDB)

**Rationale**:
- Bundle size: ~25KB vs ~150KB
- Simpler API (no reactive subscriptions needed with TanStack Query)
- Better raw performance

**Assessment**: ✅ Good choice given TanStack Query handles reactivity

---

### ADR-003: Redis for Metadata Caching

**Context**: API response caching options.

**Decision**: Redis with short TTL (3s for responses, 24h for field names)

**Rationale**:
- Shared cache across API instances
- Fast (sub-millisecond reads)
- Supports TTL natively

**Assessment**: ✅ Good choice, but needs stampede protection

---

## Conclusion

The PMO caching architecture demonstrates **competent foundational choices** but has **significant gaps** in production-readiness:

**Strengths**:
- Clean separation of concerns (Redis → TanStack → Dexie)
- Appropriate TTL tiering
- Graceful degradation on Redis failures
- Good WebSocket reconnection handling

**Critical Gaps**:
- No cache stampede protection (database risk)
- Unbounded in-memory cache (memory leak risk)
- No storage quota management (silent failures)
- No cache observability (debugging blind spot)

**Overall Architecture Grade**: **B-**

The system works for small-to-medium scale but will encounter problems at:
- 100+ concurrent users (stampede risk)
- Long browser sessions (memory growth)
- Heavy usage (IndexedDB quota)
- Production debugging (no metrics)

**Recommended Next Steps**:
1. Implement critical fixes (2 weeks)
2. Add observability (1 week)
3. Performance test under load
4. Re-evaluate architecture quarterly

---

*This analysis is based on code review as of 2025-12-03. Re-evaluate after significant architecture changes.*
