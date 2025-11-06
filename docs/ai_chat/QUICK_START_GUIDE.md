# Multi-Agent Orchestrator - Quick Start Guide

**Get started with the orchestrator framework in 5 minutes**

---

## Prerequisites

1. **Running PMO Platform:**
   ```bash
   ./tools/start-all.sh
   ```

2. **Database with Orchestrator Tables:**
   ```bash
   ./tools/db-import.sh
   ```

3. **Valid Auth Token:**
   ```bash
   # Login to get token
   TOKEN=$(curl -X POST http://localhost:4000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"james.miller@huronhome.ca","password":"password123"}' \
     | jq -r '.token')
   ```

---

## Quick Test: Calendar Booking

### 1. Start a New Booking Session

```bash
curl -X POST http://localhost:4000/api/v1/chat/orchestrator/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I need to schedule a landscaping service"
  }' | jq
```

**Expected Response:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "response": "Can I get your name and phone number?",
  "intent": "CalendarBooking",
  "currentNode": "identify_customer",
  "requiresUserInput": true,
  "agentLogs": [
    {"agent": "authenticator", "action": "authenticate", "success": true},
    {"agent": "critic", "action": "review_conversation", "success": true},
    {"agent": "worker", "action": "execute_collect_data", "success": true}
  ]
}
```

### 2. Provide Customer Information

```bash
# Save session ID from previous response
SESSION_ID="550e8400-e29b-41d4-a716-446655440000"

curl -X POST http://localhost:4000/api/v1/chat/orchestrator/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"session_id\": \"$SESSION_ID\",
    \"message\": \"I'm Sarah Johnson, my phone is 416-555-9876\"
  }" | jq
```

**Expected Response:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "response": "Thanks Sarah! Let me get you set up in our system. What's the service address?",
  "intent": "CalendarBooking",
  "currentNode": "create_customer",
  "requiresUserInput": true
}
```

### 3. Provide Address

```bash
curl -X POST http://localhost:4000/api/v1/chat/orchestrator/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"session_id\": \"$SESSION_ID\",
    \"message\": \"123 Maple Street, Toronto\"
  }" | jq
```

### 4. Specify Service Details

```bash
curl -X POST http://localhost:4000/api/v1/chat/orchestrator/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"session_id\": \"$SESSION_ID\",
    \"message\": \"I need lawn mowing and hedge trimming, preferably next week on Thursday\"
  }" | jq
```

### 5. Confirm Booking

```bash
curl -X POST http://localhost:4000/api/v1/chat/orchestrator/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"session_id\": \"$SESSION_ID\",
    \"message\": \"Yes, the morning slot works great!\"
  }" | jq
```

**Expected Final Response:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "response": "Perfect! You're all set, Sarah.\n\n📅 **Booking Confirmed**\n- **Service**: Landscaping\n- **Date**: 2025-11-14 at 09:00 AM\n- **Location**: 123 Maple Street, Toronto\n- **Booking #**: TASK-20251106-0042\n\nWe'll send a reminder to 416-555-9876. Is there anything else you need help with?",
  "intent": "CalendarBooking",
  "currentNode": "confirm_and_summarize",
  "completed": true
}
```

---

## Checking Session Status

### View Complete Session State

```bash
curl -X GET http://localhost:4000/api/v1/chat/orchestrator/session/$SESSION_ID/status \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Response:**
```json
{
  "session": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "session_number": "ORCH-20251106-0001",
    "current_intent": "CalendarBooking",
    "current_node": "confirm_and_summarize",
    "status": "completed",
    "session_context": {
      "customer_id": "abc-123",
      "task_id": "def-456",
      "task_code": "TASK-20251106-0042"
    },
    "total_agent_calls": 25,
    "total_mcp_calls": 5
  },
  "state": {
    "customer_id": "abc-123",
    "customer_name": "Sarah Johnson",
    "customer_phone": "4165559876",
    "customer_address": "123 Maple Street",
    "customer_city": "Toronto",
    "service_category": "Landscaping",
    "desired_date": "2025-11-14",
    "selected_time": "09:00",
    "job_description": "Lawn mowing and hedge trimming",
    "task_id": "def-456",
    "task_code": "TASK-20251106-0042"
  },
  "logs": [
    {
      "agent_role": "authenticator",
      "agent_action": "authenticate",
      "success": true,
      "created_ts": "2025-11-06T10:00:00Z"
    },
    {
      "agent_role": "worker",
      "agent_action": "mcp_call",
      "mcp_tool_name": "customer_create",
      "success": true,
      "created_ts": "2025-11-06T10:01:15Z"
    },
    {
      "agent_role": "worker",
      "agent_action": "mcp_call",
      "mcp_tool_name": "task_create",
      "success": true,
      "created_ts": "2025-11-06T10:05:32Z"
    }
  ]
}
```

