# PMO Platform - Next Generation Architecture Suggestions

> **Comprehensive Analysis & Modernization Roadmap**
>
> Analysis Date: 2025-10-18
> Current Version: Production v1.0

---

## Executive Summary

The PMO Platform demonstrates **excellent foundational architecture** with innovative universal entity patterns, configuration-driven design, and comprehensive RBAC. The following ratings and suggestions provide a roadmap to transform this already strong platform into a **next-generation enterprise system**.

### Overall Ratings

| Category | Rating | Grade | Status |
|----------|--------|-------|--------|
| **Scalability** | 7.0/10 | Good | Ready for medium-scale, needs optimization for large-scale |
| **Security** | 6.5/10 | Good | Solid foundation, missing enterprise security features |
| **Modern Design Patterns** | 7.5/10 | Very Good | Innovative universal patterns, room for event-driven architecture |
| **Code Architecture** | 7.0/10 | Good | Excellent DRY principles, needs service layer abstraction |
| **Overall** | **7.0/10** | **Good** | Production-ready with clear path to excellence |

---

## 1. Scalability Assessment

### Current Rating: **7.0/10**

### Strengths ✅

1. **Universal Entity Architecture** - Eliminates code duplication (94% reduction)
2. **Configuration-Driven Design** - Single source of truth reduces technical debt
3. **Proper Database Indexing** - Composite indexes on RBAC and entity_id_map
4. **High-Performance Stack** - Fastify + React 19 + PostgreSQL 14+
5. **No Foreign Keys** - Flexible schema evolution without migrations

### Weaknesses ⚠️

1. **No Caching Layer** - Every request hits database
2. **N+1 Query Potential** - entity_id_map joins can cascade
3. **No Horizontal Scaling Strategy** - Single API server
4. **RBAC in Every Query** - Permission checks add overhead
5. **No Background Job Queue** - Long operations block request threads
6. **No Database Read Replicas** - All reads hit primary database
7. **No CDN for Static Assets** - Web assets served directly

---

### Next-Generation Suggestions

#### 1.1 Multi-Layer Caching Strategy

**Problem:** Every API call hits PostgreSQL, even for rarely-changing data (settings, entity metadata).

**Solution:** Implement Redis-based multi-layer caching

**Implementation:**

```typescript
// apps/api/src/lib/cache.ts
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  keyPrefix: 'pmo:',
});

export class CacheService {
  // L1: In-memory cache (10 seconds TTL)
  private memCache = new Map<string, { data: any; expiry: number }>();

  // L2: Redis cache (5 minutes TTL for settings, 1 minute for entity data)
  async get<T>(key: string): Promise<T | null> {
    // Check L1 first
    const memCached = this.memCache.get(key);
    if (memCached && memCached.expiry > Date.now()) {
      return memCached.data as T;
    }

    // Check L2
    const cached = await redis.get(key);
    if (cached) {
      const data = JSON.parse(cached);
      // Populate L1
      this.memCache.set(key, { data, expiry: Date.now() + 10000 });
      return data as T;
    }

    return null;
  }

  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
    this.memCache.set(key, { data: value, expiry: Date.now() + 10000 });
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    // Clear matching L1 entries
    for (const key of this.memCache.keys()) {
      if (key.match(pattern)) {
        this.memCache.delete(key);
      }
    }
  }
}

export const cache = new CacheService();
```

**Usage in API Routes:**

```typescript
// apps/api/src/modules/setting/routes.ts
export async function settingRoutes(fastify: FastifyInstance) {
  fastify.get('/api/v1/setting', async (request, reply) => {
    const { category } = request.query;
    const cacheKey = `setting:${category}`;

    // Try cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      return { data: cached, cached: true };
    }

    // Query database
    const data = await db.execute(sql`
      SELECT * FROM app.setting_datalabel_${category}
      WHERE active_flag = TRUE
      ORDER BY sort_order ASC
    `);

    // Cache for 5 minutes (settings rarely change)
    await cache.set(cacheKey, data, 300);

    return { data, cached: false };
  });

  // Invalidate cache on update
  fastify.put('/api/v1/setting/:id', async (request, reply) => {
    const { category } = request.body;

    // Update database...

    // Invalidate cache
    await cache.invalidate(`setting:${category}`);
  });
}
```

**Cache Invalidation Strategy:**

```typescript
// apps/api/src/lib/cache-invalidation.ts
export const CachePatterns = {
  // Settings - invalidate on update
  SETTINGS: (category: string) => `setting:${category}`,

  // Entity data - invalidate on create/update/delete
  ENTITY_LIST: (entityType: string) => `entity:${entityType}:list:*`,
  ENTITY_DETAIL: (entityType: string, id: string) => `entity:${entityType}:${id}`,

  // Child tabs - invalidate when parent or child changes
  CHILD_TABS: (parentType: string, parentId: string) => `tabs:${parentType}:${parentId}`,

  // RBAC - invalidate when permissions change
  RBAC: (empId: string) => `rbac:${empId}:*`,
};

// Invalidate on entity change
export async function invalidateEntityCache(entityType: string, entityId?: string) {
  await cache.invalidate(CachePatterns.ENTITY_LIST(entityType));
  if (entityId) {
    await cache.invalidate(CachePatterns.ENTITY_DETAIL(entityType, entityId));
  }
}
```

**Expected Impact:**
- 70-90% reduction in database queries for settings
- 40-60% reduction in database queries for entity lists
- 2-5x faster response times for cached data
- Reduced PostgreSQL connection pool saturation

---

#### 1.2 Query Optimization & Batch Loading

**Problem:** N+1 queries when loading child entities and enriched data.

**Solution:** Implement DataLoader pattern for batch fetching

**Implementation:**

```typescript
// apps/api/src/lib/dataloader.ts
import DataLoader from 'dataloader';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

// Batch load child entities
export const childEntityLoader = new DataLoader(
  async (keys: readonly { parentId: string; childType: string }[]) => {
    // Group by child type for efficient querying
    const grouped = keys.reduce((acc, key) => {
      if (!acc[key.childType]) acc[key.childType] = [];
      acc[key.childType].push(key.parentId);
      return acc;
    }, {} as Record<string, string[]>);

    const results = await Promise.all(
      Object.entries(grouped).map(async ([childType, parentIds]) => {
        return db.execute(sql`
          SELECT
            eim.parent_entity_id,
            t.*
          FROM app.d_${childType} t
          INNER JOIN app.d_entity_id_map eim
            ON eim.child_entity_id = t.id::TEXT
          WHERE eim.parent_entity_id = ANY(${parentIds})
            AND eim.child_entity_type = ${childType}
            AND eim.active_flag = TRUE
            AND t.active_flag = TRUE
        `);
      })
    );

    // Map results back to original keys
    const resultMap = new Map();
    results.flat().forEach(row => {
      const key = `${row.parent_entity_id}:${childType}`;
      if (!resultMap.has(key)) resultMap.set(key, []);
      resultMap.get(key).push(row);
    });

    return keys.map(key => resultMap.get(`${key.parentId}:${key.childType}`) || []);
  }
);

// Batch load RBAC permissions
export const rbacLoader = new DataLoader(
  async (empIds: readonly string[]) => {
    const permissions = await db.execute(sql`
      SELECT empid, entity, entity_id, permission
      FROM app.d_entity_id_rbac_map
      WHERE empid = ANY(${Array.from(empIds)})
        AND active_flag = TRUE
    `);

    const permMap = new Map();
    permissions.forEach(p => {
      if (!permMap.has(p.empid)) permMap.set(p.empid, []);
      permMap.get(p.empid).push(p);
    });

    return empIds.map(id => permMap.get(id) || []);
  }
);
```

**Usage:**

```typescript
// apps/api/src/modules/project/routes.ts
fastify.get('/api/v1/project/:id', async (request, reply) => {
  const { id } = request.params;

  // Load project
  const project = await projectApi.get(id);

  // Batch load all child entities in parallel
  const [tasks, wiki, artifacts] = await Promise.all([
    childEntityLoader.load({ parentId: id, childType: 'task' }),
    childEntityLoader.load({ parentId: id, childType: 'wiki' }),
    childEntityLoader.load({ parentId: id, childType: 'artifact' }),
  ]);

  return {
    ...project,
    _counts: {
      tasks: tasks.length,
      wiki: wiki.length,
      artifacts: artifacts.length,
    },
  };
});
```

**Expected Impact:**
- Reduce N+1 queries to single batch query
- 50-70% reduction in query count for list endpoints
- 30-50% faster response times for complex data

---

#### 1.3 Horizontal Scaling with Load Balancer

**Problem:** Single API server can't handle high traffic loads.

**Solution:** Stateless API architecture with load balancer

**Architecture:**

```yaml
# docker-compose.production.yml
version: '3.8'

services:
  # Nginx load balancer
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - api-1
      - api-2
      - api-3

  # API instances (3x for redundancy)
  api-1:
    build: ./apps/api
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres-primary
      - REDIS_HOST=redis
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 2G

  api-2:
    build: ./apps/api
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres-primary
      - REDIS_HOST=redis
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 2G

  api-3:
    build: ./apps/api
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres-primary
      - REDIS_HOST=redis
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 2G

  # PostgreSQL with read replicas
  postgres-primary:
    image: postgres:14
    environment:
      - POSTGRES_PASSWORD=app
      - POSTGRES_USER=app
      - POSTGRES_DB=app
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./postgresql.conf:/etc/postgresql/postgresql.conf
    command: postgres -c config_file=/etc/postgresql/postgresql.conf

  postgres-replica-1:
    image: postgres:14
    environment:
      - POSTGRES_PASSWORD=app
    volumes:
      - postgres-replica-1-data:/var/lib/postgresql/data
    command: |
      bash -c "
        until pg_basebackup -h postgres-primary -D /var/lib/postgresql/data -U replication -X stream
        do
          sleep 5
        done
        postgres
      "

  # Redis for session and cache
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data

volumes:
  postgres-data:
  postgres-replica-1-data:
  redis-data:
```

**Nginx Configuration:**

