/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { emailCleanerService } from '../../services/email-cleaner.service';
import { classificationScoringService, CaseScore } from '../../services/classification-scoring';
import { CaseStatus, EmailClassificationState } from '@prisma/client';
import Redis from 'ioredis';
import { oneDriveService } from '../../services/onedrive.service';
import { r2StorageService } from '../../services/r2-storage.service';
import logger from '../../utils/logger';

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

const EMAIL_RECEIVED = 'EMAIL_RECEIVED';
const EMAIL_SYNC_PROGRESS = 'EMAIL_SYNC_PROGRESS';
const EMAIL_CATEGORIZED = 'EMAIL_CATEGORIZED';

// Define PubSub event types
type PubSubEvents = {
  [EMAIL_RECEIVED]: { emailReceived: unknown };
  [EMAIL_SYNC_PROGRESS]: { emailSyncProgress: unknown };
  [EMAIL_CATEGORIZED]: { emailCategorized: unknown };
};

const pubsub = new PubSub<PubSubEvents>();

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
// Helper Functions (OPS-042)
// ============================================================================

interface UserContext {
  id: string;
  firmId: string;
}

interface EmailForSuggestions {
  id: string;
  subject: string;
  from: any;
  bodyPreview: string;
  bodyContent?: string | null;
  receivedDateTime: Date;
}

/**
 * Get suggested cases for an uncertain email
 * Finds cases where the sender is associated (as actor or client)
 * and scores them using the classification algorithm
 */
async function getSuggestedCasesForEmail(
  email: EmailForSuggestions,
  user: UserContext
): Promise<
  Array<{
    id: string;
    caseNumber: string;
    title: string;
    score: number;
    signals: Array<{ type: string; weight: number; matched: string }>;
    lastActivityAt: Date | null;
  }>
