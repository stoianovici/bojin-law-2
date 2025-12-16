/**
 * Email Classification Resolvers
 * OPS-029: AI Email Classification Service
 * OPS-030: Email Import with Classification Integration
 *
 * GraphQL resolvers for multi-case email classification.
 * Note: GlobalEmailSource CRUD is handled by global-email-sources.resolvers.ts
 */

import { prisma, GlobalEmailSourceCategory, CaseActorRole } from '@legal-platform/database';
import { AIOperationType } from '@legal-platform/types';
import { aiService } from '../../services/ai.service';
import { emailToCaseService } from '../../services/email-to-case.service';
import { caseActivityService } from '../../services/case-activity.service';
import { unifiedTimelineService } from '../../services/unified-timeline.service';
import { getEmailAttachmentService } from '../../services/email-attachment.service';
import logger from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

interface Context {
  user?: {
    id: string;
    firmId: string;
    role: 'Partner' | 'Associate' | 'Paralegal' | 'BusinessOwner';
    email: string;
    accessToken?: string;
  };
}

interface ClassifyEmailsInput {
  clientId: string;
  emailIds: string[];
}

interface PreviewClassificationInput {
  emailAddresses: string[];
  clientId: string;
}

interface PreviewClassificationForImportInput {
  caseId: string;
  emailAddresses: string[];
}

interface ClassificationOverrideInput {
  emailId: string;
  caseId: string;
}

interface ContactRoleAssignmentInput {
  email: string;
  name: string | null;
  role: CaseActorRole;
}

interface ExecuteClassifiedImportInput {
  caseId: string;
  emailAddresses: string[];
  classificationOverrides: ClassificationOverrideInput[];
  excludedEmailIds: string[];
  importAttachments: boolean;
  contactAssignments: ContactRoleAssignmentInput[];
}

interface EmailForClassificationDisplay {
  id: string;
  subject: string | null;
  from: string | null;
  fromName: string | null;
  receivedDateTime: Date | null;
  hasAttachments: boolean;
}

type MatchType = 'ACTOR' | 'REFERENCE' | 'KEYWORD' | 'SEMANTIC' | 'NONE';

interface ExtractedReference {
  type: string;
  value: string;
  normalized: string;
  position: number;
}

interface AlternativeCase {
  caseId: string;
  confidence: number;
  reason: string;
}

