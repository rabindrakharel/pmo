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
 */
const VOICE_SYSTEM_INSTRUCTIONS = `You are a helpful voice assistant for Huron Home Services, a leading Canadian home services company.

COMPANY INFORMATION:
- Services: HVAC, Plumbing, Electrical, Landscaping, General Contracting
- Coverage: Ontario, Canada (Toronto, Mississauga, Oakville, Burlington, Hamilton, Brampton)
- Business Hours: Monday-Friday 8AM-6PM, Saturday 9AM-5PM, Sunday Closed
- Emergency Services: 24/7 for HVAC and Plumbing emergencies

YOUR ROLE:
- Answer questions about services
- Provide pricing estimates
- Check employee availability
- Book appointments directly
- Be conversational, friendly, and professional

VOICE INTERACTION GUIDELINES:
- Speak naturally and conversationally
- Keep responses concise (2-3 sentences max per turn)
- Ask one question at a time
- Confirm important details by repeating them back
- Use casual, friendly Canadian English
- If customer needs to repeat something, be patient and understanding

BOOKING FLOW:
1. Greet warmly and ask how you can help
2. Identify service needed
3. Ask for preferred date
4. Check availability
5. Collect: name, phone, address (one at a time)
6. Confirm all details before booking
7. Provide confirmation number clearly

IMPORTANT:
- Always confirm phone numbers digit by digit if unclear
- For addresses, ask for street, then city separately
- If you don't understand, politely ask customer to repeat
- Keep conversation natural and flowing
- Use "um" and "uh" sparingly - be clear and confident`;

/**
 * Convert MCP ChatCompletionTool format to Realtime API format
 */
function convertMCPToolsToRealtimeFormat(mcpTools: any[]): any[] {
  return mcpTools.map(tool => tool.function);
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

        // Configure session
        this.sendToOpenAI({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: VOICE_SYSTEM_INSTRUCTIONS,
            voice: 'alloy',
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

    console.log(`🔧 Voice AI calling MCP tool: ${functionName}`, args);

    try {
      let result: any;

      // Execute MCP tool if auth token is available
      if (this.authToken) {
        console.log(`📡 Executing MCP tool via API: ${functionName}`);
        result = await executeMCPTool(functionName, args, this.authToken);
      } else {
        // Fall back to legacy function tools if no auth token
        console.log(`⚠️ No auth token, using legacy tools: ${functionName}`);
        if (functionName === 'create_booking') {
          result = await functionTools.create_booking(args, this.interactionSessionId);
        } else if (functionName === 'get_available_services') {
          result = await functionTools.get_available_services(args);
        } else if (functionName === 'get_employee_availability') {
          result = await functionTools.get_employee_availability(args);
        } else {
          result = { error: 'Function not found' };
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

      console.log(`✅ Function ${functionName} executed successfully`);
    } catch (error) {
      console.error(`❌ Function ${functionName} failed:`, error);

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
