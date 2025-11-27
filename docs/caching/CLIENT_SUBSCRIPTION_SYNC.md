# Client-Side Subscription Sync - Complete Design

> End-to-end architecture for real-time sync where clients tell the server what entities they have locally

**Version**: 1.0
**Date**: 2025-11-27
**Status**: Design Complete

---

## Executive Summary

Clients subscribe to specific entity instances they have in their local RxDB. When those entities change, the server pushes invalidation signals only to subscribed clients. RBAC is enforced on the refetch, not the push.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HIGH-LEVEL FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────┐     ┌──────────────────────────────────┐     ┌──────────┐      │
│   │  Client  │     │          PubSub Service          │     │ Postgres │      │
│   │  RxDB    │     │  ┌─────────────┐ ┌────────────┐  │     │          │      │
│   └────┬─────┘     │  │  WebSocket  │ │ LogWatcher │  │     └────┬─────┘      │
│        │           │  │   Handler   │ │  (poll)    │  │          │            │
│        │           │  └──────┬──────┘ └─────┬──────┘  │          │            │
│        │           └─────────┼──────────────┼─────────┘          │            │
│        │                  │                  │                │             │
│        │ 1. Load 50       │                  │                │             │
│        │    projects      │                  │                │             │
│        │◄─────────────────┼──────────────────┼────────────────┤             │
│        │                  │                  │                │             │
│        │ 2. SUBSCRIBE     │                  │                │             │
│        │    [50 uuids]    │                  │                │             │
│        ├─────────────────►│                  │                │             │
│        │                  │                  │                │             │
│        │                  │ 3. Store in      │                │             │
│        │                  │    memory map    │                │             │
│        │                  │                  │                │             │
│        │                  │                  │ 4. Poll every  │             │
│        │                  │                  │    60 seconds  │             │
│        │                  │                  ├───────────────►│             │
│        │                  │                  │                │             │
│        │                  │                  │◄───────────────┤             │
│        │                  │                  │  Changed IDs   │             │
│        │                  │                  │                │             │
│        │                  │ 5. Match changed │                │             │
│        │                  │◄───ids against───┤                │             │
│        │                  │    subscriptions │                │             │
│        │                  │                  │                │             │
│        │ 6. INVALIDATE    │                  │                │             │
│        │    project/uuid-5│                  │                │             │
│        │◄─────────────────┤                  │                │             │
│        │                  │                  │                │             │
│        │ 7. Refetch via   │                  │                │             │
│        │    REST API      │                  │                │             │
│        ├─────────────────────────────────────────────────────►│             │
│        │                  │                  │                │             │
│        │◄─────────────────────────────────────────────────────┤             │
│        │    (RBAC checked)│                  │                │             │
│        │                  │                  │                │             │
│        │ 8. Update local  │                  │                │             │
│        │    RxDB          │                  │                │             │
│        │                  │                  │                │             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Table of Contents

