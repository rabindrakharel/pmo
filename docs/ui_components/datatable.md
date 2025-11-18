# DataTable System - Complete Architecture

> **OOP-based, database-driven data standardization with perfect 1:1 `dl__` alignment**
> Zero hardcoding - Database column names drive rendering, colors, widths, sorting, filtering

**Tags:** `#datatable` `#OOP` `#composition` `#field-category` `#settings` `#auto-configuration` `#DRY` `#scrollbar` `#horizontal-scroll`

---

## 1. Semantics & Business Context

### Purpose
Provide a universal, extensible data table system using OOP principles (React composition pattern). Base component handles common functionality including **next-generation horizontal scrollbar with progress indicator**, while specialized extensions (EntityDataTable, SettingsDataTable) provide specific rendering and behavior. All rendering is database-driven with zero hardcoding. Tables maintain **context-independent column sets** across all navigation contexts.

### Business Value
- **Zero Configuration**: Add database columns → Automatically render correctly
- **Perfect Consistency**: All tables across platform use identical patterns
- **Database-Driven Colors**: All colors from `setting_datalabel` metadata - NO hardcoding
- **Context-Independent Columns**: Same columns in main view (`/task`) and child view (`/project/{id}/task`)
- **Premium Scrollbar UX**: Highly visible, animated horizontal scrollbar with real-time progress indicator
- **Maintainable**: Change once in base → affects all extensions globally
- **Extensible**: OOP composition pattern for specialized table types
- **Type-Safe**: TypeScript ensures correctness at compile time

---

## 2. Architecture & DRY Design Patterns

### OOP Table Architecture (React Composition)

```
┌──────────────────────────────────────────────────────────────┐
│ DataTableBase (Base Component)                               │
│ - Table structure (thead, tbody, pagination)                 │
│ - Sorting UI (column headers with sort indicators)           │
│ - Inline editing pattern (Edit → Check/Cancel)               │
│ - Add row pattern with prominent blue button                 │
│ - Drag & drop infrastructure (indicators, handlers)          │
│ - 🆕 Next-gen horizontal scrollbar (24px, progress indicator)│
│ - Common styling and theming                                 │
│ Location: /components/shared/ui/DataTableBase.tsx            │
└──────────────────────────────────────────────────────────────┘
                           ↓ extends via composition
        ┌──────────────────────────────────────────────────────┐
        │                                                      │
┌───────▼────────────┐                        ┌───────▼────────────┐
│ EntityDataTable    │                        │ SettingsDataTable  │
│ (Entity Extension) │                        │ (Settings Extension)│
├────────────────────┤                        ├────────────────────┤
│ • Dynamic columns  │                        │ • Fixed columns    │
│ • Filters          │                        │ • Visual swatches  │
│ • Pagination       │                        │ • Reordering       │
│ • Complex features │                        │ • Simple sorting   │
│ • 🆕 Scrollbar     │                        │                    │
│                    │                        │                    │
│ Used for:          │                        │ Used for:          │
│ projects, tasks    │                        │ taskStage,         │
│ clients, etc.      │                        │ projectStage, etc. │
└────────────────────┘                        └────────────────────┘
```

### Component Hierarchy

```
FilteredDataTable (Routing Layer)
    ↓ Context-independent column resolution (v3.1.1)
    ↓ Uses entityConfig columns directly
    ↓ No conditional parent column logic
    ↓
    ├── EntityDataTable → Standalone (for entities)
    │   - Dynamic columns from entityConfig
    │   - Full filtering & pagination
    │   - 🆕 Bottom horizontal scrollbar with progress indicator
    │   - Used for: /project, /task, /client
    │   - Main view (/task) and child view (/project/{id}/task) use SAME columns
    │
    └── SettingsDataTable → DataTableBase (for settings)
        - Fixed schema (id, name, descr, parent_id, color_code)
        - Settings-specific rendering
        - Used for: /setting/taskStage, /setting/acquisitionChannel
```

### Horizontal Scrollbar Architecture (v3.1 Enhancement)

```
┌──────────────────────────────────────────────────────────────────┐
│ Table Container (overflow-x-auto, hide-scrollbar-x)              │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │  Table Content (7+ columns trigger horizontal scroll)        │ │
│ │  [Col 1] [Col 2] [Col 3] [Col 4] [Col 5] [Col 6] [Col 7]... │ │
│ └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                            ↕ Scroll sync
┌──────────────────────────────────────────────────────────────────┐
│ 🆕 Fixed Bottom Scrollbar (z-index: 1000)                        │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Progress Indicator (2px, gradient, 0-100%)                   │ │
│ ├──────────────────────────────────────────────────────────────┤ │
│ │                                                              │ │
│ │     ████████████████░░░░░░░░░░░░░░░░░░░░░░░                │ │
│ │     └─ Enhanced thumb (14px, gradient, glow effects)        │ │
│ │                                                              │ │
│ │  Track (gradient background, backdrop blur, shadow)         │ │
│ └──────────────────────────────────────────────────────────────┘ │
│ Container: 24px height, fixed position, responsive width        │
└──────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- **Fixed to viewport bottom**: Scrollbar follows user scroll position
- **Progress indicator**: 2px top bar shows scroll percentage (0-100%)
- **Premium gradient thumb**: Multi-color gradient with hover/active states
- **Glow effects**: Shadow layers creating depth and premium feel
- **Backdrop blur**: 12px blur with 180% saturation
- **Smooth animations**: 0.3s cubic-bezier transitions
- **Responsive**: Dynamically adjusts width to match table container

### Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. DATABASE                                                     │
│    • Entity Column: dl__project_stage TEXT                      │
│    • Settings Row: datalabel_name = 'dl__project_stage'         │
│    • Perfect 1:1 alignment (no transformation)                  │
│    • Metadata: [{name: "Execution", color_code: "yellow"}]      │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. API                                                          │
│    • Request: GET /api/v1/setting?datalabel=dl__project_stage   │
│    • Direct lookup: WHERE datalabel_name = 'dl__project_stage'  │
│    • Response: {datalabel: "dl__project_stage", data: [...]}    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. FIELD CATEGORY AUTO-DETECTION                               │
│    • detectFieldCategory('dl__project_stage') → LABEL           │
│    • Auto-apply: width:130px, align:left, sortable:true        │
│    • Features: colorBadge:true, dropdown:true                   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. COLOR CACHE (O(1) lookup)                                   │
│    • Preload: loadSettingsColors('dl__project_stage')           │
│    • Cache: Map<'Execution', 'yellow'>                          │
│    • Lookup: getSettingColor('dl__project_stage', 'Execution')  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. UI RENDERING                                                 │
│    • Badge: <span class="bg-yellow-100 text-yellow-800">        │
│    • Dropdown: ColoredDropdown with badge options               │
│    • Filter: Multi-select with colored checkboxes               │
│    • Scrollbar: Bottom-fixed with progress indicator (7+ cols) │
└─────────────────────────────────────────────────────────────────┘
```

