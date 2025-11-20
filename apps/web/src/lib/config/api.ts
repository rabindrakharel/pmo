/**
 * ============================================================================
 * API CONFIGURATION - Centralized API Settings
 * ============================================================================
 *
 * Single source of truth for all API-related configuration.
 * Eliminates 21 duplicate API_BASE_URL definitions across the codebase.
 *
 * USAGE:
 * ```typescript
 * import { API_CONFIG } from '@/lib/config/api';
 *
 * const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/project`);
 * ```
 */

export const API_CONFIG = {
  /**
   * Base URL for API requests
   * Defaults to localhost:4000 in development
   */
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000',

  /**
   * Request timeout in milliseconds
   */
  TIMEOUT: 30000,

  /**
   * Number of retry attempts for failed requests
   */
  RETRY_ATTEMPTS: 3,

  /**
   * Retry delay base (exponential backoff)
   */
  RETRY_DELAY_MS: 1000,

  /**
   * Schema cache TTL (5 minutes)
   */
  SCHEMA_CACHE_TTL: 5 * 60 * 1000
} as const;

/**
 * API endpoint builders
 */
export const API_ENDPOINTS = {
  entity: {
    schema: (entityCode: string) => `${API_CONFIG.BASE_URL}/api/v1/entity/${entityCode}/schema`,
    list: (entityCode: string) => `${API_CONFIG.BASE_URL}/api/v1/${entityCode}`,
    get: (entityCode: string, id: string) => `${API_CONFIG.BASE_URL}/api/v1/${entityCode}/${id}`,
    create: (entityCode: string) => `${API_CONFIG.BASE_URL}/api/v1/${entityCode}`,
    update: (entityCode: string, id: string) => `${API_CONFIG.BASE_URL}/api/v1/${entityCode}/${id}`,
    delete: (entityCode: string, id: string) => `${API_CONFIG.BASE_URL}/api/v1/${entityCode}/${id}`,
    types: () => `${API_CONFIG.BASE_URL}/api/v1/entity/codes`,
    options: (entityCode: string) => `${API_CONFIG.BASE_URL}/api/v1/entity/${entityCode}/options`
  },
  auth: {
    login: () => `${API_CONFIG.BASE_URL}/api/v1/auth/login`,
    logout: () => `${API_CONFIG.BASE_URL}/api/v1/auth/logout`,
    refresh: () => `${API_CONFIG.BASE_URL}/api/v1/auth/refresh`
  }
} as const;
