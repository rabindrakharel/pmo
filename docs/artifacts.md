# Artifact Entity - Complete Technical Documentation

> **Document and File Management with Versioning** - S3-backed artifact storage with SCD Type 2 versioning, metadata management, and entity relationships

**Last Updated:** 2025-10-23
**Status:** ✅ Production Ready (Backend Complete, Frontend Pending)

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
- **Metadata in PostgreSQL**: Name, description, tags, relationships, version tracking
- **Files in S3**: Actual file content with presigned URLs for secure access
- **Version control**: Each re-upload creates new database row with incremented version
- **Temporal tracking**: from_ts and to_ts track when each version was active
- **Soft deletes**: active_flag marks current version, preserves history

**Versioning Rules:**
- **Metadata updates**: Don't create new version (in-place update)
- **File re-upload**: Always creates new version (SCD Type 2)
- **Version chain**: All versions linked via parent_artifact_id
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
│  ├─ /artifact/:id            → EntityDetailPage (view)      │
│  ├─ /artifact/upload         → ArtifactUploadPage          │
│  ├─ /artifact/:id/edit       → ArtifactEditPage (pending)  │
│  └─ /artifact/:id/versions   → Version history view        │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  🎨 COMPONENTS                                               │
│  ├─ ArtifactUploadPage       → Multi-file upload with meta │
│  │   └─ useS3Upload()        → Reusable S3 hook (DRY)      │
│  ├─ ArtifactForm (pending)   → Reusable create/edit form   │
│  └─ VersionHistory (pending) → Version timeline display    │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ⚙️  API (Fastify)                                           │
│  ├─ POST   /api/v1/artifact/upload           → Create v1   │
│  ├─ GET    /api/v1/artifact/:id              → Get single  │
│  ├─ PUT    /api/v1/artifact/:id              → Update meta │
│  ├─ DELETE /api/v1/artifact/:id              → Soft delete │
│  ├─ POST   /api/v1/artifact/:id/new-version  → Create vN   │
│  ├─ GET    /api/v1/artifact/:id/versions     → Get history │
│  ├─ GET    /api/v1/artifact/:id/download     → Download URL│
│  └─ GET    /api/v1/artifact/entity/:type/:id → List by ent │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  💾 DATABASE (PostgreSQL)                                    │
│  ├─ d_artifact            → Metadata + version tracking    │
│  ├─ entity_id_map         → Entity relationships           │
│  └─ entity_id_rbac_map    → Access permissions             │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ☁️  STORAGE (AWS S3)                                        │
│  └─ Bucket: cohuron-attachments-prod-957207443425          │
│      └─ tenant_id=demo/entity=artifact/entity_id={uuid}/   │
│          ├─ {hash}_v1.pdf                                  │
│          ├─ {hash}_v2.pdf                                  │
│          └─ {hash}_v3.pdf                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Design Patterns

#### 1. **SCD Type 2 (Slowly Changing Dimension)**

Each artifact version is a separate database row:

```sql
-- Version 1 (Superseded)
id: a1111111-1111-1111-1111-111111111111
parent_artifact_id: NULL
version: 1
active_flag: false
from_ts: 2025-01-01 10:00:00
to_ts: 2025-01-02 14:30:00

-- Version 2 (Current)
id: b2222222-2222-2222-2222-222222222222
parent_artifact_id: a1111111... (links to v1)
version: 2
active_flag: true
from_ts: 2025-01-02 14:30:00
to_ts: NULL
```

**Benefits:**
- Complete audit trail (who uploaded what when)
- Temporal queries (what was current on X date?)
- No data loss (all versions preserved)
- Easy rollback (just flip active_flag)

#### 2. **Metadata-File Separation**

```
PostgreSQL (Fast queries)        S3 (Scalable storage)
├─ name: "Blueprint.pdf"        ├─ actual file bytes
├─ size: 2.4 MB                 ├─ presigned URL access
├─ version: 3                   └─ lifecycle policies
├─ from_ts: 2025-01-05
└─ object_key: "tenant_id=..."
```

**Why?**
- Database optimized for queries, not file storage
- S3 optimized for file storage and delivery
- Cost-effective (S3 cheaper than database storage)
- Scalable (billions of files supported)

#### 3. **Version vs. Metadata Update Pattern**

**When does a new version get created?**

| Action | New Version? | Behavior |
|--------|--------------|----------|
| **Upload new file** | ✅ Yes | SCD Type 2: New row, new S3 object |
| **Update description** | ❌ No | In-place update, same row |
| **Update tags** | ❌ No | In-place update, same row |
| **Update visibility** | ❌ No | In-place update, same row |
| **Rename artifact** | ❌ No | In-place update, same row |

**Example:**
```typescript
// This creates a new version:
POST /api/v1/artifact/:id/new-version
{ fileName: "updated.pdf", file: <binary> }

// This does NOT create a new version:
PUT /api/v1/artifact/:id
{ descr: "Updated description", tags: ["new-tag"] }
```

---

## 3. Database, API & UI/UX Mapping

### Database Layer (d_artifact Table)

