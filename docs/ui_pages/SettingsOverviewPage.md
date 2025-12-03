# SettingsOverviewPage

**Version:** 9.1.0 | **Location:** `apps/web/src/pages/setting/SettingsOverviewPage.tsx` | **Updated:** 2025-12-03

---

## Overview

SettingsOverviewPage is the main settings hub that provides tabbed navigation for managing entities, data labels, access control, and integrations. It serves as the central configuration interface for the entire platform.

**Core Principles:**
- Tabbed navigation (entities, entityMapping, secretsVault, integrations, accessControl)
- Entity type management with inline editing
- Datalabel settings navigation
- RBAC permission management

---

## Page Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SETTINGSOVERVIEWPAGE ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Route: /settings                                                           │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Layout Shell                                                           ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Header: Settings Overview                      [Exit Settings]     │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Tab Bar                                                            │││
│  │  │  [Entities] [Entity Mapping] [Secrets Vault] [Integrations] [RBAC] │││
│  │  │   ════════                                                          │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Tab Content                                                        │││
│  │  │                                                                     │││
│  │  │  Entities Tab:                                                      │││
│  │  │  ┌─────────────────────────────────────────────────────────────┐   │││
│  │  │  │  Entity Types Table (code, name, icon, children, actions)   │   │││
│  │  │  │  + Datalabel Settings Cards (grouped by entity)             │   │││
│  │  │  └─────────────────────────────────────────────────────────────┘   │││
│  │  │                                                                     │││
│  │  │  Access Control Tab:                                                │││
│  │  │  ┌─────────────────────────────────────────────────────────────┐   │││
│  │  │  │  RBAC Permissions Table                                     │   │││
│  │  │  │  [+ Add Permission]                                         │   │││
│  │  │  └─────────────────────────────────────────────────────────────┘   │││
│  │  │                                                                     │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Main Tabs

| Tab | Purpose | Key Features |
|-----|---------|--------------|
| `entities` | Entity type management | Create/edit/delete entity types, manage children |
| `entityMapping` | Entity relationships | Configure parent-child hierarchies |
| `secretsVault` | API keys & secrets | Secure credential storage |
| `integrations` | Third-party connections | Configure external services |
| `accessControl` | RBAC permissions | View/edit/delete permission entries |

---

## Key Features

### 1. Entity Type Management

```typescript
interface EntityRow {
  code: string;              // Entity code (e.g., 'project')
  name: string;              // Internal name
  ui_label: string;          // Display label
  ui_icon?: string;          // Lucide icon name
  display_order: number;     // Sort order in sidebar
  active_flag: boolean;      // Active/inactive status
  child_entity_codes?: string[];  // Child entity types
}
```

### 2. Datalabel Settings Navigation

```typescript
// Convert datalabel name to URL
// dl__project_stage → /setting/projectStage
function toCamelCase(datalabelName: string): string {
  const withoutPrefix = datalabelName.replace(/^dl__/, '');
  const parts = withoutPrefix.split('_');
  return parts[0] + parts.slice(1).map(p =>
    p.charAt(0).toUpperCase() + p.slice(1)
  ).join('');
}
```

### 3. RBAC Data Table

```typescript
// Fetch RBAC permissions
const {
  data: rbacData,
  metadata: rbacMetadata,
  total: rbacTotal,
  isLoading: rbacLoading,
  refetch: refetchRbac,
} = useEntityInstanceData('rbac', rbacQueryParams);
```

### 4. Entity Configuration Modal

```tsx
<EntityConfigurationModal
  entity={selectedEntityForConfig}
  isOpen={showEntityConfigModal}
  onClose={() => setShowEntityConfigModal(false)}
  onSave={handleEntityUpdate}
/>
```

---

## Modals

| Modal | Purpose |
|-------|---------|
| AddDatalabelModal | Create new datalabel option |
| EntityConfigurationModal | Configure entity type settings |
| PermissionManagementModal | Add/edit RBAC permissions |

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SETTINGS DATA FLOW                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Page Load:                                                              │
│     - Fetch entity types from /api/v1/entity/types                         │
│     - Fetch datalabel categories from /api/v1/datalabel/categories         │
│     - Build settings cards grouped by entity                                │
│                                                                              │
│  2. Entity Tab:                                                             │
│     - Display entity types in editable table                                │
│     - Show datalabel settings cards below                                   │
│     - Click card → navigate to /setting/{camelCaseName}                     │
│                                                                              │
│  3. Access Control Tab:                                                     │
│     - Fetch RBAC data via useEntityInstanceData('rbac')                     │
│     - Display in EntityListOfInstancesTable                                 │
│     - Inline editing + row actions (edit, delete)                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Icon Picker

```typescript
const AVAILABLE_ICON_NAMES = [
  'Building2', 'MapPin', 'FolderOpen', 'UserCheck', 'FileText',
  'BookOpen', 'CheckSquare', 'Users', 'Package', 'Warehouse',
  'ShoppingCart', 'Truck', 'Receipt', 'Briefcase', 'BarChart',
  'DollarSign', 'TrendingUp'
].sort();

// Dynamic icon rendering
const IconComponent = getIconComponent(entity.ui_icon);
```

---

## Related Pages

| Page | Relationship |
|------|--------------|
| [SettingDetailPage](./SettingDetailPage.md) | Individual datalabel settings |
| [RBACOverviewPage](./RBACOverviewPage.md) | Full RBAC management |
| [EntityLinkagePage](./EntityLinkagePage.md) | Entity relationship config |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v9.1.0 | 2025-12-03 | TanStack Query for RBAC data |
| v8.0.0 | 2025-11-15 | Tabbed interface |
| v1.0.0 | 2025-10-01 | Initial release |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
