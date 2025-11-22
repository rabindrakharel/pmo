# Anti-Patterns & Prevention Strategies

**Last Updated**: 2025-01-19
**Version**: 1.0

---

## Critical Anti-Patterns to NEVER Repeat

### ❌ **ANTI-PATTERN #1: Hardcoded Entity Lists**

**Example of What NOT to Do**:
```typescript
// ❌ WRONG - Hardcoded list
const leafEntities = new Set([
  'work_order', 'artifact', 'wiki', 'interaction', 'event',
  'booking', 'cost', 'invoice', 'payment', 'quote'
]);

if (leafEntities.has(parentEntity)) {
  // special handling
}
```

**Why This is Dangerous**:
1. ⚠️ **Breaks Scalability** - Requires manual update for every new entity
2. ⚠️ **Hidden Dependencies** - Code breaks silently when entities added
3. ⚠️ **Violates DRY** - Duplicates information already in database
4. ⚠️ **No Single Source of Truth** - Database says one thing, code says another
5. ⚠️ **Maintenance Burden** - Developers must remember to update multiple places

**Correct Approach (Data-Driven)**:
```typescript
// ✅ CORRECT - Data-driven from database metadata
const result = await db.execute(sql`
  SELECT child_entity_codes
  FROM app.entity
  WHERE code = ${parentEntity}
`);

const childEntities = result[0]?.child_entity_codes || [];

if (childEntities.length === 0) {
  // Leaf entity - empty array is intentional
  return;
}
```

**Principle**:
> **Database schema is the ONLY source of truth. Never hardcode what can be queried.**

---

### ❌ **ANTI-PATTERN #2: Hardcoded Field Names**

**Example of What NOT to Do**:
```typescript
// ❌ WRONG - Hardcoded field checks
const CURRENCY_FIELDS = ['budget_allocated_amt', 'budget_spent_amt', 'total_cost'];
if (CURRENCY_FIELDS.includes(fieldName)) {
  return formatCurrency(value);
}
```

**Correct Approach (Convention-Based)**:
```typescript
// ✅ CORRECT - Convention over configuration
if (fieldName.endsWith('_amt') || fieldName.endsWith('_price') || fieldName.endsWith('_cost')) {
  return formatCurrency(value);
}

// Even better: Use pattern matching with fallback
const isCurrencyField = (fieldName: string) =>
  /_amt$|_price$|_cost$|_budget$|_total$/i.test(fieldName);
```

**Principle**:
> **Use naming conventions and pattern matching, not hardcoded lists.**

---

### ❌ **ANTI-PATTERN #3: Hardcoded Entity Types**

**Example of What NOT to Do**:
```typescript
// ❌ WRONG - Hardcoded type checks
const HIERARCHICAL_ENTITIES = ['office', 'business', 'product'];
if (HIERARCHICAL_ENTITIES.includes(entityType)) {
  // hierarchical logic
}
```

**Correct Approach (Metadata-Driven)**:
```typescript
// ✅ CORRECT - Check metadata from entity table
const result = await db.execute(sql`
  SELECT entity_code_category
  FROM app.entity
  WHERE code = ${entityType}
`);

const isHierarchical = result[0]?.entity_code_category === 'hierarchical';
```

**Principle**:
> **Entity characteristics should be stored in entity metadata, not in code.**

---

### ❌ **ANTI-PATTERN #4: Feature Flags by Entity Name**

**Example of What NOT to Do**:
```typescript
// ❌ WRONG - Hardcoded feature flags
const ENTITIES_WITH_WORKFLOWS = ['project', 'task', 'opportunity'];
if (ENTITIES_WITH_WORKFLOWS.includes(entityCode)) {
  enableWorkflowFeature();
}
```

**Correct Approach (Configuration-Driven)**:
```typescript
// ✅ CORRECT - Check entity configuration
const result = await db.execute(sql`
  SELECT metadata->>'has_workflow' as has_workflow
  FROM app.entity
  WHERE code = ${entityCode}