**Location:** `db/21_d_artifact.ddl`

```sql
CREATE TABLE app.d_artifact (
    -- Primary key (NEW ID for each version)
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identifiers
    slug varchar(100) UNIQUE NOT NULL,
    code varchar(50) UNIQUE NOT NULL,

    -- Metadata
    name varchar(200) NOT NULL,
    descr text,
    internal_url varchar(500),
    shared_url varchar(500),
    tags jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,

    -- Classification
    artifact_type varchar(50) DEFAULT 'document',  -- document, template, image, video
    file_format varchar(20),                       -- pdf, docx, xlsx, png, jpg, mp4
    file_size_bytes bigint,

    -- Entity Relationships
    entity_type varchar(50),  -- project, task, office, business
    entity_id uuid,

    -- S3 Storage (UNIQUE per version)
    bucket_name varchar(100),
    object_key varchar(500),  -- Different for each version

    -- Access Control
    visibility varchar(20) DEFAULT 'internal',              -- public, internal, restricted, private
    security_classification varchar(20) DEFAULT 'general',  -- general, confidential, restricted

    -- Version Control (SCD Type 2)
    parent_artifact_id uuid,          -- NULL for v1, root ID for v2+
    is_latest_version boolean DEFAULT true,  -- Only current = true
    version integer DEFAULT 1,               -- 1, 2, 3, ...

    -- Temporal Tracking
    from_ts timestamptz DEFAULT now(),  -- Effective from
    to_ts timestamptz,                   -- Effective to (NULL = current)
    active_flag boolean DEFAULT true,    -- true = current version
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);
```

**Key Fields Explained:**

| Field | Purpose | Versioning Behavior |
|-------|---------|---------------------|
| `id` | Primary key | **NEW ID** for each version |
| `parent_artifact_id` | Links version chain | NULL for v1, root ID for v2+ |
| `version` | Version number | 1, 2, 3, ... (increments) |
| `active_flag` | Current version marker | Only one true per chain |
| `is_latest_version` | Same as active_flag | Only one true per chain |
| `from_ts` | Effective from date | Set when version created |
| `to_ts` | Effective to date | Set when superseded (NULL = current) |
| `object_key` | S3 file location | **UNIQUE** per version |

### API Layer (Fastify Routes)

**Location:** `apps/api/src/modules/artifact/routes.ts`

#### 1. Create Artifact (Version 1)

**Endpoint:** `POST /api/v1/artifact/upload`

**Request:**
```json
{
  "name": "Project Blueprint",
  "descr": "Main architectural blueprint for Phase 1",
  "entityType": "project",
  "entityId": "proj-uuid-here",
  "fileName": "blueprint.pdf",
  "contentType": "application/pdf",
  "fileSize": 2458000,
  "tags": ["blueprint", "architecture", "phase1"],
  "visibility": "internal",
  "securityClassification": "confidential"
}
```

**Response:**
```json
{
  "artifact": {
    "id": "a1111111-1111-1111-1111-111111111111",
    "name": "Project Blueprint",
    "version": 1,
    "active_flag": true,
    "object_key": "tenant_id=demo/entity=project/entity_id=proj-uuid/abc123.pdf",
    "from_ts": "2025-01-01T10:00:00Z"
  },
  "uploadUrl": "https://cohuron-attachments-prod-957207443425.s3.amazonaws.com/...",
  "expiresIn": 3600
}
```

#### 2. Upload New Version

**Endpoint:** `POST /api/v1/artifact/:id/new-version`

**Request:**
```json
{
  "fileName": "blueprint_updated.pdf",
  "contentType": "application/pdf",
  "fileSize": 3120000,
  "descr": "Updated with client feedback"
}
```

**Response:**
```json
{
  "oldArtifact": {
    "id": "a1111111-1111-1111-1111-111111111111",
    "version": 1,
    "active_flag": false,
    "to_ts": "2025-01-02T14:30:00Z"
  },
  "newArtifact": {
    "id": "b2222222-2222-2222-2222-222222222222",
    "version": 2,
    "active_flag": true,
    "parent_artifact_id": "a1111111-1111-1111-1111-111111111111",
    "from_ts": "2025-01-02T14:30:00Z"
  },
  "uploadUrl": "https://...",
  "expiresIn": 3600
}
```

#### 3. Get Version History

**Endpoint:** `GET /api/v1/artifact/:id/versions`

**Response:**
```json
{
  "data": [
    {
      "id": "c3333333-3333-3333-3333-333333333333",
      "version": 3,
      "active_flag": true,
      "from_ts": "2025-01-05T09:15:00Z",
      "to_ts": null
    },
    {
      "id": "b2222222-2222-2222-2222-222222222222",
      "version": 2,
      "active_flag": false,
      "from_ts": "2025-01-02T14:30:00Z",
      "to_ts": "2025-01-05T09:15:00Z"
    },
    {
      "id": "a1111111-1111-1111-1111-111111111111",
      "version": 1,
      "active_flag": false,
      "from_ts": "2025-01-01T10:00:00Z",
      "to_ts": "2025-01-02T14:30:00Z"
    }
  ],
  "rootArtifactId": "a1111111-1111-1111-1111-111111111111",
  "currentVersion": 3
}
```

