# Backend Metadata Architecture - Complete Summary

**Version**: 1.0
**Date**: 2025-01-19
**Status**: Design Proposal

---

## Executive Overview

This document explains the **complete architecture** for the backend-driven metadata system, with special focus on:

1. **Entity Infrastructure Service** (unchanged) - RBAC, linkage, registry
2. **Backend Formatter Service** (new) - Convention-based metadata generation
3. **Frontend Formatter Service** (simplified) - Metadata-driven rendering only

---

## 1. Current Architecture (v3.x)

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER REQUEST                            │
│            GET /api/v1/project?limit=10                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FASTIFY ROUTE                                │
│  apps/api/src/modules/project/routes.ts                         │
│                                                                 │
│  1. RBAC filtering (Entity Infrastructure Service)              │
│  2. Build query with filters                                    │
│  3. Execute SELECT query                                        │
│  4. Resolve references (_ID/_IDS)                               │
│  5. Return data only                                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API RESPONSE                                │
│  {                                                              │
│    "data": [                                                    │
│      {                                                          │
│        "id": "...",                                             │
│        "budget_allocated_amt": 50000,                           │
│        "dl__project_stage": "In Progress",                      │
│        "manager__employee_id": "uuid",                          │
│        "manager__employee_id_NAME": "John Smith"  ← Added by    │
│      }                                             Entity Infra │
│    ]                                                            │
│  }                                                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              FRONTEND (React)                                   │
│  apps/web/src/lib/frontEndFormatterService.tsx                 │
│                                                                 │
│  ❌ PROBLEM: Frontend does ALL the work                        │
│                                                                 │
│  1. detectField("budget_allocated_amt")                         │
│     → Matches pattern "*_amt" → Returns currency metadata       │
│                                                                 │
│  2. formatCurrency(50000) → "$50,000.00"                        │
│                                                                 │
│  3. renderField() → <span>$50,000.00</span>                     │
│                                                                 │
│  ⚠️  ISSUES:                                                    │
│  - Brittle (rename column breaks UI)                            │
│  - No backend control over formatting                           │
│  - Hard to add view-specific widgets                            │
│  - Duplicated logic if we need server-side rendering            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. New Architecture (v4.0)

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER REQUEST                            │
│            GET /api/v1/project?limit=10                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FASTIFY ROUTE                                │
│  apps/api/src/modules/project/routes.ts                         │
│                                                                 │
│  ┌──────────────────────────────────────────────────┐           │
│  │ ENTITY INFRASTRUCTURE SERVICE (UNCHANGED)        │           │
│  │ apps/api/src/services/entity-infrastructure.ts   │           │
│  │                                                  │           │
│  │ 1. RBAC filtering                                │           │
│  │    → get_entity_rbac_where_condition()           │           │
│  │                                                  │           │
│  │ 2. Query database (route owns SELECT query)     │           │
│  │                                                  │           │
│  │ 3. Resolve entity references                     │           │
│  │    → resolve_entity_references()                 │           │
│  │    → Adds _ID/_IDS metadata                      │           │
│  └──────────────────────────────────────────────────┘           │
│                         │                                       │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────┐           │
│  │ BACKEND FORMATTER SERVICE (NEW)                  │           │
│  │ apps/api/src/services/backend-formatter.service  │           │
│  │                                                  │           │
│  │ 4. Generate field metadata                       │           │
│  │    → getEntityMetadata('project')                │           │
│  │    → Analyzes column names                       │           │
│  │    → Applies pattern rules (35+)                 │           │
│  │    → Detects widgets (date-range, progress)      │           │
│  │    → Returns complete schema                     │           │
│  └──────────────────────────────────────────────────┘           │
│                         │                                       │
│                         ▼                                       │
│  5. Return data + metadata                                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API RESPONSE                                │
│  {                                                              │
│    "data": [                                                    │
│      {                                                          │
│        "id": "...",                                             │
│        "budget_allocated_amt": 50000,                           │
│        "budget_spent_amt": 20000,                               │
│        "dl__project_stage": "In Progress",                      │
│        "manager__employee_id": "uuid",                          │
│        "manager__employee_id_NAME": "John Smith"                │
│      }                                                          │
│    ],                                                           │
│    "metadata": {                  ← NEW: Backend-generated      │
│      "entity": "project",                                       │
│      "fields": [                                                │
│        {                                                        │
│          "key": "budget_allocated_amt",                         │
│          "type": "currency",                                    │
│          "label": "Budget Allocated",                           │
│          "format": { "symbol": "$", "decimals": 2 },            │
│          "editType": "number",                                  │
│          "viewType": "text",                                    │
│          "widget": {                                            │
│            "type": "progress-bar",                              │
│            "config": {                                          │
│              "maxField": "budget_allocated_amt",                │
│              "currentField": "budget_spent_amt",                │
│              "showPercentage": true,                            │
│              "color": "orange"                                  │
│            }                                                    │
│          },                                                     │
│          "editable": true,                                      │
│          "sortable": true,                                      │
│          "visible": true,                                       │
│          "align": "right"                                       │
│        },                                                       │
│        {                                                        │
│          "key": "dl__project_stage",                            │
│          "type": "badge",                                       │
│          "label": "Project Stage",                              │
│          "format": { "loadFromSettings": true },                │
│          "editType": "select",                                  │
│          "viewType": "badge",                                   │
│          "optionsEndpoint": "/api/v1/entity/project/...",       │
│          "editable": true                                       │
│        }                                                        │
│      ],                                                         │
│      "generated_at": "2025-01-19T12:00:00.000Z"                 │
│    }                                                            │
│  }                                                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              FRONTEND (React)                                   │
│  apps/web/src/lib/frontendFormatterService.ts                   │
│                                                                 │
│  ✅ SOLUTION: Frontend is pure executor                        │
│                                                                 │
│  1. loadMetadata(entityCode, response.metadata)                 │
│     → Cache metadata in React Query                             │
│                                                                 │
│  2. getFieldMetadata('project', 'budget_allocated_amt')         │
│     → Returns metadata from cache                               │
│                                                                 │
│  3. formatValue(50000, metadata)                                │
│     → Uses metadata.format rules → "$50,000.00"                 │
│                                                                 │
│  4. renderFieldView(value, metadata, rowData)                   │
│     → Checks metadata.widget                                    │
│     → If widget.type === 'progress-bar':                        │
│         → <ProgressBar                                          │
│             max={rowData.budget_allocated_amt}                  │
│             current={rowData.budget_spent_amt}                  │
│             config={metadata.widget.config} />                  │
│                                                                 │
│  ✅ BENEFITS:                                                   │
│  - No pattern detection (backend handles it)                    │
│  - Backend controls all formatting                              │
│  - Easy to add widgets (just metadata)                          │
│  - Consistent across all views                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Entity Infrastructure Service (UNCHANGED)

