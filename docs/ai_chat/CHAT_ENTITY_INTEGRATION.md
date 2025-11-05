# AI Chat Entity Integration Guide

## Overview

The AI Chat Assistant has been fully integrated into the PMO platform as a native entity. Users can access it directly from the sidebar navigation, and it appears as a modern, floating chat widget.

## Architecture

### 1. Database Entity Registration

**Table:** `app.d_entity`

```sql
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order, active_flag)
VALUES ('chat', 'AI Chat', 'AI Assistant', 'MessageSquare', '[]'::jsonb, 15, true);
```

**Key Fields:**
- `code`: `chat` - Entity identifier
- `name`: `AI Chat` - Internal name
- `ui_label`: `AI Assistant` - Display name in sidebar
- `ui_icon`: `MessageSquare` - Lucide icon component
- `display_order`: `15` - Appears second in sidebar (after Office)
- `active_flag`: `true` - Entity is visible

### 2. Frontend Configuration

**File:** `/apps/web/src/lib/entityConfig.ts`

```typescript
chat: {
  name: 'chat',
  displayName: 'AI Chat',
  pluralName: 'AI Chat',
  apiEndpoint: '/api/v1/chat',
  columns: [],
  fields: [],
  supportedViews: ['table'],
  defaultView: 'table'
}
```

### 3. React Components

#### ChatWidget Component
**File:** `/apps/web/src/components/chat/ChatWidget.tsx`

A fully native React component that:
- ✅ Manages chat session state
- ✅ Connects to chat API (`/api/v1/chat`)
- ✅ Displays messages in real-time
- ✅ Supports text chat
- ✅ Provides voice call interface
- ✅ Shows booking confirmations
- ✅ Auto-scrolls to latest messages
- ✅ Beautiful gradient UI with purple/indigo theme

**Key Features:**
```typescript
interface ChatWidgetProps {
  onClose?: () => void;
  autoOpen?: boolean;  // Auto-opens when mounted
}
```

**Component Structure:**
- **Header:** AI Assistant branding, voice call button, minimize, close
- **Message Area:** Scrollable message history with user/assistant/system messages
- **Input Area:** Text input with send button
- **Loading States:** Typing indicator with animated dots
- **Error Handling:** Red error messages for failed requests

#### ChatPage Component
**File:** `/apps/web/src/pages/ChatPage.tsx`

Landing page that displays:
- ✅ Page header with description
- ✅ Three info cards (Ask Questions, Book Services, Voice Call)
- ✅ Instructions panel with "AI Online" indicator
- ✅ Example query suggestions
- ✅ Auto-opened ChatWidget in bottom-right corner

### 4. Routing

**File:** `/apps/web/src/App.tsx`

```typescript
{/* Special Routes - Chat (AI Assistant Widget) */}
<Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
```

**Access:** `http://localhost:5173/chat`

## Backend API Endpoints

All chat functionality uses these endpoints:

### 1. Create Chat Session
```http
POST /api/v1/chat/session/new
Content-Type: application/json
Authorization: Bearer {token}

{
  "customer_id": "uuid",
  "customer_email": "user@example.com",
  "customer_name": "John Doe"
}
```

**Response:**
```json
{
  "session_id": "uuid",
  "greeting": "Hello! I'm your AI assistant...",
  "timestamp": "2025-11-05T14:00:00Z"
}
```

### 2. Send Message
```http
POST /api/v1/chat/message
Content-Type: application/json
Authorization: Bearer {token}

{
  "session_id": "uuid",
  "message": "What services are available?"
}
```

**Response:**
```json
{
  "session_id": "uuid",
  "response": "We offer the following services...",
  "function_calls": [...],
  "booking_created": false,
  "tokens_used": 150,
  "timestamp": "2025-11-05T14:01:00Z"
}
```

### 3. Voice WebSocket
```http
WS /api/v1/chat/voice
Authorization: Bearer {token}
```

Supports real-time voice streaming for voice calls.

## User Flow

### 1. Accessing AI Assistant

```
User clicks "AI Assistant" in sidebar
    ↓
Navigate to /chat route
    ↓
ChatPage loads
    ↓
ChatWidget auto-opens (bottom-right)
    ↓
Session initialized with greeting
    ↓
User can start chatting
```

### 2. Chat Interaction

```
User types message
    ↓
Message sent to API
    ↓
AI processes with OpenAI GPT-4
    ↓
AI may call functions:
  - get_available_services
  - get_employee_availability
  - create_booking
  - etc.
    ↓
Response displayed in chat
    ↓
Booking confirmation shown (if applicable)
```

