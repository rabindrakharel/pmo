/**
 * Design System v14.4.0 - Warm Sepia Palette
 *
 * Unified design tokens ensuring consistency across the entire application.
 * All components MUST use these constants - no arbitrary Tailwind classes.
 *
 * =============================================================================
 * COLOR PHILOSOPHY & HIERARCHY (v14.4.0 - Warm Sepia)
 * =============================================================================
 *
 * PRIMARY ACCENT:
 * - Stone-600 (#57534E) - All primary actions, focus states, active indicators
 *
 * TEXT HIERARCHY (warm tones - easy on eyes):
 * - dark-text-primary:   #292524 (stone-800) - NOT pure black
 * - dark-text-secondary: #57534E (stone-600) - Body text
 * - dark-text-tertiary:  #78716C (stone-500) - Muted text
 * - dark-text-placeholder: #A8A29E (stone-400) - Placeholders
 * - dark-text-disabled:  #D6D3D1 (stone-300) - Disabled
 *
 * BACKGROUND HIERARCHY (warm cream tones):
 * - dark-canvas:  #FAF9F7 - Page background (cream)
 * - dark-surface: #FEFDFB - Cards, modals (warm white)
 * - dark-subtle:  #F5F5F4 - Nested backgrounds (stone-100)
 * - dark-hover:   #E7E5E4 - Hover states (stone-200)
 * - dark-active:  #D6D3D1 - Active/pressed (stone-300)
 *
 * BORDER HIERARCHY (warm tones):
 * - dark-border-subtle:  #F5F5F4 (stone-100)
 * - dark-border-default: #E7E5E4 (stone-200)
 * - dark-border-medium:  #D6D3D1 (stone-300)
 * - dark-border-strong:  #A8A29E (stone-400)
 *
 * FOCUS STATE STANDARD:
 * - All interactive: focus-visible:ring-2 focus-visible:ring-dark-accent-ring
 */

// =============================================================================
// TYPOGRAPHY
// =============================================================================

/**
 * Typography System
 * Consistent text styling across the application
 */
export const text = {
  // Page titles
  pageTitle: 'text-xl font-semibold text-dark-800 tracking-tight',
  pageSubtitle: 'text-sm text-dark-500',

  // Section headings
  sectionTitle: 'text-base font-semibold text-dark-800',
  sectionSubtitle: 'text-sm text-dark-500',

  // Content hierarchy
  heading: {
    h1: 'text-2xl font-semibold text-dark-800 tracking-tight',
    h2: 'text-xl font-semibold text-dark-800 tracking-tight',
    h3: 'text-lg font-medium text-dark-800',
    h4: 'text-base font-medium text-dark-700',
  },

  // Body text
  body: {
    lg: 'text-base text-dark-700 leading-relaxed',
    base: 'text-sm text-dark-700',
    sm: 'text-xs text-dark-600',
  },

  // Labels and captions
  label: {
    base: 'text-xs font-medium text-dark-600',
    uppercase: 'text-2xs font-medium text-dark-500 uppercase tracking-wider',
    small: 'text-3xs font-medium text-dark-500 uppercase tracking-wider',
  },

  // Muted/secondary text
  muted: {
    base: 'text-sm text-dark-500',
    sm: 'text-xs text-dark-400',
  },

  // Value display (data, numbers)
  value: {
    base: 'text-sm text-dark-800 tabular-nums',
    lg: 'text-base font-medium text-dark-800 tabular-nums',
    mono: 'text-sm font-mono text-dark-700',
  },

  // Links
  link: {
    base: 'text-sm text-dark-accent hover:text-dark-accent-hover transition-colors',
    muted: 'text-sm text-dark-500 hover:text-dark-700 transition-colors',
  },
} as const;

// Legacy export for backwards compatibility
export const textStyles = {
  heading: text.heading,
  body: text.body,
  muted: text.muted,
  label: {
    base: text.label.uppercase,
    large: text.label.base,
  },
  value: text.value,
  metadata: {
    base: text.muted.sm,
    small: 'text-3xs text-dark-400',
  },
} as const;

// =============================================================================
// SURFACES - Background hierarchy for visual depth
// =============================================================================

