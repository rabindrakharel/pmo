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

export interface CustomerSignupRequest {
  name: string;
  primary_email: string;
  password: string;
  cust_type?: string;
}

export interface CustomerSignupResponse {
  token: string;
  customer: {
    id: string;
    name: string;
    email: string;
    entities: string[];
  };
}

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  entities: string[];
  cust_type: string;
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

  // Customer authentication endpoints
  async customerSignup(data: CustomerSignupRequest): Promise<CustomerSignupResponse> {
    const response = await apiClient.post('/api/v1/auth/customer/signup', data);
    return response.data;
  },

  async customerSignin(credentials: LoginRequest): Promise<CustomerSignupResponse> {
    const response = await apiClient.post('/api/v1/auth/customer/signin', credentials);
    return response.data;
  },

  async getCustomerProfile(): Promise<CustomerProfile> {
    const response = await apiClient.get('/api/v1/auth/customer/me');
    return response.data;
  },

  async configureCustomerEntities(entities: string[]): Promise<CustomerProfile> {
    const response = await apiClient.put('/api/v1/auth/customer/configure', { entities });
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

export const settingApi = {
  async get(datalabel: 'task_stage' | 'project_status' | 'project_stage' | 'biz_level' | 'org_level' | 'hr_level' | 'client_level' | 'position_level') {
    const response = await apiClient.get(`/api/v1/setting?datalabel=${datalabel}`);
    return response.data;
  },

  async getItem(datalabel: string, id: string) {
    const response = await apiClient.get(`/api/v1/setting/${datalabel}/${id}`);
    return response.data;
  },

  async create(datalabel: string, data: any) {
    const response = await apiClient.post(`/api/v1/setting/${datalabel}`, data);
    return response.data;
  },

  async update(datalabel: string, id: string, data: any) {
    const response = await apiClient.put(`/api/v1/setting/${datalabel}/${id}`, data);
    return response.data;
  },

  async delete(datalabel: string, id: string) {
    const response = await apiClient.delete(`/api/v1/setting/${datalabel}/${id}`);
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

export const custApi = {
  async list(params?: { page?: number; pageSize?: number; search?: string; type?: string }) {
    const response = await apiClient.get('/api/v1/cust', { params });
    return response.data;
  },

  async get(id: string) {
    const response = await apiClient.get(`/api/v1/cust/${id}`);
    return response.data;
  },

  async getHierarchy(id: string) {
    const response = await apiClient.get(`/api/v1/cust/${id}/hierarchy`);
    return response.data;
  },

  async create(data: any) {
    const response = await apiClient.post('/api/v1/cust', data);
    return response.data;
  },

  async update(id: string, data: any) {
    const response = await apiClient.put(`/api/v1/cust/${id}`, data);
    return response.data;
  },

  async delete(id: string) {
    const response = await apiClient.delete(`/api/v1/cust/${id}`);
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
  async list(params?: { page?: number; pageSize?: number; search?: string; showAllVersions?: boolean }) {
    // Map UI pagination to API limit/offset
    const limit = params?.pageSize ?? 20;
    const offset = ((params?.page ?? 1) - 1) * limit;
    const query: any = { limit, offset };
    if (params?.showAllVersions != null) query.showAllVersions = params.showAllVersions;
    const response = await apiClient.get('/api/v1/form', { params: query });
    return response.data;
  },

  async get(id: string) {
    const response = await apiClient.get(`/api/v1/form/${id}`);
    return response.data;
  },

  async getVersions(slug: string) {
    const response = await apiClient.get(`/api/v1/form/versions/${slug}`);
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

export const marketingApi = {
  async list(params?: { page?: number; pageSize?: number; search?: string; status?: string }) {
    const response = await apiClient.get('/api/v1/email-template', { params });
    return response.data;
  },

  async get(id: string) {
    const response = await apiClient.get(`/api/v1/email-template/${id}`);
    return response.data;
  },

  async create(data: any) {
    const response = await apiClient.post('/api/v1/email-template', data);
    return response.data;
  },

  async update(id: string, data: any) {
    const response = await apiClient.put(`/api/v1/email-template/${id}`, data);
    return response.data;
  },

  async delete(id: string) {
    const response = await apiClient.delete(`/api/v1/email-template/${id}`);
    return response.data;
  },
};

// Product & Operations APIs
export const serviceApi = {
  async list(params?: { page?: number; pageSize?: number; search?: string; service_category?: string }) {
    const response = await apiClient.get('/api/v1/service', { params });
    return response.data;
  },

  async get(id: string) {
    const response = await apiClient.get(`/api/v1/service/${id}`);
    return response.data;
  },

  async create(data: any) {
    const response = await apiClient.post('/api/v1/service', data);
    return response.data;
  },

  async update(id: string, data: any) {
    const response = await apiClient.put(`/api/v1/service/${id}`, data);
    return response.data;
  },

  async delete(id: string) {
    const response = await apiClient.delete(`/api/v1/service/${id}`);
    return response.data;
  },
};

export const productApi = {
  async list(params?: { page?: number; pageSize?: number; search?: string; department?: string }) {
    const response = await apiClient.get('/api/v1/product', { params });
    return response.data;
  },

  async get(id: string) {
    const response = await apiClient.get(`/api/v1/product/${id}`);
    return response.data;
  },

  async create(data: any) {
    const response = await apiClient.post('/api/v1/product', data);
    return response.data;
  },

  async update(id: string, data: any) {
    const response = await apiClient.put(`/api/v1/product/${id}`, data);
    return response.data;
  },

  async delete(id: string) {
    const response = await apiClient.delete(`/api/v1/product/${id}`);
    return response.data;
  },
};

export const quoteApi = {
  async list(params?: { page?: number; pageSize?: number; search?: string; dl__quote_stage?: string }) {
    const response = await apiClient.get('/api/v1/quote', { params });
    return response.data;
  },

  async get(id: string) {
    const response = await apiClient.get(`/api/v1/quote/${id}`);
    return response.data;
  },

  async create(data: any) {
    const response = await apiClient.post('/api/v1/quote', data);
    return response.data;
  },

  async update(id: string, data: any) {
    const response = await apiClient.put(`/api/v1/quote/${id}`, data);
    return response.data;
  },

  async delete(id: string) {
    const response = await apiClient.delete(`/api/v1/quote/${id}`);
    return response.data;
  },

  // Child entity: work orders
  async getWorkOrders(quoteId: string, params?: { page?: number; pageSize?: number }) {
    const response = await apiClient.get(`/api/v1/quote/${quoteId}/work_order`, { params });
    return response.data;
  },
};

export const workOrderApi = {
  async list(params?: { page?: number; pageSize?: number; search?: string; dl__work_order_status?: string }) {
    const response = await apiClient.get('/api/v1/work_order', { params });
    return response.data;
  },

  async get(id: string) {
    const response = await apiClient.get(`/api/v1/work_order/${id}`);
    return response.data;
  },

  async create(data: any) {
    const response = await apiClient.post('/api/v1/work_order', data);
    return response.data;
  },

  async update(id: string, data: any) {
    const response = await apiClient.put(`/api/v1/work_order/${id}`, data);
    return response.data;
  },

  async delete(id: string) {
    const response = await apiClient.delete(`/api/v1/work_order/${id}`);
    return response.data;
  },
};

export const inventoryApi = {
  async list(params?: { page?: number; pageSize?: number; search?: string }) {
    const response = await apiClient.get('/api/v1/inventory', { params });
    return response.data;
  },

  async get(id: string) {
    const response = await apiClient.get(`/api/v1/inventory/${id}`);
    return response.data;
  },

  async create(data: any) {
    const response = await apiClient.post('/api/v1/inventory', data);
    return response.data;
  },

  async update(id: string, data: any) {
    const response = await apiClient.put(`/api/v1/inventory/${id}`, data);
    return response.data;
  },

  async delete(id: string) {
    const response = await apiClient.delete(`/api/v1/inventory/${id}`);
    return response.data;
  },
};

export const orderApi = {
  async list(params?: { page?: number; pageSize?: number; search?: string }) {
    const response = await apiClient.get('/api/v1/order', { params });
    return response.data;
  },

  async get(id: string) {
    const response = await apiClient.get(`/api/v1/order/${id}`);
    return response.data;
  },

  async create(data: any) {
    const response = await apiClient.post('/api/v1/order', data);
    return response.data;
  },

  async update(id: string, data: any) {
    const response = await apiClient.put(`/api/v1/order/${id}`, data);
    return response.data;
  },

  async delete(id: string) {
    const response = await apiClient.delete(`/api/v1/order/${id}`);
    return response.data;
  },
};

export const invoiceApi = {
  async list(params?: { page?: number; pageSize?: number; search?: string }) {
    const response = await apiClient.get('/api/v1/invoice', { params });
    return response.data;
  },

  async get(id: string) {
    const response = await apiClient.get(`/api/v1/invoice/${id}`);
    return response.data;
  },

  async create(data: any) {
    const response = await apiClient.post('/api/v1/invoice', data);
    return response.data;
  },

  async update(id: string, data: any) {
    const response = await apiClient.put(`/api/v1/invoice/${id}`, data);
    return response.data;
  },

  async delete(id: string) {
    const response = await apiClient.delete(`/api/v1/invoice/${id}`);
    return response.data;
  },
};

export const shipmentApi = {
  async list(params?: { page?: number; pageSize?: number; search?: string }) {
    const response = await apiClient.get('/api/v1/shipment', { params });
    return response.data;
  },

  async get(id: string) {
    const response = await apiClient.get(`/api/v1/shipment/${id}`);
    return response.data;
  },

  async create(data: any) {
    const response = await apiClient.post('/api/v1/shipment', data);
    return response.data;
  },

  async update(id: string, data: any) {
    const response = await apiClient.put(`/api/v1/shipment/${id}`, data);
    return response.data;
  },

  async delete(id: string) {
    const response = await apiClient.delete(`/api/v1/shipment/${id}`);
    return response.data;
  },
};

export const costApi = {
  async list(params?: { page?: number; pageSize?: number; search?: string; cost_code?: string; invoice_currency?: string }) {
    const response = await apiClient.get('/api/v1/cost', { params });
    return response.data;
  },

  async get(id: string) {
    const response = await apiClient.get(`/api/v1/cost/${id}`);
    return response.data;
  },

  async create(data: any) {
    const response = await apiClient.post('/api/v1/cost', data);
    return response.data;
  },

  async update(id: string, data: any) {
    const response = await apiClient.put(`/api/v1/cost/${id}`, data);
    return response.data;
  },

  async delete(id: string) {
    const response = await apiClient.delete(`/api/v1/cost/${id}`);
    return response.data;
  },
};

export const revenueApi = {
  async list(params?: { page?: number; pageSize?: number; search?: string; revenue_code?: string; invoice_currency?: string }) {
    const response = await apiClient.get('/api/v1/revenue', { params });
    return response.data;
  },

  async get(id: string) {
    const response = await apiClient.get(`/api/v1/revenue/${id}`);
    return response.data;
  },

  async create(data: any) {
    const response = await apiClient.post('/api/v1/revenue', data);
    return response.data;
  },

  async update(id: string, data: any) {
    const response = await apiClient.put(`/api/v1/revenue/${id}`, data);
    return response.data;
  },

  async delete(id: string) {
    const response = await apiClient.delete(`/api/v1/revenue/${id}`);
    return response.data;
  },
};

// Entity Options API - Universal options for dropdowns/selects
export const entityOptionsApi = {
  /**
   * Get list of {id, name} pairs for any entity type
   * Used for populating dropdowns and selection fields
   */
  async getOptions(entityType: string, params?: { search?: string; limit?: number; active_only?: boolean }) {
    const response = await apiClient.get(`/api/v1/entity/${entityType}/options`, { params });
    return response.data;
  },

  /**
   * Get names for specific entity IDs (bulk lookup)
   */
  async getBulkOptions(entityType: string, ids: string[]) {
    const response = await apiClient.post(`/api/v1/entity/${entityType}/options/bulk`, { ids });
    return response.data;
  },

  /**
   * Get all child entities for a given parent entity
   *
   * This is a universal API factory that returns all child entities grouped by type.
   * Uses d_entity_id_map table to find relationships.
   *
   * @param parentType - Parent entity type (e.g., 'task', 'project')
   * @param parentId - Parent entity UUID
   * @param params - Optional parameters (active_only)
   *
   * @returns Array of objects with entity type as key, array of {id, name} as value
   *
   * @example
   * ```typescript
   * // Get all children for a task
   * const children = await entityOptionsApi.getEntitiesByParent('task', taskId);
   * // Returns: [{"employee": [{"id": "uuid", "name": "John Doe"}]}]
   * ```
   */
  async getEntitiesByParent(parentType: string, parentId: string, params?: { active_only?: boolean }) {
    const response = await apiClient.get(`/api/v1/entity/${parentType}/${parentId}/children`, { params });
    return response.data;
  },
};

// ========================================
// API FACTORY REGISTRATION
// ========================================

import { APIFactory } from './api-factory';

/**
 * Register all entity APIs in the factory for type-safe access
 *
 * This eliminates the need for unsafe dynamic API calls like:
 * const apiModule = (api as any)[`${entityType}Api`];
 *
 * Instead, use the type-safe factory:
 * const api = APIFactory.getAPI(entityType);
 */

// Core business entities
APIFactory.register('project', projectApi);
APIFactory.register('task', taskApi);
APIFactory.register('biz', bizApi);
APIFactory.register('business', businessApi); // Alias for biz
APIFactory.register('office', officeApi);
APIFactory.register('org', orgApi); // Alias for office

// People & roles
APIFactory.register('employee', employeeApi);
APIFactory.register('cust', custApi);
APIFactory.register('role', roleApi);
APIFactory.register('position', positionApi);

// Content & documentation
APIFactory.register('wiki', wikiApi);
APIFactory.register('artifact', artifactApi);
APIFactory.register('form', formApi);

// Locations
APIFactory.register('worksite', worksiteApi);

// Marketing
APIFactory.register('marketing', marketingApi);

// Product & Operations
APIFactory.register('service', serviceApi);
APIFactory.register('product', productApi);
APIFactory.register('quote', quoteApi);
APIFactory.register('work_order', workOrderApi);
APIFactory.register('inventory', inventoryApi);
APIFactory.register('order', orderApi);
APIFactory.register('invoice', invoiceApi);
APIFactory.register('shipment', shipmentApi);

// Financial
APIFactory.register('cost', costApi);
APIFactory.register('revenue', revenueApi);

/**
 * Export the APIFactory for use in components
 */
export { APIFactory } from './api-factory';

/**
 * Universal entity data fetcher - fetches a single entity by type and ID
 * Used by entity preview panel and other components that need to fetch entity data
 *
 * @param entityType - Entity type (e.g., 'project', 'task', 'client')
 * @param entityId - Entity UUID
 * @returns Promise<any> - Entity data object
 *
 * @example
 * const projectData = await fetchEntityData('project', 'abc-123');
 */
export async function fetchEntityData(entityType: string, entityId: string): Promise<any> {
  try {
    const api = APIFactory.getAPI(entityType);
    const data = await api.get(entityId);
    return data;
  } catch (error) {
    console.error(`Error fetching ${entityType} data:`, error);
    throw error;
  }
}
