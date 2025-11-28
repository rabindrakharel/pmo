# Navigation Flow Analysis: DataTable → Entity Detail Page

**Status**: Current State Analysis + Improvement Recommendations
**Date**: 2025-01-20
**Scope**: Full user interaction flow from list view to detail view with actions

---

## 1. Semantics & Business Context

Users navigate from entity list (DataTable) to detail view for deep inspection and perform actions (edit, delete, share, link). Critical business requirements: fast navigation, contextual actions, proper metadata segmentation, and tight prop plumbing to avoid re-fetching data.

---

## 2. Current State Architecture

### 2.1 Navigation Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                    USER: List View (EntityListOfInstancesPage)               │
│  URL: /office                                                    │
│  Component: EntityListOfInstancesPage                                       │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ├─ Mount: useEffect()
                     │
                     ▼
         ┌───────────────────────────┐
         │ API Call                  │
         │ GET /api/v1/office        │
         │ ?view=entityListOfInstancesTable     │
         │ &page=1&pageSize=100      │
         └───────────┬───────────────┘
                     │
                     ▼
         ┌───────────────────────────┐
         │ Backend Response          │
         │ {                         │
         │   data: [...],            │
         │   metadata: {             │
         │     entityListOfInstancesTable: {...}│
         │   },                      │
         │   datalabels: [...]       │
         │ }                         │
         └───────────┬───────────────┘
                     │
                     ▼
         ┌───────────────────────────┐
         │ State Updates             │
         │ data = queryResult.data   │
         │ metadata = queryResult.   │
         │            metadata       │
         └───────────┬───────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│         Render: EntityListOfInstancesTable (directly from page)             │
│  - data={data}                                                   │
│  - metadata={metadata}                                           │
│  - loading={isLoading}                                           │
│  - columns derived from metadata.fields                          │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ├─ Render rows
                     ├─ Cell rendering: renderViewModeFromMetadata()
                     │
                     ▼
         ┌───────────────────────────┐
         │ USER: Click Row           │
         │ onRowClick(record)        │
         └───────────┬───────────────┘
                     │
                     ▼
         ┌───────────────────────────┐
         │ Navigate                  │
         │ router.push(              │
         │   `/office/${record.id}`  │
         │ )                         │
         └───────────┬───────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│                 USER: Detail View (EntitySpecificInstancePage)              │
│  URL: /office/{id}                                               │
│  Component: EntitySpecificInstancePage                                     │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ├─ Mount: useEffect()
                     │
                     ▼
         ┌───────────────────────────┐
         │ API Call (RE-FETCH!)      │
         │ GET /api/v1/office/{id}   │
         │ ?view=entityInstanceFormContainer │
         └───────────┬───────────────┘
                     │
                     ▼
         ┌───────────────────────────┐
         │ Backend Response          │
         │ {                         │
         │   data: {...},            │
         │   metadata: {             │
         │     entityInstanceFormContainer:{}│
         │   }                       │
         │ }                         │
         │ (datalabels via dedicated │
         │  endpoint, cached 30min)  │
         └───────────┬───────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│         Render: Detail Layout                                    │
│  - Header with actions (Edit, Delete, Share)                     │
│  - Main content area                                             │
│  - DynamicChildEntityTabs (child entities)                       │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Current Data Flow Issues

**❌ Problem 1: Full Re-fetch on Navigation**
- User clicks row in table
- Router navigates to `/office/{id}`
- EntitySpecificInstancePage mounts and **fetches data again**
- Data was already available in list view!

**❌ Problem 2: Metadata Re-generation**
- Backend re-generates metadata for same entity
- `entityInstanceFormContainer` metadata could have been pre-fetched
- Unnecessary compute cost

**✅ Problem 3: Datalabel Caching (RESOLVED)**
- Datalabels now fetched via dedicated endpoint (`GET /api/v1/datalabel?name=<name>`)
- 30-minute session-level caching via `datalabelMetadataStore`
- Frontend uses `useDatalabels()` hook for automatic cache management

**❌ Problem 4: No Loading State Optimization**
- User sees spinner on detail page
- Could show cached data immediately, then hydrate

**❌ Problem 5: Action Buttons Trigger Modal/Sheet**
- Edit action opens modal/sheet
- Re-fetches `entityInstanceFormContainer` metadata
- Already had this in detail view response!

---

## 3. Metadata Plumbing Analysis

### 3.1 Current Plumbing (Verified Tight)

