# Plan: Entity Reference Resolution via Unified Cache

**Status**: READY FOR IMPLEMENTATION
**Last Updated**: 2025-11-27
**Version**: 5.2.0 (Clean REST Routes)

---

## Backend API Routes

| Route | Method | Purpose | Returns |
|-------|--------|---------|---------|
| `/api/v1/entity/entity-instance` | GET | Bulk load ALL entity types | `{ employee: { uuid: name }, ... }` |
| `/api/v1/entity/:entityCode/entity-instance` | GET | All instances of ONE type | `{ data: [{ id, name }], total }` |
| `/api/v1/entity/:entityCode/entity-instance/:id` | GET | Single instance by UUID | `{ id, name }` |
| `/api/v1/entity/:entityCode/entity-instance/bulk` | POST | Multiple UUIDs lookup | `{ data: [{ id, name }] }` |

---

## Executive Summary

**Architecture**: React Query cache `ref_data_entityInstance` populated by `entity-instance` endpoints, with backend API responses upserting to this cache. Format-on-read happens AFTER cache upsert. All lookups and dropdowns consume from this unified cache.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    UNIFIED CACHE ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   REACT QUERY CACHE: ref_data_entityInstance                                │
│   ══════════════════════════════════════════                                │
│   Structure: { [entityCode]: { [entityInstanceId]: entityInstanceName } }   │
│                                                                              │
│   Cache Key: ['ref_data_entityInstance', entityCode]                        │
│   Example:                                                                   │
│     ['ref_data_entityInstance', 'employee'] = {                             │
│       "uuid-123": "James Miller",                                           │
│       "uuid-456": "Sarah Johnson"                                           │
│     }                                                                        │
│                                                                              │
│   POPULATION SOURCES:                                                        │
│   ┌──────────────────┐    ┌──────────────────┐                              │
│   │  Backend API     │    │  entity-instance │                              │
│   │  Responses       │    │  API             │                              │
│   │  (ref_data)      │    │                  │                              │
│   └────────┬─────────┘    └────────┬─────────┘                              │
│            │                       │                                         │
│            ▼                       ▼                                         │
│   ┌────────────────────────────────────────────┐                            │
│   │       UPSERT to ref_data_entityInstance    │                            │
│   └────────────────────────────────────────────┘                            │
│            │                                                                 │
│            ▼                                                                 │
│   ┌────────────────────────────────────────────┐                            │
│   │  FORMAT-ON-READ uses cache to resolve UUIDs │                           │
│   └────────────────────────────────────────────┘                            │
│            │                                                                 │
│            ▼                                                                 │
│   ┌────────────────────────────────────────────┐                            │
│   │  DROPDOWNS read options from same cache    │                            │
│   └────────────────────────────────────────────┘                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Principles

1. **Cache Name**: `ref_data_entityInstance` (matches backend response field name)
2. **Upsert First**: Backend response upserts to cache BEFORE format-on-read
3. **Format Uses Cache**: `select` transformer reads from `ref_data_entityInstance` cache
4. **Dropdowns Use Cache**: Edit mode dropdowns populated from same cache
5. **Single Source of Truth**: One cache serves view mode AND edit mode

---

