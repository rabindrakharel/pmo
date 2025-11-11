# Core Algorithm Design Pattern

> **Field Category Registry Pattern - Auto-configuration through naming conventions**
> Database column names drive ALL rendering, width, alignment, colors, and behavior

**Tags:** `#architecture` `#field-category-registry` `#DRY` `#auto-detection`

---

## 1. Semantics & Business Context

### Purpose
Eliminate manual configuration by auto-detecting field types from naming conventions. A single registry drives rendering behavior for ALL fields across ALL entities.

### Business Value
- **Zero Configuration**: Add new fields without touching UI code
- **Consistency**: All fields of same type render identically across platform
- **Maintainability**: One registry change affects all entities globally
- **Developer Experience**: Name it correctly → Everything works automatically

---

## 2. Architecture & DRY Design Patterns

### Data Flow (Complete Pipeline)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. DATABASE                                                     │
│    Column: dl__project_stage TEXT                               │
│    Value: "Planning"                                            │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. API RESPONSE                                                 │
│    GET /api/v1/project                                          │
│    Response: { dl__project_stage: "Planning" }                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. ENTITY CONFIG (entityConfig.ts)                             │
│    columns: generateStandardColumns([                           │
│      'name', 'code', 'dl__project_stage'                        │
│    ])                                                           │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. CATEGORY DETECTION (fieldCategoryRegistry.ts)               │
│    detectFieldCategory('dl__project_stage')                     │
│    Pattern: dl__*_stage → FieldCategory.LABEL                   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. REGISTRY LOOKUP                                              │
│    FIELD_CATEGORY_CONFIGS[LABEL] = {                            │
│      width: '130px',                                            │
│      align: 'left',                                             │
│      sortable: true,                                            │
│      filterable: true,                                          │
│      loadOptionsFromSettings: true,                             │
│      features: { colorBadge: true }                             │
│    }                                                            │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. COLUMN GENERATION (columnGenerator.ts)                      │
│    Auto-applies ALL registry properties                         │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. SETTINGS API CALL                                            │
│    GET /api/v1/setting?datalabel=dl__project_stage             │
│    Returns: [                                                   │
│      {name: "Planning", color_code: "purple"},                  │
│      {name: "Execution", color_code: "yellow"}                  │
│    ]                                                            │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. COLOR CACHE (data_transform_render.tsx)                     │
│    getSettingColor('dl__project_stage', 'Planning')             │
│    Returns: 'purple'                                            │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 9. BADGE RENDERING                                              │
│    renderSettingBadge('purple', 'Planning')                     │
│    COLOR_MAP['purple'] → 'bg-purple-100 text-purple-800'        │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 10. BROWSER                                                     │
│     🟣 Purple badge "Planning"                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Pattern Detection

```typescript
// /apps/web/src/lib/fieldCategoryRegistry.ts

export function detectFieldCategory(fieldKey: string): FieldCategory {
  // LABEL category (settings-driven fields with colored badges)
  if (fieldKey.startsWith('dl__') &&
      (fieldKey.includes('_stage') || fieldKey.includes('_priority') ||
       fieldKey.includes('_status') || fieldKey.includes('_level') ||
       fieldKey.includes('_tier') || fieldKey.includes('_sector') ||
       fieldKey.includes('_channel'))) {
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

  // ... other patterns
}
```

---

## 3. Database, API & UI/UX Mapping

### Perfect 1:1 Alignment

**Before (Old - REMOVED):**
```
Database:     dl__project_stage
Settings DB:  project_stage         ← Mismatch!
API param:    project_stage         ← Different format!
Mapping:      'dl__project_stage': 'project_stage'  ← Transformation needed
```

**Now (Current - PERFECT 1:1):**
```
Database Column:       dl__project_stage
Settings datalabel:    dl__project_stage     ← SAME!
API Parameter:         dl__project_stage     ← SAME!
Frontend Mapping:      'dl__project_stage': 'dl__project_stage'  ← NO TRANSFORMATION!
```

### Naming Conventions

#### Database Columns
```sql
-- Format: dl__entity_attribute
CREATE TABLE app.d_project (
  dl__project_stage text  -- ✅ Correct format
);

CREATE TABLE app.d_task (
  dl__task_stage text,
  dl__task_priority text
);
```

