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
 * Format: field_name -> datalabel_name (using entity__label format with double underscore)
 */
export const FIELD_TO_SETTING_MAP: Record<string, string> = {
  // Project fields (dl__ prefix columns from database)
  'dl__project_stage': 'project__stage',
  'project_stage': 'project__stage',

  // Task fields (dl__ prefix columns from database)
  'dl__task_stage': 'task__stage',
  'dl__task_priority': 'task__priority',
  'stage': 'task__stage',
  'task_stage': 'task__stage',
  'status': 'task__stage',
  'priority_level': 'task__priority',

  // Client/Customer fields (dl__ prefix columns from database)
  'dl__opportunity_funnel_stage': 'opportunity__funnel_stage',
  'dl__industry_sector': 'industry__sector',
  'dl__acquisition_channel': 'acquisition__channel',
  'dl__customer_tier': 'customer__tier',
  'dl__client_status': 'client__status',
  'opportunity_funnel_stage_name': 'opportunity__funnel_stage',
  'industry_sector_name': 'industry__sector',
  'acquisition_channel_name': 'acquisition__channel',
  'customer_tier_name': 'customer__tier',
  'client_status': 'client__status',

  // Business fields (dl__ prefix columns from database)
  'dl__business_level': 'business__level',
  'level_id': 'business__level', // Context-dependent
  'name': 'business__level',
  'business_level_id': 'business__level',

  // Office fields (dl__ prefix columns from database)
  'dl__office_level': 'office__level',
  'office_level_id': 'office__level',

  // Position fields (dl__ prefix columns from database)
  'dl__position_level': 'position__level',
  'position_level_id': 'position__level',

  // Form fields (dl__ prefix columns from database)
  'dl__form_submission_status': 'form__submission_status',
  'dl__form_approval_status': 'form__approval_status',
  'submission_status': 'form__submission_status',
  'approval_status': 'form__approval_status',

  // Wiki fields (dl__ prefix columns from database)
  'dl__wiki_publication_status': 'wiki__publication_status',
  'publication_status': 'wiki__publication_status',

  // Task activity fields
  'update_type': 'task__update_type',
};

/**
 * Mapping of setting datalabels to their API endpoints
 * Format: datalabel_name -> API endpoint using ?category= parameter
 * All datalabel names use dl__entity__label format (matching database column names)
 */
export const SETTING_DATALABEL_TO_ENDPOINT: Record<string, string> = {
  'project__stage': '/api/v1/setting?category=dl__project__stage',
  'task__stage': '/api/v1/setting?category=dl__task__stage',
  'task__priority': '/api/v1/setting?category=dl__task__priority',
  'task__update_type': '/api/v1/setting?category=dl__task__update_type',
  'opportunity__funnel_stage': '/api/v1/setting?category=dl__opportunity__funnel_stage',
  'industry__sector': '/api/v1/setting?category=dl__industry__sector',
  'acquisition__channel': '/api/v1/setting?category=dl__acquisition__channel',
  'customer__tier': '/api/v1/setting?category=dl__customer__tier',
  'client__status': '/api/v1/setting?category=dl__client__status',
  'client__service': '/api/v1/setting?category=dl__client__service',
  'business__level': '/api/v1/setting?category=dl__business__level',
  'office__level': '/api/v1/setting?category=dl__office__level',
  'position__level': '/api/v1/setting?category=dl__position__level',
  'form__submission_status': '/api/v1/setting?category=dl__form__submission_status',
  'form__approval_status': '/api/v1/setting?category=dl__form__approval_status',
  'wiki__publication_status': '/api/v1/setting?category=dl__wiki__publication_status',
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
            sort_order: item.sort_order ?? item.position,
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
