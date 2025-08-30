# Web Frontend

This is the Next.js web frontend for the PMO application.

## Key Features

- Next.js 14 with App Router
- TypeScript
- Tailwind CSS
- React Hook Form with Zod validation
- TanStack Query for API state management
- Role-based access control (RBAC)
- **Universal Schema-Driven Components** - Dynamic UI generation from database metadata
- **Schema Inference System** - Automatic form and component generation

## Architecture

### Universal Schema System

The frontend now includes a comprehensive schema-driven architecture with three key components:

#### 1. Schema-Driven Components (`/lib/schema-driven-components.tsx`)
- **Dynamic Table Generation**: Automatically generates tables with filtering, sorting, and pagination
- **Smart Form Components**: Auto-generates forms based on schema metadata with proper validation
- **Responsive Layouts**: Adapts to different screen sizes and data types
- **Permission-Aware**: Respects RBAC permissions for field visibility

#### 2. Schema Inference (`/lib/schema-inference.ts`)
- **Metadata Processing**: Extracts and processes database column metadata
- **Type Safety**: Provides TypeScript-safe schema inference
- **Field Mapping**: Maps database columns to appropriate UI components
- **Validation Rules**: Automatically applies validation based on database constraints

#### 3. Universal Schema Components (`/lib/universal-schema-components.tsx`)
- **Unified API**: Single interface for all schema-driven functionality
- **Component Registry**: Manages reusable schema-aware components
- **Theme Integration**: Seamless integration with Tailwind CSS
- **Accessibility**: Built-in ARIA support and keyboard navigation

### API Integration (Updated)

The APIs have been completely refactored to match the database schema exactly:

#### Updated Endpoints:
- `/api/v1/employee` (formerly `/api/v1/emp`) - Matches `d_employee` table structure
- `/api/v1/client` - Updated to match `d_client` table with hierarchy support
- `/api/v1/project` - New implementation matching `ops_project_head` table
- **Coming Soon**: `/api/v1/task` - Will match `ops_task_head` and `ops_task_records` tables

#### Key Improvements:
- **Schema Consistency**: APIs now exactly match database column names and structures
- **Proper Field Mapping**: All database fields are correctly exposed through APIs
- **Universal Metadata**: API responses include metadata for dynamic UI generation
- **Enhanced Filtering**: Support for all database fields in search and filter operations

### RBAC Integration

The frontend integrates with the backend RBAC system to provide:

- Route-level protection based on user permissions  
- Dynamic UI components based on available scopes
- Automatic redirect to appropriate landing pages
- **Field-level permissions** - Hide/show fields based on user access levels

### Schema-Driven Development Workflow

1. **Database First**: Schema changes drive the entire application
2. **Automatic Inference**: UI components automatically adapt to schema changes
3. **Type Safety**: Full TypeScript support throughout the schema system
4. **Developer Productivity**: Minimal manual UI code for CRUD operations

## Development

```bash
npm run dev
```

## Environment Variables

Required environment variables:

- `NEXT_PUBLIC_API_URL` - Backend API URL

## Universal Schema Usage Examples

### Auto-generating a Data Table:
```tsx
import { UniversalDataTable } from '@/lib/universal-schema-components';

<UniversalDataTable
  endpoint="/api/v1/employee"
  tableName="d_employee"
  columns={['name', 'email', 'status', 'hire_date']}
  searchable={true}
  filterable={true}
/>
```

### Auto-generating a Form:
```tsx
import { UniversalForm } from '@/lib/universal-schema-components';

<UniversalForm
  tableName="d_employee" 
  mode="create"
  onSubmit={handleSubmit}
  fields={['name', 'email', 'phone', 'hire_date', 'status']}
/>
```

### Schema-Driven Field Components:
```tsx
import { SchemaField } from '@/lib/schema-driven-components';

<SchemaField
  tableName="d_employee"
  columnName="employment_type"
  value={value}
  onChange={onChange}
/>
```

## NEW: Advanced Component Library

### Enhanced Data Table with Advanced Features:
```tsx
import { EnhancedDataTable } from '@/lib/enhanced-data-table';

<EnhancedDataTable
  tableName="app.ops_project_head"
  data={projects}
  loading={loading}
  permissions={permissions}
  searchable={true}
  sortable={true}
  filterable={true}
  selectable={true}
  paginated={true}
  exportable={true}
  refreshable={true}
  defaultViewMode="table" // or "grid"
  onAction={handleAction}
  onBulkAction={handleBulkAction}
  onRefresh={handleRefresh}
  onExport={handleExport}
/>
```

### Project Management Page with Multiple Views:
```tsx
import { ProjectListPage } from '@/components/projects/project-list-page';

<ProjectListPage
  projects={projectData}
  loading={loading}
  permissions={userPermissions}
  defaultView="kanban" // "table", "grid", or "kanban"
  enableKanban={true}
  showMetrics={true}
  onProjectAction={handleProjectAction}
  onBulkAction={handleBulkAction}
  onRefresh={handleRefresh}
  onExport={handleExport}
/>
```

