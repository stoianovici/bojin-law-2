/**
 * Global Email Sources GraphQL Resolvers
 * OPS-028: Classification Metadata UI
 *
 * Implements CRUD operations for firm-level email source configuration
 * Used by AI email classification to identify institutional senders
 */

import { prisma } from '@legal-platform/database';
import { EmailClassificationState, GlobalEmailSourceCategory } from '@prisma/client';
import { GraphQLError } from 'graphql';
import { requireAuth, requirePartnerOrBusinessOwner, type Context } from '../utils/auth';
import logger from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

interface CreateGlobalEmailSourceInput {
  category: 'Court' | 'Notary' | 'Bailiff' | 'Authority' | 'Other';
  name: string;
  domains?: string[];
  emails?: string[];
  classificationHint?: string;
}

interface UpdateGlobalEmailSourceInput {
  category?: 'Court' | 'Notary' | 'Bailiff' | 'Authority' | 'Other';
  name?: string;
  domains?: string[];
  emails?: string[];
  classificationHint?: string;
}

interface UpdateCaseClassificationInput {
  keywords?: string[];
  referenceNumbers?: string[];
  subjectPatterns?: string[];
  classificationNotes?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function requirePartner(context: Context) {
  return requirePartnerOrBusinessOwner(context).user;
}

async function canAccessCase(caseId: string, user: Context['user']): Promise<boolean> {
  if (!user) return false;

  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: { firmId: true },
  });

  if (!caseData || caseData.firmId !== user.firmId) return false;

  if (user.role === 'Partner' || user.role === 'BusinessOwner') return true;

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

