# Artifact Entity - Complete Technical Documentation

> **Document and File Management with Versioning** - S3-backed artifact storage with SCD Type 2 versioning, metadata management, and entity relationships

**Last Updated:** 2025-11-04
**Status:** ✅ Production Ready (Create/Upload/Preview Flow Complete)

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

**Artifacts** serve as the platform's document and file management system, providing:
- **Versioned storage** for documents, blueprints, contracts, templates, images, and videos
- **S3-backed storage** with metadata in PostgreSQL
- **Entity relationships** linking artifacts to projects, tasks, clients, employees
- **Temporal tracking** with effective dates for audit trails
- **Multi-format support** for any file type
- **Access control** with visibility and security classification

### Business Workflows

#### Artifact Lifecycle
```
Create → Upload → Active → Update Metadata → Version → Archive
   ↓       ↓        ↓           ↓              ↓         ↓
Design  Store   Current     Metadata      New File   Inactive
```

#### Versioning Workflow
```
Version 1 (Original) → Version 2 (Edited) → Version 3 (Latest)
     ↓                      ↓                      ↓
Active=false          Active=false           Active=true
to_ts=timestamp       to_ts=timestamp        to_ts=null
```

### Key Business Rules

**Artifact Storage:**
- **Metadata in PostgreSQL**: Name, description, relationships, version tracking
- **Files in S3**: Actual file content with presigned URLs for secure access
- **Version control**: Each re-upload creates new database row with incremented version
- **Temporal tracking**: from_ts and to_ts track when each version was active
- **Soft deletes**: active_flag marks current version, preserves history

**Versioning Rules:**
- **Metadata updates**: Don't create new version (in-place update)
- **File re-upload**: Always creates new version (SCD Type 2)
- **Version chain**: All versions linked via parent_artifact_id (future enhancement)
- **Only one active**: active_flag=true for current version only

### Real-World Use Cases

| Department | Artifact Type | Purpose | Versioning Need |
|------------|---------------|---------|-----------------|
| Architecture | Blueprints | Design documents | Track design iterations |
| Legal | Contracts | Client agreements | Version control for amendments |
| Operations | Templates | Standard forms | Update templates over time |
| Marketing | Brochures | Marketing materials | Seasonal updates |
| Project Management | Reports | Status reports | Weekly/monthly versions |

---

## 2. Architecture & Design Patterns

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  ARTIFACT SYSTEM LAYERS                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📱 PAGES (React)                                            │
│  ├─ /artifact                → EntityMainPage (list)        │
│  ├─ /artifact/new            → EntityCreatePage (create)    │
│  ├─ /artifact/:id            → EntityDetailPage (view)      │
│  └─ /artifact/:id (edit)     → EntityDetailPage (edit mode) │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  🎨 COMPONENTS                                               │
│  ├─ EntityCreatePage         → Universal create page        │
│  │   ├─ DragDropFileUpload   → File upload component        │
│  │   ├─ EntityFormContainer  → Dynamic form renderer        │
│  │   └─ useS3Upload()        → Reusable S3 hook (DRY)      │
│  ├─ EntityDetailPage         → Universal detail/edit page   │
│  └─ EntityFormContainer      → Reusable form fields         │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ⚙️  API (Fastify)                                           │
│  ├─ POST   /api/v1/artifact              → Create v1        │
│  ├─ GET    /api/v1/artifact/:id          → Get single       │
│  ├─ PUT    /api/v1/artifact/:id          → Update metadata  │
│  ├─ DELETE /api/v1/artifact/:id          → Soft delete      │
│  ├─ POST   /api/v1/artifact/:id/new-version → Create vN     │
│  ├─ GET    /api/v1/artifact/:id/versions → Get history      │
│  ├─ GET    /api/v1/artifact/:id/download → Download URL     │
│  └─ GET    /api/v1/artifact/entity/:type/:id → List by ent  │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  🔌 S3 BACKEND API                                           │
│  └─ POST /api/v1/s3-backend/presigned-upload → Upload URL   │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  💾 DATABASE (PostgreSQL)                                    │
│  ├─ d_artifact            → Metadata + version tracking     │
│  ├─ entity_id_map         → Entity relationships            │
│  └─ entity_id_rbac_map    → Access permissions              │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ☁️  STORAGE (AWS S3)                                        │
│  └─ Bucket: cohuron-attachments-prod-957207443425           │
│      └─ tenant_id=demo/entity=artifact/entity_id={uuid}/    │
│          ├─ {hash}_v1.pdf                                   │
│          ├─ {hash}_v2.pdf                                   │
│          └─ {hash}_v3.pdf                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Design Patterns

