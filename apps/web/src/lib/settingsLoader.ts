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
  colorClass?: string; // Badge color class (e.g., 'bg-blue-100 text-blue-800')
  metadata?: {
    level_id?: number;
    level_descr?: string;
    sort_order?: number;
    active_flag?: boolean;
    color_code?: string; // Color code from database (e.g., 'blue', 'red')
  };
}

/**
 * Convert color code from database to Tailwind badge classes
 */
function colorCodeToTailwindClass(colorCode: string | null | undefined): string | undefined {
  if (!colorCode) return undefined;

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-800',
    purple: 'bg-purple-100 text-purple-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    orange: 'bg-orange-100 text-orange-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    gray: 'bg-gray-100 text-gray-800',
    cyan: 'bg-cyan-100 text-cyan-800',
    indigo: 'bg-indigo-100 text-indigo-800',
    amber: 'bg-amber-100 text-amber-800',
    rose: 'bg-rose-100 text-rose-800',
    emerald: 'bg-emerald-100 text-emerald-800',
  };

  return colorMap[colorCode.toLowerCase()] || 'bg-gray-100 text-gray-800';
}

// In-memory cache for settings to avoid repeated API calls
const settingsCache: Map<string, { data: SettingOption[]; timestamp: number }> = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Mapping of field names to their corresponding setting datalabels
 * This defines which fields should load from which settings tables
 */
