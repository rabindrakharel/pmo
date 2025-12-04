# Industry Standard TanStack Query Inline Add Row Plan

## Problem Statement

Current implementation has competing data sources:
1. `localData` state - copies ALL data when editing
2. TanStack Query cache - server data
3. `useOptimisticMutation.onMutate` - adds temp row on create

This causes:
- Duplicate temp rows (one from `handleAddRow`, one from `onMutate`)
- Row click navigation to invalid temp URLs
- Complex state management with unclear source of truth

## Solution: Single Source of Truth Pattern

**Core Principle**: TanStack Query cache is the ONLY source of truth. No local data copying.

### Current Flow (Broken)

```
1. User clicks "Add Row"
2. EntityListOfInstancesTable.handleStartAddRow() creates { id: temp_123, _isNew: true }
3. Calls onAddRow(newRow)
4. EntityListOfInstancesPage.handleAddRow():
   - Copies ALL rawData to localData
   - Adds temp row to localData
   - Sets editingRow, editedData, isAddingRow
5. Table displays localData (copy of all data + temp)
6. User fills fields, clicks Save
7. handleSaveInlineEdit() calls createEntity(data)
8. useOptimisticMutation.onMutate() adds ANOTHER temp row to cache
9. RESULT: Duplicate rows!
```

### New Flow (TanStack Standard)

```
1. User clicks "Add Row"
2. EntityListOfInstancesTable.handleStartAddRow() creates { id: temp_123, _isNew: true }
3. Calls onAddRow(newRow)
4. EntityListOfInstancesPage.handleAddRow():
   - Uses queryClient.setQueryData() to add temp row DIRECTLY to cache
   - Sets editingRow, editedData, isAddingRow
5. Table displays cache data via formattedData (temp row is in cache)
6. User fills fields, clicks Save
7. handleSaveInlineEdit():
   - Removes _isNew flag, prepares data
   - Passes existingTempId to createEntity()
8. useOptimisticMutation.createEntity():
   - onMutate: SKIPS adding temp row (already exists with known ID)
   - API call with POST
   - onSuccess: REPLACES temp row with real server data (new ID)
9. RESULT: Clean single row!
```

---

## Implementation Steps

### Step 1: Modify useOptimisticMutation Hook

**File**: `apps/web/src/db/cache/hooks/useOptimisticMutation.ts`

**Changes**:
1. Add `existingTempId` parameter to `createEntity`
2. Modify `onMutate` to skip temp row creation when `existingTempId` provided
3. `onSuccess` replaces row by `existingTempId` (not by newly created temp ID)

```typescript
// Current signature:
createEntity: (data: Partial<T>) => Promise<T>;

// New signature:
createEntity: (data: Partial<T>, options?: { existingTempId?: string }) => Promise<T>;
```

**onMutate changes**:
```typescript
onMutate: async (params) => {
  const { data: newData, existingTempId } = params;

  // Cancel outgoing queries
  await queryClient.cancelQueries(...);

  // Capture previous state for rollback
  const allPreviousListData = new Map();

  if (existingTempId) {
    // Row already exists in cache - just capture state for rollback
    // DO NOT add new temp row
    const queryCache = queryClient.getQueryCache();
    const matchingQueries = queryCache.findAll({
      queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
    });
    for (const query of matchingQueries) {
      const previousData = query.state.data;
      if (previousData?.data) {
        allPreviousListData.set(JSON.stringify(query.queryKey), { ...previousData });
      }
    }
  } else {
    // Original flow: create temp row in cache
    const tempId = `temp_${Date.now()}`;
    const tempEntity = { ...newData, id: tempId, _isOptimistic: true } as T;
    allPreviousListData = updateAllListCaches(...);
  }

  return {
    allPreviousListData,
    entityId: existingTempId || tempId,  // Use existing or new temp ID
    mutationType: 'create',
  };
}
```

**onSuccess changes**:
```typescript
onSuccess: async (data, _variables, context) => {
  // Replace temp entity (by context.entityId) with real server data
  if (context?.entityId) {
    updateAllListCaches<T>(queryClient, entityCode, (listData) =>
      listData.map((item) => (item.id === context.entityId ? data : item))
    );

    // Replace in Dexie too
    replaceEntityInstanceDataItem(entityCode, context.entityId, data);
  }
  // ... rest unchanged
}
```

