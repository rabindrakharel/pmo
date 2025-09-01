import type { FrontendEntityConfig, ConfigApiResponse, EntityTypesApiResponse } from '../types/config';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

class ConfigService {
  private cache = new Map<string, { data: FrontendEntityConfig; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private async fetchWithAuth(url: string): Promise<Response> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    return fetch(url, { headers });
  }

  async getEntityConfig(entityType: string): Promise<FrontendEntityConfig> {
    // Check cache first
    const cached = this.cache.get(entityType);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    const response = await this.fetchWithAuth(`${API_BASE_URL}/api/v1/config/entity/${entityType}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Entity type '${entityType}' not found`);
      }
      throw new Error(`Failed to fetch entity configuration: ${response.statusText}`);
    }

    const result: ConfigApiResponse = await response.json();
    
    if (!result.success) {
      throw new Error('API returned unsuccessful response');
    }

    // Cache the result
    this.cache.set(entityType, {
      data: result.data,
      timestamp: Date.now()
    });

    return result.data;
  }

  async getAvailableEntityTypes(): Promise<EntityTypesApiResponse['data']> {
    const response = await this.fetchWithAuth(`${API_BASE_URL}/api/v1/config/entities`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch entity types: ${response.statusText}`);
    }

    const result: EntityTypesApiResponse = await response.json();
    
    if (!result.success) {
      throw new Error('API returned unsuccessful response');
    }

    return result.data;
  }

  clearCache(): void {
    this.cache.clear();
  }

  clearEntityCache(entityType: string): void {
    this.cache.delete(entityType);
  }
}

export const configService = new ConfigService();