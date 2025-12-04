# PMO Unified Design Pattern

**Version**: 1.0.0
**Date**: 2025-12-04
**Status**: Production
**Architecture**: 7-Layer Reactive Entity System

---

## Executive Summary

This document defines the **unified design pattern** for the PMO Enterprise Platform, covering UI/UX, rendering, cache, state management, and interaction flows. It represents the **single source of truth** for architectural decisions and implementation patterns.

### Six Core Principles

1. **Backend as Single Source of Truth** - Backend generates all metadata; frontend is a pure renderer
2. **Format-at-Read Pattern** - Cache stores raw data; formatting happens during component render
3. **Metadata-Driven Rendering** - No hardcoded component logic; all rendering driven by backend metadata
4. **Offline-First Architecture** - TanStack Query + Dexie IndexedDB for persistence and sync
5. **Optimistic Updates** - Instant UI feedback with automatic rollback on errors
6. **Portal-Safe Interactions** - All dropdowns use React Portal with defense-in-depth click-outside handlers

### Seven-Layer Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    PMO 7-Layer Architecture                     │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Layer 1: Database Schema & DDL                                │
│  ─────────────────────────────                                 │
│  • PostgreSQL 14+ (50 tables)                                  │
│  • Naming conventions: d_*, datalabel_*, entity*               │
│  • Infrastructure tables: entity, entity_instance,             │
│    entity_instance_link, entity_rbac                           │
│  • YAML-driven pattern detection (100+ patterns)               │
│                                                                 │
│  Layer 2: Backend API & Metadata Generation (BFF)              │
│  ──────────────────────────────────────────────                │
│  • Fastify v5, TypeScript ESM                                  │
│  • Entity Infrastructure Service (transactional CRUD)          │
│  • Entity Component Metadata Service (YAML-based v11.0+)       │
│  • Redis field caching (24-hour TTL)                           │
│  • content=metadata API parameter                              │
│  • Universal auto-filter builder                               │
│  • Unified RBAC enforcement                                    │
│                                                                 │
│  Layer 3: State Management & Caching (TanStack + Dexie)        │
│  ────────────────────────────────────────────────────          │
│  • TanStack Query: In-memory server state                      │
│  • Dexie v4: IndexedDB persistence (8 tables)                  │
│  • WebSocket PubSub: Real-time cache invalidation (port 4001)  │
│  • Sync cache: Non-hook access (getDatalabelSync)              │
│  • Optimistic updates with rollback                            │
│                                                                 │
│  Layer 4: Component Registry & Field Renderer                  │
│  ──────────────────────────────────────────                    │
│  • FieldRenderer: Central rendering hub                        │
│  • EditComponentRegistry: 20+ edit components                  │
│  • ViewComponentRegistry: 15+ display components               │
│  • Metadata-driven component resolution                        │
│  • Zero hardcoded switch statements                            │
│                                                                 │
│  Layer 5: UI Components & Containers                           │
│  ────────────────────────────────────                          │
│  • EntityListOfInstancesTable: Data table + inline edit        │
│  • EntityInstanceFormContainer: Form + inline edit             │
│  • BadgeDropdownSelect: Portal dropdown with colors            │
│  • EntityInstanceNameSelect: Portal dropdown with search       │
│  • DynamicChildEntityTabs: Auto-generated child tabs           │
│                                                                 │
│  Layer 6: Pages & Routing                                      │
│  ──────────────────────                                        │
│  • EntityListOfInstancesPage: Universal list page              │
│  • EntitySpecificInstancePage: Universal detail page           │
│  • EntityCreatePage: Universal create page                     │
│  • EntityChildListPage: Filtered child entity lists            │
│  • SettingsOverviewPage: Datalabel management                  │
│                                                                 │
│  Layer 7: User Interaction & Event Handling                    │
│  ────────────────────────────────────────────                  │
│  • Long-press inline edit (500ms hold)                         │
│  • Portal-aware click-outside handlers                         │
│  • Keyboard navigation (Enter, Escape, Tab, Arrows)            │
│  • Optimistic update with instant feedback                     │
│  • Multi-tab sync via Dexie                                    │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Key Technologies

- **Backend**: Fastify v5, Drizzle ORM, PostgreSQL 14+, Redis
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4
- **State**: TanStack Query v5, Dexie v4 (IndexedDB)
- **Real-Time**: WebSocket PubSub service (port 4001)
- **Version**: Platform v9.3.0

### Target Audience

- **Software Engineers** implementing features
- **System Architects** designing new modules
- **LLM Agents** (Claude Code) generating code
- **QA Engineers** understanding expected behavior

### Document Navigation

- **Quick Start**: Jump to Section 10 for complete interaction flows
- **Implementation Guide**: Read Sections 5-7 for component patterns
- **State Management**: Review Sections 2-3 for cache/API patterns
- **Troubleshooting**: See Appendix F for common issues

---

## Section 1: Architecture Overview

### 1.1 Platform Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    PMO Platform Stack                         │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Frontend (Port 5173)                                │    │
│  │  ─────────────────────                               │    │
│  │  • React 19 + TypeScript                             │    │
│  │  • Vite dev server                                   │    │
│  │  • TanStack Query (state)                            │    │
│  │  • Dexie (IndexedDB)                                 │    │
│  │  • Tailwind CSS v4                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│           ↓ HTTP/REST                ↓ WebSocket             │
│  ┌────────────────────┐    ┌──────────────────────────┐     │
│  │  API Service       │    │  PubSub Service          │     │
│  │  (Port 4000)       │    │  (Port 4001)             │     │
│  │  ──────────────    │    │  ────────────────        │     │
│  │  • Fastify v5     │    │  • WebSocket server       │     │
│  │  • JWT auth       │    │  • LogWatcher (60s poll)  │     │
│  │  • Drizzle ORM    │    │  • INVALIDATE messages    │     │
│  │  • Redis cache    │    │  • Multi-client broadcast │     │
│  └────────────────────┘    └──────────────────────────┘     │
│           ↓                          ↓                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  PostgreSQL 14+ (Port 5434)                          │    │
│  │  ────────────────────────────                        │    │
│  │  • 50 tables (46 DDL files)                          │    │
│  │  • app.system_logging (triggers)                     │    │
│  │  • app.system_cache_subscription                     │    │
│  │  • Transactional CRUD operations                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Redis Cache                                         │    │
│  │  ───────────                                         │    │
│  │  • entity:fields:{entityCode} (24h TTL)              │    │
│  │  • Graceful degradation if unavailable               │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Seven-Layer Detailed Breakdown

#### Layer 1: Database Schema & DDL

**Purpose**: Define data structure and naming conventions that drive pattern detection

**Key Files**:
- `db/*.ddl` - 46 DDL files defining all tables
- `db/entity.ddl` - Entity type metadata
- `db/entity_instance.ddl` - Entity instance registry
- `db/entity_instance_link.ddl` - Parent-child relationships
- `db/entity_rbac.ddl` - Permission assignments

**Naming Conventions Drive Metadata**:
```sql
-- Pattern: *_amt → Backend generates renderType: 'currency'
budget_allocated_amt DECIMAL(15,2)

-- Pattern: dl__* → Backend generates renderType: 'badge', inputType: 'BadgeDropdownSelect'
dl__project_stage VARCHAR(50)

-- Pattern: *__employee_id → Backend generates renderType: 'entityInstanceId'
manager__employee_id UUID

-- Pattern: *_date → Backend generates renderType: 'date', inputType: 'date'
start_date DATE

-- Pattern: is_*, *_flag → Backend generates renderType: 'boolean', inputType: 'checkbox'
active_flag BOOLEAN DEFAULT true
```

**Infrastructure Tables**:
```sql
-- Entity type metadata (icons, labels, child_entity_codes)
entity
  id UUID PRIMARY KEY
  code VARCHAR(50) UNIQUE  -- 'project', 'task', 'employee'
  label VARCHAR(255)       -- 'Project'
  icon VARCHAR(50)         -- 'folder'
  child_entity_codes JSONB -- ['task', 'cost', 'attachment']
  active_flag BOOLEAN      -- Soft delete for types

-- Entity instance registry (name cache for dropdowns)
entity_instance
  id UUID PRIMARY KEY
  entity_code VARCHAR(50)         -- TYPE code (e.g., 'project')
  entity_instance_id UUID         -- Instance UUID
  entity_instance_name VARCHAR(255) -- Display name for dropdowns
  instance_code VARCHAR(50)       -- Business code (e.g., 'PROJ-001')
  -- NO active_flag - hard delete only

-- Parent-child relationships
entity_instance_link
  id UUID PRIMARY KEY
  entity_code VARCHAR(50)              -- Parent TYPE code
  entity_instance_id UUID              -- Parent instance UUID
  child_entity_code VARCHAR(50)        -- Child TYPE code
  child_entity_instance_id UUID        -- Child instance UUID
  relationship_type VARCHAR(50)        -- 'contains', 'references'
  -- NO active_flag - hard delete only

-- RBAC permissions (person-based)
entity_rbac
  id UUID PRIMARY KEY
  entity_code VARCHAR(50)      -- TYPE code
  entity_instance_id UUID      -- Instance UUID (or ALL_ENTITIES_ID)
  person_code VARCHAR(50)      -- 'employee' or 'role'
  person_id UUID               -- Employee UUID or Role UUID
  permission_level INTEGER     -- 0=VIEW, 1=EDIT, 2=SHARE, 3=DELETE, 4=CREATE, 5=OWNER
  -- NO active_flag - hard delete only
```

#### Layer 2: Backend API & Metadata Generation

**Purpose**: Single source of truth for field metadata and data transformation

**Key Services**:

**Entity Infrastructure Service** (`apps/api/src/services/entity-infrastructure.service.ts`):
- Transactional CRUD operations
- `create_entity()` - Atomic INSERT across 4 tables
- `update_entity()` - Atomic UPDATE with registry sync
- `delete_entity()` - Atomic DELETE with cascade cleanup
- `build_ref_data_entityInstance()` - O(1) reference lookup table

**Entity Component Metadata Service** (`apps/api/src/services/entity-component-metadata.service.ts`):
- YAML-based pattern detection (100+ patterns, 80+ field types) - See [YAML_PATTERN_DETECTION_SYSTEM.md](YAML_PATTERN_DETECTION_SYSTEM.md)
- `generateEntityResponse()` - Metadata generation from 3 YAML files
- Redis field caching (24-hour TTL)
- `content=metadata` support (no data query)

**Universal Auto-Filter Builder** (`apps/api/src/lib/universal-filter-builder.ts`):
- Query parameter → SQL WHERE clause
- Type detection (UUID, currency, boolean, date, datalabel)
- Multi-field search support

**Route Pattern**:
```typescript
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '@/services/entity-infrastructure.service.js';
import { generateEntityResponse } from '@/services/entity-component-metadata.service.js';
import { buildAutoFilters } from '@/lib/universal-filter-builder.js';

const ENTITY_CODE = 'project';
const TABLE_ALIAS = 'e';

fastify.get('/api/v1/project', async (request, reply) => {
  const userId = request.user.sub;
  const { limit = 20, offset = 0, content } = request.query;

  // Metadata-only request (no data query)
  if (content === 'metadata') {
    const response = await generateEntityResponse('project', [], undefined, ['entityListOfInstancesTable'], true);
    return reply.send(response);
  }

  // RBAC filtering
  const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
    userId, ENTITY_CODE, Permission.VIEW, TABLE_ALIAS
  );

  // Auto-filters from query params
  const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query, {
    searchFields: ['name', 'code', 'descr']
  });

  // Route owns query structure
  const projects = await db.execute(sql`
    SELECT e.*, b.name as business_name
    FROM app.project e
    LEFT JOIN app.business b ON e.business_id = b.id
    WHERE ${rbacCondition}
      AND e.active_flag = true
      AND ${sql.join(autoFilters, sql` AND `)}
    ORDER BY e.created_ts DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  // Generate metadata + ref_data
  const response = await generateEntityResponse('project', projects, {
    total: count,
    limit,
    offset
  });

  return reply.send(response);
});
```

#### Layer 3: State Management & Caching

**Purpose**: Offline-first state management with real-time sync

**TanStack Query** (In-Memory Cache):
```typescript
// Query key patterns
['entity-list', 'project', { limit: 50, offset: 0 }]
['entity-instance', 'project', 'uuid-here']
['entity-metadata', 'project', 'entityListOfInstancesTable']
['datalabel', 'dl__project_stage']
['entity-codes']
['global-settings']

// Cache configuration
const ENTITY_LIST_CONFIG = {
  staleTime: 2 * 60 * 1000,  // 2 minutes
  gcTime: 10 * 60 * 1000,    // 10 minutes
};

