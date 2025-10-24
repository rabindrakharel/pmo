# Documentation Updates - Artifact Standardization (2025-10-24)

## Changes Made

### 1. **ui_ux_route_api.md** - Added Artifact Flow Examples

**Location:** Lines 672-951 (279 new lines)

**Added Content:**
- **Example 2:** Create Artifact with File Upload (7-step flow diagram)
- **Example 3:** Edit Artifact → Upload New Version (7-step flow diagram with SCD Type 2 pattern)

**Key Points Documented:**
- File uploads happen BEFORE database entity creation (S3 first, then PostgreSQL)
- Presigned URLs used for direct client-to-S3 uploads (no API proxy)
- EntityCreatePage conditionally renders file upload section for artifacts
- EntityDetailPage conditionally renders version upload section when editing artifacts
- New file upload = new version (SCD Type 2: new UUID, old version marked inactive)
- Metadata-only update = same version (regular UPDATE query)
- Database state table showing version chain with temporal tracking

### 2. **artifacts.md** - Needs Reference Update

**Action Required:**
- Add reference to new flow examples in ui_ux_route_api.md
- Update "User Interaction Flow Examples" section (currently lines 445-530)
- Cross-reference standardized patterns

---

## Current State

### Artifact Routes (apps/web/src/App.tsx)
```typescript
// Artifact uses custom routes (NOT auto-generated)
<Route path="/artifact" element={<EntityMainPage entityType="artifact" />} />
<Route path="/artifact/new" element={<EntityCreatePage entityType="artifact" />} />
<Route path="/artifact/:id" element={<EntityDetailPage entityType="artifact" />} />
```

### Create Flow (EntityCreatePage)
- Conditional file upload UI (shows only for artifacts)
- Upload to S3 → get objectKey → create entity with S3 reference
- Reuses existing EntityCreatePage (DRY principle)

### Edit Flow (EntityDetailPage)
- Conditional version upload UI (shows only for artifacts in edit mode)
- Warning: "⚠️ Uploading will create Version X+1"
- Upload file → call `/api/v1/artifact/:id/new-version` → navigate to new version
- No file → regular metadata update (no new version)

### S3 Integration
- **Hook:** useS3Upload (shared by create and edit)
- **Service:** S3AttachmentService (backend)
- **Endpoints:** /api/v1/s3-backend/presigned-upload, presigned-download
- **Bucket:** cohuron-attachments-prod-957207443425
- **Path:** tenant_id=demo/entity=artifact/entity_id={id}/{hash}.{ext}

### Versioning Pattern (SCD Type 2)
- Each version = new database row with new UUID
- Old version: active_flag=false, to_ts=NOW()
- New version: active_flag=true, to_ts=NULL, parent_artifact_id={root_id}
- Both files preserved in S3 (no overwrites)

---

## Files Modified

**Frontend:**
1. apps/web/src/App.tsx - Removed 'artifact' from coreEntities
2. apps/web/src/pages/shared/EntityCreatePage.tsx - Added file upload UI
3. apps/web/src/pages/shared/EntityDetailPage.tsx - Added version upload UI

**Documentation:**
1. docs/ui_ux_route_api.md - Added Examples 2 & 3 (artifact flows)
2. docs/_documentation_change.md - This file
3. docs/artifacts.md - Pending update

---

**Last Updated:** 2025-10-24
