# Version Management & Cache Invalidation Architecture

> **Complete guide to version tracking and cache invalidation between backend and frontend**

**Created**: 2025-11-17
**Platform Version**: 3.3.0

---

## Overview

This document explains how the PMO platform manages software versions and coordinates cache invalidation between backend and frontend.

---

## Part 1: Backend Version Management

### Current State ❌

**Backend Version Storage**:
- ✅ Stored in `apps/api/package.json` → `"version": "1.0.0"`
- ❌ NOT exposed via API endpoint
- ❌ NOT stored in database
- ❌ NOT sent in HTTP headers
- ✅ Hardcoded in Swagger docs (server.ts line 86)

**Frontend Version Storage**:
- ✅ Stored in `apps/web/package.json` → `"version": "0.0.0"`
- ❌ NOT exposed to users
- ❌ NOT checked against backend

### Recommended Architecture ✅

```
┌─────────────────────────────────────────────────────────────┐
│                    VERSION SOURCES                           │
├─────────────────────────────────────────────────────────────┤
│  1. package.json (Source of Truth)                          │
│     - Backend: apps/api/package.json → "1.0.0"              │
│     - Frontend: apps/web/package.json → "3.3.0"             │
│                                                              │
│  2. Environment Variables (Build Time)                       │
│     - VITE_APP_VERSION (injected at build)                  │
│     - API_VERSION (injected at build)                       │
│                                                              │
│  3. API Response Headers (Runtime)                           │
│     - X-API-Version: "1.0.0"                                │
│     - X-App-Version: "3.3.0" (from frontend build)          │
│                                                              │
│  4. Database Table (Optional)                                │
│     - d_system_version (schema version, migration history)   │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation: Backend Version Tracking

### Option 1: API Version Endpoint (Recommended ⭐)

**File**: `apps/api/src/modules/system/routes.ts` (NEW)

```typescript
import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'fs';
import { resolve } from 'path';

export default async function systemRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/system/version
   * Returns current API and platform version
   */
  fastify.get('/api/v1/system/version', {
    schema: {
      tags: ['system'],
      summary: 'Get API version',
      response: {
        200: {
          type: 'object',
          properties: {
            api_version: { type: 'string' },
            platform_version: { type: 'string' },
            build_date: { type: 'string' },
            git_commit: { type: 'string' },
            environment: { type: 'string' }
          }
        }
      }
    }
  }, async () => {
    // Read version from package.json
    const packagePath = resolve(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));

    return {
      api_version: packageJson.version || '1.0.0',
      platform_version: process.env.PLATFORM_VERSION || '3.3.0',
      build_date: process.env.BUILD_DATE || new Date().toISOString(),
      git_commit: process.env.GIT_COMMIT || 'unknown',
      environment: process.env.NODE_ENV || 'development'
    };
  });

  /**
   * GET /api/v1/system/info
   * Extended system information (requires auth)
   */
  fastify.get('/api/v1/system/info', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['system'],
      summary: 'Get detailed system information',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            version: { type: 'object' },
            database: { type: 'object' },
            cache: { type: 'object' },
            uptime: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const packagePath = resolve(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));

    return {
      version: {
        api: packageJson.version,
        platform: process.env.PLATFORM_VERSION || '3.3.0',
        node: process.version,
        build_date: process.env.BUILD_DATE
      },
      database: {
        connected: true,
        // Add database version info
      },
      cache: {
        enabled: true,
        ttl: 300 // 5 minutes
      },
      uptime: process.uptime()
    };
  });
}
```

**Register in** `apps/api/src/modules/index.ts`:

```typescript
import systemRoutes from './system/routes.js';

