/**
 * Main Chat Widget Component
 */

import React, { useState, useEffect, useRef } from 'react';
import { ChatAPI } from './api';
import { VoiceCall } from './VoiceCall';
import type { Message, WidgetConfig } from './types';
import './styles.css';

interface AppProps {
  config: WidgetConfig;
}

export function App({ config }: AppProps) {
  const [isOpen, setIsOpen] = useState(config.autoOpen || false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVoiceCall, setShowVoiceCall] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef(new ChatAPI(config.apiUrl));

  // Initialize session on mount
  useEffect(() => {
    if (isOpen && !sessionId) {
      initializeSession();
    }
  }, [isOpen]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function initializeSession() {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiRef.current.createSession({
        customer_id: config.customerId,
        customer_email: config.customerEmail,
        customer_name: config.customerName,
      });

      setSessionId(response.session_id);
      setMessages([
        {
          role: 'assistant',
          content: response.greeting,
          timestamp: response.timestamp,
        },
      ]);
    } catch (err) {
      console.error('Failed to initialize session:', err);
      setError('Failed to start chat. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();

    if (!inputValue.trim() || !sessionId || isLoading) {
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRef.current.sendMessage(
        sessionId,
        userMessage.content
      );

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.response,
        timestamp: response.timestamp,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Show booking confirmation if created
      if (response.booking_created && response.booking_number) {
        const confirmationMessage: Message = {
          role: 'system',
          content: `✅ Booking confirmed! Your booking number is: ${response.booking_number}`,
          timestamp: response.timestamp,
        };
        setMessages(prev => [...prev, confirmationMessage]);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleToggleOpen() {
    setIsOpen(!isOpen);
    if (!isOpen && !sessionId) {
      initializeSession();
    }
  }

  function handleClose() {
    setIsOpen(false);
  }

  function handleMinimize() {
    setIsMinimized(!isMinimized);
  }

  // Show voice call interface
  if (showVoiceCall) {
    return (
      <div className="huron-widget-container huron-widget-voice">
        <VoiceCall
          apiUrl={config.apiUrl}
          onClose={() => setShowVoiceCall(false)}
        />
      </div>
    );
  }

  if (!isOpen) {
    return (
      <div className="huron-widget-container huron-widget-closed">
        <button
          className="huron-widget-toggle-button"
          onClick={handleToggleOpen}
          aria-label="Open chat"
        >
          <ChatIcon />
          <span>Chat with us</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`huron-widget-container huron-widget-open huron-theme-${config.theme || 'light'}`}>
      <div className={`huron-chat-window ${isMinimized ? 'minimized' : ''}`}>
        {/* Header */}
        <div className="huron-chat-header">
          <div className="huron-header-content">
            <div className="huron-header-icon">
              <ChatIcon />
            </div>
            <div className="huron-header-text">
              <div className="huron-header-title">Huron Home Services</div>
              <div className="huron-header-subtitle">Online now</div>
            </div>
          </div>
          <div className="huron-header-actions">
            <button
              className="huron-header-button huron-voice-call-button"
              onClick={() => setShowVoiceCall(true)}
              aria-label="Voice Call"
              title="Call with AI"
            >
              <PhoneIcon />
            </button>
            <button
              className="huron-header-button"
              onClick={handleMinimize}
              aria-label="Minimize"
            >
              <MinimizeIcon />
            </button>
            <button
              className="huron-header-button"
              onClick={handleClose}
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Messages */}
        {!isMinimized && (
          <>
            <div className="huron-chat-messages">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`huron-message huron-message-${message.role}`}
                >
                  <div className="huron-message-content">
                    {message.content}
                  </div>
                  <div className="huron-message-timestamp">
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="huron-message huron-message-assistant">
                  <div className="huron-message-content">
                    <TypingIndicator />
                  </div>
                </div>
              )}
              {error && (
                <div className="huron-message huron-message-error">
                  <div className="huron-message-content">{error}</div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="huron-chat-input-container">
              <form onSubmit={handleSendMessage} className="huron-chat-input-form">
                <input
                  type="text"
                  className="huron-chat-input"
                  placeholder="Type your message..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  className="huron-send-button"
                  disabled={isLoading || !inputValue.trim()}
                  aria-label="Send message"
                >
                  <SendIcon />
                </button>
              </form>
              <div className="huron-chat-footer">
                Powered by AI
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Helper function to format timestamp
function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Icon Components
function ChatIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function MinimizeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function TypingIndicator() {
  return (
    <div className="huron-typing-indicator">
      <span></span>
      <span></span>
      <span></span>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
