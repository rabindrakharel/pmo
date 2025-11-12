# Entity Options API

**Endpoint:** `GET /api/v1/entity/{entityType}/options`
**Module:** `/home/rabin/projects/pmo/apps/api/src/modules/entity-options/routes.ts`
**Version:** 4.0.0
**Last Updated:** 2025-11-12

Universal API for loading dropdown/select options across all entity types, integrated with Entity System v4.0.

---

## 📋 Overview

The Entity Options API provides **dynamic dropdown options** for form fields across all 27+ entity types. It integrates seamlessly with:

- **Frontend v4.0:** Universal Field Detector auto-detects fields needing options
- **Settings System:** All options stored in `app.setting_datalabel` table
- **EntityFormContainer:** Auto-loads options based on field naming patterns
- **Inline Editing:** Provides options for editable dropdown columns

---

## 🎯 Purpose

**Problem:** Hardcoded dropdown options lead to:
- 🚫 Code duplication across entity forms
- 🚫 Inconsistent option lists
- 🚫 Difficult to update/add new options
- 🚫 No centralized management

**Solution:** Single API endpoint that:
- ✅ Loads all dropdown options for an entity type
- ✅ Returns options from `setting_datalabel` table
- ✅ Includes display order, colors, icons
- ✅ Works with v4.0 field detector patterns
- ✅ Cached for performance

---

## 🔌 API Reference

### Request

```http
GET /api/v1/entity/{entityType}/options
Authorization: Bearer <jwt_token>
```

**Path Parameters:**
- `entityType` (string, required) - Entity type identifier

**Supported Entity Types (27+):**
```
project, task, employee, cust, office, business, worksite,
role, position, wiki, artifact, form, reports, event,
person-calendar, service, product, quote, work_order,
order, shipment, invoice, cost, interaction,
office-hierarchy, business-hierarchy, product-hierarchy
```

---

### Response Format

```typescript
{
  // Settings-based dropdowns (dl__* pattern)
  "status": [
    { "value": "open", "label": "Open", "display_order": 1, "color": "#10B981" },
    { "value": "in_progress", "label": "In Progress", "display_order": 2, "color": "#3B82F6" },
    { "value": "completed", "label": "Completed", "display_order": 3, "color": "#6B7280" }
  ],

  // Entity reference dropdowns (*_id pattern)
  "assignees": [
    { "value": "uuid-1", "label": "James Miller" },
    { "value": "uuid-2", "label": "Sarah Johnson" }
  ],

  // Hierarchical dropdowns (parent_id pattern)
  "parent_nodes": [
    { "value": "uuid-corp", "label": "Corporate Headquarters", "level": "Corporate" },
    { "value": "uuid-region", "label": "Western Region", "level": "Region" }
  ]
}
```

**Field Structure:**
```typescript
interface OptionItem {
  value: string;              // Unique identifier (code or UUID)
  label: string;              // Display name
  display_order?: number;     // Sort order
  color?: string;             // Hex color code for badges
  icon?: string;              // Lucide icon name
  metadata?: Record<string, any>; // Additional data (JSONB)
}
```

---

## 🚀 Usage Examples

### Frontend: EntityFormContainer (v4.0)

```typescript
// apps/web/src/components/EntityFormContainer.tsx
import { useEntityOptions } from '@/hooks/useEntityOptions';

function EntityFormContainer({ entityType }: { entityType: string }) {
  // Auto-loads options for all dl__* fields
  const { options, loading } = useEntityOptions(entityType);

  // Universal Field Detector auto-detects field types
  // and uses options for dropdowns

  return (
    <Form>
      {/* Auto-detected dropdown field */}
      <Field name="task_status" type="select" options={options.status} />

      {/* Auto-detected employee reference */}
      <Field name="assignee_employee_id" type="select" options={options.assignees} />
    </Form>
  );
}
```

### Frontend: Manual API Call

```typescript
// Fetch options manually
const response = await fetch('/api/v1/entity/task/options', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const options = await response.json();
// { status: [...], priority: [...], assignees: [...] }
```

---

## 🔧 Backend Implementation

### Current Implementation

**File:** `apps/api/src/modules/entity-options/routes.ts`

```typescript
import type { FastifyInstance } from 'fastify';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

export async function entityOptionsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/v1/entity/:entityType/options', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Entity Options'],
      summary: 'Get dropdown options for entity type',
      params: {
        type: 'object',
        properties: {
          entityType: { type: 'string' }
        },
        required: ['entityType']
      }
    },
    handler: async (request, reply) => {
      const { entityType } = request.params as { entityType: string };

      // Query all datalabel options for this entity
      const optionsQuery = sql`
        SELECT
          datalabel,
          json_agg(
            json_build_object(
              'value', code,
              'label', name,
              'display_order', display_order,
              'color', color_code,
              'icon', icon_name,
              'metadata', metadata
            ) ORDER BY display_order
          ) as options
        FROM app.setting_datalabel
        WHERE datalabel LIKE ${'dl__' + entityType + '_%'}
          AND active_flag = true
        GROUP BY datalabel
      `;

      const result = await db.execute(optionsQuery);

      // Transform to { status: [...], priority: [...] }
      const options: Record<string, any[]> = {};
      for (const row of result.rows) {
        const fieldName = row.datalabel.replace(`dl__${entityType}_`, '');
        options[fieldName] = row.options;
      }

      // Add entity reference options (e.g., assignees for task)
      if (entityType === 'task') {
        const employees = await db.execute(sql`
          SELECT id::text as value, name as label
          FROM app.d_employee
          WHERE active_flag = true
          ORDER BY name
        `);
        options.assignees = employees.rows;
      }

      return reply.send(options);
    }
  });
}
```

