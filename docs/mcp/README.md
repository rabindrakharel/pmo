# PMO MCP API Documentation

> **Complete OpenAPI 3.1.0 Compliant Documentation for the PMO Model Context Protocol**

**Version:** 4.0.0
**Last Updated:** 2025-11-12
**Standards:** OpenAPI 3.1.0, REST API, JWT Authentication

---

## 📚 Documentation Index

### Core Documentation

| Document | Purpose | Use When |
|----------|---------|----------|
| **[MCP_API_SPECIFICATION.md](./MCP_API_SPECIFICATION.md)** | Complete API reference with examples | Understanding API endpoints, request/response formats, authentication |
| **[openapi.yaml](./openapi.yaml)** | Machine-readable OpenAPI 3.1.0 spec | Generating client SDKs, API documentation, testing tools |

### Client SDKs

| SDK | File | Language | Features |
|-----|------|----------|----------|
| **TypeScript** | [typescript-client.ts](./sdk/typescript-client.ts) | TypeScript/JavaScript | Full type safety, async/await, retry logic, error handling |
| **Python** | [python_client.py](./sdk/python_client.py) | Python 3.8+ | Pydantic models, type hints, auto-retry, custom exceptions |

### Testing & Tools

| Tool | File | Purpose |
|------|------|---------|
| **Postman Collection** | [postman_collection.json](./postman_collection.json) | Manual API testing, automated test flows |

### Archived Documentation

| Archive | Location | Description |
|---------|----------|-------------|
| **Old MCP Docs** | [archive/](./archive/) | Previous version documentation (reference only) |

---

## 🚀 Quick Start

### Option 1: Use Postman Collection (Recommended for Testing)

1. **Import Collection**
   ```bash
   # Open Postman → Import → Upload File
   # Select: docs/mcp/postman_collection.json
   ```

2. **Set Environment Variables**
   - `baseUrl`: `http://localhost:4000`
   - `email`: `james.miller@huronhome.ca`
   - `password`: `password123`

3. **Run Requests**
   - Start with "Authentication / Login"
   - Token auto-saves to `{{authToken}}`
   - Try "Complete Service Flow" for end-to-end test

### Option 2: Use TypeScript SDK (For Development)

```typescript
import { PMOMCPClient } from './sdk/typescript-client';

// Initialize client
const client = new PMOMCPClient({
  baseUrl: 'http://localhost:4000'
});

// Authenticate
await client.authenticate({
  email: 'james.miller@huronhome.ca',
  password: 'password123'
});

// Create customer
const customer = await client.createCustomer({
  name: 'John Doe',
  primary_phone: '+1 555 1234',
  city: 'Toronto'
});

// Create task (auto-enriched)
const task = await client.createTask({
  name: 'Fix plumbing leak',
  dl__task_stage: 'backlog',
  dl__task_priority: 'high'
});
```

### Option 3: Use Python SDK (For AI/ML Integration)

```python
from sdk.python_client import PMOMCPClient

# Initialize client
client = PMOMCPClient(base_url='http://localhost:4000')

# Authenticate
auth = client.authenticate(
    email='james.miller@huronhome.ca',
    password='password123'
)

# Create customer
customer = client.create_customer(
    name='John Doe',
    primary_phone='+1 555 1234',
    city='Toronto'
)

# Create task (auto-enriched)
task = client.create_task(
    name='Fix plumbing leak',
    dl__task_stage='backlog',
    dl__task_priority='high'
)
```

---

## 📖 API Overview

### Authentication

**Endpoint:** `POST /api/v1/auth/login`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 86400,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**Usage in Subsequent Requests:**
```http
Authorization: Bearer {token}
```

### API Categories

| Category | Endpoints | Operations |
|----------|-----------|------------|
| **Authentication** | 5 | Login, profile, permissions |
| **Customer** | 6 | CRUD, search by phone |
| **Task** | 15 | CRUD, Kanban, case notes, activity |
| **Project** | 12 | CRUD, child entities, financials |
| **Calendar** | 5 | Book, search, cancel appointments |
| **Employee** | 5 | CRUD, assignments |
| **Financial** | 8 | Cost, revenue, invoices |
| **Linkage** | 3 | Create/manage entity relationships |
| **Settings** | 1 | System configuration |
| **RBAC** | 2 | Permission checks |

