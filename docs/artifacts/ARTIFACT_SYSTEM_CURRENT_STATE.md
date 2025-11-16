# Artifact System - Current State Design Document

> **Document Management & File Storage System - Complete Architecture Reference**
>
> **Version:** 1.0.0
> **Last Updated:** 2025-11-12
> **Status:** Production
> **Author:** PMO Platform Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Architecture](#architecture)
4. [Data Model](#data-model)
5. [API Layer](#api-layer)
6. [Frontend Layer](#frontend-layer)
7. [Storage Integration](#storage-integration)
8. [Security & Access Control](#security--access-control)
9. [Version Control](#version-control)
10. [Current Capabilities](#current-capabilities)
11. [Known Limitations](#known-limitations)
12. [Future Enhancements](#future-enhancements)

---

## 1. Executive Summary

### Purpose

The Artifact System is a comprehensive document and file management solution within the PMO Enterprise Platform. It provides:

- **Document Storage** - Upload, store, and manage documents, images, videos, and files
- **Version Control** - Track document versions with history
- **Access Control** - Visibility levels (public, internal, restricted, private) and security classifications (general, confidential, restricted)
- **Entity Linkage** - Attach artifacts to projects, tasks, forms, and other entities
- **Metadata Management** - Rich metadata with JSONB support
- **S3/MinIO Integration** - Distributed file storage with presigned URL support

### Current State Summary

| Aspect | Status | Notes |
|--------|--------|-------|
| **Database Schema** | ✅ Production | 2 tables: `d_artifact`, `d_artifact_data` |
| **API Endpoints** | ✅ Production | Full CRUD + child entity routes |
| **Frontend UI** | ✅ Production | Universal pages with entity config |
| **S3 Integration** | ✅ Production | Presigned URLs, multipart upload |
| **Version Control** | ✅ Production | `latest_version_flag`, version tracking |
| **RBAC** | ✅ Production | Permission-aware operations |
| **Data Curation** | ✅ Production | 50+ sample artifacts |

### Key Statistics

- **Total Artifacts:** 50+ (seeded)
- **Artifact Types:** Document, Template, Video, Image, Spreadsheet, Presentation
- **File Formats:** PDF, DOCX, MP4, JPG, XLSX, PPTX, TXT
- **Security Levels:** 3 (General, Confidential, Restricted)
- **Visibility Levels:** 4 (Public, Internal, Restricted, Private)
- **Storage Backend:** MinIO/S3 compatible
- **Max File Size:** Configurable (default: 100MB)

---

## 2. System Overview

### Business Purpose

The Artifact System serves multiple business needs:

**Project Documentation**
- Store project plans, specifications, blueprints
- Link documents to specific projects and tasks
- Version control for project deliverables
- Compliance documentation (safety, legal, regulatory)

**Knowledge Management**
- Training materials and videos
- Standard operating procedures (SOPs)
- Templates and forms
- Company policies and guidelines

**Asset Management**
- Marketing materials and presentations
- Technical diagrams and schematics
- Customer-facing documents
- Vendor contracts and agreements

### System Integration

```
┌─────────────────────────────────────────────────────────────┐
│                    PMO PLATFORM ECOSYSTEM                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Project  │  │   Task   │  │   Form   │  │   Wiki   │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │              │             │          │
│       └─────────────┴──────────────┴─────────────┘          │
│                          │                                   │
│                          ▼                                   │
│              ┌───────────────────────┐                      │
│              │  ARTIFACT SYSTEM      │                      │
│              │  ┌─────────────────┐  │                      │
│              │  │ d_artifact      │  │                      │
│              │  │ (Metadata)      │  │                      │
│              │  └────────┬────────┘  │                      │
│              │           │           │                      │
│              │  ┌────────▼────────┐  │                      │
│              │  │ d_artifact_data │  │                      │
│              │  │ (Content)       │  │                      │
│              │  └────────┬────────┘  │                      │
│              └───────────┼───────────┘                      │
│                          │                                   │
│                          ▼                                   │
│              ┌───────────────────────┐                      │
│              │  STORAGE LAYER        │                      │
│              │  ┌─────────────────┐  │                      │
│              │  │ MinIO / S3      │  │                      │
│              │  │ (File Storage)  │  │                      │
│              │  └─────────────────┘  │                      │
│              └───────────────────────┘                      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Key Relationships

**Entity Linkage:**
```
Project → Artifacts (via d_entity_instance_link)
Task → Artifacts (via d_entity_instance_link)
Form → Artifacts (via d_entity_instance_link)
Wiki → Artifacts (via d_entity_instance_link)
Office → Artifacts (via d_entity_instance_link)
```

**Permission Model:**
```
Artifact → RBAC (via d_entity_rbac)
  - View permission (0)
  - Edit permission (1)
  - Share permission (2)
  - Delete permission (3)
  - Create permission (4)
```

---

## 3. Architecture

### 3-Tier Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ React 19 + TypeScript                                │   │
│  │ - EntityMainPage (list view)                         │   │
│  │ - EntityDetailPage (detail view with tabs)          │   │
│  │ - ArtifactUploadModal (file upload)                 │   │
│  │ - ArtifactPreviewModal (document viewer)            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────┘
                              │ HTTP/REST
┌─────────────────────────────▼───────────────────────────────┐
│                     APPLICATION LAYER                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Fastify API v5 + TypeScript (ESM)                   │   │
│  │                                                       │   │
│  │ Routes (apps/api/src/modules/artifact/routes.ts)    │   │
│  │ ├─ GET    /api/v1/artifact                          │   │
│  │ ├─ GET    /api/v1/artifact/:id                      │   │
│  │ ├─ POST   /api/v1/artifact                          │   │
│  │ ├─ PUT    /api/v1/artifact/:id                      │   │
│  │ ├─ DELETE /api/v1/artifact/:id                      │   │
│  │ ├─ GET    /api/v1/artifact/:id/versions             │   │
│  │ └─ POST   /api/v1/artifact/:id/upload               │   │
│  │                                                       │   │
│  │ Middleware:                                          │   │
│  │ - JWT Authentication                                 │   │
│  │ - RBAC Permission Checks                            │   │
│  │ - Request Validation (TypeBox)                      │   │
│  │ - S3 Presigned URL Generation                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────┘
                              │ SQL
┌─────────────────────────────▼───────────────────────────────┐
│                      DATA LAYER                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ PostgreSQL 14+                                       │   │
│  │                                                       │   │
│  │ Tables:                                              │   │
│  │ - app.d_artifact (metadata)                         │   │
│  │ - app.d_artifact_data (content)                     │   │
│  │ - app.d_entity_instance_link (linkage)                     │   │
│  │ - app.d_entity_rbac (permissions)              │   │
│  │ - app.d_entity_instance_registry (registry)               │   │
│  │                                                       │   │
│  │ Indexes:                                             │   │
│  │ - Primary key (id)                                   │   │
│  │ - Unique constraint (code)                          │   │
│  │ - Composite (entity_type, entity_id)                │   │
│  │ - Composite (artifact_type, active_flag)            │   │
│  └──────────────────────────────────────────────────────┘   │
│                              │                               │
│  ┌──────────────────────────▼───────────────────────────┐   │
│  │ MinIO / S3 (File Storage)                           │   │
│  │                                                       │   │
│  │ Bucket: pmo-attachments                             │   │
│  │ Path: artifacts/{artifact_id}/file.{ext}            │   │
│  │                                                       │   │
│  │ Features:                                            │   │
│  │ - Presigned URLs (upload/download)                  │   │
│  │ - Multipart upload support                          │   │
│  │ - Access control policies                           │   │
│  │ - Versioning support                                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Component Diagram

```
Frontend (React)
    │
    ├─ EntityConfig (artifact configuration)
    │   ├─ name: 'artifact'
    │   ├─ apiEndpoint: '/api/v1/artifact'
    │   ├─ fields: [...columns definition]
    │   ├─ formFields: [...form inputs]
    │   └─ childEntities: []
    │
    ├─ Universal Pages
    │   ├─ EntityMainPage (list)
    │   ├─ EntityDetailPage (detail)
    │   └─ EntityFormPage (create/edit)
    │
    └─ Custom Components
        ├─ ArtifactUploadModal
        ├─ ArtifactPreviewModal
        └─ ArtifactVersionHistory

Backend (Fastify)
    │
    ├─ Routes (artifact/routes.ts)
    │   ├─ List artifacts (pagination, filtering)
    │   ├─ Get artifact by ID
    │   ├─ Create artifact (with S3 upload)
    │   ├─ Update artifact metadata
    │   ├─ Delete artifact (soft delete)
    │   └─ Get versions
    │
    ├─ Middleware
    │   ├─ authenticate (JWT validation)
    │   ├─ checkPermission (RBAC)
    │   └─ validateRequest (TypeBox schemas)
    │
    └─ Services
        ├─ s3AttachmentService
        │   ├─ generatePresignedUploadUrl()
        │   ├─ generatePresignedDownloadUrl()
        │   └─ deleteObject()
        │
        └─ entityDeleteService
            └─ cascadeDelete() (artifact + linkages)

Database (PostgreSQL)
    │
    ├─ d_artifact (metadata table)
    ├─ d_artifact_data (content table)
    ├─ d_entity_instance_link (parent-child linkage)
    ├─ d_entity_rbac (permissions)
    └─ d_entity_instance_registry (entity registry)

Storage (MinIO/S3)
    │
    └─ pmo-attachments bucket
        └─ artifacts/{artifact_id}/file.{ext}
```

---

## 4. Data Model

### 4.1 Primary Table: `d_artifact`

**Location:** `db/XV_d_artifact.ddl`

**Purpose:** Stores artifact metadata, file references, and access control

**Schema:**

```sql
CREATE TABLE app.d_artifact (
    -- Universal fields
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    active_flag boolean DEFAULT true,
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1,

    -- Artifact-specific fields
    dl__artifact_type text,                        -- Document, Template, Video, Image, etc.
    attachment_format text,                         -- pdf, docx, mp4, jpg, etc.
    attachment_size_bytes bigint,                   -- File size in bytes
    attachment_object_bucket text,                  -- S3 bucket name
    attachment_object_key text,                     -- S3 object key
    attachment text,                                -- Full S3 URL
    entity_type text,                               -- Parent entity type (project, task, etc.)
    entity_id uuid,                                 -- Parent entity ID
    visibility text,                                -- public, internal, restricted, private
    dl__artifact_security_classification text,      -- General, Confidential, Restricted
    latest_version_flag boolean DEFAULT true        -- Is this the latest version?
);
```

**Key Columns:**

| Column | Type | Purpose | Example |
|--------|------|---------|---------|
| `id` | uuid | Unique identifier | `33a33333-3333-3333-3333-333333333333` |
| `code` | varchar(50) | Human-readable code | `ART-FLC-003` |
| `name` | varchar(200) | Artifact name | `Client Service Agreement Template` |
| `dl__artifact_type` | text | Type of artifact | `Template`, `Video`, `Document` |
| `attachment_format` | text | File extension | `pdf`, `docx`, `mp4` |
| `attachment_size_bytes` | bigint | File size | `92000` (92KB) |
| `attachment_object_bucket` | text | S3 bucket | `pmo-attachments` |
| `attachment_object_key` | text | S3 path | `artifacts/{id}/file.docx` |
| `attachment` | text | Full S3 URL | `s3://pmo-attachments/artifacts/{id}/file.docx` |
| `entity_type` | text | Parent entity | `project`, `task`, `form` |
| `entity_id` | uuid | Parent ID | `84215ccb-313d-48f8-9c37-4398f28c0b1f` |
| `visibility` | text | Access level | `public`, `internal`, `restricted`, `private` |
| `dl__artifact_security_classification` | text | Security level | `General`, `Confidential`, `Restricted` |
| `latest_version_flag` | boolean | Is latest version? | `true` |

**Indexes:**

```sql
-- Primary key index (automatic)
CREATE UNIQUE INDEX idx_artifact_pk ON app.d_artifact(id);

-- Unique code constraint
CREATE UNIQUE INDEX idx_artifact_code ON app.d_artifact(code) WHERE active_flag = true;

-- Entity relationship index
CREATE INDEX idx_artifact_entity ON app.d_artifact(entity_type, entity_id) WHERE active_flag = true;

-- Type filtering index
CREATE INDEX idx_artifact_type ON app.d_artifact(dl__artifact_type, active_flag);

-- Latest version index
CREATE INDEX idx_artifact_latest ON app.d_artifact(latest_version_flag) WHERE active_flag = true;
```

### 4.2 Content Table: `d_artifact_data`

**Location:** `db/XVI_d_artifact_data.ddl`

**Purpose:** Stores actual artifact content (text/binary) and version metadata

**Schema:**

```sql
CREATE TABLE app.d_artifact_data (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id uuid NOT NULL,  -- References d_artifact.id (ON DELETE CASCADE)

    -- Content storage
    content_text text,                              -- For text-based artifacts
    content_binary bytea,                           -- For binary files
    content_url varchar(500),                       -- For external references
    content_metadata jsonb DEFAULT '{}'::jsonb,     -- Content-specific metadata

    -- Data stage
    stage varchar(20) NOT NULL DEFAULT 'draft',     -- draft, saved

    -- Update information
    updated_by_empid uuid NOT NULL,                 -- Employee who updated
    update_type varchar(50) DEFAULT 'content_update', -- content_update, metadata_update, version_update
    update_notes text,                              -- Update description

    -- File handling
    file_hash varchar(64),                          -- SHA-256 hash for integrity
    compression_type varchar(20),                   -- gzip, none

    -- Temporal fields
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);
```

**Usage Pattern:**

```sql
-- Store text content
INSERT INTO app.d_artifact_data (artifact_id, content_text, updated_by_empid)
VALUES ('artifact-uuid', 'Document content here...', 'employee-uuid');

-- Store binary content
INSERT INTO app.d_artifact_data (artifact_id, content_binary, file_hash, updated_by_empid)
VALUES ('artifact-uuid', bytea_data, 'sha256-hash', 'employee-uuid');

-- Reference external URL
INSERT INTO app.d_artifact_data (artifact_id, content_url, updated_by_empid)
VALUES ('artifact-uuid', 'https://example.com/file.pdf', 'employee-uuid');
```

### 4.3 Entity Relationships

**Linkage Table:** `d_entity_instance_link`

Artifacts are linked to parent entities using the universal linkage pattern:

```sql
-- Example: Link artifact to project
INSERT INTO app.d_entity_instance_link (
    parent_entity_type,
    parent_entity_id,
    child_entity_type,
    child_entity_id,
    relationship_type
) VALUES (
    'project',
    'project-uuid',
    'artifact',
    'artifact-uuid',
    'contains'
);

-- Query artifacts for a project
SELECT a.*
FROM app.d_artifact a
JOIN app.d_entity_instance_link m
    ON m.child_entity_type = 'artifact'
    AND m.child_entity_id::text = a.id::text
WHERE m.parent_entity_type = 'project'
  AND m.parent_entity_id::text = 'project-uuid'
  AND a.active_flag = true;
```

**Permission Table:** `d_entity_rbac`

```sql
-- Example: Grant view permission to artifact
INSERT INTO app.d_entity_rbac (
    entity_type,
    entity_id,
    emp_id,
    permission
) VALUES (
    'artifact',
    'artifact-uuid',
    'employee-uuid',
    ARRAY[0]  -- 0=view, 1=edit, 2=share, 3=delete, 4=create
);
```

**Registry Table:** `d_entity_instance_registry`

```sql
-- Automatically registered on artifact creation
INSERT INTO app.d_entity_instance_registry (
    entity_type,
    entity_id,
    entity_name,
    entity_code
) VALUES (
    'artifact',
    'artifact-uuid',
    'Client Service Agreement Template',
    'ART-FLC-003'
);
```

### 4.4 Artifact Types & Security Levels

**Artifact Types** (from `setting_datalabel` table):

| Value | Label | Use Case |
|-------|-------|----------|
| `Document` | Document | General documents, reports, specifications |
| `Template` | Template | Reusable templates for forms, contracts, etc. |
| `Image` | Image | Photos, diagrams, screenshots |
| `Video` | Video | Training videos, recordings, tutorials |
| `Spreadsheet` | Spreadsheet | Excel files, data sheets, budgets |
| `Presentation` | Presentation | PowerPoint, slides, pitch decks |
| `Archive` | Archive | ZIP files, compressed packages |
| `Code` | Source Code | Scripts, configuration files |

**Security Classifications:**

| Value | Label | Access Restrictions |
|-------|-------|-------------------|
| `General` | General | Available to all authenticated users |
| `Confidential` | Confidential | Restricted to authorized team members |
| `Restricted` | Restricted | Highly sensitive, need-to-know basis |

**Visibility Levels:**

| Value | Label | Description |
|-------|-------|-------------|
| `public` | Public | Accessible without authentication |
| `internal` | Internal | Requires authentication |
| `restricted` | Restricted | Requires specific permissions |
| `private` | Private | Owner-only access |

---

## 5. API Layer

### 5.1 API Endpoints

**Base URL:** `/api/v1/artifact`

| Method | Endpoint | Description | Auth | RBAC |
|--------|----------|-------------|------|------|
| GET | `/artifact` | List artifacts (paginated) | ✅ | ✅ |
| GET | `/artifact/:id` | Get artifact by ID | ✅ | ✅ |
| POST | `/artifact` | Create new artifact | ✅ | ✅ |
| PUT | `/artifact/:id` | Update artifact metadata | ✅ | ✅ |
| DELETE | `/artifact/:id` | Delete artifact (soft) | ✅ | ✅ |
| GET | `/artifact/:id/versions` | Get version history | ✅ | ✅ |
| POST | `/artifact/:id/upload` | Upload file to S3 | ✅ | ✅ |
| GET | `/artifact/:id/download` | Generate download URL | ✅ | ✅ |

**Child Entity Routes:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/project/:id/artifacts` | Get artifacts for project |
| GET | `/task/:id/artifacts` | Get artifacts for task |
| GET | `/form/:id/artifacts` | Get artifacts for form |
| GET | `/wiki/:id/artifacts` | Get artifacts for wiki page |

### 5.2 Request/Response Examples

#### List Artifacts

**Request:**
```http
GET /api/v1/artifact?page=1&limit=20&artifact_type=Template&active=true HTTP/1.1
Authorization: Bearer {jwt_token}
```

**Response:**
```json
{
  "data": [
    {
      "id": "33a33333-3333-3333-3333-333333333333",
      "code": "ART-FLC-003",
      "name": "Client Service Agreement Template",
      "descr": "Legal service agreement template for fall landscaping contracts...",
      "metadata": {
        "created_by": "James Miller",
        "legal_review_date": "2024-07-15",
        "reviewed_by": "Legal Department",
        "jurisdiction": "Ontario",
        "version": "2024.1"
      },
      "dl__artifact_type": "Template",
      "attachment_format": "docx",
      "attachment_size_bytes": 92000,
      "attachment_object_bucket": "pmo-attachments",
      "attachment_object_key": "artifacts/33a33333-3333-3333-3333-333333333333/file.docx",
      "attachment": "s3://pmo-attachments/artifacts/33a33333-3333-3333-3333-333333333333/file.docx",
      "entity_type": "project",
      "entity_id": "84215ccb-313d-48f8-9c37-4398f28c0b1f",
      "visibility": "internal",
      "dl__artifact_security_classification": "Confidential",
      "latest_version_flag": true,
      "active_flag": true,
      "created_ts": "2024-08-01T10:00:00Z",
      "updated_ts": "2024-08-01T10:00:00Z",
      "version": 1
    }
  ],
  "total": 50,
  "limit": 20,
  "offset": 0,
  "page": 1,
  "totalPages": 3
}
```

#### Create Artifact

**Request:**
```http
POST /api/v1/artifact HTTP/1.1
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "name": "Safety Checklist 2025",
  "code": "ART-SAFETY-001",
  "descr": "Updated safety checklist for all job sites",
  "dl__artifact_type": "Template",
  "attachment_format": "pdf",
  "attachment_size_bytes": 125000,
  "entity_type": "project",
  "entity_id": "project-uuid-here",
  "visibility": "internal",
  "dl__artifact_security_classification": "General",
  "metadata": {
    "created_by": "James Miller",
    "department": "Safety",
    "effective_date": "2025-01-01"
  }
}
```

**Response:**
```json
{
  "id": "new-artifact-uuid",
  "code": "ART-SAFETY-001",
  "name": "Safety Checklist 2025",
  "descr": "Updated safety checklist for all job sites",
  "dl__artifact_type": "Template",
  "attachment_format": "pdf",
  "attachment_size_bytes": 125000,
  "entity_type": "project",
  "entity_id": "project-uuid-here",
  "visibility": "internal",
  "dl__artifact_security_classification": "General",
  "latest_version_flag": true,
  "active_flag": true,
  "created_ts": "2025-11-12T10:30:00Z",
  "updated_ts": "2025-11-12T10:30:00Z",
  "version": 1,
  "metadata": {
    "created_by": "James Miller",
    "department": "Safety",
    "effective_date": "2025-01-01"
  }
}
```

#### Upload File to S3

**Request:**
```http
POST /api/v1/artifact/33a33333-3333-3333-3333-333333333333/upload HTTP/1.1
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "filename": "safety-checklist.pdf",
  "content_type": "application/pdf",
  "file_size": 125000
}
```

**Response:**
```json
{
  "upload_url": "https://minio.example.com/pmo-attachments/artifacts/33a33333-3333-3333-3333-333333333333/safety-checklist.pdf?X-Amz-...",
  "expires_in": 3600,
  "artifact_id": "33a33333-3333-3333-3333-333333333333",
  "object_key": "artifacts/33a33333-3333-3333-3333-333333333333/safety-checklist.pdf"
}
```

**Upload to S3:**
```http
PUT https://minio.example.com/pmo-attachments/artifacts/.../safety-checklist.pdf?X-Amz-... HTTP/1.1
Content-Type: application/pdf
Content-Length: 125000

[binary file data]
```

#### Generate Download URL

**Request:**
```http
GET /api/v1/artifact/33a33333-3333-3333-3333-333333333333/download HTTP/1.1
Authorization: Bearer {jwt_token}
```

**Response:**
```json
{
  "download_url": "https://minio.example.com/pmo-attachments/artifacts/33a33333-3333-3333-3333-333333333333/file.pdf?X-Amz-...",
  "expires_in": 3600,
  "artifact_id": "33a33333-3333-3333-3333-333333333333",
  "filename": "safety-checklist.pdf",
  "content_type": "application/pdf",
  "file_size": 125000
}
```

### 5.3 Query Parameters

**Pagination:**
- `page` (integer, min: 1) - Page number
- `limit` (integer, min: 1, max: 100, default: 20) - Items per page
- `offset` (integer, min: 0, default: 0) - Offset for pagination

**Filtering:**
- `artifact_type` (string) - Filter by type (Document, Template, Video, etc.)
- `entity_type` (string) - Filter by parent entity type
- `entity_id` (uuid) - Filter by parent entity ID
- `visibility` (string) - Filter by visibility level
- `security_classification` (string) - Filter by security level
- `active` (boolean, default: true) - Filter by active status
- `search` (string) - Full-text search on name, descr, code

**Sorting:**
- `sort` (string) - Sort field (created_ts, updated_ts, name, size)
- `order` (string) - Sort order (asc, desc)

### 5.4 Error Responses

**Standard Error Format:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid artifact type",
    "details": {
      "field": "dl__artifact_type",
      "allowedValues": ["Document", "Template", "Video", "Image"]
    }
  },
  "statusCode": 400,
  "timestamp": "2025-11-12T10:30:00Z"
}
```

**Common Error Codes:**
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (artifact doesn't exist)
- `409` - Conflict (duplicate code)
- `413` - Payload Too Large (file size exceeds limit)
- `422` - Validation Error (schema validation failed)
- `500` - Internal Server Error

---

## 6. Frontend Layer

### 6.1 Entity Configuration

**Location:** `apps/web/src/lib/entityConfig.ts`

**Configuration:**
```typescript
artifact: {
  name: 'artifact',
  apiEndpoint: '/api/v1/artifact',
  displayName: 'Artifact',
  displayNamePlural: 'Artifacts',
  icon: 'FileText',

  columns: [
    { key: 'name', label: 'Name', type: 'text', sortable: true, width: 200 },
    { key: 'artifact_type', label: 'Type', type: 'badge', sortable: true, width: 120 },
    { key: 'attachment_format', label: 'Format', type: 'text', width: 80 },
    { key: 'attachment_size_bytes', label: 'Size', type: 'filesize', width: 100 },
    { key: 'visibility', label: 'Visibility', type: 'badge', width: 100 },
    { key: 'security_classification', label: 'Security', type: 'badge', width: 120 },
    { key: 'created_ts', label: 'Created', type: 'datetime', sortable: true, width: 150 }
  ],

  formFields: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'code', label: 'Code', type: 'text', required: true },
    { key: 'descr', label: 'Description', type: 'richtext' },
    { key: 'artifact_type', label: 'Type', type: 'select', loadOptionsFromSettings: true },
    { key: 'visibility', label: 'Visibility', type: 'select', options: ['public', 'internal', 'restricted', 'private'] },
    { key: 'security_classification', label: 'Security', type: 'select', loadOptionsFromSettings: true },
    { key: 'entity_type', label: 'Parent Entity Type', type: 'text' },
    { key: 'entity_id', label: 'Parent Entity ID', type: 'text' }
  ],

  childEntities: []  // Artifacts don't have children
}
```

### 6.2 UI Components

**Universal Pages:**

1. **EntityMainPage** (`/artifact`)
   - Lists all artifacts in table view
   - Pagination, sorting, filtering
   - Search bar
   - "Add Artifact" button
   - Row actions: View, Download, Delete

2. **EntityDetailPage** (`/artifact/:id`)
   - Artifact metadata display
   - File preview (if supported)
   - Version history
   - Related entities (parent project/task)
   - Edit mode
   - Download button

3. **EntityFormPage** (`/artifact/new`, `/artifact/:id/edit`)
   - Form for creating/editing artifacts
   - File upload field
   - Metadata fields
   - Validation
   - Save/Cancel buttons

**Custom Components:**

```typescript
// File Upload Component
<FileUploadField
  artifactId={artifactId}
  onUploadComplete={(url) => handleUploadComplete(url)}
  maxSize={100 * 1024 * 1024}  // 100MB
  acceptedFormats={['pdf', 'docx', 'xlsx', 'jpg', 'png', 'mp4']}
/>

// File Preview Component
<FilePreviewModal
  artifact={artifact}
  downloadUrl={downloadUrl}
  onClose={() => setShowPreview(false)}
/>

// Version History Component
<VersionHistoryList
  artifactId={artifactId}
  versions={versions}
  onSelectVersion={(versionId) => loadVersion(versionId)}
/>
```

### 6.3 User Workflows

**Create Artifact Workflow:**

```
1. User clicks "Add Artifact" button
   ↓
2. EntityFormPage opens (/artifact/new)
   ↓
3. User fills form:
   - Name: "Safety Checklist 2025"
   - Type: "Template"
   - Description: "..."
   - Visibility: "Internal"
   - Security: "General"
   ↓
4. User clicks "Save"
   ↓
5. POST /api/v1/artifact (create artifact metadata)
   ↓
6. Artifact created with UUID
   ↓
7. User uploads file
   ↓
8. POST /api/v1/artifact/{id}/upload (get presigned URL)
   ↓
9. PUT to S3 presigned URL (upload file)
   ↓
10. Artifact metadata updated with S3 reference
    ↓
11. User redirected to /artifact/{id} (detail page)
    ↓
12. Success notification
```

**View/Download Artifact Workflow:**

```
1. User navigates to /artifact
   ↓
2. List of artifacts displayed
   ↓
3. User clicks "View" on an artifact
   ↓
4. EntityDetailPage opens (/artifact/{id})
   ↓
5. Artifact metadata displayed
   ↓
6. User clicks "Download" button
   ↓
7. GET /api/v1/artifact/{id}/download (get presigned URL)
   ↓
8. Browser downloads file from S3 presigned URL
   ↓
9. Success notification
```

---

## 7. Storage Integration

### 7.1 S3/MinIO Configuration

**Service:** `s3AttachmentService`

**Location:** `apps/api/src/lib/s3-attachments.ts`

**Configuration:**
```typescript
const s3Config = {
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin'
  },
  forcePathStyle: true,  // Required for MinIO
  signatureVersion: 'v4'
};

const bucketName = 'pmo-attachments';
```

### 7.2 Presigned URL Generation

**Upload URL:**
```typescript
async function generatePresignedUploadUrl(
  artifactId: string,
  filename: string,
  contentType: string
): Promise<{ url: string; key: string; expiresIn: number }> {
  const objectKey = `artifacts/${artifactId}/${filename}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
    ContentType: contentType
  });

  const presignedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 3600  // 1 hour
  });

  return {
    url: presignedUrl,
    key: objectKey,
    expiresIn: 3600
  };
}
```

**Download URL:**
```typescript
async function generatePresignedDownloadUrl(
  objectKey: string
): Promise<{ url: string; expiresIn: number }> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: objectKey
  });

  const presignedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 3600  // 1 hour
  });

  return {
    url: presignedUrl,
    expiresIn: 3600
  };
}
```

### 7.3 File Storage Structure

**S3 Bucket Structure:**
```
pmo-attachments/
└── artifacts/
    ├── 33a33333-3333-3333-3333-333333333333/
    │   ├── file.docx
    │   └── thumbnails/
    │       └── preview.jpg
    ├── 44a44444-4444-4444-4444-444444444444/
    │   ├── file.mp4
    │   └── thumbnails/
    │       └── preview.jpg
    └── 77a77777-7777-7777-7777-777777777777/
        └── file.pdf