interface ClassificationResult {
  emailId: string;
  email?: EmailForClassificationDisplay;
  suggestedCaseId: string | null;
  confidence: number;
  reasons: string[];
  alternativeCases: AlternativeCase[];
  needsHumanReview: boolean;
  reviewReason?: string;
  matchType: MatchType;
  extractedReferences: ExtractedReference[];
  isGlobalSource: boolean;
  globalSourceName?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_THRESHOLDS = {
  autoAssign: 0.85,
  needsReview: 0.5,
  actorMatchWeight: 0.4,
  referenceMatchWeight: 0.3,
  keywordMatchWeight: 0.2,
  semanticWeight: 0.1,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find emails by participant addresses for classification
 * Similar to email-to-case.service but returns full email data with hasAttachments
 */
async function findEmailsByParticipantsForClassification(
  emailAddresses: string[],
  userId: string,
  firmId: string
): Promise<
  Array<{
    id: string;
    subject: string | null;
    bodyPreview: string | null;
    bodyContent: string | null;
    from: unknown;
    receivedDateTime: Date;
    hasAttachments: boolean;
  }>
> {
  if (emailAddresses.length === 0) {
    return [];
  }

  // Build dynamic OR conditions for each email address
  const addressConditions = emailAddresses
    .map(
      (_, idx) => `(
        LOWER("from"->>'address') LIKE LOWER($${idx + 4})
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements("to_recipients") AS r
          WHERE LOWER(r->>'address') LIKE LOWER($${idx + 4})
        )
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements("cc_recipients") AS r
          WHERE LOWER(r->>'address') LIKE LOWER($${idx + 4})
        )
      )`
    )
    .join(' OR ');

  const params = [userId, firmId, false, ...emailAddresses.map((addr) => `%${addr}%`)];

  const emails = await prisma.$queryRawUnsafe<any[]>(
    `
    SELECT id, subject, body_preview, body_content, "from", received_date_time, has_attachments
    FROM "emails"
    WHERE "user_id" = $1
      AND "firm_id" = $2
      AND "is_ignored" = $3
      AND (${addressConditions})
    ORDER BY "received_date_time" DESC
    `,
    ...params
  );

  // Map snake_case to camelCase
  return emails.map((email) => ({
    id: email.id,
    subject: email.subject,
    bodyPreview: email.body_preview,
    bodyContent: email.body_content,
    from: email.from,
    receivedDateTime: email.received_date_time,
    hasAttachments: email.has_attachments,
  }));
}

/**
 * Extract references from text (Romanian court files, contracts, invoices)
 */
function extractReferences(text: string): ExtractedReference[] {
  if (!text) return [];

  const references: ExtractedReference[] = [];
  const seenNormalized = new Set<string>();

  // Court file patterns
  const courtPatterns = [
    /(?:dosar(?:ul)?|nr\.?\s*dosar)\s*(?:nr\.?\s*)?(\d{1,5}\s*\/\s*\d{1,3}\s*\/\s*\d{4})/gi,
    /(?<!\d)nr\.?\s*(\d{1,5}\s*\/\s*\d{1,3}\s*\/\s*\d{4})/gi,
    /(?<![/\d])(\d{1,5}\s*\/\s*\d{1,3}\s*\/\s*\d{4})(?![/\d])/gi,
  ];

  for (const pattern of courtPatterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const value = match[1] || match[0];
      const normalized = value.replace(/\s+/g, '').toUpperCase();
      if (!seenNormalized.has(normalized)) {
        seenNormalized.add(normalized);
        references.push({
          type: 'court_file',
          value: match[0].trim(),
          normalized,
          position: match.index,
        });
      }
    }
  }

  return references.sort((a, b) => a.position - b.position);
}

/**
 * Get email domain from address
 */
function getEmailDomain(email: string): string {
  const parts = email.toLowerCase().split('@');
  return parts.length === 2 ? parts[1] : '';
}

/**
 * Check if email matches domain pattern
 */
function matchesDomain(email: string, domains: string[]): boolean {
  const emailDomain = getEmailDomain(email);
  if (!emailDomain) return false;

  return domains.some((pattern) => {
    const regexPattern = pattern.toLowerCase().replace(/\./g, '\\.').replace(/\*/g, '.*');
    return new RegExp(`^${regexPattern}$`).test(emailDomain);
  });
}

/**
 * Classify a single email against candidate cases
 */
async function classifySingleEmail(
  email: {
    id: string;
    subject: string | null;
    bodyPreview: string | null;
    bodyContent: string | null;
    from: { name?: string; address: string } | null;
    receivedDateTime: Date | null;
  },
  cases: Array<{
    id: string;
    title: string;
    type: string;
    description: string;
    keywords: string[];
    referenceNumbers: string[];
    subjectPatterns: string[];
    classificationNotes: string | null;
    actors: Array<{ id: string; email: string | null; emailDomains: string[] }>;
  }>,
  globalSources: Array<{
    id: string;
    category: GlobalEmailSourceCategory;
    name: string;
    domains: string[];
    emails: string[];
    classificationHint: string | null;
  }>,
  userId: string,
  firmId: string
): Promise<ClassificationResult> {
  const result: ClassificationResult = {
    emailId: email.id,
    suggestedCaseId: null,
    confidence: 0,
    reasons: [],
    alternativeCases: [],
    needsHumanReview: false,
    matchType: 'NONE',
    extractedReferences: [],
    isGlobalSource: false,
  };

  // Single case - auto assign
  if (cases.length === 1) {
    result.suggestedCaseId = cases[0].id;
    result.confidence = 1.0;
    result.reasons.push('Client has only one active case');
    result.matchType = 'ACTOR';
    return result;
  }

  if (cases.length === 0) {
    result.needsHumanReview = true;
    result.reviewReason = 'No active cases found for client';
    return result;
  }

  const fromAddress = email.from?.address || '';
  const emailText = `${email.subject || ''} ${email.bodyPreview || ''}`;

  // Check global sources
  let isGlobalSource = false;
  let globalSourceName: string | undefined;
  for (const source of globalSources) {
    if (
      source.emails.some((e) => e.toLowerCase() === fromAddress.toLowerCase()) ||
      matchesDomain(fromAddress, source.domains)
    ) {
      isGlobalSource = true;
      globalSourceName = source.name;
      result.reasons.push(`Sender is a ${source.category}: ${source.name}`);
      break;
    }
  }
  result.isGlobalSource = isGlobalSource;
  result.globalSourceName = globalSourceName;

  // Extract references
  result.extractedReferences = extractReferences(emailText);

  // Score each case
  const caseScores = new Map<string, { score: number; reasons: string[]; matchType: MatchType }>();

  for (const caseItem of cases) {
    const score = { score: 0, reasons: [] as string[], matchType: 'NONE' as MatchType };

    // Reference matching
    const matchedRefs = result.extractedReferences.filter((ref) =>
      caseItem.referenceNumbers.some(
        (caseRef) => ref.normalized === caseRef.replace(/\s+/g, '').toUpperCase()
      )
    );
    if (matchedRefs.length > 0) {
      const refBoost = isGlobalSource ? 0.95 : DEFAULT_THRESHOLDS.referenceMatchWeight;
      score.score += refBoost;
      score.reasons.push(`Reference match: ${matchedRefs.map((r) => r.normalized).join(', ')}`);
      score.matchType = 'REFERENCE';
    }

    // Actor matching (skip for global sources)
    if (!isGlobalSource) {
      const actorMatch = caseItem.actors.find(
        (actor) =>
          (actor.email && actor.email.toLowerCase() === fromAddress.toLowerCase()) ||
          (actor.emailDomains.length > 0 && matchesDomain(fromAddress, actor.emailDomains))
      );
      if (actorMatch) {
        score.score += DEFAULT_THRESHOLDS.actorMatchWeight;
        score.reasons.push(`Sender matches case actor: ${actorMatch.email || 'domain match'}`);
        if (score.matchType === 'NONE') score.matchType = 'ACTOR';
      }
    }

    // Keyword matching
    const textLower = emailText.toLowerCase();
    const matchedKeywords = caseItem.keywords.filter((kw) => textLower.includes(kw.toLowerCase()));
    if (matchedKeywords.length > 0) {
      const kwBoost = Math.min(matchedKeywords.length * 0.1, DEFAULT_THRESHOLDS.keywordMatchWeight);
      score.score += kwBoost;
      score.reasons.push(`Keyword matches: ${matchedKeywords.join(', ')}`);
      if (score.matchType === 'NONE') score.matchType = 'KEYWORD';
    }

    // Subject pattern matching
    const subjectLower = (email.subject || '').toLowerCase();
    const patternMatch = caseItem.subjectPatterns.find((pattern) => {
      const regexPattern = pattern
        .toLowerCase()
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      try {
        return new RegExp(regexPattern).test(subjectLower);
      } catch {
        return false;
      }
    });
    if (patternMatch) {
      score.score += 0.15;
      score.reasons.push(`Subject pattern match: ${patternMatch}`);
      if (score.matchType === 'NONE') score.matchType = 'KEYWORD';
    }

    caseScores.set(caseItem.id, score);
  }

  // Find best matches
  let bestCaseId: string | null = null;
  let bestScore = 0;
  let secondBestCaseId: string | null = null;
  let secondBestScore = 0;

  for (const [caseId, score] of caseScores) {
    if (score.score > bestScore) {
      secondBestCaseId = bestCaseId;
      secondBestScore = bestScore;
      bestCaseId = caseId;
      bestScore = score.score;
    } else if (score.score > secondBestScore) {
      secondBestCaseId = caseId;
      secondBestScore = score.score;
    }
  }

  // Use semantic analysis if needed
  if (bestScore < DEFAULT_THRESHOLDS.needsReview && !isGlobalSource) {
    try {
      const casesText = cases
        .map(
          (c, i) => `Case ${i + 1}: ${c.title}
- Type: ${c.type}
- Description: ${c.description}
${c.keywords.length > 0 ? `- Keywords: ${c.keywords.join(', ')}` : ''}
${c.classificationNotes ? `- Notes: ${c.classificationNotes}` : ''}`
        )
        .join('\n\n');

      const prompt = `Classify this email to the most appropriate case.

EMAIL:
- From: ${email.from?.name || email.from?.address || 'Unknown'}
- Subject: ${email.subject || '(no subject)'}
- Preview: ${(email.bodyPreview || '').substring(0, 500)}
- Date: ${email.receivedDateTime?.toISOString().split('T')[0] || 'Unknown'}

CANDIDATE CASES:
${casesText}

Return JSON only:
{
  "mostLikelyCaseIndex": 0,
  "confidence": 0.75,
  "reasoning": "Brief explanation"
}`;

      const response = await aiService.generate({
        prompt,
        systemPrompt: 'You are an email classification assistant. Output valid JSON only.',
        operationType: AIOperationType.Classification,
        firmId,
        userId,
        maxTokens: 500,
        temperature: 0.2,
        useCache: true,
      });

      let jsonContent = response.content;
      const jsonMatch = response.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) jsonContent = jsonMatch[1];

      const parsed = JSON.parse(jsonContent);
      if (
        typeof parsed.mostLikelyCaseIndex === 'number' &&
        parsed.mostLikelyCaseIndex >= 0 &&
        parsed.mostLikelyCaseIndex < cases.length
      ) {
        const targetCaseId = cases[parsed.mostLikelyCaseIndex].id;
        const currentScore = caseScores.get(targetCaseId);
        if (currentScore) {
          const semanticBoost = (parsed.confidence || 0.5) * DEFAULT_THRESHOLDS.semanticWeight;
          currentScore.score += semanticBoost;
          currentScore.reasons.push(
            `AI semantic match: ${parsed.reasoning || 'semantic analysis'}`
          );
          currentScore.matchType = 'SEMANTIC';

          if (currentScore.score > bestScore) {
            secondBestCaseId = bestCaseId;
            secondBestScore = bestScore;
            bestCaseId = targetCaseId;
            bestScore = currentScore.score;
          }
        }
      }
    } catch (error) {
      console.error('AI classification failed:', error);
    }
  }

