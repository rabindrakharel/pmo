/**
 * Voice Service using Langraph Orchestrator
 * Handles WebSocket connections for voice conversations with Whisper STT + Langraph + TTS
 * @module chat/voice-langraph.service
 */

import WebSocket from 'ws';
import { processVoiceMessage } from './orchestrator/voice-orchestrator.service.js';
import { disconnectVoiceSession } from './voice.service.js';

/**
 * Voice session configuration
 */
export interface VoiceLangraphSessionConfig {
  sessionId: string;
  interactionSessionId?: string;
  authToken?: string;
}

/**
 * Global registry of active voice sessions
 */
const activeVoiceSessions = new Map<string, VoiceLangraphSession>();

/**
 * Mapping from interaction session ID to voice session ID
 */
const interactionToVoiceSessionMap = new Map<string, string>();

/**
 * Create and manage voice session with Langraph orchestrator
 */
export class VoiceLangraphSession {
  private clientWs: WebSocket;
  private sessionId: string;
  private interactionSessionId?: string;
  private authToken?: string;
  private isConnected = false;
  private audioBuffer: Buffer[] = [];
  private isProcessing = false;
  private orchestratorSessionId?: string; // Langraph session ID

  constructor(clientWs: WebSocket, config: VoiceLangraphSessionConfig) {
    this.clientWs = clientWs;
    this.sessionId = config.sessionId;
    this.interactionSessionId = config.interactionSessionId;
    this.authToken = config.authToken;

    // Register this session
    registerVoiceLangraphSession(this.sessionId, this);
  }

  /**
   * Initialize connection and set up handlers
   */
  async connect(): Promise<void> {
    this.isConnected = true;

    console.log(`✅ Voice Langraph session ${this.sessionId} established`);

    // Handle messages from client (browser)
    this.clientWs.on('message', async (data: WebSocket.Data) => {
      await this.handleClientMessage(data);
    });

    this.clientWs.on('close', () => {
      console.log(`👋 Client disconnected from voice session ${this.sessionId}`);
      this.cleanup();
    });

    this.clientWs.on('error', (error) => {
      console.error(`❌ Client WebSocket error for session ${this.sessionId}:`, error);
    });

    // Send initial greeting
    setTimeout(async () => {
      try {
        // Import the langraph orchestrator and TTS
        const { getLangGraphOrchestratorService } = await import('./orchestrator/langgraph/langgraph-orchestrator.service.js');
        const { textToSpeech } = await import('./orchestrator/voice-orchestrator.service.js');

        const orchestrator = getLangGraphOrchestratorService();

        // Send [CALL_STARTED] trigger to orchestrator
        const greetingResult = await orchestrator.processMessage({
          sessionId: this.orchestratorSessionId,
          message: '[CALL_STARTED]',
          authToken: this.authToken,
          chatSessionId: this.interactionSessionId
        });

        this.orchestratorSessionId = greetingResult.sessionId;

        // Convert greeting text to speech
        const greetingAudio = await textToSpeech(greetingResult.response, 'nova');

        // Send greeting audio to client
        this.clientWs.send(JSON.stringify({
          type: 'audio.response',
          audio: greetingAudio.toString('base64'),
          transcript: greetingResult.response,
          session_id: this.orchestratorSessionId,
          intent: greetingResult.intent,
          current_node: greetingResult.currentNode
        }));

        console.log(`🎙️ Sent initial greeting for session ${this.sessionId}: "${greetingResult.response}"`);
      } catch (error) {
        console.error(`Error sending initial greeting:`, error);
      }
    }, 500);
  }

