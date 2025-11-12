# PMO MCP Server

Model Context Protocol (MCP) server that exposes all PMO Enterprise Platform API endpoints as AI-accessible tools.

## Overview

This MCP server provides complete programmatic access to the PMO platform's 100+ API endpoints across 25+ categories including:

- **Authentication** - Login, permissions, RBAC
- **Core Entities** - Projects, Tasks, Employees, Customers, Worksites
- **Business** - Offices, Positions, Roles
- **Documentation** - Wiki, Forms, Artifacts, Reports
- **Operations** - Products, Services, Quotes, Work Orders, Inventory
- **Financial** - Costs, Revenue, Invoices
- **System** - Settings, Linkage, RBAC, Entity Options
- **Integration** - Chat, Booking, Upload, S3

## Features

- ✅ **Complete API Coverage** - All 100+ endpoints indexed and accessible
- ✅ **JWT Authentication** - Automatic token management
- ✅ **Type Safety** - Full TypeScript support with Zod validation
- ✅ **RBAC Integration** - Respects platform permission system
- ✅ **Category Organization** - Endpoints grouped by functional area
- ✅ **Search & Discovery** - Easy API exploration
- ✅ **Error Handling** - Detailed error messages and responses

## Installation

```bash
cd /home/rabin/projects/pmo/apps/mcp-server

# Install dependencies
pnpm install

# Build TypeScript
pnpm run build

# Run in development mode
pnpm run dev

# Run production build
pnpm start
```

## Configuration

Create a `.env` file (use `.env.example` as template):

```bash
# Local development
PMO_API_URL=http://localhost:4000
PMO_API_EMAIL=james.miller@huronhome.ca
PMO_API_PASSWORD=password123

# Production
# PMO_API_URL=http://100.26.224.246:4000
```

## MCP Client Configuration

### Claude Desktop

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

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

### Other MCP Clients

The server uses stdio transport and can be integrated with any MCP-compatible client:

```bash
node /home/rabin/projects/pmo/apps/mcp-server/dist/index.js
```

## Usage Examples

### API Information

```typescript
// Get API overview
pmo_api_info()

// Get endpoints by category
pmo_api_info({ category: "Project" })
pmo_api_info({ category: "Task" })
pmo_api_info({ category: "Authentication" })
```

### Authentication

```typescript
// Authenticate (uses env vars by default)
pmo_authenticate({
  email: "james.miller@huronhome.ca",
  password: "password123"
})
```

### Project Operations

```typescript
// List projects
project_list({
  active: "true",
  search: "renovation",
  limit: "10"
})

// Get project by ID
project_get({
  id: "project-uuid-here"
})

// Create project
project_create({
  body: JSON.stringify({
    name: "Kitchen Renovation",
    code: "PROJ-2025-001",
    descr: "Complete kitchen renovation project",
    dl__project_stage: "planning",
    budget_allocated_amt: 50000,
    planned_start_date: "2025-01-15",
    manager_employee_id: "employee-uuid"
  })
})

// Update project
project_update({
  id: "project-uuid",
  body: JSON.stringify({
    dl__project_stage: "in_progress",
    actual_start_date: "2025-01-15"
  })
})

// Get project child entities
project_get_child_tabs({ id: "project-uuid" })
project_get_tasks({ id: "project-uuid", limit: "20" })
project_get_wiki({ id: "project-uuid" })
```

### Task Operations

```typescript
// List tasks
task_list({
  project_id: "project-uuid",
  dl__task_stage: "in_progress",
  search: "plumbing",
  limit: "20"
})

// Get task
task_get({ id: "task-uuid" })

// Create task
task_create({
  body: JSON.stringify({
    name: "Install new fixtures",
    code: "TASK-001",
    dl__task_stage: "backlog",
    dl__task_priority: "high",
    estimated_hours: 8,
    metadata: {
      project_id: "project-uuid"
    }
  })
})

// Update task status (Kanban)
task_update_status({
  id: "task-uuid",
  body: JSON.stringify({
    task_status: "in_progress",
    position: 0
  })
})

// Get Kanban view
task_get_kanban({
  projectId: "project-uuid"
})

// Add case note
task_add_case_note({
  taskId: "task-uuid",
  body: JSON.stringify({
    content: "Completed plumbing inspection",
    content_type: "case_note"
  })
})

// Get task activity
task_get_activity({ taskId: "task-uuid" })
```

### Employee & Customer

```typescript
// List employees
employee_list({ limit: "50" })

// Get employee
employee_get({ id: "employee-uuid" })

// List customers
customer_list({ search: "Smith" })

// Get customer
customer_get({ id: "customer-uuid" })
```

### Business & Office

