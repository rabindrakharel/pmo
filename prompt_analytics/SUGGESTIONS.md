# API Response Payload Compression & Optimization Strategies

**Problem Statement:** Large JSON payloads for data table rendering consume excessive network bandwidth and slow down application performance, especially with datasets of 15,000+ tasks.

**Current State Analysis:**
- **Response Format:** Standard REST JSON with verbose field names
- **Sample Size:** ~15KB per 10 tasks = ~1.5KB per record
- **Redundancy Issues:**
  - Full timestamps repeated for every record (`created_ts`, `updated_ts`, `from_ts`, `to_ts`)
  - Verbose field names (`assignee_employee_ids`, `dependency_task_ids`)
  - Full UUIDs (36 characters each)
  - Empty arrays/strings taking space (`[]`, `""`)
  - Nested metadata objects
  - Repeated string literals ("performance_test", "load_test", "automated")

**Impact:** For 15,000 tasks: ~22.5MB uncompressed JSON payload

---

## 🎯 Recommended Strategies (Prioritized)

### **Tier 1: Quick Wins (Implement Immediately)**

#### 1.1 HTTP Compression (gzip/brotli)
**Effort:** Low | **Impact:** High (70-90% size reduction)

**Implementation:**
```typescript
// apps/api/src/server.ts
import fastifyCompress from '@fastify/compress';

await fastify.register(fastifyCompress, {
  global: true,
  encodings: ['br', 'gzip', 'deflate'], // Brotli preferred
  threshold: 1024, // Compress responses > 1KB
  brotliOptions: {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 6 // Balance speed vs compression
    }
  }
});
```

**Expected Reduction:** 70-85% (22.5MB → 3-7MB)

**Browser Support:** All modern browsers auto-decode
**Cost:** Nearly zero latency increase with quality=6

---

#### 1.2 Pagination with Smaller Page Sizes
**Effort:** Low | **Impact:** High

**Current State:** Loading 100+ records per request
**Recommendation:** Default to 25-50 records for table views

**Implementation:**
```typescript
// apps/api/src/modules/task/routes.ts
const DEFAULT_PAGE_SIZE = 25;  // Was 50
const MAX_PAGE_SIZE = 100;     // Was 100

// apps/web/src/pages/shared/EntityChildListPage.tsx
const response = await childApi.list({
  page: 1,
  pageSize: 25,  // Reduced from 100
  parentId,
  parentType
});
```

**Expected Reduction:** 75% (load 25 instead of 100)
**UX Impact:** Minimal - users rarely need 100 rows at once

---

#### 1.3 Virtual Scrolling / Windowing
**Effort:** Medium | **Impact:** High

**Library:** `react-window` or `@tanstack/react-virtual`

**Implementation:**
```tsx
// apps/web/src/components/shared/table/FilteredDataTable.tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function FilteredDataTable({ data, columns }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // Row height in pixels
    overscan: 10 // Render 10 extra rows above/below viewport
  });

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualRows.map((virtualRow) => (
          <TableRow key={virtualRow.index} data={data[virtualRow.index]} />
        ))}
      </div>
    </div>
  );
}
```

**Benefits:**
- Only renders visible rows (10-20 DOM nodes instead of 15,000)
- Smooth scrolling with 100K+ records
- Dramatically reduces React re-render time

**Expected Improvement:** 95% reduction in DOM nodes, 10x faster rendering

---

### **Tier 2: Medium-Term Optimizations**

#### 2.1 Field Projection / Sparse Fieldsets
**Effort:** Medium | **Impact:** Medium (30-50% size reduction)

**Concept:** Only return fields needed for current view

**API Implementation:**
```typescript
// Support ?fields=id,name,stage,priority_level query param

fastify.get('/api/v1/task', async (request, reply) => {
  const { fields } = request.query as { fields?: string };

  if (fields) {
    const fieldList = fields.split(',');
    const selected = fieldList.map(f => `t.${f}`).join(', ');

    const tasks = await db.execute(sql`
      SELECT ${sql.raw(selected)}
      FROM app.d_task t
      WHERE t.active_flag = true
    `);

    return { data: tasks };
  }

  // ... default full fetch
});
```

