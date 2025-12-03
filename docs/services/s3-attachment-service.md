# S3 Attachment Service

> **Secure file upload/download with presigned URLs and multi-tenant storage**

**File**: `apps/api/src/lib/s3-attachments.ts`
**Type**: Core Infrastructure Service
**Pattern**: Presigned URL Strategy

---

## Purpose

Provides secure S3 operations for file attachments using AWS SDK v3 with presigned URLs for client-side upload/download. Implements multi-tenant storage structure with IAM role authentication.

---

## Where Used

### Entity Attachment Endpoints (4 modules)

| Module | Routes | Usage Context |
|--------|--------|---------------|
| **Artifact** | `POST /api/v1/artifact/upload` | Upload artifact files |
| **Upload** | `POST /api/v1/upload/presigned-url` | Generic file uploads |
| **Invoice** | `POST /api/v1/invoice/upload` | Invoice document uploads |
| **S3 Backend** | `GET /api/v1/s3/*` | Direct S3 operations (admin) |

### Integration Points

- **Artifact module** - File attachments to entities
- **Upload module** - Generic upload endpoint
- **Invoice module** - Financial document storage
- **S3 Backend module** - Direct S3 management

---

## How It Works (Building Blocks)

### Block 1: Multi-Tenant Storage Structure

**S3 Key Pattern** (Hive-style partitioning):
```
tenant_id={tenant}/entity={entity_code}/entity_instance_id={uuid}/{hash}.{extension}
```

**Example Keys**:
```
tenant_id=demo/entity=project/entity_instance_id=abc-123-uuid/def456789012345678901234.pdf
tenant_id=demo/entity=task/entity_instance_id=xyz-789-uuid/ghi012345678901234567890a.png
```

**Components**:
- `tenant_id={tenant}` - Organization isolation (default: "demo")
- `entity={entity_code}` - Entity TYPE code (project, task, artifact, etc.)
- `entity_instance_id={uuid}` - Specific entity instance UUID
- `{hash}` - 32-character hex hash from `crypto.randomBytes(16)` - ensures uniqueness
- `{extension}` - Original file extension extracted from filename

**Benefits**:
- **Multi-tenancy** - Isolated storage per organization
- **Organization** - Hierarchical structure for easy browsing
- **Uniqueness** - Crypto hash prevents collisions
- **Auditing** - Clear file ownership trail

**S3 Key Generation Code**:
```typescript
private generateObjectKey(metadata: AttachmentMetadata): string {
  const tenantId = metadata.tenantId || this.defaultTenantId;
  const hash = crypto.randomBytes(16).toString('hex');  // 32 hex chars
  const extension = metadata.fileName.split('.').pop() || '';

  return `tenant_id=${tenantId}/entity=${metadata.entityCode}/entity_instance_id=${metadata.entityInstanceId}/${hash}.${extension}`;
}
```

### Block 2: Presigned URL Generation

**Upload Flow**:
1. Client requests presigned upload URL
2. Service generates S3 PutObject presigned URL (1-hour expiry default)
3. Client uploads file DIRECTLY to S3 using presigned URL
4. No file passes through API server (bandwidth savings)

**Download Flow**:
1. Client requests presigned download URL
2. Service generates S3 GetObject presigned URL (1-hour expiry default)
3. Client downloads file DIRECTLY from S3
4. No file passes through API server

**Benefits**:
- **Scalability** - No API bandwidth bottleneck
- **Security** - Temporary URLs with expiration
- **Performance** - Direct S3 transfer (fast)
- **Cost** - Reduced API server load

### Block 3: AWS SDK v3 Configuration

**Authentication**:
- **IAM Role** - Uses AWS profile "cohuron"
- **Credentials** - Loaded from `~/.aws/credentials` via `fromIni`
- **Region** - Configured via `config.AWS_REGION` (us-east-1)

**Client Initialization**:
- S3Client instance created on service instantiation
- Singleton pattern (one client per service instance)
- Credential provider chain (profile → IAM role → instance metadata)

**Benefits**:
- **Security** - No hardcoded credentials
- **Flexibility** - Multiple authentication methods
- **Production-ready** - IAM role support for EC2/ECS

### Block 4: File Metadata Tracking

**AttachmentMetadata Interface**:
```typescript
interface AttachmentMetadata {
  tenantId?: string;         // Organization ID (optional, defaults to "demo")
  entityCode: string;        // Entity TYPE code (project, task, etc.)
  entityInstanceId: string;  // Entity instance UUID
  fileName: string;          // Original file name
  contentType?: string;      // MIME type (optional)
}
```

**Usage**:
- Passed to presigned URL generation
- Constructs S3 object key using `generateObjectKey()`
- Sets Content-Type header for downloads

### Block 5: Object Operations

**Supported Operations**:
- **Upload** - Generate presigned PutObject URL
- **Download** - Generate presigned GetObject URL
- **Delete** - Delete object from S3
- **List** - List objects for entity (pagination support)

**List Operation**:
- Lists all attachments for specific entity
- Returns: key, size, lastModified
- Supports pagination via S3 continuation tokens

---

## Operational Flow

### Upload Attachment (Presigned URL)

**Sequence**:
1. **Client calls** `POST /api/v1/upload/presigned-url`
   - Body: `{ entityCode: 'project', entityInstanceId: 'abc-123-uuid', fileName: 'doc.pdf' }`
2. **Service generates** presigned PUT URL
   - S3 key: `tenant_id=demo/entity=project/entity_instance_id=abc-123-uuid/def456789012345678901234.pdf`
   - Expiry: 1 hour (3600 seconds)
3. **Service returns** `{ url: 's3-presigned-url', objectKey: '...', expiresIn: 3600 }`
4. **Client uploads** file directly to S3 using presigned URL
   - `PUT s3-presigned-url` with file binary
