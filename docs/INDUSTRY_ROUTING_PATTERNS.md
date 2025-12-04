# Industry Patterns: Dynamic Routing in SPAs

**Context**: Analyzing industry-standard patterns for handling dynamic routes, deep linking, and page refresh in Single Page Applications.

**Date**: 2025-12-04

---

## The Core Problem

Single Page Applications (SPAs) hook into browser navigation to prevent page reloads. However, **refreshing the current URL or using bookmarks/deep links can revert to the initial state** if routing is implemented naively. [(Source)](https://neugierig.org/software/blog/2014/02/single-page-app-links.html)

### Our Specific Issue
- Routes generated dynamically from async API data
- Wildcard catch-all route matches before async routes load
- Page refresh → routes not registered yet → wildcard redirect

---

## Industry Consensus: Static vs Dynamic Routing

### Static Routing (Industry Standard)

**Definition**: Routes declared as part of app initialization **before** rendering. [(React Router Philosophy)](https://v5.reactrouter.com/core/guides/philosophy/dynamic-routing)

**Characteristics**:
- ✅ Routes fixed and do not change
- ✅ Can inspect and match routes before rendering
- ✅ Works server-side and client-side
- ✅ Supports deep linking and bookmarks out-of-the-box
- ✅ No race conditions

**When to Use**: **ALWAYS** for application structure routes (navigation, pages, resource URLs).

**Example**:
```jsx
// Static - routes exist at initialization
<Routes>
  <Route path="/projects" element={<ProjectList />} />
  <Route path="/projects/:id" element={<ProjectDetail />} />
  <Route path="/tasks/:id" element={<TaskDetail />} />
  <Route path="*" element={<NotFound />} />
</Routes>
```

### Dynamic Routing (React Router Pattern)

**Definition**: Routing that takes place **as app is rendering**, not in external configuration. [(React Router v5 Docs)](https://v5.reactrouter.com/core/guides/philosophy/dynamic-routing)

**Characteristics**:
- ⚠️ Routes created during render lifecycle
- ⚠️ Flexible but can cause timing issues
- ⚠️ Cannot guarantee routes exist at URL evaluation time
- ✅ Useful for nested/conditional routing within pages

**When to Use**: For **conditional** routing INSIDE pages (tabs, modals, wizards), NOT for top-level navigation.

**Example**:
```jsx
// Dynamic - routes created conditionally INSIDE a page
function ProjectDetail() {
  const { permissions } = useAuth();

  return (
    <Routes>
      <Route path="overview" element={<Overview />} />
      {permissions.canEdit && <Route path="edit" element={<Edit />} />}
      {permissions.canDelete && <Route path="delete" element={<Delete />} />}
    </Routes>
  );
}
```

---

## Route Matching Priority (TanStack/React Router)

Routes automatically sorted by specificity: [(TanStack Router Docs)](https://tanstack.com/router/latest/docs/framework/react/routing/route-matching)

1. **Index Routes** (`/`)
2. **Static Routes** (most specific to least specific) → `/settings`
3. **Dynamic Routes** (longest to shortest) → `/:entity/:id`
4. **Wildcard/Splat Routes** → `/*`

**Critical Rule**: Static routes like `/settings` MUST be defined before dynamic routes like `/:object/:id` to ensure proper matching.

---

## Modern Patterns (2025)

### 1. React Router v6.4+ Data APIs

**Industry Standard**: Use **loaders** to fetch data BEFORE route renders. [(React Router Routing Docs)](https://reactrouter.com/start/framework/routing)

```jsx
const router = createBrowserRouter([
  {
    path: "/project/:id",
    loader: async ({ params }) => {
      return fetch(`/api/v1/project/${params.id}`);
    },
    element: <ProjectDetail />,
  },
]);
```

**Benefits**:
- ✅ Routes are static (defined at initialization)
- ✅ Data is async (fetched before render)
- ✅ No race conditions
- ✅ Built-in loading states
- ✅ Automatic race condition cancellation

**Drawbacks**:
- ⚠️ Requires `createBrowserRouter` (not `<BrowserRouter>`)
- ⚠️ Different architecture from component-based routing

### 2. TanStack Router (2025 Emerging Standard)

**Features**: [(TanStack Router 2025 Guide)](https://dev.to/rigalpatel001/tanstack-router-the-future-of-react-routing-in-2025-421p)
- ✅ Built-in TanStack Query integration
- ✅ Full TypeScript type safety
- ✅ File-based routing (like Next.js)
- ✅ Code splitting by route
- ✅ Built-in caching and prefetching

```typescript
const route = createRoute({
  path: '/project/$id',
  loader: async ({ params }) => {
    return queryClient.ensureQueryData({
      queryKey: ['project', params.id],
      queryFn: () => fetchProject(params.id),
    });
  },
});
```

### 3. Next.js Pattern (File-System Based)

**Gold Standard**: File system defines routes (static at build time). [(Next.js Dynamic Routes)](https://nextjs.org/docs/pages/building-your-application/routing/dynamic-routes)

```
pages/
  index.js          → /
  project/
    index.js        → /project
    [id].js         → /project/:id
  [...slug].js      → catch-all route
```

**Benefits**:
- ✅ Routes known at build time (static)
- ✅ Server-side rendering support
- ✅ Automatic code splitting
- ✅ Type-safe with TypeScript

---

## Deep Linking & Refresh Best Practices

### Industry Standard Requirements [(Stanford CS142)](https://web.stanford.edu/class/cs142/lectures/SPA.pdf)

1. **URLs Must Be Shareable**: Every view must have a unique URL that can be bookmarked/shared
2. **Refresh Must Work**: App must render any view from scratch (fresh browser load)
3. **Back Button Must Work**: History API must preserve navigation state
4. **Server Configuration**: Server must return index.html for ALL routes (not 404)

### Pattern: Static Routes + Dynamic Data

```jsx
// ✅ CORRECT: Routes are static, data is dynamic
<Routes>
  {/* Static route definitions */}
  <Route path="/project/:id" element={<ProjectDetail />} />
</Routes>

function ProjectDetail() {
  const { id } = useParams();
  const { data } = useQuery(['project', id], () => fetchProject(id));
  // ... render with data
}
```

```jsx
// ❌ WRONG: Routes are dynamic (generated from API data)
function App() {
  const { entities } = useEntityTypes(); // async API call

  return (
    <Routes>
      {entities.map(entity => (
        <Route path={`/${entity.code}/:id`} element={<Detail />} />
      ))}
      <Route path="*" element={<NotFound />} /> {/* Matches before entities load! */}
    </Routes>
  );
}
```

---

## Solution: Static Route Generation from Static Config

### Industry Pattern: Configuration-Driven Static Routes

Most production apps use a **static configuration object** to generate routes at initialization.

```jsx
// ✅ Static configuration (entityConfig.ts)
const entityConfigs = {
  project: { label: 'Project', icon: 'folder' },
  task: { label: 'Task', icon: 'check' },
  employee: { label: 'Employee', icon: 'user' },
};

// ✅ Generate routes from static config (NOT from API data)
function App() {
  return (
    <Routes>
      {Object.keys(entityConfigs).map(entityCode => (
        <Fragment key={entityCode}>
          <Route
            path={`/${entityCode}`}
            element={<EntityList entityCode={entityCode} />}
          />
          <Route
            path={`/${entityCode}/:id`}
            element={<EntityDetail entityCode={entityCode} />}
          />
        </Fragment>
      ))}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
```

**Why This Works**:
1. Routes generated from **static object** (available at initialization)
2. No dependency on async API calls
3. Wildcard route only matches truly invalid routes
4. Deep linking and refresh work immediately
5. Entity **metadata** (icons, labels, permissions) fetched separately and cached

---

## Anti-Patterns to Avoid

### ❌ 1. Dynamic Route Generation from API Data
```jsx
// WRONG: Routes depend on async data
const { entities } = useQuery('entities', fetchEntities);
return <Routes>{entities.map(/* ... */)}</Routes>;
```

### ❌ 2. Wildcard Route Before Dynamic Routes
```jsx
// WRONG: Order matters!
<Routes>
  <Route path="*" element={<NotFound />} /> {/* Catches everything! */}
  {dynamicRoutes}
</Routes>
```

### ❌ 3. Assuming Routes Exist Before Loaded
```jsx
// WRONG: Navigating before routes registered
useEffect(() => {
  if (isAuthenticated) {
    navigate('/project/123'); // Route might not exist yet!
  }
}, [isAuthenticated]);
```

### ❌ 4. Conditional Top-Level Routes
```jsx
// WRONG: Conditional routing at app level
{isAdmin && <Route path="/admin" element={<Admin />} />}
// Use route guards INSIDE components instead
```

---

## Recommended Solution for PMO Platform

### Current Architecture (BROKEN)
```jsx
// Routes generated from async API data
const { entities, loading } = useEntityMetadata(); // API call
const generateEntityRoutes = () => {
  return Array.from(entities.values()).map(/* ... */); // Empty initially!
};
```

### Fixed Architecture (STATIC)
```jsx
// Routes generated from static entityConfigs
import { entityConfigs } from './lib/entityConfig';

const generateEntityRoutes = () => {
  return Object.keys(entityConfigs)
    .filter(code => !customRouteEntities.includes(code))
    .map(entityCode => (
      <Fragment key={entityCode}>
        <Route path={`/${entityCode}`} element={<EntityList />} />
        <Route path={`/${entityCode}/:id/*`} element={<EntityDetail />} />
      </Fragment>
    ));
};
```

**Changes**:
1. ✅ Loop over `entityConfigs` (static object) instead of `entities` Map (async)
2. ✅ Routes exist immediately at app initialization
3. ✅ No race condition with wildcard route
4. ✅ Deep linking and refresh work
5. ✅ Entity metadata (icons, permissions) still fetched and cached separately

---

## Implementation Checklist

- [ ] Replace `Array.from(entities.values())` with `Object.keys(entityConfigs)`
- [ ] Remove dependency on `useEntityMetadata()` for route generation
- [ ] Keep `useEntityMetadata()` for entity metadata (icons, labels, permissions)
- [ ] Verify wildcard route is LAST in route list
- [ ] Test: Refresh `/project/{id}` → stays on project page
- [ ] Test: Bookmark `/task/{id}` → works on new browser tab
- [ ] Test: Email deep link → works
- [ ] Test: Invalid route `/fake-entity/{id}` → redirects to 404/welcome

---

## Industry Examples

### Vercel Dashboard
- File-based routing (Next.js)
- All routes known at build time
- Metadata fetched client-side

### GitHub
- Static route structure
- Dynamic data loading
- Works with browser refresh

### Linear
- TanStack Router + TanStack Query
- Type-safe routes
- Built-in caching

### Notion
- Static routes with dynamic content
- Client-side routing with server-side fallback
- Deep linking works perfectly

---

## Conclusion

**Industry Standard**: **Static route definitions with dynamic data loading.**

- ✅ Routes defined at initialization (static)
- ✅ Data fetched on demand (dynamic)
- ✅ Supports deep linking, bookmarks, refresh
- ✅ No race conditions
- ✅ Works server-side and client-side

**For PMO Platform**: Generate routes from `entityConfigs` (static), not `entities` Map (async).

---

## Sources

- [React Router Dynamic Routing Philosophy](https://v5.reactrouter.com/core/guides/philosophy/dynamic-routing)
- [React Router v6 Routing](https://reactrouter.com/start/framework/routing)
- [TanStack Router 2025 Guide](https://dev.to/rigalpatel001/tanstack-router-the-future-of-react-routing-in-2025-421p)
- [TanStack Router Route Matching](https://tanstack.com/router/latest/docs/framework/react/routing/route-matching)
- [Next.js Dynamic Routes](https://nextjs.org/docs/pages/building-your-application/routing/dynamic-routes)
- [Stanford CS142 - Single Page Apps](https://web.stanford.edu/class/cs142/lectures/SPA.pdf)
- [SPA Deep Linking Patterns](https://neugierig.org/software/blog/2014/02/single-page-app-links.html)
- [React Router Data APIs Guide](https://dev.to/vishwark/react-router-data-apis-the-complete-beginner-friendly-guide-2025-edition-46cn)
- [Stack Overflow: Dynamic vs Static Routing](https://stackoverflow.com/questions/52957395/dynamic-routing-vs-static-routing-in-react)
