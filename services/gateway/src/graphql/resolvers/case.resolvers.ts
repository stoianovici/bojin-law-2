/**
 * Case Management GraphQL Resolvers
 * Story 2.6: Case Management Data Model and API
 * Story 2.8.1: Billing & Rate Management
 * Story 2.8.2: Case Approval Workflow (notifications)
 * Story 2.11.2: Retainer Billing Support
 *
 * Implements all queries, mutations, and field resolvers for case management
 */

import { prisma, Prisma } from '@legal-platform/database';
import { EmailClassificationState, CaseActorRole } from '@prisma/client';
import { GraphQLError } from 'graphql';
import { Decimal } from '@prisma/client/runtime/library';
import { caseSummaryService } from '../../services/case-summary.service';
import { comprehensionTriggerService } from '../../services/comprehension-trigger.service';
import { notificationService } from '../../services/notification.service';
import { retainerService } from '../../services/retainer.service';
import {
  emailClassifierService,
  type EmailForClassification,
} from '../../services/email-classifier';
import { queueHistoricalSyncJob } from '../../workers/historical-email-sync.worker';
import { queueCaseSyncJob } from '../../workers/case-sync.worker';
import { caseSyncService } from '../../services/case-sync.service';
import { activityEventService } from '../../services/activity-event.service';
import { caseContextService } from '../../services/case-context.service';
import { emailReclassifierService } from '../../services/email-reclassifier';
import { requireAuth } from '../utils/auth';
import { extractCourtFileNumbers, normalizeCourtFileNumber } from '../../utils/reference-extractor';

// Types for GraphQL context
// Story 2.11.1: Added BusinessOwner role and financialDataScope
// Story 5.1: Added accessToken for email operations
export interface Context {
  user?: {
    id: string;
    firmId: string;
    role: 'Partner' | 'Associate' | 'AssociateJr' | 'Paralegal' | 'BusinessOwner' | 'Admin';
    email: string;
    accessToken?: string; // Story 5.1: MS access token for email operations
    firstName?: string;
    lastName?: string;
    name?: string;
    hasOperationalOversight?: boolean; // Allows non-partner users to see all cases without financials
  };
  // Story 2.11.1: Financial data scope for Partners and BusinessOwners
  financialDataScope?: 'own' | 'firm' | null;
  // Admin API key bypass for internal/automated operations
  isAdminBypass?: boolean;
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

  // Partners, BusinessOwners, and users with operational oversight can access all cases in their firm
  if (user.role === 'Partner' || user.role === 'BusinessOwner' || user.hasOperationalOversight)
    return true;

  // Non-partners (without oversight) must be assigned to the case
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

// Audit log helper (reserved for future use)
async function _createAuditLog(data: {
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
// OPS-XXX: Re-classify emails when case keywords/referenceNumbers change
// ============================================================================

/**
 * Re-classify Pending/Uncertain emails when case classification fields change.
 * Looks for emails from case actors/client and runs the scoring algorithm.
 */
async function reclassifyEmailsForCase(
  caseId: string,
  firmId: string,
  userId: string,
  fieldsChanged: { keywords?: boolean; referenceNumbers?: boolean }
): Promise<{ reclassified: number; errors: number }> {
  // Skip if no relevant fields changed
  if (!fieldsChanged.keywords && !fieldsChanged.referenceNumbers) {
    return { reclassified: 0, errors: 0 };
  }

  // Get case with actors and client
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      actors: { select: { email: true } },
      client: { select: { contactInfo: true } },
    },
  });

  if (!caseData) {
    return { reclassified: 0, errors: 0 };
  }

  // Collect all contact emails for this case
  const contactEmails: string[] = [];

  // Actor emails
  for (const actor of caseData.actors) {
    if (actor.email) {
      contactEmails.push(actor.email.toLowerCase());
    }
  }

  // Client email
  const clientEmail = (caseData.client?.contactInfo as { email?: string })?.email;
  if (clientEmail) {
    contactEmails.push(clientEmail.toLowerCase());
  }

  if (contactEmails.length === 0) {
    return { reclassified: 0, errors: 0 };
  }

  // Build OR conditions for matching emails by sender OR recipient
  const emailConditions: Prisma.EmailWhereInput[] = contactEmails.flatMap((email) => [
    // Match received emails by sender
    { from: { path: ['address'], string_contains: email } },
    // Match sent emails by recipient
    { toRecipients: { array_contains: [{ address: email }] } },
    { ccRecipients: { array_contains: [{ address: email }] } },
  ]);

  // Find Pending/Uncertain/ClientInbox emails from case contacts
  const emailsToReclassify = await prisma.email.findMany({
    where: {
      firmId,
      caseId: null, // Only unassigned emails
      classificationState: {
        in: [
          EmailClassificationState.Pending,
          EmailClassificationState.Uncertain,
          EmailClassificationState.ClientInbox,
        ],
      },
      OR: emailConditions,
    },
    select: {
      id: true,
      conversationId: true,
      subject: true,
      bodyPreview: true,
      from: true,
      toRecipients: true,
      ccRecipients: true,
      receivedDateTime: true,
      userId: true,
      user: { select: { role: true } },
    },
    take: 500, // Limit to prevent overwhelming the system
  });

  if (emailsToReclassify.length === 0) {
    return { reclassified: 0, errors: 0 };
  }

  console.log(
    `[reclassifyEmailsForCase] Processing ${emailsToReclassify.length} emails for case ${caseId}`
  );

  let reclassified = 0;
  let errors = 0;

