/**
 * Actor Type Management GraphQL Resolvers
 * OPS-221: Dynamic actor types per firm - allows Partners to create custom actor types
 *
 * Merges built-in CaseActorRole enum values with custom ActorTypeConfig records
 */

import { prisma } from '@legal-platform/database';
import { GraphQLError } from 'graphql';
import { requireAuth, type Context } from '../utils/auth';

// ============================================================================
// Types
// ============================================================================

interface CreateActorTypeInput {
  name: string;
  code: string;
  sortOrder?: number;
}

interface UpdateActorTypeInput {
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
}

interface ActorType {
  id: string;
  code: string;
  name: string;
  isBuiltIn: boolean;
  isActive: boolean;
  sortOrder: number;
}

// ============================================================================
// Built-in Actor Types (from CaseActorRole enum)
// ============================================================================

const BUILTIN_ACTOR_TYPES: Array<{ code: string; name: string; sortOrder: number }> = [
  { code: 'Client', name: 'Client', sortOrder: 1 },
  { code: 'Mandatar', name: 'Mandatar', sortOrder: 5 },
  { code: 'LegalRepresentative', name: 'Reprezentant Legal', sortOrder: 6 },
  { code: 'OpposingParty', name: 'Parte Adversă', sortOrder: 10 },
  { code: 'OpposingCounsel', name: 'Avocat Adversar', sortOrder: 11 },
  { code: 'Witness', name: 'Martor', sortOrder: 20 },
  { code: 'Expert', name: 'Expert', sortOrder: 21 },
  { code: 'Court', name: 'Instanță', sortOrder: 22 },
  { code: 'Prosecutor', name: 'Procuror', sortOrder: 23 },
  { code: 'Bailiff', name: 'Executor Judecătoresc', sortOrder: 24 },
  { code: 'Notary', name: 'Notar', sortOrder: 25 },
  { code: 'Intervenient', name: 'Intervenient', sortOrder: 30 },
  { code: 'Other', name: 'Altele', sortOrder: 100 },
];

// ============================================================================
// Helper Functions
// ============================================================================

function requireFullAccess(context: Context) {
  const user = requireAuth(context);
  if (user.role !== 'Partner' && user.role !== 'BusinessOwner' && !user.hasOperationalOversight) {
    throw new GraphQLError('Doar partenerii pot gestiona tipurile de actori', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
  return user;
}

// ============================================================================
// Resolvers
// ============================================================================

export const actorTypeResolvers = {
  Query: {
    /**
     * Get all actor types for the current user's firm
     * Returns built-in roles merged with custom firm-specific types
     */
    actorTypes: async (
      _parent: unknown,
      args: { includeInactive?: boolean },
      context: Context
    ): Promise<ActorType[]> => {
      const user = requireAuth(context);

      // Get custom actor types for the firm
      const customTypes = await prisma.actorTypeConfig.findMany({
        where: {
          firmId: user.firmId,
          ...(args.includeInactive ? {} : { isActive: true }),
        },
        orderBy: { sortOrder: 'asc' },
      });

      // Convert built-in types to ActorType format
      const builtInActorTypes: ActorType[] = BUILTIN_ACTOR_TYPES.map((bt) => ({
        id: `builtin-${bt.code}`,
        code: bt.code,
        name: bt.name,
        isBuiltIn: true,
        isActive: true,
        sortOrder: bt.sortOrder,
      }));

      // Convert custom types to ActorType format
      const customActorTypes: ActorType[] = customTypes.map((ct) => ({
        id: ct.id,
        code: ct.code,
        name: ct.name,
        isBuiltIn: false,
        isActive: ct.isActive,
        sortOrder: ct.sortOrder,
      }));

      // Merge and sort by sortOrder
      const allTypes = [...builtInActorTypes, ...customActorTypes];
      allTypes.sort((a, b) => a.sortOrder - b.sortOrder);

      return allTypes;
    },

    /**
     * Get a single custom actor type by ID
     * Only returns custom types (not built-in)
     */
    actorType: async (_parent: unknown, args: { id: string }, context: Context) => {
      const user = requireAuth(context);

      // Built-in types cannot be fetched as ActorTypeConfig
      if (args.id.startsWith('builtin-')) {
        return null;
      }

      const actorType = await prisma.actorTypeConfig.findFirst({
        where: {
          id: args.id,
          firmId: user.firmId,
        },
        include: {
          creator: true,
        },
      });

      return actorType;
    },
  },

  Mutation: {
    /**
     * Create a new custom actor type for the firm
     * Only Partners can create actor types
     */
    createActorType: async (
      _parent: unknown,
      args: { input: CreateActorTypeInput },
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

      // Check if code conflicts with built-in types
      const builtInCodes = BUILTIN_ACTOR_TYPES.map((bt) => bt.code.toUpperCase());
      if (builtInCodes.includes(normalizedCode)) {
        throw new GraphQLError('Nu puteți folosi un cod rezervat pentru tipurile predefinite', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Check if code already exists for this firm
      const existingType = await prisma.actorTypeConfig.findFirst({
        where: {
          firmId: user.firmId,
          code: normalizedCode,
        },
      });

      if (existingType) {
        throw new GraphQLError('Un tip de actor cu acest cod există deja', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Create the new actor type
      const actorType = await prisma.actorTypeConfig.create({
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

      return actorType;
    },

    /**
     * Update an existing custom actor type
     * Only Partners can update actor types
     */
    updateActorType: async (
      _parent: unknown,
      args: { id: string; input: UpdateActorTypeInput },
      context: Context
    ) => {
      const user = requireFullAccess(context);

      // Cannot update built-in types
      if (args.id.startsWith('builtin-')) {
        throw new GraphQLError('Nu puteți modifica tipurile de actor predefinite', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Find the actor type
      const existingType = await prisma.actorTypeConfig.findFirst({
        where: {
          id: args.id,
          firmId: user.firmId,
        },
      });

      if (!existingType) {
        throw new GraphQLError('Tipul de actor nu a fost găsit', {
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

      // Update the actor type
      const actorType = await prisma.actorTypeConfig.update({
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

      return actorType;
    },

    /**
     * Deactivate an actor type (soft delete)
     * Only Partners can deactivate actor types
     */
    deactivateActorType: async (_parent: unknown, args: { id: string }, context: Context) => {
      const user = requireFullAccess(context);

      // Cannot deactivate built-in types
      if (args.id.startsWith('builtin-')) {
        throw new GraphQLError('Nu puteți dezactiva tipurile de actor predefinite', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Find the actor type
      const existingType = await prisma.actorTypeConfig.findFirst({
        where: {
          id: args.id,
          firmId: user.firmId,
        },
      });

      if (!existingType) {
        throw new GraphQLError('Tipul de actor nu a fost găsit', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Deactivate the actor type
      const actorType = await prisma.actorTypeConfig.update({
        where: { id: args.id },
        data: { isActive: false },
        include: {
          creator: true,
        },
      });

      return actorType;
    },
  },

  // Field resolvers
  ActorTypeConfig: {
    creator: async (parent: { createdBy: string }) => {
      if (!parent.createdBy) return null;
      return prisma.user.findUnique({
        where: { id: parent.createdBy },
      });
    },
  },
};