const ENTITY_INSTANCE_CONFIG = {
  staleTime: 5 * 60 * 1000,  // 5 minutes
  gcTime: 30 * 60 * 1000,    // 30 minutes
};

const METADATA_CONFIG = {
  staleTime: 30 * 60 * 1000, // 30 minutes (metadata rarely changes)
  gcTime: 60 * 60 * 1000,    // 1 hour
};
```

**Dexie v4 Schema** (IndexedDB Persistence):
```typescript
// apps/web/src/db/dexie/schema.ts

export const pmoDb = new Dexie('pmo-cache-v4');

pmoDb.version(4).stores({
  // Settings dropdowns (dl__project_stage options)
  datalabel: 'field, code',

  // Entity type metadata (icons, labels)
  entityCode: 'code',

  // Global application settings
  globalSetting: 'key',

  // Entity list data (project list, task list)
  entityInstanceData: '[entityCode+params], entityCode, updatedAt',

  // Field metadata (viewType, editType)
  entityInstanceMetadata: '[entityCode+metadataType], entityCode',

  // Entity instance cache (single entities)
  entityInstance: '[entityCode+entityId], entityCode, entityId, updatedAt',

  // Parent-child links
  entityLink: '[parentEntityCode+parentEntityId+childEntityCode], parentEntityCode, childEntityCode',

  // Unsaved draft data
  draft: '[entityCode+entityId], entityCode, entityId, updatedAt',
});
```

**WebSocket Real-Time Sync**:
```typescript
// apps/web/src/lib/websocket/WebSocketManager.ts

export class WebSocketManager {
  connect() {
    this.ws = new WebSocket('ws://localhost:4001');

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'INVALIDATE') {
        const { entity_code, entity_id } = message;

        // Invalidate specific instance
        if (entity_id) {
          queryClient.invalidateQueries({
            queryKey: ['entity-instance', entity_code, entity_id]
          });
        }

        // Invalidate all lists of this entity type
        queryClient.invalidateQueries({
          queryKey: ['entity-list', entity_code]
        });

        // TanStack Query auto-refetches → updates Dexie → components re-render
      }
    };
  }

  subscribe(entityCode: string, entityId?: string) {
    this.ws.send(JSON.stringify({
      type: 'SUBSCRIBE',
      entity_code: entityCode,
      entity_id: entityId
    }));
  }
}
```

#### Layer 4: Component Registry & Field Renderer

**Purpose**: Metadata-driven component resolution with zero hardcoding

**FieldRenderer** (Central Hub):
```typescript
// apps/web/src/lib/fieldRenderer/FieldRenderer.tsx

interface FieldRendererProps {
  field: FieldMetadata;      // From backend metadata
  value: any;                // Raw value
  isEditing: boolean;        // View vs Edit mode
  onChange?: (value: any) => void;
  formattedData?: {          // Pre-formatted from format-at-read
    display: Record<string, string>;
    styles: Record<string, string>;
  };
  options?: OptionItem[];    // Datalabel cache for dropdowns
}

export const FieldRenderer: React.FC<FieldRendererProps> = ({
  field,
  value,
  isEditing,
  onChange,
  formattedData,
  options
}) => {
  if (isEditing) {
    // EDIT MODE: Resolve from EditComponentRegistry
    const EditComponent = EditComponentRegistry.get(field.inputType);
    if (!EditComponent) {
      console.warn(`No edit component for inputType: ${field.inputType}`);
      return <span>{value}</span>;
    }
    return (
      <EditComponent
        value={value}
        field={field}
        onChange={onChange}
        options={options}
      />
    );
  } else {
    // VIEW MODE: Resolve from ViewComponentRegistry
    const ViewComponent = ViewComponentRegistry.get(field.renderType);
    if (!ViewComponent) {
      return <span>{value}</span>;
    }
    return (
      <ViewComponent
        value={value}
        field={field}
        formattedData={formattedData}
      />
    );
  }
};
```

**Component Registries**:
```typescript
// apps/web/src/lib/fieldRenderer/registerComponents.tsx

// EDIT COMPONENTS (20+ registered)
export const EditComponentRegistry = new Map<string, React.FC<ComponentRendererProps>>([
  ['text', TextInputEdit],
  ['textarea', TextareaEdit],
  ['number', NumberInputEdit],
  ['currency', CurrencyInputEdit],
  ['date', DatePickerEdit],
  ['datetime', DateTimePickerEdit],
  ['checkbox', CheckboxEdit],
  ['select', SelectEdit],
  ['multiselect', MultiSelectEdit],
  ['BadgeDropdownSelect', BadgeDropdownSelectEdit],         // Portal dropdown
  ['EntityInstanceNameSelect', EntityInstanceNameSelectEdit], // Portal dropdown
  ['tags', TagsInputEdit],
  ['json', JsonEditorEdit],
  ['file', FileUploadEdit],
  ['image', ImageUploadEdit],
  ['color', ColorPickerEdit],
  ['rating', RatingInputEdit],
  ['slider', SliderInputEdit],
  ['richtext', RichTextEditorEdit],
]);

// VIEW COMPONENTS (15+ registered)
export const ViewComponentRegistry = new Map<string, React.FC<ComponentRendererProps>>([
  ['text', TextDisplay],
  ['currency', CurrencyDisplay],      // $50,000.00
  ['date', DateDisplay],              // Dec 4, 2025
  ['timestamp', TimestampDisplay],    // Dec 4, 2025 10:30 AM
  ['boolean', BooleanDisplay],        // ✓ / ✗
  ['badge', BadgeDisplay],            // Colored badge
  ['entityInstanceId', EntityInstanceDisplay],  // James Miller
  ['array', ArrayDisplay],            // [Tag1] [Tag2]
  ['json', JsonDisplay],              // Pretty-printed JSON
  ['file', FileDisplay],              // Download link
  ['image', ImageDisplay],            // <img> preview
  ['color', ColorDisplay],            // Color swatch
  ['rating', RatingDisplay],          // ★★★★☆
  ['percentage', PercentageDisplay],  // 75%
]);
```

**Metadata Example**:
```json
{
  "metadata": {
    "entityListOfInstancesTable": {
      "viewType": {
        "dl__project_stage": {
          "dtype": "str",
          "label": "Project Stage",
          "renderType": "badge",
          "lookupField": "dl__project_stage"
        },
        "manager__employee_id": {
          "dtype": "uuid",
          "label": "Manager",
          "renderType": "entityInstanceId",
          "lookupEntity": "employee",
          "lookupSourceTable": "entityInstance"
        },
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "renderType": "currency",
          "style": { "symbol": "$", "decimals": 2 }
        }
      },
      "editType": {
        "dl__project_stage": {
          "inputType": "BadgeDropdownSelect",
          "lookupSourceTable": "datalabel",
          "lookupField": "dl__project_stage"
        },
        "manager__employee_id": {
          "inputType": "EntityInstanceNameSelect",
          "lookupEntity": "employee",
          "lookupSourceTable": "entityInstance"
        },
        "budget_allocated_amt": {
          "inputType": "currency"
        }
      }
    }
  }
}
```

#### Layer 5: UI Components & Containers

**Purpose**: Reusable components that consume metadata and handle interactions

**Key Components**:

**EntityListOfInstancesTable** (`apps/web/src/components/shared/ui/EntityListOfInstancesTable.tsx`):
- Data table with sorting, filtering, pagination
- Inline cell editing (click to edit)
- Portal-aware click-outside handler
- Keyboard navigation (Enter, Escape, Tab, Arrows)
- Two save modes: cell-level (`onCellSave`) and row-level (`onSaveInlineEdit`)

**EntityInstanceFormContainer** (`apps/web/src/components/shared/entity/EntityInstanceFormContainer.tsx`):
- Universal form renderer
- Inline field editing (long-press 500ms)
- Full edit mode toggle
- Portal-aware click-outside handler
- Validation and error handling

**BadgeDropdownSelect** (`apps/web/src/components/shared/ui/BadgeDropdownSelect.tsx`):
- Colored dropdown for datalabel fields
- Portal rendering with `data-dropdown-portal` attribute
- Search filtering
- Keyboard navigation
- Uses global settings for badge colors

**EntityInstanceNameSelect** (`apps/web/src/components/shared/ui/EntityInstanceNameSelect.tsx`):
- Entity reference dropdown
- Portal rendering with `data-dropdown-portal` attribute
- Async search with debounce
- Keyboard navigation
- Fetches from entity instance registry

**DynamicChildEntityTabs** (`apps/web/src/components/shared/entity/DynamicChildEntityTabs.tsx`):
- Auto-generated tabs from `entity.child_entity_codes`
- Lazy loading child data
- RBAC-filtered child lists
- Parent context propagation

#### Layer 6: Pages & Routing

**Purpose**: Universal pages driven by URL parameters

**Three Universal Pages**:

1. **EntityListOfInstancesPage** (`/project`, `/task`, `/employee`)
   - Handles all entity list views
   - View switching: Table, Kanban, Calendar, Grid
   - Filtering, sorting, pagination
   - Add new entity button (with parent context)

2. **EntitySpecificInstancePage** (`/project/{id}`, `/task/{id}`)
   - Handles all entity detail views
   - Header with edit/delete actions
   - Form fields via EntityInstanceFormContainer
   - Child entity tabs via DynamicChildEntityTabs

3. **EntityCreatePage** (`/project/create?parent_code=business&parent_id={uuid}`)
   - Handles all entity creation
   - Parent context from URL
   - Create-Link-Redirect pattern
   - Auto-navigation after save

**Routing Pattern**:
```typescript
// apps/web/src/App.tsx

const router = createBrowserRouter([
  {
    path: '/:entityCode',
    element: <EntityListOfInstancesPage />
  },
  {
    path: '/:entityCode/create',
    element: <EntityCreatePage />
  },
  {
    path: '/:entityCode/:id',
    element: <EntitySpecificInstancePage />
  },
  {
    path: '/:parentEntityCode/:parentId/:childEntityCode',
    element: <EntityChildListPage />
  },
  {
    path: '/settings',
    element: <SettingsOverviewPage />
  },
  {
    path: '/settings/:datalabelField',
    element: <SettingDetailPage />
  },
]);
```

#### Layer 7: User Interaction & Event Handling

**Purpose**: Consistent interaction patterns across all components

**Core Interaction Patterns**:

1. **Long-Press Inline Edit (Forms)**:
   - Hold field for 500ms → Enter edit mode
   - Click outside or press Enter → Save
   - Press Escape → Cancel

2. **Click Cell Edit (Tables)**:
   - Click cell → Enter edit mode
   - Dropdown selection → Immediate save
   - Click outside or press Enter → Save text fields

3. **Portal-Aware Click-Outside**:
   - Checks `editingFieldRef.contains(target)`
   - Checks `target.closest('[data-dropdown-portal]')`
   - Returns early if inside either
   - Uses `mousedown` event (fires before `click`)

4. **Keyboard Navigation**:
   - Enter → Open edit mode or save
   - Escape → Cancel and revert
   - Tab → Save and move to next field
   - Arrow keys → Navigate dropdown options

5. **Optimistic Updates**:
   - Update UI immediately
   - Send API request in background
   - Rollback on error
   - Show success toast

---

## Section 2: State Management & Cache Lifecycle

### 2.1 TanStack Query Architecture

**Purpose**: In-memory server state management with automatic background refetching

#### Query Key Structure

TanStack Query uses hierarchical keys for cache invalidation and dependency tracking:

```typescript
// Entity Lists
['entity-list', entityCode, params]
['entity-list', 'project', { limit: 50, offset: 0, dl__project_stage: 'planning' }]

// Entity Instances
['entity-instance', entityCode, entityId]
['entity-instance', 'project', 'uuid-here']

// Entity Metadata (content=metadata)
['entity-metadata', entityCode, metadataType]
['entity-metadata', 'project', 'entityListOfInstancesTable']
['entity-metadata', 'task', 'entityInstanceFormContainer']

// Datalabels (Settings Dropdowns)
['datalabel', field]
['datalabel', 'dl__project_stage']
['datalabel', 'dl__task_priority']

// Entity Codes (Entity Type List)
['entity-codes']

// Global Settings (Badge Colors, etc.)
['global-settings']

// Child Entity Lists (Filtered by Parent)
['entity-list', parentEntityCode, parentId, childEntityCode]
['entity-list', 'project', 'uuid-parent', 'task']
```

#### Cache Configuration by Data Type

```typescript
// apps/web/src/db/cache/constants.ts

