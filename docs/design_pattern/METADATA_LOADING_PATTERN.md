# Metadata Loading Pattern (Format-at-Read Architecture)

**Version**: 1.0.0
**Date**: 2025-12-04
**Pattern**: Async Metadata Loading with Undefined States

---

## Problem Statement

When using TanStack Query's format-at-read pattern with separate metadata and data queries, metadata can load asynchronously, causing intermediate renders with empty `{}` objects. This breaks component logic that checks `Object.keys(metadata).length === 0` to determine if metadata is unavailable.

### Symptoms

```typescript
// ❌ WRONG: Returns {} during load, causing false positives
const { viewType } = useEntityInstanceMetadata('project');
// Initial render: viewType = {}  (Object.keys(viewType).length === 0)
// After load:     viewType = { id: {...}, name: {...}, ... }

// Component logic fails:
if (Object.keys(viewType).length === 0) {
  return null;  // ⬅️ Incorrectly treats loading state as "no metadata"
}
```

---

## Industry Standard Solution

**Pattern**: Nullable Types with Undefined States

The standard React Query pattern is to return `undefined` for unloaded data, not empty objects.

### Type Definition

```typescript
export interface UseEntityInstanceMetadataResult {
  fields: string[];
  viewType: Record<string, unknown> | undefined;  // ⬅️ undefined during load
  editType: Record<string, unknown> | undefined;  // ⬅️ undefined during load
  isLoading: boolean;
  isError: boolean;
}
```

### Hook Implementation

```typescript
export function useEntityInstanceMetadata(
  entityCode: string,
  component: string = 'entityListOfInstancesTable'
): UseEntityInstanceMetadataResult {
  const query = useQuery<MetadataRecord>({
    queryKey: QUERY_KEYS.entityInstanceMetadata(entityCode, component),
    enabled: Boolean(entityCode),
    queryFn: async () => {
      // ... fetch metadata from API or cache
      return {
        fields: [...],
        viewType: {...},
        editType: {...},
        syncedAt: Date.now()
      };
    },
    staleTime: SESSION_STORE_CONFIG.staleTime,
    gcTime: SESSION_STORE_CONFIG.gcTime,
  });

  return {
    fields: query.data?.fields ?? [],
    viewType: query.data?.viewType,      // ✅ Return undefined when loading (not {})
    editType: query.data?.editType,      // ✅ Return undefined when loading (not {})
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
```

### Consumer Pattern

```typescript
const {
  viewType: formViewType,
  editType: formEditType,
  isLoading: metadataLoading,
} = useEntityInstanceMetadata(entityCode, 'entityInstanceFormContainer');

const formMetadata = useMemo(() => {
  // ✅ Check for undefined (loading) vs null/empty (error/no data)
  if (!formViewType) {
    console.log('[Component] Metadata still loading or unavailable');
    return null;
  }

  return { viewType: formViewType, editType: formEditType };
}, [formViewType, formEditType]);

// Render logic
if (!formMetadata) {
  return <LoadingSpinner />;  // ⬅️ Correctly shows loading state
}

return <EntityForm metadata={formMetadata} />;
```

---

## Comparison with Previous Implementation

### ❌ BROKEN (v1.0.0)

```typescript
// Hook returns empty objects during load
return {
  viewType: query.data?.viewType ?? {},  // ⬅️ {} when loading
  editType: query.data?.editType ?? {},  // ⬅️ {} when loading
};

// Consumer can't distinguish loading from empty
if (Object.keys(viewType).length === 0) {
  return null;  // ⬅️ False positive - treats loading as "no metadata"
}
```

### ✅ FIXED (v1.1.0)

```typescript
// Hook returns undefined during load
return {
  viewType: query.data?.viewType,  // ⬅️ undefined when loading
  editType: query.data?.editType,  // ⬅️ undefined when loading
};

// Consumer can distinguish loading from empty
if (!viewType) {
  return null;  // ⬅️ Correctly handles undefined (loading) state
}
```

---

## Format-at-Read Integration

This pattern integrates with the format-at-read architecture:

