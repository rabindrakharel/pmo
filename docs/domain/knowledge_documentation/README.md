# Knowledge & Documentation Domain

> **Purpose**: Organizational knowledge management with wikis, forms, artifacts, and reports. Head/Data pattern for versioning, publication workflows, and S3 attachment management.

## Domain Overview

The Knowledge & Documentation Domain provides comprehensive knowledge management capabilities including wikis (knowledge base), dynamic forms (data collection), artifacts (document repository), and reports (structured outputs). All entities follow a Head/Data pattern separating metadata from content, enabling version control, publication workflows, and secure S3 storage for large files.

### Business Value

- **Wiki Knowledge Base** with hierarchical page structure and rich content editing
- **Dynamic Forms** for standardized data collection with field-level validation
- **Document Repository** with version control, security classification, and S3 storage
- **Report Library** for structured report templates and generated outputs
- **Publication Workflow** with draft → review → published → archived lifecycle
- **Version Tracking** with complete edit history and audit trails
- **Access Control** with visibility settings and security classifications

## Entities

| Entity | DDL File | Table | Purpose |
|--------|----------|-------|---------|
| **Wiki** | XIX_d_wiki.ddl | `d_wiki` | Knowledge base pages with hierarchical structure and publication workflow (metadata) |
| **Wiki Data** | XX_d_wiki_data.ddl | `d_wiki_data` | Wiki page content versions with rich text editing (content) |
| **Reports** | XXI_d_reports.ddl | `d_reports` | Report templates and configurations (metadata) |
| **Report Data** | XXII_d_report_data.ddl | `d_report_data` | Generated report instances with outputs (content) |
| **Artifact** | XV_d_artifact.ddl | `d_artifact` | Document and file metadata with S3 references (metadata) |
| **Artifact Data** | XVI_d_artifact_data.ddl | `d_artifact_data` | Document content versions and file chunks (content) |
| **Form Head** | XVII_form.ddl | `form` | Form templates with field definitions (metadata) |
| **Form Data** | XVIII_d_form_data.ddl | `d_form_data` | Form submission instances with user responses (content) |

## Entity Relationships

