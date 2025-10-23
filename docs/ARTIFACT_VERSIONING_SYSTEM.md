# Artifact Versioning System - SCD Type 2 Pattern

**Created:** 2025-10-23
**Status:** ✅ API Complete, Frontend Pending
**Pattern:** Slowly Changing Dimension (SCD) Type 2

---

## Executive Summary

The artifact system implements **SCD Type 2** versioning, where each version is a separate database row with temporal tracking. When an artifact is re-uploaded, the system:

1. Creates a NEW row in `d_artifact` with new ID
2. Uploads to S3 with new object key
3. Marks old row: `active_flag=false`, `is_latest_version=false`, `to_ts=now()`
4. Sets new row: `active_flag=true`, `is_latest_version=true`, `version=old+1`
5. Links versions via `parent_artifact_id`

---

## Database Schema

### Versioning Fields (d_artifact)

```sql
CREATE TABLE app.d_artifact (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- NEW ID for each version

    -- Metadata (inherited from previous version)
    name varchar(200) NOT NULL,
    descr text,
    tags jsonb,
    artifact_type varchar(50),

    -- S3 Storage (UNIQUE per version)
    bucket_name varchar(100),
    object_key varchar(500),  -- Different S3 object for each version
    file_size_bytes bigint,
    file_format varchar(20),

    -- Version Control (SCD Type 2)
    parent_artifact_id uuid,          -- NULL for v1, points to root for v2+
    is_latest_version boolean DEFAULT true,  -- Only one row has true
    version integer DEFAULT 1,        -- 1, 2, 3, ...

    -- Temporal Tracking
    from_ts timestamptz DEFAULT now(),  -- Effective from
    to_ts timestamptz,                   -- Effective to (NULL = current)
    active_flag boolean DEFAULT true,    -- true = current version
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now()
);
```

### Version Chain Example

```
Version 1 (Original):
├─ id: a1111111-1111-1111-1111-111111111111
├─ parent_artifact_id: NULL
├─ version: 1
├─ active_flag: false ❌
├─ is_latest_version: false
├─ from_ts: 2025-01-01 10:00:00
├─ to_ts: 2025-01-02 14:30:00
└─ object_key: tenant_id=demo/entity=project/entity_id=xxx/hash1.pdf

Version 2 (Edit + Re-upload):
├─ id: b2222222-2222-2222-2222-222222222222
├─ parent_artifact_id: a1111111... (points to v1)
├─ version: 2
├─ active_flag: false ❌
├─ is_latest_version: false
├─ from_ts: 2025-01-02 14:30:00
├─ to_ts: 2025-01-05 09:15:00
└─ object_key: tenant_id=demo/entity=project/entity_id=xxx/hash2.pdf

Version 3 (Current):
├─ id: c3333333-3333-3333-3333-333333333333
├─ parent_artifact_id: a1111111... (points to root)
├─ version: 3
├─ active_flag: true ✅
├─ is_latest_version: true ✅
├─ from_ts: 2025-01-05 09:15:00
├─ to_ts: NULL (current version)
└─ object_key: tenant_id=demo/entity=project/entity_id=xxx/hash3.pdf
```

**Key Points:**
- Each version has UNIQUE `id` and `object_key`
- All versions link to same `parent_artifact_id` (root version's ID)
- Only current version has `active_flag=true` and `is_latest_version=true`
- Temporal tracking via `from_ts` and `to_ts`

---

## API Endpoints

### 1. Create Artifact (Version 1)

**Endpoint:** `POST /api/v1/artifact/upload`

**Request:**
```json
{
  "name": "Project Blueprint",
  "descr": "Main architectural blueprint",
  "entityType": "project",
  "entityId": "proj-uuid-here",
  "fileName": "blueprint.pdf",
  "contentType": "application/pdf",
  "fileSize": 2458000,
  "tags": ["blueprint", "architecture"],
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
    "is_latest_version": true,
    "parent_artifact_id": null,
    "object_key": "tenant_id=demo/entity=project/entity_id=proj-uuid/hash1.pdf",
    "from_ts": "2025-01-01T10:00:00Z",
    "to_ts": null
  },
  "uploadUrl": "https://s3.amazonaws.com/presigned-upload-url...",
  "expiresIn": 3600
}
```

**Client Steps:**
1. POST to `/artifact/upload` with metadata
2. Receive presigned URL
3. PUT file to presigned URL
4. Done! Artifact v1 created

---

### 2. Upload New Version

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
    "is_latest_version": false,
    "to_ts": "2025-01-02T14:30:00Z"
  },
  "newArtifact": {
    "id": "b2222222-2222-2222-2222-222222222222",
    "version": 2,
    "active_flag": true,
    "is_latest_version": true,
    "parent_artifact_id": "a1111111-1111-1111-1111-111111111111",
    "object_key": "tenant_id=demo/entity=project/entity_id=proj-uuid/hash2.pdf",
    "from_ts": "2025-01-02T14:30:00Z",
    "to_ts": null
  },
  "uploadUrl": "https://s3.amazonaws.com/presigned-upload-url...",
  "expiresIn": 3600
}
```

**What Happens:**
1. Old artifact marked inactive (`active_flag=false`, `to_ts=now()`)
2. New row created with `version=2`, new ID, new S3 key
3. Presigned URL returned for new file upload
4. Both versions preserved in database and S3

---

### 3. Get Version History

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
      "to_ts": null,
      "file_size_bytes": 4200000
    },
    {
      "id": "b2222222-2222-2222-2222-222222222222",
      "version": 2,
      "active_flag": false,
      "from_ts": "2025-01-02T14:30:00Z",
      "to_ts": "2025-01-05T09:15:00Z",
      "file_size_bytes": 3120000
    },
    {
      "id": "a1111111-1111-1111-1111-111111111111",
      "version": 1,
      "active_flag": false,
      "from_ts": "2025-01-01T10:00:00Z",
      "to_ts": "2025-01-02T14:30:00Z",
      "file_size_bytes": 2458000
    }
  ],
  "rootArtifactId": "a1111111-1111-1111-1111-111111111111",
  "currentVersion": 3
}
```

