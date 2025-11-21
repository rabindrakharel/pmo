# UI Component Entity Data Flow

**Version:** 4.0.0 | **Scope:** Frontend data flow from API to UI rendering

---

## Semantics

The UI Component Entity Data Flow describes how data moves from the backend API through frontend components to final rendering. The architecture follows a **metadata-driven rendering** pattern where the backend controls all rendering decisions.

**Core Principle:** Backend sends data + metadata. Frontend renders exactly as instructed.

---

## System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐       │
│  │  Database   │───────> │   Backend   │───────> │  API        │       │
│  │  Tables     │         │  Formatter  │         │  Response   │       │
│  └─────────────┘         └─────────────┘         └─────────────┘       │
│                                                         │               │
│                                                         v               │
│                                            ┌────────────────────┐       │
│                                            │  { data, metadata, │       │
│                                            │    datalabels }    │       │
│                                            └────────────────────┘       │
│                                                         │               │
└─────────────────────────────────────────────────────────│───────────────┘
                                                          │
                                                          v
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    React Query (Cache)                           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│         ┌────────────────────┼────────────────────┐                     │
│         v                    v                    v                     │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐              │
│  │EntityMainPage│     │EntityDetail │     │EntityForm   │              │
│  │   Page      │     │   Page      │     │   Page      │              │
│  └─────────────┘     └─────────────┘     └─────────────┘              │
│         │                    │                    │                     │
│         v                    v                    v                     │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐              │
│  │EntityData   │     │EntityForm   │     │EntityForm   │              │
│  │   Table     │     │ Container   │     │ Container   │              │
│  └─────────────┘     └─────────────┘     └─────────────┘              │
│         │                    │                    │                     │
│         └────────────────────┼────────────────────┘                     │
│                              v                                          │
│                   ┌─────────────────────┐                              │
│                   │ frontEndFormatter   │                              │
│                   │    Service          │                              │
│                   └─────────────────────┘                              │
│                              │                                          │
│                              v                                          │
│                   ┌─────────────────────┐                              │
│                   │   React Elements    │                              │
│                   └─────────────────────┘                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
Step-by-Step Data Flow
──────────────────────

1. USER ACTION
   │
   └── Navigate to /project or click entity link

2. PAGE COMPONENT
   │
   ├── EntityMainPage (list view)
   ├── EntityDetailPage (single view)
   └── EntityFormPage (create/edit)

3. API REQUEST
   │
   └── GET /api/v1/project?view=entityDataTable,kanbanView
       │
       └── Query params specify which components need metadata

4. BACKEND PROCESSING
   │
   ├── Route executes database query
   ├── generateEntityResponse() creates metadata
   ├── extractDatalabelKeys() identifies dropdown fields
   └── fetchDatalabels() loads dropdown options

5. API RESPONSE
   │
   └── { data: [...], metadata: {...}, datalabels: [...] }

6. REACT QUERY CACHE
   │
   └── Caches response for 2 minutes (staleTime)

7. COMPONENT RENDERING
   │
   ├── EntityDataTable uses metadata.fields for columns
   ├── EntityFormContainer uses metadata.fields for form
   └── KanbanView uses metadata for card layout

8. FORMATTER SERVICE
   │
   ├── renderViewModeFromMetadata() for display
   └── renderEditModeFromMetadata() for inputs

9. RENDERED OUTPUT
   │
   └── User sees formatted data (currency, badges, dates, etc.)
```

---

## Architecture Overview

### Page Components

| Component | Route | Purpose |
|-----------|-------|---------|
| EntityMainPage | `/:entityCode` | List view with table/kanban/calendar |
| EntityDetailPage | `/:entityCode/:id` | Single entity detail with child tabs |
| EntityFormPage | `/:entityCode/new`, `/:entityCode/:id/edit` | Create/edit forms |

### Data Components

| Component | Purpose | Data Source |
|-----------|---------|-------------|
| EntityDataTable | Tabular data display | API list endpoint |
| EntityFormContainer | Form fields | API single endpoint |
| KanbanView | Kanban board | API list endpoint |
| CalendarView | Calendar display | API list endpoint |

### Service Layer

| Service | Purpose |
|---------|---------|
| frontEndFormatterService | Pure metadata renderer |
| apiClient | Axios instance with auth |
| React Query | Data fetching and caching |

---

## Tooling Overview

### API Client Configuration

```typescript
// Base configuration
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' }
});