/**
 * Surface System v14.4.0
 * Proper background hierarchy ensures visual depth and clear hover feedback.
 *
 * LAYER ORDER (back to front):
 * 1. Page canvas (dark-canvas #FAF9F7) - Base layer
 * 2. Cards/Panels (dark-surface #FEFDFB) - Elevated surfaces
 * 3. Hover states (dark-hover #E7E5E4) - Interactive feedback
 * 4. Active states (dark-active #D6D3D1) - Selected/pressed
 */
export const surface = {
  // Page-level backgrounds
  page: 'bg-dark-canvas',
  pageAlt: 'bg-dark-subtle',

  // Card surfaces (elevated from page)
  card: 'bg-dark-surface border border-dark-border-default rounded-lg shadow-sm',
  cardHover: 'bg-dark-surface border border-dark-border-default rounded-lg shadow-sm hover:shadow-md hover:border-dark-border-medium transition-all',
  cardInteractive: 'bg-dark-surface border border-dark-border-default rounded-lg shadow-sm hover:shadow-md hover:border-dark-border-strong transition-all cursor-pointer',

  // Dropdown/Menu surfaces (highest elevation)
  dropdown: 'bg-dark-surface border border-dark-border-default rounded-lg shadow-lg',
  popover: 'bg-dark-surface border border-dark-border-default rounded-lg shadow-xl',
  modal: 'bg-dark-surface rounded-xl shadow-2xl',

  // Interactive row/item states
  row: 'bg-dark-surface hover:bg-dark-hover transition-colors',
  rowAlt: 'bg-dark-subtle hover:bg-dark-hover transition-colors',
  rowActive: 'bg-dark-hover text-dark-text-primary',

  // Subtle backgrounds (for nested content)
  subtle: 'bg-dark-subtle',
  subtleHover: 'bg-dark-subtle hover:bg-dark-hover transition-colors',
} as const;

// =============================================================================
// FOCUS STATES - Accessibility-compliant focus indicators
// =============================================================================

/**
 * Focus System v14.4.0
 * Consistent focus states for all interactive elements.
 * Uses focus-visible to avoid showing focus on mouse click.
 */
export const focus = {
  // Standard focus ring (warm stone accent)
  ring: 'focus-visible:ring-2 focus-visible:ring-dark-accent-ring focus-visible:outline-none',
  ringOffset: 'focus-visible:ring-2 focus-visible:ring-dark-accent-ring focus-visible:ring-offset-1 focus-visible:outline-none',

  // Semantic focus rings
  primary: 'focus-visible:ring-2 focus-visible:ring-dark-accent-ring focus-visible:outline-none',
  danger: 'focus-visible:ring-2 focus-visible:ring-red-500/30 focus-visible:outline-none',
  success: 'focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:outline-none',

  // Input focus (border + ring)
  input: 'focus:ring-2 focus:ring-dark-accent-ring focus:border-dark-border-strong focus:outline-none',
} as const;

// =============================================================================
// BUTTONS
// =============================================================================

/**
 * Button System v14.4.0
 * Production-grade button styling with warm sepia palette
 * Refined sizing for less bulky appearance
 */
