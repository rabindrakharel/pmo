# Collaborative Wiki Editing System

> **Real-time multi-user editing with Confluence-style presence indicators**

## Semantics & Business Context

### Purpose
Enable multiple authenticated users to simultaneously edit wiki pages with automatic conflict resolution, real-time synchronization, and visual presence indicators showing who is editing where.

### Business Rules
- **Authentication Required**: Users must have valid JWT tokens and RBAC edit permissions (`permission=1`) on the wiki entity
- **Auto-Save**: Content persists to PostgreSQL every 30 seconds or when the last user disconnects
- **Conflict Resolution**: CRDT-based (Y.js) ensures all concurrent edits merge without conflicts
- **Presence Tracking**: Real-time awareness of active users, their cursor positions, and current edit locations

### User Experience Goals
- **Visibility**: See who's online and where they're editing
- **Confidence**: Changes sync instantly without manual saves or refresh
- **Collaboration**: Work together without stepping on each other's changes
- **Feedback**: Clear connection status and sync indicators

---

## Architecture & Design Patterns

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser Client A                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  WikiDesigner Component                                     │ │
│  │  ├─ useCollaborativeWiki Hook                               │ │
│  │  │  ├─ Y.Doc (CRDT document)                               │ │
│  │  │  └─ WebsocketProvider                                   │ │
│  │  └─ CollaborativePresence UI                               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                            ↕ WebSocket                           │
└─────────────────────────────────────────────────────────────────┘
                               ↕
┌─────────────────────────────────────────────────────────────────┐
│                    Fastify API Server (:4000)                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  WebSocket Handler (/api/v1/collab/wiki/:wikiId)           │ │
│  │  ├─ JWT Authentication                                     │ │
│  │  ├─ RBAC Permission Check                                  │ │
│  │  ├─ Room Manager (Map<wikiId, Room>)                       │ │
│  │  │  ├─ Y.Doc per wiki page                                 │ │
│  │  │  ├─ Awareness (presence tracking)                       │ │
│  │  │  └─ Connection Set<WSConnection>                        │ │
│  │  └─ Auto-save Timer (30s interval)                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                            ↕ SQL                                 │
└─────────────────────────────────────────────────────────────────┘
                               ↕
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  d_wiki table                                              │ │
│  │  └─ content JSONB column                                   │ │
│  │     { type: 'blocks', blocks: [...] }                      │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Design Patterns

#### 1. **Room-Based Multiplexing Pattern**
Each wiki page ID maps to an isolated "room" containing:
- One Y.Doc (shared CRDT state)
- One Awareness instance (user presence)
- Set of WebSocket connections

```typescript
interface Room {
  doc: Y.Doc;              // Shared document state
  awareness: Awareness;     // User presence tracking
  connections: Set<WSConnection>;
  lastSaved: number;        // Auto-save tracking
}

const rooms = new Map<string, Room>();
```

#### 2. **CRDT Synchronization Pattern**
Uses Y.js CRDTs for conflict-free concurrent updates:
- **State-based replication**: Entire document state syncs on connect
- **Operation-based updates**: Incremental changes broadcast to peers
- **Awareness protocol**: Separate channel for ephemeral presence data

```typescript
// Sync Protocol Messages
0: Sync (document state/updates)
1: Awareness (user presence/cursors)

// Sync Steps
Step 1: Client → Server (state vector)
Step 2: Server → Client (missing updates)
```

#### 3. **Middleware Pipeline Pattern**
```
WebSocket Connection Request
  ↓
JWT Verification (fastify.jwt.verify)
  ↓
RBAC Permission Check (entity_id_rbac_map query)
  ↓
Room Join (getRoom + setupCollabConnection)
  ↓
Bi-directional Sync Loop
```

#### 4. **Observer Pattern for UI Reactivity**
```typescript
// Frontend hook subscribes to Y.js changes
yContent.observe(() => {
  const blocks = yContent.get('blocks');
  setBlocks(blocks);  // React state update
});

// Awareness changes trigger presence updates
awareness.on('change', () => {
  const users = Array.from(awareness.getStates());
  setUsers(users);  // React state update
});
```

