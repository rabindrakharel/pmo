# How Large Companies Handle Version Management & Cache Invalidation

> **Industry best practices from Google, Facebook, Netflix, Amazon, Stripe, and other tech giants**

**Created**: 2025-11-17
**Platform Version**: 3.3.0

---

## Table of Contents

1. [Version Management Strategies](#version-management)
2. [Cache Invalidation Patterns](#cache-invalidation)
3. [Zero-Downtime Deployments](#zero-downtime)
4. [Real-World Examples](#real-world-examples)
5. [Recommendations for PMO Platform](#recommendations)

---

## Part 1: Version Management Strategies

### 1.1 Google Approach

**Strategy**: **Semantic Versioning + Internal Build Numbers**

```
Public Version:  Chrome 120.0.6099.109
Internal Build:  120.0.6099.109.arm64.dmg (14H1026a)
```

**Implementation**:
- **Frontend**: Build number injected at compile time
- **Backend**: Version in every API response header
- **Protocol Buffers**: Versioned API contracts
- **Backward Compatibility**: Support N-2 versions (current + 2 previous)

**API Response Headers**:
```http
X-Goog-Api-Client: gl-js/1.2.3 grpc-web/1.4.0
X-Goog-Request-Time: 1234567890
X-Goog-FieldMask: ...
```

**Key Learnings**:
- ✅ Version in EVERY response (not just /version endpoint)
- ✅ Build number for debugging (Git SHA + timestamp)
- ✅ Multi-version support (gradual rollout)

---

### 1.2 Facebook/Meta Approach

**Strategy**: **Client-Server Version Negotiation**

```javascript
// Frontend sends version in every request
fetch('/api/graphql', {
  headers: {
    'X-FB-Client-Version': '456.0.0.35.114',
    'X-FB-Friendly-Name': 'FBiOSApp',
    'X-FB-Connection-Type': 'WIFI'
  }
});

// Backend responds with compatibility info
{
  "data": {...},
  "extensions": {
    "is_final": true,
    "server_version": "1.2.3",
    "client_outdated": false,
    "force_upgrade": false
  }
}
```

**Version Compatibility Matrix**:
```typescript
const VERSION_COMPATIBILITY = {
  "1.0.0": { min_client: "450.0", max_client: "460.0", deprecated: false },
  "1.1.0": { min_client: "455.0", max_client: "470.0", deprecated: false },
  "1.2.0": { min_client: "460.0", max_client: "480.0", deprecated: false }
};
```

**Key Features**:
- **Client sends version** in every request
- **Server validates compatibility** and responds with status
- **Force upgrade** if client too old
- **Gradual rollout** with A/B testing (Gatekeeper system)

**Key Learnings**:
- ✅ Bidirectional version awareness (client knows server, server knows client)
- ✅ Force upgrade capability for critical updates
- ✅ A/B testing built into version rollout

---

### 1.3 Netflix Approach

**Strategy**: **Service Mesh + Canary Deployments**

**Architecture**:
```
┌─────────────────────────────────────────────────────────┐
│  Client (TV, Mobile, Web)                               │
│  - App Version: 8.10.1                                  │
│  - API Client Version: 6.27.0                           │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  API Gateway (Zuul)                                     │
│  - Routes to versioned backend services                 │
│  - Version in X-Netflix-API-Version header              │
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────┴────────┬──────────────┐
        │                 │              │
        ▼                 ▼              ▼
   ┌─────────┐      ┌─────────┐    ┌─────────┐
   │ v1.2.3  │      │ v1.2.4  │    │ v1.3.0  │
   │ (100%)  │      │ (5%)    │    │ (0%)    │
   └─────────┘      └─────────┘    └─────────┘
   Stable           Canary         Next
```

**Traffic Splitting**:
```yaml
# Spinnaker deployment config
deploymentStrategy:
  type: highlander # One version at a time per region
  stages:
    - region: us-east-1
      traffic:
        v1.2.3: 100%
    - region: us-west-2
      traffic:
        v1.2.3: 95%
        v1.2.4: 5%   # Canary
    - region: eu-west-1
      traffic:
        v1.2.3: 90%
        v1.2.4: 10%
```

**Version Detection**:
```typescript
// Client polls version endpoint every 30 minutes
setInterval(async () => {
  const response = await fetch('/api/version');
  const { min_supported_version, recommended_version } = await response.json();

  if (currentVersion < min_supported_version) {
    // Force reload
    window.location.reload();
  } else if (currentVersion < recommended_version) {
    // Show banner: "New version available"
    showUpdateBanner();
  }
}, 30 * 60 * 1000);
```

**Key Learnings**:
- ✅ Multi-version backends running simultaneously
- ✅ Regional rollout (different versions per region)
- ✅ Automatic traffic shifting based on metrics
- ✅ Instant rollback if errors spike

---

### 1.4 Amazon/AWS Approach

**Strategy**: **API Versioning in URL + Backward Compatibility**

```
https://api.aws.amazon.com/2023-11-15/ec2/describe-instances
                     ↑
                  API Version Date
```

**Key Principles**:
1. **Date-based versioning** (not semantic versioning)
2. **Immutable API contracts** (old versions never change)
3. **Deprecation timeline** (12-24 months notice)
4. **Client SDK versioning** (matches API version)

**Example**:
```python
# AWS SDK for Python (Boto3)
import boto3

# Client specifies API version
ec2 = boto3.client('ec2', api_version='2016-11-15')

# OR use latest
ec2 = boto3.client('ec2')  # Uses latest stable API
```

**Version Negotiation**:
```http
# Request
GET /2023-11-15/ec2/describe-instances
x-amz-target: AwsEC2.DescribeInstances
x-amz-date: 20231115T120000Z

# Response
HTTP/1.1 200 OK
x-amzn-requestid: abc123
x-amz-version-id: 2023-11-15
```

**Key Learnings**:
- ✅ Version in URL (explicit, visible)
- ✅ Long deprecation cycles (enterprise-friendly)
- ✅ Client libraries handle version negotiation
- ✅ No breaking changes within a version

---

### 1.5 Stripe Approach

**Strategy**: **API Versioning + Automatic Upgrades**

**Versioning System**:
```
Current Version: 2023-10-16
Your Version:    2022-11-15  (1 year old)
Upgrade Path:    2022-11-15 → 2023-08-16 → 2023-10-16
```

**API Request**:
```bash
curl https://api.stripe.com/v1/charges \
  -H "Authorization: Bearer sk_test_..." \
  -H "Stripe-Version: 2023-10-16"
```

**Key Features**:

1. **Per-Account Versioning**
   - Each API key has a pinned version
   - Override per-request with header
   - Upgrade through dashboard

2. **Changelog**
   ```json
   {
     "2023-10-16": {
       "changes": [
         "Added 'metadata' to Invoice object",
         "BREAKING: Removed deprecated 'source' parameter"
       ],
       "breaking": true
     }
   }
   ```

3. **Test Mode Upgrades**
   ```javascript
   // Test new version before upgrading production
   const stripe = require('stripe')('sk_test_...', {
     apiVersion: '2023-10-16'
   });
   ```

4. **Automatic Migration Tools**
   ```bash
   stripe upgrade-assistant
   # Analyzes your code and suggests changes
   ```

**Key Learnings**:
- ✅ Per-account version pinning (not forced upgrades)
- ✅ Test mode for safe version testing
- ✅ Clear migration guides for each version
- ✅ Automatic code analysis tools

---

## Part 2: Cache Invalidation Patterns

### 2.1 Facebook - Cache Invalidation at Scale

**Architecture**: **TAO (The Associations and Objects)**

```
┌─────────────────────────────────────────────────────────┐
│  Application Servers (Frontend)                         │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  TAO Layer (Distributed Object Cache)                   │
│  - In-memory cache of MySQL data                        │
│  - Invalidation via pub/sub                             │
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
   ┌─────────┐       ┌─────────┐
   │  MySQL  │       │ Memcache│
   │ (Source │       │ (Cache) │
   │ of Truth)│      │         │
   └─────────┘       └─────────┘
```

**Invalidation Strategy**:

1. **Write-Through Cache**
   ```sql
   -- Write to database
   UPDATE users SET name='Alice' WHERE id=123;

   -- Automatically invalidate cache
   INVALIDATE cache_key('user:123');

   -- Async: Update all derived caches
   INVALIDATE cache_key('user:123:friends');
   INVALIDATE cache_key('timeline:123');
   ```

2. **Pub/Sub Invalidation**
   ```javascript
   // Publisher (write server)
   await db.update('users', { id: 123, name: 'Alice' });
   pubsub.publish('cache:invalidate:user:123', { timestamp: Date.now() });

   // Subscriber (cache servers)
   pubsub.subscribe('cache:invalidate:user:*', (event) => {
     cache.delete(event.key);
   });
   ```

3. **TTL-based Invalidation**
   ```javascript
   // Short TTL for frequently changing data
   cache.set('timeline:123', data, { ttl: 30 }); // 30 seconds

   // Long TTL for rarely changing data
   cache.set('user:123:profile', data, { ttl: 3600 }); // 1 hour
   ```

**Key Learnings**:
- ✅ Multi-layer cache (L1: memory, L2: Memcache, L3: MySQL)
- ✅ Pub/sub for real-time invalidation
- ✅ Write-through cache (consistency guaranteed)
- ✅ TTL as fallback (eventual consistency)

---

### 2.2 Netflix - Edge Cache Invalidation

**Architecture**: **EVCache (Ephemeral Volatile Cache)**

```
┌─────────────────────────────────────────────────────────┐
│  Client Device (TV/Mobile/Web)                          │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  CDN Edge Cache (CloudFront)                            │
│  - TTL: 5 minutes                                       │
│  - Cache-Control: public, max-age=300                   │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  EVCache (Regional)                                     │
│  - In-memory Memcached cluster                          │
│  - TTL: 1 hour                                          │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  Cassandra (Persistent Storage)                         │
└─────────────────────────────────────────────────────────┘
```

**Cache Invalidation Strategies**:

1. **Surrogate Keys** (for CDN)
   ```http
   # Response with surrogate key
   HTTP/1.1 200 OK
   Surrogate-Key: user-123 movie-456 category-action
   Cache-Control: public, max-age=300

   # Purge by surrogate key
   curl -X PURGE https://api.netflix.com/purge \
     -H "Surrogate-Key: movie-456"
   ```

2. **Event-Driven Invalidation**
   ```javascript
   // When content is updated
   eventBus.publish('content.updated', {
     movieId: 456,
     timestamp: Date.now()
   });

   // Cache invalidation service listens
   eventBus.subscribe('content.updated', async (event) => {
     // Purge CDN
     await cdn.purge(`movie-${event.movieId}`);

     // Invalidate EVCache
     await evCache.delete(`movie:${event.movieId}`);

     // Invalidate related caches
     await evCache.delete(`recommendations:${event.movieId}`);
   });
   ```

3. **Versioned Cache Keys**
   ```javascript
   // Include version in cache key
   const cacheKey = `movie:${movieId}:v${version}`;
   cache.set(cacheKey, data, { ttl: 86400 }); // 24 hours

   // On update, increment version (old cache auto-expires)
   const newVersion = await incrementVersion(movieId);
   // Old keys become stale, no explicit invalidation needed
   ```

**Key Learnings**:
- ✅ Multi-tier caching (CDN → regional cache → database)
- ✅ Surrogate keys for efficient purging
- ✅ Event-driven invalidation (async, decoupled)
- ✅ Versioned keys (no explicit invalidation)

---

### 2.3 Twitter - Real-Time Cache Invalidation

**Strategy**: **Invalidation via Event Streams (Kafka)**

```
┌─────────────────────────────────────────────────────────┐
│  User Posts Tweet                                       │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  Write API                                              │
│  1. Write to database (MySQL)                           │
│  2. Publish event to Kafka                              │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  Kafka Event Stream                                     │
│  Topic: tweets.created                                  │
│  Event: { user_id, tweet_id, timestamp }                │
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────┴────────┬──────────────┐
        │                 │              │
        ▼                 ▼              ▼
   ┌─────────┐      ┌─────────┐    ┌─────────┐
   │ Cache   │      │Timeline │    │ Search  │
   │Invalidate│     │Fanout   │    │Index    │
   └─────────┘      └─────────┘    └─────────┘
```

**Implementation**:
```javascript
// Producer (Write API)
async function createTweet(userId, content) {
  // 1. Write to database
  const tweet = await db.tweets.insert({ userId, content });

  // 2. Publish event
  await kafka.publish('tweets.created', {
    user_id: userId,
    tweet_id: tweet.id,
    timestamp: Date.now()
  });

  return tweet;
}

// Consumer 1: Cache Invalidation
kafka.subscribe('tweets.created', async (event) => {
  // Invalidate user's timeline cache
  await cache.delete(`timeline:${event.user_id}`);

  // Invalidate follower timelines (async)
  const followers = await db.getFollowers(event.user_id);
  await Promise.all(
    followers.map(f => cache.delete(`timeline:${f.id}`))
  );
});

// Consumer 2: Real-time Updates (WebSocket)
kafka.subscribe('tweets.created', async (event) => {
  const followers = await db.getFollowers(event.user_id);

  // Push to connected WebSocket clients
  followers.forEach(followerId => {
    wsServer.sendToClient(followerId, {
      type: 'new_tweet',
      tweet_id: event.tweet_id
    });
  });
});
```

**Key Learnings**:
- ✅ Event-driven architecture (single write, multiple consumers)
- ✅ Kafka for durable event stream
- ✅ Async invalidation (doesn't block write path)
- ✅ Real-time push to clients (WebSocket + events)

---

### 2.4 Amazon - Lazy Invalidation

**Strategy**: **Time-to-Live (TTL) + Conditional Requests**

```javascript
// Client-side caching with ETags
const response = await fetch('/api/products/123', {
  headers: {
    'If-None-Match': lastETag  // ETag from previous request
  }
});

if (response.status === 304) {
  // Not Modified - use cached data
  return cachedData;
} else {
  // Modified - update cache
  const newData = await response.json();
  const newETag = response.headers.get('ETag');
  cache.set('product:123', { data: newData, etag: newETag });
  return newData;
}
```

**Server-side ETags**:
```typescript
// Generate ETag from content hash
app.get('/api/products/:id', async (req, res) => {
  const product = await db.products.findById(req.params.id);

  // Generate ETag (hash of data + version)
  const etag = `"${hashMD5(JSON.stringify(product))}"`;

  // Check if client has latest version
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).send(); // Not Modified
  }

  // Send fresh data
  res.set('ETag', etag);
  res.set('Cache-Control', 'private, max-age=300'); // 5 minutes
  res.json(product);
});
```

**Key Learnings**:
- ✅ ETags for conditional requests (bandwidth savings)
- ✅ Client-side cache validation (no explicit invalidation)
- ✅ TTL as fallback (automatic expiration)
- ✅ Reduces backend load (304 responses are cheap)

---

## Part 3: Zero-Downtime Deployments

### 3.1 Blue-Green Deployment (Netflix, Amazon)

```
┌─────────────────────────────────────────────────────────┐
│  Load Balancer                                          │
│  - Routes 100% traffic to Blue                          │
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
   ┌─────────┐       ┌─────────┐
   │  BLUE   │       │  GREEN  │
   │ v1.2.3  │       │ v1.2.4  │
   │(Active) │       │(Standby)│
   └─────────┘       └─────────┘

   # Switch traffic
   Load Balancer → Routes 100% to Green

   # Rollback if needed
   Load Balancer → Routes 100% back to Blue
```

**Deployment Steps**:
1. Deploy new version to Green environment
2. Run smoke tests on Green
3. Switch 10% traffic to Green (canary)
4. Monitor metrics for 10 minutes
5. If healthy: Switch 100% to Green
6. If issues: Switch back to Blue
7. Keep Blue for 24h (rollback buffer)

---

### 3.2 Rolling Deployment (Google, Facebook)

```
┌─────────────────────────────────────────────────────────┐
│  Load Balancer                                          │
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────┼────────┬──────────────┐
        │        │        │              │
        ▼        ▼        ▼              ▼
   ┌─────────┬─────────┬─────────┬─────────┐
   │v1.2.3   │v1.2.3   │v1.2.3   │v1.2.3   │
   │(Pod 1)  │(Pod 2)  │(Pod 3)  │(Pod 4)  │
   └─────────┴─────────┴─────────┴─────────┘

   # Step 1: Update Pod 1
   │v1.2.4   │v1.2.3   │v1.2.3   │v1.2.3   │

   # Step 2: Update Pod 2
   │v1.2.4   │v1.2.4   │v1.2.3   │v1.2.3   │

   # Step 3: Update Pod 3
   │v1.2.4   │v1.2.4   │v1.2.4   │v1.2.3   │

   # Step 4: Update Pod 4
   │v1.2.4   │v1.2.4   │v1.2.4   │v1.2.4   │
```

**Kubernetes Implementation**:
```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # Max 1 extra pod during update
      maxUnavailable: 0  # Always keep 4 pods available
  template:
    spec:
      containers:
      - name: api
        image: api:v1.2.4
        readinessProbe:
          httpGet:
            path: /healthz
            port: 4000
          initialDelaySeconds: 5
          periodSeconds: 5
```

---

## Part 4: Real-World Cache Invalidation Examples

### Example 1: Stripe - Webhook-Based Invalidation

```typescript
// Stripe sends webhook when customer updated
app.post('/webhooks/stripe', async (req, res) => {
  const event = req.body;

  if (event.type === 'customer.updated') {
    const customerId = event.data.object.id;

    // Invalidate cache
    await cache.delete(`customer:${customerId}`);
    await cache.delete(`subscriptions:${customerId}`);

    // Notify frontend via WebSocket
    wsServer.send(`customer:${customerId}`, {
      type: 'customer_updated',
      customer_id: customerId
    });
  }

  res.sendStatus(200);
});
```

### Example 2: Shopify - GraphQL Subscriptions

```graphql
# Client subscribes to product updates
subscription {
  productUpdated(id: "gid://shopify/Product/123") {
    id
    title
    price
    updatedAt
  }
}

# Server pushes updates when product changes
# No polling needed, instant cache invalidation
```

---

## Part 5: Recommendations for PMO Platform

### Recommended Architecture

```typescript
// 1. Version Endpoint
GET /api/v1/system/version
Response: {
  api_version: "1.0.0",
  platform_version: "3.3.0",
  min_client_version: "3.2.0",
  force_upgrade: false
}

// 2. Version Header in All Responses
X-API-Version: 1.0.0
X-Platform-Version: 3.3.0
Cache-Control: public, max-age=300

// 3. WebSocket for Cache Invalidation
ws://api.pmo.com/ws/cache
Message: {
  type: "cache_invalidate",
  resource: "settings:dl__project_stage",
  timestamp: "2025-01-17T12:00:00Z"
}

// 4. Frontend Auto-Check (Every 5 min)
setInterval(async () => {
  const version = await fetch('/api/v1/system/version');
  if (version.platform_version !== storedVersion) {
    clearAllCaches();
    showUpdateNotification();
  }
}, 5 * 60 * 1000);
```

### Implementation Priority

| Week | Feature | Effort | Impact |
|------|---------|--------|--------|
| 1 | Version endpoint + headers | 4h | High |
| 1 | Auto-check on frontend | 2h | High |
| 2 | Cache-Control headers | 2h | Medium |
| 2 | WebSocket cache events | 6h | High |
| 3 | Blue-Green deployment | 8h | Medium |

---

## Summary

### Key Takeaways

1. **Version Management**:
   - ✅ Version in EVERY response (not just /version endpoint)
   - ✅ Client-server version negotiation
   - ✅ Support N-2 versions for gradual rollout

2. **Cache Invalidation**:
   - ✅ Event-driven (Kafka, Pub/Sub, WebSocket)
   - ✅ Multi-tier (CDN → cache → database)
   - ✅ TTL as fallback (eventual consistency)

3. **Deployment**:
   - ✅ Blue-Green for instant rollback
   - ✅ Rolling for zero downtime
   - ✅ Canary for risk mitigation

### What PMO Should Implement

**Phase 1** (Week 1):
- `/api/v1/system/version` endpoint
- `X-API-Version` header in all responses
- Frontend periodic version check
- Auto-clear cache on version change

**Phase 2** (Week 2):
- WebSocket `/ws/cache` for real-time invalidation
- `Cache-Control` headers on all routes
- Manual invalidation API for admins

**Phase 3** (Week 3+):
- Blue-Green deployment setup
- ETags for conditional requests
- Event-driven cache invalidation (Kafka/Redis)

---

## Related Documentation

- [Version Management Architecture](../architecture/VERSION_AND_CACHE_MANAGEMENT.md)
- [Cache Invalidation Guide](../performance/CACHE_INVALIDATION_GUIDE.md)
- [Performance Optimization](../performance/FORMATTER_PERFORMANCE_OPTIMIZATION.md)

---

**Version**: 1.0.0 | **Last Updated**: 2025-11-17