```nginx
# nginx.conf
upstream api_backend {
    least_conn;  # Use least connections load balancing
    server api-1:4000 max_fails=3 fail_timeout=30s;
    server api-2:4000 max_fails=3 fail_timeout=30s;
    server api-3:4000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name api.pmo.huronhome.ca;

    location /api {
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Connection pooling
        proxy_http_version 1.1;
        proxy_set_header Connection "";

        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://api_backend/api/health;
    }
}
```

**Session Management (Stateless JWT):**

```typescript
// apps/api/src/lib/jwt.ts
import { FastifyInstance } from 'fastify';

// Store refresh tokens in Redis (not in-memory)
export async function createTokenPair(userId: string, fastify: FastifyInstance) {
  const accessToken = fastify.jwt.sign(
    { sub: userId, type: 'access' },
    { expiresIn: '15m' }  // Short-lived access token
  );

  const refreshToken = fastify.jwt.sign(
    { sub: userId, type: 'refresh' },
    { expiresIn: '7d' }  // Long-lived refresh token
  );

  // Store refresh token in Redis with user ID
  await redis.setex(`refresh:${userId}`, 7 * 24 * 60 * 60, refreshToken);

  return { accessToken, refreshToken };
}

// Refresh endpoint
fastify.post('/api/v1/auth/refresh', async (request, reply) => {
  const { refreshToken } = request.body;

  try {
    const decoded = fastify.jwt.verify(refreshToken);
    if (decoded.type !== 'refresh') {
      return reply.status(401).send({ error: 'Invalid token type' });
    }

    // Verify token exists in Redis
    const storedToken = await redis.get(`refresh:${decoded.sub}`);
    if (storedToken !== refreshToken) {
      return reply.status(401).send({ error: 'Token revoked or expired' });
    }

    // Issue new token pair
    const tokens = await createTokenPair(decoded.sub, fastify);
    return tokens;
  } catch (error) {
    return reply.status(401).send({ error: 'Invalid refresh token' });
  }
});
```

**Expected Impact:**
- 3x capacity with 3 API instances
- Zero downtime deployments (rolling updates)
- Automatic failover if one instance crashes
- 99.9% uptime SLA

---

#### 1.4 Database Read Replicas for Scalability

**Problem:** All database queries hit primary database, limiting read throughput.

**Solution:** PostgreSQL streaming replication with read replicas

**PostgreSQL Primary Configuration:**

```conf
# postgresql.primary.conf
wal_level = replica
max_wal_senders = 10
max_replication_slots = 10
synchronous_commit = off  # Async replication for performance
```

**Database Connection Pool with Read/Write Splitting:**

```typescript
// apps/api/src/db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// Write pool (primary)
const writePrimary = new Pool({
  host: process.env.DB_PRIMARY_HOST || 'postgres-primary',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'app',
  user: process.env.DB_USER || 'app',
  password: process.env.DB_PASSWORD || 'app',
  max: 20,
});

// Read pool (replicas with round-robin)
const readReplicas = [
  new Pool({
    host: process.env.DB_REPLICA1_HOST || 'postgres-replica-1',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'app',
    user: process.env.DB_USER || 'app',
    password: process.env.DB_PASSWORD || 'app',
    max: 30,  // More connections for reads
  }),
  new Pool({
    host: process.env.DB_REPLICA2_HOST || 'postgres-replica-2',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'app',
    user: process.env.DB_USER || 'app',
    password: process.env.DB_PASSWORD || 'app',
    max: 30,
  }),
];

let replicaIndex = 0;

export const dbWrite = drizzle(writePrimary);

export function getReadDB() {
  // Round-robin replica selection
  const replica = readReplicas[replicaIndex];
  replicaIndex = (replicaIndex + 1) % readReplicas.length;
  return drizzle(replica);
}

// Helper function for read/write routing
export function getDB(operation: 'read' | 'write' = 'read') {
  return operation === 'write' ? dbWrite : getReadDB();
}
```

**Usage in Routes:**

```typescript
// apps/api/src/modules/project/routes.ts
// READ operations - use replica
fastify.get('/api/v1/project', async (request, reply) => {
  const db = getDB('read');  // Route to read replica

  const projects = await db.execute(sql`
    SELECT * FROM app.d_project WHERE active_flag = TRUE
  `);

  return { data: projects };
});

// WRITE operations - use primary
fastify.post('/api/v1/project', async (request, reply) => {
  const db = getDB('write');  // Route to primary

  const result = await db.execute(sql`
    INSERT INTO app.d_project (code, name, ...) VALUES (...)
  `);

  // Invalidate read cache
  await cache.invalidate('entity:project:*');

  return { data: result };
});
```

**Expected Impact:**
- 2-3x read throughput with 2 replicas
- Reduced load on primary database
- Better query performance during peak hours
- Improved database availability

---

#### 1.5 Background Job Queue for Async Operations

**Problem:** Long-running operations (report generation, bulk operations, email sending) block API request threads.

**Solution:** BullMQ + Redis job queue

**Implementation:**

```typescript
// apps/api/src/lib/queue.ts
import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
});

// Job queues by priority
export const queues = {
  critical: new Queue('critical', { connection }),  // User-facing operations
  high: new Queue('high', { connection }),          // Reports, exports
  normal: new Queue('normal', { connection }),      // Notifications
  low: new Queue('low', { connection }),            // Cleanup, analytics
};

// Job types
export enum JobType {
  SEND_EMAIL = 'send_email',
  GENERATE_REPORT = 'generate_report',
  BULK_UPDATE = 'bulk_update',
  EXPORT_DATA = 'export_data',
  CLEANUP_OLD_DATA = 'cleanup_old_data',
  CALCULATE_ANALYTICS = 'calculate_analytics',
}

// Add job helper
export async function addJob(
  type: JobType,
  data: any,
  options: { priority?: 'critical' | 'high' | 'normal' | 'low' } = {}
) {
  const queue = queues[options.priority || 'normal'];

  return queue.add(type, data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  });
}
```

**Job Workers:**

```typescript
// apps/api/src/workers/report-worker.ts
import { Worker } from 'bullmq';
import { JobType } from '@/lib/queue.js';

const reportWorker = new Worker(
  'high',
  async (job) => {
    if (job.name === JobType.GENERATE_REPORT) {
      const { reportId, userId } = job.data;

      // Update job progress
      await job.updateProgress(10);

      // Generate report (long-running operation)
      const report = await generateReport(reportId);
      await job.updateProgress(50);

      // Store in S3/MinIO
      const fileUrl = await uploadToStorage(report);
      await job.updateProgress(80);

      // Notify user
      await sendEmail(userId, {
        subject: 'Report Ready',
        body: `Your report is ready: ${fileUrl}`,
      });
      await job.updateProgress(100);

      return { fileUrl, status: 'completed' };
    }
  },
  {
    connection,
    concurrency: 5,  // Process 5 jobs concurrently
  }
);

reportWorker.on('completed', (job) => {
  console.log(`Report job ${job.id} completed`);
});

reportWorker.on('failed', (job, err) => {
  console.error(`Report job ${job.id} failed:`, err);
  // Send failure notification
});
```

**API Integration:**

```typescript
// apps/api/src/modules/reports/routes.ts
fastify.post('/api/v1/reports/:id/generate', async (request, reply) => {
  const { id: reportId } = request.params;
  const userId = request.user?.sub;

  // Add job to queue (non-blocking)
  const job = await addJob(
    JobType.GENERATE_REPORT,
    { reportId, userId },
    { priority: 'high' }
  );

  return {
    message: 'Report generation started',
    jobId: job.id,
    status: 'queued',
  };
});

// Check job status
fastify.get('/api/v1/jobs/:jobId', async (request, reply) => {
  const { jobId } = request.params;
  const job = await queues.high.getJob(jobId);

  if (!job) {
    return reply.status(404).send({ error: 'Job not found' });
  }

  const state = await job.getState();
  const progress = job.progress;

  return {
    id: job.id,
    state,
    progress,
    data: job.data,
    result: await job.returnvalue,
  };
});
```

**Expected Impact:**
- Non-blocking long operations
- Automatic retry on failure
- Job progress tracking
- Better user experience (no timeouts)
- 5-10x more concurrent operations

---

## 2. Security Assessment

### Current Rating: **6.5/10**

### Strengths ✅

1. **Comprehensive RBAC** - Array-based permissions with fine-grained control
2. **JWT Authentication** - Industry-standard token-based auth
3. **Password Hashing** - bcrypt with proper salting
4. **Security Headers** - Helmet.js configured
5. **Rate Limiting** - 100 requests/minute per IP
6. **SQL Injection Protection** - Drizzle ORM parameterized queries

### Weaknesses ⚠️

1. **No Multi-Factor Authentication (MFA)**
2. **No Audit Logging** - No security event tracking
3. **No Encryption at Rest** - Database and files unencrypted
4. **No Secrets Management** - Credentials in .env files
5. **No API Key Management** - No alternative auth method
6. **Rate Limiting Per IP Only** - No per-user limits
7. **No CSRF Protection** - Vulnerable to cross-site attacks
8. **No Input Sanitization Layer** - Relies on TypeBox only
9. **No Security Scanning** - No automated vulnerability checks
10. **Weak Password Policy** - No complexity requirements

---

### Next-Generation Suggestions

#### 2.1 Multi-Factor Authentication (MFA) with TOTP

**Problem:** Username/password can be compromised. No second factor protection.

**Solution:** Implement Time-based One-Time Password (TOTP) using authenticator apps

**Implementation:**