```
┌───────────────────────────────────────────────────────────────────────┐
│           KNOWLEDGE & DOCUMENTATION DOMAIN                           │
│                    (Head/Data Pattern)                                │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────┐         has versions       ┌─────────────────┐  │
│  │   Wiki (Head)   │──────────────────────────► │  Wiki Data      │  │
│  │   (d_wiki)      │                            │ (d_wiki_data)   │  │
│  │                 │                            │                 │  │
│  │ • Page Path     │                            │ • Content (v1)  │  │
│  │ • Category      │                            │ • Content (v2)  │  │
│  │ • Visibility    │                            │ • Content (v3)  │  │
│  │ • Pub Status    │                            │ • Rich Text     │  │
│  │ • Hierarchy     │                            │ • Blocks JSONB  │  │
│  └─────────────────┘                            └─────────────────┘  │
│         │                                                             │
│         │ parent_wiki_id (hierarchy)                                 │
│         │                                                             │
│  ┌─────────────────┐         has versions       ┌─────────────────┐  │
│  │ Artifact (Head) │──────────────────────────► │ Artifact Data   │  │
│  │  (d_artifact)   │                            │(d_artifact_data)│  │
│  │                 │                            │                 │  │
│  │ • Artifact Type │                            │ • File Chunks   │  │
│  │ • S3 Bucket     │                            │ • Version Hist  │  │
│  │ • S3 Key        │                            │ • Content Blob  │  │
│  │ • Security Class│                            │ • S3 References │  │
│  │ • Entity Link   │                            └─────────────────┘  │
│  └─────────────────┘                                                 │
│         │                                                             │
│         │ linked to                                                  │
│         ▼                                                             │
│  ┌─────────────────┐         has instances      ┌─────────────────┐  │
│  │  Form Head      │──────────────────────────► │   Form Data     │  │
│  │ (form)   │                            │ (d_form_data)   │  │
│  │                 │                            │                 │  │
│  │ • Form Type     │                            │ • Submission    │  │
│  │ • Fields JSONB  │                            │ • User Answers  │  │
│  │ • Validation    │                            │ • Responses     │  │
│  │ • Template      │                            │ • Completion    │  │
│  └─────────────────┘                            └─────────────────┘  │
│         │                                                             │
│         │                                                             │
│  ┌─────────────────┐         has runs           ┌─────────────────┐  │
│  │ Reports (Head)  │──────────────────────────► │  Report Data    │  │
│  │  (d_reports)    │                            │(d_report_data)  │  │
│  │                 │                            │                 │  │
│  │ • Report Type   │                            │ • Generated     │  │
│  │ • Parameters    │                            │ • Output Format │  │
│  │ • Schedule      │                            │ • Result Set    │  │
│  │ • Query SQL     │                            │ • PDF/Excel/CSV │  │
│  └─────────────────┘                            └─────────────────┘  │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │              Polymorphic Entity References                     │  │
│  │                                                                 │  │
│  │  Wiki → Project (documentation)                                │  │
│  │  Artifact → Task (attachments)                                 │  │
│  │  Form → Customer (intake forms)                                │  │
│  │  Report → Business (financial reports)                         │  │
│  │                                                                 │  │
│  │  Linkage via:                                                  │  │
│  │  • entity_code (e.g., 'project')                               │  │
│  │  • entity_id (UUID of parent entity)                           │  │
│  │  • d_entity_instance_link (polymorphic parent-child)                  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    S3 Storage Pattern                          │  │
│  │                                                                 │  │
│  │  Artifact/Wiki content stored in S3:                           │  │
│  │  • attachment: "s3://pmo-artifacts/2025/01/..."               │  │
│  │  • attachment_object_bucket: "pmo-artifacts"                   │  │
│  │  • attachment_object_key: "2025/01/ART-2025-00123.pdf"        │  │
│  │  • attachment_format: "pdf"                                    │  │
│  │  • attachment_size_bytes: 2458761                              │  │
│  │                                                                 │  │
│  │  Presigned URLs for secure download                            │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Relationship Rules

1. **Wiki → Wiki Data**: One-to-many
   - Wiki head defines page metadata (path, category, visibility)
   - Wiki data stores content versions (v1, v2, v3...)
   - Each edit creates new wiki data version
   - Current version flagged in wiki head

2. **Artifact → Artifact Data**: One-to-many
   - Artifact head defines file metadata (type, S3 location, security)
   - Artifact data stores file content versions
   - File updates create new artifact data records
   - Latest version flagged

3. **Form Head → Form Data**: One-to-many
   - Form head defines template (fields, validation rules)
   - Form data stores user submissions (one per submission)
   - Multiple customers can submit same form
   - Each submission is unique form data instance

4. **Reports → Report Data**: One-to-many
   - Reports head defines template (query, parameters, schedule)
   - Report data stores generated report outputs
   - Each report run creates new report data instance
   - Historical report outputs preserved

5. **Wiki Hierarchy**: Self-referential
   - Wiki pages can have parent_wiki_id → parent wiki page
   - Enables hierarchical knowledge base (Home → Category → Subcategory → Page)
   - Tree structure navigation

6. **Polymorphic Parent Linking**:
   - All entities support `entity_code` + `entity_id` pattern
   - Wiki linked to Project (project documentation)
   - Artifact linked to Task (task attachments)
   - Form linked to Customer (customer intake forms)
   - Report linked to Business (business unit reports)

## Business Semantics

### Wiki Publication Workflow

```
Draft → In Review → Published → Archived
  │          │           │          │
  ▼          ▼           ▼          ▼
Editable  Locked    Visible    Hidden
          for       to all     from search
          review