  for (const email of emailsToReclassify) {
    try {
      // Build email object for classification
      const emailForClassify: EmailForClassification = {
        id: email.id,
        conversationId: email.conversationId,
        subject: email.subject || '',
        bodyPreview: email.bodyPreview || '',
        from: email.from as { name?: string; address: string },
        toRecipients: (email.toRecipients as Array<{ name?: string; address: string }>) || [],
        ccRecipients: (email.ccRecipients as Array<{ name?: string; address: string }>) || [],
        receivedDateTime: email.receivedDateTime,
      };

      // Run classification with the email owner's context
      const result = await emailClassifierService.classifyEmail(
        emailForClassify,
        firmId,
        email.userId
      );

      // Check if this email should now be assigned to this specific case
      const matchesThisCase = result.caseId === caseId;

      // OPS-XXX: Partner/BusinessOwner emails are private by default
      const isPartnerOwner = email.user?.role === 'Partner' || email.user?.role === 'BusinessOwner';

      if (result.state === EmailClassificationState.Classified && matchesThisCase) {
        // Create EmailCaseLink and update Email record in parallel
        await Promise.all([
          // Create the EmailCaseLink entry (for multi-case email support)
          prisma.emailCaseLink.upsert({
            where: {
              emailId_caseId: { emailId: email.id, caseId: caseId },
            },
            create: {
              emailId: email.id,
              caseId: caseId,
              confidence: result.confidence,
              matchType: 'Keyword', // Matched via keywords/scoring
              linkedBy: 'case_metadata_update',
              isPrimary: true,
            },
            update: {
              confidence: result.confidence,
            },
          }),
          // Update legacy Email.caseId field for backwards compatibility
          prisma.email.update({
            where: { id: email.id },
            data: {
              caseId: caseId,
              clientId: null,
              classificationState: EmailClassificationState.Classified,
              classificationConfidence: result.confidence,
              classifiedAt: new Date(),
              classifiedBy: 'case_metadata_update',
              // Partner/BusinessOwner emails are private by default
              ...(isPartnerOwner && {
                isPrivate: true,
                markedPrivateBy: email.userId,
              }),
            },
          }),
        ]);
        reclassified++;
      } else if (result.state === EmailClassificationState.ClientInbox && result.clientId) {
        // Route to ClientInbox for multi-case clients
        await prisma.email.update({
          where: { id: email.id },
          data: {
            clientId: result.clientId,
            classificationState: EmailClassificationState.ClientInbox,
            classifiedAt: new Date(),
            classifiedBy: 'case_metadata_update',
            // Partner/BusinessOwner emails are private by default
            ...(isPartnerOwner && {
              isPrivate: true,
              markedPrivateBy: email.userId,
            }),
          },
        });
        reclassified++;
      }
    } catch (err) {
      console.error(`[reclassifyEmailsForCase] Error processing email ${email.id}:`, err);
      errors++;
    }
  }

  // =========================================================================
  // Court Emails (INSTANȚE folder) - search by reference number match
  // When referenceNumbers change, search CourtUnassigned emails for matches
  // =========================================================================
  if (fieldsChanged.referenceNumbers && caseData.referenceNumbers.length > 0) {
    // Normalize the case's reference numbers for matching
    const caseRefNumbers = caseData.referenceNumbers.map((ref) => normalizeCourtFileNumber(ref));

    console.log(
      `[reclassifyEmailsForCase] Searching INSTANȚE folder for reference numbers: ${caseRefNumbers.join(', ')}`
    );

    // Find CourtUnassigned emails from the firm (these are in the INSTANȚE folder)
    const courtEmails = await prisma.email.findMany({
      where: {
        firmId,
        classificationState: EmailClassificationState.CourtUnassigned,
      },
      select: {
        id: true,
        conversationId: true,
        subject: true,
        bodyPreview: true,
        bodyContent: true,
        from: true,
        toRecipients: true,
        ccRecipients: true,
        receivedDateTime: true,
        userId: true,
        user: { select: { role: true } },
      },
      take: 500, // Limit to prevent overwhelming the system
    });

    console.log(
      `[reclassifyEmailsForCase] Found ${courtEmails.length} CourtUnassigned emails to check`
    );

    for (const courtEmail of courtEmails) {
      try {
        // Extract reference numbers from the email content
        const textToSearch = `${courtEmail.subject || ''} ${courtEmail.bodyPreview || ''} ${courtEmail.bodyContent || ''}`;
        const extractedRefs = extractCourtFileNumbers(textToSearch);

        if (extractedRefs.length === 0) {
          continue; // No reference numbers in this email
        }

        // Check if any extracted reference matches the case's reference numbers
        const hasMatch = extractedRefs.some((extractedRef) =>
          caseRefNumbers.includes(normalizeCourtFileNumber(extractedRef))
        );

        if (hasMatch) {
          console.log(
            `[reclassifyEmailsForCase] Court email ${courtEmail.id} matches case ${caseId} via reference: ${extractedRefs.join(', ')}`
          );

          // Check if Partner/BusinessOwner for privacy setting
          const isPartnerOwner =
            courtEmail.user?.role === 'Partner' || courtEmail.user?.role === 'BusinessOwner';

          // Create EmailCaseLink and update Email record in parallel
          await Promise.all([
            // Create the EmailCaseLink entry (for multi-case email support OPS-060)
            prisma.emailCaseLink.create({
              data: {
                emailId: courtEmail.id,
                caseId: caseId,
                confidence: 1.0,
                matchType: 'ReferenceNumber', // Matched via court file number
                linkedBy: userId,
                isPrimary: true, // This is the primary case for the email
              },
            }),
            // Update legacy Email.caseId field for backwards compatibility
            prisma.email.update({
              where: { id: courtEmail.id },
              data: {
                caseId: caseId,
                classificationState: EmailClassificationState.Classified,
                classificationConfidence: 1.0,
                classifiedAt: new Date(),
                classifiedBy: 'case_metadata_update',
                // Partner/BusinessOwner emails are private by default
                ...(isPartnerOwner && {
                  isPrivate: true,
                  markedPrivateBy: courtEmail.userId,
                }),
              },
            }),
          ]);
          reclassified++;
        }
      } catch (err) {
        console.error(
          `[reclassifyEmailsForCase] Error processing court email ${courtEmail.id}:`,
          err
        );
        errors++;
      }
    }
  }

  if (reclassified > 0) {
    console.log(`[reclassifyEmailsForCase] Reclassified ${reclassified} emails for case ${caseId}`);
  }

  return { reclassified, errors };
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

