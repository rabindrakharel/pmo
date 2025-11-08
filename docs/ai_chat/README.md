# AI Chat System Documentation

> **Complete documentation for the AI-powered customer service chat system**
>
> **Last Updated:** 2025-11-08
> **Version:** 3.0.0 (Deepgram STT + ElevenLabs TTS + LowDB Session Memory)
> **Branch:** `claude/fix-context-data-api-011CUuhgpTfBzse9X6tDieKZ`

---

## 📚 Documentation Index

| Document | Purpose | Key Topics |
|----------|---------|------------|
| **[AI_CHAT_SYSTEM.md](./AI_CHAT_SYSTEM.md)** | Complete system overview | Architecture, features, deployment |
| **[AGENT_FLOW_ANALYSIS.md](./AGENT_FLOW_ANALYSIS.md)** | MCP nodes & auto-advance fixes | Dead states, advance_type patterns, commit fdd34ff |
| **[CONTEXT_STRUCTURE.md](./CONTEXT_STRUCTURE.md)** | Context data structure | Nested data_extraction_fields, session memory files |
| **[DATA_EXTRACTION_FLOW.md](./DATA_EXTRACTION_FLOW.md)** | Extraction mechanism & flow | DataExtractionAgent, updateContext tool, auto-advance |
| **[FLOW_VERIFICATION.md](./FLOW_VERIFICATION.md)** | Complete verification summary | Requirements checklist, verification commands |

---

## 🎯 Quick Start Guide

### **Understanding the System:**
1. Start with **AI_CHAT_SYSTEM.md** for complete overview
2. Read **CONTEXT_STRUCTURE.md** to understand data organization
3. Review **DATA_EXTRACTION_FLOW.md** for extraction mechanism

### **Fixing Issues:**
1. **Agent flow problems** → AGENT_FLOW_ANALYSIS.md
2. **Context/data issues** → CONTEXT_STRUCTURE.md
3. **Extraction not working** → DATA_EXTRACTION_FLOW.md
4. **Verification needed** → FLOW_VERIFICATION.md

---

## ✅ Recent Changes (November 2025)

### **1. Voice Processing Upgrade (Commit 974a58c) - Nov 8** 🎤🔊
**OpenAI Whisper/TTS → Deepgram Nova-2 + ElevenLabs Flash v2.5**

**Speech-to-Text: Deepgram Nova-2**
- SDK: @deepgram/sdk 4.11.2
- Model: nova-2 (latest Deepgram model)
- Features: Smart formatting, confidence scores, better accuracy
- API Key: DEEPGRAM_API_KEY

**Text-to-Speech: ElevenLabs Flash v2.5**
- SDK: @elevenlabs/elevenlabs-js 2.22.0
- Model: eleven_flash_v2_5 (ultra-low latency ~75ms)
- Default Voice: Nova (Voice ID: 7ExgohZ4jKVjuJLwSEWl)
- 6 voice options with fine-tuned settings
- High-quality MP3 output (44.1kHz, 128kbps)
- API Key: ELEVEN_LABS_API_KEY

### **2. Session Memory: JSON Files → LowDB (Commits 0ebc841, 84bad58)** 💾
- ✅ Centralized in-memory JSON storage with file persistence
- ✅ Per-session locking mechanism (prevents race conditions)
- ✅ API endpoints: `/api/v1/session-memory-data/*`
- ✅ MCP tools for agent read/write access
- ✅ Location: `logs/contexts/session_memory_data.db.json`
- ✅ All 13 data_extraction_fields (including `task_name`)

### **3. Structured Logging System (Commit 7d00282)** 📊
- ✅ AgentLogger service with timestamps (HH:mm:ss.SSS)
- ✅ Concise single-line logs (80% reduction in verbosity)
- ✅ VERBOSE_AGENT_LOGS=true for debugging
- ✅ Clean separation: no voice logs in API console

### **4. Code Cleanup (Commit f95a152)** 🧹
- ✅ Removed 16 deprecated files (6 services + 10 docs)
- ✅ Old universal agent pattern removed
- ✅ Cleaner codebase focused on multi-agent system

### **5. Architectural Coherence Fixes (Commit 84bad58)** 🏗️
- ✅ Fixed `task_name` field in SessionMemoryData schema
- ✅ Fixed async initialization race conditions
- ✅ Schema matches agent_config.json template exactly
- ✅ Proper await for SessionMemoryDataService init

---

## 🔍 Key Concepts

### **1. Agent Types**
- **WorkerReplyAgent** - Generates customer-facing responses
- **WorkerMCPAgent** - Executes MCP tools and backend operations
- **NavigatorAgent** - Decides next node and validates conversation flow
- **DataExtractionAgent** - Extracts customer data from conversation
- **ValidatorAgent** - Validates data integrity and business rules

