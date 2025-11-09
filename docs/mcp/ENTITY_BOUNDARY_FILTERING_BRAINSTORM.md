# Entity Boundary → Tool Filtering: Declarative Approaches

> **Brainstorm Date:** 2025-11-09
> **Context:** Exploring declarative patterns for filtering MCP tools based on entity boundary configuration
> **Goal:** Reduce coupling, improve maintainability, enable dynamic tool scoping

---

## 📊 Current Implementation Analysis

### How It Works Now

**1. Entity Boundary Determination** (`worker-mcp-agent.service.ts`):
```typescript
private determineEntityBoundary(state: AgentContextState): string[] {
  const entityBoundaryConfig = this.agentProfile.entity_boundary;

  // Start with defaults: ["Customer", "Task", "Employee", "Calendar", "Settings"]
  let entities = new Set<string>(entityBoundaryConfig.default_entities);

  // Apply expansion rules based on context
  if (extracted.service?.catalog_match && expansionRules.if_service_catalog_matched) {
    expansionRules.if_service_catalog_matched.add_entities.forEach(e => entities.add(e));
  }

  return Array.from(entities); // Returns: ["Customer", "Task", "Product", "Sales"]
}
```

**2. Tool Filtering** (`mcp-adapter.service.ts`):
```typescript
export function getMCPTools(options?: {
  categories?: string[];  // Entity boundary strings
  includeEndpoints?: string[];
  excludeEndpoints?: string[];
  maxTools?: number;
}): ChatCompletionTool[] {
  let endpoints = API_MANIFEST;

  // Direct string match: endpoint.category === "Customer"
  if (options?.categories) {
    endpoints = endpoints.filter(e => options.categories!.includes(e.category));
  }

  return endpoints.map(endpointToOpenAITool);
}
```

**3. Tool Categories in Manifest** (`api-manifest.js`):
```javascript
{
  name: 'customer_create',
  category: 'Customer',  // 1:1 mapping
  // ...
}
```

### Current Issues

| Issue | Impact | Example |
|-------|--------|---------|
| **1:1 Mapping Assumption** | Entity boundary name MUST exactly match category | "Customer" boundary → "Customer" category only |
| **No Multi-Category Support** | Can't include tools from multiple categories easily | "Service" boundary can't include both "Product" + "Sales" |
| **Hardcoded Expansion Rules** | Adding new entity requires code changes | New "Inventory" entity needs new expansion rule |
| **No Glob/Pattern Support** | Can't filter by tool name patterns | Can't include all `customer_*` tools |
| **No Granular Control** | All-or-nothing per category | Can't exclude `customer_delete` from "Customer" boundary |
| **Implicit Category List** | No central registry of valid categories | 37 categories scattered across manifest |

---

## 🎯 Design Goals for Declarative Approach

1. **Zero Code Changes** - Adding new entity boundary should only require config update
2. **Multi-Category Mapping** - One entity boundary can include multiple tool categories
3. **Pattern Matching** - Support glob patterns for tool names (e.g., `customer_*`, `*_create`)
4. **Whitelist + Blacklist** - Include categories but exclude specific tools
5. **Dynamic Expansion** - Context-aware expansion rules without hardcoding
6. **Self-Documenting** - Config clearly shows which tools belong to which boundary
7. **Validation** - Detect invalid category/tool references at startup

---

## 🏗️ Approach 1: Explicit Entity-to-Category Mapping

### Config Structure

```json
{
  "entity_boundary": {
    "entity_definitions": {
      "Customer": {
        "description": "Customer profile management and search",
        "include_categories": ["Customer"],
        "exclude_tools": ["customer_admin_delete"],
        "priority": 1
      },
      "Task": {
        "description": "Task and workflow management",
        "include_categories": ["Task", "Workflow"],
        "exclude_tools": [],
        "priority": 2
      },
      "Service": {
        "description": "Service catalog and product operations",
        "include_categories": ["Product", "Sales", "Settings"],
        "include_tools": ["entity_linkage_list"],  // Cross-category tool
        "priority": 3
      },
      "Calendar": {
        "description": "Appointment booking and scheduling",
        "include_categories": ["Calendar", "Booking"],
        "exclude_tools": ["calendar_admin_*"],  // Glob pattern
        "priority": 4
      }
    },

    "default_entities": ["Customer", "Task", "Employee", "Calendar", "Settings"],

    "expansion_rules": {
      "if_service_catalog_matched": {
        "add_entities": ["Service"]  // References entity_definitions keys
      },
      "if_project_mentioned": {
        "add_entities": ["Project", "Wiki", "Artifact"]
      }
    }
  }
}
```

