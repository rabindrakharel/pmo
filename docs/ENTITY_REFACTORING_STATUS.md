# Entity Routes Refactoring Status

**Last Updated:** 2025-01-17 (Phase 6: Documentation Cleanup Complete)
**Purpose:** Track implementation of standard architecture patterns across all entity routes

## Standard Pattern Requirements

All entity routes should follow these 4 architectural patterns:

1. **Entity Infrastructure Service** (`getEntityInfrastructure`) - Centralized RBAC and infrastructure operations
2. **Universal Auto-Filter** (`buildAutoFilters`) - Zero-config query filtering
3. **Delete Factory** (`createEntityDeleteEndpoint`) - Cascading soft deletes for entities
4. **Child Entity Factory** (`createChildEntityEndpointsFromMetadata`) - Auto-generate parent-child endpoints

## Refactoring Status

### ✅ FULLY COMPLIANT (4 entities)

| Entity | Infra | Filter | Delete | Child | Notes |
|--------|-------|--------|--------|-------|-------|
| **form** | ✓ | ✓ | ✓ | ✓ | Complete |
| **worksite** | ✓ | ✓ | ✓ | ✓ | Complete |
| **work_order** | ✓ | ✓ | ✓ | ✓ | Complete (Phase 4) |
| **quote** | ✓ | ✓ | ✓ | ✓ | Complete (Phase 5) |

### ✅ FACT TABLES - COMPLIANT (3 entities)

| Entity | Infra | Filter | Delete | Child | Notes |
|--------|-------|--------|--------|-------|-------|
| **invoice** | ✓ | ✓ | Hard | N/A | f_invoice - Hard delete appropriate for fact tables |
| **order** | ✓ | ✓ | Hard | N/A | f_order - Hard delete appropriate for fact tables |
| **shipment** | ✓ | ✓ | Hard | N/A | f_shipment - Hard delete appropriate for fact tables |

**Note:** Fact tables (f_*) use hard deletes and don't typically have child entity relationships, so delete factory and child factory patterns don't apply.

### ⚠️ MISSING 1 PATTERN (3 entities)

| Entity | Infra | Filter | Delete | Child | Missing | Priority |
|--------|-------|--------|--------|-------|---------|----------|
| **expense** | ✓ | ✓ | ✓ | ✗ | Child factory | Low |
| **revenue** | ✓ | ✓ | ✓ | ✗ | Child factory | Low |
| **wiki** | ✓ | ✓ | ✓ | ✗ | Child factory | Low |

### ⚠️ MISSING 2 PATTERNS (2 entities)

| Entity | Infra | Filter | Delete | Child | Missing | Priority |
|--------|-------|--------|--------|-------|---------|----------|
| **product** | ✗ | ✗ | ✓ | ✗ | Infra + Filter | Medium |
| **service** | ✗ | ✗ | ✓ | ✗ | Infra + Filter | Medium |

### ⚠️ MISSING 3 PATTERNS (1 entity)

| Entity | Infra | Filter | Delete | Child | Missing | Priority |
|--------|-------|--------|--------|-------|---------|----------|
| **event** | ✓ | ✗ | ✗ | ✗ | Filter + Delete + Child | High |

### ❌ PURGED ENTITIES

| Entity | Reason | Date |
|--------|--------|------|
| **booking** | Disconnected from person-calendar system; incomplete implementation; no DDL files | 2025-01-17 |

**Note:** The booking entity (d_booking) was removed from the codebase as it was NOT serving the person event calendar system. The person calendar system has its own unified service at `/api/v1/person-calendar` with complete orchestration.

## Refactoring Changes Made

### Phase 1: Fact Tables (Completed)

