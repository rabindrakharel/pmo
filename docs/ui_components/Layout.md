# Layout Component

**Version:** 10.0.0 | **Location:** `apps/web/src/components/shared/layout/Layout.tsx` | **Updated:** 2025-12-03

---

## Overview

Layout is the main application shell that wraps all pages with consistent sidebar navigation, header, and user menu. It dynamically generates navigation from entity metadata and supports collapsible sidebar modes.

**Core Principles:**
- Single layout for entire application
- Dynamic navigation from entity metadata
- Collapsible sidebar (expanded/icon-only)
- Settings mode toggle

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            LAYOUT ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                          FULL LAYOUT (h-screen)                        │ │
│  │                                                                        │ │
│  │  ┌──────────────┐  ┌────────────────────────────────────────────────┐ │ │
│  │  │   SIDEBAR    │  │                  MAIN CONTENT                   │ │ │
│  │  │  (w-44/w-16) │  │                                                │ │ │
│  │  │              │  │  ┌────────────────────────────────────────────┐│ │ │
│  │  │  ┌────────┐  │  │  │  HEADER BAR                                ││ │ │
│  │  │  │  LOGO  │  │  │  │  [Entity Icon + Name]  [CreateButton]      ││ │ │
│  │  │  │  PMO   │  │  │  └────────────────────────────────────────────┘│ │ │
│  │  │  └────────┘  │  │                                                │ │ │
│  │  │              │  │  ┌────────────────────────────────────────────┐│ │ │
│  │  │  ┌────────┐  │  │  │  PAGE CONTENT                              ││ │ │
│  │  │  │Settings│  │  │  │  {children}                                ││ │ │
│  │  │  ├────────┤  │  │  │                                            ││ │ │
│  │  │  │Project │  │  │  │                                            ││ │ │
│  │  │  │Task    │  │  │  │                                            ││ │ │
│  │  │  │Employee│  │  │  │                                            ││ │ │
│  │  │  │...     │  │  │  │                                            ││ │ │
│  │  │  └────────┘  │  │  └────────────────────────────────────────────┘│ │ │
│  │  │              │  │                                                │ │ │
│  │  │  ┌────────┐  │  └────────────────────────────────────────────────┘ │ │
│  │  │  │User    │  │                                                     │ │
│  │  │  │Menu ▼  │  │                                                     │ │
│  │  │  └────────┘  │                                                     │ │
│  │  └──────────────┘                                                     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Props Interface

```typescript
interface LayoutProps {
  /** Page content to render */
  children: ReactNode;

  /** Optional create button configuration */
  createButton?: {
    label: string;
    href: string;
    entityCode: string;  // For RBAC permission check
  };
}
```

---

## Sidebar Modes

### Expanded Mode (w-44)
```
┌──────────────────┐
│ [PMO] Task Mgr ◀ │
├──────────────────┤
│ ⚙ Settings       │
│ 📁 Project       │
│ ✓ Task           │
│ 👤 Employee      │
│ 🏢 Office        │
│ ...              │
├──────────────────┤
│ 👤 James Miller ▼│
└──────────────────┘
```

### Collapsed Mode (w-16)
```
┌────┐
│PMO │
├────┤
│ ☰  │
├────┤
│ ⚙  │
│ 📁 │
│ ✓  │
│ 👤 │
│ 🏢 │
├────┤
│ 👤 │
└────┘
```

---

## Key Features

### 1. Dynamic Entity Navigation

```typescript
// Fetched from EntityMetadataContext
const { entities } = useEntityMetadata();

// Filter and sort active entities
const entityTypes = Array.from(entities.values())
  .filter(entity => entity.active_flag)
  .sort((a, b) => a.display_order - b.display_order);

// Generate nav items
const mainNavigationItems = entityTypes.map((entity) => ({
  name: entity.ui_label || entity.name,
  href: `/${entity.code}`,
  icon: entity.icon,
  code: entity.code
}));
```

### 2. Sidebar Context

```typescript
const { isVisible, isCollapsed, collapseSidebar, uncollapseSidebar } = useSidebar();

// Collapse on page load (maximize content)
useEffect(() => {
  collapseSidebar();
}, []);
```

### 3. Settings Mode Toggle

```typescript
const { isSettingsMode, enterSettingsMode, exitSettingsMode } = useSettings();

// Settings button in sidebar
<button onClick={enterSettingsMode}>
  <Settings className="h-5 w-5" />
  Settings
</button>
```

### 4. User Menu

```typescript
const profileNavigationItems = [
  { name: 'Profile', href: '/profile', icon: User },
  { name: 'Security', href: '/security', icon: Shield },
  { name: 'Billing', href: '/billing', icon: CreditCard },
];

// Dropdown menu with logout
<button onClick={handleLogout}>
  <LogOut className="h-4 w-4" />
  Logout
</button>
```

---

## Styling

### Sidebar
```css
.sidebar {
  width: 176px;               /* w-44 expanded */
  width: 64px;                /* w-16 collapsed */
  background: var(--dark-100);
  border-right: 1px solid var(--dark-300);
  transition: width 300ms ease-in-out;
}
```

### Navigation Item
```css
.nav-item {
  display: flex;
  align-items: center;
  padding: 6px 12px;          /* px-3 py-1.5 */
  color: var(--dark-700);
  border-radius: 8px 0 0 8px; /* rounded-l-lg */
}

.nav-item:hover {
  background: var(--dark-100);
  color: var(--dark-600);
}

.nav-item.active {
  background: var(--dark-100);
  border-right: 2px solid var(--slate-600);
}
```

### Logo Section
```css
.logo-container {
  height: 56px;               /* h-14 */
  padding: 0 16px;            /* px-4 */
  border-bottom: 1px solid var(--dark-300);
}

.logo-box {
  height: 28px;               /* h-7 */
  width: 28px;                /* w-7 */
  border: 1px solid var(--dark-400);
  border-radius: 4px;
}
```

---

## Icon Mapping

```typescript
import { getIconComponent } from '../../../lib/iconMapping';

// Entity icon from metadata
const IconComponent = getIconComponent(entity.icon);

// Renders appropriate Lucide icon
<IconComponent className="h-5 w-5 stroke-[1.5]" />
```

---

## Context Dependencies

| Context | Purpose |
|---------|---------|
| `AuthContext` | User info, logout function |
| `SidebarContext` | Collapse/expand state |
| `SettingsContext` | Settings mode toggle |
| `EntityMetadataContext` | Dynamic entity navigation |

---

## Related Components

| Component | Relationship |
|-----------|--------------|
| [CreateButton](./Button.md) | Header create action |
| [EntityListOfInstancesPage](./EntityListOfInstancesPage.md) | Main content pages |
| `SidebarContext` | Collapse state management |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v10.0.0 | 2025-12-03 | Design system v10.0 dark theme |
| v9.0.0 | 2025-11-28 | Dynamic entity navigation from metadata |
| v1.0.0 | 2025-10-01 | Initial release |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
