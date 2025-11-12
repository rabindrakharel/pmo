/**
 * Type-Safe API Factory Pattern
 *
 * Eliminates unsafe dynamic API calls like `(api as any)[${entityType}Api]`
 * and provides compile-time type safety with runtime validation.
 *
 * @example
 * // Before (type-unsafe):
 * const apiModule = (api as any)[`${entityType}Api`];
 * const response = await apiModule.list({ page: 1 });
 *
 * // After (type-safe):
 * const api = APIFactory.getAPI(entityType);
 * const response = await api.list({ page: 1 });
 */

// ========================================
// CORE INTERFACES
// ========================================

/**
 * Standard list/query parameters for all entity APIs
 */
export interface ListParams {
  page?: number;
  pageSize?: number;
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  [key: string]: any; // Allow entity-specific filters
}

/**
 * Standard paginated response format
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page?: number;
  limit?: number;
  offset?: number;
}

/**
 * Universal Entity API Interface
 *
 * All entity APIs must implement these methods to be registered in the factory.
 * This ensures consistency across all entity types.
 */
export interface EntityAPI {
  /**
   * List/query entities with optional filtering and pagination
   */
  list(params?: ListParams): Promise<PaginatedResponse<any>>;

  /**
   * Get a single entity by ID
   */
  get(id: string): Promise<any>;

  /**
   * Create a new entity
   */
  create(data: any): Promise<any>;

  /**
   * Update an existing entity
   */
  update(id: string, data: any): Promise<any>;

  /**
   * Delete an entity (usually soft delete)
   */
  delete(id: string): Promise<void>;
}

/**
 * Extended Entity API for entities with child relationships
 *
 * Some entities (like project, task, business, office) have child entity endpoints.
 * This interface extends EntityAPI to include those methods.
 */
export interface ExtendedEntityAPI extends EntityAPI {
  /**
   * Get child entities of a specific type
   *
   * @example
   * projectApi.getTasks(projectId, { page: 1, pageSize: 20 })
   * businessApi.getProjects(businessId, { page: 1, pageSize: 100 })
   */
  [key: `get${string}`]: (id: string, params?: ListParams) => Promise<PaginatedResponse<any>>;
}

// ========================================
// API FACTORY
// ========================================

/**
 * Type-Safe API Factory
 *
 * Central registry for all entity APIs. Provides:
 * - Type safety: Compile-time and runtime type checking
 * - Single source of truth: All APIs registered in one place
 * - Error handling: Clear errors when API not found
 * - Easy testing: Simple mocking and dependency injection
 */
class APIFactoryClass {
  private apis: Map<string, EntityAPI> = new Map();

  /**
   * Register an entity API in the factory
   *
   * @param entityType - Entity type (e.g., 'project', 'task', 'wiki')
   * @param api - API implementation conforming to EntityAPI interface
   *
   * @example
   * APIFactory.register('project', projectApi);
   * APIFactory.register('task', taskApi);
   */
  register(entityType: string, api: EntityAPI): void {
    if (this.apis.has(entityType)) {
      console.warn(`API for entity type "${entityType}" is already registered. Overwriting...`);
    }
    this.apis.set(entityType, api);
  }

  /**
   * Get a registered API by entity type (type-safe)
   *
   * @param entityType - Entity type (e.g., 'project', 'task', 'wiki')
   * @returns Type-safe EntityAPI instance
   * @throws Error if API not found for the given entity type
   *
   * @example
   * const api = APIFactory.getAPI('project');
   * const response = await api.list({ page: 1, pageSize: 100 });
   */
  getAPI(entityType: string): EntityAPI {
    const api = this.apis.get(entityType);
    if (!api) {
      throw new Error(
        `API not found for entity type: "${entityType}". ` +
        `Available types: ${Array.from(this.apis.keys()).join(', ')}`
      );
    }
    return api;
  }

  /**
   * Check if an API is registered for a given entity type
   *
   * @param entityType - Entity type to check
   * @returns True if API is registered, false otherwise
   */
  hasAPI(entityType: string): boolean {
    return this.apis.has(entityType);
  }

  /**
   * Get all registered entity types
   *
   * @returns Array of registered entity type names
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.apis.keys());
  }

  /**
   * Unregister an API (useful for testing)
   *
   * @param entityType - Entity type to unregister
   */
  unregister(entityType: string): void {
    this.apis.delete(entityType);
  }

  /**
   * Clear all registered APIs (useful for testing)
   */
  clear(): void {
    this.apis.clear();
  }
}

// Singleton instance
export const APIFactory = new APIFactoryClass();

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Safe API getter with fallback
 *
 * Returns API if found, otherwise returns null instead of throwing.
 * Useful for optional API calls.
 *
 * @param entityType - Entity type
 * @returns EntityAPI instance or null if not found
 */
export function tryGetAPI(entityType: string): EntityAPI | null {
  try {
    return APIFactory.getAPI(entityType);
  } catch {
    return null;
  }
}

/**
 * Type guard to check if an API has child entity methods
 *
 * @param api - API instance to check
 * @returns True if API has extended child entity methods
 */
export function hasChildEntityMethods(api: EntityAPI): api is ExtendedEntityAPI {
  const childMethods = ['getTasks', 'getProjects', 'getWikis', 'getArtifacts', 'getForms'];
  return childMethods.some(method => method in api && typeof (api as any)[method] === 'function');
}