**Total:** 100+ endpoints

---

## 🔧 Auto-Enrichment Feature

MCP automatically enriches certain API calls with session context:

### 1. Task Creation
**What you send:**
```json
{
  "name": "Fix plumbing leak",
  "dl__task_stage": "backlog"
}
```

**What MCP enriches:**
```json
{
  "name": "Fix plumbing leak",
  "descr": "## Customer Information\n- Name: John Doe\n- Phone: +1 555 1234\n- Address: 123 Main St\n\n## Service Request\n- Issue: Plumbing leak\n\n## Conversation History\n...",
  "dl__task_stage": "backlog",
  "metadata": {
    "customer_id": "cust-uuid",
    "session_id": "session-uuid"
  }
}
```

### 2. Calendar Booking
**What you send:**
```json
{
  "slot_ids": ["slot-uuid"],
  "title": "Service Appointment"
}
```

**What MCP enriches:**
```json
{
  "slot_ids": ["slot-uuid"],
  "title": "Service Appointment",
  "instructions": "Task ID: task-uuid\nCustomer: John Doe\nPhone: +1 555 1234",
  "metadata": {
    "attendees": [
      {"name": "John Doe", "phone": "+1 555 1234", "type": "customer"},
      {"name": "Jane Tech", "email": "jane@example.com", "type": "employee"}
    ],
    "task_id": "task-uuid"
  }
}
```

---

## 🛠️ Client SDK Features

### TypeScript SDK

**Features:**
- ✅ Full TypeScript type safety
- ✅ Async/await with promises
- ✅ Automatic retry with exponential backoff
- ✅ Custom error classes (PMOAPIError)
- ✅ Built-in authentication management
- ✅ Pagination helpers
- ✅ AbortSignal timeout support

**Installation:**
```bash
# Copy to your project
cp docs/mcp/sdk/typescript-client.ts src/lib/

# No additional dependencies required (uses native fetch)
```

**Example:**
```typescript
try {
  const customer = await client.createCustomer({
    name: 'John Doe',
    primary_phone: '+1 555 1234'
  });
} catch (error) {
  if (error instanceof PMOAPIError) {
    console.error(`Error ${error.code}:`, error.message);
    console.error('Details:', error.details);
  }
}
```

### Python SDK

**Features:**
- ✅ Pydantic models for type validation
- ✅ Type hints for IDE autocomplete
- ✅ Custom exception hierarchy
- ✅ Automatic retry logic
- ✅ Session persistence with requests
- ✅ Built-in authentication management

**Installation:**
```bash
pip install requests pydantic

# Copy to your project
cp docs/mcp/sdk/python_client.py app/lib/
```

**Example:**
```python
try:
    customer = client.create_customer(
        name='John Doe',
        primary_phone='+1 555 1234'
    )
except NotFoundError as e:
    print(f"Not found: {e.message}")
except PMOAPIError as e:
    print(f"API Error [{e.code}]: {e.message}")
```

---

## 🧪 Testing Workflows

### 1. Complete Service Flow

**Scenario:** Customer calls for backyard assistance

```
1. Authenticate
   POST /auth/login → Get JWT token

2. Search for Customer
   GET /cust?query_primary_phone=+15559998888
   → Returns empty if new customer

3. Create Customer
   POST /cust
   → Creates profile with address

4. Create Task (Auto-Enriched)
   POST /task
   → MCP enriches with customer data

5. Book Appointment (Auto-Enriched)
   POST /person-calendar/book
   → MCP enriches with task + attendees

✅ Complete flow creates: Customer → Task → Calendar Booking
```

**Run in Postman:**
- Navigate to "Complete Service Flow" folder
- Click "Run Collection"
- Watch automated test flow execute

### 2. Kanban Board Update

```
1. Get Kanban Board
   GET /task/kanban

2. Move Task to "In Progress"
   PATCH /task/{id}/status
   Body: { "task_status": "in_progress", "position": 0 }

3. Add Case Note
   POST /task/{id}/case-note
   Body: { "content": "Started work on task" }
```