### JIRA-like Task Management:
```tsx
import { TaskManagement } from '@/components/tasks/task-management';

<TaskManagement
  task={currentTask}
  loading={loading}
  caseNotes={taskCaseNotes}
  timeEntries={taskTimeEntries}
  permissions={userPermissions}
  showTimeTracking={true}
  showAttachments={true}
  showCaseNotes={true}
  enableRichText={true}
  onTaskUpdate={handleTaskUpdate}
  onCaseNoteAdd={handleCaseNoteAdd}
  onTimeEntryAdd={handleTimeEntryAdd}
  onAttachmentUpload={handleAttachmentUpload}
  onFormSubmit={handleFormSubmit}
/>
```

## Data Model Integration

The frontend is now fully synchronized with the backend datamodel:

### Core Tables Supported:
- **d_employee**: Employee management with full CRUD operations
- **d_client**: Client management with hierarchical structure support  
- **ops_project_head**: Project management with comprehensive project lifecycle tracking

### Schema-Driven Features:
- **Automatic Form Generation**: Forms adapt to database schema changes
- **Dynamic Validation**: Client-side validation mirrors database constraints
- **Type-Safe APIs**: Full TypeScript integration with database types
- **Responsive UI**: Components automatically adjust based on field metadata

## Component Features

### EnhancedDataTable Features:
- **Multi-View Support**: Table view and responsive grid view
- **Advanced Sorting**: Multi-column sorting with visual indicators
- **Smart Search**: Searches across all searchable columns automatically
- **Dynamic Filtering**: Add/remove filters with multiple operators (contains, equals, greater than, etc.)
- **Bulk Operations**: Select multiple rows for bulk actions
- **Export Support**: CSV, JSON, and Excel export capabilities  
- **Pagination**: Configurable page sizes with navigation controls
- **Column Management**: Show/hide columns with settings panel
- **Permission-Aware**: Respects user permissions for all actions
- **Real-time Updates**: Integrates with refresh and loading states

### ProjectListPage Features:
- **Triple View Modes**: Table, Grid, and Kanban board views
- **Project Metrics**: Summary cards showing total, active, at-risk, and completion rates
- **Status-based Kanban**: Drag-and-drop project status management
- **Advanced Filtering**: Filter by status, type, and priority with search
- **Project Details Modal**: Full project information in a modal dialog
- **Team Visualization**: Avatar displays for project team members
- **Budget Tracking**: Financial information with currency formatting
- **Progress Indicators**: Visual progress bars for time and completion
- **JIRA-inspired UX**: Modern, clean interface following Asana/Notion patterns

### TaskManagement Features:
- **JIRA-like Interface**: Familiar task management UX with modern design
- **Case Notes System**: Full activity log with different note types
- **Time Tracking**: Built-in timer with time entry logging
- **File Attachments**: Drag-and-drop file upload with preview
- **Progress Management**: Completion percentage tracking with acceptance criteria
- **Rich Task Details**: Comprehensive task information sidebar
- **Status/Stage Workflow**: Visual status progression with colored badges  
- **Collaboration Tools**: Comments, mentions, and team coordination
- **Form Integration**: Custom form data submission within tasks
- **Permission Controls**: Edit restrictions based on user permissions

## File Structure

```
apps/web/src/
├── lib/
│   ├── schema-driven-components.tsx    # Dynamic component generators
│   ├── schema-inference.ts             # Schema metadata processing
│   ├── universal-schema-components.tsx # Unified schema component API
│   └── enhanced-data-table.tsx         # Advanced data table component
├── components/
│   ├── projects/
│   │   └── project-list-page.tsx       # Project management page
│   └── tasks/
│       └── task-management.tsx         # Task management component  
├── app/                                # Next.js app router pages
├── components/ui/                      # Base UI components
└── README.md                          # This file
```

## Integration Guide

### Using with Real APIs:
```tsx
// Example: Connecting to your PMO API
const ProjectsPage = () => {
  const { data: projects, loading, error } = useProjects();
  const { permissions } = useAuth();

  return (
    <ProjectListPage
      projects={projects}
      loading={loading}
      error={error}
      permissions={permissions}
      onProjectAction={handleProjectAction}
      onRefresh={() => refetch()}
    />
  );
};
```

### Customization Examples:
```tsx
// Custom toolbar actions
<EnhancedDataTable
  customActions={
    <Button onClick={handleCustomAction}>
      <Star className="h-4 w-4 mr-2" />
      Custom Action
    </Button>
  }
  customFilters={
    <Select onValueChange={setCustomFilter}>
      <SelectTrigger>Custom Filter</SelectTrigger>
    </Select>
  }
/>
```

This architecture ensures that the frontend automatically stays in sync with database schema changes while providing a rich, type-safe development experience.