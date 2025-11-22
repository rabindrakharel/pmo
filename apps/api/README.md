# PMO Backend API

> **Enterprise Fastify API with RBAC-driven data access and universal entity architecture**

## Overview

The PMO Backend API is a high-performance Fastify server that provides a complete REST API for the Project Management Office platform. Built for Huron Home Services, it supports 21 entity types with fine-grained RBAC permissions, dynamic parent-child relationships, and flexible hierarchical data structures.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Run production server
pnpm start

# Run tests
pnpm test
```

**Access Points:**
- API Server: http://localhost:4000
- API Documentation: http://localhost:4000/docs
- Health Check: http://localhost:4000/api/health

## Technology Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| **Fastify** | High-performance web framework | 4.x |
| **Drizzle ORM** | Type-safe database access | Latest |
| **PostgreSQL** | Primary database | 14+ |
| **TypeScript** | Type safety | 5.x |
| **TypeBox** | Runtime validation | Latest |
| **JWT** | Authentication | @fastify/jwt |
| **Swagger** | API documentation | @fastify/swagger |

## Architecture

### Core Design Principles

1. **Entity-Driven Architecture** - All 21 entity types follow identical CRUD patterns
2. **RBAC in SQL** - Permission checks embedded directly in database queries
3. **No Foreign Keys** - Relationships managed through `d_entity_instance_link` table
4. **Type-Safe API** - TypeBox schemas provide runtime validation
5. **Universal Patterns** - One pattern works for all entities

### Module Structure

```
apps/api/src/
├── server.ts                    # Fastify app initialization
├── db/
│   └── index.ts                # Database connection pool
├── lib/
│   ├── config.ts               # Environment configuration
│   ├── logger.ts               # Pino logger
│   └── child-entity-route-factory.ts  # Universal child endpoint factory
├── routes/
│   └── config.ts               # Config endpoints
└── modules/                    # 21 entity modules
    ├── auth/                   # JWT authentication
    ├── employee/               # Employee management
    ├── project/                # Project management (reference implementation)
    ├── task/                   # Task management
    ├── client/                 # Client/CRM
    ├── biz/                    # Business unit hierarchy
    ├── office/                 # Office location hierarchy
    ├── role/                   # Role definitions
    ├── position/               # Position management
    ├── worksite/               # Worksite locations
    ├── form/                   # Dynamic forms
    ├── wiki/                   # Knowledge base
    ├── artifact/               # Document management
    ├── reports/                # Report definitions
    ├── task-data/              # Task submission data
    ├── entity/                 # Entity type metadata (d_entity table)
    ├── linkage/                # Entity relationship management
    ├── meta/                   # Legacy metadata API
    ├── setting/                # Settings API (16 setting tables)
    ├── schema/                 # Schema introspection
    └── rbac/                   # RBAC utilities
