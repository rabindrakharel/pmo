# Dynamic Entity Builder System

> **User-driven entity creation with visual database designer** - No-code entity table creation with automatic API and UI generation

**Status:** 🚧 **Planning Phase**
**Target:** v3.2.0
**Impact:** Allows users to create custom entities without code deployment

---

## 1. Semantics & Business Context

### Problem Statement

Currently, adding a new entity type requires:
1. Writing DDL file manually
2. Creating API module with routes and service
3. Adding entity config to frontend
4. Running database import
5. Restarting services

**Users cannot create custom entities without developer intervention.**

### Solution

A **Dynamic Entity Builder** that allows users to:
- Create new entity types through the UI
- Design database schema visually (columns, types, relationships)
- Automatically generate database tables, API routes, and UI
- Link entities as parent-child relationships
- Choose icons and display settings

### User Flow

```
1. Settings → Entity Table → Click "Add Entity" button
   ↓
2. Fill basic info: code, name, ui_label, ui_icon
   ↓
3. System creates entry in d_entity table
   ↓
4. Route user to "Entity Database Designer" page
   ↓
5. User designs table schema:
   - Choose entity type (Attribute-based or Transactional)
   - Add columns (name, type, description, order)
   - Choose parent entities
   - Choose child entities
   ↓
6. Click "Create Entity" button
   ↓
7. Backend:
   - Generates DDL for table
   - Executes CREATE TABLE statement
   - Creates API routes dynamically
   - Updates d_entity table
   - Updates d_entity_id_map for relationships
   ↓
8. User can immediately use the new entity
   - Appears in sidebar
   - Has CRUD operations
   - Can link to other entities
```

---

## 2. System Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ SettingsOverviewPage.tsx                                 │  │
│  │ - Entity table with "Add Entity" button                  │  │
│  │ - Creates basic entity entry in d_entity                 │  │
│  │ - Routes to /entity-designer/:code                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ EntityDesignerPage.tsx (NEW)                             │  │
│  │ ┌────────────────────────────────────────────────────┐   │  │
│  │ │ 1. Entity Type Selector                            │   │  │
│  │ │    [ ] Attribute-based (stores properties)         │   │  │
│  │ │    [ ] Transactional (stores events/values)        │   │  │
│  │ └────────────────────────────────────────────────────┘   │  │
│  │                                                            │  │
│  │ ┌────────────────────────────────────────────────────┐   │  │
│  │ │ 2. Column Designer (reusable DataTable)            │   │  │
│  │ │    | Column Name | Data Type | Description | Order│   │  │
│  │ │    | name        | text      | Entity name  | 1   │   │  │
│  │ │    | code        | text      | Unique code  | 2   │   │  │
│  │ │    | qty         | number    | Quantity     | 3   │   │  │
│  │ │    [+ Add Column]                                  │   │  │
│  │ └────────────────────────────────────────────────────┘   │  │
│  │                                                            │  │
│  │ ┌────────────────────────────────────────────────────┐   │  │
│  │ │ 3. Entity Linkage Editor                           │   │  │
│  │ │    Parent Entities:  [ ] project [ ] customer      │   │  │
│  │ │    Child Entities:   [x] task    [x] artifact      │   │  │
│  │ └────────────────────────────────────────────────────┘   │  │
│  │                                                            │  │
│  │ ┌────────────────────────────────────────────────────┐   │  │
│  │ │ 4. Icon & Display Settings                         │   │  │
│  │ │    Icon: [📦 Package ▼]                            │   │  │
│  │ │    Display Order: [150]                            │   │  │
│  │ └────────────────────────────────────────────────────┘   │  │
│  │                                                            │  │
│  │ [Preview DDL] [Cancel] [Create Entity]                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            ▼ POST /api/v1/entity-builder/create
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Fastify)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ /api/v1/entity-builder/create                            │  │
│  │ ┌────────────────────────────────────────────────────┐   │  │
│  │ │ 1. Validate Schema                                 │   │  │
│  │ │    - Check entity code uniqueness                  │   │  │
│  │ │    - Validate column names/types                   │   │  │
│  │ │    - Check for SQL injection risks                 │   │  │
│  │ └────────────────────────────────────────────────────┘   │  │
│  │                                                            │  │
│  │ ┌────────────────────────────────────────────────────┐   │  │
│  │ │ 2. Generate DDL                                    │   │  │
│  │ │    CREATE TABLE app.d_custom_entity (             │   │  │
│  │ │      id uuid PRIMARY KEY,                         │   │  │
│  │ │      code varchar(50) UNIQUE,                     │   │  │
│  │ │      name text,                                   │   │  │
│  │ │      ...user columns...,                          │   │  │
│  │ │      metadata jsonb,                              │   │  │
│  │ │      active_flag boolean,                         │   │  │
│  │ │      created_ts timestamptz,                      │   │  │
│  │ │      version integer                              │   │  │
│  │ │    );                                             │   │  │
│  │ └────────────────────────────────────────────────────┘   │  │
│  │                                                            │  │
│  │ ┌────────────────────────────────────────────────────┐   │  │
│  │ │ 3. Execute DDL (db.execute(sql`...`))             │   │  │
│  │ └────────────────────────────────────────────────────┘   │  │
│  │                                                            │  │
│  │ ┌────────────────────────────────────────────────────┐   │  │
│  │ │ 4. Register Entity Instance Registry               │   │  │
│  │ │    INSERT INTO d_entity_instance_id ...           │   │  │
│  │ └────────────────────────────────────────────────────┘   │  │
│  │                                                            │  │
│  │ ┌────────────────────────────────────────────────────┐   │  │
│  │ │ 5. Create Dynamic API Routes (Factory Pattern)     │   │  │
│  │ │    GET    /api/v1/custom_entity (list)            │   │  │
│  │ │    GET    /api/v1/custom_entity/:id (get)         │   │  │
│  │ │    POST   /api/v1/custom_entity (create)          │   │  │
│  │ │    PUT    /api/v1/custom_entity/:id (update)      │   │  │
│  │ │    DELETE /api/v1/custom_entity/:id (delete)      │   │  │
│  │ └────────────────────────────────────────────────────┘   │  │
│  │                                                            │  │
│  │ ┌────────────────────────────────────────────────────┐   │  │
│  │ │ 6. Update d_entity Table                           │   │  │
│  │ │    - Set child_entities JSONB                     │   │  │
│  │ │    - Update parent entities' child_entities       │   │  │
│  │ └────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE (PostgreSQL)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  app.d_custom_entity (NEW TABLE)                               │
│  app.d_entity (UPDATED with metadata)                          │
│  app.d_entity_instance_id (NEW trigger for entity registry)    │
│  app.d_entity_id_map (UPDATED for parent-child links)          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Entity Type Classification

