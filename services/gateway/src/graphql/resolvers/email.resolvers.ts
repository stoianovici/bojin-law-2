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
import { getEmailSyncService } from '../../services/email-sync.service';
import { getEmailThreadService } from '../../services/email-thread.service';
import { getEmailSearchService } from '../../services/email-search.service';
import { getEmailAttachmentService } from '../../services/email-attachment.service';
import { EmailWebhookService } from '../../services/email-webhook.service';
import { triggerProcessing } from '../../workers/email-categorization.worker';
import { unifiedTimelineService } from '../../services/unified-timeline.service';
import { emailCleanerService } from '../../services/email-cleaner.service';
import { classificationScoringService } from '../../services/classification-scoring';
import {
  CaseStatus,
  EmailClassificationState,
  DocumentStatus,
  SentEmailSource,
} from '@prisma/client';
import { GraphService } from '../../services/graph.service';
import { graphConfig } from '../../config/graph.config';
import Redis from 'ioredis';
import { oneDriveService } from '../../services/onedrive.service';
import { r2StorageService } from '../../services/r2-storage.service';
import { sharePointService } from '../../services/sharepoint.service';
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
const graphService = new GraphService();

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

      // OPS-177: Enhanced logging for pagination debugging
      const requestedLimit = args.limit || 20;
      const requestedOffset = args.offset || 0;
      console.log('[emailThreads] Query:', {
        userId: user.id,
        filters: JSON.stringify(args.filters),
        limit: requestedLimit,
        offset: requestedOffset,
      });

      try {
        // First, check how many emails exist for this user
        const emailCount = await prisma.email.count({ where: { userId: user.id } });
        console.log('[emailThreads] Email count for user:', emailCount);

        const result = await emailThreadService.getThreads(filters, {
          limit: requestedLimit,
          offset: requestedOffset,
        });

        // OPS-177: Log unique cases in the result for debugging
        const uniqueCases = new Set(result?.threads?.map((t: any) => t.caseId).filter(Boolean));
        console.log('[emailThreads] Result:', {
          threads: result?.threads?.length,
          totalCount: result?.totalCount,
          uniqueCases: uniqueCases.size,
          limit: requestedLimit,
          offset: requestedOffset,
        });

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
     * OPS-176: Pass access token for auto-sync of attachments
     */
    emailThread: async (_: any, args: { conversationId: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return await emailThreadService.getThread(
        args.conversationId,
        user.id,
        user.accessToken // OPS-176: Pass access token for attachment sync
      );
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

      // Fallback to R2 for attachments stored directly (not yet saved as documents)
      // This handles email attachments synced to R2 before being saved to a case
      if (attachment.storageUrl?.startsWith('r2://')) {
        const r2Path = attachment.storageUrl.replace('r2://', '');
        const presignedUrl = await r2StorageService.getPresignedUrl(r2Path);
        if (presignedUrl) {
          // For browser-previewable types (PDF, images), return direct URL
          if (browserPreviewableTypes.includes(attachment.contentType)) {
            logger.debug('Using R2 presigned URL for unsaved attachment preview', {
              attachmentId: args.attachmentId,
              contentType: attachment.contentType,
              storagePath: r2Path,
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
            logger.debug('Using Office Online viewer with R2 URL for unsaved attachment', {
              attachmentId: args.attachmentId,
              contentType: attachment.contentType,
              storagePath: r2Path,
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
        hasStorageUrl: !!attachment.storageUrl,
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
          conversationId: true, // OPS-200: For thread view loading
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
            conversationId: email.conversationId, // OPS-200: For thread view loading
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
        // Build recipients for graphService.sendMail()
        const toRecipients = to.map((address) => ({
          emailAddress: { address },
        }));

        const ccRecipients = cc
          ? cc.map((address) => ({
              emailAddress: { address },
            }))
          : undefined;

        // OPS-281: Use graphService.sendMail() which respects EMAIL_SEND_MODE
        // In draft mode, this creates a draft in Outlook and returns the draftId
        // In send mode, this sends immediately and returns empty object
        const result = await graphService.sendMail(user.accessToken, {
          subject,
          body: {
            contentType: isHtml ? 'HTML' : 'Text',
            content: body,
          },
          toRecipients,
          ccRecipients,
        });

        // OPS-281: Track the draft/sent email for audit purposes
        if (result.draftId) {
          await prisma.sentEmailDraft.create({
            data: {
              outlookDraftId: result.draftId,
              userId: user.id,
              firmId: user.firmId,
              recipientEmail: to[0], // Primary recipient
              subject,
              caseId: caseId || null,
              source: SentEmailSource.NEW_EMAIL,
            },
          });
        }

        const isDraftMode = graphConfig.emailSendMode === 'draft';
        return {
          success: true,
          messageId: null,
          outlookDraftId: result.draftId || null,
          // Include mode info for frontend messaging
          ...(isDraftMode && { savedToDrafts: true }),
        };
      } catch (error: any) {
        console.error('[sendNewEmail] Error:', error);
        return {
          success: false,
          error: error.message || 'Failed to send email',
          outlookDraftId: null,
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

      const { conversationId, to, cc, subject, body, isHtml, includeOriginal } = args.input;

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
          include: {
            // OPS-281: Get case links to track caseId in SentEmailDraft
            caseLinks: {
              where: { isPrimary: true },
              take: 1,
            },
          },
        });

        if (!lastEmail) {
          return {
            success: false,
            error: 'Thread not found',
            outlookDraftId: null,
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

        // Build recipients for graphService.sendMail()
        const toRecipients = to.map((address) => ({
          emailAddress: { address },
        }));

        const ccRecipients = cc
          ? cc.map((address) => ({
              emailAddress: { address },
            }))
          : undefined;

        // OPS-281: Use graphService.sendMail() which respects EMAIL_SEND_MODE
        // In draft mode, this creates a draft in Outlook and returns the draftId
        // In send mode, this sends immediately and returns empty object
        const result = await graphService.sendMail(user.accessToken, {
          subject,
          body: {
            contentType: isHtml ? 'HTML' : 'Text',
            content: replyBody,
          },
          toRecipients,
          ccRecipients,
        });

        // OPS-281: Track the draft/sent email for audit purposes
        if (result.draftId) {
          const primaryCaseId = lastEmail.caseLinks[0]?.caseId || null;
          await prisma.sentEmailDraft.create({
            data: {
              outlookDraftId: result.draftId,
              userId: user.id,
              firmId: user.firmId,
              recipientEmail: to[0], // Primary recipient
              subject,
              caseId: primaryCaseId,
              source: SentEmailSource.REPLY,
            },
          });
        }

        const isDraftMode = graphConfig.emailSendMode === 'draft';
        return {
          success: true,
          messageId: null,
          outlookDraftId: result.draftId || null,
          // Include mode info for frontend messaging
          ...(isDraftMode && { savedToDrafts: true }),
        };
      } catch (error: any) {
        console.error('[replyToEmail] Error:', error);
        return {
          success: false,
          error: error.message || 'Failed to send reply',
          outlookDraftId: null,
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

    // =========================================================================
    // Multi-Case Confirmation (OPS-195)
    // =========================================================================

    /**
     * Confirm or reassign an email's case assignment
     * Used when sender has multiple active cases - user confirms which case the email belongs to
     */
    confirmEmailAssignment: async (
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
        include: {
          caseLinks: true,
        },
      });

      if (!email) {
        throw new GraphQLError('Email not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Verify user has access to target case
      const caseAccess = await prisma.case.findFirst({
        where: {
          id: args.caseId,
          firmId: user.firmId,
          teamMembers: {
            some: { userId: user.id },
          },
        },
      });

      if (!caseAccess) {
        throw new GraphQLError('Case not found or access denied', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Check if email is already linked to target case
      const existingLink = email.caseLinks.find((link) => link.caseId === args.caseId);
      const currentPrimaryLink = email.caseLinks.find((link) => link.isPrimary);

      let wasReassigned = false;
      let confirmedLink;

      if (existingLink) {
        // Case 1: Confirming existing link - just update isConfirmed
        confirmedLink = await prisma.emailCaseLink.update({
          where: { id: existingLink.id },
          data: {
            isConfirmed: true,
            confirmedAt: new Date(),
            confirmedBy: user.id,
          },
          include: {
            email: true,
            case: true,
          },
        });
        wasReassigned = false;
      } else {
        // Case 2: Reassigning to different case - create new primary link
        // First, demote current primary to non-primary if exists
        if (currentPrimaryLink) {
          await prisma.emailCaseLink.update({
            where: { id: currentPrimaryLink.id },
            data: { isPrimary: false },
          });
        }

        // Create new confirmed primary link
        confirmedLink = await prisma.emailCaseLink.create({
          data: {
            emailId: args.emailId,
            caseId: args.caseId,
            isPrimary: true,
            linkedBy: user.id,
            isConfirmed: true,
            confirmedAt: new Date(),
            confirmedBy: user.id,
            needsConfirmation: false, // No longer needs confirmation since user just confirmed
            confidence: 1.0,
          },
          include: {
            email: true,
            case: true,
          },
        });

        // Update email's primary caseId for backward compatibility
        await prisma.email.update({
          where: { id: args.emailId },
          data: { caseId: args.caseId },
        });

        wasReassigned = true;
      }

      // Log the confirmation action
      await prisma.emailClassificationLog.create({
        data: {
          firmId: user.firmId,
          emailId: args.emailId,
          action: wasReassigned ? 'MANUAL_REASSIGN' : 'CONFIRMED',
          fromCaseId: wasReassigned ? currentPrimaryLink?.caseId : undefined,
          toCaseId: args.caseId,
          performedBy: user.id,
          correctionReason: wasReassigned
            ? 'Reassigned via multi-case confirmation flow'
            : 'Confirmed via multi-case confirmation flow',
        },
      });

      // Sync to timeline if reassigned
      if (wasReassigned) {
        try {
          await unifiedTimelineService.syncEmailToCommunicationEntry(args.emailId);
        } catch (syncError) {
          console.error('[confirmEmailAssignment] Failed to sync to timeline:', syncError);
        }
      }

      // Fetch updated email
      const updatedEmail = await prisma.email.findUnique({
        where: { id: args.emailId },
        include: {
          caseLinks: {
            include: {
              case: true,
            },
          },
        },
      });

      return {
        email: updatedEmail,
        caseLink: confirmedLink,
        wasReassigned,
      };
    },

    // =========================================================================
    // Attachment Actions (OPS-135)
    // =========================================================================

    /**
     * Save an email attachment as a case document
     * Creates Document record, uploads to SharePoint, links to case.
     * Returns existing document if attachment was already saved.
     */
    saveEmailAttachmentAsDocument: async (
      _: any,
      args: { emailId: string; attachmentId: string; caseId: string; folderId?: string },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      if (!user.accessToken) {
        throw new GraphQLError('Microsoft account connection required to save attachment', {
          extensions: { code: 'MS_TOKEN_REQUIRED' },
        });
      }

      // Verify email exists and user has access (via firm membership)
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

      // OPS-197: Block attachment save for unassigned emails (NECLAR queue)
      // Emails must be assigned to a case before attachments can be saved
      if (email.classificationState === 'Uncertain') {
        throw new GraphQLError(
          'Emailul trebuie atribuit unui dosar înainte de a salva atașamentele.',
          {
            extensions: { code: 'EMAIL_NOT_ASSIGNED' },
          }
        );
      }

      // Verify case access
      const caseAccess = await prisma.caseTeam.findFirst({
        where: { caseId: args.caseId, userId: user.id },
        include: {
          case: {
            select: { id: true, caseNumber: true, clientId: true, firmId: true },
          },
        },
      });

      if (!caseAccess) {
        throw new GraphQLError('Case not found or access denied', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Get attachment
      const attachment = await prisma.emailAttachment.findUnique({
        where: { id: args.attachmentId },
        include: { document: true },
      });

      if (!attachment || attachment.emailId !== args.emailId) {
        throw new GraphQLError('Attachment not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Check if already saved as document
      if (attachment.documentId && attachment.document) {
        // OPS-175: Find the caseDocumentId for the existing document
        const existingCaseDoc = await prisma.caseDocument.findFirst({
          where: {
            documentId: attachment.documentId,
            caseId: args.caseId,
          },
        });

        logger.info('[saveEmailAttachmentAsDocument] Attachment already saved as document', {
          attachmentId: args.attachmentId,
          documentId: attachment.documentId,
          caseDocumentId: existingCaseDoc?.id,
        });
        return {
          document: attachment.document,
          isNew: false,
          caseDocumentId: existingCaseDoc?.id || null,
        };
      }

      // Fetch attachment content from MS Graph
      logger.info('[saveEmailAttachmentAsDocument] Fetching attachment from MS Graph', {
        emailId: args.emailId,
        attachmentId: args.attachmentId,
        graphAttachmentId: attachment.graphAttachmentId,
      });

      const content = await emailAttachmentService.getAttachmentContentFromGraph(
        email.graphMessageId,
        attachment.graphAttachmentId,
        user.accessToken
      );

      // Upload to SharePoint
      logger.info('[saveEmailAttachmentAsDocument] Uploading to SharePoint', {
        caseNumber: caseAccess.case.caseNumber,
        fileName: attachment.name,
        fileSize: attachment.size,
      });

      const sharePointItem = await sharePointService.uploadDocument(
        user.accessToken,
        caseAccess.case.caseNumber,
        attachment.name,
        content,
        attachment.contentType
      );

      // Create Document record
      const document = await prisma.document.create({
        data: {
          clientId: caseAccess.case.clientId,
          firmId: caseAccess.case.firmId,
          fileName: attachment.name,
          fileType: attachment.contentType,
          fileSize: attachment.size,
          storagePath: sharePointItem.parentPath + '/' + attachment.name,
          uploadedBy: user.id,
          sharePointItemId: sharePointItem.id,
          sharePointPath: sharePointItem.parentPath + '/' + attachment.name,
          status: DocumentStatus.FINAL,
          metadata: {
            source: 'email_attachment',
            category: 'Email Attachment',
            emailId: args.emailId,
            originalAttachmentId: args.attachmentId,
          },
        },
      });

      // Link document to case via CaseDocument junction table
      // OPS-175: Capture caseDocument.id for return
      const caseDocument = await prisma.caseDocument.create({
        data: {
          caseId: args.caseId,
          documentId: document.id,
          linkedBy: user.id,
          firmId: caseAccess.case.firmId,
          isOriginal: true,
          ...(args.folderId && { folderId: args.folderId }),
        },
      });

      // Update EmailAttachment with document reference
      await prisma.emailAttachment.update({
        where: { id: args.attachmentId },
        data: { documentId: document.id },
      });

      logger.info('[saveEmailAttachmentAsDocument] Successfully saved attachment as document', {
        attachmentId: args.attachmentId,
        documentId: document.id,
        caseDocumentId: caseDocument.id,
        caseId: args.caseId,
        sharePointId: sharePointItem.id,
      });

      return {
        document,
        isNew: true,
        caseDocumentId: caseDocument.id,
      };
    },

    // =========================================================================
    // Attachment Filtering (OPS-136)
    // =========================================================================

    /**
     * Mark an email attachment as irrelevant (or restore it)
     * OPS-136: Used for filtering out signatures, logos, etc.
     */
    markAttachmentIrrelevant: async (
      _: any,
      args: { attachmentId: string; irrelevant: boolean },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Get attachment with email to verify access
      const attachment = await prisma.emailAttachment.findUnique({
        where: { id: args.attachmentId },
        include: {
          email: {
            select: {
              id: true,
              firmId: true,
              caseId: true,
              caseLinks: { select: { caseId: true } },
            },
          },
        },
      });

      if (!attachment) {
        throw new GraphQLError('Attachment not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Verify user has access (via firm membership)
      if (attachment.email.firmId !== user.firmId) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // If attachment is linked to a case, verify case access
      const caseIds = [
        attachment.email.caseId,
        ...attachment.email.caseLinks.map((link) => link.caseId),
      ].filter(Boolean) as string[];

      if (caseIds.length > 0) {
        const hasAccess = await prisma.caseTeam.findFirst({
          where: {
            userId: user.id,
            caseId: { in: caseIds },
          },
        });

        if (!hasAccess) {
          throw new GraphQLError('Not authorized to modify this attachment', {
            extensions: { code: 'FORBIDDEN' },
          });
        }
      }

      // Update the irrelevant flag
      const updatedAttachment = await prisma.emailAttachment.update({
        where: { id: args.attachmentId },
        data: { irrelevant: args.irrelevant },
        include: { document: true },
      });

      logger.info('[markAttachmentIrrelevant] Attachment marked', {
        attachmentId: args.attachmentId,
        irrelevant: args.irrelevant,
        userId: user.id,
      });

      return updatedAttachment;
    },

    // =========================================================================
    // Partner Privacy (OPS-191)
    // =========================================================================

    /**
     * Mark an email as private (Partner only)
     * Private emails are hidden from case details but visible to marking partner
     */
    markEmailPrivate: async (_: any, args: { emailId: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      if (user.role !== 'Partner') {
        throw new GraphQLError('Only partners can mark emails as private', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Verify email exists and belongs to user's firm
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

      // Mark as private
      const updatedEmail = await prisma.email.update({
        where: { id: args.emailId },
        data: {
          isPrivate: true,
          markedPrivateBy: user.id,
          markedPrivateAt: new Date(),
        },
        include: { case: true, attachments: true },
      });

      logger.info('[markEmailPrivate] Email marked as private', {
        emailId: args.emailId,
        userId: user.id,
      });

      return updatedEmail;
    },

    /**
     * Restore a private email to normal visibility
     * Only the partner who marked it can unmark it
     */
    unmarkEmailPrivate: async (_: any, args: { emailId: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      if (user.role !== 'Partner') {
        throw new GraphQLError('Only partners can manage email privacy', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Verify email exists and belongs to user's firm
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

      // Only the partner who marked it can unmark it
      if (email.isPrivate && email.markedPrivateBy !== user.id) {
        throw new GraphQLError('Only the partner who marked this email as private can restore it', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Unmark as private
      const updatedEmail = await prisma.email.update({
        where: { id: args.emailId },
        data: {
          isPrivate: false,
          markedPrivateBy: null,
          markedPrivateAt: null,
        },
        include: { case: true, attachments: true },
      });

      logger.info('[unmarkEmailPrivate] Email unmarked as private', {
        emailId: args.emailId,
        userId: user.id,
      });

      return updatedEmail;
    },

    /**
     * Mark all emails in a thread as private (Partner only)
     */
    markThreadPrivate: async (_: any, args: { conversationId: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      if (user.role !== 'Partner') {
        throw new GraphQLError('Only partners can mark emails as private', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Get all emails in the thread belonging to user's firm
      const emails = await prisma.email.findMany({
        where: {
          conversationId: args.conversationId,
          firmId: user.firmId,
        },
      });

      if (emails.length === 0) {
        throw new GraphQLError('No emails found in thread', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Mark all as private in a transaction
      const updatedEmails = await prisma.$transaction(
        emails.map((email) =>
          prisma.email.update({
            where: { id: email.id },
            data: {
              isPrivate: true,
              markedPrivateBy: user.id,
              markedPrivateAt: new Date(),
            },
            include: { case: true, attachments: true },
          })
        )
      );

      logger.info('[markThreadPrivate] Thread marked as private', {
        conversationId: args.conversationId,
        userId: user.id,
        emailCount: updatedEmails.length,
      });

      return updatedEmails;
    },

    /**
     * Restore all private emails in a thread
     * Only emails marked by the current user will be restored
     */
    unmarkThreadPrivate: async (_: any, args: { conversationId: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      if (user.role !== 'Partner') {
        throw new GraphQLError('Only partners can manage email privacy', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Get all emails in the thread that this user marked as private
      const emails = await prisma.email.findMany({
        where: {
          conversationId: args.conversationId,
          firmId: user.firmId,
          isPrivate: true,
          markedPrivateBy: user.id,
        },
      });

      if (emails.length === 0) {
        // Return all emails in thread (none were marked by this user)
        const allEmails = await prisma.email.findMany({
          where: {
            conversationId: args.conversationId,
            firmId: user.firmId,
          },
          include: { case: true, attachments: true },
        });
        return allEmails;
      }

      // Unmark all in a transaction
      const updatedEmails = await prisma.$transaction(
        emails.map((email) =>
          prisma.email.update({
            where: { id: email.id },
            data: {
              isPrivate: false,
              markedPrivateBy: null,
              markedPrivateAt: null,
            },
            include: { case: true, attachments: true },
          })
        )
      );

      logger.info('[unmarkThreadPrivate] Thread unmarked as private', {
        conversationId: args.conversationId,
        userId: user.id,
        emailCount: updatedEmails.length,
      });

      // Return all emails in thread (including those that weren't modified)
      const allEmails = await prisma.email.findMany({
        where: {
          conversationId: args.conversationId,
          firmId: user.firmId,
        },
        include: { case: true, attachments: true },
      });

      return allEmails;
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
    // Partner Privacy (OPS-191)
    // =========================================================================
    isPrivate: (parent: any) => parent.isPrivate ?? false,
    markedPrivateBy: (parent: any) => parent.markedPrivateBy || null,
    markedPrivateAt: (parent: any) => parent.markedPrivateAt || null,

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
      // OPS-128: Auto-sync attachments when viewing emails
      // OPS-176: Extended to auto-sync ALL emails with hasAttachments=true, not just case-assigned
      // Note: Primary auto-sync now happens in EmailThreadService.getThread() for efficiency
      // This resolver handles edge cases where emails are queried directly (not via thread)
      if (parent.hasAttachments && context.user?.accessToken) {
        const existingAttachment = await prisma.emailAttachment.findFirst({
          where: { emailId: parent.id },
        });

        if (!existingAttachment) {
          try {
            logger.info('[Email.attachments] Auto-syncing attachments for email', {
              emailId: parent.id,
              caseId: parent.caseId || 'unassigned',
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
      // OPS-136: Filter out irrelevant attachments by default
      if (parent.attachments) {
        return parent.attachments.filter(
          (a: any) => a.filterStatus !== 'dismissed' && !a.irrelevant
        );
      }
      return await prisma.emailAttachment.findMany({
        where: {
          emailId: parent.id,
          irrelevant: false,
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
    /**
     * Alias for 'document' field - returns the saved document if this attachment
     * was saved as a case document via saveEmailAttachmentAsDocument mutation
     */
    savedAsDocument: async (parent: any) => {
      if (!parent.documentId) return null;
      return await prisma.document.findUnique({ where: { id: parent.documentId } });
    },
    /**
     * Whether user marked this attachment as irrelevant (OPS-136)
     */
    irrelevant: (parent: any) => parent.irrelevant ?? false,

    /**
     * OPS-175: Whether this attachment has been promoted to a working document
     */
    isPromoted: async (parent: any) => {
      if (!parent.documentId) return false;
      const document = await prisma.document.findUnique({
        where: { id: parent.documentId },
        select: { metadata: true },
      });
      if (!document) return false;
      const metadata = document.metadata as Record<string, any> | null;
      return Boolean(metadata?.promotedToDocumentId);
    },

    /**
     * OPS-175: ID of the promoted working document (if isPromoted is true)
     */
    promotedDocumentId: async (parent: any) => {
      if (!parent.documentId) return null;
      const document = await prisma.document.findUnique({
        where: { id: parent.documentId },
        select: { metadata: true },
      });
      if (!document) return null;
      const metadata = document.metadata as Record<string, any> | null;
      return metadata?.promotedToDocumentId || null;
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