**onError changes** (for existingTempId case):
```typescript
onError: (error, _variables, context) => {
  if (context?.existingTempId) {
    // Remove the temp row that was added by handleAddRow
    updateAllListCaches<T>(queryClient, entityCode, (listData) =>
      listData.filter((item) => item.id !== context.existingTempId)
    );
  } else if (context?.allPreviousListData) {
    // Original rollback flow
    rollbackAllListCaches(queryClient, context.allPreviousListData);
  }
}
```

---

### Step 2: Modify EntityListOfInstancesPage

**File**: `apps/web/src/pages/shared/EntityListOfInstancesPage.tsx`

#### 2.1 Remove localData State

```typescript
// REMOVE these:
const [localData, setLocalData] = useState<any[]>([]);
const data = localData.length > 0 ? localData : combinedRawData;
useEffect(() => { if (!editingRow && !isAddingRow) setLocalData([]); }, [...]);

// KEEP these (still needed):
const [editingRow, setEditingRow] = useState<string | null>(null);
const [editedData, setEditedData] = useState<any>({});
const [isAddingRow, setIsAddingRow] = useState(false);
```

#### 2.2 Add queryClient Access

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/db/cache/keys';

// Inside component:
const queryClient = useQueryClient();
```

#### 2.3 Rewrite handleAddRow

```typescript
const handleAddRow = useCallback((newRow: any) => {
  // Add temp row DIRECTLY to TanStack Query cache
  // This is the industry standard pattern - cache is single source of truth

  const queryCache = queryClient.getQueryCache();
  const matchingQueries = queryCache.findAll({
    queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
  });

  for (const query of matchingQueries) {
    queryClient.setQueryData(query.queryKey, (oldData: any) => {
      if (!oldData?.data) return oldData;
      return {
        ...oldData,
        data: [...oldData.data, newRow],  // Add temp row to END
        total: (oldData.total || 0) + 1,
      };
    });
  }

  // Enter edit mode for the new row
  setEditingRow(newRow.id);
  setEditedData(newRow);
  setIsAddingRow(true);
}, [queryClient, entityCode]);
```

#### 2.4 Rewrite handleCancelInlineEdit

```typescript
const handleCancelInlineEdit = useCallback(() => {
  if (isAddingRow && editingRow) {
    // Remove temp row from cache (single source of truth)
    const queryCache = queryClient.getQueryCache();
    const matchingQueries = queryCache.findAll({
      queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
    });

    for (const query of matchingQueries) {
      queryClient.setQueryData(query.queryKey, (oldData: any) => {
        if (!oldData?.data) return oldData;
        return {
          ...oldData,
          data: oldData.data.filter((item: any) => item.id !== editingRow),
          total: Math.max(0, (oldData.total || 1) - 1),
        };
      });
    }
  }

  // Clear edit state
  setEditingRow(null);
  setEditedData({});
  setIsAddingRow(false);
}, [isAddingRow, editingRow, queryClient, entityCode]);
```

#### 2.5 Modify handleSaveInlineEdit

```typescript
const handleSaveInlineEdit = useCallback(async (record: any) => {
  if (!config) return;

  const rawRecord = record.raw || record;
  const recordId = rawRecord.id;
  const isNewRow = isAddingRow || recordId?.toString().startsWith('temp_') || rawRecord._isNew;

  // Transform data for API
  const transformedData = transformForApi(editedData, rawRecord);
  delete transformedData._isNew;
  delete transformedData._isOptimistic;
  if (isNewRow) {
    delete transformedData.id;  // Let server generate ID
  }

  try {
    if (isNewRow) {
      // Pass existingTempId so onMutate doesn't create duplicate
      await createEntity(transformedData, { existingTempId: recordId });
    } else {
      await updateEntity(recordId, transformedData);
    }

    // Clear edit state on success
    setEditingRow(null);
    setEditedData({});
    setIsAddingRow(false);
  } catch (error) {
    // Error handling done by onError callback
    // For new rows, onError will remove the temp row from cache
    setEditingRow(null);
    setEditedData({});
    setIsAddingRow(false);
  }
}, [config, editedData, isAddingRow, createEntity, updateEntity]);
```

#### 2.6 Update Table Data Source

```typescript
// Table always uses formattedData from cache
// formattedData is computed from rawData (which comes from cache)

