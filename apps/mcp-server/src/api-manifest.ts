/**
 * PMO API Manifest - Complete API Endpoint Registry
 * This file indexes all API endpoints available in the PMO platform
 * Auto-generated from API routes analysis
 */

export interface APIEndpoint {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  requiresAuth: boolean;
  category: string;
  parameters?: {
    path?: Record<string, string>;
    query?: Record<string, string>;
    body?: Record<string, string>;
  };
  responseType?: string;
}

export const API_MANIFEST: APIEndpoint[] = [
  // ==================== AUTHENTICATION ====================
  {
    name: 'auth_login',
    method: 'POST',
    path: '/api/v1/auth/login',
    description: 'Authenticate employee and get JWT token',
    requiresAuth: false,
    category: 'Authentication',
    parameters: {
      body: {
        email: 'Employee email address',
        password: 'Employee password'
      }
    },
    responseType: 'LoginResponse'
  },
  {
    name: 'auth_get_profile',
    method: 'GET',
    path: '/api/v1/auth/me',
    description: 'Get current authenticated user profile',
    requiresAuth: true,
    category: 'Authentication'
  },
  {
    name: 'auth_get_permissions',
    method: 'GET',
    path: '/api/v1/auth/permissions',
    description: 'Get current user permissions summary',
    requiresAuth: true,
    category: 'Authentication'
  },
  {
    name: 'auth_get_scopes',
    method: 'GET',
    path: '/api/v1/auth/scopes/:entityCode',
    description: 'Get accessible entities by type for current user',
    requiresAuth: true,
    category: 'Authentication',
    parameters: {
      path: {
        entityCode: 'Entity type (project, task, etc.)'
      },
      query: {
        action: 'Permission action to check (view, edit, create, delete)'
      }
    }
  },
  {
    name: 'auth_logout',
    method: 'POST',
    path: '/api/v1/auth/logout',
    description: 'Logout current user',
    requiresAuth: true,
    category: 'Authentication'
  },
  {
    name: 'customer_signup',
    method: 'POST',
    path: '/api/v1/auth/customer/signup',
    description: 'Register new customer account',
    requiresAuth: false,
    category: 'Authentication',
    parameters: {
      body: {
        name: 'Customer name',
        primary_email: 'Customer email',
        password: 'Customer password',
        cust_type: 'Customer type (residential/commercial)'
      }
    }
  },
  {
    name: 'customer_signin',
    method: 'POST',
    path: '/api/v1/auth/customer/signin',
    description: 'Authenticate customer and get JWT token',
    requiresAuth: false,
    category: 'Authentication',
    parameters: {
      body: {
        email: 'Customer email',
        password: 'Customer password'
      }
    }
  },
  {
    name: 'customer_get_profile',
    method: 'GET',
    path: '/api/v1/auth/customer/me',
    description: 'Get current authenticated customer profile',
    requiresAuth: true,
    category: 'Authentication'
  },
  {
    name: 'customer_configure_entities',
    method: 'PUT',
    path: '/api/v1/auth/customer/configure',
    description: 'Configure customer entity access',
    requiresAuth: true,
    category: 'Authentication',
    parameters: {
      body: {
        entities: 'Array of entity types to enable'
      }
    }
  },

  // ==================== PROJECT ====================
  {
    name: 'project_list',
    method: 'GET',
    path: '/api/v1/project',
    description: 'List all projects with filtering and pagination',
    requiresAuth: true,
    category: 'Project',
    parameters: {
      query: {
        active: 'Filter by active status (boolean)',
        search: 'Search in name, description, code',
        dl__project_stage: 'Filter by project stage',
        business_id: 'Filter by business ID',
        limit: 'Number of results (1-100)',
        offset: 'Pagination offset'
      }
    }
  },
  {
    name: 'project_get',
    method: 'GET',
    path: '/api/v1/project/:id',
    description: 'Get single project by ID',
    requiresAuth: true,
    category: 'Project',
    parameters: {
      path: {
        id: 'Project UUID'
      }
    }
  },
  {
    name: 'project_create',
    method: 'POST',
    path: '/api/v1/project',
    description: 'Create new project',
    requiresAuth: true,
    category: 'Project',
    parameters: {
      body: {
        name: 'Project name',
        code: 'Project code',
        descr: 'Project description',
        dl__project_stage: 'Project stage',
        budget_allocated_amt: 'Budget allocated amount',
        planned_start_date: 'Planned start date',
        planned_end_date: 'Planned end date',
        manager_employee_id: 'Manager employee ID',
        business_id: 'Business ID (stored in metadata)',
        office_id: 'Office ID (stored in metadata)'
      }
    }
  },
  {
    name: 'project_update',
    method: 'PUT',
    path: '/api/v1/project/:id',
    description: 'Update existing project',
    requiresAuth: true,
    category: 'Project',
    parameters: {
      path: {
        id: 'Project UUID'
      },
      body: {
        name: 'Project name',
        descr: 'Project description',
        dl__project_stage: 'Project stage',
        budget_allocated_amt: 'Budget allocated',
        budget_spent_amt: 'Budget spent',
        actual_start_date: 'Actual start date',
        actual_end_date: 'Actual end date'
      }
    }
  },
  {
    name: 'project_delete',
    method: 'DELETE',
    path: '/api/v1/project/:id',
    description: 'Delete project (soft delete with cascading cleanup)',
    requiresAuth: true,
    category: 'Project',
    parameters: {
      path: {
        id: 'Project UUID'
      }
    }
  },
  {
    name: 'project_get_child_tabs',
    method: 'GET',
    path: '/api/v1/project/:id/dynamic-child-entity-tabs',
    description: 'Get child entity tabs for project detail page',
    requiresAuth: true,
    category: 'Project',
    parameters: {
      path: {
        id: 'Project UUID'
      }
    }
  },
  {
    name: 'project_get_tasks',
    method: 'GET',
    path: '/api/v1/project/:id/task',
    description: 'Get tasks linked to project',
    requiresAuth: true,
    category: 'Project',
    parameters: {
      path: {
        id: 'Project UUID'
      },
      query: {
        limit: 'Number of results',
        offset: 'Pagination offset',
        status: 'Filter by task status',
        assignee: 'Filter by assignee ID'
      }
    }
  },
  {
    name: 'project_get_wiki',
    method: 'GET',
    path: '/api/v1/project/:id/wiki',
    description: 'Get wiki entries linked to project',
    requiresAuth: true,
    category: 'Project',
    parameters: {
      path: {
        id: 'Project UUID'
      },
      query: {
        limit: 'Number of results',
        offset: 'Pagination offset'
      }
    }
  },
  {
    name: 'project_get_forms',
    method: 'GET',
    path: '/api/v1/project/:id/form',
    description: 'Get forms linked to project',
    requiresAuth: true,
    category: 'Project',
    parameters: {
      path: {
        id: 'Project UUID'
      },
      query: {
        limit: 'Number of results',
        offset: 'Pagination offset'
      }
    }
  },
  {
    name: 'project_get_artifacts',
    method: 'GET',
    path: '/api/v1/project/:id/artifact',
    description: 'Get artifacts linked to project',
    requiresAuth: true,
    category: 'Project',
    parameters: {
      path: {
        id: 'Project UUID'
      },
      query: {
        limit: 'Number of results',
        offset: 'Pagination offset'
      }
    }
  },

  // ==================== TASK ====================
  {
    name: 'task_list',
    method: 'GET',
    path: '/api/v1/task',
    description: 'List all tasks with filtering and pagination',
    requiresAuth: true,
    category: 'Task',
    parameters: {
      query: {
        project_id: 'Filter by project ID',
        assigned_to_employee_id: 'Filter by assignee',
        dl__task_stage: 'Filter by task stage',
        task_type: 'Filter by task type',
        task_category: 'Filter by category',
        worksite_id: 'Filter by worksite',
        client_id: 'Filter by client',
        active: 'Filter by active status',
        search: 'Search text',
        limit: 'Number of results (1-100)',
        offset: 'Pagination offset'
      }
    }
  },
  {
    name: 'task_get',
    method: 'GET',
    path: '/api/v1/task/:id',
    description: 'Get single task by ID',
    requiresAuth: true,
    category: 'Task',
    parameters: {
      path: {
        id: 'Task UUID'
      }
    }
  },
  {
    name: 'task_create',
    method: 'POST',
    path: '/api/v1/task',
    description: 'Create new task',
    requiresAuth: true,
    category: 'Task',
    parameters: {
      body: {
        name: 'Task name',
        code: 'Task code',
        descr: 'Task description',
        dl__task_stage: 'Task stage',
        dl__task_priority: 'Task priority',
        estimated_hours: 'Estimated hours',
        story_points: 'Story points',
        metadata: 'Additional metadata (project_id, etc.)'
      }
    }
  },
  {
    name: 'task_update',
    method: 'PUT',
    path: '/api/v1/task/:id',
    description: 'Update existing task',
    requiresAuth: true,
    category: 'Task',
    parameters: {
      path: {
        id: 'Task UUID'
      },
      body: {
        name: 'Task name',
        descr: 'Task description',
        dl__task_stage: 'Task stage',
        dl__task_priority: 'Priority level',
        estimated_hours: 'Estimated hours',
        actual_hours: 'Actual hours'
      }
    }
  },
  {
    name: 'task_delete',
    method: 'DELETE',
    path: '/api/v1/task/:id',
    description: 'Delete task (soft delete)',
    requiresAuth: true,
    category: 'Task',
    parameters: {
      path: {
        id: 'Task UUID'
      }
    }
  },
  {
    name: 'task_update_status',
    method: 'PATCH',
    path: '/api/v1/task/:id/status',
    description: 'Update task status for Kanban drag-drop',
    requiresAuth: true,
    category: 'Task',
    parameters: {
      path: {
        id: 'Task UUID'
      },
      body: {
        task_status: 'New task status',
        position: 'Kanban position',
        moved_by: 'Employee ID who moved the task'
      }
    }
  },
  {
    name: 'task_get_kanban',
    method: 'GET',
    path: '/api/v1/project/:projectId/tasks/kanban',
    description: 'Get Kanban view data for project tasks',
    requiresAuth: true,
    category: 'Task',
    parameters: {
      path: {
        projectId: 'Project UUID'
      },
      query: {
        assignee: 'Filter by assignee',
        priority: 'Filter by priority'
      }
    }
  },
  {
    name: 'task_get_case_notes',
    method: 'GET',
    path: '/api/v1/task/:taskId/case-notes',
    description: 'Get task case notes timeline',
    requiresAuth: true,
    category: 'Task',
    parameters: {
      path: {
        taskId: 'Task UUID'
      }
    }
  },
  {
    name: 'task_add_case_note',
    method: 'POST',
    path: '/api/v1/task/:taskId/case-notes',
    description: 'Add case note to task',
    requiresAuth: true,
    category: 'Task',
    parameters: {
      path: {
        taskId: 'Task UUID'
      },
      body: {
        content: 'Note content',
        content_type: 'Note type (case_note, rich_note, log_entry)',
        mentions: 'Array of mentioned employee IDs',
        attachments: 'Array of attachment objects'
      }
    }
  },
  {
    name: 'task_get_activity',
    method: 'GET',
    path: '/api/v1/task/:taskId/activity',
    description: 'Get task activity timeline',
    requiresAuth: true,
    category: 'Task',
    parameters: {
      path: {
        taskId: 'Task UUID'
      }
    }
  },
  {
    name: 'task_get_assignees',
    method: 'GET',
    path: '/api/v1/task/:id/assignees',
    description: 'Get task assignees from entity_id_map',
    requiresAuth: true,
    category: 'Task',
    parameters: {
      path: {
        id: 'Task UUID'
      }
    }
  },

  // ==================== EMPLOYEE ====================
  {
    name: 'employee_list',
    method: 'GET',
    path: '/api/v1/employee',
    description: 'List all employees with filtering',
    requiresAuth: true,
    category: 'Employee'
  },
  {
    name: 'employee_get',
    method: 'GET',
    path: '/api/v1/employee/:id',
    description: 'Get single employee by ID',
    requiresAuth: true,
    category: 'Employee',
    parameters: {
      path: {
        id: 'Employee UUID'
      }
    }
  },
  {
    name: 'employee_create',
    method: 'POST',
    path: '/api/v1/employee',
    description: 'Create new employee',
    requiresAuth: true,
    category: 'Employee'
  },
  {
    name: 'employee_update',
    method: 'PUT',
    path: '/api/v1/employee/:id',
    description: 'Update employee. All fields are optional - only provide fields to update',
    requiresAuth: true,
    category: 'Employee',
    parameters: {
      path: {
        id: 'Employee UUID'
      },
      body: {
        name: 'Employee full name',
        email: 'Email address',
        phone: 'Phone number',
        title: 'Job title',
        active_flag: 'Active status (true/false)'
      }
    }
  },
  {
    name: 'employee_delete',
    method: 'DELETE',
    path: '/api/v1/employee/:id',
    description: 'Delete employee (soft delete)',
    requiresAuth: true,
    category: 'Employee',
    parameters: {
      path: {
        id: 'Employee UUID'
      }
    }
  },

  // ==================== BUSINESS ====================
  {
    name: 'business_list',
    method: 'GET',
    path: '/api/v1/biz',
    description: 'List all businesses',
    requiresAuth: true,
    category: 'Business'
  },
  {
    name: 'business_get',
    method: 'GET',
    path: '/api/v1/biz/:id',
    description: 'Get single business by ID',
    requiresAuth: true,
    category: 'Business',
    parameters: {
      path: {
        id: 'Business UUID'
      }
    }
  },
  {
    name: 'business_create',
    method: 'POST',
    path: '/api/v1/biz',
    description: 'Create new business',
    requiresAuth: true,
    category: 'Business'
  },
  {
    name: 'business_update',
    method: 'PUT',
    path: '/api/v1/biz/:id',
    description: 'Update business. All fields are optional - only provide fields to update',
    requiresAuth: true,
    category: 'Business',
    parameters: {
      path: {
        id: 'Business UUID'
      },
      body: {
        name: 'Business name',
        legal_name: 'Legal business name',
        description: 'Business description',
        address: 'Business address',
        city: 'City',
        province: 'Province/State',
        postal_code: 'Postal code',
        active_flag: 'Active status (true/false)'
      }
    }
  },
  {
    name: 'business_delete',
    method: 'DELETE',
    path: '/api/v1/biz/:id',
    description: 'Delete business (soft delete)',
    requiresAuth: true,
    category: 'Business',
    parameters: {
      path: {
        id: 'Business UUID'
      }
    }
  },

  // ==================== OFFICE ====================
  {
    name: 'office_list',
    method: 'GET',
    path: '/api/v1/office',
    description: 'List all offices',
    requiresAuth: true,
    category: 'Office'
  },
  {
    name: 'office_get',
    method: 'GET',
    path: '/api/v1/office/:id',
    description: 'Get single office by ID',
    requiresAuth: true,
    category: 'Office',
    parameters: {
      path: {
        id: 'Office UUID'
      }
    }
  },
  {
    name: 'office_create',
    method: 'POST',
    path: '/api/v1/office',
    description: 'Create new office',
    requiresAuth: true,
    category: 'Office'
  },
  {
    name: 'office_update',
    method: 'PUT',
    path: '/api/v1/office/:id',
    description: 'Update office',
    requiresAuth: true,
    category: 'Office',
    parameters: {
      path: {
        id: 'Office UUID'
      }
    }
  },
  {
    name: 'office_delete',
    method: 'DELETE',
    path: '/api/v1/office/:id',
    description: 'Delete office (soft delete)',
    requiresAuth: true,
    category: 'Office',
    parameters: {
      path: {
        id: 'Office UUID'
      }
    }
  },

  // ==================== CUSTOMER ====================
  {
    name: 'customer_list',
    method: 'GET',
    path: '/api/v1/cust',
    description: 'List all customers',
    requiresAuth: true,
    category: 'Customer'
  },
  {
    name: 'customer_get',
    method: 'GET',
    path: '/api/v1/cust/:id',
    description: 'Get single customer by ID',
    requiresAuth: true,
    category: 'Customer',
    parameters: {
      path: {
        id: 'Customer UUID'
      }
    }
  },
  {
    name: 'customer_create',
    method: 'POST',
    path: '/api/v1/cust',
    description: 'Create new customer. Only name is required, all other fields optional',
    requiresAuth: true,
    category: 'Customer',
    parameters: {
      body: {
        name: 'Customer full name (REQUIRED - minimum info needed)',
        primary_phone: 'Phone number (highly recommended)',
        primary_email: 'Email address (optional)',
        primary_address: 'Street address (optional)',
        city: 'City (optional)',
        province: 'Province (optional, defaults to ON)',
        postal_code: 'Postal code (optional)'
      }
    }
  },
  {
    name: 'customer_update',
    method: 'PUT',
    path: '/api/v1/cust/:id',
    description: 'Update customer fields dynamically. You can update ANY customer field(s) incrementally as you learn information. Common fields: name, primary_phone, primary_email, primary_address, city, province, postal_code, country, cust_type, cust_status. Just provide whatever fields you want to update - you can call this multiple times to update different fields.',
    requiresAuth: true,
    category: 'Customer',
    parameters: {
      path: {
        id: 'Customer UUID to update'
      },
      body: {
        // Dynamic body - can include ANY customer field
        '*': 'Any customer field to update (name, primary_phone, primary_email, primary_address, city, province, postal_code, country, etc.)'
      }
    }
  },
  {
    name: 'customer_delete',
    method: 'DELETE',
    path: '/api/v1/cust/:id',
    description: 'Delete customer (soft delete)',
    requiresAuth: true,
    category: 'Customer',
    parameters: {
      path: {
        id: 'Customer UUID'
      }
    }
  },
  {
    name: 'customer_get_hierarchy',
    method: 'GET',
    path: '/api/v1/cust/:id/hierarchy',
    description: 'Get customer hierarchy (parent and children)',
    requiresAuth: true,
    category: 'Customer',
    parameters: {
      path: {
        id: 'Customer UUID'
      }
    }
  },
  {
    name: 'customer_get_projects',
    method: 'GET',
    path: '/api/v1/cust/:id/project',
    description: 'Get projects linked to customer',
    requiresAuth: true,
    category: 'Customer',
    parameters: {
      path: {
        id: 'Customer UUID'
      },
      query: {
        limit: 'Number of results',
        offset: 'Pagination offset'
      }
    }
  },

  // ==================== WORKSITE ====================
  {
    name: 'worksite_list',
    method: 'GET',
    path: '/api/v1/worksite',
    description: 'List all worksites',
    requiresAuth: true,
    category: 'Worksite'
  },
  {
    name: 'worksite_get',
    method: 'GET',
    path: '/api/v1/worksite/:id',
    description: 'Get single worksite by ID',
    requiresAuth: true,
    category: 'Worksite',
    parameters: {
      path: {
        id: 'Worksite UUID'
      }
    }
  },
  {
    name: 'worksite_create',
    method: 'POST',
    path: '/api/v1/worksite',
    description: 'Create new worksite',
    requiresAuth: true,
    category: 'Worksite'
  },
  {
    name: 'worksite_update',
    method: 'PUT',
    path: '/api/v1/worksite/:id',
    description: 'Update worksite',
    requiresAuth: true,
    category: 'Worksite',
    parameters: {
      path: {
        id: 'Worksite UUID'
      }
    }
  },
  {
    name: 'worksite_delete',
    method: 'DELETE',
    path: '/api/v1/worksite/:id',
    description: 'Delete worksite (soft delete)',
    requiresAuth: true,
    category: 'Worksite',
    parameters: {
      path: {
        id: 'Worksite UUID'
      }
    }
  },

  // ==================== ROLE ====================
  {
    name: 'role_list',
    method: 'GET',
    path: '/api/v1/role',
    description: 'List all roles',
    requiresAuth: true,
    category: 'Role'
  },
  {
    name: 'role_get',
    method: 'GET',
    path: '/api/v1/role/:id',
    description: 'Get single role by ID',
    requiresAuth: true,
    category: 'Role',
    parameters: {
      path: {
        id: 'Role UUID'
      }
    }
  },
  {
    name: 'role_create',
    method: 'POST',
    path: '/api/v1/role',
    description: 'Create new role',
    requiresAuth: true,
    category: 'Role'
  },
  {
    name: 'role_update',
    method: 'PUT',
    path: '/api/v1/role/:id',
    description: 'Update role',
    requiresAuth: true,
    category: 'Role',
    parameters: {
      path: {
        id: 'Role UUID'
      }
    }
  },
  {
    name: 'role_delete',
    method: 'DELETE',
    path: '/api/v1/role/:id',
    description: 'Delete role (soft delete)',
    requiresAuth: true,
    category: 'Role',
    parameters: {
      path: {
        id: 'Role UUID'
      }
    }
  },

  // ==================== POSITION ====================
  {
    name: 'position_list',
    method: 'GET',
    path: '/api/v1/position',
    description: 'List all positions',
    requiresAuth: true,
    category: 'Position'
  },
  {
    name: 'position_get',
    method: 'GET',
    path: '/api/v1/position/:id',
    description: 'Get single position by ID',
    requiresAuth: true,
    category: 'Position',
    parameters: {
      path: {
        id: 'Position UUID'
      }
    }
  },
  {
    name: 'position_create',
    method: 'POST',
    path: '/api/v1/position',
    description: 'Create new position',
    requiresAuth: true,
    category: 'Position'
  },
  {
    name: 'position_update',
    method: 'PUT',
    path: '/api/v1/position/:id',
    description: 'Update position',
    requiresAuth: true,
    category: 'Position',
    parameters: {
      path: {
        id: 'Position UUID'
      }
    }
  },
  {
    name: 'position_delete',
    method: 'DELETE',
    path: '/api/v1/position/:id',
    description: 'Delete position (soft delete)',
    requiresAuth: true,
    category: 'Position',
    parameters: {
      path: {
        id: 'Position UUID'
      }
    }
  },

  // ==================== WIKI ====================
  {
    name: 'wiki_list',
    method: 'GET',
    path: '/api/v1/wiki',
    description: 'List all wiki entries',
    requiresAuth: true,
    category: 'Wiki'
  },
  {
    name: 'wiki_get',
    method: 'GET',
    path: '/api/v1/wiki/:id',
    description: 'Get single wiki entry by ID',
    requiresAuth: true,
    category: 'Wiki',
    parameters: {
      path: {
        id: 'Wiki UUID'
      }
    }
  },
  {
    name: 'wiki_create',
    method: 'POST',
    path: '/api/v1/wiki',
    description: 'Create new wiki entry',
    requiresAuth: true,
    category: 'Wiki'
  },
  {
    name: 'wiki_update',
    method: 'PUT',
    path: '/api/v1/wiki/:id',
    description: 'Update wiki entry',
    requiresAuth: true,
    category: 'Wiki',
    parameters: {
      path: {
        id: 'Wiki UUID'
      }
    }
  },
  {
    name: 'wiki_delete',
    method: 'DELETE',
    path: '/api/v1/wiki/:id',
    description: 'Delete wiki entry (soft delete)',
    requiresAuth: true,
    category: 'Wiki',
    parameters: {
      path: {
        id: 'Wiki UUID'
      }
    }
  },

  // ==================== FORM ====================
  {
    name: 'form_list',
    method: 'GET',
    path: '/api/v1/form',
    description: 'List all forms',
    requiresAuth: true,
    category: 'Form'
  },
  {
    name: 'form_get',
    method: 'GET',
    path: '/api/v1/form/:id',
    description: 'Get single form by ID',
    requiresAuth: true,
    category: 'Form',
    parameters: {
      path: {
        id: 'Form UUID'
      }
    }
  },
  {
    name: 'form_create',
    method: 'POST',
    path: '/api/v1/form',
    description: 'Create new form',
    requiresAuth: true,
    category: 'Form'
  },
  {
    name: 'form_update',
    method: 'PUT',
    path: '/api/v1/form/:id',
    description: 'Update form',
    requiresAuth: true,
    category: 'Form',
    parameters: {
      path: {
        id: 'Form UUID'
      }
    }
  },
  {
    name: 'form_delete',
    method: 'DELETE',
    path: '/api/v1/form/:id',
    description: 'Delete form (soft delete)',
    requiresAuth: true,
    category: 'Form',
    parameters: {
      path: {
        id: 'Form UUID'
      }
    }
  },

  // ==================== ARTIFACT ====================
  {
    name: 'artifact_list',
    method: 'GET',
    path: '/api/v1/artifact',
    description: 'List all artifacts',
    requiresAuth: true,
    category: 'Artifact'
  },
  {
    name: 'artifact_get',
    method: 'GET',
    path: '/api/v1/artifact/:id',
    description: 'Get single artifact by ID',
    requiresAuth: true,
    category: 'Artifact',
    parameters: {
      path: {
        id: 'Artifact UUID'
      }
    }
  },
  {
    name: 'artifact_create',
    method: 'POST',
    path: '/api/v1/artifact',
    description: 'Create new artifact',
    requiresAuth: true,
    category: 'Artifact'
  },
  {
    name: 'artifact_update',
    method: 'PUT',
    path: '/api/v1/artifact/:id',
    description: 'Update artifact',
    requiresAuth: true,
    category: 'Artifact',
    parameters: {
      path: {
        id: 'Artifact UUID'
      }
    }
  },
  {
    name: 'artifact_delete',
    method: 'DELETE',
    path: '/api/v1/artifact/:id',
    description: 'Delete artifact (soft delete)',
    requiresAuth: true,
    category: 'Artifact',
    parameters: {
      path: {
        id: 'Artifact UUID'
      }
    }
  },

  // ==================== REPORTS ====================
  {
    name: 'reports_list',
    method: 'GET',
    path: '/api/v1/reports',
    description: 'List all reports',
    requiresAuth: true,
    category: 'Reports'
  },
  {
    name: 'reports_get',
    method: 'GET',
    path: '/api/v1/reports/:id',
    description: 'Get single report by ID',
    requiresAuth: true,
    category: 'Reports',
    parameters: {
      path: {
        id: 'Report UUID'
      }
    }
  },
  {
    name: 'reports_create',
    method: 'POST',
    path: '/api/v1/reports',
    description: 'Create new report',
    requiresAuth: true,
    category: 'Reports'
  },
  {
    name: 'reports_update',
    method: 'PUT',
    path: '/api/v1/reports/:id',
    description: 'Update report',
    requiresAuth: true,
    category: 'Reports',
    parameters: {
      path: {
        id: 'Report UUID'
      }
    }
  },
  {
    name: 'reports_delete',
    method: 'DELETE',
    path: '/api/v1/reports/:id',
    description: 'Delete report (soft delete)',
    requiresAuth: true,
    category: 'Reports',
    parameters: {
      path: {
        id: 'Report UUID'
      }
    }
  },

  // ==================== PRODUCT & OPERATIONS ====================
  {
    name: 'product_list',
    method: 'GET',
    path: '/api/v1/product',
    description: 'List all products',
    requiresAuth: true,
    category: 'Product'
  },
  {
    name: 'product_get',
    method: 'GET',
    path: '/api/v1/product/:id',
    description: 'Get single product',
    requiresAuth: true,
    category: 'Product',
    parameters: {
      path: {
        id: 'Product UUID'
      }
    }
  },
  {
    name: 'service_list',
    method: 'GET',
    path: '/api/v1/service',
    description: 'List all services',
    requiresAuth: true,
    category: 'Product'
  },
  {
    name: 'service_get',
    method: 'GET',
    path: '/api/v1/service/:id',
    description: 'Get single service',
    requiresAuth: true,
    category: 'Product',
    parameters: {
      path: {
        id: 'Service UUID'
      }
    }
  },
  {
    name: 'quote_list',
    method: 'GET',
    path: '/api/v1/quote',
    description: 'List all quotes',
    requiresAuth: true,
    category: 'Sales'
  },
  {
    name: 'quote_get',
    method: 'GET',
    path: '/api/v1/quote/:id',
    description: 'Get single quote',
    requiresAuth: true,
    category: 'Sales',
    parameters: {
      path: {
        id: 'Quote UUID'
      }
    }
  },
  {
    name: 'work_order_list',
    method: 'GET',
    path: '/api/v1/work_order',
    description: 'List all work orders',
    requiresAuth: true,
    category: 'Operations'
  },
  {
    name: 'work_order_get',
    method: 'GET',
    path: '/api/v1/work_order/:id',
    description: 'Get single work order',
    requiresAuth: true,
    category: 'Operations',
    parameters: {
      path: {
        id: 'Work Order UUID'
      }
    }
  },
  {
    name: 'inventory_list',
    method: 'GET',
    path: '/api/v1/inventory',
    description: 'List all inventory items',
    requiresAuth: true,
    category: 'Inventory'
  },
  {
    name: 'order_list',
    method: 'GET',
    path: '/api/v1/order',
    description: 'List all orders',
    requiresAuth: true,
    category: 'Order'
  },
  {
    name: 'shipment_list',
    method: 'GET',
    path: '/api/v1/shipment',
    description: 'List all shipments',
    requiresAuth: true,
    category: 'Shipment'
  },
  {
    name: 'invoice_list',
    method: 'GET',
    path: '/api/v1/invoice',
    description: 'List all invoices',
    requiresAuth: true,
    category: 'Financial'
  },

  // ==================== FINANCIAL ====================
  {
    name: 'cost_list',
    method: 'GET',
    path: '/api/v1/cost',
    description: 'List all costs',
    requiresAuth: true,
    category: 'Financial'
  },
  {
    name: 'revenue_list',
    method: 'GET',
    path: '/api/v1/revenue',
    description: 'List all revenue records',
    requiresAuth: true,
    category: 'Financial'
  },

  // ==================== SETTINGS ====================
  {
    name: 'setting_list',
    method: 'GET',
    path: '/api/v1/setting',
    description: 'Get service catalog and other settings. Use datalabel=dl__service_category to fetch available service types.',
    requiresAuth: true,
    category: 'Settings',
    parameters: {
      query: {
        datalabel: 'Service catalog identifier. Use "dl__service_category" to get list of available services (internet_support, mobile_support, billing_support, etc.)'
      }
    }
  },

  // ==================== LINKAGE ====================
  {
    name: 'linkage_create',
    method: 'POST',
    path: '/api/v1/linkage',
    description: 'Create entity relationship linkage',
    requiresAuth: true,
    category: 'Linkage',
    parameters: {
      body: {
        parent_entity_type: 'Parent entity type',
        parent_entity_id: 'Parent entity UUID',
        child_entity_type: 'Child entity type',
        child_entity_id: 'Child entity UUID',
        relationship_type: 'Relationship type'
      }
    }
  },
  {
    name: 'linkage_delete',
    method: 'DELETE',
    path: '/api/v1/linkage/:id',
    description: 'Delete entity relationship linkage',
    requiresAuth: true,
    category: 'Linkage',
    parameters: {
      path: {
        id: 'Linkage UUID'
      }
    }
  },
  {
    name: 'linkage_list',
    method: 'GET',
    path: '/api/v1/linkage',
    description: 'List entity linkages with filtering',
    requiresAuth: true,
    category: 'Linkage',
    parameters: {
      query: {
        parent_entity_type: 'Filter by parent type',
        parent_entity_id: 'Filter by parent ID',
        child_entity_type: 'Filter by child type',
        child_entity_id: 'Filter by child ID'
      }
    }
  },

  // ==================== RBAC ====================
  {
    name: 'rbac_check_permission',
    method: 'GET',
    path: '/api/v1/rbac/check',
    description: 'Check if user has permission on entity',
    requiresAuth: true,
    category: 'RBAC',
    parameters: {
      query: {
        entity_type: 'Entity type to check',
        entity_id: 'Entity ID to check',
        action: 'Action to check (view, edit, create, delete)'
      }
    }
  },
  {
    name: 'rbac_list_permissions',
    method: 'GET',
    path: '/api/v1/rbac/permissions',
    description: 'List all permissions for current user',
    requiresAuth: true,
    category: 'RBAC'
  },

  // ==================== ENTITY OPTIONS ====================
  {
    name: 'entity_options_get',
    method: 'GET',
    path: '/api/v1/entity/:type/options',
    description: 'Get dropdown options for entity type',
    requiresAuth: true,
    category: 'Entity',
    parameters: {
      path: {
        type: 'Entity type (project, employee, etc.)'
      }
    }
  },

  // ==================== UPLOAD ====================
  {
    name: 'upload_file',
    method: 'POST',
    path: '/api/v1/upload',
    description: 'Upload file to S3/MinIO',
    requiresAuth: true,
    category: 'Upload'
  },

  // ==================== S3 BACKEND ====================
  {
    name: 's3_get_presigned_url',
    method: 'POST',
    path: '/api/v1/s3-backend/presigned-url',
    description: 'Get presigned URL for file upload',
    requiresAuth: true,
    category: 'S3',
    parameters: {
      body: {
        filename: 'File name',
        content_type: 'File MIME type',
        entity_type: 'Associated entity type',
        entity_id: 'Associated entity ID'
      }
    }
  },
  {
    name: 's3_list_attachments',
    method: 'GET',
    path: '/api/v1/s3-backend/attachments',
    description: 'List attachments for entity',
    requiresAuth: true,
    category: 'S3',
    parameters: {
      query: {
        entity_type: 'Entity type',
        entity_id: 'Entity ID'
      }
    }
  },

  // ==================== WORKFLOW ====================
  {
    name: 'workflow_list',
    method: 'GET',
    path: '/api/v1/workflow',
    description: 'List all workflows',
    requiresAuth: true,
    category: 'Workflow'
  },
  {
    name: 'workflow_automation_list',
    method: 'GET',
    path: '/api/v1/workflow-automation',
    description: 'List workflow automation rules',
    requiresAuth: true,
    category: 'Workflow'
  },

  // ==================== EMAIL TEMPLATE ====================
  {
    name: 'email_template_list',
    method: 'GET',
    path: '/api/v1/email-template',
    description: 'List email templates',
    requiresAuth: true,
    category: 'Email'
  },

  // ==================== TASK DATA ====================
  {
    name: 'task_data_list',
    method: 'GET',
    path: '/api/v1/task-data',
    description: 'List task data records',
    requiresAuth: true,
    category: 'Task'
  },

  // ==================== CHAT (AI Widget) ====================
  {
    name: 'chat_send_message',
    method: 'POST',
    path: '/api/v1/chat/message',
    description: 'Send message to AI chat widget',
    requiresAuth: false,
    category: 'Chat',
    parameters: {
      body: {
        message: 'User message text',
        session_id: 'Chat session ID',
        customer_id: 'Customer ID (optional)'
      }
    }
  },
  {
    name: 'chat_get_history',
    method: 'GET',
    path: '/api/v1/chat/history/:sessionId',
    description: 'Get chat history for session',
    requiresAuth: false,
    category: 'Chat',
    parameters: {
      path: {
        sessionId: 'Chat session ID'
      }
    }
  },
  {
    name: 'chat_disconnect_session',
    method: 'POST',
    path: '/api/v1/chat/session/:sessionId/disconnect',
    description: 'Disconnect and close a chat session (works for both text and voice calls). Call this when the conversation is complete to hang up voice calls or end text chats.',
    requiresAuth: false,
    category: 'Chat',
    parameters: {
      path: {
        sessionId: 'Session ID to disconnect (voice or text chat session ID)'
      },
      body: {
        resolution: 'Resolution status: resolved (default), abandoned, or escalated',
        session_type: 'Session type: auto (default, tries both), voice, or text'
      }
    }
  },

  // ==================== INTERACTION ====================
  {
    name: 'interaction_list',
    method: 'GET',
    path: '/api/v1/interaction',
    description: 'List all customer interactions with filtering',
    requiresAuth: true,
    category: 'Interaction',
    parameters: {
      query: {
        interaction_type: 'Filter by interaction type',
        channel: 'Filter by channel',
        sentiment_label: 'Filter by sentiment',
        priority_level: 'Filter by priority',
        from_date: 'Filter interactions from date',
        to_date: 'Filter interactions to date',
        search: 'Search in content',
        limit: 'Number of results',
        offset: 'Pagination offset'
      }
    }
  },
  {
    name: 'interaction_get',
    method: 'GET',
    path: '/api/v1/interaction/:id',
    description: 'Get single interaction by ID',
    requiresAuth: true,
    category: 'Interaction',
    parameters: {
      path: {
        id: 'Interaction UUID'
      }
    }
  },
  {
    name: 'interaction_create',
    method: 'POST',
    path: '/api/v1/interaction',
    description: 'Create new interaction',
    requiresAuth: true,
    category: 'Interaction',
    parameters: {
      body: {
        interaction_number: 'Unique interaction number',
        interaction_type: 'Type of interaction (voice_call, chat, email, etc.)',
        channel: 'Channel (phone, live_chat, email, etc.)',
        interaction_subtype: 'Subtype (inbound, outbound, etc.)',
        interaction_person_entities: 'Array of person entities involved',
        content_text: 'Interaction content text',
        transcript_text: 'Transcript for voice/video',
        sentiment_score: 'Sentiment score',
        sentiment_label: 'Sentiment label',
        customer_satisfaction_score: 'CSAT score',
        interaction_reason: 'Reason for interaction',
        interaction_category: 'Category',
        priority_level: 'Priority level',
        metadata: 'Additional metadata'
      }
    }
  },
  {
    name: 'interaction_update',
    method: 'PATCH',
    path: '/api/v1/interaction/:id',
    description: 'Update existing interaction',
    requiresAuth: true,
    category: 'Interaction',
    parameters: {
      path: {
        id: 'Interaction UUID'
      },
      body: {
        interaction_intention_entity: 'Entity to create from interaction',
        content_summary: 'Summary of interaction',
        transcript_text: 'Updated transcript',
        sentiment_score: 'Updated sentiment score',
        sentiment_label: 'Updated sentiment label',
        customer_satisfaction_score: 'Updated CSAT score',
        emotion_tags: 'Array of emotion tags',
        interaction_reason: 'Updated reason',
        interaction_category: 'Updated category',
        priority_level: 'Updated priority',
        metadata: 'Updated metadata'
      }
    }
  },
  {
    name: 'interaction_delete',
    method: 'DELETE',
    path: '/api/v1/interaction/:id',
    description: 'Soft delete interaction',
    requiresAuth: true,
    category: 'Interaction',
    parameters: {
      path: {
        id: 'Interaction UUID'
      }
    }
  },

  // ==================== PERSON CALENDAR ====================
  {
    name: 'person_calendar_list',
    method: 'GET',
    path: '/api/v1/person-calendar',
    description: 'List all person calendar slots',
    requiresAuth: true,
    category: 'Calendar',
    parameters: {
      query: {
        availability_flag: 'Filter by availability',
        page: 'Page number',
        limit: 'Number of results'
      }
    }
  },
  {
    name: 'person_calendar_get',
    method: 'GET',
    path: '/api/v1/person-calendar/:id',
    description: 'Get single calendar slot by ID',
    requiresAuth: true,
    category: 'Calendar',
    parameters: {
      path: {
        id: 'Calendar slot UUID'
      }
    }
  },
  {
    name: 'person_calendar_get_available',
    method: 'GET',
    path: '/api/v1/person-calendar/available',
    description: 'Get available calendar slots',
    requiresAuth: true,
    category: 'Calendar'
  },
  {
    name: 'person_calendar_get_booked',
    method: 'GET',
    path: '/api/v1/person-calendar/booked',
    description: 'Get booked calendar slots',
    requiresAuth: true,
    category: 'Calendar'
  },
  {
    name: 'person_calendar_create',
    method: 'POST',
    path: '/api/v1/person-calendar',
    description: 'Create new calendar slot',
    requiresAuth: true,
    category: 'Calendar',
    parameters: {
      body: {
        code: 'Calendar slot code',
        name: 'Calendar slot name',
        person_entity_type: 'Person entity type (employee, customer)',
        person_entity_id: 'Person entity UUID',
        from_ts: 'Start timestamp',
        to_ts: 'End timestamp',
        availability_flag: 'Is slot available',
        title: 'Slot title',
        appointment_medium: 'Appointment medium',
        appointment_addr: 'Appointment address',
        instructions: 'Instructions',
        metadata: 'Additional metadata'
      }
    }
  },
  {
    name: 'person_calendar_update',
    method: 'PATCH',
    path: '/api/v1/person-calendar/:id',
    description: 'Update calendar slot',
    requiresAuth: true,
    category: 'Calendar',
    parameters: {
      path: {
        id: 'Calendar slot UUID'
      },
      body: {
        name: 'Updated name',
        from_ts: 'Updated start timestamp',
        to_ts: 'Updated end timestamp',
        availability_flag: 'Updated availability',
        title: 'Updated title',
        metadata: 'Updated metadata'
      }
    }
  },
  {
    name: 'person_calendar_book',
    method: 'POST',
    path: '/api/v1/person-calendar/book',
    description: 'Book a calendar slot',
    requiresAuth: true,
    category: 'Calendar',
    parameters: {
      body: {
        slot_id: 'Calendar slot UUID to book',
        customer_id: 'Customer UUID',
        event_details: 'Event details'
      }
    }
  },
  {
    name: 'person_calendar_delete',
    method: 'DELETE',
    path: '/api/v1/person-calendar/:id',
    description: 'Soft delete calendar slot',
    requiresAuth: true,
    category: 'Calendar',
    parameters: {
      path: {
        id: 'Calendar slot UUID'
      }
    }
  },

  // ==================== HEALTH ====================
  {
    name: 'health_check',
    method: 'GET',
    path: '/api/health',
    description: 'Health check endpoint',
    requiresAuth: false,
    category: 'System'
  },

  // ==================== CONFIG ====================
  {
    name: 'config_get',
    method: 'GET',
    path: '/api/v1/config',
    description: 'Get system configuration',
    requiresAuth: true,
    category: 'System'
  }
];

