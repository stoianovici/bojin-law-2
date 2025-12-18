/**
 * Classification Scoring Service
 * OPS-039: Enhanced Multi-Case Classification Algorithm
 * OPS-040: Court Email Detection & INSTANȚE Routing
 *
 * Implements a weighted scoring algorithm for classifying emails
 * when a contact has multiple active cases.
 *
 * Classification Flow:
 * 1. Court/Institution check - emails from courts skip contact matching
 * 2. Thread continuity (conversationId match) - deterministic, 100% confidence
 * 3. Single case contact - auto-assign with high confidence
 * 4. Multi-case scoring - weighted signals to determine best match
 *
 * Court Email Flow (OPS-040):
 * - Detected via GlobalEmailSource (domains/emails)
 * - Matches by case reference number only (not contacts)
 * - Goes to INSTANȚE folder (CourtUnassigned) if no match
 *
 * Scoring Weights:
 * - THREAD_CONTINUITY: 100 (same conversation = same case)
 * - REFERENCE_NUMBER: 50 (case reference found in subject/body)
 * - KEYWORD_SUBJECT: 30 (case keyword in subject)
 * - KEYWORD_BODY: 20 (case keyword in body, more noise)
 * - RECENT_ACTIVITY: 20 (email within 7 days of last case activity)
 */

import { prisma } from '@legal-platform/database';
import { CaseStatus, EmailClassificationState, GlobalEmailSourceCategory } from '@prisma/client';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export type SignalType =
  | 'THREAD_CONTINUITY'
  | 'REFERENCE_NUMBER'
  | 'KEYWORD_SUBJECT'
  | 'KEYWORD_BODY'
  | 'RECENT_ACTIVITY'
  | 'CONTACT_MATCH'
  | 'COURT_REFERENCE';

export interface ClassificationSignal {
  type: SignalType;
  weight: number;
  matched: string;
}

export interface CaseScore {
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  score: number;
  signals: ClassificationSignal[];
}

export interface ClassificationResult {
  caseId: string | null;
  state: EmailClassificationState;
  confidence: number;
  matchType:
    | SignalType
    | 'NO_MATCH'
    | 'UNKNOWN_CONTACT'
    | 'COURT_NO_REFERENCE'
    | 'COURT_MULTIPLE_MATCHES';
  suggestedCases?: CaseScore[];
  reason?: string;
  /** Reference numbers extracted from email (for court emails) */
  extractedReferences?: string[];
  /** Whether this email is from a court/institution */
  isFromInstitution?: boolean;
  /** Institution category if detected */
  institutionCategory?: GlobalEmailSourceCategory;
}

export interface EmailForClassification {
  id: string;
  conversationId: string;
  subject: string;
  bodyPreview: string;
  bodyContent?: string;
  from: { name?: string; address: string };
  toRecipients: Array<{ name?: string; address: string }>;
  ccRecipients?: Array<{ name?: string; address: string }>;
  receivedDateTime: Date;
}