### Implementation

```typescript
function getMCPToolsForEntities(entityBoundary: string[]): ChatCompletionTool[] {
  const entityDefs = config.entity_boundary.entity_definitions;

  let includeCategories = new Set<string>();
  let includeTools = new Set<string>();
  let excludeTools = new Set<string>();

  // Collect all rules from requested entities
  for (const entityName of entityBoundary) {
    const entityDef = entityDefs[entityName];
    if (!entityDef) {
      console.warn(`Unknown entity: ${entityName}`);
      continue;
    }

    // Collect categories
    entityDef.include_categories?.forEach(cat => includeCategories.add(cat));

    // Collect explicit tool includes
    entityDef.include_tools?.forEach(tool => includeTools.add(tool));

    // Collect exclusions (support glob patterns)
    entityDef.exclude_tools?.forEach(pattern => excludeTools.add(pattern));
  }

  // Filter tools
  const tools = getMCPTools({
    categories: Array.from(includeCategories),
    includeEndpoints: Array.from(includeTools),
    excludeEndpoints: expandGlobPatterns(Array.from(excludeTools))
  });

  return tools;
}

function expandGlobPatterns(patterns: string[]): string[] {
  const allToolNames = API_MANIFEST.map(e => e.name);
  const expandedExclusions: string[] = [];

  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      expandedExclusions.push(...allToolNames.filter(name => regex.test(name)));
    } else {
      expandedExclusions.push(pattern);
    }
  }

  return expandedExclusions;
}
```

### Pros & Cons

✅ **Pros:**
- Explicit multi-category mapping
- Self-documenting (clear which categories belong to which entity)
- Supports both whitelist (include) and blacklist (exclude)
- Glob pattern support for tool exclusions
- Zero code changes for new entities

❌ **Cons:**
- Verbose config (need to list all categories per entity)
- Expansion rules still reference entity names (not tool-level)
- No runtime validation of category names

---

## 🏗️ Approach 2: Tag-Based Multi-Dimensional Filtering

### Concept

Instead of single `category` field, each tool has multiple tags. Entity boundary defines which tags to include.

### API Manifest Changes

```javascript
{
  name: 'customer_create',
  category: 'Customer',  // Keep for backward compatibility
  tags: {
    entity_type: 'Customer',
    operation: 'create',
    data_scope: 'profile',
    permission_level: 'write',
    business_domain: 'crm'
  },
  // ...
}

{
  name: 'person_calendar_book',
  category: 'Calendar',
  tags: {
    entity_type: 'Calendar',
    operation: 'create',
    data_scope: 'appointment',
    permission_level: 'write',
    business_domain: 'scheduling',
    requires_entities: ['Task', 'Customer']  // Dependencies
  },
  // ...
}
```

### Config Structure

```json
{
  "entity_boundary": {
    "entity_definitions": {
      "Customer": {
        "filter_by_tags": {
          "entity_type": ["Customer"],
          "business_domain": ["crm", "customer_service"]
        },
        "exclude_operations": ["delete", "admin"]
      },
      "Appointment": {
        "filter_by_tags": {
          "entity_type": ["Calendar", "Booking"],
          "business_domain": ["scheduling"],
          "data_scope": ["appointment"]
        },
        "auto_include_dependencies": true  // Include Task, Customer tools
      }
    }
  }
}
```

### Implementation

