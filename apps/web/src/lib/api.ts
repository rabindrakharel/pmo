import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add authentication headers
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token && token !== 'no-auth-needed') {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  employee: {
    id: string;
    name: string;
    email: string;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export const authApi = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post('/api/v1/auth/login', credentials);
    return response.data;
  },

  async logout(): Promise<void> {
    await apiClient.post('/api/v1/auth/logout');
  },

  async getProfile(): Promise<User> {
    const response = await apiClient.get('/api/v1/auth/me');
    return response.data;
  },

  async getPermissions(): Promise<any> {
    const response = await apiClient.get('/api/v1/auth/permissions');
    return response.data;
  },
};

export const projectApi = {
  async list(params?: { page?: number; pageSize?: number; search?: string; status?: string; priority?: string }) {
    const response = await apiClient.get('/api/v1/project', { params });
    return response.data;
  },
  
  async get(id: string) {
    const response = await apiClient.get(`/api/v1/project/${id}`);
    return response.data;
  },
  
  async getTasks(id: string, params?: { page?: number; pageSize?: number }) {
    const page = params?.page ?? 1;
    const limit = params?.pageSize ?? 100;
    const response = await apiClient.get(`/api/v1/project/${id}/task`, { params: { page, limit } });
    return response.data;
  },

  async getWikis(id: string, params?: { page?: number; pageSize?: number }) {
    const page = params?.page ?? 1;
    const limit = params?.pageSize ?? 100;
    const response = await apiClient.get(`/api/v1/project/${id}/wiki`, { params: { page, limit } });
    return response.data;
  },

  async getArtifacts(id: string, params?: { page?: number; pageSize?: number }) {
    const page = params?.page ?? 1;
    const limit = params?.pageSize ?? 100;
    const response = await apiClient.get(`/api/v1/project/${id}/artifact`, { params: { page, limit } });
    return response.data;
  },

  async getForms(id: string, params?: { page?: number; pageSize?: number }) {
    const page = params?.page ?? 1;
    const limit = params?.pageSize ?? 100;
    const response = await apiClient.get(`/api/v1/project/${id}/form`, { params: { page, limit } });
    return response.data;
  },

  async create(data: any) {
    const response = await apiClient.post('/api/v1/project', data);
    return response.data;
  },
  
  async update(id: string, data: any) {
    const response = await apiClient.put(`/api/v1/project/${id}`, data);
    return response.data;
  },
  
  async delete(id: string) {
    const response = await apiClient.delete(`/api/v1/project/${id}`);
    return response.data;
  },
};

export const taskApi = {
  async list(params?: { page?: number; pageSize?: number; search?: string; status?: string; projectId?: string }) {
    const response = await apiClient.get('/api/v1/task', { params });
    return response.data;
  },

  async get(id: string) {
    const response = await apiClient.get(`/api/v1/task/${id}`);
    return response.data;
  },

  async getForms(id: string, params?: { page?: number; pageSize?: number }) {
    const page = params?.page ?? 1;
    const limit = params?.pageSize ?? 100;
    const response = await apiClient.get(`/api/v1/task/${id}/form`, { params: { page, limit } });
    return response.data;
  },

  async getArtifacts(id: string, params?: { page?: number; pageSize?: number }) {
    const page = params?.page ?? 1;
    const limit = params?.pageSize ?? 100;
    const response = await apiClient.get(`/api/v1/task/${id}/artifact`, { params: { page, limit } });
    return response.data;
  },

  async create(data: any) {
    const response = await apiClient.post('/api/v1/task', data);
    return response.data;
  },

  async update(id: string, data: any) {
    const response = await apiClient.put(`/api/v1/task/${id}`, data);
    return response.data;
  },

  async updateRecord(id: string, data: any) {
    const response = await apiClient.put(`/api/v1/task/${id}/record`, data);
    return response.data;
  },

  async delete(id: string) {
    const response = await apiClient.delete(`/api/v1/task/${id}`);
    return response.data;
  },
};

export const metaApi = {
  async get(category: 'task_status' | 'task_stage' | 'project_status' | 'project_stage' | 'biz_level' | 'loc_level' | 'hr_level') {
    const response = await apiClient.get(`/api/v1/meta?category=${category}`);
    return response.data;
  },
};

