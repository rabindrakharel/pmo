# Zustand State Management Integration Guide

## Overview

This guide provides comprehensive implementation for Zustand-based state management in the PMO application, covering both field-level editing and intelligent data caching.

## Part 1: Field-Level Change Management

### Features
- **Field-level change tracking** - Only send changed fields to the API
- **Optimistic updates** - Immediate UI feedback with rollback on error
- **Local persistence** - Maintain edit state during navigation
- **Undo/redo capability** - Full edit history
- **React Query integration** - Hybrid approach for best performance

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interaction                       │
│                   (Edit field in form)                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Zustand Edit Store                       │
│  • Tracks field-level changes                               │
│  • Maintains dirty fields set                               │
│  • Provides undo/redo stack                                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   Change Detection                          │
│  • Compares original vs current                             │
│  • Returns only changed fields                              │
│  • Normalizes empty strings to null                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    PATCH Request                            │
│  • Sends ONLY changed fields                                │
│  • Example: { "budget_amt": 50000 }                        │
│  • Not entire entity object                                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   React Query Cache                         │
│  • Optimistic update applied                                │
│  • Rollback on error                                        │
│  • Invalidate and refetch on success                        │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Example

### 1. Office Main Page (List View)

```typescript
// apps/web/src/pages/office/OfficePage.tsx
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { EntityDataTable } from '../../components/shared/ui/EntityDataTable';

export function OfficePage() {
  const navigate = useNavigate();

  // Fetch offices using React Query
  const { data: response, isLoading } = useQuery({
    queryKey: ['offices'],
    queryFn: async () => {
      const res = await fetch('/api/v1/office?view=entityDataTable');
      return res.json();
    }
  });

  const handleRowClick = (office: any) => {
    // Navigate to detail view
    navigate(`/office/${office.id}`);
  };

  return (
    <EntityDataTable
      data={response?.data}
      metadata={response?.metadata}
      onRowClick={handleRowClick}
    />
  );
}
```

### 2. Office Detail Page (With Zustand Integration)

```typescript
// apps/web/src/pages/office/OfficeDetailPage.tsx
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEntityEditStore } from '../../stores/useEntityEditStore';
import { EntityFormContainerWithStore } from '../../components/shared/entity/EntityFormContainerWithStore';
import { useState, useEffect } from 'react';

export function OfficeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  // Zustand store for edit state
  const {
    startEdit,
    saveChanges,
    cancelEdit,
    hasChanges,
    dirtyFields,
    reset
  } = useEntityEditStore();

  // Fetch office data with React Query
  const { data: response, isLoading } = useQuery({
    queryKey: ['office', id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/office/${id}?view=entityFormContainer`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hasChanges()) {
        const confirmed = window.confirm('You have unsaved changes. Are you sure you want to leave?');
        if (!confirmed) {
          // Prevent navigation
          return;
        }
      }
      reset();
    };
  }, [hasChanges, reset]);

  const handleEdit = () => {
    if (response?.data) {
      startEdit('office', id!, response.data);
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    // Save with optimistic update
    const success = await saveWithOptimisticUpdate();

    if (success) {
      setIsEditing(false);
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['office', id] });
    }
  };

  const handleCancel = () => {
    if (hasChanges()) {
      const confirmed = window.confirm('Discard unsaved changes?');
      if (!confirmed) return;
    }

    cancelEdit();
    setIsEditing(false);
  };

  // Helper function for optimistic updates
  const saveWithOptimisticUpdate = async () => {
    const changes = useEntityEditStore.getState().getChanges();

    if (Object.keys(changes).length === 0) {
      return true;
    }

    // Optimistically update React Query cache
    const queryKey = ['office', id];
    await queryClient.cancelQueries({ queryKey });

    const previousData = queryClient.getQueryData(queryKey);

    queryClient.setQueryData(queryKey, (old: any) => ({
      ...old,
      data: { ...old?.data, ...changes }
    }));

    // Save changes
    const success = await saveChanges();

    if (!success) {
      // Rollback optimistic update
      queryClient.setQueryData(queryKey, previousData);
    }

    return success;
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="entity-detail-page">
      {/* Header with Edit button */}
      <div className="page-header">
        <h1>{response?.data?.name}</h1>
        <div className="header-actions">
          {!isEditing && (
            <button onClick={handleEdit} className="btn-edit">
              Edit
            </button>
          )}
          {dirtyFields.size > 0 && (
            <span className="unsaved-indicator">
              {dirtyFields.size} unsaved changes
            </span>
          )}
        </div>
      </div>

      {/* Form with Zustand integration */}
      <EntityFormContainerWithStore
        entityType="office"
        entityId={id!}
        data={response?.data}
        metadata={response?.metadata}
        datalabels={response?.datalabels}
        isEditing={isEditing}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );
}
```

### 3. Single Field Edit Example

When a user edits just one field (e.g., budget amount):

```typescript
// Inside EntityFormContainerWithStore

