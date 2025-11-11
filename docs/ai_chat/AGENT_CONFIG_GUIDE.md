# Agent Configuration Guide

> **How to Create and Customize AI Agent Configurations** - Complete guide to building custom agent workflows

**Version:** 6.1.0
**Status:** 📝 Documentation in Progress
**Last Updated:** 2025-11-11

---

## 📋 Overview

This guide will cover:

- ✅ Agent configuration structure (`agent_config.json`)
- ✅ Goal-oriented workflow design
- ✅ Hybrid branching (deterministic + compound + semantic)
- ✅ Conversation tactics and agent profiles
- ✅ MCP tool integration
- ✅ Success criteria and validation
- ✅ Testing and debugging custom configs

---

## 📚 Quick Links

**For now, please refer to:**

1. **[AI Chat System Documentation](./AI_CHAT_SYSTEM.md)** - Complete architecture
   - [Agent Orchestrator Service](./AI_CHAT_SYSTEM.md#1-agent-orchestrator-service)
   - [Configuration Section](./AI_CHAT_SYSTEM.md#configuration)
   - [Agent Config JSON Structure](./AI_CHAT_SYSTEM.md#1-agent-configuration)

2. **[Project/Task Agent Example](./PROJECT_TASK_AGENT_CONFIG.md)** - Real-world custom agent
   - [Goal Workflow](./PROJECT_TASK_AGENT_CONFIG.md#goal-workflow)
   - [Configuration Options](./PROJECT_TASK_AGENT_CONFIG.md#configuration-options)

3. **[Configuration File](../../apps/api/src/modules/chat/orchestrator/agent_config.json)** - Customer service agent (743 lines)

4. **[Configuration File](../../apps/api/src/modules/chat/orchestrator/agent_config_projecttask.json)** - Project/task agent

---

## 🚧 Coming Soon

This comprehensive guide will include:

### 1. Configuration Structure
- Goal definitions
- Agent profiles
- Conversation tactics
- Branching conditions
- Success criteria

### 2. Goal Design Patterns
- Data collection goals
- Validation goals
- Action execution goals
- Confirmation goals

### 3. Condition Types
- Deterministic conditions (instant, free)
- Compound conditions (`all_of`, `any_of`)
- Semantic conditions (LLM-based)
- Priority ordering

### 4. Best Practices
- Naming conventions
- Error handling
- Loop prevention
- Escalation triggers

### 5. Testing Strategies
- Unit testing goals
- Integration testing workflows
- Performance benchmarks

---

**Questions?** Check the existing [AI Chat System Documentation](./AI_CHAT_SYSTEM.md) for detailed configuration examples.

---

**Maintained By:** PMO Platform Team
**Status:** 📝 In Progress
