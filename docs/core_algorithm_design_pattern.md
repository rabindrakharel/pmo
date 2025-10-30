# Core Algorithm Design Pattern

**Tags:** `#architecture` `#field-category-registry` `#centralized-rendering` `#DRY`

---

## Pattern: Field Category Registry

**Purpose:** Auto-detect field type by naming convention → Apply consistent properties (colors, width, alignment, sorting) from centralized registry.

---

## Data Flow (9 Steps)

```
1. DATABASE
   └─ Column: dl__project_stage, Value: "Planning"

2. API
   └─ GET /api/v1/project returns: { dl__project_stage: "Planning" }

3. ENTITY CONFIG (entityConfig.ts)
   └─ generateStandardColumns(['name', 'code', 'dl__project_stage'])

4. CATEGORY DETECTION (fieldCategoryRegistry.ts)
   └─ detectFieldCategory('dl__project_stage') → FieldCategory.LABEL
   └─ Pattern: key.startsWith('dl__') || key.endsWith('_stage|_status|_priority|_level|_tier|_sector|_channel')

5. REGISTRY LOOKUP (fieldCategoryRegistry.ts)
   └─ FIELD_CATEGORY_REGISTRY[LABEL] → {
        width: '130px',
        align: 'left',
        sortable: true,
        filterable: true,
        loadOptionsFromSettings: true,
        features: { colorBadge: true }
      }

6. COLUMN GENERATION (columnGenerator.ts)
   └─ Auto-applies all registry properties to column

7. DATA TABLE (EntityDataTable.tsx)
   └─ renderCellValue() sees: column.loadOptionsFromSettings = true
   └─ Calls: getSettingColor('project_stage', 'Planning') → 'purple'

8. BADGE RENDER (data_transform_render.tsx)
   └─ renderSettingBadge('purple', 'Planning')
   └─ COLOR_MAP['purple'] → 'bg-purple-100 text-purple-800'

9. BROWSER
   └─ Displays: 🟣 Purple badge "Planning"
```

---

## Naming Convention

### Database Columns
```
Format: dl__{entity}__{label_type}

Examples:
  dl__project_stage
  dl__task_stage
  dl__task_priority
  dl__customer_tier
  dl__office_level
  dl__business_level
```

### Setting Datalabels (setting_datalabel.ddl)
```
Format: {entity}__{label_type}  (no dl__ prefix in datalabel_name)

Examples:
  project__stage
  task__stage
  task__priority
  customer__tier
```

### Field Mapping (settingsLoader.ts)
```typescript
FIELD_TO_SETTING_MAP = {
  'dl__project_stage': 'project__stage',
  'dl__task_stage': 'task__stage',
  'dl__task_priority': 'task__priority',
  // Only canonical dl__ mappings - NO fallbacks
}
```

---

## Registry Categories

### LABEL Category (Settings-Driven Fields)
**Detection:** Starts with `dl__` OR ends with `_stage`, `_status`, `_priority`, `_level`, `_tier`, `_sector`, `_channel`

**Auto-Applied Properties:**
- Width: 130px
- Alignment: left
- Sortable: true
- Filterable: true
- Searchable: false
- loadOptionsFromSettings: true
- Colored badge rendering

**Example Fields:** dl__project_stage, dl__task_priority, dl__customer_tier

### Other Categories
- **NAME:** name, title → 200px, sortable, searchable
- **CODE:** code → 120px, sortable
- **DESCR:** descr, description → 250px, sortable, searchable
- **DATE:** *_date → 120px, friendly format ("Mar 15, 2025")
- **AMOUNT:** *_amt, *_amount → 120px, right-aligned, currency format
- **BOOLEAN:** *_flag, is_*, has_* → 80px, center, ✓/✗ icons

---

## Rules

### ✅ DO
1. Use `dl__` prefix for all label fields in database
2. Use `generateStandardColumns(['name', 'code', ...])` in entityConfig
3. Include both name and code as separate columns
4. Let registry handle width, alignment, and rendering
5. Only override `title` if needed (e.g., 'Stage' instead of 'Dl Project Stage')
6. Ensure data values match `setting_datalabel.ddl` entries

### ❌ DON'T
1. Add fallback mappings in FIELD_TO_SETTING_MAP (e.g., 'office_level': '...')
2. Use custom `render` functions for label fields (auto-handled)
3. Hardcode colors in entity config
4. Combine name + code in one column
5. Manually set `loadOptionsFromSettings` (auto-detected)
6. Use field names that don't match database

---

## Entity Config Pattern

### ✅ Correct Pattern
```typescript
cust: {
  name: 'cust',
  displayName: 'Customer',
  apiEndpoint: '/api/v1/cust',

  // Use generateStandardColumns (puts name, code, descr first)
  columns: generateStandardColumns(
    ['name', 'code', 'descr', 'dl__customer_tier'],
    {
      overrides: {
        dl__customer_tier: {
          title: 'Tier'  // Only override title if needed
        }
      }
    }
  )
}
```

### ❌ Wrong Pattern
```typescript
// DON'T DO THIS:
columns: generateColumns(
  ['name', 'city'],  // ❌ Missing 'code'
  {
    overrides: {
      name: {
        render: (value, record) => (
          <div>
            <div>{value}</div>
            <div>{record.code}</div>  // ❌ Stuffing code below name
          </div>
        )
      },
      dl__customer_tier: {
        loadOptionsFromSettings: true  // ❌ Redundant (auto-detected)
      }
    }
  }
)
```

---

## Adding New Label Field

```sql
-- 1. Add to entity DDL
ALTER TABLE app.d_project ADD COLUMN dl__project_risk text;

-- 2. Add to setting_datalabel.ddl
('project__risk', 'Project Risk', 'AlertTriangle', '[
  {"id": 0, "name": "Low", "color_code": "green"},
  {"id": 1, "name": "High", "color_code": "red"}
]'::jsonb);
```

```typescript
// 3. Add to FIELD_TO_SETTING_MAP
'dl__project_risk': 'project__risk',

// 4. Add to entity config (that's it!)
columns: generateStandardColumns([
  'name', 'code', 'dl__project_stage', 'dl__project_risk'
])
```

**Result:** Auto-configured with 130px width, colored badges, filtering, etc.

---

## Current Entities Using Pattern

| Entity | Label Fields |
|--------|-------------|
| project | dl__project_stage |
| task | dl__task_stage, dl__task_priority |
| cust | dl__opportunity_funnel_stage, dl__industry_sector, dl__acquisition_channel, dl__customer_tier |
| office | dl__office_level |
| biz | dl__business_level |
| wiki | publication_status (auto-detected by _status suffix) |
| form | submission_status, approval_status (auto-detected) |

---

## Key Insight

**Name field correctly (`dl__*`) → Everything else automatic.**

No manual configuration of:
- Column width
- Text alignment
- Sortable/filterable flags
- Colored badge rendering
- Settings dropdown loading

One registry change → affects all label fields globally.
