/**
 * Database Client Interface for Dependency Injection
 *
 * This interface abstracts database operations to enable:
 * - Easy unit testing with mock implementations
 * - Consistent database interaction patterns
 * - Decoupling services from specific database implementations
 *
 * @example
 * ```typescript
 * // Production usage with default client
 * const service = new MyService(); // Uses default PostgreSQL client
 *
 * // Testing with mock client
 * const mockDb: DatabaseClient = {
 *   query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
 *   transaction: jest.fn(),
 *   getClient: jest.fn(),
 *   closePool: jest.fn(),
 * };
 * const service = new MyService(mockDb);
 * ```
 */

import type { PoolClient, QueryResultRow } from 'pg';

/**
 * Result of a database query operation
 * @template T The type of rows returned by the query
 */
export interface QueryResult<T = any> {
  /** Array of rows returned by the query */
  rows: T[];
  /** Number of rows affected by the query */
  rowCount: number;
  /** SQL command that was executed (e.g., 'SELECT', 'INSERT', 'UPDATE') */
  command?: string;
  /** OID of inserted row (INSERT operations only) */
  oid?: number;
  /** Additional fields from pg library */
  fields?: any[];
}

/**
 * Database client interface for dependency injection
 *
 * Implementations must provide query execution, transaction support,
 * and connection pool management.
 */
export interface DatabaseClient {
  /**
   * Execute a SQL query with optional parameters
   *
   * @template T The expected type of rows returned
   * @param sql SQL query string (supports parameterized queries with $1, $2, etc.)
   * @param params Optional array of parameters for the query
   * @returns Promise resolving to query results
   *
   * @example
   * ```typescript
   * // Simple SELECT query
   * const result = await db.query<User>('SELECT * FROM users WHERE id = $1', [userId]);
   * const user = result.rows[0];
   *
   * // INSERT query
   * await db.query(
   *   'INSERT INTO logs (message, timestamp) VALUES ($1, $2)',
   *   ['User logged in', new Date()]
   * );
   * ```
   */
  query<T extends QueryResultRow = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;

  /**
   * Execute a callback within a database transaction
   *
   * The transaction is automatically committed if the callback succeeds,
   * or rolled back if the callback throws an error.
   *
   * @template T The return type of the transaction callback
   * @param callback Async function to execute within transaction
   * @returns Promise resolving to the callback's return value
   *
   * @example
   * ```typescript
   * await db.transaction(async (client) => {
   *   await client.query('INSERT INTO orders (id) VALUES ($1)', [orderId]);
   *   await client.query('UPDATE inventory SET stock = stock - 1 WHERE id = $1', [productId]);
   *   // Both queries committed together, or both rolled back on error
   * });
   * ```
   */
  transaction<T>(callback: (client: DatabaseClient) => Promise<T>): Promise<T>;

  /**
   * Get a client from the connection pool
   *
   * The caller is responsible for releasing the client back to the pool.
   * Use this for advanced scenarios requiring manual client management.
   *
   * @returns Promise resolving to a pool client
   *
   * @example
   * ```typescript
   * const client = await db.getClient();
   * try {
   *   await client.query('BEGIN');
   *   await client.query('INSERT INTO ...');
   *   await client.query('COMMIT');
   * } catch (error) {
   *   await client.query('ROLLBACK');
   *   throw error;
   * } finally {
   *   client.release();
   * }
   * ```
   */
  getClient(): Promise<PoolClient>;

  /**
   * Close the database connection pool
   *
   * Should be called when shutting down the application to ensure
   * graceful cleanup of database connections.
   *
   * @returns Promise that resolves when pool is closed
   *
   * @example
   * ```typescript
   * process.on('SIGTERM', async () => {
   *   await db.closePool();
   *   process.exit(0);
   * });
   * ```
   */
  closePool(): Promise<void>;
}

/**
 * Type guard to check if an object implements DatabaseClient interface
 *
 * @param obj Object to check
 * @returns True if object implements DatabaseClient interface
 *
 * @example
 * ```typescript
 * if (isDatabaseClient(someObject)) {
 *   await someObject.query('SELECT 1');
 * }
 * ```
 */
export function isDatabaseClient(obj: any): obj is DatabaseClient {
  return (
    obj &&
    typeof obj.query === 'function' &&
    typeof obj.transaction === 'function' &&
    typeof obj.getClient === 'function' &&
    typeof obj.closePool === 'function'
  );
}
