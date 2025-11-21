/**
 * Apollo Server Setup
 * Story 2.6: Case Management Data Model and API
 */

import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { loadSchema } from './schema';
import { caseResolvers, Context } from './resolvers/case.resolvers';
import { DateTimeResolver, UUIDResolver, JSONResolver } from 'graphql-scalars';
import http from 'http';
import express, { Request, RequestHandler } from 'express';

// Merge all resolvers
const resolvers = {
  DateTime: DateTimeResolver,
  UUID: UUIDResolver,
  JSON: JSONResolver,
  ...caseResolvers,
};

/**
 * Create Apollo Server instance
 */
export async function createApolloServer(httpServer: http.Server) {
  const typeDefs = loadSchema();

  const server = new ApolloServer({
    typeDefs,
    resolvers,
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
      // Extract user from session (set by authentication middleware)
      const user = (req as any).session?.user;

      return {
        user: user
          ? {
              id: user.id,
              firmId: user.firmId,
              role: user.role,
              email: user.email,
            }
          : undefined,
      };
    },
  });
}
