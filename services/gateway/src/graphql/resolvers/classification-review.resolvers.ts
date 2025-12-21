/**
 * Classification Review Resolvers
 * OPS-031: Classification Review & Correction
 *
 * GraphQL resolvers for review queue, email reassignment, and audit trail.
 */

import { prisma, CaseActorRole } from '@legal-platform/database';
import { caseActivityService } from '../../services/case-activity.service';
import { caseSummaryService } from '../../services/case-summary.service';
import { unifiedTimelineService } from '../../services/unified-timeline.service';
import logger from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

// Using string literals for enums that are defined in Prisma schema
// These match the enum values in schema.prisma
type ClassificationAction = 'Assigned' | 'Moved' | 'Ignored' | 'Unassigned';
type ClassificationMatchType =
  | 'Actor'
  | 'ReferenceNumber'
  | 'Keyword'
  | 'Semantic'
  | 'GlobalSource'
  | 'Manual';
type ClassificationReason =
  | 'MultiCaseConflict'
  | 'LowConfidence'
  | 'NoMatchingCase'
  | 'CourtNoReference'
  | 'UnknownContact';

interface Context {
  user?: {
    id: string;
    firmId: string;
    role: 'Partner' | 'Associate' | 'Paralegal' | 'BusinessOwner';
    email: string;
    accessToken?: string;
  };
}

interface ClassificationQueueFilter {
  clientId?: string;
  reason?: ClassificationReason;
  createdAfter?: Date;
  createdBefore?: Date;
}

interface MoveEmailInput {
  emailId: string;
  toCaseId: string;
  reason?: string;
  moveAttachments?: boolean;
  addSenderAsActor?: boolean;
}

interface BulkAssignEmailsInput {
  emailIds: string[];
  caseId: string;
  reason?: string;
}

interface IgnoreEmailInput {
  emailId: string;
  reason?: string;
}

// ============================================================================
// Query Resolvers
// ============================================================================

