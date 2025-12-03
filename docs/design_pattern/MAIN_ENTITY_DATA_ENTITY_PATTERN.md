# Main Entity + Data Entity Pattern

> **Version:** 1.0.0 | PMO Enterprise Platform
> **Status:** Production Standard
> **Updated:** 2025-12-03

## Executive Summary

This document defines the **Main Entity + Data Entity** architectural pattern used across the PMO platform. This pattern separates core entity records from their append-only activity/content data, enabling:

- **Audit trails** - Complete history of changes, comments, and updates
- **Temporal versioning** - Draft/saved stages for content lifecycle
- **Rich content storage** - JSONB fields for Quill Delta, markdown, form submissions
- **Loosely coupled UI** - Data entity containers render within main entity pages

---

## Table of Contents

1. [Pattern Overview](#1-pattern-overview)
2. [Database Architecture](#2-database-architecture)
3. [API Design](#3-api-design)
4. [Page Integration](#4-page-integration)
5. [Component Architecture](#5-component-architecture)
6. [Existing Implementations](#6-existing-implementations)
7. [Implementation Checklist](#7-implementation-checklist)
8. [Anti-Patterns](#8-anti-patterns)

---

## 1. Pattern Overview

### Concept

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MAIN ENTITY + DATA ENTITY PATTERN                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  MAIN ENTITY (d_{entity})              DATA ENTITY (d_{entity}_data)        │
│  ────────────────────────              ─────────────────────────────        │
│  • Single record per instance          • Multiple records per parent        │
│  • Core business attributes            • Activity log / content versions    │
│  • Standard CRUD operations            • Append-only (no soft delete)       │
│  • Has entity_instance registry        • NO entity_instance (not standalone)│
│  • Has RBAC (entity_rbac)              • Inherits RBAC from parent          │
│  • Soft delete (active_flag)           • Hard delete (if needed)            │
│                                                                              │
│  ┌─────────────────┐                   ┌─────────────────────────┐          │
│  │ task            │ 1 ──────────── N  │ d_task_data             │          │
│  │ • id            │                   │ • id                    │          │
│  │ • code          │                   │ • task_id (parent ref)  │          │
│  │ • name          │                   │ • stage (draft/saved)   │          │
│  │ • active_flag   │                   │ • data_richtext (JSONB) │          │
│  │ • ...           │                   │ • update_type           │          │
│  └─────────────────┘                   │ • updated_by__employee  │          │
│                                        │ • created_ts            │          │
│                                        └─────────────────────────┘          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Characteristics

| Aspect | Main Entity | Data Entity |
|--------|-------------|-------------|
| **Records** | 1 per instance | N per parent |
| **Purpose** | Core business record | Activity log / content |
| **RBAC** | Direct (`entity_rbac`) | Inherited from parent |
| **Registry** | `entity_instance` | None |
| **Delete** | Soft delete (`active_flag`) | Hard delete or never |
| **Versioning** | `version` column | `stage` (draft/saved) |
| **Foreign Keys** | None (platform pattern) | None (platform pattern) |

---

## 2. Database Architecture

### Main Entity Table (Standard)

```sql
-- Main entity follows standard entity pattern
CREATE TABLE app.task (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE,
    name varchar(255) NOT NULL,
    descr text,

    -- Business attributes
    project_id uuid,
    assigned_to__employee_id uuid,
    dl__task_status varchar(50),
    dl__task_priority varchar(50),

    -- Standard fields
    metadata jsonb DEFAULT '{}'::jsonb,
    active_flag boolean DEFAULT true,
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);
```

### Data Entity Table (Pattern)

```sql
-- =====================================================
-- DATA ENTITY PATTERN: {MAIN_ENTITY}_data
-- =====================================================
--
-- SEMANTICS:
-- • Data table for activity log, comments, content versions
-- • Uses JSONB for rich content (Quill Delta, form submissions, etc.)
-- • Links to parent via {parent}_id (NO foreign key - platform pattern)
-- • Supports draft/saved lifecycle via `stage` column
-- • Append-only pattern - preserves complete audit trail
--
-- OPERATIONS:
-- • CREATE: INSERT with stage='draft', created_ts=now()
-- • UPDATE: Same ID, updated_ts refreshes (for draft edits only)
-- • PUBLISH: UPDATE stage='draft' → 'saved' (finalize)
-- • QUERY: Filter by {parent}_id, update_type, date range
--
-- RELATIONSHIPS (NO FOREIGN KEYS - Platform Pattern):
-- • Parent: {main_entity} (via {parent}_id) - application-level integrity
-- • updated_by__employee_id → employee.id (soft reference)
--
-- =====================================================

CREATE TABLE app.d_{entity}_data (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Parent reference (NO FK - platform pattern)
    {parent}_id uuid NOT NULL,

    -- Data stage lifecycle
    stage varchar(20) DEFAULT 'draft',  -- draft, saved

    -- Author tracking
    updated_by__employee_id uuid,

    -- Content (JSONB for rich content)
    data_richtext jsonb DEFAULT '{}'::jsonb,
    -- OR content_markdown text (for wiki)
    -- OR submission_data jsonb (for form)

    -- Type categorization
    update_type varchar(50) DEFAULT 'comment',  -- comment, status_change, etc.

    -- Optional type-specific fields
    -- hours_logged decimal(8,2),              -- For task_data
    -- status_change_from varchar(50),         -- For task_data
    -- status_change_to varchar(50),           -- For task_data
    -- content_html text,                      -- For wiki_data
    -- submission_status varchar(50),          -- For form_data

    -- Extensible metadata
    metadata jsonb DEFAULT '{}'::jsonb,

    -- Temporal fields (NO active_flag - append-only)
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);

-- Index for efficient parent-based queries
CREATE INDEX idx_d_{entity}_data_{parent}_id ON app.d_{entity}_data({parent}_id);
CREATE INDEX idx_d_{entity}_data_stage ON app.d_{entity}_data(stage);

COMMENT ON TABLE app.d_{entity}_data IS 'Data table for {entity} activity/content tracking';
```

---

## 3. API Design

### Route Pattern

Data entities use **nested URL patterns** because:
1. Parent ID is always required (contextual)
2. RBAC is checked against parent entity
3. Clear URL hierarchy

```
GET    /api/v1/{parent}/:parentId/data          # List all data entries
POST   /api/v1/{parent}/:parentId/data          # Create new entry
GET    /api/v1/{parent}/:parentId/data/:dataId  # Get single entry
PATCH  /api/v1/{parent}/:parentId/data/:dataId  # Update entry (draft only)
DELETE /api/v1/{parent}/:parentId/data/:dataId  # Delete entry (if allowed)
```

### Custom Routes (Not Factory)

Data entity routes are **intentionally custom** (not using `createUniversalEntityRoutes`) because:

1. **Nested URL pattern** - `/api/v1/task/:taskId/data` differs from standard `/api/v1/{entity}` pattern
2. **Parent entity RBAC** - Permission checks against parent, not data entity itself
3. **Not a standalone entity** - No `entity_instance` registry, no direct RBAC entries
4. **Activity log pattern** - Append-only semantics differ from standard CRUD

### Route Implementation Template

```typescript
// apps/api/src/modules/{entity}-data/routes.ts

/**
 * ============================================================================
 * {ENTITY}-DATA ROUTES MODULE - Custom Routes for Activity/Content
 * ============================================================================
 *
 * ⚠️ CUSTOM ROUTES DECISION (NOT USING FACTORY PATTERN)
 * ──────────────────────────────────────────────────────
 * This module intentionally uses custom routes instead of createUniversalEntityRoutes
 * factory for the following reasons:
 *
 * 1. NESTED URL PATTERN: Uses /api/v1/{parent}/:parentId/data pattern
 * 2. PARENT ENTITY RBAC: Permission checks against parent entity
 * 3. NOT A STANDALONE ENTITY: Not registered in entity system
 * 4. ACTIVITY LOG PATTERN: Append-only with different CRUD semantics
 *
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { getEntityInfrastructure, Permission } from '@/services/entity-infrastructure.service.js';

const PARENT_ENTITY_CODE = '{parent}';

// Response schema
const DataEntrySchema = Type.Object({
  id: Type.String(),
  {parent}_id: Type.String(),
  stage: Type.String(),
  updated_by__employee_id: Type.String(),
  data_richtext: Type.Any(),
  update_type: Type.String(),
  metadata: Type.Optional(Type.Any()),
  created_ts: Type.String(),
  updated_ts: Type.String(),
  updated_by_name: Type.Optional(Type.String()),  // Joined from employee
});

// Create schema - permissive input philosophy (nulls allowed)
const CreateDataEntrySchema = Type.Object({
  {parent}_id: Type.String(),
  data_richtext: Type.Any(),
  update_type: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  metadata: Type.Optional(Type.Any()),
  stage: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

export async function {entity}DataRoutes(fastify: FastifyInstance) {
  const entityInfra = getEntityInfrastructure(db);

  // ═══════════════════════════════════════════════════════════════════════════
  // LIST: Get all data entries for parent
  // ═══════════════════════════════════════════════════════════════════════════
  fastify.get('/api/v1/{parent}/:parentId/data', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({ parentId: Type.String() }),
      response: {
        200: Type.Object({ data: Type.Array(DataEntrySchema), total: Type.Number() }),
        403: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const { parentId } = request.params as { parentId: string };

    // RBAC: Check VIEW permission on PARENT entity
    const canView = await entityInfra.check_entity_rbac(
      userId, PARENT_ENTITY_CODE, parentId, Permission.VIEW
    );
    if (!canView) {
      return reply.status(403).send({ error: 'No permission to view data' });
    }

    // Query with author name join
    const entries = await db.execute(sql`
      SELECT
        d.id, d.{parent}_id, d.stage, d.updated_by__employee_id,
        d.data_richtext, d.update_type, COALESCE(d.metadata, '{}'::jsonb) as metadata,
        d.created_ts, d.updated_ts,
        e.name as updated_by_name
      FROM app.d_{entity}_data d
      LEFT JOIN app.employee e ON d.updated_by__employee_id = e.id
      WHERE d.{parent}_id = ${parentId}::uuid
        AND d.stage = 'saved'
      ORDER BY d.created_ts DESC
    `);

    return { data: entries, total: entries.length };
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE: Add new data entry
  // ═══════════════════════════════════════════════════════════════════════════
  fastify.post('/api/v1/{parent}/:parentId/data', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({ parentId: Type.String() }),
      body: CreateDataEntrySchema,
      response: {
        201: DataEntrySchema,
        403: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const { parentId } = request.params as { parentId: string };
    const data = request.body as any;

    // Verify parent ID matches URL param
    if (data.{parent}_id !== parentId) {
      return reply.status(400).send({ error: 'Parent ID mismatch' });
    }

    // RBAC: Check EDIT permission on PARENT entity
    const canEdit = await entityInfra.check_entity_rbac(
      userId, PARENT_ENTITY_CODE, parentId, Permission.EDIT
    );
    if (!canEdit) {
      return reply.status(403).send({ error: 'No permission to add data' });
    }

    // Insert new entry
    const result = await db.execute(sql`
      INSERT INTO app.d_{entity}_data (
        {parent}_id, stage, updated_by__employee_id,
        data_richtext, update_type, metadata
      ) VALUES (
        ${parentId}::uuid,
        ${data.stage || 'saved'},
        ${userId}::uuid,
        ${JSON.stringify(data.data_richtext)}::jsonb,
        ${data.update_type || 'comment'},
        ${data.metadata ? JSON.stringify(data.metadata) : '{}'}::jsonb
      )
      RETURNING *
    `);

    const created = result[0];

    // Get author name
    const employee = await db.execute(sql`
      SELECT name FROM app.employee WHERE id = ${userId}::uuid
    `);

    return reply.status(201).send({
      ...created,
      updated_by_name: employee[0]?.name || null,
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GET SINGLE: Get specific data entry
  // ═══════════════════════════════════════════════════════════════════════════
  fastify.get('/api/v1/{parent}/:parentId/data/:dataId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({ parentId: Type.String(), dataId: Type.String() }),
      response: {
        200: DataEntrySchema,
        403: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const userId = request.user?.sub;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const { parentId, dataId } = request.params as { parentId: string; dataId: string };

    // RBAC: Check VIEW permission on PARENT entity
    const canView = await entityInfra.check_entity_rbac(
      userId, PARENT_ENTITY_CODE, parentId, Permission.VIEW
    );
    if (!canView) {
      return reply.status(403).send({ error: 'No permission to view data' });
    }

    const result = await db.execute(sql`
      SELECT
        d.*, e.name as updated_by_name
      FROM app.d_{entity}_data d
      LEFT JOIN app.employee e ON d.updated_by__employee_id = e.id
      WHERE d.id = ${dataId}::uuid AND d.{parent}_id = ${parentId}::uuid
    `);

    if (result.length === 0) {
      return reply.status(404).send({ error: 'Data entry not found' });
    }

    return result[0];
  });
}
```

---

## 4. Page Integration

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PAGE INTEGRATION PATTERN                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  EntitySpecificInstancePage (/:entityCode/:id)                               │
│  ├── EntityInstanceFormContainer           ← Main entity fields              │
│  │                                                                           │
│  ├── {Entity}DataContainer                 ← Data entity container           │
│  │   └── Conditionally rendered when entityCode === '{entity}'              │
│  │   └── Props: parentId, optional callbacks                                 │
│  │   └── Self-contained: own hooks, own API calls                           │
│  │                                                                           │
│  └── DynamicChildEntityTabs                ← Child entities (task, wiki)     │
│                                                                              │
│  SEPARATION OF CONCERNS:                                                     │
│  • Page owns: routing, parent data, edit mode                               │
│  • Container owns: data fetching, state, API calls, rendering               │
│  • Container is LOOSELY COUPLED: can be dropped into any page               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Page Code Pattern

```tsx
// EntitySpecificInstancePage.tsx

import { TaskDataContainer } from '../../components/entity/task';
import { WikiDataContainer } from '../../components/entity/wiki';  // Future
import { FormDataContainer } from '../../components/entity/form';  // Future

// Inside render:
{/* Main Entity Form */}
<EntityInstanceFormContainer data={data} metadata={formMetadata} ... />

{/* Data Entity Container - Conditionally rendered */}
{entityCode === 'task' && (
  <TaskDataContainer
    taskId={id!}
    projectId={data.project_id}  // Optional parent context
    onUpdatePosted={() => refetch()}
  />
)}

{entityCode === 'wiki' && (
  <WikiDataContainer
    wikiId={id!}
    onContentSaved={() => refetch()}
  />
)}

{entityCode === 'form' && currentChildEntity === 'submissions' && (
  <FormDataContainer
    formId={id!}
    formSchema={data.form_schema}
  />
)}
```

### Container Props Interface

```typescript
interface {Entity}DataContainerProps {
  // Required: Parent entity ID
  {parent}Id: string;

  // Optional: Additional parent context
  projectId?: string;      // For task_data
  formSchema?: object;     // For form_data

  // Optional: Callbacks for parent synchronization
  onUpdatePosted?: () => void;
  onContentSaved?: () => void;

  // Optional: View mode control
  isPublicView?: boolean;
  readOnly?: boolean;
}
```

---

## 5. Component Architecture

### Container Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DATA ENTITY CONTAINER ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  {Entity}DataContainer                                                       │
│  ├── PROPS                                                                   │
│  │   └── parentId, callbacks, options                                        │
│  │                                                                           │
│  ├── INTERNAL STATE                                                          │
│  │   ├── entries: DataEntry[]                                                │
│  │   ├── loading: boolean                                                    │
│  │   ├── newEntryDraft: string | object                                      │
│  │   └── isSubmitting: boolean                                               │
│  │                                                                           │
│  ├── HOOKS                                                                   │
│  │   ├── useEffect → Fetch entries on mount                                  │
│  │   └── Custom fetch/submit functions                                       │
│  │                                                                           │
│  ├── API CALLS (Self-contained)                                              │
│  │   ├── fetchEntries → GET /api/v1/{parent}/:id/data                       │
│  │   └── submitEntry → POST /api/v1/{parent}/:id/data                       │
│  │                                                                           │
│  ├── RENDER                                                                  │
│  │   ├── Header (title, actions)                                            │
│  │   ├── New Entry Form (rich text editor, submit button)                   │
│  │   ├── Entry List (formatted entries)                                      │
│  │   └── Empty State                                                         │
│  │                                                                           │
│  └── STYLING                                                                 │
│      └── Visual hierarchy: Content > Author > Metadata                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component File Template

```tsx
// apps/web/src/components/entity/{entity}/{Entity}DataContainer.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../lib/api';

interface {Entity}DataEntry {
  id: string;
  {parent}_id: string;
  stage: string;
  updated_by__employee_id: string;
  data_richtext: any;  // Quill Delta or structured content
  update_type: string;
  metadata?: Record<string, any>;
  created_ts: string;
  updated_ts: string;
  updated_by_name?: string;
}

interface {Entity}DataContainerProps {
  {parent}Id: string;
  // Optional context
  projectId?: string;
  // Callbacks
  onUpdatePosted?: () => void;
  // Options
  isPublicView?: boolean;
}

export function {Entity}DataContainer({
  {parent}Id,
  projectId,
  onUpdatePosted,
  isPublicView = false,
}: {Entity}DataContainerProps) {
  const { token } = useAuth();

  // State
  const [entries, setEntries] = useState<{Entity}DataEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch entries
  const fetchEntries = useCallback(async () => {
    if (!{parent}Id || !token) return;

    setLoading(true);
    try {
      const response = await api.get(`/api/v1/{parent}/${{{parent}Id}}/data`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEntries(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch entries:', error);
    } finally {
      setLoading(false);
    }
  }, [{parent}Id, token]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Submit new entry
  const handleSubmit = async () => {
    if (!newContent || isSubmitting || !token) return;

    setIsSubmitting(true);
    try {
      await api.post(`/api/v1/{parent}/${{{parent}Id}}/data`, {
        {parent}_id: {parent}Id,
        data_richtext: newContent,
        update_type: 'comment',
        stage: 'saved',
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setNewContent(null);
      await fetchEntries();
      onUpdatePosted?.();
    } catch (error) {
      console.error('Failed to submit entry:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render helpers
  const renderRichText = (content: any) => {
    // Convert Quill Delta to displayable content
    // ... implementation
  };

  const formatRelativeTime = (timestamp: string) => {
    // ... implementation
  };

  return (
    <div className="bg-dark-100 border border-dark-300 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-dark-900 mb-4">Activity</h3>

      {/* New Entry Form (if not public/readonly) */}
      {!isPublicView && (
        <div className="mb-6">
          {/* Rich text editor component */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !newContent}
            className="mt-2 px-4 py-2 bg-brand-600 text-white rounded-lg"
          >
            {isSubmitting ? 'Posting...' : 'Post Update'}
          </button>
        </div>
      )}

      {/* Entry List */}
      {loading ? (
        <div className="text-center py-8 text-dark-500">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-8 text-dark-500">
          No updates yet.
        </div>
      ) : (
        <div className="space-y-5">
          {entries.map((entry) => (
            <div key={entry.id} className="group">
              {/* Visual hierarchy: Content > Author > Metadata */}
              <div className="flex space-x-3">
                {/* Avatar */}
                <div className="w-8 h-8 bg-dark-200 rounded-full flex items-center justify-center text-xs font-medium text-dark-500">
                  {entry.updated_by_name?.charAt(0).toUpperCase() || 'U'}
                </div>

                {/* Content */}
                <div className="flex-1">
                  {/* Header: Author prominent, metadata muted */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-medium text-dark-800">
                      {entry.updated_by_name || 'Unknown'}
                    </span>
                    <span className="text-xs text-dark-500">
                      {formatRelativeTime(entry.created_ts)}
                    </span>
                  </div>

                  {/* Message - MOST PROMINENT */}
                  <div className="text-sm text-dark-800 leading-relaxed">
                    {renderRichText(entry.data_richtext)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Export Pattern

```tsx
// apps/web/src/components/entity/{entity}/index.ts
export { {Entity}DataContainer } from './{Entity}DataContainer';
```

---

## 6. Existing Implementations

### Current Data Entities

| Main Entity | Data Entity | Purpose | Rich Content |
|-------------|-------------|---------|--------------|
| `task` | `d_task_data` | Comments, status changes, time logs | Quill Delta |
| `wiki` | `wiki_data` | Content versions, markdown | Markdown + HTML |
| `form` | `form_data` | Form submissions | Flattened JSONB |
| `workflow` | `workflow_data` | Workflow instance state | Graph JSONB |
| `message` | `f_message_data` | Message content/delivery | Structured JSONB |
| `orchestrator_session` | `orchestrator_agent_log` | LLM conversation audit | Structured JSONB |
| `orchestrator_session` | `orchestrator_summary` | Conversation summaries | Text |

### task_data Implementation

**DDL**: `db/13_task_data.ddl`
**API**: `apps/api/src/modules/task-data/routes.ts`
**Component**: `apps/web/src/components/entity/task/TaskDataContainer.tsx`

Features:
- Rich text comments (Quill Delta)
- Status change tracking
- Hours logged
- Form submission embedding
- Employee mentions

### wiki_data Implementation

**DDL**: `db/33_wiki_data.ddl`

Features:
- Markdown content
- HTML render cache
- Change summaries
- Word count / reading time
- Internal/external link tracking

### form_data Implementation

**DDL**: `db/31_form_data.ddl`

Features:
- Flattened submission data
- Approval workflow
- Submission metadata (IP, user agent)
- Status tracking (draft, submitted, approved, rejected)

---

## 7. Implementation Checklist

### Adding a New Data Entity

```markdown
□ Database
  □ Create DDL file: db/{number}_{entity}_data.ddl
  □ Follow data entity table pattern (see Section 2)
  □ Add parent_id index
  □ Add stage index
  □ Document in file header
  □ Run ./tools/db-import.sh

□ API Routes
  □ Create routes file: apps/api/src/modules/{entity}-data/routes.ts
  □ Follow custom routes pattern (NOT factory)
  □ Implement LIST endpoint (GET)
  □ Implement CREATE endpoint (POST)
  □ Implement GET SINGLE endpoint (GET/:dataId)
  □ Use parent entity RBAC (not data entity RBAC)
  □ Register in apps/api/src/modules/index.ts
  □ Test with ./tools/test-api.sh

□ Frontend Component
  □ Create container: apps/web/src/components/entity/{entity}/{Entity}DataContainer.tsx
  □ Create index export: apps/web/src/components/entity/{entity}/index.ts
  □ Self-contained: own state, own API calls
  □ Props: parentId (required), callbacks (optional)
  □ Visual hierarchy: Content > Author > Metadata

□ Page Integration
  □ Import container in EntitySpecificInstancePage.tsx
  □ Conditional render: {entityCode === '{entity}' && <Container />}
  □ Pass parentId and optional callbacks
  □ Test page rendering

□ Documentation
  □ Update this document with new implementation
```

---

## 8. Anti-Patterns

### Avoid These

| Anti-Pattern | Why Bad | Correct Approach |
|--------------|---------|------------------|
| Factory routes for data entity | Nested URL doesn't fit factory | Custom routes |
| Direct data entity RBAC | Not a standalone entity | Parent entity RBAC |
| Entity instance registry | Not a first-class entity | None needed |
| Foreign keys | Platform no-FK pattern | Application integrity |
| Soft delete (active_flag) | Append-only audit trail | Hard delete or never |
| Coupling to specific page | Reduces reusability | Loosely coupled container |
| Page fetches data entity | Mixing concerns | Container self-fetches |

### Correct Patterns

```typescript
// ✅ CORRECT: Parent entity RBAC check
const canView = await entityInfra.check_entity_rbac(
  userId, 'task', taskId, Permission.VIEW  // Check TASK, not task_data
);

// ❌ WRONG: Direct data entity RBAC check
const canView = await entityInfra.check_entity_rbac(
  userId, 'task_data', dataId, Permission.VIEW  // task_data is not registered!
);

// ✅ CORRECT: Nested URL pattern
fastify.get('/api/v1/task/:taskId/data', ...);

// ❌ WRONG: Flat URL pattern
fastify.get('/api/v1/task-data', ...);  // No parent context!

// ✅ CORRECT: Container self-contained
<TaskDataContainer taskId={id} />  // Fetches own data

// ❌ WRONG: Page fetches and passes
const taskData = useTaskData(id);
<TaskDataDisplay data={taskData} />  // Page shouldn't fetch child data
```

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [PAGE_LAYOUT_COMPONENT_ARCHITECTURE.md](../ui_page/PAGE_LAYOUT_COMPONENT_ARCHITECTURE.md) | Page architecture |
| [entity-infrastructure.service.md](../services/entity-infrastructure.service.md) | Entity infrastructure |
| [RBAC_INFRASTRUCTURE.md](../rbac/RBAC_INFRASTRUCTURE.md) | Permission system |
| [CLAUDE.md](../../CLAUDE.md) | Platform overview |

---

**Version:** 1.0.0
**Last Updated:** 2025-12-03
**Status:** Production Standard