// User changes budget from 50000 to 75000
handleFieldChange('budget_allocated_amt', 75000);

// Zustand store tracks:
// - originalData: { budget_allocated_amt: 50000, ... }
// - currentData: { budget_allocated_amt: 75000, ... }
// - dirtyFields: Set(['budget_allocated_amt'])
// - changes: { budget_allocated_amt: 75000 }

// When saving:
const changes = getChanges();
// Returns: { budget_allocated_amt: 75000 }

// API call sends ONLY:
PUT /api/v1/office/123
{
  "budget_allocated_amt": 75000
}

// NOT the entire object!
```

## Benefits

### 1. Performance

- **Reduced Payload**: Only send changed fields (e.g., 50 bytes vs 5KB)
- **Less Conflicts**: Partial updates reduce concurrent edit conflicts
- **Optimistic Updates**: Instant UI feedback

### 2. User Experience

- **Visual Feedback**: Dirty field indicators
- **Undo/Redo**: Full edit history
- **Unsaved Changes Warning**: Prevent accidental data loss
- **Field-level Validation**: Validate only changed fields

### 3. Developer Experience

- **Simple Integration**: Drop-in replacement for existing forms
- **Debugging Tools**: Zustand DevTools integration
- **Type Safety**: Full TypeScript support
- **Reusable**: Works with any entity type

## Migration Guide

### Step 1: Install Dependencies

```bash
pnpm add zustand @tanstack/react-query
```

### Step 2: Update EntityFormContainer

Replace `onChange` prop with Zustand store:

```typescript
// Before
<EntityFormContainer
  data={data}
  isEditing={isEditing}
  onChange={(field, value) => {
    setData({ ...data, [field]: value });
  }}
/>

// After
<EntityFormContainerWithStore
  entityType="office"
  entityId={id}
  data={data}
  isEditing={isEditing}
  onSave={handleSave}
  onCancel={handleCancel}
/>
```

### Step 3: Update API Endpoints

Ensure PATCH/PUT endpoints handle partial updates:

```typescript
// Backend should merge partial updates
fastify.patch('/api/v1/office/:id', async (request, reply) => {
  const { id } = request.params;
  const updates = request.body; // Only changed fields

  // Merge with existing data
  const result = await db.execute(sql`
    UPDATE app.d_office
    SET ${sql.join(
      Object.entries(updates).map(([key, value]) =>
        sql`${sql.identifier([key])} = ${value}`
      ),
      sql`, `
    )}
    WHERE id = ${id}
    RETURNING *
  `);

  return result[0];
});
```

## Testing the Flow

1. **Navigate to Office List**: `/office`
2. **Click a row**: Navigate to `/office/{id}`
3. **Click Edit**: Enter edit mode
4. **Change one field**: e.g., change budget amount
5. **Observe**:
   - Dirty field indicator appears
   - "1 unsaved change" shown in toolbar
   - Undo button becomes enabled
6. **Save**:
   - Only changed field sent to API
   - Optimistic update applied immediately
   - On success, exits edit mode
7. **Verify**: Check network tab - only one field in request body

## Advanced Features

### Keyboard Shortcuts

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'z':
          e.preventDefault();
          undo();
          break;
        case 'y':
          e.preventDefault();
          redo();
          break;
        case 's':
          e.preventDefault();
          handleSave();
          break;
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [undo, redo, handleSave]);
```

### Auto-save

```typescript
// Auto-save after 3 seconds of inactivity
const AUTOSAVE_DELAY = 3000;

useEffect(() => {
  if (!hasChanges()) return;

  const timer = setTimeout(() => {
    saveChanges();
  }, AUTOSAVE_DELAY);

  return () => clearTimeout(timer);
}, [currentData, hasChanges, saveChanges]);
```

### Conflict Resolution

```typescript
// Handle concurrent edits
const handleSave = async () => {
  try {
    await saveChanges();
  } catch (error) {
    if (error.code === 'CONFLICT') {
      // Fetch latest version
      const latest = await fetchLatest();

      // Show diff dialog
      showConflictDialog({
        local: currentData,
        remote: latest,
        onResolve: (resolved) => {
          updateMultipleFields(resolved);
          saveChanges();
        }
      });
    }
  }
};
```

## Debugging

### Zustand DevTools

```typescript
// Enable in development
if (process.env.NODE_ENV === 'development') {
  window.__ZUSTAND_DEVTOOLS__ = true;
}
```

### Change Tracking Logger

```typescript
// Log all changes
useEntityEditStore.subscribe(
  (state) => state.dirtyFields,
  (dirtyFields) => {
    console.log('[Changes]', Array.from(dirtyFields));
  }
);
```

## Summary - Field Management

The field-level change tracking provides:

1. **Efficient Updates**: Only send changed fields
2. **Better UX**: Visual feedback, undo/redo, warnings
3. **Performance**: Optimistic updates, reduced payloads
4. **Developer Experience**: Simple API, good debugging

---