// Fast-changing data (entity lists)
export const ENTITY_LIST_CONFIG = {
  staleTime: 2 * 60 * 1000,   // 2 minutes - frequent refetch
  gcTime: 10 * 60 * 1000,     // 10 minutes - keep in memory
  refetchOnWindowFocus: true,  // Refetch when user returns to tab
  refetchOnMount: false,       // Use cache if available
};

// Medium-changing data (entity instances)
export const ENTITY_INSTANCE_CONFIG = {
  staleTime: 5 * 60 * 1000,   // 5 minutes
  gcTime: 30 * 60 * 1000,     // 30 minutes
  refetchOnWindowFocus: true,
  refetchOnMount: false,
};

// Slow-changing data (metadata, datalabels)
export const METADATA_CONFIG = {
  staleTime: 30 * 60 * 1000,  // 30 minutes - metadata rarely changes
  gcTime: 60 * 60 * 1000,     // 1 hour
  refetchOnWindowFocus: false, // Don't refetch on focus
  refetchOnMount: false,
};

// Session data (entity codes, settings)
export const SESSION_STORE_CONFIG = {
  staleTime: 30 * 60 * 1000,  // 30 minutes
  gcTime: 60 * 60 * 1000,     // 1 hour
  refetchOnWindowFocus: false,
  refetchOnMount: false,
};
```

#### Query State Machine

```
┌──────────────────────────────────────────────────────────────┐
│             TanStack Query State Transitions                  │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  [IDLE] → No query has been executed yet                     │
│     ↓                                                         │
│  [LOADING] → First fetch in progress (isLoading: true)       │
│     ↓                                                         │
│  [SUCCESS] → Data available (data: {...})                    │
│     ├─ [FRESH] → Within staleTime                            │
│     │    ↓ (time passes)                                     │
│     └─ [STALE] → Beyond staleTime, eligible for refetch      │
│          ├─ Background refetch triggered                     │
│          │    ↓                                               │
│          └─ [REVALIDATING] → Refetch in progress             │
│               ├─ [SUCCESS] → Updated data                    │
│               └─ [ERROR] → Refetch failed, keep stale data   │
│                                                               │
│  [ERROR] → Fetch failed (error: {...})                       │
│     ├─ Retry logic (3 attempts with exponential backoff)     │
│     └─ Show error UI after exhausting retries                │
│                                                               │
│  MANUAL INVALIDATION:                                         │
│  queryClient.invalidateQueries() → Force [STALE] state       │
│  → Trigger immediate refetch                                 │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

#### Query States Explained

```typescript
// isLoading vs isFetching
const { data, isLoading, isFetching } = useQuery(...);

// isLoading: true only on FIRST fetch (no cached data)
// isFetching: true on ANY fetch (including background refetch)

if (isLoading) {
  return <LoadingSpinner />;  // Show full loader on first load
}

if (isFetching) {
  // Show small spinner in corner, but display stale data
  return (
    <div>
      {isFetching && <SmallSpinner />}
      <DataTable data={data} />
    </div>
  );
}

// isStale: true when data is beyond staleTime
// isError: true when fetch failed
// data: Cached data (may be stale)
// error: Error object if fetch failed
```

### 2.2 Dexie IndexedDB Schema (v4)

**Purpose**: Offline-first persistence that survives browser restarts

#### Eight Core Tables

```typescript
// apps/web/src/db/dexie/schema.ts

export const pmoDb = new Dexie('pmo-cache-v4');

pmoDb.version(4).stores({
  // 1. Datalabel Options (Settings Dropdowns)
  // ───────────────────────────────────────
  // Stores: dl__project_stage options, dl__task_priority options
  datalabel: 'field, code',
  // Examples:
  // { field: 'dl__project_stage', code: 'planning', label: 'Planning', badge_color: 'bg-blue-100', ... }
  // { field: 'dl__project_stage', code: 'in_progress', label: 'In Progress', badge_color: 'bg-yellow-100', ... }

  // 2. Entity Codes (Entity Type Metadata)
  // ──────────────────────────────────────
  // Stores: Icons, labels, child_entity_codes for each entity type
  entityCode: 'code',
  // Examples:
  // { code: 'project', label: 'Project', icon: 'folder', child_entity_codes: ['task', 'cost'] }
  // { code: 'employee', label: 'Employee', icon: 'user', child_entity_codes: [] }

  // 3. Global Settings (Badge Colors, Feature Flags)
  // ────────────────────────────────────────────────
  // Stores: Application-wide settings
  globalSetting: 'key',
  // Examples:
  // { key: 'badge_colors', value: { planning: 'bg-blue-100', in_progress: 'bg-yellow-100' } }
  // { key: 'feature_flags', value: { kanban_view: true, calendar_view: false } }

  // 4. Entity Instance Data (Entity Lists)
  // ──────────────────────────────────────
  // Stores: Paginated list results (projects, tasks, employees)
  entityInstanceData: '[entityCode+params], entityCode, updatedAt',
  // Examples:
  // { entityCode: 'project', params: '{limit:50,offset:0}', data: [...], total: 42, updatedAt: 1234567890 }
  // { entityCode: 'task', params: '{limit:20,offset:0,dl__task_priority:"high"}', data: [...] }

  // 5. Entity Instance Metadata (Field Metadata)
  // ────────────────────────────────────────────
  // Stores: viewType, editType field definitions
  entityInstanceMetadata: '[entityCode+metadataType], entityCode',
  // Examples:
  // { entityCode: 'project', metadataType: 'entityListOfInstancesTable', viewType: {...}, editType: {...} }
  // { entityCode: 'task', metadataType: 'entityInstanceFormContainer', viewType: {...}, editType: {...} }

  // 6. Entity Instance (Single Entity Cache)
  // ────────────────────────────────────────
  // Stores: Individual entity instances
  entityInstance: '[entityCode+entityId], entityCode, entityId, updatedAt',
  // Examples:
  // { entityCode: 'project', entityId: 'uuid-123', data: { name: 'Kitchen Reno', ... }, updatedAt: 1234567890 }
  // { entityCode: 'employee', entityId: 'uuid-456', data: { name: 'James Miller', ... } }

  // 7. Entity Link (Parent-Child Relationships)
  // ───────────────────────────────────────────
  // Stores: Cached parent-child links for navigation
  entityLink: '[parentEntityCode+parentEntityId+childEntityCode], parentEntityCode, childEntityCode',
  // Examples:
  // { parentEntityCode: 'project', parentEntityId: 'uuid-p', childEntityCode: 'task', childIds: ['uuid-t1', 'uuid-t2'] }

  // 8. Draft (Unsaved Changes)
  // ──────────────────────────
  // Stores: User's unsaved edits (survives page refresh)
  draft: '[entityCode+entityId], entityCode, entityId, updatedAt',
  // Examples:
  // { entityCode: 'project', entityId: 'uuid-123', data: { budget_allocated_amt: 75000 }, updatedAt: 1234567890 }
  // { entityCode: 'task', entityId: 'uuid-456', data: { dl__task_priority: 'urgent' } }
});
```

#### Unified Naming Convention

**Critical Design Decision**: TanStack Query cache keys match Dexie table names for consistency.

```typescript
// apps/web/src/db/cache/keys.ts

// TanStack Query key creators (match Dexie table names)
export const createDatalabelKey = (field: string) => ['datalabel', field];
export const createEntityCodeKey = () => ['entity-codes'];
export const createGlobalSettingKey = () => ['global-settings'];
export const createEntityInstanceDataKey = (entityCode: string, params: any) =>
  ['entity-list', entityCode, params];
export const createEntityInstanceMetadataKey = (entityCode: string, metadataType: string) =>
  ['entity-metadata', entityCode, metadataType];
export const createEntityInstanceKey = (entityCode: string, entityId: string) =>
  ['entity-instance', entityCode, entityId];
export const createEntityLinkKey = (parentCode: string, parentId: string, childCode: string) =>
  ['entity-list', parentCode, parentId, childCode];
export const createDraftKey = (entityCode: string, entityId: string) =>
  ['draft', entityCode, entityId];

// When TanStack Query updates → Update Dexie with same key structure
// When Dexie has data on startup → Hydrate TanStack Query with same keys
```

#### Schema Versioning Strategy

```typescript
// apps/web/src/db/dexie/schema.ts

// Version 1 (Legacy): 14 tables with mixed naming
// Version 2: Consolidated to 10 tables
// Version 3: Aligned TanStack Query + Dexie keys
// Version 4 (Current): 8 tables with unified naming

pmoDb.version(4).stores({
  // ... 8 tables as shown above
}).upgrade(tx => {
  // Migration logic from v3 to v4
  console.log('[Dexie] Migrating from v3 to v4...');
  // Data transformation if needed
});

// Version detection on app start
if (await pmoDb.open().version !== 4) {
  console.log('[Dexie] Detected old schema version, clearing cache...');
  await pmoDb.delete();
  await pmoDb.open();
}
```

