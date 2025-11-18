# Form System - Complete Guide

**Version:** 3.0.0
**Last Updated:** 2025-11-12
**Status:** Production Ready

## Overview

The **Form System** provides a schema-driven, multi-step form builder with JSONB storage, S3 file handling, public submissions, and RBAC integration. Forms are regular entities in the PMO platform that can be linked to projects, tasks, clients, and other entities.

### Key Features

✅ **JSONB Schema Storage** - All field definitions in `form_schema` JSONB column
✅ **Multi-Step Workflows** - Wizard-style forms with step-by-step validation
✅ **Public Anonymous Submissions** - Unauthenticated form fills via `shared_url`
✅ **S3 File Storage** - Files/signatures stored as S3 keys (~100 bytes vs MB+ base64)
✅ **In-Place Versioning** - `version++` on schema changes, stable public URLs
✅ **Entity Integration** - Forms linked via `entity_instance_link` table
✅ **RBAC Enforcement** - Standard permission system `[0,1,2,3,4,5]`

### Form Lifecycle

```
CREATE → BUILD → PUBLISH → COLLECT → APPROVE → ARCHIVE
```

**Submission Flow:**
```
draft → submitted → approved/rejected → completed
```

---

## Database Schema

### Table: d_form_head (Form Definitions)

**Purpose:** Store form templates with JSONB schema

```sql
CREATE TABLE app.d_form_head (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(100) NOT NULL,                      -- URL-safe identifier
    code varchar(50) NOT NULL,                       -- Business code (FORM-{timestamp})
    name varchar(200) NOT NULL,                      -- Display name
    descr text,                                      -- Description

    -- URLs
    internal_url varchar(500),                       -- Authenticated: /form/{id}
    shared_url varchar(500),                         -- Public: /public/form/{id}

    -- Form Configuration
    form_type varchar(50) DEFAULT 'multi_step',      -- multi_step | single_page
    form_schema jsonb DEFAULT '{"steps":[]}'::jsonb, -- CORE: All field definitions

    -- Versioning
    version integer DEFAULT 1,                       -- Increments on schema changes
    from_ts timestamptz DEFAULT NOW(),
    to_ts timestamptz,
    active_flag boolean DEFAULT true,

    -- Standard SCD fields
    created_ts timestamptz DEFAULT NOW(),
    updated_ts timestamptz DEFAULT NOW()
);

CREATE INDEX idx_form_head_slug ON app.d_form_head(slug);
CREATE INDEX idx_form_head_active ON app.d_form_head(active_flag, version);
```