```

**Publication Statuses** (`publication_status`):
- **Draft**: Page being authored, visible only to creator
- **In Review**: Submitted for review, visible to reviewers
- **Published**: Live and visible based on visibility settings
- **Archived**: Deprecated but preserved for history
- **Deleted**: Soft deleted (active_flag = false)

**Visibility Settings** (`visibility`):
- **Public**: Visible to all employees
- **Internal**: Visible to specific business unit/office
- **Private**: Visible only to creator and specified users
- **Confidential**: Restricted to authorized personnel only

### Wiki Types

**Types** (`wiki_type`):
- **Guide**: How-to guides and tutorials
- **Policy**: Company policies and procedures
- **SOP**: Standard Operating Procedures
- **Template**: Reusable templates
- **FAQ**: Frequently Asked Questions
- **Meeting Notes**: Meeting minutes and agendas
- **Project Documentation**: Project-specific docs

### Artifact Types and Security

**Artifact Types** (`dl__artifact_type`):
- **Document**: Word, PDF, text files
- **Spreadsheet**: Excel, CSV files
- **Presentation**: PowerPoint, slides
- **Image**: Photos, diagrams, screenshots
- **Video**: Training videos, recordings
- **Template**: Reusable document templates
- **Contract**: Legal contracts and agreements
- **Invoice**: Invoice copies (PDF)
- **Receipt**: Expense receipts

**Security Classifications** (`dl__artifact_security_classification`):
- **Public**: No restrictions
- **Internal Use Only**: Company employees only
- **Confidential**: Restricted access, need-to-know basis
- **Restricted**: Highly sensitive, minimal access
- **Client Confidential**: Client proprietary information

### Form Types and Field Definitions

**Form Types** (`form_type`):
- **Customer Intake**: New customer onboarding
- **Service Request**: Service request forms
- **Feedback Survey**: Customer satisfaction surveys
- **Employee Onboarding**: New employee forms
- **Incident Report**: Incident and accident reporting
- **Change Request**: Change order forms
- **Inspection Checklist**: Field inspection checklists

**Form Field Types** (in `form_fields_schema` JSONB):
```json
{
  "fields": [
    {
      "id": "field-1",
      "type": "text",
      "label": "Full Name",
      "required": true,
      "validation": {"minLength": 2, "maxLength": 100}
    },
    {
      "id": "field-2",
      "type": "email",
      "label": "Email Address",
      "required": true,
      "validation": {"format": "email"}
    },
    {
      "id": "field-3",
      "type": "select",
      "label": "Service Type",
      "required": true,
      "options": ["HVAC", "Plumbing", "Electrical", "Landscaping"]
    },
    {
      "id": "field-4",
      "type": "checkbox",
      "label": "Services Interested In",
      "required": false,
      "options": ["Installation", "Repair", "Maintenance", "Inspection"]
    },
    {
      "id": "field-5",
      "type": "textarea",
      "label": "Additional Notes",
      "required": false,
      "validation": {"maxLength": 500}
    },
    {
      "id": "field-6",
      "type": "date",
      "label": "Preferred Service Date",
      "required": true
    },
    {
      "id": "field-7",
      "type": "file",
      "label": "Upload Photos",
      "required": false,
      "validation": {"maxFileSize": 5000000, "acceptedFormats": ["jpg", "png", "pdf"]}
    }
  ]
}
```

### Report Types

**Report Types** (`dl__report_type`):
- **Financial**: P&L, balance sheet, cash flow
- **Sales**: Sales pipeline, revenue forecast
- **Operations**: Project status, task completion
- **Customer**: Customer analytics, satisfaction
- **Inventory**: Stock levels, reorder reports
- **Employee**: Timesheet, performance reports
- **Compliance**: Regulatory compliance reports

**Report Formats** (`report_format`):
- **PDF**: Formatted PDF document
- **Excel**: Excel spreadsheet (.xlsx)
- **CSV**: Comma-separated values
- **HTML**: Web page report
- **JSON**: Structured data export

## Data Patterns

### Head/Data Separation

All entities follow **Head/Data pattern** for versioning:

**Head Table** (metadata):
- Stores entity definition, configuration, settings
- Stable ID (never changes)
- Version number increments on updates
- Links to current/latest data version

**Data Table** (content):
- Stores actual content for each version
- Foreign key to head table
- Multiple versions per head record
- Timestamped for audit trail

**Benefits**:
- Complete version history
- Rollback to previous versions
- Audit compliance
- Metadata updates without content duplication

### Wiki Page Path Structure

Wiki pages use hierarchical paths:

```
/                               (Root)
├── /home                       (Home page)
├── /guides                     (Guides category)
│   ├── /guides/hvac            (HVAC guides)
│   │   ├── /guides/hvac/installation
│   │   └── /guides/hvac/troubleshooting
│   └── /guides/plumbing        (Plumbing guides)
├── /policies                   (Policies category)
│   ├── /policies/hr
│   │   ├── /policies/hr/vacation
│   │   └── /policies/hr/expense-reimbursement
│   └── /policies/safety
└── /templates                  (Templates category)
```

**Path Conventions**:
- Lowercase, hyphen-separated
- Max 255 characters
- Unique per page
- Hierarchical structure via parent_wiki_id

### Artifact Naming and S3 Storage

Artifacts stored in S3 with structured keys:

```
S3 Bucket: pmo-artifacts
S3 Key Structure: {year}/{month}/{artifact-code}-{filename}.{ext}