```typescript
function getMCPToolsForEntities(entityBoundary: string[]): ChatCompletionTool[] {
  const entityDefs = config.entity_boundary.entity_definitions;
  const selectedTools: APIEndpoint[] = [];

  for (const entityName of entityBoundary) {
    const entityDef = entityDefs[entityName];

    // Filter tools by multi-dimensional tags
    const matchingTools = API_MANIFEST.filter(endpoint => {
      if (!endpoint.tags) return false;

      // Check all tag filters
      for (const [tagKey, allowedValues] of Object.entries(entityDef.filter_by_tags)) {
        const toolTagValue = endpoint.tags[tagKey];
        if (!allowedValues.includes(toolTagValue)) {
          return false;
        }
      }

      // Check operation exclusions
      if (entityDef.exclude_operations?.includes(endpoint.tags.operation)) {
        return false;
      }

      return true;
    });

    selectedTools.push(...matchingTools);

    // Auto-include dependency tools
    if (entityDef.auto_include_dependencies) {
      for (const tool of matchingTools) {
        if (tool.tags.requires_entities) {
          // Recursively include required entity tools
        }
      }
    }
  }

  return selectedTools.map(endpointToOpenAITool);
}
```

### Pros & Cons

✅ **Pros:**
- Multi-dimensional filtering (entity_type + operation + domain)
- Automatic dependency resolution
- Fine-grained control (exclude specific operations)
- Semantic tag system (clear intent)
- Flexible - add new tag dimensions without breaking changes

❌ **Cons:**
- **Major refactoring required** - need to add tags to all 1800+ tools in manifest
- Breaking change to api-manifest.js structure
- More complex filtering logic
- Overhead of maintaining tag taxonomy

---

## 🏗️ Approach 3: Capability-Based Grouping

### Concept

Group tools into logical capabilities. Entity boundary selects capabilities.

### Config Structure

```json
{
  "tool_capabilities": {
    "customer_profile_mgmt": {
      "description": "Create, read, update customer profiles",
      "include_tools": ["customer_get", "customer_create", "customer_update"],
      "include_patterns": ["customer_*"],
      "exclude_tools": ["customer_delete", "customer_admin_*"]
    },
    "appointment_booking": {
      "description": "Book appointments and manage calendar",
      "include_categories": ["Calendar", "Booking"],
      "exclude_tools": ["calendar_admin_*"]
    },
    "service_catalog_search": {
      "description": "Search service catalog and products",
      "include_categories": ["Product", "Sales"],
      "include_tools": ["setting_list"]  // Cross-category
    },
    "task_management": {
      "description": "Create and manage tasks",
      "include_categories": ["Task", "Workflow"],
      "include_tools": ["entity_linkage_create"]
    }
  },

  "entity_boundary": {
    "entity_definitions": {
      "Customer": {
        "capabilities": ["customer_profile_mgmt"]
      },
      "Service": {
        "capabilities": ["service_catalog_search", "customer_profile_mgmt"]
      },
      "Appointment": {
        "capabilities": ["appointment_booking", "task_management", "customer_profile_mgmt"],
        "auto_include_capability_dependencies": true
      }
    },

    "default_entities": ["Customer", "Task"],

    "expansion_rules": {
      "if_service_catalog_matched": {
        "add_capabilities": ["service_catalog_search"]  // Direct capability reference
      }
    }
  }
}
```

### Implementation

```typescript
function getMCPToolsForEntities(entityBoundary: string[]): ChatCompletionTool[] {
  const entityDefs = config.entity_boundary.entity_definitions;
  const capabilities = config.tool_capabilities;

  let selectedCapabilities = new Set<string>();

  // Collect capabilities from entities
  for (const entityName of entityBoundary) {
    const entityDef = entityDefs[entityName];
    entityDef.capabilities?.forEach(cap => selectedCapabilities.add(cap));
  }

  // Resolve capabilities to tools
  let includeCategories = new Set<string>();
  let includeTools = new Set<string>();
  let excludeTools = new Set<string>();

  for (const capName of selectedCapabilities) {
    const cap = capabilities[capName];

    cap.include_categories?.forEach(cat => includeCategories.add(cat));
    cap.include_tools?.forEach(tool => includeTools.add(tool));
    cap.include_patterns?.forEach(pattern => {
      includeTools.add(...expandPattern(pattern));
    });
    cap.exclude_tools?.forEach(tool => excludeTools.add(tool));
  }

  // Filter tools
  return getMCPTools({
    categories: Array.from(includeCategories),
    includeEndpoints: Array.from(includeTools),
    excludeEndpoints: expandGlobPatterns(Array.from(excludeTools))
  });
}
```

