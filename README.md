# Huron Home Services - PMO Enterprise Platform 🏡

> **Complete Canadian Home Services Management System** - Production-ready PMO platform with comprehensive data model, unified RBAC, and industry-specific business intelligence

## 📖 Documentation Index & Project Overview

| Document | Purpose | Key Topics |
|----------|---------|------------|
| **[🏠 Main README](./README.md)** | Project overview and quick start | Architecture, getting started, business context |
| **[🌐 Frontend Guide](./apps/web/README.md)** | React 19 hierarchical navigation UI/UX | 12 entity types, RBAC integration, modern components |
| **[🔧 Backend API](./apps/api/README.md)** | Enterprise Fastify API with unified RBAC | 11 modules, JWT auth, 113+ permissions |
| **[🗄️ Database Schema](./db/README.md)** | 5-layer RBAC architecture with 20+ tables | Canadian business context, DDL files, relationships |
| **[🛠️ Management Tools](./tools/README.md)** | 16 platform operation tools | Start/stop, database import, API testing, RBAC debugging |
| **[🧪 API Testing Guide](./tools/API_TESTING.md)** | Generic API testing with `test-api.sh` | Test any endpoint, examples, form workflows |
strictly use tools to run api.

---

## 🎨 UI/UX Design System

### Centralized Icon Configuration

**Location:** `apps/web/src/lib/entityIcons.ts`

All entity icons across the application are centralized in a single configuration file to ensure consistency between:
- Sidebar navigation
- Settings page dropdowns
- Entity detail pages
- Any component that displays entity-related icons

#### Icon Mappings

**Main Entities:**
```typescript
business/biz      → Building2 (Building icon)
project           → FolderOpen (Folder icon)
office            → MapPin (Location pin icon)
client            → Users (Multiple users icon)
role              → UserCheck (User with checkmark icon)
employee          → Users (Multiple users icon)
wiki              → BookOpen (Open book icon)
form              → FileText (Document icon)
task              → CheckSquare (Checkbox icon)
artifact          → FileText (Document icon)
```

**Settings/Metadata Entities:**
```typescript
projectStatus, projectStage        → CheckSquare (matches task)
taskStatus, taskStage              → CheckSquare (matches task)
businessLevel, orgLevel            → Building2 (matches business)
hrLevel, clientLevel               → Users (matches employee/client)
positionLevel                      → UserCheck (matches role)
opportunityFunnelLevel             → Users (matches client)
industrySector, acquisitionChannel → Building2/Users
```

#### Usage

```typescript
// Import centralized icons
import { ENTITY_ICONS, ENTITY_GROUPS, getEntityIcon } from '../lib/entityIcons';

// Get icon for an entity
const ProjectIcon = ENTITY_ICONS.project;  // Returns FolderOpen

// Get icon dynamically
const icon = getEntityIcon('task');  // Returns CheckSquare

// Use entity group configuration
const projectGroup = ENTITY_GROUPS.project;
// { name: 'Project', icon: FolderOpen, color: 'blue' }
```

#### Benefits

✅ **Single Source of Truth** - Change icon in one place, updates everywhere
✅ **Visual Consistency** - Sidebar and settings use identical icons
✅ **Type Safety** - TypeScript ensures icon consistency
✅ **Easy Maintenance** - Add new entities without touching multiple files
✅ **Self-Documenting** - Clear mapping of entity → icon relationships

---

### Standardized Button Component System

**Location:** `apps/web/src/components/shared/button/Button.tsx`

**Documentation:** `apps/web/BUTTON_STANDARDS.md`

All buttons use a centralized `Button` component to ensure consistent styling, colors, and behavior.

#### Button Variants

**1. Primary (Slate)** - Main actions like Save, Submit, Create
```tsx
<Button variant="primary" onClick={handleSave}>Save</Button>
```
- Soft slate gradient with subtle depth
- Colors: `gradient from-slate-600 to-slate-700` → `hover: from-slate-700 to-slate-800`
- Enhanced shadow on hover for professional appearance

**2. Secondary (Gray/White)** - Default actions like Cancel, Back, Edit
```tsx
<Button variant="secondary" onClick={handleCancel}>Cancel</Button>
```
- Clean white background with subtle border
- Colors: `bg-white border-gray-300` → `hover:bg-gray-50`
- Subtle shadow enhancement on hover

**3. Danger (Red)** - Destructive actions like Delete
```tsx
<Button variant="danger" onClick={handleDelete}>Delete</Button>
```
- Softer red gradient, less glaring than standard red
- Colors: `gradient from-red-500 to-red-600` → `hover: from-red-600 to-red-700`
- Shadow depth increases on hover

**4. Success (Emerald)** - Success/confirmation actions
```tsx
<Button variant="success" onClick={handleConfirm}>Confirm</Button>
```
- Sophisticated emerald gradient instead of bright green
- Colors: `gradient from-emerald-500 to-emerald-600` → `hover: from-emerald-600 to-emerald-700`
- Enhanced shadow on hover

**5. Ghost (Transparent)** - Subtle/tertiary actions
```tsx
<Button variant="ghost" onClick={handleAction}>More</Button>
```
- Minimal visual impact, transparent background
- Colors: `border-transparent` → `hover:bg-gray-100`
- Light shadow appears on hover

#### Button Features

**With Icons:**
```tsx
import { Save } from 'lucide-react';
<Button variant="primary" icon={Save}>Save Changes</Button>
```

**Loading State:**
```tsx
<Button variant="primary" loading={isSaving}>
  {isSaving ? 'Saving...' : 'Save'}
</Button>
```

**Sizes:**
```tsx
<Button variant="primary" size="sm">Small</Button>   // px-2.5 py-1
<Button variant="primary" size="md">Medium</Button>  // px-3 py-1.5 (default)
<Button variant="primary" size="lg">Large</Button>   // px-4 py-2
```

**Disabled State:**
```tsx
<Button variant="primary" disabled={!isValid}>Submit</Button>
```

#### Design Philosophy

**Professional, Low-Glare Appearance:**
- Subtle gradients instead of flat colors for depth
- Softer color tones (slate instead of bright blue, emerald instead of bright green)
- Shadow-based depth instead of harsh color contrast
- Smooth transitions (150ms) for polished interactions
- Rounded corners (rounded-md) for modern appearance

**Color Standards:**
- PRIMARY: Slate gradient (`slate-600` to `slate-700`) - Professional, non-glaring
- SUCCESS: Emerald gradient (`emerald-500` to `emerald-600`) - Sophisticated green
- DANGER: Soft red gradient (`red-500` to `red-600`) - Less harsh than standard red
- SECONDARY: Clean white with subtle gray border - Minimal visual weight
- GHOST: Transparent, minimal footprint - Only visible on hover

**Accessibility:**
- All buttons include focus ring states
- Disabled states use consistent gray tones
- Shadow effects removed on disabled states

#### Usage Example

```tsx
import { Button } from '../components/shared/button/Button';
import { Save } from 'lucide-react';

<Button variant="primary" icon={Save} onClick={handleSave}>
  Save
</Button>
```

---

### Sequential State Visualization - Universal Timeline Component

**Location:** `apps/web/src/components/shared/entity/SequentialStateVisualizer.tsx`

**Configuration:** `apps/web/src/lib/sequentialStateConfig.ts`

**Usage:** Entity detail pages, entity forms, settings graph views, labels management

A single reusable component that visualizes all workflow stages, sales funnels, and sequential states using an interactive timeline with **consistent gray styling** showing progression from left to right.

#### Visualization Features

**Consistent Design:**
- **Single color scheme** - All states use the same gray color (`#6B7280`)
- **Hollow circles** for all states (only current state is filled)
- **Checkmark icon** on the current active stage
- **Lines touch circles directly** - No gaps between connectors and circles
- **Solid lines** for completed progression, **dotted lines** for future states
- **Clean typography** - No bold text, consistent font weight throughout
- **Labels centered** directly below circles

**Visual Example:**
```
○ ──── ○ ──── ● .... ○ .... ○
Past   Past  Current Future Future
Hollow Hollow Filled Hollow Hollow
       ↑
Solid lines    Dotted lines
(Gray)         (Gray)
```

#### What are Sequential States?

Sequential states represent ordered progressions through workflows, pipelines, or stages where entities move from one state to the next in a defined sequence.

**Examples:**
- **Project Stages:** Initiation → Planning → Execution → Monitoring → Closure
- **Task Stages:** Backlog → To Do → In Progress → In Review → Done → Blocked
- **Opportunity Funnel:** Lead → Qualified → Site Visit → Proposal → Negotiation → Contract Signed
- **Publication Status:** Draft → Under Review → Published → Archived
- **Approval Status:** Pending → Under Review → Approved → Rejected

#### Visual Design

**Consistent Gray Color Scheme:**

All states use a single gray color (`#6B7280`) for a clean, professional appearance:
- **Circles:** All have gray borders, only active state is filled
- **Lines:** Gray solid lines for completed, gray dotted lines for future
- **Labels:** Gray text (`text-gray-600`) centered below circles
- **No color coding** - Focus on progression, not colors

**Display Modes:**

**1. Horizontal Mode (Default):**
```
○ ──── ○ ──── ● .... ○ .... ○
```
- Hollow circles with gray borders
- Lines touch circles directly (no gaps)
- Solid lines for completed progression
- Dotted lines for future states
- Checkmark (✓) on current stage only
- Labels positioned directly below circles

**2. Compact Mode:**
- Progress bar with percentage
- Current stage name display
- Expandable to show all stages

**Interactive Features (Edit/Create Mode):**
- **Hover:** Subtle scale effect (110%)
- **Click:** Jump directly to any state
- **Tooltip:** "Click to set state to [stage name]"
- **Current State:** Filled gray circle + white checkmark
- **Past States:** Hollow circles with gray borders, solid connecting lines
- **Future States:** Hollow circles with gray borders, dotted connecting lines

#### How It Works

**Automatic Detection:**

The system automatically uses sequential state visualization for fields that match these patterns:

```typescript
SEQUENTIAL_STATE_PATTERNS = [
  'stage',      // project_stage, task_stage
  'funnel',     // opportunity_funnel_level
  'pipeline',   // sales_pipeline
  'status',     // workflow_status, publication_status
  'level'       // opportunity_funnel_level
]
```

**Field Examples:**
- `project_stage` → Auto-detects as sequential ✅
- `task_stage` → Auto-detects as sequential ✅
- `opportunity_funnel_level_name` → Auto-detects as sequential ✅
- `active_flag` → Excluded (boolean, not sequential) ❌

**Usage in Entity Forms:**

The visualizer automatically replaces standard dropdowns for sequential fields:

```typescript
// In EntityFormContainer.tsx
// Display mode: Shows timeline visualization
<SequentialStateVisualizer
  states={options}
  currentState={value}
  editable={false}
/>

// Edit mode: Interactive timeline
<SequentialStateVisualizer
  states={options}
  currentState={value}
  editable={true}
  onStateChange={(newValue) => onChange(field.key, newValue)}
/>
```

#### Configuration Management

**Central Configuration File:** `apps/web/src/lib/sequentialStateConfig.ts`

**1. Pattern Definitions:**
```typescript
export const SEQUENTIAL_STATE_PATTERNS = [
  'stage', 'funnel', 'pipeline', 'status', 'level'
];
```

**2. Exclusions (Fields to Skip):**
```typescript
export const SEQUENTIAL_STATE_EXCLUSIONS = [
  'active_flag',        // Boolean, not workflow
  'office_level_id',    // Hierarchical, not sequential
  'business_level_id'   // Hierarchical, not sequential
];
```

