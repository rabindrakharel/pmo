# PMO MCP Server - Documentation Overview

**Location:** `/home/rabin/projects/pmo/apps/mcp-server/`

## What is the MCP Server?

The PMO MCP Server is a Model Context Protocol server that exposes **all 100+ API endpoints** of the PMO Enterprise Platform to AI models like Claude. This allows AI assistants to programmatically interact with your CRM/PMO system.

## Architecture

```
┌─────────────┐     MCP Protocol      ┌──────────────┐     HTTP/REST      ┌──────────────┐
│             │  ←──────────────────→  │              │  ←────────────────→ │              │
│ AI Model    │   Tool Calls/Results  │  MCP Server  │   API Requests     │  PMO API     │
│  (Claude)   │                        │              │   JWT Auth         │  (Fastify)   │
│             │                        │              │                    │              │
└─────────────┘                        └──────────────┘                    └──────────────┘
```

## Key Features

### 1. Complete API Coverage
- **100+ endpoints** indexed in `api-manifest.ts`
- **25+ categories** (Authentication, Project, Task, Employee, etc.)
- All CRUD operations for core entities
- Child entity relationships
- RBAC permission checks
- File upload/download
- Settings and configuration

### 2. Automatic Authentication
- JWT token management
- Environment variable configuration
- Automatic re-authentication
- Token expiration handling

### 3. Type Safety
- Full TypeScript implementation
- Zod schema validation
- Type-safe tool definitions
- Compile-time error checking

### 4. MCP Standard Compliance
- Uses `@modelcontextprotocol/sdk`
- Stdio transport for universal compatibility
- Standard tool interface
- Error handling and reporting

## Files Created

```
apps/mcp-server/
├── src/
│   ├── index.ts              # Main MCP server (350+ lines)
│   └── api-manifest.ts       # Complete API registry (1000+ lines, 100+ endpoints)
├── dist/                     # Compiled JavaScript output
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── .env.example              # Environment template
└── README.md                 # Complete usage documentation
```

## API Manifest Structure

The `api-manifest.ts` file contains:

```typescript
export interface APIEndpoint {
  name: string;                  // Tool name (e.g., "project_list")
  method: 'GET' | 'POST' | ...;  // HTTP method
  path: string;                  // API path (e.g., "/api/v1/project")
  description: string;           // Human-readable description
  requiresAuth: boolean;         // JWT required?
  category: string;              // Category grouping
  parameters?: {...};            // Path/query/body params
  responseType?: string;         // Expected response type
}

export const API_MANIFEST: APIEndpoint[] = [
  // 100+ endpoint definitions...
];
```

## Usage Examples

### Quick Start

```bash
# Install
cd /home/rabin/projects/pmo/apps/mcp-server
pnpm install
pnpm run build

# Configure
cp .env.example .env
# Edit .env with your API credentials

# Run
pnpm start
```

### Claude Desktop Integration

Add to `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pmo-api": {
      "command": "node",
      "args": ["/home/rabin/projects/pmo/apps/mcp-server/dist/index.js"],
      "env": {
        "PMO_API_URL": "http://localhost:4000",
        "PMO_API_EMAIL": "james.miller@huronhome.ca",
        "PMO_API_PASSWORD": "password123"
      }
    }
  }
}
```

### Example Tool Calls

Once connected, Claude can use tools like:

```typescript
// Get API info
pmo_api_info({ category: "Project" })

// List projects
project_list({ search: "renovation", limit: "10" })

// Create project
project_create({
  body: JSON.stringify({
    name: "Kitchen Renovation",
    code: "PROJ-2025-001",
    budget_allocated_amt: 50000
  })
})

// List tasks for a project
project_get_tasks({ id: "project-uuid" })

// Update task status
task_update_status({
  id: "task-uuid",
  body: JSON.stringify({ task_status: "in_progress" })
})

// Get employee list
employee_list({ limit: "50" })

// Create linkage
linkage_create({
  body: JSON.stringify({
    parent_entity_type: "project",
    parent_entity_id: "project-uuid",
    child_entity_type: "task",
    child_entity_id: "task-uuid"
  })
})
```

## Categories and Endpoint Count