**Key Fields:**
- `form_schema` - JSONB containing all field definitions (steps, fields, validation)
- `version` - Increments when schema changes (metadata changes don't increment)
- `shared_url` - Public URL for anonymous submissions
- `active_flag` - Soft delete flag (false = archived)

**form_schema Structure:**
```json
{
  "steps": [
    {
      "id": "step_contact",
      "name": "contact",
      "title": "Contact Information",
      "description": "Tell us how to reach you",
      "fields": [
        {
          "id": "field_email",
          "name": "email",
          "label": "Email Address",
          "type": "email",
          "required": true,
          "placeholder": "you@example.com"
        },
        {
          "id": "field_signature",
          "name": "signature",
          "type": "signature",
          "required": true,
          "signatureWidth": 500,
          "signatureHeight": 200
        }
      ]
    }
  ],
  "currentStepIndex": 0
}
```

### Table: d_form_data (Form Submissions)

**Purpose:** Store submitted form data

```sql
CREATE TABLE app.d_form_data (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id uuid NOT NULL,                           -- Link to form definition (NO FK)

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
    approved_ts timestamptz,                         -- Approval timestamp

    -- Standard SCD fields
    from_ts timestamptz DEFAULT NOW(),
    to_ts timestamptz,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT NOW(),
    updated_ts timestamptz DEFAULT NOW()
);

CREATE INDEX idx_form_data_form_id ON app.d_form_data(form_id);
CREATE INDEX idx_form_data_status ON app.d_form_data(submission_status, approval_status);
```

**Key Fields:**
- `form_id` - Link to form template (NO foreign key constraint)
- `submission_data` - JSONB containing field values (S3 keys for files)
- `submitted_by_empid` - Employee ID or `00000000-0000-0000-0000-000000000000` for anonymous
- `approval_status` - Workflow state (pending, approved, rejected)

**submission_data Structure:**
```json
{
  "email": "user@example.com",
  "phone": "+1-416-555-1234",
  "attachment": "tenant_id=demo/entity=form/entity_id={uuid}/document.pdf",
  "signature": "tenant_id=demo/entity=form/entity_id={uuid}/signature.png"
}
```

**Storage Pattern:**
- **File fields**: Store S3 object key (~100 bytes)
- **Text fields**: Store value directly
- **NOT stored**: Base64-encoded file data (would be MB+ in database)

---

## API Endpoints

### Authenticated Endpoints (Require JWT)

**All authenticated endpoints use RBAC filtering via `entity_rbac`**

```http
# List forms
GET /api/v1/form?page=1&limit=20

# Get single form
GET /api/v1/form/:id

# Get all versions by slug
GET /api/v1/form/versions/:slug

# Create form (requires permission [4] = create)
POST /api/v1/form
Content-Type: application/json
{
  "name": "Customer Intake Form",
  "descr": "Collect customer information",
  "form_type": "multi_step",
  "form_schema": {
    "steps": [...]
  }
}

# Update form (schema change → version++)
PUT /api/v1/form/:id
{
  "form_schema": {...}
}

# Soft delete (active_flag = false)
DELETE /api/v1/form/:id

# Submit form (authenticated user)
POST /api/v1/form/:id/submit
{
  "submissionData": {...},
  "submissionStatus": "submitted"
}

# List submissions
GET /api/v1/form/:id/data?page=1&limit=20

# Get single submission
GET /api/v1/form/:id/data/:submissionId

# Update submission
PUT /api/v1/form/:id/data/:submissionId
{
  "submission_data": {...},
  "approval_status": "approved"
}
```

### Public Endpoints (No Authentication)

**Public endpoints do NOT require JWT token**

```http
# Get form for public filling
GET /api/v1/public/form/:id

# Submit anonymous form
POST /api/v1/public/form/:id/submit
{
  "submissionData": {...}
}
```

**Anonymous Submission Handling:**
```typescript
// Anonymous submissions use sentinel UUID
submitted_by_empid = '00000000-0000-0000-0000-000000000000'
```

### Response Examples

**List Forms (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "slug": "customer-intake-form-20251112",
      "code": "FORM-1699808800",
      "name": "Customer Intake Form",
      "descr": "Collect customer information",
      "form_type": "multi_step",
      "form_schema": {...},
      "version": 2,
      "active_flag": true,
      "internal_url": "/form/uuid",
      "shared_url": "/public/form/uuid",
      "created_ts": "2025-11-10T10:00:00Z",
      "updated_ts": "2025-11-12T14:30:00Z"
    }
  ],
  "total": 15,
  "limit": 20,
  "offset": 0
}
```

**Submit Form (201):**
```json
{
  "success": true,
  "data": {
    "id": "submission-uuid",
    "form_id": "form-uuid",
    "submission_status": "submitted",
    "created_ts": "2025-11-12T15:00:00Z"
  },
  "message": "Form submitted successfully"
}
```

---

## RBAC Integration

### Permission Model

Forms use the standard entity RBAC pattern via `entity_rbac`:

```sql
-- Permission array
ARRAY[0,1,2,3,4,5]
  [0] = View      - Can see form and submissions
  [1] = Edit      - Can modify form schema and update submissions
  [2] = Share     - Can generate public links
  [3] = Delete    - Can soft-delete forms
  [4] = Create    - Can create new forms (type-wide permission)
  [5] = Owner     - Full control over form