#### 1. **Universal Entity Pattern (DRY Architecture)**

Artifacts use the platform's universal entity system:

```
entityConfig.ts → EntityCreatePage → EntityFormContainer → API
      ↓                  ↓                  ↓               ↓
   Schema         Universal Page      Dynamic Form      Routes
```

**Benefits:**
- Single page component handles ALL entity types
- Configuration-driven forms (no custom JSX per entity)
- Consistent UX across all entities
- Auto-populated fields reduce user errors

**Configuration Example:**
```typescript
artifact: {
  name: 'artifact',
  displayName: 'Artifact',
  apiEndpoint: '/api/v1/artifact',
  fields: [
    { key: 'name', label: 'Artifact Name', type: 'text', required: true },
    { key: 'code', label: 'Code', type: 'text', required: true },
    { key: 'descr', label: 'Description', type: 'richtext' },
    { key: 'artifact_type', label: 'Artifact Type', type: 'select', options: [...] },
    { key: 'visibility', label: 'Visibility', type: 'select', defaultValue: 'internal' },
    { key: 'security_classification', label: 'Security', type: 'select', defaultValue: 'general' }
  ]
}
```

#### 2. **Metadata-File Separation**

```
PostgreSQL (Fast queries)        S3 (Scalable storage)
├─ name: "Blueprint.pdf"        ├─ actual file bytes
├─ size: 2.4 MB                 ├─ presigned URL access
├─ version: 1                   └─ lifecycle policies
├─ from_ts: 2025-01-05
└─ attachment_object_key: "..."
```

**Why?**
- Database optimized for queries, not file storage
- S3 optimized for file storage and delivery
- Cost-effective (S3 cheaper than database storage)
- Scalable (billions of files supported)

#### 3. **Auto-Population Pattern**

When a file is uploaded, metadata fields are automatically populated:

```typescript
// After S3 upload completes:
setFormData(prev => ({
  ...prev,
  name: selectedFile.name,  // "project-report.pdf"
  attachment_format: 'pdf',
  attachment_size_bytes: 2458000
}));
```

**Benefits:**
- Reduces user input errors
- Ensures consistency
- Improves UX (less typing)
- Enforces data integrity

---

## 3. Database, API & UI/UX Mapping

### Database Layer (d_artifact Table)

**Location:** `db/21_d_artifact.ddl`

```sql
CREATE TABLE app.d_artifact (
    -- Primary key
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identifiers
    code varchar(50) UNIQUE NOT NULL,

    -- Metadata
    name varchar(200) NOT NULL,
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,

    -- Classification
    artifact_type text,                    -- document, template, image, video
    attachment_format text,                -- pdf, docx, xlsx, png, jpg, mp4
    attachment_size_bytes bigint,

    -- Entity Relationships
    entity_type text,  -- project, task, office, business
    entity_id uuid,

    -- S3 Storage
    attachment_object_bucket text,
    attachment_object_key text,  -- Unique S3 path
    attachment text,              -- S3 URI (legacy field, optional)

    -- Access Control
    visibility text DEFAULT 'internal',              -- public, internal, restricted, private
    security_classification text DEFAULT 'general',  -- general, confidential, restricted

    -- Version Control (SCD Type 2 - Future Enhancement)
    version integer DEFAULT 1,
    latest_version_flag boolean DEFAULT true,

    -- Temporal Tracking
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);
```

**Key Fields Explained:**

| Field | Purpose | Default | Required |
|-------|---------|---------|----------|
| `code` | Unique identifier | `ART-{timestamp}` | ✅ Yes |
| `name` | Display name | Auto from filename | ✅ Yes |
| `attachment_format` | File extension | Auto-detected | ❌ No |
| `attachment_size_bytes` | File size | Auto-detected | ❌ No |
| `attachment_object_bucket` | S3 bucket | `cohuron-attachments-prod-*` | ❌ No |
| `attachment_object_key` | S3 path | Generated by S3 service | ❌ No |
| `artifact_type` | Category | `document` | ❌ No |
| `visibility` | Access level | `internal` | ❌ No |
| `security_classification` | Security tier | `general` | ❌ No |