**Frontend Usage:**
```typescript
// For table view: only fetch visible columns
const response = await taskApi.list({
  fields: ['id', 'name', 'stage', 'priority_level', 'estimated_hours'].join(',')
});

// For detail view: fetch all fields
const response = await taskApi.get(id); // No fields param = full data
```

**Expected Reduction:** 40-60% for table views (12 fields → 5 fields)

---

#### 2.2 Response Caching with ETags
**Effort:** Medium | **Impact:** Medium

**Implementation:**
```typescript
// apps/api/src/server.ts
import fastifyEtag from '@fastify/etag';

await fastify.register(fastifyEtag);

// In routes
fastify.get('/api/v1/task', async (request, reply) => {
  const tasks = await db.execute(sql`SELECT * FROM app.d_task ...`);

  // Calculate ETag based on data hash
  const etag = generateEtag(tasks);

  if (request.headers['if-none-match'] === etag) {
    return reply.status(304).send(); // Not Modified - no data transfer!
  }

  reply.header('ETag', etag);
  reply.header('Cache-Control', 'max-age=60, must-revalidate');

  return { data: tasks };
});
```

**Benefits:**
- 304 responses = 0 bytes transferred for unchanged data
- Works seamlessly with browser cache
- Automatic revalidation

**Expected Reduction:** 100% for cached responses (no data transfer)

---

#### 2.3 GraphQL-Style Field Selection
**Effort:** High | **Impact:** High

**Alternative to REST:** Implement a flexible query API

**Implementation:**
```typescript
// New endpoint: POST /api/v1/query
fastify.post('/api/v1/query', async (request, reply) => {
  const { entity, fields, filters, pagination } = request.body;

  // Example request:
  // {
  //   "entity": "task",
  //   "fields": ["id", "name", "stage"],
  //   "filters": { "stage": "In Progress" },
  //   "pagination": { "page": 1, "limit": 25 }
  // }

  const selectedFields = fields.map(f => `t.${f}`).join(', ');
  const whereClauses = buildWhereClause(filters);

  const results = await db.execute(sql`
    SELECT ${sql.raw(selectedFields)}
    FROM app.d_task t
    WHERE ${whereClauses}
    LIMIT ${pagination.limit}
    OFFSET ${(pagination.page - 1) * pagination.limit}
  `);

  return { data: results };
});
```

**Benefits:**
- Frontend controls exactly what data it needs
- Single endpoint for all entities
- Reduces over-fetching

---

### **Tier 3: Advanced Optimizations**

#### 3.1 Compact Response Format (v2 API)
**Effort:** High | **Impact:** High (50-70% size reduction)

**Concept:** Return data as arrays instead of objects with verbose keys

**Current Format (Verbose):**
```json
{
  "data": [
    {
      "id": "261f66c5-bd02-4605-acb1-70cdecf35af0",
      "slug": "dt-perf-task-99",
      "name": "Performance Test Task 99",
      "assignee_employee_ids": ["8260b1b0-5efc-4611-ad33-ee76c0cf7f13"],
      "stage": "Blocked",
      "priority_level": "medium"
    }
  ]
}
```

**Compact Format (Array-Based):**
```json
{
  "schema": ["id", "slug", "name", "assignee_ids", "stage", "priority"],
  "data": [
    [
      "261f66c5-bd02-4605-acb1-70cdecf35af0",
      "dt-perf-task-99",
      "Performance Test Task 99",
      ["8260b1b0-5efc-4611-ad33-ee76c0cf7f13"],
      "Blocked",
      "medium"
    ]
  ]
}
```

