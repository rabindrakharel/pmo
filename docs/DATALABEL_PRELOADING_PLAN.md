# Datalabel Preloading & Enhanced Metadata Architecture Plan

> **Goal**: Move datalabel fetching from frontend to backend, eliminate redundant API calls, and enhance metadata field visualization

**Status**: 📋 Planning Phase
**Priority**: High
**Complexity**: Medium
**Estimated Effort**: 2-3 days

---

## Executive Summary

### Current Issues

1. **Heavy Frontend Lifting**: DAGVisualizer makes separate API calls to fetch datalabel data
   - API call: `GET /api/v1/setting?datalabel=project_stage&raw=true`
   - Happens on every component render
   - Multiple components = multiple identical API calls

2. **Metadata Field Visualization**: Already solved! ✅
   - MetadataTable component exists and works perfectly
   - Integrated in EntityFormContainer
   - No changes needed

### Proposed Solution

**Backend Enhancement**: Include datalabel data in initial API response

```typescript
// Current response structure
{
  data: [...],
  metadata: { entity, fields },
  total, limit, offset
}

// Enhanced response structure (NEW)
{
  data: [...],
  metadata: { entity, fields },
  datalabels: [                    // ✅ NEW FIELD
    {
      name: 'project_stage',
      options: [
        { id: 1, name: 'Planning', parent_id: null, sort_order: 1, color_code: 'blue' },
        { id: 2, name: 'Execution', parent_id: 1, sort_order: 2, color_code: 'yellow' },
        { id: 3, name: 'Completed', parent_id: 2, sort_order: 3, color_code: 'green' }
      ]
    }
  ],
  total, limit, offset
}
```

### Benefits

1. ✅ **Reduced API Calls**: From N+1 to 1 (where N = number of DAGVisualizers)
2. ✅ **Faster Rendering**: No loading states for DAGVisualizer
3. ✅ **Consistent Data**: All components use same datalabel data
4. ✅ **Backend Control**: Backend decides what datalabel data to include
5. ✅ **Better Caching**: Server-side caching more efficient than client-side

---

## Current State Analysis

### ✅ Metadata Field Visualization (COMPLETE)

**Component**: `apps/web/src/components/shared/entity/MetadataTable.tsx`

**Status**: ✅ **FULLY IMPLEMENTED** - No changes needed

**Features**:
- View mode: Structured key-value table
- Edit mode: Inline editing with type detection
- Add/delete key-value pairs
- Type detection (boolean, number, object, string)
- Integrated in EntityFormContainer

**Integration**:
```typescript
// EntityFormContainer.tsx:608
if (field.key === 'metadata') {
  return <MetadataTable value={value || {}} isEditing={false} />;
}

// EntityFormContainer.tsx:700
if (field.key === 'metadata') {
  return (
    <MetadataTable
      value={value || {}}
      onChange={(newValue) => handleFieldChange(field.key, newValue)}
      isEditing={true}
    />
  );
}
```

**Recommendation**: ✅ **NO CHANGES NEEDED** - Already perfect!

---

### ⚠️ DAGVisualizer Datalabel Fetching (NEEDS OPTIMIZATION)

**Component**: `apps/web/src/components/workflow/DAGVisualizer.tsx`

**Current Behavior** (lines 115-165):
1. Auto-detects stage field: `dl__project_stage`
2. Makes API call: `GET /api/v1/setting?datalabel=dl__project_stage&raw=true`
3. Parses response into DAGNode structure
4. Renders DAG visualization

**Problem**:
- **N+1 Query Problem**: Each DAGVisualizer makes its own API call
- **Redundant Requests**: Multiple components fetch same datalabel data
- **Loading States**: Each visualizer shows loading independently
- **Cache Complexity**: Frontend must cache datalabel data

**Example Scenario**:
```
EntityMainPage (table view)
  ├─ Row 1: DAGVisualizer (project_stage) → API call #1
  ├─ Row 2: DAGVisualizer (project_stage) → API call #2
  ├─ Row 3: DAGVisualizer (project_stage) → API call #3
  └─ Row 4: DAGVisualizer (project_stage) → API call #4

Total: 4 API calls for same datalabel!
```

---

## Proposed Architecture

### Backend: Datalabel Preloader Service

**New Service**: `apps/api/src/services/datalabel-preloader.service.ts`

