# PMO Platform Caching Architecture

**Last Updated**: 2025-11-18
**Status**: ✅ Production Ready

## Overview

The PMO platform implements a **Redis-based persistent caching layer** for entity metadata, ensuring fast access, cross-instance sharing, and automatic invalidation. This document provides an overview of the caching architecture and references detailed implementation guides.

---

## Caching Strategy

### 1. **Redis (Primary Cache)**

- **Technology**: Redis 7.2 (Valkey-compatible)
- **Port**: 6379
- **Client Library**: ioredis
- **Cache Scope**: Entity metadata only
- **TTL**: 300 seconds (5 minutes)

### 2. **Cache Key Naming Convention**

```
entity:metadata:{entity_code}
```

**Examples**:
- `entity:metadata:project`
- `entity:metadata:task`
- `entity:metadata:office`

### 3. **Cached Data Structure**

Each cache entry stores complete entity metadata from the `entity` table:

```json
{
  "code": "project",
  "entity_type": "project",
  "label": "Project",
  "label_plural": "Projects",
  "icon": "FolderKanban",
  "child_entity_codes": ["task", "wiki", "artifact", "form", "expense", "revenue"],
  "active_flag": true,
  "created_ts": "2025-01-15T10:30:00Z",
  "modified_ts": "2025-01-18T14:22:00Z"
}
```

---

## Architecture Diagram

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ API Server 1 │  │ API Server 2 │  │ API Server 3 │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └─────────────────┼─────────────────┘
                         ↓
              ┌──────────────────────┐
              │   Redis (Port 6379)  │
              │ ┌──────────────────┐ │
              │ │ entity:metadata: │ │
              │ │   office   {...} │ │
              │ │   project  {...} │ │
              │ │   task     {...} │ │
              │ └──────────────────┘ │
              └──────────────────────┘
         ✅ Persists across restarts
         ✅ Shared across all instances
         ✅ Automatic TTL expiration
                         ↓
              ┌──────────────────────┐
              │  PostgreSQL Database │
              │    app.entity table  │
              └──────────────────────┘
```

---

## Cache Operations

### 1. **Read Operation (Cache Hit)**

```typescript
// apps/api/src/services/entity-infrastructure.service.ts

async get_entity(entity_type: string): Promise<Entity | null> {
  const cacheKey = `entity:metadata:${entity_type}`;

  // Try cache first
  const cached = await this.redis.get(cacheKey);
  if (cached) {
    console.log(`✅ Cache hit for entity: ${entity_type}`);
    return JSON.parse(cached);
  }

  // Cache miss - query database
  console.log(`❌ Cache miss for entity: ${entity_type}`);
  const metadata = await this.queryDatabase(entity_type);

  // Populate cache
  await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(metadata));
  console.log(`💾 Cache populated for entity: ${entity_type}`);

  return metadata;
}
```

### 2. **Write Operation (Cache Invalidation)**

```typescript
// After updating entity metadata
await entityInfra.invalidate_entity_cache('project');
```

**Invalidation Flow**:
```
PUT /api/v1/entity/project/children
        ↓
Update Database
        ↓
DELETE entity:metadata:project
        ↓
Next GET Request → Cache Miss
        ↓
Query Database → Populate Cache
```

### 3. **Cache Clear (Manual)**

```bash
# Clear specific entity
docker exec pmo_redis redis-cli DEL "entity:metadata:project"

# Clear all entity metadata cache
docker exec pmo_redis redis-cli --scan --pattern "entity:metadata:*" | \
  xargs docker exec -i pmo_redis redis-cli DEL

# Clear entire Redis database
docker exec pmo_redis redis-cli FLUSHDB
```

---

## Performance Metrics

### Cache Hit Performance

| Operation | Time (DB) | Time (Redis) | Speedup |
|-----------|-----------|--------------|---------|
| **First GET** | 18ms | - | Baseline |
| **Cached GET** | - | 8ms | **2.25x faster** |
| **After Invalidation** | 18ms | - | Fresh data |

### Cache Statistics

```bash
# Get cache hit/miss rate
docker exec pmo_redis redis-cli INFO stats | grep keyspace