export const button = {
  // Base classes (applied to ALL buttons)
  base: 'inline-flex items-center justify-center font-medium rounded-md transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none select-none',

  // Variants - v14.4.0: Use warm stone accent colors
  variant: {
    // Primary - Main actions (warm stone accent)
    primary: 'bg-dark-accent text-white border border-dark-accent hover:bg-dark-accent-hover hover:border-dark-accent-hover active:bg-dark-700 focus-visible:ring-dark-accent-ring shadow-sm',

    // Secondary - Supporting actions
    secondary: 'bg-dark-surface text-dark-text-primary border border-dark-border-default hover:bg-dark-hover hover:border-dark-border-medium active:bg-dark-active focus-visible:ring-dark-accent-ring',

    // Ghost - Minimal emphasis
    ghost: 'bg-transparent text-dark-text-secondary border border-transparent hover:bg-dark-hover hover:text-dark-text-primary active:bg-dark-active focus-visible:ring-dark-accent-ring',

    // Danger - Destructive actions
    danger: 'bg-dark-error text-white border border-dark-error hover:bg-red-700 hover:border-red-700 active:bg-red-800 focus-visible:ring-red-500/50 shadow-sm',

    // Success - Confirmations
    success: 'bg-dark-success text-white border border-dark-success hover:bg-emerald-700 hover:border-emerald-700 active:bg-emerald-800 focus-visible:ring-emerald-500/50 shadow-sm',

    // Outline - Bordered variant
    outline: 'bg-transparent text-dark-text-primary border border-dark-border-medium hover:bg-dark-hover hover:border-dark-border-strong active:bg-dark-active focus-visible:ring-dark-accent-ring',
  },

  // Sizes - v14.4.0: Refined sizing (less bulky)
  size: {
    xs: 'h-6 px-2 text-xs gap-1',
    sm: 'h-7 px-2.5 text-xs gap-1.5',
    md: 'h-8 px-3 text-sm gap-1.5',
    lg: 'h-9 px-4 text-sm gap-2',
    xl: 'h-10 px-5 text-base gap-2',
  },

  // Icon-only variants
  icon: {
    xs: 'h-6 w-6 p-0',
    sm: 'h-7 w-7 p-0',
    md: 'h-8 w-8 p-0',
    lg: 'h-9 w-9 p-0',
    xl: 'h-10 w-10 p-0',
  },
} as const;

// Legacy button styles export
export const buttonStyles = {
  icon: {
    base: 'p-2 hover:bg-dark-100 rounded-md transition-colors text-dark-500 hover:text-dark-700',
    active: 'p-2 bg-dark-100 rounded-md text-dark-700',
  },
  link: {
    base: text.link.base,
    muted: text.link.muted,
  },
} as const;

// =============================================================================
// INPUTS
// =============================================================================

/**
 * Input System v14.4.0
 * Form controls with consistent warm styling
 */
export const input = {
  // Base input styling
  base: 'w-full bg-dark-surface text-dark-text-primary placeholder:text-dark-text-placeholder border border-dark-border-default rounded-md transition-all duration-150 focus:outline-none focus:border-dark-border-strong focus:ring-2 focus:ring-dark-accent-ring disabled:bg-dark-subtle disabled:text-dark-text-disabled disabled:cursor-not-allowed',

  // Size variants
  size: {
    sm: 'h-8 px-2.5 text-sm',
    md: 'h-9 px-3 text-sm',
    lg: 'h-10 px-3.5 text-base',
  },

  // Specialized inputs
  search: 'w-full bg-dark-surface text-dark-text-primary placeholder:text-dark-text-placeholder border border-dark-border-default rounded-md pl-9 pr-3 py-2 text-sm transition-all duration-150 focus:outline-none focus:border-dark-border-strong focus:ring-2 focus:ring-dark-accent-ring',

  // Inline/compact (for tables)
  inline: 'w-full bg-dark-surface text-dark-text-primary border border-dark-border-default rounded px-2 py-1.5 text-sm focus:outline-none focus:border-dark-border-strong focus:ring-1 focus:ring-dark-accent-ring',

  // Textarea
  textarea: 'w-full bg-dark-surface text-dark-text-primary placeholder:text-dark-text-placeholder border border-dark-border-default rounded-md px-3 py-2 text-sm transition-all duration-150 focus:outline-none focus:border-dark-border-strong focus:ring-2 focus:ring-dark-accent-ring resize-none',

  // Select
  select: 'w-full bg-dark-surface text-dark-text-primary border border-dark-border-default rounded-md px-3 py-2 text-sm transition-all duration-150 focus:outline-none focus:border-dark-border-strong focus:ring-2 focus:ring-dark-accent-ring cursor-pointer',

  // Error state modifier
  error: 'border-red-400 focus:border-red-500 focus:ring-red-500/20',
} as const;

// Legacy input styles export
export const inputStyles = {
  base: `${input.base} ${input.size.md}`,
  compact: input.inline,
  search: input.search,
  inline: input.inline,
} as const;

// =============================================================================
// CONTAINERS
// =============================================================================