  // Build result
  if (bestCaseId) {
    const bestScoreData = caseScores.get(bestCaseId)!;
    result.suggestedCaseId = bestCaseId;
    result.confidence = Math.min(bestScore, 1.0);
    result.reasons = bestScoreData.reasons;
    result.matchType = bestScoreData.matchType;

    if (secondBestCaseId && secondBestScore >= DEFAULT_THRESHOLDS.needsReview * 0.5) {
      const secondScoreData = caseScores.get(secondBestCaseId)!;
      result.alternativeCases.push({
        caseId: secondBestCaseId,
        confidence: secondBestScore,
        reason: secondScoreData.reasons.join('; '),
      });
    }
  }

  // Determine review need
  if (isGlobalSource && result.extractedReferences.length === 0) {
    result.needsHumanReview = true;
    result.reviewReason = 'Email from court/authority but no reference number found';
  } else if (result.confidence < DEFAULT_THRESHOLDS.needsReview) {
    result.needsHumanReview = true;
    result.reviewReason = 'Low confidence classification';
  } else if (
    result.confidence >= DEFAULT_THRESHOLDS.needsReview &&
    result.confidence < DEFAULT_THRESHOLDS.autoAssign
  ) {
    if (
      result.alternativeCases.length > 0 &&
      result.alternativeCases[0].confidence > DEFAULT_THRESHOLDS.needsReview * 0.7
    ) {
      result.needsHumanReview = true;
      result.reviewReason = 'Multiple cases with similar confidence';
    }
  }