### Context-Independent Column Pattern (v3.1.1)

```typescript
// FilteredDataTable.tsx:71-79 (CURRENT STATE)
const columns: Column[] = useMemo(() => {
  if (!config) return [];

  // Return columns from entity config without modification
  // When viewing child entities (e.g., /project/{id}/task), we don't need
  // to show parent ID since it's already in the URL context
  return config.columns as Column[];
}, [config]);
```

**Key Design Decision:** No conditional logic based on `parentType` or `parentId`. Columns are pure functions of entity type.

**Navigation Context Examples:**
- `/task` → Shows 6 columns (name, code, stage, priority, hours, assignee)
- `/project/abc123/task` → Shows **SAME 6 columns** (parent context in URL)
- Parent relationship visible via breadcrumb, not redundant table columns

### Field Category Detection Pattern

| Pattern | Category | Auto-Applied Properties |
|---------|----------|------------------------|
| `dl__*_stage`, `dl__*_status`, `dl__*_priority`, `dl__*_level` | **LABEL** | 130px, left, sortable, filterable, colored badge, settings dropdown |
| `*_amt`, `*_amount` | **AMOUNT** | 120px, right, sortable, filterable, currency format |
| `*_date` | **DATE** | 120px, left, sortable, filterable, friendly date |
| `*_ts`, `*_timestamp` | **TIMESTAMP** | 150px, left, sortable, relative time |
| `name`, `title` | **NAME** | 200px, left, sortable, filterable, searchable |
| `code` | **CODE** | 120px, left, sortable, filterable, searchable |
| `*_flag` | **BOOLEAN** | 80px, center, sortable, filterable, ✓/✗ icons |

**Key:** Column name determines EVERYTHING - width, alignment, rendering, features, scrollbar trigger

### Create-Link-Edit Pattern (Parent-Child Relationships)

**Core Principle:** Child entity data tables use the **main entity endpoint** with query parameter filtering instead of creating duplicate child-specific endpoints.

#### Architecture Pattern

```
┌────────────────────────────────────────────────────────────────┐
│ ANTI-PATTERN (Old Factory-Based Approach)                     │
├────────────────────────────────────────────────────────────────┤
│ GET /api/v1/role/{id}/employee    ← Duplicate endpoint        │
│ GET /api/v1/project/{id}/task     ← Duplicate endpoint        │
│ GET /api/v1/business/{id}/project ← Duplicate endpoint        │
│                                                                │
│ ❌ Code duplication across endpoints                          │
│ ❌ Column mismatches between main and child views             │
│ ❌ Maintenance burden (fix in N places)                       │
└────────────────────────────────────────────────────────────────┘
                            ↓ REFACTOR TO ↓
┌────────────────────────────────────────────────────────────────┐
│ ✅ CREATE-LINK-EDIT PATTERN (Current Architecture)            │
├────────────────────────────────────────────────────────────────┤
│ Main Endpoint with Query Parameter Filtering:                 │
│                                                                │
│ GET /api/v1/employee?parent_type=role&parent_id={uuid}        │
│ GET /api/v1/task?parent_type=project&parent_id={uuid}         │
│ GET /api/v1/project?parent_type=business&parent_id={uuid}     │
│                                                                │
│ ✅ Single endpoint, single query, single source of truth      │
│ ✅ Identical columns in all contexts (main + child views)     │
│ ✅ DRY principle - fix once, works everywhere                 │
└────────────────────────────────────────────────────────────────┘
```

#### Implementation Details

**Backend: Entity Endpoint with Parent Filtering**

