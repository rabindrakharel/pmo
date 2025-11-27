// ============================================================================
// PubSub Service - WebSocket Server
// ============================================================================
// Standalone WebSocket server for real-time entity sync
// ============================================================================

import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { URL } from 'url';
import { verifyJwt, isTokenExpiringSoon, getSecondsUntilExpiry } from './auth.js';
import { ConnectionManager } from './services/connection-manager.js';
import { SubscriptionManager } from './services/subscription-manager.js';
import { LogWatcher } from './services/log-watcher.js';
import { db } from './db.js';
import type { ClientMessage } from './types.js';

const PORT = parseInt(process.env.PUBSUB_PORT || '4001', 10);
const TOKEN_EXPIRY_WARNING_SECONDS = 300; // Warn 5 minutes before expiry
const STALE_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

// Initialize services
const connectionManager = new ConnectionManager();
const subscriptionManager = new SubscriptionManager(db);
const logWatcher = new LogWatcher(db, connectionManager, subscriptionManager);

// Create HTTP server for WebSocket upgrade + health check
const server = createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      uptime: process.uptime(),
      ...connectionManager.getStats(),
      logWatcherRunning: logWatcher.isRunning(),
    }));
    return;
  }

  // Ready check endpoint
  if (req.url === '/ready') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ready: true }));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', async (socket: WebSocket, request) => {
  // 1. Extract and verify token from query string
  const url = new URL(request.url || '', `http://localhost:${PORT}`);
  const token = url.searchParams.get('token');

  if (!token) {
    socket.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Missing token' } }));
    socket.close(4001, 'Missing token');
    return;
  }

  const decoded = verifyJwt(token);
  if (!decoded) {
    socket.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Invalid token' } }));
    socket.close(4002, 'Invalid token');
    return;
  }

  const userId = decoded.sub;

  // 2. Register connection
  const connectionId = connectionManager.connect(userId, socket, decoded.exp);
  console.log(`[PubSub] Connected: user=${userId.slice(0, 8)}... conn=${connectionId.slice(0, 8)}...`);

  // 3. Schedule token expiry warning
  scheduleTokenWarning(connectionId, decoded.exp);

  // 4. Handle messages
  socket.on('message', async (data) => {
    try {
      const message: ClientMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'SUBSCRIBE': {
          const count = await subscriptionManager.subscribe(
            userId,
            connectionId,
            message.payload.entityCode,
            message.payload.entityIds
          );
          socket.send(JSON.stringify({ type: 'SUBSCRIBED', payload: { count } }));
          break;
        }

        case 'UNSUBSCRIBE': {
          await subscriptionManager.unsubscribe(
            userId,
            message.payload.entityCode,
            message.payload.entityIds
          );
          break;
        }

        case 'UNSUBSCRIBE_ALL': {
          await subscriptionManager.unsubscribeAll(userId);
          break;
        }

        case 'TOKEN_REFRESH': {
          const newDecoded = verifyJwt(message.payload.token);
          if (newDecoded && newDecoded.sub === userId) {
            connectionManager.updateTokenExp(connectionId, newDecoded.exp);
            scheduleTokenWarning(connectionId, newDecoded.exp);
            console.log(`[PubSub] Token refreshed: user=${userId.slice(0, 8)}...`);
          } else {
            socket.send(JSON.stringify({
              type: 'ERROR',
              payload: { message: 'Invalid refresh token' },
            }));
          }
          break;
        }

        case 'PING': {
          socket.send(JSON.stringify({ type: 'PONG' }));
          break;
        }

        default:
          console.warn('[PubSub] Unknown message type:', (message as { type: string }).type);
      }
    } catch (error) {
      console.error('[PubSub] Message error:', error);
      socket.send(JSON.stringify({
        type: 'ERROR',
        payload: { message: 'Invalid message format' },
      }));
    }
  });

  // 5. Handle errors
  socket.on('error', (error) => {
    console.error(`[PubSub] Socket error: user=${userId.slice(0, 8)}...`, error.message);
  });

  // 6. Cleanup on disconnect
  socket.on('close', async (code, reason) => {
    console.log(`[PubSub] Disconnected: user=${userId.slice(0, 8)}... code=${code}`);
    connectionManager.disconnect(connectionId);
    await subscriptionManager.cleanupConnection(connectionId);
  });
});

// Schedule token expiry warning
function scheduleTokenWarning(connectionId: string, tokenExp: number): void {
  const secondsUntilExpiry = getSecondsUntilExpiry(tokenExp);
  const secondsUntilWarning = secondsUntilExpiry - TOKEN_EXPIRY_WARNING_SECONDS;

  if (secondsUntilWarning > 0) {
    setTimeout(() => {
      // Check if connection still exists
      if (connectionManager.hasConnection(connectionId)) {
        const currentExp = connectionManager.getTokenExp(connectionId);
        // Only send warning if token hasn't been refreshed
        if (currentExp === tokenExp) {
          connectionManager.send(connectionId, {
            type: 'TOKEN_EXPIRING_SOON',
            payload: { expiresIn: TOKEN_EXPIRY_WARNING_SECONDS },
          });
        }
      }
    }, secondsUntilWarning * 1000);
  }
}

// Periodic cleanup of stale subscriptions
setInterval(async () => {
  try {
    await subscriptionManager.cleanupStaleSubscriptions(24);
  } catch (error) {
    console.error('[PubSub] Stale cleanup error:', error);
  }
}, STALE_CLEANUP_INTERVAL);

// Start server
export function startServer(): void {
  server.listen(PORT, () => {
    console.log(`[PubSub] WebSocket server running on port ${PORT}`);
    logWatcher.start();
  });
}

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  console.log(`[PubSub] Received ${signal}, shutting down...`);

  // Stop accepting new connections
  wss.close();

  // Stop log watcher
  logWatcher.stop();

  // Close all WebSocket connections
  for (const connId of connectionManager.getAllConnectionIds()) {
    const socket = connectionManager.getSocket(connId);
    if (socket) {
      socket.close(1001, 'Server shutting down');
    }
  }

  // Close HTTP server
  server.close();

  // Close database pool
  await db.close();

  console.log('[PubSub] Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Export for testing
export { wss, connectionManager, subscriptionManager, logWatcher };
