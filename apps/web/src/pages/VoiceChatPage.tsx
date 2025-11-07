/**
 * Voice Chat Page
 * Full-screen voice assistant interface using orchestrator
 */

import React from 'react';
import { VoiceChat } from '../components/chat/VoiceChat';
import { Phone, MessageSquare, Zap } from 'lucide-react';

export function VoiceChatPage() {
  return (
    <div className="h-screen w-full flex flex-col bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Phone className="w-6 h-6 text-purple-600" />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Voice Assistant</h1>
              <p className="mt-1 text-sm text-gray-600">
                Talk to our AI assistant with voice - powered by multi-agent orchestrator
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full max-w-4xl mx-auto">
          <VoiceChat />
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-slate-700 text-white py-3 px-6 flex-shrink-0 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-8 text-sm">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            <span>Multi-agent orchestration</span>
          </div>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            <span>Whisper STT + OpenAI TTS</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            <span>Push-to-talk interface</span>
          </div>
        </div>
      </div>
    </div>
  );
}
