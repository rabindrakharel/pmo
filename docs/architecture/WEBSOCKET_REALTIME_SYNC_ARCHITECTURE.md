# WebSocket Real-Time Sync Architecture

> Architecture plan for implementing WebSocket-based real-time delta sync with RxDB

**Version**: 1.0
**Date**: 2025-11-27
**Status**: Design Phase

---

## Executive Summary

This document outlines the architecture for adding real-time push notifications to the RxDB local-first system. The goal is to enable instant data synchronization when changes occur on the backend, eliminating the need for polling.

### Key Decision: **Fastify WebSocket Plugin + Redis Pub/Sub**

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Same Server (Fastify WS)** | Simple, shared auth, no extra infra | Scaling requires care | **Recommended** |
| Separate WS Server | Independent scaling | Auth complexity, extra service | Overkill for <10K |
| AWS API Gateway WS | Fully managed, scales | Complex, Lambda cold starts | Consider later |
| Pusher/Ably | Zero infra | Cost at scale, vendor lock | Good for MVP |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              COMPLETE ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────┐                                                           │
│  │   Browser Tab 1  │◄─────┐                                                    │
│  │   RxDB + WS      │      │                                                    │
│  └──────────────────┘      │                                                    │
│                            │  WebSocket                                          │
│  ┌──────────────────┐      │  Connections                                       │
│  │   Browser Tab 2  │◄─────┤                                                    │
│  │   RxDB + WS      │      │                                                    │
│  └──────────────────┘      │                                                    │
│                            │                                                    │
│  ┌──────────────────┐      │                                                    │
│  │   Mobile App     │◄─────┤                                                    │
│  │   RxDB + WS      │      │                                                    │
│  └──────────────────┘      │                                                    │
│                            │                                                    │
│                    ┌───────▼───────────────────────────────────────────────┐    │
│                    │              LOAD BALANCER (nginx/ALB)                │    │
│                    │         Sticky Sessions for WebSocket                 │    │
│                    └───────┬───────────────────────────────┬───────────────┘    │
│                            │                               │                    │
│                    ┌───────▼───────┐               ┌───────▼───────┐            │
│                    │   API Pod 1   │               │   API Pod 2   │            │
│                    │   Fastify +   │               │   Fastify +   │            │
│                    │   WebSocket   │               │   WebSocket   │            │
│                    │   Plugin      │               │   Plugin      │            │
│                    └───────┬───────┘               └───────┬───────┘            │
│                            │                               │                    │
│                            │     Subscribe/Publish         │                    │
│                            └───────────┬───────────────────┘                    │
│                                        │                                        │
│                            ┌───────────▼───────────┐                            │
│                            │       REDIS           │                            │
│                            │   Pub/Sub Channels    │                            │
│                            │                       │                            │
│                            │  entity:project       │                            │
│                            │  entity:task          │                            │
│                            │  user:{userId}        │                            │
│                            └───────────┬───────────┘                            │
│                                        │                                        │
│                                        │ Subscribed to NOTIFY                   │
│                            ┌───────────▼───────────┐                            │
│                            │      PostgreSQL       │                            │
│                            │                       │                            │
│                            │  ┌─────────────────┐  │                            │
│                            │  │  Change Triggers│  │                            │
│                            │  │  NOTIFY channel │  │                            │
│                            │  └─────────────────┘  │                            │
│                            │                       │                            │
│                            │  ┌─────────────────┐  │                            │
│                            │  │  change_log     │  │                            │
│                            │  │  (audit table)  │  │                            │
│                            │  └─────────────────┘  │                            │
│                            └───────────────────────┘                            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. WebSocket Server Location

**Recommendation: Embed in Fastify API Server**

```typescript
// apps/api/src/plugins/websocket.ts
import fastifyWebsocket from '@fastify/websocket';
import type { FastifyInstance } from 'fastify';

export async function websocketPlugin(fastify: FastifyInstance) {
  // Register WebSocket plugin
  await fastify.register(fastifyWebsocket, {
    options: {
      maxPayload: 1048576, // 1MB
      clientTracking: true
    }
  });

  // WebSocket route for sync
  fastify.get('/ws/sync', { websocket: true }, (socket, request) => {
    const userId = request.user?.sub;
    if (!userId) {
      socket.close(4001, 'Unauthorized');
      return;
    }

    // Register connection
    connectionManager.addConnection(userId, socket);

    // Handle messages from client
    socket.on('message', (message) => {
      handleClientMessage(userId, socket, message);
    });

    // Cleanup on disconnect
    socket.on('close', () => {
      connectionManager.removeConnection(userId, socket);
    });
  });
}
```

