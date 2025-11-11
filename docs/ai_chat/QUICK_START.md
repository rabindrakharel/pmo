# AI Chat System - Quick Start Guide

> **Get the AI chat system running in 5 minutes** - Fast setup for developers and contributors

**Version:** 6.1.0
**Last Updated:** 2025-11-11
**Estimated Time:** 5-10 minutes

---

## 🎯 Prerequisites

Before starting, ensure you have:

- ✅ Node.js 18+ installed
- ✅ pnpm package manager
- ✅ Docker (for PostgreSQL)
- ✅ OpenAI API key
- ✅ Deepgram API key (for voice)
- ✅ ElevenLabs API key (for voice)

---

## ⚡ Quick Start (Text Chat Only)

### Step 1: Clone and Install

```bash
# Navigate to project root
cd /home/user/pmo

# Install dependencies
pnpm install
```

### Step 2: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your API keys
nano .env
```

**Required environment variables:**

```bash
# OpenAI (Required for text chat)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Optional for voice features
DEEPGRAM_API_KEY=your-deepgram-api-key-here
ELEVEN_LABS_API_KEY=your-elevenlabs-api-key-here
ELEVEN_LABS_VOICE_ID=nova
ELEVEN_LABS_MODEL_ID=eleven_flash_v2_5

# Database (uses existing PMO database)
DATABASE_URL=postgresql://app:app@localhost:5434/app