## Part 2: Intelligent Data Caching with 9 Specialized Stores

### Backend to Frontend Integration

The frontend stores are populated by two backend services:

| Backend Service | Documentation | Data Produced |
|-----------------|---------------|---------------|
| **Entity Infrastructure Service** | [entity-infrastructure.service.md](../services/entity-infrastructure.service.md) | RBAC-filtered entities |
| **Backend Formatter Service** | [backend-formatter.service.md](../services/backend-formatter.service.md) | Metadata, datalabels, globalSettings |

### API Response Structure

Every entity endpoint returns a comprehensive response:

```typescript
// GET /api/v1/project?view=entityDataTable
{
  data: [...],           // → EntityListOfInstancesDataStore (URL-bound)
  fields: [...],         // → used by stores internally
  metadata: {            // → entityComponentMetadataStore (piggyback)
    entityDataTable: { ... }
  },
  datalabels: [...],     // → datalabelMetadataStore (also has dedicated EP)
  globalSettings: {...}, // → globalSettingsMetadataStore (also has dedicated EP)
  total: 100,
  limit: 20,
  offset: 0
}
```

### Store Architecture Overview

The PMO platform uses **9 specialized Zustand stores** organized by cache lifecycle:

| Store | Purpose | Example Content | TTL | Storage |
|-------|---------|-----------------|-----|---------|
| **`globalSettingsMetadataStore`** | Currency, date, timestamp formatting | `{currency: {symbol:"$"}, date: {...}}` | 30 min | SessionStorage |
| **`datalabelMetadataStore`** | Dropdown options for `dl__*` fields | `{dl__project_stage: [{id:1, name:"Planning"}]}` | 30 min | SessionStorage |
| **`entityCodeMetadataStore`** | Sidebar navigation | `[{code:"project", label:"Projects", icon:"folder"}]` | 30 min | SessionStorage |
| **`entityComponentMetadataStore`** | Field metadata per component | `{budget_amt: {type:"currency", editable:true}}` | 30 min | SessionStorage |
| **`EntitySpecificInstanceDataStore`** | Single entity detail | Complete project record | URL-bound + 5 min | SessionStorage |
| **`EntityListOfInstancesDataStore`** | Table/list data | 20 project records | URL-bound + 5 min | SessionStorage |
| **`useEntityEditStore`** | Edit state, dirty tracking | `{dirtyFields: Set(['budget'])}` | No TTL | Memory |
| **`useEntityStore`** | Monolithic entity state | `{entities: {...}, selected: {...}}` | No TTL | Memory |
| **`uiStateStore`** | UI preferences | `{sidebarCollapsed: false, viewMode: 'table'}` | No TTL | Memory |

### Session-Level Stores (30 min TTL, fetched on login)

| Store | Dedicated Endpoint | Used By | Invalidates When |
|-------|-------------------|---------|------------------|
| `globalSettingsMetadataStore` | `GET /api/v1/settings/global` | App-wide formatting | On login |
| `datalabelMetadataStore` | `GET /api/v1/settings/datalabels/all` | All dropdown fields | On login |
| `entityCodeMetadataStore` | `GET /api/v1/entity/codes` | Sidebar navigation | On login |

**Session Cache Rules:**
- Fetched once on **login**
- Cached for entire session (30 min TTL)
- Refreshed on next login

### URL-Bound Stores (5 min TTL + URL invalidation)

| Store | Populated By | Fetched When | Invalidation |
|-------|--------------|--------------|--------------|
| `entityComponentMetadataStore` | Entity API responses (`metadata`) | Navigate to entity URL | URL exit + 5 min TTL |
| `EntityListOfInstancesDataStore` | `GET /api/v1/{entity}` | Navigate to `/entity` | URL exit + 5 min TTL |
| `EntitySpecificInstanceDataStore` | `GET /api/v1/{entity}/{id}` | Navigate to `/entity/:id` | URL exit + 5 min TTL |

**Important**: `entityComponentMetadataStore` has NO dedicated endpoint. It is always populated as a side-effect when entity endpoints return data. The metadata is generated by backend based on SQL query columns, so it cannot be fetched separately.

**URL-Bound Cache Rules:**
1. **Fetch on URL entry**: Data fetched only when user navigates to that URL route
2. **Invalidate on URL exit**: Cache cleared immediately when navigating away
3. **5 min TTL fallback**: Also invalidates after 5 minutes if user stays on same page
4. **Optimistic updates**: Local changes tracked with `isDirty` flag until synced

### Navigation Flow Examples

#### Complete User Journey