```typescript
// apps/api/src/modules/auth/mfa.ts
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export class MFAService {
  // Generate MFA secret for user
  async setupMFA(userId: string, email: string) {
    const secret = speakeasy.generateSecret({
      name: `PMO Platform (${email})`,
      issuer: 'Huron Home Services',
    });

    // Store secret in database (encrypted)
    await db.execute(sql`
      UPDATE app.d_employee
      SET mfa_secret = ${await encrypt(secret.base32)},
          mfa_enabled = FALSE
      WHERE id = ${userId}
    `);

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

    return {
      secret: secret.base32,
      qrCode,
      backupCodes: await this.generateBackupCodes(userId),
    };
  }

  // Verify TOTP token
  async verifyToken(userId: string, token: string): Promise<boolean> {
    const user = await db.execute(sql`
      SELECT mfa_secret FROM app.d_employee WHERE id = ${userId}
    `);

    if (!user[0]?.mfa_secret) {
      return false;
    }

    const secret = await decrypt(user[0].mfa_secret);

    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1,  // Allow 30 second time drift
    });
  }

  // Generate backup codes (for account recovery)
  async generateBackupCodes(userId: string): Promise<string[]> {
    const codes = Array.from({ length: 10 }, () =>
      Math.random().toString(36).substring(2, 10).toUpperCase()
    );

    // Store hashed backup codes
    const hashedCodes = await Promise.all(
      codes.map(code => bcrypt.hash(code, 10))
    );

    await db.execute(sql`
      UPDATE app.d_employee
      SET mfa_backup_codes = ${JSON.stringify(hashedCodes)}
      WHERE id = ${userId}
    `);

    return codes;
  }

  // Verify backup code
  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const user = await db.execute(sql`
      SELECT mfa_backup_codes FROM app.d_employee WHERE id = ${userId}
    `);

    const backupCodes = JSON.parse(user[0]?.mfa_backup_codes || '[]');

    for (let i = 0; i < backupCodes.length; i++) {
      if (await bcrypt.compare(code, backupCodes[i])) {
        // Remove used backup code
        backupCodes.splice(i, 1);
        await db.execute(sql`
          UPDATE app.d_employee
          SET mfa_backup_codes = ${JSON.stringify(backupCodes)}
          WHERE id = ${userId}
        `);
        return true;
      }
    }

    return false;
  }
}
```

**Login Flow with MFA:**

```typescript
// apps/api/src/modules/auth/routes.ts
fastify.post('/api/v1/auth/login', async (request, reply) => {
  const { email, password, mfaToken } = request.body;

  // Step 1: Verify username/password
  const user = await db.execute(sql`
    SELECT id, password_hash, mfa_enabled FROM app.d_employee
    WHERE email = ${email} AND active_flag = TRUE
  `);

  if (!user[0] || !(await bcrypt.compare(password, user[0].password_hash))) {
    return reply.status(401).send({ error: 'Invalid credentials' });
  }

  // Step 2: Check if MFA is enabled
  if (user[0].mfa_enabled) {
    if (!mfaToken) {
      return reply.status(200).send({
        mfaRequired: true,
        message: 'MFA token required',
      });
    }

    // Verify MFA token
    const mfaService = new MFAService();
    const isValid = await mfaService.verifyToken(user[0].id, mfaToken);

    if (!isValid) {
      // Try backup code
      const isBackupValid = await mfaService.verifyBackupCode(user[0].id, mfaToken);
      if (!isBackupValid) {
        return reply.status(401).send({ error: 'Invalid MFA token' });
      }
    }
  }

  // Step 3: Generate JWT
  const token = fastify.jwt.sign({ sub: user[0].id });

  return {
    token,
    user: { id: user[0].id, email },
  };
});

// Setup MFA endpoint
fastify.post('/api/v1/auth/mfa/setup', {
  preHandler: [fastify.authenticate],
}, async (request, reply) => {
  const userId = request.user?.sub;
  const user = await getCurrentUser(userId);

  const mfaService = new MFAService();
  const setup = await mfaService.setupMFA(userId, user.email);

  return setup;
});

// Enable MFA endpoint (verify first token)
fastify.post('/api/v1/auth/mfa/enable', {
  preHandler: [fastify.authenticate],
}, async (request, reply) => {
  const userId = request.user?.sub;
  const { token } = request.body;

  const mfaService = new MFAService();
  const isValid = await mfaService.verifyToken(userId, token);

  if (!isValid) {
    return reply.status(401).send({ error: 'Invalid token' });
  }

  // Enable MFA
  await db.execute(sql`
    UPDATE app.d_employee
    SET mfa_enabled = TRUE
    WHERE id = ${userId}
  `);

  return { message: 'MFA enabled successfully' };
});
```

**Expected Impact:**
- 99% reduction in account takeover attacks
- Compliance with SOC 2, ISO 27001 requirements
- Enhanced trust from enterprise customers

---

#### 2.2 Comprehensive Audit Logging

**Problem:** No visibility into security events, user actions, or compliance tracking.

**Solution:** Centralized audit logging system

**Implementation:**

```typescript
// apps/api/src/lib/audit-logger.ts
export enum AuditEventType {
  // Authentication
  LOGIN_SUCCESS = 'auth.login.success',
  LOGIN_FAILURE = 'auth.login.failure',
  LOGOUT = 'auth.logout',
  MFA_ENABLED = 'auth.mfa.enabled',
  MFA_DISABLED = 'auth.mfa.disabled',
  PASSWORD_CHANGED = 'auth.password.changed',

  // Authorization
  PERMISSION_GRANTED = 'authz.permission.granted',
  PERMISSION_REVOKED = 'authz.permission.revoked',
  ACCESS_DENIED = 'authz.access.denied',

  // Data Operations
  ENTITY_CREATED = 'data.entity.created',
  ENTITY_UPDATED = 'data.entity.updated',
  ENTITY_DELETED = 'data.entity.deleted',
  ENTITY_VIEWED = 'data.entity.viewed',

  // Sensitive Operations
  BULK_DELETE = 'data.bulk.delete',
  BULK_UPDATE = 'data.bulk.update',
  EXPORT_DATA = 'data.export',

  // Admin Operations
  USER_CREATED = 'admin.user.created',
  USER_DELETED = 'admin.user.deleted',
  ROLE_CHANGED = 'admin.role.changed',
  SETTINGS_CHANGED = 'admin.settings.changed',
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  userId: string | null;
  userEmail: string | null;
  ipAddress: string;
  userAgent: string;
  resource: string;  // 'project', 'task', 'employee'
  resourceId: string | null;
  action: string;  // 'create', 'read', 'update', 'delete'
  success: boolean;
  metadata: Record<string, any>;
  changes?: {
    before: any;
    after: any;
  };
}

export class AuditLogger {
  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) {
    const fullEntry: AuditLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...entry,
    };

    // Store in dedicated audit log table
    await db.execute(sql`
      INSERT INTO app.audit_log (
        id, timestamp, event_type, user_id, user_email,
        ip_address, user_agent, resource, resource_id,
        action, success, metadata, changes
      ) VALUES (
        ${fullEntry.id},
        ${fullEntry.timestamp},
        ${fullEntry.eventType},
        ${fullEntry.userId},
        ${fullEntry.userEmail},
        ${fullEntry.ipAddress},
        ${fullEntry.userAgent},
        ${fullEntry.resource},
        ${fullEntry.resourceId},
        ${fullEntry.action},
        ${fullEntry.success},
        ${JSON.stringify(fullEntry.metadata)},
        ${JSON.stringify(fullEntry.changes)}
      )
    `);

    // Also log to external SIEM (Splunk, Datadog, etc.)
    if (process.env.SIEM_ENABLED === 'true') {
      await this.sendToSIEM(fullEntry);
    }

    // Alert on critical events
    if (this.isCriticalEvent(entry.eventType)) {
      await this.sendAlert(fullEntry);
    }
  }

  private isCriticalEvent(eventType: AuditEventType): boolean {
    return [
      AuditEventType.LOGIN_FAILURE,
      AuditEventType.ACCESS_DENIED,
      AuditEventType.BULK_DELETE,
      AuditEventType.USER_DELETED,
      AuditEventType.PERMISSION_GRANTED,
    ].includes(eventType);
  }

  private async sendToSIEM(entry: AuditLogEntry) {
    // Send to external SIEM system
    // Example: Datadog, Splunk, etc.
  }

  private async sendAlert(entry: AuditLogEntry) {
    // Send to Slack, PagerDuty, etc.
  }
}

export const auditLogger = new AuditLogger();
```

**Audit Middleware:**

```typescript
// apps/api/src/middleware/audit.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { auditLogger, AuditEventType } from '@/lib/audit-logger.js';

export async function auditMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const startTime = Date.now();

  // Extract metadata
  const userId = request.user?.sub || null;
  const userEmail = request.user?.email || null;
  const ipAddress = request.ip;
  const userAgent = request.headers['user-agent'] || 'unknown';

  // Capture response
  reply.addHook('onSend', async (request, reply, payload) => {
    const duration = Date.now() - startTime;
    const success = reply.statusCode < 400;

    // Determine event type and resource from route
    const { method, url } = request;
    const [, , , resource, resourceId, action] = url.split('/');

    let eventType: AuditEventType;
    if (method === 'POST') eventType = AuditEventType.ENTITY_CREATED;
    else if (method === 'PUT' || method === 'PATCH') eventType = AuditEventType.ENTITY_UPDATED;
    else if (method === 'DELETE') eventType = AuditEventType.ENTITY_DELETED;
    else if (method === 'GET') eventType = AuditEventType.ENTITY_VIEWED;

    await auditLogger.log({
      eventType,
      userId,
      userEmail,
      ipAddress,
      userAgent,
      resource: resource || 'unknown',
      resourceId: resourceId || null,
      action: method.toLowerCase(),
      success,
      metadata: {
        method,
        url,
        statusCode: reply.statusCode,
        duration,
        queryParams: request.query,
      },
    });

    return payload;
  });
}
```

**Audit Log Table:**

```sql
-- db/audit_log.ddl
CREATE TABLE app.audit_log (
  id UUID PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type VARCHAR(100) NOT NULL,
  user_id UUID,
  user_email VARCHAR(255),
  ip_address INET NOT NULL,
  user_agent TEXT,
  resource VARCHAR(50),
  resource_id TEXT,
  action VARCHAR(20),
  success BOOLEAN NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  changes JSONB DEFAULT NULL,

  -- Indexes for common queries
  INDEX idx_audit_timestamp (timestamp DESC),
  INDEX idx_audit_user (user_id, timestamp DESC),
  INDEX idx_audit_resource (resource, resource_id, timestamp DESC),
  INDEX idx_audit_event_type (event_type, timestamp DESC)
);

-- Partition by month for performance
CREATE TABLE app.audit_log_2025_10 PARTITION OF app.audit_log
FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
```