export interface CaseContext {
  id: string;
  caseNumber: string;
  title: string;
  keywords: string[];
  referenceNumbers: string[];
  subjectPatterns: string[];
  lastActivityAt?: Date;
  actors: Array<{
    email: string | null;
    name: string;
    role: string;
  }>;
  client?: {
    email?: string;
    name: string;
  };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Scoring weights for different signal types
 */
export const WEIGHTS = {
  THREAD_CONTINUITY: 100, // Same conversationId - deterministic
  REFERENCE_NUMBER: 50, // Case reference in subject/body
  KEYWORD_SUBJECT: 30, // Case keyword in subject
  KEYWORD_BODY: 20, // Case keyword in body (more noise)
  RECENT_ACTIVITY: 20, // Email within 7 days of last case activity
  CONTACT_MATCH: 10, // Base score for contact being associated with case
} as const;

/**
 * Decision thresholds
 */
export const THRESHOLDS = {
  MIN_SCORE: 70, // Minimum to auto-assign
  MIN_GAP: 20, // Minimum lead over second place
  SINGLE_CASE_CONFIDENCE: 0.9, // Confidence for single-case contacts
} as const;

/**
 * Romanian court reference number patterns
 * Each pattern should have a capture group for the reference number itself
 */
export const REFERENCE_PATTERNS = [
  // Standard court file number format: 123/45/2025 or 1234/567/2024
  /\b(\d{1,6}\/\d{1,4}\/\d{4})\b/g,
  // "Dosar nr." format with variations
  /dosar(?:\s+nr\.?)?\s*[:\s]*(\d{1,6}\/\d{1,4}\/\d{4})/gi,
  // "Nr." format
  /\bnr\.?\s*(\d{1,6}\/\d{1,4}\/\d{4})/gi,
  // Contract reference format: CTR-2025-001
  /\b(CTR-\d{4}-\d{3,6})\b/gi,
  // Generic reference with prefix: REF-12345
  /\b(REF-\d{4,10})\b/gi,
];

/**
 * Days to consider for recent activity
 */
const RECENT_ACTIVITY_DAYS = 7;

// ============================================================================
// Service
// ============================================================================

export class ClassificationScoringService {
  /**
   * Classify an email to a case
   *
   * @param email - Email to classify
   * @param firmId - Firm ID for scoping
   * @param userId - User ID for scoping
   * @returns Classification result with case assignment or UNCERTAIN state
   */
  async classifyEmail(
    email: EmailForClassification,
    firmId: string,
    userId: string
  ): Promise<ClassificationResult> {
    logger.info('[ClassificationScoring.classifyEmail] Starting classification', {
      emailId: email.id,
      subject: email.subject.substring(0, 50),
      from: email.from.address,
    });

    // Step 0: Check if from court/institution (OPS-040)
    const institutionCheck = await this.checkInstitutionSource(email.from.address, firmId);
    if (institutionCheck) {
      logger.info('[ClassificationScoring.classifyEmail] Court/institution email detected', {
        emailId: email.id,
        category: institutionCheck.category,
      });
      return this.classifyCourtEmail(email, firmId, institutionCheck.category);
    }

    // Step 1: Check thread continuity (deterministic)
    const threadMatch = await this.checkThreadContinuity(email.conversationId, firmId);
    if (threadMatch) {
      logger.info('[ClassificationScoring.classifyEmail] Thread continuity match', {
        emailId: email.id,
        caseId: threadMatch.caseId,
      });
      return {
        caseId: threadMatch.caseId,
        state: EmailClassificationState.Classified,
        confidence: 1.0,
        matchType: 'THREAD_CONTINUITY',
      };
    }

    // Step 2: Find cases for the sender contact
    const senderEmail = email.from.address.toLowerCase();
    const candidateCases = await this.findCasesForContact(senderEmail, firmId, userId);

    if (candidateCases.length === 0) {
      logger.info('[ClassificationScoring.classifyEmail] Unknown contact', {
        emailId: email.id,
        senderEmail,
      });
      return {
        caseId: null,
        state: EmailClassificationState.Uncertain,
        confidence: 0,
        matchType: 'UNKNOWN_CONTACT',
        reason: 'Sender not associated with any case',
      };
    }

    // Step 3: Single case contact - auto-assign
    if (candidateCases.length === 1) {
      logger.info('[ClassificationScoring.classifyEmail] Single case contact', {
        emailId: email.id,
        caseId: candidateCases[0].id,
      });
      return {
        caseId: candidateCases[0].id,
        state: EmailClassificationState.Classified,
        confidence: THRESHOLDS.SINGLE_CASE_CONFIDENCE,
        matchType: 'CONTACT_MATCH',
      };
    }

    // Step 4: Multi-case scoring
    logger.info('[ClassificationScoring.classifyEmail] Multi-case scoring', {
      emailId: email.id,
      candidateCount: candidateCases.length,
    });

    return this.scoreAndClassify(email, candidateCases);
  }

  // ============================================================================
  // Court/Institution Email Classification (OPS-040)
  // ============================================================================

  /**
   * Check if sender is from a known court/institution
   * Returns the category if matched, null otherwise
   */
  private async checkInstitutionSource(
    senderAddress: string,
    firmId: string
  ): Promise<{ category: GlobalEmailSourceCategory } | null> {
    const senderEmail = senderAddress.toLowerCase();
    const senderDomain = this.extractDomain(senderEmail);

    const sources = await prisma.globalEmailSource.findMany({
      where: {
        firmId,
        OR: [
          // Match by exact email address
          { emails: { has: senderEmail } },
          // Match by domain
          { domains: { has: senderDomain } },
        ],
      },
      select: { category: true },
    });

    if (sources.length > 0) {
      return { category: sources[0].category };
    }

    return null;
  }

