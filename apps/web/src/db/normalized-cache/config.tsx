// ============================================================================
// Cache Configuration Context
// ============================================================================
// React context for cache configuration - enables/disables cache globally
// ============================================================================

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { type CacheConfig, type CacheStrategy, DEFAULT_CACHE_CONFIG } from './types';

// ============================================================================
// Context Definition
// ============================================================================

interface CacheConfigContextValue {
  config: CacheConfig;
  // Global toggle
  setEnabled: (enabled: boolean) => void;
  // Strategy
  setStrategy: (strategy: CacheStrategy) => void;
  // Layer-specific toggles
  setLayerEnabled: (layer: keyof CacheConfig['layers'], enabled: boolean) => void;
  // Stale times
  setStaleTime: (layer: keyof CacheConfig['staleTimes'], ms: number) => void;
  // Feature toggles
  setDeltaSync: (enabled: boolean) => void;
  setPersistence: (enabled: boolean) => void;
  setDebug: (enabled: boolean) => void;
  // Reset to defaults
  resetToDefaults: () => void;
  // Helpers
  isLayerEnabled: (layer: keyof CacheConfig['layers']) => boolean;
  shouldUseCache: () => boolean;
  shouldFetchFromAPI: () => boolean;
}

const CacheConfigContext = createContext<CacheConfigContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

interface CacheConfigProviderProps {
  children: ReactNode;
  initialConfig?: Partial<CacheConfig>;
}

export function CacheConfigProvider({
  children,
  initialConfig = {},
}: CacheConfigProviderProps) {
  const [config, setConfig] = useState<CacheConfig>(() => ({
    ...DEFAULT_CACHE_CONFIG,
    ...initialConfig,
    layers: { ...DEFAULT_CACHE_CONFIG.layers, ...initialConfig.layers },
    staleTimes: { ...DEFAULT_CACHE_CONFIG.staleTimes, ...initialConfig.staleTimes },
  }));

  // Global toggle
  const setEnabled = useCallback((enabled: boolean) => {
    setConfig(prev => ({ ...prev, enabled }));
  }, []);

  // Strategy
  const setStrategy = useCallback((strategy: CacheStrategy) => {
    setConfig(prev => ({ ...prev, strategy }));
  }, []);

  // Layer-specific toggles
  const setLayerEnabled = useCallback((layer: keyof CacheConfig['layers'], enabled: boolean) => {
    setConfig(prev => ({
      ...prev,
      layers: { ...prev.layers, [layer]: enabled },
    }));
  }, []);

  // Stale times
  const setStaleTime = useCallback((layer: keyof CacheConfig['staleTimes'], ms: number) => {
    setConfig(prev => ({
      ...prev,
      staleTimes: { ...prev.staleTimes, [layer]: ms },
    }));
  }, []);

  // Feature toggles
  const setDeltaSync = useCallback((enabled: boolean) => {
    setConfig(prev => ({ ...prev, deltaSync: enabled }));
  }, []);

  const setPersistence = useCallback((enabled: boolean) => {
    setConfig(prev => ({ ...prev, persistToIndexedDB: enabled }));
  }, []);

  const setDebug = useCallback((enabled: boolean) => {
    setConfig(prev => ({ ...prev, debug: enabled }));
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setConfig(DEFAULT_CACHE_CONFIG);
  }, []);

  // Helpers
  const isLayerEnabled = useCallback((layer: keyof CacheConfig['layers']): boolean => {
    return config.enabled && config.layers[layer];
  }, [config.enabled, config.layers]);

  const shouldUseCache = useCallback((): boolean => {
    return config.enabled && (config.strategy === 'cache-first' || config.strategy === 'cache-only');
  }, [config.enabled, config.strategy]);

  const shouldFetchFromAPI = useCallback((): boolean => {
    return !config.enabled || config.strategy !== 'cache-only';
  }, [config.enabled, config.strategy]);

  const value = useMemo((): CacheConfigContextValue => ({
    config,
    setEnabled,
    setStrategy,
    setLayerEnabled,
    setStaleTime,
    setDeltaSync,
    setPersistence,
    setDebug,
    resetToDefaults,
    isLayerEnabled,
    shouldUseCache,
    shouldFetchFromAPI,
  }), [
    config,
    setEnabled,
    setStrategy,
    setLayerEnabled,
    setStaleTime,
    setDeltaSync,
    setPersistence,
    setDebug,
    resetToDefaults,
    isLayerEnabled,
    shouldUseCache,
    shouldFetchFromAPI,
  ]);

  return (
    <CacheConfigContext.Provider value={value}>
      {children}
    </CacheConfigContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access cache configuration
 * Must be used within CacheConfigProvider
 */
export function useCacheConfig(): CacheConfigContextValue {
  const context = useContext(CacheConfigContext);
  if (!context) {
    throw new Error('useCacheConfig must be used within a CacheConfigProvider');
  }
  return context;
}

/**
 * Hook to check if a specific layer is enabled
 */
export function useLayerEnabled(layer: keyof CacheConfig['layers']): boolean {
  const { isLayerEnabled } = useCacheConfig();
  return isLayerEnabled(layer);
}

// ============================================================================
// Non-React Access (for utilities/formatters)
// ============================================================================

let globalConfig: CacheConfig = DEFAULT_CACHE_CONFIG;

/**
 * Set global config (called by provider on mount)
 */
export function setGlobalCacheConfig(config: CacheConfig): void {
  globalConfig = config;
}

/**
 * Get global config (for non-hook contexts)
 */
export function getCacheConfig(): CacheConfig {
  return globalConfig;
}

/**
 * Check if cache is globally enabled (for non-hook contexts)
 */
export function isCacheEnabled(): boolean {
  return globalConfig.enabled;
}

/**
 * Check if specific layer is enabled (for non-hook contexts)
 */
export function isLayerEnabledSync(layer: keyof CacheConfig['layers']): boolean {
  return globalConfig.enabled && globalConfig.layers[layer];
}

/**
 * Get stale time for a layer (for non-hook contexts)
 */
export function getStaleTime(layer: keyof CacheConfig['staleTimes']): number {
  return globalConfig.staleTimes[layer];
}