#### 1. invoice/routes.ts
- ✅ Added `getEntityInfrastructure` import and initialization
- ✅ Added `buildAutoFilters` for universal filtering
- ✅ Added module constants (ENTITY_TYPE, TABLE_ALIAS)
- ✅ Refactored LIST endpoint to use auto-filters
- ✅ Added userId authentication checks to all endpoints
- ✅ Improved UPDATE with SQL builder pattern
- ✅ Added comments for optional RBAC (fact tables may not have permissions)
- ✅ Kept hard DELETE (appropriate for fact tables)

#### 2. order/routes.ts
- ✅ Added `getEntityInfrastructure` import and initialization
- ✅ Added `buildAutoFilters` for universal filtering
- ✅ Added module constants (ENTITY_TYPE, TABLE_ALIAS)
- ✅ Refactored LIST endpoint with auto-filters and search support
- ✅ Added userId authentication checks
- ✅ Improved UPDATE with SQL builder pattern
- ✅ Kept hard DELETE (appropriate for fact tables)

#### 3. shipment/routes.ts
- ✅ Added `getEntityInfrastructure` import and initialization
- ✅ Added `buildAutoFilters` for universal filtering
- ✅ Added module constants (ENTITY_TYPE, TABLE_ALIAS)
- ✅ Refactored LIST endpoint with auto-filters and search support
- ✅ Added userId authentication checks
- ✅ Improved UPDATE with SQL builder pattern
- ✅ Kept hard DELETE (appropriate for fact tables)

### Phase 2: Quick Wins (Completed)

#### 4. worksite/routes.ts
- ✅ Added `getEntityInfrastructure` import and initialization
- ✅ Already had buildAutoFilters, delete factory, and child factory

#### 5. form/routes.ts
- ✅ Added `buildAutoFilters` import
- ✅ Already had infrastructure service, delete factory, and child factory

### Phase 3: Booking Entity Purge (Completed)

#### booking entity - COMPLETE REMOVAL
- ❌ **Deleted entire module:** `apps/api/src/modules/booking/`
  - Removed `routes.ts` (all CRUD endpoints)
  - Removed `types.ts` (BookingRequest, BookingResponse interfaces)
- ✅ **Backend cleanup:**
  - Updated `schema-builder.service.ts` - removed 'booking' from entity reference regex
  - Updated `chat/types.ts` - removed booking fields from ChatSession and ChatMessageResponse
  - Updated `chat/openai.service.ts` - removed 3 booking functions and system prompt references
  - Updated `chat/functions.service.ts` - removed createBooking, getBookingInfo, cancelBooking (213 lines)
  - Updated `chat/conversation.service.ts` - removed booking metadata tracking
  - Updated `chat/routes.ts` - removed booking_created from responses
  - Updated `message-data/types.ts` - removed booking_id from MessageMetadata
  - Updated `chat/orchestrator/agent_config.json` - removed booking entity expansion rule
- ✅ **Frontend cleanup:**
  - Updated `web/src/lib/api.ts` - removed booking API registration
  - Updated `web/src/components/chat/ChatWidget.tsx` - removed booking confirmation handling
- ℹ️ **Rationale:** booking entity was disconnected from person-calendar system (separate systems)

**Total removed:** ~963 lines of code (12 files modified, 2 files deleted)

### Phase 4: work_order Routes Refactoring (Completed)

#### work_order/routes.ts - Added infra + filter patterns
- ✅ Added imports: `unified_data_gate`, `getEntityInfrastructure`, `buildAutoFilters`, `SQL` type, `createChildEntityEndpointsFromMetadata`
- ✅ Added module constants: `ENTITY_TYPE = 'work_order'`, `TABLE_ALIAS = 'w'`
- ✅ Initialized Entity Infrastructure Service
- ✅ **Refactored LIST endpoint:**
  - Replaced manual RBAC SQL (~9 lines) with `unified_data_gate.rbac_gate.getWhereCondition()`
  - Replaced manual filters (~16 lines) with `buildAutoFilters()` with search fields: name, descr, code, customer_name
  - Code reduction: ~25 lines → 5 lines