## Data Flow: Complete Sequence

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DATA FLOW: FETCH → UPSERT → FORMAT → RENDER              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 1: API FETCH                                                          │
│  ═════════════════                                                          │
│                                                                              │
│  GET /api/v1/project/proj-123                                               │
│                                                                              │
│  Backend Response:                                                           │
│  {                                                                           │
│    "data": {                                                                 │
│      "id": "proj-123",                                                       │
│      "name": "Kitchen Renovation",                                          │
│      "manager__employee_id": "uuid-james",        ← Raw UUID                │
│      "dl__project_stage": "planning"                                        │
│    },                                                                        │
│    "ref_data_entityInstance": {                   ← Backend provides this   │
│      "employee": {                                                           │
│        "uuid-james": "James Miller"                                         │
│      }                                                                       │
│    },                                                                        │
│    "metadata": {                                                             │
│      "entityListOfInstancesTable": {                                                    │
│        "viewType": {                                                         │
│          "manager__employee_id": {                                          │
│            "renderType": "entityInstanceId",                                │
│            "lookupEntity": "employee"                                       │
│          }                                                                   │
│        }                                                                     │
│      }                                                                       │
│    }                                                                         │
│  }                                                                           │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  STEP 2: UPSERT TO CACHE (queryFn callback)                                 │
│  ══════════════════════════════════════════                                 │
│                                                                              │
│  // Inside useEntityInstance queryFn:                                        │
│  const response = await apiClient.get(`/api/v1/${entityCode}/${id}`);       │
│                                                                              │
│  // UPSERT ref_data_entityInstance to cache FIRST                           │
│  if (response.data.ref_data_entityInstance) {                               │
│    for (const [refEntityCode, lookups] of Object.entries(                   │
│      response.data.ref_data_entityInstance                                  │
│    )) {                                                                      │
│      queryClient.setQueryData(                                              │
│        ['ref_data_entityInstance', refEntityCode],                          │
│        (old) => ({ ...old, ...lookups })                                    │
│      );                                                                      │
│    }                                                                         │
│  }                                                                           │
│                                                                              │
│  // Cache state after upsert:                                                │
│  ['ref_data_entityInstance', 'employee'] = {                                │
│    "uuid-james": "James Miller",                                            │
│    // ...other employees from previous fetches                               │
│  }                                                                           │
│                                                                              │
│  return response.data;  // Return raw data for caching                       │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  STEP 3: FORMAT-ON-READ (select transformer)                                │
│  ═══════════════════════════════════════════                                │
│                                                                              │
│  // useFormattedEntityInstance hook:                                         │
│  useQuery({                                                                  │
│    queryKey: ['entity-instance', entityCode, id],                           │
│    queryFn: async () => { ... },                                            │
│    select: (response) => {                                                  │
│      // Format-on-read: Transform raw data using cache                       │
│      return formatEntityData(response, queryClient);                        │
│    }                                                                         │
│  });                                                                         │
│                                                                              │
│  function formatEntityData(response, queryClient) {                         │
│    const { data, metadata } = response;                                     │
│    const formatted = { ...data };                                           │
│                                                                              │
│    // For each field, check if it's an entity reference                      │
│    for (const [fieldName, fieldMeta] of Object.entries(                     │
│      metadata?.entityListOfInstancesTable?.viewType || {}                              │
│    )) {                                                                      │
│      if (fieldMeta.renderType === 'entityInstanceId') {                     │
│        const entityCode = fieldMeta.lookupEntity;                           │
│        const uuid = data[fieldName];                                        │
│                                                                              │
│        // READ FROM CACHE                                                    │
│        const cache = queryClient.getQueryData(                              │
│          ['ref_data_entityInstance', entityCode]                            │
│        );                                                                    │
│        formatted[`${fieldName}_display`] = cache?.[uuid] || uuid;           │
│      }                                                                       │
│    }                                                                         │
│                                                                              │
│    return { ...response, formattedData: formatted };                        │
│  }                                                                           │
│                                                                              │
│  // Result:                                                                   │
│  formattedData = {                                                           │
│    id: "proj-123",                                                           │
│    manager__employee_id: "uuid-james",                                      │
│    manager__employee_id_display: "James Miller",  ← Resolved from cache     │
│    dl__project_stage: "planning"                                            │
│  }                                                                           │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  STEP 4: RENDER VIEW MODE                                                    │
│  ════════════════════════                                                    │
│                                                                              │
│  EntityInstanceFormContainer renders:                                                │
│                                                                              │
│  ┌─────────────────────────────────────────┐                                │
│  │ Manager: James Miller                   │  ← Uses _display field         │
│  │ Project Stage: [planning badge]         │                                │
│  └─────────────────────────────────────────┘                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Dropdown Generation (Edit Mode)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DROPDOWN GENERATION: EDIT MODE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  USER CLICKS "EDIT" BUTTON                                                  │
│  ═════════════════════════                                                  │
│                                                                              │
│  EntityInstanceFormContainer switches to edit mode                                   │
│  Renders EntityInstanceSelectDropdown for manager__employee_id field                 │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  DROPDOWN COMPONENT: EntityInstanceSelectDropdown                                   │
│  ════════════════════════════════════════                                   │
│                                                                              │
│  Props:                                                                      │
│    entityCode: "employee"        ← From metadata.lookupEntity               │
│    value: "uuid-james"           ← Current UUID                             │
│    onChange: (uuid, name) => {}  ← Callback                                 │
│                                                                              │
│  Implementation:                                                             │
│                                                                              │
│  function EntityInstanceSelectDropdown({ entityCode, value, onChange }) {           │
│    // READ FROM ref_data_entityInstance CACHE                               │
│    const { data: entityCache, isLoading } = useRefDataEntityInstanceCache(  │
│      entityCode                                                              │
│    );                                                                        │
│                                                                              │
│    // Convert cache { uuid: name } to options array                          │
│    const options = useMemo(() => {                                          │
│      if (!entityCache) return [];                                           │
│      return Object.entries(entityCache)                                     │
│        .map(([id, name]) => ({ id, name }))                                 │
│        .sort((a, b) => a.name.localeCompare(b.name));                       │
│    }, [entityCache]);                                                        │
│                                                                              │
│    return (                                                                  │
│      <select value={value} onChange={(e) => {                               │
│        const uuid = e.target.value;                                         │
│        const name = entityCache?.[uuid] || '';                              │
│        onChange(uuid, name);                                                │
│      }}>                                                                     │
│        <option value="">Select...</option>                                  │
│        {options.map(opt => (                                                │
│          <option key={opt.id} value={opt.id}>{opt.name}</option>           │
│        ))}                                                                   │
│      </select>                                                               │
│    );                                                                        │
│  }                                                                           │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  CACHE BEHAVIOR                                                              │
│  ══════════════                                                              │
│                                                                              │
│  CASE 1: Cache HIT (already populated from previous API responses)          │
│  ──────────────────────────────────────────────────────────────────          │
│                                                                              │
│  ['ref_data_entityInstance', 'employee'] = {                                │
│    "uuid-james": "James Miller",                                            │
│    "uuid-sarah": "Sarah Johnson",                                           │
│    "uuid-mike": "Mike Chen"                                                 │
│  }                                                                           │
│                                                                              │
│  → Dropdown renders immediately with cached options                          │
│  → No API call needed                                                        │
│                                                                              │
│  CASE 2: Cache MISS or INCOMPLETE (need more options)                        │
│  ─────────────────────────────────────────────────────                       │
│                                                                              │
│  useRefDataEntityInstanceCache triggers:                                     │
│  GET /api/v1/entity/employee/entity-instance?limit=1000                     │
│                                                                              │
│  Response:                                                                   │
│  {                                                                           │
│    "data": [                                                                 │
│      { "id": "uuid-james", "name": "James Miller" },                        │
│      { "id": "uuid-sarah", "name": "Sarah Johnson" },                       │
│      { "id": "uuid-mike", "name": "Mike Chen" },                            │
│      { "id": "uuid-alice", "name": "Alice Brown" },                         │
│      ...                                                                     │
│    ]                                                                         │
│  }                                                                           │
│                                                                              │
│  → Transform to { uuid: name } format                                        │
│  → UPSERT to cache (merges with existing entries)                            │
│  → Dropdown renders with full options                                        │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  RENDERED DROPDOWN                                                           │
│  ═════════════════                                                           │
│                                                                              │
│  ┌─────────────────────────────────────────┐                                │
│  │ Manager: [James Miller        ▼]        │                                │
│  │          ┌─────────────────────┐        │                                │
│  │          │ Select...           │        │                                │
│  │          │ Alice Brown         │        │                                │
│  │          │ James Miller   ✓    │        │                                │
│  │          │ Mike Chen           │        │                                │
│  │          │ Sarah Johnson       │        │                                │
│  │          └─────────────────────┘        │                                │
│  └─────────────────────────────────────────┘                                │
│                                                                              │
│  USER SELECTS "Sarah Johnson"                                               │
│  → onChange("uuid-sarah", "Sarah Johnson")                                  │
│  → Form state updates: manager__employee_id = "uuid-sarah"                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. Cache Hook: useRefDataEntityInstanceCache

