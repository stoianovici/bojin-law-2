/**
 * Business Owner Financial Access Integration Test
 * Story 2.11.1: Business Owner Role & Financial Data Scope
 *
 * Tests the complete integration of BusinessOwner role with financial data access
 * across the GraphQL API layer.
 */

import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphql, GraphQLSchema } from 'graphql';
import {
  requiresFinancialAccessDirective,
  requiresFinancialAccessTypeDefs,
} from '../../src/graphql/directives/requiresFinancialAccess';
import type { Context } from '../../src/graphql/resolvers/case.resolvers';
import {
  getFinancialDataScope,
  getFinancialDataFilter,
  hasFinancialAccess,
  isBusinessOwner,
} from '../../src/graphql/resolvers/utils/financialDataScope';

// Test schema that mimics production schema
const typeDefs = `
  ${requiresFinancialAccessTypeDefs}

  type Query {
    case(id: ID!): Case
    cases: [Case!]!
    firmFinancials: FirmFinancials @requiresFinancialAccess
  }

  type Case {
    id: ID!
    title: String!
    status: String!
    value: Float @requiresFinancialAccess
    billingType: String @requiresFinancialAccess
    customRates: CustomRates @requiresFinancialAccess
    description: String
    client: Client
  }

  type Client {
    id: ID!
    name: String!
  }

  type CustomRates {
    partnerRate: Float
    associateRate: Float
    paralegalRate: Float
  }

  type FirmFinancials {
    totalRevenue: Float!
    pendingInvoices: Float!
    casesWithFinancials: [Case!]!
  }
`;

// Mock data
const mockCases = [
  {
    id: 'case-1',
    title: 'ABC Corp v. XYZ Inc',
    status: 'Active',
    value: 50000.0,
    billingType: 'Hourly',
    customRates: { partnerRate: 500, associateRate: 300, paralegalRate: 150 },
    description: 'Commercial litigation',
    client: { id: 'client-1', name: 'ABC Corp' },
  },
  {
    id: 'case-2',
    title: 'Estate of Smith',
    status: 'Active',
    value: 25000.0,
    billingType: 'Fixed',
    customRates: null,
    description: 'Probate matter',
    client: { id: 'client-2', name: 'Smith Estate' },
  },
];

// Test resolvers
const resolvers = {
  Query: {
    case: (_: unknown, args: { id: string }) => mockCases.find((c) => c.id === args.id),
    cases: () => mockCases,
    firmFinancials: () => ({
      totalRevenue: 750000.0,
      pendingInvoices: 125000.0,
      casesWithFinancials: mockCases,
    }),
  },
};

// Helper to create schema with directive applied
function createTestSchema(): GraphQLSchema {
  let schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });

  schema = requiresFinancialAccessDirective()(schema);

  return schema;
}

// Helper to create mock context with financial data scope
function createMockContext(
  role: string | null,
  authenticated: boolean = true,
  userId: string = 'user-123',
  firmId: string = 'firm-456'
): Context {
  const user =
    authenticated && role
      ? {
          id: userId,
          firmId,
          role,
          email: `${role.toLowerCase()}@example.com`,
        }
      : undefined;

  // Calculate financial data scope based on role
  let financialDataScope: 'own' | 'firm' | null = null;
  if (role === 'BusinessOwner') {
    financialDataScope = 'firm';
  } else if (role === 'Partner') {
    financialDataScope = 'own';
  }

  return {
    user,
    financialDataScope,
  } as Context;
}

