# RxDB + RxState Complete Migration Analysis

> Comprehensive migration from Zustand + React Query to RxDB + RxState for unified local-first state management

**Version**: 3.0
**Date**: 2025-11-27
**Current Stack**: **Hybrid** - RxDB infrastructure (v9.0.0) + Legacy (Zustand + React Query)
**Target Stack**: RxDB (local-first database) + RxState (reactive state)
**Scope**: COMPLETE replacement - no Zustand, no React Query

---

## Migration Status 🚀

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MIGRATION PROGRESS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Phase 1: Infrastructure Setup    ███████████████████████████████ 100% ✅    │
│  Phase 2: Migrate Metadata Stores ███████████░░░░░░░░░░░░░░░░░░░░  35%      │
│  Phase 3: Migrate Entity Data     ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   0%      │
│  Phase 4: Migrate Edit State      ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   0%      │
│  Phase 5: Cleanup & Optimization  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   0%      │
│                                                                              │
│  OVERALL: ██████████░░░░░░░░░░░░░░░░░░░░░░ ~27%                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Phase 2a Completed! (2025-11-27)

**Sync Bridge Implementation:**
```
apps/web/src/
├── App.tsx                       ✅ DatabaseProvider added
├── db/
│   ├── DatabaseProvider.tsx      ✅ Initializes sync bridge
│   └── syncBridge.ts             ✅ NEW - Zustand ↔ RxDB sync
└── lib/hooks/
    └── useEntityQuery.ts         ✅ RxDB sync on fetch
```

**How It Works:**
1. DatabaseProvider initializes → calls `initializeSyncBridge()`
2. Sync bridge loads RxDB data → populates Zustand stores (sync access)
3. When React Query fetches data → updates Zustand + syncs to RxDB
4. Next session → RxDB data loads into Zustand immediately

**Files Modified:**
- `App.tsx`: Added `DatabaseWrapper` with `DatabaseProvider`
- `DatabaseProvider.tsx`: Calls `initializeSyncBridge()` on database ready
- `useEntityQuery.ts`: Added RxDB sync calls for datalabels, settings, entity types

---

### Phase 1 Completed! (2025-11-27)

**Files Created:**
```
apps/web/src/db/
├── index.ts                      ✅ Database initialization
├── DatabaseProvider.tsx          ✅ React context provider
├── schemas/
│   ├── index.ts                  ✅ Barrel export
│   ├── entity.schema.ts          ✅ Base entity factory
│   ├── project.schema.ts         ✅ Project schema
│   ├── task.schema.ts            ✅ Task schema
│   ├── employee.schema.ts        ✅ Employee schema
│   ├── datalabel.schema.ts       ✅ Datalabel schema
│   ├── entityType.schema.ts      ✅ Entity type schema
│   └── localDocuments.ts         ✅ RxState types
├── hooks/
│   ├── index.ts                  ✅ Barrel export
│   ├── useDatabase.ts            ✅ Database access
│   ├── useRxQuery.ts             ✅ Collection queries
│   ├── useRxDocument.ts          ✅ Single documents
│   ├── useRxMutation.ts          ✅ Mutations
│   ├── useRxState.ts             ✅ Local state
│   ├── useGlobalSettings.ts      ✅ → globalSettingsMetadataStore
│   ├── useDatalabels.ts          ✅ → datalabelMetadataStore
│   ├── useEntityTypes.ts         ✅ → entityCodeMetadataStore
│   ├── useComponentMetadata.ts   ✅ → entityComponentMetadataStore
│   ├── useEntityQuery.ts         ✅ Entity list/instance
│   └── useEntityEditState.ts     ✅ → useEntityEditStore
└── replication/
    ├── index.ts                  ✅ Replication setup
    ├── entityReplication.ts      ✅ Entity sync
    └── metadataReplication.ts    ✅ Metadata sync
```

**Packages Added:**
- `rxdb@16.21.0` ✅
- `rxjs@7.8.2` ✅
- `dexie@4.2.1` ✅

---

## Executive Summary

| Aspect | Assessment |
|--------|------------|
| **Feasibility** | ✅ Fully feasible - Phase 1 complete |
| **Complexity** | High (6-10 weeks remaining) |
| **Risk Level** | Medium |
| **LOC to Migrate** | ~4,500 lines across 15+ files |
| **Files Affected** | 50+ files (stores, hooks, contexts, components) |
| **Primary Benefits** | Offline-first, unified paradigm, persistent cache, real-time sync |
| **Primary Challenges** | Component updates, replication testing, conflict resolution |

---

## Table of Contents