```

### Operation Requirements

| Operation | Required Permission | Scope |
|-----------|---------------------|-------|
| **List Forms** | View `[0]` | Returns only forms user can view |
| **Get Form** | View `[0]` | Specific form or type-wide |
| **Create Form** | Create `[4]` | Type-wide (`entity_id = 'all'`) |
| **Update Form** | Edit `[1]` | Specific form or type-wide |
| **Delete Form** | Delete `[3]` | Specific form or type-wide |
| **Submit Form** | View `[0]` | Form must be viewable |
| **View Submissions** | View `[0]` | Form must be viewable |
| **Update Submission** | Edit `[1]` | Form must be editable |

### Auto-Permission Grant

When a user creates a form, they automatically receive permissions:

```sql
-- Creator receives [0,1,2,3,5] on their form
INSERT INTO app.entity_rbac (empid, entity, entity_id, permission)
VALUES (
  'creator-uuid',
  'form',
  'form-uuid',
  ARRAY[0,1,2,3,5]  -- View, Edit, Share, Delete, Owner
);

-- Note: Create [4] is NOT granted (type-wide permission only)
```

### RBAC Filtering in Queries

All authenticated endpoints filter by RBAC:

```sql
-- List forms (only returns forms user can view)
SELECT f.*
FROM app.d_form_head f
WHERE f.active_flag = true
  AND EXISTS (
    SELECT 1 FROM app.entity_rbac rbac
    WHERE rbac.empid = $userId
      AND rbac.entity = 'form'
      AND (rbac.entity_id = f.id::text OR rbac.entity_id = 'all')
      AND rbac.active_flag = true
      AND 0 = ANY(rbac.permission)  -- View permission
  )
ORDER BY f.created_ts DESC;
```

---

## Entity Relationships

### Linkage System

Forms can be linked to other entities via `entity_instance_link`:

```
┌──────────┐         ┌────────────────┐         ┌──────────┐
│ Project  │────────>│ entity_instance_link │<────────│   Form   │
└──────────┘         └────────────────┘         └──────────┘

┌──────────┐         ┌────────────────┐         ┌──────────┐
│   Task   │────────>│ entity_instance_link │<────────│   Form   │
└──────────┘         └────────────────┘         └──────────┘

