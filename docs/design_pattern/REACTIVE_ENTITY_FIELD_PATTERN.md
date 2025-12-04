# Reactive Entity Field Pattern

**Version**: 1.0.0
**Date**: 2025-12-04
**Status**: Production Ready
**Pattern Type**: Metadata-Driven Reactive UI with Portal-Safe Interaction

---

## Overview

The **Reactive Entity Field Pattern** is a unified design pattern that solves two critical challenges in metadata-driven enterprise UIs:

1. **Async Metadata Loading** - Handling undefined states during TanStack Query cache hydration
2. **Portal Dropdown Interactions** - Preventing click-outside handlers from racing with dropdown selections

This pattern is the foundation of PMO's universal entity field rendering system, enabling a single codebase to render 27+ entity types with 200+ field types across 3 universal pages.

---

## The Two Core Problems

### Problem 1: Metadata Loading Race Condition

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              METADATA LOADING TIMELINE (TanStack Query)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  T=0ms    Component mounts                                                  │
│           useEntityInstanceMetadata('project', 'formContainer')             │
│           ↓                                                                  │
│  T=0ms    TanStack Query checks cache → MISS                                │
│           Returns: { viewType: undefined, editType: undefined }             │
│           ↓                                                                  │
│  T=0ms    Component renders with undefined metadata                         │
│           formMetadata = useMemo(() => {                                    │
│             if (!viewType) return null;  // ✅ Correctly detects loading   │
│           })                                                                 │
│           ↓                                                                  │
│  T=50ms   TanStack Query fetches API                                        │
│           GET /api/v1/project?content=metadata                              │
│           ↓                                                                  │
│  T=100ms  API responds with metadata                                        │
│           { viewType: {...}, editType: {...} }                              │
│           ↓                                                                  │
│  T=100ms  TanStack Query updates cache                                      │
│           viewType changes: undefined → { id: {...}, name: {...} }         │
│           ↓                                                                  │
│  T=100ms  Component re-renders                                              │
│           formMetadata now has data ✅                                      │
│           FieldRenderer can resolve components                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**The Anti-Pattern** (v1.0.0 - BROKEN):
```typescript
// ❌ Returns empty object during load
return {
  viewType: query.data?.viewType ?? {},  // {} when loading
  editType: query.data?.editType ?? {},  // {} when loading
};

// Consumer can't distinguish loading from empty
if (Object.keys(viewType).length === 0) {
  return null;  // False positive - treats loading as "no metadata"
}
```

**The Correct Pattern** (v1.1.0 - FIXED):
```typescript
// ✅ Returns undefined during load
return {
  viewType: query.data?.viewType,  // undefined when loading
  editType: query.data?.editType,  // undefined when loading
};

// Consumer can distinguish loading from empty
if (!viewType) {
  return null;  // Correctly handles undefined (loading) state
}
```

---

### Problem 2: Portal Dropdown Click-Outside Race