**Responsibilities**:
1. Scan entity metadata fields for datalabel fields (`dl__*`)
2. Extract unique datalabel names
3. Fetch all datalabel options in single/batch query
4. Cache datalabel data (5-minute TTL)
5. Return structured datalabel data

**API**:
```typescript
interface DatalabelOption {
  id: number;
  name: string;
  descr?: string;
  parent_id: number | null;
  sort_order: number;
  color_code: string;
  active_flag: boolean;
}

interface DatalabelData {
  name: string;         // e.g., 'project_stage'
  options: DatalabelOption[];
}

class DatalabelPreloaderService {
  /**
   * Extract datalabel fields from entity metadata
   */
  extractDatalabelFields(metadata: EntityMetadata): string[];

  /**
   * Fetch all datalabel options for given datalabel names
   * Uses single query with WHERE IN clause for efficiency
   */
  async fetchDatalabels(datalabelNames: string[]): Promise<DatalabelData[]>;

  /**
   * Main entry point: Get datalabels for entity response
   */
  async getDatalabelsForResponse(metadata: EntityMetadata): Promise<DatalabelData[]>;
}
```

---

### Backend: Enhanced Backend Formatter Service

**File**: `apps/api/src/services/backend-formatter.service.ts`

**Enhancement**: Detect DAG fields and mark for datalabel preloading

```typescript
// Current detection (already exists)
if (columnKey.startsWith('dl__')) {
  return {
    key: columnKey,
    label: formatLabel(columnKey),
    renderType: 'badge',
    inputType: 'select',
    loadFromDataLabels: true,
    settingsDatalabel: columnKey,
    // ...
  };
}

// Enhanced detection (NEW)
if (columnKey.startsWith('dl__') && (columnKey.includes('stage') || columnKey.includes('status'))) {
  return {
    key: columnKey,
    label: formatLabel(columnKey),
    renderType: 'dag',              // ✅ NEW: DAG visualization
    component: 'DAGVisualizer',      // ✅ NEW: Component hint
    inputType: 'select',
    loadFromDataLabels: true,
    settingsDatalabel: columnKey,
    requiresDatalabelData: true,     // ✅ NEW: Flag for preloading
    // ...
  };
}
```

---

### Backend: Enhanced Response Structure

**Helper**: `apps/api/src/lib/universal-schema-metadata.ts` or new helper

**Enhancement**: Include datalabels in response

```typescript
import { getDatalabelPreloader } from '../services/datalabel-preloader.service.js';

// Current function
export function createPaginatedResponse(data: any[], total: number, limit: number, offset: number) {
  return {
    data,
    total,
    limit,
    offset
  };
}

// Enhanced function (NEW)
export async function createEnhancedPaginatedResponse(
  data: any[],
  metadata: EntityMetadata,
  total: number,
  limit: number,
  offset: number
) {
  const preloader = getDatalabelPreloader();

  // Extract datalabel fields from metadata
  const datalabelFields = metadata.fields.filter(f => f.requiresDatalabelData);
  const datalabelNames = datalabelFields.map(f => f.settingsDatalabel!);

  // Fetch datalabels if any detected
  let datalabels: DatalabelData[] = [];
  if (datalabelNames.length > 0) {
    datalabels = await preloader.fetchDatalabels(datalabelNames);
  }

  return {
    data,
    metadata,
    datalabels,  // ✅ NEW FIELD
    total,
    limit,
    offset
  };
}
```

---

### Backend: Route Integration

**Example**: `apps/api/src/modules/project/routes.ts`

```typescript
// Current implementation (4 integrated routes)
fastify.get('/api/v1/project', async (request, reply) => {
  // ... fetch data ...

  const fieldMetadata = projects.length > 0
    ? getEntityMetadata(ENTITY_CODE, projects[0])
    : getEntityMetadata(ENTITY_CODE);

  return {
    ...createPaginatedResponse(projects, total, limit, offset),
    metadata: fieldMetadata
  };
});

// Enhanced implementation (NEW)
fastify.get('/api/v1/project', async (request, reply) => {
  // ... fetch data ...

  const fieldMetadata = projects.length > 0
    ? getEntityMetadata(ENTITY_CODE, projects[0])
    : getEntityMetadata(ENTITY_CODE);

  // ✅ NEW: Use enhanced response with datalabels
  return createEnhancedPaginatedResponse(
    projects,
    fieldMetadata,
    total,
    limit,
    offset
  );
});
```

