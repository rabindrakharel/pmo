# Form Entity - Complete Technical Documentation

> **Dynamic Form Builder System** - Multi-step forms for data collection, public sharing, and workflow automation

---

## 📋 Table of Contents

1. [Semantics & Business Context](#semantics--business-context)
2. [Architecture & Design Patterns](#architecture--design-patterns)
3. [Database, API & UI/UX Mapping](#database-api--uiux-mapping)
4. [DRY Principles & Entity Relationships](#dry-principles--entity-relationships)
5. [Central Configuration & Middleware](#central-configuration--middleware)
6. [User Interaction Flow Examples](#user-interaction-flow-examples)
7. [Critical Considerations When Editing](#critical-considerations-when-editing)

---

## Semantics & Business Context

### Business Purpose

**Forms** serve as the primary data collection engine for the PMO platform. They enable:
- **Dynamic form building** without developer involvement (drag-drop UI)
- **Multi-step workflows** for complex data collection processes
- **Public sharing** via unique URLs for external stakeholders
- **Versioning** to track schema changes without breaking existing submissions
- **Integration** with projects, tasks, clients, and employees

### Business Workflows

#### Form Lifecycle
```
Create → Build → Preview → Publish → Collect → Approve → Archive
   ↓       ↓        ↓         ↓         ↓         ↓         ↓
Design  Define  Validate  Activate  Submit  Review   Close
```

#### Submission Workflow
```
Draft → Submitted → Under Review → Approved/Rejected → Completed
  ↓         ↓             ↓              ↓                ↓
Save    Submit       Validation    Decision         Final
```

### Key Business Rules

**Form Definitions:**
- **Schema-driven**: All fields stored as JSONB in `form_schema` column
- **Multi-step support**: Complex forms split into logical steps for UX
- **Version control**: Schema changes increment `version` field
- **Public access**: `shared_url` enables anonymous submissions
- **Type safety**: `form_type` field indicates single-page vs multi-step

**Form Submissions:**
- **Flexible storage**: `submission_data` JSONB stores any field structure
- **Audit trail**: Tracks submitter (`submitted_by_empid`), IP, and user agent
- **Workflow states**: Draft → Submitted → Approved (configurable)
- **Anonymous support**: Public forms use `00000000-0000-0000-0000-000000000000` as submitter

### Real-World Use Cases

| Department | Form Type | Purpose | Connected Entity |
|------------|-----------|---------|------------------|
| Sales | Lead Qualification | Standardize lead intake | Client |
| Operations | Site Inspection | Quality control checklist | Task |
| HR | Employee Onboarding | Compliance documentation | Employee |
| Finance | Expense Report | Cost tracking | Employee |
| Customer Service | Service Request | Capture requirements | Project |

---

## Architecture & Design Patterns

### Form System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FORM SYSTEM LAYERS                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📱 PAGES                                                       │
│  ├─ FormBuilderPage      → /form/new (create)                  │
│  ├─ FormEditPage         → /form/:id/edit (modify)             │
│  ├─ EntityDetailPage     → /form/:id (view/fill)               │
│  ├─ PublicFormPage       → /form/:hash (public access)         │
│  └─ FormDataPreviewPage  → /form/:id/data (submissions)        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🎨 COMPONENTS                                                  │
│  ├─ AdvancedFormBuilder  → Drag-drop designer                  │
│  ├─ InteractiveForm      → Multi-step renderer (REUSABLE)      │
│  │   └─ S3 Integration  → Uses useS3Upload hook (DRY)          │
│  │       ├─ useS3Upload()        → Reusable hook               │
│  │       ├─ uploadFileToS3()     → Wrapper (10 lines)          │
│  │       └─ uploadSignatureToS3() → Wrapper (14 lines)         │
│  ├─ FormPreview          → Live preview                        │
│  └─ FormSubmissionEditor → Edit submissions                    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ⚙️  API (Fastify)                                              │
│  ├─ POST   /api/v1/form              → Create                  │
│  ├─ PUT    /api/v1/form/:id          → Update                  │
│  ├─ GET    /api/v1/form/:id          → Get definition          │
│  ├─ POST   /api/v1/form/:id/submit   → Submit (authenticated)  │
│  ├─ POST   /api/v1/public/form/:id/submit → Submit (public)    │
│  ├─ GET    /api/v1/form/:id/data     → List submissions        │
│  └─ S3 Backend API       → File/signature storage (unified)    │
│      ├─ POST /api/v1/s3-backend/presigned-upload               │
│      ├─ POST /api/v1/s3-backend/presigned-download             │
│      ├─ GET  /api/v1/s3-backend/list/:entityType/:entityId     │
│      ├─ DELETE /api/v1/s3-backend/attachment                   │
│      └─ GET  /api/v1/s3-backend/health                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  💾 DATABASE (PostgreSQL)                                       │
│  ├─ d_form_head          → Form definitions (schema)           │
│  ├─ d_form_data          → Submissions (S3 object keys)        │
│  ├─ entity_id_map        → Relationships                       │
│  └─ entity_id_rbac_map   → Permissions                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ☁️  STORAGE (AWS S3)                                           │
│  └─ Bucket: cohuron-attachments-prod-957207443425              │
│      └─ tenant_id=demo/entity=form/entity_id={formId}/         │
│          ├─ {hash}_signature.png                               │
│          ├─ {hash}_initials.png                                │
│          └─ {hash}_uploaded_file.pdf                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Design Patterns

#### 1. **Schema-Driven Architecture**

Form behavior is entirely driven by the `form_schema` JSONB structure:

```typescript
{
  "steps": [
    {
      "id": "step-1",
      "name": "step_1",
      "title": "Contact Information",
      "description": "Enter your details",
      "fields": [
        {
          "name": "full_name",
          "label": "Full Name",
          "type": "text",
          "required": true
        }
      ]
    }
  ],
  "currentStepIndex": 0
}
```

**Benefits:**
- Dynamic rendering without code changes
- Easy versioning and migration
- Portable across systems

#### 2. **Builder-Renderer Separation**

**Builder** (`AdvancedFormBuilder`):
- Creates and edits schema
- Drag-drop field palette
- Live preview sidebar

**Renderer** (`InteractiveForm`):
- Reads schema and renders UI
- Multi-step navigation
- Validation and submission

**Contract:** Schema is the ONLY communication between builder and renderer.

#### 3. **Multi-Step State Machine**

```
Step 1 → Step 2 → Step 3 → Submit
   ↓        ↓        ↓         ↓
 Save    Save     Save    Store
 Draft   Draft    Draft   Final
```

Each step maintains local state; final submit merges all step data into `submission_data`.

#### 4. **Reusable Renderer Pattern**

`InteractiveForm` is used in 4+ contexts:
- **Form Builder** - Live preview
- **Entity Detail** - Fill form (authenticated)
- **Public Form** - Anonymous submission
- **Task Data** - Inline forms

Same component, different contexts → DRY principle.

#### 5. **S3 Cloud Storage for Files & Signatures (DRY Architecture)**

**Problem:** Storing files/signatures as base64 or File objects in database causes:
- Large `submission_data` JSONB payload (200KB+ per signature, MBs for files)
- File objects cannot be serialized to JSON
- Slow queries and increased storage costs
- Difficult to implement caching and CDN delivery

**Solution:** Unified S3 upload system using reusable hook (DRY principle)

**Architecture:**
```
InteractiveForm
    ↓ uses
useS3Upload() hook (apps/web/src/lib/hooks/useS3Upload.ts)
    ↓ calls
S3 Backend API (/api/v1/s3-backend/*)
    ↓ uses
S3AttachmentService (apps/api/src/lib/s3-attachments.ts)
    ↓ uploads to
AWS S3 (cohuron-attachments-prod-957207443425)
```

**Flow:**
```
User uploads file/signature → useS3Upload hook → S3 Backend API → AWS S3
                                                        ↓
                                              Store objectKey in form_data
```

**Implementation:** `apps/web/src/components/entity/form/InteractiveForm.tsx:41-86`

**DRY Architecture (Refactored 2025-10-23):**
```typescript
// ✅ REUSABLE HOOK: Shared across ALL uploads (artifacts, forms, signatures)
// Location: apps/web/src/lib/hooks/useS3Upload.ts
const { uploadToS3, getDownloadUrl } = useS3Upload();

// ✅ THIN WRAPPER: File upload (10 lines)
const uploadFileToS3 = async (fieldName: string, file: File) => {
  return uploadToS3({
    entityType: 'form',
    entityId: formId,
    file,
    fileName: file.name,
    contentType: file.type,
    uploadType: 'file',
    tenantId: 'demo',
    fieldName
  });
};

// ✅ THIN WRAPPER: Signature upload (14 lines)
const uploadSignatureToS3 = async (fieldName: string, dataUrl: string) => {
  const response = await fetch(dataUrl);
  const blob = await response.blob();  // Convert base64 to blob

  return uploadToS3({
    entityType: 'form',
    entityId: formId,
    file: blob,
    fileName: `${fieldName}_${Date.now()}.png`,
    contentType: 'image/png',
    uploadType: 'signature',
    tenantId: 'demo',
    fieldName
  });
};

// ✅ REUSABLE DOWNLOAD: Uses hook
const fetchS3DownloadUrl = (objectKey: string) => getDownloadUrl(objectKey);
```

**Storage structure:**
```
s3://cohuron-attachments-prod-957207443425/
└── tenant_id=demo/entity=form/entity_id={formId}/
    ├── {hash}_signature.png
    ├── {hash}_document.pdf
    └── {hash}_photo.jpg
```

**Benefits:**
- **Database efficiency**: Store 100-byte key instead of 200KB-10MB+ data
- **Performance**: Parallel uploads don't block form submission
- **Scalability**: S3 handles billions of objects with lifecycle policies
- **Security**: Presigned URLs expire in 1 hour, IAM role auth
- **Retrieval**: Load files/signatures on-demand when viewing submissions
- **DRY principle**: Single hook for ALL uploads (66% less code)
- **Maintainability**: Fix bugs once, benefits forms + artifacts + all uploads
- **Extensibility**: Easy to add new upload types (audio, video, etc.)
- **Multi-tenant ready**: Storage structure supports tenant isolation
- **Production ready**: S3 versioning, encryption, lifecycle policies configured

---

## Database, API & UI/UX Mapping

### Database Schema

#### Form Definition Table: `d_form_head`

**Location:** `db/28_d_form_head.ddl` (check actual file path)

```sql
CREATE TABLE app.d_form_head (
    -- Identity
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(100),
    code varchar(50),
    name varchar(200) NOT NULL,
    descr text,
    internal_url varchar(500),    -- /form/:slug
    shared_url varchar(500),      -- /form/:hash (public)
    tags jsonb DEFAULT '[]'::jsonb,

    -- Form configuration
    form_type varchar(50) DEFAULT 'multi_step',

    -- ⭐ CORE: Form schema stored as JSONB
    form_schema jsonb DEFAULT '{"steps": []}'::jsonb,

    -- SCD fields
    from_ts timestamptz DEFAULT now(),
    to_ts timestamptz,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version integer DEFAULT 1
);

-- Key indexes
CREATE INDEX idx_form_active ON d_form_head(active_flag) WHERE active_flag = true;
CREATE INDEX idx_form_shared ON d_form_head(shared_url) WHERE shared_url IS NOT NULL;
```

**Critical Field:** `form_schema` - Contains the entire form definition as JSONB

#### Form Submission Table: `d_form_data`

```sql
CREATE TABLE app.d_form_data (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id uuid REFERENCES d_form_head(id) ON DELETE CASCADE,

    -- ⭐ CORE: Submitted data as JSONB
    submission_data jsonb,

    submission_status varchar(50),   -- 'draft', 'submitted', 'approved'
    stage varchar(50),
    submitted_by_empid uuid,         -- NULL for public submissions
    submission_ip varchar(100),
    submission_user_agent text,

    -- Approval workflow
    approval_status varchar(50),
    approved_by_empid uuid,
    approval_notes text,
    approved_at timestamptz,

    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);
```

**Critical Field:** `submission_data` - All form field values stored as key-value pairs
- **File upload fields**: Store S3 object keys (e.g., `tenant_id=demo/entity=form/entity_id={uuid}/document.pdf`) instead of file data
- **Signature/Initials fields**: Store S3 object keys (e.g., `tenant_id=demo/entity=form/entity_id={uuid}/{hash}.png`) instead of base64 data
- **Regular fields**: Store actual values (text, numbers, dates, etc.)

**Why S3 keys?** File and signature data can be 10MB+, making JSONB storage impractical. S3 object keys are ~100 bytes.

### API Endpoints

**Location:** `apps/api/src/modules/form/routes.ts`

```typescript
// List forms
GET /api/v1/form
Query: ?page=1&limit=20&showAllVersions=false
Response: { data: [...], total: 15, page: 1, limit: 20 }

// Get form definition
GET /api/v1/form/{id}
Response: {
  id: "uuid",
  name: "Site Inspection Form",
  form_type: "multi_step",
  form_schema: {
    steps: [...]  // ← May be string or object (MUST parse)
  },
  shared_url: "/form/aB3xK9mZ",
  version: 2
}

// Create form
POST /api/v1/form
Body: {
  name: "Customer Intake",
  descr: "Lead qualification form",
  form_type: "multi_step",
  form_schema: { steps: [...] }  // ← Send as object
}
Response: { id: "uuid", ... }

// Update form (in-place, version++)
PUT /api/v1/form/{id}
Body: {
  name: "Updated Name",
  form_schema: { steps: [...] }  // ← Schema change → version++
}

// Submit form (authenticated)
POST /api/v1/form/{id}/submit
Body: {
  submissionData: {
    field_1: "value",
    field_2: "value",
    file_field: "tenant_id=demo/entity=form/entity_id={uuid}/document.pdf",      // S3 object key
    signature_field: "tenant_id=demo/entity=form/entity_id={uuid}/abc123.png",  // S3 object key
    initials_field: "tenant_id=demo/entity=form/entity_id={uuid}/def456.png"    // S3 object key
  },
  submissionStatus: "submitted"
}
// ⚠️ File/signature/initials fields contain S3 object keys, NOT file data or base64

// Submit form (public, NO AUTH)
POST /api/v1/public/form/{id}/submit
Body: { submissionData: {...} }
// Creates submission with anonymous UUID

// List form submissions
GET /api/v1/form/{id}/data
Query: ?page=1&limit=20
Response: { data: [...], total: 25 }
```

**Key Behavior:**
- Backend may return `form_schema` as STRING or OBJECT
- Version increments when `form_schema` changes
- Public endpoints don't require authentication

### UI/UX Components

#### Page Hierarchy

```
App.tsx (Router)
  ├─ /form/new → FormBuilderPage
  │   └─ AdvancedFormBuilder (create mode)
  │
  ├─ /form/:id → EntityDetailPage (entityType="form")
  │   ├─ Overview Tab: Displays form metadata
  │   └─ Special Renderer: InteractiveForm (fill mode)
  │
  ├─ /form/:id/edit → FormEditPage
  │   └─ AdvancedFormBuilder (edit mode with initialFormData)
  │
  ├─ /form/:sharedUrl → PublicFormPage
  │   └─ InteractiveForm (public mode, no auth)
  │
  └─ /form/:id/data/:subId → FormDataPreviewPage
      └─ FormSubmissionEditor (view/edit submission)
```

#### Component Flow

**FormBuilderPage** (`apps/web/src/pages/form/FormBuilderPage.tsx`)
```typescript
function FormBuilderPage() {
  const handleSave = async (formData) => {
    const payload = {
      name: formData.name,
      descr: formData.descr,
      form_type: 'multi_step',
      form_schema: formData.form_schema  // ⚠️ MUST be form_schema, not schema
    };

    const created = await formApi.create(payload);
    navigate(`/form/${created.id}`);
  };

  return (
    <AdvancedFormBuilder
      onSave={handleSave}
      onSaveDraft={handleSaveDraft}
    />
  );
}
```

**EntityDetailPage** (Special Rendering for Forms)
```typescript
// apps/web/src/pages/shared/EntityDetailPage.tsx:352-389
if (entityType === 'form') {
  // Parse schema if it's a string
  let schema = data.form_schema || {};
  if (typeof schema === 'string') {
    schema = JSON.parse(schema);
  }

  const steps = schema.steps || [];
  const fields = steps.flatMap(step =>
    (step.fields || []).map(field => ({
      ...field,
      id: field.id || field.name,
      stepId: step.id
    }))
  );

  return (
    <InteractiveForm
      formId={id}
      fields={fields}
      steps={steps}
      onSubmitSuccess={handleSuccess}
    />
  );
}
```

**InteractiveForm** (`apps/web/src/components/entity/form/InteractiveForm.tsx`)
```typescript
// REUSABLE: Used in 4+ contexts
// INCLUDES: DRY S3 integration for files, signatures, and initials
function InteractiveForm({ formId, fields, steps, onSubmitSuccess, isPublic }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formValues, setFormValues] = useState({});
  const [uploadingSignatures, setUploadingSignatures] = useState({});
  const [uploadingFiles, setUploadingFiles] = useState({});
  const [signatureUrls, setSignatureUrls] = useState({});
  const [fileUrls, setFileUrls] = useState({});

  // ✅ DRY: Generic S3 upload (works for files AND signatures)
  const uploadToS3 = async (fieldName, blob, fileName, contentType, uploadType) => {
    // Set loading state
    if (uploadType === 'signature') {
      setUploadingSignatures(prev => ({ ...prev, [fieldName]: true }));
    } else {
      setUploadingFiles(prev => ({ ...prev, [fieldName]: true }));
    }

    try {
      // Get presigned URL
      const { url, objectKey } = await getPresignedUploadUrl({
        tenantId: 'demo',
        entityType: 'form',
        entityId: formId,
        fileName,
        contentType
      });

      // Upload to S3
      await fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob });

      console.log(`✅ ${uploadType} uploaded to S3: ${objectKey}`);
      return objectKey;
    } finally {
      // Clear loading state
      if (uploadType === 'signature') {
        setUploadingSignatures(prev => ({ ...prev, [fieldName]: false }));
      } else {
        setUploadingFiles(prev => ({ ...prev, [fieldName]: false }));
      }
    }
  };

  // ✅ Thin wrapper: File upload
  const uploadFileToS3 = (fieldName, file) =>
    uploadToS3(fieldName, file, file.name, file.type, 'file');

  // ✅ Thin wrapper: Signature upload
  const uploadSignatureToS3 = async (fieldName, dataUrl) => {
    const blob = await fetch(dataUrl).then(r => r.blob());
    return uploadToS3(fieldName, blob, `${fieldName}_${Date.now()}.png`, 'image/png', 'signature');
  };

  const handleNext = () => setCurrentStep(prev => prev + 1);
  const handlePrevious = () => setCurrentStep(prev => prev - 1);

  const handleSubmit = async () => {
    const endpoint = isPublic
      ? `/api/v1/public/form/${formId}/submit`
      : `/api/v1/form/${formId}/submit`;

    // formValues contains S3 object keys for files/signatures, not actual data
    await api.post(endpoint, {
      submissionData: formValues,
      submissionStatus: 'submitted'
    });

    onSubmitSuccess?.();
  };

  return (
    <div>
      <StepProgressIndicator current={currentStep} total={steps.length} />
      <StepContent
        step={steps[currentStep]}
        values={formValues}
        onChange={setFormValues}
        onFileUpload={uploadFileToS3}          // File upload callback
        onSignatureChange={uploadSignatureToS3} // Signature upload callback
        uploadingFiles={uploadingFiles}
        uploadingSignatures={uploadingSignatures}
      />
      <Navigation>
        {currentStep > 0 && <Button onClick={handlePrevious}>Previous</Button>}
        {currentStep < steps.length - 1 && <Button onClick={handleNext}>Next</Button>}
        {currentStep === steps.length - 1 && <Button onClick={handleSubmit}>Submit</Button>}
      </Navigation>
    </div>
  );
}
```

---

## DRY Principles & Entity Relationships

### Reusable Component Patterns

#### 1. **InteractiveForm** - Single Component, Multiple Contexts

**Instead of:**
```typescript
// ❌ BAD: Separate components for each context
function FormBuilderPreview() { /* render logic */ }
function FormDetailView() { /* same render logic */ }
function PublicFormView() { /* same render logic again */ }
function TaskFormView() { /* repeated render logic */ }
```

**We use:**
```typescript
// ✅ GOOD: One component with props
<InteractiveForm formId={id} isPublic={false} />  // Entity detail
<InteractiveForm formId={id} isPublic={true} />   // Public page
<InteractiveForm formId={id} onSubmitSuccess={updateTask} />  // Task form
```

#### 2. **AdvancedFormBuilder** - Create & Edit Reuse

**Instead of:**
```typescript
// ❌ BAD: Separate builder components
function FormCreateBuilder() { /* builder logic */ }
function FormEditBuilder() { /* same builder logic */ }
```

**We use:**
```typescript
// ✅ GOOD: Same builder, different props
// Create mode
<AdvancedFormBuilder onSave={handleCreate} />

// Edit mode (pre-populated)
<AdvancedFormBuilder
  initialFormData={loadedForm}
  onSave={handleUpdate}
/>
```

#### 3. **Shared Utility Functions**

```typescript
// apps/web/src/pages/shared/EntityDetailPage.tsx
function parseFormSchema(schema: any) {
  if (typeof schema === 'string') {
    return JSON.parse(schema);
  }
  return schema || { steps: [] };
}
```

### Entity Relationships

```
Form (d_form_head)
  ├─ Project (via entity_id_map)
  │   └─ Project-specific forms (site surveys)
  ├─ Task (via entity_id_map or task.form_id)
  │   └─ Task completion checklists
  ├─ Client (via entity_id_map)
  │   └─ Client-facing intake forms
  └─ Submissions (via d_form_data.form_id)
      ├─ Submitted by Employee (submitted_by_empid)
      └─ Anonymous (public forms)
```

**Database Query: Get Forms for Project**
```sql
SELECT f.* FROM d_form_head f
INNER JOIN entity_id_map eim ON eim.child_entity_id = f.id::text
WHERE eim.parent_entity_id = $project_id
  AND eim.parent_entity_type = 'project'
  AND eim.child_entity_type = 'form'
  AND eim.active_flag = true
  AND f.active_flag = true;
```

**Database Query: Get Form Submissions**
```sql
SELECT
  fd.*,
  e.name as submitted_by_name
FROM d_form_data fd
LEFT JOIN d_employee e ON e.id = fd.submitted_by_empid
WHERE fd.form_id = $form_id
  AND fd.submission_status = 'submitted'
ORDER BY fd.created_ts DESC;
```

### Relationship Mapping Table

```sql
-- Forms can be linked to multiple entities
INSERT INTO entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
VALUES ('project', $project_id, 'form', $form_id);

INSERT INTO entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
VALUES ('task', $task_id, 'form', $form_id);

-- Query all entities linked to a form
SELECT DISTINCT
  eim.parent_entity_type,
  eim.parent_entity_id
FROM entity_id_map eim
WHERE eim.child_entity_id = $form_id::text
  AND eim.active_flag = true;
```

---

## Central Configuration & Middleware

### Entity Configuration Registry

**Location:** `apps/web/src/lib/entityConfig.ts:540-591`

```typescript
export const entityConfigs: Record<string, EntityConfig> = {
  form: {
    name: 'form',
    displayName: 'Form',
    pluralName: 'Forms',
    apiEndpoint: '/api/v1/form',
    shareable: true,  // ← Enables shared_url generation

    columns: [
      { key: 'name', title: 'Form Name', sortable: true, filterable: true },
      {
        key: 'active_flag',
        title: 'Status',
        sortable: true,
        render: (value) => value
          ? <Badge color="green">Active</Badge>
          : <Badge color="gray">Inactive</Badge>
      },
      { key: 'version', title: 'Version', sortable: true, align: 'center' },
      { key: 'updated_ts', title: 'Updated', sortable: true, render: formatDate }
    ],

    fields: [
      { key: 'name', label: 'Form Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'form_schema', label: 'Schema', type: 'jsonb', required: true }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  }
};
```

### RBAC Integration

**Location:** `apps/api/src/modules/form/routes.ts`

Every form endpoint checks permissions:

```typescript
// Create permission check (permission 4 = create)
const hasCreatePermission = await db.execute(sql`
  SELECT 1 FROM app.entity_id_rbac_map rbac
  WHERE rbac.empid = ${userId}
    AND rbac.entity = 'form'
    AND rbac.entity_id = 'all'  -- Type-level permission
    AND 4 = ANY(rbac.permission)
`);

if (!hasCreatePermission) {
  return reply.status(403).send({ error: 'Forbidden' });
}
```

**Permission Model:**
- `0` = View
- `1` = Edit
- `2` = Share
- `3` = Delete
- `4` = Create

### Special Entity Rendering

**Location:** `apps/web/src/lib/entityConfig.ts:2174-2182`

```typescript
export const SHAREABLE_ENTITIES = {
  form: {
    name: 'form',
    displayName: 'Form',
    icon: 'FileText',
    detailFields: ['name', 'descr', 'form_schema'],
    hasUpdates: false,
    customRenderer: true  // ← Triggers InteractiveForm rendering
  }
} as const;
```

When `customRenderer: true`, `EntityDetailPage` uses special rendering logic instead of standard field display.

### Schema Parsing Middleware

**Location:** `apps/web/src/pages/shared/EntityDetailPage.tsx:123-132`

```typescript
// Automatically parse form_schema on load
if (entityType === 'form' && responseData.form_schema && typeof responseData.form_schema === 'string') {
  try {
    responseData = {
      ...responseData,
      form_schema: JSON.parse(responseData.form_schema)
    };
  } catch (e) {
    console.error('Failed to parse form schema:', e);
  }
}
```

**Required in 6 locations:**
1. `FormEditPage.tsx:20`
2. `FormViewPage.tsx:40`
3. `PublicFormPage.tsx:33`
4. `EntityDetailPage.tsx:123`
5. `EntityDetailPage.tsx:359`
6. `TaskDataContainer.tsx:174`

---

## User Interaction Flow Examples

### Example 1: Employee Creates Site Inspection Form

**User Actions:**
1. Navigate to `/form/new`
2. Enter name: "Site Inspection Checklist"
3. Add Step 1: "Property Details"
   - Add field: address (text, required)
   - Add field: property_type (select)
4. Add Step 2: "Inspection Items"
   - Add field: roof_condition (select)
   - Add field: notes (textarea)
5. Click "Publish Form"

**System Flow:**
```
Frontend                           API                                Database
--------                           ---                                --------
1. FormBuilderPage
   ├─ User builds form
   └─ AdvancedFormBuilder
      └─ Generates schema:
         {
           steps: [
             { id: "step-1", fields: [...] },
             { id: "step-2", fields: [...] }
           ]
         }

2. Click "Publish"
   └─ handleSave()
      payload: {
        name: "Site Inspection...",
        form_type: "multi_step",
        form_schema: {...}       ⚠️ MUST be form_schema, not schema
      }

3. POST /api/v1/form
   Body: { name, form_schema }
                                   ├→ Authenticate (JWT)
                                   ├→ Check permission 4 (create)
                                   ├→ Generate slug: "site-inspection-1761234567890"
                                   ├→ Generate shared_url: "/form/aB3xK9mZ"
                                   ├→ INSERT INTO d_form_head
                                      (name, form_schema, version: 1)
   ←─ 201 Created
      { id: "ee8a6cfd...", shared_url: "/form/aB3xK9mZ" }

4. navigate(`/form/${created.id}`)
```

### Example 2: Fill Out Form (Authenticated)

**User Actions:**
1. Navigate to `/form/ee8a6cfd-9d31-4705-b8f3-ad2d5589802c`
2. Step 1 appears: Fill address, select property type
3. Click "Next"
4. Step 2 appears: Select roof condition, add notes
5. Click "Submit Form"

**System Flow:**
```
Frontend                           API                                Database
--------                           ---                                --------
1. EntityDetailPage loads
   └─ GET /api/v1/form/{id}
                                   ├→ SELECT * FROM d_form_head
                                      WHERE id = $id
   ←─ Returns form with form_schema

2. Parse & render
   ├─ Parse form_schema (if string)
   └─ InteractiveForm
      ├─ Step 1 (active)
      │  ├─ address: [123 Main St]
      │  └─ property_type: [Residential]
      │
      ├─ Click Next → Step 2
      │
      └─ Step 2 (active)
         ├─ roof_condition: [Good]
         └─ notes: [All clear]

3. Click "Submit Form"
   └─ POST /api/v1/form/{id}/submit
      Body: {
        submissionData: {
          address: "123 Main St",
          property_type: "Residential",
          roof_condition: "Good",
          notes: "All clear"
        },
        submissionStatus: "submitted"
      }
                                   ├→ Authenticate (JWT)
                                   ├→ Check permission 0 (view form)
                                   ├→ INSERT INTO d_form_data
                                      (form_id,
                                       submission_data,
                                       submitted_by_empid,
                                       submission_status)
   ←─ 201 Created
      { id: "sub-uuid", message: "Success" }

4. Show success message
```

### Example 3: Public Form Submission (Anonymous)

**User Actions:**
1. Receive email: "Please fill out this form: https://pmo.app/form/aB3xK9mZ"
2. Click link (no login required)
3. Fill form fields
4. Click "Submit"

**System Flow:**
```
Frontend                           API                                Database
--------                           ---                                --------
1. PublicFormPage
   └─ GET /api/v1/form/{id}
                                   ├→ SELECT * FROM d_form_head
                                      WHERE active_flag = true
   ←─ Returns public form (NO AUTH REQUIRED)

2. InteractiveForm (isPublic=true)
   └─ User fills fields

3. Click "Submit"
   └─ POST /api/v1/public/form/{id}/submit
      Body: {
        submissionData: {...}
      }
                                   ├→ NO AUTHENTICATION
                                   ├→ Verify form is active
                                   ├→ INSERT INTO d_form_data
                                      (form_id,
                                       submission_data,
                                       submitted_by_empid: '00000000...',  ← Anonymous UUID
                                       submission_ip: '203.0.113.45',
                                       submission_user_agent: 'Mozilla...')
   ←─ 201 Created

4. Show "Thank you" message
```

### Example 4: Edit Existing Form Schema

**User Actions:**
1. Navigate to `/form/ee8a6cfd-9d31-4705-b8f3-ad2d5589802c`
2. Click "Edit Form" button
3. Navigate to `/form/{id}/edit`
4. Modify schema: Add new field to Step 2
5. Click "Save"

**System Flow:**
```
Frontend                           API                                Database
--------                           ---                                --------
1. FormEditPage
   └─ GET /api/v1/form/{id}
                                   ├→ SELECT * FROM d_form_head
   ←─ Returns form { form_schema, version: 1 }

2. Parse schema
   └─ if (typeof form_schema === 'string') {
        form_schema = JSON.parse(form_schema);
      }

3. AdvancedFormBuilder
   ├─ initialFormData={loadedForm}
   └─ User modifies schema
      └─ Adds new field

4. Click "Save"
   └─ PUT /api/v1/form/{id}
      Body: {
        form_schema: { steps: [...] }  ← Updated schema
      }
                                   ├→ Compare old vs new schema
                                   ├→ Schema changed → version++
                                   ├→ UPDATE d_form_head
                                      SET form_schema = $1,
                                          version = 2,          ← Incremented
                                          updated_ts = now()
                                      WHERE id = $id
   ←─ 200 OK { version: 2 }

5. navigate(`/form/${id}`)
```

---

## Critical Considerations When Editing

### ⚠️ Breaking Changes to Avoid

#### 1. **Property Name Mismatch** ⭐⭐⭐ CRITICAL

**THE BUG WE FIXED:**

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

#### 2. **Backend Payload Validation**

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

#### 3. **Schema Parsing Required**

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

#### 4. **Field Name Restrictions**

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

#### 5. **Version Increments Automatically**

Backend auto-increments version when `form_schema` changes:

```typescript
// apps/api/src/modules/form/routes.ts:523-526
const schemaChanged = data.form_schema !== undefined &&
  JSON.stringify(data.form_schema) !== JSON.stringify(current.form_schema);

if (schemaChanged) {
  const newVersion = (current.version || 1) + 1;
  // UPDATE with new version
}
```

**Implications:**
- Same ID updates maintain history
- Old submissions reference original schema via version
- Breaking schema change = new version

#### 6. **Step ID Uniqueness**

Step IDs must be unique within a form:

```typescript
// ✅ GOOD - Auto-generated with timestamp
{ id: "step-1", name: "step_1", title: "Contact Info" }
{ id: "step-1760648883781", name: "step_2", title: "Address" }

// ❌ BAD - Duplicate IDs break field routing
{ id: "step-1", name: "step_1", title: "Contact Info" }
{ id: "step-1", name: "step_2", title: "Address" }  // Same ID!
```

**Why:** Fields use `stepId` to know which step they belong to. Duplicate IDs cause fields to render in wrong steps.

#### 7. **Soft Delete Only**

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

---

### 🔧 Safe Modification Patterns

#### Adding New Field Type

**1. Add to Field Type Palette** (`AdvancedFormBuilder.tsx:19-53`)
```typescript
const FIELD_TYPES_PALETTE = [
  // ... existing types
  {
    type: 'slider',
    label: 'Slider',
    icon: 'SlidersHorizontal',
    description: 'Range slider input'
  }
];
```

**2. Add Renderer** (`InteractiveForm.tsx:renderField()`)
```typescript
function renderField(field: FieldConfig) {
  switch (field.type) {
    // ... existing types
    case 'slider':
      return (
        <Slider
          min={field.min || 0}
          max={field.max || 100}
          value={values[field.name]}
          onChange={(val) => handleChange(field.name, val)}
        />
      );
    // ...
  }
}
```

**3. Update Type Definitions** (`FormBuilder.tsx`)
```typescript
export type FieldType = 'text' | 'email' | 'slider' | ...;
```

#### Adding Form Validation Rule

**Backend Validation** (`apps/api/src/modules/form/routes.ts`)
```typescript
fastify.addHook('preHandler', async (request, reply) => {
  if (request.url.endsWith('/submit')) {
    const form = await db.getForm(request.params.id);
    const submissionData = request.body.submissionData;

    // Validate required fields
    const schema = JSON.parse(form.form_schema);
    const requiredFields = schema.steps
      .flatMap(step => step.fields)
      .filter(f => f.required)
      .map(f => f.name);

    const missing = requiredFields.filter(name => !submissionData[name]);

    if (missing.length > 0) {
      return reply.status(400).send({
        error: 'Missing required fields',
        missing_fields: missing
      });
    }
  }
});
```

---

### 📝 Testing Checklist

When modifying form logic, verify:

- [ ] **Property names** match between builder and save handler (`form_schema` not `schema`)
- [ ] **Schema parsing** in all 6 required locations
- [ ] **Backend validation** accepts only documented fields
- [ ] **Version incrementing** on schema changes
- [ ] **Field name validation** (no spaces or special characters)
- [ ] **Step ID uniqueness** (no duplicates)
- [ ] **Multi-step navigation** (Previous/Next buttons work)
- [ ] **Form submission** (authenticated and public)
- [ ] **Submission data storage** (JSONB structure correct)
- [ ] **Public forms** work without authentication
- [ ] **Shared URLs** generate and redirect correctly
- [ ] **Form preview** renders correctly during building
- [ ] **Edit mode** loads existing forms correctly
- [ ] **Soft deletes** preserve submissions
- [ ] **RBAC checks** enforce permissions
- [ ] **File upload fields** upload to S3 (not stored as file data)
- [ ] **Signature/Initials fields** upload to S3 (not stored as base64)
- [ ] **S3 object keys** are stored in submission_data
- [ ] **Presigned URLs** generate for viewing saved files/signatures
- [ ] **Upload progress** displays when uploading files/drawing signatures
- [ ] **View file link** appears after successful upload
- [ ] **S3 backend health** endpoint returns healthy status
- [ ] **DRY principle** maintained (single uploadToS3 function for all upload types)

---

### 🧪 Testing Commands

```bash
# Start platform
./tools/start-all.sh

# Test form API
./tools/test-api.sh GET /api/v1/form
./tools/test-api.sh GET /api/v1/form/ee8a6cfd-9d31-4705-b8f3-ad2d5589802c

# Create form with proper schema
./tools/test-api.sh POST /api/v1/form '{
  "name": "Test Form",
  "form_type": "multi_step",
  "form_schema": {
    "steps": [
      {
        "id": "step-1",
        "name": "step_1",
        "title": "Contact Info",
        "fields": [
          {"name": "email", "label": "Email", "type": "email", "required": true}
        ]
      }
    ]
  }
}'

# Update form schema (version should increment)
./tools/test-api.sh PUT /api/v1/form/ee8a6cfd-9d31-4705-b8f3-ad2d5589802c '{
  "form_schema": {"steps": [...]}
}'

# Submit form data
./tools/test-api.sh POST /api/v1/form/ee8a6cfd-9d31-4705-b8f3-ad2d5589802c/submit '{
  "submissionData": {"email": "test@example.com"},
  "submissionStatus": "submitted"
}'

# List form submissions
./tools/test-api.sh GET /api/v1/form/ee8a6cfd-9d31-4705-b8f3-ad2d5589802c/data

# Check form in database
./tools/run_query.sh "SELECT id, name, form_schema, version FROM app.d_form_head WHERE id='ee8a6cfd-9d31-4705-b8f3-ad2d5589802c';"

# Check submissions
./tools/run_query.sh "SELECT * FROM app.d_form_data WHERE form_id='ee8a6cfd-9d31-4705-b8f3-ad2d5589802c';"

# View logs
./tools/logs-api.sh -f
./tools/logs-web.sh -f

# Test S3 backend for files and signatures
./tools/test-api.sh GET /api/v1/s3-backend/health
# Expected: { "status": "healthy", "bucket": "cohuron-attachments-...", "connected": true }

# Test file upload flow (requires form with file field)
# 1. Create form with file upload field
# 2. Navigate to form in browser
# 3. Select a file (PDF, image, etc.)
# 4. Check console logs for:
#    - "✅ File uploaded to S3: tenant_id=demo/..."
#    - "File uploaded to cloud storage"
#    - "View uploaded file" link appears
# 5. Submit form
# 6. Verify submission_data contains S3 object key (not file data)
./tools/run_query.sh "SELECT submission_data->>'file_field_name' FROM app.d_form_data WHERE form_id='...';"
# Expected: tenant_id=demo/entity=form/entity_id={uuid}/filename.pdf

# Test signature upload flow (requires form with signature field)
# 1. Create form with signature field
# 2. Navigate to form in browser
# 3. Draw signature
# 4. Check console logs for:
#    - "✅ Signature uploaded to S3: tenant_id=demo/..."
#    - "Signature saved to cloud storage"
# 5. Submit form
# 6. Verify submission_data contains S3 object key (not base64)
./tools/run_query.sh "SELECT submission_data->>'signature_field_name' FROM app.d_form_data WHERE form_id='...';"
# Expected: tenant_id=demo/entity=form/entity_id={uuid}/{hash}.png
```

---

## 📚 Related Documentation

- **[Database Schema](../db/README.md)** - Complete DDL reference
- **[API Guide](../apps/api/README.md)** - Backend architecture
- **[Frontend Guide](../apps/web/README.md)** - UI/UX patterns
- **[Entity Configuration](../apps/web/src/lib/entityConfig.ts)** - Configuration reference
- **[Project & Task Guide](./Project_Task.md)** - Related entity documentation
- **[S3 Attachment Service](./S3_ATTACHMENT_SERVICE_COMPLETE_GUIDE.md)** - Cloud storage architecture for signatures and attachments

---

## 🎯 Summary

**Forms** are the data collection engine of the PMO platform:

- **Schema-driven** - All behavior defined by `form_schema` JSONB
- **Builder-Renderer separation** - Clear contract between creation and display
- **Reusable components** - `InteractiveForm` used in 4+ contexts
- **Public access** - Anonymous submissions via shared URLs
- **Version control** - Schema changes tracked automatically
- **Entity integration** - Forms link to projects, tasks, employees
- **S3 Cloud Storage (DRY)** - Files, signatures, and initials stored in S3 with single generic upload function
- **DRY Architecture** - 44% less code through proper abstraction and thin wrappers

**Key Principle:** Property names matter! Always use `form_schema` (not `schema`) and `form_type` (not `formType`). Parse schema in all 6 required locations.

**Critical Bug:** The most common error is accessing `formData.schema` instead of `formData.form_schema`, which creates empty forms that can't be previewed.

**File & Signature Storage (DRY):** File uploads, signatures, and initials automatically upload to S3 via presigned URLs using a single generic `uploadToS3` function. The database stores only the S3 object key (e.g., `tenant_id=demo/entity=form/entity_id={uuid}/document.pdf`), not the file data or base64. This follows DRY principles with 44% less code, making it easy to maintain and extend.

**Upload Architecture:**
- **Generic function**: `uploadToS3(blob, fileName, contentType, uploadType)` - handles all uploads
- **Thin wrappers**: `uploadFileToS3()` and `uploadSignatureToS3()` - 8-12 lines each
- **Benefits**: Single source of truth, consistent error handling, easy to add new types (audio, video)

---

**Last Updated:** 2025-10-23 (DRY S3 integration for files & signatures)
**Maintainer:** PMO Platform Team
**Related Issues:**
- Property name mismatch bug (fixed 2025-10-23)
- S3 integration for signatures and initials (implemented 2025-10-23)
- S3 integration for file uploads (implemented 2025-10-23)
- DRY refactoring of upload functions (implemented 2025-10-23)
