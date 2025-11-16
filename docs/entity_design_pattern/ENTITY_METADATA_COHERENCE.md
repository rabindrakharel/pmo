# Entity Metadata Coherence System

> **Dynamic entity metadata loading from d_entity table to eliminate hardcoded UI configurations**

**Status:** ✅ **Fully Implemented** (2025-11-10)
**Scope:** Database → API → Frontend UI
**Impact:** Sidebar navigation, child entity tabs, settings management

---

## 1. Semantics & Business Context

### Problem Statement

**Before:** Entity metadata (icons, labels, parent-child relationships) was hardcoded across frontend components, creating maintenance burden and requiring code deployments for simple metadata changes.

**After:** All entity metadata dynamically loaded from `d_entity` database table via REST API, enabling runtime configurability without code changes.

### Business Value

- **Zero-code metadata updates** - Change entity icons, labels, or relationships via database only
- **Consistent entity metadata** - Single source of truth (`d_entity` table)
- **Scalable entity system** - Add new entities without frontend code changes
- **Dynamic navigation** - Sidebar and tabs auto-update when entities are added/removed

### Key Entities

- **Entity Type** - Metadata definition in `d_entity` table (project, task, employee, etc.)
- **Entity Instance** - Actual records in entity tables (specific project, specific task, etc.)
- **Child Entity** - Entities that can be linked as children (project → task, project → wiki)
- **UI Metadata** - Icons, labels, display order for entity visualization

---

## 2. Tooling & Framework Architecture

**Backend:** Fastify v5 + PostgreSQL 14+ + Drizzle ORM
**Frontend:** React 19 + TypeScript + React Router v6
**API Pattern:** REST (JSON)
**Icon Library:** Lucide React
**State Management:** React hooks (useState, useEffect)

---

## 3. Architecture & System Design

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     DATABASE LAYER (PostgreSQL)                     │
├─────────────────────────────────────────────────────────────────────┤
│  app.d_entity (Entity Type Registry)                                │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ code          | name      | ui_label   | ui_icon | active  │   │
│  │ 'project'     | 'Project' | 'Projects' | 'FolderOpen'      │   │
│  │ 'task'        | 'Task'    | 'Tasks'    | 'CheckSquare'     │   │
│  │ 'employee'    | 'Employee'| 'Employees'| 'Users'           │   │
│  │ ...27+ entity types...                                      │   │
│  │                                                              │   │
│  │ child_entities (JSONB array):                               │   │
│  │ [                                                            │   │
│  │   {entity: "task", ui_icon: "CheckSquare",                  │   │
│  │    ui_label: "Tasks", order: 1},                            │   │
│  │   {entity: "wiki", ui_icon: "BookOpen",                     │   │
│  │    ui_label: "Wiki", order: 2}                              │   │
│  │ ]                                                            │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API LAYER (Fastify)                            │
├─────────────────────────────────────────────────────────────────────┤
│  /api/v1/entity/routes.ts                                           │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ GET /api/v1/entity/types                                     │   │
│  │ → Returns all entity types ordered by display_order          │   │
│  │ → Used by: Sidebar navigation, Settings management           │   │
│  │                                                               │   │
│  │ GET /api/v1/entity/type/:entity_type                         │   │
│  │ → Returns single entity type metadata                        │   │
│  │ → Used by: Entity detail pages                               │   │
│  │                                                               │   │
│  │ GET /api/v1/entity/child-tabs/:entity_type/:entity_id        │   │
│  │ → Returns parent metadata + child entities with counts       │   │
│  │ → Filters inactive entities automatically                    │   │
│  │ → Used by: DynamicChildEntityTabs component                  │   │
│  │                                                               │   │
│  │ PUT /api/v1/entity/:code/children                            │   │
│  │ → Updates child_entities JSONB array                         │   │
│  │                                                               │   │
│  │ POST/PUT/DELETE /api/v1/entity/:code                         │   │
│  │ → CRUD operations for entity types                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   FRONTEND LAYER (React)                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────┐  ┌────────────────────┐  ┌──────────────┐  │
│  │ Sidebar Navigation │  │ Settings Page      │  │ Entity Tabs  │  │
│  │ (Layout.tsx)       │  │ (SettingsOverview) │  │ (Dynamic)    │  │
│  │                    │  │                    │  │              │  │
│  │ useEffect(() => {  │  │ useEffect(() => {  │  │ useDynamic-  │  │
│  │   fetch(           │  │   fetch(           │  │ ChildEntity- │  │
│  │     '/entity/types'│  │     '/entity/types'│  │ Tabs()       │  │
│  │   )                │  │   )                │  │              │  │
│  │ }, [])             │  │ }, [])             │  │ fetch(       │  │
│  │                    │  │                    │  │   '/child-   │  │
│  │ ✅ API-driven      │  │ ✅ API-driven      │  │    tabs/...' │  │
│  │ ✅ Icons from DB   │  │ ✅ CRUD enabled    │  │ )            │  │
│  │ ✅ Order from DB   │  │ ✅ Icons from DB   │  │              │  │
│  └────────────────────┘  └────────────────────┘  │ ✅ API-driven│  │
│                                                    │ ✅ Icons DB  │  │
│  Icon Mapping Utility:                            │ ✅ Counts DB │  │
│  ┌──────────────────────────────────────────────┐ └──────────────┘  │
│  │ getIconComponent(iconName: string)           │                   │
│  │ → Maps 'FolderOpen' → <FolderOpen /> React  │                   │
│  │ → Centralized in lib/iconMapping.ts          │                   │
│  │ → Supports 20+ Lucide icons                  │                   │
│  └──────────────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow Diagram

