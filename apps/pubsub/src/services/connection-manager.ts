// ============================================================================
// PubSub Service - Connection Manager
// ============================================================================
// Manages WebSocket connections in-memory (pod-local)
// ============================================================================

import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';

export class ConnectionManager {
  // In-memory maps (pod-local)
  private connections = new Map<string, WebSocket>();       // connId → socket
  private userConnections = new Map<string, Set<string>>(); // userId → connIds
  private connectionUsers = new Map<string, string>();      // connId → userId
  private connectionTokenExp = new Map<string, number>();   // connId → token expiry

  /**
   * Register a new WebSocket connection
   * @returns Connection ID
   */
  connect(userId: string, socket: WebSocket, tokenExp: number): string {
    const connectionId = randomUUID();

    this.connections.set(connectionId, socket);
    this.connectionUsers.set(connectionId, userId);
    this.connectionTokenExp.set(connectionId, tokenExp);

    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);

    console.log(`[ConnectionManager] Connected: user=${userId} conn=${connectionId.slice(0, 8)}...`);

    return connectionId;
  }

  /**
   * Remove a connection
   * @returns User ID of the disconnected connection
   */
  disconnect(connectionId: string): string | undefined {
    const userId = this.connectionUsers.get(connectionId);

    this.connections.delete(connectionId);
    this.connectionUsers.delete(connectionId);
    this.connectionTokenExp.delete(connectionId);

    if (userId) {
      this.userConnections.get(userId)?.delete(connectionId);
      if (this.userConnections.get(userId)?.size === 0) {
        this.userConnections.delete(userId);
      }
      console.log(`[ConnectionManager] Disconnected: user=${userId} conn=${connectionId.slice(0, 8)}...`);
    }

    return userId;
  }

  /**
   * Check if a connection exists and is open
   */
  hasConnection(connectionId: string): boolean {
    const socket = this.connections.get(connectionId);
    return socket !== undefined && socket.readyState === WebSocket.OPEN;
  }

  /**
   * Get the socket for a connection
   */
  getSocket(connectionId: string): WebSocket | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get user ID for a connection
   */
  getUserId(connectionId: string): string | undefined {
    return this.connectionUsers.get(connectionId);
  }

  /**
   * Get token expiry for a connection
   */
  getTokenExp(connectionId: string): number | undefined {
    return this.connectionTokenExp.get(connectionId);
  }

  /**
   * Update token expiry for a connection (after token refresh)
   */
  updateTokenExp(connectionId: string, newExp: number): void {
    if (this.connectionTokenExp.has(connectionId)) {
      this.connectionTokenExp.set(connectionId, newExp);
    }
  }

  /**
   * Get all connection IDs for a user
   */
  getConnectionsForUser(userId: string): string[] {
    return Array.from(this.userConnections.get(userId) ?? []);
  }

  /**
   * Send a message to a specific connection
   * @returns true if sent successfully
   */
  send(connectionId: string, message: object): boolean {
    const socket = this.connections.get(connectionId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /**
   * Broadcast a message to multiple connections
   * @returns Number of successful sends
   */
  broadcast(connectionIds: string[], message: object): number {
    let sent = 0;
    const payload = JSON.stringify(message);

    for (const connId of connectionIds) {
      const socket = this.connections.get(connId);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
        sent++;
      }
    }

    return sent;
  }

  /**
   * Get all active connection IDs
   */
  getAllConnectionIds(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Get connection statistics
   */
  getStats(): { connections: number; users: number } {
    return {
      connections: this.connections.size,
      users: this.userConnections.size,
    };
  }
}