```

## API Modules (21 Total)

### Core Infrastructure (6 modules)

**auth** - Authentication & Authorization
- `POST /api/v1/auth/login` - Login with email/password, returns JWT
- `POST /api/v1/auth/register` - User registration
- `GET /api/v1/auth/me` - Get current user profile

**schema** - Database schema introspection
- `GET /api/v1/schema/tables` - List all tables
- `GET /api/v1/schema/columns/:table` - Get table columns

**setting** - Settings/configuration API (NEW - replaces meta)
- `GET /api/v1/setting?category=<name>` - Get settings by category
- 16 settings categories: `projectStage`, `taskStage`, `customerTier`, etc.

**meta** - Legacy metadata API (DEPRECATED - use setting instead)
- `GET /api/v1/meta/:category` - Get metadata by category

**entity** - Entity type metadata (entity table)
- `GET /api/v1/entity/types` - List all entity types
- `GET /api/v1/entity/type/:entityCode` - Get entity type metadata
- `GET /api/v1/entity/child-tabs/:entityCode/:entityId` - Dynamic child tabs

**rbac** - RBAC permission utilities
- `GET /api/v1/rbac/check` - Check user permissions
- `GET /api/v1/rbac/permissions/:empId` - Get employee permissions

### Entity Modules (14 modules)

All entity modules follow the same pattern:

```
GET    /api/v1/{entity}           # List with RBAC filtering
GET    /api/v1/{entity}/:id       # Get single entity
POST   /api/v1/{entity}           # Create (requires permission 4)
PUT    /api/v1/{entity}/:id       # Update (requires permission 1)
DELETE /api/v1/{entity}/:id       # Soft delete (requires permission 3)
```

**Core Entities:**
1. **project** - Project management (REFERENCE IMPLEMENTATION)
2. **task** - Task management with kanban support
3. **employee** - User accounts & authentication
4. **client** - Client/CRM management
5. **biz** - Business unit hierarchy (3 levels)
6. **office** - Office location hierarchy (4 levels)
7. **worksite** - Work site locations

**Content Entities:**
8. **wiki** - Knowledge base articles
9. **form** - Dynamic form definitions
10. **artifact** - Document/file management
11. **reports** - Report definitions
12. **task-data** - Task submission data

**Organizational Entities:**
13. **role** - Role definitions (22 roles)
14. **position** - Position management (16 positions)

### Specialized Modules (1 module)

**linkage** - Entity relationship management
- `GET /api/v1/linkage/type` - Get all entity type relationships
- `GET /api/v1/linkage/instance` - Get entity instance relationships
- `POST /api/v1/linkage/type` - Create entity type relationship
- `POST /api/v1/linkage/instance` - Link entity instances

## RBAC Security Model

### Permission Array Structure

Permissions are stored as integer arrays in `d_entity_rbac.permission`:

| Code | Permission | Description | Example API Call |
|------|------------|-------------|------------------|
| **0** | View | Read access | `GET /api/v1/project/:id` |
| **1** | Edit | Modify data | `PUT /api/v1/project/:id` |
| **2** | Share | Grant permissions | Custom endpoints |
| **3** | Delete | Soft delete | `DELETE /api/v1/project/:id` |
| **4** | Create | Create new entities | `POST /api/v1/project` |

### Permission Scopes

**Type-Level: `entity_id = 'all'`**
- Grants access to ALL instances of that entity type
- Example: James Miller has `{entity='project', entity_id='all', permission={0,1,2,3,4}}`
- Result: Can create, view, edit, share, and delete ANY project

**Instance-Level: `entity_id = '<uuid>'`**
- Grants access to ONE specific instance only
- Example: `{entity='project', entity_id='93106ffb...', permission={0,1}}`
- Result: Can only view and edit that one specific project

### RBAC Implementation Pattern

Every protected endpoint follows this pattern:

```typescript
fastify.get('/api/v1/project/:id', {
  preHandler: [fastify.authenticate],  // JWT validation
}, async (request, reply) => {
  const userId = request.user?.sub;  // Extract from JWT
  const { id: projectId } = request.params;

  // RBAC check embedded in query
  const projects = await db.execute(sql`
    SELECT p.*
    FROM app.d_project p
    WHERE p.id = ${projectId}
      AND EXISTS (
        SELECT 1 FROM app.d_entity_rbac rbac
        WHERE rbac.empid = ${userId}
          AND rbac.entity = 'project'
          AND (rbac.entity_id = p.id::text OR rbac.entity_id = 'all')
          AND rbac.active_flag = true
          AND 0 = ANY(rbac.permission)  -- View permission
      )
  `);

  if (projects.length === 0) {
    return reply.status(403).send({ error: 'Access denied' });
  }

  return { data: projects[0] };
});
```

## Child Entity Pattern

### Child Entity Route Factory (DRY Principle)

The `child-entity-route-factory.ts` module eliminates code duplication for child entity endpoints.

**Location:** `apps/api/src/lib/child-entity-route-factory.ts`

**Available Functions:**
```typescript
import {
  createChildEntityEndpoint,
  createMinimalChildEntityEndpoint
} from '../../lib/child-entity-route-factory.js';

// Create individual child entity endpoints:
createChildEntityEndpoint(fastify, 'project', 'task', 'd_task');
createMinimalChildEntityEndpoint(fastify, 'project', 'task', 'd_task');
```

**Current Implementation:**

Projects currently use manual endpoint definitions for child entities:
```typescript
// project/routes.ts - Manual child entity endpoints
fastify.get('/api/v1/project/:id/task', { ... });
fastify.get('/api/v1/project/:id/wiki', { ... });
fastify.get('/api/v1/project/:id/forms', { ... });
fastify.get('/api/v1/project/:id/artifacts', { ... });
```

**Benefits:**
- Centralized ENTITY_TABLE_MAP for consistent table name resolution
- Standardized RBAC pattern available for adoption
- Reusable factory functions for future refactoring

### Child Entity Query Pattern

All child entities are queried via `d_entity_instance_link`:

```sql
-- Get tasks for project
SELECT t.*
FROM app.d_task t
INNER JOIN app.d_entity_instance_link eim
  ON eim.child_entity_id = t.id::text