```
┌─────────────────────────────────────────────────────────────────────────────┐
│           PORTAL DROPDOWN EVENT FLOW (React Portal + Event Order)           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  User Action: Click dropdown option "Sarah Johnson"                         │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ DOM Structure                                                          │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                        │ │
│  │  <div ref={editingFieldRef}>                ← Parent container        │ │
│  │    <div ref={containerRef}>                 ← Trigger button          │ │
│  │      Manager Employee Name ▾                                          │ │
│  │    </div>                                                             │ │
│  │  </div>                                                               │ │
│  │                                                                        │ │
│  │  Portal (at document.body):                                           │ │
│  │  <div data-dropdown-portal ref={dropdownRef}>  ← Portal dropdown     │ │
│  │    <div onClick={selectOption}>Sarah Johnson</div>  ← Click target   │ │
│  │  </div>                                                               │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  Event Timeline:                                                             │
│  ─────────────                                                               │
│  T=0ms    mousedown event fires                                             │
│           ↓                                                                  │
│  T=1ms    EntityInstanceFormContainer.handleClickOutside() (Phase 1)        │
│           • Check: editingFieldRef.contains(option)? NO                     │
│           • Check: option.closest('[data-dropdown-portal]')? YES ✅         │
│           • RETURN EARLY (does not call handleInlineSave)                   │
│           ↓                                                                  │
│  T=2ms    EntityInstanceNameSelect.handleClickOutside() (Phase 2)           │
│           • Check: containerRef.contains(option)? NO                        │
│           • Check: dropdownRef.contains(option)? YES ✅                     │
│           • RETURN EARLY (does not close dropdown)                          │
│           ↓                                                                  │
│  T=10ms   click event fires (after mousedown completes)                     │
│           ↓                                                                  │
│  T=11ms   EntityInstanceNameSelect.selectOption() onClick handler           │
│           • onChange(uuid, label) fires                                     │
│           • handleInlineValueChange(uuid) updates state                     │
│           • setIsOpen(false) closes dropdown                                │
│           • Value captured ✅                                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**The Anti-Pattern** (v1.0.0 - BROKEN):
```typescript
// ❌ Only checks parent container
const handleClickOutside = (event: MouseEvent) => {
  if (editingFieldRef.current && !editingFieldRef.current.contains(event.target as Node)) {
    handleInlineSave();  // Fires when clicking dropdown options!
  }
};
```

**The Correct Pattern** (v1.1.0 - FIXED):
```typescript
// ✅ Checks BOTH parent container AND portal dropdowns
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node;

  // Check 1: Inside our managed element?
  if (editingFieldRef.current && editingFieldRef.current.contains(target)) {
    return;
  }

  // Check 2: Inside ANY portal dropdown? (Generic detection)
  const isClickInsideDropdown = (target as Element).closest?.('[data-dropdown-portal]');
  if (isClickInsideDropdown) {
    return;  // Let dropdown handle it
  }

  // Truly outside - safe to trigger action
  handleInlineSave();
};
```

---

## The Unified Pattern: 5 Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REACTIVE ENTITY FIELD ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LAYER 1: Metadata Fetching (TanStack Query + Nullable Types)               │
│  ──────────────────────────────────────────────────────────                 │
│  • useEntityInstanceMetadata() returns undefined during load                │
│  • Type: Record<string, unknown> | undefined (not {})                       │
│  • Consumer checks: if (!viewType) return null;                             │
│                                                                              │
│  LAYER 2: Reactive Formatting (Format-at-Read + Cache Subscription)         │
│  ────────────────────────────────────────────────────────────               │
│  • useFormattedEntityData() subscribes to datalabel cache                   │
│  • Re-formats when badge colors change in settings                          │
│  • Output: { raw, display, styles }                                         │
│                                                                              │
│  LAYER 3: Component Registry (Metadata-Driven Resolution)                   │
│  ──────────────────────────────────────────────────                         │
│  • ViewComponentRegistry: renderType → React component                      │
│  • EditComponentRegistry: inputType → React component                       │
│  • Registered at app init: registerAllComponents()                          │
│                                                                              │
│  LAYER 4: Portal Rendering (React Portal + Data Attribute)                  │
│  ───────────────────────────────────────────────────────                    │
│  • createPortal(dropdown, document.body)                                    │
│  • <div data-dropdown-portal=""> for generic detection                      │
│  • Component-level click-outside: checks BOTH refs                          │
│                                                                              │
│  LAYER 5: Portal-Aware Parent Handlers (Defense in Depth)                   │
│  ──────────────────────────────────────────────────────                     │
│  • Parent components check: target.closest('[data-dropdown-portal]')        │
│  • Returns early if click is inside any portal dropdown                     │
│  • Only triggers action for truly "outside" clicks                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Guide

### Step 1: Metadata Hook (Layer 1)

**File**: `apps/web/src/db/cache/hooks/useEntityInstanceData.ts`

```typescript
export interface UseEntityInstanceMetadataResult {
  fields: string[];
  viewType: Record<string, unknown> | undefined;  // ✅ undefined during load
  editType: Record<string, unknown> | undefined;  // ✅ undefined during load
  isLoading: boolean;
  isError: boolean;
}