#### 4. Update Metadata Only

**Endpoint:** `PUT /api/v1/artifact/:id`

**Request:**
```json
{
  "descr": "Updated description only",
  "tags": ["blueprint", "approved"]
}
```

**Behavior:** Same ID, same version, in-place update, NO new S3 object

#### 5. Download Artifact

**Endpoint:** `GET /api/v1/artifact/:id/download`

**Response:**
```json
{
  "url": "https://cohuron-attachments-prod-957207443425.s3.amazonaws.com/...",
  "fileName": "Project Blueprint.pdf",
  "expiresIn": 3600
}
```

#### 6. List Artifacts by Entity

**Endpoint:** `GET /api/v1/artifact/entity/:entityType/:entityId`

**Example:** `GET /api/v1/artifact/entity/project/proj-uuid`

**Response:** Returns all active artifacts for the entity

### UI/UX Layer (React Components)

#### 1. ArtifactForm Component (Reusable)

**Location:** `apps/web/src/components/artifact/ArtifactForm.tsx`

**Props:**
```typescript
interface ArtifactFormProps {
  mode: 'create' | 'edit';
  initialData?: Artifact;
  entityType?: string;
  entityId?: string;
  onSuccess?: (artifact: Artifact) => void;
}
```

**Key Features:**
- **Create mode:** Empty form, file required
- **Edit mode:** Prefilled data, file optional
- **Warning in edit:** "⚠️ Uploading new file will create Version X+1"
- **Metadata-only:** If no file selected, just updates description/tags

#### 2. ArtifactEditPage (Version History UI)

**Location:** `apps/web/src/pages/artifact/ArtifactEditPage.tsx`

**Features:**
- Displays version history table
- Download buttons for each version
- Visual indicators (✅ Active, 📜 Archived)
- Effective date ranges

#### 3. Page Routes

```typescript
/artifact                → EntityMainPage (list all artifacts)
/artifact/upload         → ArtifactUploadPage (create v1)
/artifact/:id            → EntityDetailPage (view details)
/artifact/:id/edit       → ArtifactEditPage (update or create new version)
/artifact/:id/versions   → Version history view
```

### S3 Storage Layer

**Bucket:** `cohuron-attachments-prod-957207443425`

**Structure:**
```
s3://cohuron-attachments-prod-957207443425/
└── tenant_id=demo/
    └── entity=artifact/
        └── entity_id={artifact-id}/
            ├── abc123hash.pdf   (Version 1)
            ├── def456hash.pdf   (Version 2)
            └── ghi789hash.pdf   (Version 3 - current)
```

**Key Points:**
- Multi-tenant ready (separate by tenant_id)
- Entity scoped (each artifact has its own folder)
- Version isolation (each version = unique S3 object)
- No overwrites (old versions preserved)

---

## 4. DRY Principles & Entity Relationships

### Unified S3 Upload System

All uploads (artifacts, forms, signatures) use the **same infrastructure**:

```
useS3Upload (hook) → S3 Backend API → S3AttachmentService → AWS S3
```

**Why DRY?**
- Fix bugs once, benefits all upload types
- Consistent presigned URL flow
- Single security/authentication layer
- Shared error handling and retry logic

**See:** [S3_UPLOAD_DRY_ARCHITECTURE.md](./S3_UPLOAD_DRY_ARCHITECTURE.md) for complete details

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
        contentType: options.contentType,
      }),
    });
    const { url, objectKey } = await presignedResponse.json();

    // Step 2: Upload directly to S3
    await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': options.contentType },
      body: options.file,
    });

    return objectKey;
  };

  return { uploadToS3, getDownloadUrl, uploadingFiles, uploadProgress, errors };
}
```

**Used by:**
- `InteractiveForm.tsx` → Form file uploads + signatures
- `ArtifactUploadPage.tsx` → Artifact uploads
- Any future upload features

### Backend Service (S3AttachmentService)

**Location:** `apps/api/src/lib/s3-attachments.ts`

**Core Methods:**
```typescript
class S3AttachmentService {
  // Generate presigned URL for uploads
  async generatePresignedUploadUrl(params: {
    tenantId: string;
    entityType: string;
    entityId: string;
    fileName: string;
    contentType: string;
  }): Promise<{ url: string; objectKey: string; expiresIn: number }>;

  // Generate presigned URL for downloads
  async generatePresignedDownloadUrl(objectKey: string): Promise<{ url: string; expiresIn: number }>;

  // List all attachments for entity
  async listAttachments(entityType: string, entityId: string): Promise<S3Object[]>;

  // Delete attachment
  async deleteAttachment(objectKey: string): Promise<void>;