  return result;
}

// ============================================================================
// Query Resolvers
// ============================================================================

export const emailClassificationQueryResolvers = {
  // Classify emails for a client's cases
  classifyEmailsForClient: async (
    _: unknown,
    { input }: { input: ClassifyEmailsInput },
    context: Context
  ): Promise<ClassificationResult[]> => {
    const firmId = context.user?.firmId;
    const userId = context.user?.id;

    if (!firmId || !userId) {
      throw new Error('Authentication required');
    }

    const { clientId, emailIds } = input;

    // Get client's active cases with classification metadata
    const cases = await prisma.case.findMany({
      where: {
        clientId,
        firmId,
        status: 'Active',
      },
      select: {
        id: true,
        title: true,
        type: true,
        description: true,
        keywords: true,
        referenceNumbers: true,
        subjectPatterns: true,
        classificationNotes: true,
        actors: {
          select: {
            id: true,
            email: true,
            emailDomains: true,
          },
        },
      },
    });

    // Get global email sources
    const globalSources = await prisma.globalEmailSource.findMany({
      where: { firmId },
    });

    // Get emails
    const emails = await prisma.email.findMany({
      where: {
        id: { in: emailIds },
        firmId,
      },
      select: {
        id: true,
        subject: true,
        bodyPreview: true,
        bodyContent: true,
        from: true,
        receivedDateTime: true,
      },
    });

    // Classify each email
    const results: ClassificationResult[] = [];
    for (const email of emails) {
      const fromData = email.from as { name?: string; address: string } | null;
      const result = await classifySingleEmail(
        {
          ...email,
          from: fromData,
        },
        cases,
        globalSources,
        userId,
        firmId
      );
      results.push(result);
    }

    return results;
  },

  // Preview classification (for import wizard) - deprecated, use previewClassificationForImport
  previewEmailClassification: async (
    _: unknown,
    { input }: { input: PreviewClassificationInput },
    context: Context
  ) => {
    const firmId = context.user?.firmId;
    const userId = context.user?.id;

    if (!firmId || !userId) {
      throw new Error('Authentication required');
    }

    // This version requires clientId directly - use previewClassificationForImport instead
    return {
      totalEmails: 0,
      classifications: [],
      byCase: [],
      needsReview: 0,
      unclassified: 0,
    };
  },

  // Preview classification for import wizard - OPS-030
  previewClassificationForImport: async (
    _: unknown,
    { input }: { input: PreviewClassificationForImportInput },
    context: Context
  ) => {
    const firmId = context.user?.firmId;
    const userId = context.user?.id;

    if (!firmId || !userId) {
      throw new Error('Authentication required');
    }

    const { caseId, emailAddresses } = input;
    const normalizedAddresses = emailAddresses.map((e) => e.toLowerCase().trim());

    logger.info('[previewClassificationForImport] Starting', {
      caseId,
      emailAddresses: normalizedAddresses,
      userId,
    });

    // 1. Get the case and derive the client
    const targetCase = await prisma.case.findFirst({
      where: { id: caseId, firmId },
      select: { id: true, clientId: true, title: true },
    });

    if (!targetCase) {
      throw new Error('Case not found');
    }

    if (!targetCase.clientId) {
      // No client - single case flow
      logger.info('[previewClassificationForImport] No client, single case flow');
      return {
        totalEmails: 0,
        classifications: [],
        byCase: [],
        needsReview: 0,
        unclassified: 0,
      };
    }

    // 2. Get all active cases for this client
    const clientCases = await prisma.case.findMany({
      where: {
        clientId: targetCase.clientId,
        firmId,
        status: 'Active',
      },
      select: {
        id: true,
        title: true,
        type: true,
        description: true,
        keywords: true,
        referenceNumbers: true,
        subjectPatterns: true,
        classificationNotes: true,
        actors: {
          select: {
            id: true,
            email: true,
            emailDomains: true,
          },
        },
      },
    });

    logger.info('[previewClassificationForImport] Found client cases', {
      clientId: targetCase.clientId,
      caseCount: clientCases.length,
    });

    // If only one case, no classification needed
    if (clientCases.length <= 1) {
      return {
        totalEmails: 0,
        classifications: [],
        byCase: [],
        needsReview: 0,
        unclassified: 0,
      };
    }

    // 3. Get global email sources
    const globalSources = await prisma.globalEmailSource.findMany({
      where: { firmId },
    });

    // 4. Find emails by participant addresses (reuse service method logic)
    const emails = await findEmailsByParticipantsForClassification(
      normalizedAddresses,
      userId,
      firmId
    );

    logger.info('[previewClassificationForImport] Found emails', {
      emailCount: emails.length,
    });

    if (emails.length === 0) {
      return {
        totalEmails: 0,
        classifications: [],
        byCase: [],
        needsReview: 0,
        unclassified: 0,
      };
    }

    // 5. Classify each email
    const classifications: ClassificationResult[] = [];
    for (const email of emails) {
      const fromData = email.from as { name?: string; address: string } | null;
      const result = await classifySingleEmail(
        {
          ...email,
          from: fromData,
        },
        clientCases,
        globalSources,
        userId,
        firmId
      );

      // Add email display data
      result.email = {
        id: email.id,
        subject: email.subject,
        from: fromData?.address || null,
        fromName: fromData?.name || null,
        receivedDateTime: email.receivedDateTime,
        hasAttachments: email.hasAttachments,
      };

      classifications.push(result);
    }

    // 6. Build summary by case
    const caseSummaryMap = new Map<
      string,
      {
        caseId: string;
        emailCount: number;
        autoClassified: number;
        needsReview: number;
      }
    >();

    for (const caseItem of clientCases) {
      caseSummaryMap.set(caseItem.id, {
        caseId: caseItem.id,
        emailCount: 0,
        autoClassified: 0,
        needsReview: 0,
      });
    }

    let needsReviewCount = 0;
    let unclassifiedCount = 0;

    for (const classification of classifications) {
      if (classification.needsHumanReview) {
        needsReviewCount++;
      }

      if (!classification.suggestedCaseId) {
        unclassifiedCount++;
        continue;
      }

      const summary = caseSummaryMap.get(classification.suggestedCaseId);
      if (summary) {
        summary.emailCount++;
        if (classification.needsHumanReview) {
          summary.needsReview++;
        } else {
          summary.autoClassified++;
        }
      }
    }

    logger.info('[previewClassificationForImport] Classification complete', {
      totalEmails: emails.length,
      needsReview: needsReviewCount,
      unclassified: unclassifiedCount,
    });

    return {
      totalEmails: emails.length,
      classifications,
      byCase: Array.from(caseSummaryMap.values()),
      needsReview: needsReviewCount,
      unclassified: unclassifiedCount,
    };
  },

  // Get case classification metadata
  caseClassificationMetadata: async (
    _: unknown,
    { caseId }: { caseId: string },
    context: Context
  ) => {
    const firmId = context.user?.firmId;
    if (!firmId) throw new Error('Authentication required');

    const caseData = await prisma.case.findFirst({
      where: { id: caseId, firmId },
      select: {
        id: true,
        keywords: true,
        referenceNumbers: true,
        subjectPatterns: true,
        classificationNotes: true,
      },
    });

    if (!caseData) throw new Error('Case not found');

    return {
      caseId: caseData.id,
      keywords: caseData.keywords,
      referenceNumbers: caseData.referenceNumbers,
      subjectPatterns: caseData.subjectPatterns,
      classificationNotes: caseData.classificationNotes,
    };
  },

  // Check if client has multiple active cases - OPS-030
  clientHasMultipleCases: async (
    _: unknown,
    { caseId }: { caseId: string },
    context: Context
  ): Promise<boolean> => {
    const firmId = context.user?.firmId;
    if (!firmId) throw new Error('Authentication required');

    // Get the case to find its client
    const targetCase = await prisma.case.findFirst({
      where: { id: caseId, firmId },
      select: { clientId: true },
    });

    if (!targetCase || !targetCase.clientId) {
      return false;
    }

    // Count active cases for this client
    const caseCount = await prisma.case.count({
      where: {
        clientId: targetCase.clientId,
        firmId,
        status: 'Active',
      },
    });

    return caseCount > 1;
  },
};

