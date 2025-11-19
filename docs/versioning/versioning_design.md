# Versioning Design - PMO Platform

> **Document Purpose**: Comprehensive guide to versioning patterns across all entities in the PMO platform

---

## Table of Contents
1. [Versioning Philosophy](#versioning-philosophy)
2. [In-Place Versioning Pattern](#in-place-versioning-pattern)
3. [SCD Type 2 Versioning Pattern](#scd-type-2-versioning-pattern)
4. [Entity-Specific Implementation](#entity-specific-implementation)
5. [Version History Retrieval](#version-history-retrieval)
6. [Best Practices](#best-practices)

---

## Versioning Philosophy

The PMO platform uses **two distinct versioning patterns** based on entity type and use case:

### Pattern Selection Criteria

| Pattern | When to Use | Entities | ID Behavior |
|---------|------------|----------|-------------|
| **In-Place Versioning** | Content that needs stable URLs and simple history tracking | Forms, Artifacts | ID stays the same |
| **SCD Type 2** | Transactional data requiring full audit trail and point-in-time queries | Projects, Tasks, Employees | New ID per version |

---

## In-Place Versioning Pattern

### Concept

**In-place versioning** updates the same record repeatedly, incrementing a version counter. The ID remains constant across all versions, enabling **stable URLs** and simpler relationships.

### Schema Structure

```sql
CREATE TABLE app.d_form_head (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- Stable, never changes
    code varchar(50),
    name varchar(200) NOT NULL,
    descr text,

    -- Core content field(s)
    form_schema jsonb DEFAULT '{"steps": []}'::jsonb,

    -- Temporal tracking (audit only, not for archival)
    from_ts timestamptz DEFAULT now(),      -- Original creation (never changes)
    to_ts timestamptz,                      -- Reserved/unused
    active_flag boolean DEFAULT true,       -- Soft delete flag
    created_ts timestamptz DEFAULT now(),   -- Original creation
    updated_ts timestamptz DEFAULT now(),   -- Last modification

    -- In-place version counter
    version integer DEFAULT 1               -- Increments on updates
);
```

### Key Characteristics

1. **Stable ID**: UUID never changes, enabling permanent URLs
   ```
   /form/ee8a6cfd-9d31-4705-b8f3-ad2d5589802c  ← Always valid
   ```

2. **Version Counter**: Simple integer increments
   ```
   Version 1 → Version 2 → Version 3 → ...
   ```

3. **History in Metadata**: Previous versions stored as JSONB
   ```json
   {
     "versionHistory": [
       {"version": 1, "uploadedAt": "2025-01-01", "objectKey": "old-key"},
       {"version": 2, "uploadedAt": "2025-01-02", "objectKey": "old-key-2"}
     ]
   }
   ```

4. **Single Active Record**: Only one row per entity in the database

### Update Flow (Forms)

```sql
-- Version 1: Create
INSERT INTO app.d_form_head (id, name, form_schema, version)
VALUES ('ee8a6cfd-...', 'Landscaping Form', '{"steps": [...]}'::jsonb, 1);

-- Version 2: Update
UPDATE app.d_form_head
SET form_schema = '{"steps": [new content]}'::jsonb,
    version = version + 1,
    updated_ts = NOW()
WHERE id = 'ee8a6cfd-...';

-- Version 3: Update again
UPDATE app.d_form_head
SET form_schema = '{"steps": [newer content]}'::jsonb,
    version = version + 1,
    updated_ts = NOW()
WHERE id = 'ee8a6cfd-...';
```

### Update Flow (Artifacts)

```sql
-- Version 1: Create
INSERT INTO app.d_artifact (id, code, name, attachment_object_key, version)
VALUES ('33a33333-...', 'ART-001', 'Contract', 'artifacts/.../file.pdf', 1);

-- Version 2: New file upload
UPDATE app.d_artifact
SET attachment_object_key = 'artifacts/.../file-v2.pdf',
    attachment_format = 'pdf',
    attachment_size_bytes = 245000,
    metadata = jsonb_set(
        metadata,
        '{versionHistory}',
        metadata->'versionHistory' ||
        '[{"version": 1, "uploadedAt": "2025-01-01", "objectKey": "artifacts/.../file.pdf"}]'::jsonb
    ),
    version = version + 1,
    updated_ts = NOW()
WHERE id = '33a33333-...';
```

### Retrieving Version History

```javascript
// API: GET /api/v1/artifact/:id/versions
{
  data: [
    {
      version: 3,
      uploadedAt: "2025-01-03T10:00:00Z",
      objectKey: "artifacts/.../file-v3.pdf",
      attachment_format: "pdf",
      attachment_size_bytes: 300000,
      isCurrent: true
    },
    {
      version: 2,
      uploadedAt: "2025-01-02T10:00:00Z",
      objectKey: "artifacts/.../file-v2.pdf",
      isCurrent: false
    },
    {
      version: 1,
      uploadedAt: "2025-01-01T10:00:00Z",
      objectKey: "artifacts/.../file.pdf",
      isCurrent: false
    }
  ],
  rootArtifactId: "33a33333-...",
  currentVersion: 3
}
```

### Advantages

✅ **Stable URLs**: ID never changes, links remain valid forever
✅ **Simple Queries**: Single row per entity, no JOINs needed
✅ **Space Efficient**: No duplicate metadata across versions
✅ **Clear Current State**: Always one active record

### Disadvantages

❌ **Limited History**: Old versions are summarized in metadata
❌ **No Point-in-Time Queries**: Can't query "state on Jan 15th"
❌ **Metadata Growth**: History array grows over time

---

## SCD Type 2 Versioning Pattern

### Concept

**Slowly Changing Dimension Type 2** creates a new database row for each version change. Each row has a unique ID and temporal validity period, enabling complete audit trails and point-in-time queries.

### Schema Structure

```sql
CREATE TABLE app.project (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- New ID per version
    code varchar(50) NOT NULL,                       -- Business key (stable)
    name varchar(200) NOT NULL,
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,

    -- SCD Type 2 temporal columns
    from_ts timestamptz DEFAULT now(),      -- Version start time
    to_ts timestamptz,                      -- Version end time (NULL = current)
    active_flag boolean DEFAULT true,       -- Is this the current version?
    created_ts timestamptz DEFAULT now(),   -- Original record creation
    updated_ts timestamptz DEFAULT now(),   -- Last modification
    version integer DEFAULT 1,              -- Version number

    -- Business fields
    budget_allocated_amt decimal(15,2),
    planned_start_date date,
    actual_start_date date
);
```

### Key Characteristics

1. **New ID Per Version**: Each version gets a unique UUID
   ```
   Version 1: id = "aaaaaaaa-..."
   Version 2: id = "bbbbbbbb-..."  ← Different ID
   Version 3: id = "cccccccc-..."  ← Different ID
   ```

2. **Stable Code**: Business identifier remains constant
   ```
   All versions: code = "PRJ-2024-001"
   ```

3. **Temporal Validity**: Time ranges define when each version was active
   ```
   Version 1: from_ts=2024-01-01, to_ts=2024-02-15, active_flag=false
   Version 2: from_ts=2024-02-15, to_ts=2024-03-01, active_flag=false
   Version 3: from_ts=2024-03-01, to_ts=NULL,       active_flag=true  ← Current
   ```

4. **Complete History**: All field values preserved for every version

### Update Flow (Projects)

```sql
-- Version 1: Create
INSERT INTO app.project (id, code, name, budget_allocated_amt, version, from_ts, to_ts, active_flag)
VALUES ('aaaaaaaa-...', 'PRJ-2024-001', 'Office Expansion', 500000, 1, NOW(), NULL, true);

-- Version 2: Budget increase
-- Step 1: Close current version
UPDATE app.project
SET to_ts = NOW(),
    active_flag = false,
    updated_ts = NOW()
WHERE id = 'aaaaaaaa-...';

-- Step 2: Create new version
INSERT INTO app.project (id, code, name, budget_allocated_amt, version, from_ts, to_ts, active_flag)
VALUES ('bbbbbbbb-...', 'PRJ-2024-001', 'Office Expansion', 750000, 2, NOW(), NULL, true);
         ↑ New ID                                                    ↑ Increased budget  ↑ Version 2

-- Version 3: Name and budget change
-- Step 1: Close version 2
UPDATE app.project
SET to_ts = NOW(),
    active_flag = false
WHERE id = 'bbbbbbbb-...';

-- Step 2: Create version 3
INSERT INTO app.project (id, code, name, budget_allocated_amt, version, from_ts, to_ts, active_flag)
VALUES ('cccccccc-...', 'PRJ-2024-001', 'Corporate HQ Expansion', 1000000, 3, NOW(), NULL, true);
         ↑ New ID                        ↑ New name                  ↑ Higher budget
```

### Querying Current Version

```sql
-- Get current active version
SELECT * FROM app.project
WHERE code = 'PRJ-2024-001'
  AND active_flag = true
  AND to_ts IS NULL;
```

### Point-in-Time Query

```sql
-- Get project state as of February 20, 2024
SELECT * FROM app.project
WHERE code = 'PRJ-2024-001'
  AND from_ts <= '2024-02-20'
  AND (to_ts IS NULL OR to_ts > '2024-02-20');
```

### Version History Query

```sql
-- Get all versions ordered by time
SELECT id, code, name, budget_allocated_amt, version, from_ts, to_ts, active_flag
FROM app.project
WHERE code = 'PRJ-2024-001'
ORDER BY version DESC, from_ts DESC;
```

### Advantages

✅ **Complete Audit Trail**: Every field value change is preserved
✅ **Point-in-Time Queries**: Can reconstruct state at any moment
✅ **Regulatory Compliance**: Full history for auditing
✅ **Temporal Joins**: Can join tables at specific timestamps

### Disadvantages

❌ **Storage Growth**: Multiple rows per entity
❌ **Complex Queries**: Need to filter by active_flag/to_ts
❌ **Unstable IDs**: ID changes between versions, breaks direct links
❌ **Code Required**: Must use `code` field for stable references

---

## Entity-Specific Implementation

### In-Place Versioning Entities

| Entity | Table | Version Field | History Storage |
|--------|-------|---------------|-----------------|
| **Forms** | `d_form_head` | `version` | Not stored (old schemas discarded) |
| **Artifacts** | `d_artifact` | `version` | `metadata.versionHistory` array |

#### Forms: No History Retention

```sql
-- Forms use in-place updates WITHOUT preserving history
UPDATE app.d_form_head
SET form_schema = '{"steps": [new schema]}'::jsonb,
    version = version + 1,
    updated_ts = NOW()
WHERE id = 'form-uuid';

-- Old schema is LOST - intentional design choice
-- Reason: Forms are templates, not transactional data
```

**Rationale**: Form schemas are templates. Old submissions preserve their original schema, but the template itself doesn't need historical versions.

#### Artifacts: History in Metadata

```sql
-- Artifacts preserve file history in metadata.versionHistory
UPDATE app.d_artifact
SET attachment_object_key = 'new-file-key',
    metadata = jsonb_set(
        metadata,
        '{versionHistory}',
        metadata->'versionHistory' ||
        '[{"version": 2, "objectKey": "old-file-key", "uploadedAt": "2025-01-01"}]'::jsonb
    ),
    version = version + 1
WHERE id = 'artifact-uuid';
```

**Rationale**: Users need to access previous file versions, but full metadata replication is overkill. Lightweight history in JSONB balances needs.

### SCD Type 2 Entities

| Entity | Table | Code Field | Use Case |
|--------|-------|------------|----------|
| **Projects** | `project` | `code` | Budget tracking, timeline changes |
| **Tasks** | `task` | `code` | Status transitions, assignment changes |
| **Employees** | `employee` | `code` | Role changes, compensation history |
| **Offices** | `office` | `code` | Organizational restructuring |
| **Businesses** | `d_biz` | `code` | Business unit changes |
| **Clients** | `cust` | `code` | Contract modifications |

#### Projects Example

```sql
-- Initial project creation
INSERT INTO app.project (id, code, name, budget_allocated_amt, dl__project_stage)
VALUES ('proj-v1-id', 'PRJ-001', 'Website Redesign', 50000, 'Planning');

-- Status change: Planning → Execution
UPDATE app.project SET to_ts = NOW(), active_flag = false WHERE id = 'proj-v1-id';
INSERT INTO app.project (id, code, name, budget_allocated_amt, dl__project_stage, version)
VALUES ('proj-v2-id', 'PRJ-001', 'Website Redesign', 50000, 'Execution', 2);

-- Budget increase during execution
UPDATE app.project SET to_ts = NOW(), active_flag = false WHERE id = 'proj-v2-id';
INSERT INTO app.project (id, code, name, budget_allocated_amt, dl__project_stage, version)
VALUES ('proj-v3-id', 'PRJ-001', 'Website Redesign', 75000, 'Execution', 3);
```

#### Employees Example

```sql
-- Initial hire
INSERT INTO app.employee (id, code, first_name, last_name, title, department, salary_band)
VALUES ('emp-v1-id', 'EMP-123', 'John', 'Smith', 'Developer', 'Engineering', 'L3');

-- Promotion to Senior Developer
UPDATE app.employee SET to_ts = NOW(), active_flag = false WHERE id = 'emp-v1-id';
INSERT INTO app.employee (id, code, first_name, last_name, title, department, salary_band, version)
VALUES ('emp-v2-id', 'EMP-123', 'John', 'Smith', 'Senior Developer', 'Engineering', 'L4', 2);

-- Transfer to different department
UPDATE app.employee SET to_ts = NOW(), active_flag = false WHERE id = 'emp-v2-id';
INSERT INTO app.employee (id, code, first_name, last_name, title, department, salary_band, version)
VALUES ('emp-v3-id', 'EMP-123', 'John', 'Smith', 'Tech Lead', 'Platform', 'L5', 3);
```

---

## Version History Retrieval

### In-Place Versioned Entities (Forms, Artifacts)

**API Pattern**: `/api/v1/:entity/:id/versions`

```javascript
// GET /api/v1/artifact/33a33333-3333-3333-3333-333333333333/versions

async function getArtifactVersions(id) {
  const artifact = await db.execute(sql`
    SELECT * FROM app.d_artifact WHERE id = ${id}
  `);

  const versionHistory = artifact.metadata?.versionHistory || [];

  return {
    data: [
      ...versionHistory.map(v => ({ ...v, isCurrent: false })),
      {
        version: artifact.version,
        uploadedAt: artifact.updated_ts,
        objectKey: artifact.attachment_object_key,
        isCurrent: true
      }
    ].sort((a, b) => b.version - a.version),
    rootArtifactId: id,
    currentVersion: artifact.version
  };
}
```

**Response**:
```json
{
  "data": [
    {
      "version": 3,
      "uploadedAt": "2025-01-03T10:00:00Z",
      "objectKey": "artifacts/.../v3.pdf",
      "isCurrent": true
    },
    {
      "version": 2,
      "uploadedAt": "2025-01-02T10:00:00Z",
      "objectKey": "artifacts/.../v2.pdf",
      "isCurrent": false
    },
    {
      "version": 1,
      "uploadedAt": "2025-01-01T10:00:00Z",
      "objectKey": "artifacts/.../v1.pdf",
      "isCurrent": false
    }
  ],
  "currentVersion": 3
}
```

### SCD Type 2 Entities (Projects, Tasks, etc.)

**Query Pattern**: Filter by `code` field, order by `version`

```sql
-- Get all versions of a project
SELECT
  id, code, name, budget_allocated_amt, dl__project_stage,
  version, from_ts, to_ts, active_flag, created_ts, updated_ts
FROM app.project
WHERE code = 'PRJ-001'
ORDER BY version DESC;
```

**API Pattern**: `/api/v1/:entity?code=XXX`

```javascript
// GET /api/v1/project?code=PRJ-001

async function getProjectVersions(code) {
  const versions = await db.execute(sql`
    SELECT * FROM app.project
    WHERE code = ${code}
    ORDER BY version DESC, from_ts DESC
  `);

  return {
    data: versions,
    currentVersion: versions.find(v => v.active_flag === true)
  };
}
```

**Response**:
```json
{
  "data": [
    {
      "id": "proj-v3-id",
      "code": "PRJ-001",
      "name": "Corporate HQ Expansion",
      "budget_allocated_amt": 1000000,
      "version": 3,
      "from_ts": "2025-03-01T10:00:00Z",
      "to_ts": null,
      "active_flag": true
    },
    {
      "id": "proj-v2-id",
      "code": "PRJ-001",
      "name": "Office Expansion",
      "budget_allocated_amt": 750000,
      "version": 2,
      "from_ts": "2025-02-15T10:00:00Z",
      "to_ts": "2025-03-01T10:00:00Z",
      "active_flag": false
    },
    {
      "id": "proj-v1-id",
      "code": "PRJ-001",
      "name": "Office Expansion",
      "budget_allocated_amt": 500000,
      "version": 1,
      "from_ts": "2025-01-01T10:00:00Z",
      "to_ts": "2025-02-15T10:00:00Z",
      "active_flag": false
    }
  ],
  "currentVersion": {...}
}
```

---

## Best Practices

### When to Use Each Pattern

#### Use In-Place Versioning When:

✅ Entity requires **stable URLs** (forms, documents)
✅ History is **lightweight** or not needed
✅ Only **current state** matters for operations
✅ Version counter is sufficient for tracking changes
✅ Content is **self-contained** (not heavily referenced)

#### Use SCD Type 2 When:

✅ Entity is **transactional** (projects, tasks, employees)
✅ Need **complete audit trail** for compliance
✅ Require **point-in-time queries** ("state on Jan 15th")
✅ Entity is **heavily referenced** by other tables
✅ Multiple fields change frequently

### Versioning Anti-Patterns

❌ **Don't mix patterns**: Pick one versioning approach per entity
❌ **Don't use parent_artifact_id**: SCD handles parent-child via code field
❌ **Don't version everything**: Only version entities that change
❌ **Don't over-version**: Not every field change needs a new version
❌ **Don't lose the code**: SCD entities must have stable code field

### Code Field Guidelines

For SCD Type 2 entities:

✅ **Always include code field**: Business key that doesn't change
✅ **Make code unique**: Add unique constraint or index
✅ **Use meaningful codes**: `PRJ-2024-001`, `EMP-123`, `TASK-456`
✅ **Generate consistently**: Use sequences or patterns
✅ **Display code in UI**: Users reference entities by code, not ID

### Performance Considerations

#### In-Place Versioning

- **Fast reads**: Single row lookup by ID
- **Fast writes**: Simple UPDATE statement
- **Minimal storage**: One row per entity
- **Metadata growth**: Monitor `versionHistory` array size

#### SCD Type 2

- **Index requirements**: Create indexes on `(code, active_flag, to_ts)`
- **Query patterns**: Always filter by `active_flag = true` for current
- **Purging strategy**: Consider archiving old versions after retention period
- **Storage growth**: Plan for multiple rows per entity

### Migration Strategy

#### Converting In-Place → SCD Type 2

```sql
-- Example: Migrate artifact to full SCD Type 2
-- 1. Add code field if missing
ALTER TABLE app.d_artifact ADD COLUMN code varchar(50);
UPDATE app.d_artifact SET code = 'ART-' || substring(id::text, 1, 8);

-- 2. Explode version history into separate rows
INSERT INTO app.d_artifact (
  id, code, name, version, attachment_object_key,
  from_ts, to_ts, active_flag
)
SELECT
  gen_random_uuid(),
  code,
  name,
  (jsonb_array_elements(metadata->'versionHistory')->>'version')::int,
  jsonb_array_elements(metadata->'versionHistory')->>'objectKey',
  (jsonb_array_elements(metadata->'versionHistory')->>'uploadedAt')::timestamptz,
  -- Calculate to_ts based on next version's from_ts
  LEAD((jsonb_array_elements(metadata->'versionHistory')->>'uploadedAt')::timestamptz)
    OVER (PARTITION BY code ORDER BY version),
  false
FROM app.d_artifact
WHERE metadata->'versionHistory' IS NOT NULL;
```

#### Converting SCD Type 2 → In-Place

```sql
-- Example: Collapse project versions into single row
-- 1. Keep only active version
DELETE FROM app.project WHERE active_flag = false;

-- 2. Store history in metadata
UPDATE app.project
SET metadata = jsonb_build_object(
  'versionHistory',
  (SELECT jsonb_agg(
    jsonb_build_object(
      'version', version,
      'from_ts', from_ts,
      'to_ts', to_ts,
      'name', name,
      'budget', budget_allocated_amt
    )
  )
  FROM app.project_archive -- Archived old versions
  WHERE code = project.code)
);
```

---

## Summary

| Aspect | In-Place Versioning | SCD Type 2 |
|--------|-------------------|------------|
| **ID Stability** | ✅ Same ID forever | ❌ New ID per version |
| **History Detail** | ⚠️ Lightweight (metadata) | ✅ Complete (all fields) |
| **Query Complexity** | ✅ Simple (single row) | ⚠️ Complex (filter by active_flag) |
| **Storage** | ✅ Minimal | ⚠️ Multiple rows |
| **Point-in-Time** | ❌ Not supported | ✅ Supported |
| **Stable URLs** | ✅ Yes | ⚠️ Need code-based URLs |
| **Use Cases** | Forms, Artifacts | Projects, Tasks, Employees |

**Decision Rule**:
- **Stable URL needed?** → In-Place Versioning
- **Complete audit trail needed?** → SCD Type 2
- **When in doubt** → SCD Type 2 (more flexible)

---

**Last Updated**: 2025-11-04
**Authors**: PMO Platform Team
**Related Docs**:
- [Database Schema Guide](/docs/datamodel.md)
- [Form System Design](/docs/form.md)
- [Artifact Management](/docs/S3_ATTACHMENT_SERVICE_COMPLETE_GUIDE.md)
