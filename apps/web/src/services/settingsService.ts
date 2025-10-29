/**
 * ============================================================================
 * SETTINGS SERVICE - DRY approach for all datalabel operations
 * ============================================================================
 *
 * Purpose: Centralized service for managing settings/datalabel data
 * Ensures consistent handling of metadata updates across all datalabels
 *
 * Key Principle: Always work with COMPLETE metadata payload
 * - Fetch entire metadata array
 * - Update specific items in the array
 * - Send back the complete metadata + other columns
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export interface SettingItem {
  id: string | number;
  name: string;
  descr?: string;
  parent_id?: number | null;
  color_code: string;
  position?: number;  // Array position (0-based) - determines display order
}

export interface SettingDatalabel {
  datalabel_name: string;
  ui_label: string;
  ui_icon: string | null;
  metadata: SettingItem[];
  updated_ts?: string;
}

/**
 * Get auth headers with token
 */
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Fetch complete datalabel row (metadata + ui columns)
 * This gets ALL the data we need to update
 */
export async function fetchDatalabelComplete(datalabel: string): Promise<SettingDatalabel | null> {
  try {
    const headers = getAuthHeaders();

    // First, get the metadata items
    const itemsResponse = await fetch(
      `${API_BASE_URL}/api/v1/setting?datalabel=${datalabel}`,
      { headers }
    );

    if (!itemsResponse.ok) {
      throw new Error(`Failed to fetch settings: ${itemsResponse.statusText}`);
    }

    const itemsResult = await itemsResponse.json();

    // Then, get the category info (ui_label, ui_icon, etc.)
    const categoriesResponse = await fetch(
      `${API_BASE_URL}/api/v1/setting/categories`,
      { headers }
    );

    if (!categoriesResponse.ok) {
      throw new Error(`Failed to fetch categories: ${categoriesResponse.statusText}`);
    }

    const categoriesResult = await categoriesResponse.json();

    // Find matching category
    const datalabelName = datalabel.replace(/_/, '__');
    const category = categoriesResult.data.find(
      (cat: any) => cat.datalabel_name === datalabelName
    );

    if (!category) {
      throw new Error(`Category not found for datalabel: ${datalabel}`);
    }

    return {
      datalabel_name: category.datalabel_name,
      ui_label: category.ui_label,
      ui_icon: category.ui_icon,
      metadata: itemsResult.data,
    };
  } catch (error) {
    console.error('Error fetching complete datalabel:', error);
    return null;
  }
}

/**
 * Update a single item in the metadata array
 * Returns the updated complete datalabel
 */
export async function updateSettingItem(
  datalabel: string,
  itemId: string | number,
  updates: Partial<SettingItem>
): Promise<SettingDatalabel | null> {
  try {
    const headers = getAuthHeaders();

    // Use the existing PUT endpoint which handles the recomposition internally
    const response = await fetch(
      `${API_BASE_URL}/api/v1/setting/${datalabel}/${itemId}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update setting: ${response.statusText}`);
    }

    // Fetch the complete updated datalabel
    return await fetchDatalabelComplete(datalabel);
  } catch (error) {
    console.error('Error updating setting item:', error);
    throw error;
  }
}

/**
 * Update multiple fields of a single item at once
 * This is more efficient than calling updateSettingItem multiple times
 */
export async function updateSettingItemMultiple(
  datalabel: string,
  itemId: string | number,
  updates: Partial<SettingItem>
): Promise<SettingDatalabel | null> {
  try {
    const headers = getAuthHeaders();

    // Build the updates object with all changed fields
    const updatePayload: any = {};
    if (updates.name !== undefined) updatePayload.name = updates.name;
    if (updates.descr !== undefined) updatePayload.descr = updates.descr;
    if (updates.parent_id !== undefined) updatePayload.parent_id = updates.parent_id;
    if (updates.color_code !== undefined) updatePayload.color_code = updates.color_code;

    // Send all updates in one request
    const response = await fetch(
      `${API_BASE_URL}/api/v1/setting/${datalabel}/${itemId}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(updatePayload),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update setting: ${response.statusText}`);
    }

    // Fetch the complete updated datalabel
    return await fetchDatalabelComplete(datalabel);
  } catch (error) {
    console.error('Error updating setting item:', error);
    throw error;
  }
}

/**
 * Fetch just the metadata items (for display)
 */
export async function fetchSettingItems(datalabel: string): Promise<SettingItem[]> {
  try {
    const headers = getAuthHeaders();

    const response = await fetch(
      `${API_BASE_URL}/api/v1/setting?datalabel=${datalabel}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch settings: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Error fetching setting items:', error);
    return [];
  }
}

/**
 * Get all available datalabel categories
 */
export async function fetchAllCategories() {
  try {
    const headers = getAuthHeaders();

    const response = await fetch(
      `${API_BASE_URL}/api/v1/setting/categories`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch categories: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
}

/**
 * Create a new setting item in metadata array
 */
export async function createSettingItem(
  datalabel: string,
  newItem: Omit<SettingItem, 'id' | 'position'>
): Promise<SettingItem | null> {
  try {
    const headers = getAuthHeaders();

    const response = await fetch(
      `${API_BASE_URL}/api/v1/setting/${datalabel}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(newItem),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create setting: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error creating setting item:', error);
    throw error;
  }
}

/**
 * Delete a setting item from metadata array
 */
export async function deleteSettingItem(
  datalabel: string,
  itemId: string | number
): Promise<boolean> {
  try {
    const headers = getAuthHeaders();

    const response = await fetch(
      `${API_BASE_URL}/api/v1/setting/${datalabel}/${itemId}`,
      {
        method: 'DELETE',
        headers,
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete setting: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Error deleting setting item:', error);
    throw error;
  }
}

/**
 * Reorder settings items
 * Accepts array of items in the new desired order
 */
export async function reorderSettingItems(
  datalabel: string,
  reorderedItems: SettingItem[]
): Promise<boolean> {
  try {
    const headers = getAuthHeaders();

    // Build order array with positions
    const order = reorderedItems.map((item, index) => ({
      id: item.id,
      position: index,
    }));

    const response = await fetch(
      `${API_BASE_URL}/api/v1/setting/${datalabel}/reorder`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({ order }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to reorder settings: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Error reordering setting items:', error);
    throw error;
  }
}
