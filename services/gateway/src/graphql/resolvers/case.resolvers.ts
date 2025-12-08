/**
 * Case Management GraphQL Resolvers
 * Story 2.6: Case Management Data Model and API
 * Story 2.8.1: Billing & Rate Management
 * Story 2.8.2: Case Approval Workflow (notifications)
 * Story 2.11.2: Retainer Billing Support
 *
 * Implements all queries, mutations, and field resolvers for case management
 */

import { prisma } from '@legal-platform/database';
import { GraphQLError } from 'graphql';
import { Decimal } from '@prisma/client/runtime/library';
import { notificationService } from '../../services/notification.service';
import { retainerService } from '../../services/retainer.service';

// Types for GraphQL context
// Story 2.11.1: Added BusinessOwner role and financialDataScope
// Story 5.1: Added accessToken for email operations
export interface Context {
  user?: {
    id: string;
    firmId: string;
    role: 'Partner' | 'Associate' | 'Paralegal' | 'BusinessOwner';
    email: string;
    accessToken?: string; // Story 5.1: MS access token for email operations
  };
  // Story 2.11.1: Financial data scope for Partners and BusinessOwners
  financialDataScope?: 'own' | 'firm' | null;
}

// Helper function to check authorization
function requireAuth(context: Context) {
  if (!context.user) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return context.user;
}

// Helper function to check if user can access case
// Story 2.11.1: Added BusinessOwner role support
async function canAccessCase(caseId: string, user: Context['user']): Promise<boolean> {
  if (!user) return false;

  // CRITICAL: First verify the case belongs to the user's firm (multi-tenancy isolation)
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: { firmId: true },
  });

  // Case must exist AND belong to user's firm
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

// Helper to generate unique case number
async function generateCaseNumber(firmId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${firmId.substring(0, 8)}-${year}`;

  // Find max case number for this firm/year
  const lastCase = await prisma.case.findFirst({
    where: {
      firmId,
      caseNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      caseNumber: 'desc',
    },
  });

  let sequential = 1;
  if (lastCase) {
    const match = lastCase.caseNumber.match(/-(\d+)$/);
    if (match) {
      sequential = parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}-${sequential.toString().padStart(3, '0')}`;
}

// Audit log helper
async function createAuditLog(data: {
  caseId: string;
  userId: string;
  action: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
}) {
  await prisma.caseAuditLog.create({
    data: {
      ...data,
      timestamp: new Date(),
    },
  });
}

// Email validation helper
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ============================================================================
// Story 2.8.1: Billing & Rate Management Helpers
// ============================================================================

// Helper to get firm default rates
async function getFirmDefaultRates(firmId: string) {
  const firm = await prisma.firm.findUnique({
    where: { id: firmId },
    select: { defaultRates: true },
  });

  if (!firm || !firm.defaultRates) {
    return null;
  }

  return firm.defaultRates as any;
}

