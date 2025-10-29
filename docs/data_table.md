# DataTable System Overview

> **Comprehensive guide to the PMO DataTable architecture**
> Understanding both EntityDataTable and SettingsDataTable components with database-driven color and formatting

---

## Overview

The PMO application uses two specialized DataTable components to provide optimized, feature-rich table rendering across all pages:

1. **EntityDataTable** - Full-featured table for entity pages (projects, tasks, clients, etc.)
2. **SettingsDataTable** - Lightweight table for settings/datalabel pages

Both components share a unified **database-driven color and formatting system** where all visual styling comes from the database via API, never hardcoded.

---

## Component Comparison

| Feature | EntityDataTable | SettingsDataTable |
|---------|-----------------|-------------------|
| **Lines of Code** | ~1350 | ~300 |
| **Bundle Size** | 45 KB | 12 KB (73% smaller) |
| **Schema** | Dynamic (any columns) | Fixed (5 columns) |
| **Use Case** | All entity pages | Settings/datalabel pages only |
| **Columns** | Variable, auto-detected | Fixed: id, name, descr, parent_id, color_code |
| **Filtering** | ✅ Advanced dropdown filters | ❌ None (not needed) |
| **Search** | ✅ Full-text search | ❌ None |
| **Sorting** | ✅ Client & server-side | ✅ Simple client-side |
| **Pagination** | ✅ Full pagination | ❌ None (small datasets) |
| **Inline Editing** | ✅ All fields, auto-detected | ✅ color_code only |
| **Settings Integration** | ✅ Auto-loads dropdowns | ✅ Uses COLOR_OPTIONS |
| **Badge Rendering** | ✅ Dynamic, database-driven | ✅ Database-driven |
| **RBAC** | ✅ Permission-based actions | ❌ Not needed |
| **Column Controls** | ✅ Show/hide columns | ❌ Fixed columns |

---

## When to Use Which Component

### Use EntityDataTable For:
✅ All entity pages (projects, tasks, clients, employees, offices, businesses, etc.)
✅ Tables with dynamic, variable schemas
✅ Complex data requiring filters, search, and pagination
✅ Tables with RBAC-controlled actions
✅ Data requiring inline editing with auto-type detection

**File:** `/apps/web/src/components/shared/ui/EntityDataTable.tsx`
**Documentation:** [entity_datatable.md](./entity_datatable.md)

### Use SettingsDataTable For:
✅ All settings/datalabel pages (`/setting/projectStage`, `/setting/taskPriority`, etc.)
✅ Tables with the fixed schema: `id`, `name`, `descr`, `parent_id`, `color_code`
✅ Simple data management with inline color editing
✅ Colored badge rendering for categories

**File:** `/apps/web/src/components/shared/ui/SettingsDataTable.tsx`
**Documentation:** [settings_datatable.md](./settings_datatable.md)

---

## Database-Driven Color & Formatting System

### Architecture Principle: NO HARDCODING

**❌ Wrong Approach:**
```typescript
// NEVER do this - hardcoded colors
const getStageColor = (stage: string) => {
  if (stage === 'Planning') return 'purple';
  if (stage === 'Execution') return 'yellow';
  // ... hardcoded logic
};
```

**✅ Correct Approach:**
```typescript
// Always fetch from database via API
const color = getSettingColor('project_stage', 'Planning');
// → Looks up in database, returns color_code from JSONB metadata
```

### Complete Data Flow (5 Layers)