export async function registerAllRoutes(fastify: FastifyInstance) {
  // ... existing routes
  await fastify.register(systemRoutes);
}
```

### Option 2: Version Header Middleware (Simple ⚡)

**File**: `apps/api/src/server.ts`

Add after CORS setup:

```typescript
// Version header middleware
fastify.addHook('onRequest', async (request, reply) => {
  const packageJson = await import('../package.json', { assert: { type: 'json' } });
  reply.header('X-API-Version', packageJson.default.version);
  reply.header('X-Platform-Version', process.env.PLATFORM_VERSION || '3.3.0');
});
```

**Benefits**:
- ✅ Zero code change in routes
- ✅ Version in every response
- ✅ Frontend can check version on any API call

### Option 3: Database Version Table (Enterprise 🏢)

**File**: `db/system/d_system_version.ddl` (NEW)

```sql
-- System version tracking table
CREATE TABLE IF NOT EXISTS app.d_system_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number varchar(50) NOT NULL, -- e.g., "3.3.0"
  version_type varchar(20) NOT NULL,   -- "api", "platform", "schema"
  release_date timestamp with time zone DEFAULT now(),
  description text,
  changelog jsonb,                      -- {"features": [...], "fixes": [...]}
  migration_status varchar(20),         -- "pending", "applied", "failed"
  applied_by varchar(100),
  applied_at timestamp with time zone,
  metadata jsonb,
  active_flag boolean DEFAULT true,
  created_ts timestamp with time zone DEFAULT now(),
  updated_ts timestamp with time zone DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX idx_system_version_type ON app.d_system_version(version_type);
CREATE INDEX idx_system_version_active ON app.d_system_version(active_flag);

-- Seed current version
INSERT INTO app.d_system_version (version_number, version_type, description)
VALUES
  ('1.0.0', 'api', 'Initial API release'),
  ('3.3.0', 'platform', 'Complete documentation revamp'),
  ('1', 'schema', 'Initial schema version')
ON CONFLICT DO NOTHING;
```

**Query Version**:

```typescript
// Get current versions
const versions = await db.execute(sql`
  SELECT version_type, version_number, release_date
  FROM app.d_system_version
  WHERE active_flag = true
  ORDER BY release_date DESC
`);
```

---

## Part 2: Frontend Version Detection

### Implementation

**File**: `apps/web/src/lib/versionManager.ts` (NEW)

```typescript
/**
 * Version Manager
 *
 * Checks backend version and invalidates cache if version changed
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const FRONTEND_VERSION = import.meta.env.VITE_APP_VERSION || '3.3.0';
const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

interface VersionInfo {
  api_version: string;
  platform_version: string;
  build_date: string;
  git_commit: string;
  environment: string;
}

/**
 * Fetch current backend version
 */
export async function fetchBackendVersion(): Promise<VersionInfo | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/system/version`);
    if (!response.ok) throw new Error('Version check failed');
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch backend version:', error);
    return null;
  }
}

/**
 * Check if backend version changed
 * Returns true if version changed, false otherwise
 */
export async function checkVersionChange(): Promise<boolean> {
  const storedVersion = localStorage.getItem('backend_version');
  const currentVersion = await fetchBackendVersion();

  if (!currentVersion) return false;

  const newVersion = currentVersion.platform_version;

  if (storedVersion && storedVersion !== newVersion) {
    console.log(`🔄 Backend version changed: ${storedVersion} → ${newVersion}`);
    localStorage.setItem('backend_version', newVersion);
    return true;
  }

  if (!storedVersion) {
    localStorage.setItem('backend_version', newVersion);
  }

  return false;
}

/**
 * Check version from response headers
 */
export function checkVersionFromHeaders(response: Response): string | null {
  return response.headers.get('X-API-Version') ||
         response.headers.get('X-Platform-Version');
}

/**
 * Initialize version checking (call on app start)
 */
export function initVersionCheck(onVersionChange?: () => void): void {
  // Check immediately
  checkVersionChange().then(changed => {
    if (changed && onVersionChange) {
      onVersionChange();
    }
  });

  // Check periodically
  setInterval(async () => {
    const changed = await checkVersionChange();
    if (changed && onVersionChange) {
      onVersionChange();
    }
  }, VERSION_CHECK_INTERVAL);
}

/**
 * Get current frontend version
 */
export function getFrontendVersion(): string {
  return FRONTEND_VERSION;
}

/**
 * Compare versions (simple semantic versioning)
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;

    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  return 0; // Equal
}

/**
 * Check if frontend is outdated
 */
export async function isFrontendOutdated(): Promise<boolean> {
  const backendVersion = await fetchBackendVersion();
  if (!backendVersion) return false;

  const result = compareVersions(
    backendVersion.platform_version,
    FRONTEND_VERSION
  );

  return result > 0; // Backend version is newer
}
```

---

## Part 3: Backend-Triggered Cache Invalidation

### Current State ❌

