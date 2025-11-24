# Pagination Configuration

> Centralized pagination settings for the PMO Enterprise Platform (v8.1.0)

## Overview

Pagination is centrally configured to ensure consistent behavior across the entire platform. Both backend (API) and frontend share the same configuration values, making it easy to adjust limits for specific entities or use cases.

## Configuration Files

| Location | Purpose |
|----------|---------|
| `apps/api/src/lib/pagination.ts` | Backend pagination config (source of truth) |
| `apps/web/src/lib/pagination.config.ts` | Frontend pagination config (mirrors backend) |

## Configuration Options

### PAGINATION_CONFIG Object

```typescript
export const PAGINATION_CONFIG = {
  // Standard defaults
  DEFAULT_PAGE: 1,              // Default page number
  DEFAULT_PAGE_SIZE: 20,        // Standard pagination (UI tables)
  DEFAULT_LIMIT: 20000,         // Bulk data loading (format-at-read)
  MAX_LIMIT: 100000,            // Maximum allowed per request
  MIN_LIMIT: 1,                 // Minimum allowed

  // Context-specific defaults
  CHILD_ENTITY_LIMIT: 100,      // Child entity lists (e.g., project tasks)
  DROPDOWN_LIMIT: 1000,         // Select/dropdown options
  SETTINGS_LIMIT: 500,          // Datalabel/settings lists

  // Entity-specific overrides
  ENTITY_LIMITS: {
    project: 3000,
    task: 20000,
    employee: 5000,
    client: 5000,
    // Add more as needed
  },
} as const;
```

## Adding Entity-Specific Limits

To configure a custom limit for an entity:

### 1. Update Backend Config

Edit `apps/api/src/lib/pagination.ts`:

```typescript
ENTITY_LIMITS: {
  project: 3000,
  task: 20000,
  employee: 5000,
  client: 5000,
  // Add your entity here:
  invoice: 2000,
  artifact: 500,
},
```

### 2. Update Frontend Config

Edit `apps/web/src/lib/pagination.config.ts` with the same values:

```typescript
ENTITY_LIMITS: {
  project: 3000,
  task: 20000,
  employee: 5000,
  client: 5000,
  // Add your entity here:
  invoice: 2000,
  artifact: 500,
},
```

## Usage in Code

### Backend (API Routes)

```typescript
import { PAGINATION_CONFIG, getEntityLimit } from '@/lib/pagination.js';

// Get entity-specific limit (falls back to DEFAULT_LIMIT)
const limit = getEntityLimit('project');  // Returns 3000

// Use in route handler
fastify.get('/api/v1/project', async (request, reply) => {
  const { limit = getEntityLimit(ENTITY_CODE) } = request.query;
  // ...
});

// Use context-specific limits
const childLimit = PAGINATION_CONFIG.CHILD_ENTITY_LIMIT;  // 100
const dropdownLimit = PAGINATION_CONFIG.DROPDOWN_LIMIT;   // 1000
```

### Frontend (React Hooks)

```typescript
import { PAGINATION_CONFIG, getEntityLimit } from '@/lib/pagination.config';

// Get entity-specific limit
const limit = getEntityLimit('project');  // Returns 3000

// Use in hooks
const { data } = useEntityInstanceList('project', {
  pageSize: getEntityLimit('project'),
});

// Use context-specific limits
const childLimit = PAGINATION_CONFIG.CHILD_ENTITY_LIMIT;  // 100
```

## Helper Function

### getEntityLimit(entityCode: string): number

Returns the configured limit for a specific entity type, falling back to `DEFAULT_LIMIT` if not configured.

```typescript
getEntityLimit('project');   // Returns 3000 (configured)
getEntityLimit('wiki');      // Returns 20000 (DEFAULT_LIMIT fallback)
getEntityLimit('task');      // Returns 20000 (configured)
```

## Current Entity Limits

| Entity | Limit | Rationale |
|--------|-------|-----------|
| `project` | 3,000 | Moderate dataset, quick load times |
| `task` | 20,000 | Large datasets, kanban views |
| `employee` | 5,000 | Medium dataset, dropdown performance |
| `client` | 5,000 | Medium dataset, search optimization |
| *(others)* | 20,000 | Default for bulk format-at-read |

## Context-Specific Limits

| Context | Config Key | Value | Use Case |
|---------|------------|-------|----------|
| Child entities | `CHILD_ENTITY_LIMIT` | 100 | Project tasks, wiki articles |
| Dropdowns | `DROPDOWN_LIMIT` | 1,000 | Select inputs, autocomplete |
| Settings | `SETTINGS_LIMIT` | 500 | Datalabel options |
| Standard pages | `DEFAULT_PAGE_SIZE` | 20 | Paginated UI tables |
| Bulk loading | `DEFAULT_LIMIT` | 20,000 | Format-at-read pattern |

## Best Practices

1. **Keep configs in sync**: Always update both backend and frontend configs together
2. **Consider performance**: Lower limits for complex entities with many joins
3. **Test with real data**: Verify limits work well with production-scale data
4. **Document changes**: Add rationale when setting entity-specific limits

## API Query Parameters

All list endpoints accept pagination parameters:

```bash
# Standard pagination
GET /api/v1/project?page=1&limit=50

# Uses entity default if not specified
GET /api/v1/project  # Uses 3000 (project's configured limit)

# Override with specific limit
GET /api/v1/task?limit=100
```

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  Pagination Flow                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Frontend Request                                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ useEntityInstanceList('project', { pageSize: ... })  │   │
│  │                          ↓                            │   │
│  │ getEntityLimit('project') → 3000                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│  API Request: GET /api/v1/project?limit=3000                │
│                          ↓                                   │
│  Backend Route                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ const { limit = getEntityLimit('project') } = query  │   │
│  │ SELECT * FROM app.project LIMIT 3000                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v8.1.0 | 2024-11-24 | Centralized pagination config with entity-specific limits |
| v8.0.0 | 2024-11-23 | Format-at-read pattern with large default limits |

---

**Related Documentation**:
- [State Management](../state_management/STATE_MANAGEMENT.md)
- [API Design Patterns](../api/README.md)
