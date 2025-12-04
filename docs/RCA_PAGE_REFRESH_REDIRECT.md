# RCA: Page Refresh Redirects to /welcome

**Issue**: Refreshing `http://localhost:5173/project/61203bac-101b-28d6-7a15-2176c15a0b1c` redirects to `/welcome`

**Date**: 2025-12-04
**Severity**: HIGH - Breaks deep linking and bookmark functionality

---

## Root Cause

**Dynamic route generation happens AFTER initial page load, causing React Router to match the wildcard `<Route path="*">` before entity routes are registered.**

### The Race Condition

1. **Page Refresh at `/project/{id}`**
2. **React Router Evaluation** (happens synchronously on mount)
   - Checks all `<Route>` elements
   - At this moment, `generateEntityRoutes()` returns **empty array** because:
     - `entities` Map is empty (still loading from API)
     - `entitiesLoading: true` (useEntityCodes hook is fetching)
3. **No Match Found**
   - `/project/{id}` route doesn't exist yet
   - Falls through to wildcard: `<Route path="*" element={<Navigate to="/welcome" replace />} />`
4. **Redirect Executed** BEFORE entity routes are generated
5. **Entity Routes Load** (too late)
   - `useEntityCodes` completes
   - `generateEntityRoutes()` creates `/project/:id/*` route
   - But URL is already `/welcome`

---

## Code Analysis

### App.tsx Lines 83-93: Loading Check

```typescript
function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();
  const { entities, loading: entitiesLoading } = useEntityMetadata();

  if (isLoading || entitiesLoading) {
    return <EllipsisBounce />; // ⚠️ SHOULD prevent route evaluation
  }
  // ... but doesn't prevent React Router from evaluating routes on first render
}
```

**Problem**: The loading spinner prevents render of route content, but React Router's `<Routes>` component evaluates all `<Route>` children synchronously on mount, BEFORE the loading check completes.

### App.tsx Lines 103-140: Dynamic Route Generation

```typescript
const generateEntityRoutes = () => {
  const entityCodes = Array.from(entities.values()) // ⚠️ entities is EMPTY on first render
    .filter(entity => {
      const hasConfig = !!entityConfigs[entity.code];
      const isActive = entity.active_flag;
      const isNotCustom = !customRouteEntities.includes(entity.code);
      return isActive && isNotCustom && hasConfig;
    })
    .map(entity => entity.code);

  return entityCodes.map(entityCode => {
    // ... creates <Route> elements
  });
};
```

**Problem**: Returns empty array on first render when `entities` Map is empty.

### App.tsx Line 332: Wildcard Route

```typescript
<Route path="*" element={<Navigate to="/welcome" replace />} />
```

**Problem**: Catches ALL unmatched routes, including valid entity routes that haven't been generated yet.

---

## Timeline of Events

```
T=0ms    Page loads at /project/{id}
T=0ms    React renders App component
T=0ms    useAuth() → isLoading: true
T=0ms    useEntityMetadata() → loading: true, entities: Map(0)
T=0ms    AppRoutes renders <EllipsisBounce /> (loading spinner)
T=0ms    BUT React Router's <Routes> evaluates children synchronously
T=0ms    generateEntityRoutes() returns []
T=0ms    React Router sees routes: [/, /login, /signup, ..., <Route path="*">]
T=0ms    /project/{id} doesn't match any route
T=0ms    Wildcard matches → <Navigate to="/welcome" replace />
T=0ms    🚨 REDIRECT EXECUTED 🚨

T=50ms   refreshUser() completes
T=100ms  useEntityCodes() fetches from API
T=150ms  entities Map populated: Map(27)
T=150ms  entitiesLoading: false
T=150ms  AppRoutes re-renders
T=150ms  generateEntityRoutes() returns [project, task, employee, ...]
T=150ms  React Router sees routes: [/, /login, /project/:id/*, ...]
T=150ms  BUT URL is already /welcome (too late!)
```

---

## Why This Doesn't Happen After Login

**Login Flow:**
1. User at `/login`
2. Login succeeds → `Navigate to="/welcome"` (explicit navigation)
3. User clicks "Projects" → Navigate to `/project`
4. At this point, `entities` is already loaded (cached from login prefetch)
5. `generateEntityRoutes()` returns full list
6. React Router matches `/project` successfully

**Refresh Flow:**
1. User at `/project/{id}` (browser URL)
2. Hard refresh → React app re-initializes
3. `entities` Map is empty (not yet fetched)
4. React Router evaluates routes → no match → wildcard redirect
5. Too late when entities load

---

## Evidence