### Pros & Cons

✅ **Pros:**
- **Best separation of concerns** - capabilities are reusable across entities
- Semantic grouping (capabilities have clear business meaning)
- DRY - multiple entities can share capabilities
- Expansion rules can reference capabilities directly
- Easy to add new entity = just select capabilities

❌ **Cons:**
- Extra abstraction layer (entity → capability → tools)
- Need to maintain capability definitions
- More complex mental model

---

## 🏗️ Approach 4: Hybrid (Recommended)

Combine best aspects of all approaches.

### Config Structure

```json
{
  "entity_boundary": {
    "category_registry": {
      "description": "Central registry of all valid tool categories (from api-manifest.js)",
      "categories": [
        "Authentication", "Project", "Task", "Employee", "Business", "Office",
        "Customer", "Worksite", "Role", "Position", "Wiki", "Form", "Artifact",
        "Reports", "Product", "Sales", "Operations", "Inventory", "Order",
        "Shipment", "Financial", "Booking", "Calendar", "Settings", "Linkage",
        "Entity", "RBAC", "System", "Workflow"
      ],
      "validation_enabled": true
    },

    "entity_definitions": {
      "Customer": {
        "description": "Customer profile management and search",
        "include": {
          "categories": ["Customer"],
          "tools": [],  // Explicit tool names
          "patterns": []  // Glob patterns
        },
        "exclude": {
          "tools": ["customer_delete"],  // Specific exclusions
          "patterns": ["*_admin_*"]  // Admin tools
        }
      },

      "Service": {
        "description": "Service catalog, products, and sales",
        "include": {
          "categories": ["Product", "Sales"],
          "tools": ["setting_list"],  // Cross-category tool
          "patterns": ["service_*"]
        },
        "exclude": {
          "tools": [],
          "patterns": []
        }
      },

      "Appointment": {
        "description": "Appointment booking and calendar management",
        "include": {
          "categories": ["Calendar", "Booking"],
          "tools": [],
          "patterns": ["*_calendar_*", "*_booking_*"]
        },
        "exclude": {
          "tools": [],
          "patterns": ["*_delete", "*_admin_*"]
        },
        "dependencies": ["Task", "Customer"]  // Auto-include these entities
      },

      "Task": {
        "description": "Task and workflow management",
        "include": {
          "categories": ["Task", "Workflow"],
          "tools": ["entity_linkage_create", "entity_linkage_list"],
          "patterns": []
        },
        "exclude": {
          "tools": [],
          "patterns": []
        }
      },

      "Settings": {
        "description": "System settings and configurations",
        "include": {
          "categories": ["Settings", "Category"],
          "tools": [],
          "patterns": ["setting_*", "*_list"]  // All list operations
        },
        "exclude": {
          "tools": [],
          "patterns": []
        }
      }
    },

    "default_entities": ["Customer", "Task", "Employee", "Settings"],

    "expansion_rules": {
      "if_service_catalog_matched": {
        "description": "Expand to service/product tools when catalog match found",
        "condition": "extracted.service?.catalog_match",
        "add_entities": ["Service", "Product"]
      },
      "if_project_mentioned": {
        "description": "Expand to project management tools when project referenced",
        "condition": "extracted.project?.id",
        "add_entities": ["Project", "Wiki", "Artifact", "Form"]
      },
      "if_appointment_booking": {
        "description": "Expand to booking tools when scheduling appointment",
        "condition": "state.context.currentGoal?.includes('appointment')",
        "add_entities": ["Appointment", "Calendar", "Booking"]
      }
    },

    "always_include_categories": ["Settings", "Linkage"],
    "never_include_categories": ["Authentication", "System", "RBAC"]
  }
}
```

### Implementation