---

## Database, API & UI/UX Mapping

### Database Schema (`d_wiki`)

#### Content Storage
```sql
-- Existing d_wiki table (no changes)
CREATE TABLE app.d_wiki (
  id uuid PRIMARY KEY,
  name varchar(200) NOT NULL,
  content jsonb DEFAULT NULL,  -- ← Collaborative content stored here
  updated_ts timestamptz DEFAULT now(),
  -- ... other fields
);
```

**Content Structure**:
```json
{
  "type": "blocks",
  "blocks": [
    {
      "id": "block-1699123456789",
      "type": "heading",
      "content": "Introduction",
      "level": 1,
      "styles": {},
      "properties": {}
    },
    {
      "id": "block-1699123456790",
      "type": "paragraph",
      "content": "This is collaborative content...",
      "styles": {},
      "properties": {}
    }
  ]
}
```

### API Endpoints

#### WebSocket Endpoint (Real-Time Sync)
```
ws://localhost:4000/api/v1/collab/wiki/:wikiId?token=<jwt>

Method: WebSocket Upgrade (GET)
Auth: JWT token in query parameter
RBAC: permission=1 (edit) on entity='wiki'
```

**Connection Flow**:
1. Client opens WebSocket with `token` query parameter
2. Server verifies JWT → extracts `userId`, `userName`
3. Server checks RBAC: `SELECT FROM entity_id_rbac_map WHERE empid=? AND entity='wiki' AND permission @> ARRAY[1]`
4. Server calls `setupCollabConnection(socket, wikiId, userId, userName)`
5. Server sends Sync Step 1 (initial document state)
6. Client responds with Sync Step 2 (acknowledgement + updates)
7. Bidirectional update stream begins

**Message Protocol** (binary):
```
Byte 0: Message Type
  - 0x00: Sync protocol message
  - 0x01: Awareness protocol message

Sync Message (type 0):
  Byte 1+: Y.js sync protocol data

Awareness Message (type 1):
  Byte 1+: Awareness state update (user presence)
```

#### REST Endpoint (Active Users)
```
GET /api/v1/collab/wiki/:wikiId/users
Authorization: Bearer <jwt>

Response 200:
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

### Frontend Components

#### File Structure
```
apps/web/src/
├── hooks/
│   └── useCollaborativeWiki.ts        # Core collaboration hook
├── components/entity/wiki/
│   ├── WikiDesigner.tsx               # Main editor (updated)
│   └── CollaborativePresence.tsx      # Presence UI components
```

#### Component Hierarchy
```
WikiDesigner
├── UniversalDesigner
│   ├── Header
│   │   ├── Title
│   │   └── Subtitle
│   │       └── <CollaborativePresence />  ← Shows users + status
│   ├── Toolbar (left panel)
│   │   └── WikiBlockToolbar
│   ├── Canvas (center)
│   │   └── WikiDraggableBlock[] (with <CollaborativeCursor />)
│   └── Properties (right panel)
│       └── WikiPropertiesPanel
```

#### Hook Integration
```typescript
// apps/web/src/components/entity/wiki/WikiDesigner.tsx

const collab = useCollaborativeWiki({
  wikiId: page.id,
  token: localStorage.getItem('auth_token'),
  enabled: Boolean(page.id),
});

// Sync local changes to Y.js
useEffect(() => {
  if (collab.isConnected && collab.blocks.length > 0) {
    setBlocks(collab.blocks);  // Remote → Local
  }
}, [collab.blocks]);

// Sync block updates to Y.js
const handleUpdateBlock = (blockId, updates) => {
  const updatedBlocks = produce(blocks, draft => {
    const block = draft.find(b => b.id === blockId);
    Object.assign(block, updates);
  });
  setBlocks(updatedBlocks);

  if (collab.isConnected) {
    collab.updateBlocks(updatedBlocks);  // Local → Remote
  }
};
```

---

## Central Configuration & Middleware

### Backend Registration

#### Module Registration (`apps/api/src/modules/index.ts`)
```typescript
import { collabRoutes } from './collab/routes.js';

