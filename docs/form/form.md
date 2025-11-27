# Form System

**Version:** 3.0.0 | **Tables:** `form`, `d_form_data`

---

## Semantics

The Form System provides schema-driven, multi-step forms with JSONB storage, S3 file handling, public submissions, and RBAC integration. Forms are regular entities that can be linked to projects, tasks, clients, and other entities via `entity_instance_link`.

**Core Principle:** Form definitions stored as JSONB schema. File data stored in S3, not database.

---

## System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FORM SYSTEM ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     FORM DEFINITION                              │    │
│  │                    (form)                                 │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │  form_schema (JSONB)                                     │    │    │
│  │  │  { steps: [ { fields: [...] } ] }                       │    │    │
│  │  └─────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│         ┌────────────────────┴────────────────────┐                     │
│         v                                         v                     │
│  ┌─────────────────┐                   ┌─────────────────┐             │
│  │  Authenticated  │                   │    Public       │             │
│  │  Submission     │                   │   Submission    │             │
│  │  (JWT required) │                   │  (Anonymous)    │             │
│  └─────────────────┘                   └─────────────────┘             │
│         │                                         │                     │
│         └────────────────────┬────────────────────┘                     │
│                              v                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     FORM SUBMISSION                              │    │
│  │                    (d_form_data)                                 │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │  submission_data (JSONB)                                 │    │    │
│  │  │  { field1: "value", file1: "s3_key" }                   │    │    │
│  │  └─────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              v                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                       S3 STORAGE                                 │    │
│  │  tenant_id=demo/entity=form/entity_id={uuid}/filename.pdf       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
Form Lifecycle
──────────────

CREATE          BUILD           PUBLISH         COLLECT         ARCHIVE
   │               │               │               │               │
   v               v               v               v               v
form ─> form_schema ─> shared_url ─> d_form_data ─> active_flag=false


Submission Flow
───────────────

Public URL                        Authenticated
/public/form/{id}                /form/{id}
       │                              │
       v                              v
Anonymous submission            User submission
submitted_by_empid:             submitted_by_empid:
00000000-0000-0000-             {user-uuid}
0000-000000000000
       │                              │
       └──────────────┬───────────────┘
                      v
              d_form_data
                      │
                      v
              Approval workflow
              pending → approved/rejected
```

---

## Architecture Overview

### Database Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `form` | Form definitions | slug, form_schema, version, shared_url |
| `d_form_data` | Form submissions | form_id, submission_data, submission_status, approval_status |

### Form Schema Structure

```json
{
  "steps": [
    {
      "id": "step_contact",
      "title": "Contact Information",
      "fields": [
        { "name": "email", "type": "email", "required": true },
        { "name": "signature", "type": "signature", "required": true }
      ]
    }
  ]
}
```

### Field Types

| Type | Input Component | Storage |
|------|-----------------|---------|
| `text` | Text input | String value |
| `email` | Email input | String value |
| `textarea` | Multi-line | String value |
| `select` | Dropdown | String value |
| `file` | File upload | S3 object key |
| `signature` | Signature pad | S3 object key (PNG) |
| `date` | Date picker | Date string |
| `checkbox` | Checkbox | Boolean |

---

## Tooling Overview

### API Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/v1/form` | JWT | List forms (RBAC filtered) |
| `GET /api/v1/form/:id` | JWT | Get single form |
| `POST /api/v1/form` | JWT | Create form |
| `PUT /api/v1/form/:id` | JWT | Update form (schema change → version++) |
| `DELETE /api/v1/form/:id` | JWT | Soft delete |
| `POST /api/v1/form/:id/submit` | JWT | Submit (authenticated) |
| `GET /api/v1/form/:id/data` | JWT | List submissions |
| `GET /api/v1/public/form/:id` | None | Get form (public) |
| `POST /api/v1/public/form/:id/submit` | None | Submit (anonymous) |

### Versioning System