**Why Same Server?**
1. **Shared Authentication**: JWT validation already implemented
2. **Shared Database Connection**: Can query user permissions
3. **Simpler Deployment**: One service to manage
4. **Lower Latency**: No inter-service communication

---

### 2. Change Detection (PostgreSQL)

**Option A: PostgreSQL LISTEN/NOTIFY (Recommended)**

```sql
-- db/triggers/change_notify.sql

-- Create notification function
CREATE OR REPLACE FUNCTION notify_entity_change()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
BEGIN
  payload = jsonb_build_object(
    'operation', TG_OP,
    'table', TG_TABLE_NAME,
    'entity_code', TG_ARGV[0],
    'entity_id', COALESCE(NEW.id, OLD.id),
    'updated_at', COALESCE(NEW.updated_ts, OLD.updated_ts),
    'updated_by', COALESCE(NEW.updated_by, OLD.updated_by)
  );

  -- Notify on channel
  PERFORM pg_notify('entity_changes', payload::text);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply to project table
CREATE TRIGGER project_change_notify
  AFTER INSERT OR UPDATE OR DELETE ON app.project
  FOR EACH ROW
  EXECUTE FUNCTION notify_entity_change('project');

-- Apply to task table
CREATE TRIGGER task_change_notify
  AFTER INSERT OR UPDATE OR DELETE ON app.task
  FOR EACH ROW
  EXECUTE FUNCTION notify_entity_change('task');

-- Apply to all entity tables...
```

**Option B: Change Log Table (For Audit + Sync)**

```sql
-- db/XXXV_change_log.ddl

CREATE TABLE app.change_log (
  id BIGSERIAL PRIMARY KEY,
  entity_code VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  operation VARCHAR(10) NOT NULL,  -- INSERT, UPDATE, DELETE
  changed_by UUID,
  changed_at TIMESTAMP DEFAULT now(),
  old_data JSONB,
  new_data JSONB,
  processed BOOLEAN DEFAULT false
);

CREATE INDEX idx_change_log_unprocessed
  ON app.change_log(entity_code, changed_at)
  WHERE processed = false;

-- Trigger to populate
CREATE OR REPLACE FUNCTION log_entity_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO app.change_log (entity_code, entity_id, operation, changed_by, old_data, new_data)
  VALUES (
    TG_ARGV[0],
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    COALESCE(NEW.updated_by, OLD.updated_by),
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END
  );

  -- Also NOTIFY for real-time
  PERFORM pg_notify('entity_changes', jsonb_build_object(
    'entity_code', TG_ARGV[0],
    'entity_id', COALESCE(NEW.id, OLD.id),
    'operation', TG_OP
  )::text);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

---

### 3. Redis Pub/Sub Layer

**Why Redis Between PostgreSQL and WebSocket?**

```
PostgreSQL NOTIFY ──► One Listener ──► Redis Pub/Sub ──► All API Pods
```

- PostgreSQL NOTIFY only reaches ONE listener
- Redis Pub/Sub broadcasts to ALL subscribers
- Enables horizontal scaling of API pods

```typescript
// apps/api/src/services/change-broadcaster.service.ts
import Redis from 'ioredis';
import { db } from '@/db/index.js';

const redisPub = new Redis(process.env.REDIS_URL);
const redisSub = new Redis(process.env.REDIS_URL);

/**
 * Listen to PostgreSQL NOTIFY and broadcast to Redis
 * Only ONE instance should run this (use leader election)
 */
