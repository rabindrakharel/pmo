# PMO System UI User Guide

## Overview
This guide covers the comprehensive navigation system and filtered data display functionality implemented in the PMO (Project Management Office) system. The system provides a hierarchical entity relationship structure with filtered data tables across all parent-child entity relationships.

## Navigation Architecture

### URL Structure Pattern
The system follows a consistent URL pattern for all entity relationships:
```
/{parentEntity}/{parentId}/{actionEntity}
```

Examples:
- `/project/123/tasks` - Tasks within project 123
- `/biz/456/wiki` - Wiki entries for business unit 456  
- `/org/789/worksite` - Worksites managed by organization 789
- `/worksite/101/forms` - Forms related to worksite 101

### HeaderTabNavigation Component
Each parent entity detail page displays tabs for related action entities:

**Business Units** (`/biz/{id}`):
- Wiki - Documentation and knowledge base
- Forms - Data collection forms
- Tasks - Business unit tasks
- Projects - Projects under this business unit
- Artifacts - Related documents and files

**Organizations** (`/org/{id}`):
- Worksites - Facilities managed by organization
- Employees - Staff assigned to organization

**Projects** (`/project/{id}`):
- Wiki - Project documentation
- Forms - Project-specific forms
- Tasks - Project tasks (Grid and Kanban views)
- Artifacts - Project deliverables and files

**Worksites** (`/worksite/{id}`):
- Tasks - Facility and operational tasks
- Forms - Safety reports and operational forms

**Tasks** (`/task/{id}`):
- Forms - Task-specific documentation
- Artifacts - Task deliverables and outputs

## FilteredDataTable Implementation

### Core Component: FilteredDataTable.tsx
Location: `/home/rabin/projects/pmo/apps/web/src/components/FilteredDataTable.tsx`

This reusable component extends the existing MetaDataTable functionality with parent-child filtering capabilities.

#### Key Features:
1. **Dynamic API Integration**: Automatically constructs filtered endpoints
   - Standard: `/api/v1/{entityType}` 
   - Filtered: `/api/v1/{parentEntityType}/{parentEntityId}/{entityType}`

2. **Configuration-Driven**: Uses existing entity configuration system
   - Columns, sorting, filtering based on entity config
   - Row actions and rendering rules preserved
   - Pagination and search functionality maintained

3. **Navigation Handling**: 
   - Default navigation to entity detail pages
   - Customizable via `onRowClick` prop
   - Follows established routing patterns

4. **Error States & Loading**: 
   - Configuration loading indicators
   - API error handling with retry options
   - Empty state displays

#### Props Interface:
```typescript
interface FilteredDataTableProps {
  entityType: string;           // The type of entities to display
  parentEntityType?: string;    // Parent entity type for filtering
  parentEntityId?: string;      // Parent entity ID for filtering  
  onRowClick?: (record: any) => void; // Custom row click handler
}
```

#### Usage Examples:
```tsx
// Show all wiki entries for a business unit
<FilteredDataTable
  entityType="wiki"
  parentEntityType="biz"
  parentEntityId={bizId}
/>

// Show tasks within a specific project
<FilteredDataTable
  entityType="task"
  parentEntityType="project"
  parentEntityId={projectId}
/>
```

## Page Implementation Details

### Business Entity Pages

#### BusinessWikiPage (`/biz/{id}/wiki`)
- **Purpose**: Display wiki entries specific to a business unit
- **API Endpoint**: `/api/v1/biz/{bizId}/wiki`
- **Features**: Create new wiki entries, search, filter, paginate
- **Navigation**: Click wiki entry → `/wiki/{id}` detail page

#### BusinessFormsPage (`/biz/{id}/forms`)
- **Purpose**: Data collection forms for business operations
- **API Endpoint**: `/api/v1/biz/{bizId}/form`
- **Features**: Form creation, completion tracking, filtering
- **Navigation**: Click form → `/forms/{id}` detail page