// Validate billing input for case creation/update
function validateBillingInput(input: any) {
  // If billing type is Fixed, fixedAmount is required
  if (input.billingType === 'Fixed') {
    if (input.fixedAmount === null || input.fixedAmount === undefined) {
      throw new GraphQLError('Fixed amount is required when billing type is Fixed', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    if (input.fixedAmount <= 0) {
      throw new GraphQLError('Fixed amount must be a positive number', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }
  }

  // Validate custom rates if provided
  if (input.customRates) {
    const { partnerRate, associateRate, paralegalRate } = input.customRates;

    // Check all provided rates are positive
    if (partnerRate !== undefined && partnerRate <= 0) {
      throw new GraphQLError('Partner rate must be positive', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }
    if (associateRate !== undefined && associateRate <= 0) {
      throw new GraphQLError('Associate rate must be positive', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }
    if (paralegalRate !== undefined && paralegalRate <= 0) {
      throw new GraphQLError('Paralegal rate must be positive', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }
  }
}

// Create rate history entries when rates change
async function trackRateChanges(
  tx: any,
  caseId: string,
  firmId: string,
  userId: string,
  oldRates: any,
  newRates: any,
  oldBillingType?: string,
  newBillingType?: string
) {
  const changes: Array<{
    caseId: string;
    firmId: string;
    changedBy: string;
    rateType: 'partner' | 'associate' | 'paralegal' | 'fixed';
    oldRate: Decimal;
    newRate: Decimal;
  }> = [];

  // Track billing type change to Fixed with fixed amount
  if (oldBillingType !== newBillingType && newBillingType === 'Fixed' && newRates.fixedAmount) {
    changes.push({
      caseId,
      firmId,
      changedBy: userId,
      rateType: 'fixed',
      oldRate: new Decimal(oldRates?.fixedAmount || 0),
      newRate: new Decimal(newRates.fixedAmount),
    });
  }

  // Track custom rate changes
  if (oldRates?.customRates || newRates?.customRates) {
    const oldCustom = oldRates?.customRates || {};
    const newCustom = newRates?.customRates || {};

    if (oldCustom.partnerRate !== newCustom.partnerRate && newCustom.partnerRate) {
      changes.push({
        caseId,
        firmId,
        changedBy: userId,
        rateType: 'partner',
        oldRate: new Decimal(oldCustom.partnerRate || 0),
        newRate: new Decimal(newCustom.partnerRate),
      });
    }

    if (oldCustom.associateRate !== newCustom.associateRate && newCustom.associateRate) {
      changes.push({
        caseId,
        firmId,
        changedBy: userId,
        rateType: 'associate',
        oldRate: new Decimal(oldCustom.associateRate || 0),
        newRate: new Decimal(newCustom.associateRate),
      });
    }

    if (oldCustom.paralegalRate !== newCustom.paralegalRate && newCustom.paralegalRate) {
      changes.push({
        caseId,
        firmId,
        changedBy: userId,
        rateType: 'paralegal',
        oldRate: new Decimal(oldCustom.paralegalRate || 0),
        newRate: new Decimal(newCustom.paralegalRate),
      });
    }
  }

  // Create all history entries
  for (const change of changes) {
    await tx.caseRateHistory.create({
      data: change,
    });
  }
}

export const caseResolvers = {
  Query: {
    // Get multiple cases with filters
    cases: async (_: any, args: any, context: Context) => {
      const user = requireAuth(context);

      const where: any = {
        firmId: user.firmId,
      };

      // Apply filters
      if (args.status) {
        where.status = args.status;
      }

      if (args.clientId) {
        where.clientId = args.clientId;
      }

      // Filter by assigned cases for non-Partners
      if (args.assignedToMe || user.role !== 'Partner') {
        const assignments = await prisma.caseTeam.findMany({
          where: { userId: user.id },
          select: { caseId: true },
        });
        where.id = { in: assignments.map((a) => a.caseId) };
      }

      return prisma.case.findMany({
        where,
        include: {
          client: true,
          teamMembers: {
            include: {
              user: true,
            },
          },
          actors: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    },

    // Get single case by ID
    case: async (_: any, args: { id: string }, context: Context) => {
      const user = requireAuth(context);

      const caseData = await prisma.case.findUnique({
        where: { id: args.id },
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

      if (!caseData) return null;

      // Check authorization
      if (caseData.firmId !== user.firmId) return null;
      if (!(await canAccessCase(args.id, user))) return null;

      return caseData;
    },

    // Full-text search
    searchCases: async (_: any, args: { query: string; limit?: number }, context: Context) => {
      const user = requireAuth(context);
      const limit = Math.min(args.limit || 50, 100);

      if (args.query.length < 3) {
        throw new GraphQLError('Search query must be at least 3 characters', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Use PostgreSQL pg_trgm for full-text search with similarity ranking
      // This utilizes the GIN indexes created in migration 20251121021642

      let results: Array<{ id: string }>;

      if (user.role === 'Partner') {
        // Partners can search all cases in their firm
        results = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT c.id
          FROM cases c
          JOIN clients cl ON c.client_id = cl.id
          WHERE (
            c.title % ${args.query} OR
            c.description % ${args.query} OR
            cl.name % ${args.query}
          )
          AND c.firm_id = ${user.firmId}::uuid
          ORDER BY GREATEST(
            similarity(c.title, ${args.query}),
            similarity(c.description, ${args.query}),
            similarity(cl.name, ${args.query})
          ) DESC
          LIMIT ${limit}
        `;
      } else {
        // Non-Partners can only search their assigned cases
        results = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT c.id
          FROM cases c
          JOIN clients cl ON c.client_id = cl.id
          JOIN case_team ct ON c.id = ct.case_id
          WHERE (
            c.title % ${args.query} OR
            c.description % ${args.query} OR
            cl.name % ${args.query}
          )
          AND c.firm_id = ${user.firmId}::uuid
          AND ct.user_id = ${user.id}::uuid
          ORDER BY GREATEST(
            similarity(c.title, ${args.query}),
            similarity(c.description, ${args.query}),
            similarity(cl.name, ${args.query})
          ) DESC
          LIMIT ${limit}
        `;
      }

      // Fetch full case objects with relations
      if (results.length === 0) {
        return [];
      }

      const caseIds = results.map((r) => r.id);
      const cases = await prisma.case.findMany({
        where: { id: { in: caseIds } },
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

      // Maintain similarity order from raw query
      const caseMap = new Map(cases.map((c) => [c.id, c]));
      return caseIds
        .map((id) => caseMap.get(id))
        .filter((c): c is NonNullable<typeof c> => c !== undefined);
    },

    // Get case actors
    caseActors: async (_: any, args: { caseId: string }, context: Context) => {
      const user = requireAuth(context);

      if (!(await canAccessCase(args.caseId, user))) {
        return [];
      }

      return prisma.caseActor.findMany({
        where: { caseId: args.caseId },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      });
    },

    // Get case actors by role
    caseActorsByRole: async (_: any, args: { caseId: string; role: any }, context: Context) => {
      const user = requireAuth(context);

      if (!(await canAccessCase(args.caseId, user))) {
        return [];
      }

      return prisma.caseActor.findMany({
        where: {
          caseId: args.caseId,
          role: args.role as any,
        },
        orderBy: { name: 'asc' },
      });
    },

    // Search clients by name for autocomplete
    searchClients: async (_: any, args: { query: string; limit?: number }, context: Context) => {
      const user = requireAuth(context);
      const limit = Math.min(args.limit || 10, 50);

      if (args.query.length < 1) {
        return [];
      }

      // Use case-insensitive ILIKE for PostgreSQL search
      return prisma.client.findMany({
        where: {
          firmId: user.firmId,
          name: {
            contains: args.query,
            mode: 'insensitive',
          },
        },
        orderBy: { name: 'asc' },
        take: limit,
      });
    },

    // ============================================================================
    // Story 2.11.2: Retainer Billing Support Queries
    // ============================================================================

    // Get retainer usage for a specific period
    retainerUsage: async (
      _: any,
      args: { caseId: string; periodStart?: Date },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Check financial access (Partner or BusinessOwner only)
      if (user.role !== 'Partner' && user.role !== 'BusinessOwner') {
        throw new GraphQLError('Financial access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Verify case belongs to user's firm
      const caseData = await prisma.case.findFirst({
        where: {
          id: args.caseId,
          firmId: user.firmId,
        },
      });

      if (!caseData) {
        throw new GraphQLError('Case not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Get usage for the specified period (or current period)
      return retainerService.getUsageForPeriod(args.caseId, user.firmId, args.periodStart);
    },

    // Get retainer usage history for a case
    retainerUsageHistory: async (
      _: any,
      args: { caseId: string; limit?: number },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Check financial access (Partner or BusinessOwner only)
      if (user.role !== 'Partner' && user.role !== 'BusinessOwner') {
        throw new GraphQLError('Financial access required', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Verify case belongs to user's firm
      const caseData = await prisma.case.findFirst({
        where: {
          id: args.caseId,
          firmId: user.firmId,
        },
      });

      if (!caseData) {
        throw new GraphQLError('Case not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const limit = Math.min(args.limit || 12, 100);
      return retainerService.getUsageHistory(args.caseId, user.firmId, limit);
    },
  },

  Mutation: {
    // Create new case
    createCase: async (_: any, args: { input: any }, context: Context) => {
      const user = requireAuth(context);

      // Validate input
      if (args.input.title.length < 3 || args.input.title.length > 500) {
        throw new GraphQLError('Title must be 3-500 characters', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      if (args.input.description.length < 10) {
        throw new GraphQLError('Description must be at least 10 characters', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Find or create client by name
      let client = await prisma.client.findFirst({
        where: {
          firmId: user.firmId,
          name: args.input.clientName,
        },
      });

      if (!client) {
        // Create new client with the provided name
        client = await prisma.client.create({
          data: {
            firmId: user.firmId,
            name: args.input.clientName,
            type: 'Individual', // Default type
            status: 'Active',
          },
        });
      }

      // Story 2.8.1: Validate billing input
      if (args.input.billingType || args.input.fixedAmount || args.input.customRates) {
        validateBillingInput(args.input);
      }

      // Story 2.8.1: Get firm default rates to populate customRates if not provided
      let customRates = args.input.customRates;
      if (!customRates) {
        const firmRates = await getFirmDefaultRates(user.firmId);
        if (firmRates) {
          customRates = firmRates;
        }
      }

      // Generate unique case number
      const caseNumber = await generateCaseNumber(user.firmId);

      // Story 2.8.2: Determine if case requires approval
      // Partners create cases directly as Active (no approval needed)
      // Associates create cases as PendingApproval (requires approval) unless explicitly bypassed
      const submitForApproval =
        args.input.submitForApproval !== undefined
          ? args.input.submitForApproval
          : user.role === 'Associate'; // Default: true for Associates, false for Partners

      const caseStatus =
        user.role === 'Partner' || !submitForApproval ? 'Active' : 'PendingApproval';

      // Create case in transaction
      const newCase = await prisma.$transaction(async (tx) => {
        const createdCase = await tx.case.create({
          data: {
            firmId: user.firmId,
            caseNumber,
            title: args.input.title,
            clientId: client.id,
            type: args.input.type,
            description: args.input.description,
            status: caseStatus,
            openedDate: new Date(),
            value: args.input.value,
            metadata: args.input.metadata || {},
            // Story 2.8.1: Billing fields
            billingType: args.input.billingType || 'Hourly',
            fixedAmount: args.input.fixedAmount,
            customRates: customRates as any,
          },
          include: {
            client: true,
            teamMembers: {
              include: {
                user: true,
              },
            },
            actors: true,
            approval: true,
          },
        });

        // Assign creator as Lead
        await tx.caseTeam.create({
          data: {
            caseId: createdCase.id,
            userId: user.id,
            role: 'Lead',
            assignedBy: user.id,
          },
        });

        // Story 2.8.2: Create approval record if case requires approval
        if (caseStatus === 'PendingApproval') {
          await tx.caseApproval.create({
            data: {
              caseId: createdCase.id,
              submittedBy: user.id,
              submittedAt: new Date(),
              status: 'Pending',
              revisionCount: 0,
              firmId: user.firmId,
            },
          });

          // Create audit log for submission
          await tx.caseAuditLog.create({
            data: {
              caseId: createdCase.id,
              userId: user.id,
              action: 'CASE_SUBMITTED_FOR_APPROVAL',
              timestamp: new Date(),
            },
          });

          // Task 11 - Send notification to Partners (AC2)
          await notificationService.notifyCasePendingApproval(user.firmId, {
            caseId: createdCase.id,
            caseTitle: createdCase.title,
            actorName: `${user.id}`, // Will be enriched to full name in notification
          });
        } else {
          // Standard creation audit log
          await tx.caseAuditLog.create({
            data: {
              caseId: createdCase.id,
              userId: user.id,
              action: 'CREATED',
              timestamp: new Date(),
            },
          });
        }

        return createdCase;
      });

      return newCase;
    },

    // Update case
    updateCase: async (_: any, args: { id: string; input: any }, context: Context) => {
      const user = requireAuth(context);

      // Check authorization
      if (!(await canAccessCase(args.id, user))) {
        throw new GraphQLError('Not authorized to update this case', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const existingCase = await prisma.case.findUnique({
        where: { id: args.id },
      });

      if (!existingCase) {
        throw new GraphQLError('Case not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Story 2.8.1: Only Partners can modify rates
      if (
        (args.input.billingType && args.input.billingType !== existingCase.billingType) ||
        args.input.fixedAmount !== undefined ||
        args.input.customRates !== undefined
      ) {
        if (user.role !== 'Partner') {
          throw new GraphQLError('Only Partners can modify billing rates', {
            extensions: { code: 'FORBIDDEN' },
          });
        }
      }

      // Validate title length if provided
      if (args.input.title && (args.input.title.length < 3 || args.input.title.length > 500)) {
        throw new GraphQLError('Title must be 3-500 characters', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Validate status transitions
      if (args.input.status === 'Active' && existingCase.status === 'Archived') {
        throw new GraphQLError('Cannot reopen archived case', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Story 2.8.1: Validate billing input if being updated
      if (args.input.billingType || args.input.fixedAmount || args.input.customRates) {
        validateBillingInput({
          billingType: args.input.billingType || existingCase.billingType,
          fixedAmount:
            args.input.fixedAmount !== undefined
              ? args.input.fixedAmount
              : existingCase.fixedAmount,
          customRates: args.input.customRates,
        });
      }

      // Update case in transaction
      const updatedCase = await prisma.$transaction(async (tx) => {
        const updated = await tx.case.update({
          where: { id: args.id },
          data: args.input,
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

        // Create audit logs for changed fields
        for (const [field, newValue] of Object.entries(args.input)) {
          const oldValue = (existingCase as any)[field];
          if (oldValue !== newValue) {
            await tx.caseAuditLog.create({
              data: {
                caseId: args.id,
                userId: user.id,
                action: 'UPDATED',
                fieldName: field,
                oldValue: oldValue?.toString(),
                newValue: newValue?.toString(),
                timestamp: new Date(),
              },
            });
          }
        }

        // Story 2.8.1: Track rate changes in rate history
        const ratesChanged =
          args.input.billingType !== undefined ||
          args.input.fixedAmount !== undefined ||
          args.input.customRates !== undefined;

        if (ratesChanged) {
          await trackRateChanges(
            tx,
            args.id,
            user.firmId,
            user.id,
            {
              fixedAmount: existingCase.fixedAmount,
              customRates: existingCase.customRates,
            },
            {
              fixedAmount:
                args.input.fixedAmount !== undefined
                  ? args.input.fixedAmount
                  : existingCase.fixedAmount,
              customRates:
                args.input.customRates !== undefined
                  ? args.input.customRates
                  : existingCase.customRates,
            },
            existingCase.billingType,
            args.input.billingType || existingCase.billingType
          );
        }

        return updated;
      });

      return updatedCase;
    },

    // Archive case
    archiveCase: async (_: any, args: { id: string }, context: Context) => {
      const user = requireAuth(context);

      if (user.role !== 'Partner') {
        throw new GraphQLError('Only Partners can archive cases', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const existingCase = await prisma.case.findUnique({
        where: { id: args.id },
      });

      if (!existingCase) {
        throw new GraphQLError('Case not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (existingCase.status !== 'Closed') {
        throw new GraphQLError('Can only archive closed cases', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const archivedCase = await prisma.$transaction(async (tx) => {
        const updated = await tx.case.update({
          where: { id: args.id },
          data: {
            status: 'Archived',
            closedDate: new Date(),
          },
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

        await tx.caseAuditLog.create({
          data: {
            caseId: args.id,
            userId: user.id,
            action: 'ARCHIVED',
            timestamp: new Date(),
          },
        });

        return updated;
      });

      return archivedCase;
    },

    // Assign team member
    assignTeam: async (_: any, args: { input: any }, context: Context) => {
      const user = requireAuth(context);

      // Paralegals cannot assign team members (per Story 2.6 authorization rules)
      if (user.role === 'Paralegal') {
        throw new GraphQLError('Paralegals cannot assign team members', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      if (!(await canAccessCase(args.input.caseId, user))) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Check if user exists and belongs to same firm
      const targetUser = await prisma.user.findUnique({
        where: { id: args.input.userId },
      });

      if (!targetUser || targetUser.firmId !== user.firmId) {
        throw new GraphQLError('User not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Check if already assigned
      const existing = await prisma.caseTeam.findUnique({
        where: {
          caseId_userId: {
            caseId: args.input.caseId,
            userId: args.input.userId,
          },
        },
      });

      if (existing) {
        throw new GraphQLError('User already assigned to case', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const assignment = await prisma.$transaction(async (tx) => {
        const created = await tx.caseTeam.create({
          data: {
            caseId: args.input.caseId,
            userId: args.input.userId,
            role: args.input.role,
            assignedBy: user.id,
          },
          include: {
            user: true,
          },
        });

        await tx.caseAuditLog.create({
          data: {
            caseId: args.input.caseId,
            userId: user.id,
            action: 'TEAM_ASSIGNED',
            newValue: args.input.userId,
            timestamp: new Date(),
          },
        });

        return created;
      });

      return assignment;
    },

    // Remove team member
    removeTeamMember: async (
      _: any,
      args: { caseId: string; userId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      if (!(await canAccessCase(args.caseId, user))) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.caseTeam.delete({
          where: {
            caseId_userId: {
              caseId: args.caseId,
              userId: args.userId,
            },
          },
        });

        await tx.caseAuditLog.create({
          data: {
            caseId: args.caseId,
            userId: user.id,
            action: 'TEAM_REMOVED',
            oldValue: args.userId,
            timestamp: new Date(),
          },
        });
      });

      return true;
    },

    // Add case actor
    addCaseActor: async (_: any, args: { input: any }, context: Context) => {
      const user = requireAuth(context);

      if (!(await canAccessCase(args.input.caseId, user))) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Validate name length
      if (args.input.name.length < 2 || args.input.name.length > 200) {
        throw new GraphQLError('Name must be 2-200 characters', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Validate email format if provided
      if (args.input.email && !isValidEmail(args.input.email)) {
        throw new GraphQLError('Invalid email format', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const actor = await prisma.$transaction(async (tx) => {
        const created = await tx.caseActor.create({
          data: {
            ...args.input,
            createdBy: user.id,
          },
        });

        await tx.caseAuditLog.create({
          data: {
            caseId: args.input.caseId,
            userId: user.id,
            action: 'ACTOR_ADDED',
            newValue: `${args.input.role}: ${args.input.name}`,
            timestamp: new Date(),
          },
        });

        return created;
      });

      return actor;
    },

    // Update case actor
    updateCaseActor: async (_: any, args: { id: string; input: any }, context: Context) => {
      const user = requireAuth(context);

      const existing = await prisma.caseActor.findUnique({
        where: { id: args.id },
      });

      if (!existing) {
        throw new GraphQLError('Actor not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (!(await canAccessCase(existing.caseId, user))) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Validate name length if provided
      if (args.input.name && (args.input.name.length < 2 || args.input.name.length > 200)) {
        throw new GraphQLError('Name must be 2-200 characters', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Validate email format if provided
      if (args.input.email && !isValidEmail(args.input.email)) {
        throw new GraphQLError('Invalid email format', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const actor = await tx.caseActor.update({
          where: { id: args.id },
          data: args.input,
        });

        // Log changed fields
        for (const [field, newValue] of Object.entries(args.input)) {
          const oldValue = (existing as any)[field];
          if (oldValue !== newValue) {
            await tx.caseAuditLog.create({
              data: {
                caseId: existing.caseId,
                userId: user.id,
                action: 'ACTOR_UPDATED',
                fieldName: field,
                oldValue: oldValue?.toString(),
                newValue: newValue?.toString(),
                timestamp: new Date(),
              },
            });
          }
        }

        return actor;
      });

      return updated;
    },

    // Remove case actor
    removeCaseActor: async (_: any, args: { id: string }, context: Context) => {
      const user = requireAuth(context);

      const existing = await prisma.caseActor.findUnique({
        where: { id: args.id },
      });

      if (!existing) {
        throw new GraphQLError('Actor not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      if (!(await canAccessCase(existing.caseId, user))) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.caseActor.delete({
          where: { id: args.id },
        });

        await tx.caseAuditLog.create({
          data: {
            caseId: existing.caseId,
            userId: user.id,
            action: 'ACTOR_REMOVED',
            oldValue: `${existing.role}: ${existing.name}`,
            timestamp: new Date(),
          },
        });
      });

      return true;
    },
  },

  // Field resolvers
  Case: {
    teamMembers: async (parent: any) => {
      const members = await prisma.caseTeam.findMany({
        where: { caseId: parent.id },
        include: { user: true },
      });
      return members;
    },

    // Story 2.8.1: Rate history resolver
    rateHistory: async (parent: any, _: any, context: Context) => {
      // Authorization is handled by @requiresFinancialAccess directive
      // This ensures only Partners can view rate history

      const history = await prisma.caseRateHistory.findMany({
        where: { caseId: parent.id },
        include: {
          changer: true,
        },
        orderBy: { changedAt: 'desc' },
        take: 50, // Pagination: limit to 50 most recent entries
      });

      return history.map((entry) => ({
        id: entry.id,
        caseId: entry.caseId,
        changedAt: entry.changedAt,
        changedBy: entry.changer,
        rateType: entry.rateType.toUpperCase(), // Convert to GraphQL enum format
        oldRate: entry.oldRate,
        newRate: entry.newRate,
      }));
    },

    // Story 2.11.2: Current retainer usage resolver
    currentRetainerUsage: async (parent: any, _: any, context: Context) => {
      // Authorization is handled by @requiresFinancialAccess directive
      // This ensures only Partners/BusinessOwners can view retainer usage

      const user = context.user;
      if (!user) return null;

      // Only calculate for Retainer billing type cases
      if (parent.billingType !== 'Retainer') {
        return null;
      }

      return retainerService.calculateCurrentUsage(parent.id, user.firmId);
    },
  },
};

// Export for tests and GraphQL server
export const resolvers = caseResolvers;
export default caseResolvers;