**What EXISTS**:
- ❌ NO cache invalidation mechanism from backend
- ❌ NO WebSocket events for cache updates
- ❌ NO HTTP headers for cache control (except one in chat routes)
- ❌ NO ETags for conditional requests

**What's NEEDED**:
- ✅ Version header in responses
- ✅ Cache-Control headers
- ✅ WebSocket events for real-time invalidation
- ✅ API endpoint to trigger cache clear

### Recommended Approaches

#### Approach 1: HTTP Headers (Simple ⭐)

**File**: `apps/api/src/server.ts`

```typescript
// Cache control middleware
fastify.addHook('onSend', async (request, reply, payload) => {
  const url = request.url;

  // Settings endpoints - 5 minute cache
  if (url.includes('/api/v1/entity') && url.includes('/options')) {
    reply.header('Cache-Control', 'public, max-age=300'); // 5 minutes
    reply.header('X-Cache-Key', url);
  }

  // Entity data - 1 minute cache
  else if (url.includes('/api/v1/')) {
    reply.header('Cache-Control', 'private, max-age=60'); // 1 minute
  }

  // Static data - longer cache
  else if (url.includes('/api/v1/system')) {
    reply.header('Cache-Control', 'public, max-age=3600'); // 1 hour
  }

  return payload;
});
```

#### Approach 2: WebSocket Events (Real-Time 🚀)

**File**: `apps/api/src/modules/system/cache.service.ts` (NEW)

```typescript
import type { FastifyInstance } from 'fastify';

interface CacheInvalidationEvent {
  type: 'cache_invalidate';
  resource: string; // 'settings', 'entity:project', 'all'
  timestamp: string;
  reason?: string;
}

const connectedClients = new Set<any>();

/**
 * Register WebSocket handler for cache invalidation
 */
export function setupCacheWebSocket(fastify: FastifyInstance) {
  fastify.get('/ws/cache', { websocket: true }, (connection, req) => {
    console.log('Client connected to cache WebSocket');
    connectedClients.add(connection);

    connection.on('close', () => {
      connectedClients.delete(connection);
      console.log('Client disconnected from cache WebSocket');
    });
  });
}

/**
 * Broadcast cache invalidation to all connected clients
 */
export function broadcastCacheInvalidation(
  resource: string,
  reason?: string
): void {
  const event: CacheInvalidationEvent = {
    type: 'cache_invalidate',
    resource,
    timestamp: new Date().toISOString(),
    reason
  };

  console.log(`Broadcasting cache invalidation: ${resource}`);

  for (const client of connectedClients) {
    try {
      client.send(JSON.stringify(event));
    } catch (error) {
      console.error('Failed to send to client:', error);
      connectedClients.delete(client);
    }
  }
}

/**
 * Trigger cache invalidation after settings update
 */
export async function invalidateSettingsCache(
  datalabel: string
): Promise<void> {
  broadcastCacheInvalidation(`settings:${datalabel}`, 'settings updated');
}
```

**Use in Routes**:

```typescript
// After updating settings
fastify.patch('/api/v1/settings/:datalabel/:code', async (request, reply) => {
  const { datalabel, code } = request.params;
  const data = request.body;

  // Update in database
  await db.execute(sql`UPDATE app.setting_datalabel_${datalabel} ...`);

  // Invalidate cache for all connected clients
  broadcastCacheInvalidation(`settings:${datalabel}`);

  return reply.send({ success: true });
});
```

**Frontend WebSocket Handler**:

```typescript
// apps/web/src/lib/cacheWebSocket.ts

import { clearSettingsCache } from './settingsLoader';

let ws: WebSocket | null = null;

export function connectCacheWebSocket() {
  ws = new WebSocket('ws://localhost:4000/ws/cache');

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);

    if (message.type === 'cache_invalidate') {
      console.log(`Cache invalidation received: ${message.resource}`);

      if (message.resource === 'all') {
        // Clear all caches
        clearAllCaches();
      } else if (message.resource.startsWith('settings:')) {
        // Clear specific settings cache
        const datalabel = message.resource.split(':')[1];
        clearSettingsCache(datalabel);
      }
    }
  };

  ws.onerror = (error) => {
    console.error('Cache WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('Cache WebSocket closed, reconnecting...');
    setTimeout(connectCacheWebSocket, 5000);
  };
}
```

