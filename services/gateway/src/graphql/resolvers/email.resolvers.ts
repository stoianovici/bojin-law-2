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
import { queueHistoricalSyncJob } from '../../workers/historical-email-sync.worker';
import { activityEventService } from '../../services/activity-event.service';
import { requireAuth, type Context } from '../utils/auth';

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
// Privacy Filtering (Private-by-Default)
// ============================================================================

/**
 * Build a Prisma where clause for email privacy filtering based on user role.
 * - Partner/BusinessOwner: sees own emails (any) + public emails from others
 * - Associate: sees only public emails
 * - AssociateJr: sees public emails only on their cases (enforced at case level)
 *
 * @param userId - The current user's ID
 * @param userRole - The current user's role
 * @returns Prisma where clause for email privacy
 */
function buildEmailPrivacyFilter(userId: string, userRole: string): object {
  // Partners and BusinessOwners see their own emails (private or public)
  // plus all public emails from others
  if (userRole === 'Partner' || userRole === 'BusinessOwner') {
    return {
      OR: [
        { userId }, // Own emails (private or public)
        { isPrivate: false }, // Public emails from others
      ],
    };
  }

  // Associates see all public emails firm-wide
  // JRs see public emails too (case access is enforced elsewhere)
  return {
    isPrivate: false,
  };
}

// ============================================================================
// Background Attachment Sync
// ============================================================================

// Track users who have had sync triggered this session (to avoid repeated syncs)
const syncTriggeredForUser = new Set<string>();

/**
 * Sync missing attachments for classified emails in the background.
 * Only runs once per server restart per user to avoid repeated work.
 * Creates Document records and uploads to OneDrive for classified emails
 * that have hasAttachments=true but no attachment records.
 */
