# PMO Calendar & Event Management System

## 📚 Documentation

**Primary Documentation**: [CALENDAR_EVENT_SYSTEM.md](./CALENDAR_EVENT_SYSTEM.md)

This is the **single source of truth** for the PMO Calendar & Event Management System.

---

## Quick Links

### For Developers
- **Full System Documentation**: [CALENDAR_EVENT_SYSTEM.md](./CALENDAR_EVENT_SYSTEM.md)
- **Database Schema**: See section "Data Model" in main doc
- **API Endpoints**: See section "API Layer" in main doc
- **UI Components**: See section "UI/UX Layer" in main doc

### For Business Analysts
- **Business Semantics**: See section "Business Semantics" in main doc
- **Use Cases**: See section "System Behavior" in main doc

### For System Architects
- **Entity Relationships**: See section "Entity Relationship Model" in main doc
- **Data Flow**: See section "Data Flow Architecture" in main doc
- **Integration Points**: See section "Integration Points" in main doc

---

## What's in the Main Document?

1. **Business Overview** - What the system does and why
2. **Business Semantics** - Core concepts and terminology
3. **Entity Relationship Model** - ER diagrams and relationships
4. **Data Model** - Database tables, columns, constraints, indexes
5. **API Layer** - Endpoints, request/response formats, behavior
6. **UI/UX Layer** - Components, forms, validation, user flows
7. **Data Flow Architecture** - Complete request-response cycles with examples
8. **System Behavior** - Real-world scenarios and implementation
9. **Integration Points** - RBAC, Entity System, Notifications, Search

---

## Key Principles

### ID ↔ Name Pattern
```
DATABASE stores IDs → API returns IDs + Names → UI shows Names
```

**Example**:
- Database: `organizer_employee_id = "8260b1b0-5efc-4611-ad33-ee76c0cf7f13"`
- API Response: `organizer: { empid: "8260b1b0...", name: "James Miller" }`
- UI Display: "Organizer: **James Miller**"

### Event Action Entity
Every event must answer: **"What is this event about?"**

- Service Appointment → `event_action_entity_type='service'`
- Project Meeting → `event_action_entity_type='project'`
- Task Discussion → `event_action_entity_type='task'`
- Quote Review → `event_action_entity_type='quote'`
- Product Demo → `event_action_entity_type='product'`

---

## Database Tables

### Core Tables
- `d_event` - Event records
- `d_entity_event_person_calendar` - Event attendees with RSVP
- `d_person_calendar` - Personal availability slots

### Integration Tables
- `d_entity_rbac` - Event permissions
- `d_entity_instance_registry` - Event entity registry
- `d_entity_instance_link` - Event-entity relationships

---

## API Endpoints

```
GET    /api/v1/event                    - List events
GET    /api/v1/event/enriched           - Events with full details
GET    /api/v1/event/:id                - Single event
POST   /api/v1/event                    - Create event
PATCH  /api/v1/event/:id                - Update event
DELETE /api/v1/event/:id                - Delete event
GET    /api/v1/event/:id/attendees      - Get attendees
GET    /api/v1/event/:id/entities       - Get linked entities
```

---

## UI Components

- `CalendarView.tsx` - Main calendar interface
- `CalendarEventModal.tsx` - Create/edit event dialog
- `CalendarEventPopover.tsx` - Quick view popup

---

## Archived Documentation

Previous documentation versions are archived in:
- `./archive/2025-11-13/`

These are kept for historical reference but should not be used for current development.

---

## Getting Started

1. **Read**: [CALENDAR_EVENT_SYSTEM.md](./CALENDAR_EVENT_SYSTEM.md)
2. **Database**: Run `./tools/db-import.sh` to load schema
3. **API**: Event endpoints at `/api/v1/event`
4. **UI**: Calendar components in `apps/web/src/components/shared/ui/`

---

## Testing

```bash
# Test event API
./tools/test-api.sh GET /api/v1/event

# Create test event
./tools/test-api.sh POST /api/v1/event '{
  "name": "Test Event",
  "event_action_entity_type": "project",
  "event_action_entity_id": "uuid",
  "organizer_employee_id": "uuid",
  "event_type": "onsite",
  "event_platform_provider_name": "office",
  "from_ts": "2025-11-15T10:00:00Z",
  "to_ts": "2025-11-15T11:00:00Z"
}'
```

---

## Support

For questions or issues:
1. Check [CALENDAR_EVENT_SYSTEM.md](./CALENDAR_EVENT_SYSTEM.md) first
2. Review archived docs in `./archive/` for historical context
3. Contact PMO Development Team

---

**Last Updated**: 2025-11-13
**Document Status**: Current