---

## Testing Boundary Enforcement

### Test 1: Off-Topic Request

```bash
curl -X POST http://localhost:4000/api/v1/chat/orchestrator/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What'\''s the weather like tomorrow?"
  }' | jq
```

**Expected Response:**
```json
{
  "sessionId": "...",
  "response": "I'm specifically here to help with service bookings. Can I help you schedule an appointment?",
  "intent": "CalendarBooking",
  "currentNode": "identify_customer"
}
```

### Test 2: Missing Authentication

```bash
curl -X POST http://localhost:4000/api/v1/chat/orchestrator/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I need landscaping service"
  }' | jq
```

**Expected Response:**
```json
{
  "sessionId": "...",
  "response": "Welcome! You are accessing as a guest.",
  "intent": "CalendarBooking",
  "currentNode": "identify_customer",
  "requiresUserInput": true
}
```

### Test 3: Incomplete Information

```bash
curl -X POST http://localhost:4000/api/v1/chat/orchestrator/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"session_id\": \"$SESSION_ID\",
    \"message\": \"Book me for next week\"
  }" | jq
```

**Expected Response:**
```json
{
  "sessionId": "...",
  "response": "I still need some information to continue. Can you provide: service_category, job_description?",
  "intent": "CalendarBooking",
  "currentNode": "gather_booking_requirements",
  "requiresUserInput": true
}
```

---

## Available Intents

### List All Intents

```bash
curl -X GET http://localhost:4000/api/v1/chat/orchestrator/intents \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Response:**
```json
{
  "count": 1,
  "intents": [
    {
      "name": "CalendarBooking",
      "description": "Book a service appointment (landscaping, HVAC, plumbing, etc.)",
      "version": "v1.0",
      "requiredPermissions": ["customer:read", "customer:write", "booking:write", "employee:read"]
    }
  ]
}
```

### View Intent Graph

```bash
curl -X GET http://localhost:4000/api/v1/chat/orchestrator/intent/CalendarBooking/graph \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Response:**
```json
{
  "graph": {
    "name": "CalendarBooking",
    "description": "Book a service appointment",
    "version": "v1.0",
    "startNode": "identify_customer",
    "nodes": [
      {
        "id": "identify_customer",
        "name": "Identify Customer",
        "description": "Search for existing customer or identify as new customer",
        "agentRoles": ["worker"],
        "requiredState": [],
        "producesState": ["customer_id", "customer_name", "is_new_customer"],
        "transitionsTo": ["welcome_existing", "create_customer"]
      }
    ],
    "boundaries": {
      "allowedTopics": ["booking", "scheduling", "appointments", "landscaping"],
      "forbiddenTopics": ["weather", "news", "general knowledge"]
    }
  }
}
```

---

## Debugging Tips

### 1. Check Agent Logs

```bash
# View logs for specific session
curl -X GET http://localhost:4000/api/v1/chat/orchestrator/session/$SESSION_ID/status \
  -H "Authorization: Bearer $TOKEN" | jq '.logs'
```

### 2. View Database State Directly

```sql
-- Check session
SELECT * FROM app.orchestrator_session WHERE id = 'session-id';

-- Check state variables
SELECT key, value FROM app.orchestrator_state WHERE session_id = 'session-id';

-- Check agent logs
SELECT agent_role, agent_action, success, natural_response
FROM app.orchestrator_agent_log
WHERE session_id = 'session-id'
ORDER BY created_ts;
```

### 3. Monitor API Logs

```bash
# Watch orchestrator activity in real-time
./tools/logs-api.sh | grep -E "(🎯|🔧|✅|❌|🔐)"
```

**Log Symbols:**
- 🎯 Orchestrator executing node
- 🔧 Worker executing MCP tool
- ✅ Success
- ❌ Failure
- 🔐 Authentication

---

## Common Issues

### Issue: "Session not found"

**Solution:**
- Ensure you're using the `sessionId` from the first response
- Sessions expire after 24 hours of inactivity

### Issue: "Invalid or expired token"

**Solution:**
```bash
# Re-authenticate
TOKEN=$(curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"james.miller@huronhome.ca","password":"password123"}' \
  | jq -r '.token')
```

### Issue: "MCP tool call failed"

**Solution:**
- Check that the required MCP tool is available
- Verify user has necessary permissions
- Review `orchestrator_agent_log` for error details

---

## Next Steps

1. **Create Custom Intents:** See `MULTI_AGENT_ORCHESTRATOR.md` Section 7
2. **Integrate with Frontend:** Use WebSocket or polling for real-time updates
3. **Add More Agents:** Create specialized agents for complex tasks
4. **Implement LLM-based Intent Detection:** Replace keyword matching with semantic understanding

---

**Ready to start?** Run the first curl command above and follow the conversation!