```typescript
// List businesses
business_list()

// Get business
business_get({ id: "business-uuid" })

// List offices
office_list()

// Get office
office_get({ id: "office-uuid" })
```

### Linkage (Entity Relationships)

```typescript
// Create linkage (link task to project)
linkage_create({
  body: JSON.stringify({
    parent_entity_type: "project",
    parent_entity_id: "project-uuid",
    child_entity_type: "task",
    child_entity_id: "task-uuid",
    relationship_type: "belongs_to"
  })
})

// List linkages
linkage_list({
  parent_entity_type: "project",
  parent_entity_id: "project-uuid"
})

// Delete linkage
linkage_delete({ id: "linkage-uuid" })
```

### RBAC & Permissions

```typescript
// Check permission
rbac_check_permission({
  entity_type: "project",
  entity_id: "project-uuid",
  action: "edit"
})

// List user permissions
rbac_list_permissions()

// Get user profile
auth_get_profile()

// Get user permissions summary
auth_get_permissions()
```

### Settings & Options

```typescript
// Get settings
setting_list({ category: "project_stage" })

// Get entity options (for dropdowns)
entity_options_get({ type: "employee" })
entity_options_get({ type: "project" })
```

### File Upload

```typescript
// Get presigned URL
s3_get_presigned_url({
  body: JSON.stringify({
    filename: "blueprint.pdf",
    content_type: "application/pdf",
    entity_type: "project",
    entity_id: "project-uuid"
  })
})

// List attachments
s3_list_attachments({
  entity_type: "project",
  entity_id: "project-uuid"
})
```

## API Manifest

The complete API manifest is defined in `src/api-manifest.ts` with 100+ endpoints including:

### Categories
- Authentication (10 endpoints)
- Project (10 endpoints)
- Task (15 endpoints)
- Employee (5 endpoints)
- Business (5 endpoints)
- Office (5 endpoints)
- Customer (5 endpoints)
- Worksite (5 endpoints)
- Role (5 endpoints)
- Position (5 endpoints)
- Wiki (5 endpoints)
- Form (5 endpoints)
- Artifact (5 endpoints)
- Reports (5 endpoints)
- Product & Services (4 endpoints)
- Sales (2 endpoints)
- Operations (2 endpoints)
- Inventory (1 endpoint)
- Order (1 endpoint)
- Shipment (1 endpoint)
- Financial (3 endpoints)
- Settings (1 endpoint)
- Linkage (3 endpoints)
- RBAC (2 endpoints)
- Entity (1 endpoint)
- Upload (1 endpoint)
- S3 (2 endpoints)
- Workflow (2 endpoints)
- Email (1 endpoint)
- Chat (2 endpoints)
- Booking (3 endpoints)
- System (2 endpoints)

## Development

```bash
# Watch mode for development
pnpm run watch

# Build only
pnpm run build

# Run tests (TODO)
pnpm test
```

## Architecture

```
apps/mcp-server/
├── src/
│   ├── index.ts           # Main MCP server implementation
│   └── api-manifest.ts    # Complete API endpoint registry
├── dist/                  # Compiled JavaScript
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Troubleshooting

### Authentication Issues

```bash
# Test authentication manually
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"james.miller@huronhome.ca","password":"password123"}'
```

### Connection Issues

Ensure the PMO API is running:

```bash
# Check API health
curl http://localhost:4000/api/health

# Start API if needed
cd /home/rabin/projects/pmo
./tools/start-all.sh
```

### MCP Server Logs

The server logs to stderr:

```bash
# Run with verbose logging
node dist/index.js 2>&1 | tee mcp-server.log
```

## Integration with PMO Platform

This MCP server provides a bridge between AI models and the PMO platform:

```
AI Model (Claude) <-> MCP Client <-> MCP Server <-> PMO API <-> PostgreSQL
```

### Key Integration Points

1. **Authentication**: Automatic JWT token management
2. **RBAC**: Respects platform permissions
3. **Entity System**: Full access to universal entity operations
4. **Linkage**: Create and manage entity relationships
5. **Settings**: Access to all dropdown/select options
6. **File Upload**: Presigned URL generation for S3/MinIO

## Related Documentation

- [PMO Platform Overview](../../CLAUDE.md)
- [API Architecture](../../docs/ui_ux_route_api.md)
- [Entity System](../../docs/entity_design_pattern/universal_entity_system.md)
- [Data Model](../../docs/datamodel.md)
- [API Testing Tools](../../tools/README.md)

## License

MIT - See main project LICENSE file

## Support

For issues or questions:
1. Check [tools/test-api.sh](../../tools/test-api.sh) for API testing
2. Review [API documentation](http://localhost:4000/docs)
3. Check main project [CLAUDE.md](../../CLAUDE.md)
