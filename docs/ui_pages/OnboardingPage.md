# OnboardingPage

**Version:** 9.0.0 | **Location:** `apps/web/src/pages/OnboardingPage.tsx` | **Updated:** 2025-12-03

---

## Overview

OnboardingPage allows new users to customize their workspace by selecting which entity modules they need. It displays entities grouped by category with recommended defaults and provides quick selection actions.

**Core Principles:**
- Post-signup module selection
- 5 category groups
- Recommended defaults
- Bulk selection actions
- Skip option available

---

## Page Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ONBOARDINGPAGE ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Route: /onboarding                                                         │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Header                                                                  ││
│  │  [Logo] Welcome to Huron PMO!                                           ││
│  │  Let's customize your workspace. Select the modules you need.           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Quick Actions                                                           ││
│  │  [Select Recommended] [Select All] [Clear All]                          ││
│  │  3 modules selected                                                      ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Core Operations                                                         ││
│  │  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐              ││
│  │  │ ✓ Projects     │ │ ✓ Tasks        │ │ ✓ Business    │              ││
│  │  │ [Recommended]  │ │ [Recommended]  │ │ [Recommended] │              ││
│  │  └────────────────┘ └────────────────┘ └────────────────┘              ││
│  │  ┌────────────────┐ ┌────────────────┐                                 ││
│  │  │ □ Offices      │ │ □ Worksites    │                                 ││
│  │  └────────────────┘ └────────────────┘                                 ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  People Management                                                       ││
│  │  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐              ││
│  │  │ ✓ Employees    │ │ □ Roles        │ │ □ Positions   │              ││
│  │  │ [Recommended]  │ │                │ │               │              ││
│  │  └────────────────┘ └────────────────┘ └────────────────┘              ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ... Content & Documentation, Commerce & Operations, Marketing ...          │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  [Continue to Dashboard →]                                               ││
│  │  Skip for now and configure later                                        ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. Entity Categories

```typescript
const categories = [
  'Core Operations',      // project, task, biz, office, worksite
  'People Management',    // employee, role, position, customer
  'Content & Documentation', // wiki, form, artifact
  'Commerce & Operations', // product, inventory, order, invoice, shipment
  'Marketing & Communication' // marketing
];
```

### 2. Entity Options with Recommendations

```typescript
const entityOptions: EntityOption[] = [
  {
    id: 'project',
    name: 'Projects',
    icon: FolderOpen,
    description: 'Manage projects from initiation to closure',
    category: 'Core Operations',
    recommended: true,
  },
  {
    id: 'task',
    name: 'Tasks',
    icon: CheckSquare,
    description: 'Track tasks with kanban boards and workflows',
    category: 'Core Operations',
    recommended: true,
  },
  // ... 16 more entities
];
```

### 3. Selection Actions

```typescript
const selectRecommended = () => {
  const recommended = entityOptions.filter(e => e.recommended).map(e => e.id);
  setSelectedEntities(recommended);
};

const selectAll = () => {
  setSelectedEntities(entityOptions.map(e => e.id));
};

const clearAll = () => {
  setSelectedEntities([]);
};
```

### 4. Configuration Handler

```typescript
const handleContinue = async () => {
  const response = await fetch('/api/v1/auth/customer/configure', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ entities: selectedEntities }),
  });

  localStorage.setItem('configured_entities', JSON.stringify(selectedEntities));
  navigate('/project');
};
```

---

## Entity Categories

| Category | Entities |
|----------|----------|
| Core Operations | project, task, biz, office, worksite |
| People Management | employee, role, position, customer |
| Content & Documentation | wiki, form, artifact |
| Commerce & Operations | product, inventory, order, invoice, shipment |
| Marketing & Communication | marketing |

---

## Recommended Entities

- Projects (recommended)
- Tasks (recommended)
- Business Units (recommended)
- Employees (recommended)

---

## API Endpoint

```
PUT /api/v1/auth/customer/configure
Headers: Authorization: Bearer {token}
Body: { entities: ['project', 'task', 'employee', ...] }
```

---

## Related Pages

| Page | Relationship |
|------|--------------|
| [SignupPage](./SignupPage.md) | Pre-registration |
| [WelcomePage](./WelcomePage.md) | Post-onboarding |
| [SettingsOverviewPage](./SettingsOverviewPage.md) | Later configuration |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v9.0.0 | 2025-12-03 | 5 category groups |
| v1.0.0 | 2025-10-01 | Initial release |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
