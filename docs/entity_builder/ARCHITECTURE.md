# Dynamic Entity Builder - Architecture

> **Technical design and system architecture** for entity creation without code deployment

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Layers](#architecture-layers)
3. [Data Flow](#data-flow)
4. [Frontend Architecture](#frontend-architecture)
5. [Backend Architecture](#backend-architecture)
6. [Database Schema](#database-schema)
7. [Security & Validation](#security--validation)
8. [Error Handling](#error-handling)
9. [Performance Considerations](#performance-considerations)
10. [Design Decisions](#design-decisions)

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                      │
│                                                                 │
│  EntityDesignerPage                                            │
│  ├── EntityTypeSelector      (Attribute vs Transactional)     │
│  ├── ColumnEditor            (Custom column definitions)       │
│  ├── EntityLinkageEditor     (Parent-child relationships)      │
│  ├── IconDisplaySettings     (UI icon + display order)         │
│  └── DDLPreviewModal         (SQL preview before creation)     │
│                                                                 │
│  State: { entity_code, entity_type, columns, parents,         │
│           children, ui_icon, display_order }                   │
└─────────────────────────────────────────────────────────────────┘
                            ↓ HTTP POST
┌─────────────────────────────────────────────────────────────────┐
│                          API LAYER                              │
│                                                                 │
│  POST /api/v1/entity-builder/preview                           │
│  └─→ DDLGenerator.generatePreview(entityData)                  │
│      └─→ Returns: { ddl: string }                              │
│                                                                 │
│  POST /api/v1/entity-builder/create                            │
│  └─→ EntityBuilderService.createEntity(entityData)             │
│      ├─→ DDLGenerator.generate(entityData)                     │
│      ├─→ Validator.validate(entityData)                        │
│      ├─→ Database.executeTransaction()                         │
│      ├─→ DynamicRouteFactory.createRoutes(entityCode)          │
│      └─→ Returns: { success: true, entity_code }               │
└─────────────────────────────────────────────────────────────────┘
                            ↓ SQL Transaction
┌─────────────────────────────────────────────────────────────────┐
│                        DATABASE LAYER                           │
│                                                                 │
│  1. CREATE TABLE app.d_{entity_code} (...)                     │
│  2. CREATE INDEX idx_{entity_code}_code (...)                  │
│  3. CREATE TRIGGER tr_{entity_code}_registry (...)             │
│  4. INSERT INTO app.d_entity (code, name, ui_icon, ...)        │
│  5. UPDATE parent entities' child_entities JSONB               │
│                                                                 │
│  Rollback on any error ←─────────────────────────────────────┐ │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                       RUNTIME UPDATES                           │
│                                                                 │
│  • New API routes available: /api/v1/{entity_code}/*           │
│  • Entity appears in sidebar (via d_entity query)              │
│  • Frontend routes auto-generated: /{entity_code}/*            │
│  • Parent entities show new child tabs                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture Layers

### Layer 1: Presentation (Frontend)

**Technology:** React 19, TypeScript, Tailwind CSS
**Location:** `apps/web/src/`

**Components:**
- `EntityDesignerPage.tsx` - Main container with state management
- `EntityTypeSelector.tsx` - Entity type selection UI
- `ColumnEditor.tsx` - Column definition table with inline editing
- `EntityLinkageEditor.tsx` - Parent/child entity checkboxes
- `IconDisplaySettings.tsx` - Icon picker + display order
- `DDLPreviewModal.tsx` - SQL preview modal

**Responsibilities:**
- ✅ Collect user input
- ✅ Validate form data (client-side)
- ✅ Display preview
- ✅ Handle API requests/responses
- ❌ No business logic
- ❌ No SQL generation

### Layer 2: API (Backend)

**Technology:** Fastify v5, TypeScript (ESM), PostgreSQL client
**Location:** `apps/api/src/modules/entity-builder/`

**Modules:**
- `routes.ts` - HTTP endpoint handlers
- `service.ts` - Business logic orchestration
- `ddl-generator.ts` - SQL DDL generation
- `validator.ts` - Security and validation
- `dynamic-route-factory.ts` - Runtime route creation

**Responsibilities:**
- ✅ Validate request data
- ✅ Generate SQL DDL
- ✅ Execute database transactions
- ✅ Create dynamic API routes
- ✅ Security checks (SQL injection, reserved words)
- ❌ No UI rendering

### Layer 3: Database (PostgreSQL)

**Technology:** PostgreSQL 14+
**Location:** `db/` (DDL files)

**Tables Involved:**
- `app.d_entity` - Entity type registry
- `app.d_{entity_code}` - Dynamically created entity tables
- `app.d_entity_instance_id` - Entity instance registry
- `app.d_entity_id_map` - Parent-child linkages

**Responsibilities:**
- ✅ Store entity data
- ✅ Maintain referential integrity
- ✅ Trigger entity instance registration
- ✅ Index for performance
- ❌ No business logic in DB (use application layer)

---

## Data Flow

### Flow 1: Preview DDL

```
User clicks "Preview SQL"
  ↓
EntityDesignerPage validates form
  ↓
POST /api/v1/entity-builder/preview
  {
    entity_code: "training_certification",
    entity_type: "attribute",
    columns: [
      { column_name: "certification_type", data_type: "text", ... },
      { column_name: "expiry_date", data_type: "date", ... }
    ],
    parent_entities: ["employee"],
    child_entities: ["artifact", "wiki"],
    ui_icon: "Award",
    display_order: 110
  }
  ↓
DDLGenerator.generatePreview()
  ├─→ Add standard columns
  ├─→ Add custom columns
  ├─→ Generate indexes
  ├─→ Generate triggers
  └─→ Generate entity metadata INSERT
  ↓
Return DDL string
  ↓
DDLPreviewModal displays SQL
  ↓
User reviews and can copy
```

### Flow 2: Create Entity

```
User clicks "Create Entity"
  ↓
Confirmation dialog → User confirms
  ↓
POST /api/v1/entity-builder/create
  { ...same payload as preview }
  ↓
EntityBuilderService.createEntity()
  ├─→ Validator.validate(entityData)
  │   ├─→ Check SQL injection patterns
  │   ├─→ Check reserved words
  │   ├─→ Check entity code uniqueness
  │   └─→ Check column name validity
  │
  ├─→ DDLGenerator.generate(entityData)
  │   └─→ Same as preview, returns SQL statements
  │
  ├─→ BEGIN TRANSACTION
  │
  ├─→ Database.execute(createTableSQL)
  │   └─→ CREATE TABLE app.d_{entity_code}
  │
  ├─→ Database.execute(createIndexesSQL)
  │   └─→ CREATE INDEX idx_{entity_code}_*
  │
  ├─→ Database.execute(createTriggerSQL)
  │   └─→ CREATE TRIGGER tr_{entity_code}_registry
  │
  ├─→ Database.execute(insertEntityMetadata)
  │   └─→ INSERT INTO app.d_entity
  │
  ├─→ Database.execute(updateParentEntities)
  │   └─→ UPDATE parent entities' child_entities JSONB
  │
  ├─→ COMMIT TRANSACTION
  │
  ├─→ DynamicRouteFactory.createRoutes(entity_code)
  │   ├─→ GET /api/v1/{entity_code}
  │   ├─→ GET /api/v1/{entity_code}/:id
  │   ├─→ POST /api/v1/{entity_code}
  │   ├─→ PUT /api/v1/{entity_code}/:id
  │   └─→ DELETE /api/v1/{entity_code}/:id
  │
  └─→ Return success response
  ↓
Frontend receives success
  ↓
Show success message
  ↓
Redirect to new entity list page
```

### Flow 3: Using New Entity

```
User navigates to /{entity_code}
  ↓
Frontend queries d_entity for entity metadata
  ↓
EntityMainPage renders with entity config
  ↓
GET /api/v1/{entity_code}?page=1&limit=20
  ↓
Dynamic route handler (created by factory)
  ↓
Query: SELECT * FROM app.d_{entity_code}
        WHERE active_flag = true
        ORDER BY created_ts DESC
        LIMIT 20 OFFSET 0
  ↓
Return paginated results
  ↓
FilteredDataTable displays entities
```

---

## Frontend Architecture

### Component Hierarchy

```
EntityDesignerPage (Main Container)
│
├─ EntityTypeSelector
│  └─ Radio buttons: Attribute vs Transactional
│
├─ ColumnEditor
│  ├─ Standard Columns Table (read-only)
│  └─ Custom Columns Table
│     ├─ Add Column button
│     └─ Column rows (editable inline)
│        ├─ column_name input
│        ├─ data_type select
│        ├─ description input
│        ├─ required checkbox
│        └─ actions (edit/delete)
│
├─ EntityLinkageEditor
│  ├─ Available Entities (from API)
│  ├─ Parent Entities section
│  │  └─ Checkboxes (can be parent)
│  └─ Child Entities section
│     └─ Checkboxes (can be child)
│
├─ IconDisplaySettings
│  ├─ Current Icon Preview
│  ├─ Icon Picker (29 icons, categorized)
│  └─ Display Order input
│
└─ Action Buttons
   ├─ Preview SQL → opens DDLPreviewModal
   └─ Create Entity → confirmation → API call
```

### State Management

**Main State Object:**

```typescript
interface EntityDesignerData {
  entity_code: string;           // Unique entity identifier
  entity_type: 'attribute' | 'transactional';
  columns: ColumnDefinition[];   // Custom columns array
  parent_entities: string[];     // Array of parent entity codes
  child_entities: string[];      // Array of child entity codes
  ui_icon: string;               // Lucide icon name
  display_order: number;         // Sidebar display order
}

interface ColumnDefinition {
  id: string;                    // Frontend-only temp ID
  column_name: string;           // Database column name
  data_type: 'text' | 'number' | 'date' | 'boolean' | 'json';
  description: string;
  required: boolean;
  order: number;
}
```

**State Updates:**

```typescript
// Entity type change
const handleEntityTypeChange = (type: 'attribute' | 'transactional') => {
  setEntityData(prev => ({ ...prev, entity_type: type }));
};

// Column changes
const handleColumnsChange = (columns: ColumnDefinition[]) => {
  setEntityData(prev => ({ ...prev, columns }));
};

// Parent entities change
const handleParentEntitiesChange = (parents: string[]) => {
  setEntityData(prev => ({ ...prev, parent_entities: parents }));
};

// Child entities change
const handleChildEntitiesChange = (children: string[]) => {
  setEntityData(prev => ({ ...prev, child_entities: children }));
};

// Icon change
const handleIconChange = (icon: string) => {
  setEntityData(prev => ({ ...prev, ui_icon: icon }));
};

// Display order change
const handleDisplayOrderChange = (order: number) => {
  setEntityData(prev => ({ ...prev, display_order: order }));
};
```

### API Integration

```typescript
// Preview DDL
const handlePreviewDDL = async () => {
  const response = await fetch('/api/v1/entity-builder/preview', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(entityData),
  });

  const { ddl } = await response.json();
  setDdlPreview(ddl);
  setShowPreviewModal(true);
};

// Create entity
const handleCreateEntity = async () => {
  // Validation
  if (!entityData.entity_code) {
    alert('Entity code is required');
    return;
  }

  if (entityData.columns.length === 0) {
    alert('At least one custom column is required');
    return;
  }

  // Confirmation
  if (!confirm('Create entity? This cannot be easily undone.')) {
    return;
  }

  // API call
  const response = await fetch('/api/v1/entity-builder/create', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(entityData),
  });

  if (response.ok) {
    const { entity_code } = await response.json();
    navigate(`/${entity_code}`);
  } else {
    const error = await response.json();
    alert(`Error: ${error.message}`);
  }
};
```

---

## Backend Architecture

### Module Structure

```
apps/api/src/modules/entity-builder/
├── routes.ts                 # HTTP endpoint definitions
├── service.ts                # Business logic orchestration
├── validator.ts              # Security and validation
└── types.ts                  # TypeScript interfaces

apps/api/src/lib/
├── ddl-generator.ts          # SQL DDL generation
└── dynamic-entity-route-factory.ts  # Runtime route creation
```

### DDL Generator

**Purpose:** Generate SQL DDL from entity definition

**File:** `apps/api/src/lib/ddl-generator.ts`

```typescript
interface EntityDefinition {
  entity_code: string;
  entity_type: 'attribute' | 'transactional';
  columns: ColumnDefinition[];
  parent_entities: string[];
  child_entities: string[];
  ui_icon: string;
  display_order: number;
}

class DDLGenerator {
  /**
   * Generate CREATE TABLE statement
   */
  generateTable(entity: EntityDefinition): string {
    const tableName = `app.d_${entity.entity_code}`;

    const standardColumns = `
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      code VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
    `;

    const customColumns = entity.columns.map(col => {
      const type = this.mapDataType(col.data_type);
      const notNull = col.required ? ' NOT NULL' : '';
      return `  ${col.column_name} ${type}${notNull}`;
    }).join(',\n');

    const auditColumns = `
      active_flag BOOLEAN DEFAULT true,
      created_ts TIMESTAMP DEFAULT now(),
      updated_ts TIMESTAMP DEFAULT now(),
      created_by_id UUID REFERENCES app.d_employee(id),
      updated_by_id UUID REFERENCES app.d_employee(id)
    `;

    return `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${standardColumns}
        ${customColumns},
        ${auditColumns}
      );
    `;
  }

  /**
   * Generate indexes
   */
  generateIndexes(entity: EntityDefinition): string[] {
    const tableName = `app.d_${entity.entity_code}`;

    return [
      `CREATE INDEX idx_${entity.entity_code}_code ON ${tableName}(code);`,
      `CREATE INDEX idx_${entity.entity_code}_active ON ${tableName}(active_flag);`,
      `CREATE INDEX idx_${entity.entity_code}_created ON ${tableName}(created_ts);`,
    ];
  }

  /**
   * Generate trigger for entity instance registry
   */
  generateTrigger(entity: EntityDefinition): string {
    const tableName = `app.d_${entity.entity_code}`;

    return `
      CREATE TRIGGER tr_${entity.entity_code}_registry
        AFTER INSERT OR UPDATE ON ${tableName}
        FOR EACH ROW
        EXECUTE FUNCTION app.fn_register_entity_instance();
    `;
  }

  /**
   * Generate d_entity metadata INSERT
   */
  generateMetadataInsert(entity: EntityDefinition): string {
    const childEntities = entity.child_entities.map((code, index) => ({
      entity: code,
      ui_icon: this.getEntityIcon(code), // Query from d_entity
      ui_label: this.getEntityLabel(code),
      order: index + 1
    }));

    return `
      INSERT INTO app.d_entity (
        code, name, ui_label, ui_icon, display_order, child_entities, active_flag
      ) VALUES (
        '${entity.entity_code}',
        '${this.toTitleCase(entity.entity_code)}',
        '${this.toPlural(this.toTitleCase(entity.entity_code))}',
        '${entity.ui_icon}',
        ${entity.display_order},
        '${JSON.stringify(childEntities)}'::jsonb,
        true
      );
    `;
  }

  /**
   * Map frontend data types to PostgreSQL types
   */
  private mapDataType(type: string): string {
    const mapping = {
      'text': 'VARCHAR(255)',
      'number': 'INTEGER',
      'date': 'TIMESTAMP',
      'boolean': 'BOOLEAN',
      'json': 'JSONB'
    };
    return mapping[type] || 'VARCHAR(255)';
  }

  /**
   * Generate complete DDL (all statements)
   */
  generate(entity: EntityDefinition): string {
    const statements = [
      this.generateTable(entity),
      ...this.generateIndexes(entity),
      this.generateTrigger(entity),
      this.generateMetadataInsert(entity),
    ];

    return statements.join('\n\n');
  }
}
```

### Validator

**Purpose:** Security and data validation

**File:** `apps/api/src/modules/entity-builder/validator.ts`

```typescript
class EntityBuilderValidator {
  /**
   * Validate entity code
   */
  validateEntityCode(code: string): ValidationResult {
    // Must be lowercase with underscores
    if (!/^[a-z][a-z0-9_]*$/.test(code)) {
      return { valid: false, error: 'Entity code must be lowercase with underscores' };
    }

    // Max 50 characters
    if (code.length > 50) {
      return { valid: false, error: 'Entity code max 50 characters' };
    }

    // Check SQL reserved words
    const reservedWords = ['select', 'insert', 'update', 'delete', 'table', 'from', 'where'];
    if (reservedWords.includes(code)) {
      return { valid: false, error: 'Entity code cannot be SQL reserved word' };
    }

    // Check uniqueness (query d_entity)
    const exists = await this.db.query(
      'SELECT code FROM app.d_entity WHERE code = $1',
      [code]
    );
    if (exists.rowCount > 0) {
      return { valid: false, error: 'Entity code already exists' };
    }

    return { valid: true };
  }

  /**
   * Validate column names
   */
  validateColumns(columns: ColumnDefinition[]): ValidationResult {
    const standardColumns = ['id', 'code', 'name', 'description', 'active_flag',
                             'created_ts', 'updated_ts', 'created_by_id', 'updated_by_id'];

    for (const col of columns) {
      // Check naming convention
      if (!/^[a-z][a-z0-9_]*$/.test(col.column_name)) {
        return { valid: false, error: `Invalid column name: ${col.column_name}` };
      }

      // Check conflicts with standard columns
      if (standardColumns.includes(col.column_name)) {
        return { valid: false, error: `Column name conflicts with standard column: ${col.column_name}` };
      }

      // Check SQL injection patterns
      if (this.containsSQLInjection(col.column_name) ||
          this.containsSQLInjection(col.description)) {
        return { valid: false, error: 'SQL injection attempt detected' };
      }
    }

    // Check for duplicate column names
    const names = columns.map(c => c.column_name);
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    if (duplicates.length > 0) {
      return { valid: false, error: `Duplicate column names: ${duplicates.join(', ')}` };
    }

    return { valid: true };
  }

  /**
   * SQL injection detection
   */
  private containsSQLInjection(value: string): boolean {
    const patterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
      /(--|\/\*|\*\/|;|'|")/,
      /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/i,
    ];

    return patterns.some(pattern => pattern.test(value));
  }

  /**
   * Validate full entity definition
   */
  async validate(entity: EntityDefinition): Promise<ValidationResult> {
    // Validate entity code
    const codeResult = await this.validateEntityCode(entity.entity_code);
    if (!codeResult.valid) return codeResult;

    // Validate columns
    const columnsResult = this.validateColumns(entity.columns);
    if (!columnsResult.valid) return columnsResult;

    // Validate parent/child entities exist
    for (const parent of entity.parent_entities) {
      const exists = await this.entityExists(parent);
      if (!exists) {
        return { valid: false, error: `Parent entity not found: ${parent}` };
      }
    }

    for (const child of entity.child_entities) {
      const exists = await this.entityExists(child);
      if (!exists) {
        return { valid: false, error: `Child entity not found: ${child}` };
      }
    }

    return { valid: true };
  }
}
```

### Dynamic Route Factory

**Purpose:** Programmatically create CRUD endpoints for new entities

**File:** `apps/api/src/lib/dynamic-entity-route-factory.ts`

```typescript
class DynamicEntityRouteFactory {
  /**
   * Create full CRUD routes for entity
   */
  createRoutes(fastify: FastifyInstance, entityCode: string) {
    const tableName = `app.d_${entityCode}`;

    // GET /{entity_code} - List entities
    fastify.get(`/api/v1/${entityCode}`, {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', default: 1 },
            limit: { type: 'integer', default: 20 },
            search: { type: 'string' },
          }
        }
      },
      preHandler: [fastify.authenticate, fastify.checkEntityPermission(entityCode, 'read')]
    }, async (request, reply) => {
      const { page, limit, search } = request.query;
      const offset = (page - 1) * limit;

      let query = `
        SELECT * FROM ${tableName}
        WHERE active_flag = true
      `;

      if (search) {
        query += ` AND (name ILIKE '%${search}%' OR code ILIKE '%${search}%')`;
      }

      query += ` ORDER BY created_ts DESC LIMIT $1 OFFSET $2`;

      const result = await fastify.pg.query(query, [limit, offset]);
      const countResult = await fastify.pg.query(
        `SELECT COUNT(*) FROM ${tableName} WHERE active_flag = true`
      );

      return {
        data: result.rows,
        total: parseInt(countResult.rows[0].count),
        page,
        limit
      };
    });

    // GET /{entity_code}/:id - Get single entity
    fastify.get(`/api/v1/${entityCode}/:id`, {
      preHandler: [fastify.authenticate, fastify.checkEntityPermission(entityCode, 'read')]
    }, async (request, reply) => {
      const { id } = request.params;

      const result = await fastify.pg.query(
        `SELECT * FROM ${tableName} WHERE id = $1 AND active_flag = true`,
        [id]
      );

      if (result.rowCount === 0) {
        return reply.code(404).send({ error: 'Entity not found' });
      }

      return result.rows[0];
    });

    // POST /{entity_code} - Create entity
    fastify.post(`/api/v1/${entityCode}`, {
      preHandler: [fastify.authenticate, fastify.checkEntityPermission(entityCode, 'create')]
    }, async (request, reply) => {
      const data = request.body;
      const userId = request.user.id;

      // Build INSERT query dynamically
      const columns = Object.keys(data).join(', ');
      const values = Object.values(data);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

      const query = `
        INSERT INTO ${tableName} (${columns}, created_by_id, updated_by_id)
        VALUES (${placeholders}, $${values.length + 1}, $${values.length + 2})
        RETURNING *
      `;

      const result = await fastify.pg.query(query, [...values, userId, userId]);
      return result.rows[0];
    });

    // PUT /{entity_code}/:id - Update entity
    fastify.put(`/api/v1/${entityCode}/:id`, {
      preHandler: [fastify.authenticate, fastify.checkEntityPermission(entityCode, 'update')]
    }, async (request, reply) => {
      const { id } = request.params;
      const data = request.body;
      const userId = request.user.id;

      // Build UPDATE query dynamically
      const updates = Object.keys(data)
        .map((key, i) => `${key} = $${i + 1}`)
        .join(', ');

      const query = `
        UPDATE ${tableName}
        SET ${updates}, updated_by_id = $${Object.keys(data).length + 1}, updated_ts = now()
        WHERE id = $${Object.keys(data).length + 2}
        AND active_flag = true
        RETURNING *
      `;

      const result = await fastify.pg.query(query, [...Object.values(data), userId, id]);

      if (result.rowCount === 0) {
        return reply.code(404).send({ error: 'Entity not found' });
      }

      return result.rows[0];
    });

    // DELETE /{entity_code}/:id - Soft delete entity
    fastify.delete(`/api/v1/${entityCode}/:id`, {
      preHandler: [fastify.authenticate, fastify.checkEntityPermission(entityCode, 'delete')]
    }, async (request, reply) => {
      const { id } = request.params;

      const result = await fastify.pg.query(
        `UPDATE ${tableName}
         SET active_flag = false, updated_ts = now()
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      if (result.rowCount === 0) {
        return reply.code(404).send({ error: 'Entity not found' });
      }

      return { success: true };
    });

    fastify.log.info(`Created dynamic routes for entity: ${entityCode}`);
  }
}
```

---

## Database Schema

### Entity Registry (`app.d_entity`)

```sql
CREATE TABLE app.d_entity (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100),
    ui_label VARCHAR(100),
    ui_icon VARCHAR(50),
    child_entities JSONB,
    display_order INT4,
    active_flag BOOLEAN DEFAULT true,
    created_ts TIMESTAMP DEFAULT now(),
    updated_ts TIMESTAMP DEFAULT now()
);

-- Example row after entity creation
INSERT INTO app.d_entity VALUES (
    'training_certification',
    'Training Certification',
    'Training Certifications',
    'Award',
    '[
      {"entity":"artifact","ui_icon":"FileText","ui_label":"Artifacts","order":1},
      {"entity":"wiki","ui_icon":"BookOpen","ui_label":"Wiki","order":2}
    ]'::jsonb,
    110,
    true,
    now(),
    now()
);
```

### Dynamically Created Entity Table

```sql
CREATE TABLE app.d_training_certification (
    -- Standard columns (always included)
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Custom columns (defined by user)
    certification_type VARCHAR(255) NOT NULL,
    expiry_date TIMESTAMP NOT NULL,
    issuing_authority VARCHAR(255),
    certificate_number VARCHAR(255),
    training_hours INTEGER,
    notes JSONB,

    -- Audit columns (always included)
    active_flag BOOLEAN DEFAULT true,
    created_ts TIMESTAMP DEFAULT now(),
    updated_ts TIMESTAMP DEFAULT now(),
    created_by_id UUID REFERENCES app.d_employee(id),
    updated_by_id UUID REFERENCES app.d_employee(id)
);

-- Indexes
CREATE INDEX idx_training_certification_code ON app.d_training_certification(code);
CREATE INDEX idx_training_certification_active ON app.d_training_certification(active_flag);
CREATE INDEX idx_training_certification_created ON app.d_training_certification(created_ts);

-- Trigger for entity instance registry
CREATE TRIGGER tr_training_certification_registry
    AFTER INSERT OR UPDATE ON app.d_training_certification
    FOR EACH ROW
    EXECUTE FUNCTION app.fn_register_entity_instance();
```

### Entity Instance Registry (`app.d_entity_instance_id`)

```sql
CREATE TABLE app.d_entity_instance_id (
    entity_type VARCHAR(50) REFERENCES app.d_entity(code),
    entity_id UUID,
    entity_code VARCHAR(50),
    entity_name VARCHAR(255),
    created_ts TIMESTAMP DEFAULT now(),
    PRIMARY KEY (entity_type, entity_id)
);

-- Automatically populated via trigger
-- Example row:
INSERT INTO app.d_entity_instance_id VALUES (
    'training_certification',
    'uuid-123-456',
    'CERT-2025-001',
    'First Aid Training',
    now()
);
```

---

## Security & Validation

### SQL Injection Prevention

**1. Parameterized Queries:**
```typescript
// ✅ GOOD: Parameterized
await db.query('SELECT * FROM d_entity WHERE code = $1', [userInput]);

// ❌ BAD: String concatenation
await db.query(`SELECT * FROM d_entity WHERE code = '${userInput}'`);
```

**2. Input Validation:**
```typescript
// Check for SQL keywords and special characters
const sqlPatterns = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b)/i,
  /(--|\/\*|\*\/|;|'|")/,
];

if (sqlPatterns.some(pattern => pattern.test(userInput))) {
  throw new Error('Invalid input');
}
```

**3. Reserved Word Checks:**
```typescript
const reservedWords = [
  'select', 'insert', 'update', 'delete', 'drop', 'create', 'alter',
  'table', 'from', 'where', 'join', 'union', 'group', 'having', 'order'
];

if (reservedWords.includes(entityCode.toLowerCase())) {
  throw new Error('Entity code cannot be SQL reserved word');
}
```

### Authorization

**RBAC Checks:**
```typescript
// Check user has permission to create entities
fastify.addHook('preHandler', async (request, reply) => {
  const user = request.user;
  const hasPermission = await checkPermission(user.id, 'entity_builder', 'create');

  if (!hasPermission) {
    return reply.code(403).send({ error: 'Insufficient permissions' });
  }
});
```

### Transaction Safety

**Rollback on Failure:**
```typescript
const client = await fastify.pg.connect();

try {
  await client.query('BEGIN');

  // Step 1: Create table
  await client.query(createTableSQL);

  // Step 2: Create indexes
  await client.query(createIndexesSQL);

  // Step 3: Create trigger
  await client.query(createTriggerSQL);

  // Step 4: Insert metadata
  await client.query(insertMetadataSQL);

  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

---

## Error Handling

### Frontend Error Handling

```typescript
try {
  const response = await fetch('/api/v1/entity-builder/create', {
    method: 'POST',
    body: JSON.stringify(entityData),
  });

  if (!response.ok) {
    const error = await response.json();

    // Show user-friendly error message
    if (error.code === 'DUPLICATE_ENTITY') {
      alert('Entity with this code already exists. Please choose a different code.');
    } else if (error.code === 'INVALID_COLUMN_NAME') {
      alert(`Invalid column name: ${error.details.column_name}`);
    } else {
      alert(`Error creating entity: ${error.message}`);
    }

    return;
  }

  // Success handling
  const result = await response.json();
  navigate(`/${result.entity_code}`);

} catch (error) {
  console.error('Entity creation failed:', error);
  alert('Network error. Please try again.');
}
```

### Backend Error Responses

```typescript
// Standard error response format
interface ErrorResponse {
  error: string;           // User-friendly message
  code: string;            // Machine-readable code
  details?: any;           // Additional error details
  timestamp: string;       // ISO 8601 timestamp
}

// Example error handlers
try {
  // Validation error
  if (!validation.valid) {
    return reply.code(400).send({
      error: validation.error,
      code: 'VALIDATION_ERROR',
      details: { field: 'entity_code' },
      timestamp: new Date().toISOString()
    });
  }

  // Duplicate entity
  if (entityExists) {
    return reply.code(409).send({
      error: 'Entity already exists',
      code: 'DUPLICATE_ENTITY',
      details: { entity_code },
      timestamp: new Date().toISOString()
    });
  }

  // Database error
  await createEntity(entityData);

} catch (error) {
  fastify.log.error(error);

  return reply.code(500).send({
    error: 'Failed to create entity',
    code: 'CREATION_ERROR',
    details: { message: error.message },
    timestamp: new Date().toISOString()
  });
}
```

---

## Performance Considerations

### Database Indexes

**Automatically created indexes:**
```sql
-- Code lookup (unique, frequent queries)
CREATE INDEX idx_{entity_code}_code ON app.d_{entity_code}(code);

-- Active flag (filtering soft-deleted records)
CREATE INDEX idx_{entity_code}_active ON app.d_{entity_code}(active_flag);

-- Created timestamp (sorting, pagination)
CREATE INDEX idx_{entity_code}_created ON app.d_{entity_code}(created_ts DESC);
```

**Additional indexes for custom columns:**
- Date columns (for range queries)
- Foreign key columns (for joins)
- Frequently filtered columns

### API Route Caching

**Entity metadata caching:**
```typescript
// Cache entity list (rarely changes)
const entityCache = new Map<string, EntityMetadata>();

async function getEntityMetadata(code: string): Promise<EntityMetadata> {
  // Check cache first
  if (entityCache.has(code)) {
    return entityCache.get(code);
  }

  // Query database
  const result = await db.query(
    'SELECT * FROM app.d_entity WHERE code = $1',
    [code]
  );

  // Cache result (15 minute TTL)
  const metadata = result.rows[0];
  entityCache.set(code, metadata);
  setTimeout(() => entityCache.delete(code), 15 * 60 * 1000);

  return metadata;
}
```

### Pagination

**Always paginate list queries:**
```typescript
// ✅ GOOD: Paginated
GET /api/v1/training_certification?page=1&limit=20

// ❌ BAD: Unbounded
GET /api/v1/training_certification (returns all records)
```

---

## Design Decisions

### Decision 1: User-Friendly Terminology

**Problem:** "Fact" and "Dimension" are technical data warehouse terms unfamiliar to business users.

**Solution:** Use "Transactional" and "Attribute-based" instead.

**Rationale:**
- More intuitive for non-technical users
- Describes purpose rather than technical classification
- Reduces learning curve

### Decision 2: JSON for Child Entities

**Problem:** How to store which entities can be children?

**Options:**
1. Separate linkage table (`d_entity_relationships`)
2. JSONB column in `d_entity` table

**Solution:** JSONB column (`child_entities`)

**Rationale:**
- Single query to get entity + children
- Easier to update (no JOIN required)
- Supports ordering and metadata per child
- JSONB indexing available if needed

### Decision 3: Dynamic Routes vs Restart

**Problem:** How to make new routes available without restarting server?

**Options:**
1. Restart API server after entity creation
2. Create routes dynamically at runtime

**Solution:** Dynamic route creation

**Rationale:**
- Zero downtime
- Instant availability
- Better user experience
- Scalable (no restart overhead)

### Decision 4: Soft Delete Only

**Problem:** What happens when user "deletes" an entity?

**Options:**
1. Hard delete (DROP TABLE)
2. Soft delete (active_flag = false)

**Solution:** Soft delete only

**Rationale:**
- Data safety (accidental deletions)
- Audit trail preserved
- Related data remains intact
- Can be "undeleted" if needed

### Decision 5: Transaction-Based Creation

**Problem:** What if entity creation fails halfway?

**Options:**
1. Best effort (some steps succeed, some fail)
2. All-or-nothing transaction

**Solution:** PostgreSQL transaction with rollback

**Rationale:**
- Database consistency guaranteed
- No partial entities
- Clean error recovery
- Industry best practice

---

## Related Documentation

- [User Guide](./USER_GUIDE.md) - How to use entity builder
- [Component Reference](./COMPONENT_REFERENCE.md) - Frontend component docs
- [Backend API](./BACKEND_API.md) - API endpoint specs
- [Implementation Status](./IMPLEMENTATION_STATUS.md) - Current progress

---

**Last Updated:** 2025-11-10
**Version:** 1.0
