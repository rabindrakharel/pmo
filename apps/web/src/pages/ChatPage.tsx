/**
 * AI Chat Page
 * Shows the AI assistant chat widget
 */

import React from 'react';
import { ChatWidget } from '../components/chat/ChatWidget';
import { MessageSquare, Calendar, Phone } from 'lucide-react';

export function ChatPage() {
  return (
    <div className="h-screen w-full flex flex-col bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-semibold text-gray-900">AI Assistant</h1>
          <p className="mt-1 text-sm text-gray-600">
            Chat with our AI assistant to get help with services, scheduling, and bookings.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <div className="flex items-center mb-3">
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mr-3">
                  <MessageSquare className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Ask Questions</h3>
              </div>
              <p className="text-sm text-gray-600">
                Get instant answers about our services, employee availability, and scheduling.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <div className="flex items-center mb-3">
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mr-3">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Book Services</h3>
              </div>
              <p className="text-sm text-gray-600">
                Schedule appointments and create service bookings directly through the chat.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <div className="flex items-center mb-3">
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mr-3">
                  <Phone className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Voice Call</h3>
              </div>
              <p className="text-sm text-gray-600">
                Switch to voice mode for hands-free conversation with the AI assistant.
              </p>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-white rounded-lg border border-gray-300 p-8 text-center">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Click the chat icon below to get started
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto mb-6">
              Our AI assistant can help you find available services, check employee schedules,
              and book appointments. Click the blue chat button in the bottom-right corner to start a conversation.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>AI Online</span>
              </div>
              <span className="text-gray-400">•</span>
              <span>24/7 Available</span>
              <span className="text-gray-400">•</span>
              <span>Instant Responses</span>
            </div>
          </div>

          {/* Example Queries */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Try asking:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-400 transition-colors cursor-pointer">
                <p className="text-sm text-gray-700">"What services are available?"</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-400 transition-colors cursor-pointer">
                <p className="text-sm text-gray-700">"Which employees are available today?"</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-400 transition-colors cursor-pointer">
                <p className="text-sm text-gray-700">"I need to book a plumbing service"</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-400 transition-colors cursor-pointer">
                <p className="text-sm text-gray-700">"Show me available time slots for next week"</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Widget - Auto-opens when page loads */}
      <ChatWidget autoOpen={true} />
    </div>
  );
}