---

### Frontend: Enhanced API Response Handling

**Files to Update**:
1. `apps/web/src/lib/api.ts` - Type definitions
2. `apps/web/src/pages/shared/EntityMainPage.tsx` - Extract datalabels
3. `apps/web/src/pages/shared/EntityDetailPage.tsx` - Extract datalabels
4. `apps/web/src/components/shared/dataTable/FilteredDataTable.tsx` - Pass datalabels
5. `apps/web/src/components/workflow/DAGVisualizer.tsx` - Accept preloaded datalabels

**Type Definitions**: `apps/web/src/lib/api.ts`

```typescript
// Enhanced response types
export interface DatalabelOption {
  id: number;
  name: string;
  descr?: string;
  parent_id: number | null;
  sort_order: number;
  color_code: string;
  active_flag: boolean;
}

export interface DatalabelData {
  name: string;
  options: DatalabelOption[];
}

export interface EnhancedEntityResponse<T = any> {
  data: T[];
  metadata?: EntityMetadata;
  datalabels?: DatalabelData[];  // ✅ NEW
  total: number;
  limit: number;
  offset: number;
}
```

---

### Frontend: EntityMainPage Enhancement

**File**: `apps/web/src/pages/shared/EntityMainPage.tsx`

```typescript
// Current state
const [metadata, setMetadata] = useState<EntityMetadata | null>(null);

// Enhanced state (NEW)
const [metadata, setMetadata] = useState<EntityMetadata | null>(null);
const [datalabels, setDatalabels] = useState<DatalabelData[]>([]);  // ✅ NEW

// Current extraction
if (!append && response.metadata) {
  setMetadata(response.metadata);
}

// Enhanced extraction (NEW)
if (!append) {
  if (response.metadata) {
    setMetadata(response.metadata);
  }
  if (response.datalabels) {    // ✅ NEW
    setDatalabels(response.datalabels);
  }
}

// Pass to FilteredDataTable
<FilteredDataTable
  entityCode={entityCode}
  metadata={metadata}
  datalabels={datalabels}  // ✅ NEW
  showActionButtons={false}
  // ...
/>
```

---

### Frontend: FilteredDataTable Enhancement

**File**: `apps/web/src/components/shared/dataTable/FilteredDataTable.tsx`

```typescript
interface FilteredDataTableProps {
  // ... existing props
  metadata?: EntityMetadata | null;
  datalabels?: DatalabelData[];  // ✅ NEW
}

export function FilteredDataTable({
  // ... existing props
  metadata: propsMetadata,
  datalabels: propsDatalabels  // ✅ NEW
}) {
  const [metadata, setMetadata] = useState<EntityMetadata | null>(propsMetadata || null);
  const [datalabels, setDatalabels] = useState<DatalabelData[]>(propsDatalabels || []);  // ✅ NEW

  // Extract from API response
  useEffect(() => {
    // ... existing metadata extraction

    if (!propsDatalabels && result.datalabels) {  // ✅ NEW
      setDatalabels(result.datalabels);
    }
  }, [propsDatalabels]);

  // Pass to EntityDataTable
  return (
    <EntityDataTable
      data={data}
      metadata={metadata}
      datalabels={datalabels}  // ✅ NEW
      // ...
    />
  );
}
```

---

### Frontend: EntityDataTable Enhancement

**File**: `apps/web/src/components/shared/ui/EntityDataTable.tsx`

```typescript
interface EntityDataTableProps<T = any> {
  data: T[];
  metadata?: EntityMetadata | null;
  datalabels?: DatalabelData[];  // ✅ NEW
  // ... other props
}

export function EntityDataTable<T = any>({
  data,
  metadata,
  datalabels = [],  // ✅ NEW
  // ... other props
}) {
  // Create datalabel lookup map for O(1) access
  const datalabelMap = useMemo(() => {
    const map = new Map<string, DatalabelOption[]>();
    datalabels.forEach(dl => {
      map.set(dl.name, dl.options);
    });
    return map;
  }, [datalabels]);

  // Pass to renderers via context or props
  // Option 1: Via context (recommended)
  const contextValue = useMemo(() => ({
    datalabelMap
  }), [datalabelMap]);

  return (
    <DatalabelContext.Provider value={contextValue}>
      {/* ... existing table rendering */}
    </DatalabelContext.Provider>
  );
}
```

