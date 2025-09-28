# PMO Web Application - Frontend Architecture

## Overview

This is a React-based Project Management Office (PMO) web application built with TypeScript, Vite, and Tailwind CSS. The application follows a hierarchical entity-relationship model with role-based access control (RBAC) handled entirely at the API level.

## Core Architecture

### Security Model
- **Frontend**: No permission checking - displays all data provided by API
- **Backend**: Complete RBAC implementation via database joins
- **Single Source of Truth**: API determines what users can see and do
- **JWT Authentication**: All API calls authenticated with Bearer tokens

## Navigation Structure

### Main Navigation Flow
1. **Application Load** → Dashboard with overview metrics
2. **Sidebar Click** → Entity Main Page with data table and action buttons
3. **Row Click** → Entity Detail Page with editable fields and child tabs
4. **Tab Click** → Child Entity filtered data tables
5. **Child Row Click** → Child Entity Detail Page (recursive structure)

### Sidebar Entities
Each sidebar button corresponds to a main entity type:

- **Dashboard** - Overview metrics and charts
- **Projects** - Project management and tracking
- **Business Units** - Organizational hierarchy management
- **Tasks** - Task management and assignment
- **Employees** - Personnel management
- **Organizations** - Client/partner organizations
- **Roles** - User role management
- **Wikis** - Knowledge base articles
- **Artifacts** - Document and file management
- **Forms** - Dynamic form management

## Page Architecture

### Main Pages (Entity List Views)

#### Structure Components
- **Page Header**: Entity icon, title, and description
- **Stats Grid**: Key metrics cards with icons and values
- **Action Buttons Bar**: Create, Share Selected, Delete Selected buttons
- **Data Table**: Searchable, filterable, sortable table with bulk selection

#### Data Flow
- **API Route**: `GET /api/v1/{entity}`
- **Hook**: Entity-specific API hooks (e.g., `projectApi.list()`)
- **State**: Pagination, loading, data arrays
- **Actions**: Individual row actions (View, Edit, Share, Delete) + bulk operations

#### Key Features
- **Bulk Selection**: Checkbox column with select all/none functionality
- **Action Buttons**: Create (top right), Share/Delete (appear when items selected)
- **Real-time Updates**: Auto-refresh after create/delete operations
- **Responsive Design**: Adaptive layouts for different screen sizes

### Detail Pages (Entity Edit Views)

#### Structure Components
- **Header Tab Navigation**: Overview + child entity tabs with counts
- **Action Bar**: Edit, Share, and other entity-specific actions
- **Entity Information Cards**: Grouped editable fields by category
- **Inline Edit Fields**: Click-to-edit functionality with save/cancel
- **Child Entity Tables**: Filtered data tables for related entities

#### Data Flow
- **API Route**: `GET /api/v1/{entity}/{id}`
- **Hook**: `useHeaderTabs()` for dynamic tab generation
- **State**: Entity data, editing states, field values
- **Navigation**: Dynamic routing based on entity relationships

#### Child Entity Relationships
- **Projects** → Tasks, Wiki, Artifacts, Forms
- **Business Units** → Projects, Employees, Tasks
- **Tasks** → Artifacts, Forms
- **Organizations** → Employees, Projects, Worksites

## Core Reusable Components

### ActionButtonsBar
**Purpose**: Consistent action button layout above data tables

**Features**:
- Create button (always visible) with entity-specific labeling
- Share Selected button (appears when items selected)
- Delete Selected button (appears when items selected)
- Selection count display
- Support for additional custom actions

**State Management**: Receives selection count and callbacks from parent component

### DataTable (Enhanced)
**Purpose**: Advanced data table with selection, sorting, filtering, and actions

**Features**:
- Bulk selection with checkboxes and select-all functionality
- Individual row actions (View, Edit, Share, Delete)
- Advanced filtering with dropdown options per column
- Column visibility toggle and ordering
- Responsive design with horizontal scrolling
- Sticky headers and action columns
- Loading states and empty data handling

**Selection System**: Checkbox column with indeterminate states for partial selections

### HeaderTabNavigation
**Purpose**: Dynamic tab navigation for entity detail pages

