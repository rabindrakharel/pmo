import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { generateLabelToUuidMapping, type LabelToUuidMapping } from '../lib/labelToUuidFieldMapper';

/**
 * Global cache for label→UUID field mappings
 *
 * Automatically populated when API data arrives via response interceptor
 *
 * Example:
 * {
 *   "project-abc-123": {
 *     "manager": { uuidField: "manager__employee_id", entityCode: "employee", multiple: false },
 *     "stakeholder": { uuidField: "stakeholder__employee_ids", entityCode: "employee", multiple: true }
 *   },
 *   "task-def-456": {
 *     "assignee": { uuidField: "assignee__employee_id", entityCode: "employee", multiple: false }
 *   }
 * }
 */
interface MappingCache {
  [entityKey: string]: LabelToUuidMapping;
}

interface LabelToUuidMappingContextType {
  /**
   * Get mapping for a specific entity (by code and ID)
   * Returns undefined if mapping not yet generated
   */
  getMapping: (entityCode: string, entityId: string) => LabelToUuidMapping | undefined;

  /**
   * Get mapping from raw data object (generates on-the-fly if not cached)
   */
  getMappingFromData: (data: Record<string, any>) => LabelToUuidMapping;

  /**
   * Set mapping for a specific entity
   * Usually called automatically by API interceptor
   */
  setMapping: (entityCode: string, entityId: string, mapping: LabelToUuidMapping) => void;

  /**
   * Set mapping from raw data (auto-generates mapping)
   */
  setMappingFromData: (entityCode: string, entityId: string, data: Record<string, any>) => void;

  /**
   * Clear all mappings (for logout or cache reset)
   */
  clearMappings: () => void;

  /**
   * Get entire cache (for debugging)
   */
  getAllMappings: () => MappingCache;
}

const LabelToUuidMappingContext = createContext<LabelToUuidMappingContextType | undefined>(undefined);

/**
 * Provider component that manages global label→UUID mapping cache
 *
 * Wrap your app with this provider to enable automatic mapping generation
 *
 * @example
 * <LabelToUuidMappingProvider>
 *   <App />
 * </LabelToUuidMappingProvider>
 */
export const LabelToUuidMappingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cache, setCache] = useState<MappingCache>({});

  /**
   * Generate entity key for cache lookup
   */
  const getEntityKey = useCallback((entityCode: string, entityId: string): string => {
    return `${entityCode}:${entityId}`;
  }, []);

  /**
   * Get mapping for specific entity from cache
   */
  const getMapping = useCallback((entityCode: string, entityId: string): LabelToUuidMapping | undefined => {
    const key = getEntityKey(entityCode, entityId);
    return cache[key];
  }, [cache, getEntityKey]);

  /**
   * Generate mapping from raw data (on-the-fly, not cached)
   */
  const getMappingFromData = useCallback((data: Record<string, any>): LabelToUuidMapping => {
    return generateLabelToUuidMapping(data);
  }, []);

  /**
   * Set mapping for specific entity
   */
  const setMapping = useCallback((entityCode: string, entityId: string, mapping: LabelToUuidMapping) => {
    const key = getEntityKey(entityCode, entityId);
    setCache(prev => ({
      ...prev,
      [key]: mapping
    }));
  }, [getEntityKey]);

  /**
   * Auto-generate and set mapping from raw data
   */
  const setMappingFromData = useCallback((entityCode: string, entityId: string, data: Record<string, any>) => {
    const mapping = generateLabelToUuidMapping(data);

    // Only cache if mapping is non-empty
    if (Object.keys(mapping).length > 0) {
      setMapping(entityCode, entityId, mapping);
    }
  }, [setMapping]);

  /**
   * Clear all mappings (logout or reset)
   */
  const clearMappings = useCallback(() => {
    setCache({});
  }, []);

  /**
   * Get all mappings (debugging)
   */
  const getAllMappings = useCallback(() => {
    return cache;
  }, [cache]);

  const value = useMemo(() => ({
    getMapping,
    getMappingFromData,
    setMapping,
    setMappingFromData,
    clearMappings,
    getAllMappings
  }), [getMapping, getMappingFromData, setMapping, setMappingFromData, clearMappings, getAllMappings]);

  return (
    <LabelToUuidMappingContext.Provider value={value}>
      {children}
    </LabelToUuidMappingContext.Provider>
  );
};

/**
 * Hook to access label→UUID mapping context
 *
 * @throws Error if used outside LabelToUuidMappingProvider
 *
 * @example
 * const MyComponent = ({ entityCode, entityId, data }) => {
 *   const { getMapping, getMappingFromData } = useLabelToUuidMappingContext();
 *
 *   // Get cached mapping
 *   const cachedMapping = getMapping(entityCode, entityId);
 *
 *   // Or generate on-the-fly from data
 *   const mapping = getMappingFromData(data);
 *
 *   // Use mapping
 *   const managerUuidField = mapping?.manager?.uuidField;
 *   // Returns: "manager__employee_id"
 * };
 */
export const useLabelToUuidMappingContext = (): LabelToUuidMappingContextType => {
  const context = useContext(LabelToUuidMappingContext);

  if (!context) {
    throw new Error('useLabelToUuidMappingContext must be used within LabelToUuidMappingProvider');
  }

  return context;
};

/**
 * Optional hook for components that may or may not have the provider
 * Returns undefined if provider is not available
 */
export const useOptionalLabelToUuidMappingContext = (): LabelToUuidMappingContextType | undefined => {
  return useContext(LabelToUuidMappingContext);
};