export function useEntityInstanceMetadata(
  entityCode: string,
  component: string = 'entityListOfInstancesTable'
): UseEntityInstanceMetadataResult {
  const query = useQuery<MetadataRecord>({
    queryKey: QUERY_KEYS.entityInstanceMetadata(entityCode, component),
    enabled: Boolean(entityCode),
    queryFn: async () => {
      const response = await api.get(`/api/v1/${entityCode}?content=metadata&component=${component}`);
      return {
        fields: response.fields || [],
        viewType: response.metadata?.[component]?.viewType || {},
        editType: response.metadata?.[component]?.editType || {},
        syncedAt: Date.now()
      };
    },
    staleTime: 30 * 60 * 1000,  // 30 min
    gcTime: 60 * 60 * 1000,     // 1 hour
  });

  return {
    fields: query.data?.fields ?? [],
    viewType: query.data?.viewType,      // ✅ Return undefined when loading
    editType: query.data?.editType,      // ✅ Return undefined when loading
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
```

---

### Step 2: Consumer Pattern (Layer 1 + 2)

**File**: `apps/web/src/pages/shared/EntitySpecificInstancePage.tsx`

```typescript
const {
  viewType: formViewType,
  editType: formEditType,
  isLoading: metadataLoading,
} = useEntityInstanceMetadata(entityCode, 'entityInstanceFormContainer');

// Construct metadata object
const formMetadata = useMemo(() => {
  // ✅ Check for undefined (loading) vs null/empty (error/no data)
  if (!formViewType) {
    console.log('[EntitySpecificInstancePage] Metadata still loading or unavailable');
    return null;
  }

  return { viewType: formViewType, editType: formEditType };
}, [formViewType, formEditType]);

// Format data on read (Layer 2)
const formattedData = useMemo(() => {
  if (!rawData || !formMetadata) return null;
  return formatRow(rawData, formMetadata, refData);
}, [rawData, formMetadata, refData]);

// Render logic
if (!formMetadata) {
  return <LoadingSpinner />;  // ✅ Shows loading during metadata fetch
}

return (
  <EntityInstanceFormContainer
    metadata={formMetadata}
    data={rawData}
    formattedData={formattedData}
    onInlineSave={handleInlineSave}
  />
);
```

---

### Step 3: Dropdown Component (Layer 4)

**File**: `apps/web/src/components/shared/ui/EntityInstanceNameSelect.tsx`

```typescript
const EntityInstanceNameSelect: FC<Props> = ({ value, onChange, entityCode }) => {
  const [isOpen, setIsOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Component-level click-outside: Check BOTH refs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      {/* Trigger */}
      <div ref={containerRef} onClick={() => setIsOpen(true)}>
        {value || 'Select...'}
      </div>

      {/* Portal dropdown with data attribute */}
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          data-dropdown-portal=""  // ✅ CRITICAL: Generic detection marker
          style={{ position: 'absolute', zIndex: 9999 }}
        >
          {options.map(opt => (
            <div key={opt.value} onClick={() => {
              onChange(opt.value, opt.label);
              setIsOpen(false);
            }}>
              {opt.label}
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};
```

---

### Step 4: Parent Component (Layer 5)

**File**: `apps/web/src/components/shared/entity/EntityInstanceFormContainer.tsx`

```typescript
// Portal-aware click-outside handler
useEffect(() => {
  if (!inlineEditingField) return;

  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as Node;

    // Check 1: Inside our editing field?
    if (editingFieldRef.current && editingFieldRef.current.contains(target)) {
      return;
    }

    // Check 2: Inside ANY portal dropdown? (Generic detection)
    const isClickInsideDropdown = (target as Element).closest?.('[data-dropdown-portal]');
    if (isClickInsideDropdown) {
      console.log('🎯 Click inside dropdown portal, ignoring click-outside');
      return;
    }

    // Truly outside - safe to save
    console.log('🚪 Click outside detected, triggering handleInlineSave');
    handleInlineSave();
  };

  // Use mousedown (fires BEFORE click)
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, [inlineEditingField, handleInlineSave]);
```

---

### Step 5: Component Registration (Layer 3)

**File**: `apps/web/src/lib/fieldRenderer/registerComponents.tsx`

```typescript
import { registerEditComponent } from './ComponentRegistry';
import { EntityInstanceNameSelect } from '@/components/shared/ui/EntityInstanceNameSelect';

// Wrapper to conform to ComponentRendererProps interface
const EntityInstanceNameSelectEdit: FC<ComponentRendererProps> = ({
  value,
  field,
  onChange,
  disabled,
  readonly,
}) => {
  const entityCode = field.lookupEntity;

  return (
    <EntityInstanceNameSelect
      entityCode={entityCode}
      value={value ?? ''}
      onChange={(uuid, label) => {
        if (onChange) {
          onChange(uuid);  // Only pass UUID to parent
        }
      }}
      disabled={disabled || readonly}
    />
  );
};

// Register at app initialization
registerEditComponent('EntityInstanceNameSelect', EntityInstanceNameSelectEdit);
```

---

## Complete Data Flow Example

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INLINE EDIT FLOW (All 5 Layers)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  USER: Navigate to /project/uuid                                            │
│  ──────────────────────────────────                                         │
│  ↓                                                                           │
│  LAYER 1: Metadata Fetching                                                 │
│  ────────────────────────                                                   │
│  • useEntityInstanceMetadata('project', 'formContainer')                    │
│  • T=0ms: Returns { viewType: undefined, editType: undefined }             │
│  • Component shows <LoadingSpinner />                                       │
│  • T=100ms: API returns metadata                                            │
│  • Returns { viewType: {...}, editType: {...} }                             │
│  ↓                                                                           │
│  LAYER 2: Reactive Formatting                                               │
│  ─────────────────────────                                                  │
│  • formatRow(rawData, metadata, refData)                                    │
│  • Output: { raw, display, styles }                                         │
│  ↓                                                                           │
│  LAYER 3: Component Registry                                                │
│  ────────────────────────                                                   │
│  • FieldRenderer sees: field.inputType = 'EntityInstanceNameSelect'         │
│  • EditComponentRegistry.get('EntityInstanceNameSelect')                    │
│  • Renders: <EntityInstanceNameSelectEdit />                                │
│  ↓                                                                           │
│  LAYER 4: Portal Rendering                                                  │
│  ───────────────────────                                                    │
│  • User long-presses field → isInlineEditing = true                         │
│  • EntityInstanceNameSelect renders dropdown via createPortal()             │
│  • <div data-dropdown-portal ref={dropdownRef}>                             │
│  ↓                                                                           │
│  USER: Click dropdown option "Sarah Johnson"                                │
│  ───────────────────────────────────────────                                │
│  ↓                                                                           │
│  LAYER 5: Portal-Aware Handlers                                             │
│  ────────────────────────────                                               │
│  • mousedown event fires                                                    │
│  • EntityInstanceFormContainer.handleClickOutside():                        │
│    - editingFieldRef.contains(option)? NO                                   │
│    - option.closest('[data-dropdown-portal]')? YES ✅                       │
│    - RETURN EARLY                                                           │
│  • EntityInstanceNameSelect.handleClickOutside():                           │
│    - containerRef.contains(option)? NO                                      │
│    - dropdownRef.contains(option)? YES ✅                                   │
│    - RETURN EARLY                                                           │
│  • click event fires                                                        │
│  • selectOption() executes:                                                 │
│    - onChange(uuid, label) → handleInlineValueChange(uuid)                  │
│    - inlineEditValue updated ✅                                             │
│  ↓                                                                           │
│  USER: Click outside field                                                  │
│  ───────────────────────────                                                │
│  • mousedown event fires                                                    │
│  • EntityInstanceFormContainer.handleClickOutside():                        │
│    - editingFieldRef.contains(outside)? NO                                  │
│    - outside.closest('[data-dropdown-portal]')? NO                          │
│    - handleInlineSave() executes ✅                                         │
│  • PATCH /api/v1/project/{id}                                               │
│  • TanStack Query cache updated                                             │
│  • UI updates immediately (optimistic)                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Pattern Checklist

### ✅ For Metadata Hooks
- [ ] Return type allows `undefined`: `Record<string, unknown> | undefined`
- [ ] No default values: `query.data?.viewType` (not `?? {}`)
- [ ] Consumer checks: `if (!viewType) return null;`
- [ ] Loading state exposed: `isLoading` property
- [ ] Stale time configured: 30 min for metadata

### ✅ For Dropdown Components
- [ ] Two refs: `containerRef` + `dropdownRef`
- [ ] Click-outside checks BOTH refs
- [ ] Event type: `mousedown` (not `click`)
- [ ] Portal rendering: `createPortal(menu, document.body)`
- [ ] Data attribute: `data-dropdown-portal=""`

### ✅ For Parent Components
- [ ] Portal detection: `target.closest('[data-dropdown-portal]')`
- [ ] Early return if portal detected
- [ ] Event type: `mousedown` listener
- [ ] Cleanup: `removeEventListener` in useEffect return

---

## Anti-Patterns

| Anti-Pattern | Consequence | Correct Pattern |
|--------------|-------------|-----------------|
| Return `{}` during load | False positives in empty checks | Return `undefined` |
| Check only parent ref | Portal clicks treated as "outside" | Check `[data-dropdown-portal]` |
| Use `click` event | Race with onClick handlers | Use `mousedown` |
| Hardcode component name | Breaks with new dropdowns | Use generic attribute |
| No event cleanup | Memory leaks | Return cleanup function |

---

## Related Patterns

1. **Format-at-Read Pattern**: Store raw data in cache, format during render
2. **Component Registry Pattern**: Metadata-driven component resolution
3. **Portal Pattern**: Render outside DOM hierarchy to avoid clipping
4. **Nullable Types Pattern**: Distinguish loading from empty/error states
5. **Event Delegation Pattern**: Single document-level listener

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0.0 | 2025-12-04 | Initial unified pattern documentation |

---

**Last Updated**: 2025-12-04
**Status**: Production Ready
**Applies To**: All entity field rendering across PMO platform

**Related Documentation**:
- [METADATA_LOADING_PATTERN.md](METADATA_LOADING_PATTERN.md) - Nullable types pattern
- [FIELD_RENDERER_ARCHITECTURE.md](FIELD_RENDERER_ARCHITECTURE.md) - Component registry
- [BadgeDropdownSelect.md](../ui_components/BadgeDropdownSelect.md) - Portal dropdown example
- [INLINE_EDIT_DROPDOWN_FIX.md](../INLINE_EDIT_DROPDOWN_FIX.md) - Fix implementation details