// Auth interceptor adds Bearer token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

### React Query Patterns

| Operation | Hook | Cache Time |
|-----------|------|------------|
| List entities | `useQuery(['entity', code])` | 2 minutes |
| Single entity | `useQuery(['entity', code, id])` | 2 minutes |
| Entity lookup | `useQuery(['entity-lookup', code])` | 5 minutes |
| Datalabels | `useQuery(['datalabel', key])` | 5 minutes |

---

## Database/API/UI Mapping

### Column Name to UI Mapping

| Database Column | API Metadata | UI Component |
|-----------------|--------------|--------------|
| `total_amt` | `renderType: 'currency'` | `$50,000.00` |
| `dl__project_stage` | `renderType: 'badge'` | `<Badge>Planning</Badge>` |
| `start_date` | `renderType: 'date'` | `Jan 15, 2025` |
| `is_active` | `renderType: 'boolean'` | Toggle icon |
| `manager__employee_id` | `renderType: 'reference'` | `John Smith` |

### Entity Config Integration

| entityConfig Field | Purpose | Source |
|-------------------|---------|--------|
| `columns` | Table column definitions | Merged with API metadata |
| `kanban.groupByField` | Kanban column field | `dl__*_stage` fields |
| `supportedViews` | Available view modes | `['table', 'kanban', 'calendar']` |
| `apiEndpoint` | API base URL | `/api/v1/{entityCode}` |

---

## User Interaction Flow

```
View Mode Flow
──────────────

User navigates to /project
        │
        v
EntityMainPage loads
        │
        v
useQuery fetches GET /api/v1/project?view=entityDataTable
        │
        v
Response: { data: [...], metadata: { fields: [...] }, datalabels: [...] }
        │
        v
EntityDataTable receives data + metadata
        │
        v
For each row, for each column:
  renderViewModeFromMetadata(value, fieldMeta)
        │
        v
User sees formatted table


Edit Mode Flow
──────────────

User clicks "Edit" on row
        │
        v
Row enters edit mode (isEditing = true)
        │
        v
For each editable column:
  renderEditModeFromMetadata(value, fieldMeta, onChange)
        │
        v
User modifies values
        │
        v
User clicks "Save"
        │
        v
PATCH /api/v1/project/:id with changed fields
        │
        v
React Query invalidates cache
        │
        v
Table refetches and re-renders


Create Flow
───────────

User clicks "Create New"
        │
        v
Navigate to /project/new
        │
        v
EntityFormPage loads
        │
        v
useQuery fetches GET /api/v1/entity/project/schema
        │
        v
EntityFormContainer renders form
        │
        v
For each field:
  renderEditModeFromMetadata(initialValue, fieldMeta, onChange)
        │
        v
User fills form
        │
        v
User clicks "Save"
        │
        v
POST /api/v1/project with form data
        │
        v
Navigate to /project/:newId
```

---

## Critical Considerations

### Design Principles

1. **Metadata-Driven** - All rendering from backend metadata
2. **Zero Frontend Config** - No hardcoded field types
3. **React Query Caching** - Efficient data fetching
4. **Optimistic Updates** - Immediate UI feedback
5. **Error Boundaries** - Graceful error handling

### Data Flow Rules

| Rule | Description |
|------|-------------|
| Single Source | Backend metadata is the only source of field config |
| Cache First | React Query checks cache before API call |
| Invalidation | Mutations invalidate related queries |
| Datalabel Prefetch | Dropdown options fetched with entity data |

### Component Responsibilities

| Component | Does | Does NOT Do |
|-----------|------|-------------|
| Page | Routing, layout | Field rendering |
| Data Component | Data fetching, state | Field type detection |
| Formatter Service | Render based on metadata | Make rendering decisions |

### Error Handling

| Scenario | Handling |
|----------|----------|
| API 401 | Redirect to login |
| API 403 | Show "Access Denied" message |
| API 404 | Show "Not Found" page |
| API 500 | Show error boundary |
| Network error | Show retry button |

### Performance Optimizations

| Optimization | Implementation |
|--------------|----------------|
| Query caching | staleTime: 2 minutes |
| Debounced search | 300ms debounce on filters |
| Virtualization | Large lists use virtual scrolling |
| Lazy loading | Child tabs load on demand |
| Memoization | Expensive renders use useMemo |

---

**Last Updated:** 2025-11-21 | **Status:** Production Ready
