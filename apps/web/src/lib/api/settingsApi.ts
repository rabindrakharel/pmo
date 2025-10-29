/**
 * ============================================================================
 * SETTINGS API CLIENT - DRY & SOLID Refactored
 * ============================================================================
 *
 * SOLID Principles:
 * - Single Responsibility: Each method does one thing
 * - Interface Segregation: Clean, minimal interface
 * - Dependency Inversion: Abstract API client
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// ============================================================================
// TYPES
// ============================================================================

export interface SettingItem {
  id: string;
  name: string;
  descr: string;
  parent_id: number | null;
  color_code: string;
}

export interface SettingUpdateData {
  name?: string;
  descr?: string;
  parent_id?: number | null;
  color_code?: string;
}

export interface SettingResponse {
  data: SettingItem[];
  datalabel: string;
}

export interface SettingUpdateResponse {
  success: boolean;
  data: SettingItem;
}

// ============================================================================
// HTTP CLIENT - Reusable Request Handler
// ============================================================================

class HttpClient {
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const token = localStorage.getItem('auth_token');
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  async request<T>(
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: any
  ): Promise<T> {
    const options: RequestInit = {
      method,
      headers: this.getHeaders(),
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${url}`, options);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  get<T>(url: string): Promise<T> {
    return this.request<T>(url, 'GET');
  }

  post<T>(url: string, body: any): Promise<T> {
    return this.request<T>(url, 'POST', body);
  }

  put<T>(url: string, body: any): Promise<T> {
    return this.request<T>(url, 'PUT', body);
  }

  delete<T>(url: string): Promise<T> {
    return this.request<T>(url, 'DELETE');
  }
}

const httpClient = new HttpClient();

// ============================================================================
// SETTINGS API - Clean Interface
// ============================================================================

export class SettingsApi {
  /**
   * Get all items for a datalabel
   */
  async list(datalabel: string): Promise<SettingItem[]> {
    const response = await httpClient.get<SettingResponse>(
      `/api/v1/setting?datalabel=${datalabel}`
    );
    return response.data;
  }

  /**
   * Get a single item
   */
  async get(datalabel: string, id: string): Promise<SettingItem> {
    const response = await httpClient.get<{ data: SettingItem }>(
      `/api/v1/setting/${datalabel}/${id}`
    );
    return response.data;
  }

  /**
   * Update an item
   */
  async update(
    datalabel: string,
    id: string,
    data: SettingUpdateData
  ): Promise<SettingItem> {
    const response = await httpClient.put<SettingUpdateResponse>(
      `/api/v1/setting/${datalabel}/${id}`,
      data
    );
    return response.data;
  }

  /**
   * Get all available datalabels
   */
  async getCategories(): Promise<{ datalabel_name: string; item_count: number }[]> {
    const response = await httpClient.get<{ data: any[] }>(
      '/api/v1/setting/categories'
    );
    return response.data;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const settingsApi = new SettingsApi();

// Default export for convenience
export default settingsApi;