```
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 1: DATABASE                                                   │
│ Table: app.setting_datalabel                                        │
│ ┌───────────────────┬─────────────┬────────────────────────────┐   │
│ │ datalabel_name    │ ui_label    │ metadata (JSONB)           │   │
│ ├───────────────────┼─────────────┼────────────────────────────┤   │
│ │ project__stage    │ Proj Stages │ [{                         │   │
│ │                   │             │   "id": 1,                 │   │
│ │                   │             │   "name": "Planning",      │   │
│ │                   │             │   "descr": "...",          │   │
│ │                   │             │   "parent_id": 0,          │   │
│ │                   │             │   "color_code": "purple"   │   │
│ │                   │             │ }, ...]                    │   │
│ └───────────────────┴─────────────┴────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 2: BACKEND API                                                │
│ Route: /api/v1/setting?datalabel=project_stage                     │
│ File: /apps/api/src/modules/setting/routes.ts                      │
│                                                                     │
│ SQL Query extracts from JSONB:                                      │
│   SELECT elem->>'color_code' as color_code                         │
│   FROM app.setting_datalabel,                                       │
│        jsonb_array_elements(metadata) as elem                       │
│   WHERE datalabel_name = 'project__stage'                          │
│                                                                     │
│ Response JSON:                                                      │
│ {                                                                   │
│   "data": [                                                         │
│     {                                                               │
│       "id": "1",                                                    │
│       "name": "Planning",                                           │
│       "descr": "Detailed project planning",                         │
│       "parent_id": 0,                                               │
│       "color_code": "purple"  ← From database!                     │
│     },                                                              │
│     ...                                                             │
│   ]                                                                 │
│ }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 3: FRONTEND MIDDLEWARE                                        │
│ File: /apps/web/src/lib/settingsLoader.ts                          │
│                                                                     │
│ loadSettingOptions(datalabel):                                      │
│   1. Fetches from API: /api/v1/setting?datalabel=project_stage    │
│   2. Caches for 5 minutes to reduce API calls                      │
│   3. Transforms to SettingOption[] with metadata                    │
│                                                                     │
│ colorCodeToTailwindClass(colorCode):                                │
│   'purple' → 'bg-purple-100 text-purple-800'                       │
│                                                                     │
│ Returns SettingOption[]:                                            │
│ [                                                                   │
│   {                                                                 │
│     value: 'Planning',                                              │
│     label: 'Planning',                                              │
│     colorClass: 'bg-purple-100 text-purple-800',                   │
│     metadata: {                                                     │
│       color_code: 'purple',  ← Original from DB                    │
│       id: 1,                                                        │
│       descr: '...',                                                 │
│       parent_id: 0                                                  │
│     }                                                               │
│   },                                                                │
│   ...                                                               │
│ ]                                                                   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 4: FRONTEND RENDERING                                         │
│ File: /apps/web/src/lib/data_transform_render.tsx                  │
│                                                                     │
│ COLOR_MAP (Master Tailwind Class Mapping):                          │
│ {                                                                   │
│   'blue': 'bg-blue-100 text-blue-800 border border-blue-200',     │
│   'purple': 'bg-purple-100 text-purple-800 border border-purple-200', │
│   'green': 'bg-green-100 text-green-800 border border-green-200',  │
│   'red': 'bg-red-100 text-red-800 border border-red-200',         │
│   'yellow': 'bg-yellow-100 text-yellow-800 border border-yellow-200', │
│   'orange': 'bg-orange-100 text-orange-800 border border-orange-200', │
│   'gray': 'bg-gray-100 text-gray-800 border border-gray-200',     │
│   'cyan': 'bg-cyan-100 text-cyan-800 border border-cyan-200',     │
│   'pink': 'bg-pink-100 text-pink-800 border border-pink-200',     │
│   'amber': 'bg-amber-100 text-amber-800 border border-amber-200'   │
│ }                                                                   │
│                                                                     │
│ Functions:                                                          │
│   loadSettingsColors(datalabel)                                     │
│     → Preloads colors into cache for performance                    │
│                                                                     │
│   getSettingColor(datalabel, value)                                 │
│     → Retrieves color_code from cache                              │
│     → Example: ('project_stage', 'Planning') → 'purple'            │
│                                                                     │
│   renderSettingBadge(colorCode, label)                              │
│     → Renders <span> with Tailwind classes from COLOR_MAP          │
│                                                                     │
│ Color Cache Structure:                                              │
│   Map<datalabel, Map<value, color_code>>                           │
│                                                                     │
│   Example:                                                          │
│   {                                                                 │
│     'project_stage': Map {                                          │
│       'Initiation' → 'blue',                                        │
│       'Planning' → 'purple',                                        │
│       'Execution' → 'yellow',                                       │
│       'Monitoring' → 'orange',                                      │
│       'Closure' → 'green'                                           │
│     }                                                               │
│   }                                                                 │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 5: UI RENDERING                                               │
│ Components: EntityDataTable, SettingsDataTable                      │
│                                                                     │
│ EntityDataTable Usage:                                              │
│   render: (value) => renderSettingBadge(value, {                   │
│     datalabel: 'project_stage'                                      │
│   })                                                                │
│   → Looks up color in cache                                         │
│   → 'Planning' → 'purple' → COLOR_MAP → Tailwind classes           │
│                                                                     │
│ SettingsDataTable Usage:                                            │
│   renderColorBadge(record.color_code, record.name)                  │
│   → Direct color_code from record                                   │
│   → 'purple' → COLOR_MAP → Tailwind classes                        │
│                                                                     │
│ Final HTML Output:                                                  │
│   <span class="inline-flex items-center rounded-full font-medium   │
│                bg-purple-100 text-purple-800 border border-purple-200 │
│                px-2.5 py-0.5 text-xs">                              │
│     Planning                                                        │
│   </span>                                                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Color Flow in Action: Step-by-Step Example

### Scenario: Rendering Project Stage Badge

**Step 1: Database Storage**
```sql
-- setting_datalabel table
datalabel_name: 'project__stage'
metadata: [
  {
    "id": 1,
    "name": "Planning",
    "descr": "Detailed project planning and resource allocation",
    "parent_id": 0,
    "color_code": "purple"
  }
]
```

**Step 2: API Request**
```typescript
// Frontend makes request
GET /api/v1/setting?datalabel=project_stage

