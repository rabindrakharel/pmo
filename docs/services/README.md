# Services Documentation Index

**Version:** 4.0.0 | **Last Updated:** 2025-11-21

---

## Semantics

The PMO platform services are organized into **Core Infrastructure** (3 services) and **Specialized** categories. Core services handle entity management, metadata generation, and formatting. Specialized services handle domain-specific functionality.

**Core Principle:** Core services are mandatory for entity CRUD. Specialized services are domain-specific add-ons.

---

## System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SERVICE ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    CORE INFRASTRUCTURE (3)                       │    │
│  │  Entity Infrastructure  →  Backend Formatter  →  Frontend        │    │
│  │  (RBAC, Linkage)           (Metadata Gen)        Formatter       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    SPECIALIZED SERVICES                          │    │
│  │                                                                  │    │
│  │  Communication:  Email, Messaging, Delivery                     │    │
│  │  Calendar:       Person Calendar                                │    │
│  │  Storage:        S3 Attachment                                  │    │
│  │  AI/Chat:        Conversation, Functions, Orchestrator          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Service Index

### Core Infrastructure Services

| Service | File | Documentation | Purpose |
|---------|------|---------------|---------|
| **Entity Infrastructure** | `services/entity-infrastructure.service.ts` | [entity-infrastructure.service.md](./entity-infrastructure.service.md) | RBAC, entity registry, linkage, permissions |
| **Backend Formatter** | `services/backend-formatter.service.ts` | [backend-formatter.service.md](./backend-formatter.service.md) | Metadata generation (35+ patterns) |
| **Frontend Formatter** | `lib/frontEndFormatterService.tsx` | [frontEndFormatterService.md](./frontEndFormatterService.md) | Pure rendering from metadata |

### Storage & Communication Services

| Service | File | Documentation | Purpose |
|---------|------|---------------|---------|
| **S3 Attachment** | `lib/s3-attachments.ts` | [s3-attachment-service.md](./s3-attachment-service.md) | File upload/download with presigned URLs |
| **Person Calendar** | `modules/person-calendar/person-calendar.service.ts` | [person-calendar-service.md](./person-calendar-service.md) | Calendar and event management |

### AI & Orchestration Services

| Service | File | Documentation | Purpose |
|---------|------|---------------|---------|
| **Unified Goal Agent** | `orchestrator/agents/unified-goal-agent.service.ts` | [unified-goal-agent-service.md](./unified-goal-agent-service.md) | Goal-driven AI agent execution |

---

## Data Flow Diagram

```
Entity CRUD Flow (Uses Core Services)
─────────────────────────────────────

Request                         Core Services                    Database
───────                         ─────────────                    ────────

POST /api/v1/project    →      Entity Infrastructure:
                               1. check_entity_rbac()      →    entity_rbac
                               2. set_entity_instance_     →    entity_instance
                                  registry()
                               3. set_entity_rbac_owner()  →    entity_rbac
                               4. set_entity_instance_     →    entity_instance_link
                                  link() (if parent)

GET /api/v1/project     →      Entity Infrastructure:
                               get_entity_rbac_where_      →    SELECT with RBAC
                                 condition()

                               Backend Formatter:
                               getEntityMetadata()         →    Returns metadata

Response to Frontend    →      Frontend Formatter:
                               renderViewModeFromMetadata()     Renders UI
```

---

## Architecture Overview

### Core Services Usage Pattern

Every entity route uses Core Infrastructure Service:

```typescript
// Standard imports for all entity routes
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID }
  from '@/services/entity-infrastructure.service.js';
import { getEntityMetadata }
  from '@/services/backend-formatter.service.js';

const entityInfra = getEntityInfrastructure(db);

// CREATE pattern (6 steps)
// 1. RBAC check for CREATE permission
// 2. RBAC check for parent EDIT (if linking)
// 3. INSERT into primary table
// 4. Register in entity_instance
// 5. Grant OWNER permission
// 6. Link to parent (if provided)

// LIST pattern (2 steps)
// 1. Get RBAC WHERE condition
// 2. Execute query with RBAC filter

// UPDATE pattern (3 steps)
// 1. RBAC check for EDIT permission
// 2. UPDATE primary table
// 3. Sync entity_instance if name/code changed
```

### Service Responsibilities

| Service | Manages | Does NOT Manage |
|---------|---------|-----------------|
| Entity Infrastructure | 4 infrastructure tables | Primary entity tables |
| Backend Formatter | Field metadata generation | Database queries |
| Frontend Formatter | React rendering | Data fetching |
| S3 Attachment | File storage | Database records |
| Person Calendar | Events, schedules | RBAC permissions |

---

## Critical Considerations

### Service Dependencies

```
Entity Routes
    │
    ├── Entity Infrastructure Service (REQUIRED)
    │   └── Manages: entity, entity_instance, entity_instance_link, entity_rbac
    │
    ├── Backend Formatter Service (REQUIRED for metadata)
    │   └── Generates: field metadata from column patterns
    │
    └── Specialized Services (OPTIONAL per domain)
        ├── S3 Attachment (for file uploads)
        ├── Person Calendar (for scheduling)
        └── AI Services (for chat features)
```

### Core Service Rules

| Rule | Description |
|------|-------------|
| Routes own queries | Core services don't build primary table queries |
| Service provides helpers | RBAC conditions, registry updates, link management |
| No bypassing RBAC | All access must go through `check_entity_rbac()` |
| Registry sync required | Name/code changes must update `entity_instance` |

### Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Custom RBAC SQL in routes | Use `check_entity_rbac()` |
| Skipping entity_instance | Always register on CREATE |
| Direct foreign keys | Use `entity_instance_link` |
| Manual metadata building | Use `getEntityMetadata()` |

---

## Documentation Status

### Fully Documented

- Entity Infrastructure Service
- Backend Formatter Service
- Frontend Formatter Service
- S3 Attachment Service
- Person Calendar Service
- Unified Goal Agent Service

### Pending Documentation

- Email Service
- Messaging Service
- Delivery Service
- Conversation Service
- Functions Service
- Agent Orchestrator Service
- State Manager Service

---

## File Locations

```
apps/api/src/
├── services/
│   ├── entity-infrastructure.service.ts   (Core)
│   ├── backend-formatter.service.ts       (Core)
│   └── DELETED
│
├── lib/
│   ├── s3-attachments.ts
│   ├── universal-filter-builder.ts
│   └── entity-delete-route-factory.ts
│
├── modules/
│   ├── email/email.service.ts
│   ├── person-calendar/person-calendar.service.ts
│   └── chat/
│       ├── conversation.service.ts
│       └── functions.service.ts
│
└── orchestrator/
    └── agents/unified-goal-agent.service.ts

apps/web/src/lib/
└── frontEndFormatterService.tsx           (Core - Frontend)
```

---

**Status:** Production Ready
