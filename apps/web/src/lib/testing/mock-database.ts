/**
 * Mock Database Testing Utilities
 * Story 2.15: Test Architecture Refactoring - Dependency Injection
 *
 * Provides helper functions for creating mock database clients in tests.
 * Use these utilities instead of manually creating mocks in each test file.
 */

import { jest } from '@jest/globals';
import type { DatabaseClient, QueryResult } from '@legal-platform/types';

/**
 * Create a mock DatabaseClient for testing
 *
 * @param overrides Optional overrides for specific methods
 * @returns Mock database client with jest mock functions
 *
 * @example
 * ```typescript
 * const mockDb = createMockDatabaseClient();
 * (mockDb.query as jest.Mock).mockResolvedValueOnce({ rows: [], rowCount: 0 });
 * const service = new MyService(mockDb);
 * ```
 */
export function createMockDatabaseClient(
  overrides?: Partial<DatabaseClient>
): DatabaseClient {
  return {
    query: jest.fn(),
    transaction: jest.fn(),
    getClient: jest.fn(),
    closePool: jest.fn(),
    ...overrides,
  };
}

/**
 * Create a mock query result
 *
 * @param rows Array of rows to return
 * @param rowCount Number of rows affected (defaults to rows.length)
 * @returns QueryResult object
 *
 * @example
 * ```typescript
 * const result = createMockQueryResult([{ id: 1, name: 'Test' }]);
 * (mockDb.query as jest.Mock).mockResolvedValue(result);
 * ```
 */
export function createMockQueryResult<T = any>(
  rows: T[],
  rowCount?: number
): QueryResult<T> {
  return {
    rows,
    rowCount: rowCount ?? rows.length,
    command: 'SELECT',
    fields: [],
  };
}

/**
 * Create a mock DatabaseClient with pre-configured responses
 *
 * Useful for setting up multiple query responses at once.
 *
 * @param responses Array of mock responses (in order they will be called)
 * @returns Mock database client with responses configured
 *
 * @example
 * ```typescript
 * const mockDb = createMockDatabaseClientWithResponses([
 *   { rows: [{ id: 1 }], rowCount: 1 },
 *   { rows: [{ count: 10 }], rowCount: 1 },
 * ]);
 *
 * // First query returns { rows: [{ id: 1 }] }
 * // Second query returns { rows: [{ count: 10 }] }
 * ```
 */
export function createMockDatabaseClientWithResponses(
  responses: QueryResult[]
): DatabaseClient {
  const mockQuery = jest.fn();

  // Configure mock to return responses in sequence
  responses.forEach((response) => {
    mockQuery.mockResolvedValueOnce(response);
  });

  return {
    query: mockQuery,
    transaction: jest.fn(),
    getClient: jest.fn(),
    closePool: jest.fn(),
  };
}

/**
 * Create a mock DatabaseClient that always fails
 *
 * Useful for testing error handling.
 *
 * @param error Error to throw (defaults to generic database error)
 * @returns Mock database client that rejects all operations
 *
 * @example
 * ```typescript
 * const mockDb = createFailingDatabaseClient(new Error('Connection failed'));
 * const service = new MyService(mockDb);
 * await expect(service.getData()).rejects.toThrow('Connection failed');
 * ```
 */
export function createFailingDatabaseClient(
  error: Error = new Error('Database operation failed')
): DatabaseClient {
  return {
    query: jest.fn().mockRejectedValue(error),
    transaction: jest.fn().mockRejectedValue(error),
    getClient: jest.fn().mockRejectedValue(error),
    closePool: jest.fn().mockRejectedValue(error),
  };
}

/**
 * Reset all mock database client function calls
 *
 * Call this in beforeEach() or between tests to clear mock history.
 *
 * @param mockDb Mock database client to reset
 *
 * @example
 * ```typescript
 * let mockDb: DatabaseClient;
 *
 * beforeEach(() => {
 *   mockDb = createMockDatabaseClient();
 * });
 *
 * afterEach(() => {
 *   resetMockDatabaseClient(mockDb);
 * });
 * ```
 */
