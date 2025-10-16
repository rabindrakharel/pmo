# MANDATORY RULES FOR PMO PLATFORM DEVELOPMENT

## 🚨 CRITICAL: ALWAYS USE PROJECT TOOLS

### 1. API Testing - STRICTLY USE TOOLS
**NEVER use raw `curl` commands for API testing. ALWAYS use the project testing tool.**

❌ **WRONG - Do NOT do this:**
```bash
curl -s "http://localhost:4000/api/v1/project" -H "Authorization: Bearer $TOKEN"
```

✅ **CORRECT - Always do this:**
```bash
./tools/test-api.sh GET /api/v1/project
./tools/test-api.sh POST /api/v1/project '{"name":"Test Project","code":"PROJ-001"}'
./tools/test-api.sh PUT /api/v1/project/{uuid} '{"name":"Updated Name"}'
./tools/test-api.sh DELETE /api/v1/project/{uuid}
```

**Why?**
- Auto-authentication with James Miller credentials
- Proper error handling and colored output
- Follows project conventions
- JSON formatting included
- No manual token management

### 2. Database Import - ALWAYS IMPORT AFTER DDL CHANGES

**MANDATORY: After ANY change to `/home/rabin/projects/pmo/db/*.ddl` files, you MUST import the database.**

✅ **Required command after DDL changes:**
```bash
./tools/db-import.sh
```

**When to use:**
- After creating/modifying any `.ddl` file in `db/` directory
- After changing table structure
- After adding/modifying seed data
- After changing constraints or indexes

**Options:**
```bash
./tools/db-import.sh              # Normal import
./tools/db-import.sh --verbose    # Detailed output
./tools/db-import.sh --dry-run    # Validate without importing
```

**Example workflow:**
```bash
# 1. Modify DDL file
nano db/33_d_entity_id_map.ddl

# 2. IMMEDIATELY import the changes
./tools/db-import.sh

# 3. Test the API endpoint
./tools/test-api.sh GET /api/v1/linkage
```

### 3. Source of Truth Hierarchy

**THIS IS THE ARCHITECTURE - NEVER VIOLATE THIS ORDER:**

```
📊 Database DDL Files (SOURCE OF TRUTH)
    ↓
    └─→ /home/rabin/projects/pmo/db/*.ddl
         • Business logic defined here
         • Data model defined here
         • Relationships defined here
         • Seed data defined here

🔧 API Layer (MUST ADHERE TO DATA MODEL)
    ↓
    └─→ /home/rabin/projects/pmo/apps/api/src/modules/
         • API MUST match DDL schema exactly
         • Endpoints MUST respect table structure
         • Validation MUST match DDL constraints
         • Routes MUST follow entity relationships from DDL

🎨 UI/UX Layer (MUST ADHERE TO API)
    ↓
    └─→ /home/rabin/projects/pmo/apps/web/src/
         • UI MUST consume API responses
         • Forms MUST match API request schemas
         • Entity configs MUST match API structure
         • Navigation MUST follow API entity relationships
```

**Rule:**
- **DDL files** define the business logic and data model
- **API** implements what DDL defines (no more, no less)
- **UI** displays what API provides (no assumptions)

### 4. Before Making Any Changes - Check DDL First

**Checklist before coding:**
- [ ] Did I read the relevant DDL file in `/home/rabin/projects/pmo/db/`?
- [ ] Do I understand the table structure and relationships?
- [ ] Does my API change match the DDL schema?
- [ ] Does my UI change match the API response?
- [ ] Did I run `./tools/db-import.sh` after DDL changes?

### 5. Testing Workflow - Always Use Tools

**Complete testing workflow:**
```bash
# Step 1: Start the platform (if not running)
./tools/start-all.sh

# Step 2: After ANY DDL change
./tools/db-import.sh

# Step 3: Test API endpoints
./tools/test-api.sh GET /api/v1/{entity}
./tools/test-api.sh POST /api/v1/{entity} '{"field":"value"}'

# Step 4: Check logs if issues
./tools/logs-api.sh
./tools/logs-web.sh

# Step 5: Monitor in real-time (optional)
./tools/logs-api.sh -f
```

### 6. Common API Testing Examples

**List all entities:**
```bash
./tools/test-api.sh GET /api/v1/project
./tools/test-api.sh GET /api/v1/task
./tools/test-api.sh GET /api/v1/linkage
./tools/test-api.sh GET /api/v1/employee
```

