/**
 * API Client for Chat Widget
 */

import type { Message, ChatResponse, NewSessionResponse } from './types';

export class ChatAPI {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  async createSession(params: {
    customer_id?: string;
    customer_email?: string;
    customer_name?: string;
    referrer_url?: string;
  }): Promise<NewSessionResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/chat/session/new`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...params,
        referrer_url: params.referrer_url || window.location.href,
        metadata: {
          user_agent: navigator.userAgent,
          screen_width: window.screen.width,
          screen_height: window.screen.height,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.statusText}`);
    }

    return response.json();
  }

  async sendMessage(
    sessionId: string,
    message: string
  ): Promise<ChatResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        message,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }

    return response.json();
  }

  async getHistory(sessionId: string): Promise<{
    messages: Message[];
    booking_created: boolean;
  }> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/chat/session/${sessionId}/history`
    );

    if (!response.ok) {
      throw new Error(`Failed to get history: ${response.statusText}`);
    }

    return response.json();
  }
}