#### Approach 3: API Endpoint (Manual Trigger 🔧)

**File**: `apps/api/src/modules/system/routes.ts`

```typescript
/**
 * POST /api/v1/system/cache/invalidate
 * Manually trigger cache invalidation
 */
fastify.post('/api/v1/system/cache/invalidate', {
  preHandler: [fastify.authenticate],
  schema: {
    tags: ['system'],
    summary: 'Invalidate frontend caches',
    security: [{ bearerAuth: [] }],
    body: {
      type: 'object',
      properties: {
        resource: {
          type: 'string',
          enum: ['all', 'settings', 'entity']
        },
        datalabel: { type: 'string' }
      },
      required: ['resource']
    }
  }
}, async (request, reply) => {
  const { resource, datalabel } = request.body;

  // Broadcast to all connected WebSocket clients
  if (resource === 'all') {
    broadcastCacheInvalidation('all', 'manual trigger');
  } else if (resource === 'settings' && datalabel) {
    broadcastCacheInvalidation(`settings:${datalabel}`, 'manual trigger');
  }

  return {
    success: true,
    message: `Cache invalidation triggered for: ${resource}`,
    timestamp: new Date().toISOString()
  };
});
```

---

## Part 4: Complete Integration

### App Initialization

**File**: `apps/web/src/App.tsx`

```typescript
import { useEffect } from 'react';
import { initVersionCheck } from './lib/versionManager';
import { connectCacheWebSocket } from './lib/cacheWebSocket';
import { clearAllCaches } from './lib/cacheUtils';

function App() {
  useEffect(() => {
    // Initialize version checking
    initVersionCheck(async () => {
      console.log('🔄 Backend version changed, clearing caches...');
      await clearAllCaches();

      // Optionally notify user
      if (confirm('A new version is available. Reload to update?')) {
        window.location.reload();
      }
    });

    // Connect to cache WebSocket
    connectCacheWebSocket();

    // Cleanup
    return () => {
      // Disconnect WebSocket on unmount
    };
  }, []);

  return <div>...</div>;
}
```

### Build-Time Version Injection

**File**: `apps/web/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import { execSync } from 'child_process';
import packageJson from './package.json';

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version),
    'import.meta.env.VITE_BUILD_DATE': JSON.stringify(new Date().toISOString()),
    'import.meta.env.VITE_GIT_COMMIT': JSON.stringify(
      execSync('git rev-parse --short HEAD').toString().trim()
    )
  }
});
```

**File**: `apps/api/.env`

```bash
PLATFORM_VERSION=3.3.0
BUILD_DATE=2025-11-17T00:00:00Z
GIT_COMMIT=$(git rev-parse --short HEAD)
```

---

## Summary

### ✅ Complete Solution

| Component | Status | Implementation |
|-----------|--------|----------------|
| **Backend Version Tracking** | ✅ Implement | `/api/v1/system/version` endpoint |
| **Version Headers** | ✅ Implement | `X-API-Version` in all responses |
| **Frontend Version Check** | ✅ Implement | `versionManager.ts` periodic check |
| **WebSocket Invalidation** | ⭐ Recommended | Real-time cache clear events |
| **Manual Invalidation API** | ✅ Implement | `/api/v1/system/cache/invalidate` |
| **Auto-clear on Version Change** | ✅ Implement | Clear caches when version differs |

### 🚀 Recommended Implementation Order

**Week 1: Basic Version Management**
1. Add `/api/v1/system/version` endpoint
2. Add version headers to all responses
3. Create `versionManager.ts` frontend utility
4. Add version check on app initialization

**Week 2: Cache Invalidation**
1. Add cache control headers
2. Create manual invalidation API endpoint
3. Update settings routes to trigger invalidation

**Week 3: Real-Time (Optional)**
1. Setup WebSocket for cache events
2. Broadcast invalidation on settings updates
3. Frontend WebSocket listener

---

## Related Documentation

- [Cache Invalidation Guide](../performance/CACHE_INVALIDATION_GUIDE.md)
- [Performance Optimization](../performance/FORMATTER_PERFORMANCE_OPTIMIZATION.md)
- [Universal Formatter Service](../services/UNIVERSAL_FORMATTER_SERVICE.md)

---

**Version**: 1.0.0 | **Last Updated**: 2025-11-17
