# PMO Platform - UI/UX Design System

> **The Single Source of Truth** - Definitive styling patterns for a premium, elegant, and consistent user experience

**Version:** 13.0 - PRODUCTION-GRADE DESIGN SYSTEM
**Theme:** Unified Slate Color Palette - Clean & Professional
**Last Updated:** 2025-12-07
**CRITICAL:** UNIFIED SLATE PALETTE - Zero !important declarations
**Architecture:** Tailwind CSS v3.4 + React 19 + TypeScript

---

## Core Design Philosophy

**Principles:**
1. **Elegance Through Simplicity** - Minimal, clean interfaces without unnecessary decoration
2. **Premium Aesthetics** - Notion-inspired warm neutrals and subtle depth
3. **Consistent Experience** - Every element follows the same patterns
4. **Lightweight Performance** - Smooth transitions, fast interactions
5. **Eye-Pleasing Comfort** - Soft colors, gentle contrasts, refined typography

---

## 1. Color System

### Primary Palette (Unified Slate - v13.0)

```jsx
// CANVAS & SURFACES (tailwind.config.js: colors.dark)
bg-dark-canvas     // #FAFAFA - Page background
bg-dark-surface    // #FFFFFF - Cards, panels, modals
bg-dark-muted      // #F5F5F5 - Subtle backgrounds, hover states
bg-dark-subtle     // #F0F0F0 - Active/selected states

// TEXT HIERARCHY (Semantic naming)
text-dark-text-primary    // #1A1A1A - Headings, important content
text-dark-text-secondary  // #4A4A4A - Body, descriptions
text-dark-text-tertiary   // #787774 - Hints, metadata
text-dark-text-muted      // #9B9A97 - Placeholder, disabled

// BORDERS (Consistent naming)
border-dark-border         // #E5E5E5 - Default borders
border-dark-border-strong  // #D1D1D1 - Emphasized borders

// UNIFIED SLATE ACCENT (Primary accent - NO BLUE/PURPLE/EMERALD)
bg-dark-accent       // #475569 (slate-600) - Primary buttons, active tabs
hover:bg-slate-700   // Hover state for accent
text-slate-600       // Action text, links
text-slate-700       // Hover state for text
ring-slate-500       // Focus rings
border-slate-500     // Accent borders

// LEGACY MAPPING (for backwards compatibility)
bg-dark-50   → bg-dark-canvas
bg-dark-100  → bg-dark-surface
bg-dark-200  → bg-dark-muted
bg-dark-250  → bg-dark-subtle
bg-dark-300  → border-dark-border
text-dark-700 → text-dark-text-primary
text-dark-600 → text-dark-text-secondary
```

### Semantic Colors

```jsx
// STATUS COLORS (for badges and indicators only)
text-green-600   // Success
text-red-600     // Error/Danger
text-orange-600  // Warning
text-gray-600    // Info (not blue)

// BADGE BACKGROUNDS
bg-green-100 text-green-800   // Success badge
bg-red-100 text-red-800       // Error badge
bg-orange-100 text-orange-800 // Warning badge
bg-gray-100 text-gray-800     // Info/Default badge
```

---

## 2. Typography

### Font Configuration

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
```

### Production Typography Scale (v13.0)

```jsx
// FROM designSystem.ts - text tokens with proper line-heights

// HEADINGS (with tight letter-spacing)
text.h1  // text-2xl font-bold tracking-tight leading-7 (24px)
text.h2  // text-xl font-semibold tracking-tight leading-6 (20px)
text.h3  // text-lg font-medium tracking-tight leading-6 (18px)
text.h4  // text-base font-medium tracking-tight leading-5 (16px)

// BODY TEXT (with proper line-heights)
text.body      // text-sm leading-5 text-dark-text-secondary (14px)
text.bodyLarge // text-base leading-6 text-dark-text-secondary (16px)
text.caption   // text-xs leading-4 text-dark-text-tertiary (12px)

// SPECIAL PATTERNS
text.label     // text-xs font-medium uppercase tracking-wider text-dark-text-tertiary
text.code      // font-mono text-sm bg-dark-muted px-1.5 py-0.5 rounded
text.link      // text-slate-600 hover:text-slate-700 hover:underline

