# State Management Architecture

**Version:** 8.6.0 | **Updated:** 2025-11-28

---

## Overview

The PMO frontend uses **RxDB as the sole state management layer**. All data (entity instances, metadata, drafts) is stored in IndexedDB via RxDB, providing offline-first, persistent storage with reactive queries.

```
+-------------------------------------------------------------------------+
|                    STATE MANAGEMENT (v8.6.0 - RxDB Only)                 |
+-------------------------------------------------------------------------+
|                                                                          |
|  RxDB (IndexedDB) - Single Source of Truth                              |
|  ----------------------------------------------------------------       |
|  - Entity instances (project, task, employee, etc.)                     |
|  - Metadata (field definitions, component schemas)                      |
|  - Reference data (datalabels, entity types)                            |
|  - Drafts (unsaved edits with undo/redo)                                |
|                                                                          |
|  Features:                                                               |
|  - Persistent: Survives browser restart                                 |
|  - Offline-first: Works without network                                 |
|  - Reactive: UI auto-updates via RxJS observables                       |
|  - Multi-tab sync: LeaderElection coordinates tabs                      |
|  - Draft persistence: Unsaved edits survive page refresh                |
|                                                                          |
+-------------------------------------------------------------------------+
```

---

## Data Storage Summary

| Data Type | Collection | TTL | Persists Refresh | Multi-Tab |
|-----------|------------|-----|------------------|-----------|
| **Entity instances** | `entities` | 30s stale | Yes | Yes |
| **Drafts (unsaved edits)** | `drafts` | Until saved | Yes | Yes |
| **Field metadata** | `metadata` | 15 min | Yes | Yes |
| **Datalabels** | `metadata` | 1 hour | Yes | Yes |
| **Entity types** | `metadata` | 1 hour | Yes | Yes |

---

## RxDB Collections

| Collection | Purpose | Schema |
|------------|---------|--------|
| `entities` | All entity instances | `{ entityCode, id, data, refData, metadata, version, syncedAt }` |
| `drafts` | Unsaved edits | `{ entityCode, entityId, originalData, currentData, undoStack, redoStack }` |
| `metadata` | Cached metadata | `{ type, key, data, cachedAt, ttl }` |

---

## RxDB Hooks

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

---

## useRxEntityList Example

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

---

## useRxDraft Example (Draft Persistence)

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

## Data Flow Patterns

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

## File Structure

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
```

---

## App Integration

```tsx
// App.tsx
import { RxDBProvider } from '@/db/rxdb/RxDBProvider';

function App() {
  return (
    <RxDBProvider>
      <AuthProvider>
        <Router>
          {/* App routes */}
        </Router>
      </AuthProvider>
    </RxDBProvider>
  );
}
```

---

## Multi-Tab Sync

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

## Schema Version Management

```typescript
// apps/web/src/db/rxdb/database.ts

// Bump this when schemas have breaking changes
// Forces IndexedDB reset on next load
const SCHEMA_VERSION = 'v4';

// v4: Store full metadata structure (metadata.entityListOfInstancesTable.viewType)
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

## Migration from Zustand (v8.6.0)

### Completed: Metadata Store Migration

All **metadata stores** have been migrated from Zustand to RxDB:

| Former Zustand Store | RxDB Replacement | Status |
|---------------------|------------------|--------|
| `datalabelMetadataStore` | `useRxDatalabel`, `getDatalabelSync` | ✅ Complete |
| `entityCodeMetadataStore` | `useRxEntityCodes`, `getEntityCodesSync` | ✅ Complete |
| `globalSettingsMetadataStore` | `useRxGlobalSettings`, `getGlobalSettingsSync` | ✅ Complete |
| `entityComponentMetadataStore` | `useRxComponentMetadata`, `cacheComponentMetadata` | ✅ Complete |
| `useEntityEditStore` | `useRxDraft` | ✅ Complete |

### Sync Cache Pattern (Non-Hook Access)

For non-hook contexts (formatters, utilities), RxDB provides sync cache functions:

```typescript
// apps/web/src/db/rxdb/hooks/useRxMetadata.ts

// Sync access (for non-hook contexts like formatters)
import { getDatalabelSync, getEntityCodesSync, getGlobalSettingsSync } from '@/db/rxdb';

// Returns cached data or null (populated at login via prefetchAllMetadata)
const options = getDatalabelSync('project_stage');
const entityCodes = getEntityCodesSync();
const settings = getGlobalSettingsSync();

// Hook access (for React components)
import { useRxDatalabel, useRxEntityCodes, useRxGlobalSettings } from '@/db/rxdb';

// React hooks with loading states
const { data: options, isLoading } = useRxDatalabel('project_stage');
```

### Consumer Files Updated

The following files were migrated from Zustand to RxDB:

| File | Change |
|------|--------|
| `AuthContext.tsx` | `prefetchAllMetadata()` replaces Zustand hydration |
| `frontEndFormatterService.tsx` | `getDatalabelSync()` for badge colors |
| `EntityMetadataContext.tsx` | `useRxEntityCodes()` hook |
| `DynamicChildEntityTabs.tsx` | `useRxEntityCodes()` hook |
| `EntityInstanceFormContainer.tsx` | `getDatalabelSync()` for dropdowns |
| `EntityListOfInstancesTable.tsx` | `getDatalabelSync()` for badges |
| `valueFormatters.ts` | `getDatalabelSync()` for colors |
| `garbageCollection.ts` | RxDB handles TTL automatically |
| `useEntityQuery.ts` | RxDB cache invalidation |

### Zustand Migration Complete

All Zustand stores have been migrated to RxDB. The `stores/` directory is empty except for `index.ts` which documents the migration.

**Files Updated (v8.6.0 final):**
| File | Change |
|------|--------|
| `useKeyboardShortcuts.ts` | Accepts draft state via options (no store dependency) |
| `EntitySpecificInstancePage.tsx` | Uses `useRxDraft` for edit state |

---

**Version:** 8.6.0 | **Updated:** 2025-11-28 | **Status:** Production