---

### Frontend: DAGVisualizer Enhancement

**File**: `apps/web/src/components/workflow/DAGVisualizer.tsx`

```typescript
interface DAGVisualizerProps {
  data?: Record<string, any>;
  stageField?: string;
  datalabelOptions?: DatalabelOption[];  // ✅ NEW: Preloaded datalabel data
  // ... other props
}

export function DAGVisualizer({
  data,
  stageField: explicitStageField,
  datalabelOptions,  // ✅ NEW
  // ... other props
}: DAGVisualizerProps) {
  // Priority 1: Use preloaded datalabel data (NEW)
  useEffect(() => {
    if (datalabelOptions && datalabelOptions.length > 0) {
      // ✅ No API call needed!
      const nodes = transformDatalabelToDAGNodes(datalabelOptions);
      setAutoNodes(nodes);

      // Set current node based on data value
      if (data && stageFieldKey) {
        const currentValue = data[stageFieldKey];
        const currentNode = datalabelOptions.find(opt => opt.name === currentValue);
        setAutoCurrentNodeId(currentNode?.id);
      }

      setIsGenerating(false);
      return;  // ✅ Exit early - no API call
    }

    // Priority 2: Fallback to API call (legacy mode)
    if (!datalabelOptions) {
      // ... existing API call logic (kept for backward compatibility)
      const loadDAGStructure = async () => {
        // ... existing implementation
      };
      loadDAGStructure();
    }
  }, [datalabelOptions, data, stageFieldKey]);

  // ... rest of component
}
```

---

### Frontend: Frontend Formatter Service Enhancement

**File**: `apps/web/src/lib/frontEndFormatterService.tsx`

```typescript
// Enhanced renderViewModeFromMetadata
export function renderViewModeFromMetadata(
  value: any,
  metadata: BackendFieldMetadata,
  record?: any,
  datalabels?: DatalabelData[]  // ✅ NEW: Optional datalabel data
): React.ReactElement {
  // ... existing render types

  // Enhanced DAG rendering (NEW)
  if (metadata.renderType === 'dag' && metadata.settingsDatalabel) {
    // Find datalabel data
    const datalabelData = datalabels?.find(dl => dl.name === metadata.settingsDatalabel);

    return (
      <DAGVisualizer
        data={record}
        stageField={metadata.key}
        datalabelOptions={datalabelData?.options}  // ✅ Pass preloaded data
      />
    );
  }

  // ... rest of render types
}
```

---

## Implementation Plan

### Phase 1: Backend Infrastructure (Priority: High)

**Estimated Time**: 1 day

#### Step 1.1: Create Datalabel Preloader Service

**File**: `apps/api/src/services/datalabel-preloader.service.ts`

**Tasks**:
1. Create service class with caching (5-minute TTL)
2. Implement `extractDatalabelFields(metadata)`
3. Implement `fetchDatalabels(datalabelNames)` with batch query
4. Implement `getDatalabelsForResponse(metadata)`
5. Add unit tests

**SQL Query**:
```sql
-- Batch fetch all datalabels in single query
SELECT
  datalabel,
  id,
  name,
  descr,
  parent_id,
  sort_order,
  color_code,
  active_flag
FROM app.setting_datalabel
WHERE datalabel = ANY($1::text[])
  AND active_flag = true
ORDER BY datalabel, sort_order;
```

**Acceptance Criteria**:
- ✅ Service fetches all datalabels in single query
- ✅ Results cached for 5 minutes
- ✅ Returns structured DatalabelData[]
- ✅ Handles missing datalabels gracefully

---

#### Step 1.2: Enhance Backend Formatter Service

**File**: `apps/api/src/services/backend-formatter.service.ts`

**Tasks**:
1. Detect DAG fields (`dl__*_stage`, `dl__*_status`)
2. Set `renderType: 'dag'`
3. Set `component: 'DAGVisualizer'`
4. Set `requiresDatalabelData: true`

**Acceptance Criteria**:
- ✅ DAG fields detected and flagged
- ✅ Backward compatible with existing badge fields
- ✅ No breaking changes to existing metadata

---

#### Step 1.3: Create Enhanced Response Helper

**File**: `apps/api/src/lib/enhanced-response.ts` (new file)