// USAGE EXAMPLES
<h1 className={text.h1}>Page Title</h1>
<p className={text.body}>Body content here</p>
<span className={text.caption}>Metadata text</span>
```

### Legacy Text Sizes (Still Supported)

```jsx
// HEADINGS
text-2xl font-semibold  // Page titles (24px)
text-xl font-semibold   // Section headers (20px)
text-lg font-medium     // Card titles (18px)
text-base font-medium   // Subsection headers (16px)

// BODY TEXT
text-sm font-normal     // Default body text (14px) - MOST COMMON
text-xs font-normal     // Small text, metadata (12px)
text-[10px] font-medium // Labels, counts (10px) - USE SPARINGLY
```

---

## 3. Component Patterns

### 3.1 Button Component (Production-Grade v13.0)

**Design Token System** - Use `designSystem.ts` button tokens:

```tsx
// IMPORT FROM DESIGN SYSTEM
import { button } from '@/lib/designSystem';

// PRIMARY BUTTON - Uses button.variant.primary
<Button variant="primary" size="md" icon={Database}>
  Entities (32)
</Button>
// Classes: bg-dark-accent text-white hover:bg-slate-700
//          focus-visible:ring-2 focus-visible:ring-slate-500

// SECONDARY BUTTON - Uses button.variant.secondary
<Button variant="secondary" size="md" icon={Link}>
  Entity Mapping
</Button>
// Classes: bg-white text-dark-text-secondary border border-dark-border
//          hover:bg-dark-muted hover:border-dark-border-strong

// GHOST BUTTON - Uses button.variant.ghost
<Button variant="ghost" size="md" icon={Settings}>
  Settings
</Button>
// Classes: text-dark-text-secondary hover:bg-dark-muted hover:text-dark-text-primary

// DANGER BUTTON - Uses button.variant.danger
<Button variant="danger" size="md" icon={Trash}>
  Delete
</Button>
// Classes: bg-red-600 text-white hover:bg-red-700

// BUTTON SIZES
button.size.sm   // px-3 py-1.5 text-xs
button.size.md   // px-4 py-2 text-sm (DEFAULT)
button.size.lg   // px-5 py-2.5 text-base

// ICON BUTTON (compact square)
<IconButton icon={Settings} variant="ghost" />
// Classes: p-2 rounded-lg

// BUTTON GROUP (connected buttons)
<ButtonGroup>
  <Button variant="secondary">Option 1</Button>
  <Button variant="secondary">Option 2</Button>
</ButtonGroup>

// BUTTON WITH RIGHT ICON
<Button variant="primary" iconRight={ArrowRight}>
  Continue
</Button>

// FULL WIDTH BUTTON
<Button variant="primary" fullWidth>
  Submit
</Button>
```

**Legacy Inline Classes** (Still Supported):

```jsx
// PRIMARY BUTTON
<button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                   bg-dark-accent text-white shadow-sm
                   hover:bg-slate-700 transition-colors
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500">
  <Database className="h-4 w-4" />
  <span>Entities (32)</span>
</button>

// SECONDARY BUTTON
<button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                   bg-white text-dark-text-secondary border border-dark-border
                   hover:bg-dark-muted hover:border-dark-border-strong transition-colors">
  <Link className="h-4 w-4" />
  <span>Entity Mapping</span>
</button>
```

### 3.2 Tabs - Minimalistic Style (Slate Accent)

**Tab Navigation Pattern (Use This Everywhere)**
```jsx
<div className="bg-dark-50/50 border-b border-dark-200 px-6 py-3">
  <div className="flex flex-wrap gap-2">
    {/* Active Tab - SLATE BACKGROUND */}
    <button className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all bg-slate-600 text-white shadow-sm">
      <House className="h-3.5 w-3.5" />
      <span>Overview</span>
    </button>

    {/* Inactive Tab */}
    <button className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all bg-white text-dark-600 border border-dark-300 hover:border-dark-400">
      <FolderKanban className="h-3.5 w-3.5" />
      <span>Core Management</span>
    </button>

    {/* Tab with Count */}
    <button className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all bg-white text-dark-600 border border-dark-300 hover:border-dark-400">
      <CheckSquare className="h-3.5 w-3.5" />
      <span>Tasks</span>
      <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/20 text-current">
        5
      </span>
    </button>
  </div>
