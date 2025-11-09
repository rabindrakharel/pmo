/**
 * Voice Service using Langraph Orchestrator
 * Handles WebSocket connections for voice conversations with Whisper STT + Langraph + TTS
 * @module chat/voice-langraph.service
 */

import WebSocket from 'ws';

/**
 * Convert raw PCM16 audio to WAV format with proper headers
 * @param pcmData - Raw PCM16 audio data (16-bit signed integers, mono, 24kHz)
 * @returns WAV file buffer with RIFF headers
 */
function pcm16ToWav(pcmData: Buffer): Buffer {
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length;

  // Create WAV header (44 bytes)
  const header = Buffer.alloc(44);

  // RIFF chunk descriptor
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4); // File size - 8
  header.write('WAVE', 8);

  // fmt sub-chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  // Concatenate header + PCM data
  return Buffer.concat([header, pcmData]);
}

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

    // Send initial greeting (simple TTS without LangGraph to avoid loops)
    setTimeout(async () => {
      try {
        const { textToSpeech } = await import('./orchestrator/voice-orchestrator.service.js');

        const greetingText = "Hi! I'm the assistant for Huron Home Services. How can I help you today?";

        // Convert greeting text to speech
        const greetingAudio = await textToSpeech(greetingText, 'nova');

        // Send greeting audio to client
        this.clientWs.send(JSON.stringify({
          type: 'audio.response',
          audio: greetingAudio.toString('base64'),
          transcript: greetingText,
          session_id: this.sessionId
        }));

        console.log(`🎙️ Sent initial greeting for session ${this.sessionId}`);
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
        // ✅ REMOVED: Noisy log - audio chunks received continuously during voice calls
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
   * Process accumulated audio through Whisper + Langraph + TTS (STREAMING)
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
      // Concatenate all audio chunks (raw PCM16 data)
      const rawPcmBuffer = Buffer.concat(this.audioBuffer);
      this.audioBuffer = []; // Clear buffer

      // Convert raw PCM16 to WAV format with headers
      const wavBuffer = pcm16ToWav(rawPcmBuffer);

      // Send processing indicator to client
      this.clientWs.send(JSON.stringify({
        type: 'processing.started'
      }));

      // Import streaming voice orchestrator
      const { processVoiceMessageStream } = await import('./orchestrator/voice-orchestrator.service.js');

      // Process through Whisper + Langraph + TTS (STREAMING)
      let fullTranscript = '';
      let fullResponse = '';
      let finalResult: any;

      for await (const chunk of processVoiceMessageStream({
        sessionId: this.orchestratorSessionId,
        audioBuffer: wavBuffer,
        audioFormat: 'wav',
        authToken: this.authToken,
        chatSessionId: this.interactionSessionId,
        voice: 'nova'
      })) {
        if (chunk.type === 'transcript') {
          // User's speech transcribed
          fullTranscript = chunk.userTranscript || '';
          console.log(`🎤 Deepgram STT: "${fullTranscript}"`);
        } else if (chunk.type === 'audio') {
          // Audio chunk generated - send immediately for progressive playback
          this.clientWs.send(JSON.stringify({
            type: 'audio.chunk',
            audio: chunk.audio!.toString('base64'),
            transcript: chunk.transcript
          }));
        } else if (chunk.type === 'done') {
          // Final metadata
          finalResult = chunk;
          fullResponse = chunk.response || '';

          // Update orchestrator session ID for continuity
          this.orchestratorSessionId = chunk.sessionId;

          console.log(`✅ Voice streaming complete: "${fullTranscript}" → "${fullResponse}"`);
          console.log(`📊 Session: ${chunk.sessionId}, Intent: ${chunk.intent}, Node: ${chunk.currentNode}, Ended: ${chunk.conversationEnded}`);

          // Send final metadata to client
          this.clientWs.send(JSON.stringify({
            type: 'audio.done',
            user_transcript: fullTranscript,
            transcript: fullResponse,
            session_id: chunk.sessionId,
            intent: chunk.intent,
            current_node: chunk.currentNode,
            completed: chunk.completed,
            conversation_ended: chunk.conversationEnded,
            end_reason: chunk.endReason
          }));

          // If conversation ended, disconnect
          if (chunk.conversationEnded) {
            console.log(`🔚 Conversation ended for session ${this.sessionId}: ${chunk.endReason}`);
            setTimeout(() => {
              this.disconnect();
            }, 2000); // Give time for final audio to play
          }
        } else if (chunk.type === 'error') {
          console.error(`❌ Voice streaming error: ${chunk.error}`);
          this.clientWs.send(JSON.stringify({
            type: 'error',
            error: 'Failed to process audio',
            message: chunk.error
          }));
        }
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