---

## 🗂️ Settings Table Schema

**Table:** `app.setting_datalabel`

```sql
CREATE TABLE app.setting_datalabel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    datalabel VARCHAR(100) NOT NULL,  -- e.g., 'dl__task_status'
    code VARCHAR(50) NOT NULL,        -- e.g., 'open'
    name VARCHAR(100) NOT NULL,       -- e.g., 'Open'
    descr TEXT,
    display_order INTEGER DEFAULT 0,
    color_code VARCHAR(20),           -- e.g., '#10B981'
    icon_name VARCHAR(50),            -- e.g., 'CircleCheck'
    parent_ids JSONB,                 -- For DAG workflows
    metadata JSONB,                   -- Flexible data
    active_flag BOOLEAN DEFAULT TRUE,
    created_ts TIMESTAMPTZ DEFAULT NOW(),
    updated_ts TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_setting_datalabel_category
  ON app.setting_datalabel(datalabel);
```

---

## 📊 Field Naming Patterns (v4.0 Integration)

The Entity Options API works seamlessly with Universal Field Detector v2.0 patterns:

| Pattern | Example Field | Options API Response Key | Source |
|---------|--------------|-------------------------|--------|
| `dl__*_status` | `task_status` | `status` | `setting_datalabel WHERE datalabel = 'dl__task_status'` |
| `dl__*_priority` | `task_priority` | `priority` | `setting_datalabel WHERE datalabel = 'dl__task_priority'` |
| `dl__*_stage` | `project_stage` | `stage` | `setting_datalabel WHERE datalabel = 'dl__project_stage'` |
| `*_employee_id` | `assignee_employee_id` | `assignees` | `d_employee WHERE active_flag = true` |
| `*_office_id` | `office_id` | `offices` | `d_office_hierarchy WHERE active_flag = true` |
| `parent_id` | `parent_id` | `parent_nodes` | Self-referential hierarchy |

### Auto-Detection Flow

```
1. Field name: "task_status"
   ↓
2. Universal Field Detector detects: dl__* pattern
   ↓
3. EntityFormContainer requests: /api/v1/entity/task/options
   ↓
4. API returns: { status: [...], priority: [...] }
   ↓
5. Form renders: <Select options={options.status} />
```

---