#### BusinessTasksPage (`/biz/{id}/task`)
- **Purpose**: Tasks assigned to or originating from business unit
- **API Endpoint**: `/api/v1/biz/{bizId}/task`
- **Features**: Task management, assignment, status tracking
- **Navigation**: Click task → `/task/{id}` detail page

#### BusinessProjectsPage (`/biz/{id}/project`)
- **Purpose**: Projects owned by or related to business unit
- **API Endpoint**: `/api/v1/biz/{bizId}/project`
- **Features**: Project overview, status, resource allocation
- **Navigation**: Click project → `/project/{id}` detail page

#### BusinessArtifactsPage (`/biz/{id}/artifact`)
- **Purpose**: Documents and files related to business unit
- **API Endpoint**: `/api/v1/biz/{bizId}/artifact`
- **Features**: File management, versioning, access control
- **Navigation**: Click artifact → artifact detail/preview

### Organization Entity Pages

#### OrgWorksitesPage (`/org/{id}/worksite`)
- **Purpose**: Physical locations managed by organization
- **API Endpoint**: `/api/v1/org/{orgId}/worksite`
- **Features**: Facility management, location tracking
- **Navigation**: Click worksite → `/worksite/{id}` detail page

#### OrgEmployeesPage (`/org/{id}/employee`)
- **Purpose**: Staff members assigned to organization
- **API Endpoint**: `/api/v1/org/{orgId}/employee`
- **Features**: Employee management, role assignments
- **Navigation**: Click employee → `/employee/{id}` detail page

### Project Entity Pages

#### ProjectWikiPage (`/project/{id}/wiki`)
- **Purpose**: Project documentation and knowledge sharing
- **API Endpoint**: `/api/v1/project/{projectId}/wiki`
- **Features**: Documentation management, collaborative editing
- **Navigation**: Click wiki entry → `/wiki/{id}` detail page

#### ProjectFormsPage (`/project/{id}/forms`)
- **Purpose**: Project-specific data collection and reporting
- **API Endpoint**: `/api/v1/project/{projectId}/form`
- **Features**: Form templates, submission tracking
- **Navigation**: Click form → `/forms/{id}` detail page

#### ProjectTasksPage (`/project/{id}/tasks`)
- **Purpose**: Project task management with multiple views
- **API Endpoint**: `/api/v1/project/{projectId}/task`
- **Features**: 
  - Grid View: FilteredDataTable with full task details
  - Kanban View: Visual board with drag-and-drop (preserved existing functionality)
  - Filtering by status, assignee, priority
  - Scope-based filtering
- **Navigation**: Click task → `/task/{id}` detail page

### Worksite Entity Pages

#### WorksiteTasksPage (`/worksite/{id}/task`)
- **Purpose**: Operational and maintenance tasks for facilities
- **API Endpoint**: `/api/v1/worksite/{worksiteId}/task`
- **Features**: Maintenance scheduling, safety tasks, operations
- **Navigation**: Click task → `/task/{id}` detail page

#### WorksiteFormsPage (`/worksite/{id}/forms`)
- **Purpose**: Safety reports, maintenance logs, operational forms
- **API Endpoint**: `/api/v1/worksite/{worksiteId}/form`
- **Features**: Compliance tracking, incident reporting
- **Navigation**: Click form → `/forms/{id}` detail page

### Task Entity Pages

#### TaskFormsPage (`/task/{id}/forms`)
- **Purpose**: Task-specific documentation and data collection
- **API Endpoint**: `/api/v1/task/{taskId}/form`
- **Features**: Status reports, completion forms, documentation
- **Navigation**: Click form → `/forms/{id}` detail page

#### TaskArtifactsPage (`/task/{id}/artifact`)
- **Purpose**: Deliverables and outputs produced by the task
- **API Endpoint**: `/api/v1/task/{taskId}/artifact`
- **Features**: Output tracking, deliverable management
- **Navigation**: Click artifact → artifact detail/preview

## Technical Implementation

