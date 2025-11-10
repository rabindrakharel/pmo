/**
 * Design System Constants
 *
 * Centralized styling constants to ensure consistency across the application.
 * Use these classes instead of arbitrary Tailwind classes for better maintainability.
 */

/**
 * Text Styles
 * Consistent text styling for different use cases
 */
export const textStyles = {
  // Headings
  heading: {
    h1: 'text-2xl font-semibold text-dark-700',
    h2: 'text-xl font-medium text-dark-700',
    h3: 'text-lg font-medium text-dark-700',
    h4: 'text-base font-medium text-dark-700',
  },

  // Body text
  body: {
    large: 'text-base text-dark-700',
    base: 'text-sm text-dark-700',
    small: 'text-xs text-dark-700',
  },

  // Secondary/muted text
  muted: {
    large: 'text-base text-dark-600',
    base: 'text-sm text-dark-600',
    small: 'text-xs text-dark-600',
  },

  // Labels (uppercase, smaller)
  label: {
    base: 'text-3xs font-medium text-dark-600 uppercase tracking-wide',
    large: 'text-xs font-medium text-dark-600 uppercase tracking-wide',
  },

  // Values/data display
  value: {
    base: 'text-sm text-dark-700 tracking-tight',
    large: 'text-base text-dark-700 tracking-tight',
    small: 'text-xs text-dark-700 tracking-tight',
  },

  // Metadata (smaller, tighter)
  metadata: {
    base: 'text-xs text-dark-600 tracking-tight',
    small: 'text-3xs text-dark-600 tracking-tight',
  },
} as const;

/**
 * Container Styles
 * Consistent container/card styling
 */
export const containerStyles = {
  // Cards/panels
  card: {
    base: 'bg-dark-100 border border-dark-300 rounded-xl shadow-sm',
    hover: 'bg-dark-100 border border-dark-300 rounded-xl shadow-sm hover:border-purple-400 hover:shadow-md transition-all',
    interactive: 'bg-dark-100 border border-dark-300 rounded-lg hover:border-purple-400 hover:shadow-sm transition-all cursor-pointer',
  },

  // Sections
  section: {
    base: 'bg-dark-100 rounded-xl border border-dark-300 p-6',
    compact: 'bg-dark-100 rounded-lg border border-dark-300 p-4',
  },

  // Form fields
  field: {
    container: 'space-y-1',
    label: 'block text-xs font-medium text-dark-600 mb-1',
    input: 'w-full px-3 py-2 border border-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-dark-700',
    select: 'w-full px-3 py-2 border border-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-dark-700 bg-white',
    textarea: 'w-full px-3 py-2 border border-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-dark-700 resize-none',
  },
} as const;

/**
 * Badge Styles
 * Consistent badge/pill styling for status, priority, etc.
 */
export const badgeStyles = {
  // Base badge
  base: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',

  // Status colors
  status: {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-700',
    pending: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    draft: 'bg-gray-100 text-gray-700',
    published: 'bg-green-100 text-green-800',
    archived: 'bg-gray-300 text-gray-700',
  },

  // Priority colors
  priority: {
    critical: 'bg-red-200 text-red-900',
    high: 'bg-red-100 text-red-800',
    urgent: 'bg-orange-100 text-orange-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
  },

  // Stage colors (project/task stages)
  stage: {
    initiation: 'bg-blue-100 text-blue-800',
    planning: 'bg-indigo-100 text-indigo-800',
    execution: 'bg-purple-100 text-purple-800',
    monitoring: 'bg-yellow-100 text-yellow-800',
    closure: 'bg-green-100 text-green-800',
    backlog: 'bg-gray-100 text-gray-700',
    'to do': 'bg-gray-100 text-gray-700',
    'in progress': 'bg-purple-100 text-purple-800',
    'in review': 'bg-yellow-100 text-yellow-800',
    done: 'bg-green-100 text-green-800',
    blocked: 'bg-red-100 text-red-800',
  },
} as const;

/**
 * Button Styles
 * Consistent button styling (complement to existing Button component)
 */
export const buttonStyles = {
  // Icon buttons (header actions)
  icon: {
    base: 'p-2 hover:bg-dark-100 rounded-lg transition-colors',
    active: 'p-2 bg-dark-100 rounded-lg',
  },

  // Link buttons
  link: {
    base: 'text-sm text-purple-600 hover:text-purple-700 hover:underline transition-colors',
    muted: 'text-sm text-dark-600 hover:text-dark-700 hover:underline transition-colors',
  },
} as const;

/**
 * Spacing Constants
 * Consistent spacing values
 */
export const spacing = {
  page: {
    width: 'w-[97%] max-w-[1536px] mx-auto',
    padding: 'px-4 py-6',
  },
  section: {
    gap: 'space-y-6',
    gapCompact: 'space-y-3',
  },
  grid: {
    cols2: 'grid grid-cols-1 md:grid-cols-2 gap-4',
    cols3: 'grid grid-cols-1 md:grid-cols-3 gap-4',
    cols4: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4',
  },
} as const;

/**
 * Color Constants
 * Consistent color usage (complement to Tailwind theme)
 */