- ✅ **Refactored GET single endpoint:**
  - Replaced manual RBAC SQL (~9 lines) with `entityInfra.check_entity_rbac()`
  - Code reduction: ~9 lines → 2 lines
- ✅ **Refactored CREATE endpoint:**
  - Replaced manual RBAC check (~9 lines) with `entityInfra.check_entity_rbac()`
  - Kept existing entity_instance_registry logic
  - Code reduction: ~9 lines → 2 lines
- ✅ **Refactored UPDATE endpoint:**
  - Replaced manual RBAC SQL (~9 lines) with `entityInfra.check_entity_rbac()`
  - Code reduction: ~9 lines → 2 lines
- ✅ Updated delete factory call to use `ENTITY_TYPE` constant
- ✅ Added child entity factory: `createChildEntityEndpointsFromMetadata(fastify, ENTITY_TYPE)`

**Total code reduction:** ~52 lines of manual RBAC/filter logic → 11 service calls

### Phase 5: quote Routes Refactoring (Completed)

#### quote/routes.ts - Added infra + filter patterns
- ✅ Added imports: `unified_data_gate`, `getEntityInfrastructure`, `buildAutoFilters`, `SQL` type
- ✅ Added module constants: `ENTITY_TYPE = 'quote'`, `TABLE_ALIAS = 'q'`
- ✅ Initialized Entity Infrastructure Service
- ✅ **Refactored LIST endpoint:**
  - Replaced manual RBAC SQL (~9 lines) with `unified_data_gate.rbac_gate.getWhereCondition()`
  - Replaced manual filters (~16 lines) with `buildAutoFilters()` with search fields: name, descr, code, customer_name
  - Code reduction: ~25 lines → 5 lines
- ✅ **Refactored GET single endpoint:**
  - Replaced manual RBAC SQL (~9 lines) with `entityInfra.check_entity_rbac()`
  - Code reduction: ~9 lines → 2 lines
- ✅ **Refactored CREATE endpoint:**
  - Replaced manual RBAC check (~9 lines) with `entityInfra.check_entity_rbac()`
  - Kept existing entity_instance_registry logic
  - Code reduction: ~9 lines → 2 lines
- ✅ **Refactored UPDATE endpoint:**
  - Replaced manual RBAC SQL (~9 lines) with `entityInfra.check_entity_rbac()`
  - Code reduction: ~9 lines → 2 lines
- ✅ Updated delete factory call to use `ENTITY_TYPE` constant
- ✅ Child entity factory already present - updated to use `ENTITY_TYPE` constant

**Total code reduction:** ~52 lines of manual RBAC/filter logic → 11 service calls

### Phase 6: Documentation Cleanup (Completed)

#### Purged Obsolete Files (9 files removed from project root)
- ❌ Deleted `CODE_CLEANUP_RECOMMENDATIONS.md`
- ❌ Deleted `CODE_CLEANUP_SUMMARY.md`
- ❌ Deleted `DOCUMENTATION_UPDATE_SUMMARY.md`
- ❌ Deleted `MIGRATION_COMPLETE_SUMMARY.md`
- ❌ Deleted `RBAC_2GATE_IMPLEMENTATION_GUIDE.md`
- ❌ Deleted `RBAC_CRUD_FACTORY_SUMMARY.md`
- ❌ Deleted `RBAC_DDL_FIX_SUMMARY.md`
- ❌ Deleted `RBAC_ENTITY_PICKER_IMPLEMENTATION.md`
- ❌ Deleted `RBAC_IMPLEMENTATION_COMPLETE.md`

**Rationale:** These were temporary implementation guides/summaries that are now superseded by permanent service documentation.

#### Updated README.md Documentation Index
- ✅ **Updated Data Model section:** Fixed path to `./docs/datamodel/README.md`
- ✅ **Added Core Services & Libraries section:**
  - Entity Infrastructure Service (`./docs/services/ENTITY_INFRASTRUCTURE_SERVICE.md`)
  - Universal Formatter Service (`./docs/services/UNIVERSAL_FORMATTER_SERVICE.md`)
  - Services Catalog (`./docs/services/README.md`)