> {
  // Get sender email address
  const senderEmail = (
    email.from?.address ||
    email.from?.emailAddress?.address ||
    ''
  ).toLowerCase();

  if (!senderEmail) {
    return [];
  }

  // Find cases where sender is an actor or client
  const candidateCases = await prisma.case.findMany({
    where: {
      firmId: user.firmId,
      status: { in: [CaseStatus.Active, CaseStatus.PendingApproval] },
      OR: [
        { actors: { some: { email: { equals: senderEmail, mode: 'insensitive' } } } },
        {
          client: {
            contactInfo: {
              path: ['email'],
              string_contains: senderEmail,
            },
          },
        },
      ],
      // User must be on the case team
      teamMembers: { some: { userId: user.id } },
    },
    include: {
      actors: { select: { email: true, name: true, role: true } },
      client: { select: { name: true, contactInfo: true } },
      activityFeed: {
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (candidateCases.length === 0) {
    return [];
  }

  // Score each case
  const scores: Array<{
    id: string;
    caseNumber: string;
    title: string;
    score: number;
    signals: Array<{ type: string; weight: number; matched: string }>;
    lastActivityAt: Date | null;
  }> = [];

  const WEIGHTS = {
    REFERENCE_NUMBER: 50,
    KEYWORD_SUBJECT: 30,
    KEYWORD_BODY: 20,
    RECENT_ACTIVITY: 20,
    CONTACT_MATCH: 10,
  };

  for (const caseData of candidateCases) {
    const signals: Array<{ type: string; weight: number; matched: string }> = [];
    let totalScore = WEIGHTS.CONTACT_MATCH;

    signals.push({
      type: 'CONTACT_MATCH',
      weight: WEIGHTS.CONTACT_MATCH,
      matched: senderEmail,
    });

    // Check keywords in subject
    const subjectLower = email.subject.toLowerCase();
    const keywords = caseData.keywords || [];
    for (const keyword of keywords) {
      if (keyword && subjectLower.includes(keyword.toLowerCase())) {
        signals.push({
          type: 'KEYWORD_SUBJECT',
          weight: WEIGHTS.KEYWORD_SUBJECT,
          matched: keyword,
        });
        totalScore += WEIGHTS.KEYWORD_SUBJECT;
        break;
      }
    }

    // Check keywords in body
    const bodyLower = (email.bodyPreview || '').toLowerCase();
    const bodyContentLower = (email.bodyContent || '').toLowerCase();
    for (const keyword of keywords) {
      if (
        keyword &&
        (bodyLower.includes(keyword.toLowerCase()) ||
          bodyContentLower.includes(keyword.toLowerCase()))
      ) {
        if (!signals.some((s) => s.type === 'KEYWORD_SUBJECT' && s.matched === keyword)) {
          signals.push({
            type: 'KEYWORD_BODY',
            weight: WEIGHTS.KEYWORD_BODY,
            matched: keyword,
          });
          totalScore += WEIGHTS.KEYWORD_BODY;
          break;
        }
      }
    }

    // Check reference numbers
    const referenceNumbers = caseData.referenceNumbers || [];
    const textToSearch = `${email.subject} ${email.bodyPreview} ${email.bodyContent || ''}`;
    const extractedRefs = classificationScoringService.extractReferenceNumbers(textToSearch);
    for (const ref of referenceNumbers) {
      const refNormalized = ref.toLowerCase().replace(/\s+/g, '');
      for (const extracted of extractedRefs) {
        const extractedNormalized = extracted.toLowerCase().replace(/\s+/g, '');
        if (refNormalized === extractedNormalized) {
          signals.push({
            type: 'REFERENCE_NUMBER',
            weight: WEIGHTS.REFERENCE_NUMBER,
            matched: ref,
          });
          totalScore += WEIGHTS.REFERENCE_NUMBER;
          break;
        }
      }
    }

    // Check recent activity
    const lastActivity = caseData.activityFeed[0]?.createdAt;
    if (lastActivity) {
      const daysSinceActivity = Math.floor(
        (email.receivedDateTime.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceActivity >= 0 && daysSinceActivity <= 7) {
        signals.push({
          type: 'RECENT_ACTIVITY',
          weight: WEIGHTS.RECENT_ACTIVITY,
          matched: `${daysSinceActivity} zile în urmă`,
        });
        totalScore += WEIGHTS.RECENT_ACTIVITY;
      }
    }

    // Sort signals by weight
    signals.sort((a, b) => b.weight - a.weight);

    scores.push({
      id: caseData.id,
      caseNumber: caseData.caseNumber,
      title: caseData.title,
      score: totalScore,
      signals,
      lastActivityAt: lastActivity || null,
    });
  }

  // Sort by score descending and return top 5
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, 5);
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

    /**
     * Get preview URL for an email attachment (OPS-087)
     * Returns URL for embedding attachment preview in iframe
     */
    attachmentPreviewUrl: async (_: any, args: { attachmentId: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Get attachment with its document reference
      const attachment = await prisma.emailAttachment.findUnique({
        where: { id: args.attachmentId },
        include: {
          email: true,
          document: true,
        },
      });

      if (!attachment) {
        throw new GraphQLError('Attachment not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Verify user has access to this attachment (via email ownership)
      if (attachment.email.userId !== user.id && attachment.email.firmId !== user.firmId) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // File types that can be previewed directly in browser (PDFs and images)
      const browserPreviewableTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
      ];

      // Office document types that can be previewed via Office Online
      const officeTypes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
        'application/msword', // .doc
        'application/vnd.ms-excel', // .xls
        'application/vnd.ms-powerpoint', // .ppt
      ];

      // Try OneDrive preview first via linked document
      if (attachment.document?.oneDriveId && user.accessToken) {
        const previewInfo = await oneDriveService.getPreviewUrl(
          user.accessToken,
          attachment.document.oneDriveId,
          attachment.contentType
        );

        if (previewInfo) {
          return {
            url: previewInfo.url,
            source: previewInfo.source,
            expiresAt: previewInfo.expiresAt,
          };
        }
      }

      // Fallback to R2 for attachments with linked documents
      if (attachment.document?.storagePath) {
        const presignedUrl = await r2StorageService.getPresignedUrl(
          attachment.document.storagePath
        );
        if (presignedUrl) {
          // For browser-previewable types (PDF, images), return direct URL
          if (browserPreviewableTypes.includes(attachment.contentType)) {
            logger.debug('Using R2 presigned URL for attachment preview', {
              attachmentId: args.attachmentId,
              contentType: attachment.contentType,
            });
            return {
              url: presignedUrl.url,
              source: 'r2',
              expiresAt: presignedUrl.expiresAt,
            };
          }

          // For Office documents, use Office Online viewer with R2 presigned URL
          if (officeTypes.includes(attachment.contentType)) {
            const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(presignedUrl.url)}`;
            logger.debug('Using Office Online viewer with R2 URL for attachment preview', {
              attachmentId: args.attachmentId,
              contentType: attachment.contentType,
            });
            return {
              url: officeViewerUrl,
              source: 'office365-r2',
              expiresAt: presignedUrl.expiresAt,
            };
          }
        }
      }

      logger.debug('Preview not available for attachment', {
        attachmentId: args.attachmentId,
        contentType: attachment.contentType,
        hasDocument: !!attachment.document,
        hasOneDriveId: !!attachment.document?.oneDriveId,
        hasStoragePath: !!attachment.document?.storagePath,
      });
      return null;
    },

    // =========================================================================
    // INSTANȚE Queries (OPS-040: Court Email Detection)
    // =========================================================================

    /**
     * Get unassigned court emails for the INSTANȚE folder
     */
    unassignedCourtEmails: async (
      _: any,
      args: { limit?: number; offset?: number },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const limit = args.limit || 50;
      const offset = args.offset || 0;

      // Get emails with CourtUnassigned state for this user's firm
      const emails = await prisma.email.findMany({
        where: {
          firmId: user.firmId,
          classificationState: EmailClassificationState.CourtUnassigned,
        },
        select: {
          id: true,
          subject: true,
          from: true,
          receivedDateTime: true,
          bodyPreview: true,
          bodyContent: true,
        },
        orderBy: { receivedDateTime: 'desc' },
        take: limit,
        skip: offset,
      });

      // For each email, extract references and find suggested cases
      const results = await Promise.all(
        emails.map(async (email) => {
          const textToSearch = `${email.subject} ${email.bodyPreview} ${email.bodyContent || ''}`;
          const extractedReferences =
            classificationScoringService.extractReferenceNumbers(textToSearch);

          // Find suggested cases based on extracted references
          let suggestedCases: any[] = [];
          if (extractedReferences.length > 0) {
            const matchingCases = await prisma.case.findMany({
              where: {
                firmId: user.firmId,
                referenceNumbers: { hasSome: extractedReferences },
              },
              select: {
                id: true,
                caseNumber: true,
                title: true,
                referenceNumbers: true,
              },
              take: 5,
            });
            suggestedCases = matchingCases.map((c) => ({
              id: c.id,
              caseNumber: c.caseNumber,
              title: c.title,
              referenceNumbers: c.referenceNumbers || [],
            }));
          }

          return {
            id: email.id,
            subject: email.subject,
            from: email.from || { address: '' },
            receivedDateTime: email.receivedDateTime,
            extractedReferences,
            suggestedCases,
            institutionCategory: null, // Could be enhanced to store this on Email model
            bodyPreview: email.bodyPreview,
          };
        })
      );

      return results;
    },

    /**
     * Get count of unassigned court emails
     */
    unassignedCourtEmailsCount: async (_: any, _args: any, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await prisma.email.count({
        where: {
          firmId: user.firmId,
          classificationState: EmailClassificationState.CourtUnassigned,
        },
      });
    },

    // =========================================================================
    // NECLAR Queries (OPS-042: Classification Modal)
    // =========================================================================

    /**
     * Get uncertain emails for the NECLAR queue
     */
    uncertainEmails: async (
      _: any,
      args: { limit?: number; offset?: number },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const limit = args.limit || 50;
      const offset = args.offset || 0;

      // Get emails with Uncertain state for this user
      const emails = await prisma.email.findMany({
        where: {
          userId: user.id,
          firmId: user.firmId,
          classificationState: EmailClassificationState.Uncertain,
        },
        select: {
          id: true,
          subject: true,
          from: true,
          receivedDateTime: true,
          bodyPreview: true,
          bodyContent: true,
        },
        orderBy: { receivedDateTime: 'desc' },
        take: limit,
        skip: offset,
      });

      // For each email, calculate suggested cases by re-running the scoring
      const results = await Promise.all(
        emails.map(async (email) => {
          const suggestedCases = await getSuggestedCasesForEmail(email, user);
          return {
            id: email.id,
            subject: email.subject,
            from: email.from || { address: '' },
            receivedDateTime: email.receivedDateTime,
            bodyPreview: email.bodyPreview,
            bodyContent: email.bodyContent,
            suggestedCases,
            uncertaintyReason: 'AMBIGUOUS', // Could be enhanced to store reason
          };
        })
      );

      return results;
    },

    /**
     * Get count of uncertain emails
     */
    uncertainEmailsCount: async (_: any, _args: any, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await prisma.email.count({
        where: {
          userId: user.id,
          firmId: user.firmId,
          classificationState: EmailClassificationState.Uncertain,
        },
      });
    },

    /**
     * Get a single uncertain email with full details
     */
    uncertainEmail: async (_: any, args: { id: string }, context: Context) => {
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
          firmId: user.firmId,
          classificationState: EmailClassificationState.Uncertain,
        },
        select: {
          id: true,
          subject: true,
          from: true,
          receivedDateTime: true,
          bodyPreview: true,
          bodyContent: true,
        },
      });

      if (!email) {
        return null;
      }

      const suggestedCases = await getSuggestedCasesForEmail(email, user);

      return {
        id: email.id,
        subject: email.subject,
        from: email.from || { address: '' },
        receivedDateTime: email.receivedDateTime,
        bodyPreview: email.bodyPreview,
        bodyContent: email.bodyContent,
        suggestedCases,
        uncertaintyReason: 'AMBIGUOUS',
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
     * OPS-125: Now auto-adds sender as case contact and returns AssignThreadResult
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

      // Update all emails in thread and auto-add contact (OPS-125)
      const assignResult = await emailThreadService.assignThreadToCase(
        args.conversationId,
        args.caseId,
        user.id,
        { userId: user.id, firmId: user.firmId }
      );

      // Sync attachments to OneDrive now that emails are assigned to a case
      // This creates Document records and enables preview functionality
      if (user.accessToken) {
        try {
          const emailsWithAttachments = await prisma.email.findMany({
            where: {
              conversationId: args.conversationId,
              userId: user.id,
              hasAttachments: true,
            },
            select: { id: true },
          });

          const emailAttachmentService = getEmailAttachmentService(prisma);
          for (const email of emailsWithAttachments) {
            try {
              await emailAttachmentService.syncAllAttachments(email.id, user.accessToken!);
            } catch (attachmentError) {
              logger.error('[assignThreadToCase] Failed to sync attachments for email', {
                emailId: email.id,
                error:
                  attachmentError instanceof Error
                    ? attachmentError.message
                    : String(attachmentError),
              });
              // Continue with other emails even if one fails
            }
          }
        } catch (syncError) {
          logger.error('[assignThreadToCase] Failed to sync attachments', {
            conversationId: args.conversationId,
            error: syncError instanceof Error ? syncError.message : String(syncError),
          });
          // Don't fail the assignment if attachment sync fails
        }
      }

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

      // Get updated thread for response
      const thread = await emailThreadService.getThread(args.conversationId, user.id);

      // OPS-125: Return AssignThreadResult with contact info
      return {
        thread,
        newContactAdded: assignResult.newContactAdded,
        contactName: assignResult.contactName,
        contactEmail: assignResult.contactEmail,
      };
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
     * Backfill AI-cleaned content for existing emails (OPS-090)
     * Processes emails that don't have bodyContentClean yet
     */
    backfillEmailCleanContent: async (_: any, args: { limit?: number }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Only partners/admins can trigger backfill
      if (user.role !== 'Partner' && user.role !== 'Admin' && user.role !== 'BusinessOwner') {
        throw new GraphQLError('Only partners/admins can trigger backfill', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const limit = args.limit || 50;
      let processed = 0;
      let errors = 0;

      // Find emails without clean content
      const emails = await prisma.email.findMany({
        where: {
          firmId: user.firmId,
          bodyContentClean: null,
          bodyContent: { not: null },
        },
        select: {
          id: true,
          bodyContent: true,
          bodyContentType: true,
        },
        orderBy: { receivedDateTime: 'desc' },
        take: limit,
      });

      // Process each email
      for (const email of emails) {
        if (!email.bodyContent || email.bodyContent.length < 100) {
          continue;
        }

        try {
          const result = await emailCleanerService.extractCleanContent(
            email.bodyContent,
            email.bodyContentType
          );

          if (result.success && result.cleanContent) {
            await prisma.email.update({
              where: { id: email.id },
              data: { bodyContentClean: result.cleanContent },
            });
            processed++;
          }
        } catch (error) {
          console.error(`[backfillEmailCleanContent] Failed to clean email ${email.id}:`, error);
          errors++;
        }

        // Small delay to avoid overwhelming the API
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      console.log(`[backfillEmailCleanContent] Processed ${processed} emails, ${errors} errors`);
      return processed;
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

    // Bulk clear all case data (emails and documents) - Admin cleanup
    bulkClearCaseData: async (_: any, args: { caseId: string }, context: Context) => {
      const user = context.user;
      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Only Partners and BusinessOwners can bulk clear
      if (user.role !== 'Partner' && user.role !== 'BusinessOwner') {
        throw new GraphQLError('Only Partners and BusinessOwners can clear case data', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Verify case exists and belongs to user's firm
      const caseData = await prisma.case.findUnique({
        where: { id: args.caseId },
        select: { firmId: true },
      });

      if (!caseData || caseData.firmId !== user.firmId) {
        throw new GraphQLError('Case not found or not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      console.log('[bulkClearCaseData] Starting cleanup for case:', args.caseId);

      // Perform cleanup in transaction
      const result = await prisma.$transaction(async (tx) => {
        // 1. Get all emails linked to this case
        const emails = await tx.email.findMany({
          where: { caseId: args.caseId },
          select: { id: true },
        });
        const _emailIds = emails.map((e) => e.id); // Kept for potential future use

        // 2. Get all CaseDocuments for this case
        const caseDocuments = await tx.caseDocument.findMany({
          where: { caseId: args.caseId },
          select: { documentId: true },
        });
        const documentIds = caseDocuments.map((cd) => cd.documentId);

        // 3. Clear EmailAttachment.documentId references for these documents
        let attachmentReferencesCleared = 0;
        if (documentIds.length > 0) {
          const attachmentsResult = await tx.emailAttachment.updateMany({
            where: { documentId: { in: documentIds } },
            data: { documentId: null },
          });
          attachmentReferencesCleared = attachmentsResult.count;
        }

        // 4. Delete CaseDocuments
        const caseDocsResult = await tx.caseDocument.deleteMany({
          where: { caseId: args.caseId },
        });

        // 5. Delete Documents that are no longer linked to any case
        let documentsDeleted = 0;
        if (documentIds.length > 0) {
          // Find documents that still have links
          const stillLinked = await tx.caseDocument.findMany({
            where: { documentId: { in: documentIds } },
            select: { documentId: true },
          });
          const stillLinkedIds = new Set(stillLinked.map((cd) => cd.documentId));
          const orphanedIds = documentIds.filter((id) => !stillLinkedIds.has(id));

          if (orphanedIds.length > 0) {
            const deleteResult = await tx.document.deleteMany({
              where: { id: { in: orphanedIds } },
            });
            documentsDeleted = deleteResult.count;
          }
        }

        // 6. Delete emails linked to case (and their attachments via cascade)
        // First delete attachments explicitly to get count
        const attachmentsResult = await tx.emailAttachment.deleteMany({
          where: { email: { caseId: args.caseId } },
        });

        // Then delete the emails
        const emailsResult = await tx.email.deleteMany({
          where: { caseId: args.caseId },
        });

        return {
          emailsDeleted: emailsResult.count,
          caseDocumentsDeleted: caseDocsResult.count,
          documentsDeleted,
          attachmentReferencesCleared: attachmentReferencesCleared + attachmentsResult.count,
          success: true,
        };
      });

      console.log('[bulkClearCaseData] Cleanup complete:', result);

      return result;
    },

    /**
     * Permanently delete a single email and all its attachments
     * Partners/BusinessOwners only
     */
    permanentlyDeleteEmail: async (_: any, args: { emailId: string }, context: Context) => {
      const user = context.user;
      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Only Partners and BusinessOwners can permanently delete
      if (user.role !== 'Partner' && user.role !== 'BusinessOwner') {
        throw new GraphQLError('Only Partners and BusinessOwners can permanently delete emails', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Verify email exists and belongs to user's firm
      const email = await prisma.email.findUnique({
        where: { id: args.emailId },
        select: { firmId: true, id: true },
      });

      if (!email || email.firmId !== user.firmId) {
        throw new GraphQLError('Email not found or not authorized', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      console.log('[permanentlyDeleteEmail] Deleting email:', args.emailId);

      // Delete in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Delete attachments first
        const attachmentsResult = await tx.emailAttachment.deleteMany({
          where: { emailId: args.emailId },
        });

        // Delete the email
        await tx.email.delete({
          where: { id: args.emailId },
        });

        return {
          success: true,
          attachmentsDeleted: attachmentsResult.count,
        };
      });

      console.log(
        '[permanentlyDeleteEmail] Deleted email with',
        result.attachmentsDeleted,
        'attachments'
      );

      return result;
    },

    /**
     * Bulk delete all emails linked to a case
     * Partners/BusinessOwners only
     */
    bulkDeleteCaseEmails: async (_: any, args: { caseId: string }, context: Context) => {
      const user = context.user;
      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Only Partners and BusinessOwners can bulk delete
      if (user.role !== 'Partner' && user.role !== 'BusinessOwner') {
        throw new GraphQLError('Only Partners and BusinessOwners can bulk delete emails', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Verify case exists and belongs to user's firm
      const caseData = await prisma.case.findUnique({
        where: { id: args.caseId },
        select: { firmId: true },
      });

      if (!caseData || caseData.firmId !== user.firmId) {
        throw new GraphQLError('Case not found or not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      console.log('[bulkDeleteCaseEmails] Deleting all emails for case:', args.caseId);

      // Delete in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Get email IDs first
        const emails = await tx.email.findMany({
          where: { caseId: args.caseId },
          select: { id: true },
        });
        const emailIds = emails.map((e) => e.id);

        if (emailIds.length === 0) {
          return {
            emailsDeleted: 0,
            attachmentsDeleted: 0,
            success: true,
          };
        }

        // Delete attachments first
        const attachmentsResult = await tx.emailAttachment.deleteMany({
          where: { emailId: { in: emailIds } },
        });

        // Delete the emails
        const emailsResult = await tx.email.deleteMany({
          where: { id: { in: emailIds } },
        });

        return {
          emailsDeleted: emailsResult.count,
          attachmentsDeleted: attachmentsResult.count,
          success: true,
        };
      });

      console.log(
        '[bulkDeleteCaseEmails] Deleted',
        result.emailsDeleted,
        'emails with',
        result.attachmentsDeleted,
        'attachments'
      );

      return result;
    },

    // =========================================================================
    // INSTANȚE Mutations (OPS-040: Court Email Detection)
    // =========================================================================

    /**
     * Assign a court email to a case manually
     * Optionally adds extracted reference numbers to the case
     */
    assignCourtEmailToCase: async (
      _: any,
      args: { emailId: string; caseId: string; addReference?: boolean },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify email exists and is in CourtUnassigned state
      const email = await prisma.email.findFirst({
        where: {
          id: args.emailId,
          firmId: user.firmId,
          classificationState: EmailClassificationState.CourtUnassigned,
        },
      });

      if (!email) {
        throw new GraphQLError('Email not found or not a court email', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Verify case exists and user has access
      const caseAccess = await prisma.caseTeam.findFirst({
        where: { caseId: args.caseId, userId: user.id },
        include: { case: true },
      });

      if (!caseAccess) {
        throw new GraphQLError('Case not found or access denied', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Extract reference numbers from email
      const textToSearch = `${email.subject} ${email.bodyPreview} ${email.bodyContent || ''}`;
      const extractedReferences =
        classificationScoringService.extractReferenceNumbers(textToSearch);

      // Start transaction
      let referenceAdded = false;
      const result = await prisma.$transaction(async (tx) => {
        // Update email classification
        const updatedEmail = await tx.email.update({
          where: { id: args.emailId },
          data: {
            caseId: args.caseId,
            classificationState: EmailClassificationState.Classified,
            classificationConfidence: 1.0,
            classifiedAt: new Date(),
            classifiedBy: user.id,
          },
          include: { case: true, attachments: true },
        });

        // Add reference to case if requested
        if (args.addReference && extractedReferences.length > 0) {
          const caseData = await tx.case.findUnique({
            where: { id: args.caseId },
            select: { referenceNumbers: true },
          });

          const existingRefs = caseData?.referenceNumbers || [];
          const newRefs = extractedReferences.filter((r) => !existingRefs.includes(r));

          if (newRefs.length > 0) {
            await tx.case.update({
              where: { id: args.caseId },
              data: {
                referenceNumbers: [...existingRefs, ...newRefs],
              },
            });
            referenceAdded = true;
          }
        }

        return updatedEmail;
      });

      // Get updated case
      const updatedCase = await prisma.case.findUnique({
        where: { id: args.caseId },
      });

      // Log classification for audit
      await prisma.emailClassificationLog.create({
        data: {
          firmId: user.firmId,
          emailId: args.emailId,
          action: 'MANUAL_COURT_ASSIGN',
          toCaseId: args.caseId,
          performedBy: user.id,
          correctionReason: referenceAdded
            ? `Manual assignment with reference added: ${extractedReferences.join(', ')}`
            : 'Manual assignment from INSTANȚE folder',
        },
      });

      // Sync to CommunicationEntry for unified timeline
      try {
        await unifiedTimelineService.syncEmailToCommunicationEntry(args.emailId);
      } catch (syncError) {
        console.error('[assignCourtEmailToCase] Failed to sync to timeline:', syncError);
      }

      return {
        email: result,
        case: updatedCase,
        referenceAdded,
      };
    },

    // =========================================================================
    // NECLAR Mutations (OPS-042: Classification Modal)
    // =========================================================================

    /**
     * Classify an uncertain email (NECLAR queue)
     * User selects a case or marks as ignored
     */
    classifyUncertainEmail: async (
      _: any,
      args: {
        emailId: string;
        action: {
          type: 'ASSIGN_TO_CASE' | 'IGNORE';
          caseId?: string;
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

      // Validate action
      if (args.action.type === 'ASSIGN_TO_CASE' && !args.action.caseId) {
        throw new GraphQLError('Case ID is required for ASSIGN_TO_CASE action', {
          extensions: { code: 'BAD_REQUEST' },
        });
      }

      // Verify email exists and is in Uncertain state
      const email = await prisma.email.findFirst({
        where: {
          id: args.emailId,
          userId: user.id,
          firmId: user.firmId,
          classificationState: EmailClassificationState.Uncertain,
        },
      });

      if (!email) {
        throw new GraphQLError('Email not found or not in NECLAR queue', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Handle IGNORE action
      if (args.action.type === 'IGNORE') {
        const updatedEmail = await prisma.email.update({
          where: { id: args.emailId },
          data: {
            classificationState: EmailClassificationState.Ignored,
            classifiedAt: new Date(),
            classifiedBy: user.id,
            isIgnored: true,
            ignoredAt: new Date(),
          },
          include: { case: true, attachments: true },
        });

        // Log classification for audit
        await prisma.emailClassificationLog.create({
          data: {
            firmId: user.firmId,
            emailId: args.emailId,
            action: 'MANUAL_IGNORE',
            performedBy: user.id,
            correctionReason: 'User marked email as not relevant',
          },
        });

        return {
          email: updatedEmail,
          case: null,
          wasIgnored: true,
        };
      }

      // Handle ASSIGN_TO_CASE action
      const caseId = args.action.caseId!;

      // Verify case exists and user has access
      const caseAccess = await prisma.caseTeam.findFirst({
        where: { caseId, userId: user.id },
      });

      if (!caseAccess) {
        throw new GraphQLError('Case not found or access denied', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Update email classification
      const updatedEmail = await prisma.email.update({
        where: { id: args.emailId },
        data: {
          caseId,
          classificationState: EmailClassificationState.Classified,
          classificationConfidence: 1.0,
          classifiedAt: new Date(),
          classifiedBy: user.id,
        },
        include: { case: true, attachments: true },
      });

      // Get the updated case
      const updatedCase = await prisma.case.findUnique({
        where: { id: caseId },
      });

      // Log classification for audit
      await prisma.emailClassificationLog.create({
        data: {
          firmId: user.firmId,
          emailId: args.emailId,
          action: 'MANUAL_CLASSIFY',
          toCaseId: caseId,
          performedBy: user.id,
          correctionReason: 'Manual assignment from NECLAR queue',
        },
      });

      // Sync to CommunicationEntry for unified timeline
      try {
        await unifiedTimelineService.syncEmailToCommunicationEntry(args.emailId);
      } catch (syncError) {
        console.error('[classifyUncertainEmail] Failed to sync to timeline:', syncError);
      }

      return {
        email: updatedEmail,
        case: updatedCase,
        wasIgnored: false,
      };
    },

    // =========================================================================
    // Multi-Case Email Mutations (OPS-060)
    // =========================================================================

    /**
     * Link an email to an additional case
     * Creates a new EmailCaseLink for the email-case pair
     */
    linkEmailToCase: async (
      _: any,
      args: { emailId: string; caseId: string; isPrimary?: boolean },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify email exists and user has access
      const email = await prisma.email.findFirst({
        where: {
          id: args.emailId,
          firmId: user.firmId,
        },
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

      // Check if link already exists
      const existingLink = await prisma.emailCaseLink.findUnique({
        where: {
          emailId_caseId: {
            emailId: args.emailId,
            caseId: args.caseId,
          },
        },
      });

      if (existingLink) {
        throw new GraphQLError('Email is already linked to this case', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // If setting as primary, unset any existing primary links
      if (args.isPrimary) {
        await prisma.emailCaseLink.updateMany({
          where: { emailId: args.emailId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      // Create the new link
      const newLink = await prisma.emailCaseLink.create({
        data: {
          emailId: args.emailId,
          caseId: args.caseId,
          linkedBy: user.id,
          isPrimary: args.isPrimary ?? false,
          matchType: 'Manual', // Manual link
          confidence: 1.0, // User-assigned = 100% confidence
        },
        include: {
          email: true,
          case: true,
        },
      });

      // Update email classification state if it was pending/uncertain
      if (
        email.classificationState === EmailClassificationState.Pending ||
        email.classificationState === EmailClassificationState.Uncertain
      ) {
        await prisma.email.update({
          where: { id: args.emailId },
          data: {
            classificationState: EmailClassificationState.Classified,
            classifiedAt: new Date(),
            classifiedBy: user.id,
          },
        });
      }

      // Log the classification action
      await prisma.emailClassificationLog.create({
        data: {
          firmId: user.firmId,
          emailId: args.emailId,
          action: 'MANUAL_LINK',
          toCaseId: args.caseId,
          performedBy: user.id,
          correctionReason: `Manually linked to case via multi-case support`,
        },
      });

      // Sync to timeline
      try {
        await unifiedTimelineService.syncEmailToCommunicationEntry(args.emailId);
      } catch (syncError) {
        console.error('[linkEmailToCase] Failed to sync to timeline:', syncError);
      }

      return newLink;
    },

    /**
     * Remove an email from a case
     * Deletes the EmailCaseLink for the email-case pair
     */
    unlinkEmailFromCase: async (
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

      // Verify email exists and user has access
      const email = await prisma.email.findFirst({
        where: {
          id: args.emailId,
          firmId: user.firmId,
        },
      });

      if (!email) {
        throw new GraphQLError('Email not found', {
          extensions: { code: 'NOT_FOUND' },
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

      // Check if link exists
      const existingLink = await prisma.emailCaseLink.findUnique({
        where: {
          emailId_caseId: {
            emailId: args.emailId,
            caseId: args.caseId,
          },
        },
      });

      if (!existingLink) {
        throw new GraphQLError('Email is not linked to this case', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Delete the link
      await prisma.emailCaseLink.delete({
        where: {
          emailId_caseId: {
            emailId: args.emailId,
            caseId: args.caseId,
          },
        },
      });

      // If this was the primary link, promote another link to primary if exists
      if (existingLink.isPrimary) {
        const nextLink = await prisma.emailCaseLink.findFirst({
          where: { emailId: args.emailId },
          orderBy: { linkedAt: 'asc' },
        });
        if (nextLink) {
          await prisma.emailCaseLink.update({
            where: { id: nextLink.id },
            data: { isPrimary: true },
          });
        }
      }

      // Check if email still has any links - if not, update classification state
      const remainingLinks = await prisma.emailCaseLink.count({
        where: { emailId: args.emailId },
      });

      if (remainingLinks === 0 && !email.caseId) {
        // No more links and no legacy caseId - mark as Pending
        await prisma.email.update({
          where: { id: args.emailId },
          data: {
            classificationState: EmailClassificationState.Pending,
            classifiedAt: null,
            classifiedBy: null,
          },
        });
      }

      // Log the action
      await prisma.emailClassificationLog.create({
        data: {
          firmId: user.firmId,
          emailId: args.emailId,
          action: 'MANUAL_UNLINK',
          fromCaseId: args.caseId,
          performedBy: user.id,
          correctionReason: `Manually unlinked from case via multi-case support`,
        },
      });

      return true;
    },
  },

  Subscription: {
    emailReceived: {
      subscribe: () => pubsub.asyncIterableIterator([EMAIL_RECEIVED]),
    },
    emailSyncProgress: {
      subscribe: () => pubsub.asyncIterableIterator([EMAIL_SYNC_PROGRESS]),
    },
    emailCategorized: {
      subscribe: () => pubsub.asyncIterableIterator([EMAIL_CATEGORIZED]),
    },
  },

  // Type resolvers
  Email: {
    conversationId: (parent: any) => parent.conversationId || null,
    from: (parent: any) => parent.from || { address: '' },
    toRecipients: (parent: any) => parent.toRecipients || [],
    ccRecipients: (parent: any) => parent.ccRecipients || [],
    // OPS-091: Folder type - 'inbox' or 'sent'
    folderType: (parent: any) => parent.folderType || null,
    // OPS-035: Classification state fields - map from Prisma to GraphQL
    classificationState: (parent: any) => parent.classificationState || 'Pending',
    classificationConfidence: (parent: any) => parent.classificationConfidence || null,
    classifiedAt: (parent: any) => parent.classifiedAt || null,
    classifiedBy: (parent: any) => parent.classifiedBy || null,

    // =========================================================================
    // Multi-Case Support (OPS-060)
    // =========================================================================

    /**
     * Get all case links for this email with classification metadata
     */
    caseLinks: async (parent: any) => {
      if (parent.caseLinks) return parent.caseLinks;
      return await prisma.emailCaseLink.findMany({
        where: { emailId: parent.id },
        include: { case: true },
        orderBy: [{ isPrimary: 'desc' }, { linkedAt: 'asc' }],
      });
    },

    /**
     * Get all cases this email is linked to (convenience field)
     */
    cases: async (parent: any) => {
      const links = await prisma.emailCaseLink.findMany({
        where: { emailId: parent.id },
        include: { case: true },
        orderBy: [{ isPrimary: 'desc' }, { linkedAt: 'asc' }],
      });
      return links.map((l) => l.case);
    },

    /**
     * Get the primary case for this email (first/original assignment)
     */
    primaryCase: async (parent: any) => {
      // First check caseLinks for primary
      const primaryLink = await prisma.emailCaseLink.findFirst({
        where: { emailId: parent.id, isPrimary: true },
        include: { case: true },
      });
      if (primaryLink) return primaryLink.case;

      // Fallback: get any link (first by linkedAt)
      const anyLink = await prisma.emailCaseLink.findFirst({
        where: { emailId: parent.id },
        include: { case: true },
        orderBy: { linkedAt: 'asc' },
      });
      if (anyLink) return anyLink.case;

      // Legacy fallback: check direct caseId (during migration)
      if (parent.caseId) {
        if (parent.case) return parent.case;
        return await prisma.case.findUnique({ where: { id: parent.caseId } });
      }

      return null;
    },

    /**
     * @deprecated Use primaryCase instead. Kept for backwards compatibility.
     * Returns the primary case or falls back to legacy caseId
     */
    case: async (parent: any) => {
      // Try caseLinks first (new model)
      const primaryLink = await prisma.emailCaseLink.findFirst({
        where: { emailId: parent.id, isPrimary: true },
        include: { case: true },
      });
      if (primaryLink) return primaryLink.case;

      // Fallback to any link
      const anyLink = await prisma.emailCaseLink.findFirst({
        where: { emailId: parent.id },
        include: { case: true },
        orderBy: { linkedAt: 'asc' },
      });
      if (anyLink) return anyLink.case;

      // Legacy fallback: direct caseId (during migration period)
      if (!parent.caseId) return null;
      if (parent.case) return parent.case;
      return await prisma.case.findUnique({ where: { id: parent.caseId } });
    },

    attachments: async (parent: any, _args: any, context: Context) => {
      // OPS-128: Auto-sync attachments on case assignment
      // If email is assigned to a case, has attachments flag, but no EmailAttachment records,
      // trigger sync using user's access token. This implements "auto-sync on case assignment"
      // because sync happens automatically when viewing attachments for case-assigned emails.
      if (parent.hasAttachments && parent.caseId && context.user?.accessToken) {
        const existingAttachment = await prisma.emailAttachment.findFirst({
          where: { emailId: parent.id },
        });

        if (!existingAttachment) {
          try {
            logger.info('[Email.attachments] Auto-syncing attachments for case-assigned email', {
              emailId: parent.id,
              caseId: parent.caseId,
            });
            const attachmentService = getEmailAttachmentService(prisma);
            await attachmentService.syncAllAttachments(parent.id, context.user.accessToken);
          } catch (error) {
            logger.error('[Email.attachments] Auto-sync failed', {
              emailId: parent.id,
              error: error instanceof Error ? error.message : String(error),
            });
            // Don't fail the request - just return empty attachments
          }
        }
      }

      // OPS-113: Filter out dismissed attachments
      if (parent.attachments) {
        return parent.attachments.filter((a: any) => a.filterStatus !== 'dismissed');
      }
      return await prisma.emailAttachment.findMany({
        where: {
          emailId: parent.id,
          OR: [{ filterStatus: null }, { filterStatus: { not: 'dismissed' } }],
        },
      });
    },
    thread: async (parent: any, _args: any, context: Context) => {
      if (!context.user) return null;
      const threadService = getEmailThreadService(prisma);
      return await threadService.getThread(parent.conversationId, context.user.id);
    },
  },

  // EmailCaseLink type resolvers (OPS-060)
  EmailCaseLink: {
    email: async (parent: any) => {
      if (parent.email) return parent.email;
      return await prisma.email.findUnique({ where: { id: parent.emailId } });
    },
    case: async (parent: any) => {
      if (parent.case) return parent.case;
      return await prisma.case.findUnique({ where: { id: parent.caseId } });
    },
    // Map Prisma enum to GraphQL enum (same values, just for explicit mapping)
    matchType: (parent: any) => parent.matchType || null,
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