// ============================================================================
// Mutation Resolvers
// ============================================================================

export const emailClassificationMutationResolvers = {
  // Execute multi-case email import with classification - OPS-030
  executeClassifiedImport: async (
    _: unknown,
    { input }: { input: ExecuteClassifiedImportInput },
    context: Context
  ) => {
    const firmId = context.user?.firmId;
    const userId = context.user?.id;
    const accessToken = context.user?.accessToken;

    if (!firmId || !userId) {
      throw new Error('Authentication required');
    }

    const {
      caseId,
      emailAddresses,
      classificationOverrides,
      excludedEmailIds,
      importAttachments,
      contactAssignments,
    } = input;

    logger.info('[executeClassifiedImport] Starting', {
      caseId,
      emailAddressCount: emailAddresses.length,
      overrideCount: classificationOverrides.length,
      excludedCount: excludedEmailIds.length,
      importAttachments,
      hasAccessToken: !!accessToken,
    });

    const result = {
      success: true,
      totalEmailsImported: 0,
      totalAttachmentsImported: 0,
      importedByCase: [] as Array<{
        caseId: string;
        emailsImported: number;
        attachmentsImported: number;
        contactsCreated: number;
      }>,
      excluded: excludedEmailIds.length,
      errors: [] as string[],
    };

    try {
      // 1. Get the target case to derive client
      const targetCase = await prisma.case.findFirst({
        where: { id: caseId, firmId },
        select: { id: true, clientId: true },
      });

      if (!targetCase) {
        throw new Error('Case not found');
      }

      // 2. Find all emails by participant addresses
      const normalizedAddresses = emailAddresses.map((e) => e.toLowerCase().trim());
      const emails = await findEmailsByParticipantsForClassification(
        normalizedAddresses,
        userId,
        firmId
      );

      // 3. Filter out excluded emails
      const excludedSet = new Set(excludedEmailIds);
      const emailsToImport = emails.filter((e) => !excludedSet.has(e.id));

      logger.info('[executeClassifiedImport] Emails to import', {
        totalFound: emails.length,
        excluded: excludedEmailIds.length,
        toImport: emailsToImport.length,
      });

      if (emailsToImport.length === 0) {
        return result;
      }

      // 4. Build email-to-case mapping based on overrides
      // For now, classify all to the primary case (single-case mode)
      // When overrides are provided, use them; otherwise use primary case
      const overrideMap = new Map<string, string>();
      for (const override of classificationOverrides) {
        overrideMap.set(override.emailId, override.caseId);
      }

      // Group emails by target case
      const emailsByCase = new Map<string, string[]>();
      for (const email of emailsToImport) {
        const targetCaseId = overrideMap.get(email.id) || caseId;
        if (!emailsByCase.has(targetCaseId)) {
          emailsByCase.set(targetCaseId, []);
        }
        emailsByCase.get(targetCaseId)!.push(email.id);
      }

      logger.info('[executeClassifiedImport] Grouped by case', {
        caseCount: emailsByCase.size,
        distribution: Array.from(emailsByCase.entries()).map(([cId, ids]) => ({
          caseId: cId,
          count: ids.length,
        })),
      });

      // 5. Import to each case
      const attachmentService = getEmailAttachmentService(prisma);

      for (const [targetCaseId, emailIds] of emailsByCase) {
        const caseResult = {
          caseId: targetCaseId,
          emailsImported: 0,
          attachmentsImported: 0,
          contactsCreated: 0,
        };

        try {
          // Verify case access
          const caseRecord = await prisma.case.findFirst({
            where: {
              id: targetCaseId,
              firmId,
              teamMembers: { some: { userId } },
            },
          });

          if (!caseRecord) {
            result.errors.push(`Case ${targetCaseId}: access denied`);
            continue;
          }

          // Link emails to case
          const linkedResult = await prisma.email.updateMany({
            where: {
              id: { in: emailIds },
              userId,
              firmId,
            },
            data: { caseId: targetCaseId },
          });

          caseResult.emailsImported = linkedResult.count;
          result.totalEmailsImported += linkedResult.count;

          // Sync to timeline
          for (const emailId of emailIds) {
            try {
              await unifiedTimelineService.syncEmailToCommunicationEntry(emailId);
            } catch (syncErr: any) {
              logger.warn('[executeClassifiedImport] Timeline sync failed', {
                emailId,
                error: syncErr.message,
              });
            }
          }

          // Import attachments if requested
          if (importAttachments && accessToken) {
            const emailsWithAttachments = await prisma.email.findMany({
              where: {
                id: { in: emailIds },
                hasAttachments: true,
              },
              select: { id: true },
            });

            for (const email of emailsWithAttachments) {
              try {
                const syncResult = await attachmentService.syncAllAttachments(
                  email.id,
                  accessToken
                );
                caseResult.attachmentsImported += syncResult.attachmentsSynced;
                result.totalAttachmentsImported += syncResult.attachmentsSynced;
              } catch (attErr: any) {
                result.errors.push(`Attachment sync ${email.id}: ${attErr.message}`);
              }
            }
          }

          // Create contacts (only for primary case)
          if (targetCaseId === caseId) {
            for (const assignment of contactAssignments) {
              try {
                const existingActor = await prisma.caseActor.findFirst({
                  where: { caseId: targetCaseId, email: assignment.email.toLowerCase() },
                });

                if (!existingActor) {
                  await prisma.caseActor.create({
                    data: {
                      caseId: targetCaseId,
                      email: assignment.email.toLowerCase(),
                      name: assignment.name || assignment.email,
                      role: assignment.role,
                      createdBy: userId,
                    },
                  });
                  caseResult.contactsCreated++;
                }
              } catch (actorErr: any) {
                result.errors.push(`Contact ${assignment.email}: ${actorErr.message}`);
              }
            }
          }

          // Record activity
          await caseActivityService.recordActivity(
            targetCaseId,
            userId,
            'CommunicationReceived',
            'Communication',
            targetCaseId,
            `${caseResult.emailsImported} emailuri importate`,
            `Import clasificat din: ${normalizedAddresses.join(', ')}`,
            { emailCount: caseResult.emailsImported }
          );
        } catch (caseErr: any) {
          result.errors.push(`Case ${targetCaseId}: ${caseErr.message}`);
        }

        result.importedByCase.push(caseResult);
      }

      result.success = result.totalEmailsImported > 0;

      logger.info('[executeClassifiedImport] Complete', result);

      return result;
    } catch (error: any) {
      logger.error('[executeClassifiedImport] Failed', { error: error.message });
      result.success = false;
      result.errors.push(error.message);
      return result;
    }
  },
};