### **2. Session Memory Data Structure (LowDB)**
```typescript
interface SessionMemoryData {
  sessionId: string;
  chatSessionId: string;
  userId: string;
  currentNode: string;
  context: {
    agent_session_id: string;
    who_are_you: string;
    data_extraction_fields: {       // ← All 13 fields
      customer_name: string;
      customer_phone_number: string;
      customer_email: string;
      customer_id: string;
      customers_main_ask: string;
      matching_service_catalog_to_solve_customers_issue: string;
      related_entities_for_customers_ask: string;
      task_id: string;
      task_name: string;            // ← Added in schema fix
      appointment_details: string;
      project_id: string;
      assigned_employee_id: string;
      assigned_employee_name: string;
    };
    next_course_of_action: string;
    next_node_to_go_to: string;
    node_traversed: string[];
    summary_of_conversation_on_each_step_until_now: Array<{
      index: number;
      customer: string;
      agent: string;
    }>;
    flags: Record<string, number>;
  };
  messages: Array<{role, content, timestamp}>;
  completed: boolean;
  conversationEnded: boolean;
  endReason: string | null;
}
```

### **3. Voice Processing Flow**
```
Audio Input (WAV/WebM)
    ↓
🎤 Deepgram Nova-2 STT (with confidence scores)
    ↓
🎯 Agent Orchestrator (multi-agent DAG)
    ↓
🔊 ElevenLabs Flash v2.5 TTS (Nova voice)
    ↓
Audio Output (MP3, 44.1kHz)
```

### **4. Advance Types**
| Type | Behavior | Use Case |
|------|----------|----------|
| `auto` | Continue loop, execute next node immediately | MCP operations, automated replies |
| `stepwise` | Break loop, wait for user input | Questions, confirmations, user data |

### **5. LowDB Session Storage**
- **Location:** `./logs/contexts/session_memory_data.db.json`
- **Format:** Centralized JSON database (all sessions in one file)
- **Features:** Per-session locking, atomic operations, race condition prevention
- **API:** `/api/v1/session-memory-data/*` endpoints
- **MCP Tools:** Agents read/write via sessionMemoryDataService

### **6. Structured Logging**
**Concise Mode (Default):**
```
[10:23:45.123] 🔄 ITER 1 | Node: GREET_CUSTOMER | Session: a1b2c3d4
[10:23:46.456] 🗣️ WORKER_REPLY @ GREET_CUSTOMER: Hello...
[10:23:47.123] 🔍 Extracted: customer_name, customers_main_ask
[10:23:47.345] ➡️  Navigate: GREET_CUSTOMER → ASK_NEXT_NODE
```

**Verbose Mode (VERBOSE_AGENT_LOGS=true):**
- Full context dumps
- Complete state snapshots
- Raw JSON objects

---

## 🛠️ Development Workflow

### **Environment Variables:**
```bash
# Required
OPENAI_API_KEY=sk-...                    # GPT-4o mini for agents
DEEPGRAM_API_KEY=a98b33349bd...          # STT
ELEVEN_LABS_API_KEY=sk_708f8cdb90...     # TTS

# Optional
VERBOSE_AGENT_LOGS=true                  # Enable verbose logging
```

### **Making Changes:**
1. Update agent configuration in `agent_config.json`
2. Modify agent services if needed
3. Test with `./tools/test-api.sh`
4. Monitor logs with `./tools/logs-api.sh`

### **Testing:**
```bash
# Start all services
./tools/start-all.sh

# Test chat endpoint
./tools/test-api.sh POST /api/v1/chat '{"message": "My roof is leaking"}'

# View concise logs (default)
./tools/logs-api.sh 100

# View verbose logs (full context)
VERBOSE_AGENT_LOGS=true npm start
./tools/logs-api.sh 100 | grep "COMPLETE CONTEXT STATE"
```

### **Debugging:**
```bash
# Check LowDB session storage
cat ./logs/contexts/session_memory_data.db.json | jq

# Check specific session
cat ./logs/contexts/session_memory_data.db.json | jq '.sessions["<sessionId>"]'

# Check extraction fields
cat ./logs/contexts/session_memory_data.db.json | jq '.sessions["<sessionId>"].context.data_extraction_fields'

# Check node traversal
cat ./logs/contexts/session_memory_data.db.json | jq '.sessions["<sessionId>"].context.node_traversed'

# Test session memory API
curl http://localhost:4000/api/v1/session-memory-data/sessions/<sessionId>
```

---