export const settingApi = {
  async get(category: 'task_status' | 'task_stage' | 'project_status' | 'project_stage' | 'biz_level' | 'org_level' | 'hr_level' | 'client_level' | 'position_level') {
    const response = await apiClient.get(`/api/v1/setting?category=${category}`);
    return response.data;
  },

  async getItem(category: string, id: string) {
    const response = await apiClient.get(`/api/v1/setting/${category}/${id}`);
    return response.data;
  },

  async create(category: string, data: any) {
    const response = await apiClient.post(`/api/v1/setting/${category}`, data);
    return response.data;
  },

  async update(category: string, id: string, data: any) {
    const response = await apiClient.put(`/api/v1/setting/${category}/${id}`, data);
    return response.data;
  },

  async delete(category: string, id: string) {
    const response = await apiClient.delete(`/api/v1/setting/${category}/${id}`);
    return response.data;
  },
};

export const employeeApi = {
  async list(params?: { page?: number; pageSize?: number; search?: string; department?: string; role?: string }) {
    const response = await apiClient.get('/api/v1/employee', { params });
    return response.data;
  },
  
  async get(id: string) {
    const response = await apiClient.get(`/api/v1/employee/${id}`);
    return response.data;
  },
  
  async create(data: any) {
    const response = await apiClient.post('/api/v1/employee', data);
    return response.data;
  },
  
  async update(id: string, data: any) {
    const response = await apiClient.put(`/api/v1/employee/${id}`, data);
    return response.data;
  },
  
  async delete(id: string) {
    const response = await apiClient.delete(`/api/v1/employee/${id}`);
    return response.data;
  },
};

export const clientApi = {
  async list(params?: { page?: number; pageSize?: number; search?: string; type?: string }) {
    const response = await apiClient.get('/api/v1/client', { params });
    return response.data;
  },
  
  async get(id: string) {
    const response = await apiClient.get(`/api/v1/client/${id}`);
    return response.data;
  },
  
  async getHierarchy(id: string) {
    const response = await apiClient.get(`/api/v1/client/${id}/hierarchy`);
    return response.data;
  },
  
  async create(data: any) {
    const response = await apiClient.post('/api/v1/client', data);
    return response.data;
  },
  
  async update(id: string, data: any) {
    const response = await apiClient.put(`/api/v1/client/${id}`, data);
    return response.data;
  },
  
  async delete(id: string) {
    const response = await apiClient.delete(`/api/v1/client/${id}`);
    return response.data;
  },
};

export const bizApi = {
  async list(params?: { page?: number; pageSize?: number; search?: string; level?: string }) {
    // Convert page-based pagination to limit/offset for API
    const limit = params?.pageSize ?? 20;
    const offset = ((params?.page ?? 1) - 1) * limit;
    const query: any = { limit, offset };
    if (params?.search) query.search = params.search;
    if (params?.level) query.level = params.level;

    const response = await apiClient.get('/api/v1/biz', { params: query });
    return response.data;
  },

  async get(id: string) {
    const response = await apiClient.get(`/api/v1/biz/${id}`);
    return response.data;
  },

  async getProjects(id: string, params?: { page?: number; pageSize?: number }) {
    const page = params?.page ?? 1;
    const limit = params?.pageSize ?? 100;
    const response = await apiClient.get(`/api/v1/biz/${id}/project`, { params: { page, limit } });
    return response.data;
  },

  async getTasks(id: string, params?: { page?: number; pageSize?: number }) {
    const page = params?.page ?? 1;
    const limit = params?.pageSize ?? 100;
    const response = await apiClient.get(`/api/v1/biz/${id}/task`, { params: { page, limit } });
    return response.data;
  },

  async getWikis(id: string, params?: { page?: number; pageSize?: number }) {
    const page = params?.page ?? 1;
    const limit = params?.pageSize ?? 100;
    const response = await apiClient.get(`/api/v1/biz/${id}/wiki`, { params: { page, limit } });
    return response.data;
  },

  async getArtifacts(id: string, params?: { page?: number; pageSize?: number }) {
    const page = params?.page ?? 1;
    const limit = params?.pageSize ?? 100;
    const response = await apiClient.get(`/api/v1/biz/${id}/artifact`, { params: { page, limit } });
    return response.data;
  },

  async getForms(id: string, params?: { page?: number; pageSize?: number }) {
    const page = params?.page ?? 1;
    const limit = params?.pageSize ?? 100;
    const response = await apiClient.get(`/api/v1/biz/${id}/form`, { params: { page, limit } });
    return response.data;
  },

  async create(data: any) {
    const response = await apiClient.post('/api/v1/biz', data);
    return response.data;
  },

  async update(id: string, data: any) {
    const response = await apiClient.put(`/api/v1/biz/${id}`, data);
    return response.data;
  },

  async delete(id: string) {
    const response = await apiClient.delete(`/api/v1/biz/${id}`);
    return response.data;
  },
};

