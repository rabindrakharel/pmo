# Chat System Test Scripts

## Overview

This directory contains test scripts and mock data for testing the agent-based chat orchestrator system.

## Test Scripts

### 1. `test-chat-system.sh` - Automated Test Suite

Runs a comprehensive suite of automated tests covering:
- Basic conversation flow (greeting → issue identification → data gathering)
- Intent change handling (customer changes their mind)
- Data update requests (customer updates phone number)
- Complete conversation flow with goodbye

**Usage:**
```bash
# Use default localhost
./tools/test-chat-system.sh

# Test against specific API URL
API_URL=http://100.26.224.246:4000 ./tools/test-chat-system.sh

# Use different credentials
API_TEST_EMAIL=user@example.com API_TEST_PASSWORD=pass123 ./tools/test-chat-system.sh
```

**Example Output:**
```
🔐 Logging in as james.miller@huronhome.ca...
✅ Logged in successfully

═══════════════════════════════════════════════
Test 1: Basic Conversation - Lawn Care Issue
═══════════════════════════════════════════════

Step 1: Initial connection (expecting greeting)
Session ID: abc-123-def-456
Agent: Hello! Welcome to Huron Home Services. How can I help you today?
Current Node: GREET_CUSTOMER

Step 2: User states issue (lawn care)
Agent: I understand you're having trouble with your lawn. Let me help you with that.
Current Node: Identify_Issue

...
```

### 2. `test-chat-interactive.sh` - Interactive Chat

Manual testing interface for real-time conversation testing.

**Usage:**
```bash
./tools/test-chat-interactive.sh
```

**Example Session:**
```
🤖 Interactive Chat Test

Logging in...
✅ Logged in

Starting new conversation...
Session: abc-123-def-456
[GREET_CUSTOMER]
Agent: Hello! How can I assist you today?

You: I need help with my plumbing

[Identify_Issue]
Agent: I understand you have a plumbing issue. Can you tell me more about it?

You: My sink is leaking

[Empathize]
Agent: I'm sorry to hear about your leaking sink. Let me help you with that...

You: exit
Goodbye!
```

## Mock Data

### `mock-conversation-data.json`

Comprehensive mock conversation scenarios for testing:

**Test Scenarios:**
1. **Happy Path - Lawn Care Service**: Complete successful flow
2. **Intent Change - Lawn to Plumbing**: Customer changes their request mid-conversation
3. **Data Update Request**: Customer updates phone number
4. **No Consent - Plan Rejected**: Customer rejects proposed plan
5. **Multiple Issues - Another Request**: Customer has multiple issues
6. **Conversation End - Goodbye**: Natural conversation termination
7. **MCP Tool Execution - Service Catalog**: Tests MCP tool selection for fetching services
8. **MCP Tool Execution - Task Creation**: Tests MCP tool selection for creating tasks

**Edge Cases Covered:**
- Empty messages
- Very long messages
- Multiple pieces of info at once
- Unclear intent
- Offensive language

**Validation Checks:**
- Mandatory fields collection (customers_main_ask, customer_phone_number)
- Flag progression tracking
- Node sequence validation

## Test Architecture

The chat system uses a 2-agent architecture:

```
┌────────────────────────────────────┐
│     Agent Orchestrator             │
│  (Coordinates conversation flow)   │
└────────────────────────────────────┘
              │
      ┌───────┴────────┐
      │                │
 ┌─────────┐    ┌──────────┐
 │ Worker  │    │Navigator │
 │ Agent   │    │  Agent   │
 └─────────┘    └──────────┘
      │              │
      ├─ Executes    ├─ Validates + Routes
      │  nodes       │  (unified LLM call)
      ├─ Uses MCP    ├─ Pure LLM decisions
      │  tools       │  (no keywords)
      └─ Prompt      └─ Lightweight
         engineering    (minimal context)
```

## API Endpoints

The tests interact with these endpoints:

