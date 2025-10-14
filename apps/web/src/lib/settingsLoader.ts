/**
 * Settings Loader Utility
 *
 * Dynamically loads dropdown options from setting tables in the database.
 * Provides a centralized, reusable way to fetch and cache setting values
 * for use in forms, inline editing, and filters.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export interface SettingOption {
  value: string | number;
  label: string;
  metadata?: {
    level_id?: number;
    level_descr?: string;
    sort_order?: number;
    color_code?: string;
    active_flag?: boolean;
  };
}

// In-memory cache for settings to avoid repeated API calls
const settingsCache: Map<string, { data: SettingOption[]; timestamp: number }> = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Mapping of field names to their corresponding setting categories
 * This defines which fields should load from which settings tables
 */
export const FIELD_TO_SETTING_MAP: Record<string, string> = {
  // Project fields
  'project_stage': 'projectStage',
  'project_status': 'projectStatus',

  // Task fields
  'stage': 'taskStage',
  'task_stage': 'taskStage',
  'status': 'taskStatus',
  'task_status': 'taskStatus',

  // Client fields
  'opportunity_funnel_level_id': 'opportunityFunnelLevel',
  'industry_sector_id': 'industrySector',
  'acquisition_channel_id': 'acquisitionChannel',
  'customer_tier_id': 'customerTier',

  // Business fields
  'level_id': 'businessLevel', // Context-dependent
  'business_level_id': 'businessLevel',

  // Office fields
  'office_level_id': 'orgLevel',

  // HR/Position fields
  'position_level_id': 'positionLevel',
  'hr_level_id': 'hrLevel',

  // Client level
  'client_level_id': 'clientLevel',
};

/**
 * Mapping of setting categories to their API endpoints
 */
export const SETTING_CATEGORY_TO_ENDPOINT: Record<string, string> = {
  'projectStage': '/api/v1/setting?category=projectStage',
  'projectStatus': '/api/v1/setting?category=projectStatus',
  'taskStage': '/api/v1/setting?category=taskStage',
  'taskStatus': '/api/v1/setting?category=taskStatus',
  'opportunityFunnelLevel': '/api/v1/setting?category=opportunityFunnelLevel',
  'industrySector': '/api/v1/setting?category=industrySector',
  'acquisitionChannel': '/api/v1/setting?category=acquisitionChannel',
  'customerTier': '/api/v1/setting?category=customerTier',
  'businessLevel': '/api/v1/setting?category=businessLevel',
  'orgLevel': '/api/v1/setting?category=orgLevel',
  'positionLevel': '/api/v1/setting?category=positionLevel',
  'hrLevel': '/api/v1/setting?category=hrLevel',
  'clientLevel': '/api/v1/setting?category=clientLevel',
};

/**
 * Check if a field name maps to a settings table
 */
export function isSettingField(fieldKey: string): boolean {
  return fieldKey in FIELD_TO_SETTING_MAP;
}

/**
 * Get the setting category for a given field key
 */
export function getSettingCategory(fieldKey: string): string | null {
  return FIELD_TO_SETTING_MAP[fieldKey] || null;
}

/**
 * Get the API endpoint for a setting category
 */
export function getSettingEndpoint(category: string): string | null {
  return SETTING_CATEGORY_TO_ENDPOINT[category] || null;
}

/**
 * Load settings options from the API with caching
 */
export async function loadSettingOptions(
  category: string,
  forceRefresh: boolean = false
): Promise<SettingOption[]> {
  // Check cache first
  if (!forceRefresh) {
    const cached = settingsCache.get(category);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
  }

  // Get API endpoint
  const endpoint = getSettingEndpoint(category);
  if (!endpoint) {
    console.warn(`No endpoint found for setting category: ${category}`);
    return [];
  }

  try {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, { headers });

    if (!response.ok) {
      throw new Error(`Failed to fetch settings: ${response.statusText}`);
    }

    const result = await response.json();
    const data = result.data || result || [];

    // Transform to SettingOption format
    const options: SettingOption[] = data
      .filter((item: any) => item.active_flag !== false) // Only active items
      .map((item: any) => ({
        value: item.level_id !== undefined ? item.level_id : item.id,
        label: item.level_name || item.name || item.title || String(item.id),
        metadata: {
          level_id: item.level_id,
          level_descr: item.level_descr || item.descr,
          sort_order: item.sort_order,
          color_code: item.color_code,
          active_flag: item.active_flag,
        }
      }))
      .sort((a, b) => {
        // Sort by sort_order if available, otherwise by label
        const orderA = a.metadata?.sort_order ?? 999;
        const orderB = b.metadata?.sort_order ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return String(a.label).localeCompare(String(b.label));
      });

    // Cache the results
    settingsCache.set(category, {
      data: options,
      timestamp: Date.now()
    });

    return options;
  } catch (error) {
    console.error(`Error loading setting options for ${category}:`, error);
    return [];
  }
}

/**
 * Load settings options for a specific field key
 * This is the main function to use in components
 */
export async function loadFieldOptions(fieldKey: string): Promise<SettingOption[]> {
  const category = getSettingCategory(fieldKey);
  if (!category) {
    return [];
  }
  return loadSettingOptions(category);
}

/**
 * Preload multiple setting categories at once
 * Useful for preloading all settings needed for a form
 */
export async function preloadSettings(categories: string[]): Promise<void> {
  await Promise.all(
    categories.map(category => loadSettingOptions(category))
  );
}

/**
 * Clear the settings cache (useful after updates)
 */
export function clearSettingsCache(category?: string): void {
  if (category) {
    settingsCache.delete(category);
  } else {
    settingsCache.clear();
  }
}

/**
 * Get all available setting categories
 */
export function getAllSettingCategories(): string[] {
  return Object.keys(SETTING_CATEGORY_TO_ENDPOINT);
}

/**
 * Batch load settings for multiple fields at once
 * Returns a map of fieldKey -> options
 */
export async function batchLoadFieldOptions(
  fieldKeys: string[]
): Promise<Map<string, SettingOption[]>> {
  const resultMap = new Map<string, SettingOption[]>();

  // Get unique categories
  const categories = new Set(
    fieldKeys
      .map(key => getSettingCategory(key))
      .filter((cat): cat is string => cat !== null)
  );

  // Load all categories in parallel
  const categoryResults = await Promise.all(
    Array.from(categories).map(async (category) => ({
      category,
      options: await loadSettingOptions(category)
    }))
  );

  // Build a category -> options map
  const categoryMap = new Map(
    categoryResults.map(({ category, options }) => [category, options])
  );

  // Map field keys to their options
  for (const fieldKey of fieldKeys) {
    const category = getSettingCategory(fieldKey);
    if (category) {
      resultMap.set(fieldKey, categoryMap.get(category) || []);
    }
  }

  return resultMap;
}

/**
 * Helper to get the display label for a setting value
 */
export function getSettingLabel(
  fieldKey: string,
  value: string | number,
  options: SettingOption[]
): string | null {
  const option = options.find(opt => String(opt.value) === String(value));
  return option ? option.label : null;
}