**File**: `apps/web/src/lib/hooks/useRefDataEntityInstanceCache.ts`

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// Cache key pattern - matches backend field name
export const refDataEntityInstanceKeys = {
  all: ['ref_data_entityInstance'] as const,
  byEntity: (entityCode: string) => ['ref_data_entityInstance', entityCode] as const,
};

// Long TTL - entity names rarely change
export const REF_DATA_CACHE_TTL = {
  staleTime: 60 * 60 * 1000,      // 1 hour
  gcTime: 4 * 60 * 60 * 1000,     // 4 hours
};

/**
 * Hook to read/populate ref_data_entityInstance cache for an entity type
 *
 * Used by:
 * - EntityInstanceSelectDropdown (edit mode dropdowns)
 * - Format-on-read when cache miss
 *
 * @param entityCode - Entity type code (e.g., 'employee')
 */
export function useRefDataEntityInstanceCache(entityCode: string | null) {
  return useQuery({
    queryKey: refDataEntityInstanceKeys.byEntity(entityCode || ''),
    queryFn: async () => {
      // Fetch ALL instances for this entity type (for dropdown population)
      const response = await apiClient.get(
        `/api/v1/entity/${entityCode}/entity-instance`,
        { params: { limit: 1000 } }
      );

      // Transform array [{ id, name }] to { uuid: name } map
      const data = response.data.data || [];
      return Object.fromEntries(
        data.map((item: { id: string; name: string }) => [item.id, item.name])
      );
    },
    enabled: !!entityCode,
    staleTime: REF_DATA_CACHE_TTL.staleTime,
    gcTime: REF_DATA_CACHE_TTL.gcTime,
  });
}

