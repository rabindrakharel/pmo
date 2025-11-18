/**
 * Redis Client Service
 *
 * Provides a singleton Redis client for caching across the application.
 * Uses ioredis library which is compatible with both Redis and Valkey.
 *
 * Configuration:
 * - REDIS_HOST: Redis server host (default: localhost)
 * - REDIS_PORT: Redis server port (default: 6379)
 * - REDIS_PASSWORD: Redis password (optional)
 * - REDIS_DB: Redis database number (default: 0)
 */

import Redis from 'ioredis';

let redisClient: Redis | null = null;

/**
 * Get or create Redis client singleton
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const password = process.env.REDIS_PASSWORD;
    const db = parseInt(process.env.REDIS_DB || '0', 10);

    redisClient = new Redis({
      host,
      port,
      password,
      db,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    // Event handlers
    redisClient.on('connect', () => {
      console.log(`✅ Redis connected: ${host}:${port}`);
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
    });

    redisClient.on('ready', () => {
      console.log('🔥 Redis ready to accept commands');
    });

    redisClient.on('close', () => {
      console.log('⚠️  Redis connection closed');
    });
  }

  return redisClient;
}

/**
 * Close Redis connection (for graceful shutdown)
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('🔒 Redis connection closed gracefully');
  }
}

/**
 * Check if Redis is connected and healthy
 */
export async function isRedisHealthy(): Promise<boolean> {
  try {
    if (!redisClient) return false;
    const pong = await redisClient.ping();
    return pong === 'PONG';
  } catch (error) {
    return false;
  }
}