export const colors = {
  // Primary brand colors
  primary: 'purple-600',
  primaryHover: 'purple-700',
  primaryLight: 'purple-100',

  // Accent colors
  accent: {
    blue: 'blue-600',
    indigo: 'indigo-600',
    purple: 'purple-600',
    green: 'green-600',
  },

  // Semantic colors
  success: 'green-600',
  warning: 'yellow-600',
  error: 'red-600',
  info: 'blue-600',

  // Neutral colors (dark theme)
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

/**
 * Helper function to get badge class based on field and value
 */
export function getBadgeClass(fieldKey: string, value: string): string {
  const lowerKey = fieldKey.toLowerCase();
  const lowerValue = value.toLowerCase();

  if (lowerKey.includes('priority')) {
    const colorClass = badgeStyles.priority[lowerValue as keyof typeof badgeStyles.priority];
    return colorClass ? `${badgeStyles.base} ${colorClass}` : `${badgeStyles.base} ${badgeStyles.status.inactive}`;
  }

  if (lowerKey.includes('stage')) {
    const colorClass = badgeStyles.stage[lowerValue as keyof typeof badgeStyles.stage];
    return colorClass ? `${badgeStyles.base} ${colorClass}` : `${badgeStyles.base} ${badgeStyles.status.inactive}`;
  }

  if (lowerKey.includes('status')) {
    const colorClass = badgeStyles.status[lowerValue as keyof typeof badgeStyles.status];
    return colorClass ? `${badgeStyles.base} ${colorClass}` : `${badgeStyles.base} ${badgeStyles.status.inactive}`;
  }

  return `${badgeStyles.base} ${badgeStyles.status.inactive}`;
}

/**
 * Helper function to combine classes
 */
export function cx(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ============================================================================
// ENHANCED STYLES FOR SETTINGS PAGE (v2.0)
// ============================================================================

/**
 * Table Styles - Enhanced for settings data tables
 */
export const tableStyles = {
  // Container with subtle border
  container: 'border border-dark-300 rounded-lg overflow-hidden bg-dark-100',

  // Table element
  table: 'min-w-full divide-y divide-dark-300',

  // Header with subtle background
  thead: 'bg-dark-50',
  th: 'px-4 py-3 text-left text-2xs font-semibold text-dark-700 uppercase tracking-wider',
  thSortable: 'px-4 py-3 text-left text-2xs font-semibold text-dark-700 uppercase tracking-wider cursor-pointer hover:bg-dark-100 transition-colors group',

  // Body rows with hover
  tbody: 'bg-dark-100 divide-y divide-dark-300',
  tr: 'transition-colors hover:bg-dark-50',
  trEditing: 'bg-dark-50 ring-2 ring-dark-accent/20',
  trDragging: 'opacity-40 bg-dark-200',
  td: 'px-4 py-3 text-sm text-dark-700',

  // Add row button
  addRowButton: 'w-full px-4 py-3.5 text-left text-sm font-medium text-dark-700 hover:bg-dark-50 transition-colors flex items-center gap-2 border-t border-dark-300 group',
  addRowIcon: 'flex items-center justify-center w-6 h-6 rounded-full bg-dark-200 group-hover:bg-dark-accent group-hover:text-white transition-all',
} as const;

/**
 * Input Styles - Enhanced for inline editing
 */
export const inputStyles = {
  // Base input for forms
  base: 'w-full px-3 py-2 text-sm bg-dark-100 border border-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-accent/20 focus:border-dark-accent transition-all placeholder:text-dark-500',

  // Compact input for tables
  compact: 'w-full px-2 py-1.5 text-xs bg-dark-100 border border-dark-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dark-accent/20 focus:border-dark-accent transition-all',

  // Search input with icon space
  search: 'w-full pl-9 pr-3 py-2 text-sm bg-dark-100 border border-dark-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-accent/20 focus:border-dark-accent transition-all placeholder:text-dark-500',

  // Inline table edit input
  inline: 'w-full px-2.5 py-1.5 text-sm border border-dark-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dark-accent/30 focus:border-dark-accent transition-all bg-dark-100',
} as const;

/**
 * Modal Styles - Enhanced dialog design
 */
export const modalStyles = {
  // Backdrop overlay with blur
  overlay: 'fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200',

  // Modal container with shadow
  container: 'bg-dark-100 rounded-xl shadow-[0_12px_28px_0_rgba(0,0,0,0.08)] w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col border border-dark-300 animate-in zoom-in-95 duration-200',

  // Header
  header: 'flex items-center justify-between px-6 py-4 border-b border-dark-300',
  headerTitle: 'text-lg font-semibold text-dark-700',
  headerSubtitle: 'text-xs text-dark-600 mt-0.5',

  // Body with scroll
  body: 'px-6 py-5 overflow-y-auto',

  // Footer with actions
  footer: 'flex items-center justify-end gap-3 px-6 py-4 border-t border-dark-300 bg-dark-50',
} as const;

/**
 * Section Styles - Page section organization
 */
export const sectionStyles = {
  // Container
  container: 'mb-8',
  containerCompact: 'mb-6',

  // Header with expand/collapse
  header: 'flex items-center justify-between mb-4',
  headerButton: 'flex items-center gap-2 hover:opacity-70 transition-opacity',
  headerTitle: 'text-base font-semibold text-dark-700',
  headerTitleCompact: 'text-sm font-semibold text-dark-700',

  // Count badge
  badge: 'inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-medium bg-dark-200 text-dark-700',

  // Actions in header
  actions: 'flex items-center gap-2',
} as const;

/**
 * Card Grid Styles - For settings cards
 */
export const cardGridStyles = {
  // Grid layouts
  grid: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3',
  gridCompact: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2',

  // Card in grid
  card: 'group bg-dark-100 border border-dark-300 rounded-lg p-3.5 hover:border-dark-400 hover:shadow-md transition-all cursor-pointer',
  cardCompact: 'group bg-dark-100 border border-dark-300 rounded-md p-2.5 hover:bg-dark-50 hover:border-dark-400 hover:shadow-sm transition-all cursor-pointer',

  // Card content
  cardIcon: 'p-2 bg-gradient-to-br from-dark-100 to-dark-200 rounded-md group-hover:from-dark-50 group-hover:to-dark-100 transition-all',
  cardTitle: 'text-sm font-semibold text-dark-700 mb-0.5 group-hover:text-dark-700 transition-colors',
  cardDescription: 'text-xs text-dark-600 line-clamp-2',
} as const;

/**
 * Action Button Styles - For table actions
 */
export const actionButtonStyles = {
  // Icon buttons in tables
  icon: 'p-1.5 text-dark-700 hover:bg-dark-200 rounded-md transition-colors',
  iconSave: 'p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors',
  iconCancel: 'p-1.5 text-dark-700 hover:bg-dark-200 rounded-md transition-colors',
  iconDelete: 'p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors',
  iconEdit: 'p-1.5 text-dark-700 hover:bg-dark-200 rounded-md transition-colors',

  // Button groups
  group: 'flex items-center justify-center gap-1',
} as const;

/**
 * Loading & Empty States
 */
export const loadingStyles = {
  // Spinner
  spinner: 'inline-block animate-spin rounded-full border-2 border-dark-300 border-t-dark-700',
  spinnerSm: 'h-4 w-4',
  spinnerMd: 'h-6 w-6',
  spinnerLg: 'h-8 w-8',

  // Container
  container: 'flex items-center justify-center py-12',
  containerCompact: 'flex items-center justify-center py-8',

  // Skeleton
  skeleton: 'animate-pulse bg-dark-200 rounded',
  skeletonText: 'h-4 bg-dark-200 rounded mb-2',
  skeletonTitle: 'h-6 bg-dark-200 rounded mb-3',
  skeletonCard: 'h-24 bg-dark-200 rounded-lg',
} as const;

export const emptyStateStyles = {
  container: 'flex flex-col items-center justify-center py-12 text-center bg-dark-100 rounded-lg border border-dark-300',
  icon: 'h-12 w-12 text-dark-500 mb-3',
  title: 'text-sm font-medium text-dark-700 mb-1',
  description: 'text-sm text-dark-600',
} as const;

/**
 * Icon Picker Styles - For icon selection dropdowns
 */
export const iconPickerStyles = {
  // Dropdown container
  dropdown: 'absolute left-0 top-full mt-1 z-50 bg-dark-100 rounded-lg shadow-xl border border-dark-300 p-3 w-96',

  // Search input
  search: 'w-full pl-7 pr-3 py-1.5 text-xs border border-dark-300 rounded-md focus:ring-2 focus:ring-dark-accent/30 focus:border-dark-accent',

  // Icon grid
  grid: 'grid grid-cols-8 gap-1 max-h-64 overflow-y-auto mt-2',
  iconButton: 'p-2 rounded hover:bg-dark-200 transition-colors',
  iconButtonSelected: 'p-2 rounded bg-dark-200 ring-2 ring-dark-accent',

  // Footer
  footer: 'mt-2 flex items-center justify-between border-t border-dark-300 pt-2',
  footerText: 'text-xs text-dark-600',
  footerClose: 'px-2 py-1 text-xs text-dark-700 hover:bg-dark-200 rounded',
} as const;

/**
 * Toggle Switch Styles
 */
export const toggleStyles = {
  // Switch container
  container: 'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-dark-accent/30 focus:ring-offset-2',
  containerOn: 'bg-green-500',
  containerOff: 'bg-dark-300',

  // Switch knob
  knob: 'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
  knobOn: 'translate-x-5',
  knobOff: 'translate-x-0.5',
} as const;

/**
 * Dropdown Indicator Styles
 */
export const dropdownIndicatorStyles = {
  // Drop indicator line for drag & drop
  line: 'absolute left-0 right-0 h-1 bg-dark-accent shadow-lg z-50 rounded-full',
  lineContainer: 'pointer-events-none',
} as const;

/**
 * Badge Enhancements - Modern badge with dot indicator
 */
export const enhancedBadgeStyles = {
  // Badge with dot
  withDot: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',

  // Dot indicator
  dot: 'h-1.5 w-1.5 rounded-full',
} as const;