### API Layer (Fastify Routes)

**Location:** `apps/api/src/modules/artifact/routes.ts`

#### 1. Create Artifact (POST /api/v1/artifact)

**Request Body:**
```json
{
  "name": "project-report.pdf",
  "code": "ART-1730234567890",
  "descr": "Q1 2025 Project Report",
  "artifact_type": "document",
  "attachment_format": "pdf",
  "attachment_size_bytes": 2458000,
  "attachment_object_bucket": "cohuron-attachments-prod-957207443425",
  "attachment_object_key": "tenant_id=demo/entity=artifact/entity_id=temp-123/abc.pdf",
  "visibility": "internal",
  "security_classification": "general"
}
```

**Response:**
```json
{
  "id": "a1111111-1111-1111-1111-111111111111",
  "code": "ART-1730234567890",
  "name": "project-report.pdf",
  "attachment_format": "pdf",
  "attachment_size_bytes": 2458000,
  "version": 1,
  "active_flag": true,
  "created_ts": "2025-01-05T10:00:00Z"
}
```

**Implementation:**
```typescript
const code = data.code || `ART-${Date.now()}`;

const result = await db.execute(sql`
  INSERT INTO app.d_artifact (
    code, name, descr, metadata, artifact_type,
    attachment_format, attachment_size_bytes,
    attachment_object_bucket, attachment_object_key,
    entity_type, entity_id,
    visibility, security_classification,
    active_flag
  ) VALUES (
    ${code},
    ${data.name},
    ${data.descr || null},
    ${JSON.stringify(data.metadata || {})}::jsonb,
    ${data.artifact_type},
    ${data.attachment_format || null},
    ${data.attachment_size_bytes || null},
    ${data.attachment_object_bucket || null},
    ${data.attachment_object_key || null},
    ${data.entity_type || data.primary_entity_type || null},
    ${data.entity_id || data.primary_entity_id || null},
    ${data.visibility || 'internal'},
    ${data.security_classification || 'general'},
    ${data.active_flag !== false && data.active !== false}
  ) RETURNING *
`);
```

**Critical Fix Applied (2025-11-04):**
- Previously, the VALUES clause was completely misaligned with column names
- Old code was inserting slug into code, code into name, name into descr, etc.
- Fixed to correctly map each value to its intended column
- Removed `parent_artifact_id` and `is_latest_version` from basic CREATE (versioning feature)

#### 2. Update Metadata Only (PUT /api/v1/artifact/:id)

**Request:**
```json
{
  "descr": "Updated description",
  "visibility": "restricted"
}
```

**Behavior:** Same ID, same version, in-place update, NO new S3 object

#### 3. Download Artifact (GET /api/v1/artifact/:id/download)

**Response:**
```json
{
  "url": "https://cohuron-attachments-prod-957207443425.s3.amazonaws.com/...",
  "objectKey": "tenant_id=demo/.../abc.pdf",
  "fileName": "project-report.pdf",
  "fileSize": 2458000,
  "expiresIn": 3600
}
```

### UI/UX Layer (React Components)

#### Route Structure

```typescript
/artifact           → EntityMainPage (list all artifacts)
/artifact/new       → EntityCreatePage (create new artifact)
/artifact/:id       → EntityDetailPage (view/edit artifact + file preview)
```

**Key Point:** All routes use universal components, NO custom artifact pages.

#### EntityCreatePage - Artifact Creation Flow

**Location:** `apps/web/src/pages/shared/EntityCreatePage.tsx`

**Component Hierarchy:**
```
EntityCreatePage
├─ DragDropFileUpload (file upload section)
│   ├─ Drop zone
│   ├─ File preview
│   ├─ Upload button
│   └─ Progress indicator
└─ EntityFormContainer (form fields)
    ├─ Name (text input, auto-populated from filename, editable)
    ├─ Code (text input, auto-generated, editable)
    ├─ Description (rich text editor)
    ├─ Artifact Type (dropdown)
    ├─ Visibility (dropdown, required)
    └─ Security Classification (dropdown, required)
```

