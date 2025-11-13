# Hidden Fields Pattern - ID and Metadata Fields

> **Pattern:** Fields hidden from table displays but available for backend operations and detail views

---

## Overview

The Universal Field Detector automatically hides specific field types from data table displays while keeping them available in:
- Row data for API operations (edit, delete, view)
- Detail pages and forms
- Backend processing

This prevents cluttering tables with lengthy or technical data while maintaining full functionality.

---

## Hidden Field Types

### 1. ID Fields (`id`, `*_id`)

**Pattern:** Any field ending with `_id` or the field `id`

**Examples:**
- `id` (primary key)
- `project_id` (foreign key)
- `employee_id` (foreign key)
- `office_id` (foreign key)

**Behavior:**
```typescript
// ❌ NOT shown in table columns
<table>
  <th>Name</th>
  <th>Project Name</th>   {/* Auto-generated from project_id */}
  <th>Status</th>
</table>

// ✅ AVAILABLE in row data
const handleEdit = (row) => {
  api.update(row.id, data);           // ✅ row.id available
  api.link(row.project_id, childId);  // ✅ row.project_id available
};
```

**Auto-Generated Display Fields:**
For each hidden `*_id` field, the system auto-generates a `*_name` field:
- `project_id` → `project_name` (shown in table)
- `employee_id` → `employee_name` (shown in table)
- `office_id` → `office_name` (shown in table)

---

### 2. Metadata Fields (`*metadata*`)

**Pattern:** Any field containing "metadata"

**Examples:**
- `metadata`
- `column_metadata`
- `request_metadata`
- `response_metadata`

**Behavior:**
```typescript
// ❌ NOT shown in table columns
<EntityDataTable columns={visibleColumns} />
// Columns: code, name, domain, display_order
// (column_metadata is hidden)

// ✅ SHOWN in detail views
<EntityDetailPage>
  <Field name="code" value="project" />
  <Field name="name" value="Project" />
  <Field name="domain" value="Core Management" />
  <Field name="column_metadata" component="MetadataTable" />  {/* Full JSON viewer */}
</EntityDetailPage>
```

**Rationale:**
- Metadata fields are JSONB objects containing extensive structured data
- Too lengthy for table display (can be 100s of lines)
- Better suited for detail views with expand/collapse functionality

---

## Implementation

### Field Detector (`universalFieldDetector.ts`)

```typescript
// Pattern 8: Foreign Keys
if (key.endsWith('_id') && key !== 'id') {
  return {
    visible: false,  // ← Hidden from tables
    editable: true,
    inputType: 'select',
    loadFromEntity: entityName
  };
}

// Pattern 11: JSONB with metadata check
if (PATTERNS.jsonb.names.has(key) || dataType?.includes('jsonb')) {
  const isMetadata = key.includes('metadata');

  return {
    visible: !isMetadata,  // ← Hide metadata from tables
    editable: true,
    inputType: 'jsonb',
    component: 'MetadataTable'
  };
}
```

### View Config Generator (`viewConfigGenerator.ts`)

```typescript
// Generate table columns
fieldKeys.forEach(key => {
  const meta = detectField(key);

  if (meta.visible) {
    visibleColumns.push(column);  // ← Shown in table
  } else {
    hiddenColumns.push(key);      // ← Hidden, but in row data
  }
});

// Auto-generate *_name columns for hidden *_id fields
hiddenColumns.forEach(hiddenKey => {
  if (hiddenKey.endsWith('_id') && hiddenKey !== 'id') {
    const nameKey = hiddenKey.replace(/_id$/, '_name');
    visibleColumns.push(createNameColumn(nameKey));  // ← Show name instead
  }
});
```

---

## Examples

### Example 1: Task Table with Project ID

**Database Schema:**
```sql
CREATE TABLE app.d_task (
  id uuid PRIMARY KEY,
  name varchar(200),
  project_id uuid,  -- Foreign key to d_project
  status varchar(50)
);
```

**API Response:**
```json
{
  "data": [
    {
      "id": "abc-123",
      "name": "Implement feature X",
      "project_id": "def-456",
      "project_name": "Website Redesign",
      "status": "In Progress"
    }
  ]
}
```

**Table Display:**
```
| Name                  | Project          | Status      |
|-----------------------|------------------|-------------|
| Implement feature X   | Website Redesign | In Progress |
```

**Hidden Fields (available in row data):**
- `id`: "abc-123"
- `project_id`: "def-456"

**Actions:**
```typescript
// Edit button click
const handleEdit = (row) => {
  navigate(`/task/${row.id}`);  // ✅ row.id available
};

// Delete button click
const handleDelete = (row) => {
  await taskApi.delete(row.id);  // ✅ row.id available
};

// Filter by project
const handleFilterByProject = (row) => {
  setFilter({ project_id: row.project_id });  // ✅ row.project_id available
};
```

---

### Example 2: Entity Configuration Table with Metadata

**Database Schema:**
```sql
CREATE TABLE app.d_entity (
  code varchar(50) PRIMARY KEY,
  name varchar(100),
  dl_entity_domain varchar(100),
  column_metadata jsonb  -- Large JSONB object
);
```

**API Response:**
```json
{
  "domains": [
    {
      "domain": "Core Management",
      "entities": [
        {
          "code": "project",
          "name": "Project",
          "dl_entity_domain": "Core Management",
          "column_metadata": [
            {"orderid": 1, "name": "id", "datatype": "uuid"},
            {"orderid": 2, "name": "name", "datatype": "varchar(200)"},
            ...  // 20+ more columns
          ]
        }
      ]
    }
  ]
}
```