| Trigger | Version Change | URL Stability |
|---------|----------------|---------------|
| Schema field add/remove | version++ | shared_url unchanged |
| Schema validation change | version++ | shared_url unchanged |
| Name/description change | No change | shared_url unchanged |
| active_flag change | No change | shared_url unchanged |

---

## Database/API/UI Mapping

### Permission Model

| Permission | Level | Scope |
|------------|-------|-------|
| View | 0 | See form and submissions |
| Edit | 1 | Modify form schema |
| Share | 2 | Generate public links |
| Delete | 3 | Soft delete forms |
| Create | 4 | Create new forms (type-wide) |
| Owner | 5 | Full control |

### Entity Linkage

| Parent Entity | Relationship | Use Case |
|---------------|--------------|----------|
| Project | contains | Quality inspection forms |
| Task | contains | Task-specific checklists |
| Client | contains | Customer intake forms |
| Employee | contains | HR forms (onboarding) |

---

## User Interaction Flow

```
Create Form Flow
────────────────

1. User clicks "Create Form"
   │
2. POST /api/v1/form
   { name: "Customer Intake", form_schema: { steps: [...] } }
   │
3. Backend:
   ├── RBAC check (CREATE permission)
   ├── Generate slug from name + timestamp
   ├── Generate shared_url
   └── Set version = 1
   │
4. Return form with id, shared_url


Public Submission Flow
──────────────────────

1. Customer opens shared_url
   │
2. GET /api/v1/public/form/:id (no auth)
   │
3. Customer fills form
   │
4. For file/signature fields:
   ├── POST /api/v1/s3-backend/presigned-url
   ├── PUT to S3 presigned URL
   └── Store S3 key in submission_data
   │
5. POST /api/v1/public/form/:id/submit
   { submissionData: { email: "...", signature: "s3_key" } }
   │
6. Backend:
   ├── submitted_by_empid = '00000000-...'
   ├── submission_status = 'submitted'
   └── Store in d_form_data


Approval Flow
─────────────

1. Manager views submissions
   GET /api/v1/form/:id/data
   │
2. Manager reviews submission
   GET /api/v1/form/:id/data/:submissionId
   │
3. Manager approves
   PUT /api/v1/form/:id/data/:submissionId
   { approval_status: "approved", approval_notes: "Verified" }
   │
4. Backend:
   ├── approved_by_empid = {manager-uuid}
   ├── approved_ts = NOW()
   └── approval_status = 'approved'
```

---

## Critical Considerations

### Design Principles

1. **JSONB Schema** - All field definitions in single column
2. **S3 File Storage** - Store S3 keys (~100 bytes), not file data
3. **In-Place Versioning** - Same ID, increment version on schema change
4. **Stable Public URLs** - shared_url never changes
5. **Anonymous Sentinel** - `00000000-0000-0000-0000-000000000000` for public submissions

### Storage Patterns

| Data Type | Storage Location | Database Value |
|-----------|------------------|----------------|
| Text fields | d_form_data.submission_data | Actual value |
| File uploads | S3 bucket | S3 object key |
| Signatures | S3 bucket (PNG) | S3 object key |

### File Upload Flow

| Step | Action | Result |
|------|--------|--------|
| 1 | Request presigned URL | `{ uploadUrl, objectKey }` |
| 2 | PUT file to uploadUrl | File stored in S3 |
| 3 | Store objectKey in submission_data | ~100 bytes in DB |

### Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Store base64 file data | Store S3 object key |
| Hard delete forms | Soft delete (active_flag = false) |
| Use `schema` field | Use `form_schema` field |
| NULL for anonymous | Use sentinel UUID |
| Always increment version | Only on schema changes |

### Error Handling

| Scenario | Response |
|----------|----------|
| Form not found | 404 Not Found |
| Permission denied | 403 Forbidden |
| Invalid schema | 400 Bad Request |
| File too large | 413 Payload Too Large |

---

**Last Updated:** 2025-11-21 | **Status:** Production Ready