**Get specific entity:**
```bash
./tools/test-api.sh GET /api/v1/project/{uuid}
./tools/test-api.sh GET /api/v1/linkage/{uuid}
```

**Create new entity:**
```bash
./tools/test-api.sh POST /api/v1/linkage '{
  "parent_entity_type": "project",
  "parent_entity_id": "uuid-here",
  "child_entity_type": "task",
  "child_entity_id": "uuid-here"
}'
```

**Update entity:**
```bash
./tools/test-api.sh PUT /api/v1/project/{uuid} '{
  "name": "Updated Project Name"
}'
```

**Delete entity:**
```bash
./tools/test-api.sh DELETE /api/v1/linkage/{uuid}
```

### 7. Authentication - Always Use James Miller

**Test credentials (hardcoded in tools):**
- Email: `james.miller@huronhome.ca`
- Password: `password123`
- User ID: `8260b1b0-5efc-4611-ad33-ee76c0cf7f13`

**The tools handle authentication automatically. You don't need to manage tokens manually.**

## 🔍 Pre-Flight Checklist

Before executing ANY command, ask yourself:

1. **Is this an API test?** → Use `./tools/test-api.sh`
2. **Did I change a DDL file?** → Run `./tools/db-import.sh`
3. **Am I starting the platform?** → Use `./tools/start-all.sh`
4. **Am I checking logs?** → Use `./tools/logs-api.sh` or `./tools/logs-web.sh`
5. **Do I understand the data model?** → Read the DDL file in `/home/rabin/projects/pmo/db/`

## 📍 DDL File Reference

All database tables and business logic are defined in:
```
/home/rabin/projects/pmo/db/
├── 11_d_employee.ddl
├── 12_d_office.ddl
├── 13_d_business.ddl
├── 14_d_client.ddl
├── 18_d_project.ddl
├── 19_d_task.ddl
├── 23_d_form_head.ddl
├── 25_d_wiki.ddl
├── 21_d_artifact.ddl
├── 32_d_entity.ddl
├── 33_d_entity_id_map.ddl      ← Parent-child relationships
├── 34_d_entity_id_rbac_map.ddl ← Permissions
└── ... (39 total files)
```

**When in doubt, read the DDL file. It is the source of truth.**

## ⚠️ Common Mistakes to Avoid

1. ❌ Using `curl` instead of `./tools/test-api.sh`
2. ❌ Modifying DDL without running `./tools/db-import.sh`
3. ❌ Building UI based on assumptions instead of API responses
4. ❌ Creating API endpoints that don't match DDL schema
5. ❌ Forgetting to check DDL files before making changes
6. ❌ Manual token management (tools handle this)
7. ❌ Testing in browser before testing API with tools

## ✅ Correct Development Flow

```
1. Read DDL file → Understand data model
2. Modify DDL (if needed) → Run ./tools/db-import.sh
3. Update API (if needed) → Test with ./tools/test-api.sh
4. Update UI (if needed) → Test in browser
5. Check logs → ./tools/logs-api.sh or ./tools/logs-web.sh
```

---

## 🚫 DO NOT REINVENT THE WHEEL

**ALWAYS understand existing project patterns before creating new components.**

### Project Architecture Quick Reference

**Data Flow (How Everything Connects):**
```
DDL Schema → API Module → Entity Config → UI Component → Layout
```

**1. Database → API Connection:**
- DDL defines table in `/db/33_d_entity_id_map.ddl`
- API creates route in `/apps/api/src/modules/linkage/routes.ts`
- API returns JSON matching DDL column names (snake_case)

**2. API → Frontend Connection:**
- Entity config in `/apps/web/src/lib/entityConfig.ts` defines columns/fields
- Columns must match API response fields
- `apiEndpoint: '/api/v1/linkage'` connects to backend

**3. Frontend Component Hierarchy:**
```
<Layout>                          ← Wrapper with sidebar/header
  └─ <EntityMainPage>            ← List view (table/kanban/grid)
       └─ <FilteredDataTable>    ← Reusable table component
            └─ <DataTable>       ← Base table with sorting/filtering
```

### Reusable Components (DO NOT RECREATE)