| Category | Endpoints | Description |
|----------|-----------|-------------|
| **Authentication** | 10 | Login, logout, permissions, customer auth |
| **Project** | 10 | CRUD, child entities, tabs |
| **Task** | 15 | CRUD, Kanban, case notes, activity |
| **Employee** | 5 | CRUD operations |
| **Business** | 5 | CRUD operations |
| **Office** | 5 | CRUD operations |
| **Customer** | 5 | CRUD operations |
| **Worksite** | 5 | CRUD operations |
| **Role** | 5 | CRUD operations |
| **Position** | 5 | CRUD operations |
| **Wiki** | 5 | CRUD operations |
| **Form** | 5 | CRUD operations |
| **Artifact** | 5 | CRUD operations |
| **Reports** | 5 | CRUD operations |
| **Product** | 4 | Products and services |
| **Sales** | 2 | Quotes |
| **Operations** | 2 | Work orders |
| **Inventory** | 1 | Inventory management |
| **Order** | 1 | Order management |
| **Shipment** | 1 | Shipment tracking |
| **Financial** | 3 | Costs, revenue, invoices |
| **Settings** | 1 | Configuration |
| **Linkage** | 3 | Entity relationships |
| **RBAC** | 2 | Permission checks |
| **Entity** | 1 | Entity options |
| **Upload** | 1 | File upload |
| **S3** | 2 | Presigned URLs, attachments |
| **Workflow** | 2 | Workflow automation |
| **Email** | 1 | Email templates |
| **Chat** | 2 | AI chat widget |
| **Booking** | 3 | Appointment scheduling |
| **System** | 2 | Health check, config |
| **TOTAL** | **100+** | Complete coverage |

## Development Workflow

### Adding New Endpoints

When new API endpoints are added to the PMO platform:

1. Add endpoint definition to `api-manifest.ts`:
```typescript
{
  name: 'new_endpoint_name',
  method: 'GET',
  path: '/api/v1/new-endpoint',
  description: 'Description of what it does',
  requiresAuth: true,
  category: 'CategoryName',
  parameters: {
    path: { id: 'Entity UUID' },
    query: { filter: 'Optional filter' },
    body: { field: 'Field description' }
  }
}
```

2. Rebuild:
```bash
pnpm run build
```

3. Test:
```bash
# In Claude or via MCP client
pmo_api_info({ category: "CategoryName" })
new_endpoint_name({ id: "test-uuid" })
```

### Testing

```bash
# Manual API test first
curl http://localhost:4000/api/v1/endpoint

# Then test via MCP
node dist/index.js
# Use MCP client to invoke tools
```

## Integration Points

### With PMO API
- **Authentication:** `/api/v1/auth/login`
- **All Entities:** `/api/v1/{entity}` endpoints
- **RBAC:** Respects entity_id_rbac_map permissions
- **Linkage:** Creates relationships via entity_id_map
- **Settings:** Accesses dropdown/select options

### With AI Models
- **Tool Discovery:** AI learns available operations
- **Type Safety:** Parameter validation
- **Error Handling:** Clear error messages
- **Documentation:** Inline descriptions

## Security Considerations

1. **Authentication Required:** Most endpoints require JWT token
2. **RBAC Enforced:** API respects platform permissions
3. **Environment Variables:** Credentials stored in .env (not committed)
4. **Token Management:** Automatic refresh and expiration
5. **Audit Trail:** All operations logged by PMO API

## Performance

- **Lazy Authentication:** Only auth when needed
- **Connection Pooling:** Reuses axios instance
- **Timeout Handling:** 30-second request timeout
- **Error Recovery:** Automatic retry for auth failures

## Troubleshooting

### Server Won't Start
```bash
# Check Node version
node --version  # Should be 18+

# Rebuild
pnpm run build

# Check environment
cat .env
```

### Authentication Fails
```bash
# Test API directly
./tools/test-api.sh GET /api/v1/project

# Check credentials
echo $PMO_API_EMAIL
echo $PMO_API_PASSWORD
```

### Connection Refused
```bash
# Ensure API is running
curl http://localhost:4000/api/health

# Start API if needed
./tools/start-all.sh
```

## Future Enhancements

Potential improvements:

1. **Caching:** Cache frequently accessed data
2. **Batch Operations:** Support bulk requests
3. **Webhooks:** Real-time event notifications
4. **Subscriptions:** Live data updates
5. **Advanced Search:** Full-text search across entities
6. **Analytics:** Usage statistics and insights
7. **Rate Limiting:** Protect against abuse
8. **Request Queuing:** Handle high load

## Related Documentation

- **MCP Server Code:** `/home/rabin/projects/pmo/apps/mcp-server/`
- **API Documentation:** `/home/rabin/projects/pmo/docs/ui_ux_route_api.md`
- **Entity System:** `/home/rabin/projects/pmo/docs/entity_design_pattern/universal_entity_system.md`
- **Testing Tools:** `/home/rabin/projects/pmo/tools/test-api.sh`

## Summary

The PMO MCP Server provides complete AI access to your enterprise platform with:

✅ **100+ API endpoints** fully indexed
✅ **Automatic authentication** and token management
✅ **Type-safe** TypeScript implementation
✅ **MCP standard** compliance
✅ **Production-ready** error handling
✅ **Well-documented** usage examples
✅ **Easy integration** with Claude and other AI models

The server is located at `/home/rabin/projects/pmo/apps/mcp-server/` and is ready to use!