  /**
   * Extract domain from email address
   */
  private extractDomain(email: string): string {
    const parts = email.split('@');
    return parts.length > 1 ? parts[1].toLowerCase() : '';
  }

  /**
   * Classify a court/institution email by reference number matching
   * OPS-040: Court emails go through a different classification path
   */
  private async classifyCourtEmail(
    email: EmailForClassification,
    firmId: string,
    institutionCategory: GlobalEmailSourceCategory
  ): Promise<ClassificationResult> {
    // Extract all reference numbers from email
    const textToSearch = `${email.subject} ${email.bodyPreview} ${email.bodyContent || ''}`;
    const extractedReferences = this.extractReferenceNumbers(textToSearch);

    logger.info('[ClassificationScoring.classifyCourtEmail] Extracted references', {
      emailId: email.id,
      references: extractedReferences,
    });

    if (extractedReferences.length === 0) {
      // No reference numbers found - goes to INSTANȚE folder
      return {
        caseId: null,
        state: EmailClassificationState.CourtUnassigned,
        confidence: 0,
        matchType: 'COURT_NO_REFERENCE',
        reason: 'No reference number found in email',
        isFromInstitution: true,
        institutionCategory,
        extractedReferences: [],
      };
    }

    // Find cases with matching reference numbers
    const matchingCases = await prisma.case.findMany({
      where: {
        firmId,
        status: { in: [CaseStatus.Active, CaseStatus.PendingApproval] },
        referenceNumbers: { hasSome: extractedReferences },
      },
      select: {
        id: true,
        caseNumber: true,
        title: true,
        referenceNumbers: true,
      },
    });

    logger.info('[ClassificationScoring.classifyCourtEmail] Case matches found', {
      emailId: email.id,
      matchCount: matchingCases.length,
    });

    if (matchingCases.length === 0) {
      // No matching case - goes to INSTANȚE folder
      return {
        caseId: null,
        state: EmailClassificationState.CourtUnassigned,
        confidence: 0,
        matchType: 'COURT_NO_REFERENCE',
        reason: 'No case found with matching reference number',
        isFromInstitution: true,
        institutionCategory,
        extractedReferences,
      };
    }

    if (matchingCases.length === 1) {
      // Single match - auto-assign with high confidence
      return {
        caseId: matchingCases[0].id,
        state: EmailClassificationState.Classified,
        confidence: 1.0,
        matchType: 'COURT_REFERENCE',
        isFromInstitution: true,
        institutionCategory,
        extractedReferences,
      };
    }

    // Multiple matches - should be rare, but handle it
    // Goes to INSTANȚE folder with suggestions
    return {
      caseId: null,
      state: EmailClassificationState.CourtUnassigned,
      confidence: 0.5,
      matchType: 'COURT_MULTIPLE_MATCHES',
      reason: 'Multiple cases match the reference number',
      isFromInstitution: true,
      institutionCategory,
      extractedReferences,
      suggestedCases: matchingCases.map((c) => ({
        caseId: c.id,
        caseNumber: c.caseNumber,
        caseTitle: c.title,
        score: 50,
        signals: [
          {
            type: 'REFERENCE_NUMBER' as SignalType,
            weight: 50,
            matched:
              c.referenceNumbers.find((r) =>
                extractedReferences.some(
                  (e) => this.normalizeReference(r) === this.normalizeReference(e)
                )
              ) || c.referenceNumbers[0],
          },
        ],
      })),
    };
  }

  /**
   * Check if an email belongs to an existing thread (same conversationId)
   * Returns the case ID if a match is found
   */
  private async checkThreadContinuity(
    conversationId: string,
    firmId: string
  ): Promise<{ caseId: string } | null> {
    const existingEmail = await prisma.email.findFirst({
      where: {
        conversationId,
        firmId,
        caseId: { not: null },
        classificationState: EmailClassificationState.Classified,
      },
      select: { caseId: true },
      orderBy: { receivedDateTime: 'desc' },
    });

    return existingEmail?.caseId ? { caseId: existingEmail.caseId } : null;
  }

