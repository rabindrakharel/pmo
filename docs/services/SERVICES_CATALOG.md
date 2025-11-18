# PMO Platform Services Catalog

> **Complete catalog of reusable services with building block documentation**

**Total Services**: 30 services (3 CORE + 27 specialized)
**Documentation Pattern**: How It Works + Component Architecture + Operational Flow

---

## Documentation Index

### Core Infrastructure Services

| Service | File | Documentation |
|---------|------|---------------|
| **Entity Infrastructure Service** | `services/entity-infrastructure.service.ts` | [ENTITY_INFRASTRUCTURE_SERVICE.md](./ENTITY_INFRASTRUCTURE_SERVICE.md) |
| **Universal Formatter Service** | `lib/universalFormatterService.ts` | [UNIVERSAL_FORMATTER_SERVICE.md](./UNIVERSAL_FORMATTER_SERVICE.md) |
| **Universal Filter Builder** | `lib/universal-filter-builder.ts` | [UNIVERSAL_FILTER_BUILDER.md](./UNIVERSAL_FILTER_BUILDER.md) |
| **Linkage Service** | `services/linkage.service.ts` | [linkage-service.md](./linkage-service.md) *(legacy)* |
| **S3 Attachment Service** | `lib/s3-attachments.ts` | [s3-attachment-service.md](./s3-attachment-service.md) |

### Email & Messaging Services

| Service | File | Documentation |
|---------|------|---------------|
| **Email Service** | `modules/email/email.service.ts` | [email-service.md](./email-service.md) |
| **Messaging Service** | `modules/person-calendar/messaging.service.ts` | [messaging-service.md](./messaging-service.md) |
| **Delivery Service** | `modules/message-data/delivery.service.ts` | *(To be documented)* |

### Person Calendar Services

| Service | File | Documentation |
|---------|------|---------------|
| **Person Calendar Service** | `modules/person-calendar/person-calendar.service.ts` | [person-calendar-service.md](./person-calendar-service.md) |

### AI Chat Services (Core)

| Service | File | Documentation |
|---------|------|---------------|
| **Greeting Service** | `modules/chat/greeting.service.ts` | *(To be documented)* |
| **Conversation Service** | `modules/chat/conversation.service.ts` | [conversation-service.md](./conversation-service.md) |
| **Functions Service** | `modules/chat/functions.service.ts` | [functions-service.md](./functions-service.md) |
| **MCP Adapter Service** | `modules/chat/mcp-adapter.service.ts` | *(To be documented)* |
| **OpenAI Service** | `modules/chat/openai.service.ts` | *(To be documented)* |
| **Voice LangGraph Service** | `modules/chat/voice-langraph.service.ts` | *(To be documented)* |

### AI Orchestrator Agents

| Service | File | Documentation |
|---------|------|---------------|
| **Agent Orchestrator Service** | `orchestrator/agents/agent-orchestrator.service.ts` | [agent-orchestrator-service.md](./agent-orchestrator-service.md) |
| **Unified Goal Agent Service** | `orchestrator/agents/unified-goal-agent.service.ts` | [unified-goal-agent-service.md](./unified-goal-agent-service.md) |
| **Data Extraction Agent Service** | `orchestrator/agents/data-extraction-agent.service.ts` | *(To be documented)* |
| **Agent Context Service** | `orchestrator/agents/agent-context.service.ts` | *(To be documented)* |
| **Context Initializer Service** | `orchestrator/agents/context-initializer.service.ts` | *(To be documented)* |
| **DAG Loader Service** | `orchestrator/agents/dag-loader.service.ts` | *(To be documented)* |

### AI Orchestrator Support Services

| Service | File | Documentation |
|---------|------|---------------|
| **State Manager Service** | `orchestrator/state/state-manager.service.ts` | *(To be documented)* |
| **Session Memory Queue Service** | `orchestrator/services/session-memory-queue.service.ts` | *(To be documented)* |
| **Session Request Queue Service** | `orchestrator/services/session-request-queue.service.ts` | *(To be documented)* |
| **Session Memory Data Service** | `orchestrator/services/session-memory-data.service.ts` | *(To be documented)* |
| **Agent Logger Service** | `orchestrator/services/agent-logger.service.ts` | *(To be documented)* |
| **LLM Logger Service** | `orchestrator/services/llm-logger.service.ts` | *(To be documented)* |
| **OpenAI Service (Orchestrator)** | `orchestrator/services/openai.service.ts` | *(To be documented)* |
| **Config Loader Service** | `orchestrator/config/config-loader.service.ts` | *(To be documented)* |
| **Voice Orchestrator Service** | `orchestrator/voice-orchestrator.service.ts` | *(To be documented)* |
| **Tool Enrichment Engine Service** | `orchestrator/lib/tool-enrichment-engine.service.ts` | *(To be documented)* |

