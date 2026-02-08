/**
 * Outlook Add-in GraphQL Resolvers
 *
 * Handles operations for the Outlook Add-in:
 * - Email sync status checking
 * - Case suggestions for emails
 * - Linking emails to cases from Outlook
 * - Thread sharing between team members
 */

import { prisma } from '@legal-platform/database';
import { Prisma } from '@prisma/client';
import { GraphQLError } from 'graphql';
import { requireAuth, type Context } from '../utils/auth';
import { getEmailThreadShareService } from '../../services/email-thread-share.service';
import { ShareAccessLevel } from '@prisma/client';
import logger from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

interface SuggestCasesInput {
  internetMessageId: string;
  senderEmail: string;
  subject?: string;
}

interface LinkEmailFromOutlookInput {
  internetMessageId: string;
  conversationId?: string;
  graphMessageId?: string;
  caseId: string;
  subject: string;
  senderEmail: string;
  senderName?: string;
  bodyPreview?: string;
  receivedDateTime?: string;
}

interface ShareThreadInput {
  conversationId: string;
  sharedWithUserId: string;
  accessLevel?: 'Read' | 'ReadWrite';
}

// ============================================================================
// Resolvers
// ============================================================================

export const outlookAddinResolvers = {
  Query: {
    /**
     * Get suggestions for which case an email should be linked to.
     * Uses sender email, subject, and message ID to find matches.
     */
    suggestCasesForEmail: async (
      _: unknown,
      { internetMessageId, senderEmail, subject }: SuggestCasesInput,
      context: Context
    ) => {
      const user = requireAuth(context);

      logger.info('[OutlookAddin] Suggesting cases for email', {
        internetMessageId,
        senderEmail,
        userId: user.id,
      });

      const suggestions: Array<{
        id: string;
        title: string;
        caseNumber: string;
        confidence: number;
        matchReason: string;
        clientName?: string;
      }> = [];

      // 1. Check if email is already synced and linked
      const existingEmail = await prisma.email.findFirst({
        where: {
          internetMessageId,
          firmId: user.firmId,
        },
        include: {
          caseLinks: {
            include: {
              case: {
                select: {
                  id: true,
                  title: true,
                  caseNumber: true,
                  client: { select: { name: true } },
                },
              },
            },
          },
        },
      });

      if (existingEmail?.caseLinks?.length) {
        // Return the already linked case as the suggestion
        for (const link of existingEmail.caseLinks) {
          suggestions.push({
            id: link.case.id,
            title: link.case.title,
            caseNumber: link.case.caseNumber,
            confidence: 1.0,
            matchReason: 'Email deja asociat',
            clientName: link.case.client?.name,
          });
        }
        return suggestions;
      }

      // 2. Search by sender email in case actors
      const senderDomain = senderEmail.split('@')[1]?.toLowerCase();
      const actorMatches = await prisma.caseActor.findMany({
        where: {
          email: { equals: senderEmail, mode: 'insensitive' },
          case: { firmId: user.firmId },
        },
        include: {
          case: {
            select: {
              id: true,
              title: true,
              caseNumber: true,
              status: true,
              client: { select: { name: true } },
            },
          },
        },
        take: 5,
      });

      for (const actor of actorMatches) {
        if (actor.case && !suggestions.find((s) => s.id === actor.case.id)) {
          suggestions.push({
            id: actor.case.id,
            title: actor.case.title,
            caseNumber: actor.case.caseNumber,
            confidence: 0.95,
            matchReason: `Contact existent (${actor.role})`,
            clientName: actor.case.client?.name,
          });
        }
      }

      // 3. Search by client contact email
      const clientMatches = await prisma.client.findMany({
        where: {
          firmId: user.firmId,
          OR: [
            { contactInfo: { path: ['email'], equals: senderEmail } },
            { contactInfo: { path: ['email'], string_contains: senderEmail } },
          ],
        },
        include: {
          cases: {
            where: { status: { not: 'Closed' } },
            select: {
              id: true,
              title: true,
              caseNumber: true,
              client: { select: { name: true } },
            },
            take: 3,
          },
        },
        take: 3,
      });

      for (const client of clientMatches) {
        for (const caseItem of client.cases) {
          if (!suggestions.find((s) => s.id === caseItem.id)) {
            suggestions.push({
              id: caseItem.id,
              title: caseItem.title,
              caseNumber: caseItem.caseNumber,
              confidence: 0.9,
              matchReason: 'Email client',
              clientName: client.name,
            });
          }
        }
      }

      // 4. Search by subject keywords in recent cases
      if (subject && suggestions.length < 5) {
        // Extract potential case numbers from subject (e.g., "2024/123")
        const caseNumberMatch = subject.match(/\d{4}\/\d+/);
        if (caseNumberMatch) {
          const caseByNumber = await prisma.case.findFirst({
            where: {
              firmId: user.firmId,
              caseNumber: { contains: caseNumberMatch[0] },
            },
            select: {
              id: true,
              title: true,
              caseNumber: true,
              client: { select: { name: true } },
            },
          });

          if (caseByNumber && !suggestions.find((s) => s.id === caseByNumber.id)) {
            suggestions.push({
              id: caseByNumber.id,
              title: caseByNumber.title,
              caseNumber: caseByNumber.caseNumber,
              confidence: 0.85,
              matchReason: 'Număr dosar în subiect',
              clientName: caseByNumber.client?.name,
            });
          }
        }
      }

      // Sort by confidence
      suggestions.sort((a, b) => b.confidence - a.confidence);

      logger.info('[OutlookAddin] Case suggestions', {
        internetMessageId,
        suggestionCount: suggestions.length,
      });

      return suggestions.slice(0, 5);
    },

    /**
     * Check if an email is already synced to the platform.
     */
    emailSyncStatus: async (
      _: unknown,
      { internetMessageId }: { internetMessageId: string },
      context: Context
    ) => {
      const user = requireAuth(context);

      const email = await prisma.email.findFirst({
        where: {
          internetMessageId,
          firmId: user.firmId,
        },
        include: {
          caseLinks: {
            where: { isPrimary: true },
            include: {
              case: {
                select: { id: true, title: true },
              },
            },
            take: 1,
          },
        },
      });

      if (!email) {
        return {
          isSynced: false,
          emailId: null,
          caseId: null,
          caseName: null,
          syncedAt: null,
          classificationState: null,
        };
      }

      const primaryLink = email.caseLinks[0];

      return {
        isSynced: true,
        emailId: email.id,
        caseId: primaryLink?.case?.id || email.caseId || null,
        caseName: primaryLink?.case?.title || null,
        syncedAt: email.createdAt.toISOString(),
        classificationState: email.classificationState,
      };
    },

    /**
     * Get team members for sharing.
     */
    outlookTeamMembers: async (_: unknown, __: unknown, context: Context) => {
      const user = requireAuth(context);

      const members = await prisma.user.findMany({
        where: {
          firmId: user.firmId,
          id: { not: user.id }, // Exclude current user
          status: 'Active',
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
        orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
      });

      return members.map((m) => ({
        id: m.id,
        name: `${m.firstName} ${m.lastName}`.trim(),
        email: m.email,
        role: m.role,
      }));
    },

    /**
     * Get active cases for linking.
     */
    outlookActiveCases: async (_: unknown, __: unknown, context: Context) => {
      const user = requireAuth(context);

      // Get cases the user has access to
      const isPartnerOrOwner = user.role === 'Partner' || user.role === 'BusinessOwner';

      let cases;
      if (isPartnerOrOwner) {
        // Partners see all firm cases
        cases = await prisma.case.findMany({
          where: {
            firmId: user.firmId,
            status: { not: 'Closed' },
          },
          select: {
            id: true,
            title: true,
            caseNumber: true,
            client: { select: { name: true } },
          },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        });
      } else {
        // Others see cases they're assigned to
        cases = await prisma.case.findMany({
          where: {
            firmId: user.firmId,
            status: { not: 'Closed' },
            teamMembers: {
              some: { userId: user.id },
            },
          },
          select: {
            id: true,
            title: true,
            caseNumber: true,
            client: { select: { name: true } },
          },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        });
      }

      return cases.map((c) => ({
        id: c.id,
        title: c.title,
        caseNumber: c.caseNumber,
        clientName: c.client?.name,
      }));
    },
  },

  Mutation: {
    /**
     * Link an email to a case from Outlook.
     * If the email isn't synced yet, creates a placeholder for it.
     */
    linkEmailFromOutlook: async (
      _: unknown,
      { input }: { input: LinkEmailFromOutlookInput },
      context: Context
    ) => {
      const user = requireAuth(context);

      logger.info('[OutlookAddin] Linking email from Outlook', {
        internetMessageId: input.internetMessageId,
        caseId: input.caseId,
        userId: user.id,
      });

      // Verify case access
      const caseData = await prisma.case.findFirst({
        where: {
          id: input.caseId,
          firmId: user.firmId,
        },
        select: { id: true, title: true, firmId: true },
      });

      if (!caseData) {
        throw new GraphQLError('Dosarul nu există sau nu aveți acces', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Check if email already exists
      let email = await prisma.email.findFirst({
        where: {
          internetMessageId: input.internetMessageId,
          firmId: user.firmId,
        },
      });

      let isNewSync = false;

      if (!email) {
        // Create a placeholder email record
        // The full sync will happen when the user's regular email sync runs
        isNewSync = true;

        const emailData: Prisma.EmailUncheckedCreateInput = {
          graphMessageId: input.graphMessageId || `outlook-${Date.now()}`,
          internetMessageId: input.internetMessageId,
          conversationId: input.conversationId || '',
          subject: input.subject,
          bodyPreview: input.bodyPreview || '',
          bodyContent: '',
          bodyContentType: 'text',
          from: {
            address: input.senderEmail,
            name: input.senderName || input.senderEmail,
          },
          toRecipients: [],
          ccRecipients: [],
          bccRecipients: [],
          receivedDateTime: input.receivedDateTime ? new Date(input.receivedDateTime) : new Date(),
          sentDateTime: input.receivedDateTime ? new Date(input.receivedDateTime) : new Date(),
          hasAttachments: false,
          importance: 'normal',
          isRead: true,
          caseId: input.caseId,
          userId: user.id,
          firmId: user.firmId,
          classificationState: 'Classified',
          classifiedAt: new Date(),
          classifiedBy: user.id,
        };
        email = await prisma.email.create({ data: emailData });

        logger.info('[OutlookAddin] Created placeholder email', {
          emailId: email.id,
          internetMessageId: input.internetMessageId,
        });
      }

      // Create or update the case link
      await prisma.emailCaseLink.upsert({
        where: {
          emailId_caseId: {
            emailId: email.id,
            caseId: input.caseId,
          },
        },
        create: {
          emailId: email.id,
          caseId: input.caseId,
          confidence: 1.0,
          matchType: 'Manual',
          linkedBy: user.id,
          isPrimary: true,
        },
        update: {
          isPrimary: true,
        },
      });

      // Update the legacy caseId field too
      await prisma.email.update({
        where: { id: email.id },
        data: {
          caseId: input.caseId,
          classificationState: 'Classified',
          classifiedAt: new Date(),
          classifiedBy: user.id,
        },
      });

      logger.info('[OutlookAddin] Email linked to case', {
        emailId: email.id,
        caseId: input.caseId,
        isNewSync,
      });

      return {
        success: true,
        emailId: email.id,
        caseId: input.caseId,
        caseName: caseData.title,
        isNewSync,
      };
    },

    /**
     * Share an email thread with a colleague.
     */
    shareEmailThread: async (
      _: unknown,
      { input }: { input: ShareThreadInput },
      context: Context
    ) => {
      const user = requireAuth(context);

      const shareService = getEmailThreadShareService(prisma);

      const result = await shareService.shareThread({
        conversationId: input.conversationId,
        sharedByUserId: user.id,
        sharedWithUserId: input.sharedWithUserId,
        firmId: user.firmId,
        accessLevel:
          input.accessLevel === 'ReadWrite' ? ShareAccessLevel.ReadWrite : ShareAccessLevel.Read,
      });

      return result;
    },
  },
};
