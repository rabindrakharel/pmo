/**
 * Type-Safe API Factory Pattern
 *
 * Eliminates unsafe dynamic API calls like `(api as any)[${entityCode}Api]`
 * and provides compile-time type safety with runtime validation.
 *
 * @example
 * // Before (type-unsafe):
 * const apiModule = (api as any)[`${entityCode}Api`];
 * const response = await apiModule.list({ page: 1 });
 *
 * // After (type-safe):
 * const api = APIFactory.getAPI(entityCode);
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
 * Backend field metadata (matches backend-formatter.service.ts)
 */
export interface BackendFieldMetadata {
  key: string;
  label: string;
  type: string;
  dataType?: string;
  format: Record<string, any>;
  renderType: string;
  viewType?: string;
  component?: string;
  inputType: string;
  editType?: string;
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
  searchable: boolean;
  editable: boolean;
  required?: boolean;
  align: 'left' | 'right' | 'center';
  width: string;
  endpoint?: string;
  loadFromDataLabels?: boolean;
  loadFromEntity?: string;
  settingsDatalabel?: string;
  options?: Array<{ value: any; label: string; color?: string }>;
  validation?: Record<string, any>;
  help?: string;
  placeholder?: string;
  pattern?: string;
  category?: string;
}

/**
 * Entity metadata from backend
 */
export interface EntityMetadata {
  entity: string;
  label: string;
  labelPlural: string;
  icon?: string;
  fields: BackendFieldMetadata[];
  primaryKey: string;
  displayField: string;
  apiEndpoint: string;
  supportedViews?: string[];
  defaultView?: string;
  generated_at: string;
}

/**
 * Standard paginated response format (with backend metadata)
 */
export interface PaginatedResponse<T> {
  data: T[];
  metadata?: EntityMetadata;  // Backend-driven field metadata
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
   * Get a single entity by ID (with backend metadata)
   */
  get(id: string): Promise<{ data: any; metadata?: EntityMetadata }>;

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
   * @param entityCode - Entity type (e.g., 'project', 'task', 'wiki')
   * @param api - API implementation conforming to EntityAPI interface
   *
   * @example
   * APIFactory.register('project', projectApi);
   * APIFactory.register('task', taskApi);
   */
  register(entityCode: string, api: EntityAPI): void {
    if (this.apis.has(entityCode)) {
      console.warn(`API for entity type "${entityCode}" is already registered. Overwriting...`);
    }
    this.apis.set(entityCode, api);
  }

  /**
   * Get a registered API by entity type (type-safe)
   *
   * @param entityCode - Entity type (e.g., 'project', 'task', 'wiki')
   * @returns Type-safe EntityAPI instance
   * @throws Error if API not found for the given entity type
   *
   * @example
   * const api = APIFactory.getAPI('project');
   * const response = await api.list({ page: 1, pageSize: 100 });
   */
  getAPI(entityCode: string): EntityAPI {
    const api = this.apis.get(entityCode);
    if (!api) {
      throw new Error(
        `API not found for entity type: "${entityCode}". ` +
        `Available types: ${Array.from(this.apis.keys()).join(', ')}`
      );
    }
    return api;
  }

  /**
   * Check if an API is registered for a given entity type
   *
   * @param entityCode - Entity type to check
   * @returns True if API is registered, false otherwise
   */
  hasAPI(entityCode: string): boolean {
    return this.apis.has(entityCode);
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
   * @param entityCode - Entity type to unregister
   */
  unregister(entityCode: string): void {
    this.apis.delete(entityCode);
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
 * @param entityCode - Entity type
 * @returns EntityAPI instance or null if not found
 */
export function tryGetAPI(entityCode: string): EntityAPI | null {
  try {
    return APIFactory.getAPI(entityCode);
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