┌──────────┐         ┌────────────────┐         ┌──────────┐
│  Client  │────────>│ entity_instance_link │<────────│   Form   │
└──────────┘         └────────────────┘         └──────────┘
```

**Common Linkages:**
- **Project → Form**: Quality inspection forms for construction projects
- **Task → Form**: Task-specific checklists
- **Client → Form**: Customer intake forms, service requests
- **Employee → Form**: HR forms (onboarding, reviews)

**Create Linkage:**
```sql
INSERT INTO app.entity_instance_link
(parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
VALUES ('project', 'project-uuid', 'form', 'form-uuid');
```

**Query Forms Linked to Entity:**
```sql
SELECT f.*
FROM app.d_form_head f
INNER JOIN app.entity_instance_link link
  ON link.child_entity_type = 'form'
  AND link.child_entity_id = f.id::text
WHERE link.parent_entity_type = 'project'
  AND link.parent_entity_id = 'project-uuid'
  AND link.active_flag = true;
```

**API Endpoint:**
```http
GET /api/v1/project/{projectId}/form?page=1&limit=20
```

### Form-Submission Relationship

**One-to-Many:** One form can have many submissions

```sql
-- Query submissions for a form
SELECT * FROM app.d_form_data
WHERE form_id = 'form-uuid'
  AND active_flag = true
ORDER BY created_ts DESC;
```

**NO Foreign Key:** Relationship tracked by `form_id` field without FK constraint (allows flexibility)

---

## Versioning System

### In-Place Versioning

**Pattern:** Same `id`, increment `version` on schema changes

**Triggers for Version Increment:**
- ✅ Adding/removing fields
- ✅ Changing field types
- ✅ Modifying validation rules
- ✅ Adding/removing steps
- ✅ Changing field properties (required, options, etc.)

**NO Version Increment:**
- ❌ Updating `name` or `descr`
- ❌ Changing `active_flag`
- ❌ Modifying `internal_url` or `shared_url`

### Implementation

```typescript
// API detects schema changes
const schemaChanged = data.form_schema !== undefined &&
  JSON.stringify(data.form_schema) !== JSON.stringify(current.form_schema);

if (schemaChanged) {
  // Version bump (same ID)
  const newVersion = (current.version || 1) + 1;
  await db.execute(sql`
    UPDATE app.d_form_head
    SET form_schema = ${JSON.stringify(data.form_schema)},
        version = ${newVersion},
        updated_ts = NOW()
    WHERE id = ${id}
  `);
} else {
  // Metadata-only update (no version change)
  await db.execute(sql`
    UPDATE app.d_form_head
    SET name = ${data.name},
        descr = ${data.descr},
        updated_ts = NOW()
    WHERE id = ${id}
  `);
}
```

### Benefits

**Stable Public URLs:**
```
https://app.com/public/form/f8c12a4e-...
```
This URL remains stable across 100+ schema updates because `id` never changes.

**Version History:**
```sql
-- Get all versions by slug
SELECT * FROM app.d_form_head
WHERE slug = 'customer-intake-form-20251112'
ORDER BY version DESC;

-- Results:
-- version 3: Added signature field
-- version 2: Added phone validation
-- version 1: Initial creation
```

---

## File Storage (S3)

### Storage Pattern

**Rule:** Store S3 object keys in database, NOT file data

**Why:**
- 1MB file as base64 = ~1.3MB in database
- 1MB file in S3 = ~100 bytes in database (object key only)
- Database performance degrades with large JSONB

**Correct Pattern:**
```typescript
// ✅ CORRECT - Store object key
const { objectKey } = await uploadFileToS3(file);
submissionData.attachment = objectKey;  // ~100 bytes

// ❌ WRONG - Store base64
const base64 = await fileToBase64(file);
submissionData.attachment = base64;  // ~1.3MB!
```

### Upload Flow

**1. Request Presigned URL:**
```http
POST /api/v1/s3-backend/presigned-url
Content-Type: application/json
{
  "entityType": "form",
  "entityId": "form-uuid",
  "fileName": "document.pdf",
  "fileSize": 1048576
}

Response:
{
  "uploadUrl": "https://s3.amazonaws.com/bucket/path?signature=...",
  "objectKey": "tenant_id=demo/entity=form/entity_id={uuid}/document.pdf"
}
```

**2. Upload to S3:**
```http
PUT {uploadUrl}
Content-Type: application/pdf
Body: <file binary data>
```

**3. Store Object Key:**
```json
{
  "submission_data": {
    "attachment": "tenant_id=demo/entity=form/entity_id={uuid}/document.pdf"
  }
}
```

### Download Flow

**1. Request Presigned Download URL:**
```http
GET /api/v1/s3-backend/presigned-url?objectKey={key}

Response:
{
  "downloadUrl": "https://s3.amazonaws.com/bucket/path?signature=..."
}
```

**2. Browser Downloads:**
```javascript
window.open(downloadUrl);  // Opens in new tab
```

### Signature Storage

**Signatures are converted to PNG and uploaded to S3:**

```typescript
// 1. User draws signature on canvas
// 2. Convert canvas to PNG blob
const blob = dataURLToBlob(signatureDataURL);

// 3. Upload to S3
const { objectKey } = await uploadSignatureToS3(blob, formId);

// 4. Store object key
submissionData.signature = objectKey;
```

**Object Key Format:**
```
tenant_id=demo/entity=form/entity_id={uuid}/signatures/signature_{timestamp}.png
```

---

## Common Use Cases

### Use Case 1: Create Custom Form

**Scenario:** Create a customer intake form

```bash
# 1. Create form
./tools/test-api.sh POST /api/v1/form '{
  "name": "Customer Intake Form",
  "descr": "Collect customer information",
  "form_type": "multi_step",
  "form_schema": {
    "steps": [
      {
        "id": "step1",
        "name": "contact",
        "title": "Contact Information",
        "fields": [
          {"name": "full_name", "label": "Full Name", "type": "text", "required": true},
          {"name": "email", "label": "Email", "type": "email", "required": true},
          {"name": "phone", "label": "Phone", "type": "text", "required": true}
        ]
      },
      {
        "id": "step2",
        "name": "details",
        "title": "Additional Details",
        "fields": [
          {"name": "company", "label": "Company", "type": "text"},
          {"name": "signature", "label": "Signature", "type": "signature", "required": true}
        ]
      }
    ]
  }
}'

