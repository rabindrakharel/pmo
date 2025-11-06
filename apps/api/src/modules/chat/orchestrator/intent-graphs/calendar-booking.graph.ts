/**
 * Calendar Booking Intent Graph
 * Workflow for booking landscaping/service appointments
 * @module orchestrator/intent-graphs/calendar-booking
 */

import type { IntentGraph } from '../types/intent-graph.types.js';

export const CalendarBookingGraph: IntentGraph = {
  name: 'CalendarBooking',
  description: 'Book a service appointment (landscaping, HVAC, plumbing, etc.)',
  version: 'v1.0',
  startNode: 'identify_customer',

  boundaries: {
    allowedTopics: [
      'booking',
      'scheduling',
      'appointments',
      'services',
      'landscaping',
      'HVAC',
      'plumbing',
      'electrical',
      'contracting',
      'availability',
      'calendar',
      'time slots'
    ],
    forbiddenTopics: [
      'weather',
      'news',
      'general knowledge',
      'unrelated services',
      'other companies'
    ],
    maxTurns: 20,
    canPause: true,
    canCancel: true,
    customRules: [
      'Never create booking without explicit user confirmation',
      'Always verify customer identity before proceeding',
      'Maintain empathetic tone when customer describes issues'
    ]
  },

  requiredPermissions: ['customer:read', 'customer:write', 'booking:write', 'employee:read'],

  nodes: {
    // ========================================
    // NODE 1: Identify Customer
    // ========================================
    identify_customer: {
      id: 'identify_customer',
      name: 'Identify Customer',
      description: 'Search for existing customer or identify as new customer',
      agentRoles: ['worker'],

      requiredState: [],
      producesState: ['customer_id', 'customer_name', 'is_new_customer'],

      actions: [
        {
          type: 'collect_data',
          collectFields: [
            {
              key: 'customer_name',
              type: 'string',
              required: true,
              prompt: 'Can I get your name?'
            },
            {
              key: 'customer_phone',
              type: 'string',
              required: true,
              prompt: 'And your phone number?',
              validation: '^[0-9]{10}$|^\\+?1?[0-9]{10}$'
            }
          ]
        },
        {
          type: 'mcp_call',
          mcpTool: 'customer_list',
          inputMapping: {
            phone: 'customer_phone'
          },
          outputMapping: {
            customer_id: 'customers[0].id',
            customer_name: 'customers[0].name',
            customer_email: 'customers[0].primary_email',
            customer_address: 'customers[0].primary_address'
          }
        }
      ],

      validations: [
        {
          type: 'required_fields',
          fields: ['customer_name', 'customer_phone'],
          errorMessage: 'Customer name and phone are required to proceed',
          blocking: true
        },
        {
          type: 'mcp_success',
          errorMessage: 'Failed to search for customer',
          blocking: true
        }
      ],

      transitions: [
        {
          toNode: 'welcome_existing',
          condition: 'customer_id !== null && customer_id !== undefined',
          description: 'Existing customer found'
        },
        {
          toNode: 'create_customer',
          isDefault: true,
          description: 'New customer, need to create record'
        }
      ],

      responseTemplates: [
        {
          condition: 'customer_id',
          template: 'Welcome back, {{customer_name}}! I see you\'re in our system. Let\'s schedule your service.',
          tone: 'professional'
        },
        {
          template: 'Thanks {{customer_name}}! Let me get you set up in our system.',
          tone: 'professional'
        }
      ]
    },

    // ========================================
    // NODE 2: Welcome Existing Customer
    // ========================================
    welcome_existing: {
      id: 'welcome_existing',
      name: 'Welcome Existing Customer',
      description: 'Greet returning customer and confirm details',
      agentRoles: ['orchestrator'],

      requiredState: ['customer_id', 'customer_name'],
      producesState: [],

      actions: [
        {
          type: 'confirm',
          prompt: 'Welcome back, {{customer_name}}! I see you\'re in our system at {{customer_address}}. Is this still correct?'
        }
      ],

      validations: [],

      transitions: [
        {
          toNode: 'gather_booking_requirements',
          isDefault: true,
          description: 'Proceed to booking requirements'
        }
      ],

      responseTemplates: [
        {
          template: 'Welcome back, {{customer_name}}! You\'re in good hands. Let\'s schedule your {{service_category}} service.',
          tone: 'empathetic'
        }
      ]
    },

    // ========================================
    // NODE 3: Create Customer
    // ========================================
    create_customer: {
      id: 'create_customer',
      name: 'Create Customer',
      description: 'Create new customer record with collected information',
      agentRoles: ['worker'],

      requiredState: ['customer_name', 'customer_phone'],
      producesState: ['customer_id'],

      actions: [
        {
          type: 'collect_data',
          collectFields: [
            {
              key: 'customer_email',
              type: 'string',
              required: false,
              prompt: 'What\'s your email address? (optional)'
            },
            {
              key: 'customer_address',
              type: 'string',
              required: true,
              prompt: 'What\'s the service address?'
            },
            {
              key: 'customer_city',
              type: 'string',
              required: true,
              prompt: 'Which city?'
            },
            {
              key: 'customer_postal_code',
              type: 'string',
              required: false,
              prompt: 'And your postal code?'
            }
          ]
        },
        {
          type: 'mcp_call',
          mcpTool: 'customer_create',
          inputMapping: {
            body_name: 'customer_name',
            body_primary_phone: 'customer_phone',
            body_primary_email: 'customer_email',
            body_primary_address: 'customer_address',
            body_city: 'customer_city',
            body_postal_code: 'customer_postal_code',
            body_province: '"ON"',
            body_country: '"Canada"'
          },
          outputMapping: {
            customer_id: 'id',
            customer_code: 'code'
          }
        }
      ],

      validations: [
        {
          type: 'required_fields',
          fields: ['customer_address', 'customer_city'],
          errorMessage: 'Service address and city are required',
          blocking: true
        },
        {
          type: 'mcp_success',
          errorMessage: 'Failed to create customer record',
          blocking: true
        },
        {
          type: 'required_fields',
          fields: ['customer_id'],
          errorMessage: 'Customer ID not returned from creation',
          blocking: true
        }
      ],

      transitions: [
        {
          toNode: 'gather_booking_requirements',
          isDefault: true,
          description: 'Customer created, proceed to booking'
        }
      ],

      responseTemplates: [
        {
          template: 'Perfect! I\'ve got your information saved. Now let\'s schedule your service.',
          tone: 'professional'
        }
      ]
    },

    // ========================================
    // NODE 4: Gather Booking Requirements
    // ========================================
    gather_booking_requirements: {
      id: 'gather_booking_requirements',
      name: 'Gather Booking Requirements',
      description: 'Collect service type, date preferences, and requirements',
      agentRoles: ['worker', 'orchestrator'],

      requiredState: ['customer_id'],
      producesState: ['service_category', 'desired_date', 'desired_time', 'job_description'],

      actions: [
        {
          type: 'collect_data',
          collectFields: [
            {
              key: 'service_category',
              type: 'string',
              required: true,
              prompt: 'What service do you need? (HVAC, Plumbing, Electrical, Landscaping, General Contracting)'
            },
            {
              key: 'job_description',
              type: 'string',
              required: true,
              prompt: 'Can you briefly describe what you need done?'
            },
            {
              key: 'desired_date',
              type: 'date',
              required: true,
              prompt: 'When would you like us to come? (preferred date)',
              validation: '^\\d{4}-\\d{2}-\\d{2}$'
            },
            {
              key: 'desired_time',
              type: 'string',
              required: false,
              prompt: 'Do you have a preferred time? (morning, afternoon, or specific time)'
            }
          ]
        }
      ],

      validations: [
        {
          type: 'required_fields',
          fields: ['service_category', 'desired_date', 'job_description'],
          errorMessage: 'Service type, date, and description are required',
          blocking: true
        },
        {
          type: 'business_rule',
          rule: 'desired_date >= today',
          errorMessage: 'Date must be in the future',
          blocking: true
        }
      ],

      transitions: [
        {
          toNode: 'find_available_slots',
          isDefault: true,
          description: 'Requirements collected, find availability'
        }
      ],

      responseTemplates: [
        {
          template: 'That sounds {{issue_severity}}. You\'re in good hands. Let me check our {{service_category}} availability for {{desired_date}}.',
          tone: 'empathetic'
        }
      ]
    },

    // ========================================
    // NODE 5: Find Available Slots
    // ========================================
    find_available_slots: {
      id: 'find_available_slots',
      name: 'Find Available Slots',
      description: 'Query calendar system for available technicians/slots',
      agentRoles: ['worker'],

      requiredState: ['service_category', 'desired_date'],
      producesState: ['available_slots', 'available_employees'],

      actions: [
        {
          type: 'mcp_call',
          mcpTool: 'employee_list',
          inputMapping: {
            query_department: 'service_category',
            query_status: '"active"'
          },
          outputMapping: {
            available_employees: 'employees'
          }
        }
      ],

      validations: [
        {
          type: 'mcp_success',
          errorMessage: 'Failed to check availability',
          blocking: true
        },
        {
          type: 'business_rule',
          rule: 'available_employees && available_employees.length > 0',
          errorMessage: 'No technicians available for this service category',
          blocking: false
        }
      ],

      transitions: [
        {
          toNode: 'propose_options',
          condition: 'available_employees && available_employees.length > 0',
          description: 'Slots found, present options'
        },
        {
          toNode: 'gather_booking_requirements',
          condition: '!available_employees || available_employees.length === 0',
          description: 'No availability, ask for alternative date'
        }
      ],

      responseTemplates: [
        {
          condition: 'available_employees && available_employees.length > 0',
          template: 'Great news! We have {{available_employees.length}} technicians available.',
          tone: 'professional'
        },
        {
          template: 'I\'m sorry, we don\'t have availability on {{desired_date}}. Can you try another date?',
          tone: 'empathetic'
        }
      ]
    },

    // ========================================
    // NODE 6: Propose Options
    // ========================================
    propose_options: {
      id: 'propose_options',
      name: 'Propose Options',
      description: 'Present 1-3 best time slot options to the user',
      agentRoles: ['orchestrator'],

      requiredState: ['available_employees', 'desired_date'],
      producesState: ['selected_employee_id', 'selected_time'],

      actions: [
        {
          type: 'present_options',
          prompt: 'I can schedule you with {{available_employees[0].name}} on {{desired_date}}. What time works best? We have morning (9 AM) or afternoon (2 PM) available.'
        },
        {
          type: 'collect_data',
          collectFields: [
            {
              key: 'selected_time',
              type: 'string',
              required: true,
              prompt: 'Which time slot would you prefer?'
            }
          ]
        }
      ],

      validations: [
        {
          type: 'required_fields',
          fields: ['selected_time'],
          errorMessage: 'Please select a time slot',
          blocking: true
        }
      ],

      transitions: [
        {
          toNode: 'create_booking',
          isDefault: true,
          description: 'User selected time, proceed to create booking'
        }
      ],

      requiresUserConfirmation: true,

      responseTemplates: [
        {
          template: 'Perfect! I\'ll book you for {{selected_time}} on {{desired_date}} with {{available_employees[0].name}}.',
          tone: 'professional'
        }
      ]
    },

    // ========================================
    // NODE 7: Create Booking
    // ========================================
    create_booking: {
      id: 'create_booking',
      name: 'Create Booking',
      description: 'Create the actual booking/task in the system',
      agentRoles: ['worker'],

      requiredState: ['customer_id', 'service_category', 'desired_date', 'selected_time', 'job_description'],
      producesState: ['booking_id', 'task_id', 'task_code'],

      actions: [
        {
          type: 'mcp_call',
          mcpTool: 'task_create',
          inputMapping: {
            body_name: 'job_description',
            body_descr: 'job_description',
            body_task_category: 'service_category',
            body_task_priority: '"medium"',
            body_task_stage: '"new"'
          },
          outputMapping: {
            task_id: 'id',
            task_code: 'code',
            task_name: 'name'
          }
        },
        {
          type: 'mcp_call',
          mcpTool: 'linkage_create',
          inputMapping: {
            body_parent_entity_type: '"customer"',
            body_parent_entity_id: 'customer_id',
            body_child_entity_type: '"task"',
            body_child_entity_id: 'task_id',
            body_linkage_type: '"customer_task"'
          },
          outputMapping: {}
        }
      ],

      validations: [
        {
          type: 'mcp_success',
          errorMessage: 'Failed to create booking',
          blocking: true
        },
        {
          type: 'required_fields',
          fields: ['task_id'],
          errorMessage: 'Booking ID not returned',
          blocking: true
        }
      ],

      transitions: [
        {
          toNode: 'confirm_and_summarize',
          isDefault: true,
          description: 'Booking created, confirm with user'
        }
      ],

      responseTemplates: [
        {
          template: 'Excellent! Your booking has been created successfully.',
          tone: 'professional'
        }
      ]
    },

    // ========================================
    // NODE 8: Confirm and Summarize
    // ========================================
    confirm_and_summarize: {
      id: 'confirm_and_summarize',
      name: 'Confirm and Summarize',
      description: 'Provide final confirmation and summary to the user',
      agentRoles: ['orchestrator'],

      requiredState: ['task_code', 'customer_name', 'desired_date', 'selected_time', 'service_category', 'customer_address'],
      producesState: [],

      actions: [
        {
          type: 'summarize',
          prompt: 'Booking confirmed! Here\'s your summary:'
        }
      ],

      validations: [],

      transitions: [],

      responseTemplates: [
        {
          template: `Perfect! You're all set, {{customer_name}}.

📅 **Booking Confirmed**
- **Service**: {{service_category}}
- **Date**: {{desired_date}} at {{selected_time}}
- **Location**: {{customer_address}}
- **Booking #**: {{task_code}}

We'll send a reminder to {{customer_email}} or {{customer_phone}}. Is there anything else you need help with?`,
          tone: 'professional'
        }
      ]
    }
  }
};