#### Settings Table
```sql
-- Format: dl__entity_attribute (SAME as database column)
INSERT INTO app.setting_datalabel (datalabel_name, ui_label, ui_icon, metadata) VALUES
('dl__project_stage', 'Project Stages', 'GitBranch', '[...]'::jsonb),
('dl__task_stage', 'Task Stages', 'Target', '[...]'::jsonb),
('dl__task_priority', 'Task Priorities', 'TrendingUp', '[...]'::jsonb);
```

#### Frontend Mapping
```typescript
// /apps/web/src/lib/settingsLoader.ts

// Perfect 1:1 mapping - NO transformation
export const FIELD_TO_SETTING_MAP: Record<string, string> = {
  'dl__project_stage': 'dl__project_stage',  // ✅ Exact match
  'dl__task_stage': 'dl__task_stage',
  'dl__task_priority': 'dl__task_priority',
};

// Dynamic URL generation - no hardcoded mapping needed
export function getSettingEndpoint(datalabel: string): string {
  return `/api/v1/setting?datalabel=${datalabel}`;
}
```

---

## 4. Central Configuration & Middleware

### Registry Categories

| Category | Detection Pattern | Width | Align | Sort | Filter | Search | Features |
|----------|------------------|-------|-------|------|--------|--------|----------|
| **LABEL** | `dl__*_stage`, `dl__*_status`, `dl__*_priority`, `dl__*_level` | 130px | left | ✅ | ✅ | ❌ | Colored badge, dropdown, settings-driven |
| **NAME** | `name`, `title` | 200px | left | ✅ | ✅ | ✅ | Plain text, global search |
| **CODE** | `code` | 120px | left | ✅ | ✅ | ✅ | Plain text, global search |
| **DESCR** | `descr`, `description` | 250px | left | ✅ | ✅ | ✅ | Plain text, truncated |
| **AMOUNT** | `*_amt`, `*_amount` | 120px | right | ✅ | ✅ | ❌ | Currency format: `$250,000.00 CAD` |
| **DATE** | `*_date` | 120px | left | ✅ | ✅ | ❌ | Friendly date: `Mar 15, 2025` |
| **TIMESTAMP** | `*_ts`, `*_timestamp` | 150px | left | ✅ | ❌ | ❌ | Relative time: `3 minutes ago` |
| **BOOLEAN** | `*_flag` | 80px | center | ✅ | ✅ | ❌ | ✓ (green) or ✗ (gray) |
| **PERCENTAGE** | `*_pct` | 100px | right | ✅ | ✅ | ❌ | `75%` |
| **NUMBER** | `*_count`, `*_qty` | 100px | right | ✅ | ✅ | ❌ | `1,234` |

### Entity Config Pattern

```typescript
// /apps/web/src/lib/entityConfig.ts

export const entityConfig: EntityConfigMap = {
  project: {
    name: 'project',
    displayName: 'Project',
    apiEndpoint: '/api/v1/project',

    // Use generateStandardColumns - auto-detects everything
    columns: generateStandardColumns(
      ['name', 'code', 'descr', 'dl__project_stage'],
      {
        overrides: {
          dl__project_stage: {
            title: 'Stage'  // Only override title if needed
          }
        }
      }
    ),

    childEntities: ['task', 'artifact', 'wiki']
  }
};
```

---

## 5. User Interaction Flow Examples

### Viewing Data
1. User navigates to `/project`
2. EntityMainPage loads projects via API
3. Each `dl__project_stage` column auto-detected as LABEL
4. Settings API called: `/api/v1/setting?datalabel=dl__project_stage`
5. Colors cached in memory for O(1) lookup
6. Each row renders colored badge automatically
7. User sees: 🟣 Planning, 🟡 Execution, 🟢 Completed

### Filtering Data
1. User clicks filter icon on Stage column
2. Auto-detected as filterable (from registry)
3. Dropdown loads from cache (already fetched)
4. Options show with colored badges
5. User selects "Planning" + "Execution"
6. Table filters to matching rows
7. Applied filters shown as chips

### Inline Editing
1. User clicks edit button on row
2. `dl__project_stage` cell becomes dropdown
3. Options load from cache with colored badges
4. User selects "Execution"
5. PUT /api/v1/project/{id} with `{dl__project_stage: "Execution"}`
6. Cell updates to 🟡 Execution badge
7. Cache cleared for that entity

---

## 6. Critical Considerations When Building

### ✅ DO