**Implementation:**
```typescript
// New endpoint: GET /api/v2/task (compact format)
fastify.get('/api/v2/task', async (request, reply) => {
  const tasks = await db.execute(sql`SELECT * FROM app.d_task`);

  const schema = Object.keys(tasks[0] || {});
  const data = tasks.map(task => schema.map(key => task[key]));

  return { schema, data };
});

// Frontend adapter
function deserializeCompactResponse(response: { schema: string[], data: any[][] }) {
  return response.data.map(row => {
    const obj: any = {};
    response.schema.forEach((key, idx) => {
      obj[key] = row[idx];
    });
    return obj;
  });
}
```

**Expected Reduction:** 60% (no repeated keys)

---

#### 3.2 Binary Formats (Protocol Buffers / MessagePack)
**Effort:** High | **Impact:** Very High (80-90% size reduction)

**Option A: Protocol Buffers**
```protobuf
// task.proto
syntax = "proto3";

message Task {
  string id = 1;
  string slug = 2;
  string name = 3;
  repeated string assignee_employee_ids = 4;
  string stage = 5;
  string priority_level = 6;
  double estimated_hours = 7;
}

message TaskListResponse {
  repeated Task tasks = 1;
  int32 total = 2;
  int32 page = 3;
}
```

**Option B: MessagePack**
```typescript
import msgpack from '@msgpack/msgpack';

// API
fastify.get('/api/v1/task', async (request, reply) => {
  const tasks = await db.execute(sql`SELECT * FROM app.d_task`);

  if (request.headers.accept === 'application/msgpack') {
    reply.header('Content-Type', 'application/msgpack');
    return msgpack.encode({ data: tasks });
  }

  return { data: tasks }; // JSON fallback
});

// Frontend
const response = await fetch('/api/v1/task', {
  headers: { 'Accept': 'application/msgpack' }
});
const arrayBuffer = await response.arrayBuffer();
const data = msgpack.decode(new Uint8Array(arrayBuffer));
```

**Expected Reduction:** 80-90% vs JSON
**Tradeoff:** Not human-readable, requires decoder library

---

#### 3.3 Abbreviated Field Names
**Effort:** Medium | **Impact:** Medium (20-30% size reduction)

**Concept:** Use short keys in API responses

**Mapping:**
```typescript
const FIELD_ABBREVIATIONS = {
  // Database → API
  'id': 'i',
  'name': 'n',
  'slug': 's',
  'stage': 'st',
  'priority_level': 'p',
  'estimated_hours': 'eh',
  'actual_hours': 'ah',
  'assignee_employee_ids': 'ae',
  'created_ts': 'ct',
  'updated_ts': 'ut',
  'metadata': 'm',
  'tags': 't'
};

// Transform function
function abbreviateResponse(data: any[]) {
  return data.map(record => {
    const abbreviated: any = {};
    Object.entries(record).forEach(([key, value]) => {
      const shortKey = FIELD_ABBREVIATIONS[key] || key;
      abbreviated[shortKey] = value;
    });
    return abbreviated;
  });
}
```

**Tradeoff:** Less readable, requires mapping layer on frontend

---

#### 3.4 Incremental Loading / Cursor Pagination
**Effort:** Medium | **Impact:** High

**Concept:** Load data in smaller chunks as user scrolls

**Implementation:**
```typescript
// API: Cursor-based pagination
fastify.get('/api/v1/task', async (request, reply) => {
  const { cursor, limit = 25 } = request.query;

  const tasks = await db.execute(sql`
    SELECT * FROM app.d_task
    WHERE (cursor IS NULL OR created_ts < ${cursor})
    ORDER BY created_ts DESC
    LIMIT ${limit}
  `);

  const nextCursor = tasks.length > 0
    ? tasks[tasks.length - 1].created_ts
    : null;

  return {
    data: tasks,
    cursor: nextCursor,
    hasMore: tasks.length === limit
  };
});

// Frontend: Infinite scroll
function useInfiniteScroll() {
  const [data, setData] = useState([]);
  const [cursor, setCursor] = useState(null);

  const loadMore = async () => {
    const response = await fetch(`/api/v1/task?cursor=${cursor}&limit=25`);
    const { data: newData, cursor: nextCursor } = await response.json();

    setData([...data, ...newData]);
    setCursor(nextCursor);
  };

  return { data, loadMore };
}
```