/**
 * Synchronous cache read - for format-on-read transformer
 * Returns undefined if not in cache (doesn't trigger fetch)
 */
export function getRefDataFromCache(
  queryClient: ReturnType<typeof useQueryClient>,
  entityCode: string,
  uuid: string
): string | undefined {
  const cache = queryClient.getQueryData<Record<string, string>>(
    refDataEntityInstanceKeys.byEntity(entityCode)
  );
  return cache?.[uuid];
}

/**
 * Upsert ref_data_entityInstance from API response to cache
 * Called in queryFn BEFORE returning data
 */
export function upsertRefDataToCache(
  queryClient: ReturnType<typeof useQueryClient>,
  refData: Record<string, Record<string, string>>
) {
  for (const [entityCode, lookups] of Object.entries(refData)) {
    queryClient.setQueryData<Record<string, string>>(
      refDataEntityInstanceKeys.byEntity(entityCode),
      (old) => ({ ...old, ...lookups })
    );
  }
}

/**
 * Prefetch ALL entity instances on login
 * Called once after successful authentication
 */
export async function prefetchAllEntityInstances(
  queryClient: ReturnType<typeof useQueryClient>
) {
  try {
    // Fetch ALL entity instances grouped by entity_code
    const response = await apiClient.get('/api/v1/entity/entity-instance');

    // Response: { employee: { uuid: name }, business: { uuid: name }, ... }
    if (response.data) {
      upsertRefDataToCache(queryClient, response.data);
    }
  } catch (error) {
    console.error('Failed to prefetch entity instances:', error);
    // Non-blocking - app continues to work, will fetch on demand
  }
}
```

### 2. Login Integration

**File**: `apps/web/src/lib/auth.ts` (or wherever login is handled)

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { prefetchAllEntityInstances } from './hooks/useRefDataEntityInstanceCache';

async function handleLogin(credentials: LoginCredentials) {
  const queryClient = useQueryClient();

  // 1. Authenticate
  const response = await apiClient.post('/api/v1/auth/login', credentials);
  const { token, user } = response.data;

  // 2. Store token
  setAuthToken(token);

  // 3. PREFETCH all entity instances to cache (non-blocking)
  prefetchAllEntityInstances(queryClient);

  return { user };
}
```

### 3. Updated useEntityInstance with Upsert

