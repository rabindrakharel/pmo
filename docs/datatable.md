# DataTable System - Architecture Guide

> **Database-driven data standardization with `dl__` naming convention**
> All configuration flows from database: colors, widths, sorting, filtering, dropdowns

---

## Core Concept

**Single Source of Truth:** Database drives EVERYTHING - no hardcoding anywhere.

```
Database Column → API Parameter → Settings Lookup → UI Rendering
dl__project_stage → dl__project__stage → project__stage → Yellow Badge
```

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│ 1. DATABASE                                                 │
│    • Column: dl__project_stage TEXT                         │
│    • Settings: setting_datalabel (project__stage)           │
│    • Metadata: [{name: "Execution", color_code: "yellow"}]  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. API                                                      │
│    • Request: GET /api/v1/setting?category=dl__project__stage │
│    • Processing: Strip dl__ → lookup project__stage         │
│    • Response: {datalabel: "dl__project__stage", data: [...]} │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. FIELD CATEGORY AUTO-DETECTION                           │
│    • detectFieldCategory('dl__project_stage') → LABEL       │
│    • Auto-apply: width:130px, align:left, sortable:true    │
│    • Features: colorBadge:true, dropdown:true               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. COLOR CACHE (O(1) lookup)                               │
│    • Preload: loadSettingsColors('project__stage')          │
│    • Cache: Map<'Execution', 'yellow'>                      │
│    • Lookup: getSettingColor('project__stage', 'Execution') │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. UI RENDERING                                             │
│    • Badge: <span class="bg-yellow-100 text-yellow-800">   │
│    • Dropdown: ColoredDropdown with badge options           │
│    • Filter: Multi-select with colored checkboxes           │
└─────────────────────────────────────────────────────────────┘
```

---

## Field Category Patterns

**Auto-detection by field name pattern:**

| Pattern | Category | Width | Align | Sort | Filter | Search | Features |
|---------|----------|-------|-------|------|--------|--------|----------|
| `dl__*_stage` | LABEL | 130px | left | ✅ | ✅ | ❌ | Colored badge, dropdown, settings-driven |
| `dl__*_status` | LABEL | 130px | left | ✅ | ✅ | ❌ | Colored badge, dropdown, settings-driven |
| `dl__*_priority` | LABEL | 130px | left | ✅ | ✅ | ❌ | Colored badge, dropdown, settings-driven |
| `dl__*_level` | LABEL | 130px | left | ✅ | ✅ | ❌ | Colored badge, dropdown, settings-driven |
| `*_amt` | AMOUNT | 120px | right | ✅ | ✅ | ❌ | Currency format: `$75,000.00 CAD` |
| `*_date` | DATE | 120px | left | ✅ | ✅ | ❌ | Friendly date: `Mar 15, 2025` |
| `*_ts` | TIMESTAMP | 150px | left | ✅ | ❌ | ❌ | Relative time: `3 minutes ago` |
| `name`, `title` | NAME | 200px | left | ✅ | ✅ | ✅ | Plain text, global search |
| `code` | CODE | 120px | left | ✅ | ✅ | ✅ | Plain text, global search |
| `*_flag` | BOOLEAN | 80px | center | ✅ | ✅ | ❌ | ✓ (green) or ✗ (gray) |
| `*_pct` | PERCENTAGE | 100px | right | ✅ | ✅ | ❌ | `75%` |
| `*_count` | NUMBER | 100px | right | ✅ | ✅ | ❌ | `1,234` |

**Key:** `dl__` prefix = datalabel field (loads from settings API)

---

## Database Schema

```sql
-- Entity table with dl__ columns
CREATE TABLE app.d_project (
    id uuid PRIMARY KEY,
    name varchar(200) NOT NULL,
    code varchar(50) UNIQUE NOT NULL,

    -- DATALABEL COLUMNS (dl__ prefix)
    dl__project_stage text,  -- References setting_datalabel (project__stage)

    -- OTHER COLUMNS (auto-detected by suffix)
    budget_allocated_amt decimal(15,2),
    planned_start_date date,
    created_ts timestamptz,
    active_flag boolean
);