# Logging
VERBOSE_AGENT_LOGS=false
```

### Step 3: Start Services

```bash
# Start all services (Docker + API + Web)
./tools/start-all.sh
```

**Expected output:**
```
✅ Docker containers started
✅ PostgreSQL ready on port 5434
✅ API server running on http://localhost:4000
✅ Web app running on http://localhost:5173
```

### Step 4: Run Database Migrations

```bash
# Import AI chat tables (4 new tables)
./tools/db-import.sh
```

**Tables created:**
- `app.orchestrator_session` - Session state
- `app.orchestrator_state` - State key-value pairs
- `app.orchestrator_agent_log` - LLM call logs
- `app.orchestrator_summary` - Conversation summaries

### Step 5: Test AI Chat

**Option A: Via Web UI**

1. Open browser: http://localhost:5173/chat
2. Click "Start New Chat"
3. Type: "I need help with roof holes"
4. Observe streaming response

**Option B: Via API**

```bash
# Create session
SESSION_RESPONSE=$(curl -s -X POST http://localhost:4000/api/v1/chat/session/new \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test-user","name":"Test User","email":"test@example.com"}')

echo $SESSION_RESPONSE
# Output: {"session_id":"abc-123","greeting":"Hello! How can I help you today?"}

# Extract session ID
SESSION_ID=$(echo $SESSION_RESPONSE | jq -r '.session_id')

# Send message
curl -X POST http://localhost:4000/api/v1/chat/message \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SESSION_ID\",\"message\":\"I need help with roof holes\"}"
```

**Expected response:**
```json
{
  "response": "I understand you're dealing with roof holes - that must be concerning. I can help you with that. To get started, may I have your phone number?",
  "session_id": "abc-123",
  "current_goal": "ELICIT_STRUCTURED_INFO",
  "conversation_ended": false
}
```

### Step 6: Verify Session Memory

```bash
# Check session memory file
cat logs/contexts/session_memory_data.db.json | jq

# Should show:
{
  "sessions": {
    "abc-123": {
      "customer": {},
      "service": {
        "primary_request": "Roof hole repair"
      },
      "operations": {},
      "conversation_turn_count": 2,
      "node_path": ["WARM_GREETINGS_EMPATHY_UNDERSTAND", "ELICIT_STRUCTURED_INFO"]
    }
  }
}
```

**✅ Success!** You now have a working AI chat system.

---

## 🎙️ Enable Voice Chat (Optional)

### Step 1: Verify Voice API Keys

```bash
# Check .env has voice credentials
grep DEEPGRAM .env
grep ELEVEN_LABS .env
```

### Step 2: Test Voice API

**Option A: Via Web UI**

1. Open: http://localhost:5173/voice-chat
2. Click "Start Voice Call"
3. Allow microphone access
4. Speak: "I need help with roof holes"
5. Listen to AI response

**Option B: Via API (HTTP)**

```bash
# Record audio (use your microphone or test file)
# For testing, you can use a sample WebM file

curl -X POST http://localhost:4000/api/v1/chat/orchestrator/voice \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "audio=@test_audio.webm" \
  -F "voice=nova" \
  -F "session_id=$SESSION_ID" \
  --output response.mp3

# Play response
mpg123 response.mp3
```

**Option C: Via WebSocket**

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:4000/api/v1/chat/voice/call?token=JWT_TOKEN');

// Send audio chunks
ws.send(JSON.stringify({
  type: 'audio.append',
  audio: base64AudioData
}));

// Commit audio (trigger processing)
ws.send(JSON.stringify({
  type: 'audio.commit'
}));

// Receive audio response
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'audio.chunk') {
    playAudio(data.audio); // Base64 MP3
  }
};
```

---

## 🧪 Testing Guide

### Test Conversation Flow

**Test the complete 6-goal workflow:**

```bash
# Start session
SESSION_ID=$(curl -s -X POST http://localhost:4000/api/v1/chat/session/new \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test-user"}' | jq -r '.session_id')

# Goal 1: WARM_GREETINGS (understand request)
curl -s -X POST http://localhost:4000/api/v1/chat/message \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SESSION_ID\",\"message\":\"I need help with roof holes\"}" | jq

# Goal 2: ELICIT_STRUCTURED_INFO (collect contact info)
curl -s -X POST http://localhost:4000/api/v1/chat/message \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SESSION_ID\",\"message\":\"My phone is 647-646-7996\"}" | jq

# Goal 3: LOOKUP_UPDATE_CREATE_RECORDS (find/create customer)
curl -s -X POST http://localhost:4000/api/v1/chat/message \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SESSION_ID\",\"message\":\"My name is John Smith\"}" | jq

# Goal 4-6: DESIGN → EXECUTE → CONFIRM
curl -s -X POST http://localhost:4000/api/v1/chat/message \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SESSION_ID\",\"message\":\"Yes, please create a task\"}" | jq
```

### Monitor Agent Logs

```bash
# View all agent activity
./tools/logs-api.sh | grep "AgentOrchestrator"

# View goal transitions
./tools/logs-api.sh | grep "GoalTransitionEngine"

# View MCP tool calls
./tools/logs-api.sh | grep "MCPAdapter"

# View session memory updates
./tools/logs-api.sh | grep "SessionMemoryDataService"

# Follow logs in real-time
./tools/logs-api.sh -f | grep "Agent"
```

### Check Database State

```sql
-- View active sessions
SELECT session_id, current_node, status, created_ts
FROM app.orchestrator_session
ORDER BY created_ts DESC
LIMIT 10;

-- View agent LLM calls
SELECT session_id, agent_type, action, llm_model, llm_total_tokens, created_ts
FROM app.orchestrator_agent_log
ORDER BY created_ts DESC
LIMIT 20;

-- View session state
SELECT session_id, key, value, source
FROM app.orchestrator_state
WHERE session_id = 'YOUR_SESSION_ID';
```

---

## 🐛 Troubleshooting

### Issue: "OpenAI API key not found"

**Symptom:**
```
Error: OpenAI API key is required
```

**Solution:**
```bash
# Check .env file
cat .env | grep OPENAI_API_KEY

# Set environment variable
export OPENAI_API_KEY=sk-your-key-here

# Restart API server
./tools/restart-api.sh
```

---

### Issue: "Session memory file not writable"

**Symptom:**
```
Error: EACCES: permission denied, open 'logs/contexts/session_memory_data.db.json'
```

**Solution:**
```bash
# Create directory
mkdir -p logs/contexts

# Fix permissions
chmod 755 logs/contexts
touch logs/contexts/session_memory_data.db.json
chmod 644 logs/contexts/session_memory_data.db.json
```

---

### Issue: "Database tables not found"

**Symptom:**
```
Error: relation "app.orchestrator_session" does not exist
```

**Solution:**
```bash
# Run database import
./tools/db-import.sh

# Verify tables created
psql -h localhost -p 5434 -U app -d app -c "\dt app.orchestrator*"
```

---

### Issue: "Voice audio not playing"

**Symptom:**
- WebSocket receives audio chunks but no sound plays

**Solution:**
```javascript
// Initialize AudioContext on user gesture (browser requirement)
button.addEventListener('click', async () => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  await audioContext.resume();
  console.log('AudioContext initialized');
});
```

---

### Issue: "Goal workflow stuck"

**Symptom:**
- Agent stays in first goal (WARM_GREETINGS_EMPATHY_UNDERSTAND)
- Never transitions to next goal

**Solution:**
```bash
# Enable verbose logging
export VERBOSE_AGENT_LOGS=true

# Check goal transition logs
./tools/logs-api.sh | grep "GoalTransitionEngine"

# Expected output:
# [GoalTransitionEngine] 🔍 Evaluating goal transition
# [GoalTransitionEngine]    Deterministic: service.primary_request is_set → ✅ TRUE
# [GoalTransitionEngine] ✅ MATCHED: Transition to ELICIT_STRUCTURED_INFO

# If missing, check agent_config.json goal_branching_condition
```

---

## 📚 Next Steps

### Learn More

- **[Complete Documentation](./AI_CHAT_SYSTEM.md)** - Deep dive into architecture
- **[Agent Configuration](./AGENT_CONFIG_GUIDE.md)** - Customize agent behavior
- **[MCP Tools](./MCP_TOOLS_REFERENCE.md)** - Available API tools
- **[Voice Integration](./VOICE_INTEGRATION.md)** - Advanced voice features

### Build Custom Agents

1. Copy `agent_config.json` to `agent_config_custom.json`
2. Modify goals, tactics, and branching conditions
3. Update orchestrator service to load custom config
4. Test with real conversations

### Production Deployment

- **[Deployment Guide](./DEPLOYMENT.md)** - Production setup
- **[Monitoring Guide](./MONITORING.md)** - Logging and metrics
- **[Cost Optimization](./COST_OPTIMIZATION.md)** - Reduce LLM costs

---

## 🎓 Key Concepts for Beginners

### What is a "Goal"?

A **goal** is a high-level business objective in the customer service workflow:

- **WARM_GREETINGS** - Welcome and understand request
- **ELICIT_INFO** - Collect contact details
- **LOOKUP** - Find/create customer
- **DESIGN** - Create solution plan
- **EXECUTE** - Create task and appointment
- **CONFIRM** - Verify satisfaction

### What is "MCP"?

**MCP (Model Context Protocol)** is how the AI agent calls internal APIs:

- Converts API endpoints → OpenAI function tools
- Agent decides which tools to call based on customer needs
- Examples: `customer_create`, `task_create`, `person_calendar_book`

### What is "Session Memory"?

**Session memory** stores conversation context in a JSON file:

```json
{
  "customer": {
    "name": "John Smith",
    "phone": "647-646-7996"
  },
  "service": {
    "primary_request": "Roof hole repair"
  },
  "operations": {
    "task_id": "task-123"
  }
}
```

This data persists across conversation turns and drives agent decisions.

### What is "Hybrid Branching"?

**Hybrid branching** uses 3 types of conditions to determine goal transitions:

1. **Deterministic** (instant, free)
   - Check if field is set: `customer.phone is_set`

2. **Compound** (instant, free)
   - Multiple conditions: `ALL of [phone is_set, name is_set]`

3. **Semantic** (LLM-based, ~200ms)
   - Natural language: "Customer confirmed they want to proceed"

---

## ✅ Verification Checklist

After setup, verify these features work:

- [ ] Text chat starts new session
- [ ] Agent responds to customer messages
- [ ] Goal transitions automatically (WARM_GREETINGS → ELICIT_INFO)
- [ ] Session memory updates correctly
- [ ] Database logs LLM calls
- [ ] Voice chat transcribes audio (if enabled)
- [ ] Voice chat generates audio responses (if enabled)
- [ ] MCP tools execute successfully
- [ ] Agent logs appear in API logs
- [ ] Session state persists across restarts

---

**Questions or issues?** Check the [Troubleshooting](./AI_CHAT_SYSTEM.md#troubleshooting) section or review [complete documentation](./AI_CHAT_SYSTEM.md).

---

**Last Updated:** 2025-11-11
**Maintained By:** PMO Platform Team
**Next:** [AI Chat System Documentation](./AI_CHAT_SYSTEM.md)
