# Dynamic UUID Mapping Cache - Client-Side Solution

**Version**: 1.0.0
**Date**: 2025-01-18
**Status**: 📋 Proposed Optimization

## Problem Statement

Currently, the backend resolves UUIDs every time via `resolve_entity_references()`. Instead of creating a separate resolution service, we can:
1. **Extract** UUID→name mappings from API responses automatically
2. **Cache** them in memory + localStorage
3. **Reuse** cached mappings across the app
4. **Persist** between sessions

---

## Core Insight

The API already sends both UUIDs and names:
```json
{
  "manager__employee_id": "uuid-123",
  "manager": "James Miller",
  "stakeholder": [
    { "stakeholder__employee_id": "uuid-456", "stakeholder": "Sarah Johnson" },
    { "stakeholder__employee_id": "uuid-789", "stakeholder": "Michael Chen" }
  ]
}
```

We can **automatically extract** the k:v pairs:
```typescript
{
  "uuid-123": "James Miller",
  "uuid-456": "Sarah Johnson",
  "uuid-789": "Michael Chen"
}
```

And **cache** them for future use!

---

## Solution Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    API RESPONSE ARRIVES                              │
│  { manager__employee_id: "uuid", manager: "Name", ... }             │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────────┐
│              AUTOMATIC EXTRACTION (Interceptor)                      │
│                                                                      │
│  extractUuidMappings(response) {                                    │
│    for each field in response:                                      │
│      if field matches *__*_id pattern:                              │
│        → extract UUID → name mapping                                │
│      if field matches *__*_ids pattern:                             │
│        → extract array of UUID → name mappings                      │
│  }                                                                   │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────────┐
│                  UUID MAPPING CACHE (Context + LocalStorage)         │
│                                                                      │
│  In-Memory:                                                          │
│  {                                                                   │
│    "employee": {                                                     │
│      "uuid-123": "James Miller",                                    │
│      "uuid-456": "Sarah Johnson",                                   │
│      "uuid-789": "Michael Chen"                                     │
│    },                                                                │
│    "project": {                                                      │
│      "uuid-abc": "Kitchen Renovation",                              │
│      "uuid-def": "Bathroom Remodel"                                 │
│    }                                                                 │
│  }                                                                   │
│                                                                      │
│  LocalStorage:                                                       │
│  Same structure, persisted between sessions                         │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    USAGE IN COMPONENTS                               │
│                                                                      │
│  const { resolve } = useUuidMapping();                              │
│                                                                      │
│  // Resolve single UUID                                             │
│  const managerName = resolve('employee', 'uuid-123');               │
│  // Returns: "James Miller" (from cache)                            │
│                                                                      │
│  // Resolve array of UUIDs                                          │
│  const names = resolveMany('employee', ['uuid-456', 'uuid-789']);   │
│  // Returns: ["Sarah Johnson", "Michael Chen"]                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation

### 1. UUID Mapping Cache Context

