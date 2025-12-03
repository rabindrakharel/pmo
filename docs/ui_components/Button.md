# Button Component

**Version:** 12.0.0 | **Location:** `apps/web/src/components/shared/button/Button.tsx` | **Updated:** 2025-12-03

---

## Overview

Button is the universal button component following design system v12.0 with strict color mandates. All primary actions use slate-600 (NO green, NO blue for primary).

**Core Principles:**
- PRIMARY = `slate-600` (mandatory for all primary actions)
- Consistent sizing and spacing
- Icon support with loading states
- Accessible focus rings

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BUTTON VARIANTS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PRIMARY (slate-600)           SECONDARY (white)         DANGER (red-600)   │
│  ┌─────────────────────┐      ┌─────────────────────┐   ┌─────────────────┐ │
│  │  ██████████████████ │      │  ░░░░░░░░░░░░░░░░░░ │   │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ │
│  │    Save Changes     │      │      Cancel         │   │     Delete      │ │
│  │  ██████████████████ │      │  ░░░░░░░░░░░░░░░░░░ │   │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ │
│  └─────────────────────┘      └─────────────────────┘   └─────────────────┘ │
│                                                                              │
│  SUCCESS (slate-600)           GHOST (transparent)                          │
│  ┌─────────────────────┐      ┌─────────────────────┐                       │
│  │  ██████████████████ │      │                     │                       │
│  │     Confirm         │      │    More Options     │                       │
│  │  ██████████████████ │      │                     │                       │
│  └─────────────────────┘      └─────────────────────┘                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Props Interface

```typescript
interface ButtonProps {
  /** Button content */
  children: React.ReactNode;

  /** Click handler */
  onClick?: () => void;

  /** Navigate to URL on click */
  href?: string;

  /** Additional CSS classes */
  className?: string;

  /** Visual style variant */
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';

  /** Size variant */
  size?: 'sm' | 'md' | 'lg';

  /** Lucide icon component */
  icon?: LucideIcon;

  /** Show loading spinner */
  loading?: boolean;

  /** Disable button */
  disabled?: boolean;

  /** Tooltip text */
  tooltip?: string;

  /** HTML button type */
  type?: 'button' | 'submit' | 'reset';
}
```

---

## Variant Styles

### PRIMARY (Mandatory: slate-600)
```typescript
primary: `
  bg-slate-600 text-white border-slate-600
  hover:bg-slate-700 hover:border-slate-700
  shadow-sm focus:ring-slate-500/50
  disabled:opacity-50 disabled:cursor-not-allowed
`
```
**Use for:** Save, Submit, Confirm, Create, Primary CTA

### SECONDARY
```typescript
secondary: `
  bg-white text-dark-700 border-dark-300
  hover:border-dark-400
  focus:ring-slate-500/30
  disabled:opacity-50 disabled:cursor-not-allowed
`
```
**Use for:** Cancel, Back, Close, Secondary actions

### DANGER
```typescript
danger: `
  bg-red-600 text-white border-red-600
  hover:bg-red-700 hover:border-red-700
  shadow-sm focus:ring-red-500/50
  disabled:opacity-50 disabled:cursor-not-allowed
`
```
**Use for:** Delete, Remove, Destructive actions

### SUCCESS (Uses slate, NOT green)
```typescript
success: `
  bg-slate-600 text-white border-slate-600
  hover:bg-slate-700 hover:border-slate-700
  shadow-sm focus:ring-slate-500/50
  disabled:opacity-50 disabled:cursor-not-allowed
`
```
**Use for:** Confirm positive actions (same as primary per design mandate)

### GHOST
```typescript
ghost: `
  border-transparent text-dark-700
  hover:bg-dark-200
  focus:ring-slate-500/30
  disabled:opacity-50 disabled:cursor-not-allowed
`
```
**Use for:** Subtle actions, dropdown toggles, icon-only buttons

---

## Size Variants

| Size | Padding | Font | Use Case |
|------|---------|------|----------|
| `sm` | `px-3 py-2 text-sm` | 14px | Compact spaces, table actions |
| `md` | `px-3 py-2` | 16px | **Standard (USE THIS)** |
| `lg` | `px-5 py-3 text-lg` | 18px | Hero sections, emphasis |

---

## Usage Examples

### Basic Buttons

```tsx
import { Button } from '@/components/shared/button/Button';
import { Save, Trash2 } from 'lucide-react';

// Primary action
<Button variant="primary" icon={Save} onClick={handleSave}>
  Save Changes
</Button>

// Secondary action
<Button variant="secondary" onClick={onCancel}>
  Cancel
</Button>

// Danger action
<Button variant="danger" icon={Trash2} onClick={handleDelete}>
  Delete
</Button>

// Loading state
<Button variant="primary" loading={isSaving}>
  {isSaving ? 'Saving...' : 'Save'}
</Button>
```

### Icon-Only Button

```tsx
<Button variant="ghost" icon={Settings} tooltip="Settings" />
```

### Form Submit

```tsx
<Button type="submit" variant="primary" loading={isSubmitting}>
  Submit Form
</Button>
```

---

## Related Components

### CreateButton

Specialized button for entity creation:

```tsx
interface CreateButtonProps {
  entityCode: string;
  onCreateClick?: () => void;
  createUrl?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

// Usage
<CreateButton entityCode="project" createUrl="/project/new" />
// Renders: "Create Project" button with primary variant
```

### ActionBar

Horizontal bar with title, filters, and create button:

```tsx
<ActionBar
  title="Projects"
  scopeFilters={<ScopeFilters />}
  createButton={{
    entityCode: 'project',
    createUrl: '/project/new'
  }}
  additionalActions={<Button variant="ghost" icon={Filter}>Filter</Button>}
/>
```

---

## Design Mandate Compliance

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  DESIGN MANDATE v12.0                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ❌ NO green buttons (even for "success" actions)                           │
│  ❌ NO blue primary buttons                                                  │
│  ❌ NO bright colors for primary actions                                     │
│                                                                              │
│  ✅ PRIMARY = slate-600 (all main actions)                                  │
│  ✅ SUCCESS = slate-600 (same as primary)                                   │
│  ✅ DANGER = red-600 (destructive actions only)                             │
│  ✅ SECONDARY = white with dark-300 border                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v12.0.0 | 2025-12-03 | Design system v12.0 slate-600 mandate |
| v10.0.0 | 2025-11-15 | Dark theme support |
| v1.0.0 | 2025-10-01 | Initial release |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