`);

if (result[0]?.has_workflow === 'true') {
  enableWorkflowFeature();
}
```

**Principle**:
> **Feature availability should be in entity metadata, not hardcoded in code.**

---

## Prevention Strategies

### 1. **Code Review Checklist**

Before merging ANY code, check for:
- [ ] No hardcoded entity names (search for `new Set\([`)
- [ ] No hardcoded field names (search for `const.*FIELDS = \[`)
- [ ] No hardcoded type checks (search for `includes\(entityType\)`)
- [ ] All entity logic driven by database metadata
- [ ] Convention-based pattern matching used

### 2. **Grep Commands for Detection**

Run these before every commit:
```bash
# Detect hardcoded entity lists
grep -rn "new Set\(\[" apps/api/src --include="*.ts" | grep -i "entity\|type"

# Detect hardcoded field arrays
grep -rn "const.*FIELDS.*=.*\[" apps/api/src --include="*.ts"

# Detect entity name string literals in conditionals
grep -rn "=== ['\"]\(project\|task\|employee\)" apps/api/src --include="*.ts"
```

### 3. **Architecture Principles**

**Golden Rules**:
1. ✅ **Single Source of Truth** - Database schema, not code
2. ✅ **Convention Over Configuration** - Naming patterns, not lists
3. ✅ **Metadata-Driven** - Query entity table, don't hardcode
4. ✅ **Pattern Matching** - Regex for fields, not string arrays
5. ✅ **Data-Driven Logic** - If statement checks database, not constants

**Test for Anti-Patterns**:
```typescript
// Ask yourself:
// "If I add a new entity to the database, will this code still work?"
// If the answer is NO → You have a hardcoded anti-pattern

// Example:
const leafEntities = new Set(['work_order', 'artifact']);
// Add new entity 'inspection' to database...
// ❌ Code breaks! Must manually update the Set!

// Correct approach:
if (childEntities.length === 0) { /* leaf entity */ }
// Add new entity 'inspection' with empty child_entity_codes...
// ✅ Code still works! No changes needed!
```

---

## When is Hardcoding Acceptable?

**ONLY for true system constants**:

```typescript
// ✅ ACCEPTABLE - System-level constraints
const MAX_FILE_SIZE_MB = 50;
const SESSION_TIMEOUT_MINUTES = 30;
const API_VERSION = 'v1';

// ✅ ACCEPTABLE - Infrastructure tables (never change)
const INFRASTRUCTURE_TABLES = ['entity', 'entity_instance', 'entity_instance_link', 'entity_rbac'];

// ✅ ACCEPTABLE - Permission levels (part of RBAC model)
const Permission = {
  VIEW: 0,
  COMMENT: 1,
  EDIT: 3,
  SHARE: 4,
  DELETE: 5,
  CREATE: 6,
  OWNER: 7
} as const;
```

**NOT acceptable for**:
- ❌ Entity names
- ❌ Field names
- ❌ Entity types/categories
- ❌ Feature flags
- ❌ Business logic conditions

---

## Real-World Example (Incident Report)

**Date**: 2025-01-19
**Issue**: Hardcoded leaf entity list

**What Happened**:
```typescript
// Code added:
const leafEntities = new Set([
  'work_order', 'artifact', 'wiki', 'interaction', 'event',
  'booking', 'cost', 'invoice', 'payment', 'quote'
]);
```

**Problem**:
- New entity `inspection` added to database with empty children
- Code failed to recognize it as leaf entity
- Logs showed unexpected warnings
- Developer had to manually add `inspection` to hardcoded list

**Fix Applied**:
```typescript
// Removed hardcoded list, now data-driven:
if (childCodes.length === 0) {
  // Leaf entity - empty child_entity_codes is intentional
  return;
}
```

**Lesson**:
> Database metadata already tells us if an entity has children. Query it, don't hardcode it.

---

## Enforcement Mechanism