### User-Friendly Entity Types

Instead of "Fact" and "Dimension", use:

| User Sees | Technical Term | Description | Examples |
|-----------|---------------|-------------|----------|
| **Attribute-based** | Dimension | Stores properties/characteristics that rarely change | Customer, Product, Employee, Office |
| **Transactional** | Fact | Stores events, measurements, transactions over time | Order, Invoice, Task, Booking |

### Attribute-based Entities

**Characteristics:**
- Store descriptive attributes
- Change slowly over time
- Used for categorization/filtering
- Referenced by transactional entities

**Auto-included columns:**
```sql
id uuid PRIMARY KEY
code varchar(50) UNIQUE
name text
descr text
metadata jsonb
active_flag boolean DEFAULT true
from_ts timestamptz DEFAULT now()
to_ts timestamptz
created_ts timestamptz DEFAULT now()
updated_ts timestamptz DEFAULT now()
version integer DEFAULT 1
```

**User adds:** Custom attributes (e.g., `category`, `brand`, `location`)

### Transactional Entities

**Characteristics:**
- Store events/transactions
- Grow rapidly over time
- Immutable once created (version controlled)
- Reference attribute-based entities

**Auto-included columns:**
```sql
id uuid PRIMARY KEY
code varchar(50) UNIQUE
name text
descr text
-- Foreign key references (via d_entity_id_map)
-- Measurement columns (user-defined)
transaction_date date
amount_value numeric
metadata jsonb
active_flag boolean DEFAULT true
created_ts timestamptz DEFAULT now()
updated_ts timestamptz DEFAULT now()
version integer DEFAULT 1
```

**User adds:** Measurement columns (e.g., `quantity`, `amount`, `duration`)

---

## 4. UI Component Design

### EntityDesignerPage Component

**Location:** `/apps/web/src/pages/setting/EntityDesignerPage.tsx`

**Route:** `/entity-designer/:entityCode`

**Sections:**

#### Section 1: Entity Type Selector

