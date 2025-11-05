import type { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { logger } from '@/lib/logger.js';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

/**
 * Collaborative Editing WebSocket Handler for Wiki Pages
 *
 * This module provides real-time collaborative editing using Y.js CRDTs.
 * Features:
 * - Real-time content synchronization
 * - User presence tracking (who's online, cursor positions)
 * - Automatic conflict resolution via CRDTs
 * - Periodic database persistence
 */

interface WSConnection extends WebSocket {
  wikiId?: string;
  userId?: string;
  userName?: string;
  isAlive?: boolean;
}

interface Room {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  connections: Set<WSConnection>;
  lastSaved: number;
}

// Store active wiki editing rooms
const rooms = new Map<string, Room>();

// Auto-save interval (30 seconds)
const AUTOSAVE_INTERVAL = 30000;

/**
 * Get or create a room for a wiki page
 */
function getRoom(wikiId: string): Room {
  let room = rooms.get(wikiId);

  if (!room) {
    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);

    room = {
      doc,
      awareness,
      connections: new Set(),
      lastSaved: Date.now()
    };

    rooms.set(wikiId, room);
    logger.info(`Created collaborative editing room for wiki: ${wikiId}`);

    // Load existing content from database
    loadWikiContent(wikiId, doc).catch(err => {
      logger.error(`Failed to load wiki content for ${wikiId}:`, err);
    });

    // Setup auto-save
    setupAutoSave(wikiId, room);
  }

  return room;
}

/**
 * Load wiki content from database into Y.Doc
 */
async function loadWikiContent(wikiId: string, doc: Y.Doc) {
  try {
    const result = await db.execute(sql`
      SELECT content FROM app.d_wiki
      WHERE id = ${wikiId} AND active_flag = true
    `);

    if (result.length > 0 && result[0].content) {
      const content = result[0].content;

      // Initialize Y.Doc with existing content
      const yContent = doc.getMap('wiki');
      if (content.blocks) {
        yContent.set('blocks', content.blocks);
      }

      logger.info(`Loaded content for wiki ${wikiId}`);
    }
  } catch (error) {
    logger.error(`Error loading wiki content for ${wikiId}:`, error);
  }
}

/**
 * Save wiki content from Y.Doc to database
 */
async function saveWikiContent(wikiId: string, doc: Y.Doc) {
  try {
    const yContent = doc.getMap('wiki');
    const blocks = yContent.get('blocks');

    const content = {
      type: 'blocks',
      blocks: blocks || []
    };

    await db.execute(sql`
      UPDATE app.d_wiki
      SET content = ${JSON.stringify(content)}::jsonb,
          updated_ts = NOW()
      WHERE id = ${wikiId} AND active_flag = true
    `);

    logger.info(`Auto-saved wiki content for ${wikiId}`);
  } catch (error) {
    logger.error(`Error saving wiki content for ${wikiId}:`, error);
  }
}

/**
 * Setup auto-save for a room
 */
function setupAutoSave(wikiId: string, room: Room) {
  const interval = setInterval(() => {
    if (room.connections.size === 0) {
      // No active connections, cleanup room after saving
      saveWikiContent(wikiId, room.doc).then(() => {
        clearInterval(interval);
        rooms.delete(wikiId);
        logger.info(`Cleaned up room for wiki ${wikiId}`);
      });
    } else if (Date.now() - room.lastSaved > AUTOSAVE_INTERVAL) {
      // Save periodically if there are active connections
      saveWikiContent(wikiId, room.doc).then(() => {
        room.lastSaved = Date.now();
      });
    }
  }, AUTOSAVE_INTERVAL);
}

/**
 * Broadcast message to all connections in a room except sender
 */
function broadcast(room: Room, message: Uint8Array, sender?: WSConnection) {
  room.connections.forEach(conn => {
    if (conn !== sender && conn.readyState === WebSocket.OPEN) {
      try {
        conn.send(message, { binary: true });
      } catch (error) {
        logger.error('Error broadcasting message:', error);
      }
    }
  });
}

/**
 * Handle Y.js sync messages
 */
function handleSyncMessage(
  conn: WSConnection,
  room: Room,
  encoder: encoding.Encoder,
  decoder: decoding.Decoder,
  message: Uint8Array
) {
  encoding.writeVarUint(encoder, 0); // Message type: sync

  const syncMessageType = syncProtocol.readSyncMessage(
    decoder,
    encoder,
    room.doc,
    conn
  );

  // Send sync response back to client
  if (encoding.length(encoder) > 1) {
    conn.send(encoding.toUint8Array(encoder), { binary: true });
  }

  // Broadcast to other clients if it was a sync step 2 (update)
  if (syncMessageType === syncProtocol.messageYjsSyncStep2) {
    broadcast(room, message, conn);
  }
}

