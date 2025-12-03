# DragDropFileUpload Component

**Version:** 10.0.0 | **Location:** `apps/web/src/components/shared/file/DragDropFileUpload.tsx` | **Updated:** 2025-12-03

---

## Overview

DragDropFileUpload is a reusable drag-and-drop file upload component with S3 integration. It supports drag-and-drop, click-to-browse, file preview with metadata, and context-aware labels for different entity types.

**Core Principles:**
- Drag and drop or click to browse
- S3 upload integration via useS3Upload hook
- Context-aware labels (Artifact, Invoice, Receipt)
- Progress indicator and success/error states

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DRAGDROPFILEUPLOAD ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STATE 1: No File Selected                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  {Title} (e.g., "File Upload", "Invoice Upload")                        ││
│  │  ┌───────────────────────────────────────────────────────────────────┐ ││
│  │  │                    ┌─────────┐                                    │ ││
│  │  │                    │   📤    │                                    │ ││
│  │  │                    └─────────┘                                    │ ││
│  │  │         Drop file here or click to browse                         │ ││
│  │  │    Upload documents, images, videos, or any file type             │ ││
│  │  │                                                                   │ ││
│  │  │  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - │ ││
│  │  │  (dashed border, drag highlight effect)                           │ ││
│  │  └───────────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  STATE 2: File Selected (Not Uploaded)                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  {Title}                                                                ││
│  │  ┌───────────────────────────────────────────────────────────────────┐ ││
│  │  │  [📤] document.pdf                                            [X] │ ││
│  │  │       2.45 KB                                                     │ ││
│  │  │                                                                   │ ││
│  │  │  [Upload to S3]                                                   │ ││
│  │  └───────────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  STATE 3: Uploading                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  [⟳] document.pdf                                                [X]  ││
│  │      2.45 KB                                                           ││
│  │  [⟳] Uploading...                                                     ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  STATE 4: Upload Complete                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  [✓] document.pdf                                                [X]  ││
│  │      2.45 KB                                                           ││
│  │  [✓] File uploaded successfully                                       ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Props Interface

```typescript
interface DragDropFileUploadProps {
  /** Entity type - determines context-aware labels */
  entityCode: 'artifact' | 'cost' | 'revenue';

  /** Currently selected file (before upload) */
  selectedFile: File | null;

  /** S3 object key (after successful upload) */
  uploadedObjectKey: string | null;

  /** Whether upload is in progress */
  isUploading: boolean;

  /** Called when user selects a file (drag or click) */
  onFileSelect: (file: File) => void;

  /** Called when user removes selected file */
  onFileRemove: () => void;

  /** Called when user clicks "Upload to S3" button */
  onFileUpload: () => void;

  /** Error message from upload */
  uploadError?: string;

  /** File type filter (e.g., ".pdf,.png,.jpg") */
  accept?: string;

  /** Disable all interactions */
  disabled?: boolean;
}
```

---

## Context-Aware Labels

| Entity Code | Title | Label | Description |
|-------------|-------|-------|-------------|
| `artifact` | File Upload | File | Upload documents, images, videos, or any file type |
| `cost` | Invoice Upload | Invoice | Upload invoice (PDF, PNG, JPG) |
| `revenue` | Sales Receipt Upload | Receipt | Upload sales receipt (PDF, PNG, JPG) |

---

## Usage Example

```tsx
import { DragDropFileUpload } from '@/components/shared/file/DragDropFileUpload';
import { useS3Upload } from '@/lib/hooks/useS3Upload';

function EntityCreatePage({ entityCode }) {
  const { uploadToS3, uploadingFiles, errors } = useS3Upload();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedObjectKey, setUploadedObjectKey] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const objectKey = await uploadToS3({
        entityCode,
        entityId: 'temp-' + Date.now(),
        file: selectedFile,
        fileName: selectedFile.name,
        contentType: selectedFile.type,
        uploadType: entityCode,
        tenantId: 'demo'
      });

      if (objectKey) {
        setUploadedObjectKey(objectKey);
        // Auto-populate form fields from file
        setFormData(prev => ({
          ...prev,
          name: selectedFile.name,
          attachment_format: selectedFile.name.split('.').pop(),
          attachment_size_bytes: selectedFile.size
        }));
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <DragDropFileUpload
      entityCode={entityCode}
      selectedFile={selectedFile}
      uploadedObjectKey={uploadedObjectKey}
      isUploading={isUploading}
      onFileSelect={setSelectedFile}
      onFileRemove={() => {
        setSelectedFile(null);
        setUploadedObjectKey(null);
      }}
      onFileUpload={handleFileUpload}
      accept=".pdf,.png,.jpg,.jpeg"
    />
  );
}
```

---

## Drag and Drop Handlers

```typescript
const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  if (!disabled) setIsDragging(true);
};

const handleDragLeave = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(false);
};

const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(false);

  if (disabled) return;

  const files = e.dataTransfer.files;
  if (files && files.length > 0) {
    onFileSelect(files[0]);
  }
};
```

---

## Styling

### Drop Zone (no file)
```css
.drop-zone {
  border: 2px dashed var(--dark-400);
  border-radius: 0.375rem;
  padding: 2rem;
  text-align: center;
  transition: all 150ms;
}

.drop-zone.dragging {
  border-color: var(--dark-3000);
  background: var(--dark-100);
  transform: scale(1.02);
}
```

### File Preview
```css
.file-preview {
  border: 1px solid var(--dark-300);
  border-radius: 0.375rem;
  padding: 1rem;
}
```

---

## Related Components

| Component | Relationship |
|-----------|--------------|
| [Button](./Button.md) | Upload button |
| [EntityCreatePage](./EntityCreatePage.md) | Parent usage |
| [EntitySpecificInstancePage](./EntitySpecificInstancePage.md) | Parent usage |
| `useS3Upload` | S3 upload hook |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v10.0.0 | 2025-12-03 | Design system v10.0 |
| v1.0.0 | 2025-10-01 | Initial release |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