### 2.3 Cache Lifecycle State Machine

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     Complete Cache Lifecycle                             │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  APP START (Cold Start)                                                  │
│  ────────────────────                                                    │
│  1. Dexie opens: pmoDb.open()                                            │
│  2. Hydrate TanStack Query from Dexie: hydrateQueryCache()              │
│     └─ Load datalabel, entityCode, globalSetting into memory            │
│     └─ Load recent entity instances (last viewed)                       │
│  3. UI renders with cached data (instant load) ✅                        │
│                                                                           │
│  ↓                                                                        │
│                                                                           │
│  USER LOGIN                                                              │
│  ──────────                                                              │
│  1. Login API call → JWT token received                                 │
│  2. prefetchAllMetadata() executes:                                      │
│     └─ Fetch all datalabels: GET /api/v1/datalabel/*                    │
│     └─ Fetch entity codes: GET /api/v1/entity/types                     │
│     └─ Fetch global settings: GET /api/v1/settings                      │
│  3. Store in TanStack Query + Dexie                                      │
│  4. Sync cache populated for non-hook access ✅                          │
│                                                                           │
│  ↓                                                                        │
│                                                                           │
│  PAGE NAVIGATION (/project)                                              │
│  ──────────────────────────                                              │
│  1. useEntityInstanceMetadata('project', 'entityListOfInstancesTable')   │
│     ├─ Check TanStack Query cache                                        │
│     │   ├─ CACHE HIT (stale < 30min) → Return immediately               │
│     │   └─ CACHE MISS → Fetch GET /api/v1/project?content=metadata      │
│     │       └─ Backend returns { metadata } only (no data query)        │
│     │       └─ Store in TanStack Query + Dexie                           │
│     └─ Component receives metadata, proceeds to render                   │
│                                                                           │
│  2. useFormattedEntityList('project', { limit: 50 })                     │
│     ├─ Check TanStack Query cache                                        │
│     │   ├─ CACHE HIT (stale < 2min) → Format-at-read (select)           │
│     │   └─ CACHE MISS → Fetch GET /api/v1/project?limit=50              │
│     │       ├─ Backend: RBAC filter + SQL query + metadata              │
│     │       ├─ Response: { data, ref_data_entityInstance, metadata }    │
│     │       └─ Store RAW data in TanStack Query + Dexie                 │
│     └─ Format-at-read transforms RAW → { raw, display, styles }         │
│     └─ Component receives formatted data, renders table ✅               │
│                                                                           │
│  ↓                                                                        │
│                                                                           │
│  USER EDITS FIELD (Inline Edit)                                          │
│  ────────────────────────────                                            │
│  1. Long-press "Project Stage" field (500ms hold)                        │
│  2. Enter edit mode, render BadgeDropdownSelect                          │
│  3. User selects "In Progress"                                           │
│  4. onChange callback fires → handleInlineSave()                         │
│  5. optimisticUpdateEntity(projectId, { dl__project_stage: 'in_progress' })│
│                                                                           │
│     OPTIMISTIC UPDATE FLOW:                                              │
│     ├─ INSTANT: Update TanStack Query cache                              │
│     │   └─ queryClient.setQueryData(['entity-instance', 'project', id], newData)│
│     ├─ INSTANT: Update Dexie                                             │
│     │   └─ pmoDb.entityInstance.put({ entityCode, entityId, data: newData })│
│     ├─ INSTANT: Component re-renders with new value ✅                   │
│     │                                                                     │
│     └─ BACKGROUND: API call                                              │
│         └─ PATCH /api/v1/project/{id}                                    │
│             ├─ RBAC check (Permission.EDIT)                              │
│             ├─ Transactional update_entity()                             │
│             │   ├─ UPDATE app.project SET dl__project_stage = ...       │
│             │   └─ INSERT app.system_logging (trigger)                   │
│             ├─ SUCCESS:                                                  │
│             │   ├─ queryClient.invalidateQueries(['entity-instance', 'project', id])│
│             │   ├─ queryClient.invalidateQueries(['entity-list', 'project'])│
│             │   ├─ Background refetch updates cache with server truth    │
│             │   └─ Show success toast ✅                                 │
│             │                                                             │
│             └─ ERROR:                                                    │
│                 ├─ ROLLBACK: queryClient.setQueryData (restore old value)│
│                 ├─ ROLLBACK: Dexie update (restore old value)            │
│                 ├─ Component re-renders with old value                   │
│                 └─ Show error toast ❌                                   │
│                                                                           │
│  ↓                                                                        │
│                                                                           │
│  WEBSOCKET INVALIDATION (Real-Time Sync)                                 │
│  ─────────────────────────────────────                                   │
│  1. Database change triggers INSERT INTO app.system_logging              │
│  2. LogWatcher polls every 60s, finds pending log                        │
│  3. WebSocket INVALIDATE message sent:                                   │
│     { type: 'INVALIDATE', entity_code: 'project', entity_id: 'uuid' }    │
│  4. WebSocketManager receives message:                                   │
│     └─ queryClient.invalidateQueries(['entity-instance', 'project', 'uuid'])│
│     └─ queryClient.invalidateQueries(['entity-list', 'project'])         │
│  5. TanStack Query marks cache as STALE                                  │
│  6. Background refetch executes:                                         │
│     └─ GET /api/v1/project/{uuid}                                        │
│     └─ GET /api/v1/project?limit=50                                      │
│  7. Cache updated with fresh data                                        │
│  8. Dexie updated                                                        │
│  9. Components re-render with new data ✅                                │
│                                                                           │
│  ↓                                                                        │
│                                                                           │
│  USER CHANGES BADGE COLOR (Settings Page)                                │
│  ──────────────────────────────────────────                              │
│  1. Navigate to /settings/dl__project_stage                              │
│  2. Change "Planning" badge color: blue → green                          │
│  3. PATCH /api/v1/datalabel/dl__project_stage                            │
│  4. Update datalabel cache:                                              │
│     └─ queryClient.invalidateQueries(['datalabel', 'dl__project_stage']) │
│  5. All components using this datalabel re-render:                       │
│     └─ useFormattedEntityData() subscribes to datalabel cache            │
│     └─ Format-at-read re-executes (memoized)                             │
│     └─ Badges update to new color instantly ✅                           │
│                                                                           │
│  ↓                                                                        │
│                                                                           │
│  MULTI-TAB SYNC (Dexie Storage Event)                                    │
│  ───────────────────────────────────                                     │
│  1. User has two tabs open: Tab A, Tab B                                 │
│  2. Tab A: User edits project stage → Dexie updated                      │
│  3. Dexie fires storage event to Tab B                                   │
│  4. Tab B: Dexie listener invalidates TanStack Query                     │
│  5. Tab B: Background refetch updates UI ✅                              │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.4 WebSocket Real-Time Sync Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│               WebSocket Real-Time Sync Architecture                   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  DATABASE TRIGGER (Any CRUD operation)                               │
│  ──────────────────────────────────────                              │
│  CREATE TRIGGER project_change_log                                   │
│  AFTER INSERT OR UPDATE OR DELETE ON app.project                     │
│  FOR EACH ROW                                                         │
│  EXECUTE FUNCTION log_entity_change();                               │
│                                                                       │
│  Function: log_entity_change()                                       │
│  ├─ INSERT INTO app.system_logging (                                 │
│  │   entity_code,        -- 'project'                                │
│  │   entity_id,          -- UUID of changed record                   │
│  │   operation_type,     -- 'INSERT', 'UPDATE', 'DELETE'             │
│  │   changed_at,         -- NOW()                                    │
│  │   processed           -- false                                    │
│  │ );                                                                 │
│  └─ NOTIFY pubsub_channel, 'CHANGE';  -- Optional instant notify     │
│                                                                       │
│  ↓                                                                    │
│                                                                       │
│  PUBSUB SERVICE (Port 4001)                                          │
│  ───────────────────────────                                         │
│  LogWatcher Process:                                                 │
│  ├─ Polls app.system_logging every 60 seconds                        │
│  ├─ SELECT * FROM app.system_logging WHERE processed = false         │
│  ├─ For each pending log:                                            │
│  │   ├─ Find subscribed clients:                                     │
│  │   │   SELECT * FROM app.system_cache_subscription                 │
│  │   │   WHERE entity_code = log.entity_code                         │
│  │   │   AND (entity_id IS NULL OR entity_id = log.entity_id)        │
│  │   │                                                                │
│  │   ├─ Broadcast INVALIDATE to each client:                         │
│  │   │   ws.send(JSON.stringify({                                    │
│  │   │     type: 'INVALIDATE',                                       │
│  │   │     entity_code: 'project',                                   │
│  │   │     entity_id: 'uuid'                                         │
│  │   │   }));                                                         │
│  │   │                                                                │
│  │   └─ Mark log as processed:                                       │
│  │       UPDATE app.system_logging SET processed = true WHERE id = ...│
│  │                                                                    │
│  └─ Sleep 60 seconds, repeat                                         │
│                                                                       │
│  ↓                                                                    │
│                                                                       │
│  FRONTEND (WebSocketManager)                                         │
│  ────────────────────────────                                        │
│  On component mount:                                                 │
│  ├─ WebSocketManager.connect()                                       │
│  │   └─ ws = new WebSocket('ws://localhost:4001')                    │
│  │                                                                    │
│  ├─ WebSocketManager.subscribe('project')  -- Type-level             │
│  │   └─ ws.send({ type: 'SUBSCRIBE', entity_code: 'project' })       │
│  │   └─ INSERT INTO app.system_cache_subscription (                  │
│  │       client_id, entity_code                                      │
│  │     )                                                              │
│  │                                                                    │
│  └─ WebSocketManager.subscribe('project', 'uuid')  -- Instance-level │
│      └─ ws.send({ type: 'SUBSCRIBE', entity_code: 'project',         │
│                   entity_id: 'uuid' })                                │
│      └─ INSERT INTO app.system_cache_subscription (                  │
│          client_id, entity_code, entity_id                           │
│        )                                                              │
│                                                                       │
│  On message received:                                                │
│  ├─ ws.onmessage = (event) => {                                      │
│  │   const msg = JSON.parse(event.data);                             │
│  │                                                                    │
│  │   if (msg.type === 'INVALIDATE') {                                │
│  │     // Invalidate specific instance                               │
│  │     if (msg.entity_id) {                                          │
│  │       queryClient.invalidateQueries({                             │
│  │         queryKey: ['entity-instance', msg.entity_code, msg.entity_id]│
│  │       });                                                          │
│  │     }                                                              │
│  │                                                                    │
│  │     // Invalidate all lists of this type                          │
│  │     queryClient.invalidateQueries({                               │
│  │       queryKey: ['entity-list', msg.entity_code]                  │
│  │     });                                                            │
│  │                                                                    │
│  │     // TanStack Query automatically refetches stale queries        │
│  │     // → Updates Dexie → Components re-render ✅                  │
│  │   }                                                                │
│  │ };                                                                 │
│  │                                                                    │
│  └─ On component unmount:                                            │
│      └─ WebSocketManager.unsubscribe('project', 'uuid')              │
│          └─ ws.send({ type: 'UNSUBSCRIBE', ... })                    │
│          └─ DELETE FROM app.system_cache_subscription WHERE ...      │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

#### WebSocket Message Protocol

```typescript
// SUBSCRIBE (Client → Server)
{
  type: 'SUBSCRIBE',
  entity_code: 'project',      // TYPE code
  entity_id?: 'uuid'           // Optional: subscribe to specific instance
}

// UNSUBSCRIBE (Client → Server)
{
  type: 'UNSUBSCRIBE',
  entity_code: 'project',
  entity_id?: 'uuid'
}

// INVALIDATE (Server → Client)
{
  type: 'INVALIDATE',
  entity_code: 'project',      // Which entity type changed
  entity_id: 'uuid',           // Which instance changed (optional)
  operation: 'UPDATE',         // INSERT, UPDATE, DELETE
  timestamp: 1234567890
}

// PING/PONG (Heartbeat)
{
  type: 'PING'
}
{
  type: 'PONG'
}
```

### 2.5 Sync vs Async Cache Access

**Problem**: TanStack Query hooks can only be used inside React components. Utilities, formatters, and transformers need cache access without hooks.

**Solution**: Dual access pattern with sync cache populated via prefetch.

#### Async Hook Access (Inside Components)

```typescript
// apps/web/src/db/cache/hooks/useDatalabel.ts

export function useDatalabel(field: string) {
  return useQuery({
    queryKey: ['datalabel', field],
    queryFn: async () => {
      const response = await api.get(`/api/v1/datalabel/${field}`);
      return response.data;
    },
    staleTime: METADATA_CONFIG.staleTime,
    gcTime: METADATA_CONFIG.gcTime,
  });
}

// Usage in component
const ProjectStageDropdown = () => {
  const { data: options, isLoading } = useDatalabel('dl__project_stage');

  if (isLoading) return <Spinner />;

  return (
    <select>
      {options.map(opt => (
        <option key={opt.code} value={opt.code}>{opt.label}</option>
      ))}
    </select>
  );
};
```

#### Sync Cache Access (Outside Components)

```typescript
// apps/web/src/db/tanstack-index.ts

const syncCache = {
  datalabels: new Map<string, DatalabelOption[]>(),
  entityCodes: [] as EntityCode[],
  settings: {} as GlobalSettings,
};

// Getter (returns cached data or null)
export function getDatalabelSync(field: string): DatalabelOption[] | null {
  return syncCache.datalabels.get(field) || null;
}

export function getEntityCodesSync(): EntityCode[] {
  return syncCache.entityCodes;
}

// Setter (called by TanstackCacheProvider after prefetch)
export function setDatalabelSync(field: string, options: DatalabelOption[]) {
  syncCache.datalabels.set(field, options);
}

export function setEntityCodesSync(codes: EntityCode[]) {
  syncCache.entityCodes = codes;
}

// Usage in utility (no hook)
export function formatBadgeValue(rawValue: string, field: string): string {
  const options = getDatalabelSync(field);
  if (!options) return rawValue;

  const option = options.find(opt => opt.code === rawValue);
  return option?.label || rawValue;
}
```

#### Prefetch Strategy (Populate Sync Cache)

```typescript
// apps/web/src/db/cache/prefetch.ts

export async function prefetchAllMetadata(queryClient: QueryClient) {
  console.log('[Prefetch] Starting metadata prefetch...');

  // 1. Prefetch all datalabel fields
  const datalabelFields = [
    'dl__project_stage',
    'dl__task_priority',
    'dl__employee_status',
    // ... all datalabel fields
  ];

  await Promise.all(
    datalabelFields.map(async (field) => {
      const data = await queryClient.fetchQuery({
        queryKey: ['datalabel', field],
        queryFn: async () => {
          const response = await api.get(`/api/v1/datalabel/${field}`);
          return response.data;
        },
        staleTime: METADATA_CONFIG.staleTime,
      });

      // Populate sync cache
      setDatalabelSync(field, data);
    })
  );

  // 2. Prefetch entity codes
  const entityCodes = await queryClient.fetchQuery({
    queryKey: ['entity-codes'],
    queryFn: async () => {
      const response = await api.get('/api/v1/entity/types');
      return response.data;
    },
    staleTime: SESSION_STORE_CONFIG.staleTime,
  });

  setEntityCodesSync(entityCodes);

  // 3. Prefetch global settings
  await queryClient.fetchQuery({
    queryKey: ['global-settings'],
    queryFn: async () => {
      const response = await api.get('/api/v1/settings');
      return response.data;
    },
    staleTime: SESSION_STORE_CONFIG.staleTime,
  });

  console.log('[Prefetch] Metadata prefetch complete ✅');
}

// Called after login
const handleLogin = async (email: string, password: string) => {
  const response = await login(email, password);
  setToken(response.token);

  // Prefetch all metadata
  await prefetchAllMetadata(queryClient);

  navigate('/dashboard');
};
```

**Flow Diagram**:

```
LOGIN
  ↓
prefetchAllMetadata()
  ├─ Fetch all datalabels → Store in TanStack Query + Dexie + syncCache
  ├─ Fetch entity codes → Store in TanStack Query + Dexie + syncCache
  └─ Fetch global settings → Store in TanStack Query + Dexie + syncCache
  ↓
Navigate to /project
  ↓
Component: useDatalabel('dl__project_stage')
  └─ TanStack Query returns cached data instantly ✅

Utility: formatBadgeValue(rawValue, 'dl__project_stage')
  └─ getDatalabelSync('dl__project_stage') returns cached data ✅

Both paths work because prefetchAllMetadata() populated all caches!
```

---

## Section 3: Data Flow Pipeline

### 3.1 Complete Request Flow (LIST Endpoint)

This section documents the **complete end-to-end flow** from user navigation to rendered UI for entity list pages.

```
┌──────────────────────────────────────────────────────────────────────┐
│          COMPLETE FLOW: User Navigates to /project                    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  STEP 1: USER ACTION                                                 │
│  ────────────────────                                                │
│  User clicks "Projects" in sidebar                                   │
│  → Navigate to /project                                              │
│                                                                       │
│  ↓                                                                    │
│                                                                       │
│  STEP 2: PAGE MOUNT (EntityListOfInstancesPage.tsx)                  │
│  ────────────────────────────────────────────────────               │
│  Component mounts, executes two parallel queries:                    │
│                                                                       │
│  Query 1: METADATA FETCH                                             │
│  ────────────────────────                                            │
│  const { viewType, editType, isLoading } =                           │
│    useEntityInstanceMetadata('project', 'entityListOfInstancesTable');│
│                                                                       │
│  TanStack Query checks cache:                                        │
│  ├─ queryKey: ['entity-metadata', 'project', 'entityListOfInstancesTable']│
│  │                                                                    │
│  ├─ CACHE HIT (stale < 30min):                                       │
│  │   ├─ Return cached metadata from memory                           │
│  │   ├─ Check if stale (> 30min)                                     │
│  │   │   └─ If stale: Background refetch                             │
│  │   └─ Component receives metadata immediately ✅                   │
│  │                                                                    │
│  └─ CACHE MISS:                                                      │
│      ├─ isLoading = true → Component shows <LoadingSpinner />        │
│      ├─ Execute API call:                                            │
│      │   GET /api/v1/project?content=metadata                        │
│      │                                                                │
│      │   Backend (entity-component-metadata.service.ts):             │
│      │   ├─ metadataOnly = true (from query param)                   │
│      │   ├─ No SQL query executed! (saves ~50-100ms)                 │
│      │   ├─ Get field names from Redis cache:                        │
│      │   │   redis.get('entity:fields:project')                      │
│      │   │   └─ ['id', 'code', 'name', 'dl__project_stage',          │
│      │   │       'manager__employee_id', 'budget_allocated_amt', ...]│
│      │   │                                                            │
│      │   ├─ YAML pattern matching for each field:                    │
│      │   │   dl__project_stage →                                     │
│      │   │     pattern-mapping.yaml: "dl__*_stage" → datalabel_dag   │
│      │   │     view-type-mapping.yaml:                               │
│      │   │       renderType: 'badge', style: { colorFromData: true } │
│      │   │     edit-type-mapping.yaml:                               │
│      │   │       inputType: 'component', component: 'BadgeDropdownSelect'│
│      │   │                                                            │
│      │   │   manager__employee_id →                                  │
│      │   │     pattern-mapping.yaml: "*__*_id" → entityInstance_Id   │
│      │   │     view-type-mapping.yaml:                               │
│      │   │       renderType: 'component', component: 'EntityInstanceName'│
│      │   │     edit-type-mapping.yaml:                               │
│      │   │       inputType: 'EntityInstanceNameSelect'               │
│      │   │                                                            │
│      │   │   budget_allocated_amt →                                  │
│      │   │     pattern-mapping.yaml: "*_amt" → currency              │
│      │   │     view-type-mapping.yaml:                               │
│      │   │       renderType: 'currency', style: { symbol: '$', decimals: 2 }│
│      │   │     edit-type-mapping.yaml:                               │
│      │   │       inputType: 'number', validation: { min: 0 }         │
│      │   │                                                            │
│      │   └─ Return: { metadata: { entityListOfInstancesTable: { viewType, editType } } }│
│      │                                                                │
│      ├─ Response received (metadata only, ~5KB)                      │
│      ├─ Store in TanStack Query cache                                │
│      ├─ Store in Dexie: pmoDb.entityInstanceMetadata.put(...)        │
│      └─ Component re-renders with metadata ✅                        │
│                                                                       │
│  Query 2: DATA FETCH                                                 │
│  ─────────────────                                                   │
│  const { data: formattedProjects, isLoading } =                      │
│    useFormattedEntityList('project', { limit: 50, offset: 0 });     │
│                                                                       │
│  TanStack Query checks cache:                                        │
│  ├─ queryKey: ['entity-list', 'project', { limit: 50, offset: 0 }]  │
│  │                                                                    │
│  ├─ CACHE HIT (stale < 2min):                                        │
│  │   ├─ Return cached RAW data from memory                           │
│  │   ├─ Format-at-read (select function) executes:                   │
│  │   │   ├─ Input: [{ dl__project_stage: 'planning', budget: 50000 }]│
│  │   │   ├─ useFormattedEntityData(rawData, metadata)                │
│  │   │   │   ├─ Subscribe to datalabel cache (reactive)              │
│  │   │   │   ├─ For each row:                                        │
│  │   │   │   │   ├─ Format dl__project_stage:                        │
│  │   │   │   │   │   └─ getDatalabelSync('dl__project_stage')        │
│  │   │   │   │   │       └─ Find option with code='planning'         │
│  │   │   │   │   │       └─ display: 'Planning'                      │
│  │   │   │   │   │       └─ styles: 'bg-blue-100 text-blue-800'      │
│  │   │   │   │   │                                                    │
│  │   │   │   │   └─ Format budget_allocated_amt:                     │
│  │   │   │   │       └─ renderType: 'currency'                       │
│  │   │   │   │       └─ display: '$50,000.00'                        │
│  │   │   │   │                                                        │
│  │   │   │   └─ Output: { raw, display, styles }                     │
│  │   │   └─ Memoized (only re-runs if rawData or metadata changes)   │
│  │   └─ Component receives formatted data ✅                         │
│  │                                                                    │
│  └─ CACHE MISS:                                                      │
│      ├─ isLoading = true → Component shows <LoadingSpinner />        │
│      ├─ Execute API call:                                            │
│      │   GET /api/v1/project?limit=50&offset=0                       │
│      │                                                                │
│      │   Backend (apps/api/src/modules/project/routes.ts):           │
│      │   ├─ RBAC Filtering:                                          │
│      │   │   const rbacCondition = await entityInfra.                │
│      │   │     get_entity_rbac_where_condition(                      │
│      │   │       userId, 'project', Permission.VIEW, 'e'             │
│      │   │     );                                                     │
│      │   │   // Returns SQL: EXISTS (SELECT 1 FROM entity_rbac ...)  │
│      │   │                                                            │
│      │   ├─ Auto-Filters:                                            │
│      │   │   const autoFilters = buildAutoFilters('e', request.query,│
│      │   │     { searchFields: ['name', 'code', 'descr'] }           │
│      │   │   );                                                       │
│      │   │   // Detects: ?dl__project_stage=planning                 │
│      │   │   //   → sql`e.dl__project_stage = 'planning'`            │
│      │   │                                                            │
│      │   ├─ SQL Query (Route owns query structure):                  │
│      │   │   SELECT                                                   │
│      │   │     e.*,                                                   │
│      │   │     b.name as business_name                               │
│      │   │   FROM app.project e                                      │
│      │   │   LEFT JOIN app.business b ON e.business_id = b.id        │
│      │   │   WHERE ${rbacCondition}                                  │
│      │   │     AND e.active_flag = true                              │
│      │   │     AND ${autoFilters}                                    │
│      │   │   ORDER BY e.created_ts DESC                              │
│      │   │   LIMIT 50 OFFSET 0                                       │
│      │   │                                                            │
│      │   │   Result: [                                                │
│      │   │     {                                                      │
│      │   │       id: 'uuid-1',                                        │
│      │   │       code: 'PROJ-001',                                    │
│      │   │       name: 'Kitchen Renovation',                          │
│      │   │       dl__project_stage: 'planning',                       │
│      │   │       manager__employee_id: 'uuid-james',                  │
│      │   │       budget_allocated_amt: 50000,                         │
│      │   │       business_name: 'Huron Home Services'                 │
│      │   │     },                                                     │
│      │   │     // ... 49 more rows                                    │
│      │   │   ]                                                        │
│      │   │                                                            │
│      │   ├─ build_ref_data_entityInstance():                         │
│      │   │   // Scan data for entity reference fields                │
│      │   │   // (fields ending with __*_id)                          │
│      │   │   // Build O(1) lookup table:                             │
│      │   │   {                                                        │
│      │   │     'employee': {                                          │
│      │   │       'uuid-james': 'James Miller',                        │
│      │   │       'uuid-sarah': 'Sarah Johnson'                        │
│      │   │     }                                                      │
│      │   │   }                                                        │
│      │   │                                                            │
│      │   └─ generateEntityResponse():                                │
│      │       {                                                        │
│      │         data: [...],  // 50 raw rows                           │
│      │         ref_data_entityInstance: {                             │
│      │           employee: { 'uuid-james': 'James Miller', ... }      │
│      │         },                                                     │
│      │         metadata: {                                            │
│      │           entityListOfInstancesTable: {                        │
│      │             viewType: { ... },                                 │
│      │             editType: { ... }                                  │
│      │           }                                                    │
│      │         },                                                     │
│      │         total: 127,                                            │
│      │         limit: 50,                                             │
│      │         offset: 0                                              │
│      │       }                                                        │
│      │                                                                │
│      ├─ Response received (~50KB for 50 rows)                        │
│      ├─ Store RAW data in TanStack Query cache                       │
│      ├─ Store RAW data in Dexie: pmoDb.entityInstanceData.put(...)   │
│      ├─ Format-at-read (select) executes                             │
│      └─ Component receives formatted data ✅                         │
│                                                                       │
│  ↓                                                                    │
│                                                                       │
│  STEP 3: COMPONENT RENDER                                            │
│  ──────────────────────                                              │
│  if (!viewType) {                                                    │
│    return <LoadingSpinner />;  // Metadata still loading             │
│  }                                                                    │
│                                                                       │
│  if (isLoading) {                                                    │
│    return <SkeletonTable />;  // Data still loading                  │
│  }                                                                    │
│                                                                       │
│  return (                                                            │
│    <EntityListOfInstancesTable                                       │
│      data={formattedProjects}  // { raw, display, styles }[]         │
│      metadata={{ viewType, editType }}                               │
│      onCellSave={handleCellSave}                                     │
│    />                                                                │
│  );                                                                   │
│                                                                       │
│  ↓                                                                    │
│                                                                       │
│  STEP 4: TABLE RENDERS ROWS                                          │
│  ────────────────────────                                            │
│  formattedProjects.map((row, idx) => (                               │
│    <tr key={row.raw.id}>                                             │
│      {columns.map(col => {                                           │
│        const fieldMeta = viewType[col.key];                          │
│        const cellValue = row.raw[col.key];                           │
│                                                                       │
│        return (                                                      │
│          <td key={col.key}>                                          │
│            <FieldRenderer                                            │
│              field={fieldMeta}                                       │
│              value={cellValue}                                       │
│              isEditing={false}                                       │
│              formattedData={{                                        │
│                display: row.display,                                 │
│                styles: row.styles                                    │
│              }}                                                      │
│            />                                                        │
│          </td>                                                       │
│        );                                                            │
│      })}                                                             │
│    </tr>                                                             │
│  ))                                                                   │
│                                                                       │
│  ↓                                                                    │
│                                                                       │
│  STEP 5: FIELDRENDERER RESOLVES COMPONENTS                           │
│  ───────────────────────────────────────                             │
│  Field: dl__project_stage                                            │
│  ├─ fieldMeta.renderType = 'badge'                                   │
│  ├─ ViewComponentRegistry.get('badge') → BadgeDisplay               │
│  └─ Renders: <span className="badge bg-blue-100">Planning</span>    │
│                                                                       │
│  Field: manager__employee_id                                         │
│  ├─ fieldMeta.renderType = 'entityInstanceId'                        │
│  ├─ ViewComponentRegistry.get('entityInstanceId') → EntityInstanceDisplay│
│  ├─ Resolves: ref_data_entityInstance['employee']['uuid-james']     │
│  └─ Renders: <span>James Miller</span>                              │
│                                                                       │
│  Field: budget_allocated_amt                                         │
│  ├─ fieldMeta.renderType = 'currency'                                │
│  ├─ ViewComponentRegistry.get('currency') → CurrencyDisplay         │
│  └─ Renders: <span className="font-mono">$50,000.00</span>          │
│                                                                       │
│  ↓                                                                    │
│                                                                       │
│  STEP 6: UI DISPLAYED ✅                                             │
│  ─────────────────────                                               │
│  User sees fully rendered table with:                                │
│  • Colored badges (Project Stage)                                    │
│  • Resolved names (Manager: James Miller)                            │
│  • Formatted currency ($50,000.00)                                   │
│  • All data cached for instant subsequent loads                      │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 Complete Request Flow (GET Single Instance)

```
┌──────────────────────────────────────────────────────────────────────┐
│       COMPLETE FLOW: User Clicks Project Row → /project/{id}         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  STEP 1: USER ACTION                                                 │
│  ────────────────────                                                │
│  User clicks "Kitchen Renovation" row in table                       │
│  → Navigate to /project/61203bac-101b-28d6-7a15-2176c15a0b1c         │
│                                                                       │
│  ↓                                                                    │
│                                                                       │
│  STEP 2: PAGE MOUNT (EntitySpecificInstancePage.tsx)                 │
│  ─────────────────────────────────────────────────────               │
│  const { entityCode, id } = useParams();  // 'project', 'uuid'       │
│                                                                       │
│  Query 1: METADATA FETCH                                             │
│  ────────────────────────                                            │
│  const { viewType, editType, isLoading } =                           │
│    useEntityInstanceMetadata('project', 'entityInstanceFormContainer');│
│                                                                       │
│  (Same flow as list page, but different metadataType)                │
│  GET /api/v1/project?content=metadata                                │
│  → Returns metadata for FORM view (not table view)                   │
│                                                                       │
│  Query 2: INSTANCE FETCH                                             │
│  ──────────────────────                                              │
│  const { data: project, isLoading } = useEntity<Project>('project', id);│
│                                                                       │
│  TanStack Query checks cache:                                        │
│  ├─ queryKey: ['entity-instance', 'project', 'uuid']                 │
│  │                                                                    │
│  ├─ CACHE HIT (stale < 5min):                                        │
│  │   └─ Return cached instance immediately ✅                        │
│  │                                                                    │
│  └─ CACHE MISS:                                                      │
│      ├─ Execute API call:                                            │
│      │   GET /api/v1/project/61203bac-101b-28d6-7a15-2176c15a0b1c    │
│      │                                                                │
│      │   Backend (apps/api/src/modules/project/routes.ts):           │
│      │   ├─ RBAC Check:                                              │
│      │   │   const canView = await entityInfra.check_entity_rbac(    │
│      │   │     userId, 'project', id, Permission.VIEW                │
│      │   │   );                                                       │
│      │   │   if (!canView) return 403 Forbidden;                     │
│      │   │                                                            │
│      │   ├─ SQL Query:                                               │
│      │   │   SELECT e.*, b.name as business_name                     │
│      │   │   FROM app.project e                                      │
│      │   │   LEFT JOIN app.business b ON e.business_id = b.id        │
│      │   │   WHERE e.id = $1 AND e.active_flag = true                │
│      │   │                                                            │
│      │   ├─ build_ref_data_entityInstance([project])                 │
│      │   └─ generateEntityResponse('project', [project])             │
│      │                                                                │
│      ├─ Store in TanStack Query + Dexie                              │
│      └─ Component re-renders with data ✅                            │
│                                                                       │
│  ↓                                                                    │
│                                                                       │
│  STEP 3: RENDER FORM CONTAINER                                       │
│  ───────────────────────────                                         │
│  <EntityInstanceFormContainer                                        │
│    formData={project.raw}                                            │
│    metadata={{ viewType, editType }}                                 │
│    mode="view"                                                       │
│    onInlineSave={handleInlineSave}                                   │
│  />                                                                   │
│                                                                       │
│  ↓                                                                    │
│                                                                       │
│  STEP 4: RENDER FIELDS                                               │
│  ──────────────────                                                  │
│  Object.entries(viewType).map(([key, fieldMeta]) => (                │
│    <div key={key} className="field-container">                       │
│      <label>{fieldMeta.label}</label>                                │
│      <FieldRenderer                                                  │
│        field={fieldMeta}                                             │
│        value={formData[key]}                                         │
│        isEditing={inlineEditingField === key}                        │
│        onChange={(v) => handleInlineValueChange(v)}                  │
│        formattedData={{ display, styles }}                           │
│      />                                                              │
│    </div>                                                            │
│  ))                                                                   │
│                                                                       │
│  ↓                                                                    │
│                                                                       │
│  STEP 5: RENDER CHILD TABS                                           │
│  ───────────────────────                                             │
│  <DynamicChildEntityTabs                                             │
│    parentEntityCode="project"                                        │
│    parentEntityId={id}                                               │
│    childEntityCodes={['task', 'cost', 'attachment']}                 │
│  />                                                                   │
│                                                                       │
│  For each child tab:                                                 │
│  └─ Lazy load when tab clicked:                                      │
│      GET /api/v1/project/{id}/task                                   │
│      → Factory-generated endpoint with parent filtering              │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.3 Complete Update Flow (Inline Edit)

This is the MOST CRITICAL flow - it demonstrates optimistic updates, portal dropdowns, and real-time sync.

```
┌──────────────────────────────────────────────────────────────────────┐
│    COMPLETE FLOW: User Inline Edits Manager Field (Dropdown)         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  INITIAL STATE:                                                      │
│  Field: Manager Employee Name                                        │
│  Current Value: James Miller (uuid-james)                            │
│  Desired Value: Sarah Johnson (uuid-sarah)                           │
│                                                                       │
│  ↓                                                                    │
│                                                                       │
│  STEP 1: USER ACTION - ENTER EDIT MODE                               │
│  ───────────────────────────────────────                             │
│  User long-presses "Manager Employee Name" field (500ms hold)        │
│                                                                       │
│  EntityInstanceFormContainer.handleLongPressStart():                 │
│  ├─ longPressTimer = setTimeout(() => {                              │
│  │   enterInlineEditMode('manager__employee_id');                    │
│  │ }, 500);                                                           │
│  │                                                                    │
│  └─ After 500ms:                                                     │
│      ├─ setInlineEditingField('manager__employee_id');               │
│      ├─ setInlineEditValue('uuid-james');  // Current value          │
│      └─ editingFieldRef.current = field container element            │
│                                                                       │
│  ↓                                                                    │
│                                                                       │
│  STEP 2: RENDER EDIT COMPONENT                                       │
│  ───────────────────────────                                         │
│  FieldRenderer re-renders with isEditing=true:                       │
│  ├─ field.inputType = 'EntityInstanceNameSelect'                     │
│  ├─ EditComponentRegistry.get('EntityInstanceNameSelect')            │
│  └─ Renders: <EntityInstanceNameSelectEdit />                        │
│                                                                       │
│  EntityInstanceNameSelectEdit mounts:                                │
│  ├─ <EntityInstanceNameSelect                                        │
│  │    entityCode="employee"                                          │
│  │    value="uuid-james"                                             │
│  │    onChange={(uuid, label) => { ... }}                            │
│  │  />                                                               │
│  │                                                                    │
│  └─ EntityInstanceNameSelect component:                              │
│      ├─ Fetch employee options:                                      │
│      │   useEntityList<Employee>('employee', { limit: 100 })         │
│      │   → Returns: [{ id: 'uuid-james', name: 'James Miller' }, ...]│
│      │                                                                │
│      ├─ Render closed dropdown button:                               │
│      │   <button ref={buttonRef} onClick={toggleDropdown}>           │
│      │     James Miller ▼                                            │
│      │   </button>                                                   │
│      │                                                                │
│      └─ Register click-outside handler:                              │
│          document.addEventListener('mousedown', handleClickOutside); │
│                                                                       │
│  ↓                                                                    │
│                                                                       │
│  STEP 3: USER CLICKS DROPDOWN BUTTON                                 │
│  ─────────────────────────────────                                   │
│  User clicks dropdown button → toggleDropdown()                      │
│  ├─ setIsOpen(true)                                                  │
│  └─ Render portal dropdown menu:                                     │
│      {createPortal(                                                  │
│        <div                                                          │
│          ref={dropdownRef}                                           │
│          data-dropdown-portal=""  ← CRITICAL ATTRIBUTE               │
│          style={{                                                    │
│            position: 'absolute',                                     │
│            top: buttonRect.bottom + 4,                               │
│            left: buttonRect.left,                                    │
│            zIndex: 9999                                              │
│          }}                                                          │
│        >                                                             │
│          <input                                                      │
│            type="search"                                             │
│            placeholder="Search employees..."                         │
│            value={searchTerm}                                        │
│            onChange={(e) => setSearchTerm(e.target.value)}           │
│          />                                                          │
│          {filteredOptions.map(option => (                            │
│            <div                                                      │
│              key={option.id}                                         │
│              onClick={() => selectOption(option.id, option.name)}    │
│              className={highlightedIndex === i ? 'highlighted' : ''}│
│            >                                                         │
│              {option.name}                                           │
│            </div>                                                    │
│          ))}                                                         │
│        </div>,                                                       │
│        document.body  ← Rendered at root, outside table overflow     │
│      )}                                                              │
│                                                                       │
│  ↓                                                                    │
│                                                                       │
│  STEP 4: USER SELECTS OPTION                                         │
│  ─────────────────────────                                           │
│  User clicks "Sarah Johnson" option in dropdown                      │
│                                                                       │
│  Event Order (CRITICAL):                                             │
│  ├─ 1. mousedown event fires                                         │
│  │    ├─ EntityInstanceFormContainer.handleClickOutside() executes:  │
│  │    │   ├─ Check: editingFieldRef.contains(target)? NO             │
│  │    │   ├─ Check: target.closest('[data-dropdown-portal]')? YES ✅ │
│  │    │   └─ RETURN EARLY (does not call handleInlineSave)          │
│  │    │                                                               │
│  │    └─ EntityInstanceNameSelect.handleClickOutside() executes:     │
│  │        ├─ Check: buttonRef.contains(target)? NO                   │
│  │        ├─ Check: dropdownRef.contains(target)? YES ✅             │
│  │        └─ RETURN EARLY (does not close dropdown)                 │
│  │                                                                    │
│  └─ 2. click event fires                                             │
│      └─ selectOption('uuid-sarah', 'Sarah Johnson') executes:        │
│          ├─ setLocalValue('uuid-sarah');  // Instant UI update       │
│          ├─ setLocalLabel('Sarah Johnson');                          │
│          ├─ onChange('uuid-sarah', 'Sarah Johnson');  ← Calls parent │
│          │                                                            │
│          │   EntityInstanceNameSelectEdit.onChange():                │
│          │   └─ onChange('uuid-sarah');  ← Calls parent              │
│          │                                                            │
│          │       FieldRenderer.onChange():                           │
│          │       └─ onChange('uuid-sarah');  ← Calls parent          │
│          │                                                            │
│          │           EntityInstanceFormContainer.handleInlineValueChange():│
│          │           └─ setInlineEditValue('uuid-sarah'); ✅         │
│          │                                                            │
│          ├─ setIsOpen(false);  // Close dropdown                     │
│          ├─ setSearchTerm('');                                       │
│          └─ setHighlightedIndex(-1);                                 │
│                                                                       │
│  STATE UPDATED:                                                      │
│  • inlineEditingField = 'manager__employee_id'                       │
│  • inlineEditValue = 'uuid-sarah' (NEW)                              │
│  • formData['manager__employee_id'] = 'uuid-james' (OLD - unchanged) │
│                                                                       │
│  ↓                                                                    │
│                                                                       │
│  STEP 5: USER CLICKS OUTSIDE FIELD                                   │
│  ───────────────────────────────                                     │
│  User clicks anywhere outside the field container                    │
│                                                                       │
│  Event:                                                              │
│  ├─ mousedown event fires                                            │
│  │                                                                    │
│  └─ EntityInstanceFormContainer.handleClickOutside():                │
│      ├─ Check: editingFieldRef.contains(target)? NO                  │
│      ├─ Check: target.closest('[data-dropdown-portal]')? NO          │
│      └─ TRULY OUTSIDE → Call handleInlineSave() ✅                   │
│                                                                       │
│  ↓                                                                    │
│                                                                       │
│  STEP 6: SAVE HANDLER                                                │
│  ──────────────────                                                  │
│  EntityInstanceFormContainer.handleInlineSave():                     │
│  ├─ const fieldKey = 'manager__employee_id';                         │
│  ├─ const newValue = inlineEditValue;  // 'uuid-sarah'               │
│  ├─ const oldValue = formData[fieldKey];  // 'uuid-james'            │
│  │                                                                    │
│  ├─ if (newValue === oldValue) return;  // No change, skip save      │
│  │                                                                    │
│  ├─ Compare: 'uuid-sarah' !== 'uuid-james' → DIFFERENT ✅            │
│  │                                                                    │
│  ├─ onInlineSave(fieldKey, newValue);  ← Call parent                 │
│  │                                                                    │
│  │   EntitySpecificInstancePage.handleInlineSave():                  │
│  │   └─ optimisticUpdateEntity(id, {                                 │
│  │       manager__employee_id: 'uuid-sarah'                          │
│  │     });                                                            │
│  │                                                                    │
│  └─ Clear editing state:                                             │
│      ├─ setInlineEditingField(null);                                 │
│      └─ setInlineEditValue(null);                                    │
│                                                                       │
│  ↓                                                                    │
│                                                                       │
│  STEP 7: OPTIMISTIC UPDATE                                           │
│  ────────────────────────                                            │
│  useEntityMutation.optimisticUpdateEntity():                         │
│                                                                       │
│  PHASE 1: INSTANT UI UPDATE (Optimistic)                             │
│  ─────────────────────────────────────────                           │
│  ├─ Get current cache:                                               │
│  │   const oldData = queryClient.getQueryData([                      │
│  │     'entity-instance', 'project', id                              │
│  │   ]);                                                              │
│  │                                                                    │
│  ├─ Create new data:                                                 │
│  │   const newData = {                                               │
│  │     ...oldData,                                                   │
│  │     manager__employee_id: 'uuid-sarah'                            │
│  │   };                                                               │
│  │                                                                    │
│  ├─ Update TanStack Query cache:                                     │
│  │   queryClient.setQueryData(                                       │
│  │     ['entity-instance', 'project', id],                           │
│  │     newData                                                        │
│  │   );                                                               │
│  │                                                                    │
│  ├─ Update Dexie:                                                    │
│  │   await pmoDb.entityInstance.put({                                │
│  │     entityCode: 'project',                                        │
│  │     entityId: id,                                                 │
│  │     data: newData,                                                │
│  │     updatedAt: Date.now()                                         │
│  │   });                                                              │
│  │                                                                    │
│  └─ COMPONENT RE-RENDERS INSTANTLY ✅                                │
│      User sees "Sarah Johnson" immediately!                          │
│                                                                       │
│  PHASE 2: API CALL (Background)                                      │
│  ────────────────────────────────                                    │
│  └─ await api.patch(`/api/v1/project/${id}`, {                       │
│      manager__employee_id: 'uuid-sarah'                              │
│    });                                                                │
│                                                                       │
│    Backend (apps/api/src/modules/project/routes.ts):                 │
│    ├─ RBAC Check:                                                    │
│    │   const canEdit = await entityInfra.check_entity_rbac(          │
│    │     userId, 'project', id, Permission.EDIT                      │
│    │   );                                                             │
│    │   if (!canEdit) return 403;                                     │
│    │                                                                  │
│    ├─ Transactional UPDATE:                                          │
│    │   const result = await entityInfra.update_entity({              │
│    │     entity_code: 'project',                                     │
│    │     entity_id: id,                                              │
│    │     primary_table: 'app.project',                               │
│    │     primary_updates: {                                          │
│    │       manager__employee_id: 'uuid-sarah'                        │
│    │     }                                                            │
│    │   });                                                            │
│    │                                                                  │
│    │   Transaction executes:                                         │
│    │   ├─ BEGIN;                                                     │
│    │   ├─ UPDATE app.project                                         │
│    │   │   SET manager__employee_id = 'uuid-sarah',                  │
│    │   │       updated_ts = NOW(),                                   │
│    │   │       version = version + 1                                 │
│    │   │   WHERE id = $1;                                            │
│    │   │                                                              │
│    │   ├─ (No registry update needed - name didn't change)           │
│    │   │                                                              │
│    │   ├─ INSERT INTO app.system_logging (                           │
│    │   │   entity_code, entity_id, operation_type, changed_at        │
│    │   │ ) VALUES (                                                  │
│    │   │   'project', 'uuid', 'UPDATE', NOW()                        │
│    │   │ );  ← Trigger fires automatically                           │
│    │   │                                                              │
│    │   └─ COMMIT;                                                    │
│    │                                                                  │
│    └─ Return updated entity                                          │
│                                                                       │
│  ↓                                                                    │
│                                                                       │
│  PHASE 3: SUCCESS HANDLING                                           │
│  ───────────────────────                                             │
│  .then((response) => {                                               │
│    // Invalidate queries (force refetch)                             │
│    queryClient.invalidateQueries({                                   │
│      queryKey: ['entity-instance', 'project', id]                    │
│    });                                                                │
│                                                                       │
│    queryClient.invalidateQueries({                                   │
│      queryKey: ['entity-list', 'project']                            │
│    });                                                                │
│                                                                       │
│    // Background refetch updates cache with server truth             │
│    // (usually same as optimistic update, but could differ)          │
│                                                                       │
│    toast.success('Manager updated successfully');                    │
│  })                                                                   │
│                                                                       │
│  .catch((error) => {                                                 │
│    // ROLLBACK optimistic update                                     │
│    queryClient.setQueryData(                                         │
│      ['entity-instance', 'project', id],                             │
│      oldData  // Restore original value                              │
│    );                                                                 │
│                                                                       │
│    await pmoDb.entityInstance.put({                                  │
│      entityCode: 'project',                                          │
│      entityId: id,                                                   │
│      data: oldData,                                                  │
│      updatedAt: Date.now()                                           │
│    });                                                                │
│                                                                       │
│    // Component re-renders with old value                            │
│    toast.error('Failed to update manager: ' + error.message);        │
│  });                                                                  │
│                                                                       │
│  ↓                                                                    │
│                                                                       │
│  STEP 8: WEBSOCKET REAL-TIME SYNC                                    │
│  ──────────────────────────────                                      │
│  60 seconds later, LogWatcher polls:                                 │
│  ├─ SELECT * FROM app.system_logging WHERE processed = false         │
│  ├─ Finds: { entity_code: 'project', entity_id: 'uuid', ... }        │
│  │                                                                    │
│  ├─ Broadcast INVALIDATE to all subscribed clients:                  │
│  │   ws.send(JSON.stringify({                                        │
│  │     type: 'INVALIDATE',                                           │
│  │     entity_code: 'project',                                       │
│  │     entity_id: 'uuid'                                             │
│  │   }));                                                             │
│  │                                                                    │
│  └─ Other users' browsers receive message:                           │
│      ├─ WebSocketManager.onmessage()                                 │
│      ├─ queryClient.invalidateQueries(['entity-instance', 'project', 'uuid'])│
│      ├─ Background refetch executes                                  │
│      ├─ Cache + Dexie updated                                        │
│      └─ Their UI updates to show "Sarah Johnson" ✅                  │
│                                                                       │
│  ↓                                                                    │
│                                                                       │
│  FINAL STATE:                                                        │
│  ────────────                                                        │
│  • User sees: Manager = "Sarah Johnson" (instant)                    │
│  • Database: manager__employee_id = 'uuid-sarah' (saved)             │
│  • Cache: TanStack Query + Dexie synced                              │
│  • Other users: Receive update via WebSocket (within 60s)            │
│  • Success toast: "Manager updated successfully"                     │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Section 4: UI/UX Interaction Patterns (CONTINUED)

This section now continues from where the outline left off, expanding the remaining subsections.

### 4.6 Touch Gestures & Mobile Support

While the PMO platform is primarily desktop-focused, key touch interactions are supported:

**Long-Press Detection**:
```typescript
// apps/web/src/components/shared/entity/EntityInstanceFormContainer.tsx

const handleTouchStart = (event: React.TouchEvent, fieldKey: string) => {
  event.preventDefault();

  const touch = event.touches[0];
  touchStartRef.current = { x: touch.clientX, y: touch.clientY };

  longPressTimer.current = setTimeout(() => {
    enterInlineEditMode(fieldKey);
  }, 500);  // 500ms hold to activate
};

const handleTouchMove = (event: React.TouchEvent) => {
  if (!touchStartRef.current) return;

  const touch = event.touches[0];
  const dx = Math.abs(touch.clientX - touchStartRef.current.x);
  const dy = Math.abs(touch.clientY - touchStartRef.current.y);

  // Cancel long-press if finger moved > 10px
  if (dx > 10 || dy > 10) {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }
};

const handleTouchEnd = () => {
  if (longPressTimer.current) {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }
  touchStartRef.current = null;
};
```

**Viewport-Aware Dropdown Positioning**:
```typescript
// apps/web/src/components/shared/ui/EntityInstanceNameSelect.tsx

const calculateDropdownPosition = () => {
  if (!buttonRef.current) return { top: 0, left: 0 };

  const buttonRect = buttonRef.current.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const dropdownHeight = 300; // Max dropdown height

  // Default: Position below button
  let top = buttonRect.bottom + 4;
  let left = buttonRect.left;

  // If dropdown would overflow bottom, position above instead
  if (top + dropdownHeight > viewportHeight) {
    top = buttonRect.top - dropdownHeight - 4;
  }

  // Ensure dropdown doesn't overflow left/right
  const viewportWidth = window.innerWidth;
  const dropdownWidth = 320;

  if (left + dropdownWidth > viewportWidth) {
    left = viewportWidth - dropdownWidth - 16;
  }

  return { top, left };
};
```

---

## Section 5: Component Rendering Architecture (CONTINUED)

### 5.7 Custom Field Renderers

While the platform has 35+ built-in field renderers, custom renderers can be added for specialized use cases:

**Example: Rating Field Renderer**:

```typescript
// apps/web/src/lib/fieldRenderer/customRenderers/RatingRenderer.tsx

interface RatingFieldProps extends ComponentRendererProps {
  field: FieldMetadata & { maxRating?: number };
}

export const RatingDisplay: React.FC<RatingFieldProps> = ({ value, field }) => {
  const maxRating = field.maxRating || 5;
  const rating = Number(value) || 0;

  return (
    <div className="flex gap-1">
      {Array.from({ length: maxRating }).map((_, i) => (
        <span key={i} className={i < rating ? 'text-yellow-500' : 'text-gray-300'}>
          ★
        </span>
      ))}
    </div>
  );
};

export const RatingInputEdit: React.FC<RatingFieldProps> = ({ value, field, onChange }) => {
  const maxRating = field.maxRating || 5;
  const [hoverRating, setHoverRating] = useState(0);
  const rating = Number(value) || 0;

  return (
    <div className="flex gap-1">
      {Array.from({ length: maxRating }).map((_, i) => (
        <button
          key={i}
          type="button"
          onMouseEnter={() => setHoverRating(i + 1)}
          onMouseLeave={() => setHoverRating(0)}
          onClick={() => onChange(i + 1)}
          className={
            i < (hoverRating || rating)
              ? 'text-yellow-500 hover:text-yellow-600'
              : 'text-gray-300 hover:text-gray-400'
          }
        >
          ★
        </button>
      ))}
    </div>
  );
};

// Register custom renderers
ViewComponentRegistry.set('rating', RatingDisplay);
EditComponentRegistry.set('rating', RatingInputEdit);
```

**Backend Pattern Detection (YAML-Based v11.0.0+)**:

> **IMPORTANT**: As of v11.0.0, pattern detection uses **YAML configuration files**, NOT hardcoded TypeScript functions.
>
> See: [YAML_PATTERN_DETECTION_SYSTEM.md](YAML_PATTERN_DETECTION_SYSTEM.md) for complete documentation.

**Quick Example**:

```yaml
# pattern-mapping.yaml - Map column name to business type
patterns:
  - { pattern: "*_rating", exact: false, fieldBusinessType: rating }
  - { pattern: "*_score", exact: false, fieldBusinessType: score }
```

```yaml
# view-type-mapping.yaml - Define VIEW rendering
fieldBusinessTypes:
  rating:
    dtype: float
    entityListOfInstancesTable:
      renderType: number
      style: { width: "120px", max: 5, suffix: "/5" }
    entityInstanceFormContainer:
      renderType: number
      style: { max: 5, suffix: "/5" }
```

```yaml
# edit-type-mapping.yaml - Define EDIT inputs
fieldBusinessTypes:
  rating:
    dtype: float
    entityListOfInstancesTable:
      inputType: number
      validation: { min: 0, max: 5 }
      style: { step: 0.5 }
    entityInstanceFormContainer:
      inputType: number
      behavior: { editable: true }
      style: { max: 5, step: 0.5 }
      validation: { min: 0, max: 5 }
```

**No TypeScript code changes needed** - just edit YAML files and restart API server.

### 5.8 Conditional Field Visibility

Fields can be conditionally shown/hidden based on other field values:

```typescript
// Backend metadata can include visibility conditions
{
  "discount_pct": {
    "dtype": "float",
    "renderType": "percentage",
    "inputType": "number",
    "visible_when": {
      "field": "has_discount",
      "operator": "equals",
      "value": true
    }
  }
}

// Frontend evaluates conditions
const isFieldVisible = (fieldKey: string, fieldMeta: FieldMetadata) => {
  if (!fieldMeta.visible_when) return true;

  const { field, operator, value } = fieldMeta.visible_when;
  const fieldValue = formData[field];

  switch (operator) {
    case 'equals':
      return fieldValue === value;
    case 'not_equals':
      return fieldValue !== value;
    case 'in':
      return Array.isArray(value) && value.includes(fieldValue);
    case 'not_in':
      return Array.isArray(value) && !value.includes(fieldValue);
    default:
      return true;
  }
};

// Usage in form
{Object.entries(viewType)
  .filter(([key, meta]) => isFieldVisible(key, meta))
  .map(([key, meta]) => (
    <FieldRenderer key={key} field={meta} value={formData[key]} />
  ))
}
```

---

## Section 6: Reactive Entity Field Pattern (Core Pattern)

### 6.1 Overview - The Two Core Problems

The Reactive Entity Field Pattern solves two critical challenges in metadata-driven enterprise UIs:

1. **Async Metadata Loading** - Handling undefined states during TanStack Query cache hydration
2. **Portal Dropdown Interactions** - Preventing click-outside handlers from racing with dropdown selections

This pattern is the foundation of PMO's universal entity field rendering system, enabling a single codebase to render 27+ entity types with 200+ field types across 3 universal pages.

### 6.2 Problem 1: Metadata Loading Race Condition

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              METADATA LOADING TIMELINE (TanStack Query)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  T=0ms    Component mounts                                                  │
│           useEntityInstanceMetadata('project', 'formContainer')             │
│           ↓                                                                  │
│  T=0ms    TanStack Query checks cache → MISS                                │
│           Returns: { viewType: undefined, editType: undefined }             │
│           ↓                                                                  │
│  T=0ms    Component renders with undefined metadata                         │
│           formMetadata = useMemo(() => {                                    │
│             if (!viewType) return null;  // ✅ Correctly detects loading   │
│           })                                                                 │
│           ↓                                                                  │
│  T=50ms   TanStack Query fetches API                                        │
│           GET /api/v1/project?content=metadata                              │
│           ↓                                                                  │
│  T=100ms  API responds with metadata                                        │
│           { viewType: {...}, editType: {...} }                              │
│           ↓                                                                  │
│  T=100ms  TanStack Query updates cache                                      │
│           viewType changes: undefined → { id: {...}, name: {...} }         │
│           ↓                                                                  │
│  T=100ms  Component re-renders                                              │
│           formMetadata now has data ✅                                      │
│           FieldRenderer can resolve components                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Anti-Pattern (v1.0.0 - BROKEN)**:
```typescript
// ❌ Returns empty object during load
return {
  viewType: query.data?.viewType ?? {},  // {} when loading
  editType: query.data?.editType ?? {},  // {} when loading
};

// Consumer can't distinguish loading from empty
if (Object.keys(viewType).length === 0) {
  return null;  // False positive - treats loading as "no metadata"
}
```

**Correct Pattern (v1.1.0 - FIXED)**:
```typescript
// ✅ Returns undefined during load
return {
  viewType: query.data?.viewType,  // undefined when loading
  editType: query.data?.editType,  // undefined when loading
};

// Consumer can distinguish loading from empty
if (!viewType) {
  return null;  // Correctly handles undefined (loading) state
}
```

### 6.3 Problem 2: Portal Dropdown Click-Outside Race

```
┌─────────────────────────────────────────────────────────────────────────────┐
│           PORTAL DROPDOWN EVENT FLOW (React Portal + Event Order)           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  User Action: Click dropdown option "Sarah Johnson"                         │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ DOM Structure                                                          │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                        │ │
│  │  <div ref={editingFieldRef}>                ← Parent container        │ │
│  │    <div ref={containerRef}>                 ← Trigger button          │ │
│  │      Manager Employee Name ▾                                          │ │
│  │    </div>                                                             │ │
│  │  </div>                                                               │ │
│  │                                                                        │ │
│  │  Portal (at document.body):                                           │ │
│  │  <div data-dropdown-portal ref={dropdownRef}>  ← Portal dropdown     │ │
│  │    <div onClick={selectOption}>Sarah Johnson</div>  ← Click target   │ │
│  │  </div>                                                               │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  Event Timeline:                                                             │
│  ─────────────                                                               │
│  T=0ms    mousedown event fires                                             │
│           ↓                                                                  │
│  T=1ms    EntityInstanceFormContainer.handleClickOutside() (Phase 1)        │
│           • Check: editingFieldRef.contains(option)? NO                     │
│           • Check: option.closest('[data-dropdown-portal]')? YES ✅         │
│           • RETURN EARLY (does not call handleInlineSave)                   │
│           ↓                                                                  │
│  T=2ms    EntityInstanceNameSelect.handleClickOutside() (Phase 2)           │
│           • Check: containerRef.contains(option)? NO                        │
│           • Check: dropdownRef.contains(option)? YES ✅                     │
│           • RETURN EARLY (does not close dropdown)                          │
│           ↓                                                                  │
│  T=10ms   click event fires (after mousedown completes)                     │
│           ↓                                                                  │
│  T=11ms   EntityInstanceNameSelect.selectOption() onClick handler           │
│           • onChange(uuid, label) fires                                     │
│           • handleInlineValueChange(uuid) updates state                     │
│           • setIsOpen(false) closes dropdown                                │
│           • Value captured ✅                                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Anti-Pattern (v1.0.0 - BROKEN)**:
```typescript
// ❌ Only checks parent container
const handleClickOutside = (event: MouseEvent) => {
  if (editingFieldRef.current && !editingFieldRef.current.contains(event.target as Node)) {
    handleInlineSave();  // Fires when clicking dropdown options!
  }
};
```

**Correct Pattern (v1.1.0 - FIXED)**:
```typescript
// ✅ Checks BOTH parent container AND portal dropdowns
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node;

  // Check 1: Inside our managed element?
  if (editingFieldRef.current && editingFieldRef.current.contains(target)) {
    return;
  }

  // Check 2: Inside ANY portal dropdown? (Generic detection)
  const isClickInsideDropdown = (target as Element).closest?.('[data-dropdown-portal]');
  if (isClickInsideDropdown) {
    return;  // Let dropdown handle it
  }

  // Truly outside - safe to trigger action
  handleInlineSave();
};
```

### 6.4 The Unified Pattern: 5 Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REACTIVE ENTITY FIELD ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LAYER 1: Metadata Fetching (TanStack Query + Nullable Types)               │
│  ──────────────────────────────────────────────────────────                 │
│  • useEntityInstanceMetadata() returns undefined during load                │
│  • Type: Record<string, unknown> | undefined (not {})                       │
│  • Consumer checks: if (!viewType) return null;                             │
│                                                                              │
│  LAYER 2: Reactive Formatting (Format-at-Read + Cache Subscription)         │
│  ────────────────────────────────────────────────────────────               │
│  • useFormattedEntityData() subscribes to datalabel cache                   │
│  • Re-formats when badge colors change in settings                          │
│  • Output: { raw, display, styles }                                         │
│                                                                              │
│  LAYER 3: Component Registry (Metadata-Driven Resolution)                   │
│  ──────────────────────────────────────────────────                         │
│  • ViewComponentRegistry: renderType → React component                      │
│  • EditComponentRegistry: inputType → React component                       │
│  • Registered at app init: registerAllComponents()                          │
│                                                                              │
│  LAYER 4: Portal Rendering (React Portal + Data Attribute)                  │
│  ───────────────────────────────────────────────────────                    │
│  • createPortal(dropdown, document.body)                                    │
│  • <div data-dropdown-portal=""> for generic detection                      │
│  • Component-level click-outside: checks BOTH refs                          │
│                                                                              │
│  LAYER 5: Portal-Aware Parent Handlers (Defense in Depth)                   │
│  ──────────────────────────────────────────────────────                     │
│  • Parent components check: target.closest('[data-dropdown-portal]')        │
│  • Returns early if click is inside any portal dropdown                     │
│  • Only triggers action for truly "outside" clicks                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.5 Implementation Checklist

#### ✅ For Metadata Hooks
- [ ] Return type allows `undefined`: `Record<string, unknown> | undefined`
- [ ] No default values: `query.data?.viewType` (not `?? {}`)
- [ ] Consumer checks: `if (!viewType) return null;`
- [ ] Loading state exposed: `isLoading` property
- [ ] Stale time configured: 30 min for metadata

#### ✅ For Dropdown Components
- [ ] Two refs: `containerRef` + `dropdownRef`
- [ ] Click-outside checks BOTH refs
- [ ] Event type: `mousedown` (not `click`)
- [ ] Portal rendering: `createPortal(menu, document.body)`
- [ ] Data attribute: `data-dropdown-portal=""`

#### ✅ For Parent Components
- [ ] Portal detection: `target.closest('[data-dropdown-portal]')`
- [ ] Early return if portal detected
- [ ] Event type: `mousedown` listener
- [ ] Cleanup: `removeEventListener` in useEffect return

---

## Section 7: Inline Editing Patterns

### 7.1 Form Inline Edit (Long-Press Pattern)

**Purpose**: Enable quick field editing in forms without entering full edit mode

**Trigger**: Long-press field for 500ms

**Pattern**:
```typescript
// EntityInstanceFormContainer.tsx

const [inlineEditingField, setInlineEditingField] = useState<string | null>(null);
const [inlineEditValue, setInlineEditValue] = useState<any>(null);
const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);
const editingFieldRef = useRef<HTMLDivElement | null>(null);

// Long-press detection
const handleFieldMouseDown = (fieldKey: string, currentValue: any, target: HTMLElement) => {
  const timer = setTimeout(() => {
    setInlineEditingField(fieldKey);
    setInlineEditValue(currentValue);
    editingFieldRef.current = target.closest('[data-field-container]');
  }, 500); // 500ms threshold

  setPressTimer(timer);
};

const handleFieldMouseUp = () => {
  if (pressTimer) {
    clearTimeout(pressTimer);
    setPressTimer(null);
  }
};

// Portal-aware click-outside
useEffect(() => {
  if (!inlineEditingField) return;

  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as Node;

    // Check 1: Inside editing field?
    if (editingFieldRef.current?.contains(target)) return;

    // Check 2: Inside ANY portal dropdown?
    if ((target as Element).closest?.('[data-dropdown-portal]')) {
      console.log('🎯 Click inside dropdown portal, ignoring');
      return;
    }

    // Truly outside - save and close
    console.log('🚪 Click outside detected, saving');
    handleInlineSave();
  };

  // Use mousedown (fires BEFORE click)
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, [inlineEditingField, handleInlineSave]);

// Save handler
const handleInlineSave = useCallback(() => {
  if (!inlineEditingField) return;

  const currentValue = formData[inlineEditingField];

  // Only save if changed
  if (inlineEditValue !== currentValue) {
    onInlineSave(inlineEditingField, inlineEditValue);
  }

  // Clear edit state
  setInlineEditingField(null);
  setInlineEditValue(null);
  editingFieldRef.current = null;
}, [inlineEditingField, inlineEditValue, formData, onInlineSave]);
```

**Flow**:
```
User Action: Long-press field (500ms)
  ↓
enterInlineEditMode(fieldKey)
  ├─ Set inlineEditingField = fieldKey
  ├─ Set inlineEditValue = currentValue
  └─ editingFieldRef.current = field container
  ↓
FieldRenderer renders with isEditing=true
  └─ EditComponentRegistry resolves component
  ↓
User interacts → onChange(newValue) → setInlineEditValue(newValue)
  ↓
User clicks outside → handleInlineSave()
  ├─ Compare inlineEditValue vs formData[fieldKey]
  ├─ If different → onInlineSave(fieldKey, inlineEditValue)
  └─ Clear inlineEditingField
```

### 7.2 Table Cell Edit (Click Pattern)

See FRONTEND_COMPONENT_ARCHITECTURE.md Section 7.2 for complete table cell editing implementation.

### 7.3 Optimistic Update Strategy

**Purpose**: Instant UI feedback with automatic rollback on error

See Section 3.3 for complete optimistic update implementation with three-phase pattern (onMutate, onSuccess, onError).

### 7.4 Error Handling & Rollback

See Section 7.3 for three-tier error handling (optimistic rollback, validation errors, network errors with retry).

### 7.5 Validation Patterns

See FRONTEND_COMPONENT_ARCHITECTURE.md Section 7.5 for field-level and form-level validation patterns.

---