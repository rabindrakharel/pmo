# Metadata Coupling Implementation

**Version:** 8.2.0 | **Status:** COMPLETE | **Updated:** 2025-11-26

---

## Summary

This document tracks the implementation of proper metadata coupling between backend BFF and frontend components.

---

## Implementation Status

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1: Type Definitions | Complete | Strict `{ viewType, editType }` structure |
| Phase 2: Backend Response | Complete | API sends nested metadata |
| Phase 3: Frontend Consumption | Complete | Components use extractViewType/extractEditType |
| Phase 4: Legacy Removal | Complete | v8.2.0 removes all flat metadata support |

---

## Architecture (v8.2.0)

### Before (v7.x - Legacy)

```
Backend: { field: { viewType: 'currency', inputType: 'number' } }  // Flat
Frontend: pattern detection + fallback logic
```

### After (v8.2.0 - Current)

```
Backend: {
  viewType: { field: { renderType: 'currency', ... } },
  editType: { field: { inputType: 'number', ... } }
}

Frontend: extractViewType(metadata) + extractEditType(metadata)
          No pattern detection, no fallbacks
```

---

## Key Changes (v8.2.0)

### 1. Type Definitions (`lib/formatters/types.ts`)

```typescript
// BEFORE (removed)
interface FieldMetadata { ... }           // Flat structure
interface FlatComponentMetadata { ... }   // Flat structure

// AFTER (required)
interface ComponentMetadata {
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
}
```

### 2. Helper Functions

```typescript
// BEFORE (removed)
isNestedComponentMetadata()  // Checked if nested or flat

// AFTER (v8.2.0)
isValidComponentMetadata()   // Validates required structure exists
extractViewType()            // Errors on invalid structure
extractEditType()            // Errors on invalid structure
```

### 3. Store Structure (`entityComponentMetadataStore.ts`)

```typescript
// Stores ComponentMetadata directly
interface CacheEntry {
  data: ComponentMetadata;  // { viewType, editType }
  timestamp: number;
  ttl: number;
}
```

### 4. Component Consumption

```tsx
// EntityDataTable.tsx
const viewType = extractViewType(metadata.entityDataTable);
const editType = extractEditType(metadata.entityDataTable);

// VIEW: row.display[key], row.styles[key]
// EDIT: renderEditModeFromMetadata(row.raw[key], editType[key])
```

---

## Breaking Changes (v8.2.0)

| Removed | Replacement |
|---------|-------------|
| `FieldMetadata` type | Use `ViewFieldMetadata` or `EditFieldMetadata` |
| `FlatComponentMetadata` type | Use `ComponentMetadata` |
| `isNestedComponentMetadata()` | Use `isValidComponentMetadata()` |
| `createFallbackMetadata()` | Backend MUST send metadata |
| Flat metadata support | Backend sends `{ viewType, editType }` |

---

## Files Modified

### Frontend

| File | Changes |
|------|---------|
| `lib/formatters/types.ts` | Remove flat types, add validators |
| `lib/formatters/datasetFormatter.ts` | Remove flat support |
| `lib/formatters/index.ts` | Update exports |
| `stores/entityComponentMetadataStore.ts` | Use ComponentMetadata |
| `stores/index.ts` | Update type exports |
| `components/shared/ui/EntityDataTable.tsx` | Remove fallback, use extractors |
| `components/shared/entity/EntityFormContainer.tsx` | Remove fallback, use extractors |

### Backend

| File | Changes |
|------|---------|
| `services/backend-formatter.service.ts` | Already sends `{ viewType, editType }` |

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  METADATA COUPLING FLOW (v8.2.0)                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Backend (BFF)                                                               │
│  ─────────────────────────────────────────────────────────────────────────   │
│  generateEntityResponse() → {                                                │
│    metadata: {                                                               │
│      entityDataTable: { viewType: {...}, editType: {...} },                  │
│      entityFormContainer: { viewType: {...}, editType: {...} }               │
│    }                                                                         │
│  }                                                                           │
│                       │                                                      │
│                       ▼ HTTP Response                                        │
│                                                                              │
│  Frontend (React Query)                                                      │
│  ─────────────────────────────────────────────────────────────────────────   │
│  useFormattedEntityList() → cache RAW + select transform                     │
│                       │                                                      │
│                       ├── Store metadata → entityComponentMetadataStore      │
│                       │                                                      │
│                       └── select: formatDataset(data, metadata.entityDataTable)
│                                                                              │
│  Component (EntityDataTable)                                                 │
│  ─────────────────────────────────────────────────────────────────────────   │
│  const viewType = extractViewType(metadata.entityDataTable);                 │
│  const editType = extractEditType(metadata.entityDataTable);                 │
│                                                                              │
│  VIEW: <span className={row.styles[key]}>{row.display[key]}</span>           │
│  EDIT: renderEditModeFromMetadata(row.raw[key], editType[key])               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Validation

### TypeScript Check

```bash
cd apps/web && npx tsc --noEmit
# Should pass with zero errors
```

### Runtime Validation

Components now log errors when metadata is invalid:

```typescript
if (!isValidComponentMetadata(metadata)) {
  console.error('[EntityDataTable] No viewType in metadata - backend must send { viewType, editType }');
  return [];
}
```

---

## Migration Notes

### For Backend Routes

Ensure all routes use `generateEntityResponse()`:

```typescript
// Correct
const response = generateEntityResponse('project', projects, {
  components: ['entityDataTable', 'entityFormContainer']
});

// Wrong (deprecated)
return { data: projects, metadata: flatMetadata };
```

### For Frontend Components

Use extractors, not direct access:

```typescript
// Correct
const viewType = extractViewType(metadata.entityDataTable);
const editType = extractEditType(metadata.entityDataTable);

// Wrong (will error in v8.2.0)
const viewType = metadata.entityDataTable?.viewType ?? metadata;
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 8.2.0 | 2025-11-26 | Remove all legacy flat metadata support |
| 8.1.0 | 2025-11-25 | Add backward compatibility for migration |
| 8.0.0 | 2025-11-24 | Initial format-at-read implementation |

---

**Status:** COMPLETE | **Updated:** 2025-11-26
