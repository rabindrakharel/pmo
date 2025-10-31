# DataTable System - Complete Architecture

> **Database-driven data standardization with perfect 1:1 `dl__` alignment**
> Zero hardcoding - Database column names drive rendering, colors, widths, sorting, filtering

**Tags:** `#datatable` `#field-category` `#settings` `#auto-configuration` `#DRY`

---

## 1. Semantics & Business Context

### Purpose
Provide a universal data table component that automatically configures itself based on database column naming conventions. All rendering behavior, colors, widths, alignment, and features are determined by the column name - no manual configuration needed.

### Business Value
- **Zero Configuration**: Add database columns → Automatically render correctly
- **Perfect Consistency**: All tables across platform use identical patterns
- **Database-Driven Colors**: All colors from `setting_datalabel` metadata - NO hardcoding
- **Maintainable**: Change once in registry → affects all tables globally
- **Type-Safe**: TypeScript ensures correctness at compile time

---

## 2. Architecture & DRY Design Patterns

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
│    • Request: GET /api/v1/setting?category=dl__project_stage    │
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
└─────────────────────────────────────────────────────────────────┘
```

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

**Key:** Column name determines EVERYTHING - width, alignment, rendering, features

---

## 3. Database, API & UI/UX Mapping

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
GET /api/v1/setting?category=dl__project_stage

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

### API Implementation

```typescript
// /apps/api/src/modules/setting/routes.ts

fastify.get('/api/v1/setting', async (request, reply) => {
  const { category } = request.query;

  // Direct lookup - no transformation needed
  const results = await db.execute(sql`
    SELECT
      (elem.value->>'id')::text as id,
      elem.value->>'name' as name,
      elem.value->>'color_code' as color_code,
      elem.ordinality - 1 as position
    FROM app.setting_datalabel,
      jsonb_array_elements(metadata) WITH ORDINALITY as elem
    WHERE datalabel_name = ${category}
    ORDER BY elem.ordinality
  `);

  return { data: results, datalabel: category };
});
```

### Frontend Settings Loader

```typescript
// /apps/web/src/lib/settingsLoader.ts

// Dynamic URL generation - no hardcoded mapping
export function getSettingEndpoint(datalabel: string): string {
  return `/api/v1/setting?category=${datalabel}`;
}

// Load options with 5-minute cache
export async function loadSettingOptions(datalabel: string): Promise<SettingOption[]> {
  const cached = settingsCache.get(datalabel);
  if (cached && Date.now() - cached.timestamp < 300000) {
    return cached.data;
  }

  const endpoint = getSettingEndpoint(datalabel);
  const response = await fetch(`${API_BASE_URL}${endpoint}`);
  const result = await response.json();

  const options = result.data.map(item => ({
    value: item.name,
    label: item.name,
    colorClass: colorCodeToTailwindClass(item.color_code),
    metadata: { color_code: item.color_code }
  }));

  settingsCache.set(datalabel, { data: options, timestamp: Date.now() });
  return options;
}
```

### Color Cache & Rendering

```typescript
// /apps/web/src/lib/data_transform_render.tsx

// Tailwind color mapping
export const COLOR_MAP: Record<string, string> = {
  'blue': 'bg-blue-100 text-blue-800 border border-blue-200',
  'purple': 'bg-purple-100 text-purple-800 border border-purple-200',
  'yellow': 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  'orange': 'bg-orange-100 text-orange-800 border border-orange-200',
  'green': 'bg-green-100 text-green-800 border border-green-200',
  'red': 'bg-red-100 text-red-800 border border-red-200',
  'gray': 'bg-gray-100 text-gray-800 border border-gray-200',
};

// In-memory color cache for O(1) lookups
const settingsColorCache = new Map<string, Map<string, string>>();

// Preload colors for a datalabel
export async function loadSettingsColors(datalabel: string): Promise<void> {
  const options = await loadSettingOptions(datalabel);
  const colorMap = new Map();
  options.forEach(opt => {
    if (opt.metadata?.color_code) {
      colorMap.set(opt.value, opt.metadata.color_code);
    }
  });
  settingsColorCache.set(datalabel, colorMap);
}

// O(1) color lookup
export function getSettingColor(datalabel: string, value: string): string | undefined {
  return settingsColorCache.get(datalabel)?.get(value);
}

// Render colored badge
export function renderSettingBadge(colorCode: string, label: string) {
  const classes = COLOR_MAP[colorCode] || COLOR_MAP['gray'];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}
```

### DataTable Component Integration

```typescript
// /apps/web/src/components/shared/ui/DataTable.tsx

// Auto-detect column capabilities
const columnCapabilities = useMemo(
  () => detectColumnCapabilities(columns),
  [columns]
);

// Preload colors and options on mount
useEffect(() => {
  const preload = async () => {
    const settingsColumns = columns.filter(col => {
      const capability = columnCapabilities.get(col.key);
      return capability?.loadOptionsFromSettings;
    });

    // Load in parallel
    await Promise.all(
      settingsColumns.map(async (col) => {
        await loadSettingsColors(col.key);  // Uses dl__ format directly
        const options = await loadSettingOptions(col.key);
        settingOptions.set(col.key, options);
      })
    );
  };

  if (inlineEditable || filterable) {
    preload();
  }
}, [columns]);

// Render table cell
<td width={capability?.width} align={capability?.align}>
  {editMode ? (
    // Inline edit: Colored dropdown
    <ColoredDropdown
      value={editedData.dl__project_stage}
      options={settingOptions.get('dl__project_stage')}
      onChange={value => onInlineEdit(rowId, 'dl__project_stage', value)}
    />
  ) : (
    // Display: Colored badge
    renderSettingBadge(
      getSettingColor('dl__project_stage', record.dl__project_stage),
      record.dl__project_stage
    )
  )}
