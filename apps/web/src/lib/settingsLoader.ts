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
  'project_stage': 'project_stage',
  'project_status': 'project_status',

  // Task fields
  'stage': 'task_stage',
  'task_stage': 'task_stage',
  'status': 'task_status',
  'task_status': 'task_status',
  'priority_level': 'task_priority',

  // Client fields
  'opportunity_funnel_level_name': 'opportunity_funnel_level',
  'industry_sector_name': 'industry_sector',
  'acquisition_channel_name': 'acquisition_channel',
  'customer_tier_name': 'customer_tier',
  'client_status': 'client_status',

  // Business fields
  'level_id': 'business_level', // Context-dependent
  'level_name': 'business_level',
  'business_level_id': 'business_level',

  // Office fields
  'office_level_id': 'office_level',

  // HR/Position fields
  'position_level_id': 'position_level',
  'hr_level_id': 'hr_level',

  // Client level
  'client_level_id': 'client_level',

  // Form fields
  'submission_status': 'form_submission_status',
  'approval_status': 'form_approval_status',

  // Wiki fields
  'publication_status': 'wiki_publication_status',

  // Task activity fields
  'update_type': 'task_update_type',
};

/**
 * Mapping of setting categories to their API endpoints
 */
export const SETTING_CATEGORY_TO_ENDPOINT: Record<string, string> = {
  'project_stage': '/api/v1/setting?category=project_stage',
  'project_status': '/api/v1/setting?category=project_status',
  'task_stage': '/api/v1/setting?category=task_stage',
  'task_status': '/api/v1/setting?category=task_status',
  'task_priority': '/api/v1/setting?category=task_priority',
  'opportunity_funnel_level': '/api/v1/setting?category=opportunity_funnel_level',
  'industry_sector': '/api/v1/setting?category=industry_sector',
  'acquisition_channel': '/api/v1/setting?category=acquisition_channel',
  'customer_tier': '/api/v1/setting?category=customer_tier',
  'client_status': '/api/v1/setting?category=client_status',
  'business_level': '/api/v1/setting?category=business_level',
  'office_level': '/api/v1/setting?category=office_level',
  'position_level': '/api/v1/setting?category=position_level',
  'hr_level': '/api/v1/setting?category=hr_level',
  'client_level': '/api/v1/setting?category=client_level',
  'form_submission_status': '/api/v1/setting?category=form_submission_status',
  'form_approval_status': '/api/v1/setting?category=form_approval_status',
  'wiki_publication_status': '/api/v1/setting?category=wiki_publication_status',
  'task_update_type': '/api/v1/setting?category=task_update_type',
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
        // Use level_name as value for text-based fields, otherwise use level_id or id
        value: item.level_name || (item.level_id !== undefined ? item.level_id : item.id),
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