```typescript
// 1. Use dl__ prefix for ALL label fields in database
CREATE TABLE app.d_entity (
  dl__entity_stage text  // ✅ Correct
);

// 2. Use generateStandardColumns in entity config
columns: generateStandardColumns(
  ['name', 'code', 'dl__entity_stage']
)

// 3. Settings table uses SAME dl__ prefix
INSERT INTO app.setting_datalabel (datalabel_name) VALUES
('dl__entity_stage');  // ✅ Perfect 1:1 alignment

// 4. Let registry auto-detect everything
// NO manual: width, align, sortable, loadOptionsFromSettings
```

### ❌ DON'T

```typescript
// 1. DON'T use different formats
CREATE TABLE app.d_entity (
  entity_stage text  // ❌ Missing dl__ prefix
);

INSERT INTO app.setting_datalabel (datalabel_name) VALUES
('entity__stage');  // ❌ Different format

// 2. DON'T add fallback mappings
FIELD_TO_SETTING_MAP = {
  'office_level': 'dl__office_level',  // ❌ No fallbacks!
  'stage': 'dl__task_stage'            // ❌ Use full name
}

// 3. DON'T manually configure what registry handles
columns: [{
  key: 'dl__project_stage',
  width: '150px',              // ❌ Registry handles this
  loadOptionsFromSettings: true // ❌ Auto-detected
}]

// 4. DON'T hardcode colors
const getStageColor = (stage: string) => {
  if (stage === 'Planning') return 'purple';  // ❌ Never!
};
```

### Adding New Label Field (Complete Steps)

```sql
-- 1. Database: Add column with dl__ prefix
ALTER TABLE app.d_project ADD COLUMN dl__project_risk text;

-- 2. Settings: Add with SAME dl__ prefix
INSERT INTO app.setting_datalabel (datalabel_name, ui_label, ui_icon, metadata) VALUES
('dl__project_risk', 'Project Risk', 'AlertTriangle', '[
  {"id": 0, "name": "Low", "color_code": "green"},
  {"id": 1, "name": "High", "color_code": "red"}
]'::jsonb);
```

```typescript
// 3. Frontend: Add to mapping (1:1 format)
FIELD_TO_SETTING_MAP = {
  'dl__project_risk': 'dl__project_risk',  // Perfect alignment
};

// 4. Entity Config: Add to columns (that's it!)
columns: generateStandardColumns([
  'name', 'code', 'dl__project_stage', 'dl__project_risk'
])
```

**Result:** Automatically configured with:
- ✅ 130px width
- ✅ Left alignment
- ✅ Colored badges
- ✅ Filterable dropdown
- ✅ Sortable
- ✅ Settings-driven options

### Quick Reference

**Checklist when adding datalabel field:**
- [ ] Database column: `dl__entity_attribute`
- [ ] Settings row: `datalabel_name = 'dl__entity_attribute'`
- [ ] FIELD_TO_SETTING_MAP: `'dl__entity_attribute': 'dl__entity_attribute'`
- [ ] Entity config: Add to `generateStandardColumns([..., 'dl__entity_attribute'])`
- [ ] Run: `./tools/db-import.sh`

**That's it!** Everything else is automatic.

---

## Current Entities Using Pattern

| Entity | Datalabel Fields |
|--------|------------------|
| **project** | `dl__project_stage` |
| **task** | `dl__task_stage`, `dl__task_priority` |
| **cust** | `dl__opportunity_funnel_stage`, `dl__industry_sector`, `dl__acquisition_channel`, `dl__customer_tier`, `dl__client_status` |
| **office** | `dl__office_level` |
| **biz** | `dl__business_level` |
| **position** | `dl__position_level` |
| **form** | `dl__form_submission_status`, `dl__form_approval_status` |
| **wiki** | `dl__wiki_publication_status` |

**Total:** 16 datalabel categories across all entities

---

## Key Insight

> **Name the field correctly with `dl__` prefix → Everything else is automatic**

No manual configuration of:
- Column width ❌
- Text alignment ❌
- Sortable/filterable flags ❌
- Colored badge rendering ❌
- Settings dropdown loading ❌
- API endpoint URLs ❌

**One registry change → Affects all label fields globally across entire platform**

---

**Last Updated:** 2025-10-30
**Architecture:** DRY-First, Convention-Over-Configuration
**Status:** Production Ready
