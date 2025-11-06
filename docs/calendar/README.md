# Calendar System Documentation

Multi-person availability and booking management system for PMO platform.

---

## 📚 Documentation Files

### Primary Documentation

**[CALENDAR_SYSTEM.md](./CALENDAR_SYSTEM.md)** - Complete system documentation
- Architecture & design patterns
- Database/API/UI mapping
- User interaction flows
- Developer guide & critical considerations
- **Email invite system** (Outlook/Gmail/iCloud compatible .ics attachments)

### Supporting Documentation

**[DOCUMENTATION_UPDATES.md](./DOCUMENTATION_UPDATES.md)** - Impact on existing docs
- Files requiring updates
- Specific changes needed
- Integration checklist

**Note:** All calendar documentation including email invite system is consolidated into CALENDAR_SYSTEM.md

---

## 🚀 Quick Start

**Access Calendar:**
```
http://localhost:5173/calendar
```

**Entity Code:** `calendar`
**API Endpoint:** `/api/v1/person-calendar`
**Database Table:** `d_entity_person_calendar`

---

## 🎯 Key Features

- ✅ Week-based calendar grid (Mon-Fri, 9 AM - 8 PM)
- ✅ Multi-person filtering (employees & customers)
- ✅ 15-minute time slot granularity
- ✅ Color-coded availability visualization
- ✅ Overlaid schedules for multiple people
- ✅ Table and Calendar view modes

---

## 🏗️ Architecture

**Pattern:** Universal Entity System + DRY Principles
**Views:** Table (data grid) | Calendar (week grid)
**Default View:** Calendar

**Components:**
- `CalendarView.tsx` - Week-based calendar grid component
- `EntityMainPage.tsx` - Universal page with view switcher
- `FilteredDataTable.tsx` - Standard table view

---

## 📖 For Developers

**Adding Calendar Slots:**
```typescript
// POST /api/v1/person-calendar
{
  "person_entity_type": "employee",
  "person_entity_id": "uuid",
  "from_ts": "2025-11-05T09:00:00-05:00",
  "to_ts": "2025-11-05T09:15:00-05:00",
  "availability_flag": true
}
```

**Booking Slots:**
```typescript
// PATCH /api/v1/person-calendar/:id
{
  "availability_flag": false,
  "title": "Client Meeting",
  "appointment_medium": "onsite"
}
```

---

## 🔗 Related Documentation

- [Universal Entity System](../entity_design_pattern/universal_entity_system.md)
- [UI/UX Architecture](../entity_ui_ux_route_api.md)
- [View Modes](../component_Kanban_System.md)
- [API Factory](../entity_ui_ux_route_api.md#api-layer-31-modules)

---

**Version:** 1.0.0
**Status:** Production-Ready ✅
**Last Updated:** 2025-11-05
