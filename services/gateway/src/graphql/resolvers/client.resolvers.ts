/**
 * Client GraphQL Resolvers
 * OPS-226: Client Query + Resolver for Client Portfolio View
 *
 * Implements the client(id) query to fetch a client with their case portfolio
 */

import { prisma } from '@legal-platform/database';
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
};

export default clientResolvers;
