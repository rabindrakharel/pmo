/**
 * API Client for PMO Platform
 * Interfaces with the backend API at http://localhost:4000
 */

// Base API configuration
const API_BASE_URL = '/api';

// Permission enum matching backend
export enum Permission {
  VIEW = 0,
  MODIFY = 1,
  SHARE = 2,
  DELETE = 3,
  CREATE = 4,
}

// Type definitions matching backend schemas
export interface User {
  id: string;
  sub: string; // JWT subject
  email: string;
  name: string;
  roles?: string[];
}

export interface Employee {
  id: string;
  name?: string;
  descr?: string;
  addr?: string;
  tags?: string[];
  active: boolean;
  fromTs: string;
  toTs?: string;
  created: string;
  updated: string;
}

export interface Client {
  id: string;
  name: string;
  descr?: string;
  contact?: {
    email?: string;
    phone?: string;
    website?: string;
  };
  tags?: string[];
  created: string;
  updated: string;
}

export interface Project {
  id: string;
  name: string;
  slug?: string;
  locationSpecific: boolean;
  locationId?: string;
  businessSpecific: boolean;
  bizId?: string;
  worksiteSpecific: boolean;
  worksiteId?: string;
  active: boolean;
  created: string;
  updated: string;
  status?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  projHeadId: string;
  assigneeId?: string;
  assignee?: string;
  reviewers?: string[];
  approvers?: string[];
  collaborators?: string[];
  parentHeadId?: string;
  clientGroupId?: string;
  clients?: string[];
  worksiteId?: string;
  tags?: string[];
  dueDate?: string;
  stageCode?: string;
  statusId?: string;
  created: string;
  updated: string;
}

export interface HRScope {
  id: string;
  name: string;
  descr?: string;
  levelId: number;
  parentId?: string;
  active: boolean;
  fromTs: string;
  toTs?: string;
  created: string;
  updated: string;
}

export interface Worksite {
  id: string;
  name: string;
  descr?: string;
  locId?: string;
  bizId?: string;
  fromTs: string;
  toTs?: string;
  active: boolean;
  tags?: string[];
  created: string;
  updated: string;
}

export interface Role {
  id: string;
  name: string;
  descr?: string;
  active: boolean;
  created: string;
  updated: string;
}

// API response types
export interface ApiResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiSingleResponse<T> {
  data?: T;
}

// API query parameters
export interface QueryParams {
  limit?: number;
  offset?: number;
  active?: boolean;
  search?: string;
  [key: string]: any;
}

// HTTP client class
class HttpClient {
  private getAuthToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getAuthToken();
    
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const config: RequestInit = {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorObj = new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
        (errorObj as any).status = response.status;
        (errorObj as any).statusText = response.statusText;
        throw errorObj;
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  async get<T>(endpoint: string, params?: QueryParams): Promise<T> {
    const url = params ? `${endpoint}?${new URLSearchParams(params as any).toString()}` : endpoint;
    return this.request<T>(url);
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }
}

// API client instance
const client = new HttpClient();

// API methods organized by resource
export const api = {
  // Health check
  async health() {
    return client.get<{ status: string; timestamp: string }>('/health');
  },

  // Employee management
  async getEmployees(params?: QueryParams): Promise<ApiResponse<Employee>> {
    return client.get('/v1/emp', params);
  },

  async getEmployee(id: string): Promise<ApiSingleResponse<Employee>> {
    return client.get(`/v1/emp/${id}`);
  },

  async createEmployee(data: Partial<Employee>): Promise<ApiSingleResponse<Employee>> {
    return client.post('/v1/emp', data);
  },

  async updateEmployee(id: string, data: Partial<Employee>): Promise<ApiSingleResponse<Employee>> {
    return client.put(`/v1/emp/${id}`, data);
  },

  async deleteEmployee(id: string): Promise<void> {
    return client.delete(`/v1/emp/${id}`);
  },

  // Client management
  async getClients(params?: QueryParams): Promise<ApiResponse<Client>> {
    return client.get('/v1/client', params);
  },

  async getClient(id: string): Promise<ApiSingleResponse<Client>> {
    return client.get(`/v1/client/${id}`);
  },

  async createClient(data: Partial<Client>): Promise<ApiSingleResponse<Client>> {
    return client.post('/v1/client', data);
  },

  async updateClient(id: string, data: Partial<Client>): Promise<ApiSingleResponse<Client>> {
    return client.put(`/v1/client/${id}`, data);
  },

  async deleteClient(id: string): Promise<void> {
    return client.delete(`/v1/client/${id}`);
  },

  // Project management
  async getProjects(params?: QueryParams): Promise<ApiResponse<Project>> {
    return client.get('/v1/project', params);
  },

  async getProject(id: string): Promise<ApiSingleResponse<Project>> {
    return client.get(`/v1/project/${id}`);
  },

  async createProject(data: Partial<Project>): Promise<ApiSingleResponse<Project>> {
    return client.post('/v1/project', data);
  },

  async updateProject(id: string, data: Partial<Project>): Promise<ApiSingleResponse<Project>> {
    return client.put(`/v1/project/${id}`, data);
  },

  async deleteProject(id: string): Promise<void> {
    return client.delete(`/v1/project/${id}`);
  },

  // Task management
  async getTasks(params?: QueryParams): Promise<ApiResponse<Task>> {
    return client.get('/v1/task', params);
  },

  async getTask(id: string): Promise<ApiSingleResponse<Task>> {
    return client.get(`/v1/task/${id}`);
  },

  async createTask(data: Partial<Task>): Promise<ApiSingleResponse<Task>> {
    return client.post('/v1/task', data);
  },

  async updateTask(id: string, data: Partial<Task>): Promise<ApiSingleResponse<Task>> {
    return client.put(`/v1/task/${id}`, data);
  },

  async deleteTask(id: string): Promise<void> {
    return client.delete(`/v1/task/${id}`);
  },

  // HR Scope management
  async getHRScopes(params?: QueryParams): Promise<ApiResponse<HRScope>> {
    return client.get('/v1/scope/hr', params);
  },

  async getHRScope(id: string): Promise<ApiSingleResponse<HRScope>> {
    return client.get(`/v1/scope/hr/${id}`);
  },

  async createHRScope(data: Partial<HRScope>): Promise<ApiSingleResponse<HRScope>> {
    return client.post('/v1/scope/hr', data);
  },

  async updateHRScope(id: string, data: Partial<HRScope>): Promise<ApiSingleResponse<HRScope>> {
    return client.put(`/v1/scope/hr/${id}`, data);
  },

  async deleteHRScope(id: string): Promise<void> {
    return client.delete(`/v1/scope/hr/${id}`);
  },

  // Worksite management
  async getWorksites(params?: QueryParams): Promise<ApiResponse<Worksite>> {
    return client.get('/v1/worksite', params);
  },

  async getWorksite(id: string): Promise<ApiSingleResponse<Worksite>> {
    return client.get(`/v1/worksite/${id}`);
  },

  async createWorksite(data: Partial<Worksite>): Promise<ApiSingleResponse<Worksite>> {
    return client.post('/v1/worksite', data);
  },

  async updateWorksite(id: string, data: Partial<Worksite>): Promise<ApiSingleResponse<Worksite>> {
    return client.put(`/v1/worksite/${id}`, data);
  },

  async deleteWorksite(id: string): Promise<void> {
    return client.delete(`/v1/worksite/${id}`);
  },

  // Role management
  async getRoles(params?: QueryParams): Promise<ApiResponse<Role>> {
    return client.get('/v1/role', params);
  },

  async getRole(id: string): Promise<ApiSingleResponse<Role>> {
    return client.get(`/v1/role/${id}`);
  },

  async createRole(data: Partial<Role>): Promise<ApiSingleResponse<Role>> {
    return client.post('/v1/role', data);
  },

  async updateRole(id: string, data: Partial<Role>): Promise<ApiSingleResponse<Role>> {
    return client.put(`/v1/role/${id}`, data);
  },

  async deleteRole(id: string): Promise<void> {
    return client.delete(`/v1/role/${id}`);
  },

  // Authentication (for real login, not dev mode)
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    return client.post('/v1/auth/login', { email, password });
  },

