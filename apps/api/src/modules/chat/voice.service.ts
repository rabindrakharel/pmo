/**
 * OpenAI Realtime Voice Service
 * Handles WebSocket connections for voice conversations with AI
 * @module chat/voice.service
 */

import WebSocket from 'ws';
import { functionTools } from './functions.service.js';
import { getMCPTools, executeMCPTool, getCustomerServiceTools } from './mcp-adapter.service.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';

/**
 * Voice session configuration
 */
export interface VoiceSessionConfig {
  sessionId: string;
  interactionSessionId?: string;
  instructions?: string;
  authToken?: string;
}

/**
 * System instructions for voice agent
 * Concise version optimized for OpenAI Realtime API limits
 */
const VOICE_SYSTEM_INSTRUCTIONS = `You are Huron Home Services' AI receptionist. You ONLY help with Huron Home Services - nothing else. STRICTLY REFUSE if the questions aren't from prospect clients
, or existing clients. 

COMPANY INFORMATION:
- Services: HVAC, Plumbing, Electrical, Landscaping, General Contracting
- Coverage: Toronto, Mississauga, Oakville, Burlington, Hamilton, Brampton, Vaughan (GTA, Ontario)
- Hours: Mon-Fri 8AM-6PM, Sat 9AM-5PM, Sun Emergency Only
- Emergency: 24/7 for HVAC and Plumbing

STRICT BOUNDARIES - NEVER DEVIATE:
1. Start with "Hi, Good morning/afternoon/evening, I am assistant for huron services. How can I help you with today?"
2. If asked about ANYTHING outside Huron services (weather, news, general questions, other companies), respond ONLY: "I'm specifically here for Huron Home Services bookings and support. Can I help you with one of our services?"
3. ALWAYS use API tools for real data - never guess
4. Keep responses brief (2-3 sentences max)
5. Ask ONE question at a time
6. Confirm details by repeating them back
7. NEVER ask for information the customer has ALREADY provided in this conversation

CONVERSATION MEMORY - CRITICAL:
- TRACK ALL INFORMATION: Once customer provides name, phone, address, issue, service type, date, or ANY detail, REMEMBER IT
- NEVER RE-ASK: If customer said "I'm John" and "647-555-1234", DO NOT ask "Can I get your name?" or "What's your phone?" again
- BUILD ON CONTEXT: Use previously provided info to move forward
- REFERENCE MEMORY: "Got it, let me update your address to 123 Main St" (not "What's your address?")
- STORED INFO: After calling create_customer or customer_update, that info is SAVED - don't ask again

VOICE CONVERSATION STYLE:
- You GREET FIRST. Greet warmly: "Hi! This is Huron Home Services. How can I help you today?"
- Speak naturally and conversationally in Canadian English
- IMMEDIATE SUPPORT: First ask "Can I get your name and phone number?" then say "We're helping right away!"

INCREMENTAL CUSTOMER DATA COLLECTION (CRITICAL WORKFLOW):
1. START: Get name and phone FIRST (if not already provided)
2. SEARCH: Call customer_list with phone search to find existing customer
3. CREATE: If not found, call customer_create with ONLY name and phone
   - IMMEDIATELY extract and SAVE the customer ID from the response
   - This ID is CRITICAL for all subsequent operations
4. UPDATE INCREMENTALLY: As customer provides MORE info (address, email, postal code, etc.), IMMEDIATELY call customer_update with:
   - The saved customer_id
   - ONLY the new field(s) just provided (e.g., {customer_id: "...", address: "123 Main St"})
   - You can update ONE field at a time or multiple fields together
5. USE SAVED ID: When creating bookings/tasks, always link to the customer using the saved customer_id
6. NO RE-ASKING: After updating a field, that field is STORED - never ask for it again

EXAMPLE FLOW:
- Customer: "I'm John, 647-555-1234"
- AI: [Calls customer_create({name: "John", phone: "647-555-1234"})] "Perfect John, I've got your info. What service do you need?"
- Customer: "I need plumbing at 123 Main St, Toronto"
- AI: [Calls customer_update({customer_id: "...", address: "123 Main St", city: "Toronto"})] "Great, checking plumber availability for 123 Main St..."
- Customer: "My postal code is M5A 1A1"
- AI: [Calls customer_update({customer_id: "...", postal_code: "M5A 1A1"})] "Got it, M5A 1A1. Looking for available times..."

EMPATHY & REASSURANCE:
- When customer describes issue: "That sounds {frustrating/concerning/difficult}. You're in good hands."
- Always: "We'll help right away. You're in good hands."
- Check availability before confirming appointments
- Provide confirmation numbers after creating bookings

TOOL USAGE:
- Use project_list, task_list, employee_list, booking tools, etc. to fetch real data
- Use project_create, task_create, booking_create to save new records
- If a tool fails, explain clearly and offer alternatives
- All data is real-time from our PMO database

ABSOLUTE RULE - REFUSE OFF-TOPIC REQUESTS:
If customer asks ANYTHING not related to Huron Home Services (weather, jokes, general questions, other companies, trivia, advice), you MUST respond:
"I'm specifically here for Huron Home Services bookings and support. Can I help you with HVAC, plumbing, electrical, landscaping, or contracting?"

DO NOT engage with off-topic conversations. DO NOT answer general questions. You are ONLY a Huron Home Services receptionist.`;