</td>
```

---

## 4. User Interaction Flow Examples

### Viewing Data in Table
1. User navigates to `/project`
2. EntityMainPage fetches: `GET /api/v1/project`
3. Response includes: `{dl__project_stage: "Execution"}`
4. DataTable detects `dl__project_stage` → LABEL category
5. Preloads settings: `GET /api/v1/setting?category=dl__project_stage`
6. Caches colors: `Map<'Execution', 'yellow'>`
7. Renders: 🟡 Yellow badge "Execution"

### Filtering by Stage
1. User clicks filter icon on Stage column
2. Dropdown shows options from cache
3. Each option displays with colored badge
4. User selects "Planning" + "Execution"
5. Table filters to matching rows
6. Applied filters shown as chips with colors

### Inline Editing
1. User clicks edit button on row
2. Stage cell becomes dropdown with colored options
3. User selects "Monitoring"
4. PUT `/api/v1/project/{id}` with `{dl__project_stage: "Monitoring"}`
5. Cell updates to 🟠 Orange badge "Monitoring"
6. Settings cache remains valid (not cleared)

### Sorting by Multiple Columns
1. User clicks Stage column header (auto-detected as sortable)
2. Sorts by stage name alphabetically
3. User shift-clicks Budget column
4. Multi-column sort: Stage (asc), Budget (desc)
5. Sort indicators show on both headers

---

## 5. Critical Considerations When Building

### ✅ DO - Current Correct Patterns

```sql
-- 1. Database: Use dl__ prefix
CREATE TABLE app.d_project (
  dl__project_stage text  -- ✅ Correct
);

-- 2. Settings: Use SAME dl__ prefix (perfect 1:1)
INSERT INTO app.setting_datalabel (datalabel_name, ui_label, icon, metadata) VALUES
('dl__project_stage', 'Project Stages', 'GitBranch', '[
  {"id": 0, "name": "Planning", "color_code": "purple"}
]'::jsonb);  -- ✅ Perfect alignment
```

```typescript
// 3. Frontend: Use SAME dl__ format (1:1 mapping)
FIELD_TO_SETTING_MAP = {
  'dl__project_stage': 'dl__project_stage'  // ✅ Exact match
};

// 4. Generate endpoints dynamically
getSettingEndpoint('dl__project_stage');
// Returns: '/api/v1/setting?category=dl__project_stage'

// 5. Use colors from database ONLY
const color = getSettingColor('dl__project_stage', record.dl__project_stage);
```

### ❌ DON'T - Outdated/Wrong Patterns

```sql
-- ❌ DON'T use different formats
CREATE TABLE app.d_project (
  project_stage text  -- ❌ Missing dl__ prefix
);

INSERT INTO app.setting_datalabel (datalabel_name) VALUES
('project__stage');  -- ❌ Wrong: should be dl__project_stage
```

```typescript
// ❌ DON'T add transformation logic
const datalabelName = category.startsWith('dl__')
  ? category.substring(4)  // ❌ No stripping needed!
  : category;

// ❌ DON'T hardcode endpoint mappings
SETTING_DATALABEL_TO_ENDPOINT = {
  'project__stage': '/api/v1/setting?category=dl__project__stage'  // ❌ Generate dynamically!
};

// ❌ DON'T hardcode colors
const getStageColor = (stage: string) => {
  if (stage === 'Planning') return 'purple';  // ❌ Use database!
};

// ❌ DON'T manually configure what registry handles
columns: [{
  key: 'dl__project_stage',
  width: '150px',              // ❌ Auto-detected
  loadOptionsFromSettings: true // ❌ Auto-detected
}];
```

### Performance Optimization

1. **5-Minute API Cache** - `settingsCache` prevents redundant API calls
2. **Parallel Preloading** - All settings load simultaneously on mount
3. **O(1) Color Lookups** - `settingsColorCache` for instant rendering
4. **useMemo** - Column capabilities computed once
5. **Conditional Loading** - Only preload when needed (edit/filter mode)

### Key Files

| File | Purpose |
|------|---------|
| `/db/setting_datalabel.ddl` | Settings table schema with dl__ prefix |
| `/db/11-27_d_*.ddl` | Entity tables with dl__ columns |
| `/apps/api/src/modules/setting/routes.ts` | Settings API (direct lookup) |
| `/apps/web/src/lib/settingsLoader.ts` | Settings loader & caching |
| `/apps/web/src/lib/fieldCategoryRegistry.ts` | Field category auto-detection |
| `/apps/web/src/lib/data_transform_render.tsx` | Color cache & rendering |
| `/apps/web/src/components/shared/ui/DataTable.tsx` | DataTable component |

---

## Summary

**Current Architecture (Perfect 1:1 Alignment):**
```
Database:     dl__project_stage
Settings:     dl__project_stage     ← SAME!
API:          dl__project_stage     ← SAME!
Frontend:     dl__project_stage     ← SAME!
```

**Zero Hardcoding - Database Drives Everything:**
- Colors from `setting_datalabel.metadata[].color_code`
- Widths from `fieldCategoryRegistry` based on column name
- Endpoints generated dynamically: `/api/v1/setting?category={datalabel}`
- Rendering behavior auto-detected from naming patterns

**Key Principle:** Name the column correctly with `dl__` prefix → Everything works automatically

---

**Last Updated:** 2025-10-30
**Architecture:** Database-Driven, Zero Hardcoding, Perfect 1:1 Alignment
**Status:** Production Ready
