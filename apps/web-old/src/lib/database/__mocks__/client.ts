/**
 * Manual mock for database client
 * Used in Jest tests to avoid real database connections
 */

// Jest globals are available in Jest test environment
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jestMock = (globalThis as any).jest || { fn: () => () => {} };

export const query = jestMock.fn();
export const getPool = jestMock.fn();
export const getClient = jestMock.fn();
export const closePool = jestMock.fn();
