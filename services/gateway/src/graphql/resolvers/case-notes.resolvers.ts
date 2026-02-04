/**
 * Case Notes GraphQL Resolvers
 * Mobile feature: Sticky notes attached to cases
 */

import { prisma } from '@legal-platform/database';
import { GraphQLError } from 'graphql';
import { requireAuth, type Context } from '../utils/auth';

// Helper function to check if user can access case
async function canAccessCase(caseId: string, user: Context['user']): Promise<boolean> {
  if (!user) return false;

  // Verify the case belongs to the user's firm (multi-tenancy isolation)
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: { firmId: true },
  });

  if (!caseData || caseData.firmId !== user.firmId) return false;

  // Partners and BusinessOwners can access all cases in their firm
  if (user.role === 'Partner' || user.role === 'BusinessOwner') return true;

  // Non-partners must be assigned to the case
  const assignment = await prisma.caseTeam.findUnique({
    where: {
      caseId_userId: {
        caseId,
        userId: user.id,
      },
    },
  });

  return !!assignment;
}

// Valid note colors
const VALID_COLORS = ['yellow', 'blue', 'green', 'pink'];

export const caseNotesResolvers = {
  Query: {
    /**
     * Get all notes for a case
     */
    caseNotes: async (_: unknown, { caseId }: { caseId: string }, context: Context) => {
      const user = requireAuth(context);

      // Check access to case
      const hasAccess = await canAccessCase(caseId, user);
      if (!hasAccess) {
        throw new GraphQLError('Access denied to this case', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return prisma.caseNote.findMany({
        where: {
          caseId,
          firmId: user.firmId,
        },
        orderBy: { createdAt: 'desc' },
      });
    },
  },

  Mutation: {
    /**
     * Create a new note on a case
     */
    createCaseNote: async (
      _: unknown,
      { input }: { input: { caseId: string; content: string; color?: string } },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Validate content
      if (!input.content || input.content.trim().length === 0) {
        throw new GraphQLError('Note content cannot be empty', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Validate color
      const color = input.color || 'yellow';
      if (!VALID_COLORS.includes(color)) {
        throw new GraphQLError(`Invalid color. Must be one of: ${VALID_COLORS.join(', ')}`, {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Check access to case
      const hasAccess = await canAccessCase(input.caseId, user);
      if (!hasAccess) {
        throw new GraphQLError('Access denied to this case', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return prisma.caseNote.create({
        data: {
          caseId: input.caseId,
          firmId: user.firmId,
          authorId: user.id,
          content: input.content.trim(),
          color,
        },
      });
    },

    /**
     * Update an existing note
     */
    updateCaseNote: async (
      _: unknown,
      { id, input }: { id: string; input: { content?: string; color?: string } },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Get existing note
      const note = await prisma.caseNote.findUnique({
        where: { id },
      });

      if (!note) {
        throw new GraphQLError('Note not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Check firm isolation
      if (note.firmId !== user.firmId) {
        throw new GraphQLError('Access denied', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Only author can update their note (or Partners/BusinessOwners/Operational Oversight)
      if (
        note.authorId !== user.id &&
        user.role !== 'Partner' &&
        user.role !== 'BusinessOwner' &&
        !user.hasOperationalOversight
      ) {
        throw new GraphQLError('You can only update your own notes', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Validate color if provided
      if (input.color && !VALID_COLORS.includes(input.color)) {
        throw new GraphQLError(`Invalid color. Must be one of: ${VALID_COLORS.join(', ')}`, {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Validate content if provided
      if (input.content !== undefined && input.content.trim().length === 0) {
        throw new GraphQLError('Note content cannot be empty', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      return prisma.caseNote.update({
        where: { id },
        data: {
          ...(input.content !== undefined && { content: input.content.trim() }),
          ...(input.color && { color: input.color }),
        },
      });
    },

    /**
     * Delete a note
     */
    deleteCaseNote: async (_: unknown, { id }: { id: string }, context: Context) => {
      const user = requireAuth(context);

      // Get existing note
      const note = await prisma.caseNote.findUnique({
        where: { id },
      });

      if (!note) {
        throw new GraphQLError('Note not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Check firm isolation
      if (note.firmId !== user.firmId) {
        throw new GraphQLError('Access denied', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Only author can delete their note (or Partners/BusinessOwners/Operational Oversight)
      if (
        note.authorId !== user.id &&
        user.role !== 'Partner' &&
        user.role !== 'BusinessOwner' &&
        !user.hasOperationalOversight
      ) {
        throw new GraphQLError('You can only delete your own notes', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      await prisma.caseNote.delete({
        where: { id },
      });

      return true;
    },
  },

  // Field resolvers
  CaseNote: {
    case: async (parent: { caseId: string }) => {
      return prisma.case.findUnique({
        where: { id: parent.caseId },
      });
    },
    author: async (parent: { authorId: string }) => {
      return prisma.user.findUnique({
        where: { id: parent.authorId },
      });
    },
  },
};