## 📊 System Architecture

### **Request Flow:**
```
User Message
    ↓
API Endpoint (/api/v1/chat)
    ↓
AgentOrchestratorService
    ├─ WorkerAgent (reply/mcp)
    ├─ DataExtractionAgent (auto)
    ├─ NavigatorAgent (routing)
    └─ Context Persistence (file write)
    ↓
Response to User
```

### **Agent Execution Loop:**
```typescript
for (let iterations = 1; iterations <= 10; iterations++) {
  // 1. Execute worker (reply or MCP)
  // 2. Run DataExtractionAgent
  // 3. Navigate to next node
  // 4. Check advance_type
  // 5. If auto: continue loop
  // 6. If stepwise: break and wait for user
}
```

---

## 🔗 Related Documentation

### **Project-Level Docs:**
- [Main README](/README.md) - Project overview
- [Entity System](/docs/entity_design_pattern/universal_entity_system.md) - DRY entity architecture
- [Database](/docs/datamodel/datamodel.md) - Complete schema
- [Infrastructure](/docs/infra_docs/INFRASTRUCTURE_DESIGN.md) - AWS deployment

### **API Documentation:**
- [Chat API](/apps/api/src/modules/chat/README.md) - API endpoints
- [MCP Integration](/apps/api/src/modules/chat/mcp-adapter.service.ts) - MCP adapter

### **Configuration Files:**
- [agent_config.json](/apps/api/src/modules/chat/orchestrator/agent_config.json) - Agent configuration
- [Agent Services](/apps/api/src/modules/chat/orchestrator/agents/) - Agent implementations

---

## 🎯 Common Tasks

### **Add New Extraction Field:**
1. Add field to `data_extraction_fields` in agent_config.json
2. Update DataExtractionAgent to include field
3. Update field_semantics documentation
4. Test extraction with sample conversation

### **Fix Dead State:**
1. Identify node causing wait
2. Check branching_conditions in agent_config.json
3. Change `advance_type` from `stepwise` to `auto` if appropriate
4. Test flow end-to-end

### **Add New MCP Tool:**
1. Define tool in MCP manifest
2. Update WorkerMCPAgent to handle tool
3. Add tool to agent_config.json node context_update
4. Test tool execution and context updates

---

## ✅ Quality Checklist

### **Before Committing:**
- [ ] All MCP nodes use `advance_type: 'auto'`
- [ ] Reply nodes use `advance_type: 'stepwise'` when expecting user response
- [ ] Context fields use nested `data_extraction_fields`
- [ ] Session memory files follow naming: `session_{sessionId}_memory_data.json`
- [ ] Agent profiles reference nested fields correctly
- [ ] No dag.json references (use agent_config.json)
- [ ] Tests pass for extraction and auto-advance

### **Before Deployment:**
- [ ] Test complete conversation flow
- [ ] Verify DataExtractionAgent extracts all fields
- [ ] Check auto-advance doesn't cause loops
- [ ] Ensure session memory persists correctly
- [ ] Monitor logs for errors

---

## 📝 Version History

| Version | Date | Changes |
|---------|------|---------|
| **3.0.0** | 2025-11-08 | Deepgram STT + ElevenLabs TTS + LowDB + Structured Logging + Code Cleanup |
| **2.4.0** | 2025-11-07 | MCP node fixes, context restructuring |
| **2.3.0** | 2025-11-06 | DataExtractionAgent integration |
| **2.2.0** | 2025-11-05 | Nested context structure |
| **2.1.0** | 2025-11-04 | Session memory persistence |
| **2.0.0** | 2025-11-01 | GPT-4o mini + Soft Semantic Routing |

---

## 🆘 Support & Troubleshooting

### **Common Issues:**

**Issue:** Agent waits after MCP operation
- **Fix:** Change `advance_type` to `auto` in agent_config.json
- **See:** AGENT_FLOW_ANALYSIS.md

**Issue:** Extraction fields not populating
- **Fix:** Check DataExtractionAgent logs, verify field names
- **See:** DATA_EXTRACTION_FLOW.md

**Issue:** Context data lost between turns
- **Fix:** Verify session memory file writes, check persistence service
- **See:** CONTEXT_STRUCTURE.md

**Issue:** Multiple agent replies not working
- **Fix:** Ensure advance_type='auto' for intermediate nodes
- **See:** FLOW_VERIFICATION.md

---

## 📞 Contact

For questions or issues:
- Check documentation in this folder first
- Review commit history for recent changes
- Test with `./tools/test-api.sh` and `./tools/logs-api.sh`

---

**Maintained by:** AI Development Team
**Last Updated:** 2025-11-08