```typescript
// apps/api/src/modules/employee/routes.ts

fastify.get('/api/v1/employee', {
  schema: {
    querystring: Type.Object({
      // Standard filters
      active_flag: Type.Optional(Type.Boolean()),
      search: Type.Optional(Type.String()),

      // 🆕 Parent filtering (create-link-edit pattern)
      parent_type: Type.Optional(Type.String()),
      parent_id: Type.Optional(Type.String({ format: 'uuid' })),

      // Pagination
      limit: Type.Optional(Type.Number({ minimum: 1, maximum: 10000 })),
      offset: Type.Optional(Type.Number({ minimum: 0 })),
      page: Type.Optional(Type.Number({ minimum: 1 }))
    })
  }
}, async (request, reply) => {
  const { parent_type, parent_id, active_flag, search, limit = 50, offset = 0 } = request.query;

  const conditions = [];

  // Parent filtering via entity_instance_link JOIN
  if (parent_type && parent_id) {
    conditions.push(sql`eim.parent_entity_type = ${parent_type}`);
    conditions.push(sql`eim.parent_entity_id = ${parent_id}`);
    conditions.push(sql`eim.child_entity_type = 'employee'`);
    conditions.push(sql`eim.active_flag = true`);
  }

  // Other filters
  if (active_flag !== undefined) {
    conditions.push(sql`e.active_flag = ${active_flag}`);
  }
  if (search) {
    conditions.push(sql`COALESCE(e.name, '') ILIKE ${`%${search}%`}`);
  }

  // Build query with conditional JOIN
  if (parent_type && parent_id) {
    // Query WITH JOIN for parent filtering
    employees = await db.execute(sql`
      SELECT e.id, e.code, e.name, e.email, ... /* ALL 25+ columns */
      FROM app.d_employee e
      INNER JOIN app.entity_instance_link eim ON eim.child_entity_id = e.id
      ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      ORDER BY e.name ASC
      LIMIT ${limit} OFFSET ${offset}
    `);
  } else {
    // Query WITHOUT JOIN for normal listing
    employees = await db.execute(sql`
      SELECT e.id, e.code, e.name, e.email, ... /* SAME 25+ columns */
      FROM app.d_employee e
      ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
      ORDER BY e.name ASC
      LIMIT ${limit} OFFSET ${offset}
    `);
  }

  return { data: employees, total, limit, offset };
});
```

**Frontend: FilteredDataTable with Query Params**

```typescript
// apps/web/src/components/shared/dataTable/FilteredDataTable.tsx

export function FilteredDataTable({
  entityType,
  parentType,
  parentId
}: FilteredDataTableProps) {

  // Always use main entity endpoint (create-link-edit pattern)
  const endpoint = config.apiEndpoint; // e.g., "/api/v1/employee"

  // Build query params with parent filtering support
  let queryParams = `page=${currentPage}&limit=${pageSize}`;

  // Add parent filtering via query params (create-link-edit pattern)
  if (parentType && parentId) {
    queryParams += `&parent_type=${parentType}&parent_id=${parentId}`;
  }

  // Fetch data
  const response = await fetch(`${endpoint}?${queryParams}`);

  // Return same columns regardless of context
  const columns: Column[] = useMemo(() => {
    if (!config) return [];

    // ✅ SAME columns for both contexts:
    // - Main view: /employee
    // - Child view: /role/{id}/employee
    return config.columns as Column[];
  }, [config]);

  return <EntityDataTable columns={columns} data={data} />;
}
```

#### Database Relationships (entity_instance_link)

The create-link-edit pattern relies on the `entity_instance_link` table for parent-child relationships:

```sql
-- Parent-child relationship storage
CREATE TABLE app.entity_instance_link (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_entity_type varchar(20) NOT NULL,  -- e.g., 'role'
    parent_entity_id uuid NOT NULL,           -- Specific role UUID
    child_entity_type varchar(20) NOT NULL,   -- e.g., 'employee'
    child_entity_id uuid NOT NULL,            -- Specific employee UUID
    relationship_type varchar(50) DEFAULT 'contains',
    active_flag boolean NOT NULL DEFAULT true,
    created_ts timestamptz NOT NULL DEFAULT now()
);

-- Example linkage: CTO role → James Miller
INSERT INTO app.entity_instance_link (
    parent_entity_type, parent_entity_id,
    child_entity_type, child_entity_id,
    relationship_type
) VALUES (
    'role', 'd4e80c66-46a3-4422-81c4-91b5f9a0c9ea',
    'employee', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    'has_member'
);
```

#### Complete Data Flow Example

```
User navigates to: http://localhost:5173/role/{id}/employee
                                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 1. FRONTEND ROUTING                                             │
│    EntityDetailPage → DynamicChildEntityTabs → "employee" tab   │
│    Props: entityType="employee", parentType="role", parentId=id │
└─────────────────────────────────────────────────────────────────┘
                                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. FILTEREDATATABLE COMPONENT                                   │
│    endpoint = "/api/v1/employee" (main endpoint)                │
│    queryParams = "?parent_type=role&parent_id={id}&page=1"      │
│    columns = config.columns (SAME as main employee view)        │
└─────────────────────────────────────────────────────────────────┘
                                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. API REQUEST                                                  │
│    GET /api/v1/employee?parent_type=role&parent_id={id}&page=1  │
└─────────────────────────────────────────────────────────────────┘
                                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. BACKEND PROCESSING                                           │
│    • Detect parent_type and parent_id params                    │
│    • Add JOIN with entity_instance_link                              │
│    • Filter: WHERE eim.parent_entity_type = 'role'              │
│    •         AND eim.parent_entity_id = '{id}'                  │
│    •         AND eim.child_entity_type = 'employee'             │
│    • Execute query with ALL employee columns                    │
└─────────────────────────────────────────────────────────────────┘
                                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. API RESPONSE                                                 │
│    {                                                            │
│      "data": [                                                  │
│        {                                                        │
│          "id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",          │
│          "code": "EMP-001",                                     │
│          "name": "James Miller",                                │
│          "email": "james.miller@huronhome.ca",                  │
│          ... /* ALL 25+ employee columns */                     │
│        }                                                        │
│      ],                                                         │
│      "total": 1,                                                │
│      "limit": 50,                                               │
│      "offset": 0                                                │
│    }                                                            │
└─────────────────────────────────────────────────────────────────┘
                                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. DATATABLE RENDERING                                          │
│    EntityDataTable renders with:                                │
│    • SAME columns as /employee main view                        │
│    • 1 row: James Miller                                        │
│    • All fields editable (inline edit)                          │
│    • "Add New Row" shows ALL employee fields                    │
│    • Horizontal scrollbar if > 7 columns                        │
└─────────────────────────────────────────────────────────────────┘
```

