# EntityCreatePage

**Version:** 12.2.0 | **Location:** `apps/web/src/pages/shared/EntityCreatePage.tsx` | **Updated:** 2025-12-03

---

## Overview

EntityCreatePage is the universal "new" entity creation page that uses EntityInstanceFormContainer to render all fields from entityConfig. It provides consistent styling with EntitySpecificInstancePage and handles form submission, validation, and parent linkage.

**Core Principles:**
- Single component creates 27+ entity types
- Dynamically renders fields based on entityConfig
- Create-Link-Redirect pattern for child entities
- S3 file upload integration for artifacts

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ENTITYCREATEPAGE ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Route: /{entityCode}/new  (e.g., /project/new, /task/new)                  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                          Layout Shell                                    ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Header: [Back] Create New {Entity} [Cancel] [Save]                 │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Content Area                                                       │││
│  │  │                                                                     │││
│  │  │  ┌───────────────────────────────────────────────────────────────┐ │││
│  │  │  │  EntityInstanceFormContainer                                   │ │││
│  │  │  │  - All fields from entityConfig                               │ │││
│  │  │  │  - Mode: 'create' (always editing)                            │ │││
│  │  │  └───────────────────────────────────────────────────────────────┘ │││
│  │  │                                                                     │││
│  │  │  ┌───────────────────────────────────────────────────────────────┐ │││
│  │  │  │  DragDropFileUpload (for artifact/cost/revenue)               │ │││
│  │  │  │  - Drag & drop or click to browse                             │ │││
│  │  │  │  - S3 upload integration                                      │ │││
│  │  │  └───────────────────────────────────────────────────────────────┘ │││
│  │  │                                                                     │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Props Interface

```typescript
interface EntityCreatePageProps {
  /** Entity type code (e.g., 'project', 'task', 'employee') */
  entityCode: string;
}
```

---

## Key Features

### 1. Parent Context (Create-Link-Redirect)

```typescript
// Get parent context from navigation state (if creating from child list page)
const parentContext = location.state as {
  parentType?: string;    // e.g., 'project'
  parentId?: string;      // e.g., 'abc-123'
  returnTo?: string;      // Return URL after creation
} | undefined;
```

### 2. Default Values by Field Type

```typescript
const getDefaultFormData = () => {
  const defaults: Record<string, any> = { active_flag: true };

  config?.fields.forEach(field => {
    if (field.inputType === 'array') defaults[field.key] = [];
    else if (field.inputType === 'jsonb') defaults[field.key] = {};
    else if (field.inputType === 'component' && field.defaultValue)
      defaults[field.key] = field.defaultValue;
  });

  return defaults;
};
```

### 3. Entity-Specific Defaults

| Entity | Auto-Generated Fields |
|--------|----------------------|
| `artifact` | `code: ART-{timestamp}` |
| `cost` | `code: CST-{timestamp}`, `invoice_currency: CAD`, `exch_rate: 1.0` |
| `revenue` | `code: REV-{timestamp}`, `invoice_currency: CAD`, `exch_rate: 1.0` |

### 4. S3 File Upload (Artifacts)

```typescript
const { uploadToS3, uploadingFiles, errors: uploadErrors } = useS3Upload();

const handleFileUpload = async () => {
  const objectKey = await uploadToS3({
    entityCode: 'artifact',
    entityId: tempId,
    file: selectedFile,
    fileName: selectedFile.name,
    contentType: selectedFile.type,
    uploadType: 'artifact',
    tenantId: 'demo'
  });

  // Auto-populate form fields from uploaded file
  setFormData(prev => ({
    ...prev,
    name: selectedFile.name,
    attachment_format: fileExtension,
    attachment_size_bytes: selectedFile.size
  }));
};
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CREATE FLOW                                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Route Match: /task/new + state: { parentType: 'project', parentId: x }  │
│                                                                              │
│  2. Initialize Form:                                                         │
│     getDefaultFormData() → { active_flag: true, arrays: [], ... }           │
│                                                                              │
│  3. User Fills Form:                                                         │
│     handleChange(field, value) → setFormData(prev => ...)                   │
│                                                                              │
│  4. Submit Flow:                                                             │
│     a. Validate required fields                                             │
│     b. Create entity via API: POST /api/v1/{entity}                         │
│     c. Create linkage (if parent context):                                  │
│        POST /api/v1/linkage { parent_entity_type, parent_entity_id, ... }   │
│     d. Navigate to created entity: /{entity}/{newId}                        │
│                                                                              │
│  5. For Artifacts:                                                          │
│     a. File selected → handleFileUpload() → S3 upload                       │
│     b. Auto-populate: name, attachment_format, attachment_size_bytes        │
│     c. Submit includes s3_object_key                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Form Validation

```typescript
// Validate required fields before submission
const requiredFields = config?.fields.filter(f => f.required) || [];
for (const field of requiredFields) {
  if (!formData[field.key] || formData[field.key] === '') {
    throw new Error(`${field.label} is required`);
  }
}
```

---

## Routing Integration

```typescript
// App.tsx routing
<Route path="/:entityCode/new" element={<EntityCreatePage entityCode={entityCode} />} />

// Navigation with parent context
navigate('/task/new', {
  state: {
    parentType: 'project',
    parentId: projectId,
    returnTo: `/project/${projectId}/task`
  }
});
```

---

## Related Components

| Component | Relationship |
|-----------|--------------|
| [Layout](./Layout.md) | Application shell |
| [EntityInstanceFormContainer](./EntityInstanceFormContainer.md) | Form rendering |
| [DragDropFileUpload](./DragDropFileUpload.md) | File upload for artifacts |
| [EntitySpecificInstancePage](./EntitySpecificInstancePage.md) | Detail/edit page |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v12.2.0 | 2025-12-03 | inputType='component' support |
| v9.0.0 | 2025-11-26 | TanStack Query migration |
| v1.0.0 | 2025-10-01 | Initial release |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