### 3. Entity Linkage

```
1. Create Project
   POST /project

2. Create Task
   POST /task

3. Link Task to Project
   POST /entity-linkage
   Body: {
     "parent_entity_type": "project",
     "parent_entity_id": "{project_id}",
     "child_entity_type": "task",
     "child_entity_id": "{task_id}"
   }
```

---

## 📊 Error Handling

### Standard Error Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "primary_phone",
      "reason": "Invalid phone format"
    }
  },
  "statusCode": 400,
  "timestamp": "2025-11-12T10:30:00Z"
}
```

### HTTP Status Codes

| Code | Error Type | Description |
|------|-----------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created |
| 204 | No Content | Successful deletion |
| 400 | Bad Request | Invalid parameters |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Duplicate resource |
| 422 | Validation Error | Request validation failed |
| 500 | Internal Server Error | Server error |

### Client Error Handling

**TypeScript:**
```typescript
try {
  await client.getCustomer('invalid-id');
} catch (error) {
  if (error instanceof PMOAPIError) {
    switch (error.statusCode) {
      case 404:
        console.log('Customer not found');
        break;
      case 401:
        console.log('Re-authenticating...');
        await client.authenticate(credentials);
        break;
      default:
        console.error('API Error:', error.message);
    }
  }
}
```

**Python:**
```python
try:
    client.get_customer('invalid-id')
except NotFoundError:
    print('Customer not found')
except AuthenticationError:
    print('Re-authenticating...')
    client.authenticate(email, password)
except PMOAPIError as e:
    print(f'API Error: {e.message}')
```

---

## 🔐 Security Best Practices

### 1. Token Management

**✅ DO:**
- Store tokens securely (environment variables, secure storage)
- Refresh tokens before expiry
- Implement automatic re-authentication on 401 errors
- Clear tokens on logout

**❌ DON'T:**
- Commit tokens to version control
- Store tokens in localStorage (XSS vulnerability)
- Share tokens between users
- Use expired tokens

### 2. API Key Security

**For Production:**
```bash
# Use environment variables
export PMO_API_URL=https://api.production.com
export PMO_API_EMAIL=service-account@example.com
export PMO_API_PASSWORD=secure-password
```

### 3. Rate Limiting

- Maximum: 100 requests/minute per user
- Burst limit: 20 requests/second
- Implement exponential backoff on rate limit errors

---

## 🚀 Deployment & Integration

### Generate Client SDKs from OpenAPI

```bash
# Using OpenAPI Generator
npm install -g @openapitools/openapi-generator-cli

# Generate TypeScript client
openapi-generator-cli generate \
  -i docs/mcp/openapi.yaml \
  -g typescript-fetch \
  -o generated/typescript-client

# Generate Python client
openapi-generator-cli generate \
  -i docs/mcp/openapi.yaml \
  -g python \
  -o generated/python-client
```

### Swagger UI Setup

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/docs/mcp/openapi.yaml',
      dom_id: '#swagger-ui'
    });
  </script>
</body>
</html>
```

### API Documentation Hosting

```bash
# Using Redoc
npx @redocly/cli build-docs docs/mcp/openapi.yaml \
  -o public/api-docs.html

# Using Stoplight Elements
npx @stoplight/elements-cli build docs/mcp/openapi.yaml \
  -o public/api-docs
```

---

## 📈 Performance & Optimization

### Response Times

| Operation Type | Avg Latency | Token Usage | Cost |
|----------------|-------------|-------------|------|
| Authentication | ~100ms | - | - |
| Simple GET | ~150ms | 500-1000 | $0.0001 |
| POST/PUT | ~200ms | 800-1500 | $0.0002 |
| Complex JOIN | ~300ms | 1500-3000 | $0.0004 |
| Auto-enriched | ~400ms | 2000-4000 | $0.0006 |

### Optimization Tips

**1. Caching**
```typescript
// Cache authentication token
const tokenCache = {
  token: null,
  expiry: null,
  isValid() {
    return this.token && this.expiry > Date.now();
  }
};

// Cache settings/options data
const settingsCache = new Map();
```

