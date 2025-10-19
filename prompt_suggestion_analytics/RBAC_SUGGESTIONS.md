# PMO Platform - Advanced RBAC Suggestions

> **Next-Generation Role-Based Access Control Architecture**
>
> Analysis Date: 2025-10-18
> Current RBAC Version: Array-Based Permissions v1.0

---

## Current RBAC Assessment

### Rating: **7.5/10** (Very Good Foundation)

### Current Strengths ✅

1. **Array-Based Permissions** - Flexible {0,1,2,3,4} system
2. **Type & Instance Level Control** - `entity_id='all'` vs UUID
3. **Temporal Support** - `expires_ts` for time-limited permissions
4. **Delegation Tracking** - `granted_by_empid` for audit trail
5. **Active Flag** - Soft revoke without deletion
6. **Comprehensive Coverage** - 16+ entity types
7. **SQL-Embedded Checks** - Performance-optimized queries

### Current Limitations ⚠️

1. **No Role Hierarchy** - Flat permission structure
2. **No Permission Inheritance** - Parent-child relationships not automatic
3. **No Attribute-Based Control** - Can't use user attributes (department, location)
4. **No Relationship-Based Access** - Can't grant based on relationships
5. **No Permission Caching** - Every check hits database
6. **Limited Delegation** - No delegation chains or restrictions
7. **No Conditional Permissions** - Can't have time-of-day, IP-based rules
8. **No Permission Templates** - Manual assignment for each user
9. **No Analytics** - No insights into permission usage
10. **No Ownership Concept** - Creator doesn't auto-own created entities

---

## Next-Generation RBAC Suggestions

### 1. Role Hierarchy with Permission Inheritance

**Problem:** Current system requires explicit permission grants for each entity type. No concept of roles or permission sets.

**Solution:** Hierarchical role system with automatic permission inheritance

**Implementation:**

```sql
-- New table: Role definitions
CREATE TABLE app.d_rbac_role (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code VARCHAR(50) UNIQUE NOT NULL,
  role_name VARCHAR(200) NOT NULL,
  parent_role_id UUID REFERENCES app.d_rbac_role(id),  -- Hierarchy support
  description TEXT,
  permission_template JSONB NOT NULL,  -- Default permissions for this role
  is_system_role BOOLEAN DEFAULT FALSE,  -- Built-in vs custom
  created_ts TIMESTAMPTZ DEFAULT NOW(),
  updated_ts TIMESTAMPTZ DEFAULT NOW()
);

-- Role hierarchy examples
INSERT INTO app.d_rbac_role (role_code, role_name, parent_role_id, permission_template, is_system_role) VALUES
-- Top level
('ADMIN', 'System Administrator', NULL, '{
  "project": {"all": [0,1,2,3,4]},
  "task": {"all": [0,1,2,3,4]},
  "employee": {"all": [0,1,2,3,4]}
}'::jsonb, TRUE),

-- Management hierarchy
('EXECUTIVE', 'Executive', NULL, '{
  "project": {"all": [0,1,2,4]},
  "task": {"all": [0,1,2]},
  "employee": {"all": [0,1]}
}'::jsonb, TRUE),

('DIRECTOR', 'Director', (SELECT id FROM app.d_rbac_role WHERE role_code = 'EXECUTIVE'), '{
  "project": {"all": [0,1,2,4]},
  "task": {"all": [0,1,2,4]},
  "employee": {"all": [0,1]}
}'::jsonb, TRUE),

('MANAGER', 'Manager', (SELECT id FROM app.d_rbac_role WHERE role_code = 'DIRECTOR'), '{
  "project": {"all": [0,1]},
  "task": {"all": [0,1,2,4]},
  "employee": {"all": [0]}
}'::jsonb, TRUE),

-- Operational roles
('PROJECT_MANAGER', 'Project Manager', (SELECT id FROM app.d_rbac_role WHERE role_code = 'MANAGER'), '{
  "project": {"all": [0,1]},
  "task": {"all": [0,1,2,4]},
  "wiki": {"all": [0,1,2,4]},
  "artifact": {"all": [0,1,2,4]}
}'::jsonb, TRUE),

('TEAM_LEAD', 'Team Lead', (SELECT id FROM app.d_rbac_role WHERE role_code = 'MANAGER'), '{
  "task": {"all": [0,1,2]},
  "wiki": {"all": [0,1]},
  "artifact": {"all": [0,1]}
}'::jsonb, TRUE),

('DEVELOPER', 'Developer', (SELECT id FROM app.d_rbac_role WHERE role_code = 'TEAM_LEAD'), '{
  "task": {"all": [0,1]},
  "wiki": {"all": [0,1]},
  "artifact": {"all": [0,1]}
}'::jsonb, TRUE);

-- Employee role assignments (replaces direct permission grants)
CREATE TABLE app.d_rbac_employee_role (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  role_id UUID NOT NULL REFERENCES app.d_rbac_role(id),
  scope_entity_type VARCHAR(50),  -- Optional: limit role to specific entity type
  scope_entity_id TEXT,  -- Optional: limit role to specific entity instance
  granted_by UUID,
  granted_ts TIMESTAMPTZ DEFAULT NOW(),
  expires_ts TIMESTAMPTZ,
  active_flag BOOLEAN DEFAULT TRUE,

  UNIQUE(employee_id, role_id, scope_entity_type, scope_entity_id)
);

-- Index for fast lookups
CREATE INDEX idx_employee_role_lookup ON app.d_rbac_employee_role(employee_id, active_flag);
```

**Permission Resolution with Inheritance:**