  /**
   * Find all cases where the contact is associated (as actor or client)
   */
  private async findCasesForContact(
    contactEmail: string,
    firmId: string,
    userId: string
  ): Promise<CaseContext[]> {
    // Find cases where contact is an actor
    const casesWithActor = await prisma.case.findMany({
      where: {
        firmId,
        status: { in: [CaseStatus.Active, CaseStatus.PendingApproval] },
        OR: [
          { actors: { some: { email: { equals: contactEmail, mode: 'insensitive' } } } },
          {
            client: {
              contactInfo: {
                path: ['email'],
                string_contains: contactEmail,
              },
            },
          },
        ],
        // User must be on the case team
        teamMembers: { some: { userId } },
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

    return casesWithActor.map((c) => ({
      id: c.id,
      caseNumber: c.caseNumber,
      title: c.title,
      keywords: c.keywords || [],
      referenceNumbers: c.referenceNumbers || [],
      subjectPatterns: c.subjectPatterns || [],
      lastActivityAt: c.activityFeed[0]?.createdAt,
      actors: c.actors.map((a) => ({
        email: a.email,
        name: a.name,
        role: a.role,
      })),
      client: {
        name: c.client.name,
        email: (c.client.contactInfo as { email?: string })?.email,
      },
    }));
  }

  /**
   * Score each candidate case and make classification decision
   */
  private scoreAndClassify(
    email: EmailForClassification,
    candidateCases: CaseContext[]
  ): ClassificationResult {
    // Score each case
    const scores = candidateCases.map((caseCtx) => this.scoreCase(email, caseCtx));

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    const top = scores[0];
    const second = scores[1];
    const gap = second ? top.score - second.score : top.score;

    logger.info('[ClassificationScoring.scoreAndClassify] Scoring complete', {
      emailId: email.id,
      topScore: top.score,
      secondScore: second?.score,
      gap,
    });

    // Decision: auto-assign if high confidence and clear winner
    if (top.score >= THRESHOLDS.MIN_SCORE && gap >= THRESHOLDS.MIN_GAP) {
      return {
        caseId: top.caseId,
        state: EmailClassificationState.Classified,
        confidence: Math.min(top.score / 100, 1.0),
        matchType: top.signals[0]?.type || 'CONTACT_MATCH',
      };
    }

    // Uncertain: needs user review
    return {
      caseId: null,
      state: EmailClassificationState.Uncertain,
      confidence: top.score / 100,
      matchType: 'NO_MATCH',
      suggestedCases: scores.slice(0, 3),
      reason: gap < THRESHOLDS.MIN_GAP ? 'AMBIGUOUS' : 'LOW_CONFIDENCE',
    };
  }

  /**
   * Score a single case against an email
   */
  private scoreCase(email: EmailForClassification, caseCtx: CaseContext): CaseScore {
    const signals: ClassificationSignal[] = [];
    let totalScore = WEIGHTS.CONTACT_MATCH; // Base score for contact being associated

    signals.push({
      type: 'CONTACT_MATCH',
      weight: WEIGHTS.CONTACT_MATCH,
      matched: email.from.address,
    });

    // Check reference numbers in email content
    const refMatches = this.findReferenceNumberMatches(email, caseCtx.referenceNumbers);
    for (const match of refMatches) {
      signals.push({
        type: 'REFERENCE_NUMBER',
        weight: WEIGHTS.REFERENCE_NUMBER,
        matched: match,
      });
      totalScore += WEIGHTS.REFERENCE_NUMBER;
    }

    // Check keywords in subject
    const subjectLower = email.subject.toLowerCase();
    for (const keyword of caseCtx.keywords) {
      if (keyword && subjectLower.includes(keyword.toLowerCase())) {
        signals.push({
          type: 'KEYWORD_SUBJECT',
          weight: WEIGHTS.KEYWORD_SUBJECT,
          matched: keyword,
        });
        totalScore += WEIGHTS.KEYWORD_SUBJECT;
        break; // Only count once per email
      }
    }

    // Check keywords in body
    const bodyLower = (email.bodyPreview || '').toLowerCase();
    const bodyContentLower = (email.bodyContent || '').toLowerCase();
    for (const keyword of caseCtx.keywords) {
      if (
        keyword &&
        (bodyLower.includes(keyword.toLowerCase()) ||
          bodyContentLower.includes(keyword.toLowerCase()))
      ) {
        // Don't double-count if already found in subject
        if (!signals.some((s) => s.type === 'KEYWORD_SUBJECT' && s.matched === keyword)) {
          signals.push({
            type: 'KEYWORD_BODY',
            weight: WEIGHTS.KEYWORD_BODY,
            matched: keyword,
          });
          totalScore += WEIGHTS.KEYWORD_BODY;
          break; // Only count once
        }
      }
    }

    // Check case number in subject or body
    const caseNumberLower = caseCtx.caseNumber.toLowerCase();
    if (
      subjectLower.includes(caseNumberLower) ||
      bodyLower.includes(caseNumberLower) ||
      bodyContentLower.includes(caseNumberLower)
    ) {
      signals.push({
        type: 'REFERENCE_NUMBER',
        weight: WEIGHTS.REFERENCE_NUMBER,
        matched: caseCtx.caseNumber,
      });
      totalScore += WEIGHTS.REFERENCE_NUMBER;
    }

    // Check recent activity
    if (caseCtx.lastActivityAt) {
      const daysSinceActivity = Math.floor(
        (email.receivedDateTime.getTime() - caseCtx.lastActivityAt.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (daysSinceActivity >= 0 && daysSinceActivity <= RECENT_ACTIVITY_DAYS) {
        signals.push({
          type: 'RECENT_ACTIVITY',
          weight: WEIGHTS.RECENT_ACTIVITY,
          matched: `${daysSinceActivity} days ago`,
        });
        totalScore += WEIGHTS.RECENT_ACTIVITY;
      }
    }

    // Sort signals by weight descending
    signals.sort((a, b) => b.weight - a.weight);

    return {
      caseId: caseCtx.id,
      caseNumber: caseCtx.caseNumber,
      caseTitle: caseCtx.title,
      score: totalScore,
      signals,
    };
  }

  /**
   * Find reference numbers in email that match case references
   */
  private findReferenceNumberMatches(
    email: EmailForClassification,
    caseReferenceNumbers: string[]
  ): string[] {
    if (!caseReferenceNumbers || caseReferenceNumbers.length === 0) {
      return [];
    }

    const matches: string[] = [];
    const textToSearch = `${email.subject} ${email.bodyPreview} ${email.bodyContent || ''}`;

    // Extract reference numbers from email
    const extractedRefs = this.extractReferenceNumbers(textToSearch);

    // Check for matches with case reference numbers
    for (const ref of caseReferenceNumbers) {
      const refNormalized = this.normalizeReference(ref);
      for (const extracted of extractedRefs) {
        const extractedNormalized = this.normalizeReference(extracted);
        if (refNormalized === extractedNormalized) {
          matches.push(ref);
          break;
        }
      }
    }

    return [...new Set(matches)];
  }

  /**
   * Extract reference numbers from text using Romanian patterns
   */
  extractReferenceNumbers(text: string): string[] {
    const matches: string[] = [];

    for (const pattern of REFERENCE_PATTERNS) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        // Get the full match or the first capture group
        const ref = match[1] ? match[1] : match[0];
        matches.push(ref);
      }
    }

    return [...new Set(matches)];
  }

  /**
   * Normalize reference number for comparison
   */
  private normalizeReference(ref: string): string {
    return ref
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^\d/a-z-]/gi, '');
  }

  /**
   * Batch classify multiple emails
   * Useful for processing emails during sync
   */
  async classifyEmails(
    emails: EmailForClassification[],
    firmId: string,
    userId: string
  ): Promise<Map<string, ClassificationResult>> {
    const results = new Map<string, ClassificationResult>();

    for (const email of emails) {
      try {
        const result = await this.classifyEmail(email, firmId, userId);
        results.set(email.id, result);
      } catch (error: any) {
        logger.error('[ClassificationScoring.classifyEmails] Error classifying email', {
          emailId: email.id,
          error: error.message,
        });
        results.set(email.id, {
          caseId: null,
          state: EmailClassificationState.Uncertain,
          confidence: 0,
          matchType: 'NO_MATCH',
          reason: `Classification error: ${error.message}`,
        });
      }
    }

    return results;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let classificationScoringServiceInstance: ClassificationScoringService | null = null;

export function getClassificationScoringService(): ClassificationScoringService {
  if (!classificationScoringServiceInstance) {
    classificationScoringServiceInstance = new ClassificationScoringService();
  }
  return classificationScoringServiceInstance;
}

export const classificationScoringService = new ClassificationScoringService();
