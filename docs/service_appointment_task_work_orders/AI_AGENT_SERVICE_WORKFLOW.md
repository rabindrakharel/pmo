# AI Agent Service Appointment & Task Creation Workflow

> **Complete guide for AI-driven customer service appointment scheduling, task creation, and employee assignment**

**Version:** 2.0
**Last Updated:** 2025-11-05
**Status:** Active
**Focus:** API-Level Integration

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Customer Identification Flow](#customer-identification-flow)
4. [Problem Understanding](#problem-understanding)
5. [Task Creation Workflow](#task-creation-workflow)
6. [Customer Record Management](#customer-record-management)
7. [Employee Assignment Algorithm](#employee-assignment-algorithm)
8. [Event & Calendar Booking](#event--calendar-booking)
9. [API Endpoints](#api-endpoints)
10. [Data Models](#data-models)
11. [Example Conversations](#example-conversations)
12. [Implementation Guide](#implementation-guide)
13. [Error Handling](#error-handling)

---

## Overview

The AI Agent Service Workflow enables customers to request service appointments through natural language chat. The system:

1. **Identifies** existing or new customers by phone number
2. **Understands** service needs through conversational AI
3. **Creates** task records automatically
4. **Generates** customer records for new customers
5. **Assigns** appropriate employees based on skills and availability
6. **Books** calendar slots and creates events

### Key Benefits

- ✅ **Frictionless Onboarding**: New customers can book without account creation
- ✅ **Intelligent Matching**: Skills-based employee assignment
- ✅ **Real-time Availability**: Calendar integration for instant booking
- ✅ **Minimal Data Entry**: Phone number-first approach
- ✅ **Full Context**: All interactions linked to tasks, events, and customers

---

## Architecture

### High-Level Flow

```
Customer Chat → AI Agent → Customer Lookup → Problem Understanding
                                ↓
                        Task Creation (First)
                                ↓
                    Customer Record (If New)
                                ↓
                    Employee Assignment (Skills + Availability)
                                ↓
                    Event Creation + Calendar Booking
                                ↓
                        Confirmation to Customer
```

### System Components

| Component | Purpose | API Endpoints |
|-----------|---------|--------------|
| **AI Agent** | Natural language processing, conversation management | `/api/v1/chat`, `/api/v1/interaction` |
| **Customer Service** | Lookup/create customer records | `/api/v1/cust` |
| **Task Service** | Create and manage service tasks | `/api/v1/task` |
| **Employee Matcher** | Find qualified available employees | `/api/v1/employee`, `/api/v1/employee/:id/availability` |
| **Event Service** | Create events and book calendar slots | `/api/v1/event`, `/api/v1/calendar` |
| **Service Catalog** | Available services and categories | `/api/v1/service`, `/api/v1/datalabel?name=dl__service_category` |

---

## Customer Identification Flow

### Step 1: Extract Phone Number

The AI agent extracts the customer's phone number from the conversation:

```typescript
interface CustomerIdentificationRequest {
  phoneNumber: string;      // E.164 format: +14165551234
  conversationId: string;   // Track conversation context
  extractedName?: string;   // Optional: Name from conversation
}
```

### Step 2: Lookup Existing Customer

**API Endpoint:**
```http
GET /api/v1/cust?phone=+14165551234
Authorization: Bearer <token>
```

**Response Scenarios:**

1. **Existing Customer Found:**
```json
{
  "data": [{
    "id": "uuid-here",
    "code": "CL-RES-123",
    "name": "John Smith",
    "phone": "+14165551234",
    "email": "john.smith@example.com",
    "customer_tier": "premium",
    "metadata": {
      "serviceHistory": [],
      "previousInteractions": 5
    }
  }],
  "total": 1
}
```

2. **New Customer (Not Found):**
```json
{
  "data": [],
  "total": 0
}
```

### Step 3: Context Enrichment

For **existing customers**, load service history:

**API Endpoint:**
```http
GET /api/v1/task?metadata.customer_id=<customer-uuid>&limit=10
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "task-uuid",
      "code": "TASK-123",
      "name": "Previous HVAC Service",
      "stage": "Completed",
      "metadata": {
        "service_category": "HVAC",
        "completion_date": "2025-10-15"
      }
    }
  ]
}
```

---

## Problem Understanding

The AI agent uses conversational AI to extract key information:

### Information to Extract

| Field | Type | Required | Example |
|-------|------|----------|---------|
| **Service Category** | string | Yes | "HVAC", "Plumbing", "Electrical" |
| **Problem Description** | text | Yes | "Furnace not heating, cold air only" |
| **Urgency Level** | enum | Yes | "emergency", "urgent", "normal", "scheduled" |
| **Preferred Date/Time** | datetime | No | "Tomorrow afternoon", "ASAP", "Next week" |
| **Location** | address | Yes | "123 Main St, Toronto, ON" |
| **Additional Details** | object | No | Pet info, access instructions, etc. |

### Conversation Example Flow

**AI Agent Prompts:**
1. "What service do you need help with today?" → Extract service category
2. "Can you describe the issue?" → Extract problem description
3. "How urgent is this?" → Extract urgency level
4. "When would you like us to come?" → Extract preferred time
5. "What's the service address?" → Extract location
6. "Anything else we should know?" → Extract additional context

### Service Category Lookup

**API Endpoint:**
```http
GET /api/v1/datalabel?name=dl__service_category
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": [
    {"id": "0", "name": "HVAC", "descr": "Heating, Ventilation, and Air Conditioning services"},
    {"id": "1", "name": "Plumbing", "descr": "Plumbing installation, repair, and maintenance services"},
    {"id": "2", "name": "Electrical", "descr": "Electrical installation, wiring, and repair services"},
    {"id": "3", "name": "Landscaping", "descr": "Landscaping, lawn care, and outdoor maintenance services"},
    {"id": "4", "name": "General Contracting", "descr": "General contracting, renovation, and construction services"}
  ]
}
```

**Service Lookup:**
```http
GET /api/v1/service?service_category=HVAC&search=furnace
Authorization: Bearer <token>
```

**Natural Language → Service Category Examples:**
- "My furnace isn't working" → HVAC Service
- "I have a leaky pipe" → Plumbing Service
- "Need new electrical outlets" → Electrical Service
- "Solar panel inspection" → Electrical Service

---

## Task Creation Workflow

### Why Create Task First?

Tasks are created **BEFORE** customer records for new customers because:
1. **Atomic Operation**: Ensures service request is captured immediately
2. **Linkage Ready**: Task ID can be referenced when creating customer record
3. **No Orphans**: Customer creation failure doesn't lose the task
4. **Audit Trail**: Complete timeline from initial request

### Step 1: Prepare Task Data

```typescript
interface TaskCreationRequest {
  // Required fields
  code?: string;                   // Auto-generated if omitted
  name: string;                    // E.g., "Emergency HVAC Repair"
  descr: string;                   // Full problem description

  // Service information
  metadata: {
    service_id?: string;           // From d_service lookup
    service_category: string;      // E.g., "HVAC", "Plumbing"

    // Customer information
    customer_id?: string;          // If existing customer
    customer_phone: string;        // Always captured
    customer_name?: string;        // From conversation

    // Urgency and scheduling
    urgency_level: 'emergency' | 'urgent' | 'normal' | 'scheduled';
    preferred_date_time?: string;  // ISO 8601 format

    // Location
    service_address: string;       // Full address
    location_metadata?: {
      access_codes?: string;
      parking_instructions?: string;
      pet_information?: string;
    };

    // Additional context
    conversation_id: string;       // Link to chat interaction
    extracted_context?: object;    // AI extracted details
    customer_notes?: string;       // Special instructions
    estimated_duration_minutes?: number;
  };
}
```

### Step 2: Create Task Record

**API Endpoint:**
```http
POST /api/v1/task
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Emergency HVAC Repair - Furnace Not Heating",
  "descr": "Customer reports furnace producing cold air only. System has been running for 30 minutes without heat. Customer feels air from vents is cold. Unit is approximately 5 years old.",
  "metadata": {
    "service_category": "HVAC",
    "customer_phone": "+14165551234",
    "customer_name": "John Smith",
    "urgency_level": "urgent",
    "service_address": "123 Main Street, Toronto, ON M4W 1N4",
    "conversation_id": "conv-uuid-here",
    "preferred_time": "ASAP - today if possible",
    "estimated_duration_minutes": 120,
    "customer_notes": "Customer has two dogs (friendly). Park in driveway."
  }
}
```

**Response:**
```json
{
  "id": "task-uuid",
  "code": "TASK-12345",
  "name": "Emergency HVAC Repair - Furnace Not Heating",
  "stage": "Open",
  "created_ts": "2025-11-05T14:00:00Z"
}
```

---

## Customer Record Management

### For New Customers

If customer lookup returns **no match**, create a minimal customer record:

```typescript
interface MinimalCustomerCreation {
  phone: string;                  // PRIMARY IDENTIFIER (required)
  name?: string;                  // From conversation (optional)
  email?: string;                 // If provided in chat

  // Defaults
  customer_type?: 'residential';  // Default for new customers

  // Metadata
  metadata: {
    initial_task_id: string;      // Link to first task
    conversation_id: string;      // Original chat session
    created_via: 'ai_agent';
    initial_service_category: string;
    profile_complete?: false;
  };
}
```

### Customer Creation API

**API Endpoint:**
```http
POST /api/v1/cust
Authorization: Bearer <token>
Content-Type: application/json

{
  "phone": "+14165551234",
  "name": "John Smith",
  "customer_type": "residential",
  "metadata": {
    "initial_task_id": "task-uuid",
    "conversation_id": "conv-uuid",
    "created_via": "ai_agent",
    "initial_service_category": "HVAC",
    "profile_complete": false
  }
}
```

**Response:**
```json
{
  "id": "cust-uuid",
  "code": "CL-RES-456",
  "name": "John Smith",
  "phone": "+14165551234",
  "customer_type": "residential",
  "created_ts": "2025-11-05T14:01:00Z"
}
```

### Link Customer to Task

After customer creation, update task with customer ID:

**API Endpoint:**
```http
PUT /api/v1/task/:taskId
Authorization: Bearer <token>
Content-Type: application/json

{
  "metadata": {
    "customer_id": "cust-uuid"
  }
}
```

---

## Employee Assignment Algorithm

### Overview

The employee assignment algorithm finds the **best-qualified available employee** based on:

1. **Skills Match**: `skills_service_categories` contains required service
2. **Availability**: Has open calendar slots at preferred time
3. **Proximity**: (Optional) Geographic location
4. **Workload**: (Optional) Current task count
5. **Performance**: (Optional) Customer ratings

### Step 1: Skills-Based Filtering

**API Endpoint:**
```http
GET /api/v1/employee?skills_service_categories=HVAC&active=true
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "emp-uuid-1",
      "code": "EMP-001",
      "name": "Mike Chen",
      "department": "HVAC",
      "skills_service_categories": ["HVAC", "Electrical"],
      "phone": "+14165550001"
    },
    {
      "id": "emp-uuid-2",
      "code": "EMP-045",
      "name": "Sarah Johnson",
      "department": "Operations",
      "skills_service_categories": ["HVAC", "Plumbing", "Electrical", "Landscaping"],
      "phone": "+14165550045"
    }
  ]
}
```

### Step 2: Check Calendar Availability

For each qualified employee, check calendar availability:

**API Endpoint:**
```http
GET /api/v1/employee/:employeeId/availability?from=2025-11-06T14:00:00Z&to=2025-11-06T16:00:00Z
Authorization: Bearer <token>
```

**Response:**
```json
{
  "employee_id": "emp-uuid-1",
  "available": true,
  "slots": [
    {
      "from_ts": "2025-11-06T14:00:00Z",
      "to_ts": "2025-11-06T14:15:00Z",
      "available": true
    },
    {
      "from_ts": "2025-11-06T14:15:00Z",
      "to_ts": "2025-11-06T14:30:00Z",
      "available": true
    }
    // ... 8 slots total for 2-hour window
  ],
  "total_available_minutes": 120
}
```

### Step 3: Assignment Logic

```typescript
interface EmployeeAssignmentResult {
  employeeId: string;
  employeeName: string;
  employeePhone: string;
  availableSlots: CalendarSlot[];
  matchScore: number;  // 0-100, based on skills, availability, etc.
}

async function assignEmployee(
  taskId: string,
  serviceCategory: string,
  preferredDateTime: Date,
  durationMinutes: number
): Promise<EmployeeAssignmentResult> {

  // 1. Find qualified employees
  const response = await fetch(`/api/v1/employee?skills_service_categories=${serviceCategory}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const qualifiedEmployees = await response.json();

  // 2. Check availability for each
  const availableEmployees = [];
  for (const employee of qualifiedEmployees.data) {
    const availResponse = await fetch(
      `/api/v1/employee/${employee.id}/availability?from=${preferredDateTime.toISOString()}&duration=${durationMinutes}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const availability = await availResponse.json();

    if (availability.available && availability.total_available_minutes >= durationMinutes) {
      availableEmployees.push({
        employee,
        availability,
        matchScore: calculateMatchScore(employee, serviceCategory, availability)
      });
    }
  }

  // 3. Rank by match score
  availableEmployees.sort((a, b) => b.matchScore - a.matchScore);

  // 4. Return best match
  return availableEmployees[0];
}
```

### Step 4: Create Task Assignment

**API Endpoint:**
```http
PUT /api/v1/task/:taskId
Authorization: Bearer <token>
Content-Type: application/json

{
  "metadata": {
    "assigned_employee_id": "emp-uuid-1",
    "assigned_at": "2025-11-05T14:05:00Z",
    "assigned_by": "ai_agent"
  }
}
```

---

## Event & Calendar Booking

### Step 1: Create Event Record

**API Endpoint:**
```http
POST /api/v1/event
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "HVAC Service - Furnace Repair",
  "descr": "Emergency service call for furnace not heating. Customer reports cold air from vents.",
  "event_entity_action": "hvac_repair",
  "event_medium": "onsite",
  "event_addr": "123 Main Street, Toronto, ON M4W 1N4",
  "event_instructions": "Customer has two dogs (friendly). Park in driveway. Ring doorbell at main entrance.",
  "event_metadata": {
    "task_id": "task-uuid",
    "customer_id": "cust-uuid",
    "employee_id": "emp-uuid",
    "service_category": "HVAC",
    "urgency_level": "urgent",
    "estimated_duration_minutes": 120,
    "customer_phone": "+14165551234"
  },
  "reminder_sent_flag": false,
  "confirmation_sent_flag": false
}
```

**Response:**
```json
{
  "id": "evt-uuid",
  "code": "EVT-20251106-789",
  "name": "HVAC Service - Furnace Repair",
  "event_medium": "onsite",
  "created_ts": "2025-11-05T14:06:00Z"
}
```

### Step 2: Book Calendar Slots

**API Endpoint:**
```http
POST /api/v1/calendar/book
Authorization: Bearer <token>
Content-Type: application/json

{
  "employee_id": "emp-uuid-1",
  "event_id": "evt-uuid",
  "from_ts": "2025-11-06T14:00:00Z",
  "to_ts": "2025-11-06T16:00:00Z",
  "name": "HVAC Service - Furnace Repair"
}
```

**Response:**
```json
{
  "success": true,
  "slots_booked": 8,
  "from_ts": "2025-11-06T14:00:00Z",
  "to_ts": "2025-11-06T16:00:00Z",
  "employee_id": "emp-uuid-1",
  "event_id": "evt-uuid"
}
```

### Step 3: Link Event to Task

**API Endpoint:**
```http
PUT /api/v1/task/:taskId
Authorization: Bearer <token>
Content-Type: application/json

{
  "metadata": {
    "event_id": "evt-uuid",
    "scheduled_at": "2025-11-06T14:00:00Z"
  }
}
```

---

## API Endpoints

### Customer Management

#### 1. Lookup Customer by Phone
```http
GET /api/v1/cust?phone=+14165551234
Authorization: Bearer <token>
```

#### 2. Create Customer
```http
POST /api/v1/cust
Authorization: Bearer <token>
Content-Type: application/json

{
  "phone": "+14165551234",
  "name": "John Smith",
  "email": "john@example.com",
  "metadata": {
    "created_via": "ai_agent",
    "conversation_id": "conv-123"
  }
}
```

### Task Management

#### 3. Create Task
```http
POST /api/v1/task
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Emergency HVAC Repair",
  "descr": "Furnace not heating...",
  "metadata": {
    "service_category": "HVAC",
    "customer_phone": "+14165551234",
    "urgency_level": "urgent"
  }
}
```

#### 4. Update Task
```http
PUT /api/v1/task/:taskId
Authorization: Bearer <token>
Content-Type: application/json

{
  "metadata": {
    "customer_id": "cust-uuid"
  }
}
```

### Service Catalog

#### 5. Get Service Categories
```http
GET /api/v1/datalabel?name=dl__service_category
Authorization: Bearer <token>
```

#### 6. Search Services
```http
GET /api/v1/service?service_category=HVAC&search=furnace
Authorization: Bearer <token>
```

### Employee Matching

#### 7. Find Employees by Skills
```http
GET /api/v1/employee?skills_service_categories=HVAC&active=true
Authorization: Bearer <token>
```

#### 8. Check Employee Availability
```http
GET /api/v1/employee/:employeeId/availability?from=2025-11-06T14:00:00Z&to=2025-11-06T16:00:00Z
Authorization: Bearer <token>
```

### Event & Calendar

#### 9. Create Event
```http
POST /api/v1/event
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "HVAC Service Call",
  "event_entity_action": "hvac_repair",
  "event_medium": "onsite",
  "event_addr": "123 Main St, Toronto",
  "event_metadata": {
    "task_id": "task-uuid",
    "employee_id": "emp-uuid"
  }
}
```

#### 10. Book Calendar Slots
```http
POST /api/v1/calendar/book
Authorization: Bearer <token>
Content-Type: application/json

{
  "employee_id": "emp-uuid",
  "event_id": "evt-uuid",
  "from_ts": "2025-11-06T14:00:00Z",
  "to_ts": "2025-11-06T16:00:00Z"
}
```

---

## Data Models

### Employee Skills

```typescript
interface Employee {
  id: string;
  code: string;
  name: string;
  department: string;
  skills_service_categories: string[];  // Array of service categories: ['HVAC', 'Plumbing', 'Electrical']
  phone: string;
  email: string;
  active_flag: boolean;
}
```

**Example Values:**
```typescript
// Specialized HVAC Technician
skills_service_categories: ["HVAC"]

// General Handyman
skills_service_categories: ["HVAC", "Plumbing", "Electrical", "Landscaping"]

// Plumbing Specialist
skills_service_categories: ["Plumbing"]
```

### Service

```typescript
interface Service {
  id: string;
  code: string;
  name: string;
  descr: string;
  service_category: string;  // References dl__service_category settings
  standard_rate_amt: number;
  estimated_hours: number;
  minimum_charge_amt: number;
  taxable_flag: boolean;
  requires_certification_flag: boolean;
}
```

### Task

```typescript
interface Task {
  id: string;
  code: string;
  name: string;
  descr: string;
  stage: string;
  metadata: {
    service_category: string;
    service_id?: string;
    customer_id?: string;
    customer_phone: string;
    customer_name?: string;
    urgency_level: 'emergency' | 'urgent' | 'normal' | 'scheduled';
    service_address: string;
    conversation_id: string;
    assigned_employee_id?: string;
    event_id?: string;
    scheduled_at?: string;
  };
}
```

### Event

```typescript
interface Event {
  id: string;
  code: string;
  name: string;
  descr: string;
  event_entity_action: string;  // e.g., 'hvac_repair', 'plumbing_service'
  event_medium: string;          // e.g., 'onsite', 'phone', 'video'
  event_addr: string;
  event_instructions: string;
  event_metadata: {
    task_id: string;
    customer_id: string;
    employee_id: string;
    service_category: string;
    estimated_duration_minutes: number;
  };
}
```

### Calendar Slot

```typescript
interface CalendarSlot {
  id: string;
  person_entity_type: 'employee' | 'customer';
  person_entity_id: string;
  from_ts: string;              // ISO 8601 timestamp
  to_ts: string;                // ISO 8601 timestamp
  availability_flag: boolean;   // true = available, false = booked
  event_id?: string;            // Reference to event if booked
  name?: string;                // Description of booking
}
```

---

## Example Conversations

### Scenario 1: New Customer - Emergency HVAC

**Customer:** Hi, I need help with my furnace

**AI Agent:** I'd be happy to help! Can I get your phone number so we can assist you?

**Customer:** Sure, it's 416-555-1234

**AI Agent:** *[System checks: Customer not found - will create new record]*
Thank you! What seems to be the problem with your furnace?

**Customer:** It's been running for 30 minutes but only blowing cold air

**AI Agent:** I understand, that must be uncomfortable. How urgent is this issue?

**Customer:** Pretty urgent, it's getting cold in the house

**AI Agent:** When would you like a technician to come by?

**Customer:** Today if possible, anytime this afternoon

**AI Agent:** What's the address where we should send the technician?

**Customer:** 123 Main Street, Toronto

**AI Agent:** Perfect! Any special instructions for our technician? Parking, access codes, pets?

**Customer:** I have two friendly dogs, and you can park in the driveway

**AI Agent:** *[System executes workflow]*
- ✅ Task created: TASK-123
- ✅ Customer created: CL-RES-456 (416-555-1234)
- ✅ Matched employee: Mike Chen (HVAC specialist)
- ✅ Available slot found: Today 2:00 PM - 4:00 PM
- ✅ Event created: EVT-20251106-789
- ✅ Calendar booked: 8 slots reserved

Great news! I've scheduled Mike Chen, our HVAC specialist, to visit you today at 2:00 PM. He'll have a 2-hour window to diagnose and repair your furnace. You'll receive a confirmation text at 416-555-1234 shortly. Is there anything else you need?

---

### Scenario 2: Existing Customer - Routine Service

**Customer:** Hi, I need to schedule my annual AC maintenance

**AI Agent:** Of course! Can I have your phone number?

**Customer:** 416-555-9876

**AI Agent:** *[System checks: Existing customer found - Sarah Johnson, CL-RES-012]*
Welcome back, Sarah! I see you had your furnace serviced with us in March. When would you like to schedule your AC maintenance?

**Customer:** Next week sometime, maybe Tuesday or Wednesday

**AI Agent:** *[System checks: Multiple HVAC techs available Tuesday/Wednesday]*
I have availability on Tuesday, November 12th at 10:00 AM or Wednesday, November 13th at 2:00 PM. Which works better for you?

**Customer:** Wednesday at 2 works great

**AI Agent:** Perfect! I'll book that for you. Same address - 456 Oak Avenue, correct?

**Customer:** Yes, that's right

**AI Agent:** *[System executes workflow]*
- ✅ Task created: TASK-456
- ✅ Linked to existing customer: CL-RES-012
- ✅ Assigned employee: Mike Chen (your previous tech)
- ✅ Event created: EVT-20251113-890
- ✅ Calendar booked: Wednesday, Nov 13, 2-3 PM

All set, Sarah! Mike Chen will be there on Wednesday, November 13th at 2:00 PM for your AC maintenance. You'll receive a reminder the day before. See you then!

---

## Implementation Guide

### Backend Implementation (Fastify API)

**1. AI Agent Service Integration**

```typescript
// apps/api/src/services/aiAgentService.ts
import { FastifyInstance } from 'fastify';

export class AIAgentService {
  private apiUrl: string;
  private authToken: string;

  constructor(private fastify: FastifyInstance) {
    this.apiUrl = process.env.API_URL || 'http://localhost:4000';
  }

  async processCustomerRequest(request: {
    phoneNumber: string;
    conversation: ConversationMessage[];
    extractedInfo: ExtractedServiceInfo;
  }) {

    // STEP 1: Customer Identification
    const customer = await this.identifyCustomer(request.phoneNumber);

    // STEP 2: Create Task (FIRST)
    const task = await this.createServiceTask({
      ...request.extractedInfo,
      customerPhone: request.phoneNumber,
      customerId: customer?.id  // null if new customer
    });

    // STEP 3: Create Customer (if new)
    let finalCustomer = customer;
    if (!customer) {
      finalCustomer = await this.createCustomer({
        phone: request.phoneNumber,
        name: request.extractedInfo.customerName,
        initialTaskId: task.id,
        conversationId: request.conversationId
      });

      // Link customer to task
      await this.linkCustomerToTask(finalCustomer.id, task.id);
    }

    // STEP 4: Find and Assign Employee
    const employee = await this.assignEmployee({
      taskId: task.id,
      serviceCategory: request.extractedInfo.serviceCategory,
      preferredDateTime: request.extractedInfo.preferredDateTime,
      durationMinutes: request.extractedInfo.estimatedDuration
    });

    // STEP 5: Create Event and Book Calendar
    const event = await this.createEvent({
      taskId: task.id,
      customerId: finalCustomer.id,
      employeeId: employee.id,
      ...request.extractedInfo
    });

    await this.bookCalendarSlots({
      employeeId: employee.id,
      eventId: event.id,
      fromTs: request.extractedInfo.startTime,
      toTs: request.extractedInfo.endTime
    });

    // STEP 6: Send Confirmations
    await this.sendConfirmations({
      customer: finalCustomer,
      employee: employee,
      event: event,
      task: task
    });

    return {
      success: true,
      task,
      customer: finalCustomer,
      employee,
      event,
      appointment: {
        dateTime: event.startTime,
        duration: request.extractedInfo.estimatedDuration
      }
    };
  }

  private async identifyCustomer(phoneNumber: string) {
    const response = await fetch(
      `${this.apiUrl}/api/v1/cust?phone=${phoneNumber}`,
      {
        headers: { 'Authorization': `Bearer ${this.authToken}` }
      }
    );
    const data = await response.json();
    return data.data[0] || null;
  }

  private async createServiceTask(data: TaskCreationData) {
    const response = await fetch(
      `${this.apiUrl}/api/v1/task`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: data.name,
          descr: data.descr,
          metadata: {
            service_category: data.serviceCategory,
            customer_phone: data.customerPhone,
            urgency_level: data.urgencyLevel,
            ...data.metadata
          }
        })
      }
    );
    return await response.json();
  }

  private async assignEmployee(params: EmployeeAssignmentParams) {
    // Find qualified employees
    const empResponse = await fetch(
      `${this.apiUrl}/api/v1/employee?skills_service_categories=${params.serviceCategory}&active=true`,
      {
        headers: { 'Authorization': `Bearer ${this.authToken}` }
      }
    );
    const employees = await empResponse.json();

    // Check availability for each
    for (const employee of employees.data) {
      const availResponse = await fetch(
        `${this.apiUrl}/api/v1/employee/${employee.id}/availability?from=${params.preferredDateTime.toISOString()}&duration=${params.durationMinutes}`,
        {
          headers: { 'Authorization': `Bearer ${this.authToken}` }
        }
      );
      const availability = await availResponse.json();

      if (availability.available && availability.total_available_minutes >= params.durationMinutes) {
        // Found available employee - assign task
        await fetch(
          `${this.apiUrl}/api/v1/task/${params.taskId}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${this.authToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              metadata: {
                assigned_employee_id: employee.id,
                assigned_at: new Date().toISOString()
              }
            })
          }
        );

        return employee;
      }
    }

    throw new Error('No available employees found');
  }

  private async bookCalendarSlots(params: CalendarBookingParams) {
    const response = await fetch(
      `${this.apiUrl}/api/v1/calendar/book`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employee_id: params.employeeId,
          event_id: params.eventId,
          from_ts: params.fromTs,
          to_ts: params.toTs
        })
      }
    );
    return await response.json();
  }
}
```

**2. API Route Handler**

```typescript
// apps/api/src/modules/ai-agent/routes.ts
import { FastifyPluginAsync } from 'fastify';
import { AIAgentService } from '../../services/aiAgentService';

const routes: FastifyPluginAsync = async (fastify) => {
  const aiService = new AIAgentService(fastify);

  // Process customer service request from AI chat
  fastify.post('/api/v1/ai-agent/service-request', async (request, reply) => {
    const { phoneNumber, conversation, extractedInfo } = request.body;

    try {
      const result = await aiService.processCustomerRequest({
        phoneNumber,
        conversation,
        extractedInfo
      });

      return reply.code(200).send(result);
    } catch (error) {
      return reply.code(500).send({
        error: 'Failed to process service request',
        message: error.message
      });
    }
  });
};

export default routes;
```

### Frontend Implementation (React)

**AI Chat Widget:**

```typescript
// apps/web/src/components/AIServiceChat.tsx
import React, { useState } from 'react';
import { useAIAgent } from '../hooks/useAIAgent';

export const AIServiceChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const { sendMessage, isProcessing } = useAIAgent();

  const handleSendMessage = async (text: string) => {
    // Add user message
    setMessages([...messages, { role: 'user', text }]);

    // Send to AI agent
    const response = await sendMessage(text);

    // Add AI response
    setMessages([...messages,
      { role: 'user', text },
      { role: 'assistant', text: response.message }
    ]);

    // If service request completed, show confirmation
    if (response.serviceRequest) {
      showServiceConfirmation(response.serviceRequest);
    }
  };

  return (
    <div className="ai-chat-widget">
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            {msg.text}
          </div>
        ))}
      </div>

      <input
        type="text"
        placeholder="Describe your service need..."
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            handleSendMessage(e.currentTarget.value);
            e.currentTarget.value = '';
          }
        }}
        disabled={isProcessing}
      />
    </div>
  );
};
```

---

## Error Handling

### Common Scenarios

**1. No Available Employees**
```typescript
if (qualifiedEmployees.length === 0) {
  // No employees with required skills
  return {
    error: 'NO_QUALIFIED_EMPLOYEES',
    message: 'No technicians available with required skills',
    alternativeActions: [
      'Schedule for later date',
      'Refer to partner company',
      'Add to waitlist'
    ]
  };
}