| Time | User Action | Cache Operations | API Calls |
|------|-------------|------------------|-----------|
| 09:00 | Login | Fetch session stores (entity codes, settings, datalabels) | 3 calls (session stores) |
| 09:01 | Click "Office" in sidebar | • Use session stores ✓<br>• Fetch office list + metadata → URL-bound stores | 1 call (GET /office) |
| 09:02 | Click office row #123 | • INVALIDATE office URL-bound caches (left URL)<br>• Fetch office/123 + metadata → URL-bound stores | 1 call (GET /office/123) |
| 09:03 | Edit budget field | • Track in `useEntityEditStore`<br>• Mark isDirty in `EntitySpecificInstanceDataStore` | 0 calls |
| 09:04 | Save changes | • PATCH only changed field<br>• Clear isDirty flag<br>• Refresh instance cache | 1 call (PATCH /office/123) |
| 09:05 | Back to /office | • INVALIDATE office/123 URL caches<br>• Refetch list + metadata<br>• Use session stores ✓ | 1 call (GET /office) |
| 09:10 | Stay on /office | • 5 min TTL expires → background refetch | 1 call (GET /office) |
| Next login | User logs in again | • All session stores refreshed | 3 calls (session stores) |

### Store Implementation

```typescript
// apps/web/src/stores/index.ts - Barrel exports
// Session-level stores (30 min TTL)
export { useGlobalSettingsMetadataStore } from './globalSettingsMetadataStore';
export { useDatalabelMetadataStore } from './datalabelMetadataStore';
export { useEntityCodeMetadataStore } from './entityCodeMetadataStore';
export { useEntityComponentMetadataStore } from './entityComponentMetadataStore';

// Short-lived stores (5 min TTL + URL-bound)
export { useEntityInstanceDataStore } from './EntitySpecificInstanceDataStore';
export { useEntityInstanceListDataStore, generateQueryHash } from './EntityListOfInstancesDataStore';

// Other stores
export { useEntityEditStore } from './useEntityEditStore';
```

### Usage in Components

```typescript
// Sidebar Component - Uses 30-min cached entity codes
const Sidebar = () => {
  const { getEntityCodes } = useEntityCodeMetadataStore();
  const entityCodes = getEntityCodes(); // Returns cached data or null if expired

  return (
    <nav>
      {entityCodes?.map(entity => (
        <Link to={`/${entity.code}`}>
          <Icon name={entity.icon} />
          {entity.label}
        </Link>
      ))}
    </nav>
  );
};

// Office List Page - URL-bound instance list
const OfficePage = () => {
  const { entityCode } = useParams();
  const { data, isLoading } = useEntityInstanceList(entityCode, { limit: 50 });
  // Hook automatically:
  // 1. Checks EntityListOfInstancesDataStore for cached data
  // 2. Fetches if expired (>5 min) or URL changed
  // 3. Stores in EntityListOfInstancesDataStore with URL as key

  return <EntityDataTable data={data?.data} metadata={data?.metadata} />;
};

// Office Detail Page - URL-bound instance data
const OfficeDetailPage = () => {
  const { entityCode, id } = useParams();
  const { data, isLoading } = useEntityInstance(entityCode, id);
  // Hook automatically:
  // 1. Checks EntitySpecificInstanceDataStore for cached data
  // 2. Fetches if expired (>5 min) or URL changed
  // 3. Stores in EntitySpecificInstanceDataStore with 'entityCode:id' as key

  return <EntityFormContainer data={data?.data} metadata={data?.metadata} />;
};
```

### Cache Benefits Summary

| Metric | Before Caching | After Caching | Improvement |
|--------|---------------|---------------|-------------|
| **API Calls per Session** | ~200 | ~60 | **70% reduction** |
| **Page Load Time** | 800ms | 150ms | **81% faster** |
| **Metadata Fetches** | Every navigation | Every 30 min | **95% reduction** |
| **Settings Fetches** | Every page | Every 30 min | **95% reduction** |
| **Navigation Speed** | 500ms | <50ms | **90% faster** (cached) |

### URL-Bound Cache Cleanup

```typescript
// Automatic cleanup based on navigation (in useEntityQuery hooks)
useEffect(() => {
  const unsubscribe = navigation.subscribe((location) => {
    const currentPath = location.pathname;
    const previousPath = previousPathRef.current;

    // INVALIDATE URL-bound caches when leaving
    if (previousPath !== currentPath) {
      // Extract entity from previous path
      const prevEntity = extractEntityFromPath(previousPath);
      if (prevEntity) {
        // All URL-bound stores invalidated on URL change
        entityComponentMetadataStore.invalidate(prevEntity);
        EntityListOfInstancesDataStore.invalidate(prevEntity);
        EntitySpecificInstanceDataStore.invalidateEntity(prevEntity);
      }
    }

    // Session stores are NOT invalidated on navigation
    // They are only refreshed on login

    previousPathRef.current = currentPath;
  });

  return unsubscribe;
}, []);
```

### Cache Debugging (Console Logs)

All stores log cache operations with colored output:

