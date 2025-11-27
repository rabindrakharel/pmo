// ============================================================================
// PubSub Service - Type Definitions
// ============================================================================

// ============================================================================
// Client → Server Messages
// ============================================================================

export interface SubscribeMessage {
  type: 'SUBSCRIBE';
  payload: {
    entityCode: string;
    entityIds: string[];
  };
}

export interface UnsubscribeMessage {
  type: 'UNSUBSCRIBE';
  payload: {
    entityCode: string;
    entityIds?: string[]; // If empty, unsubscribe from all of this entity type
  };
}

export interface TokenRefreshMessage {
  type: 'TOKEN_REFRESH';
  payload: { token: string };
}

export type ClientMessage =
  | SubscribeMessage
  | UnsubscribeMessage
  | TokenRefreshMessage
  | { type: 'UNSUBSCRIBE_ALL' }
  | { type: 'PING' };

// ============================================================================
// Server → Client Messages
// ============================================================================

export interface InvalidateMessage {
  type: 'INVALIDATE';
  payload: {
    entityCode: string;
    changes: Array<{
      entityId: string;
      action: 'CREATE' | 'UPDATE' | 'DELETE';
      version: number;
    }>;
    timestamp: string;
  };
}

export interface TokenExpiringSoonMessage {
  type: 'TOKEN_EXPIRING_SOON';
  payload: { expiresIn: number }; // seconds until expiry
}

export type ServerMessage =
  | InvalidateMessage
  | TokenExpiringSoonMessage
  | { type: 'PONG' }
  | { type: 'SUBSCRIBED'; payload: { count: number } }
  | { type: 'ERROR'; payload: { message: string } };

// ============================================================================
// Internal Types
// ============================================================================

export interface LogEntry {
  id: string;
  entity_code: string;
  entity_id: string;
  action: number;
  version?: number;
  created_ts: Date;
}

export interface Subscriber {
  userId: string;
  connectionId: string;
  subscribedEntityIds: string[];
}

export interface JwtPayload {
  sub: string;      // User ID
  email: string;
  name: string;
  exp: number;      // Expiration timestamp
  iat: number;      // Issued at timestamp
}

export interface ConnectionInfo {
  userId: string;
  connectionId: string;
  tokenExp: number;
}
