/**
 * Database Client
 * Shared PostgreSQL client for web app
 * Story 2.12.1 - Task 7: Admin Dashboard
 */

import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import type { QueryResult } from '@legal-platform/types';

// Singleton pool instance
let pool: Pool | null = null;

/**
 * Get or create database connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    pool = new Pool({
      connectionString,
      max: 20, // Maximum pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Error handling
    pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });
  }

  return pool;
}

/**
 * Execute a query
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  const result = await pool.query(text, params);
  return result as QueryResult<T>;
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  return pool.connect();
}

/**
 * Close the pool (for graceful shutdown)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Re-export getDefaultDatabaseClient for convenience
 * See client-impl.ts for implementation details
 */
export { getDefaultDatabaseClient, PostgresDatabaseClient } from './client-impl';