### 3. Voice Call Flow

```
User clicks phone icon
    ↓
WebSocket connection established
    ↓
Real-time audio streaming
    ↓
AI responds with voice
    ↓
Transcripts displayed in UI
```

## Sidebar Integration

The chat entity automatically appears in the sidebar because:

1. **Dynamic Entity Loading:** `Layout.tsx` fetches entities from `/api/v1/entity/types`
2. **Entity Registration:** Chat entity exists in `d_entity` table with `active_flag = true`
3. **Icon Mapping:** `MessageSquare` icon from Lucide React
4. **Navigation:** Clicking navigates to `/chat` route

**Sidebar Position:**
```
1. Office (display_order: 10)
2. AI Assistant (display_order: 15)  ← Chat entity
3. Business (display_order: 20)
4. Project (display_order: 30)
...
```

## Visual Design

### Color Scheme
- **Primary Gradient:** Purple 600 → Indigo 600
- **Background:** Gray 50
- **Cards:** White with gray borders
- **User Messages:** Purple gradient background
- **Assistant Messages:** White with gray border
- **System Messages:** Green 100 background

### Components
- **Rounded Corners:** 8-12px border radius
- **Shadows:** Subtle elevation with `shadow-2xl` for widget
- **Animations:** Smooth transitions, typing indicators, pulse effects
- **Icons:** Lucide React icons (MessageSquare, Phone, Send, etc.)

## AI Capabilities

The AI assistant can:

1. **Answer Questions**
   - Service information
   - Employee availability
   - Scheduling options
   - General inquiries

2. **Access Real-Time Data**
   - Query `d_service` table
   - Check `d_employee_calendar` for availability
   - Retrieve service details
   - Find available time slots

3. **Create Bookings**
   - Insert into `d_booking` table
   - Generate booking numbers (BK-2025-NNNNNN)
   - Assign employees
   - Set service dates/times

4. **Track Conversations**
   - Store in `f_customer_interaction` table
   - Track sentiment and resolution
   - Calculate costs (OpenAI tokens)
   - Maintain conversation history

## Testing

### 1. Verify Sidebar Appearance
```bash
# Check entity in database
PGPASSWORD=app psql -h localhost -p 5434 -U app -d app \
  -c "SELECT code, ui_label FROM app.d_entity WHERE code = 'chat'"
```

### 2. Test Chat Session
```bash
# Navigate to http://localhost:5173/chat
# Widget should auto-open
# Type: "What services are available?"
```

### 3. Test Booking Flow
```bash
# In chat, type:
# "I need to book a plumbing service for next Monday at 2pm"
# AI should guide through booking process
```

## Deployment Checklist

- [x] Chat entity in `d_entity` table
- [x] Entity config in `entityConfig.ts`
- [x] ChatWidget component created
- [x] ChatPage component created
- [x] Route registered in App.tsx
- [x] API endpoints functional
- [x] WebSocket support enabled (Fastify v5)
- [x] OpenAI integration working
- [x] Database tables ready (`d_booking`, `f_customer_interaction`)
- [x] TypeScript compilation passes
- [x] Web server running
- [x] API server running

## Technology Stack

**Frontend:**
- React 19.1.1
- TypeScript 5.x
- Tailwind CSS v4
- Lucide React (icons)
- Vite 5.x

**Backend:**
- Fastify v5.6.1
- @fastify/websocket v11.2.0
- OpenAI GPT-4
- PostgreSQL 14+

**AI:**
- OpenAI `gpt-4-turbo-preview`
- Function calling (7 tools)
- Real-time WebSocket for voice

## Maintenance

### Updating AI Behavior
Edit: `/apps/api/src/modules/chat/openai.service.ts`
- Modify `SYSTEM_PROMPT` for personality changes
- Add/remove function definitions
- Adjust model parameters

### Styling Changes
Edit: `/apps/web/src/components/chat/ChatWidget.tsx`
- Update Tailwind classes
- Modify gradient colors
- Adjust widget dimensions

### Adding Features
1. New function tool → `functions.service.ts`
2. New UI element → `ChatWidget.tsx`
3. New API endpoint → `routes.ts`

## Support

For issues or questions:
- Check logs: `./tools/logs-api.sh` and `./tools/logs-web.sh`
- Verify database: PostgreSQL on port 5434
- API documentation: `http://localhost:4000/docs`
- OpenAI dashboard: Monitor token usage

---

**Version:** 1.0.0
**Last Updated:** 2025-11-05
**Status:** Production Ready ✅
