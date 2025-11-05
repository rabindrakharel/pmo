#!/usr/bin/env node

/**
 * PMO MCP Server - Model Context Protocol Server for PMO API
 *
 * This MCP server exposes all PMO CRM/PMO API endpoints as MCP tools,
 * allowing AI models to interact with the platform programmatically.
 *
 * Features:
 * - Complete API manifest with 100+ endpoints
 * - JWT authentication support
 * - Automatic request/response handling
 * - Full RBAC integration
 * - Type-safe tool definitions
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { API_MANIFEST, APIEndpoint, API_CATEGORIES, TOTAL_API_ENDPOINTS } from './api-manifest.js';
import { z } from 'zod';

// Server configuration
const API_BASE_URL = process.env.PMO_API_URL || 'http://localhost:4000';
const DEFAULT_EMAIL = process.env.PMO_API_EMAIL || 'james.miller@huronhome.ca';
const DEFAULT_PASSWORD = process.env.PMO_API_PASSWORD || 'password123';

// Authentication state
let authToken: string | null = null;
let axiosInstance: AxiosInstance;

/**
 * Initialize axios instance with auth token
 */
function createAxiosInstance(): AxiosInstance {
  return axios.create({
    baseURL: API_BASE_URL,
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    timeout: 30000,
  });
}

/**
 * Authenticate with PMO API
 */
async function authenticate(email?: string, password?: string): Promise<string> {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/v1/auth/login`, {
      email: email || DEFAULT_EMAIL,
      password: password || DEFAULT_PASSWORD,
    });

    authToken = response.data.token;
    axiosInstance = createAxiosInstance();

    return `Authenticated as ${response.data.employee.name} (${response.data.employee.email})`;
  } catch (error: any) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

/**
 * Convert API endpoint to MCP tool definition
 */
function endpointToTool(endpoint: APIEndpoint): Tool {
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
      parameters.properties[key] = {
        type: 'string',
        description: desc,
      };
    }
  }

  // Add body parameters
  if (endpoint.parameters?.body) {
    parameters.properties.body = {
      type: 'object',
      description: 'Request body',
      properties: {},
    };

    for (const [key, desc] of Object.entries(endpoint.parameters.body)) {
      (parameters.properties.body.properties as any)[key] = {
        type: 'string',
        description: desc,
      };
    }
  }

  return {
    name: endpoint.name,
    description: `${endpoint.description} [${endpoint.method} ${endpoint.path}] [Category: ${endpoint.category}]`,
    inputSchema: parameters,
  };
}

/**
 * Execute API call for a tool
 */
async function executeApiCall(endpoint: APIEndpoint, args: any): Promise<any> {
  // Ensure authenticated
  if (endpoint.requiresAuth && !authToken) {
    await authenticate();
  }

  // Build URL with path parameters
  let url = endpoint.path;
  if (endpoint.parameters?.path) {
    for (const key of Object.keys(endpoint.parameters.path)) {
      if (args[key]) {
        url = url.replace(`:${key}`, args[key]);
      }
    }
  }

  // Build request config
  const config: AxiosRequestConfig = {
    method: endpoint.method,
    url,
  };

  // Add query parameters
  if (endpoint.parameters?.query) {
    const query: any = {};
    for (const key of Object.keys(endpoint.parameters.query)) {
      if (args[key] !== undefined) {
        query[key] = args[key];
      }
    }
    if (Object.keys(query).length > 0) {
      config.params = query;
    }
  }

  // Add body
  if (args.body) {
    config.data = typeof args.body === 'string' ? JSON.parse(args.body) : args.body;
  }

  try {
    const response = await axiosInstance.request(config);
    return {
      success: true,
      status: response.status,
      data: response.data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      status: error.response?.status,
      details: error.response?.data,
    };
  }
}

/**
 * Main server setup
 */
async function main() {
  // Initialize axios instance
  axiosInstance = createAxiosInstance();

  // Create MCP server
  const server = new Server(
    {
      name: 'pmo-api-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register list tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    // Convert all API endpoints to MCP tools
    const tools: Tool[] = API_MANIFEST.map(endpointToTool);

    // Add special authentication tool
    tools.unshift({
      name: 'pmo_authenticate',
      description: 'Authenticate with PMO API using email and password',
      inputSchema: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            description: 'Employee email address',
          },
          password: {
            type: 'string',
            description: 'Employee password',
          },
        },
        required: ['email', 'password'],
      },
    });

    // Add API info tool
    tools.unshift({
      name: 'pmo_api_info',
      description: `Get information about PMO API (${TOTAL_API_ENDPOINTS} endpoints across ${API_CATEGORIES.length} categories)`,
      inputSchema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Filter by category',
            enum: API_CATEGORIES as any,
          },
        },
      },
    });

    return { tools };
  });

  // Register call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      // Handle special tools
      if (name === 'pmo_api_info') {
        const category = args?.category as string | undefined;

        if (category) {
          const endpoints = API_MANIFEST.filter(e => e.category === category);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  category,
                  endpoint_count: endpoints.length,
                  endpoints: endpoints.map(e => ({
                    name: e.name,
                    method: e.method,
                    path: e.path,
                    description: e.description,
                  })),
                }, null, 2),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                total_endpoints: TOTAL_API_ENDPOINTS,
                categories: API_CATEGORIES,
                base_url: API_BASE_URL,
                authenticated: !!authToken,
              }, null, 2),
            },
          ],
        };
      }

      if (name === 'pmo_authenticate') {
        const result = await authenticate(args?.email as string, args?.password as string);
        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      }

      // Find endpoint
      const endpoint = API_MANIFEST.find(e => e.name === name);
      if (!endpoint) {
        throw new Error(`Unknown tool: ${name}`);
      }

      // Execute API call
      const result = await executeApiCall(endpoint, args || {});

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('PMO MCP Server started');
  console.error(`API Base URL: ${API_BASE_URL}`);
  console.error(`Total API Endpoints: ${TOTAL_API_ENDPOINTS}`);
  console.error(`Categories: ${API_CATEGORIES.join(', ')}`);
}

// Run server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
