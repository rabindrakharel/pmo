# Dynamic Entity Builder Documentation

> **Complete guide to the Dynamic Entity Builder system** - Create custom entities through UI without code deployment

---

## 📚 Documentation Index

| Document | Purpose | Audience |
|----------|---------|----------|
| **[User Guide](./USER_GUIDE.md)** | Step-by-step instructions for creating custom entities | End Users, Admins |
| **[Architecture](./ARCHITECTURE.md)** | System design, data flows, and technical decisions | Developers, Architects |
| **[Component Reference](./COMPONENT_REFERENCE.md)** | Frontend component API documentation | Frontend Developers |
| **[Backend API](./BACKEND_API.md)** | Backend endpoints and services (Week 2 implementation) | Backend Developers |
| **[Implementation Status](./IMPLEMENTATION_STATUS.md)** | Current progress and roadmap | Project Managers, Developers |

---

## 🎯 What is Dynamic Entity Builder?

The **Dynamic Entity Builder** is a no-code entity creation system that allows users to:

✅ Create custom entities through a visual UI designer
✅ Define database schema without writing SQL
✅ Configure parent-child relationships with existing entities
✅ Choose icons and navigation placement
✅ Auto-generate database tables, API endpoints, and UI integration

**Result:** New entities appear instantly in the sidebar, with full CRUD operations, without deploying code.

---

## 🚀 Quick Start

### For End Users

1. Navigate to **Settings → Entity Designer** (`/entity-designer`)
2. Choose entity type (Attribute-based or Transactional)
3. Define custom columns (name, type, description)
4. Configure relationships (parent/child entities)
5. Choose icon and display order
6. Preview generated SQL
7. Click "Create Entity"

**See:** [User Guide](./USER_GUIDE.md) for detailed walkthrough

### For Developers

**Frontend (Week 1 - Complete):**
- Components: `apps/web/src/components/entity-builder/`
- Main page: `apps/web/src/pages/setting/EntityDesignerPage.tsx`
- Route: `/entity-designer/:entityCode?`

**Backend (Week 2 - In Progress):**
- DDL Generator: `apps/api/src/lib/ddl-generator.ts` (TODO)
- API Routes: `apps/api/src/modules/entity-builder/routes.ts` (TODO)
- Route Factory: `apps/api/src/lib/dynamic-entity-route-factory.ts` (TODO)

**See:** [Architecture](./ARCHITECTURE.md) and [Implementation Status](./IMPLEMENTATION_STATUS.md)

---

## 📦 Implementation Status

| Phase | Status | Completion |
|-------|--------|------------|
| **Week 1: Frontend UI** | ✅ Complete | 100% |
| **Week 2: Backend API** | 🚧 Not Started | 0% |
| **Week 3: Database Integration** | ⏳ Pending | 0% |
| **Week 4: Testing & Documentation** | ⏳ Pending | 0% |

**Current Commit:** `69c1fc2` (feat: Add Dynamic Entity Builder UI components - Week 1)

