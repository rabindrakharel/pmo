/**
 * MCP Adapter Service
 * Converts MCP API manifest to OpenAI function tools and executes them
 * @module chat/mcp-adapter.service
 */

import axios from 'axios';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';

// Import from MCP server manifest
import { API_MANIFEST, type APIEndpoint } from '../../../../mcp-server/src/api-manifest.js';

const API_BASE_URL = process.env.API_ORIGIN || 'http://localhost:4000';

/**
 * Convert MCP API endpoint to OpenAI function tool
 */
function endpointToOpenAITool(endpoint: APIEndpoint): ChatCompletionTool {
  const parameters: any = {
    type: 'object',
    properties: {},
    required: [] as string[],
  };

  // Add path parameters
  if (endpoint.parameters?.path) {
    for (const [key, desc] of Object.entries(endpoint.parameters.path)) {
      parameters.properties[key] = {
        type: 'string',
        description: desc,
      };
      parameters.required.push(key);
    }
  }

  // Add query parameters
  if (endpoint.parameters?.query) {
    for (const [key, desc] of Object.entries(endpoint.parameters.query)) {
      parameters.properties[`query_${key}`] = {
        type: 'string',
        description: `Query parameter: ${desc}`,
      };
    }
  }

  // Add body parameters
  if (endpoint.parameters?.body) {
    for (const [key, desc] of Object.entries(endpoint.parameters.body)) {
      parameters.properties[`body_${key}`] = {
        type: 'string',
        description: `Body field: ${desc}`,
      };
    }
  }

  return {
    type: 'function',
    function: {
      name: endpoint.name,
      description: `[${endpoint.method}] ${endpoint.description} (${endpoint.category})`,
      parameters: parameters,
    },
  };
}

/**
 * Get all MCP tools as OpenAI function tools
 * Can filter by category or specific endpoints
 */
export function getMCPTools(options?: {
  categories?: string[];
  includeEndpoints?: string[];
  excludeEndpoints?: string[];
  maxTools?: number;
}): ChatCompletionTool[] {
  let endpoints = API_MANIFEST;

  // Filter by category
  if (options?.categories) {
    endpoints = endpoints.filter(e => options.categories!.includes(e.category));
  }

  // Include specific endpoints
  if (options?.includeEndpoints) {
    endpoints = endpoints.filter(e => options.includeEndpoints!.includes(e.name));
  }

  // Exclude specific endpoints
  if (options?.excludeEndpoints) {
    endpoints = endpoints.filter(e => !options.excludeEndpoints!.includes(e.name));
  }

  // Limit number of tools
  if (options?.maxTools) {
    endpoints = endpoints.slice(0, options.maxTools);
  }

  return endpoints.map(endpointToOpenAITool);
}

/**
 * Execute an MCP tool call
 */
export async function executeMCPTool(
  toolName: string,
  args: Record<string, any>,
  authToken: string
): Promise<any> {
  const endpoint = API_MANIFEST.find(e => e.name === toolName);
  if (!endpoint) {
    throw new Error(`Tool not found: ${toolName}`);
  }

  // Build path with path parameters
  let path = endpoint.path;
  if (endpoint.parameters?.path) {
    for (const key of Object.keys(endpoint.parameters.path)) {
      if (args[key]) {
        path = path.replace(`:${key}`, args[key]);
        delete args[key];
      }
    }
  }

  // Extract query parameters
  const queryParams: Record<string, any> = {};
  if (endpoint.parameters?.query) {
    for (const key of Object.keys(endpoint.parameters.query)) {
      const queryKey = `query_${key}`;
      if (args[queryKey]) {
        queryParams[key] = args[queryKey];
        delete args[queryKey];
      }
    }
  }

  // Extract body parameters
  const body: Record<string, any> = {};
  if (endpoint.parameters?.body) {
    for (const key of Object.keys(endpoint.parameters.body)) {
      const bodyKey = `body_${key}`;
      if (args[bodyKey]) {
        body[key] = args[bodyKey];
        delete args[bodyKey];
      }
    }
  }

  // Special handling for customer_create - auto-generate required fields
  if (toolName === 'customer_create' && body) {
    // Auto-generate code from name if not provided
    if (!body.code && body.name) {
      body.code = body.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }

    // Auto-generate cust_number from phone if not provided
    if (!body.cust_number) {
      if (body.primary_phone) {
        // Use phone number as cust_number (remove non-digits)
        body.cust_number = body.primary_phone.replace(/\D/g, '');
      } else {
        // Generate from timestamp if no phone
        body.cust_number = `CUST-${Date.now()}`;
      }
    }

    // Set primary_contact_name from name if not provided
    if (!body.primary_contact_name && body.name) {
      body.primary_contact_name = body.name;
    }

    // Set defaults
    body.cust_type = body.cust_type || 'residential';
    body.cust_status = body.cust_status || 'active';
    body.province = body.province || 'ON';
    body.country = body.country || 'Canada';
  }

  // Make API request
  try {
    const response = await axios({
      method: endpoint.method,
      url: `${API_BASE_URL}${path}`,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
      data: Object.keys(body).length > 0 ? body : undefined,
      timeout: 30000,
    });

    return response.data;
  } catch (error: any) {
    console.error(`MCP tool execution error [${toolName}]:`, error.response?.data || error.message);
    throw new Error(
      `API call failed: ${error.response?.data?.message || error.message}`
    );
  }
}

/**
 * Get recommended tools for customer service chat
 */
export function getCustomerServiceTools(): ChatCompletionTool[] {
  return getMCPTools({
    categories: [
      'Project',
      'Task',
      'Employee',
      'Customer',
      'Business',
      'Office',
      'Worksite',
      'Role',
      'Position',
      'Booking',
      'Wiki',
      'Form',
      'Artifact',
      'Product',
      'Sales',
      'Operations',
      'Linkage',
      'Settings',
    ],
    excludeEndpoints: [
      'auth_login',
      'auth_logout',
      'customer_signup',
      'customer_signin',
      'pmo_authenticate',
      'pmo_api_info',
      // Exclude delete operations for safety
      'project_delete',
      'task_delete',
      'employee_delete',
      'customer_delete',
      'business_delete',
      'office_delete',
    ],
    maxTools: 60, // Increased limit for more comprehensive access
  });
}

/**
 * Get ALL available tools (for admin/internal use)
 */
export function getAllPMOTools(): ChatCompletionTool[] {
  return getMCPTools({
    excludeEndpoints: [
      'auth_login',
      'auth_logout',
      'customer_signup',
      'customer_signin',
    ],
    maxTools: 100,
  });
}

/**
 * Get all available API categories
 */
export function getAPICategories(): string[] {
  const categories = new Set(API_MANIFEST.map(e => e.category));
  return Array.from(categories).sort();
}

/**
 * Get endpoint count by category
 */
export function getEndpointStats(): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const endpoint of API_MANIFEST) {
    stats[endpoint.category] = (stats[endpoint.category] || 0) + 1;
  }
  return stats;
}

// Export manifest for reference
export { API_MANIFEST };