```
┌─────────────────────────────────────────────────────────────┐
│           Metadata Loading Flow (Format-at-Read)            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Component Mount                                          │
│     ↓                                                        │
│  2. useEntityInstanceMetadata('project', 'formContainer')   │
│     → TanStack Query checks cache                           │
│     → Cache MISS → viewType = undefined                     │
│     ↓                                                        │
│  3. Component Render #1                                      │
│     formMetadata = useMemo(() => {                           │
│       if (!formViewType) return null;  // ⬅️ undefined      │
│     })                                                       │
│     → Returns null → Shows <LoadingSpinner />               │
│     ↓                                                        │
│  4. TanStack Query Fetches API                              │
│     GET /api/v1/project?content=metadata                     │
│     → Returns { metadata: { formContainer: { viewType, ... }}}│
│     → Stores in cache                                        │
│     ↓                                                        │
│  5. Component Render #2                                      │
│     formMetadata = useMemo(() => {                           │
│       if (!formViewType) return null;                        │
│       return { viewType: {...}, editType: {...} };  // ✅   │
│     })                                                       │
│     → Returns metadata → Shows <EntityForm />               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Related Patterns

### 1. Data Loading Pattern (useEntity)

```typescript
const { data: rawData, isLoading } = useEntity(entityCode, id);

// ✅ rawData is undefined during load
if (!rawData) {
  return <LoadingSpinner />;
}

// Format-at-read happens here
const formattedData = useMemo(() => formatData(rawData, metadata), [rawData, metadata]);
```

### 2. List Loading Pattern (useEntityInstanceData)

```typescript
const { data, metadata, isLoading } = useEntityInstanceData<Project>('project', { limit: 20 });

// ✅ data is [] (empty array), metadata is undefined during load
if (isLoading || !metadata) {
  return <TableSkeleton />;
}

// Format-at-read happens here
const formattedRows = useMemo(() => formatDataset(data, metadata), [data, metadata]);
```

---

## Anti-Patterns

### ❌ Using Empty Objects as Default

```typescript
// DON'T DO THIS
const { viewType = {} } = useEntityInstanceMetadata('project');
//                  ^^^ Always truthy, can't detect loading state
```

### ❌ Checking Object Keys Instead of Truthiness

```typescript
// DON'T DO THIS
if (Object.keys(viewType || {}).length === 0) {
  return null;  // Can't distinguish undefined from {}
}

// DO THIS
if (!viewType) {
  return null;  // Correctly handles undefined
}
```

### ❌ Not Using isLoading Flag

```typescript
// DON'T DO THIS - Ignores explicit loading state
const { viewType } = useEntityInstanceMetadata('project');
if (!viewType) {
  return <ErrorMessage />;  // ⬅️ Shows error during loading!
}

// DO THIS
const { viewType, isLoading } = useEntityInstanceMetadata('project');
if (isLoading) {
  return <LoadingSpinner />;
}
if (!viewType) {
  return <ErrorMessage />;  // Only shows error if load completed but failed
}
```

---

## Testing Strategy

### Unit Test

```typescript
describe('useEntityInstanceMetadata', () => {
  it('returns undefined during initial load', () => {
    const { result } = renderHook(() => useEntityInstanceMetadata('project'));

    expect(result.current.viewType).toBeUndefined();
    expect(result.current.editType).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
  });

  it('returns metadata after load', async () => {
    const { result, waitFor } = renderHook(() => useEntityInstanceMetadata('project'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.viewType).toBeDefined();
    expect(Object.keys(result.current.viewType!).length).toBeGreaterThan(0);
  });
});
```

---

## Migration Guide

### Step 1: Update Hook Return Type

```diff
export interface UseEntityInstanceMetadataResult {
  fields: string[];
- viewType: Record<string, unknown>;
+ viewType: Record<string, unknown> | undefined;
- editType: Record<string, unknown>;
+ editType: Record<string, unknown> | undefined;
  isLoading: boolean;
  isError: boolean;
}
```

### Step 2: Update Hook Implementation

```diff
return {
  fields: query.data?.fields ?? [],
- viewType: query.data?.viewType ?? {},
+ viewType: query.data?.viewType,
- editType: query.data?.editType ?? {},
+ editType: query.data?.editType,
  isLoading: query.isLoading,
  isError: query.isError,
};
```

### Step 3: Update Consumer Logic

```diff
const formMetadata = useMemo(() => {
- if (!formViewType || Object.keys(formViewType).length === 0) {
+ if (!formViewType) {
-   console.warn('Empty metadata');
+   console.log('Metadata still loading');
    return null;
  }

  return { viewType: formViewType, editType: formEditType };
}, [formViewType, formEditType]);
```

---

## References

- TanStack Query Best Practices: https://tanstack.com/query/latest/docs/react/guides/important-defaults
- React Hooks Patterns: https://react.dev/reference/react/hooks#state-hooks
- Format-at-Read Architecture: [docs/design_pattern/FIELD_RENDERER_ARCHITECTURE.md](FIELD_RENDERER_ARCHITECTURE.md)

---

**Version History**:
- v1.0.0 (2025-12-04): Initial pattern documentation
- v1.1.0 (2025-12-04): Fixed to return undefined instead of empty objects
