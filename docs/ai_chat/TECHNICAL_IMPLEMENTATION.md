# Technical Implementation Guide

## Architecture Deep Dive

This document provides technical implementation details for developers working on the AI Chat Widget.

---

## Backend Implementation

### Module Structure

```
apps/api/src/modules/chat/
├── types.ts                    # TypeScript interfaces
├── functions.service.ts        # 7 function tool implementations
├── openai.service.ts           # OpenAI API integration
├── conversation.service.ts     # Session management
└── routes.ts                   # Fastify HTTP endpoints
```

### OpenAI Integration Flow

```typescript
// 1. User sends message
POST /api/v1/chat/message { session_id, message }

// 2. Load conversation history from database
const history = await getConversationHistory(session_id);

// 3. Add user message to history
history.push({ role: 'user', content: message });

// 4. Call OpenAI with function definitions
const response = await callOpenAI({
  model: 'gpt-4-turbo-preview',
  messages: [systemPrompt, ...history],
  functions: FUNCTION_DEFINITIONS,
  function_call: 'auto'
});

// 5. If AI wants to call a function:
if (response.choices[0].message.function_call) {
  const { name, arguments } = response.choices[0].message.function_call;

  // 6. Execute the function
  const result = await functionTools[name](JSON.parse(arguments));

  // 7. Add function result to conversation
  history.push({
    role: 'function',
    name,
    content: JSON.stringify(result)
  });

  // 8. Call OpenAI again with function result
  const finalResponse = await callOpenAI({
    model: 'gpt-4-turbo-preview',
    messages: [systemPrompt, ...history]
  });
}

// 9. Return AI response to user
return {
  response: finalResponse.choices[0].message.content,
  function_calls: [...],
  tokens_used: finalResponse.usage.total_tokens
};
```

### Function Tool Implementation Pattern

All function tools follow this pattern:

```typescript
export async function functionName(args: {
  param1: string;
  param2?: number;
}): Promise<ReturnType> {
  try {
    // 1. Validate arguments
    if (!args.param1) {
      throw new Error('param1 is required');
    }

    // 2. Execute database query
    const query = sql`
      SELECT ...
      FROM app.table_name
      WHERE condition = ${args.param1}
    `;

    const result = await db.execute(query);

    // 3. Transform and return data
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      // ...
    }));
  } catch (error) {
    console.error('Error in functionName:', error);
    throw new Error('Failed to execute function');
  }
}
```

### Session Management

Sessions are stored in `f_customer_interaction` table:

```typescript
// Create session
const sessionId = uuidv4();
const interactionNumber = await generateInteractionNumber(); // INT-2025-00001

INSERT INTO f_customer_interaction (
  id,
  interaction_number,
  interaction_type,
  channel,
  customer_id,
  content_text,  // JSON array of messages
  source_system
) VALUES (
  sessionId,
  interactionNumber,
  'chat',
  'live_chat',
  customerId,
  '[]',
  'ai_chat_widget'
);

// Update session with messages
UPDATE f_customer_interaction
SET content_text = $1,
    metadata = metadata || $2::jsonb
WHERE id = $3;
```

### Token and Cost Tracking

```typescript
// After each API call
const costCents = calculateCost(tokensUsed);

await updateSession(sessionId, conversationHistory, {
  total_tokens: (existingTokens || 0) + tokensUsed,
  total_cost_cents: (existingCost || 0) + costCents,
  model_used: 'gpt-4-turbo-preview'
});

// Cost calculation
function calculateCost(tokens: number): number {
  const costPerToken = 0.00004; // Approximate
  return Math.round(tokens * costPerToken * 100); // In cents
}
```

---

## Frontend Implementation

### Component Hierarchy

```
App (Container)
├── ChatWindow (when open)
│   ├── Header
│   │   ├── Title/Subtitle
│   │   └── Actions (Minimize/Close)
│   ├── MessageList
│   │   ├── Message (user)
│   │   ├── Message (assistant)
│   │   ├── Message (system/booking)
│   │   └── TypingIndicator
│   └── InputContainer
│       ├── TextInput
│       ├── SendButton
│       └── Footer
└── ToggleButton (when closed)
```

### State Management

```typescript
const [sessionId, setSessionId] = useState<string | null>(null);
const [messages, setMessages] = useState<Message[]>([]);
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

// Session initialization
useEffect(() => {
  if (isOpen && !sessionId) {
    initializeSession();
  }
}, [isOpen]);

// Auto-scroll on new messages
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages]);
```

### API Client

```typescript
class ChatAPI {
  private baseUrl: string;

  async createSession(params): Promise<NewSessionResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/chat/session/new`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return response.json();
  }

  async sendMessage(sessionId, message): Promise<ChatResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, message })
    });
    return response.json();
  }
}
```

### Build Configuration

**Vite Config (UMD Bundle):**

```typescript
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../../public/widget',
    lib: {
      entry: './src/main.tsx',
      name: 'HuronChatWidget',
      formats: ['umd'],
      fileName: () => 'widget.js'
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: 'widget.[ext]'
      }
    },
    minify: 'terser'
  }
});
```

This creates a single `widget.js` file that includes:
- React runtime
- All components
- All styles
- API client
- Global `window.HuronChatWidget` object

---

## Database Optimization

### Indexes for Performance

```sql
-- Chat sessions by date
CREATE INDEX idx_f_cust_interaction_datetime
  ON app.f_customer_interaction(interaction_datetime)
  WHERE source_system = 'ai_chat_widget';