```
┌──────────┐      ┌─────────┐      ┌──────────┐      ┌─────────────┐
│ Database │─────▶│   API   │─────▶│ Frontend │─────▶│ User Sees   │
│ d_entity │      │ Fastify │      │  React   │      │ UI Element  │
└──────────┘      └─────────┘      └──────────┘      └─────────────┘
     │                 │                 │                   │
     │                 │                 │                   │
  code:              GET               fetch()            renders
  'project'      /entity/types      '/entity/types'      <Project />
     │                 │                 │                 icon
  ui_icon:           │──▶ SELECT *      │───▶ useState()      │
  'FolderOpen'       │    FROM d_entity │      setEntities()  │
     │                 │    ORDER BY      │      .map(e => ..) │
  child_entities:    │    display_order │                     │
  [{entity:          │                   │                     │
    "task",...}]     │                   │      getIconComponent
     │                 │                   │      ('FolderOpen')
     │                 │                   │         │
     │                 │                   │         ▼
     │                 │                   │      <FolderOpen />
     │                 │                   │      Lucide React
     └─────────────────┴───────────────────┴──────────────────┘
              SINGLE SOURCE OF TRUTH
```

### Component Interaction Flow

```
User navigates to /project/abc-123 (Project detail page)
                    │
                    ▼
┌───────────────────────────────────────────────────────────────┐
│ EntityDetailPage.tsx                                          │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ 1. Calls useDynamicChildEntityTabs('project', 'abc-123') │ │
│ └───────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────────┐
│ useDynamicChildEntityTabs Hook                                │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ 2. useEffect triggers on mount                            │ │
│ │ 3. Fetches from:                                          │ │
│ │    /api/v1/entity/child-tabs/project/abc-123             │ │
│ └───────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────────┐
│ API Response (from d_entity table)                            │
│ {                                                              │
│   parent_entity_type: "project",                              │
│   parent_ui_icon: "FolderOpen",                               │
│   tabs: [                                                      │
│     {entity: "task", ui_icon: "CheckSquare",                  │
│      ui_label: "Tasks", count: 12, order: 1},                 │
│     {entity: "wiki", ui_icon: "BookOpen",                     │
│      ui_label: "Wiki", count: 3, order: 2},                   │
│     {entity: "artifact", ui_icon: "FileText",                 │
│      ui_label: "Artifacts", count: 7, order: 3}               │
│   ]                                                            │
│ }                                                              │
└───────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────────┐
│ Hook Transforms API Data                                      │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ 4. For each tab:                                          │ │
│ │    - Get icon component: getIconComponent(tab.ui_icon)   │ │
│ │    - Create path: `/${parentType}/${parentId}/${entity}` │ │
│ │ 5. Add "Overview" tab with parent icon                    │ │
│ │ 6. Return {tabs, loading} to component                    │ │
│ └───────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────────┐
│ DynamicChildEntityTabs Component Renders                      │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ 7. Maps over tabs array                                   │ │
│ │ 8. For each tab:                                          │ │
│ │    <button>                                               │ │
│ │      <IconComponent /> {/* from getIconComponent */}      │ │
│ │      <span>{tab.label}</span>                             │ │
│ │      <badge>{tab.count}</badge>                           │ │
│ │    </button>                                              │ │
│ └───────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────────┐
│ User Sees Dynamic Tabs                                         │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ [Overview] [Tasks (12)] [Wiki (3)] [Artifacts (7)]       │ │
│ │    ▲          ▲           ▲             ▲                 │ │
│ │    │          │           │             │                 │ │
│ │  FolderOpen CheckSquare BookOpen    FileText             │ │
│ │  (from DB)   (from DB)  (from DB)   (from DB)            │ │
│ └───────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

---

## 4. Database, API & UI/UX Mapping

### Database Schema

**Table:** `app.d_entity`

| Column | Type | Purpose | Example |
|--------|------|---------|---------|
| `code` | varchar(50) PK | Entity identifier | 'project', 'task', 'employee' |
| `name` | varchar(100) | Entity name | 'Project', 'Task', 'Employee' |
| `ui_label` | varchar(100) | Plural display name | 'Projects', 'Tasks', 'Employees' |
| `ui_icon` | varchar(50) | Lucide icon name | 'FolderOpen', 'CheckSquare' |
| `child_entities` | jsonb | Child entity metadata | See below |
| `display_order` | int4 | Sidebar/menu order | 10, 20, 30 |
| `active_flag` | boolean | Enable/disable | true/false |

**child_entities JSONB Structure:**

```json
[
  {
    "entity": "task",
    "ui_icon": "CheckSquare",
    "ui_label": "Tasks",
    "order": 1
  },
  {
    "entity": "wiki",
    "ui_icon": "BookOpen",
    "ui_label": "Wiki",
    "order": 2
  },
  {
    "entity": "artifact",
    "ui_icon": "FileText",
    "ui_label": "Artifacts",
    "order": 3
  }
]
```

### API Endpoints

#### 1. GET /api/v1/entity/types

**Purpose:** Fetch all entity types for sidebar navigation and settings

**Response:**
```json
[
  {
    "code": "project",
    "name": "Project",
    "ui_label": "Projects",
    "ui_icon": "FolderOpen",
    "display_order": 10,
    "active_flag": true,
    "child_entities": [...]
  }
]
```

**Used By:**
- `Layout.tsx` (Sidebar navigation)
- `SettingsOverviewPage.tsx` (Entity management)

#### 2. GET /api/v1/entity/type/:entity_type

**Purpose:** Fetch single entity type metadata

**Response:**
```json
{
  "code": "project",
  "name": "Project",
  "ui_label": "Projects",
  "ui_icon": "FolderOpen",
  "child_entities": [...],
  "display_order": 10,
  "active_flag": true
}
```

#### 3. GET /api/v1/entity/child-tabs/:entity_type/:entity_id

**Purpose:** Fetch child entity tabs with counts for entity detail pages

**Example:** `GET /api/v1/entity/child-tabs/project/abc-123`

**Response:**
```json
{
  "parent_entity_type": "project",
  "parent_entity_id": "abc-123",
  "parent_name": "Website Redesign",
  "parent_ui_label": "Projects",
  "parent_ui_icon": "FolderOpen",
  "tabs": [
    {
      "entity": "task",
      "ui_icon": "CheckSquare",
      "ui_label": "Tasks",
      "count": 12,
      "order": 1
    },
    {
      "entity": "wiki",
      "ui_icon": "BookOpen",
      "ui_label": "Wiki",
      "count": 3,
      "order": 2
    }
  ]
}
```

**Features:**
- ✅ Filters inactive child entities automatically
- ✅ Includes actual counts from `d_entity_instance_link`
- ✅ Respects RBAC (only shows if user has access)
- ✅ Sorted by `order` field

**Used By:**
- `DynamicChildEntityTabs.tsx` (useDynamicChildEntityTabs hook)

### Frontend Components

#### 1. Sidebar Navigation (Layout.tsx)

**File:** `apps/web/src/components/shared/layout/Layout.tsx`

**Loads entity types on mount:**
```typescript
useEffect(() => {
  const fetchEntityTypes = async () => {
    const response = await fetch(`${apiBaseUrl}/api/v1/entity/types`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    setEntityTypes(data); // ✅ Sets state with API data
  };
  fetchEntityTypes();
}, []);
```

**Renders navigation:**
```typescript
const mainNavigationItems = entityTypes.map(entity => ({
  name: entity.name,
  href: `/${entity.code}`,
  icon: getIconComponent(entity.ui_icon), // ✅ Dynamic icon from DB
  code: entity.code
}));
```

**Result:** Sidebar items auto-update when entities added/removed in database

#### 2. Settings Entity Table (SettingsOverviewPage.tsx)

**File:** `apps/web/src/pages/setting/SettingsOverviewPage.tsx`

**Loads entity types (including inactive):**
```typescript
const fetchEntities = async () => {
  const response = await fetch(
    `${apiBaseUrl}/api/v1/entity/types?include_inactive=true`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  const result = await response.json();
  setEntities(result); // ✅ Manages all entities via API
};
```

**Features:**
- ✅ Full CRUD operations via API (POST, PUT, DELETE endpoints)
- ✅ Inline editing of entity metadata
- ✅ Child entity management modal
- ✅ Icon picker with live preview

#### 3. Child Entity Tabs (DynamicChildEntityTabs.tsx)

**File:** `apps/web/src/components/shared/entity/DynamicChildEntityTabs.tsx`

**Hook for loading tabs:**
```typescript
export function useDynamicChildEntityTabs(parentType: string, parentId: string) {
  const [tabs, setTabs] = useState<HeaderTab[]>([]);

  useEffect(() => {
    const fetchChildTabs = async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/entity/child-tabs/${parentType}/${parentId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();

      // ✅ Transform API data to tabs with icons from DB
      const generatedTabs = data.tabs.map(tab => ({
        id: tab.entity,
        label: tab.ui_label,
        count: tab.count,
        icon: getIconComponent(tab.ui_icon), // ✅ Dynamic icon
        path: `/${parentType}/${parentId}/${tab.entity}`
      }));

      setTabs([
        {
          id: 'overview',
          label: 'Overview',
          icon: getIconComponent(data.parent_ui_icon), // ✅ Parent icon
          path: `/${parentType}/${parentId}`
        },
        ...generatedTabs
      ]);
    };
    fetchChildTabs();
  }, [parentType, parentId]);

  return { tabs, loading };
}
```

**Refactoring Summary:**
- ❌ **Removed:** Hardcoded `getEntityIcon()` function (25 lines)
- ❌ **Removed:** Hardcoded `getDefaultTabs()` function (87 lines)
- ✅ **Uses:** API-provided `ui_icon` field from d_entity
- ✅ **Fallback:** Shows overview-only tabs (no hardcoded relationships)

---

## 5. Central Configuration & Middleware

### Icon Mapping Utility

**File:** `apps/web/src/lib/iconMapping.ts`

**Purpose:** Maps icon names from database to Lucide React components

**Pattern:**
```
Database            Icon Mapping              React Component
d_entity.ui_icon → getIconComponent() → <LucideIcon />
'FolderOpen'     →     mapping          → <FolderOpen />
```

**Supported Icons:**
- Building2, MapPin, FolderOpen, UserCheck
- FileText, BookOpen, CheckSquare, Users
- Package, Warehouse, ShoppingCart, Truck
- Receipt, Briefcase, BarChart, DollarSign
- TrendingUp, Wrench, ClipboardCheck, Calendar

**Fallback:** Returns `FileText` if icon not found

### Entity Alias Mapping

**File:** `apps/api/src/modules/entity/routes.ts`

**Purpose:** Map frontend URLs to database entity codes

**Example:**
```typescript
const ENTITY_ALIAS_MAP = {
  'biz': 'business',      // /biz → d_business table
  'client': 'cust',       // /client → d_cust table
};
```

**Normalization:**
```typescript
function normalizeEntityType(entityType: string): string {
  return ENTITY_ALIAS_MAP[entityType] || entityType;
}
```

### API Authentication

**All entity endpoints require JWT authentication:**
```typescript
fastify.get('/api/v1/entity/types', {
  preHandler: [fastify.authenticate], // ✅ JWT verification
  // ...
});
```

**Token storage:** `localStorage.getItem('auth_token')`

---

## 6. User Interaction Flow Examples

### Example 1: User Navigates to Entity List Page

**Scenario:** User clicks "Projects" in sidebar

```
1. USER ACTION
   User clicks "Projects" link in sidebar

2. SIDEBAR STATE (already loaded on app mount)
   - Sidebar loaded entity types from /api/v1/entity/types
   - Sidebar displays "Projects" with FolderOpen icon (from d_entity.ui_icon)

3. NAVIGATION
   Router navigates to /project (from d_entity.code)

4. RESULT
   Projects list page loads with correct branding/icon from d_entity
```

### Example 2: Admin Adds New Entity Type

**Scenario:** Admin adds "vendor" entity via Settings

```
1. USER ACTION (Settings Page)
   - Admin clicks "Add Entity" button
   - Fills form: code="vendor", name="Vendor", ui_icon="Briefcase"
   - Clicks "Save"

2. API CALL
   POST /api/v1/entity
   Body: {
     code: "vendor",
     name: "Vendor",
     ui_label: "Vendors",
     ui_icon: "Briefcase",
     display_order: 100
   }

3. DATABASE INSERT
   INSERT INTO app.d_entity (code, name, ui_label, ui_icon, ...)
   VALUES ('vendor', 'Vendor', 'Vendors', 'Briefcase', ...)

4. FRONTEND AUTO-UPDATE
   - Settings page refetches: GET /api/v1/entity/types
   - New "Vendor" row appears in entity table

5. SIDEBAR AUTO-UPDATE (next page load)
   - Sidebar refetches entity types
   - "Vendors" appears in navigation with Briefcase icon

6. RESULT
   New entity added without code deployment
```

### Example 3: Admin Updates Child Entity Relationships

**Scenario:** Admin adds "form" as child entity of "task"

```
1. USER ACTION (Settings Page)
   - Admin clicks "Edit" on "Task" entity row
   - Opens child entities modal
   - Adds "form" to child_entities array:
     {entity: "form", ui_icon: "FileText", ui_label: "Forms", order: 3}
   - Clicks "Save"

2. API CALL
   PUT /api/v1/entity/task/children
   Body: {
     child_entities: [
       {entity: "artifact", ui_icon: "FileText", ui_label: "Artifacts", order: 1},
       {entity: "form", ui_icon: "FileText", ui_label: "Forms", order: 2}
     ]
   }

3. DATABASE UPDATE
   UPDATE app.d_entity
   SET child_entities = '[...]'::jsonb
   WHERE code = 'task'

4. FRONTEND AUTO-UPDATE (next entity detail page load)
   - User navigates to /task/abc-123
   - useDynamicChildEntityTabs fetches: /api/v1/entity/child-tabs/task/abc-123
   - New "Forms" tab appears with FileText icon

5. RESULT
   Task detail pages now show "Forms" tab without code deployment
```

---

## 7. Critical Considerations When Building

### For Backend Developers

**1. Always Filter Inactive Entities**
```typescript
// ✅ CORRECT: Filter child_entities by active_flag
const activeChildEntities = await db.execute(sql`
  SELECT code FROM app.d_entity
  WHERE code IN (${childEntityCodes}) AND active_flag = true
`);
```

**2. Respect RBAC in child-tabs Endpoint**
```typescript
// ✅ CORRECT: Verify user has access to parent entity
const parentAccess = await db.execute(sql`
  SELECT 1 FROM app.d_entity_rbac rbac
  WHERE rbac.empid = ${userId}
    AND rbac.entity = ${entityType}
    AND rbac.entity_id = ${entityId}
    AND 0 = ANY(rbac.permission)
`);
if (parentAccess.length === 0) {
  return reply.status(403).send({ error: 'Access denied' });
}
```

**3. Parse JSONB child_entities Correctly**
```typescript
// ✅ CORRECT: Handle both string and object formats
let childEntities = row.child_entities || [];
if (typeof childEntities === 'string') {
  childEntities = JSON.parse(childEntities);
}
if (!Array.isArray(childEntities)) {
  childEntities = [];
}
```

### For Frontend Developers

**1. Never Hardcode Entity Metadata**
```typescript
// ❌ WRONG: Hardcoded icons
const getEntityIcon = (type: string) => {
  const iconMap = { task: CheckSquare, project: FolderOpen };
  return iconMap[type];
};

// ✅ CORRECT: Use API-provided icons
const IconComponent = getIconComponent(tab.ui_icon);
```

**2. Always Use getIconComponent() for Icons**
```typescript
// ✅ CORRECT: Dynamic icon from database
import { getIconComponent } from '@/lib/iconMapping';
const IconComponent = getIconComponent(entity.ui_icon);
return <IconComponent className="h-5 w-5" />;
```

**3. Handle Loading States**
```typescript
// ✅ CORRECT: Show loading state while fetching
const { tabs, loading } = useDynamicChildEntityTabs(parentType, parentId);
if (loading) return <LoadingSpinner />;
```

**4. Fallback Gracefully**
```typescript
// ✅ CORRECT: Show overview-only tab if API fails
catch (error) {
  setTabs([{
    id: 'overview',
    label: 'Overview',
    path: `/${parentType}/${parentId}`,
    icon: getIconComponent(null) // Fallback icon
  }]);
}
```

### For Database Administrators

**1. Maintain child_entities Order**
```sql
-- ✅ CORRECT: Ensure order field exists for tab sorting
UPDATE app.d_entity
SET child_entities = '[
  {"entity": "task", "ui_icon": "CheckSquare", "ui_label": "Tasks", "order": 1},
  {"entity": "wiki", "ui_icon": "BookOpen", "ui_label": "Wiki", "order": 2}
]'::jsonb
WHERE code = 'project';
```

**2. Use Consistent Icon Names**
```sql
-- ✅ CORRECT: Icon names must match iconMapping.ts
-- Valid: 'FolderOpen', 'CheckSquare', 'BookOpen'
-- Invalid: 'folder-open', 'check-square', 'book'
```

**3. Keep display_order Gaps**
```sql
-- ✅ CORRECT: Use increments of 10 for easy reordering
INSERT INTO app.d_entity (code, display_order)
VALUES
  ('project', 10),
  ('task', 20),
  ('employee', 30);
-- Allows inserting new entity at 15 without reordering
```

---

## Verification Checklist

**Backend API:**
- ✅ `/api/v1/entity/types` returns all active entities with icons
- ✅ `/api/v1/entity/child-tabs/:type/:id` filters inactive children
- ✅ RBAC checks applied to all entity endpoints
- ✅ JSONB parsing handles both string and object formats

**Frontend UI:**
- ✅ Sidebar navigation loads from `/api/v1/entity/types`
- ✅ Settings page loads from `/api/v1/entity/types?include_inactive=true`
- ✅ Child tabs load from `/api/v1/entity/child-tabs/...`
- ✅ All icons use `getIconComponent(entity.ui_icon)`
- ✅ No hardcoded icon mappings remain
- ✅ No hardcoded parent-child relationships remain

**Database:**
- ✅ `d_entity` table populated with 27+ entity types
- ✅ All entities have valid `ui_icon` values (match iconMapping.ts)
- ✅ `child_entities` JSONB arrays include `order` field
- ✅ `display_order` uses increments for easy reordering

---

## References

**Code Files:**
- Backend API: `/apps/api/src/modules/entity/routes.ts`
- Sidebar: `/apps/web/src/components/shared/layout/Layout.tsx`
- Settings: `/apps/web/src/pages/setting/SettingsOverviewPage.tsx`
- Child Tabs: `/apps/web/src/components/shared/entity/DynamicChildEntityTabs.tsx`
- Icon Mapping: `/apps/web/src/lib/iconMapping.ts`

**Database:**
- DDL: `/db/XLIV_d_entity.ddl`
- Table: `app.d_entity`

**Related Docs:**
- Data Model: `/docs/datamodel/datamodel.md`
- Universal Entity System: `/docs/entity_design_pattern/universal_entity_system.md`

---

**Last Updated:** 2025-11-10
**Status:** ✅ Production Ready
**Version:** 1.0.0