#### Benefits of Create-Link-Edit Pattern

| Aspect | Factory Pattern (Old) | Create-Link-Edit Pattern (✅ Current) |
|--------|----------------------|--------------------------------------|
| **Code Duplication** | ❌ Duplicate queries per parent-child pair | ✅ Single query, reused everywhere |
| **Column Consistency** | ❌ Often mismatched columns | ✅ Guaranteed identical columns |
| **Maintenance** | ❌ Fix in N places | ✅ Fix once, works everywhere |
| **Type Safety** | ❌ Separate schemas can drift | ✅ Single schema, enforced |
| **Testing** | ❌ Test each endpoint separately | ✅ Test once, applies to all contexts |
| **API Surface** | ❌ N endpoints (N parent types) | ✅ 1 endpoint with params |
| **New Relationships** | ❌ Create new endpoint | ✅ Just add linkage in entity_instance_link |

#### Common Parent-Child Relationships

```typescript
// All use the create-link-edit pattern:

// Role → Employee
GET /api/v1/employee?parent_type=role&parent_id={id}

// Project → Task
GET /api/v1/task?parent_type=project&parent_id={id}

// Business → Project
GET /api/v1/project?parent_type=business&parent_id={id}

// Office → Business
GET /api/v1/business?parent_type=office&parent_id={id}

// Task → Form
GET /api/v1/form?parent_type=task&parent_id={id}

// Project → Wiki
GET /api/v1/wiki?parent_type=project&parent_id={id}

// Project → Artifact
GET /api/v1/artifact?parent_type=project&parent_id={id}
```

#### Critical Implementation Notes

1. **UUID Type Handling**: Both `entity_instance_link` columns and entity ID columns are UUID type. Do NOT cast in JOIN:
   ```typescript
   // ✅ CORRECT
   INNER JOIN app.entity_instance_link eim ON eim.child_entity_id = e.id

   // ❌ WRONG - causes "operator does not exist: uuid = text" error
   INNER JOIN app.entity_instance_link eim ON eim.child_entity_id = e.id::text
   ```

2. **Conditional Query Logic**: Use separate if/else blocks for WITH JOIN vs WITHOUT JOIN queries to maintain clean SQL:
   ```typescript
   if (parent_type && parent_id) {
     // Full query WITH JOIN
   } else {
     // Full query WITHOUT JOIN (same SELECT columns)
   }
   ```

3. **Column Consistency**: Both query branches MUST select identical columns in identical order.

4. **Avoid Child Endpoints**: Do NOT create `/api/v1/{parent}/{id}/{child}` endpoints. They violate DRY and create maintenance burden.

---

## 3. Database, API & UI/UX Mapping

### Horizontal Scrollbar CSS Implementation

```css
/* /apps/web/src/index.css */

/* Container track - premium gradient with backdrop blur */
.bottom-scrollbar-track {
  background: linear-gradient(180deg,
    rgba(248, 250, 252, 0.98) 0%,
    rgba(241, 245, 249, 0.98) 100%);
  border-top: 1px solid rgba(226, 232, 240, 0.8);
  backdrop-filter: blur(12px) saturate(180%);
  box-shadow:
    0 -4px 16px rgba(99, 102, 241, 0.08),
    0 -2px 8px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Enhanced scrollbar thumb - multi-color gradient */
.bottom-scrollbar-enhanced::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg,
    #a5b4fc 0%,    /* Indigo 300 */
    #818cf8 35%,   /* Indigo 400 */
    #6366f1 70%,   /* Indigo 500 */
    #4f46e5 100%); /* Indigo 600 */
  border-radius: 8px;
  border: 2px solid rgba(248, 250, 252, 0.9);
  box-shadow:
    0 2px 6px rgba(99, 102, 241, 0.25),
    0 0 12px rgba(99, 102, 241, 0.15),
    inset 0 1px 3px rgba(255, 255, 255, 0.5),
    inset 0 -1px 2px rgba(0, 0, 0, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Hover state - brighter gradient with enhanced glow */
.bottom-scrollbar-enhanced::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg,
    #818cf8 0%,
    #6366f1 35%,
    #4f46e5 70%,
    #4338ca 100%);
  box-shadow:
    0 4px 14px rgba(99, 102, 241, 0.45),
    0 0 20px rgba(99, 102, 241, 0.35),
    0 0 32px rgba(99, 102, 241, 0.2),
    inset 0 1px 4px rgba(255, 255, 255, 0.6);
  transform: scaleY(1.15);
}

/* Progress indicator - shows scroll position */
.scrollbar-progress-indicator {
  position: absolute;
  top: 0;
  left: 0;
  height: 2px;
  background: linear-gradient(90deg,
    rgba(99, 102, 241, 0.8) 0%,
    rgba(139, 92, 246, 0.8) 100%);
  box-shadow:
    0 1px 3px rgba(99, 102, 241, 0.4),
    0 0 8px rgba(99, 102, 241, 0.3);
  transition: width 0.15s ease-out;
  border-radius: 0 2px 2px 0;
}
```

### Scrollbar Component Integration