</div>
```

### 3.3 Cards & Containers

**Feature Cards with Gradient Icons**
```jsx
// Feature Card with Slate Gradient Icon
<a className="bg-dark-100 rounded-lg p-5 border border-dark-300 hover:border-slate-500 hover:shadow-md transition-all group" href="/project">
  <div className="flex items-start gap-4">
    {/* Icon with Slate Gradient */}
    <div className="h-12 w-12 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
      <FolderKanban className="h-6 w-6 text-white" />
    </div>

    {/* Content */}
    <div className="flex-1">
      <h3 className="font-bold text-dark-600 mb-1 group-hover:text-slate-700">Create Your First Project</h3>
      <p className="text-sm text-dark-700 mb-3">Set up a project with budget, timeline, and team assignments</p>

      {/* Action Link */}
      <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 group-hover:gap-3 transition-all">
        Get Started
        <ArrowRight className="h-4 w-4" />
      </div>
    </div>
  </div>
</a>

// Standard Card
<div className="bg-dark-100 border border-dark-300 rounded-xl shadow-sm p-6 hover:shadow-md transition-all duration-200">
  <h3 className="text-lg font-medium text-dark-700 mb-4">Card Title</h3>
  <p className="text-sm text-dark-600">Card content goes here</p>
</div>
```

### 3.4 Form Elements (Production-Grade v13.0)

**Design Token System** - Use `designSystem.ts` input tokens:

```tsx
// IMPORT FROM DESIGN SYSTEM
import { input } from '@/lib/designSystem';

// INPUT TOKENS
input.base    // w-full rounded-lg border transition-colors
input.default // border-dark-border bg-white text-dark-text-primary
              // placeholder:text-dark-text-muted
              // focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20
input.error   // border-red-500 focus:border-red-500 focus:ring-red-500/20
input.size.sm // px-3 py-1.5 text-sm
input.size.md // px-3 py-2 text-sm (DEFAULT)
input.size.lg // px-4 py-2.5 text-base
```

**Input Fields**
```jsx
// Text Input (using tokens)
<input
  type="text"
  className={`${input.base} ${input.default} ${input.size.md}`}
  placeholder="Enter value..."
/>

// Or inline (legacy)
<input
  type="text"
  className="w-full px-3 py-2 text-sm border border-dark-border rounded-lg bg-white
             text-dark-text-primary placeholder:text-dark-text-muted
             focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500
             transition-colors"
  placeholder="Enter value..."
/>

// Select Dropdown
<select className="w-full px-3 py-2 text-sm border border-dark-border rounded-lg bg-white
                   text-dark-text-primary cursor-pointer
                   focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500
                   transition-colors">
  <option value="">Select option...</option>
  <option value="1">Option 1</option>
</select>

// Search Input with Icon
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-text-muted" />
  <input
    type="text"
    placeholder="Search..."
    className="w-full pl-9 pr-3 py-2 text-sm border border-dark-border rounded-lg bg-white
               text-dark-text-primary placeholder:text-dark-text-muted
               focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500
               transition-colors"
  />
</div>
```

### 3.5 Tables - MANDATORY DATA TABLE STYLING

**Table Structure (ENFORCE THESE STYLES FOR ALL DATA TABLES)**
```jsx
<div className="overflow-x-auto bg-dark-100 rounded-lg border border-dark-300">
  <table className="min-w-full divide-y divide-dark-300">
    <thead className="bg-dark-50">
      <tr>
        {/* HEADER: text-sm font-normal - NOT text-[10px] */}
        <th className="px-3 py-2 text-left text-sm font-normal text-dark-600">
          Column Name
        </th>
      </tr>
    </thead>
    <tbody className="bg-dark-100 divide-y divide-dark-300">
      <tr className="hover:bg-dark-50 transition-colors cursor-pointer">
        {/* CELL: text-sm text-dark-700 - Consistent with headers */}
        <td className="px-3 py-2 text-sm text-dark-700">
          Cell content
        </td>
      </tr>
    </tbody>
  </table>