---

### 4. Update Metadata Only (No New Version)

**Endpoint:** `PUT /api/v1/artifact/:id`

**Request:**
```json
{
  "descr": "Updated description only",
  "tags": ["blueprint", "architecture", "approved"]
}
```

**Behavior:**
- In-place update (same ID, same S3 file)
- Does NOT create new version
- Updates `updated_ts` only
- Use this for metadata changes without file re-upload

---

## Frontend Implementation Guide

### Reusable ArtifactForm Component

**Location:** `apps/web/src/components/artifact/ArtifactForm.tsx`

```typescript
interface ArtifactFormProps {
  mode: 'create' | 'edit';
  initialData?: Artifact;
  onSuccess?: (artifact: Artifact) => void;
}

export function ArtifactForm({ mode, initialData, onSuccess }: ArtifactFormProps) {
  const { uploadToS3 } = useS3Upload();
  const [formData, setFormData] = useState(initialData || {});
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'create') {
      // Step 1: Create artifact metadata
      const response = await fetch('/api/v1/artifact/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          descr: formData.descr,
          entityType: formData.entityType,
          entityId: formData.entityId,
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
          tags: formData.tags
        })
      });

      const { artifact, uploadUrl } = await response.json();

      // Step 2: Upload file to S3
      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
      });

      onSuccess?.(artifact);
    } else if (mode === 'edit' && file) {
      // Step 1: Request new version
      const response = await fetch(`/api/v1/artifact/${initialData.id}/new-version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
          descr: formData.descr
        })
      });

      const { newArtifact, uploadUrl } = await response.json();

      // Step 2: Upload new file to S3
      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
      });

      onSuccess?.(newArtifact);
    } else {
      // Metadata-only update (no new version)
      await fetch(`/api/v1/artifact/${initialData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descr: formData.descr,
          tags: formData.tags
        })
      });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        placeholder="Artifact Name"
        required
      />

      <textarea
        value={formData.descr}
        onChange={(e) => setFormData({ ...formData, descr: e.target.value })}
        placeholder="Description"
      />

      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        required={mode === 'create'}
      />

      {mode === 'edit' && initialData && (
        <div className="current-version-info">
          <p>Current Version: {initialData.version}</p>
          <p>File: {initialData.file_format} ({(initialData.file_size_bytes / 1024).toFixed(2)} KB)</p>
          {!file && <p className="note">Leave file empty to update metadata only</p>}
          {file && <p className="warning">⚠️ Uploading new file will create Version {initialData.version + 1}</p>}
        </div>
      )}

      <button type="submit">
        {mode === 'create' ? 'Create Artifact' : file ? `Upload Version ${(initialData?.version || 1) + 1}` : 'Update Metadata'}
      </button>
    </form>
  );
}
```

---

### Create Page

**Location:** `apps/web/src/pages/artifact/ArtifactCreatePage.tsx`

```typescript
export function ArtifactCreatePage() {
  const navigate = useNavigate();
  const { entityType, entityId } = useParams();

  return (
    <Layout>
      <h1>Upload New Artifact</h1>
      <ArtifactForm
        mode="create"
        initialData={{ entityType, entityId }}
        onSuccess={(artifact) => {
          toast.success(`Artifact created: Version ${artifact.version}`);
          navigate(`/artifact/${artifact.id}`);
        }}
      />
    </Layout>
  );
}
```

---

### Edit Page with Versioning

**Location:** `apps/web/src/pages/artifact/ArtifactEditPage.tsx`

```typescript
export function ArtifactEditPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [versions, setVersions] = useState<Artifact[]>([]);

  useEffect(() => {
    // Load artifact and version history
    Promise.all([
      fetch(`/api/v1/artifact/${id}`).then(r => r.json()),
      fetch(`/api/v1/artifact/${id}/versions`).then(r => r.json())
    ]).then(([art, verData]) => {
      setArtifact(art);
      setVersions(verData.data);
    });
  }, [id]);

  return (
    <Layout>
      <h1>Edit Artifact</h1>

      {artifact && (
        <>
          <ArtifactForm
            mode="edit"
            initialData={artifact}
            onSuccess={(newArtifact) => {
              toast.success(`New version created: v${newArtifact.version}`);
              navigate(`/artifact/${newArtifact.id}`);
            }}
          />

          <section className="version-history">
            <h2>Version History</h2>
            <table>
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Size</th>
                  <th>Effective From</th>
                  <th>Effective To</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {versions.map(v => (
                  <tr key={v.id}>
                    <td>v{v.version}</td>
                    <td>{(v.file_size_bytes / 1024).toFixed(2)} KB</td>
                    <td>{new Date(v.from_ts).toLocaleString()}</td>
                    <td>{v.to_ts ? new Date(v.to_ts).toLocaleString() : 'Current'}</td>
                    <td>{v.active_flag ? '✅ Active' : '📜 Archived'}</td>
                    <td>
                      <button onClick={() => downloadVersion(v.id)}>Download</button>
                      {!v.active_flag && (
                        <button onClick={() => restoreVersion(v.id)}>Restore</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </Layout>
  );
}
```

---

## User Workflows

### Workflow 1: Create New Artifact

```
User clicks "Upload Artifact"
    ↓
ArtifactCreatePage loads
    ↓
User fills form (name, description, file)
    ↓
Clicks "Create Artifact"
    ↓
POST /api/v1/artifact/upload (metadata)
    ↓
Receive presigned URL + artifact ID
    ↓
PUT to S3 presigned URL (file upload)
    ↓
Database: version=1, active_flag=true
    ↓
Navigate to /artifact/:id (detail view)
```

### Workflow 2: Update Metadata Only

```
User on /artifact/:id/edit
    ↓
Changes description/tags
    ↓
Does NOT upload new file
    ↓
Clicks "Update Metadata"
    ↓
PUT /api/v1/artifact/:id
    ↓
Same row updated (in-place)
    ↓
NO new version created
```

### Workflow 3: Upload New Version

```
User on /artifact/:id/edit
    ↓
Changes description (optional)
    ↓
Uploads NEW file
    ↓
Sees warning: "⚠️ Will create Version 2"
    ↓
Clicks "Upload Version 2"
    ↓
POST /api/v1/artifact/:id/new-version
    ↓
Old row: active_flag=false, to_ts=now()
New row: version=2, active_flag=true
    ↓
PUT to S3 presigned URL (new file)
    ↓
Navigate to new version /artifact/:newId
```

---

## S3 Storage Pattern

Each version gets its own S3 object:

```
s3://cohuron-attachments-prod-957207443425/
└── tenant_id=demo/entity=project/entity_id=proj-uuid/
    ├── abc123hash.pdf   (Version 1)
    ├── def456hash.pdf   (Version 2)
    └── ghi789hash.pdf   (Version 3 - current)
```

**Benefits:**
- No file replacement (audit trail preserved)
- Can download any historical version
- S3 lifecycle policies can archive old versions
- Easy rollback (just mark old version as active)

---

## Testing the System

### Test Script

```bash
# 1. Create artifact v1
curl -X POST http://localhost:4000/api/v1/artifact/upload \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Document",
    "entityType": "project",
    "entityId": "proj-uuid",
    "fileName": "test.pdf",
    "contentType": "application/pdf"
  }'

# Response: artifact.id = "art-v1-id"

# 2. Upload file to presigned URL
curl -X PUT "$PRESIGNED_URL" \
  -H "Content-Type: application/pdf" \
  --upload-file test.pdf

# 3. Create version 2
curl -X POST http://localhost:4000/api/v1/artifact/art-v1-id/new-version \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "fileName": "test_v2.pdf",
    "contentType": "application/pdf"
  }'

# 4. Get version history
curl -X GET http://localhost:4000/api/v1/artifact/art-v1-id/versions \
  -H "Authorization: Bearer $TOKEN"
```

### Verification Queries

```sql
-- See all versions
SELECT id, version, active_flag, is_latest_version, from_ts, to_ts
FROM app.d_artifact
WHERE id = 'root-id' OR parent_artifact_id = 'root-id'
ORDER BY version DESC;

-- Count versions
SELECT parent_artifact_id, COUNT(*) as version_count
FROM app.d_artifact
GROUP BY parent_artifact_id;

-- Find current version
SELECT * FROM app.d_artifact
WHERE active_flag = true AND is_latest_version = true;
```

---

## Summary

✅ **Backend Complete:**
- SCD Type 2 pattern implemented
- Version creation endpoint ready
- Version history endpoint ready
- Temporal tracking working

⏳ **Frontend Pending:**
- ArtifactForm component (reusable for create/edit)
- ArtifactEditPage with version UI
- Version history display
- File upload integration with versioning

✅ **Benefits:**
- Complete audit trail
- No data loss
- Temporal queries supported
- Scalable to millions of versions

---

**Next Steps:**
1. Implement `ArtifactForm` component
2. Create `ArtifactEditPage` with version UI
3. Add version history table
4. Test complete workflow
5. Add restore version feature (optional)