Examples:
- s3://pmo-artifacts/2025/01/ART-2025-00001-contract.pdf
- s3://pmo-artifacts/2025/01/ART-2025-00123-diagram.png
- s3://pmo-artifacts/2025/02/ART-2025-00456-spreadsheet.xlsx

Fields:
- attachment: "s3://pmo-artifacts/2025/01/ART-2025-00001-contract.pdf"
- attachment_object_bucket: "pmo-artifacts"
- attachment_object_key: "2025/01/ART-2025-00001-contract.pdf"
- attachment_format: "pdf"
- attachment_size_bytes: 1245678
```

**Presigned URL Pattern**:
- Generate temporary signed URL for secure download
- Expires after 1 hour
- No direct S3 access required
- Enforces RBAC permissions

### Form Submission Data

Form submissions stored as JSONB:

```json
{
  "form_id": "uuid-...",
  "submitted_by": "uuid-employee-...",
  "submitted_ts": "2025-01-10T14:30:00Z",
  "completion_status": "completed",
  "responses": [
    {
      "field_id": "field-1",
      "field_label": "Full Name",
      "value": "Jane Doe"
    },
    {
      "field_id": "field-2",
      "field_label": "Email Address",
      "value": "jane.doe@example.com"
    },
    {
      "field_id": "field-3",
      "field_label": "Service Type",
      "value": "HVAC"
    },
    {
      "field_id": "field-4",
      "field_label": "Services Interested In",
      "value": ["Installation", "Maintenance"]
    },
    {
      "field_id": "field-5",
      "field_label": "Additional Notes",
      "value": "Looking to replace old furnace before winter"
    }
  ],
  "metadata": {
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0...",
    "referrer": "https://huronhome.ca/services"
  }
}
```

## Use Cases

### UC-1: Wiki Page Creation and Publishing

**Actors**: Content Author, Reviewer, System

**Flow**:
1. Author creates new wiki page: "HVAC Installation Guide"
2. Sets metadata:
   - page_path: "/guides/hvac/installation"
   - parent_wiki_id: <HVAC Guides page>
   - category: "Guide"
   - visibility: "Public"
   - publication_status: "Draft"
3. Author writes content in rich text editor (blocks):
   - Introduction block (text)
   - Equipment list block (list)
   - Step-by-step instructions (numbered list)
   - Safety warnings block (callout)
   - Video tutorial block (embed)
4. Content saved to `d_wiki_data` (version 1)
5. Wiki head status = "Draft"
6. Author previews page
7. Author makes edits → new version created in `d_wiki_data` (version 2)
8. Author submits for review → status = "In Review"
9. Reviewer receives notification
10. Reviewer approves page
11. Page status → "Published"
12. Published timestamp set
13. Page visible to all employees (visibility = Public)
14. Page appears in wiki search results
15. Page accessible via path: /guides/hvac/installation

**Entities Touched**: Wiki, Wiki Data

### UC-2: Document Upload with Version Control

**Actors**: Project Manager, System

**Flow**:
1. PM uploads "Project Plan v1.0.pdf" to Project #450
2. System creates Artifact record:
   - artifact_number: ART-2025-00789
   - name: "Project Plan"
   - dl__artifact_type: "Document"
   - entity_code: "project"
   - entity_id: <Project #450 UUID>
   - security_classification: "Internal Use Only"
   - latest_version_flag: true
3. File uploaded to S3:
   - S3 key: "2025/01/ART-2025-00789-project-plan-v1.pdf"
   - Size: 2.3 MB
4. Artifact Data created (version 1)
5. One week later, PM uploads revised "Project Plan v2.0.pdf"
6. System updates Artifact:
   - latest_version_flag: false (version 1)
7. System creates new Artifact Data (version 2):
   - S3 key: "2025/01/ART-2025-00789-project-plan-v2.pdf"
   - Size: 2.5 MB
   - latest_version_flag: true
8. Artifact head now points to version 2
9. Version 1 preserved in artifact data (audit trail)
10. Users downloading artifact get version 2
11. Version history visible: v1 (Jan 10), v2 (Jan 17)

**Entities Touched**: Artifact, Artifact Data, Project, S3

### UC-3: Customer Intake Form Submission

**Actors**: Customer (web visitor), Sales Rep, System

**Flow**:
1. Customer visits website, clicks "Request Service"
2. System loads Form Head: "Customer Intake Form"
3. Form rendered with fields:
   - Full Name (text, required)
   - Email (email, required)
   - Phone (tel, required)
   - Service Type (select, required)
   - Preferred Date (date, required)
   - Additional Notes (textarea, optional)
4. Customer fills out form:
   - Name: "Michael Johnson"
   - Email: "michael.j@example.com"
   - Phone: "+1-519-555-8765"
   - Service: "Plumbing"
   - Date: "2025-01-20"
   - Notes: "Leaking faucet in kitchen"
5. Customer clicks "Submit"
6. System validates all required fields
7. System creates Form Data record:
   - form_id: <Intake Form UUID>
   - submission_number: FORM-2025-00567
   - responses: <JSONB with all answers>
   - submitted_ts: 2025-01-10 15:45:00
   - completion_status: "completed"
8. System sends confirmation email to customer
9. System creates notification for Sales Rep
10. Sales Rep reviews submission in CRM
11. Sales Rep converts form to Customer record
12. Sales Rep creates Task: "Follow up - Michael Johnson - Plumbing"
13. Form data linked to Customer via entity_id_map

**Entities Touched**: Form Head, Form Data, Customer (Customer 360), Task (Operations)

## Technical Architecture

### Key Tables

```sql
-- Wiki (Head)
CREATE TABLE app.d_wiki (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    page_path text UNIQUE,                          -- /guides/hvac/installation
    category text,
    dl__wiki_type text,                             -- Guide, Policy, SOP, etc.
    parent_wiki_id uuid,                            -- Self-referential hierarchy
    visibility text,                                -- Public, Internal, Private
    publication_status text,                        -- Draft, Published, Archived
    published_ts timestamptz,
    active_flag boolean DEFAULT true,
    version integer DEFAULT 1
);