**Auto-Populated Fields (set after S3 upload):**
- `attachment_format` - Set from file extension after upload
- `attachment_size_bytes` - Set from file.size after upload
- `attachment_object_key` - Set from S3 service response
- `attachment_object_bucket` - Set to production bucket
- `attachment` (S3 URI) - Legacy field, optional

#### EntityDetailPage - Artifact View/Edit Flow

**Location:** `apps/web/src/pages/shared/EntityDetailPage.tsx`

**File Preview Component:**
- **Location:** `apps/web/src/components/shared/file/FilePreview.tsx`
- **Displays:** PDF previews (iframe), Images (img), Videos (video)
- **Downloads:** Generates presigned URLs via `/api/v1/artifact/:id/download`
- **Field mapping:**
  - `attachment_object_key` → Used to identify file in S3
  - `attachment_format` → Used to determine preview type
  - `attachment_size_bytes` → Displayed in file metadata

**Upload Flow:**
```typescript
// 1. User selects file
const handleFileSelect = (file: File) => {
  setSelectedFile(file);
};

// 2. User clicks "Upload to S3"
const handleFileUpload = async () => {
  const objectKey = await uploadToS3({
    entityType: 'artifact',
    entityId: `temp-${Date.now()}`,
    file: selectedFile,
    fileName: selectedFile.name,
    contentType: selectedFile.type
  });

  // 3. Auto-populate form fields
  setFormData(prev => ({
    ...prev,
    name: selectedFile.name,  // "project-report.pdf"
    attachment_format: 'pdf',
    attachment_size_bytes: 2458000
  }));
};

// 4. User clicks "Create Artifact"
const handleSubmit = async () => {
  const dataToCreate = {
    ...formData,
    attachment_object_key: uploadedObjectKey,
    attachment_object_bucket: 'cohuron-attachments-prod-957207443425'
  };

  const created = await artifactApi.create(dataToCreate);
  navigate(`/artifact/${created.id}`);
};
```

#### Entity Configuration

**Location:** `apps/web/src/lib/entityConfig.ts`

```typescript
artifact: {
  name: 'artifact',
  displayName: 'Artifact',
  pluralName: 'Artifacts',
  apiEndpoint: '/api/v1/artifact',

  // Table columns (list view)
  columns: [
    'name', 'artifact_type', 'visibility', 'security_classification',
    'attachment', 'attachment_format', 'attachment_size_bytes',
    'entity_type', 'created_ts'
  ],

  // Form fields (create/edit view)
  fields: [
    { key: 'name', label: 'Artifact Name', type: 'text', required: true,
      placeholder: 'Auto-populated from uploaded filename' },
    { key: 'code', label: 'Code', type: 'text', required: true,
      placeholder: 'e.g., ART-2025-001' },
    { key: 'descr', label: 'Description', type: 'richtext' },
    { key: 'artifact_type', label: 'Artifact Type', type: 'select',
      defaultValue: 'document',
      options: [
        { value: 'document', label: 'Document' },
        { value: 'template', label: 'Template' },
        { value: 'image', label: 'Image' },
        { value: 'video', label: 'Video' },
        { value: 'blueprint', label: 'Blueprint' },
        { value: 'contract', label: 'Contract' },
        { value: 'report', label: 'Report' }
      ]
    },
    { key: 'visibility', label: 'Visibility', type: 'select',
      defaultValue: 'internal', required: true,
      options: [
        { value: 'public', label: 'Public' },
        { value: 'internal', label: 'Internal' },
        { value: 'restricted', label: 'Restricted' },
        { value: 'private', label: 'Private - Owner and assigned users only' }
      ]
    },
    { key: 'security_classification', label: 'Security Classification',
      type: 'select', defaultValue: 'general', required: true,
      options: [
        { value: 'general', label: 'General' },
        { value: 'confidential', label: 'Confidential' },
        { value: 'restricted', label: 'Restricted' }
      ]
    }
  ]
}
```