export async function startChangeListener() {
  const pgClient = await db.connect();

  // Subscribe to PostgreSQL channel
  await pgClient.query('LISTEN entity_changes');

  pgClient.on('notification', async (msg) => {
    if (msg.channel === 'entity_changes' && msg.payload) {
      const change = JSON.parse(msg.payload);

      // Publish to Redis for all pods to receive
      await redisPub.publish(
        `entity:${change.entity_code}`,
        JSON.stringify(change)
      );

      console.log(`[ChangeBroadcaster] Published change: ${change.entity_code}/${change.entity_id}`);
    }
  });

  console.log('[ChangeBroadcaster] Listening to PostgreSQL NOTIFY');
}

/**
 * Subscribe to Redis and push to WebSocket clients
 * Each API pod runs this
 */
export async function startChangeSubscriber(connectionManager: ConnectionManager) {
  // Subscribe to all entity channels
  await redisSub.psubscribe('entity:*');

  redisSub.on('pmessage', async (pattern, channel, message) => {
    const entityCode = channel.replace('entity:', '');
    const change = JSON.parse(message);

    // Push to relevant WebSocket clients
    await pushChangeToClients(connectionManager, entityCode, change);
  });

  console.log('[ChangeSubscriber] Subscribed to Redis entity channels');
}
```

---

### 4. Connection Manager

```typescript
// apps/api/src/services/connection-manager.service.ts
import type { WebSocket } from 'ws';
import { getEntityInfrastructure, Permission } from '@/services/entity-infrastructure.service.js';

interface UserConnection {
  socket: WebSocket;
  userId: string;
  subscribedEntities: Set<string>;  // Entity codes user is interested in
  subscribedInstances: Map<string, Set<string>>;  // entity_code -> Set<entity_id>
}

class ConnectionManager {
  private connections: Map<string, Set<UserConnection>> = new Map();
  private socketToUser: WeakMap<WebSocket, string> = new WeakMap();

  /**
   * Add a new WebSocket connection
   */
  addConnection(userId: string, socket: WebSocket): void {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }

    const connection: UserConnection = {
      socket,
      userId,
      subscribedEntities: new Set(),
      subscribedInstances: new Map()
    };

    this.connections.get(userId)!.add(connection);
    this.socketToUser.set(socket, userId);

    console.log(`[ConnectionManager] User ${userId} connected. Total: ${this.getTotalConnections()}`);
  }

  /**
   * Remove a WebSocket connection
   */
  removeConnection(userId: string, socket: WebSocket): void {
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      for (const conn of userConnections) {
        if (conn.socket === socket) {
          userConnections.delete(conn);
          break;
        }
      }

      if (userConnections.size === 0) {
        this.connections.delete(userId);
      }
    }

    console.log(`[ConnectionManager] User ${userId} disconnected. Total: ${this.getTotalConnections()}`);
  }

  /**
   * Subscribe user to entity type changes
   */
  subscribe(socket: WebSocket, entityCode: string, entityIds?: string[]): void {
    const userId = this.socketToUser.get(socket);
    if (!userId) return;

    const userConnections = this.connections.get(userId);
    if (!userConnections) return;

    for (const conn of userConnections) {
      if (conn.socket === socket) {
        conn.subscribedEntities.add(entityCode);

        if (entityIds?.length) {
          if (!conn.subscribedInstances.has(entityCode)) {
            conn.subscribedInstances.set(entityCode, new Set());
          }
          entityIds.forEach(id => conn.subscribedInstances.get(entityCode)!.add(id));
        }
        break;
      }
    }
  }

  /**
   * Get all connections that should receive a change notification
   */
  async getRelevantConnections(
    entityCode: string,
    entityId: string,
    db: any
  ): Promise<UserConnection[]> {
    const relevant: UserConnection[] = [];
    const entityInfra = getEntityInfrastructure(db);

    for (const [userId, userConnections] of this.connections) {
      // Check RBAC - does user have VIEW permission?
      const canView = await entityInfra.check_entity_rbac(
        userId,
        entityCode,
        entityId,
        Permission.VIEW
      );

      if (!canView) continue;

      for (const conn of userConnections) {
        // Check if user is subscribed to this entity type
        if (!conn.subscribedEntities.has(entityCode)) continue;

        // Check if user is subscribed to specific instances (view-aware)
        const subscribedIds = conn.subscribedInstances.get(entityCode);
        if (subscribedIds && subscribedIds.size > 0 && !subscribedIds.has(entityId)) {
          // User is subscribed to specific IDs but not this one
          continue;
        }

        relevant.push(conn);
      }
    }

    return relevant;
  }

  getTotalConnections(): number {
    let total = 0;
    for (const conns of this.connections.values()) {
      total += conns.size;
    }
    return total;
  }
}