export async function registerAllRoutes(fastify: FastifyInstance) {
  // ... other routes

  // Collaborative editing routes (WebSocket + presence)
  await collabRoutes(fastify);

  // ... other routes
}
```

#### WebSocket Plugin
```typescript
// apps/api/src/server.ts (already registered)
await fastify.register(websocket, {
  options: {
    maxPayload: 1048576,      // 1MB max message size
    perMessageDeflate: false  // No compression for low latency
  }
});
```

### Authentication Flow

#### JWT Verification
```typescript
// apps/api/src/modules/collab/routes.ts

fastify.get('/api/v1/collab/wiki/:wikiId', {
  websocket: true,
}, async (connection, request) => {
  const token = (request.query as any).token;

  let decoded: any;
  try {
    decoded = fastify.jwt.verify(token);
  } catch (error) {
    connection.socket.close(1008, 'Invalid authentication token');
    return;
  }

  const userId = decoded.sub;
  const userName = decoded.name || decoded.email;

  // ... proceed to RBAC check
});
```

#### RBAC Permission Check
```typescript
// Check edit permission on wiki
const accessCheck = await db.execute(sql`
  SELECT 1 FROM app.entity_id_rbac_map rbac
  WHERE rbac.empid = ${userId}
    AND rbac.entity = 'wiki'
    AND (rbac.entity_id = ${wikiId} OR rbac.entity_id = 'all')
    AND rbac.active_flag = true
    AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
    AND 1 = ANY(rbac.permission)  -- Edit permission
`);

if (accessCheck.length === 0) {
  connection.socket.close(1008, 'Insufficient permissions');
  return;
}
```

### Configuration Constants

#### Backend (`apps/api/src/modules/collab/wiki-collab-handler.ts`)
```typescript
const AUTOSAVE_INTERVAL = 30000;  // 30 seconds
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const colors = [
  '#3B82F6',  // blue
  '#10B981',  // green
  '#F59E0B',  // amber
  '#EF4444',  // red
  '#8B5CF6',  // purple
  '#EC4899',  // pink
  '#06B6D4',  // cyan
  '#F97316',  // orange
];
```

#### Frontend (`apps/web/src/hooks/useCollaborativeWiki.ts`)
```typescript
const wsUrl = import.meta.env.VITE_API_URL?.replace('http', 'ws') || 'ws://localhost:4000';
```

---

## User Interaction Flow Examples

### Scenario 1: User Opens Wiki for Editing

1. **User navigates to `/wiki/{id}/edit`**
   - WikiEditorPage loads
   - Fetches wiki data: `GET /api/v1/wiki/:id`

2. **WikiDesigner initializes collaborative hook**
   ```typescript
   useCollaborativeWiki({
     wikiId: page.id,
     token: localStorage.getItem('auth_token'),
     enabled: true
   })
   ```

3. **WebSocket connection established**
   - Browser: `ws://localhost:4000/api/v1/collab/wiki/{id}?token=<jwt>`
   - Server: JWT verification → RBAC check → Room join
   - Server sends initial sync (existing wiki content)

4. **UI updates**
   - Connection status: "Connecting" → "Live" (green indicator)
   - Presence panel shows "1 person editing" with user's avatar
   - Content blocks render

### Scenario 2: Second User Joins Same Wiki

1. **User B opens same wiki**
   - Separate WebSocket connection established
   - Server adds User B to existing room

2. **Both users see updates**
   - User A sees: "2 people editing" + User B's avatar
   - User B sees: "2 people editing" + User A's avatar
   - Both awareness states broadcast to all room members