  // Health check
  async checkHealth(): Promise<{ connected: boolean; bucket: string }>;
}
```

### Backend API Routes

**Location:** `apps/api/src/modules/s3-backend/routes.ts`

```typescript
POST   /api/v1/s3-backend/presigned-upload     → Generate upload URL
POST   /api/v1/s3-backend/presigned-download   → Generate download URL
GET    /api/v1/s3-backend/list/:entityType/:entityId → List attachments
DELETE /api/v1/s3-backend/attachment            → Delete attachment
GET    /api/v1/s3-backend/health                → Health check
```

### Entity Relationships

Artifacts can be linked to any entity:

```sql
-- entity_id_map table
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
- `form` → Form submissions (auto-linked)

**Query Examples:**
```sql
-- Get all artifacts for a project
SELECT a.* FROM app.d_artifact a
WHERE a.entity_type = 'project' AND a.entity_id = 'proj-uuid'
  AND a.active_flag = true;

-- Get all artifacts via entity_id_map
SELECT a.* FROM app.d_artifact a
JOIN app.entity_id_map eim ON a.id = eim.child_entity_id
WHERE eim.parent_entity_type = 'project'
  AND eim.parent_entity_id = 'proj-uuid'
  AND eim.child_entity_type = 'artifact';
```

---

## 5. Central Configuration & Middleware

### S3AttachmentService Configuration

**Location:** `apps/api/src/lib/s3-attachments.ts`

**Initialization:**
```typescript
import { S3Client } from '@aws-sdk/client-s3';
import { fromIni } from '@aws-sdk/credential-providers';
import { config } from '@/lib/config.js';

const s3Client = new S3Client({
  region: config.AWS_REGION || 'us-east-1',
  credentials: fromIni({ profile: 'cohuron' }), // AWS CLI profile
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

### Artifact Route Configuration

**Location:** `apps/api/src/modules/artifact/routes.ts`

**Route Registration:**
```typescript
import type { FastifyInstance } from 'fastify';
import { db } from '@/lib/db.js';
import { s3AttachmentService } from '@/lib/s3-attachments.js';
import { sql } from 'drizzle-orm';

export default async function artifactRoutes(fastify: FastifyInstance) {
  // All routes automatically include JWT authentication middleware
  // All routes automatically validate request schemas

  fastify.post('/api/v1/artifact/upload', async (request, reply) => { /* ... */ });
  fastify.post('/api/v1/artifact/:id/new-version', async (request, reply) => { /* ... */ });
  fastify.get('/api/v1/artifact/:id/versions', async (request, reply) => { /* ... */ });
  fastify.put('/api/v1/artifact/:id', async (request, reply) => { /* ... */ });
  fastify.get('/api/v1/artifact/:id/download', async (request, reply) => { /* ... */ });
  fastify.get('/api/v1/artifact/entity/:entityType/:entityId', async (request, reply) => { /* ... */ });
}
```

### Authentication Middleware

**Location:** `apps/api/src/lib/auth.ts`

All artifact endpoints require JWT authentication:

```typescript
// Automatically applied to all routes
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

### Versioning Logic (Core Middleware)

**When creating new version:**

```typescript
// Step 1: Find current artifact and max version
const current = await db.execute(sql`
  SELECT * FROM app.d_artifact WHERE id = ${id}
`);

const maxVersionResult = await db.execute(sql`
  SELECT MAX(version) as max_version FROM app.d_artifact
  WHERE id = ${rootId} OR parent_artifact_id = ${rootId}
`);

const nextVersion = (maxVersionResult.rows[0]?.max_version || 0) + 1;

// Step 2: Mark old version inactive (ATOMIC TRANSACTION)
await db.execute(sql`
  UPDATE app.d_artifact
  SET active_flag = false,
      is_latest_version = false,
      to_ts = NOW()
  WHERE id = ${id}
`);

// Step 3: Create new version row
await db.execute(sql`
  INSERT INTO app.d_artifact (
    name, descr, tags, ...,
    parent_artifact_id, version, active_flag, from_ts
  ) VALUES (
    ${name}, ${descr}, ${tags}, ...,
    ${rootId}, ${nextVersion}, true, NOW()
  ) RETURNING *
`);
```

### Frontend Entity Configuration

**Location:** `apps/web/src/lib/entityConfig.ts`

```typescript
export const entityConfigs: Record<string, EntityConfig> = {
  artifact: {
    singularName: 'Artifact',
    pluralName: 'Artifacts',
    icon: FileText,
    tableName: 'd_artifact',
    columns: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'version', label: 'Version', type: 'number' },
      { key: 'file_format', label: 'Format', type: 'text' },
      { key: 'file_size_bytes', label: 'Size', type: 'number', render: (val) => `${(val / 1024).toFixed(2)} KB` },
      { key: 'active_flag', label: 'Status', type: 'boolean', render: (val) => val ? '✅ Active' : '📜 Archived' },
      { key: 'from_ts', label: 'Effective From', type: 'datetime' },
    ],
    childEntities: [],
    canCreate: true,
    canEdit: true,
    canDelete: true,
  },
};
```

---

## 6. User Interaction Flow Examples

### Flow 1: Create New Artifact