**Layout & Structure:**
- `Layout` - Main app wrapper (sidebar + header + content)
- `EntityMainPage` - Entity list pages (reuse for all entities)
- `EntityDetailPage` - Entity detail with tabs (reuse for all entities)
- `EntityChildListPage` - Filtered child entity lists

**Data Display:**
- `FilteredDataTable` - Smart table with API integration
- `DataTable` - Base table with sorting/pagination/filtering
- `KanbanBoard` - Kanban view for task/project stages
- `GridView` - Card/grid layout for visual entities

**Forms & Inputs:**
- Use standard HTML inputs with Tailwind classes
- No custom form library - use controlled components

**Modals & Overlays:**
- Check if modal component exists before creating new one

### 🎨 Official PMO Platform Design System

**MANDATORY: All new pages and components MUST follow these exact patterns from EntityMainPage, EntityDetailPage, and DynamicChildEntityTabs.**

---

#### **Layout & Container Patterns**

**Page Container (from EntityMainPage.tsx:227-264):**
```tsx
<Layout>
  <div className="h-full flex flex-col space-y-4 w-[97%] max-w-[1536px] mx-auto">
    {/* Page Header */}
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <IconComponent className="h-5 w-5 text-gray-600 stroke-[1.5]" />
        <div>
          <h1 className="text-sm font-normal text-gray-800">Page Title</h1>
          <p className="mt-1 text-sm text-gray-500">Description text</p>
        </div>
      </div>
      {/* Right side actions */}
    </div>

    {/* Main Content */}
    <div className="flex-1 min-h-0">
      {/* Content here */}
    </div>
  </div>
</Layout>
```

**Detail Page Container (from EntityDetailPage.tsx:219-382):**
```tsx
<Layout>
  <div className="w-[97%] max-w-[1536px] mx-auto space-y-6">
    {/* Detail Header with Back Button */}
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <button
          onClick={handleBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600 stroke-[1.5]" />
        </button>
        <div>
          <h1 className="text-sm font-normal text-gray-500">
            {entityName}
            <span className="text-xs font-light text-gray-500 ml-3">
              Entity Type · ID
            </span>
          </h1>
        </div>
      </div>
      {/* Edit/Save buttons */}
    </div>

    {/* Dynamic Tabs (if has children) */}
    {tabs.length > 0 && (
      <div className="bg-white rounded-lg shadow">
        <DynamicChildEntityTabs {...tabProps} />
      </div>
    )}

    {/* Content Area */}
    <div className="space-y-4">
      {/* Content */}
    </div>
  </div>
</Layout>
```

---

#### **Typography System**

**From EntityMainPage and EntityDetailPage - Use EXACTLY these classes:**

```tsx
// Page Title (Main pages)
<h1 className="text-sm font-normal text-gray-800">Projects</h1>

// Page Description (Main pages)
<p className="mt-1 text-sm text-gray-500">Manage and track projects</p>

// Detail Page Title
<h1 className="text-sm font-normal text-gray-500">
  Entity Name
  <span className="text-xs font-light text-gray-500 ml-3">Type · ID</span>
</h1>

// Section Headers (in cards)
<h2 className="text-sm font-semibold text-gray-900">Section Title</h2>

// Tab Labels (DynamicChildEntityTabs:102-108)
<span className="font-normal text-sm text-gray-800">Tab Name</span>  // Active
<span className="font-normal text-sm text-gray-500">Tab Name</span>  // Inactive

// Body Text
<p className="text-sm text-gray-700">Regular paragraph text</p>

// Muted/Helper Text
<span className="text-xs text-gray-500">Helper text or metadata</span>

// Error Messages
<p className="text-sm text-red-600">Error message</p>
```

**Key Rules:**
- ✅ **ALWAYS** use `font-normal` for headings (NOT font-semibold/font-bold)
- ✅ **ALWAYS** use `text-sm` for main text (NOT text-base/text-lg)
- ✅ Icons: `stroke-[1.5]` for thin, clean lines
- ❌ **NEVER** use `font-semibold` or `font-bold` except for section headers inside cards

---

#### **Button Patterns**

**From EntityMainPage.tsx:249-256 and EntityDetailPage.tsx:251-271:**