</div>

/* CRITICAL TABLE RULES:
   - Headers: text-sm font-normal text-dark-600 (NO uppercase, NO text-[10px])
   - Cells: text-sm text-dark-700 (Match header size)
   - Padding: px-3 py-2 (Consistent spacing)
   - NO tiny fonts in tables - Use text-sm throughout
*/
```

### 3.6 Badges & Labels

**Status Badges**
```jsx
// Standard Badge Pattern (NO BLUE)
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
  Active
</span>

// Count Badge (for tabs, notifications)
<span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-medium bg-white/20 text-current">
  5
</span>

// Status-Specific Badges
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
  Complete
</span>

<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
  Pending
</span>
```

### 3.7 Modals

**Modal Structure**
```jsx
{/* Backdrop */}
<div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />

{/* Modal Container */}
<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
  <div className="bg-dark-100 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
    {/* Header */}
    <div className="flex items-center justify-between px-6 py-4 border-b border-dark-300">
      <h2 className="text-lg font-semibold text-dark-700">Modal Title</h2>
      <button className="p-1 hover:bg-dark-200 rounded-lg transition-colors">
        <X className="h-5 w-5 text-dark-500" />
      </button>
    </div>

    {/* Content */}
    <div className="flex-1 overflow-y-auto px-6 py-4">
      {/* Modal content */}
    </div>

    {/* Footer */}
    <div className="px-6 py-4 border-t border-dark-300 flex justify-end gap-2">
      <button className="px-3 py-2 bg-white text-dark-600 border border-dark-300 rounded-md text-sm font-medium hover:border-dark-400 transition-colors">
        Cancel
      </button>
      <button className="px-3 py-2 bg-slate-600 text-white shadow-sm rounded-md text-sm font-medium hover:bg-slate-700 transition-colors">
        Save Changes
      </button>
    </div>
  </div>
</div>
```

---

## 4. Layout Patterns

### Page Structure & Headers

**Page Header with Actions (STANDARD PATTERN)**
```jsx
// Page Header with Back Button and Actions
<div className="flex items-center justify-between">
  <div className="flex items-center space-x-4">
    {/* Back Button */}
    <button className="p-2 hover:bg-dark-100 rounded-lg transition-colors">
      <ArrowLeft className="h-5 w-5 text-dark-700 stroke-[1.5]" />
    </button>

    {/* Page Title */}
    <div>
      <h1 className="text-sm font-normal text-dark-700">
        Create Worksite
        <span className="text-xs font-light text-dark-700 ml-3">New Worksite</span>
      </h1>
    </div>
  </div>

  {/* Action Buttons */}
  <div className="flex items-center space-x-2">
    {/* Cancel Button - Secondary */}
    <button className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all bg-white text-dark-600 border border-dark-300 hover:border-dark-400">
      <ArrowLeft className="h-3.5 w-3.5" />
      <span>Cancel</span>
    </button>

    {/* Primary Action - Slate-600 */}
    <button className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all bg-slate-600 text-white shadow-sm hover:bg-slate-700">
      <Save className="h-3.5 w-3.5" />
      <span>Create Worksite</span>
    </button>
  </div>
</div>

// Standard Page Container
<div className="min-h-screen bg-dark-50">
  <div className="w-[97%] max-w-[1536px] mx-auto px-4 py-6">
    {/* Content */}
  </div>
</div>
```

### Grid Layouts

```jsx
// 2-Column Grid (for feature cards)
<div className="grid md:grid-cols-2 gap-4">
  {/* Grid items */}
</div>

// 3-Column Grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Grid items */}
</div>

// 4-Column Grid (metrics, small cards)
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Grid items */}
</div>
```

---

## 5. Icons

### Icon Standards

```jsx
// SIZES (Minimalistic approach)
h-3 w-3      // Tiny - badges, inline indicators
h-3.5 w-3.5  // Standard - buttons and UI elements (DEFAULT)
h-4 w-4      // Medium - emphasis elements
h-5 w-5      // Large - special emphasis
h-6 w-6      // Extra large - gradient icon boxes

// COLORS
text-dark-600  // Standard icon color
text-dark-700  // Active/emphasis
text-white     // On dark backgrounds
text-slate-600 // Action links

