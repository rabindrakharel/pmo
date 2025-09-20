// Simple entity service that directly uses universal entity API
// Replaces the complex config system with straightforward entity operations

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// Entity type definitions - matches the database meta_entity_types
export const ENTITY_TYPES = {
  // Organizational entities (4)
  hr: { displayName: 'HR Department', category: 'organizational', icon: 'users' },
  biz: { displayName: 'Business Unit', category: 'organizational', icon: 'building' },
  org: { displayName: 'Organization', category: 'organizational', icon: 'globe' },
  client: { displayName: 'Client', category: 'organizational', icon: 'handshake' },

  // Operational entities (3)
  project: { displayName: 'Project', category: 'operational', icon: 'folder' },
  task: { displayName: 'Task', category: 'operational', icon: 'check-square' },
  worksite: { displayName: 'Worksite', category: 'operational', icon: 'map-pin' },

  // Personnel entities (2)
  employee: { displayName: 'Employee', category: 'personnel', icon: 'user' },
  role: { displayName: 'Role', category: 'personnel', icon: 'shield' },

  // Content entities (3)
  wiki: { displayName: 'Wiki', category: 'content', icon: 'book' },
  form: { displayName: 'Form', category: 'content', icon: 'clipboard' },
  artifact: { displayName: 'Artifact', category: 'content', icon: 'file' },
} as const;

export type EntityType = keyof typeof ENTITY_TYPES;

// Standard column definitions for all entities
export const STANDARD_COLUMNS = [
  { key: 'id', title: 'ID', width: 280, sortable: true },
  { key: 'name', title: 'Name', sortable: true, filterable: true },
  { key: 'descr', title: 'Description', filterable: true },
  { key: 'active', title: 'Status', width: 100, render: (value: boolean) =>
    value ? 'Active' : 'Inactive'
  },
  { key: 'created', title: 'Created', width: 120, sortable: true },
] as const;

class EntityService {
  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    return fetch(url, { ...options, headers });
  }

  // List entities of a specific type
  async listEntities(entityType: EntityType, params: {
    active?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}) {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.set(key, value.toString());
      }
    });

    const url = `${API_BASE_URL}/api/v1/entity/${entityType}?${searchParams}`;
    const response = await this.fetchWithAuth(url);
    
    if (!response.ok) {
      throw new Error(`Failed to list ${entityType} entities: ${response.statusText}`);
    }

    return response.json();
  }

  // Get single entity by ID
  async getEntity(entityType: EntityType, id: string) {
    const url = `${API_BASE_URL}/api/v1/entity/${entityType}/${id}`;
    const response = await this.fetchWithAuth(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`${entityType} entity not found`);
      }
      throw new Error(`Failed to get ${entityType} entity: ${response.statusText}`);
    }

    return response.json();
  }

  // Create new entity
  async createEntity(entityType: EntityType, data: {
    name: string;
    descr?: string;
    tags?: string[];
    attr?: Record<string, any>;
    active?: boolean;
    [key: string]: any; // Allow additional entity-specific fields
  }) {
    const url = `${API_BASE_URL}/api/v1/entity/${entityType}`;
    const response = await this.fetchWithAuth(url, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create ${entityType} entity: ${response.statusText}`);
    }

    return response.json();
  }

  // Update entity
  async updateEntity(entityType: EntityType, id: string, data: Partial<{
    name: string;
    descr?: string;
    tags?: string[];
    attr?: Record<string, any>;
    active?: boolean;
    [key: string]: any;
  }>) {
    const url = `${API_BASE_URL}/api/v1/entity/${entityType}/${id}`;
    const response = await this.fetchWithAuth(url, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`${entityType} entity not found`);
      }
      throw new Error(`Failed to update ${entityType} entity: ${response.statusText}`);
    }

    return response.json();
  }

  // Delete entity (soft delete)
  async deleteEntity(entityType: EntityType, id: string) {
    const url = `${API_BASE_URL}/api/v1/entity/${entityType}/${id}`;
    const response = await this.fetchWithAuth(url, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`${entityType} entity not found`);
      }
      throw new Error(`Failed to delete ${entityType} entity: ${response.statusText}`);
    }

    return; // DELETE returns 204 No Content
  }

  // Get entity type metadata
  getEntityMetadata(entityType: EntityType) {
    return ENTITY_TYPES[entityType];
  }

  // Get all available entity types
  getAllEntityTypes() {
    return Object.entries(ENTITY_TYPES).map(([key, meta]) => ({
      entityType: key as EntityType,
      ...meta,
    }));
  }
}

export const entityService = new EntityService();