```typescript
// apps/web/src/contexts/UuidMappingContext.tsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface UuidMappingCache {
  [entityType: string]: {
    [uuid: string]: string;  // uuid → name
  };
}

interface UuidMappingContextValue {
  // Get resolved name for UUID
  resolve: (entityType: string, uuid: string) => string | undefined;

  // Get resolved names for multiple UUIDs
  resolveMany: (entityType: string, uuids: string[]) => (string | undefined)[];

  // Add single mapping
  addMapping: (entityType: string, uuid: string, name: string) => void;

  // Add multiple mappings at once
  addMappings: (entityType: string, mappings: Record<string, string>) => void;

  // Extract and cache from API response
  extractFromResponse: (data: any) => void;

  // Clear cache
  clearCache: (entityType?: string) => void;
}

const UuidMappingContext = createContext<UuidMappingContextValue | undefined>(undefined);

const STORAGE_KEY = 'pmo_uuid_mapping_cache';
const CACHE_VERSION = '1.0';

export const UuidMappingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cache, setCache] = useState<UuidMappingCache>(() => {
    // Load from localStorage on mount
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.version === CACHE_VERSION) {
          return parsed.data;
        }
      }
    } catch (error) {
      console.warn('Failed to load UUID mapping cache:', error);
    }
    return {};
  });

  // Persist to localStorage whenever cache changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: CACHE_VERSION,
        data: cache,
        updatedAt: new Date().toISOString()
      }));
    } catch (error) {
      console.warn('Failed to persist UUID mapping cache:', error);
    }
  }, [cache]);

  // Resolve single UUID
  const resolve = useCallback((entityType: string, uuid: string): string | undefined => {
    return cache[entityType]?.[uuid];
  }, [cache]);

  // Resolve multiple UUIDs
  const resolveMany = useCallback((entityType: string, uuids: string[]): (string | undefined)[] => {
    return uuids.map(uuid => cache[entityType]?.[uuid]);
  }, [cache]);

  // Add single mapping
  const addMapping = useCallback((entityType: string, uuid: string, name: string) => {
    setCache(prev => ({
      ...prev,
      [entityType]: {
        ...(prev[entityType] || {}),
        [uuid]: name
      }
    }));
  }, []);

  // Add multiple mappings
  const addMappings = useCallback((entityType: string, mappings: Record<string, string>) => {
    setCache(prev => ({
      ...prev,
      [entityType]: {
        ...(prev[entityType] || {}),
        ...mappings
      }
    }));
  }, []);

  // Extract mappings from API response
  const extractFromResponse = useCallback((data: any) => {
    if (!data || typeof data !== 'object') return;

    const newMappings: UuidMappingCache = {};

    // Helper to extract from a single object
    const extractFromObject = (obj: any) => {
      const keys = Object.keys(obj);

      // Pattern 1: Single reference (manager + manager__employee_id)
      for (const labelKey of keys) {
        const uuidKey = keys.find(k => {
          const regex = new RegExp(`^${labelKey}__([a-z_]+)_id$`);
          return regex.test(k);
        });

        if (uuidKey && obj[uuidKey] && obj[labelKey]) {
          const match = uuidKey.match(/__([a-z_]+)_id$/);
          if (match) {
            const entityType = match[1];
            const uuid = obj[uuidKey];
            const name = obj[labelKey];

            if (typeof uuid === 'string' && typeof name === 'string') {
              if (!newMappings[entityType]) newMappings[entityType] = {};
              newMappings[entityType][uuid] = name;
            }
          }
        }
      }

      // Pattern 2: Array reference (stakeholder + stakeholder__employee_ids)
      for (const labelKey of keys) {
        const value = obj[labelKey];
        if (!Array.isArray(value)) continue;

        // Check if this is a resolved array (array of objects with UUID + name)
        if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
          // Extract entity type from first object
          const firstObj = value[0];
          const objKeys = Object.keys(firstObj);

          // Find the UUID field key (ends with _id)
          const uuidKey = objKeys.find(k => k.endsWith('_id') && k !== 'id');

          if (uuidKey && firstObj[labelKey]) {
            const match = uuidKey.match(/^(.+)__([a-z_]+)_id$/);
            if (match) {
              const entityType = match[2];

              value.forEach((item: any) => {
                const uuid = item[uuidKey];
                const name = item[labelKey];

                if (typeof uuid === 'string' && typeof name === 'string') {
                  if (!newMappings[entityType]) newMappings[entityType] = {};
                  newMappings[entityType][uuid] = name;
                }
              });
            }
          }
        }
      }

      // Recursively extract from nested objects and arrays
      for (const value of Object.values(obj)) {
        if (Array.isArray(value)) {
          value.forEach(item => {
            if (typeof item === 'object' && item !== null) {
              extractFromObject(item);
            }
          });
        } else if (typeof value === 'object' && value !== null) {
          extractFromObject(value);
        }
      }
    };

    // Handle array responses (list endpoints)
    if (Array.isArray(data)) {
      data.forEach(item => {
        if (typeof item === 'object' && item !== null) {
          extractFromObject(item);
        }
      });
    } else {
      extractFromObject(data);
    }

    // Merge extracted mappings into cache
    setCache(prev => {
      const updated = { ...prev };
      for (const [entityType, mappings] of Object.entries(newMappings)) {
        updated[entityType] = {
          ...(updated[entityType] || {}),
          ...mappings
        };
      }
      return updated;
    });
  }, []);

  // Clear cache
  const clearCache = useCallback((entityType?: string) => {
    if (entityType) {
      setCache(prev => {
        const updated = { ...prev };
        delete updated[entityType];
        return updated;
      });
    } else {
      setCache({});
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const value: UuidMappingContextValue = {
    resolve,
    resolveMany,
    addMapping,
    addMappings,
    extractFromResponse,
    clearCache
  };

  return (
    <UuidMappingContext.Provider value={value}>
      {children}
    </UuidMappingContext.Provider>
  );
};

export const useUuidMapping = () => {
  const context = useContext(UuidMappingContext);
  if (!context) {
    throw new Error('useUuidMapping must be used within UuidMappingProvider');
  }
  return context;
};
```