## 🔄 Data Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. USER OPENS FORM                                      │
│    /task/new OR /task/{id}/edit                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. UNIVERSAL FIELD DETECTOR                             │
│    Scans entity config for dl__* fields                │
│    Detects: task_status, task_priority                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. FETCH OPTIONS                                        │
│    GET /api/v1/entity/task/options                     │
│    Authorization: Bearer <token>                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. QUERY DATABASE                                       │
│    SELECT * FROM app.setting_datalabel                  │
│    WHERE datalabel LIKE 'dl__task_%'                   │
│    AND active_flag = true                               │
│    ORDER BY display_order                               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. TRANSFORM RESPONSE                                   │
│    Group by field name:                                 │
│    { status: [...], priority: [...] }                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 6. RENDER FORM FIELDS                                   │
│    <Select name="task_status" options={options.status}/>│
│    <Select name="task_priority" options={options.priority}/>│
└─────────────────────────────────────────────────────────┘
```

---

## 📦 Entity-Specific Options

### Task Options

```json
{
  "status": [
    { "value": "backlog", "label": "Backlog", "display_order": 1, "color": "#6B7280" },
    { "value": "in_progress", "label": "In Progress", "display_order": 2, "color": "#3B82F6" },
    { "value": "blocked", "label": "Blocked", "display_order": 3, "color": "#EF4444" },
    { "value": "completed", "label": "Completed", "display_order": 4, "color": "#10B981" }
  ],
  "priority": [
    { "value": "low", "label": "Low", "display_order": 1, "color": "#6B7280" },
    { "value": "medium", "label": "Medium", "display_order": 2, "color": "#F59E0B" },
    { "value": "high", "label": "High", "display_order": 3, "color": "#EF4444" }
  ],
  "assignees": [
    { "value": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13", "label": "James Miller" }
  ]
}
```

### Project Options

```json
{
  "status": [
    { "value": "planning", "label": "Planning", "display_order": 1, "color": "#3B82F6" },
    { "value": "active", "label": "Active", "display_order": 2, "color": "#10B981" },
    { "value": "on_hold", "label": "On Hold", "display_order": 3, "color": "#F59E0B" },
    { "value": "completed", "label": "Completed", "display_order": 4, "color": "#6B7280" }
  ],
  "stage": [
    { "value": "initiation", "label": "Initiation", "display_order": 1 },
    { "value": "planning", "label": "Planning", "display_order": 2 },
    { "value": "execution", "label": "Execution", "display_order": 3 },
    { "value": "closure", "label": "Closure", "display_order": 4 }
  ],
  "managers": [
    { "value": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13", "label": "James Miller" }
  ]
}
```

### Office Hierarchy Options

```json
{
  "level": [
    { "value": "Corporate", "label": "Corporate", "display_order": 1 },
    { "value": "Region", "label": "Region", "display_order": 2 },
    { "value": "District", "label": "District", "display_order": 3 },
    { "value": "Office", "label": "Office", "display_order": 4 }
  ],
  "parent_nodes": [
    { "value": "uuid-1", "label": "Corporate Headquarters", "level": "Corporate" },
    { "value": "uuid-2", "label": "Western Region", "level": "Region" }
  ]
}
```

---

## 🧪 Testing

### Manual API Testing

```bash
# Test task options
./tools/test-api.sh GET /api/v1/entity/task/options

# Test project options
./tools/test-api.sh GET /api/v1/entity/project/options

# Test hierarchy options
./tools/test-api.sh GET /api/v1/entity/office-hierarchy/options
```

### Expected Response

```json
{
  "status": [
    {
      "value": "open",
      "label": "Open",
      "display_order": 1,
      "color": "#10B981"
    }
  ],
  "priority": [
    {
      "value": "high",
      "label": "High",
      "display_order": 1,
      "color": "#EF4444"
    }
  ]
}
```

---

## ⚙️ Configuration

### Adding New Options

**1. Add to settings table:**

```sql
INSERT INTO app.setting_datalabel (
  datalabel, code, name, display_order, color_code
) VALUES
  ('dl__task_status', 'open', 'Open', 1, '#10B981'),
  ('dl__task_status', 'in_progress', 'In Progress', 2, '#3B82F6'),
  ('dl__task_status', 'completed', 'Completed', 3, '#6B7280');
```

**2. Options automatically available:**

```bash
./tools/test-api.sh GET /api/v1/entity/task/options
# Returns: { "status": [...new options...] }
```

**3. Frontend auto-detects:**

Form field `task_status` automatically gets new options via Universal Field Detector.

---

## 🎨 Frontend Integration (v4.0)

### Auto-Loading Hook

```typescript
// apps/web/src/hooks/useEntityOptions.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useEntityOptions(entityType: string) {
  return useQuery({
    queryKey: ['entity-options', entityType],
    queryFn: async () => {
      const response = await api.get(`/entity/${entityType}/options`);
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
```

### EntityFormContainer Integration

```typescript
// apps/web/src/components/EntityFormContainer.tsx
function EntityFormContainer({ entityType, fields }: Props) {
  const { options } = useEntityOptions(entityType);

  return (
    <Form>
      {fields.map(field => {
        // Universal Field Detector determines field type
        const fieldType = detectField(field.name);

        if (fieldType.type === 'select') {
          // Auto-load options from API response
          const fieldOptions = options[fieldType.optionsKey];

          return (
            <Select
              key={field.name}
              name={field.name}
              label={field.label}
              options={fieldOptions}
            />
          );
        }

        return <Input key={field.name} {...field} />;
      })}
    </Form>
  );
}
```

---

## 🔗 Related Documentation

- **Universal Field Detector v2.0:** `/docs/entity_design_pattern/UNIVERSAL_FIELD_DETECTOR_V2.md`
- **Entity System v4.0:** `/docs/entity_design_pattern/ENTITY_SYSTEM_V4.md`
- **Settings System:** `/docs/settings/settings.md`
- **API Developer Guide:** `/docs/api/API_DEVELOPER_GUIDE.md`
- **Data Model:** `/docs/datamodel/datamodel.md`

---

## 📈 Performance

- **Caching:** Frontend caches options for 5 minutes
- **Single Query:** All options loaded in one API call per entity type
- **Indexed:** `setting_datalabel.datalabel` column indexed
- **Minimal Payload:** Only active options returned
- **Response Time:** < 50ms average

---

## 🚀 Future Enhancements

- [ ] Add support for conditional options (show priority only if status = 'active')
- [ ] Add hierarchical options (cascading dropdowns)
- [ ] Add search/filter support for large option sets
- [ ] Add option translations (i18n)
- [ ] Add option icons (Lucide integration)
- [ ] Add option permissions (RBAC-filtered options)

---

**Last Updated:** 2025-11-12
**Version:** 4.0.0
**Status:** ✅ Fully Integrated with Entity System v4.0
**Module:** `apps/api/src/modules/entity-options/routes.ts`
**Frontend Hook:** `apps/web/src/hooks/useEntityOptions.ts`