WHERE eim.parent_entity_id = :projectId
  AND eim.parent_entity_type = 'project'
  AND eim.child_entity_type = 'task'
  AND eim.active_flag = true
  AND t.active_flag = true
ORDER BY t.created_ts DESC;
```

## Database Integration

### Database Connection

**File:** `apps/api/src/db/index.ts`

Uses `drizzle-orm` with connection pooling:

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5434,
  database: process.env.DB_NAME || 'app',
  user: process.env.DB_USER || 'app',
  password: process.env.DB_PASSWORD || 'app',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const db = drizzle(pool);
```

### Database Schema

**Total:** 39 DDL files
- **16 Setting Tables** (`datalabel_*`)
- **13 Core Entity Tables** (`d_*`)
- **3 Relationship Tables** (`d_entity_instance_link`, `d_entity_rbac`, `rel_emp_role`)
- **7 Additional Tables** (`d_entity`, `d_form_data`, etc.)

See `/home/rabin/projects/pmo/db/README.md` for complete schema documentation.

## API Endpoint Conventions

### Standard CRUD Pattern

All entity modules implement these 5 endpoints:

```
GET    /api/v1/{entity}           # List (RBAC filtered, paginated)
GET    /api/v1/{entity}/:id       # Get single entity
POST   /api/v1/{entity}           # Create new entity
PUT    /api/v1/{entity}/:id       # Update entity
DELETE /api/v1/{entity}/:id       # Soft delete (sets active_flag=false)
```

### Query Parameters (List Endpoints)

```
?page=1              # Page number (default: 1)
?limit=50            # Items per page (default: 50, max: 100)
?search=keyword      # Full-text search
?active=true         # Filter by active_flag
?{field}={value}     # Filter by specific field (e.g., project_stage=1)
```

### Response Format

**Success Response:**
```json
{
  "data": [...],           // Array of entities or single entity
  "total": 156,            // Total count (for pagination)
  "page": 1,               // Current page
  "limit": 50              // Items per page
}
```

**Error Response:**
```json
{
  "error": "Access denied",
  "statusCode": 403,
  "message": "Insufficient permissions"
}
```

## Authentication Flow

1. **Login:** `POST /api/v1/auth/login` with `{email, password}`
2. **Receive JWT:** Response includes `{token, user: {id, email, name}}`
3. **Store Token:** Client stores token in localStorage/memory
4. **Authenticated Requests:** Include header `Authorization: Bearer <token>`
5. **JWT Validation:** Fastify middleware validates token on every request
6. **User ID Extraction:** `request.user.sub` contains employee ID
7. **RBAC Check:** Every query checks `d_entity_rbac` for permissions

## Configuration

### Environment Variables

**File:** `apps/api/.env` (create from `.env.example`)