---

### 2. API Response Interceptor

```typescript
// apps/web/src/lib/apiInterceptor.ts

import { useUuidMapping } from '../contexts/UuidMappingContext';

/**
 * Axios interceptor to automatically extract UUID mappings from API responses
 */
export function setupUuidMappingInterceptor(axiosInstance: any) {
  axiosInstance.interceptors.response.use(
    (response: any) => {
      // Extract mappings from response data
      if (response.data) {
        // Access the context (this needs to be called from a component)
        // Alternative: Use a global function instead
        window.dispatchEvent(new CustomEvent('api-response', {
          detail: response.data
        }));
      }
      return response;
    },
    (error: any) => {
      return Promise.reject(error);
    }
  );
}

/**
 * Component that listens for API responses and extracts mappings
 * Place this near the top of your app tree (inside UuidMappingProvider)
 */
export const UuidMappingExtractor: React.FC = () => {
  const { extractFromResponse } = useUuidMapping();

  useEffect(() => {
    const handleApiResponse = (event: CustomEvent) => {
      extractFromResponse(event.detail);
    };

    window.addEventListener('api-response', handleApiResponse as EventListener);

    return () => {
      window.removeEventListener('api-response', handleApiResponse as EventListener);
    };
  }, [extractFromResponse]);

  return null; // This component renders nothing
};
```

---

### 3. Hook for Resolving UUIDs