/**
 * Container System v14.4.0
 * Cards, panels, and layout containers with warm styling
 */
export const container = {
  // Page layout
  page: 'min-h-screen bg-dark-canvas',
  pageContent: 'w-[97%] max-w-[1536px] mx-auto px-4 py-6',

  // Cards
  card: {
    base: 'bg-dark-surface border border-dark-border-default rounded-lg shadow-sm',
    hover: 'bg-dark-surface border border-dark-border-default rounded-lg shadow-sm hover:border-dark-border-medium hover:shadow transition-all duration-150',
    interactive: 'bg-dark-surface border border-dark-border-default rounded-lg shadow-sm hover:border-dark-border-strong hover:shadow-md transition-all duration-150 cursor-pointer',
  },

  // Sections
  section: {
    base: 'bg-dark-surface border border-dark-border-default rounded-lg p-6',
    compact: 'bg-dark-surface border border-dark-border-default rounded-lg p-4',
    flush: 'bg-dark-surface border border-dark-border-default rounded-lg overflow-hidden',
  },

  // Form containers
  form: {
    fieldGroup: 'space-y-4',
    field: 'space-y-1.5',
  },
} as const;

// Legacy container styles export
export const containerStyles = {
  card: container.card,
  section: container.section,
  field: {
    container: container.form.field,
    label: text.label.base,
    input: `${input.base} ${input.size.md}`,
    select: input.select,
    textarea: input.textarea,
  },
} as const;

// =============================================================================
// TABLES
// =============================================================================

/**
 * Table System v14.4.0
 * Data table styling with warm palette
 */
export const table = {
  // Container
  container: 'bg-dark-surface border border-dark-border-default rounded-lg overflow-hidden',
  wrapper: 'overflow-x-auto',

  // Table element
  table: 'min-w-full divide-y divide-dark-border-default',

  // Header
  thead: 'bg-dark-subtle',
  th: 'px-4 py-3 text-left text-2xs font-semibold text-dark-text-secondary uppercase tracking-wider',
  thSortable: 'px-4 py-3 text-left text-2xs font-semibold text-dark-text-secondary uppercase tracking-wider cursor-pointer hover:bg-dark-hover hover:text-dark-text-primary transition-colors select-none',

  // Body
  tbody: 'bg-dark-surface divide-y divide-dark-border-subtle',
  tr: 'transition-colors hover:bg-dark-hover',
  trSelected: 'bg-dark-hover hover:bg-dark-active',
  trEditing: 'bg-dark-hover ring-1 ring-inset ring-dark-border-medium',
  td: 'px-4 py-3 text-sm text-dark-text-secondary',
  tdCompact: 'px-4 py-2 text-sm text-dark-text-secondary',

  // Add row
  addRow: 'px-4 py-3 border-t border-dark-border-default bg-dark-subtle hover:bg-dark-hover transition-colors cursor-pointer group',
  addRowContent: 'flex items-center gap-2 text-sm text-dark-text-tertiary group-hover:text-dark-text-secondary',
} as const;

// Legacy table styles export
export const tableStyles = {
  container: table.container,
  table: table.table,
  thead: table.thead,
  th: table.th,
  thSortable: table.thSortable,
  tbody: table.tbody,
  tr: table.tr,
  trEditing: table.trEditing,
  trDragging: 'opacity-40 bg-dark-200',
  td: table.td,
  addRowButton: table.addRow,
  addRowIcon: 'flex items-center justify-center w-5 h-5 rounded bg-dark-200 group-hover:bg-slate-600 group-hover:text-white transition-all',
} as const;

// =============================================================================
// BADGES
// =============================================================================

/**
 * Badge System
 * Status indicators and labels
 */