**Tasks**:
1. Create `createEnhancedPaginatedResponse()` function
2. Integrate with datalabel preloader service
3. Add TypeScript types

**Acceptance Criteria**:
- ✅ Returns response with datalabels field
- ✅ Only includes datalabels when needed
- ✅ Efficient (single batch query)

---

#### Step 1.4: Integrate in Entity Routes

**Files**: Update 4 integrated routes
- `apps/api/src/modules/business/routes.ts`
- `apps/api/src/modules/office/routes.ts`
- `apps/api/src/modules/project/routes.ts`
- `apps/api/src/modules/task/routes.ts`

**Tasks**:
1. Replace `createPaginatedResponse()` with `createEnhancedPaginatedResponse()`
2. Test response structure
3. Verify datalabels included

**Acceptance Criteria**:
- ✅ All 4 routes return datalabels field
- ✅ Datalabels only included when DAG fields present
- ✅ No performance regression

---

### Phase 2: Frontend Infrastructure (Priority: High)

**Estimated Time**: 1 day

#### Step 2.1: Update Type Definitions

**File**: `apps/web/src/lib/api.ts`

**Tasks**:
1. Add `DatalabelOption` interface
2. Add `DatalabelData` interface
3. Update `EnhancedEntityResponse` interface

**Acceptance Criteria**:
- ✅ Full TypeScript support
- ✅ Backward compatible

---

#### Step 2.2: Enhance Page Components

**Files**:
- `apps/web/src/pages/shared/EntityMainPage.tsx`
- `apps/web/src/pages/shared/EntityDetailPage.tsx`

**Tasks**:
1. Add datalabels state
2. Extract datalabels from response
3. Pass to child components

**Acceptance Criteria**:
- ✅ Datalabels extracted and stored
- ✅ Passed to FilteredDataTable/EntityFormContainer

---

#### Step 2.3: Enhance Table Components

**Files**:
- `apps/web/src/components/shared/dataTable/FilteredDataTable.tsx`
- `apps/web/src/components/shared/ui/EntityDataTable.tsx`

**Tasks**:
1. Accept datalabels prop
2. Create datalabel context
3. Pass to renderers

**Acceptance Criteria**:
- ✅ Datalabels accessible to all renderers
- ✅ O(1) lookup via Map

---

#### Step 2.4: Enhance DAGVisualizer

**File**: `apps/web/src/components/workflow/DAGVisualizer.tsx`

**Tasks**:
1. Accept `datalabelOptions` prop
2. Use preloaded data if available
3. Fallback to API call if not available
4. Remove loading state when using preloaded data

**Acceptance Criteria**:
- ✅ No API call when datalabelOptions provided
- ✅ Instant rendering with preloaded data
- ✅ Backward compatible (falls back to API call)

---

#### Step 2.5: Enhance Frontend Formatter

**File**: `apps/web/src/lib/frontEndFormatterService.tsx`

**Tasks**:
1. Accept datalabels parameter
2. Handle `renderType: 'dag'`
3. Pass datalabel data to DAGVisualizer

**Acceptance Criteria**:
- ✅ DAG rendering uses preloaded data
- ✅ No duplicate API calls

---

### Phase 3: Testing & Optimization (Priority: Medium)

**Estimated Time**: 0.5 days

#### Step 3.1: End-to-End Testing

**Test Scenarios**:
1. ✅ List page with DAGVisualizer (project_stage)
   - Verify single API call
   - Verify no secondary datalabel calls
   - Verify DAG renders correctly

2. ✅ Detail page with DAGVisualizer
   - Verify datalabels included
   - Verify instant rendering

3. ✅ Multiple DAGVisualizers on same page
   - Verify all use same preloaded data
   - Verify zero secondary API calls

4. ✅ Backward compatibility
   - Test non-integrated routes (fallback to API call)
   - Verify no breaking changes

**Acceptance Criteria**:
- ✅ API calls reduced from N+1 to 1
- ✅ No loading flicker for DAGVisualizer
- ✅ All existing functionality works

---

#### Step 3.2: Performance Benchmarking

**Metrics**:
1. API response time (with vs without datalabels)
2. Frontend render time (preloaded vs API call)
3. Total page load time
4. Database query count