1. [Database Schema](#1-database-schema)
2. [Backend Architecture](#2-backend-architecture)
3. [Frontend Architecture](#3-frontend-architecture)
4. [Message Protocol](#4-message-protocol)
5. [Complete Code Implementation](#5-complete-code-implementation)
6. [Deployment](#6-deployment)

---

## 1. Database Schema

### 1.1 Logging Table

```sql
-- db/XXXV_logging.ddl

CREATE TABLE app.logging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Actor (WHO)
    person_id UUID,
    fname VARCHAR(100),
    lname VARCHAR(100),
    username VARCHAR(255),
    person_type VARCHAR(50) CHECK (person_type IN ('employee', 'customer', 'system', 'guest')),

    -- Request Context
    api_endpoint VARCHAR(500),
    http_method VARCHAR(10),

    -- Target Entity (WHAT) - Required for sync
    entity_code VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,

    -- Action Type (HOW)
    action SMALLINT NOT NULL CHECK (action >= 0 AND action <= 5),
    -- 0=View, 1=Edit, 2=Share, 3=Delete, 4=Create, 5=Owner

    -- State Snapshots
    entity_from_version JSONB,
    entity_to_version JSONB,

    -- Security Context
    user_agent TEXT,
    ip INET,
    device_name VARCHAR(255),

    -- Timestamps
    created_ts TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Sync Status
    log_source VARCHAR(50) DEFAULT 'api',
    sync_processed_ts TIMESTAMPTZ,
    sync_status VARCHAR(20) DEFAULT 'pending'
        CHECK (sync_status IN ('pending', 'processing', 'sent', 'no_subscribers'))
);

-- Primary index for LogWatcher polling
CREATE INDEX idx_logging_sync_pending
    ON app.logging(created_ts)
    WHERE sync_status = 'pending' AND action != 0;

-- Index for audit queries
CREATE INDEX idx_logging_entity_history
    ON app.logging(entity_code, entity_id, created_ts DESC);

-- Index for user activity
CREATE INDEX idx_logging_person_activity
    ON app.logging(person_id, created_ts DESC)
    WHERE person_id IS NOT NULL;

-- Partition by month for large-scale (optional)
-- CREATE TABLE app.logging_y2025m01 PARTITION OF app.logging
--     FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

### 1.2 Logging Trigger (Auto-populate on entity changes)

```sql
-- db/triggers/entity_logging_trigger.sql

CREATE OR REPLACE FUNCTION app.log_entity_change()
RETURNS TRIGGER AS $$
DECLARE
    v_action SMALLINT;
    v_person_id UUID;
BEGIN
    -- Determine action type
    v_action := CASE TG_OP
        WHEN 'INSERT' THEN 4  -- CREATE
        WHEN 'UPDATE' THEN 1  -- EDIT
        WHEN 'DELETE' THEN 3  -- DELETE
    END;

    -- Get person from context (set by API via SET LOCAL)
    v_person_id := NULLIF(current_setting('app.current_user_id', true), '')::UUID;

    -- Insert log entry
    INSERT INTO app.logging (
        person_id,
        entity_code,
        entity_id,
        action,
        entity_from_version,
        entity_to_version,
        api_endpoint,
        http_method
    ) VALUES (
        v_person_id,
        TG_ARGV[0],  -- entity_code passed as trigger argument
        COALESCE(NEW.id, OLD.id),
        v_action,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END,
        NULLIF(current_setting('app.current_endpoint', true), ''),
        NULLIF(current_setting('app.current_method', true), '')
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply to entity tables
CREATE TRIGGER log_project_changes
    AFTER INSERT OR UPDATE OR DELETE ON app.project
    FOR EACH ROW EXECUTE FUNCTION app.log_entity_change('project');

CREATE TRIGGER log_task_changes
    AFTER INSERT OR UPDATE OR DELETE ON app.task
    FOR EACH ROW EXECUTE FUNCTION app.log_entity_change('task');

CREATE TRIGGER log_employee_changes
    AFTER INSERT OR UPDATE OR DELETE ON app.employee
    FOR EACH ROW EXECUTE FUNCTION app.log_entity_change('employee');

-- Add more triggers for other entities...
```

---

## 2. Backend Architecture

### 2.1 File Structure

```
apps/api/src/
├── index.ts                              # MODIFY: Register PubSub plugin
├── services/
│   └── pubsub/                           # NEW: PubSub Service module
│       ├── index.ts                      # Module exports
│       ├── pubsub.service.ts             # Main orchestrator
│       ├── websocket.plugin.ts           # Fastify WebSocket plugin
│       ├── connection-manager.ts         # Track WS connections
│       ├── subscription-manager.ts       # Database subscription ops
│       ├── log-watcher.ts                # Poll logs, push invalidations
│       └── types.ts                      # Type definitions
```

### 2.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BACKEND ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        Fastify Server                                │   │
│   │                                                                      │   │
│   │   ┌─────────────────┐    ┌─────────────────────────────────────────┐│   │
│   │   │  REST Routes    │    │           PubSub Service                ││   │
│   │   │                 │    │  ┌──────────────┐  ┌─────────────────┐  ││   │
│   │   │ GET /api/v1/... │    │  │  WebSocket   │  │   Log Watcher   │  ││   │
│   │   │ POST/PATCH/...  │    │  │  Handler     │  │   (60s poll)    │  ││   │
│   │   └────────┬────────┘    └────────┬────────┘    └───────┬────────┘  │   │
│   │            │                      │                     │           │   │
│   │            │                      ▼                     │           │   │
│   │            │             ┌─────────────────┐            │           │   │
│   │            │             │  Subscription   │◄───────────┘           │   │
│   │            │             │    Manager      │                        │   │
│   │            │             │   (In-Memory)   │                        │   │
│   │            │             └────────┬────────┘                        │   │
│   │            │                      │                                 │   │
│   │            │                      ▼                                 │   │
│   │            │             ┌─────────────────┐                        │   │
│   │            │             │   Sync Pusher   │                        │   │
│   │            │             │                 │                        │   │
│   │            │             │ Match changes → │                        │   │
│   │            │             │ Push to clients │                        │   │
│   │            │             └─────────────────┘                        │   │
│   │            │                                                        │   │
│   └────────────┼────────────────────────────────────────────────────────┘   │
│                │                                                             │
│                ▼                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         PostgreSQL                                   │   │
│   │                                                                      │   │
│   │   app.logging          app.project        app.task        ...       │   │
│   │   (change log)         (entities)         (entities)                │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Data Structures

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SUBSCRIPTION MANAGER DATA STRUCTURE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   // Primary: entity_code → entity_id → Set<user_id>                        │
│   // "Which users are watching this specific entity?"                       │
│                                                                              │
│   entitySubscriptions: Map<string, Map<string, Set<string>>>                │
│                                                                              │
│   Example:                                                                  │
│   {                                                                          │
│     "project": {                                                            │
│       "uuid-1": Set(["user-A", "user-B"]),    // 2 users watching           │
│       "uuid-2": Set(["user-A"]),              // 1 user watching            │
│       "uuid-3": Set(["user-B", "user-C"]),    // 2 users watching           │
│     },                                                                       │
│     "task": {                                                               │
│       "uuid-100": Set(["user-A"]),                                          │
│       "uuid-101": Set(["user-A", "user-B"]),                                │
│     }                                                                        │
│   }                                                                          │
│                                                                              │
│   // Secondary: user_id → WebSocket connection                              │
│   // "How do I send a message to this user?"                                │
│                                                                              │
│   userConnections: Map<string, WebSocket>                                   │
│                                                                              │
│   Example:                                                                  │
│   {                                                                          │
│     "user-A": WebSocket(...),                                               │
│     "user-B": WebSocket(...),                                               │
│     "user-C": WebSocket(...),                                               │
│   }                                                                          │
│                                                                              │
│   // Tertiary: user_id → Set<{entity_code, entity_id}>                     │
│   // "What is this user subscribed to?" (for cleanup on disconnect)         │
│                                                                              │
│   userSubscriptions: Map<string, Set<string>>                               │
│   // Set contains "entity_code:entity_id" strings                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Frontend Architecture

### 3.1 File Structure

```
apps/web/src/
├── db/
│   ├── index.ts                          # Database initialization
│   ├── DatabaseProvider.tsx              # MODIFY: Add sync provider
│   ├── sync/
│   │   ├── index.ts                      # NEW: Barrel export
│   │   ├── SyncProvider.tsx              # NEW: React context for sync
│   │   ├── subscriptionSync.ts           # NEW: WebSocket + subscription logic
│   │   └── autoSubscriber.ts             # NEW: Auto-subscribe on query
│   └── hooks/
│       ├── useSyncStatus.ts              # NEW: Sync status hook
│       └── useEntityQuery.ts             # MODIFY: Auto-subscribe on query
```

### 3.2 Frontend Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND SYNC FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   1. User navigates to /projects                                            │
│      │                                                                       │
│      ▼                                                                       │
│   2. useEntityList('project', { page: 1, pageSize: 50 })                    │
│      │                                                                       │
│      ├──► RxDB query returns 50 projects from local                         │
│      │                                                                       │
│      └──► Auto-subscriber extracts IDs and sends:                           │
│           SUBSCRIBE { entityCode: 'project', entityIds: [50 uuids] }        │
│      │                                                                       │
│      ▼                                                                       │
│   3. User scrolls/paginates to page 2                                       │
│      │                                                                       │
│      ├──► RxDB query returns next 50 projects                               │
│      │                                                                       │
│      └──► Auto-subscriber sends:                                            │
│           SUBSCRIBE { entityCode: 'project', entityIds: [next 50 uuids] }   │
│      │                                                                       │
│      ▼                                                                       │
│   4. User navigates away from /projects                                     │
│      │                                                                       │
│      └──► Auto-subscriber sends:                                            │
│           UNSUBSCRIBE { entityCode: 'project', entityIds: [all 100 uuids] } │
│      │                                                                       │
│      ▼                                                                       │
│   5. Meanwhile, another user edits project-uuid-25                          │
│      │                                                                       │
│      ▼                                                                       │
│   6. Server sends: INVALIDATE { entityCode: 'project',                      │
│                                 entityIds: ['uuid-25'] }                    │
│      │                                                                       │
│      ▼                                                                       │
│   7. Client receives, refetches /api/v1/project/uuid-25                     │
│      │                                                                       │
│      ▼                                                                       │
│   8. RxDB updates local document → UI auto-updates (reactive)               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Message Protocol

### 4.1 Client → Server Messages

```typescript
// Connect with auth token
// URL: wss://api.example.com/ws/sync?token=JWT_TOKEN

// Subscribe to specific entity instances
{
  type: 'SUBSCRIBE',
  payload: {
    entityCode: 'project',
    entityIds: ['uuid-1', 'uuid-2', 'uuid-3', ...]  // Max 1000 per message
  }
}

// Unsubscribe from entity instances
{
  type: 'UNSUBSCRIBE',
  payload: {
    entityCode: 'project',
    entityIds: ['uuid-1', 'uuid-2']  // Or omit entityIds to unsubscribe all of this type
  }
}

// Unsubscribe from everything (e.g., on logout)
{
  type: 'UNSUBSCRIBE_ALL'
}

// Heartbeat
{
  type: 'PING'
}

// Request current subscription status
{
  type: 'GET_SUBSCRIPTIONS'
}
```

### 4.2 Server → Client Messages

```typescript
// Connection established
{
  type: 'CONNECTED',
  payload: {
    connectionId: 'conn-uuid',
    userId: 'user-uuid',
    serverTime: '2025-11-27T10:30:00Z'
  }
}

// Subscription confirmed
{
  type: 'SUBSCRIBED',
  payload: {
    entityCode: 'project',
    count: 50,  // Number of entities now subscribed
    totalSubscriptions: 150  // Total across all entity types
  }
}

// Unsubscription confirmed
{
  type: 'UNSUBSCRIBED',
  payload: {
    entityCode: 'project',
    count: 50,
    totalSubscriptions: 100
  }
}

// *** THE KEY MESSAGE: Entity invalidation ***
{
  type: 'INVALIDATE',
  payload: {
    entityCode: 'project',
    changes: [
      { entityId: 'uuid-1', action: 'UPDATE' },
      { entityId: 'uuid-2', action: 'DELETE' },
      { entityId: 'uuid-3', action: 'UPDATE' }
    ],
    timestamp: '2025-11-27T10:30:05Z'
  }
}

// Current subscriptions (response to GET_SUBSCRIPTIONS)
{
  type: 'SUBSCRIPTIONS',
  payload: {
    project: 50,
    task: 30,
    employee: 20,
    total: 100
  }
}

// Heartbeat response
{
  type: 'PONG',
  payload: {
    serverTime: '2025-11-27T10:30:00Z'
  }
}

// Error
{
  type: 'ERROR',
  payload: {
    code: 'SUBSCRIPTION_LIMIT_EXCEEDED',
    message: 'Maximum 5000 subscriptions per connection',
    details: { current: 5000, requested: 100 }
  }
}
```

---

## 5. Complete Code Implementation

### 5.1 Types

```typescript
// apps/api/src/types/sync.types.ts

export interface SubscribeMessage {
  type: 'SUBSCRIBE';
  payload: {
    entityCode: string;
    entityIds: string[];
  };
}

export interface UnsubscribeMessage {
  type: 'UNSUBSCRIBE';
  payload: {
    entityCode: string;
    entityIds?: string[];  // If omitted, unsubscribe all of this type
  };
}

export interface UnsubscribeAllMessage {
  type: 'UNSUBSCRIBE_ALL';
}

export interface PingMessage {
  type: 'PING';
}

export interface GetSubscriptionsMessage {
  type: 'GET_SUBSCRIPTIONS';
}

export type ClientMessage =
  | SubscribeMessage
  | UnsubscribeMessage
  | UnsubscribeAllMessage
  | PingMessage
  | GetSubscriptionsMessage;

export interface InvalidatePayload {
  entityCode: string;
  changes: Array<{
    entityId: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
  }>;
  timestamp: string;
}

export interface LogEntry {
  id: string;
  entity_code: string;
  entity_id: string;
  action: number;  // 0-5
  created_ts: Date;
}

export interface SubscriptionStats {
  entityCode: string;
  count: number;
}
```

### 5.2 Subscription Manager Service

```typescript
// apps/api/src/services/subscription-manager.service.ts

import type { WebSocket } from 'ws';

const MAX_SUBSCRIPTIONS_PER_USER = 5000;
const MAX_ENTITIES_PER_SUBSCRIBE = 1000;

class SubscriptionManager {
  // entity_code → entity_id → Set<user_id>
  private entitySubscriptions: Map<string, Map<string, Set<string>>> = new Map();

  // user_id → WebSocket
  private userConnections: Map<string, WebSocket> = new Map();

  // user_id → Set<"entity_code:entity_id">
  private userSubscriptions: Map<string, Set<string>> = new Map();

  /**
   * Register a new WebSocket connection
   */
  connect(userId: string, socket: WebSocket): void {
    // Close existing connection if any
    const existingSocket = this.userConnections.get(userId);
    if (existingSocket && existingSocket.readyState === 1) {
      existingSocket.close(4000, 'New connection established');
    }

    this.userConnections.set(userId, socket);

    if (!this.userSubscriptions.has(userId)) {
      this.userSubscriptions.set(userId, new Set());
    }

    console.log(`[SubscriptionManager] User ${userId} connected. Total users: ${this.userConnections.size}`);
  }

  /**
   * Handle user disconnect - cleanup all subscriptions
   */
  disconnect(userId: string): void {
    const userSubs = this.userSubscriptions.get(userId);

    if (userSubs) {
      // Remove user from all entity subscriptions
      for (const key of userSubs) {
        const [entityCode, entityId] = key.split(':');
        this.removeSubscription(entityCode, entityId, userId);
      }
      this.userSubscriptions.delete(userId);
    }

    this.userConnections.delete(userId);

    console.log(`[SubscriptionManager] User ${userId} disconnected. Total users: ${this.userConnections.size}`);
  }

  /**
   * Subscribe user to specific entity instances
   */
  subscribe(
    userId: string,
    entityCode: string,
    entityIds: string[]
  ): { success: boolean; count: number; error?: string } {
    // Validate limits
    if (entityIds.length > MAX_ENTITIES_PER_SUBSCRIBE) {
      return {
        success: false,
        count: 0,
        error: `Maximum ${MAX_ENTITIES_PER_SUBSCRIBE} entities per subscribe`
      };
    }

    const userSubs = this.userSubscriptions.get(userId);
    if (!userSubs) {
      return { success: false, count: 0, error: 'User not connected' };
    }

    if (userSubs.size + entityIds.length > MAX_SUBSCRIPTIONS_PER_USER) {
      return {
        success: false,
        count: 0,
        error: `Maximum ${MAX_SUBSCRIPTIONS_PER_USER} total subscriptions`
      };
    }

    // Ensure entity code map exists
    if (!this.entitySubscriptions.has(entityCode)) {
      this.entitySubscriptions.set(entityCode, new Map());
    }
    const entityMap = this.entitySubscriptions.get(entityCode)!;

    let addedCount = 0;
    for (const entityId of entityIds) {
      const key = `${entityCode}:${entityId}`;

      // Skip if already subscribed
      if (userSubs.has(key)) continue;

      // Add to entity → users map
      if (!entityMap.has(entityId)) {
        entityMap.set(entityId, new Set());
      }
      entityMap.get(entityId)!.add(userId);

      // Add to user → subscriptions set
      userSubs.add(key);
      addedCount++;
    }

    console.log(
      `[SubscriptionManager] User ${userId} subscribed to ${addedCount} ${entityCode}(s). ` +
      `Total: ${userSubs.size}`
    );

    return { success: true, count: addedCount };
  }

  /**
   * Unsubscribe user from entity instances
   */
  unsubscribe(
    userId: string,
    entityCode: string,
    entityIds?: string[]  // If omitted, unsubscribe all of this type
  ): { success: boolean; count: number } {
    const userSubs = this.userSubscriptions.get(userId);
    if (!userSubs) {
      return { success: false, count: 0 };
    }

    let removedCount = 0;

    if (entityIds) {
      // Unsubscribe specific entities
      for (const entityId of entityIds) {
        if (this.removeSubscription(entityCode, entityId, userId)) {
          userSubs.delete(`${entityCode}:${entityId}`);
          removedCount++;
        }
      }
    } else {
      // Unsubscribe all of this entity type
      const prefix = `${entityCode}:`;
      for (const key of [...userSubs]) {
        if (key.startsWith(prefix)) {
          const entityId = key.substring(prefix.length);
          this.removeSubscription(entityCode, entityId, userId);
          userSubs.delete(key);
          removedCount++;
        }
      }
    }

    console.log(
      `[SubscriptionManager] User ${userId} unsubscribed from ${removedCount} ${entityCode}(s). ` +
      `Total: ${userSubs.size}`
    );

    return { success: true, count: removedCount };
  }

  /**
   * Unsubscribe user from everything
   */
  unsubscribeAll(userId: string): number {
    const userSubs = this.userSubscriptions.get(userId);
    if (!userSubs) return 0;

    const count = userSubs.size;

    for (const key of userSubs) {
      const [entityCode, entityId] = key.split(':');
      this.removeSubscription(entityCode, entityId, userId);
    }
    userSubs.clear();

    console.log(`[SubscriptionManager] User ${userId} unsubscribed from all (${count})`);
    return count;
  }

  /**
   * Get users subscribed to a specific entity instance
   */
  getSubscribers(entityCode: string, entityId: string): string[] {
    const entityMap = this.entitySubscriptions.get(entityCode);
    if (!entityMap) return [];

    const subscribers = entityMap.get(entityId);
    return subscribers ? Array.from(subscribers) : [];
  }

  /**
   * Get WebSocket for a user
   */
  getSocket(userId: string): WebSocket | undefined {
    return this.userConnections.get(userId);
  }

  /**
   * Get subscription stats for a user
   */
  getUserStats(userId: string): Record<string, number> {
    const userSubs = this.userSubscriptions.get(userId);
    if (!userSubs) return {};

    const stats: Record<string, number> = {};
    for (const key of userSubs) {
      const entityCode = key.split(':')[0];
      stats[entityCode] = (stats[entityCode] || 0) + 1;
    }
    return stats;
  }

  /**
   * Get global stats
   */
  getGlobalStats(): {
    totalUsers: number;
    totalSubscriptions: number;
    byEntityType: Record<string, number>;
  } {
    let totalSubscriptions = 0;
    const byEntityType: Record<string, number> = {};

    for (const [entityCode, entityMap] of this.entitySubscriptions) {
      let count = 0;
      for (const subscribers of entityMap.values()) {
        count += subscribers.size;
      }
      byEntityType[entityCode] = count;
      totalSubscriptions += count;
    }

    return {
      totalUsers: this.userConnections.size,
      totalSubscriptions,
      byEntityType
    };
  }

  // Private helper
  private removeSubscription(entityCode: string, entityId: string, userId: string): boolean {
    const entityMap = this.entitySubscriptions.get(entityCode);
    if (!entityMap) return false;

    const subscribers = entityMap.get(entityId);
    if (!subscribers) return false;

    const removed = subscribers.delete(userId);

    // Cleanup empty sets
    if (subscribers.size === 0) {
      entityMap.delete(entityId);
    }
    if (entityMap.size === 0) {
      this.entitySubscriptions.delete(entityCode);
    }

    return removed;
  }
}

// Singleton export
export const subscriptionManager = new SubscriptionManager();
```

### 5.3 Log Watcher Service

```typescript
// apps/api/src/services/log-watcher.service.ts

import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { subscriptionManager } from './subscription-manager.service.js';
import type { LogEntry, InvalidatePayload } from '@/types/sync.types.js';

// Configuration
const POLL_INTERVAL_MS = 60_000;  // 1 minute
const BATCH_SIZE = 500;

// State
let lastPollTime: Date = new Date();
let isRunning = false;
let pollTimer: NodeJS.Timeout | null = null;

/**
 * Start the log watcher polling loop
 */
export function startLogWatcher(): void {
  if (isRunning) {
    console.warn('[LogWatcher] Already running');
    return;
  }

  isRunning = true;
  lastPollTime = new Date(Date.now() - POLL_INTERVAL_MS);

  console.log(
    '%c[LogWatcher] Started (polling every %ds)',
    'color: #7c3aed; font-weight: bold',
    POLL_INTERVAL_MS / 1000
  );

  // Initial poll
  pollAndNotify();

  // Schedule periodic polls
  pollTimer = setInterval(pollAndNotify, POLL_INTERVAL_MS);
}

/**
 * Stop the log watcher
 */
export function stopLogWatcher(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  isRunning = false;
  console.log('[LogWatcher] Stopped');
}

/**
 * Main polling function
 */
async function pollAndNotify(): Promise<void> {
  const pollStartTime = new Date();

  try {
    // 1. Fetch pending changes (excluding VIEW actions)
    const logs = await db.execute<LogEntry>(sql`
      UPDATE app.logging
      SET sync_status = 'processing'
      WHERE id IN (
        SELECT id FROM app.logging
        WHERE created_ts > ${lastPollTime}
          AND sync_status = 'pending'
          AND action != 0  -- Exclude VIEW
        ORDER BY created_ts ASC
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, entity_code, entity_id, action, created_ts
    `);

    if (logs.length === 0) {
      lastPollTime = pollStartTime;
      return;
    }

    console.log(`[LogWatcher] Processing ${logs.length} changes`);

    // 2. Group by entity_code + entity_id and find subscribers
    const notifications = matchChangesToSubscribers(logs);

    // 3. Send notifications
    const sentCount = await sendNotifications(notifications);

    // 4. Mark logs as sent
    const logIds = logs.map(l => l.id);
    await db.execute(sql`
      UPDATE app.logging
      SET sync_status = 'sent',
          sync_processed_ts = now()
      WHERE id = ANY(${logIds}::uuid[])
    `);

    lastPollTime = pollStartTime;

    console.log(
      `[LogWatcher] Sent ${sentCount} notifications for ${logs.length} changes`
    );

  } catch (error) {
    console.error('[LogWatcher] Error:', error);

    // Reset any stuck 'processing' logs
    await db.execute(sql`
      UPDATE app.logging
      SET sync_status = 'pending'
      WHERE sync_status = 'processing'
        AND sync_processed_ts IS NULL
    `);
  }
}

/**
 * Match changes to subscribers
 * Returns: Map<userId, InvalidatePayload[]>
 */
function matchChangesToSubscribers(
  logs: LogEntry[]
): Map<string, InvalidatePayload> {
  // Group logs by entity_code
  const byEntityCode = new Map<string, Map<string, number>>();

  for (const log of logs) {
    if (!byEntityCode.has(log.entity_code)) {
      byEntityCode.set(log.entity_code, new Map());
    }
    const entityMap = byEntityCode.get(log.entity_code)!;

    // Store the latest action for each entity_id
    // If multiple changes, prioritize DELETE > CREATE > UPDATE
    const existing = entityMap.get(log.entity_id);
    if (!existing || log.action > existing) {
      entityMap.set(log.entity_id, log.action);
    }
  }

  // For each changed entity, find subscribers and group notifications
  const userNotifications = new Map<string, Map<string, InvalidatePayload>>();

  for (const [entityCode, entityChanges] of byEntityCode) {
    for (const [entityId, action] of entityChanges) {
      // Find users subscribed to this specific entity instance
      const subscribers = subscriptionManager.getSubscribers(entityCode, entityId);

      for (const userId of subscribers) {
        // Initialize user's notification map
        if (!userNotifications.has(userId)) {
          userNotifications.set(userId, new Map());
        }
        const userPayloads = userNotifications.get(userId)!;

        // Initialize or append to entity type payload
        if (!userPayloads.has(entityCode)) {
          userPayloads.set(entityCode, {
            entityCode,
            changes: [],
            timestamp: new Date().toISOString()
          });
        }

        userPayloads.get(entityCode)!.changes.push({
          entityId,
          action: actionToString(action)
        });
      }
    }
  }

  // Flatten to Map<userId, InvalidatePayload[]>
  const result = new Map<string, InvalidatePayload[]>();
  for (const [userId, payloads] of userNotifications) {
    result.set(userId, Array.from(payloads.values()));
  }

  return result;
}

/**
 * Send notifications to users via WebSocket
 */
async function sendNotifications(
  notifications: Map<string, InvalidatePayload[]>
): Promise<number> {
  let sentCount = 0;

  for (const [userId, payloads] of notifications) {
    const socket = subscriptionManager.getSocket(userId);

    if (!socket || socket.readyState !== 1) {
      // User not connected - skip
      continue;
    }

    try {
      // Send one message per entity type (batched)
      for (const payload of payloads) {
        socket.send(JSON.stringify({
          type: 'INVALIDATE',
          payload
        }));
        sentCount++;
      }
    } catch (error) {
      console.error(`[LogWatcher] Failed to send to ${userId}:`, error);
    }
  }

  return sentCount;
}

function actionToString(action: number): 'CREATE' | 'UPDATE' | 'DELETE' {
  switch (action) {
    case 3: return 'DELETE';
    case 4: return 'CREATE';
    default: return 'UPDATE';
  }
}

/**
 * Get watcher status
 */
export function getWatcherStatus(): {
  isRunning: boolean;
  lastPoll: Date;
  intervalMs: number;
} {
  return {
    isRunning,
    lastPoll: lastPollTime,
    intervalMs: POLL_INTERVAL_MS
  };
}
```

### 5.4 WebSocket Plugin

```typescript
// apps/api/src/plugins/websocket.plugin.ts

import fastifyWebsocket from '@fastify/websocket';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import { subscriptionManager } from '@/services/subscription-manager.service.js';
import { startLogWatcher, stopLogWatcher, getWatcherStatus } from '@/services/log-watcher.service.js';
import type { ClientMessage } from '@/types/sync.types.js';

export async function websocketPlugin(fastify: FastifyInstance): Promise<void> {
  // Register WebSocket support
  await fastify.register(fastifyWebsocket, {
    options: {
      maxPayload: 1048576,  // 1MB
      clientTracking: true
    }
  });

  // Start log watcher when server is ready
  fastify.addHook('onReady', () => {
    startLogWatcher();
  });

  // Stop log watcher on shutdown
  fastify.addHook('onClose', () => {
    stopLogWatcher();
  });

  // WebSocket sync endpoint
  fastify.get('/ws/sync', {
    websocket: true,
    preHandler: fastify.auth([fastify.verifyJWT])
  }, (socket: WebSocket, request: FastifyRequest) => {
    const userId = (request as any).user?.sub as string;

    if (!userId) {
      socket.close(4001, 'Unauthorized');
      return;
    }

    // Register connection
    subscriptionManager.connect(userId, socket);

    // Send welcome message
    socket.send(JSON.stringify({
      type: 'CONNECTED',
      payload: {
        connectionId: crypto.randomUUID(),
        userId,
        serverTime: new Date().toISOString()
      }
    }));

    // Handle messages
    socket.on('message', (data) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());
        handleClientMessage(userId, socket, message);
      } catch (error) {
        sendError(socket, 'INVALID_MESSAGE', 'Failed to parse message');
      }
    });

    // Handle disconnect
    socket.on('close', () => {
      subscriptionManager.disconnect(userId);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`[WebSocket] Error for ${userId}:`, error);
    });

    // Heartbeat (every 30s)
    const heartbeatInterval = setInterval(() => {
      if (socket.readyState === 1) {
        socket.ping();
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 30000);

    socket.on('close', () => clearInterval(heartbeatInterval));
  });

  // REST endpoint for sync status
  fastify.get('/api/v1/sync/status', {
    preHandler: fastify.auth([fastify.verifyJWT])
  }, async (request, reply) => {
    const userId = (request as any).user?.sub as string;

    return {
      watcher: getWatcherStatus(),
      global: subscriptionManager.getGlobalStats(),
      user: subscriptionManager.getUserStats(userId)
    };
  });
}

function handleClientMessage(
  userId: string,
  socket: WebSocket,
  message: ClientMessage
): void {
  switch (message.type) {
    case 'SUBSCRIBE': {
      const { entityCode, entityIds } = message.payload;
      const result = subscriptionManager.subscribe(userId, entityCode, entityIds);

      if (result.success) {
        socket.send(JSON.stringify({
          type: 'SUBSCRIBED',
          payload: {
            entityCode,
            count: result.count,
            totalSubscriptions: getTotalSubscriptions(userId)
          }
        }));
      } else {
        sendError(socket, 'SUBSCRIPTION_FAILED', result.error || 'Unknown error');
      }
      break;
    }

    case 'UNSUBSCRIBE': {
      const { entityCode, entityIds } = message.payload;
      const result = subscriptionManager.unsubscribe(userId, entityCode, entityIds);

      socket.send(JSON.stringify({
        type: 'UNSUBSCRIBED',
        payload: {
          entityCode,
          count: result.count,
          totalSubscriptions: getTotalSubscriptions(userId)
        }
      }));
      break;
    }

    case 'UNSUBSCRIBE_ALL': {
      const count = subscriptionManager.unsubscribeAll(userId);
      socket.send(JSON.stringify({
        type: 'UNSUBSCRIBED',
        payload: {
          entityCode: '*',
          count,
          totalSubscriptions: 0
        }
      }));
      break;
    }

    case 'PING': {
      socket.send(JSON.stringify({
        type: 'PONG',
        payload: { serverTime: new Date().toISOString() }
      }));
      break;
    }

    case 'GET_SUBSCRIPTIONS': {
      const stats = subscriptionManager.getUserStats(userId);
      socket.send(JSON.stringify({
        type: 'SUBSCRIPTIONS',
        payload: {
          ...stats,
          total: Object.values(stats).reduce((a, b) => a + b, 0)
        }
      }));
      break;
    }

    default:
      sendError(socket, 'UNKNOWN_MESSAGE', `Unknown message type`);
  }
}

function getTotalSubscriptions(userId: string): number {
  const stats = subscriptionManager.getUserStats(userId);
  return Object.values(stats).reduce((a, b) => a + b, 0);
}

function sendError(socket: WebSocket, code: string, message: string): void {
  socket.send(JSON.stringify({
    type: 'ERROR',
    payload: { code, message }
  }));
}
```

### 5.5 Frontend: Sync Provider

```typescript
// apps/web/src/db/sync/SyncProvider.tsx

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDatabase } from '../hooks/useDatabase';

// Types
type SyncStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface SyncContextValue {
  status: SyncStatus;
  subscribe: (entityCode: string, entityIds: string[]) => void;
  unsubscribe: (entityCode: string, entityIds?: string[]) => void;
  unsubscribeAll: () => void;
  getSubscriptionCount: () => number;
}

interface InvalidatePayload {
  entityCode: string;
  changes: Array<{ entityId: string; action: 'CREATE' | 'UPDATE' | 'DELETE' }>;
  timestamp: string;
}

// Context
const SyncContext = createContext<SyncContextValue | null>(null);

// Configuration
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000/ws/sync';
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];

// Provider
export function SyncProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated } = useAuth();
  const db = useDatabase();
  const [status, setStatus] = useState<SyncStatus>('disconnected');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const subscriptionsRef = useRef<Map<string, Set<string>>>(new Map());  // entityCode → Set<entityId>

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!token || !isAuthenticated) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');

    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('%c[Sync] Connected', 'color: #22c55e');
      setStatus('connected');
      reconnectAttemptRef.current = 0;

      // Re-subscribe to previously subscribed entities
      for (const [entityCode, entityIds] of subscriptionsRef.current) {
        if (entityIds.size > 0) {
          ws.send(JSON.stringify({
            type: 'SUBSCRIBE',
            payload: { entityCode, entityIds: Array.from(entityIds) }
          }));
        }
      }
    };

    ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        await handleMessage(message);
      } catch (error) {
        console.error('[Sync] Error handling message:', error);
      }
    };

    ws.onclose = () => {
      console.log('%c[Sync] Disconnected', 'color: #f97316');
      setStatus('disconnected');
      scheduleReconnect();
    };

    ws.onerror = () => {
      setStatus('error');
    };
  }, [token, isAuthenticated]);

  // Handle incoming messages
  const handleMessage = async (message: { type: string; payload?: any }) => {
    switch (message.type) {
      case 'INVALIDATE':
        await handleInvalidation(message.payload as InvalidatePayload);
        break;
      case 'CONNECTED':
        console.log('[Sync] Server info:', message.payload);
        break;
      case 'SUBSCRIBED':
        console.log('[Sync] Subscribed:', message.payload);
        break;
      case 'PONG':
        // Heartbeat response
        break;
      case 'ERROR':
        console.error('[Sync] Server error:', message.payload);
        break;
    }
  };

  // Handle invalidation - refetch from API
  const handleInvalidation = async (payload: InvalidatePayload) => {
    const { entityCode, changes } = payload;
    console.log(`%c[Sync] INVALIDATE: ${entityCode} (${changes.length} changes)`, 'color: #7c3aed');

    const collection = db?.collections[entityCode];
    if (!collection) {
      console.warn(`[Sync] Unknown collection: ${entityCode}`);
      return;
    }

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

    for (const change of changes) {
      try {
        if (change.action === 'DELETE') {
          // Remove from local RxDB
          const doc = await collection.findOne(change.entityId).exec();
          if (doc) {
            await doc.remove();
            console.log(`[Sync] Deleted local: ${entityCode}/${change.entityId}`);
          }
        } else {
          // Refetch from API
          const response = await fetch(
            `${API_URL}/api/v1/${entityCode}/${change.entityId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (response.ok) {
            const data = await response.json();
            await collection.upsert({
              ...data,
              _deleted: data.active_flag === false
            });
            console.log(`[Sync] Updated local: ${entityCode}/${change.entityId}`);
          } else if (response.status === 404 || response.status === 403) {
            // Deleted or access revoked
            const doc = await collection.findOne(change.entityId).exec();
            if (doc) await doc.remove();
          }
        }
      } catch (error) {
        console.error(`[Sync] Failed to process ${entityCode}/${change.entityId}:`, error);
      }
    }
  };

  // Schedule reconnection
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) return;

    const delay = RECONNECT_DELAYS[
      Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS.length - 1)
    ];

    console.log(`[Sync] Reconnecting in ${delay}ms...`);

    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      reconnectAttemptRef.current++;
      connect();
    }, delay);
  }, [connect]);

  // Subscribe to entity instances
  const subscribe = useCallback((entityCode: string, entityIds: string[]) => {
    // Track locally
    if (!subscriptionsRef.current.has(entityCode)) {
      subscriptionsRef.current.set(entityCode, new Set());
    }
    const entitySet = subscriptionsRef.current.get(entityCode)!;
    entityIds.forEach(id => entitySet.add(id));

    // Send to server if connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'SUBSCRIBE',
        payload: { entityCode, entityIds }
      }));
    }
  }, []);

  // Unsubscribe from entity instances
  const unsubscribe = useCallback((entityCode: string, entityIds?: string[]) => {
    const entitySet = subscriptionsRef.current.get(entityCode);

    if (entityIds) {
      entityIds.forEach(id => entitySet?.delete(id));
    } else {
      subscriptionsRef.current.delete(entityCode);
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'UNSUBSCRIBE',
        payload: { entityCode, entityIds }
      }));
    }
  }, []);

  // Unsubscribe from all
  const unsubscribeAll = useCallback(() => {
    subscriptionsRef.current.clear();

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'UNSUBSCRIBE_ALL' }));
    }
  }, []);

  // Get subscription count
  const getSubscriptionCount = useCallback(() => {
    let count = 0;
    for (const entitySet of subscriptionsRef.current.values()) {
      count += entitySet.size;
    }
    return count;
  }, []);

  // Connect on auth
  useEffect(() => {
    if (isAuthenticated && token) {
      connect();
    } else {
      wsRef.current?.close();
      wsRef.current = null;
      setStatus('disconnected');
    }

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [isAuthenticated, token, connect]);

  return (
    <SyncContext.Provider
      value={{ status, subscribe, unsubscribe, unsubscribeAll, getSubscriptionCount }}
    >
      {children}
    </SyncContext.Provider>
  );
}

// Hook
export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within SyncProvider');
  }
  return context;
}

export function useSyncStatus(): SyncStatus {
  return useSync().status;
}
```

### 5.6 Frontend: Auto-Subscriber Hook

```typescript
// apps/web/src/db/sync/autoSubscriber.ts

import { useEffect, useRef } from 'react';
import { useSync } from './SyncProvider';

/**
 * Hook to auto-subscribe to entities when they're loaded into RxDB
 *
 * Usage:
 * ```tsx
 * function ProjectList() {
 *   const { data } = useEntityList('project', { page: 1 });
 *
 *   // Auto-subscribe to loaded entities
 *   useAutoSubscribe('project', data?.map(p => p.id) || []);
 *
 *   return <DataTable data={data} />;
 * }
 * ```
 */
export function useAutoSubscribe(entityCode: string, entityIds: string[]): void {
  const { subscribe, unsubscribe } = useSync();
  const previousIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!entityCode || entityIds.length === 0) return;

    const currentIds = new Set(entityIds);
    const previousIds = previousIdsRef.current;

    // Find new IDs to subscribe
    const newIds = entityIds.filter(id => !previousIds.has(id));

    // Find removed IDs to unsubscribe
    const removedIds = Array.from(previousIds).filter(id => !currentIds.has(id));

    // Subscribe to new
    if (newIds.length > 0) {
      subscribe(entityCode, newIds);
    }

    // Unsubscribe from removed
    if (removedIds.length > 0) {
      unsubscribe(entityCode, removedIds);
    }

    // Update ref
    previousIdsRef.current = currentIds;
  }, [entityCode, entityIds.join(','), subscribe, unsubscribe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const ids = Array.from(previousIdsRef.current);
      if (ids.length > 0) {
        unsubscribe(entityCode, ids);
      }
    };
  }, [entityCode, unsubscribe]);
}

/**
 * Higher-level hook that wraps useEntityList with auto-subscription
 */
export function useEntityListWithSync<T extends { id: string }>(
  entityCode: string,
  params: any
) {
  // Import dynamically to avoid circular deps
  const { useEntityList } = require('../hooks/useEntityQuery');
  const result = useEntityList<T>(entityCode, params);

  // Auto-subscribe to loaded entities
  useAutoSubscribe(entityCode, result.data?.map((item: T) => item.id) || []);

  return result;
}
```

### 5.7 Frontend: Integration with App

```typescript
// apps/web/src/App.tsx (add SyncProvider)

import { SyncProvider } from '@/db/sync/SyncProvider';
import { SyncStatusIndicator } from '@/components/shared/SyncStatusIndicator';

function App() {
  return (
    <AuthProvider>
      <DatabaseProvider>
        <SyncProvider>  {/* Add here */}
          <Router>
            {/* ... routes */}
          </Router>
          <SyncStatusIndicator />  {/* Optional UI */}
        </SyncProvider>
      </DatabaseProvider>
    </AuthProvider>
  );
}
```

```typescript
// apps/web/src/components/shared/SyncStatusIndicator.tsx

import { useSyncStatus } from '@/db/sync/SyncProvider';

export function SyncStatusIndicator() {
  const status = useSyncStatus();

  const config = {
    connected: { color: 'bg-green-500', label: 'Live' },
    connecting: { color: 'bg-yellow-500', label: 'Connecting' },
    disconnected: { color: 'bg-gray-400', label: 'Offline' },
    error: { color: 'bg-red-500', label: 'Error' }
  };

  const { color, label } = config[status];

  return (
    <div className="fixed bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-background border rounded-full shadow-sm text-xs">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
```

### 5.8 Usage in Components

```typescript
// apps/web/src/pages/ProjectListPage.tsx

import { useAutoSubscribe } from '@/db/sync/autoSubscriber';
import { useEntityList } from '@/db/hooks/useEntityQuery';

function ProjectListPage() {
  const { data, isLoading, page, setPage } = useEntityList('project', {
    page: 1,
    pageSize: 50
  });

  // Auto-subscribe to loaded projects
  useAutoSubscribe('project', data?.map(p => p.id) || []);

  // When data changes, auto-subscriber updates subscriptions
  // When page changes, new entities subscribed, old ones unsubscribed
  // When component unmounts, all subscriptions cleaned up

  return (
    <div>
      {isLoading ? (
        <Spinner />
      ) : (
        <DataTable data={data} onPageChange={setPage} />
      )}
    </div>
  );
}
```

---

## 6. Deployment

### 6.1 Package Dependencies

```bash
# Backend
pnpm add @fastify/websocket ws
pnpm add -D @types/ws

# Frontend (no additional deps - uses native WebSocket)
```

### 6.2 Environment Variables

```bash
# Backend (.env)
# (No additional config needed - uses existing DB and auth)

# Frontend (.env)
VITE_WS_URL=ws://localhost:4000/ws/sync
# Production: wss://api.yourapp.com/ws/sync
```

### 6.3 Infrastructure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DEPLOYMENT ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   For <1000 users: Single Server                                            │
│   ─────────────────────────────────                                         │
│                                                                              │
│   ┌─────────────┐     ┌─────────────────────┐     ┌─────────────┐          │
│   │   Clients   │────►│   EC2 (t3.large)    │────►│  RDS        │          │
│   │   (Browser) │◄────│   Fastify + WS      │◄────│  PostgreSQL │          │
│   └─────────────┘     └─────────────────────┘     └─────────────┘          │
│                                                                              │
│   Cost: ~$100/month                                                         │
│                                                                              │
│   ─────────────────────────────────────────────────────────────────────     │
│                                                                              │
│   For 1000-10000 users: Multiple Servers + Redis                            │
│   ──────────────────────────────────────────────                            │
│                                                                              │
│   ┌─────────────┐     ┌─────────────────────┐                               │
│   │   Clients   │────►│   ALB (sticky)      │                               │
│   └─────────────┘     └──────────┬──────────┘                               │
│                                  │                                          │
│                       ┌──────────┼──────────┐                               │
│                       ▼          ▼          ▼                               │
│                  ┌─────────┐ ┌─────────┐ ┌─────────┐                        │
│                  │ API-1   │ │ API-2   │ │ API-3   │                        │
│                  │ +WS     │ │ +WS     │ │ +WS     │                        │
│                  └────┬────┘ └────┬────┘ └────┬────┘                        │
│                       │          │          │                               │
│                       └──────────┼──────────┘                               │
│                                  │                                          │
│                       ┌──────────▼──────────┐                               │
│                       │   Redis (Pub/Sub)   │◄─── Sync subscriptions        │
│                       └──────────┬──────────┘     across pods               │
│                                  │                                          │
│                       ┌──────────▼──────────┐                               │
│                       │   RDS PostgreSQL    │                               │
│                       └─────────────────────┘                               │
│                                                                              │
│   Cost: ~$300/month                                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

| Component | Purpose | Key Files |
|-----------|---------|-----------|
| **Logging Table** | Record all entity changes | `db/XXXV_logging.ddl` |
| **Subscription Manager** | Track who is subscribed to what | `subscription-manager.service.ts` |
| **Log Watcher** | Poll logs, match to subscriptions | `log-watcher.service.ts` |
| **WebSocket Plugin** | Handle client connections | `websocket.plugin.ts` |
| **Sync Provider** | React context for sync | `SyncProvider.tsx` |
| **Auto Subscriber** | Auto-subscribe on data load | `autoSubscriber.ts` |

**Total new backend code**: ~600 lines
**Total new frontend code**: ~400 lines
**Implementation time**: ~2-3 weeks
