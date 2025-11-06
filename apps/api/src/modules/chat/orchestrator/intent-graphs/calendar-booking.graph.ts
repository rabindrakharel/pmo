/**
 * Calendar Booking Intent Graph
 * Workflow for booking landscaping/service appointments
 * @module orchestrator/intent-graphs/calendar-booking
 */

import type { IntentGraph } from '../types/intent-graph.types.js';

export const CalendarBookingGraph: IntentGraph = {
  name: 'CalendarBooking',
  description: 'Book a service appointment (landscaping, HVAC, plumbing, etc.) with simplified 5-step workflow',
  version: 'v2.0',
  startNode: 'create_or_find_customer',

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
      'time slots',
      'service requests',
      'technician dispatch',
      'home services',
      'repairs',
      'maintenance'
    ],
    forbiddenTopics: [
      'weather',
      'news',
      'politics',
      'general knowledge',
      'unrelated services',
      'other companies',
      'personal advice',
      'financial advice',
      'legal advice',
      'medical advice',
      'entertainment',
      'sports',
      'recipes',
      'travel recommendations'
    ],
    maxTurns: 15,
    canPause: true,
    canCancel: true,
    strictTopicEnforcement: true,
    offTopicAction: 'redirect_or_end',
    customRules: [
      'Never create booking without explicit user confirmation',
      'Always verify customer identity before proceeding',
      'Maintain empathetic tone when customer describes issues',
      'If customer goes off-topic (non-business), politely redirect once, then end call',
      'Before ending call, always ask if there are other service requests',
      'Route additional requests to appropriate intent graphs',
      'Create task record for EVERY service request',
      'Link task to calendar event in event description',
      'Provide complete technician information (name, phone, time) at end'
    ]
  },

  requiredPermissions: ['customer:read', 'customer:write', 'booking:write', 'employee:read', 'task:write', 'calendar:write'],

  nodes: {
    // ========================================
    // NODE 1: Create or Find Customer
    // ========================================
    create_or_find_customer: {
      id: 'create_or_find_customer',
      name: 'Create or Find Customer',
      description: 'Search for existing customer by phone or create new customer record with incremental data collection',
      agentRoles: ['worker'],

      requiredState: [],
      producesState: ['customer_id', 'customer_name', 'customer_phone', 'customer_email', 'customer_address', 'customer_city', 'customer_province', 'customer_postal_code'],

      actions: [
        {
          type: 'collect_data',
          collectFields: [
            {
              key: 'customer_name',
              type: 'string',
              required: true,
              prompt: 'Hi! I\'d be happy to help you schedule a service. Can I get your name?'
            },
            {
              key: 'customer_phone',
              type: 'string',
              required: true,
              prompt: 'And your phone number?',
              validation: '^[0-9]{3}[- ]?[0-9]{3}[- ]?[0-9]{4}$'
            }
          ]
        },
        {
          type: 'mcp_call',
          mcpTool: 'customer_list',
          inputMapping: {
            query_search: 'customer_phone'
          },
          outputMapping: {
            customer_id: 'data[0].id',
            customer_name: 'data[0].name',
            customer_email: 'data[0].primary_email',
            customer_address: 'data[0].primary_address',
            customer_city: 'data[0].city',
            customer_province: 'data[0].province',
            customer_postal_code: 'data[0].postal_code'
          }
        },
        {
          type: 'conditional',
          condition: '!customer_id',
          actions: [
            {
              type: 'collect_data',
              collectFields: [
                {
                  key: 'customer_address',
                  type: 'string',
                  required: true,
                  prompt: 'Thanks! What\'s your service address?'
                },
                {
                  key: 'customer_city',
                  type: 'string',
                  required: false,
                  prompt: 'Which city?'
                },
                {
                  key: 'customer_province',
                  type: 'string',
                  required: false,
                  prompt: 'Province?'
                },
                {
                  key: 'customer_postal_code',
                  type: 'string',
                  required: false,
                  prompt: 'Postal code?'
                }
              ]
            },
            {
              type: 'mcp_call',
              mcpTool: 'customer_create',
              inputMapping: {
                body_name: 'customer_name',
                body_primary_phone: 'customer_phone',
                body_primary_address: 'customer_address',
                body_city: 'customer_city',
                body_province: 'customer_province || "ON"',
                body_postal_code: 'customer_postal_code',
                body_country: '"Canada"'
              },
              outputMapping: {
                customer_id: 'id',
                customer_code: 'code'
              }
            }
          ]
        }
      ],

      validations: [
        {
          type: 'required_fields',
          fields: ['customer_name', 'customer_phone'],
          errorMessage: 'Customer name and phone are required',
          blocking: true
        },
        {
          type: 'required_fields',
          fields: ['customer_id'],
          errorMessage: 'Customer record not found or created',
          blocking: true
        }
      ],

      transitions: [
        {
          toNode: 'create_task',
          condition: 'customer_id',
          description: 'Customer found/created, proceed to task creation'
        },
        {
          toNode: 'create_or_find_customer',
          isDefault: true,
          description: 'Retry if customer not created'
        }
      ],

      responseTemplates: [
        {
          condition: 'customer_id && !is_new_customer',
          template: 'Welcome back, {{customer_name}}! Let\'s schedule your service.',
          tone: 'professional'
        },
        {
          condition: 'customer_id && is_new_customer',
          template: 'Perfect! I\'ve saved your information. Now let\'s schedule your service.',
          tone: 'professional'
        }
      ]
    },

    // ========================================
    // NODE 2: Create Task
    // ========================================
    create_task: {
      id: 'create_task',
      name: 'Create Task',
      description: 'Create task record with customer issue/service request and link to customer',
      agentRoles: ['worker'],

      requiredState: ['customer_id'],
      producesState: ['task_id', 'task_code', 'service_category', 'job_description'],

      actions: [
        {
          type: 'collect_data',
          collectFields: [
            {
              key: 'service_category',
              type: 'string',
              required: true,
              prompt: 'What type of service do you need? (e.g., HVAC, Plumbing, Electrical, Landscaping, General Contracting)'
            },
            {
              key: 'job_description',
              type: 'string',
              required: true,
              prompt: 'Please tell me what you need done.'
            }
          ]
        },
        {
          type: 'mcp_call',
          mcpTool: 'task_create',
          inputMapping: {
            body_name: 'service_category + ": " + job_description',
            body_descr: '"Customer: " + customer_name + "\\nIssue: " + job_description',
            body_metadata: 'JSON.stringify({ customer_id: customer_id, service_category: service_category })'
          },
          outputMapping: {
            task_id: 'id',
            task_code: 'code'
          }
        },
        {
          type: 'mcp_call',
          mcpTool: 'linkage_create',
          inputMapping: {
            body_parent_entity_type: '"cust"',
            body_parent_entity_id: 'customer_id',
            body_child_entity_type: '"task"',
            body_child_entity_id: 'task_id'
          },
          outputMapping: {}
        }
      ],

      validations: [
        {
          type: 'required_fields',
          fields: ['service_category', 'job_description'],
          errorMessage: 'Service type and description are required',
          blocking: true
        },
        {
          type: 'mcp_success',
          errorMessage: 'Failed to create task',
          blocking: true
        },
        {
          type: 'required_fields',
          fields: ['task_id'],
          errorMessage: 'Task ID not returned',
          blocking: true
        }
      ],

      transitions: [
        {
          toNode: 'find_available_employee',
          condition: 'task_id',
          description: 'Task created, find available employee'
        },
        {
          toNode: 'create_task',
          isDefault: true,
          description: 'Retry if task not created'
        }
      ],

      responseTemplates: [
        {
          template: 'Got it! I\'ve created work order #{{task_code}}. Let me find you an available technician.',
          tone: 'professional'
        }
      ]
    },

    // ========================================
    // NODE 3: Find Available Employee
    // ========================================
    find_available_employee: {
      id: 'find_available_employee',
      name: 'Find Available Employee',
      description: 'Find employee with service expertise matching customer request',
      agentRoles: ['worker'],

      requiredState: ['task_id', 'service_category'],
      producesState: ['assigned_employee_id', 'assigned_employee_name', 'assigned_employee_phone', 'desired_date'],

      actions: [
        {
          type: 'collect_data',
          collectFields: [
            {
              key: 'desired_date',
              type: 'string',
              required: true,
              prompt: 'When would you like us to come?'
            }
          ]
        },
        {
          type: 'mcp_call',
          mcpTool: 'employee_list',
          inputMapping: {
            query_active: '"true"'
          },
          outputMapping: {
            available_employees: 'data'
          }
        },
        {
          type: 'select_best',
          description: 'Select employee with matching service expertise',
          logic: 'Filter employees by service_category expertise, then select first available',
          outputMapping: {
            assigned_employee_id: 'selected_employee.id',
            assigned_employee_name: 'selected_employee.name',
            assigned_employee_phone: 'selected_employee.phone || selected_employee.primary_phone'
          }
        }
      ],

      validations: [
        {
          type: 'required_fields',
          fields: ['desired_date'],
          errorMessage: 'Desired date is required',
          blocking: true
        },
        {
          type: 'mcp_success',
          errorMessage: 'Failed to fetch employees',
          blocking: true
        },
        {
          type: 'business_rule',
          rule: 'available_employees && available_employees.length > 0',
          errorMessage: 'No technicians available',
          blocking: true
        }
      ],

      transitions: [
        {
          toNode: 'create_calendar_event',
          condition: 'assigned_employee_id',
          description: 'Employee found, create calendar event'
        },
        {
          toNode: 'find_available_employee',
          condition: '!assigned_employee_id',
          description: 'No employees available, ask for different date'
        }
      ],

      responseTemplates: [
        {
          condition: 'assigned_employee_id',
          template: 'Great! I found {{assigned_employee_name}}, our {{service_category}} specialist.',
          tone: 'professional'
        },
        {
          template: 'I\'m sorry, no technicians are available on {{desired_date}}. Can you try another date?',
          tone: 'empathetic'
        }
      ]
    },

    // ========================================
    // NODE 4: Create Calendar Event
    // ========================================
    create_calendar_event: {
      id: 'create_calendar_event',
      name: 'Create Calendar Event',
      description: 'Create calendar event with task link in description, link to task and employee, assign employee to task',
      agentRoles: ['worker'],

      requiredState: ['task_id', 'task_code', 'customer_id', 'customer_name', 'assigned_employee_id', 'desired_date', 'service_category'],
      producesState: ['calendar_event_id'],

      actions: [
        {
          type: 'parse_datetime',
          input: 'desired_date',
          output: ['start_time', 'end_time'],
          defaultDuration: '2 hours'
        },
        {
          type: 'mcp_call',
          mcpTool: 'calendar_create',
          inputMapping: {
            body_title: 'service_category + " Service - " + customer_name',
            body_description: '"Work Order: #" + task_code + "\\nTask ID: " + task_id + "\\nCustomer: " + customer_name + "\\nService: " + service_category + "\\nAddress: " + customer_address',
            body_start_time: 'start_time',
            body_end_time: 'end_time',
            body_metadata: 'JSON.stringify({ task_id: task_id, customer_id: customer_id, employee_id: assigned_employee_id })'
          },
          outputMapping: {
            calendar_event_id: 'id'
          }
        },
        {
          type: 'mcp_call',
          mcpTool: 'linkage_create',
          inputMapping: {
            body_parent_entity_type: '"task"',
            body_parent_entity_id: 'task_id',
            body_child_entity_type: '"calendar"',
            body_child_entity_id: 'calendar_event_id'
          },
          outputMapping: {}
        },
        {
          type: 'mcp_call',
          mcpTool: 'linkage_create',
          inputMapping: {
            body_parent_entity_type: '"employee"',
            body_parent_entity_id: 'assigned_employee_id',
            body_child_entity_type: '"calendar"',
            body_child_entity_id: 'calendar_event_id'
          },
          outputMapping: {}
        },
        {
          type: 'mcp_call',
          mcpTool: 'task_update',
          inputMapping: {
            id: 'task_id',
            body_assignee_id: 'assigned_employee_id',
            body_task_stage: '"assigned"'
          },
          outputMapping: {}
        }
      ],

      validations: [
        {
          type: 'mcp_success',
          errorMessage: 'Failed to create calendar event',
          blocking: true
        },
        {
          type: 'required_fields',
          fields: ['calendar_event_id'],
          errorMessage: 'Calendar event ID not returned',
          blocking: true
        }
      ],

      transitions: [
        {
          toNode: 'confirm_and_notify',
          condition: 'calendar_event_id',
          description: 'Calendar event created, confirm with customer'
        },
        {
          toNode: 'create_calendar_event',
          isDefault: true,
          description: 'Retry if calendar event not created'
        }
      ],

      responseTemplates: [
        {
          template: 'Perfect! The appointment has been scheduled.',
          tone: 'professional'
        }
      ]
    },

    // ========================================
    // NODE 5: Confirm and Notify
    // ========================================
    confirm_and_notify: {
      id: 'confirm_and_notify',
      name: 'Confirm and Notify',
      description: 'Give customer complete info: technician name, phone, date/time. Ask if there are other requests.',
      agentRoles: ['orchestrator'],

      requiredState: ['customer_name', 'assigned_employee_name', 'assigned_employee_phone', 'desired_date', 'service_category', 'customer_address', 'task_code'],
      producesState: ['has_another_request', 'next_intent'],

      actions: [
        {
          type: 'summarize',
          template: `✅ **Booking Confirmed!**

{{customer_name}}, your {{service_category}} service is all set!

👤 **Technician**: {{assigned_employee_name}}
📞 **Their Phone**: {{assigned_employee_phone}}
📅 **Date**: {{formatted_date}}
⏰ **Time**: {{formatted_time}}
📍 **Location**: {{customer_address}}
🎫 **Work Order**: #{{task_code}}

{{assigned_employee_name}} will arrive at your location at {{formatted_time}} on {{formatted_date}}.`
        },
        {
          type: 'collect_data',
          collectFields: [
            {
              key: 'has_another_request',
              type: 'boolean',
              required: false,
              prompt: 'Is there anything else you need help with today?'
            }
          ]
        },
        {
          type: 'conditional',
          condition: 'has_another_request === true',
          actions: [
            {
              type: 'route_to_intent',
              description: 'Route to appropriate intent graph based on user request',
              outputMapping: {
                next_intent: 'detected_intent'
              }
            }
          ]
        }
      ],

      validations: [],

      transitions: [
        {
          toNode: 'END',
          condition: 'has_another_request === false || !has_another_request',
          description: 'No other requests, end call'
        },
        {
          toNode: 'ROUTE_TO_INTENT',
          condition: 'has_another_request === true && next_intent',
          description: 'Route to next intent graph'
        }
      ],

      responseTemplates: [
        {
          condition: 'has_another_request === false',
          template: 'Thank you for choosing Huron Home Services! Have a great day!',
          tone: 'professional'
        },
        {
          condition: 'has_another_request === true',
          template: 'Absolutely! What else can I help you with?',
          tone: 'helpful'
        }
      ]
    }
  }
};
