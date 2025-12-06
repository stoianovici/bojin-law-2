/**
 * Email Drafting Resolvers
 * Story 5.3: AI-Powered Email Drafting
 *
 * GraphQL resolvers for AI-powered email draft generation, refinement,
 * attachment suggestions, and inline assistance.
 */

import { GraphQLError } from 'graphql';
import { prisma } from '@legal-platform/database';
import { attachmentSuggestionService } from '../../services/attachment-suggestion.service';
import DataLoader from 'dataloader';

// ============================================================================
// Types
// ============================================================================

interface Context {
  user: {
    id: string;
    role: string;
    firmId: string;
    accessToken?: string;
  };
  loaders?: EmailDraftingLoaders;
}

interface EmailDraftingLoaders {
  email: DataLoader<string, any>;
  draftsByEmail: DataLoader<string, any[]>;
  attachmentSuggestions: DataLoader<string, any[]>;
}

// AI Service URL (for proxying requests)
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3002';

// ============================================================================
// DataLoaders
// ============================================================================

export function createEmailDraftingLoaders(): EmailDraftingLoaders {
  return {
    email: new DataLoader(async (emailIds: readonly string[]) => {
      const emails = await prisma.email.findMany({
        where: { id: { in: [...emailIds] } },
      });
      const emailMap = new Map(emails.map((e) => [e.id, e]));
      return emailIds.map((id) => emailMap.get(id) || null);
    }),

    draftsByEmail: new DataLoader(async (emailIds: readonly string[]) => {
      const drafts = await prisma.emailDraft.findMany({
        where: { emailId: { in: [...emailIds] } },
      });
      const draftMap = new Map<string, any[]>();
      emailIds.forEach((id) => draftMap.set(id, []));
      drafts.forEach((d) => draftMap.get(d.emailId)?.push(d));
      return emailIds.map((id) => draftMap.get(id) || []);
    }),

    attachmentSuggestions: new DataLoader(async (draftIds: readonly string[]) => {
      const suggestions = await prisma.attachmentSuggestion.findMany({
        where: { draftId: { in: [...draftIds] } },
      });
      const suggestionMap = new Map<string, any[]>();
      draftIds.forEach((id) => suggestionMap.set(id, []));
      suggestions.forEach((s) => suggestionMap.get(s.draftId)?.push(s));
      return draftIds.map((id) => suggestionMap.get(id) || []);
    }),
  };
}

// ============================================================================
// Resolvers
// ============================================================================