-- Bookings by session
CREATE INDEX idx_booking_interaction
  ON app.d_booking(interaction_session_id)
  WHERE interaction_session_id IS NOT NULL;

-- Bookings by date range
CREATE INDEX idx_booking_date
  ON app.d_booking(requested_date)
  WHERE active_flag = true;

-- Employee availability checks
CREATE INDEX idx_employee_calendar_date
  ON app.d_employee_calendar(employee_id, calendar_event_id)
  WHERE active_flag = true;
```

### Query Optimization Examples

**Employee Availability (Optimized):**

```sql
-- Before: Full table scan + nested loops
SELECT e.id, e.name
FROM app.d_employee e
WHERE e.department = 'HVAC'
  AND NOT EXISTS (
    SELECT 1 FROM app.d_employee_calendar ec
    JOIN app.d_calendar c ON c.id = ec.calendar_event_id
    WHERE ec.employee_id = e.id
      AND DATE(c.start_ts) = '2025-11-11'
  );

-- After: Index seek + efficient join
WITH busy_employees AS (
  SELECT DISTINCT ec.employee_id
  FROM app.d_employee_calendar ec
  JOIN app.d_calendar c ON c.id = ec.calendar_event_id
  WHERE DATE(c.start_ts) = '2025-11-11'
    AND ec.active_flag = true
)
SELECT e.id, e.name
FROM app.d_employee e
LEFT JOIN busy_employees be ON be.employee_id = e.id
WHERE e.department = 'HVAC'
  AND e.active_flag = true
  AND be.employee_id IS NULL;
```

---

## Security Considerations

### Rate Limiting

```typescript
// Per-IP rate limits
const RATE_LIMITS = {
  messages_per_session: 50,      // Max 50 messages per session
  sessions_per_ip_per_hour: 10,  // Max 10 sessions per IP per hour
  bookings_per_ip_per_day: 5     // Max 5 bookings per IP per day
};

// Implementation in routes.ts
fastify.addHook('preHandler', async (request, reply) => {
  const ip = request.ip;
  const sessionCount = await getSessionCountByIP(ip, '1 hour');

  if (sessionCount >= RATE_LIMITS.sessions_per_ip_per_hour) {
    reply.code(429).send({ error: 'Too many requests' });
  }
});
```

### Input Validation

```typescript
// Validate booking inputs
function validateBookingRequest(data: any): boolean {
  // Phone number format (Canadian)
  const phoneRegex = /^\d{10}$/;
  if (!phoneRegex.test(data.customer_phone.replace(/\D/g, ''))) {
    throw new Error('Invalid phone number format');
  }

  // Date must be in future
  const requestedDate = new Date(data.requested_date);
  if (requestedDate < new Date()) {
    throw new Error('Date must be in the future');
  }

  // Time must be within business hours
  const [hour] = data.requested_time_start.split(':').map(Number);
  if (hour < 8 || hour > 17) {
    throw new Error('Time must be within business hours (8 AM - 5 PM)');
  }

  return true;
}
```

### Data Privacy

```sql
-- GDPR compliance: Delete user data
DELETE FROM app.f_customer_interaction
WHERE customer_email = 'user@example.com'
  AND interaction_datetime < now() - interval '90 days';

-- Anonymize conversations (retain for training)
UPDATE app.f_customer_interaction
SET customer_name = 'Anonymous',
    customer_email = NULL,
    metadata = metadata - 'ip_address' - 'user_agent'
WHERE interaction_datetime < now() - interval '30 days';
```

---

## Testing

### Unit Tests (Backend)

```typescript
// Test function tool
describe('get_available_services', () => {
  it('should return all services', async () => {
    const services = await getAvailableServices({});
    expect(services).toBeInstanceOf(Array);
    expect(services.length).toBeGreaterThan(0);
  });

  it('should filter by category', async () => {
    const services = await getAvailableServices({
      service_category: 'HVAC'
    });
    expect(services.every(s => s.service_category === 'HVAC')).toBe(true);
  });
});

// Test booking creation
describe('create_booking', () => {
  it('should create booking with valid data', async () => {
    const booking = await createBooking({
      service_id: 'uuid-of-hvac-service',
      customer_name: 'Test User',
      customer_phone: '4165551234',
      customer_address: '123 Test St',
      requested_date: '2025-11-11',
      requested_time_start: '14:00'
    });

    expect(booking.booking_number).toMatch(/^BK-2025-\d{6}$/);
    expect(booking.status).toBe('pending');
  });
});
```

### Integration Tests (API)

```bash
# Test session creation
./tools/test-api.sh POST /api/v1/chat/session/new '{
  "customer_name": "Test User",
  "customer_email": "test@example.com"
}'