# Response: { "id": "form-uuid", "version": 1, "shared_url": "/public/form/form-uuid" }
```

### Use Case 2: Update Form Schema

**Scenario:** Add new field to existing form

```bash
# Get current form
FORM=$(./tools/test-api.sh GET /api/v1/form/{uuid})

# Update schema (add field)
./tools/test-api.sh PUT /api/v1/form/{uuid} '{
  "form_schema": {
    "steps": [
      {
        "id": "step1",
        "fields": [
          {"name": "full_name", "type": "text", "required": true},
          {"name": "email", "type": "email", "required": true},
          {"name": "phone", "type": "text", "required": true},
          {"name": "address", "type": "textarea", "required": false}
        ]
      }
    ]
  }
}'

# Response: { "version": 2 }  // Version incremented
```

### Use Case 3: Submit Form (Authenticated)

**Scenario:** Logged-in employee submits form

```bash
./tools/test-api.sh POST /api/v1/form/{uuid}/submit '{
  "submissionData": {
    "full_name": "John Smith",
    "email": "john@example.com",
    "phone": "+1-416-555-1234",
    "address": "123 Main St, Toronto",
    "signature": "tenant_id=demo/entity=form/entity_id={uuid}/signature.png"
  },
  "submissionStatus": "submitted"
}'

# Response: { "id": "submission-uuid", "submission_status": "submitted" }
```

### Use Case 4: Anonymous Public Submission

**Scenario:** Customer fills form from public link

```bash
# No authentication required
curl -X POST http://localhost:4000/api/v1/public/form/{uuid}/submit \
  -H "Content-Type: application/json" \
  -d '{
    "submissionData": {
      "full_name": "Jane Doe",
      "email": "jane@example.com",
      "phone": "+1-416-555-5678"
    }
  }'

# Database record:
# submitted_by_empid = '00000000-0000-0000-0000-000000000000'  (anonymous)
```

### Use Case 5: Link Form to Project

**Scenario:** Attach quality inspection form to construction project

```bash
# Create linkage
./tools/test-api.sh POST /api/v1/linkage '{
  "parent_entity_type": "project",
  "parent_entity_id": "project-uuid",
  "child_entity_type": "form",
  "child_entity_id": "form-uuid",
  "relationship_type": "contains"
}'

# Query forms in project
./tools/test-api.sh GET /api/v1/project/{project-uuid}/form
```

### Use Case 6: Approve Submission

**Scenario:** Manager approves customer intake form

```bash
# Get submission
./tools/test-api.sh GET /api/v1/form/{form-uuid}/data/{submission-uuid}

# Approve
./tools/test-api.sh PUT /api/v1/form/{form-uuid}/data/{submission-uuid} '{
  "approval_status": "approved",
  "approval_notes": "All information verified"
}'

