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
    apis = new Map();
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
    register(entityCode, api) {
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
    getAPI(entityCode) {
        const api = this.apis.get(entityCode);
        if (!api) {
            throw new Error(`API not found for entity type: "${entityCode}". ` +
                `Available types: ${Array.from(this.apis.keys()).join(', ')}`);
        }
        return api;
    }
    /**
     * Check if an API is registered for a given entity type
     *
     * @param entityCode - Entity type to check
     * @returns True if API is registered, false otherwise
     */
    hasAPI(entityCode) {
        return this.apis.has(entityCode);
    }
    /**
     * Get all registered entity types
     *
     * @returns Array of registered entity type names
     */
    getRegisteredTypes() {
        return Array.from(this.apis.keys());
    }
    /**
     * Unregister an API (useful for testing)
     *
     * @param entityCode - Entity type to unregister
     */
    unregister(entityCode) {
        this.apis.delete(entityCode);
    }
    /**
     * Clear all registered APIs (useful for testing)
     */
    clear() {
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
export function tryGetAPI(entityCode) {
    try {
        return APIFactory.getAPI(entityCode);
    }
    catch {
        return null;
    }
}
/**
 * Type guard to check if an API has child entity methods
 *
 * @param api - API instance to check
 * @returns True if API has extended child entity methods
 */
export function hasChildEntityMethods(api) {
    const childMethods = ['getTasks', 'getProjects', 'getWikis', 'getArtifacts', 'getForms'];
    return childMethods.some(method => method in api && typeof api[method] === 'function');
}
