# Form System - Complete Architecture & Implementation Guide

> **Production-ready form builder system** - Multi-step schema-driven forms with JSONB storage, S3 file handling, public submissions, and in-place versioning. Comprehensive reference for staff-level software architects and engineers.
>
> **Last Updated:** 2025-10-31 | **Status:** Production v2.8 | **Target Audience:** Staff Engineers & Architects

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Semantics & Business Context](#2-semantics--business-context)
3. [Architecture, Block Diagrams & DRY Design Patterns](#3-architecture-block-diagrams--dry-design-patterns)
4. [Database, API & UI/UX Mapping](#4-database-api--uiux-mapping)
5. [Entity Relationships](#5-entity-relationships)
6. [Central Configuration & Middleware](#6-central-configuration--middleware)
7. [User Interaction Flow Examples](#7-user-interaction-flow-examples)
8. [Critical Considerations When Building](#8-critical-considerations-when-building)

---

## 1. Quick Start

### Common Operations

#### Creating a New Form
```bash
# Navigate to form builder
URL: /form/new

# Workflow:
# 1. Drag field types from palette
# 2. Configure field properties
# 3. Click "Save Form"
# 4. Form ID remains stable for public URLs
```

#### Editing an Existing Form
```bash
# Navigate to form detail → click "Edit"
URL: /form/:id → /form/:id/edit

# Changes to form_schema trigger version++
# Metadata changes (name, descr) do NOT increment version
```

#### Testing API Endpoints
```bash
# List all forms
./tools/test-api.sh GET /api/v1/form

# Get single form
./tools/test-api.sh GET /api/v1/form/{id}

# Create form
./tools/test-api.sh POST /api/v1/form '{
  "name": "Test Form",
  "form_type": "multi_step",
  "form_schema": {
    "steps": [{
      "id": "step-1",
      "name": "step_1",
      "title": "Contact Info",
      "fields": [
        {"name": "email", "label": "Email", "type": "email", "required": true}
      ]
    }]
  }
}'

# Update form (triggers versioning if schema changed)
./tools/test-api.sh PUT /api/v1/form/{id} '{
  "form_schema": {"steps": [...]}
}'

# Submit form
./tools/test-api.sh POST /api/v1/form/{id}/submit '{
  "submissionData": {"email": "test@example.com"},
  "submissionStatus": "submitted"
}'

# List submissions
./tools/test-api.sh GET /api/v1/form/{id}/data

# Database queries
./tools/run_query.sh "SELECT id, name, form_schema, version FROM app.d_form_head WHERE active_flag=true;"
./tools/run_query.sh "SELECT * FROM app.d_form_data WHERE form_id='{uuid}';"
```

### Key File Locations

**Frontend:**
```
apps/web/src/
├── pages/form/
│   ├── FormBuilderPage.tsx       (3KB)  - Create new forms
│   ├── FormEditPage.tsx          (7KB)  - Edit existing forms
│   ├── FormDataPreviewPage.tsx   (6KB)  - View/edit submissions
│   └── PublicFormPage.tsx        (8KB)  - Public anonymous access
│
├── components/entity/form/
│   ├── FormBuilder.tsx           (85KB) - AdvancedFormBuilder (schema editor)
│   ├── InteractiveForm.tsx       (30KB) - Multi-step renderer
│   ├── FormSubmissionEditor.tsx  (15KB) - Edit submission data
│   └── FormPreview.tsx           (10KB) - Preview mode renderer
│
└── lib/hooks/
    └── useS3Upload.ts             (4KB)  - S3 file upload hook
```

**Backend:**
```
apps/api/src/modules/form/
└── routes.ts                      (46KB) - 12 REST endpoints + RBAC
```

**Database:**
```
db/
├── 23_d_form_head.ddl             (5KB)  - Form definitions
└── 24_d_form_data.ddl             (4KB)  - Form submissions
```

### Key Routes

```typescript
// Frontend routing (apps/web/src/App.tsx:159-167)
/form                                      → EntityMainPage (list)
/form/new                                  → FormBuilderPage (create)
/form/:id                                  → EntityDetailPage (view/fill)
/form/:id/edit                             → FormEditPage (edit schema)
/form/:formId/data/:submissionId          → FormDataPreviewPage (view submission)
/public/form/:id                           → PublicFormPage (anonymous access)
```

### Adding New Field Type

**Zero database changes required** - all field metadata lives in JSONB schema.

```typescript
// 1. Update Type Union (FormBuilder.tsx:16)
export type FieldType = 'text' | 'email' | 'signature' | 'new_type';

// 2. Add to Palette (AdvancedFormBuilder.tsx:19-53)
{ type: 'new_type', icon: Icon, label: 'New Field' }

// 3. Add Renderer (InteractiveForm.tsx:150-350)
case 'new_type':
  return <NewFieldComponent field={field} value={formData[field.name]} />;

// 4. Update Properties Panel (AdvancedFormBuilder.tsx:500-800)
{selectedField?.type === 'new_type' && (
  <div><label>New Field Option</label><input /></div>
)}
```

---

## 2. Semantics & Business Context

### Core Capabilities

The form system provides a **schema-driven, multi-step form builder** with production-grade features:

- **JSONB Schema Storage**: All field definitions stored in `form_schema` JSONB column (database-driven configuration)
- **In-Place Versioning**: `version` increments on schema changes while `id` remains stable for public URLs
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

## 3. Architecture, Block Diagrams & DRY Design Patterns

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

**Architecture Benefits (DRY)**:
- **Generic function**: `uploadToS3(blob, fileName, contentType, uploadType)` - handles all uploads
- **Thin wrappers**: `uploadFileToS3()` and `uploadSignatureToS3()` - 8-12 lines each
- **44% less code** through proper abstraction
- Single source of truth for error handling, progress tracking, S3 paths

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

## 4. Database, API & UI/UX Mapping

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
  try {
    schema = JSON.parse(schema);
  } catch (e) {
    console.error('Failed to parse form_schema:', e);
    schema = { steps: [] };  // Fallback
  }
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

## 5. Entity Relationships

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

## 6. Central Configuration & Middleware

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

## 7. User Interaction Flow Examples

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

## 8. Critical Considerations When Building

### Breaking Changes to Avoid

#### 1. Database Schema Alignment ⭐⭐⭐ CRITICAL

**THE BUG WE FIXED (2025-10-31):**

The form API routes had several SQL errors that caused 500 Internal Server Errors:

```typescript
// ❌ WRONG - SQL syntax error: f.f.version (double prefix)
ORDER BY f.f.version DESC

// ✅ CORRECT
ORDER BY f.slug, f.version DESC

// ❌ WRONG - Column doesn't exist in DDL
INSERT INTO d_form_head (..., tags, ...) VALUES (..., ${tags}, ...)

// ✅ CORRECT - Remove tags column references
INSERT INTO d_form_head (...) VALUES (...)  // No tags

// ❌ WRONG - Column name mismatch
INSERT INTO d_entity_instance_id (entity_type, entity_id, entity_name, entity_entity_code)
VALUES ('form', ${id}, ${name}, ${slug}, ${code})  // 5 values, wrong column name

// ✅ CORRECT
INSERT INTO d_entity_instance_id (entity_type, entity_id, entity_name, entity_code)
VALUES ('form', ${id}, ${name}, ${code})  // 4 values, correct columns
```

**Why Critical:**
- Always verify column names match the DDL file exactly
- Check INSERT statements have matching number of columns and values
- Test SQL queries against actual database schema
- Run `./tools/test-api.sh` after schema changes

**Files Affected:**
- `apps/api/src/modules/form/routes.ts` (fixed 2025-10-31)
- `db/23_d_form_head.ddl` (authoritative schema)

#### 2. Property Name Mismatch ⭐⭐⭐ CRITICAL

**THE BUG WE FIXED (2025-10-23):**

```typescript
// ❌ WRONG - Sends undefined, creates empty forms
const payload = {
  form_schema: formData.schema  // undefined!
};

// ✅ CORRECT - Must match AdvancedFormBuilder output
const payload = {
  form_schema: formData.form_schema  // Contains steps array
};
```

**Why Critical:**
- `AdvancedFormBuilder` outputs `formData.form_schema`
- API expects `form_schema` (snake_case)
- Mismatch → empty schemas → forms can't be previewed

**Files to Watch:**
- `apps/web/src/pages/form/FormBuilderPage.tsx:27`
- `apps/web/src/pages/form/FormEditPage.tsx:44`

#### 3. Backend Payload Validation

Backend ONLY accepts these fields:

```typescript
// apps/api/src/modules/form/routes.ts:33-37
const CreateFormSchema = Type.Object({
  name: Type.Optional(Type.String()),
  descr: Type.Optional(Type.String()),
  form_type: Type.Optional(Type.String()),
  form_schema: Type.Optional(Type.Any()),
  version: Type.Optional(Type.Number()),
  active_flag: Type.Optional(Type.Boolean())
});
```

**DO NOT send:**
```typescript
// ❌ WRONG - Backend ignores these fields
{
  taskSpecific: true,
  isMultiStep: true,
  totalSteps: 3,
  stepConfiguration: [...],
  fieldSequence: [...]
}
```

#### 4. Schema Parsing Required

API may return `form_schema` as STRING or OBJECT:

```typescript
// ✅ SAFE PATTERN (required in 6 locations)
if (data.form_schema && typeof data.form_schema === 'string') {
  data.form_schema = JSON.parse(data.form_schema);
}
```

**Locations requiring parsing:**
1. `FormEditPage.tsx:20` - Before builder
2. `FormViewPage.tsx:40` - Before rendering
3. `PublicFormPage.tsx:33` - Public access
4. `EntityDetailPage.tsx:123` - Auto-parse on load
5. `EntityDetailPage.tsx:359` - Inline parsing
6. `TaskDataContainer.tsx:174` - Task forms

**Failure to parse:**
```typescript
// If form_schema is string and not parsed:
schema.steps  // → undefined (string has no 'steps' property)
steps.map(...)  // → TypeError: steps.map is not a function
```

#### 5. S3 File Storage (Not Base64)

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

#### 6. Versioning Triggers

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

#### 7. Anonymous Submission Handling

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

#### 8. Field Name Restrictions

Field names must be **valid JavaScript identifiers**:

```typescript
// ✅ GOOD
{ name: "full_name", label: "Full Name", type: "text" }
{ name: "email_address", label: "Email", type: "email" }

// ❌ BAD - Breaks submission_data access
{ name: "Full Name", label: "Full Name", type: "text" }  // Spaces!
{ name: "email@address", label: "Email", type: "email" }  // Special chars!
```

**Why:** `submission_data` is a flat object:
```json
{
  "full_name": "John",
  "email_address": "john@example.com"
}
```

Accessing `submission_data["Full Name"]` breaks JavaScript syntax.

#### 9. Permission Model for Forms

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
// View form: 0 = ANY(rbac.permission)
// Edit form: 1 = ANY(rbac.permission)
// Share form (generate public links): 2 = ANY(rbac.permission)
// Delete form: 3 = ANY(rbac.permission)
// Create new forms (must be on entity_id='all'): 4 = ANY(rbac.permission) AND entity_id = 'all'
```

#### 10. Soft Delete Only

```sql
-- ❌ DANGEROUS: Hard delete breaks foreign key
DELETE FROM d_form_head WHERE id = $id;
-- CASCADE deletes all submissions!

-- ✅ SAFE: Soft delete preserves data
UPDATE d_form_head
SET active_flag = false, to_ts = NOW()
WHERE id = $id;
```

**Why:** `d_form_data` references `form_id` with foreign key. Hard delete CASCADE removes all submissions.

### Testing Checklist

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
- [ ] Test schema parsing in all 6 required locations
- [ ] Test property names match (`form_schema` not `schema`)
- [ ] Test field name validation (no spaces or special characters)

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

# Test S3 backend
./tools/test-api.sh GET /api/v1/s3-backend/health
# Expected: { "status": "healthy", "bucket": "cohuron-attachments-...", "connected": true }

# Verify database storage
./tools/run_query.sh "SELECT submission_data->>'file_field_name' FROM app.d_form_data WHERE form_id='...';"
# Expected: tenant_id=demo/entity=form/entity_id={uuid}/filename.pdf (NOT base64)
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
8. **DRY Architecture**: Single `useS3Upload()` hook for all file types (44% less code)

**Key Files:**
- **Frontend**: `FormBuilder.tsx` (2500 LOC), `InteractiveForm.tsx` (800 LOC), `FormEditPage.tsx` (170 LOC)
- **Backend**: `apps/api/src/modules/form/routes.ts` (1140 LOC)
- **Database**: `db/23_d_form_head.ddl`, `db/24_d_form_data.ddl`
- **Hooks**: `useS3Upload.ts` (S3 file upload logic)

**For New Developers:**
1. Read Section 1 (Quick Start) for common operations
2. Study `FormEditPage.tsx` → understand edit flow
3. Study `InteractiveForm.tsx` → understand rendering
4. Test locally: Create form → edit → fill → submit
5. Review Section 8 (Critical Considerations) before making changes

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
**Recent Updates:**
- Fixed SQL syntax errors in form queries (2025-10-31)
- Removed non-existent `tags` column references (2025-10-31)
- Fixed `d_entity_instance_id` INSERT statement (2025-10-31)
- Property name mismatch bug (fixed 2025-10-23)
- S3 integration for files and signatures (implemented 2025-10-23)
- DRY refactoring of upload functions (implemented 2025-10-23)