3. **Real-time editing**
   - User A types in block "block-123"
     - Local: `handleUpdateBlock` → `setBlocks` → `collab.updateBlocks`
     - Y.js: Local update → Sync message → Server
     - Server: Broadcast to all connections except sender
     - User B: Receives sync message → Y.Doc applies → React state updates
   - User B sees changes instantly (no refresh needed)

4. **Cursor indicators**
   - User A's cursor tracked via `collab.updateCursor(blockId, position)`
   - Awareness update broadcast
   - User B sees small avatar badge on block being edited by User A

### Scenario 3: Connection Lost & Recovery

1. **Network interruption**
   - WebSocket disconnects
   - Status indicator: "Live" → "Offline" (red)
   - User continues editing locally

2. **Local state preserved**
   - Changes stored in React state
   - Y.js doc retains local operations

3. **Reconnection**
   - WebSocket re-establishes automatically
   - Y.js syncs state vector
   - Server sends missing updates
   - Status: "Offline" → "Connecting" → "Live"

4. **Conflict resolution**
   - Y.js CRDT merges local + remote changes automatically
   - No user intervention needed

### Scenario 4: Last User Leaves

1. **User A closes tab**
   - WebSocket `close` event fires
   - Server: `room.connections.delete(connection)`
   - Awareness state removed

2. **Auto-save triggers**
   - Room cleanup detects `connections.size === 0`
   - `saveWikiContent(wikiId, room.doc)` executes
   - Database update: `UPDATE d_wiki SET content = ?, updated_ts = NOW()`

3. **Room cleanup**
   - Auto-save timer clears
   - Room removed from `rooms` Map
   - Memory released

---

## Critical Considerations When Building

### For Backend Developers

#### 1. Room Lifecycle Management
```typescript
// ALWAYS check if room is empty before cleanup
if (room.connections.size === 0) {
  await saveWikiContent(wikiId, room.doc);
  rooms.delete(wikiId);
}

// NEVER delete rooms with active connections
```

#### 2. Authentication Edge Cases
```typescript
// ALWAYS close with specific error codes
connection.socket.close(1008, 'Authentication required');  // 1008 = Policy Violation

// NEVER expose internal errors to client
connection.socket.close(1011, 'Internal server error');  // 1011 = Server Error
```

#### 3. Y.js Message Handling
```typescript
// ALWAYS use binary encoding
conn.send(encoding.toUint8Array(encoder), { binary: true });

// NEVER send as text (breaks protocol)
conn.send(JSON.stringify(data));  // ❌ WRONG
```

#### 4. Database Persistence
```typescript
// ALWAYS extract blocks from Y.Doc via getMap
const yContent = doc.getMap('wiki');
const blocks = yContent.get('blocks');

// NEVER directly serialize Y.Doc (internal state is large)
const badContent = doc.toJSON();  // ❌ Includes internal CRDT metadata
```

#### 5. Heartbeat for Dead Connections
```typescript
// REQUIRED: Prevent zombie connections
setInterval(() => {
  rooms.forEach(room => {
    room.connections.forEach(conn => {
      if (!conn.isAlive) {
        conn.terminate();  // Force close dead connection
        return;
      }
      conn.isAlive = false;
      conn.ping();  // Next pong will set isAlive = true
    });
  });
}, 30000);
```

### For Frontend Developers

#### 1. Hook Dependency Management
```typescript
// ALWAYS memoize callbacks to prevent infinite loops
const handleUpdateBlock = useCallback((blockId, updates) => {
  // ...
}, [blocks, collab]);  // ← Include ALL dependencies

// NEVER forget cleanup in useEffect
useEffect(() => {
  provider.connect();
  return () => provider.disconnect();  // ← REQUIRED
}, []);
```

#### 2. Sync Direction Control
```typescript
// CORRECT: Separate local vs remote state updates
useEffect(() => {
  // Remote → Local (only when connected)
  if (collab.isConnected && collab.blocks.length > 0) {
    setBlocks(collab.blocks);
  }
}, [collab.blocks, collab.isConnected]);

// Local → Remote (on user action)
const handleAddBlock = () => {
  const updated = [...blocks, newBlock];
  setBlocks(updated);  // Update local state
  collab.updateBlocks(updated);  // Sync to Y.js
};
```

