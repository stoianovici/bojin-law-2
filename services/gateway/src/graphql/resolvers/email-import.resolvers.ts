/**
 * Email Import Resolvers
 * OPS-022: Email-to-Case Timeline Integration
 *
 * GraphQL resolvers for email import preview and execution
 */

import { GraphQLError } from 'graphql';
import { emailToCaseService } from '../../services/email-to-case.service';
import type { CaseActorRole } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

interface Context {
  user?: {
    id: string;
    role: string;
    firmId: string;
    email: string;
    accessToken?: string;
  };
}

interface ContactRoleAssignmentInput {
  email: string;
  name: string | null;
  role: CaseActorRole;
}

interface ExecuteEmailImportInput {
  caseId: string;
  emailAddresses: string[];
  contactAssignments: ContactRoleAssignmentInput[];
  importAttachments: boolean;
}

// ============================================================================
// Resolvers
// ============================================================================

export const emailImportResolvers = {
  Query: {
    /**
     * Preview what will be imported for given email addresses
     */
    previewEmailImport: async (
      _: unknown,
      args: { emailAddresses: string[] },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      if (!args.emailAddresses || args.emailAddresses.length === 0) {
        throw new GraphQLError('At least one email address is required', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Validate email addresses
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const email of args.emailAddresses) {
        if (!emailRegex.test(email)) {
          throw new GraphQLError(`Invalid email address: ${email}`, {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
      }

      const preview = await emailToCaseService.previewEmailImport(args.emailAddresses, {
        userId: user.id,
        firmId: user.firmId,
        accessToken: user.accessToken,
      });

      return preview;
    },
  },

  Mutation: {
    /**
     * Execute the email import
     */
    executeEmailImport: async (
      _: unknown,
      args: { input: ExecuteEmailImportInput },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const { caseId, emailAddresses, contactAssignments, importAttachments } = args.input;

      // Validate inputs
      if (!caseId) {
        throw new GraphQLError('Case ID is required', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      if (!emailAddresses || emailAddresses.length === 0) {
        throw new GraphQLError('At least one email address is required', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Validate email addresses
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const email of emailAddresses) {
        if (!emailRegex.test(email)) {
          throw new GraphQLError(`Invalid email address: ${email}`, {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
      }

      // Warn if importing attachments without access token
      if (importAttachments && !user.accessToken) {
        console.warn('[executeEmailImport] Attachments requested but no access token available');
      }

      const result = await emailToCaseService.executeEmailImport(
        {
          caseId,
          emailAddresses,
          contactAssignments: contactAssignments.map((ca) => ({
            email: ca.email,
            name: ca.name,
            role: ca.role,
          })),
          importAttachments,
        },
        {
          userId: user.id,
          firmId: user.firmId,
          accessToken: user.accessToken,
        }
      );

      return result;
    },
  },

  // Type resolvers
  EmailImportPreview: {
    dateRange: (parent: { dateRange: { start: Date | null; end: Date | null } }) => {
      return parent.dateRange;
    },
  },

  DateRange: {
    start: (parent: { start: Date | null }) => parent.start,
    end: (parent: { end: Date | null }) => parent.end,
  },

  ContactCandidate: {
    suggestedRole: (parent: { suggestedRole: CaseActorRole | null }) => {
      return parent.suggestedRole;
    },
  },
};
