# S3PhotoUpload Component

**Version:** 1.0.0 | **Location:** `apps/web/src/components/shared/file/S3PhotoUpload.tsx` | **Updated:** 2025-12-06

---

## Overview

S3PhotoUpload is a specialized component for uploading and managing profile photos with S3 storage. It provides a circular avatar-style interface with drag-and-drop support, image preview, and seamless S3 integration using the existing `useS3Upload` hook.

**Core Principles:**
- Avatar-style circular display with size variants (sm, md, lg)
- Drag and drop or click to browse
- S3 presigned URL upload flow
- JSONB storage format: `{ s3_bucket, s3_key }`
- Reuses existing S3 infrastructure (same as task-data attachments)

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      S3PHOTOUPLOAD ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STATE 1: No Photo                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                     ┌──────────────┐                                    ││
│  │                     │  ┌────────┐  │                                    ││
│  │                     │  │  👤    │  │  ← Placeholder avatar              ││
│  │                     │  └────────┘  │                                    ││
│  │                     └──────────────┘                                    ││
│  │                         (circular)                                      ││
│  │                                                                         ││
│  │                     [📷 Upload]                                         ││
│  │                                                                         ││
│  │            Drag and drop or click to upload                             ││
│  │            JPEG, PNG, GIF, WebP (max 5MB)                               ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  STATE 2: Photo Selected (Preview, Not Uploaded)                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                     ┌──────────────┐                                    ││
│  │                     │  ┌────────┐  │                                    ││
│  │                     │  │ 🖼️    │  │  ← Local preview (base64)          ││
│  │                     │  └────────┘  │                                    ││
│  │                     └──────────────┘                                    ││
│  │                                                                         ││
│  │              [💾 Save Photo]  [✖️ Cancel]                               ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  STATE 3: Uploading                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                     ┌──────────────┐                                    ││
│  │                     │  ┌────────┐  │                                    ││
│  │                     │  │   ⟳   │  │  ← Spinner overlay                 ││
│  │                     │  └────────┘  │                                    ││
│  │                     └──────────────┘                                    ││
│  │                                                                         ││
│  │              [⟳ Uploading...]  [✖️ Cancel]                              ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  STATE 4: Photo Uploaded (Existing Photo)                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                     ┌──────────────┐                                    ││
│  │                     │  ┌────────┐  │                                    ││
│  │                     │  │ 🖼️    │  │  ← S3 presigned URL               ││
│  │                     │  └────────┘  │    (loaded on mount)               ││
│  │                     └──────────────┘                                    ││
│  │                         (hover: 📷)  ← Camera overlay on hover          ││
│  │                                                                         ││
│  │               [📷 Change]  [🗑️ Remove]                                  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         UPLOAD DATA FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. FILE SELECTION                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────────┐ │
│  │ User drags  │ →  │ Validation  │ →  │ FileReader → base64 preview     │ │
│  │ or clicks   │    │ type/size   │    │ setSelectedFile(file)           │ │
│  └─────────────┘    └─────────────┘    └─────────────────────────────────┘ │
│                                                                              │
│  2. UPLOAD TO S3                                                            │
│  ┌─────────────┐    ┌─────────────────────────────────────────────────────┐│
│  │ "Save Photo"│ →  │ useS3Upload.uploadToS3({                           ││
│  │ clicked     │    │   entityCode: 'employee',                          ││
│  └─────────────┘    │   entityInstanceId: uuid,                          ││
│                     │   file, fileName, contentType,                      ││
│                     │   uploadType: 'file',                               ││
│                     │   fieldName: 'profile_photo'                        ││
│                     │ })                                                   ││
│                     └─────────────────────────────────────────────────────┘│
│                                       ↓                                     │
│  3. BACKEND FLOW (S3 Backend Service)                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  POST /api/v1/s3-backend/presigned-upload                              ││
│  │  {                                                                      ││
│  │    bucket: 'pmo-attachments',                                          ││
│  │    key: 'tenant_id=demo/entity=employee/{uuid}/profile_photo/{file}',  ││
│  │    contentType: 'image/jpeg',                                          ││
│  │    expiresIn: 3600                                                     ││
│  │  }                                                                      ││
│  │  Response: { url: 'https://s3...?X-Amz-Signature=...', objectKey }     ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                       ↓                                     │
│  4. DIRECT S3 UPLOAD                                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  PUT {presignedUrl}                                                    ││
│  │  Body: file                                                            ││
│  │  Headers: Content-Type: image/jpeg                                     ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                       ↓                                     │
│  5. SAVE TO DATABASE                                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  onChange({                                                            ││
│  │    s3_bucket: 'pmo-attachments',                                       ││
│  │    s3_key: 'tenant_id=demo/entity=employee/{uuid}/profile_photo/...'   ││
│  │  })                                                                     ││
│  │  → Parent calls PATCH /api/v1/employee/{id}                            ││
│  │    Body: { profile_photo_url: { s3_bucket, s3_key } }                  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         VIEW DATA FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. COMPONENT MOUNT (value has s3_key)                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  value = { s3_bucket: '...', s3_key: '...' }                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                       ↓                                     │
│  2. GET PRESIGNED DOWNLOAD URL                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  useS3Upload.getDownloadUrl(s3_key)                                    ││
│  │  → POST /api/v1/s3-backend/presigned-download                          ││
│  │  Response: { url: 'https://s3...?X-Amz-Signature=...' }                ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                       ↓                                     │
│  3. DISPLAY IMAGE                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  <img src={presignedUrl} className="rounded-full" />                   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Props Interface