-- Settings table (double underscore format)
CREATE TABLE app.setting_datalabel (
    datalabel_name VARCHAR(100) PRIMARY KEY,  -- Format: entity__label
    ui_label VARCHAR(100) NOT NULL,
    metadata JSONB NOT NULL  -- [{id, name, descr, color_code, parent_id}]
);

-- Sample settings data
INSERT INTO app.setting_datalabel VALUES
('project__stage', 'Project Stages', 'GitBranch', '[
  {"id": 0, "name": "Initiation", "color_code": "blue"},
  {"id": 1, "name": "Planning", "color_code": "purple"},
  {"id": 2, "name": "Execution", "color_code": "yellow"},
  {"id": 3, "name": "Monitoring", "color_code": "orange"},
  {"id": 4, "name": "Closure", "color_code": "green"}
]'::jsonb);
```

---

## API Endpoints

```typescript
// Settings API: GET /api/v1/setting?category=dl__project__stage
// Response: {datalabel: "dl__project__stage", data: [...]}

fastify.get('/api/v1/setting', async (request, reply) => {
  const { category } = request.query;

  // Strip dl__ prefix for database lookup
  const datalabelName = category.startsWith('dl__')
    ? category.substring(4)  // 'dl__project__stage' → 'project__stage'
    : category;

  // Query database
  const results = await db.execute(sql`
    SELECT
      (elem.value->>'id')::text as id,
      elem.value->>'name' as name,
      elem.value->>'color_code' as color_code,
      elem.ordinality - 1 as position
    FROM app.setting_datalabel,
      jsonb_array_elements(metadata) WITH ORDINALITY as elem
    WHERE datalabel_name = ${datalabelName}
    ORDER BY elem.ordinality
  `);

  // Return with dl__ prefix
  const columnName = category.startsWith('dl__') ? category : `dl__${category}`;
  return { data: results, datalabel: columnName };
});

// Entity API: GET /api/v1/project
// Response: [{id: "...", name: "...", dl__project_stage: "Execution", ...}]
```

---

## Frontend Implementation

### Field Category Detection

```typescript
// /apps/web/src/lib/fieldCategoryRegistry.ts

export function detectFieldCategory(fieldKey: string): FieldCategory {
  // LABEL category (settings-driven)
  if (fieldKey.startsWith('dl__') &&
      (fieldKey.includes('_stage') || fieldKey.includes('_priority') ||
       fieldKey.includes('_status') || fieldKey.includes('_level'))) {
    return FieldCategory.LABEL;
  }

  // AMOUNT category
  if (fieldKey.endsWith('_amt') || fieldKey.endsWith('_amount')) {
    return FieldCategory.AMOUNT;
  }

  // TIMESTAMP category
  if (fieldKey.endsWith('_ts') || fieldKey.endsWith('_timestamp')) {
    return FieldCategory.TIMESTAMP;
  }

  // ... pattern matching for all categories
}

export const FIELD_CATEGORY_CONFIGS = {
  [FieldCategory.LABEL]: {
    width: '130px',
    align: 'left',
    sortable: true,
    filterable: true,
    searchable: false,
    loadOptionsFromSettings: true,  // Auto-load from API
    features: {
      colorBadge: true,  // Render as colored badge
      dropdown: true     // Show dropdown in edit mode
    }
  },
  // ... other categories
};
```

### Settings Loader

```typescript
// /apps/web/src/lib/settingsLoader.ts

// Endpoint mapping (dl__ prefix format)
export const SETTING_DATALABEL_TO_ENDPOINT: Record<string, string> = {
  'project__stage': '/api/v1/setting?category=dl__project__stage',
  'task__stage': '/api/v1/setting?category=dl__task__stage',
  'task__priority': '/api/v1/setting?category=dl__task__priority',
  // ... all 16 settings categories
};