5. **S3 stores** file at specified key
6. **Client confirms** upload success (optional callback to API)

**Benefits**:
- API server never handles file binary
- Scalable to large files (100MB+)
- Parallel uploads supported
- No API timeout issues

### Download Attachment (Presigned URL)

**Sequence**:
1. **Client calls** `GET /api/v1/artifact/:id/download`
2. **Service looks up** artifact metadata (entity type, entity ID, file key)
3. **Service generates** presigned GET URL
   - S3 key from artifact record
   - Expiry: 15 minutes
4. **Service returns** presigned download URL
5. **Client downloads** file directly from S3
6. **S3 serves** file with correct Content-Type headers

### Delete Attachment

**Sequence**:
1. **Client calls** `DELETE /api/v1/artifact/:id`
2. **Service retrieves** artifact metadata (S3 key)
3. **Service calls** S3 DeleteObject
4. **Service deletes** artifact record from database
5. **Returns** confirmation

**Cleanup**:
- Orphaned S3 objects handled by lifecycle policies
- Database record deletion removes metadata

### List Attachments

**Sequence**:
1. **Client calls** `GET /api/v1/artifact?entityCode=project&entityInstanceId=abc-123-uuid`
2. **Service constructs** S3 prefix: `tenant_id=demo/entity=project/entity_instance_id=abc-123-uuid/`
3. **Service calls** S3 ListObjectsV2
4. **Service returns** array of attachments: `[{ key, size, lastModified }]`

---

## Key Design Principles

### 1. Presigned URL Strategy

**Why**:
- Offloads bandwidth from API server
- Direct S3 transfer (fastest)
- Temporary access (security)
- Scalable to large files

**Trade-off**:
- Client must handle S3 upload/download
- Presigned URLs expire (must refresh)

### 2. Multi-Tenant Isolation

**Why**:
- Separates data by organization
- Enables per-tenant S3 buckets (future)
- Clear ownership boundaries

**Structure**:
- `tenant_id={tenant}/` prefix on all keys
- Default tenant: "demo"

### 3. Crypto Hash File Naming

**Why**:
- Prevents filename collisions
- Unique identifier per file
- Preserves original extension

**Implementation**:
- `crypto.randomBytes()` generates hash
- Appended to filename: `hash_original.pdf`

### 4. No File Proxying

**Why**:
- API server not a proxy (bandwidth savings)
- Client-side uploads faster
- Reduces API memory usage

**Implementation**:
- Presigned URLs for all upload/download
- API only generates URLs, never touches file bytes

---

## Dependencies

### AWS Services

- **S3 Bucket** - Configured via `config.AWS_S3_BUCKET`
- **IAM Role** - Profile "cohuron" with S3 permissions
- **AWS SDK v3** - `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`

### Configuration

- `config.AWS_REGION` - AWS region (us-east-1)
- `config.AWS_S3_BUCKET` - S3 bucket name
- AWS credentials from `~/.aws/credentials`

### Database

- Artifact metadata stored in `d_artifact` table
- S3 object key tracked in database

---

## Security Considerations

### Presigned URL Expiry

- **Default**: 1 hour (3600 seconds)
- **Rationale**: Short-lived, reduces exposure
- **Client responsibility**: Use URL before expiry

### IAM Permissions Required

```
s3:PutObject      - Upload files
s3:GetObject      - Download files
s3:DeleteObject   - Delete files
s3:ListBucket     - List attachments
```

### Tenant Isolation

- All operations scoped to `tenantId`
- No cross-tenant access
- Validates entity ownership before presigned URL generation

### Content-Type Validation

- Validates file extensions
- Sets appropriate Content-Type headers
- Prevents malicious file uploads (application layer)

---

## Performance Considerations

### Direct S3 Transfer

- **Upload**: Client → S3 (no API proxy)
- **Download**: S3 → Client (no API proxy)
- **Bandwidth**: API server bandwidth saved

### Presigned URL Caching

- URLs expire after 1 hour
- No caching recommended (security)
- Generate fresh URLs per request

### S3 Performance

- S3 auto-scales (no bottleneck)
- Multi-region support (configure region)
- CloudFront integration (future CDN)

---

## Error Scenarios

### Expired Presigned URL

**Scenario**: Client uses URL after 1 hour
**Handling**: S3 returns 403 Forbidden
**Solution**: Request new presigned URL

### Missing S3 Credentials

**Scenario**: AWS credentials not configured
**Handling**: Service initialization fails
**Solution**: Configure `~/.aws/credentials` with profile "cohuron"

### S3 Bucket Not Found

**Scenario**: Bucket name misconfigured
**Handling**: S3 operations fail with NoSuchBucket error
**Solution**: Verify `config.AWS_S3_BUCKET` setting

### Upload Size Limits

**Scenario**: File exceeds S3/presigned URL limits
**Handling**: S3 rejects upload
**Solution**: Use multipart upload for large files (100MB+)

---

## Future Enhancements

### Multi-Region Support

- Replicate to multiple S3 regions
- Geo-based routing for downloads

### CloudFront CDN

- Cache frequently accessed files
- Faster global downloads
- Signed URLs for private content

### Multipart Upload

- Support files > 100MB
- Chunked upload with resume capability
- S3 multipart upload API

### Lifecycle Policies

- Auto-delete old files
- Archive to Glacier for long-term storage
- Versioning support

---

## Version History

- **v1.0.0** (2024): Initial AWS SDK v3 implementation
- **Pattern**: Presigned URL strategy established
- **Adoption**: 4 modules using service

---

**File Location**: `apps/api/src/lib/s3-attachments.ts`
**Documentation**: This file
**Related**: `docs/S3_ATTACHMENT_SERVICE_COMPLETE_GUIDE.md`