**Recent Changes (2025-11-04):**
- ✅ **Field Visibility:** Name and code fields now visible in create mode (were hidden)
- ✅ **Field Consistency:** Fixed all field references to use correct database names:
  - `object_key` → `attachment_object_key` (FilePreview, EntityDetailPage, entityConfig)
  - `file_format` → `attachment_format` (FilePreview, EntityDetailPage)
  - `file_size_bytes` → `attachment_size_bytes` (FilePreview, EntityDetailPage)
- ✅ **File Preview:** Fixed FilePreview component to correctly display uploaded files
- ✅ **Download:** Fixed download button to check correct field (`attachment_object_key`)
- ✅ **API Schema:** Fixed typo in CreateArtifactSchema (`attachment_attachment_object_key`)
- ✅ **Form Fields:** EntityFormContainer now shows name/code in create mode for visibility

---

## 4. DRY Principles & Entity Relationships

### Unified S3 Upload System

All uploads (artifacts, forms, signatures, costs, revenue) use the **same infrastructure**:

```
useS3Upload (hook) → S3 Backend API → S3AttachmentService → AWS S3
```

**Why DRY?**
- Fix bugs once, benefits all upload types
- Consistent presigned URL flow
- Single security/authentication layer
- Shared error handling and retry logic

### Frontend Hook (useS3Upload)

**Location:** `apps/web/src/lib/hooks/useS3Upload.ts`

```typescript
export function useS3Upload() {
  const uploadToS3 = async (options: UploadToS3Options): Promise<string | null> => {
    // Step 1: Get presigned URL from backend
    const presignedResponse = await fetch(`${API_BASE_URL}/api/v1/s3-backend/presigned-upload`, {
      method: 'POST',
      body: JSON.stringify({
        tenantId: options.tenantId,
        entityType: options.entityType,
        entityId: options.entityId,
        fileName: options.fileName,
        contentType: options.contentType
      })
    });
    const { url, objectKey } = await presignedResponse.json();

    // Step 2: Upload directly to S3
    await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': options.contentType },
      body: options.file
    });

    return objectKey;
  };

  return { uploadToS3, getDownloadUrl, uploadingFiles, uploadProgress, errors };
}
```

**Used by:**
- `EntityCreatePage.tsx` → Artifact/cost/revenue uploads
- `InteractiveForm.tsx` → Form file uploads + signatures
- Any future upload features

### Entity Relationships

Artifacts can be linked to any entity:

```sql
-- d_artifact table stores entity relationship
UPDATE d_artifact
SET entity_type = 'project',
    entity_id = 'proj-uuid'
WHERE id = 'artifact-uuid';

-- Alternative: entity_id_map table for many-to-many
INSERT INTO app.entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
VALUES ('project', 'proj-uuid', 'artifact', 'artifact-uuid');
```

**Supported Parent Entities:**
- `project` → Project blueprints, contracts, reports
- `task` → Task attachments, deliverables
- `client` → Client contracts, agreements
- `office` → Office documents, policies
- `business` → Business templates, brochures
- `employee` → Employee certificates, resumes

---

## 5. Central Configuration & Middleware

### Entity Configuration System

**Location:** `apps/web/src/lib/entityConfig.ts`

**Purpose:** Single source of truth for ALL entity definitions

```typescript
export const entityConfigs: Record<string, EntityConfig> = {
  artifact: { /* artifact config */ },
  project: { /* project config */ },
  task: { /* task config */ },
  // ... all other entities
};
```

**Benefits:**
- Change field once, updates everywhere (list, create, edit)
- No duplication across pages
- Type-safe configuration
- Self-documenting entity schema

### S3AttachmentService Configuration

**Location:** `apps/api/src/lib/s3-attachments.ts`

**Initialization:**
```typescript
import { S3Client } from '@aws-sdk/client-s3';
import { fromIni } from '@aws-sdk/credential-providers';
import { config } from '@/lib/config.js';

const s3Client = new S3Client({
  region: config.AWS_REGION || 'us-east-1',
  credentials: fromIni({ profile: 'cohuron' })
});

export const s3AttachmentService = new S3AttachmentService(
  s3Client,
  config.S3_ATTACHMENTS_BUCKET
);
```

**Environment Variables:**
```bash
# apps/api/.env
AWS_REGION=us-east-1
S3_ATTACHMENTS_BUCKET=cohuron-attachments-prod-957207443425
```

