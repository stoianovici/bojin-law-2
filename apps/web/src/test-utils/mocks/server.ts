/**
 * MSW Server Setup for Integration Tests
 * Story 2.8: Case CRUD Operations UI - Task 20
 *
 * Using MSW v2.x (ESM) with Jest ESM mode
 */

import { setupServer } from 'msw/node';
import { graphqlHandlers } from './graphql-handlers';

// Setup MSW server with GraphQL handlers
export const server = setupServer(...graphqlHandlers);

// Establish API mocking before all tests
export function setupMSW() {
  beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

  // Reset handlers after each test
  afterEach(() => server.resetHandlers());

  // Clean up after all tests
  afterAll(() => server.close());
}