**Expected Impact:**
- Full visibility into security events
- Compliance with SOC 2, HIPAA, GDPR requirements
- Forensic analysis capabilities
- Anomaly detection (unusual access patterns)

---

#### 2.3 Encryption at Rest

**Problem:** Database and files stored in plaintext. Data breach would expose all sensitive information.

**Solution:** Database-level encryption + application-level field encryption

**Database Encryption (PostgreSQL):**

```bash
# Enable transparent data encryption (TDE) in PostgreSQL
# postgresql.conf
ssl = on
ssl_cert_file = '/etc/ssl/certs/postgresql.crt'
ssl_key_file = '/etc/ssl/private/postgresql.key'

# Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

**Field-Level Encryption:**

```typescript
// apps/api/src/lib/encryption.ts
import crypto from 'crypto';

export class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private key: Buffer;

  constructor() {
    // Use KMS (AWS KMS, HashiCorp Vault, etc.)
    const keyBase64 = process.env.ENCRYPTION_KEY;
    if (!keyBase64) {
      throw new Error('ENCRYPTION_KEY not set');
    }
    this.key = Buffer.from(keyBase64, 'base64');
  }

  // Encrypt sensitive field
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:ciphertext
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  }

  // Decrypt sensitive field
  decrypt(ciphertext: string): string {
    const [ivBase64, authTagBase64, encrypted] = ciphertext.split(':');

    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

export const encryption = new EncryptionService();
```

**Encrypt Sensitive Fields:**

```typescript
// apps/api/src/modules/employee/routes.ts
import { encryption } from '@/lib/encryption.js';

// Create employee with encrypted SSN, salary
fastify.post('/api/v1/employee', async (request, reply) => {
  const { email, password, ssn, salary, ...rest } = request.body;

  const employee = await db.execute(sql`
    INSERT INTO app.d_employee (
      email,
      password_hash,
      ssn_encrypted,
      salary_encrypted,
      ...
    ) VALUES (
      ${email},
      ${await bcrypt.hash(password, 10)},
      ${encryption.encrypt(ssn)},
      ${encryption.encrypt(salary.toString())},
      ...
    )
    RETURNING id
  `);

  return { id: employee[0].id };
});

// Decrypt when retrieving
fastify.get('/api/v1/employee/:id', async (request, reply) => {
  const { id } = request.params;
  const userId = request.user?.sub;

  // Check permission to view sensitive data
  const canViewSensitive = await checkPermission(userId, 'employee:view:sensitive');

  const employee = await db.execute(sql`
    SELECT * FROM app.d_employee WHERE id = ${id}
  `);

  const result = {
    ...employee[0],
    ssn: canViewSensitive ? encryption.decrypt(employee[0].ssn_encrypted) : '***-**-****',
    salary: canViewSensitive ? encryption.decrypt(employee[0].salary_encrypted) : null,
  };

  delete result.ssn_encrypted;
  delete result.salary_encrypted;

  return result;
});
```

**Key Management with HashiCorp Vault:**

```typescript
// apps/api/src/lib/vault.ts
import vault from 'node-vault';

const vaultClient = vault({
  endpoint: process.env.VAULT_ADDR || 'http://localhost:8200',
  token: process.env.VAULT_TOKEN,
});

export class VaultService {
  async getEncryptionKey(): Promise<string> {
    const result = await vaultClient.read('secret/data/pmo/encryption-key');
    return result.data.data.key;
  }

  async rotateKey(): Promise<void> {
    const newKey = crypto.randomBytes(32).toString('base64');
    await vaultClient.write('secret/data/pmo/encryption-key', {
      data: { key: newKey },
    });
  }
}
```

**Expected Impact:**
- Protection against data breaches
- Compliance with GDPR, HIPAA, PCI-DSS
- Enterprise-grade security posture

---

#### 2.4 Advanced Rate Limiting

**Problem:** Current rate limiting is per-IP only, vulnerable to distributed attacks and doesn't prevent per-user abuse.

**Solution:** Multi-layer rate limiting (IP + User + Endpoint)

**Implementation:**

```typescript
// apps/api/src/lib/rate-limiter.ts
import { FastifyInstance, FastifyRequest } from 'fastify';
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
});

export class AdvancedRateLimiter {
  // Multi-layer rate limiting
  async checkRateLimit(request: FastifyRequest): Promise<{ allowed: boolean; retryAfter?: number }> {
    const ip = request.ip;
    const userId = request.user?.sub;
    const endpoint = request.url;

    // Layer 1: IP-based (100 req/min)
    const ipAllowed = await this.checkLimit(`ip:${ip}`, 100, 60);
    if (!ipAllowed.allowed) {
      return ipAllowed;
    }

    // Layer 2: User-based (1000 req/hour)
    if (userId) {
      const userAllowed = await this.checkLimit(`user:${userId}`, 1000, 3600);
      if (!userAllowed.allowed) {
        return userAllowed;
      }
    }

    // Layer 3: Endpoint-based (different limits per endpoint)
    const endpointLimits = {
      '/api/v1/auth/login': { max: 5, window: 300 },  // 5 login attempts per 5 minutes
      '/api/v1/export': { max: 10, window: 3600 },     // 10 exports per hour
      'default': { max: 100, window: 60 },
    };

    const limit = endpointLimits[endpoint] || endpointLimits.default;
    const endpointAllowed = await this.checkLimit(
      `endpoint:${userId || ip}:${endpoint}`,
      limit.max,
      limit.window
    );

    return endpointAllowed;
  }

  private async checkLimit(
    key: string,
    max: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; retryAfter?: number }> {
    const now = Date.now();
    const windowKey = `ratelimit:${key}`;

    // Sliding window algorithm using sorted set
    await redis
      .multi()
      .zadd(windowKey, now, `${now}:${Math.random()}`)
      .zremrangebyscore(windowKey, 0, now - windowSeconds * 1000)
      .expire(windowKey, windowSeconds)
      .zcard(windowKey)
      .exec();

    const count = await redis.zcard(windowKey);

    if (count > max) {
      // Calculate retry-after
      const oldestEntry = await redis.zrange(windowKey, 0, 0, 'WITHSCORES');
      const oldestTimestamp = parseInt(oldestEntry[1]);
      const retryAfter = Math.ceil((oldestTimestamp + windowSeconds * 1000 - now) / 1000);

      return { allowed: false, retryAfter };
    }

    return { allowed: true };
  }

  // Burst protection (too many requests in short time)
  async checkBurst(userId: string, maxBurst: number = 10, windowSeconds: number = 1): Promise<boolean> {
    const key = `burst:${userId}`;
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }

    return count <= maxBurst;
  }
}

export const rateLimiter = new AdvancedRateLimiter();
```

**Middleware:**

```typescript
// apps/api/src/middleware/rate-limit.ts
import { rateLimiter } from '@/lib/rate-limiter.js';

export async function rateLimitMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const result = await rateLimiter.checkRateLimit(request);

  if (!result.allowed) {
    reply.header('Retry-After', result.retryAfter || 60);
    return reply.status(429).send({
      error: 'Too Many Requests',
      retryAfter: result.retryAfter,
    });
  }

  // Burst protection
  const userId = request.user?.sub;
  if (userId) {
    const burstAllowed = await rateLimiter.checkBurst(userId);
    if (!burstAllowed) {
      return reply.status(429).send({
        error: 'Too many requests in short time',
      });
    }
  }
}
```

**Dynamic Rate Limiting (Based on User Tier):**

```typescript
export class DynamicRateLimiter {
  async getRateLimitForUser(userId: string): Promise<{ max: number; window: number }> {
    const user = await db.execute(sql`
      SELECT customer_tier_id FROM app.d_employee WHERE id = ${userId}
    `);

    // Different limits for different tiers
    const tierLimits = {
      'free': { max: 100, window: 3600 },      // 100 req/hour
      'pro': { max: 1000, window: 3600 },      // 1000 req/hour
      'enterprise': { max: 10000, window: 3600 }, // 10000 req/hour
    };

    const tier = user[0]?.customer_tier_id || 'free';
    return tierLimits[tier];
  }
}
```

**Expected Impact:**
- Protection against DDoS attacks
- Prevention of brute force attacks
- Fair usage across users
- Tier-based rate limiting for monetization

---

#### 2.5 CSRF Protection & Input Sanitization

**Problem:** No CSRF protection, vulnerable to cross-site request forgery attacks.

**Solution:** CSRF tokens + input sanitization middleware

**Implementation:**

```typescript
// apps/api/src/lib/csrf.ts
import crypto from 'crypto';
import { FastifyRequest } from 'fastify';

export class CSRFService {
  // Generate CSRF token
  generateToken(sessionId: string): string {
    const secret = process.env.CSRF_SECRET || 'default-secret';
    const hash = crypto
      .createHmac('sha256', secret)
      .update(sessionId)
      .digest('hex');

    return `${sessionId}.${hash}`;
  }

  // Verify CSRF token
  verifyToken(token: string, sessionId: string): boolean {
    const [tokenSessionId, hash] = token.split('.');

    if (tokenSessionId !== sessionId) {
      return false;
    }

    const expectedToken = this.generateToken(sessionId);
    return token === expectedToken;
  }
}

export const csrf = new CSRFService();

// CSRF Middleware
export async function csrfMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const method = request.method;

  // Only check CSRF for state-changing operations
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = request.headers['x-csrf-token'];
    const sessionId = request.user?.sub;

    if (!csrfToken || !sessionId) {
      return reply.status(403).send({ error: 'CSRF token missing' });
    }

    if (!csrf.verifyToken(csrfToken as string, sessionId)) {
      return reply.status(403).send({ error: 'Invalid CSRF token' });
    }
  }
}
```

**Input Sanitization:**

```typescript
// apps/api/src/middleware/sanitize.ts
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Strip HTML tags and sanitize
    return validator.escape(DOMPurify.sanitize(input));
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }

  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }

  return input;
}