**3. Explicit Includes (Always Use Visualizer):**
```typescript
export const SEQUENTIAL_STATE_EXPLICIT_INCLUDES = [
  'project_stage',
  'task_stage',
  'opportunity_funnel_level_name',
  'publication_status',
  'submission_status',
  'approval_status'
];
```

**4. Field-Specific Customization:**
```typescript
export const SEQUENTIAL_STATE_FIELD_CONFIGS = {
  'project_stage': {
    fieldKey: 'project_stage',
    label: 'Project Stage',
    showPastAsCompleted: true,
    allowJumping: true
  }
};
```

#### Adding New Sequential Fields

**Option 1: Add to Patterns (Most Common)**
```typescript
// In sequentialStateConfig.ts
export const SEQUENTIAL_STATE_PATTERNS = [
  'stage', 'funnel', 'pipeline', 'status', 'level',
  'workflow'  // ← Add new pattern
];
```

**Option 2: Add Specific Field**
```typescript
export const SEQUENTIAL_STATE_EXPLICIT_INCLUDES = [
  'my_custom_workflow'  // ← Add specific field
];
```

**Option 3: Exclude Specific Field**
```typescript
export const SEQUENTIAL_STATE_EXCLUSIONS = [
  'my_non_sequential_status'  // ← Exclude from pattern
];
```

#### Integration with Settings Tables

Sequential state fields automatically load options from database settings tables:

```typescript
// Field definition in entityConfig.ts
{
  key: 'project_stage',
  label: 'Stage',
  type: 'select',
  loadOptionsFromSettings: true  // ← Loads from DB
}
```

**Backend Query:**
```bash
GET /api/v1/setting?category=project_stage
```

**Response:**
```json
{
  "data": [
    { "value": "Initiation", "label": "Initiation", "sort_order": 1, "parent_id": null },
    { "value": "Planning", "label": "Planning", "sort_order": 2, "parent_id": 0 },
    { "value": "Execution", "label": "Execution", "sort_order": 3, "parent_id": 1 }
  ]
}
```

The `sort_order` field determines the left-to-right sequence in the visualization.

#### Database Tables for Sequential States

**Settings tables that power sequential visualizations:**

1. `setting_datalabel_project_stage` - Project lifecycle stages
2. `setting_datalabel_task_stage` - Task workflow stages
3. `setting_datalabel_opportunity_funnel_stage` - Sales pipeline
4. `setting_datalabel_wiki_publication_status` - Wiki publishing workflow
5. `setting_datalabel_form_submission_status` - Form submission states
6. `setting_datalabel_form_approval_status` - Form approval workflow

**Each table includes:**
- `level_name` or `stage_name` - The state name (e.g., "Planning")
- `sort_order` - Sequential ordering (1, 2, 3...)
- `parent_id` - Optional parent stage for hierarchical relationships
- `active_flag` - Whether the state is currently available
- `level_descr` or `stage_descr` - Description/tooltip text

**Note:** The `color_code` field has been removed. All visualizations use consistent gray styling.

#### Benefits

✅ **Consistent UX** - All sequential states use same visualization across the app
✅ **Visual Progress** - Users see where they are in the workflow at a glance
✅ **Interactive** - Click any state to jump directly (in edit/create modes)
✅ **Automatic** - No code changes needed for new sequential fields
✅ **Centralized Config** - All patterns defined in one place
✅ **Database-Driven** - States loaded from settings tables
✅ **Self-Documenting** - Visual representation makes workflows clear

#### Real-World Examples

**Project Detail Page (/project/:id):**
- Field: `project_stage`
- Display: ● Initiation → ● Planning → ● **Execution** → ○ Monitoring → ○ Closure
- Current: Execution (highlighted with blue ring and checkmark)

**Task Kanban Board:**
- Field: `stage`
- Columns automatically generated from sequential states
- Drag-drop moves task to next stage
- Visual shows progression: Backlog → To Do → **In Progress** → In Review → Done

**Client Detail Page (/client/:id):**
- Field: `opportunity_funnel_level_name`
- Display: ● Lead → ● Qualified → ● Site Visit → ● **Proposal Sent** → ○ Negotiation → ○ Contract Signed
- Sales team sees exactly where client is in the sales process

#### Component Reusability - One Component, Multiple Use Cases

The SequentialStateVisualizer is a universal component used throughout the platform:

**Use Case 1: Entity Detail Pages**
```typescript
// Shows current state of a single entity (e.g., project is "In Progress")
<SequentialStateVisualizer
  states={projectStages}
  currentState="In Progress"
  editable={false}
  mode="horizontal"
/>
```

**Use Case 2: Entity Edit/Create Forms**
```typescript
// Interactive state selection in forms
<SequentialStateVisualizer
  states={projectStages}
  currentState={formData.project_stage}
  editable={true}
  onStateChange={(newState) => updateField('project_stage', newState)}
  mode="horizontal"
/>
```

**Use Case 3: Settings Graph View**
```typescript
// Overview of all available stages/levels
<SequentialStateVisualizer
  states={allProjectStages}
  currentState={null}
  editable={false}
  mode="horizontal"
/>
```

**Access Settings Graph View:**
```
http://localhost:5173/labels → Select a label type → Click Graph icon
```

All settings entities with sequential data can be visualized:
- Project Stages: Initiation → Planning → Execution → Monitoring → Closure
- Task Stages: Backlog → To Do → In Progress → In Review → Done
- Opportunity Funnel: Lead → Qualified → Site Visit → Proposal → Negotiation → Contract

**Enable Graph View:**
```typescript
// In entityConfig.ts
projectStage: {
  supportedViews: ['table', 'graph'],  // ← Enables graph view
  defaultView: 'table'
}
```

**Benefits:**
✅ **Single Source of Truth** - One component for all sequential state visualization
✅ **Consistent UX** - Same gray color scheme and interactions everywhere
✅ **DRY Principle** - No duplicate visualization code
✅ **Maintainable** - Update visualization in one place, affects entire platform
✅ **Flexible** - Same component adapts via props for different contexts
✅ **Clean Design** - Professional monochrome appearance with clear progression indicators

---

### Labels Management - Full CRUD Interface

**Location:** `apps/web/src/pages/labels/LabelsPage.tsx`

**URL:** `http://localhost:5173/labels`

**Purpose:** Centralized interface for managing all settings/datalabel tables with full Create, Read, Update, Delete capabilities.

#### Features

**Multi-Select Interface:**
- Searchable dropdown to select which label types to manage
- Multiple tables can be displayed simultaneously
- Grouped by entity type (Project, Task, Business, Client, Employee)
- Icon-based organization matching entity icons

**Full CRUD Operations:**

**1. CREATE:**
- Click "Create [Label Type]" button above any data table
- Modal opens with empty form
- Fill required fields (ID, name, description, color code, etc.)
- Save creates new label in database

**2. READ:**
- All labels displayed in data tables with parent ID columns
- Table view shows all fields including parent relationships
- Graph view for hierarchical visualization
- Parent stage/level names resolved and displayed

**3. UPDATE/EDIT:**
- Click edit icon (pencil) on any row
- Modal opens with existing data pre-filled
- Modify fields as needed
- Save updates the record
- Also supports inline editing for simple fields

**4. DELETE:**
- Click delete icon (trash) on any row
- Confirmation prompt appears
- Record is soft-deleted from database
- Table refreshes automatically

#### Managed Label Types

**Project Labels:**
- Project Stage - Lifecycle stages with RAG colors

**Task Labels:**
- Task Stage - Workflow stages with parent relationships

**Business Labels:**
- Business Level - Organizational hierarchy
- Org Level - Organization structure

**Employee Labels:**
- Position Level - Position hierarchy

**Client Labels:**
- Opportunity Funnel - Sales pipeline stages with branching
- Industry Sector - Client industry classifications
- Acquisition Channel - Client acquisition sources
- Customer Tier - Service tier levels

#### Parent-Child Relationships

**Parent ID Column:**
Tables now display parent relationships with resolved names:
```
┌────────┬──────────────┬─────────────────┬──────────────────┐
│ ID     │ Name         │ Parent Stage    │ Sort Order       │
├────────┼──────────────┼─────────────────┼──────────────────┤
│ 0      │ Lead         │ -               │ 1                │
│ 1      │ Qualified    │ Lead            │ 2                │  ← Shows parent name
│ 3      │ Proposal     │ Qualified       │ 3                │  ← Not just ID
│ 7      │ On Hold      │ Negotiation     │ 8                │  ← Resolved from parent_id
└────────┴──────────────┴─────────────────┴──────────────────┘
```

**Benefits:**
- See relationships at a glance
- Understand hierarchical structure
- Identify branches in workflows
- Validate data consistency

#### Color Code Management

