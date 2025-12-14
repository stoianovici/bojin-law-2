// @ts-nocheck
/**
 * Email Resolvers
 * Story 5.1: Email Integration and Synchronization
 *
 * GraphQL resolvers for email sync, threading, search, and categorization
 */

import { GraphQLError } from 'graphql';
import { prisma } from '@legal-platform/database';
import { PubSub } from 'graphql-subscriptions';
import { EmailSyncService, getEmailSyncService } from '../../services/email-sync.service';
import { EmailThreadService, getEmailThreadService } from '../../services/email-thread.service';
import { EmailSearchService, getEmailSearchService } from '../../services/email-search.service';
import {
  EmailAttachmentService,
  getEmailAttachmentService,
} from '../../services/email-attachment.service';
import { EmailWebhookService, getEmailWebhookService } from '../../services/email-webhook.service';
import { triggerProcessing } from '../../workers/email-categorization.worker';
import { unifiedTimelineService } from '../../services/unified-timeline.service';
import Redis from 'ioredis';

// ============================================================================
// Types
// ============================================================================

// Use the Context type from case.resolvers.ts for consistency
// The accessToken is now passed from the web app through the GraphQL proxy
interface Context {
  user?: {
    id: string;
    role: string;
    firmId: string;
    email: string;
    // MS Graph API access token for email sync operations
    accessToken?: string;
  };
}

// ============================================================================
// PubSub for Subscriptions
// ============================================================================

const pubsub = new PubSub();

const EMAIL_RECEIVED = 'EMAIL_RECEIVED';
const EMAIL_SYNC_PROGRESS = 'EMAIL_SYNC_PROGRESS';
const EMAIL_CATEGORIZED = 'EMAIL_CATEGORIZED';

// ============================================================================
// Service Initialization
// ============================================================================

const emailSyncService = getEmailSyncService(prisma);
const emailThreadService = getEmailThreadService(prisma);
const emailSearchService = getEmailSearchService(prisma);
const emailAttachmentService = getEmailAttachmentService(prisma);

// Redis for webhook service (lazy init)
let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }
  return redis;
}

// ============================================================================
// Resolvers
// ============================================================================

