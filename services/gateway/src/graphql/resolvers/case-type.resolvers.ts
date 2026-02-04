/**
 * Case Type Management GraphQL Resolvers
 * Dynamic case types per firm - allows Partners to create custom case types
 */

import { prisma } from '@legal-platform/database';
import { GraphQLError } from 'graphql';
import { requireAuth, type Context } from '../utils/auth';

// Input types
interface CreateCaseTypeInput {
  name: string;
  code: string;
  sortOrder?: number;
}

interface UpdateCaseTypeInput {
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
}

// Helper function to check full access (Partner, BusinessOwner, or operational oversight)
function requireFullAccess(context: Context) {
  const user = requireAuth(context);
  if (user.role !== 'Partner' && user.role !== 'BusinessOwner' && !user.hasOperationalOversight) {
    throw new GraphQLError('Doar partenerii pot gestiona tipurile de dosare', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
  return user;
}

// Default case types (system defaults in Romanian)
const DEFAULT_CASE_TYPES = [
  { code: 'LITIGATION', name: 'Litigii', sortOrder: 1 },
  { code: 'CONTRACT', name: 'Contracte', sortOrder: 2 },
  { code: 'ADVISORY', name: 'Consultanță', sortOrder: 3 },
  { code: 'CRIMINAL', name: 'Penal', sortOrder: 4 },
  { code: 'OTHER', name: 'Altele', sortOrder: 100 },
];

export const caseTypeResolvers = {
  Query: {
    /**
     * Get all case types for the current user's firm
     * Returns both system default types and custom firm-specific types
     */
    caseTypes: async (_parent: unknown, args: { includeInactive?: boolean }, context: Context) => {
      const user = requireAuth(context);

      // Get custom case types for the firm
      const customTypes = await prisma.caseTypeConfig.findMany({
        where: {
          firmId: user.firmId,
          ...(args.includeInactive ? {} : { isActive: true }),
        },
        orderBy: { sortOrder: 'asc' },
        include: {
          creator: true,
        },
      });

      // If no custom types exist, return default types as virtual records
      if (customTypes.length === 0) {
        return DEFAULT_CASE_TYPES.map((dt) => ({
          id: `default-${dt.code}`,
          firmId: user.firmId,
          name: dt.name,
          code: dt.code,
          isActive: true,
          sortOrder: dt.sortOrder,
          createdAt: new Date(),
          creator: null, // System default
        }));
      }

      return customTypes;
    },

    /**
     * Get a single case type by ID
     */
    caseType: async (_parent: unknown, args: { id: string }, context: Context) => {
      const user = requireAuth(context);

      // Check if it's a default type
      if (args.id.startsWith('default-')) {
        const code = args.id.replace('default-', '');
        const defaultType = DEFAULT_CASE_TYPES.find((dt) => dt.code === code);
        if (defaultType) {
          return {
            id: args.id,
            firmId: user.firmId,
            name: defaultType.name,
            code: defaultType.code,
            isActive: true,
            sortOrder: defaultType.sortOrder,
            createdAt: new Date(),
            creator: null,
          };
        }
        return null;
      }

      const caseType = await prisma.caseTypeConfig.findFirst({
        where: {
          id: args.id,
          firmId: user.firmId,
        },
        include: {
          creator: true,
        },
      });

      return caseType;
    },
  },

  Mutation: {
    /**
     * Create a new custom case type for the firm
     * Only Partners can create case types
     */
    createCaseType: async (
      _parent: unknown,
      args: { input: CreateCaseTypeInput },
      context: Context
    ) => {
      const user = requireFullAccess(context);
      const { name, code, sortOrder } = args.input;

      // Validate name
      if (name.length < 2 || name.length > 100) {
        throw new GraphQLError('Numele tipului trebuie să aibă între 2 și 100 de caractere', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Validate code (alphanumeric with underscores only)
      const codeRegex = /^[A-Z0-9_]+$/;
      const normalizedCode = code.toUpperCase().replace(/\s+/g, '_');
      if (
        !codeRegex.test(normalizedCode) ||
        normalizedCode.length < 2 ||
        normalizedCode.length > 50
      ) {
        throw new GraphQLError(
          'Codul trebuie să conțină doar litere, cifre și underscore (2-50 caractere)',
          {
            extensions: { code: 'BAD_USER_INPUT' },
          }
        );
      }

      // Check if code already exists for this firm
      const existingType = await prisma.caseTypeConfig.findFirst({
        where: {
          firmId: user.firmId,
          code: normalizedCode,
        },
      });

      if (existingType) {
        throw new GraphQLError('Un tip de dosar cu acest cod există deja', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // If this is the first custom type, also create the defaults
      const existingTypes = await prisma.caseTypeConfig.count({
        where: { firmId: user.firmId },
      });

      if (existingTypes === 0) {
        // Create default types first
        await prisma.caseTypeConfig.createMany({
          data: DEFAULT_CASE_TYPES.map((dt) => ({
            firmId: user.firmId,
            name: dt.name,
            code: dt.code,
            sortOrder: dt.sortOrder,
            createdBy: user.id,
          })),
        });
      }

      // Create the new case type
      const caseType = await prisma.caseTypeConfig.create({
        data: {
          firmId: user.firmId,
          name,
          code: normalizedCode,
          sortOrder: sortOrder ?? 50,
          createdBy: user.id,
        },
        include: {
          creator: true,
        },
      });

      return caseType;
    },

    /**
     * Update an existing case type
     * Only Partners can update case types
     */
    updateCaseType: async (
      _parent: unknown,
      args: { id: string; input: UpdateCaseTypeInput },
      context: Context
    ) => {
      const user = requireFullAccess(context);

      // Cannot update default types
      if (args.id.startsWith('default-')) {
        throw new GraphQLError('Nu puteți modifica tipurile de dosar implicite', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Find the case type
      const existingType = await prisma.caseTypeConfig.findFirst({
        where: {
          id: args.id,
          firmId: user.firmId,
        },
      });

      if (!existingType) {
        throw new GraphQLError('Tipul de dosar nu a fost găsit', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Validate name if provided
      if (args.input.name !== undefined) {
        if (args.input.name.length < 2 || args.input.name.length > 100) {
          throw new GraphQLError('Numele tipului trebuie să aibă între 2 și 100 de caractere', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
      }

      // Update the case type
      const caseType = await prisma.caseTypeConfig.update({
        where: { id: args.id },
        data: {
          ...(args.input.name !== undefined && { name: args.input.name }),
          ...(args.input.sortOrder !== undefined && { sortOrder: args.input.sortOrder }),
          ...(args.input.isActive !== undefined && { isActive: args.input.isActive }),
        },
        include: {
          creator: true,
        },
      });

      return caseType;
    },

    /**
     * Deactivate a case type (soft delete)
     * Only Partners can deactivate case types
     */
    deactivateCaseType: async (_parent: unknown, args: { id: string }, context: Context) => {
      const user = requireFullAccess(context);

      // Cannot deactivate default types
      if (args.id.startsWith('default-')) {
        throw new GraphQLError('Nu puteți dezactiva tipurile de dosar implicite', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Find the case type
      const existingType = await prisma.caseTypeConfig.findFirst({
        where: {
          id: args.id,
          firmId: user.firmId,
        },
      });

      if (!existingType) {
        throw new GraphQLError('Tipul de dosar nu a fost găsit', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Deactivate the case type
      const caseType = await prisma.caseTypeConfig.update({
        where: { id: args.id },
        data: { isActive: false },
        include: {
          creator: true,
        },
      });

      return caseType;
    },
  },

  // Field resolvers
  CaseTypeConfig: {
    creator: async (parent: { createdBy: string }) => {
      if (!parent.createdBy) return null;
      return prisma.user.findUnique({
        where: { id: parent.createdBy },
      });
    },
  },
};
