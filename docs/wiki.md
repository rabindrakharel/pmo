# Wiki Entity - Complete Technical Documentation

> **Knowledge Base with Block-Based Content Management** - Notion-style wiki pages with hierarchical structure, publication workflow, and rich content blocks

**Last Updated:** 2025-10-23
**Status:** ✅ Production Ready (Full Stack Complete)

---

## 📋 Table of Contents

1. [Semantics & Business Context](#1-semantics--business-context)
2. [Architecture & Design Patterns](#2-architecture--design-patterns)
3. [Database, API & UI/UX Mapping](#3-database-api--uiux-mapping)
4. [DRY Principles & Entity Relationships](#4-dry-principles--entity-relationships)
5. [Central Configuration & Middleware](#5-central-configuration--middleware)
6. [User Interaction Flow Examples](#6-user-interaction-flow-examples)
7. [Critical Considerations When Editing](#7-critical-considerations-when-editing)

---

## 1. Semantics & Business Context

### Business Purpose

**Wiki** serves as the platform's knowledge base and content management system, providing:
- **Block-based content** with Notion-style editing (headings, paragraphs, lists, code, quotes, etc.)
- **Hierarchical structure** for organizing documentation, guides, workflows, and policies
- **Publication workflow** from draft → review → published → archived
- **Visibility controls** for public, internal, restricted, or private content
- **Entity relationships** linking wiki pages to projects, tasks, clients, employees
- **Version tracking** with audit trail of content revisions
- **SEO optimization** with keywords, summaries, and metadata

### Business Workflows

#### Wiki Lifecycle
```
Create → Draft → Review → Published → Archived
   ↓       ↓        ↓          ↓          ↓
Design  Edit    Submit    Active     Historical
```

#### Publication Workflow
```
Draft (v1) → Edit (v2) → Review (v3) → Published (v4) → Archived (v5)
     ↓           ↓           ↓              ↓              ↓
  Author      Author     Reviewer       Public         Reference
  Only        Only        Only          Access          Only
```

### Key Business Rules

**Wiki Content:**
- **Metadata in PostgreSQL**: Name, slug, tags, publication status, visibility
- **Content in JSONB**: Block-based content stored as `content.blocks` array
- **Version control**: Each edit increments version number (in-place update)
- **Hierarchical structure**: Parent-child relationships via `parent_wiki_id`
- **Soft deletes**: `active_flag=false` preserves content for historical reference

**Publication Rules:**
- **Draft**: Work in progress, visible only to author
- **Review**: Submitted for editorial approval
- **Published**: Publicly visible to authorized users
- **Archived**: Historical reference, no longer actively maintained
- **Deprecated**: Outdated content marked for replacement
- **Private**: Approved but restricted to specific user groups

### Real-World Use Cases

| Department | Wiki Type | Purpose | Content Blocks |
|------------|-----------|---------|----------------|
| Engineering | Technical Guide | API documentation, architecture diagrams | Code, headings, tables, images |
| Operations | Standard Operating Procedure | Step-by-step workflows | Numbered lists, callouts, dividers |
| HR | Company Policy | Employee handbook, benefits guide | Headings, paragraphs, quotes |
| Project Management | Project Template | Reusable project structure | Checklists, tables, links |
| Sales | Product Knowledge Base | Product features, pricing | Bullet lists, images, videos |

---

## 2. Architecture & Design Patterns

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  WIKI SYSTEM LAYERS                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📱 PAGES (React)                                            │
│  ├─ /wiki                   → EntityMainPage (list)         │
│  ├─ /wiki/new               → WikiEditorPage (create)       │
│  ├─ /wiki/:id               → EntityDetailPage (view)       │
│  ├─ /wiki/:id/edit          → WikiEditorPage (edit)         │
│  └─ /wiki/shared/:code      → SharedURLEntityPage (public)  │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  🎨 COMPONENTS                                               │
│  ├─ WikiDesigner            → Block-based content editor    │
│  │   ├─ WikiHeaderEditor    → Cover, icon, title editor     │
│  │   ├─ WikiDraggableBlock  → Individual content blocks     │
│  │   ├─ WikiBlockToolbar    → Block type selector           │
│  │   ├─ WikiPropertiesPanel → Page & block metadata         │
│  │   └─ WikiPreviewPanel    → Real-time preview             │
│  ├─ WikiContentRenderer     → Display published content     │
│  └─ UniversalDesigner       → Reusable designer layout      │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ⚙️  API (Fastify)                                           │
│  ├─ GET    /api/v1/wiki                    → List pages     │
│  ├─ POST   /api/v1/wiki                    → Create page    │
│  ├─ GET    /api/v1/wiki/:id                → Get page       │
│  ├─ PUT    /api/v1/wiki/:id                → Update page    │
│  ├─ DELETE /api/v1/wiki/:id                → Soft delete    │
│  ├─ GET    /api/v1/wiki/:id/children       → Get hierarchy  │
│  └─ GET    /api/v1/setting?category=wiki_publication_status │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  💾 DATABASE (PostgreSQL)                                    │
│  ├─ d_wiki                  → Page metadata + content       │
│  ├─ entity_id_map           → Entity relationships          │
│  └─ entity_id_rbac_map      → Access permissions            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Design Patterns

#### 1. **Block-Based Content Architecture (Notion-style)**

Each wiki page is composed of content blocks:

```typescript
interface WikiBlock {
  id: string;                 // Unique block ID
  type: 'heading' | 'paragraph' | 'list' | 'quote' | 'code' |
        'image' | 'video' | 'callout' | 'divider' | 'table';
  content?: string;           // Text content
  level?: number;             // Heading level (1-6) or list type (1=bullet, 2=numbered)
  styles?: Record<string, any>;     // Custom styling
  properties?: Record<string, any>; // Block-specific properties
}

interface WikiPage {
  id: string;
  name: string;
  slug: string;
  content: {
    type: 'blocks';
    blocks: WikiBlock[];      // Array of content blocks
  };
  tags: string[];
  metadata: {
    attr: {
      icon: string;           // Page icon (emoji)
      cover: string;          // Cover image/gradient
      path: string;           // Hierarchical path
    };
  };
  publication_status: string; // draft, review, published, archived
  visibility: string;         // public, internal, restricted, private
}
```

**Benefits:**
- **Flexible content structure** - Mix and match different block types
- **Drag-and-drop reordering** - Visual editing experience
- **Auto-resize textareas** - No scrollbars, content expands naturally
- **Real-time preview** - See formatted output while editing
- **Clean JSON storage** - Easy to parse, render, and export

#### 2. **In-Place Version Tracking**

Unlike artifacts (which use SCD Type 2), wiki pages use in-place updates with version incrementing:

```sql
-- Version 1 (Initial Draft)
id: a1111111-1111-1111-1111-111111111111
version: 1
publication_status: 'draft'
updated_ts: 2025-01-01 10:00:00

-- Version 2 (Edited Draft) - SAME ID
id: a1111111-1111-1111-1111-111111111111  ← Same ID!
version: 2                                 ← Incremented
publication_status: 'draft'
updated_ts: 2025-01-02 14:30:00           ← Updated

-- Version 3 (Published) - SAME ID
id: a1111111-1111-1111-1111-111111111111  ← Same ID!
version: 3                                 ← Incremented
publication_status: 'published'
published_at: 2025-01-03 09:00:00
published_by_empid: {user-id}
updated_ts: 2025-01-03 09:00:00
```

**Why In-Place Updates?**
- Preserves page path and entity relationships (stable URLs)
- Version number provides audit trail without duplication
- Publication status changes are workflow transitions, not new entities
- Simplifies hierarchical structure (parent_wiki_id stays stable)

#### 3. **Hierarchical Page Structure**

```
/wiki
├─ /projects                (parent_wiki_id: null)
│  ├─ /methodology          (parent_wiki_id: projects)
│  │  ├─ /agile             (parent_wiki_id: methodology)
│  │  └─ /waterfall         (parent_wiki_id: methodology)
│  └─ /templates            (parent_wiki_id: projects)
├─ /guides                  (parent_wiki_id: null)
│  ├─ /onboarding           (parent_wiki_id: guides)
│  └─ /troubleshooting      (parent_wiki_id: guides)
└─ /policies                (parent_wiki_id: null)
   ├─ /hr                   (parent_wiki_id: policies)
   └─ /security             (parent_wiki_id: policies)
```

**Benefits:**
- Logical content organization
- Breadcrumb navigation
- Nested sidebar menus
- SEO-friendly URLs

---

## 3. Database, API & UI/UX Mapping

### Database Layer (d_wiki Table)

**Location:** `db/25_d_wiki.ddl`

```sql
CREATE TABLE app.d_wiki (
    -- Primary key (STABLE - never changes)
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identifiers
    slug varchar(100) UNIQUE NOT NULL,
    code varchar(50) UNIQUE NOT NULL,

    -- Metadata
    name varchar(200) NOT NULL,
    descr text,
    internal_url varchar(500),   -- /wiki/{id} (authenticated)
    shared_url varchar(500),     -- /wiki/shared/{code} (public)
    tags jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,

    -- Wiki classification
    wiki_type varchar(50) DEFAULT 'page', -- page, template, workflow, guide, policy
    category varchar(100),

    -- Content structure (JSONB for flexible blocks)
    -- Actual content stored in 'content' field added via API
    page_path varchar(500),      -- /projects/methodology/agile
    parent_wiki_id uuid,         -- NULL for root pages
    sort_order integer DEFAULT 0,

    -- Publication workflow
    publication_status varchar(50) DEFAULT 'draft', -- draft, review, published, archived
    published_at timestamptz,
    published_by_empid uuid,

    -- Access control
    visibility varchar(20) DEFAULT 'internal', -- public, internal, restricted, private
    read_access_groups varchar[] DEFAULT '{}',
    edit_access_groups varchar[] DEFAULT '{}',

    -- SEO and discovery
    keywords varchar[] DEFAULT '{}',
    summary text,

    -- Entity relationships
    primary_entity_type varchar(50), -- project, task, business, office
    primary_entity_id uuid,

    -- Temporal fields
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,                -- NULL=active, timestamptz=deleted
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1         -- Increments on each update
);
```

**Key Fields Explained:**

| Field | Purpose | Update Behavior |
|-------|---------|-----------------|
| `id` | Primary key | **STABLE** - Never changes |
| `version` | Revision counter | **INCREMENTS** on each update |
| `publication_status` | Workflow state | Changes: draft → review → published → archived |
| `published_at` | Publication timestamp | Set when status changes to 'published' |
| `published_by_empid` | Who published | Set when status changes to 'published' |
| `parent_wiki_id` | Hierarchical parent | NULL for root pages, UUID for child pages |
| `page_path` | URL-friendly path | Hierarchical path for routing |
| `metadata` | Flexible data | Stores icon, cover, and other attributes |
| `tags` | Search tags | Array for filtering and discovery |

### API Layer (Fastify Routes)

**Location:** `apps/api/src/modules/wiki/routes.ts`

#### 1. Create Wiki Page

**Endpoint:** `POST /api/v1/wiki`

**Request:**
```json
{
  "name": "Agile Methodology Guide",
  "slug": "agile-methodology-guide",
  "code": "WIKI-2025-001",
  "descr": "Comprehensive guide to Agile project management",
  "content": {
    "type": "blocks",
    "blocks": [
      {
        "id": "block-1",
        "type": "heading",
        "content": "Introduction to Agile",
        "level": 1
      },
      {
        "id": "block-2",
        "type": "paragraph",
        "content": "Agile is an iterative approach to project management..."
      }
    ]
  },
  "tags": ["agile", "methodology", "project-management"],
  "wiki_type": "guide",
  "category": "project-management",
  "publication_status": "draft",
  "visibility": "internal",
  "metadata": {
    "attr": {
      "icon": "📚",
      "cover": "gradient-blue",
      "path": "/projects/methodology"
    }
  }
}
```

**Response:**
```json
{
  "id": "a1111111-1111-1111-1111-111111111111",
  "name": "Agile Methodology Guide",
  "slug": "agile-methodology-guide",
  "version": 1,
  "publication_status": "draft",
  "visibility": "internal",
  "created_ts": "2025-01-01T10:00:00Z",
  "updated_ts": "2025-01-01T10:00:00Z"
}
```

#### 2. Update Wiki Page (In-Place)

**Endpoint:** `PUT /api/v1/wiki/:id`

**Request:**
```json
{
  "name": "Agile Methodology Guide - Updated",
  "content": {
    "type": "blocks",
    "blocks": [
      {
        "id": "block-1",
        "type": "heading",
        "content": "Introduction to Agile",
        "level": 1
      },
      {
        "id": "block-2",
        "type": "paragraph",
        "content": "Agile is an iterative approach that emphasizes flexibility..."
      },
      {
        "id": "block-3",
        "type": "list",
        "content": "Daily standup meetings",
        "level": 1
      }
    ]
  },
  "tags": ["agile", "methodology", "scrum", "kanban"]
}
```

**Response:**
```json
{
  "id": "a1111111-1111-1111-1111-111111111111",
  "version": 2,
  "updated_ts": "2025-01-02T14:30:00Z"
}
```

**Database Behavior:**
```sql
UPDATE app.d_wiki
SET name = $1,
    content = $2,
    tags = $3,
    version = version + 1,
    updated_ts = NOW()
WHERE id = $4;
```

#### 3. Publish Wiki Page

**Endpoint:** `PUT /api/v1/wiki/:id`

**Request:**
```json
{
  "publication_status": "published"
}
```

**Response:**
```json
{
  "id": "a1111111-1111-1111-1111-111111111111",
  "version": 3,
  "publication_status": "published",
  "published_at": "2025-01-03T09:00:00Z",
  "published_by_empid": "user-uuid"
}
```

**Database Behavior:**
```sql
UPDATE app.d_wiki
SET publication_status = 'published',
    published_at = NOW(),
    published_by_empid = $user_id,
    version = version + 1,
    updated_ts = NOW()
WHERE id = $1;
```

#### 4. Get Wiki Hierarchy (Children)

**Endpoint:** `GET /api/v1/wiki/:id/children`

**Response:**
```json
{
  "data": [
    {
      "id": "child-1-uuid",
      "name": "Agile Principles",
      "slug": "agile-principles",
      "parent_wiki_id": "parent-uuid",
      "sort_order": 1
    },
    {
      "id": "child-2-uuid",
      "name": "Scrum Framework",
      "slug": "scrum-framework",
      "parent_wiki_id": "parent-uuid",
      "sort_order": 2
    }
  ]
}
```

#### 5. List Wiki Pages (Filtered)

**Endpoint:** `GET /api/v1/wiki?publication_status=published&wiki_type=guide`

**Response:**
```json
{
  "data": [
    {
      "id": "wiki-1-uuid",
      "name": "Agile Methodology Guide",
      "publication_status": "published",
      "wiki_type": "guide",
      "published_at": "2025-01-03T09:00:00Z"
    },
    {
      "id": "wiki-2-uuid",
      "name": "API Documentation",
      "publication_status": "published",
      "wiki_type": "guide",
      "published_at": "2025-01-02T15:00:00Z"
    }
  ],
  "total": 2,
  "limit": 20,
  "offset": 0
}
```

### UI/UX Layer (React Components)

#### 1. WikiDesigner Component (Block Editor)

**Location:** `apps/web/src/components/entity/wiki/WikiDesigner.tsx`

**Features:**
- **Notion-style editor** with block-based content
- **Drag-and-drop reordering** of blocks
- **Auto-resize textareas** - No scrollbars, content expands automatically
- **Real-time preview** mode
- **Code view** for debugging block structure
- **Properties panel** for page metadata and block settings

**Block Types Supported:**
1. **Heading** (h1-h6) - Large titles and section headers
2. **Paragraph** - Auto-resizing text blocks
3. **Bulleted List** - Unordered lists
4. **Numbered List** - Ordered lists
5. **Quote** - Blockquotes with left border
6. **Code** - Syntax-highlighted code blocks
7. **Callout** - Highlighted important notes
8. **Divider** - Horizontal rule separator
9. **Image** - Embedded images (S3 support coming soon)
10. **Video** - Embedded videos (YouTube, Vimeo, etc.)
11. **Table** - Data tables (basic support)

**Auto-Resize Functionality:**
```typescript
// Auto-resize textarea hook
function useAutoResizeTextarea(value: string) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Set height to scrollHeight to fit content
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [value]);

  return textareaRef;
}
```

**Usage:**
```tsx
// Paragraph block with auto-resize
case 'paragraph': {
  const textareaRef = useAutoResizeTextarea(block.content || '');
  return (
    <textarea
      ref={textareaRef}
      value={block.content || ''}
      onChange={(e) => handleContentChange(e.target.value)}
      className="w-full bg-transparent border-none outline-none resize-none overflow-hidden"
      style={{ minHeight: '24px' }}
    />
  );
}
```

**Key Benefits:**
- ✅ **No scrollbars** - Content blocks expand naturally as you type
- ✅ **Multiple blocks** - Add as many paragraph/list blocks as needed
- ✅ **Visual editing** - WYSIWYG-like experience
- ✅ **Clean JSON** - Easy to export and migrate

#### 2. WikiContentRenderer Component (Display Mode)

**Location:** `apps/web/src/components/entity/wiki/WikiContentRenderer.tsx`

**Features:**
- Renders published wiki pages with formatted blocks
- Syntax highlighting for code blocks
- Responsive layout for all block types
- Special rendering for EntityDetailPage wiki tab

#### 3. Page Routes

```typescript
/wiki                → EntityMainPage (list all wiki pages)
/wiki/new            → WikiEditorPage (create new page)
/wiki/:id            → EntityDetailPage (view published page)
/wiki/:id/edit       → WikiEditorPage (edit existing page)
/wiki/shared/:code   → SharedURLEntityPage (public view, no auth)
```

---

## 4. DRY Principles & Entity Relationships

### Universal Designer Layout

All designer components (wiki, form, artifact) use the **same layout system**:

```
UniversalDesigner (reusable layout) → Used by WikiDesigner, FormBuilder, ArtifactDesigner
```

**Why DRY?**
- Consistent UI/UX across all content editors
- Single toolbar/canvas/properties panel pattern
- Shared keyboard shortcuts and navigation
- Fix bugs once, benefits all designers

**See:** `apps/web/src/components/shared/designer/UniversalDesigner.tsx`

### Entity Relationships

Wiki pages can be linked to any entity:

```sql
-- entity_id_map table
INSERT INTO app.entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
VALUES ('project', 'proj-uuid', 'wiki', 'wiki-uuid');
```

**Supported Parent Entities:**
- `project` → Project documentation, methodology guides
- `task` → Task instructions, checklists
- `client` → Client requirements, specifications
- `office` → Office policies, procedures
- `business` → Business unit guides, templates
- `employee` → Employee documentation, training materials

**Query Examples:**
```sql
-- Get all wiki pages for a project
SELECT w.* FROM app.d_wiki w
WHERE w.primary_entity_type = 'project'
  AND w.primary_entity_id = 'proj-uuid'
  AND w.active_flag = true;

-- Get all wiki pages via entity_id_map
SELECT w.* FROM app.d_wiki w
JOIN app.entity_id_map eim ON w.id = eim.child_entity_id
WHERE eim.parent_entity_type = 'project'
  AND eim.parent_entity_id = 'proj-uuid'
  AND eim.child_entity_type = 'wiki';
```

---

## 5. Central Configuration & Middleware

### Wiki Route Configuration

**Location:** `apps/api/src/modules/wiki/routes.ts`

**Route Registration:**
```typescript
export async function wikiRoutes(fastify: FastifyInstance) {
  // All routes automatically include JWT authentication middleware
  fastify.get('/api/v1/wiki', { preHandler: [fastify.authenticate] }, async (request, reply) => { /* ... */ });
  fastify.post('/api/v1/wiki', { preHandler: [fastify.authenticate] }, async (request, reply) => { /* ... */ });
  fastify.get('/api/v1/wiki/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => { /* ... */ });
  fastify.put('/api/v1/wiki/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => { /* ... */ });
  fastify.delete('/api/v1/wiki/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => { /* ... */ });
}
```

### Authentication Middleware

**Location:** `apps/api/src/lib/auth.ts`

All wiki endpoints require JWT authentication:

```typescript
fastify.addHook('onRequest', async (request, reply) => {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    reply.code(401).send({ error: 'Missing authorization token' });
    return;
  }
  const decoded = jwt.verify(token, config.JWT_SECRET);
  request.user = decoded; // Attach user to request
});
```

### RBAC Permission Checking

```typescript
// Check view permission before displaying wiki
const hasAccess = await db.execute(sql`
  SELECT 1 FROM app.entity_id_rbac_map
  WHERE empid = ${userId}
    AND entity = 'wiki'
    AND (entity_id = ${wikiId} OR entity_id = 'all')
    AND 0 = ANY(permission)  -- View permission
    AND active_flag = true
`);
```

### Frontend Entity Configuration

**Location:** `apps/web/src/lib/entityConfig.ts`

```typescript
export const entityConfigs: Record<string, EntityConfig> = {
  wiki: {
    singularName: 'Wiki',
    pluralName: 'Wiki Pages',
    icon: BookOpen,
    tableName: 'd_wiki',
    columns: [
      { key: 'name', label: 'Title', type: 'text' },
      { key: 'publication_status', label: 'Status', type: 'select', loadOptionsFromSettings: true },
      { key: 'wiki_type', label: 'Type', type: 'select' },
      { key: 'published_at', label: 'Published', type: 'datetime' },
      { key: 'version', label: 'Version', type: 'number' },
    ],
    childEntities: ['artifact', 'task'],
    canCreate: true,
    canEdit: true,
    canDelete: true,
    shareable: true,
  },
};
```

---

## 6. User Interaction Flow Examples

### Flow 1: Create New Wiki Page

**User Actions:**
```
1. Navigate to /wiki/new
2. Fill in title: "Agile Methodology Guide"
3. Add content blocks:
   - Add Heading block: "Introduction"
   - Add Paragraph block: "Agile is an iterative..."
   - Add Bulleted List block: "Daily standups"
   - Add Bulleted List block: "Sprint planning"
   - Add Code block: "git commit -m 'message'"
4. Set metadata:
   - Icon: 📚
   - Cover: gradient-blue
   - Tags: agile, methodology
5. Click "Save Page"
   ↓
   [Loading spinner]
   ↓
6. Redirect to /wiki/{new-id} (detail view)
```

**System Flow:**
```
┌──────────────────────────────────────────────────────────┐
│ 1. WikiDesigner component submits data                   │
├──────────────────────────────────────────────────────────┤
│ POST /api/v1/wiki                                         │
│ {                                                         │
│   name: "Agile Methodology Guide",                       │
│   slug: "agile-methodology-guide",                       │
│   content: {                                              │
│     type: "blocks",                                       │
│     blocks: [                                             │
│       { id: "block-1", type: "heading", ... },           │
│       { id: "block-2", type: "paragraph", ... },         │
│       { id: "block-3", type: "list", ... }               │
│     ]                                                     │
│   },                                                      │
│   tags: ["agile", "methodology"],                        │
│   publication_status: "draft"                            │
│ }                                                         │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 2. Backend creates database row                          │
├──────────────────────────────────────────────────────────┤
│ INSERT INTO d_wiki                                        │
│ (name, slug, content, tags, version, ...)                │
│ VALUES ('Agile...', 'agile-...', {...}, {...}, 1, ...)   │
│ RETURNING id                                              │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 3. Frontend navigates to detail page                     │
├──────────────────────────────────────────────────────────┤
│ navigate(`/wiki/${newWiki.id}`)                          │
│ → EntityDetailPage renders wiki content                  │
│ → WikiContentRenderer displays formatted blocks          │
│ → Shows version: 1, status: Draft                        │
└──────────────────────────────────────────────────────────┘
```

---

### Flow 2: Edit Wiki Page (In-Place Update)

**User Actions:**
```
1. Navigate to /wiki/{id}/edit
2. See prefilled editor with existing blocks
3. Edit paragraph block: Add more content
4. Add new code block
5. Reorder blocks via drag-and-drop
6. Click "Save Page"
   ↓
   [Success toast: "Wiki page updated"]
   ↓
7. Redirect back to /wiki/{id}
```

**System Flow:**
```
┌──────────────────────────────────────────────────────────┐
│ 1. WikiDesigner submits updated content                  │
├──────────────────────────────────────────────────────────┤
│ PUT /api/v1/wiki/{id}                                    │
│ {                                                         │
│   content: {                                              │
│     type: "blocks",                                       │
│     blocks: [                                             │
│       { id: "block-1", type: "heading", ... },           │
│       { id: "block-2", type: "paragraph", ... },         │
│       { id: "block-4", type: "code", ... },  ← NEW       │
│       { id: "block-3", type: "list", ... }   ← REORDERED │
│     ]                                                     │
│   }                                                       │
│ }                                                         │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 2. Backend updates SAME row (in-place)                   │
├──────────────────────────────────────────────────────────┤
│ UPDATE d_wiki                                             │
│ SET content = $1,                                         │
│     version = version + 1,  ← Increments from 1 to 2     │
│     updated_ts = NOW()                                   │
│ WHERE id = {wiki-id}                                     │
│                                                          │
│ ✅ SAME ID                                               │
│ ✅ VERSION incremented                                   │
│ ✅ UPDATED timestamp refreshed                           │
└──────────────────────────────────────────────────────────┘
```

---

### Flow 3: Publish Wiki Page (Workflow Transition)

**User Actions:**
```
1. Navigate to /wiki/{id}/edit
2. Review content
3. Change publication status from "Draft" to "Published"
4. Click "Save Page"
   ↓
   [Success toast: "Wiki page published"]
   ↓
5. Page now visible to all authorized users
```

**System Flow:**
```
┌──────────────────────────────────────────────────────────┐
│ 1. WikiDesigner submits status change                    │
├──────────────────────────────────────────────────────────┤
│ PUT /api/v1/wiki/{id}                                    │
│ {                                                         │
│   publication_status: "published"                        │
│ }                                                         │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 2. Backend updates publication fields                    │
├──────────────────────────────────────────────────────────┤
│ UPDATE d_wiki                                             │
│ SET publication_status = 'published',                    │
│     published_at = NOW(),                                │
│     published_by_empid = $user_id,                       │
│     version = version + 1,                               │
│     updated_ts = NOW()                                   │
│ WHERE id = {wiki-id}                                     │
│                                                          │
│ Result: Page now visible in public lists                │
└──────────────────────────────────────────────────────────┘
```

---

### Flow 4: View Published Wiki Page

**User Actions:**
```
1. Navigate to /wiki
2. See list of published wiki pages
3. Click on "Agile Methodology Guide"
   ↓
   [Navigate to /wiki/{id}]
   ↓
4. EntityDetailPage displays:
   - Cover image/gradient
   - Page icon and title
   - Formatted content blocks
   - Tags, metadata, version info
   - Child entity tabs (if any)
```

**System Flow:**
```
┌──────────────────────────────────────────────────────────┐
│ 1. Page loads wiki data                                  │
├──────────────────────────────────────────────────────────┤
│ GET /api/v1/wiki/{id}                                    │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 2. Backend queries wiki and checks RBAC                  │
├──────────────────────────────────────────────────────────┤
│ SELECT * FROM app.d_wiki                                 │
│ WHERE id = $1 AND active_flag = true                     │
│                                                          │
│ -- Check view permission                                 │
│ SELECT 1 FROM entity_id_rbac_map                         │
│ WHERE empid = $user_id                                   │
│   AND entity = 'wiki'                                    │
│   AND (entity_id = $1 OR entity_id = 'all')             │
│   AND 0 = ANY(permission)                               │
│                                                          │
│ Returns: Full wiki page data                             │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 3. WikiContentRenderer displays formatted blocks         │
├──────────────────────────────────────────────────────────┤
│ <div className="wiki-page">                              │
│   <div className="cover">gradient-blue</div>            │
│   <div className="icon">📚</div>                        │
│   <h1>Agile Methodology Guide</h1>                      │
│                                                          │
│   {blocks.map(block => (                                │
│     <Block key={block.id} type={block.type}>           │
│       {block.content}                                   │
│     </Block>                                             │
│   ))}                                                    │
│ </div>                                                   │
└──────────────────────────────────────────────────────────┘
```

---

## 7. Critical Considerations When Editing

### 1. Auto-Resize Textarea Implementation

**✅ DO:**
- Always use `useAutoResizeTextarea` hook for paragraph, quote, code, callout blocks
- Set `overflow-hidden` class to prevent scrollbars
- Set `minHeight: '24px'` to ensure reasonable minimum size
- Reset height to 'auto' before measuring scrollHeight

**❌ DON'T:**
- Don't use fixed `rows` attribute (causes scrollbars)
- Don't forget to add `ref={textareaRef}` to textarea
- Don't remove `resize-none` class (allows manual resize)

**Implementation:**
```typescript
// ✅ CORRECT: Auto-resize textarea
const textareaRef = useAutoResizeTextarea(block.content || '');
<textarea
  ref={textareaRef}
  className="w-full bg-transparent border-none outline-none resize-none overflow-hidden"
  style={{ minHeight: '24px' }}
/>

// ❌ WRONG: Fixed rows causes scrollbar
<textarea
  rows={3}
  className="w-full"
/>
```

### 2. Block Structure Best Practices

**Content Blocks:**
- Each block should be **self-contained** with unique ID
- Use **type-specific properties** for block configuration
- **Preserve block order** during drag-and-drop
- **Validate block data** before saving

**Example:**
```typescript
// ✅ GOOD: Proper block structure
{
  id: "block-123",
  type: "code",
  content: "const hello = 'world';",
  properties: {
    language: "javascript",
    theme: "dark"
  }
}

// ❌ BAD: Missing required fields
{
  content: "const hello = 'world';"
}
```

### 3. Publication Workflow Management

**State Transitions:**
```
draft → review → published → archived
  ↓       ↓         ↓           ↓
 Edit   Submit   Active    Historical
```

**Rules:**
- **Draft**: Only author can view/edit
- **Review**: Reviewers can view, only author can edit
- **Published**: All authorized users can view, editors can edit
- **Archived**: Read-only for historical reference

**Validation:**
```typescript
// Before publishing, validate:
const canPublish = [
  // Has title
  () => page.name && page.name.trim().length > 0,

  // Has content
  () => page.content?.blocks && page.content.blocks.length > 0,

  // User has publish permission
  () => hasPermission(userId, 'wiki', pageId, 'edit'),
];
```

### 4. Hierarchical Structure Maintenance

**Parent-Child Rules:**
- **Root pages**: `parent_wiki_id = NULL`
- **Child pages**: `parent_wiki_id = {parent-uuid}`
- **Prevent circular references**: Check parent chain before saving
- **Update page_path**: Regenerate when parent changes

**Example:**
```typescript
// ✅ GOOD: Validate parent chain
async function validateParentChain(pageId: string, newParentId: string) {
  let currentId = newParentId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === pageId) {
      throw new Error('Circular reference detected!');
    }
    if (visited.has(currentId)) {
      throw new Error('Circular reference detected!');
    }
    visited.add(currentId);

    const parent = await db.query.d_wiki.findFirst({
      where: eq(d_wiki.id, currentId)
    });
    currentId = parent?.parent_wiki_id;
  }
}
```

### 5. Performance Optimization

**Database Indexes:**
```sql
-- Fast lookup of published pages
CREATE INDEX idx_wiki_published ON d_wiki(publication_status, published_at DESC)
WHERE active_flag = true;

-- Fast hierarchical queries
CREATE INDEX idx_wiki_parent ON d_wiki(parent_wiki_id, sort_order);

-- Fast entity wiki lookups
CREATE INDEX idx_wiki_entity ON d_wiki(primary_entity_type, primary_entity_id, active_flag);

-- Full-text search
CREATE INDEX idx_wiki_search ON d_wiki USING GIN(to_tsvector('english', name || ' ' || COALESCE(descr, '')));
```

**Query Optimization:**
```sql
-- GOOD: Use publication_status index
SELECT * FROM d_wiki
WHERE publication_status = 'published'
  AND active_flag = true
ORDER BY published_at DESC
LIMIT 20;

-- BAD: No index on keywords (array scan)
SELECT * FROM d_wiki
WHERE 'agile' = ANY(keywords);  -- Slow!
```

### 6. Content Size Limits

**Recommended Limits:**
- **Block content**: Max 10,000 characters per block
- **Total blocks**: Max 500 blocks per page
- **Image URLs**: Max 500 characters
- **Tags**: Max 20 tags per page
- **Page name**: Max 200 characters

**Validation:**
```typescript
// Check total content size before save
const totalSize = page.content.blocks.reduce((sum, block) => {
  return sum + (block.content?.length || 0);
}, 0);

if (totalSize > 500000) {  // 500KB limit
  throw new Error('Page content too large. Consider splitting into multiple pages.');
}
```

### 7. User Experience Best Practices

**Clear Feedback:**
```typescript
// Show version history
<div className="version-info">
  Version {page.version} • Last updated {formatDate(page.updated_ts)}
  {page.published_at && (
    <> • Published {formatDate(page.published_at)}</>
  )}
</div>

// Show auto-save indicator
{autoSaving && <span className="text-gray-500">Saving...</span>}
{lastSaved && <span className="text-green-500">✓ Saved {formatTime(lastSaved)}</span>}
```

**Keyboard Shortcuts:**
- `Ctrl/Cmd + S`: Save page
- `Ctrl/Cmd + B`: Bold text (future)
- `Ctrl/Cmd + K`: Insert link (future)
- `Enter` at end of block: Create new paragraph block
- `Backspace` on empty block: Delete block

**Preview Mode:**
- Show formatted content as it will appear
- Toggle between edit/preview modes
- Preview respects publication status styles

### 8. Security Considerations

**Access Control:**
```typescript
// Always check RBAC before displaying wiki
async function checkWikiAccess(userId: string, wikiId: string, permission: number) {
  const hasAccess = await db.execute(sql`
    SELECT 1 FROM app.entity_id_rbac_map
    WHERE empid = ${userId}
      AND entity = 'wiki'
      AND (entity_id = ${wikiId} OR entity_id = 'all')
      AND ${permission} = ANY(permission)
      AND active_flag = true
  `);

  return hasAccess.length > 0;
}
```

**Content Sanitization:**
- **HTML injection**: Sanitize user input in blocks
- **XSS prevention**: Escape special characters
- **Link validation**: Check external URLs
- **Image sources**: Validate image URLs (future S3 integration)

**Example:**
```typescript
import DOMPurify from 'dompurify';

// Sanitize block content before rendering
const sanitizedContent = DOMPurify.sanitize(block.content);
```

### 9. Testing Checklist

**Unit Tests:**
- [ ] Auto-resize textarea hook
- [ ] Block creation/update/delete
- [ ] Drag-and-drop reordering
- [ ] Publication status transitions
- [ ] Parent-child hierarchy validation

**Integration Tests:**
- [ ] Create wiki page (v1)
- [ ] Update content (v2, v3, ...)
- [ ] Publish page
- [ ] Archive page
- [ ] Get hierarchy
- [ ] RBAC permission checks

**End-to-End Tests:**
- [ ] Complete create workflow (UI → API → DB)
- [ ] Complete edit workflow
- [ ] Complete publish workflow
- [ ] Content rendering
- [ ] Shared URL access

**SQL Verification Queries:**
```sql
-- After publishing, verify status changed
SELECT id, name, publication_status, published_at, published_by_empid, version
FROM d_wiki
WHERE id = '{wiki-id}';
-- Expected: publication_status = 'published', published_at IS NOT NULL, version incremented

-- Check no circular parent references
WITH RECURSIVE hierarchy AS (
  SELECT id, parent_wiki_id, 1 as depth
  FROM d_wiki
  WHERE id = '{wiki-id}'
  UNION ALL
  SELECT w.id, w.parent_wiki_id, h.depth + 1
  FROM d_wiki w
  JOIN hierarchy h ON w.id = h.parent_wiki_id
  WHERE h.depth < 100  -- Safety limit
)
SELECT * FROM hierarchy WHERE id IN (SELECT parent_wiki_id FROM hierarchy);
-- Expected: 0 rows (no circular references)
```

---

## Summary

### ✅ What's Complete

- **API Endpoints**: All CRUD operations implemented
- **Database Schema**: Complete with hierarchical structure, publication workflow
- **Block-Based Editor**: Notion-style content editing with 11 block types
- **Auto-Resize Textareas**: No scrollbars, content expands naturally
- **Publication Workflow**: Draft → Review → Published → Archived
- **RBAC Integration**: Permission-based access control
- **Hierarchical Structure**: Parent-child relationships for organized content

### 🎯 Key Features

| Feature | Status |
|---------|--------|
| Block-based content | ✅ Complete |
| Auto-resize textareas | ✅ Complete |
| Drag-and-drop reordering | ✅ Complete |
| Real-time preview | ✅ Complete |
| Publication workflow | ✅ Complete |
| Hierarchical structure | ✅ Complete |
| RBAC integration | ✅ Complete |
| Shared URLs | ✅ Complete |
| Version tracking | ✅ Complete |
| Entity relationships | ✅ Complete |

### 📊 Key Metrics

| Metric | Value |
|--------|-------|
| API Endpoints | 6+ (all implemented) |
| Database Tables | 1 (`d_wiki`) |
| Block Types | 11 types |
| Max Blocks Per Page | Unlimited (recommended max 500) |
| Version Pattern | In-place with version incrementing |
| Storage | PostgreSQL (metadata + content) |

---

## Related Documentation

- **UI/UX Architecture**: `docs/ui_ux_route_api.md`
- **Database Schema**: `db/25_d_wiki.ddl`
- **API Implementation**: `apps/api/src/modules/wiki/routes.ts`
- **Frontend Designer**: `apps/web/src/components/entity/wiki/WikiDesigner.tsx`
- **Content Renderer**: `apps/web/src/components/entity/wiki/WikiContentRenderer.tsx`
- **Block Component**: `apps/web/src/components/entity/wiki/designer/WikiDraggableBlock.tsx`

---

**Last Updated:** 2025-10-23
**Status:** Production Ready (Full Stack Complete)
**Next Steps:** Consider adding collaborative editing, comment system, and full-text search
