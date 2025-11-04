# Entity Design Pattern Documentation

> **Complete guide to the PMO Platform's universal entity architecture and design patterns**

**Last Updated:** 2025-11-04
**Version:** 3.0.0

---

## 📚 Documentation Index

### 🏗️ [Universal Entity System](./universal_entity_system.md)

**Complete guide to the platform's DRY-first, config-driven architecture**

**Topics Covered:**
- Three Universal Pages (EntityMainPage, EntityDetailPage, EntityCreatePage)
- Create-Link-Edit Pattern (automatic parent-child linking)
- Entity Configuration System (single source of truth)
- Navigation & Routing (auto-generated routes)
- Share & Link Modals (universal components)
- Inline Editing System (convention-based)
- Technical Implementation (hooks, state management)
- API Integration (factory pattern, endpoints)
- Best Practices (adding entities, child relationships)

**When to Read:**
- Adding new entity types
- Understanding the universal page system
- Implementing child entity creation
- Working with entity relationships
- Configuring inline editing

---

## 🎯 Quick Reference

### Three Universal Pages

| Page | URL Pattern | Purpose | Example |
|------|-------------|---------|---------|
| **EntityMainPage** | `/{entity}` | List view | `/project`, `/task`, `/form` |
| **EntityDetailPage** | `/{entity}/{id}` | Detail view | `/project/abc123` |
| **EntityCreatePage** | `/{entity}/new` | Create form | `/project/new` |

### Create-Link-Edit Pattern

```
User clicks "Create Form" in Task Detail Page
  ↓
1. Create draft form with defaults
   POST /api/v1/form
  ↓
2. Link form to task
   POST /api/v1/linkage
  ↓
3. Navigate to form edit page
   /form/{id}/edit
```

### Entity Configuration

```typescript
// apps/web/src/lib/entityConfig.ts
export const entityConfigs: Record<string, EntityConfig> = {
  task: {
    name: 'task',
    displayName: 'Task',
    columns: [...],      // Table columns
    fields: [...],       // Form fields
    supportedViews: [...], // View modes
    childEntities: [...]  // Child tabs
  }
};
```

---

## 🚀 Common Tasks

### Adding a New Entity Type

1. **Add configuration** to `entityConfig.ts`
2. **Add to core entities** list in `App.tsx`
3. **Create backend API** module
4. **Create database table** (DDL file)

**Result:** All universal pages work automatically! ✅

### Creating Child Entities from Parent Pages

**Current Implementation:**
- `EntityChildListPage.tsx:119-235`
- Automatically creates entity + links to parent
- Smart navigation (edit page for form/wiki, detail page for others)

**Example:**
```typescript
// Task detail page → Forms tab → Create Form
// ✅ Creates form, links to task, opens form editor
```

### Adding Custom Edit Pages

1. **Create custom edit page** component
2. **Add route** in `App.tsx`
3. **Update EntityDetailPage** edit button logic
4. **Update EntityChildListPage** create handler

**Example:** Form and Wiki have custom editors

---

## 📖 Related Documentation

| Document | Purpose | Link |
|----------|---------|------|
| **UI/UX Architecture** | Complete system overview | [ui_ux_route_api.md](../ui_ux_route_api.md) |
| **Data Model** | Database schema and relationships | [datamodel.md](../datamodel.md) |
| **Settings System** | Settings/datalabel architecture | [settings.md](../settings.md) |
| **Form System** | Dynamic form builder | [form.md](../form.md) |
| **Kanban System** | Task board implementation | [component_Kanban_System.md](../component_Kanban_System.md) |

---

## 🏆 Key Benefits

### DRY Architecture
- **3 pages** handle 18+ entity types
- **95%+ code reuse** across entities
- **Single configuration** file

### Developer Experience
- **10x faster** to add new entity types
- **Zero duplication** - write once, works everywhere
- **Type-safe** - Full TypeScript coverage

### User Experience
- **Consistent interface** across all entities
- **Smart navigation** - always lands in the right place
- **Automatic linking** - no manual parent-child setup

### Maintainability
- **Single source of truth** - entityConfig.ts
- **Convention over configuration** - smart defaults
- **Scalable** - easily handle 50+ entity types

---

## 🎨 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Entity Configuration                      │
│                   (entityConfig.ts)                         │
│  Defines: columns, fields, views, relationships             │
└───────────────────┬─────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌───────────────┐       ┌──────────────┐
│ EntityMainPage│       │EntityDetailPage│
│  (List View)  │◄─────►│  (Detail View) │
└───────┬───────┘       └───────┬────────┘
        │                       │
        │                       ├──► Share Modal
        │                       ├──► Link Modal
        │                       └──► Child Tabs
        │                               │
        ▼                               ▼
┌──────────────────┐         ┌──────────────────┐
│ EntityCreatePage │         │EntityChildListPage│
│  (Create Form)   │         │   (Child Tabs)    │
└──────────────────┘         └──────────────────┘
                                      │
                              Create-Link-Edit Pattern
                              (v3.0 Enhancement)
```

---

## 📊 Statistics

| Metric | Value | Impact |
|--------|-------|--------|
| **Entity Types** | 18+ | Growing |
| **Universal Pages** | 3 | vs 54+ without DRY |
| **Code Reuse** | 95%+ | Massive reduction |
| **Configuration Files** | 1 | Single source of truth |
| **Lines of Code** | ~12,000 | vs ~50,000+ without DRY |
| **Development Speed** | 10x faster | To add new entities |

---

## 🔧 Technical Stack

**Frontend:**
- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- React Router v6

**Backend:**
- Fastify v5
- PostgreSQL 14+
- JWT Authentication
- MinIO/S3

**Architecture:**
- DRY-first design
- Config-driven
- Convention over configuration
- Type-safe API factory

---

## 📝 Version History

### v3.0.0 (2025-11-04)
- ✅ **Create-Link-Edit Pattern** - Universal child entity creation
- ✅ Automatic parent-child linking
- ✅ Smart navigation (edit pages for form/wiki)
- ✅ Reusable across all entity types

### v2.3.0 (2025-10-28)
- ✅ Convention-based inline editing
- ✅ Auto-detection of editable fields
- ✅ Bidirectional transformers
- ✅ Zero manual configuration

### v2.2.0 (2025-10-27)
- ✅ Sticky headers with z-index layering
- ✅ DRY metadata components
- ✅ File handling components
- ✅ Reduced spacing

### v2.1.0 (2025-10-26)
- ✅ Share modal system
- ✅ Link modal system
- ✅ Compact form layout
- ✅ Header redesign

### v2.0.0 (2025-10-25)
- ✅ Three universal pages
- ✅ Entity configuration system
- ✅ Auto-generated routes

---

## 🤝 Contributing

When adding new features or patterns:

1. **Update documentation** - Keep this guide current
2. **Follow DRY principles** - Reuse existing patterns
3. **Use entityConfig** - Don't hardcode entity logic
4. **Add examples** - Show real usage patterns
5. **Test universally** - Ensure it works for all entities

---

## 📧 Contact

For questions or suggestions about the entity design patterns:
- Review the [UI/UX Architecture](../ui_ux_route_api.md) doc
- Check [Data Model](../datamodel.md) for database details
- See [CLAUDE.md](../../CLAUDE.md) for AI/agent guidance

---

**Platform:** PMO Enterprise Platform
**Organization:** Huron Home Services
**Architecture:** DRY-first, Config-driven, Universal Components
