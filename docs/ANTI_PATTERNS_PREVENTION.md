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
  SELECT entity_type_category
  FROM app.entity
  WHERE code = ${entityType}
`);

const isHierarchical = result[0]?.entity_type_category === 'hierarchical';
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

## Summary

| Anti-Pattern | Detection | Prevention |
|--------------|-----------|------------|
| Hardcoded entity lists | `grep "new Set\(\["` | Use database queries |
| Hardcoded field arrays | `grep "FIELDS = \["` | Use pattern matching |
| String literal checks | `grep "=== 'project'"` | Use metadata queries |
| Feature flags by name | `grep "includes(entity"` | Use entity.metadata |

**Core Principle**:
> **If it can be queried from the database, it should NEVER be hardcoded in the application.**

---

**End of Document**