**Features**:
- Fetches action summaries from API to build tabs
- Shows entity counts per tab (e.g., "Tasks (5)")
- Back button navigation to parent entity
- Active tab highlighting
- Responsive design for mobile devices

**API Integration**: Uses `/api/v1/{entity}/{id}/action-summaries` endpoint

### FilteredDataTable
**Purpose**: Complete data table solution with optional action buttons and bulk operations

**Features**:
- Configuration-driven column definitions via entity configuration service
- Pre-filtered data based on parent entity relationship
- Built-in row actions and click handlers
- Optional action buttons bar (Create, Share Selected, Delete Selected)
- Bulk selection with checkbox column and select all/none functionality
- Integration with ActionButtonsBar component
- Supports all standard DataTable features (search, filter, sort, pagination)

**Usage**: Primary component for main entity pages and child entity displays in detail page tabs

### InlineEditField
**Purpose**: Click-to-edit functionality for detail page fields

**Features**:
- Multiple input types (text, textarea, select, date, number)
- Save/cancel action buttons
- Validation and error handling
- Custom render functions for display values
- Loading states during save operations

**Interaction**: Click field → Edit mode → Save/Cancel → API update → Refresh display

### StatsGrid
**Purpose**: Metrics display with consistent card layout

**Features**:
- Responsive grid layout (1-4 columns)
- Icon integration with color theming
- Value formatting (numbers, percentages, currency)
- Hover effects and visual hierarchy

**Usage**: Main pages to show key entity metrics and KPIs

## API Integration Patterns

### Authentication Flow
1. Login request → JWT token storage
2. All subsequent requests include `Authorization: Bearer {token}` header
3. Token validation and user identification on backend
4. RBAC filtering applied to all data responses

### Data Fetching Patterns
- **List Endpoints**: `GET /api/v1/{entity}` with pagination and filtering
- **Detail Endpoints**: `GET /api/v1/{entity}/{id}` with related data
- **Child Endpoints**: `GET /api/v1/{parent}/{id}/{child}` for filtered relationships
- **Action Summaries**: `GET /api/v1/{entity}/{id}/action-summaries` for tab navigation

### State Management
- **React Hooks**: useState for local component state
- **API Hooks**: Custom hooks for entity-specific operations
- **Real-time Updates**: Immediate refetch after mutations
- **Optimistic Updates**: UI updates before API confirmation

## User Interaction Journey

### Typical User Flow
1. **Login** → JWT token obtained and stored
2. **Dashboard Load** → Overview metrics displayed
3. **Sidebar Navigation** → Click entity button (e.g., "Projects")
4. **Main Page Load** → Projects table with action buttons loads
5. **Bulk Selection** → Check multiple project rows
6. **Bulk Action** → Click "Delete Selected" → Confirmation dialog
7. **Individual Action** → Click project row → Navigate to detail page
8. **Detail Page** → Editable project fields with child entity tabs
9. **Tab Navigation** → Click "Tasks" tab → Filtered task table
10. **Child Navigation** → Click task row → Task detail page
11. **Edit Operations** → Click field → Edit mode → Save changes
12. **Navigation Back** → Back button or sidebar navigation

### Error Handling
- **Network Errors**: Toast notifications with retry options
- **Validation Errors**: Inline field error messages
- **Permission Errors**: API-level filtering (no frontend error needed)
- **Loading States**: Skeleton screens and loading indicators

## Configuration System

### Entity Configuration
- **Dynamic Field Definitions**: API-driven column and form configurations
- **UI Behavior Settings**: Visibility, editability, rendering options
- **Relationship Mappings**: Parent-child entity connections
- **Validation Rules**: Field-level validation and formatting

### Responsive Design
- **Mobile-First**: Designed for mobile devices with desktop enhancements
- **Flexible Layouts**: CSS Grid and Flexbox for adaptive designs
- **Touch-Friendly**: Appropriate touch targets and gestures
- **Performance Optimized**: Lazy loading and virtual scrolling for large datasets

This architecture provides a scalable, maintainable frontend that efficiently handles complex entity relationships while maintaining security through API-level RBAC enforcement.