if (availableEmployees.length === 0) {
  // Employees exist but all busy
  const nextAvailable = await findNextAvailableSlot(serviceCategory);

  return {
    error: 'NO_AVAILABILITY',
    message: 'All technicians are currently booked',
    nextAvailableTime: nextAvailable.dateTime,
    alternativeActions: [
      `Schedule for ${nextAvailable.dateTime}`,
      'Request emergency priority',
      'Add to cancellation list'
    ]
  };
}
```

**2. Customer Phone Validation Failed**
```typescript
if (!isValidPhoneNumber(phoneNumber)) {
  return {
    error: 'INVALID_PHONE',
    message: 'Please provide a valid phone number',
    prompt: 'Could you please verify your phone number? It should be 10 digits.'
  };
}
```

**3. Service Category Not Found**
```typescript
if (!serviceCategory) {
  return {
    error: 'UNCLEAR_SERVICE_TYPE',
    message: 'Could not determine service type',
    prompt: 'Could you describe the issue in more detail? For example: plumbing, electrical, HVAC, etc.',
    suggestions: [
      'Plumbing (leaks, drains, pipes)',
      'HVAC (heating, cooling, furnace)',
      'Electrical (outlets, wiring, panels)',
      'Landscaping (lawn, garden, outdoor)'
    ]
  };
}
```

**4. Task Creation Failed**
```typescript
try {
  const task = await createTask(taskData);
} catch (error) {
  // Rollback and retry
  await logError('TASK_CREATION_FAILED', error);

  return {
    error: 'SYSTEM_ERROR',
    message: 'Unable to create service request. Please try again.',
    retryAction: true,
    supportContact: '+1-416-555-HELP'
  };
}
```

---

## Next Steps

### Phase 1: Core Implementation ✅
- [x] Database schema (d_event, d_entity_person_calendar, d_service)
- [ ] AI agent service class
- [ ] Customer identification logic
- [ ] Task creation workflow
- [ ] Employee assignment algorithm

### Phase 2: Integration
- [ ] Connect to AI/LLM service (OpenAI, Claude, etc.)
- [ ] Build conversation state management
- [ ] Implement natural language extraction
- [ ] Create API endpoints
- [ ] Add authentication/authorization

### Phase 3: Frontend
- [ ] AI chat widget component
- [ ] Service request confirmation UI
- [ ] Real-time availability calendar
- [ ] Customer portal for existing customers
- [ ] Employee mobile app for assignments

### Phase 4: Notifications
- [ ] SMS confirmations to customers
- [ ] Push notifications to assigned employees
- [ ] Email summaries
- [ ] Reminder system (24 hours before)
- [ ] Follow-up surveys

### Phase 5: Analytics
- [ ] Track conversion rates (chat → booking)
- [ ] Monitor employee utilization
- [ ] Measure customer satisfaction
- [ ] Analyze service demand patterns
- [ ] Optimize assignment algorithm

---

## Questions & Troubleshooting

**Q: What if customer provides incomplete information?**
A: AI agent should prompt for missing required fields: service type, urgency, location, preferred time. Task is only created once minimum required info is collected.

**Q: Can customer request specific employee?**
A: Yes. Check `metadata.preferred_employee_id` and prioritize in assignment algorithm, but still verify skills and availability.

**Q: How to handle time zone differences?**
A: Store all timestamps as UTC. Convert to customer's local time zone for display and booking confirmations.

**Q: What if employee needs to cancel?**
A: Update calendar slots back to available via API, find alternative employee, notify customer of change.

**Q: How to track conversation history?**
A: Use `f_interaction` table via `/api/v1/interaction` endpoints to store full conversation thread, link via `conversation_id` in task metadata.

---

**Documentation Version:** 2.0
**Last Updated:** 2025-11-05
**Maintained By:** PMO Platform Team
**Focus:** API-Level Integration (No SQL)