/**
 * Convert MCP ChatCompletionTool format to Realtime API format
 * Chat format: { type: 'function', function: { name, description, parameters } }
 * Realtime format: { type: 'function', name, description, parameters }
 */
function convertMCPToolsToRealtimeFormat(mcpTools: any[]): any[] {
  return mcpTools.map(tool => ({
    type: 'function',
    ...tool.function
  }));
}

/**
 * Get MCP tools formatted for Realtime API
 */
function getRealtimeMCPTools(): any[] {
  const mcpTools = getCustomerServiceTools();
  console.log(`📡 Loading ${mcpTools.length} MCP tools for voice agent`);
  return convertMCPToolsToRealtimeFormat(mcpTools);
}

/**
 * Create and manage OpenAI Realtime voice session
 */
export class VoiceSession {
  private openaiWs: WebSocket | null = null;
  private clientWs: WebSocket;
  private sessionId: string;
  private interactionSessionId?: string;
  private authToken?: string;
  private isConnected = false;

  constructor(clientWs: WebSocket, config: VoiceSessionConfig) {
    this.clientWs = clientWs;
    this.sessionId = config.sessionId;
    this.interactionSessionId = config.interactionSessionId;
    this.authToken = config.authToken;
  }

  /**
   * Initialize connection to OpenAI Realtime API
   */
  async connect(): Promise<void> {
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    return new Promise((resolve, reject) => {
      // Connect to OpenAI Realtime API
      this.openaiWs = new WebSocket(OPENAI_REALTIME_URL, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      });

      this.openaiWs.on('open', () => {
        console.log(`✅ OpenAI Realtime connected for session ${this.sessionId}`);
        this.isConnected = true;

        // Get MCP tools
        const mcpTools = getRealtimeMCPTools();
        console.log(`📦 Loaded ${mcpTools.length} MCP tools for voice agent`);
        console.log(`🛠️ Tool categories: Project, Task, Employee, Customer, Business, Booking, Wiki, Form, etc.`);

        // Log first few tool names for verification
        const toolNames = mcpTools.slice(0, 10).map((t: any) => t.name).join(', ');
        console.log(`🔧 Sample tools: ${toolNames}...`);

        // Configure session
        this.sendToOpenAI({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: VOICE_SYSTEM_INSTRUCTIONS,
            voice: 'coral',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1'
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500
            },
            tools: mcpTools,
            tool_choice: 'auto',
            temperature: 0.8
          }
        });

        resolve();
      });

      this.openaiWs.on('message', (data: WebSocket.Data) => {
        this.handleOpenAIMessage(data);
      });

      this.openaiWs.on('error', (error) => {
        console.error('OpenAI WebSocket error:', error);
        this.clientWs.send(JSON.stringify({
          type: 'error',
          error: 'OpenAI connection error'
        }));
        reject(error);
      });

      this.openaiWs.on('close', () => {
        console.log(`🔌 OpenAI Realtime disconnected for session ${this.sessionId}`);
        this.isConnected = false;
        this.clientWs.close();
      });

      // Handle messages from client (browser)
      this.clientWs.on('message', (data: WebSocket.Data) => {
        this.handleClientMessage(data);
      });

