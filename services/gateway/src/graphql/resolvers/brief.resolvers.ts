/**
 * Brief Feed Resolvers
 * OPS-298: Mobile Home - Fresh Build
 *
 * Provides the company-wide activity feed for the mobile home screen.
 * Aggregates recent emails and documents into a unified chronological feed.
 */

import { GraphQLError } from 'graphql';
import { prisma } from '@legal-platform/database';

interface Context {
  user?: {
    id: string;
    role: string;
    firmId: string;
  };
}

interface BriefFeedInput {
  limit?: number;
  offset?: number;
}

type BriefItemType =
  | 'EMAIL_RECEIVED'
  | 'EMAIL_SENT'
  | 'DOCUMENT_RECEIVED'
  | 'DOCUMENT_APPROVED'
  | 'DOCUMENT_UPLOADED'
  | 'NOTE_ADDED'
  | 'DEADLINE_SET';

interface BriefItem {
  id: string;
  type: BriefItemType;
  title: string;
  subtitle: string | null;
  preview: string | null;
  caseName: string | null;
  caseId: string | null;
  actorName: string | null;
  actorId: string | null;
  entityType: string;
  entityId: string;
  occurredAt: Date;
}

interface EmailAddress {
  name?: string;
  address?: string;
}

/**
 * Calculate relative time string in Romanian
 */
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'acum';
  if (diffMins < 60) return `acum ${diffMins} min`;
  if (diffHours < 24) return `acum ${diffHours} ${diffHours === 1 ? 'oră' : 'ore'}`;
  if (diffDays === 1) return 'ieri';
  if (diffDays < 7) return `acum ${diffDays} zile`;
  return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}

/**
 * Safely extract email address from JSON field
 */
function parseEmailAddress(from: unknown): EmailAddress | null {
  if (!from) return null;
  if (typeof from === 'object' && from !== null) {
    const obj = from as Record<string, unknown>;
    return {
      name: typeof obj.name === 'string' ? obj.name : undefined,
      address: typeof obj.address === 'string' ? obj.address : undefined,
    };
  }
  return null;
}

/**
 * Get full name from user object
 */
function getFullName(user: { firstName: string; lastName: string } | null): string | null {
  if (!user) return null;
  return `${user.firstName} ${user.lastName}`.trim() || null;
}

export const briefResolvers = {
  Query: {
    /**
     * Get the Brief feed for mobile home screen.
     * Aggregates recent company activity: emails, documents.
     */
    briefFeed: async (_: unknown, args: { input?: BriefFeedInput }, context: Context) => {
      const { user } = context;

      if (!user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const limit = args.input?.limit ?? 20;
      const offset = args.input?.offset ?? 0;

      // Fetch recent emails (last 7 days for performance)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [emails, documents] = await Promise.all([
        // Get recent emails for the firm
        prisma.email.findMany({
          where: {
            firmId: user.firmId,
            receivedDateTime: { gte: sevenDaysAgo },
          },
          include: {
            caseLinks: {
              where: { isPrimary: true },
              include: { case: { select: { id: true, title: true } } },
              take: 1,
            },
          },
          orderBy: { receivedDateTime: 'desc' },
          take: 50, // Fetch more than needed for merging
        }),

        // Get recent documents (uploaded or approved)
        prisma.document.findMany({
          where: {
            firmId: user.firmId,
            OR: [{ uploadedAt: { gte: sevenDaysAgo } }, { submittedAt: { gte: sevenDaysAgo } }],
          },
          include: {
            uploader: { select: { id: true, firstName: true, lastName: true } },
            reviewer: { select: { id: true, firstName: true, lastName: true } },
            caseLinks: {
              where: { isOriginal: true },
              include: { case: { select: { id: true, title: true } } },
              take: 1,
            },
          },
          orderBy: { uploadedAt: 'desc' },
          take: 50,
        }),
      ]);

      // Transform emails to BriefItems
      const emailItems: BriefItem[] = emails.map((email) => {
        const primaryCase = email.caseLinks[0]?.case;
        const fromAddress = parseEmailAddress(email.from);
        const isReceived = !fromAddress?.address?.includes(user.firmId);

        return {
          id: `email-${email.id}`,
          type: isReceived ? 'EMAIL_RECEIVED' : 'EMAIL_SENT',
          title: isReceived ? 'Email primit' : 'Email trimis',
          subtitle: fromAddress?.name || fromAddress?.address || null,
          preview: email.subject,
          caseName: primaryCase?.title || null,
          caseId: primaryCase?.id || null,
          actorName: fromAddress?.name || null,
          actorId: null,
          entityType: 'Email',
          entityId: email.id,
          occurredAt: email.receivedDateTime,
        };
      });

      // Transform documents to BriefItems
      const documentItems: BriefItem[] = documents.map((doc) => {
        const primaryCase = doc.caseLinks[0]?.case;
        const isApproved = doc.status === 'FINAL' && doc.reviewer;
        const type: BriefItemType = isApproved ? 'DOCUMENT_APPROVED' : 'DOCUMENT_UPLOADED';

        return {
          id: `doc-${doc.id}`,
          type,
          title: isApproved ? 'Document aprobat' : 'Document încărcat',
          subtitle: doc.fileName,
          preview: null,
          caseName: primaryCase?.title || null,
          caseId: primaryCase?.id || null,
          actorName: isApproved ? getFullName(doc.reviewer) : getFullName(doc.uploader),
          actorId: isApproved ? doc.reviewer?.id : doc.uploader?.id || null,
          entityType: 'Document',
          entityId: doc.id,
          occurredAt: isApproved && doc.submittedAt ? doc.submittedAt : doc.uploadedAt,
        };
      });

      // Merge and sort by occurredAt descending
      const allItems = [...emailItems, ...documentItems].sort(
        (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()
      );

      // Apply pagination
      const paginatedItems = allItems.slice(offset, offset + limit);
      const totalCount = allItems.length;

      return {
        items: paginatedItems,
        totalCount,
        hasMore: offset + limit < totalCount,
      };
    },
  },

  // Field resolvers for BriefItem
  BriefItem: {
    relativeTime: (parent: BriefItem) => getRelativeTime(parent.occurredAt),
  },
};
