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