      this.clientWs.on('close', () => {
        console.log(`👋 Client disconnected from voice session ${this.sessionId}`);
        this.cleanup();
      });
    });
  }

  /**
   * Handle messages from client (browser)
   */
  private handleClientMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());

      // Forward audio data to OpenAI
      if (message.type === 'input_audio_buffer.append') {
        this.sendToOpenAI(message);
      }
      // Commit audio buffer
      else if (message.type === 'input_audio_buffer.commit') {
        this.sendToOpenAI(message);
      }
      // Cancel response
      else if (message.type === 'response.cancel') {
        this.sendToOpenAI(message);
      }
    } catch (error) {
      console.error('Error handling client message:', error);
    }
  }

  /**
   * Handle messages from OpenAI Realtime API
   */
  private async handleOpenAIMessage(data: WebSocket.Data): Promise<void> {
    try {
      const message = JSON.parse(data.toString());

      // Handle function calls
      if (message.type === 'response.function_call_arguments.done') {
        await this.handleFunctionCall(message);
        return;
      }

      // Forward relevant messages to client
      if (this.shouldForwardToClient(message.type)) {
        this.clientWs.send(data.toString());
      }

      // Log important events
      if (message.type === 'conversation.item.input_audio_transcription.completed') {
        console.log(`🎤 User said: ${message.transcript}`);
      }
      if (message.type === 'response.audio_transcript.done') {
        console.log(`🤖 AI said: ${message.transcript}`);
      }
    } catch (error) {
      console.error('Error handling OpenAI message:', error);
    }
  }

  /**
   * Execute function call from AI
   */
  private async handleFunctionCall(message: any): Promise<void> {
    const functionName = message.name;
    const args = JSON.parse(message.arguments);

    console.log(`\n🔧 ═══════════════════════════════════════════════════`);
    console.log(`🎙️ Voice AI calling MCP tool: ${functionName}`);
    console.log(`📝 Arguments:`, JSON.stringify(args, null, 2));
    console.log(`🔑 Auth Token: ${this.authToken ? '✅ Available' : '❌ Missing'}`);

    try {
      let result: any;

      // Execute MCP tool if auth token is available
      if (this.authToken) {
        console.log(`📡 Executing MCP tool via PMO API...`);
        const startTime = Date.now();
        result = await executeMCPTool(functionName, args, this.authToken);
        const duration = Date.now() - startTime;
        console.log(`✅ Tool executed successfully in ${duration}ms`);
        console.log(`📦 Result:`, JSON.stringify(result, null, 2).substring(0, 500));
      } else {
        // Fall back to legacy function tools if no auth token
        console.log(`⚠️ No auth token available - using legacy tools`);
        if (functionName === 'create_booking') {
          result = await functionTools.create_booking(args, this.interactionSessionId);
        } else if (functionName === 'get_available_services') {
          result = await functionTools.get_available_services(args);
        } else if (functionName === 'get_employee_availability') {
          result = await functionTools.get_employee_availability(args);
        } else {
          console.log(`❌ Function not found in legacy tools: ${functionName}`);
          result = { error: 'Function not found - auth token required for this operation' };
        }
      }

      // Send function result back to OpenAI
      this.sendToOpenAI({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: message.call_id,
          output: JSON.stringify(result)
        }
      });

      // Request AI to respond
      this.sendToOpenAI({
        type: 'response.create'
      });

      console.log(`✅ MCP tool ${functionName} completed - sending result to AI`);
      console.log(`═══════════════════════════════════════════════════\n`);
    } catch (error) {
      console.error(`\n❌ ERROR: MCP tool ${functionName} failed`);
      console.error(`Error details:`, error);

      // Send error back to OpenAI
      this.sendToOpenAI({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: message.call_id,
          output: JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      });
    }
  }

  /**
   * Determine if message should be forwarded to client
   */
  private shouldForwardToClient(type: string): boolean {
    const forwardTypes = [
      'session.created',
      'session.updated',
      'conversation.item.created',
      'conversation.item.input_audio_transcription.completed',
      'response.audio.delta',
      'response.audio.done',
      'response.audio_transcript.delta',
      'response.audio_transcript.done',
      'response.done',
      'error'
    ];
    return forwardTypes.includes(type);
  }

  /**
   * Send message to OpenAI
   */
  private sendToOpenAI(message: any): void {
    if (this.openaiWs && this.isConnected) {
      this.openaiWs.send(JSON.stringify(message));
    }
  }

  /**
   * Cleanup connections
   */
  private cleanup(): void {
    if (this.openaiWs) {
      this.openaiWs.close();
      this.openaiWs = null;
    }
    this.isConnected = false;
  }
}
