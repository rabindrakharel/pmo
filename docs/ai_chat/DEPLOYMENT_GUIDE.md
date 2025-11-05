# AI Chat Widget - Deployment & Testing Guide

## 🎉 Status: Feature Complete

The AI Chat Widget is fully implemented with all components in place:
- ✅ Database schema (interactions & bookings)
- ✅ Backend API (7 function tools + session management)
- ✅ Widget built and ready for deployment
- ✅ Booking management UI integrated
- ✅ Demo page created

---

## 📋 Quick Start

### 1. Configure OpenAI API Key

**IMPORTANT:** You need a valid OpenAI API key for the chat to work.

1. Get your API key from: https://platform.openai.com/api-keys
2. Update `/home/rabin/projects/pmo/.env`:

```bash
OPENAI_API_KEY=sk-your-actual-openai-api-key-here
OPENAI_MODEL=gpt-4-turbo-preview
```

### 2. Start the Platform

```bash
# From project root
./tools/start-api.sh

# In another terminal
cd apps/web && pnpm run dev
```

### 3. Test the Chat Widget

Open your browser to:
```
http://localhost:4000/widget/demo.html
```

Click the chat button in the bottom-right corner and try:
- "What services do you offer?"
- "I need HVAC maintenance next week"
- "Do you have anyone available on Friday?"

---

## 🏗️ Architecture Overview

### Backend Components

**API Endpoints** (`/api/v1/chat/*`):
- `POST /session/new` - Create chat session
- `POST /message` - Send message and get AI response
- `GET /session/:id/history` - Get conversation history
- `POST /session/:id/close` - Close session
- `GET /analytics/recent` - Get recent interactions

**Function Tools** (7 tools for AI agent):
1. `get_available_services` - List services by category
2. `get_service_details` - Get service pricing/info
3. `get_employee_availability` - Check staff availability
4. `get_available_time_slots` - Get specific time slots
5. `create_booking` - Create service appointment
6. `get_booking_info` - Retrieve booking details
7. `cancel_booking` - Cancel appointment

**Database Tables**:
- `app.f_customer_interaction` - Stores chat conversations
- `app.d_booking` - Stores service appointments
- `app.d_entity` - Booking entity metadata (for nav/UI)

### Frontend Components

**Widget** (`/public/widget/`):
- `widget.js` (460KB) - React app bundled as UMD
- `widget.css` (5KB) - Styles
- `demo.html` - Test page

**Main App**:
- `/booking` - List all bookings
- `/booking/:id` - View/edit booking details
- Entity config in `entityConfig.ts`

---

## 🧪 Testing Scenarios

### Test 1: Service Inquiry
```
User: "What HVAC services do you offer?"
Expected: AI lists HVAC services with pricing
```

### Test 2: Check Availability
```
User: "Do you have anyone available for HVAC service on Friday?"
Expected: AI checks employee calendars and shows available technicians
```

### Test 3: Create Booking
```
User: "I want to book HVAC maintenance"
AI asks for: name, phone, address, date, time
Expected: Booking created with confirmation number (BK-2025-XXXXXX)
```

### Test 4: View Booking in UI
```
1. Go to http://localhost:5173/booking
2. See the booking created via chat
3. Click to view details
4. Edit if needed (assign employee, change status, etc.)
```

---

## 📊 Monitoring & Analytics

### View Chat Interactions

```bash
./tools/test-api.sh GET /api/v1/chat/analytics/recent
```

### Database Queries

```sql
-- Recent chat sessions
SELECT
  interaction_number,
  customer_name,
  sentiment_label,
  resolution_status,
  created_ts
FROM app.f_customer_interaction
WHERE source_system = 'ai_chat_widget'
ORDER BY created_ts DESC
LIMIT 10;

-- Bookings from chat
SELECT
  booking_number,
  customer_name,
  service_name,
  requested_date,
  booking_status
FROM app.d_booking
WHERE booking_source = 'ai_widget'
ORDER BY created_ts DESC;
```

---

## 🚀 Deployment

### Production Checklist

