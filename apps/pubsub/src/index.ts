// ============================================================================
// PubSub Service - Entry Point
// ============================================================================

import 'dotenv/config';
import { startServer } from './server.js';

// Validate required environment variables
const required = ['DATABASE_URL', 'JWT_SECRET'];
const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error(`[PubSub] Missing required environment variables: ${missing.join(', ')}`);
  console.error('[PubSub] Please set these in your .env file or environment');
  process.exit(1);
}

console.log('[PubSub] Starting PubSub Service...');
console.log(`[PubSub] Database: ${process.env.DATABASE_URL?.split('@')[1] || 'configured'}`);
console.log(`[PubSub] Port: ${process.env.PUBSUB_PORT || 4001}`);

startServer();