**User Actions:**
```
1. Navigate to /artifact/upload
2. Fill form:
   - Name: "Project Blueprint"
   - Description: "Main architectural plan"
   - Tags: blueprint, architecture
   - Select file: blueprint.pdf (2.4 MB)
3. Click "Create Artifact"
   ↓
   [Loading spinner]
   ↓
4. Redirect to /artifact/{new-id} (detail view)
```

**System Flow:**
```
┌──────────────────────────────────────────────────────────┐
│ 1. ArtifactForm component submits data                  │
├──────────────────────────────────────────────────────────┤
│ POST /api/v1/artifact/upload                             │
│ {                                                         │
│   name: "Project Blueprint",                             │
│   fileName: "blueprint.pdf",                             │
│   contentType: "application/pdf",                        │
│   fileSize: 2458000                                      │
│ }                                                         │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 2. Backend creates database row                          │
├──────────────────────────────────────────────────────────┤
│ INSERT INTO d_artifact                                    │
│ (name, version, active_flag, from_ts, ...)               │
│ VALUES ('Project Blueprint', 1, true, NOW(), ...)        │
│ RETURNING id, object_key                                 │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 3. Backend generates presigned upload URL                │
├──────────────────────────────────────────────────────────┤
│ S3AttachmentService.generatePresignedUploadUrl({         │
│   tenantId: 'demo',                                      │
│   entityType: 'artifact',                                │
│   entityId: new-artifact-id,                             │
│   fileName: 'blueprint.pdf'                              │
│ })                                                        │
│ → Returns: { url, objectKey, expiresIn: 3600 }          │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 4. Frontend uploads file directly to S3                  │
├──────────────────────────────────────────────────────────┤
│ PUT https://cohuron-attachments-prod.s3.amazonaws.com/...│
│ Content-Type: application/pdf                            │
│ Body: <binary file data>                                 │
│ → S3 stores file at:                                     │
│   tenant_id=demo/entity=artifact/entity_id={id}/abc.pdf  │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 5. Frontend navigates to detail page                     │
├──────────────────────────────────────────────────────────┤
│ navigate(`/artifact/${newArtifact.id}`)                  │
│ → EntityDetailPage renders artifact details              │
│ → Shows version: 1, status: Active ✅                    │
└──────────────────────────────────────────────────────────┘
```

---

### Flow 2: Update Metadata Only (No New Version)

**User Actions:**
```
1. Navigate to /artifact/{id}/edit
2. See prefilled form with current data
3. Change description: "Updated with review notes"
4. Do NOT select new file
5. Click "Update Metadata"
   ↓
   [Success toast: "Metadata updated"]
   ↓
6. Redirect back to /artifact/{id}
```

**System Flow:**
```
┌──────────────────────────────────────────────────────────┐
│ 1. ArtifactForm detects no file selected                 │
├──────────────────────────────────────────────────────────┤
│ PUT /api/v1/artifact/{id}                                │
│ {                                                         │
│   descr: "Updated with review notes",                    │
│   tags: ["blueprint", "reviewed"]                        │
│ }                                                         │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 2. Backend updates SAME row (in-place)                   │
├──────────────────────────────────────────────────────────┤
│ UPDATE d_artifact                                         │
│ SET descr = 'Updated with review notes',                 │
│     tags = '["blueprint", "reviewed"]',                  │
│     updated_ts = NOW()                                   │
│ WHERE id = {artifact-id}                                 │
│                                                          │
│ ✅ SAME ID                                               │
│ ✅ SAME version                                          │
│ ✅ SAME object_key                                       │
│ ✅ NO new S3 upload                                      │
└──────────────────────────────────────────────────────────┘
```

---

### Flow 3: Upload New Version (File Change)

**User Actions:**
```
1. Navigate to /artifact/{id}/edit
2. See prefilled form with current data (Version 2)
3. Select new file: blueprint_v3.pdf
4. See warning: "⚠️ Uploading new file will create Version 3"
5. Optionally update description
6. Click "Upload Version 3"
   ↓
   [Loading spinner]
   ↓
7. Redirect to /artifact/{new-id} (new version's detail page)
```