// In Gradient Boxes
className="h-12 w-12 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg"
```

**Common Icon Usage:**
```jsx
import { Plus, Edit, Trash, Settings, Search, X, Check, ChevronDown, ArrowRight } from 'lucide-react';

// In buttons
<Plus className="h-3.5 w-3.5" />

// In tabs
<FolderKanban className="h-4 w-4" />

// In gradient boxes
<div className="h-12 w-12 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg flex items-center justify-center">
  <Users className="h-6 w-6 text-white" />
</div>

// Action arrows
<ArrowRight className="h-4 w-4" />
```

---

## 6. Spacing Guidelines

### Padding

```jsx
// CONTAINERS
p-6     // Large containers, cards (24px)
p-5     // Feature cards
p-4     // Standard containers, tab containers
p-3     // Compact containers (12px)
p-2     // Small padding (8px)
p-1.5   // Buttons, inputs (6px)

// BUTTONS & TABS - MINIMALISTIC
px-3 py-2    // Standard buttons & tabs (DEFAULT)
px-2 py-1.5  // Small buttons (compact spaces)
px-2 py-1    // Tiny buttons (rare use)
```

### Margins & Gaps

```jsx
// GAPS (Flexbox/Grid)
gap-2    // Tabs, button groups (8px)
gap-3    // Form fields (12px)
gap-4    // Cards, grid items (16px)

// MARGINS
mb-1    // Small spacing (4px)
mb-3    // Medium spacing (12px)
mb-4    // Section spacing (16px)
mb-6    // Large spacing (24px)
```

---

## 7. Borders & Shadows

### Borders

```jsx
// STANDARD BORDERS
border-dark-300       // Default border
border-dark-400       // Hover state
border-slate-500      // Accent hover (for cards)

// BORDER RADIUS
rounded-lg            // Standard (8px) - buttons, cards, inputs
rounded-xl            // Large (12px) - modals, containers
rounded-full          // Pills - badges, counts

// USAGE
className="border border-dark-300 hover:border-slate-500"
```

### Shadows

```jsx
// ELEVATION HIERARCHY
shadow-sm         // Subtle elevation - cards
shadow-md         // Active tabs, hover state
shadow-lg         // Dropdowns
shadow-xl         // Modals
shadow-2xl        // Maximum elevation

// COMMON PATTERNS
className="shadow-md"                                   // Active tabs
className="hover:shadow-md transition-all"             // Card hover
className="shadow-sm hover:shadow-md transition-all"   // Interactive cards
```

---

## 8. Interactive States

### Hover Effects

```jsx
// Cards
hover:border-slate-500     // Accent border on hover
hover:shadow-md           // Elevation on hover
group-hover:scale-110     // Icon scale on parent hover
group-hover:text-slate-700 // Text color change
group-hover:gap-3        // Gap animation

// Buttons
hover:bg-dark-800        // Dark button hover
hover:bg-dark-200        // Light button hover
hover:border-dark-400    // Border enhancement

// Links
text-slate-600 group-hover:gap-3  // Animated arrow links
```

### Focus States

```jsx
// Inputs (Slate focus)
focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500

// Buttons
focus:outline-none focus:ring-2 focus:ring-slate-500/50

// Remove focus
focus:outline-none focus:ring-0
```

### Transition Patterns

```jsx
// Standard transitions
transition-colors              // Color changes
transition-all                 // Multiple properties
transition-all group          // Group hover effects
transition-transform          // Scale animations

// Common combinations
className="transition-all group"                         // Cards
className="transition-all duration-200"                  // Smooth changes
className="group-hover:scale-110 transition-transform"   // Icon animations
```

---

## 9. Special Components

### Gradient Icon Boxes

```jsx
// Feature card icon
<div className="h-12 w-12 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
  <FolderKanban className="h-6 w-6 text-white" />
</div>
```

### Action Links with Arrow

```jsx
<div className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 group-hover:gap-3 transition-all">
  Get Started
  <ArrowRight className="h-4 w-4" />
</div>
```

### Tab Container

```jsx
<div className="bg-dark-100 rounded-xl p-4 border border-dark-300">
  <div className="flex flex-wrap gap-2">
    {/* Tabs go here */}
  </div>
