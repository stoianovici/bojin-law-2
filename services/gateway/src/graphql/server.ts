/**
 * Apollo Server Setup
 * Story 2.6: Case Management Data Model and API
 * Story 2.8.1: Billing & Rate Management (firm resolvers)
 * Story 2.8.2: Case Approval Workflow (approval resolvers, notification resolvers)
 * Story 2.8.3: Role-Based Financial Visibility (directive support)
 * Story 2.8.4: Cross-Case Document Linking (document resolvers)
 * Story 2.10: Basic AI Search Implementation (search resolvers)
 * Story 2.11.1: Business Owner Role & Financial Data Scope
 * Story 2.11.3: Financial KPIs Backend Service (financialKPIs resolvers)
 */

import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import type { Request, RequestHandler } from 'express';
import { DateTimeResolver, JSONResolver, UUIDResolver } from 'graphql-scalars';
import http from 'http';
import { approvalResolvers } from './resolvers/approval.resolvers';
import { caseResolvers, type Context } from './resolvers/case.resolvers';
import { documentResolvers } from './resolvers/document.resolvers';
import { firmResolvers } from './resolvers/firm.resolvers';
import { notificationResolvers } from './resolvers/notification.resolvers';
import { searchResolvers } from './resolvers/search.resolvers';
import { financialKPIsResolvers } from './resolvers/financial-kpis.resolvers';
import { buildExecutableSchema, loadSchema } from './schema';
import type { FinancialDataScope } from './resolvers/utils/financialDataScope';

/**
 * Determine financial data scope based on user role
 * Story 2.11.1: BusinessOwner gets 'firm' scope, Partner gets 'own' scope
 */
function getFinancialDataScopeFromRole(
  role: string | undefined
): FinancialDataScope | null {
  if (role === 'BusinessOwner') return 'firm';
  if (role === 'Partner') return 'own';
  return null;
}

// Merge all resolvers
const resolvers = {
  DateTime: DateTimeResolver,
  UUID: UUIDResolver,
  JSON: JSONResolver,
  Query: {
    ...caseResolvers.Query,
    ...firmResolvers.Query,
    ...approvalResolvers.Query,
    ...notificationResolvers.Query,
    ...documentResolvers.Query,
    ...searchResolvers.Query,
    ...financialKPIsResolvers.Query,
  },
  Mutation: {
    ...caseResolvers.Mutation,
    ...firmResolvers.Mutation,
    ...approvalResolvers.Mutation,
    ...notificationResolvers.Mutation,
    ...documentResolvers.Mutation,
  },
  Case: caseResolvers.Case,
  Firm: firmResolvers.Firm,
  CaseApproval: approvalResolvers.CaseApproval,
  Notification: notificationResolvers.Notification,
  Document: documentResolvers.Document,
  DocumentAuditLog: documentResolvers.DocumentAuditLog,
  // Search resolvers (Story 2.10)
  SearchResult: searchResolvers.SearchResult,
  CaseSearchResult: searchResolvers.CaseSearchResult,
  DocumentSearchResult: searchResolvers.DocumentSearchResult,
  ClientSearchResult: searchResolvers.ClientSearchResult,
};

/**
 * Create Apollo Server instance
 */
export async function createApolloServer(httpServer: http.Server) {
  const typeDefs = loadSchema();

  // Build executable schema with directives applied
  const schema = buildExecutableSchema(typeDefs, resolvers);

  const server = new ApolloServer({
    schema,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    introspection: process.env.NODE_ENV !== 'production',
  });

  await server.start();

  return server;
}

/**
 * Create GraphQL middleware for Express
 */
export function createGraphQLMiddleware(server: ApolloServer<Context>): RequestHandler {
  return expressMiddleware(server, {
    context: async ({ req }: { req: Request }): Promise<Context> => {
      // Support for mock user in development (bypassing session)
      if (process.env.NODE_ENV !== 'production' && req.headers['x-mock-user']) {
        try {
          const mockUser = JSON.parse(req.headers['x-mock-user'] as string);
          return {
            user: {
              id: mockUser.userId,
              firmId: mockUser.firmId,
              role: mockUser.role,
              email: mockUser.email,
            },
            // Story 2.11.1: Populate financial data scope based on role
            financialDataScope: getFinancialDataScopeFromRole(mockUser.role),
          };
        } catch (error) {
          console.warn('Invalid x-mock-user header:', error);
        }
      }

      // Extract user from session (set by authentication middleware)
      const user = (req as any).session?.user;

      return {
        user: user
          ? {
              id: user.userId, // Session stores userId, not id
              firmId: user.firmId,
              role: user.role,
              email: user.email,
            }
          : undefined,
        // Story 2.11.1: Populate financial data scope based on role
        financialDataScope: getFinancialDataScopeFromRole(user?.role),
      };
    },
  });
}