### Purpose

Centralized management of 4 infrastructure tables:
- `entity` - Entity type metadata
- `entity_instance` - Entity instance registry
- `entity_instance_link` - Parent-child relationships
- `entity_rbac` - Person-based permissions

### Key Methods (UNCHANGED)

```typescript
// RBAC
check_entity_rbac(userId, entityType, entityId, permission)
get_entity_rbac_where_condition(userId, entityType, permission, tableAlias)
set_entity_rbac_owner(userId, entityType, entityId)

// Entity Instance Registry
set_entity_instance_registry({ entity_type, entity_id, entity_name, entity_code })
update_entity_instance_registry(entityType, entityId, { entity_name, entity_code })
resolve_entity_references(data, entityType)  // Adds _ID/_IDS

// Entity Linkages
set_entity_instance_link({ parent_entity_type, parent_entity_id, child_entity_type, child_entity_id })
delete_entity_instance_link(...)

// Infrastructure Cleanup
delete_all_entity_infrastructure(entityType, entityId)
```

### What Does NOT Change

- ✅ **Routes still own their queries** - Entity Infrastructure Service provides RBAC helpers only
- ✅ **6-step create pattern** - Still used (RBAC → Parent check → Insert → Register → Owner → Link)
- ✅ **3-step update pattern** - Still used (RBAC → Update → Sync registry)
- ✅ **Reference resolution** - `_ID/_IDS` still added via `resolve_entity_references()`
- ✅ **All method signatures** - No breaking changes

---

## 4. Backend Formatter Service (NEW)

### Purpose

Generate field metadata from database column names using **convention over configuration**.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│           BACKEND FORMATTER SERVICE                             │
│  apps/api/src/services/backend-formatter.service.ts             │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ├──────────────────────────────────────┐
                         │                                      │
                         ▼                                      ▼