  async getCurrentUser(): Promise<User> {
    return client.get('/v1/auth/me');
  },

  // Permission checking
  async getUserPermissions(userId: string, resource: string, scopeId?: string) {
    return client.get(`/v1/permissions/${userId}`, { resource, scopeId });
  },

  // Meta data (task stages, statuses, etc.)
  async getMeta(category?: string): Promise<ApiResponse<any>> {
    return client.get('/v1/meta', category ? { category } : {});
  },

  async getTaskStages(): Promise<ApiResponse<any>> {
    return client.get('/v1/meta', { category: 'task_stage' });
  },

  async getTaskStatuses(): Promise<ApiResponse<any>> {
    return client.get('/v1/meta', { category: 'task_status' });
  },

  // Task Activity & Comments
  async getTaskActivity(taskId: string, params?: { type?: string; limit?: number; offset?: number }): Promise<ApiResponse<any>> {
    return client.get(`/v1/task/${taskId}/activity`, params);
  },

  async addTaskComment(taskId: string, content: string): Promise<any> {
    return client.post(`/v1/task/${taskId}/comment`, { content });
  },

  async logTaskWork(taskId: string, worklog: {
    timeSpent: number; // minutes
    timeRemaining?: number;
    description?: string;
    startedAt?: string;
  }): Promise<any> {
    return client.post(`/v1/task/${taskId}/worklog`, worklog);
  },

  async getTaskWorkSummary(taskId: string): Promise<{
    totalSpent: number;
    totalRemaining?: number;
    originalEstimate?: number;
    workLogs: Array<{
      id: string;
      authorName: string;
      timeSpent: number;
      description?: string;
      timestamp: string;
    }>;
  }> {
    return client.get(`/v1/task/${taskId}/work-summary`);
  },

  // Meta Data Management
  async getMetaData(category?: string, active?: boolean): Promise<ApiResponse<any>> {
    const params: any = {};
    if (category) params.category = category;
    if (active !== undefined) params.active = active;
    return client.get('/v1/meta', params);
  },

  async getMetaItem(category: string, id: string): Promise<any> {
    return client.get(`/v1/meta/${category}/${id}`);
  },

  async createMetaItem(category: string, data: any): Promise<any> {
    return client.post(`/v1/meta/${category}`, data);
  },

  async updateMetaItem(category: string, id: string, data: any): Promise<any> {
    return client.put(`/v1/meta/${category}/${id}`, data);
  },

  async deleteMetaItem(category: string, id: string): Promise<void> {
    return client.delete(`/v1/meta/${category}/${id}`);
  },
};

export default api;