// Backend extracts from JSONB
SELECT
  (elem->>'id')::text as id,
  elem->>'name' as name,
  elem->>'descr' as descr,
  elem->>'color_code' as color_code
FROM app.setting_datalabel,
     jsonb_array_elements(metadata) as elem
WHERE datalabel_name = 'project__stage'

// Returns JSON
{
  "data": [
    { "id": "1", "name": "Planning", "color_code": "purple" }
  ]
}
```

**Step 3: Frontend Middleware**
```typescript
// settingsLoader.ts
const options = await loadSettingOptions('project_stage');

// Transforms API response
[
  {
    value: 'Planning',
    label: 'Planning',
    colorClass: 'bg-purple-100 text-purple-800',  // Converted!
    metadata: { color_code: 'purple' }
  }
]

// Caches for 5 minutes
settingsCache.set('project_stage', { data: options, timestamp: now() });
```

**Step 4: Color Loading & Caching**
```typescript
// data_transform_render.tsx
await loadSettingsColors('project_stage');

// Builds color map
settingsColorCache.set('project_stage', new Map([
  ['Initiation', 'blue'],
  ['Planning', 'purple'],
  ['Execution', 'yellow']
]));
```

**Step 5: Badge Rendering**
```typescript
// In EntityDataTable
render: (value) => renderSettingBadge(value, { datalabel: 'project_stage' })

// renderSettingBadge internal flow:
1. value = 'Planning'
2. datalabel = 'project_stage'
3. colorCode = getSettingColor('project_stage', 'Planning')  // → 'purple'
4. colorClass = COLOR_MAP['purple']  // → 'bg-purple-100 text-purple-800 ...'
5. return <span className={colorClass}>Planning</span>
```

**Step 6: Final Output**
```html
<!-- Rendered in browser -->
<span class="inline-flex items-center rounded-full font-medium
             bg-purple-100 text-purple-800 border border-purple-200
             px-2.5 py-0.5 text-xs">
  Planning