**File**: `apps/web/src/lib/hooks/useEntityQuery.ts`

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import {
  upsertRefDataToCache,
  getRefDataFromCache,
  refDataEntityInstanceKeys
} from './useRefDataEntityInstanceCache';

export function useEntityInstance<T>(entityCode: string, id: string | null) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.entityInstance(entityCode, id || ''),
    queryFn: async () => {
      const response = await apiClient.get(`/api/v1/${entityCode}/${id}`);

      // STEP 1: UPSERT ref_data_entityInstance to cache FIRST
      if (response.data.ref_data_entityInstance) {
        upsertRefDataToCache(queryClient, response.data.ref_data_entityInstance);
      }

      // STEP 2: Return raw data (format-on-read happens in select)
      return response.data;
    },
    enabled: !!id,
  });
}

/**
 * Formatted version - uses select for format-on-read AFTER cache upsert
 */
export function useFormattedEntityInstance<T>(entityCode: string, id: string | null) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.entityInstance(entityCode, id || ''),
    queryFn: async () => {
      const response = await apiClient.get(`/api/v1/${entityCode}/${id}`);

      // UPSERT to cache FIRST
      if (response.data.ref_data_entityInstance) {
        upsertRefDataToCache(queryClient, response.data.ref_data_entityInstance);
      }

      return response.data;
    },
    // FORMAT-ON-READ: Transform using cache
    select: (response) => formatEntityResponse(response, queryClient),
    enabled: !!id,
  });
}

/**
 * Format-on-read transformer
 * Reads from ref_data_entityInstance cache to resolve UUIDs to names
 */
function formatEntityResponse(
  response: any,
  queryClient: ReturnType<typeof useQueryClient>
) {
  const { data, metadata } = response;
  if (!data || !metadata?.entityListOfInstancesTable?.viewType) {
    return response;
  }

  const formattedData = { ...data };
  const viewType = metadata.entityListOfInstancesTable.viewType;

  for (const [fieldName, fieldMeta] of Object.entries(viewType)) {
    const meta = fieldMeta as any;

    // Check if field is an entity reference
    if (meta.renderType === 'entityInstanceId' && meta.lookupEntity) {
      const uuid = data[fieldName];
      if (uuid) {
        // READ FROM CACHE
        const resolvedName = getRefDataFromCache(
          queryClient,
          meta.lookupEntity,
          uuid
        );
        formattedData[`${fieldName}_display`] = resolvedName || uuid;
      }
    }

    // Handle array references (entityInstanceIds)
    if (meta.renderType === 'entityInstanceIds' && meta.lookupEntity) {
      const uuids = data[fieldName];
      if (Array.isArray(uuids)) {
        const resolvedNames = uuids.map(uuid =>
          getRefDataFromCache(queryClient, meta.lookupEntity, uuid) || uuid
        );
        formattedData[`${fieldName}_display`] = resolvedNames;
      }
    }
  }

  return { ...response, formattedData };
}
```

### 3. Updated EntityInstanceSelectDropdown

**File**: `apps/web/src/components/shared/ui/EntityInstanceSelectDropdown.tsx`

```typescript
import React, { useMemo } from 'react';
import { useRefDataEntityInstanceCache } from '@/lib/hooks/useRefDataEntityInstanceCache';

interface EntityInstanceSelectDropdownProps {
  label: string;
  entityCode: string;
  value: string;
  onChange: (uuid: string, label: string) => void;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  placeholder?: string;
}

/**
 * EntityInstanceSelectDropdown - Single select dropdown for entity reference fields
 *
 * Uses ref_data_entityInstance cache for options.
 * If cache miss, fetches from /entity-instance endpoint.
 */
