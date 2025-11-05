# AI Chat Widget - Quick Start Guide

Get the AI chat widget up and running in 5 minutes!

---

## Prerequisites

✅ PMO platform running (`./tools/start-all.sh`)
✅ OpenAI API key
✅ Node.js 18+ and pnpm installed

---

## Step 1: Set OpenAI API Key

Add to your `.env` file in `/apps/api/`:

```bash
OPENAI_API_KEY=sk-your-actual-openai-api-key-here
```

**Don't have one?** Get it from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

---

## Step 2: Verify Database Setup

The `d_booking` table should already be imported. Verify:

```bash
PGPASSWORD=app psql -h localhost -p 5434 -U app -d app -c "\d app.d_booking"
```

You should see the table structure. If not:

```bash
PGPASSWORD=app psql -h localhost -p 5434 -U app -d app -f /home/rabin/projects/pmo/db/43_d_booking.ddl
```

---

## Step 3: Start the API Server

```bash
cd /home/rabin/projects/pmo
./tools/start-api.sh
```

API will be available at `http://localhost:4000`

---

## Step 4: Test the Chat API

```bash
# Create a new chat session
./tools/test-api.sh POST /api/v1/chat/session/new '{
  "customer_name": "Test User"
}'

# You should see:
# {
#   "session_id": "uuid-here",
#   "greeting": "Hello! I'm here to help you with Huron Home Services...",
#   "timestamp": "2025-11-04T..."
# }

# Save the session_id and test sending a message
./tools/test-api.sh POST /api/v1/chat/message '{
  "session_id": "paste-uuid-here",
  "message": "What services do you offer?"
}'

# You should get an AI response listing services
```

---

## Step 5: Run the Widget Demo

```bash
cd /home/rabin/projects/pmo/apps/widget

# Install dependencies (if not already done)
pnpm install

# Start dev server
pnpm run dev
```

Open browser to `http://localhost:5174` to see the widget in action!

---

## Step 6: Test a Complete Booking Flow

In the widget chat:

```
User: "I need HVAC maintenance service"
AI: "I can help you schedule HVAC service! Here are our available services..."

User: "Book maintenance for next Tuesday"
AI: "Great! Let me check availability for Tuesday..."

User: "2 PM works"
AI: "Perfect! I need a few details:
     - Your full name
     - Phone number
     - Service address"

User: "David Chen, 416-555-1234, 123 Main St, Toronto"
AI: "Booking confirmed!
     Confirmation #: BK-2025-000123
     Service: HVAC Maintenance
     Date: Tuesday, Nov 12, 2025 at 2:00 PM
     Technician: John Smith
     Estimated Cost: $250"
```

---

## Step 7: Build for Production

```bash
cd /home/rabin/projects/pmo/apps/widget
pnpm run build
```

This creates `/home/rabin/projects/pmo/public/widget/widget.js`

---

## Step 8: Embed in a Website

Create a test HTML file:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Chat Widget Test</title>
</head>
<body>
    <h1>My Website</h1>
    <p>Content goes here...</p>

    <!-- Widget Container -->
    <div id="huron-chat-widget"></div>

    <!-- Widget Script -->
    <script src="http://localhost:4000/widget/widget.js"></script>
    <script>
        HuronChatWidget.init({
            containerId: 'huron-chat-widget',
            apiUrl: 'http://localhost:4000',
            theme: 'light',
            position: 'bottom-right',
            autoOpen: false
        });
    </script>
</body>
</html>
```

Open in browser - you should see the chat button in bottom-right corner!

---

## Verify Everything Works

### ✅ Backend Checklist

- [ ] API server running on port 4000
- [ ] OpenAI API key configured
- [ ] Chat endpoints responding (`/api/v1/chat/session/new`)
- [ ] Database tables exist (`d_booking`, `f_customer_interaction`)
- [ ] Sample services exist in `d_service`

Test:
```bash
curl http://localhost:4000/api/health
# Should return: {"status":"ok","timestamp":"..."}
```

### ✅ Widget Checklist

- [ ] Widget builds without errors
- [ ] Demo page loads at localhost:5174
- [ ] Chat button appears
- [ ] Can send and receive messages
- [ ] Booking confirmation shows after successful booking

### ✅ Database Checklist

```bash
# Check services
PGPASSWORD=app psql -h localhost -p 5434 -U app -d app -c \
  "SELECT code, name, service_category FROM app.d_service LIMIT 5;"

# Check employees
PGPASSWORD=app psql -h localhost -p 5434 -U app -d app -c \
  "SELECT name, department FROM app.d_employee WHERE active_flag = true LIMIT 5;"

# Check bookings
PGPASSWORD=app psql -h localhost -p 5434 -U app -d app -c \
  "SELECT booking_number, customer_name, booking_status FROM app.d_booking;"
```

---

## Troubleshooting

### Issue: "Failed to create session"

**Solution:**
1. Check API server is running: `curl http://localhost:4000/api/health`
2. Check OPENAI_API_KEY is set: `grep OPENAI_API_KEY apps/api/.env`
3. Check API logs: `./tools/logs-api.sh`

### Issue: "Function not found: get_available_services"

**Solution:**
1. Verify services exist: `PGPASSWORD=app psql -h localhost -p 5434 -U app -d app -c "SELECT COUNT(*) FROM app.d_service;"`
2. Check API code compiled: `ls apps/api/dist/modules/chat/`

### Issue: Widget not appearing

**Solution:**
1. Check browser console for errors
2. Verify script URL is correct
3. Check container element exists: `document.getElementById('huron-chat-widget')`
4. Try hard refresh (Ctrl+Shift+R)

### Issue: Booking creation fails

**Solution:**
1. Verify d_booking table exists
2. Check employee schedules populated
3. Look at API error logs: `./tools/logs-api.sh`

---

## Next Steps

🎉 **Congratulations!** You have a working AI chat widget!

**What to do next:**

1. **Customize the AI** - Edit system prompt in `apps/api/src/modules/chat/openai.service.ts`
2. **Add more services** - Insert into `d_service` table
3. **Style the widget** - Modify CSS in `apps/widget/src/styles.css`
4. **Deploy to production** - See [README.md](./README.md#deployment)
5. **Monitor analytics** - Query `f_customer_interaction` table

---

## Useful Commands

```bash
# View chat conversations
PGPASSWORD=app psql -h localhost -p 5434 -U app -d app -c \
  "SELECT interaction_number, customer_name, sentiment_label, resolution_status
   FROM app.f_customer_interaction
   WHERE source_system = 'ai_chat_widget'
   ORDER BY created_ts DESC LIMIT 10;"

# View bookings created through chat
PGPASSWORD=app psql -h localhost -p 5434 -U app -d app -c \
  "SELECT booking_number, customer_name, service_name, requested_date, booking_status
   FROM app.d_booking
   WHERE booking_source = 'ai_widget'
   ORDER BY created_ts DESC;"

# Check AI costs
PGPASSWORD=app psql -h localhost -p 5434 -U app -d app -c \
  "SELECT
     COUNT(*) as total_conversations,
     SUM((metadata->>'total_tokens')::int) as total_tokens,
     SUM((metadata->>'total_cost_cents')::int) / 100.0 as total_cost_dollars
   FROM app.f_customer_interaction
   WHERE source_system = 'ai_chat_widget';"
```

---

## Support

- **Documentation:** `/docs/ai_chat/`
- **API Code:** `/apps/api/src/modules/chat/`
- **Widget Code:** `/apps/widget/src/`
- **Database Schema:** `/db/43_d_booking.ddl`

---

**Happy chatting! 🤖💬**