```typescript
interface EntityDefinition {
  description: string;
  include: {
    categories: string[];
    tools: string[];
    patterns: string[];
  };
  exclude: {
    tools: string[];
    patterns: string[];
  };
  dependencies?: string[];
}

function getMCPToolsForEntities(
  entityBoundary: string[],
  config: AgentConfigV3
): ChatCompletionTool[] {
  const entityDefs = config.entity_boundary.entity_definitions;
  const alwaysInclude = config.entity_boundary.always_include_categories || [];
  const neverInclude = config.entity_boundary.never_include_categories || [];

  // Validate entity names
  const invalidEntities = entityBoundary.filter(e => !entityDefs[e]);
  if (invalidEntities.length > 0) {
    console.warn(`[EntityBoundary] Unknown entities: ${invalidEntities.join(', ')}`);
  }

  // Resolve dependencies
  const resolvedEntities = resolveDependencies(entityBoundary, entityDefs);

  // Collect all inclusion/exclusion rules
  let includeCategories = new Set<string>(alwaysInclude);
  let includeTools = new Set<string>();
  let excludeTools = new Set<string>();

  for (const entityName of resolvedEntities) {
    const entityDef = entityDefs[entityName];
    if (!entityDef) continue;

    // Add categories
    entityDef.include.categories.forEach(cat => {
      if (!neverInclude.includes(cat)) {
        includeCategories.add(cat);
      }
    });

    // Add explicit tools
    entityDef.include.tools.forEach(tool => includeTools.add(tool));

    // Expand patterns
    const expandedIncludes = expandPatterns(entityDef.include.patterns);
    expandedIncludes.forEach(tool => includeTools.add(tool));

    // Add exclusions
    entityDef.exclude.tools.forEach(tool => excludeTools.add(tool));
    const expandedExcludes = expandPatterns(entityDef.exclude.patterns);
    expandedExcludes.forEach(tool => excludeTools.add(tool));
  }

  // Validate categories
  if (config.entity_boundary.category_registry?.validation_enabled) {
    validateCategories(Array.from(includeCategories), config);
  }

  // Get filtered tools
  const tools = getMCPTools({
    categories: Array.from(includeCategories),
    includeEndpoints: Array.from(includeTools),
    excludeEndpoints: Array.from(excludeTools)
  });

  console.log(`[EntityBoundary] Filtered to ${tools.length} tools for entities: ${resolvedEntities.join(', ')}`);

  return tools;
}

function resolveDependencies(
  entities: string[],
  entityDefs: Record<string, EntityDefinition>
): string[] {
  const resolved = new Set<string>(entities);

  for (const entityName of entities) {
    const entityDef = entityDefs[entityName];
    if (entityDef?.dependencies) {
      entityDef.dependencies.forEach(dep => resolved.add(dep));
    }
  }

  return Array.from(resolved);
}

function expandPatterns(patterns: string[]): string[] {
  const allToolNames = API_MANIFEST.map(e => e.name);
  const expanded: string[] = [];

  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      expanded.push(...allToolNames.filter(name => regex.test(name)));
    } else {
      expanded.push(pattern);
    }
  }

  return expanded;
}

function validateCategories(categories: string[], config: AgentConfigV3): void {
  const validCategories = config.entity_boundary.category_registry?.categories || [];
  const invalid = categories.filter(cat => !validCategories.includes(cat));

  if (invalid.length > 0) {
    throw new Error(`Invalid categories referenced: ${invalid.join(', ')}`);
  }
}
```

### Pros & Cons

✅ **Pros:**
- **Best of all approaches** - flexible, declarative, validated
- Supports all filtering modes: categories, tools, patterns
- Automatic dependency resolution
- Category registry for validation
- Glob pattern support
- Self-documenting config
- Zero code changes for new entities
- Backward compatible (keeps category-based filtering)

❌ **Cons:**
- Most complex config structure
- Need to maintain entity definitions
- Pattern expansion overhead

---

## 📊 Comparison Matrix

