# State Management Architecture

**Version:** 8.5.0 | **Updated:** 2025-11-28

---

## Overview

The PMO frontend uses a **layered state management architecture** combining RxDB for persistent entity data with React Query for metadata and Zustand for UI state.

```
+-------------------------------------------------------------------------+
|                    STATE MANAGEMENT LAYERS (v8.5.0)                      |
+-------------------------------------------------------------------------+
|                                                                          |
|  LAYER 1: RxDB (IndexedDB) - Entity Data                                |
|  ----------------------------------------------------------------       |
|  - PRIMARY cache for entity instances (project, task, employee, etc.)   |
|  - Persistent: Survives browser restart                                 |
|  - Offline-first: Works without network                                 |
|  - Reactive: UI auto-updates via RxJS observables                       |
|  - Multi-tab sync: LeaderElection coordinates tabs                      |
|  - Draft persistence: Unsaved edits survive page refresh                |
|                                                                          |
|  LAYER 2: React Query - Metadata & Reference Data                       |
|  ----------------------------------------------------------------       |
|  - Metadata: Field definitions, component schemas (15 min TTL)          |
|  - Reference data: Entity types, datalabels (1 hour TTL)               |
|  - In-memory only (does not persist across browser restart)             |
|                                                                          |
|  LAYER 3: Zustand - UI State Only                                       |
|  ----------------------------------------------------------------       |
|  - Edit mode state (isEditing, dirtyFields)                             |
|  - UI preferences (collapsed panels, selected tabs)                     |
|  - Session-only (cleared on page refresh)                               |
|                                                                          |
+-------------------------------------------------------------------------+
```

---

## Data Storage Summary

| Data Type | Storage | TTL | Persists Refresh | Multi-Tab |
|-----------|---------|-----|------------------|-----------|
| **Entity instances** | RxDB (IndexedDB) | 30s stale | Yes | Yes |
| **Drafts (unsaved edits)** | RxDB (IndexedDB) | Until saved | Yes | Yes |
| **Field metadata** | React Query (memory) | 15 min | No | No |
| **Datalabels** | React Query (memory) | 1 hour | No | No |
| **Entity types** | React Query (memory) | 1 hour | No | No |
| **UI state** | Zustand (memory) | Session | No | No |

---

## 1. RxDB Layer (Entity Data)

### Collections

| Collection | Purpose | Schema |
|------------|---------|--------|
| `entities` | All entity instances | `{ entityCode, id, data, refData, metadata, version, syncedAt }` |
| `drafts` | Unsaved edits | `{ entityCode, entityId, originalData, currentData, undoStack, redoStack }` |
| `metadata` | Cached metadata | `{ type, key, data, cachedAt, ttl }` |

### RxDB Hooks

```typescript
// Direct RxDB hooks (apps/web/src/db/rxdb/hooks/)
import {
  useRxEntity,           // Single entity with reactive updates
  useRxEntityList,       // Entity list with reactive updates
  useRxEntityMutation,   // Create/Update/Delete operations
  useRxDraft,            // Draft persistence with undo/redo
  useRecoverDraft,       // Check for existing draft on page load
} from '@/db/rxdb';
```

### useRxEntityList Example

```typescript
function ProjectList() {
  const {
    data,           // T[] - Entity data from IndexedDB
    refData,        // Reference lookups from API
    metadata,       // Field metadata from API
    isLoading,      // True during initial fetch
    isStale,        // True if cached data > 30s old
    total,          // Total count from API
    refetch,        // Manual refresh function
  } = useRxEntityList<Project>('project', { limit: 50 });

  // Data available immediately from IndexedDB (if cached)
  // Background refresh happens automatically if stale
  return (
    <ul>
      {data.map(project => (
        <li key={project.id}>{project.name}</li>
      ))}
    </ul>
  );
}
```

### useRxDraft Example (Draft Persistence)