**2. Pagination**
```typescript
// Fetch all customers efficiently
async function getAllCustomers() {
  let allCustomers = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await client.listCustomers({ page, limit: 100 });
    allCustomers.push(...response.results);
    hasMore = response.pagination.hasMore;
    page++;

    // Respect rate limits
    await sleep(100);
  }

  return allCustomers;
}
```

**3. Batch Operations**
```typescript
// Good: Parallel requests
const [customers, tasks, employees] = await Promise.all([
  client.listCustomers(),
  client.listTasks(),
  client.listEmployees()
]);

// Bad: Sequential requests
const customers = await client.listCustomers();
const tasks = await client.listTasks();
const employees = await client.listEmployees();
```

---

## 🆘 Troubleshooting

### Common Issues

**1. 401 Unauthorized**
```
Problem: Authentication failed
Solution: Check email/password, verify token not expired
```

**2. 403 Forbidden**
```
Problem: Insufficient permissions
Solution: Check RBAC permissions for entity/action
```

**3. 422 Validation Error**
```
Problem: Invalid request body
Solution: Check required fields, data types, format
```

**4. Connection Timeout**
```
Problem: API not responding
Solution: Verify API is running, check baseUrl, firewall rules
```

### Debug Mode

**TypeScript:**
```typescript
const client = new PMOMCPClient({
  baseUrl: 'http://localhost:4000',
  timeout: 60000  // Increase timeout for debugging
});

// Enable detailed logging
client.on('request', (req) => console.log('Request:', req));
client.on('response', (res) => console.log('Response:', res));
```

**Python:**
```python
import logging
logging.basicConfig(level=logging.DEBUG)

client = PMOMCPClient(
    base_url='http://localhost:4000',
    timeout=60  # Increase timeout
)
```

---

## 📝 Migration Guide

### From Old MCP Docs to v4.0

**What Changed:**
- ✅ Full OpenAPI 3.1.0 compliance
- ✅ Standardized error responses
- ✅ Machine-readable YAML specification
- ✅ Type-safe client SDKs
- ✅ Comprehensive request/response examples
- ✅ Postman collection for testing

**Breaking Changes:**
- None - API endpoints remain backward compatible

**Upgrade Steps:**
1. Review new OpenAPI specification
2. Replace old client code with SDK
3. Update error handling to use standard format
4. Import Postman collection for testing
5. Generate documentation from openapi.yaml

---

## 🤝 Contributing

### Adding New Endpoints

**1. Update OpenAPI Specification**
```yaml
# docs/mcp/openapi.yaml
paths:
  /api/v1/new-endpoint:
    post:
      operationId: new_operation
      summary: Description
      tags:
        - Category
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/NewSchema'
      responses:
        '201':
          description: Created
```

**2. Update Client SDKs**
- TypeScript: Add method to `PMOMCPClient` class
- Python: Add method to `PMOMCPClient` class

**3. Update Postman Collection**
- Add new request to appropriate folder
- Include test scripts for validation

**4. Update Documentation**
- Add examples to MCP_API_SPECIFICATION.md
- Update README.md if new category

---

## 📚 Additional Resources

### Documentation
- [Complete API Specification](./MCP_API_SPECIFICATION.md)
- [OpenAPI YAML](./openapi.yaml)
- [PMO Platform Overview](../../CLAUDE.md)
- [Entity System Guide](../entity_design_pattern/universal_entity_system.md)

### Tools
- [Swagger Editor](https://editor.swagger.io/) - Edit OpenAPI specs
- [Postman](https://www.postman.com/) - API testing
- [OpenAPI Generator](https://openapi-generator.tech/) - Client SDK generation
- [Redoc](https://redocly.com/) - API documentation

### Support
- Report issues: [GitHub Issues](https://github.com/yourusername/pmo/issues)
- Email: support@huronhome.ca

---

## 📄 License

MIT License - See main project LICENSE file

---

**Last Updated:** 2025-11-12
**Version:** 4.0.0
**Maintained By:** PMO Platform Team