// Export categories for easy filtering
export const API_CATEGORIES = [
  'Authentication',
  'Project',
  'Task',
  'Employee',
  'Business',
  'Office',
  'Customer',
  'Worksite',
  'Role',
  'Position',
  'Wiki',
  'Form',
  'Artifact',
  'Reports',
  'Product',
  'Sales',
  'Operations',
  'Inventory',
  'Order',
  'Shipment',
  'Financial',
  'Settings',
  'Linkage',
  'RBAC',
  'Entity',
  'Upload',
  'S3',
  'Workflow',
  'Email',
  'Interaction',
  'Calendar',
  'Chat',
  'System'
] as const;

// Helper function to get endpoints by category
export function getEndpointsByCategory(category: string): APIEndpoint[] {
  return API_MANIFEST.filter(endpoint => endpoint.category === category);
}

// Helper function to search endpoints
export function searchEndpoints(query: string): APIEndpoint[] {
  const lowerQuery = query.toLowerCase();
  return API_MANIFEST.filter(endpoint =>
    endpoint.name.toLowerCase().includes(lowerQuery) ||
    endpoint.path.toLowerCase().includes(lowerQuery) ||
    endpoint.description.toLowerCase().includes(lowerQuery)
  );
}

// Export total count
export const TOTAL_API_ENDPOINTS = API_MANIFEST.length;
