# Entity Detail Page with Tab Navigation

## Overview

The EntityDetailPage now supports tab-based navigation with an **Overview tab** as the default, followed by child entity tabs (Tasks, Wiki, Artifacts, Forms, etc.). Each tab shows different content below the DynamicChildEntityTabs component.

## Complete Flow

### 1. User Clicks a Project

**URL**: `/project` → `/project/{projectId}`

**Component**: `EntityMainPage` → `EntityDetailPage`

### 2. EntityDetailPage Loads

```typescript
// Props received
entityType = "project"
id = {projectId} // from URL params

// Data loaded
- Project data via projectApi.get(projectId)
- Child entity tabs via useDynamicChildEntityTabs('project', projectId)
  - API: GET /api/v1/project/{projectId}/dynamic-child-entity-tabs
  - Returns: [{ id: 'task', label: 'Tasks', count: 5, path: '/project/{id}/task' }, ...]
```

### 3. Tab Structure

```
┌─────────────────────────────────────────────────────────┐
│  Header (Back button, Project Name, Edit button)       │
├─────────────────────────────────────────────────────────┤
│  DynamicChildEntityTabs                                 │
│  ┌──────────┬─────────┬──────────┬──────────┬────────┐ │
│  │ Overview │ Tasks(5)│ Wiki (3) │ Artifacts│ Forms  │ │
│  │  [ACTIVE]│         │          │   (8)    │  (2)   │ │
│  └──────────┴─────────┴──────────┴──────────┴────────┘ │
├─────────────────────────────────────────────────────────┤
│  Content Area (changes based on active tab)             │
│                                                          │
│  [OVERVIEW TAB - Default]                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Project Information                             │   │
│  │  - Name: Fall 2025 Landscaping Campaign         │   │
│  │  - Code: FALL-2025-LAND                         │   │
│  │  - Stage: Execution                             │   │
│  │  - Budget: $50,000                              │   │
│  │  - Start Date: 2025-09-01                       │   │
│  │  - End Date: 2025-11-30                         │   │
│  │  - Description: [editable field]                │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 4. When User Clicks "Tasks" Tab

**URL**: `/project/{projectId}` → `/project/{projectId}/task`

**Component Flow**:
```
EntityDetailPage (still rendered)
  ├─ Header (same)
  ├─ DynamicChildEntityTabs (Tasks tab now active)
  └─ Content Area: <Outlet /> renders EntityChildListPage
       ├─ parentType="project"
       ├─ childType="task"
       └─ Shows FilteredDataTable with:
           - entityType="task"
           - parentType="project"
           - parentId={projectId}
           - Filtered to show only tasks for this project
```

### 5. Tab Navigation Implementation

#### EntityDetailPage Logic:
```typescript
// Determine current tab from URL
const pathParts = location.pathname.split('/').filter(Boolean);
// /project/123 → ['project', '123']
// /project/123/task → ['project', '123', 'task']

const currentChildEntity = pathParts.length > 2 ? pathParts[2] : null;
const isOverviewTab = !currentChildEntity;

// Build tabs with Overview first
const allTabs = [
  {
    id: 'overview',
    label: 'Overview',
    path: '/project/{id}'
  },
  ...tabs  // Tasks, Wiki, Artifacts, Forms from API
];

// Render content based on active tab
{isOverviewTab ? (
  <div>Project Information Fields</div>
) : (
  <Outlet /> // Renders EntityChildListPage
)}
```

## URL Patterns

| URL | Active Tab | Content Shown |
|-----|-----------|---------------|
| `/project/{id}` | Overview | Project details fields |
| `/project/{id}/task` | Tasks | FilteredDataTable for tasks |
| `/project/{id}/wiki` | Wiki | FilteredDataTable for wiki |
| `/project/{id}/artifact` | Artifacts | FilteredDataTable for artifacts |
| `/project/{id}/form` | Forms | FilteredDataTable for forms |

## Component Responsibilities

### EntityDetailPage
- ✅ Loads entity data
- ✅ Fetches child entity tabs with counts
- ✅ Adds Overview tab as first tab
- ✅ Manages edit/save functionality
- ✅ Shows Overview content OR child entity content based on URL
- ✅ Passes control to EntityChildListPage via `<Outlet />` for child entities

### DynamicChildEntityTabs
- ✅ Displays all tabs (Overview + child entities)
- ✅ Shows counts for each tab
- ✅ Highlights active tab based on current URL
- ✅ Handles tab click navigation

### EntityChildListPage
- ✅ Rendered via `<Outlet />` when child tab is active
- ✅ Shows breadcrumb: Project › {ProjectName} › Tasks
- ✅ Displays FilteredDataTable with parent filter
- ✅ Supports view switching (table/kanban/grid)
- ✅ Has "Create" button scoped to parent entity

## Example for Business Entity

Same pattern works for all entities:

```
/biz/{bizId}                    → Overview tab (Business details)
/biz/{bizId}/project            → Projects tab (Projects for this business)
/biz/{bizId}/task               → Tasks tab
/biz/{bizId}/wiki               → Wiki tab
```

## Key Features

1. **Default Overview Tab**: Always shows entity details first
2. **Dynamic Tab Counts**: Fetched from API (e.g., "Tasks (5)")
3. **Filtered Child Lists**: Each tab shows only items for that parent
4. **Consistent UX**: Same pattern across all entities
5. **URL-Based State**: Tab state is in URL, shareable/bookmarkable
6. **Nested Routing**: Uses React Router's `<Outlet />` for child routes
7. **Breadcrumb Navigation**: Clear context in child entity pages

## Implementation Complete ✅

The EntityDetailPage now provides:
- Tab-based navigation with Overview as default
- Dynamic child entity tabs from API
- Filtered data tables for child entities
- Consistent UX across all entity types
- Full integration with DynamicChildEntityTabs
