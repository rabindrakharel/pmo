# Form System - Complete Architecture & Flow Documentation

> **Comprehensive technical reference for the PMO form system** - Multi-step form builder with JSONB schema, S3 file storage, public submissions, and in-place versioning.
>
> **Last Updated:** 2025-10-31 | **Status:** Production v2.8
>
> **Target Audience:** Staff-level software architects and engineers extending or maintaining the form system

---

## Table of Contents

1. [Semantics & Business Context](#1-semantics--business-context)
2. [Architecture, Block Diagrams & DRY Design Patterns](#2-architecture-block-diagrams--dry-design-patterns)
3. [Database, API & UI/UX Mapping](#3-database-api--uiux-mapping)
4. [Entity Relationships](#4-entity-relationships)
5. [Central Configuration & Middleware](#5-central-configuration--middleware)
6. [User Interaction Flow Examples](#6-user-interaction-flow-examples)
7. [Critical Considerations When Building](#7-critical-considerations-when-building)

---

## 1. Semantics & Business Context

### Core Capabilities

The form system provides a **schema-driven, multi-step form builder** with the following production-grade features:

- **JSONB Schema Storage**: All field definitions stored in `form_schema` JSONB column (database-driven configuration)
- **In-Place Versioning**: `version` field increments on schema changes while `id` remains stable for public URLs
- **Multi-Step Workflows**: Support for wizard-style forms with step-by-step validation
- **Public Anonymous Submissions**: `shared_url` enables unauthenticated form fills without login
- **S3 File Storage**: Files and signatures stored as S3 object keys (~100 bytes) instead of base64 (~200KB+)
- **Entity Integration**: Forms can be linked to projects, tasks, clients via `entity_id_map` table
- **RBAC Enforcement**: Full permission system (view, edit, share, delete, create) with JWT authentication

### Form Lifecycle States

```
CREATE → BUILD → PUBLISH → COLLECT → APPROVE → ARCHIVE
```

**Submission States Flow:**
```
draft → submitted → approved/rejected → completed
```

### Business Rules

1. **Version Management**: Schema changes trigger `version++`, same `id` maintains stable public URLs
2. **Anonymous Submissions**: Public forms use sentinel UUID `00000000-0000-0000-0000-000000000000` for `submitted_by_empid`
3. **File Storage Pattern**: Files/signatures store S3 object keys in format: `tenant_id=demo/entity=form/entity_id={uuid}/filename.ext`
4. **Soft Delete Only**: Forms are never hard-deleted; `UPDATE active_flag=false, to_ts=NOW()` preserves all submissions
5. **URL Stability**: `internal_url` for authenticated users, `shared_url` for public access (both remain stable across versions)

---

## 2. Architecture, Block Diagrams & DRY Design Patterns

### System Layer Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER (React 19)                      │
│ ┌─────────────────┐  ┌────────────────┐  ┌─────────────────────────┐ │
│ │ FormBuilderPage │  │  FormEditPage  │  │  EntityDetailPage       │ │
│ │   /form/new     │  │ /form/:id/edit │  │     /form/:id           │ │
│ └────────┬────────┘  └────────┬───────┘  └───────────┬─────────────┘ │
│          │                     │                       │               │
│          ▼                     ▼                       ▼               │
│ ┌─────────────────────────────────────────────────────────────────┐   │
│ │              AdvancedFormBuilder (Drag-Drop Editor)             │   │
│ │  • Field Type Palette (30+ field types)                         │   │
│ │  • Multi-Step Management                                        │   │
│ │  • Real-time Validation                                         │   │
│ │  • JSONB Schema Output: { steps: [...], currentStepIndex: 0 }  │   │
│ └──────────────────────────────────┬──────────────────────────────┘   │
│                                    │                                   │
│                                    ▼                                   │
│ ┌─────────────────────────────────────────────────────────────────┐   │
│ │              InteractiveForm (Multi-Step Renderer)              │   │
│ │  • Step-by-step navigation                                      │   │
│ │  • Field validation per step                                    │   │
│ │  • S3 file upload integration (useS3Upload hook)                │   │
│ │  • Signature/initials capture with canvas                       │   │
│ │  • Progress tracking & state management                         │   │
│ └─────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────┬───────────────────────────────┘
                                        │ HTTP/REST (JWT Auth)
                                        ▼
┌───────────────────────────────────────────────────────────────────────┐
│                         API LAYER (Fastify v5)                         │
│ ┌─────────────────────────────────────────────────────────────────┐   │
│ │             apps/api/src/modules/form/routes.ts                 │   │
│ │  • 12 REST Endpoints (CRUD + Submissions + Public)              │   │
│ │  • RBAC Middleware (entity_id_rbac_map enforcement)             │   │
│ │  • In-place versioning logic (schema diff detection)            │   │
│ │  • Presigned URL generation for S3 uploads                      │   │
│ └─────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────┬───────────────────────────────┘
                                        │ SQL (Parameterized Queries)
                                        ▼
┌───────────────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER (PostgreSQL 14+)                     │
│ ┌────────────────────┐  ┌─────────────────┐  ┌──────────────────┐    │
│ │   d_form_head      │  │  d_form_data    │  │ entity_id_map    │    │
│ │  (Definitions)     │  │  (Submissions)  │  │  (Linkages)      │    │
│ │                    │  │                 │  │                  │    │
│ │ • id (UUID)        │  │ • id (UUID)     │  │ • parent_id      │    │
│ │ • slug             │  │ • form_id (FK)  │  │ • parent_type    │    │
│ │ • form_schema      │  │ • submission_   │  │ • child_id       │    │
│ │   (JSONB)          │  │   data (JSONB)  │  │ • child_type     │    │
│ │ • version          │  │ • approval_     │  │                  │    │
│ │ • active_flag      │  │   status        │  │                  │    │
│ │ • shared_url       │  │ • stage         │  │                  │    │
│ └────────────────────┘  └─────────────────┘  └──────────────────┘    │
└───────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌───────────────────────────────────────────────────────────────────────┐
│                      STORAGE LAYER (AWS S3 / MinIO)                    │
│  • Bucket: pmo-attachments                                             │
│  • Path Pattern: tenant_id=demo/entity=form/entity_id={uuid}/file.ext │
│  • Presigned URLs: 1-hour expiry for upload/download                   │
│  • Files: PDFs, images, signatures (canvas → PNG)                      │
└───────────────────────────────────────────────────────────────────────┘
```

### DRY Design Patterns

#### Pattern 1: Builder-Renderer Separation

**Problem**: Tight coupling between form editor and form renderer makes reuse impossible.

**Solution**: `AdvancedFormBuilder` outputs pure JSONB schema → `InteractiveForm` consumes schema (zero coupling).

```typescript
// AdvancedFormBuilder outputs this JSONB structure
{
  steps: [
    { id: 'step1', name: 'contact', title: 'Contact Info', fields: [...] }
  ],
  currentStepIndex: 0
}

// InteractiveForm receives schema and renders independently
<InteractiveForm
  schema={formSchema}           // Pure data structure
  onSubmit={handleSubmit}       // Callback only
  mode="fill"                   // fill | preview
/>
```

**Benefits**:
- `InteractiveForm` used in 5+ contexts (builder preview, entity detail, public forms, task forms, email embeds)
- Schema changes don't require renderer updates
- Single source of truth for form rendering logic

#### Pattern 2: Unified S3 Upload Hook

**Problem**: File uploads, signatures, and initials had duplicate S3 logic across components.

**Solution**: Single `useS3Upload()` hook with specialized wrapper functions.

```typescript
// apps/web/src/lib/hooks/useS3Upload.ts
export const useS3Upload = () => {
  const uploadFile = async (file: File, entityType: string, entityId: string) => {
    // 1. Request presigned URL from API
    // 2. Upload file to S3 using PUT
    // 3. Return object key (NOT file data)
    return { objectKey: 's3://bucket/path/file.pdf', format: 'pdf', size: 12345 };
  };

  return { uploadFile };
};

// Wrapper functions for specific use cases
export const uploadFileToS3 = async (file: File) => { ... };
export const uploadSignatureToS3 = async (dataUrl: string) => {
  // Convert canvas data URL → blob → S3
  const blob = dataURLToBlob(dataUrl);
  return uploadFile(blob, 'form', formId);
};
```

**Storage Pattern**:
- Database stores: `attachment: 's3://bucket/path/file.pdf'` (~100 bytes)
- NOT stored: Base64-encoded file data (~200KB for 1MB file)
- Download: Request presigned URL → browser fetches from S3 directly

#### Pattern 3: In-Place Versioning

**Problem**: Creating new form records for each edit breaks public URL stability.

**Solution**: Same `id` UUID, increment `version` integer on substantive changes.

```typescript
// apps/api/src/modules/form/routes.ts:510-595
const schemaChanged = data.form_schema !== undefined &&
  JSON.stringify(data.form_schema) !== JSON.stringify(current.form_schema);

if (schemaChanged) {
  // IN-PLACE VERSION UPDATE: Same ID, increment version
  const newVersion = (current.version || 1) + 1;
  await db.execute(sql`
    UPDATE app.d_form_head
    SET form_schema = ${JSON.stringify(data.form_schema)},
        version = ${newVersion},
        updated_ts = NOW()
    WHERE id = ${id}
  `);
} else {
  // Metadata-only update: No version change
  await db.execute(sql`UPDATE ... SET name = ${data.name}, descr = ${data.descr} ...`);
}
```

**Result**: Public URL `https://app.com/form/{id}` remains stable across 100+ schema updates.

#### Pattern 4: JSONB Schema Flexibility

**Problem**: Hard-coded field types require database migrations for new features.

**Solution**: All field metadata stored in `form_schema` JSONB column.

```typescript
// Example form_schema structure
{
  steps: [
    {
      id: "step_contact",
      name: "contact",
      title: "Contact Information",
      description: "Tell us how to reach you",
      fields: [
        {
          id: "field_email",
          name: "email",
          label: "Email Address",
          type: "email",
          required: true,
          placeholder: "you@example.com"
        },
        {
          id: "field_signature",
          name: "signature",
          type: "signature",
          required: true,
          signatureWidth: 500,
          signatureHeight: 200
        }
      ]
    }
  ],
  currentStepIndex: 0
}
```

**Adding New Field Type** (Zero database changes):
1. Add type to `FieldType` union in `FormBuilder.tsx:16`
2. Add palette button in `AdvancedFormBuilder.tsx:19-53`
3. Add renderer case in `InteractiveForm.tsx:150-350`

---

## 3. Database, API & UI/UX Mapping

### Database Schema

**`d_form_head` (Form Definitions)**
```sql
CREATE TABLE app.d_form_head (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(100) NOT NULL,                      -- URL-safe identifier (name-based + timestamp)
    code varchar(50) NOT NULL,                       -- Business code (FORM-{timestamp})
    name varchar(200) NOT NULL,                      -- Display name
    descr text,                                      -- Description

    -- URLs
    internal_url varchar(500),                       -- Authenticated URL (/form/{id})
    shared_url varchar(500),                         -- Public anonymous URL (/form/{hash})

    -- Form Configuration
    form_type varchar(50) DEFAULT 'multi_step',      -- multi_step | single_page
    form_schema jsonb DEFAULT '{"steps": []}'::jsonb, -- CORE: All field definitions

    -- Versioning & Lifecycle
    version integer DEFAULT 1,                       -- Increments on schema changes
    from_ts timestamptz DEFAULT NOW(),               -- Version start date
    to_ts timestamptz,                               -- Version end date (soft delete)
    active_flag boolean DEFAULT true,                -- Active status

    -- Audit
    created_ts timestamptz DEFAULT NOW(),
    updated_ts timestamptz DEFAULT NOW()
);

CREATE INDEX idx_form_head_slug ON app.d_form_head(slug);
CREATE INDEX idx_form_head_active ON app.d_form_head(active_flag, version);
```

**`d_form_data` (Form Submissions)**
```sql
CREATE TABLE app.d_form_data (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id uuid NOT NULL REFERENCES app.d_form_head(id),

    -- Submission Content
    submission_data jsonb NOT NULL,                  -- CORE: Field values (S3 keys for files)
    submission_status varchar(50) DEFAULT 'draft',   -- draft | submitted | completed
    stage varchar(50) DEFAULT 'saved',               -- saved | in_progress | final

    -- Submitter Info
    submitted_by_empid uuid,                         -- Employee ID (00000000... for anonymous)
    submission_ip_address varchar(100),              -- Client IP
    submission_user_agent text,                      -- Browser info

    -- Approval Workflow
    approval_status varchar(50),                     -- pending | approved | rejected
    approved_by_empid uuid,                          -- Approver employee ID
    approval_notes text,                             -- Approval/rejection reason
    approved_at timestamptz,                         -- Approval timestamp

    -- Audit
    created_ts timestamptz DEFAULT NOW(),
    updated_ts timestamptz DEFAULT NOW()
);

CREATE INDEX idx_form_data_form_id ON app.d_form_data(form_id);
CREATE INDEX idx_form_data_status ON app.d_form_data(submission_status, approval_status);
```

**Key Schema Design Decisions:**

1. **JSONB for Flexibility**: `form_schema` and `submission_data` use JSONB for schema-less flexibility
2. **Version History**: `version` + `from_ts`/`to_ts` enable temporal queries (get form state at time T)
3. **S3 Object Keys**: `submission_data` stores `{ signature: 's3://path/file.png' }`, NOT base64 data
4. **Anonymous Sentinel**: `submitted_by_empid = '00000000-0000-0000-0000-000000000000'` for public submissions
5. **Soft Delete**: `to_ts` and `active_flag` preserve historical data

### API Endpoints

**File**: `apps/api/src/modules/form/routes.ts` (1,140 lines)

```typescript
// AUTHENTICATED ENDPOINTS (Require JWT)
GET    /api/v1/form                          // List forms (RBAC filtered, latest versions)
GET    /api/v1/form/:id                      // Get single form definition
GET    /api/v1/form/versions/:slug           // Get all versions by slug
POST   /api/v1/form                          // Create form (permission 4 = create)
PUT    /api/v1/form/:id                      // Update form (schema change → version++)
DELETE /api/v1/form/:id                      // Soft delete (active_flag = false)

POST   /api/v1/form/:id/submit               // Submit form (authenticated user)
GET    /api/v1/form/:id/data                 // List submissions (paginated)
GET    /api/v1/form/:id/data/:submissionId   // Get single submission
PUT    /api/v1/form/:id/data/:submissionId   // Update submission (edit mode)

// PUBLIC ENDPOINTS (No authentication)
GET    /api/v1/public/form/:id               // Get form for public filling
POST   /api/v1/public/form/:id/submit        // Submit anonymous form (no JWT)
```

**Critical Implementation Details:**

**1. RBAC Filtering (All authenticated endpoints)**
```typescript
// apps/api/src/modules/form/routes.ts:82-93
const conditions: any[] = [
  sql`(
    EXISTS (
      SELECT 1 FROM app.entity_id_rbac_map rbac
      WHERE rbac.empid = ${userId}
        AND rbac.entity = 'form'
        AND (rbac.entity_id = f.id::text OR rbac.entity_id = 'all')
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
        AND 0 = ANY(rbac.permission)  -- 0 = view permission
    )
  )`
];
```

**2. Version Management (Update endpoint)**
```typescript
// apps/api/src/modules/form/routes.ts:510-595
const schemaChanged = data.form_schema !== undefined &&
  JSON.stringify(data.form_schema) !== JSON.stringify(current.form_schema);

if (schemaChanged) {
  // Increment version, keep same ID
  const newVersion = (current.version || 1) + 1;
  await db.execute(sql`
    UPDATE app.d_form_head
    SET form_schema = ${JSON.stringify(data.form_schema)},
        version = ${newVersion},
        updated_ts = NOW()
    WHERE id = ${id}
  `);
} else {
  // Metadata-only update (name, descr, active_flag)
  // No version increment
}
```

**3. Anonymous Submission Handling**
```typescript
// apps/api/src/modules/form/routes.ts:1050-1071
// Public endpoint uses sentinel UUID for anonymous users
await db.execute(sql`
  INSERT INTO app.d_form_data (
    form_id, submission_data, submitted_by_empid
  ) VALUES (
    ${id},
    ${JSON.stringify(data.submissionData)},
    '00000000-0000-0000-0000-000000000000'::uuid  -- Anonymous marker
  )
`);
```

**4. Auto-Permission Grant on Create**
```typescript
// apps/api/src/modules/form/routes.ts:430-448
// Form creator automatically gets full permissions
await db.execute(sql`
  INSERT INTO app.entity_id_rbac_map (
    empid, entity, entity_id, permission, active_flag
  ) VALUES (
    ${userId}, 'form', ${created.id}::text,
    ARRAY[0, 1, 2, 3],  -- view, edit, share, delete (not create)
    true
  )
`);
```

### UI/UX Component Architecture

**Route Mapping:**
```typescript
// apps/web/src/App.tsx:159-167
<Route path="/form" element={<EntityMainPage entityType="form" />} />
<Route path="/form/new" element={<FormBuilderPage />} />
<Route path="/form/:id" element={<EntityDetailPage entityType="form" />} />
<Route path="/form/:id/edit" element={<FormEditPage />} />
<Route path="/form/:formId/data/:submissionId" element={<FormDataPreviewPage />} />
```

**Component Responsibilities:**

| Component | File | Purpose | Key Features |
|-----------|------|---------|-------------|
| `FormBuilderPage` | `/pages/form/FormBuilderPage.tsx` | Create new forms | • Wraps `AdvancedFormBuilder`<br>• `POST /api/v1/form` with `form_schema`<br>• Navigates to `/form/{id}` on success |
| `FormEditPage` | `/pages/form/FormEditPage.tsx` | Edit existing forms | • Fetches form via `GET /api/v1/form/:id`<br>• Passes `initialFormData` to `AdvancedFormBuilder`<br>• `PUT /api/v1/form/:id` with updated schema |
| `EntityDetailPage` | `/pages/shared/EntityDetailPage.tsx` | View/fill forms | • Detects `entityType="form"`<br>• Renders `InteractiveForm` in "fill" mode<br>• Handles schema parsing (string → object) |
| `FormDataPreviewPage` | `/pages/form/FormDataPreviewPage.tsx` | View/edit submissions | • `GET /api/v1/form/:id/data/:subId`<br>• Uses `FormSubmissionEditor`<br>• `PUT` to update submission |
| `PublicFormPage` | `/pages/form/PublicFormPage.tsx` | Public anonymous forms | • `GET /api/v1/public/form/:id`<br>• No authentication<br>• Anonymous submission |

**Core Components:**

**`AdvancedFormBuilder` (Schema Editor)**
- **File**: `apps/web/src/components/entity/form/FormBuilder.tsx` (2,500+ lines)
- **Purpose**: Drag-and-drop form schema editor
- **Features**:
  - 30+ field types (text, email, signature, file, datatable, wiki, etc.)
  - Multi-step workflow management
  - Field properties panel (validation, options, styling)
  - Real-time preview mode
  - Undo/redo support (future enhancement)
- **Output**: `formData.form_schema` JSONB structure
- **Usage**:
  ```tsx
  // Create mode
  <AdvancedFormBuilder onSave={handleCreate} />

  // Edit mode
  <AdvancedFormBuilder
    initialFormData={{ name, descr, form_schema }}
    onSave={handleUpdate}
  />
  ```

**`InteractiveForm` (Multi-Step Renderer)**
- **File**: `apps/web/src/components/entity/form/InteractiveForm.tsx` (800+ lines)
- **Purpose**: Render multi-step forms with validation and S3 uploads
- **Features**:
  - Step-by-step navigation with progress bar
  - Per-step validation before advancing
  - S3 file upload integration (`useS3Upload` hook)
  - Signature canvas with save to S3
  - Draft state management (auto-save)
  - Submit/preview modes
- **Usage**:
  ```tsx
  <InteractiveForm
    schema={formSchema}           // Parsed JSONB
    onSubmit={handleSubmit}       // Callback with submission data
    mode="fill"                   // fill | preview
    submissionId={id}             // Optional: for edit mode
  />
  ```

**Critical Code Patterns:**

**Schema Parsing (EntityDetailPage.tsx:470-475)**
```typescript
// MUST parse form_schema if it's a string (API returns string or object)
let schema = data.form_schema;
if (typeof schema === 'string') {
  schema = JSON.parse(schema);
}
```

**Payload Structure (FormBuilderPage.tsx:27, FormEditPage.tsx:44)**
```typescript
// ✅ CORRECT - Use form_schema, NOT schema
const payload = {
  name: formData.name,
  descr: formData.descr,
  form_type: 'multi_step',
  form_schema: formData.form_schema  // NOT schema!
};

// ❌ WRONG - Will fail validation
const payload = { schema: formData.form_schema };
```

**S3 Upload Pattern (InteractiveForm.tsx:250-280)**
```typescript
// File upload
const handleFileUpload = async (file: File, fieldName: string) => {
  const { objectKey, format, size } = await uploadFileToS3(file);

  // Store S3 object key in submission data
  setFormData(prev => ({
    ...prev,
    [fieldName]: objectKey  // 's3://bucket/path/file.pdf'
  }));
};

// Signature upload (canvas → PNG → S3)
const handleSignatureSave = async (dataUrl: string, fieldName: string) => {
  const { objectKey } = await uploadSignatureToS3(dataUrl);

  setFormData(prev => ({
    ...prev,
    [fieldName]: objectKey  // 's3://bucket/path/signature.png'
  }));
};
```

---

## 4. Entity Relationships

### Form Entity Linkages

Forms participate in the universal entity linkage system via `entity_id_map`:

```
┌────────────┐         ┌────────────────┐         ┌────────────┐
│  Project   │────┬───>│ entity_id_map  │<───┬────│  Form      │
│  (Parent)  │    │    │                │    │    │  (Child)   │
└────────────┘    │    │ parent_type    │    │    └────────────┘
                  │    │ parent_id      │    │
┌────────────┐    │    │ child_type     │    │    ┌────────────┐
│   Task     │────┘    │ child_id       │    └────│ Submission │
│  (Parent)  │         └────────────────┘         │  (Child)   │
└────────────┘                                    └────────────┘
```

**Linkage Examples:**

1. **Project → Form**: Quality inspection forms linked to construction projects
2. **Task → Form**: Task-specific checklists with completion criteria
3. **Client → Form**: Customer intake forms, service requests
4. **Form → Submission**: One-to-many relationship (tracked in `d_form_data.form_id`)

**Database Representation:**
```sql
-- Link form to project
INSERT INTO app.entity_id_map (parent_type, parent_id, child_type, child_id)
VALUES ('project', '...uuid...', 'form', '...uuid...');

-- Query all forms linked to a project
SELECT f.* FROM app.d_form_head f
INNER JOIN app.entity_id_map eim ON eim.child_id = f.id::text
WHERE eim.parent_type = 'project' AND eim.parent_id = '...uuid...';
```

**API Support:**
```typescript
// Get forms linked to an entity
GET /api/v1/entity/:entityType/:entityId/children?childType=form

// Create linkage when creating form
POST /api/v1/form { ..., linkages: [{ parent_type: 'project', parent_id: '...' }] }
```

### Form Data Model

**Foreign Key Relationships:**
```sql
d_form_data.form_id → d_form_head.id        -- Submission belongs to form
d_form_data.submitted_by_empid → d_employee.id  -- Submitter (optional)
d_form_data.approved_by_empid → d_employee.id   -- Approver (optional)
```

**RBAC Relationships:**
```sql
entity_id_rbac_map.entity = 'form'          -- Entity type
entity_id_rbac_map.entity_id = d_form_head.id::text  -- Specific form or 'all'
entity_id_rbac_map.empid → d_employee.id    -- User with permission
```

---

## 5. Central Configuration & Middleware

### Entity Configuration

**File**: `apps/web/src/lib/entityConfig.ts:704-745`

```typescript
form: {
  name: 'form',
  displayName: 'Form',
  pluralName: 'Forms',
  apiEndpoint: '/api/v1/form',
  shareable: true,  // Enables public sharing feature

  columns: generateColumns(['name', 'active_flag', 'version', 'updated_ts'], {
    overrides: {
      active_flag: {
        title: 'Status',
        render: (value) => value
          ? <Badge color="green">Active</Badge>
          : <Badge color="gray">Inactive</Badge>
      },
      version: { align: 'center' }
    }
  }),

  fields: [
    { key: 'name', label: 'Form Name', type: 'text', required: true },
    { key: 'descr', label: 'Description', type: 'textarea' },
    { key: 'url', label: 'Public Form URL', type: 'text', readonly: true },
    { key: 'schema', label: 'Form Schema', type: 'jsonb', required: true },
    { key: 'active_flag', label: 'Active', type: 'select', options: [
      { value: 'true', label: 'Active' },
      { value: 'false', label: 'Inactive' }
    ]},
    // ... metadata, timestamps
  ],

  supportedViews: ['table'],
  defaultView: 'table'
}
```

**Why Form is Shareable:**
- `shareable: true` enables "Share" button in `EntityDetailPage`
- `ShareModal` component generates public links
- Public URLs route to `PublicFormPage` (no authentication)

### Authentication & RBAC Middleware

**JWT Authentication** (`fastify.authenticate` hook):
```typescript
// apps/api/src/modules/form/routes.ts:40
fastify.get('/api/v1/form', {
  preHandler: [fastify.authenticate],  // Requires valid JWT
  // ...
});
```

**RBAC Permission Checks:**
```typescript
// Permission array: [view, edit, share, delete, create] = [0, 1, 2, 3, 4]

// View permission check (routes.ts:82-93)
EXISTS (
  SELECT 1 FROM app.entity_id_rbac_map rbac
  WHERE rbac.empid = ${userId}
    AND rbac.entity = 'form'
    AND (rbac.entity_id = f.id::text OR rbac.entity_id = 'all')
    AND 0 = ANY(rbac.permission)  -- View
)

// Edit permission check (routes.ts:482-491)
1 = ANY(rbac.permission)  -- Edit

// Delete permission check (routes.ts:1106-1119)
3 = ANY(rbac.permission)  -- Delete

// Create permission check (routes.ts:351-364)
4 = ANY(rbac.permission) AND entity_id = 'all'  -- Create (must be on 'all')
```

**Permission Scoping:**
- `entity_id = 'all'`: Permission applies to ALL forms
- `entity_id = '{uuid}'`: Permission applies to specific form only
- Creator automatically receives `[0, 1, 2, 3]` (view, edit, share, delete) on their forms

### S3 Upload Configuration

**Hook**: `apps/web/src/lib/hooks/useS3Upload.ts`

```typescript
export const useS3Upload = () => {
  const uploadFile = async (
    file: File | Blob,
    entityType: string,
    entityId: string,
    fileName: string
  ) => {
    // 1. Request presigned URL
    const response = await fetch('/api/v1/s3/presigned-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ entityType, entityId, fileName, fileSize: file.size })
    });
    const { uploadUrl, objectKey } = await response.json();

    // 2. Upload to S3
    await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type }
    });

    // 3. Return object key (NOT file data)
    return {
      objectKey,  // 's3://bucket/tenant_id=demo/entity=form/entity_id=.../file.pdf'
      format: fileName.split('.').pop(),
      size: file.size
    };
  };

  return { uploadFile };
};
```

**Storage Paths:**
```
s3://pmo-attachments/
  tenant_id=demo/
    entity=form/
      entity_id=f8c12a4e-.../
        file_uploads/
          document.pdf
        signatures/
          signature_2025-10-31_14-30-45.png
```

---

## 6. User Interaction Flow Examples

### Flow 1: Creating a New Form

```
User Action                    Frontend                       API                         Database
────────────────────────────────────────────────────────────────────────────────────────────────────

1. Click "New Form"         → Navigate to /form/new
                            → Render FormBuilderPage
                            → Mount AdvancedFormBuilder

2. Drag field types         → Update local state
   to canvas                → Update schema JSON:
                              { steps: [{ fields: [...] }] }

3. Configure field          → Open properties panel
   properties               → Update field metadata
   (validation, options)

4. Click "Save Form"        → Validate schema
                            → POST /api/v1/form         → Check perm 4 (create)
                              { name, descr,            → Generate slug
                                form_type: 'multi_step', → Generate shared_url
                                form_schema: {...} }    → INSERT d_form_head
                                                        → Register in entity_id_map
                                                        → Grant creator perms [0,1,2,3]

5. Success redirect         ← Return { id, slug, ... }
                            → Navigate to /form/:id
                            → Render EntityDetailPage
                            → Show InteractiveForm
                              in preview mode
```

**Code References:**
- `FormBuilderPage.tsx:25-35` - Save handler
- `apps/api/src/modules/form/routes.ts:326-455` - Create endpoint
- `db/23_d_form_head.ddl` - Table schema

### Flow 2: Editing an Existing Form

```
User Action                    Frontend                       API                         Database
────────────────────────────────────────────────────────────────────────────────────────────────────

1. Click "Edit" button      → Navigate to /form/:id/edit
   on form detail page      → Render FormEditPage

2. Load form data           → GET /api/v1/form/:id        → Check perm 0 (view)
                            ← Return form definition      → SELECT FROM d_form_head
                                                            WHERE id = :id

3. Parse schema             → if (typeof schema === 'string')
                                schema = JSON.parse(schema)
                            → Pass to AdvancedFormBuilder
                              with initialFormData

4. Modify schema            → User drags new field
                            → Update local state
                            → schema.steps[0].fields.push(...)

5. Click "Update Form"      → Validate changes
                            → PUT /api/v1/form/:id        → Check perm 1 (edit)
                              { form_schema: {...} }      → Compare schemas
                                                          → Detect schema change
                                                          → version++
                                                          → UPDATE d_form_head
                                                            SET form_schema = :new,
                                                                version = version + 1

6. Success redirect         ← Return updated form
                            → Navigate to /form/:id
                            → Show success toast
                              "Form updated to v2"
```

**Code References:**
- `FormEditPage.tsx:44-70` - Edit flow
- `apps/api/src/modules/form/routes.ts:457-599` - Update endpoint with versioning logic

### Flow 3: Filling a Form (Authenticated)

```
User Action                    Frontend                       API                         Database
────────────────────────────────────────────────────────────────────────────────────────────────────

1. Open form page           → Navigate to /form/:id
                            → Render EntityDetailPage
                            → GET /api/v1/form/:id        → Check perm 0 (view)
                            ← Return form definition      → SELECT FROM d_form_head

2. Render form              → Parse form_schema
                            → Render InteractiveForm
                              mode="fill"
                            → Show step 1 of N

3. Fill step 1              → User enters data
                            → Update local state
                              { email: 'user@test.com' }

4. Upload file              → Click file input
                            → Select file.pdf
                            → Call uploadFileToS3()      → POST /s3/presigned-url
                                                          ← Return uploadUrl, objectKey
                            → PUT to S3 (presigned)      → S3 stores file
                            → Store objectKey in state
                              { attachment: 's3://...' }

5. Complete all steps       → Click "Next" N times
                            → Validate each step
                            → Final step: "Submit"

6. Submit form              → POST /form/:id/submit      → Check perm 0 (view)
                              { submissionData: {...} }  → INSERT d_form_data
                                                            submission_data = :data (JSONB)
                                                            submitted_by_empid = :userId
                                                            submission_status = 'submitted'

7. Success message          ← Return { id, message }
                            → Show success toast
                            → Reset form or redirect
```

**Code References:**
- `EntityDetailPage.tsx:470-520` - Form rendering
- `InteractiveForm.tsx:150-350` - Multi-step logic
- `apps/api/src/modules/form/routes.ts:877-964` - Submit endpoint

### Flow 4: Public Anonymous Submission

```
User Action                    Frontend                       API                         Database
────────────────────────────────────────────────────────────────────────────────────────────────────

1. User clicks public link  → Navigate to /form/:hash
   https://app.com/form/abc → Render PublicFormPage
                              (No authentication!)

2. Load form                → GET /api/v1/public/form/:id → NO JWT check
                            ← Return form definition      → SELECT FROM d_form_head
                                                            WHERE id = :id
                                                            AND active_flag = true

3. Fill form                → Render InteractiveForm
                            → User fills fields
                            → Upload files to S3
                              (presigned URLs work
                               without auth for public)

4. Submit form              → POST /api/v1/public/        → NO JWT check
                              form/:id/submit             → INSERT d_form_data
                              { submissionData: {...} }     submitted_by_empid =
                                                            '00000000-0000-...'
                                                            (Anonymous sentinel)

5. Thank you page           ← Return success
                            → Show "Thank you" message
                            → Option to submit another
```

**Code References:**
- `PublicFormPage.tsx:45-120` - Public form rendering
- `apps/api/src/modules/form/routes.ts:968-1081` - Public endpoints (NO `preHandler: [fastify.authenticate]`)

### Flow 5: Approving a Form Submission

```
User Action                    Frontend                       API                         Database
────────────────────────────────────────────────────────────────────────────────────────────────────

1. View submissions list    → Navigate to /form/:id/data
                            → GET /api/v1/form/:id/data  → Check perm 0 (view)
                            ← Return submissions array   → SELECT FROM d_form_data
                                                            WHERE form_id = :id

2. Click submission         → Navigate to /form/:formId/
                              data/:submissionId
                            → GET /form/:id/data/:subId  → Check perm 0 (view)
                            ← Return submission          → SELECT FROM d_form_data
                                                            WHERE id = :subId

3. Review data              → Render FormSubmissionEditor
                            → Display all fields
                            → Show approval section

4. Click "Approve"          → Confirm dialog
                            → PUT /form/:id/data/:subId  → Check perm 1 (edit)
                              { approval_status:          → UPDATE d_form_data
                                'approved',                 SET approval_status = 'approved',
                                approval_notes: '...' }         approved_by_empid = :userId,
                                                                approved_at = NOW()

5. Confirmation             ← Return success
                            → Show success toast
                            → Update UI to show
                              "Approved" badge
```

**Code References:**
- `FormDataPreviewPage.tsx:45-150` - Submission viewer
- `apps/api/src/modules/form/routes.ts:798-875` - Update submission endpoint

---

## 7. Critical Considerations When Building

### For Developers Extending the Form System

#### 1. Schema Field Name Convention

**Rule**: Always use `form_schema`, never `schema`.

**Why**: API endpoints expect `form_schema` (matches database column name).

**Code Locations:**
```typescript
// ✅ CORRECT
const payload = { form_schema: formData.form_schema };

// ❌ WRONG - Will fail API validation
const payload = { schema: formData.form_schema };
```

**Files to check when adding new form-related features:**
- `FormBuilderPage.tsx:27`
- `FormEditPage.tsx:44`
- `apps/api/src/modules/form/routes.ts:324-396` (create)
- `apps/api/src/modules/form/routes.ts:457-599` (update)

#### 2. Schema Parsing (String vs Object)

**Problem**: API sometimes returns `form_schema` as STRING, sometimes as OBJECT.

**Solution**: Always parse before use.

```typescript
// EntityDetailPage.tsx:470-475
let schema = data.form_schema;
if (typeof schema === 'string') {
  try {
    schema = JSON.parse(schema);
  } catch (e) {
    console.error('Failed to parse form_schema:', e);
    schema = { steps: [] };  // Fallback
  }
}
```

**Why This Happens:**
- Drizzle ORM automatically parses JSONB columns → returns object
- Raw SQL queries return stringified JSON → requires parsing
- File locations: All 6 locations in `apps/web/src/pages/form/*.tsx` and `EntityDetailPage.tsx`

#### 3. S3 File Storage (Not Base64)

**Rule**: NEVER store file data or base64 in database. Always store S3 object keys.

**Why**:
- 1MB file as base64 = ~1.3MB in database
- 1MB file in S3 = ~100 bytes in database (object key only)
- Database performance degrades with large JSONB columns

**Correct Pattern:**
```typescript
// ✅ CORRECT - Store object key
const { objectKey, format, size } = await uploadFileToS3(file);
submissionData[fieldName] = objectKey;  // 's3://bucket/path/file.pdf'

// ❌ WRONG - Store file data
const base64 = await fileToBase64(file);
submissionData[fieldName] = base64;  // 1.3MB string in database!
```

**File Upload Flow:**
1. User selects file → trigger `useS3Upload()`
2. Request presigned URL from API → `POST /api/v1/s3/presigned-url`
3. Upload file to S3 → `PUT` to presigned URL
4. Store object key in `submission_data` → `{ attachment: 's3://...' }`

**Download Flow:**
1. Read object key from `submission_data`
2. Request presigned download URL → `GET /api/v1/s3/presigned-url?objectKey=...`
3. Browser downloads from S3 → presigned GET URL

#### 4. Versioning Triggers

**Rule**: Only schema changes increment `version`. Metadata changes do NOT.

**Schema Changes (triggers version++):**
- Adding/removing fields
- Changing field types
- Modifying validation rules
- Adding/removing steps

**Metadata Changes (no version change):**
- Updating `name` or `descr`
- Changing `active_flag`
- Modifying `internal_url` or `shared_url`

**Implementation:**
```typescript
// apps/api/src/modules/form/routes.ts:510-595
const schemaChanged = data.form_schema !== undefined &&
  JSON.stringify(data.form_schema) !== JSON.stringify(current.form_schema);

if (schemaChanged) {
  // Version bump
  const newVersion = (current.version || 1) + 1;
  await db.execute(sql`UPDATE ... SET version = ${newVersion}`);
} else {
  // Metadata-only update (no version change)
  await db.execute(sql`UPDATE ... SET name = ${data.name}`);
}
```

#### 5. Anonymous Submission Handling

**Rule**: Public submissions use sentinel UUID `00000000-0000-0000-0000-000000000000`.

**Why**:
- `submitted_by_empid` is NOT NULL (referential integrity)
- Sentinel UUID allows differentiation from real users
- Queries can filter: `WHERE submitted_by_empid != '00000000-...'` for authenticated submissions

**Code Locations:**
```typescript
// apps/api/src/modules/form/routes.ts:1065
submitted_by_empid = '00000000-0000-0000-0000-000000000000'::uuid
```

**Queries:**
```sql
-- Authenticated submissions only
SELECT * FROM d_form_data
WHERE submitted_by_empid != '00000000-0000-0000-0000-000000000000';

-- Anonymous submissions only
SELECT * FROM d_form_data
WHERE submitted_by_empid = '00000000-0000-0000-0000-000000000000';
```

#### 6. Permission Model for Forms

**Permission Array**: `[view, edit, share, delete, create]` = `[0, 1, 2, 3, 4]`

**Scoping Rules:**
- `entity_id = 'all'`: Permission applies to ALL forms (type-wide)
- `entity_id = '{uuid}'`: Permission applies to specific form only

**Auto-Grant on Create:**
```typescript
// Creator automatically gets [0, 1, 2, 3] (view, edit, share, delete)
// NOT 4 (create), as that's type-wide
await db.execute(sql`
  INSERT INTO entity_id_rbac_map (empid, entity, entity_id, permission)
  VALUES (${userId}, 'form', ${formId}::text, ARRAY[0, 1, 2, 3])
`);
```

**Permission Checks:**
```typescript
// View form
0 = ANY(rbac.permission)

// Edit form
1 = ANY(rbac.permission)

// Share form (generate public links)
2 = ANY(rbac.permission)

// Delete form
3 = ANY(rbac.permission)

// Create new forms (must be on entity_id='all')
4 = ANY(rbac.permission) AND entity_id = 'all'
```

#### 7. Adding New Field Types

**Steps to add a new field type:**

1. **Update Type Union** (`FormBuilder.tsx:16`):
```typescript
export type FieldType =
  | 'text' | 'email' | 'signature' | 'file'
  | 'new_field_type';  // Add here
```

2. **Add to Field Interface** (`FormBuilder.tsx:18-85`):
```typescript
export interface BuilderField {
  // ... existing fields
  newFieldTypeOption?: string;  // Add field-specific options
}
```

3. **Add to Palette** (`AdvancedFormBuilder.tsx:19-53`):
```tsx
const fieldTypes = [
  { type: 'new_field_type', icon: NewIcon, label: 'New Field' },
];
```

4. **Add Renderer** (`InteractiveForm.tsx:150-350`):
```tsx
case 'new_field_type':
  return (
    <NewFieldComponent
      field={field}
      value={formData[field.name]}
      onChange={(value) => handleFieldChange(field.name, value)}
    />
  );
```

5. **Update Properties Panel** (`AdvancedFormBuilder.tsx:500-800`):
```tsx
{selectedField?.type === 'new_field_type' && (
  <div>
    <label>New Field Option</label>
    <input ... />
  </div>
)}
```

**No database changes required!** JSONB schema handles all field metadata dynamically.

#### 8. Testing Checklist

**Before deploying form changes:**

- [ ] Test create flow: `/form/new` → save → redirects to detail
- [ ] Test edit flow: `/form/:id/edit` → modify schema → version increments
- [ ] Test fill flow: `/form/:id` → fill all steps → submit → success
- [ ] Test public flow: Share link → public page → submit → anonymous submission
- [ ] Test file upload: Select file → uploads to S3 → stores object key
- [ ] Test signature: Draw → save → uploads PNG to S3 → stores object key
- [ ] Test RBAC: User without permission → 403 error
- [ ] Test versioning: Modify schema → version++, modify name → version unchanged
- [ ] Test soft delete: Delete form → active_flag=false, submissions preserved
- [ ] Test submissions list: `/form/:id/data` → shows all submissions
- [ ] Test submission edit: Modify data → PUT → updates in database

**API endpoint tests:**
```bash
# List forms
./tools/test-api.sh GET /api/v1/form

# Get single form
./tools/test-api.sh GET /api/v1/form/{id}

# Create form
./tools/test-api.sh POST /api/v1/form '{"name":"Test","form_type":"multi_step","form_schema":{"steps":[]}}'

# Update form
./tools/test-api.sh PUT /api/v1/form/{id} '{"form_schema":{"steps":[{"fields":[]}]}}'

# Submit form
./tools/test-api.sh POST /api/v1/form/{id}/submit '{"submissionData":{"field1":"value1"}}'
```

---

## Summary

The PMO form system implements a **schema-driven, multi-step form builder** with the following key architectural principles:

1. **Builder-Renderer Separation**: `AdvancedFormBuilder` (editor) outputs JSONB → `InteractiveForm` (renderer) consumes JSONB
2. **JSONB Flexibility**: All field definitions stored in database as JSONB (zero schema migrations for new field types)
3. **In-Place Versioning**: Same `id`, increment `version` on schema changes (stable public URLs)
4. **S3 File Storage**: Files stored in S3, database stores object keys (~100 bytes) not file data (MB+)
5. **Public Access**: Anonymous submissions via `shared_url` without authentication
6. **RBAC Integration**: Full permission system with auto-grant to creators
7. **Universal Entity System**: Forms participate in linkage system (attach to projects, tasks, clients)

**Key Files:**
- **Frontend**: `FormBuilder.tsx` (2500 LOC), `InteractiveForm.tsx` (800 LOC), `FormEditPage.tsx` (170 LOC)
- **Backend**: `apps/api/src/modules/form/routes.ts` (1140 LOC)
- **Database**: `db/23_d_form_head.ddl`, `db/24_d_form_data.ddl`
- **Hooks**: `useS3Upload.ts` (S3 file upload logic)

**For New Developers:**
1. Read this document start to finish
2. Study `FormEditPage.tsx` → understand edit flow
3. Study `InteractiveForm.tsx` → understand rendering
4. Test locally: Create form → edit → fill → submit
5. Review API endpoint tests in `tools/test-api.sh`

**For Architects:**
- **DRY**: Single JSONB schema drives all behavior (zero duplication)
- **Scalability**: S3 file storage prevents database bloat
- **Flexibility**: New field types require zero database changes
- **Security**: RBAC + JWT + presigned S3 URLs
- **Public Access**: Anonymous submissions with sentinel UUID pattern

---

**Document Version:** v2.8 (2025-10-31)
**Maintained By:** Platform Architecture Team
**Last Reviewed:** 2025-10-31