```typescript
// apps/api/src/lib/rbac/role-hierarchy.ts
export class RoleHierarchyService {
  // Get all permissions for an employee (including inherited)
  async getEmployeePermissions(employeeId: string): Promise<PermissionSet> {
    // 1. Get all roles assigned to employee
    const roles = await this.getEmployeeRoles(employeeId);

    // 2. For each role, get inherited roles up the hierarchy
    const allRoles = await this.expandRoleHierarchy(roles);

    // 3. Merge all permission templates
    const mergedPermissions = this.mergePermissions(allRoles);

    // 4. Add instance-specific permissions from entity_id_rbac_map
    const instancePermissions = await this.getInstancePermissions(employeeId);

    // 5. Combine and return
    return this.combinePermissions(mergedPermissions, instancePermissions);
  }

  // Get all roles up the hierarchy
  private async expandRoleHierarchy(roles: Role[]): Promise<Role[]> {
    const allRoles: Role[] = [...roles];
    const visited = new Set<string>();

    for (const role of roles) {
      if (visited.has(role.id)) continue;
      visited.add(role.id);

      // Recursively get parent roles
      let currentRole = role;
      while (currentRole.parent_role_id) {
        const parentRole = await this.getRole(currentRole.parent_role_id);
        if (!parentRole || visited.has(parentRole.id)) break;

        allRoles.push(parentRole);
        visited.add(parentRole.id);
        currentRole = parentRole;
      }
    }

    return allRoles;
  }

  // Merge permissions from multiple roles (union, most permissive wins)
  private mergePermissions(roles: Role[]): PermissionSet {
    const merged: PermissionSet = {};

    for (const role of roles) {
      const template = role.permission_template;

      for (const [entityType, permissions] of Object.entries(template)) {
        if (!merged[entityType]) {
          merged[entityType] = {};
        }

        for (const [scope, permArray] of Object.entries(permissions)) {
          if (!merged[entityType][scope]) {
            merged[entityType][scope] = new Set<number>();
          }

          // Union of permissions (most permissive)
          for (const perm of permArray as number[]) {
            merged[entityType][scope].add(perm);
          }
        }
      }
    }

    return merged;
  }

  // Check permission with role hierarchy
  async hasPermission(
    employeeId: string,
    entityType: string,
    entityId: string,
    action: PermissionLevel
  ): Promise<boolean> {
    const permissions = await this.getEmployeePermissions(employeeId);

    // Check instance-specific first (most specific)
    if (permissions[entityType]?.[entityId]?.has(action)) {
      return true;
    }

    // Check type-level (less specific)
    if (permissions[entityType]?.['all']?.has(action)) {
      return true;
    }

    return false;
  }
}
```

**Usage:**

```typescript
// apps/api/src/modules/project/routes.ts
import { RoleHierarchyService } from '@/lib/rbac/role-hierarchy.js';

const rbac = new RoleHierarchyService();

fastify.get('/api/v1/project', async (request, reply) => {
  const userId = request.user?.sub;

  // Check permission with role hierarchy
  const hasViewPermission = await rbac.hasPermission(
    userId,
    'project',
    'all',
    PermissionLevel.VIEW
  );

  if (!hasViewPermission) {
    return reply.status(403).send({ error: 'Access denied' });
  }

  // Fetch projects...
});
```

**Expected Impact:**
- Simplified permission management (assign role, not 100 individual permissions)
- Automatic inheritance (promote to Director = auto-gain Director permissions)
- Permission sets reusable across users
- Easier onboarding (assign role instead of configuring permissions)

---

### 2. Attribute-Based Access Control (ABAC)

**Problem:** Can't use user attributes (department, office, customer tier) for permission decisions.

**Solution:** ABAC rules engine for dynamic permission evaluation

**Implementation:**

```sql
-- ABAC policy rules
CREATE TABLE app.d_rbac_policy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_name VARCHAR(200) NOT NULL,
  policy_code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,

  -- Target: what this policy applies to
  target_entity_type VARCHAR(50) NOT NULL,
  target_action VARCHAR(20) NOT NULL,  -- view, edit, delete, etc.

  -- Conditions: when this policy applies (JSONB rule engine)
  conditions JSONB NOT NULL,

  -- Effect: allow or deny
  effect VARCHAR(10) NOT NULL CHECK (effect IN ('allow', 'deny')),

  -- Priority: higher priority policies evaluated first
  priority INTEGER DEFAULT 0,

  active_flag BOOLEAN DEFAULT TRUE,
  created_ts TIMESTAMPTZ DEFAULT NOW(),
  updated_ts TIMESTAMPTZ DEFAULT NOW()
);

-- Example policies
INSERT INTO app.d_rbac_policy (policy_name, policy_code, target_entity_type, target_action, conditions, effect, priority) VALUES
-- Policy 1: Employees can view projects in their department
('View Own Department Projects', 'VIEW_DEPT_PROJECTS', 'project', 'view', '{
  "conditions": {
    "and": [
      {
        "user_attribute": "department",
        "operator": "equals",
        "entity_attribute": "department"
      },
      {
        "entity_attribute": "active_flag",
        "operator": "equals",
        "value": true
      }
    ]
  }
}'::jsonb, 'allow', 100),

-- Policy 2: Managers can edit projects in their office
('Edit Office Projects', 'EDIT_OFFICE_PROJECTS', 'project', 'edit', '{
  "conditions": {
    "and": [
      {
        "user_attribute": "position_level",
        "operator": "greater_than_or_equal",
        "value": 5
      },
      {
        "user_attribute": "office_id",
        "operator": "equals",
        "entity_attribute": "office_id"
      }
    ]
  }
}'::jsonb, 'allow', 90),

-- Policy 3: Enterprise customers can access premium features
('Enterprise Premium Access', 'ENTERPRISE_PREMIUM', 'report', 'view', '{
  "conditions": {
    "and": [
      {
        "user_attribute": "customer_tier",
        "operator": "in",
        "value": ["enterprise", "premium"]
      },
      {
        "entity_attribute": "report_type",
        "operator": "equals",
        "value": "premium"
      }
    ]
  }
}'::jsonb, 'allow', 80),

-- Policy 4: Deny after business hours (9 AM - 5 PM)
('Business Hours Only', 'BUSINESS_HOURS', 'employee', 'edit', '{
  "conditions": {
    "or": [
      {
        "context_attribute": "current_hour",
        "operator": "less_than",
        "value": 9
      },
      {
        "context_attribute": "current_hour",
        "operator": "greater_than",
        "value": 17
      }
    ]
  }
}'::jsonb, 'deny', 200),

-- Policy 5: IP whitelist for sensitive operations
('IP Whitelist Sensitive Ops', 'IP_WHITELIST', 'employee', 'delete', '{
  "conditions": {
    "context_attribute": "ip_address",
    "operator": "not_in",
    "value": ["192.168.1.0/24", "10.0.0.0/8"]
  }
}'::jsonb, 'deny', 300);
```

