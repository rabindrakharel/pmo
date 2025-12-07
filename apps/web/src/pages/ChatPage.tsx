/**
 * AI Chat Page
 * Elegant, minimal layout showcasing the AI assistant
 */

import React from 'react';
import { ChatWidget } from '../components/chat/ChatWidget';
import { MessageSquare, Sparkles, Zap } from 'lucide-react';

export function ChatPage() {
  return (
    <div className="h-screen w-full flex flex-col bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      {/* Elegant Hero Section */}
      <div className="flex-1 flex items-center justify-center px-6 overflow-auto">
        <div className="max-w-4xl w-full text-center py-12">
          {/* Icon with gradient */}
          <div className="relative inline-flex mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-3xl blur-2xl opacity-20 animate-pulse"></div>
            <div className="relative w-20 h-20 bg-gradient-to-br from-slate-700 via-slate-600 to-purple-600 rounded-3xl flex items-center justify-center shadow-xl">
              <Sparkles className="w-10 h-10 text-white" strokeWidth={2} />
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-5xl font-bold text-slate-800 mb-4 tracking-tight">
            AI Assistant
          </h1>
          <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            Your intelligent companion for services, scheduling, and bookings
          </p>

          {/* Status Badge */}
          <div className="inline-flex items-center gap-3 bg-white rounded-full px-6 py-3 shadow-sm border border-slate-200 mb-12">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-slate-700">AI Online</span>
            </div>
            <span className="text-slate-300">•</span>
            <span className="text-sm text-slate-600">24/7 Available</span>
            <span className="text-slate-300">•</span>
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-slate-600">Instant Responses</span>
          </div>

          {/* Quick Start Prompts */}
          <div className="max-w-3xl mx-auto">
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">
              Try asking
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                "What services are available?",
                "Which employees are available today?",
                "I need to book a plumbing service",
                "Show me time slots for next week"
              ].map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="group bg-white hover:bg-gradient-to-r hover:from-dark-50 hover:to-indigo-50 border border-slate-200 hover:border-purple-300 rounded-xl px-5 py-4 text-left transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <MessageSquare className="w-4 h-4 text-slate-400 group-hover:text-purple-600 flex-shrink-0 mt-0.5 transition-colors" />
                    <p className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">
                      {prompt}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Subtle hint */}
          <p className="text-sm text-slate-400 mt-12 flex items-center justify-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Chat widget is open in the bottom-right corner
          </p>
        </div>
      </div>

      {/* Chat Widget - Auto-opens when page loads and provides full chat functionality */}
      <ChatWidget autoOpen={true} />
    </div>
  );
}