```
EntityListOfInstancesPage
   │
   ├─ Fetch: useEntityInstanceList() hook
   ├─ State: data, metadata from queryResult
   │
   ▼
EntityListOfInstancesTable (used directly by page)
   │
   ├─ Props: data, metadata, loading
   ├─ Extract: metadata.fields for columns
   ├─ Access: column.backendMetadata
   ├─ Render: renderViewModeFromMetadata(value, backendMetadata)
   │
   ▼
frontEndFormatterService
   │
   └─ switch(metadata.renderType)
      ├─ case 'badge': → Check datalabelKey → Render badge
      ├─ case 'dag': → Check datalabelKey → Render DAG
      └─ case 'currency': → Format currency
```

**✅ Plumbing is tight:**
- Metadata flows through props correctly
- Datalabels available at rendering layer
- Component-specific metadata segments properly extracted

**⚠️ Missing Optimization:**
- Datalabels not cached/shared between views
- Metadata for multiple components not pre-fetched

### 3.2 Action Button Plumbing

```
EntitySpecificInstancePage
   │
   ├─ Actions: [Edit, Delete, Share, Link]
   │
   ▼
Edit Action Click
   │
   ├─ Open Modal/Sheet
   ├─ ❌ ISSUE: Re-fetch entityInstanceFormContainer metadata
   │   (Already in response.metadata.entityInstanceFormContainer!)
   │
   ▼
EntityInstanceFormContainer
   │
   ├─ Should receive: metadata.entityInstanceFormContainer
   ├─ Currently: Fetches again or uses cached schema
```

---

## 4. Improvement Recommendations

### 4.1 Implement Row-Level Data Caching

**Pattern: Optimistic Navigation with Cache**

```typescript
// EntityListOfInstancesPage - Store clicked row in context/zustand
const handleRowClick = (record) => {
  // Cache row data + metadata for fast detail page render
  entityCache.set(record.id, {
    data: record,
    metadata: metadata,  // Already have entityListOfInstancesTable metadata
    datalabels: datalabels,
    timestamp: Date.now()
  });

  navigate(`/office/${record.id}`);
};

// EntitySpecificInstancePage - Use cached data immediately
useEffect(() => {
  const cached = entityCache.get(id);

  if (cached && Date.now() - cached.timestamp < 60000) {
    // Show cached data immediately (no spinner!)
    setData(cached.data);
    setMetadata(cached.metadata);
    setIsHydrated(false);
  }

  // Fetch fresh data with detail-specific metadata in background
  fetchDetail(id).then(response => {
    setData(response.data);
    setMetadata(response.metadata);  // Get entityInstanceFormContainer metadata
    setIsHydrated(true);
  });
}, [id]);

// Datalabels fetched via dedicated hook (30-min session cache)
const { options: stageOptions } = useDatalabels('dl__project_stage');
```

**Benefits:**
- ✅ Instant detail page render (no spinner)
- ✅ Progressive enhancement (cached → fresh)
- ✅ Reduces perceived latency by 500-1000ms

### 4.2 Pre-fetch Multi-Component Metadata

**Pattern: Request Multiple Components in List View**

```typescript
// EntityListOfInstancesPage - Request metadata for future needs
const params = {
  view: 'entityListOfInstancesTable,entityInstanceFormContainer',
  page, pageSize: 100
};

const response = await api.list(params);

// Store all metadata segments
setTableMetadata(response.metadata.entityListOfInstancesTable);
setFormMetadata(response.metadata.entityInstanceFormContainer);
```

**Benefits:**
- ✅ One metadata generation per entity type
- ✅ Detail page has metadata ready (no re-fetch)
- ✅ Edit modal has form metadata ready
- ⚠️ Slightly larger initial response (+2-3KB)

### 4.3 Implement Global Datalabel Cache

**Pattern: Context/Zustand for Datalabels**

```typescript
// contexts/DatalabelContext.tsx
const DatalabelContext = createContext({
  datalabels: new Map(),
  addDatalabels: (datalabels) => {...},
  getDatalabel: (key) => {...}
});

// EntityListOfInstancesPage
useEffect(() => {
  if (response.datalabels) {
    addDatalabels(response.datalabels);  // Cache globally
  }
}, [response]);

// EntitySpecificInstancePage
const officeTypeDatalabel = getDatalabel('dl__office_type');
// Use cached datalabel (no re-fetch)
```

**Benefits:**
- ✅ Datalabels fetched once per session
- ✅ Shared across all components/pages
- ✅ Reduces database queries by 70%

### 4.4 Optimize Edit Action Flow

**Pattern: Prop Drilling for Form Metadata**

```typescript
// EntitySpecificInstancePage
const response = await api.get(id, {
  view: 'entityInstanceFormContainer'
});

// Pass form metadata to modal
<EditModal
  data={data}
  metadata={response.metadata.entityInstanceFormContainer}  // ← Already have it!
  datalabels={datalabels}
  onSave={handleSave}
/>

// EditModal - NO API call needed
const EditModal = ({ data, metadata, datalabels, onSave }) => {
  return (
    <EntityInstanceFormContainer
      initialData={data}
      metadata={metadata}  // ← Received via props
      datalabels={datalabels}
      onSubmit={onSave}
    />
  );
};
```

