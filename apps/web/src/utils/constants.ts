/**
 * Application constants
 */

// API configuration
export const API_CONFIG = {
  BASE_URL: '/api',
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
} as const;

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 25,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
  MAX_PAGE_SIZE: 100,
} as const;

// Date formats
export const DATE_FORMATS = {
  SHORT: 'MMM d, yyyy',
  LONG: 'MMMM d, yyyy',
  WITH_TIME: 'MMM d, yyyy h:mm a',
  ISO: 'yyyy-MM-dd',
  TIME_ONLY: 'h:mm a',
} as const;

// File upload limits
export const FILE_UPLOAD = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: {
    IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    DOCUMENT: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    SPREADSHEET: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    TEXT: ['text/plain', 'text/csv'],
  },
} as const;

// RBAC Permissions (used by API scope system)
export const PERMISSIONS = {
  VIEW: 0,
  MODIFY: 1,
  SHARE: 2,
  DELETE: 3,
  CREATE: 4,
} as const;

// Scope types for RBAC system
export const SCOPE_TYPES = {
  APP: 'app',
  BUSINESS: 'business', 
  LOCATION: 'location',
  HR: 'hr',
  WORKSITE: 'worksite',
  PROJECT: 'project',
  TASK: 'task',
  ROUTE_PAGE: 'route_page',
  COMPONENT: 'component',
} as const;

// Task stages
export const TASK_STAGES = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  REVIEW: 'review',
  DONE: 'done',
  BLOCKED: 'blocked',
  CANCELLED: 'cancelled',
} as const;

// Project statuses
export const PROJECT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  COMPLETED: 'completed',
  ON_HOLD: 'on_hold',
  CANCELLED: 'cancelled',
} as const;

// Priority levels
export const PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

// Theme configuration
export const THEME = {
  COLORS: {
    PRIMARY: 'hsl(221.2 83.2% 53.3%)',
    SECONDARY: 'hsl(210 40% 98%)',
    SUCCESS: 'hsl(142.1 76.2% 36.3%)',
    WARNING: 'hsl(47.9 95.8% 53.1%)',
    ERROR: 'hsl(0 84.2% 60.2%)',
    INFO: 'hsl(204 100% 50%)',
  },
  BREAKPOINTS: {
    SM: '640px',
    MD: '768px',
    LG: '1024px',
    XL: '1280px',
    '2XL': '1536px',
  },
} as const;

// Notification settings
export const NOTIFICATIONS = {
  TOAST_DURATION: 4000, // 4 seconds
  MAX_NOTIFICATIONS: 5,
  AUTO_DISMISS: true,
} as const;

// Search and filtering
export const SEARCH = {
  MIN_QUERY_LENGTH: 2,
  DEBOUNCE_DELAY: 300, // milliseconds
  MAX_RECENT_SEARCHES: 10,
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  THEME: 'theme',
  SIDEBAR_COLLAPSED: 'sidebar_collapsed',
  USER_PREFERENCES: 'user_preferences',
  RECENT_SEARCHES: 'recent_searches',
} as const;

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'Access denied. You do not have permission to access this resource.',
  NOT_FOUND: 'The requested resource was not found.',
  INTERNAL_ERROR: 'An internal error occurred. Please try again later.',
  VALIDATION_ERROR: 'Please correct the errors below and try again.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  CREATED: 'Item created successfully.',
  UPDATED: 'Item updated successfully.',
  DELETED: 'Item deleted successfully.',
  SAVED: 'Changes saved successfully.',
  COPIED: 'Copied to clipboard.',
  UPLOADED: 'File uploaded successfully.',
  DOWNLOADED: 'File downloaded successfully.',
} as const;

const constants = {
  API_CONFIG,
  PAGINATION,
  DATE_FORMATS,
  FILE_UPLOAD,
  ROLES,
  TASK_STAGES,
  PROJECT_STATUS,
  PRIORITY,
  THEME,
  NOTIFICATIONS,
  SEARCH,
  STORAGE_KEYS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
};

export default constants;