- `POST /api/v1/auth/login` - Authenticate and get JWT token
- `POST /api/v1/chat/orchestrator/message` - Send message to orchestrator
  - Body: `{"sessionId": "...", "message": "..."}`
  - Response: `{"sessionId": "...", "response": "...", "currentNode": "...", "conversationEnded": false}`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_URL` | `http://localhost:4000` | API base URL |
| `API_TEST_EMAIL` | `james.miller@huronhome.ca` | Test user email |
| `API_TEST_PASSWORD` | `password123` | Test user password |

## Testing Checklist

When testing the chat system, verify:

### Conversation Flow
- [ ] Greeting node executes first
- [ ] Nodes execute in logical order
- [ ] Flags are set correctly after each node
- [ ] Context is updated with extracted info

### Intent Changes
- [ ] System detects intent changes via LLM (no keywords)
- [ ] Flags are reset appropriately
- [ ] Navigator routes back to Identify_Issue
- [ ] Previous context is cleared

### Data Updates
- [ ] System accepts data updates mid-conversation
- [ ] Data flags are reset when updated
- [ ] Navigator routes to Try_To_Gather_Customers_Data

### MCP Tool Execution
- [ ] Worker exposes all MCP tools to LLM
- [ ] LLM selects appropriate tool based on context
- [ ] Tool executes with correct parameters
- [ ] Context is updated with tool results

### Conversation Termination
- [ ] System detects goodbye intent
- [ ] Conversation ends gracefully
- [ ] conversationEnded flag is set

### Error Handling
- [ ] System handles empty messages
- [ ] System handles unclear intents
- [ ] System remains professional with difficult customers
- [ ] Errors are logged appropriately

## Example Test Run

```bash
# 1. Start services
./tools/start-all.sh

# 2. Wait for services to be ready
sleep 10

# 3. Run automated tests
./tools/test-chat-system.sh

# 4. If all pass, run interactive test for manual verification
./tools/test-chat-interactive.sh
```

## Troubleshooting

**Login fails:**
- Verify API is running: `curl http://localhost:4000/api/v1/health`
- Check credentials in environment variables

**No response from orchestrator:**
- Check API logs: `./tools/logs-api.sh`
- Verify dag.json is loaded correctly
- Check for errors in agent initialization

**MCP tools not executing:**
- Verify MCP adapter is initialized
- Check auth token is being passed
- Review api-manifest.ts for tool definitions

**Conversation doesn't progress:**
- Check Navigator agent logs for routing decisions
- Verify flags are being set in Worker agent
- Review context updates in state manager

## Adding New Tests

To add a new test scenario:

1. Add to `mock-conversation-data.json`:
```json
{
  "name": "New Test Scenario",
  "description": "Description of what this tests",
  "conversation": [
    {
      "turn": 1,
      "user": "User message",
      "expected_node": "NodeName",
      "expected_context": {
        "field": "value"
      }
    }
  ]
}
```

2. Add to `test-chat-system.sh`:
```bash
# Test Scenario N: Your Test Name
echo -e "${BLUE}Test N: Your Test Description${NC}"

RESPONSE=$(curl -s -X POST "${API_URL}/api/v1/chat/orchestrator/message" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"sessionId\": \"${SESSION_ID}\", \"message\": \"Your test message\"}")

# Verify response
CURRENT_NODE=$(echo "$RESPONSE" | jq -r '.currentNode')
if [ "$CURRENT_NODE" == "ExpectedNode" ]; then
  echo -e "${GREEN}✅ Test passed${NC}"
else
  echo -e "${RED}❌ Test failed${NC}"
fi
```

## Further Reading

- **Agent Architecture**: See `/apps/api/src/modules/chat/orchestrator/agents/README.md`
- **DAG Configuration**: See `/apps/api/src/modules/chat/orchestrator/dag.json`
- **MCP Tools**: See `/apps/mcp-server/src/api-manifest.ts`