```typescript
function ProjectEditor({ projectId }: { projectId: string }) {
  const { data } = useRxEntity<Project>('project', projectId);
  const draft = useRxDraft('project', projectId);

  // Start editing - creates draft in IndexedDB
  const handleStartEdit = () => {
    if (data) draft.startEdit(data);
  };

  // Field change - persisted to IndexedDB immediately!
  const handleFieldChange = (field: string, value: unknown) => {
    draft.updateField(field, value);
    // Survives page refresh!
  };

  // Save changes - only dirty fields sent
  const handleSave = async () => {
    const changes = draft.getChanges();  // { budget_amt: 75000 }
    await api.patch(projectId, changes);
    draft.discardDraft();
  };

  return (
    <form>
      <input
        value={draft.currentData?.name || ''}
        onChange={e => handleFieldChange('name', e.target.value)}
      />
      <button onClick={draft.undo} disabled={!draft.canUndo}>Undo</button>
      <button onClick={draft.redo} disabled={!draft.canRedo}>Redo</button>
      <button onClick={handleSave} disabled={!draft.hasChanges}>Save</button>
    </form>
  );
}
```

---

## 2. React Query Layer (Metadata)

### React Query Hooks

The existing React Query hooks maintain backwards compatibility while using RxDB internally for entity data:

```typescript
// Compatibility layer hooks (apps/web/src/lib/hooks/useEntityQuery.ts)
import {
  useEntityInstanceList,       // RxDB backend, React Query API
  useEntityInstance,           // RxDB backend, React Query API
  useFormattedEntityList,      // RxDB + format-at-read
  useFormattedEntityInstance,  // RxDB + format-at-read
  useEntityMutation,           // RxDB mutations
} from '@/lib/hooks';
```

### Cache TTL Configuration

```typescript
// apps/web/src/lib/hooks/useEntityQuery.ts
export const CACHE_TTL = {
  // Reference data (1 hour) - Rarely changes
  ENTITY_TYPES: 60 * 60 * 1000,
  DATALABELS: 60 * 60 * 1000,
  GLOBAL_SETTINGS: 60 * 60 * 1000,

  // Metadata (15 minutes) - May change with deployments
  ENTITY_METADATA: 15 * 60 * 1000,

  // Entity lists - Stale-while-revalidate
  ENTITY_LIST_STALE: 30 * 1000,   // Mark as stale after 30s
  ENTITY_LIST_CACHE: 5 * 60 * 1000, // Keep for back navigation
};
```

---

## 3. Zustand Layer (UI State)

### Stores

| Store | Purpose | Persists |
|-------|---------|----------|
| `useEntityEditStore` | Edit mode state (isEditing, currentData, dirtyFields) | No |
| `useUIPreferencesStore` | UI preferences (collapsed panels) | No |
| `useNavigationHistoryStore` | Breadcrumb navigation | No |

### useEntityEditStore Example

```typescript
// apps/web/src/stores/useEntityEditStore.ts
const {
  isEditing,      // Boolean - edit mode active
  currentData,    // Current edited values
  dirtyFields,    // Set<string> - modified field keys
  startEdit,      // Begin editing with initial data
  updateField,    // Update a single field
  saveChanges,    // Persist to server
  cancelEdit,     // Discard changes
  undo,           // Undo last change
  redo,           // Redo undone change
} = useEntityEditStore();
```

---

## 4. Data Flow Patterns

### Pattern 1: Initial Load (Cold Cache)

```
User visits /project
    |
    v
useRxEntityList('project')
    |
    +-- RxDB query: db.entities.find({ entityCode: 'project' })
    |   Result: [] (empty)
    |
    +-- Trigger fetch: ReplicationManager.fetchEntityList('project')
    |       |
    |       v
    |   GET /api/v1/project?limit=50
    |       |
    |       v
    |   API Response:
    |   { data: [...], ref_data_entityInstance: {...}, metadata: {...} }
    |       |
    |       v
    |   ReplicationManager stores in RxDB:
    |   db.entities.bulkUpsert([...docs])
    |       |
    |       v
    |   WebSocket SUBSCRIBE sent for loaded entity IDs
    |
    +-- RxDB reactive query emits new value
    |
    v
Component re-renders with data
```

### Pattern 2: Warm Cache (Instant Load)

```
User returns to /project
    |
    v
useRxEntityList('project')
    |
    +-- RxDB query: db.entities.find({ entityCode: 'project' })
    |   Result: [cached docs from IndexedDB]
    |   isLoading = false (instant!)
    |
    +-- Check staleness: (Date.now() - syncedAt) > 30s?
    |   If stale -> background refresh (non-blocking)
    |
    v
Component renders IMMEDIATELY with cached data
```

### Pattern 3: Real-Time Update (WebSocket)