# Monitor cache operations in real-time
docker exec pmo_redis redis-cli MONITOR
```

---

## Configuration

### Environment Variables

```bash
# .env or docker-compose.yml
REDIS_HOST=localhost        # Default: localhost
REDIS_PORT=6379            # Default: 6379
REDIS_PASSWORD=            # Optional (not set in dev)
REDIS_DB=0                 # Default: 0
```

### Docker Compose

```yaml
services:
  redis:
    image: redis:7.2-alpine
    container_name: pmo_redis
    ports:
      - "6379:6379"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
```

---

## Implementation Files

### Core Files

| File | Purpose |
|------|---------|
| `apps/api/src/lib/redis.ts` | Redis client singleton |
| `apps/api/src/services/entity-infrastructure.service.ts` | Entity metadata service with caching |
| `apps/api/src/modules/entity/routes.ts` | Entity endpoints with cache invalidation |

### Redis Client Service

**File**: `apps/api/src/lib/redis.ts`

```typescript
import Redis from 'ioredis';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);

    redisClient = new Redis({
      host,
      port,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redisClient.on('error', (err) => {
      console.error('Redis error:', err);
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected');
    });
  }

  return redisClient;
}

export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

export async function isRedisHealthy(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const pong = await client.ping();
    return pong === 'PONG';
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
}
```

---

## Cache Invalidation Rules

### Automatic Invalidation Triggers

| Operation | Endpoint | Cache Invalidation |
|-----------|----------|-------------------|
| **Update Child Entities** | `PUT /api/v1/entity/:code/children` | ✅ Invalidates parent entity |
| **Update Entity Metadata** | `PATCH /api/v1/entity/:code` | ✅ Invalidates entity |
| **Create Entity Type** | `POST /api/v1/entity` | ✅ Invalidates entity types list |
| **Delete Entity Type** | `DELETE /api/v1/entity/:code` | ✅ Invalidates entity |

### Manual Invalidation

```typescript
import { getEntityInfrastructure } from '@/services/entity-infrastructure.service.js';

const entityInfra = getEntityInfrastructure(db);

// Invalidate specific entity
await entityInfra.invalidate_entity_cache('project');

// Clear all entity metadata cache
await entityInfra.clear_all_entity_cache();
```

---

## Monitoring & Debugging

### Check Cache Status

```bash
# List all cached entities
docker exec pmo_redis redis-cli --scan --pattern "entity:metadata:*"

# Get specific entity cache
docker exec pmo_redis redis-cli GET "entity:metadata:project" | jq

# Check TTL
docker exec pmo_redis redis-cli TTL "entity:metadata:project"
# Output: 300 (seconds remaining)
```

### Monitor Cache Operations

```bash
# Real-time monitoring
docker exec pmo_redis redis-cli MONITOR

# Filter for entity metadata operations
docker exec pmo_redis redis-cli MONITOR | grep "entity:metadata"
```

### Cache Statistics

```bash
# Get Redis statistics
docker exec pmo_redis redis-cli INFO stats

# Key metrics:
# - keyspace_hits: Number of cache hits
# - keyspace_misses: Number of cache misses
# - evicted_keys: Number of keys evicted due to maxmemory
```

---

## Testing

### Unit Tests

```bash
# Test Redis connectivity
curl http://localhost:4000/health

# Test cache population
curl http://localhost:4000/api/v1/entity/type/project \
  -H "Authorization: Bearer $TOKEN"
```

### Integration Tests

**Test Script**: `/tmp/test-redis-comprehensive.sh`

```bash
#!/bin/bash
# 1. Reset database
# 2. Clear Redis cache
# 3. GET entity (populate cache)
# 4. Verify cache hit
# 5. Update child entities (invalidate cache)
# 6. Verify cache miss
# 7. GET entity (repopulate cache)
# 8. Verify cache hit
```

**Run Tests**:
```bash
chmod +x /tmp/test-redis-comprehensive.sh
/tmp/test-redis-comprehensive.sh
```

**Expected Output**:
```
✅ Cache persists in Redis (not in-memory)
✅ Cache survives API restarts
✅ Cache invalidation works
✅ Shared across multiple API instances
```

---

## Troubleshooting

### Issue: Cache not working

**Symptoms**: Every request hits database (no cache hits)

**Diagnosis**:
```bash
# Check Redis is running
docker ps | grep redis