**System Flow:**
```
┌──────────────────────────────────────────────────────────┐
│ 1. ArtifactForm detects file selected                    │
├──────────────────────────────────────────────────────────┤
│ POST /api/v1/artifact/{id}/new-version                   │
│ {                                                         │
│   fileName: "blueprint_v3.pdf",                          │
│   contentType: "application/pdf",                        │
│   fileSize: 3200000,                                     │
│   descr: "Updated with final changes"                    │
│ }                                                         │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 2. Backend finds current version and calculates next     │
├──────────────────────────────────────────────────────────┤
│ SELECT * FROM d_artifact WHERE id = {id}                 │
│ → current version = 2                                    │
│                                                          │
│ SELECT MAX(version) FROM d_artifact                      │
│ WHERE parent_artifact_id = {root_id}                     │
│ → max version = 2                                        │
│ → next version = 3                                       │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 3. Backend marks old version inactive                    │
├──────────────────────────────────────────────────────────┤
│ UPDATE d_artifact                                         │
│ SET active_flag = false,                                 │
│     is_latest_version = false,                           │
│     to_ts = NOW()  -- Marks when this version ended      │
│ WHERE id = {old-id}                                      │
│                                                          │
│ Result: Version 2 now inactive ❌                        │
│   from_ts: 2025-01-02 14:30:00                           │
│   to_ts: 2025-01-05 09:15:00  ← NEW                      │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 4. Backend creates new version row                       │
├──────────────────────────────────────────────────────────┤
│ INSERT INTO d_artifact (                                 │
│   id,  -- NEW UUID generated                             │
│   name, descr, tags, ...,                                │
│   parent_artifact_id,  -- Links to v1 (root)             │
│   version,             -- 3                              │
│   active_flag,         -- true                           │
│   is_latest_version,   -- true                           │
│   from_ts,             -- NOW()                          │
│   to_ts                -- NULL (current)                 │
│ ) VALUES (                                                │
│   gen_random_uuid(),                                     │
│   'Project Blueprint',                                   │
│   'Updated with final changes',                          │
│   ...,                                                   │
│   {root-id},                                             │
│   3,                                                     │
│   true,                                                  │
│   true,                                                  │
│   NOW(),                                                 │
│   NULL                                                   │
│ ) RETURNING *                                             │
│                                                          │
│ Result: New version 3 created ✅                         │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 5. Backend generates presigned upload URL                │
├──────────────────────────────────────────────────────────┤
│ S3AttachmentService.generatePresignedUploadUrl({         │
│   tenantId: 'demo',                                      │
│   entityType: 'artifact',                                │
│   entityId: new-version-id,  -- Different from v2!       │
│   fileName: 'blueprint_v3.pdf'                           │
│ })                                                        │
│ → Returns: { url, objectKey, expiresIn }                │
│                                                          │
│ objectKey: tenant_id=demo/.../def789.pdf  ← UNIQUE       │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 6. Frontend uploads new file to S3                       │
├──────────────────────────────────────────────────────────┤
│ PUT https://cohuron-attachments-prod.s3.amazonaws.com/...│
│ Body: <new blueprint_v3.pdf binary>                      │
│                                                          │
│ S3 Storage Structure:                                    │
│ tenant_id=demo/entity=artifact/entity_id={id}/           │
│   ├─ abc123.pdf  ← Version 1 (preserved)                 │
│   ├─ bcd234.pdf  ← Version 2 (preserved)                 │
│   └─ def789.pdf  ← Version 3 (NEW) ✅                    │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 7. Frontend shows success and navigates                  │
├──────────────────────────────────────────────────────────┤
│ toast.success("New version created: v3")                 │
│ navigate(`/artifact/${newArtifact.id}`)                  │
│                                                          │
│ EntityDetailPage shows:                                  │
│   Name: Project Blueprint                                │
│   Version: 3 ✅                                          │
│   Status: Active                                         │
│   Size: 3.2 MB                                           │
│   Effective From: 2025-01-05 09:15:00                    │
└──────────────────────────────────────────────────────────┘
```

---

### Flow 4: View Version History

**User Actions:**
```
1. Navigate to /artifact/{id}/edit
2. Scroll to "Version History" section
3. See table with all versions:
   - Version 3 (3.2 MB) - Active ✅ - 2025-01-05 to Current
   - Version 2 (3.0 MB) - Archived 📜 - 2025-01-02 to 2025-01-05
   - Version 1 (2.4 MB) - Archived 📜 - 2025-01-01 to 2025-01-02
4. Click "Download" on Version 1
   ↓
   [New tab opens with presigned URL]
   ↓
5. Download old version from S3
```

**System Flow:**
```
┌──────────────────────────────────────────────────────────┐
│ 1. Page loads version history                            │
├──────────────────────────────────────────────────────────┤
│ GET /api/v1/artifact/{id}/versions                       │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 2. Backend queries version chain                         │
├──────────────────────────────────────────────────────────┤
│ -- Find root ID                                          │
│ SELECT                                                    │
│   CASE WHEN parent_artifact_id IS NULL THEN id           │
│        ELSE parent_artifact_id END as root_id            │
│ FROM d_artifact WHERE id = {id}                          │
│                                                          │
│ -- Get all versions                                      │
│ SELECT * FROM d_artifact                                 │
│ WHERE id = {root_id} OR parent_artifact_id = {root_id}   │
│ ORDER BY version DESC                                    │
│                                                          │
│ Returns:                                                 │
│ [                                                         │
│   { id: 'v3-id', version: 3, active_flag: true, ... },   │
│   { id: 'v2-id', version: 2, active_flag: false, ... },  │
│   { id: 'v1-id', version: 1, active_flag: false, ... }   │
│ ]                                                         │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 3. User clicks "Download" on Version 1                   │
├──────────────────────────────────────────────────────────┤
│ GET /api/v1/artifact/{v1-id}/download                    │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 4. Backend generates presigned download URL              │
├──────────────────────────────────────────────────────────┤
│ SELECT object_key FROM d_artifact WHERE id = {v1-id}     │
│ → object_key: tenant_id=demo/.../abc123.pdf              │
│                                                          │
│ S3AttachmentService.generatePresignedDownloadUrl(        │
│   objectKey                                              │
│ )                                                         │
│ → Returns: { url, expiresIn: 3600 }                     │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ 5. Frontend opens presigned URL                          │
├──────────────────────────────────────────────────────────┤
│ window.open(url, '_blank')                               │
│ → Browser downloads Version 1 file from S3               │
└──────────────────────────────────────────────────────────┘
```