export async function sanitizeMiddleware(request: FastifyRequest, reply: FastifyReply) {
  if (request.body) {
    request.body = sanitizeInput(request.body);
  }

  if (request.query) {
    request.query = sanitizeInput(request.query);
  }
}
```

**Expected Impact:**
- Protection against CSRF attacks
- Prevention of XSS attacks
- Cleaner, safer data in database

---

## 3. Modern Design Patterns Assessment

### Current Rating: **7.5/10**

### Strengths ✅

1. **Universal Entity Pattern** - Innovative 94% code reduction
2. **Configuration-Driven Architecture** - Single source of truth
3. **Type-Safe API Factory** - Eliminates unsafe dynamic calls
4. **Metadata-Driven UI** - Database-driven entity relationships
5. **Settings-Driven Dropdowns** - Dynamic configuration
6. **No Foreign Keys Architecture** - Maximum flexibility

### Weaknesses ⚠️

1. **Monolithic API** - Single codebase for all services
2. **No Event-Driven Architecture** - Tightly coupled components
3. **No CQRS Pattern** - Reads and writes use same models
4. **No Domain-Driven Design** - Business logic in route handlers
5. **No GraphQL Option** - Only REST API
6. **No Real-Time Features** - No WebSockets
7. **No API Versioning** - Breaking changes affect all clients
8. **No Feature Flags** - Can't toggle features per user

---

### Next-Generation Suggestions

#### 3.1 Event-Driven Architecture with Event Sourcing

**Problem:** Tightly coupled components. Changes to one entity require manual updates to related entities.

**Solution:** Event-driven architecture with event bus

**Implementation:**

```typescript
// apps/api/src/lib/event-bus.ts
import { EventEmitter } from 'events';
import { Queue } from 'bullmq';

export enum DomainEvent {
  // Project events
  PROJECT_CREATED = 'project.created',
  PROJECT_UPDATED = 'project.updated',
  PROJECT_DELETED = 'project.deleted',

  // Task events
  TASK_CREATED = 'task.created',
  TASK_ASSIGNED = 'task.assigned',
  TASK_COMPLETED = 'task.completed',

  // RBAC events
  PERMISSION_GRANTED = 'rbac.permission.granted',
  PERMISSION_REVOKED = 'rbac.permission.revoked',
}

export interface Event {
  id: string;
  type: DomainEvent;
  timestamp: Date;
  userId: string;
  aggregateId: string;
  aggregateType: string;
  payload: any;
  metadata: any;
}

class EventBus extends EventEmitter {
  private eventQueue: Queue;

  constructor() {
    super();
    this.eventQueue = new Queue('events', { connection: redis });
  }

  // Publish event (async, non-blocking)
  async publish(event: Omit<Event, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: Event = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...event,
    };

    // Store event in event store (event sourcing)
    await this.storeEvent(fullEvent);

    // Emit to local listeners
    this.emit(event.type, fullEvent);

