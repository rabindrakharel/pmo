# AI Chat System Documentation

> **Complete documentation for the AI-powered customer service chat system**
>
> **Last Updated:** 2025-11-08
> **Version:** 2.4.0 (GPT-4o mini + Soft Semantic Routing)
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

## ✅ Recent Changes (Nov 2025)

### **1. Context Restructuring (Commits f381f06 - 37d2af9)**
- ✅ Nested `data_extraction_fields` object for better organization
- ✅ Renamed `node_traversal_path` → `node_traversed`
- ✅ Session memory files: `session_{sessionId}_memory_data.json`
- ✅ Cleaned up all dag.json references (single source: agent_config.json)

### **2. MCP Node Auto-Advance Fix (Commit fdd34ff)**
- ✅ Fixed 3 MCP nodes from `stepwise` → `auto`
- ✅ Eliminated dead states where system waits unnecessarily
- ✅ Enabled smooth auto-advance through automated operations

### **3. DataExtractionAgent Integration**
- ✅ Runs automatically after every worker execution
- ✅ Analyzes last 4 conversation exchanges
- ✅ Extracts customer data seamlessly
- ✅ Immediate file write to persistent storage

---

## 🔍 Key Concepts

### **1. Agent Types**
- **WorkerReplyAgent** - Generates customer-facing responses
- **WorkerMCPAgent** - Executes MCP tools and backend operations
- **NavigatorAgent** - Decides next node and validates conversation flow
- **DataExtractionAgent** - Extracts customer data from conversation
- **ValidatorAgent** - Validates data integrity and business rules

### **2. Context Structure**
```json
{
  "agent_session_id": "uuid",
  "who_are_you": "...",
  "data_extraction_fields": {       // ← Nested extraction data
    "customer_name": "",
    "customer_phone_number": "",
    "customers_main_ask": "",
    "task_id": ""
  },
  "next_node_to_go_to": "...",
  "node_traversed": [...],
  "summary_of_conversation_on_each_step_until_now": [...]
}
```

### **3. Advance Types**
| Type | Behavior | Use Case |
|------|----------|----------|
| `auto` | Continue loop, execute next node immediately | MCP operations, automated replies |
| `stepwise` | Break loop, wait for user input | Questions, confirmations, user data |

### **4. Session Memory Files**
- **Location:** `./logs/contexts/session_{sessionId}_memory_data.json`
- **Updates:** After every extraction, navigation, and worker execution
- **Purpose:** Persistent storage of conversation state and extracted data

---

## 🛠️ Development Workflow

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

# View logs
./tools/logs-api.sh 100 | grep "DataExtractionAgent"
./tools/logs-api.sh 100 | grep "AUTO-ADVANCE ENABLED"
```

### **Debugging:**
```bash
# Check session memory files
ls -la ./logs/contexts/
cat ./logs/contexts/session_<sessionId>_memory_data.json | jq

# Check extraction fields
cat ./logs/contexts/session_<sessionId>_memory_data.json | jq '.context.data_extraction_fields'

# Check node traversal
cat ./logs/contexts/session_<sessionId>_memory_data.json | jq '.context.node_traversed'
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
| **2.4.0** | 2025-11-08 | MCP node fixes, context restructuring |
| **2.3.0** | 2025-11-07 | DataExtractionAgent integration |
| **2.2.0** | 2025-11-06 | Nested context structure |
| **2.1.0** | 2025-11-05 | Session memory persistence |
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
