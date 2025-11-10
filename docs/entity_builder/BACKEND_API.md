# Dynamic Entity Builder - Backend API

> **Backend API endpoint specifications** for entity creation system (Week 2 implementation)

---

## 📋 Table of Contents

1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [Preview DDL Endpoint](#preview-ddl-endpoint)
4. [Create Entity Endpoint](#create-entity-endpoint)
5. [Error Responses](#error-responses)
6. [Implementation Guide](#implementation-guide)
7. [Testing](#testing)

---

## API Overview

### Base URL
```
http://localhost:4000/api/v1/entity-builder
```

### Endpoints

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| POST | `/preview` | Generate DDL preview | 🚧 TODO |
| POST | `/create` | Create entity (table + API + metadata) | 🚧 TODO |

### Dependencies

**Required services:**
- DDLGenerator (`apps/api/src/lib/ddl-generator.ts`)
- EntityBuilderValidator (`apps/api/src/modules/entity-builder/validator.ts`)
- DynamicRouteFactory (`apps/api/src/lib/dynamic-entity-route-factory.ts`)
- PostgreSQL client (via Fastify plugin)

---

## Authentication

### Required Headers
```http
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

### Permission Check
```typescript
// User must have entity_builder.create permission
fastify.addHook('preHandler', async (request, reply) => {
  const user = request.user; // From JWT token

  const hasPermission = await checkPermission(
    user.id,
    'entity_builder',
    'create'
  );

  if (!hasPermission) {
    return reply.code(403).send({
      error: 'Insufficient permissions to create entities',
      code: 'FORBIDDEN',
      timestamp: new Date().toISOString()
    });
  }
});
```

---

## Preview DDL Endpoint

### Endpoint
```http
POST /api/v1/entity-builder/preview
```

### Purpose
Generate SQL DDL preview before creating entity (allows user to review)

### Request Body
```typescript
interface PreviewRequest {
  entity_code: string;           // Unique entity identifier
  entity_type: 'attribute' | 'transactional';
  columns: ColumnDefinition[];   // Custom column definitions
  parent_entities: string[];     // Array of parent entity codes
  child_entities: string[];      // Array of child entity codes
  ui_icon: string;               // Lucide icon name
  display_order: number;         // Sidebar display order
}

interface ColumnDefinition {
  column_name: string;
  data_type: 'text' | 'number' | 'date' | 'boolean' | 'json';
  description: string;
  required: boolean;
  order: number;
}
```

### Example Request
```http
POST /api/v1/entity-builder/preview HTTP/1.1
Host: localhost:4000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "entity_code": "training_certification",
  "entity_type": "attribute",
  "columns": [
    {
      "column_name": "certification_type",
      "data_type": "text",
      "description": "Type of certification",
      "required": true,
      "order": 1
    },
    {
      "column_name": "expiry_date",
      "data_type": "date",
      "description": "When certification expires",
      "required": true,
      "order": 2
    },
    {
      "column_name": "issuing_authority",
      "data_type": "text",
      "description": "Organization that issued certification",
      "required": false,
      "order": 3
    }
  ],
  "parent_entities": ["employee"],
  "child_entities": ["artifact", "wiki"],
  "ui_icon": "Award",
  "display_order": 110
}
```

### Response
```typescript
interface PreviewResponse {
  ddl: string;                   // Generated SQL DDL
  entity_code: string;           // Echo back entity code
  estimated_size_kb: number;     // Estimated table size (optional)
}
```

### Example Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "ddl": "-- Create training_certification entity table\nCREATE TABLE IF NOT EXISTS app.d_training_certification (\n    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n    code VARCHAR(50) UNIQUE NOT NULL,\n    name VARCHAR(255) NOT NULL,\n    description TEXT,\n\n    -- Custom columns\n    certification_type VARCHAR(255) NOT NULL,\n    expiry_date TIMESTAMP NOT NULL,\n    issuing_authority VARCHAR(255),\n\n    -- Standard audit columns\n    active_flag BOOLEAN DEFAULT true,\n    created_ts TIMESTAMP DEFAULT now(),\n    updated_ts TIMESTAMP DEFAULT now(),\n    created_by_id UUID REFERENCES app.d_employee(id),\n    updated_by_id UUID REFERENCES app.d_employee(id)\n);\n\n-- Create indexes\nCREATE INDEX idx_training_certification_code ON app.d_training_certification(code);\nCREATE INDEX idx_training_certification_active ON app.d_training_certification(active_flag);\nCREATE INDEX idx_training_certification_created ON app.d_training_certification(created_ts);\n\n-- Create trigger\nCREATE TRIGGER tr_training_certification_registry\n    AFTER INSERT OR UPDATE ON app.d_training_certification\n    FOR EACH ROW\n    EXECUTE FUNCTION app.fn_register_entity_instance();\n\n-- Insert entity metadata\nINSERT INTO app.d_entity (code, name, ui_label, ui_icon, display_order, child_entities)\nVALUES (\n    'training_certification',\n    'Training Certification',\n    'Training Certifications',\n    'Award',\n    110,\n    '[{\"entity\":\"artifact\",\"ui_icon\":\"FileText\",\"ui_label\":\"Artifacts\",\"order\":1},{\"entity\":\"wiki\",\"ui_icon\":\"BookOpen\",\"ui_label\":\"Wiki\",\"order\":2}]'::jsonb\n);",
  "entity_code": "training_certification",
  "estimated_size_kb": 32
}
```

### Implementation
```typescript
// apps/api/src/modules/entity-builder/routes.ts
fastify.post('/preview', {
  schema: {
    body: {
      type: 'object',
      required: ['entity_code', 'entity_type', 'columns'],
      properties: {
        entity_code: { type: 'string' },
        entity_type: { type: 'string', enum: ['attribute', 'transactional'] },
        columns: { type: 'array' },
        parent_entities: { type: 'array' },
        child_entities: { type: 'array' },
        ui_icon: { type: 'string' },
        display_order: { type: 'integer' }
      }
    }
  },
  preHandler: [fastify.authenticate, fastify.checkEntityBuilderPermission]
}, async (request, reply) => {
  const entityData = request.body as EntityDefinition;

  // Generate DDL preview (no database changes)
  const ddlGenerator = new DDLGenerator(fastify.pg);
  const ddl = await ddlGenerator.generate(entityData);

  return {
    ddl,
    entity_code: entityData.entity_code,
    estimated_size_kb: 32 // Rough estimate
  };
});
```

### Error Responses

#### 400 Bad Request - Invalid entity code
```json
{
  "error": "Entity code must be lowercase with underscores",
  "code": "INVALID_ENTITY_CODE",
  "details": { "entity_code": "TrainingCert" },
  "timestamp": "2025-11-10T12:00:00.000Z"
}
```

#### 400 Bad Request - Invalid column name
```json
{
  "error": "Column name conflicts with standard column: name",
  "code": "INVALID_COLUMN_NAME",
  "details": { "column_name": "name" },
  "timestamp": "2025-11-10T12:00:00.000Z"
}
```

#### 403 Forbidden
```json
{
  "error": "Insufficient permissions to create entities",
  "code": "FORBIDDEN",
  "timestamp": "2025-11-10T12:00:00.000Z"
}
```

---

## Create Entity Endpoint

### Endpoint
```http
POST /api/v1/entity-builder/create
```

### Purpose
Create entity in database, generate API routes, update metadata

### Request Body
Same as `/preview` endpoint

### Example Request
```http
POST /api/v1/entity-builder/create HTTP/1.1
Host: localhost:4000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "entity_code": "training_certification",
  "entity_type": "attribute",
  "columns": [
    {
      "column_name": "certification_type",
      "data_type": "text",
      "description": "Type of certification",
      "required": true,
      "order": 1
    },
    {
      "column_name": "expiry_date",
      "data_type": "date",
      "description": "When certification expires",
      "required": true,
      "order": 2
    }
  ],
  "parent_entities": ["employee"],
  "child_entities": ["artifact", "wiki"],
  "ui_icon": "Award",
  "display_order": 110
}
```

### Response
```typescript
interface CreateResponse {
  success: boolean;
  entity_code: string;
  table_name: string;            // Database table name
  api_endpoints: string[];       // Created API endpoints
  message: string;
}
```

### Example Response
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "entity_code": "training_certification",
  "table_name": "app.d_training_certification",
  "api_endpoints": [
    "GET /api/v1/training_certification",
    "GET /api/v1/training_certification/:id",
    "POST /api/v1/training_certification",
    "PUT /api/v1/training_certification/:id",
    "DELETE /api/v1/training_certification/:id"
  ],
  "message": "Entity created successfully and is now available"
}
```

### Implementation Flow

```typescript
// apps/api/src/modules/entity-builder/routes.ts
fastify.post('/create', {
  schema: {
    body: {
      type: 'object',
      required: ['entity_code', 'entity_type', 'columns'],
      properties: {
        entity_code: { type: 'string' },
        entity_type: { type: 'string', enum: ['attribute', 'transactional'] },
        columns: { type: 'array' },
        parent_entities: { type: 'array' },
        child_entities: { type: 'array' },
        ui_icon: { type: 'string' },
        display_order: { type: 'integer' }
      }
    }
  },
  preHandler: [fastify.authenticate, fastify.checkEntityBuilderPermission]
}, async (request, reply) => {
  const entityData = request.body as EntityDefinition;

  // Step 1: Validate entity definition
  const validator = new EntityBuilderValidator(fastify.pg);
  const validation = await validator.validate(entityData);

  if (!validation.valid) {
    return reply.code(400).send({
      error: validation.error,
      code: 'VALIDATION_ERROR',
      details: validation.details,
      timestamp: new Date().toISOString()
    });
  }

  // Step 2: Generate DDL
  const ddlGenerator = new DDLGenerator(fastify.pg);
  const ddl = await ddlGenerator.generate(entityData);

  // Step 3: Execute database transaction
  const client = await fastify.pg.connect();

  try {
    await client.query('BEGIN');

    // Create table
    await client.query(ddlGenerator.generateTable(entityData));

    // Create indexes
    const indexes = ddlGenerator.generateIndexes(entityData);
    for (const indexSQL of indexes) {
      await client.query(indexSQL);
    }

    // Create trigger
    await client.query(ddlGenerator.generateTrigger(entityData));

    // Insert entity metadata
    await client.query(ddlGenerator.generateMetadataInsert(entityData));

    // Update parent entities' child_entities JSONB
    for (const parentCode of entityData.parent_entities) {
      await client.query(`
        UPDATE app.d_entity
        SET child_entities = child_entities || $1::jsonb
        WHERE code = $2
      `, [
        JSON.stringify([{
          entity: entityData.entity_code,
          ui_icon: entityData.ui_icon,
          ui_label: ddlGenerator.toPlural(entityData.entity_code),
          order: 999 // Append to end
        }]),
        parentCode
      ]);
    }

    await client.query('COMMIT');

  } catch (error) {
    await client.query('ROLLBACK');
    fastify.log.error('Entity creation failed:', error);

    return reply.code(500).send({
      error: 'Failed to create entity',
      code: 'CREATION_ERROR',
      details: { message: error.message },
      timestamp: new Date().toISOString()
    });

  } finally {
    client.release();
  }

  // Step 4: Create dynamic API routes
  const routeFactory = new DynamicEntityRouteFactory();
  routeFactory.createRoutes(fastify, entityData.entity_code);

  // Step 5: Return success
  return reply.code(201).send({
    success: true,
    entity_code: entityData.entity_code,
    table_name: `app.d_${entityData.entity_code}`,
    api_endpoints: [
      `GET /api/v1/${entityData.entity_code}`,
      `GET /api/v1/${entityData.entity_code}/:id`,
      `POST /api/v1/${entityData.entity_code}`,
      `PUT /api/v1/${entityData.entity_code}/:id`,
      `DELETE /api/v1/${entityData.entity_code}/:id`
    ],
    message: 'Entity created successfully and is now available'
  });
});
```

### Transaction Steps

```
1. BEGIN TRANSACTION
   ↓
2. CREATE TABLE app.d_{entity_code}
   ↓
3. CREATE INDEX idx_{entity_code}_code
   ↓
4. CREATE INDEX idx_{entity_code}_active
   ↓
5. CREATE INDEX idx_{entity_code}_created
   ↓
6. CREATE TRIGGER tr_{entity_code}_registry
   ↓
7. INSERT INTO app.d_entity (metadata)
   ↓
8. UPDATE parent entities' child_entities JSONB
   ↓
9. COMMIT TRANSACTION
   ↓ (if any step fails)
10. ROLLBACK TRANSACTION
```

### Error Responses

#### 400 Bad Request - Validation failed
```json
{
  "error": "Entity code already exists",
  "code": "DUPLICATE_ENTITY",
  "details": { "entity_code": "training_certification" },
  "timestamp": "2025-11-10T12:00:00.000Z"
}
```

#### 400 Bad Request - Invalid column name
```json
{
  "error": "Column name conflicts with standard column: id",
  "code": "INVALID_COLUMN_NAME",
  "details": { "column_name": "id" },
  "timestamp": "2025-11-10T12:00:00.000Z"
}
```

#### 400 Bad Request - SQL injection attempt
```json
{
  "error": "SQL injection attempt detected",
  "code": "SQL_INJECTION",
  "details": { "field": "column_name", "value": "'; DROP TABLE--" },
  "timestamp": "2025-11-10T12:00:00.000Z"
}
```

#### 403 Forbidden
```json
{
  "error": "Insufficient permissions to create entities",
  "code": "FORBIDDEN",
  "timestamp": "2025-11-10T12:00:00.000Z"
}
```

#### 404 Not Found - Parent entity not found
```json
{
  "error": "Parent entity not found: invalid_entity",
  "code": "PARENT_NOT_FOUND",
  "details": { "parent_entity": "invalid_entity" },
  "timestamp": "2025-11-10T12:00:00.000Z"
}
```

#### 500 Internal Server Error - Database error
```json
{
  "error": "Failed to create entity",
  "code": "CREATION_ERROR",
  "details": {
    "message": "relation \"app.d_training_certification\" already exists"
  },
  "timestamp": "2025-11-10T12:00:00.000Z"
}
```

---

## Error Responses

### Standard Error Format

All error responses follow this format:

```typescript
interface ErrorResponse {
  error: string;           // User-friendly error message
  code: string;            // Machine-readable error code
  details?: any;           // Additional error context
  timestamp: string;       // ISO 8601 timestamp
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | General validation failure |
| `INVALID_ENTITY_CODE` | 400 | Entity code format invalid |
| `DUPLICATE_ENTITY` | 409 | Entity code already exists |
| `INVALID_COLUMN_NAME` | 400 | Column name invalid or conflicts |
| `SQL_INJECTION` | 400 | SQL injection attempt detected |
| `PARENT_NOT_FOUND` | 404 | Parent entity doesn't exist |
| `CHILD_NOT_FOUND` | 404 | Child entity doesn't exist |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `CREATION_ERROR` | 500 | Database/server error |

---

## Implementation Guide

### Week 2 Checklist

#### Day 1-2: DDL Generator
- [ ] Create `apps/api/src/lib/ddl-generator.ts`
- [ ] Implement `generateTable()` method
- [ ] Implement `generateIndexes()` method
- [ ] Implement `generateTrigger()` method
- [ ] Implement `generateMetadataInsert()` method
- [ ] Implement `mapDataType()` helper
- [ ] Add unit tests for DDL generation

#### Day 3-4: Validator
- [ ] Create `apps/api/src/modules/entity-builder/validator.ts`
- [ ] Implement `validateEntityCode()` method
- [ ] Implement `validateColumns()` method
- [ ] Implement `containsSQLInjection()` method
- [ ] Implement `entityExists()` check
- [ ] Add unit tests for validation

#### Day 5-6: API Endpoints
- [ ] Create `apps/api/src/modules/entity-builder/routes.ts`
- [ ] Implement POST `/preview` endpoint
- [ ] Implement POST `/create` endpoint
- [ ] Add authentication middleware
- [ ] Add permission check middleware
- [ ] Add error handling
- [ ] Add API tests

#### Day 7: Dynamic Route Factory
- [ ] Create `apps/api/src/lib/dynamic-entity-route-factory.ts`
- [ ] Implement `createRoutes()` method
- [ ] Generate GET list endpoint
- [ ] Generate GET single endpoint
- [ ] Generate POST create endpoint
- [ ] Generate PUT update endpoint
- [ ] Generate DELETE soft-delete endpoint
- [ ] Add route tests

### Code Structure

```
apps/api/src/
├── lib/
│   ├── ddl-generator.ts              # SQL DDL generation
│   └── dynamic-entity-route-factory.ts  # Runtime route creation
│
└── modules/
    └── entity-builder/
        ├── routes.ts                 # HTTP endpoint handlers
        ├── service.ts                # Business logic orchestration
        ├── validator.ts              # Security and validation
        └── types.ts                  # TypeScript interfaces
```

### Database Requirements

**Prerequisite function:**
```sql
-- Entity instance registry trigger function
CREATE OR REPLACE FUNCTION app.fn_register_entity_instance()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO app.d_entity_instance_id (
        entity_type,
        entity_id,
        entity_code,
        entity_name,
        created_ts
    ) VALUES (
        TG_TABLE_NAME,
        NEW.id,
        NEW.code,
        NEW.name,
        now()
    )
    ON CONFLICT (entity_type, entity_id)
    DO UPDATE SET
        entity_code = EXCLUDED.entity_code,
        entity_name = EXCLUDED.entity_name;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## Testing

### Manual Testing with curl

#### 1. Preview DDL
```bash
curl -X POST http://localhost:4000/api/v1/entity-builder/preview \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_code": "test_entity",
    "entity_type": "attribute",
    "columns": [
      {
        "column_name": "test_field",
        "data_type": "text",
        "description": "Test field",
        "required": true,
        "order": 1
      }
    ],
    "parent_entities": [],
    "child_entities": [],
    "ui_icon": "FileText",
    "display_order": 999
  }'
```

#### 2. Create Entity
```bash
curl -X POST http://localhost:4000/api/v1/entity-builder/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_code": "test_entity",
    "entity_type": "attribute",
    "columns": [
      {
        "column_name": "test_field",
        "data_type": "text",
        "description": "Test field",
        "required": true,
        "order": 1
      }
    ],
    "parent_entities": [],
    "child_entities": [],
    "ui_icon": "FileText",
    "display_order": 999
  }'
```

#### 3. Test Created Entity
```bash
# List entities
curl -X GET http://localhost:4000/api/v1/test_entity \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create instance
curl -X POST http://localhost:4000/api/v1/test_entity \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "TEST-001",
    "name": "Test Instance",
    "test_field": "Test value"
  }'
```

### Automated Tests

```typescript
// apps/api/test/entity-builder.test.ts
import { describe, it, expect } from 'vitest';
import { build } from '../src/app';

describe('Entity Builder API', () => {
  it('should preview DDL for valid entity', async () => {
    const app = await build();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/entity-builder/preview',
      headers: {
        'Authorization': 'Bearer test_token',
        'Content-Type': 'application/json'
      },
      payload: {
        entity_code: 'test_entity',
        entity_type: 'attribute',
        columns: [
          {
            column_name: 'test_field',
            data_type: 'text',
            description: 'Test',
            required: true,
            order: 1
          }
        ],
        parent_entities: [],
        child_entities: [],
        ui_icon: 'FileText',
        display_order: 999
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('ddl');
    expect(response.json().ddl).toContain('CREATE TABLE');
  });

  it('should reject duplicate entity code', async () => {
    const app = await build();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/entity-builder/create',
      headers: {
        'Authorization': 'Bearer test_token',
        'Content-Type': 'application/json'
      },
      payload: {
        entity_code: 'project', // Already exists
        entity_type: 'attribute',
        columns: [],
        parent_entities: [],
        child_entities: [],
        ui_icon: 'FileText',
        display_order: 999
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe('DUPLICATE_ENTITY');
  });

  it('should reject SQL injection attempts', async () => {
    const app = await build();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/entity-builder/create',
      headers: {
        'Authorization': 'Bearer test_token',
        'Content-Type': 'application/json'
      },
      payload: {
        entity_code: 'test_entity',
        entity_type: 'attribute',
        columns: [
          {
            column_name: "'; DROP TABLE users--",
            data_type: 'text',
            description: 'Test',
            required: true,
            order: 1
          }
        ],
        parent_entities: [],
        child_entities: [],
        ui_icon: 'FileText',
        display_order: 999
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('SQL_INJECTION');
  });
});
```

---

## Security Checklist

Before deploying to production:

- [ ] All inputs validated (entity code, column names, descriptions)
- [ ] SQL injection prevention in place
- [ ] Reserved word checks implemented
- [ ] Authentication required (JWT tokens)
- [ ] Authorization checks (entity_builder.create permission)
- [ ] Transaction-based rollback on failure
- [ ] Error messages don't leak sensitive information
- [ ] Audit logging for entity creation
- [ ] Rate limiting on creation endpoint
- [ ] Entity code uniqueness verified

---

## Related Documentation

- [Architecture](./ARCHITECTURE.md) - System design and data flows
- [User Guide](./USER_GUIDE.md) - End user instructions
- [Component Reference](./COMPONENT_REFERENCE.md) - Frontend components
- [Implementation Status](./IMPLEMENTATION_STATUS.md) - Current progress

---

**Last Updated:** 2025-11-10
**Version:** 1.0 (Week 2 - Not Yet Implemented)
**Location:** `docs/entity_builder/BACKEND_API.md`