# Test message sending
./tools/test-api.sh POST /api/v1/chat/message '{
  "session_id": "uuid-from-above",
  "message": "I need HVAC service"
}'
```

### Frontend Tests

```typescript
// Test widget initialization
describe('HuronChatWidget', () => {
  it('should initialize with config', () => {
    const container = document.createElement('div');
    container.id = 'test-widget';
    document.body.appendChild(container);

    HuronChatWidget.init({
      containerId: 'test-widget',
      apiUrl: 'http://localhost:4000',
      theme: 'light'
    });

    expect(container.children.length).toBeGreaterThan(0);
  });
});
```

---

## Deployment

### Production Build

```bash
# Build widget
cd apps/widget
pnpm run build

# Output: /public/widget/widget.js

# Deploy to CDN
aws s3 cp ../../public/widget/widget.js s3://cdn.huronhome.ca/widget/
aws cloudfront create-invalidation --distribution-id XXX --paths "/widget/*"
```

### Environment Configuration

```bash
# Production .env
OPENAI_API_KEY=sk-prod-key-here
OPENAI_MODEL=gpt-4-turbo-preview
NODE_ENV=production
API_URL=https://api.huronhome.ca
WIDGET_URL=https://cdn.huronhome.ca/widget/widget.js

# CORS Configuration
ALLOWED_ORIGINS=https://huronhome.ca,https://www.huronhome.ca,https://client1.com
```

### Monitoring Setup

```typescript
// Log all API calls
fastify.addHook('onResponse', async (request, reply) => {
  const { method, url, ip } = request;
  const { statusCode } = reply;
  const duration = reply.elapsedTime;

  logger.info({
    method,
    url,
    ip,
    statusCode,
    duration,
    sessionId: request.body?.session_id
  });
});

// Alert on errors
fastify.addHook('onError', async (request, reply, error) => {
  logger.error({
    error: error.message,
    stack: error.stack,
    url: request.url,
    ip: request.ip
  });

  // Send to error tracking service
  await sendToSentry(error);
});
```

---

## Performance Optimization

### Frontend

**1. Lazy Load Widget:**
```javascript
// Only load widget script when user scrolls or after 5 seconds
setTimeout(() => {
  const script = document.createElement('script');
  script.src = 'https://cdn.huronhome.ca/widget/widget.js';
  document.body.appendChild(script);
}, 5000);
```

**2. Memoize Components:**
```typescript
const Message = React.memo(({ message }) => (
  <div className="message">{message.content}</div>
));
```

**3. Debounce Typing Events:**
```typescript
const debouncedSend = useMemo(
  () => debounce((msg) => sendMessage(msg), 300),
  []
);
```

### Backend

**1. Cache Service Catalog:**
```typescript
const serviceCache = new Map();

export async function getAvailableServices(args) {
  const cacheKey = args.service_category || 'all';

  if (serviceCache.has(cacheKey)) {
    return serviceCache.get(cacheKey);
  }

  const services = await db.execute(query);
  serviceCache.set(cacheKey, services.rows);

  // Expire after 5 minutes
  setTimeout(() => serviceCache.delete(cacheKey), 5 * 60 * 1000);

  return services.rows;
}
```

**2. Connection Pooling:**
```typescript
const pool = new Pool({
  host: 'localhost',
  database: 'app',
  max: 20,        // Max connections
  idleTimeoutMillis: 30000
});
```

**3. Batch OpenAI Calls (Future):**
```typescript
// Process multiple sessions concurrently
const responses = await Promise.all(
  sessions.map(session => getAIResponse(session.history))
);
```

---

## Extending Functionality

### Adding a New Function Tool

**1. Define Function Interface:**
```typescript
// types.ts
export interface NewFunctionArgs {
  param1: string;
  param2?: number;
}
```

**2. Implement Function:**
```typescript
// functions.service.ts
export async function newFunction(args: NewFunctionArgs) {
  const result = await db.execute(sql`
    SELECT ... FROM ... WHERE ...
  `);
  return result.rows;
}

export const functionTools = {
  // ... existing tools
  new_function: newFunction
};
```

**3. Add OpenAI Function Definition:**
```typescript
// openai.service.ts
const FUNCTION_DEFINITIONS = [
  // ... existing definitions
  {
    name: 'new_function',
    description: 'What this function does',
    parameters: {
      type: 'object',
      properties: {
        param1: {
          type: 'string',
          description: 'Description of param1'
        }
      },
      required: ['param1']
    }
  }
];
```

**4. Update System Prompt:**
```typescript
const SYSTEM_PROMPT = `
...
CAPABILITIES (via function calling):
- new_function: Do something new
...
`;
```

### Adding Voice Transcription

```typescript
// routes.ts
fastify.post('/voice/transcribe', async (request, reply) => {
  const data = await request.file();
  const buffer = await data.toBuffer();

  // Call OpenAI Whisper API
  const formData = new FormData();
  formData.append('file', buffer, 'audio.mp3');
  formData.append('model', 'whisper-1');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: formData
  });

  const { text } = await response.json();

  return {
    transcription: text,
    duration_seconds: buffer.length / 16000 // Approx
  };
});
```

---

**Version:** 1.0.0
**Last Updated:** 2025-11-04