### Authentication Middleware

**Location:** `apps/api/src/lib/auth.ts`

All artifact endpoints require JWT authentication:

```typescript
fastify.addHook('onRequest', async (request, reply) => {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    reply.code(401).send({ error: 'Missing authorization token' });
    return;
  }
  const decoded = jwt.verify(token, config.JWT_SECRET);
  request.user = decoded;
});
```

---

## 6. User Interaction Flow Examples

### Flow 1: Create New Artifact

**User Steps:**
```
1. Navigate to http://localhost:5173/artifact/new
2. See "Create Artifact" page with:
   - File upload drop zone (top)
   - Empty form fields (bottom)
3. Drag & drop file OR click to browse → Select "project-report.pdf"
4. File appears with name and size
5. Click "Upload to S3" button
   ↓
   [Progress: Uploading... 50%... 100%]
   ↓
6. Name field auto-populates with "project-report.pdf" ✨
7. Code field shows "ART-1730234567890" (auto-generated)
8. Fill optional fields:
   - Description: "Q1 2025 Financial Report"
   - Artifact Type: "Report"
   - Visibility: "Internal"
   - Security: "Confidential"
9. Click "Create Artifact"
   ↓
   [Loading spinner]
   ↓
10. Redirect to /artifact/{new-id} (detail view)
```

**System Flow:**
```
┌──────────────────────────────────────────────────────────┐
│ 1. User selects file in DragDropFileUpload              │
├──────────────────────────────────────────────────────────┤
│ File: project-report.pdf (2.4 MB)                        │
│ State: selectedFile = File object                        │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 2. User clicks "Upload to S3"                            │
├──────────────────────────────────────────────────────────┤
│ POST /api/v1/s3-backend/presigned-upload                 │
│ {                                                         │
│   tenantId: "demo",                                      │
│   entityType: "artifact",                                │
│   entityId: "temp-1730234567890",                        │
│   fileName: "project-report.pdf",                        │
│   contentType: "application/pdf"                         │
│ }                                                         │
│ → Returns: { url, objectKey }                           │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 3. Frontend uploads file directly to S3                  │
├──────────────────────────────────────────────────────────┤
│ PUT https://cohuron-attachments-prod.s3.amazonaws.com/...│
│ Content-Type: application/pdf                            │
│ Body: <binary file data>                                 │
│ → S3 stores file, returns 200 OK                         │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 4. Frontend auto-populates form fields                   │
├──────────────────────────────────────────────────────────┤
│ setFormData({                                            │
│   name: "project-report.pdf",  ← AUTO                    │
│   attachment_format: "pdf",    ← AUTO                    │
│   attachment_size_bytes: 2458000  ← AUTO                 │
│ })                                                        │
│ → Name field now shows "project-report.pdf" ✅           │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 5. User fills remaining fields and clicks "Create"       │
├──────────────────────────────────────────────────────────┤
│ POST /api/v1/artifact                                    │
│ {                                                         │
│   name: "project-report.pdf",                            │
│   code: "ART-1730234567890",                             │
│   descr: "Q1 2025 Financial Report",                     │
│   artifact_type: "report",                               │
│   attachment_format: "pdf",                              │
│   attachment_size_bytes: 2458000,                        │
│   attachment_object_key: "tenant_id=demo/.../abc.pdf",   │
│   attachment_object_bucket: "cohuron-attachments-prod-*",│
│   visibility: "internal",                                │
│   security_classification: "confidential"                │
│ }                                                         │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 6. Backend creates database row                          │
├──────────────────────────────────────────────────────────┤
│ INSERT INTO app.d_artifact (                             │
│   code, name, descr, metadata, artifact_type,            │
│   attachment_format, attachment_size_bytes,              │
│   attachment_object_bucket, attachment_object_key,       │
│   entity_type, entity_id,                                │
│   visibility, security_classification,                   │
│   active_flag                                            │
│ ) VALUES (...)                                            │
│ RETURNING *                                               │
│                                                          │
│ → Returns: { id: "a1111...", name: "project-report.pdf" }│
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 7. Frontend navigates to detail page                     │
├──────────────────────────────────────────────────────────┤
│ navigate(`/artifact/${created.id}`)                      │
│ → EntityDetailPage renders artifact details              │
│ → Shows: Name, Format, Size, Type, Visibility, etc.      │
└──────────────────────────────────────────────────────────┘
```

