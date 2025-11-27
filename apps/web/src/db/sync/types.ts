// ============================================================================
// Sync Module - Type Definitions
// ============================================================================

// Client → Server Messages
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
    entityIds?: string[];
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

// Server → Client Messages
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
  payload: { expiresIn: number };
}

export type ServerMessage =
  | InvalidateMessage
  | TokenExpiringSoonMessage
  | { type: 'PONG' }
  | { type: 'SUBSCRIBED'; payload: { count: number } }
  | { type: 'ERROR'; payload: { message: string } };

// Connection states
export type SyncStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Context value
export interface SyncContextValue {
  status: SyncStatus;
  subscribe: (entityCode: string, entityIds: string[]) => void;
  unsubscribe: (entityCode: string, entityIds?: string[]) => void;
  unsubscribeAll: () => void;
}