# Database updates:
# approval_status = 'approved'
# approved_by_empid = {current-user-uuid}
# approved_ts = NOW()
```

---

## Best Practices

### 1. Always Use form_schema (Not schema)

**✅ Correct:**
```json
{
  "name": "My Form",
  "form_schema": {
    "steps": [...]
  }
}
```

**❌ Incorrect:**
```json
{
  "name": "My Form",
  "schema": {
    "steps": [...]
  }
}
```

**Why:** API validates against `form_schema` field name.

### 2. Store S3 Keys, Not File Data

**✅ Correct:**
```json
{
  "submission_data": {
    "attachment": "tenant_id=demo/entity=form/entity_id={uuid}/file.pdf"
  }
}
```

**❌ Incorrect:**
```json
{
  "submission_data": {
    "attachment": "data:application/pdf;base64,JVBERi0xLjQK..."  // 1.3MB!
  }
}
```

### 3. Use Valid JavaScript Identifiers for Field Names

**✅ Correct:**
```json
{
  "name": "full_name",
  "label": "Full Name",
  "type": "text"
}
```

**❌ Incorrect:**
```json
{
  "name": "Full Name",  // Spaces!
  "label": "Full Name",
  "type": "text"
}
```

**Why:** `submission_data` is a flat object accessed via `submission_data[fieldName]`.

### 4. Soft Delete Forms

**✅ Correct:**
```sql
UPDATE app.d_form_head
SET active_flag = false, to_ts = NOW()
WHERE id = $id;
```

**❌ Incorrect:**
```sql
DELETE FROM app.d_form_head WHERE id = $id;
-- This hard deletes submissions too!
```

### 5. Use Anonymous Sentinel for Public Submissions

**✅ Correct:**
```sql
INSERT INTO app.d_form_data (submitted_by_empid)
VALUES ('00000000-0000-0000-0000-000000000000');
```

**❌ Incorrect:**
```sql
INSERT INTO app.d_form_data (submitted_by_empid)
VALUES (NULL);  -- NOT NULL constraint violation!
```

### 6. Increment Version Only on Schema Changes

**✅ Correct:**
```typescript
if (schemaChanged) {
  version++;
}
// Metadata changes don't increment version
```

**❌ Incorrect:**
```typescript
// Always incrementing version
version++;
```

**Why:** Public URLs must remain stable.

---

## Troubleshooting

### Issue: "Form schema is undefined"

**Cause:** `form_schema` returned as string, not parsed

**Solution:**
```typescript
// Always parse if string
if (typeof data.form_schema === 'string') {
  data.form_schema = JSON.parse(data.form_schema);
}
```

### Issue: "File too large for database"

**Cause:** Storing base64-encoded file data instead of S3 key

**Solution:**
```typescript
// Upload to S3 first
const { objectKey } = await uploadFileToS3(file);

// Store object key (NOT file data)
submissionData.attachment = objectKey;
```

### Issue: "Permission denied" (403)

**Cause:** User lacks required RBAC permission

**Solution:**
```sql
-- Check permissions
SELECT * FROM app.entity_rbac
WHERE empid = 'user-uuid'
  AND entity = 'form';

-- Grant view permission
INSERT INTO app.entity_rbac (empid, entity, entity_id, permission)
VALUES ('user-uuid', 'form', 'all', ARRAY[0]);  -- View all forms
```

### Issue: "Form not found" (404)

**Cause:** Form is soft-deleted (`active_flag = false`)

**Solution:**
```sql
-- Check form status
SELECT id, name, active_flag FROM app.d_form_head
WHERE id = 'form-uuid';

-- Reactivate if needed
UPDATE app.d_form_head
SET active_flag = true, to_ts = NULL
WHERE id = 'form-uuid';
```

### Issue: Anonymous submissions failing

**Cause:** Missing sentinel UUID

**Solution:**
```typescript
// Always use sentinel for anonymous
submitted_by_empid = '00000000-0000-0000-0000-000000000000'
```

### Issue: Version not incrementing

**Cause:** Schema comparison shows no change

**Solution:**
```typescript
// Ensure schema is different
const oldSchema = JSON.stringify(current.form_schema);
const newSchema = JSON.stringify(data.form_schema);

