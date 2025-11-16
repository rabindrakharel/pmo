# Conversation Service

> **Chat history management and message persistence for AI conversations**

**File**: `apps/api/src/modules/chat/conversation.service.ts`
**Used By**: Chat routes, Voice LangGraph Service, Agent Orchestrator Service

---

## How It Works (Building Blocks)

### Block 1: Message Storage

**Database Structure**:
- Stores all chat messages in persistent storage
- Each message has: role (user/assistant/system), content, timestamp, session ID
- Links messages to conversation sessions
- Supports metadata (token count, model used, function calls)

**Message Types**:
- **User messages** - Questions, commands from user
- **Assistant messages** - AI responses
- **System messages** - Context, instructions
- **Function messages** - Function call results

### Block 2: Conversation Session Management

**Session Lifecycle**:
- Creates new session on first message
- Retrieves existing session by ID
- Maintains conversation context across messages
- Soft-deletes sessions (preserves history)

**Session Metadata**:
- User ID (employee who started conversation)
- Title (auto-generated from first message)
- Created/updated timestamps
- Active flag for soft delete

### Block 3: Message History Retrieval

**History Loading**:
- Loads messages by session ID
- Orders by timestamp (chronological)
- Limits to recent N messages (prevents context overflow)
- Filters system messages for user-facing views

**Context Window Management**:
- Truncates old messages when token limit approached
- Keeps recent messages for context
- Preserves critical system messages
- Summarizes truncated history (future)

### Block 4: Message Append Operation

**Idempotent Append**:
- Adds new message to conversation
- Updates session updated_ts
- Increments message counter
- Triggers auto-save to database

**Deduplication**:
- Checks for duplicate messages (same content + timestamp)
- Prevents accidental double-sends
- Returns existing message if duplicate detected

---

## Operational Flow

### Create New Conversation

**Sequence**:
1. User sends first message via chat API
2. Service checks if session ID provided
3. If no session → Create new session record
4. Generate session title from first message
5. Insert session into database
6. Return session ID to client

### Add Message to Conversation

**Sequence**:
1. Client sends message with session ID
2. Service validates session exists
3. Create message record:
   - Set role (user/assistant)
   - Set content
   - Link to session ID
   - Set timestamp
4. Insert message into database
5. Update session updated_ts
6. Return message confirmation

### Load Conversation History

**Sequence**:
1. Client requests history for session ID
2. Service queries messages WHERE session_id = X
3. Order by created_ts ASC
4. Filter by role (if requested)
5. Limit to recent 50 messages (configurable)
6. Return message array

### Resume Conversation

**Sequence**:
1. Client provides session ID
2. Load session metadata
3. Load recent message history (last 10 messages)
4. Build context for LLM:
   - System message with instructions
   - Recent conversation history
   - Current user message
5. Send context to LLM
6. Append LLM response to conversation
7. Return response to client

---

**File**: `apps/api/src/modules/chat/conversation.service.ts`
