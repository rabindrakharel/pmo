# AI Chat Widget - Complete Documentation

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Installation & Setup](#installation--setup)
4. [API Documentation](#api-documentation)
5. [Widget Integration](#widget-integration)
6. [Database Schema](#database-schema)
7. [OpenAI Function Tools](#openai-function-tools)
8. [Configuration](#configuration)
9. [Analytics & Monitoring](#analytics--monitoring)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The **AI Chat Widget** is an embeddable customer service solution powered by OpenAI's GPT-4 that allows website visitors to:
- Chat with an intelligent AI agent about services
- Check employee availability in real-time
- Book appointments directly through conversation
- Get instant answers to service questions

### Key Features

- **✅ AI-Powered Conversations** - GPT-4 with function calling for intelligent responses
- **📅 Direct Booking** - Customers can book services without leaving the chat
- **🔍 Real-time Availability** - Checks employee schedules against calendar
- **💾 Full Analytics** - All conversations stored for training and analysis
- **🎨 Customizable** - Theme, position, and branding options
- **📱 Responsive** - Works on desktop and mobile devices
- **🔒 Secure** - HTTPS, rate limiting, and data privacy compliant

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Client's Website                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  <iframe> Embedded Widget (React)                    │  │
│  │  - Chat UI                                           │  │
│  │  - Message History                                   │  │
│  │  - Booking Confirmation                              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↕ HTTPS/REST
┌─────────────────────────────────────────────────────────────┐
│              PMO Platform Backend (Fastify API)              │
│  /api/v1/chat/*                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  OpenAI Service (GPT-4 + Function Calling)          │  │
│  │  - Conversation Management                           │  │
│  │  - 7 Function Tools                                  │  │
│  │  - Token/Cost Tracking                               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                       │
│  - f_customer_interaction (conversations)                   │
│  - d_booking (appointments)                                 │
│  - d_service (service catalog)                              │
│  - d_employee (staff)                                       │
│  - d_calendar (schedules)                                   │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend Widget:**
- React 18.3
- TypeScript
- Vite (build tool)
- Pure CSS (no framework dependencies)

**Backend API:**
- Fastify (Node.js framework)
- PostgreSQL 14+
- OpenAI GPT-4 API
- TypeScript (ESM modules)

---

## Installation & Setup

### Prerequisites

- Node.js 18+ and pnpm
- PostgreSQL 14+
- OpenAI API key
- Existing PMO platform installation

### Step 1: Database Setup

Import the booking table schema:

```bash
cd /home/rabin/projects/pmo
./tools/db-import.sh

# Or manually import:
psql -U app -d app -f db/43_d_booking.ddl
```

### Step 2: Configure OpenAI API Key

Add to your `.env` file:

```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4-turbo-preview  # Optional, defaults to this
```

### Step 3: Install Widget Dependencies

```bash
cd apps/widget
pnpm install
```

### Step 4: Build Widget for Production

```bash
pnpm run build
```

This creates `/public/widget/widget.js` which can be embedded in any website.

### Step 5: Start API Server

```bash
cd apps/api
pnpm run dev
```

The API will be available at `http://localhost:4000`.

### Step 6: Test Widget Locally

```bash
cd apps/widget
pnpm run dev
```

Visit `http://localhost:5174` to see the demo page.

---

## API Documentation

### Base URL

```
http://localhost:4000/api/v1/chat  (development)
https://pmo.huronhome.ca/api/v1/chat  (production)
```

### Endpoints

#### POST /session/new

Create a new chat session.

**Request:**
```json
{
  "customer_id": "uuid",          // Optional
  "customer_email": "string",     // Optional
  "customer_name": "string",      // Optional
  "referrer_url": "string",       // Optional
  "metadata": {}                  // Optional
}
```

**Response:**
```json
{
  "session_id": "uuid",
  "greeting": "Hello! I'm here to help...",
  "timestamp": "2025-11-04T14:30:00Z"
}
```

#### POST /message

Send a message and get AI response.

**Request:**
```json
{
  "session_id": "uuid",
  "message": "I need HVAC service next week"
}
```

**Response:**
```json
{
  "session_id": "uuid",
  "response": "I can help you schedule HVAC service...",
  "function_calls": [
    {
      "function_name": "get_available_services",
      "arguments": { "service_category": "HVAC" },
      "result": [...],
      "success": true
    }
  ],
  "booking_created": false,
  "booking_number": null,
  "tokens_used": 850,
  "timestamp": "2025-11-04T14:30:05Z"
}
```

#### GET /session/:sessionId/history

Get conversation history.

**Response:**
```json
{
  "session_id": "uuid",
  "messages": [
    {
      "role": "user",
      "content": "What services do you offer?",
      "timestamp": "2025-11-04T14:30:00Z"
    },
    {
      "role": "assistant",
      "content": "We offer HVAC, Plumbing...",
      "timestamp": "2025-11-04T14:30:05Z"
    }
  ],
  "booking_created": false,
  "total_messages": 4
}
```

#### POST /session/:sessionId/close

Close a chat session.

**Request:**
```json
{
  "resolution": "resolved" // 'resolved' | 'abandoned' | 'escalated'
}
```

**Response:**
```json
{
  "success": true,
  "message": "Session closed successfully"
}
```

#### GET /analytics/recent

Get recent interactions for analytics (admin only).

**Query Parameters:**
- `limit` (number, optional): Number of interactions to return (default: 50)

**Response:**
```json
{
  "count": 25,
  "interactions": [
    {
      "id": "uuid",
      "interaction_number": "INT-2025-00123",
      "interaction_datetime": "2025-11-04T14:30:00Z",
      "customer_name": "Anonymous",
      "sentiment_label": "positive",
      "resolution_status": "resolved",
      "duration_seconds": 180,
      "first_contact_resolution": true
    }
  ]
}
```

---

## Widget Integration

### Basic Integration

Add this code to any webpage:

```html
<!-- Step 1: Add container -->
<div id="huron-chat-widget"></div>

<!-- Step 2: Load widget script -->
<script src="https://your-domain.com/widget/widget.js"></script>

<!-- Step 3: Initialize -->
<script>
  HuronChatWidget.init({
    containerId: 'huron-chat-widget',
    apiUrl: 'https://api.your-domain.com',
    theme: 'light',              // 'light' or 'dark'
    position: 'bottom-right',    // 'bottom-right' or 'bottom-left'
    autoOpen: false              // Auto-open on page load
  });
</script>
```

### Advanced Configuration

```javascript
HuronChatWidget.init({
  containerId: 'huron-chat-widget',
  apiUrl: 'https://api.your-domain.com',
  theme: 'light',
  position: 'bottom-right',
  autoOpen: false,

  // Pre-fill customer information (if known)
  customerId: 'customer-uuid',
  customerEmail: 'john@example.com',
  customerName: 'John Doe',

  // Custom greeting message
  greeting: 'Welcome to Huron! How can we help you today?'
});
```

### Auto-Initialize with Data Attributes

```html
<div id="huron-chat-widget"></div>
<script
  src="https://your-domain.com/widget/widget.js"
  data-huron-auto-init="true"
  data-huron-container="huron-chat-widget"
  data-huron-api-url="https://api.your-domain.com"
  data-huron-theme="light"
  data-huron-position="bottom-right"
></script>
```

### Programmatic Control

```javascript
// Destroy widget
HuronChatWidget.destroy();

// Re-initialize with different config
HuronChatWidget.init({ /* new config */ });
```

---

## Database Schema

### f_customer_interaction

Stores all chat conversations (already exists).

**Key Fields:**
- `id` (uuid): Session identifier
- `interaction_number` (varchar): Human-readable ID (INT-2025-00001)
- `interaction_type` (varchar): 'chat'
- `channel` (varchar): 'live_chat'
- `customer_id` (uuid): Links to d_cust (NULL for anonymous)
- `content_text` (text): JSON array of messages
- `sentiment_score` (decimal): -100 to +100
- `resolution_status` (varchar): 'open', 'resolved', 'escalated'
- `source_system` (varchar): 'ai_chat_widget'

### d_booking

Stores service appointments created through chat.

**Key Fields:**
- `id` (uuid): Booking identifier
- `booking_number` (varchar): Human-readable ID (BK-2025-000001)
- `booking_source` (varchar): 'ai_widget'
- `customer_name` (varchar): Full name
- `customer_phone` (varchar): Contact number
- `customer_email` (varchar): Email (optional)
- `service_id` (uuid): Links to d_service
- `requested_date` (date): Preferred service date
- `requested_time_start` (time): Preferred time
- `assigned_employee_id` (uuid): Assigned technician
- `booking_status` (varchar): 'pending', 'confirmed', 'completed', 'cancelled'
- `interaction_session_id` (uuid): Links to f_customer_interaction

**See:** [Database DDL Files](#)
- `/db/43_d_booking.ddl`
- `/db/41_f_customer_interaction.ddl`

---

## OpenAI Function Tools

The AI agent has access to 7 function tools for real-time data access:

### 1. get_available_services

Lists all available services, optionally filtered by category.

**Arguments:**
```typescript
{
  service_category?: 'HVAC' | 'Plumbing' | 'Electrical' | 'Landscaping' | 'General Contracting'
}
```

**Returns:**
```typescript
Array<{
  id: string;
  name: string;
  service_category: string;
  standard_rate_amt: number;
  estimated_hours: number;
}>
```

### 2. get_service_details

Get detailed information about a specific service.

**Arguments:**
```typescript
{
  service_id: string;
}
```

### 3. get_employee_availability

Check which employees are available for a service on a date.

**Arguments:**
```typescript
{
  service_category: string;
  requested_date: string; // YYYY-MM-DD
}
```

**Returns:**
```typescript
Array<{
  employee_id: string;
  employee_name: string;
  title: string;
  available_slots: string[]; // ['09:00', '10:00', ...]
}>
```

### 4. get_available_time_slots

Get specific time slots for an employee.

**Arguments:**
```typescript
{
  employee_id: string;
  date: string; // YYYY-MM-DD
}
```

### 5. create_booking

Create a service booking/appointment.

**Arguments:**
```typescript
{
  service_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  customer_address: string;
  customer_city?: string;
  customer_province?: string;
  requested_date: string; // YYYY-MM-DD
  requested_time_start: string; // HH:MM
  assigned_employee_id?: string;
  special_instructions?: string;
  urgency_level?: 'low' | 'normal' | 'high' | 'emergency';
}
```

**Returns:**
```typescript
{
  booking_id: string;
  booking_number: string; // BK-2025-000001
  service_name: string;
  requested_date: string;
  requested_time: string;
  estimated_cost: number;
  status: string;
}
```

### 6. get_booking_info

Retrieve details of an existing booking.

**Arguments:**
```typescript
{
  booking_number: string; // BK-2025-000001
}
```

### 7. cancel_booking

Cancel an existing booking.

**Arguments:**
```typescript
{
  booking_number: string;
  cancellation_reason: string;
}
```

---

## Configuration

### Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-your-key-here

# Optional
OPENAI_MODEL=gpt-4-turbo-preview
NODE_ENV=production
API_URL=https://api.your-domain.com
```

### System Prompt Customization

Edit `apps/api/src/modules/chat/openai.service.ts`:

```typescript
const SYSTEM_PROMPT = `
You are an AI customer service assistant for [YOUR COMPANY NAME]...
`;
```

### Widget Styling

Override CSS variables in your embedding page:

```css
.huron-chat-window {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --text-color: #1a1a1a;
}
```

---

## Analytics & Monitoring

### Key Metrics to Track

**1. Conversation Metrics:**
```sql
-- Total conversations by date
SELECT
  DATE(created_ts) as date,
  COUNT(*) as conversations
FROM app.f_customer_interaction
WHERE source_system = 'ai_chat_widget'
GROUP BY DATE(created_ts)
ORDER BY date DESC;
```

**2. Conversion Rate:**
```sql
-- Chat-to-booking conversion
SELECT
  COUNT(*) as total_chats,
  SUM(CASE WHEN EXISTS (
    SELECT 1 FROM app.d_booking b
    WHERE b.interaction_session_id = f.id
  ) THEN 1 ELSE 0 END) as bookings_created,
  ROUND(100.0 *
    SUM(CASE WHEN EXISTS (
      SELECT 1 FROM app.d_booking b
      WHERE b.interaction_session_id = f.id
    ) THEN 1 ELSE 0 END) / COUNT(*), 2
  ) as conversion_rate_pct
FROM app.f_customer_interaction f
WHERE source_system = 'ai_chat_widget';
```

**3. Most Requested Services:**
```sql
SELECT
  s.name,
  s.service_category,
  COUNT(b.id) as booking_count
FROM app.d_booking b
JOIN app.d_service s ON s.id = b.service_id
WHERE b.booking_source = 'ai_widget'
GROUP BY s.id, s.name, s.service_category
ORDER BY booking_count DESC
LIMIT 10;
```

**4. AI Cost Tracking:**
```sql
SELECT
  DATE(created_ts) as date,
  SUM((metadata->>'total_tokens')::int) as total_tokens,
  SUM((metadata->>'total_cost_cents')::int) / 100.0 as total_cost_dollars
FROM app.f_customer_interaction
WHERE source_system = 'ai_chat_widget'
GROUP BY DATE(created_ts)
ORDER BY date DESC;
```

---

## Troubleshooting

### Widget Not Appearing

**Check:**
1. Container element exists: `document.getElementById('huron-chat-widget')`
2. Script loaded: Check browser console for errors
3. CORS enabled: API must allow frontend origin
4. Network: Check browser DevTools Network tab

### API Errors

**401 Unauthorized:**
- Check OPENAI_API_KEY is set correctly
- Verify API key is valid (test at openai.com/playground)

**500 Internal Server Error:**
- Check API logs: `./tools/logs-api.sh`
- Verify database connection
- Check OpenAI API status

### Function Call Failures

**Check:**
1. Database tables exist (d_service, d_employee, d_calendar)
2. Sample data exists for testing
3. SQL queries don't have syntax errors
4. Employee schedules are populated

### Booking Creation Fails

**Common Issues:**
- Service ID invalid or not found
- Date format incorrect (must be YYYY-MM-DD)
- Time format incorrect (must be HH:MM)
- Required fields missing (name, phone, address)

---

## Cost Estimation

### OpenAI API Costs

**GPT-4 Turbo Pricing:**
- Input: $0.01 per 1K tokens
- Output: $0.03 per 1K tokens

**Average Conversation:**
- Total: ~2,200 tokens
- Cost: ~$0.05 per conversation

**Monthly Estimate (1,000 conversations):**
- 1,000 × $0.05 = **$50/month**

### Infrastructure Costs

- **API Hosting:** Included (existing PMO platform)
- **Database Storage:** ~1GB/month for 10K conversations
- **Widget CDN:** ~$5/month (CloudFlare/AWS CloudFront)

**Total: ~$55/month for 1,000 conversations**

---

## Support & Resources

- **Documentation:** `/docs/ai_chat/`
- **API Source:** `/apps/api/src/modules/chat/`
- **Widget Source:** `/apps/widget/src/`
- **Database DDL:** `/db/43_d_booking.ddl`

---

**Version:** 1.0.0
**Last Updated:** 2025-11-04
**Maintainer:** PMO Platform Team