**Expected Improvements**:
- ✅ 50-80% reduction in API calls
- ✅ 100-300ms faster DAGVisualizer rendering
- ✅ Better perceived performance (no loading states)

---

#### Step 3.3: Caching Optimization

**Tasks**:
1. Tune cache TTL (test 5min, 10min, 15min)
2. Consider Redis for distributed caching
3. Add cache hit/miss metrics

**Acceptance Criteria**:
- ✅ Cache hit rate > 90%
- ✅ No stale data issues

---

### Phase 4: Rollout & Documentation (Priority: Low)

**Estimated Time**: 0.5 days

#### Step 4.1: Integrate Remaining Routes

**Target**: 42 non-integrated routes

**Tasks**:
1. Add `getEntityMetadata()` to all routes
2. Replace with `createEnhancedPaginatedResponse()`
3. Test each route

**Acceptance Criteria**:
- ✅ All 46 routes return metadata + datalabels
- ✅ Consistent response structure

---

#### Step 4.2: Documentation

**Files to Update**:
1. `docs/services/backend-formatter.service.md` - Document DAG detection
2. `docs/services/frontEndFormatterService.md` - Document datalabel handling
3. `docs/api/entity_endpoint_design.md` - Document response structure
4. `docs/METADATA_PLUMBING_STATUS.md` - Update integration status
5. Create `docs/DATALABEL_PRELOADING.md` - Complete guide

**Acceptance Criteria**:
- ✅ All docs updated
- ✅ Examples provided
- ✅ Migration guide created

---

## Data Flow Diagrams

### Current Flow (N+1 Problem)

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. Frontend: GET /api/v1/project?limit=10                       │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ 2. Backend: Return { data: [...], metadata: {...} }             │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ 3. Frontend: Render EntityDataTable with 10 rows                │
│    Each row has DAGVisualizer for project_stage                 │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ 4. DAGVisualizer Row 1: GET /api/v1/setting?datalabel=...       │
│ 5. DAGVisualizer Row 2: GET /api/v1/setting?datalabel=...       │
│ 6. DAGVisualizer Row 3: GET /api/v1/setting?datalabel=...       │
│ ...                                                              │
│ 13. DAGVisualizer Row 10: GET /api/v1/setting?datalabel=...     │
└──────────────────────────────────────────────────────────────────┘

Total API Calls: 11 (1 list + 10 datalabel fetches)
```

### Proposed Flow (Single Request)

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. Frontend: GET /api/v1/project?limit=10                       │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ 2. Backend: Detect dl__project_stage field                      │
│    → Preload project_stage datalabel options                    │
│    → Cache for 5 minutes                                        │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ 3. Backend: Return enhanced response                            │
│    {                                                             │
│      data: [...],                                               │
│      metadata: {...},                                           │
│      datalabels: [                                              │
│        {                                                         │
│          name: 'project_stage',                                 │
│          options: [...]                                         │
│        }                                                         │
│      ]                                                          │
│    }                                                            │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ 4. Frontend: Extract datalabels → Store in context              │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ 5. Frontend: Render EntityDataTable with 10 rows                │
│    All DAGVisualizers use preloaded datalabel data              │
│    ✅ No additional API calls!                                   │
└──────────────────────────────────────────────────────────────────┘

Total API Calls: 1 (just the list request)
Improvement: 91% reduction in API calls
```

---

## Response Structure Examples

### Example 1: Project Entity (with DAG field)