</span>
```

---

## Key Files in Color/Formatting System

### Database Layer
```
/db/setting_datalabel.ddl
```
- Defines `app.setting_datalabel` table
- JSONB metadata stores color_code values
- Source of truth for all colors

### Backend API Layer
```
/apps/api/src/modules/setting/routes.ts
```
- GET `/api/v1/setting?datalabel=X` endpoint
- Extracts color_code from JSONB
- Returns JSON with color information

### Frontend Middleware Layer
```
/apps/web/src/lib/settingsLoader.ts
```
- `loadSettingOptions()` - Fetches & caches from API
- `colorCodeToTailwindClass()` - Converts colors to CSS classes
- 5-minute cache to reduce API calls

### Frontend Rendering Layer
```
/apps/web/src/lib/data_transform_render.tsx
```
- `COLOR_MAP` - Master Tailwind class mapping
- `loadSettingsColors()` - Preloads colors into cache
- `getSettingColor()` - Retrieves from cache
- `renderSettingBadge()` - Universal badge renderer

### UI Components
```
/apps/web/src/components/shared/ui/EntityDataTable.tsx
/apps/web/src/components/shared/ui/SettingsDataTable.tsx
```
- EntityDataTable: Uses renderSettingBadge for entity fields
- SettingsDataTable: Uses renderColorBadge for color_code column
- Both rely on same COLOR_MAP and caching system

---

## Color Options Available

All 10 colors stored in database and mapped to Tailwind classes:

| color_code | Tailwind Classes | Use Case |
|------------|------------------|----------|
| `blue` | `bg-blue-100 text-blue-800` | Initiation, Lead, Start states |
| `purple` | `bg-purple-100 text-purple-800` | Planning, Review, Important items |
| `yellow` | `bg-yellow-100 text-yellow-800` | Execution, In Progress, Active work |
| `orange` | `bg-orange-100 text-orange-800` | Monitoring, Warning states |
| `green` | `bg-green-100 text-green-800` | Closure, Done, Success states |
| `red` | `bg-red-100 text-red-800` | Cancelled, High priority, Errors |
| `gray` | `bg-gray-100 text-gray-800` | On Hold, Inactive, Neutral |
| `cyan` | `bg-cyan-100 text-cyan-800` | Information, Secondary items |
| `pink` | `bg-pink-100 text-pink-800` | Special categories |
| `amber` | `bg-amber-100 text-amber-800` | Customer tiers, Alerts |

---

## Performance Optimizations

### 1. API Response Caching (5 minutes)
```typescript
// settingsLoader.ts
const cached = settingsCache.get(datalabel);
if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
  return cached.data;  // Return from cache
}
// Otherwise fetch from API
```

### 2. Color Preloading on Mount
```typescript
// EntityDataTable.tsx
useEffect(() => {
  const datalabels = columns
    .filter(col => col.loadOptionsFromSettings)
    .map(col => extractSettingsDatalabel(col.key));

  // Preload all colors in parallel
  await Promise.all(datalabels.map(dl => loadSettingsColors(dl)));
}, [columns]);
```

### 3. In-Memory Color Cache
```typescript
// data_transform_render.tsx
const settingsColorCache = new Map<string, Map<string, string>>();

// O(1) lookup during rendering
const color = settingsColorCache.get(datalabel)?.get(value);
```

### 4. Memoization
```typescript
// EntityDataTable uses useMemo for expensive operations
const columnCapabilities = useMemo(
  () => detectColumnCapabilities(columns),
  [columns]
);
```

---

## Auto-Detection Conventions

Both components use naming conventions to automatically detect field types:

### Currency Fields
```typescript
// Pattern: *_amt, *_amount, *_cost, *_price, *_revenue, *_budget
budget_allocated_amt  → Auto-formatted as $250,000.00
total_revenue_amt     → Auto-formatted as $45,750.00
unit_price            → Auto-formatted as $125.00
```

### Date Fields
```typescript
// Pattern: *_date, *_ts, date_*
start_date           → Formatted as "Mar 15, 2025"
planned_end_date     → Formatted as "Dec 31, 2025"
created_ts           → Formatted as "Jan 23, 2025 2:30 PM"
```

### Settings Fields
```typescript
// Pattern: *_stage, *_status, *_priority, *_level, *_tier, *_name
project_stage        → Badge with database color
task_priority        → Badge with database color
customer_tier        → Badge with database color
business_level_name  → Badge with database color
```

### Tags Fields
```typescript
// Pattern: tags, *_tags
tags                 → Inline tag editing
project_tags         → Inline tag editing
```

---

## Common Patterns

### Pattern 1: Entity Table with Settings Fields
```tsx
// columns automatically detect settings fields
const columns = [
  { key: 'name', title: 'Project Name' },
  { key: 'project_stage', title: 'Stage' },  // Auto: badge, dropdown, colors
  { key: 'task_priority', title: 'Priority' }  // Auto: badge, dropdown, colors
];