```
[GlobalSettingsStore] Storing global settings         (purple)
[GlobalSettingsStore] Cache HIT                       (green)
[GlobalSettingsStore] Cache expired                   (yellow)
[GlobalSettingsStore] Cleared                         (red)

[DatalabelStore] Storing: dl__project_stage           (purple)
[DatalabelStore] Cache HIT: dl__project_stage         (green)

[InstanceDataStore] Storing: project:uuid-123         (blue)
[InstanceDataStore] Cache HIT: project:uuid-123       (green)
[InstanceDataStore] Optimistic update: project:uuid-123 (yellow)
[InstanceDataStore] Invalidated: project:uuid-123     (red)

[ListDataStore] Storing: project:page=1&limit=20      (blue)
[ListDataStore] Cache HIT: project:page=1&limit=20    (green)
[ListDataStore] Invalidating all: project             (red)
```

## Part 3: Step-by-Step Execution Flow

This section provides detailed execution traces showing exactly when and how data flows through the system.

### Hook Execution: How Hooks Get Parameters and When They Run

#### `useEntityInstance` - Complete Execution Trace

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: User Navigation                                                      │
│ User clicks row or enters URL: /project/550e8400-e29b-41d4-a716-446655440000│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: React Router Matches Route                                          │
│                                                                             │
│ // App.tsx or routes.tsx                                                    │
│ <Route path="/:entityCode/:id" element={<EntitySpecificInstancePage />} />            │
│                                                                             │
│ Route pattern: /:entityCode/:id                                             │
│ Actual URL:    /project/550e8400-e29b-41d4-a716-446655440000                │
│ Match result:  { entityCode: 'project', id: '550e8400-...' }                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: EntitySpecificInstancePage Component Mounts                                   │
│                                                                             │
│ // EntitySpecificInstancePage.tsx                                                     │
│ function EntitySpecificInstancePage() {                                               │
│   const { entityCode, id } = useParams();  // ← React Router hook           │
│   // entityCode = 'project'                                                 │
│   // id = '550e8400-e29b-41d4-a716-446655440000'                            │
│                                                                             │
│   const { data, isLoading } = useEntityInstance(entityCode, id);              │
│   // ↓ Hook is called with extracted parameters                             │
│ }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: useEntityInstance Hook Initializes                                    │
│                                                                             │
│ // useEntityQuery.ts                                                        │
│ export function useEntityInstance(entityCode: string, id: string) {           │
│   // Generate cache key from parameters                                     │
│   const queryKey = queryKeys.entityInstance(entityCode, id);                  │
│   // → ['entity-instance', 'project', '550e8400-...']                         │
│                                                                             │
│   return useQuery({                                                         │
│     queryKey,                                                               │
│     queryFn: () => fetchEntityDetail(entityCode, id),                       │
│     staleTime: CACHE_TTL.ENTITY_DETAIL,  // 5 minutes                       │
│     enabled: !!entityCode && !!id,        // Only run if params exist       │
│   });                                                                       │
│ }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 5: React Query Cache Check                                             │
│                                                                             │
│ Query Key: ['entity-instance', 'project', '550e8400-...']                     │
│                                                                             │
│ IF CACHE HIT (data exists && not stale):                                    │
│ ├─→ Return cached data immediately                                          │
│ ├─→ isLoading = false                                                       │
│ ├─→ data = { ... cached entity ... }                                        │
│ └─→ NO API CALL MADE ← Skip to Step 8                                       │
│                                                                             │
│ IF CACHE MISS (no data OR data is stale):                                   │
│ ├─→ isLoading = true                                                        │
│ ├─→ data = undefined                                                        │
│ └─→ Proceed to Step 6                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ (Cache Miss Path)
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 6: API Request Executed                                                │
│                                                                             │
│ // fetchEntityDetail function                                               │
│ async function fetchEntityDetail(entityCode, id) {                          │
│   const url = `/api/v1/${entityCode}/${id}?view=entityFormContainer`;       │
│   // → GET /api/v1/project/550e8400-...?view=entityFormContainer            │
│                                                                             │
│   const response = await fetch(url, {                                       │
│     headers: { Authorization: `Bearer ${token}` }                           │
│   });                                                                       │
│   return response.json();                                                   │
│ }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 7: Response Stored in Cache                                            │
│                                                                             │
│ Cache Key: ['entity-instance', 'project', '550e8400-...']                     │
│ Cache TTL: 5 minutes (CACHE_TTL.ENTITY_DETAIL)                              │
│                                                                             │
│ Cached Data: {                                                              │
│   data: { id: '550e8400-...', name: 'Kitchen Renovation', ... },            │
│   metadata: { fields: [...] },                                              │
│   datalabels: [...]                                                         │
│ }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 8: Component Re-renders with Data                                      │
│                                                                             │
│ function EntitySpecificInstancePage() {                                               │
│   const { data, isLoading } = useEntityInstance(entityCode, id);              │
│   // isLoading = false                                                      │
│   // data = { data: {...}, metadata: {...}, datalabels: [...] }             │
│                                                                             │
│   return (                                                                  │
│     <EntityFormContainer                                                    │
│       data={data?.data}              // Entity fields                       │
│       metadata={data?.metadata}       // Field definitions                  │
│       datalabels={data?.datalabels}   // Dropdown options                   │
│     />                                                                      │
│   );                                                                        │
│ }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### `useEntityInstanceList` - Complete Execution Trace

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: User navigates to /office                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: EntityListOfInstancesPage Component Mounts                                     │
│                                                                             │
│ function EntityListOfInstancesPage() {                                                 │
│   const { entityCode } = useParams();  // entityCode = 'office'             │
│                                                                             │
│   // Build query params from URL search params                              │
│   const [searchParams] = useSearchParams();                                 │
│   const queryParams = {                                                     │
│     limit: searchParams.get('limit') || 50,                                 │
│     offset: searchParams.get('offset') || 0,                                │
│     search: searchParams.get('search'),                                     │
│     // ... other filters                                                    │
│   };                                                                        │
│                                                                             │
│   const { data, isLoading } = useEntityInstanceList(entityCode, queryParams);       │
│ }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: useEntityInstanceList Hook Initializes                                      │
│                                                                             │
│ export function useEntityInstanceList(entityCode, params) {                         │
│   const queryKey = queryKeys.entityInstanceList(entityCode, params);                │
│   // → ['entity-instance-list', 'office', { limit: 50, offset: 0 }]                  │
│                                                                             │
│   return useQuery({                                                         │
│     queryKey,                                                               │
│     queryFn: () => fetchEntityList(entityCode, params),                     │
│     staleTime: CACHE_TTL.ENTITY_LIST,  // 2 minutes                         │
│   });                                                                       │
│ }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: Cache Key Includes Params (Pagination-Aware)                        │
│                                                                             │
│ Different cache entries for different params:                               │
│ • ['entity-instance-list', 'office', {limit:50, offset:0}]   → Page 1                │
│ • ['entity-instance-list', 'office', {limit:50, offset:50}]  → Page 2                │
│ • ['entity-instance-list', 'office', {search:'Toronto'}]     → Filtered              │
│                                                                             │
│ Cache behavior:                                                             │
│ • Each param combination has its own cache entry                            │
│ • Changing filters/page generates new cache key                             │
│ • Previous results remain cached for back navigation                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 5: API Call (if cache miss)                                            │
│                                                                             │
│ GET /api/v1/office?limit=50&offset=0&view=entityDataTable                   │
│                                                                             │
│ Response cached with key ['entity-instance-list', 'office', {...params}]             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Edit Flow: Step-by-Step Save Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ INITIAL STATE                                                               │
│                                                                             │
│ Zustand Edit Store:                                                         │
│ {                                                                           │
│   originalData: { budget_allocated_amt: 50000, name: 'Office A', ... },     │
│   currentData: { budget_allocated_amt: 50000, name: 'Office A', ... },      │
│   dirtyFields: Set([]),                                                     │
│   isEditing: false                                                          │
│ }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: User Clicks "Edit" Button                                           │
│                                                                             │
│ // Component calls:                                                         │
│ startEdit('office', 'uuid-123', currentData);                               │
│                                                                             │
│ Store State After:                                                          │
│ {                                                                           │
│   entityType: 'office',                                                     │
│   entityId: 'uuid-123',                                                     │
│   originalData: { budget_allocated_amt: 50000, ... },                       │
│   currentData: { budget_allocated_amt: 50000, ... },                        │
│   dirtyFields: Set([]),                                                     │
│   undoStack: [],                                                            │
│   redoStack: [],                                                            │
│   isEditing: true  ← Changed                                                │
│ }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: User Changes Budget Field (50000 → 75000)                           │
│                                                                             │
│ // Input onChange triggers:                                                 │
│ updateField('budget_allocated_amt', 75000);                                 │
│                                                                             │
│ Store State After:                                                          │
│ {                                                                           │
│   originalData: { budget_allocated_amt: 50000, ... },  ← Unchanged          │
│   currentData: { budget_allocated_amt: 75000, ... },   ← Updated            │
│   dirtyFields: Set(['budget_allocated_amt']),          ← Tracked            │
│   undoStack: [                                                              │
│     { field: 'budget_allocated_amt', oldValue: 50000, newValue: 75000 }     │
│   ],                                                                        │
│   redoStack: []                                                             │
│ }                                                                           │
│                                                                             │
│ UI Updates:                                                                 │
│ • Field shows orange border (dirty indicator)                               │
│ • "1 unsaved change" appears in toolbar                                     │
│ • Save button becomes enabled                                               │
│ • Undo button becomes enabled                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: User Presses Ctrl+Z (Undo)                                          │
│                                                                             │
│ // Keyboard shortcut handler calls:                                         │
│ undo();                                                                     │
│                                                                             │
│ Store State After:                                                          │
│ {                                                                           │
│   currentData: { budget_allocated_amt: 50000, ... },   ← Reverted           │
│   dirtyFields: Set([]),                                 ← Cleared           │
│   undoStack: [],                                        ← Popped            │
│   redoStack: [                                          ← Pushed            │
│     { field: 'budget_allocated_amt', oldValue: 50000, newValue: 75000 }     │
│   ]                                                                         │
│ }                                                                           │
│                                                                             │
│ UI Updates:                                                                 │
│ • Field reverts to original value                                           │
│ • Dirty indicator removed                                                   │
│ • Undo button disabled, Redo button enabled                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: User Presses Ctrl+Y (Redo) and then Clicks Save                     │
│                                                                             │
│ // redo() restores the change, then saveChanges() is called                 │
│                                                                             │
│ getChanges() returns: { budget_allocated_amt: 75000 }                       │
│ // ↑ Only the changed field, NOT the entire object                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 5: Optimistic Update Applied                                           │
│                                                                             │
│ // Before API call, React Query cache is updated:                           │
│ queryClient.setQueryData(['entity-instance', 'office', 'uuid-123'], old => ({ │
│   ...old,                                                                   │
│   data: { ...old.data, budget_allocated_amt: 75000 }                        │
│ }));                                                                        │
│                                                                             │
│ UI immediately shows new value (no loading state)                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 6: API PATCH Request (Minimal Payload)                                 │
│                                                                             │
│ PATCH /api/v1/office/uuid-123                                               │
│ Content-Type: application/json                                              │
│ Authorization: Bearer <token>                                               │
│                                                                             │
│ Request Body: { "budget_allocated_amt": 75000 }                             │
│ ↑ Only 40 bytes instead of full entity (~5KB)                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                        ┌─────────────┴─────────────┐
                        ▼                           ▼
┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│ STEP 7a: Success Path            │  │ STEP 7b: Error Path               │
│                                  │  │                                  │
│ • API returns 200 OK             │  │ • API returns 4xx/5xx            │
│ • Cache invalidated & refetched  │  │ • Rollback optimistic update     │
│ • Edit mode exited               │  │ • Show error message             │
│ • Store reset                    │  │ • Keep edit mode open            │
│                                  │  │ • User can retry                 │
│ Final Store State:               │  │                                  │
│ {                                │  │ queryClient.setQueryData(        │
│   isEditing: false,              │  │   queryKey, previousData);       │
│   originalData: null,            │  │                                  │
│   currentData: null,             │  │ saveError: 'Failed to save'      │
│   dirtyFields: Set([])           │  │                                  │
│ }                                │  │                                  │
└──────────────────────────────────┘  └──────────────────────────────────┘
```

### Cache Invalidation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ SCENARIO: User saves changes on /office/123, then navigates back to /office │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Save Completes Successfully                                         │
│                                                                             │
│ // After PATCH returns 200:                                                 │
│ queryClient.invalidateQueries({                                             │
│   queryKey: ['entity-instance', 'office', 'uuid-123']                         │
│ });                                                                         │
│                                                                             │
│ // Also invalidate list cache (row may have changed)                        │
│ queryClient.invalidateQueries({                                             │
│   queryKey: ['entity-instance-list', 'office'],                                      │
│   exact: false  // Matches all office list queries (any params)             │
│ });                                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: User Clicks "Back" → Navigates to /office                           │
│                                                                             │
│ EntityListOfInstancesPage mounts with:                                                 │
│ const { data } = useEntityInstanceList('office', { limit: 50 });                    │
│                                                                             │
│ Cache Status:                                                               │
│ • Key ['entity-instance-list', 'office', {...}] was invalidated                      │
│ • isStale = true                                                            │
│ • React Query triggers background refetch                                   │
│                                                                             │
│ Behavior:                                                                   │
│ • Shows stale data immediately (better UX)                                  │
│ • Fetches fresh data in background                                          │
│ • Updates UI when fresh data arrives                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Prefetching Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ User hovers over row in /office list                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: onMouseEnter Event                                                  │
│                                                                             │
│ <tr onMouseEnter={() => prefetch.prefetchDetail('office', row.id)}>         │
│                                                                             │
│ // usePrefetch hook                                                         │
│ prefetchDetail: (entityCode, id) => {                                       │
│   queryClient.prefetchQuery({                                               │
│     queryKey: ['entity-instance', entityCode, id],                            │
│     queryFn: () => fetchEntityDetail(entityCode, id),                       │
│     staleTime: CACHE_TTL.ENTITY_DETAIL                                      │
│   });                                                                       │
│ }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: Background Fetch (User Still Viewing List)                          │
│                                                                             │
│ • API call starts in background                                             │
│ • User sees no loading indicator (still on list page)                       │
│ • Data loads into cache silently                                            │
│                                                                             │
│ GET /api/v1/office/uuid-456?view=entityFormContainer                        │
│ → Response stored in cache                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: User Clicks Row → Navigates to /office/uuid-456                     │
│                                                                             │
│ EntitySpecificInstancePage mounts:                                                    │
│ const { data, isLoading } = useEntityInstance('office', 'uuid-456');          │
│                                                                             │
│ Cache Status:                                                               │
│ • Data already in cache from prefetch!                                      │
│ • isLoading = false (INSTANT)                                               │
│ • No loading spinner shown                                                  │
│                                                                             │
│ Result: Navigation feels instant (<50ms render)                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Settings Exit Invalidation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ User navigates: /office → /settings → edits something → /project            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Enter /settings                                                     │
│                                                                             │
│ // useEffect in App or layout:                                              │
│ if (path.startsWith('/settings')) {                                         │
│   setEnteredSettings(true);                                                 │
│ }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: User Modifies Settings                                              │
│                                                                             │
│ • Changes entity type labels                                                │
│ • Modifies datalabel options                                                │
│ • Updates global configuration                                              │
│                                                                             │
│ (Changes saved to backend)                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: Exit /settings → Navigate to /project                               │
│                                                                             │
│ // useEffect detects settings exit:                                         │
│ if (enteredSettings && !path.startsWith('/settings')) {                     │
│   // Invalidate ALL shared caches (10-min TTL group)                        │
│   queryClient.invalidateQueries({ queryKey: ['entity-codes'] });            │
│   queryClient.invalidateQueries({ queryKey: ['datalabels'] });              │
│   queryClient.invalidateQueries({ queryKey: ['global-settings'] });         │
│                                                                             │
│   // Clear Zustand metadata cache                                           │
│   metadataCache.clearEntityCodes();                                         │
│                                                                             │
│   setEnteredSettings(false);                                                │
│ }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: Fresh Data Loaded for /project                                      │
│                                                                             │
│ • Sidebar refetches entity types (sees new labels)                          │
│ • Datalabels refetched (dropdowns have new options)                         │
│ • Project list fetched fresh                                                │
│                                                                             │
│ Result: Settings changes immediately reflected everywhere                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Summary: When Each Hook Runs

| Hook | Triggered By | Zustand Store | React Query Key | TTL |
|------|--------------|---------------|-----------------|-----|
| `useEntityCodes` | App mount, sidebar render | `entityCodeMetadataStore` | `['entity-codes']` | 30 min |
| `useGlobalSettings` | App mount | `globalSettingsMetadataStore` | `['global-settings']` | 30 min |
| `useAllDatalabels` | App mount | `datalabelMetadataStore` | `['settings', 'datalabels', 'all']` | 30 min |
| `useEntityInstanceList` | Navigate to `/entity` | `EntityListOfInstancesDataStore` | `['entity-instance-list', entityCode, params]` | URL-bound + 5 min |
| `useEntityInstance` | Navigate to `/entity/:id` | `EntitySpecificInstanceDataStore` | `['entity-instance', entityCode, id]` | URL-bound + 5 min |
| `useDatalabels` | Form mount (single datalabel) | `datalabelMetadataStore` | `['datalabels', fieldKey]` | 30 min |
| `useEntityMetadata` | Component mount | `entityComponentMetadataStore` | N/A (Zustand only) | 30 min |
| `useEntityMutation` | Save button click | Triggers invalidation | N/A | - |
| `usePrefetch` | Row hover (optional) | Pre-populates stores | Various | Inherits TTL |
| `useCacheInvalidation` | Settings exit, CRUD ops | All stores | All keys | - |

## Complete Integration

The combination of **9 specialized Zustand stores** and **React Query** provides:

1. **Minimal API Traffic**: Session-level caches (30 min) for metadata, URL-bound (5 min) for data
2. **Instant Navigation**: Cached sidebar, datalabels, and component metadata
3. **Fresh Data Guarantee**: URL-bound caches ensure current data on navigation
4. **Smart Invalidation**: Exit from `/settings/*` triggers full session cache refresh
5. **Optimistic Updates**: `isDirty` flag in `EntitySpecificInstanceDataStore` enables immediate UI feedback
6. **Partial PATCH**: `useEntityEditStore` tracks only changed fields for minimal payloads
7. **Developer Friendly**: Colored console logs, clear store separation, type-safe APIs

### Store Quick Reference

```
SESSION-LEVEL (30 min TTL, SessionStorage, refresh on login):
├── globalSettingsMetadataStore     → App formatting config
├── datalabelMetadataStore          → Dropdown options (dl__*)
└── entityCodeMetadataStore         → Sidebar navigation

URL-BOUND (5 min TTL, SessionStorage, invalidate on URL change):
├── entityComponentMetadataStore    → Field metadata per component
├── EntityListOfInstancesDataStore  → List data (/entity?params)
└── EntitySpecificInstanceDataStore → Single entity + optimistic updates

OTHER (Memory, no TTL):
├── useEntityEditStore              → Edit state, dirty tracking, undo/redo
├── useEntityStore                  → Monolithic entity state (alternative)
└── uiStateStore                    → UI preferences (sidebar, view modes)
```

This architecture scales from simple CRUD to complex enterprise applications while maintaining excellent performance and user experience.

---

*Last Updated: 2025-11-21*
*Version: 4.0.0* - Updated to 9-store architecture with SessionStorage