```typescript
export interface S3PhotoData {
  s3_bucket: string;
  s3_key: string;
}

export interface S3PhotoUploadProps {
  /** Current value (JSONB with s3_bucket and s3_key) */
  value: S3PhotoData | null;

  /** Entity code for S3 path (e.g., 'employee') */
  entityCode: string;

  /** Entity instance ID for S3 path (e.g., employee UUID) */
  entityInstanceId: string;

  /** Callback when photo is uploaded or removed */
  onChange: (value: S3PhotoData | null) => void;

  /** Whether the component is disabled */
  disabled?: boolean;

  /** Whether the component is readonly */
  readonly?: boolean;

  /** Size variant */
  size?: 'sm' | 'md' | 'lg';

  /** Optional className */
  className?: string;
}
```

---

## Size Configuration

| Size | Avatar Dimensions | Icon Size | Use Case |
|------|-------------------|-----------|----------|
| `sm` | 64x64 (w-16 h-16) | 24x24 | Table cells, lists |
| `md` | 96x96 (w-24 h-24) | 32x32 | Cards, headers |
| `lg` | 128x128 (w-32 h-32) | 40x40 | Detail pages, forms |

---

## YAML Configuration

### Pattern Mapping (`pattern-mapping.yaml`)

```yaml
# S3/STORAGE FIELDS
# S3 photo reference (JSONB with s3_bucket + s3_key)
- { pattern: "profile_photo_url", exact: true, fieldBusinessType: s3_photo }
```

### View Type Mapping (`view-type-mapping.yaml`)

```yaml
s3_photo:
  dtype: jsonb
  entityListOfInstancesTable:
    <<: *table_default
    renderType: s3_avatar
    style: { align: center, width: "60px", size: sm }
  entityInstanceFormContainer:
    <<: *form_default
    renderType: s3_avatar
    style: { size: lg }
  kanbanView:
    renderType: s3_avatar
    behavior: { visible: true }
    style: { size: sm }
  gridView:
    renderType: s3_avatar
    behavior: { visible: true }
    style: { size: md }
```

### Edit Type Mapping (`edit-type-mapping.yaml`)

```yaml
s3_photo:
  dtype: jsonb
  entityListOfInstancesTable:
    inputType: readonly
    behavior: { editable: false, filterable: false, sortable: false, visible: false }
  entityInstanceFormContainer:
    inputType: component
    component: S3PhotoUpload
    behavior: { editable: true }
    style: { accept: "image/*", maxSize: 5242880, crop: true, aspectRatio: 1 }
```

---

## Database Schema

### Column Definition (employee.ddl)

```sql
-- Profile photo (S3 storage)
profile_photo_url jsonb DEFAULT NULL
-- S3 storage reference: {"s3_bucket": "...", "s3_key": "..."}
```

### JSON Structure

```json
{
  "s3_bucket": "pmo-attachments",
  "s3_key": "tenant_id=demo/entity=employee/8260b1b0-5efc-4611-ad33-ee76c0cf7f13/profile_photo/photo.jpg"
}
```