<FilteredDataTable entityType="project" inlineEditable={true} />
```

### Pattern 2: Settings Page
```tsx
// Fixed schema, color editing only
const [data, setData] = useState<SettingsRecord[]>([]);

useEffect(() => {
  fetch('/api/v1/setting?datalabel=project_stage')
    .then(res => res.json())
    .then(result => setData(result.data));
}, []);

<SettingsDataTable data={data} onInlineEdit={handleEdit} />
```

### Pattern 3: Custom Colored Badges
```tsx
// In custom components
import { renderSettingBadge, loadSettingsColors } from '@/lib/data_transform_render';

// Preload colors
useEffect(() => {
  loadSettingsColors('project_stage');
}, []);

// Render badge
{renderSettingBadge('Planning', { datalabel: 'project_stage' })}
// → Purple badge with "Planning"
```

---

## Troubleshooting

### Issue: Colors Show as Gray

**Cause:** Color cache not loaded or API failed

**Solution:**
1. Check API response: `/api/v1/setting?datalabel=X` returns color_code
2. Verify `loadSettingsColors()` was called on mount
3. Check browser console for color loading errors
4. Ensure datalabel name matches database (snake_case)

### Issue: Inline Edit Dropdown Has No Colors

**Cause:** Options missing metadata.color_code

**Solution:**
1. Verify `loadSettingOptions()` includes metadata
2. Check ColoredDropdown receives options with color_code
3. Ensure COLOR_OPTIONS format: `{ value, label, metadata: { color_code } }`

### Issue: API Returns Empty Array

**Cause:** Datalabel name mismatch

**Solution:**
1. Frontend uses snake_case: `project_stage`
2. Database uses double underscore: `project__stage`
3. API converts between formats automatically
4. Check API logs for conversion issues

---

## Best Practices

### DO ✅

- Always fetch colors from database via API
- Preload colors on component mount for better UX
- Use renderSettingBadge for all badge rendering
- Cache API responses to reduce server load
- Let auto-detection handle field types
- Use naming conventions for automatic features

### DON'T ❌

- Don't hardcode colors in components
- Don't create custom color maps
- Don't bypass the caching system
- Don't manually configure what auto-detection handles
- Don't forget to handle API errors
- Don't skip color preloading for settings fields

---

## Summary

The PMO DataTable system provides two optimized components for different use cases:

- **EntityDataTable**: Full-featured, 1350 lines, 45 KB, for all entity pages
- **SettingsDataTable**: Lightweight, 300 lines, 12 KB, for settings pages only

Both components share a **unified, database-driven color and formatting system** that ensures:

✅ Single source of truth (database)
✅ No hardcoded colors or formats
✅ Automatic type detection
✅ Performance optimization with caching
✅ Consistent visual styling
✅ Easy maintenance and updates

**Key Principle:** Colors, formats, and styling always flow from Database → API → Middleware → Rendering → UI. Never hardcoded!

---

## Related Documentation

- **EntityDataTable Guide**: [entity_datatable.md](./entity_datatable.md)
- **SettingsDataTable Guide**: [settings_datatable.md](./settings_datatable.md)
- **Settings System**: [settings.md](./settings.md)
- **Data Model**: [datamodel.md](./datamodel.md)
- **UI/UX Architecture**: [ui_ux_route_api.md](./ui_ux_route_api.md)

---

**Last Updated:** 2025-10-29
**Version:** 2.0 (Post Component Separation)
**Status:** Production Ready