```tsx
// Primary Action Button (Create, Save)
<button className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-normal rounded text-white bg-blue-600 hover:bg-blue-700 transition-colors">
  <IconComponent className="h-4 w-4 mr-2 stroke-[1.5]" />
  Button Text
</button>

// Secondary Button (Edit, Cancel)
<button className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-normal rounded text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-colors">
  <IconComponent className="h-4 w-4 mr-2 stroke-[1.5]" />
  Button Text
</button>

// Danger Button (Delete)
<button className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-normal rounded text-white bg-red-600 hover:bg-red-700 transition-colors">
  <Trash2 className="h-4 w-4 mr-2 stroke-[1.5]" />
  Delete
</button>

// Icon-only Button (Back, Close)
<button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
  <ArrowLeft className="h-5 w-5 text-gray-600 stroke-[1.5]" />
</button>

// Loading State
<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
```

**Button Sizes:**
- Standard: `px-3 py-1.5` (NOT px-4 py-2)
- Icons: `h-4 w-4` with `mr-2` spacing
- Icon-only: `p-2` padding

---

#### **Tab Navigation Pattern**

**From DynamicChildEntityTabs.tsx:89-135 - Exact Implementation:**

```tsx
<div className="bg-white border-b border-gray-200">
  <div className="px-6 pt-4">
    <nav className="flex space-x-8" aria-label="Tabs">
      {tabs.map((tab) => {
        const isActive = activeTab?.id === tab.id;
        const IconComponent = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab)}
            className={[
              'group inline-flex items-center space-x-2 py-4 px-1 border-b-2 font-normal text-sm transition-colors duration-200',
              isActive
                ? 'border-gray-800 text-gray-800'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 cursor-pointer'
            ].join(' ')}
          >
            <IconComponent className={[
              'h-3.5 w-3.5 transition-colors duration-200 stroke-[1.5]',
              isActive
                ? 'text-gray-600'
                : 'text-gray-400 group-hover:text-gray-500'
            ].join(' ')} />
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={[
                'inline-flex items-center px-2 py-0.5 rounded text-xs font-normal transition-colors duration-200',
                isActive
                  ? 'bg-gray-100 text-gray-700'
                  : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'
              ].join(' ')}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  </div>
</div>
```

**Tab Rules:**
- ✅ Bottom border (NOT top border)
- ✅ Active: `border-gray-800` with `text-gray-800`
- ✅ Inactive: `border-transparent` with `text-gray-500`
- ✅ Icon size: `h-3.5 w-3.5` (smaller than buttons)
- ✅ Spacing: `space-x-8` between tabs, `space-x-2` inside tab

---

#### **Color Palette**

**From project components - Use EXACTLY these:**

```css
/* Backgrounds */
bg-white          /* Cards, panels */
bg-gray-50        /* Subtle backgrounds, headers */
bg-gray-100       /* Hover states, disabled fields */

/* Text Colors */
text-gray-800     /* Primary headings */
text-gray-700     /* Body text */
text-gray-600     /* Secondary text, icons */
text-gray-500     /* Muted text, descriptions */
text-gray-400     /* Disabled, very subtle */

/* Borders */
border-gray-200   /* Default borders */
border-gray-300   /* Hover borders, inputs */
border-gray-800   /* Active tab indicator */

/* Status Colors */
bg-blue-600 text-white      /* Primary actions */
bg-blue-50 border-blue-200  /* Info backgrounds */
bg-green-50 border-green-200 text-green-700  /* Success */
bg-red-50 border-red-200 text-red-700        /* Errors */
bg-yellow-50 border-yellow-200 text-yellow-700  /* Warnings */

/* Interactive States */
hover:bg-gray-50     /* Secondary button hover */
hover:bg-gray-100    /* Icon button hover */
hover:bg-blue-700    /* Primary button hover */
hover:border-gray-400  /* Input/button border hover */
```

---

#### **Card & Panel Patterns**

**From FilteredDataTable and EntityDetailPage:**

```tsx
// Standard White Card with Shadow
<div className="bg-white rounded-lg shadow p-6">
  {/* Content */}
</div>

// Card with Border (no shadow)
<div className="bg-white rounded-lg border border-gray-200 p-6">
  {/* Content */}
</div>

// Card with Header Section
<div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
    <h2 className="text-sm font-semibold text-gray-900">Header Title</h2>
  </div>
  <div className="p-4">
    {/* Content */}
  </div>
</div>

// Split Panel Layout (from LinkagePage)
<div className="grid grid-cols-2 gap-4">
  <div className="bg-white rounded-lg border border-gray-200 flex flex-col">
    {/* Left panel */}
  </div>
  <div className="bg-white rounded-lg border border-gray-200 flex flex-col">
    {/* Right panel */}
  </div>
</div>
```