// ============================================================================
// Field Resolvers
// ============================================================================

export const emailClassificationFieldResolvers = {
  ClassificationResult: {
    suggestedCase: async (parent: ClassificationResult) => {
      if (!parent.suggestedCaseId) return null;
      return prisma.case.findUnique({ where: { id: parent.suggestedCaseId } });
    },
    // email field is already populated by the resolver
  },

  AlternativeCase: {
    case: async (parent: AlternativeCase) => {
      return prisma.case.findUnique({ where: { id: parent.caseId } });
    },
  },

  CaseClassificationSummary: {
    case: async (parent: { caseId: string }) => {
      return prisma.case.findUnique({ where: { id: parent.caseId } });
    },
  },

  CaseClassificationMetadata: {
    case: async (parent: { caseId: string }) => {
      return prisma.case.findUnique({ where: { id: parent.caseId } });
    },
  },

  CaseImportSummary: {
    case: async (parent: { caseId: string }) => {
      return prisma.case.findUnique({ where: { id: parent.caseId } });
    },
  },
};

// ============================================================================
// Export Combined Resolvers
// ============================================================================

export const emailClassificationResolvers = {
  Query: emailClassificationQueryResolvers,
  Mutation: emailClassificationMutationResolvers,
  ...emailClassificationFieldResolvers,
};
