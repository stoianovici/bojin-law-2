/**
 * PostgreSQL Database Client Implementation
 * Story 2.15: Test Architecture Refactoring - Dependency Injection
 *
 * Implements DatabaseClient interface for PostgreSQL, enabling:
 * - Dependency injection for testability
 * - Consistent database operations
 * - Transaction support
 * - Connection pooling
 */

import type { PoolClient, QueryResultRow } from 'pg';
import type { DatabaseClient, QueryResult } from '@legal-platform/types';
import { getPool, getClient as getPoolClient, closePool as closeConnectionPool } from './client';

/**
 * PostgreSQL implementation of DatabaseClient interface
 *
 * Wraps the existing connection pool functions to provide a
 * consistent interface for dependency injection.
 *
 * @example
 * ```typescript
 * // Production usage
 * const db = new PostgresDatabaseClient();
 * const result = await db.query('SELECT * FROM users');
 *
 * // Service usage
 * class MyService {
 *   constructor(private db: DatabaseClient = new PostgresDatabaseClient()) {}
 * }
 * ```
 */
export class PostgresDatabaseClient implements DatabaseClient {
  /**
   * Execute a SQL query with optional parameters
   *
   * Uses the shared connection pool for efficient resource management.
   *
   * @template T Expected type of rows returned
   * @param sql SQL query string with optional $1, $2, etc. placeholders
   * @param params Optional array of parameters for the query
   * @returns Promise resolving to query results
   *
   * @throws Error if DATABASE_URL is not configured
   * @throws Error if query execution fails
   */
  async query<T extends QueryResultRow = any>(
    sql: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    const pool = getPool();
    const result = await pool.query<T>(sql, params);

    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? 0,
      command: result.command,
      oid: result.oid,
      fields: result.fields,
    };
  }

  /**
   * Execute a callback within a database transaction
   *
   * Automatically handles BEGIN, COMMIT, and ROLLBACK.
   * If the callback throws an error, the transaction is rolled back.
   *
   * @template T Return type of the callback
   * @param callback Async function to execute within transaction context
   * @returns Promise resolving to callback's return value
   *
   * @example
   * ```typescript
   * await db.transaction(async (client) => {
   *   await client.query('INSERT INTO orders VALUES ($1)', [orderId]);
   *   await client.query('UPDATE inventory SET stock = stock - 1');
   *   return orderId;
   * });
   * ```
   */
  async transaction<T>(callback: (client: DatabaseClient) => Promise<T>): Promise<T> {
    const poolClient = await getPoolClient();

    try {
      await poolClient.query('BEGIN');

      // Create a DatabaseClient wrapper for the transaction client
      const transactionClient = new PostgresTransactionClient(poolClient);

      // Execute callback with transaction client
      const result = await callback(transactionClient);

      await poolClient.query('COMMIT');
      return result;
    } catch (error) {
      await poolClient.query('ROLLBACK');
      throw error;
    } finally {
      poolClient.release();
    }
  }

  /**
   * Get a client from the connection pool
   *
   * Caller must release the client when done using client.release()
   *
   * @returns Promise resolving to a pool client
   *
   * @example
   * ```typescript
   * const client = await db.getClient();
   * try {
   *   await client.query('SELECT 1');
   * } finally {
   *   client.release();
   * }
   * ```
   */
  async getClient(): Promise<PoolClient> {
    return getPoolClient();
  }

  /**
   * Close the database connection pool
   *
   * Should be called during application shutdown to ensure
   * graceful cleanup of all database connections.
   *
   * @returns Promise that resolves when pool is closed
   */
  async closePool(): Promise<void> {
    await closeConnectionPool();
  }
}

/**
 * PostgreSQL transaction client wrapper
 *
 * Wraps a PoolClient to provide DatabaseClient interface
 * within transaction context. Prevents nested transactions.
 *
 * @internal
 */
class PostgresTransactionClient implements DatabaseClient {
  constructor(private poolClient: PoolClient) {}

  async query<T extends QueryResultRow = any>(
    sql: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    const result = await this.poolClient.query<T>(sql, params);

    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? 0,
      command: result.command,
      oid: result.oid,
      fields: result.fields,
    };
  }

  async transaction<T>(_callback: (client: DatabaseClient) => Promise<T>): Promise<T> {
    // Nested transactions not supported in PostgreSQL
    // Use savepoints instead if needed
    throw new Error('Nested transactions are not supported. Use savepoints instead.');
  }

  async getClient(): Promise<PoolClient> {
    return this.poolClient;
  }

  async closePool(): Promise<void> {
    // Transaction clients should not close the pool
    throw new Error('Cannot close pool from within a transaction');
  }
}

/**
 * Get default database client instance
 *
 * Returns a singleton instance of PostgresDatabaseClient
 * for use in production code.
 *
 * @returns Default database client
 *
 * @example
 * ```typescript
 * class MyService {
 *   constructor(private db: DatabaseClient = getDefaultDatabaseClient()) {}
 *
 *   async getData() {
 *     return this.db.query('SELECT * FROM data');
 *   }
 * }
 * ```
 */
let defaultClient: DatabaseClient | null = null;

export function getDefaultDatabaseClient(): DatabaseClient {
  if (!defaultClient) {
    defaultClient = new PostgresDatabaseClient();
  }
  return defaultClient;
}

/**
 * Reset the default client (for testing purposes)
 * @internal
 */
export function resetDefaultDatabaseClient(): void {
  defaultClient = null;
}