┌────────────────────────────────────┐  ┌─────────────────────────────────┐
│      PATTERN RULES (35+)           │  │     WIDGET RULES (3)            │
│                                    │  │                                 │
│  *_amt      → currency             │  │  [planned_start_date,           │
│  dl__*      → badge                │  │   planned_end_date]             │
│  *_date     → date                 │  │  → date-range-progress widget   │
│  *_ts       → timestamp            │  │                                 │
│  *__employee_id → reference        │  │  [estimated_hours,              │
│  *_flag     → boolean              │  │   actual_hours]                 │
│  *_url      → url                  │  │  → progress-bar widget          │
│  metadata   → json                 │  │                                 │
│  version    → readonly             │  │  [budget_allocated_amt,         │
│  ...                               │  │   budget_spent_amt]             │
└────────────────────────────────────┘  │  → progress-bar widget          │
                                        └─────────────────────────────────┘
```

### Field Metadata Structure

Each field gets complete metadata:

```typescript
{
  key: "budget_allocated_amt",        // Column name
  type: "currency",                   // Detected from pattern
  label: "Budget Allocated",          // Auto-generated from key
  format: {                           // Type-specific config
    symbol: "$",
    decimals: 2
  },
  editType: "number",                 // Form input type
  viewType: "text",                   // Table cell type
  widget: {                           // Advanced rendering
    type: "progress-bar",
    config: {
      maxField: "budget_allocated_amt",
      currentField: "budget_spent_amt",
      showPercentage: true,
      color: "orange"
    }
  },
  editable: true,                     // User can edit?
  sortable: true,                     // Table can sort?
  visible: true,                      // Show in default views?
  align: "right",                     // Table cell alignment
  optionsEndpoint: "/api/v1/..."      // For dropdowns
}
```

### Pattern Detection Logic

```typescript
// Example: "budget_allocated_amt"

1. matchPattern("budget_allocated_amt", "*_amt")  → TRUE
   ↓
2. Apply PATTERN_RULES["*_amt"]:
   {
     type: 'currency',
     format: { symbol: '$', decimals: 2 },
     editType: 'number',
     viewType: 'text',
     align: 'right'
   }
   ↓
3. generateLabel("budget_allocated_amt")
   → Remove "_amt" → "budget_allocated"
   → Title case → "Budget Allocated"
   ↓
4. Check WIDGET_RULES:
   Fields: ["budget_allocated_amt", "budget_spent_amt"] both exist?
   → YES → Attach progress-bar widget to "budget_spent_amt"
   ↓
5. Return complete FieldMetadata
```

### Example Field Metadata Output (Project Entity)

```json
{
  "entity": "project",
  "fields": [
    {
      "key": "budget_allocated_amt",
      "type": "currency",
      "label": "Budget Allocated",
      "format": { "symbol": "$", "decimals": 2 },
      "editType": "number",
      "viewType": "text",
      "widget": null,
      "editable": true,
      "sortable": true,
      "visible": true,
      "align": "right"
    },
    {
      "key": "budget_spent_amt",
      "type": "currency",
      "label": "Budget Spent",
      "format": { "symbol": "$", "decimals": 2 },
      "editType": "number",
      "viewType": "text",
      "widget": {
        "type": "progress-bar",
        "config": {
          "maxField": "budget_allocated_amt",
          "currentField": "budget_spent_amt",
          "showPercentage": true,
          "color": "orange"
        }
      },
      "editable": true,
      "align": "right"
    },
    {
      "key": "dl__project_stage",
      "type": "badge",
      "label": "Project Stage",
      "format": { "loadFromSettings": true },
      "editType": "select",
      "viewType": "badge",
      "widget": null,
      "optionsEndpoint": "/api/v1/entity/project/entity-instance-lookup",
      "editable": true
    },
    {
      "key": "planned_start_date",
      "type": "date",
      "label": "Planned Start",
      "format": { "style": "short" },
      "editType": "date",
      "viewType": "text",
      "widget": {
        "type": "date-range-progress",
        "config": {
          "startField": "planned_start_date",
          "endField": "planned_end_date",
          "showPercentage": true
        }
      },
      "editable": true
    },
    {
      "key": "manager__employee_id",
      "type": "reference",
      "label": "Manager",
      "format": { "entity": "employee" },
      "editType": "select",
      "viewType": "text",
      "widget": null,
      "optionsEndpoint": "/api/v1/entity/employee/entity-instance-lookup",
      "editable": true
    },
    {
      "key": "stakeholder__employee_ids",
      "type": "array-reference",
      "label": "Stakeholders",
      "format": { "entity": "employee" },
      "editType": "multiselect",
      "viewType": "tags",
      "widget": null,
      "optionsEndpoint": "/api/v1/entity/employee/entity-instance-lookup",
      "editable": true
    }
  ],
  "generated_at": "2025-01-19T12:00:00.000Z"
}
```

---

## 5. Frontend Formatter Service (SIMPLIFIED)

### Purpose

Execute rendering based on backend metadata. **No logic, just rendering**.

### What Changed?

| Old (v3.x) | New (v4.0) |
|------------|------------|
| `detectField(fieldKey)` → pattern matching | `getFieldMetadata(entityCode, fieldKey)` → cache lookup |
| `formatCurrency(value)` → hardcoded rules | `formatValue(value, metadata)` → uses metadata.format |
| `renderField()` → decides component | `renderFieldView(value, metadata)` → executes metadata instructions |
| 12 pattern rules in frontend | 0 patterns (all from backend) |

### New Methods

```typescript
// Load metadata from API response
loadMetadata(entityCode, metadata)
  → Cache in React Query

