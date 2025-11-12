# Wiki System - Complete Technical Documentation

**Status:** ✅ Production Ready
**Version:** 3.2.0
**Last Updated:** 2025-11-12
**Features:** Block-Based Editor | Real-Time Collaborative Editing | Hierarchical Structure | Publication Workflow

> **Notion-style knowledge base with real-time multi-user collaboration** - Build and maintain organizational documentation with simultaneous editing, user presence indicators, and automatic conflict resolution.

---

## 📋 Table of Contents

1. [Overview & Business Context](#1-overview--business-context)
2. [System Architecture](#2-system-architecture)
3. [UI → API → Database Flow](#3-ui--api--database-flow)
4. [Data Model](#4-data-model)
5. [Real-Time Collaborative Editing](#5-real-time-collaborative-editing)
6. [Examples & Data Samples](#6-examples--data-samples)
7. [Implementation Guide](#7-implementation-guide)
8. [Best Practices & Critical Considerations](#8-best-practices--critical-considerations)

---

## 1. Overview & Business Context

### Purpose

The Wiki system is PMO platform's **knowledge management solution** providing:

- **📝 Block-Based Content** - Notion-style editor with 11 block types (headings, paragraphs, lists, code, quotes, etc.)
- **👥 Real-Time Collaboration** - Multiple users edit simultaneously with Y.js CRDTs and presence indicators
- **📊 Hierarchical Structure** - Organize pages with parent-child relationships and breadcrumb navigation
- **🔄 Publication Workflow** - Draft → Review → Published → Archived lifecycle
- **🔒 Access Control** - RBAC-based permissions with visibility settings (public/internal/restricted/private)
- **🔗 Entity Relationships** - Link wiki pages to projects, tasks, clients, employees
- **📈 Version Tracking** - Audit trail with version incrementing on each update
- **⚡ Auto-Save** - Periodic persistence (30s intervals) + connection-based triggers

### Business Workflows

```
┌───────────────────────────────────────────────────────────────┐
│               WIKI LIFECYCLE & WORKFLOWS                       │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  CREATE → DRAFT → EDIT → REVIEW → PUBLISH → ARCHIVE          │
│     ↓       ↓      ↓       ↓         ↓         ↓             │
│  Design  Author  Collab  Submit   Active   Historical         │
│   Page   Only    Edit    Review   Public   Reference          │
│                                                                │
│  Publication Status Flow:                                      │
│  • draft      → Author only (work in progress)                │
│  • review     → Submitted for approval                        │
│  • published  → Public access (visibility-based)              │
│  • archived   → Historical reference (read-only)              │
│  • deprecated → Outdated, marked for replacement              │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

### Real-World Use Cases

| Department | Wiki Type | Content | Block Types Used |
|------------|-----------|---------|------------------|
| Engineering | Technical Guide | API docs, architecture diagrams | Code, headings, tables, images |
| Operations | SOP | Step-by-step workflows | Numbered lists, callouts, dividers |
| HR | Policy Handbook | Employee benefits, guidelines | Headings, paragraphs, quotes |
| PM | Project Templates | Reusable project structures | Checklists, tables, links |
| Sales | Product KB | Features, pricing, demos | Bullet lists, images, videos |

---

## 2. System Architecture

### Full Stack Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         WIKI SYSTEM LAYERS                       │
└─────────────────────────────────────────────────────────────────┘

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  📱 BROWSER CLIENT (React 19 + TypeScript)                     ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                 ┃
┃  PAGES (React Router v6)                                        ┃
┃  ├─ /wiki                  → EntityMainPage (list)            ┃
┃  ├─ /wiki/new              → WikiEditorPage (create)          ┃
┃  ├─ /wiki/:id              → EntityDetailPage (view)          ┃
┃  ├─ /wiki/:id/edit         → WikiEditorPage (collab edit)     ┃
┃  └─ /wiki/shared/:code     → SharedURLEntityPage (public)     ┃
┃                                                                 ┃
┃  COMPONENTS                                                     ┃
┃  ├─ WikiDesigner           → Block-based content editor        ┃
┃  │   ├─ WikiHeaderEditor   → Cover, icon, title                ┃
┃  │   ├─ WikiDraggableBlock → Individual blocks                 ┃
┃  │   ├─ WikiBlockToolbar   → Block type selector               ┃
┃  │   ├─ WikiPropertiesPanel→ Metadata settings                 ┃
┃  │   ├─ CollaborativePresence → User indicators               ┃
┃  │   └─ CollaborativeCursor   → Block edit badges             ┃
┃  ├─ WikiContentRenderer    → Display published pages           ┃
┃  └─ useCollaborativeWiki   → Y.js WebSocket hook              ┃
┃                                                                 ┃
┃  STATE MANAGEMENT                                               ┃
┃  ├─ React State (local)    → UI state, form inputs             ┃
┃  ├─ Y.Doc (CRDT)           → Collaborative document state      ┃
┃  └─ Awareness              → User presence tracking            ┃
┃                                                                 ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                            ↕ HTTP/WebSocket
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  ⚙️  API SERVER (Fastify v5 + TypeScript ESM)                  ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                 ┃
┃  REST ENDPOINTS                                                 ┃
┃  ├─ GET    /api/v1/wiki                 → List pages           ┃
┃  ├─ POST   /api/v1/wiki                 → Create page          ┃
┃  ├─ GET    /api/v1/wiki/:id             → Get page             ┃
┃  ├─ PUT    /api/v1/wiki/:id             → Update page          ┃
┃  ├─ DELETE /api/v1/wiki/:id             → Soft delete          ┃
┃  ├─ GET    /api/v1/wiki/:id/children    → Get hierarchy        ┃
┃  └─ GET    /api/v1/setting?category=wiki_publication_status    ┃
┃                                                                 ┃
┃  WEBSOCKET ENDPOINTS (Real-Time Sync)                           ┃
┃  ├─ WS     /api/v1/collab/wiki/:id      → Y.js sync            ┃
┃  └─ GET    /api/v1/collab/wiki/:id/users→ Active users         ┃
┃                                                                 ┃
┃  SERVICES                                                       ┃
┃  ├─ Wiki CRUD Service      → Business logic                    ┃
┃  ├─ Room Manager           → Collaboration rooms               ┃
┃  ├─ Y.Doc (CRDT)           → Server document state             ┃
┃  ├─ Awareness Protocol     → Presence tracking                 ┃
┃  └─ Auto-Save Timer        → Periodic DB persistence (30s)     ┃
┃                                                                 ┃
┃  MIDDLEWARE                                                     ┃
┃  ├─ JWT Authentication     → Token verification                ┃
┃  ├─ RBAC Authorization     → Permission checks                 ┃
┃  └─ WebSocket Upgrade      → HTTP → WS handshake               ┃
┃                                                                 ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                            ↕ SQL
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  💾 DATABASE (PostgreSQL 14+)                                   ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                 ┃
┃  TABLES                                                         ┃
┃  ├─ d_wiki                  → Page metadata + content (JSONB)  ┃
┃  ├─ d_entity_id_map         → Entity relationships             ┃
┃  ├─ entity_id_rbac_map      → Access permissions               ┃
┃  └─ setting_datalabel       → Publication status values        ┃
┃                                                                 ┃
┃  INDEXES                                                        ┃
┃  ├─ idx_wiki_published      → Fast published page lookup       ┃
┃  ├─ idx_wiki_parent         → Hierarchical queries             ┃
┃  ├─ idx_wiki_entity         → Entity-wiki lookups              ┃
┃  └─ idx_wiki_search         → Full-text search (GIN)           ┃
┃                                                                 ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Design Patterns

#### 1. Block-Based Content Architecture (Notion-style)

Each wiki page is composed of flexible content blocks:

```typescript
interface WikiBlock {
  id: string;                   // Unique block ID (e.g., "block-1699123456789")
  type: BlockType;              // Block type (see types below)
  content?: string;             // Text content
  level?: number;               // Heading level (1-6) or list type
  styles?: Record<string, any>; // Custom styling (future)
  properties?: Record<string, any>; // Block-specific config
}

type BlockType =
  | 'heading'    // h1-h6 section headers
  | 'paragraph'  // Auto-resizing text blocks
  | 'list'       // Bulleted (level=1) or Numbered (level=2)
  | 'quote'      // Blockquotes with left border
  | 'code'       // Syntax-highlighted code
  | 'callout'    // Highlighted important notes
  | 'divider'    // Horizontal rule separator
  | 'image'      // Embedded images
  | 'video'      // Embedded videos
  | 'table';     // Data tables

interface WikiPage {
  id: string;
  name: string;
  slug: string;
  content: {
    type: 'blocks';
    blocks: WikiBlock[];        // Array of content blocks
  };
  tags: string[];
  metadata: {
    attr: {
      icon: string;             // Page icon (emoji)
      cover: string;            // Cover image/gradient
      path: string;             // Hierarchical path
    };
  };
  publication_status: string;   // draft, review, published, archived
  visibility: string;           // public, internal, restricted, private
  version: number;              // Increments on each update
}
```

#### 2. Real-Time Collaborative Editing (Y.js CRDT)

**Conflict-Free Replicated Data Types** enable simultaneous multi-user editing:

```
User A Browser                  Fastify Server                  User B Browser
     ↓                               ↓                                ↓
Y.Doc (local CRDT)  ←── WebSocket ──→ Room Manager ←── WebSocket ──→ Y.Doc (local CRDT)
     ↓                               ↓                                ↓
React State                    Y.Doc (server CRDT)               React State
     ↓                               ↓
UI Updates                     Auto-save (30s)
                                     ↓
                               PostgreSQL
                              (d_wiki.content)
```

**Key Components:**
- **Y.Doc**: CRDT document per wiki page (client + server)
- **WebSocket Provider**: Real-time sync protocol (`y-protocols/sync`)
- **Awareness Protocol**: User presence tracking (`y-protocols/awareness`)
- **Room Manager**: Isolated collaboration rooms per wiki ID
- **Auto-Save**: Periodic persistence to database

#### 3. In-Place Version Tracking

Unlike artifacts (SCD Type 2), wiki pages use **in-place updates** with version incrementing:

```sql
-- Version 1 (Initial Draft)
id: a1111111-1111-1111-1111-111111111111
version: 1
publication_status: 'draft'
updated_ts: 2025-01-01 10:00:00

-- Version 2 (Edited Draft) - SAME ID
id: a1111111-1111-1111-1111-111111111111  ← Same ID!
version: 2                                 ← Incremented
publication_status: 'draft'
updated_ts: 2025-01-02 14:30:00           ← Updated

-- Version 3 (Published) - SAME ID
id: a1111111-1111-1111-1111-111111111111  ← Same ID!
version: 3                                 ← Incremented
publication_status: 'published'
published_ts: 2025-01-03 09:00:00
published_by_empid: {user-id}
```

**Why In-Place Updates?**
- ✅ Preserves page path and entity relationships (stable URLs)
- ✅ Version number provides audit trail without duplication
- ✅ Publication status changes are workflow transitions, not new entities
- ✅ Simplifies hierarchical structure (parent_wiki_id stays stable)

---

## 3. UI → API → Database Flow

### Complete Request/Response Cycle

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. USER INTERACTION (Browser)                                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  User navigates to: /wiki/abc-123/edit                          │
│  → WikiEditorPage loads                                          │
│  → WikiDesigner component renders                                │
│  → useCollaborativeWiki hook initializes                         │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ 2. INITIAL DATA FETCH (HTTP GET)                                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  GET /api/v1/wiki/abc-123                                        │
│  Headers: { Authorization: "Bearer <jwt>" }                      │
│                                                                   │
│  → Backend verifies JWT token                                    │
│  → Backend checks RBAC permissions:                              │
│     SELECT 1 FROM entity_id_rbac_map                             │
│     WHERE empid=$userId                                          │
│       AND entity='wiki'                                          │
│       AND (entity_id='abc-123' OR entity_id='all')              │
│       AND 0=ANY(permission)  -- View permission                  │
│                                                                   │
│  → Backend queries database:                                     │
│     SELECT * FROM d_wiki                                         │
│     WHERE id='abc-123' AND active_flag=true                      │
│                                                                   │
│  ← Response: { id, name, slug, content: {...}, version, ... }   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ 3. WEBSOCKET CONNECTION (Real-Time Sync)                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ws://localhost:4000/api/v1/collab/wiki/abc-123?token=<jwt>     │
│                                                                   │
│  → Server verifies JWT token                                     │
│  → Server checks RBAC edit permission (permission=1)             │
│  → Server creates/joins room for wiki ID "abc-123"               │
│  → Server sends initial sync (Y.js state vector)                 │
│  ← Client receives document state                                │
│  → Bi-directional sync stream begins                             │
│                                                                   │
│  Message Protocol (binary):                                      │
│    Byte 0: Message Type                                          │
│      0x00 = Sync protocol message                                │
│      0x01 = Awareness protocol message (presence)                │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ 4. USER EDITS CONTENT (Real-Time)                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  User types in paragraph block:                                  │
│  "This is collaborative content..."                              │
│                                                                   │
│  → React onChange handler fires                                  │
│  → Local state updates: setBlocks(updatedBlocks)                 │
│  → collab.updateBlocks(updatedBlocks)                            │
│  → Y.Doc applies change locally                                  │
│  → Sync message sent via WebSocket                               │
│                                                                   │
│  Server receives sync message:                                   │
│  → Y.Doc applies change                                          │
│  → Broadcasts to all connections EXCEPT sender                   │
│                                                                   │
│  Other users' browsers:                                          │
│  ← Receive sync message via WebSocket                            │
│  → Y.Doc applies change                                          │
│  → React state updates automatically                             │
│  → UI re-renders with new content                                │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ 5. AUTO-SAVE TO DATABASE (Every 30 seconds)                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Server auto-save timer fires:                                   │
│  → Extract blocks from Y.Doc:                                    │
│     const yContent = doc.getMap('wiki');                         │
│     const blocks = yContent.get('blocks');                       │
│                                                                   │
│  → Update database:                                              │
│     UPDATE d_wiki                                                │
│     SET content = $1::jsonb,                                     │
│         version = version + 1,                                   │
│         updated_ts = NOW()                                       │
│     WHERE id = 'abc-123'                                         │
│                                                                   │
│  → Content persisted: { type: 'blocks', blocks: [...] }         │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ 6. USER CLOSES TAB (Cleanup)                                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  WebSocket connection closes:                                    │
│  → Server removes connection from room                           │
│  → Awareness state removed (user disappears from presence)       │
│                                                                   │
│  If last user in room:                                           │
│  → Final auto-save triggered                                     │
│  → Room cleaned up from memory                                   │
│  → Auto-save timer cleared                                       │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Data Model

### Database Schema (d_wiki)

**Location:** `db/XIX_d_wiki.ddl`

```sql
CREATE TABLE app.d_wiki (
    -- Primary key
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identifiers
    code varchar(50) UNIQUE NOT NULL,           -- e.g., "WIKI-2025-001"
    name varchar(200) NOT NULL,                 -- Page title

    -- Metadata
    descr text,                                  -- Description
    internal_url varchar(500),                   -- /wiki/{id} (authenticated)
    shared_url varchar(500),                     -- /wiki/shared/{code} (public)
    metadata jsonb DEFAULT '{}'::jsonb,          -- icon, cover, etc.

    -- Classification
    wiki_type varchar(50) DEFAULT 'page',        -- page, template, workflow, guide, policy
    category varchar(100),

    -- Content (block-based JSONB structure)
    content jsonb DEFAULT NULL,                  -- { type: 'blocks', blocks: [...] }

    -- Hierarchical structure
    page_path varchar(500),                      -- /projects/methodology/agile
    parent_wiki_id uuid,                         -- NULL=root, UUID=child
    sort_order integer DEFAULT 0,

    -- Publication workflow
    publication_status varchar(50) DEFAULT 'draft', -- draft, review, published, archived
    published_ts timestamptz,
    published_by_empid uuid,

    -- Access control
    visibility varchar(20) DEFAULT 'internal',   -- public, internal, restricted, private
    read_access_groups varchar[] DEFAULT '{}',
    edit_access_groups varchar[] DEFAULT '{}',

    -- SEO and discovery
    keywords varchar[] DEFAULT '{}',
    summary text,

    -- Entity relationships (via entity_id_map)
    primary_entity_type varchar(50),             -- project, task, business, office
    primary_entity_id uuid,

    -- Temporal fields (SCD Type 1 - In-place updates)
    active_flag boolean DEFAULT true,
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1                    -- Increments on each update
);

-- Indexes for performance
CREATE INDEX idx_wiki_published ON d_wiki(publication_status, published_ts DESC)
WHERE active_flag = true;

CREATE INDEX idx_wiki_parent ON d_wiki(parent_wiki_id, sort_order);

CREATE INDEX idx_wiki_entity ON d_wiki(primary_entity_type, primary_entity_id, active_flag);

-- Full-text search
CREATE INDEX idx_wiki_search ON d_wiki
USING GIN(to_tsvector('english', name || ' ' || COALESCE(descr, '')));
```

### Key Fields Explained

| Field | Type | Purpose | Update Behavior |
|-------|------|---------|-----------------|
| `id` | uuid | Primary key | **STABLE** - Never changes, preserves URLs and relationships |
| `version` | integer | Revision counter | **INCREMENTS** on each update (audit trail) |
| `content` | jsonb | Block-based content | Block array: `{ type: 'blocks', blocks: [...] }` |
| `publication_status` | varchar | Workflow state | Changes: draft → review → published → archived |
| `published_ts` | timestamptz | Publication timestamp | Set when status becomes 'published' |
| `published_by_empid` | uuid | Publisher | Set when status becomes 'published' |
| `parent_wiki_id` | uuid | Hierarchical parent | NULL for root pages, UUID for child pages |
| `page_path` | varchar | URL-friendly path | Hierarchical path for routing (/projects/methodology) |
| `metadata` | jsonb | Flexible data | Stores `{ attr: { icon, cover, path, ... } }` |
| `visibility` | varchar | Access level | Controls who can view: public/internal/restricted/private |

### Content Structure (JSONB)

```json
{
  "type": "blocks",
  "blocks": [
    {
      "id": "block-1699123456789",
      "type": "heading",
      "content": "Introduction to Agile",
      "level": 1,
      "styles": {},
      "properties": {}
    },
    {
      "id": "block-1699123456790",
      "type": "paragraph",
      "content": "Agile is an iterative approach to project management that emphasizes flexibility, collaboration, and customer feedback.",
      "styles": {},
      "properties": {}
    },
    {
      "id": "block-1699123456791",
      "type": "list",
      "content": "Daily standup meetings",
      "level": 1,
      "styles": {},
      "properties": {}
    },
    {
      "id": "block-1699123456792",
      "type": "code",
      "content": "git commit -m 'Implement agile workflow'",
      "properties": {
        "language": "bash",
        "theme": "dark"
      }
    }
  ]
}
```

### Metadata Structure (JSONB)

```json
{
  "attr": {
    "icon": "📚",
    "cover": "gradient-blue",
    "path": "/projects/methodology"
  }
}
```

### Hierarchical Structure Example

```
/wiki
├─ /projects (parent_wiki_id: null)
│  ├─ /methodology (parent_wiki_id: projects)
│  │  ├─ /agile (parent_wiki_id: methodology)
│  │  └─ /waterfall (parent_wiki_id: methodology)
│  └─ /templates (parent_wiki_id: projects)
├─ /guides (parent_wiki_id: null)
│  ├─ /onboarding (parent_wiki_id: guides)
│  └─ /troubleshooting (parent_wiki_id: guides)
└─ /policies (parent_wiki_id: null)
   ├─ /hr (parent_wiki_id: policies)
   └─ /security (parent_wiki_id: policies)
```

---

## 5. Real-Time Collaborative Editing

### Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     COLLABORATIVE EDITING FLOW                    │
└──────────────────────────────────────────────────────────────────┘

Browser Client A                Server                Browser Client B
      ↓                            ↓                          ↓
┌─────────────┐              ┌─────────────┐            ┌─────────────┐
│ WikiDesigner│              │ Room Manager│            │ WikiDesigner│
│             │              │             │            │             │
│ Y.Doc       │◄────WS──────►│ Y.Doc       │◄────WS───►│ Y.Doc       │
│ (local CRDT)│              │ (server)    │            │ (local CRDT)│
│             │              │             │            │             │
│ Awareness   │              │ Awareness   │            │ Awareness   │
│ (presence)  │              │ (tracking)  │            │ (presence)  │
└─────────────┘              └─────────────┘            └─────────────┘
      ↓                            ↓
React State                  Auto-Save Timer
      ↓                            ↓
  UI Updates                 PostgreSQL
                            (d_wiki.content)
```

### Room-Based Multiplexing

Each wiki page ID maps to an isolated "room":

```typescript
interface Room {
  doc: Y.Doc;                  // Shared CRDT document
  awareness: Awareness;        // User presence tracking
  connections: Set<WSConnection>; // Active WebSocket connections
  lastSaved: number;           // Auto-save timestamp
}

const rooms = new Map<string, Room>();
```

### Y.js CRDT Synchronization

**State-based replication** on connect + **operation-based updates** for changes:

```typescript
// Sync Protocol Messages
0: Sync (document state/updates)
1: Awareness (user presence/cursors)

// Sync Steps
Step 1: Client → Server (state vector)
Step 2: Server → Client (missing updates)
```

### Conflict Resolution Example

```typescript
// User A adds block at index 2
blocks.splice(2, 0, { id: 'block-A', type: 'paragraph', content: 'A' });

// User B simultaneously adds block at index 2
blocks.splice(2, 0, { id: 'block-B', type: 'paragraph', content: 'B' });

// Y.js CRDT automatically merges:
// Result: Both blocks exist, deterministic order based on client IDs
blocks = [
  { id: 'block-1', ... },
  { id: 'block-2', ... },
  { id: 'block-A', ... },  // User A's block
  { id: 'block-B', ... },  // User B's block
  { id: 'block-3', ... },
];
```

### User Presence Indicators

```json
{
  "users": [
    {
      "clientId": 1234567890,
      "id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
      "name": "James Miller",
      "color": "#3B82F6",
      "cursor": { "blockId": "block-123", "position": 42 },
      "selection": { "blockId": "block-123", "start": 10, "end": 20 }
    }
  ]
}
```

### Auto-Save Mechanism

```typescript
// Auto-save every 30 seconds while editing
const AUTO_SAVE_INTERVAL = 30000;

setInterval(async () => {
  if (room.connections.size > 0) {
    const yContent = room.doc.getMap('wiki');
    const blocks = yContent.get('blocks');

    await db.execute(sql`
      UPDATE app.d_wiki
      SET content = ${JSON.stringify({ type: 'blocks', blocks })},
          version = version + 1,
          updated_ts = NOW()
      WHERE id = ${wikiId}
    `);

    room.lastSaved = Date.now();
  }
}, AUTO_SAVE_INTERVAL);

// Final save when last user disconnects
if (room.connections.size === 0) {
  await saveWikiContent(wikiId, room.doc);
  rooms.delete(wikiId);
}
```

---

## 6. Examples & Data Samples

### Example 1: Create New Wiki Page

**API Request:**
```http
POST /api/v1/wiki
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "name": "Agile Methodology Guide",
  "code": "WIKI-2025-001",
  "slug": "agile-methodology-guide",
  "descr": "Comprehensive guide to Agile project management",
  "content": {
    "type": "blocks",
    "blocks": [
      {
        "id": "block-1699123456789",
        "type": "heading",
        "content": "Introduction to Agile",
        "level": 1
      },
      {
        "id": "block-1699123456790",
        "type": "paragraph",
        "content": "Agile is an iterative approach..."
      },
      {
        "id": "block-1699123456791",
        "type": "list",
        "content": "Daily standup meetings",
        "level": 1
      }
    ]
  },
  "tags": ["agile", "methodology", "project-management"],
  "wiki_type": "guide",
  "category": "project-management",
  "publication_status": "draft",
  "visibility": "internal",
  "metadata": {
    "attr": {
      "icon": "📚",
      "cover": "gradient-blue",
      "path": "/projects/methodology"
    }
  }
}
```

**API Response:**
```json
{
  "id": "a1111111-1111-1111-1111-111111111111",
  "name": "Agile Methodology Guide",
  "code": "WIKI-2025-001",
  "slug": "agile-methodology-guide",
  "version": 1,
  "publication_status": "draft",
  "visibility": "internal",
  "created_ts": "2025-01-01T10:00:00Z",
  "updated_ts": "2025-01-01T10:00:00Z"
}
```

**Database Record:**
```sql
SELECT id, name, code, version, publication_status, content::json
FROM d_wiki
WHERE id = 'a1111111-1111-1111-1111-111111111111';

/*
id:                 a1111111-1111-1111-1111-111111111111
name:               Agile Methodology Guide
code:               WIKI-2025-001
version:            1
publication_status: draft
content:            {"type":"blocks","blocks":[{"id":"block-1699123456789","type":"heading","content":"Introduction to Agile","level":1},...]}
created_ts:         2025-01-01 10:00:00+00
updated_ts:         2025-01-01 10:00:00+00
active_flag:        true
*/
```

### Example 2: Update Wiki Page (In-Place)

**API Request:**
```http
PUT /api/v1/wiki/a1111111-1111-1111-1111-111111111111
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "content": {
    "type": "blocks",
    "blocks": [
      {
        "id": "block-1699123456789",
        "type": "heading",
        "content": "Introduction to Agile",
        "level": 1
      },
      {
        "id": "block-1699123456790",
        "type": "paragraph",
        "content": "Agile is an iterative approach that emphasizes flexibility, collaboration, and customer feedback."
      },
      {
        "id": "block-1699123456791",
        "type": "list",
        "content": "Daily standup meetings",
        "level": 1
      },
      {
        "id": "block-1699123456792",
        "type": "list",
        "content": "Sprint planning sessions",
        "level": 1
      },
      {
        "id": "block-1699123456793",
        "type": "code",
        "content": "git commit -m 'Implement agile workflow'",
        "properties": {
          "language": "bash"
        }
      }
    ]
  }
}
```

**API Response:**
```json
{
  "id": "a1111111-1111-1111-1111-111111111111",
  "version": 2,
  "updated_ts": "2025-01-02T14:30:00Z"
}
```

**Database Update:**
```sql
UPDATE app.d_wiki
SET content = '{"type":"blocks","blocks":[...]}'::jsonb,
    version = version + 1,
    updated_ts = NOW()
WHERE id = 'a1111111-1111-1111-1111-111111111111';

-- Result: SAME ID, version incremented from 1 → 2
```

### Example 3: Publish Wiki Page

**API Request:**
```http
PUT /api/v1/wiki/a1111111-1111-1111-1111-111111111111
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "publication_status": "published"
}
```

**API Response:**
```json
{
  "id": "a1111111-1111-1111-1111-111111111111",
  "version": 3,
  "publication_status": "published",
  "published_ts": "2025-01-03T09:00:00Z",
  "published_by_empid": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13"
}
```

**Database Update:**
```sql
UPDATE app.d_wiki
SET publication_status = 'published',
    published_ts = NOW(),
    published_by_empid = '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    version = version + 1,
    updated_ts = NOW()
WHERE id = 'a1111111-1111-1111-1111-111111111111';
```

### Example 4: List Published Wiki Pages

**API Request:**
```http
GET /api/v1/wiki?publication_status=published&wiki_type=guide&limit=20
Authorization: Bearer <jwt>
```

**API Response:**
```json
{
  "data": [
    {
      "id": "a1111111-1111-1111-1111-111111111111",
      "name": "Agile Methodology Guide",
      "slug": "agile-methodology-guide",
      "descr": "Comprehensive guide to Agile project management",
      "publication_status": "published",
      "wiki_type": "guide",
      "category": "project-management",
      "published_ts": "2025-01-03T09:00:00Z",
      "published_by_empid": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
      "version": 3,
      "metadata": {
        "attr": {
          "icon": "📚",
          "cover": "gradient-blue"
        }
      }
    },
    {
      "id": "b2222222-2222-2222-2222-222222222222",
      "name": "API Documentation",
      "slug": "api-documentation",
      "publication_status": "published",
      "wiki_type": "guide",
      "category": "technical",
      "published_ts": "2025-01-02T15:00:00Z",
      "version": 5
    }
  ],
  "total": 2,
  "limit": 20,
  "offset": 0
}
```

### Example 5: Get Wiki Hierarchy (Children)

**API Request:**
```http
GET /api/v1/wiki/parent-uuid/children
Authorization: Bearer <jwt>
```

**API Response:**
```json
{
  "data": [
    {
      "id": "child-1-uuid",
      "name": "Agile Principles",
      "slug": "agile-principles",
      "parent_wiki_id": "parent-uuid",
      "sort_order": 1,
      "publication_status": "published"
    },
    {
      "id": "child-2-uuid",
      "name": "Scrum Framework",
      "slug": "scrum-framework",
      "parent_wiki_id": "parent-uuid",
      "sort_order": 2,
      "publication_status": "published"
    }
  ]
}
```

---

## 7. Implementation Guide

### Backend Setup

**1. Database Migration**
```bash
# Run wiki DDL
psql -U app -d app -f /home/rabin/projects/pmo/db/XIX_d_wiki.ddl
```

**2. API Routes Registration**
```typescript
// apps/api/src/modules/index.ts
import { wikiRoutes } from './wiki/routes.js';
import { collabRoutes } from './collab/routes.js';

export async function registerAllRoutes(fastify: FastifyInstance) {
  // ... other routes
  await wikiRoutes(fastify);      // REST endpoints
  await collabRoutes(fastify);    // WebSocket endpoints
}
```

**3. WebSocket Plugin**
```typescript
// apps/api/src/server.ts
await fastify.register(websocket, {
  options: {
    maxPayload: 1048576,      // 1MB max message size
    perMessageDeflate: false  // No compression for low latency
  }
});
```

### Frontend Setup

**1. Install Dependencies**
```bash
cd apps/web
pnpm add yjs y-websocket y-protocols
```

**2. Entity Configuration**
```typescript
// apps/web/src/lib/entityConfig.ts
export const entityConfigs: Record<string, EntityConfig> = {
  wiki: {
    singularName: 'Wiki',
    pluralName: 'Wiki Pages',
    icon: BookOpen,
    tableName: 'd_wiki',
    columns: [
      { key: 'name', label: 'Title', type: 'text' },
      { key: 'publication_status', label: 'Status', type: 'select', loadOptionsFromSettings: true },
      { key: 'wiki_type', label: 'Type', type: 'select' },
      { key: 'published_ts', label: 'Published', type: 'datetime' },
      { key: 'version', label: 'Version', type: 'number' },
    ],
    childEntities: ['artifact', 'task'],
    canCreate: true,
    canEdit: true,
    canDelete: true,
    shareable: true,
  },
};
```

**3. Collaborative Hook Integration**
```typescript
// apps/web/src/components/entity/wiki/WikiDesigner.tsx

const collab = useCollaborativeWiki({
  wikiId: page.id,
  token: localStorage.getItem('auth_token'),
  enabled: Boolean(page.id),
});

// Sync remote changes to local state
useEffect(() => {
  if (collab.isConnected && collab.blocks.length > 0) {
    setBlocks(collab.blocks);
  }
}, [collab.blocks]);

// Sync local changes to Y.js
const handleUpdateBlock = (blockId, updates) => {
  const updatedBlocks = produce(blocks, draft => {
    const block = draft.find(b => b.id === blockId);
    Object.assign(block, updates);
  });
  setBlocks(updatedBlocks);

  if (collab.isConnected) {
    collab.updateBlocks(updatedBlocks);
  }
};
```

---

## 8. Best Practices & Critical Considerations

### Backend Developers

#### 1. Room Lifecycle Management
```typescript
// ✅ ALWAYS check if room is empty before cleanup
if (room.connections.size === 0) {
  await saveWikiContent(wikiId, room.doc);
  rooms.delete(wikiId);
}

// ❌ NEVER delete rooms with active connections
```

#### 2. Y.js Message Handling
```typescript
// ✅ ALWAYS use binary encoding
conn.send(encoding.toUint8Array(encoder), { binary: true });

// ❌ NEVER send as text (breaks protocol)
conn.send(JSON.stringify(data));  // ❌ WRONG
```

#### 3. Database Persistence
```typescript
// ✅ ALWAYS extract blocks from Y.Doc via getMap
const yContent = doc.getMap('wiki');
const blocks = yContent.get('blocks');

// ❌ NEVER directly serialize Y.Doc (includes internal state)
const badContent = doc.toJSON();  // ❌ Includes CRDT metadata
```

### Frontend Developers

#### 1. Hook Dependency Management
```typescript
// ✅ ALWAYS memoize callbacks to prevent infinite loops
const handleUpdateBlock = useCallback((blockId, updates) => {
  // ...
}, [blocks, collab]);  // ← Include ALL dependencies

// ✅ NEVER forget cleanup in useEffect
useEffect(() => {
  provider.connect();
  return () => provider.disconnect();  // ← REQUIRED
}, []);
```

#### 2. Auto-Resize Textarea Implementation
```typescript
// ✅ CORRECT: Auto-resize textarea
const textareaRef = useAutoResizeTextarea(block.content || '');
<textarea
  ref={textareaRef}
  className="w-full bg-transparent border-none outline-none resize-none overflow-hidden"
  style={{ minHeight: '24px' }}
/>

// ❌ WRONG: Fixed rows causes scrollbar
<textarea rows={3} className="w-full" />
```

#### 3. Content Size Limits
```typescript
// Check total content size before save
const totalSize = page.content.blocks.reduce((sum, block) => {
  return sum + (block.content?.length || 0);
}, 0);

if (totalSize > 500000) {  // 500KB limit
  throw new Error('Page content too large. Consider splitting into multiple pages.');
}
```

### Security Considerations

#### 1. RBAC Permission Checking
```typescript
// Always check RBAC before displaying wiki
async function checkWikiAccess(userId: string, wikiId: string, permission: number) {
  const hasAccess = await db.execute(sql`
    SELECT 1 FROM app.entity_id_rbac_map
    WHERE empid = ${userId}
      AND entity = 'wiki'
      AND (entity_id = ${wikiId} OR entity_id = 'all')
      AND ${permission} = ANY(permission)
      AND active_flag = true
  `);

  return hasAccess.length > 0;
}
```

#### 2. Content Sanitization
```typescript
import DOMPurify from 'dompurify';

// Sanitize block content before rendering
const sanitizedContent = DOMPurify.sanitize(block.content);
```

### Performance Optimization

#### 1. Database Indexes
```sql
-- Fast lookup of published pages
CREATE INDEX idx_wiki_published ON d_wiki(publication_status, published_ts DESC)
WHERE active_flag = true;

-- Fast hierarchical queries
CREATE INDEX idx_wiki_parent ON d_wiki(parent_wiki_id, sort_order);

-- Full-text search
CREATE INDEX idx_wiki_search ON d_wiki
USING GIN(to_tsvector('english', name || ' ' || COALESCE(descr, '')));
```

#### 2. Awareness Throttling
```typescript
// RECOMMENDED: Throttle cursor updates
const throttledCursor = throttle((blockId, pos) => {
  awareness.setLocalStateField('cursor', { blockId, pos });
}, 200);  // Max 5 updates/second
```

---

## Summary

### ✅ What's Complete

- **Block-Based Editor**: 11 block types with Notion-style editing
- **Real-Time Collaboration**: Y.js CRDT-based multi-user editing
- **User Presence**: Confluence-style avatars and connection status
- **Auto-Save**: 30s intervals + connection-based triggers
- **Publication Workflow**: Draft → Review → Published → Archived
- **Hierarchical Structure**: Parent-child relationships
- **RBAC Integration**: Permission-based access control
- **API Endpoints**: Full CRUD + WebSocket sync
- **Auto-Resize Textareas**: No scrollbars, content expands naturally

### 📊 Key Metrics

| Metric | Value |
|--------|-------|
| API Endpoints | 8+ (REST + WebSocket) |
| Block Types | 11 types |
| Database Tables | 1 (d_wiki) |
| Version Pattern | In-place with version incrementing |
| Auto-Save Interval | 30 seconds |
| Max Message Payload | 1MB |

---

**Last Updated:** 2025-11-12
**Version:** 3.2.0
**Status:** Production Ready
**Dependencies:** `yjs@13.x`, `y-websocket@2.x`, `y-protocols@1.x`, `@fastify/websocket@11.x`