export const connectionManager = new ConnectionManager();
```

---

### 5. Push Changes to Clients

```typescript
// apps/api/src/services/change-pusher.service.ts
import type { ConnectionManager } from './connection-manager.service.js';
import { db } from '@/db/index.js';

interface EntityChange {
  entity_code: string;
  entity_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  updated_at: string;
}

/**
 * Push a change notification to relevant WebSocket clients
 */
export async function pushChangeToClients(
  connectionManager: ConnectionManager,
  entityCode: string,
  change: EntityChange
): Promise<void> {
  // Get connections that should receive this change
  const connections = await connectionManager.getRelevantConnections(
    entityCode,
    change.entity_id,
    db
  );

  if (connections.length === 0) {
    return; // No one interested in this change
  }

  // Fetch the updated entity data (with RBAC applied)
  let entityData = null;
  if (change.operation !== 'DELETE') {
    const result = await db.execute(sql`
      SELECT * FROM app.${sql.raw(entityCode)}
      WHERE id = ${change.entity_id}
    `);
    entityData = result[0] || null;
  }

  // Build push message
  const pushMessage = JSON.stringify({
    type: 'ENTITY_CHANGE',
    payload: {
      entityCode,
      entityId: change.entity_id,
      operation: change.operation,
      data: entityData,
      timestamp: change.updated_at
    }
  });

  // Send to all relevant connections
  let sentCount = 0;
  for (const conn of connections) {
    try {
      if (conn.socket.readyState === 1) { // OPEN
        conn.socket.send(pushMessage);
        sentCount++;
      }
    } catch (error) {
      console.error(`[PushChange] Failed to send to ${conn.userId}:`, error);
    }
  }

  console.log(
    `[PushChange] Sent ${entityCode}/${change.entity_id} to ${sentCount}/${connections.length} clients`
  );
}
```

---

### 6. Frontend RxDB Integration

```typescript
// apps/web/src/db/replication/websocketSync.ts
import { replicateRxCollection } from 'rxdb/plugins/replication';
import type { RxCollection, RxReplicationState } from 'rxdb';

interface WebSocketMessage {
  type: 'ENTITY_CHANGE' | 'SUBSCRIPTION_ACK' | 'ERROR';
  payload: any;
}

/**
 * Setup WebSocket-enhanced replication for a collection
 *
 * Combines:
 * - REST replication for initial sync + offline catch-up
 * - WebSocket for real-time push notifications
 */
export function setupWebSocketReplication<T>(
  collection: RxCollection<T>,
  entityCode: string,
  authToken: string,
  wsUrl: string
): {
  restReplication: RxReplicationState<T, any>;
  wsConnection: WebSocket;
} {
  // 1. Setup REST replication (existing)
  const restReplication = setupEntityReplication(collection, entityCode, authToken);

  // 2. Setup WebSocket for real-time push
  const ws = new WebSocket(wsUrl, ['v1.sync']);

  ws.onopen = () => {
    console.log(`[WebSocketSync] Connected for ${entityCode}`);

    // Authenticate
    ws.send(JSON.stringify({
      type: 'AUTH',
      payload: { token: authToken }
    }));

    // Subscribe to this entity type
    ws.send(JSON.stringify({
      type: 'SUBSCRIBE',
      payload: { entityCode }
    }));
  };

  ws.onmessage = async (event) => {
    const message: WebSocketMessage = JSON.parse(event.data);

    if (message.type === 'ENTITY_CHANGE') {
      const { entityCode: code, entityId, operation, data } = message.payload;

      if (code !== entityCode) return;

      console.log(`[WebSocketSync] Received ${operation} for ${code}/${entityId}`);

      // Apply change to local RxDB
      if (operation === 'DELETE') {
        const doc = await collection.findOne(entityId).exec();
        if (doc) {
          await doc.remove();
        }
      } else if (data) {
        // Upsert the document
        await collection.upsert({
          ...data,
          _deleted: !data.active_flag
        });
      }
    }
  };

  ws.onclose = () => {
    console.log(`[WebSocketSync] Disconnected for ${entityCode}`);
    // REST replication continues working for offline support
  };

  ws.onerror = (error) => {
    console.error(`[WebSocketSync] Error for ${entityCode}:`, error);
  };

  return { restReplication, wsConnection: ws };
}
```

---

## Scaling Strategy

### For <1,000 Concurrent Users (Current State)

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│   Clients   │────►│  Single Fastify │────►│  PostgreSQL  │
│   RxDB+WS   │     │  (EC2 t3.large) │     │  (RDS)       │
└─────────────┘     └─────────────────┘     └──────────────┘
```