-- Wiki Data (Content)
CREATE TABLE app.d_wiki_data (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    wiki_id uuid NOT NULL,                          -- FK to d_wiki
    content_blocks jsonb,                           -- Rich text blocks
    version integer DEFAULT 1,
    created_ts timestamptz DEFAULT now()
);

-- Artifact (Head)
CREATE TABLE app.d_artifact (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    dl__artifact_type text,                         -- Document, Image, Video
    attachment_format text,                         -- pdf, xlsx, png
    attachment_size_bytes bigint,
    attachment_object_bucket text,                  -- S3 bucket
    attachment_object_key text,                     -- S3 key
    attachment text,                                -- Full S3 URI
    entity_code text,                               -- project, task, etc.
    entity_id uuid,                                 -- Parent entity ID
    dl__artifact_security_classification text,      -- Public, Confidential
    latest_version_flag boolean DEFAULT true,
    active_flag boolean DEFAULT true,
    version integer DEFAULT 1
);

-- Form Head (Template)
CREATE TABLE app.form (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    form_type text,                                 -- Customer Intake, Survey
    form_fields_schema jsonb,                       -- Field definitions
    active_flag boolean DEFAULT true,
    version integer DEFAULT 1
);

-- Form Data (Submissions)
CREATE TABLE app.d_form_data (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_number varchar(50) UNIQUE NOT NULL,
    form_id uuid NOT NULL,
    responses jsonb,                                -- User answers
    completion_status text,                         -- completed, partial
    submitted_ts timestamptz,
    submitted_by uuid                               -- Employee or Customer
);

-- Reports (Head)
CREATE TABLE app.d_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) UNIQUE NOT NULL,
    name varchar(200) NOT NULL,
    dl__report_type text,                           -- Financial, Sales, etc.
    report_query_sql text,                          -- Query template
    parameters_schema jsonb,                        -- Report parameters
    schedule_cron text,                             -- Auto-run schedule
    report_format text,                             -- PDF, Excel, CSV
    active_flag boolean DEFAULT true
);