    // Queue for async processing
    await this.eventQueue.add(event.type, fullEvent);
  }

  // Subscribe to event
  subscribe(eventType: DomainEvent, handler: (event: Event) => Promise<void>): void {
    this.on(eventType, async (event) => {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Error handling event ${eventType}:`, error);
        // Retry logic, dead letter queue, etc.
      }
    });
  }

  // Store event in event store
  private async storeEvent(event: Event): Promise<void> {
    await db.execute(sql`
      INSERT INTO app.event_store (
        id, type, timestamp, user_id, aggregate_id, aggregate_type, payload, metadata
      ) VALUES (
        ${event.id},
        ${event.type},
        ${event.timestamp},
        ${event.userId},
        ${event.aggregateId},
        ${event.aggregateType},
        ${JSON.stringify(event.payload)},
        ${JSON.stringify(event.metadata)}
      )
    `);
  }
}

export const eventBus = new EventBus();
```

**Event Handlers:**

```typescript
// apps/api/src/events/handlers/project-handlers.ts
import { eventBus, DomainEvent } from '@/lib/event-bus.js';

// When project is created, automatically create default wiki
eventBus.subscribe(DomainEvent.PROJECT_CREATED, async (event) => {
  const { projectId, projectName } = event.payload;

  // Create default wiki page
  await db.execute(sql`
    INSERT INTO app.d_wiki (project_id, title, content)
    VALUES (
      ${projectId},
      ${`${projectName} - Overview`},
      ${'# Welcome to ' + projectName + '\n\nThis is your project wiki.'}
    )
  `);

  // Create entity_id_map relationship
  await db.execute(sql`
    INSERT INTO app.d_entity_id_map (
      parent_entity_type, parent_entity_id,
      child_entity_type, child_entity_id
    ) VALUES ('project', ${projectId}, 'wiki', ${wikiId})
  `);
});

// When task is completed, update project progress
eventBus.subscribe(DomainEvent.TASK_COMPLETED, async (event) => {
  const { taskId, projectId } = event.payload;

  // Calculate project progress
  const progress = await db.execute(sql`
    SELECT
      COUNT(CASE WHEN stage = 'done' THEN 1 END)::float / COUNT(*)::float * 100 as progress
    FROM app.d_task
    WHERE project_id = ${projectId}
  `);

  // Update project
  await db.execute(sql`
    UPDATE app.d_project
    SET progress_percentage = ${progress[0].progress}
    WHERE id = ${projectId}
  `);

  // Emit project updated event
  await eventBus.publish({
    type: DomainEvent.PROJECT_UPDATED,
    userId: event.userId,
    aggregateId: projectId,
    aggregateType: 'project',
    payload: { progress: progress[0].progress },
    metadata: { triggeredBy: 'task_completed' },
  });
});

// Send notifications when task is assigned
eventBus.subscribe(DomainEvent.TASK_ASSIGNED, async (event) => {
  const { taskId, assigneeIds, assignedBy } = event.payload;

  // Send email notifications (async, non-blocking)
  for (const assigneeId of assigneeIds) {
    await addJob(JobType.SEND_EMAIL, {
      to: assigneeId,
      subject: 'New task assigned',
      template: 'task-assigned',
      data: { taskId, assignedBy },
    });
  }
});
```

**Publishing Events in API Routes:**

```typescript
// apps/api/src/modules/project/routes.ts
fastify.post('/api/v1/project', async (request, reply) => {
  const userId = request.user?.sub;
  const { name, code, ...rest } = request.body;

  // Create project
  const result = await db.execute(sql`
    INSERT INTO app.d_project (code, name, ...) VALUES (${code}, ${name}, ...)
    RETURNING id
  `);

  const projectId = result[0].id;

  // Publish event (async, non-blocking)
  await eventBus.publish({
    type: DomainEvent.PROJECT_CREATED,
    userId,
    aggregateId: projectId,
    aggregateType: 'project',
    payload: { projectId, projectName: name, code },
    metadata: { source: 'api', route: '/api/v1/project' },
  });

  return { id: projectId };
});
```

**Event Store Table:**

```sql
-- db/event_store.ddl
CREATE TABLE app.event_store (
  id UUID PRIMARY KEY,
  type VARCHAR(100) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  user_id UUID,
  aggregate_id UUID NOT NULL,
  aggregate_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  metadata JSONB,

  INDEX idx_event_aggregate (aggregate_type, aggregate_id, timestamp DESC),
  INDEX idx_event_type (type, timestamp DESC),
  INDEX idx_event_user (user_id, timestamp DESC)
);

-- Partition by month
CREATE TABLE app.event_store_2025_10 PARTITION OF app.event_store
FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
```

**Expected Impact:**
- Decoupled components (loose coupling)
- Async, non-blocking operations
- Event sourcing for audit trail
- Easy to add new features without modifying existing code
- Rebuild state from events (time travel)

---

#### 3.2 CQRS (Command Query Responsibility Segregation)

**Problem:** Read and write operations use same models and database queries, limiting optimization.

**Solution:** Separate read and write models

**Implementation:**

```typescript
// apps/api/src/domain/commands/project-commands.ts
export class CreateProjectCommand {
  constructor(
    public readonly userId: string,
    public readonly code: string,
    public readonly name: string,
    public readonly description: string,
    public readonly businessId: string,
    public readonly managerId: string
  ) {}
}

export class ProjectCommandHandler {
  async handle(command: CreateProjectCommand): Promise<string> {
    // Business logic validation
    if (!command.code.startsWith('PRJ-')) {
      throw new Error('Project code must start with PRJ-');
    }

    // Check uniqueness
    const existing = await db.execute(sql`
      SELECT id FROM app.d_project WHERE code = ${command.code}
    `);

    if (existing.length > 0) {
      throw new Error('Project code already exists');
    }

    // Write to database
    const result = await db.execute(sql`
      INSERT INTO app.d_project (
        code, name, descr, business_id, manager_employee_id, created_by_user_id
      ) VALUES (
        ${command.code},
        ${command.name},
        ${command.description},
        ${command.businessId},
        ${command.managerId},
        ${command.userId}
      )
      RETURNING id
    `);

    const projectId = result[0].id;

    // Publish domain event
    await eventBus.publish({
      type: DomainEvent.PROJECT_CREATED,
      userId: command.userId,
      aggregateId: projectId,
      aggregateType: 'project',
      payload: { projectId, code: command.code, name: command.name },
      metadata: {},
    });

    // Invalidate read cache
    await cache.invalidate('projects:list:*');

    return projectId;
  }
}
```

**Query Side (Optimized Read Models):**

```typescript
// apps/api/src/domain/queries/project-queries.ts
export class GetProjectListQuery {
  constructor(
    public readonly userId: string,
    public readonly filters: {
      search?: string;
      projectStage?: number;
      businessId?: string;
    },
    public readonly page: number = 1,
    public readonly pageSize: number = 50
  ) {}
}

export class ProjectQueryHandler {
  async handle(query: GetProjectListQuery): Promise<ProjectListView[]> {
    // Check cache first
    const cacheKey = `projects:list:${JSON.stringify(query)}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Optimized read query with JOINs and enrichment
    const projects = await db.execute(sql`
      SELECT
        p.id,
        p.code,
        p.name,
        p.descr,
        p.project_stage,
        ps.level_name as project_stage_name,
        ps.color_code as project_stage_color,
        p.budget_allocated,
        p.budget_spent,
        p.progress_percentage,
        b.name as business_name,
        m.name as manager_name,
        -- Aggregated counts (denormalized for performance)
        COALESCE(task_counts.total, 0) as task_count,
        COALESCE(task_counts.completed, 0) as completed_task_count,
        COALESCE(wiki_counts.total, 0) as wiki_count
      FROM app.d_project p
      LEFT JOIN app.setting_datalabel_project_stage ps ON p.project_stage = ps.level_id
      LEFT JOIN app.d_business b ON p.business_id = b.id
      LEFT JOIN app.d_employee m ON p.manager_employee_id = m.id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN stage = 'done' THEN 1 END) as completed
        FROM app.d_task t
        WHERE t.project_id = p.id AND t.active_flag = TRUE
      ) task_counts ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as total
        FROM app.d_wiki w
        WHERE w.project_id = p.id AND w.active_flag = TRUE
      ) wiki_counts ON TRUE
      WHERE p.active_flag = TRUE
        AND EXISTS (
          SELECT 1 FROM app.d_entity_id_rbac_map rbac
          WHERE rbac.empid = ${query.userId}
            AND rbac.entity = 'project'
            AND (rbac.entity_id = p.id::TEXT OR rbac.entity_id = 'all')
            AND 0 = ANY(rbac.permission)
            AND rbac.active_flag = TRUE
        )
        ${query.filters.search ? sql`AND (p.name ILIKE ${'%' + query.filters.search + '%'} OR p.code ILIKE ${'%' + query.filters.search + '%'})` : sql``}
        ${query.filters.projectStage ? sql`AND p.project_stage = ${query.filters.projectStage}` : sql``}
        ${query.filters.businessId ? sql`AND p.business_id = ${query.filters.businessId}` : sql``}
      ORDER BY p.created_ts DESC
      LIMIT ${query.pageSize}
      OFFSET ${(query.page - 1) * query.pageSize}
    `);

    // Cache for 1 minute
    await cache.set(cacheKey, projects, 60);

    return projects;
  }
}
```

**Materialized Views for Complex Queries:**

```sql
-- Create materialized view for project dashboard
CREATE MATERIALIZED VIEW app.mv_project_dashboard AS
SELECT
  p.id,
  p.code,
  p.name,
  p.project_stage,
  p.budget_allocated,
  p.budget_spent,
  COUNT(DISTINCT t.id) as task_count,
  COUNT(DISTINCT CASE WHEN t.stage = 'done' THEN t.id END) as completed_task_count,
  COUNT(DISTINCT w.id) as wiki_count,
  COUNT(DISTINCT a.id) as artifact_count,
  COALESCE(SUM(t.actual_hours), 0) as total_hours_spent,
  MAX(t.updated_ts) as last_task_update
FROM app.d_project p
LEFT JOIN app.d_task t ON t.project_id = p.id AND t.active_flag = TRUE
LEFT JOIN app.d_wiki w ON w.project_id = p.id AND w.active_flag = TRUE
LEFT JOIN app.d_artifact a ON a.project_id = p.id AND a.active_flag = TRUE
WHERE p.active_flag = TRUE
GROUP BY p.id;

-- Create index
CREATE INDEX idx_mv_project_dashboard_id ON app.mv_project_dashboard(id);

-- Refresh materialized view (run every 5 minutes via cron)
REFRESH MATERIALIZED VIEW CONCURRENTLY app.mv_project_dashboard;
```

**API Routes:**

```typescript
// apps/api/src/modules/project/routes.ts
fastify.get('/api/v1/project', async (request, reply) => {
  const userId = request.user?.sub;
  const { search, projectStage, businessId, page, pageSize } = request.query;

  // Use CQRS query handler
  const queryHandler = new ProjectQueryHandler();
  const projects = await queryHandler.handle(
    new GetProjectListQuery(userId, { search, projectStage, businessId }, page, pageSize)
  );

  return { data: projects };
});

fastify.post('/api/v1/project', async (request, reply) => {
  const userId = request.user?.sub;
  const { code, name, description, businessId, managerId } = request.body;

  // Use CQRS command handler
  const commandHandler = new ProjectCommandHandler();
  const projectId = await commandHandler.handle(
    new CreateProjectCommand(userId, code, name, description, businessId, managerId)
  );

  return { id: projectId };
});
```

**Expected Impact:**
- 5-10x faster read queries (denormalized, cached)
- Optimized write path (no JOINs, minimal logic)
- Separate scaling (scale reads and writes independently)
- Better caching strategy

---

#### 3.3 API Versioning Strategy

**Problem:** No versioning. Breaking changes affect all clients.

**Solution:** URL-based API versioning with deprecation strategy

**Implementation:**

```typescript
// apps/api/src/versioning/version-manager.ts
export enum APIVersion {
  V1 = 'v1',
  V2 = 'v2',
  V3 = 'v3',
}

export const CURRENT_VERSION = APIVersion.V2;
export const DEPRECATED_VERSIONS = [APIVersion.V1];
export const SUNSET_DATES = {
  [APIVersion.V1]: new Date('2025-12-31'),
};

export class VersionManager {
  // Check if version is deprecated
  isDeprecated(version: APIVersion): boolean {
    return DEPRECATED_VERSIONS.includes(version);
  }

  // Get sunset date
  getSunsetDate(version: APIVersion): Date | null {
    return SUNSET_DATES[version] || null;
  }

  // Add deprecation headers
  addDeprecationHeaders(version: APIVersion, reply: FastifyReply): void {
    if (this.isDeprecated(version)) {
      const sunsetDate = this.getSunsetDate(version);
      reply.header('Deprecation', 'true');
      reply.header('Sunset', sunsetDate?.toISOString() || '');
      reply.header('Link', `</api/${CURRENT_VERSION}/docs>; rel="successor-version"`);
    }
  }
}

export const versionManager = new VersionManager();
```

**Versioned Routes:**

```typescript
// apps/api/src/modules/project/routes.v1.ts
export async function projectRoutesV1(fastify: FastifyInstance) {
  fastify.get('/api/v1/project', async (request, reply) => {
    // Add deprecation headers
    versionManager.addDeprecationHeaders(APIVersion.V1, reply);

    // V1 response format (simple)
    const projects = await db.execute(sql`
      SELECT id, code, name FROM app.d_project WHERE active_flag = TRUE
    `);

    return { projects };  // V1 format
  });
}

// apps/api/src/modules/project/routes.v2.ts
export async function projectRoutesV2(fastify: FastifyInstance) {
  fastify.get('/api/v2/project', async (request, reply) => {
    // V2 response format (enriched with metadata)
    const projects = await db.execute(sql`
      SELECT
        p.*,
        ps.level_name as project_stage_name,
        b.name as business_name,
        m.name as manager_name
      FROM app.d_project p
      LEFT JOIN app.setting_datalabel_project_stage ps ON p.project_stage = ps.level_id
      LEFT JOIN app.d_business b ON p.business_id = b.id
      LEFT JOIN app.d_employee m ON p.manager_employee_id = m.id
      WHERE p.active_flag = TRUE
    `);

    return {
      data: projects,  // V2 format (data wrapper)
      meta: {
        total: projects.length,
        version: 'v2',
      },
    };
  });
}
```

**Version Negotiation:**

```typescript
// apps/api/src/middleware/version.ts
export async function versionMiddleware(request: FastifyRequest, reply: FastifyReply) {
  // Extract version from URL (/api/v1/project or /api/v2/project)
  const version = request.url.match(/\/api\/(v\d+)\//)?[1] as APIVersion;

  if (!version) {
    return reply.status(400).send({ error: 'API version required in URL' });
  }

  // Check if version is supported
  if (!Object.values(APIVersion).includes(version)) {
    return reply.status(400).send({ error: 'Unsupported API version' });
  }

  // Add version to request context
  request.apiVersion = version;

  // Add deprecation headers
  versionManager.addDeprecationHeaders(version, reply);
}
```

**Expected Impact:**
- Backward compatibility maintained
- Smooth migration path for clients
- Clear deprecation timeline
- Ability to innovate without breaking existing integrations

---

#### 3.4 Feature Flags for Progressive Rollout

**Problem:** Can't toggle features per user, environment, or A/B test.

**Solution:** Feature flag system with LaunchDarkly-style capabilities

**Implementation:**

```typescript
// apps/api/src/lib/feature-flags.ts
export enum Feature {
  // New features
  NEW_DASHBOARD = 'new_dashboard',
  ADVANCED_ANALYTICS = 'advanced_analytics',
  AI_ASSISTANT = 'ai_assistant',
  REAL_TIME_COLLABORATION = 'real_time_collaboration',

  // Beta features
  GRAPHQL_API = 'graphql_api',
  MOBILE_APP = 'mobile_app',

  // Experimental
  AUTO_TASK_ASSIGNMENT = 'auto_task_assignment',
}

export interface FeatureFlagContext {
  userId: string;
  email: string;
  customerTier: string;
  environment: 'development' | 'staging' | 'production';
  version: string;
}

export class FeatureFlagService {
  // Check if feature is enabled for user
  async isEnabled(feature: Feature, context: FeatureFlagContext): Promise<boolean> {
    // Fetch flag configuration from database or cache
    const flagConfig = await this.getFlagConfig(feature);

    if (!flagConfig.enabled) {
      return false;
    }

    // Environment check
    if (!flagConfig.environments.includes(context.environment)) {
      return false;
    }

    // Percentage rollout
    if (flagConfig.rolloutPercentage < 100) {
      const userHash = this.hashString(context.userId);
      const bucket = userHash % 100;
      if (bucket >= flagConfig.rolloutPercentage) {
        return false;
      }
    }

    // User targeting
    if (flagConfig.targetedUserIds && flagConfig.targetedUserIds.length > 0) {
      if (!flagConfig.targetedUserIds.includes(context.userId)) {
        return false;
      }
    }

    // Tier targeting
    if (flagConfig.targetedTiers && flagConfig.targetedTiers.length > 0) {
      if (!flagConfig.targetedTiers.includes(context.customerTier)) {
        return false;
      }
    }

    return true;
  }

  // Get all enabled features for user
  async getEnabledFeatures(context: FeatureFlagContext): Promise<Feature[]> {
    const features = Object.values(Feature);
    const enabled = await Promise.all(
      features.map(async (feature) => ({
        feature,
        enabled: await this.isEnabled(feature, context),
      }))
    );

    return enabled.filter((f) => f.enabled).map((f) => f.feature);
  }

  private async getFlagConfig(feature: Feature) {
    const cacheKey = `feature_flag:${feature}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const config = await db.execute(sql`
      SELECT * FROM app.feature_flags WHERE feature = ${feature}
    `);

    if (config.length === 0) {
      return {
        enabled: false,
        environments: [],
        rolloutPercentage: 0,
        targetedUserIds: [],
        targetedTiers: [],
      };
    }

    await cache.set(cacheKey, config[0], 300);
    return config[0];
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash);
  }
}

export const featureFlags = new FeatureFlagService();
```

**Usage in API:**

```typescript
// apps/api/src/modules/analytics/routes.ts
fastify.get('/api/v1/analytics/advanced', {
  preHandler: [fastify.authenticate],
}, async (request, reply) => {
  const userId = request.user?.sub;
  const user = await getCurrentUser(userId);

  // Check feature flag
  const enabled = await featureFlags.isEnabled(Feature.ADVANCED_ANALYTICS, {
    userId,
    email: user.email,
    customerTier: user.customer_tier,
    environment: process.env.NODE_ENV as any,
    version: process.env.APP_VERSION,
  });

  if (!enabled) {
    return reply.status(403).send({
      error: 'Feature not available',
      message: 'Advanced analytics is not enabled for your account',
    });
  }

  // Feature is enabled, proceed
  const analytics = await getAdvancedAnalytics(userId);
  return analytics;
});
```

**Feature Flag Table:**

```sql
-- db/feature_flags.ddl
CREATE TABLE app.feature_flags (
  feature VARCHAR(100) PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  environments VARCHAR(20)[] DEFAULT ARRAY['development']::VARCHAR[],
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  targeted_user_ids UUID[],
  targeted_tiers VARCHAR(50)[],
  created_ts TIMESTAMPTZ DEFAULT NOW(),
  updated_ts TIMESTAMPTZ DEFAULT NOW()
);

-- Example: Enable AI assistant for 10% of enterprise users
INSERT INTO app.feature_flags (feature, enabled, environments, rollout_percentage, targeted_tiers)
VALUES (
  'ai_assistant',
  TRUE,
  ARRAY['staging', 'production']::VARCHAR[],
  10,
  ARRAY['enterprise']::VARCHAR[]
);
```

**Admin UI for Managing Flags:**

```typescript
// apps/api/src/modules/admin/feature-flags.ts
fastify.put('/api/v1/admin/feature-flags/:feature', {
  preHandler: [fastify.authenticate, requireAdmin],
}, async (request, reply) => {
  const { feature } = request.params;
  const { enabled, rolloutPercentage, targetedTiers } = request.body;

  await db.execute(sql`
    UPDATE app.feature_flags
    SET
      enabled = ${enabled},
      rollout_percentage = ${rolloutPercentage},
      targeted_tiers = ${targetedTiers},
      updated_ts = NOW()
    WHERE feature = ${feature}
  `);

  // Invalidate cache
  await cache.invalidate(`feature_flag:${feature}`);

  // Audit log
  await auditLogger.log({
    eventType: AuditEventType.SETTINGS_CHANGED,
    userId: request.user?.sub,
    userEmail: request.user?.email,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
    resource: 'feature_flag',
    resourceId: feature,
    action: 'update',
    success: true,
    metadata: { enabled, rolloutPercentage, targetedTiers },
  });

  return { message: 'Feature flag updated' };
});
```

**Expected Impact:**
- Gradual feature rollout (reduce risk)
- A/B testing capabilities
- Emergency kill switch
- Per-tier features for monetization

---

## 4. Code Architecture Assessment

### Current Rating: **7.0/10**

### Strengths ✅

1. **Excellent DRY Principles** - 94% code reduction with universal components
2. **Single Source of Truth** - entityConfig.ts centralization
3. **Clear Module Boundaries** - 21 well-organized API modules
4. **Type Safety** - TypeScript throughout
5. **Consistent Patterns** - Universal CRUD for all entities

### Weaknesses ⚠️

1. **No Service Layer** - Business logic in route handlers
2. **No Repository Pattern** - Direct database access in routes
3. **No Dependency Injection** - Tightly coupled dependencies
4. **No Domain Models vs DTOs** - Database models used everywhere
5. **No Validation Layer Abstraction** - TypeBox schemas duplicated
6. **No Error Handling Middleware** - Try/catch in every route
7. **No State Management** - Frontend uses local state only
8. **No Component Testing** - No testing strategy documented

---

### Next-Generation Suggestions

#### 4.1 Clean Architecture with Hexagonal Pattern

**Problem:** Business logic mixed with route handlers and database access.

**Solution:** Clean architecture with layers

**Directory Structure:**

```
apps/api/src/
├── domain/                          # Core business logic (no dependencies)
│   ├── entities/
│   │   ├── Project.ts               # Domain entity (rich model)
│   │   ├── Task.ts
│   │   └── Employee.ts
│   ├── value-objects/
│   │   ├── Email.ts
│   │   ├── ProjectCode.ts
│   │   └── Money.ts
│   ├── aggregates/
│   │   └── ProjectAggregate.ts      # Aggregate root
│   ├── repositories/                # Interfaces only
│   │   ├── IProjectRepository.ts
│   │   └── ITaskRepository.ts
│   └── services/
│       └── ProjectDomainService.ts  # Domain logic
│
├── application/                     # Use cases / application logic
│   ├── commands/
│   │   ├── CreateProjectCommand.ts
│   │   └── CreateProjectHandler.ts
│   ├── queries/
│   │   ├── GetProjectQuery.ts
│   │   └── GetProjectHandler.ts
│   └── dtos/
│       ├── CreateProjectDTO.ts
│       └── ProjectResponseDTO.ts
│
├── infrastructure/                  # External dependencies
│   ├── database/
│   │   ├── repositories/
│   │   │   ├── ProjectRepository.ts # Concrete implementation
│   │   │   └── TaskRepository.ts
│   │   └── migrations/
│   ├── cache/
│   │   └── RedisCache.ts
│   ├── email/
│   │   └── EmailService.ts
│   └── storage/
│       └── MinIOStorage.ts
│
└── presentation/                    # API layer (Fastify routes)
    ├── routes/
    │   └── project.routes.ts
    ├── middleware/
    └── validators/
```

**Domain Entity (Rich Model):**

```typescript
// apps/api/src/domain/entities/Project.ts
import { ProjectCode } from '../value-objects/ProjectCode.js';
import { Money } from '../value-objects/Money.js';

export class Project {
  constructor(
    public readonly id: string,
    private _code: ProjectCode,
    private _name: string,
    private _budgetAllocated: Money,
    private _budgetSpent: Money,
    private _managerId: string,
    private _tasks: Task[] = []
  ) {}

  // Business logic methods
  allocateBudget(amount: Money): void {
    if (amount.isNegative()) {
      throw new Error('Budget allocation must be positive');
    }
    this._budgetAllocated = this._budgetAllocated.add(amount);
  }

  spendBudget(amount: Money): void {
    const newSpent = this._budgetSpent.add(amount);
    if (newSpent.isGreaterThan(this._budgetAllocated)) {
      throw new Error('Cannot spend more than allocated budget');
    }
    this._budgetSpent = newSpent;
  }

  assignTask(task: Task): void {
    if (this._tasks.find(t => t.id === task.id)) {
      throw new Error('Task already assigned to project');
    }
    this._tasks.push(task);
  }

  calculateProgress(): number {
    if (this._tasks.length === 0) return 0;
    const completedTasks = this._tasks.filter(t => t.isCompleted()).length;
    return (completedTasks / this._tasks.length) * 100;
  }

  // Getters
  get code(): string { return this._code.value; }
  get name(): string { return this._name; }
  get budgetAllocated(): number { return this._budgetAllocated.amount; }
  get budgetSpent(): number { return this._budgetSpent.amount; }
  get remainingBudget(): number {
    return this._budgetAllocated.subtract(this._budgetSpent).amount;
  }
}
```

**Value Objects:**

```typescript
// apps/api/src/domain/value-objects/ProjectCode.ts
export class ProjectCode {
  constructor(public readonly value: string) {
    if (!ProjectCode.isValid(value)) {
      throw new Error('Invalid project code format');
    }
  }

  static isValid(code: string): boolean {
    return /^PRJ-\d{4}-\d{3}$/.test(code);
  }

  static generate(year: number, sequence: number): ProjectCode {
    const code = `PRJ-${year}-${sequence.toString().padStart(3, '0')}`;
    return new ProjectCode(code);
  }
}

// apps/api/src/domain/value-objects/Money.ts
export class Money {
  constructor(
    public readonly amount: number,
    public readonly currency: string = 'CAD'
  ) {
    if (amount < 0) {
      throw new Error('Amount cannot be negative');
    }
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Cannot add money with different currencies');
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Cannot subtract money with different currencies');
    }
    return new Money(Math.max(0, this.amount - other.amount), this.currency);
  }

  isGreaterThan(other: Money): boolean {
    return this.amount > other.amount;
  }

  isNegative(): boolean {
    return this.amount < 0;
  }
}
```

**Repository Interface:**

```typescript
// apps/api/src/domain/repositories/IProjectRepository.ts
import { Project } from '../entities/Project.js';

export interface IProjectRepository {
  findById(id: string): Promise<Project | null>;
  findByCode(code: string): Promise<Project | null>;
  findAll(userId: string, filters: any): Promise<Project[]>;
  save(project: Project): Promise<void>;
  delete(id: string): Promise<void>;
}
```

**Repository Implementation:**

```typescript
// apps/api/src/infrastructure/database/repositories/ProjectRepository.ts
import { IProjectRepository } from '@/domain/repositories/IProjectRepository.js';
import { Project } from '@/domain/entities/Project.js';
import { ProjectCode } from '@/domain/value-objects/ProjectCode.js';
import { Money } from '@/domain/value-objects/Money.js';

export class ProjectRepository implements IProjectRepository {
  async findById(id: string): Promise<Project | null> {
    const result = await db.execute(sql`
      SELECT * FROM app.d_project WHERE id = ${id} AND active_flag = TRUE
    `);

    if (result.length === 0) return null;

    return this.toDomain(result[0]);
  }

  async save(project: Project): Promise<void> {
    await db.execute(sql`
      INSERT INTO app.d_project (
        id, code, name, budget_allocated, budget_spent, manager_employee_id
      ) VALUES (
        ${project.id},
        ${project.code},
        ${project.name},
        ${project.budgetAllocated},
        ${project.budgetSpent},
        ${project._managerId}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        budget_allocated = EXCLUDED.budget_allocated,
        budget_spent = EXCLUDED.budget_spent,
        updated_ts = NOW()
    `);
  }

  // Map database row to domain entity
  private toDomain(row: any): Project {
    return new Project(
      row.id,
      new ProjectCode(row.code),
      row.name,
      new Money(row.budget_allocated),
      new Money(row.budget_spent),
      row.manager_employee_id,
      [] // Tasks loaded separately
    );
  }
}
```

**Use Case / Command Handler:**

```typescript
// apps/api/src/application/commands/CreateProjectHandler.ts
import { IProjectRepository } from '@/domain/repositories/IProjectRepository.js';
import { Project } from '@/domain/entities/Project.js';
import { ProjectCode } from '@/domain/value-objects/ProjectCode.js';
import { Money } from '@/domain/value-objects/Money.js';

export class CreateProjectCommand {
  constructor(
    public readonly userId: string,
    public readonly code: string,
    public readonly name: string,
    public readonly budgetAllocated: number,
    public readonly managerId: string
  ) {}
}

export class CreateProjectHandler {
  constructor(private readonly projectRepository: IProjectRepository) {}

  async execute(command: CreateProjectCommand): Promise<string> {
    // 1. Validate business rules
    const projectCode = new ProjectCode(command.code);

    // 2. Check uniqueness
    const existing = await this.projectRepository.findByCode(projectCode.value);
    if (existing) {
      throw new Error('Project with this code already exists');
    }

    // 3. Create domain entity
    const project = new Project(
      crypto.randomUUID(),
      projectCode,
      command.name,
      new Money(command.budgetAllocated),
      new Money(0),
      command.managerId
    );

    // 4. Save to repository
    await this.projectRepository.save(project);

    // 5. Publish domain event
    await eventBus.publish({
      type: DomainEvent.PROJECT_CREATED,
      userId: command.userId,
      aggregateId: project.id,
      aggregateType: 'project',
      payload: { code: project.code, name: project.name },
      metadata: {},
    });

    return project.id;
  }
}
```

**Dependency Injection:**

```typescript
// apps/api/src/container.ts
import { Container } from 'inversify';
import { IProjectRepository } from './domain/repositories/IProjectRepository.js';
import { ProjectRepository } from './infrastructure/database/repositories/ProjectRepository.js';
import { CreateProjectHandler } from './application/commands/CreateProjectHandler.js';

export const container = new Container();

// Bind repositories
container.bind<IProjectRepository>('IProjectRepository').to(ProjectRepository);

// Bind command handlers
container.bind<CreateProjectHandler>(CreateProjectHandler).toSelf();

// Get instance
export function getHandler<T>(type: any): T {
  return container.get<T>(type);
}
```

**API Route (Thin Layer):**

```typescript
// apps/api/src/presentation/routes/project.routes.ts
import { CreateProjectCommand, CreateProjectHandler } from '@/application/commands/CreateProjectHandler.js';
import { getHandler } from '@/container.js';

export async function projectRoutes(fastify: FastifyInstance) {
  fastify.post('/api/v2/project', {
    preHandler: [fastify.authenticate],
    schema: {
      body: CreateProjectDTO,
      response: {
        201: ProjectResponseDTO,
      },
    },
  }, async (request, reply) => {
    const userId = request.user?.sub;
    const { code, name, budgetAllocated, managerId } = request.body;

    // Get handler from DI container
    const handler = getHandler<CreateProjectHandler>(CreateProjectHandler);

    // Execute command
    const projectId = await handler.execute(
      new CreateProjectCommand(userId, code, name, budgetAllocated, managerId)
    );

    return reply.status(201).send({ id: projectId });
  });
}
```

**Expected Impact:**
- Clean separation of concerns
- Testable business logic (no framework dependencies)
- Flexible infrastructure (swap database, cache, etc.)
- Domain-driven design
- Better code organization

---

#### 4.2 Frontend State Management with Zustand

**Problem:** Frontend uses local state, causing prop drilling and re-fetching data.

**Solution:** Zustand for global state management

**Implementation:**

```typescript
// apps/web/src/stores/useProjectStore.ts
import create from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { APIFactory } from '@/lib/api-factory';

interface ProjectState {
  // State
  projects: Project[];
  selectedProject: Project | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchProjects: () => Promise<void>;
  fetchProject: (id: string) => Promise<void>;
  createProject: (data: CreateProjectDTO) => Promise<string>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setSelectedProject: (project: Project | null) => void;
}

export const useProjectStore = create<ProjectState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        projects: [],
        selectedProject: null,
        loading: false,
        error: null,

        // Fetch all projects
        fetchProjects: async () => {
          set({ loading: true, error: null });
          try {
            const api = APIFactory.getAPI('project');
            const response = await api.list();
            set({ projects: response.data, loading: false });
          } catch (error) {
            set({ error: error.message, loading: false });
          }
        },

        // Fetch single project
        fetchProject: async (id: string) => {
          set({ loading: true, error: null });
          try {
            const api = APIFactory.getAPI('project');
            const response = await api.get(id);
            set({ selectedProject: response.data, loading: false });
          } catch (error) {
            set({ error: error.message, loading: false });
          }
        },

        // Create project
        createProject: async (data: CreateProjectDTO) => {
          set({ loading: true, error: null });
          try {
            const api = APIFactory.getAPI('project');
            const response = await api.create(data);

            // Optimistic update
            set(state => ({
              projects: [...state.projects, response.data],
              loading: false,
            }));

            return response.data.id;
          } catch (error) {
            set({ error: error.message, loading: false });
            throw error;
          }
        },

        // Update project
        updateProject: async (id: string, data: Partial<Project>) => {
          set({ loading: true, error: null });
          try {
            const api = APIFactory.getAPI('project');
            await api.update(id, data);

            // Optimistic update
            set(state => ({
              projects: state.projects.map(p =>
                p.id === id ? { ...p, ...data } : p
              ),
              selectedProject: state.selectedProject?.id === id
                ? { ...state.selectedProject, ...data }
                : state.selectedProject,
              loading: false,
            }));
          } catch (error) {
            set({ error: error.message, loading: false });
            throw error;
          }
        },

        // Delete project
        deleteProject: async (id: string) => {
          set({ loading: true, error: null });
          try {
            const api = APIFactory.getAPI('project');
            await api.delete(id);

            // Optimistic update
            set(state => ({
              projects: state.projects.filter(p => p.id !== id),
              selectedProject: state.selectedProject?.id === id ? null : state.selectedProject,
              loading: false,
            }));
          } catch (error) {
            set({ error: error.message, loading: false });
            throw error;
          }
        },

        // Set selected project
        setSelectedProject: (project: Project | null) => {
          set({ selectedProject: project });
        },
      }),
      {
        name: 'project-store',
        partialize: (state) => ({ projects: state.projects }), // Only persist projects
      }
    ),
    { name: 'ProjectStore' }
  )
);
```

**Usage in Components:**

```typescript
// apps/web/src/pages/shared/EntityMainPage.tsx
import { useProjectStore } from '@/stores/useProjectStore';

export function EntityMainPage({ entityType }: { entityType: string }) {
  const { projects, loading, error, fetchProjects } = useProjectStore();

  useEffect(() => {
    fetchProjects();
  }, []);

  if (loading) return <Spinner />;
  if (error) return <Error message={error} />;

  return (
    <div>
      <h1>Projects</h1>
      <FilteredDataTable data={projects} entityType="project" />
    </div>
  );
}
```

**Advanced Selectors:**

```typescript
// apps/web/src/stores/selectors/projectSelectors.ts
import { useProjectStore } from '../useProjectStore';

// Get active projects
export const useActiveProjects = () => {
  return useProjectStore(state =>
    state.projects.filter(p => p.active_flag === true)
  );
};

// Get projects by stage
export const useProjectsByStage = (stage: number) => {
  return useProjectStore(state =>
    state.projects.filter(p => p.project_stage === stage)
  );
};

// Get project count by stage (for kanban)
export const useProjectCountsByStage = () => {
  return useProjectStore(state => {
    const counts = {};
    state.projects.forEach(p => {
      counts[p.project_stage] = (counts[p.project_stage] || 0) + 1;
    });
    return counts;
  });
};
```

**Expected Impact:**
- Centralized state management
- No prop drilling
- Optimistic updates
- Persistent state across page refreshes
- Better performance (selective re-renders)

---

## Summary & Prioritization

### High Priority (Implement First)

1. **Multi-Layer Caching** (Scalability 1.1) - Immediate 70-90% query reduction
2. **Audit Logging** (Security 2.2) - Critical for compliance
3. **MFA/2FA** (Security 2.1) - Essential security enhancement
4. **Advanced Rate Limiting** (Security 2.4) - Protection against attacks
5. **Event-Driven Architecture** (Design 3.1) - Foundation for scalability

### Medium Priority (Next 6 Months)

6. **Horizontal Scaling** (Scalability 1.3) - As traffic grows
7. **CQRS Pattern** (Design 3.2) - Performance optimization
8. **Encryption at Rest** (Security 2.3) - Compliance requirement
9. **API Versioning** (Design 3.3) - Before public API launch
10. **Clean Architecture** (Architecture 4.1) - Refactor gradually

### Low Priority (Future Roadmap)

11. **Background Job Queue** (Scalability 1.5) - Nice to have
12. **Database Read Replicas** (Scalability 1.4) - When database becomes bottleneck
13. **Feature Flags** (Design 3.4) - For A/B testing
14. **State Management** (Architecture 4.2) - Frontend enhancement

---

**Document Version:** 1.0
**Last Updated:** 2025-10-18
**Next Review:** 2025-11-18