### Pre-Commit Hook (Recommended)

Create `.git/hooks/pre-commit`:
```bash
#!/bin/bash

# Detect hardcoded entity patterns
if git diff --cached --name-only | grep -q '\.ts$'; then
  VIOLATIONS=$(git diff --cached | grep -E "new Set\(\['(project|task|employee|work_order)")

  if [ ! -z "$VIOLATIONS" ]; then
    echo "❌ ERROR: Hardcoded entity list detected!"
    echo "$VIOLATIONS"
    echo ""
    echo "Use database metadata instead of hardcoded lists."
    exit 1
  fi
fi

exit 0
```

### CI/CD Check

Add to GitHub Actions:
```yaml
- name: Check for Anti-Patterns
  run: |
    if grep -rn "new Set\(\[.*entity" apps/api/src --include="*.ts"; then
      echo "❌ Hardcoded entity list detected"
      exit 1
    fi
```

---

### ❌ **ANTI-PATTERN #5: Frontend Pattern Detection**

**Example of What NOT to Do**:
```typescript
// ❌ WRONG - Frontend doing pattern detection
function detectFieldType(fieldName: string) {
  if (fieldName.endsWith('_amt')) return 'currency';
  if (fieldName.startsWith('dl__')) return 'badge';
  if (fieldName.endsWith('_date')) return 'date';
  return 'text';
}

// Render based on frontend detection
const renderField = (key, value) => {
  const type = detectFieldType(key);  // ❌ Frontend making decisions!
  if (type === 'currency') return <span>${formatCurrency(value)}</span>;
  if (type === 'badge') return <Badge>{value}</Badge>;
  return <span>{value}</span>;
};
```

**Why This is Dangerous**:
1. ⚠️ **Duplicate Logic** - Backend AND frontend both detecting field types
2. ⚠️ **Inconsistency Risk** - Frontend and backend patterns can drift apart
3. ⚠️ **No Single Source of Truth** - Two places making the same decision
4. ⚠️ **Hard to Maintain** - Changes require updating both backend and frontend
5. ⚠️ **No Centralized Control** - Can't change rendering without frontend deploy

**Correct Approach (Metadata-Driven)**:
```typescript
// ✅ CORRECT - Frontend consumes backend metadata
import { renderViewModeFromMetadata } from '@/lib/universalFormatterService';

// Backend sends complete rendering instructions
const response = await api.get('/api/v1/office');
const { data, metadata } = response;

// Frontend executes backend instructions exactly
metadata.fields.map(fieldMeta => ({
  key: fieldMeta.key,
  title: fieldMeta.label,
  render: (value, record) => renderViewModeFromMetadata(value, fieldMeta, record)
}));
```

**Principle**:
> **Backend generates metadata, frontend renders. Never duplicate pattern detection logic.**

---

### ❌ **ANTI-PATTERN #6: Hardcoded Field Rendering Logic**

**Example of What NOT to Do**:
```typescript
// ❌ WRONG - Hardcoded field-specific rendering
const renderCell = (key: string, value: any) => {
  switch (key) {
    case 'budget_allocated_amt':
    case 'budget_spent_amt':
    case 'total_cost':
      return <span className="font-mono">${formatCurrency(value)}</span>;

    case 'dl__project_stage':
    case 'dl__task_priority':
      return <Badge color="blue">{value}</Badge>;

    case 'start_date':
    case 'end_date':
    case 'deadline_date':
      return <span>{formatDate(value)}</span>;

    default:
      return <span>{value}</span>;
  }
};
```

**Why This is Dangerous**:
1. ⚠️ **Breaks Scalability** - Every new field requires code changes
2. ⚠️ **Violates DRY** - Field names already tell us the type (`_amt` → currency)
3. ⚠️ **Maintenance Nightmare** - Switch statement grows infinitely
4. ⚠️ **No Configuration** - Can't change rendering without code deploy

