# Zustand State Management Integration Guide

## Overview

This guide demonstrates how to integrate Zustand for efficient field-level state management in the PMO application. The solution provides:

- **Field-level change tracking** - Only send changed fields to the API
- **Optimistic updates** - Immediate UI feedback with rollback on error
- **Local persistence** - Maintain edit state during navigation
- **Undo/redo capability** - Full edit history
- **React Query integration** - Hybrid approach for best performance

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interaction                       │
│                   (Edit field in form)                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Zustand Edit Store                       │
│  • Tracks field-level changes                               │
│  • Maintains dirty fields set                               │
│  • Provides undo/redo stack                                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   Change Detection                          │
│  • Compares original vs current                             │
│  • Returns only changed fields                              │
│  • Normalizes empty strings to null                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    PATCH Request                            │
│  • Sends ONLY changed fields                                │
│  • Example: { "budget_amt": 50000 }                        │
│  • Not entire entity object                                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   React Query Cache                         │
│  • Optimistic update applied                                │
│  • Rollback on error                                        │
│  • Invalidate and refetch on success                        │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Example

### 1. Office Main Page (List View)

```typescript
// apps/web/src/pages/office/OfficePage.tsx
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { EntityDataTable } from '../../components/shared/ui/EntityDataTable';

export function OfficePage() {
  const navigate = useNavigate();

  // Fetch offices using React Query
  const { data: response, isLoading } = useQuery({
    queryKey: ['offices'],
    queryFn: async () => {
      const res = await fetch('/api/v1/office?view=entityDataTable');
      return res.json();
    }
  });

  const handleRowClick = (office: any) => {
    // Navigate to detail view
    navigate(`/office/${office.id}`);
  };

  return (
    <EntityDataTable
      data={response?.data}
      metadata={response?.metadata}
      onRowClick={handleRowClick}
    />
  );
}
```

### 2. Office Detail Page (With Zustand Integration)

```typescript
// apps/web/src/pages/office/OfficeDetailPage.tsx
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEntityEditStore } from '../../stores/useEntityEditStore';
import { EntityFormContainerWithStore } from '../../components/shared/entity/EntityFormContainerWithStore';
import { useState, useEffect } from 'react';

export function OfficeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  // Zustand store for edit state
  const {
    startEdit,
    saveChanges,
    cancelEdit,
    hasChanges,
    dirtyFields,
    reset
  } = useEntityEditStore();

  // Fetch office data with React Query
  const { data: response, isLoading } = useQuery({
    queryKey: ['office', id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/office/${id}?view=entityDetailView,entityFormContainer`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hasChanges()) {
        const confirmed = window.confirm('You have unsaved changes. Are you sure you want to leave?');
        if (!confirmed) {
          // Prevent navigation
          return;
        }
      }
      reset();
    };
  }, [hasChanges, reset]);

  const handleEdit = () => {
    if (response?.data) {
      startEdit('office', id!, response.data);
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    // Save with optimistic update
    const success = await saveWithOptimisticUpdate();

    if (success) {
      setIsEditing(false);
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['office', id] });
    }
  };

  const handleCancel = () => {
    if (hasChanges()) {
      const confirmed = window.confirm('Discard unsaved changes?');
      if (!confirmed) return;
    }

    cancelEdit();
    setIsEditing(false);
  };

  // Helper function for optimistic updates
  const saveWithOptimisticUpdate = async () => {
    const changes = useEntityEditStore.getState().getChanges();

    if (Object.keys(changes).length === 0) {
      return true;
    }

    // Optimistically update React Query cache
    const queryKey = ['office', id];
    await queryClient.cancelQueries({ queryKey });

    const previousData = queryClient.getQueryData(queryKey);

    queryClient.setQueryData(queryKey, (old: any) => ({
      ...old,
      data: { ...old?.data, ...changes }
    }));

    // Save changes
    const success = await saveChanges();

    if (!success) {
      // Rollback optimistic update
      queryClient.setQueryData(queryKey, previousData);
    }

    return success;
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="entity-detail-page">
      {/* Header with Edit button */}
      <div className="page-header">
        <h1>{response?.data?.name}</h1>
        <div className="header-actions">
          {!isEditing && (
            <button onClick={handleEdit} className="btn-edit">
              Edit
            </button>
          )}
          {dirtyFields.size > 0 && (
            <span className="unsaved-indicator">
              {dirtyFields.size} unsaved changes
            </span>
          )}
        </div>
      </div>

      {/* Form with Zustand integration */}
      <EntityFormContainerWithStore
        entityType="office"
        entityId={id!}
        data={response?.data}
        metadata={response?.metadata}
        datalabels={response?.datalabels}
        isEditing={isEditing}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );
}
```

### 3. Single Field Edit Example

When a user edits just one field (e.g., budget amount):

```typescript
// Inside EntityFormContainerWithStore

// User changes budget from 50000 to 75000
handleFieldChange('budget_allocated_amt', 75000);