```tsx
<div className="section">
  <h3>What type of information will this entity store?</h3>

  <RadioGroup value={entityType} onChange={setEntityType}>
    <Radio value="attribute">
      <strong>Attribute-based</strong>
      <p>Stores properties and characteristics (e.g., Customer, Product, Employee)</p>
      <ul>
        <li>Changes rarely</li>
        <li>Used for categorization</li>
        <li>Referenced by other entities</li>
      </ul>
    </Radio>

    <Radio value="transactional">
      <strong>Transactional</strong>
      <p>Stores events, transactions, measurements (e.g., Order, Invoice, Booking)</p>
      <ul>
        <li>Grows over time</li>
        <li>Tracks values and quantities</li>
        <li>References attribute-based entities</li>
      </ul>
    </Radio>
  </RadioGroup>
</div>
```

#### Section 2: Column Designer

**Reuse:** `FilteredDataTable` component (same as settings data labels)

```tsx
<div className="section">
  <h3>Define Columns</h3>
  <p>Standard columns (id, code, name, created_ts) are included automatically</p>

  <FilteredDataTable
    data={columns}
    columns={[
      { key: 'column_name', title: 'Column Name', editable: true },
      { key: 'data_type', title: 'Data Type', editable: true, type: 'select',
        options: ['text', 'number', 'date', 'boolean', 'json'] },
      { key: 'description', title: 'Description', editable: true },
      { key: 'order', title: 'Order', editable: true, type: 'number' },
      { key: 'required', title: 'Required', editable: true, type: 'boolean' }
    ]}
    onRowAdd={handleAddColumn}
    onRowUpdate={handleUpdateColumn}
    onRowDelete={handleDeleteColumn}
  />

  <button onClick={handleAddColumn}>+ Add Column</button>
</div>
```

#### Section 3: Entity Linkage Editor

```tsx
<div className="section">
  <h3>Entity Relationships</h3>

  <div className="subsection">
    <h4>Parent Entities (this entity belongs to)</h4>
    <CheckboxGroup value={parentEntities} onChange={setParentEntities}>
      {availableEntities.map(entity => (
        <Checkbox key={entity.code} value={entity.code}>
          <Icon name={entity.ui_icon} /> {entity.name}
        </Checkbox>
      ))}
    </CheckboxGroup>
  </div>

  <div className="subsection">
    <h4>Child Entities (can be linked to this entity)</h4>
    <CheckboxGroup value={childEntities} onChange={setChildEntities}>
      {availableEntities.map(entity => (
        <Checkbox key={entity.code} value={entity.code}>
          <Icon name={entity.ui_icon} /> {entity.name}
        </Checkbox>
      ))}
    </CheckboxGroup>
  </div>
</div>
```

#### Section 4: Icon & Display Settings

```tsx
<div className="section">
  <h3>Display Settings</h3>

  <div className="field">
    <label>Icon</label>
    <IconPicker value={iconName} onChange={setIconName} />
  </div>

  <div className="field">
    <label>Display Order (sidebar position)</label>
    <input type="number" value={displayOrder} onChange={e => setDisplayOrder(e.target.value)} />
  </div>
</div>
```

#### Action Buttons

```tsx
<div className="actions">
  <button onClick={handlePreviewDDL}>Preview SQL</button>
  <button onClick={handleCancel}>Cancel</button>
  <button onClick={handleCreateEntity} className="primary">Create Entity</button>
</div>
```

---

## 5. Backend API Design

### Endpoint: POST /api/v1/entity-builder/create

**Request Body:**
```typescript
{
  entity_code: string;           // e.g., 'custom_widget'
  entity_type: 'attribute' | 'transactional';
  columns: Array<{
    column_name: string;
    data_type: 'text' | 'number' | 'date' | 'boolean' | 'json';
    description?: string;
    required?: boolean;
    order: number;
  }>;
  parent_entities: string[];     // e.g., ['project', 'customer']
  child_entities: string[];      // e.g., ['task', 'artifact']
  ui_icon: string;               // e.g., 'Package'
  display_order: number;         // e.g., 250
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
  data: {
    entity_code: string;
    table_name: string;           // e.g., 'd_custom_widget'
    ddl: string;                  // Generated DDL for preview
    api_endpoints: string[];      // Created endpoints
  }
}
```

### DDL Generation Logic

**File:** `/apps/api/src/lib/ddl-generator.ts`

