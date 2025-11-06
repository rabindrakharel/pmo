# API Pagination Migration Plan

## Goal
Apply mandatory DRY pagination to ALL list endpoints across the API.

## Pagination Utility
**Location:** `/apps/api/src/lib/pagination.ts`

**Functions:**
- `getPaginationParams(query)` - Extracts page/limit/offset
- `paginateQuery(dataQuery, countQuery, page, limit)` - Executes parallel queries

**Standards:**
- Default: page=1, limit=20
- Max limit: 100
- Response: `{ data, total, page, limit, totalPages }`
- **NO FALLBACK** - Pagination is mandatory

## Migration Status

### ✅ Completed (3 modules)
- [x] person-calendar - `/api/v1/person-calendar`
- [x] event - `/api/v1/event`
- [x] booking - `/api/v1/booking`

### 🔄 In Progress (Core Entities - 5 modules)
- [ ] task - `/api/v1/task`
- [ ] project - `/api/v1/project`
- [ ] artifact - `/api/v1/artifact`
- [ ] wiki - `/api/v1/wiki`
- [ ] employee - `/api/v1/employee` (fix existing)

### 📋 Pending (Organizational - 6 modules)
- [ ] cust - `/api/v1/cust`
- [ ] office - `/api/v1/office`
- [ ] biz - `/api/v1/biz`
- [ ] position - `/api/v1/position`
- [ ] role - `/api/v1/role`
- [ ] worksite - `/api/v1/worksite`

### 📋 Pending (Operational - 6 modules)
- [ ] invoice - `/api/v1/invoice`
- [ ] quote - `/api/v1/quote`
- [ ] order - `/api/v1/order`
- [ ] work_order - `/api/v1/work-order`
- [ ] shipment - `/api/v1/shipment`
- [ ] interaction - `/api/v1/interaction`

### 📋 Pending (Supporting - 5 modules)
- [ ] form - `/api/v1/form`
- [ ] reports - `/api/v1/reports`
- [ ] collab - `/api/v1/collab`
- [ ] product - `/api/v1/product`
- [ ] service - `/api/v1/service`

## Migration Pattern

### Before (Schema-driven)
```typescript
const employees = await db.execute(sql`
  SELECT * FROM app.d_employee
  WHERE active_flag = true
  LIMIT ${limit} OFFSET ${offset}
`);
return { data: employees, total, limit, offset };
```

### After (DRY Pagination)
```typescript
import { paginateQuery, getPaginationParams } from '../../lib/pagination.js';

const { page, limit, offset } = getPaginationParams(request.query);

const dataQuery = client`
  SELECT * FROM app.d_entity_person_calendar
  WHERE active_flag = true
  ORDER BY created_ts DESC
  LIMIT ${limit} OFFSET ${offset}
`;

const countQuery = client`
  SELECT COUNT(*) as total
  FROM app.d_entity_person_calendar
  WHERE active_flag = true
`;

const result = await paginateQuery(dataQuery, countQuery, page, limit);
reply.send(result);
```

## Key Changes
1. Import pagination utility at top of routes file
2. Use `getPaginationParams()` to extract pagination params
3. Build separate data and count queries
4. Call `paginateQuery()` with both queries
5. Return standardized response format
6. **Remove any fallback** to returning all records

## Testing Checklist
- [ ] Page 1 returns first 20 records
- [ ] Page 2 returns next 20 records
- [ ] Total count is accurate
- [ ] totalPages calculation is correct
- [ ] Limit parameter works (5, 10, 20, 50, 100)
- [ ] No records returned without pagination params (uses defaults)