-- Report Data (Outputs)
CREATE TABLE app.d_report_data (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_number varchar(50) UNIQUE NOT NULL,
    report_id uuid NOT NULL,
    generated_ts timestamptz,
    parameters_used jsonb,
    output_s3_url text,                             -- S3 location of output
    row_count integer,
    status text                                     -- completed, failed, running
);
```

### API Endpoints

```
# Wiki
GET    /api/v1/wiki                     # List wiki pages
GET    /api/v1/wiki/:id                 # Get wiki page
POST   /api/v1/wiki                     # Create wiki page
PUT    /api/v1/wiki/:id                 # Update wiki page
DELETE /api/v1/wiki/:id                 # Soft delete wiki page
GET    /api/v1/wiki/:id/versions        # Get version history
GET    /api/v1/wiki/:id/children        # Get child pages

# Artifact
GET    /api/v1/artifact                 # List artifacts
GET    /api/v1/artifact/:id             # Get artifact metadata
POST   /api/v1/artifact                 # Upload artifact
PUT    /api/v1/artifact/:id             # Update metadata
DELETE /api/v1/artifact/:id             # Soft delete artifact
GET    /api/v1/artifact/:id/download    # Download artifact (presigned URL)
GET    /api/v1/artifact/:id/versions    # Get version history

# Form
GET    /api/v1/form                     # List form templates
GET    /api/v1/form/:id                 # Get form template
POST   /api/v1/form                     # Create form template
POST   /api/v1/form/:id/submit          # Submit form data
GET    /api/v1/form/:id/submissions     # Get all submissions

# Report
GET    /api/v1/report                   # List reports
GET    /api/v1/report/:id               # Get report template
POST   /api/v1/report/:id/run           # Run report
GET    /api/v1/report/:id/outputs       # Get report outputs
GET    /api/v1/report/data/:id/download # Download report output
```

## Integration Points

### Upstream Dependencies

- **Customer 360 Domain**: Employee (authors, reviewers), Customer (form submissions)
- **Operations Domain**: Project, Task (entity linking for wikis, artifacts)
- **All Domains**: Polymorphic parent linking for documentation

### Downstream Dependencies

- **None** - Knowledge & Documentation is a supporting domain

## Data Volume & Performance

### Expected Data Volumes

- Wiki Pages: 1,000 - 10,000 pages
- Wiki Data (versions): 10,000 - 100,000 versions
- Artifacts: 10,000 - 100,000 files
- Form Templates: 50 - 500 templates
- Form Submissions: 10,000 - 100,000 per year
- Reports: 100 - 1,000 templates
- Report Outputs: 10,000 - 100,000 per year

### Indexing Strategy

```sql
-- Wiki indexes
CREATE INDEX idx_wiki_path ON app.d_wiki(page_path);
CREATE INDEX idx_wiki_parent ON app.d_wiki(parent_wiki_id);
CREATE INDEX idx_wiki_status ON app.d_wiki(publication_status);
CREATE INDEX idx_wiki_type ON app.d_wiki(dl__wiki_type);

-- Artifact indexes
CREATE INDEX idx_artifact_type ON app.d_artifact(dl__artifact_type);
CREATE INDEX idx_artifact_entity ON app.d_artifact(entity_code, entity_id);
CREATE INDEX idx_artifact_security ON app.d_artifact(dl__artifact_security_classification);

-- Form indexes
CREATE INDEX idx_form_type ON app.form(form_type);
CREATE INDEX idx_form_data_form ON app.form_data(form_id);
CREATE INDEX idx_form_data_submitted ON app.d_form_data(submitted_ts);
```

## Future Enhancements

1. **Wiki Collaboration**: Real-time collaborative editing (like Google Docs)
2. **Version Diffing**: Visual diff between wiki/artifact versions
3. **Advanced Search**: Full-text search across all wiki content
4. **Templates Library**: Pre-built wiki/form templates
5. **AI Summarization**: Auto-generate summaries for long wiki pages
6. **Workflow Approvals**: Multi-step approval workflow for sensitive documents
7. **External Sharing**: Secure external sharing links with expiration
8. **E-Signatures**: Digital signature support for contracts/forms
9. **OCR**: Extract text from scanned PDFs/images
10. **Knowledge Graph**: Visualize relationships between wiki pages

---

**Domain Owner**: Knowledge Management & Documentation Teams
**Last Updated**: 2025-11-13
**Related Domains**: All domains (supporting documentation across platform)
