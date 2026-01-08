/**
 * Personal Contact Resolvers
 * OPS-190: Personal Contacts Service + GraphQL
 *
 * GraphQL resolvers for managing personal contact blocklist.
 */

import { GraphQLError } from 'graphql';
import { personalContactService } from '../../services/personal-contact.service';

// ============================================================================
// Types
// ============================================================================

interface Context {
  user?: {
    id: string;
    role: string;
    firmId: string;
  };
}

// ============================================================================
// Helpers
// ============================================================================

function requireAuth(context: Context): { id: string; role: string; firmId: string } {
  if (!context.user) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return context.user;
}

// ============================================================================
// Resolvers
// ============================================================================

export const personalContactResolvers = {
  Query: {
    /**
     * Get all personal contacts for the current user
     */
    personalContacts: async (_: unknown, __: unknown, context: Context) => {
      const user = requireAuth(context);
      return personalContactService.getPersonalContacts(user.id);
    },

    /**
     * Get count of personal contacts
     */
    personalContactsCount: async (_: unknown, __: unknown, context: Context) => {
      const user = requireAuth(context);
      return personalContactService.getPersonalContactsCount(user.id);
    },

    /**
     * Check if a specific email is in personal contacts
     */
    isPersonalContact: async (_: unknown, args: { email: string }, context: Context) => {
      const user = requireAuth(context);
      return personalContactService.isPersonalContact(user.id, args.email);
    },

    /**
     * Check if a specific email thread is marked as personal/private
     */
    isThreadPersonal: async (_: unknown, args: { conversationId: string }, context: Context) => {
      const user = requireAuth(context);
      return personalContactService.isThreadPersonal(user.firmId, args.conversationId);
    },
  },

  Mutation: {
    /**
     * Add an email to personal contacts blocklist
     */
    addPersonalContact: async (_: unknown, args: { email: string }, context: Context) => {
      const user = requireAuth(context);

      // Basic email validation
      if (!args.email || !args.email.includes('@')) {
        throw new GraphQLError('Adresa de email este invalidă', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      return personalContactService.addPersonalContact(user.id, args.email);
    },

    /**
     * Remove an email from personal contacts blocklist
     */
    removePersonalContact: async (_: unknown, args: { email: string }, context: Context) => {
      const user = requireAuth(context);
      return personalContactService.removePersonalContact(user.id, args.email);
    },

    /**
     * Mark the sender of an email as personal contact
     */
    markSenderAsPersonal: async (
      _: unknown,
      args: { emailId: string; ignoreEmail?: boolean },
      context: Context
    ) => {
      const user = requireAuth(context);
      const ignoreEmail = args.ignoreEmail !== false; // Default to true

      try {
        return await personalContactService.markSenderAsPersonal(
          user.id,
          args.emailId,
          ignoreEmail
        );
      } catch (error) {
        if (error instanceof Error && error.message === 'Email not found') {
          throw new GraphQLError('Email-ul nu a fost găsit', {
            extensions: { code: 'NOT_FOUND' },
          });
        }
        if (error instanceof Error && error.message === 'Email sender address not found') {
          throw new GraphQLError('Adresa expeditorului nu a fost găsită', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
        throw error;
      }
    },

    /**
     * Mark an email thread as personal/private
     */
    markThreadAsPersonal: async (
      _: unknown,
      args: { conversationId: string },
      context: Context
    ) => {
      const user = requireAuth(context);
      return personalContactService.markThreadAsPersonal(user.id, user.firmId, args.conversationId);
    },

    /**
     * Unmark an email thread as personal/private
     */
    unmarkThreadAsPersonal: async (
      _: unknown,
      args: { conversationId: string },
      context: Context
    ) => {
      const user = requireAuth(context);
      return personalContactService.unmarkThreadAsPersonal(
        user.id,
        user.firmId,
        args.conversationId
      );
    },
  },
};