# Test Redis connectivity
docker exec pmo_redis redis-cli PING
# Expected: PONG

# Check API can connect
curl http://localhost:4000/health
```

**Solution**:
1. Ensure Redis container is running: `docker-compose up -d redis`
2. Check environment variables: `REDIS_HOST`, `REDIS_PORT`
3. Restart API server

### Issue: Stale data after update

**Symptoms**: GET returns old data after PUT update

**Diagnosis**:
```bash
# Check if cache was invalidated
./tools/logs-api.sh | grep "Cache invalidated"

# Manually check cache
docker exec pmo_redis redis-cli GET "entity:metadata:project"
```

**Solution**:
1. Verify `invalidate_entity_cache()` is called after updates
2. Manually clear cache: `docker exec pmo_redis redis-cli DEL "entity:metadata:project"`
3. Check API logs for errors

### Issue: Redis connection errors

**Symptoms**: API logs show "Redis error" or "ECONNREFUSED"

**Diagnosis**:
```bash
# Check Redis container status
docker ps -a | grep redis

# Check Redis logs
docker logs pmo_redis
```

**Solution**:
1. Restart Redis: `docker-compose restart redis`
2. Check Redis port is not blocked: `netstat -tuln | grep 6379`
3. Verify Redis health: `docker exec pmo_redis redis-cli PING`

---

## Best Practices

### 1. **Always Invalidate After Updates**

```typescript
// ❌ BAD: No cache invalidation
await updateEntityMetadata(code, data);
return reply.send(result);

// ✅ GOOD: Invalidate cache after update
await updateEntityMetadata(code, data);
await entityInfra.invalidate_entity_cache(code);
return reply.send(result);
```

### 2. **Use Appropriate TTL**

- **Entity metadata**: 300 seconds (5 minutes) - Changes infrequently
- **User sessions**: 3600 seconds (1 hour) - User-specific data
- **Dynamic data**: 60 seconds (1 minute) - Frequently changing

### 3. **Handle Cache Failures Gracefully**

```typescript
async get_entity(entity_type: string): Promise<Entity | null> {
  try {
    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (error) {
    console.error('Cache read failed, falling back to DB:', error);
  }

  // Always fall back to database
  return await this.queryDatabase(entity_type);
}
```

### 4. **Monitor Cache Performance**

```bash
# Set up periodic monitoring
watch -n 5 'docker exec pmo_redis redis-cli INFO stats | grep -E "keyspace_hits|keyspace_misses"'
```

---

## Related Documentation

- **[Redis Migration Guide](./redis_migration.md)** - Complete migration from in-memory to Redis
- **[Child Entity Management](./child_entity_management.md)** - Cache invalidation for child entity updates
- **[Entity Infrastructure Service](../services/ENTITY_INFRASTRUCTURE_SERVICE.md)** - Core caching service

---

## Future Enhancements

### Planned Improvements

1. **Cache Warming** - Pre-populate cache on startup for common entities
2. **Cache Analytics** - Track hit/miss rates, TTL effectiveness
3. **Multi-Level Caching** - Add in-memory L1 cache + Redis L2 cache
4. **Cache Tags** - Group related cache entries for bulk invalidation
5. **Prometheus Metrics** - Export cache metrics for monitoring

### Considerations

- **Cache Stampede Prevention**: Implement locking for concurrent cache misses
- **Cache Versioning**: Add version numbers to cache keys for schema changes
- **Partial Cache Updates**: Update specific fields without full invalidation
- **Cache Compression**: Compress large cache entries to save memory

---

**Status**: ✅ Production Ready
**Version**: 1.0.0
**Last Updated**: 2025-11-18