#### 3. Presence State Management
```typescript
// ALWAYS clear cursor state on blur/unmount
useEffect(() => {
  return () => collab.clearCursor();
}, []);

// NEVER send cursor updates too frequently (debounce)
const debouncedUpdateCursor = debounce((blockId, pos) => {
  collab.updateCursor(blockId, pos);
}, 100);
```

#### 4. Token Refresh Handling
```typescript
// REQUIRED: Reconnect on token refresh
useEffect(() => {
  const token = localStorage.getItem('auth_token');
  if (token !== prevToken) {
    provider.disconnect();
    // Re-initialize with new token
  }
}, [localStorage.getItem('auth_token')]);
```

### Performance Optimization

#### 1. Message Batching (Y.js handles automatically)
```typescript
// CORRECT: Multiple updates batched in single transaction
doc.transact(() => {
  yContent.set('blocks', updatedBlocks);
  // Multiple sets/deletes within transact = single sync message
});

// AVOID: Rapid individual updates
blocks.forEach(block => {
  doc.getMap('wiki').set(block.id, block);  // ❌ N sync messages
});
```

#### 2. Awareness Throttling
```typescript
// RECOMMENDED: Throttle cursor updates
const throttledCursor = throttle((blockId, pos) => {
  awareness.setLocalStateField('cursor', { blockId, pos });
}, 200);  // Max 5 updates/second
```

#### 3. Memory Management
```typescript
// REQUIRED: Clean up Y.Doc on unmount
useEffect(() => {
  const doc = new Y.Doc();
  return () => doc.destroy();  // ← Free CRDT memory
}, []);
```

### Security Considerations

#### 1. Input Validation
```typescript
// ALWAYS validate wikiId format
if (!/^[0-9a-f-]{36}$/i.test(wikiId)) {
  return reply.status(400).send({ error: 'Invalid wiki ID' });
}
```

#### 2. RBAC Refresh
```typescript
// OPTIONAL: Re-check permissions periodically
setInterval(async () => {
  const hasPermission = await checkRBAC(userId, wikiId);
  if (!hasPermission) {
    connection.close(1008, 'Permissions revoked');
  }
}, 60000);  // Every minute
```

#### 3. Rate Limiting
```typescript
// RECOMMENDED: Limit messages per user
const messageCounts = new Map<string, number>();

connection.on('message', () => {
  const count = messageCounts.get(userId) || 0;
  if (count > 1000) {  // 1000 messages/minute
    connection.close(1008, 'Rate limit exceeded');
    return;
  }
  messageCounts.set(userId, count + 1);
});
```

### Testing Checklist

#### Backend
- [ ] JWT token validation (valid, expired, malformed)
- [ ] RBAC permission check (edit, view-only, no access)
- [ ] Room creation/join/leave lifecycle
- [ ] Auto-save triggers (periodic, on last user disconnect)
- [ ] Heartbeat detects dead connections
- [ ] Concurrent message handling (race conditions)

#### Frontend
- [ ] Connection status transitions (connecting → connected → disconnected)
- [ ] Presence updates (user join, user leave, avatar rendering)
- [ ] Content sync (local → remote, remote → local)
- [ ] Conflict resolution (two users edit same block)
- [ ] Cursor indicators (show/hide, position accuracy)
- [ ] Reconnection after network loss
- [ ] Memory leaks (Y.Doc cleanup, effect cleanup)

---

**Last Updated**: 2025-11-05
**Implementation Status**: ✅ Production Ready
**Dependencies**: `yjs@13.x`, `y-websocket@2.x`, `y-protocols@1.x`, `@fastify/websocket@11.x`
**Affected Files**:
- Backend: `apps/api/src/modules/collab/`
- Frontend: `apps/web/src/hooks/useCollaborativeWiki.ts`, `apps/web/src/components/entity/wiki/`