function validateName(name: string): void {
  if (!name || name.trim().length < 2) {
    throw new GraphQLError('Name must be at least 2 characters', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }
  if (name.length > 200) {
    throw new GraphQLError('Name must be at most 200 characters', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }
}

function validateDomain(domain: string): void {
  // Basic domain validation - allows subdomains and TLDs
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*)*$/;
  if (!domainRegex.test(domain)) {
    throw new GraphQLError(`Invalid domain format: ${domain}`, {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }
}

function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new GraphQLError(`Invalid email format: ${email}`, {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }
}

/**
 * Extract domain from email address
 */
function extractDomain(email: string): string {
  const parts = email.split('@');
  return parts.length > 1 ? parts[1].toLowerCase() : '';
}

/**
 * Reclassify existing pending/uncertain emails when a global email source is created/updated.
 * This allows retroactive classification of old emails from newly-added court addresses.
 */
async function reclassifyEmailsForInstitution(
  firmId: string,
  category: GlobalEmailSourceCategory,
  domains: string[],
  emails: string[]
): Promise<{ reclassified: number; errors: number }> {
  // Only reclassify for Court category (could extend to others later)
  if (category !== 'Court') {
    return { reclassified: 0, errors: 0 };
  }

  // Need at least one domain or email to match
  if (domains.length === 0 && emails.length === 0) {
    return { reclassified: 0, errors: 0 };
  }

  // Normalize for matching
  const normalizedDomains = domains.map((d) => d.toLowerCase());
  const normalizedEmails = emails.map((e) => e.toLowerCase());

  // Find pending/uncertain emails that might match this source
  const candidateEmails = await prisma.email.findMany({
    where: {
      firmId,
      caseId: null, // Only unassigned emails
      classificationState: {
        in: [
          EmailClassificationState.Pending,
          EmailClassificationState.Uncertain,
        ],
      },
    },
    select: {
      id: true,
      from: true, // JSON field with { address, name }
    },
    take: 1000, // Limit to prevent overwhelming the system
  });

  if (candidateEmails.length === 0) {
    return { reclassified: 0, errors: 0 };
  }

  // Filter emails that match the source domains/emails
  const matchingEmails = candidateEmails.filter((email) => {
    const fromData = email.from as { address?: string; name?: string } | null;
    const senderEmail = fromData?.address?.toLowerCase() || '';
    const senderDomain = extractDomain(senderEmail);

    // Check exact email match
    if (normalizedEmails.includes(senderEmail)) {
      return true;
    }

    // Check domain match
    if (senderDomain && normalizedDomains.includes(senderDomain)) {
      return true;
    }

    return false;
  });

  if (matchingEmails.length === 0) {
    return { reclassified: 0, errors: 0 };
  }

  logger.info(
    `[reclassifyEmailsForInstitution] Found ${matchingEmails.length} emails to reclassify as CourtUnassigned`
  );

  let reclassified = 0;
  let errors = 0;

  // Update matching emails to CourtUnassigned
  for (const email of matchingEmails) {
    try {
      await prisma.email.update({
        where: { id: email.id },
        data: {
          classificationState: EmailClassificationState.CourtUnassigned,
          classifiedAt: new Date(),
        },
      });
      reclassified++;
    } catch (err) {
      logger.error(`[reclassifyEmailsForInstitution] Error updating email ${email.id}:`, err);
      errors++;
    }
  }

  if (reclassified > 0) {
    logger.info(
      `[reclassifyEmailsForInstitution] Reclassified ${reclassified} emails to CourtUnassigned`
    );
  }

  return { reclassified, errors };
}

// ============================================================================
// Resolvers
// ============================================================================

export const globalEmailSourcesResolvers = {
  Query: {
    /**
     * Get all global email sources for the current firm
     * Authorization: Authenticated users in the firm
     */
    globalEmailSources: async (_: unknown, __: unknown, context: Context) => {
      const user = requireAuth(context);

      const sources = await prisma.globalEmailSource.findMany({
        where: { firmId: user.firmId },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      });

      return sources;
    },

    /**
     * Get a single global email source by ID
     * Authorization: Authenticated users in the firm
     */
    globalEmailSource: async (_: unknown, args: { id: string }, context: Context) => {
      const user = requireAuth(context);

      const source = await prisma.globalEmailSource.findUnique({
        where: { id: args.id },
      });

      if (!source || source.firmId !== user.firmId) {
        return null;
      }

      return source;
    },
  },

  Mutation: {
    /**
     * Create a new global email source
     * Authorization: Partner role required
     */
    createGlobalEmailSource: async (
      _: unknown,
      args: { input: CreateGlobalEmailSourceInput },
      context: Context
    ) => {
      const user = requirePartner(context);
      const { category, name, domains, emails, classificationHint } = args.input;

      // Validate input
      validateName(name);

      if (domains) {
        domains.forEach(validateDomain);
      }

      if (emails) {
        emails.forEach(validateEmail);
      }

      // Check for duplicate name in firm
      const existing = await prisma.globalEmailSource.findFirst({
        where: {
          firmId: user.firmId,
          name: { equals: name, mode: 'insensitive' },
        },
      });

      if (existing) {
        throw new GraphQLError(`A source with the name "${name}" already exists`, {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const source = await prisma.globalEmailSource.create({
        data: {
          firmId: user.firmId,
          category,
          name: name.trim(),
          domains: domains || [],
          emails: emails || [],
          classificationHint: classificationHint?.trim() || null,
        },
      });

      // Retroactively reclassify existing pending/uncertain emails from this source
      reclassifyEmailsForInstitution(
        user.firmId,
        category,
        domains || [],
        emails || []
      ).catch((err) =>
        logger.error('[createGlobalEmailSource] Email reclassification failed:', err)
      );

      return source;
    },

    /**
     * Update an existing global email source
     * Authorization: Partner role required
     */
    updateGlobalEmailSource: async (
      _: unknown,
      args: { id: string; input: UpdateGlobalEmailSourceInput },
      context: Context
    ) => {
      const user = requirePartner(context);
      const { id, input } = args;

      // Verify source exists and belongs to firm
      const existing = await prisma.globalEmailSource.findUnique({
        where: { id },
      });

      if (!existing || existing.firmId !== user.firmId) {
        throw new GraphQLError('Global email source not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Validate input
      if (input.name !== undefined) {
        validateName(input.name);

        // Check for duplicate name
        const duplicate = await prisma.globalEmailSource.findFirst({
          where: {
            firmId: user.firmId,
            name: { equals: input.name, mode: 'insensitive' },
            id: { not: id },
          },
        });

        if (duplicate) {
          throw new GraphQLError(`A source with the name "${input.name}" already exists`, {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
      }

      if (input.domains) {
        input.domains.forEach(validateDomain);
      }

      if (input.emails) {
        input.emails.forEach(validateEmail);
      }

      const source = await prisma.globalEmailSource.update({
        where: { id },
        data: {
          ...(input.category !== undefined && { category: input.category }),
          ...(input.name !== undefined && { name: input.name.trim() }),
          ...(input.domains !== undefined && { domains: input.domains }),
          ...(input.emails !== undefined && { emails: input.emails }),
          ...(input.classificationHint !== undefined && {
            classificationHint: input.classificationHint?.trim() || null,
          }),
        },
      });

      // If domains or emails were updated, reclassify matching pending/uncertain emails
      if (input.domains !== undefined || input.emails !== undefined) {
        reclassifyEmailsForInstitution(
          user.firmId,
          source.category,
          source.domains,
          source.emails
        ).catch((err) =>
          logger.error('[updateGlobalEmailSource] Email reclassification failed:', err)
        );
      }

      return source;
    },

    /**
     * Delete a global email source
     * Authorization: Partner role required
     */
    deleteGlobalEmailSource: async (_: unknown, args: { id: string }, context: Context) => {
      const user = requirePartner(context);

      // Verify source exists and belongs to firm
      const existing = await prisma.globalEmailSource.findUnique({
        where: { id: args.id },
      });

      if (!existing || existing.firmId !== user.firmId) {
        throw new GraphQLError('Global email source not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      await prisma.globalEmailSource.delete({
        where: { id: args.id },
      });

      return true;
    },

    /**
     * Update case classification metadata
     * Authorization: User must be on case team OR be a Partner
     */
    updateCaseClassification: async (
      _: unknown,
      args: { caseId: string; input: UpdateCaseClassificationInput },
      context: Context
    ) => {
      const user = requireAuth(context);
      const { caseId, input } = args;

      // Verify access to case
      const hasAccess = await canAccessCase(caseId, user);
      if (!hasAccess) {
        throw new GraphQLError('Case not found or access denied', {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Validate keywords (no duplicates, reasonable length)
      if (input.keywords) {
        const uniqueKeywords = [...new Set(input.keywords.map((k) => k.toLowerCase().trim()))];
        if (uniqueKeywords.some((k) => k.length < 2 || k.length > 100)) {
          throw new GraphQLError('Keywords must be between 2 and 100 characters', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
        input.keywords = uniqueKeywords;
      }

      // Validate reference numbers
      if (input.referenceNumbers) {
        const uniqueRefs = [...new Set(input.referenceNumbers.map((r) => r.trim()))];
        if (uniqueRefs.some((r) => r.length < 2 || r.length > 100)) {
          throw new GraphQLError('Reference numbers must be between 2 and 100 characters', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
        input.referenceNumbers = uniqueRefs;
      }

      // Validate subject patterns
      if (input.subjectPatterns) {
        const uniquePatterns = [...new Set(input.subjectPatterns.map((p) => p.trim()))];
        if (uniquePatterns.some((p) => p.length < 2 || p.length > 200)) {
          throw new GraphQLError('Subject patterns must be between 2 and 200 characters', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
        input.subjectPatterns = uniquePatterns;
      }

      // Validate classification notes
      if (input.classificationNotes !== undefined && input.classificationNotes !== null) {
        if (input.classificationNotes.length > 2000) {
          throw new GraphQLError('Classification notes must be at most 2000 characters', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
      }

      const updatedCase = await prisma.case.update({
        where: { id: caseId },
        data: {
          ...(input.keywords !== undefined && { keywords: input.keywords }),
          ...(input.referenceNumbers !== undefined && { referenceNumbers: input.referenceNumbers }),
          ...(input.subjectPatterns !== undefined && { subjectPatterns: input.subjectPatterns }),
          ...(input.classificationNotes !== undefined && {
            classificationNotes: input.classificationNotes?.trim() || null,
          }),
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

      return updatedCase;
    },
  },

  // Field resolvers for GlobalEmailSource type
  GlobalEmailSource: {
    classificationHint: (parent: { classificationHint?: string | null }) => {
      return parent.classificationHint || null;
    },
  },
};

export default globalEmailSourcesResolvers;