```typescript
// apps/web/src/hooks/useResolveUuid.ts

import { useUuidMapping } from '../contexts/UuidMappingContext';
import { useState, useEffect } from 'react';
import { entityOptionsApi } from '../lib/api';

/**
 * Hook to resolve a single UUID to name
 * First checks cache, falls back to API if not found
 */
export function useResolveUuid(
  entityType: string,
  uuid: string | null | undefined
): {
  name: string | undefined;
  loading: boolean;
  error: Error | null;
} {
  const { resolve, addMapping } = useUuidMapping();
  const [name, setName] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!uuid) {
      setName(undefined);
      return;
    }

    // Check cache first
    const cachedName = resolve(entityType, uuid);

    if (cachedName) {
      setName(cachedName);
      return;
    }

    // Not in cache - fetch from API
    const fetchName = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await entityOptionsApi.getBulkOptions(entityType, [uuid]);

        if (response.length > 0) {
          const resolvedName = response[0].name;
          setName(resolvedName);

          // Add to cache for future use
          addMapping(entityType, uuid, resolvedName);
        } else {
          setName('Unknown');
        }
      } catch (err) {
        setError(err as Error);
        setName('Unknown');
      } finally {
        setLoading(false);
      }
    };

    fetchName();
  }, [entityType, uuid, resolve, addMapping]);

  return { name, loading, error };
}

/**
 * Hook to resolve multiple UUIDs to names
 * Checks cache first, fetches missing ones from API
 */
export function useResolveUuids(
  entityType: string,
  uuids: string[]
): {
  names: (string | undefined)[];
  loading: boolean;
  error: Error | null;
} {
  const { resolveMany, addMappings } = useUuidMapping();
  const [names, setNames] = useState<(string | undefined)[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!uuids || uuids.length === 0) {
      setNames([]);
      return;
    }

    // Check cache first
    const cachedNames = resolveMany(entityType, uuids);

    // Find which UUIDs are missing from cache
    const missingUuids = uuids.filter((uuid, index) => !cachedNames[index]);

    if (missingUuids.length === 0) {
      // All found in cache
      setNames(cachedNames);
      return;
    }

    // Fetch missing UUIDs from API
    const fetchMissing = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await entityOptionsApi.getBulkOptions(entityType, missingUuids);

        // Build mapping from response
        const newMappings: Record<string, string> = {};
        response.forEach((item: any) => {
          newMappings[item.id] = item.name;
        });

        // Add to cache
        addMappings(entityType, newMappings);

        // Resolve all UUIDs again (now that cache is updated)
        const allNames = uuids.map(uuid => {
          const cached = resolveMany(entityType, [uuid])[0];
          return cached || newMappings[uuid] || 'Unknown';
        });

        setNames(allNames);
      } catch (err) {
        setError(err as Error);
        setNames(uuids.map(() => 'Unknown'));
      } finally {
        setLoading(false);
      }
    };

    fetchMissing();
  }, [entityType, JSON.stringify(uuids), resolveMany, addMappings]);

  return { names, loading, error };
}
```

---

### 4. App Setup

```typescript
// apps/web/src/App.tsx

import { UuidMappingProvider, UuidMappingExtractor } from './contexts/UuidMappingContext';
import { setupUuidMappingInterceptor } from './lib/apiInterceptor';
import { apiClient } from './lib/api';

// Setup interceptor once
setupUuidMappingInterceptor(apiClient);

function App() {
  return (
    <UuidMappingProvider>
      <UuidMappingExtractor />  {/* Listens for API responses */}

      {/* Rest of your app */}
      <YourRoutes />
    </UuidMappingProvider>
  );
}
```

---

### 5. Usage in Components

#### Example 1: EntityDataTable (Automatic)

```typescript
// The table receives data that's already resolved by backend
// Mappings are automatically extracted by the interceptor
// No manual work needed!

const projects = [
  {
    id: "uuid",
    name: "Kitchen Renovation",
    manager__employee_id: "emp-123",  // Automatically cached
    manager: "James Miller"            // Automatically cached: emp-123 → James Miller
  }
];
```

#### Example 2: Dropdown Options (Use Cache)

```typescript
// apps/web/src/components/shared/entity/EntityFormContainer.tsx

const ManagerSelect = ({ currentUuid }: { currentUuid: string }) => {
  const { resolve } = useUuidMapping();

  // Get current manager name from cache (instant, no API call)
  const currentName = resolve('employee', currentUuid);

  return (
    <div>
      <label>Current Manager: {currentName || 'Loading...'}</label>
      {/* Dropdown options loaded separately */}
    </div>
  );
};
```

#### Example 3: Display UUID Without Backend Resolution

```typescript
// apps/web/src/components/SomeComponent.tsx

const EmployeeDisplay = ({ employeeId }: { employeeId: string }) => {
  const { name, loading } = useResolveUuid('employee', employeeId);

  if (loading) return <span>Loading...</span>;

  return <span>{name || 'Unknown Employee'}</span>;
};
```

#### Example 4: Manual Cache Population

```typescript
// When loading dropdown options, also populate cache
const loadManagerOptions = async () => {
  const response = await entityOptionsApi.getOptions('employee', { limit: 1000 });

  // Populate cache
  const { addMappings } = useUuidMapping();
  const mappings = response.reduce((acc, item) => {
    acc[item.id] = item.name;
    return acc;
  }, {} as Record<string, string>);

  addMappings('employee', mappings);

  return response;
};
```

---

## Benefits

### ✅ Performance