- Single API server handles both REST and WebSocket
- PostgreSQL LISTEN/NOTIFY directly to API server
- No Redis needed

### For 1,000-10,000 Concurrent Users

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│   Clients   │────►│   ALB (sticky)  │     │  PostgreSQL  │
│   RxDB+WS   │     └────────┬────────┘     │  + NOTIFY    │
└─────────────┘              │              └──────┬───────┘
                    ┌────────┼────────┐            │
                    ▼        ▼        ▼            │
              ┌─────────┐ ┌─────────┐ ┌─────────┐  │
              │ API-1   │ │ API-2   │ │ API-3   │  │
              │ Fastify │ │ Fastify │ │ Fastify │  │
              └────┬────┘ └────┬────┘ └────┬────┘  │
                   │           │           │       │
                   └───────────┼───────────┘       │
                               ▼                   │
                    ┌──────────────────┐           │
                    │  Redis Pub/Sub   │◄──────────┘
                    │  (ElastiCache)   │   pg_notify listener
                    └──────────────────┘   (single instance)
```

- ALB with sticky sessions (WebSocket affinity)
- Redis Pub/Sub for cross-pod broadcasting
- Single "leader" pod listens to PostgreSQL NOTIFY
- All pods subscribe to Redis

### For 10,000+ Concurrent Users

```
┌─────────────┐     ┌─────────────────┐
│   Clients   │────►│   API Gateway   │
│   RxDB+WS   │     │   WebSocket API │
└─────────────┘     └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   Lambda@Edge   │
                    │   (connection   │
                    │    manager)     │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   EventBridge   │
                    │   + SQS         │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌─────────┐    ┌─────────┐    ┌─────────┐
        │ API-1   │    │ API-2   │    │ API-3   │
        │ REST    │    │ REST    │    │ REST    │
        └─────────┘    └─────────┘    └─────────┘
```

- AWS API Gateway WebSocket API (managed scaling)
- Lambda for connection management
- EventBridge for routing changes
- REST API remains separate (Fastify)

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

| Task | Owner | Deliverable |
|------|-------|-------------|
| Add `@fastify/websocket` plugin | Backend | WebSocket endpoint `/ws/sync` |
| Create ConnectionManager service | Backend | User connection tracking |
| Add PostgreSQL NOTIFY triggers | Backend | Triggers on entity tables |
| Update RxDB sync to handle WS | Frontend | WebSocket integration |

### Phase 2: Change Broadcasting (Week 3)

| Task | Owner | Deliverable |
|------|-------|-------------|
| Create change_log table | Backend | Audit table + triggers |
| Implement PostgreSQL listener | Backend | NOTIFY → Redis |
| Setup Redis Pub/Sub | Backend | Cross-pod broadcasting |
| Implement pushChangeToClients | Backend | Push to relevant users |

### Phase 3: RBAC & Subscriptions (Week 4)

| Task | Owner | Deliverable |
|------|-------|-------------|
| Add RBAC checks to push | Backend | Only push to authorized users |
| Implement subscription protocol | Both | CLIENT→SERVER subscriptions |
| View-aware filtering | Backend | Only push for loaded data |
| Handle access changes | Backend | Push access revocations |

### Phase 4: Scaling & Resilience (Week 5-6)

| Task | Owner | Deliverable |
|------|-------|-------------|
| Add Redis (ElastiCache) | Infra | Production Redis cluster |
| Configure ALB sticky sessions | Infra | WebSocket affinity |
| Add reconnection logic | Frontend | Auto-reconnect with backoff |
| Load testing | QA | Verify 10K concurrent |

---

## Message Protocol

### Client → Server

```typescript
// Authentication
{ type: 'AUTH', payload: { token: 'jwt...' } }