export const emailResolvers = {
  Query: {
    /**
     * Search emails with filters and pagination
     */
    emails: async (
      _: any,
      args: { filters?: any; limit?: number; offset?: number },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const filters = {
        userId: user.id,
        ...args.filters,
      };

      return await emailSearchService.searchEmails(filters, args.limit || 20, args.offset || 0);
    },

    /**
     * Get email threads
     */
    emailThreads: async (
      _: any,
      args: { filters?: any; limit?: number; offset?: number },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const filters = {
        userId: user.id,
        ...args.filters,
      };

      console.log(
        '[emailThreads] Query with userId:',
        user.id,
        'filters:',
        JSON.stringify(args.filters)
      );

      try {
        // First, check how many emails exist for this user
        const emailCount = await prisma.email.count({ where: { userId: user.id } });
        console.log('[emailThreads] Email count for user:', emailCount);

        const result = await emailThreadService.getThreads(filters, {
          limit: args.limit || 20,
          offset: args.offset || 0,
        });

        console.log(
          '[emailThreads] Result: threads=',
          result?.threads?.length,
          'totalCount=',
          result?.totalCount
        );

        // Always return an array, even if empty
        return result?.threads || [];
      } catch (error) {
        console.error('[emailThreads] Error fetching email threads:', error);
        // Return empty array on error to avoid null issues
        return [];
      }
    },

    /**
     * Get single email thread
     */
    emailThread: async (_: any, args: { conversationId: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await emailThreadService.getThread(args.conversationId, user.id);
    },

    /**
     * Get single email by ID
     */
    email: async (_: any, args: { id: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const email = await prisma.email.findFirst({
        where: {
          id: args.id,
          userId: user.id,
        },
        include: {
          case: true,
          attachments: true,
        },
      });

      if (!email) {
        throw new GraphQLError('Email not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      return email;
    },

    /**
     * Get email sync status
     */
    emailSyncStatus: async (_: any, _args: any, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await emailSyncService.getSyncStatus(user.id);
    },

    /**
     * Get thread participants
     */
    emailThreadParticipants: async (_: any, args: { conversationId: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await emailThreadService.getThreadParticipants(args.conversationId, user.id);
    },

    /**
     * Get email statistics
     */
    emailStats: async (_: any, _args: any, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await emailSearchService.getEmailStats(user.id);
    },

    /**
     * Get search suggestions
     */
    emailSearchSuggestions: async (_: any, args: { prefix: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await emailSearchService.getSuggestions(args.prefix, user.id);
    },

    /**
     * Get attachment content directly from MS Graph (for download)
     */
    emailAttachmentContent: async (
      _: any,
      args: { emailId: string; attachmentId: string },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      if (!user.accessToken) {
        throw new GraphQLError('Microsoft account connection required for attachment download', {
          extensions: { code: 'MS_TOKEN_REQUIRED' },
        });
      }

      // Get email to verify ownership and get graphMessageId
      const email = await prisma.email.findFirst({
        where: { id: args.emailId, userId: user.id },
      });

      if (!email) {
        throw new GraphQLError('Email not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Get attachment from database to get graphAttachmentId
      const attachment = await prisma.emailAttachment.findUnique({
        where: { id: args.attachmentId },
      });

      if (!attachment || attachment.emailId !== args.emailId) {
        throw new GraphQLError('Attachment not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Fetch content directly from MS Graph
      const content = await emailAttachmentService.getAttachmentContentFromGraph(
        email.graphMessageId,
        attachment.graphAttachmentId,
        user.accessToken
      );

      return {
        content: content.toString('base64'),
        name: attachment.name,
        contentType: attachment.contentType,
        size: attachment.size,
      };
    },
  },

  Mutation: {
    /**
     * Start email synchronization
     */
    startEmailSync: async (_: any, _args: any, context: Context) => {
      const { user } = context;

      console.log('[startEmailSync] Called with user:', user?.id, 'hasToken:', !!user?.accessToken);

      // Check if user is authenticated (session valid)
      if (!user) {
        console.error('[startEmailSync] No user session - full login required');
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Check if MS Graph token is available (MSAL authenticated)
      if (!user.accessToken) {
        console.error('[startEmailSync] No MS access token - Microsoft reconnect required');
        throw new GraphQLError('Microsoft account connection required for email sync', {
          extensions: { code: 'MS_TOKEN_REQUIRED' },
        });
      }

      console.log(
        '[startEmailSync] Starting sync for user:',
        user.id,
        'token length:',
        user.accessToken.length
      );

      // Start sync in background
      emailSyncService
        .syncUserEmails(user.id, user.accessToken)
        .then((result) => {
          console.log('[startEmailSync] Sync completed:', result);
          // Publish progress update
          pubsub.publish(EMAIL_SYNC_PROGRESS, {
            emailSyncProgress: {
              status: result.success ? 'synced' : 'error',
              emailCount: result.emailsSynced,
              lastSyncAt: new Date(),
              pendingCategorization: 0,
            },
          });
        })
        .catch((error) => {
          console.error('[startEmailSync] Email sync failed:', error);
        });

      // Return current status
      const status = await emailSyncService.getSyncStatus(user.id);
      console.log('[startEmailSync] Returning status:', status);
      return status;
    },

    /**
     * Assign email to case
     */
    assignEmailToCase: async (
      _: any,
      args: { emailId: string; caseId: string },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify email belongs to user
      const email = await prisma.email.findFirst({
        where: { id: args.emailId, userId: user.id },
      });

      if (!email) {
        throw new GraphQLError('Email not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Verify case exists and user has access
      const caseAccess = await prisma.caseTeam.findFirst({
        where: { caseId: args.caseId, userId: user.id },
      });

      if (!caseAccess) {
        throw new GraphQLError('Case not found or access denied', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Update email
      const updatedEmail = await prisma.email.update({
        where: { id: args.emailId },
        data: { caseId: args.caseId },
        include: { case: true, attachments: true },
      });

      // Sync to CommunicationEntry for unified timeline (Story 5.5)
      try {
        await unifiedTimelineService.syncEmailToCommunicationEntry(args.emailId);
      } catch (syncError) {
        console.error('[assignEmailToCase] Failed to sync to timeline:', syncError);
        // Don't fail the assignment if sync fails - email is still assigned
      }

      return updatedEmail;
    },

    /**
     * Assign entire thread to case
     */
    assignThreadToCase: async (
      _: any,
      args: { conversationId: string; caseId: string },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify case access
      const caseAccess = await prisma.caseTeam.findFirst({
        where: { caseId: args.caseId, userId: user.id },
      });

      if (!caseAccess) {
        throw new GraphQLError('Case not found or access denied', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Update all emails in thread
      await emailThreadService.assignThreadToCase(args.conversationId, args.caseId, user.id);

      // Sync all emails in thread to CommunicationEntry for unified timeline (Story 5.5)
      try {
        const threadEmails = await prisma.email.findMany({
          where: { conversationId: args.conversationId, userId: user.id },
          select: { id: true },
        });
        await Promise.all(
          threadEmails.map((e) => unifiedTimelineService.syncEmailToCommunicationEntry(e.id))
        );
      } catch (syncError) {
        console.error('[assignThreadToCase] Failed to sync to timeline:', syncError);
        // Don't fail the assignment if sync fails
      }

      // Return updated thread
      return await emailThreadService.getThread(args.conversationId, user.id);
    },

    /**
     * Mark email as read/unread
     */
    markEmailRead: async (_: any, args: { emailId: string; isRead: boolean }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify email belongs to user
      const email = await prisma.email.findFirst({
        where: { id: args.emailId, userId: user.id },
      });

      if (!email) {
        throw new GraphQLError('Email not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      return await prisma.email.update({
        where: { id: args.emailId },
        data: { isRead: args.isRead },
        include: { case: true, attachments: true },
      });
    },

    /**
     * Mark thread as read
     */
    markThreadRead: async (_: any, args: { conversationId: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      await emailThreadService.markThreadAsRead(args.conversationId, user.id);

      return await emailThreadService.getThread(args.conversationId, user.id);
    },

    /**
     * Sync attachments for email
     */
    syncEmailAttachments: async (_: any, args: { emailId: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      if (!user.accessToken) {
        throw new GraphQLError('Microsoft account connection required for attachment sync', {
          extensions: { code: 'MS_TOKEN_REQUIRED' },
        });
      }

      // Verify email belongs to user
      const email = await prisma.email.findFirst({
        where: { id: args.emailId, userId: user.id },
      });

      if (!email) {
        throw new GraphQLError('Email not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const result = await emailAttachmentService.syncAllAttachments(
        args.emailId,
        user.accessToken
      );

      return result.attachments;
    },

    /**
     * Trigger AI categorization
     */
    triggerEmailCategorization: async (_: any, _args: any, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Only partners/admins can trigger batch categorization
      if (user.role !== 'Partner' && user.role !== 'Admin') {
        throw new GraphQLError('Only partners/admins can trigger batch categorization', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const result = await triggerProcessing();

      return result.processed;
    },

    /**
     * Create/renew email subscription
     */
    createEmailSubscription: async (_: any, _args: any, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      if (!user.accessToken) {
        throw new GraphQLError('Microsoft account connection required for email subscription', {
          extensions: { code: 'MS_TOKEN_REQUIRED' },
        });
      }

      const webhookService = new EmailWebhookService(prisma, getRedis());

      await webhookService.createSubscription(user.id, user.accessToken);

      return await emailSyncService.getSyncStatus(user.id);
    },

    /**
     * Ignore an email thread (mark all emails in thread as ignored)
     */
    ignoreEmailThread: async (_: any, args: { conversationId: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Update all emails in the thread to be ignored
      await prisma.email.updateMany({
        where: {
          conversationId: args.conversationId,
          userId: user.id,
        },
        data: {
          isIgnored: true,
          ignoredAt: new Date(),
        },
      });

      // Return the updated thread
      return await emailThreadService.getThread(args.conversationId, user.id);
    },

    /**
     * Unignore an email thread (restore all emails in thread)
     */
    unignoreEmailThread: async (_: any, args: { conversationId: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Update all emails in the thread to be not ignored
      await prisma.email.updateMany({
        where: {
          conversationId: args.conversationId,
          userId: user.id,
        },
        data: {
          isIgnored: false,
          ignoredAt: null,
        },
      });

      // Return the updated thread
      return await emailThreadService.getThread(args.conversationId, user.id);
    },

    /**
     * Send a new email via MS Graph API
     */
    sendNewEmail: async (
      _: any,
      args: {
        input: {
          to: string[];
          cc?: string[];
          subject: string;
          body: string;
          isHtml?: boolean;
          caseId?: string;
          attachments?: Array<{
            name: string;
            contentType: string;
            contentBase64: string;
          }>;
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

      if (!user.accessToken) {
        throw new GraphQLError('Microsoft account connection required to send email', {
          extensions: { code: 'MS_TOKEN_REQUIRED' },
        });
      }

      const { to, cc, subject, body, isHtml, caseId, attachments } = args.input;

      // Verify case access if caseId provided
      if (caseId) {
        const caseAccess = await prisma.caseTeam.findFirst({
          where: { caseId, userId: user.id },
        });

        if (!caseAccess) {
          throw new GraphQLError('Case not found or access denied', {
            extensions: { code: 'FORBIDDEN' },
          });
        }
      }

      try {
        // Build recipients
        const toRecipients = to.map((address) => ({
          emailAddress: { address },
        }));

        const ccRecipients = cc
          ? cc.map((address) => ({
              emailAddress: { address },
            }))
          : [];

        // Build attachments for MS Graph API
        const graphAttachments = attachments
          ? attachments.map((att) => ({
              '@odata.type': '#microsoft.graph.fileAttachment',
              name: att.name,
              contentType: att.contentType,
              contentBytes: att.contentBase64,
            }))
          : undefined;

        // Send via MS Graph API
        const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${user.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              subject,
              body: {
                contentType: isHtml ? 'HTML' : 'Text',
                content: body,
              },
              toRecipients,
              ccRecipients: ccRecipients.length > 0 ? ccRecipients : undefined,
              attachments: graphAttachments,
            },
            saveToSentItems: true,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[sendNewEmail] Graph API error:', errorText);
          return {
            success: false,
            error: `Failed to send email: ${response.status}`,
          };
        }

        return {
          success: true,
          messageId: null, // sendMail doesn't return message ID
        };
      } catch (error: any) {
        console.error('[sendNewEmail] Error:', error);
        return {
          success: false,
          error: error.message || 'Failed to send email',
        };
      }
    },

    /**
     * Reply to an email thread via MS Graph API
     */
    replyToEmail: async (
      _: any,
      args: {
        input: {
          conversationId: string;
          to: string[];
          cc?: string[];
          subject: string;
          body: string;
          isHtml?: boolean;
          includeOriginal?: boolean;
          attachments?: Array<{
            name: string;
            contentType: string;
            contentBase64: string;
          }>;
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

      if (!user.accessToken) {
        throw new GraphQLError('Microsoft account connection required to send reply', {
          extensions: { code: 'MS_TOKEN_REQUIRED' },
        });
      }

      const { conversationId, to, cc, subject, body, isHtml, includeOriginal, attachments } =
        args.input;

      try {
        // Get the last email in the thread to reply to
        const lastEmail = await prisma.email.findFirst({
          where: {
            conversationId,
            userId: user.id,
          },
          orderBy: {
            receivedDateTime: 'desc',
          },
        });

        if (!lastEmail) {
          return {
            success: false,
            error: 'Thread not found',
          };
        }

        // Build the reply body
        let replyBody = body;
        if (includeOriginal && lastEmail.bodyContent) {
          const originalDate = lastEmail.sentDateTime
            ? new Date(lastEmail.sentDateTime).toLocaleString('ro-RO')
            : '';
          const originalFrom =
            (lastEmail.from as any)?.address ||
            (lastEmail.from as any)?.emailAddress?.address ||
            '';
          replyBody = `${body}\n\n---\nÎn ${originalDate}, ${originalFrom} a scris:\n\n${lastEmail.bodyContent}`;
        }

        // Build recipients
        const toRecipients = to.map((address) => ({
          emailAddress: { address },
        }));

        const ccRecipients = cc
          ? cc.map((address) => ({
              emailAddress: { address },
            }))
          : [];

        // Build attachments for MS Graph API
        const graphAttachments = attachments
          ? attachments.map((att) => ({
              '@odata.type': '#microsoft.graph.fileAttachment',
              name: att.name,
              contentType: att.contentType,
              contentBytes: att.contentBase64,
            }))
          : undefined;

        // Send via MS Graph API
        const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${user.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              subject,
              body: {
                contentType: isHtml ? 'HTML' : 'Text',
                content: replyBody,
              },
              toRecipients,
              ccRecipients: ccRecipients.length > 0 ? ccRecipients : undefined,
              attachments: graphAttachments,
              // Link to original conversation
              conversationId: lastEmail.conversationId || conversationId,
            },
            saveToSentItems: true,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[replyToEmail] Graph API error:', errorText);
          return {
            success: false,
            error: `Failed to send reply: ${response.status}`,
          };
        }

        return {
          success: true,
          messageId: null,
        };
      } catch (error: any) {
        console.error('[replyToEmail] Error:', error);
        return {
          success: false,
          error: error.message || 'Failed to send reply',
        };
      }
    },
  },

  Subscription: {
    emailReceived: {
      subscribe: () => pubsub.asyncIterator([EMAIL_RECEIVED]),
    },
    emailSyncProgress: {
      subscribe: () => pubsub.asyncIterator([EMAIL_SYNC_PROGRESS]),
    },
    emailCategorized: {
      subscribe: () => pubsub.asyncIterator([EMAIL_CATEGORIZED]),
    },
  },

  // Type resolvers
  Email: {
    conversationId: (parent: any) => parent.conversationId || null,
    from: (parent: any) => parent.from || { address: '' },
    toRecipients: (parent: any) => parent.toRecipients || [],
    ccRecipients: (parent: any) => parent.ccRecipients || [],
    case: async (parent: any) => {
      if (!parent.caseId) return null;
      if (parent.case) return parent.case;
      return await prisma.case.findUnique({ where: { id: parent.caseId } });
    },
    attachments: async (parent: any) => {
      if (parent.attachments) return parent.attachments;
      return await prisma.emailAttachment.findMany({
        where: { emailId: parent.id },
      });
    },
    thread: async (parent: any, _args: any, context: Context) => {
      if (!context.user) return null;
      const threadService = getEmailThreadService(prisma);
      return await threadService.getThread(parent.conversationId, context.user.id);
    },
  },

  EmailThread: {
    case: async (parent: any) => {
      if (!parent.caseId) return null;
      return await prisma.case.findUnique({ where: { id: parent.caseId } });
    },
  },

  EmailAttachment: {
    document: async (parent: any) => {
      if (!parent.documentId) return null;
      return await prisma.document.findUnique({ where: { id: parent.documentId } });
    },
    downloadUrl: async (parent: any, _args: any, context: Context) => {
      if (!context.user?.accessToken || !parent.storageUrl) return null;
      try {
        const attachmentService = getEmailAttachmentService(prisma);
        const result = await attachmentService.getAttachmentDownloadUrl(
          parent.id,
          context.user.accessToken
        );
        return result.url;
      } catch {
        return null;
      }
    },
  },
};

// ============================================================================
// Helper to publish events (for use by other services)
// ============================================================================

export function publishEmailReceived(email: any) {
  pubsub.publish(EMAIL_RECEIVED, { emailReceived: email });
}

export function publishEmailCategorized(result: any) {
  pubsub.publish(EMAIL_CATEGORIZED, { emailCategorized: result });
}