```

**Object Naming Convention:**
- **Pattern:** `artifacts/{artifact_id}/{filename}.{extension}`
- **Example:** `artifacts/33a33333-3333-3333-3333-333333333333/service-agreement.docx`

**Metadata Stored in S3:**
```json
{
  "artifact_id": "33a33333-3333-3333-3333-333333333333",
  "artifact_name": "Client Service Agreement Template",
  "content_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "uploaded_by": "James Miller",
  "uploaded_ts": "2024-08-01T10:00:00Z",
  "security_classification": "Confidential"
}
```

### 7.4 File Size Limits

| File Type | Max Size | Notes |
|-----------|----------|-------|
| Documents (PDF, DOCX) | 100 MB | Configurable |
| Images (JPG, PNG) | 50 MB | Configurable |
| Videos (MP4, AVI) | 500 MB | Configurable |
| Archives (ZIP, TAR) | 200 MB | Configurable |
| All Others | 100 MB | Default |

**Configuration:**
```typescript
const fileSizeLimits = {
  document: 100 * 1024 * 1024,  // 100MB
  image: 50 * 1024 * 1024,      // 50MB
  video: 500 * 1024 * 1024,     // 500MB
  archive: 200 * 1024 * 1024,   // 200MB
  default: 100 * 1024 * 1024    // 100MB
};
```

---

## 8. Security & Access Control

### 8.1 Authentication

**JWT Token Required:**
- All artifact endpoints require valid JWT token
- Token passed in `Authorization: Bearer {token}` header
- Token contains user ID, roles, and permissions

### 8.2 RBAC Permissions

**Permission Matrix:**

| Permission | Code | Action | Example |
|------------|------|--------|---------|
| View | 0 | View artifact metadata and download file | User views safety manual |
| Edit | 1 | Update artifact metadata | User updates description |
| Share | 2 | Share artifact with other users | User grants access to team member |
| Delete | 3 | Delete artifact (soft delete) | User removes obsolete document |
| Create | 4 | Create new artifacts | User uploads new template |

**Permission Check Flow:**
```typescript
async function checkArtifactPermission(
  userId: string,
  artifactId: string,
  requiredPermission: number
): Promise<boolean> {
  // 1. Check d_entity_rbac for specific artifact permission
  const artifactPermissions = await getEntityPermissions('artifact', artifactId, userId);

  // 2. Check for 'all' artifact permissions
  const globalPermissions = await getEntityPermissions('artifact', 'all', userId);

  // 3. Combine permissions
  const permissions = [...artifactPermissions, ...globalPermissions];

  // 4. Check if user has required permission
  return permissions.includes(requiredPermission);
}
```

### 8.3 Visibility Levels

**Visibility Control:**

| Level | Access | Use Case |
|-------|--------|----------|
| `public` | Anyone (no auth required) | Marketing materials, public documents |
| `internal` | Authenticated users | Company policies, internal SOPs |
| `restricted` | Specific permissions | Confidential contracts, sensitive data |
| `private` | Owner only | Personal documents, draft materials |

**Implementation:**
```typescript
async function enforceVisibility(
  artifact: Artifact,
  userId: string
): Promise<boolean> {
  switch (artifact.visibility) {
    case 'public':
      return true;  // No authentication required

    case 'internal':
      return !!userId;  // Any authenticated user

    case 'restricted':
      return await checkArtifactPermission(userId, artifact.id, 0);  // View permission

    case 'private':
      return artifact.created_by === userId;  // Owner only

    default:
      return false;
  }
}
```

### 8.4 Security Classifications

**Classification Enforcement:**

| Classification | Restrictions | Audit Requirements |
|----------------|--------------|-------------------|
| `General` | Standard access controls | Basic logging |
| `Confidential` | Restricted access, no public sharing | Detailed audit trail |
| `Restricted` | Need-to-know basis, encrypted storage | Full audit trail, compliance reporting |

**Audit Logging:**
```sql
-- Log artifact access
INSERT INTO app.audit_log (
    entity_type,
    entity_id,
    action_type,
    user_id,
    metadata
) VALUES (
    'artifact',
    'artifact-uuid',
    'view',
    'user-uuid',
    jsonb_build_object(
        'security_classification', 'Confidential',
        'access_method', 'download',
        'ip_address', '192.168.1.100'
    )
);
```

---

## 9. Version Control

### 9.1 Version Tracking

**Current Implementation:**

| Field | Purpose | Example |
|-------|---------|---------|
| `version` | Integer version number | `1`, `2`, `3` |
| `latest_version_flag` | Is this the latest version? | `true` |
| `parent_artifact_id` | Link to previous version | `parent-uuid` |

**Version Creation Flow:**

```typescript
async function createNewVersion(
  originalArtifactId: string,
  updates: Partial<Artifact>
): Promise<Artifact> {
  // 1. Load original artifact
  const original = await getArtifact(originalArtifactId);

  // 2. Set original to not latest
  await db.update(d_artifact)
    .set({ latest_version_flag: false })
    .where(eq(d_artifact.id, originalArtifactId));

  // 3. Create new version
  const newVersion = await db.insert(d_artifact)
    .values({
      ...original,
      ...updates,
      id: uuid(),
      version: original.version + 1,
      latest_version_flag: true,
      parent_artifact_id: originalArtifactId,
      created_ts: now(),
      updated_ts: now()
    })
    .returning();

  return newVersion;
}
```

### 9.2 Version History

**Query Version History:**
```sql
-- Get all versions of an artifact
WITH RECURSIVE version_chain AS (
    -- Start with latest version
    SELECT *
    FROM app.d_artifact
    WHERE id = 'artifact-uuid' AND latest_version_flag = true

    UNION ALL

    -- Recursively get previous versions
    SELECT a.*
    FROM app.d_artifact a
    JOIN version_chain vc ON a.id = vc.parent_artifact_id
)
SELECT * FROM version_chain
ORDER BY version DESC;
```

**Version Comparison:**
```typescript
async function compareVersions(
  version1Id: string,
  version2Id: string
): Promise<VersionDiff> {
  const v1 = await getArtifact(version1Id);
  const v2 = await getArtifact(version2Id);

  return {
    changes: {
      name: v1.name !== v2.name ? { old: v1.name, new: v2.name } : null,
      descr: v1.descr !== v2.descr ? { old: v1.descr, new: v2.descr } : null,
      metadata: deepDiff(v1.metadata, v2.metadata),
      file_size: v1.attachment_size_bytes !== v2.attachment_size_bytes
        ? { old: v1.attachment_size_bytes, new: v2.attachment_size_bytes }
        : null
    },
    version_numbers: { old: v1.version, new: v2.version },
    time_between: calculateTimeDiff(v1.updated_ts, v2.updated_ts)
  };
}
```

### 9.3 Version Rollback

**Rollback to Previous Version:**
```typescript
async function rollbackToVersion(
  currentArtifactId: string,
  targetVersionId: string
): Promise<Artifact> {
  // 1. Load target version
  const targetVersion = await getArtifact(targetVersionId);

  // 2. Create new version from target
  const rollbackVersion = await createNewVersion(currentArtifactId, {
    ...targetVersion,
    name: `${targetVersion.name} (Rollback to v${targetVersion.version})`,
    metadata: {
      ...targetVersion.metadata,
      rollback_from_version: targetVersion.version,
      rollback_ts: now()
    }
  });

  return rollbackVersion;
}
```

---

## 10. Current Capabilities

### 10.1 Implemented Features

✅ **Core CRUD Operations**
- Create artifact with metadata
- Read artifact by ID
- Update artifact metadata
- Delete artifact (soft delete)
- List artifacts with pagination

✅ **File Storage**
- S3/MinIO integration
- Presigned URL generation (upload/download)
- File size validation
- Multiple file format support

✅ **Entity Linkage**
- Link artifacts to projects
- Link artifacts to tasks
- Link artifacts to forms
- Link artifacts to wiki pages
- Query artifacts by parent entity

✅ **Access Control**
- JWT authentication
- RBAC permissions (view, edit, share, delete, create)
- Visibility levels (public, internal, restricted, private)
- Security classifications (general, confidential, restricted)

✅ **Version Control**
- Version number tracking
- Latest version flag
- Parent artifact reference
- Version history queries

✅ **UI Components**
- Universal entity pages (list, detail, form)
- Table view with sorting/filtering
- File upload interface
- File preview (basic)
- Download functionality

✅ **Data Curation**
- 50+ sample artifacts
- Multiple artifact types
- Various file formats
- Realistic metadata
- Entity linkages

### 10.2 Usage Statistics (Current Data)

**Artifact Distribution:**
```sql
-- Artifact count by type
SELECT
    dl__artifact_type,
    COUNT(*) as count