```json
{
  "data": [
    {
      "id": "uuid-1",
      "name": "Kitchen Renovation",
      "code": "PROJ-001",
      "dl__project_stage": "execution",
      "budget_allocated_amt": 50000,
      "start_date": "2025-01-15",
      "metadata": {
        "custom_field": "value",
        "priority": "high"
      }
    }
  ],
  "metadata": {
    "entity": "project",
    "fields": [
      {
        "key": "dl__project_stage",
        "label": "Project Stage",
        "renderType": "dag",
        "component": "DAGVisualizer",
        "inputType": "select",
        "loadFromDataLabels": true,
        "settingsDatalabel": "project_stage",
        "requiresDatalabelData": true,
        "visible": {
          "EntityDataTable": true,
          "EntityDetailView": true,
          "EntityFormContainer": true,
          "KanbanView": true,
          "CalendarView": true
        },
        "editable": true
      },
      {
        "key": "metadata",
        "label": "Metadata",
        "renderType": "metadata-table",
        "component": "MetadataTable",
        "inputType": "json",
        "visible": {
          "EntityDataTable": false,
          "EntityDetailView": true,
          "EntityFormContainer": true,
          "KanbanView": false,
          "CalendarView": false
        },
        "editable": true
      }
    ]
  },
  "datalabels": [
    {
      "name": "project_stage",
      "options": [
        {
          "id": 1,
          "name": "Planning",
          "descr": "Initial planning phase",
          "parent_id": null,
          "sort_order": 1,
          "color_code": "blue",
          "active_flag": true
        },
        {
          "id": 2,
          "name": "Execution",
          "descr": "Active execution phase",
          "parent_id": 1,
          "sort_order": 2,
          "color_code": "yellow",
          "active_flag": true
        },
        {
          "id": 3,
          "name": "Completed",
          "descr": "Project completed",
          "parent_id": 2,
          "sort_order": 3,
          "color_code": "green",
          "active_flag": true
        }
      ]
    }
  ],
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

### Example 2: Task Entity (with multiple DAG fields)

```json
{
  "data": [...],
  "metadata": {
    "entity": "task",
    "fields": [
      {
        "key": "dl__task_stage",
        "renderType": "dag",
        "settingsDatalabel": "task_stage",
        "requiresDatalabelData": true
      },
      {
        "key": "dl__task_priority",
        "renderType": "badge",
        "settingsDatalabel": "task_priority",
        "requiresDatalabelData": false
      }
    ]
  },
  "datalabels": [
    {
      "name": "task_stage",
      "options": [...]
    }
    // Note: task_priority NOT included (only badge, not DAG)
  ]
}
```

### Example 3: Employee Entity (no DAG fields)

```json
{
  "data": [...],
  "metadata": {
    "entity": "employee",
    "fields": [...]
  },
  "datalabels": [],  // Empty - no DAG fields detected
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

---

## Benefits Analysis

### Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **API Calls** (10 rows w/ DAG) | 11 | 1 | 91% ↓ |
| **API Calls** (50 rows w/ DAG) | 51 | 1 | 98% ↓ |
| **DAG Render Time** | 150-300ms | <10ms | 93% ↓ |
| **Page Load Time** | 2-3s | 0.5-1s | 67% ↓ |
| **Database Queries** | 11 | 2 | 82% ↓ |

### User Experience Improvements

1. ✅ **No Loading Flicker**: DAGVisualizer renders instantly
2. ✅ **Faster Page Loads**: Fewer round trips to server
3. ✅ **Better Perceived Performance**: No secondary loading states
4. ✅ **Consistent Data**: All visualizers use same data
5. ✅ **Offline-Friendly**: Datalabel data cached on first load

### Developer Experience Improvements

1. ✅ **Simpler Components**: No API call logic in DAGVisualizer
2. ✅ **Better Caching**: Server-side caching more efficient
3. ✅ **Type Safety**: Full TypeScript support for datalabels
4. ✅ **Debugging**: Single request to inspect, not N+1
5. ✅ **Testing**: Easier to mock single response

---

## Risks & Mitigations

### Risk 1: Larger Response Payloads

**Impact**: Medium
**Likelihood**: High

**Description**: Including datalabel data increases response size

**Mitigation**:
1. ✅ Only include datalabels for DAG fields (not all badge fields)
2. ✅ Datalabel data typically small (10-20 options × 200 bytes = 2-4KB)
3. ✅ Gzip compression reduces size by ~70%
4. ✅ Benefit (fewer requests) outweighs cost (larger payload)

**Example**:
- Before: 11 requests × 1KB = 11KB total transfer
- After: 1 request × 5KB = 5KB total transfer (54% reduction)

---

### Risk 2: Cache Invalidation

**Impact**: Medium
**Likelihood**: Low

**Description**: Datalabel changes not reflected immediately

**Mitigation**:
1. ✅ 5-minute cache TTL (balance between freshness and performance)
2. ✅ Datalabel changes are infrequent (settings data)
3. ✅ Cache invalidation on setting updates (future enhancement)
4. ✅ Frontend can still make direct API call if needed (fallback)

---

### Risk 3: Backward Compatibility

**Impact**: High
**Likelihood**: Low

**Description**: Breaking changes for non-integrated routes

**Mitigation**:
1. ✅ `datalabels` field is optional
2. ✅ Frontend has fallback to API call if not present
3. ✅ No changes to existing response structure (only addition)
4. ✅ Gradual rollout (4 routes → 46 routes)

---

### Risk 4: Database Load

**Impact**: Low
**Likelihood**: Very Low

**Description**: Additional datalabel query on every request

**Mitigation**:
1. ✅ Single batch query (WHERE IN clause)
2. ✅ Aggressive caching (5-minute TTL)
3. ✅ Indexed query (datalabel column indexed)
4. ✅ Small result set (typically 10-50 rows)

**Query Performance**:
```sql
-- Batch fetch (efficient)
SELECT * FROM setting_datalabel WHERE datalabel = ANY($1)
-- Estimated time: <5ms
```

---

## Success Criteria

### Phase 1 (Backend) Complete When:
- ✅ Datalabel preloader service implemented and tested
- ✅ Backend formatter detects DAG fields
- ✅ Enhanced response helper created
- ✅ 4 integrated routes returning datalabels
- ✅ Response structure documented
- ✅ Unit tests passing

### Phase 2 (Frontend) Complete When:
- ✅ Type definitions updated
- ✅ Page components extract datalabels
- ✅ Table components pass datalabels
- ✅ DAGVisualizer uses preloaded data
- ✅ Frontend formatter handles DAG rendering
- ✅ Zero secondary API calls for datalabels

### Phase 3 (Testing) Complete When:
- ✅ All test scenarios passing
- ✅ Performance benchmarks meet targets
- ✅ No regressions detected
- ✅ Cache hit rate > 90%

### Phase 4 (Rollout) Complete When:
- ✅ All 46 routes integrated
- ✅ Documentation complete
- ✅ Migration guide created
- ✅ Team trained on new architecture

---

## Migration Guide

### For Backend Developers

**Before** (Current):
```typescript
fastify.get('/api/v1/entity', async (request, reply) => {
  const entities = await db.execute(sql`SELECT * ...`);
  const metadata = getEntityMetadata('entity', entities[0]);

  return {
    ...createPaginatedResponse(entities, total, limit, offset),
    metadata
  };
});
```

**After** (Enhanced):
```typescript
fastify.get('/api/v1/entity', async (request, reply) => {
  const entities = await db.execute(sql`SELECT * ...`);
  const metadata = getEntityMetadata('entity', entities[0]);

  // ✅ Use enhanced response helper
  return createEnhancedPaginatedResponse(
    entities,
    metadata,
    total,
    limit,
    offset
  );
});
```

### For Frontend Developers

**Before** (DAGVisualizer makes API call):
```typescript
<DAGVisualizer data={record} />
// DAGVisualizer internally calls: GET /api/v1/setting?datalabel=...
```

**After** (DAGVisualizer uses preloaded data):
```typescript
// Extract datalabels from response
const { data, metadata, datalabels } = await api.list();

// Pass to components
<EntityDataTable
  data={data}
  metadata={metadata}
  datalabels={datalabels}  // ✅ Preloaded
/>

// DAGVisualizer gets datalabels from context
// No API call!
```

---

## Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Backend Infrastructure | 1 day | None |
| Phase 2: Frontend Infrastructure | 1 day | Phase 1 complete |
| Phase 3: Testing & Optimization | 0.5 days | Phase 2 complete |
| Phase 4: Rollout & Documentation | 0.5 days | Phase 3 complete |
| **Total** | **3 days** | - |

---

## Conclusion

### Summary

1. **Metadata Field Visualization**: ✅ Already solved (MetadataTable component)
2. **Datalabel Preloading**: 📋 Planned architecture (this document)

### Key Takeaways

1. ✅ **91-98% reduction in API calls** for pages with DAGVisualizers
2. ✅ **Instant DAG rendering** (no loading states)
3. ✅ **Backward compatible** (optional datalabels field)
4. ✅ **Low risk** (additive change, aggressive caching)
5. ✅ **High impact** (better UX, better DX, better performance)

### Next Steps

1. Review this plan with team
2. Get approval for Phase 1 implementation
3. Start with datalabel preloader service
4. Test with 4 integrated routes
5. Roll out to remaining routes

---

**Document Version**: 1.0
**Created**: 2025-11-20
**Author**: Claude (AI Assistant)
**Status**: 📋 Planning - Awaiting Approval