// Load options with 5-minute cache
export async function loadSettingOptions(datalabel: string): Promise<SettingOption[]> {
  // Check cache first
  const cached = settingsCache.get(datalabel);
  if (cached && Date.now() - cached.timestamp < 300000) {
    return cached.data;
  }

  // Fetch from API
  const endpoint = SETTING_DATALABEL_TO_ENDPOINT[datalabel];
  const response = await fetch(`${API_BASE_URL}${endpoint}`);
  const result = await response.json();

  // Transform and cache
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

### Color Cache

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

// Preload colors
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

### DataTable Component

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
        const datalabel = extractSettingsDatalabel(col.key); // 'dl__project_stage' → 'project__stage'
        await loadSettingsColors(datalabel);
        const options = await loadSettingOptions(datalabel);
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
      getSettingColor('project__stage', record.dl__project_stage),
      record.dl__project_stage
    )
  )}
</td>
```

---

## Critical Rules

### ✅ DO

```sql
-- Database: Use dl__ prefix
CREATE TABLE app.d_project (
  dl__project_stage text  -- ✅ Correct
);

-- Settings: Use double underscore
INSERT INTO app.setting_datalabel (datalabel_name) VALUES
('project__stage');  -- ✅ entity__label format
```

```typescript
// Frontend: Match database column names
columns: [
  { key: 'dl__project_stage', title: 'Stage' }  // ✅ Correct
]

// API: Use dl__ prefix
GET /api/v1/setting?category=dl__project__stage  // ✅ Correct

// Colors: Always from database
const color = getSettingColor('project__stage', record.dl__project_stage);  // ✅ Correct
```

### ❌ DON'T

```sql
-- ❌ Missing dl__ prefix
CREATE TABLE app.d_project (
  project_stage text  -- ❌ Wrong
);

-- ❌ Wrong underscore format
INSERT INTO app.setting_datalabel (datalabel_name) VALUES
('project_stage');  -- ❌ Should be project__stage
```

```typescript
// ❌ Hardcoded colors
const getStageColor = (stage: string) => {
  if (stage === 'Planning') return 'purple';  // ❌ Never hardcode!
};

// ❌ Hardcoded widths
columns: [
  { key: 'dl__project_stage', title: 'Stage', width: '150px' }  // ❌ Let category registry decide
];

// ❌ Missing dl__ prefix
GET /api/v1/setting?category=project_stage  // ❌ Should be dl__project__stage
```

---

## Performance Optimization

1. **5-minute API cache** - Reduce redundant API calls
2. **Parallel preloading** - Load all colors/options at once
3. **O(1) color lookups** - In-memory cache for rendering
4. **useMemo** - Memoize expensive computations
5. **Conditional loading** - Only preload when needed (edit/filter mode)

---

## Key Files

| File | Purpose |
|------|---------|
| `/db/setting_datalabel.ddl` | Settings table schema |
| `/db/11-27_d_*.ddl` | Entity tables with dl__ columns |
| `/apps/api/src/modules/setting/routes.ts` | Settings API |
| `/apps/web/src/lib/settingsLoader.ts` | Settings loader & caching |
| `/apps/web/src/lib/fieldCategoryRegistry.ts` | Field category auto-detection |
| `/apps/web/src/lib/data_transform_render.tsx` | Color cache & rendering |
| `/apps/web/src/components/shared/ui/DataTable.tsx` | DataTable component |

---

## Summary

**Zero hardcoding. Database drives everything.**

```
dl__ naming convention → Auto-detection → Settings API → Color cache → UI rendering
```

All configuration comes from database: colors, widths, sorting, filtering, dropdowns.

**Last Updated:** 2025-10-30
**Architecture:** Database-Driven, Zero Hardcoding
**Status:** Production Ready