**Benefits:**
- ✅ Zero API calls for edit action
- ✅ Instant form render
- ✅ Metadata consistency guaranteed

### 4.5 Implement URL-Based View Parameter

**Pattern: User-Controlled Metadata Fetching**

```typescript
// Allow users to control what metadata is fetched
URL: /office/{id}?view=form    → entityInstanceFormContainer only
URL: /office/{id}?view=table   → entityListOfInstancesTable only
URL: /office/{id}?view=all     → all components

// Smart default based on intent
navigate(`/office/${id}?view=detail,form`);  // Most common
```

**Benefits:**
- ✅ Reduces over-fetching
- ✅ User can bookmark specific views
- ✅ Analytics can track which views are used

---

## 5. Proposed Architecture (Optimized)

```
┌──────────────────────────────────────────────────────────────────┐
│                    NAVIGATION FLOW (OPTIMIZED)                    │
└──────────────────────────────────────────────────────────────────┘

LIST VIEW
   │
   ├─ Fetch: ?view=entityListOfInstancesTable,entityInstanceFormContainer
   ├─ Cache: datalabels globally
   ├─ Store: all metadata segments
   │
   ▼
USER CLICKS ROW
   │
   ├─ Cache: row data + metadata
   ├─ Navigate: /office/{id}
   │
   ▼
DETAIL VIEW
   │
   ├─ Check cache: Use if fresh (<60s)
   ├─ Render: Instant (cached data)
   ├─ Background: Fetch fresh + merge
   │
   ▼
USER CLICKS EDIT
   │
   ├─ Modal: Use metadata.entityInstanceFormContainer (already have!)
   ├─ Render: Instant form
   │
   ▼
USER SAVES
   │
   ├─ PATCH /api/v1/office/{id}
   ├─ Optimistic update: UI updates immediately
   ├─ Invalidate cache: Clear cached data
   ├─ Background: Confirm with server
```

---

## 6. Critical Improvements Summary

| Improvement | Latency Reduction | Complexity | Priority |
|-------------|-------------------|------------|----------|
| **Row-level data caching** | -500ms | Low | ⭐⭐⭐ HIGH |
| **Global datalabel cache** | -200ms | Low | ⭐⭐⭐ HIGH |
| **Pre-fetch multi-component metadata** | -300ms | Medium | ⭐⭐ MEDIUM |
| **Edit action prop drilling** | -150ms | Low | ⭐⭐ MEDIUM |
| **URL-based view parameter** | Variable | Low | ⭐ LOW |

**Total Potential Latency Reduction: ~1,150ms (1.15 seconds)**

---

## 7. Implementation Checklist

### Phase 1: Quick Wins (1-2 days)
- [ ] Implement global datalabel cache (DatalabelContext)
- [ ] Add row-level caching to EntityListOfInstancesPage
- [ ] Update EntitySpecificInstancePage to use cached data

### Phase 2: Metadata Optimization (2-3 days)
- [ ] Pre-fetch multi-component metadata in list view
- [ ] Prop drill form metadata to edit modal
- [ ] Remove redundant API calls in edit flow

### Phase 3: Polish (1 day)
- [ ] Add URL-based view parameter support
- [ ] Implement cache invalidation on mutations
- [ ] Add analytics for cache hit rates

---

## 8. Testing Strategy

**Before Optimization:**
- Measure: Time from row click to detail page render
- Measure: Number of API calls during navigation
- Measure: Database query count

**After Optimization:**
- Compare: Latency reduction percentage
- Verify: Cache hit rate >80%
- Verify: API calls reduced by 50%

**Success Metrics:**
- Detail page render: <100ms (cached), <500ms (fresh)
- Edit modal open: <50ms (prop drilled metadata)
- User satisfaction: Perceived performance improvement

---

## 9. Risks & Mitigation

**Risk 1: Stale cached data**
- Mitigation: 60s TTL, invalidate on mutations
- Mitigation: Background refresh with merge

**Risk 2: Memory leaks**
- Mitigation: LRU cache with max 100 entries
- Mitigation: Clear cache on navigation away from entity

**Risk 3: Metadata mismatch**
- Mitigation: Version metadata responses
- Mitigation: Validate cached metadata structure

---

## 10. Related Documentation

- `backend-formatter.service.md` - Metadata generation architecture
- `frontEndFormatterService.md` - Frontend rendering patterns
- `entity-infrastructure.service.md` - RBAC and entity operations