**ABAC Policy Evaluation Engine:**

```typescript
// apps/api/src/lib/rbac/abac-engine.ts
export interface PolicyContext {
  user: {
    id: string;
    email: string;
    department: string;
    office_id: string;
    position_level: number;
    customer_tier: string;
    roles: string[];
  };
  entity?: {
    id: string;
    type: string;
    attributes: Record<string, any>;
  };
  context: {
    ip_address: string;
    current_hour: number;
    current_day: string;
    user_agent: string;
  };
}

export class ABACEngine {
  // Evaluate all policies for a given action
  async evaluateAccess(
    context: PolicyContext,
    entityType: string,
    action: string
  ): Promise<{ allowed: boolean; reason: string }> {
    // Fetch applicable policies
    const policies = await this.getPolicies(entityType, action);

    // Sort by priority (highest first)
    policies.sort((a, b) => b.priority - a.priority);

    // Evaluate policies in order
    for (const policy of policies) {
      const result = await this.evaluatePolicy(policy, context);

      if (result.matches) {
        if (policy.effect === 'deny') {
          return {
            allowed: false,
            reason: `Denied by policy: ${policy.policy_name}`,
          };
        }

        if (policy.effect === 'allow') {
          return {
            allowed: true,
            reason: `Allowed by policy: ${policy.policy_name}`,
          };
        }
      }
    }

    // Default deny if no policy matched
    return {
      allowed: false,
      reason: 'No matching policy found (default deny)',
    };
  }

  // Evaluate single policy against context
  private async evaluatePolicy(
    policy: Policy,
    context: PolicyContext
  ): Promise<{ matches: boolean }> {
    const conditions = policy.conditions.conditions;

    return this.evaluateConditionGroup(conditions, context);
  }

  // Evaluate condition group (AND/OR)
  private async evaluateConditionGroup(
    group: any,
    context: PolicyContext
  ): Promise<{ matches: boolean }> {
    if (group.and) {
      // All conditions must match
      for (const condition of group.and) {
        const result = await this.evaluateCondition(condition, context);
        if (!result.matches) {
          return { matches: false };
        }
      }
      return { matches: true };
    }

    if (group.or) {
      // At least one condition must match
      for (const condition of group.or) {
        const result = await this.evaluateCondition(condition, context);
        if (result.matches) {
          return { matches: true };
        }
      }
      return { matches: false };
    }

    // Single condition
    return this.evaluateCondition(group, context);
  }

  // Evaluate single condition
  private async evaluateCondition(
    condition: any,
    context: PolicyContext
  ): Promise<{ matches: boolean }> {
    let leftValue: any;
    let rightValue: any;

    // Get left value
    if (condition.user_attribute) {
      leftValue = context.user[condition.user_attribute];
    } else if (condition.entity_attribute && context.entity) {
      leftValue = context.entity.attributes[condition.entity_attribute];
    } else if (condition.context_attribute) {
      leftValue = context.context[condition.context_attribute];
    }

    // Get right value
    if (condition.value !== undefined) {
      rightValue = condition.value;
    } else if (condition.entity_attribute) {
      rightValue = context.entity?.attributes[condition.entity_attribute];
    } else if (condition.user_attribute) {
      rightValue = context.user[condition.user_attribute];
    }

    // Apply operator
    const matches = this.applyOperator(leftValue, condition.operator, rightValue);

    return { matches };
  }

  // Apply comparison operator
  private applyOperator(left: any, operator: string, right: any): boolean {
    switch (operator) {
      case 'equals':
        return left === right;
      case 'not_equals':
        return left !== right;
      case 'greater_than':
        return left > right;
      case 'less_than':
        return left < right;
      case 'greater_than_or_equal':
        return left >= right;
      case 'less_than_or_equal':
        return left <= right;
      case 'in':
        return Array.isArray(right) && right.includes(left);
      case 'not_in':
        return Array.isArray(right) && !right.includes(left);
      case 'contains':
        return String(left).includes(String(right));
      case 'starts_with':
        return String(left).startsWith(String(right));
      case 'ends_with':
        return String(left).endsWith(String(right));
      case 'matches_regex':
        return new RegExp(right).test(String(left));
      default:
        return false;
    }
  }
}
```

**Usage in API:**