```typescript
// EntityDataTable.tsx - Bottom scrollbar with progress indicator

// State management
const [scrollProgress, setScrollProgress] = useState(0);
const [scrollbarStyles, setScrollbarStyles] = useState({
  left: 0,
  width: 0,
  visible: boolean
});

// Scroll synchronization with progress tracking
const handleTableScroll = () => {
  if (tableContainerRef.current && bottomScrollbarRef.current) {
    bottomScrollbarRef.current.scrollLeft = tableContainerRef.current.scrollLeft;

    // Update progress indicator
    const scrollLeft = tableContainerRef.current.scrollLeft;
    const scrollWidth = tableContainerRef.current.scrollWidth;
    const clientWidth = tableContainerRef.current.clientWidth;
    const maxScroll = scrollWidth - clientWidth;
    const progress = maxScroll > 0 ? (scrollLeft / maxScroll) * 100 : 0;
    setScrollProgress(progress);
  }
};

// Render fixed bottom scrollbar
{scrollbarStyles.visible && (
  <div
    ref={bottomScrollbarRef}
    className="overflow-x-auto overflow-y-hidden bottom-scrollbar-track bottom-scrollbar-enhanced"
    style={{
      position: 'fixed',
      bottom: 0,
      left: `${scrollbarStyles.left}px`,
      width: `${scrollbarStyles.width}px`,
      height: '24px',
      zIndex: 1000,
    }}
    onScroll={handleBottomScroll}
  >
    {/* Progress indicator showing scroll position */}
    <div
      className="scrollbar-progress-indicator"
      style={{ width: `${scrollProgress}%` }}
    />
    {/* Scrollbar content */}
    <div className="scrollbar-content" style={{ height: '1px' }} />
  </div>
)}
```

### Scrollbar Behavior & Triggers

| Condition | Scrollbar Visibility | Behavior |
|-----------|---------------------|----------|
| **≤ 7 columns** | Hidden | Content fits viewport, no overflow |
| **> 7 columns** | **Visible** | Fixed to viewport bottom, synced scroll |
| **Table scrolled** | Visible + Progress | Progress bar updates 0-100% |
| **Hover over scrollbar** | Enhanced glow | Background shifts to blue-tinted gradient |
| **Active drag** | Maximum glow | Deepest gradient with strong shadow |
| **Resize window** | Auto-adjust | Width/position recalculates dynamically |

### Perfect 1:1 Alignment (Current State)

```typescript
// Database entity table
CREATE TABLE app.d_project (
    dl__project_stage text  -- Column name
);

// Settings table (SAME format - perfect alignment)
INSERT INTO app.setting_datalabel (datalabel_name, ui_label, icon, metadata) VALUES
('dl__project_stage', 'Project Stages', 'GitBranch', '[
  {"id": 0, "name": "Initiation", "color_code": "blue"},
  {"id": 1, "name": "Planning", "color_code": "purple"},
  {"id": 2, "name": "Execution", "color_code": "yellow"}
]'::jsonb);

// API endpoint (SAME format)
GET /api/v1/setting?datalabel=dl__project_stage

// Response (SAME format)
{
  "datalabel": "dl__project_stage",
  "data": [...]
}

// Frontend mapping (SAME format - 1:1)
FIELD_TO_SETTING_MAP = {
  'dl__project_stage': 'dl__project_stage'  // Perfect alignment
};
```

### API Context-Independent Endpoints

| Context | URL | API Endpoint | Filter Applied | Data Structure | Scrollbar Trigger |
|---------|-----|-------------|----------------|----------------|-------------------|
| **Main Entity** | `/task` | `GET /api/v1/task` | None (all tasks) | `{data: [{id, code, name, ...}]}` | 7+ columns |
| **Child Entity** | `/project/abc/task` | `GET /api/v1/project/abc/task` | `project_id = abc` | `{data: [{id, code, name, ...}]}` ✅ SAME | 7+ columns |

**Critical Insight:** Different endpoints for server-side filtering, but response structure and **scrollbar behavior** are **identical**.

### True Backend Pagination (DRY Implementation)

**Location:** `/apps/api/src/lib/pagination.ts`

**Problem Solved:** Large datasets (1000+ calendar slots, events, bookings) loading all records at once, causing performance issues.

**Solution:** Reusable pagination utility following DRY principles:

```typescript
// Utility functions
getPaginationParams(query)  // Extract & validate page/limit/offset
paginateQuery(dataQuery, countQuery, page, limit)  // Execute queries in parallel

// Default values
page = 1, limit = 20, max = 100

// Standardized response format
{
  data: [...],        // Current page records
  total: 1250,        // Total record count
  page: 1,            // Current page
  limit: 20,          // Records per page
  totalPages: 63      // Total pages
}
```

**Applied to Endpoints:**
- `GET /api/v1/person-calendar?page=1&limit=20&availability_flag=false`
- `GET /api/v1/event?page=2&limit=50&event_medium=virtual`
- `GET /api/v1/booking?page=3&limit=10`

**Benefits:**
- **Performance**: Only 20 records fetched per page (vs 1000+)
- **Scalability**: Handles unlimited dataset size
- **Consistency**: Same pattern across all endpoints
- **DRY**: Single utility used everywhere

**Complete Status Report:** See [`PAGINATION_STATUS.md`](./PAGINATION_STATUS.md) for detailed implementation status across all 48 API modules

---

## 4. User Interaction Flow Examples

### Scrolling with Progress Indicator

