// ============================================================================
// UNIVERSAL ENTITY CONFIG
// ============================================================================
//
// Single source of truth for all entity schemas, driving:
// - API endpoint generation and validation
// - Database queries and field mapping
// - Frontend form generation and display
// - Type safety across the entire stack
//
// This config is parsed by both backend (API schema generation) and frontend
// (dynamic form creation) to ensure consistency and eliminate duplication.

export type FieldType = 
  | 'uuid' | 'string' | 'text' | 'number' | 'boolean' | 'date' | 'datetime' 
  | 'array' | 'json' | 'email' | 'phone' | 'currency' | 'percentage' | 'geometry';

export type InputType = 
  | 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'datetime' 
  | 'select' | 'multiselect' | 'relationship' | 'tags' | 'json' | 'currency'
  | 'email' | 'phone' | 'checkbox' | 'radio' | 'file' | 'coordinates';

export interface FieldConfig {
  // Database mapping
  ddlColumn: string;
  apiField: string;
  
  // Type information
  type: FieldType;
  required?: boolean;
  generated?: boolean;
  hidden?: boolean;
  
  // UI configuration
  label: string;
  placeholder?: string;
  inputType?: InputType;
  description?: string;
  
  // Validation rules
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp | string;
    unique?: boolean;
  };
  
  // Options for select/radio inputs
  options?: { value: any; label: string }[];
  
  // Relationship configuration
  relationshipConfig?: {
    entity: string;
    endpoint: string;
    displayField: string;
    valueField: string;
    allowEmpty?: boolean;
    multiple?: boolean;
  };
  
  // Default values
  defaultValue?: any;
  
  // Array configuration
  itemType?: FieldType;
  
  // Display configuration
  sortable?: boolean;
  filterable?: boolean;
  searchable?: boolean;
}

export interface EntityConfig {
  // Database configuration
  table: string;
  primaryKey: string;
  
  // API configuration
  apiEndpoint: string;
  displayName: string;
  displayNamePlural?: string;
  
  // UI configuration
  icon?: string;
  description?: string;
  
  // Field definitions
  fields: Record<string, FieldConfig>;
  
  // Table configuration for data display
  listView?: {
    defaultSort?: string;
    defaultSortOrder?: 'asc' | 'desc';
    searchFields?: string[];
    filterFields?: string[];
    displayFields?: string[];
    itemsPerPage?: number;
  };
  
  // Form configuration
  createForm?: {
    sections?: Array<{
      title: string;
      fields: string[];
    }>;
    excludeFields?: string[];
  };
  
  // Permissions
  permissions?: {
    create?: string[];
    read?: string[];
    update?: string[];
    delete?: string[];
  };
}

// ============================================================================
// ENTITY CONFIGURATIONS
// ============================================================================