- ✅ **Enhanced Frontend Components section:**
  - Entity Data Table (`./docs/ui_components/datatable.md`)
  - DAG Visualizer (`./docs/ui_components/dag_vizualizer.md`)
  - Kanban Board (`./docs/ui_components/kanban.md`)
  - Dynamic Forms (`./docs/form/form.md`)

**Result:** README now serves as comprehensive documentation index pointing to all core services, components, and data model documentation.

## Next Steps (Future PRs)

### High Priority
1. **event/routes.ts** - Add filter, delete, and child factories

### Medium Priority
2. **product/routes.ts** - Add infra service and filters
3. **service/routes.ts** - Add infra service and filters
4. **work_order/routes.ts** - Add infra service and filters
5. **quote/routes.ts** - Add infra service and filters

### Low Priority (Optional)
6. **expense/routes.ts** - Add child factory (if child entities exist in d_entity)
7. **revenue/routes.ts** - Add child factory (if child entities exist in d_entity)
8. **wiki/routes.ts** - Add child factory (if child entities exist in d_entity)

## Standard Pattern Reference

### Required Imports
```typescript
import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql, SQL } from 'drizzle-orm';

// ✅ Centralized unified data gate - loosely coupled API
import { unified_data_gate, Permission, ALL_ENTITIES_ID } from '../../lib/unified-data-gate.js';

// ✨ Entity Infrastructure Service - centralized infrastructure operations
import { getEntityInfrastructure } from '../../services/entity-infrastructure.service.js';

// ✨ Universal auto-filter builder - zero-config query filtering
import { buildAutoFilters } from '../../lib/universal-filter-builder.js';

// ✅ Delete factory for cascading soft deletes
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';

// ✅ Child entity factory for parent-child relationships
import { createChildEntityEndpointsFromMetadata } from '../../lib/child-entity-route-factory.js';
```

### Module Constants
```typescript
const ENTITY_TYPE = 'entity_name';
const TABLE_ALIAS = 'e';
```

### Entity Infrastructure Initialization
```typescript
export async function entityRoutes(fastify: FastifyInstance) {
  // ✨ Initialize Entity Infrastructure Service
  const entityInfra = getEntityInfrastructure(db);

  // ... routes
}
```

### LIST Endpoint Pattern
```typescript
// Build WHERE conditions array
const conditions: SQL[] = [];

// ✨ UNIVERSAL AUTO-FILTER SYSTEM
const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query as any, {
  searchFields: ['name', 'code', 'description']
});
conditions.push(...autoFilters);
```

### Factory Endpoints (at end of file)
```typescript
// ✨ Factory-generated DELETE endpoint
createEntityDeleteEndpoint(fastify, ENTITY_TYPE);

// ✨ Factory-generated child entity endpoints
await createChildEntityEndpointsFromMetadata(fastify, ENTITY_TYPE);
```

## Summary Statistics

- **Total Entities**: 12 (1 purged: booking)
- **Fully Compliant**: 7 (58%) ⬆️ +2 from Phase 4-5
- **Missing 1 Pattern**: 3 (25%)
- **Missing 2 Patterns**: 2 (17%) ⬇️ -2 from Phase 4-5
- **Missing 3 Patterns**: 1 (8%)
- **Purged**: 1 (booking - disconnected entity)

**Phase 1-6 Completion**: 7/12 entities (58%) now follow standard patterns ⬆️ +16% from Phase 3
**Code Reduction:**
- Phase 1-3: ~963 lines removed (booking purge)
- Phase 4: ~52 lines of manual RBAC/filter logic → 11 service calls (work_order)
- Phase 5: ~52 lines of manual RBAC/filter logic → 11 service calls (quote)
- Phase 6: 9 obsolete documentation files purged
- **Total:** ~1,067 lines removed + improved documentation structure
