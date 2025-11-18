# PMO Platform Services Documentation

> Complete catalog of reusable services across the platform

**Total Services**: 30 services organized by domain (3 CORE + 27 specialized)

---

## Service Categories

### 1. Core Infrastructure Services

| Service | File | Purpose |
|---------|------|---------|
| **Entity Infrastructure Service** | `services/entity-infrastructure.service.ts` | Centralized management of 4 infrastructure tables (entity, entity_instance, entity_instance_link, entity_rbac) |
| **Universal Formatter Service** | `lib/universalFormatterService.ts` | Single source of truth for ALL formatting (currency, dates, badges, transforms) |
| **Universal Filter Builder** | `lib/universal-filter-builder.ts` | Zero-config query filtering with auto-type detection |
| **Linkage Service** | `services/linkage.service.ts` | Parent-child entity relationship management (legacy, use Entity Infrastructure Service) |
| **S3 Attachment Service** | `lib/s3-attachments.ts` | File upload/download with presigned URLs |

### 2. Email & Messaging Services

| Service | File | Purpose |
|---------|------|---------|
| **Email Service** | `modules/email/email.service.ts` | AWS SES email sending |
| **Messaging Service** | `modules/person-calendar/messaging.service.ts` | Calendar event notifications |
| **Delivery Service** | `modules/message-data/delivery.service.ts` | Message delivery orchestration |

### 3. Person Calendar Services

| Service | File | Purpose |
|---------|------|---------|
| **Person Calendar Service** | `modules/person-calendar/person-calendar.service.ts` | Calendar operations and event management |

### 4. AI Chat Services (Core)

| Service | File | Purpose |
|---------|------|---------|
| **Greeting Service** | `modules/chat/greeting.service.ts` | User greeting and context initialization |
| **Conversation Service** | `modules/chat/conversation.service.ts` | Chat history and message management |
| **Functions Service** | `modules/chat/functions.service.ts` | LLM function calling definitions |
| **MCP Adapter Service** | `modules/chat/mcp-adapter.service.ts` | Model Context Protocol adapter |
| **OpenAI Service** | `modules/chat/openai.service.ts` | OpenAI API integration |
| **Voice LangGraph Service** | `modules/chat/voice-langraph.service.ts` | Voice interaction orchestration |

### 5. AI Orchestrator Services

| Service | File | Purpose |
|---------|------|---------|
| **Agent Orchestrator Service** | `orchestrator/agents/agent-orchestrator.service.ts` | Multi-agent coordination |
| **Unified Goal Agent Service** | `orchestrator/agents/unified-goal-agent.service.ts` | Goal-driven AI agent |
| **Data Extraction Agent Service** | `orchestrator/agents/data-extraction-agent.service.ts` | Entity extraction from conversations |
| **Agent Context Service** | `orchestrator/agents/agent-context.service.ts` | Agent context management |
| **Context Initializer Service** | `orchestrator/agents/context-initializer.service.ts` | Initialize agent context |
| **DAG Loader Service** | `orchestrator/agents/dag-loader.service.ts` | Workflow graph loading |

### 6. AI Orchestrator Support Services

| Service | File | Purpose |
|---------|------|---------|
| **State Manager Service** | `orchestrator/state/state-manager.service.ts` | Conversation state persistence |
| **Session Memory Queue Service** | `orchestrator/services/session-memory-queue.service.ts` | In-memory session queue |
| **Session Request Queue Service** | `orchestrator/services/session-request-queue.service.ts` | Request queuing |
| **Session Memory Data Service** | `orchestrator/services/session-memory-data.service.ts` | Session data management |
| **Agent Logger Service** | `orchestrator/services/agent-logger.service.ts` | Agent activity logging |
| **LLM Logger Service** | `orchestrator/services/llm-logger.service.ts` | LLM interaction logging |
| **OpenAI Service (Orchestrator)** | `orchestrator/services/openai.service.ts` | Orchestrator-specific OpenAI client |
| **Config Loader Service** | `orchestrator/config/config-loader.service.ts` | Agent configuration loading |
| **Voice Orchestrator Service** | `orchestrator/voice-orchestrator.service.ts` | Voice workflow coordination |
| **Tool Enrichment Engine Service** | `orchestrator/lib/tool-enrichment-engine.service.ts` | Tool metadata enrichment |

---

## Quick Reference

### By Usage Pattern

**Entity CRUD Operations**:
- Linkage Service (parent-child relationships)
- S3 Attachment Service (file attachments)

**Communication**:
- Email Service (transactional emails)
- Messaging Service (calendar notifications)
- Delivery Service (message orchestration)

**Calendar & Events**:
- Person Calendar Service (event management)
- Messaging Service (event notifications)

**AI & Chat**:
- All Chat Services + Orchestrator Services (AI-powered assistance)

---

## Documentation Files

Each service has dedicated documentation:

- [ENTITY_INFRASTRUCTURE_SERVICE.md](./ENTITY_INFRASTRUCTURE_SERVICE.md) - Infrastructure tables management (CORE)
- [UNIVERSAL_FORMATTER_SERVICE.md](./UNIVERSAL_FORMATTER_SERVICE.md) - Formatting service (CORE)
- [UNIVERSAL_FILTER_BUILDER.md](./UNIVERSAL_FILTER_BUILDER.md) - Auto-filter builder (CORE)
- [linkage-service.md](./linkage-service.md) - Entity relationship management (legacy)
- [s3-attachment-service.md](./s3-attachment-service.md) - File storage operations
- [email-service.md](./email-service.md) - Email sending
- [messaging-service.md](./messaging-service.md) - Calendar notifications
- [delivery-service.md](./delivery-service.md) - Message delivery
- [person-calendar-service.md](./person-calendar-service.md) - Calendar operations
- [greeting-service.md](./greeting-service.md) - Chat greeting
- [conversation-service.md](./conversation-service.md) - Chat history
- [functions-service.md](./functions-service.md) - LLM functions
- [mcp-adapter-service.md](./mcp-adapter-service.md) - MCP protocol
- [openai-service.md](./openai-service.md) - OpenAI integration
- [voice-langraph-service.md](./voice-langraph-service.md) - Voice orchestration
- [agent-orchestrator-service.md](./agent-orchestrator-service.md) - Agent coordination
- [unified-goal-agent-service.md](./unified-goal-agent-service.md) - Goal agent
- [data-extraction-agent-service.md](./data-extraction-agent-service.md) - Entity extraction
- [agent-context-service.md](./agent-context-service.md) - Agent context
- [context-initializer-service.md](./context-initializer-service.md) - Context init
- [dag-loader-service.md](./dag-loader-service.md) - Workflow loading
- [state-manager-service.md](./state-manager-service.md) - State persistence
- [session-memory-queue-service.md](./session-memory-queue-service.md) - Session queue
- [session-request-queue-service.md](./session-request-queue-service.md) - Request queue
- [session-memory-data-service.md](./session-memory-data-service.md) - Session data
- [agent-logger-service.md](./agent-logger-service.md) - Agent logging
- [llm-logger-service.md](./llm-logger-service.md) - LLM logging
- [orchestrator-openai-service.md](./orchestrator-openai-service.md) - Orchestrator OpenAI
- [config-loader-service.md](./config-loader-service.md) - Config loading
- [voice-orchestrator-service.md](./voice-orchestrator-service.md) - Voice coordination
- [tool-enrichment-engine-service.md](./tool-enrichment-engine-service.md) - Tool enrichment

---

**Version**: 1.0.0 | **Last Updated**: 2025-11-16