export const classificationReviewQueryResolvers = {
  /**
   * Get emails pending classification review
   */
  classificationQueue: async (
    _: unknown,
    {
      filter,
      limit = 50,
      offset = 0,
    }: { filter?: ClassificationQueueFilter; limit?: number; offset?: number },
    context: Context
  ) => {
    const firmId = context.user?.firmId;
    if (!firmId) throw new Error('Authentication required');

    const where: any = {
      firmId,
      isResolved: false,
    };

    if (filter?.reason) {
      where.reason = filter.reason;
    }

    if (filter?.createdAfter) {
      where.createdAt = { ...where.createdAt, gte: filter.createdAfter };
    }

    if (filter?.createdBefore) {
      where.createdAt = { ...where.createdAt, lte: filter.createdBefore };
    }

    // Client filter requires join
    if (filter?.clientId) {
      where.email = {
        case: {
          clientId: filter.clientId,
        },
      };
    }

    const [items, total] = await Promise.all([
      prisma.pendingClassification.findMany({
        where,
        include: {
          email: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.pendingClassification.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        email: item.email,
        reason: item.reason,
        suggestedCases: item.suggestedCases as any[],
        detectedReferences: item.detectedReferences,
        createdAt: item.createdAt,
      })),
      total,
      hasMore: offset + items.length < total,
    };
  },

  /**
   * Get pending classification count for badge display
   */
  pendingClassificationCount: async (_: unknown, __: unknown, context: Context) => {
    const firmId = context.user?.firmId;
    if (!firmId) throw new Error('Authentication required');

    return prisma.pendingClassification.count({
      where: {
        firmId,
        isResolved: false,
      },
    });
  },

  /**
   * Get classification history for a specific email
   */
  emailClassificationHistory: async (
    _: unknown,
    { emailId }: { emailId: string },
    context: Context
  ) => {
    const firmId = context.user?.firmId;
    if (!firmId) throw new Error('Authentication required');

    const email = await prisma.email.findFirst({
      where: { id: emailId, firmId },
    });

    if (!email) throw new Error('Email not found');

    const logs = await prisma.emailClassificationLog.findMany({
      where: { emailId, firmId },
      include: {
        fromCase: true,
        toCase: true,
        user: true,
      },
      orderBy: { performedAt: 'desc' },
    });

    return {
      email,
      logs,
    };
  },

  /**
   * Get classification activity for a case (emails moved in/out)
   */
  caseClassificationActivity: async (
    _: unknown,
    { caseId, limit = 20 }: { caseId: string; limit?: number },
    context: Context
  ) => {
    const firmId = context.user?.firmId;
    if (!firmId) throw new Error('Authentication required');

    const caseRecord = await prisma.case.findFirst({
      where: { id: caseId, firmId },
    });

    if (!caseRecord) throw new Error('Case not found');

    const [movedIn, movedOut] = await Promise.all([
      prisma.emailClassificationLog.findMany({
        where: {
          toCaseId: caseId,
          firmId,
          action: { in: ['Assigned', 'Moved'] },
        },
        include: {
          email: true,
          fromCase: true,
          user: true,
        },
        orderBy: { performedAt: 'desc' },
        take: limit,
      }),
      prisma.emailClassificationLog.findMany({
        where: {
          fromCaseId: caseId,
          firmId,
          action: { in: ['Moved', 'Unassigned'] },
        },
        include: {
          email: true,
          toCase: true,
          user: true,
        },
        orderBy: { performedAt: 'desc' },
        take: limit,
      }),
    ]);

    return {
      case: caseRecord,
      movedIn,
      movedOut,
    };
  },

  /**
   * Get classification statistics for dashboard
   */
  classificationStats: async (
    _: unknown,
    { period }: { period: 'DAY' | 'WEEK' | 'MONTH' | 'QUARTER' },
    context: Context
  ) => {
    const firmId = context.user?.firmId;
    if (!firmId) throw new Error('Authentication required');

    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'DAY':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'WEEK':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'MONTH':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'QUARTER':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
    }

    const [autoClassified, manuallyReviewed, movedAfterImport, pendingReview] = await Promise.all([
      // Auto-classified (wasAutomatic = true)
      prisma.emailClassificationLog.count({
        where: {
          firmId,
          performedAt: { gte: startDate },
          action: 'Assigned',
          wasAutomatic: true,
        },
      }),
      // Manually reviewed (wasAutomatic = false, action = Assigned)
      prisma.emailClassificationLog.count({
        where: {
          firmId,
          performedAt: { gte: startDate },
          action: 'Assigned',
          wasAutomatic: false,
        },
      }),
      // Moved after import
      prisma.emailClassificationLog.count({
        where: {
          firmId,
          performedAt: { gte: startDate },
          action: 'Moved',
        },
      }),
      // Pending review
      prisma.pendingClassification.count({
        where: {
          firmId,
          isResolved: false,
        },
      }),
    ]);

    // Calculate AI accuracy based on move rate
    const totalAutoClassified = autoClassified;
    const totalMoved = movedAfterImport;
    const aiAccuracy =
      totalAutoClassified > 0 ? (totalAutoClassified - totalMoved) / totalAutoClassified : null;

    return {
      autoClassified,
      manuallyReviewed,
      movedAfterImport,
      pendingReview,
      aiAccuracy: aiAccuracy !== null ? Math.max(0, Math.min(1, aiAccuracy)) : null,
    };
  },

  /**
   * Get cases available for reassignment (same client)
   */
  casesForReassignment: async (_: unknown, { emailId }: { emailId: string }, context: Context) => {
    const firmId = context.user?.firmId;
    if (!firmId) throw new Error('Authentication required');

    const email = await prisma.email.findFirst({
      where: { id: emailId, firmId },
      include: {
        case: {
          select: { clientId: true },
        },
      },
    });

    if (!email) throw new Error('Email not found');

    // If email has a case, get cases for the same client
    // Otherwise, get all active cases user has access to
    if (email.case?.clientId) {
      return prisma.case.findMany({
        where: {
          firmId,
          clientId: email.case.clientId,
          status: 'Active',
          id: { not: email.caseId || undefined },
        },
        orderBy: { title: 'asc' },
      });
    }

    // No case assigned - return all accessible cases
    const userId = context.user?.id;
    return prisma.case.findMany({
      where: {
        firmId,
        status: 'Active',
        teamMembers: { some: { userId } },
      },
      orderBy: { title: 'asc' },
    });
  },
};