  /**
   * Handle messages from client (browser)
   */
  private async handleClientMessage(data: WebSocket.Data): Promise<void> {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'audio.append') {
        // Accumulate audio data
        const audioChunk = Buffer.from(message.audio, 'base64');
        this.audioBuffer.push(audioChunk);
        console.log(`📥 Received audio chunk: ${audioChunk.length} bytes (total chunks: ${this.audioBuffer.length})`);
      } else if (message.type === 'audio.commit') {
        // Process accumulated audio
        await this.processAudio();
      } else if (message.type === 'audio.cancel') {
        // Cancel current audio
        this.audioBuffer = [];
        this.isProcessing = false;
        console.log(`🚫 Audio cancelled for session ${this.sessionId}`);
      }
    } catch (error) {
      console.error('Error handling client message:', error);
      this.clientWs.send(JSON.stringify({
        type: 'error',
        error: 'Failed to process message',
        message: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }

  /**
   * Process accumulated audio through Whisper + Langraph + TTS
   */
  private async processAudio(): Promise<void> {
    if (this.isProcessing) {
      console.log(`⏳ Already processing audio for session ${this.sessionId}, skipping`);
      return;
    }

    if (this.audioBuffer.length === 0) {
      console.log(`📭 No audio to process for session ${this.sessionId}`);
      return;
    }

    this.isProcessing = true;

    try {
      // Concatenate all audio chunks
      const fullAudioBuffer = Buffer.concat(this.audioBuffer);
      this.audioBuffer = []; // Clear buffer

      console.log(`🎤 Processing audio: ${fullAudioBuffer.length} bytes for session ${this.sessionId}`);

      // Send processing indicator to client
      this.clientWs.send(JSON.stringify({
        type: 'processing.started'
      }));

      // Process through Whisper + Langraph + TTS
      const result = await processVoiceMessage({
        sessionId: this.orchestratorSessionId,
        audioBuffer: fullAudioBuffer,
        audioFormat: 'webm',
        authToken: this.authToken,
        chatSessionId: this.interactionSessionId,
        voice: 'nova'
      });

      // Update orchestrator session ID for continuity
      this.orchestratorSessionId = result.sessionId;

      console.log(`✅ Voice processing complete: "${result.transcript}" → "${result.response}"`);
      console.log(`📊 Session: ${result.sessionId}, Intent: ${result.intent}, Node: ${result.currentNode}, Ended: ${result.conversationEnded}`);

      // Send response audio to client
      this.clientWs.send(JSON.stringify({
        type: 'audio.response',
        audio: result.audioBuffer.toString('base64'),
        transcript: result.response,
        user_transcript: result.transcript,
        session_id: result.sessionId,
        intent: result.intent,
        current_node: result.currentNode,
        completed: result.completed,
        conversation_ended: result.conversationEnded,
        end_reason: result.endReason
      }));

      // If conversation ended, disconnect
      if (result.conversationEnded) {
        console.log(`🔚 Conversation ended for session ${this.sessionId}: ${result.endReason}`);
        setTimeout(() => {
          this.disconnect();
        }, 2000); // Give time for final audio to play
      }

    } catch (error) {
      console.error(`❌ Error processing audio for session ${this.sessionId}:`, error);
      this.clientWs.send(JSON.stringify({
        type: 'error',
        error: 'Failed to process audio',
        message: error instanceof Error ? error.message : 'Unknown error'
      }));
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Public method to disconnect the voice session
   */
  public disconnect(): void {
    console.log(`🔌 Disconnecting voice Langraph session ${this.sessionId}`);

    // Send goodbye message to client before closing
    try {
      this.clientWs.send(JSON.stringify({
        type: 'session.disconnected',
        message: 'Voice call ended',
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error sending disconnect message:', error);
    }

    // Close WebSocket connection
    if (this.clientWs.readyState === WebSocket.OPEN) {
      this.clientWs.close();
    }

    this.cleanup();
  }

  /**
   * Cleanup connections and unregister session
   */
  private cleanup(): void {
    this.isConnected = false;
    this.audioBuffer = [];
    this.isProcessing = false;

    // Unregister this session from the global registry
    unregisterVoiceLangraphSession(this.sessionId);
  }

  /**
   * Get session information
   */
  public getSessionInfo() {
    return {
      sessionId: this.sessionId,
      interactionSessionId: this.interactionSessionId,
      orchestratorSessionId: this.orchestratorSessionId,
      isConnected: this.isConnected
    };
  }
}

/**
 * Register a voice session in the global registry
 */
export function registerVoiceLangraphSession(sessionId: string, session: VoiceLangraphSession): void {
  activeVoiceSessions.set(sessionId, session);

  // Also register the mapping from interaction session ID to voice session ID
  const sessionInfo = session.getSessionInfo();
  if (sessionInfo.interactionSessionId) {
    interactionToVoiceSessionMap.set(sessionInfo.interactionSessionId, sessionId);
    console.log(`📝 Registered voice Langraph session ${sessionId} (interaction: ${sessionInfo.interactionSessionId}) (Total active: ${activeVoiceSessions.size})`);
  } else {
    console.log(`📝 Registered voice Langraph session ${sessionId} (Total active: ${activeVoiceSessions.size})`);
  }
}

/**
 * Unregister a voice session from the global registry
 */
export function unregisterVoiceLangraphSession(sessionId: string): void {
  // Remove from both maps
  const session = activeVoiceSessions.get(sessionId);
  if (session) {
    const sessionInfo = session.getSessionInfo();
    if (sessionInfo.interactionSessionId) {
      interactionToVoiceSessionMap.delete(sessionInfo.interactionSessionId);
    }
  }
  activeVoiceSessions.delete(sessionId);
  console.log(`🗑️ Unregistered voice Langraph session ${sessionId} (Total active: ${activeVoiceSessions.size})`);
}

/**
 * Get active voice session by ID
 */
export function getVoiceLangraphSession(sessionId: string): VoiceLangraphSession | undefined {
  return activeVoiceSessions.get(sessionId);
}

/**
 * Disconnect a voice session by ID (supports both voice session ID and interaction session ID)
 */
export function disconnectVoiceLangraphSession(sessionId: string): boolean {
  // Try direct lookup first
  let session = activeVoiceSessions.get(sessionId);

  // If not found, try looking up by interaction session ID
  if (!session) {
    const voiceSessionId = interactionToVoiceSessionMap.get(sessionId);
    if (voiceSessionId) {
      session = activeVoiceSessions.get(voiceSessionId);
    }
  }

  if (session) {
    session.disconnect();
    return true;
  }
  return false;
}

/**
 * Get count of active voice sessions
 */
export function getActiveVoiceLangraphSessionCount(): number {
  return activeVoiceSessions.size;
}