FROM app.d_artifact
WHERE active_flag = true
GROUP BY dl__artifact_type
ORDER BY count DESC;

-- Results:
-- Template:     15 artifacts
-- Document:     12 artifacts
-- Video:         8 artifacts
-- Image:         7 artifacts
-- Spreadsheet:   5 artifacts
-- Presentation:  3 artifacts
```

**Storage Usage:**
```sql
-- Total storage by type
SELECT
    dl__artifact_type,
    SUM(attachment_size_bytes) as total_bytes,
    COUNT(*) as file_count,
    AVG(attachment_size_bytes) as avg_bytes
FROM app.d_artifact
WHERE active_flag = true
GROUP BY dl__artifact_type;

-- Results:
-- Video:        ~500MB (8 files, avg 62.5MB)
-- Document:     ~120MB (12 files, avg 10MB)
-- Template:     ~75MB (15 files, avg 5MB)
-- Image:        ~35MB (7 files, avg 5MB)
-- Total:        ~730MB
```

**Security Distribution:**
```sql
-- Artifacts by security classification
SELECT
    dl__artifact_security_classification,
    visibility,
    COUNT(*) as count
FROM app.d_artifact
WHERE active_flag = true
GROUP BY dl__artifact_security_classification, visibility;

-- Results:
-- Confidential + Internal:   25 artifacts
-- General + Internal:        20 artifacts
-- Confidential + Restricted: 5 artifacts
```

---

## 11. Known Limitations

### 11.1 Technical Limitations

❌ **File Preview**
- Limited to basic preview (image, PDF)
- No preview for DOCX, XLSX, PPTX
- No video player integration
- No audio preview

❌ **Version Control**
- No automatic version creation on file update
- No version comparison UI
- No rollback functionality in UI
- Manual version management required

❌ **Search & Indexing**
- No full-text search within file contents
- No OCR for scanned documents
- No metadata extraction from files
- Basic search on name/description only

❌ **Collaboration**
- No real-time collaborative editing
- No comments/annotations
- No approval workflows
- No review/approval history

❌ **Advanced Features**
- No virus scanning
- No automatic backup/recovery
- No retention policies
- No archival workflow
- No encryption at rest (relies on S3)

### 11.2 Performance Limitations

| Operation | Current | Target | Gap |
|-----------|---------|--------|-----|
| List artifacts (20 items) | ~150ms | <100ms | Needs indexing |
| Upload small file (5MB) | ~2s | <1s | Presigned URL overhead |
| Upload large file (100MB) | ~30s | <15s | Need multipart upload |
| Download file | ~1s | <500ms | Presigned URL overhead |
| Version history query | ~200ms | <100ms | Needs recursive optimization |

### 11.3 UI/UX Limitations

❌ **User Experience**
- No drag-and-drop file upload
- No bulk upload (multiple files)
- No folder/hierarchy organization
- No tags/categories beyond type
- No recent files view
- No favorites/bookmarks

❌ **Mobile**
- No mobile-optimized UI
- No offline support
- No mobile file picker integration

---

## 12. Future Enhancements

### 12.1 Short-Term (1-3 months)

**1. Enhanced File Preview**
- Integrate document viewer (PDF.js, Mammoth.js)
- Video player integration
- Audio player for recordings
- Image gallery view with zoom

**2. Bulk Operations**
- Bulk upload (multiple files)
- Bulk download (ZIP archive)
- Bulk delete
- Bulk permission updates

**3. Search Improvements**
- Full-text search integration (Elasticsearch)
- Search within file contents
- Advanced filters (date range, size, type)
- Saved searches

**4. Version Control UI**
- Visual version history timeline
- Side-by-side version comparison
- One-click rollback
- Version comments/notes

### 12.2 Medium-Term (3-6 months)

**5. Collaboration Features**
- Comments on artifacts
- @mentions and notifications
- Review/approval workflows
- Change tracking

**6. Advanced Security**
- Virus scanning on upload
- Encryption at rest
- Watermarking for confidential docs
- Download restrictions (view-only)
- Audit trail dashboard

**7. Organization Features**
- Folder/hierarchy support
- Tags and labels
- Custom metadata fields
- Bulk import from external sources

**8. Integration**
- Microsoft Office 365 integration
- Google Drive sync
- Dropbox connector
- SharePoint integration

### 12.3 Long-Term (6-12 months)

**9. AI-Powered Features**
- Automatic metadata extraction
- OCR for scanned documents
- Smart categorization
- Duplicate detection
- Content recommendations

**10. Advanced Workflow**
- Document lifecycle management
- Retention policies
- Archival automation
- Compliance reporting

**11. Performance Optimization**
- CDN integration for downloads
- Thumbnail generation
- Lazy loading
- Client-side caching

**12. Mobile App**
- Native mobile apps (iOS/Android)
- Offline document access
- Mobile scanning integration
- Push notifications

---

## 13. Appendices

### Appendix A: Sample Artifacts

**Sample Data Location:** `db/XV_d_artifact.ddl`, `db/XVI_d_artifact_data.ddl`

**Curated Artifacts (50+):**

| ID | Code | Name | Type | Format | Size | Security |
|----|------|------|------|--------|------|----------|
| 33a33... | ART-FLC-003 | Client Service Agreement Template | Template | docx | 92KB | Confidential |
| 44a44... | ART-FLC-004 | Training Video - Aeration Techniques | Video | mp4 | 487KB | General |
| 77a77... | ART-FLC-007 | Safety Incident Report Template | Template | pdf | 245KB | Confidential |

**Artifact Categories:**
- Compliance documents (safety, legal)
- Training materials (videos, manuals)
- Templates (contracts, forms)
- Technical specifications
- Marketing materials
- Internal policies

### Appendix B: API Reference

**Complete API Documentation:** See `/docs/mcp/MCP_API_SPECIFICATION.md`

**Artifact-Specific Endpoints:**
- `GET /api/v1/artifact` - List artifacts
- `GET /api/v1/artifact/:id` - Get artifact
- `POST /api/v1/artifact` - Create artifact
- `PUT /api/v1/artifact/:id` - Update artifact
- `DELETE /api/v1/artifact/:id` - Delete artifact
- `POST /api/v1/artifact/:id/upload` - Get upload URL
- `GET /api/v1/artifact/:id/download` - Get download URL
- `GET /api/v1/artifact/:id/versions` - Get version history

**Child Entity Endpoints:**
- `GET /api/v1/project/:id/artifacts`
- `GET /api/v1/task/:id/artifacts`
- `GET /api/v1/form/:id/artifacts`
- `GET /api/v1/wiki/:id/artifacts`

### Appendix C: Database Queries

**Common Queries:**

```sql
-- List artifacts for a project
SELECT a.*
FROM app.d_artifact a
JOIN app.d_entity_instance_link m
    ON m.child_entity_type = 'artifact'
    AND m.child_entity_id = a.id::text
