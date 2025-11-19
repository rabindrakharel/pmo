# AI Agent Implementation Cookbook

> **Copy-paste ready code examples for implementing the AI-driven service workflow (API-Level)**

**Version:** 2.0
**Last Updated:** 2025-11-05
**Focus:** API Integration (No SQL)

---

## 📋 Table of Contents

1. [API Client Functions](#api-client-functions)
2. [TypeScript Service Classes](#typescript-service-classes)
3. [API Route Handlers](#api-route-handlers)
4. [React Components](#react-components)
5. [AI Prompt Templates](#ai-prompt-templates)
6. [Testing Scripts](#testing-scripts)

---

## API Client Functions

### Customer API Client

```typescript
// apps/api/src/clients/customerClient.ts
export class CustomerAPIClient {
  private baseUrl: string;
  private authToken: string;

  constructor(baseUrl: string, authToken: string) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }

  async findByPhone(phoneNumber: string) {
    const response = await fetch(
      `${this.baseUrl}/api/v1/cust?phone=${encodeURIComponent(phoneNumber)}`,
      {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Customer lookup failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0] || null;
  }

  async create(customerData: {
    phone: string;
    name?: string;
    email?: string;
    customer_type?: string;
    metadata?: object;
  }) {
    const response = await fetch(
      `${this.baseUrl}/api/v1/cust`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerData)
      }
    );

    if (!response.ok) {
      throw new Error(`Customer creation failed: ${response.statusText}`);
    }

    return await response.json();
  }

  async getTaskHistory(customerId: string, limit: number = 10) {
    const response = await fetch(
      `${this.baseUrl}/api/v1/task?metadata.customer_id=${customerId}&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Task history lookup failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  }
}
```

### Task API Client

```typescript
// apps/api/src/clients/taskClient.ts
export class TaskAPIClient {
  private baseUrl: string;
  private authToken: string;

  constructor(baseUrl: string, authToken: string) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }

  async create(taskData: {
    name: string;
    descr: string;
    metadata: {
      service_category: string;
      service_id?: string;
      customer_phone: string;
      customer_name?: string;
      customer_id?: string;
      urgency_level: 'emergency' | 'urgent' | 'normal' | 'scheduled';
      service_address: string;
      location_metadata?: object;
      conversation_id: string;
      preferred_date_time?: string;
      estimated_duration_minutes?: number;
      customer_notes?: string;
    };
  }) {
    const response = await fetch(
      `${this.baseUrl}/api/v1/task`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(taskData)
      }
    );

    if (!response.ok) {
      throw new Error(`Task creation failed: ${response.statusText}`);
    }

    return await response.json();
  }

  async update(taskId: string, updates: {
    metadata?: object;
    stage?: string;
    name?: string;
    descr?: string;
  }) {
    const response = await fetch(
      `${this.baseUrl}/api/v1/task/${taskId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      }
    );

    if (!response.ok) {
      throw new Error(`Task update failed: ${response.statusText}`);
    }

    return await response.json();
  }

  async get(taskId: string) {
    const response = await fetch(
      `${this.baseUrl}/api/v1/task/${taskId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Task lookup failed: ${response.statusText}`);
    }

    return await response.json();
  }
}
```

### Employee API Client

```typescript
// apps/api/src/clients/employeeClient.ts
export class EmployeeAPIClient {
  private baseUrl: string;
  private authToken: string;

  constructor(baseUrl: string, authToken: string) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }

  async findBySkills(serviceCategory: string) {
    const response = await fetch(
      `${this.baseUrl}/api/v1/employee?skills_service_categories=${encodeURIComponent(serviceCategory)}&active=true`,
      {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Employee lookup failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  }

  async checkAvailability(employeeId: string, params: {
    from: string;  // ISO 8601 timestamp
    to: string;    // ISO 8601 timestamp
  }) {
    const response = await fetch(
      `${this.baseUrl}/api/v1/employee/${employeeId}/availability?from=${encodeURIComponent(params.from)}&to=${encodeURIComponent(params.to)}`,
      {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Availability check failed: ${response.statusText}`);
    }

    return await response.json();
  }
}
```

### Service Catalog API Client

```typescript
// apps/api/src/clients/serviceClient.ts
export class ServiceAPIClient {
  private baseUrl: string;
  private authToken: string;

  constructor(baseUrl: string, authToken: string) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }

  async getCategories() {
    const response = await fetch(
      `${this.baseUrl}/api/v1/setting?datalabel=dl__service_category`,
      {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Service categories lookup failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  }

  async search(params: {
    service_category?: string;
    search?: string;
    active?: boolean;
  }) {
    const queryParams = new URLSearchParams();
    if (params.service_category) queryParams.append('service_category', params.service_category);
    if (params.search) queryParams.append('search', params.search);
    if (params.active !== undefined) queryParams.append('active', String(params.active));

    const response = await fetch(
      `${this.baseUrl}/api/v1/service?${queryParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Service search failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  }
}
```

### Event & Calendar API Client

```typescript
// apps/api/src/clients/eventClient.ts
export class EventAPIClient {
  private baseUrl: string;
  private authToken: string;

  constructor(baseUrl: string, authToken: string) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }

  async create(eventData: {
    name: string;
    descr: string;
    event_entity_action: string;
    event_medium: string;
    event_addr: string;
    event_instructions?: string;
    event_metadata: object;
    reminder_sent_flag?: boolean;
    confirmation_sent_flag?: boolean;
  }) {
    const response = await fetch(
      `${this.baseUrl}/api/v1/event`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventData)
      }
    );

    if (!response.ok) {
      throw new Error(`Event creation failed: ${response.statusText}`);
    }

    return await response.json();
  }

  async bookCalendar(bookingData: {
    employee_id: string;
    event_id: string;
    from_ts: string;
    to_ts: string;
    name?: string;
  }) {
    const response = await fetch(
      `${this.baseUrl}/api/v1/calendar/book`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bookingData)
      }
    );

    if (!response.ok) {
      throw new Error(`Calendar booking failed: ${response.statusText}`);
    }

    return await response.json();
  }
}
```

---

## TypeScript Service Classes

### AI Agent Orchestration Service

```typescript
// apps/api/src/services/aiAgentOrchestratorService.ts
import { CustomerAPIClient } from '../clients/customerClient';
import { TaskAPIClient } from '../clients/taskClient';
import { EmployeeAPIClient } from '../clients/employeeClient';
import { ServiceAPIClient } from '../clients/serviceClient';
import { EventAPIClient } from '../clients/eventClient';

interface ServiceRequest {
  phoneNumber: string;
  conversationId: string;
  extractedInfo: {
    customerName?: string;
    serviceCategory: string;
    serviceId?: string;
    urgencyLevel: 'emergency' | 'urgent' | 'normal' | 'scheduled';
    problemDescription: string;
    serviceAddress: string;
    preferredDateTime: Date;
    estimatedDuration: number;
    customerNotes?: string;
    locationMetadata?: object;
  };
}

export class AIAgentOrchestratorService {
  private customerClient: CustomerAPIClient;
  private taskClient: TaskAPIClient;
  private employeeClient: EmployeeAPIClient;
  private serviceClient: ServiceAPIClient;
  private eventClient: EventAPIClient;

  constructor(
    private baseUrl: string,
    private authToken: string
  ) {
    this.customerClient = new CustomerAPIClient(baseUrl, authToken);
    this.taskClient = new TaskAPIClient(baseUrl, authToken);
    this.employeeClient = new EmployeeAPIClient(baseUrl, authToken);
    this.serviceClient = new ServiceAPIClient(baseUrl, authToken);
    this.eventClient = new EventAPIClient(baseUrl, authToken);
  }

  async processServiceRequest(request: ServiceRequest) {
    try {
      // STEP 1: Customer lookup
      let customer = await this.customerClient.findByPhone(request.phoneNumber);

      if (customer) {
        console.log(`Found existing customer: ${customer.name} (${customer.code})`);
      } else {
        console.log(`New customer: ${request.phoneNumber}`);
      }

      // STEP 2: Create task FIRST
      const task = await this.taskClient.create({
        name: this.generateTaskName(request.extractedInfo),
        descr: request.extractedInfo.problemDescription,
        metadata: {
          service_category: request.extractedInfo.serviceCategory,
          service_id: request.extractedInfo.serviceId,
          customer_phone: request.phoneNumber,
          customer_name: request.extractedInfo.customerName,
          customer_id: customer?.id,
          urgency_level: request.extractedInfo.urgencyLevel,
          service_address: request.extractedInfo.serviceAddress,
          location_metadata: request.extractedInfo.locationMetadata,
          conversation_id: request.conversationId,
          preferred_date_time: request.extractedInfo.preferredDateTime.toISOString(),
          estimated_duration_minutes: request.extractedInfo.estimatedDuration,
          customer_notes: request.extractedInfo.customerNotes
        }
      });

      console.log(`Task created: ${task.code}`);

      // STEP 3: Create customer if new
      if (!customer) {
        customer = await this.customerClient.create({
          phone: request.phoneNumber,
          name: request.extractedInfo.customerName || `Customer - ${request.phoneNumber}`,
          customer_type: 'residential',
          metadata: {
            initial_task_id: task.id,
            conversation_id: request.conversationId,
            created_via: 'ai_agent',
            initial_service_category: request.extractedInfo.serviceCategory,
            profile_complete: false
          }
        });

        console.log(`Customer created: ${customer.code}`);

        // Link customer to task
        await this.taskClient.update(task.id, {
          metadata: {
            customer_id: customer.id
          }
        });
      }

      // STEP 4: Find and assign employee
      const qualifiedEmployees = await this.employeeClient.findBySkills(
        request.extractedInfo.serviceCategory
      );

      if (qualifiedEmployees.length === 0) {
        throw new Error(`No employees found with ${request.extractedInfo.serviceCategory} skills`);
      }

      let assignedEmployee = null;
      const endTime = new Date(
        request.extractedInfo.preferredDateTime.getTime() +
        request.extractedInfo.estimatedDuration * 60000
      );

      for (const employee of qualifiedEmployees) {
        const availability = await this.employeeClient.checkAvailability(
          employee.id,
          {
            from: request.extractedInfo.preferredDateTime.toISOString(),
            to: endTime.toISOString()
          }
        );

        if (availability.available && availability.total_available_minutes >= request.extractedInfo.estimatedDuration) {
          assignedEmployee = employee;

          // Assign to task
          await this.taskClient.update(task.id, {
            metadata: {
              assigneemployee_id: employee.id,
              assigned_at: new Date().toISOString(),
              assigned_by: 'ai_agent'
            }
          });

          console.log(`Assigned employee: ${employee.name}`);
          break;
        }
      }

      if (!assignedEmployee) {
        throw new Error('No available employees found for the requested time');
      }

      // STEP 5: Create event and book calendar
      const event = await this.eventClient.create({
        name: this.generateTaskName(request.extractedInfo),
        descr: request.extractedInfo.problemDescription,
        event_entity_action: request.extractedInfo.serviceCategory.toLowerCase().replace(/\s+/g, '_'),
        event_medium: 'onsite',
        event_addr: request.extractedInfo.serviceAddress,
        event_instructions: request.extractedInfo.customerNotes || '',
        event_metadata: {
          task_id: task.id,
          customer_id: customer.id,
          employee_id: assignedEmployee.id,
          service_category: request.extractedInfo.serviceCategory,
          urgency_level: request.extractedInfo.urgencyLevel,
          estimated_duration_minutes: request.extractedInfo.estimatedDuration,
          customer_phone: request.phoneNumber
        },
        reminder_sent_flag: false,
        confirmation_sent_flag: false
      });

      console.log(`Event created: ${event.code}`);

      // Book calendar slots
      await this.eventClient.bookCalendar({
        employee_id: assignedEmployee.id,
        event_id: event.id,
        from_ts: request.extractedInfo.preferredDateTime.toISOString(),
        to_ts: endTime.toISOString(),
        name: this.generateTaskName(request.extractedInfo)
      });

      console.log(`Calendar booked: ${assignedEmployee.name} from ${request.extractedInfo.preferredDateTime.toISOString()}`);

      // Link event to task
      await this.taskClient.update(task.id, {
        metadata: {
          event_id: event.id,
          scheduled_at: request.extractedInfo.preferredDateTime.toISOString()
        }
      });

      return {
        success: true,
        task,
        customer,
        employee: assignedEmployee,
        event,
        appointment: {
          dateTime: request.extractedInfo.preferredDateTime,
          duration: request.extractedInfo.estimatedDuration,
          address: request.extractedInfo.serviceAddress
        }
      };

    } catch (error) {
      console.error('AI Agent workflow error:', error);
      throw error;
    }
  }

  private generateTaskName(info: ServiceRequest['extractedInfo']): string {
    const urgencyPrefix = info.urgencyLevel === 'emergency' ? 'Emergency ' : '';
    return `${urgencyPrefix}${info.serviceCategory} Service`;
  }
}
```

---

## API Route Handlers

### Main Orchestration Endpoint

```typescript
// apps/api/src/modules/ai-agent/routes.ts
import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { AIAgentOrchestratorService } from '../../services/aiAgentOrchestratorService';

const routes: FastifyPluginAsync = async (fastify) => {

  // Process customer service request from AI chat
  fastify.post('/api/v1/ai-agent/service-request', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        phoneNumber: Type.String({ pattern: '^\\+[1-9]\\d{1,14}$' }),
        conversationId: Type.String({ format: 'uuid' }),
        extractedInfo: Type.Object({
          customerName: Type.Optional(Type.String()),
          serviceCategory: Type.String(),
          serviceId: Type.Optional(Type.String({ format: 'uuid' })),
          urgencyLevel: Type.Union([
            Type.Literal('emergency'),
            Type.Literal('urgent'),
            Type.Literal('normal'),
            Type.Literal('scheduled')
          ]),
          problemDescription: Type.String(),
          serviceAddress: Type.String(),
          preferredDateTime: Type.String({ format: 'date-time' }),
          estimatedDuration: Type.Number({ minimum: 15 }),
          customerNotes: Type.Optional(Type.String()),
          locationMetadata: Type.Optional(Type.Object({}))
        })
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          task: Type.Object({
            id: Type.String(),
            code: Type.String(),
            name: Type.String()
          }),
          customer: Type.Object({
            id: Type.String(),
            code: Type.String(),
            name: Type.String()
          }),
          employee: Type.Object({
            id: Type.String(),
            name: Type.String()
          }),
          event: Type.Object({
            id: Type.String(),
            code: Type.String()
          }),
          appointment: Type.Object({
            dateTime: Type.String(),
            duration: Type.Number(),
            address: Type.String()
          })
        }),
        500: Type.Object({
          error: Type.String(),
          message: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const authToken = request.headers.authorization?.replace('Bearer ', '') || '';
      const orchestrator = new AIAgentOrchestratorService(
        process.env.API_URL || 'http://localhost:4000',
        authToken
      );

      const result = await orchestrator.processServiceRequest({
        ...request.body,
        extractedInfo: {
          ...request.body.extractedInfo,
          preferredDateTime: new Date(request.body.extractedInfo.preferredDateTime)
        }
      });

      return reply.code(200).send(result);

    } catch (error: any) {
      fastify.log.error('AI Agent service request failed:', error);
      return reply.code(500).send({
        error: 'SERVICE_REQUEST_FAILED',
        message: error.message || 'An unexpected error occurred'
      });
    }
  });

  // Chat endpoint for conversational AI
  fastify.post('/api/v1/ai-agent/chat', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        message: Type.String(),
        conversationHistory: Type.Array(Type.Object({
          role: Type.Union([
            Type.Literal('user'),
            Type.Literal('assistant'),
            Type.Literal('system')
          ]),
          text: Type.String(),
          timestamp: Type.String()
        }))
      }),
      response: {
        200: Type.Object({
          response: Type.String(),
          serviceRequest: Type.Optional(Type.Object({}))
        })
      }
    }
  }, async (request, reply) => {
    // TODO: Implement AI chat logic with LLM integration
    // This would call OpenAI/Claude/etc. to process the message
    // and extract structured information

    return reply.code(200).send({
      response: 'AI response here',
      serviceRequest: null
    });
  });
};

export default routes;
```

---

## React Components

### AI Service Chat Widget

```tsx
// apps/web/src/components/AIServiceChat.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader, CheckCircle } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: Date;
}

interface ServiceConfirmation {
  taskCode: string;
  customerName: string;
  employeeName: string;
  appointmentTime: string;
  address: string;
}

export const AIServiceChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: "Hi! I'm here to help schedule your service appointment. Can I start with your phone number?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmation, setConfirmation] = useState<ServiceConfirmation | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      role: 'user',
      text: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      // Call AI backend
      const response = await fetch('/api/v1/ai-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage.text,
          conversationHistory: messages
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();

      // Add assistant response
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.response,
        timestamp: new Date()
      }]);

      // If service request completed, show confirmation
      if (data.serviceRequest) {
        setConfirmation({
          taskCode: data.serviceRequest.task.code,
          customerName: data.serviceRequest.customer.name,
          employeeName: data.serviceRequest.employee.name,
          appointmentTime: data.serviceRequest.appointment.dateTime,
          address: data.serviceRequest.appointment.address
        });
      }

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'system',
        text: 'Sorry, something went wrong. Please try again or contact support.',
        timestamp: new Date()
      }]);
    } finally {
      setIsProcessing(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[600px] max-w-2xl mx-auto border border-gray-300 rounded-lg shadow-lg bg-white">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 rounded-t-lg flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Service Assistant</h2>
          <p className="text-sm opacity-90">Let's schedule your service appointment</p>
        </div>
        {confirmation && <CheckCircle className="h-6 w-6" />}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-3 shadow-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : msg.role === 'assistant'
                  ? 'bg-white border border-gray-200'
                  : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
              }`}
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
              <span className="text-xs opacity-70 mt-1 block">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
              <Loader className="animate-spin h-5 w-5 text-blue-600" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Service Request Confirmation */}
      {confirmation && (
        <div className="bg-green-50 border-t border-green-200 p-4">
          <div className="flex items-start gap-2">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-green-800 mb-2">
                Appointment Confirmed!
              </h3>
              <div className="text-sm space-y-1 text-green-900">
                <p><strong>Task:</strong> {confirmation.taskCode}</p>
                <p><strong>Technician:</strong> {confirmation.employeeName}</p>
                <p><strong>Time:</strong> {new Date(confirmation.appointmentTime).toLocaleString()}</p>
                <p><strong>Location:</strong> {confirmation.address}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t bg-white rounded-b-lg">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={isProcessing}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={isProcessing || !input.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {isProcessing ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">Press Enter to send</p>
      </div>
    </div>
  );
};
```

---

## AI Prompt Templates

### System Prompt

```
You are a helpful service scheduling assistant for Huron Home Services, a Canadian home services company. Your goal is to collect information and schedule service appointments.

REQUIRED INFORMATION:
1. Phone number (must be in E.164 format: +1XXXXXXXXXX)
2. Service type (HVAC, Plumbing, Electrical, Landscaping, General Contracting)
3. Problem description (what's wrong or what service is needed)
4. Urgency level (emergency, urgent, normal, scheduled)
5. Service address (complete address in Ontario, Canada)
6. Preferred date/time

CONVERSATION FLOW:
1. Greet and ask for phone number
2. Ask what service they need
3. Ask them to describe the problem or service request
4. Determine urgency ("How urgent is this?")
5. Ask when they'd like service ("When would you like a technician to come?")
6. Get service address
7. Ask for special instructions (parking, pets, access codes, allergies)
8. Confirm all details
9. Process booking

TONE:
- Professional and friendly
- Empathetic for emergency situations
- Efficient but not rushed
- Clear and concise

EXAMPLES:
- Emergency: Prioritize speed, offer same-day service
- Urgent: Offer next available slot, typically within 24 hours
- Normal: Offer multiple date/time options
- Scheduled: Regular maintenance, flexible scheduling

Extract information as the conversation progresses and present a summary before confirming the booking.
```

### Extraction Prompt

```
Extract structured information from this customer service conversation and return it in JSON format.

Conversation History:
{{CONVERSATION_HISTORY}}

Extract the following fields. Use null for any information that is not yet provided or cannot be determined:

{
  "phoneNumber": "string in E.164 format (+1XXXXXXXXXX) or null",
  "customerName": "string or null",
  "serviceCategory": "exact match from: HVAC, Plumbing, Electrical, Landscaping, General Contracting, or null",
  "problemDescription": "detailed description or null",
  "urgencyLevel": "exact match from: emergency, urgent, normal, scheduled, or null",
  "serviceAddress": "complete address string or null",
  "preferredDateTime": "ISO 8601 timestamp (YYYY-MM-DDTHH:MM:SSZ) or null",
  "estimatedDuration": "number in minutes (15, 30, 60, 120, etc.) or null",
  "customerNotes": "special instructions, access codes, parking, pets, or null"
}

IMPORTANT:
- Return ONLY valid JSON, no other text
- Use exact string matches for serviceCategory and urgencyLevel
- Convert all dates/times to ISO 8601 format
- Use null (not empty string) for missing values
- Estimate duration based on service type if not explicitly stated

DURATION GUIDELINES:
- Emergency repairs: 120 minutes
- Routine maintenance: 60-90 minutes
- Inspections: 30-60 minutes
- Major installations: 180-240 minutes
```

---

## Testing Scripts

### Test Complete Workflow (Bash)

```bash
#!/bin/bash
# test-ai-workflow.sh
# Test the complete AI agent service workflow

API_URL="${API_URL:-http://localhost:4000}"
EMAIL="${API_TEST_EMAIL:-james.miller@huronhome.ca}"
PASSWORD="${API_TEST_PASSWORD:-password123}"

echo "=== AI Agent Service Workflow Test ==="
echo ""

# Step 1: Login
echo "1. Authenticating..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Authentication failed"
  exit 1
fi

echo "✅ Authenticated"
echo ""

# Step 2: Get service categories
echo "2. Fetching service categories..."
CATEGORIES=$(curl -s -X GET "$API_URL/api/v1/setting?datalabel=dl__service_category" \
  -H "Authorization: Bearer $TOKEN")

echo "$CATEGORIES" | jq '.data[] | {id, name}'
echo ""

# Step 3: Search for HVAC services
echo "3. Searching for HVAC services..."
SERVICES=$(curl -s -X GET "$API_URL/api/v1/service?service_category=HVAC&active=true" \
  -H "Authorization: Bearer $TOKEN")

SERVICE_ID=$(echo "$SERVICES" | jq -r '.data[0].id')
echo "Found service ID: $SERVICE_ID"
echo ""

# Step 4: Create service request
echo "4. Creating service request..."
PREFERRED_TIME=$(date -u -d "+2 hours" +"%Y-%m-%dT%H:00:00Z")

SERVICE_REQUEST=$(curl -s -X POST "$API_URL/api/v1/ai-agent/service-request" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"phoneNumber\": \"+14165551234\",
    \"conversationId\": \"$(uuidgen)\",
    \"extractedInfo\": {
      \"customerName\": \"Test Customer\",
      \"serviceCategory\": \"HVAC\",
      \"serviceId\": \"$SERVICE_ID\",
      \"urgencyLevel\": \"urgent\",
      \"problemDescription\": \"Furnace not heating properly. Cold air from vents.\",
      \"serviceAddress\": \"123 Test Street, Toronto, ON M5A 1A1\",
      \"preferredDateTime\": \"$PREFERRED_TIME\",
      \"estimatedDuration\": 120,
      \"customerNotes\": \"Customer has two friendly dogs. Park in driveway.\"
    }
  }")

echo "$SERVICE_REQUEST" | jq '.'
echo ""

# Extract IDs
TASK_ID=$(echo "$SERVICE_REQUEST" | jq -r '.task.id')
TASK_CODE=$(echo "$SERVICE_REQUEST" | jq -r '.task.code')
CUSTOMER_ID=$(echo "$SERVICE_REQUEST" | jq -r '.customer.id')
EMPLOYEE_ID=$(echo "$SERVICE_REQUEST" | jq -r '.employee.id')
EVENT_ID=$(echo "$SERVICE_REQUEST" | jq -r '.event.id')

if [ "$TASK_ID" = "null" ]; then
  echo "❌ Service request failed"
  echo "$SERVICE_REQUEST" | jq '.error, .message'
  exit 1
fi

echo "✅ Service Request Created:"
echo "  Task: $TASK_CODE ($TASK_ID)"
echo "  Customer: $CUSTOMER_ID"
echo "  Employee: $EMPLOYEE_ID"
echo "  Event: $EVENT_ID"
echo ""

# Step 5: Verify task
echo "5. Verifying task..."
TASK=$(curl -s -X GET "$API_URL/api/v1/task/$TASK_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "$TASK" | jq '{code, name, metadata: {customer_id, assigneemployee_id, event_id}}'
echo ""

# Step 6: Check employee calendar
echo "6. Checking employee calendar..."
TO_TIME=$(date -u -d "+4 hours" +"%Y-%m-%dT%H:00:00Z")
CALENDAR=$(curl -s -X GET "$API_URL/api/v1/employee/$EMPLOYEE_ID/availability?from=$PREFERRED_TIME&to=$TO_TIME" \
  -H "Authorization: Bearer $TOKEN")

echo "$CALENDAR" | jq '{available, total_available_minutes}'
echo ""

echo "=== Test Complete ✅ ==="
```

### Test with curl (Manual)

```bash
# 1. Login
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"james.miller@huronhome.ca","password":"password123"}'

# Save the token from response
TOKEN="your-jwt-token-here"

# 2. Get service categories
curl -X GET "http://localhost:4000/api/v1/setting?datalabel=dl__service_category" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# 3. Find HVAC employees
curl -X GET "http://localhost:4000/api/v1/employee?skills_service_categories=HVAC&active=true" \
  -H "Authorization: Bearer $TOKEN" | jq '.data[] | {name, skills_service_categories}'

# 4. Create service request
curl -X POST http://localhost:4000/api/v1/ai-agent/service-request \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+14165551234",
    "conversationId": "test-conv-001",
    "extractedInfo": {
      "customerName": "John Test",
      "serviceCategory": "HVAC",
      "urgencyLevel": "urgent",
      "problemDescription": "Furnace not heating",
      "serviceAddress": "123 Test St, Toronto, ON",
      "preferredDateTime": "2025-11-06T14:00:00Z",
      "estimatedDuration": 120,
      "customerNotes": "Has two dogs"
    }
  }' | jq '.'
```

---

**Documentation Version:** 2.0
**Last Updated:** 2025-11-05
**Status:** API-Level Ready
**Focus:** No SQL - Pure API Integration