```
User Action: Navigate to /project (10 columns, horizontal overflow)
    ↓
EntityDataTable: Detects overflow (10 > 7 columns)
    scrollbarStyles.visible = true
    ↓
Bottom Scrollbar: Appears fixed to viewport bottom
    ┌────────────────────────────────────────┐
    │ Progress: ░░░░░░░░░░░░░░░░░░░░ (0%)   │
    │ ████████░░░░░░░░░░░░░░░░░░░░░░░░       │
    └────────────────────────────────────────┘
    ↓
User: Drags scrollbar thumb to right
    ↓
Table: Syncs horizontal scroll
    handleBottomScroll() → tableContainer.scrollLeft = bottomScrollbar.scrollLeft
    ↓
Progress Indicator: Updates in real-time
    Progress: (scrollLeft / maxScroll) * 100 = 45%
    ┌────────────────────────────────────────┐
    │ Progress: █████████░░░░░░░░░ (45%)    │
    │         ████████████░░░░░░░░░░░        │
    └────────────────────────────────────────┘
    ↓
User: Hovers over scrollbar
    ↓
Scrollbar Thumb: Transforms with glow effect
    - Gradient shifts to brighter colors
    - Glow shadow intensifies (0.45 opacity)
    - Scale-up animation (scaleY: 1.15)
    ↓
User: Releases scroll
    ↓
Progress: Settles at 45%, smooth ease-out animation
```

### Viewing Data with Scrollbar

1. User navigates to `/project`
2. EntityMainPage fetches: `GET /api/v1/project`
3. Response includes 10 columns: `{dl__project_stage: "Execution", ...}`
4. DataTable detects `dl__project_stage` → LABEL category
5. **Overflow detection**: 10 columns > 7 → Trigger scrollbar
6. Bottom scrollbar appears: 24px height, fixed position
7. Progress indicator: 0% (at start)
8. Preloads settings: `GET /api/v1/setting?datalabel=dl__project_stage`
9. Caches colors: `Map<'Execution', 'yellow'>`
10. Renders: 🟡 Yellow badge "Execution" + horizontal scroll

### Filtering with Scrollbar Active

1. User scrolls horizontally to view last 3 columns
2. Progress indicator shows: 80% (near end)
3. User clicks filter icon on Stage column
4. Dropdown shows options from cache (Portal rendered - no clipping)
5. Each option displays with colored badge
6. User selects "Planning" + "Execution"
7. Table filters to matching rows **without losing scroll position**
8. Progress indicator remains: 80%
9. Applied filters shown as chips with colors

### Inline Editing with Portal Dropdown + Scrollbar

1. User scrolls table to middle columns (progress: 50%)
2. User clicks edit button on row
3. Stage cell becomes dropdown with colored options
4. **Portal Rendering**: Dropdown appears via Portal (no clipping by scrollbar)
   - Button position calculated using `getBoundingClientRect()`
   - Available space checked (above/below button)
   - Dropdown opens upward if near bottom of page
   - Dropdown rendered to `document.body` with `zIndex: 9999`
5. User scrolls table left/right → Dropdown position auto-updates
6. **Scrollbar remains functional** during editing
7. User selects "Monitoring"
8. PUT `/api/v1/project/{id}` with `{dl__project_stage: "Monitoring"}`
9. Dropdown closes, cell updates to 🟠 Orange badge "Monitoring"
10. Scroll position preserved: 50%

---

## 5. Central Configuration & Middleware

### Scrollbar Configuration Constants

```typescript
// Trigger threshold
const SCROLLBAR_COLUMN_THRESHOLD = 7;  // Show scrollbar if > 7 columns

// Visual specifications
const SCROLLBAR_HEIGHT = 24;           // Container height (px)
const SCROLLBAR_THUMB_HEIGHT = 14;     // Thumb height (px)
const PROGRESS_BAR_HEIGHT = 2;         // Progress indicator (px)
const SCROLLBAR_Z_INDEX = 1000;        // Always on top

// Animation timing
const SCROLL_TRANSITION = '0.15s ease-out';  // Progress bar
const THUMB_TRANSITION = '0.3s cubic-bezier(0.4, 0, 0.2, 1)';  // Thumb hover/active
```

### Scrollbar State Management

```typescript
// EntityDataTable state
const [scrollbarStyles, setScrollbarStyles] = useState<{
  left: number;      // X position from viewport left
  width: number;     // Scrollbar width (matches table)
  visible: boolean;  // Show/hide based on overflow
}>({ left: 0, width: 0, visible: false });

const [scrollProgress, setScrollProgress] = useState(0);  // 0-100%

// Visibility calculation
useEffect(() => {
  const updateBottomScrollbar = () => {
    const tableScrollWidth = tableContainer.scrollWidth;
    const tableClientWidth = tableContainer.clientWidth;

    // Show scrollbar if content overflows
    const isVisible = tableScrollWidth > tableClientWidth
                   && tableRect.top < window.innerHeight;

    setScrollbarStyles({
      left: Math.max(0, tableRect.left),
      width: tableClientWidth,
      visible: isVisible
    });
  };

  // Update on resize, scroll, data changes
  window.addEventListener('resize', updateBottomScrollbar);
  window.addEventListener('scroll', updateBottomScrollbar, true);
  resizeObserver.observe(tableContainer);
}, [data.length, columns.length]);
```

---

## 6. Critical Considerations When Building

### ✅ DO - Current Correct Patterns

#### Scrollbar Implementation Patterns

```typescript
// ✅ Use fixed positioning for bottom scrollbar
<div
  className="bottom-scrollbar-track bottom-scrollbar-enhanced"
  style={{
    position: 'fixed',     // Fixed to viewport
    bottom: 0,             // At bottom edge
    left: `${left}px`,     // Aligned with table
    width: `${width}px`,   // Match table width
    height: '24px',        // Sufficient height
    zIndex: 1000           // Above content
  }}
>

// ✅ Sync scroll events bidirectionally
const handleTableScroll = () => {
  bottomScrollbar.scrollLeft = tableContainer.scrollLeft;
  updateProgressIndicator();
};

const handleBottomScroll = () => {
  tableContainer.scrollLeft = bottomScrollbar.scrollLeft;
  updateProgressIndicator();
};

// ✅ Calculate progress dynamically
const progress = (scrollLeft / (scrollWidth - clientWidth)) * 100;

// ✅ Use CSS classes for styling (no inline styles for colors)
className="bottom-scrollbar-track bottom-scrollbar-enhanced"
```