```typescript
export function generateEntityDDL(config: EntityBuilderConfig): string {
  const tableName = `d_${config.entity_code}`;
  const isTransactional = config.entity_type === 'transactional';

  // Standard columns (always included)
  const standardColumns = `
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name text NOT NULL,
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    active_flag boolean DEFAULT true,
    ${isTransactional ? 'transaction_date date,' : ''}
    ${isTransactional ? '' : 'from_ts timestamptz DEFAULT now(),'}
    ${isTransactional ? '' : 'to_ts timestamptz,'}
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
  `;

  // User-defined columns
  const userColumns = config.columns.map(col => {
    const sqlType = DATA_TYPE_MAP[col.data_type];
    const notNull = col.required ? 'NOT NULL' : '';
    return `${col.column_name} ${sqlType} ${notNull}`;
  }).join(',\n    ');

  // Generate CREATE TABLE statement
  return `
CREATE TABLE app.${tableName} (
    ${standardColumns}${userColumns ? ',\n    ' + userColumns : ''}
);

COMMENT ON TABLE app.${tableName} IS '${config.description || 'User-created entity'}';

-- Create trigger for entity instance registry
CREATE TRIGGER ${tableName}_entity_instance_trigger
AFTER INSERT OR UPDATE ON app.${tableName}
FOR EACH ROW EXECUTE FUNCTION app.fn_entity_instance_upsert();
  `.trim();
}

const DATA_TYPE_MAP = {
  text: 'text',
  number: 'numeric',
  date: 'date',
  boolean: 'boolean',
  json: 'jsonb'
};
```

### Dynamic API Route Factory

**File:** `/apps/api/src/lib/dynamic-entity-route-factory.ts`

```typescript
export function createDynamicEntityRoutes(
  fastify: FastifyInstance,
  entityCode: string,
  tableName: string,
  columns: ColumnConfig[]
) {
  // GET /api/v1/{entity} - List
  fastify.get(`/api/v1/${entityCode}`, {
    preHandler: [fastify.authenticate],
    // ... RBAC, pagination, filtering
  }, async (request, reply) => {
    const results = await db.execute(sql`
      SELECT * FROM app.${sql.raw(tableName)}
      WHERE active_flag = true
      ORDER BY created_ts DESC
    `);
    return { data: results, total: results.length };
  });

  // GET /api/v1/{entity}/:id - Get single
  fastify.get(`/api/v1/${entityCode}/:id`, {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const result = await db.execute(sql`
      SELECT * FROM app.${sql.raw(tableName)}
      WHERE id = ${id} AND active_flag = true
    `);
    return result[0];
  });

  // POST /api/v1/{entity} - Create
  fastify.post(`/api/v1/${entityCode}`, {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const data = request.body;
    const result = await db.execute(sql`
      INSERT INTO app.${sql.raw(tableName)} (...)
      VALUES (...)
      RETURNING *
    `);
    return result[0];
  });

  // PUT /api/v1/{entity}/:id - Update
  // DELETE /api/v1/{entity}/:id - Delete (soft delete)
  // ...
}
```

---

## 6. Safety & Validation

### Pre-Creation Checks

```typescript
async function validateEntityCreation(config: EntityBuilderConfig): Promise<ValidationResult> {
  const errors: string[] = [];

  // 1. Check entity code uniqueness
  const existingEntity = await db.execute(sql`
    SELECT code FROM app.d_entity WHERE code = ${config.entity_code}
  `);
  if (existingEntity.length > 0) {
    errors.push(`Entity code '${config.entity_code}' already exists`);
  }

  // 2. Validate column names (prevent SQL injection)
  config.columns.forEach(col => {
    if (!/^[a-z_][a-z0-9_]*$/.test(col.column_name)) {
      errors.push(`Invalid column name: ${col.column_name}`);
    }

    // Check for reserved words
    const reservedWords = ['select', 'insert', 'delete', 'drop', 'table', 'user'];
    if (reservedWords.includes(col.column_name.toLowerCase())) {
      errors.push(`Column name '${col.column_name}' is a reserved word`);
    }
  });

  // 3. Check for duplicate column names
  const columnNames = config.columns.map(c => c.column_name);
  const duplicates = columnNames.filter((name, index) => columnNames.indexOf(name) !== index);
  if (duplicates.length > 0) {
    errors.push(`Duplicate column names: ${duplicates.join(', ')}`);
  }

  // 4. Validate parent/child entity codes exist
  const allEntityCodes = [...config.parent_entities, ...config.child_entities];
  for (const code of allEntityCodes) {
    const exists = await db.execute(sql`
      SELECT 1 FROM app.d_entity WHERE code = ${code}
    `);
    if (exists.length === 0) {
      errors.push(`Referenced entity '${code}' does not exist`);
    }
  }

  return { valid: errors.length === 0, errors };
}
```