```typescript
// apps/api/src/modules/project/routes.ts
import { ABACEngine } from '@/lib/rbac/abac-engine.js';

const abac = new ABACEngine();

fastify.get('/api/v1/project/:id', async (request, reply) => {
  const userId = request.user?.sub;
  const { id: projectId } = request.params;

  // Fetch user context
  const user = await getUserContext(userId);

  // Fetch project entity
  const project = await getProject(projectId);

  // Evaluate ABAC policies
  const result = await abac.evaluateAccess(
    {
      user,
      entity: {
        id: projectId,
        type: 'project',
        attributes: project,
      },
      context: {
        ip_address: request.ip,
        current_hour: new Date().getHours(),
        current_day: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
        user_agent: request.headers['user-agent'] || '',
      },
    },
    'project',
    'view'
  );

  if (!result.allowed) {
    return reply.status(403).send({
      error: 'Access denied',
      reason: result.reason,
    });
  }

  return { data: project };
});
```

**Expected Impact:**
- Dynamic, context-aware permissions
- No code changes for new rules
- Time-based, location-based, attribute-based access control
- Reduced manual permission assignments (automatic based on attributes)

---

### 3. Relationship-Based Access Control (ReBAC)

**Problem:** Can't grant permissions based on relationships (e.g., "project manager can view all tasks in their projects").

**Solution:** ReBAC graph-based permission system

**Implementation:**

```sql
-- Relationship-based permission rules
CREATE TABLE app.d_rbac_relationship_rule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name VARCHAR(200) NOT NULL,
  rule_code VARCHAR(50) UNIQUE NOT NULL,

  -- Source: who is requesting access
  source_entity_type VARCHAR(50) NOT NULL,  -- 'employee'

  -- Target: what they want to access
  target_entity_type VARCHAR(50) NOT NULL,  -- 'task'

  -- Relationship path: how they're connected
  relationship_path JSONB NOT NULL,  -- Graph traversal rules

  -- Granted permissions
  granted_permissions INTEGER[] NOT NULL,

  active_flag BOOLEAN DEFAULT TRUE,
  created_ts TIMESTAMPTZ DEFAULT NOW()
);

-- Example: Project managers can edit all tasks in their projects
INSERT INTO app.d_rbac_relationship_rule (rule_name, rule_code, source_entity_type, target_entity_type, relationship_path, granted_permissions) VALUES
('Project Manager Task Access', 'PM_TASK_ACCESS', 'employee', 'task', '{
  "path": [
    {
      "entity": "project",
      "relationship": "manager_employee_id",
      "direction": "reverse"
    },
    {
      "entity": "task",
      "relationship": "project_id",
      "direction": "forward"
    }
  ]
}'::jsonb, ARRAY[0,1,2]::integer[]),

-- Example: Business unit directors can view all projects in their business
('Director Business Projects', 'DIR_BIZ_PROJECTS', 'employee', 'project', '{
  "path": [
    {
      "entity": "business",
      "relationship": "director_employee_id",
      "direction": "reverse"
    },
    {
      "entity": "project",
      "relationship": "business_id",
      "direction": "forward"
    }
  ]
}'::jsonb, ARRAY[0]::integer[]),

-- Example: Task assignees can view and edit their assigned tasks
('Task Assignee Access', 'ASSIGNEE_TASK', 'employee', 'task', '{
  "path": [
    {
      "entity": "task",
      "relationship": "assignee_employee_ids",
      "direction": "reverse",
      "match_type": "array_contains"
    }
  ]
}'::jsonb, ARRAY[0,1]::integer[]);
```

**ReBAC Graph Traversal Engine:**

```typescript
// apps/api/src/lib/rbac/rebac-engine.ts
export class ReBACEngine {
  // Check if user has permission via relationship
  async hasRelationshipPermission(
    employeeId: string,
    entityType: string,
    entityId: string,
    action: PermissionLevel
  ): Promise<boolean> {
    // Get all relationship rules for this entity type
    const rules = await this.getRelationshipRules('employee', entityType);

    for (const rule of rules) {
      // Check if rule grants this permission
      if (!rule.granted_permissions.includes(action)) {
        continue;
      }

      // Traverse relationship path
      const hasRelationship = await this.traversePath(
        employeeId,
        entityId,
        rule.relationship_path.path
      );

      if (hasRelationship) {
        return true;
      }
    }

    return false;
  }

  // Traverse relationship path from source to target
  private async traversePath(
    sourceId: string,
    targetId: string,
    path: RelationshipPathStep[]
  ): Promise<boolean> {
    let currentIds = [sourceId];

    for (const step of path) {
      const nextIds: string[] = [];

      for (const currentId of currentIds) {
        const related = await this.getRelatedEntities(
          currentId,
          step.entity,
          step.relationship,
          step.direction,
          step.match_type
        );

        nextIds.push(...related);
      }

      currentIds = nextIds;

      if (currentIds.length === 0) {
        return false;
      }
    }

    // Check if target is in final set
    return currentIds.includes(targetId);
  }

  // Get related entities via relationship
  private async getRelatedEntities(
    entityId: string,
    entityType: string,
    relationship: string,
    direction: 'forward' | 'reverse',
    matchType: 'equals' | 'array_contains' = 'equals'
  ): Promise<string[]> {
    const table = `app.d_${entityType}`;

    if (direction === 'forward') {
      // Follow relationship from entity to related
      const result = await db.execute(sql`
        SELECT ${relationship} as related_id
        FROM ${table}
        WHERE id = ${entityId}
      `);

      if (result.length === 0) return [];

      const relatedId = result[0].related_id;

      if (matchType === 'array_contains') {
        // Relationship is an array (e.g., assignee_employee_ids)
        return Array.isArray(relatedId) ? relatedId : [];
      }

      return [relatedId];
    } else {
      // Reverse: find entities that reference this entity
      if (matchType === 'array_contains') {
        // Entity ID is in an array field
        const result = await db.execute(sql`
          SELECT id
          FROM ${table}
          WHERE ${entityId} = ANY(${relationship})
        `);

        return result.map(r => r.id);
      } else {
        // Normal foreign key
        const result = await db.execute(sql`
          SELECT id
          FROM ${table}
          WHERE ${relationship} = ${entityId}
        `);

        return result.map(r => r.id);
      }
    }
  }
}
```