export function resetMockDatabaseClient(mockDb: DatabaseClient): void {
  (mockDb.query as jest.Mock).mockClear();
  (mockDb.transaction as jest.Mock).mockClear();
  (mockDb.getClient as jest.Mock).mockClear();
  (mockDb.closePool as jest.Mock).mockClear();
}

/**
 * Assert that a query was called with specific SQL pattern and parameters
 *
 * Helper for common assertion pattern in database tests.
 *
 * @param mockDb Mock database client
 * @param sqlPattern String or regex to match SQL query
 * @param params Optional array of expected parameters
 *
 * @example
 * ```typescript
 * await service.getUserById('123');
 * assertQueryCalledWith(mockDb, 'SELECT * FROM users WHERE id = $1', ['123']);
 * ```
 */
export function assertQueryCalledWith(
  mockDb: DatabaseClient,
  sqlPattern: string | RegExp,
  params?: any[]
): void {
  const queryMock = mockDb.query as jest.Mock;

  if (params !== undefined) {
    expect(queryMock).toHaveBeenCalledWith(
      typeof sqlPattern === 'string'
        ? expect.stringContaining(sqlPattern)
        : expect.stringMatching(sqlPattern),
      params
    );
  } else {
    expect(queryMock).toHaveBeenCalledWith(
      typeof sqlPattern === 'string'
        ? expect.stringContaining(sqlPattern)
        : expect.stringMatching(sqlPattern)
    );
  }
}

/**
 * Get all SQL queries executed on a mock database client
 *
 * Useful for debugging test failures or verifying query patterns.
 *
 * @param mockDb Mock database client
 * @returns Array of SQL query strings
 *
 * @example
 * ```typescript
 * await service.processData();
 * const queries = getExecutedQueries(mockDb);
 * console.log('Executed queries:', queries);
 * ```
 */
export function getExecutedQueries(mockDb: DatabaseClient): string[] {
  const queryMock = mockDb.query as jest.Mock;
  return queryMock.mock.calls.map((call: any[]) => call[0]);
}

/**
 * Common mock data generators for testing
 */
export const mockData = {
  /**
   * Generate a mock template usage log
   */
  templateUsageLog: (overrides?: any) => ({
    template_id: 'template-123',
    user_id: 'user-456',
    execution_time_ms: 5000,
    time_saved_minutes: 45,
    variables_provided: { NAME: 'John Doe' },
    output_format: 'markdown',
    success: true,
    used_at: new Date(),
    ...overrides,
  }),

  /**
   * Generate a mock Romanian template
   */
  romanianTemplate: (overrides?: any) => ({
    id: 'template-123',
    template_name_ro: 'Notificare Avocateasca',
    template_name_en: 'Legal Notice',
    template_content_ro: 'Către {{NAME}}, prin prezenta vă notificăm...',
    template_content_en: 'To {{NAME}}, we hereby notify you...',
    variable_mappings: {
      NAME: { type: 'text', required: true },
    },
    avg_time_savings_minutes: 60,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }),

  /**
   * Generate mock document type stats
   */
  documentTypeStats: (overrides?: any) => ({
    id: '123',
    discoveredTypeOriginal: 'Contract de Vanzare',
    discoveredTypeNormalized: 'contract_vanzare',
    discoveredTypeEnglish: 'Sales Contract',
    primaryLanguage: 'ro',
    mappedSkillId: 'document-drafting',
    totalOccurrences: 50,
    priorityScore: 0.85,
    mappingStatus: 'mapped',
    confidence: 0.90,
    lastDiscovered: new Date(),
    estimatedTimeSavings: 2.5,
    estimatedMonthlySavings: '€1042/month',
    ...overrides,
  }),
};
