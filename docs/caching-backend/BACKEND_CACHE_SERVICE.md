# Backend Cache Service

> Next-Generation Modular Cache Architecture - Plug-and-Play, Composable, Domain-Agnostic

**Version**: 1.0.0 | **Updated**: 2025-12-10 | **Status**: Design

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Unified Cache Schema](#2-unified-cache-schema)
3. [Architecture Overview](#3-architecture-overview)
4. [Core Abstractions](#4-core-abstractions)
5. [Cache Strategies](#5-cache-strategies)
6. [Domain Adapters](#6-domain-adapters)
7. [Invalidation Patterns](#7-invalidation-patterns)
8. [Observability](#8-observability)
9. [Implementation Guide](#9-implementation-guide)
10. [Usage Examples](#10-usage-examples)

---

## 1. Design Philosophy

### 1.1 Core Principles

| Principle | Description |
|-----------|-------------|
| **Domain-Agnostic Core** | Cache engine knows nothing about RBAC, entities, or business logic |
| **Composable Strategies** | Mix and match caching behaviors like building blocks |
| **Plug-and-Play Adapters** | Domain-specific logic lives in thin adapter layers |
| **Observable by Default** | Every cache operation emits metrics and traces |
| **Graceful Degradation** | System works without cache, just slower |
| **Type-Safe** | Full TypeScript generics for compile-time safety |

### 1.2 Separation of Concerns

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LAYERED ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                     APPLICATION LAYER                                   ││
│  │                                                                         ││
│  │   RbacCacheAdapter    EntityCacheAdapter    SessionCacheAdapter        ││
│  │   MetadataCacheAdapter    RateLimitAdapter    FeatureFlagAdapter       ││
│  │                                                                         ││
│  │   (Domain-specific: knows about permissions, entities, sessions)       ││
│  └───────────────────────────────────┬─────────────────────────────────────┘│
│                                      │                                      │
│  ┌───────────────────────────────────▼─────────────────────────────────────┐│
│  │                     STRATEGY LAYER                                      ││
│  │                                                                         ││
│  │   CacheAside    WriteThrough    ReadThrough    WriteBack               ││
│  │   Stale-While-Revalidate    Cache-Only    Refresh-Ahead               ││
│  │                                                                         ││
│  │   (Caching patterns: how to cache, not what)                           ││
│  └───────────────────────────────────┬─────────────────────────────────────┘│
│                                      │                                      │
│  ┌───────────────────────────────────▼─────────────────────────────────────┐│
│  │                     CORE LAYER                                          ││
│  │                                                                         ││
│  │   CacheEngine    KeyBuilder    Serializer    Compressor               ││
│  │   ConnectionPool    CircuitBreaker    MetricsCollector                 ││
│  │                                                                         ││
│  │   (Infrastructure: Redis operations, resilience, observability)        ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Unified Cache Schema

### 2.1 Schema Version Standard

All cache keys follow a versioned namespace pattern for safe migrations:

```
v{schemaVersion}:{domain}:{...path}
```

| Component | Purpose | Example |
|-----------|---------|---------|
| `v{n}` | Schema version for migrations | `v1`, `v2` |
| `{domain}` | Domain namespace | `rbac`, `entity`, `datalabel`, `metadata`, `ref` |
| `{...path}` | Domain-specific key path | `role:abc:task:type` |

### 2.2 Complete Key Structure (All Domains)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    UNIFIED CACHE KEY SCHEMA v1                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ╔═══════════════════════════════════════════════════════════════════════╗  │
│  ║  DOMAIN: ENTITY_RBAC (Role-Based Access Control)                       ║  │
│  ╠═══════════════════════════════════════════════════════════════════════╣  │
│  ║                                                                        ║  │
│  ║  v1:entity_rbac:person:{personId}:roles          → SET<roleId>        ║  │
│  ║  v1:entity_rbac:role:{roleId}:{entityCode}:type  → INT (perm 0-7)     ║  │
│  ║  v1:entity_rbac:role:{roleId}:{entityCode}:deny  → SET<entityId>      ║  │
│  ║  v1:entity_rbac:role:{roleId}:{entityCode}:perm:{entityId} → INT(0-7) ║  │
│  ║                                                                        ║  │
│  ╚═══════════════════════════════════════════════════════════════════════╝  │
│                                                                              │
│  ╔═══════════════════════════════════════════════════════════════════════╗  │
│  ║  DOMAIN: DATALABEL (Settings/Lookup Values)                            ║  │
│  ╠═══════════════════════════════════════════════════════════════════════╣  │
│  ║                                                                        ║  │
│  ║  v1:datalabel:{fieldName}                 → JSON (options array)      ║  │
│  ║  v1:datalabel:{fieldName}:map             → HASH {value → label}      ║  │
│  ║                                                                        ║  │
│  ║  Examples:                                                             ║  │
│  ║  v1:datalabel:dl__project_stage           → [{value,label,color}...]  ║  │
│  ║  v1:datalabel:dl__task_status:map         → {planning: "Planning"}    ║  │
│  ║                                                                        ║  │
│  ╚═══════════════════════════════════════════════════════════════════════╝  │
│                                                                              │
│  ╔═══════════════════════════════════════════════════════════════════════╗  │
│  ║  DOMAIN: ENTITY_METADATA (Entity Field Metadata)                       ║  │
│  ╠═══════════════════════════════════════════════════════════════════════╣  │
│  ║                                                                        ║  │
│  ║  v1:entity_metadata:{entityCode}:fields   → JSON (field names array)  ║  │
│  ║  v1:entity_metadata:{entityCode}:viewType → JSON (viewType metadata)  ║  │
│  ║  v1:entity_metadata:{entityCode}:editType → JSON (editType metadata)  ║  │
│  ║                                                                        ║  │
│  ║  Examples:                                                             ║  │
│  ║  v1:entity_metadata:project:fields        → ["id","name","code",...]  ║  │
│  ║  v1:entity_metadata:task:viewType         → {name:{renderType:...}}   ║  │
│  ║                                                                        ║  │
│  ╚═══════════════════════════════════════════════════════════════════════╝  │
│                                                                              │
│  ╔═══════════════════════════════════════════════════════════════════════╗  │
│  ║  DOMAIN: ENTITY (Entity Instance Data)                                 ║  │
│  ╠═══════════════════════════════════════════════════════════════════════╣  │
│  ║                                                                        ║  │
│  ║  v1:entity:{entityCode}                   → HASH {entityId → JSON}    ║  │
│  ║  v1:entity:{entityCode}:list:{hash}       → JSON (paginated list)     ║  │
│  ║  v1:entity:{entityCode}:count:{hash}      → INT (total count)         ║  │
│  ║                                                                        ║  │
│  ║  Example:                                                              ║  │
│  ║  v1:entity:project → HASH {                                           ║  │
│  ║    "uuid-kitchen": '{"id":"uuid-kitchen","name":"Kitchen",...}',     ║  │
│  ║    "uuid-bathroom": '{"id":"uuid-bathroom","name":"Bathroom",...}',  ║  │
│  ║    "uuid-deck": '{"id":"uuid-deck","name":"Deck",...}'               ║  │
│  ║  }                                                                     ║  │
│  ║                                                                        ║  │
│  ║  Operations:                                                           ║  │
│  ║  ───────────                                                           ║  │
│  ║  HGET  v1:entity:project uuid-kitchen     → '{"id":...,"name":...}'   ║  │
│  ║  HSET  v1:entity:project uuid-kitchen '{...}'  → Update single entity ║  │
│  ║  HDEL  v1:entity:project uuid-kitchen     → Delete single entity      ║  │
│  ║  HGETALL v1:entity:project                → All entities for type     ║  │
│  ║                                                                        ║  │
│  ║  Benefits:                                                             ║  │
│  ║  • Update/delete single entity WITHOUT invalidating other entities   ║  │
│  ║  • Query entire type returns updated data immediately                 ║  │
│  ║  • Memory efficient (1 key per entity type vs N keys per instance)    ║  │
│  ║                                                                        ║  │
│  ║  Note: List/count caches still need invalidation on create/delete    ║  │
│  ║  (pagination changes), but single entity updates are in-place!       ║  │
│  ║                                                                        ║  │
│  ╚═══════════════════════════════════════════════════════════════════════╝  │
│                                                                              │
│  ╔═══════════════════════════════════════════════════════════════════════╗  │
│  ║  DOMAIN: ENTITY_INSTANCE (Name Lookup - from app.entity_instance)      ║  │
│  ╠═══════════════════════════════════════════════════════════════════════╣  │
│  ║                                                                        ║  │
│  ║  v1:entity_instance:{entityCode}          → HASH {entityId → name}    ║  │
│  ║                                                                        ║  │
│  ║  Example:                                                              ║  │
│  ║  v1:entity_instance:employee → HASH {                                 ║  │
│  ║    "uuid-james": "James Miller",                                      ║  │
│  ║    "uuid-sarah": "Sarah Johnson",                                     ║  │
│  ║    "uuid-mike":  "Mike Wilson"                                        ║  │
│  ║  }                                                                     ║  │
│  ║                                                                        ║  │
│  ║  Operations:                                                           ║  │
│  ║  ───────────                                                           ║  │
│  ║  HGET  v1:entity_instance:project abc-123     → "Kitchen Renovation"  ║  │
│  ║  HSET  v1:entity_instance:project abc-123 "New Name"  → Update 1 item ║  │
│  ║  HDEL  v1:entity_instance:project abc-123     → Delete 1 item         ║  │
│  ║  HGETALL v1:entity_instance:project           → All names for type    ║  │
│  ║                                                                        ║  │
│  ║  Benefits:                                                             ║  │
│  ║  • Single item invalidation WITHOUT affecting other items             ║  │
│  ║  • Query entire type returns updated data immediately                 ║  │
│  ║  • Memory efficient (1 key per entity type vs N keys per instance)    ║  │
│  ║                                                                        ║  │
│  ║  Source: app.entity_instance.entity_instance_name                      ║  │
│  ║  Used by: build_ref_data_entityInstance() for O(1) name resolution    ║  │
│  ║                                                                        ║  │
│  ╚═══════════════════════════════════════════════════════════════════════╝  │
│                                                                              │
│  ╔═══════════════════════════════════════════════════════════════════════╗  │
│  ║  DOMAIN: ENTITY_CODE (Entity Type Registry - from app.entity)         ║  │
│  ╠═══════════════════════════════════════════════════════════════════════╣  │
│  ║                                                                        ║  │
│  ║  v1:entity_code:all                       → JSON (all entity types)   ║  │
│  ║  v1:entity_code:{entityCode}              → JSON (single entity def)  ║  │
│  ║  v1:entity_code:{entityCode}:children     → JSON (enriched children)  ║  │
│  ║  v1:entity_code:lookup                    → HASH {code → ui_label}    ║  │
│  ║                                                                        ║  │
│  ║  Examples:                                                             ║  │
│  ║  v1:entity_code:all                       → [{code,name,ui_label,...}]║  │
│  ║  v1:entity_code:project                   → {code,name,ui_label,...}  ║  │
│  ║  v1:entity_code:project:children          → [{entity,ui_label,icon}]  ║  │
│  ║  v1:entity_code:lookup                    → {project:"Project",...}   ║  │
│  ║                                                                        ║  │
│  ║  Source: app.entity (code, name, ui_label, ui_icon, child_entity_codes)║  │
│  ║  Used by: hierarchical-permissions route for child entity UI labels   ║  │
│  ║                                                                        ║  │
│  ║  Child Entity Enrichment Pattern:                                      ║  │
│  ║  ─────────────────────────────────                                     ║  │
│  ║  Input:  child_entity_codes = ["task", "document"]                    ║  │
│  ║  Output: [                                                             ║  │
│  ║    { entity: "task", ui_label: "Task", ui_icon: "check-square" },     ║  │
│  ║    { entity: "document", ui_label: "Document", ui_icon: "file" }      ║  │
│  ║  ]                                                                     ║  │
│  ║                                                                        ║  │
│  ╚═══════════════════════════════════════════════════════════════════════╝  │
│                                                                              │
│  ╔═══════════════════════════════════════════════════════════════════════╗  │
│  ║  DOMAIN: ENTITY_CONFIG_DATATABLE (v10.1.0 - In-Memory Cache)          ║  │
│  ╠═══════════════════════════════════════════════════════════════════════╣  │
│  ║                                                                        ║  │
│  ║  Storage: In-Memory Map (NOT Redis)                                   ║  │
│  ║  Location: apps/api/src/lib/universal-entity-crud-factory.ts          ║  │
│  ║                                                                        ║  │
│  ║  Cache Structure:                                                      ║  │
│  ║  Map<entityCode, EntityDatatableConfig>                               ║  │
│  ║                                                                        ║  │
│  ║  EntityDatatableConfig:                                                ║  │
│  ║  {                                                                     ║  │
│  ║    defaultSort: string;        // e.g., "updated_ts"                  ║  │
│  ║    defaultSortOrder: 'asc'|'desc';  // e.g., "desc"                   ║  │
│  ║    itemsPerPage: number;       // e.g., 25                            ║  │
│  ║  }                                                                     ║  │
│  ║                                                                        ║  │
│  ║  Source: app.entity.config_datatable (JSONB column)                   ║  │
│  ║  Used by: createEntityListEndpoint() for ORDER BY + LIMIT defaults   ║  │
│  ║                                                                        ║  │
│  ║  Functions:                                                            ║  │
│  ║  ───────────                                                           ║  │
│  ║  getEntityDatatableConfig(entityCode, db)  → Fetch/cache config      ║  │
│  ║  clearEntityConfigCache()                  → Clear all cached configs ║  │
│  ║                                                                        ║  │
│  ║  Cache Behavior:                                                       ║  │
│  ║  • First request: Query DB, validate, cache result                    ║  │
│  ║  • Subsequent: Return from Map immediately                            ║  │
│  ║  • TTL: Infinite (process lifetime) - cleared on server restart      ║  │
│  ║  • Invalidation: Call clearEntityConfigCache() after config changes  ║  │
│  ║                                                                        ║  │
│  ║  Priority Chain (for list endpoints):                                 ║  │
│  ║  query param > route config > DB config > DEFAULT_DATATABLE_CONFIG   ║  │
│  ║                                                                        ║  │
│  ║  Default Fallback:                                                     ║  │
│  ║  { defaultSort: 'updated_ts', defaultSortOrder: 'desc', itemsPerPage: 25 }║
│  ║                                                                        ║  │
│  ╚═══════════════════════════════════════════════════════════════════════╝  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 TTL Standards

| Domain | Default TTL | Storage | Rationale |
|--------|-------------|---------|-----------|
| `entity_rbac` | 5 min (300s) | Redis | Balance freshness with performance |
| `datalabel` | 30 min (1800s) | Redis | Rarely changes, frequently accessed |
| `entity_metadata` | 24 hours (86400s) | Redis | Schema changes are rare |
| `entity` | 5 min (300s) | Redis | Data changes frequently |
| `entity_instance` | 10 min (600s) | Redis | Names change less often than data |
| `entity_code` | 1 hour (3600s) | Redis | Entity types rarely added/modified |
| `entity_config_datatable` | ∞ (process) | In-Memory Map | List view config rarely changes; cleared on restart |

### 2.4 Tag Structure for Bulk Invalidation

Tags enable efficient bulk invalidation without pattern scanning:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TAG STRUCTURE                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Tag Format: tag:{domain}:{scope}:{identifier}                              │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Entity RBAC Tags                                                       ││
│  │  ────────────────                                                       ││
│  │  tag:entity_rbac:person:{personId}  → All cache for this person        ││
│  │  tag:entity_rbac:role:{roleId}      → All cache for this role          ││
│  │  tag:entity_rbac:entity:{entityCode}→ All permissions for entity type  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Entity Tags                                                            ││
│  │  ────────────                                                           ││
│  │  tag:entity:{entityCode}        → All instances of this type           ││
│  │  tag:entity:{entityCode}:{id}   → Specific instance + related          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Datalabel Tags                                                         ││
│  │  ───────────────                                                        ││
│  │  tag:datalabel:all              → All datalabels (rare full refresh)   ││
│  │  tag:datalabel:{fieldName}      → Specific datalabel field             ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Entity Metadata Tags                                                   ││
│  │  ────────────────────                                                   ││
│  │  tag:entity_metadata:all        → All metadata (schema migration)      ││
│  │  tag:entity_metadata:{entityCode} → Specific entity metadata           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Entity Instance Tags (Name Lookup)                                     ││
│  │  ──────────────────────────────────                                     ││
│  │  tag:entity_instance:{entityCode}  → All names for entity type         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  Usage:                                                                      │
│  ──────                                                                      │
│  // When caching, add to tags                                                │
│  await cache.set(key, value, { tags: ['tag:entity:project'] });             │
│                                                                              │
│  // Bulk invalidation                                                        │
│  await cache.invalidateByTag('tag:entity:project');  // O(n) where n=tagged │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.5 Schema Version Migration

When schema changes require key format updates:

```typescript
// Before: v1:ref:employee → HASH
// After:  v2:ref:employee:{id} → STRING (per-instance)

// Migration strategy:
// 1. Deploy code that reads v1, writes v2
// 2. Wait for v1 TTL to expire (or force invalidate)
// 3. Remove v1 read fallback
```

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SCHEMA VERSION MIGRATION                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Phase 1: Dual-Read                          Phase 2: Clean                  │
│  ─────────────────────                       ─────────────────               │
│                                                                              │
│  async get(key) {                            async get(key) {                │
│    // Try new version first                    return engine.get(v2Key);     │
│    let result = await engine.get(v2Key);     }                               │
│    if (!result) {                                                            │
│      result = await engine.get(v1Key);       // v1 keys naturally expired   │
│      if (result) {                           // or bulk-invalidated         │
│        // Migrate to v2                                                      │
│        await engine.set(v2Key, result);                                      │
│      }                                                                       │
│    }                                                                         │
│    return result;                                                            │
│  }                                                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.6 Domain Key Definitions (TypeScript)

```typescript
// apps/api/src/lib/cache/keys/index.ts

export const CACHE_SCHEMA_VERSION = 1;

// ═══════════════════════════════════════════════════════════════════════════
// ENTITY_RBAC KEYS
// ═══════════════════════════════════════════════════════════════════════════

export const ENTITY_RBAC_KEYS = {
  personRoles: new KeyBuilder<{ personId: string }>({
    namespace: 'entity_rbac',
    pattern: 'person:{personId}:roles',
    version: CACHE_SCHEMA_VERSION,
    defaultTtl: 300,
  }),

  roleTypePermission: new KeyBuilder<{ roleId: string; entityCode: string }>({
    namespace: 'entity_rbac',
    pattern: 'role:{roleId}:{entityCode}:type',
    version: CACHE_SCHEMA_VERSION,
    defaultTtl: 300,
  }),

  roleDeny: new KeyBuilder<{ roleId: string; entityCode: string }>({
    namespace: 'entity_rbac',
    pattern: 'role:{roleId}:{entityCode}:deny',
    version: CACHE_SCHEMA_VERSION,
    defaultTtl: 300,
  }),

  roleInstancePermission: new KeyBuilder<{ roleId: string; entityCode: string; entityId: string }>({
    namespace: 'entity_rbac',
    pattern: 'role:{roleId}:{entityCode}:perm:{entityId}',
    version: CACHE_SCHEMA_VERSION,
    defaultTtl: 300,
  }),
};

// ═══════════════════════════════════════════════════════════════════════════
// DATALABEL KEYS
// ═══════════════════════════════════════════════════════════════════════════

export const DATALABEL_KEYS = {
  options: new KeyBuilder<{ fieldName: string }>({
    namespace: 'datalabel',
    pattern: '{fieldName}',
    version: CACHE_SCHEMA_VERSION,
    defaultTtl: 1800,
  }),

  map: new KeyBuilder<{ fieldName: string }>({
    namespace: 'datalabel',
    pattern: '{fieldName}:map',
    version: CACHE_SCHEMA_VERSION,
    defaultTtl: 1800,
  }),
};

// ═══════════════════════════════════════════════════════════════════════════
// ENTITY_METADATA KEYS
// ═══════════════════════════════════════════════════════════════════════════

export const ENTITY_METADATA_KEYS = {
  fields: new KeyBuilder<{ entityCode: string }>({
    namespace: 'entity_metadata',
    pattern: '{entityCode}:fields',
    version: CACHE_SCHEMA_VERSION,
    defaultTtl: 86400,
  }),

  viewType: new KeyBuilder<{ entityCode: string }>({
    namespace: 'entity_metadata',
    pattern: '{entityCode}:viewType',
    version: CACHE_SCHEMA_VERSION,
    defaultTtl: 86400,
  }),

  editType: new KeyBuilder<{ entityCode: string }>({
    namespace: 'entity_metadata',
    pattern: '{entityCode}:editType',
    version: CACHE_SCHEMA_VERSION,
    defaultTtl: 86400,
  }),
};

// ═══════════════════════════════════════════════════════════════════════════
// ENTITY KEYS
// Uses Redis HASH for efficient single-item updates while preserving full-type queries
// ═══════════════════════════════════════════════════════════════════════════

export const ENTITY_KEYS = {
  // HASH containing all entity records for an entity type
  // Key: v1:entity:{entityCode}
  // Fields: entityId → JSON string of entity record
  //
  // Operations:
  //   HGET key entityId        → Get single entity JSON
  //   HSET key entityId json   → Set/update single entity
  //   HDEL key entityId        → Delete single entity
  //   HGETALL key              → Get all entities for type (returns updated data)
  //
  // Benefits:
  //   - Update one entity without invalidating other entities
  //   - HGETALL always returns fresh data after individual updates
  //   - Memory efficient: 1 key per entity type vs N keys per instance
  byType: new KeyBuilder<{ entityCode: string }>({
    namespace: 'entity',
    pattern: '{entityCode}',
    version: CACHE_SCHEMA_VERSION,
    defaultTtl: 300,
  }),

  // Paginated list cache (invalidate on create/delete, NOT on update)
  list: new KeyBuilder<{ entityCode: string; hash: string }>({
    namespace: 'entity',
    pattern: '{entityCode}:list:{hash}',
    version: CACHE_SCHEMA_VERSION,
    defaultTtl: 300,
  }),

  // Count cache (invalidate on create/delete, NOT on update)
  count: new KeyBuilder<{ entityCode: string; hash: string }>({
    namespace: 'entity',
    pattern: '{entityCode}:count:{hash}',
    version: CACHE_SCHEMA_VERSION,
    defaultTtl: 300,
  }),
};

// ═══════════════════════════════════════════════════════════════════════════
// ENTITY_INSTANCE KEYS (Name Lookup - from app.entity_instance)
// Uses Redis HASH for efficient single-item updates while preserving full-type queries
// ═══════════════════════════════════════════════════════════════════════════

export const ENTITY_INSTANCE_KEYS = {
  // HASH containing all names for an entity type
  // Key: v1:entity_instance:{entityCode}
  // Fields: entityId → entityName
  //
  // Operations:
  //   HGET key entityId        → Get single name
  //   HSET key entityId name   → Set/update single name
  //   HDEL key entityId        → Delete single name
  //   HGETALL key              → Get all names for type (returns updated data)
  //
  // Benefits:
  //   - Update one item without invalidating entire cache
  //   - HGETALL always returns fresh data after individual updates
  //   - Memory efficient: 1 key per entity type vs N keys per instance
  byType: new KeyBuilder<{ entityCode: string }>({
    namespace: 'entity_instance',
    pattern: '{entityCode}',
    version: CACHE_SCHEMA_VERSION,
    defaultTtl: 600,
  }),
};

// ═══════════════════════════════════════════════════════════════════════════
// ENTITY_CODE KEYS (Entity Type Registry - from app.entity)
// ═══════════════════════════════════════════════════════════════════════════

export const ENTITY_CODE_KEYS = {
  // All entity types
  all: new KeyBuilder<{}>({
    namespace: 'entity_code',
    pattern: 'all',
    version: CACHE_SCHEMA_VERSION,
    defaultTtl: 3600,
  }),

  // Single entity type definition
  single: new KeyBuilder<{ entityCode: string }>({
    namespace: 'entity_code',
    pattern: '{entityCode}',
    version: CACHE_SCHEMA_VERSION,
    defaultTtl: 3600,
  }),

  // Enriched child entity codes with ui_label, ui_icon
  children: new KeyBuilder<{ entityCode: string }>({
    namespace: 'entity_code',
    pattern: '{entityCode}:children',
    version: CACHE_SCHEMA_VERSION,
    defaultTtl: 3600,
  }),

  // Quick lookup: entity_code → ui_label (for child enrichment)
  lookup: new KeyBuilder<{}>({
    namespace: 'entity_code',
    pattern: 'lookup',
    version: CACHE_SCHEMA_VERSION,
    defaultTtl: 3600,
  }),
};
```

### 2.7 Invalidation Matrix

| Event | Operation | Commands |
|-------|-----------|----------|
| **Person added/removed from role** | DEL | `DEL v1:entity_rbac:person:{personId}:roles` |
| **Permission granted/revoked** | DEL pattern | `DEL v1:entity_rbac:role:{roleId}:{entityCode}:*` |
| **Deny changed** | DEL | `DEL v1:entity_rbac:role:{roleId}:{entityCode}:deny` |
| **Entity created** | HSET + DEL list | `HSET v1:entity:{code} {id} '{...}'` + `HSET v1:entity_instance:{code} {id} {name}` + `DEL v1:entity:{code}:list:*` |
| **Entity updated** | HSET only! | `HSET v1:entity:{code} {id} '{...}'` + `HSET v1:entity_instance:{code} {id} {name}` |
| **Entity deleted** | HDEL + DEL list | `HDEL v1:entity:{code} {id}` + `HDEL v1:entity_instance:{code} {id}` + `DEL v1:entity:{code}:list:*` |
| **Datalabel updated** | DEL pattern | `DEL v1:datalabel:{fieldName}:*` |
| **Schema migration** | DEL pattern | `DEL v1:entity_metadata:{code}:*` |
| **Entity type added/modified** | DEL keys | `DEL v1:entity_code:all`, `v1:entity_code:{code}`, `v1:entity_code:lookup` |
| **Entity type children changed** | DEL | `DEL v1:entity_code:{code}:children` |

**Key Insights:**
1. **Entity UPDATE is just `HSET`** - no cache invalidation needed! The next `HGETALL` returns updated data.
2. **Entity CREATE/DELETE** still invalidate list/count caches (pagination changes).
3. Both `entity` and `entity_instance` use Redis HASH for efficient single-item operations.

---

## 3. Architecture Overview

### 3.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CACHE SERVICE ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                              ┌──────────────┐                                │
│                              │  CacheClient │                                │
│                              │   (Facade)   │                                │
│                              └──────┬───────┘                                │
│                                     │                                        │
│              ┌──────────────────────┼──────────────────────┐                 │
│              │                      │                      │                 │
│              ▼                      ▼                      ▼                 │
│     ┌────────────────┐    ┌────────────────┐    ┌────────────────┐          │
│     │  CacheNamespace │    │  CacheNamespace │    │  CacheNamespace │          │
│     │    "rbac"      │    │    "entity"    │    │   "session"    │          │
│     └───────┬────────┘    └───────┬────────┘    └───────┬────────┘          │
│             │                     │                     │                    │
│             ▼                     ▼                     ▼                    │
│     ┌────────────────────────────────────────────────────────────┐          │
│     │                      CacheEngine                           │          │
│     │                                                            │          │
│     │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │          │
│     │  │ KeyBuilder│  │Serializer│  │Compressor│  │  Metrics │   │          │
│     │  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │          │
│     │                                                            │          │
│     │  ┌──────────────────────────────────────────────────────┐ │          │
│     │  │              Connection Pool + Circuit Breaker        │ │          │
│     │  └──────────────────────────────────────────────────────┘ │          │
│     └─────────────────────────────┬──────────────────────────────┘          │
│                                   │                                          │
│                                   ▼                                          │
│                          ┌────────────────┐                                  │
│                          │     Redis      │                                  │
│                          │   (Primary)    │                                  │
│                          └────────────────┘                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Namespace isolation** | Different domains can't collide; easy bulk invalidation |
| **Strategy composition** | Combine behaviors without subclassing |
| **Schema versioning** | Key format changes don't corrupt cache |
| **Lazy connections** | Don't block startup; connect on first use |
| **Graceful fallback** | Return `null` on Redis failure, let caller decide |

---

## 4. Core Abstractions

### 4.1 Type Definitions

```typescript
// apps/api/src/lib/cache/types.ts

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  value: T;
  createdAt: number;      // Unix timestamp
  expiresAt: number;      // Unix timestamp
  version: number;        // Schema version
  compressed: boolean;    // Was value compressed?
}

/**
 * Cache options for individual operations
 */
interface CacheOptions {
  ttl?: number;           // Time-to-live in seconds
  tags?: string[];        // Tags for bulk invalidation
  compress?: boolean;     // Compress large values
  skipCache?: boolean;    // Bypass cache (force DB fetch)
  staleWhileRevalidate?: number;  // Serve stale for N seconds while refreshing
}

/**
 * Cache key definition - type-safe key building
 */
interface CacheKeyDef<TParams extends Record<string, string>> {
  namespace: string;
  pattern: string;        // e.g., "{roleId}:{entityCode}:type"
  version: number;        // Schema version for migrations
  defaultTtl: number;
}

/**
 * Data source for cache-aside pattern
 */
interface DataSource<T, TParams> {
  fetch: (params: TParams) => Promise<T | null>;
  fetchMany?: (paramsList: TParams[]) => Promise<Map<string, T>>;
}

/**
 * Cache statistics
 */
interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
  avgLatencyMs: number;
  memoryUsageBytes: number;
}
```

### 3.2 CacheEngine (Core)

```typescript
// apps/api/src/lib/cache/cache-engine.ts

import Redis from 'ioredis';

export class CacheEngine {
  private redis: Redis;
  private metrics: MetricsCollector;
  private circuit: CircuitBreaker;

  constructor(config: CacheEngineConfig) {
    this.redis = new Redis(config.redis);
    this.metrics = new MetricsCollector(config.metrics);
    this.circuit = new CircuitBreaker(config.circuit);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIMITIVE OPERATIONS (Domain-agnostic)
  // ═══════════════════════════════════════════════════════════════════════

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    return this.circuit.execute(async () => {
      const start = Date.now();
      try {
        const raw = await this.redis.get(key);
        if (!raw) {
          this.metrics.recordMiss(key);
          return null;
        }
        this.metrics.recordHit(key, Date.now() - start);
        return this.deserialize<T>(raw);
      } catch (error) {
        this.metrics.recordError(key, error);
        return null; // Graceful degradation
      }
    });
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    return this.circuit.execute(async () => {
      const entry: CacheEntry<T> = {
        value,
        createdAt: Date.now(),
        expiresAt: Date.now() + (options.ttl || 300) * 1000,
        version: 1,
        compressed: false,
      };

      const serialized = this.serialize(entry, options.compress);

      if (options.ttl) {
        await this.redis.setex(key, options.ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }

      // Store tags for bulk invalidation
      if (options.tags?.length) {
        await this.addToTags(key, options.tags);
      }

      return true;
    }, false);
  }

  async mget<T>(keys: string[]): Promise<Map<string, CacheEntry<T>>> {
    return this.circuit.execute(async () => {
      const results = await this.redis.mget(...keys);
      const map = new Map<string, CacheEntry<T>>();

      results.forEach((raw, index) => {
        if (raw) {
          map.set(keys[index], this.deserialize<T>(raw));
          this.metrics.recordHit(keys[index]);
        } else {
          this.metrics.recordMiss(keys[index]);
        }
      });

      return map;
    }, new Map());
  }

  async del(key: string): Promise<boolean> {
    return this.circuit.execute(async () => {
      await this.redis.del(key);
      return true;
    }, false);
  }

  async delByPattern(pattern: string): Promise<number> {
    return this.circuit.execute(async () => {
      let deleted = 0;
      let cursor = '0';

      do {
        const [newCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = newCursor;
        if (keys.length > 0) {
          await this.redis.del(...keys);
          deleted += keys.length;
        }
      } while (cursor !== '0');

      this.metrics.recordInvalidation(pattern, deleted);
      return deleted;
    }, 0);
  }

  async invalidateByTag(tag: string): Promise<number> {
    return this.circuit.execute(async () => {
      const keys = await this.redis.smembers(`tag:${tag}`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        await this.redis.del(`tag:${tag}`);
      }
      return keys.length;
    }, 0);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SET OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════

  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.circuit.execute(() => this.redis.sadd(key, ...members), 0);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    return this.circuit.execute(async () => (await this.redis.sismember(key, member)) === 1, false);
  }

  async smembers(key: string): Promise<string[]> {
    return this.circuit.execute(() => this.redis.smembers(key), []);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  private serialize<T>(entry: CacheEntry<T>, compress?: boolean): string {
    const json = JSON.stringify(entry);
    if (compress && json.length > 1024) {
      // Compress large values (implementation detail)
      entry.compressed = true;
      return compressSync(json);
    }
    return json;
  }

  private deserialize<T>(raw: string): CacheEntry<T> {
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (entry.compressed) {
      entry.value = JSON.parse(decompressSync(entry.value as unknown as string));
    }
    return entry;
  }

  private async addToTags(key: string, tags: string[]): Promise<void> {
    const pipeline = this.redis.pipeline();
    tags.forEach(tag => pipeline.sadd(`tag:${tag}`, key));
    await pipeline.exec();
  }
}
```

### 3.3 KeyBuilder (Type-Safe)

```typescript
// apps/api/src/lib/cache/key-builder.ts

/**
 * Type-safe cache key builder with schema versioning
 */
export class KeyBuilder<TParams extends Record<string, string>> {
  constructor(private def: CacheKeyDef<TParams>) {}

  /**
   * Build a cache key from parameters
   * @example
   * const key = entityRbacKey.build({ roleId: 'abc', entityCode: 'task' });
   * // Returns: "v1:entity_rbac:abc:task:type"
   */
  build(params: TParams): string {
    let key = this.def.pattern;
    for (const [param, value] of Object.entries(params)) {
      key = key.replace(`{${param}}`, value);
    }
    return `v${this.def.version}:${this.def.namespace}:${key}`;
  }

  /**
   * Build a pattern for bulk operations
   * @example
   * const pattern = entityRbacKey.pattern({ roleId: 'abc' });
   * // Returns: "v1:entity_rbac:abc:*"
   */
  pattern(partialParams: Partial<TParams>): string {
    let key = this.def.pattern;
    for (const [param, value] of Object.entries(partialParams)) {
      key = key.replace(`{${param}}`, value as string);
    }
    // Replace remaining params with wildcard
    key = key.replace(/\{[^}]+\}/g, '*');
    return `v${this.def.version}:${this.def.namespace}:${key}`;
  }

  /**
   * Parse a key back to parameters
   */
  parse(key: string): TParams | null {
    const prefix = `v${this.def.version}:${this.def.namespace}:`;
    if (!key.startsWith(prefix)) return null;

    const value = key.slice(prefix.length);
    const paramNames = this.def.pattern.match(/\{([^}]+)\}/g)?.map(p => p.slice(1, -1)) || [];
    const regex = new RegExp(this.def.pattern.replace(/\{[^}]+\}/g, '([^:]+)'));
    const match = value.match(regex);

    if (!match) return null;

    const params: Record<string, string> = {};
    paramNames.forEach((name, index) => {
      params[name] = match[index + 1];
    });

    return params as TParams;
  }

  get defaultTtl(): number {
    return this.def.defaultTtl;
  }

  get namespace(): string {
    return this.def.namespace;
  }
}
```

---

## 4. Cache Strategies

### 4.1 Strategy Interface

```typescript
// apps/api/src/lib/cache/strategies/types.ts

/**
 * Cache strategy - defines HOW to cache
 */
interface CacheStrategy<T, TParams> {
  /**
   * Get value, using cache and/or data source
   */
  get(
    key: string,
    params: TParams,
    dataSource: DataSource<T, TParams>,
    options?: CacheOptions
  ): Promise<T | null>;

  /**
   * Get multiple values
   */
  getMany?(
    keys: Map<string, TParams>,
    dataSource: DataSource<T, TParams>,
    options?: CacheOptions
  ): Promise<Map<string, T>>;

  /**
   * Invalidate cached value(s)
   */
  invalidate(key: string): Promise<void>;
}
```

### 4.2 Cache-Aside Strategy (Default)

```typescript
// apps/api/src/lib/cache/strategies/cache-aside.ts

/**
 * Cache-Aside (Lazy Loading)
 *
 * 1. Check cache
 * 2. If miss, fetch from data source
 * 3. Store in cache
 * 4. Return value
 *
 * Best for: Read-heavy workloads, data that can be stale
 */
export class CacheAsideStrategy<T, TParams> implements CacheStrategy<T, TParams> {
  constructor(
    private engine: CacheEngine,
    private keyBuilder: KeyBuilder<TParams>
  ) {}

  async get(
    key: string,
    params: TParams,
    dataSource: DataSource<T, TParams>,
    options?: CacheOptions
  ): Promise<T | null> {
    // Skip cache if requested
    if (options?.skipCache) {
      return dataSource.fetch(params);
    }

    // Try cache first
    const cached = await this.engine.get<T>(key);
    if (cached) {
      // Check if stale but within SWR window
      if (this.isStale(cached) && options?.staleWhileRevalidate) {
        // Return stale, refresh in background
        this.refreshInBackground(key, params, dataSource, options);
      }
      return cached.value;
    }

    // Cache miss - fetch from source
    const value = await dataSource.fetch(params);
    if (value !== null) {
      await this.engine.set(key, value, {
        ttl: options?.ttl || this.keyBuilder.defaultTtl,
        tags: options?.tags,
      });
    }

    return value;
  }

  async getMany(
    keys: Map<string, TParams>,
    dataSource: DataSource<T, TParams>,
    options?: CacheOptions
  ): Promise<Map<string, T>> {
    const keyArray = Array.from(keys.keys());

    // Batch fetch from cache
    const cached = await this.engine.mget<T>(keyArray);

    // Find missing keys
    const missing = new Map<string, TParams>();
    keys.forEach((params, key) => {
      if (!cached.has(key)) {
        missing.set(key, params);
      }
    });

    // Fetch missing from data source
    if (missing.size > 0 && dataSource.fetchMany) {
      const fetched = await dataSource.fetchMany(Array.from(missing.values()));

      // Cache fetched values
      const pipeline: Promise<boolean>[] = [];
      fetched.forEach((value, key) => {
        cached.set(key, { value } as CacheEntry<T>);
        pipeline.push(this.engine.set(key, value, {
          ttl: options?.ttl || this.keyBuilder.defaultTtl,
        }));
      });
      await Promise.all(pipeline);
    }

    // Extract values from entries
    const result = new Map<string, T>();
    cached.forEach((entry, key) => {
      result.set(key, entry.value);
    });

    return result;
  }

  async invalidate(key: string): Promise<void> {
    await this.engine.del(key);
  }

  private isStale(entry: CacheEntry<unknown>): boolean {
    return Date.now() > entry.expiresAt;
  }

  private async refreshInBackground(
    key: string,
    params: TParams,
    dataSource: DataSource<T, TParams>,
    options?: CacheOptions
  ): Promise<void> {
    // Fire and forget
    dataSource.fetch(params).then(value => {
      if (value !== null) {
        this.engine.set(key, value, {
          ttl: options?.ttl || this.keyBuilder.defaultTtl,
        });
      }
    }).catch(() => {
      // Ignore errors in background refresh
    });
  }
}
```

### 4.3 Write-Through Strategy

```typescript
// apps/api/src/lib/cache/strategies/write-through.ts

/**
 * Write-Through
 *
 * 1. Write to data source
 * 2. Write to cache
 * 3. Return
 *
 * Best for: Data that must be consistent
 */
export class WriteThroughStrategy<T, TParams> implements CacheStrategy<T, TParams> {
  constructor(
    private engine: CacheEngine,
    private keyBuilder: KeyBuilder<TParams>
  ) {}

  async set(
    key: string,
    value: T,
    writeToSource: () => Promise<void>,
    options?: CacheOptions
  ): Promise<void> {
    // Write to source first (must succeed)
    await writeToSource();

    // Then update cache
    await this.engine.set(key, value, {
      ttl: options?.ttl || this.keyBuilder.defaultTtl,
      tags: options?.tags,
    });
  }

  // ... get and invalidate same as cache-aside
}
```

### 4.4 Strategy Composition

```typescript
// apps/api/src/lib/cache/strategies/composed.ts

/**
 * Compose multiple strategies with fallbacks
 */
export class ComposedStrategy<T, TParams> implements CacheStrategy<T, TParams> {
  constructor(private strategies: CacheStrategy<T, TParams>[]) {}

  async get(
    key: string,
    params: TParams,
    dataSource: DataSource<T, TParams>,
    options?: CacheOptions
  ): Promise<T | null> {
    for (const strategy of this.strategies) {
      try {
        const result = await strategy.get(key, params, dataSource, options);
        if (result !== null) return result;
      } catch {
        // Try next strategy
        continue;
      }
    }
    return null;
  }

  async invalidate(key: string): Promise<void> {
    await Promise.all(this.strategies.map(s => s.invalidate(key)));
  }
}
```

---

## 5. Domain Adapters

### 5.1 Adapter Interface

```typescript
// apps/api/src/lib/cache/adapters/types.ts

/**
 * Domain adapter - translates domain concepts to cache operations
 */
interface CacheAdapter<TDomain> {
  /**
   * Namespace for this domain
   */
  readonly namespace: string;

  /**
   * Get domain-specific cache statistics
   */
  getStats(): Promise<CacheStats>;

  /**
   * Warm up cache for common access patterns
   */
  warmUp?(): Promise<void>;

  /**
   * Clear all cached data for this domain
   */
  clearAll(): Promise<void>;
}
```

### 5.2 Entity RBAC Cache Adapter

```typescript
// apps/api/src/lib/cache/adapters/entity-rbac-adapter.ts

// Key definitions
const ENTITY_RBAC_KEYS = {
  personRoles: new KeyBuilder<{ personId: string }>({
    namespace: 'entity_rbac',
    pattern: 'person:{personId}:roles',
    version: 1,
    defaultTtl: 300,
  }),

  roleDeny: new KeyBuilder<{ roleId: string; entityCode: string }>({
    namespace: 'entity_rbac',
    pattern: 'role:{roleId}:{entityCode}:deny',
    version: 1,
    defaultTtl: 300,
  }),

  roleTypePermission: new KeyBuilder<{ roleId: string; entityCode: string }>({
    namespace: 'entity_rbac',
    pattern: 'role:{roleId}:{entityCode}:type',
    version: 1,
    defaultTtl: 300,
  }),

  roleInstancePermission: new KeyBuilder<{ roleId: string; entityCode: string; entityId: string }>({
    namespace: 'entity_rbac',
    pattern: 'role:{roleId}:{entityCode}:perm:{entityId}',
    version: 1,
    defaultTtl: 300,
  }),
};

export class EntityRbacCacheAdapter implements CacheAdapter<Permission> {
  readonly namespace = 'entity_rbac';

  private personRolesCache: CacheAsideStrategy<string[], { personId: string }>;
  private denyCache: CacheAsideStrategy<Set<string>, { roleId: string; entityCode: string }>;
  private typePermCache: CacheAsideStrategy<number, { roleId: string; entityCode: string }>;
  private instancePermCache: CacheAsideStrategy<number, { roleId: string; entityCode: string; entityId: string }>;

  constructor(private engine: CacheEngine, private db: Database) {
    this.personRolesCache = new CacheAsideStrategy(engine, ENTITY_RBAC_KEYS.personRoles);
    this.denyCache = new CacheAsideStrategy(engine, ENTITY_RBAC_KEYS.roleDeny);
    this.typePermCache = new CacheAsideStrategy(engine, ENTITY_RBAC_KEYS.roleTypePermission);
    this.instancePermCache = new CacheAsideStrategy(engine, ENTITY_RBAC_KEYS.roleInstancePermission);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DOMAIN METHODS
  // ═══════════════════════════════════════════════════════════════════════

  async getPersonRoles(personId: string): Promise<string[]> {
    const key = ENTITY_RBAC_KEYS.personRoles.build({ personId });
    return this.personRolesCache.get(key, { personId }, {
      fetch: async () => this.queryPersonRoles(personId),
    }) ?? [];
  }

  async checkDenyAcrossRoles(
    roles: string[],
    entityCode: string,
    entityId: string
  ): Promise<boolean> {
    // Parallel check across all roles
    const checks = roles.map(async roleId => {
      const key = ENTITY_RBAC_KEYS.roleDeny.build({ roleId, entityCode });
      const deniedSet = await this.denyCache.get(key, { roleId, entityCode }, {
        fetch: async () => this.queryRoleDenies(roleId, entityCode),
      });
      return deniedSet?.has(entityId) ?? false;
    });

    const results = await Promise.all(checks);
    return results.some(denied => denied);
  }

  async getMaxTypeLevelAcrossRoles(roles: string[], entityCode: string): Promise<number> {
    // Build keys for batch fetch
    const keys = new Map<string, { roleId: string; entityCode: string }>();
    roles.forEach(roleId => {
      keys.set(ENTITY_RBAC_KEYS.roleTypePermission.build({ roleId, entityCode }), { roleId, entityCode });
    });

    const results = await this.typePermCache.getMany(keys, {
      fetch: async ({ roleId, entityCode }) => this.queryRoleTypePerm(roleId, entityCode),
      fetchMany: async (params) => this.queryRoleTypePermBatch(params),
    });

    return Math.max(-1, ...Array.from(results.values()));
  }

  async getMaxInstanceLevelAcrossRoles(
    roles: string[],
    entityCode: string,
    entityId: string
  ): Promise<number> {
    const keys = new Map<string, { roleId: string; entityCode: string; entityId: string }>();
    roles.forEach(roleId => {
      keys.set(
        ENTITY_RBAC_KEYS.roleInstancePermission.build({ roleId, entityCode, entityId }),
        { roleId, entityCode, entityId }
      );
    });

    const results = await this.instancePermCache.getMany(keys, {
      fetch: async (params) => this.queryRoleInstancePerm(params),
    });

    return Math.max(-1, ...Array.from(results.values()));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INVALIDATION
  // ═══════════════════════════════════════════════════════════════════════

  async invalidatePersonRoles(personId: string): Promise<void> {
    const key = ENTITY_RBAC_KEYS.personRoles.build({ personId });
    await this.engine.del(key);
  }

  async invalidateRolePermission(roleId: string, entityCode: string): Promise<void> {
    await Promise.all([
      this.engine.del(ENTITY_RBAC_KEYS.roleTypePermission.build({ roleId, entityCode })),
      this.engine.delByPattern(ENTITY_RBAC_KEYS.roleInstancePermission.pattern({ roleId, entityCode })),
    ]);
  }

  async invalidateRoleDeny(roleId: string, entityCode: string): Promise<void> {
    const key = ENTITY_RBAC_KEYS.roleDeny.build({ roleId, entityCode });
    await this.engine.del(key);
  }

  async invalidateRole(roleId: string): Promise<void> {
    await this.engine.delByPattern(`v1:entity_rbac:role:${roleId}:*`);
  }

  async clearAll(): Promise<void> {
    await this.engine.delByPattern('v1:entity_rbac:*');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DATABASE QUERIES (Data Source)
  // ═══════════════════════════════════════════════════════════════════════

  private async queryPersonRoles(personId: string): Promise<string[]> {
    const result = await this.db.execute(sql`
      SELECT entity_instance_id AS role_id
      FROM app.entity_instance_link
      WHERE entity_code = 'role'
        AND child_entity_code = 'person'
        AND child_entity_instance_id = ${personId}::uuid
    `);
    return result.map(r => r.role_id);
  }

  private async queryRoleDenies(roleId: string, entityCode: string): Promise<Set<string>> {
    const result = await this.db.execute(sql`
      SELECT entity_instance_id
      FROM app.entity_rbac
      WHERE role_id = ${roleId}::uuid
        AND entity_code = ${entityCode}
        AND is_deny = true
    `);
    return new Set(result.map(r => r.entity_instance_id));
  }

  private async queryRoleTypePerm(roleId: string, entityCode: string): Promise<number> {
    const result = await this.db.execute(sql`
      SELECT COALESCE(MAX(permission), -1) as permission
      FROM app.entity_rbac
      WHERE role_id = ${roleId}::uuid
        AND entity_code = ${entityCode}
        AND entity_instance_id = '11111111-1111-1111-1111-111111111111'
        AND is_deny = false
    `);
    return result[0]?.permission ?? -1;
  }

  // ... other query methods
}
```

### 5.3 Entity Cache Adapter

```typescript
// apps/api/src/lib/cache/adapters/entity-adapter.ts

const ENTITY_KEYS = {
  instance: new KeyBuilder<{ entityCode: string; entityId: string }>({
    namespace: 'entity',
    pattern: '{entityCode}:{entityId}',
    version: 1,
    defaultTtl: 300,
  }),

  list: new KeyBuilder<{ entityCode: string; hash: string }>({
    namespace: 'entity',
    pattern: '{entityCode}:list:{hash}',
    version: 1,
    defaultTtl: 120,
  }),

  metadata: new KeyBuilder<{ entityCode: string }>({
    namespace: 'entity',
    pattern: '{entityCode}:metadata',
    version: 1,
    defaultTtl: 1800,
  }),

  fields: new KeyBuilder<{ entityCode: string }>({
    namespace: 'entity',
    pattern: '{entityCode}:fields',
    version: 1,
    defaultTtl: 86400,
  }),
};

export class EntityCacheAdapter implements CacheAdapter<Entity> {
  readonly namespace = 'entity';

  constructor(private engine: CacheEngine) {}

  async getEntity<T>(entityCode: string, entityId: string): Promise<T | null> {
    const key = ENTITY_KEYS.instance.build({ entityCode, entityId });
    return this.engine.get<T>(key).then(e => e?.value ?? null);
  }

  async setEntity<T>(entityCode: string, entityId: string, value: T): Promise<void> {
    const key = ENTITY_KEYS.instance.build({ entityCode, entityId });
    await this.engine.set(key, value, {
      ttl: ENTITY_KEYS.instance.defaultTtl,
      tags: [`entity:${entityCode}`],
    });
  }

  async getMetadata(entityCode: string): Promise<EntityMetadata | null> {
    const key = ENTITY_KEYS.metadata.build({ entityCode });
    return this.engine.get<EntityMetadata>(key).then(e => e?.value ?? null);
  }

  async getFields(entityCode: string): Promise<string[] | null> {
    const key = ENTITY_KEYS.fields.build({ entityCode });
    return this.engine.get<string[]>(key).then(e => e?.value ?? null);
  }

  async invalidateEntity(entityCode: string, entityId: string): Promise<void> {
    await this.engine.del(ENTITY_KEYS.instance.build({ entityCode, entityId }));
  }

  async invalidateEntityType(entityCode: string): Promise<void> {
    await this.engine.invalidateByTag(`entity:${entityCode}`);
  }

  async clearAll(): Promise<void> {
    await this.engine.delByPattern('v1:entity:*');
  }
}
```

### 5.4 Session Cache Adapter

```typescript
// apps/api/src/lib/cache/adapters/session-adapter.ts

const SESSION_KEYS = {
  session: new KeyBuilder<{ sessionId: string }>({
    namespace: 'session',
    pattern: '{sessionId}',
    version: 1,
    defaultTtl: 3600, // 1 hour
  }),

  userSessions: new KeyBuilder<{ userId: string }>({
    namespace: 'session',
    pattern: 'user:{userId}:sessions',
    version: 1,
    defaultTtl: 3600,
  }),
};

export class SessionCacheAdapter implements CacheAdapter<Session> {
  readonly namespace = 'session';

  constructor(private engine: CacheEngine) {}

  async getSession(sessionId: string): Promise<Session | null> {
    const key = SESSION_KEYS.session.build({ sessionId });
    return this.engine.get<Session>(key).then(e => e?.value ?? null);
  }

  async setSession(sessionId: string, session: Session, ttl?: number): Promise<void> {
    const key = SESSION_KEYS.session.build({ sessionId });
    await this.engine.set(key, session, { ttl: ttl || SESSION_KEYS.session.defaultTtl });

    // Track user's sessions
    await this.engine.sadd(SESSION_KEYS.userSessions.build({ userId: session.userId }), sessionId);
  }

  async invalidateSession(sessionId: string): Promise<void> {
    await this.engine.del(SESSION_KEYS.session.build({ sessionId }));
  }

  async invalidateUserSessions(userId: string): Promise<void> {
    const key = SESSION_KEYS.userSessions.build({ userId });
    const sessions = await this.engine.smembers(key);

    if (sessions.length > 0) {
      await Promise.all(sessions.map(s => this.invalidateSession(s)));
      await this.engine.del(key);
    }
  }

  async clearAll(): Promise<void> {
    await this.engine.delByPattern('v1:session:*');
  }
}
```

---

## 6. Invalidation Patterns

### 6.1 Event-Driven Invalidation

```typescript
// apps/api/src/lib/cache/invalidation/event-handler.ts

type InvalidationEvent =
  | { type: 'PERSON_ROLE_CHANGED'; personId: string }
  | { type: 'PERMISSION_CHANGED'; roleId: string; entityCode: string }
  | { type: 'DENY_CHANGED'; roleId: string; entityCode: string }
  | { type: 'ENTITY_UPDATED'; entityCode: string; entityId: string }
  | { type: 'ENTITY_DELETED'; entityCode: string; entityId: string }
  | { type: 'HIERARCHY_CHANGED'; entityCode: string };

export class CacheInvalidationHandler {
  constructor(
    private rbac: RbacCacheAdapter,
    private entity: EntityCacheAdapter
  ) {}

  async handle(event: InvalidationEvent): Promise<void> {
    switch (event.type) {
      case 'PERSON_ROLE_CHANGED':
        await this.rbac.invalidatePersonRoles(event.personId);
        break;

      case 'PERMISSION_CHANGED':
        await this.rbac.invalidateRolePermission(event.roleId, event.entityCode);
        break;

      case 'DENY_CHANGED':
        await this.rbac.invalidateRoleDeny(event.roleId, event.entityCode);
        break;

      case 'ENTITY_UPDATED':
        await this.entity.invalidateEntity(event.entityCode, event.entityId);
        break;

      case 'ENTITY_DELETED':
        await Promise.all([
          this.entity.invalidateEntity(event.entityCode, event.entityId),
          this.rbac.invalidateHierarchy(event.entityCode),
        ]);
        break;

      case 'HIERARCHY_CHANGED':
        await this.rbac.invalidateHierarchy(event.entityCode);
        break;
    }
  }
}
```

### 6.2 Database Trigger Integration

```typescript
// apps/api/src/lib/cache/invalidation/db-trigger.ts

/**
 * Subscribe to database changes via app.system_logging
 */
export class DatabaseChangeSubscriber {
  constructor(
    private handler: CacheInvalidationHandler,
    private pollInterval: number = 1000
  ) {}

  async start(): Promise<void> {
    setInterval(async () => {
      const changes = await this.pollChanges();
      for (const change of changes) {
        await this.handler.handle(this.mapToEvent(change));
        await this.markProcessed(change.id);
      }
    }, this.pollInterval);
  }

  private mapToEvent(change: DbChange): InvalidationEvent {
    if (change.table === 'entity_instance_link' && change.data.entity_code === 'role') {
      return { type: 'PERSON_ROLE_CHANGED', personId: change.data.child_entity_instance_id };
    }
    if (change.table === 'entity_rbac') {
      if (change.data.is_deny) {
        return { type: 'DENY_CHANGED', roleId: change.data.role_id, entityCode: change.data.entity_code };
      }
      return { type: 'PERMISSION_CHANGED', roleId: change.data.role_id, entityCode: change.data.entity_code };
    }
    // ... other mappings
  }
}
```

---

## 7. Observability

### 7.1 Metrics Collector

```typescript
// apps/api/src/lib/cache/observability/metrics.ts

export class MetricsCollector {
  private hits = new Map<string, number>();
  private misses = new Map<string, number>();
  private errors = new Map<string, number>();
  private latencies: number[] = [];

  recordHit(key: string, latencyMs?: number): void {
    const namespace = this.extractNamespace(key);
    this.hits.set(namespace, (this.hits.get(namespace) || 0) + 1);
    if (latencyMs) this.latencies.push(latencyMs);
  }

  recordMiss(key: string): void {
    const namespace = this.extractNamespace(key);
    this.misses.set(namespace, (this.misses.get(namespace) || 0) + 1);
  }

  recordError(key: string, error: Error): void {
    const namespace = this.extractNamespace(key);
    this.errors.set(namespace, (this.errors.get(namespace) || 0) + 1);
    // Log error for debugging
    console.error(`Cache error [${namespace}]:`, error.message);
  }

  recordInvalidation(pattern: string, count: number): void {
    // Track invalidation patterns for optimization
    console.info(`Cache invalidated: ${pattern} (${count} keys)`);
  }

  getStats(namespace?: string): CacheStats {
    const hits = namespace ? (this.hits.get(namespace) || 0) : this.sumMap(this.hits);
    const misses = namespace ? (this.misses.get(namespace) || 0) : this.sumMap(this.misses);
    const errors = namespace ? (this.errors.get(namespace) || 0) : this.sumMap(this.errors);

    return {
      hits,
      misses,
      errors,
      hitRate: hits / (hits + misses) || 0,
      avgLatencyMs: this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length || 0,
    };
  }

  // Export to Prometheus format
  toPrometheus(): string {
    const lines: string[] = [];
    this.hits.forEach((count, ns) => {
      lines.push(`cache_hits_total{namespace="${ns}"} ${count}`);
    });
    this.misses.forEach((count, ns) => {
      lines.push(`cache_misses_total{namespace="${ns}"} ${count}`);
    });
    return lines.join('\n');
  }
}
```

### 7.2 Circuit Breaker

```typescript
// apps/api/src/lib/cache/observability/circuit-breaker.ts

enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, skip cache
  HALF_OPEN = 'HALF_OPEN' // Testing if recovered
}

export class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failures = 0;
  private lastFailure = 0;
  private readonly threshold: number;
  private readonly resetTimeout: number;

  constructor(config: { threshold?: number; resetTimeout?: number } = {}) {
    this.threshold = config.threshold || 5;
    this.resetTimeout = config.resetTimeout || 30000; // 30 seconds
  }

  async execute<T>(fn: () => Promise<T>, fallback?: T): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        return fallback as T;
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback !== undefined) return fallback;
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = CircuitState.CLOSED;
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.threshold) {
      this.state = CircuitState.OPEN;
      console.warn(`Circuit breaker OPEN after ${this.failures} failures`);
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}
```

---

## 8. Implementation Guide

### 8.1 Directory Structure

```
apps/api/src/lib/cache/
├── index.ts                    # Public exports
├── types.ts                    # Type definitions
├── cache-engine.ts             # Core Redis operations
├── key-builder.ts              # Type-safe key building
├── cache-client.ts             # Facade for all adapters
│
├── strategies/
│   ├── index.ts
│   ├── types.ts
│   ├── cache-aside.ts
│   ├── write-through.ts
│   └── composed.ts
│
├── adapters/
│   ├── index.ts
│   ├── types.ts
│   ├── rbac-adapter.ts
│   ├── entity-adapter.ts
│   ├── session-adapter.ts
│   └── metadata-adapter.ts
│
├── invalidation/
│   ├── index.ts
│   ├── event-handler.ts
│   └── db-trigger.ts
│
└── observability/
    ├── index.ts
    ├── metrics.ts
    └── circuit-breaker.ts
```

### 8.2 Initialization

```typescript
// apps/api/src/lib/cache/index.ts

import { CacheEngine } from './cache-engine';
import { RbacCacheAdapter } from './adapters/rbac-adapter';
import { EntityCacheAdapter } from './adapters/entity-adapter';
import { SessionCacheAdapter } from './adapters/session-adapter';
import { CacheInvalidationHandler } from './invalidation/event-handler';

// Singleton instances
let cacheEngine: CacheEngine;
let rbacCache: RbacCacheAdapter;
let entityCache: EntityCacheAdapter;
let sessionCache: SessionCacheAdapter;
let invalidationHandler: CacheInvalidationHandler;

export function initializeCache(config: CacheConfig): void {
  cacheEngine = new CacheEngine(config);
  rbacCache = new RbacCacheAdapter(cacheEngine, db);
  entityCache = new EntityCacheAdapter(cacheEngine);
  sessionCache = new SessionCacheAdapter(cacheEngine);
  invalidationHandler = new CacheInvalidationHandler(rbacCache, entityCache);
}

export { rbacCache, entityCache, sessionCache, invalidationHandler };
```

### 8.3 Adding a New Domain Adapter

```typescript
// Step 1: Define keys
const MY_KEYS = {
  myKey: new KeyBuilder<{ param1: string; param2: string }>({
    namespace: 'mydomain',
    pattern: '{param1}:{param2}',
    version: 1,
    defaultTtl: 300,
  }),
};

// Step 2: Create adapter
export class MyDomainCacheAdapter implements CacheAdapter<MyType> {
  readonly namespace = 'mydomain';

  constructor(private engine: CacheEngine) {}

  async get(param1: string, param2: string): Promise<MyType | null> {
    const key = MY_KEYS.myKey.build({ param1, param2 });
    return this.engine.get<MyType>(key).then(e => e?.value ?? null);
  }

  async set(param1: string, param2: string, value: MyType): Promise<void> {
    const key = MY_KEYS.myKey.build({ param1, param2 });
    await this.engine.set(key, value, { ttl: MY_KEYS.myKey.defaultTtl });
  }

  async invalidate(param1: string, param2: string): Promise<void> {
    await this.engine.del(MY_KEYS.myKey.build({ param1, param2 }));
  }

  async clearAll(): Promise<void> {
    await this.engine.delByPattern('v1:mydomain:*');
  }
}

// Step 3: Register in index.ts
// Step 4: Add invalidation events if needed
```

---

## 9. Usage Examples

### 9.1 RBAC Permission Check (Cached)

```typescript
import { rbacCache } from '@/lib/cache';

async function checkPermission(
  personId: string,
  entityCode: string,
  entityId: string,
  requiredLevel: number
): Promise<boolean> {
  // Step 1: Get person's roles (cached)
  const roles = await rbacCache.getPersonRoles(personId);
  if (roles.length === 0) return false;

  // Step 2: Check deny (cached, parallel)
  const isDenied = await rbacCache.checkDenyAcrossRoles(roles, entityCode, entityId);
  if (isDenied) return false;

  // Step 3: Check type-level permission (cached, batch)
  const typeLevel = await rbacCache.getMaxTypeLevelAcrossRoles(roles, entityCode);
  if (typeLevel >= requiredLevel) return true;

  // Step 4: Check instance permission (cached, batch)
  const instanceLevel = await rbacCache.getMaxInstanceLevelAcrossRoles(roles, entityCode, entityId);
  return instanceLevel >= requiredLevel;
}
```

### 9.2 Entity with Cache

```typescript
import { entityCache } from '@/lib/cache';

async function getProject(projectId: string): Promise<Project | null> {
  // Try cache first
  const cached = await entityCache.getEntity<Project>('project', projectId);
  if (cached) return cached;

  // Fetch from DB
  const project = await db.query('SELECT * FROM app.project WHERE id = $1', [projectId]);
  if (project) {
    await entityCache.setEntity('project', projectId, project);
  }

  return project;
}
```

### 9.3 Invalidation on Update

```typescript
import { invalidationHandler } from '@/lib/cache';

// In route handler
fastify.patch('/api/v1/project/:id', async (request, reply) => {
  const { id } = request.params;

  // Update database
  await db.query('UPDATE app.project SET ... WHERE id = $1', [id]);

  // Invalidate cache
  await invalidationHandler.handle({
    type: 'ENTITY_UPDATED',
    entityCode: 'project',
    entityId: id,
  });

  return reply.send({ success: true });
});
```

### 9.4 Cache Statistics Endpoint

```typescript
fastify.get('/api/v1/admin/cache/stats', async (request, reply) => {
  const stats = {
    rbac: await rbacCache.getStats(),
    entity: await entityCache.getStats(),
    session: await sessionCache.getStats(),
  };

  return reply.send(stats);
});
```

### 9.5 Hierarchical Permissions Route (Entity Type + Child Enrichment)

This example shows how the complex `GET /api/v1/entity_rbac/role/:roleId/hierarchical-permissions` route can leverage the cache service for entity type lookups and child entity enrichment.

**Current Pattern (Without Cache):**
```typescript
// 2 DB queries + N lookups for child enrichment
const entityTypesResult = await db.execute(sql`SELECT code, name, ui_label, ui_icon, child_entity_codes FROM app.entity`);
const permissionsResult = await db.execute(sql`SELECT ... FROM app.entity_rbac WHERE role_id = ${roleId}`);

// Build lookup manually from query results
const entityLookup = new Map();
for (const et of entityTypesResult) {
  entityLookup.set(et.code, { ui_label: et.ui_label, ui_icon: et.ui_icon });
}

// Transform child_entity_codes: ["task", "document"] → enriched objects
const childCodes = entityType.child_entity_codes || [];
const transformedChildCodes = childCodes.map((code, index) => ({
  entity: code,
  ui_label: entityLookup.get(code)?.ui_label || code,
  ui_icon: entityLookup.get(code)?.ui_icon || null,
  order: index,
}));
```

**Optimized Pattern (With Cache):**
```typescript
import { entityCodeCache, entityInstanceCache, rbacCache } from '@/lib/cache';

// GET /api/v1/entity_rbac/role/:roleId/hierarchical-permissions
async function getHierarchicalPermissions(roleId: string) {
  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1: Get entity code lookup from cache (or warm on first access)
  // ═══════════════════════════════════════════════════════════════════════
  // Key: v1:entity_code:lookup → HASH {code → ui_label}
  const entityCodeLookup = await entityCodeCache.getLookup();
  // Returns: { project: "Project", task: "Task", document: "Document", ... }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2: Get all entity codes (for child_entity_codes enrichment)
  // ═══════════════════════════════════════════════════════════════════════
  // Key: v1:entity_code:all
  const allEntityCodes = await entityCodeCache.getAll();
  // Returns: [{ code, name, ui_label, ui_icon, child_entity_codes }, ...]

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3: Get cached enriched children for each entity code
  // ═══════════════════════════════════════════════════════════════════════
  // Key: v1:entity_code:{entityCode}:children
  // This avoids re-computing the transformation on every request
  const enrichedChildrenMap = new Map();
  for (const entityCode of allEntityCodes) {
    const enrichedChildren = await entityCodeCache.getEnrichedChildren(entityCode.code);
    enrichedChildrenMap.set(entityCode.code, enrichedChildren);
  }
  // Each entry: [{ entity: "task", ui_label: "Task", ui_icon: "check-square", order: 0 }, ...]

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 4: Get role permissions (consider caching if frequently accessed)
  // ═══════════════════════════════════════════════════════════════════════
  // For now, DB query since permissions change frequently
  const permissions = await db.execute(sql`
    SELECT er.*, ei.entity_instance_name
    FROM app.entity_rbac er
    LEFT JOIN app.entity_instance ei ON ...
    WHERE er.role_id = ${roleId}::uuid
  `);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 5: Build response using cached data
  // ═══════════════════════════════════════════════════════════════════════
  const entities = allEntityCodes.map(et => ({
    entity_code: et.code,
    entity_label: et.ui_label || et.name,
    entity_icon: et.ui_icon,
    child_entity_codes: enrichedChildrenMap.get(et.code) || [],
    permissions: permissions
      .filter(p => p.entity_code === et.code)
      .map(p => ({
        ...p,
        permission_label: PERMISSION_LABELS[p.permission],
      })),
  }));

  return { role_id: roleId, entities: entities.filter(e => e.permissions.length > 0) };
}
```

**EntityCodeCacheAdapter Implementation:**
```typescript
// apps/api/src/lib/cache/adapters/entity-code-adapter.ts

import { ENTITY_CODE_KEYS } from '../keys';

export class EntityCodeCacheAdapter implements CacheAdapter<EntityCode> {
  readonly namespace = 'entity_code';

  constructor(private engine: CacheEngine, private db: Database) {}

  // ═══════════════════════════════════════════════════════════════════════
  // GET ALL ENTITY CODES
  // ═══════════════════════════════════════════════════════════════════════
  async getAll(): Promise<EntityCode[]> {
    const key = ENTITY_CODE_KEYS.all.build({});
    const cached = await this.engine.get<EntityCode[]>(key);
    if (cached) return cached.value;

    // Cache miss - fetch from DB
    const result = await this.db.execute(sql`
      SELECT code, name, ui_label, ui_icon, child_entity_codes, display_order
      FROM app.entity
      WHERE active_flag = true
      ORDER BY display_order, name
    `);

    const entityCodes = result as EntityCode[];
    await this.engine.set(key, entityCodes, {
      ttl: ENTITY_CODE_KEYS.all.defaultTtl,
      tags: ['entity_code:all'],
    });

    // Also populate the lookup hash for efficient code → ui_label mapping
    await this.populateLookup(entityCodes);

    return entityCodes;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GET LOOKUP HASH: code → ui_label
  // ═══════════════════════════════════════════════════════════════════════
  async getLookup(): Promise<Record<string, string>> {
    const key = ENTITY_CODE_KEYS.lookup.build({});
    const cached = await this.engine.hgetall(key);
    if (Object.keys(cached).length > 0) return cached;

    // Cache miss - populate from getAll()
    const entityCodes = await this.getAll();
    return entityCodes.reduce((acc, et) => {
      acc[et.code] = et.ui_label || et.name;
      return acc;
    }, {} as Record<string, string>);
  }

  private async populateLookup(entityCodes: EntityCode[]): Promise<void> {
    const key = ENTITY_CODE_KEYS.lookup.build({});
    const hash: Record<string, string> = {};
    for (const et of entityCodes) {
      hash[et.code] = et.ui_label || et.name;
    }
    await this.engine.hset(key, hash);
    await this.engine.expire(key, ENTITY_CODE_KEYS.lookup.defaultTtl);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GET ENRICHED CHILDREN (child_entity_codes transformed)
  // ═══════════════════════════════════════════════════════════════════════
  async getEnrichedChildren(entityCode: string): Promise<EnrichedChildEntity[]> {
    const key = ENTITY_CODE_KEYS.children.build({ entityCode });
    const cached = await this.engine.get<EnrichedChildEntity[]>(key);
    if (cached) return cached.value;

    // Cache miss - need to compute
    const entity = await this.getSingle(entityCode);
    if (!entity || !entity.child_entity_codes) return [];

    const lookup = await this.getLookup();
    const enriched = entity.child_entity_codes.map((code: string, index: number) => ({
      entity: code,
      ui_label: lookup[code] || code,
      ui_icon: null, // Would need full entity record for icon
      order: index,
    }));

    await this.engine.set(key, enriched, {
      ttl: ENTITY_CODE_KEYS.children.defaultTtl,
      tags: [`entity_code:${entityCode}`],
    });

    return enriched;
  }

  async getSingle(entityCode: string): Promise<EntityCode | null> {
    const key = ENTITY_CODE_KEYS.single.build({ entityCode });
    const cached = await this.engine.get<EntityCode>(key);
    if (cached) return cached.value;

    const result = await this.db.execute(sql`
      SELECT code, name, ui_label, ui_icon, child_entity_codes
      FROM app.entity
      WHERE code = ${entityCode} AND active_flag = true
    `);

    if (result.length === 0) return null;

    const entity = result[0] as EntityCode;
    await this.engine.set(key, entity, {
      ttl: ENTITY_CODE_KEYS.single.defaultTtl,
      tags: [`entity_code:${entityCode}`],
    });

    return entity;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INVALIDATION
  // ═══════════════════════════════════════════════════════════════════════
  async invalidateAll(): Promise<void> {
    await this.engine.invalidateByTag('entity_code:all');
  }

  async invalidateEntityCode(entityCode: string): Promise<void> {
    await Promise.all([
      this.engine.del(ENTITY_CODE_KEYS.single.build({ entityCode })),
      this.engine.del(ENTITY_CODE_KEYS.children.build({ entityCode })),
      // Also invalidate "all" since it contains this entity
      this.engine.del(ENTITY_CODE_KEYS.all.build({})),
      this.engine.del(ENTITY_CODE_KEYS.lookup.build({})),
    ]);
  }

  async clearAll(): Promise<void> {
    await this.engine.delByPattern('v1:entity_code:*');
  }
}
```

**Cache Flow Diagram:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│            HIERARCHICAL PERMISSIONS CACHE FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Request: GET /api/v1/entity_rbac/role/:roleId/hierarchical-permissions     │
│                                                                              │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐        │
│  │ v1:entity_code: │ ──▶ │ v1:entity_code: │ ──▶ │ v1:entity_code: │        │
│  │      all        │     │     lookup      │     │ {code}:children │        │
│  │                 │     │                 │     │                 │        │
│  │ [EntityCode...] │     │ HASH {code →    │     │ [EnrichedChild] │        │
│  │                 │     │   ui_label}     │     │                 │        │
│  └────────┬────────┘     └────────┬────────┘     └────────┬────────┘        │
│           │                       │                       │                  │
│           │    ┌──────────────────┴───────────────────────┘                  │
│           │    │                                                             │
│           ▼    ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │                    Response Assembly                             │        │
│  │                                                                  │        │
│  │  {                                                               │        │
│  │    role_id: "...",                                               │        │
│  │    entities: [{                                                  │        │
│  │      entity_code: "project",                                     │        │
│  │      entity_label: "Project",  ◀── from lookup                  │        │
│  │      child_entity_codes: [     ◀── from :children cache         │        │
│  │        { entity: "task", ui_label: "Task", ... },               │        │
│  │        { entity: "document", ui_label: "Document", ... }        │        │
│  │      ],                                                          │        │
│  │      permissions: [...]  ◀── from DB (dynamic)                  │        │
│  │    }]                                                            │        │
│  │  }                                                               │        │
│  └─────────────────────────────────────────────────────────────────┘        │
│                                                                              │
│  Performance Improvement:                                                    │
│  ─────────────────────────                                                   │
│  Before: 2 DB queries + O(n) Map construction per request                   │
│  After:  0-1 DB queries (cache hit) + O(1) hash lookup                      │
│  TTL: 1 hour (entity types rarely change)                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

| Component | Responsibility |
|-----------|----------------|
| **CacheEngine** | Low-level Redis operations, connection management |
| **KeyBuilder** | Type-safe key generation with versioning |
| **Strategies** | HOW to cache (aside, write-through, SWR) |
| **Adapters** | WHAT to cache (RBAC, Entity, Session) |
| **Invalidation** | WHEN to invalidate (events, triggers) |
| **Observability** | Metrics, circuit breaker, logging |

### Benefits

- **Plug-and-Play**: Add new domains by creating adapters
- **Composable**: Mix strategies for different use cases
- **Observable**: Built-in metrics and circuit breaker
- **Type-Safe**: Compile-time key validation
- **Versioned**: Schema migrations without cache corruption
- **Resilient**: Graceful degradation on Redis failure

---

## 10. RBAC Query Performance Optimization (v2.1.0)

### 10.1 The Problem: Large `IN` Clauses

The `get_entity_rbac_where_condition()` method returns accessible entity IDs for data gating. With large permission sets:

```sql
-- SLOW: PostgreSQL struggles with large IN lists
SELECT * FROM app.project e
WHERE e.id IN ('uuid1', 'uuid2', ..., 'uuid100000')  -- 100K literals!
```

**Issues with large `IN` clauses:**
| Issue | Impact |
|-------|--------|
| Query parsing | ~500ms to parse 100K literals |
| Memory consumption | Large AST in planner |
| Poor plan quality | Optimizer gives up with too many OR conditions |
| Network overhead | Huge SQL strings sent to database |

### 10.2 Solution 1: `ANY(ARRAY[...])` Pattern (Implemented v2.1.0)

PostgreSQL handles arrays much more efficiently than IN lists:

```sql
-- FAST: PostgreSQL optimizes array containment
SELECT * FROM app.project e
WHERE e.id = ANY(ARRAY['uuid1', 'uuid2', ..., 'uuid100000']::uuid[])
```

**Implementation in `entity-infrastructure.service.ts`:**
```typescript
// OLD (slow)
return sql`${sql.raw(table_alias)}.id IN (${sql.join(accessibleIds.map(id => sql`${id}`), sql`, `)})`;

// NEW (fast) - v2.1.0
const uuidArrayLiteral = `ARRAY[${accessibleIds.map(id => `'${id}'`).join(',')}]::uuid[]`;
return sql.raw(`${table_alias}.id = ANY(${uuidArrayLiteral})`);
```

**Performance improvement:**
| Metric | `IN (...)` | `ANY(ARRAY[...])` | Improvement |
|--------|------------|-------------------|-------------|
| Parse time (100K IDs) | ~500ms | ~50ms | 10x faster |
| Planner memory | High | Low | Significant |
| Plan quality | Degrades | Stable | Better execution |

### 10.3 Solution 2: Temporary Table Pattern (For 100K+ IDs)

For extremely large ID sets (>100K), even arrays can be slow. Use a temporary table:

```sql
-- Create temp table with accessible IDs
CREATE TEMP TABLE accessible_ids (id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO accessible_ids SELECT unnest(ARRAY[...]);

-- Join instead of IN
SELECT e.* FROM app.project e
JOIN accessible_ids a ON e.id = a.id;
```

**Implementation:**
```typescript
async get_entity_rbac_where_condition_optimized(
  user_id: string,
  entity_code: string,
  required_permission: Permission,
  table_alias: string = 'e'
): Promise<{ condition: SQL; setupQuery?: string; teardownQuery?: string }> {
  const accessibleIds = await this.getAccessibleEntityIds(user_id, entity_code, required_permission);

  // No access
  if (accessibleIds.length === 0) {
    return { condition: sql.raw('FALSE') };
  }

  // Type-level access
  if (accessibleIds.includes(ALL_ENTITIES_ID)) {
    return { condition: sql.raw('TRUE') };
  }

  // Small sets (<10K): Use ANY(ARRAY[...])
  if (accessibleIds.length < 10000) {
    const uuidArrayLiteral = `ARRAY[${accessibleIds.map(id => `'${id}'`).join(',')}]::uuid[]`;
    return { condition: sql.raw(`${table_alias}.id = ANY(${uuidArrayLiteral})`) };
  }

  // Large sets (>=10K): Use temp table
  const tempTableName = `temp_rbac_${Date.now()}`;
  return {
    setupQuery: `
      CREATE TEMP TABLE ${tempTableName} (id uuid PRIMARY KEY) ON COMMIT DROP;
      INSERT INTO ${tempTableName} SELECT unnest(ARRAY[${accessibleIds.map(id => `'${id}'`).join(',')}]::uuid[]);
    `,
    condition: sql.raw(`${table_alias}.id IN (SELECT id FROM ${tempTableName})`),
    teardownQuery: `DROP TABLE IF EXISTS ${tempTableName};`
  };
}
```

### 10.4 Solution 3: Materialized View Pattern (For Very Frequent Access)

If RBAC permission sets are queried very frequently, pre-compute accessible IDs:

```sql
-- Materialized view: person × entity_code → accessible IDs
CREATE MATERIALIZED VIEW mv_person_accessible_entities AS
SELECT
  p.id AS person_id,
  e.entity_code,
  array_agg(DISTINCT e.entity_instance_id) AS accessible_ids
FROM person_roles pr
JOIN app.entity_rbac e ON e.role_id = pr.role_id
WHERE e.is_deny = false
GROUP BY p.id, e.entity_code;

-- Index for fast lookup
CREATE INDEX idx_mv_person_entity ON mv_person_accessible_entities(person_id, entity_code);

-- Refresh periodically or on permission change
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_person_accessible_entities;
```

**Trade-offs:**
| Approach | Latency | Freshness | Complexity |
|----------|---------|-----------|------------|
| `ANY(ARRAY[...])` | ~50ms | Real-time | Low |
| Temp table | ~30ms | Real-time | Medium |
| Materialized view | ~5ms | Stale (refresh interval) | High |

### 10.5 Solution 4: Cache Accessible IDs in Redis

Cache the accessible ID list per user/entity_code/permission in Redis:

```typescript
// Key: v1:entity_rbac:accessible:{personId}:{entityCode}:{permission}
// Value: SET of UUIDs
// TTL: 60 seconds (short for permission freshness)

async getAccessibleEntityIdsCached(
  person_id: string,
  entity_code: string,
  required_permission: Permission
): Promise<string[]> {
  const key = `v1:entity_rbac:accessible:${person_id}:${entity_code}:${required_permission}`;

  // Try cache
  const cached = await this.redis.smembers(key);
  if (cached.length > 0) {
    return cached;
  }

  // Cache miss - compute and store
  const ids = await this.getAccessibleEntityIds(person_id, entity_code, required_permission);

  if (ids.length > 0) {
    await this.redis.sadd(key, ...ids);
    await this.redis.expire(key, 60); // 60 second TTL
  }

  return ids;
}
```

**Invalidation triggers:**
- Permission granted/revoked → Invalidate affected person's cache
- Role membership changed → Invalidate person's cache
- Entity hierarchy changed → Invalidate all caches for entity_code

### 10.6 Recommendation Matrix

| Scenario | Recommended Solution |
|----------|---------------------|
| <1K IDs | `ANY(ARRAY[...])` (default) |
| 1K-100K IDs | `ANY(ARRAY[...])` + Redis cache |
| 100K+ IDs | Temp table or materialized view |
| Real-time permissions critical | `ANY(ARRAY[...])` without cache |
| Read-heavy, stale OK | Materialized view |

---

**Version**: 1.0.0 | **Updated**: 2025-12-10