**Combined Permission Check (RBAC + ABAC + ReBAC):**

```typescript
// apps/api/src/lib/rbac/unified-permission-check.ts
export class UnifiedPermissionService {
  constructor(
    private roleHierarchy: RoleHierarchyService,
    private abac: ABACEngine,
    private rebac: ReBACEngine
  ) {}

  async hasPermission(
    employeeId: string,
    entityType: string,
    entityId: string,
    action: PermissionLevel,
    context: PolicyContext
  ): Promise<{ allowed: boolean; reason: string; method: string }> {
    // 1. Check role-based permissions (fastest)
    const rolePermission = await this.roleHierarchy.hasPermission(
      employeeId,
      entityType,
      entityId,
      action
    );

    if (rolePermission) {
      return {
        allowed: true,
        reason: 'Granted via role hierarchy',
        method: 'RBAC',
      };
    }

    // 2. Check relationship-based permissions
    const relationshipPermission = await this.rebac.hasRelationshipPermission(
      employeeId,
      entityType,
      entityId,
      action
    );

    if (relationshipPermission) {
      return {
        allowed: true,
        reason: 'Granted via relationship',
        method: 'ReBAC',
      };
    }

    // 3. Check attribute-based policies
    const abacResult = await this.abac.evaluateAccess(
      context,
      entityType,
      actionToString(action)
    );

    if (abacResult.allowed) {
      return {
        allowed: true,
        reason: abacResult.reason,
        method: 'ABAC',
      };
    }

    // 4. Default deny
    return {
      allowed: false,
      reason: 'No permission grants found',
      method: 'NONE',
    };
  }
}
```

**Expected Impact:**
- Automatic permissions based on organizational relationships
- Reduced manual permission assignments
- More intuitive permission model ("managers manage their teams")
- Easier to understand and audit

---

### 4. Permission Caching Strategy

**Problem:** Every permission check hits database, causing performance bottleneck.

**Solution:** Multi-layer permission cache with invalidation

**Implementation:**

```typescript
// apps/api/src/lib/rbac/permission-cache.ts
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
});

export class PermissionCache {
  // L1: In-memory cache (30 seconds)
  private memCache = new Map<string, { permissions: Set<string>; expiry: number }>();

  // L2: Redis cache (5 minutes)
  async hasPermission(
    employeeId: string,
    entityType: string,
    entityId: string,
    action: PermissionLevel
  ): Promise<boolean | null> {
    const cacheKey = this.getCacheKey(employeeId, entityType, entityId);

    // Check L1 (in-memory)
    const memCached = this.memCache.get(cacheKey);
    if (memCached && memCached.expiry > Date.now()) {
      return memCached.permissions.has(action.toString());
    }

    // Check L2 (Redis)
    const redisCached = await redis.get(cacheKey);
    if (redisCached) {
      const permissions = new Set(JSON.parse(redisCached));

      // Populate L1
      this.memCache.set(cacheKey, {
        permissions,
        expiry: Date.now() + 30000,
      });

      return permissions.has(action.toString());
    }

    return null; // Cache miss
  }

  // Cache permission result
  async setPermissions(
    employeeId: string,
    entityType: string,
    entityId: string,
    permissions: PermissionLevel[]
  ): Promise<void> {
    const cacheKey = this.getCacheKey(employeeId, entityType, entityId);
    const permSet = new Set(permissions.map(p => p.toString()));

    // Set L1 (in-memory, 30 seconds)
    this.memCache.set(cacheKey, {
      permissions: permSet,
      expiry: Date.now() + 30000,
    });

    // Set L2 (Redis, 5 minutes)
    await redis.setex(
      cacheKey,
      300,
      JSON.stringify(Array.from(permSet))
    );
  }

  // Invalidate cache when permissions change
  async invalidate(employeeId: string, entityType?: string): Promise<void> {
    if (entityType) {
      // Invalidate specific entity type
      const pattern = `perm:${employeeId}:${entityType}:*`;
      await this.invalidatePattern(pattern);
    } else {
      // Invalidate all permissions for employee
      const pattern = `perm:${employeeId}:*`;
      await this.invalidatePattern(pattern);
    }
  }

  // Invalidate by pattern
  private async invalidatePattern(pattern: string): Promise<void> {
    // Clear L1
    for (const key of this.memCache.keys()) {
      if (this.matchPattern(key, pattern)) {
        this.memCache.delete(key);
      }
    }

    // Clear L2 (Redis)
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  private getCacheKey(employeeId: string, entityType: string, entityId: string): string {
    return `perm:${employeeId}:${entityType}:${entityId}`;
  }

  private matchPattern(key: string, pattern: string): boolean {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(key);
  }
}

export const permissionCache = new PermissionCache();
```

**Cached Permission Check:**