---

## 7. Critical Considerations When Editing

### 1. Versioning Best Practices

**✅ DO:**
- Always create new version for file changes
- Preserve all versions (never delete old ones)
- Maintain only one `active_flag=true` per version chain
- Set `to_ts` when superseding old version
- Use atomic transactions when marking old/creating new

**❌ DON'T:**
- Don't create new version for metadata-only updates
- Don't delete old versions (breaks audit trail)
- Don't allow multiple active versions of same artifact
- Don't forget to set `to_ts` on old version
- Don't skip `parent_artifact_id` linking

**Example Transaction:**
```typescript
await db.transaction(async (tx) => {
  // Step 1: Mark old inactive
  await tx.execute(sql`
    UPDATE d_artifact
    SET active_flag = false, to_ts = NOW()
    WHERE id = ${oldId}
  `);

  // Step 2: Create new version
  await tx.execute(sql`
    INSERT INTO d_artifact (...) VALUES (...)
  `);
});
```

### 2. S3 Storage Considerations

**Cost Management:**
- Each version consumes S3 storage (~$0.023 per GB/month)
- Consider lifecycle policies for old versions (archive to Glacier after 1 year)
- Monitor bucket size with CloudWatch
- Implement cleanup policy for very old versions (5+ years)

**Storage Policy Example:**
```json
{
  "Rules": [
    {
      "Id": "ArchiveOldVersions",
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 365,
          "StorageClass": "GLACIER"
        }
      ]
    }
  ]
}
```

**Bandwidth:**
- Presigned URLs bypass API server (direct S3 access)
- No egress charges from EC2 to S3 (same region)
- S3 data transfer OUT costs: $0.09 per GB after first 100 GB/month

### 3. Database Performance

**Required Indexes:**
```sql
-- Fast lookup of current versions
CREATE INDEX idx_artifact_active ON d_artifact(active_flag, is_latest_version)
WHERE active_flag = true;

-- Fast version history queries
CREATE INDEX idx_artifact_parent ON d_artifact(parent_artifact_id, version DESC);

-- Fast entity artifact lists
CREATE INDEX idx_artifact_entity ON d_artifact(entity_type, entity_id, active_flag);

-- Temporal queries (point-in-time lookups)
CREATE INDEX idx_artifact_temporal ON d_artifact(from_ts, to_ts);
```

**Query Optimization:**
```sql
-- GOOD: Use index on active_flag
SELECT * FROM d_artifact
WHERE active_flag = true AND entity_type = 'project';

-- BAD: Forces full table scan
SELECT * FROM d_artifact
WHERE active_flag = false;  -- Too many rows

-- GOOD: Use parent_artifact_id index
SELECT * FROM d_artifact
WHERE parent_artifact_id = {root_id}
ORDER BY version DESC;
```

### 4. User Experience

**Clear Warnings:**
```typescript
{mode === 'edit' && file && (
  <div className="warning-banner">
    ⚠️ Uploading new file will create Version {currentVersion + 1}
    <br />
    The current version (v{currentVersion}) will be archived.
  </div>
)}
```

**Version History Visibility:**
- Always show version history when editing
- Display effective date ranges clearly
- Visual indicators (✅ Active, 📜 Archived)
- Allow downloading any version

**Undo/Restore Feature:**
```typescript
// Future enhancement: Restore old version
async function restoreVersion(oldVersionId: string) {
  // Option 1: Set old version as active again
  await db.execute(sql`
    UPDATE d_artifact SET active_flag = true, to_ts = NULL
    WHERE id = ${oldVersionId}
  `);

  // Option 2: Create new version from old (better for audit trail)
  // Copy old version data, create new row with incremented version
}
```

**Audit Trail:**
```typescript
// Track who uploaded each version
interface ArtifactVersion {
  id: string;
  version: number;
  uploaded_by: string;  // User ID
  uploaded_at: string;  // from_ts
  file_size_bytes: number;
  changes_description: string;  // What changed
}
```

### 5. Data Integrity

**Validation Rules:**
```typescript
// Before creating new version
const validations = [
  // Only one active version allowed
  async () => {
    const activeCount = await db.execute(sql`
      SELECT COUNT(*) FROM d_artifact
      WHERE (id = ${rootId} OR parent_artifact_id = ${rootId})
      AND active_flag = true
    `);
    if (activeCount > 1) throw new Error('Multiple active versions detected!');
  },

  // Parent must exist if not v1
  async () => {
    if (version > 1 && !parentArtifactId) {
      throw new Error('Version > 1 requires parent_artifact_id');
    }
  },

  // Object key must be unique
  async () => {
    const exists = await db.execute(sql`
      SELECT id FROM d_artifact WHERE object_key = ${newObjectKey}
    `);
    if (exists.length > 0) throw new Error('Object key already exists!');
  }
];
```