**Correct Approach (Convention-Based + Metadata)**:
```typescript
// ✅ CORRECT - Convention-driven metadata from backend
const response = await api.get('/api/v1/project');
const fieldMeta = response.metadata.fields.find(f => f.key === 'budget_allocated_amt');

// Backend tells us: renderType: 'currency', format: { symbol: '$', decimals: 2 }
const rendered = renderViewModeFromMetadata(50000, fieldMeta);
// Returns: <span className="font-mono">$50,000.00</span>

// Add new field to database: "revenue_total_amt"
// ✅ Backend auto-detects as currency (pattern: *_amt)
// ✅ Frontend auto-renders with $ symbol
// ✅ ZERO code changes needed!
```

**Principle**:
> **Use convention-based metadata from backend, not hardcoded switch statements.**

---

### ❌ **ANTI-PATTERN #7: Frontend Component Selection Logic**

**Example of What NOT to Do**:
```typescript
// ❌ WRONG - Frontend deciding which component to use
const renderField = (key: string, value: any) => {
  // Hardcoded component selection
  if (key === 'metadata') {
    return <MetadataTable data={value} />;
  }
  if (key === 'dl__project_stage' || key === 'dl__sales_funnel') {
    return <DAGVisualizer value={value} />;
  }
  if (key.endsWith('_date') && key.includes('start') && data.end_date) {
    return <DateRangeVisualizer start={value} end={data.end_date} />;
  }
  return <TextDisplay value={value} />;
};
```

**Why This is Dangerous**:
1. ⚠️ **Frontend Making Business Decisions** - Which component to use is business logic
2. ⚠️ **Hard to Configure** - Can't change components without code deploy
3. ⚠️ **Duplicates Backend Knowledge** - Backend already knows field semantics
4. ⚠️ **Not Extensible** - Adding new components requires frontend changes

**Correct Approach (Backend-Specified Components)**:
```typescript
// ✅ CORRECT - Backend tells frontend which component to use
// Backend metadata:
{
  "key": "metadata",
  "renderType": "json",
  "component": "MetadataTable"  // ← Backend specifies component
}

{
  "key": "dl__project_stage",
  "renderType": "badge",
  "component": "DAGVisualizer"  // ← Backend specifies component
}

// Frontend just follows instructions:
const renderComponent = (fieldMeta: BackendFieldMetadata, value: any) => {
  switch (fieldMeta.component) {
    case 'MetadataTable':
      return <MetadataTable data={value} />;
    case 'DAGVisualizer':
      return <DAGVisualizer value={value} />;
    case 'DateRangeVisualizer':
      return <DateRangeVisualizer {...fieldMeta.format} />;
    default:
      return renderViewModeFromMetadata(value, fieldMeta);
  }
};
```

**Principle**:
> **Backend specifies components via metadata.component, frontend executes.**

---

## Summary

| Anti-Pattern | Detection | Prevention |
|--------------|-----------|------------|
| #1: Hardcoded entity lists | `grep "new Set\(\[.*entity"` | Use database queries for child_entity_codes |
| #2: Hardcoded field names | `grep "FIELDS = \["` | Use pattern matching (convention-based) |
| #3: Hardcoded entity types | `grep "=== 'project'"` | Use entity metadata queries |
| #4: Feature flags by name | `grep "includes(entity"` | Use entity.metadata column |
| #5: Frontend pattern detection | `grep "detectField\|endsWith.*_amt"` in frontend | Use backend metadata (renderViewModeFromMetadata) |
| #6: Hardcoded field rendering | `grep "switch.*key.*case.*'budget"` | Use backend metadata + convention |
| #7: Frontend component selection | `grep "if.*key.*===.*'metadata'"` | Backend specifies via metadata.component |

**Core Principles**:
> 1. **If it can be queried from the database, it should NEVER be hardcoded in the application.**
>
> 2. **Backend generates metadata, frontend renders. No pattern detection in frontend.**
>
> 3. **Convention over configuration. Column names determine behavior.**

---

**End of Document**
