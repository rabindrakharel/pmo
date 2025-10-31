# Settings & Data Labels - Complete Technical Documentation

> **Configuration Engine** - Dynamic dropdown system powering entity fields, workflow management, and runtime entity/datalabel creation
>
> **Last Updated:** 2025-10-31 (v4.0 - Dynamic Datalabel Creation & Auto-Navigation)

**Related Documentation:**
- **[SettingsDataTable](./settings_datatable.md)** - Dedicated table component for settings pages
- **[EntityDataTable](./entity_datatable.md)** - Full-featured table for entity pages
- **[DataTable Overview](./data_table.md)** - Overview of both table components

**New in v4.0:**
- ✅ **Dynamic Datalabel Creation** - Runtime creation of data labels without code changes
- ✅ **Entity-Based Validation** - Only entities from `d_entity` table can have datalabels
- ✅ **Icon Picker Dropdown** - Visual icon selection with search (30+ Lucide icons)
- ✅ **Auto-Navigation** - Automatic redirect to data table after datalabel creation
- ✅ **Empty Metadata Support** - Backend handles newly created datalabels with no items

---

## 📋 Table of Contents

1. [Semantics & Business Context](#1-semantics--business-context)
2. [Architecture & DRY Design Patterns](#2-architecture--dry-design-patterns)
3. [Entity Creation System](#3-entity-creation-system)
4. [Linkage Mapping System](#4-linkage-mapping-system)
5. [Datalabel Creation System](#5-datalabel-creation-system)
6. [Datalabel DataTable Management](#6-datalabel-datatable-management)
7. [Database, API & UI/UX Mapping](#7-database-api--uiux-mapping)
8. [Central Configuration & Middleware](#8-central-configuration--middleware)
9. [User Interaction Flow Examples](#9-user-interaction-flow-examples)
10. [Critical Considerations When Building](#10-critical-considerations-when-building)

---

## 1. Semantics & Business Context

### Business Purpose

**Settings (Data Labels)** serve as the configuration backbone for the PMO platform:

- **Dynamic dropdowns** that business users can modify without code changes
- **Sequential state workflows** for projects, tasks, and sales pipelines
- **Runtime configurability** - Create new data labels on-demand for any entity
- **Entity-driven validation** - Only valid entities from `d_entity` can have datalabels
- **Workflow standardization** ensuring consistent data across all entities
- **Auto-detected inline editing** - Fields with `loadOptionsFromSettings` become editable dropdowns

### Unified Data Label System

**Core Concept**: One table (`app.setting_datalabel`) stores ALL data labels using JSONB metadata arrays.

**Naming Convention**: `dl__{entity}_{labelname}`
- Example: `dl__task_stage`, `dl__product_category`, `dl__employee_employment_type`
- Prefix `dl__` is mandatory and enforced by the system
- Entity code must exist in `d_entity` table

**Data Structure**:
```sql
CREATE TABLE app.setting_datalabel (
    datalabel_name VARCHAR(100) PRIMARY KEY,  -- e.g., "dl__task_stage"
    ui_label VARCHAR(100) NOT NULL,            -- e.g., "Task Stages"
    ui_icon VARCHAR(50),                       -- e.g., "Target"
    metadata JSONB NOT NULL,                   -- Array of label items
    updated_ts TIMESTAMPTZ DEFAULT now()
);
```

**Metadata Format**:
```json
[
  {
    "id": 0,
    "name": "Backlog",
    "descr": "Tasks in backlog, not yet started",
    "parent_id": null,
    "color_code": "gray"
  },
  {
    "id": 1,
    "name": "In Progress",
    "descr": "Tasks actively being worked on",
    "parent_id": 0,
    "color_code": "yellow"
  }
]
```

### Key Business Rules

**Datalabel Creation:**
- Entity must exist in `d_entity` table before creating datalabels
- Datalabel names are auto-generated: `dl__{entity}_{label_name}`
- UI labels are user-friendly display names
- Icons are selected from curated Lucide icon set
- New datalabels start with empty metadata array `[]`

**Sequential States:**
- **Linear progression**: Stages/funnels follow defined workflow sequences
- **Parent-child relationships**: `parent_id` enables graph-like workflow visualization
- **Terminal states**: Some stages (Completed, Cancelled) have no forward transitions

**Runtime Flexibility:**
- Business users can create new datalabels via UI
- No code deployment required
- Immediate availability in dropdowns after creation
- Full CRUD operations on data items via data table

---

## 2. Architecture & DRY Design Patterns

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Settings System Architecture                  │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│   Settings Overview  │  ← Entry Point (/setting/overview)
│    (List View)       │
└──────────┬───────────┘
           │
           ├─→ [+ Create Datalabel] ──→ AddDatalabelModal
           │                                    │
           │                                    ├─→ Fetch entities from d_entity
           │                                    ├─→ Select entity (dropdown)
           │                                    ├─→ Choose icon (visual picker)
           │                                    ├─→ POST /api/v1/setting/category
           │                                    └─→ Navigate to /setting/{camelCase}
           │
           └─→ Click Datalabel ──→ SettingDetailPage
                                       │
                                       ├─→ Fetch items: GET /api/v1/setting?datalabel=dl__*
                                       ├─→ SettingsDataTable
                                       │       │
                                       │       ├─→ Add Row (temp_* ID)
                                       │       ├─→ Inline Edit
                                       │       ├─→ Color Picker
                                       │       ├─→ Drag Reorder
                                       │       └─→ Delete Row
                                       │
                                       └─→ Save: POST/PUT/DELETE /api/v1/setting/dl__*/:id
```

### DRY Design Patterns

#### Pattern 1: Single Source of Truth (SSOT)
**Principle**: All datalabels stored in one unified table.

**Implementation**:
- **Database**: `app.setting_datalabel` (1 table replaces 17+ separate tables)
- **JSONB Metadata**: Flexible schema for any entity's labels
- **No Code Changes**: New datalabels don't require migrations

**Benefits**:
- Eliminates table proliferation
- Centralized management
- Runtime extensibility
- Consistent API patterns

#### Pattern 2: Entity-Driven Validation
**Principle**: Only entities that exist in `d_entity` can have datalabels.

**Implementation**:
```typescript
// Frontend: Fetch valid entities
const response = await fetch('/api/v1/entity/types');
const entities = await response.json();

// Backend: Validate entity exists
const entityExists = await db.execute(sql`
  SELECT code FROM app.d_entity WHERE code = ${entity_code}
`);
```

**Benefits**:
- Prevents orphaned datalabels
- Enforces referential integrity
- Clear entity-label relationships
- Self-documenting system

#### Pattern 3: Auto-Navigation After Creation
**Principle**: Immediate usability - redirect to data table after creation.

**Implementation**:
```typescript
// Create datalabel
const result = await createDatalabel(data);
const datalabelName = result.data.datalabel_name; // "dl__product_category"

// Convert to camelCase for URL
const camelCase = toCamelCase(datalabelName); // "productCategory"

// Navigate immediately
navigate(`/setting/${camelCase}`);
```

**Benefits**:
- Seamless UX - no extra clicks
- Immediate data entry
- Reduced cognitive load
- Workflow continuity

#### Pattern 4: Empty Metadata Graceful Handling
**Principle**: New datalabels with no items should return empty array, not 404.

**Implementation**:
```typescript
// Check existence first
const exists = await db.execute(sql`
  SELECT datalabel_name FROM app.setting_datalabel
  WHERE datalabel_name = ${datalabelName}
`);

if (exists.length === 0) return 404;

// Query metadata (may be empty)
const items = await db.execute(sql`...jsonb_array_elements...`);

// Return empty array if no items (not 404)
return { data: items, datalabel: datalabelName };
```

**Benefits**:
- Consistent API behavior
- Works for new and existing datalabels
- Clear error handling
- Progressive enhancement

#### Pattern 5: Visual Icon Picker (New in v4.0)
**Principle**: Icons are first-class UI elements, not free-text fields.

**Implementation**:
```typescript
// Curated icon list with explicit imports
const AVAILABLE_ICON_NAMES = [
  'Building2', 'MapPin', 'Target', 'Tag', 'Users',
  'Package', 'ShoppingCart', 'TrendingUp', ...
].sort();

// Visual grid picker with search
<IconPicker
  icons={AVAILABLE_ICON_NAMES}
  onSelect={icon => setFormData({ ...formData, ui_icon: icon })}
  searchable
/>
```

**Benefits**:
- Prevents typos
- Visual selection
- Consistent icon set
- Searchable interface

#### Pattern 6: Prefix-Preserving API Calls
**Principle**: Keep `dl__` prefix throughout the entire stack.

**Implementation**:
```typescript
// Frontend: URL uses camelCase (user-friendly)
navigate('/setting/productCategory');

// Frontend: API calls use dl__ prefix (database format)
fetch('/api/v1/setting?datalabel=dl__product_category');

// Backend: Stores with dl__ prefix
INSERT INTO setting_datalabel (datalabel_name) VALUES ('dl__product_category');
```

**Benefits**:
- Consistent database format
- Clear prefix identification
- URL-friendly routing
- No ambiguity in API calls

---

## 3. Entity Creation System

### Semantics & Business Context

**Purpose**: Manage the master list of entities that can exist in the platform.

**Entity Definition**: An entity is a core business object (Project, Task, Employee, Product, etc.) that:
- Has its own database table (e.g., `d_project`)
- Can have child entities (e.g., Project → Tasks, Wiki, Artifacts)
- Can have data labels (e.g., Task → Task Stages, Task Priorities)
- Appears in navigation and routing

### Architecture & Design Patterns

**Component**: `SettingsOverviewPage.tsx` → Entity Management Section

**Block Diagram**:
```
┌─────────────────────────────┐
│   Entity Management UI      │
│   (Settings Overview)       │
└──────────┬──────────────────┘
           │
           ├─→ Fetch: GET /api/v1/entity/types
           │        └─→ Returns: [{code, name, ui_label, ui_icon, ...}]
           │
           ├─→ Display: Entity cards with icons
           │
           └─→ [Not Yet Implemented: Create/Edit Entity Modal]
                  └─→ Future: POST /api/v1/entity
```

**DRY Principles**:
- Entities are fetched from `d_entity` table (single source of truth)
- Entity list is used for datalabel creation validation
- Centralized icon mapping via `iconMapping.ts`

### Database, API & UI/UX Mapping

**Database Table**: `app.d_entity`
```sql
CREATE TABLE app.d_entity (
    id UUID PRIMARY KEY,
    code VARCHAR(50) UNIQUE,      -- e.g., "task", "project", "product"
    name VARCHAR(100),             -- e.g., "Task"
    ui_label VARCHAR(100),         -- e.g., "Tasks" (plural)
    ui_icon VARCHAR(50),           -- e.g., "CheckSquare"
    child_entities JSONB,          -- Array of child entity configs
    display_order INTEGER,
    active_flag BOOLEAN DEFAULT true
);
```

**API Endpoint**: `GET /api/v1/entity/types`
```typescript
// apps/api/src/modules/entity/routes.ts
fastify.get('/api/v1/entity/types', async (request, reply) => {
  const result = await db.execute(sql`
    SELECT code, name, ui_label, ui_icon, display_order, active_flag, child_entities
    FROM app.d_entity
    WHERE active_flag = true
    ORDER BY display_order
  `);
  return result;
});
```

**Frontend Component**: `SettingsOverviewPage.tsx:179-198`
```typescript
const fetchEntities = async () => {
  const token = localStorage.getItem('auth_token');
  const response = await fetch('http://localhost:4000/api/v1/entity/types', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await response.json();
  setEntities(data);
};
```

### User Interaction Flow Examples

**Flow 1: View Entities**
```
1. Navigate to /setting/overview
2. Page loads entity cards
3. Each card shows: Icon + UI Label + Entity Code
4. Cards are grouped by type (Core Entities, Product/Operations)
```

**Flow 2: Entity as Datalabel Validation** (Current Implementation)
```
1. Click "+ Create Datalabel"
2. Modal fetches entities from d_entity
3. Dropdown shows only valid entities
4. User cannot create datalabel for non-existent entity
```

### Critical Considerations When Building

**For Developers Extending Entity Management**:

1. **Adding New Entities**:
   ```sql
   -- Must insert into d_entity first
   INSERT INTO app.d_entity (code, name, ui_label, ui_icon, display_order)
   VALUES ('invoice', 'Invoice', 'Invoices', 'Receipt', 50);
   ```

2. **Icon Registration** (CRITICAL):
   ```typescript
   // 1. Add to apps/web/src/lib/iconMapping.ts
   import { Receipt } from 'lucide-react';

   export const iconMap: Record<string, LucideIcon> = {
     ...
     Receipt: Receipt,
   };

   // 2. Add to AVAILABLE_ICON_NAMES in AddDatalabelModal.tsx
   const AVAILABLE_ICON_NAMES = [
     ...,
     'Receipt',
   ].sort();
   ```

3. **Entity Code Constraints**:
   - Must be lowercase
   - No spaces (use underscores)
   - Unique across platform
   - Matches database table prefix (e.g., `product` → `d_product`)

4. **Child Entity Relationships**:
   ```json
   // child_entities JSONB format
   [
     {"entity": "task", "ui_icon": "CheckSquare", "ui_label": "Tasks", "order": 1},
     {"entity": "wiki", "ui_icon": "BookOpen", "ui_label": "Wiki", "order": 2}
   ]
   ```

---

## 4. Linkage Mapping System

### Semantics & Business Context

**Purpose**: Define parent-child relationships between entities for navigation and data organization.

**Business Value**:
- Projects contain Tasks, Wiki, Artifacts
- Businesses contain Offices, Employees
- Forms contain Submissions
- Clear data hierarchy visualization

### Architecture & Design Patterns

**Component**: `EntityLinkagePage.tsx` (Modal-based editor)

**Block Diagram**:
```
┌─────────────────────────────┐
│   Entity Linkage Editor     │
│   (Modal Interface)         │
└──────────┬──────────────────┘
           │
           ├─→ Select Parent Entity
           │        └─→ Dropdown: All entities from d_entity
           │
           ├─→ Add Child Entities
           │        ├─→ Searchable dropdown
           │        ├─→ Select icon for child
           │        ├─→ Set display order
           │        └─→ Remove child
           │
           └─→ Save: PUT /api/v1/entity/:id
                  └─→ Updates child_entities JSONB
```

**DRY Principle**: Child relationships stored in parent entity's `child_entities` JSONB field.

### Database, API & UI/UX Mapping

**Database Storage**: `app.d_entity.child_entities`
```json
// Example: Project entity
{
  "code": "project",
  "child_entities": [
    {"entity": "task", "ui_icon": "CheckSquare", "ui_label": "Tasks", "order": 1},
    {"entity": "artifact", "ui_icon": "FileText", "ui_label": "Artifacts", "order": 2},
    {"entity": "wiki", "ui_icon": "BookOpen", "ui_label": "Wiki", "order": 3}
  ]
}
```

**API Endpoints**:
```typescript
// Get entity with children
GET /api/v1/entity/type/:entity_type
// Response: { code, name, child_entities, ... }

// Update entity children
PUT /api/v1/entity/:id
// Body: { child_entities: [...] }
```

**Frontend Usage** (`DynamicChildEntityTabs.tsx`):
```typescript
// Fetch parent entity metadata
const response = await fetch(`/api/v1/entity/type/${parentEntityType}`);
const entity = await response.json();

// Render tabs for each child
entity.child_entities.map(child => (
  <Tab label={child.ui_label} icon={child.ui_icon} />
));
```

### User Interaction Flow Examples

**Flow: Configure Project Child Entities**
```
1. Navigate to Entity Linkage page
2. Select "Project" from parent dropdown
3. Add child entities:
   - Click "Add Child Entity"
   - Select "Task" from dropdown
   - Choose icon "CheckSquare"
   - Set order: 1
4. Add more children (Wiki, Artifacts, Forms)
5. Drag to reorder
6. Click "Save"
7. Result: Project detail pages now show child entity tabs
```

### Critical Considerations When Building

**For Developers Extending Linkage System**:

1. **Valid Child Entities**:
   - Child must exist in `d_entity` table
   - Cannot create circular references (Project → Task → Project)
   - Order determines tab sequence in detail pages

2. **JSONB Structure is Contract**:
   ```typescript
   interface ChildEntity {
     entity: string;      // Entity code (must exist in d_entity)
     ui_icon: string;     // Lucide icon name
     ui_label: string;    // Display name for tab
     order: number;       // Tab order (1-based)
   }
   ```

3. **Icon Consistency**:
   - Child entity icon should match entity's default icon
   - Use `getIconComponent(child.ui_icon)` for rendering

4. **Cascading Updates**:
   - Changing entity code requires updating all parent entities' `child_entities`
   - Deleting entity requires removing from all `child_entities` arrays

---

## 5. Datalabel Creation System

### Semantics & Business Context

**Purpose**: Enable runtime creation of data labels (dropdowns) for any valid entity without code deployment.

**Business Scenarios**:
- HR needs "Employment Types" for Employee entity → Create `dl__employee_employment_type`
- Sales needs "Lead Sources" for Client entity → Create `dl__client_lead_source`
- Operations needs "Stock Status" for Inventory → Create `dl__inventory_stock_status`

**Key Innovation**: Business users can extend the system without developer intervention.

### Architecture & Design Patterns

**Component**: `AddDatalabelModal.tsx`

**Block Diagram**:
```
┌───────────────────────────────────────────────────────────────┐
│              AddDatalabelModal Architecture                    │
└───────────────────────────────────────────────────────────────┘

[Open Modal]
     │
     ├─→ useEffect: Fetch entities
     │        └─→ GET /api/v1/entity/types
     │
     ├─→ Entity Dropdown (with icons & labels)
     │        └─→ Selection: entity_code
     │
     ├─→ Label Name Input (auto snake_case)
     │        └─→ Input: "employment_type" → "employment_type"
     │
     ├─→ UI Label Input
     │        └─→ Input: "Employment Types"
     │
     ├─→ Icon Picker (Visual Grid)
     │        ├─→ Search: Filter icons
     │        ├─→ Grid: 8 columns, scrollable
     │        └─→ Selection: "Users"
     │
     └─→ [Create Datalabel]
              │
              ├─→ POST /api/v1/setting/category
              │        Body: {
              │          entity_code: "employee",
              │          label_name: "employment_type",
              │          ui_label: "Employment Types",
              │          ui_icon: "Users"
              │        }
              │
              ├─→ Backend creates: dl__employee_employment_type
              │
              ├─→ Response: { data: { datalabel_name: "dl__employee_employment_type" } }
              │
              └─→ Auto-Navigate: /setting/employeeEmploymentType
                       └─→ SettingDetailPage loads with empty data table
```

**DRY Patterns Applied**:

1. **Entity Validation**: Only fetch valid entities from `d_entity`
2. **Auto-Prefixing**: Backend automatically adds `dl__` prefix
3. **Icon Registry**: Curated list prevents invalid icons
4. **URL Conversion**: `toCamelCase()` for routing

### Database, API & UI/UX Mapping

**API Endpoint**: `POST /api/v1/setting/category`
```typescript
// apps/api/src/modules/setting/routes.ts:121-177
fastify.post('/api/v1/setting/category', async (request, reply) => {
  const { entity_code, label_name, ui_label, ui_icon } = request.body;

  // Construct datalabel_name: dl__{entity}_{label}
  const datalabelName = `dl__${entity_code}_${label_name}`;

  // Check if exists
  const existing = await db.execute(sql`
    SELECT datalabel_name FROM app.setting_datalabel
    WHERE datalabel_name = ${datalabelName}
  `);

  if (existing.length > 0) {
    return reply.status(400).send({ error: `Datalabel already exists` });
  }

  // Create with empty metadata
  await db.execute(sql`
    INSERT INTO app.setting_datalabel (datalabel_name, ui_label, ui_icon, metadata)
    VALUES (${datalabelName}, ${ui_label}, ${ui_icon || null}, '[]'::jsonb)
  `);

  return { success: true, data: { datalabel_name: datalabelName } };
});
```

**Frontend Component**: `AddDatalabelModal.tsx`

**Key Features**:
1. **Entity Dropdown** (lines 171-235):
   ```typescript
   <div className="relative entity-dropdown-container">
     <button onClick={() => setShowEntityDropdown(!showEntityDropdown)}>
       {selectedEntity ? (
         <>
           {<Icon />}
           <span>{selectedEntity.ui_label}</span>
           <span>({selectedEntity.code})</span>
         </>
       ) : (
         'Select an entity type...'
       )}
     </button>
     {showEntityDropdown && (
       <div className="dropdown">
         {entities.map(entity => (
           <button onClick={() => setFormData({ ...formData, entity_code: entity.code })}>
             {<Icon />} {entity.ui_label} ({entity.code})
           </button>
         ))}
       </div>
     )}
   </div>
   ```

2. **Icon Picker** (lines 311-392):
   ```typescript
   <div className="relative icon-picker-container">
     <button onClick={() => setShowIconPicker(!showIconPicker)}>
       {<SelectedIcon />} {formData.ui_icon || 'Tag'}
     </button>
     {showIconPicker && (
       <div>
         <input
           type="text"
           value={iconSearchQuery}
           onChange={e => setIconSearchQuery(e.target.value)}
           placeholder="Search icons..."
         />
         <div className="grid grid-cols-8">
           {AVAILABLE_ICON_NAMES
             .filter(name => name.toLowerCase().includes(iconSearchQuery.toLowerCase()))
             .map(iconName => (
               <button onClick={() => setFormData({ ...formData, ui_icon: iconName })}>
                 {<Icon />}
               </button>
             ))}
         </div>
       </div>
     )}
   </div>
   ```

3. **Auto-Navigation** (SettingsOverviewPage.tsx:200-231):
   ```typescript
   const handleAddDatalabel = async (data) => {
     const response = await fetch('/api/v1/setting/category', {
       method: 'POST',
       body: JSON.stringify(data)
     });

     const result = await response.json();
     const createdDatalabelName = result.data.datalabel_name; // "dl__product_category"

     // Convert to camelCase for URL
     const camelCaseName = toCamelCase(createdDatalabelName); // "productCategory"

     // Navigate immediately
     navigate(`/setting/${camelCaseName}`);
   };
   ```

### User Interaction Flow Examples

**Flow: Create "Product Category" Datalabel**
```
Step 1: Navigate to Settings Overview
  → Click "+ Create Datalabel" button

Step 2: Modal Opens - Entity Selection
  → Dropdown shows: [Office, Business, Project, Task, Product, ...]
  → Click "Product" (shows icon + "Products (product)")

Step 3: Enter Label Details
  → Label Name: "category" (auto-converts to snake_case)
  → Display Label: "Product Categories"

Step 4: Choose Icon
  → Click icon picker button
  → Search: "pack" → filters to "Package"
  → Click "Package" icon

Step 5: Create
  → Click "Create Datalabel"
  → API creates: dl__product_category
  → Auto-navigate to: /setting/productCategory

Step 6: Data Table Loads
  → Empty table with "Add Row" button
  → Ready for data entry (Electronics, Furniture, etc.)
```

**Flow: Create "Employee Employment Type" Datalabel**
```
1. Click "+ Create Datalabel"
2. Select Entity: "Employee" (employee)
3. Label Name: "employment_type"
4. Display Label: "Employment Types"
5. Icon: "Users"
6. Click "Create Datalabel"
   → Creates: dl__employee_employment_type
   → Navigates to: /setting/employeeEmploymentType
7. Add data items: Full-time, Part-time, Contract, Intern
```

### Critical Considerations When Building

**For Developers Extending Datalabel Creation**:

1. **Icon Registration (MANDATORY)**:
   ```typescript
   // Step 1: Add to apps/web/src/lib/iconMapping.ts
   import { YourIcon } from 'lucide-react';

   export const iconMap: Record<string, LucideIcon> = {
     ...existing,
     YourIcon: YourIcon,  // Explicit named import
   };

   // Step 2: Add to AVAILABLE_ICON_NAMES in AddDatalabelModal.tsx:6-13
   const AVAILABLE_ICON_NAMES = [
     ...existing,
     'YourIcon',
   ].sort();
   ```

2. **Naming Constraints**:
   - `entity_code`: Must exist in `d_entity.code`
   - `label_name`: Lowercase, underscores only, no spaces
   - `datalabel_name`: Auto-generated as `dl__{entity}_{label}`
   - Uniqueness enforced at database level

3. **Empty Metadata Handling**:
   ```typescript
   // Backend must handle empty metadata array gracefully
   // Check existence before querying metadata
   const exists = await db.execute(sql`
     SELECT datalabel_name FROM app.setting_datalabel
     WHERE datalabel_name = ${datalabelName}
   `);

   if (exists.length === 0) return 404;

   // Query metadata (may return 0 rows)
   const items = await db.execute(sql`...jsonb_array_elements...`);

   // Return empty array, NOT 404
   return { data: items, datalabel: datalabelName };
   ```

4. **URL Routing**:
   ```typescript
   // Frontend URL: /setting/productCategory (camelCase)
   // API calls: /api/v1/setting?datalabel=dl__product_category (with prefix)
   // Database: dl__product_category (with prefix)

   // Conversion function
   function toCamelCase(datalabelName: string): string {
     const withoutPrefix = datalabelName.replace(/^dl__/, '');
     const parts = withoutPrefix.split('_');
     return parts[0] + parts.slice(1).map(p =>
       p.charAt(0).toUpperCase() + p.slice(1)
     ).join('');
   }
   ```

5. **Icon Picker State Management**:
   ```typescript
   // Close dropdown when clicking outside
   useEffect(() => {
     const handleClickOutside = (event: MouseEvent) => {
       if (!event.target.closest('.icon-picker-container')) {
         setShowIconPicker(false);
         setIconSearchQuery('');
       }
     };
     document.addEventListener('mousedown', handleClickOutside);
     return () => document.removeEventListener('mousedown', handleClickOutside);
   }, [showIconPicker]);
   ```

---

## 6. Datalabel DataTable Management

### Semantics & Business Context

**Purpose**: Visual editor for managing data label items (the actual dropdown values).

**Business Operations**:
- Add new status values (In Progress, Completed, Blocked)
- Edit descriptions and colors
- Reorder items via drag-and-drop
- Delete obsolete values
- Set parent-child relationships for hierarchies

**Real-Time Impact**: Changes immediately reflect in all entity dropdowns.

### Architecture & Design Patterns

**Component**: `SettingDetailPage.tsx` → `SettingsDataTable.tsx`

**Block Diagram**:
```
┌───────────────────────────────────────────────────────────────┐
│              SettingDetailPage Architecture                    │
└───────────────────────────────────────────────────────────────┘

[Navigate to /setting/productCategory]
     │
     ├─→ URL Param: category = "productCategory"
     │
     ├─→ useEffect: Load Config
     │        │
     │        ├─→ Fetch all categories: GET /api/v1/setting/categories
     │        │        └─→ Find matching datalabel by camelCase conversion
     │        │
     │        └─→ Set config: {
     │                 datalabel: "dl__product_category",  // WITH prefix
     │                 title: "Product Categories",
     │                 icon: "Package"
     │            }
     │
     ├─→ useEffect: Load Data
     │        └─→ GET /api/v1/setting?datalabel=dl__product_category
     │                 └─→ Response: { data: [...], datalabel: "dl__product_category" }
     │
     └─→ Render: SettingsDataTable
              │
              ├─→ Add Row (temp_* ID for new items)
              ├─→ Inline Edit (click cell → dropdown/input)
              ├─→ Color Picker (visual color selection)
              ├─→ Drag Reorder (changes position in metadata array)
              └─→ Delete Row (removes from metadata)
                   │
                   └─→ Save Operations:
                        ├─→ POST /api/v1/setting/dl__*/  (create)
                        ├─→ PUT /api/v1/setting/dl__*/:id (update)
                        ├─→ DELETE /api/v1/setting/dl__*/:id (delete)
                        └─→ PUT /api/v1/setting/dl__*/reorder (reorder)
```

**DRY Patterns**:

1. **Prefix Preservation**: Keeps `dl__` throughout API calls
2. **Temporary IDs**: New rows use `temp_{timestamp}` until saved
3. **Optimistic Updates**: UI updates immediately, then syncs with server
4. **Metadata Refresh**: After mutations, refetch to get server truth

### Database, API & UI/UX Mapping

**API Endpoints**:

1. **Fetch Items**: `GET /api/v1/setting?datalabel=dl__*`
   ```typescript
   // Response
   {
     "data": [
       {
         "id": "0",
         "name": "Electronics",
         "descr": "Electronic products",
         "parent_id": null,
         "color_code": "blue",
         "position": 0
       }
     ],
     "datalabel": "dl__product_category"
   }
   ```

2. **Create Item**: `POST /api/v1/setting/:datalabel`
   ```typescript
   // Request
   POST /api/v1/setting/dl__product_category
   {
     "name": "Furniture",
     "descr": "Furniture and fixtures",
     "color_code": "green"
   }

   // Response
   {
     "success": true,
     "data": {
       "id": "1",
       "name": "Furniture",
       "descr": "Furniture and fixtures",
       "parent_id": null,
       "color_code": "green",
       "position": 1
     }
   }
   ```

3. **Update Item**: `PUT /api/v1/setting/:datalabel/:id`
   ```typescript
   PUT /api/v1/setting/dl__product_category/0
   {
     "name": "Electronics & Gadgets",
     "color_code": "cyan"
   }
   ```

4. **Delete Item**: `DELETE /api/v1/setting/:datalabel/:id`
   ```typescript
   DELETE /api/v1/setting/dl__product_category/0
   // Reassigns IDs: ID 1 becomes 0, ID 2 becomes 1, etc.
   ```

5. **Reorder Items**: `PUT /api/v1/setting/:datalabel/reorder`
   ```typescript
   PUT /api/v1/setting/dl__product_category/reorder
   {
     "order": [
       {"id": 2, "position": 0},
       {"id": 0, "position": 1},
       {"id": 1, "position": 2}
     ]
   }
   // Reassigns IDs to match new positions
   ```

**Frontend Components**:

1. **SettingDetailPage** (apps/web/src/pages/setting/SettingDetailPage.tsx):
   - URL routing handler
   - Config loader (maps camelCase → `dl__` format)
   - Data fetcher
   - CRUD operation handlers

2. **SettingsDataTable** (apps/web/src/components/shared/ui/SettingsDataTable.tsx):
   - Fixed 5-column schema: id, name, descr, parent_id, color_code
   - Inline editing for all fields
   - Color picker dropdown
   - Drag-and-drop reordering
   - Add row button (prominent at bottom)

### User Interaction Flow Examples

**Flow 1: Add New Item to Product Category**
```
1. Navigate to /setting/productCategory
2. Table shows existing items: Electronics, Furniture
3. Click "Add Row" button at bottom
4. New row appears with temp_1730000000000 ID
5. Enter data:
   - Name: "Appliances"
   - Description: "Home and kitchen appliances"
   - Color: Select "yellow" from color picker
6. Click "Save" button (checkmark icon)
7. API: POST /api/v1/setting/dl__product_category
8. Table refreshes with server data
9. New item now has ID "2" (assigned by server)
```

**Flow 2: Reorder Items via Drag-and-Drop**
```
1. Table shows: [0: Electronics, 1: Furniture, 2: Appliances]
2. Drag "Appliances" to top position
3. Table optimistically updates: [Appliances, Electronics, Furniture]
4. API: PUT /api/v1/setting/dl__product_category/reorder
5. Backend reassigns IDs to match positions
6. Table refreshes: [0: Appliances, 1: Electronics, 2: Furniture]
```

**Flow 3: Edit Existing Item Inline**
```
1. Click "Electronics" name cell
2. Cell becomes editable input
3. Change to "Electronics & Gadgets"
4. Press Enter or click checkmark
5. API: PUT /api/v1/setting/dl__product_category/0
6. Table updates with new name
```

**Flow 4: Delete Item**
```
1. Click trash icon on "Furniture" row
2. Confirmation prompt (optional)
3. API: DELETE /api/v1/setting/dl__product_category/1
4. Backend removes item from metadata array
5. Backend reassigns IDs: Appliances (ID 2) → ID 1
6. Table refreshes with updated data
```

**Flow 5: Change Item Color**
```
1. Click color badge on "Electronics" row
2. Color picker dropdown appears
3. Select "cyan"
4. API: PUT /api/v1/setting/dl__product_category/0
      Body: { "color_code": "cyan" }
5. Badge updates to cyan color
6. All entity fields using this datalabel now show cyan badges
```

### Critical Considerations When Building

**For Developers Extending DataTable Functionality**:

1. **ID Reassignment After Mutations**:
   ```typescript
   // CRITICAL: IDs are position-based (0-indexed array)
   // After delete/reorder, ALWAYS refetch from server

   const handleDeleteRow = async (id: string | number) => {
     await deleteSettingItem(config.datalabel, id);

     // MUST refetch - IDs have changed
     const items = await fetchSettingItems(config.datalabel);
     setData(items);
   };
   ```

2. **Temporary ID Pattern**:
   ```typescript
   // New rows use temp_* ID until saved
   const handleAddRow = (newRow: SettingsRecord) => {
     const tempId = `temp_${Date.now()}`;
     setData([...data, { ...newRow, id: tempId }]);
   };

   // On save, check for temp ID
   const handleRowUpdate = async (id, updates) => {
     if (id.toString().startsWith('temp_')) {
       // Create new item
       await createSettingItem(datalabel, updates);
     } else {
       // Update existing
       await updateSettingItem(datalabel, id, updates);
     }
     // Refetch to get server-assigned IDs
     const items = await fetchSettingItems(datalabel);
     setData(items);
   };
   ```

3. **Prefix Handling**:
   ```typescript
   // URL: /setting/productCategory (camelCase, no prefix)
   // Config: { datalabel: "dl__product_category" } (WITH prefix)
   // API: GET /api/v1/setting?datalabel=dl__product_category (WITH prefix)

   // Conversion logic in SettingDetailPage.tsx:73-93
   const found = categories.find((cat: any) => {
     const camelCaseName = datalabelToCamelCase(cat.datalabel_name);
     return camelCaseName === category; // URL param
   });

   const datalabel = found.datalabel_name; // Keep WITH dl__ prefix
   ```

4. **Empty Metadata Edge Case**:
   ```typescript
   // Newly created datalabels have metadata = []
   // Backend must return empty array, NOT 404

   // Backend (routes.ts:55-87)
   const checkExists = await db.execute(sql`
     SELECT datalabel_name FROM app.setting_datalabel
     WHERE datalabel_name = ${datalabelName}
   `);

   if (checkExists.length === 0) return 404; // Datalabel doesn't exist

   const items = await db.execute(sql`...jsonb_array_elements...`);

   return { data: items, datalabel: datalabelName }; // items may be []
   ```

5. **Reorder Algorithm**:
   ```typescript
   // Backend assigns ID = position in metadata array
   // Drag item from position 2 to 0 → ID changes from 2 to 0

   // Backend (routes.ts:414-490)
   const reorderedMetadata = order
     .sort((a, b) => a.position - b.position)
     .map(orderItem => itemMap.get(String(orderItem.id)))
     .filter(Boolean);

   // Reassign IDs to match positions
   reorderedMetadata.forEach((item, index) => {
     item.id = index; // Critical: ID = array position
   });
   ```

6. **Color Options Registry**:
   ```typescript
   // Available colors defined in apps/web/src/lib/settingsConfig.ts:141-154
   export const COLOR_OPTIONS: ColoredDropdownOption[] = [
     { value: 'gray', label: 'Gray', colorClass: 'bg-gray-100 text-gray-800' },
     { value: 'blue', label: 'Blue', colorClass: 'bg-blue-100 text-blue-800' },
     { value: 'green', label: 'Green', colorClass: 'bg-green-100 text-green-800' },
     // ... 10 total colors
   ];

   // Add new colors here if needed
   // Must have matching Tailwind classes
   ```

---

## 7. Database, API & UI/UX Mapping

### Unified Settings Table Schema

**Database Table**: `app.setting_datalabel`
```sql
CREATE TABLE app.setting_datalabel (
    datalabel_name VARCHAR(100) PRIMARY KEY,  -- e.g., "dl__task_stage"
    ui_label VARCHAR(100) NOT NULL,            -- e.g., "Task Stages"
    ui_icon VARCHAR(50),                       -- Lucide icon name
    metadata JSONB NOT NULL,                   -- Array of items
    updated_ts TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_setting_datalabel_metadata
ON app.setting_datalabel USING GIN (metadata);
```

**Metadata Schema (JSONB)**:
```typescript
interface SettingItem {
  id: number;           // Position in array (0-indexed)
  name: string;         // Display value
  descr: string;        // Description
  parent_id: number | null;  // For hierarchies
  color_code: string;   // Badge color (gray, blue, green, etc.)
}
```

**Example Data**:
```json
{
  "datalabel_name": "dl__task_stage",
  "ui_label": "Task Stages",
  "ui_icon": "Target",
  "metadata": [
    {
      "id": 0,
      "name": "Backlog",
      "descr": "Tasks in backlog, not yet started",
      "parent_id": null,
      "color_code": "gray"
    },
    {
      "id": 1,
      "name": "In Progress",
      "descr": "Tasks actively being worked on",
      "parent_id": 0,
      "color_code": "yellow"
    },
    {
      "id": 2,
      "name": "Completed",
      "descr": "Tasks completed successfully",
      "parent_id": 1,
      "color_code": "green"
    }
  ]
}
```

### Complete API Specification

**Base URL**: `http://localhost:4000/api/v1/setting`

#### 1. Get Datalabel Items
```http
GET /api/v1/setting?datalabel={datalabel_name}

Query Params:
  - datalabel: string (WITH dl__ prefix, e.g., "dl__task_stage")

Response 200:
{
  "data": [
    {
      "id": "0",
      "name": "Backlog",
      "descr": "Tasks in backlog",
      "parent_id": null,
      "color_code": "gray",
      "position": 0
    }
  ],
  "datalabel": "dl__task_stage"
}

Response 404:
{
  "error": "Datalabel 'dl__task_stage' not found"
}
```

#### 2. Get All Datalabel Categories
```http
GET /api/v1/setting/categories

Response 200:
{
  "data": [
    {
      "datalabel_name": "dl__task_stage",
      "ui_label": "Task Stages",
      "ui_icon": "Target",
      "item_count": 7
    }
  ]
}
```

#### 3. Create Datalabel Category
```http
POST /api/v1/setting/category

Request Body:
{
  "entity_code": "product",
  "label_name": "category",
  "ui_label": "Product Categories",
  "ui_icon": "Package"
}

Response 200:
{
  "success": true,
  "data": {
    "datalabel_name": "dl__product_category",
    "ui_label": "Product Categories",
    "ui_icon": "Package"
  }
}

Response 400:
{
  "error": "Datalabel 'dl__product_category' already exists"
}
```

#### 4. Create Datalabel Item
```http
POST /api/v1/setting/:datalabel

URL Params:
  - datalabel: string (WITH dl__ prefix)

Request Body:
{
  "name": "Electronics",
  "descr": "Electronic products",
  "parent_id": null,
  "color_code": "blue"
}

Response 200:
{
  "success": true,
  "data": {
    "id": "0",
    "name": "Electronics",
    "descr": "Electronic products",
    "parent_id": null,
    "color_code": "blue",
    "position": 0
  }
}
```

#### 5. Update Datalabel Item
```http
PUT /api/v1/setting/:datalabel/:id

URL Params:
  - datalabel: string (WITH dl__ prefix)
  - id: string (item ID)

Request Body:
{
  "color_code": "cyan",
  "name": "Electronics & Gadgets"
}

Response 200:
{
  "success": true,
  "data": {
    "id": "0",
    "name": "Electronics & Gadgets",
    "descr": "Electronic products",
    "parent_id": null,
    "color_code": "cyan"
  }
}
```

#### 6. Delete Datalabel Item
```http
DELETE /api/v1/setting/:datalabel/:id

URL Params:
  - datalabel: string (WITH dl__ prefix)
  - id: string (item ID)

Response 200:
{
  "success": true,
  "message": "Item 0 deleted successfully"
}

Note: IDs are reassigned after deletion (ID = array position)
```

#### 7. Reorder Datalabel Items
```http
PUT /api/v1/setting/:datalabel/reorder

URL Params:
  - datalabel: string (WITH dl__ prefix)

Request Body:
{
  "order": [
    {"id": 2, "position": 0},
    {"id": 0, "position": 1},
    {"id": 1, "position": 2}
  ]
}

Response 200:
{
  "success": true,
  "message": "Items reordered successfully"
}

Note: IDs are reassigned to match positions
```

### UI/UX Component Mapping

**Settings Overview Page** (`/setting/overview`):
```
Component: SettingsOverviewPage.tsx
Features:
  - Entity cards display
  - Datalabel list grouped by entity
  - "+ Create Datalabel" button
  - Navigation to detail pages

API Calls:
  - GET /api/v1/entity/types (load entities)
  - GET /api/v1/setting/categories (load datalabels)
  - POST /api/v1/setting/category (create datalabel)
```

**Settings Detail Page** (`/setting/{camelCaseName}`):
```
Component: SettingDetailPage.tsx → SettingsDataTable.tsx
Features:
  - Data table with inline editing
  - Add row button
  - Color picker dropdown
  - Drag-and-drop reordering
  - Delete row button

API Calls:
  - GET /api/v1/setting?datalabel=dl__* (load items)
  - POST /api/v1/setting/dl__* (create item)
  - PUT /api/v1/setting/dl__*/:id (update item)
  - DELETE /api/v1/setting/dl__*/:id (delete item)
  - PUT /api/v1/setting/dl__*/reorder (reorder items)
```

**Add Datalabel Modal**:
```
Component: AddDatalabelModal.tsx
Features:
  - Entity dropdown (from d_entity)
  - Label name input (auto snake_case)
  - UI label input
  - Icon picker (visual grid with search)

API Calls:
  - GET /api/v1/entity/types (load valid entities)
  - POST /api/v1/setting/category (create datalabel)
```

---

## 8. Central Configuration & Middleware

### Icon Management System

**Centralized Icon Registry**: `apps/web/src/lib/iconMapping.ts`

**Architecture**:
```typescript
import { LucideIcon } from 'lucide-react';
import {
  Building2, MapPin, FolderOpen, UserCheck, FileText,
  BookOpen, CheckSquare, Users, Package, Warehouse,
  ShoppingCart, Truck, Receipt, Briefcase, BarChart,
  DollarSign, TrendingUp, Target, Tag, Bell, GitBranch,
  FileCheck, Award, Megaphone, Building, Wrench,
  Zap, Link, Plug, CheckCircle, AlertCircle
} from 'lucide-react';

// Explicit named imports - REQUIRED for Vite compatibility
export const iconMap: Record<string, LucideIcon> = {
  Building2: Building2,
  MapPin: MapPin,
  FolderOpen: FolderOpen,
  UserCheck: UserCheck,
  FileText: FileText,
  BookOpen: BookOpen,
  CheckSquare: CheckSquare,
  Users: Users,
  Package: Package,
  Warehouse: Warehouse,
  ShoppingCart: ShoppingCart,
  Truck: Truck,
  Receipt: Receipt,
  Briefcase: Briefcase,
  BarChart: BarChart,
  DollarSign: DollarSign,
  TrendingUp: TrendingUp,
  Target: Target,
  Tag: Tag,
  Bell: Bell,
  GitBranch: GitBranch,
  FileCheck: FileCheck,
  Award: Award,
  Megaphone: Megaphone,
  Building: Building,
  Wrench: Wrench,
  Zap: Zap,
  Link: Link,
  Plug: Plug,
  CheckCircle: CheckCircle,
  AlertCircle: AlertCircle,
};

export function getIconComponent(iconName: string): LucideIcon {
  return iconMap[iconName] || Tag; // Fallback to Tag
}
```

**Icon Picker Integration**: `AddDatalabelModal.tsx`
```typescript
// MUST match iconMapping.ts
const AVAILABLE_ICON_NAMES = [
  'Building2', 'MapPin', 'FolderOpen', 'UserCheck', 'FileText',
  'BookOpen', 'CheckSquare', 'Users', 'Package', 'Warehouse',
  'ShoppingCart', 'Truck', 'Receipt', 'Briefcase', 'BarChart',
  'DollarSign', 'TrendingUp', 'Target', 'Tag', 'Bell', 'GitBranch',
  'FileCheck', 'Award', 'Megaphone', 'Building', 'Wrench',
  'Zap', 'Link', 'Plug', 'CheckCircle', 'AlertCircle'
].sort();
```

**Adding New Icons (3-Step Process)**:

1. **Import in `iconMapping.ts`**:
   ```typescript
   import { YourNewIcon } from 'lucide-react';

   export const iconMap: Record<string, LucideIcon> = {
     ...existing,
     YourNewIcon: YourNewIcon,
   };
   ```

2. **Add to `AVAILABLE_ICON_NAMES`** in `AddDatalabelModal.tsx`:
   ```typescript
   const AVAILABLE_ICON_NAMES = [
     ...existing,
     'YourNewIcon',
   ].sort();
   ```

3. **Verify Icon Renders**:
   ```typescript
   const Icon = getIconComponent('YourNewIcon');
   return <Icon className="h-5 w-5" />;
   ```

### Authentication Middleware

**All Settings API Routes Require JWT**:
```typescript
// apps/api/src/modules/setting/routes.ts
export async function settingRoutes(fastify: FastifyInstance) {
  // All routes inherit fastify.authenticate from global hook
  fastify.get('/api/v1/setting', { preHandler: [fastify.authenticate] }, ...);
  fastify.post('/api/v1/setting/category', { preHandler: [fastify.authenticate] }, ...);
  // ...
}
```

**Frontend Token Management**:
```typescript
// All API calls include auth token
const token = localStorage.getItem('auth_token');
const response = await fetch(url, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### Entity Configuration System

**Entity Config for Settings** (`apps/web/src/lib/entityConfig.ts`):
```typescript
// Settings entities use createSettingsEntityConfig()
import { createSettingsEntityConfig } from './settingsConfig';

export const entityConfigs: EntityConfigs = {
  // Example: Task Stage
  taskStage: {
    ...createSettingsEntityConfig(
      SETTINGS_REGISTRY.find(s => s.key === 'taskStage')!
    )
  },
  // Generates:
  // {
  //   name: 'taskStage',
  //   displayName: 'Task Stage',
  //   pluralName: 'Task Stages',
  //   apiEndpoint: '/api/v1/setting?datalabel=dl__task_stage',
  //   columns: [...], // Fixed 5 columns
  //   allowedViews: ['table', 'graph'],
  //   defaultView: 'table'
  // }
};
```

**Settings Registry** (`apps/web/src/lib/settingsConfig.ts:170-184`):
```typescript
export const SETTINGS_REGISTRY: SettingDefinition[] = [
  {
    key: 'taskStage',
    datalabel: 'dl__task_stage',
    displayName: 'Task Stage',
    pluralName: 'Task Stages',
    supportedViews: ['table', 'graph'],
    defaultView: 'table'
  },
  // ... other predefined settings
];
```

**Note**: Newly created datalabels don't need registry entries - they're dynamically loaded from database.

### Routing Configuration

**Settings Routes** (`apps/web/src/App.tsx:243-257`):
```typescript
// Settings overview page
<Route
  path="/setting/overview"
  element={
    <ProtectedRoute>
      <SettingsOverviewPage />
    </ProtectedRoute>
  }
/>

// Dynamic settings detail page (handles ANY datalabel)
<Route
  path="/setting/:category"
  element={
    <ProtectedRoute>
      <SettingDetailPage />
    </ProtectedRoute>
  }
/>
```

**URL Mapping Examples**:
```
/setting/overview → SettingsOverviewPage (list all datalabels)
/setting/taskStage → SettingDetailPage (dl__task_stage)
/setting/productCategory → SettingDetailPage (dl__product_category)
/setting/employeeEmploymentType → SettingDetailPage (dl__employee_employment_type)
```

---

## 9. User Interaction Flow Examples

### Complete Workflow: Create and Populate Datalabel

**Scenario**: HR Manager needs to create "Employment Type" for Employee entity.

**Step-by-Step Flow**:

1. **Navigate to Settings**:
   ```
   User clicks "Settings" in sidebar
   → Navigates to /setting/overview
   → Page loads existing datalabels grouped by entity
   ```

2. **Open Creation Modal**:
   ```
   User clicks "+ Create Datalabel" button (top-right)
   → AddDatalabelModal opens
   → Modal fetches entities: GET /api/v1/entity/types
   → Dropdown populates with valid entities
   ```

3. **Select Entity**:
   ```
   User clicks entity dropdown
   → List shows: Office, Business, Project, Task, Employee, ...
   → User selects "Employee" (employee)
   → Dropdown shows: [Users icon] Employee (employee)
   ```

4. **Enter Label Details**:
   ```
   User types label name: "employment_type"
   → Input auto-converts to snake_case
   → Final value: "employment_type"

   User types display label: "Employment Types"
   → Used for UI display
   ```

5. **Choose Icon**:
   ```
   User clicks icon picker button
   → Grid of 30+ icons appears
   → User types "user" in search box
   → Grid filters to: Users, UserCheck
   → User clicks "Users" icon
   → Button updates to show Users icon
   ```

6. **Create Datalabel**:
   ```
   User clicks "Create Datalabel" button

   Frontend:
   → POST /api/v1/setting/category
      Body: {
        entity_code: "employee",
        label_name: "employment_type",
        ui_label: "Employment Types",
        ui_icon: "Users"
      }

   Backend:
   → Constructs: dl__employee_employment_type
   → Checks uniqueness
   → INSERT INTO setting_datalabel (...) VALUES (..., '[]'::jsonb)
   → Returns: { data: { datalabel_name: "dl__employee_employment_type" } }

   Frontend:
   → Receives response
   → Converts to camelCase: "employeeEmploymentType"
   → Navigates to: /setting/employeeEmploymentType
   ```

7. **Data Table Loads**:
   ```
   SettingDetailPage loads:
   → Fetches categories: GET /api/v1/setting/categories
   → Finds matching datalabel: dl__employee_employment_type
   → Fetches items: GET /api/v1/setting?datalabel=dl__employee_employment_type
   → Response: { data: [], datalabel: "dl__employee_employment_type" }
   → Renders empty SettingsDataTable with "Add Row" button
   ```

8. **Add First Item**:
   ```
   User clicks "Add Row" button
   → New row appears with temp_1730000000000 ID
   → User enters:
      - Name: "Full-time"
      - Description: "Full-time permanent employee"
      - Color: Selects "green" from color picker
   → User clicks Save (checkmark icon)

   Frontend:
   → POST /api/v1/setting/dl__employee_employment_type
      Body: {
        name: "Full-time",
        descr: "Full-time permanent employee",
        color_code: "green"
      }

   Backend:
   → Gets current metadata: []
   → Assigns ID: 0 (array length)
   → Pushes to array: [{ id: 0, name: "Full-time", ... }]
   → Updates database
   → Returns: { success: true, data: { id: "0", ... } }

   Frontend:
   → Refetches items
   → Table shows: [0: Full-time (green badge)]
   ```

9. **Add More Items**:
   ```
   User adds remaining items:
   → Part-time (ID: 1, blue)
   → Contract (ID: 2, yellow)
   → Intern (ID: 3, purple)

   Final metadata array:
   [
     { id: 0, name: "Full-time", descr: "...", color_code: "green" },
     { id: 1, name: "Part-time", descr: "...", color_code: "blue" },
     { id: 2, name: "Contract", descr: "...", color_code: "yellow" },
     { id: 3, name: "Intern", descr: "...", color_code: "purple" }
   ]
   ```

10. **Use in Entity Forms**:
    ```
    Developer adds to Employee entity config:

    // apps/web/src/lib/entityConfig.ts
    employee: {
      columns: [
        {
          key: 'employment_type',
          title: 'Employment Type',
          loadOptionsFromSettings: 'dl__employee_employment_type'
        }
      ]
    }

    Result:
    → Employee forms now show "Employment Type" dropdown
    → Options: Full-time, Part-time, Contract, Intern
    → Badges colored: green, blue, yellow, purple
    → No code deployment needed for data changes
    ```

### Advanced Workflow: Reorder and Edit Items

**Scenario**: Prioritize "Contract" to appear before "Part-time".

**Flow**:
```
1. User navigates to /setting/employeeEmploymentType
2. Table shows: [Full-time, Part-time, Contract, Intern]
3. User drags "Contract" row to position 2
4. Table optimistically updates: [Full-time, Contract, Part-time, Intern]
5. API: PUT /api/v1/setting/dl__employee_employment_type/reorder
        Body: { order: [
          {id: 0, position: 0}, // Full-time stays
          {id: 2, position: 1}, // Contract moves up
          {id: 1, position: 2}, // Part-time moves down
          {id: 3, position: 3}  // Intern stays
        ]}
6. Backend reassigns IDs to match positions:
   → Contract: ID 2 → ID 1
   → Part-time: ID 1 → ID 2
7. Table refetches: [0: Full-time, 1: Contract, 2: Part-time, 3: Intern]
8. All entity dropdowns now show items in new order
```

---

## 10. Critical Considerations When Building

### For Staff Engineers & Solutions Architects

#### 1. Icon Management (MANDATORY)

**Problem**: Vite doesn't support wildcard icon imports (`lucide-react/*`).

**Solution**: Explicit named imports in `iconMapping.ts`.

**Implementation Checklist**:
```typescript
// ✅ Step 1: Import icon in iconMapping.ts
import { YourIcon } from 'lucide-react';

// ✅ Step 2: Add to iconMap
export const iconMap: Record<string, LucideIcon> = {
  ...existing,
  YourIcon: YourIcon,
};

// ✅ Step 3: Add to AVAILABLE_ICON_NAMES in AddDatalabelModal.tsx
const AVAILABLE_ICON_NAMES = [
  ...existing,
  'YourIcon',
].sort();

// ✅ Step 4: Verify rendering
const Icon = getIconComponent('YourIcon');
return <Icon className="h-5 w-5" />;
```

**Failure Modes**:
- ❌ Icon not in `iconMap` → Falls back to Tag icon
- ❌ Icon not in `AVAILABLE_ICON_NAMES` → Not selectable in picker
- ❌ Typo in icon name → Runtime error or fallback

#### 2. Datalabel Naming Conventions

**Enforced Rules**:
```typescript
// ✅ Correct: dl__employee_employment_type
// ❌ Wrong: employee_employment_type (missing dl__)
// ❌ Wrong: dl__employee-employment-type (kebab-case not allowed)
// ❌ Wrong: dl__EmployeeEmploymentType (camelCase not allowed)

// Auto-generated by backend:
const datalabelName = `dl__${entity_code}_${label_name}`;
```

**Entity Code Validation**:
```sql
-- MUST exist in d_entity table
SELECT code FROM app.d_entity WHERE code = 'employee';
-- If not found, reject datalabel creation
```

#### 3. ID Reassignment After Mutations

**CRITICAL CONCEPT**: IDs are position-based, not permanent.

**Implications**:
```typescript
// Before delete: [0: A, 1: B, 2: C]
await deleteSettingItem('dl__test', 1); // Delete B

// After delete: [0: A, 1: C] (C's ID changed from 2 to 1!)

// ALWAYS refetch after mutations
const items = await fetchSettingItems('dl__test');
setData(items);
```

**Never Cache IDs Across Mutations**:
```typescript
// ❌ WRONG: Storing ID and reusing after delete
const itemId = 2;
await deleteItem(1);
await updateItem(itemId, {...}); // ID 2 might not exist now!

// ✅ CORRECT: Refetch after every mutation
await deleteItem(1);
const freshData = await fetchItems();
const item = freshData.find(x => x.name === 'Target');
await updateItem(item.id, {...});
```

#### 4. URL vs API Format

**Routing Layer Abstraction**:
```typescript
// Frontend URL (user-facing, camelCase)
/setting/employeeEmploymentType

// Frontend config (internal, with prefix)
{ datalabel: "dl__employee_employment_type" }

// API calls (database format, with prefix)
GET /api/v1/setting?datalabel=dl__employee_employment_type

// Database storage (with prefix)
INSERT INTO setting_datalabel (datalabel_name)
VALUES ('dl__employee_employment_type');
```

**Conversion Functions**:
```typescript
// URL → datalabel
function urlParamToDatalabel(category: string, categories: any[]): string {
  const found = categories.find(cat =>
    datalabelToCamelCase(cat.datalabel_name) === category
  );
  return found.datalabel_name; // "dl__employee_employment_type"
}

// datalabel → URL
function toCamelCase(datalabel: string): string {
  const withoutPrefix = datalabel.replace(/^dl__/, '');
  const parts = withoutPrefix.split('_');
  return parts[0] + parts.slice(1).map(p =>
    p.charAt(0).toUpperCase() + p.slice(1)
  ).join('');
}
```

#### 5. Empty Metadata Handling

**Backend Must Distinguish**:
```typescript
// Case 1: Datalabel doesn't exist → 404
SELECT datalabel_name FROM setting_datalabel
WHERE datalabel_name = 'dl__nonexistent';
// Result: 0 rows → return 404

// Case 2: Datalabel exists but has no items → 200 with empty array
SELECT * FROM setting_datalabel
WHERE datalabel_name = 'dl__new_label';
// Result: { metadata: [] } → return { data: [], datalabel: "dl__new_label" }

// NEVER return 404 for case 2!
```

**Implementation**:
```typescript
// ✅ Correct implementation (routes.ts:55-87)
const checkExists = await db.execute(sql`
  SELECT datalabel_name FROM app.setting_datalabel
  WHERE datalabel_name = ${datalabelName}
`);

if (checkExists.length === 0) {
  return reply.status(404).send({ error: 'Datalabel not found' });
}

const results = await db.execute(sql`
  SELECT ... FROM setting_datalabel, jsonb_array_elements(metadata) ...
  WHERE datalabel_name = ${datalabelName}
`);

// results may be [] for new datalabels
return { data: results, datalabel: datalabelName };
```

#### 6. Auto-Navigation UX Pattern

**Immediate Usability Principle**:
```typescript
// After creating datalabel, navigate to data table immediately
const handleAddDatalabel = async (data) => {
  const result = await createDatalabel(data);
  const datalabelName = result.data.datalabel_name;
  const camelCase = toCamelCase(datalabelName);

  // Navigate BEFORE closing modal
  navigate(`/setting/${camelCase}`);

  // Modal closes automatically via cleanup
};
```

**Benefits**:
- Zero extra clicks to start using new datalabel
- Clear feedback: "Your datalabel was created and is ready"
- Reduced cognitive load: No need to find datalabel in list

#### 7. Temporary Row Management

**Pattern for Unsaved Rows**:
```typescript
// Add new row with temporary ID
const handleAddRow = () => {
  const tempRow = {
    id: `temp_${Date.now()}`,
    name: '',
    descr: '',
    parent_id: null,
    color_code: 'blue'
  };
  setData([...data, tempRow]);
  setEditingRowId(tempRow.id); // Enter edit mode immediately
};

// Save temporary row
const handleSaveRow = async (id: string, values: any) => {
  if (id.startsWith('temp_')) {
    // Create new item
    const created = await createSettingItem(datalabel, values);
    // Refetch to replace temp ID with server ID
    const items = await fetchSettingItems(datalabel);
    setData(items);
  } else {
    // Update existing item
    await updateSettingItem(datalabel, id, values);
  }
};

// Cancel temporary row
const handleCancel = (id: string) => {
  if (id.startsWith('temp_')) {
    // Remove from UI without API call
    setData(data.filter(row => row.id !== id));
  } else {
    // Revert to original values
    setEditingRowId(null);
  }
};
```

#### 8. Color Badge System Integration

**Auto-Apply Pattern**:
```typescript
// Entity fields with loadOptionsFromSettings automatically get badges
{
  key: 'employment_type',
  title: 'Employment Type',
  loadOptionsFromSettings: 'dl__employee_employment_type'
}

// Renders as:
<Badge color={getColorForValue(value, datalabel)}>
  {value}
</Badge>

// getColorForValue() fetches from settings cache:
const items = await fetchSettingItems('dl__employee_employment_type');
const item = items.find(x => x.name === value);
return item?.color_code || 'gray';
```

#### 9. Metadata Array Position Integrity

**Position = ID Invariant**:
```sql
-- Backend ALWAYS ensures item.id === array_position
UPDATE setting_datalabel
SET metadata = jsonb_set(
  metadata,
  '{0,id}', -- First element's ID
  '0'       -- MUST be 0
);

-- After reorder: [B, A, C]
-- IDs: [0, 1, 2] (NOT [1, 0, 2]!)
```

**Enforcement in Reorder**:
```typescript
// Backend (routes.ts:468-472)
reorderedMetadata.forEach((item: any, index: number) => {
  item.id = index; // Critical: Reassign ID to match position
});
```

#### 10. Testing Checklist for New Datalabels

**Validation Steps**:
```bash
# 1. Create datalabel
curl -X POST http://localhost:4000/api/v1/setting/category \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"entity_code":"test","label_name":"status","ui_label":"Test Status","ui_icon":"Tag"}'

# 2. Verify creation
curl -X GET "http://localhost:4000/api/v1/setting?datalabel=dl__test_status" \
  -H "Authorization: Bearer $TOKEN"
# Expected: { data: [], datalabel: "dl__test_status" }

# 3. Add item
curl -X POST http://localhost:4000/api/v1/setting/dl__test_status \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Active","descr":"Active status","color_code":"green"}'

# 4. Verify item
curl -X GET "http://localhost:4000/api/v1/setting?datalabel=dl__test_status" \
  -H "Authorization: Bearer $TOKEN"
# Expected: { data: [{ id: "0", name: "Active", ... }] }

# 5. Update item
curl -X PUT http://localhost:4000/api/v1/setting/dl__test_status/0 \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"color_code":"blue"}'

# 6. Reorder (add second item first)
curl -X POST http://localhost:4000/api/v1/setting/dl__test_status \
  -d '{"name":"Inactive","descr":"Inactive status","color_code":"gray"}'
curl -X PUT http://localhost:4000/api/v1/setting/dl__test_status/reorder \
  -d '{"order":[{"id":1,"position":0},{"id":0,"position":1}]}'

# 7. Delete item
curl -X DELETE http://localhost:4000/api/v1/setting/dl__test_status/0 \
  -H "Authorization: Bearer $TOKEN"
```

---

## End of Documentation

**Version**: 4.0
**Last Updated**: 2025-10-31
**Maintainer**: Staff Software Engineer
**Status**: Production-Ready

**Change Log**:
- v4.0: Dynamic datalabel creation, icon picker, auto-navigation
- v3.2: Entity registry management, centralized icon system
- v3.1: Child entity relationships, linkage mapping
- v3.0: Unified settings table with JSONB metadata