// Subscribe to entity type
{ type: 'SUBSCRIBE', payload: { entityCode: 'project' } }

// Subscribe to specific instances (view-aware)
{ type: 'SUBSCRIBE', payload: {
  entityCode: 'task',
  entityIds: ['uuid-1', 'uuid-2', 'uuid-3']  // Currently visible
}}

// Unsubscribe
{ type: 'UNSUBSCRIBE', payload: { entityCode: 'project' } }

// Heartbeat/ping
{ type: 'PING' }
```

### Server → Client

```typescript
// Authentication success
{ type: 'AUTH_SUCCESS', payload: { userId: 'uuid' } }

// Subscription acknowledged
{ type: 'SUBSCRIPTION_ACK', payload: { entityCode: 'project', subscribed: true } }

// Entity change notification
{
  type: 'ENTITY_CHANGE',
  payload: {
    entityCode: 'project',
    entityId: 'uuid-123',
    operation: 'UPDATE',
    data: { id: 'uuid-123', name: 'Updated Project', ... },
    timestamp: '2025-11-27T10:30:00Z'
  }
}

// Access revoked (remove from local)
{
  type: 'ACCESS_REVOKED',
  payload: {
    entityCode: 'project',
    entityId: 'uuid-123'
  }
}

// Heartbeat response
{ type: 'PONG' }

// Error
{ type: 'ERROR', payload: { code: 'UNAUTHORIZED', message: '...' } }
```

---

## Cost Estimate (AWS)

| Component | Specification | Monthly Cost |
|-----------|---------------|--------------|
| **EC2 (API + WS)** | 2x t3.large | ~$120 |
| **ElastiCache (Redis)** | cache.t3.small | ~$25 |
| **RDS (PostgreSQL)** | db.t3.medium | ~$50 |
| **ALB** | Application LB | ~$25 |
| **Data Transfer** | ~100GB/month | ~$10 |
| **Total** | | **~$230/month** |

For 10K+ users with API Gateway:
- API Gateway WebSocket: ~$1 per million messages
- Lambda: ~$5 for connection management
- Additional: ~$50/month

---

## Files to Create/Modify

### Backend

```
apps/api/
├── src/
│   ├── plugins/
│   │   └── websocket.ts                    # NEW: WebSocket plugin
│   ├── services/
│   │   ├── connection-manager.service.ts   # NEW: Connection tracking
│   │   ├── change-broadcaster.service.ts   # NEW: PostgreSQL → Redis
│   │   └── change-pusher.service.ts        # NEW: Redis → WebSocket
│   └── index.ts                            # MODIFY: Register WS plugin
├── db/
│   ├── XXXV_change_log.ddl                 # NEW: Change log table
│   └── triggers/
│       └── change_notify.sql               # NEW: NOTIFY triggers
└── package.json                            # ADD: @fastify/websocket, ioredis
```

### Frontend

```
apps/web/src/db/
├── replication/
│   ├── websocketSync.ts                    # NEW: WebSocket integration
│   └── index.ts                            # MODIFY: Use WS when available
└── hooks/
    └── useWebSocketStatus.ts               # NEW: Connection status hook
```

---

## Summary

| Question | Answer |
|----------|--------|
| **Where to host WebSocket?** | Same Fastify server with `@fastify/websocket` plugin |
| **How to detect changes?** | PostgreSQL LISTEN/NOTIFY triggers |
| **How to scale?** | Redis Pub/Sub for cross-pod broadcasting |
| **How to handle RBAC?** | Check permissions before pushing |
| **How to integrate with RxDB?** | WebSocket pushes updates, RxDB applies locally |
| **Estimated effort** | 5-6 weeks for full implementation |

This architecture provides real-time sync while maintaining offline-first capabilities through the existing REST replication as a fallback.
