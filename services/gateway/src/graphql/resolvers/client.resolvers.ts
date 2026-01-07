/**
 * Client GraphQL Resolvers
 * OPS-226: Client Query + Resolver for Client Portfolio View
 *
 * Implements the client(id) query to fetch a client with their case portfolio
 */

import { prisma, Prisma } from '@legal-platform/database';
import { GraphQLError } from 'graphql';

// ============================================================================
// Types
// ============================================================================

interface Context {
  user?: {
    id: string;
    firmId: string;
    role: 'Partner' | 'Associate' | 'Paralegal' | 'BusinessOwner';
    email: string;
  };
}

interface ContactInfo {
  email?: string;
  phone?: string;
  [key: string]: unknown;
}

// ============================================================================
// Helpers
// ============================================================================

function requireAuth(context: Context) {
  if (!context.user) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return context.user;
}

/**
 * Extract email from contactInfo JSON field
 */
function extractEmail(contactInfo: unknown): string | null {
  if (!contactInfo || typeof contactInfo !== 'object') return null;
  const info = contactInfo as ContactInfo;
  return info.email || null;
}

/**
 * Extract phone from contactInfo JSON field
 */
function extractPhone(contactInfo: unknown): string | null {
  if (!contactInfo || typeof contactInfo !== 'object') return null;
  const info = contactInfo as ContactInfo;
  return info.phone || null;
}

// ============================================================================
// Input Types
// ============================================================================

interface UpdateClientInput {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
}

// ============================================================================
// Resolvers
// ============================================================================

export const clientResolvers = {
  Query: {
    /**
     * Get a client by ID with their case portfolio
     * Authorization: Authenticated users in the same firm
     */
    client: async (_: unknown, args: { id: string }, context: Context) => {
      const user = requireAuth(context);

      // Fetch client with cases, ensuring firm isolation
      const client = await prisma.client.findFirst({
        where: {
          id: args.id,
          firmId: user.firmId,
        },
        include: {
          cases: {
            select: {
              id: true,
              caseNumber: true,
              title: true,
              status: true,
              type: true,
              openedDate: true,
            },
            orderBy: { openedDate: 'desc' },
          },
        },
      });

      if (!client) {
        return null;
      }

      // Calculate case counts
      const caseCount = client.cases.length;
      const activeCaseCount = client.cases.filter((c) => c.status === 'Active').length;

      // Extract contact details from JSON
      const email = extractEmail(client.contactInfo);
      const phone = extractPhone(client.contactInfo);

      return {
        id: client.id,
        name: client.name,
        email,
        phone,
        address: client.address,
        cases: client.cases,
        caseCount,
        activeCaseCount,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
      };
    },
  },

  Mutation: {
    /**
     * Update an existing client
     * Authorization: Authenticated users in the same firm (Partner/Associate only)
     */
    updateClient: async (
      _: unknown,
      args: { id: string; input: UpdateClientInput },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Only Partners and Associates can update clients
      if (user.role !== 'Partner' && user.role !== 'Associate') {
        throw new GraphQLError('Insufficient permissions to update client', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Check if client exists and belongs to user's firm
      const existingClient = await prisma.client.findFirst({
        where: {
          id: args.id,
          firmId: user.firmId,
        },
      });

      if (!existingClient) {
        throw new GraphQLError('Client not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Build contactInfo update
      const existingContactInfo = (existingClient.contactInfo as ContactInfo) || {};
      const newContactInfo: ContactInfo = { ...existingContactInfo };

      if (args.input.email !== undefined) {
        newContactInfo.email = args.input.email || undefined;
      }
      if (args.input.phone !== undefined) {
        newContactInfo.phone = args.input.phone || undefined;
      }

      // Update the client
      const updatedClient = await prisma.client.update({
        where: { id: args.id },
        data: {
          ...(args.input.name !== undefined && { name: args.input.name }),
          ...(args.input.address !== undefined && { address: args.input.address }),
          contactInfo: newContactInfo as Prisma.InputJsonValue,
        },
        include: {
          cases: {
            select: {
              id: true,
              caseNumber: true,
              title: true,
              status: true,
              type: true,
              openedDate: true,
            },
            orderBy: { openedDate: 'desc' },
          },
        },
      });

      // Calculate case counts
      const caseCount = updatedClient.cases.length;
      const activeCaseCount = updatedClient.cases.filter(
        (c: { status: string }) => c.status === 'Active'
      ).length;

      // Extract contact details from JSON
      const email = extractEmail(updatedClient.contactInfo);
      const phone = extractPhone(updatedClient.contactInfo);

      return {
        id: updatedClient.id,
        name: updatedClient.name,
        email,
        phone,
        address: updatedClient.address,
        cases: updatedClient.cases,
        caseCount,
        activeCaseCount,
        createdAt: updatedClient.createdAt,
        updatedAt: updatedClient.updatedAt,
      };
    },
  },
};

export default clientResolvers;