```
User B edits project
    |
    v
API Server:
1. RBAC check (EDIT permission)
2. UPDATE app.project SET ...
3. DB trigger -> INSERT app.logging (sync_status='pending')
4. Return 200 OK to User B
    |
    | (up to 60s later)
    v
PubSub LogWatcher polls app.logging
    |
    +-- Query app.rxdb_subscription for subscribers
    +-- Push INVALIDATE via WebSocket to User A
    |
    v
User A's ReplicationManager receives INVALIDATE
    |
    +-- Refetch: GET /api/v1/project/:id
    +-- RxDB upsert with fresh data
    |
    v
RxDB reactive query emits -> UI auto-updates
```

### Pattern 4: Draft Persistence

```
User starts editing
    |
    v
useRxDraft('project', projectId)
    |
    +-- Create draft in RxDB drafts collection
    |   { originalData, currentData, undoStack: [], redoStack: [] }
    |
    v
User modifies field
    |
    +-- draft.updateField('budget_amt', 75000)
    +-- RxDB upsert (persisted to IndexedDB immediately!)
    |
    v
User refreshes page (or browser restarts!)
    |
    v
useRecoverDraft('project', projectId)
    |
    +-- Query RxDB: db.drafts.findOne({ entityCode, entityId })
    +-- Found! Prompt user: "Recover unsaved changes?"
    |
    +-- Yes: Restore draft.currentData
    +-- No: draft.discardDraft()
```

---

## 5. File Structure

```
apps/web/src/
+-- db/rxdb/                          # RxDB implementation
|   +-- database.ts                   # Database creation + schema version
|   +-- replication.ts                # WebSocket sync (ReplicationManager)
|   +-- RxDBProvider.tsx              # React context provider
|   +-- index.ts                      # Module exports
|   +-- schemas/
|   |   +-- entity.schema.ts          # Entity collection schema
|   |   +-- draft.schema.ts           # Draft collection schema
|   |   +-- metadata.schema.ts        # Metadata collection schema
|   +-- hooks/
|       +-- useRxEntity.ts            # useRxEntity, useRxEntityList
|       +-- useRxDraft.ts             # useRxDraft, useRecoverDraft
|
+-- lib/hooks/
|   +-- useEntityQuery.ts             # React Query compatibility layer
|
+-- stores/
    +-- useEntityEditStore.ts         # Zustand edit state
    +-- datalabelMetadataStore.ts     # Datalabel cache
    +-- entityComponentMetadataStore.ts # Metadata cache
    +-- globalSettingsMetadataStore.ts # Settings cache
```

---

## 6. App Integration

```tsx
// App.tsx
import { RxDBProvider } from '@/db/rxdb/RxDBProvider';
import { QueryClientProvider } from '@tanstack/react-query';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RxDBProvider>
        <AuthProvider>
          <Router>
            {/* App routes */}
          </Router>
        </AuthProvider>
      </RxDBProvider>
    </QueryClientProvider>
  );
}
```

---

## 7. Multi-Tab Sync

RxDB's LeaderElection plugin ensures only one tab manages replication:

```
Tab 1 (Leader)                    Tab 2 (Follower)
---------------------------------------------------
+---------------+                  +---------------+
| RxDB + WS     | ---IndexedDB---> |    RxDB       |
| Replication   |                  |  (reactive)   |
+---------------+                  +---------------+
       |                                 |
       +---- Both see same data ---------+
```

- Leader tab handles WebSocket connection
- All tabs share IndexedDB storage
- Changes in one tab instantly visible in others

---

## 8. Schema Version Management

```typescript
// apps/web/src/db/rxdb/database.ts

// Bump this when schemas have breaking changes
// Forces IndexedDB reset on next load
const SCHEMA_VERSION = 'v4';

// v4: Store full metadata structure (metadata.entityDataTable.viewType)
// v3: Fixed metadata storage format
// v2: Added draft persistence
// v1: Initial RxDB implementation
```

---

## Related Documents

| Document | Purpose |
|----------|---------|
| `docs/caching/RXDB_SYNC_ARCHITECTURE.md` | WebSocket sync + PubSub architecture |
| `docs/ui_page/PAGE_ARCHITECTURE.md` | Page components and routing |
| `CLAUDE.md` | Main codebase reference |

---

**Version:** 8.5.0 | **Updated:** 2025-11-28 | **Status:** Production