export const badge = {
  // Base styling
  base: 'inline-flex items-center rounded-full text-xs font-medium',

  // Sizes
  size: {
    sm: 'px-2 py-0.5 text-2xs',
    md: 'px-2.5 py-0.5 text-xs',
    lg: 'px-3 py-1 text-sm',
  },

  // Variants (semantic colors)
  variant: {
    default: 'bg-dark-100 text-dark-600',
    primary: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700',
    info: 'bg-sky-100 text-sky-700',
    purple: 'bg-purple-100 text-purple-700',
    indigo: 'bg-indigo-100 text-indigo-700',
  },

  // Status-specific colors
  status: {
    active: 'bg-emerald-100 text-emerald-700',
    inactive: 'bg-dark-100 text-dark-500',
    pending: 'bg-amber-100 text-amber-700',
    completed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700',
    draft: 'bg-dark-100 text-dark-500',
    published: 'bg-emerald-100 text-emerald-700',
    archived: 'bg-dark-200 text-dark-500',
  },

  // Priority colors
  priority: {
    critical: 'bg-red-200 text-red-800',
    high: 'bg-red-100 text-red-700',
    urgent: 'bg-orange-100 text-orange-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-emerald-100 text-emerald-700',
  },

  // Workflow stage colors
  stage: {
    initiation: 'bg-sky-100 text-sky-700',
    planning: 'bg-indigo-100 text-indigo-700',
    execution: 'bg-purple-100 text-purple-700',
    monitoring: 'bg-amber-100 text-amber-700',
    closure: 'bg-emerald-100 text-emerald-700',
    backlog: 'bg-dark-100 text-dark-500',
    'to do': 'bg-dark-100 text-dark-600',
    'in progress': 'bg-purple-100 text-purple-700',
    'in review': 'bg-amber-100 text-amber-700',
    done: 'bg-emerald-100 text-emerald-700',
    blocked: 'bg-red-100 text-red-700',
  },

  // With dot indicator
  withDot: 'inline-flex items-center gap-1.5',
  dot: 'w-1.5 h-1.5 rounded-full',
} as const;

// Legacy badge styles export
export const badgeStyles = {
  base: `${badge.base} ${badge.size.md}`,
  status: badge.status,
  priority: badge.priority,
  stage: badge.stage,
} as const;

export const enhancedBadgeStyles = {
  withDot: badge.withDot,
  dot: badge.dot,
} as const;

// =============================================================================
// MODALS
// =============================================================================

/**
 * Modal System v14.4.0
 * Dialogs and overlays with warm styling
 */
export const modal = {
  // Overlay
  overlay: 'fixed inset-0 z-50 bg-black/30 backdrop-blur-sm animate-fade-in',

  // Container
  container: 'fixed inset-0 z-50 flex items-center justify-center p-4',

  // Content panel
  panel: 'bg-dark-surface rounded-xl shadow-xl w-full max-h-[90vh] flex flex-col border border-dark-border-default animate-scale-in',

  // Size variants
  size: {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[95vw]',
  },

  // Header
  header: 'flex items-center justify-between px-6 py-4 border-b border-dark-border-default',
  title: 'text-lg font-semibold text-dark-text-primary',
  subtitle: 'text-sm text-dark-text-tertiary mt-0.5',
  closeButton: 'p-2 text-dark-text-placeholder hover:text-dark-text-secondary hover:bg-dark-hover rounded-md transition-colors',

  // Body
  body: 'px-6 py-5 overflow-y-auto',

  // Footer
  footer: 'flex items-center justify-end gap-3 px-6 py-4 border-t border-dark-border-default bg-dark-subtle',
} as const;

// Legacy modal styles export
export const modalStyles = {
  overlay: modal.overlay,
  container: `${modal.panel} ${modal.size.lg}`,
  header: modal.header,
  headerTitle: modal.title,
  headerSubtitle: modal.subtitle,
  body: modal.body,
  footer: modal.footer,
} as const;

// =============================================================================
// SPACING & LAYOUT
// =============================================================================

/**
 * Spacing System
 * Consistent spacing values
 */
export const spacing = {
  // Page layout
  page: {
    width: 'w-[97%] max-w-[1536px] mx-auto',
    padding: 'px-4 py-6',
    paddingX: 'px-4',
    paddingY: 'py-6',
  },

  // Section spacing
  section: {
    gap: 'space-y-6',
    gapCompact: 'space-y-4',
    gapLarge: 'space-y-8',
  },

  // Grid layouts
  grid: {
    cols2: 'grid grid-cols-1 md:grid-cols-2 gap-4',
    cols3: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
    cols4: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4',
    autoFit: 'grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4',
  },

  // Stack (vertical)
  stack: {
    xs: 'space-y-1',
    sm: 'space-y-2',
    md: 'space-y-4',
    lg: 'space-y-6',
    xl: 'space-y-8',
  },

  // Inline (horizontal)
  inline: {
    xs: 'space-x-1',
    sm: 'space-x-2',
    md: 'space-x-3',
    lg: 'space-x-4',
    xl: 'space-x-6',
  },
} as const;