export const emailDraftingResolvers = {
  Query: {
    /**
     * Get a single email draft by ID
     */
    emailDraft: async (_: any, args: { id: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const draft = await prisma.emailDraft.findFirst({
        where: {
          id: args.id,
          firmId: user.firmId,
        },
        include: {
          email: true,
          case: true,
          user: true,
          refinements: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!draft) {
        throw new GraphQLError('Draft not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      return draft;
    },

    /**
     * Get email drafts with optional filters
     */
    emailDrafts: async (
      _: any,
      args: { emailId?: string; caseId?: string; status?: string },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const where: any = {
        firmId: user.firmId,
      };

      if (args.emailId) where.emailId = args.emailId;
      if (args.caseId) where.caseId = args.caseId;
      if (args.status) where.status = args.status;

      return await prisma.emailDraft.findMany({
        where,
        include: {
          email: true,
          case: true,
          refinements: {
            orderBy: { createdAt: 'desc' },
            take: 3,
          },
        },
        orderBy: { updatedAt: 'desc' },
      });
    },

    /**
     * Get attachment suggestions for a draft
     */
    attachmentSuggestions: async (
      _: any,
      args: { draftId: string },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify draft exists and belongs to user's firm
      const draft = await prisma.emailDraft.findFirst({
        where: {
          id: args.draftId,
          firmId: user.firmId,
        },
      });

      if (!draft) {
        throw new GraphQLError('Draft not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      return await prisma.attachmentSuggestion.findMany({
        where: { draftId: args.draftId },
        include: { document: true },
        orderBy: { relevanceScore: 'desc' },
      });
    },
  },

  Mutation: {
    /**
     * Generate a single email draft with specified tone
     */
    generateEmailDraft: async (
      _: any,
      args: { input: { emailId: string; tone?: string; recipientType?: string } },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Get the original email
      const email = await prisma.email.findFirst({
        where: {
          id: args.input.emailId,
          userId: user.id,
        },
        include: {
          case: {
            include: {
              client: true,
            },
          },
        },
      });

      if (!email) {
        throw new GraphQLError('Email not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Call AI service to generate draft
      const response = await fetch(`${AI_SERVICE_URL}/api/email-drafting/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalEmail: {
            id: email.id,
            graphMessageId: email.graphMessageId,
            subject: email.subject,
            bodyContent: email.bodyContent,
            bodyContentType: email.bodyContentType,
            from: email.from,
            toRecipients: email.toRecipients,
            ccRecipients: email.ccRecipients,
            receivedDateTime: email.receivedDateTime,
            sentDateTime: email.sentDateTime,
            hasAttachments: email.hasAttachments,
          },
          caseId: email.caseId,
          tone: args.input.tone || 'Professional',
          recipientType: args.input.recipientType || 'Client',
          firmId: user.firmId,
          userId: user.id,
        }),
      });

      if (!response.ok) {
        throw new GraphQLError('Failed to generate draft', {
          extensions: { code: 'AI_SERVICE_ERROR' },
        });
      }

      const result = await response.json();

      // Create draft in database
      const draft = await prisma.emailDraft.create({
        data: {
          emailId: email.id,
          caseId: email.caseId,
          firmId: user.firmId,
          userId: user.id,
          tone: args.input.tone || 'Professional',
          recipientType: args.input.recipientType || 'Client',
          subject: result.subject,
          body: result.body,
          htmlBody: result.htmlBody,
          confidence: result.confidence,
          suggestedAttachments: result.suggestedAttachments || [],
          status: 'Generated',
        },
        include: {
          email: true,
          case: true,
          refinements: true,
        },
      });

      // Generate attachment suggestions asynchronously
      if (email.caseId) {
        attachmentSuggestionService
          .suggestAttachments(
            { id: email.id, subject: email.subject, bodyContent: email.bodyContent },
            email.caseId,
            result.body,
            user.firmId,
            user.id
          )
          .then(async (suggestions) => {
            // Store suggestions in database
            await prisma.attachmentSuggestion.createMany({
              data: suggestions.map((s) => ({
                draftId: draft.id,
                documentId: s.documentId,
                title: s.title,
                reason: s.reason,
                relevanceScore: s.relevanceScore,
                isSelected: false,
              })),
            });
          })
          .catch((err) => {
            console.error('Failed to generate attachment suggestions:', err);
          });
      }

      return draft;
    },

    /**
     * Generate multiple drafts with different tones
     */
    generateMultipleDrafts: async (
      _: any,
      args: { emailId: string },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Get the original email
      const email = await prisma.email.findFirst({
        where: {
          id: args.emailId,
          userId: user.id,
        },
        include: {
          case: {
            include: {
              client: true,
            },
          },
        },
      });

      if (!email) {
        throw new GraphQLError('Email not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Call AI service to generate multiple drafts
      const response = await fetch(`${AI_SERVICE_URL}/api/email-drafting/generate-multiple`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalEmail: {
            id: email.id,
            graphMessageId: email.graphMessageId,
            subject: email.subject,
            bodyContent: email.bodyContent,
            bodyContentType: email.bodyContentType,
            from: email.from,
            toRecipients: email.toRecipients,
            ccRecipients: email.ccRecipients,
            receivedDateTime: email.receivedDateTime,
            sentDateTime: email.sentDateTime,
            hasAttachments: email.hasAttachments,
          },
          caseId: email.caseId,
          recipientType: 'Client', // Will detect automatically
          firmId: user.firmId,
          userId: user.id,
        }),
      });

      if (!response.ok) {
        throw new GraphQLError('Failed to generate drafts', {
          extensions: { code: 'AI_SERVICE_ERROR' },
        });
      }

      const result = await response.json();

      // Create drafts in database
      const drafts = await Promise.all(
        result.drafts.map(async (draftResult: any) => {
          return await prisma.emailDraft.create({
            data: {
              emailId: email.id,
              caseId: email.caseId,
              firmId: user.firmId,
              userId: user.id,
              tone: draftResult.tone,
              recipientType: 'Client',
              subject: draftResult.draft.subject,
              body: draftResult.draft.body,
              htmlBody: draftResult.draft.htmlBody,
              confidence: draftResult.draft.confidence,
              suggestedAttachments: draftResult.draft.suggestedAttachments || [],
              status: 'Generated',
            },
            include: {
              email: true,
              case: true,
              refinements: true,
            },
          });
        })
      );

      return {
        drafts: drafts.map((draft, index) => ({
          tone: result.drafts[index].tone,
          draft,
        })),
        recommendedTone: result.recommendedTone,
        recommendationReason: result.recommendationReason,
      };
    },

    /**
     * Refine an existing draft with AI
     */
    refineDraft: async (
      _: any,
      args: { input: { draftId: string; instruction: string } },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Get the draft
      const draft = await prisma.emailDraft.findFirst({
        where: {
          id: args.input.draftId,
          firmId: user.firmId,
        },
      });

      if (!draft) {
        throw new GraphQLError('Draft not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Call AI service to refine draft
      const response = await fetch(`${AI_SERVICE_URL}/api/email-drafting/refine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          draftId: draft.id,
          currentBody: draft.body,
          instruction: args.input.instruction,
          caseId: draft.caseId,
          firmId: user.firmId,
          userId: user.id,
        }),
      });

      if (!response.ok) {
        throw new GraphQLError('Failed to refine draft', {
          extensions: { code: 'AI_SERVICE_ERROR' },
        });
      }

      const result = await response.json();

      // Create refinement record
      await prisma.draftRefinement.create({
        data: {
          draftId: draft.id,
          instruction: args.input.instruction,
          previousBody: draft.body,
          refinedBody: result.refinedBody,
          tokensUsed: result.tokensUsed || 0,
        },
      });

      // Update draft with refined content
      return await prisma.emailDraft.update({
        where: { id: draft.id },
        data: {
          body: result.refinedBody,
          htmlBody: result.refinedHtmlBody,
          status: 'Editing',
        },
        include: {
          email: true,
          case: true,
          refinements: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    },

    /**
     * Update draft content manually
     */
    updateDraft: async (
      _: any,
      args: {
        input: {
          draftId: string;
          subject?: string;
          body?: string;
          status?: string;
          selectedAttachmentIds?: string[];
        };
      },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify draft exists and belongs to user's firm
      const draft = await prisma.emailDraft.findFirst({
        where: {
          id: args.input.draftId,
          firmId: user.firmId,
        },
      });

      if (!draft) {
        throw new GraphQLError('Draft not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const updateData: any = {};

      if (args.input.subject !== undefined) updateData.subject = args.input.subject;
      if (args.input.body !== undefined) {
        updateData.body = args.input.body;
        updateData.htmlBody = args.input.body
          .split('\n\n')
          .map((para: string) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
          .join('');
        updateData.userEdits = {
          lastEditedAt: new Date().toISOString(),
          editedBy: user.id,
        };
      }
      if (args.input.status !== undefined) updateData.status = args.input.status;

      // Update draft
      const updatedDraft = await prisma.emailDraft.update({
        where: { id: draft.id },
        data: updateData,
        include: {
          email: true,
          case: true,
          refinements: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      // Update attachment selections if provided
      if (args.input.selectedAttachmentIds) {
        await prisma.attachmentSuggestion.updateMany({
          where: { draftId: draft.id },
          data: { isSelected: false },
        });

        if (args.input.selectedAttachmentIds.length > 0) {
          await prisma.attachmentSuggestion.updateMany({
            where: {
              draftId: draft.id,
              id: { in: args.input.selectedAttachmentIds },
            },
            data: { isSelected: true },
          });
        }
      }

      return updatedDraft;
    },

    /**
     * Send the draft email via Graph API
     */
    sendDraft: async (_: any, args: { draftId: string }, context: Context) => {
      const { user } = context;

      if (!user || !user.accessToken) {
        throw new GraphQLError('Authentication required with valid access token', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Get the draft with attachments
      const draft = await prisma.emailDraft.findFirst({
        where: {
          id: args.draftId,
          firmId: user.firmId,
        },
        include: {
          email: true,
        },
      });

      if (!draft) {
        throw new GraphQLError('Draft not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Get selected attachments
      const selectedAttachments = await prisma.attachmentSuggestion.findMany({
        where: {
          draftId: args.draftId,
          isSelected: true,
        },
        include: { document: true },
      });

      // Build Graph API request
      const email = draft.email as any;
      const replyToAddress = email.from?.address;

      if (!replyToAddress) {
        throw new GraphQLError('Cannot determine recipient address', {
          extensions: { code: 'INVALID_DATA' },
        });
      }

      // Send via Graph API
      const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject: draft.subject,
            body: {
              contentType: draft.htmlBody ? 'HTML' : 'Text',
              content: draft.htmlBody || draft.body,
            },
            toRecipients: [
              {
                emailAddress: { address: replyToAddress },
              },
            ],
            // Include any attachments would go here
          },
          saveToSentItems: true,
        }),
      });

      if (!graphResponse.ok) {
        const error = await graphResponse.text();
        console.error('Graph API error:', error);
        throw new GraphQLError('Failed to send email', {
          extensions: { code: 'GRAPH_API_ERROR' },
        });
      }

      // Update draft status
      await prisma.emailDraft.update({
        where: { id: draft.id },
        data: {
          status: 'Sent',
          sentAt: new Date(),
        },
      });

      return true;
    },

    /**
     * Discard a draft
     */
    discardDraft: async (_: any, args: { draftId: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify draft exists and belongs to user's firm
      const draft = await prisma.emailDraft.findFirst({
        where: {
          id: args.draftId,
          firmId: user.firmId,
        },
      });

      if (!draft) {
        throw new GraphQLError('Draft not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      await prisma.emailDraft.update({
        where: { id: draft.id },
        data: { status: 'Discarded' },
      });

      return true;
    },

    /**
     * Toggle attachment selection
     */
    selectAttachment: async (
      _: any,
      args: { suggestionId: string; selected: boolean },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify suggestion exists and belongs to user's firm draft
      const suggestion = await prisma.attachmentSuggestion.findFirst({
        where: { id: args.suggestionId },
        include: {
          draft: true,
        },
      });

      if (!suggestion || suggestion.draft.firmId !== user.firmId) {
        throw new GraphQLError('Attachment suggestion not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      return await prisma.attachmentSuggestion.update({
        where: { id: args.suggestionId },
        data: { isSelected: args.selected },
        include: { document: true },
      });
    },

    /**
     * Get inline AI suggestion while editing
     */
    getInlineSuggestion: async (
      _: any,
      args: { input: { draftId: string; partialText: string } },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Get the draft with email context
      const draft = await prisma.emailDraft.findFirst({
        where: {
          id: args.input.draftId,
          firmId: user.firmId,
        },
        include: {
          email: true,
          case: true,
        },
      });

      if (!draft) {
        throw new GraphQLError('Draft not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const email = draft.email as any;

      // Call AI service for inline suggestion
      const response = await fetch(`${AI_SERVICE_URL}/api/email-drafting/inline-suggestion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partialText: args.input.partialText,
          context: {
            originalEmailSubject: email.subject,
            originalEmailBody: email.bodyContent,
            recipientType: draft.recipientType,
            tone: draft.tone,
            caseTitle: draft.case?.title,
          },
          firmId: user.firmId,
          userId: user.id,
        }),
      });

      if (!response.ok) {
        // Return null on failure (non-critical operation)
        return null;
      }

      const result = await response.json();

      if (!result || !result.suggestion) {
        return null;
      }

      return {
        type: result.type,
        suggestion: result.suggestion,
        confidence: result.confidence,
        reason: result.reason,
      };
    },
  },

  // Type resolvers for nested fields
  EmailDraft: {
    email: async (parent: any, _: any, context: Context) => {
      if (parent.email) return parent.email;
      if (!parent.emailId) return null;
      const loaders = context.loaders;
      if (loaders?.email) {
        return loaders.email.load(parent.emailId);
      }
      return prisma.email.findUnique({ where: { id: parent.emailId } });
    },

    case: async (parent: any) => {
      if (parent.case) return parent.case;
      if (!parent.caseId) return null;
      return prisma.case.findUnique({ where: { id: parent.caseId } });
    },

    user: async (parent: any) => {
      if (parent.user) return parent.user;
      return prisma.user.findUnique({ where: { id: parent.userId } });
    },

    suggestedAttachments: async (parent: any, _: any, context: Context) => {
      const loaders = context.loaders;
      if (loaders?.attachmentSuggestions) {
        return loaders.attachmentSuggestions.load(parent.id);
      }
      return prisma.attachmentSuggestion.findMany({
        where: { draftId: parent.id },
        include: { document: true },
        orderBy: { relevanceScore: 'desc' },
      });
    },

    refinements: async (parent: any) => {
      if (parent.refinements) return parent.refinements;
      return prisma.draftRefinement.findMany({
        where: { draftId: parent.id },
        orderBy: { createdAt: 'desc' },
      });
    },
  },

  DraftRefinement: {
    // No additional resolvers needed - all fields are scalar
  },

  AttachmentSuggestion: {
    document: async (parent: any) => {
      if (parent.document) return parent.document;
      return prisma.document.findUnique({ where: { id: parent.documentId } });
    },
  },

  // Enum resolvers
  EmailTone: {
    Formal: 'Formal',
    Professional: 'Professional',
    Brief: 'Brief',
    Detailed: 'Detailed',
  },

  RecipientType: {
    Client: 'Client',
    OpposingCounsel: 'OpposingCounsel',
    Court: 'Court',
    ThirdParty: 'ThirdParty',
    Internal: 'Internal',
  },

  DraftStatus: {
    Generated: 'Generated',
    Editing: 'Editing',
    Ready: 'Ready',
    Sent: 'Sent',
    Discarded: 'Discarded',
  },

  InlineSuggestionType: {
    Completion: 'Completion',
    Correction: 'Correction',
    Improvement: 'Improvement',
  },
};