#### Column Definition with Scrollbar Awareness

```typescript
// ✅ CORRECT: Define columns ONCE in entityConfig
export const entityConfigs = {
  project: {
    columns: [
      { key: 'name', title: 'Project Name' },
      { key: 'code', title: 'Code' },
      { key: 'dl__project_stage', title: 'Stage' },
      // ... 5 more columns (8 total → triggers scrollbar)
    ]
  }
};

// ✅ Auto-trigger scrollbar based on column count
if (columns.length > 7) {
  // EntityDataTable automatically shows bottom scrollbar
}
```

#### Database & API Patterns

```sql
-- ✅ Database: Use dl__ prefix
CREATE TABLE app.d_project (
  dl__project_stage text  -- ✅ Correct
);

-- ✅ Settings: Use SAME dl__ prefix (perfect 1:1)
INSERT INTO app.setting_datalabel (datalabel_name, ui_label, icon, metadata) VALUES
('dl__project_stage', 'Project Stages', 'GitBranch', '[
  {"id": 0, "name": "Planning", "color_code": "purple"}
]'::jsonb);  -- ✅ Perfect alignment
```

#### Component Architecture Patterns

```typescript
// ✅ Use shared ColoredDropdown component with Portal
import { ColoredDropdown } from './ColoredDropdown';

{isEditing ? (
  <ColoredDropdown
    value={value}
    options={settingOptions}
    onChange={handleChange}
  />
) : (
  renderSettingBadge(color, value)
)}

// ✅ Use Portal rendering for dropdowns in scrollable containers
{isOpen && createPortal(
  <div style={{ position: 'absolute', zIndex: 9999 }}>
    {/* Dropdown content */}
  </div>,
  document.body  // Render outside container - no scrollbar conflict
)}
```

### ❌ DON'T - Outdated/Wrong Patterns

#### Scrollbar Anti-Patterns

```typescript
// ❌ DON'T use browser default scrollbar
<div className="overflow-x-auto">  // ❌ System scrollbar (inconsistent)
  <table>...</table>
</div>

// ❌ DON'T hardcode scrollbar dimensions
style={{ height: '20px' }}  // ❌ Should be 24px (v3.1 standard)

// ❌ DON'T place scrollbar inside table container
<div className="table-wrapper">
  <table>...</table>
  <div className="scrollbar"></div>  // ❌ Should be fixed to viewport
</div>

// ❌ DON'T forget progress indicator
<div className="bottom-scrollbar">
  {/* Missing progress bar! */}
  <div className="scrollbar-content" />
</div>

// ❌ DON'T use relative positioning
style={{ position: 'relative' }}  // ❌ Should be 'fixed'

// ❌ DON'T skip scroll event cleanup
useEffect(() => {
  window.addEventListener('scroll', handler);
  // ❌ Missing cleanup! Memory leak!
}, []);
```

#### Column Definition Anti-Patterns

```typescript
// ❌ DON'T add parent column conditionally
if (parentType) {
  columns.unshift({ key: 'parent_id', title: 'Parent' });  // ❌ Breaks consistency
}

// ❌ DON'T hardcode what registry auto-detects
columns: [{
  key: 'dl__project_stage',
  width: '150px',              // ❌ Auto-detected (130px)
  loadOptionsFromSettings: true // ❌ Auto-detected from 'dl__' prefix
}];

// ❌ DON'T duplicate dropdown implementation
function MyTable() {
  return (
    <div className="relative">
      <div className="absolute">...</div>  // ❌ Will be clipped by scrollbar!
    </div>
  );
}
```

### Performance Optimization

1. **5-Minute API Cache** - `settingsCache` prevents redundant API calls
2. **Parallel Preloading** - All settings load simultaneously on mount
3. **O(1) Color Lookups** - `settingsColorCache` for instant rendering
4. **useMemo** - Column capabilities computed once
5. **Conditional Loading** - Only preload when needed (edit/filter mode)
6. **Portal Rendering** - Dropdown DOM updates isolated from table re-renders
7. **🆕 Debounced Progress Updates** - Progress bar updates throttled to 60fps
8. **🆕 ResizeObserver** - Efficient scrollbar position recalculation
9. **🆕 Transform instead of position** - GPU-accelerated hover/active states

### Scrollbar Testing Checklist

When implementing or debugging scrollbar:

1. **Visual Appearance** ✅
   - Scrollbar appears when > 7 columns
   - 24px height, fixed to bottom
   - Progress indicator visible (2px top bar)
   - Gradient thumb with rounded corners

2. **Interaction** ✅
   - Dragging thumb scrolls table
   - Scrolling table moves thumb
   - Hover state shows enhanced glow
   - Active state shows deepest gradient

3. **Progress Indicator** ✅
   - Shows 0% at start
   - Shows 100% at end
   - Updates smoothly during scroll
   - Width transitions with ease-out

4. **Responsive Behavior** ✅
   - Window resize → scrollbar width adjusts
   - Window scroll → scrollbar position stays aligned
   - Table resize → visibility recalculates
   - Works on all screen sizes

5. **Performance** ✅
   - No scroll jank (60fps)
   - Cleanup event listeners on unmount
   - ResizeObserver properly disconnects