// ============================================================================
// Mutation Resolvers
// ============================================================================

export const classificationReviewMutationResolvers = {
  /**
   * Move an email from one case to another
   */
  moveEmailToCase: async (_: unknown, { input }: { input: MoveEmailInput }, context: Context) => {
    const firmId = context.user?.firmId;
    const userId = context.user?.id;
    if (!firmId || !userId) throw new Error('Authentication required');

    const { emailId, toCaseId, reason, moveAttachments, addSenderAsActor } = input;

    logger.info('[moveEmailToCase] Starting', { emailId, toCaseId, userId });

    // Get email with current case
    const email = await prisma.email.findFirst({
      where: { id: emailId, firmId },
      include: {
        case: true,
        attachments: {
          include: { document: true },
        },
      },
    });

    if (!email) {
      return { success: false, error: 'Email not found' };
    }

    const fromCaseId = email.caseId;
    const fromCase = email.case;

    // Verify target case access
    const toCase = await prisma.case.findFirst({
      where: {
        id: toCaseId,
        firmId,
        teamMembers: { some: { userId } },
      },
    });

    if (!toCase) {
      return { success: false, error: 'Target case not found or access denied' };
    }

    // Perform the move in transaction
    const result = await prisma.$transaction(async (tx) => {
      let attachmentsMoved = 0;
      let actorCreated = false;

      // Update email's case
      await tx.email.update({
        where: { id: emailId },
        data: { caseId: toCaseId },
      });

      // Move attachments if requested
      if (moveAttachments && email.attachments.length > 0) {
        for (const attachment of email.attachments) {
          if (attachment.document) {
            // Update document's case link
            const existingLink = await tx.caseDocument.findFirst({
              where: {
                documentId: attachment.documentId!,
                caseId: fromCaseId || undefined,
              },
            });

            if (existingLink) {
              // Update link to new case
              await tx.caseDocument.update({
                where: { id: existingLink.id },
                data: { caseId: toCaseId },
              });
              attachmentsMoved++;
            }
          }
        }
      }

      // Add sender as actor if requested
      if (addSenderAsActor) {
        const fromData = email.from as { name?: string; address: string } | null;
        if (fromData?.address) {
          const existingActor = await tx.caseActor.findFirst({
            where: {
              caseId: toCaseId,
              email: fromData.address.toLowerCase(),
            },
          });

          if (!existingActor) {
            await tx.caseActor.create({
              data: {
                caseId: toCaseId,
                name: fromData.name || fromData.address,
                email: fromData.address.toLowerCase(),
                role: 'OpposingParty' as CaseActorRole,
                createdBy: userId,
              },
            });
            actorCreated = true;
          }
        }
      }

      // Log the action
      await tx.emailClassificationLog.create({
        data: {
          emailId,
          firmId,
          action: 'Moved',
          fromCaseId,
          toCaseId,
          wasAutomatic: false,
          matchType: 'Manual',
          correctionReason: reason,
          performedBy: userId,
        },
      });

      // Sync timeline
      try {
        await unifiedTimelineService.syncEmailToCommunicationEntry(emailId);
      } catch (err) {
        logger.warn('[moveEmailToCase] Timeline sync failed', { emailId, error: err });
      }

      return { attachmentsMoved, actorCreated };
    });

    // Record activity in both cases
    const fromData = email.from as { name?: string; address: string } | null;
    const emailDesc = `"${email.subject || '(fără subiect)'}" de la ${fromData?.address || 'necunoscut'}`;

    // Note: Using CommunicationReceived as closest existing activity type
    // Original case: email moved out
    if (fromCaseId) {
      await caseActivityService.recordActivity(
        fromCaseId,
        userId,
        'CommunicationSent', // Email leaving this case
        'Communication',
        emailId,
        `Email mutat la alt dosar`,
        emailDesc,
        { toCaseId, reason, action: 'moved_out' }
      );
    }

    // Target case: email moved in
    await caseActivityService.recordActivity(
      toCaseId,
      userId,
      'CommunicationReceived', // Email arriving in this case
      'Communication',
      emailId,
      `Email primit din alt dosar`,
      emailDesc,
      { fromCaseId, reason, action: 'moved_in' }
    );

    logger.info('[moveEmailToCase] Complete', {
      emailId,
      fromCaseId,
      toCaseId,
      attachmentsMoved: result.attachmentsMoved,
      actorCreated: result.actorCreated,
    });

    // OPS-047: Mark both case summaries as stale
    if (fromCaseId) {
      caseSummaryService.markSummaryStale(fromCaseId).catch(() => {});
    }
    caseSummaryService.markSummaryStale(toCaseId).catch(() => {});

    return {
      success: true,
      email: await prisma.email.findUnique({ where: { id: emailId } }),
      fromCase,
      toCase,
      attachmentsMoved: result.attachmentsMoved,
      actorCreated: result.actorCreated,
    };
  },

  /**
   * Mark an email as not case-related (ignore)
   */
  ignoreEmail: async (
    _: unknown,
    { input }: { input: IgnoreEmailInput },
    context: Context
  ): Promise<boolean> => {
    const firmId = context.user?.firmId;
    const userId = context.user?.id;
    if (!firmId || !userId) throw new Error('Authentication required');

    const { emailId, reason } = input;

    const email = await prisma.email.findFirst({
      where: { id: emailId, firmId },
    });

    if (!email) throw new Error('Email not found');

    await prisma.$transaction(async (tx) => {
      // Mark email as ignored
      await tx.email.update({
        where: { id: emailId },
        data: {
          isIgnored: true,
          ignoredAt: new Date(),
          caseId: null, // Remove from case
        },
      });

      // Log the action
      await tx.emailClassificationLog.create({
        data: {
          emailId,
          firmId,
          action: 'Ignored',
          fromCaseId: email.caseId,
          toCaseId: null,
          wasAutomatic: false,
          matchType: 'Manual',
          correctionReason: reason,
          performedBy: userId,
        },
      });

      // Remove from pending queue if present
      await tx.pendingClassification.deleteMany({
        where: { emailId },
      });
    });

    // OPS-047: Mark original case summary as stale if email was in a case
    if (email.caseId) {
      caseSummaryService.markSummaryStale(email.caseId).catch(() => {});
    }

    return true;
  },

  /**
   * Bulk assign multiple emails to a case from the review queue
   */
  bulkAssignEmails: async (
    _: unknown,
    { input }: { input: BulkAssignEmailsInput },
    context: Context
  ) => {
    const firmId = context.user?.firmId;
    const userId = context.user?.id;
    if (!firmId || !userId) throw new Error('Authentication required');

    const { emailIds, caseId, reason } = input;
    const errors: string[] = [];
    let emailsAssigned = 0;

    // Verify case access
    const targetCase = await prisma.case.findFirst({
      where: {
        id: caseId,
        firmId,
        teamMembers: { some: { userId } },
      },
    });

    if (!targetCase) {
      return { success: false, emailsAssigned: 0, errors: ['Case not found or access denied'] };
    }

    for (const emailId of emailIds) {
      try {
        await prisma.$transaction(async (tx) => {
          const email = await tx.email.findFirst({
            where: { id: emailId, firmId },
          });

          if (!email) {
            errors.push(`Email ${emailId}: not found`);
            return;
          }

          // Assign to case
          await tx.email.update({
            where: { id: emailId },
            data: { caseId },
          });

          // Log the action
          await tx.emailClassificationLog.create({
            data: {
              emailId,
              firmId,
              action: 'Assigned',
              fromCaseId: email.caseId,
              toCaseId: caseId,
              wasAutomatic: false,
              matchType: 'Manual',
              correctionReason: reason,
              performedBy: userId,
            },
          });

          // Remove from pending queue
          await tx.pendingClassification.deleteMany({
            where: { emailId },
          });

          emailsAssigned++;
        });

        // Sync timeline
        try {
          await unifiedTimelineService.syncEmailToCommunicationEntry(emailId);
        } catch (err) {
          logger.warn('[bulkAssignEmails] Timeline sync failed', { emailId });
        }
      } catch (err: any) {
        errors.push(`Email ${emailId}: ${err.message}`);
      }
    }

    // Record activity - using CommunicationReceived as closest existing type
    if (emailsAssigned > 0) {
      await caseActivityService.recordActivity(
        caseId,
        userId,
        'CommunicationReceived',
        'Communication',
        caseId,
        `${emailsAssigned} emailuri atribuite din coada de clasificare`,
        reason || 'Atribuire în bloc',
        { emailCount: emailsAssigned, action: 'bulk_assign' }
      );

      // OPS-047: Mark case summary as stale
      caseSummaryService.markSummaryStale(caseId).catch(() => {});
    }

    return {
      success: emailsAssigned > 0,
      emailsAssigned,
      errors,
    };
  },

  /**
   * Assign a single email from the review queue to a case
   */
  assignPendingEmailToCase: async (
    _: unknown,
    { pendingId, caseId, reason }: { pendingId: string; caseId: string; reason?: string },
    context: Context
  ) => {
    const firmId = context.user?.firmId;
    const userId = context.user?.id;
    if (!firmId || !userId) throw new Error('Authentication required');

    // Get pending item
    const pending = await prisma.pendingClassification.findFirst({
      where: { id: pendingId, firmId },
      include: { email: true },
    });

    if (!pending) {
      return { success: false, error: 'Pending item not found' };
    }

    // Verify case access
    const targetCase = await prisma.case.findFirst({
      where: {
        id: caseId,
        firmId,
        teamMembers: { some: { userId } },
      },
    });

    if (!targetCase) {
      return { success: false, error: 'Case not found or access denied' };
    }

    await prisma.$transaction(async (tx) => {
      // Assign email to case
      await tx.email.update({
        where: { id: pending.emailId },
        data: { caseId },
      });

      // Log the action
      await tx.emailClassificationLog.create({
        data: {
          emailId: pending.emailId,
          firmId,
          action: 'Assigned',
          fromCaseId: pending.email.caseId,
          toCaseId: caseId,
          wasAutomatic: false,
          matchType: 'Manual',
          correctionReason: reason,
          performedBy: userId,
        },
      });

      // Mark pending as resolved
      await tx.pendingClassification.update({
        where: { id: pendingId },
        data: {
          isResolved: true,
          resolvedAt: new Date(),
          resolvedBy: userId,
        },
      });
    });

    // Sync timeline
    try {
      await unifiedTimelineService.syncEmailToCommunicationEntry(pending.emailId);
    } catch (err) {
      logger.warn('[assignPendingEmailToCase] Timeline sync failed', { emailId: pending.emailId });
    }

    // OPS-047: Mark case summary as stale
    caseSummaryService.markSummaryStale(caseId).catch(() => {});

    return {
      success: true,
      email: await prisma.email.findUnique({ where: { id: pending.emailId } }),
      toCase: targetCase,
    };
  },

  /**
   * Dismiss an item from the review queue without assigning
   */
  dismissFromQueue: async (
    _: unknown,
    { pendingId, reason }: { pendingId: string; reason?: string },
    context: Context
  ): Promise<boolean> => {
    const firmId = context.user?.firmId;
    const userId = context.user?.id;
    if (!firmId || !userId) throw new Error('Authentication required');

    const pending = await prisma.pendingClassification.findFirst({
      where: { id: pendingId, firmId },
    });

    if (!pending) throw new Error('Pending item not found');

    await prisma.$transaction(async (tx) => {
      // Mark as resolved without assigning
      await tx.pendingClassification.update({
        where: { id: pendingId },
        data: {
          isResolved: true,
          resolvedAt: new Date(),
          resolvedBy: userId,
        },
      });

      // Log the dismissal
      await tx.emailClassificationLog.create({
        data: {
          emailId: pending.emailId,
          firmId,
          action: 'Unassigned',
          fromCaseId: null,
          toCaseId: null,
          wasAutomatic: false,
          matchType: 'Manual',
          correctionReason: reason || 'Dismissed from queue',
          performedBy: userId,
        },
      });
    });

    return true;
  },

  /**
   * Add a detected reference number to a case
   */
  addReferenceToCase: async (
    _: unknown,
    { caseId, reference }: { caseId: string; reference: string },
    context: Context
  ) => {
    const firmId = context.user?.firmId;
    const userId = context.user?.id;
    if (!firmId || !userId) throw new Error('Authentication required');

    const caseRecord = await prisma.case.findFirst({
      where: {
        id: caseId,
        firmId,
        teamMembers: { some: { userId } },
      },
    });

    if (!caseRecord) throw new Error('Case not found or access denied');

    // Normalize reference
    const normalizedRef = reference.trim();

    // Check if already exists
    if (caseRecord.referenceNumbers.includes(normalizedRef)) {
      return caseRecord;
    }

    // Add reference
    const updated = await prisma.case.update({
      where: { id: caseId },
      data: {
        referenceNumbers: [...caseRecord.referenceNumbers, normalizedRef],
      },
    });

    // Record activity - using MilestoneReached as closest existing type for metadata updates
    await caseActivityService.recordActivity(
      caseId,
      userId,
      'MilestoneReached',
      'Communication', // Using Communication as EntityType (Case is not supported)
      caseId,
      `Referință adăugată: ${normalizedRef}`,
      'Adăugat din clasificare email',
      { reference: normalizedRef, action: 'reference_added' }
    );

    return updated;
  },
};