### Component Architecture
```
Layout
├── HeaderTabNavigation
│   ├── Tab Navigation (Wiki, Forms, Tasks, etc.)
│   └── Parent Entity Context
├── ActionBar
│   ├── Create Button (RBAC-controlled)
│   ├── Scope Filters
│   └── Additional Actions
└── FilteredDataTable
    ├── Configuration Loading
    ├── Data Fetching (Filtered API)
    ├── Column Rendering
    ├── Row Actions
    ├── Pagination
    └── Search/Filter
```

### API Integration Pattern
1. **Entity Configuration**: Loaded via `configService.getEntityConfig(entityType)`
2. **Data Fetching**: Dynamic endpoint construction based on parent context
3. **Authentication**: Bearer token from localStorage
4. **Error Handling**: Graceful degradation with retry mechanisms
5. **Real-time Updates**: Automatic refresh after CRUD operations

### State Management
Each page maintains:
- **Entity Configuration**: Field definitions, UI behavior, API endpoints
- **Parent Entity Data**: Context information for header display
- **Filtered Data**: Results from parent-child relationship queries
- **UI State**: Loading states, error conditions, pagination

### Routing Integration
All pages integrate with React Router for:
- **URL Parameters**: Extract parent entity IDs
- **Navigation**: Programmatic routing to detail pages
- **State Preservation**: Maintain filter and page state during navigation

## User Experience Features

### Consistent Interface
- **Header Structure**: Every action page shows parent context and available tabs
- **Action Buttons**: Consistent create/edit/delete operations with RBAC
- **Loading States**: Uniform loading indicators and error messages
- **Empty States**: Helpful messages when no data is available

### Data Visualization
- **Configurable Columns**: Entity-specific field display and formatting
- **Interactive Elements**: Sortable columns, filterable data, row actions
- **Responsive Design**: Adaptive layouts for different screen sizes
- **Bulk Operations**: Multi-select capabilities where appropriate

### Navigation Flow
```
List Page → Detail Page → Action Page → Filtered Results
     ↓         ↓             ↓              ↓
  /project → /project/123 → /project/123/tasks → Task DataTable
```

## Development Considerations

### Extensibility
- **New Entity Types**: Add configuration, create action pages
- **Custom Views**: Override FilteredDataTable with specialized components
- **Additional Filters**: Extend FilteredDataTable with custom filtering
- **Integration Points**: Hook into existing RBAC, scoping, and audit systems

### Performance
- **Lazy Loading**: Data fetched only when tabs are accessed
- **Caching**: Configuration and reference data cached appropriately  
- **Pagination**: Large datasets handled with server-side pagination
- **Optimistic Updates**: Immediate UI updates with background synchronization

### Maintenance
- **Configuration-Driven**: UI behavior controlled via entity configuration
- **Reusable Components**: Single FilteredDataTable serves all filtered scenarios
- **TypeScript Safety**: Full type checking and IntelliSense support
- **Error Boundaries**: Graceful handling of component failures

## Future Enhancements

### Planned Features
- **Advanced Filtering**: Complex filter builder with save/load capabilities
- **Export Functions**: CSV, PDF, Excel export from filtered views
- **Real-time Updates**: WebSocket integration for live data updates
- **Custom Dashboards**: User-configurable views and widgets
- **Mobile Optimization**: Touch-friendly interfaces for mobile devices

### Integration Opportunities
- **Workflow Engine**: Connect filtered views to approval processes
- **Reporting System**: Generate reports from filtered datasets
- **Analytics**: Usage tracking and performance insights
- **API Extensions**: GraphQL support for complex queries
- **Third-party Tools**: Integration with external project management tools

## Troubleshooting

### Common Issues
1. **Empty Tables**: Check API endpoints and parent entity IDs
2. **Loading Loops**: Verify entity configuration availability
3. **Navigation Errors**: Ensure route definitions match URL patterns
4. **Permission Issues**: Check RBAC settings for entity access

### Debug Information
- **Browser Console**: API request/response logging
- **Network Tab**: Monitor API calls and response times
- **Component Props**: Verify parent entity parameters
- **Configuration**: Check entity config loading and field definitions

This comprehensive system provides a scalable, maintainable foundation for displaying hierarchical entity relationships with filtered data tables throughout the PMO application.