# WelcomePage

**Version:** 9.0.0 | **Location:** `apps/web/src/pages/WelcomePage.tsx` | **Updated:** 2025-12-03

---

## Overview

WelcomePage serves as the authenticated landing/dashboard page displaying platform value propositions, domain modules, entity catalog, and quick actions. It provides a comprehensive overview of the AI-first enterprise orchestration platform.

**Core Principles:**
- Authenticated dashboard with Layout wrapper
- 8 semantic domain modules
- Entity catalog with 30+ entities
- Quick actions for common tasks
- AI-first messaging throughout

---

## Page Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        WELCOMEPAGE ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Route: /welcome                                                            │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Hero Section (gradient banner)                                          ││
│  │  ┌───────────────────────────────┬─────────────────────────────────────┐││
│  │  │  Welcome back, {user.name}    │  Hero Highlights                    │││
│  │  │  AI-First Enterprise Platform │  ┌───────────────────────────────┐ │││
│  │  │                               │  │ -38% Operational friction     │ │││
│  │  │  [Deploy Semantic Model]      │  │ 12 tools → 1 semantic graph  │ │││
│  │  │  [Ask the Agent →]            │  │ 64 agentic routines live     │ │││
│  │  └───────────────────────────────┴──└───────────────────────────────┘ │││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Value Propositions (4-card grid)                                       ││
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌────────┐││
│  │  │ Cut operational │ │ Semantic graph  │ │ AI-first workflow│ │ Serve  │││
│  │  │ friction        │ │ customer + ops  │ │ engine          │ │ all    │││
│  │  └─────────────────┘ └─────────────────┘ └─────────────────┘ └────────┘││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Domain Modules (8-module grid)                                          ││
│  │  Organization | Customer | Operations | Products | Sales | Supply | ... ││
│  │  Each module shows entity chips that link to entity list pages           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Quick Actions (4 cards)                                                 ││
│  │  [Plan project] [Design entity model] [Automate workflow] [Invite team] ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Entity Catalog (table of 30+ entities)                                  ││
│  │  Code | Entity | Domain | Description | Navigate                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. Domain Modules (8 Semantic Domains)

```typescript
const domainModules: DomainModule[] = [
  {
    id: 'organization',
    title: 'Organization & Administration',
    summary: 'Structure offices, business units, roles, and calendars...',
    entities: ['business', 'office', 'office_hierarchy', 'role', 'employee', 'calendar']
  },
  {
    id: 'customer',
    title: 'Customer & Relationship Intelligence',
    entities: ['customer', 'worksite', 'interaction']
  },
  {
    id: 'operations',
    title: 'Operations & Workflow',
    entities: ['project', 'task', 'workflow', 'work_order', 'event']
  },
  // ... 5 more domains
];
```

### 2. Entity Catalog (30+ Entities)

```typescript
const entityCatalog: EntityCatalogItem[] = [
  { code: 'project', name: 'Project', domainId: 'operations', path: '/project' },
  { code: 'task', name: 'Task', domainId: 'operations', path: '/task' },
  { code: 'customer', name: 'Customer', domainId: 'customer', path: '/customer' },
  // ... 27+ more entities
];
```

### 3. Quick Actions

```typescript
const quickActions = [
  { label: 'Plan a project', path: '/project/new', icon: FolderKanban },
  { label: 'Design your entity model', path: '/entity-designer', icon: Layers },
  { label: 'Automate a workflow', path: '/workflow-automation', icon: Workflow },
  { label: 'Invite your team', path: '/employee', icon: Users }
];
```

### 4. Industries Served

```typescript
const industriesServed = [
  'Manufacturing',
  'Retail & eCommerce',
  'Supply Chain & Logistics',
  'Home & Field Services',
  'Contracting & Trades',
  'City & Civic Projects'
];
```

---

## Page Sections

| Section | Purpose |
|---------|---------|
| Hero | Welcome message with key metrics |
| Value Props | 4-card grid of platform benefits |
| Core Problem | Pain points vs AI-first solution |
| Semantic Highlights | 3 semantic modularity features |
| Integration Pain | Common integration problems solved |
| Domain Modules | 8 semantic domains with entity chips |
| Quick Actions | 4 common task shortcuts |
| Entity Catalog | Full table of all entities |

---

## Navigation Links

| Action | Target |
|--------|--------|
| Deploy Semantic Model | `/entity-designer` |
| Ask the Agent | `/chat` |
| View Linkage Graph | `/linkage` |
| Entity chips | `/{entityCode}` |

---

## Related Pages

| Page | Relationship |
|------|--------------|
| [LandingPage](./LandingPage.md) | Public landing |
| [EntityListOfInstancesPage](./EntityListOfInstancesPage.md) | Entity lists |
| [ChatPage](./ChatPage.md) | AI assistant |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v9.0.0 | 2025-12-03 | 8 domain modules + entity catalog |
| v1.0.0 | 2025-10-01 | Initial release |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