---

## 7. Critical Considerations When Editing

### 1. Field Name Consistency

**CRITICAL:** Database column names MUST match API field names MUST match frontend form keys.

**Correct Mapping:**
```typescript
// Database (d_artifact table)
attachment_format TEXT
attachment_size_bytes BIGINT
attachment_object_key TEXT
attachment_object_bucket TEXT

// API (routes.ts)
data.attachment_format
data.attachment_size_bytes
data.attachment_object_key
data.attachment_object_bucket

// Frontend (EntityCreatePage.tsx)
formData.attachment_format
formData.attachment_size_bytes
```

**Common Mistake (FIXED 2025-11-04):**
```typescript
// ❌ WRONG - Mismatched names
formData.file_format  // Database uses attachment_format
formData.file_size_bytes  // Database uses attachment_size_bytes
formData.object_key  // Database uses attachment_object_key
```

### 2. Auto-Population Logic

**When to auto-populate:**
- ✅ `name` field → Always from uploaded filename
- ✅ `attachment_format` → From file extension after upload
- ✅ `attachment_size_bytes` → From file.size after upload
- ✅ `attachment_object_key` → From S3 service response
- ✅ `attachment_object_bucket` → From environment config

**When NOT to auto-populate:**
- ❌ `descr` (description) → User should write this
- ❌ `artifact_type` → User should select category
- ❌ `visibility` → User should choose access level
- ❌ `security_classification` → User should set security

### 3. Form Field Visibility

**Show in CREATE mode form:**
- Name (text input, auto-populated from filename, editable)
- Code (text input, auto-generated as `ART-{timestamp}`, editable)
- Description (rich text editor)
- Artifact Type (dropdown, defaults to 'document')
- Visibility (dropdown, required, defaults to 'internal')
- Security Classification (dropdown, required, defaults to 'general')
- Metadata (JSONB editor)

**Show in EDIT mode (header):**
- Name (inline editable in page header)
- Code (inline editable in page header)

**Auto-populated (not shown in form):**
- attachment_format (set from file extension after upload)
- attachment_size_bytes (set from file.size after upload)
- attachment_object_key (set from S3 service response)
- attachment_object_bucket (set to production bucket)
- attachment (S3 URI, legacy field, optional)

### 4. API INSERT Statement Alignment

**CRITICAL:** VALUES must align EXACTLY with column names.

**Correct Implementation:**
```sql
INSERT INTO app.d_artifact (
  code, name, descr, metadata, artifact_type,
  attachment_format, attachment_size_bytes,
  attachment_object_bucket, attachment_object_key,
  entity_type, entity_id,
  visibility, security_classification,
  active_flag
) VALUES (
  ${code},                -- code
  ${data.name},           -- name
  ${data.descr || null},  -- descr
  ${metadata}::jsonb,     -- metadata
  ${data.artifact_type},  -- artifact_type
  ${data.attachment_format || null},  -- attachment_format
  ${data.attachment_size_bytes || null},  -- attachment_size_bytes
  ${data.attachment_object_bucket || null},  -- attachment_object_bucket
  ${data.attachment_object_key || null},  -- attachment_object_key
  ${data.entity_type || null},  -- entity_type
  ${data.entity_id || null},  -- entity_id
  ${data.visibility || 'internal'},  -- visibility
  ${data.security_classification || 'general'},  -- security_classification
  ${data.active_flag !== false}  -- active_flag
)
```

**Common Bug (FIXED 2025-11-04):**
```sql
-- ❌ WRONG - Misaligned VALUES
INSERT INTO app.d_artifact (code, name, descr, ...)
VALUES (${slug}, ${code}, ${name}, ...)
       ↑         ↑         ↑
   Wrong!    Wrong!    Wrong!
-- This was putting slug into code column, code into name, etc.
```

### 5. Universal Entity System Integration

**When adding new fields:**