// Keep backward compatibility alias
export const businessApi = bizApi;

export const officeApi = {
  async list(params?: { page?: number; pageSize?: number; search?: string; level?: string }) {
    const response = await apiClient.get('/api/v1/office', { params });
    return response.data;
  },

  async get(id: string) {
    const response = await apiClient.get(`/api/v1/office/${id}`);
    return response.data;
  },

  async getWorksites(id: string, params?: { page?: number; pageSize?: number }) {
    const page = params?.page ?? 1;
    const limit = params?.pageSize ?? 100;
    const response = await apiClient.get(`/api/v1/office/${id}/worksite`, { params: { page, limit } });
    return response.data;
  },

  async getEmployees(id: string, params?: { page?: number; pageSize?: number }) {
    const page = params?.page ?? 1;
    const limit = params?.pageSize ?? 100;
    const response = await apiClient.get(`/api/v1/office/${id}/employee`, { params: { page, limit } });
    return response.data;
  },

  async getWikis(id: string, params?: { page?: number; pageSize?: number }) {
    const page = params?.page ?? 1;
    const limit = params?.pageSize ?? 100;
    const response = await apiClient.get(`/api/v1/office/${id}/wiki`, { params: { page, limit } });
    return response.data;
  },

  async getTasks(id: string, params?: { page?: number; pageSize?: number }) {
    const page = params?.page ?? 1;
    const limit = params?.pageSize ?? 100;
    const response = await apiClient.get(`/api/v1/office/${id}/task`, { params: { page, limit } });
    return response.data;
  },

  async getArtifacts(id: string, params?: { page?: number; pageSize?: number }) {
    const page = params?.page ?? 1;
    const limit = params?.pageSize ?? 100;
    const response = await apiClient.get(`/api/v1/office/${id}/artifact`, { params: { page, limit } });
    return response.data;
  },

  async getForms(id: string, params?: { page?: number; pageSize?: number }) {
    const page = params?.page ?? 1;
    const limit = params?.pageSize ?? 100;
    const response = await apiClient.get(`/api/v1/office/${id}/form`, { params: { page, limit } });
    return response.data;
  },

  async create(data: any) {
    const response = await apiClient.post('/api/v1/office', data);
    return response.data;
  },

  async update(id: string, data: any) {
    const response = await apiClient.put(`/api/v1/office/${id}`, data);
    return response.data;
  },

  async delete(id: string) {
    const response = await apiClient.delete(`/api/v1/office/${id}`);
    return response.data;
  },
};

// Keep backward compatibility alias
export const orgApi = officeApi;

export const worksiteApi = {
  async list(params?: { page?: number; pageSize?: number; search?: string; location?: string }) {
    const response = await apiClient.get('/api/v1/worksite', { params });
    return response.data;
  },

  async get(id: string) {
    const response = await apiClient.get(`/api/v1/worksite/${id}`);
    return response.data;
  },

  async getTasks(id: string, params?: { page?: number; pageSize?: number }) {
    const page = params?.page ?? 1;
    const limit = params?.pageSize ?? 100;
    const response = await apiClient.get(`/api/v1/worksite/${id}/task`, { params: { page, limit } });
    return response.data;
  },

  async getForms(id: string, params?: { page?: number; pageSize?: number }) {
    const page = params?.page ?? 1;
    const limit = params?.pageSize ?? 100;
    const response = await apiClient.get(`/api/v1/worksite/${id}/form`, { params: { page, limit } });
    return response.data;
  },

  async create(data: any) {
    const response = await apiClient.post('/api/v1/worksite', data);
    return response.data;
  },

  async update(id: string, data: any) {
    const response = await apiClient.put(`/api/v1/worksite/${id}`, data);
    return response.data;
  },

  async delete(id: string) {
    const response = await apiClient.delete(`/api/v1/worksite/${id}`);
    return response.data;
  },
};

export const roleApi = {
  async list(params?: { page?: number; pageSize?: number; search?: string; roleType?: string; roleCategory?: string }) {
    const response = await apiClient.get('/api/v1/role', { params });
    return response.data;
  },
  
  async get(id: string) {
    const response = await apiClient.get(`/api/v1/role/${id}`);
    return response.data;
  },
  
  async create(data: any) {
    const response = await apiClient.post('/api/v1/role', data);
    return response.data;
  },
  
  async update(id: string, data: any) {
    const response = await apiClient.put(`/api/v1/role/${id}`, data);
    return response.data;
  },
  
  async delete(id: string) {
    const response = await apiClient.delete(`/api/v1/role/${id}`);
    return response.data;
  },
};