// =============================================================================
// COLORS (Reference)
// =============================================================================

/**
 * Color Reference
 * For programmatic access to color values
 */
export const colors = {
  // Primary brand - SLATE
  primary: 'slate-600',
  primaryHover: 'slate-700',
  primaryLight: 'slate-100',
  primaryRing: 'slate-500/20',

  // Semantic
  success: 'emerald-600',
  warning: 'amber-600',
  error: 'red-600',
  info: 'sky-600',

  // Neutral scale
  neutral: {
    50: 'dark-50',
    100: 'dark-100',
    200: 'dark-200',
    300: 'dark-300',
    400: 'dark-400',
    500: 'dark-500',
    600: 'dark-600',
    700: 'dark-700',
    800: 'dark-800',
    900: 'dark-900',
  },
} as const;

// =============================================================================
// ACTION BUTTONS
// =============================================================================

/**
 * Action Button System
 * Icon buttons for tables and toolbars
 */
export const actionButton = {
  base: 'p-1.5 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/30',
  default: 'text-dark-400 hover:text-dark-600 hover:bg-dark-100',
  save: 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50',
  cancel: 'text-dark-400 hover:text-dark-600 hover:bg-dark-100',
  delete: 'text-red-500 hover:text-red-600 hover:bg-red-50',
  edit: 'text-dark-400 hover:text-dark-600 hover:bg-dark-100',
  group: 'flex items-center gap-1',
} as const;

// Legacy action button styles export
export const actionButtonStyles = {
  icon: actionButton.default,
  iconSave: actionButton.save,
  iconCancel: actionButton.cancel,
  iconDelete: actionButton.delete,
  iconEdit: actionButton.edit,
  group: actionButton.group,
} as const;

// =============================================================================
// LOADING & EMPTY STATES
// =============================================================================

/**
 * Loading States v14.4.0
 */
export const loading = {
  // Spinner
  spinner: 'animate-spin rounded-full border-2 border-dark-border-default border-t-dark-accent',
  spinnerSizes: {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  },

  // Container
  container: 'flex items-center justify-center py-12',
  containerCompact: 'flex items-center justify-center py-8',

  // Skeleton
  skeleton: 'animate-pulse bg-dark-hover rounded',
  skeletonText: 'h-4 w-full animate-pulse bg-dark-hover rounded',
  skeletonTitle: 'h-6 w-48 animate-pulse bg-dark-hover rounded',
} as const;

// Legacy loading styles export
export const loadingStyles = {
  spinner: loading.spinner,
  spinnerSm: loading.spinnerSizes.sm,
  spinnerMd: loading.spinnerSizes.md,
  spinnerLg: loading.spinnerSizes.lg,
  container: loading.container,
  containerCompact: loading.containerCompact,
  skeleton: loading.skeleton,
  skeletonText: loading.skeletonText,
  skeletonTitle: loading.skeletonTitle,
  skeletonCard: 'h-24 animate-pulse bg-dark-200 rounded-lg',
} as const;

/**
 * Empty States v14.4.0
 */
export const emptyState = {
  container: 'flex flex-col items-center justify-center py-12 text-center',
  icon: 'h-12 w-12 text-dark-muted mb-4',
  title: 'text-sm font-medium text-dark-text-secondary mb-1',
  description: 'text-sm text-dark-text-tertiary max-w-sm',
  action: 'mt-4',
} as const;

// Legacy empty state styles export
export const emptyStateStyles = {
  container: emptyState.container,
  icon: emptyState.icon,
  title: emptyState.title,
  description: emptyState.description,
} as const;

// =============================================================================
// SPECIALIZED COMPONENTS
// =============================================================================