```typescript
// apps/api/src/lib/rbac/cached-permission-service.ts
export class CachedPermissionService {
  constructor(
    private unifiedPermission: UnifiedPermissionService,
    private cache: PermissionCache
  ) {}

  async hasPermission(
    employeeId: string,
    entityType: string,
    entityId: string,
    action: PermissionLevel,
    context: PolicyContext
  ): Promise<boolean> {
    // Check cache first
    const cached = await this.cache.hasPermission(
      employeeId,
      entityType,
      entityId,
      action
    );

    if (cached !== null) {
      return cached;
    }

    // Cache miss, check permission
    const result = await this.unifiedPermission.hasPermission(
      employeeId,
      entityType,
      entityId,
      action,
      context
    );

    // Cache result (cache all permissions, not just the one checked)
    const allPermissions = await this.unifiedPermission.getAllPermissions(
      employeeId,
      entityType,
      entityId,
      context
    );

    await this.cache.setPermissions(
      employeeId,
      entityType,
      entityId,
      allPermissions
    );

    return result.allowed;
  }
}
```

**Cache Invalidation on Permission Change:**

```typescript
// apps/api/src/modules/rbac/routes.ts
fastify.post('/api/v1/rbac/grant', async (request, reply) => {
  const { employeeId, entityType, entityId, permissions } = request.body;

  // Grant permission
  await grantPermission(employeeId, entityType, entityId, permissions);

  // Invalidate cache
  await permissionCache.invalidate(employeeId, entityType);

  return { message: 'Permission granted' };
});
```

**Expected Impact:**
- 90-95% cache hit rate
- 10-50x faster permission checks
- Reduced database load
- Sub-millisecond permission checks

---

### 5. Automatic Ownership on Create

**Problem:** Creator doesn't automatically own created entities.

**Solution:** Auto-grant ownership permissions on entity creation

**Implementation:**

```typescript
// apps/api/src/lib/rbac/ownership.ts
export class OwnershipService {
  // Auto-grant ownership permissions
  async grantOwnership(
    employeeId: string,
    entityType: string,
    entityId: string
  ): Promise<void> {
    // Owner gets full permissions except Create (that's type-level)
    const ownerPermissions = [
      PermissionLevel.VIEW,
      PermissionLevel.EDIT,
      PermissionLevel.SHARE,
      PermissionLevel.DELETE,
    ];

    await grantPermission(employeeId, entityType, entityId, ownerPermissions);

    // Record ownership in audit log
    await auditLogger.log({
      eventType: AuditEventType.PERMISSION_GRANTED,
      userId: employeeId,
      userEmail: null,
      ipAddress: '127.0.0.1',
      userAgent: 'system',
      resource: entityType,
      resourceId: entityId,
      action: 'grant_ownership',
      success: true,
      metadata: {
        permissions: ownerPermissions,
        reason: 'auto_ownership',
      },
    });
  }

  // Check if user is owner
  async isOwner(employeeId: string, entityType: string, entityId: string): Promise<boolean> {
    const result = await db.execute(sql`
      SELECT 1
      FROM app.entity_id_rbac_map
      WHERE empid = ${employeeId}
        AND entity = ${entityType}
        AND entity_id = ${entityId}
        AND active_flag = true
        AND granted_by_empid = ${employeeId}
        AND ARRAY[0,1,2,3] <@ permission  -- Has view, edit, share, delete
    `);

    return result.length > 0;
  }
}
```

**Auto-grant on Creation:**

```typescript
// apps/api/src/modules/project/routes.ts
import { OwnershipService } from '@/lib/rbac/ownership.js';

const ownership = new OwnershipService();

fastify.post('/api/v1/project', async (request, reply) => {
  const userId = request.user?.sub;
  const { name, code, ...rest } = request.body;

  // Create project
  const result = await db.execute(sql`
    INSERT INTO app.d_project (code, name, created_by_user_id, ...)
    VALUES (${code}, ${name}, ${userId}, ...)
    RETURNING id
  `);

  const projectId = result[0].id;

  // Auto-grant ownership
  await ownership.grantOwnership(userId, 'project', projectId);

  return { id: projectId };
});
```

**Expected Impact:**
- No manual permission assignment needed
- Creators automatically manage their entities
- Clear ownership concept
- Audit trail of who created what

---

### 6. Permission Delegation & Sharing

**Problem:** Users can't delegate permissions or share entities with specific users.

**Solution:** Delegation chains with restrictions

**Implementation:**

```sql
-- Add delegation constraints
ALTER TABLE app.entity_id_rbac_map
ADD COLUMN can_delegate BOOLEAN DEFAULT FALSE,
ADD COLUMN delegation_depth INTEGER DEFAULT 0,
ADD COLUMN max_delegation_depth INTEGER DEFAULT 3;

-- Track delegation chains
CREATE TABLE app.d_rbac_delegation_chain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_id UUID NOT NULL REFERENCES app.entity_id_rbac_map(id),
  delegator_employee_id UUID NOT NULL,
  delegatee_employee_id UUID NOT NULL,
  delegation_level INTEGER NOT NULL,
  created_ts TIMESTAMPTZ DEFAULT NOW()
);
```

**Delegation Service:**