---

## Component Registration

### registerComponents.tsx

```typescript
// File/Photo components
import { S3PhotoUpload, type S3PhotoData } from '../../components/shared/file/S3PhotoUpload';

// VIEW MODE - S3 Avatar display
const S3AvatarView: React.FC<ComponentRendererProps> = ({ value, field }) => {
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(null);
  const s3Data = value as S3PhotoData | null;

  React.useEffect(() => {
    if (s3Data?.s3_key) {
      // Fetch presigned download URL
      fetch('/api/v1/s3-backend/presigned-download', {
        method: 'POST',
        body: JSON.stringify({ objectKey: s3Data.s3_key })
      })
      .then(res => res.json())
      .then(({ url }) => setPhotoUrl(url));
    }
  }, [s3Data?.s3_key]);

  // Render circular avatar or placeholder
};

// EDIT MODE - S3 Photo Upload wrapper
const S3PhotoUploadEdit: React.FC<ComponentRendererProps> = ({
  value, field, onChange, disabled, readonly
}) => {
  const entityCode = field.style?.entityCode || 'employee';
  const entityInstanceId = window.location.pathname.split('/').pop();

  return (
    <S3PhotoUpload
      value={value}
      entityCode={entityCode}
      entityInstanceId={entityInstanceId}
      onChange={onChange}
      disabled={disabled}
      readonly={readonly}
      size={field.style?.size || 'lg'}
    />
  );
};

// Registration
registerViewComponent('s3_avatar', S3AvatarView);
registerEditComponent('S3PhotoUpload', S3PhotoUploadEdit);
```

---

## Usage Examples

### Basic Usage (Standalone)

```tsx
import { S3PhotoUpload } from '@/components/shared/file/S3PhotoUpload';

function EmployeePhotoEditor({ employee, onUpdate }) {
  const handlePhotoChange = async (photoData) => {
    await api.patch(`/api/v1/employee/${employee.id}`, {
      profile_photo_url: photoData
    });
    onUpdate();
  };

  return (
    <S3PhotoUpload
      value={employee.profile_photo_url}
      entityCode="employee"
      entityInstanceId={employee.id}
      onChange={handlePhotoChange}
      size="lg"
    />
  );
}
```

### Automatic via Field Metadata

The component is automatically rendered by the field renderer system when:
1. Column name matches `profile_photo_url` pattern
2. Metadata system assigns `s3_photo` fieldBusinessType
3. View mode: `s3_avatar` renderType → S3AvatarView
4. Edit mode: `S3PhotoUpload` component → S3PhotoUploadEdit

```tsx
// EntitySpecificInstancePage automatically renders the field
// No manual component usage required - metadata-driven
<EntityInstanceFormContainer
  entityCode="employee"
  entityId={employeeId}
  // profile_photo_url field automatically uses S3PhotoUpload
/>
```

---

## File Validation

| Validation | Value | Error Message |
|------------|-------|---------------|
| File Types | image/jpeg, image/png, image/gif, image/webp | "Please select an image file" |
| Max Size | 5 MB (5,242,880 bytes) | "File size must be less than 5MB" |

---

## S3 Path Structure

```
pmo-attachments/
└── tenant_id=demo/
    └── entity=employee/
        └── {employee_uuid}/
            └── profile_photo/
                └── {filename}.{ext}
```

---

## Related Components

| Component | Relationship |
|-----------|--------------|
| [DragDropFileUpload](./DragDropFileUpload.md) | General file upload (similar pattern) |
| [Button](./Button.md) | Action buttons |
| [EntityInstanceFormContainer](./EntityInstanceFormContainer.md) | Parent form container |
| `useS3Upload` | S3 upload hook (shared) |

---

## S3 Backend Routes Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/s3-backend/presigned-upload` | POST | Get presigned URL for upload |
| `/api/v1/s3-backend/presigned-download` | POST | Get presigned URL for view |

---

## Accessibility

- Keyboard navigation: Tab to focus, Enter/Space to trigger file picker
- Screen reader: Describes upload state and file information
- Focus indicators: Ring highlight on avatar when focused

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0.0 | 2025-12-06 | Initial release with S3 integration |

---

**Last Updated:** 2025-12-06 | **Status:** Production Ready