```bash
# Server
PORT=4000
NODE_ENV=development
API_ORIGIN=http://localhost:4000
WEB_ORIGIN=http://localhost:5173

# Database
DB_HOST=localhost
DB_PORT=5434
DB_NAME=app
DB_USER=app
DB_PASSWORD=app

# JWT
JWT_SECRET=your-secret-key-here-change-in-production
JWT_EXPIRES_IN=7d

# Redis (optional)
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Fastify Plugins

Registered in `apps/api/src/server.ts`:

1. **@fastify/helmet** - Security headers
2. **@fastify/cors** - Cross-origin requests
3. **@fastify/jwt** - JWT authentication
4. **@fastify/rate-limit** - Rate limiting (100 req/min)
5. **@fastify/swagger** - OpenAPI documentation
6. **@fastify/swagger-ui** - Interactive API docs

## Testing

### Test User Credentials

**Email:** `james.miller@huronhome.ca`
**Password:** `password123`
**Role:** CEO / System Administrator
**Permissions:** Full access to all 16 entity types

### Test API Endpoints

Use the provided test script:

```bash
# Test any endpoint
./tools/test-api.sh GET /api/v1/project
./tools/test-api.sh POST /api/v1/project '{"name":"Test Project","code":"TEST-001"}'
./tools/test-api.sh PUT /api/v1/project/{uuid} '{"name":"Updated Name"}'
./tools/test-api.sh DELETE /api/v1/project/{uuid}
```

See `/home/rabin/projects/pmo/tools/API_TESTING.md` for detailed testing guide.

## API Documentation

### Swagger UI

Access interactive API documentation at http://localhost:4000/docs

**Features:**
- Try endpoints directly in browser
- View request/response schemas
- See authentication requirements
- Explore all 21 modules

### OpenAPI Spec

Download OpenAPI 3.0 specification:
```bash
curl http://localhost:4000/docs/json > api-spec.json
```

## Common Patterns

### 1. List with Filtering

```typescript
GET /api/v1/project?search=landscaping&project_stage=2&limit=25
```

### 2. Get Child Entities

```typescript
GET /api/v1/project/{projectId}/task
GET /api/v1/biz/{bizId}/project
GET /api/v1/office/{officeId}/employee
```

### 3. Create with Relationships

```typescript
POST /api/v1/project
Body: {
  "name": "New Project",
  "code": "PRJ-2024-001",
  "business_id": "uuid-of-business",
  "manager_employee_id": "uuid-of-manager"
}
```

### 4. Check Permissions

```typescript
GET /api/v1/rbac/check?entity=project&entity_id=all&permission=4
```

## Performance Considerations

### Connection Pooling

- PostgreSQL pool: Max 20 connections
- Idle timeout: 30 seconds
- Connection timeout: 2 seconds

### Query Optimization

- All RBAC checks use indexed columns
- `d_entity_rbac` has composite index on `(empid, entity, entity_id)`
- `d_entity_instance_link` has composite index on `(parent_entity_id, child_entity_type)`

### Rate Limiting

- Default: 100 requests per minute per IP
- Configurable in `server.ts`

## Error Handling

### HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Data retrieved successfully |
| 201 | Created | Entity created successfully |
| 400 | Bad Request | Invalid input data |
| 401 | Unauthorized | Missing or invalid JWT token |
| 403 | Forbidden | Insufficient permissions (RBAC denied) |
| 404 | Not Found | Entity does not exist |
| 422 | Validation Error | TypeBox schema validation failed |
| 500 | Server Error | Database or server error |

### Error Response Format

```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Access denied to this project"
}
```

## Adding a New Entity Module

1. **Create module directory:** `apps/api/src/modules/myentity/`
2. **Create `routes.ts`:** Copy from `project/routes.ts` (reference implementation)
3. **Register in `modules/index.ts`:**
   ```typescript
   import { myEntityRoutes } from './myentity/routes.js';
   await myEntityRoutes(fastify);
   ```
4. **Add child endpoints (if needed):**
   ```typescript
   // Option 1: Use factory functions (recommended for consistency)
   createChildEntityEndpoint(fastify, 'myentity', 'task', 'd_task');

   // Option 2: Create manual endpoints (current pattern in project/routes.ts)
   fastify.get('/api/v1/myentity/:id/task', { ... });
   ```
5. **Update Swagger tags** in `server.ts`

## Deployment

### Production Build

```bash
pnpm build
NODE_ENV=production pnpm start
```

### Docker Deployment

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --prod
COPY dist ./dist
EXPOSE 4000
CMD ["node", "dist/server.js"]
```

## Troubleshooting

### Database Connection Issues

```bash
# Test database connection
psql -h localhost -p 5434 -U app -d app

# Check if Postgres is running
docker ps | grep postgres
```

### JWT Token Issues

- Verify `JWT_SECRET` is set in `.env`
- Check token expiry (`JWT_EXPIRES_IN`)
- Validate token format: `Authorization: Bearer <token>`

### RBAC Permission Denied

```sql
-- Check user permissions
SELECT * FROM app.d_entity_rbac
WHERE empid = '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'
ORDER BY entity;
```

## Support & Documentation

- **Main README:** `/home/rabin/projects/pmo/README.md`
- **Database Schema:** `/home/rabin/projects/pmo/db/README.md`
- **Frontend Guide:** `/home/rabin/projects/pmo/apps/web/README.md`
- **API Testing:** `/home/rabin/projects/pmo/tools/API_TESTING.md`
- **Management Tools:** `/home/rabin/projects/pmo/tools/README.md`

---

**Last Updated:** 2025-10-18
**API Version:** 1.0.0
**Framework:** Fastify 4.x
**Total Modules:** 21
**Total Endpoints:** 100+