export const FIELD_TO_SETTING_MAP: Record<string, string> = {
  // Project fields
  'project_stage': 'project_stage',
  'project_status': 'project_status',

  // Task fields
  'stage': 'task_stage',
  'task_stage': 'task_stage',
  'status': 'task_stage',
  'priority_level': 'task_priority',

  // Client fields
  'opportunity_funnel_stage_name': 'opportunity_funnel_stage',
  'industry_sector_name': 'industry_sector',
  'acquisition_channel_name': 'acquisition_channel',
  'customer_tier_name': 'customer_tier',
  'client_status': 'client_status',

  // Business fields
  'level_id': 'business_level', // Context-dependent
  'name': 'business_level',
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
 * Mapping of setting datalabels to their API endpoints
 */
export const SETTING_DATALABEL_TO_ENDPOINT: Record<string, string> = {
  'project_stage': '/api/v1/setting?datalabel=project_stage',
  'project_status': '/api/v1/setting?datalabel=project_status',
  'task_stage': '/api/v1/setting?datalabel=task_stage',
  'task_priority': '/api/v1/setting?datalabel=task_priority',
  'opportunity_funnel_stage': '/api/v1/setting?datalabel=opportunity_funnel_stage',
  'industry_sector': '/api/v1/setting?datalabel=industry_sector',
  'acquisition_channel': '/api/v1/setting?datalabel=acquisition_channel',
  'customer_tier': '/api/v1/setting?datalabel=customer_tier',
  'client_status': '/api/v1/setting?datalabel=client_status',
  'business_level': '/api/v1/setting?datalabel=business_level',
  'office_level': '/api/v1/setting?datalabel=office_level',
  'position_level': '/api/v1/setting?datalabel=position_level',
  'hr_level': '/api/v1/setting?datalabel=hr_level',
  'client_level': '/api/v1/setting?datalabel=client_level',
  'form_submission_status': '/api/v1/setting?datalabel=form_submission_status',
  'form_approval_status': '/api/v1/setting?datalabel=form_approval_status',
  'wiki_publication_status': '/api/v1/setting?datalabel=wiki_publication_status',
  'task_update_type': '/api/v1/setting?datalabel=task_update_type',
};

/**
 * Check if a field name maps to a settings table
 */
export function isSettingField(fieldKey: string): boolean {
  return fieldKey in FIELD_TO_SETTING_MAP;
}

/**
 * Get the setting datalabel for a given field key
 */
export function getSettingDatalabel(fieldKey: string): string | null {
  return FIELD_TO_SETTING_MAP[fieldKey] || null;
}

/**
 * Get the API endpoint for a setting datalabel
 */
export function getSettingEndpoint(datalabel: string): string | null {
  return SETTING_DATALABEL_TO_ENDPOINT[datalabel] || null;
}

/**
 * Load settings options from the API with caching
 */
export async function loadSettingOptions(
  datalabel: string,
  forceRefresh: boolean = false
): Promise<SettingOption[]> {
  // Check cache first
  if (!forceRefresh) {
    const cached = settingsCache.get(datalabel);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
  }

  // Get API endpoint
  const endpoint = getSettingEndpoint(datalabel);
  if (!endpoint) {
    console.warn(`No endpoint found for setting datalabel: ${datalabel}`);
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
      .map((item: any) => {
        // Support both stage_* and level_* field naming patterns
        const name = item.stage_name || item.level_name || item.name || item.title;
        const id = item.stage_id ?? item.level_id ?? item.id;
        const descr = item.stage_descr || item.level_descr || item.descr;
        const colorCode = item.color_code;

        return {
          // Use name as value for text-based fields, otherwise use id
          value: name || (id !== undefined ? id : item.id),
          label: name || String(item.id),
          colorClass: colorCodeToTailwindClass(colorCode),
          metadata: {
            level_id: id,
            descr: descr,
            sort_order: item.sort_order,
            active_flag: item.active_flag,
            color_code: colorCode,
          }
        };
      })
      .sort((a, b) => {
        // Sort by sort_order if available, otherwise by label
        const orderA = a.metadata?.sort_order ?? 999;
        const orderB = b.metadata?.sort_order ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return String(a.label).localeCompare(String(b.label));
      });

    // Cache the results
    settingsCache.set(datalabel, {
      data: options,
      timestamp: Date.now()
    });

    return options;
  } catch (error) {
    console.error(`Error loading setting options for ${datalabel}:`, error);
    return [];
  }
}

/**
 * Load settings options for a specific field key
 * This is the main function to use in components
 */
export async function loadFieldOptions(fieldKey: string): Promise<SettingOption[]> {
  const datalabel = getSettingDatalabel(fieldKey);
  if (!datalabel) {
    return [];
  }
  return loadSettingOptions(datalabel);
}

/**
 * Preload multiple setting datalabels at once
 * Useful for preloading all settings needed for a form
 */
export async function preloadSettings(datalabels: string[]): Promise<void> {
  await Promise.all(
    datalabels.map(datalabel => loadSettingOptions(datalabel))
  );
}

/**
 * Clear the settings cache (useful after updates)
 */
export function clearSettingsCache(datalabel?: string): void {
  if (datalabel) {
    settingsCache.delete(datalabel);
  } else {
    settingsCache.clear();
  }
}

/**
 * Get all available setting datalabels
 */
export function getAllSettingDatalabels(): string[] {
  return Object.keys(SETTING_DATALABEL_TO_ENDPOINT);
}

/**
 * Batch load settings for multiple fields at once
 * Returns a map of fieldKey -> options
 */
export async function batchLoadFieldOptions(
  fieldKeys: string[]
): Promise<Map<string, SettingOption[]>> {
  const resultMap = new Map<string, SettingOption[]>();

  // Get unique datalabels
  const datalabels = new Set(
    fieldKeys
      .map(key => getSettingDatalabel(key))
      .filter((dl): dl is string => dl !== null)
  );

  // Load all datalabels in parallel
  const datalabelResults = await Promise.all(
    Array.from(datalabels).map(async (datalabel) => ({
      datalabel,
      options: await loadSettingOptions(datalabel)
    }))
  );

  // Build a datalabel -> options map
  const datalabelMap = new Map(
    datalabelResults.map(({ datalabel, options }) => [datalabel, options])
  );

  // Map field keys to their options
  for (const fieldKey of fieldKeys) {
    const datalabel = getSettingDatalabel(fieldKey);
    if (datalabel) {
      resultMap.set(fieldKey, datalabelMap.get(datalabel) || []);
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
