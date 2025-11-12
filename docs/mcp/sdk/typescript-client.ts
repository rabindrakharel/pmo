/**
 * PMO MCP API - TypeScript Client SDK
 *
 * @version 4.0.0
 * @description Type-safe client for PMO MCP API
 * @author PMO Platform Team
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface MCPClientConfig {
  baseUrl: string;
  apiVersion?: string;
  timeout?: number;
  retryAttempts?: number;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  expiresIn: number;
  user: User;
}

export interface User {
  id: string;
  email: string;
  name: string;
  employee_id?: string;
  roles: string[];
  permissions: Record<string, string[]>;
}

export interface Customer {
  id: string;
  name: string;
  primary_phone?: string;
  primary_email?: string;
  primary_address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
  created_ts: string;
  updated_ts: string;
  active_flag: boolean;
}

export interface CustomerCreate {
  name: string;
  primary_phone?: string;
  primary_email?: string;
  primary_address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
}

export interface Task {
  id: string;
  name: string;
  code?: string;
  descr?: string;
  dl__task_stage?: TaskStage;
  dl__task_priority?: TaskPriority;
  estimated_hours?: number;
  actual_hours?: number;
  metadata?: Record<string, any>;
  created_ts: string;
  updated_ts: string;
}

export interface TaskCreate {
  name: string;
  code?: string;
  descr?: string;
  dl__task_stage?: TaskStage;
  dl__task_priority?: TaskPriority;
  estimated_hours?: number;
  metadata?: Record<string, any>;
}

export interface CalendarBooking {
  id: string;
  title: string;
  instructions?: string;
  slot_ids: string[];
  metadata?: CalendarMetadata;
  created_ts: string;
}

export interface CalendarBookingCreate {
  slot_ids: string[];
  title: string;
  instructions?: string;
  metadata?: CalendarMetadata;
}

export interface CalendarMetadata {
  attendees?: Attendee[];
  task_id?: string;
  service_type?: string;
  [key: string]: any;
}

export interface Attendee {
  name: string;
  email?: string;
  phone?: string;
  type: 'customer' | 'employee';
}

export interface EntityLinkage {
  id: string;
  parent_entity_type: string;
  parent_entity_id: string;
  child_entity_type: string;
  child_entity_id: string;
  relationship_type?: string;
}

export interface EntityLinkageCreate {
  parent_entity_type: string;
  parent_entity_id: string;
  child_entity_type: string;
  child_entity_id: string;
  relationship_type?: string;
}

export interface PaginatedResponse<T> {
  results: T[];
  pagination: Pagination;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  statusCode: number;
  timestamp: string;
}

export type TaskStage = 'backlog' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  [key: string]: any;
}

// ============================================================================
// Main Client Class
// ============================================================================

export class PMOMCPClient {
  private config: Required<MCPClientConfig>;
  private authToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor(config: MCPClientConfig) {
    this.config = {
      baseUrl: config.baseUrl,
      apiVersion: config.apiVersion || 'v1',
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
    };
  }

  // ============================================================================
  // Authentication
  // ============================================================================

  async authenticate(credentials: AuthCredentials): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('POST', '/auth/login', {
      body: credentials,
      skipAuth: true,
    });

    this.authToken = response.token;
    this.tokenExpiry = Date.now() + response.expiresIn * 1000;

    return response;
  }

  async getProfile(): Promise<User> {
    return this.request<User>('GET', '/auth/profile');
  }

  isAuthenticated(): boolean {
    return this.authToken !== null && (this.tokenExpiry || 0) > Date.now();
  }

  // ============================================================================
  // Customer Operations
  // ============================================================================

  async listCustomers(params?: ListParams): Promise<PaginatedResponse<Customer>> {
    return this.request<PaginatedResponse<Customer>>('GET', '/cust', { params });
  }

  async getCustomer(id: string): Promise<Customer> {
    return this.request<Customer>('GET', `/cust/${id}`);
  }

  async createCustomer(data: CustomerCreate): Promise<Customer> {
    return this.request<Customer>('POST', '/cust', { body: data });
  }

  async updateCustomer(id: string, data: Partial<CustomerCreate>): Promise<Customer> {
    return this.request<Customer>('PUT', `/cust/${id}`, { body: data });
  }

  async deleteCustomer(id: string): Promise<void> {
    await this.request('DELETE', `/cust/${id}`);
  }

  async searchCustomerByPhone(phone: string): Promise<PaginatedResponse<Customer>> {
    return this.listCustomers({ query_primary_phone: phone });
  }

  // ============================================================================
  // Task Operations
  // ============================================================================

  async listTasks(params?: ListParams): Promise<PaginatedResponse<Task>> {
    return this.request<PaginatedResponse<Task>>('GET', '/task', { params });
  }

  async getTask(id: string): Promise<Task> {
    return this.request<Task>('GET', `/task/${id}`);
  }

  async createTask(data: TaskCreate): Promise<Task> {
    return this.request<Task>('POST', '/task', { body: data });
  }

  async updateTask(id: string, data: Partial<TaskCreate>): Promise<Task> {
    return this.request<Task>('PUT', `/task/${id}`, { body: data });
  }

  async deleteTask(id: string): Promise<void> {
    await this.request('DELETE', `/task/${id}`);
  }

  async getKanbanBoard(projectId?: string): Promise<any> {
    const params = projectId ? { projectId } : undefined;
    return this.request('GET', '/task/kanban', { params });
  }

  async updateTaskStatus(id: string, status: TaskStage, position?: number): Promise<Task> {
    return this.request<Task>('PATCH', `/task/${id}/status`, {
      body: { task_status: status, position },
    });
  }

  async addCaseNote(taskId: string, content: string): Promise<any> {
    return this.request('POST', `/task/${taskId}/case-note`, {
      body: { content, content_type: 'case_note' },
    });
  }

  // ============================================================================
  // Calendar Operations
  // ============================================================================

  async bookAppointment(data: CalendarBookingCreate): Promise<CalendarBooking> {
    return this.request<CalendarBooking>('POST', '/person-calendar/book', { body: data });
  }

  async searchAvailability(params?: Record<string, any>): Promise<any> {
    return this.request('GET', '/person-calendar/search', { params });
  }

  async getBooking(id: string): Promise<CalendarBooking> {
    return this.request<CalendarBooking>('GET', `/person-calendar/${id}`);
  }

  async cancelBooking(id: string): Promise<void> {
    await this.request('DELETE', `/person-calendar/${id}`);
  }

  // ============================================================================
  // Entity Linkage Operations
  // ============================================================================

  async listLinkages(params?: {
    parent_entity_type?: string;
    parent_entity_id?: string;
  }): Promise<PaginatedResponse<EntityLinkage>> {
    return this.request<PaginatedResponse<EntityLinkage>>('GET', '/entity-linkage', { params });
  }

  async createLinkage(data: EntityLinkageCreate): Promise<EntityLinkage> {
    return this.request<EntityLinkage>('POST', '/entity-linkage', { body: data });
  }

  async deleteLinkage(id: string): Promise<void> {
    await this.request('DELETE', `/entity-linkage/${id}`);
  }

  // ============================================================================
  // Low-Level Request Method
  // ============================================================================

  private async request<T = any>(
    method: string,
    path: string,
    options: {
      params?: Record<string, any>;
      body?: any;
      headers?: Record<string, string>;
      skipAuth?: boolean;
    } = {}
  ): Promise<T> {
    const url = this.buildUrl(path, options.params);
    const headers = this.buildHeaders(options.headers, options.skipAuth);

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.config.timeout),
    };

    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
          const error: ApiError = await response.json();
          throw new PMOAPIError(error);
        }

        // Handle empty responses (DELETE, etc.)
        if (response.status === 204 || response.headers.get('content-length') === '0') {
          return undefined as T;
        }

        return await response.json();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on authentication errors
        if (error instanceof PMOAPIError && error.statusCode === 401) {
          throw error;
        }

        // Don't retry on client errors (4xx)
        if (error instanceof PMOAPIError && error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < this.config.retryAttempts - 1) {
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError;
  }

  private buildUrl(path: string, params?: Record<string, any>): string {
    const baseUrl = `${this.config.baseUrl}/api/${this.config.apiVersion}`;
    let url = `${baseUrl}${path}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });

      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    return url;
  }

  private buildHeaders(customHeaders?: Record<string, string>, skipAuth?: boolean): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    if (!skipAuth && this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Custom Error Class
// ============================================================================

export class PMOAPIError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;

  constructor(error: ApiError) {
    super(error.error.message);
    this.name = 'PMOAPIError';
    this.code = error.error.code;
    this.statusCode = error.statusCode;
    this.details = error.error.details;
  }

  toString(): string {
    return `${this.name} [${this.code}]: ${this.message} (HTTP ${this.statusCode})`;
  }
}

// ============================================================================
// Usage Examples
// ============================================================================

/**
 * Example 1: Basic Authentication and Customer Creation
 */
