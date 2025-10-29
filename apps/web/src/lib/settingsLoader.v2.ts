/**
 * ============================================================================
 * SETTINGS LOADER - DRY Refactored Version
 * ============================================================================
 *
 * SOLID Principles Applied:
 * - Single Responsibility: Each function does one thing
 * - Open/Closed: Extensible without modifying existing code
 * - Dependency Inversion: Depends on abstractions (registry), not concrete implementations
 */

import { SETTINGS_REGISTRY, getSettingEndpoint, COLOR_MAP } from './settingsConfig';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// ============================================================================
// TYPES
// ============================================================================

export interface SettingOption {
  value: string | number;
  label: string;
  colorClass?: string;
  metadata?: {
    descr?: string;
    color_code?: string;
    parent_id?: number | null;
  };
}

interface CacheEntry {
  data: SettingOption[];
  timestamp: number;
}

// ============================================================================
// CACHE MANAGEMENT - Strategy Pattern
// ============================================================================

class SettingsCache {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  get(datalabel: string): SettingOption[] | null {
    const cached = this.cache.get(datalabel);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  set(datalabel: string, data: SettingOption[]): void {
    this.cache.set(datalabel, {
      data,
      timestamp: Date.now()
    });
  }

  clear(datalabel?: string): void {
    if (datalabel) {
      this.cache.delete(datalabel);
    } else {
      this.cache.clear();
    }
  }
}

const cache = new SettingsCache();

// ============================================================================
// DATA TRANSFORMATION - Single Responsibility
// ============================================================================

/**
 * Transform API response item to SettingOption
 */
function transformToOption(item: any): SettingOption {
  const id = item.id;
  const name = item.name || String(item.id);
  const colorCode = item.color_code;

  return {
    value: name || id,
    label: name,
    colorClass: colorCode ? (COLOR_MAP[colorCode] || COLOR_MAP.gray) : undefined,
    metadata: {
      descr: item.descr,
      color_code: colorCode,
      parent_id: item.parent_id,
    }
  };
}

// ============================================================================
// HTTP CLIENT - Dependency Inversion
// ============================================================================

interface HttpClient {
  fetch(url: string): Promise<any>;
}

class AuthenticatedHttpClient implements HttpClient {
  async fetch(url: string): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${url}`, { headers });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }
}

const httpClient = new AuthenticatedHttpClient();

// ============================================================================
// CORE LOADER - Open/Closed Principle
// ============================================================================

/**
 * Load setting options from API
 * DRY: Generic function works for all settings
 */
export async function loadSettingOptions(
  datalabel: string,
  forceRefresh: boolean = false
): Promise<SettingOption[]> {
  // Check cache
  if (!forceRefresh) {
    const cached = cache.get(datalabel);
    if (cached) return cached;
  }

  try {
    const endpoint = getSettingEndpoint(datalabel);
    const result = await httpClient.fetch(endpoint);
    const data = result.data || result || [];

    // Transform and sort
    const options = data
      .map(transformToOption)
      .sort((a, b) => String(a.label).localeCompare(String(b.label)));

    // Cache results
    cache.set(datalabel, options);

    return options;
  } catch (error) {
    console.error(`Error loading settings for ${datalabel}:`, error);
    return [];
  }
}

// ============================================================================
// FIELD MAPPING - Configuration-Driven
// ============================================================================

/**
 * Automatic field-to-datalabel mapping
 * DRY: Generated from registry instead of manual mapping
 */
export function getFieldMapping(): Record<string, string> {
  const mapping: Record<string, string> = {};

  // Generate from registry
  SETTINGS_REGISTRY.forEach(setting => {
    mapping[setting.datalabel] = setting.datalabel;
    mapping[setting.key] = setting.datalabel;
    // Common field name variations
    mapping[`${setting.datalabel}_id`] = setting.datalabel;
    mapping[`${setting.datalabel}_name`] = setting.datalabel;
  });

  return mapping;
}

const FIELD_MAPPING = getFieldMapping();

/**
 * Get datalabel for a field key
 */
export function getDatalabelForField(fieldKey: string): string | null {
  return FIELD_MAPPING[fieldKey] || null;
}

/**
 * Load options for a specific field
 */
export async function loadFieldOptions(fieldKey: string): Promise<SettingOption[]> {
  const datalabel = getDatalabelForField(fieldKey);
  if (!datalabel) return [];
  return loadSettingOptions(datalabel);
}

// ============================================================================
// BATCH OPERATIONS - Performance Optimization
// ============================================================================

/**
 * Preload multiple settings in parallel
 */
export async function preloadSettings(datalabels: string[]): Promise<void> {
  await Promise.all(datalabels.map(d => loadSettingOptions(d)));
}

/**
 * Batch load for multiple fields
 */
export async function batchLoadFieldOptions(
  fieldKeys: string[]
): Promise<Map<string, SettingOption[]>> {
  const resultMap = new Map<string, SettingOption[]>();

  // Get unique datalabels
  const datalabels = new Set(
    fieldKeys
      .map(key => getDatalabelForField(key))
      .filter((d): d is string => d !== null)
  );

  // Load all in parallel
  const results = await Promise.all(
    Array.from(datalabels).map(async (datalabel) => ({
      datalabel,
      options: await loadSettingOptions(datalabel)
    }))
  );

  // Build map
  const datalabelMap = new Map(
    results.map(({ datalabel, options }) => [datalabel, options])
  );

  // Map field keys to options
  for (const fieldKey of fieldKeys) {
    const datalabel = getDatalabelForField(fieldKey);
    if (datalabel) {
      resultMap.set(fieldKey, datalabelMap.get(datalabel) || []);
    }
  }

  return resultMap;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get display label for a value
 */
export function getSettingLabel(
  value: string | number,
  options: SettingOption[]
): string | null {
  const option = options.find(opt => String(opt.value) === String(value));
  return option ? option.label : null;
}

/**
 * Clear cache
 */
export function clearCache(datalabel?: string): void {
  cache.clear(datalabel);
}

/**
 * Get all available datalabels
 */
export function getAllDatalabels(): string[] {
  return SETTINGS_REGISTRY.map(s => s.datalabel);
}