---

## Documentation Structure

Each service document follows this structure:

### 1. How It Works
- Core purpose and capabilities
- Main functionality overview
- Key features and supported operations

### 2. Component Architecture
- Visual architecture diagram
- Component breakdown
- Responsibility mapping
- Integration points

### 3. Operational Flow
- Step-by-step execution sequences
- Request/response flows
- Multi-step workflows
- Error handling patterns

---

## Services by Category

### By Usage Pattern

**Entity Operations**:
- Linkage Service - Parent-child relationships
- S3 Attachment Service - File attachments

**Communication**:
- Email Service - Transactional emails
- Messaging Service - Calendar notifications
- Delivery Service - Multi-channel delivery

**Calendar & Events**:
- Person Calendar Service - Event management
- Messaging Service - Event notifications

**AI & Conversational**:
- All Chat Services - Natural language processing
- All Orchestrator Services - Multi-agent coordination
- Goal Agent - Task execution
- Functions Service - Tool integration

---

## Quick Reference

### Most Commonly Used Services

| Rank | Service | Used By (Modules) |
|------|---------|-------------------|
| 1 | **Linkage Service** | 12+ entity modules |
| 2 | **Functions Service** | All AI/chat features |
| 3 | **Unified Goal Agent** | Chat routes, orchestrator |
| 4 | **S3 Attachment Service** | 4 upload modules |
| 5 | **Conversation Service** | All chat features |
| 6 | **Email Service** | Calendar, messaging |
| 7 | **Person Calendar Service** | Calendar module |
| 8 | **Messaging Service** | Calendar module |
| 9 | **Agent Orchestrator** | Chat routes, voice |
| 10 | **OpenAI Service** | All AI features |

### Service Dependencies Map

```
Core Infrastructure:
  - Linkage Service (independent)
  - S3 Attachment Service (independent)

Communication Stack:
  Email Service
      ↑
  Messaging Service
      ↑
  Person Calendar Service

AI Stack:
  Functions Service ← → Unified Goal Agent
      ↓                      ↓
  Agent Orchestrator ← Conversation Service
      ↓
  [Specialized Agents]
      ↓
  State Manager
```

---

## Currently Documented Services (13/30)

### Core Services (3/3) ✅
✅ **Entity Infrastructure Service** - Infrastructure tables management
✅ **Universal Formatter Service** - Formatting and field detection
✅ **Universal Filter Builder** - Auto-filter query builder

### Specialized Services (10/27)
✅ **Linkage Service** - Entity relationships
✅ **S3 Attachment Service** - File storage
✅ **Email Service** - Email sending
✅ **Messaging Service** - Calendar notifications
✅ **Person Calendar Service** - Calendar operations
✅ **Conversation Service** - Chat history
✅ **Functions Service** - LLM function calling
✅ **Agent Orchestrator Service** - Multi-agent coordination
✅ **Unified Goal Agent Service** - Goal-driven execution

---

## Documentation Conventions

### File Naming
- Lowercase with hyphens: `service-name-service.md`
- Matches service purpose: `linkage-service.md`, `email-service.md`

### Section Headers
- **How It Works** - Conceptual overview
- **Component Architecture** - Structure and components
- **Operational Flow** - Step-by-step sequences

### Diagrams
- ASCII art for architecture diagrams
- Component boxes and arrows
- Clear data flow representation

### Flow Documentation
- Numbered sequences
- Clear step transitions
- Input/output specifications
- Error paths included

---

**Last Updated**: 2025-01-18
**Documentation Status**: 13/30 services documented (43% - ALL core services complete)
**Next Priority**: Data Extraction Agent, State Manager, Config Loader
