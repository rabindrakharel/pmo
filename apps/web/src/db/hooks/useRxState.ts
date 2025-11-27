/**
 * useRxState - RxDB Local Document State Management
 *
 * REPLACES: Zustand stores (globalSettingsMetadataStore, etc.)
 *
 * RxDB Local Documents:
 * - Stored in IndexedDB (persistent across sessions)
 * - NOT synced to backend (device-local only)
 * - Reactive (subscribers notified on change)
 * - Prefixed with _local/ internally
 *
 * @example
 * const { state, setState, isLoading } = useRxState<GlobalSettings>(
 *   'global-settings',
 *   DEFAULT_GLOBAL_SETTINGS
 * );
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useDatabase } from './useDatabase';
import type { RxLocalDocument } from 'rxdb';

// ============================================================================
// Types
// ============================================================================

export interface UseRxStateResult<T> {
  /** Current state value */
  state: T;

  /** Update state (partial update or updater function) */
  setState: (update: Partial<T> | ((prev: T) => Partial<T>)) => Promise<void>;

  /** True while loading initial state */
  isLoading: boolean;

  /** Error if state operation failed */
  error: Error | null;

  /** Reset state to default value */
  clear: () => Promise<void>;

  /** Force refresh from IndexedDB */
  refresh: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Manage persistent local state with RxDB local documents
 *
 * @param key - Unique key for this state (e.g., 'global-settings')
 * @param defaultValue - Default value if state doesn't exist
 * @returns State value and setter
 *
 * @example
 * // Global settings
 * const { state: settings, setState } = useRxState(
 *   'global-settings',
 *   { currency: { symbol: '$', ... } }
 * );
 *
 * // Update
 * await setState({ currency: { ...settings.currency, symbol: '€' } });
 *
 * // Or with updater function
 * await setState(prev => ({ ...prev, currency: { ...prev.currency, symbol: '€' } }));
 */
export function useRxState<T extends Record<string, unknown>>(
  key: string,
  defaultValue: T
): UseRxStateResult<T> {
  const db = useDatabase();
  const [state, setStateInternal] = useState<T>(defaultValue);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Track if component is mounted
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Subscribe to local document changes
  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const subscription = db.getLocal$<T>(key).subscribe({
      next: (doc: RxLocalDocument<T, unknown> | null) => {
        if (!isMountedRef.current) return;

        if (doc) {
          // RxDB wraps the data, extract it
          const data = doc.get('data') as T || doc.toJSON() as T;
          setStateInternal(data);
        } else {
          setStateInternal(defaultValue);
        }
        setIsLoading(false);
      },
      error: (err: Error) => {
        if (!isMountedRef.current) return;

        console.error(`[useRxState] Error for "${key}":`, err);
        setError(err);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [db, key, defaultValue]);

  // Update state
  const setState = useCallback(async (
    update: Partial<T> | ((prev: T) => Partial<T>)
  ): Promise<void> => {
    try {
      const currentDoc = await db.getLocal<T>(key);
      const currentState = currentDoc?.get('data') as T || currentDoc?.toJSON() as T || defaultValue;

      const updateValue = typeof update === 'function'
        ? update(currentState)
        : update;

      const newState = {
        ...currentState,
        ...updateValue,
        _updatedAt: Date.now()
      };

      await db.upsertLocal(key, newState);
    } catch (err) {
      console.error(`[useRxState] Failed to update "${key}":`, err);
      throw err;
    }
  }, [db, key, defaultValue]);

  // Clear state (reset to default)
  const clear = useCallback(async (): Promise<void> => {
    try {
      const doc = await db.getLocal<T>(key);
      if (doc) {
        await doc.remove();
      }
      if (isMountedRef.current) {
        setStateInternal(defaultValue);
      }
    } catch (err) {
      console.error(`[useRxState] Failed to clear "${key}":`, err);
      throw err;
    }
  }, [db, key, defaultValue]);

  // Force refresh from IndexedDB
  const refresh = useCallback(() => {
    db.getLocal<T>(key).then(doc => {
      if (isMountedRef.current) {
        if (doc) {
          const data = doc.get('data') as T || doc.toJSON() as T;
          setStateInternal(data);
        } else {
          setStateInternal(defaultValue);
        }
      }
    }).catch(console.error);
  }, [db, key, defaultValue]);

  return {
    state,
    setState,
    isLoading,
    error,
    clear,
    refresh
  };
}

/**
 * useRxStateSelector - Select a subset of state
 *
 * @example
 * const currency = useRxStateSelector(
 *   'global-settings',
 *   DEFAULT_GLOBAL_SETTINGS,
 *   (state) => state.currency
 * );
 */
export function useRxStateSelector<T extends Record<string, unknown>, R>(
  key: string,
  defaultValue: T,
  selector: (state: T) => R
): {
  value: R;
  isLoading: boolean;
  error: Error | null;
  setState: (update: Partial<T> | ((prev: T) => Partial<T>)) => Promise<void>;
} {
  const { state, isLoading, error, setState } = useRxState(key, defaultValue);

  return {
    value: selector(state),
    isLoading,
    error,
    setState
  };
}

/**
 * useRxStateWithTTL - State with automatic expiration
 *
 * @example
 * const { state, isExpired, refresh } = useRxStateWithTTL(
 *   'component-metadata:project:entityDataTable',
 *   defaultMetadata,
 *   15 * 60 * 1000 // 15 minutes
 * );
 */
export function useRxStateWithTTL<T extends Record<string, unknown> & { _updatedAt?: number }>(
  key: string,
  defaultValue: T,
  ttlMs: number
): UseRxStateResult<T> & { isExpired: boolean } {
  const result = useRxState(key, defaultValue);

  const isExpired = (() => {
    const updatedAt = result.state._updatedAt;
    if (!updatedAt) return true;
    return Date.now() - updatedAt > ttlMs;
  })();

  return {
    ...result,
    isExpired
  };
}