</div>
```

---

## Quick Reference Card

### Must-Use Patterns

| Element | Classes | Notes |
|---------|---------|-------|
| **PRIMARY BUTTON** | `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all bg-slate-600 text-white shadow-sm hover:bg-slate-700` | MINIMALISTIC |
| **Secondary Button** | `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all bg-white text-dark-600 border border-dark-300 hover:border-dark-400` | Clean & light |
| **Active Tab** | `flex items-center gap-2 px-3 py-2 bg-slate-600 text-white shadow-sm rounded-md text-sm font-medium` | Slate accent |
| **Inactive Tab** | `flex items-center gap-2 px-3 py-2 bg-white text-dark-600 border border-dark-300 hover:border-dark-400 rounded-md text-sm font-medium` | White bg |
| **Feature Card** | `bg-dark-100 rounded-lg p-5 border border-dark-300 hover:border-slate-500 hover:shadow-md` | Slate hover border |
| **Gradient Icon** | `h-12 w-12 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg` | Slate gradient |
| **Input Focus** | `focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500` | Slate focus |
| **Action Link** | `text-slate-600 group-hover:gap-3` | Slate text color |

### Color Quick Reference

| Use Case | Color | Class |
|----------|-------|-------|
| Canvas Background | #FAFAFA | `bg-dark-50` |
| Card/Panel | #FFFFFF | `bg-dark-100` |
| Primary Text | #37352F | `text-dark-700` |
| Secondary Text | #787774 | `text-dark-600` |
| Border | #E9E9E7 | `border-dark-300` |
| **PRIMARY BUTTON** | **Slate-600** | **`bg-slate-600`** |
| Active Tab | Slate-600 | `bg-slate-600` |
| Hover State | Slate-700 | `hover:bg-slate-700` |
| Focus Ring | Slate | `ring-slate-500` |
| Action Links | Slate | `text-slate-600` |

---

## Implementation Guidelines

### Critical Rules - MINIMALISTIC DESIGN

1. **ALL PRIMARY BUTTONS USE `bg-slate-600`** - Including Save, Submit, Create
2. **NO GREEN BUTTONS** - Use slate-600 for all save/submit actions
3. **BUTTON PADDING: `px-3 py-2`** - Minimalistic, not bulky
4. **DATA TABLE FONTS: `text-sm`** - Headers and cells, NO tiny text
5. **NO BLUE OR PURPLE** - Use slate for all accent colors
6. **Active tabs use `bg-slate-600`** - With white bg for inactive
7. **Subtle shadows: `shadow-sm`** - Not shadow-md (too heavy)
8. **Icon size in buttons: `h-3.5 w-3.5`** - Smaller, cleaner
9. **Border radius: `rounded-md`** - Not rounded-lg (too rounded)

### Common Mistakes to Avoid

❌ Using green buttons for save/submit - use `bg-slate-600`
❌ Using `text-[10px]` anywhere - minimum is `text-xs`
❌ Using uppercase table headers - use normal case, `font-normal`
❌ Bulky button padding - use `px-3 py-2`, not `px-4 py-2.5`
❌ Using blue/purple for UI - use slate accent only
❌ Heavy shadows (`shadow-md/lg`) - use `shadow-sm` for subtlety
❌ Large border radius (`rounded-lg`) - use `rounded-md`
❌ Large icons in buttons - use `h-3.5 w-3.5` standard

### Consistency Checklist - MINIMALISTIC

- [ ] **ALL primary buttons use `bg-slate-600 text-white shadow-sm`**
- [ ] **NO GREEN BUTTONS - Save/Submit use slate-600**
- [ ] **ALL buttons use `px-3 py-2` padding (minimalistic)**
- [ ] **ALL button icons are `h-3.5 w-3.5`**
- [ ] **Table headers: `text-sm font-normal text-dark-600`**
- [ ] **Table cells: `text-sm text-dark-700`**
- [ ] **NO tiny fonts (`text-[10px]`) anywhere**
- [ ] Active tabs use `bg-slate-600` with `shadow-sm`
- [ ] Inactive tabs/secondary buttons use `bg-white border`
- [ ] Border radius: `rounded-md` (not rounded-lg)
- [ ] Shadows: `shadow-sm` (not shadow-md/lg)

---

## 10. Form Layout Patterns - MINIMALISTIC DESIGN

### 10.1 Form Submission Editor Layout

**Header Section (Metadata + Actions)**
```jsx
// Form edit header with title and action buttons
<div className="bg-dark-100 border border-dark-300 rounded-lg p-5 shadow-sm
               flex flex-col gap-4 md:flex-row md:items-center md:justify-between
               transition-all hover:shadow-md">
  {/* Title Section */}
  <div className="space-y-1">
    <h2 className="text-base font-medium text-dark-700">
      Edit Form Submission
    </h2>
    <p className="text-xs text-dark-600 tracking-tight">
      {form?.name || 'Form'}
      <span className="text-dark-500 mx-2">·</span>
      <span className="font-mono text-dark-500">
        #{submissionId?.substring(0, 8)}…
      </span>
    </p>
  </div>

  {/* Action Buttons */}
  <div className="flex items-center gap-2">
    {/* Loading Indicator */}
    {isRefreshing && (
      <span className="inline-flex items-center gap-1.5 text-xs text-dark-600
                     px-3 py-2 rounded-md bg-dark-50">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        <span>Refreshing…</span>
      </span>
    )}

    {/* Secondary Buttons */}
    <button className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium
                     transition-all bg-white text-dark-600 border border-dark-300
                     hover:border-dark-400 hover:shadow-sm">
      <RefreshCw className="h-3.5 w-3.5" />
      <span>Refresh</span>
    </button>
  </div>
