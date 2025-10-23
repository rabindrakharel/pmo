# Settings & Data Labels - Complete Technical Documentation

> **Configuration Engine** - Dynamic dropdown system powering entity fields, sequential state visualization, and workflow management

---

## 📋 Table of Contents

1. [Semantics & Business Context](#semantics--business-context)
2. [Architecture & Design Patterns](#architecture--design-patterns)
3. [Database, API & UI/UX Mapping](#database-api--uiux-mapping)
4. [DRY Principles & Entity Relationships](#dry-principles--entity-relationships)
5. [Central Configuration & Middleware](#central-configuration--middleware)
6. [User Interaction Flow Examples](#user-interaction-flow-examples)
7. [Critical Considerations When Editing](#critical-considerations-when-editing)

---

## Semantics & Business Context

### Business Purpose

**Settings (Data Labels)** serve as the configuration backbone for the PMO platform. They provide:
- **Dynamic dropdowns** that business users can modify without code changes
- **Sequential state workflows** for projects, tasks, and sales pipelines
- **Hierarchical categorization** for offices, businesses, and organizational structures
- **Workflow standardization** ensuring consistent data across all entities
- **Business flexibility** to adapt the system to changing organizational needs

### Business Workflows

#### Settings Lifecycle
```
Define → Populate → Integrate → Display → Update → Archive
   ↓        ↓          ↓          ↓         ↓         ↓
Create   Seed     Link to    Dropdown  Modify   Soft
DDL      Data     Entities    UI       Values   Delete
```

#### Settings Usage Pattern
```
Entity Field → loadOptionsFromSettings → API Request → Settings Table → Dropdown
      ↓                                                                      ↓
   project_stage                                                    Selection
      ↓                                                                      ↓
   API Mapping                                                        Save to Entity
      ↓                                                                      ↓
   setting_datalabel_project_stage                              d_project.project_stage
```

### Key Business Rules

**Settings Tables:**
- **Naming convention**: All use `setting_datalabel_` prefix (e.g., `setting_datalabel_project_stage`)
- **Snake_case mapping**: API category matches table name without prefix
- **Active flag filtering**: Only `active_flag = true` records appear in dropdowns
- **Sort order control**: `sort_order` field determines display sequence

**Sequential States:**
- **Linear progression**: Stages/funnels follow defined workflow sequences
- **Parent-child relationships**: `parent_id` enables graph-like workflow visualization
- **Terminal states**: Some stages (Done, Cancelled) have no forward transitions
- **Visual timeline**: SequentialStateVisualizer component renders progress

**Hierarchical Levels:**
- **Multi-level structures**: Office (4 levels), Business (3 levels)
- **Root/leaf indicators**: `is_root`, `is_leaf` flags for tree structures
- **Authority description**: Management levels have authority scope definitions

### Real-World Use Cases

| Settings Category | Entity Field | Business Purpose | Workflow Impact |
|-------------------|--------------|------------------|-----------------|
| project_stage | project.project_stage | PMI lifecycle tracking | Stage gates, approvals, reporting |
| task_stage | task.stage | Agile/Kanban workflow | Sprint velocity, burndown charts |
| opportunity_funnel_stage | client.opportunity_stage | Sales pipeline | Conversion rates, forecasting |
| task_priority | task.priority_level | Work prioritization | Resource allocation, urgency |
| office_level | office.level | Org hierarchy | Reporting structure, delegation |
| acquisition_channel | client.acquisition_channel | Marketing ROI | Channel effectiveness analysis |

---

## Architecture & Design Patterns

### Settings System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SETTINGS SYSTEM LAYERS                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  💾 DATABASE LAYER                                              │
│  ├─ 17 setting_datalabel_* tables                              │
│  │  ├─ Sequential States (7): project_stage, task_stage, ...  │
│  │  ├─ Hierarchical Levels (5): office_level, business_level  │
│  │  └─ Categorization (5): industry_sector, customer_tier     │
│  └─ Normalized schema with active_flag, sort_order            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔌 API LAYER (Fastify)                                         │
│  ├─ GET /api/v1/setting?category=project_stage                 │
│  ├─ Category-to-table mapping (snake_case)                     │
│  ├─ JSON response with normalized structure                    │
│  └─ No authentication required (public configuration)          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ⚙️  FRONTEND CONFIG                                            │
│  ├─ entityConfig.ts: loadOptionsFromSettings: true             │
│  ├─ sequentialStateConfig.ts: Auto-detect patterns             │
│  ├─ Dynamic loading on component mount                         │
│  └─ Cache settings in component state                          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🎨 UI COMPONENTS                                               │
│  ├─ Dropdown (Standard)       → Select from settings           │
│  ├─ SequentialStateVisualizer → Timeline with progress dots    │
│  ├─ InlineEditor              → Edit entity field values       │
│  └─ HierarchicalSelector      → Tree picker for office/biz     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Design Patterns

#### 1. **Category-to-Table Mapping Pattern**

Frontend specifies category, API maps to table:

```typescript
// Frontend: entityConfig.ts
{
  key: 'project_stage',
  loadOptionsFromSettings: true  // ← Triggers auto-loading
}

// API mapping: setting/routes.ts
category=project_stage → setting_datalabel_project_stage

// Query executed:
SELECT level_id, level_name, sort_order, parent_id
FROM setting_datalabel_project_stage
WHERE active_flag = true
ORDER BY sort_order ASC
```

**Naming Convention:**
```
Field: project_stage
API Category: project_stage (snake_case)
Table: setting_datalabel_project_stage (prefix + category)
```

#### 2. **Sequential State Visualization**

Auto-detection based on field name patterns:

```typescript
// sequentialStateConfig.ts
SEQUENTIAL_STATE_PATTERNS = [
  'stage',     // project_stage, task_stage, opportunity_funnel_stage
  'funnel',    // opportunity_funnel_stage
  'status',    // form_submission_status, wiki_publication_status
  'level'      // Hierarchical levels (conditional)
]

// If field matches pattern → SequentialStateVisualizer
// Else → Standard dropdown
```

**Visual Format:**
```
● Initiation → ● Planning → ● Execution → ○ Monitoring → ○ Closure
  ↑ Past         ↑ Past       ↑ Current      ↑ Future      ↑ Future
```

#### 3. **Hierarchical Level Pattern**

Multi-level structures with parent references:

```
Office Hierarchy (4 levels):
└─ Corporate (level_id=4)
   └─ Region (level_id=3, parent_id=4)
      └─ District (level_id=2, parent_id=3)
         └─ Office (level_id=1, parent_id=2)
```

#### 4. **Active Flag Filtering**

All settings queries filter by `active_flag = true`:

```sql
-- Only active settings appear in dropdowns
WHERE active_flag = true

-- Soft delete → removes from dropdowns immediately
UPDATE setting_datalabel_project_stage
SET active_flag = false
WHERE level_id = 5;
```

---

## Database, API & UI/UX Mapping

### Database Schema

#### Settings Table Structure

**Common Pattern:** All 17 tables follow similar structure

```sql
CREATE TABLE app.setting_datalabel_{category} (
    -- Primary key (integer or UUID)
    level_id integer PRIMARY KEY,  -- or stage_id for stage tables

    -- Display names
    level_name varchar(50) NOT NULL UNIQUE,  -- or stage_name
    level_descr text,                        -- or stage_descr

    -- Ordering & hierarchy
    sort_order integer,
    parent_id integer,  -- For graph-like relationships

    -- Status
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now()
);
```

#### 17 Setting Tables

| Table Name | Category | Type | Purpose |
|------------|----------|------|---------|
| `setting_datalabel_project_stage` | project_stage | Sequential State | PMI project lifecycle stages |
| `setting_datalabel_task_stage` | task_stage | Sequential State | Agile/Kanban task workflow |
| `setting_datalabel_opportunity_funnel_stage` | opportunity_funnel_stage | Sequential State | Sales pipeline stages |
| `setting_datalabel_form_submission_status` | form_submission_status | Sequential State | Form submission workflow |
| `setting_datalabel_form_approval_status` | form_approval_status | Sequential State | Form approval workflow |
| `setting_datalabel_wiki_publication_status` | wiki_publication_status | Sequential State | Wiki publishing states |
| `setting_datalabel_task_update_type` | task_update_type | Sequential State | Task comment categories |
| `setting_datalabel_office_level` | office_level | Hierarchical | 4-level office structure |
| `setting_datalabel_business_level` | business_level | Hierarchical | 3-level business structure |
| `setting_datalabel_position_level` | position_level | Hierarchical | Employee position hierarchy |
| `setting_datalabel_cust_level` | client_level | Hierarchical | Client tier classification |
| `setting_datalabel_industry_sector` | industry_sector | Categorization | Client industry codes |
| `setting_datalabel_acquisition_channel` | acquisition_channel | Categorization | Marketing channels |
| `setting_datalabel_customer_tier` | customer_tier | Categorization | Service tier levels |
| `setting_datalabel_cust_service` | client_service | Categorization | Service offerings |
| `setting_datalabel_cust_status` | client_status | Categorization | Client account status |
| `setting_datalabel_task_priority` | task_priority | Categorization | Task priority levels |

#### Example: Project Stage Table

**Location:** `db/setting_datalabel__project_stage.ddl`

```sql
CREATE TABLE app.setting_datalabel_project_stage (
    level_id integer PRIMARY KEY,
    level_name varchar(50) NOT NULL UNIQUE,
    level_descr text,
    sort_order integer,
    parent_id integer,  -- Workflow graph relationships
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now()
);

-- Seed data
INSERT INTO app.setting_datalabel_project_stage VALUES
(0, 'Initiation', 'Project concept and initial planning', 1, NULL),
(1, 'Planning', 'Detailed project planning', 2, 0),
(2, 'Execution', 'Active project execution', 3, 1),
(3, 'Monitoring', 'Progress tracking', 4, 2),
(4, 'Closure', 'Project completion', 5, 3),
(5, 'On Hold', 'Temporarily suspended', 6, 2),
(6, 'Cancelled', 'Terminated before completion', 7, NULL);
```

### API Endpoints

**Location:** `apps/api/src/modules/setting/routes.ts`

#### Get Settings by Category

```typescript
// List settings for a category
GET /api/v1/setting?category=project_stage
Response: {
  data: [
    {
      id: "0",
      level_name: "Initiation",
      level_descr: "Project concept and initial planning",
      level_id: 0,
      sort_order: 1,
      parent_id: null,
      active_flag: true,
      created: "2025-01-15T10:00:00Z",
      updated: "2025-01-15T10:00:00Z"
    },
    {
      id: "1",
      level_name: "Planning",
      level_id: 1,
      sort_order: 2,
      parent_id: 0,
      active_flag: true
    }
    // ... more stages
  ],
  category: "project_stage"
}

// Filter only active settings (default)
GET /api/v1/setting?category=task_stage&active=true

// Include inactive settings
GET /api/v1/setting?category=task_stage&active=false
```

**API Behavior:**
- No authentication required (public configuration)
- Always filters by `active_flag` unless specified
- Returns normalized structure across all categories
- Uses snake_case for all field names

#### Category-to-Table Mapping

```typescript
// API maps category to table (apps/api/src/modules/setting/routes.ts)
const CATEGORY_MAPPINGS = {
  'project_stage':           'setting_datalabel_project_stage',
  'task_stage':              'setting_datalabel_task_stage',
  'task_priority':           'setting_datalabel_task_priority',
  'opportunity_funnel_stage': 'setting_datalabel_opportunity_funnel_stage',
  'office_level':            'setting_datalabel_office_level',
  'business_level':          'setting_datalabel_business_level',
  'position_level':          'setting_datalabel_position_level',
  'industry_sector':         'setting_datalabel_industry_sector',
  'acquisition_channel':     'setting_datalabel_acquisition_channel',
  'customer_tier':           'setting_datalabel_customer_tier',
  'client_level':            'setting_datalabel_cust_level',
  'client_status':           'setting_datalabel_cust_status',
  'client_service':          'setting_datalabel_cust_service',
  'form_submission_status':  'setting_datalabel_form_submission_status',
  'form_approval_status':    'setting_datalabel_form_approval_status',
  'wiki_publication_status': 'setting_datalabel_wiki_publication_status',
  'task_update_type':        'setting_datalabel_task_update_type'
};
```

### UI/UX Components

#### Component Hierarchy

```
Entity Form (e.g., Project Create/Edit)
├─ EntityFormContainer
│  ├─ Field: project_stage (loadOptionsFromSettings: true)
│  │  └─ Check SEQUENTIAL_STATE_PATTERNS
│  │     ├─ Match 'stage' pattern → SequentialStateVisualizer
│  │     └─ No match → Standard Dropdown
│  │
│  └─ Field: office_id (loadOptionsFromSettings: true)
│     └─ Check if hierarchical
│        ├─ Has parent_id → HierarchicalSelector (future)
│        └─ Flat list → Standard Dropdown
│
Settings Loading Hook
├─ useSettings(category)
│  ├─ GET /api/v1/setting?category={category}
│  ├─ Cache results in React state
│  └─ Return { options, loading, error }
│
SequentialStateVisualizer
├─ Receives: stages, currentValue, onChange
├─ Renders: Timeline with clickable dots
└─ Highlights: Past (blue), Current (blue+ring), Future (gray)
```

#### EntityConfig Integration

**Location:** `apps/web/src/lib/entityConfig.ts`

```typescript
export const entityConfigs = {
  project: {
    columns: [
      {
        key: 'project_stage',
        title: 'Stage',
        inlineEditable: true,
        loadOptionsFromSettings: true  // ← Auto-loads from API
      }
    ],
    fields: [
      {
        key: 'project_stage',
        label: 'Project Stage',
        type: 'select',
        loadOptionsFromSettings: true  // ← Auto-loads from API
      }
    ]
  },

  task: {
    columns: [
      {
        key: 'stage',
        title: 'Stage',
        inlineEditable: true,
        loadOptionsFromSettings: true,  // category=task_stage
        render: (value) => <Badge>{value}</Badge>
      }
    ]
  }
};
```

#### Sequential State Detection

**Location:** `apps/web/src/lib/sequentialStateConfig.ts`

```typescript
// Auto-detect sequential states by field name
export const SEQUENTIAL_STATE_PATTERNS = [
  'stage',      // project_stage, task_stage, opportunity_funnel_stage
  'funnel',     // opportunity_funnel_stage
  'pipeline',   // sales_pipeline (future)
  'status',     // form_submission_status, wiki_publication_status
  'level'       // office_level, business_level (conditional)
];

// Explicit whitelist for edge cases
export const SEQUENTIAL_STATE_EXPLICIT_INCLUDES = [
  'project_stage',
  'task_stage',
  'opportunity_funnel_stage',
  'form_submission_status',
  'form_approval_status',
  'wiki_publication_status'
];

// Fields that match pattern but are NOT sequential
export const SEQUENTIAL_STATE_EXPLICIT_EXCLUDES = [
  'active_flag',   // Boolean, not sequential
  'is_complete',   // Boolean
  'priority_level' // Categorical, not sequential
];
```

---

## DRY Principles & Entity Relationships

### Reusable Component Patterns

#### 1. **Settings Hook** - Single Fetcher for All Categories

**Instead of:**
```typescript
// ❌ BAD: Separate hooks for each category
function useProjectStages() { /* fetch logic */ }
function useTaskStages() { /* same fetch logic */ }
function usePriorities() { /* same fetch logic again */ }
```

**We use:**
```typescript
// ✅ GOOD: One hook for all categories
function useSettings(category: string) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/setting?category=${category}`)
      .then(res => res.json())
      .then(data => setOptions(data.data));
  }, [category]);

  return { options, loading };
}

// Usage
const { options: projectStages } = useSettings('project_stage');
const { options: taskStages } = useSettings('task_stage');
const { options: priorities } = useSettings('task_priority');
```

#### 2. **loadOptionsFromSettings** - Automatic API Integration

**Instead of:**
```typescript
// ❌ BAD: Hardcoded options in entity config
{
  key: 'priority_level',
  type: 'select',
  options: [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' }
  ]
}
```

**We use:**
```typescript
// ✅ GOOD: Dynamic loading from API
{
  key: 'priority_level',
  type: 'select',
  loadOptionsFromSettings: true  // ← API call: category=task_priority
}

// EntityFormContainer automatically:
// 1. Detects loadOptionsFromSettings: true
// 2. Calls GET /api/v1/setting?category=task_priority
// 3. Maps response to dropdown options
```

#### 3. **Sequential State Auto-Detection**

**Instead of:**
```typescript
// ❌ BAD: Manual configuration for each sequential field
if (field.key === 'project_stage') return <SequentialStateVisualizer />;
if (field.key === 'task_stage') return <SequentialStateVisualizer />;
if (field.key === 'opportunity_funnel_stage') return <SequentialStateVisualizer />;
```

**We use:**
```typescript
// ✅ GOOD: Pattern-based auto-detection
function shouldUseSequentialVisualizer(fieldKey: string): boolean {
  return SEQUENTIAL_STATE_PATTERNS.some(pattern =>
    fieldKey.includes(pattern)
  ) || SEQUENTIAL_STATE_EXPLICIT_INCLUDES.includes(fieldKey);
}

// Automatically uses SequentialStateVisualizer for matching fields
```

### Entity Relationships

```
Settings Tables (Configuration)
  │
  ├─ Entity Fields (1:Many)
  │  ├─ d_project.project_stage → setting_datalabel_project_stage
  │  ├─ d_task.stage → setting_datalabel_task_stage
  │  ├─ d_task.priority_level → setting_datalabel_task_priority
  │  ├─ d_client.industry_sector → setting_datalabel_industry_sector
  │  ├─ d_office.level → setting_datalabel_office_level
  │  └─ d_business.level → setting_datalabel_business_level
  │
  └─ UI Components (Many:1)
     ├─ Dropdowns consume settings
     ├─ SequentialStateVisualizer renders stages
     ├─ KanbanBoard groups by stage settings
     └─ Reports aggregate by stage/level
```

**Database Query: Get All Projects in Execution Stage**
```sql
SELECT p.*
FROM d_project p
INNER JOIN setting_datalabel_project_stage s
  ON p.project_stage = s.level_name
WHERE s.level_name = 'Execution'
  AND s.active_flag = true
  AND p.active_flag = true;
```

**Database Query: Task Stage Distribution**
```sql
SELECT
  s.level_name as stage,
  s.sort_order,
  COUNT(t.id) as task_count
FROM setting_datalabel_task_stage s
LEFT JOIN d_task t ON t.stage = s.level_name AND t.active_flag = true
WHERE s.active_flag = true
GROUP BY s.level_name, s.sort_order
ORDER BY s.sort_order;
```

**Settings Change Impact:**
```
Change setting_datalabel_project_stage:
├─ Dropdown options update immediately (next API call)
├─ Existing project stages remain valid
├─ Soft delete (active_flag=false) removes from dropdown
└─ No CASCADE delete (entity fields store level_name as string)
```

---

## Central Configuration & Middleware

### Settings API Architecture

**Location:** `apps/api/src/modules/setting/routes.ts`

```typescript
// Single endpoint serves all 17 settings categories
fastify.get('/api/v1/setting', async (request, reply) => {
  const { category, active } = request.query;

  // Category-to-table mapping
  if (category === 'project_stage') {
    return db.query(`
      SELECT level_id::text as id,
             level_name,
             level_descr,
             sort_order,
             parent_id
      FROM setting_datalabel_project_stage
      WHERE active_flag = ${active !== false}
      ORDER BY sort_order ASC
    `);
  }

  // ... 16 more category mappings
});
```

**No Authentication Required:**
```typescript
// Settings are PUBLIC configuration
// No JWT check, no RBAC gate
// Available to anonymous users
```

### Entity Configuration Registry

**Location:** `apps/web/src/lib/entityConfig.ts`

```typescript
// All entity fields reference settings via loadOptionsFromSettings
export const entityConfigs = {
  project: {
    fields: [
      { key: 'project_stage', loadOptionsFromSettings: true },
      { key: 'office_level', loadOptionsFromSettings: true }
    ]
  },

  task: {
    fields: [
      { key: 'stage', loadOptionsFromSettings: true },
      { key: 'priority_level', loadOptionsFromSettings: true }
    ]
  },

  client: {
    fields: [
      { key: 'industry_sector', loadOptionsFromSettings: true },
      { key: 'acquisition_channel', loadOptionsFromSettings: true },
      { key: 'opportunity_funnel_stage', loadOptionsFromSettings: true }
    ]
  }
};
```

### Sequential State Configuration

**Location:** `apps/web/src/lib/sequentialStateConfig.ts`

```typescript
// Centralized pattern matching for sequential states
export const SEQUENTIAL_STATE_CONFIG = {
  patterns: ['stage', 'funnel', 'status', 'pipeline'],

  explicitIncludes: [
    'project_stage',
    'task_stage',
    'opportunity_funnel_stage',
    'form_submission_status',
    'wiki_publication_status'
  ],

  explicitExcludes: [
    'active_flag',
    'priority_level'
  ]
};

export function isSequentialState(fieldKey: string): boolean {
  if (SEQUENTIAL_STATE_CONFIG.explicitExcludes.includes(fieldKey)) {
    return false;
  }

  if (SEQUENTIAL_STATE_CONFIG.explicitIncludes.includes(fieldKey)) {
    return true;
  }

  return SEQUENTIAL_STATE_CONFIG.patterns.some(pattern =>
    fieldKey.toLowerCase().includes(pattern)
  );
}
```

### Frontend Middleware

**Location:** `apps/web/src/components/shared/entity/EntityFormContainer.tsx`

```typescript
// Auto-loads settings for fields marked with loadOptionsFromSettings
useEffect(() => {
  const fieldsNeedingSettings = config.fields
    .filter(f => f.loadOptionsFromSettings)
    .map(f => f.key);

  // Load all required settings in parallel
  Promise.all(
    fieldsNeedingSettings.map(fieldKey =>
      fetch(`/api/v1/setting?category=${fieldKey}`)
        .then(res => res.json())
    )
  ).then(results => {
    // Cache settings in component state
    setSettingsCache(results);
  });
}, [config]);
```

---

## User Interaction Flow Examples

### Example 1: Create Project with Stage Dropdown

**User Actions:**
1. Navigate to `/project/new`
2. Fill project name: "Digital Transformation"
3. Click "Project Stage" dropdown
4. Dropdown auto-populates from settings
5. Select "Planning"
6. Click "Save"

**System Flow:**
```
Frontend                         API                            Database
--------                         ---                            --------
1. EntityFormContainer mounts
   └─ Detects project_stage has loadOptionsFromSettings: true

2. Auto-load settings
   └─ GET /api/v1/setting?category=project_stage
                                ├→ Query setting_datalabel_project_stage
                                   SELECT level_name, sort_order
                                   WHERE active_flag = true
                                   ORDER BY sort_order ASC
   ←─ Returns:
      {
        data: [
          { id: "0", level_name: "Initiation", sort_order: 1 },
          { id: "1", level_name: "Planning", sort_order: 2 },
          { id: "2", level_name: "Execution", sort_order: 3 },
          ...
        ]
      }

3. Render dropdown
   └─ Options: Initiation, Planning, Execution, Monitoring, Closure

4. User selects "Planning"
   └─ formValues.project_stage = "Planning"

5. User clicks "Save"
   └─ POST /api/v1/project
      Body: {
        name: "Digital Transformation",
        project_stage: "Planning"        ← Stores level_name
      }
                                ├→ INSERT INTO d_project
                                   (name, project_stage)
                                   VALUES ('Digital...', 'Planning')
   ←─ 201 Created

6. navigate(`/project/${created.id}`)
```

### Example 2: Sequential State Visualizer on Task Edit

**User Actions:**
1. Navigate to `/task/a1111111-1111-1111-1111-111111111111`
2. Click "Edit" button
3. See task stage as interactive timeline (not dropdown)
4. Current stage: "In Progress" (highlighted)
5. Click "In Review" to advance
6. Timeline updates with animation

**System Flow:**
```
Frontend                         API                            Database
--------                         ---                            --------
1. EntityDetailPage loads
   └─ GET /api/v1/task/{id}
                                ├→ SELECT * FROM d_task
                                   WHERE id = $id
   ←─ Returns: { id, name, stage: "In Progress" }

2. Edit mode activated
   └─ EntityFormContainer
      ├─ Field: stage (loadOptionsFromSettings: true)
      └─ Check isSequentialState('stage') → TRUE

3. Load settings for timeline
   └─ GET /api/v1/setting?category=task_stage
                                ├→ SELECT * FROM setting_datalabel_task_stage
                                   ORDER BY sort_order ASC
   ←─ Returns:
      [
        { level_name: "Backlog", sort_order: 1 },
        { level_name: "To Do", sort_order: 2 },
        { level_name: "In Progress", sort_order: 3 },
        { level_name: "In Review", sort_order: 4 },
        { level_name: "Done", sort_order: 5 }
      ]

4. Render SequentialStateVisualizer
   └─ Timeline: ● Backlog → ● To Do → ● In Progress → ○ In Review → ○ Done
                 ↑ Blue       ↑ Blue    ↑ Blue+ring    ↑ Gray         ↑ Gray

5. User clicks "In Review"
   └─ onChange('In Review')
      └─ formValues.stage = "In Review"

6. Auto-save (inline edit)
   └─ PUT /api/v1/task/{id}
      Body: { stage: "In Review" }
                                ├→ UPDATE d_task
                                   SET stage = 'In Review',
                                       version = version + 1,
                                       updated_ts = now()
                                   WHERE id = $id
   ←─ 200 OK

7. Timeline updates
   └─ ● Backlog → ● To Do → ● In Progress → ● In Review → ○ Done
      ↑ Blue       ↑ Blue    ↑ Blue          ↑ Blue+ring  ↑ Gray
```

### Example 3: Business User Adds New Task Priority

**User Actions:**
1. Navigate to `/settings` (admin page)
2. Select "Task Priority" category
3. Click "+ Add Priority"
4. Enter:
   - level_name: "Critical"
   - sort_order: 0 (highest)
5. Click "Save"
6. New priority appears in all task dropdowns immediately

**System Flow:**
```
Frontend                         API                            Database
--------                         ---                            --------
1. SettingsManagementPage
   └─ GET /api/v1/setting?category=task_priority
                                ├→ SELECT * FROM setting_datalabel_task_priority
   ←─ Current priorities: Low, Medium, High

2. User fills form
   └─ { level_name: "Critical", sort_order: 0 }

3. Submit new priority
   └─ POST /api/v1/setting (future endpoint)
      Body: {
        category: "task_priority",
        level_name: "Critical",
        sort_order: 0,
        active_flag: true
      }
                                ├→ INSERT INTO setting_datalabel_task_priority
                                   (level_name, sort_order, active_flag)
                                   VALUES ('Critical', 0, true)
   ←─ 201 Created

4. Frontend refreshes settings cache
   └─ All components with task_priority dropdown reload
      └─ New options: Critical, Low, Medium, High
```

### Example 4: Kanban Board Auto-Grouped by Stage Settings

**User Actions:**
1. Navigate to `/task` (list view)
2. Switch to "Kanban" view
3. Columns appear automatically based on task_stage settings
4. Drag task from "To Do" to "In Progress"
5. Task updates in database

**System Flow:**
```
Frontend                         API                            Database
--------                         ---                            --------
1. KanbanBoard mounts
   ├─ GET /api/v1/setting?category=task_stage
   │                          ├→ SELECT * FROM setting_datalabel_task_stage
   │                             ORDER BY sort_order ASC
   ←─ Stages: Backlog, To Do, In Progress, In Review, Done
   │
   └─ GET /api/v1/task
                                ├→ SELECT * FROM d_task
                                   WHERE active_flag = true
   ←─ Tasks: [{id, name, stage}, ...]

2. Group tasks by stage
   └─ {
        "Backlog": [task1, task2],
        "To Do": [task3],
        "In Progress": [task4, task5],
        "In Review": [],
        "Done": [task6]
      }

3. Render columns
   └─ [Backlog: 2] [To Do: 1] [In Progress: 2] [In Review: 0] [Done: 1]
      └─ Column order determined by sort_order from settings

4. User drags task3 from "To Do" to "In Progress"
   └─ onCardMove(task3.id, "In Progress")
      └─ PUT /api/v1/task/{task3.id}
         Body: { stage: "In Progress" }
                                ├→ UPDATE d_task
                                   SET stage = 'In Progress'
   ←─ 200 OK

5. UI updates
   └─ [Backlog: 2] [To Do: 0] [In Progress: 3] [In Review: 0] [Done: 1]
```

---

## Critical Considerations When Editing

### ⚠️ Breaking Changes to Avoid

#### 1. **Table Naming Convention** ⭐⭐⭐ CRITICAL

**DO NOT rename settings tables:**

```sql
-- ❌ DANGEROUS: Breaks API mapping
ALTER TABLE setting_datalabel_project_stage
RENAME TO project_stage_settings;

-- Frontend expects: setting_datalabel_{category}
-- API mapping:      category → setting_datalabel_{category}
```

**Why Critical:**
- API has hardcoded category-to-table mappings
- Frontend assumes `setting_datalabel_` prefix
- Renaming breaks all dropdowns using that category

**Files to Watch:**
- `apps/api/src/modules/setting/routes.ts` - All category mappings
- 17 DDL files: `db/setting_datalabel__*.ddl`

#### 2. **Field Name Standards**

Settings tables use different field names but API normalizes them:

```sql
-- Some tables use level_name
CREATE TABLE setting_datalabel_project_stage (
  level_name varchar(50)  -- ✅
);

-- Others use stage_name
CREATE TABLE setting_datalabel_opportunity_funnel_stage (
  stage_name varchar(50)  -- ✅
);

-- API normalizes to common structure
SELECT level_name FROM ... -- → returns "name" field
SELECT stage_name FROM ... -- → returns "name" field
```

**DO NOT mix naming within same table:**
```sql
-- ❌ BAD: Inconsistent naming
CREATE TABLE setting_datalabel_project_stage (
  stage_name varchar(50),  -- Should be level_name!
  level_descr text
);
```

#### 3. **Active Flag Filtering**

All dropdowns filter by `active_flag = true`:

```sql
-- ✅ GOOD: Soft delete removes from dropdowns
UPDATE setting_datalabel_project_stage
SET active_flag = false
WHERE level_name = 'On Hold';

-- ❌ DANGEROUS: Hard delete breaks referential integrity (if foreign keys exist)
DELETE FROM setting_datalabel_project_stage
WHERE level_name = 'On Hold';
```

**Impact:**
- `active_flag = false` → Removed from NEW form dropdowns
- Existing entity records keep old values (string storage)
- No CASCADE delete issues

#### 4. **Sort Order Must Be Unique**

Sequential states depend on sort_order for display sequence:

```sql
-- ❌ BAD: Duplicate sort_order breaks timeline
INSERT INTO setting_datalabel_project_stage VALUES
(0, 'Initiation', 'Starting', 1, NULL),
(1, 'Planning', 'Planning', 1, 0);  -- Same sort_order!

-- ✅ GOOD: Unique sort_order
INSERT INTO setting_datalabel_project_stage VALUES
(0, 'Initiation', 'Starting', 1, NULL),
(1, 'Planning', 'Planning', 2, 0);  -- Unique!
```

**Why:** SequentialStateVisualizer orders stages by `sort_order ASC`. Duplicates cause unpredictable display order.

#### 5. **Parent ID Relationships**

`parent_id` creates graph-like workflow relationships:

```sql
-- Valid relationships
(1, 'Planning', 2, 0),       -- Planning follows Initiation (parent_id=0)
(2, 'Execution', 3, 1),      -- Execution follows Planning (parent_id=1)
(5, 'On Hold', 6, 2),        -- On Hold branches from Execution (parent_id=2)

-- ❌ BAD: Circular reference
(0, 'Initiation', 1, 6),     -- parent_id=6 (Cancelled)
(6, 'Cancelled', 7, 0);      -- parent_id=0 (Initiation)  → CIRCULAR!
```

**Why:** Circular `parent_id` references break workflow visualization graphs.

#### 6. **Category Name Must Match Field Key**

Frontend expects exact snake_case match:

```typescript
// ✅ GOOD: Field key matches API category
{
  key: 'project_stage',             // Field in entity
  loadOptionsFromSettings: true     // Category = 'project_stage'
}
// API: GET /api/v1/setting?category=project_stage
// Table: setting_datalabel_project_stage

// ❌ BAD: Mismatch breaks auto-loading
{
  key: 'projectStage',              // camelCase!
  loadOptionsFromSettings: true     // Category = 'projectStage' → NO TABLE!
}
```

#### 7. **Don't Store level_id in Entity Tables**

Entity fields store `level_name` (string), not `level_id` (integer):

```sql
-- ✅ GOOD: Store display name
CREATE TABLE d_project (
  project_stage text  -- Stores "Planning", not 1
);

-- ❌ BAD: Integer reference requires JOIN
CREATE TABLE d_project (
  project_stage_id integer  -- Requires JOIN for display
);
```

**Why:**
- Simple queries: `WHERE project_stage = 'Planning'`
- No JOIN overhead for display
- Resilient to settings table changes
- Trade-off: No foreign key enforcement

---

### 🔧 Safe Modification Patterns

#### Adding New Settings Category

**1. Create DDL File** (`db/setting_datalabel__risk_level.ddl`)
```sql
CREATE TABLE app.setting_datalabel_risk_level (
    level_id integer PRIMARY KEY,
    level_name varchar(50) NOT NULL UNIQUE,
    level_descr text,
    sort_order integer,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now()
);

INSERT INTO app.setting_datalabel_risk_level VALUES
(1, 'Low', 'Minimal risk', 1, true),
(2, 'Medium', 'Moderate risk', 2, true),
(3, 'High', 'Significant risk', 3, true);
```

**2. Add API Mapping** (`apps/api/src/modules/setting/routes.ts`)
```typescript
} else if (category === 'risk_level') {
  query = sql`
    SELECT
      level_id::text as id,
      level_name,
      level_descr,
      sort_order,
      active_flag
    FROM app.setting_datalabel_risk_level
    WHERE active_flag = ${active !== false}
    ORDER BY sort_order ASC
  `;
  categoryName = 'risk_level';
}
```

**3. Add to Entity Config** (`apps/web/src/lib/entityConfig.ts`)
```typescript
project: {
  fields: [
    // ... existing fields
    {
      key: 'risk_level',
      label: 'Risk Level',
      type: 'select',
      loadOptionsFromSettings: true  // Auto-loads from API
    }
  ]
}
```

**4. Run Database Import**
```bash
./tools/db-import.sh
# Adds new DDL file to schema
```

#### Adding Sequential State Visualization

**1. Ensure Field Name Matches Pattern**
```typescript
// Field must contain 'stage', 'funnel', 'status', or 'pipeline'
{
  key: 'project_stage'  // ✅ Contains 'stage'
}
```

**2. Add to Explicit Includes (if needed)**
```typescript
// apps/web/src/lib/sequentialStateConfig.ts
export const SEQUENTIAL_STATE_EXPLICIT_INCLUDES = [
  'project_stage',
  'task_stage',
  'risk_level'  // ← Add new sequential field
];
```

**3. Verify Settings Have sort_order**
```sql
-- Must have sort_order for timeline sequencing
SELECT level_name, sort_order
FROM setting_datalabel_risk_level
ORDER BY sort_order ASC;
```

---

### 📝 Testing Checklist

When modifying settings system, verify:

- [ ] **Table naming** follows `setting_datalabel_{category}` convention
- [ ] **Category name** matches field key in snake_case
- [ ] **API mapping** added to setting/routes.ts
- [ ] **sort_order** values are unique and sequential
- [ ] **active_flag** filtering works correctly
- [ ] **parent_id** relationships are acyclic
- [ ] **Dropdowns** populate correctly in forms
- [ ] **Sequential visualizer** renders for stage fields
- [ ] **Kanban boards** group by stage settings
- [ ] **Inline editing** updates entity field values
- [ ] **Settings changes** reflect immediately (no cache issues)
- [ ] **Soft deletes** remove from dropdowns but don't break entities
- [ ] **New settings** appear in all relevant dropdowns
- [ ] **API response** structure matches expected format
- [ ] **No RBAC checks** (settings are public)

---

### 🧪 Testing Commands

```bash
# Start platform
./tools/start-all.sh

# Test settings API
./tools/test-api.sh GET /api/v1/setting?category=project_stage
./tools/test-api.sh GET /api/v1/setting?category=task_stage
./tools/test-api.sh GET /api/v1/setting?category=task_priority

# Check all settings categories
for cat in project_stage task_stage task_priority opportunity_funnel_stage \
           office_level business_level position_level industry_sector \
           acquisition_channel customer_tier client_level client_status \
           form_submission_status form_approval_status wiki_publication_status; do
  echo "Testing: $cat"
  ./tools/test-api.sh GET /api/v1/setting?category=$cat
done

# Verify settings table exists
./tools/run_query.sh "\dt app.setting_datalabel_*"

# Check specific settings table
./tools/run_query.sh "SELECT * FROM app.setting_datalabel_project_stage ORDER BY sort_order;"

# Count active settings
./tools/run_query.sh "SELECT category, COUNT(*) FROM (
  SELECT 'project_stage' as category FROM app.setting_datalabel_project_stage WHERE active_flag = true
  UNION ALL
  SELECT 'task_stage' FROM app.setting_datalabel_task_stage WHERE active_flag = true
  UNION ALL
  SELECT 'task_priority' FROM app.setting_datalabel_task_priority WHERE active_flag = true
) t GROUP BY category;"

# Verify no circular parent_id references
./tools/run_query.sh "
WITH RECURSIVE stage_tree AS (
  SELECT level_id, level_name, parent_id, 0 as depth
  FROM app.setting_datalabel_project_stage
  WHERE parent_id IS NULL
  UNION ALL
  SELECT s.level_id, s.level_name, s.parent_id, st.depth + 1
  FROM app.setting_datalabel_project_stage s
  INNER JOIN stage_tree st ON s.parent_id = st.level_id
  WHERE st.depth < 10  -- Prevent infinite loop
)
SELECT * FROM stage_tree ORDER BY depth, level_id;
"

# View logs
./tools/logs-api.sh -f
./tools/logs-web.sh -f

# Reset database (includes all settings)
./tools/db-import.sh
```

---

## 📚 Related Documentation

- **[Database Schema](../db/README.md)** - Complete DDL reference for all 17 settings tables
- **[API Guide](../apps/api/README.md)** - Backend architecture and settings routes
- **[Frontend Guide](../apps/web/README.md)** - UI/UX patterns and component usage
- **[Entity Configuration](../apps/web/src/lib/entityConfig.ts)** - loadOptionsFromSettings usage
- **[Project & Task Guide](./Project_Task.md)** - Entity usage of settings
- **[Form Guide](./form.md)** - Form-specific settings integration

---

## 🎯 Summary

**Settings (Data Labels)** are the configuration backbone of the PMO platform:

- **17 settings tables** providing dropdowns for all entity fields
- **Category-to-table mapping** enables dynamic API routing
- **loadOptionsFromSettings** pattern eliminates hardcoded options
- **Sequential state visualization** auto-detects workflow stages
- **Active flag filtering** controls dropdown visibility
- **No RBAC required** - settings are public configuration
- **Snake_case convention** for consistent naming across stack

**Key Principle:** Field key → API category → Settings table. Always follow `setting_datalabel_{category}` naming convention and snake_case mapping.

**Critical Pattern:** `loadOptionsFromSettings: true` in entity config triggers automatic API call to `/api/v1/setting?category={field_key}`.

**Common Mistake:** Using camelCase field keys breaks category mapping. Always use snake_case: `project_stage` not `projectStage`.

---

**Last Updated:** 2025-10-23
**Maintainer:** PMO Platform Team
**Settings Count:** 17 tables, 150+ configuration values