// Zustand store tracks:
// - originalData: { budget_allocated_amt: 50000, ... }
// - currentData: { budget_allocated_amt: 75000, ... }
// - dirtyFields: Set(['budget_allocated_amt'])
// - changes: { budget_allocated_amt: 75000 }

// When saving:
const changes = getChanges();
// Returns: { budget_allocated_amt: 75000 }

// API call sends ONLY:
PUT /api/v1/office/123
{
  "budget_allocated_amt": 75000
}

// NOT the entire object!
```

## Benefits

### 1. Performance

- **Reduced Payload**: Only send changed fields (e.g., 50 bytes vs 5KB)
- **Less Conflicts**: Partial updates reduce concurrent edit conflicts
- **Optimistic Updates**: Instant UI feedback

### 2. User Experience

- **Visual Feedback**: Dirty field indicators
- **Undo/Redo**: Full edit history
- **Unsaved Changes Warning**: Prevent accidental data loss
- **Field-level Validation**: Validate only changed fields

### 3. Developer Experience

- **Simple Integration**: Drop-in replacement for existing forms
- **Debugging Tools**: Zustand DevTools integration
- **Type Safety**: Full TypeScript support
- **Reusable**: Works with any entity type

## Migration Guide

### Step 1: Install Dependencies

```bash
pnpm add zustand @tanstack/react-query
```

### Step 2: Update EntityFormContainer

Replace `onChange` prop with Zustand store:

```typescript
// Before
<EntityFormContainer
  data={data}
  isEditing={isEditing}
  onChange={(field, value) => {
    setData({ ...data, [field]: value });
  }}
/>

// After
<EntityFormContainerWithStore
  entityType="office"
  entityId={id}
  data={data}
  isEditing={isEditing}
  onSave={handleSave}
  onCancel={handleCancel}
/>
```

### Step 3: Update API Endpoints

Ensure PATCH/PUT endpoints handle partial updates:

```typescript
// Backend should merge partial updates
fastify.patch('/api/v1/office/:id', async (request, reply) => {
  const { id } = request.params;
  const updates = request.body; // Only changed fields

  // Merge with existing data
  const result = await db.execute(sql`
    UPDATE app.d_office
    SET ${sql.join(
      Object.entries(updates).map(([key, value]) =>
        sql`${sql.identifier([key])} = ${value}`
      ),
      sql`, `
    )}
    WHERE id = ${id}
    RETURNING *
  `);

  return result[0];
});
```

## Testing the Flow

1. **Navigate to Office List**: `/office`
2. **Click a row**: Navigate to `/office/{id}`
3. **Click Edit**: Enter edit mode
4. **Change one field**: e.g., change budget amount
5. **Observe**:
   - Dirty field indicator appears
   - "1 unsaved change" shown in toolbar
   - Undo button becomes enabled
6. **Save**:
   - Only changed field sent to API
   - Optimistic update applied immediately
   - On success, exits edit mode
7. **Verify**: Check network tab - only one field in request body

## Advanced Features

### Keyboard Shortcuts

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'z':
          e.preventDefault();
          undo();
          break;
        case 'y':
          e.preventDefault();
          redo();
          break;
        case 's':
          e.preventDefault();
          handleSave();
          break;
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [undo, redo, handleSave]);
```

### Auto-save

```typescript
// Auto-save after 3 seconds of inactivity
const AUTOSAVE_DELAY = 3000;

useEffect(() => {
  if (!hasChanges()) return;

  const timer = setTimeout(() => {
    saveChanges();
  }, AUTOSAVE_DELAY);

  return () => clearTimeout(timer);
}, [currentData, hasChanges, saveChanges]);
```

### Conflict Resolution

```typescript
// Handle concurrent edits
const handleSave = async () => {
  try {
    await saveChanges();
  } catch (error) {
    if (error.code === 'CONFLICT') {
      // Fetch latest version
      const latest = await fetchLatest();

      // Show diff dialog
      showConflictDialog({
        local: currentData,
        remote: latest,
        onResolve: (resolved) => {
          updateMultipleFields(resolved);
          saveChanges();
        }
      });
    }
  }
};
```

## Debugging

### Zustand DevTools

```typescript
// Enable in development
if (process.env.NODE_ENV === 'development') {
  window.__ZUSTAND_DEVTOOLS__ = true;
}
```

### Change Tracking Logger

```typescript
// Log all changes
useEntityEditStore.subscribe(
  (state) => state.dirtyFields,
  (dirtyFields) => {
    console.log('[Changes]', Array.from(dirtyFields));
  }
);
```

## Summary

The Zustand integration provides:

1. **Efficient Updates**: Only send changed fields
2. **Better UX**: Visual feedback, undo/redo, warnings
3. **Performance**: Optimistic updates, reduced payloads
4. **Developer Experience**: Simple API, good debugging

This approach scales well from simple forms to complex multi-tab entity editors while maintaining excellent performance and user experience.