// ============================================================================
// Field Resolvers
// ============================================================================

export const classificationReviewFieldResolvers = {
  PendingClassificationItem: {
    suggestedCases: async (parent: { suggestedCases: any[] }) => {
      // suggestedCases is stored as JSON array of { caseId, confidence, matchType }
      const suggestions = parent.suggestedCases || [];
      return Promise.all(
        suggestions.map(async (s: any) => ({
          caseId: s.caseId,
          case: await prisma.case.findUnique({ where: { id: s.caseId } }),
          confidence: s.confidence,
          matchType: s.matchType,
          reason: s.reason || '',
        }))
      );
    },
  },

  EmailClassificationLog: {
    email: async (parent: { emailId: string }) => {
      return prisma.email.findUnique({ where: { id: parent.emailId } });
    },
    fromCase: async (parent: { fromCaseId: string | null }) => {
      if (!parent.fromCaseId) return null;
      return prisma.case.findUnique({ where: { id: parent.fromCaseId } });
    },
    toCase: async (parent: { toCaseId: string | null }) => {
      if (!parent.toCaseId) return null;
      return prisma.case.findUnique({ where: { id: parent.toCaseId } });
    },
    performedBy: async (parent: { performedBy: string }) => {
      return prisma.user.findUnique({ where: { id: parent.performedBy } });
    },
  },
};

// ============================================================================
// Export Combined Resolvers
// ============================================================================

export const classificationReviewResolvers = {
  Query: classificationReviewQueryResolvers,
  Mutation: classificationReviewMutationResolvers,
  ...classificationReviewFieldResolvers,
};
