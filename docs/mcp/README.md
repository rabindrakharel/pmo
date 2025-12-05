# PMO MCP Documentation

> **Model Context Protocol (MCP) - API Reference & Next-Generation Architecture**

**Version:** 5.0.0
**Last Updated:** 2025-12-05
**Standards:** OpenAPI 3.1.0, MCP Protocol 2025-06

---

## Primary Documentation

| Document | Purpose |
|----------|---------|
| **[MCP_API_SPECIFICATION.md](./MCP_API_SPECIFICATION.md)** | Complete guide covering current API reference AND next-gen architecture |

---

## Quick Start

### Testing API Endpoints

```bash
# Authenticate
./tools/test-api.sh POST /api/v1/auth/login '{"email":"james.miller@huronhome.ca","password":"password123"}'

# List entities
./tools/test-api.sh GET /api/v1/project
./tools/test-api.sh GET /api/v1/task
./tools/test-api.sh GET /api/v1/customer
```

### Test Credentials
- **Email:** `james.miller@huronhome.ca`
- **Password:** `password123`

---

## Document Structure

The main specification document is organized into two parts:

### Part 1: Current API Reference
- Overview & Architecture
- Authentication (JWT)
- API Categories (Customer, Task, Project, Calendar, Financial, Linkage)
- Common Patterns (Pagination, Filtering, Sorting)
- Error Handling
- Request/Response Examples

### Part 2: Next-Generation Architecture
- Industry Landscape Analysis (MCP evolution, pioneers like Dynamics 365, ZenStack, ScaleMCP)
- Current vs Future Approaches
- Critical Problems (Tool Explosion, Permission Visibility)
- Dynamic Tool Generation from Entity Metadata
- Composite Tool Pattern (93% token reduction)
- Implementation Roadmap (4 phases)
- Production Considerations (Scaling, Security)

---

## Key Insights

### Why PMO is Uniquely Positioned for Next-Gen MCP

| Feature | PMO Advantage |
|---------|---------------|
| Entity Metadata | `app.entity` table already defines all 27+ entities |
| Field Detection | YAML pattern system generates rich field metadata |
| RBAC System | `entity_rbac` provides fine-grained permissions |
| Universal CRUD | Factory generates consistent endpoints |
| Real-time Sync | WebSocket PubSub ready for tool notifications |
| Redis Caching | Field name caching pattern directly applicable |

### Token Reduction Strategy

```
Current: 162 individual tools → 72K tokens (38.5% of context)
Future:  1 composite tool     → ~5K tokens (93% reduction)
```

---

## Additional Resources

### Client SDKs
- [TypeScript Client](./sdk/typescript-client.ts)
- [Python Client](./sdk/python_client.py)

### Testing Tools
- [Postman Collection](./postman_collection.json)

### Related Documentation
- [PMO Platform Overview](../../CLAUDE.md)
- [Entity System Guide](../entity_design_pattern/)
- [RBAC Infrastructure](../rbac/)

---

**Last Updated:** 2025-12-05
**Maintained By:** PMO Platform Team