| Metric | Without Cache | With Cache |
|--------|--------------|------------|
| First load | 1 API call | 1 API call |
| Subsequent lookups | 1 API call each | **0 API calls** (instant) |
| Page reload | All new calls | **Cached** (instant) |
| Cross-page navigation | New calls | **Cached** (instant) |

### ✅ User Experience

- **Instant resolution** of previously seen UUIDs
- **Offline capability** (cached data available)
- **Reduced loading states** (cache hits are instant)
- **Lower latency** (no network round-trip)

### ✅ Infrastructure

- **No backend changes** needed
- **Automatic extraction** from existing API responses
- **Persistent between sessions** (localStorage)
- **Graceful fallback** (API call if not cached)
- **Memory efficient** (only stores UUID→name pairs)

---

## Cache Management

### Auto-Cleanup Strategy

```typescript
// Add to UuidMappingProvider

const MAX_CACHE_SIZE = 10000; // Max number of mappings per entity type
const MAX_CACHE_AGE_DAYS = 30;

// Periodic cleanup
useEffect(() => {
  const cleanup = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    const parsed = JSON.parse(stored);
    const updatedAt = new Date(parsed.updatedAt);
    const daysSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);

    // Clear if cache is too old
    if (daysSinceUpdate > MAX_CACHE_AGE_DAYS) {
      clearCache();
      return;
    }

    // Trim if cache is too large
    Object.keys(cache).forEach(entityType => {
      const mappings = cache[entityType];
      const keys = Object.keys(mappings);

      if (keys.length > MAX_CACHE_SIZE) {
        // Keep most recently used (would need to track access times)
        // For now, just keep first N entries
        const trimmed = keys.slice(0, MAX_CACHE_SIZE).reduce((acc, key) => {
          acc[key] = mappings[key];
          return acc;
        }, {} as Record<string, string>);

        setCache(prev => ({
          ...prev,
          [entityType]: trimmed
        }));
      }
    });
  };

  // Run cleanup daily
  const interval = setInterval(cleanup, 24 * 60 * 60 * 1000);
  return () => clearInterval(interval);
}, [cache, clearCache]);
```

### Manual Cache Management

```typescript
// Expose cache stats
export function useCacheStats() {
  const { cache } = useUuidMapping();

  return Object.entries(cache).map(([entityType, mappings]) => ({
    entityType,
    count: Object.keys(mappings).length
  }));
}

// Usage in settings page
const CacheSettings = () => {
  const { clearCache } = useUuidMapping();
  const stats = useCacheStats();

  return (
    <div>
      <h2>UUID Cache Statistics</h2>
      {stats.map(stat => (
        <div key={stat.entityType}>
          {stat.entityType}: {stat.count} cached entries
        </div>
      ))}
      <button onClick={() => clearCache()}>Clear All Cache</button>
    </div>
  );
};
```

---

## Migration from Current Approach

### Before (Backend Resolution Only)

```typescript
// API sends resolved data
{
  manager__employee_id: "uuid",
  manager: "Name"
}

// Component displays
<span>{data.manager}</span>
```

### After (Cache-Enhanced)

```typescript
// API sends resolved data (same as before)
{
  manager__employee_id: "uuid",
  manager: "Name"
}

// Interceptor automatically caches: uuid → Name

// Component can now use cache for other UUIDs
const { name } = useResolveUuid('employee', someOtherUuid);
<span>{name}</span>  // Instant if cached, fallback to API if not
```

**No breaking changes** - everything works as before, but now with caching!

---

## Summary

**The Dynamic Mapping Solution**:

1. **Automatic Extraction**: API responses automatically populate cache
2. **Persistent Storage**: LocalStorage survives page reloads
3. **Smart Fallback**: Cache first, API second
4. **Zero Config**: Works out of the box with existing naming convention
5. **Performance Boost**: Instant resolution for cached UUIDs
6. **No Backend Changes**: Uses existing API responses

**Result**: Best of both worlds - backend resolution for consistency + client-side caching for performance!
