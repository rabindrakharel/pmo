# Shared URL System - Implementation Summary

## Overview

A comprehensive, DRY (Don't Repeat Yourself) factory pattern system for generating and managing public shared URLs across all entity types in the PMO platform.

## Architecture

### URL Format

**Database Storage**: `/{entity}/{8-char-code}`
- Example: `/task/qD7nC3xK`
- Example: `/form/pQ7wM2nX`
- Example: `/wiki/zR4yL8kJ`

**Frontend Public Route**: `/{entity}/shared/{8-char-code}` ✅
- Example: `http://localhost:5173/task/shared/qD7nC3xK`
- Example: `http://localhost:5173/form/shared/pQ7wM2nX`
- **Important**: The database stores `/{entity}/{code}` but the ShareURLSection component automatically converts this to `/{entity}/shared/{code}` when displaying to users

**API Resolver Endpoint**: `/api/v1/shared/{entity}/{8-char-code}` (PUBLIC - No Auth Required)
- Example: `http://localhost:4000/api/v1/shared/task/qD7nC3xK`

## Implementation Components

### 1. Database Schema (DDL Updates)

**Files Updated:**
- `db/19_d_task.ddl` - Already had fields
- `db/23_d_form_head.ddl` - Already had fields
- `db/25_d_wiki.ddl` - Added `internal_url` and `shared_url`
- `db/21_d_artifact.ddl` - Added `internal_url` and `shared_url`

**Fields Added to Each Table:**
```sql
internal_url varchar(500),   -- Internal URL: /{entity}/{id} (authenticated access)
shared_url varchar(500),     -- Public shared URL: /{entity}/{8-char-random} (no auth)
```

### 2. Backend API Layer

#### Shared URL Factory (`apps/api/src/lib/shared-url-factory.ts`)

**Core Functions:**
```typescript
// Generate random 8-character code
generateSharedCode(): string

// Generate shared URL string for database
generateSharedUrl(entityType: string, code: string): string

// Save shared URL to database
saveSharedUrl(entityType: string, entityId: string, sharedCode: string): Promise<any>

// Complete workflow: generate + save
createSharedUrl(entityType: string, entityId: string): Promise<{sharedUrl, sharedCode, internalUrl}>

// Resolve shared code to entity data (PUBLIC)
resolveSharedUrl(entityType: string, sharedCode: string): Promise<any | null>

// Check if code is available
isSharedCodeAvailable(entityType: string, sharedCode: string): Promise<boolean>

// Get existing shared URL info
getSharedUrlInfo(entityType: string, entityId: string): Promise<{sharedUrl, internalUrl} | null>
```

**Entity-Table Mapping:**
```typescript
const ENTITY_TABLE_MAP: Record<string, string> = {
  task: 'd_task',
  form: 'd_form_head',
  wiki: 'd_wiki',
  artifact: 'd_artifact',
  project: 'd_project',
  biz: 'd_business',
  office: 'd_office',
  employee: 'd_employee',
  client: 'd_client',
  worksite: 'd_worksite',
  role: 'd_role',
  position: 'd_position',
};
```

#### Shared URL Routes (`apps/api/src/modules/shared/routes.ts`)

**Endpoints:**

1. **Resolve Shared URL (PUBLIC)**
   ```
   GET /api/v1/shared/{entityType}/{code}

   Response:
   {
     "entityType": "task",
     "entityId": "e1111111-1111-1111-1111-111111111111",
     "data": { ...entity data... }
   }
   ```

2. **Generate Shared URL (AUTHENTICATED)**
   ```
   POST /api/v1/shared/{entityType}/{id}/generate

   Requires: Edit permission on entity

   Response:
   {
     "sharedUrl": "/task/qD7nC3xK",
     "sharedCode": "qD7nC3xK",
     "internalUrl": "/task/e1111111-1111-1111-1111-111111111111"
   }
   ```

#### API Schema Updates

**Updated Files:**
- `apps/api/src/modules/task/routes.ts` - Added `internal_url`, `shared_url` to TaskSchema and queries
- `apps/api/src/modules/form/routes.ts` - Added `internal_url`, `shared_url` to FormSchema
- `apps/api/src/modules/wiki/routes.ts` - Added `internal_url`, `shared_url` to WikiSchema
- `apps/api/src/modules/artifact/routes.ts` - Added `internal_url`, `shared_url` to ArtifactSchema

### 3. Frontend UI Layer

#### SharedEntityPage Component (`apps/web/src/pages/shared/SharedEntityPage.tsx`)

**Universal Public Viewer:**
- ✅ Loads entity data via public API endpoint (no auth required)
- ✅ Dynamically renders appropriate component based on entity type
- ✅ Handles loading and error states
- ✅ Provides branded shared view header/footer
- ✅ **Renders WITHOUT sidebar or navigation** - Minimal layout for external sharing

**Entity-Specific Renderers:**
```typescript
- form → InteractiveForm (with isPublicView=true)
- wiki → WikiContentRenderer (with isPublicView=true)
- task → TaskDataContainer (with isPublicView=true)
- artifact → Custom artifact viewer
- default → Generic JSON viewer
```

**Routes Added to App.tsx:**
```typescript
{/* Shared Entity Routes (Public - No Auth Required) */}
<Route path="/task/shared/:code" element={<SharedEntityPage />} />
<Route path="/form/shared/:code" element={<SharedEntityPage />} />
<Route path="/wiki/shared/:code" element={<SharedEntityPage />} />
<Route path="/artifact/shared/:code" element={<SharedEntityPage />} />
<Route path="/:entityType/shared/:code" element={<SharedEntityPage />} />
```

## Usage Examples

### Backend: Generate Shared URL

```bash
# Generate shared URL for a task
curl -X POST http://localhost:4000/api/v1/shared/task/e1111111-1111-1111-1111-111111111111/generate \
  -H "Authorization: Bearer {token}"

# Response:
{
  "sharedUrl": "/task/qD7nC3xK",
  "sharedCode": "qD7nC3xK",
  "internalUrl": "/task/e1111111-1111-1111-1111-111111111111"
}
```

### Backend: Resolve Shared URL (Public)

```bash
# Resolve shared URL to entity data (NO AUTH REQUIRED)
curl http://localhost:4000/api/v1/shared/task/qD7nC3xK

# Response:
{
  "entityType": "task",
  "entityId": "e1111111-1111-1111-1111-111111111111",
  "data": {
    "id": "e1111111-1111-1111-1111-111111111111",
    "name": "Customer Service Process Optimization",
    "descr": "...",
    "internal_url": "/task/e1111111-1111-1111-1111-111111111111",
    "shared_url": "/task/qD7nC3xK",
    ...
  }
}
```

### Frontend: Access Shared Entity

**User Flow:**
1. User generates shared URL in task detail page
2. System generates code: `qD7nC3xK` and stores `/task/qD7nC3xK` in database
3. ShareURLSection converts to public format: `http://localhost:5173/task/shared/qD7nC3xK`
4. User shares link with external recipient
5. Recipient clicks link (NO LOGIN REQUIRED)
6. SharedEntityPage loads and displays task in **minimal view without sidebar/navigation**

**URL Format Conversion:**
- **Database**: `/task/qD7nC3xK`
- **User sees**: `http://localhost:5173/task/shared/qD7nC3xK`
- **Frontend route**: `/:entityType/shared/:code`
- **API call**: `/api/v1/shared/task/qD7nC3xK`

## Testing

### Verified Working:

✅ Database schema updated with `internal_url` and `shared_url` columns
✅ Shared URL factory generates unique 8-character codes
✅ Public API endpoint resolves shared codes to entity data
✅ Frontend routing configured for shared URLs
✅ ShareURLSection component fixed for task entity
✅ API returns shared URL data in entity responses

### Test Commands:

```bash
# Test task with shared URL
./tools/test-api.sh GET /api/v1/task/e1111111-1111-1111-1111-111111111111

# Test public shared URL resolver
curl http://localhost:4000/api/v1/shared/task/qD7nC3xK

# Check database
./tools/run_query.sh "SELECT id, name, internal_url, shared_url FROM app.d_task LIMIT 5;"
```

## Security Considerations

1. **Public Access**: Shared URLs provide unauthenticated access to entity data
2. **Revocation**: Delete `shared_url` value from database to revoke access
3. **Expiration**: Future enhancement - add `shared_url_expires_at` column
4. **Permissions**: Only users with edit permission can generate shared URLs
5. **Audit Trail**: `updated_ts` tracks when shared URLs are modified

## Future Enhancements

- [ ] Add expiration dates for shared URLs
- [ ] Add access analytics (view counts, timestamps)
- [ ] Add password protection option for shared URLs
- [ ] Add "share via email" feature
- [ ] Add QR code generation for shared URLs
- [ ] Add custom aliases (e.g., `/share/my-custom-name`)
- [ ] Add revocation API endpoint
- [ ] Add batch share URL generation

## Files Changed

### Database (3 files)
- `db/25_d_wiki.ddl`
- `db/21_d_artifact.ddl`
- `db/19_d_task.ddl` (already had fields)

### Backend API (8 files)
- `apps/api/src/lib/shared-url-factory.ts` (NEW)
- `apps/api/src/modules/shared/routes.ts` (NEW)
- `apps/api/src/modules/index.ts` (updated)
- `apps/api/src/modules/task/routes.ts` (updated schemas + queries)
- `apps/api/src/modules/form/routes.ts` (updated schemas)
- `apps/api/src/modules/wiki/routes.ts` (updated schemas)
- `apps/api/src/modules/artifact/routes.ts` (updated schemas)

### Frontend (3 files)
- `apps/web/src/pages/shared/SharedEntityPage.tsx` (NEW - renders without sidebar/navigation)
- `apps/web/src/App.tsx` (updated routing with /:entityType/shared/:code)
- `apps/web/src/components/shared/share/ShareURLSection.tsx` (✅ FIXED: converts database format to public URL format)

## Summary

The shared URL system is a production-ready, DRY implementation that:

- ✅ Works across all entity types (task, form, wiki, artifact)
- ✅ Uses centralized factory pattern for code generation
- ✅ Provides public access without authentication
- ✅ Leverages entity configuration for table mapping
- ✅ Includes reusable SharedEntityPage component
- ✅ Maintains security through RBAC for URL generation
- ✅ Follows consistent naming and URL patterns

**Status**: ✅ FULLY IMPLEMENTED AND TESTED

---

## Recent Updates (2025-10-22)

### ShareURLSection URL Format Fix

**Issue**: ShareURLSection was displaying database URLs directly to users instead of converting to public route format.

**Database Format**: `/task/qD7nC3xK`
**Public Route Format**: `/task/shared/qD7nC3xK` ✅

**Fix Applied** (`apps/web/src/components/shared/share/ShareURLSection.tsx`):
```typescript
/**
 * Convert database shared URL format to public frontend route format
 * Database: /task/qD7nC3xK
 * Frontend: /task/shared/qD7nC3xK
 */
const convertToPublicUrl = (dbUrl: string): string => {
  const parts = dbUrl.split('/').filter(Boolean); // ['task', 'qD7nC3xK']
  if (parts.length === 2) {
    return `/${parts[0]}/shared/${parts[1]}`;
  }
  return dbUrl; // Fallback to original if format is unexpected
};

const fullUrl = sharedUrl ? `${window.location.origin}${convertToPublicUrl(sharedUrl)}` : null;
```

**Benefits**:
- ✅ Users see correct public URL format: `http://localhost:5173/task/shared/xT4pQ2nR`
- ✅ Database still stores compact format: `/task/xT4pQ2nR`
- ✅ Copy to clipboard uses correct public format
- ✅ Routing matches expected pattern `/:entityType/shared/:code`
- ✅ Shared page displays without sidebar/navigation (minimal view for external users)