export const ENTITY_CONFIG: Record<string, EntityConfig> = {
  // BUSINESS (biz)
  business: {
    table: 'app.business',
    primaryKey: 'id',
    apiEndpoint: '/api/v1/biz',
    displayName: 'Business Unit',
    displayNamePlural: 'Business Units',
    icon: 'building-2',
    description: 'Business organizational hierarchy with 3-level structure (Department → Division → Corporate)',

    fields: {
      id: {
        ddlColumn: 'id',
        apiField: 'id',
        type: 'uuid',
        generated: true,
        hidden: true,
        label: 'ID'
      },
      code: {
        ddlColumn: 'code',
        apiField: 'code',
        type: 'string',
        required: true,
        label: 'Business Code',
        placeholder: 'e.g., LAND-DEPT',
        validation: { minLength: 1, maxLength: 50, unique: true },
        sortable: true
      },
      name: {
        ddlColumn: 'name',
        apiField: 'name',
        type: 'string',
        required: true,
        label: 'Business Unit Name',
        placeholder: 'Enter business unit name',
        validation: { minLength: 1, maxLength: 200 },
        sortable: true,
        filterable: true,
        searchable: true
      },
      descr: {
        ddlColumn: 'descr',
        apiField: 'descr',
        type: 'text',
        label: 'Description',
        placeholder: 'Describe the business unit',
        inputType: 'textarea',
        searchable: true
      },
      metadata: {
        ddlColumn: 'metadata',
        apiField: 'metadata',
        type: 'json',
        label: 'Metadata',
        inputType: 'json',
        defaultValue: {}
      },
      active_flag: {
        ddlColumn: 'active_flag',
        apiField: 'activeFlag',
        type: 'boolean',
        label: 'Active',
        inputType: 'checkbox',
        defaultValue: true,
        filterable: true
      },
      parent_id: {
        ddlColumn: 'parent_id',
        apiField: 'parentId',
        type: 'uuid',
        label: 'Parent Business Unit',
        inputType: 'relationship',
        relationshipConfig: {
          entity: 'business',
          endpoint: '/api/v1/biz',
          displayField: 'name',
          valueField: 'id',
          allowEmpty: true
        }
      },
      level_name: {
        ddlColumn: 'level_name',
        apiField: 'levelName',
        type: 'string',
        required: true,
        label: 'Level Name',
        inputType: 'select',
        options: [
          { value: 'Department', label: 'Department' },
          { value: 'Division', label: 'Division' },
          { value: 'Corporate', label: 'Corporate' }
        ],
        filterable: true,
        sortable: true
      },
      office_id: {
        ddlColumn: 'office_id',
        apiField: 'officeId',
        type: 'uuid',
        label: 'Office',
        inputType: 'relationship',
        relationshipConfig: {
          entity: 'office',
          endpoint: '/api/v1/office',
          displayField: 'name',
          valueField: 'id',
          allowEmpty: true
        }
      },
      budget_allocated_amt: {
        ddlColumn: 'budget_allocated_amt',
        apiField: 'budgetAllocatedAmt',
        type: 'number',
        label: 'Budget Allocated (CAD)',
        inputType: 'currency',
        validation: { min: 0 },
        sortable: true
      },
      manager_employee_id: {
        ddlColumn: 'manager_employee_id',
        apiField: 'managerEmployeeId',
        type: 'uuid',
        label: 'Manager',
        inputType: 'relationship',
        relationshipConfig: {
          entity: 'employee',
          endpoint: '/api/v1/employee',
          displayField: 'name',
          valueField: 'id',
          allowEmpty: true
        }
      },
      from_ts: {
        ddlColumn: 'from_ts',
        apiField: 'fromTs',
        type: 'datetime',
        generated: true,
        label: 'From Date',
        sortable: true
      },
      to_ts: {
        ddlColumn: 'to_ts',
        apiField: 'toTs',
        type: 'datetime',
        label: 'To Date',
        sortable: true
      },
      created_ts: {
        ddlColumn: 'created_ts',
        apiField: 'createdTs',
        type: 'datetime',
        generated: true,
        label: 'Created',
        sortable: true
      },
      updated_ts: {
        ddlColumn: 'updated_ts',
        apiField: 'updatedTs',
        type: 'datetime',
        generated: true,
        label: 'Updated',
        sortable: true
      },
      version: {
        ddlColumn: 'version',
        apiField: 'version',
        type: 'number',
        generated: true,
        label: 'Version',
        defaultValue: 1
      }
    },

    listView: {
      defaultSort: 'name',
      defaultSortOrder: 'asc',
      searchFields: ['name', 'descr', 'code'],
      filterFields: ['level_name', 'active_flag'],
      displayFields: ['name', 'code', 'level_name', 'budget_allocated_amt'],
      itemsPerPage: 25
    },

    createForm: {
      sections: [
        {
          title: 'Basic Information',
          fields: ['name', 'code', 'descr']
        },
        {
          title: 'Organization',
          fields: ['level_name', 'parent_id', 'office_id']
        },
        {
          title: 'Financial & Management',
          fields: ['budget_allocated_amt', 'manager_employee_id']
        },
        {
          title: 'Additional',
          fields: ['metadata', 'active_flag']
        }
      ]
    }
  },

  // OFFICE (location)
  office: {
    table: 'app.office',
    primaryKey: 'id',
    apiEndpoint: '/api/v1/office',
    displayName: 'Office',
    displayNamePlural: 'Offices',
    icon: 'map-pin',
    description: 'Physical office locations with 4-level hierarchy (Office → District → Region → Corporate)',
    
    fields: {
      id: {
        ddlColumn: 'id',
        apiField: 'id',
        type: 'uuid',
        generated: true,
        hidden: true,
        label: 'ID'
      },
      name: {
        ddlColumn: 'name',
        apiField: 'name',
        type: 'string',
        required: true,
        label: 'Location Name',
        placeholder: 'Enter location name',
        validation: { minLength: 1, maxLength: 255 },
        sortable: true,
        searchable: true
      },
      description: {
        ddlColumn: 'descr',
        apiField: 'descr',
        type: 'text',
        label: 'Description',
        placeholder: 'Describe the location',
        inputType: 'textarea',
        searchable: true
      },
      address: {
        ddlColumn: 'addr',
        apiField: 'addr',
        type: 'text',
        label: 'Address',
        placeholder: 'Physical address',
        inputType: 'textarea'
      },
      postalCode: {
        ddlColumn: 'postal_code',
        apiField: 'postalCode',
        type: 'string',
        label: 'Postal Code',
        placeholder: 'e.g., M5V 3A8',
        validation: { pattern: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/ }
      },
      countryCode: {
        ddlColumn: 'country_code',
        apiField: 'countryCode',
        type: 'string',
        label: 'Country',
        inputType: 'select',
        defaultValue: 'CA',
        options: [
          { value: 'CA', label: 'Canada' },
          { value: 'US', label: 'United States' }
        ]
      },
      provinceCode: {
        ddlColumn: 'province_code',
        apiField: 'provinceCode',
        type: 'string',
        label: 'Province/State',
        inputType: 'select',
        options: [
          { value: 'ON', label: 'Ontario' },
          { value: 'QC', label: 'Quebec' },
          { value: 'BC', label: 'British Columbia' },
          { value: 'AB', label: 'Alberta' }
        ],
        filterable: true
      },
      timeZone: {
        ddlColumn: 'time_zone',
        apiField: 'timeZone',
        type: 'string',
        label: 'Time Zone',
        defaultValue: 'America/Toronto',
        inputType: 'select',
        options: [
          { value: 'America/Toronto', label: 'Eastern Time' },
          { value: 'America/Winnipeg', label: 'Central Time' },
          { value: 'America/Vancouver', label: 'Pacific Time' }
        ]
      },
      currencyCode: {
        ddlColumn: 'currency_code',
        apiField: 'currencyCode',
        type: 'string',
        label: 'Currency',
        defaultValue: 'CAD',
        inputType: 'select',
        options: [
          { value: 'CAD', label: 'Canadian Dollar (CAD)' },
          { value: 'USD', label: 'US Dollar (USD)' }
        ]
      },
      languagePrimary: {
        ddlColumn: 'language_primary',
        apiField: 'languagePrimary',
        type: 'string',
        label: 'Primary Language',
        defaultValue: 'en',
        inputType: 'select',
        options: [
          { value: 'en', label: 'English' },
          { value: 'fr', label: 'French' }
        ]
      },
      languageSecondary: {
        ddlColumn: 'language_secondary',
        apiField: 'languageSecondary',
        type: 'string',
        label: 'Secondary Language',
        inputType: 'select',
        options: [
          { value: 'en', label: 'English' },
          { value: 'fr', label: 'French' }
        ]
      },
      levelId: {
        ddlColumn: 'level_id',
        apiField: 'levelId',
        type: 'number',
        required: true,
        label: 'Location Level',
        inputType: 'select',
        options: [
          { value: 0, label: 'Corp-Region (Level 0)' },
          { value: 1, label: 'Country (Level 1)' },
          { value: 2, label: 'Province (Level 2)' },
          { value: 3, label: 'Economic Region (Level 3)' },
          { value: 4, label: 'Metropolitan Area (Level 4)' },
          { value: 5, label: 'City (Level 5)' },
          { value: 6, label: 'District (Level 6)' },
          { value: 7, label: 'Address (Level 7)' }
        ],
        validation: { min: 0, max: 7 },
        filterable: true
      },
      levelName: {
        ddlColumn: 'level_name',
        apiField: 'levelName',
        type: 'string',
        required: true,
        label: 'Level Name'
      },
      parentId: {
        ddlColumn: 'parent_id',
        apiField: 'parentId',
        type: 'uuid',
        label: 'Parent Location',
        inputType: 'relationship',
        relationshipConfig: {
          entity: 'location',
          endpoint: '/api/v1/scope/location',
          displayField: 'name',
          valueField: 'id',
          allowEmpty: true
        }
      },
      active_flag: {
        ddlColumn: 'active_flag',
        apiField: 'activeFlag',
        type: 'boolean',
        label: 'Active',
        inputType: 'checkbox',
        defaultValue: true,
        filterable: true
      },
      tags: {
        ddlColumn: 'tags',
        apiField: 'tags',
        type: 'array',
        itemType: 'string',
        label: 'Tags',
        inputType: 'tags',
        defaultValue: []
      },
      created_ts: {
        ddlColumn: 'created_ts',
        apiField: 'createdTs',
        type: 'datetime',
        generated: true,
        label: 'Created'
      },
      updated_ts: {
        ddlColumn: 'updated_ts',
        apiField: 'updatedTs',
        type: 'datetime',
        generated: true,
        label: 'Updated'
      }
    },

    listView: {
      defaultSort: 'name',
      searchFields: ['name', 'description', 'address'],
      filterFields: ['levelId', 'provinceCode', 'active_flag'],
      displayFields: ['name', 'levelName', 'address', 'provinceCode'],
      itemsPerPage: 25
    }
  },

  // PROJECT
  project: {
    table: 'app.project',
    primaryKey: 'id',
    apiEndpoint: '/api/v1/project',
    displayName: 'Project',
    displayNamePlural: 'Projects',
    icon: 'folder',
    description: 'Project management with budget tracking, timelines, and team assignments',
    
    fields: {
      id: {
        ddlColumn: 'id',
        apiField: 'id',
        type: 'uuid',
        generated: true,
        hidden: true,
        label: 'ID'
      },
      name: {
        ddlColumn: 'name',
        apiField: 'name',
        type: 'string',
        required: true,
        label: 'Project Name',
        placeholder: 'Enter project name',
        validation: { minLength: 1, maxLength: 255 },
        sortable: true,
        searchable: true
      },
      description: {
        ddlColumn: 'descr',
        apiField: 'descr',
        type: 'text',
        label: 'Description',
        placeholder: 'Describe the project',
        inputType: 'textarea',
        searchable: true
      },
      projectCode: {
        ddlColumn: 'project_code',
        apiField: 'projectCode',
        type: 'string',
        required: true,
        label: 'Project Code',
        placeholder: 'e.g., PROJ-2025-001',
        validation: { pattern: /^[A-Z0-9-]+$/, unique: true },
        sortable: true
      },
      slug: {
        ddlColumn: 'slug',
        apiField: 'slug',
        type: 'string',
        label: 'URL Slug',
        placeholder: 'project-url-slug',
        validation: { pattern: /^[a-z0-9-]+$/, unique: true }
      },
      projectType: {
        ddlColumn: 'project_type',
        apiField: 'projectType',
        type: 'string',
        label: 'Project Type',
        inputType: 'select',
        defaultValue: 'development',
        options: [
          { value: 'development', label: 'Development' },
          { value: 'maintenance', label: 'Maintenance' },
          { value: 'expansion', label: 'Expansion' },
          { value: 'seasonal', label: 'Seasonal' },
          { value: 'service', label: 'Service' },
          { value: 'installation', label: 'Installation' }
        ],
        filterable: true
      },
      priorityLevel: {
        ddlColumn: 'priority_level',
        apiField: 'priorityLevel',
        type: 'string',
        label: 'Priority Level',
        inputType: 'select',
        defaultValue: 'medium',
        options: [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
          { value: 'critical', label: 'Critical' }
        ],
        filterable: true
      },
      businessId: {
        ddlColumn: 'business_id',
        apiField: 'businessId',
        type: 'uuid',
        required: true,
        label: 'Business Unit',
        inputType: 'relationship',
        relationshipConfig: {
          entity: 'business',
          endpoint: '/api/v1/scope/business',
          displayField: 'name',
          valueField: 'id'
        },
        filterable: true
      },
      budgetAllocated: {
        ddlColumn: 'budget_allocated_amt',
        apiField: 'budgetAllocated',
        type: 'number',
        label: 'Budget Allocated',
        inputType: 'currency',
        validation: { min: 0 },
        sortable: true
      },
      budgetCurrency: {
        ddlColumn: 'budget_currency',
        apiField: 'budgetCurrency',
        type: 'string',
        label: 'Budget Currency',
        defaultValue: 'CAD',
        inputType: 'select',
        options: [
          { value: 'CAD', label: 'CAD' },
          { value: 'USD', label: 'USD' }
        ]
      },
      plannedStartDate: {
        ddlColumn: 'planned_start_date',
        apiField: 'plannedStartDate',
        type: 'date',
        label: 'Planned Start Date',
        inputType: 'date'
      },
      plannedEndDate: {
        ddlColumn: 'planned_end_date',
        apiField: 'plannedEndDate',
        type: 'date',
        label: 'Planned End Date',
        inputType: 'date'
      },
      actualStartDate: {
        ddlColumn: 'actual_start_date',
        apiField: 'actualStartDate',
        type: 'date',
        label: 'Actual Start Date',
        inputType: 'date'
      },
      actualEndDate: {
        ddlColumn: 'actual_end_date',
        apiField: 'actualEndDate',
        type: 'date',
        label: 'Actual End Date',
        inputType: 'date'
      },
      estimatedHours: {
        ddlColumn: 'estimated_hours',
        apiField: 'estimatedHours',
        type: 'number',
        label: 'Estimated Hours',
        validation: { min: 0 }
      },
      actualHours: {
        ddlColumn: 'actual_hours',
        apiField: 'actualHours',
        type: 'number',
        label: 'Actual Hours',
        validation: { min: 0 }
      },
      projectStage: {
        ddlColumn: 'project_stage',
        apiField: 'projectStage',
        type: 'string',
        label: 'Project Stage',
        inputType: 'select',
        options: [
          { value: 'planning', label: 'Planning' },
          { value: 'design', label: 'Design' },
          { value: 'implementation', label: 'Implementation' },
          { value: 'testing', label: 'Testing' },
          { value: 'deployment', label: 'Deployment' },
          { value: 'completed', label: 'Completed' }
        ],
        filterable: true
      },
      projectStatus: {
        ddlColumn: 'project_status',
        apiField: 'projectStatus',
        type: 'string',
        label: 'Project Status',
        inputType: 'select',
        options: [
          { value: 'draft', label: 'Draft' },
          { value: 'active', label: 'Active' },
          { value: 'on_hold', label: 'On Hold' },
          { value: 'cancelled', label: 'Cancelled' },
          { value: 'completed', label: 'Completed' }
        ],
        filterable: true
      },
      securityClassification: {
        ddlColumn: 'security_classification',
        apiField: 'securityClassification',
        type: 'string',
        label: 'Security Classification',
        inputType: 'select',
        defaultValue: 'internal',
        options: [
          { value: 'public', label: 'Public' },
          { value: 'internal', label: 'Internal' },
          { value: 'confidential', label: 'Confidential' },
          { value: 'restricted', label: 'Restricted' }
        ]
      },
      tags: {
        ddlColumn: 'tags',
        apiField: 'tags',
        type: 'array',
        itemType: 'string',
        label: 'Tags',
        inputType: 'tags',
        defaultValue: []
      },
      active_flag: {
        ddlColumn: 'active_flag',
        apiField: 'activeFlag',
        type: 'boolean',
        label: 'Active',
        inputType: 'checkbox',
        defaultValue: true,
        filterable: true
      },
      created_ts: {
        ddlColumn: 'created_ts',
        apiField: 'createdTs',
        type: 'datetime',
        generated: true,
        label: 'Created',
        sortable: true
      },
      updated_ts: {
        ddlColumn: 'updated_ts',
        apiField: 'updatedTs',
        type: 'datetime',
        generated: true,
        label: 'Updated',
        sortable: true
      }
    },

    listView: {
      defaultSort: 'created_ts',
      defaultSortOrder: 'desc',
      searchFields: ['name', 'description', 'projectCode'],
      filterFields: ['projectType', 'priorityLevel', 'projectStage', 'projectStatus', 'active_flag'],
      displayFields: ['name', 'projectCode', 'projectType', 'priorityLevel', 'projectStage', 'budgetAllocated'],
      itemsPerPage: 25
    },
    
    createForm: {
      sections: [
        {
          title: 'Basic Information',
          fields: ['name', 'description', 'projectCode', 'slug']
        },
        {
          title: 'Project Details',
          fields: ['projectType', 'priorityLevel', 'businessId', 'securityClassification']
        },
        {
          title: 'Budget & Timeline',
          fields: ['budgetAllocated', 'budgetCurrency', 'plannedStartDate', 'plannedEndDate']
        },
        {
          title: 'Estimation',
          fields: ['estimatedHours', 'projectStage', 'projectStatus']
        },
        {
          title: 'Additional',
          fields: ['tags', 'active_flag']
        }
      ]
    }
  },

  // EMPLOYEE
  employee: {
    table: 'app.employee',
    primaryKey: 'id',
    apiEndpoint: '/api/v1/employee',
    displayName: 'Employee',
    displayNamePlural: 'Employees',
    icon: 'user',
    description: 'Employee identity and HR management',
    
    fields: {
      id: {
        ddlColumn: 'id',
        apiField: 'id',
        type: 'uuid',
        generated: true,
        hidden: true,
        label: 'ID'
      },
      name: {
        ddlColumn: 'name',
        apiField: 'name',
        type: 'string',
        required: true,
        label: 'Full Name',
        placeholder: 'Enter full name',
        validation: { minLength: 1, maxLength: 255 },
        sortable: true,
        searchable: true
      },
      description: {
        ddlColumn: 'descr',
        apiField: 'descr',
        type: 'text',
        label: 'Description',
        placeholder: 'Employee description',
        inputType: 'textarea'
      },
      email: {
        ddlColumn: 'email',
        apiField: 'email',
        type: 'email',
        required: true,
        label: 'Email Address',
        placeholder: 'name@company.com',
        inputType: 'email',
        validation: { unique: true },
        sortable: true,
        searchable: true
      },
      phone: {
        ddlColumn: 'phone',
        apiField: 'phone',
        type: 'phone',
        label: 'Phone Number',
        placeholder: '+1-555-123-4567',
        inputType: 'phone'
      },
      mobile: {
        ddlColumn: 'mobile',
        apiField: 'mobile',
        type: 'phone',
        label: 'Mobile Number',
        placeholder: '+1-555-123-4567',
        inputType: 'phone'
      },
      address: {
        ddlColumn: 'addr',
        apiField: 'addr',
        type: 'text',
        label: 'Address',
        placeholder: 'Home address',
        inputType: 'textarea'
      },
      employeeCode: {
        ddlColumn: 'emp_code',
        apiField: 'empCode',
        type: 'string',
        label: 'Employee Code',
        placeholder: 'EMP001',
        validation: { unique: true }
      },
      hireDate: {
        ddlColumn: 'hire_date',
        apiField: 'hireDate',
        type: 'date',
        label: 'Hire Date',
        inputType: 'date'
      },
      birthDate: {
        ddlColumn: 'birth_date',
        apiField: 'birthDate',
        type: 'date',
        label: 'Birth Date',
        inputType: 'date'
      },
      status: {
        ddlColumn: 'status',
        apiField: 'status',
        type: 'string',
        label: 'Employment Status',
        inputType: 'select',
        defaultValue: 'active',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
          { value: 'on_leave', label: 'On Leave' },
          { value: 'terminated', label: 'Terminated' }
        ],
        filterable: true
      },
      employmentType: {
        ddlColumn: 'employment_type',
        apiField: 'employmentType',
        type: 'string',
        label: 'Employment Type',
        inputType: 'select',
        defaultValue: 'full_time',
        options: [
          { value: 'full_time', label: 'Full Time' },
          { value: 'part_time', label: 'Part Time' },
          { value: 'contractor', label: 'Contractor' },
          { value: 'contingent', label: 'Contingent' },
          { value: 'intern', label: 'Intern' },
          { value: 'co-op', label: 'Co-op' }
        ],
        filterable: true
      },
      workMode: {
        ddlColumn: 'work_mode',
        apiField: 'workMode',
        type: 'string',
        label: 'Work Mode',
        inputType: 'select',
        defaultValue: 'office',
        options: [
          { value: 'office', label: 'Office' },
          { value: 'remote', label: 'Remote' },
          { value: 'hybrid', label: 'Hybrid' },
          { value: 'field', label: 'Field' }
        ],
        filterable: true
      },
      securityClearance: {
        ddlColumn: 'security_clearance',
        apiField: 'securityClearance',
        type: 'string',
        label: 'Security Clearance',
        inputType: 'select',
        defaultValue: 'internal',
        options: [
          { value: 'public', label: 'Public' },
          { value: 'internal', label: 'Internal' },
          { value: 'confidential', label: 'Confidential' },
          { value: 'secret', label: 'Secret' }
        ]
      },
      language: {
        ddlColumn: 'lang',
        apiField: 'lang',
        type: 'string',
        label: 'Primary Language',
        inputType: 'select',
        defaultValue: 'en',
        options: [
          { value: 'en', label: 'English' },
          { value: 'fr', label: 'French' }
        ]
      },
      skills: {
        ddlColumn: 'skills',
        apiField: 'skills',
        type: 'array',
        itemType: 'string',
        label: 'Skills',
        inputType: 'tags',
        defaultValue: []
      },
      certifications: {
        ddlColumn: 'certifications',
        apiField: 'certifications',
        type: 'json',
        label: 'Certifications',
        inputType: 'json',
        defaultValue: []
      },
      education: {
        ddlColumn: 'education',
        apiField: 'education',
        type: 'json',
        label: 'Education',
        inputType: 'json',
        defaultValue: []
      },
      emergencyContact: {
        ddlColumn: 'emergency_contact',
        apiField: 'emergencyContact',
        type: 'json',
        label: 'Emergency Contact',
        inputType: 'json',
        defaultValue: {}
      },
      active_flag: {
        ddlColumn: 'active_flag',
        apiField: 'activeFlag',
        type: 'boolean',
        label: 'Active',
        inputType: 'checkbox',
        defaultValue: true,
        filterable: true
      },
      tags: {
        ddlColumn: 'tags',
        apiField: 'tags',
        type: 'array',
        itemType: 'string',
        label: 'Tags',
        inputType: 'tags',
        defaultValue: []
      },
      created_ts: {
        ddlColumn: 'created_ts',
        apiField: 'createdTs',
        type: 'datetime',
        generated: true,
        label: 'Created'
      },
      updated_ts: {
        ddlColumn: 'updated_ts',
        apiField: 'updatedTs',
        type: 'datetime',
        generated: true,
        label: 'Updated'
      }
    },

    listView: {
      defaultSort: 'name',
      searchFields: ['name', 'email', 'employeeCode'],
      filterFields: ['status', 'employmentType', 'workMode', 'active_flag'],
      displayFields: ['name', 'email', 'employmentType', 'status', 'workMode'],
      itemsPerPage: 25
    },
    
    createForm: {
      sections: [
        {
          title: 'Personal Information',
          fields: ['name', 'description', 'email', 'phone', 'mobile', 'address']
        },
        {
          title: 'Employment Details',
          fields: ['employeeCode', 'hireDate', 'status', 'employmentType', 'workMode']
        },
        {
          title: 'Professional',
          fields: ['securityClearance', 'language', 'skills', 'certifications', 'education']
        },
        {
          title: 'Emergency & Additional',
          fields: ['emergencyContact', 'tags', 'active']
        }
      ]
    }
  },

  // ROLE
  role: {
    table: 'app.role',
    primaryKey: 'id',
    apiEndpoint: '/api/v1/role',
    displayName: 'Role',
    displayNamePlural: 'Roles',
    icon: 'shield',
    description: 'Role-based access control and permission management',
    
    fields: {
      id: {
        ddlColumn: 'id',
        apiField: 'id',
        type: 'uuid',
        generated: true,
        hidden: true,
        label: 'ID'
      },
      name: {
        ddlColumn: 'name',
        apiField: 'name',
        type: 'string',
        required: true,
        label: 'Role Name',
        placeholder: 'Enter role name',
        validation: { minLength: 1, maxLength: 255, unique: true },
        sortable: true,
        searchable: true
      },
      description: {
        ddlColumn: 'descr',
        apiField: 'descr',
        type: 'text',
        label: 'Description',
        placeholder: 'Describe the role responsibilities',
        inputType: 'textarea',
        searchable: true
      },
      roleType: {
        ddlColumn: 'role_type',
        apiField: 'roleType',
        type: 'string',
        label: 'Role Type',
        inputType: 'select',
        defaultValue: 'functional',
        options: [
          { value: 'functional', label: 'Functional' },
          { value: 'administrative', label: 'Administrative' },
          { value: 'temporary', label: 'Temporary' },
          { value: 'executive', label: 'Executive' }
        ],
        filterable: true
      },
      roleCategory: {
        ddlColumn: 'role_category',
        apiField: 'roleCategory',
        type: 'string',
        label: 'Role Category',
        placeholder: 'e.g., Management, Technical, Support',
        filterable: true
      },
      authorityLevel: {
        ddlColumn: 'authority_level',
        apiField: 'authorityLevel',
        type: 'string',
        label: 'Authority Level',
        inputType: 'select',
        defaultValue: 'standard',
        options: [
          { value: 'basic', label: 'Basic' },
          { value: 'standard', label: 'Standard' },
          { value: 'elevated', label: 'Elevated' },
          { value: 'administrative', label: 'Administrative' }
        ],
        filterable: true
      },
      approvalLimit: {
        ddlColumn: 'approval_limit',
        apiField: 'approvalLimit',
        type: 'number',
        label: 'Approval Limit (CAD)',
        inputType: 'currency',
        validation: { min: 0 }
      },
      delegationAllowed: {
        ddlColumn: 'delegation_allowed',
        apiField: 'delegationAllowed',
        type: 'boolean',
        label: 'Delegation Allowed',
        inputType: 'checkbox',
        defaultValue: false
      },
      active_flag: {
        ddlColumn: 'active_flag',
        apiField: 'activeFlag',
        type: 'boolean',
        label: 'Active',
        inputType: 'checkbox',
        defaultValue: true,
        filterable: true
      },
      tags: {
        ddlColumn: 'tags',
        apiField: 'tags',
        type: 'array',
        itemType: 'string',
        label: 'Tags',
        inputType: 'tags',
        defaultValue: []
      },
      created_ts: {
        ddlColumn: 'created_ts',
        apiField: 'createdTs',
        type: 'datetime',
        generated: true,
        label: 'Created'
      },
      updated_ts: {
        ddlColumn: 'updated_ts',
        apiField: 'updatedTs',
        type: 'datetime',
        generated: true,
        label: 'Updated'
      }
    },

    listView: {
      defaultSort: 'name',
      searchFields: ['name', 'description', 'roleCategory'],
      filterFields: ['roleType', 'authorityLevel', 'active_flag'],
      displayFields: ['name', 'roleType', 'roleCategory', 'authorityLevel', 'approvalLimit'],
      itemsPerPage: 25
    },
    
    createForm: {
      sections: [
        {
          title: 'Basic Information',
          fields: ['name', 'description', 'roleType', 'roleCategory']
        },
        {
          title: 'Authority & Permissions',
          fields: ['authorityLevel', 'approvalLimit', 'delegationAllowed']
        },
        {
          title: 'Additional',
          fields: ['tags', 'active_flag']
        }
      ]
    }
  }
};

// Helper functions for working with entity configs
export const getEntityConfig = (entityName: string): EntityConfig | undefined => {
  return ENTITY_CONFIG[entityName];
};

export const getEntityFieldConfig = (entityName: string, fieldName: string): FieldConfig | undefined => {
  return ENTITY_CONFIG[entityName]?.fields[fieldName];
};

export const getAllEntityNames = (): string[] => {
  return Object.keys(ENTITY_CONFIG);
};

export const getEntityDisplayFields = (entityName: string): string[] => {
  return ENTITY_CONFIG[entityName]?.listView?.displayFields || [];
};

export const getEntityCreateFields = (entityName: string): string[] => {
  const config = ENTITY_CONFIG[entityName];
  if (!config) return [];
  
  return Object.keys(config.fields).filter(fieldName => {
    const field = config.fields[fieldName];
    return !field.generated && !field.hidden;
  });
};