**Table Display:**
```
| Code    | Name    | Domain          | Columns |
|---------|---------|-----------------|---------|
| project | Project | Core Management | 21      |
```

**Hidden Fields (available in row data):**
- `column_metadata`: [...] (full array)

**Detail View Display:**
```
Entity: Project

Overview:
- Code: project
- Name: Project
- Domain: Core Management

Column Metadata:
┌─────────────┬─────────┬─────────────┬──────────┐
│ Order │ Name      │ Data Type   │ Nullable │
├─────────────┼─────────┼─────────────┼──────────┤
│ 1     │ id        │ uuid        │ false    │
│ 2     │ name      │ varchar(200)│ false    │
│ 3     │ descr     │ text        │ true     │
...
```

---

## Usage Guidelines

### ✅ DO

**Use hidden ID fields for:**
- Edit operations: `api.update(row.id, data)`
- Delete operations: `api.delete(row.id)`
- Navigation: `navigate(/task/${row.id})`
- Linking: `api.link(row.project_id, childId)`
- Filtering: `setFilter({ project_id: row.project_id })`

**Display name fields instead of IDs:**
```typescript
// ✅ Good
<TableCell>{row.project_name}</TableCell>

// ❌ Bad
<TableCell>{row.project_id}</TableCell>
```

**Show metadata in detail views:**
```typescript
<EntityDetailPage>
  <MetadataTable data={entity.column_metadata} />
</EntityDetailPage>
```

### ❌ DON'T

**Don't try to display ID fields in tables:**
```typescript
// ❌ Bad - Will be automatically hidden
const columns = [
  { key: 'id', title: 'ID' },  // Won't show
  { key: 'project_id', title: 'Project ID' }  // Won't show
];
```

**Don't assume hidden fields are unavailable:**
```typescript
// ❌ Bad - Assuming row.id doesn't exist
const handleEdit = (row) => {
  // Manually fetching ID from API...
  const id = await api.getTaskId(row.name);  // Unnecessary!
};

// ✅ Good - Use row.id directly
const handleEdit = (row) => {
  await api.update(row.id, data);  // row.id is available!
};
```

**Don't display metadata in tables:**
```typescript
// ❌ Bad - Metadata is too large for tables
<TableCell>{JSON.stringify(row.metadata)}</TableCell>

// ✅ Good - Show indicator only
<TableCell>
  <Badge>{Object.keys(row.metadata).length} fields</Badge>
</TableCell>
```

---

## API Contract

### Important Note

`visible: false` does **NOT** mean the field is:
- ❌ Excluded from API responses
- ❌ Removed from row data objects
- ❌ Unavailable for operations
- ❌ Hidden from detail/form views

It **ONLY** means:
- ✅ "Don't render this field as a table column"

### Data Flow

```
┌─────────────┐
│   Database  │
│   (50 cols) │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  API Layer  │ ← Returns ALL fields (including id, *_id, metadata)
│ (50 fields) │
└──────┬──────┘
       │
       ▼
┌──────────────────────────┐
│  View Config Generator   │ ← Marks fields as visible/hidden
│  (detectField)           │
└──────┬───────────────────┘
       │
       ├─────────────┬──────────────┐
       ▼             ▼              ▼
┌──────────────┐ ┌─────────┐ ┌────────────┐
│  DataTable   │ │  Form   │ │   Detail   │
│ (20 visible) │ │ (45)    │ │ (50 all)   │
│ (30 hidden)  │ │         │ │            │
└──────────────┘ └─────────┘ └────────────┘
       │             │              │
       │             │              │
       ▼             ▼              ▼
    row.id      row.id         row.id
    row.project_id  row.project_id   row.project_id
    row.metadata    row.metadata      row.metadata

    (All available for operations)
```

---

## Testing

### Verification Checklist

- [ ] ID fields hidden from tables
- [ ] `row.id` available for edit/delete operations
- [ ] `*_name` fields auto-generated and shown
- [ ] `*_id` foreign keys available for API calls
- [ ] Metadata fields hidden from tables
- [ ] Metadata fields shown in detail views
- [ ] No UI errors when accessing hidden fields
- [ ] Forms still show ID and metadata fields for editing

### Test Script

```typescript
// 1. Check table columns
const config = generateDataTableConfig(['id', 'name', 'project_id', 'metadata']);
console.log('Visible columns:', config.visibleColumns.map(c => c.key));
// Expected: ['name', 'project_name']

console.log('Hidden columns:', config.hiddenColumns);
// Expected: ['id', 'project_id', 'metadata']

// 2. Check row data availability
const row = tableData[0];
console.log('ID available:', row.id !== undefined);  // true
console.log('Project ID available:', row.project_id !== undefined);  // true
console.log('Metadata available:', row.metadata !== undefined);  // true

// 3. Check operations work
await api.update(row.id, { name: 'Updated' });  // ✅ Should work
await api.delete(row.id);  // ✅ Should work
```

---

## Summary

| Field Type | Table Display | Row Data | Detail View | API Operations |
|------------|---------------|----------|-------------|----------------|
| `id` | ❌ Hidden | ✅ Available | ✅ Shown | ✅ Used |
| `*_id` | ❌ Hidden | ✅ Available | ✅ Shown (dropdown) | ✅ Used |
| `*_name` | ✅ Shown | ✅ Available | ✅ Shown | ✅ Used |
| `*metadata*` | ❌ Hidden | ✅ Available | ✅ Shown (JSON viewer) | ✅ Used |
| Regular fields | ✅ Shown | ✅ Available | ✅ Shown | ✅ Used |

**Key Principle:** Hide complexity from tables, but maintain full functionality everywhere else.