export const EntityInstanceSelectDropdown: React.FC<EntityInstanceSelectDropdownProps> = ({
  label,
  entityCode,
  value,
  onChange,
  disabled = false,
  readonly = false,
  required = false,
  placeholder = 'Select...'
}) => {
  // READ FROM ref_data_entityInstance CACHE
  const { data: entityCache, isLoading, error } = useRefDataEntityInstanceCache(entityCode);

  // Convert cache { uuid: name } to sorted options array
  const options = useMemo(() => {
    if (!entityCache) return [];
    return Object.entries(entityCache)
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entityCache]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedUuid = e.target.value;
    if (!selectedUuid) {
      onChange('', '');
      return;
    }
    const selectedName = entityCache?.[selectedUuid] || '';
    onChange(selectedUuid, selectedName);
  };

  if (isLoading) {
    return (
      <div className="w-full">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
        <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
          Loading options...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
        <div className="w-full px-3 py-2 border border-red-300 rounded-md bg-red-50 text-red-600 text-sm">
          Failed to load options
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <select
        value={value || ''}
        onChange={handleChange}
        disabled={disabled || readonly}
        required={required}
        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
};
```

---

## Cache Behavior Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CACHE LIFECYCLE                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  POPULATION SOURCES                                                          │
│  ══════════════════                                                          │
│                                                                              │
│  1. Initial login (one-time bulk load)                                       │
│     GET /api/v1/entity/entity-instance (all entity types)                   │
│     → Returns: { employee: { uuid: name }, business: { uuid: name }, ... }  │
│     → Bulk populate cache with ALL accessible entity instances              │
│     → Called once on successful login via prefetchAllEntityInstances()      │
│                                                                              │
│  2. Backend API responses (automatic incremental)                            │
│     GET /api/v1/project/123 → response.ref_data_entityInstance              │
│     → upsertRefDataToCache() in queryFn                                     │
│     → Adds any new UUIDs not already in cache                               │
│                                                                              │
│  3. entity-instance (on demand, per entity type)                             │
│     When dropdown needs full list for specific entity type                   │
│     GET /api/v1/entity/employee/entity-instance                             │
│     → useRefDataEntityInstanceCache() populates cache                       │
│     → Fallback if cache miss or needs refresh                               │
│                                                                              │
│  CONSUMERS                                                                   │
│  ═════════                                                                   │
│                                                                              │
│  1. Format-on-read (view mode)                                               │
│     select: (response) => formatEntityResponse(response, queryClient)       │
│     → getRefDataFromCache(queryClient, entityCode, uuid)                    │
│                                                                              │
│  2. EntityInstanceSelectDropdown (edit mode)                                         │
│     useRefDataEntityInstanceCache(entityCode)                               │
│     → Returns { uuid: name } map for dropdown options                       │
│                                                                              │
│  CACHE KEY                                                                   │
│  ═════════                                                                   │
│                                                                              │
│  ['ref_data_entityInstance', entityCode]                                    │
│                                                                              │
│  Example entries:                                                            │
│  ['ref_data_entityInstance', 'employee'] = {                                │
│    "uuid-james": "James Miller",                                            │
│    "uuid-sarah": "Sarah Johnson"                                            │
│  }                                                                           │
│  ['ref_data_entityInstance', 'business'] = {                                │
│    "uuid-bus": "Huron Home Services"                                        │
│  }                                                                           │
│                                                                              │
│  TTL                                                                         │
│  ═══                                                                         │
│  staleTime: 1 hour (won't refetch if fresh)                                 │
│  gcTime: 4 hours (garbage collect after 4h unused)                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Sequence Diagram

```
┌─────────┐     ┌─────────────┐     ┌─────────────────────┐     ┌───────────────┐
│  User   │     │  Component  │     │  React Query Cache  │     │   Backend     │
└────┬────┘     └──────┬──────┘     └──────────┬──────────┘     └───────┬───────┘
     │                 │                       │                        │
     │  LOGIN          │                       │                        │
     │────────────────>│                       │                        │
     │                 │                       │  POST /api/v1/auth/    │
     │                 │                       │  login                 │
     │                 │                       │───────────────────────>│
     │                 │                       │                        │
     │                 │                       │  { token, user }       │
     │                 │                       │<───────────────────────│
     │                 │                       │                        │
     │                 │  prefetchAllEntity    │  GET /entity/          │
     │                 │  Instances()          │  entity-instance       │
     │                 │──────────────────────>│───────────────────────>│
     │                 │                       │                        │
     │                 │                       │  { employee: {...},    │
     │                 │                       │    business: {...},    │
     │                 │                       │    project: {...} }    │
     │                 │                       │<───────────────────────│
     │                 │                       │                        │
     │                 │  BULK UPSERT to cache │                        │
     │                 │  (ALL entity types)   │                        │
     │                 │──────────────────────>│                        │
     │                 │                       │                        │
     │  Login Success  │                       │                        │
     │<────────────────│                       │                        │
     │                 │                       │                        │
     │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
     │                 │                       │                        │
     │  Navigate to    │                       │                        │
     │  Project Page   │                       │                        │
     │────────────────>│                       │                        │
     │                 │                       │                        │
     │                 │  useEntityInstance()  │                        │
     │                 │──────────────────────>│                        │
     │                 │                       │                        │
     │                 │                       │  GET /api/v1/project/  │
     │                 │                       │───────────────────────>│
     │                 │                       │                        │
     │                 │                       │  { data, ref_data_     │
     │                 │                       │    entityInstance,     │
     │                 │                       │    metadata }          │
     │                 │                       │<───────────────────────│
     │                 │                       │                        │
     │                 │  UPSERT ref_data to   │                        │
     │                 │  cache FIRST          │                        │
     │                 │──────────────────────>│                        │
     │                 │                       │                        │
     │                 │  FORMAT-ON-READ       │                        │
     │                 │  (select transformer) │                        │
     │                 │  reads from cache     │                        │
     │                 │<──────────────────────│                        │
     │                 │                       │                        │
     │  View Mode:     │                       │                        │
     │  "James Miller" │                       │                        │
     │<────────────────│                       │                        │
     │                 │                       │                        │
     │  Click "Edit"   │                       │                        │
     │────────────────>│                       │                        │
     │                 │                       │                        │
     │                 │  useRefDataEntityInstanceCache('employee')     │
     │                 │──────────────────────>│                        │
     │                 │                       │                        │
     │                 │  Cache HIT?           │                        │
     │                 │  YES → return cached  │                        │
     │                 │<──────────────────────│                        │
     │                 │                       │                        │
     │                 │  NO → fetch           │  GET /entity/employee/ │
     │                 │                       │  entity-instance       │
     │                 │                       │───────────────────────>│
     │                 │                       │                        │
     │                 │                       │  [{ id, name }, ...]   │
     │                 │                       │<───────────────────────│
     │                 │                       │                        │
     │                 │  Upsert to cache      │                        │
     │                 │──────────────────────>│                        │
     │                 │                       │                        │
     │  Dropdown with  │                       │                        │
     │  all employees  │                       │                        │
     │<────────────────│                       │                        │
     │                 │                       │                        │
```

---

## Testing Checklist

- [ ] **Login prefetch**: `prefetchAllEntityInstances()` called after login
- [ ] **Login prefetch**: Cache populated with all entity types on login
- [ ] Backend API responses include `ref_data_entityInstance`
- [ ] `ref_data_entityInstance` upserts to cache in queryFn (BEFORE select)
- [ ] Format-on-read uses cache via `getRefDataFromCache()`
- [ ] View mode shows resolved names (not UUIDs)
- [ ] Edit mode dropdown uses `useRefDataEntityInstanceCache()`
- [ ] Dropdown populated from cache (no extra API call if cached)
- [ ] Cache persists across page navigation
- [ ] React Query DevTools shows `['ref_data_entityInstance', entityCode]` entries

---

## Summary

**Key Implementation Points**:

1. **Cache Name**: `ref_data_entityInstance` (matches backend response)
2. **Cache Key**: `['ref_data_entityInstance', entityCode]`
3. **Login Prefetch**: `prefetchAllEntityInstances()` bulk loads ALL entities on login
4. **Incremental Upsert**: queryFn upserts `response.ref_data_entityInstance` to cache BEFORE returning
5. **Format Uses Cache**: select transformer reads from cache via `getRefDataFromCache()`
6. **Dropdown Uses Cache**: `useRefDataEntityInstanceCache()` reads same cache

**Data Flow**:
```
LOGIN → Bulk Prefetch ALL entities → Cache Populated
                                          ↓
API Response → Incremental Upsert → Format-on-Read (reads cache) → Render
                                          ↓
                                   Dropdown (reads cache)
```