// In renderContent(), table view:
const tableData = formattedData;  // Always formatted data from cache

// For empty state, fall back to rawData (unformatted)
if (formattedData.length === 0 && rawData?.length > 0) {
  tableData = rawData;
}
```

#### 2.7 Fix Edit Row Action (No localData Sync)

```typescript
// rowActions for Edit:
{
  key: 'edit',
  label: 'Edit',
  icon: <Edit className="h-4 w-4" />,
  variant: 'default',
  onClick: (record) => {
    // NO localData sync needed - cache is source of truth
    const rawRecord = record.raw || record;
    setEditingRow(rawRecord.id);
    setEditedData(transformFromApi({ ...rawRecord }));
  }
}
```

---

### Step 3: Handle Row Click for Temp Rows

**File**: `apps/web/src/pages/shared/EntityListOfInstancesPage.tsx`

```typescript
const handleRowClick = useCallback((item: any) => {
  if (!config) return;

  const rawItem = item.raw || item;
  const id = rawItem[config.detailPageIdField || 'id'];

  // Prevent navigation for temp rows (they don't exist on server yet)
  if (id?.toString().startsWith('temp_')) {
    return;  // Do nothing - row is still being created
  }

  navigate(`/${entityCode}/${id}`);
}, [config, entityCode, navigate]);
```

---

## Behaviors Preserved

| Behavior | How Preserved |
|----------|---------------|
| **Row Click** | Works - navigates to detail page (blocked for temp rows) |
| **Inline Edit** | Works - `editingRow` + `editedData` state unchanged |
| **Save Edit** | Works - calls `updateEntity` with optimistic update |
| **Add Row** | Works - adds to cache, enters edit mode |
| **Save New Row** | Works - `createEntity` with `existingTempId` replaces temp |
| **Cancel Add** | Works - removes temp row from cache |
| **Dropdown Fields** | Works - `editedData` state captures selections |
| **Currency/Date Fields** | Works - `transformForApi` handles conversion |
| **Delete Row** | Works - unchanged (uses `deleteEntity`) |
| **Optimistic Updates** | Works - cache updated immediately, rollback on error |
| **Formatted Display** | Works - `formattedData` computed from cache |

---

## Testing Checklist

### Add Row Flow
- [ ] Click "Add new row" - temp row appears at bottom in edit mode
- [ ] Fill in text field - value captured
- [ ] Select dropdown - value captured
- [ ] Enter currency amount - value captured
- [ ] Click Save - row persists, real ID assigned
- [ ] Click row - navigates to detail page

### Cancel Flow
- [ ] Click "Add new row" - temp row appears
- [ ] Click Cancel - temp row removed
- [ ] No console errors

### Edit Flow
- [ ] Click Edit action on existing row - enters edit mode
- [ ] Change values - captured in editedData
- [ ] Click Save - optimistic update, then API sync
- [ ] Changes persist after refresh

### Error Handling
- [ ] Add row, save with invalid data - error shown, temp row removed
- [ ] Edit row, save with API error - rollback to previous values

### Edge Cases
- [ ] Click temp row before save - no navigation (blocked)
- [ ] Add row, switch tabs, return - state cleared
- [ ] Add multiple rows rapidly - no duplicates

---

## File Changes Summary

| File | Changes |
|------|---------|
| `useOptimisticMutation.ts` | Add `existingTempId` option, modify onMutate/onSuccess/onError |
| `EntityListOfInstancesPage.tsx` | Remove localData, add queryClient, rewrite handlers |

---

## Rollback Plan

If issues arise, revert to "Local Additions" pattern (simpler, less TanStack-native):

```typescript
// Keep localAdditions for temp rows only (like child entity tabs)
const [localAdditions, setLocalAdditions] = useState<any[]>([]);
const data = useMemo(() => {
  if (localAdditions.length === 0) return combinedRawData;
  return [...combinedRawData, ...localAdditions];
}, [combinedRawData, localAdditions]);
```

This is the pattern used by `EntitySpecificInstancePage` child tabs and works reliably.

---

## Version

**Plan Version**: 1.0.0
**Created**: 2025-12-03
**Target**: EntityListOfInstancesPage inline add row with TanStack Query single source of truth