### Rollback on Failure

```typescript
async function createEntityWithRollback(config: EntityBuilderConfig) {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // 1. Create table
    await client.query(generateEntityDDL(config));

    // 2. Update d_entity
    await client.query(updateEntityMetadata(config));

    // 3. Create API routes
    createDynamicEntityRoutes(fastify, config.entity_code, `d_${config.entity_code}`, config.columns);

    await client.query('COMMIT');
    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

---

## 7. Implementation Checklist

### Phase 1: UI Components (Week 1)
- [ ] Create `EntityDesignerPage.tsx`
- [ ] Create `EntityTypeSelector` component
- [ ] Reuse `FilteredDataTable` for column editor
- [ ] Create `EntityLinkageEditor` component
- [ ] Create `IconPicker` component
- [ ] Add routing from Settings → Entity Designer

### Phase 2: Backend API (Week 2)
- [ ] Create `/apps/api/src/lib/ddl-generator.ts`
- [ ] Create `/apps/api/src/lib/dynamic-entity-route-factory.ts`
- [ ] Create `/apps/api/src/modules/entity-builder/routes.ts`
- [ ] Implement validation logic
- [ ] Implement DDL execution with transaction support

### Phase 3: Database Integration (Week 3)
- [ ] Create entity instance registry trigger
- [ ] Update d_entity table on entity creation
- [ ] Update parent entities' child_entities JSONB
- [ ] Handle entity deletion (soft delete + cleanup)

### Phase 4: Testing & Documentation (Week 4)
- [ ] Test attribute-based entity creation
- [ ] Test transactional entity creation
- [ ] Test parent-child linkage
- [ ] Test API route generation
- [ ] Test rollback on failure
- [ ] Write user documentation
- [ ] Write developer documentation

---

## 8. Usage Example

### Creating a "Campaign" Entity

**Step 1:** Add entity in Settings
```
Code: campaign
Name: Campaign
UI Label: Campaigns
Icon: Target
```

**Step 2:** Design entity schema
```
Type: Transactional
Columns:
  - campaign_type (text, required)
  - start_date (date, required)
  - end_date (date)
  - budget_amount (number)
  - target_audience (text)
  - status (text, required)

Parent Entities: [x] customer, [x] business
Child Entities: [x] task, [x] artifact

Display Order: 250
```

**Step 3:** System generates
```sql
CREATE TABLE app.d_campaign (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name text NOT NULL,
    descr text,
    campaign_type text NOT NULL,
    start_date date NOT NULL,
    end_date date,
    budget_amount numeric,
    target_audience text,
    status text NOT NULL,
    transaction_date date,
    metadata jsonb DEFAULT '{}'::jsonb,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);
```

**Step 4:** API routes created
```
GET    /api/v1/campaign
GET    /api/v1/campaign/:id
POST   /api/v1/campaign
PUT    /api/v1/campaign/:id
DELETE /api/v1/campaign/:id
```

**Step 5:** User can now
- See "Campaigns" in sidebar
- Create/edit campaign records
- Link campaigns to customers/businesses
- Link tasks/artifacts to campaigns

---

## 9. Future Enhancements

### Phase 2 Features
- [ ] Column validation rules (regex, min/max)
- [ ] Custom indexes on columns
- [ ] Foreign key constraints (via d_entity_id_map)
- [ ] Computed columns
- [ ] Entity templates (clone existing entities)

### Phase 3 Features
- [ ] Entity versioning (schema migrations)
- [ ] Data import/export for custom entities
- [ ] Custom entity reports
- [ ] Workflow automation for custom entities

---

## 10. References

**Related Docs:**
- Entity Metadata Coherence: `/docs/entity_design_pattern/ENTITY_METADATA_COHERENCE.md`
- Universal Entity System: `/docs/entity_design_pattern/universal_entity_system.md`
- Factory Pattern: `/CLAUDE.md` (Factory Pattern section)

**Code Files:**
- Settings Page: `/apps/web/src/pages/setting/SettingsOverviewPage.tsx`
- Entity API: `/apps/api/src/modules/entity/routes.ts`
- DDL Files: `/db/*.ddl`

---

**Last Updated:** 2025-11-10
**Status:** 📋 Planning Complete - Ready for Implementation
**Estimated Effort:** 4 weeks (1 developer)