---

#### **Spacing System**

**From project components - Standard measurements:**

```css
/* Container Spacing */
w-[97%] max-w-[1536px] mx-auto  /* Page container width */
space-y-4   /* Vertical spacing between sections */
space-y-6   /* Larger vertical spacing */
space-x-3   /* Horizontal spacing between elements */
space-x-8   /* Tab spacing */

/* Padding */
p-2         /* Icon-only buttons */
p-4         /* Card content */
p-6         /* Main card padding */
px-3 py-1.5 /* Standard buttons */
px-4 py-3   /* Card headers */
px-6 pt-4   /* Tab containers */

/* Margins */
mt-1        /* Small top margin (descriptions) */
ml-2 mr-2   /* Icon spacing in buttons */
ml-3        /* Larger inline spacing */

/* Gaps */
gap-2       /* Small grid gaps */
gap-4       /* Medium grid gaps */
gap-6       /* Large grid gaps */
```

---

#### **Icon Usage (Lucide React)**

**Standard Icon Sizes and Patterns:**

```tsx
import {
  FolderOpen,   // Project - h-5 w-5
  CheckSquare,  // Task - h-5 w-5
  Building2,    // Business/Office - h-5 w-5
  MapPin,       // Location - h-5 w-5
  Users,        // Client/Employee - h-5 w-5
  BookOpen,     // Wiki - h-5 w-5
  FileText,     // Form/Artifact - h-5 w-5
  Link2,        // Linkage - h-5 w-5
  Plus,         // Create - h-4 w-4
  Edit2,        // Edit - h-4 w-4
  Trash2,       // Delete - h-4 w-4
  X,            // Close - h-4 w-4
  Check,        // Success - h-5 w-5
  AlertCircle,  // Error/Warning - h-5 w-5
  ArrowLeft,    // Back - h-5 w-5
  Save,         // Save - h-4 w-4
} from 'lucide-react';

// Usage in page headers (larger)
<IconComponent className="h-5 w-5 text-gray-600 stroke-[1.5]" />

// Usage in buttons (smaller)
<IconComponent className="h-4 w-4 text-current stroke-[1.5]" />

// Usage in tabs (smallest)
<IconComponent className="h-3.5 w-3.5 text-gray-400 stroke-[1.5]" />
```

**ALWAYS use `stroke-[1.5]` for thin, clean lines matching the minimalistic design.**

### Entity Configuration Pattern

**Every entity follows this structure in `entityConfig.ts`:**
```typescript
{
  name: 'entityType',                    // DB table name (without d_ prefix)
  displayName: 'Entity',                 // Singular display name
  pluralName: 'Entities',                // Plural for UI
  apiEndpoint: '/api/v1/entity',         // API base path

  columns: [                             // Table columns (matches API response)
    { key: 'name', title: 'Name', sortable: true, filterable: true },
    { key: 'status', title: 'Status', loadOptionsFromSettings: true }
  ],

  fields: [                              // Form fields (matches API request)
    { key: 'name', label: 'Name', type: 'text', required: true }
  ],

  supportedViews: ['table', 'kanban'],   // Available view modes
  defaultView: 'table',

  childEntities: ['task', 'wiki']        // Child entity types (from d_entity_map)
}
```

### Icons (Lucide React)

**STRICT ENTITY ICONS - These are the ONLY approved icons from entityConfig.ts:**