1. Add to database schema (`db/21_d_artifact.ddl`)
2. Add to API schema (`apps/api/src/modules/artifact/routes.ts`)
3. Add to entity config (`apps/web/src/lib/entityConfig.ts`)
4. EntityCreatePage and EntityDetailPage automatically use new field ✅

**No custom page code needed!**

### 6. Testing Checklist

**Unit Tests:**
- [ ] File upload to S3
- [ ] Name auto-population from filename
- [ ] Format extraction from file extension
- [ ] Size calculation from file.size
- [ ] Object key storage in database

**Integration Tests:**
- [ ] Create artifact with file upload
- [ ] Create artifact without file (metadata only)
- [ ] Update metadata (PUT /api/v1/artifact/:id)
- [ ] Download artifact (GET /api/v1/artifact/:id/download)

**End-to-End Tests:**
- [ ] Complete create workflow (UI → API → S3 → Database)
- [ ] Verify artifact appears in list (/artifact)
- [ ] Verify artifact detail page (/artifact/:id)
- [ ] Download file and verify content

**SQL Verification Queries:**
```sql
-- After creating artifact, verify correct data
SELECT
  code, name, attachment_format, attachment_size_bytes,
  attachment_object_key, attachment_object_bucket,
  artifact_type, visibility, security_classification,
  active_flag, created_ts
FROM app.d_artifact
WHERE code = 'ART-1730234567890';
-- Expected: All fields populated correctly

-- Check S3 object key is not null
SELECT * FROM app.d_artifact
WHERE attachment_object_key IS NULL AND active_flag = true;
-- Expected: 0 rows (all active artifacts should have files)
```

---

## Summary

### ✅ What's Complete (2025-11-04)

- **Universal Entity System**: Artifact uses EntityCreatePage (no custom page needed)
- **Auto-Population**: Name, format, size auto-populated from uploaded file
- **API Endpoints**: CREATE, GET, UPDATE, DELETE all implemented
- **Database Schema**: Correct column names and types (`attachment_*` prefix)
- **S3 Integration**: Presigned URLs for upload/download
- **DRY Architecture**: Unified S3 upload system (useS3Upload + S3AttachmentService)
- **File Preview**: FilePreview component displays PDF, images, videos inline
- **Download**: Download button generates presigned URLs for secure file access
- **Bug Fixes**:
  - API INSERT statement column alignment fixed
  - Field name consistency across FilePreview, EntityDetailPage, entityConfig
  - Name and code fields now visible in create mode

### 📊 Key Metrics

| Metric | Value |
|--------|-------|
| API Endpoints | 8 (all functional) |
| Database Tables | 1 (`d_artifact`) |
| UI Pages | 3 (list, create, detail) |
| Custom Components | 0 (all universal) |
| S3 Integration | Complete (DRY architecture) |
| Storage | PostgreSQL (metadata) + S3 (files) |

### 🎯 Architecture Highlights

**DRY Principles:**
- Single entity configuration → Multiple pages
- Single S3 upload hook → Multiple upload types
- Single API pattern → Consistent across all entities

**Auto-Population:**
- Filename → name field
- File extension → attachment_format
- File size → attachment_size_bytes
- S3 response → attachment_object_key

**Current State:**
- ✅ `/artifact/new` creates new artifacts with file upload
- ✅ `/artifact/:id` views artifact details
- ✅ `/artifact` lists all artifacts
- ⏳ Versioning endpoints implemented but UI pending

---

## Related Documentation

- **S3 Upload Architecture**: [S3_ATTACHMENT_SERVICE_COMPLETE_GUIDE.md](./S3_ATTACHMENT_SERVICE_COMPLETE_GUIDE.md)
- **Database Schema**: `db/21_d_artifact.ddl`
- **API Implementation**: `apps/api/src/modules/artifact/routes.ts`
- **S3 Service**: `apps/api/src/lib/s3-attachments.ts`
- **Frontend Hook**: `apps/web/src/lib/hooks/useS3Upload.ts`
- **Entity Config**: `apps/web/src/lib/entityConfig.ts`
- **Universal Create Page**: `apps/web/src/pages/shared/EntityCreatePage.tsx`

---

**Last Updated:** 2025-11-04
**Status:** ✅ Create/Upload/Preview/Download Flow Complete
**Next Steps:** Implement versioning UI (version history tab, restore old versions)