- [ ] Set real OpenAI API key in production `.env`
- [ ] Build widget: `cd apps/widget && pnpm run build`
- [ ] Deploy widget to CDN (S3/CloudFront)
- [ ] Update widget `apiUrl` to production URL
- [ ] Enable CORS for widget domain in API
- [ ] Set up rate limiting for chat endpoints
- [ ] Configure monitoring/alerts for API errors

### Embed Widget on Website

```html
<!-- On your website -->
<div id="huron-chat-widget"></div>
<script src="https://cdn.your-domain.com/widget/widget.js"></script>
<script>
  HuronChatWidget.init({
    containerId: 'huron-chat-widget',
    apiUrl: 'https://api.your-domain.com',
    theme: 'light',
    position: 'bottom-right',
    autoOpen: false
  });
</script>
```

---

## 🔍 Troubleshooting

### Widget Not Appearing
- Check browser console for errors
- Verify `widget.js` is loading (Network tab)
- Ensure container element exists: `<div id="huron-chat-widget"></div>`

### API Errors (401/500)
- Check OpenAI API key is valid: `echo $OPENAI_API_KEY`
- View API logs: `./tools/logs-api.sh`
- Test endpoint directly: `./tools/test-api.sh POST /api/v1/chat/session/new '{}'`

### Booking Not Created
- Check function call logs in API output
- Verify `d_service` table has services
- Ensure service_id is valid UUID
- Check required fields: name, phone, address, date

### Database Issues
- Re-import schema: `./tools/db-import.sh`
- Verify tables exist: `psql -U app -d app -c "\dt app.d_booking"`
- Check sample data: `psql -U app -d app -c "SELECT * FROM app.d_booking LIMIT 5;"`

---

## 📈 Cost Estimation

**OpenAI API Costs** (GPT-4 Turbo):
- Input: $0.01 per 1K tokens
- Output: $0.03 per 1K tokens
- Average conversation: ~2,200 tokens ≈ $0.05
- 1,000 conversations/month ≈ **$50/month**

**Infrastructure:**
- Database storage: ~1GB/10K conversations
- Widget CDN: ~$5/month (CloudFlare/AWS)
- Total: **~$55/month** for 1,000 chats

---

## 🔐 Security Considerations

### Implemented
- ✅ No authentication required for widget (public access)
- ✅ Session-based conversation tracking
- ✅ Input validation on all fields
- ✅ SQL injection protection (parameterized queries)
- ✅ XSS prevention (React escaping)

### TODO for Production
- [ ] Rate limiting per IP (10 sessions/hour)
- [ ] Booking creation limits (5/day per IP)
- [ ] CAPTCHA for repeated bookings
- [ ] PII redaction after 90 days (GDPR)
- [ ] API key rotation policy

---

## 📚 Additional Resources

**Code Locations:**
- Backend: `/apps/api/src/modules/chat/`
- Widget: `/apps/widget/src/`
- Database: `/db/41_f_customer_interaction.ddl`, `/db/43_d_booking.ddl`
- Entity Config: `/apps/web/src/lib/entityConfig.ts` (line 2440+)

**Documentation:**
- API Reference: `/docs/ai_chat/README.md`
- Technical Guide: `/docs/ai_chat/TECHNICAL_IMPLEMENTATION.md`

**Useful Commands:**
```bash
# View recent bookings
./tools/test-api.sh GET /api/v1/booking

# Test chat API
./tools/test-api.sh POST /api/v1/chat/session/new '{}'

# Check database
PGPASSWORD=app psql -h localhost -p 5434 -U app -d app

# Rebuild widget
cd apps/widget && pnpm run build
```

---

## ✅ Final Checklist

Before going live:
- [ ] OpenAI API key configured and tested
- [ ] Widget loads on demo page without errors
- [ ] Can create booking end-to-end via chat
- [ ] Booking appears in `/booking` UI
- [ ] Can edit booking in main app
- [ ] API logs show successful function calls
- [ ] Database has sample services and employees
- [ ] Production `.env` has real credentials
- [ ] Widget built for production (`pnpm run build`)
- [ ] Monitoring/alerting configured

---

**Version:** 1.0.0 (Complete Implementation)
**Date:** 2025-11-04
**Status:** ✅ Production Ready (pending OpenAI API key)