**Core Entity Icons (MUST use these exact icons):**
```tsx
import {
  // Core Entities (from /apps/web/src/lib/entityConfig.ts)
  FolderOpen,    // project: Project entity icon
  CheckSquare,   // task: Task entity icon
  Building2,     // biz: Business entity icon
  MapPin,        // office: Office entity icon
  Users,         // employee: Employee entity icon
  Building,      // client: Client entity icon
  BookOpen,      // wiki: Wiki page entity icon
  FileText,      // form, artifact: Form and Artifact entity icons
  Shield,        // role: Role entity icon
  Briefcase,     // position: Position entity icon

  // Settings/Meta Entity Icons
  KanbanSquare,  // projectStage, taskStage: Stage settings
  ListChecks,    // projectStatus, taskStatus: Status settings
  Crown,         // hrLevel: HR Level settings
  Star,          // positionLevel: Position Level settings
  TrendingUp,    // opportunityFunnelLevel: Opportunity funnel
  Radio,         // acquisitionChannel: Acquisition channel settings
  Award,         // customerTier: Customer tier settings

  // UI Action Icons (approved for buttons/interactions)
  Plus,          // Create action
  Edit2,         // Edit action
  Trash2,        // Delete action
  Save,          // Save action
  X,             // Close/Cancel
  Check,         // Success/Confirm
  AlertCircle,   // Error/Warning
  ArrowLeft,     // Back navigation
  Link2,         // Linkage/relationships
  Search,        // Search action
  Filter,        // Filter action
  Download,      // Export/download
  Upload,        // Import/upload
  RefreshCw,     // Refresh/reload
  Settings,      // Settings/config
  ChevronRight,  // Navigation indicator
  ChevronDown,   // Dropdown indicator
  MoreVertical,  // More options menu
  Eye,           // View/preview
  EyeOff         // Hide/hidden
} from 'lucide-react';
```

**Icon Usage Rules:**
1. ✅ **ALWAYS** use the exact icon specified in `entityConfig.ts` for each entity type
2. ✅ **ALWAYS** use `stroke-[1.5]` for thin, clean lines
3. ❌ **NEVER** change entity icons without updating `entityConfig.ts` first
4. ❌ **NEVER** import icons not listed above - these are the only approved icons
5. ✅ When adding a new entity, choose from the approved list above and add to `entityConfig.ts`

**Icon Size Standards:**
```tsx
// Page headers (entity type indicators)
<IconComponent className="h-5 w-5 text-gray-600 stroke-[1.5]" />

// Buttons (actions)
<IconComponent className="h-4 w-4 mr-2 stroke-[1.5]" />

// Tabs (navigation)
<IconComponent className="h-3.5 w-3.5 stroke-[1.5]" />

// Inline status indicators
<IconComponent className="h-4 w-4 stroke-[1.5]" />
```

**Entity-Icon Mapping (Source of Truth: /apps/web/src/lib/entityConfig.ts):**
| Entity | Icon | Line in entityConfig.ts |
|--------|------|------------------------|
| project | `FolderOpen` | Line 162 |
| task | `CheckSquare` | Line 246 |
| wiki | `BookOpen` | Line 346 |
| artifact | `FileText` | Line 459 |
| form | `FileText` | Line 530 |
| biz (business) | `Building2` | Line 588 |
| office | `MapPin` | Line 691 |
| employee | `Users` | Line 759 |
| role | `Shield` | Line 829 |
| worksite | `MapPin` | Line 874 |
| client | `Building` | Line 919 |
| position | `Briefcase` | Line 1048 |
| projectStage | `KanbanSquare` | Line 1089 |
| projectStatus | `ListChecks` | Line 1129 |
| taskStage | `KanbanSquare` | Line 1168 |
| taskStatus | `ListChecks` | Line 1208 |
| businessLevel | `Building2` | Line 1247 |
| orgLevel | `MapPin` | Line 1286 |
| hrLevel | `Crown` | Line 1325 |
| clientLevel | `Users` | Line 1364 |
| positionLevel | `Star` | Line 1403 |
| opportunityFunnelLevel | `TrendingUp` | Line 1442 |
| industrySector | `Building` | Line 1481 |
| acquisitionChannel | `Radio` | Line 1520 |
| customerTier | `Award` | Line 1559 |

### Before Creating ANY Component

**Ask yourself:**
1. Does a similar component already exist? → Search in `/apps/web/src/components/`
2. Can I reuse `FilteredDataTable` or `DataTable`? → Most lists can
3. Does this follow the entity pattern? → Check `entityConfig.ts`
4. Am I using standard Tailwind classes? → Check examples above
5. Are my API calls matching the DDL schema? → Verify column names

**Search before creating:**
```bash
# Find existing components
find apps/web/src/components -name "*Table*.tsx"
find apps/web/src/components -name "*Form*.tsx"
find apps/web/src/components -name "*Modal*.tsx"

# Check entity config patterns
cat apps/web/src/lib/entityConfig.ts | grep -A 20 "project:"
```

---

**Remember: The tools are there to help you. Use them. They make your life easier.**