// Get field metadata (from cache)
getFieldMetadata(entityCode, fieldKey)
  → Returns FieldMetadata | null

// Format value (executes metadata.format rules)
formatValue(value, metadata)
  → Returns formatted string

// Render field (view mode)
renderFieldView(value, metadata, rowData)
  → Returns React element
  → Checks metadata.widget → renders custom component
  → Checks metadata.viewType → renders standard component

// Render field (edit mode)
renderFieldEdit(value, metadata, onChange)
  → Returns input element based on metadata.editType
```

### Example Usage in Components

```tsx
// EntityDataTable.tsx

import { loadMetadata, getFieldMetadata, renderFieldView } from '@/lib/frontendFormatterService';

function EntityDataTable({ entityCode, data, metadata }) {
  // Load metadata into cache
  useEffect(() => {
    if (metadata) {
      loadMetadata(entityCode, metadata);
    }
  }, [entityCode, metadata]);

  // Get visible fields
  const visibleFields = metadata?.fields.filter(f => f.visible) || [];

  return (
    <table>
      <thead>
        <tr>
          {visibleFields.map(field => (
            <th key={field.key} style={{ textAlign: field.align }}>
              {field.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, idx) => (
          <tr key={idx}>
            {visibleFields.map(field => {
              const fieldMeta = getFieldMetadata(entityCode, field.key);
              return (
                <td key={field.key} style={{ textAlign: field.align }}>
                  {/* Frontend just executes metadata instructions */}
                  {fieldMeta ? renderFieldView(row[field.key], fieldMeta, row) : row[field.key]}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## 6. Widget Components (NEW)

Custom React components for advanced rendering:

### DateRangeProgress Widget

Visualizes date range as progress bar:

```tsx
// apps/web/src/components/widgets/DateRangeProgress.tsx

export function DateRangeProgress({ metadata, rowData }) {
  const { startField, endField, showPercentage } = metadata.widget.config;

  const start = new Date(rowData[startField]);
  const end = new Date(rowData[endField]);
  const now = new Date();

  // Calculate percentage
  const total = end.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();
  const percentage = Math.min(100, Math.max(0, (elapsed / total) * 100));

  return (
    <div>
      <div className="progress-bar-bg">
        <div
          className="progress-bar-fill"
          style={{
            width: `${percentage}%`,
            backgroundColor: percentage > 100 ? 'red' : 'blue'
          }}
        />
      </div>
      {showPercentage && <span>{percentage.toFixed(1)}%</span>}
    </div>
  );
}
```

### ProgressBar Widget

Visualizes numeric progress (hours, budget, etc.):

```tsx
// apps/web/src/components/widgets/ProgressBar.tsx

export function ProgressBar({ metadata, rowData }) {
  const { maxField, currentField, showPercentage, color } = metadata.widget.config;

  const max = Number(rowData[maxField]);
  const current = Number(rowData[currentField]);
  const percentage = max > 0 ? (current / max) * 100 : 0;

  return (
    <div className="flex items-center gap-2">
      <div className="progress-bar-bg flex-1">
        <div
          className="progress-bar-fill"
          style={{
            width: `${Math.min(100, percentage)}%`,
            backgroundColor: percentage > 100 ? 'red' : color
          }}
        />
      </div>
      {showPercentage && <span>{percentage.toFixed(1)}%</span>}
    </div>
  );
}
```

---

## 7. Data Flow Comparison

### Old Flow (v3.x)

```
API: Return data only
  ↓
Frontend: Detect patterns → Apply formatting → Render
```

### New Flow (v4.0)

```
API: Analyze columns → Generate metadata → Return data + metadata
  ↓
Frontend: Load metadata → Execute rendering (no detection)
```

---

## 8. Benefits Summary

| Benefit | Description |
|---------|-------------|
| **Single Source of Truth** | Backend controls all field behavior |
| **Zero Frontend Config** | Add column to DB → Metadata auto-generates |
| **Consistent Formatting** | Same rules across all views (table, form, detail) |
| **Advanced Widgets** | Progress bars, timelines (view-specific) |
| **Easy to Extend** | Add pattern rule → Works everywhere |
| **Cache-Friendly** | Metadata cached per entity (fast) |
| **Type-Safe** | Full TypeScript support |
| **Backend Control** | Change formatting without frontend deploy |

---

## 9. Implementation Checklist

### Phase 1: Backend (2 days)
- [ ] Create `backend-formatter.service.ts`
- [ ] Implement pattern detection (35+ rules)
- [ ] Implement widget detection (3 rules)
- [ ] Add caching layer (in-memory → Redis)
- [ ] Unit tests for pattern matching

### Phase 2: Route Integration (1 day)
- [ ] Update `project/routes.ts` to include metadata
- [ ] Update `business/routes.ts`
- [ ] Update `task/routes.ts`
- [ ] Test API responses

### Phase 3: Frontend Service (1 day)
- [ ] Create `frontendFormatterService.ts`
- [ ] Implement metadata caching
- [ ] Implement formatValue() for all types
- [ ] Implement renderFieldView() for all viewTypes
- [ ] Implement renderFieldEdit() for all editTypes

### Phase 4: Widget Components (1 day)
- [ ] Create DateRangeProgress component
- [ ] Create ProgressBar component
- [ ] Create TagsList component
- [ ] Create JSONViewer component

### Phase 5: Component Integration (1 day)
- [ ] Update EntityDataTable to use metadata
- [ ] Update EntityFormContainer to use metadata
- [ ] Update FilteredDataTable
- [ ] Test all views (list, detail, form)

### Phase 6: Testing (1 day)
- [ ] End-to-end testing across all entities
- [ ] Performance testing (metadata caching)
- [ ] Edge case handling (missing fields, null values)
- [ ] Documentation updates

**Total Estimate**: 7 days

---

## 10. Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| Larger API payloads | Cache metadata separately; send once per entity |
| Breaking changes if patterns change | Version metadata schema; support fallbacks |
| Frontend complexity | Keep frontend as pure renderer; logic in backend |
| Performance overhead | Redis caching (5min TTL); pre-generate metadata |
| Migration effort | Start with opt-in; gradual rollout |

---

## 11. Questions & Answers

### Q: Does Entity Infrastructure Service change?
**A**: No. 100% unchanged. It continues to handle RBAC, linkage, registry, and reference resolution.

### Q: Do routes still own their queries?
**A**: Yes. Routes build their own SELECT/UPDATE/INSERT queries. Backend Formatter Service only generates metadata.

### Q: How does metadata get to frontend?
**A**: Routes call `getEntityMetadata(entityCode)` and include it in the response envelope.

### Q: What if metadata is wrong?
**A**: Backend has full control. Change pattern rules in one place → propagates everywhere.

### Q: What about custom formatting per entity?
**A**: Add entity-specific overrides in backend formatter service (e.g., special handling for `project.budget_allocated_amt`).

### Q: How do widgets work?
**A**: Backend detects multi-field patterns (e.g., `planned_start_date` + `planned_end_date`) and attaches widget config. Frontend renders custom component.

---

## 12. Next Steps

1. **Review**: Stakeholder review of design
2. **POC**: Implement for `project` entity only
3. **Test**: Validate metadata generation + rendering
4. **Rollout**: Extend to `business`, `task`, then all entities
5. **Docs**: Update CLAUDE.md and service docs

---

**End of Architecture Summary**