**Benefits:**
- Initial load only fetches 25 records
- Smooth infinite scrolling experience
- Better perceived performance

---

### **Tier 4: Database-Level Optimizations**

#### 4.1 Database Views with Pre-Aggregation
**Effort:** Medium | **Impact:** Medium

**Concept:** Create views that pre-join and pre-format data

**Implementation:**
```sql
-- Create materialized view for task list
CREATE MATERIALIZED VIEW app.v_task_list AS
SELECT
  t.id,
  t.name,
  t.slug,
  t.stage,
  t.priority_level,
  t.estimated_hours,
  t.actual_hours,
  t.tags,
  -- Pre-computed fields
  array_length(t.assignee_employee_ids, 1) as assignee_count,
  CASE WHEN t.estimated_hours > 0
    THEN (t.actual_hours / t.estimated_hours * 100)::int
    ELSE 0
  END as progress_percent
FROM app.d_task t
WHERE t.active_flag = true;

-- Refresh periodically
REFRESH MATERIALIZED VIEW CONCURRENTLY app.v_task_list;
```

**Benefits:**
- Faster queries (no joins at query time)
- Can add computed fields
- Can cache complex aggregations

---

#### 4.2 JSON Aggregation for Child Entities
**Effort:** Medium | **Impact:** Medium

**Concept:** Return child entities as nested JSON in single query

**Implementation:**
```sql
-- Instead of separate calls for project → tasks
SELECT
  p.*,
  COALESCE(
    json_agg(
      json_build_object(
        'id', t.id,
        'name', t.name,
        'stage', t.stage
      ) ORDER BY t.created_ts DESC
    ) FILTER (WHERE t.id IS NOT NULL),
    '[]'
  ) as tasks
FROM app.d_project p
LEFT JOIN app.d_entity_id_map eim
  ON eim.parent_entity_id = p.id::text
LEFT JOIN app.d_task t
  ON t.id::text = eim.child_entity_id
WHERE p.id = $1
GROUP BY p.id;
```

**Benefits:**
- Single query instead of N+1
- Reduces round trips
- Can nest multiple levels

---

## 📊 Comparison Matrix

| Strategy | Effort | Size Reduction | Latency Impact | Browser Support | Recommendation |
|----------|--------|----------------|----------------|-----------------|----------------|
| **HTTP Compression (brotli)** | Low | 70-85% | +5ms | ✅ Universal | ⭐⭐⭐⭐⭐ Implement Now |
| **Pagination (25 → 100)** | Low | 75% | -50ms | ✅ Universal | ⭐⭐⭐⭐⭐ Implement Now |
| **Virtual Scrolling** | Medium | 95% DOM | -200ms render | ✅ Universal | ⭐⭐⭐⭐⭐ Implement Now |
| **Field Projection** | Medium | 40-60% | -20ms | ✅ Universal | ⭐⭐⭐⭐ High Priority |
| **ETag Caching** | Medium | 100% (cached) | -100ms | ✅ Universal | ⭐⭐⭐⭐ High Priority |
| **Compact Format (v2)** | High | 60% | +10ms | ✅ Universal | ⭐⭐⭐ Medium Priority |
| **MessagePack** | High | 80-90% | +20ms encode | ✅ Modern | ⭐⭐ Low Priority |
| **GraphQL-Style** | High | 50-70% | +15ms | ✅ Universal | ⭐⭐⭐ Medium Priority |
| **Abbreviated Keys** | Medium | 20-30% | +5ms | ✅ Universal | ⭐⭐ Low Priority |
| **DB Views** | Medium | 30-40% | -50ms query | ✅ Universal | ⭐⭐⭐ Medium Priority |

---

## 🚀 Implementation Roadmap