export const formApi = {
  async list(params?: { page?: number; pageSize?: number; search?: string; version?: number }) {
    // Map UI pagination to API limit/offset
    const limit = params?.pageSize ?? 20;
    const offset = ((params?.page ?? 1) - 1) * limit;
    const query: any = { limit, offset };
    if (params?.version != null) query.version = params.version;
    const response = await apiClient.get('/api/v1/form', { params: query });
    return response.data;
  },
  
  async get(id: string) {
    const response = await apiClient.get(`/api/v1/form/${id}`);
    return response.data;
  },

  async getRecords(id: string, params?: { page?: number; pageSize?: number }) {
    const limit = params?.pageSize ?? 20;
    const offset = ((params?.page ?? 1) - 1) * limit;
    const response = await apiClient.get(`/api/v1/form/${id}/records`, { params: { limit, offset } });
    return response.data;
  },
  
  async create(data: any) {
    const response = await apiClient.post('/api/v1/form', data);
    return response.data;
  },
  
  async update(id: string, data: any) {
    const response = await apiClient.put(`/api/v1/form/${id}`, data);
    return response.data;
  },
  
  async delete(id: string) {
    const response = await apiClient.delete(`/api/v1/form/${id}`);
    return response.data;
  },
};

// Wiki API
export const wikiApi = {
  async list(params?: { page?: number; pageSize?: number; search?: string; tag?: string }) {
    const limit = params?.pageSize ?? 20;
    const offset = ((params?.page ?? 1) - 1) * limit;
    const query: any = { limit, offset };
    if (params?.search) query.search = params.search;
    if (params?.tag) query.tag = params.tag;
    const response = await apiClient.get('/api/v1/wiki', { params: query });
    return response.data;
  },

  async get(id: string) {
    const response = await apiClient.get(`/api/v1/wiki/${id}`);
    return response.data;
  },

  async create(data: any) {
    const response = await apiClient.post('/api/v1/wiki', data);
    return response.data;
  },

  async update(id: string, data: any) {
    const response = await apiClient.put(`/api/v1/wiki/${id}`, data);
    return response.data;
  },

  async delete(id: string) {
    const response = await apiClient.delete(`/api/v1/wiki/${id}`);
    return response.data;
  },
};

// Artifacts API
export const artifactApi = {
  async list(params?: { page?: number; pageSize?: number; search?: string; artifact_type?: string; business_id?: string; project_id?: string; project_stage?: string }) {
    const limit = params?.pageSize ?? 20;
    const offset = ((params?.page ?? 1) - 1) * limit;
    const query: any = { limit, offset };
    if (params?.search) query.search = params.search;
    if (params?.artifact_type) query.artifact_type = params.artifact_type;
    if (params?.business_id) query.business_id = params.business_id;
    if (params?.project_id) query.project_id = params.project_id;
    if (params?.project_stage) query.project_stage = params.project_stage;
    const response = await apiClient.get('/api/v1/artifact', { params: query });
    return response.data;
  },

  async get(id: string) {
    const response = await apiClient.get(`/api/v1/artifact/${id}`);
    return response.data;
  },

  async create(data: any) {
    const response = await apiClient.post('/api/v1/artifact', data);
    return response.data;
  },

  async update(id: string, data: any) {
    const response = await apiClient.put(`/api/v1/artifact/${id}`, data);
    return response.data;
  },

  async delete(id: string) {
    const response = await apiClient.delete(`/api/v1/artifact/${id}`);
    return response.data;
  },
};

export const positionApi = {
  async list(params?: { page?: number; pageSize?: number; search?: string }) {
    const response = await apiClient.get('/api/v1/position', { params });
    return response.data;
  },

  async get(id: string) {
    const response = await apiClient.get(`/api/v1/position/${id}`);
    return response.data;
  },

  async create(data: any) {
    const response = await apiClient.post('/api/v1/position', data);
    return response.data;
  },

  async update(id: string, data: any) {
    const response = await apiClient.put(`/api/v1/position/${id}`, data);
    return response.data;
  },

  async delete(id: string) {
    const response = await apiClient.delete(`/api/v1/position/${id}`);
    return response.data;
  },
};
