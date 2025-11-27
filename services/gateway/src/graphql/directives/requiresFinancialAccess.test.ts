/**
 * @requiresFinancialAccess Directive Tests
 * Story 2.8.3: Role-Based Financial Visibility
 * Story 2.11.1: Business Owner Role & Financial Data Scope
 */

import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphql, GraphQLSchema } from 'graphql';
import {
  requiresFinancialAccessDirective,
  requiresFinancialAccessTypeDefs,
  hasFinancialAccess,
} from './requiresFinancialAccess';
import type { Context } from '../resolvers/case.resolvers';

// Test schema
const typeDefs = `
  ${requiresFinancialAccessTypeDefs}

  type Query {
    testCase: TestCase
  }

  type TestCase {
    id: ID!
    title: String!
    value: Float @requiresFinancialAccess
    billingType: String @requiresFinancialAccess
    description: String
  }
`;

// Test resolvers
const resolvers = {
  Query: {
    testCase: () => ({
      id: '1',
      title: 'Test Case',
      value: 50000.0,
      billingType: 'Hourly',
      description: 'Test description',
    }),
  },
};

// Helper to create schema with directive applied
function createTestSchema(): GraphQLSchema {
  let schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });

  // Apply directive transformer
  schema = requiresFinancialAccessDirective()(schema);

  return schema;
}

// Helper to create mock context
function createMockContext(role: string | null, authenticated: boolean = true): Context {
  return {
    user: authenticated && role
      ? {
          id: 'user-123',
          firmId: 'firm-456',
          role,
          email: 'test@example.com',
        }
      : undefined,
  } as Context;
}