| Feature | Approach 1 | Approach 2 | Approach 3 | Approach 4 (Hybrid) |
|---------|-----------|-----------|-----------|---------------------|
| **Multi-category mapping** | ✅ | ✅ | ✅ | ✅ |
| **Glob pattern support** | ⚠️ Excludes only | ✅ | ⚠️ | ✅ Include + Exclude |
| **Tool-level control** | ⚠️ Limited | ✅ | ⚠️ | ✅ |
| **Category validation** | ❌ | ❌ | ❌ | ✅ |
| **Dependency resolution** | ❌ | ✅ | ⚠️ | ✅ |
| **Config complexity** | Medium | High | High | High |
| **Code complexity** | Low | High | Medium | Medium |
| **Refactoring required** | None | **Major** | None | None |
| **Self-documenting** | ✅ | ✅ | ✅ | ✅ |
| **Backward compatible** | ✅ | ❌ | ✅ | ✅ |
| **Zero code changes** | ✅ | ❌ | ✅ | ✅ |

---

## 🎯 Recommendation: Hybrid Approach (Approach 4)

### Why?

1. **Minimal refactoring** - Works with existing api-manifest.js structure
2. **Maximum flexibility** - Supports all filtering modes
3. **Self-validating** - Category registry catches typos at startup
4. **Dependency-aware** - Auto-includes required entities
5. **Production-ready** - Can implement incrementally

### Implementation Phases

**Phase 1: Category Registry**
- Add `category_registry` to agent_config.json
- Implement validation in `determineEntityBoundary()`
- No breaking changes

**Phase 2: Entity Definitions**
- Migrate existing `entity_boundary` to new structure
- Add `include`/`exclude` support
- Keep old structure for backward compatibility

**Phase 3: Pattern Support**
- Implement `expandPatterns()` function
- Add pattern matching to `getMCPTools()`
- Test with real-world patterns

**Phase 4: Dependencies**
- Add `dependencies` field to entity definitions
- Implement `resolveDependencies()`
- Test circular dependency detection

---

## 🧪 Example Usage

### Config
```json
{
  "entity_boundary": {
    "entity_definitions": {
      "Appointment": {
        "include": {
          "categories": ["Calendar", "Booking"],
          "patterns": ["*_calendar_*"]
        },
        "exclude": {
          "patterns": ["*_delete", "*_admin_*"]
        },
        "dependencies": ["Task", "Customer"]
      }
    }
  }
}
```

### Runtime Behavior
```typescript
// User: "I need to schedule an appointment"
// Goal: EXECUTE_SOLUTION

determineEntityBoundary(state)
// Returns: ["Appointment", "Task", "Customer"]  // With dependencies

getMCPToolsForEntities(["Appointment", "Task", "Customer"])
// Categories: Calendar, Booking, Task, Workflow, Customer
// Tools: person_calendar_book, person_calendar_list, task_create, customer_get
// Excluded: person_calendar_delete, calendar_admin_*, task_delete

// LLM receives 15 tools instead of 1800
// Token savings: 95%
// Selection accuracy: Improved
```

---

## 🔮 Future Enhancements

1. **Tool Tagging** (Like Approach 2)
   - Add optional `tags` to api-manifest.js
   - Filter by `operation`, `data_scope`, `permission_level`

2. **Capability Grouping** (Like Approach 3)
   - Add `tool_capabilities` section
   - Entity references capabilities instead of categories

3. **Context-Aware Validation**
   - Validate entity boundary against current goal
   - Warn if required tools missing

4. **Dynamic Tool Prioritization**
   - Rank tools by relevance to current context
   - Present top-N tools to LLM first

5. **Tool Usage Analytics**
   - Track which tools are actually called
   - Optimize entity definitions based on usage patterns

---

## ✅ Action Items

1. ⬜ Implement category_registry with validation
2. ⬜ Refactor entity_boundary config to hybrid structure
3. ⬜ Implement pattern expansion (glob support)
4. ⬜ Add dependency resolution
5. ⬜ Update getMCPToolsForEntities() function
6. ⬜ Add unit tests for filtering logic
7. ⬜ Document new config structure
8. ⬜ Migrate existing entity definitions

---

**End of Brainstorm**