  // If billing type is Retainer, retainerAmount and retainerPeriod are required
  if (input.billingType === 'Retainer') {
    if (input.retainerAmount === null || input.retainerAmount === undefined) {
      throw new GraphQLError('Suma abonament este obligatorie', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    if (input.retainerAmount <= 0) {
      throw new GraphQLError('Suma abonament trebuie să fie pozitivă', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    if (!input.retainerPeriod) {
      throw new GraphQLError('Perioada abonament este obligatorie', {
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

      // Filter by assigned cases when explicitly requested
      if (args.assignedToMe) {
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

    // Get paginated cases with cursor-based pagination
    // Mobile Performance Optimization: Returns connection format with edges, pageInfo, totalCount
    paginatedCases: async (
      _: any,
      args: { status?: string; first?: number; after?: string },
      context: Context
    ) => {
      const user = requireAuth(context);
      const limit = Math.min(args.first || 50, 100);

      // Build where clause
      const where: Prisma.CaseWhereInput = {
        firmId: user.firmId,
      };

      // Apply status filter
      if (args.status) {
        where.status = args.status as any;
      }

      // Non-Partner/BusinessOwner users can only see their assigned cases (unless operational oversight)
      if (
        user.role !== 'Partner' &&
        user.role !== 'BusinessOwner' &&
        !user.hasOperationalOversight
      ) {
        where.teamMembers = {
          some: {
            userId: user.id,
          },
        };
      }

      // Get total count for the filtered query
      const totalCount = await prisma.case.count({ where });

      // Build cursor query - decode base64 cursor to case ID
      const cursorQuery: { cursor?: { id: string }; skip?: number } = {};
      if (args.after) {
        try {
          const decodedCursor = Buffer.from(args.after, 'base64').toString('utf-8');
          cursorQuery.cursor = { id: decodedCursor };
          cursorQuery.skip = 1; // Skip the cursor item itself
        } catch {
          throw new GraphQLError('Invalid cursor format', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
      }

      // Fetch one extra item to determine hasNextPage
      const cases = await prisma.case.findMany({
        where,
        take: limit + 1,
        ...cursorQuery,
        orderBy: { updatedAt: 'desc' },
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

      // Determine if there are more items
      const hasNextPage = cases.length > limit;

      // Slice to requested limit (remove the extra item used for hasNextPage check)
      const resultCases = cases.slice(0, limit);

      // Build edges with cursors (base64 encoded case ID)
      const edges = resultCases.map((c) => ({
        node: c,
        cursor: Buffer.from(c.id).toString('base64'),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: !!args.after,
          startCursor: edges.length > 0 ? edges[0].cursor : null,
          endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
        },
        totalCount,
      };
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

    // Get billing status for a case (fixed sum or retainer)
    caseBillingStatus: async (_: any, args: { caseId: string }, context: Context) => {
      const user = requireAuth(context);

      // Check case access
      if (!(await canAccessCase(args.caseId, user))) {
        throw new GraphQLError('Not authorized to view this case', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Get case with billing info
      const caseData = await prisma.case.findUnique({
        where: { id: args.caseId },
        select: {
          id: true,
          billingType: true,
          fixedAmount: true,
          retainerAmount: true,
        },
      });

      if (!caseData) {
        throw new GraphQLError('Case not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Only return status for Fixed or Retainer billing types
      if (caseData.billingType === 'Hourly') {
        return null;
      }

      // Get total amount based on billing type
      const totalAmountEur =
        caseData.billingType === 'Fixed'
          ? Number(caseData.fixedAmount || 0)
          : Number(caseData.retainerAmount || 0);

      // Get billing history for this case
      const historyEntries = await prisma.caseBillingHistory.findMany({
        where: { caseId: args.caseId },
        include: {
          user: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Calculate invoiced amount from history
      // Sum InvoiceCreated events, subtract InvoiceCancelled events
      let invoicedAmountEur = 0;
      for (const entry of historyEntries) {
        if (entry.eventType === 'InvoiceCreated') {
          invoicedAmountEur += Number(entry.amountEur);
        } else if (entry.eventType === 'InvoiceCancelled') {
          invoicedAmountEur -= Number(entry.amountEur);
        }
      }

      // Ensure non-negative
      invoicedAmountEur = Math.max(0, invoicedAmountEur);

      return {
        caseId: args.caseId,
        billingType: caseData.billingType,
        totalAmountEur,
        invoicedAmountEur,
        remainingAmountEur: Math.max(0, totalAmountEur - invoicedAmountEur),
        history: historyEntries.map((entry) => ({
          id: entry.id,
          eventType: entry.eventType,
          amountEur: Number(entry.amountEur),
          previousAmountEur: entry.previousAmountEur ? Number(entry.previousAmountEur) : null,
          notes: entry.notes,
          createdAt: entry.createdAt,
          createdBy: entry.user,
          invoiceId: entry.invoiceId,
        })),
      };
    },

    // Full-text search (returns recent cases when query is empty)
    searchCases: async (_: any, args: { query: string; limit?: number }, context: Context) => {
      const user = requireAuth(context);
      const limit = Math.min(args.limit || 50, 100);

      // When query is empty or too short, return recent cases
      // All users can search all cases in their firm (for task/event creation)
      if (args.query.length < 2) {
        return prisma.case.findMany({
          where: { firmId: user.firmId },
          include: {
            client: true,
            teamMembers: {
              include: { user: true },
            },
            actors: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: limit,
        });
      }

      // Use PostgreSQL pg_trgm similarity + ILIKE for flexible search
      // ILIKE handles exact substring matches, similarity handles fuzzy matches
      const likePattern = `%${args.query}%`;

      // All users can search all cases in their firm
      const results = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `
        SELECT c.id
        FROM cases c
        JOIN clients cl ON c.client_id = cl.id
        WHERE (
          c.title ILIKE $1 OR
          c.case_number ILIKE $1 OR
          c.description ILIKE $1 OR
          cl.name ILIKE $1 OR
          c.title % $2 OR
          c.description % $2 OR
          cl.name % $2
        )
        AND c.firm_id::text = $3
        ORDER BY
          CASE WHEN c.title ILIKE $1 THEN 1
               WHEN c.case_number ILIKE $1 THEN 2
               WHEN cl.name ILIKE $1 THEN 3
               ELSE 4 END,
          GREATEST(
            similarity(c.title, $2),
            similarity(c.description, $2),
            similarity(cl.name, $2)
          ) DESC
        LIMIT $4
        `,
        likePattern,
        args.query,
        user.firmId,
        limit
      );

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

    // Search clients by name for autocomplete (returns all clients when query is empty)
    searchClients: async (_: any, args: { query: string; limit?: number }, context: Context) => {
      const user = requireAuth(context);
      const limit = Math.min(args.limit || 15, 50);

      // When query is empty, return all clients sorted by name
      if (args.query.length < 1) {
        return prisma.client.findMany({
          where: { firmId: user.firmId },
          orderBy: { name: 'asc' },
          take: limit,
        });
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

    // OPS-239: Get cases sorted by health score
    casesByHealthScore: async (
      _: any,
      args: { maxScore?: number; order?: string; limit?: number },
      context: Context
    ) => {
      const user = requireAuth(context);

      // Require Partner role for dashboard view
      if (user.role !== 'Partner' && user.role !== 'BusinessOwner') {
        throw new GraphQLError('Partner access required for health dashboard', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const limit = Math.min(args.limit || 50, 100);
      const maxScore = args.maxScore || 100;
      const orderDir = args.order === 'desc' ? 'desc' : 'asc';

      // Get latest health scores for each case
      const healthScores = await prisma.caseHealthScore.findMany({
        where: {
          firmId: user.firmId,
          score: { lte: maxScore },
        },
        orderBy: { calculatedAt: 'desc' },
        distinct: ['caseId'],
        include: {
          case: {
            include: {
              client: true,
              teamMembers: { include: { user: true } },
              actors: true,
            },
          },
        },
      });

      // Sort by score and return cases
      const sorted = healthScores.sort((a, b) =>
        orderDir === 'asc' ? a.score - b.score : b.score - a.score
      );

      return sorted.slice(0, limit).map((hs) => hs.case);
    },

    // OPS-239: Get health score history for a case
    caseHealthHistory: async (
      _: any,
      args: { caseId: string; limit?: number },
      context: Context
    ) => {
      const user = requireAuth(context);

      if (!(await canAccessCase(args.caseId, user))) {
        throw new GraphQLError('Not authorized to view this case', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const limit = Math.min(args.limit || 30, 100);

      return prisma.caseHealthScore.findMany({
        where: {
          caseId: args.caseId,
          firmId: user.firmId,
        },
        orderBy: { calculatedAt: 'desc' },
        take: limit,
      });
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
        // Build contactInfo JSON object from provided fields
        const contactInfo: { email?: string; phone?: string } = {};
        if (args.input.clientEmail?.trim()) {
          contactInfo.email = args.input.clientEmail.trim();
        }
        if (args.input.clientPhone?.trim()) {
          contactInfo.phone = args.input.clientPhone.trim();
        }

        // Prepare administrators and contacts arrays with IDs
        const preparePersons = (
          persons:
            | Array<{ id?: string; name: string; role: string; email?: string; phone?: string }>
            | undefined
        ) => {
          if (!persons || persons.length === 0) return [];
          return persons.map((p) => ({
            id: p.id || crypto.randomUUID(),
            name: p.name,
            role: p.role,
            email: p.email || undefined,
            phone: p.phone || undefined,
          }));
        };

        const administrators = preparePersons(args.input.clientAdministrators);
        const contacts = preparePersons(args.input.clientContacts);

        // Create new client with the provided name, contact info, and company details
        client = await prisma.client.create({
          data: {
            firmId: user.firmId,
            name: args.input.clientName,
            contactInfo: Object.keys(contactInfo).length > 0 ? contactInfo : {},
            address: args.input.clientAddress?.trim() || null,
            clientType: args.input.clientType || 'company',
            companyType: args.input.companyType || null,
            cui: args.input.clientCui?.trim() || null,
            registrationNumber: args.input.clientRegistrationNumber?.trim() || null,
            administrators: administrators as unknown as Prisma.InputJsonValue,
            contacts: contacts as unknown as Prisma.InputJsonValue,
          },
        });
      }

      // Inherit billing defaults from client if not explicitly provided
      // Note: Associates can't set billing fields (hidden in UI), so they default to Hourly
      // Partners can configure proper billing when approving the case
      const canSetBilling = user.role === 'Partner';
      const billingType = canSetBilling
        ? (args.input.billingType ?? client.billingType ?? 'Hourly')
        : 'Hourly';
      const fixedAmount = canSetBilling
        ? (args.input.fixedAmount ??
          (billingType === 'Fixed'
            ? client.fixedAmount
              ? Number(client.fixedAmount)
              : null
            : null))
        : null;
      const retainerAmount = canSetBilling
        ? (args.input.retainerAmount ??
          (billingType === 'Retainer'
            ? client.retainerAmount
              ? Number(client.retainerAmount)
              : null
            : null))
        : null;
      const retainerPeriod = canSetBilling
        ? (args.input.retainerPeriod ?? (billingType === 'Retainer' ? client.retainerPeriod : null))
        : null;
      const retainerAutoRenew = canSetBilling
        ? (args.input.retainerAutoRenew ??
          (billingType === 'Retainer' ? client.retainerAutoRenew : false))
        : false;
      const retainerRollover = canSetBilling
        ? (args.input.retainerRollover ??
          (billingType === 'Retainer' ? client.retainerRollover : false))
        : false;

      // Story 2.8.1: Validate billing input (only for Partners who can set billing)
      if (canSetBilling && billingType !== 'Hourly') {
        const billingInputForValidation = {
          billingType,
          fixedAmount,
          customRates: args.input.customRates ?? client.customRates,
          retainerAmount,
          retainerPeriod,
        };
        validateBillingInput(billingInputForValidation);
      }

      // Story 2.8.1: Get firm default rates to populate customRates if not provided
      let customRates = args.input.customRates ?? client.customRates;
      if (!customRates) {
        const firmRates = await getFirmDefaultRates(user.firmId);
        if (firmRates) {
          customRates = firmRates;
        }
      }

      // OPS-218: Use provided court case number or generate internal tracking number
      const caseNumber = args.input.caseNumber?.trim() || (await generateCaseNumber(user.firmId));

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
            // Story 2.8.1: Billing fields (with client defaults inheritance)
            billingType,
            fixedAmount,
            customRates: customRates as any,
            retainerAmount,
            retainerPeriod,
            retainerAutoRenew,
            retainerRollover,
            // Classification fields
            keywords: args.input.keywords || [],
            referenceNumbers: args.input.referenceNumbers || [],
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

        // Assign additional team members if provided
        if (args.input.teamMembers?.length > 0) {
          for (const member of args.input.teamMembers) {
            // Skip if member is already assigned (e.g., creator as Lead)
            if (member.userId === user.id) continue;

            await tx.caseTeam.create({
              data: {
                caseId: createdCase.id,
                userId: member.userId,
                role: member.role,
                assignedBy: user.id,
              },
            });
          }
        }

        // Automatically add client as actor if they have an email (for email classification)
        const clientEmail = (client.contactInfo as { email?: string })?.email;
        if (clientEmail) {
          await tx.caseActor.create({
            data: {
              caseId: createdCase.id,
              email: clientEmail.toLowerCase().trim(),
              name: client.name,
              role: CaseActorRole.Client,
              createdBy: user.id,
            },
          });
        }

        // Create contacts as CaseActors
        if (args.input.contacts?.length > 0) {
          const roleMapping: Record<string, CaseActorRole> = {
            Client: CaseActorRole.Client,
            OpposingParty: CaseActorRole.OpposingParty,
            OpposingCounsel: CaseActorRole.OpposingCounsel,
            Witness: CaseActorRole.Witness,
            Expert: CaseActorRole.Expert,
            Intervenient: CaseActorRole.Intervenient,
            Mandatar: CaseActorRole.Mandatar,
            Court: CaseActorRole.Court,
            Prosecutor: CaseActorRole.Prosecutor,
            Bailiff: CaseActorRole.Bailiff,
            Notary: CaseActorRole.Notary,
            LegalRepresentative: CaseActorRole.LegalRepresentative,
          };

          for (const contact of args.input.contacts) {
            const role =
              contact.role && roleMapping[contact.role]
                ? roleMapping[contact.role]
                : CaseActorRole.Other;
            const customRoleCode =
              role === CaseActorRole.Other && contact.role ? contact.role : null;

            await tx.caseActor.create({
              data: {
                caseId: createdCase.id,
                email: contact.email.toLowerCase().trim(),
                name: contact.name?.trim() || contact.email,
                role,
                customRoleCode,
                createdBy: user.id,
              },
            });
          }
        }

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

      // Queue case sync job (uses app-only tokens, no user session required)
      try {
        await queueCaseSyncJob({
          caseId: newCase.id,
          userId: user.id,
        });
      } catch (syncError) {
        // Log but don't fail case creation - sync can be retried
        console.error('[createCase] Failed to queue sync job:', syncError);
        // Mark as completed to prevent stale 'Pending' state
        await prisma.case.update({
          where: { id: newCase.id },
          data: { syncStatus: 'Completed' },
        });
      }

      // Queue historical email sync for each contact (uses app-only tokens)
      if (args.input.contacts?.length > 0) {
        for (const contact of args.input.contacts) {
          try {
            await queueHistoricalSyncJob({
              caseId: newCase.id,
              contactEmail: contact.email.toLowerCase().trim(),
              userId: user.id,
            });
            console.log(
              `[createCase] Queued historical email sync for ${contact.email} on case ${newCase.id}`
            );
          } catch (syncErr) {
            console.error('[createCase] Error queuing historical sync:', syncErr);
          }
        }
      }

      // Notify partners if case was created by non-partner without financial setup
      // (when an associate introduces a client/case, partner needs to add billing info)
      const isNonPartner = user.role !== 'Partner' && user.role !== 'BusinessOwner';
      const hasBillingSetup =
        args.input.billingType || args.input.customRates || args.input.fixedAmount;

      if (isNonPartner && !hasBillingSetup) {
        const userName =
          user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.name || user.email;

        try {
          await notificationService.notifyCaseNeedsFinancialSetup(user.firmId, {
            caseId: newCase.id,
            caseTitle: newCase.title,
            actorName: userName,
          });
        } catch (notifErr) {
          // Log but don't fail case creation
          console.error('[createCase] Failed to send financial setup notification:', notifErr);
        }
      }

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
        args.input.customRates !== undefined ||
        args.input.retainerAmount !== undefined ||
        args.input.retainerPeriod !== undefined ||
        args.input.retainerAutoRenew !== undefined ||
        args.input.retainerRollover !== undefined
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
      const hasBillingUpdate =
        args.input.billingType ||
        args.input.fixedAmount !== undefined ||
        args.input.customRates ||
        args.input.retainerAmount !== undefined ||
        args.input.retainerPeriod;
      if (hasBillingUpdate) {
        const effectiveBillingType = args.input.billingType || existingCase.billingType;
        validateBillingInput({
          billingType: effectiveBillingType,
          fixedAmount:
            args.input.fixedAmount !== undefined
              ? args.input.fixedAmount
              : existingCase.fixedAmount,
          customRates: args.input.customRates,
          retainerAmount:
            args.input.retainerAmount !== undefined
              ? args.input.retainerAmount
              : existingCase.retainerAmount,
          retainerPeriod: args.input.retainerPeriod || existingCase.retainerPeriod,
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
          args.input.customRates !== undefined ||
          args.input.retainerAmount !== undefined ||
          args.input.retainerPeriod !== undefined ||
          args.input.retainerAutoRenew !== undefined ||
          args.input.retainerRollover !== undefined;

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

      // OPS-047: Mark case summary as stale after update
      caseSummaryService.markSummaryStale(args.id).catch(() => {});

      // Invalidate AI context cache after case update
      caseContextService.invalidateCoreContext(args.id).catch(() => {});

      // OPS-116: Emit CASE_STATUS_CHANGED event if status was updated
      if (args.input.status && args.input.status !== existingCase.status) {
        // Notify all team members about the status change
        const teamMembers = await prisma.caseTeam.findMany({
          where: { caseId: args.id },
          select: { userId: true },
        });

        activityEventService
          .emitForUsers(
            teamMembers.map((m) => m.userId).filter((id) => id !== user.id),
            {
              firmId: user.firmId,
              eventType: 'CASE_STATUS_CHANGED',
              entityType: 'CASE',
              entityId: args.id,
              entityTitle: `${updatedCase.caseNumber}: ${updatedCase.title}`,
              metadata: {
                oldStatus: existingCase.status,
                newStatus: args.input.status,
                changedBy: user.id,
              },
            }
          )
          .catch((err) => console.error('[updateCase] Failed to emit status change event:', err));

        // Trigger immediate regeneration for case status change
        comprehensionTriggerService
          .handleEvent(args.id, 'case_status_changed', user.firmId, { userId: user.id })
          .catch(() => {});
      }

      // OPS-XXX: Re-classify emails when keywords or referenceNumbers change
      const keywordsChanged =
        args.input.keywords !== undefined &&
        JSON.stringify(args.input.keywords) !== JSON.stringify(existingCase.keywords);
      const refsChanged =
        args.input.referenceNumbers !== undefined &&
        JSON.stringify(args.input.referenceNumbers) !==
          JSON.stringify(existingCase.referenceNumbers);

      if (keywordsChanged || refsChanged) {
        // Run async to not block the mutation response
        reclassifyEmailsForCase(args.id, user.firmId, user.id, {
          keywords: keywordsChanged,
          referenceNumbers: refsChanged,
        }).catch((err) => console.error('[updateCase] Email reclassification failed:', err));

        // Mark comprehension stale when case keywords/references change
        comprehensionTriggerService
          .handleEvent(args.id, 'case_updated', user.firmId, { userId: user.id })
          .catch(() => {});
      }

      // Trigger reclassification for new reference numbers using emailReclassifierService
      if (refsChanged && args.input.referenceNumbers) {
        // Find which reference numbers are new (not in the existing list)
        const existingRefs = new Set(existingCase.referenceNumbers || []);
        const newReferenceNumbers = (args.input.referenceNumbers as string[]).filter(
          (ref: string) => !existingRefs.has(ref)
        );

        // Trigger reclassification for each new reference number
        for (const newRef of newReferenceNumbers) {
          emailReclassifierService
            .onCaseReferenceAdded(args.id, newRef, user.firmId)
            .then((count) => {
              if (count > 0) {
                console.log(
                  `[CaseResolver] Reclassified ${count} emails for new reference ${newRef}`
                );
              }
            })
            .catch((err) =>
              console.error(`[CaseResolver] Reclassification failed for reference ${newRef}:`, err)
            );
        }
      }

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

    // Delete case (permanent deletion)
    deleteCase: async (
      _: any,
      args: { id: string; input: { archiveDocuments: boolean } },
      context: Context
    ) => {
      console.log('[deleteCase] Starting deletion for case:', args.id);
      const user = requireAuth(context);
      console.log('[deleteCase] User context:', {
        userId: user.id,
        firmId: user.firmId,
        role: user.role,
      });

      if (user.role !== 'Partner') {
        throw new GraphQLError('Only Partners can delete cases', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      // Fetch case with all relations needed for return value
      const existingCase = await prisma.case.findUnique({
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

      if (!existingCase) {
        throw new GraphQLError('Case not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      console.log('[deleteCase] Case found:', {
        caseId: existingCase.id,
        caseFirmId: existingCase.firmId,
        userFirmId: user.firmId,
      });

      if (existingCase.firmId !== user.firmId) {
        console.log(
          '[deleteCase] FirmId mismatch! Case firmId:',
          existingCase.firmId,
          'User firmId:',
          user.firmId
        );
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      if (existingCase.status === 'Archived') {
        throw new GraphQLError('Cannot delete archived cases', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      // Perform permanent deletion in transaction
      try {
        await prisma.$transaction(async (tx) => {
          const caseId = args.id;
          const clientId = existingCase.clientId;

          // ====================================================================
          // 1. Move tasks to client inbox (preserve task data)
          // ====================================================================
          await tx.task.updateMany({
            where: { caseId },
            data: {
              caseId: null,
              clientId: clientId,
            },
          });

          // ====================================================================
          // 2. Move emails to client inbox (preserve clientId, set ClientInbox state)
          // ====================================================================
          await tx.email.updateMany({
            where: { caseId },
            data: {
              caseId: null,
              clientId: clientId, // Preserve client association
              classificationState: 'ClientInbox', // Move to client inbox, not Pending
              classificationConfidence: null,
              classifiedAt: new Date(),
              classifiedBy: 'case-deletion',
            },
          });

          // ====================================================================
          // 3. Delete extracted entities (case-specific AI extractions)
          // ====================================================================
          await tx.extractedDeadline.deleteMany({ where: { caseId } });
          await tx.extractedCommitment.deleteMany({ where: { caseId } });
          await tx.extractedActionItem.deleteMany({ where: { caseId } });
          await tx.extractedQuestion.deleteMany({ where: { caseId } });

          // ====================================================================
          // 4. Delete AI-related data
          // ====================================================================
          await tx.aISuggestion.deleteMany({ where: { caseId } });
          await tx.aIConversation.deleteMany({ where: { caseId } });
          await tx.emailDraft.deleteMany({ where: { caseId } });
          await tx.sentEmailDraft.deleteMany({ where: { caseId } });

          // ====================================================================
          // 5. Delete thread summaries and risk indicators
          // ====================================================================
          await tx.threadSummary.deleteMany({ where: { caseId } });
          await tx.riskIndicator.deleteMany({ where: { caseId } });

          // ====================================================================
          // 6. Delete communication entries and exports
          // ====================================================================
          await tx.communicationAttachment.deleteMany({
            where: { communicationEntry: { caseId } },
          });
          await tx.communicationEntry.deleteMany({ where: { caseId } });
          await tx.communicationExport.deleteMany({ where: { caseId } });
          await tx.bulkCommunication.deleteMany({ where: { caseId } });

          // ====================================================================
          // 8. Clear case from notifications
          // ====================================================================
          await tx.notification.updateMany({
            where: { caseId },
            data: { caseId: null },
          });

          // ====================================================================
          // 9. Handle documents based on archiveDocuments option
          // ====================================================================
          const { archiveDocuments } = args.input;

          // First find all documents linked to this case
          const caseDocuments = await tx.caseDocument.findMany({
            where: { caseId },
            include: {
              document: {
                select: {
                  id: true,
                  sourceType: true,
                },
              },
            },
          });

          if (archiveDocuments) {
            // ARCHIVE: Move all CaseDocuments to client inbox
            // Set caseId = null, clientId = case's clientId
            await tx.caseDocument.updateMany({
              where: { caseId },
              data: {
                caseId: null,
                clientId: clientId,
              },
            });
          } else {
            // DELETE: Delete in-app docs, move external docs to client
            const inAppDocumentIds = caseDocuments
              .filter(
                (cd) =>
                  cd.document.sourceType === 'UPLOAD' ||
                  cd.document.sourceType === 'EMAIL_ATTACHMENT'
              )
              .map((cd) => cd.document.id);

            const externalDocumentIds = caseDocuments
              .filter(
                (cd) =>
                  cd.document.sourceType !== 'UPLOAD' &&
                  cd.document.sourceType !== 'EMAIL_ATTACHMENT'
              )
              .map((cd) => cd.documentId);

            // Move external documents to client inbox
            if (externalDocumentIds.length > 0) {
              await tx.caseDocument.updateMany({
                where: {
                  caseId,
                  documentId: { in: externalDocumentIds },
                },
                data: {
                  caseId: null,
                  clientId: clientId,
                },
              });
            }

            // Delete in-app documents
            if (inAppDocumentIds.length > 0) {
              // First delete CaseDocument links for in-app docs
              await tx.caseDocument.deleteMany({
                where: {
                  caseId,
                  documentId: { in: inAppDocumentIds },
                },
              });
              // Unlink email attachments (no cascade on documentId)
              await tx.emailAttachment.updateMany({
                where: { documentId: { in: inAppDocumentIds } },
                data: { documentId: null },
              });
              // Delete audit logs (no cascade on documentId)
              await tx.documentAuditLog.deleteMany({
                where: { documentId: { in: inAppDocumentIds } },
              });
              // Delete the documents themselves
              await tx.document.deleteMany({
                where: { id: { in: inAppDocumentIds } },
              });
            }
          }

          // ====================================================================
          // 10. Delete the case (cascades all remaining relations)
          // ====================================================================
          await tx.case.delete({
            where: { id: caseId },
          });
        });
      } catch (error) {
        console.error('[deleteCase] Transaction failed:', error);
        throw new GraphQLError(
          `Failed to delete case: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { extensions: { code: 'INTERNAL_SERVER_ERROR' } }
        );
      }

      // Return the case data as it was before deletion
      // Note: Return 'Closed' status since 'Deleted' is not a valid CaseStatus enum value
      return {
        ...existingCase,
        status: 'Closed',
        closedDate: existingCase.closedDate || new Date(),
      };
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

      // Check if already assigned (for audit logging)
      const existing = await prisma.caseTeam.findUnique({
        where: {
          caseId_userId: {
            caseId: args.input.caseId,
            userId: args.input.userId,
          },
        },
      });

      // Use upsert to handle both new assignments and role updates
      const assignment = await prisma.$transaction(async (tx) => {
        const result = await tx.caseTeam.upsert({
          where: {
            caseId_userId: {
              caseId: args.input.caseId,
              userId: args.input.userId,
            },
          },
          update: {
            role: args.input.role,
          },
          create: {
            caseId: args.input.caseId,
            userId: args.input.userId,
            role: args.input.role,
            assignedBy: user.id,
          },
          include: {
            user: true,
          },
        });

        // Log appropriate action based on whether this was new or update
        await tx.caseAuditLog.create({
          data: {
            caseId: args.input.caseId,
            userId: user.id,
            action: existing ? 'TEAM_ROLE_UPDATED' : 'TEAM_ASSIGNED',
            oldValue: existing?.role,
            newValue: args.input.role,
            timestamp: new Date(),
          },
        });

        return result;
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

      // Auto-assign unclassified emails from this contact to the case
      // OPS-041: When a contact with email is added, find matching emails and assign them
      const contactEmail = args.input.email?.toLowerCase();
      const contactDomains = args.input.emailDomains || [];

      if (contactEmail || contactDomains.length > 0) {
        try {
          // Build conditions for matching emails
          const emailConditions: any[] = [];

          if (contactEmail) {
            // Match exact email address in the "from" JSON field
            emailConditions.push({
              from: { path: ['address'], string_contains: contactEmail },
            });
          }

          // Match email domains
          for (const domain of contactDomains) {
            emailConditions.push({
              from: { path: ['address'], string_ends_with: `@${domain.toLowerCase()}` },
            });
          }

          if (emailConditions.length > 0) {
            // Find and assign matching emails that are Pending or Uncertain
            const assignResult = await prisma.email.updateMany({
              where: {
                firmId: user.firmId,
                caseId: null, // Only unassigned emails
                classificationState: {
                  in: [EmailClassificationState.Pending, EmailClassificationState.Uncertain],
                },
                OR: emailConditions,
              },
              data: {
                caseId: args.input.caseId,
                classificationState: EmailClassificationState.Classified,
                classificationConfidence: 0.95,
                classifiedAt: new Date(),
                classifiedBy: 'contact_match',
              },
            });

            if (assignResult.count > 0) {
              console.log(
                `[addCaseActor] Auto-assigned ${assignResult.count} emails to case ${args.input.caseId} based on contact ${contactEmail || contactDomains.join(', ')}`
              );
            }
          }
        } catch (err) {
          // Log but don't fail the mutation if email assignment fails
          console.error('[addCaseActor] Error auto-assigning emails:', err);
        }
      }

      // Re-classify ClientInbox emails for this case's client
      // When a new actor is added, emails waiting in ClientInbox may now have a clear winner
      reclassifyEmailsForCase(args.input.caseId, user.firmId, user.id, {
        keywords: true, // Trigger full rescan
      }).catch((err) => console.error('[addCaseActor] Email reclassification failed:', err));

      // Trigger reclassification for this contact's email (if provided)
      // This uses the new emailReclassifierService to find and reclassify emails from this sender
      if (actor.email) {
        emailReclassifierService
          .onContactAddedToCase(actor.email, args.input.caseId, user.firmId)
          .then((count) => {
            if (count > 0) {
              console.log(
                `[CaseResolver] Reclassified ${count} emails for new actor ${actor.email}`
              );
            }
          })
          .catch((err) =>
            console.error('[CaseResolver] Reclassification failed for new actor:', err)
          );
      }

      // Historical Email Sync: Queue background job to sync historical emails from this contact
      // This runs when a client contact is added to a case with an email address
      if (contactEmail && context.user?.accessToken) {
        try {
          const role = args.input.role as string;
          // Only trigger for client-related roles (Client, OpposingParty, Witness, etc.)
          // Skip for internal roles like court officers that are typically synced differently
          const clientRoles = [
            'Client',
            'Beneficiary',
            'Debtor',
            'Creditor',
            'Witness',
            'OpposingParty',
          ];
          if (clientRoles.includes(role)) {
            await queueHistoricalSyncJob({
              caseId: args.input.caseId,
              contactEmail: contactEmail,
              accessToken: context.user.accessToken,
              userId: user.id,
            });
            console.log(
              `[addCaseActor] Queued historical email sync for ${contactEmail} on case ${args.input.caseId}`
            );
          }
        } catch (syncErr) {
          // Log but don't fail the mutation if historical sync fails to queue
          console.error('[addCaseActor] Error queuing historical email sync:', syncErr);
        }
      }

      // Invalidate AI context cache after adding actor
      caseContextService.invalidateCoreContext(args.input.caseId).catch(() => {});
      // Mark comprehension stale when actor is added
      comprehensionTriggerService
        .handleEvent(args.input.caseId, 'actor_added', user.firmId, { userId: user.id })
        .catch(() => {});

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

      // Auto-assign emails if email or emailDomains were updated
      // OPS-041: Same logic as addCaseActor
      const newEmail = args.input.email?.toLowerCase();
      const newDomains = args.input.emailDomains || [];
      const emailChanged = newEmail && newEmail !== existing.email?.toLowerCase();
      const domainsChanged =
        newDomains.length > 0 &&
        JSON.stringify(newDomains.sort()) !== JSON.stringify((existing.emailDomains || []).sort());

      if (emailChanged || domainsChanged) {
        try {
          const emailConditions: any[] = [];

          if (newEmail) {
            emailConditions.push({
              from: { path: ['address'], string_contains: newEmail },
            });
          }

          for (const domain of newDomains) {
            emailConditions.push({
              from: { path: ['address'], string_ends_with: `@${domain.toLowerCase()}` },
            });
          }

          if (emailConditions.length > 0) {
            const assignResult = await prisma.email.updateMany({
              where: {
                firmId: user.firmId,
                caseId: null,
                classificationState: {
                  in: [EmailClassificationState.Pending, EmailClassificationState.Uncertain],
                },
                OR: emailConditions,
              },
              data: {
                caseId: existing.caseId,
                classificationState: EmailClassificationState.Classified,
                classificationConfidence: 0.95,
                classifiedAt: new Date(),
                classifiedBy: 'contact_match',
              },
            });

            if (assignResult.count > 0) {
              console.log(
                `[updateCaseActor] Auto-assigned ${assignResult.count} emails to case ${existing.caseId} based on contact update`
              );
            }
          }

          // Re-classify ClientInbox emails for this case's client
          // When an actor's email is updated, emails waiting in ClientInbox may now have a clear winner
          reclassifyEmailsForCase(existing.caseId, user.firmId, user.id, {
            keywords: true, // Trigger full rescan
          }).catch((err) => console.error('[updateCaseActor] Email reclassification failed:', err));

          // Trigger reclassification using emailReclassifierService for the new email address
          if (emailChanged && newEmail) {
            emailReclassifierService
              .onContactAddedToCase(newEmail, existing.caseId, user.firmId)
              .then((count) => {
                if (count > 0) {
                  console.log(
                    `[CaseResolver] Reclassified ${count} emails for updated actor email ${newEmail}`
                  );
                }
              })
              .catch((err) =>
                console.error('[CaseResolver] Reclassification failed for updated actor:', err)
              );
          }
        } catch (err) {
          console.error('[updateCaseActor] Error auto-assigning emails:', err);
        }
      }

      // Invalidate AI context cache after updating actor
      caseContextService.invalidateCoreContext(existing.caseId).catch(() => {});
      // Mark comprehension stale when actor is updated
      comprehensionTriggerService
        .handleEvent(existing.caseId, 'actor_updated', user.firmId, { userId: user.id })
        .catch(() => {});

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

      // Invalidate AI context cache after removing actor
      caseContextService.invalidateCoreContext(existing.caseId).catch(() => {});
      // Mark comprehension stale when actor is removed
      comprehensionTriggerService
        .handleEvent(existing.caseId, 'actor_removed', user.firmId, { userId: user.id })
        .catch(() => {});

      return true;
    },

    // OPS-038: Update case classification metadata
    updateCaseMetadata: async (_: any, args: { caseId: string; input: any }, context: Context) => {
      const user = requireAuth(context);

      if (!(await canAccessCase(args.caseId, user))) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const existingCase = await prisma.case.findUnique({
        where: { id: args.caseId },
      });

      if (!existingCase) {
        throw new GraphQLError('Case not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Build update data - only include provided fields
      const updateData: any = {};
      if (args.input.referenceNumbers !== undefined) {
        updateData.referenceNumbers = args.input.referenceNumbers;
      }
      if (args.input.keywords !== undefined) {
        updateData.keywords = args.input.keywords;
      }
      if (args.input.subjectPatterns !== undefined) {
        updateData.subjectPatterns = args.input.subjectPatterns;
      }
      if (args.input.classificationNotes !== undefined) {
        updateData.classificationNotes = args.input.classificationNotes;
      }

      const updatedCase = await prisma.$transaction(async (tx) => {
        const updated = await tx.case.update({
          where: { id: args.caseId },
          data: updateData,
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

        // Create audit log for metadata update
        await tx.caseAuditLog.create({
          data: {
            caseId: args.caseId,
            userId: user.id,
            action: 'METADATA_UPDATED',
            fieldName: 'classification_metadata',
            newValue: JSON.stringify(args.input),
            timestamp: new Date(),
          },
        });

        return updated;
      });

      // Invalidate AI context cache after metadata update
      caseContextService.invalidateCoreContext(args.caseId).catch(() => {});

      // OPS-XXX: Re-classify emails when keywords or referenceNumbers change
      const keywordsChanged =
        args.input.keywords !== undefined &&
        JSON.stringify(args.input.keywords) !== JSON.stringify(existingCase.keywords);
      const refsChanged =
        args.input.referenceNumbers !== undefined &&
        JSON.stringify(args.input.referenceNumbers) !==
          JSON.stringify(existingCase.referenceNumbers);

      if (keywordsChanged || refsChanged) {
        // Run async to not block the mutation response
        reclassifyEmailsForCase(args.caseId, user.firmId, user.id, {
          keywords: keywordsChanged,
          referenceNumbers: refsChanged,
        }).catch((err) =>
          console.error('[updateCaseMetadata] Email reclassification failed:', err)
        );
      }

      // Trigger reclassification for new reference numbers using emailReclassifierService
      if (refsChanged && args.input.referenceNumbers) {
        // Find which reference numbers are new (not in the existing list)
        const existingRefs = new Set(existingCase.referenceNumbers || []);
        const newReferenceNumbers = (args.input.referenceNumbers as string[]).filter(
          (ref: string) => !existingRefs.has(ref)
        );

        // Trigger reclassification for each new reference number
        for (const newRef of newReferenceNumbers) {
          emailReclassifierService
            .onCaseReferenceAdded(args.caseId, newRef, user.firmId)
            .then((count) => {
              if (count > 0) {
                console.log(
                  `[CaseResolver] Reclassified ${count} emails for new reference ${newRef} (metadata update)`
                );
              }
            })
            .catch((err) =>
              console.error(
                `[CaseResolver] Reclassification failed for reference ${newRef} (metadata update):`,
                err
              )
            );
        }
      }

      // Mark comprehension stale when case metadata is updated
      comprehensionTriggerService
        .handleEvent(args.caseId, 'case_updated', user.firmId, { userId: user.id })
        .catch(() => {});

      return updatedCase;
    },

    // Retry a failed case sync (uses app-only tokens, no user session required)
    retryCaseSync: async (_: any, args: { caseId: string }, context: Context) => {
      const user = requireAuth(context);

      if (!(await canAccessCase(args.caseId, user))) {
        throw new GraphQLError('Not authorized', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const result = await caseSyncService.retryCaseSync(args.caseId, user.id);

      if (!result.success) {
        throw new GraphQLError(result.error || 'Failed to retry sync', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }

      // Return updated case
      return prisma.case.findUnique({
        where: { id: args.caseId },
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

    // =========================================================================
    // Multi-Case Email Support (OPS-060)
    // =========================================================================

    /**
     * Get all email links for this case with classification metadata
     */
    emailLinks: async (parent: any) => {
      return await prisma.emailCaseLink.findMany({
        where: { caseId: parent.id },
        include: { email: true },
        orderBy: { linkedAt: 'desc' },
      });
    },

    /**
     * Get all emails linked to this case (convenience field)
     * Fetches via EmailCaseLink junction table, with fallback to legacy Email.caseId
     */
    communications: async (parent: any) => {
      // Get emails via new junction table
      const links = await prisma.emailCaseLink.findMany({
        where: { caseId: parent.id },
        include: { email: true },
        orderBy: { email: { receivedDateTime: 'desc' } },
      });
      const linkedEmails = links.map((l) => l.email);

      // Also get emails via legacy caseId (for migration period)
      const legacyEmails = await prisma.email.findMany({
        where: {
          caseId: parent.id,
          // Exclude emails already in junction table
          NOT: {
            id: { in: linkedEmails.map((e) => e.id) },
          },
        },
        orderBy: { receivedDateTime: 'desc' },
      });

      // Combine and sort by receivedDateTime
      const allEmails = [...linkedEmails, ...legacyEmails];
      allEmails.sort((a, b) => {
        const dateA = a.receivedDateTime?.getTime() || 0;
        const dateB = b.receivedDateTime?.getTime() || 0;
        return dateB - dateA;
      });

      return allEmails;
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

    // OPS-239: Latest health score for case
    latestHealthScore: async (parent: any, _: any, context: Context) => {
      const user = context.user;
      if (!user) return null;

      // Get the most recent health score for this case
      const healthScore = await prisma.caseHealthScore.findFirst({
        where: {
          caseId: parent.id,
          firmId: user.firmId,
        },
        orderBy: { calculatedAt: 'desc' },
      });

      return healthScore;
    },
  },

  // OPS-038: CaseActor field resolvers
  CaseActor: {
    // Ensure emailDomains always returns an array (even if null in DB)
    emailDomains: (parent: any) => {
      return parent.emailDomains || [];
    },
  },
};

// Export for tests and GraphQL server
export const resolvers = caseResolvers;
export default caseResolvers;
