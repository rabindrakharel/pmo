/**
 * useGlobalSettings - Global Formatting Settings State
 *
 * REPLACES: globalSettingsMetadataStore.ts (Zustand)
 *
 * Migration Notes:
 * - Before: Zustand store with sessionStorage persistence
 * - After: RxDB local document with IndexedDB persistence
 * - Benefit: Persists across browser sessions (not just page reloads)
 */
import { useRxState } from './useRxState';
import {
  GlobalSettingsLocal,
  DEFAULT_GLOBAL_SETTINGS,
  LocalDocKeys
} from '../schemas/localDocuments';

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Access global formatting settings (currency, date, timestamp, boolean)
 *
 * @example
 * const {
 *   globalSettings,
 *   setGlobalSettings,
 *   getCurrency,
 *   getDateFormat
 * } = useGlobalSettings();
 *
 * // Update currency
 * await setGlobalSettings({
 *   currency: { ...globalSettings.currency, symbol: '€' }
 * });
 *
 * // Use in formatting
 * const { symbol } = getCurrency();
 */
export function useGlobalSettings() {
  const {
    state,
    setState,
    isLoading,
    error,
    clear
  } = useRxState<GlobalSettingsLocal>(
    LocalDocKeys.globalSettings,
    DEFAULT_GLOBAL_SETTINGS
  );

  return {
    // Full state
    globalSettings: state,
    setGlobalSettings: setState,
    isLoading,
    error,
    clearGlobalSettings: clear,

    // Convenience getters (match old Zustand API)
    getCurrency: () => state.currency,
    getDateFormat: () => state.date,
    getTimestampFormat: () => state.timestamp,
    getBooleanFormat: () => state.boolean,

    // Individual setters
    setCurrency: async (currency: GlobalSettingsLocal['currency']) => {
      await setState({ currency });
    },
    setDateFormat: async (date: GlobalSettingsLocal['date']) => {
      await setState({ date });
    },
    setTimestampFormat: async (timestamp: GlobalSettingsLocal['timestamp']) => {
      await setState({ timestamp });
    },
    setBooleanFormat: async (boolean: GlobalSettingsLocal['boolean']) => {
      await setState({ boolean });
    }
  };
}

/**
 * Get just the currency settings
 */
export function useCurrencySettings() {
  const { getCurrency, setCurrency, isLoading } = useGlobalSettings();
  return {
    currency: getCurrency(),
    setCurrency,
    isLoading
  };
}

/**
 * Get just the date format settings
 */
export function useDateFormatSettings() {
  const { getDateFormat, setDateFormat, isLoading } = useGlobalSettings();
  return {
    dateFormat: getDateFormat(),
    setDateFormat,
    isLoading
  };
}

/**
 * Get just the timestamp format settings
 */
export function useTimestampFormatSettings() {
  const { getTimestampFormat, setTimestampFormat, isLoading } = useGlobalSettings();
  return {
    timestampFormat: getTimestampFormat(),
    setTimestampFormat,
    isLoading
  };
}

/**
 * Get just the boolean format settings
 */
export function useBooleanFormatSettings() {
  const { getBooleanFormat, setBooleanFormat, isLoading } = useGlobalSettings();
  return {
    booleanFormat: getBooleanFormat(),
    setBooleanFormat,
    isLoading
  };
}
