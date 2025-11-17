# Entity Routes Refactoring Status

**Last Updated:** 2025-01-17 (Phase 3: Booking Purge)
**Purpose:** Track implementation of standard architecture patterns across all entity routes

## Standard Pattern Requirements

All entity routes should follow these 4 architectural patterns:

1. **Entity Infrastructure Service** (`getEntityInfrastructure`) - Centralized RBAC and infrastructure operations
2. **Universal Auto-Filter** (`buildAutoFilters`) - Zero-config query filtering
3. **Delete Factory** (`createEntityDeleteEndpoint`) - Cascading soft deletes for entities
4. **Child Entity Factory** (`createChildEntityEndpointsFromMetadata`) - Auto-generate parent-child endpoints

## Refactoring Status

### ✅ FULLY COMPLIANT (2 entities)

| Entity | Infra | Filter | Delete | Child | Notes |
|--------|-------|--------|--------|-------|-------|
| **form** | ✓ | ✓ | ✓ | ✓ | Complete |
| **worksite** | ✓ | ✓ | ✓ | ✓ | Complete |

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

### ⚠️ MISSING 2 PATTERNS (4 entities)

| Entity | Infra | Filter | Delete | Child | Missing | Priority |
|--------|-------|--------|--------|-------|---------|----------|
| **product** | ✗ | ✗ | ✓ | ✗ | Infra + Filter | Medium |
| **service** | ✗ | ✗ | ✓ | ✗ | Infra + Filter | Medium |
| **work_order** | ✗ | ✗ | ✓ | ✗ | Infra + Filter | Medium |
| **quote** | ✗ | ✗ | ✓ | ✓ | Infra + Filter | Medium |

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
- **Fully Compliant**: 5 (42%)
- **Missing 1 Pattern**: 3 (25%)
- **Missing 2 Patterns**: 4 (33%)
- **Missing 3 Patterns**: 1 (8%)
- **Purged**: 1 (booking - disconnected entity)

**Phase 1-3 Completion**: 5/12 entities (42%) now follow standard patterns
**Code Cleanup**: 963 lines removed (booking purge)