All color codes use standard hex format and follow RAG (Red-Amber-Green) principles:
- **Gray (#6B7280)** - Initial/neutral states
- **Blue (#3B82F6)** - In progress/active states
- **Amber (#F59E0B)** - Warning/review states
- **Green (#10B981)** - Success/completion states
- **Red (#EF4444)** - Error/blocked/lost states
- **Purple (#8B5CF6)** - Special/final states

#### Integration

Labels automatically appear in:
- Entity form dropdowns (with sequential visualization)
- Data table filters
- Kanban board columns
- Graph visualizations
- Parent-child relationship displays

All changes take effect immediately across the platform.

---

## 🗄️ Database-Driven Entity Metadata Architecture ✨

### Architectural Shift: From Code to Database

**Status:** EntityConfig is being phased out for metadata (icons, labels, child relationships) in favor of database-backed API endpoints.

**Problem Solved:** Previously, entity metadata (icons, display labels, child entity relationships) was hardcoded in `apps/web/src/lib/entityConfig.ts`, requiring code changes and redeployment to modify entity structure. This created tight coupling between data model and application code.

**New Architecture:** Entity type metadata is now stored in the `d_entity` database table and served via centralized API endpoints.

---

### Database Schema: d_entity Table

**Location:** `db/30_d_entity.ddl`

The `d_entity` table serves as the single source of truth for all entity type metadata:

```sql
CREATE TABLE app.d_entity (
    entity_type varchar(50) NOT NULL PRIMARY KEY,
    entity_name varchar(100) NOT NULL,
    entity_slug varchar(100) NOT NULL,
    ui_label varchar(100) NOT NULL,        -- Plural display name (e.g., "Projects", "Tasks")
    ui_icon varchar(50),                   -- Icon component name (e.g., "FolderOpen", "CheckSquare")
    child_entities jsonb DEFAULT '[]'::jsonb,  -- Array of child entity metadata
    display_order int4 NOT NULL DEFAULT 999,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

-- Example: Project entity definition
INSERT INTO app.d_entity (entity_type, entity_name, entity_slug, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'project',
  'Project',
  'project',
  'Projects',
  'FolderOpen',
  '[
    {"entity": "task", "ui_icon": "CheckSquare", "ui_label": "Tasks", "order": 1},
    {"entity": "wiki", "ui_icon": "BookOpen", "ui_label": "Wiki", "order": 2},
    {"entity": "artifact", "ui_icon": "FileText", "ui_label": "Artifacts", "order": 3},
    {"entity": "form", "ui_icon": "FileText", "ui_label": "Forms", "order": 4}
  ]'::jsonb,
  30
);
```

**Key Fields:**
- `ui_label` - Plural display name used in UI ("Projects" vs "Project")
- `ui_icon` - Lucide-react icon component name
- `child_entities` - JSONB array defining parent-child relationships with UI metadata and tab ordering

---

### Centralized Entity Metadata API

**Module:** `apps/api/src/modules/entity/routes.ts`

**Endpoints:**

1. **Get All Entity Types**
   ```
   GET /api/v1/entity/types
   ```
   Returns all entity type definitions with UI metadata.

2. **Get Single Entity Type**
   ```
   GET /api/v1/entity/type/:entity_type
   ```
   Returns metadata for a specific entity type.

3. **Get Child Entity Tabs (Dynamic)**
   ```
   GET /api/v1/entity/child-tabs/:entity_type/:entity_id
   ```
   Returns dynamic child entity tabs for a parent entity instance with:
   - Entity counts (e.g., "5 Tasks", "3 Wikis")
   - UI labels and icons from database
   - Ordering based on `order` field in JSONB
   - RBAC-filtered results

**Example Response:**
```json
{
  "parent_entity_type": "project",
  "parent_entity_id": "93106ffb-402e-43a7-8b26-5287e37a1b0e",
  "parent_name": "Alpha Project",
  "parent_ui_label": "Projects",
  "parent_ui_icon": "FolderOpen",
  "tabs": [
    {
      "entity": "task",
      "ui_icon": "CheckSquare",
      "ui_label": "Tasks",
      "count": 5,
      "order": 1
    },
    {
      "entity": "wiki",
      "ui_icon": "BookOpen",
      "ui_label": "Wiki",
      "count": 2,
      "order": 2
    }
  ]
}
```

---

### Frontend Integration

**Component:** `apps/web/src/components/shared/entity/DynamicChildEntityTabs.tsx`

The frontend now consumes entity metadata from the API instead of hardcoded config:

```typescript
// Custom hook fetches child tabs from API
export function useDynamicChildEntityTabs(parentType: string, parentId: string) {
  React.useEffect(() => {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/entity/child-tabs/${parentType}/${parentId}`
    );
    const data = await response.json();

    // Map API response to tab format
    const tabs = data.tabs.map((tab: any) => ({
      id: tab.entity,
      label: tab.ui_label,      // From database, not hardcoded
      count: tab.count,          // Dynamic count from database
      icon: tab.ui_icon,         // From database, not hardcoded
      path: `/${parentType}/${parentId}/${tab.entity}`,
      order: tab.order           // Tab ordering from database
    }));

    setTabs(tabs);
  }, [parentType, parentId]);
}

// Usage in EntityDetailPage
const { tabs, loading } = useDynamicChildEntityTabs(entityType, id);
```

---

### What's Been Refactored

**Removed from entityConfig.ts:**
- ❌ `icon?: string` field - Now stored in `d_entity.ui_icon`
- ❌ `childEntities?: string[]` field - Now stored in `d_entity.child_entities` JSONB

**What Remains in entityConfig.ts:**
- ✅ `columns: ColumnDef[]` - Table column definitions
- ✅ `fields: FieldDef[]` - Form field definitions
- ✅ `supportedViews: ViewMode[]` - View mode configuration
- ✅ `kanban?: KanbanConfig` - Kanban-specific settings
- ✅ `grid?: GridConfig` - Grid view settings
- ✅ `hierarchical?: HierarchicalConfig` - Hierarchical entity settings

**Routing Changes:**
- App.tsx now uses wildcard `:childType` route parameter instead of mapping `config.childEntities`
- EntityChildListPage reads `childType` from URL params instead of requiring it as a prop

---

### Benefits of Database-Driven Metadata

✅ **Runtime Configurability** - Change entity structure without code deployment
✅ **Single Source of Truth** - Entity definitions live in database, not scattered across code
✅ **Dynamic Tab Ordering** - Reorder child entity tabs via database `order` field
✅ **Scalability** - Add new entities via database INSERT, not code changes
✅ **Data Integrity** - Entity relationships managed by centralized `d_entity` table
✅ **Separation of Concerns** - UI metadata separated from business logic configuration

---

### Migration Path (Ongoing)

**Phase 1: Completed ✅**
- Created `d_entity` table with `ui_label`, `ui_icon`, `child_entities` JSONB
- Built centralized entity metadata API endpoints
- Refactored `DynamicChildEntityTabs` to consume API
- Removed `icon` and `childEntities` from entityConfig interface
- Updated routing to use wildcard `:childType` pattern

**Phase 2: Future (Optional)**
- Migrate `columns`, `fields`, and view configurations to database tables
- Build admin UI for managing entity metadata
- Support tenant-specific entity customization
- Add entity metadata versioning/history

---

## 🏭 Type-Safe API Factory Pattern ✨

### Problem: Unsafe Dynamic API Calls

**Before (Type-Unsafe):**
```typescript
// Unsafe dynamic API access in components
const apiModule = (api as any)[`${entityType}Api`];
const response = await apiModule.list({ page: 1 });
```

❌ **Issues:**
- No compile-time type checking
- Runtime errors if API doesn't exist
- Hard to test and mock
- IDE autocomplete doesn't work
- Refactoring breaks code silently

### Solution: Centralized API Factory

**Location:** `apps/web/src/lib/api-factory.ts`

**Architecture:**
```typescript
// 1. Universal EntityAPI Interface
export interface EntityAPI {
  list(params?: ListParams): Promise<PaginatedResponse<any>>;
  get(id: string): Promise<any>;
  create(data: any): Promise<any>;
  update(id: string, data: any): Promise<any>;
  delete(id: string): Promise<void>;
}

// 2. Type-Safe Factory
class APIFactoryClass {
  private apis: Map<string, EntityAPI> = new Map();

  register(entityType: string, api: EntityAPI): void {
    this.apis.set(entityType, api);
  }

  getAPI(entityType: string): EntityAPI {
    const api = this.apis.get(entityType);
    if (!api) {
      throw new Error(`API not found for entity type: "${entityType}"`);
    }
    return api;
  }
}

export const APIFactory = new APIFactoryClass();
```

**Registration (apps/web/src/lib/api.ts):**
```typescript
import { APIFactory } from './api-factory';

// Core business entities
APIFactory.register('project', projectApi);
APIFactory.register('task', taskApi);
APIFactory.register('biz', bizApi);
APIFactory.register('office', officeApi);

// People & roles
APIFactory.register('employee', employeeApi);
APIFactory.register('client', clientApi);
APIFactory.register('role', roleApi);
APIFactory.register('position', positionApi);

// Content & documentation
APIFactory.register('wiki', wikiApi);
APIFactory.register('artifact', artifactApi);
APIFactory.register('form', formApi);
APIFactory.register('worksite', worksiteApi);
```

**Usage in Components:**
```typescript
// EntityMainPage.tsx
import { APIFactory } from '../../lib/api';

const loadData = async () => {
  // Type-safe API call
  const api = APIFactory.getAPI(entityType);
  const response = await api.list({ page: 1, pageSize: 100 });
  setData(response.data || []);
};
```

**Benefits:**

✅ **Type Safety** - Compile-time checking prevents runtime errors
✅ **Single Source of Truth** - All APIs registered in one place
✅ **Runtime Validation** - Clear error messages when API not found
✅ **Easy Testing** - Simple mocking with `APIFactory.register('test', mockApi)`
✅ **IDE Support** - Full autocomplete and type inference
✅ **Maintainable** - Add new API = register once, use everywhere

**Refactored Components:**
- ✅ `EntityMainPage.tsx` - Main list pages
- ✅ `EntityDetailPage.tsx` - Detail pages
- ✅ `EntityChildListPage.tsx` - Child entity tabs
- ✅ `EntityCreatePage.tsx` - Create pages

**Impact:**
- 🎯 **Zero unsafe API calls** in pages/components
- 📉 **Eliminated** `(api as any)` pattern completely
- 🚀 **15+ type-safe API** calls across 4 universal components

---

## 🗑️ Universal Entity Delete Factory Pattern ✨

### Problem: Unsafe Cascading Deletes with Code Duplication

**Before (Manual Delete in Each Module):**
```typescript
// 70+ lines of duplicate delete code in task/routes.ts
fastify.delete('/api/v1/task/:id', async (request, reply) => {
  // RBAC check...

  // STEP 1: Delete from base table
  await db.execute(sql`UPDATE app.d_task SET active_flag = false...`);

  // STEP 2: Delete from entity registry
  await db.execute(sql`UPDATE app.d_entity_instance_id...`);

  // STEP 3A: Delete child linkages
  await db.execute(sql`UPDATE app.d_entity_id_map WHERE child_entity_id = ${id}...`);

  // STEP 3B: Delete parent linkages
  await db.execute(sql`UPDATE app.d_entity_id_map WHERE parent_entity_id = ${id}...`);

  return reply.status(204).send();
});
```

❌ **Issues:**
- 70+ lines duplicated across 13+ entity modules
- Inconsistent delete logic between entities
- Easy to miss one of the 3 required cleanup steps
- No type safety for entity-to-table mapping
- Hard to maintain and extend

### Solution: Universal Delete Factory

**Location:** `apps/api/src/lib/entity-delete-route-factory.ts`

**Complete Documentation:** `apps/api/src/lib/ENTITY_DELETE_FACTORY_README.md`

**Architecture:**
```typescript
// 1. Universal Delete Function (3-Step Cascading Cleanup)
export async function universalEntityDelete(
  entityType: string,
  entityId: string,
  options?: {
    skipRegistry?: boolean;
    skipLinkages?: boolean;
    customCleanup?: () => Promise<void>;
  }
): Promise<void> {
  const table = getEntityTable(entityType);  // Type-safe table mapping
  const tableIdentifier = sql.identifier(table);

  // STEP 1: Soft-delete from main entity table
  await db.execute(sql`
    UPDATE app.${tableIdentifier}
    SET active_flag = false,
        to_ts = NOW(),
        updated_ts = NOW()
    WHERE id = ${entityId}::uuid
  `);

  // STEP 2: Soft-delete from entity instance registry
  await db.execute(sql`
    UPDATE app.d_entity_instance_id
    SET active_flag = false,
        updated_ts = NOW()
    WHERE entity_type = ${entityType}
      AND entity_id = ${entityId}::uuid
  `);

  // STEP 3: Soft-delete linkages (both directions)
  await db.execute(sql`
    UPDATE app.d_entity_id_map
    SET active_flag = false,
        updated_ts = NOW()
    WHERE child_entity_type = ${entityType}
      AND child_entity_id = ${entityId}::uuid
  `);

  await db.execute(sql`
    UPDATE app.d_entity_id_map
    SET active_flag = false,
        updated_ts = NOW()
    WHERE parent_entity_type = ${entityType}
      AND parent_entity_id = ${entityId}::uuid
  `);
}

// 2. Route Factory (Creates DELETE Endpoints)
export function createEntityDeleteEndpoint(
  fastify: FastifyInstance,
  entityType: string,
  options?: { customCleanup?: (entityId: string) => Promise<void> }
): void {
  fastify.delete(`/api/v1/${entityType}/:id`, {
    preHandler: [fastify.authenticate],
    schema: { /* TypeBox validation */ }
  }, async (request, reply) => {
    const { id } = request.params;
    const userId = (request as any).user?.sub;

    // RBAC check (permission = 3 for delete)
    const deleteAccess = await db.execute(sql`
      SELECT 1 FROM app.entity_id_rbac_map rbac
      WHERE rbac.empid = ${userId}
        AND rbac.entity = ${entityType}
        AND (rbac.entity_id = ${id} OR rbac.entity_id = 'all')
        AND rbac.active_flag = true
        AND 3 = ANY(rbac.permission)
    `);

    if (deleteAccess.length === 0) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    // Perform cascading delete
    await universalEntityDelete(entityType, id, {
      customCleanup: options?.customCleanup ? () => options.customCleanup!(id) : undefined
    });

    return reply.status(204).send();
  });
}
```

**Usage Example (task/routes.ts):**
```typescript
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';

export async function taskRoutes(fastify: FastifyInstance) {
  // ... CRUD endpoints (list, get, create, update) ...

  // Replace 70+ lines with 1 line:
  createEntityDeleteEndpoint(fastify, 'task');

  // ✅ Creates: DELETE /api/v1/task/:id
  // ✅ Includes: RBAC check + 3-step cascading delete + error handling
}
```

**Advanced Usage (Custom Cleanup):**
```typescript
// artifact/routes.ts - Delete S3 files before DB delete
createEntityDeleteEndpoint(fastify, 'artifact', {
  customCleanup: async (artifactId) => {
    await deleteS3Files(artifactId);  // Custom cleanup logic
  }
});
```

**3-Step Cascading Delete Flow:**

When `DELETE /api/v1/task/:id` is called, the factory performs:

1. **Base Entity Table** - Soft-delete from `app.d_task`
   ```sql
   UPDATE app.d_task
   SET active_flag = false, to_ts = NOW(), updated_ts = NOW()
   WHERE id = '277d2f4f-9591-4aa3-8537-935324495a74'::uuid
   ```

2. **Entity Instance Registry** - Remove from `app.d_entity_instance_id`
   ```sql
   UPDATE app.d_entity_instance_id
   SET active_flag = false, updated_ts = NOW()
   WHERE entity_type = 'task' AND entity_id = '277d2f4f-9591-4aa3-8537-935324495a74'::uuid
   ```
   - **Impact:** Removes from global search, child-tabs API, dashboard statistics

3. **Linkage Table (Both Directions)** - Clean up `app.d_entity_id_map`
   ```sql
   -- Delete as child: project → task linkage
   UPDATE app.d_entity_id_map
   SET active_flag = false, updated_ts = NOW()
   WHERE child_entity_type = 'task' AND child_entity_id = '277d2f4f-9591-4aa3-8537-935324495a74'::uuid

   -- Delete as parent: task → form/artifact linkages
   UPDATE app.d_entity_id_map
   SET active_flag = false, updated_ts = NOW()
   WHERE parent_entity_type = 'task' AND parent_entity_id = '277d2f4f-9591-4aa3-8537-935324495a74'::uuid
   ```

**Benefits:**

✅ **DRY Principle** - 70+ lines reduced to 1 line per entity
✅ **Consistency** - All entities use identical delete logic
✅ **Cascading Cleanup** - Automatically cleans up all 3 tables
✅ **Factory Pattern** - Matches existing `child-entity-route-factory.ts` architecture
✅ **Single Source of Truth** - Reuses `ENTITY_TABLE_MAP` from child factory
✅ **Type Safety** - TypeScript enforces valid entity types
✅ **Extensible** - Supports custom cleanup logic (e.g., S3 file deletion)
✅ **RBAC Integration** - Permission check built-in (permission = 3)

**Entity-to-Table Mapping (Shared with Child Factory):**
```typescript
import { ENTITY_TABLE_MAP } from './child-entity-route-factory.js';

// Maps entity type → database table name
export const ENTITY_TABLE_MAP: Record<string, string> = {
  task: 'd_task',
  project: 'd_project',
  wiki: 'd_wiki',
  form: 'd_form_head',
  artifact: 'd_artifact',
  employee: 'd_employee',
  client: 'd_client',
  office: 'd_office',
  biz: 'd_business',
  role: 'd_role',
  position: 'd_position',
  worksite: 'd_worksite',
  reports: 'd_reports'
};
```

**Current Status:**
- ✅ **Implemented in:** `task` module (`apps/api/src/modules/task/routes.ts`)
- 🔄 **Rolling out to:** `project`, `wiki`, `form`, `artifact`, `employee`, `client`, `office`, `business`, `role`, `position`, `worksite`, `reports`

**Testing:**
```bash
# Test task delete with cascading cleanup
./tools/test-api.sh DELETE /api/v1/task/277d2f4f-9591-4aa3-8537-935324495a74

# Verify all 3 deletions:
# 1. Base table: SELECT * FROM app.d_task WHERE id = '...' AND active_flag = false
# 2. Registry: SELECT * FROM app.d_entity_instance_id WHERE entity_id = '...' AND active_flag = false
# 3. Linkages: SELECT * FROM app.d_entity_id_map WHERE child_entity_id = '...' AND active_flag = false
```

**Pattern Consistency:**

The delete factory follows the exact same pattern as `child-entity-route-factory.ts`:

| Feature | child-entity-route-factory.ts | entity-delete-route-factory.ts |
|---------|------------------------------|--------------------------------|
| **Location** | `apps/api/src/lib/` | `apps/api/src/lib/` ✅ |
| **Naming** | `create...Endpoint()` | `createEntityDeleteEndpoint()` ✅ |
| **Table mapping** | `ENTITY_TABLE_MAP` (exported) | Imports same mapping ✅ |
| **SQL pattern** | `sql.identifier()` + `app.${identifier}` | Same ✅ |
| **Logging** | `fastify.log.info/warn/error` | Same ✅ |
| **RBAC** | Checks permission array | Same ✅ |
| **First param** | `fastify: FastifyInstance` | Same ✅ |

---

## 🔗 Shared URL System - Universal Public Sharing ✨

### Overview

DRY (Don't Repeat Yourself) factory pattern for generating and managing public shared URLs across all entity types (task, form, wiki, artifact). Enables secure, unauthenticated public access to entity content via short, shareable links with **minimal UI (no sidebar/navigation)** perfect for external stakeholders.

**URL Format:**
- **Database Storage**: `/{entity}/{8-char-code}` (e.g., `/task/qD7nC3xK`)
- **Public Frontend Route**: `/{entity}/shared/{8-char-code}` (e.g., `http://localhost:5173/task/shared/qD7nC3xK`)
- **API Resolver**: `/api/v1/shared/{entity}/{code}` (PUBLIC - No Auth Required)

**URL Conversion**: The database stores compact format (`/task/code`) but the frontend automatically converts to public route format (`/task/shared/code`) when displaying URLs to users.

**Complete Documentation:**
- [SHARED_URL_SYSTEM.md](./SHARED_URL_SYSTEM.md) - Full architecture and implementation
- [SHARED_URL_FIX.md](./SHARED_URL_FIX.md) - Recent fixes and troubleshooting
- [SHARED_URL_VERIFICATION.md](./SHARED_URL_VERIFICATION.md) - Verification tests and examples

---

### Implementation Components

**1. Database Schema Updates**
- Added `internal_url` and `shared_url` columns to `d_wiki`, `d_artifact`, `d_task`, `d_form_head`
- Format: `/{entity}/{8-char-code}` (e.g., `/task/qD7nC3xK`)
- Columns:
  ```sql
  internal_url varchar(500),   -- Internal URL: /{entity}/{id} (authenticated)
  shared_url varchar(500)      -- Public URL: /{entity}/{8-char-code} (no auth)
  ```

**2. Backend API Factory System**

**Created:** `apps/api/src/lib/shared-url-factory.ts` - Centralized DRY utility:
```typescript
// Core Functions:
generateSharedCode()         // Creates unique 8-character codes
generateSharedUrl()          // Generates URL string for database
createSharedUrl()            // Complete workflow: generate + save
resolveSharedUrl()           // Public lookup (no auth required)
saveSharedUrl()              // Save to database
getSharedUrlInfo()           // Get existing URL info
isSharedCodeAvailable()      // Check code availability

// Entity-to-table mapping from central config
const ENTITY_TABLE_MAP = {
  task: 'd_task',
  form: 'd_form_head',
  wiki: 'd_wiki',
  artifact: 'd_artifact',
  // ... all entities
};
```

**Created:** `apps/api/src/modules/shared/routes.ts` - Public API endpoints:
```typescript
// Resolve shared URL (PUBLIC - No auth required)
GET /api/v1/shared/{entity}/{code}
Response: { entityType, entityId, data: {...} }

// Generate shared URL (AUTHENTICATED - requires edit permission)
POST /api/v1/shared/{entity}/{id}/generate
Response: { sharedUrl, sharedCode, internalUrl }
```

**Updated:** API schemas for task, form, wiki, artifact to include `internal_url` and `shared_url` fields:
- `apps/api/src/modules/task/routes.ts` - TaskSchema + queries
- `apps/api/src/modules/form/routes.ts` - FormSchema
- `apps/api/src/modules/wiki/routes.ts` - WikiSchema
- `apps/api/src/modules/artifact/routes.ts` - ArtifactSchema

**3. Frontend Shared Entity Viewer**

**Created:** `apps/web/src/pages/shared/SharedEntityPage.tsx` - Universal DRY component:
```typescript
// Features:
✅ Dynamically renders any entity type
✅ Works without authentication (public access)
✅ MINIMAL UI - NO sidebar, NO navigation (perfect for external sharing)
✅ Branded "Public Shared View" header
✅ Uses entity-specific renderers:
  * form → InteractiveForm (with isPublicView=true)
  * wiki → WikiContentRenderer (with isPublicView=true)
  * task → TaskDataContainer (with isPublicView=true, read-only)
  * artifact → Custom artifact viewer
  * default → Generic JSON viewer
✅ Handles loading and error states
✅ Read-only mode for external users
```

**Updated:** Routing in `apps/web/src/App.tsx` with public shared URL routes (NOT wrapped in ProtectedRoute):
```typescript
{/* Shared Entity Routes (Public - No Auth Required) */}
<Route path="/task/shared/:code" element={<SharedEntityPage />} />
<Route path="/form/shared/:code" element={<SharedEntityPage />} />
<Route path="/wiki/shared/:code" element={<SharedEntityPage />} />
<Route path="/artifact/shared/:code" element={<SharedEntityPage />} />
<Route path="/:entityType/shared/:code" element={<SharedEntityPage />} />
```

**Updated:** `apps/web/src/components/shared/share/ShareURLSection.tsx` - Converts database URLs to public format:
```typescript
// Converts /task/code → /task/shared/code for display to users
const convertToPublicUrl = (dbUrl: string): string => {
  const parts = dbUrl.split('/').filter(Boolean);
  if (parts.length === 2) {
    return `/${parts[0]}/shared/${parts[1]}`;
  }
  return dbUrl;
};
```

**Updated:** `apps/web/src/components/entity/task/TaskDataContainer.tsx`:
- Made `projectId` prop optional (supports public view without full context)
- Added `isPublicView` prop support
- Hides update form in public view (read-only for external users)
- Improved authentication handling (works without login token)

---

### Key Features

✅ **DRY Design** - Single factory handles all entities
✅ **Centralized Config** - Uses entity-table mapping from central config
✅ **Public Access** - No authentication required for viewing shared URLs
✅ **Minimal Public UI** - NO sidebar, NO navigation (just entity content)
✅ **Read-Only Mode** - External users can view but cannot edit or post updates
✅ **Secure Generation** - Only users with edit permissions can create shared URLs
✅ **Universal Page** - One reusable component for all entity types
✅ **Automatic URL Conversion** - Database format auto-converts to public route format
✅ **Type Safety** - TypeScript enforces valid entity types
✅ **Consistent Patterns** - Follows existing factory pattern architecture

---

### Usage Example

**Generate Shared URL (Backend API):**
```bash
# Generate shared URL for a task
curl -X POST http://localhost:4000/api/v1/shared/task/{id}/generate \
  -H "Authorization: Bearer {token}"

# Response:
{
  "sharedUrl": "/task/qD7nC3xK",
  "sharedCode": "qD7nC3xK",
  "internalUrl": "/task/{id}"
}
```

**Access Shared URL (Frontend):**
```
User clicks shared link: http://localhost:5173/task/shared/qD7nC3xK
↓
✅ No login required
↓
SharedEntityPage calls public API: /api/v1/shared/task/qD7nC3xK
↓
✅ Renders task in MINIMAL view:
  - NO sidebar navigation
  - NO main app layout
  - Just entity content + "Public Shared View" header
  - Read-only (no update form for external users)
↓
Perfect for sharing with external stakeholders!
```

**Resolve Shared URL (Public API):**
```bash
# Resolve shared code to entity data (NO AUTH REQUIRED)
curl http://localhost:4000/api/v1/shared/task/qD7nC3xK

# Response:
{
  "entityType": "task",
  "entityId": "e1111111-1111-1111-1111-111111111111",
  "data": { ...full entity data... }
}
```

---

### Benefits

📊 **Reduces Code Duplication** - Factory pattern eliminates 100+ lines of URL generation logic
🔒 **RBAC Integration** - Only authorized users can generate shared URLs (permission = 1)
🎯 **Single Source of Truth** - All URL logic centralized in one factory
🚀 **Easy to Extend** - Add new entity = automatic shared URL support
✨ **Professional UX** - Clean, short URLs perfect for sharing with clients/stakeholders
🔐 **Minimal Security Surface** - External users see ONLY shared entity content (no navigation to other data)
👁️ **Read-Only Public View** - External stakeholders can view but cannot modify data
🎨 **Clean Branding** - Minimal layout with "Public Shared View" header for professional appearance

### Real-World Use Cases

**1. Share Task Status with External Client**
```
Internal: Generate share link for task
Client: Receives http://localhost:5173/task/shared/xT4pQ2nR
Client: Views task details + updates (no login required)
Client: Cannot post updates or navigate to other tasks
```

**2. Share Form for Data Collection**
```
Internal: Generate share link for form
External User: Fills out form via shared link
System: Captures submission without requiring account
```

**3. Share Wiki Article Publicly**
```
Internal: Generate share link for wiki page
External: Reads documentation via shared link
External: Cannot edit or see other wiki pages
```

### Security Considerations

| Aspect | Implementation |
|--------|---------------|
| **Authentication** | ❌ Not required (public access) |
| **Read Access** | ✅ Can view entity details and updates |
| **Write Access** | ❌ Cannot post updates or edit (form hidden) |
| **Scope** | ✅ Access to ONE entity only (scoped by shared URL) |
| **Navigation** | ❌ No sidebar/navigation to other entities |
| **Revocation** | ✅ Delete `shared_url` from database to revoke access |
| **URL Uniqueness** | ✅ 8-character random codes (62^8 = 218 trillion combinations) |

---

DATA MODEL:
1️⃣ Core Business Entities (13 tables):

  1. d_office - Office locations (4-level hierarchy: Office→District→Region→Corporate)
  2. d_business - Business units (3-level hierarchy: Dept→Division→Corporate)
  3. d_project - Projects with budgets, timelines, stakeholders
  4. d_task - Tasks linked to projects
  5. d_employee - Users with authentication & RBAC (includes James Miller)
  6. d_client - Customer entities
  7. d_worksite - Work site locations
  8. d_role - Organizational roles (22 records)
  9. d_position - Employee positions (16 records)
  10. d_artifact - Documents & file attachments
  11. d_wiki - Knowledge base
  12. d_form_head - Form definitions
  13. d_reports - Report definitions

  2️⃣ Settings/Configuration Tables (16 tables):

  1. setting_datalabel_office_level - Office hierarchy (4 levels)
  2. setting_datalabel_business_level - Business hierarchy (3 levels)
  3. setting_datalabel_project_stage - Project lifecycle stages (with parent_id, color_code)
  4. setting_datalabel_task_stage - Task workflow stages (with parent_id, color_code)
  5. setting_datalabel_position_level - Position hierarchy
  6. setting_datalabel_opportunity_funnel_stage - Sales pipeline stages (with parent_id, color_code, branching support)
  7. setting_datalabel_industry_sector - Client industry classifications
  8. setting_datalabel_acquisition_channel - Client acquisition sources
  9. setting_datalabel_customer_tier - Customer service tiers
  10. setting_datalabel_client_level - Client classification levels
  11. setting_datalabel_client_status - Client status values
  12. setting_datalabel_task_priority - Task priority levels
  13. setting_datalabel_task_update_type - Task update categories
  14. setting_datalabel_wiki_publication_status - Wiki publication states
  15. setting_datalabel_form_approval_status - Form approval workflow states
  16. setting_datalabel_form_submission_status - Form submission states

  **Enhanced Features:**
  - **RAG Color Codes:** All stage/funnel tables include `color_code` field for visual consistency
  - **Hierarchical Support:** Tables with `parent_id` support branching workflows (e.g., "On Hold", "Blocked")
  - **Graph Visualization:** Hierarchical tables can be viewed as interactive graphs
  - **Parent Name Resolution:** Data tables show parent names instead of just IDs

---



## 🧪 Quick Start: API Testing
---
AI/LLM/Agent:
For API, UIUX or App testing, Strictly use the credentials below:
James Miller Account:
  - ID: 8260b1b0-5efc-4611-ad33-ee76c0cf7f13
  - Email: james.miller@huronhome.ca
  - Password: password123


Test any API endpoint using the generic testing tool:

```bash
# List resources
./tools/test-api.sh GET /api/v1/form
./tools/test-api.sh GET /api/v1/project
./tools/test-api.sh GET /api/v1/task

# Create resources
./tools/test-api.sh POST /api/v1/form '{"name":"Test Form","schema":{"steps":[]}}'

# Update resources
./tools/test-api.sh PUT /api/v1/form/uuid '{"name":"Updated Name"}'

# Delete resources
./tools/test-api.sh DELETE /api/v1/form/uuid
```

**Features:**
- ✅ Auto-authentication with James Miller account
- ✅ Colored output with HTTP status indicators
- ✅ JSON formatting with `jq`
- ✅ Supports GET, POST, PUT, DELETE methods
- ✅ Environment variable configuration

**Examples & Documentation:**
- 📖 Full guide: [tools/API_TESTING.md](./tools/API_TESTING.md)
- 📝 Example workflows: `./tools/examples/test-form-api.sh`
- 🔍 Run examples: `./tools/examples/test-api-examples.sh`


Modeling:

entity_id_map

Columns: entity, entity_id, child_entity, child_entity_id

Used for path building:

/entity/<child_entity>/<tab>

Example:

entity=project, entity_id=123456789, child_entity=task, child_entity_id=23456789011

5. RBAC & Permissions

Table: entity_id_rbac_map

Columns: empid, entity, entity_id, permission[]

Permissions:

0 → View

1 → Edit

2 → Share

3 → Delete

4 → Create

Key behavior:

If entity_id = 'all' and permission includes 4, user can create a new project.

Permission Checks

Can user create a project?

SELECT * FROM entity_id_rbac_map
WHERE entity = 'project'
  AND entity_id = 'all'
  AND 4 = ANY(permission);


Can user assign a project to a business department?

Must satisfy:

Project-level create permission

Business-level edit permission

WHERE entity = 'project' AND entity_id = 'all' AND 4 = ANY(permission)
AND entity = 'biz' AND entity_id = <specific_business_id> AND 1 = ANY(permission)


-------------RBAC------------
1. entity_id = 'all' (Type-Level Permissions)
    - Grants access to ALL instances of that entity type
    - James Miller has this for all 16 entity types
    - Example: entity='project', entity_id='all' → Can access all 5 projects
  2. entity_id = <UUID> (Instance-Level Permissions)
    - Grants access to ONE specific instance only
    - Example: entity='project', entity_id='93106ffb...' → Can only access that one project
  3. active_flag = true
    - Indicates the permission is currently active and enforced
    - All of James Miller's 16 permissions are active
    - Can be set to false to temporarily revoke without deleting
  4. Permission Array {0,1,2,3,4}
    - 0 = View (read access)
    - 1 = Edit (modify data)
    - 2 = Share (grant permissions)
    - 3 = Delete (soft delete)
    - 4 = Create (create new entities)
  5. Complex Permission Check (from newspecs.txt)
  -- Can user create project AND assign to business?
  WHERE entity='project' AND entity_id='all' AND 4=ANY(permission)  -- Can create
  AND entity='biz' AND entity_id=<uuid> AND 1=ANY(permission)       -- Can edit business
  5. James Miller: ✅ AUTHORIZED (has both permissions)



Flow diagram:
Complete Flow Diagrams: Task, Project, Business

  ---
  1. Project Entity Flow

  URL: /project/84215ccb-313d-48f8-9c37-4398f28c0b1f/task

  App.tsx (Auto-Generated Routes - Lines 60-95)
  ├─ generateEntityRoutes() generates route from entityConfig
  ├─ Route path="/project/:id" → EntityDetailPage (entityType="project")
  │   └─ Child routes auto-generated from config.childEntities: ['task', 'wiki', 'artifact', 'form']
  │   └─ Route path="task" → EntityChildListPage (parentType="project", childType="task")
  │
  EntityDetailPage.tsx
  ├─ useParams() → id = "84215ccb-313d-48f8-9c37-4398f28c0b1f"
  ├─ props: { entityType: "project" }
  ├─ Line 33: config = getEntityConfig("project")
  │   └─ entityConfig.ts:88-167 → project configuration
  │       ├─ childEntities: ['task', 'wiki', 'artifact', 'form']
  │       ├─ apiEndpoint: '/api/v1/project'
  │       └─ columns, fields, supportedViews
  ├─ Line 110-117: loadData() → Type-safe API call ✨
  │   └─ APIFactory.getAPI('project').get(id) → GET /api/v1/project/84215ccb...
  ├─ Line 138-145: useDynamicChildEntityTabs()
  │   └─ Creates tabs: ['Overview', 'Tasks', 'Wiki', 'Artifacts', 'Forms']
  ├─ Line 278-289: <DynamicChildEntityTabs> renders tab buttons
  └─ Line 379: <Outlet /> → Renders nested child route
      │
      └─ EntityChildListPage.tsx (Lines 1-281)
          ├─ props: { parentType: "project", childType: "task" }
          ├─ useParams() → { id: parentId } = "84215ccb-313d-48f8-9c37-4398f28c0b1f"
          ├─ Line 33: config = getEntityConfig("task")
          │   └─ entityConfig.ts:172-267 → task configuration
          ├─ Line 70-96: loadChildData() → Type-safe API call ✨
          │   ├─ Try: APIFactory.getAPI('project').getTasks(parentId)
          │   │   └─ GET /api/v1/project/84215ccb.../task
          │   └─ Fallback: APIFactory.getAPI('task').list({ parentId, parentType: "project" })
          │       └─ Backend query:
          │           SELECT t.* FROM app.d_task t
          │           INNER JOIN app.d_entity_id_map eim
          │             ON eim.child_entity_id = t.id::text
          │           WHERE eim.parent_entity_id = '84215ccb...'
          │             AND eim.parent_entity_type = 'project'
          │             AND eim.child_entity_type = 'task'
          │
          └─ Line 200-281: Renders based on view mode
              ├─ Table View (default) → FilteredDataTable
              │   └─ Uses config.columns from entityConfig.ts:177-244
              ├─ Kanban View → KanbanBoard
              │   └─ groupByField: 'stage' (config.kanban.groupByField)
              └─ Grid View → GridView

  ---
  2. Task Entity Flow

  URL: /task/b2222222-2222-2222-2222-222222222222/form

  App.tsx (Auto-Generated Routes - Lines 60-95)
  ├─ generateEntityRoutes() generates route from entityConfig
  ├─ Route path="/task/:id" → EntityDetailPage (entityType="task")
  │   └─ Child routes auto-generated from config.childEntities: ['form', 'artifact']
  │   └─ Route path="form" → EntityChildListPage (parentType="task", childType="form")
  │
  EntityDetailPage.tsx
  ├─ useParams() → id = "b2222222-2222-2222-2222-222222222222"
  ├─ props: { entityType: "task" }
  ├─ Line 33: config = getEntityConfig("task")
  │   └─ entityConfig.ts:172-267 → task configuration
  │       ├─ childEntities: ['form', 'artifact']
  │       ├─ apiEndpoint: '/api/v1/task'
  │       ├─ supportedViews: ['table', 'kanban']
  │       └─ kanban: { groupByField: 'stage', metaTable: 'setting_task_stage' }
  ├─ Line 110-117: loadData() → Type-safe API call ✨
  │   └─ APIFactory.getAPI('task').get(id) → GET /api/v1/task/b2222222...
  ├─ Line 138-145: useDynamicChildEntityTabs()
  │   └─ Creates tabs: ['Overview', 'Forms', 'Artifacts']
  ├─ Line 278-289: <DynamicChildEntityTabs> renders tab buttons
  └─ Line 379: <Outlet /> → Renders nested child route
      │
      └─ EntityChildListPage.tsx (Lines 1-281)
          ├─ props: { parentType: "task", childType: "form" }
          ├─ useParams() → { id: parentId } = "b2222222-2222-2222-2222-222222222222"
          ├─ Line 33: config = getEntityConfig("form")
          │   └─ entityConfig.ts:272-412 → form configuration
          ├─ Line 70-96: loadChildData() → Type-safe API call ✨
          │   ├─ Try: APIFactory.getAPI('task').getForms(parentId)
          │   │   └─ GET /api/v1/task/b2222222.../form  ✅ NEW ENDPOINT
          │   │       └─ Backend (task/routes.ts:1131-1203):
          │   │           -- RBAC Check
          │   │           SELECT 1 FROM app.entity_id_rbac_map rbac
          │   │           WHERE rbac.empid = userId
          │   │             AND rbac.entity = 'task'
          │   │             AND (rbac.entity_id = 'b2222222...' OR rbac.entity_id = 'all')
          │   │             AND 0 = ANY(rbac.permission)
          │   │
          │   │           -- Get Forms
          │   │           SELECT f.*, COALESCE(f.name, 'Untitled Form') as name
          │   │           FROM app.d_form_head f
          │   │           INNER JOIN app.d_entity_id_map eim
          │   │             ON eim.child_entity_id = f.id::text
          │   │           WHERE eim.parent_entity_id = 'b2222222...'
          │   │             AND eim.parent_entity_type = 'task'
          │   │             AND eim.child_entity_type = 'form'
          │   │             AND eim.active_flag = true
          │   │             AND f.active_flag = true
          │   │
          │   └─ Fallback: APIFactory.getAPI('form').list({ parentId, parentType: "task" })
          │
          └─ Line 200-281: Renders based on view mode
              └─ Table View (default) → FilteredDataTable
                  └─ Uses config.columns from entityConfig.ts:277-349

  ---
  3. Business Entity Flow

  URL: /biz/dddddddd-dddd-dddd-dddd-dddddddddddd/project

  App.tsx (Auto-Generated Routes - Lines 60-95)
  ├─ generateEntityRoutes() generates route from entityConfig
  ├─ Route path="/biz/:id" → EntityDetailPage (entityType="biz")
  │   └─ Child routes auto-generated from config.childEntities: ['project']
  │   └─ Route path="project" → EntityChildListPage (parentType="biz", childType="project")
  │
  EntityDetailPage.tsx
  ├─ useParams() → id = "dddddddd-dddd-dddd-dddd-dddddddddddd"
  ├─ props: { entityType: "biz" }
  ├─ Line 33: config = getEntityConfig("biz")
  │   └─ entityConfig.ts:514-612 → biz configuration
  │       ├─ childEntities: ['project', 'task', 'wiki', 'artifact', 'form']
  │       ├─ apiEndpoint: '/api/v1/biz'
  │       ├─ hierarchical: { levels: 3, levelNames: ['Department', 'Division', 'Corporate'] }
  │       └─ supportedViews: ['table']
  ├─ Line 110-117: loadData() → Type-safe API call ✨
  │   └─ APIFactory.getAPI('biz').get(id) → GET /api/v1/biz/dddddddd...
  ├─ Line 138-145: useDynamicChildEntityTabs()
  │   └─ Creates tabs: ['Overview', 'Projects', 'Tasks', 'Wiki', 'Artifacts', 'Forms']
  ├─ Line 278-289: <DynamicChildEntityTabs> renders tab buttons
  └─ Line 379: <Outlet /> → Renders nested child route
      │
      └─ EntityChildListPage.tsx (Lines 1-281)
          ├─ props: { parentType: "biz", childType: "project" }
          ├─ useParams() → { id: parentId } = "dddddddd-dddd-dddd-dddd-dddddddddddd"
          ├─ Line 33: config = getEntityConfig("project")
          │   └─ entityConfig.ts:88-167 → project configuration
          ├─ Line 70-96: loadChildData() → Type-safe API call ✨
          │   ├─ Try: APIFactory.getAPI('biz').getProjects(parentId)
          │   │   └─ GET /api/v1/biz/dddddddd.../project
          │   │       └─ Backend (biz/routes.ts):
          │   │           SELECT p.* FROM app.d_project p
          │   │           INNER JOIN app.d_entity_id_map eim
          │   │             ON eim.child_entity_id = p.id::text
          │   │           WHERE eim.parent_entity_id = 'dddddddd...'
          │   │             AND eim.parent_entity_type = 'biz'
          │   │             AND eim.child_entity_type = 'project'
          │   │             AND eim.active_flag = true
          │   │             AND p.active_flag = true
          │   │
          │   └─ Fallback: APIFactory.getAPI('project').list({ parentId, parentType: "biz" })
          │
          └─ Line 200-281: Renders based on view mode
              └─ Table View (default) → FilteredDataTable
                  └─ Uses config.columns from entityConfig.ts:93-150

  ---
  Layer-by-Layer Architecture Comparison

  | Layer                 | Project                                                       | Task                                                       | Business
                             | Implementation                          |
  |-----------------------|---------------------------------------------------------------|------------------------------------------------------------|-----------------------------------
  ---------------------------|-----------------------------------------|
  | 1. Sidebar Navigation | /project                                                      | /task                                                      | /biz
                             | Layout.tsx:70-86 - Same array structure |
  | 2. List Route         | <Route path="/project">                                       | <Route path="/task">                                       | <Route path="/biz">
                             | App.tsx:69,70,67 - Identical pattern    |
  | 3. List Component     | <EntityMainPage entityType="project" />                       | <EntityMainPage entityType="task" />                       | <EntityMainPage entityType="biz" 
  />                          | Same universal component                |
  | 4. Detail Route       | <Route path="/project/:id">                                   | <Route path="/task/:id">                                   | <Route path="/biz/:id">
                             | App.tsx:95,130,103 - Nested routes      |
  | 5. Detail Component   | <EntityDetailPage entityType="project" />                     | <EntityDetailPage entityType="task" />                     | <EntityDetailPage entityType="biz"
   />                        | Same universal component                |
  | 6. Child Route        | <Route path="task">                                           | <Route path="form">                                        | <Route path="project">
                             | App.tsx:96,131,104 - Dynamic tabs       |
  | 7. Child Component    | <EntityChildListPage parentType="project" childType="task" /> | <EntityChildListPage parentType="task" childType="form" /> | <EntityChildListPage 
  parentType="biz" childType="project" /> | Same universal component                |
  | 8. Configuration      | entityConfig.ts:88-167                                        | entityConfig.ts:172-267                                    | entityConfig.ts:514-612
                             | Central config file                     |
  | 9. API Endpoint       | /api/v1/project/:id/task                                      | /api/v1/task/:id/form ✅ NEW                                | /api/v1/biz/:id/project
                              | Fastify routes                          |
  | 10. Database Query    | d_entity_id_map INNER JOIN                                    | d_entity_id_map INNER JOIN                                 | d_entity_id_map INNER JOIN
                             | Universal schema                        |
  | 11. RBAC Check        | entity_id_rbac_map WHERE entity='project'                     | entity_id_rbac_map WHERE entity='task'                     | entity_id_rbac_map WHERE
  entity='biz'                        | Same permission table                   |

  ---
  Key Architecture Principles

  1. 100% Universal Components

  - EntityMainPage serves ALL entity list pages
  - EntityDetailPage serves ALL entity detail pages
  - EntityChildListPage serves ALL child entity tabs
  - Layout provides navigation for ALL entities

  2. Configuration-Driven Behavior

  - Single source of truth: entityConfig.ts
  - Defines: columns, fields, views, child entities, API endpoints
  - Components read config at runtime via getEntityConfig(entityType)

  3. Three-Tier Routing Pattern

  TIER 1: /entity           → EntityMainPage (list)
  TIER 2: /entity/:id       → EntityDetailPage (detail + tabs)
  TIER 3: /entity/:id/child → EntityChildListPage (filtered child list)

  4. Universal Database Schema

  - app.d_entity_id_map: Stores ALL parent-child relationships
    - Columns: parent_entity_type, parent_entity_id, child_entity_type, child_entity_id
    - Example: ('project', '84215ccb...', 'task', 'f1111111...')
  - app.entity_id_rbac_map: Stores ALL permissions
    - Columns: empid, entity, entity_id, permission[]
    - Permission array: {0:view, 1:edit, 2:share, 3:delete, 4:create}

  5. Identical API Patterns

  All child entity endpoints follow same structure:
  GET /api/v1/{parent_entity}/:id/{child_entity}
  ├─ RBAC check using entity_id_rbac_map
  ├─ Query using INNER JOIN with d_entity_id_map
  ├─ Pagination (page, limit)
  └─ Response: { data, total, page, limit }

 
  Detailed Architecture Similarities: Task, Project, and Business

  1. NAVIGATION LAYER - Sidebar (Layout.tsx)

  Similarity Pattern: Single Navigation Array Configuration

  All three entities (task, project, biz) share the exact same sidebar architecture:

  Location: /home/rabin/projects/pmo/apps/web/src/components/shared/layout/Layout.tsx:70-86

  const mainNavigationItems = [
    { name: 'Business', href: '/biz', icon: Building2, category: 'organizational' },
    { name: 'Project', href: '/project', icon: FolderOpen, category: 'operational' },
    { name: 'Task', href: '/task', icon: CheckSquare, category: 'operational' },
    // ... other entities
  ];

  Key Similarities:

  - Same Data Structure: All entities use identical { name, href, icon, category } schema
  - Same Rendering Logic: Lines 203-224 - All entities render using same component logic
  - Same Active State: Lines 205, 211-212 - isActive determined by currentPage === item.href
  - Same Icon System: All icons imported from lucide-react (lines 3-22)
  - Same Click Handler: Line 215 - onClick={() => setCurrentPage(item.href)}

  ---
  2. ROUTING LAYER - App.tsx (AUTO-GENERATED ROUTES)

  Similarity Pattern: Config-Driven Route Generation (DRY Principle)

  All core entities use auto-generated routes from entityConfig:

  Location: /home/rabin/projects/pmo/apps/web/src/App.tsx:56-95

  // Core entities with standard routing
  const coreEntities = ['biz', 'office', 'project', 'task', 'employee', 'role', 'worksite', 'client', 'position', 'artifact'];

  // Auto-generate routes for all entities
  const generateEntityRoutes = () => {
    return coreEntities.map(entityType => {
      const config = entityConfigs[entityType];
      return (
        <Fragment key={entityType}>
          {/* TIER 1: List Route */}
          <Route path={`/${entityType}`} element={<ProtectedRoute><EntityMainPage entityType={entityType} /></ProtectedRoute>} />

          {/* TIER 2: Create Route */}
          <Route path={`/${entityType}/new`} element={<ProtectedRoute><EntityCreatePage entityType={entityType} /></ProtectedRoute>} />

          {/* TIER 3: Detail + Child Routes */}
          <Route path={`/${entityType}/:id`} element={<ProtectedRoute><EntityDetailPage entityType={entityType} /></ProtectedRoute>}>
            {config.childEntities?.map(childType => (
              <Route key={childType} path={childType} element={<EntityChildListPage parentType={entityType} childType={childType} />} />
            ))}
          </Route>
        </Fragment>
      );
    });
  };

  // Usage in Routes
  <Routes>
    {generateEntityRoutes()}  {/* Generates 30 routes for 10 entities */}
  </Routes>

  Key Architecture Benefits:

  ✅ Single Source of Truth: Routes generated from entityConfig.ts
  ✅ DRY Principle: 89 lines reduced to 15-line generator function (-55% code)
  ✅ Zero Duplication: Impossible to have inconsistent routes
  ✅ Easy to Extend: Add entity = add 1 line to coreEntities array
  ✅ Type-Safe: Full TypeScript validation
  ✅ Maintainable: Child routes auto-generated from config.childEntities

  Example: Adding a New Entity
  BEFORE: Required 3 manual route blocks (list, create, detail + children)
  AFTER: Add 'newEntity' to coreEntities array - routes auto-generated! ✅

  - Identical Component: All use EntityMainPage for list view
  - Identical Component: All use EntityDetailPage for detail view
  - Identical Component: All use EntityChildListPage for child entities
  - Same Prop Pattern: All receive entityType prop (e.g., entityType="task")
  - Same Nesting: All use React Router's <Outlet /> for child routes
  - Config-Driven: Child routes generated from entityConfig.childEntities

  ---
  3. ENTITY MAIN PAGE (List View)

  Similarity Pattern: Universal Entity Table

  Location: /home/rabin/projects/pmo/apps/web/src/pages/shared/EntityMainPage.tsx

  All three entities share the exact same component with different configurations:

  export function EntityMainPage({ entityType }: EntityMainPageProps) {
    const config = getEntityConfig(entityType);  // Line 31 - Config lookup

    // UNIVERSAL FEATURES (shared by all):
    const handleRowClick = (item: any) => {
      navigate(`/${entityType}/${item.id}`);     // Line 67 - Same navigation
    };

    return (
      <FilteredDataTable                         // Line 152 - Same table component
        entityType={entityType}
        onRowClick={handleRowClick}
      />
    );
  }

  Key Similarities:

  - Same Component Structure: Lines 29-266 - All entities use identical JSX structure
  - Same Data Loading: Lines 44-64 - Type-safe API call via APIFactory.getAPI(entityType).list() ✨
  - Same Row Click Handler: Lines 66-68 - Navigate to /${entityType}/${id}
  - Same Create Button: Lines 249-255 - Navigate to /${entityType}/new
  - Same View Modes: Table, Kanban, Grid all use same rendering logic (lines 148-220)

  Configuration-Driven Differences:

  Project Config (entityConfig.ts:88-167):
  project: {
    columns: [...],           // Custom columns
    childEntities: ['task', 'wiki', 'artifact', 'form'],
    supportedViews: ['table']
  }

  Task Config (entityConfig.ts:172-267):
  task: {
    columns: [...],           // Custom columns
    childEntities: ['form', 'artifact'],
    supportedViews: ['table', 'kanban']
  }

  Business Config (entityConfig.ts:514-612):
  biz: {
    columns: [...],           // Custom columns
    childEntities: ['project'],
    supportedViews: ['table'],
    hierarchical: { levels: 3, ... }
  }

  ---
  4. ENTITY DETAIL PAGE

  Similarity Pattern: Universal Detail View with Dynamic Tabs

  Location: /home/rabin/projects/pmo/apps/web/src/pages/shared/EntityDetailPage.tsx

  All three entities use the exact same detail page component:

  export function EntityDetailPage({ entityType }: EntityDetailPageProps) {
    const { id } = useParams();                           // Line 29
    const config = getEntityConfig(entityType);           // Line 32

    // UNIVERSAL FEATURES (Type-Safe API Factory Pattern ✨):
    const loadData = async () => {
      const api = APIFactory.getAPI(entityType);          // Line 116 - Type-safe
      const response = await api.get(id);                 // Line 117
    };

    const handleSave = async () => {
      const api = APIFactory.getAPI(entityType);          // Type-safe
      await api.update(id, editedData);                   // Line 146
    };

    // DYNAMIC TABS (based on config.childEntities)
    const { tabs } = useDynamicChildEntityTabs(entityType, id); // Line 45

    return (
      <>
        <DynamicChildEntityTabs tabs={allTabs} />        // Line 280
        {isOverviewTab ? (
          <EntityFormContainer />                         // Line 340
        ) : (
          <Outlet />  // Child entity table                Line 379
        )}
      </>
    );
  }

  Key Similarities:

  - Same Data Fetching: Lines 110-144 - Type-safe API call via APIFactory.getAPI(entityType).get(id) ✨
  - Same Data Updating: Line 146 - Type-safe API call via APIFactory.getAPI(entityType).update(id, data) ✨
  - Same Header: Lines 221-238 - Back button + entity name display
  - Same Edit Mode: Lines 240-274 - Edit/Save/Cancel button logic
  - Same Tab System: Lines 278-289 - DynamicChildEntityTabs component
  - Same Overview Tab: Lines 292-360 - Entity field display using EntityFormContainer
  - Same Child Routing: Line 379 - <Outlet /> renders child entity tables

  Dynamic Behavior Based on Config:

  Project Detail (/project/:id):
  - Shows 4 tabs: Overview, Task, Wiki, Artifact, Form (from childEntities: ['task', 'wiki', 'artifact', 'form'])
  - Clicking "Task" tab → navigates to /project/:id/task
  - Renders EntityChildListPage parentType="project" childType="task"

  Task Detail (/task/:id):
  - Shows 2 tabs: Overview, Form, Artifact (from childEntities: ['form', 'artifact'])
  - Clicking "Form" tab → navigates to /task/:id/form
  - Renders EntityChildListPage parentType="task" childType="form"

  Business Detail (/biz/:id):
  - Shows 1 tab: Overview, Project (from childEntities: ['project'])
  - Clicking "Project" tab → navigates to /biz/:id/project
  - Renders EntityChildListPage parentType="biz" childType="project"

  ---
  5. API ARCHITECTURE

  Similarity Pattern: Parallel Endpoint Structure

  All three entities have identical API endpoint patterns:

  Project API (apps/api/src/modules/project/routes.ts):
  GET    /api/v1/project           // List all projects
  GET    /api/v1/project/:id       // Get single project
  POST   /api/v1/project           // Create project
  PUT    /api/v1/project/:id       // Update project
  DELETE /api/v1/project/:id       // Delete project

  // Child entity endpoints (using factory pattern ✨)
  GET    /api/v1/project/:id/task
  GET    /api/v1/project/:id/wiki
  GET    /api/v1/project/:id/artifact
  GET    /api/v1/project/:id/form

  Task API (apps/api/src/modules/task/routes.ts):
  GET    /api/v1/task           // List all tasks
  GET    /api/v1/task/:id       // Get single task
  POST   /api/v1/task           // Create task
  PUT    /api/v1/task/:id       // Update task
  DELETE /api/v1/task/:id       // Delete task

  // Child entity endpoints (using factory pattern ✨)
  GET    /api/v1/task/:id/form
  GET    /api/v1/task/:id/artifact

  Business API (apps/api/src/modules/biz/routes.ts):
  GET    /api/v1/biz           // List all business units
  GET    /api/v1/biz/:id       // Get single business unit
  POST   /api/v1/biz           // Create business unit
  PUT    /api/v1/biz/:id       // Update business unit
  DELETE /api/v1/biz/:id       // Delete business unit

  // Child entity endpoints
  GET    /api/v1/biz/:id/project
  GET    /api/v1/biz/:id/task
  GET    /api/v1/biz/:id/wiki
  GET    /api/v1/biz/:id/artifact
  GET    /api/v1/biz/:id/form

  ---
  5a. DRY PRINCIPLE: Child Entity Route Factory Pattern ✨

  **Problem Solved:** Eliminated 300+ lines of duplicate code across entity modules

  **Location:** `apps/api/src/lib/child-entity-route-factory.ts`

  **Pattern:** Higher-Order Route Factory that creates standardized child entity endpoints

  **Usage Pattern:**

  Currently, child entity endpoints are created manually in each module. The factory provides reusable functions for standardization:

  ```typescript
  // Available factory functions (not currently used in modules):
  import {
    createChildEntityEndpoint,
    createMinimalChildEntityEndpoint
  } from '../../lib/child-entity-route-factory.js';

  // These can be used to create standardized child endpoints:
  createChildEntityEndpoint(fastify, 'project', 'task', 'd_task');
  createMinimalChildEntityEndpoint(fastify, 'project', 'task', 'd_task');
  ```

  **Current Implementation (Manual Endpoints):**

  Projects currently use manual endpoint definitions:
  ```typescript
  // project/routes.ts - Manual child entity endpoints
  fastify.get('/api/v1/project/:id/task', { ... });
  fastify.get('/api/v1/project/:id/wiki', { ... });
  fastify.get('/api/v1/project/:id/forms', { ... });
  fastify.get('/api/v1/project/:id/artifacts', { ... });
  ```

  What the Factory Creates:
  - ✅ Universal RBAC check using entity_id_rbac_map
  - ✅ Standard pagination (page, limit)
  - ✅ Unified error handling
  - ✅ Consistent response format: { data, total, page, limit }
  - ✅ Works with d_entity_id_map universal relationship table

  **Benefits:**
  - 🎯 **Centralized table mapping** via ENTITY_TABLE_MAP
  - 🔒 **Consistent RBAC** pattern across all child endpoints
  - 🚀 **Standardized query pattern** for parent-child relationships
  - ✅ **Reusable components** available for future refactoring

  Key Similarities in API Implementation:

  1. RBAC Pattern (identical across all):
  const taskAccess = await db.execute(sql`
    SELECT 1 FROM app.entity_id_rbac_map rbac
    WHERE rbac.empid = ${userId}
      AND rbac.entity = 'task'                    // Entity type
      AND (rbac.entity_id = ${id} OR rbac.entity_id = 'all')
      AND rbac.active_flag = true
      AND 0 = ANY(rbac.permission)                // View permission
  `);

  2. Child Entity Query Pattern (identical across all):
  // Example: /api/v1/task/:id/form endpoint
  const forms = await db.execute(sql`
    SELECT f.*, COALESCE(f.name, 'Untitled Form') as name
    FROM app.d_form_head f
    INNER JOIN app.d_entity_id_map eim ON eim.child_entity_id = f.id::text
    WHERE eim.parent_entity_id = ${taskId}
      AND eim.parent_entity_type = 'task'         // Parent type
      AND eim.child_entity_type = 'form'          // Child type
      AND eim.active_flag = true
      AND f.active_flag = true
    ORDER BY f.created_ts DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  3. Response Format (identical across all):
  return {
    data: items,
    total: Number(countResult[0]?.total || 0),
    page,
    limit
  };

  ---
  5b. DRY PRINCIPLE: Entity Delete Route Factory Pattern ✨

  **Problem Solved:** Eliminated 166+ lines of duplicate cascading delete code across entity modules

  **Location:** `apps/api/src/lib/entity-delete-route-factory.ts`

  **Documentation:** `apps/api/src/lib/ENTITY_DELETE_FACTORY_README.md`

  **Pattern:** Higher-Order Route Factory that creates standardized DELETE endpoints with 3-step cascading cleanup

  **Usage Example in task/routes.ts:**
  ```typescript
  import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';

  export async function taskRoutes(fastify: FastifyInstance) {
    // ... CRUD endpoints (list, get, create, update) ...

    // Replace 70+ lines of duplicate delete code with 1 line:
    createEntityDeleteEndpoint(fastify, 'task');

    // ✅ Creates: DELETE /api/v1/task/:id
    // ✅ Includes: RBAC check + 3-step cascading delete + error handling
  }
  ```

  **Usage Example in project/routes.ts:**
  ```typescript
  import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';

  export async function projectRoutes(fastify: FastifyInstance) {
    // ... CRUD endpoints ...

    // Replace 59+ lines with 1 line:
    createEntityDeleteEndpoint(fastify, 'project');
  }
  ```

  **3-Step Cascading Delete Flow:**

  When `DELETE /api/v1/task/:id` is called:

  **Step 1:** Delete from base entity table (e.g., `app.d_task`)
  ```sql
  UPDATE app.d_task
  SET active_flag = false, to_ts = NOW(), updated_ts = NOW()
  WHERE id = '...'::uuid
  ```

  **Step 2:** Delete from entity instance registry (`app.d_entity_instance_id`)
  ```sql
  UPDATE app.d_entity_instance_id
  SET active_flag = false, updated_ts = NOW()
  WHERE entity_type = 'task' AND entity_id = '...'::uuid
  ```
  - **Impact:** Removes from global search, child-tabs API, dashboard statistics

  **Step 3:** Delete linkages in both directions (`app.d_entity_id_map`)
  ```sql
  -- Delete as child: project → task linkage
  UPDATE app.d_entity_id_map
  SET active_flag = false, updated_ts = NOW()
  WHERE child_entity_type = 'task' AND child_entity_id = '...'::uuid

  -- Delete as parent: task → form/artifact linkages
  UPDATE app.d_entity_id_map
  SET active_flag = false, updated_ts = NOW()
  WHERE parent_entity_type = 'task' AND parent_entity_id = '...'::uuid
  ```

  **What the Factory Creates:**
  - ✅ RBAC delete permission check (permission = 3)
  - ✅ Entity existence validation
  - ✅ 3-step cascading soft delete
  - ✅ Unified error handling (403, 404, 500)
  - ✅ Consistent response (204 No Content on success)
  - ✅ Fastify logging integration

  **Benefits:**
  - 📉 **166+ lines eliminated** across 3 modules (project, office, biz)
  - 🎯 **Single source of truth** for delete operations
  - 🔒 **Guaranteed cascading cleanup** - impossible to miss registry/linkage deletion
  - 🚀 **Easy to extend** - add delete endpoint with 1 line
  - ✅ **Pattern consistency** - matches child-entity-route-factory.ts exactly

  **Currently Implemented:**
  - ✅ `task` - apps/api/src/modules/task/routes.ts
  - ✅ `project` - apps/api/src/modules/project/routes.ts
  - ✅ `office` - apps/api/src/modules/office/routes.ts
  - ✅ `biz` - apps/api/src/modules/biz/routes.ts

  **Advanced Usage (Custom Cleanup):**
  ```typescript
  // artifact/routes.ts - Delete S3 files before DB delete
  createEntityDeleteEndpoint(fastify, 'artifact', {
    customCleanup: async (artifactId) => {
      await deleteS3Files(artifactId);  // Custom cleanup logic
    }
  });
  ```

  **Pattern Consistency with Child Factory:**

  | Feature | child-entity-route-factory.ts | entity-delete-route-factory.ts |
  |---------|------------------------------|--------------------------------|
  | Location | `apps/api/src/lib/` | `apps/api/src/lib/` ✅ |
  | Naming | `create...Endpoint()` | `createEntityDeleteEndpoint()` ✅ |
  | Table mapping | `ENTITY_TABLE_MAP` (exported) | Imports same mapping ✅ |
  | SQL pattern | `sql.identifier()` + `app.${identifier}` | Same ✅ |
  | RBAC | Checks permission array | Same ✅ |

  ---
  6. DATABASE ARCHITECTURE

  Similarity Pattern: Unified Entity Relationship Model

  All three entities use the same database pattern:

  Core Entity Tables:
  - app.d_project - Projects table
  - app.d_task - Tasks table
  - app.d_business - Business units table

  Universal Relationship Table:
  - app.d_entity_id_map - Links ALL parent-child relationships

  -- Example relationships in d_entity_id_map:
  parent_entity_type = 'project', parent_entity_id = 'abc123', child_entity_type = 'task', child_entity_id = 'def456'
  parent_entity_type = 'task',    parent_entity_id = 'def456', child_entity_type = 'form', child_entity_id = 'ghi789'
  parent_entity_type = 'biz',     parent_entity_id = 'xyz999', child_entity_type = 'project', child_entity_id = 'abc123'

  Universal RBAC Table:
  - app.entity_id_rbac_map - Permissions for ALL entities

  -- Example permissions:
  entity = 'task',    entity_id = 'all',    permission = {0,1,2,3,4}  -- All task permissions
  entity = 'project', entity_id = 'abc123', permission = {0,1}        -- View/edit specific project
  entity = 'biz',     entity_id = 'all',    permission = {0}          -- View all business units

  ---
  7. CONFIGURATION SYSTEM

  Similarity Pattern: Declarative Entity Config

  All entities are defined in one centralized config file:

  Location: /home/rabin/projects/pmo/apps/web/src/lib/entityConfig.ts

  export const entityConfigs: Record<string, EntityConfig> = {
    project: {
      name: 'project',
      displayName: 'Project',
      pluralName: 'Projects',
      apiEndpoint: '/api/v1/project',
      columns: [...],              // Table columns
      fields: [...],               // Form fields
      supportedViews: ['table'],
      childEntities: ['task', 'wiki', 'artifact', 'form']
    },

    task: {
      name: 'task',
      displayName: 'Task',
      pluralName: 'Tasks',
      apiEndpoint: '/api/v1/task',
      columns: [...],
      fields: [...],
      supportedViews: ['table', 'kanban'],
      kanban: { groupByField: 'stage', ... },
      childEntities: ['form', 'artifact']
    },

    biz: {
      name: 'biz',
      displayName: 'Business Unit',
      pluralName: 'Business Units',
      apiEndpoint: '/api/v1/biz',
      columns: [...],
      fields: [...],
      supportedViews: ['table'],
      hierarchical: { levels: 3, ... },
      childEntities: ['project']
    }
  };

  What the Config Controls:

  - Table Columns: Which columns appear in EntityMainPage table
  - Form Fields: Which fields appear in EntityDetailPage form
  - Child Tabs: Which tabs appear in EntityDetailPage based on childEntities
  - API Endpoint: Where to fetch data from
  - View Modes: Table/Kanban/Grid availability
  - Special Features: Kanban config, hierarchical config, etc.

  ---
  8. FRONTEND API INTEGRATION (Type-Safe API Factory ✨)

  Similarity Pattern: Centralized API Registry with Runtime Validation

  **Problem Solved:** Eliminated unsafe dynamic API calls across all components

  **Location:** `apps/web/src/lib/api-factory.ts`

  All entity API calls now use the type-safe factory pattern:

  ```typescript
  // BEFORE (Unsafe):
  const apiModule = (api as any)[`${entityType}Api`];  // ❌ No type safety
  const response = await apiModule.list({ page: 1 });

  // AFTER (Type-Safe):
  const api = APIFactory.getAPI(entityType);           // ✅ Type-safe
  const response = await api.list({ page: 1 });
  ```

  **Universal Components Using API Factory:**
  - EntityMainPage.tsx:50 - `APIFactory.getAPI(entityType).list()`
  - EntityDetailPage.tsx:116 - `APIFactory.getAPI(entityType).get(id)`
  - EntityDetailPage.tsx:146 - `APIFactory.getAPI(entityType).update(id, data)`
  - EntityChildListPage.tsx:71 - `APIFactory.getAPI(parentType).get${ChildType}s(id)`
  - EntityCreatePage.tsx:81 - `APIFactory.getAPI(entityType).create(data)`

  **Benefits:**
  - ✅ Compile-time type checking prevents runtime errors
  - ✅ Clear error messages when API not found
  - ✅ Full IDE autocomplete support
  - ✅ Easy mocking for unit tests
  - ✅ Zero `(api as any)` anti-patterns

  **Registered APIs (13 entities):**
  - Core Business: project, task, biz, office
  - People: employee, client, role, position
  - Content: wiki, artifact, form
  - Locations: worksite

  ---
  SUMMARY: Core Architectural Similarities

  | Layer              | Similarity                                            | Evidence                                         |
  |--------------------|-------------------------------------------------------|--------------------------------------------------|
  | Sidebar Navigation | All entities use same mainNavigationItems array       | Layout.tsx:70-86                                 |
  | Routing            | All use same 3-tier route pattern (list/detail/child) | App.tsx:67-133                                   |
  | List Page          | All use same EntityMainPage component                 | EntityMainPage.tsx:29-266                        |
  | Detail Page        | All use same EntityDetailPage component               | EntityDetailPage.tsx:28-383                      |
  | **API Integration ✨** | **All use type-safe APIFactory.getAPI() pattern**    | **api-factory.ts + 4 universal components**     |
  | API Endpoints      | All follow same REST pattern + child endpoints        | task/routes.ts, project/routes.ts, biz/routes.ts |
  | Database           | All use d_entity_id_map for relationships             | d_entity_id_map table                            |
  | RBAC               | All use entity_id_rbac_map for permissions            | entity_id_rbac_map table                         |
  | Configuration      | All defined in single entityConfigs object            | entityConfig.ts:84-1520                          |

  The system is 100% universal - adding a new entity only requires:
  1. Creating config entry in entityConfig.ts
  2. Registering API in APIFactory (apps/web/src/lib/api.ts) ✨
  3. Adding routes in App.tsx
  4. Creating API endpoints following the pattern
  5. Defining database table + populating d_entity_id_map for relationships