</div>
```

### 10.2 Metadata Grid (Form Details)

**Enhanced metadata display with icon containers**
```jsx
<div className="bg-dark-100 border border-dark-300 rounded-lg p-5 shadow-sm">
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
    {/* Metadata Item with Icon Container */}
    <div className="flex items-start gap-3 group">
      {/* Icon Container - Rounded with hover effect */}
      <div className="p-2 rounded-lg bg-dark-50 group-hover:bg-slate-50
                    transition-colors flex-shrink-0">
        <Hash className="h-4 w-4 text-dark-600 group-hover:text-slate-600
                       transition-colors" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Label - Uppercase with tracking */}
        <p className="text-[10px] font-medium uppercase tracking-wider
                     text-dark-500 mb-1">
          Form ID
        </p>
        {/* Value - Monospace for IDs/codes */}
        <p className="text-sm font-mono text-dark-700 break-all leading-tight">
          {formId.substring(0, 8)}…
        </p>
      </div>
    </div>

    {/* Status Badge Example */}
    <div className="flex items-start gap-3 group">
      <div className="p-2 rounded-lg bg-dark-50 group-hover:bg-green-50
                    transition-colors flex-shrink-0">
        <CheckCircle className="h-4 w-4 text-dark-600 group-hover:text-green-600
                              transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider
                     text-dark-500 mb-1">
          Status
        </p>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full
                       text-xs font-medium bg-green-100 text-green-800 capitalize">
          {status}
        </span>
      </div>
    </div>
  </div>