if (oldSchema !== newSchema) {
  version++;
}
```

---

## Testing

### Unit Tests

```bash
# Create form
./tools/test-api.sh POST /api/v1/form '{
  "name": "Test Form",
  "form_type": "multi_step",
  "form_schema": {"steps": [{"fields": [{"name": "test", "type": "text"}]}]}
}'

# Get form
./tools/test-api.sh GET /api/v1/form/{uuid}

# Update form (triggers version increment)
./tools/test-api.sh PUT /api/v1/form/{uuid} '{
  "form_schema": {"steps": [{"fields": [{"name": "test2", "type": "text"}]}]}
}'

# Submit form
./tools/test-api.sh POST /api/v1/form/{uuid}/submit '{
  "submissionData": {"test": "value"}
}'

# Soft delete
./tools/test-api.sh DELETE /api/v1/form/{uuid}
```

### Integration Test

```bash
# End-to-end flow
FORM_ID=$(./tools/test-api.sh POST /api/v1/form '{"name":"E2E Test","form_schema":{"steps":[]}}' | jq -r '.data.id')

./tools/test-api.sh POST /api/v1/form/$FORM_ID/submit '{"submissionData":{"field1":"value1"}}'

./tools/test-api.sh GET /api/v1/form/$FORM_ID/data

./tools/test-api.sh DELETE /api/v1/form/$FORM_ID
```

### Database Verification

```sql
-- Check form exists
SELECT id, name, version, active_flag FROM app.d_form_head
WHERE id = 'form-uuid';

-- Check submissions
SELECT id, submission_status, submission_data
FROM app.d_form_data
WHERE form_id = 'form-uuid';

-- Check RBAC permissions
SELECT * FROM app.entity_rbac
WHERE entity = 'form' AND entity_id = 'form-uuid';
```

---

## Quick Reference

### Create Form
```bash
POST /api/v1/form
{
  "name": "Form Name",
  "form_schema": {"steps": [...]}
}
```

### Update Form
```bash
PUT /api/v1/form/{id}
{
  "form_schema": {...}  # Triggers version++
}
```

### Submit Form
```bash
POST /api/v1/form/{id}/submit
{
  "submissionData": {...}
}
```

### Public Submit
```bash
POST /api/v1/public/form/{id}/submit
{
  "submissionData": {...}
}
```

### List Submissions
```bash
GET /api/v1/form/{id}/data?page=1&limit=20
```

### Link to Entity
```bash
POST /api/v1/linkage
{
  "parent_entity_type": "project",
  "parent_entity_id": "uuid",
  "child_entity_type": "form",
  "child_entity_id": "uuid"
}
```

---

## Support

**Documentation:** `/docs/form/form.md`
**API Docs:** `http://localhost:4000/docs`
**Test Script:** `./tools/test-api.sh`
**Database Import:** `./tools/db-import.sh`

**Related Docs:**
- Entity System: `/docs/entity_design_pattern/universal_entity_system.md`
- Linkage System: `/docs/linkage/UnifiedLinkageSystem.md`
- S3 Service: `/docs/S3_ATTACHMENT_SERVICE_COMPLETE_GUIDE.md`
- RBAC System: `/docs/datamodel/datamodel.md`

**Key Tables:**
- `app.d_form_head` - Form definitions (DDL: `db/XVII_d_form_head.ddl`)
- `app.d_form_data` - Form submissions (DDL: `db/XVIII_d_form_data.ddl`)
- `app.entity_rbac` - RBAC permissions (DDL: `db/32_entity_rbac.ddl`)

---

**Last Updated:** 2025-11-12
**Version:** 3.0.0
**Status:** ✅ Production Ready

**Key Changes in v3.0.0:**
- Complete rewrite focusing on current database and API architecture
- Removed detailed frontend implementation (UI components change frequently)
- Emphasized JSONB schema storage and S3 file handling
- Added comprehensive RBAC integration section
- Enhanced versioning explanation
- Added entity linkage examples
- Simplified to API and database-centric documentation
