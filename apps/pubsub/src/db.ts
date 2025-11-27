// ============================================================================
// PubSub Service - Database Connection
// ============================================================================

import pg from 'pg';
const { Pool } = pg;

// Create connection pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,           // Maximum connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Log connection events
pool.on('connect', () => {
  console.log('[DB] New client connected to pool');
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err);
});

// Simple database interface
export const db = {
  /**
   * Execute a SQL query and return rows
   */
  async execute<T = Record<string, unknown>>(
    query: string,
    params?: unknown[]
  ): Promise<T[]> {
    const result = await pool.query(query, params);
    return result.rows as T[];
  },

  /**
   * Execute a SQL query and return row count
   */
  async executeWithCount(
    query: string,
    params?: unknown[]
  ): Promise<{ rows: unknown[]; rowCount: number }> {
    const result = await pool.query(query, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount ?? 0,
    };
  },

  /**
   * Get a single client for transaction
   */
  async getClient() {
    return pool.connect();
  },

  /**
   * Close the pool (for graceful shutdown)
   */
  async close() {
    await pool.end();
    console.log('[DB] Pool closed');
  },
};

export type Database = typeof db;
