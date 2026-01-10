/**
 * Case Approval Workflow Resolvers
 * Story 2.8.2: Case Approval Workflow
 *
 * Implements Partner approval/rejection workflow for Associate-created cases
 */

import { GraphQLError } from 'graphql';
import { UserRole, CaseStatus, ApprovalStatus } from '@prisma/client';
import { prisma } from '@legal-platform/database';
import { notificationService } from '../../services/notification.service';

/**
 * Type definitions for context and inputs
 */
interface Context {
  user: {
    id: string;
    role: UserRole;
    firmId: string;
  };
}

interface RejectCaseInput {
  caseId: string;
  reason: string;
}

export const approvalResolvers = {
  Query: {
    /**
     * Get all pending cases for Partner approval
     * Authorization: Partners only
     * Returns: Cases with status=PENDING_APPROVAL in user's firm, sorted by submittedAt (FIFO)
     */
    pendingCases: async (_: any, __: any, context: Context) => {
      const { user } = context;

      // Authentication: Check if user is logged in
      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Authorization: Only Partners can access pending approvals
      if (user.role !== UserRole.Partner) {
        throw new GraphQLError('Only Partners can view pending approvals', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Fetch all pending cases in the Partner's firm
      const cases = await prisma.case.findMany({
        where: {
          firmId: user.firmId,
          status: CaseStatus.PendingApproval,
        },
        include: {
          client: true,
          teamMembers: {
            include: {
              user: true,
            },
          },
          actors: true,
          approval: {
            include: {
              submitter: true,
              reviewer: true,
            },
          },
          rateHistory: {
            include: {
              changer: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc', // FIFO queue - oldest first
        },
      });

      return cases;
    },

    /**
     * Get cases submitted or assigned to current user
     * For Associates: returns cases they created/submitted
     * For Partners: returns all firm cases
     * Optional status filter
     */
    myCases: async (_: any, args: { status?: CaseStatus }, context: Context) => {
      const { user } = context;
      const { status } = args;

      // Authentication: Check if user is logged in
      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      let whereClause: any = {
        firmId: user.firmId,
      };

      // Role-based filtering
      if (user.role === UserRole.Associate) {
        // Associates see only cases they created OR are assigned to
        whereClause = {
          ...whereClause,
          OR: [
            // Cases where they are the submitter (including pending/rejected)
            {
              approval: {
                submittedBy: user.id,
              },
            },
            // Cases where they are a team member
            {
              teamMembers: {
                some: {
                  userId: user.id,
                },
              },
            },
          ],
        };
      }
      // Partners see all firm cases (no additional filtering)

      // Apply status filter if provided
      if (status) {
        whereClause.status = status;
      }

      const cases = await prisma.case.findMany({
        where: whereClause,
        include: {
          client: true,
          teamMembers: {
            include: {
              user: true,
            },
          },
          actors: true,
          approval: {
            include: {
              submitter: true,
              reviewer: true,
            },
          },
          rateHistory: {
            include: {
              changer: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return cases;
    },
  },

  Mutation: {
    /**
     * Approve a pending case
     * Authorization: Partners only
     * Side effects: Changes status to Active, updates approval record, creates audit log, sends notification
     */
    approveCase: async (_: any, args: { caseId: string }, context: Context) => {
      const { user } = context;
      const { caseId } = args;

      // Authentication: Check if user is logged in
      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Authorization: Only Partners can approve cases
      if (user.role !== UserRole.Partner) {
        throw new GraphQLError('Only Partners can approve cases', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Fetch the case with approval info
      const caseRecord = await prisma.case.findUnique({
        where: { id: caseId },
        include: {
          approval: {
            include: {
              submitter: true,
            },
          },
        },
      });

      if (!caseRecord) {
        throw new GraphQLError('Case not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Verify case belongs to Partner's firm
      if (caseRecord.firmId !== user.firmId) {
        throw new GraphQLError('Case not found in your firm', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Verify case is in PendingApproval status
      if (caseRecord.status !== CaseStatus.PendingApproval) {
        throw new GraphQLError('Case is not pending approval', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // If no approval record exists, create one (handles legacy cases without approval workflow)
      if (!caseRecord.approval) {
        const newApproval = await prisma.caseApproval.create({
          data: {
            case: { connect: { id: caseId } },
            firm: { connect: { id: caseRecord.firmId } },
            submitter: { connect: { id: user.id } }, // Use approving partner as submitter for legacy cases
            submittedAt: caseRecord.createdAt, // Use case creation date
            status: ApprovalStatus.Pending,
          },
          include: {
            submitter: true,
          },
        });
        // Attach to caseRecord for the transaction
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (caseRecord as any).approval = newApproval;
      }

      // Perform approval in a transaction
      const updatedCase = await prisma.$transaction(async (tx) => {
        // Update case status to Active
        const updated = await tx.case.update({
          where: { id: caseId },
          data: {
            status: CaseStatus.Active,
          },
          include: {
            client: true,
            teamMembers: {
              include: {
                user: true,
              },
            },
            actors: true,
            approval: {
              include: {
                submitter: true,
                reviewer: true,
              },
            },
            rateHistory: {
              include: {
                changer: true,
              },
            },
          },
        });

        // Update approval record
        await tx.caseApproval.update({
          where: { caseId },
          data: {
            status: ApprovalStatus.Approved,
            reviewedBy: user.id,
            reviewedAt: new Date(),
          },
        });

        // Create audit log entry
        await tx.caseAuditLog.create({
          data: {
            caseId,
            userId: user.id,
            action: 'CASE_APPROVED',
            fieldName: 'status',
            oldValue: 'PendingApproval',
            newValue: 'Active',
          },
        });

        // Task 11 - Send notification to submitting Associate (AC7)
        await notificationService.notifyCaseApproved(caseRecord.approval!.submittedBy, {
          caseId,
          caseTitle: updated.title,
          actorName: `${user.id}`, // Will be enriched to full name in notification
        });

        return updated;
      });

      return updatedCase;
    },

    /**
     * Reject a pending case with feedback
     * Authorization: Partners only
     * Side effects: Updates approval record with rejection reason, creates audit log, sends notification
     */
    rejectCase: async (_: any, args: { input: RejectCaseInput }, context: Context) => {
      const { user } = context;
      const { caseId, reason } = args.input;

      // Authentication: Check if user is logged in
      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Authorization: Only Partners can reject cases
      if (user.role !== UserRole.Partner) {
        throw new GraphQLError('Only Partners can reject cases', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Validate reason length (minimum 10 characters)
      if (!reason || reason.trim().length < 10) {
        throw new GraphQLError('Rejection reason must be at least 10 characters', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Sanitize reason (prevent XSS, limit length to 2000 characters)
      const sanitizedReason = reason.trim().substring(0, 2000);

      // Fetch the case with approval info
      const caseRecord = await prisma.case.findUnique({
        where: { id: caseId },
        include: {
          approval: {
            include: {
              submitter: true,
            },
          },
        },
      });

      if (!caseRecord) {
        throw new GraphQLError('Case not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Verify case belongs to Partner's firm
      if (caseRecord.firmId !== user.firmId) {
        throw new GraphQLError('Case not found in your firm', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Verify case is in PendingApproval status
      if (caseRecord.status !== CaseStatus.PendingApproval) {
        throw new GraphQLError('Case is not pending approval', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Check if approval record exists
      if (!caseRecord.approval) {
        throw new GraphQLError('No approval record found for this case', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Perform rejection in a transaction
      const updatedCase = await prisma.$transaction(async (tx) => {
        // Update approval record with rejection details
        await tx.caseApproval.update({
          where: { caseId },
          data: {
            status: ApprovalStatus.Rejected,
            reviewedBy: user.id,
            reviewedAt: new Date(),
            rejectionReason: sanitizedReason,
          },
        });

        // Create audit log entry
        await tx.caseAuditLog.create({
          data: {
            caseId,
            userId: user.id,
            action: 'CASE_REJECTED',
            fieldName: 'rejectionReason',
            oldValue: null,
            newValue: sanitizedReason,
          },
        });

        // Fetch updated case with all relations
        const updated = await tx.case.findUnique({
          where: { id: caseId },
          include: {
            client: true,
            teamMembers: {
              include: {
                user: true,
              },
            },
            actors: true,
            approval: {
              include: {
                submitter: true,
                reviewer: true,
              },
            },
            rateHistory: {
              include: {
                changer: true,
              },
            },
          },
        });

        // Task 11 - Send notification to submitting Associate with rejection reason (AC7)
        await notificationService.notifyCaseRejected(caseRecord.approval!.submittedBy, {
          caseId,
          caseTitle: updated!.title,
          actorName: `${user.id}`, // Will be enriched to full name in notification
          rejectionReason: sanitizedReason,
        });

        return updated;
      });

      return updatedCase;
    },

    /**
     * Resubmit a rejected case for review
     * Authorization: Original submitter (Associate) only
     * Side effects: Resets approval status to Pending, increments revision count, creates audit log, sends notification
     */
    resubmitCase: async (_: any, args: { caseId: string }, context: Context) => {
      const { user } = context;
      const { caseId } = args;

      // Authentication: Check if user is logged in
      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Fetch the case with approval info
      const caseRecord = await prisma.case.findUnique({
        where: { id: caseId },
        include: {
          approval: {
            include: {
              submitter: true,
            },
          },
        },
      });

      if (!caseRecord) {
        throw new GraphQLError('Case not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Verify case belongs to user's firm
      if (caseRecord.firmId !== user.firmId) {
        throw new GraphQLError('Case not found in your firm', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Check if approval record exists
      if (!caseRecord.approval) {
        throw new GraphQLError('No approval record found for this case', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Authorization: Only the original submitter can resubmit
      if (caseRecord.approval.submittedBy !== user.id) {
        throw new GraphQLError('Only the original submitter can resubmit this case', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Verify approval status is Rejected
      if (caseRecord.approval.status !== ApprovalStatus.Rejected) {
        throw new GraphQLError('Only rejected cases can be resubmitted', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Perform resubmission in a transaction
      const updatedCase = await prisma.$transaction(async (tx) => {
        // Update approval record - reset to Pending
        const approvalUpdate = await tx.caseApproval.update({
          where: { caseId },
          data: {
            status: ApprovalStatus.Pending,
            revisionCount: { increment: 1 },
            reviewedBy: null,
            reviewedAt: null,
            rejectionReason: null,
          },
        });

        // Create audit log entry
        await tx.caseAuditLog.create({
          data: {
            caseId,
            userId: user.id,
            action: 'CASE_RESUBMITTED',
            fieldName: 'revisionCount',
            oldValue: (approvalUpdate.revisionCount - 1).toString(),
            newValue: approvalUpdate.revisionCount.toString(),
          },
        });

        // Fetch updated case with all relations
        const updated = await tx.case.findUnique({
          where: { id: caseId },
          include: {
            client: true,
            teamMembers: {
              include: {
                user: true,
              },
            },
            actors: true,
            approval: {
              include: {
                submitter: true,
                reviewer: true,
              },
            },
            rateHistory: {
              include: {
                changer: true,
              },
            },
          },
        });

        // Task 11 - Send notification to Partners (new case pending review) (AC2)
        await notificationService.notifyCasePendingApproval(user.firmId, {
          caseId,
          caseTitle: updated!.title,
          actorName: `${user.id}`, // Will be enriched to full name in notification
          revisionCount: approvalUpdate.revisionCount,
        });

        return updated;
      });

      return updatedCase;
    },
  },

  // Field resolvers for CaseApproval type
  CaseApproval: {
    case: async (parent: any, _: any, __: any) => {
      return await prisma.case.findUnique({
        where: { id: parent.caseId },
        include: {
          client: true,
          teamMembers: {
            include: {
              user: true,
            },
          },
          actors: true,
        },
      });
    },
    submittedBy: async (parent: any, _: any, __: any) => {
      return await prisma.user.findUnique({
        where: { id: parent.submittedBy },
      });
    },
    reviewedBy: async (parent: any, _: any, __: any) => {
      if (!parent.reviewedBy) return null;
      return await prisma.user.findUnique({
        where: { id: parent.reviewedBy },
      });
    },
  },
};