async function example1() {
  const client = new PMOMCPClient({
    baseUrl: 'http://localhost:4000',
  });

  // Authenticate
  const auth = await client.authenticate({
    email: 'james.miller@huronhome.ca',
    password: 'password123',
  });

  console.log('Authenticated:', auth.user.name);

  // Search for customer
  const searchResults = await client.searchCustomerByPhone('+1 555 1234');

  let customer: Customer;

  if (searchResults.results.length === 0) {
    // Create new customer
    customer = await client.createCustomer({
      name: 'John Doe',
      primary_phone: '+1 555 1234',
      primary_address: '123 Main St',
      city: 'Toronto',
      province: 'ON',
      postal_code: 'M5H 2N2',
    });
    console.log('Created customer:', customer.id);
  } else {
    customer = searchResults.results[0];
    console.log('Found existing customer:', customer.id);
  }
}

/**
 * Example 2: Complete Service Flow (Customer → Task → Appointment)
 */
async function example2() {
  const client = new PMOMCPClient({
    baseUrl: 'http://localhost:4000',
  });

  await client.authenticate({
    email: 'james.miller@huronhome.ca',
    password: 'password123',
  });

  // Step 1: Create customer
  const customer = await client.createCustomer({
    name: 'Mike Johnson',
    primary_phone: '+1 555 9999',
    primary_address: '789 Goodrich Road',
    city: 'Minneapolis',
    province: 'Minnesota',
    postal_code: '55437',
  });

  // Step 2: Create task (MCP auto-enriches with customer data)
  const task = await client.createTask({
    name: 'Backyard assistance - Mike Johnson',
    dl__task_stage: 'backlog',
    dl__task_priority: 'high',
    metadata: {
      customer_id: customer.id,
    },
  });

  // Step 3: Book appointment (MCP auto-enriches with task + attendees)
  const booking = await client.bookAppointment({
    slot_ids: ['slot-uuid-1'],
    title: 'Service: Backyard assistance',
    metadata: {
      task_id: task.id,
      attendees: [
        {
          name: customer.name,
          phone: customer.primary_phone,
          type: 'customer',
        },
        {
          name: 'John Doe',
          email: 'john@example.com',
          type: 'employee',
        },
      ],
    },
  });

  console.log('Service flow completed:', {
    customer: customer.id,
    task: task.id,
    booking: booking.id,
  });
}

/**
 * Example 3: Error Handling
 */
async function example3() {
  const client = new PMOMCPClient({
    baseUrl: 'http://localhost:4000',
  });

  try {
    await client.getCustomer('invalid-uuid');
  } catch (error) {
    if (error instanceof PMOAPIError) {
      console.error('API Error:', error.code);
      console.error('Status:', error.statusCode);
      console.error('Message:', error.message);
      console.error('Details:', error.details);
    } else {
      console.error('Unknown error:', error);
    }
  }
}

/**
 * Example 4: Pagination
 */
async function example4() {
  const client = new PMOMCPClient({
    baseUrl: 'http://localhost:4000',
  });

  await client.authenticate({
    email: 'james.miller@huronhome.ca',
    password: 'password123',
  });

  // Get all customers (with pagination)
  const allCustomers: Customer[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await client.listCustomers({ page, limit: 100 });
    allCustomers.push(...response.results);
    hasMore = response.pagination.hasMore;
    page++;
  }

  console.log(`Fetched ${allCustomers.length} customers`);
}

// Export examples for documentation
export const examples = {
  example1,
  example2,
  example3,
  example4,
};