/**
 * Handle awareness updates (user presence, cursors)
 */
function handleAwarenessMessage(
  conn: WSConnection,
  room: Room,
  encoder: encoding.Encoder,
  decoder: decoding.Decoder,
  message: Uint8Array
) {
  awarenessProtocol.applyAwarenessUpdate(
    room.awareness,
    decoding.readVarUint8Array(decoder),
    conn
  );

  // Broadcast awareness update to all other clients
  broadcast(room, message, conn);
}

/**
 * Setup WebSocket connection for collaborative editing
 */
export function setupCollabConnection(
  connection: WSConnection,
  wikiId: string,
  userId: string,
  userName: string
) {
  connection.wikiId = wikiId;
  connection.userId = userId;
  connection.userName = userName;
  connection.isAlive = true;

  const room = getRoom(wikiId);
  room.connections.add(connection);

  logger.info(`User ${userName} (${userId}) joined wiki ${wikiId}. Active connections: ${room.connections.size}`);

  // Send initial sync message
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, 0); // Message type: sync
  syncProtocol.writeSyncStep1(encoder, room.doc);
  connection.send(encoding.toUint8Array(encoder), { binary: true });

  // Send current awareness state
  const awarenessStates = room.awareness.getStates();
  if (awarenessStates.size > 0) {
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, 1); // Message type: awareness
    encoding.writeVarUint8Array(
      awarenessEncoder,
      awarenessProtocol.encodeAwarenessUpdate(
        room.awareness,
        Array.from(awarenessStates.keys())
      )
    );
    connection.send(encoding.toUint8Array(awarenessEncoder), { binary: true });
  }

  // Set user's awareness state
  room.awareness.setLocalStateField('user', {
    id: userId,
    name: userName,
    color: generateUserColor(userId),
  });

  // Handle incoming messages
  connection.on('message', (message: Buffer) => {
    try {
      const decoder = decoding.createDecoder(message);
      const encoder = encoding.createEncoder();
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case 0: // Sync message
          handleSyncMessage(connection, room, encoder, decoder, message);
          break;
        case 1: // Awareness message
          handleAwarenessMessage(connection, room, encoder, decoder, message);
          break;
        default:
          logger.warn(`Unknown message type: ${messageType}`);
      }
    } catch (error) {
      logger.error('Error handling message:', error);
    }
  });

  // Handle pong for keepalive
  connection.on('pong', () => {
    connection.isAlive = true;
  });

  // Handle connection close
  connection.on('close', () => {
    logger.info(`User ${userName} left wiki ${wikiId}`);
    room.connections.delete(connection);

    // Remove from awareness
    if (room.awareness) {
      awarenessProtocol.removeAwarenessStates(
        room.awareness,
        [room.doc.clientID],
        'disconnect'
      );
    }

    // Save and cleanup if no more connections
    if (room.connections.size === 0) {
      saveWikiContent(wikiId, room.doc);
    }
  });

  // Handle errors
  connection.on('error', (error) => {
    logger.error(`WebSocket error for wiki ${wikiId}:`, error);
  });
}

/**
 * Generate a consistent color for a user based on their ID
 */
function generateUserColor(userId: string): string {
  const colors = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#F97316', // orange
  ];

  // Generate a consistent color based on user ID
  const hash = userId.split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);

  return colors[hash % colors.length];
}

/**
 * Heartbeat to detect dead connections
 */
export function startHeartbeat() {
  setInterval(() => {
    rooms.forEach((room) => {
      room.connections.forEach((conn) => {
        if (!conn.isAlive) {
          logger.info(`Terminating dead connection for wiki ${conn.wikiId}`);
          conn.terminate();
          return;
        }

        conn.isAlive = false;
        conn.ping();
      });
    });
  }, 30000); // 30 seconds
}

/**
 * Get list of active users in a wiki
 */
export function getActiveUsers(wikiId: string) {
  const room = rooms.get(wikiId);
  if (!room) return [];

  const users: any[] = [];
  room.awareness.getStates().forEach((state, clientId) => {
    if (state.user) {
      users.push({
        clientId,
        ...state.user,
        cursor: state.cursor,
        selection: state.selection,
      });
    }
  });

  return users;
}