**See:** [Implementation Status](./IMPLEMENTATION_STATUS.md) for detailed roadmap

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                      │
│  /entity-designer → EntityDesignerPage                      │
│                                                             │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐ │
│  │ Entity Type    │  │ Column Editor  │  │ Linkage      │ │
│  │ Selector       │  │                │  │ Editor       │ │
│  └────────────────┘  └────────────────┘  └──────────────┘ │
│                                                             │
│  ┌────────────────┐  ┌────────────────┐                   │
│  │ Icon & Display │  │ DDL Preview    │                   │
│  │ Settings       │  │ Modal          │                   │
│  └────────────────┘  └────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                         BACKEND API                         │
│  POST /api/v1/entity-builder/preview  (Generate DDL)       │
│  POST /api/v1/entity-builder/create   (Create Entity)      │
│                                                             │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐ │
│  │ DDL Generator  │  │ Route Factory  │  │ Validator    │ │
│  │ (SQL Creation) │  │ (CRUD Routes)  │  │ (Security)   │ │
│  └────────────────┘  └────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                         DATABASE                            │
│  1. CREATE TABLE d_{entity_code} (...)                     │
│  2. INSERT INTO app.d_entity (...)                         │
│  3. UPDATE parent entities' child_entities JSONB           │
│  4. CREATE TRIGGER for entity instance registry            │
└─────────────────────────────────────────────────────────────┘
```

**See:** [Architecture](./ARCHITECTURE.md) for detailed data flows

---

## 🎨 Entity Types

### Attribute-based Entity (Formerly "Dimension")
**Stores properties, characteristics, or reference data**

Examples:
- Settings and categories (product types, task priorities)
- People and organizations (employees, clients, vendors)
- Locations and hierarchies (offices, departments)
- Reference data that changes slowly over time

### Transactional Entity (Formerly "Fact")
**Stores events, measurements, or time-series data**

Examples:
- Business transactions (orders, invoices, payments)
- Activities and events (tasks, meetings, form submissions)
- Measurements and metrics (performance data, usage stats)
- Data that accumulates over time with timestamps

---

## 🔧 Key Features

### 1. User-Friendly Terminology
- No technical jargon ("fact/dimension" → "attribute/transactional")
- Visual radio buttons with descriptions
- Bullet points explaining when to use each type

### 2. Standard Columns Auto-Included
All entities automatically get:
- `id` (UUID primary key)
- `code` (unique business code)
- `name` (display name)
- `description` (long text)
- `active_flag` (soft delete)
- `created_ts`, `updated_ts` (timestamps)
- `created_by_id`, `updated_by_id` (audit trail)

### 3. Custom Column Designer
- Add unlimited custom columns
- Data types: Text, Number, Date, Boolean, JSON
- Description and required flag per column
- Inline editing with save/cancel

### 4. Entity Relationship Configuration
- Select parent entities (this entity belongs to...)
- Select child entities (this entity contains...)
- Fetches available entities from API
- Grouped by category (Core, Product, Communication, System, Business)

### 5. Icon & Display Settings
- 29 categorized Lucide icons
- Live preview of selected icon
- Display order (0-9999) with guidelines
- Preview card showing sidebar appearance

### 6. DDL Preview
- Shows generated SQL DDL
- Copy-to-clipboard functionality
- Info box explaining what happens on creation

### 7. Safety Features (Backend - Week 2)
- SQL injection prevention
- Reserved word validation
- Uniqueness checks (entity code)
- Transaction-based rollback
- Confirmation dialog before creation

---

## 📝 Standards & Conventions

### Entity Code Naming
- Lowercase with underscores (e.g., `custom_entity`)
- Must start with letter
- No special characters except underscore
- Max 50 characters

### Table Naming
- Always prefixed with `d_` (e.g., `d_custom_entity`)
- Follows existing entity table convention

### Column Naming
- Lowercase with underscores (e.g., `custom_column`)
- No SQL reserved words
- No conflicts with standard columns

### API Endpoints (Auto-generated)
```
GET    /api/v1/{entity_code}          # List entities
GET    /api/v1/{entity_code}/:id      # Get single entity
POST   /api/v1/{entity_code}          # Create entity
PUT    /api/v1/{entity_code}/:id      # Update entity
DELETE /api/v1/{entity_code}/:id      # Soft delete entity
```

### Frontend Routes (Auto-generated)
```
/{entity_code}           # List page
/{entity_code}/new       # Create page
/{entity_code}/:id       # Detail page
```

---

## 🚨 Limitations & Considerations

### Current Limitations (Week 1)
- ❌ Backend API not implemented (Week 2)
- ❌ Cannot create entities yet (UI only)
- ❌ No validation/security checks
- ❌ No DDL generation
- ❌ No dynamic route creation

### Future Enhancements (Post-MVP)
- Edit existing entity schemas
- Delete/archive entities
- Migrate data between entity versions
- Import/export entity definitions
- Entity templates (common patterns)
- Field-level permissions
- Computed/formula columns
- Multi-language support

---

## 🔗 Related Documentation

| Document | Link |
|----------|------|
| **Universal Entity System** | [`docs/entity_design_pattern/universal_entity_system.md`](../entity_design_pattern/universal_entity_system.md) |
| **Entity Metadata Coherence** | [`docs/entity_design_pattern/ENTITY_METADATA_COHERENCE.md`](../entity_design_pattern/ENTITY_METADATA_COHERENCE.md) |
| **Dynamic Entity Builder Design** | [`docs/entity_design_pattern/DYNAMIC_ENTITY_BUILDER.md`](../entity_design_pattern/DYNAMIC_ENTITY_BUILDER.md) |
| **Data Model** | [`docs/datamodel/datamodel.md`](../datamodel/datamodel.md) |
| **Settings System** | [`docs/settings/settings.md`](../settings/settings.md) |

---

## 📞 Support & Contribution

### For Questions
- Check [User Guide](./USER_GUIDE.md) for usage instructions
- Review [Architecture](./ARCHITECTURE.md) for technical details
- See [Implementation Status](./IMPLEMENTATION_STATUS.md) for current progress

### For Developers
- Week 2 implementation guide: [Backend API](./BACKEND_API.md)
- Component API reference: [Component Reference](./COMPONENT_REFERENCE.md)
- Follow DRY principles and platform standards

---

**Last Updated:** 2025-11-10
**Version:** 1.0 (Week 1 Complete)
**Commit:** `69c1fc2`