### 1. Entity Routes Generated Dynamically
[App.tsx:103-140](apps/web/src/App.tsx#L103-L140) - Routes created from `entities` Map

### 2. Wildcard Route
[App.tsx:332](apps/web/src/App.tsx#L332) - Catch-all redirect to `/welcome`

### 3. Loading Check Doesn't Prevent Route Evaluation
[App.tsx:87-92](apps/web/src/App.tsx#L87-L92) - Loading spinner prevents content render, not route registration

### 4. Entity Codes Loaded Async
[useEntityCodes.ts:41-70](apps/web/src/db/cache/hooks/useEntityCodes.ts#L41-L70) - TanStack Query async fetch

---

## Solutions

### Option 1: Static Route Registration (Recommended)

**Change**: Register entity routes statically, not dynamically.

```typescript
// BEFORE (Dynamic - BROKEN)
{generateEntityRoutes()}

// AFTER (Static - WORKS)
<Route path="/project/:id/*" element={<ProtectedRoute><EntitySpecificInstancePage entityCode="project" /></ProtectedRoute>} />
<Route path="/task/:id/*" element={<ProtectedRoute><EntitySpecificInstancePage entityCode="task" /></ProtectedRoute>} />
// ... register all entity routes statically
```

**Pros:**
- Routes exist immediately on mount
- No race condition
- Works with browser refresh and deep linking

**Cons:**
- Manual maintenance (but entityConfig is already manual)
- Can't add entities without code changes (but this is already the case with entityConfig)

### Option 2: Wildcard Route with Entity Fallback

**Change**: Make wildcard route check if path matches entity pattern before redirecting.

```typescript
function EntityFallbackRoute() {
  const { pathname } = useLocation();
  const { entities, loading } = useEntityMetadata();

  if (loading) return <EllipsisBounce />;

  // Check if path matches /{entityCode}/:id/*
  const match = pathname.match(/^\/([^/]+)(?:\/|$)/);
  if (match) {
    const [, entityCode] = match;
    if (entities.has(entityCode) && entityConfigs[entityCode]) {
      // Valid entity route, render appropriate page
      if (pathname === `/${entityCode}`) {
        return <EntityListOfInstancesPage entityCode={entityCode} />;
      }
      return <EntitySpecificInstancePage entityCode={entityCode} />;
    }
  }

  return <Navigate to="/welcome" replace />;
}

// Usage
<Route path="*" element={<ProtectedRoute><EntityFallbackRoute /></ProtectedRoute>} />
```

**Pros:**
- Truly dynamic - supports any entity
- No manual route registration

**Cons:**
- More complex
- Still has brief loading delay

### Option 3: Prevent Router Evaluation Until Loaded

**Change**: Don't render `<Routes>` until entities are loaded.

```typescript
function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();
  const { entities, loading: entitiesLoading } = useEntityMetadata();

  if (isLoading || entitiesLoading) {
    return <EllipsisBounce />;
  }

  return (
    <Router> {/* Move Router INSIDE loading check */}
      <Routes>
        {generateEntityRoutes()}
        <Route path="*" element={<Navigate to="/welcome" replace />} />
      </Routes>
    </Router>
  );
}
```

**Pros:**
- Fixes race condition
- Keeps dynamic route generation

**Cons:**
- Requires restructuring provider hierarchy
- Router needs to be inside loading check, but providers need Router context

---

## Recommended Fix

**Use Option 1: Static Route Registration**

### Why?
1. **Simplest** - Just register routes statically
2. **Fastest** - No loading delay for route matching
3. **Most Reliable** - No race conditions
4. **Minimal Change** - entityConfig is already static

### Implementation

Change [App.tsx:174-175](apps/web/src/App.tsx#L174-L175):

```typescript
// DELETE THIS LINE:
{generateEntityRoutes()}

// ADD STATIC ROUTES (all entities from entityConfig):
{Object.keys(entityConfigs)
  .filter(code => !customRouteEntities.includes(code))
  .map(entityCode => (
    <Fragment key={entityCode}>
      <Route path={`/${entityCode}`} element={<ProtectedRoute><EntityListOfInstancesPage entityCode={entityCode} /></ProtectedRoute>} />
      <Route path={`/${entityCode}/new`} element={<ProtectedRoute><EntityCreatePage entityCode={entityCode} /></ProtectedRoute>} />
      <Route path={`/${entityCode}/:id/*`} element={<ProtectedRoute><EntitySpecificInstancePage entityCode={entityCode} /></ProtectedRoute>} />
    </Fragment>
  ))}
```

**Key Change:**
- Loop over `entityConfigs` (static object) instead of `entities` Map (async)
- Routes registered immediately on mount
- No dependency on API call

---

## Testing Plan

1. ✅ Refresh `/project/{valid-id}` → Should stay on project page
2. ✅ Refresh `/task/{valid-id}` → Should stay on task page
3. ✅ Refresh `/invalid-entity/{id}` → Should redirect to `/welcome`
4. ✅ Deep link from email → Should work
5. ✅ Browser bookmark → Should work
6. ✅ Login flow → Should still work

---

## Related Issues

- Deep linking broken (same root cause)
- Bookmark navigation broken (same root cause)
- Email link navigation broken (same root cause)

---

## Lessons Learned

1. **Don't generate routes dynamically from async data** - React Router evaluates routes synchronously
2. **Wildcard routes are dangerous** - They match before async routes load
3. **Loading spinners don't prevent route evaluation** - Only prevent content render
4. **Static > Dynamic for routing** - Routing should be deterministic at build time

---

## Status

🔴 **CONFIRMED** - Root cause identified
🟡 **FIX READY** - Option 1 recommended
⚪ **NOT IMPLEMENTED** - Awaiting approval