/**
 * Section Header v14.4.0
 */
export const sectionStyles = {
  container: 'mb-6',
  containerCompact: 'mb-4',
  header: 'flex items-center justify-between mb-4',
  headerButton: 'flex items-center gap-2 hover:opacity-80 transition-opacity',
  headerTitle: text.sectionTitle,
  headerTitleCompact: 'text-sm font-semibold text-dark-text-primary',
  badge: `${badge.base} ${badge.size.sm} bg-dark-hover text-dark-text-secondary`,
  actions: 'flex items-center gap-2',
} as const;

/**
 * Card Grid v14.4.0
 */
export const cardGridStyles = {
  grid: spacing.grid.cols3,
  gridCompact: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3',
  card: container.card.hover,
  cardCompact: 'bg-dark-surface border border-dark-border-default rounded-md p-3 hover:border-dark-border-medium hover:shadow-sm transition-all cursor-pointer',
  cardIcon: 'p-2 bg-dark-subtle rounded-md mb-2',
  cardTitle: 'text-sm font-medium text-dark-text-primary mb-0.5',
  cardDescription: 'text-xs text-dark-text-tertiary line-clamp-2',
} as const;

/**
 * Icon Picker v14.4.0
 */
export const iconPickerStyles = {
  dropdown: 'absolute left-0 top-full mt-1 z-50 bg-dark-surface rounded-lg shadow-lg border border-dark-border-default p-3 w-80',
  search: input.search,
  grid: 'grid grid-cols-8 gap-1 max-h-48 overflow-y-auto mt-2',
  iconButton: 'p-2 rounded hover:bg-dark-hover transition-colors text-dark-text-secondary hover:text-dark-text-primary',
  iconButtonSelected: 'p-2 rounded bg-dark-hover text-dark-text-primary ring-1 ring-dark-border-medium',
  footer: 'mt-2 flex items-center justify-between border-t border-dark-border-default pt-2',
  footerText: 'text-xs text-dark-text-tertiary',
  footerClose: 'px-2 py-1 text-xs text-dark-text-secondary hover:bg-dark-hover rounded transition-colors',
} as const;

/**
 * Toggle Switch v14.4.0
 */
export const toggleStyles = {
  container: 'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-dark-accent-ring focus-visible:ring-offset-2 cursor-pointer',
  containerOn: 'bg-dark-accent',
  containerOff: 'bg-dark-muted',
  knob: 'inline-block h-4 w-4 transform rounded-full bg-dark-surface shadow-sm transition-transform',
  knobOn: 'translate-x-4',
  knobOff: 'translate-x-0.5',
} as const;

/**
 * Drag & Drop Indicators v14.4.0
 */
export const dropdownIndicatorStyles = {
  line: 'absolute left-0 right-0 h-0.5 bg-dark-accent rounded-full shadow-sm',
  lineContainer: 'pointer-events-none',
} as const;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Combine class names, filtering out falsy values
 */
export function cx(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Get badge class based on field type and value
 */
export function getBadgeClass(fieldKey: string, value: string): string {
  const lowerKey = fieldKey.toLowerCase();
  const lowerValue = value.toLowerCase();

  if (lowerKey.includes('priority')) {
    const colorClass = badge.priority[lowerValue as keyof typeof badge.priority];
    return colorClass
      ? `${badge.base} ${badge.size.md} ${colorClass}`
      : `${badge.base} ${badge.size.md} ${badge.variant.default}`;
  }

  if (lowerKey.includes('stage')) {
    const colorClass = badge.stage[lowerValue as keyof typeof badge.stage];
    return colorClass
      ? `${badge.base} ${badge.size.md} ${colorClass}`
      : `${badge.base} ${badge.size.md} ${badge.variant.default}`;
  }

  if (lowerKey.includes('status')) {
    const colorClass = badge.status[lowerValue as keyof typeof badge.status];
    return colorClass
      ? `${badge.base} ${badge.size.md} ${colorClass}`
      : `${badge.base} ${badge.size.md} ${badge.variant.default}`;
  }

  return `${badge.base} ${badge.size.md} ${badge.variant.default}`;
}