</div>
```

### 10.3 Entity Form Container (Field Layout)

**Two-column field layout with labels and values**
```jsx
<div className="bg-dark-100 rounded-xl shadow-sm overflow-hidden border border-dark-300
               transition-all hover:shadow-md">
  <div className="p-6">
    <div className="space-y-0">
      {fields.map((field, index) => (
        <div key={field.key}>
          {/* Field Separator (not for first item) */}
          {index > 0 && (
            <div className="h-px my-3 bg-gradient-to-r from-transparent via-dark-300 to-transparent" />
          )}

          {/* Field Row */}
          <div className="group transition-all duration-200 ease-out py-1">
            <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4 items-start">
              {/* Label Column */}
              <label className="text-xs font-medium text-dark-600 pt-2.5 flex items-center gap-2 uppercase tracking-wider">
                <span className="opacity-70 group-hover:opacity-100 transition-opacity duration-200">
                  {field.label}
                </span>
                {field.required && (
                  <span className="text-red-500 text-xs font-bold">*</span>
                )}
              </label>

              {/* Value Column */}
              <div className={`
                relative break-words rounded-lg px-3 py-2.5 -ml-3
                transition-all duration-200 ease-out
                ${isEditing
                  ? 'bg-dark-50 hover:bg-dark-200 shadow-sm focus-within:bg-dark-100 focus-within:shadow-md focus-within:ring-2 focus-within:ring-slate-500/30 focus-within:border-slate-500'
                  : 'hover:bg-dark-50 group-hover:bg-dark-200'
                }
                text-sm text-dark-700 leading-relaxed
              `}>
                {/* Field content */}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
</div>
```

### 10.4 Form Field Patterns

**Common field element styles**
```jsx
// Text Input (consistent with form pattern)
<input
  type="text"
  className="w-full px-3 py-2 text-sm border border-dark-300 rounded-lg bg-dark-100
             text-dark-700 placeholder-dark-400
             focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500
             transition-colors"
  placeholder="Enter value..."
/>

// Select Dropdown
<select className="w-full px-3 py-2 text-sm border border-dark-300 rounded-lg bg-dark-100
                   text-dark-700 focus:outline-none focus:ring-2 focus:ring-slate-500/30
                   focus:border-slate-500 cursor-pointer transition-colors">
  <option value="">Select option...</option>
</select>

// Textarea
<textarea
  className="w-full px-3 py-2 text-sm border border-dark-300 rounded-lg bg-dark-100
             text-dark-700 placeholder-dark-400 resize-none
             focus:outline-none focus:ring-2 focus:ring-slate-500/30 focus:border-slate-500
             transition-colors"
  rows={4}
  placeholder="Enter description..."
/>
```

### 10.5 Responsive Form Breakpoints

| Breakpoint | Layout | Padding | Gap |
|------------|--------|---------|-----|
| `< 640px` (mobile) | 1 column, stacked labels | `p-4` | `gap-4` |
| `640px - 768px` (sm) | 2 columns (160px + 1fr) | `p-5` | `gap-5` |
| `768px - 1024px` (md) | 2 columns (160px + 1fr) | `p-5` | `gap-6` |
| `> 1024px` (lg) | 2 columns (160px + 1fr) | `p-5` | `gap-6` |

```jsx
// Responsive field layout
<div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4 items-start">
  {/* Adapts to single column on mobile */}
</div>

// Responsive metadata grid
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
  {/* 1 column mobile, 2 columns tablet, 4 columns desktop */}
</div>
```

---

**This document is the single source of truth for all UI/UX decisions. Follow these patterns exactly.**

---

## 11. CSS Architecture (v13.0 - Zero !important)

### index.css Structure

```css
/* LAYER ORDER - Proper specificity without !important */
@layer base {
  /* CSS custom properties */
  :root {
    --color-canvas: #FAFAFA;
    --color-surface: #FFFFFF;
    --color-accent: #475569;
    /* ... more tokens */
  }
}

@layer components {
  /* Reusable component classes */
  .btn-primary { /* ... */ }
  .card { /* ... */ }
}

@layer utilities {
  /* Custom utilities - override with natural specificity */
  .scrollbar-thin { /* ... */ }
}
```

### Zero !important Policy

- **NEVER** use `!important` in new code
- Use proper CSS specificity hierarchy
- Use Tailwind's `@layer` directive for organization
- Prefer component-level styles over global overrides

### Focus-Visible Pattern

```css
/* Keyboard-only focus rings */
.focus-visible:outline-none
.focus-visible:ring-2
.focus-visible:ring-slate-500
.focus-visible:ring-offset-2

/* Removes ugly focus outlines on mouse click */
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| **v13.0** | **2025-12-07** | **Production-grade design system**, unified slate palette, zero !important, focus-visible accessibility, Button/IconButton/ButtonGroup components, typography scale with line-heights |
| v12.0 | 2025-11-13 | Minimalistic design system |
| v11.0 | 2025-11-10 | YAML pattern detection |
| v10.0 | 2025-11-07 | Dark theme support |

---

**Maintained by:** PMO Platform Team
**Version:** 13.0 - PRODUCTION-GRADE DESIGN SYSTEM
**Last Updated:** 2025-12-07