describe('Story 2.11.1: Business Owner Financial Access Integration', () => {
  let schema: GraphQLSchema;

  beforeAll(() => {
    schema = createTestSchema();
  });

  beforeEach(() => {
    jest.spyOn(console, 'info').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('BusinessOwner Role Access', () => {
    it('BusinessOwner can access all financial fields on cases', async () => {
      const context = createMockContext('BusinessOwner');

      const query = `
        query {
          cases {
            id
            title
            value
            billingType
            customRates {
              partnerRate
              associateRate
              paralegalRate
            }
          }
        }
      `;

      const result = await graphql({ schema, source: query, contextValue: context });

      expect(result.errors).toBeUndefined();
      const data = result.data as { cases: any[] };
      expect(data?.cases).toHaveLength(2);
      expect(data?.cases[0]).toMatchObject({
        id: 'case-1',
        title: 'ABC Corp v. XYZ Inc',
        value: 50000.0,
        billingType: 'Hourly',
        customRates: {
          partnerRate: 500,
          associateRate: 300,
          paralegalRate: 150,
        },
      });
    });

    it('BusinessOwner can access firm-wide financial data', async () => {
      const context = createMockContext('BusinessOwner');

      const query = `
        query {
          firmFinancials {
            totalRevenue
            pendingInvoices
            casesWithFinancials {
              id
              value
            }
          }
        }
      `;

      const result = await graphql({ schema, source: query, contextValue: context });

      expect(result.errors).toBeUndefined();
      const data = result.data as { firmFinancials: any };
      expect(data?.firmFinancials).toMatchObject({
        totalRevenue: 750000.0,
        pendingInvoices: 125000.0,
      });
      expect(data?.firmFinancials.casesWithFinancials).toHaveLength(2);
    });

    it('BusinessOwner has "firm" financial data scope', () => {
      const context = createMockContext('BusinessOwner');
      expect(getFinancialDataScope(context)).toBe('firm');
    });
  });

  describe('Partner Role Access (Comparison)', () => {
    it('Partner can access financial fields on cases', async () => {
      const context = createMockContext('Partner');

      const query = `
        query {
          cases {
            id
            title
            value
            billingType
          }
        }
      `;

      const result = await graphql({ schema, source: query, contextValue: context });

      expect(result.errors).toBeUndefined();
      const data = result.data as { cases: any[] };
      expect(data?.cases).toHaveLength(2);
      expect(data?.cases[0].value).toBe(50000.0);
      expect(data?.cases[0].billingType).toBe('Hourly');
    });

    it('Partner has "own" financial data scope', () => {
      const context = createMockContext('Partner');
      expect(getFinancialDataScope(context)).toBe('own');
    });
  });

  describe('Non-Financial Roles Access', () => {
    it('Associate receives null for financial fields', async () => {
      const context = createMockContext('Associate');

      const query = `
        query {
          cases {
            id
            title
            value
            billingType
            description
          }
        }
      `;

      const result = await graphql({ schema, source: query, contextValue: context });

      expect(result.errors).toBeUndefined();
      const data = result.data as { cases: any[] };
      expect(data?.cases).toHaveLength(2);
      expect(data?.cases[0]).toMatchObject({
        id: 'case-1',
        title: 'ABC Corp v. XYZ Inc',
        value: null,
        billingType: null,
        description: 'Commercial litigation',
      });
    });

    it('Paralegal receives null for financial fields', async () => {
      const context = createMockContext('Paralegal');

      const query = `
        query {
          case(id: "case-1") {
            id
            title
            value
            billingType
            client {
              id
              name
            }
          }
        }
      `;

      const result = await graphql({ schema, source: query, contextValue: context });

      expect(result.errors).toBeUndefined();
      expect(result.data?.case).toMatchObject({
        id: 'case-1',
        title: 'ABC Corp v. XYZ Inc',
        value: null,
        billingType: null,
        client: {
          id: 'client-1',
          name: 'ABC Corp',
        },
      });
    });
  });

  describe('Financial Data Filter Utility', () => {
    it('BusinessOwner gets firm-wide filter', () => {
      const context = createMockContext('BusinessOwner', true, 'owner-1', 'firm-abc');
      const filter = getFinancialDataFilter(context);

      expect(filter).toEqual({
        firmId: 'firm-abc',
      });
    });

    it('Partner gets managed-cases filter', () => {
      const context = createMockContext('Partner', true, 'partner-1', 'firm-xyz');
      const filter = getFinancialDataFilter(context);

      expect(filter).toEqual({
        firmId: 'firm-xyz',
        teamMembers: {
          some: {
            userId: 'partner-1',
            role: 'Lead',
          },
        },
      });
    });

    it('Associate throws error when getting filter', () => {
      const context = createMockContext('Associate');
      expect(() => getFinancialDataFilter(context)).toThrow('Financial data access denied');
    });
  });

  describe('Utility Functions', () => {
    it('hasFinancialAccess returns true for BusinessOwner', () => {
      const context = createMockContext('BusinessOwner');
      expect(hasFinancialAccess(context)).toBe(true);
    });

    it('hasFinancialAccess returns true for Partner', () => {
      const context = createMockContext('Partner');
      expect(hasFinancialAccess(context)).toBe(true);
    });

    it('hasFinancialAccess returns false for Associate', () => {
      const context = createMockContext('Associate');
      expect(hasFinancialAccess(context)).toBe(false);
    });

    it('isBusinessOwner returns true only for BusinessOwner', () => {
      expect(isBusinessOwner(createMockContext('BusinessOwner'))).toBe(true);
      expect(isBusinessOwner(createMockContext('Partner'))).toBe(false);
      expect(isBusinessOwner(createMockContext('Associate'))).toBe(false);
      expect(isBusinessOwner(createMockContext('Paralegal'))).toBe(false);
    });
  });

  describe('Security: Firm Isolation', () => {
    it('BusinessOwner from Firm A cannot access Firm B data via scope filter', () => {
      // This test documents that the filter correctly isolates firm data
      const firmAContext = createMockContext('BusinessOwner', true, 'owner-a', 'firm-a');
      const firmBContext = createMockContext('BusinessOwner', true, 'owner-b', 'firm-b');

      const filterA = getFinancialDataFilter(firmAContext);
      const filterB = getFinancialDataFilter(firmBContext);

      // Each BusinessOwner's filter is scoped to their own firm
      expect(filterA).toEqual({ firmId: 'firm-a' });
      expect(filterB).toEqual({ firmId: 'firm-b' });

      // Filters are different - firm isolation preserved
      expect(filterA.firmId).not.toBe(filterB.firmId);
    });
  });

  describe('Logging', () => {
    it('does not log access for BusinessOwner', async () => {
      const consoleSpy = jest.spyOn(console, 'info');
      const context = createMockContext('BusinessOwner');

      const query = `
        query {
          case(id: "case-1") {
            value
          }
        }
      `;

      await graphql({ schema, source: query, contextValue: context });

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('logs unauthorized access attempts from Associates', async () => {
      const consoleSpy = jest.spyOn(console, 'info');
      const context = createMockContext('Associate');

      const query = `
        query {
          case(id: "case-1") {
            value
          }
        }
      `;

      await graphql({ schema, source: query, contextValue: context });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Financial data access denied',
        expect.objectContaining({
          userRole: 'Associate',
          field: 'value',
        })
      );
    });
  });
});