1. [Current Architecture Analysis](#1-current-architecture-analysis)
2. [Target Architecture: RxDB + RxState](#2-target-architecture-rxdb--rxstate)
3. [Libraries Required](#3-libraries-required)
4. [Schema Design](#4-schema-design)
5. [File-by-File Migration Guide](#5-file-by-file-migration-guide)
6. [Replication Strategy](#6-replication-strategy)
7. [Migration Phases](#7-migration-phases)
8. [Benefits & Challenges](#8-benefits--challenges)
9. [Complete Checklist](#9-complete-checklist)

---

## 1. Current Architecture Analysis

### Current File Structure

```
apps/web/src/
├── App.tsx                           # QueryClientProvider + GC setup (~387 LOC)
├── stores/                           # 5 Zustand stores (~800 LOC total)
│   ├── index.ts                     # Barrel export
│   ├── globalSettingsMetadataStore.ts   # 134 LOC
│   ├── datalabelMetadataStore.ts        # 187 LOC
│   ├── entityComponentMetadataStore.ts  # 229 LOC
│   ├── entityCodeMetadataStore.ts       # 168 LOC
│   └── useEntityEditStore.ts            # 497 LOC
├── lib/
│   ├── hooks/                        # React Query hooks (~2,500 LOC)
│   │   ├── index.ts
│   │   ├── useEntityQuery.ts        # 1,200+ LOC - CORE
│   │   ├── useRefData.ts            # 300 LOC
│   │   └── useRefDataEntityInstanceCache.ts  # 400 LOC
│   ├── cache/                        # Cache utilities (~300 LOC)
│   │   ├── normalizedCache.ts       # 180 LOC
│   │   └── garbageCollection.ts     # 120 LOC
│   └── api.ts                        # API client (~500 LOC)
└── contexts/
    └── AuthContext.tsx               # Loads datalabels on login
```

### Current State Categories

| Category | Current Solution | Storage | TTL | Size (LOC) |
|----------|-----------------|---------|-----|------------|
| **Entity Data** | React Query | In-memory | 5 min | 1,200 |
| **Global Settings** | Zustand + sessionStorage | sessionStorage | 1 hour | 134 |
| **Datalabels** | Zustand + localStorage | localStorage | 1 hour | 187 |
| **Component Metadata** | Zustand + sessionStorage | sessionStorage | 15 min | 229 |
| **Entity Types** | Zustand + sessionStorage | sessionStorage | 1 hour | 168 |
| **Edit State** | Zustand (runtime) | Memory | - | 497 |
| **Normalized Cache** | Custom | Memory | - | 180 |
| **Ref Data Cache** | React Query | In-memory | 1 hour | 400 |

### Current Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────┐        ┌──────────────────────────┐   │
│  │  React Query        │        │  Zustand Stores (5)      │   │
│  │  QueryClientProvider│        │                          │   │
│  ├─────────────────────┤        ├──────────────────────────┤   │
│  │                     │        │                          │   │
│  │ useEntityInstanceList│       │ globalSettingsMetadata   │   │
│  │ useEntityInstance   │        │   └─sessionStorage       │   │
│  │ useFormattedEntity* │        │                          │   │
│  │                     │        │ datalabelMetadata        │   │
│  │ useMutation         │        │   └─localStorage         │   │
│  │                     │        │                          │   │
│  │ normalizedCache     │        │ entityComponentMetadata  │   │
│  │   (in-memory Map)   │        │   └─sessionStorage       │   │
│  │                     │        │                          │   │
│  │ refDataCache        │        │ entityCodeMetadata       │   │
│  │   (in-memory Map)   │        │   └─sessionStorage       │   │
│  │                     │        │                          │   │
│  └─────────────────────┘        │ useEntityEditStore       │   │
│                                 │   └─memory (no persist)  │   │
│                                 └──────────────────────────┘   │
│                                                                  │
│  Garbage Collection: garbageCollection.ts (5 min interval)      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Target Architecture: RxDB + RxState

### What is RxDB?

**RxDB** (Reactive Database) is a local-first, offline-capable NoSQL database for JavaScript. Key features:
- **IndexedDB Storage**: Data persists across browser sessions
- **Reactive Queries**: RxJS Observables for real-time updates
- **Schema Validation**: JSON Schema enforcement at write
- **Replication**: Built-in sync with REST/GraphQL/WebSocket backends
- **Multi-Tab Sync**: Changes propagate across browser tabs
- **Encryption**: AES-256 at rest (premium)

### What is RxState?

**RxState** is RxDB's reactive state management solution, replacing Zustand/Redux:
- **Document-based**: State is just an RxDB document
- **Reactive**: Subscribe to state changes via Observables
- **Persistent**: State survives page refresh (IndexedDB)
- **Typed**: Full TypeScript support with schemas

### Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    TARGET: RxDB + RxState                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    RxDatabase: 'pmo'                         ││
│  │                                                              ││
│  │  ┌───────────────────────────────────────────────────────┐  ││
│  │  │  Entity Collections (27+)                              │  ││
│  │  │  ├── project: RxCollection<ProjectDoc>                 │  ││
│  │  │  ├── task: RxCollection<TaskDoc>                       │  ││
│  │  │  ├── employee: RxCollection<EmployeeDoc>               │  ││
│  │  │  └── ... (all 27+ entity types)                        │  ││
│  │  │                                                         │  ││
│  │  │  Storage: IndexedDB (Dexie adapter)                    │  ││
│  │  │  Sync: REST Replication → Backend API                  │  ││
│  │  └───────────────────────────────────────────────────────┘  ││
│  │                                                              ││
│  │  ┌───────────────────────────────────────────────────────┐  ││
│  │  │  Metadata Collections                                  │  ││
│  │  │  ├── datalabel: RxCollection<DatalabelDoc>            │  ││
│  │  │  ├── entity_type: RxCollection<EntityTypeDoc>         │  ││
│  │  │  └── entity_instance: RxCollection<EntityInstanceDoc> │  ││
│  │  │                                                         │  ││
│  │  │  Storage: IndexedDB                                    │  ││
│  │  │  Sync: REST Replication (pull-only, reference data)    │  ││
│  │  └───────────────────────────────────────────────────────┘  ││
│  │                                                              ││
│  │  ┌───────────────────────────────────────────────────────┐  ││
│  │  │  RxState (Local Documents - No Sync)                   │  ││
│  │  │  ├── _local/global-settings (currency, date, etc.)    │  ││
│  │  │  ├── _local/component-metadata:{entityCode}           │  ││
│  │  │  ├── _local/edit-state:{entityCode}:{entityId}        │  ││
│  │  │  └── _local/ui-preferences                            │  ││
│  │  │                                                         │  ││
│  │  │  Storage: IndexedDB (persistent across sessions)       │  ││
│  │  │  Sync: NONE (local-only)                               │  ││
│  │  └───────────────────────────────────────────────────────┘  ││
│  │                                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  React Integration:                                              │
│  ├── DatabaseProvider (context)                                 │
│  ├── useRxDocument() - single document subscription             │
│  ├── useRxQuery() - collection query subscription               │
│  ├── useRxState() - local document state                        │
│  └── useRxMutation() - document mutations                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Paradigm Shifts

| Aspect | Current (Zustand + RQ) | Target (RxDB + RxState) |
|--------|------------------------|-------------------------|
| **Data Cache** | In-memory (React Query) | IndexedDB (persistent) |
| **State Management** | Zustand stores | RxDB local documents |
| **Reactivity** | React Query refetch | RxJS Observables |
| **Persistence** | sessionStorage/localStorage | IndexedDB (unified) |
| **Sync** | Manual API calls | Built-in replication |
| **Multi-Tab** | Not supported | Automatic |
| **Offline** | Not supported | Full support |
| **TTL Management** | Custom GC + staleTime | Replication intervals |

---

## 3. Libraries Required

### Package Installation

```bash
# Core RxDB
pnpm add rxdb rxjs

# Storage adapter (free, IndexedDB-based)
pnpm add dexie

# Optional: Better IndexedDB storage (premium, faster)
# pnpm add rxdb-premium

# React hooks for RxDB
# NOTE: rxdb-hooks is community-maintained, consider custom hooks
pnpm add rxdb-hooks

# For REST replication (custom handler needed)
# No additional package - use built-in replication plugin

# Dev dependencies
pnpm add -D @types/dexie
```

### package.json Additions

```json
{
  "dependencies": {
    "rxdb": "^15.25.0",
    "rxjs": "^7.8.1",
    "dexie": "^4.0.4"
  },
  "devDependencies": {
    "@types/dexie": "^1.3.1"
  }
}
```

### Packages to REMOVE

```json
{
  "dependencies": {
    // REMOVE these:
    "@tanstack/react-query": "^5.x",     // ❌ Replaced by RxDB queries
    "zustand": "^4.x"                     // ❌ Replaced by RxState
  }
}
```

### Bundle Size Impact

| Package | Gzipped Size | Purpose |
|---------|--------------|---------|
| **ADDING** | | |
| rxdb | ~45 KB | Core database |
| rxjs | ~30 KB | Reactive primitives |
| dexie | ~15 KB | IndexedDB wrapper |
| **Total Added** | **~90 KB** | |
| **REMOVING** | | |
| @tanstack/react-query | -13 KB | |
| zustand | -1 KB | |
| **Total Removed** | **-14 KB** | |
| **Net Change** | **+76 KB** | |

### Mitigation: Lazy Loading

```typescript
// Load RxDB only after auth (reduces initial bundle)
const DatabaseModule = React.lazy(() => import('./db'));

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Suspense fallback={<Loading />}>
      {isAuthenticated ? (
        <DatabaseModule>
          <AppRoutes />
        </DatabaseModule>
      ) : (
        <LoginForm />
      )}
    </Suspense>
  );
}
```

---

## 4. Schema Design

### Schema Architecture Overview

```
RxDatabase: 'pmo'
├── Collections (Synced with Backend)
│   ├── project          # 27+ entity collections
│   ├── task
│   ├── employee
│   ├── ... (all entities from d_* tables)
│   ├── datalabel        # Settings/reference data
│   └── entity_type      # Entity definitions
│
└── Local Documents (Not Synced - RxState)
    ├── _local/global-settings
    ├── _local/component-metadata:{code}
    ├── _local/edit-state:{code}:{id}
    └── _local/ui-preferences
```

### Entity Collection Schema (Generic Pattern)

```typescript
// apps/web/src/db/schemas/entity.schema.ts
import { RxJsonSchema, RxDocument, RxCollection } from 'rxdb';

/**
 * Generic Entity Document - base for all 27+ entity types
 *
 * RxDB requires:
 * - primaryKey: string field with maxLength
 * - _deleted: boolean for soft-delete sync
 * - _rev: string for conflict detection
 */
export interface BaseEntityDoc {
  id: string;                    // UUID primary key
  code?: string | null;          // Business code (e.g., 'PROJ-001')
  name: string;                  // Display name
  descr?: string | null;         // Description
  active_flag: boolean;          // Soft delete flag
  metadata?: Record<string, any>; // JSONB extension field
  created_ts: string;            // ISO timestamp
  updated_ts: string;            // ISO timestamp
  version: number;               // Optimistic locking

  // RxDB sync fields
  _deleted: boolean;             // Deleted flag for replication
  _rev?: string;                 // Revision for conflict detection
}

/**
 * Create schema for any entity collection
 *
 * @param entityCode - Entity type code (e.g., 'project')
 * @param additionalProperties - Entity-specific fields
 */
export function createEntitySchema<T extends BaseEntityDoc>(
  entityCode: string,
  additionalProperties: Record<string, any> = {}
): RxJsonSchema<T> {
  return {
    version: 0,  // Increment for migrations
    primaryKey: 'id',
    type: 'object',
    properties: {
      // Base fields
      id: {
        type: 'string',
        maxLength: 36  // UUID length
      },
      code: {
        type: ['string', 'null'],
        maxLength: 100
      },
      name: {
        type: 'string',
        maxLength: 500
      },
      descr: {
        type: ['string', 'null'],
        maxLength: 10000
      },
      active_flag: {
        type: 'boolean',
        default: true
      },
      metadata: {
        type: 'object',
        properties: {},
        additionalProperties: true
      },
      created_ts: {
        type: 'string',
        format: 'date-time'
      },
      updated_ts: {
        type: 'string',
        format: 'date-time'
      },
      version: {
        type: 'integer',
        minimum: 1,
        default: 1
      },

      // RxDB sync fields
      _deleted: {
        type: 'boolean',
        default: false
      },
      _rev: {
        type: 'string'
      },

      // Entity-specific fields
      ...additionalProperties
    },
    required: ['id', 'name', 'active_flag', '_deleted'],
    indexes: [
      'code',
      'active_flag',
      'updated_ts',
      ['active_flag', 'updated_ts']  // Compound index for sync queries
    ]
  };
}
```

### Project Schema (Example)

```typescript
// apps/web/src/db/schemas/project.schema.ts
import { createEntitySchema, BaseEntityDoc } from './entity.schema';

export interface ProjectDoc extends BaseEntityDoc {
  budget_allocated_amt?: number | null;
  budget_spent_amt?: number | null;
  manager__employee_id?: string | null;
  dl__project_stage?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  business_id?: string | null;
  office_id?: string | null;
}

export const projectSchema = createEntitySchema<ProjectDoc>('project', {
  budget_allocated_amt: { type: ['number', 'null'] },
  budget_spent_amt: { type: ['number', 'null'] },
  manager__employee_id: { type: ['string', 'null'], maxLength: 36 },
  dl__project_stage: { type: ['string', 'null'], maxLength: 100 },
  start_date: { type: ['string', 'null'], format: 'date' },
  end_date: { type: ['string', 'null'], format: 'date' },
  business_id: { type: ['string', 'null'], maxLength: 36 },
  office_id: { type: ['string', 'null'], maxLength: 36 }
});

// Add project-specific indexes
projectSchema.indexes = [
  ...projectSchema.indexes!,
  'manager__employee_id',
  'dl__project_stage',
  'business_id',
  ['active_flag', 'dl__project_stage']
];
```

### Datalabel Schema

```typescript
// apps/web/src/db/schemas/datalabel.schema.ts
import { RxJsonSchema } from 'rxdb';

export interface DatalabelDoc {
  id: string;                    // Composite: {datalabel_key}:{option_id}
  datalabel_key: string;         // e.g., 'project_stage'
  option_id: number;             // Original ID from backend
  name: string;                  // Display name
  descr?: string | null;
  color_code?: string | null;    // Badge color
  sort_order: number;
  parent_ids?: number[];         // DAG support
  active_flag: boolean;
  _deleted: boolean;
}

export const datalabelSchema: RxJsonSchema<DatalabelDoc> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 200 },
    datalabel_key: { type: 'string', maxLength: 100 },
    option_id: { type: 'integer' },
    name: { type: 'string', maxLength: 255 },
    descr: { type: ['string', 'null'], maxLength: 1000 },
    color_code: { type: ['string', 'null'], maxLength: 20 },
    sort_order: { type: 'integer', default: 0 },
    parent_ids: {
      type: 'array',
      items: { type: 'integer' },
      default: []
    },
    active_flag: { type: 'boolean', default: true },
    _deleted: { type: 'boolean', default: false }
  },
  required: ['id', 'datalabel_key', 'option_id', 'name'],
  indexes: [
    'datalabel_key',
    ['datalabel_key', 'sort_order'],
    ['datalabel_key', 'active_flag']
  ]
};
```

### Entity Type Schema

```typescript
// apps/web/src/db/schemas/entityType.schema.ts
import { RxJsonSchema } from 'rxdb';

export interface EntityTypeDoc {
  code: string;                  // Primary key: 'project', 'task', etc.
  name: string;
  label: string;
  icon?: string | null;
  descr?: string | null;
  child_entity_codes?: string[];
  parent_entity_codes?: string[];
  active_flag: boolean;
  _deleted: boolean;
}

export const entityTypeSchema: RxJsonSchema<EntityTypeDoc> = {
  version: 0,
  primaryKey: 'code',  // Use code as primary key (not UUID)
  type: 'object',
  properties: {
    code: { type: 'string', maxLength: 50 },
    name: { type: 'string', maxLength: 100 },
    label: { type: 'string', maxLength: 100 },
    icon: { type: ['string', 'null'], maxLength: 50 },
    descr: { type: ['string', 'null'], maxLength: 1000 },
    child_entity_codes: {
      type: 'array',
      items: { type: 'string' },
      default: []
    },
    parent_entity_codes: {
      type: 'array',
      items: { type: 'string' },
      default: []
    },
    active_flag: { type: 'boolean', default: true },
    _deleted: { type: 'boolean', default: false }
  },
  required: ['code', 'name', 'label'],
  indexes: ['active_flag']
};
```

### RxState Local Document Schemas

```typescript
// apps/web/src/db/schemas/localDocuments.ts

/**
 * Local documents use RxDB's _local prefix and don't sync
 * They persist in IndexedDB but are device-specific
 */

// Global Settings (replaces globalSettingsMetadataStore)
export interface GlobalSettingsLocal {
  currency: {
    symbol: string;
    decimals: number;
    locale: string;
    position: string;
    thousandsSeparator: string;
    decimalSeparator: string;
  };
  date: {
    style: string;
    locale: string;
    format: string;
  };
  timestamp: {
    style: string;
    locale: string;
    includeSeconds: boolean;
  };
  boolean: {
    trueLabel: string;
    falseLabel: string;
    trueColor: string;
    falseColor: string;
    trueIcon: string;
    falseIcon: string;
  };
  _updatedAt: number;  // Last update timestamp
}

// Component Metadata (replaces entityComponentMetadataStore)
export interface ComponentMetadataLocal {
  entityCode: string;
  componentName: string;
  viewType: Record<string, any>;
  editType: Record<string, any>;
  _updatedAt: number;
}

// Edit State (replaces useEntityEditStore)
export interface EditStateLocal {
  entityType: string;
  entityId: string;
  originalData: Record<string, any>;
  currentData: Record<string, any>;
  dirtyFields: string[];  // Array instead of Set (JSON-serializable)
  isEditing: boolean;
  undoStack: Array<{ field: string; value: any }>;
  redoStack: Array<{ field: string; value: any }>;
  _updatedAt: number;
}

// UI Preferences (new - optional)
export interface UIPreferencesLocal {
  sidebarCollapsed: boolean;
  defaultView: 'table' | 'grid' | 'kanban' | 'calendar';
  theme: 'light' | 'dark' | 'system';
  _updatedAt: number;
}
```

---

## 5. File-by-File Migration Guide

### Overview: Files to Create, Modify, Delete

```
apps/web/src/
├── db/                              # NEW: RxDB module
│   ├── index.ts                    # Database initialization
│   ├── DatabaseProvider.tsx        # React context provider
│   ├── schemas/                    # Collection schemas
│   │   ├── index.ts               # Schema exports
│   │   ├── entity.schema.ts       # Base entity schema factory
│   │   ├── project.schema.ts      # Project-specific schema
│   │   ├── task.schema.ts         # Task-specific schema
│   │   ├── employee.schema.ts     # Employee-specific schema
│   │   ├── datalabel.schema.ts    # Datalabel schema
│   │   ├── entityType.schema.ts   # Entity type schema
│   │   └── localDocuments.ts      # RxState type definitions
│   ├── replication/                # Sync handlers
│   │   ├── index.ts               # Replication setup
│   │   ├── entityReplication.ts   # Entity sync handler
│   │   └── metadataReplication.ts # Metadata sync handler
│   └── hooks/                      # RxDB React hooks
│       ├── index.ts               # Hook exports
│       ├── useDatabase.ts         # Database access hook
│       ├── useRxQuery.ts          # Collection query hook
│       ├── useRxDocument.ts       # Single document hook
│       ├── useRxState.ts          # Local document state hook
│       ├── useEntityQuery.ts      # Entity-specific hooks (NEW)
│       └── useRxMutation.ts       # Mutation hook
│
├── stores/                          # DELETE ENTIRE DIRECTORY
│   ├── index.ts                    # ❌ DELETE
│   ├── globalSettingsMetadataStore.ts   # ❌ DELETE
│   ├── datalabelMetadataStore.ts        # ❌ DELETE
│   ├── entityComponentMetadataStore.ts  # ❌ DELETE
│   ├── entityCodeMetadataStore.ts       # ❌ DELETE
│   └── useEntityEditStore.ts            # ❌ DELETE
│
├── lib/
│   ├── hooks/                        # MAJOR MODIFICATIONS
│   │   ├── index.ts                 # ✏️ MODIFY: Update exports
│   │   ├── useEntityQuery.ts        # ❌ DELETE (replaced by db/hooks)
│   │   ├── useRefData.ts            # ✏️ MODIFY: Use RxDB collections
│   │   └── useRefDataEntityInstanceCache.ts  # ❌ DELETE
│   │
│   ├── cache/                        # DELETE ENTIRE DIRECTORY
│   │   ├── normalizedCache.ts       # ❌ DELETE (RxDB handles this)
│   │   └── garbageCollection.ts     # ❌ DELETE (RxDB handles this)
│   │
│   └── api.ts                        # ✏️ MODIFY: Keep for replication
│
├── contexts/
│   └── AuthContext.tsx               # ✏️ MODIFY: Initialize DB on login
│
└── App.tsx                           # ✏️ MODIFY: Replace providers
```

---

### 5.1 Database Initialization

#### NEW: `apps/web/src/db/index.ts`

```typescript
/**
 * RxDB Database Initialization
 *
 * Creates and configures the local-first database with:
 * - 27+ entity collections (synced with backend)
 * - Metadata collections (datalabels, entity types)
 * - Local documents (RxState for UI state)
 *
 * WHY: Replaces both React Query (data cache) and Zustand (state)
 * with a unified, persistent, offline-capable database.
 */
import { createRxDatabase, addRxPlugin, RxDatabase, RxCollection } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { RxDBLocalDocumentsPlugin } from 'rxdb/plugins/local-documents';

// Schema imports
import { projectSchema, ProjectDoc } from './schemas/project.schema';
import { taskSchema, TaskDoc } from './schemas/task.schema';
import { employeeSchema, EmployeeDoc } from './schemas/employee.schema';
import { datalabelSchema, DatalabelDoc } from './schemas/datalabel.schema';
import { entityTypeSchema, EntityTypeDoc } from './schemas/entityType.schema';
// ... import all 27+ entity schemas

// Add plugins
addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBLocalDocumentsPlugin);

// Dev mode plugin (development only - adds validation warnings)
if (process.env.NODE_ENV === 'development') {
  addRxPlugin(RxDBDevModePlugin);
}

// Type definitions for database
export type PMODatabaseCollections = {
  project: RxCollection<ProjectDoc>;
  task: RxCollection<TaskDoc>;
  employee: RxCollection<EmployeeDoc>;
  datalabel: RxCollection<DatalabelDoc>;
  entity_type: RxCollection<EntityTypeDoc>;
  // ... all 27+ entity collections
};

export type PMODatabase = RxDatabase<PMODatabaseCollections>;

// Singleton database instance
let dbPromise: Promise<PMODatabase> | null = null;

/**
 * Get or create the database instance
 *
 * This is lazy-loaded and cached for the lifetime of the app.
 * Call this after authentication to initialize the database.
 */
export async function getDatabase(): Promise<PMODatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = createPMODatabase();
  return dbPromise;
}

/**
 * Create the PMO database with all collections
 */
async function createPMODatabase(): Promise<PMODatabase> {
  console.log('[RxDB] Creating database...');

  const db = await createRxDatabase<PMODatabaseCollections>({
    name: 'pmo_db',                    // Database name in IndexedDB
    storage: getRxStorageDexie(),      // Use Dexie.js for IndexedDB
    multiInstance: true,               // Allow multiple browser tabs
    eventReduce: true,                 // Optimize change events
    ignoreDuplicate: true,             // Allow re-creation after hot reload
    localDocuments: true               // Enable RxState local documents
  });

  console.log('[RxDB] Database created, adding collections...');

  // Add all entity collections
  await db.addCollections({
    // Entity data collections (synced with backend)
    project: { schema: projectSchema },
    task: { schema: taskSchema },
    employee: { schema: employeeSchema },
    // ... add all 27+ entity schemas

    // Metadata collections (synced, pull-only)
    datalabel: { schema: datalabelSchema },
    entity_type: { schema: entityTypeSchema }
  });

  console.log(`[RxDB] Added ${Object.keys(db.collections).length} collections`);

  return db;
}

/**
 * Destroy the database (for logout/cleanup)
 */
export async function destroyDatabase(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    await db.destroy();
    dbPromise = null;
    console.log('[RxDB] Database destroyed');
  }
}

/**
 * Clear all data but keep schema (for testing/reset)
 */
export async function clearAllCollections(): Promise<void> {
  const db = await getDatabase();

  for (const collectionName of Object.keys(db.collections)) {
    await db.collections[collectionName].remove();
  }

  console.log('[RxDB] All collections cleared');
}
```

---

### 5.2 Database Provider

#### NEW: `apps/web/src/db/DatabaseProvider.tsx`

```typescript
/**
 * DatabaseProvider - React context for RxDB access
 *
 * Provides:
 * - Database instance to all components
 * - Loading state during initialization
 * - Error handling for database failures
 *
 * WHY: Replaces QueryClientProvider from React Query.
 * Components use useDatabase() hook instead of useQueryClient().
 */
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { PMODatabase, getDatabase, destroyDatabase } from './index';
import { setupReplication } from './replication';
import { useAuth } from '../contexts/AuthContext';

interface DatabaseContextValue {
  db: PMODatabase | null;
  isLoading: boolean;
  error: Error | null;
  isOnline: boolean;
}

const DatabaseContext = createContext<DatabaseContextValue>({
  db: null,
  isLoading: true,
  error: null,
  isOnline: true
});

interface DatabaseProviderProps {
  children: ReactNode;
}

export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const { isAuthenticated, token } = useAuth();
  const [db, setDb] = useState<PMODatabase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize database when authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      // Not logged in - destroy database if exists
      destroyDatabase().catch(console.error);
      setDb(null);
      setIsLoading(false);
      return;
    }

    // Initialize database and start replication
    const initDatabase = async () => {
      setIsLoading(true);
      setError(null);

      try {
        console.log('[DatabaseProvider] Initializing database...');
        const database = await getDatabase();

        // Start background replication with auth token
        if (token) {
          await setupReplication(database, token);
        }

        setDb(database);
        console.log('[DatabaseProvider] Database ready');
      } catch (err) {
        console.error('[DatabaseProvider] Failed to initialize database:', err);
        setError(err instanceof Error ? err : new Error('Database initialization failed'));
      } finally {
        setIsLoading(false);
      }
    };

    initDatabase();
  }, [isAuthenticated, token]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Initializing database...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-destructive">
          <p className="font-semibold">Database Error</p>
          <p className="text-sm">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <DatabaseContext.Provider value={{ db, isLoading, error, isOnline }}>
      {children}
    </DatabaseContext.Provider>
  );
}

/**
 * Hook to access the database instance
 *
 * @throws Error if used outside DatabaseProvider or before initialization
 */
export function useDatabase(): PMODatabase {
  const context = useContext(DatabaseContext);

  if (!context.db) {
    throw new Error(
      'useDatabase must be used within DatabaseProvider and after initialization'
    );
  }

  return context.db;
}

/**
 * Hook to check online/offline status
 */
export function useOnlineStatus(): boolean {
  const context = useContext(DatabaseContext);
  return context.isOnline;
}
```

---

### 5.3 RxDB React Hooks

#### NEW: `apps/web/src/db/hooks/useRxQuery.ts`

```typescript
/**
 * useRxQuery - Subscribe to RxDB collection queries
 *
 * Replaces: useQuery from React Query
 *
 * Key differences:
 * - Reactive: Auto-updates when documents change
 * - Persistent: Data survives page refresh
 * - Offline: Works without network
 *
 * @example
 * // List all active projects
 * const { data, isLoading } = useRxQuery(
 *   'project',
 *   (collection) => collection.find({ selector: { active_flag: true } })
 * );
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { RxCollection, RxQuery, RxDocument, MangoQuery } from 'rxdb';
import { useDatabase } from './useDatabase';

export interface UseRxQueryOptions<T> {
  /** Skip query execution (for conditional queries) */
  enabled?: boolean;
  /** Custom selector for query */
  selector?: MangoQuery<T>['selector'];
  /** Sort order */
  sort?: MangoQuery<T>['sort'];
  /** Limit results */
  limit?: number;
  /** Skip results (pagination) */
  skip?: number;
}

export interface UseRxQueryResult<T> {
  data: T[];
  isLoading: boolean;
  error: Error | null;
  /** Re-execute the query */
  refetch: () => void;
  /** Total count matching selector (without limit) */
  count: number;
}

export function useRxQuery<T>(
  collectionName: string,
  options: UseRxQueryOptions<T> = {}
): UseRxQueryResult<T> {
  const db = useDatabase();
  const [data, setData] = useState<T[]>([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const {
    enabled = true,
    selector = {},
    sort,
    limit,
    skip
  } = options;

  // Build query from options
  const query = useMemo(() => {
    if (!enabled) return null;

    const collection = db.collections[collectionName] as RxCollection<T>;
    if (!collection) {
      console.error(`[useRxQuery] Collection "${collectionName}" not found`);
      return null;
    }

    let q = collection.find({ selector });

    if (sort) {
      q = q.sort(sort);
    }
    if (skip) {
      q = q.skip(skip);
    }
    if (limit) {
      q = q.limit(limit);
    }

    return q;
  }, [db, collectionName, enabled, JSON.stringify(selector), JSON.stringify(sort), limit, skip]);

  // Subscribe to query results
  useEffect(() => {
    if (!query) {
      setIsLoading(false);
      setData([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    const subscription = query.$.subscribe({
      next: (results: RxDocument<T>[]) => {
        const docs = results.map(doc => doc.toJSON() as T);
        setData(docs);
        setIsLoading(false);
      },
      error: (err: Error) => {
        console.error(`[useRxQuery] Query error for ${collectionName}:`, err);
        setError(err);
        setIsLoading(false);
      }
    });

    // Get count separately (without limit)
    const collection = db.collections[collectionName] as RxCollection<T>;
    collection.count({ selector }).exec().then(setCount);

    return () => subscription.unsubscribe();
  }, [query, db, collectionName, JSON.stringify(selector)]);

  const refetch = useCallback(() => {
    // RxDB queries are reactive, but we can force a re-subscription
    // by touching the collection
    const collection = db.collections[collectionName] as RxCollection<T>;
    if (collection) {
      // This will trigger the subscription to re-emit
      collection.find({ selector }).exec();
    }
  }, [db, collectionName, selector]);

  return { data, isLoading, error, refetch, count };
}
```

#### NEW: `apps/web/src/db/hooks/useRxDocument.ts`

```typescript
/**
 * useRxDocument - Subscribe to a single RxDB document
 *
 * Replaces: useQuery with single entity queryFn
 *
 * @example
 * const { data, isLoading } = useRxDocument('project', projectId);
 */
import { useState, useEffect } from 'react';
import { RxDocument } from 'rxdb';
import { useDatabase } from './useDatabase';

export interface UseRxDocumentResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  /** Update the document */
  update: (patch: Partial<T>) => Promise<void>;
  /** Delete the document */
  remove: () => Promise<void>;
}

export function useRxDocument<T>(
  collectionName: string,
  documentId: string | null | undefined
): UseRxDocumentResult<T> {
  const db = useDatabase();
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [rxDoc, setRxDoc] = useState<RxDocument<T> | null>(null);

  useEffect(() => {
    if (!documentId) {
      setData(null);
      setIsLoading(false);
      return;
    }

    const collection = db.collections[collectionName];
    if (!collection) {
      setError(new Error(`Collection "${collectionName}" not found`));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Subscribe to document changes
    const subscription = collection
      .findOne(documentId)
      .$
      .subscribe({
        next: (doc: RxDocument<T> | null) => {
          if (doc) {
            setData(doc.toJSON() as T);
            setRxDoc(doc);
          } else {
            setData(null);
            setRxDoc(null);
          }
          setIsLoading(false);
        },
        error: (err: Error) => {
          console.error(`[useRxDocument] Error for ${collectionName}/${documentId}:`, err);
          setError(err);
          setIsLoading(false);
        }
      });

    return () => subscription.unsubscribe();
  }, [db, collectionName, documentId]);

  const update = async (patch: Partial<T>) => {
    if (!rxDoc) {
      throw new Error('Document not loaded');
    }
    await rxDoc.patch(patch);
  };

  const remove = async () => {
    if (!rxDoc) {
      throw new Error('Document not loaded');
    }
    await rxDoc.remove();
  };

  return { data, isLoading, error, update, remove };
}
```

#### NEW: `apps/web/src/db/hooks/useRxState.ts`

```typescript
/**
 * useRxState - RxDB local document state management
 *
 * Replaces: Zustand stores (globalSettingsMetadataStore, etc.)
 *
 * RxDB local documents:
 * - Stored in IndexedDB (persistent across sessions)
 * - NOT synced to backend (device-local)
 * - Reactive (subscribers notified on change)
 *
 * @example
 * // Global settings state
 * const { state, setState, isLoading } = useRxState<GlobalSettings>(
 *   'global-settings',
 *   { currency: { symbol: '$', ... } }  // Default value
 * );
 */
import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from './useDatabase';

export interface UseRxStateResult<T> {
  state: T;
  setState: (update: Partial<T> | ((prev: T) => Partial<T>)) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  /** Clear state (reset to default) */
  clear: () => Promise<void>;
}

export function useRxState<T extends Record<string, any>>(
  key: string,
  defaultValue: T
): UseRxStateResult<T> {
  const db = useDatabase();
  const [state, setStateInternal] = useState<T>(defaultValue);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Subscribe to local document changes
  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const subscription = db.getLocal$<T>(key).subscribe({
      next: (doc) => {
        if (doc) {
          setStateInternal(doc.toJSON().data as T);
        } else {
          setStateInternal(defaultValue);
        }
        setIsLoading(false);
      },
      error: (err: Error) => {
        console.error(`[useRxState] Error for "${key}":`, err);
        setError(err);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [db, key]);

  // Update state
  const setState = useCallback(async (
    update: Partial<T> | ((prev: T) => Partial<T>)
  ) => {
    try {
      const currentDoc = await db.getLocal<T>(key);
      const currentState = currentDoc?.toJSON().data || defaultValue;

      const updateValue = typeof update === 'function'
        ? update(currentState as T)
        : update;

      await db.upsertLocal(key, {
        ...currentState,
        ...updateValue,
        _updatedAt: Date.now()
      });
    } catch (err) {
      console.error(`[useRxState] Failed to update "${key}":`, err);
      throw err;
    }
  }, [db, key, defaultValue]);

  // Clear state
  const clear = useCallback(async () => {
    try {
      const doc = await db.getLocal<T>(key);
      if (doc) {
        await doc.remove();
      }
      setStateInternal(defaultValue);
    } catch (err) {
      console.error(`[useRxState] Failed to clear "${key}":`, err);
      throw err;
    }
  }, [db, key, defaultValue]);

  return { state, setState, isLoading, error, clear };
}
```

#### NEW: `apps/web/src/db/hooks/useEntityQuery.ts`

```typescript
/**
 * useEntityQuery - Entity-specific query hooks
 *
 * Replaces: useEntityInstanceList, useFormattedEntityList from React Query hooks
 *
 * Features:
 * - Reactive queries with RxDB
 * - Format-at-read pattern (same as before)
 * - Pagination support
 * - Search/filter support
 */
import { useMemo } from 'react';
import { useRxQuery, UseRxQueryOptions } from './useRxQuery';
import { useRxDocument } from './useRxDocument';
import { formatDataset, formatRow, FormattedRow, ComponentMetadata } from '../../lib/formatters';
import { useComponentMetadata } from './useComponentMetadata';

export interface EntityQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: { field: string; order: 'asc' | 'desc' };
  filters?: Record<string, any>;
}

/**
 * useEntityList - Fetch entity list with formatting
 *
 * @example
 * const { data, formattedData, isLoading, total } = useEntityList('project', {
 *   page: 1,
 *   pageSize: 20,
 *   search: 'kitchen',
 *   filters: { dl__project_stage: 'planning' }
 * });
 */
export function useEntityList<T extends Record<string, any>>(
  entityCode: string,
  params: EntityQueryParams = {}
) {
  const { page = 1, pageSize = 20, search, sort, filters = {} } = params;

  // Build selector from filters
  const selector = useMemo(() => {
    const sel: Record<string, any> = {
      active_flag: true,
      _deleted: false,
      ...filters
    };

    // Add search filter if provided
    if (search) {
      sel.$or = [
        { name: { $regex: new RegExp(search, 'i') } },
        { code: { $regex: new RegExp(search, 'i') } },
        { descr: { $regex: new RegExp(search, 'i') } }
      ];
    }

    return sel;
  }, [filters, search]);

  // Build sort option
  const sortOption = useMemo(() => {
    if (sort) {
      return [{ [sort.field]: sort.order }];
    }
    return [{ updated_ts: 'desc' }];
  }, [sort]);

  // Query the collection
  const { data, isLoading, error, count } = useRxQuery<T>(entityCode, {
    selector,
    sort: sortOption,
    limit: pageSize,
    skip: (page - 1) * pageSize
  });

  // Get metadata for formatting
  const { metadata } = useComponentMetadata(entityCode, 'entityDataTable');

  // Format data on read
  const formattedData = useMemo(() => {
    if (!data.length || !metadata) return [];
    return formatDataset(data, metadata);
  }, [data, metadata]);

  return {
    data,
    formattedData,
    isLoading,
    error,
    total: count,
    page,
    pageSize,
    hasMore: count > page * pageSize
  };
}

/**
 * useEntityInstance - Fetch single entity with formatting
 */
export function useEntityInstance<T extends Record<string, any>>(
  entityCode: string,
  entityId: string | null | undefined
) {
  const { data, isLoading, error, update, remove } = useRxDocument<T>(
    entityCode,
    entityId
  );

  const { metadata } = useComponentMetadata(entityCode, 'entityFormContainer');

  const formattedData = useMemo(() => {
    if (!data || !metadata) return null;
    return formatRow(data, metadata);
  }, [data, metadata]);

  return {
    data,
    formattedData,
    isLoading,
    error,
    update,
    remove,
    metadata
  };
}
```

---

### 5.4 RxState Hooks (Replacing Zustand Stores)

#### NEW: `apps/web/src/db/hooks/useGlobalSettings.ts`

```typescript
/**
 * useGlobalSettings - Global formatting settings state
 *
 * Replaces: globalSettingsMetadataStore.ts
 *
 * MIGRATION NOTES:
 * - Before: Zustand store with sessionStorage persistence
 * - After: RxDB local document with IndexedDB persistence
 * - Benefit: Persists across browser sessions (not just page reloads)
 */
import { useRxState } from './useRxState';
import { GlobalSettingsLocal } from '../schemas/localDocuments';

const DEFAULT_GLOBAL_SETTINGS: GlobalSettingsLocal = {
  currency: {
    symbol: '$',
    decimals: 2,
    locale: 'en-CA',
    position: 'prefix',
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  date: {
    style: 'medium',
    locale: 'en-CA',
    format: 'YYYY-MM-DD'
  },
  timestamp: {
    style: 'medium',
    locale: 'en-CA',
    includeSeconds: false
  },
  boolean: {
    trueLabel: 'Yes',
    falseLabel: 'No',
    trueColor: 'green',
    falseColor: 'red',
    trueIcon: 'check',
    falseIcon: 'x'
  },
  _updatedAt: 0
};

export function useGlobalSettings() {
  const { state, setState, isLoading, error, clear } = useRxState<GlobalSettingsLocal>(
    'global-settings',
    DEFAULT_GLOBAL_SETTINGS
  );

  return {
    globalSettings: state,
    setGlobalSettings: setState,
    isLoading,
    error,
    clearGlobalSettings: clear,

    // Convenience getters (match old API)
    getCurrency: () => state.currency,
    getDateFormat: () => state.date,
    getTimestampFormat: () => state.timestamp,
    getBooleanFormat: () => state.boolean
  };
}
```

#### NEW: `apps/web/src/db/hooks/useDatalabels.ts`

```typescript
/**
 * useDatalabels - Datalabel options state
 *
 * Replaces: datalabelMetadataStore.ts
 *
 * MIGRATION NOTES:
 * - Before: Zustand store with localStorage persistence, manual TTL
 * - After: RxDB collection with replication sync
 * - Benefit: Real-time sync, offline support, no manual cache invalidation
 */
import { useMemo } from 'react';
import { useRxQuery } from './useRxQuery';
import { DatalabelDoc } from '../schemas/datalabel.schema';

export interface DatalabelOption {
  id: number;
  name: string;
  descr?: string;
  color_code?: string;
  sort_order: number;
  parent_ids?: number[];
  active_flag: boolean;
}

/**
 * Get all options for a specific datalabel key
 */
export function useDatalabel(datalabelKey: string) {
  const { data, isLoading, error } = useRxQuery<DatalabelDoc>('datalabel', {
    selector: {
      datalabel_key: datalabelKey,
      active_flag: true,
      _deleted: false
    },
    sort: [{ sort_order: 'asc' }]
  });

  const options = useMemo<DatalabelOption[]>(() => {
    return data.map(doc => ({
      id: doc.option_id,
      name: doc.name,
      descr: doc.descr,
      color_code: doc.color_code,
      sort_order: doc.sort_order,
      parent_ids: doc.parent_ids,
      active_flag: doc.active_flag
    }));
  }, [data]);

  return { options, isLoading, error };
}

/**
 * Get all datalabels grouped by key
 */
export function useAllDatalabels() {
  const { data, isLoading, error } = useRxQuery<DatalabelDoc>('datalabel', {
    selector: { active_flag: true, _deleted: false }
  });

  const datalabels = useMemo(() => {
    const grouped: Record<string, DatalabelOption[]> = {};

    data.forEach(doc => {
      if (!grouped[doc.datalabel_key]) {
        grouped[doc.datalabel_key] = [];
      }
      grouped[doc.datalabel_key].push({
        id: doc.option_id,
        name: doc.name,
        descr: doc.descr,
        color_code: doc.color_code,
        sort_order: doc.sort_order,
        parent_ids: doc.parent_ids,
        active_flag: doc.active_flag
      });
    });

    // Sort each group
    Object.values(grouped).forEach(options => {
      options.sort((a, b) => a.sort_order - b.sort_order);
    });

    return grouped;
  }, [data]);

  return { datalabels, isLoading, error };
}
```

#### NEW: `apps/web/src/db/hooks/useEntityEditState.ts`

```typescript
/**
 * useEntityEditState - Entity editing state with undo/redo
 *
 * Replaces: useEntityEditStore.ts
 *
 * MIGRATION NOTES:
 * - Before: Zustand store (in-memory, no persistence)
 * - After: RxDB local document (persists across refresh)
 * - Benefit: Draft edits survive browser refresh!
 */
import { useCallback, useMemo } from 'react';
import { useRxState } from './useRxState';
import { EditStateLocal } from '../schemas/localDocuments';
import { useDatabase } from './useDatabase';
import { apiClient } from '../../lib/api';

const DEFAULT_EDIT_STATE: EditStateLocal = {
  entityType: '',
  entityId: '',
  originalData: {},
  currentData: {},
  dirtyFields: [],
  isEditing: false,
  undoStack: [],
  redoStack: [],
  _updatedAt: 0
};

export function useEntityEditState(entityType: string, entityId: string) {
  const localKey = `edit-state:${entityType}:${entityId}`;
  const db = useDatabase();

  const { state, setState, isLoading, clear } = useRxState<EditStateLocal>(
    localKey,
    { ...DEFAULT_EDIT_STATE, entityType, entityId }
  );

  // Start editing
  const startEdit = useCallback(async (data: Record<string, any>) => {
    await setState({
      entityType,
      entityId,
      originalData: { ...data },
      currentData: { ...data },
      dirtyFields: [],
      isEditing: true,
      undoStack: [],
      redoStack: [],
      _updatedAt: Date.now()
    });
  }, [setState, entityType, entityId]);

  // Update a field
  const updateField = useCallback(async (field: string, value: any) => {
    const { currentData, originalData, dirtyFields, undoStack } = state;

    // Add to undo stack
    const newUndoStack = [...undoStack, { field, value: currentData[field] }];

    // Update current data
    const newCurrentData = { ...currentData, [field]: value };

    // Update dirty fields
    const isChanged = originalData[field] !== value;
    const newDirtyFields = isChanged
      ? [...new Set([...dirtyFields, field])]
      : dirtyFields.filter(f => f !== field);

    await setState({
      currentData: newCurrentData,
      dirtyFields: newDirtyFields,
      undoStack: newUndoStack,
      redoStack: [],  // Clear redo on new change
      _updatedAt: Date.now()
    });
  }, [state, setState]);

  // Undo last change
  const undo = useCallback(async () => {
    const { undoStack, redoStack, currentData, originalData, dirtyFields } = state;
    if (undoStack.length === 0) return;

    const lastChange = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);
    const newRedoStack = [...redoStack, { field: lastChange.field, value: currentData[lastChange.field] }];
    const newCurrentData = { ...currentData, [lastChange.field]: lastChange.value };

    const isChanged = originalData[lastChange.field] !== lastChange.value;
    const newDirtyFields = isChanged
      ? [...new Set([...dirtyFields, lastChange.field])]
      : dirtyFields.filter(f => f !== lastChange.field);

    await setState({
      currentData: newCurrentData,
      dirtyFields: newDirtyFields,
      undoStack: newUndoStack,
      redoStack: newRedoStack,
      _updatedAt: Date.now()
    });
  }, [state, setState]);

  // Redo last undone change
  const redo = useCallback(async () => {
    const { undoStack, redoStack, currentData, originalData, dirtyFields } = state;
    if (redoStack.length === 0) return;

    const lastRedo = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);
    const newUndoStack = [...undoStack, { field: lastRedo.field, value: currentData[lastRedo.field] }];
    const newCurrentData = { ...currentData, [lastRedo.field]: lastRedo.value };

    const isChanged = originalData[lastRedo.field] !== lastRedo.value;
    const newDirtyFields = isChanged
      ? [...new Set([...dirtyFields, lastRedo.field])]
      : dirtyFields.filter(f => f !== lastRedo.field);

    await setState({
      currentData: newCurrentData,
      dirtyFields: newDirtyFields,
      undoStack: newUndoStack,
      redoStack: newRedoStack,
      _updatedAt: Date.now()
    });
  }, [state, setState]);

  // Save changes to backend AND local collection
  const saveChanges = useCallback(async (): Promise<boolean> => {
    const { currentData, originalData, dirtyFields } = state;

    if (dirtyFields.length === 0) {
      await clear();
      return true;
    }

    // Build patch with only changed fields
    const patch: Record<string, any> = {};
    dirtyFields.forEach(field => {
      patch[field] = currentData[field];
    });

    try {
      // Save to backend
      const response = await apiClient.patch(
        `/api/v1/${entityType}/${entityId}`,
        patch
      );

      // Update local collection (will be picked up by replication)
      const collection = db.collections[entityType];
      if (collection) {
        const doc = await collection.findOne(entityId).exec();
        if (doc) {
          await doc.patch({ ...patch, updated_ts: new Date().toISOString() });
        }
      }

      // Clear edit state
      await clear();

      return true;
    } catch (error) {
      console.error('[useEntityEditState] Save failed:', error);
      return false;
    }
  }, [state, db, entityType, entityId, clear]);

  // Cancel editing
  const cancelEdit = useCallback(async () => {
    await clear();
  }, [clear]);

  // Computed values
  const hasChanges = state.dirtyFields.length > 0;
  const canUndo = state.undoStack.length > 0;
  const canRedo = state.redoStack.length > 0;

  return {
    // State
    isEditing: state.isEditing,
    currentData: state.currentData,
    originalData: state.originalData,
    dirtyFields: state.dirtyFields,
    isLoading,

    // Actions
    startEdit,
    updateField,
    saveChanges,
    cancelEdit,
    undo,
    redo,

    // Computed
    hasChanges,
    canUndo,
    canRedo,

    // Field helpers
    getFieldValue: (field: string) => state.currentData[field],
    isFieldDirty: (field: string) => state.dirtyFields.includes(field)
  };
}
```

---

### 5.5 Replication Setup

#### NEW: `apps/web/src/db/replication/index.ts`

```typescript
/**
 * RxDB Replication Setup
 *
 * Configures bidirectional sync between RxDB and backend REST API.
 *
 * Sync Strategy:
 * - Entity data: Pull + Push (bidirectional)
 * - Metadata (datalabels, entity_types): Pull only (reference data)
 * - Local documents: No sync (device-specific state)
 *
 * Conflict Resolution: Server wins (RBAC is authoritative)
 */
import { RxDatabase, RxReplicationState } from 'rxdb';
import { replicateRxCollection } from 'rxdb/plugins/replication';
import { PMODatabase } from '../index';
import { apiClient } from '../../lib/api';

// Active replication states (for cleanup)
const activeReplications: RxReplicationState<any, any>[] = [];

/**
 * Setup replication for all collections
 */
export async function setupReplication(
  db: PMODatabase,
  authToken: string
): Promise<void> {
  console.log('[Replication] Setting up sync...');

  // Entity collections (bidirectional sync)
  const entityCollections = [
    'project', 'task', 'employee', 'business', 'office',
    // ... all 27+ entity codes
  ];

  for (const collectionName of entityCollections) {
    const collection = db.collections[collectionName];
    if (collection) {
      const replication = setupEntityReplication(collection, authToken);
      activeReplications.push(replication);
    }
  }

  // Metadata collections (pull-only)
  setupDatalabelReplication(db.collections.datalabel, authToken);
  setupEntityTypeReplication(db.collections.entity_type, authToken);

  console.log(`[Replication] Setup complete for ${activeReplications.length} collections`);
}

/**
 * Setup bidirectional replication for entity collection
 */
function setupEntityReplication(
  collection: any,
  authToken: string
): RxReplicationState<any, any> {
  const collectionName = collection.name;

  return replicateRxCollection({
    collection,
    replicationIdentifier: `rest-${collectionName}`,
    deletedField: '_deleted',

    // Pull changes from server
    pull: {
      async handler(checkpointOrNull, batchSize) {
        const checkpoint = checkpointOrNull as { updatedAt: string } | null;

        try {
          const response = await apiClient.get(`/api/v1/${collectionName}/sync`, {
            params: {
              since: checkpoint?.updatedAt || '1970-01-01T00:00:00Z',
              limit: batchSize
            },
            headers: { Authorization: `Bearer ${authToken}` }
          });

          const documents = response.data.data.map((doc: any) => ({
            ...doc,
            _deleted: !doc.active_flag  // Map active_flag to _deleted
          }));

          return {
            documents,
            checkpoint: {
              updatedAt: response.data.lastUpdatedAt || new Date().toISOString()
            }
          };
        } catch (error) {
          console.error(`[Replication] Pull failed for ${collectionName}:`, error);
          throw error;
        }
      },
      batchSize: 100,
      modifier: (doc) => doc
    },

    // Push changes to server
    push: {
      async handler(docs) {
        const results = [];

        for (const docData of docs) {
          const doc = docData.newDocumentState;

          try {
            if (doc._deleted) {
              // Soft delete
              await apiClient.delete(`/api/v1/${collectionName}/${doc.id}`, {
                headers: { Authorization: `Bearer ${authToken}` }
              });
            } else if (!docData.assumedMasterState) {
              // New document (INSERT)
              await apiClient.post(`/api/v1/${collectionName}`, doc, {
                headers: { Authorization: `Bearer ${authToken}` }
              });
            } else {
              // Update (PATCH)
              await apiClient.patch(`/api/v1/${collectionName}/${doc.id}`, doc, {
                headers: { Authorization: `Bearer ${authToken}` }
              });
            }
            results.push(doc);
          } catch (error: any) {
            console.error(`[Replication] Push failed for ${collectionName}/${doc.id}:`, error);
            // Don't push if server rejects
            if (error.response?.status === 403) {
              // Permission denied - mark as conflict
              console.warn(`[Replication] Permission denied for ${doc.id}, reverting local change`);
            }
            throw error;
          }
        }

        return results;
      },
      batchSize: 10
    },

    // Server wins on conflict
    conflictHandler: async (input, context) => {
      console.warn(`[Replication] Conflict detected for ${collection.name}:`, input.documentId);
      // Return server version
      return input.realMasterState;
    },

    // Start immediately
    autoStart: true,

    // Retry on failure
    retryTime: 5000,  // Retry every 5 seconds on error

    // Live sync (keep running)
    live: true
  });
}

/**
 * Setup pull-only replication for datalabels (reference data)
 */
function setupDatalabelReplication(collection: any, authToken: string) {
  return replicateRxCollection({
    collection,
    replicationIdentifier: 'rest-datalabel',
    deletedField: '_deleted',

    pull: {
      async handler(checkpoint, batchSize) {
        const response = await apiClient.get('/api/v1/datalabel/all', {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        // Transform datalabels to documents
        const documents: any[] = [];
        response.data.forEach((dl: any) => {
          dl.options.forEach((opt: any) => {
            documents.push({
              id: `${dl.name}:${opt.id}`,
              datalabel_key: dl.name,
              option_id: opt.id,
              name: opt.name,
              descr: opt.descr,
              color_code: opt.color_code,
              sort_order: opt.sort_order,
              parent_ids: opt.parent_ids || [],
              active_flag: opt.active_flag !== false,
              _deleted: false
            });
          });
        });

        return {
          documents,
          checkpoint: { updatedAt: new Date().toISOString() }
        };
      },
      batchSize: 1000,  // Get all at once
      modifier: (doc) => doc
    },

    // No push - read-only reference data
    push: undefined,

    autoStart: true,
    live: false,  // Don't continuously poll

    // Pull every 15 minutes
    retryTime: 15 * 60 * 1000
  });
}

/**
 * Setup pull-only replication for entity types
 */
function setupEntityTypeReplication(collection: any, authToken: string) {
  return replicateRxCollection({
    collection,
    replicationIdentifier: 'rest-entity-type',
    deletedField: '_deleted',

    pull: {
      async handler() {
        const response = await apiClient.get('/api/v1/entity/types', {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        const documents = response.data.map((entity: any) => ({
          ...entity,
          _deleted: false
        }));

        return {
          documents,
          checkpoint: { updatedAt: new Date().toISOString() }
        };
      },
      batchSize: 100,
      modifier: (doc) => doc
    },

    push: undefined,
    autoStart: true,
    live: false,
    retryTime: 60 * 60 * 1000  // Pull every hour
  });
}

/**
 * Stop all replications (for logout)
 */
export async function stopAllReplications(): Promise<void> {
  console.log('[Replication] Stopping all replications...');

  for (const replication of activeReplications) {
    await replication.cancel();
  }

  activeReplications.length = 0;
  console.log('[Replication] All replications stopped');
}
```

---

### 5.6 App.tsx Modifications

#### MODIFY: `apps/web/src/App.tsx`

```typescript
/**
 * App.tsx - Root component
 *
 * CHANGES:
 * - REMOVE: QueryClientProvider (React Query)
 * - REMOVE: startMetadataGC() (no longer needed - RxDB handles persistence)
 * - ADD: DatabaseProvider (RxDB)
 */
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// ❌ REMOVE: React Query
// import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ✅ ADD: RxDB Database Provider
import { DatabaseProvider } from './db/DatabaseProvider';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { NavigationHistoryProvider } from './contexts/NavigationHistoryContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { EntityPreviewProvider } from './contexts/EntityPreviewContext';
import { EntityMetadataProvider, useEntityMetadata } from './contexts/EntityMetadataContext';
import { LoginForm } from './components/shared';
import { EntityPreviewPanel } from './components/shared/preview/EntityPreviewPanel';
import { EllipsisBounce } from './components/shared/ui/EllipsisBounce';

// ❌ REMOVE: Garbage collection
// import { startMetadataGC, stopMetadataGC } from './lib/cache/garbageCollection';

// ❌ REMOVE: QueryClient configuration
// const queryClient = new QueryClient({...});

// ... rest of imports and route components unchanged ...

function App() {
  // ❌ REMOVE: GC setup
  // useEffect(() => {
  //   startMetadataGC();
  //   return () => stopMetadataGC();
  // }, []);

  return (
    // ❌ REMOVE: <QueryClientProvider client={queryClient}>
    <AuthProvider>
      {/* ✅ ADD: DatabaseProvider (initialized after auth) */}
      <DatabaseProvider>
        <EntityMetadataProvider>
          <Router>
            <SidebarProvider>
              <SettingsProvider>
                <NavigationHistoryProvider>
                  <EntityPreviewProvider>
                    <AppRoutes />
                    <EntityPreviewPanel />
                  </EntityPreviewProvider>
                </NavigationHistoryProvider>
              </SettingsProvider>
            </SidebarProvider>
          </Router>
        </EntityMetadataProvider>
      </DatabaseProvider>
    </AuthProvider>
    // ❌ REMOVE: </QueryClientProvider>
  );
}

export default App;
```

---

## 6. Backend API Changes Required

### 6.1 Sync Endpoint (New)

Add a sync endpoint to each entity module:

```typescript
// apps/api/src/modules/project/routes.ts

// ADD: Sync endpoint for RxDB replication
fastify.get('/api/v1/project/sync', async (request, reply) => {
  const { since, limit = 100 } = request.query as { since?: string; limit?: number };
  const userId = request.user.sub;

  // RBAC filtering
  const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
    userId, ENTITY_CODE, Permission.VIEW, 'e'
  );

  // Fetch all changes since checkpoint (including soft-deleted)
  const projects = await db.execute(sql`
    SELECT e.*
    FROM app.project e
    WHERE ${rbacCondition}
      AND e.updated_ts > ${since || '1970-01-01T00:00:00Z'}
    ORDER BY e.updated_ts ASC
    LIMIT ${limit}
  `);

  const lastUpdatedAt = projects.length > 0
    ? projects[projects.length - 1].updated_ts
    : since || new Date().toISOString();

  return reply.send({
    data: projects,
    lastUpdatedAt,
    hasMore: projects.length === limit
  });
});
```

### 6.2 Include Deleted Records

Modify existing endpoints to include `active_flag = false` records for sync:

```typescript
// When syncing, include soft-deleted records
const includeDeleted = request.query.sync === 'true';

const activeCondition = includeDeleted
  ? sql`1=1`  // No filter
  : sql`e.active_flag = true`;
```

---

## 7. Migration Phases

### Phase 1: Infrastructure Setup (Week 1-2)

**Goal**: Add RxDB alongside existing system (no changes to existing code).

**Tasks**:
1. Install RxDB packages
2. Create `apps/web/src/db/` directory structure
3. Define all 27+ entity schemas
4. Create DatabaseProvider
5. Create basic hooks (useRxQuery, useRxDocument, useRxState)
6. Add sync endpoint to one entity (project) for testing

**Validation**: RxDB works in parallel with React Query; data syncs correctly.

### Phase 2: Migrate Metadata Stores (Week 3-4)

**Goal**: Replace Zustand metadata stores with RxDB local documents.

**Files to Migrate**:
| Zustand Store | RxDB Hook | Priority |
|---------------|-----------|----------|
| `globalSettingsMetadataStore.ts` | `useGlobalSettings()` | High |
| `datalabelMetadataStore.ts` | `useDatalabels()` | High |
| `entityCodeMetadataStore.ts` | `useEntityTypes()` | High |
| `entityComponentMetadataStore.ts` | `useComponentMetadata()` | Medium |

**Validation**: All metadata loads from RxDB; no calls to Zustand stores.

### Phase 3: Migrate Entity Data (Week 5-8)

**Goal**: Replace React Query hooks with RxDB hooks.

**Files to Migrate**:
| React Query Hook | RxDB Hook | Priority |
|------------------|-----------|----------|
| `useEntityInstanceList` | `useEntityList` | High |
| `useFormattedEntityList` | `useEntityList` (with format) | High |
| `useEntityInstance` | `useEntityInstance` | High |
| `useEntityMutation` | `useRxMutation` | High |
| `useRefDataEntityInstanceCache` | (Built into collections) | Medium |

**Validation**: All entity data loads from RxDB; offline mode works.

### Phase 4: Migrate Edit State (Week 9-10)

**Goal**: Replace useEntityEditStore with RxDB local documents.

**Files to Migrate**:
| Zustand Store | RxDB Hook | Priority |
|---------------|-----------|----------|
| `useEntityEditStore.ts` | `useEntityEditState()` | High |

**New Features**:
- Draft edits persist across page refresh
- Undo/redo history survives navigation

**Validation**: Editing works; drafts persist.

### Phase 5: Cleanup & Optimization (Week 11-12)

**Tasks**:
1. Remove React Query package
2. Remove Zustand package
3. Delete old stores and hooks
4. Delete garbage collection module
5. Delete normalized cache module
6. Update all component imports
7. Performance testing
8. Bundle size optimization (lazy loading)

---

## 8. Benefits & Challenges

### Benefits

| Benefit | Description | Impact |
|---------|-------------|--------|
| **Offline-First** | Full app works without network | High |
| **Persistent Cache** | Data survives browser restart | High |
| **Real-Time Sync** | Background sync when online | High |
| **Unified Paradigm** | Single database for all state | Medium |
| **Multi-Tab Sync** | Changes propagate across tabs | Medium |
| **Draft Persistence** | Edits survive page refresh | Medium |
| **Simpler Code** | No dual Zustand/RQ complexity | Medium |
| **IndexedDB Storage** | More storage than localStorage | Low |

### Challenges

| Challenge | Risk | Mitigation |
|-----------|------|------------|
| **Bundle Size** | +76KB gzipped | Lazy loading after auth |
| **Schema Migrations** | Breaking changes require migrations | Version schemas carefully |
| **Conflict Resolution** | Offline edits may conflict | Server-wins policy |
| **Learning Curve** | Team new to RxDB | Documentation, training |
| **Query Limitations** | No SQL JOINs | Denormalize, client-side joins |
| **IndexedDB Limits** | ~50MB per origin | Data retention policy |
| **Safari Quirks** | IndexedDB can be purged | Sync frequently |

---

## 9. Complete Checklist

### Pre-Migration

- [ ] Review all Zustand store usages (grep for `useGlobalSettings`, `useDatalabel`, etc.)
- [ ] Review all React Query hook usages (grep for `useQuery`, `useMutation`)
- [ ] Design RxDB schemas for all 27+ entities
- [ ] Define sync endpoint API contract
- [ ] Set up RxDB dev tools for debugging
- [ ] Create rollback plan

### Phase 1: Infrastructure

- [ ] `pnpm add rxdb rxjs dexie`
- [ ] Create `apps/web/src/db/index.ts`
- [ ] Create `apps/web/src/db/DatabaseProvider.tsx`
- [ ] Create `apps/web/src/db/schemas/*.ts` (27+ files)
- [ ] Create `apps/web/src/db/hooks/useDatabase.ts`
- [ ] Create `apps/web/src/db/hooks/useRxQuery.ts`
- [ ] Create `apps/web/src/db/hooks/useRxDocument.ts`
- [ ] Create `apps/web/src/db/hooks/useRxState.ts`
- [ ] Add `/api/v1/project/sync` endpoint (pilot)
- [ ] Test: Data syncs correctly

### Phase 2: Metadata Migration

- [ ] Create `apps/web/src/db/hooks/useGlobalSettings.ts`
- [ ] Create `apps/web/src/db/hooks/useDatalabels.ts`
- [ ] Create `apps/web/src/db/hooks/useEntityTypes.ts`
- [ ] Create `apps/web/src/db/hooks/useComponentMetadata.ts`
- [ ] Update components using `useGlobalSettingsMetadataStore`
- [ ] Update components using `useDatalabelMetadataStore`
- [ ] Update components using `useEntityCodeMetadataStore`
- [ ] Update components using `useEntityComponentMetadataStore`
- [ ] Test: All metadata loads correctly

### Phase 3: Entity Data Migration

- [ ] Create `apps/web/src/db/hooks/useEntityQuery.ts`
- [ ] Create `apps/web/src/db/hooks/useRxMutation.ts`
- [ ] Create `apps/web/src/db/replication/index.ts`
- [ ] Add sync endpoints to all 27+ entities
- [ ] Update `EntityListOfInstancesPage` to use RxDB
- [ ] Update `EntitySpecificInstancePage` to use RxDB
- [ ] Update `EntityCreatePage` to use RxDB
- [ ] Test: Entity CRUD works; offline mode works

### Phase 4: Edit State Migration

- [ ] Create `apps/web/src/db/hooks/useEntityEditState.ts`
- [ ] Update `EntityFormContainer` to use new hook
- [ ] Test: Editing works; drafts persist across refresh

### Phase 5: Cleanup

- [ ] Delete `apps/web/src/stores/` directory
- [ ] Delete `apps/web/src/lib/hooks/useEntityQuery.ts`
- [ ] Delete `apps/web/src/lib/hooks/useRefDataEntityInstanceCache.ts`
- [ ] Delete `apps/web/src/lib/cache/` directory
- [ ] Update `apps/web/src/App.tsx` (remove QueryClientProvider)
- [ ] Update `apps/web/src/lib/hooks/index.ts` exports
- [ ] `pnpm remove @tanstack/react-query zustand`
- [ ] Run full test suite
- [ ] Performance benchmark
- [ ] Update CLAUDE.md documentation

### Post-Migration

- [ ] Monitor IndexedDB usage in production
- [ ] Monitor sync error rates
- [ ] Gather user feedback on offline experience
- [ ] Document RxDB patterns for team

---

## Appendix: Quick Reference

### Current → RxDB API Mapping

| Current | RxDB Equivalent |
|---------|-----------------|
| `useQuery({ queryKey, queryFn })` | `useRxQuery(collection, options)` |
| `useMutation()` | `collection.insert/update/remove()` |
| `queryClient.invalidateQueries()` | Automatic (reactive) |
| `useZustandStore()` | `useRxState(key, default)` |
| `store.getState()` | `db.getLocal(key)` |
| `localStorage.setItem()` | `db.upsertLocal(key, value)` |
| `staleTime: 30000` | Replication interval |

### Import Changes

```typescript
// ❌ BEFORE (React Query + Zustand)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useGlobalSettingsMetadataStore } from '@/stores/globalSettingsMetadataStore';
import { useDatalabelMetadataStore } from '@/stores/datalabelMetadataStore';
import { useEntityEditStore } from '@/stores/useEntityEditStore';

// ✅ AFTER (RxDB + RxState)
import { useRxQuery, useRxDocument, useRxMutation } from '@/db/hooks';
import { useGlobalSettings } from '@/db/hooks/useGlobalSettings';
import { useDatalabels } from '@/db/hooks/useDatalabels';
import { useEntityEditState } from '@/db/hooks/useEntityEditState';
```

---

**Document Version**: 2.0
**Last Updated**: 2025-11-27
**Migration Type**: Complete (Zustand + React Query → RxDB + RxState)
**Estimated Effort**: 8-12 weeks
