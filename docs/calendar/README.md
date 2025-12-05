# PMO Calendar & Event Management System

**Primary Documentation**: [CALENDAR_EVENT_SYSTEM.md](./CALENDAR_EVENT_SYSTEM.md)

---

## Quick Reference

### Database Tables (DDL is source of truth)

> **IMPORTANT**: Tables do NOT use the `d_` prefix.

| Table | Description |
|-------|-------------|
| `app.event` | Event/meeting/appointment records |
| `app.person_calendar` | Personal availability slots (15-min intervals) |
| `app.entity_event_person_calendar` | Event-person mapping with RSVP tracking |

### API Endpoints

```
GET    /api/v1/event                    - List events
GET    /api/v1/event/enriched           - Events with full details
GET    /api/v1/event/:id                - Single event
POST   /api/v1/event                    - Create event with attendees
PATCH  /api/v1/event/:id                - Update event
DELETE /api/v1/event/:id                - Delete event

GET    /api/v1/person-calendar          - List calendar slots
GET    /api/v1/person-calendar/enriched - Slots with event details

GET    /api/v1/event-person-calendar    - List event-person mappings
POST   /api/v1/event-person-calendar    - Invite person to event
```

### Testing

```bash
./tools/test-api.sh GET /api/v1/event
./tools/test-api.sh GET /api/v1/event/enriched
./tools/test-api.sh GET /api/v1/person-calendar
```

---

**Last Updated**: 2025-12-05