```typescript
// apps/api/src/lib/rbac/delegation.ts
export class DelegationService {
  // Delegate permission to another user
  async delegate(
    delegatorId: string,
    delegateeId: string,
    entityType: string,
    entityId: string,
    permissions: PermissionLevel[],
    canDelegate: boolean = false
  ): Promise<{ success: boolean; reason?: string }> {
    // 1. Check if delegator has permission
    const delegatorPermissions = await getEmployeeEntityPermissions(
      delegatorId,
      entityType,
      entityId
    );

    if (!delegatorPermissions.includes(PermissionLevel.SHARE)) {
      return {
        success: false,
        reason: 'You do not have SHARE permission to delegate this access',
      };
    }

    // 2. Check if delegator can delegate
    const delegatorPermission = await this.getPermissionRecord(
      delegatorId,
      entityType,
      entityId
    );

    if (!delegatorPermission.can_delegate) {
      return {
        success: false,
        reason: 'You do not have delegation rights',
      };
    }

    // 3. Check delegation depth
    if (delegatorPermission.delegation_depth >= delegatorPermission.max_delegation_depth) {
      return {
        success: false,
        reason: 'Maximum delegation depth reached',
      };
    }

    // 4. Grant permission with increased delegation depth
    await db.execute(sql`
      INSERT INTO app.entity_id_rbac_map (
        empid, entity, entity_id, permission, granted_by_empid,
        can_delegate, delegation_depth, max_delegation_depth
      ) VALUES (
        ${delegateeId},
        ${entityType},
        ${entityId},
        ${permissions},
        ${delegatorId},
        ${canDelegate},
        ${delegatorPermission.delegation_depth + 1},
        ${delegatorPermission.max_delegation_depth}
      )
    `);

    // 5. Record delegation chain
    await db.execute(sql`
      INSERT INTO app.d_rbac_delegation_chain (
        permission_id, delegator_employee_id, delegatee_employee_id, delegation_level
      ) VALUES (
        (SELECT id FROM app.entity_id_rbac_map
         WHERE empid = ${delegateeId} AND entity = ${entityType} AND entity_id = ${entityId}),
        ${delegatorId},
        ${delegateeId},
        ${delegatorPermission.delegation_depth + 1}
      )
    `);

    return { success: true };
  }

  // Revoke delegated permission (and all sub-delegations)
  async revokeDelegation(
    delegatorId: string,
    delegateeId: string,
    entityType: string,
    entityId: string
  ): Promise<void> {
    // Get delegation chain
    const chain = await this.getDelegationChain(delegateeId, entityType, entityId);

    // Revoke all permissions in chain
    for (const delegation of chain) {
      await revokePermission(delegation.delegatee_employee_id, entityType, entityId);
    }

    // Revoke main delegation
    await revokePermission(delegateeId, entityType, entityId);
  }

  // Get delegation chain
  private async getDelegationChain(
    employeeId: string,
    entityType: string,
    entityId: string
  ): Promise<any[]> {
    // Recursive query to find all sub-delegations
    const result = await db.execute(sql`
      WITH RECURSIVE delegation_tree AS (
        SELECT
          dc.id,
          dc.delegator_employee_id,
          dc.delegatee_employee_id,
          dc.delegation_level
        FROM app.d_rbac_delegation_chain dc
        INNER JOIN app.entity_id_rbac_map rbac
          ON dc.permission_id = rbac.id
        WHERE rbac.empid = ${employeeId}
          AND rbac.entity = ${entityType}
          AND rbac.entity_id = ${entityId}

        UNION ALL

        SELECT
          dc.id,
          dc.delegator_employee_id,
          dc.delegatee_employee_id,
          dc.delegation_level
        FROM app.d_rbac_delegation_chain dc
        INNER JOIN delegation_tree dt
          ON dc.delegator_employee_id = dt.delegatee_employee_id
      )
      SELECT * FROM delegation_tree
    `);

    return result;
  }
}
```

**Share API Endpoint:**

```typescript
// apps/api/src/modules/project/routes.ts
fastify.post('/api/v1/project/:id/share', async (request, reply) => {
  const userId = request.user?.sub;
  const { id: projectId } = request.params;
  const { employeeIds, permissions, canDelegate } = request.body;

  const delegation = new DelegationService();

  for (const employeeId of employeeIds) {
    const result = await delegation.delegate(
      userId,
      employeeId,
      'project',
      projectId,
      permissions,
      canDelegate
    );

    if (!result.success) {
      return reply.status(403).send({ error: result.reason });
    }
  }

  return { message: `Project shared with ${employeeIds.length} users` };
});
```

**Expected Impact:**
- User-friendly sharing (like Google Docs)
- Controlled delegation (max depth)
- Auto-revoke sub-delegations
- Clear delegation audit trail

---

### 7. RBAC Analytics & Insights

**Problem:** No visibility into permission usage, over-permissioning, or unused permissions.

**Solution:** RBAC analytics dashboard

**Implementation:**