describe('requiresFinancialAccess Directive', () => {
  let schema: GraphQLSchema;

  beforeAll(() => {
    schema = createTestSchema();
  });

  beforeEach(() => {
    // Mock console.info to silence log output during tests
    jest.spyOn(console, 'info').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Partner access', () => {
    it('allows Partners to access financial fields', async () => {
      const context = createMockContext('Partner');

      const query = `
        query {
          testCase {
            id
            title
            value
            billingType
          }
        }
      `;

      const result = await graphql({ schema, source: query, contextValue: context });

      expect(result.errors).toBeUndefined();
      expect(result.data?.testCase).toEqual({
        id: '1',
        title: 'Test Case',
        value: 50000.0,
        billingType: 'Hourly',
      });
    });

    it('allows Partners to access all fields', async () => {
      const context = createMockContext('Partner');

      const query = `
        query {
          testCase {
            id
            title
            description
            value
            billingType
          }
        }
      `;

      const result = await graphql({ schema, source: query, contextValue: context });

      expect(result.errors).toBeUndefined();
      expect(result.data?.testCase).toEqual({
        id: '1',
        title: 'Test Case',
        description: 'Test description',
        value: 50000.0,
        billingType: 'Hourly',
      });
    });

    it('does not log access attempts for Partners', async () => {
      const context = createMockContext('Partner');
      const consoleSpy = jest.spyOn(console, 'info');

      const query = `
        query {
          testCase {
            value
          }
        }
      `;

      await graphql({ schema, source: query, contextValue: context });

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  /**
   * Story 2.11.1: BusinessOwner access tests
   */
  describe('BusinessOwner access', () => {
    it('allows BusinessOwners to access financial fields', async () => {
      const context = createMockContext('BusinessOwner');

      const query = `
        query {
          testCase {
            id
            title
            value
            billingType
          }
        }
      `;

      const result = await graphql({ schema, source: query, contextValue: context });

      expect(result.errors).toBeUndefined();
      expect(result.data?.testCase).toEqual({
        id: '1',
        title: 'Test Case',
        value: 50000.0,
        billingType: 'Hourly',
      });
    });

    it('allows BusinessOwners to access all fields', async () => {
      const context = createMockContext('BusinessOwner');

      const query = `
        query {
          testCase {
            id
            title
            description
            value
            billingType
          }
        }
      `;

      const result = await graphql({ schema, source: query, contextValue: context });

      expect(result.errors).toBeUndefined();
      expect(result.data?.testCase).toEqual({
        id: '1',
        title: 'Test Case',
        description: 'Test description',
        value: 50000.0,
        billingType: 'Hourly',
      });
    });

    it('does not log access attempts for BusinessOwners', async () => {
      const context = createMockContext('BusinessOwner');
      const consoleSpy = jest.spyOn(console, 'info');

      const query = `
        query {
          testCase {
            value
          }
        }
      `;

      await graphql({ schema, source: query, contextValue: context });

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('Associate access', () => {
    it('returns null for financial fields when queried by Associate', async () => {
      const context = createMockContext('Associate');

      const query = `
        query {
          testCase {
            id
            title
            value
            billingType
          }
        }
      `;

      const result = await graphql({ schema, source: query, contextValue: context });

      expect(result.errors).toBeUndefined();
      expect(result.data?.testCase).toEqual({
        id: '1',
        title: 'Test Case',
        value: null,
        billingType: null,
      });
    });

    it('allows Associates to access non-financial fields', async () => {
      const context = createMockContext('Associate');

      const query = `
        query {
          testCase {
            id
            title
            description
          }
        }
      `;

      const result = await graphql({ schema, source: query, contextValue: context });

      expect(result.errors).toBeUndefined();
      expect(result.data?.testCase).toEqual({
        id: '1',
        title: 'Test Case',
        description: 'Test description',
      });
    });

    it('logs unauthorized access attempts', async () => {
      const context = createMockContext('Associate');
      const consoleSpy = jest.spyOn(console, 'info');

      const query = `
        query {
          testCase {
            value
          }
        }
      `;

      await graphql({ schema, source: query, contextValue: context });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Financial data access denied',
        expect.objectContaining({
          userId: 'user-123',
          firmId: 'firm-456',
          userRole: 'Associate',
          field: 'value',
        })
      );
    });

    it('logs multiple field access attempts separately', async () => {
      const context = createMockContext('Associate');
      const consoleSpy = jest.spyOn(console, 'info');

      const query = `
        query {
          testCase {
            value
            billingType
          }
        }
      `;

      await graphql({ schema, source: query, contextValue: context });

      expect(consoleSpy).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Financial data access denied',
        expect.objectContaining({ field: 'value' })
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        'Financial data access denied',
        expect.objectContaining({ field: 'billingType' })
      );
    });
  });

  describe('Paralegal access', () => {
    it('returns null for financial fields when queried by Paralegal', async () => {
      const context = createMockContext('Paralegal');

      const query = `
        query {
          testCase {
            id
            title
            value
            billingType
          }
        }
      `;

      const result = await graphql({ schema, source: query, contextValue: context });

      expect(result.errors).toBeUndefined();
      expect(result.data?.testCase).toEqual({
        id: '1',
        title: 'Test Case',
        value: null,
        billingType: null,
      });
    });

    it('logs unauthorized access attempts from Paralegals', async () => {
      const context = createMockContext('Paralegal');
      const consoleSpy = jest.spyOn(console, 'info');

      const query = `
        query {
          testCase {
            billingType
          }
        }
      `;

      await graphql({ schema, source: query, contextValue: context });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Financial data access denied',
        expect.objectContaining({
          userRole: 'Paralegal',
          field: 'billingType',
        })
      );
    });
  });

  describe('Unauthenticated access', () => {
    it('returns null for financial fields when user is not authenticated', async () => {
      const context = createMockContext(null, false);

      const query = `
        query {
          testCase {
            id
            title
            value
          }
        }
      `;

      const result = await graphql({ schema, source: query, contextValue: context });

      expect(result.errors).toBeUndefined();
      expect(result.data?.testCase).toEqual({
        id: '1',
        title: 'Test Case',
        value: null,
      });
    });

    it('logs unauthenticated access attempts', async () => {
      const context = createMockContext(null, false);
      const consoleSpy = jest.spyOn(console, 'info');

      const query = `
        query {
          testCase {
            value
          }
        }
      `;

      await graphql({ schema, source: query, contextValue: context });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Financial data access denied',
        expect.objectContaining({
          userId: 'anonymous',
          firmId: null,
          userRole: 'UNAUTHENTICATED',
        })
      );
    });
  });

  describe('hasFinancialAccess utility function', () => {
    it('returns true for Partners', () => {
      const context = createMockContext('Partner');
      expect(hasFinancialAccess(context)).toBe(true);
    });

    /**
     * Story 2.11.1: BusinessOwner has financial access
     */
    it('returns true for BusinessOwners', () => {
      const context = createMockContext('BusinessOwner');
      expect(hasFinancialAccess(context)).toBe(true);
    });

    it('returns false for Associates', () => {
      const context = createMockContext('Associate');
      expect(hasFinancialAccess(context)).toBe(false);
    });

    it('returns false for Paralegals', () => {
      const context = createMockContext('Paralegal');
      expect(hasFinancialAccess(context)).toBe(false);
    });

    it('returns false when user is not authenticated', () => {
      const context = createMockContext(null, false);
      expect(hasFinancialAccess(context)).toBe(false);
    });

    it('returns false when user is null', () => {
      const context = { user: undefined } as Context;
      expect(hasFinancialAccess(context)).toBe(false);
    });

    it('returns false when context is undefined', () => {
      const context = {} as Context;
      expect(hasFinancialAccess(context)).toBe(false);
    });
  });

  describe('Directive behavior', () => {
    it('does not affect non-financial fields', async () => {
      const context = createMockContext('Associate');

      const query = `
        query {
          testCase {
            id
            title
            description
          }
        }
      `;

      const result = await graphql({ schema, source: query, contextValue: context });

      expect(result.errors).toBeUndefined();
      expect(result.data?.testCase).toEqual({
        id: '1',
        title: 'Test Case',
        description: 'Test description',
      });
    });

    it('gracefully degrades (returns null, not error)', async () => {
      const context = createMockContext('Associate');

      const query = `
        query {
          testCase {
            value
          }
        }
      `;

      const result = await graphql({ schema, source: query, contextValue: context });

      // Should not have errors
      expect(result.errors).toBeUndefined();

      // Should return null for financial field
      expect((result.data as any)?.testCase.value).toBeNull();
    });

    it('does not break query execution when financial field is denied', async () => {
      const context = createMockContext('Paralegal');

      const query = `
        query {
          testCase {
            id
            title
            value
            description
          }
        }
      `;

      const result = await graphql({ schema, source: query, contextValue: context });

      expect(result.errors).toBeUndefined();
      expect(result.data?.testCase).toEqual({
        id: '1',
        title: 'Test Case',
        value: null,
        description: 'Test description',
      });
    });
  });

  describe('Log format', () => {
    it('includes all required fields in log', async () => {
      const context = createMockContext('Associate');
      const consoleSpy = jest.spyOn(console, 'info');

      const query = `
        query {
          testCase {
            value
          }
        }
      `;

      await graphql({ schema, source: query, contextValue: context });

      const logCall = consoleSpy.mock.calls[0];
      expect(logCall[0]).toBe('Financial data access denied');
      expect(logCall[1]).toMatchObject({
        userId: 'user-123',
        firmId: 'firm-456',
        userRole: 'Associate',
        field: 'value',
        timestamp: expect.any(String),
        message: expect.stringContaining('Associate'),
      });
    });

    it('includes timestamp in ISO format', async () => {
      const context = createMockContext('Associate');
      const consoleSpy = jest.spyOn(console, 'info');

      const query = `
        query {
          testCase {
            value
          }
        }
      `;

      await graphql({ schema, source: query, contextValue: context });

      const logCall = consoleSpy.mock.calls[0];
      const timestamp = logCall[1].timestamp;

      // Verify ISO 8601 format
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });
  });

  describe('Firm isolation (SEC-001)', () => {
    /**
     * Firm isolation verification test
     *
     * NOTE: The @requiresFinancialAccess directive handles role-based access (Partner vs non-Partner).
     * Firm isolation (ensuring Partner in Firm A cannot access Firm B data) is enforced at the
     * RESOLVER level, not the directive level.
     *
     * Case resolvers filter by firmId using: WHERE firmId = context.user.firmId
     * This test verifies the expected behavior and documents the security model.
     */
    it('documents that firm isolation is enforced at resolver level, not directive level', async () => {
      // Partner from Firm A
      const firmAContext = {
        user: {
          id: 'partner-firm-a',
          firmId: 'firm-a',
          role: 'Partner',
          email: 'partner@firma.com',
        },
      } as Context;

      // Partner from Firm B
      const firmBContext = {
        user: {
          id: 'partner-firm-b',
          firmId: 'firm-b',
          role: 'Partner',
          email: 'partner@firmb.com',
        },
      } as Context;

      const query = `
        query {
          testCase {
            id
            value
          }
        }
      `;

      // Both Partners can access the testCase in THIS test schema
      // because the test resolver doesn't implement firm filtering
      const resultA = await graphql({ schema, source: query, contextValue: firmAContext });
      const resultB = await graphql({ schema, source: query, contextValue: firmBContext });

      // Both Partners have role='Partner', so directive allows access
      expect(resultA.errors).toBeUndefined();
      expect((resultA.data as any)?.testCase.value).toBe(50000.0);

      expect(resultB.errors).toBeUndefined();
      expect((resultB.data as any)?.testCase.value).toBe(50000.0);

      // IMPORTANT: In the REAL schema, case resolvers implement firm isolation:
      // - getCases query: WHERE firmId = context.user.firmId
      // - getCase query: WHERE id = $id AND firmId = context.user.firmId
      //
      // This means Partner from Firm A querying cases will only receive Firm A cases.
      // Partner from Firm B will only receive Firm B cases.
      //
      // The directive's responsibility is role-based access (Partner vs non-Partner).
      // The resolver's responsibility is firm isolation (which cases a user can query).
      //
      // This is defense-in-depth:
      // 1. Resolver filters cases by firmId (primary isolation control)
      // 2. Directive restricts financial fields by role (financial visibility control)
      // 3. Both layers work together to ensure Partners only see their firm's financial data
    });

    it('directive allows any Partner to access financial fields (resolver handles firm filtering)', async () => {
      // Partner from Firm XYZ
      const partnerContext = {
        user: {
          id: 'partner-xyz',
          firmId: 'firm-xyz',
          role: 'Partner',
          email: 'partner@firmxyz.com',
        },
      } as Context;

      const query = `
        query {
          testCase {
            value
            billingType
          }
        }
      `;

      const result = await graphql({ schema, source: query, contextValue: partnerContext });

      // Directive allows access because user.role === 'Partner'
      // (regardless of firmId - that's the resolver's job)
      expect(result.errors).toBeUndefined();
      expect(result.data?.testCase).toEqual({
        value: 50000.0,
        billingType: 'Hourly',
      });

      // In production:
      // - The case resolver would have already filtered to only return cases
      //   where case.firmId === 'firm-xyz'
      // - If no matching cases, the resolver returns null/empty before directive runs
      // - Directive only runs on fields of cases that already passed firm isolation
    });

    it('logs firmId for cross-firm access tracking (even though directive allows it)', async () => {
      // This test verifies that firmId is logged, which helps security teams
      // track and audit access patterns across firms
      const consoleSpy = jest.spyOn(console, 'info');

      // Associate from Firm ABC (non-Partner, so directive denies)
      const associateContext = {
        user: {
          id: 'associate-abc',
          firmId: 'firm-abc',
          role: 'Associate',
          email: 'associate@firmabc.com',
        },
      } as Context;

      const query = `
        query {
          testCase {
            value
          }
        }
      `;

      await graphql({ schema, source: query, contextValue: associateContext });

      // Verify firmId is logged for security monitoring
      expect(consoleSpy).toHaveBeenCalledWith(
        'Financial data access denied',
        expect.objectContaining({
          firmId: 'firm-abc',
          userId: 'associate-abc',
          userRole: 'Associate',
        })
      );

      // Security teams can use these logs to:
      // - Verify Associates aren't attempting to access financial data
      // - Track access patterns per firm
      // - Audit compliance with financial visibility requirements
    });
  });
});