### **Phase 1: Immediate Wins (Week 1)**
1. ✅ Enable Brotli compression on API
2. ✅ Reduce default pagination to 25 records
3. ✅ Implement virtual scrolling in FilteredDataTable
4. ✅ Add `Cache-Control` headers

**Expected Impact:** 90% size reduction, 3x faster page loads

---

### **Phase 2: Smart Fetching (Week 2-3)**
1. ✅ Implement field projection (`?fields=` query param)
2. ✅ Add ETag support for caching
3. ✅ Optimize table view to only fetch visible columns
4. ✅ Add cursor-based pagination for infinite scroll

**Expected Impact:** 95% reduction in data transfer for repeat views

---

### **Phase 3: Advanced (Month 2)**
1. ⚠️ Design compact response format (v2 API)
2. ⚠️ Create database materialized views
3. ⚠️ Implement GraphQL-style query endpoint
4. ⚠️ Benchmark MessagePack vs JSON

**Expected Impact:** Additional 30-50% reduction for power users

---

## 🔍 Monitoring & Measurement

**Metrics to Track:**
- **Transfer Size:** Before/after compression
- **First Paint:** Time to render first row
- **Total Load Time:** Full page interactive
- **Cache Hit Rate:** % of 304 responses
- **API Latency:** p50, p95, p99

**Tools:**
- Chrome DevTools Network tab
- Lighthouse performance audit
- Fastify request logging
- Prometheus metrics

**Example Measurement:**
```bash
# Before optimization
curl -H "Accept-Encoding: gzip" http://localhost:4000/api/v1/task \
  -w "\nSize: %{size_download} bytes\nTime: %{time_total}s\n"

# After optimization
# Expected: 70-90% smaller, 2-3x faster
```

---

## 💡 Additional Recommendations

### Frontend Optimizations
1. **React.memo()** for table rows to prevent unnecessary re-renders
2. **useCallback/useMemo** for expensive column calculations
3. **Debounced search** to reduce API calls during typing
4. **Optimistic UI updates** for instant feedback

### Backend Optimizations
1. **Connection pooling** (already implemented)
2. **Query result caching** with Redis
3. **Index optimization** for `active_flag`, `created_ts`, `stage`
4. **Query batching** for related entities

### Infrastructure
1. **CDN caching** for static API responses
2. **HTTP/2 Server Push** for predictable resources
3. **Service Worker** for offline-first experience
4. **WebSocket** for real-time updates (avoid polling)

---

## 📝 Example: Complete Optimization Stack

**For a typical 15,000 task dataset:**

| Optimization Layer | Size/Performance Impact |
|--------------------|------------------------|
| **Base JSON** | 22.5MB, 3.2s load |
| + Brotli compression | 4.5MB (-80%), 1.8s load |
| + Pagination (25 records) | 75KB (-98%), 0.3s load |
| + Virtual scrolling | 15 DOM nodes (-99.9%), 0.05s render |
| + Field projection (5 fields) | 35KB (-99.8%), 0.2s load |
| + ETag caching (304) | 0 bytes (-100%), 0.05s load |

**Final Result:** From 22.5MB / 3.2s → 35KB / 0.2s on first load, 0 bytes / 0.05s on cached loads

---

## 🎯 Conclusion

**Top 3 Immediate Actions:**
1. **Enable Brotli compression** - 1 hour, 80% size reduction
2. **Implement virtual scrolling** - 4 hours, 10x faster rendering
3. **Reduce pagination default** - 15 minutes, 75% less data

**Expected Total Impact:**
- **Transfer Size:** 99.8% reduction (22.5MB → 35KB first load, 0KB cached)
- **Load Time:** 94% faster (3.2s → 0.2s first load, 0.05s cached)
- **Render Time:** 95% faster (200ms → 10ms for virtual scrolling)

**ROI:** 8 hours implementation for 15x performance improvement

---

**Last Updated:** 2025-10-18
**Architecture:** Fastify API + React Frontend + PostgreSQL
**Target:** 15,000+ task performance optimization