### Key Files

| File | Purpose |
|------|---------|
| **CSS** | |
| `/apps/web/src/index.css` | **🆕 Next-gen scrollbar styles** (lines 188-294) |
| **Database** | |
| `/db/setting_datalabel.ddl` | Settings table schema with dl__ prefix |
| `/db/11-27_d_*.ddl` | Entity tables with dl__ columns |
| **Backend API** | |
| `/apps/api/src/lib/pagination.ts` | **🆕 DRY Pagination utility** - Reusable pagination for all endpoints |
| `/apps/api/src/modules/setting/routes.ts` | Settings API (direct lookup using `?datalabel=`) |
| `/apps/api/src/modules/person-calendar/routes.ts` | **🆕 Calendar API with pagination** |
| `/apps/api/src/modules/event/routes.ts` | **🆕 Event API with pagination** |
| `/apps/api/src/modules/booking/routes.ts` | **🆕 Booking API with pagination** |
| **Frontend - Base & Extensions** | |
| `/apps/web/src/components/shared/ui/DataTableBase.tsx` | **Base component** - Common table functionality |
| `/apps/web/src/components/shared/ui/SettingsDataTable.tsx` | **Settings extension** - Extends base for settings |
| `/apps/web/src/components/shared/ui/EntityDataTable.tsx` | **🆕 Entity extension** - With bottom scrollbar (lines 374-850, 1643-1687) |
| `/apps/web/src/components/shared/dataTable/FilteredDataTable.tsx` | **Routing layer** - Routes to correct table type |
| **Frontend - Shared Components** | |
| `/apps/web/src/components/shared/ui/ColoredDropdown.tsx` | Shared dropdown - Portal rendering, no clipping |
| **Frontend - Support Libraries** | |
| `/apps/web/src/lib/settingsLoader.ts` | Settings loader & caching |
| `/apps/web/src/lib/fieldCategoryRegistry.ts` | Field category auto-detection |
| `/apps/web/src/lib/universalFormatterService.ts` | Universal formatting & rendering |
| `/apps/web/src/lib/settingsConfig.ts` | Settings configuration & COLOR_OPTIONS |

---

## Summary

**Current Architecture (Perfect 1:1 Alignment + Premium Scrollbar):**
```
Database:     dl__project_stage
Settings:     dl__project_stage     ← SAME!
API:          dl__project_stage     ← SAME!
Frontend:     dl__project_stage     ← SAME!
Scrollbar:    🆕 Auto-triggered     ← When > 7 columns
```

**Zero Hardcoding - Database Drives Everything:**
- Colors from `setting_datalabel.metadata[].color_code`
- Widths from `fieldCategoryRegistry` based on column name
- Endpoints generated dynamically: `/api/v1/setting?datalabel={datalabel}`
- Rendering behavior auto-detected from naming patterns
- **Scrollbar auto-triggered** when column count > 7

**Key Principle:** Name the column correctly with `dl__` prefix → Everything works automatically + Premium scrollbar UX

---

## Summary of Key Innovations

### 1. 🆕 Next-Gen Horizontal Scrollbar (v3.1)
- **Fixed to viewport bottom**: Always visible during scroll
- **Progress indicator**: 2px top bar showing 0-100% scroll position
- **Premium gradient thumb**: Multi-color gradient (indigo shades)
- **Glow effects**: Layered shadows with hover/active states
- **Backdrop blur**: 12px blur + 180% saturation
- **Smooth animations**: 0.3s cubic-bezier transitions
- **Auto-trigger**: Shows when > 7 columns
- **Responsive**: Width/position adjust dynamically

### 2. Context-Independent Columns (v3.1.1)
- **Same columns**: `/task` and `/project/{id}/task` show identical columns
- **No redundancy**: Parent context in URL, not in table columns
- **Single source**: entityConfig columns used everywhere
- **Consistent UX**: Predictable behavior across all views

### 3. OOP Architecture (React Composition)
- **Base Component**: DataTableBase provides common functionality + scrollbar
- **Extensions**: SettingsDataTable, EntityDataTable extend base
- **Benefit**: Fix base → all tables benefit automatically

### 4. Portal Rendering for Dropdowns
- **Problem**: Dropdowns clipped by `overflow-x-auto` in tables
- **Solution**: Render via `createPortal(content, document.body)`
- **Benefit**: Dropdowns always visible, never clipped by scrollbar

### 5. Shared ColoredDropdown Component
- **Reuse**: Used by both EntityDataTable and SettingsDataTable
- **Smart**: Opens upward/downward based on available space
- **Dynamic**: Position updates on scroll/resize
- **Compatible**: Works seamlessly with bottom scrollbar

### 6. Database-Driven Configuration
- **Zero Hardcoding**: Colors, widths, alignment all from database
- **Perfect Alignment**: `dl__project_stage` same everywhere
- **Convention**: Column name determines rendering + scrollbar trigger

### 7. 🆕 True Backend Pagination (v3.2)
- **DRY Utility**: Single reusable pagination module (`pagination.ts`)
- **Standardized Response**: `{ data, total, page, limit, totalPages }`
- **Performance**: 20 records/page (default) vs 1000+ all-at-once
- **Parallel Queries**: Data + count queries execute simultaneously
- **Scalability**: Handles unlimited dataset sizes efficiently

**Last Updated:** 2025-11-06 (v3.2 - DRY Backend Pagination)
**Architecture:** OOP Composition, Portal Rendering, Database-Driven, Zero Hardcoding, Perfect 1:1 Alignment, Premium Scrollbar, True Backend Pagination
**Status:** ✅ Production Ready
