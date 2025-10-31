# Settings & Data Labels - Complete Technical Documentation

> **Configuration Engine** - Dynamic dropdown system powering entity fields, sequential state visualization, and workflow management
>
> **Last Updated:** 2025-10-31 (v3.2 - Entity Management System & Centralized Icon Registry)

**Related Documentation:**
- **[SettingsDataTable](./settings_datatable.md)** - Dedicated table component for settings pages
- **[EntityDataTable](./entity_datatable.md)** - Full-featured table for entity pages
- **[DataTable Overview](./data_table.md)** - Overview of both table components

**New in v3.2:**
- ✅ **Entity Registry Management** - CRUD interface for platform entities
- ✅ **Centralized Icon System** - Explicit imports with iconMapping.ts for guaranteed compatibility
- ✅ **Child Entity Relationships** - Parent-child mapping with visual modal
- ✅ **Compact Table Styling** - Standardized design matching datalabel pages

**Fixed in v3.2:**
- 🔧 **Icon Rendering** - Replaced wildcard imports with explicit named imports (Vite compatibility)
- 🔧 **Icon Registry** - Centralized icon management in `/lib/iconMapping.ts`

**Quick Navigation:**
- [Entity Management System](#entity-management-system-v31) - Entity CRUD, icons, child relationships
- [Quick Start Guide](#entity-management-quick-start) - 5-minute developer guide

---

## 📋 Table of Contents

1. [Semantics & Business Context](#semantics--business-context)
2. [Architecture & Design Patterns](#architecture--design-patterns)
   - [Settings System Architecture](#settings-system-architecture)
   - [Functional Design Patterns](#design-patterns) (4 patterns)
   - [SOLID Design Patterns (v2.4)](#solid-design-patterns-in-settings-architecture-v24) (6 patterns)
   - [Database-Driven Badge Color System (v2.5)](#pattern-7-database-driven-badge-color-system-v25) (Pattern 7)
3. [Database, API & UI/UX Mapping](#database-api--uiux-mapping)
4. [DRY Principles & Entity Relationships](#dry-principles--entity-relationships)
5. [Central Configuration & Middleware](#central-configuration--middleware)
6. [User Interaction Flow Examples](#user-interaction-flow-examples)
7. [Critical Considerations When Editing](#critical-considerations-when-editing)

---

## Semantics & Business Context

### Business Purpose

**Settings (Data Labels)** serve as the configuration backbone for the PMO platform. They provide:
- **Dynamic dropdowns** that business users can modify without code changes
- **Sequential state workflows** for projects, tasks, and sales pipelines
- **Hierarchical categorization** for offices, businesses, and organizational structures
- **Workflow standardization** ensuring consistent data across all entities
- **Business flexibility** to adapt the system to changing organizational needs
- **Auto-detected inline editing** - Fields with `loadOptionsFromSettings` automatically become editable dropdowns (Convention Over Configuration)
- **v2.5: Database-driven badge colors** - Colors from `color_code` column automatically applied to badges using DRY auto-apply pattern (see [Database-Driven Badge Color System](#pattern-7-database-driven-badge-color-system-v25))

### Business Workflows

#### Settings Lifecycle
```
Define → Populate → Integrate → Display → Update → Archive
   ↓        ↓          ↓          ↓         ↓         ↓
Create   Seed     Link to    Dropdown  Modify   Soft
DDL      Data     Entities    UI       Values   Delete
```

#### Settings Usage Pattern
```
Entity Field → loadOptionsFromSettings → API Request → Settings Table → Dropdown
      ↓                                                                      ↓
   project_stage                                                    Selection
      ↓                                                                      ↓
   API Mapping                                                        Save to Entity
      ↓                                                                      ↓
   setting_datalabel_project_stage                              d_project.project_stage
```

### Key Business Rules

**Settings Tables:**
- **Naming convention**: All use `setting_datalabel_` prefix (e.g., `setting_datalabel_project_stage`)
- **Snake_case mapping**: API category matches table name without prefix
- **Active flag filtering**: Only `active_flag = true` records appear in dropdowns
- **Sort order control**: `sort_order` field determines display sequence

**Sequential States:**
- **Linear progression**: Stages/funnels follow defined workflow sequences
- **Parent-child relationships**: `parent_id` enables graph-like workflow visualization
- **Terminal states**: Some stages (Done, Cancelled) have no forward transitions
- **Visual timeline**: SequentialStateVisualizer component renders progress

**Hierarchical Levels:**
- **Multi-level structures**: Office (4 levels), Business (3 levels)
- **Root/leaf indicators**: `is_root`, `is_leaf` flags for tree structures
- **Authority description**: Management levels have authority scope definitions

### Real-World Use Cases

| Settings Category | Entity Field | Business Purpose | Workflow Impact |
|-------------------|--------------|------------------|-----------------|
| project_stage | project.project_stage | PMI lifecycle tracking | Stage gates, approvals, reporting |
| task_stage | task.stage | Agile/Kanban workflow | Sprint velocity, burndown charts |
| opportunity_funnel_stage | client.opportunity_stage | Sales pipeline | Conversion rates, forecasting |
| task_priority | task.priority_level | Work prioritization | Resource allocation, urgency |
| office_level | office.level | Org hierarchy | Reporting structure, delegation |
| acquisition_channel | client.acquisition_channel | Marketing ROI | Channel effectiveness analysis |

---

## Architecture & Design Patterns

### Settings System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SETTINGS SYSTEM LAYERS                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  💾 DATABASE LAYER                                              │
│  ├─ 17 setting_datalabel_* tables                              │
│  │  ├─ Sequential States (7): project_stage, task_stage, ...  │
│  │  ├─ Hierarchical Levels (5): office_level, business_level  │
│  │  └─ Categorization (5): industry_sector, customer_tier     │
│  └─ Normalized schema with active_flag, sort_order            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔌 API LAYER (Fastify)                                         │
│  ├─ GET /api/v1/setting?datalabel=project_stage                │
│  ├─ Datalabel-to-table mapping (snake_case)                    │
│  ├─ JSON response with normalized structure                    │
│  └─ No authentication required (public configuration)          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ⚙️  FRONTEND CONFIG                                            │
│  ├─ entityConfig.ts: loadOptionsFromSettings: true             │
│  ├─ sequentialStateConfig.ts: Auto-detect patterns             │
│  ├─ Dynamic loading on component mount                         │
│  └─ Cache settings in component state                          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🎨 UI COMPONENTS                                               │
│  ├─ Dropdown (Standard)       → Select from settings           │
│  ├─ SequentialStateVisualizer → Timeline with progress dots    │
│  ├─ InlineEditor              → Edit entity field values       │
│  └─ HierarchicalSelector      → Tree picker for office/biz     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Design Patterns

#### 1. **Datalabel-to-Table Mapping Pattern**

Frontend specifies datalabel, API maps to table:

```typescript
// Frontend: entityConfig.ts (DRY Factory Pattern)
projectStage: {
  ...createSettingsEntityConfig(
    SETTINGS_REGISTRY.find(s => s.key === 'projectStage')!
  )
}
// This generates:
// {
//   apiEndpoint: '/api/v1/setting?datalabel=project_stage',
//   loadOptionsFromSettings: true  // ← Triggers auto-loading
// }

// API mapping: setting/routes.ts
datalabel=project_stage → setting_datalabel_project_stage

// Query executed:
SELECT id, name, descr, parent_id, color_code
FROM app.setting_datalabel
WHERE datalabel_name = 'setting_datalabel__project_stage'
```

**Naming Convention:**
```
Field: project_stage
API Datalabel: project_stage (snake_case)
Table: setting_datalabel (unified JSONB table)
```

#### 2. **Sequential State Visualization**

Auto-detection based on field name patterns:

```typescript
// sequentialStateConfig.ts
SEQUENTIAL_STATE_PATTERNS = [
  'stage',     // project_stage, task_stage, opportunity_funnel_stage
  'funnel',    // opportunity_funnel_stage
  'status',    // form_submission_status, wiki_publication_status
  'level'      // Hierarchical levels (conditional)
]

// If field matches pattern → SequentialStateVisualizer
// Else → Standard dropdown
```

**Visual Format:**
```
● Initiation → ● Planning → ● Execution → ○ Monitoring → ○ Closure
  ↑ Past         ↑ Past       ↑ Current      ↑ Future      ↑ Future
```

#### 3. **Hierarchical Level Pattern**

Multi-level structures with parent references:

```
Office Hierarchy (4 levels):
└─ Corporate (level_id=4)
   └─ Region (level_id=3, parent_id=4)
      └─ District (level_id=2, parent_id=3)
         └─ Office (level_id=1, parent_id=2)
```

#### 4. **Active Flag Filtering**

All settings queries filter by `active_flag = true`:

```sql
-- Only active settings appear in dropdowns
WHERE active_flag = true

-- Soft delete → removes from dropdowns immediately
UPDATE setting_datalabel_project_stage
SET active_flag = false
WHERE level_id = 5;
```

---

### SOLID Design Patterns in Settings Architecture (v2.4)

The DRY refactoring implements **6 major design patterns** following **SOLID principles** to achieve 80% code reduction while improving maintainability.

---

#### Pattern 1: **Factory Pattern** 🏭

**Intent:** Create entity configurations without specifying exact classes, eliminating repetitive code. Single registry + factory functions generate all 13 settings entities (80% code reduction).

**Implementation:**

```typescript
// settingsConfig.ts

// 1. Define the registry (data source)
export const SETTINGS_REGISTRY: SettingDefinition[] = [
  {
    key: 'projectStage',
    datalabel: 'project_stage',
    displayName: 'Project Stage',
    pluralName: 'Project Stages',
    supportedViews: ['table', 'graph'],
    defaultView: 'table'
  },
  { key: 'taskStage', datalabel: 'task_stage', displayName: 'Task Stage', ... },
  // ... 13 total
];

// 2. Factory functions generate standard structures
export function createSettingsColumns(): ColumnDef[] {
  return [
    { key: 'id', title: 'ID', sortable: true, align: 'center', width: '80px' },
    {
      key: 'name',
      title: 'Name',
      sortable: true,
      filterable: true,
      render: (value, record) => renderColorBadge(record.color_code, value)
    },
    { key: 'descr', title: 'Description', sortable: true },
    { key: 'parent_id', title: 'Parent ID', sortable: true, align: 'center', width: '100px' },
    {
      key: 'color_code',
      title: 'Color',
      sortable: true,
      align: 'center',
      width: '120px',
      inlineEditable: true  // ← Enables inline editing
    }
  ];
}

export function createSettingsFields(): FieldDef[] {
  return [
    { key: 'id', label: 'ID', type: 'number', required: true },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'descr', label: 'Description', type: 'textarea' },
    { key: 'parent_id', label: 'Parent ID', type: 'number' },
    {
      key: 'color_code',
      label: 'Color',
      type: 'select',
      required: true,
      options: COLOR_OPTIONS  // ← Centralized color options
    }
  ];
}

// 3. Main factory assembles complete entity config
export function createSettingsEntityConfig(definition: SettingDefinition): EntityConfig {
  return {
    name: definition.key,
    displayName: definition.displayName,
    pluralName: definition.pluralName,
    apiEndpoint: `/api/v1/setting?datalabel=${definition.datalabel}`,
    columns: createSettingsColumns(),
    fields: createSettingsFields(),
    supportedViews: definition.supportedViews || ['table'],
    defaultView: definition.defaultView || 'table'
  };
}
```

**Usage:**

```typescript
// entityConfig.ts

// ❌ OLD WAY (60 lines per entity)
projectStage: {
  name: 'projectStage',
  displayName: 'Project Stage',
  pluralName: 'Project Stages',
  apiEndpoint: '/api/v1/setting?datalabel=project_stage',
  columns: [
    { key: 'id', title: 'ID', sortable: true, ... },
    { key: 'name', title: 'Name', sortable: true, ... },
    // ... 40+ more lines
  ],
  fields: [
    { key: 'id', label: 'ID', type: 'number', ... },
    // ... 15+ more lines
  ],
  supportedViews: ['table', 'graph'],
  defaultView: 'table'
}

// ✅ NEW WAY (5 lines per entity)
projectStage: {
  ...createSettingsEntityConfig(
    SETTINGS_REGISTRY.find(s => s.key === 'projectStage')!
  )
}
```

**Benefits:**
- ✅ Single source of truth (SETTINGS_REGISTRY)
- ✅ Add new entity: 2 lines (registry entry + usage)
- ✅ Modify structure: Change once, affects all 13 entities
- ✅ Type-safe: TypeScript enforces SettingDefinition interface

**SOLID Principle:** Open/Closed Principle - Open for extension (add to registry), closed for modification (factory functions unchanged)

---

#### Pattern 2: **Strategy Pattern** 🎯

**Intent:** Define family of algorithms (caching strategies), encapsulate each one, make them interchangeable. Provides consistent cache management with time-based expiration.

**Implementation:**

```typescript
// settingsLoader.v2.ts

interface CacheStrategy {
  get(key: string): any | null;
  set(key: string, value: any): void;
  clear(key?: string): void;
}

class SettingsCache implements CacheStrategy {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  get(datalabel: string): SettingOption[] | null {
    const cached = this.cache.get(datalabel);

    // Time-based expiration strategy
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    return null;
  }

  set(datalabel: string, data: SettingOption[]): void {
    this.cache.set(datalabel, {
      data,
      timestamp: Date.now()
    });
  }

  clear(datalabel?: string): void {
    if (datalabel) {
      this.cache.delete(datalabel);  // Selective invalidation
    } else {
      this.cache.clear();            // Full invalidation
    }
  }
}

const cache = new SettingsCache();
```

**Usage:**

```typescript
export async function loadSettingOptions(
  datalabel: string,
  forceRefresh: boolean = false
): Promise<SettingOption[]> {
  // Check cache first (Strategy Pattern in action)
  if (!forceRefresh) {
    const cached = cache.get(datalabel);
    if (cached) {
      console.log(`Cache HIT: ${datalabel}`);
      return cached;
    }
  }

  // Cache miss - fetch from API
  console.log(`Cache MISS: ${datalabel}`);
  const endpoint = getSettingEndpoint(datalabel);
  const result = await httpClient.fetch(endpoint);
  const options = result.data.map(transformToOption).sort(...);

  // Store in cache (Strategy Pattern)
  cache.set(datalabel, options);

  return options;
}

// Selective cache invalidation
export function clearCache(datalabel?: string): void {
  cache.clear(datalabel);
}
```

**Benefits:**
- ✅ Swap caching strategies without changing consumer code
- ✅ Consistent cache management across app
- ✅ Easy to add LRU cache, Redis cache, etc.
- ✅ Testable: Mock cache strategy for tests

**SOLID Principle:** Dependency Inversion Principle - Depend on CacheStrategy abstraction, not concrete implementation

---

#### Pattern 3: **Singleton Pattern** 🎯

**Intent:** Ensure class has only one instance, provide global point of access. Centralized HTTP client with consistent request configuration.

**Implementation:**

```typescript
// settingsApi.ts

class HttpClient {
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const token = localStorage.getItem('auth_token');
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  async request<T>(
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: any
  ): Promise<T> {
    const options: RequestInit = {
      method,
      headers: this.getHeaders(),
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${url}`, options);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  get<T>(url: string): Promise<T> { return this.request<T>(url, 'GET'); }
  put<T>(url: string, body: any): Promise<T> { return this.request<T>(url, 'PUT', body); }
  post<T>(url: string, body: any): Promise<T> { return this.request<T>(url, 'POST', body); }
  delete<T>(url: string): Promise<T> { return this.request<T>(url, 'DELETE'); }
}

const httpClient = new HttpClient(); // ← Singleton instance

export class SettingsApi {
  async list(datalabel: string): Promise<SettingItem[]> {
    const response = await httpClient.get<SettingResponse>(
      `/api/v1/setting?datalabel=${datalabel}`
    );
    return response.data;
  }

  async update(datalabel: string, id: string, data: SettingUpdateData): Promise<SettingItem> {
    const response = await httpClient.put<SettingUpdateResponse>(
      `/api/v1/setting/${datalabel}/${id}`,
      data
    );
    return response.data;
  }

  async getCategories(): Promise<{ datalabel_name: string; item_count: number }[]> {
    const response = await httpClient.get<{ data: any[] }>(
      '/api/v1/setting/categories'
    );
    return response.data;
  }
}

// Singleton export - only one instance across entire app
export const settingsApi = new SettingsApi();
export default settingsApi;
```

**Usage:**

```typescript
// Anywhere in the app - same instance
import { settingsApi } from '@/lib/api/settingsApi';

// Component A
const stages = await settingsApi.list('project_stage');

// Component B (same instance)
const updated = await settingsApi.update('project_stage', '1', { color_code: 'green' });

// Component C (same instance)
const categories = await settingsApi.getCategories();
```

**Benefits:**
- ✅ Single instance = consistent behavior
- ✅ Centralized auth token handling
- ✅ Easy to add interceptors (logging, error handling)
- ✅ Memory efficient

**SOLID Principle:** Single Responsibility Principle - HttpClient handles requests, SettingsApi handles business logic

---

#### Pattern 4: **Dependency Inversion Principle (DIP)** 🔄

**Intent:** Depend on abstractions, not concretions. High-level modules should not depend on low-level modules. Enables HTTP client swapping and easy testing.

**Implementation:**

```typescript
// settingsLoader.v2.ts

// Abstraction (interface)
interface HttpClient {
  fetch(url: string): Promise<any>;
}

// Concrete implementation
class AuthenticatedHttpClient implements HttpClient {
  async fetch(url: string): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${url}`, { headers });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }
}

// Alternative implementation for testing
class MockHttpClient implements HttpClient {
  private mockData: Record<string, any> = {};

  setMockData(url: string, data: any): void {
    this.mockData[url] = data;
  }

  async fetch(url: string): Promise<any> {
    return this.mockData[url] || { data: [] };
  }
}

// High-level module depends on abstraction
const httpClient: HttpClient = new AuthenticatedHttpClient();

// Can swap implementation without changing consumers
// const httpClient: HttpClient = new MockHttpClient();
```

**Usage:**

```typescript
// High-level function depends on HttpClient abstraction
export async function loadSettingOptions(
  datalabel: string,
  forceRefresh: boolean = false
): Promise<SettingOption[]> {
  // ... cache logic ...

  const endpoint = getSettingEndpoint(datalabel);

  // Depends on abstraction, not concrete fetch implementation
  const result = await httpClient.fetch(endpoint);

  const options = result.data.map(transformToOption).sort(...);
  cache.set(datalabel, options);

  return options;
}
```

**Testing:**

```typescript
// Easy to test with mock
const mockClient = new MockHttpClient();
mockClient.setMockData('/api/v1/setting?datalabel=project_stage', {
  data: [
    { id: '0', name: 'Test Stage', descr: '...' }
  ]
});

// Inject mock for testing
const options = await loadSettingOptions('project_stage');
expect(options).toHaveLength(1);
```

**Benefits:**
- ✅ Loose coupling
- ✅ Easily testable
- ✅ Can swap HTTP libraries
- ✅ Clear separation of concerns

**SOLID Principle:** Dependency Inversion Principle - Depend on HttpClient interface, not concrete implementation

---

#### Pattern 5: **Registry Pattern** 📋

**Intent:** Centralized storage of metadata/configuration, enabling data-driven architecture. Single source of truth for all settings entities.

**Implementation:**

```typescript
// settingsConfig.ts

export interface SettingDefinition {
  key: string;                    // camelCase identifier
  datalabel: string;              // snake_case API parameter
  displayName: string;            // Human-readable singular
  pluralName: string;             // Human-readable plural
  supportedViews?: ViewMode[];    // Optional view modes
  defaultView?: ViewMode;         // Default view
}

// The Registry - Single source of truth
export const SETTINGS_REGISTRY: SettingDefinition[] = [
  {
    key: 'projectStage',
    datalabel: 'project_stage',
    displayName: 'Project Stage',
    pluralName: 'Project Stages',
    supportedViews: ['table', 'graph'],
    defaultView: 'table'
  },
  { key: 'projectStatus', datalabel: 'project_status', displayName: 'Project Status', pluralName: 'Project Statuses' },
  { key: 'taskStage', datalabel: 'task_stage', displayName: 'Task Stage', pluralName: 'Task Stages', supportedViews: ['table', 'graph'] },
  { key: 'taskPriority', datalabel: 'task_priority', displayName: 'Task Priority', pluralName: 'Task Priorities' },
  { key: 'businessLevel', datalabel: 'business_level', displayName: 'Business Level', pluralName: 'Business Levels' },
  { key: 'orgLevel', datalabel: 'office_level', displayName: 'Office Level', pluralName: 'Office Levels' },
  { key: 'hrLevel', datalabel: 'hr_level', displayName: 'HR Level', pluralName: 'HR Levels' },
  { key: 'clientLevel', datalabel: 'client_level', displayName: 'Client Level', pluralName: 'Client Levels' },
  { key: 'positionLevel', datalabel: 'position_level', displayName: 'Position Level', pluralName: 'Position Levels' },
  { key: 'opportunityFunnelLevel', datalabel: 'opportunity_funnel_stage', displayName: 'Opportunity Funnel Stage', pluralName: 'Opportunity Funnel Stages' },
  { key: 'industrySector', datalabel: 'industry_sector', displayName: 'Industry Sector', pluralName: 'Industry Sectors' },
  { key: 'acquisitionChannel', datalabel: 'acquisition_channel', displayName: 'Acquisition Channel', pluralName: 'Acquisition Channels' },
  { key: 'customerTier', datalabel: 'customer_tier', displayName: 'Customer Tier', pluralName: 'Customer Tiers' },
];

// Lookup functions
export function getSettingDefinition(key: string): SettingDefinition | undefined {
  return SETTINGS_REGISTRY.find(s => s.key === key);
}

export function getSettingByDatalabel(datalabel: string): SettingDefinition | undefined {
  return SETTINGS_REGISTRY.find(s => s.datalabel === datalabel);
}

export function getAllDatalabels(): string[] {
  return SETTINGS_REGISTRY.map(s => s.datalabel);
}

export function isSettingsEntity(key: string): boolean {
  return SETTINGS_REGISTRY.some(s => s.key === key);
}
```

**Usage:**

```typescript
// Programmatically access metadata
const projectStageDef = getSettingDefinition('projectStage');
console.log(projectStageDef?.displayName);  // "Project Stage"
console.log(projectStageDef?.datalabel);    // "project_stage"

// Enumerate all datalabels
const allDatalabels = getAllDatalabels();
// ['project_stage', 'task_stage', 'task_priority', ...]

// Dynamic routing
if (isSettingsEntity(entityType)) {
  // Use settings-specific handling
}

// Generate navigation menu from registry
const settingsMenu = SETTINGS_REGISTRY.map(def => ({
  label: def.pluralName,
  href: `/settings/${def.key}`
}));
```

**Benefits:**
- ✅ Single source of truth
- ✅ Programmatic access to all settings
- ✅ Easy to add new settings (1 line in registry)
- ✅ Type-safe metadata

**SOLID Principle:** Open/Closed Principle - Registry open for extension (add new entries), closed for modification (lookup functions unchanged)

---

#### Pattern 6: **Builder Pattern (Implicit)** 🏗️

**Intent:** Construct complex objects step by step, separate construction from representation. Factory functions build consistent structures for all settings entities.

**Implementation:**

```typescript
// settingsConfig.ts

// Builder for columns
export function createSettingsColumns(): ColumnDef[] {
  return [
    // Step 1: ID column
    {
      key: 'id',
      title: 'ID',
      sortable: true,
      align: 'center' as const,
      width: '80px'
    },

    // Step 2: Name column with custom renderer
    {
      key: 'name',
      title: 'Name',
      sortable: true,
      filterable: true,
      render: (value: any, record: any) => renderColorBadge(record.color_code, value)
    },

    // Step 3: Description column
    {
      key: 'descr',
      title: 'Description',
      sortable: true
    },

    // Step 4: Parent ID column
    {
      key: 'parent_id',
      title: 'Parent ID',
      sortable: true,
      align: 'center' as const,
      width: '100px'
    },

    // Step 5: Color column with inline editing
    {
      key: 'color_code',
      title: 'Color',
      sortable: true,
      align: 'center' as const,
      width: '120px',
      inlineEditable: true  // ← Enables inline editing
    }
  ];
}

// Builder for fields
export function createSettingsFields(): FieldDef[] {
  return [
    { key: 'id', label: 'ID', type: 'number' as const, required: true },
    { key: 'name', label: 'Name', type: 'text' as const, required: true },
    { key: 'descr', label: 'Description', type: 'textarea' as const },
    { key: 'parent_id', label: 'Parent ID', type: 'number' as const },
    {
      key: 'color_code',
      label: 'Color',
      type: 'select' as const,
      required: true,
      options: COLOR_OPTIONS.map(c => ({ value: c.value, label: c.label }))
    }
  ];
}
```

**Customization (if needed):**

```typescript
// Can extend/override for special cases
export function createCustomSettingsColumns(overrides: Partial<ColumnDef>[]): ColumnDef[] {
  const baseColumns = createSettingsColumns();

  // Merge overrides
  return baseColumns.map((col, idx) => ({
    ...col,
    ...(overrides[idx] || {})
  }));
}
```

**Benefits:**
- ✅ Consistent column/field structure
- ✅ Easy to modify all entities at once
- ✅ Encapsulates complex construction logic
- ✅ Readable, declarative configuration

**SOLID Principle:** Single Responsibility Principle - Builder functions responsible only for construction

---

### Design Patterns Summary Table

| Pattern | Problem Solved | Benefit | SOLID Principle | Files |
|---------|----------------|---------|-----------------|-------|
| **Factory** | Repetitive entity configs | 80% code reduction | Open/Closed | settingsConfig.ts |
| **Strategy** | Scattered caching logic | Pluggable cache strategies | Dependency Inversion | settingsLoader.v2.ts |
| **Singleton** | Multiple API instances | Consistent global access | Single Responsibility | settingsApi.ts |
| **DIP** | Tight coupling to fetch | Testable, swappable HTTP | Dependency Inversion | settingsLoader.v2.ts |
| **Registry** | Scattered metadata | Single source of truth | Open/Closed | settingsConfig.ts |
| **Builder** | Complex object construction | Consistent structure | Single Responsibility | settingsConfig.ts |

---

### Pattern Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     PATTERN INTERACTIONS                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Registry Pattern                                               │
│  ┌────────────────────────┐                                     │
│  │ SETTINGS_REGISTRY      │                                     │
│  │ [13 definitions]       │                                     │
│  └────────┬───────────────┘                                     │
│           │                                                     │
│           ▼                                                     │
│  Factory Pattern                                                │
│  ┌────────────────────────┐                                     │
│  │ createSettingsEntity   │──┐                                  │
│  │ Config(definition)     │  │                                  │
│  └────────────────────────┘  │                                  │
│           │                   │                                 │
│           ▼                   ▼                                 │
│  Builder Pattern         Builder Pattern                        │
│  ┌──────────────┐       ┌──────────────┐                       │
│  │ createColumns│       │ createFields │                       │
│  └──────────────┘       └──────────────┘                       │
│           │                   │                                 │
│           └───────┬───────────┘                                 │
│                   ▼                                             │
│           EntityConfig (complete)                               │
│                   │                                             │
│                   ▼                                             │
│  ┌────────────────────────────────────┐                        │
│  │      DIP + Strategy Pattern         │                        │
│  │                                     │                        │
│  │  HttpClient (interface)             │                        │
│  │      ↑                              │                        │
│  │      │                              │                        │
│  │  ┌───┴──────────┐                  │                        │
│  │  │ Authenticated │                  │                        │
│  │  │ HttpClient    │                  │                        │
│  │  └──────────────┘                  │                        │
│  │                                     │                        │
│  │  SettingsCache (strategy)          │                        │
│  │      ↓                              │                        │
│  │  loadSettingOptions()               │                        │
│  └────────────────────────────────────┘                        │
│                   │                                             │
│                   ▼                                             │
│  Singleton Pattern                                              │
│  ┌────────────────────────┐                                     │
│  │ settingsApi            │                                     │
│  │ (single instance)      │                                     │
│  └────────────────────────┘                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Adding New Setting Entity (Step-by-Step)

**Step 1:** Add to registry
```typescript
// settingsConfig.ts - SETTINGS_REGISTRY
{ key: 'riskLevel', datalabel: 'risk_level', displayName: 'Risk Level', pluralName: 'Risk Levels' },
```

**Step 2:** Use factory in entity config
```typescript
// entityConfig.ts
riskLevel: {
  ...createSettingsEntityConfig(
    SETTINGS_REGISTRY.find(s => s.key === 'riskLevel')!
  )
},
```

**Result:** ~6 lines total generates complete entity with columns, fields, API endpoint, and views. Factory pattern ensures consistency and type safety.

---

### Design Pattern Benefits Summary

**Code Quality:**
- ✅ 80% less code (700 → 150 lines)
- ✅ Single source of truth (SETTINGS_REGISTRY)
- ✅ Type-safe throughout
- ✅ Consistent structure across all entities

**Maintainability:**
- ✅ Change once, affects all 13 entities
- ✅ Clear separation of concerns
- ✅ Easy to understand (declarative)
- ✅ Self-documenting code

**Extensibility:**
- ✅ Add new entity: 2 lines (registry entry + usage)
- ✅ Add new column: Modify factory once
- ✅ Swap caching strategy: Change implementation
- ✅ Swap HTTP client: Implement interface

**Testability:**
- ✅ Mock cache strategy
- ✅ Mock HTTP client
- ✅ Test factory functions in isolation
- ✅ Test registry lookups

**Performance:**
- ✅ 5-minute cache reduces API calls
- ✅ Singleton pattern reduces memory
- ✅ Lazy loading via factory
- ✅ Batch loading support

---

#### Pattern 7: **Database-Driven Badge Color System** (v2.5) 🎨

**Intent:** Automatically apply colors from database `color_code` to entity table badges, eliminating hardcoded color maps.

**Architecture:** Convention over Configuration with Auto-Apply Pattern

```
┌──────────────────────────────────────────────────────────────┐
│             DATABASE-DRIVEN COLOR SYSTEM FLOW                 │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  1. DATABASE (Single Source of Truth)                        │
│     setting_datalabel JSONB table                            │
│     metadata: [{ name: "Initiation",                         │
│                  color_code: "blue",         ←─────┐        │
│                  sort_order: 0 }]                  │        │
│                                                     │        │
│  2. API LAYER                                      │        │
│     GET /api/v1/setting?datalabel=project_stage    │        │
│     Returns sorted metadata with color_code        │        │
│                                                     │        │
│  3. SETTINGS LOADER (settingsLoader.ts)            │        │
│     • Loads options from API                       │        │
│     • Converts color_code → Tailwind classes ──────┘        │
│     • Caches for 5 minutes                                  │
│     • Sorts by sort_order                                   │
│                                                              │
│  4. SETTINGS CONFIG (settingsConfig.ts)                     │
│     • renderColorBadge() → For settings tables              │
│     • renderSettingBadge() → For entity tables              │
│     • applySettingsBadgeRenderers() → Auto-apply            │
│                                                              │
│  5. ENTITY CONFIG (entityConfig.ts)                         │
│     Column definition:                                       │
│     {                                                        │
│       key: 'project_stage',                                 │
│       loadOptionsFromSettings: true  ← Only flag needed!    │
│     }                                                        │
│     Auto-enhancement adds render function at module load    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
// 1. Database Structure (Unified JSONB)
// setting_datalabel table stores all settings categories
{
  "datalabel_name": "project__stage",
  "metadata": [
    {
      "id": "0",
      "name": "Initiation",
      "color_code": "blue",    // ← Source of truth
      "sort_order": 0
    }
  ]
}

// 2. Settings Loader - Fetches & Transforms
// settingsLoader.ts
export interface SettingOption {
  value: string;
  label: string;
  colorClass?: string;  // Tailwind classes
  metadata?: {
    color_code?: string;
    sort_order?: number;
  };
}

function colorCodeToTailwindClass(colorCode: string): string {
  const colorMap = {
    blue: 'bg-blue-100 text-blue-800',
    purple: 'bg-purple-100 text-purple-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    orange: 'bg-orange-100 text-orange-800',
    gray: 'bg-gray-100 text-gray-800',
    // ...
  };
  return colorMap[colorCode] || 'bg-gray-100 text-gray-800';
}

// 3. Settings Config - Badge Renderers
// settingsConfig.ts

// Color cache for performance
const settingsColorCache = new Map<string, Map<string, string>>();

// Creates badge renderer for entity tables
export function renderSettingBadge(category: string) {
  // Pre-load colors on first call
  if (!settingsColorCache.has(category)) {
    loadSettingOptions(category).then(options => {
      const colorMap = new Map();
      for (const option of options) {
        colorMap.set(option.label, option.colorClass);
      }
      settingsColorCache.set(category, colorMap);
    });
  }

  return (value: string | null): React.ReactElement => {
    const colorMap = settingsColorCache.get(category);
    const colorClass = colorMap?.get(value) || 'bg-gray-100 text-gray-800';
    return <span className={`badge ${colorClass}`}>{value}</span>;
  };
}

// Auto-apply pattern (Convention over Configuration)
export function applySettingsBadgeRenderers(columns: ColumnDef[]): ColumnDef[] {
  return columns.map(col => {
    if (col.loadOptionsFromSettings && !col.render) {
      const category = extractSettingsCategory(col.key);
      return {
        ...col,
        render: renderSettingBadge(category)  // ← Auto-applied!
      };
    }
    return col;
  });
}

// 4. Entity Config - Auto-Enhancement
// entityConfig.ts

// Define columns simply
export const entityConfigs = {
  project: {
    columns: [
      {
        key: 'project_stage',
        title: 'Stage',
        loadOptionsFromSettings: true
        // ← No render function! Auto-applied below
      }
    ]
  }
};

// Auto-apply badge renderers at module load
Object.keys(entityConfigs).forEach(entityKey => {
  const config = entityConfigs[entityKey];
  if (config.columns) {
    config.columns = applySettingsBadgeRenderers(config.columns);
  }
});
```

**Usage Pattern:**

```typescript
// Settings Table (Direct color_code usage)
{
  key: 'name',
  title: 'Name',
  render: (value, record) => renderColorBadge(record.color_code, value)
}

// Entity Table (Auto-applied from database)
{
  key: 'project_stage',
  title: 'Stage',
  loadOptionsFromSettings: true  // ← Colors auto-applied
}
```

**Benefits:**

**DRY Principles:**
- Single source of truth: Database `color_code` column
- 90% code reduction: ~2,000 lines → ~200 lines
- Zero duplication: Color maps eliminated from entity configs

**Automatic:**
- Convention over Configuration: `loadOptionsFromSettings: true` handles everything
- Auto-enhancement at module load: No manual render function needed
- Cache-first: 5-minute cache for performance

**Maintainable:**
- Update colors in database → reflects everywhere
- Add new settings category → zero code changes
- Consistent colors: Settings tables AND entity tables

**Data Flow:**
```
Database color_code → API → settingsLoader → Cache → renderSettingBadge → Badge Component
     "blue"         JSONB    SettingOption    Map      React Element    Rendered UI
```

**Testing:**

```bash
# Verify database has colors
./tools/run_query.sh "SELECT elem->>'name', elem->>'color_code'
FROM app.setting_datalabel, jsonb_array_elements(metadata) elem
WHERE datalabel_name = 'project__stage';"

# Test API endpoint
./tools/test-api.sh GET /api/v1/setting?datalabel=project_stage
```

#### Pattern 7.1: **Inline Edit Dropdowns with Colored Badges** (v2.6) 🎨

**Intent:** Enable inline editing of settings fields in DataTable with colored badge dropdowns instead of plain HTML `<select>` elements.

**Problem:** Native HTML `<select>` dropdowns cannot display colored badges in `<option>` tags - they only support plain text.

**Solution:** Custom `ColoredDropdown` React component that renders colored badges for both selected value and dropdown options.

**Architecture:**

```
┌──────────────────────────────────────────────────────────────┐
│           INLINE EDIT DROPDOWN ARCHITECTURE                   │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  1. USER CLICKS EDIT BUTTON                                  │
│     DataTable sets isEditing state = true                    │
│                                                               │
│  2. CELL RENDERS IN EDIT MODE                                │
│     editType === 'select' && hasSettingOptions?              │
│     ↓                                                         │
│     <ColoredDropdown                                          │
│       value={current_value}                                  │
│       options={columnOptions}  ← From settingsLoader        │
│       onChange={handleSave}    ← Calls onInlineEdit         │
│     />                                                        │
│                                                               │
│  3. COLORED DROPDOWN COMPONENT                               │
│     • useState for dropdown open/close                       │
│     • useEffect for click-outside detection                  │
│     • useRef for dropdown DOM reference                      │
│     ┌────────────────────────────────────────┐              │
│     │ SELECTED VALUE (Button)                 │              │
│     │  renderSettingBadge(color_code, label) │              │
│     │  [Initiation ▼]  ← Colored badge       │              │
│     └────────────────────────────────────────┘              │
│     ┌────────────────────────────────────────┐              │
│     │ DROPDOWN MENU (Conditional render)     │              │
│     │  ┌──────────────────────────────────┐  │              │
│     │  │ [Planning] ← Blue badge          │  │              │
│     │  │ [Execution] ← Yellow badge       │  │              │
│     │  │ [Closure] ← Green badge          │  │              │
│     │  └──────────────────────────────────┘  │              │
│     └────────────────────────────────────────┘              │
│                                                               │
│  4. USER SELECTS OPTION                                      │
│     onClick → onChange(opt.value) → setDropdownOpen(false)  │
│     ↓                                                         │
│     onInlineEdit(recordId, column.key, newValue)            │
│     ↓                                                         │
│     PUT /api/v1/entity/:id with updated field               │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
// ColoredDropdown Component - DataTable.tsx:60-130
interface ColoredDropdownProps {
  value: string;
  options: SettingOption[];  // From settingsLoader
  onChange: (value: string) => void;
  onClick: (e: React.MouseEvent) => void;
}

function ColoredDropdown({ value, options, onChange, onClick }: ColoredDropdownProps) {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);
  const selectedColor = selectedOption?.metadata?.color_code;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Selected value display */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick(e);
          setDropdownOpen(!dropdownOpen);
        }}
        className="w-full px-2.5 py-1.5 pr-8 border border-gray-300 rounded-md..."
      >
        {selectedOption ? (
          renderSettingBadge(selectedColor, String(selectedOption.label))
        ) : (
          <span className="text-gray-400">Select...</span>
        )}
      </button>
      <ChevronDown className="... absolute right-2 top-1/2 ..." />

      {/* Dropdown menu */}
      {dropdownOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border ... max-h-60 overflow-auto">
          <div className="py-1">
            {options.map(opt => {
              const optionColor = opt.metadata?.color_code;
              return (
                <button
                  key={opt.value}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(opt.value as string);
                    setDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 ..."
                >
                  {renderSettingBadge(optionColor, String(opt.label))}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Usage in DataTable render - DataTable.tsx:1207-1213
editType === 'select' && hasSettingOptions ? (
  <ColoredDropdown
    value={editedData[column.key] ?? (record as any)[column.key] ?? ''}
    options={columnOptions}
    onChange={(value) => onInlineEdit?.(recordId, column.key, value)}
    onClick={(e) => e.stopPropagation()}
  />
) : ...
```

**Key Technical Considerations:**

**React Rules of Hooks:**
- ✅ Component defined at top level (lines 60-130)
- ✅ Hooks called at component level, not in render loop
- ❌ WRONG: Calling hooks inside IIFE `(() => { useState... })()`
- ✅ RIGHT: Extract to proper component with hooks

**Click Handling:**
- `e.stopPropagation()` prevents row click event bubbling
- Click-outside detection closes dropdown automatically
- Dropdown closes after selection for better UX

**Color Data Flow:**
```
Database color_code → API → settingsLoader → SettingOption.metadata.color_code
                                                        ↓
                                          ColoredDropdown component
                                                        ↓
                                          renderSettingBadge(color_code, label)
                                                        ↓
                                          <span class="bg-blue-100 text-blue-800">Initiation</span>
```

**Performance:**
- Colors preloaded on DataTable mount (`useEffect`)
- Cache-first from `settingsLoader` (5-minute cache)
- No API calls during dropdown interactions

**Benefits:**

| Feature | Native `<select>` | ColoredDropdown |
|---------|------------------|-----------------|
| Colored badges | ❌ Not supported | ✅ Full support |
| Custom styling | ❌ Limited | ✅ Full control |
| Database-driven | ❌ No | ✅ Yes |
| Accessibility | ✅ Built-in | ⚠️ Manual ARIA |
| Mobile-friendly | ✅ Native | ✅ Custom |

**Testing:**

```bash
# Verify colors load correctly
1. Navigate to settings page: http://localhost:5173/setting/projectStage
2. Click Edit button on any row
3. Click the dropdown field
4. Verify: Selected value shows colored badge
5. Verify: All dropdown options show colored badges
6. Verify: Colors match database color_code values

# Test API integration
./tools/test-api.sh GET /api/v1/setting?datalabel=project_stage
# Verify response includes color_code for each item
```

**Critical Bug Fix:**

The original implementation violated React's Rules of Hooks by calling `useState` and `useEffect` inside an IIFE within the render loop:

```typescript
// ❌ WRONG - Violates Rules of Hooks
editType === 'select' ? (
  (() => {
    const [state, setState] = React.useState(false); // Hook in IIFE!
    React.useEffect(() => { ... }, []); // Hook in IIFE!
    return <div>...</div>;
  })()
) : ...

// ✅ RIGHT - Proper component at top level
function ColoredDropdown({ ... }: Props) {
  const [state, setState] = React.useState(false); // Hook at component level
  React.useEffect(() => { ... }, []); // Hook at component level
  return <div>...</div>;
}
```

Error message when hooks are used incorrectly:
```
React has detected a change in the order of Hooks called by DataTable.
Previous render: useState, useEffect, useState, useEffect
Current render: useState, useEffect, useState
```

**See Also:**
- [DataTable Inline Editing](./data_table.md#inline-editing-system)
- [Styling Patterns - Badge Colors](./styling_patterns.md#13-badge--tag-patterns)
- [React Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)

---

## Database, API & UI/UX Mapping

### Database Schema

#### Settings Table Structure

**Common Pattern:** All 17 tables follow similar structure

```sql
CREATE TABLE app.setting_datalabel_{category} (
    -- Primary key (integer or UUID)
    level_id integer PRIMARY KEY,  -- or stage_id for stage tables

    -- Display names
    level_name varchar(50) NOT NULL UNIQUE,  -- or stage_name
    level_descr text,                        -- or stage_descr

    -- Ordering & hierarchy
    sort_order integer,
    parent_id integer,  -- For graph-like relationships

    -- Status
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now()
);
```

#### 17 Setting Tables

| Table Name | Category | Type | Purpose |
|------------|----------|------|---------|
| `setting_datalabel_project_stage` | project_stage | Sequential State | PMI project lifecycle stages |
| `setting_datalabel_task_stage` | task_stage | Sequential State | Agile/Kanban task workflow |
| `setting_datalabel_opportunity_funnel_stage` | opportunity_funnel_stage | Sequential State | Sales pipeline stages |
| `setting_datalabel_form_submission_status` | form_submission_status | Sequential State | Form submission workflow |
| `setting_datalabel_form_approval_status` | form_approval_status | Sequential State | Form approval workflow |
| `setting_datalabel_wiki_publication_status` | wiki_publication_status | Sequential State | Wiki publishing states |
| `setting_datalabel_task_update_type` | task_update_type | Sequential State | Task comment categories |
| `setting_datalabel_office_level` | office_level | Hierarchical | 4-level office structure |
| `setting_datalabel_business_level` | business_level | Hierarchical | 3-level business structure |
| `setting_datalabel_position_level` | position_level | Hierarchical | Employee position hierarchy |
| `setting_datalabel_cust_level` | client_level | Hierarchical | Client tier classification |
| `setting_datalabel_industry_sector` | industry_sector | Categorization | Client industry codes |
| `setting_datalabel_acquisition_channel` | acquisition_channel | Categorization | Marketing channels |
| `setting_datalabel_customer_tier` | customer_tier | Categorization | Service tier levels |
| `setting_datalabel_cust_service` | client_service | Categorization | Service offerings |
| `setting_datalabel_cust_status` | client_status | Categorization | Client account status |
| `setting_datalabel_task_priority` | task_priority | Categorization | Task priority levels |

#### Example: Project Stage Table

**Location:** `db/setting_datalabel__project_stage.ddl`

```sql
CREATE TABLE app.setting_datalabel_project_stage (
    level_id integer PRIMARY KEY,
    level_name varchar(50) NOT NULL UNIQUE,
    level_descr text,
    sort_order integer,
    parent_id integer,  -- Workflow graph relationships
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now()
);

-- Seed data
INSERT INTO app.setting_datalabel_project_stage VALUES
(0, 'Initiation', 'Project concept and initial planning', 1, NULL),
(1, 'Planning', 'Detailed project planning', 2, 0),
(2, 'Execution', 'Active project execution', 3, 1),
(3, 'Monitoring', 'Progress tracking', 4, 2),
(4, 'Closure', 'Project completion', 5, 3),
(5, 'On Hold', 'Temporarily suspended', 6, 2),
(6, 'Cancelled', 'Terminated before completion', 7, NULL);
```

### API Endpoints

**Location:** `apps/api/src/modules/setting/routes.ts`

#### Get Settings by Datalabel

```typescript
// List settings for a datalabel
GET /api/v1/setting?datalabel=project_stage
Response: {
  data: [
    {
      id: "0",
      name: "Initiation",
      descr: "Project concept and initial planning",
      parent_id: null,
      color_code: "blue"
    },
    {
      id: "1",
      name: "Planning",
      descr: "Detailed project planning",
      parent_id: 0,
      color_code: "purple"
    }
    // ... more stages
  ],
  datalabel: "project_stage"
}

// Update a setting (inline editing)
PUT /api/v1/setting/project_stage/1
Body: {
  color_code: "green",
  descr: "Updated description"
}
Response: {
  success: true,
  data: {
    id: "1",
    name: "Planning",
    descr: "Updated description",
    parent_id: 0,
    color_code: "green"
  }
}
```

**API Behavior:**
- No authentication required (public configuration)
- Always filters by `active_flag` unless specified
- Returns normalized structure across all categories
- Uses snake_case for all field names

#### Datalabel Architecture (v2.4 - Unified JSONB Table)

**New Approach:** All settings are stored in a single unified table `app.setting_datalabel` with JSONB metadata column:

```typescript
// Unified table structure (db/setting_datalabel.ddl)
CREATE TABLE app.setting_datalabel (
  datalabel_name text PRIMARY KEY,  -- e.g., 'setting_datalabel__project_stage'
  metadata jsonb NOT NULL            -- Array of setting items
);

// Example metadata for project_stage:
{
  "metadata": [
    {"id": "0", "name": "Initiation", "descr": "...", "parent_id": null, "color_code": "blue"},
    {"id": "1", "name": "Planning", "descr": "...", "parent_id": 0, "color_code": "purple"},
    ...
  ]
}

// API Query (apps/api/src/modules/setting/routes.ts)
SELECT
  (elem->>'id')::text as id,
  elem->>'name' as name,
  elem->>'descr' as descr,
  CASE
    WHEN elem->>'parent_id' = 'null' THEN NULL
    ELSE (elem->>'parent_id')::integer
  END as parent_id,
  elem->>'color_code' as color_code
FROM app.setting_datalabel,
  jsonb_array_elements(metadata) as elem
WHERE datalabel_name = 'setting_datalabel__project_stage'
ORDER BY (elem->>'id')::integer ASC;
```

**DRY Frontend Architecture (v2.4):**

```typescript
// settingsConfig.ts - Central Registry (13 settings entities)
export const SETTINGS_REGISTRY = [
  { key: 'projectStage', datalabel: 'project_stage', displayName: 'Project Stage', ... },
  { key: 'taskStage', datalabel: 'task_stage', displayName: 'Task Stage', ... },
  { key: 'taskPriority', datalabel: 'task_priority', displayName: 'Task Priority', ... },
  // ... 13 total
];

// Factory pattern eliminates ~600 lines of repetitive code
export function createSettingsEntityConfig(definition: SettingDefinition) {
  return {
    apiEndpoint: `/api/v1/setting?datalabel=${definition.datalabel}`,
    columns: createSettingsColumns(),  // Generates standard columns
    fields: createSettingsFields()      // Generates standard fields
  };
}

// entityConfig.ts - Using Factory Pattern
projectStage: {
  ...createSettingsEntityConfig(
    SETTINGS_REGISTRY.find(s => s.key === 'projectStage')!
  )
}
```

### UI/UX Components

#### Component Hierarchy

```
Entity Form (e.g., Project Create/Edit)
├─ EntityFormContainer
│  ├─ Field: project_stage (loadOptionsFromSettings: true)
│  │  └─ Check SEQUENTIAL_STATE_PATTERNS
│  │     ├─ Match 'stage' pattern → SequentialStateVisualizer
│  │     └─ No match → Standard Dropdown
│  │
│  └─ Field: office_id (loadOptionsFromSettings: true)
│     └─ Check if hierarchical
│        ├─ Has parent_id → HierarchicalSelector (future)
│        └─ Flat list → Standard Dropdown
│
Settings Loading Hook
├─ useSettings(datalabel)
│  ├─ GET /api/v1/setting?datalabel={datalabel}
│  ├─ Cache results in React state
│  └─ Return { options, loading, error }
│
SequentialStateVisualizer
├─ Receives: stages, currentValue, onChange
├─ Renders: Timeline with clickable dots
└─ Highlights: Past (blue), Current (blue+ring), Future (gray)
```

#### EntityConfig Integration

**Location:** `apps/web/src/lib/entityConfig.ts`

```typescript
export const entityConfigs = {
  project: {
    columns: [
      {
        key: 'project_stage',
        title: 'Stage',
        // ✅ Auto-detected as editable dropdown (by _stage suffix + loadOptionsFromSettings)
        loadOptionsFromSettings: true  // ← Auto-loads from API
      }
    ],
    fields: [
      {
        key: 'project_stage',
        label: 'Project Stage',
        type: 'select',
        loadOptionsFromSettings: true  // ← Auto-loads from API
      }
    ]
  },

  task: {
    columns: [
      {
        key: 'stage',
        title: 'Stage',
        // ✅ Auto-detected as editable dropdown (by name 'stage' + loadOptionsFromSettings)
        loadOptionsFromSettings: true,  // category=task_stage
        render: (value) => <Badge>{value}</Badge>
      }
    ]
  }
};
```

#### Sequential State Detection

**Location:** `apps/web/src/lib/sequentialStateConfig.ts`

```typescript
// Auto-detect sequential states by field name
export const SEQUENTIAL_STATE_PATTERNS = [
  'stage',      // project_stage, task_stage, opportunity_funnel_stage
  'funnel',     // opportunity_funnel_stage
  'pipeline',   // sales_pipeline (future)
  'status',     // form_submission_status, wiki_publication_status
  'level'       // office_level, business_level (conditional)
];

// Explicit whitelist for edge cases
export const SEQUENTIAL_STATE_EXPLICIT_INCLUDES = [
  'project_stage',
  'task_stage',
  'opportunity_funnel_stage',
  'form_submission_status',
  'form_approval_status',
  'wiki_publication_status'
];

// Fields that match pattern but are NOT sequential
export const SEQUENTIAL_STATE_EXPLICIT_EXCLUDES = [
  'active_flag',   // Boolean, not sequential
  'is_complete',   // Boolean
  'priority_level' // Categorical, not sequential
];
```

---

## DRY Principles & Entity Relationships

### Reusable Component Patterns

#### 1. **Settings Hook** - Single Fetcher for All Categories

**Instead of:**
```typescript
// ❌ BAD: Separate hooks for each category
function useProjectStages() { /* fetch logic */ }
function useTaskStages() { /* same fetch logic */ }
function usePriorities() { /* same fetch logic again */ }
```

**We use:**
```typescript
// ✅ GOOD: One hook for all datalabels
function useSettings(datalabel: string) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/setting?datalabel=${datalabel}`)
      .then(res => res.json())
      .then(data => setOptions(data.data));
  }, [datalabel]);

  return { options, loading };
}

// Usage
const { options: projectStages } = useSettings('project_stage');
const { options: taskStages } = useSettings('task_stage');
const { options: priorities } = useSettings('task_priority');
```

#### 2. **loadOptionsFromSettings** - Automatic API Integration

**Instead of:**
```typescript
// ❌ BAD: Hardcoded options in entity config
{
  key: 'priority_level',
  type: 'select',
  options: [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' }
  ]
}
```

**We use:**
```typescript
// ✅ GOOD: Dynamic loading from API
{
  key: 'priority_level',
  type: 'select',
  loadOptionsFromSettings: true  // ← API call: datalabel=task_priority
}

// EntityFormContainer automatically:
// 1. Detects loadOptionsFromSettings: true
// 2. Calls GET /api/v1/setting?datalabel=task_priority
// 3. Maps response to dropdown options
```

#### 3. **Sequential State Auto-Detection**

**Instead of:**
```typescript
// ❌ BAD: Manual configuration for each sequential field
if (field.key === 'project_stage') return <SequentialStateVisualizer />;
if (field.key === 'task_stage') return <SequentialStateVisualizer />;
if (field.key === 'opportunity_funnel_stage') return <SequentialStateVisualizer />;
```

**We use:**
```typescript
// ✅ GOOD: Pattern-based auto-detection
function shouldUseSequentialVisualizer(fieldKey: string): boolean {
  return SEQUENTIAL_STATE_PATTERNS.some(pattern =>
    fieldKey.includes(pattern)
  ) || SEQUENTIAL_STATE_EXPLICIT_INCLUDES.includes(fieldKey);
}

// Automatically uses SequentialStateVisualizer for matching fields
```

### Entity Relationships

```
Settings Tables (Configuration)
  │
  ├─ Entity Fields (1:Many)
  │  ├─ d_project.project_stage → setting_datalabel_project_stage
  │  ├─ d_task.stage → setting_datalabel_task_stage
  │  ├─ d_task.priority_level → setting_datalabel_task_priority
  │  ├─ d_client.industry_sector → setting_datalabel_industry_sector
  │  ├─ d_office.level → setting_datalabel_office_level
  │  └─ d_business.level → setting_datalabel_business_level
  │
  └─ UI Components (Many:1)
     ├─ Dropdowns consume settings
     ├─ SequentialStateVisualizer renders stages
     ├─ KanbanBoard groups by stage settings
     └─ Reports aggregate by stage/level
```

**Database Query: Get All Projects in Execution Stage**
```sql
SELECT p.*
FROM d_project p
INNER JOIN setting_datalabel_project_stage s
  ON p.project_stage = s.level_name
WHERE s.level_name = 'Execution'
  AND s.active_flag = true
  AND p.active_flag = true;
```

**Database Query: Task Stage Distribution**
```sql
SELECT
  s.level_name as stage,
  s.sort_order,
  COUNT(t.id) as task_count
FROM setting_datalabel_task_stage s
LEFT JOIN d_task t ON t.stage = s.level_name AND t.active_flag = true
WHERE s.active_flag = true
GROUP BY s.level_name, s.sort_order
ORDER BY s.sort_order;
```

**Settings Change Impact:**
```
Change setting_datalabel_project_stage:
├─ Dropdown options update immediately (next API call)
├─ Existing project stages remain valid
├─ Soft delete (active_flag=false) removes from dropdown
└─ No CASCADE delete (entity fields store level_name as string)
```

---

## Central Configuration & Middleware

### Settings API Architecture

**Location:** `apps/api/src/modules/setting/routes.ts`

```typescript
// Single endpoint serves all 13+ settings datalabels
fastify.get('/api/v1/setting', async (request, reply) => {
  const { datalabel } = request.query;

  // Datalabel-to-table mapping (unified JSONB table)
  const datalabelName = datalabel.replace(/_([^_]+)$/, '__$1');

  const results = await db.execute(sql`
    SELECT
      (elem->>'id')::text as id,
      elem->>'name' as name,
      COALESCE(elem->>'descr', '') as descr,
      CASE
        WHEN elem->>'parent_id' = 'null' THEN NULL
        ELSE (elem->>'parent_id')::integer
      END as parent_id,
      elem->>'color_code' as color_code
    FROM app.setting_datalabel,
      jsonb_array_elements(metadata) as elem
    WHERE datalabel_name = ${datalabelName}
    ORDER BY (elem->>'id')::integer ASC
  `);

  return { data: results, datalabel };
});

// PUT endpoint for inline editing
fastify.put('/api/v1/setting/:datalabel/:id', async (request, reply) => {
  const { datalabel, id } = request.params;
  const updates = request.body;  // { color_code: "green", descr: "..." }

  // Update JSONB metadata array
  // ... (see apps/api/src/modules/setting/routes.ts for full implementation)

  return { success: true, data: updatedItem };
});
```

**No Authentication Required:**
```typescript
// Settings are PUBLIC configuration
// No JWT check, no RBAC gate
// Available to anonymous users
```

### DRY Architecture Files (v2.4)

The settings system uses **three core files** implementing DRY and SOLID principles:

#### 1. **settingsConfig.ts** - Central Configuration

**Location:** `apps/web/src/lib/settingsConfig.ts`

**Purpose:** Single source of truth for all settings entities

```typescript
// Central registry of all 13 settings entities
export const SETTINGS_REGISTRY: SettingDefinition[] = [
  { key: 'projectStage', datalabel: 'project_stage', displayName: 'Project Stage', pluralName: 'Project Stages', supportedViews: ['table', 'graph'] },
  { key: 'taskStage', datalabel: 'task_stage', displayName: 'Task Stage', pluralName: 'Task Stages', supportedViews: ['table', 'graph'] },
  { key: 'taskPriority', datalabel: 'task_priority', displayName: 'Task Priority', pluralName: 'Task Priorities' },
  { key: 'businessLevel', datalabel: 'business_level', displayName: 'Business Level', pluralName: 'Business Levels' },
  // ... 13 total
];

// Factory functions eliminate ~600 lines of repetitive code
export function createSettingsColumns() {
  return [
    { key: 'id', title: 'ID', sortable: true, align: 'center', width: '80px' },
    { key: 'name', title: 'Name', sortable: true, filterable: true,
      render: (value, record) => renderColorBadge(record.color_code, value) },
    { key: 'descr', title: 'Description', sortable: true },
    { key: 'parent_id', title: 'Parent ID', sortable: true, align: 'center', width: '100px' },
    { key: 'color_code', title: 'Color', sortable: true, align: 'center', width: '120px', inlineEditable: true }
  ];
}

export function createSettingsEntityConfig(definition: SettingDefinition) {
  return {
    name: definition.key,
    displayName: definition.displayName,
    pluralName: definition.pluralName,
    apiEndpoint: `/api/v1/setting?datalabel=${definition.datalabel}`,
    columns: createSettingsColumns(),
    fields: createSettingsFields(),
    supportedViews: definition.supportedViews || ['table'],
    defaultView: definition.defaultView || 'table'
  };
}
```

#### 2. **settingsLoader.v2.ts** - Refactored Loader

**Location:** `apps/web/src/lib/settingsLoader.v2.ts`

**Purpose:** Clean, SOLID-compliant settings data loader

```typescript
// Strategy Pattern - Cache management
class SettingsCache {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  get(datalabel: string): SettingOption[] | null { /* ... */ }
  set(datalabel: string, data: SettingOption[]): void { /* ... */ }
  clear(datalabel?: string): void { /* ... */ }
}

// Dependency Inversion - HTTP client interface
class AuthenticatedHttpClient implements HttpClient {
  async fetch(url: string): Promise<any> { /* ... */ }
}

// Generic loader works for all 13 settings
export async function loadSettingOptions(
  datalabel: string,
  forceRefresh: boolean = false
): Promise<SettingOption[]> {
  if (!forceRefresh) {
    const cached = cache.get(datalabel);
    if (cached) return cached;
  }

  const endpoint = getSettingEndpoint(datalabel);
  const result = await httpClient.fetch(endpoint);
  const options = result.data.map(transformToOption).sort(...);

  cache.set(datalabel, options);
  return options;
}
```

#### 3. **settingsApi.ts** - Type-Safe API Client

**Location:** `apps/web/src/lib/api/settingsApi.ts`

**Purpose:** Clean interface for settings CRUD operations

```typescript
export class SettingsApi {
  async list(datalabel: string): Promise<SettingItem[]> {
    const response = await httpClient.get<SettingResponse>(
      `/api/v1/setting?datalabel=${datalabel}`
    );
    return response.data;
  }

  async get(datalabel: string, id: string): Promise<SettingItem> { /* ... */ }

  async update(datalabel: string, id: string, data: SettingUpdateData): Promise<SettingItem> {
    const response = await httpClient.put<SettingUpdateResponse>(
      `/api/v1/setting/${datalabel}/${id}`,
      data
    );
    return response.data;
  }

  async getCategories(): Promise<{ datalabel_name: string; item_count: number }[]> { /* ... */ }
}

export const settingsApi = new SettingsApi(); // Singleton export
```

### Entity Configuration Registry

**Location:** `apps/web/src/lib/entityConfig.ts`

```typescript
// Uses factory pattern from settingsConfig.ts
export const entityConfigs = {
  // Settings entities (13 total) - Generated from factory
  projectStage: {
    ...createSettingsEntityConfig(
      SETTINGS_REGISTRY.find(s => s.key === 'projectStage')!
    )
  },

  taskStage: {
    ...createSettingsEntityConfig(
      SETTINGS_REGISTRY.find(s => s.key === 'taskStage')!
    )
  },

  // ... 11 more settings entities

  // Core entities still use explicit config
  project: {
    fields: [
      { key: 'project_stage', loadOptionsFromSettings: true },
      { key: 'office_level', loadOptionsFromSettings: true }
    ]
  },

  task: {
    fields: [
      { key: 'stage', loadOptionsFromSettings: true },
      { key: 'priority_level', loadOptionsFromSettings: true }
    ]
  }
};
```

### Sequential State Configuration

**Location:** `apps/web/src/lib/sequentialStateConfig.ts`

```typescript
// Centralized pattern matching for sequential states
export const SEQUENTIAL_STATE_CONFIG = {
  patterns: ['stage', 'funnel', 'status', 'pipeline'],

  explicitIncludes: [
    'project_stage',
    'task_stage',
    'opportunity_funnel_stage',
    'form_submission_status',
    'wiki_publication_status'
  ],

  explicitExcludes: [
    'active_flag',
    'priority_level'
  ]
};

export function isSequentialState(fieldKey: string): boolean {
  if (SEQUENTIAL_STATE_CONFIG.explicitExcludes.includes(fieldKey)) {
    return false;
  }

  if (SEQUENTIAL_STATE_CONFIG.explicitIncludes.includes(fieldKey)) {
    return true;
  }

  return SEQUENTIAL_STATE_CONFIG.patterns.some(pattern =>
    fieldKey.toLowerCase().includes(pattern)
  );
}
```

### Frontend Middleware

**Location:** `apps/web/src/components/shared/entity/EntityFormContainer.tsx`

```typescript
// Auto-loads settings for fields marked with loadOptionsFromSettings
useEffect(() => {
  const fieldsNeedingSettings = config.fields
    .filter(f => f.loadOptionsFromSettings)
    .map(f => f.key);

  // Load all required settings in parallel
  Promise.all(
    fieldsNeedingSettings.map(fieldKey =>
      fetch(`/api/v1/setting?datalabel=${fieldKey}`)
        .then(res => res.json())
    )
  ).then(results => {
    // Cache settings in component state
    setSettingsCache(results);
  });
}, [config]);
```

---

## User Interaction Flow Examples

### Example 1: Create Project with Stage Dropdown

**User Actions:**
1. Navigate to `/project/new`
2. Fill project name: "Digital Transformation"
3. Click "Project Stage" dropdown
4. Dropdown auto-populates from settings
5. Select "Planning"
6. Click "Save"

**System Flow:**
```
Frontend                         API                            Database
--------                         ---                            --------
1. EntityFormContainer mounts
   └─ Detects project_stage has loadOptionsFromSettings: true

2. Auto-load settings
   └─ GET /api/v1/setting?datalabel=project_stage
                                ├→ Query setting_datalabel_project_stage
                                   SELECT level_name, sort_order
                                   WHERE active_flag = true
                                   ORDER BY sort_order ASC
   ←─ Returns:
      {
        data: [
          { id: "0", level_name: "Initiation", sort_order: 1 },
          { id: "1", level_name: "Planning", sort_order: 2 },
          { id: "2", level_name: "Execution", sort_order: 3 },
          ...
        ]
      }

3. Render dropdown
   └─ Options: Initiation, Planning, Execution, Monitoring, Closure

4. User selects "Planning"
   └─ formValues.project_stage = "Planning"

5. User clicks "Save"
   └─ POST /api/v1/project
      Body: {
        name: "Digital Transformation",
        project_stage: "Planning"        ← Stores level_name
      }
                                ├→ INSERT INTO d_project
                                   (name, project_stage)
                                   VALUES ('Digital...', 'Planning')
   ←─ 201 Created

6. navigate(`/project/${created.id}`)
```

### Example 2: Sequential State Visualizer on Task Edit

**User Actions:**
1. Navigate to `/task/a1111111-1111-1111-1111-111111111111`
2. Click "Edit" button
3. See task stage as interactive timeline (not dropdown)
4. Current stage: "In Progress" (highlighted)
5. Click "In Review" to advance
6. Timeline updates with animation

**System Flow:**
```
Frontend                         API                            Database
--------                         ---                            --------
1. EntityDetailPage loads
   └─ GET /api/v1/task/{id}
                                ├→ SELECT * FROM d_task
                                   WHERE id = $id
   ←─ Returns: { id, name, stage: "In Progress" }

2. Edit mode activated
   └─ EntityFormContainer
      ├─ Field: stage (loadOptionsFromSettings: true)
      └─ Check isSequentialState('stage') → TRUE

3. Load settings for timeline
   └─ GET /api/v1/setting?datalabel=task_stage
                                ├→ SELECT * FROM setting_datalabel_task_stage
                                   ORDER BY sort_order ASC
   ←─ Returns:
      [
        { level_name: "Backlog", sort_order: 1 },
        { level_name: "To Do", sort_order: 2 },
        { level_name: "In Progress", sort_order: 3 },
        { level_name: "In Review", sort_order: 4 },
        { level_name: "Done", sort_order: 5 }
      ]

4. Render SequentialStateVisualizer
   └─ Timeline: ● Backlog → ● To Do → ● In Progress → ○ In Review → ○ Done
                 ↑ Blue       ↑ Blue    ↑ Blue+ring    ↑ Gray         ↑ Gray

5. User clicks "In Review"
   └─ onChange('In Review')
      └─ formValues.stage = "In Review"

6. Auto-save (inline edit)
   └─ PUT /api/v1/task/{id}
      Body: { stage: "In Review" }
                                ├→ UPDATE d_task
                                   SET stage = 'In Review',
                                       version = version + 1,
                                       updated_ts = now()
                                   WHERE id = $id
   ←─ 200 OK

7. Timeline updates
   └─ ● Backlog → ● To Do → ● In Progress → ● In Review → ○ Done
      ↑ Blue       ↑ Blue    ↑ Blue          ↑ Blue+ring  ↑ Gray
```

### Example 3: Business User Adds New Task Priority

**User Actions:**
1. Navigate to `/settings` (admin page)
2. Select "Task Priority" category
3. Click "+ Add Priority"
4. Enter:
   - level_name: "Critical"
   - sort_order: 0 (highest)
5. Click "Save"
6. New priority appears in all task dropdowns immediately

**System Flow:**
```
Frontend                         API                            Database
--------                         ---                            --------
1. SettingsManagementPage
   └─ GET /api/v1/setting?datalabel=task_priority
                                ├→ SELECT * FROM setting_datalabel_task_priority
   ←─ Current priorities: Low, Medium, High

2. User fills form
   └─ { level_name: "Critical", sort_order: 0 }

3. Submit new priority
   └─ POST /api/v1/setting (future endpoint)
      Body: {
        category: "task_priority",
        level_name: "Critical",
        sort_order: 0,
        active_flag: true
      }
                                ├→ INSERT INTO setting_datalabel_task_priority
                                   (level_name, sort_order, active_flag)
                                   VALUES ('Critical', 0, true)
   ←─ 201 Created

4. Frontend refreshes settings cache
   └─ All components with task_priority dropdown reload
      └─ New options: Critical, Low, Medium, High
```

### Example 4: Kanban Board Auto-Grouped by Stage Settings

**User Actions:**
1. Navigate to `/task` (list view)
2. Switch to "Kanban" view
3. Columns appear automatically based on task_stage settings
4. Drag task from "To Do" to "In Progress"
5. Task updates in database

**System Flow:**
```
Frontend                         API                            Database
--------                         ---                            --------
1. KanbanBoard mounts
   ├─ GET /api/v1/setting?datalabel=task_stage
   │                          ├→ SELECT * FROM setting_datalabel_task_stage
   │                             ORDER BY sort_order ASC
   ←─ Stages: Backlog, To Do, In Progress, In Review, Done
   │
   └─ GET /api/v1/task
                                ├→ SELECT * FROM d_task
                                   WHERE active_flag = true
   ←─ Tasks: [{id, name, stage}, ...]

2. Group tasks by stage
   └─ {
        "Backlog": [task1, task2],
        "To Do": [task3],
        "In Progress": [task4, task5],
        "In Review": [],
        "Done": [task6]
      }

3. Render columns
   └─ [Backlog: 2] [To Do: 1] [In Progress: 2] [In Review: 0] [Done: 1]
      └─ Column order determined by sort_order from settings

4. User drags task3 from "To Do" to "In Progress"
   └─ onCardMove(task3.id, "In Progress")
      └─ PUT /api/v1/task/{task3.id}
         Body: { stage: "In Progress" }
                                ├→ UPDATE d_task
                                   SET stage = 'In Progress'
   ←─ 200 OK

5. UI updates
   └─ [Backlog: 2] [To Do: 0] [In Progress: 3] [In Review: 0] [Done: 1]
```

---

## Critical Considerations When Editing

### ⚠️ Breaking Changes to Avoid

#### 1. **Table Naming Convention** ⭐⭐⭐ CRITICAL

**DO NOT rename settings tables:**

```sql
-- ❌ DANGEROUS: Breaks API mapping
ALTER TABLE setting_datalabel_project_stage
RENAME TO project_stage_settings;

-- Frontend expects: setting_datalabel_{category}
-- API mapping:      category → setting_datalabel_{category}
```

**Why Critical:**
- API has hardcoded category-to-table mappings
- Frontend assumes `setting_datalabel_` prefix
- Renaming breaks all dropdowns using that category

**Files to Watch:**
- `apps/api/src/modules/setting/routes.ts` - All category mappings
- 17 DDL files: `db/setting_datalabel__*.ddl`

#### 2. **Field Name Standards**

Settings tables use different field names but API normalizes them:

```sql
-- Some tables use level_name
CREATE TABLE setting_datalabel_project_stage (
  level_name varchar(50)  -- ✅
);

-- Others use stage_name
CREATE TABLE setting_datalabel_opportunity_funnel_stage (
  stage_name varchar(50)  -- ✅
);

-- API normalizes to common structure
SELECT level_name FROM ... -- → returns "name" field
SELECT stage_name FROM ... -- → returns "name" field
```

**DO NOT mix naming within same table:**
```sql
-- ❌ BAD: Inconsistent naming
CREATE TABLE setting_datalabel_project_stage (
  stage_name varchar(50),  -- Should be level_name!
  level_descr text
);
```

#### 3. **Active Flag Filtering**

All dropdowns filter by `active_flag = true`:

```sql
-- ✅ GOOD: Soft delete removes from dropdowns
UPDATE setting_datalabel_project_stage
SET active_flag = false
WHERE level_name = 'On Hold';

-- ❌ DANGEROUS: Hard delete breaks referential integrity (if foreign keys exist)
DELETE FROM setting_datalabel_project_stage
WHERE level_name = 'On Hold';
```

**Impact:**
- `active_flag = false` → Removed from NEW form dropdowns
- Existing entity records keep old values (string storage)
- No CASCADE delete issues

#### 4. **Sort Order Must Be Unique**

Sequential states depend on sort_order for display sequence:

```sql
-- ❌ BAD: Duplicate sort_order breaks timeline
INSERT INTO setting_datalabel_project_stage VALUES
(0, 'Initiation', 'Starting', 1, NULL),
(1, 'Planning', 'Planning', 1, 0);  -- Same sort_order!

-- ✅ GOOD: Unique sort_order
INSERT INTO setting_datalabel_project_stage VALUES
(0, 'Initiation', 'Starting', 1, NULL),
(1, 'Planning', 'Planning', 2, 0);  -- Unique!
```

**Why:** SequentialStateVisualizer orders stages by `sort_order ASC`. Duplicates cause unpredictable display order.

#### 5. **Parent ID Relationships**

`parent_id` creates graph-like workflow relationships:

```sql
-- Valid relationships
(1, 'Planning', 2, 0),       -- Planning follows Initiation (parent_id=0)
(2, 'Execution', 3, 1),      -- Execution follows Planning (parent_id=1)
(5, 'On Hold', 6, 2),        -- On Hold branches from Execution (parent_id=2)

-- ❌ BAD: Circular reference
(0, 'Initiation', 1, 6),     -- parent_id=6 (Cancelled)
(6, 'Cancelled', 7, 0);      -- parent_id=0 (Initiation)  → CIRCULAR!
```

**Why:** Circular `parent_id` references break workflow visualization graphs.

#### 6. **Category Name Must Match Field Key**

Frontend expects exact snake_case match:

```typescript
// ✅ GOOD: Field key matches API category
{
  key: 'project_stage',             // Field in entity
  loadOptionsFromSettings: true     // Category = 'project_stage'
}
// API: GET /api/v1/setting?datalabel=project_stage
// Table: setting_datalabel_project_stage

// ❌ BAD: Mismatch breaks auto-loading
{
  key: 'projectStage',              // camelCase!
  loadOptionsFromSettings: true     // Category = 'projectStage' → NO TABLE!
}
```

#### 7. **Don't Store level_id in Entity Tables**

Entity fields store `level_name` (string), not `level_id` (integer):

```sql
-- ✅ GOOD: Store display name
CREATE TABLE d_project (
  project_stage text  -- Stores "Planning", not 1
);

-- ❌ BAD: Integer reference requires JOIN
CREATE TABLE d_project (
  project_stage_id integer  -- Requires JOIN for display
);
```

**Why:**
- Simple queries: `WHERE project_stage = 'Planning'`
- No JOIN overhead for display
- Resilient to settings table changes
- Trade-off: No foreign key enforcement

---

### 🔧 Safe Modification Patterns

#### Adding New Settings Category

**1. Create DDL File** (`db/setting_datalabel__risk_level.ddl`)
```sql
CREATE TABLE app.setting_datalabel_risk_level (
    level_id integer PRIMARY KEY,
    level_name varchar(50) NOT NULL UNIQUE,
    level_descr text,
    sort_order integer,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now()
);

INSERT INTO app.setting_datalabel_risk_level VALUES
(1, 'Low', 'Minimal risk', 1, true),
(2, 'Medium', 'Moderate risk', 2, true),
(3, 'High', 'Significant risk', 3, true);
```

**2. Add API Mapping** (`apps/api/src/modules/setting/routes.ts`)
```typescript
} else if (category === 'risk_level') {
  query = sql`
    SELECT
      level_id::text as id,
      level_name,
      level_descr,
      sort_order,
      active_flag
    FROM app.setting_datalabel_risk_level
    WHERE active_flag = ${active !== false}
    ORDER BY sort_order ASC
  `;
  categoryName = 'risk_level';
}
```

**3. Add to Entity Config** (`apps/web/src/lib/entityConfig.ts`)
```typescript
project: {
  fields: [
    // ... existing fields
    {
      key: 'risk_level',
      label: 'Risk Level',
      type: 'select',
      loadOptionsFromSettings: true  // Auto-loads from API
    }
  ]
}
```

**4. Run Database Import**
```bash
./tools/db-import.sh
# Adds new DDL file to schema
```

#### Adding Sequential State Visualization

**1. Ensure Field Name Matches Pattern**
```typescript
// Field must contain 'stage', 'funnel', 'status', or 'pipeline'
{
  key: 'project_stage'  // ✅ Contains 'stage'
}
```

**2. Add to Explicit Includes (if needed)**
```typescript
// apps/web/src/lib/sequentialStateConfig.ts
export const SEQUENTIAL_STATE_EXPLICIT_INCLUDES = [
  'project_stage',
  'task_stage',
  'risk_level'  // ← Add new sequential field
];
```

**3. Verify Settings Have sort_order**
```sql
-- Must have sort_order for timeline sequencing
SELECT level_name, sort_order
FROM setting_datalabel_risk_level
ORDER BY sort_order ASC;
```

---

### 📝 Testing Checklist

When modifying settings system, verify:

- [ ] **Table naming** follows `setting_datalabel_{category}` convention
- [ ] **Category name** matches field key in snake_case
- [ ] **API mapping** added to setting/routes.ts
- [ ] **sort_order** values are unique and sequential
- [ ] **active_flag** filtering works correctly
- [ ] **parent_id** relationships are acyclic
- [ ] **Dropdowns** populate correctly in forms
- [ ] **Sequential visualizer** renders for stage fields
- [ ] **Kanban boards** group by stage settings
- [ ] **Inline editing** updates entity field values
- [ ] **Settings changes** reflect immediately (no cache issues)
- [ ] **Soft deletes** remove from dropdowns but don't break entities
- [ ] **New settings** appear in all relevant dropdowns
- [ ] **API response** structure matches expected format
- [ ] **No RBAC checks** (settings are public)

---

### 🧪 Testing Commands

```bash
# Start platform
./tools/start-all.sh

# Test settings API
./tools/test-api.sh GET /api/v1/setting?datalabel=project_stage
./tools/test-api.sh GET /api/v1/setting?datalabel=task_stage
./tools/test-api.sh GET /api/v1/setting?datalabel=task_priority

# Check all settings categories
for cat in project_stage task_stage task_priority opportunity_funnel_stage \
           office_level business_level position_level industry_sector \
           acquisition_channel customer_tier client_level client_status \
           form_submission_status form_approval_status wiki_publication_status; do
  echo "Testing: $cat"
  ./tools/test-api.sh GET /api/v1/setting?datalabel=$cat
done

# Verify settings table exists
./tools/run_query.sh "\dt app.setting_datalabel_*"

# Check specific settings table
./tools/run_query.sh "SELECT * FROM app.setting_datalabel_project_stage ORDER BY sort_order;"

# Count active settings
./tools/run_query.sh "SELECT category, COUNT(*) FROM (
  SELECT 'project_stage' as category FROM app.setting_datalabel_project_stage WHERE active_flag = true
  UNION ALL
  SELECT 'task_stage' FROM app.setting_datalabel_task_stage WHERE active_flag = true
  UNION ALL
  SELECT 'task_priority' FROM app.setting_datalabel_task_priority WHERE active_flag = true
) t GROUP BY category;"

# Verify no circular parent_id references
./tools/run_query.sh "
WITH RECURSIVE stage_tree AS (
  SELECT level_id, level_name, parent_id, 0 as depth
  FROM app.setting_datalabel_project_stage
  WHERE parent_id IS NULL
  UNION ALL
  SELECT s.level_id, s.level_name, s.parent_id, st.depth + 1
  FROM app.setting_datalabel_project_stage s
  INNER JOIN stage_tree st ON s.parent_id = st.level_id
  WHERE st.depth < 10  -- Prevent infinite loop
)
SELECT * FROM stage_tree ORDER BY depth, level_id;
"

# View logs
./tools/logs-api.sh -f
./tools/logs-web.sh -f

# Reset database (includes all settings)
./tools/db-import.sh
```

---

## 📚 Related Documentation

**Core Settings:**
- **[Database Schema](../db/README.md)** - Complete DDL reference for all 17 settings tables
- **[API Guide](../apps/api/README.md)** - Backend architecture and settings routes
- **[Frontend Guide](../apps/web/README.md)** - UI/UX patterns and component usage
- **[Entity Configuration](../apps/web/src/lib/entityConfig.ts)** - loadOptionsFromSettings usage
- **[Project & Task Guide](./Project_Task.md)** - Entity usage of settings
- **[Form Guide](./form.md)** - Form-specific settings integration

**Data Table Components:**
- **[SettingsDataTable](./settings_datatable.md)** - Dedicated table component for settings pages
- **[EntityDataTable](./entity_datatable.md)** - Full-featured table for entity pages
- **[DataTable Overview](./data_table.md)** - Overview of both table components

---

## 🎯 Summary

**Settings (Data Labels)** are the configuration backbone of the PMO platform:

### v3.1 Architecture (Current)

**Core Settings System:**
- **Unified JSONB table** (`app.setting_datalabel`) storing all settings metadata
- **13 settings entities** managed via DRY factory pattern
- **3 core files** implementing SOLID principles:
  - `settingsConfig.ts` - Central registry and factory functions
  - `settingsLoader.v2.ts` - Refactored loader with caching
  - `settingsApi.ts` - Type-safe API client

**New Entity Management (v3.2):**
- **Entity Registry** (`d_entity`) - Platform entity type catalog with CRUD interface
- **Centralized Icon System** - 17 curated Lucide icons with explicit imports (iconMapping.ts)
- **Child Entity Mapping** - JSONB-based parent-child relationships with visual management
- **Compact Table Design** - Standardized styling across all settings pages

**Key Patterns:**
- Pattern 8: Centralized Icon Registry (explicit imports with iconMapping.ts)
- Pattern 9: Child Entity Relationship Mapping (JSONB + visual UI)
- Pattern 10: Compact Table Styling System (standardized utilities)
- **Datalabel-to-table mapping** enables dynamic API routing
- **Factory pattern** reduces code by ~80% (~600 → ~150 lines)
- **loadOptionsFromSettings** pattern eliminates hardcoded options
- **Sequential state visualization** auto-detects workflow stages
- **Inline editing** with color-coded badges and dropdown editors
- **Active flag filtering** controls dropdown visibility
- **No RBAC required** - settings are public configuration
- **Snake_case convention** for consistent naming across stack

**Key Principle:** Field key → API datalabel → Settings table. Always follow `setting_datalabel__{datalabel}` naming convention and snake_case mapping.

**Critical Pattern:** `loadOptionsFromSettings: true` in entity config triggers automatic API call to `/api/v1/setting?datalabel={field_key}`.

**DRY Benefits:**
- **Single source of truth** - All settings defined once in SETTINGS_REGISTRY
- **Type safety** - Full TypeScript type checking
- **Maintainability** - Changes in one place affect all entities
- **Extensibility** - Add new settings by updating registry (2 lines vs 60 lines)

**Common Mistake:** Using camelCase field keys breaks datalabel mapping. Always use snake_case: `project_stage` not `projectStage`.

---

## Entity Management System (v3.1)

### Overview

The **Entity Management System** provides a runtime configuration interface for managing platform entities, icons, and hierarchical relationships.

**Location:** `/settings` → Entities section

**Key Capabilities:**
- ✅ **Entity CRUD** - Add, edit, delete entity types via UI
- ✅ **Dynamic Icons** - Choose from 1000+ Lucide icons with search
- ✅ **Child Relationships** - Map parent-child entities for navigation
- ✅ **Display Configuration** - Control entity ordering and presentation

### Entity Registry Database

**Table:** `d_entity`

```sql
CREATE TABLE app.d_entity (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  ui_label VARCHAR(100) NOT NULL,
  ui_icon VARCHAR(50),
  display_order INTEGER NOT NULL DEFAULT 0,
  active_flag BOOLEAN NOT NULL DEFAULT true,
  child_entities JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Sample Data:**
```sql
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, display_order, child_entities) VALUES
('project', 'project', 'Projects', 'FolderKanban', 1, '[
  {"entity":"task","ui_icon":"CheckSquare","ui_label":"Tasks","order":1},
  {"entity":"wiki","ui_icon":"BookOpen","ui_label":"Wiki","order":2}
]'::jsonb);
```

### Entity Management API

**Base:** `/api/v1/entity`

**Endpoints:**

```typescript
// GET /api/v1/entity/types - Get all entities with children
Response: {
  code: "project",
  name: "project",
  ui_label: "Projects",
  ui_icon: "FolderKanban",
  display_order: 1,
  child_entities: [
    { entity: "task", ui_icon: "CheckSquare", ui_label: "Tasks", order: 1 }
  ]
}

// PUT /api/v1/entity/:code - Update entity
Body: { ui_label: "Projects", ui_icon: "FolderKanban" }

// PUT /api/v1/entity/:code/children - Update child entities
Body: {
  child_entities: [
    { entity: "task", ui_icon: "CheckSquare", ui_label: "Tasks", order: 1 }
  ]
}

// DELETE /api/v1/entity/:code - Delete entity
Response: { success: true, message: "Entity deleted" }
```

### Pattern 8: Centralized Icon Registry

**Problem:** Wildcard imports (`import * as LucideIcons`) don't work in Vite/React - icons are undefined at runtime.

**Solution:** Explicit named imports with centralized icon map.

```typescript
// apps/web/src/lib/iconMapping.ts

import {
  Building2,
  MapPin,
  FolderOpen,
  UserCheck,
  FileText,
  BookOpen,
  CheckSquare,
  Users,
  Package,
  Warehouse,
  ShoppingCart,
  Truck,
  Receipt,
  Briefcase,
  BarChart,
  DollarSign,
  TrendingUp,
  type LucideIcon
} from 'lucide-react';

// Map icon names to components
const iconMap: Record<string, LucideIcon> = {
  'Building2': Building2,
  'MapPin': MapPin,
  'FolderOpen': FolderOpen,
  'UserCheck': UserCheck,
  'FileText': FileText,
  'BookOpen': BookOpen,
  'CheckSquare': CheckSquare,
  'Users': Users,
  'Package': Package,
  'Warehouse': Warehouse,
  'ShoppingCart': ShoppingCart,
  'Truck': Truck,
  'Receipt': Receipt,
  'Briefcase': Briefcase,
  'BarChart': BarChart,
  'DollarSign': DollarSign,
  'TrendingUp': TrendingUp,
};

export function getIconComponent(iconName?: string | null): LucideIcon {
  if (!iconName) return FileText;
  return iconMap[iconName] || FileText;
}
```

**Usage in Components:**

```typescript
// Sidebar navigation (Layout.tsx)
const mainNavigationItems = entityTypes.map((entity) => ({
  name: entity.name,
  href: `/${entity.code}`,
  icon: getIconComponent(entity.ui_icon),  // Store component reference
  code: entity.code
}));

// Render
const IconComponent = item.icon;
<IconComponent className="h-5 w-5" />
```

```typescript
// Settings table (SettingsOverviewPage.tsx)
{React.createElement(getIconComponent(entity.ui_icon), {
  className: "h-4 w-4 text-gray-600"
})}
```

**Benefits:**
- ✅ **Guaranteed compatibility** - Works in all React/Vite environments
- ✅ **Type-safe** - Full TypeScript support with LucideIcon type
- ✅ **Centralized** - Single source of truth in `iconMapping.ts`
- ✅ **Automatic fallback** - Defaults to FileText for missing icons
- ✅ **Easy to extend** - Add new icons by importing and adding to map

**How to Add New Icons:**

1. Import the icon in `iconMapping.ts`:
   ```typescript
   import { Building2, NewIcon } from 'lucide-react';
   ```

2. Add to icon map:
   ```typescript
   const iconMap: Record<string, LucideIcon> = {
     'Building2': Building2,
     'NewIcon': NewIcon,
     // ...
   };
   ```

3. Update `AVAILABLE_ICON_NAMES` in SettingsOverviewPage.tsx:
   ```typescript
   const AVAILABLE_ICON_NAMES = [
     'Building2', 'MapPin', 'NewIcon', // ...
   ].sort();
   ```

**Critical Note:** Wildcard imports (`import * as LucideIcons`) **do not work** in Vite. Individual icon exports are not enumerable at runtime, causing icons to render as undefined. Always use explicit named imports.

### Pattern 9: Child Entity Relationship Mapping

**Problem:** Static entity relationships require code changes; navigation structures are hard-coded.

**Solution:** JSONB child entities array with visual management interface.

```typescript
interface ChildEntity {
  entity: string;        // Child entity code
  ui_icon: string;       // Lucide icon name
  ui_label: string;      // Display name
  order: number;         // Display sequence
}

// Stored as JSONB in d_entity.child_entities
child_entities: [
  { entity: 'task', ui_icon: 'CheckSquare', ui_label: 'Tasks', order: 1 },
  { entity: 'wiki', ui_icon: 'BookOpen', ui_label: 'Wiki', order: 2 }
]
```

**Benefits:**
- ✅ Runtime relationship configuration
- ✅ Visual modal management
- ✅ Icon customization per child
- ✅ Automatic tab generation

### Pattern 10: Compact Table Styling System

**Problem:** Inconsistent table styling across settings pages.

**Solution:** Standardized utility classes for compact design.

```typescript
// Table Header
<thead className="bg-gray-50/80">
  <tr className="border-b border-gray-200">
    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
      Code
    </th>
  </tr>
</thead>

// Table Body
<tbody className="bg-white divide-y divide-gray-100">
  <tr className="hover:bg-gray-50/50 transition-colors">
    <td className="px-3 py-2.5">
      <span className="text-[11px] font-medium text-gray-900">{entity.name}</span>
    </td>
  </tr>
</tbody>
```

**Standards:**
- Header: `text-[10px]`, `font-semibold`, `text-gray-600`
- Data: `text-[11px]`, `font-medium`, `text-gray-900`
- Padding: `px-3 py-2.5` (consistent)
- Hover: `hover:bg-gray-50/50 transition-colors`

---

## Entity Management Quick Start

### Common Tasks

**Add Entity:**
```
1. Navigate to /settings → Entities section
2. Click "Add Entity" button
3. Fill: code, name, ui_label, icon (via picker), display_order
4. Click Save → Entity available for routing
```

**Change Icon:**
```
1. Find entity → Click edit icon
2. Click icon picker → Search (e.g., "todo")
3. Click desired icon → Auto-updates
4. Click save (green checkmark)
```

**Add Child Entities:**
```
1. Find parent entity → Click "0 children" badge
2. Modal opens → Search for child (e.g., "task")
3. Click child entity → Added to list
4. Optional: Click child icon to change
5. Click Done → Saved
```

### Icon System Usage

```typescript
// ✅ ALWAYS use LucideIcons namespace
import * as LucideIcons from 'lucide-react';

const EntityIcon = getIconComponent(entity.ui_icon);
<EntityIcon className="h-4 w-4 text-gray-600" />

// ❌ NEVER import directly (breaks with wildcard)
import { Tag, Plus } from 'lucide-react';  // ERROR
<Tag />  // ReferenceError: Tag is not defined
```

### Critical Gotchas

**1. Icon References:**
```typescript
// ❌ Direct reference breaks
<Tag />  // ReferenceError

// ✅ Use namespace
<LucideIcons.Tag />
```

**2. JSONB Parsing:**
```typescript
// ✅ Always parse from database
let childEntities = row.child_entities || [];
if (typeof childEntities === 'string') {
  childEntities = JSON.parse(childEntities);
}
if (!Array.isArray(childEntities)) {
  childEntities = [];
}
```

**3. Prevent Circular Relationships:**
```typescript
// ✅ Filter out self and existing children
const available = entities.filter(e =>
  e.code !== selectedEntity.code &&
  !(selectedEntity.child_entities || []).some(c => c.entity === e.code)
);
```

### Testing Checklist

**Entity Management:**
- [ ] Add new entity via UI
- [ ] Edit entity name, label, icon
- [ ] Delete entity (soft delete)
- [ ] Change display order
- [ ] Verify entity in navigation

**Icon System:**
- [ ] Search icons by name
- [ ] Select from picker
- [ ] Icon renders in table
- [ ] Icon persists after save
- [ ] Fallback for invalid icon

**Child Entities:**
- [ ] Add child via modal
- [ ] Remove child
- [ ] Change child icon
- [ ] Tooltip shows children
- [ ] Children appear in tabs

---

**Last Updated:** 2025-10-31
**Version:** v3.1 (Entity Management System & Dynamic Icon Registry)
**Maintainer:** PMO Platform Team
**Settings Count:** 13 datalabel entities, 1 entity registry
**Code Reduction:** 80% (from ~700 to ~150 lines)