async function syncMissingAttachmentsBackground(
  userId: string,
  accessToken: string
): Promise<void> {
  // Skip if already triggered for this user (this server instance)
  if (syncTriggeredForUser.has(userId)) {
    return;
  }
  syncTriggeredForUser.add(userId);

  // Check Redis for recent sync (within last hour)
  const redisClient = getRedis();
  const syncKey = `attachment-sync:${userId}`;
  const lastSync = await redisClient.get(syncKey);
  if (lastSync) {
    logger.debug('[syncMissingAttachmentsBackground] Skipping - synced recently', { userId });
    return;
  }

  // Find classified OR client inbox emails with attachments but no attachment records
  // This mirrors the email folder structure - if email is at client level, attachments go there too
  const emailsMissingAttachments = await prisma.email.findMany({
    where: {
      userId,
      hasAttachments: true,
      classificationState: {
        in: ['Classified', 'ClientInbox'],
      },
      attachments: {
        none: {},
      },
    },
    select: { id: true, subject: true, classificationState: true },
    take: 50, // Limit to avoid overloading
  });

  if (emailsMissingAttachments.length === 0) {
    // Set Redis flag even if nothing to sync (to avoid repeated checks)
    await redisClient.setex(syncKey, 3600, 'done'); // 1 hour TTL
    return;
  }

  logger.info('[syncMissingAttachmentsBackground] Starting sync', {
    userId,
    emailCount: emailsMissingAttachments.length,
  });

  let synced = 0;
  let errors = 0;

  for (const email of emailsMissingAttachments) {
    try {
      const result = await emailAttachmentService.syncAllAttachments(email.id, accessToken);
      synced += result.attachmentsSynced;
    } catch (err) {
      errors++;
      logger.warn('[syncMissingAttachmentsBackground] Failed to sync email', {
        emailId: email.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Set Redis flag to avoid repeated syncs
  await redisClient.setex(syncKey, 3600, 'done'); // 1 hour TTL

  logger.info('[syncMissingAttachmentsBackground] Sync complete', {
    userId,
    emailsProcessed: emailsMissingAttachments.length,
    attachmentsSynced: synced,
    errors,
  });
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
  const senderEmail = (email.from?.address || email.from?.emailAddress?.address || '')
    .toLowerCase()
    .trim();

  if (!senderEmail) {
    return [];
  }

  // Query 1: Find cases where sender is an actor (case-insensitive via Prisma)
  const casesWithActor = await prisma.case.findMany({
    where: {
      firmId: user.firmId,
      status: { in: [CaseStatus.Active, CaseStatus.PendingApproval] },
      actors: { some: { email: { equals: senderEmail, mode: 'insensitive' } } },
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

  // Query 2: Find cases where client has an email (filter in JS for case-insensitivity)
  // Note: Prisma's JSON string_contains is case-sensitive, so we fetch all cases
  // with client emails and filter in JavaScript
  const casesWithClientEmail = await prisma.case.findMany({
    where: {
      firmId: user.firmId,
      status: { in: [CaseStatus.Active, CaseStatus.PendingApproval] },
      client: {
        contactInfo: {
          path: ['email'],
          not: { equals: null },
        },
      },
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

  // Filter cases where client email matches (case-insensitive)
  const matchingClientCases = casesWithClientEmail.filter((c) => {
    const clientEmail = (c.client.contactInfo as { email?: string })?.email;
    return clientEmail && clientEmail.toLowerCase().trim() === senderEmail;
  });

  // Merge results, avoiding duplicates (use Map keyed by case ID)
  const caseMap = new Map<string, (typeof casesWithActor)[0]>();
  for (const c of casesWithActor) {
    caseMap.set(c.id, c);
  }
  for (const c of matchingClientCases) {
    if (!caseMap.has(c.id)) {
      caseMap.set(c.id, c);
    }
  }

  const candidateCases = Array.from(caseMap.values());

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

      // Background sync: Check and sync missing attachments for classified emails
      // Runs once per session when user has access token
      if (user.accessToken) {
        syncMissingAttachmentsBackground(user.id, user.accessToken).catch((err) => {
          logger.error('[emailThreads] Background attachment sync failed', {
            error: err instanceof Error ? err.message : String(err),
          });
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

      console.log('[emailThread] Query called with conversationId:', args.conversationId);

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Use firmId instead of userId to allow viewing threads synced by other firm members
      const result = await emailThreadService.getThread(
        args.conversationId,
        user.firmId,
        user.accessToken // OPS-176: Pass access token for attachment sync
      );

      console.log(
        '[emailThread] Result:',
        result ? `Found thread with ${result.emails?.length} emails` : 'null'
      );

      return result;
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
          isIgnored: false, // Exclude emails marked as personal/ignored
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
          isIgnored: false, // Exclude emails marked as personal/ignored
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

    // ============================================================================
    // Email By Case Query (OPS-293)
    // ============================================================================

    /**
     * Get emails organized by case - the main email page query
     * Returns: cases with threads, unassigned, court emails, uncertain emails
     */
    emailsByCase: async (_: any, args: { limit?: number; offset?: number }, context: Context) => {
      const { user } = context;

      console.log('[emailsByCase] Starting query with user:', user?.id, user?.firmId, user?.email);

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Background sync: Check and sync missing attachments for classified emails
      // Runs once per session when user has access token
      if (user.accessToken) {
        syncMissingAttachmentsBackground(user.id, user.accessToken).catch((err) => {
          logger.error('[emailsByCase] Background attachment sync failed', {
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }

      const limit = args.limit || 50;
      const _offset = args.offset || 0;

      // 1. Get ALL active cases (not just those with emails) so newly created cases appear
      const allActiveCases = await prisma.case.findMany({
        where: {
          firmId: user.firmId,
          status: { in: [CaseStatus.Active, CaseStatus.PendingApproval] },
        },
        select: {
          id: true,
          title: true,
          caseNumber: true,
          clientId: true,
          client: {
            select: {
              id: true,
              name: true,
            },
          },
          emailLinks: {
            where: {
              email: {
                AND: [
                  { classificationState: EmailClassificationState.Classified },
                  // Privacy filter: users only see emails they have access to
                  buildEmailPrivacyFilter(user.id, user.role),
                ],
              },
            },
            select: {
              isPrimary: true,
              email: {
                select: {
                  id: true,
                  conversationId: true,
                  subject: true,
                  bodyPreview: true,
                  from: true,
                  receivedDateTime: true,
                  isRead: true,
                  hasAttachments: true,
                  isPrivate: true, // For UI indicator
                  userId: true, // To check ownership for UI actions
                  caseLinks: {
                    select: {
                      caseId: true,
                      isPrimary: true,
                      case: {
                        select: {
                          id: true,
                          title: true,
                          caseNumber: true,
                        },
                      },
                    },
                  },
                },
              },
            },
            orderBy: {
              email: {
                receivedDateTime: 'desc',
              },
            },
            take: limit,
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      // For backwards compatibility, filter to cases with emails for the casesWithEmails variable
      // but we'll merge all cases later
      const casesWithEmails = allActiveCases;

      console.log('[emailsByCase] Found cases:', casesWithEmails.length, 'cases');
      casesWithEmails.forEach((c) => {
        console.log('[emailsByCase] Case:', c.id, c.title, 'emailLinks:', c.emailLinks.length);
      });

      // Get all personal threads for this firm to filter and mark
      const personalThreads = await prisma.personalThread.findMany({
        where: { firmId: user.firmId },
        select: { conversationId: true, userId: true },
      });
      const personalThreadMap = new Map(
        personalThreads.map((pt) => [pt.conversationId, pt.userId])
      );

      // Transform cases to CaseWithThreads format
      // Group emails by conversationId to form threads
      const cases = casesWithEmails.map((caseData) => {
        const threadMap = new Map<string, any[]>();

        for (const link of caseData.emailLinks) {
          const email = link.email;
          const convId = email.conversationId || email.id;
          if (!threadMap.has(convId)) {
            threadMap.set(convId, []);
          }
          threadMap.get(convId)!.push({ ...email, isPrimary: link.isPrimary });
        }

        const threads = Array.from(threadMap.entries())
          .map(([convId, emails]) => {
            const lastEmail = emails[0]; // Already sorted by date desc
            const from = lastEmail.from as any;
            const personalMarkedBy = personalThreadMap.get(convId);
            const isPersonal = !!personalMarkedBy;

            return {
              id: convId,
              conversationId: convId,
              subject: lastEmail.subject,
              lastMessageDate: lastEmail.receivedDateTime,
              lastSenderName: from?.name || from?.emailAddress?.name || null,
              lastSenderEmail: from?.address || from?.emailAddress?.address || '',
              preview: lastEmail.bodyPreview || '',
              isUnread: emails.some((e: any) => !e.isRead),
              hasAttachments: emails.some((e: any) => e.hasAttachments),
              messageCount: emails.length,
              linkedCases: lastEmail.caseLinks.map((cl: any) => ({
                id: cl.case.id,
                title: cl.case.title,
                caseNumber: cl.case.caseNumber,
                isPrimary: cl.isPrimary,
              })),
              isPersonal,
              personalMarkedBy: personalMarkedBy || null,
              // Private-by-Default (OPS-191): Pass through for UI indicator
              isPrivate: lastEmail.isPrivate ?? false,
              userId: lastEmail.userId ?? null,
            };
          })
          // Filter out personal threads from other users
          .filter((thread) => {
            if (!thread.isPersonal) return true;
            // Show personal threads only to the user who marked them
            return thread.personalMarkedBy === user.id;
          });

        return {
          id: caseData.id,
          title: caseData.title,
          caseNumber: caseData.caseNumber,
          threads,
          unreadCount: threads.filter((t) => t.isUnread).length,
          totalCount: threads.length,
        };
      });

      // 2. Get unassigned emails (pending categorization, inbox only)
      // Only show inbox emails for triage - sent emails appear after case assignment
      const unassignedEmails = await prisma.email.findMany({
        where: {
          userId: user.id,
          firmId: user.firmId,
          classificationState: EmailClassificationState.Pending,
          isIgnored: false,
          caseLinks: { none: {} },
          parentFolderName: 'Inbox', // Only inbox emails for triage
        },
        select: {
          id: true,
          conversationId: true,
          subject: true,
          bodyPreview: true,
          from: true,
          receivedDateTime: true,
          isRead: true,
          hasAttachments: true,
        },
        orderBy: { receivedDateTime: 'desc' },
        take: limit,
      });

      let unassignedCase = null;
      if (unassignedEmails.length > 0) {
        // Group by conversationId
        const threadMap = new Map<string, any[]>();
        for (const email of unassignedEmails) {
          const convId = email.conversationId || email.id;
          if (!threadMap.has(convId)) {
            threadMap.set(convId, []);
          }
          threadMap.get(convId)!.push(email);
        }

        const threads = Array.from(threadMap.entries()).map(([convId, emails]) => {
          const lastEmail = emails[0];
          const from = lastEmail.from as any;
          return {
            id: convId,
            conversationId: convId,
            subject: lastEmail.subject,
            lastMessageDate: lastEmail.receivedDateTime,
            lastSenderName: from?.name || from?.emailAddress?.name || null,
            lastSenderEmail: from?.address || from?.emailAddress?.address || '',
            preview: lastEmail.bodyPreview || '',
            isUnread: emails.some((e: any) => !e.isRead),
            hasAttachments: emails.some((e: any) => e.hasAttachments),
            messageCount: emails.length,
            linkedCases: [],
          };
        });

        unassignedCase = {
          id: 'unassigned',
          title: 'Neatribuite',
          caseNumber: '',
          threads,
          unreadCount: threads.filter((t) => t.isUnread).length,
          totalCount: threads.length,
        };
      }

      // 3. Get court emails (INSTANȚE)
      const courtEmails = await prisma.email.findMany({
        where: {
          userId: user.id,
          firmId: user.firmId,
          classificationState: EmailClassificationState.CourtUnassigned,
        },
        select: {
          id: true,
          subject: true,
          from: true,
          bodyPreview: true,
          receivedDateTime: true,
          hasAttachments: true,
        },
        orderBy: { receivedDateTime: 'desc' },
        take: limit,
      });

      const courtEmailsCount = await prisma.email.count({
        where: {
          userId: user.id,
          firmId: user.firmId,
          classificationState: EmailClassificationState.CourtUnassigned,
        },
      });

      // 3b. Get GlobalEmailSources (courts) for grouping
      const courtSources = await prisma.globalEmailSource.findMany({
        where: {
          firmId: user.firmId,
          category: 'Court',
        },
        select: {
          id: true,
          name: true,
          domains: true,
          emails: true,
        },
      });

      // Helper to extract domain from email
      const extractDomainFromEmail = (email: string): string => {
        const parts = email.split('@');
        return parts.length > 1 ? parts[1].toLowerCase() : '';
      };

      // Match court emails to their sources
      const courtEmailGroupsMap = new Map<string, {
        id: string;
        name: string;
        emails: typeof courtEmails;
      }>();

      // Initialize an "Unknown Court" group for emails that don't match any source
      const unknownCourtId = 'unknown-court';
      courtEmailGroupsMap.set(unknownCourtId, {
        id: unknownCourtId,
        name: 'Alte instanțe',
        emails: [],
      });

      // Initialize groups for each court source
      for (const source of courtSources) {
        courtEmailGroupsMap.set(source.id, {
          id: source.id,
          name: source.name,
          emails: [],
        });
      }

      // Match each email to its court source
      for (const email of courtEmails) {
        const fromData = email.from as { address?: string; name?: string } | null;
        const senderEmail = fromData?.address?.toLowerCase() || '';
        const senderDomain = extractDomainFromEmail(senderEmail);

        let matchedSourceId = unknownCourtId;

        // Find matching source
        for (const source of courtSources) {
          const normalizedEmails = source.emails.map((e: string) => e.toLowerCase());
          const normalizedDomains = source.domains.map((d: string) => d.toLowerCase());

          if (normalizedEmails.includes(senderEmail) ||
              (senderDomain && normalizedDomains.includes(senderDomain))) {
            matchedSourceId = source.id;
            break;
          }
        }

        courtEmailGroupsMap.get(matchedSourceId)!.emails.push(email);
      }

      // Convert map to array and filter out empty groups
      const courtEmailGroups = Array.from(courtEmailGroupsMap.values())
        .filter(group => group.emails.length > 0)
        .map(group => ({
          id: group.id,
          name: group.name,
          count: group.emails.length,
          emails: group.emails.map(e => {
            const from = e.from as any;
            return {
              id: e.id,
              subject: e.subject,
              from: {
                name: from?.name || from?.emailAddress?.name || null,
                address: from?.address || from?.emailAddress?.address || '',
              },
              bodyPreview: e.bodyPreview,
              receivedDateTime: e.receivedDateTime,
              hasAttachments: e.hasAttachments,
              courtName: group.name,
              extractedCaseNumbers: [],
            };
          }),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      // 4. Get uncertain emails (NECLAR) - inbox only for triage
      const uncertainEmailsRaw = await prisma.email.findMany({
        where: {
          userId: user.id,
          firmId: user.firmId,
          classificationState: EmailClassificationState.Uncertain,
          parentFolderName: 'Inbox', // Only inbox emails for triage
          isIgnored: false, // Exclude emails marked as personal/ignored
        },
        select: {
          id: true,
          conversationId: true,
          subject: true,
          from: true,
          bodyPreview: true,
          bodyContent: true,
          receivedDateTime: true,
          hasAttachments: true,
        },
        orderBy: { receivedDateTime: 'desc' },
        take: limit,
      });

      const uncertainEmailsCount = await prisma.email.count({
        where: {
          userId: user.id,
          firmId: user.firmId,
          classificationState: EmailClassificationState.Uncertain,
          parentFolderName: 'Inbox', // Only inbox emails for triage
          isIgnored: false, // Exclude emails marked as personal/ignored
        },
      });

      // Get suggestions for uncertain emails
      const uncertainEmails = await Promise.all(
        uncertainEmailsRaw.map(async (email) => {
          const suggestions = await getSuggestedCasesForEmail(
            {
              id: email.id,
              subject: email.subject,
              from: email.from,
              bodyPreview: email.bodyPreview,
              bodyContent: email.bodyContent,
              receivedDateTime: email.receivedDateTime,
            },
            { id: user.id, firmId: user.firmId }
          );

          const from = email.from as any;
          return {
            id: email.id,
            conversationId: email.conversationId,
            subject: email.subject,
            from: {
              name: from?.name || from?.emailAddress?.name || null,
              address: from?.address || from?.emailAddress?.address || '',
            },
            bodyPreview: email.bodyPreview,
            receivedDateTime: email.receivedDateTime,
            hasAttachments: email.hasAttachments,
            suggestedCases: suggestions.slice(0, 3).map((s) => ({
              id: s.id,
              title: s.title,
              caseNumber: s.caseNumber,
              confidence: s.score / 100, // Convert 0-100 to 0-1
            })),
          };
        })
      );

      // 5. Get client inbox emails (ClientInbox state - multi-case clients awaiting assignment)
      const clientInboxEmails = await prisma.email.findMany({
        where: {
          userId: user.id,
          firmId: user.firmId,
          classificationState: EmailClassificationState.ClientInbox,
          isIgnored: false,
        },
        select: {
          id: true,
          conversationId: true,
          subject: true,
          bodyPreview: true,
          from: true,
          receivedDateTime: true,
          isRead: true,
          hasAttachments: true,
          clientId: true,
          isPrivate: true, // OPS-191: Private-by-Default
          userId: true, // OPS-191: For ownership check
        },
        orderBy: { receivedDateTime: 'desc' },
      });

      // Group client inbox emails by client
      const clientInboxMap = new Map<string, typeof clientInboxEmails>();
      for (const email of clientInboxEmails) {
        if (!email.clientId) continue;
        if (!clientInboxMap.has(email.clientId)) {
          clientInboxMap.set(email.clientId, []);
        }
        clientInboxMap.get(email.clientId)!.push(email);
      }

      // 6. Group cases by client (OPS-XXX: Client Grouping)
      const clientMap = new Map<
        string,
        {
          id: string;
          name: string;
          cases: typeof cases;
          inboxEmails: typeof clientInboxEmails;
        }
      >();

      // First, add all cases to their respective clients
      for (const caseItem of casesWithEmails) {
        const clientId = caseItem.clientId;
        const client = caseItem.client;

        if (!clientMap.has(clientId)) {
          clientMap.set(clientId, {
            id: clientId,
            name: client.name,
            cases: [],
            inboxEmails: clientInboxMap.get(clientId) || [],
          });
        }

        // Find the transformed case in the cases array
        const transformedCase = cases.find((c) => c.id === caseItem.id);
        if (transformedCase) {
          clientMap.get(clientId)!.cases.push(transformedCase);
        }
      }

      // Also include clients that only have inbox emails (no active cases with threads)
      for (const [clientId, inboxEmails] of clientInboxMap) {
        if (!clientMap.has(clientId) && inboxEmails.length > 0) {
          // Get client info
          const clientInfo = await prisma.client.findUnique({
            where: { id: clientId },
            select: { id: true, name: true },
          });
          if (clientInfo) {
            clientMap.set(clientId, {
              id: clientInfo.id,
              name: clientInfo.name,
              cases: [],
              inboxEmails,
            });
          }
        }
      }

      // Transform to ClientEmailGroup format
      const clients = Array.from(clientMap.values()).map((clientData) => {
        // Transform inbox emails to thread previews
        const inboxThreadMap = new Map<string, typeof clientInboxEmails>();
        for (const email of clientData.inboxEmails) {
          const convId = email.conversationId || email.id;
          if (!inboxThreadMap.has(convId)) {
            inboxThreadMap.set(convId, []);
          }
          inboxThreadMap.get(convId)!.push(email);
        }

        const inboxThreads = Array.from(inboxThreadMap.entries()).map(([convId, emails]) => {
          const lastEmail = emails[0];
          const from = lastEmail.from as any;
          const personalMarkedBy = personalThreadMap.get(convId);
          const isPersonal = !!personalMarkedBy;

          return {
            id: convId,
            conversationId: convId,
            subject: lastEmail.subject,
            lastMessageDate: lastEmail.receivedDateTime,
            lastSenderName: from?.name || from?.emailAddress?.name || null,
            lastSenderEmail: from?.address || from?.emailAddress?.address || '',
            preview: lastEmail.bodyPreview || '',
            isUnread: emails.some((e) => !e.isRead),
            hasAttachments: emails.some((e) => e.hasAttachments),
            messageCount: emails.length,
            linkedCases: [],
            isPersonal,
            personalMarkedBy: personalMarkedBy || null,
            // Private-by-Default (OPS-191): Pass through for UI indicator
            isPrivate: lastEmail.isPrivate ?? false,
            userId: lastEmail.userId ?? null,
          };
        });

        // Calculate totals
        const totalUnreadCount = clientData.cases.reduce((sum, c) => sum + c.unreadCount, 0);
        const totalCount = clientData.cases.reduce((sum, c) => sum + c.totalCount, 0);

        return {
          id: clientData.id,
          name: clientData.name,
          inboxThreads,
          inboxUnreadCount: inboxThreads.filter((t) => t.isUnread).length,
          inboxTotalCount: inboxThreads.length,
          cases: clientData.cases,
          totalUnreadCount,
          totalCount,
        };
      });

      // Sort clients by name
      clients.sort((a, b) => a.name.localeCompare(b.name));

      console.log('[emailsByCase] Final result:', {
        clientsCount: clients.length,
        casesCount: cases.length,
        unassignedCase: unassignedCase ? 'yes' : 'no',
        courtEmailsCount,
        uncertainEmailsCount,
      });

      return {
        clients,
        cases,
        unassignedCase,
        courtEmails: courtEmails.map((e) => {
          const from = e.from as any;
          // Find court name for this email
          const senderEmail = (from?.address || from?.emailAddress?.address || '').toLowerCase();
          const senderDomain = extractDomainFromEmail(senderEmail);
          let courtName: string | null = null;
          for (const source of courtSources) {
            const normalizedEmails = source.emails.map((em: string) => em.toLowerCase());
            const normalizedDomains = source.domains.map((d: string) => d.toLowerCase());
            if (normalizedEmails.includes(senderEmail) ||
                (senderDomain && normalizedDomains.includes(senderDomain))) {
              courtName = source.name;
              break;
            }
          }
          return {
            id: e.id,
            subject: e.subject,
            from: {
              name: from?.name || from?.emailAddress?.name || null,
              address: from?.address || from?.emailAddress?.address || '',
            },
            bodyPreview: e.bodyPreview,
            receivedDateTime: e.receivedDateTime,
            hasAttachments: e.hasAttachments,
            courtName,
            extractedCaseNumbers: [],
          };
        }),
        courtEmailsCount,
        courtEmailGroups,
        uncertainEmails,
        uncertainEmailsCount,
      };
    },

    // ============================================================================
    // Historical Email Sync Queries
    // ============================================================================

    historicalEmailSyncStatus: async (
      _: unknown,
      { caseId }: { caseId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Verify user can access the case
      const caseData = await prisma.case.findUnique({
        where: { id: caseId },
        select: { firmId: true },
      });

      if (!caseData || caseData.firmId !== user.firmId) {
        throw new GraphQLError('Case not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Get all sync jobs for this case
      const jobs = await prisma.historicalEmailSyncJob.findMany({
        where: { caseId },
        orderBy: { createdAt: 'desc' },
      });

      return jobs;
    },

    // ============================================================================
    // Client Inbox Queries (Multi-Case Client Support)
    // ============================================================================

    /**
     * Get clients with emails in their inbox awaiting case assignment
     * Returns clients who have active cases and emails with ClientInbox state
     */
    clientsWithEmailInbox: async (_: unknown, _args: unknown, context: Context) => {
      const user = requireAuth(context);

      // Find all clients with ClientInbox emails for this user
      const clientsWithInboxEmails = await prisma.email.groupBy({
        by: ['clientId'],
        where: {
          userId: user.id,
          firmId: user.firmId,
          classificationState: EmailClassificationState.ClientInbox,
          clientId: { not: null },
        },
        _count: { id: true },
      });

      if (clientsWithInboxEmails.length === 0) {
        return [];
      }

      // Get client details and their active cases
      const clientIds = clientsWithInboxEmails
        .map((c) => c.clientId)
        .filter((id): id is string => id !== null);

      const clients = await prisma.client.findMany({
        where: {
          id: { in: clientIds },
          firmId: user.firmId,
        },
        select: {
          id: true,
          name: true,
          cases: {
            where: {
              status: { in: [CaseStatus.Active, CaseStatus.PendingApproval] },
            },
            select: {
              id: true,
              caseNumber: true,
              title: true,
            },
          },
        },
      });

      // Get unread counts for each client
      const unreadCounts = await prisma.email.groupBy({
        by: ['clientId'],
        where: {
          userId: user.id,
          firmId: user.firmId,
          classificationState: EmailClassificationState.ClientInbox,
          clientId: { in: clientIds },
          isRead: false,
        },
        _count: { id: true },
      });

      const unreadMap = new Map(unreadCounts.map((c) => [c.clientId, c._count.id]));
      const totalMap = new Map(clientsWithInboxEmails.map((c) => [c.clientId, c._count.id]));

      return clients.map((client) => ({
        id: client.id,
        name: client.name,
        activeCasesCount: client.cases.length,
        activeCases: client.cases.map((c) => ({
          id: c.id,
          caseNumber: c.caseNumber,
          title: c.title,
        })),
        unreadCount: unreadMap.get(client.id) || 0,
        totalCount: totalMap.get(client.id) || 0,
      }));
    },

    /**
     * Get emails in a client's inbox awaiting case assignment
     */
    clientInboxEmails: async (
      _: unknown,
      args: { clientId: string; limit?: number; offset?: number },
      context: Context
    ) => {
      const user = requireAuth(context);
      const { clientId, limit = 50, offset = 0 } = args;

      // Get client info with active cases
      const client = await prisma.client.findFirst({
        where: {
          id: clientId,
          firmId: user.firmId,
        },
        select: {
          id: true,
          name: true,
          cases: {
            where: {
              status: { in: [CaseStatus.Active, CaseStatus.PendingApproval] },
            },
            select: {
              id: true,
              caseNumber: true,
              title: true,
            },
          },
        },
      });

      if (!client) {
        throw new GraphQLError('Client not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Get emails for this client in ClientInbox state
      const emails = await prisma.email.findMany({
        where: {
          userId: user.id,
          firmId: user.firmId,
          clientId,
          classificationState: EmailClassificationState.ClientInbox,
        },
        orderBy: { receivedDateTime: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          conversationId: true,
          subject: true,
          from: true,
          bodyPreview: true,
          receivedDateTime: true,
          isRead: true,
          hasAttachments: true,
        },
      });

      // Group by conversationId to form threads
      const threadMap = new Map<string, typeof emails>();
      for (const email of emails) {
        const convId = email.conversationId || email.id;
        if (!threadMap.has(convId)) {
          threadMap.set(convId, []);
        }
        threadMap.get(convId)!.push(email);
      }

      // Build thread previews
      const threads = Array.from(threadMap.entries()).map(([conversationId, threadEmails]) => {
        const lastEmail = threadEmails[0]; // Already sorted by receivedDateTime desc
        const from = lastEmail.from as { name?: string; address: string };

        return {
          id: conversationId,
          conversationId,
          subject: lastEmail.subject,
          lastMessageDate: lastEmail.receivedDateTime,
          lastSenderName: from.name || null,
          lastSenderEmail: from.address,
          preview: lastEmail.bodyPreview?.substring(0, 200) || '',
          isUnread: threadEmails.some((e) => !e.isRead),
          hasAttachments: threadEmails.some((e) => e.hasAttachments),
          messageCount: threadEmails.length,
        };
      });

      // Get total count for pagination
      const totalCount = await prisma.email.count({
        where: {
          userId: user.id,
          firmId: user.firmId,
          clientId,
          classificationState: EmailClassificationState.ClientInbox,
        },
      });

      // Get unread count for this client
      const unreadCount = await prisma.email.count({
        where: {
          userId: user.id,
          firmId: user.firmId,
          clientId,
          classificationState: EmailClassificationState.ClientInbox,
          isRead: false,
        },
      });

      return {
        client: {
          id: client.id,
          name: client.name,
          activeCasesCount: client.cases.length,
          activeCases: client.cases.map((c) => ({
            id: c.id,
            caseNumber: c.caseNumber,
            title: c.title,
          })),
          unreadCount,
          totalCount,
        },
        threads,
        totalCount: threads.length,
      };
    },

    // ============================================================================
    // Outlook Folder Queries (OPS-292) - DEPRECATED
    // ============================================================================

    /**
     * @deprecated Use emailsByCase instead.
     * Get emails grouped by Outlook folder
     * Returns only folders containing unassigned, non-ignored emails
     * Excludes system folders: Drafts, Deleted Items, Junk Email
     */
    emailsByFolder: async (_: any, _args: any, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // System folders to exclude
      const excludedFolders = ['Drafts', 'Deleted Items', 'Junk Email', 'Outbox'];

      // Get all unassigned, non-ignored emails with folder info
      // Note: groupBy doesn't support relation filtering, so we query first then aggregate
      const unassignedEmails = await prisma.email.findMany({
        where: {
          userId: user.id,
          firmId: user.firmId,
          isIgnored: false,
          // Check for unassigned - no EmailCaseLink records
          caseLinks: {
            none: {},
          },
          parentFolderName: {
            notIn: excludedFolders,
            not: null,
          },
        },
        select: {
          parentFolderId: true,
          parentFolderName: true,
          isRead: true,
        },
      });

      // Aggregate by folder
      const folderMap = new Map<
        string,
        { id: string; name: string; total: number; unread: number }
      >();

      for (const email of unassignedEmails) {
        if (!email.parentFolderName || !email.parentFolderId) continue;

        const existing = folderMap.get(email.parentFolderName);
        if (existing) {
          existing.total++;
          if (!email.isRead) existing.unread++;
        } else {
          folderMap.set(email.parentFolderName, {
            id: email.parentFolderId,
            name: email.parentFolderName,
            total: 1,
            unread: email.isRead ? 0 : 1,
          });
        }
      }

      // Transform to OutlookFolder type and sort by email count descending
      const folders = Array.from(folderMap.values())
        .map((folder) => ({
          id: folder.id,
          name: folder.name,
          emailCount: folder.total,
          unreadCount: folder.unread,
        }))
        .sort((a, b) => b.emailCount - a.emailCount);

      return folders;
    },
  },

  // ============================================================================
  // OutlookFolder Field Resolvers (OPS-292)
  // ============================================================================

  OutlookFolder: {
    /**
     * Resolve emails for a specific folder with pagination
     */
    emails: async (
      parent: { id: string; name: string },
      args: { limit?: number; offset?: number },
      context: Context
    ) => {
      const { user } = context;

      if (!user) {
        return [];
      }

      const limit = args.limit || 20;
      const offset = args.offset || 0;

      const emails = await prisma.email.findMany({
        where: {
          userId: user.id,
          firmId: user.firmId,
          parentFolderName: parent.name,
          isIgnored: false,
          caseLinks: {
            none: {},
          },
        },
        orderBy: {
          receivedDateTime: 'desc',
        },
        take: limit,
        skip: offset,
        include: {
          attachments: true,
        },
      });

      return emails;
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

      // OPS-XXX: Partner/BusinessOwner emails are private by default when assigned to a case
      const isPartnerOwner = user.role === 'Partner' || user.role === 'BusinessOwner';

      // Update email
      const updatedEmail = await prisma.email.update({
        where: { id: args.emailId },
        data: {
          caseId: args.caseId,
          classificationState: 'Classified',
          classifiedAt: new Date(),
          classifiedBy: user.id,
          // Partner/BusinessOwner emails are private by default
          ...(isPartnerOwner && {
            isPrivate: true,
            markedPrivateBy: user.id,
          }),
        },
        include: { case: true, attachments: true },
      });

      // Sync to CommunicationEntry for unified timeline (Story 5.5)
      try {
        await unifiedTimelineService.syncEmailToCommunicationEntry(args.emailId);
      } catch (syncError) {
        console.error('[assignEmailToCase] Failed to sync to timeline:', syncError);
        // Don't fail the assignment if sync fails - email is still assigned
      }

      // OPS-116: Emit EMAIL_CLASSIFIED event
      activityEventService
        .emit({
          userId: user.id,
          firmId: user.firmId,
          eventType: 'EMAIL_CLASSIFIED',
          entityType: 'EMAIL',
          entityId: args.emailId,
          entityTitle: email.subject || 'Email clasificat',
          metadata: {
            caseId: args.caseId,
            caseNumber: updatedEmail.case?.caseNumber,
          },
        })
        .catch((err) => console.error('[assignEmailToCase] Failed to emit event:', err));

      // Sync attachments now that email is classified
      if (user.accessToken && email.hasAttachments) {
        const emailAttachmentService = getEmailAttachmentService(prisma);
        emailAttachmentService
          .syncAllAttachments(args.emailId, user.accessToken)
          .catch((err) =>
            logger.error('[assignEmailToCase] Failed to sync attachments:', {
              emailId: args.emailId,
              error: err instanceof Error ? err.message : String(err),
            })
          );
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
      // OPS-XXX: Pass user role for privacy-by-default
      const assignResult = await emailThreadService.assignThreadToCase(
        args.conversationId,
        args.caseId,
        user.id,
        { userId: user.id, firmId: user.firmId, userRole: user.role }
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
      } else {
        // Fallback: Link existing attachments to case even without accessToken
        // This ensures documents appear in /documents even if we can't download new attachments
        logger.info(
          '[assignThreadToCase] No accessToken - attempting to link existing attachments',
          {
            conversationId: args.conversationId,
            caseId: args.caseId,
          }
        );

        try {
          // Find all emails in the thread
          const threadEmails = await prisma.email.findMany({
            where: {
              conversationId: args.conversationId,
              userId: user.id,
            },
            select: { id: true },
          });

          // Find all attachments with documents that aren't linked to this case yet
          const attachmentsWithDocs = await prisma.emailAttachment.findMany({
            where: {
              emailId: { in: threadEmails.map((e) => e.id) },
              documentId: { not: null },
              filterStatus: { not: 'dismissed' },
            },
            select: {
              id: true,
              documentId: true,
              document: {
                select: { id: true, firmId: true },
              },
            },
          });

          let linkedCount = 0;
          for (const attachment of attachmentsWithDocs) {
            if (!attachment.documentId || !attachment.document) continue;

            // Check if CaseDocument link already exists
            const existingLink = await prisma.caseDocument.findFirst({
              where: {
                documentId: attachment.documentId,
                caseId: args.caseId,
              },
            });

            if (!existingLink) {
              // Create CaseDocument link
              try {
                await prisma.caseDocument.create({
                  data: {
                    caseId: args.caseId,
                    documentId: attachment.documentId,
                    linkedBy: user.id,
                    firmId: attachment.document.firmId,
                    isOriginal: true,
                  },
                });
                linkedCount++;
                logger.info('[assignThreadToCase] Linked existing attachment to case', {
                  attachmentId: attachment.id,
                  documentId: attachment.documentId,
                  caseId: args.caseId,
                });
              } catch (linkError) {
                // Might fail if link was created concurrently, ignore
                logger.warn('[assignThreadToCase] Failed to link attachment (may already exist)', {
                  attachmentId: attachment.id,
                  error: linkError instanceof Error ? linkError.message : String(linkError),
                });
              }
            }
          }

          logger.info('[assignThreadToCase] Linked existing attachments without accessToken', {
            conversationId: args.conversationId,
            caseId: args.caseId,
            attachmentsFound: attachmentsWithDocs.length,
            linkedCount,
          });
        } catch (linkError) {
          logger.error('[assignThreadToCase] Failed to link existing attachments', {
            conversationId: args.conversationId,
            error: linkError instanceof Error ? linkError.message : String(linkError),
          });
          // Don't fail the assignment
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
     * Assign a client inbox email thread to a case
     * Used when multi-case client's email needs manual case assignment
     */
    assignClientInboxToCase: async (
      _: any,
      args: { conversationId: string; caseId: string },
      context: Context
    ) => {
      const user = requireAuth(context);
      const { conversationId, caseId } = args;

      // Verify case access
      const caseAccess = await prisma.caseTeam.findFirst({
        where: { caseId, userId: user.id },
      });

      if (!caseAccess) {
        throw new GraphQLError('Case not found or access denied', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Get the case to verify it belongs to the expected client
      const targetCase = await prisma.case.findUnique({
        where: { id: caseId },
        select: { clientId: true },
      });

      if (!targetCase) {
        throw new GraphQLError('Case not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Get client inbox emails for this conversation
      const clientInboxEmails = await prisma.email.findMany({
        where: {
          conversationId,
          userId: user.id,
          firmId: user.firmId,
          classificationState: EmailClassificationState.ClientInbox,
        },
        select: { id: true, clientId: true, from: true },
      });

      if (clientInboxEmails.length === 0) {
        throw new GraphQLError('No client inbox emails found for this conversation', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Verify emails belong to the same client as the target case
      const emailClientId = clientInboxEmails[0].clientId;
      if (emailClientId !== targetCase.clientId) {
        throw new GraphQLError('Email client does not match case client', {
          extensions: { code: 'BAD_REQUEST' },
        });
      }

      // Assign thread using existing service (reuse assignThreadToCase logic)
      const assignResult = await emailThreadService.assignThreadToCase(
        conversationId,
        caseId,
        user.id,
        { userId: user.id, firmId: user.firmId }
      );

      // Update classification state from ClientInbox to Classified
      await prisma.email.updateMany({
        where: {
          conversationId,
          userId: user.id,
          firmId: user.firmId,
          classificationState: EmailClassificationState.ClientInbox,
        },
        data: {
          classificationState: EmailClassificationState.Classified,
          caseId,
          clientId: null, // Clear client inbox reference
          classifiedAt: new Date(),
          classifiedBy: user.id,
        },
      });

      // Sync to unified timeline
      try {
        const threadEmails = await prisma.email.findMany({
          where: { conversationId, userId: user.id },
          select: { id: true },
        });
        await Promise.all(
          threadEmails.map((e) => unifiedTimelineService.syncEmailToCommunicationEntry(e.id))
        );
      } catch (syncError) {
        logger.error('[assignClientInboxToCase] Failed to sync to timeline:', syncError);
      }

      // Sync attachments now that emails are classified
      if (user.accessToken) {
        try {
          const emailsWithAttachments = await prisma.email.findMany({
            where: {
              conversationId,
              userId: user.id,
              hasAttachments: true,
            },
            select: { id: true },
          });

          const emailAttachmentService = getEmailAttachmentService(prisma);
          for (const email of emailsWithAttachments) {
            await emailAttachmentService
              .syncAllAttachments(email.id, user.accessToken!)
              .catch((err) =>
                logger.error('[assignClientInboxToCase] Failed to sync attachments:', {
                  emailId: email.id,
                  error: err instanceof Error ? err.message : String(err),
                })
              );
          }
        } catch (syncError) {
          logger.error('[assignClientInboxToCase] Failed to sync attachments:', {
            conversationId,
            error: syncError instanceof Error ? syncError.message : String(syncError),
          });
        }
      }

      // Get updated thread for response
      const thread = await emailThreadService.getThread(conversationId, user.id);

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
     * OPS-291: Backfill folder info for existing emails
     * Updates emails that don't have parentFolderName yet with their Outlook folder info
     */
    backfillEmailFolderInfo: async (_: any, _args: any, context: Context) => {
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

      if (!user.accessToken) {
        throw new GraphQLError('Microsoft account connection required for folder backfill', {
          extensions: { code: 'MS_TOKEN_REQUIRED' },
        });
      }

      const result = await emailSyncService.backfillFolderInfo(user.id, user.accessToken);

      if (!result.success) {
        throw new GraphQLError(result.error || 'Failed to backfill folder info', {
          extensions: { code: 'INTERNAL_ERROR' },
        });
      }

      return result.updated;
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

      const { to, cc, subject, body, isHtml, caseId, attachments: _attachments } = args.input;

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

      // Sync attachments now that email is classified
      if (user.accessToken && email.hasAttachments) {
        const emailAttachmentService = getEmailAttachmentService(prisma);
        emailAttachmentService
          .syncAllAttachments(args.emailId, user.accessToken)
          .catch((err) =>
            logger.error('[assignCourtEmailToCase] Failed to sync attachments:', {
              emailId: args.emailId,
              error: err instanceof Error ? err.message : String(err),
            })
          );
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

      // Sync attachments now that email is classified
      if (user.accessToken && email.hasAttachments) {
        const emailAttachmentService = getEmailAttachmentService(prisma);
        emailAttachmentService
          .syncAllAttachments(args.emailId, user.accessToken)
          .catch((err) =>
            logger.error('[classifyUncertainEmail] Failed to sync attachments:', {
              emailId: args.emailId,
              error: err instanceof Error ? err.message : String(err),
            })
          );
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

      // OPS-116: Emit EMAIL_CLASSIFIED event
      activityEventService
        .emit({
          userId: user.id,
          firmId: user.firmId,
          eventType: 'EMAIL_CLASSIFIED',
          entityType: 'EMAIL',
          entityId: args.emailId,
          entityTitle: email.subject || 'Email clasificat',
          metadata: {
            caseId: args.caseId,
            caseNumber: newLink.case?.caseNumber,
          },
        })
        .catch((err) => console.error('[linkEmailToCase] Failed to emit event:', err));

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
          user: { select: { role: true } },
        },
      });

      if (!email) {
        throw new GraphQLError('Email not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // OPS-XXX: Check if email owner is a Partner for private-by-default
      const isPartnerOwner = email.user?.role === 'Partner' || email.user?.role === 'BusinessOwner';

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
        // Case 1: Confirming existing link - link already exists, just mark reassigned
        confirmedLink = await prisma.emailCaseLink.findUnique({
          where: { id: existingLink.id },
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

        // Create new primary link
        confirmedLink = await prisma.emailCaseLink.create({
          data: {
            emailId: args.emailId,
            caseId: args.caseId,
            isPrimary: true,
            linkedBy: user.id,
            confidence: 1.0,
          },
          include: {
            email: true,
            case: true,
          },
        });

        // Update email's primary caseId for backward compatibility
        // OPS-XXX: Partner's classified emails are private by default
        await prisma.email.update({
          where: { id: args.emailId },
          data: {
            caseId: args.caseId,
            ...(isPartnerOwner && { isPrivate: true }),
          },
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
    // Privacy Actions (Private-by-Default)
    // =========================================================================

    /**
     * Make a private email public (visible to team).
     * Only the email owner (Partner/BusinessOwner) can make their emails public.
     */
    markEmailPublic: async (_: any, args: { emailId: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Only Partners/BusinessOwners can make emails public
      if (user.role !== 'Partner' && user.role !== 'BusinessOwner') {
        throw new GraphQLError('Only Partners can make emails public', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Verify email exists and user owns it
      const email = await prisma.email.findFirst({
        where: {
          id: args.emailId,
          firmId: user.firmId,
          userId: user.id, // Must be own email
        },
      });

      if (!email) {
        throw new GraphQLError('Email not found or you do not own this email', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Already public - return as-is
      if (!email.isPrivate) {
        return email;
      }

      // Make public
      const updatedEmail = await prisma.email.update({
        where: { id: args.emailId },
        data: {
          isPrivate: false,
          markedPublicAt: new Date(),
          markedPublicBy: user.id,
        },
      });

      logger.info('[markEmailPublic] Email made public', {
        emailId: args.emailId,
        userId: user.id,
      });

      // OPS-191: Notify team members that an email was made public
      try {
        // Get all team members in the same firm (except the current user)
        const teamMembers = await prisma.user.findMany({
          where: {
            firmId: user.firmId,
            id: { not: user.id },
            status: 'Active',
          },
          select: { id: true },
        });

        if (teamMembers.length > 0) {
          // Create notifications for each team member
          await prisma.notification.createMany({
            data: teamMembers.map((member) => ({
              userId: member.id,
              type: 'EmailMadePublic',
              title: 'Email făcut public',
              message: `${user.name || user.email} a făcut public un email: "${email.subject?.substring(0, 50) || 'Fără subiect'}${email.subject && email.subject.length > 50 ? '...' : ''}"`,
              link: `/email?conversationId=${email.conversationId}`,
            })),
          });

          logger.info('[markEmailPublic] Notifications sent to team members', {
            emailId: args.emailId,
            notifiedCount: teamMembers.length,
          });
        }
      } catch (notificationError) {
        // Don't fail the main operation if notification fails
        logger.error('[markEmailPublic] Failed to send notifications', {
          emailId: args.emailId,
          error: notificationError,
        });
      }

      return updatedEmail;
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
          status: DocumentStatus.DRAFT,
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

      if (user.role !== 'Partner' && user.role !== 'BusinessOwner') {
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

      if (user.role !== 'Partner' && user.role !== 'BusinessOwner') {
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

      if (user.role !== 'Partner' && user.role !== 'BusinessOwner') {
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

      if (user.role !== 'Partner' && user.role !== 'BusinessOwner') {
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

    // ============================================================================
    // Attachment Privacy Mutations (Private-by-Default)
    // ============================================================================

    /**
     * Make an attachment public (visible to team)
     * Only the email owner can make their attachments public
     */
    markAttachmentPublic: async (_: any, args: { attachmentId: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Only Partners/BusinessOwners can toggle attachment privacy
      if (user.role !== 'Partner' && user.role !== 'BusinessOwner') {
        throw new GraphQLError('Only Partners can modify attachment privacy', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Get attachment with parent email to verify ownership
      const attachment = await prisma.emailAttachment.findFirst({
        where: { id: args.attachmentId },
        include: {
          email: {
            select: {
              userId: true,
              firmId: true,
            },
          },
        },
      });

      if (!attachment) {
        throw new GraphQLError('Attachment not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Verify ownership
      if (attachment.email.firmId !== user.firmId || attachment.email.userId !== user.id) {
        throw new GraphQLError('You can only modify privacy of your own attachments', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Already public - return as-is
      if (!attachment.isPrivate) {
        return attachment;
      }

      // Make public
      const updatedAttachment = await prisma.emailAttachment.update({
        where: { id: args.attachmentId },
        data: {
          isPrivate: false,
          markedPublicAt: new Date(),
          markedPublicBy: user.id,
        },
      });

      logger.info('[markAttachmentPublic] Attachment made public', {
        attachmentId: args.attachmentId,
        userId: user.id,
      });

      return updatedAttachment;
    },

    /**
     * Make an attachment private (only visible to owner)
     * Only the email owner can make their attachments private
     */
    markAttachmentPrivate: async (_: any, args: { attachmentId: string }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Only Partners/BusinessOwners can toggle attachment privacy
      if (user.role !== 'Partner' && user.role !== 'BusinessOwner') {
        throw new GraphQLError('Only Partners can modify attachment privacy', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Get attachment with parent email to verify ownership
      const attachment = await prisma.emailAttachment.findFirst({
        where: { id: args.attachmentId },
        include: {
          email: {
            select: {
              userId: true,
              firmId: true,
            },
          },
        },
      });

      if (!attachment) {
        throw new GraphQLError('Attachment not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Verify ownership
      if (attachment.email.firmId !== user.firmId || attachment.email.userId !== user.id) {
        throw new GraphQLError('You can only modify privacy of your own attachments', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Already private - return as-is
      if (attachment.isPrivate) {
        return attachment;
      }

      // Make private
      const updatedAttachment = await prisma.emailAttachment.update({
        where: { id: args.attachmentId },
        data: {
          isPrivate: true,
          markedPublicAt: null,
          markedPublicBy: null,
        },
      });

      logger.info('[markAttachmentPrivate] Attachment made private', {
        attachmentId: args.attachmentId,
        userId: user.id,
      });

      return updatedAttachment;
    },

    // ============================================================================
    // Historical Email Sync Mutations
    // ============================================================================

    triggerHistoricalEmailSync: async (
      _: unknown,
      { caseId, contactEmail }: { caseId: string; contactEmail: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      if (!context.user?.accessToken) {
        throw new GraphQLError('Microsoft access token required for email sync', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify user can access the case
      const caseData = await prisma.case.findUnique({
        where: { id: caseId },
        select: { firmId: true },
      });

      if (!caseData || caseData.firmId !== user.firmId) {
        throw new GraphQLError('Case not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contactEmail)) {
        throw new GraphQLError('Invalid email address format', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Queue the sync job
      const job = await queueHistoricalSyncJob({
        caseId,
        contactEmail: contactEmail.toLowerCase(),
        accessToken: context.user.accessToken,
        userId: user.id,
      });

      // Return the job status
      const dbJob = await prisma.historicalEmailSyncJob.findUnique({
        where: { id: job.data.jobId },
      });

      if (!dbJob) {
        throw new GraphQLError('Failed to create sync job', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      return dbJob;
    },

    /**
     * Backfill hasAttachments field from Graph API
     * This fixes emails that had hasAttachments incorrectly set to false
     */
    backfillEmailAttachments: async (_: any, _args: any, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      if (!user.accessToken) {
        throw new GraphQLError('Microsoft account connection required', {
          extensions: { code: 'MS_TOKEN_REQUIRED' },
        });
      }

      logger.info(`[backfillEmailAttachments] Starting backfill for user: ${user.id}`);

      // Get Graph client with user's token
      const client = graphService.getAuthenticatedClient(user.accessToken);

      // Get all emails for this user
      const emails = await prisma.email.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          graphMessageId: true,
          hasAttachments: true,
        },
      });

      logger.info(`[backfillEmailAttachments] Processing ${emails.length} emails`);

      let updated = 0;
      let errors = 0;
      let notFound = 0;

      // Process in batches of 5 to avoid rate limiting
      const BATCH_SIZE = 5;
      for (let i = 0; i < emails.length; i += BATCH_SIZE) {
        const batch = emails.slice(i, i + BATCH_SIZE);

        const results = await Promise.allSettled(
          batch.map(async (email) => {
            try {
              const message = await client
                .api(`/me/messages/${email.graphMessageId}`)
                .select('id,hasAttachments')
                .get();

              if (message.hasAttachments !== email.hasAttachments) {
                await prisma.email.update({
                  where: { id: email.id },
                  data: { hasAttachments: message.hasAttachments },
                });
                return { updated: true, hasAttachments: message.hasAttachments };
              }
              return { updated: false };
            } catch (err: any) {
              if (err.statusCode === 404) {
                return { notFound: true };
              }
              throw err;
            }
          })
        );

        for (const result of results) {
          if (result.status === 'fulfilled') {
            if (result.value.updated) updated++;
            if (result.value.notFound) notFound++;
          } else {
            errors++;
            logger.error('[backfillEmailAttachments] Error:', result.reason);
          }
        }

        // Log progress every 50 emails
        if ((i + BATCH_SIZE) % 50 === 0 || i + BATCH_SIZE >= emails.length) {
          logger.info(
            `[backfillEmailAttachments] Progress: ${Math.min(i + BATCH_SIZE, emails.length)}/${emails.length}`
          );
        }
      }

      logger.info(
        `[backfillEmailAttachments] Complete - Updated: ${updated}, NotFound: ${notFound}, Errors: ${errors}`
      );

      return {
        success: true,
        totalProcessed: emails.length,
        updated,
        notFound,
        errors,
      };
    },

    /**
     * Sync missing email attachments for classified emails.
     * Processes emails that have hasAttachments=true but no attachment records.
     * Creates Document records and uploads to OneDrive.
     */
    syncMissingEmailAttachments: async (_: any, _args: any, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      if (!user.accessToken) {
        throw new GraphQLError('Microsoft account connection required', {
          extensions: { code: 'MS_TOKEN_REQUIRED' },
        });
      }

      logger.info(`[syncMissingEmailAttachments] Starting for user: ${user.id}`);

      // Find classified emails with attachments
      const emailsWithAttachments = await prisma.email.findMany({
        where: {
          userId: user.id,
          hasAttachments: true,
          classificationState: 'Classified',
        },
        select: {
          id: true,
          subject: true,
          _count: {
            select: { attachments: true },
          },
        },
      });

      logger.info(
        `[syncMissingEmailAttachments] Found ${emailsWithAttachments.length} classified emails with attachments`
      );

      // Filter to emails missing attachment records
      const emailsMissingAttachments = emailsWithAttachments.filter(
        (e) => e._count.attachments === 0
      );

      logger.info(
        `[syncMissingEmailAttachments] ${emailsMissingAttachments.length} emails missing attachment records`
      );

      let attachmentsSynced = 0;
      let documentsCreated = 0;
      let errors = 0;

      const emailAttachmentService = getEmailAttachmentService(prisma);

      // Process each email
      for (const email of emailsMissingAttachments) {
        try {
          logger.info(`[syncMissingEmailAttachments] Syncing: "${email.subject?.substring(0, 50)}..."`);

          const result = await emailAttachmentService.syncAllAttachments(
            email.id,
            user.accessToken!
          );

          attachmentsSynced += result.attachmentsSynced;
          // Count documents created (attachments with documentId set)
          documentsCreated += result.attachments.filter((a) => a.documentId).length;

          logger.info(`[syncMissingEmailAttachments] Synced ${result.attachmentsSynced} attachments for email`);
        } catch (err) {
          errors++;
          logger.error('[syncMissingEmailAttachments] Error syncing email', {
            emailId: email.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      logger.info(
        `[syncMissingEmailAttachments] Complete - Synced: ${attachmentsSynced}, Documents: ${documentsCreated}, Errors: ${errors}`
      );

      return {
        success: errors === 0,
        emailsWithAttachments: emailsWithAttachments.length,
        emailsMissingAttachments: emailsMissingAttachments.length,
        attachmentsSynced,
        documentsCreated,
        errors,
      };
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
     * Private-by-Default: Whether this attachment is private
     */
    isPrivate: (parent: any) => parent.isPrivate ?? false,

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