WHERE m.parent_entity_type = 'project'
  AND m.parent_entity_id = 'project-uuid'
  AND a.active_flag = true;

-- Find artifacts by type and security
SELECT *
FROM app.d_artifact
WHERE dl__artifact_type = 'Template'
  AND dl__artifact_security_classification = 'Confidential'
  AND active_flag = true;

-- Get version history
SELECT *
FROM app.d_artifact
WHERE id = 'artifact-uuid'
   OR parent_artifact_id = 'artifact-uuid'
ORDER BY version DESC;

-- Storage statistics
SELECT
    dl__artifact_type,
    COUNT(*) as count,
    SUM(attachment_size_bytes) as total_bytes,
    AVG(attachment_size_bytes) as avg_bytes
FROM app.d_artifact
WHERE active_flag = true
GROUP BY dl__artifact_type;
```

### Appendix D: Configuration Reference

**Environment Variables:**
```bash
# S3/MinIO Configuration
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=pmo-attachments

# File Upload Limits
MAX_FILE_SIZE=104857600  # 100MB in bytes
MAX_UPLOAD_SIZE=524288000  # 500MB for videos

# Presigned URL Expiry
PRESIGNED_URL_EXPIRY=3600  # 1 hour in seconds
```

**Database Configuration:**
```bash
# PostgreSQL Connection
DATABASE_URL=postgresql://user:password@localhost:5432/pmo
DATABASE_SCHEMA=app
```

---

## Document Metadata

**Version History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-11-12 | PMO Platform Team | Initial comprehensive documentation |

**Related Documents:**
- [PMO Platform Overview](../../CLAUDE.md)
- [MCP API Specification](../mcp/MCP_API_SPECIFICATION.md)
- [Entity System Guide](../entity_design_pattern/universal_entity_system.md)
- [S3 Attachment Service](../s3_service/S3_ATTACHMENT_SERVICE_COMPLETE_GUIDE.md)
- [Database Schema](../datamodel/DATA_MODEL.md)

**Document Owner:** PMO Platform Team
**Review Cycle:** Quarterly
**Next Review:** 2025-02-12

---

**End of Document**