**Foreign Key Considerations:**
- Don't use database foreign keys for `parent_artifact_id` (allows soft deletes)
- Validate parent exists in application code
- Consider `CHECK` constraints for data integrity:

```sql
-- Ensure active_flag and is_latest_version match
ALTER TABLE d_artifact
ADD CONSTRAINT chk_active_latest
CHECK (active_flag = is_latest_version);

-- Ensure to_ts is after from_ts
ALTER TABLE d_artifact
ADD CONSTRAINT chk_temporal_order
CHECK (to_ts IS NULL OR to_ts > from_ts);

-- Ensure version >= 1
ALTER TABLE d_artifact
ADD CONSTRAINT chk_version_positive
CHECK (version >= 1);
```

### 6. Security Considerations

**Presigned URL Expiration:**
- Upload URLs: 1 hour (3600 seconds)
- Download URLs: 1 hour (3600 seconds)
- Never expose S3 credentials to frontend

**Access Control:**
```typescript
// Check user permissions before generating presigned URL
async function checkArtifactAccess(userId: string, artifactId: string) {
  const artifact = await db.query.d_artifact.findFirst({
    where: eq(d_artifact.id, artifactId)
  });

  // Check RBAC permissions
  const hasAccess = await checkRBACPermission(
    userId,
    'artifact',
    artifactId,
    'view'
  );

  if (!hasAccess) throw new Error('Access denied');
}
```

**S3 Bucket Security:**
- Block all public access ✅
- Enable versioning ✅
- Enable encryption (AES-256) ✅
- Enable access logging ✅
- Restrict IAM permissions to specific buckets

### 7. Testing Checklist

**Unit Tests:**
- [ ] Version increment logic
- [ ] Active flag toggling
- [ ] Temporal date setting
- [ ] Object key generation
- [ ] Metadata-only update detection

**Integration Tests:**
- [ ] Create artifact v1
- [ ] Update metadata (no new version)
- [ ] Upload new version (v2, v3, ...)
- [ ] Get version history
- [ ] Download old version
- [ ] Delete artifact (soft delete)

**End-to-End Tests:**
- [ ] Complete create workflow (UI → API → S3)
- [ ] Complete update workflow (metadata only)
- [ ] Complete version workflow (new file upload)
- [ ] Version history display
- [ ] Download functionality

**SQL Verification Queries:**
```sql
-- After creating v2, verify only one active
SELECT version, active_flag, is_latest_version, to_ts
FROM d_artifact
WHERE id = {root_id} OR parent_artifact_id = {root_id}
ORDER BY version;
-- Expected: Only v2 has active_flag=true, v1 has to_ts set

-- Check no orphaned versions
SELECT * FROM d_artifact
WHERE parent_artifact_id IS NOT NULL
  AND parent_artifact_id NOT IN (SELECT id FROM d_artifact);
-- Expected: 0 rows

-- Check temporal integrity
SELECT * FROM d_artifact
WHERE to_ts IS NOT NULL AND to_ts <= from_ts;
-- Expected: 0 rows
```

---

## Summary

### ✅ What's Complete (Backend)

- **API Endpoints**: All 6 versioning endpoints implemented
- **Database Schema**: SCD Type 2 pattern ready (`db/21_d_artifact.ddl`)
- **S3 Integration**: Presigned URLs for upload/download
- **Version Tracking**: Temporal fields (`from_ts`, `to_ts`, `active_flag`)
- **DRY Architecture**: Unified S3 upload system (useS3Upload + S3AttachmentService)

### ⏳ What's Pending (Frontend)

- **ArtifactForm Component**: Reusable create/edit form (template provided)
- **ArtifactEditPage**: Version history UI (template provided)
- **Version Timeline**: Visual version history display
- **Testing**: End-to-end workflow testing

### 📊 Key Metrics

| Metric | Value |
|--------|-------|
| API Endpoints | 6 (all implemented) |
| Database Tables | 1 (`d_artifact`) |
| S3 Integration | Complete (DRY architecture) |
| Version Pattern | SCD Type 2 |
| Max Versions | Unlimited |
| Storage | PostgreSQL (metadata) + S3 (files) |

---

## Related Documentation

- **S3 Upload Architecture**: [S3_UPLOAD_DRY_ARCHITECTURE.md](./S3_UPLOAD_DRY_ARCHITECTURE.md)
- **Database Schema**: `db/21_d_artifact.ddl`
- **API Implementation**: `apps/api/src/modules/artifact/routes.ts`
- **S3 Service**: `apps/api/src/lib/s3-attachments.ts`
- **Frontend Hook**: `apps/web/src/lib/hooks/useS3Upload.ts`

---

**Last Updated:** 2025-10-23
**Status:** Backend Complete, Frontend Templates Provided
**Next Steps:** Implement ArtifactForm and ArtifactEditPage components