```typescript
// apps/api/src/modules/rbac/analytics.ts
export class RBACAnalytics {
  // Get permission usage stats
  async getPermissionUsageStats(
    employeeId?: string,
    entityType?: string
  ): Promise<PermissionUsageStats> {
    const stats = await db.execute(sql`
      SELECT
        rbac.entity,
        rbac.entity_id,
        rbac.permission,
        COUNT(*) FILTER (WHERE audit.success = true) as successful_uses,
        COUNT(*) FILTER (WHERE audit.success = false) as failed_uses,
        MAX(audit.timestamp) as last_used,
        MIN(audit.timestamp) as first_used
      FROM app.entity_id_rbac_map rbac
      LEFT JOIN app.audit_log audit
        ON audit.user_id = rbac.empid
        AND audit.resource = rbac.entity
        AND audit.resource_id = rbac.entity_id
      WHERE ${employeeId ? sql`rbac.empid = ${employeeId}` : sql`true`}
        AND ${entityType ? sql`rbac.entity = ${entityType}` : sql`true`}
        AND rbac.active_flag = true
      GROUP BY rbac.entity, rbac.entity_id, rbac.permission
    `);

    return stats;
  }

  // Find unused permissions (granted but never used)
  async getUnusedPermissions(daysThreshold: number = 90): Promise<UnusedPermission[]> {
    const result = await db.execute(sql`
      SELECT
        rbac.empid,
        e.email,
        e.name,
        rbac.entity,
        rbac.entity_id,
        rbac.permission,
        rbac.granted_ts,
        rbac.granted_by_empid
      FROM app.entity_id_rbac_map rbac
      INNER JOIN app.d_employee e ON rbac.empid = e.id
      LEFT JOIN app.audit_log audit
        ON audit.user_id = rbac.empid
        AND audit.resource = rbac.entity
        AND audit.resource_id = rbac.entity_id
        AND audit.timestamp > rbac.granted_ts
      WHERE rbac.active_flag = true
        AND rbac.granted_ts < NOW() - INTERVAL '${daysThreshold} days'
        AND audit.id IS NULL
      ORDER BY rbac.granted_ts ASC
    `);

    return result;
  }

  // Find over-permissioned users (too many permissions)
  async getOverPermissionedUsers(threshold: number = 50): Promise<OverPermissionedUser[]> {
    const result = await db.execute(sql`
      SELECT
        rbac.empid,
        e.email,
        e.name,
        COUNT(DISTINCT rbac.entity || ':' || rbac.entity_id) as permission_count,
        ARRAY_AGG(DISTINCT rbac.entity) as entities
      FROM app.entity_id_rbac_map rbac
      INNER JOIN app.d_employee e ON rbac.empid = e.id
      WHERE rbac.active_flag = true
      GROUP BY rbac.empid, e.email, e.name
      HAVING COUNT(DISTINCT rbac.entity || ':' || rbac.entity_id) > ${threshold}
      ORDER BY permission_count DESC
    `);

    return result;
  }

  // Find permission conflicts (user has both deny and allow policies)
  async getPermissionConflicts(): Promise<PermissionConflict[]> {
    // Check ABAC policies for conflicts
    const result = await db.execute(sql`
      SELECT
        p1.policy_name as allow_policy,
        p2.policy_name as deny_policy,
        p1.target_entity_type,
        p1.target_action,
        p1.conditions as allow_conditions,
        p2.conditions as deny_conditions
      FROM app.d_rbac_policy p1
      CROSS JOIN app.d_rbac_policy p2
      WHERE p1.target_entity_type = p2.target_entity_type
        AND p1.target_action = p2.target_action
        AND p1.effect = 'allow'
        AND p2.effect = 'deny'
        AND p1.active_flag = true
        AND p2.active_flag = true
    `);

    return result;
  }

  // Get permission grant timeline
  async getPermissionTimeline(
    employeeId: string,
    entityType?: string
  ): Promise<PermissionTimelineEvent[]> {
    const result = await db.execute(sql`
      SELECT
        rbac.entity,
        rbac.entity_id,
        rbac.permission,
        rbac.granted_ts as timestamp,
        'granted' as event_type,
        e.name as granted_by_name
      FROM app.entity_id_rbac_map rbac
      LEFT JOIN app.d_employee e ON rbac.granted_by_empid = e.id
      WHERE rbac.empid = ${employeeId}
        ${entityType ? sql`AND rbac.entity = ${entityType}` : sql``}

      UNION ALL

      SELECT
        audit.resource as entity,
        audit.resource_id as entity_id,
        NULL as permission,
        audit.timestamp,
        'revoked' as event_type,
        e.name as granted_by_name
      FROM app.audit_log audit
      LEFT JOIN app.d_employee e ON audit.user_id = e.id
      WHERE audit.event_type = 'authz.permission.revoked'
        AND audit.metadata->>'target_employee_id' = ${employeeId}
        ${entityType ? sql`AND audit.resource = ${entityType}` : sql``}

      ORDER BY timestamp DESC
    `);

    return result;
  }
}
```

**Analytics API Endpoints:**

```typescript
// apps/api/src/modules/rbac/analytics-routes.ts
fastify.get('/api/v1/rbac/analytics/unused', {
  preHandler: [fastify.authenticate, requireAdmin],
}, async (request, reply) => {
  const { days } = request.query;

  const analytics = new RBACAnalytics();
  const unused = await analytics.getUnusedPermissions(days || 90);

  return {
    data: unused,
    total: unused.length,
    message: `Found ${unused.length} unused permissions (not used in ${days || 90} days)`,
  };
});

fastify.get('/api/v1/rbac/analytics/over-permissioned', {
  preHandler: [fastify.authenticate, requireAdmin],
}, async (request, reply) => {
  const { threshold } = request.query;

  const analytics = new RBACAnalytics();
  const overPermissioned = await analytics.getOverPermissionedUsers(threshold || 50);

  return {
    data: overPermissioned,
    total: overPermissioned.length,
  };
});
```

**Expected Impact:**
- Identify unused permissions (security risk)
- Detect over-permissioned users
- Find permission conflicts
- Compliance reporting
- Permission lifecycle insights

---

## Implementation Priority

### Phase 1 (Immediate - Month 1)
1. **Permission Caching** → 90% performance boost
2. **Automatic Ownership** → Better UX
3. **Role Hierarchy** → Simplified management

### Phase 2 (Short-term - Months 2-3)
4. **ReBAC** → Relationship-based access
5. **Delegation & Sharing** → User empowerment
6. **RBAC Analytics** → Visibility

### Phase 3 (Medium-term - Months 4-6)
7. **ABAC** → Dynamic, context-aware permissions
8. **Advanced Delegation** → Controlled sharing
9. **Permission Templates** → Faster onboarding

---

**Document Version:** 1.0
**Last Updated:** 2025-10-18
**Current RBAC Rating:** 7.5/10
**Target RBAC Rating:** 9.5/10 (after all improvements)
