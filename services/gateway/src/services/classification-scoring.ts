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
import {
  CaseStatus,
  ClassificationMatchType,
  EmailClassificationState,
  GlobalEmailSourceCategory,
} from '@prisma/client';
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
  | 'COURT_REFERENCE'
  | 'TITLE_MATCH'
  | 'CLIENT_NAME_MATCH'
  | 'ACTOR_MATCH';

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

/**
 * OPS-059: Individual case assignment with confidence and match type
 * Used when an email is linked to multiple cases
 */
export interface CaseAssignment {
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  confidence: number;
  matchType: ClassificationMatchType;
  isPrimary: boolean;
  signals?: ClassificationSignal[];
}

/**
 * Helper type for internal match type before conversion to Prisma enum
 */
export type InternalMatchType =
  | SignalType
  | 'NO_MATCH'
  | 'UNKNOWN_CONTACT'
  | 'COURT_NO_REFERENCE'
  | 'COURT_MULTIPLE_MATCHES';

export interface ClassificationResult {
  /** @deprecated Use caseAssignments instead for multi-case support */
  caseId: string | null;
  state: EmailClassificationState;
  /** @deprecated Use caseAssignments[].confidence instead */
  confidence: number;
  matchType: InternalMatchType;
  /** OPS-059: Array of case assignments (for multi-case support) */
  caseAssignments: CaseAssignment[];
  suggestedCases?: CaseScore[];
  reason?: string;
  /** Reference numbers extracted from email (for court emails) */
  extractedReferences?: string[];
  /** Whether this email is from a court/institution */
  isFromInstitution?: boolean;
  /** Institution category if detected */
  institutionCategory?: GlobalEmailSourceCategory;
  /** OPS-195: True when sender has 2+ active cases, requires user confirmation */
  needsConfirmation?: boolean;
  /** Client ID when email goes to ClientInbox (multi-case client) */
  clientId?: string;
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
  parentFolderName?: string; // 'Inbox', 'Sent Items', etc.
}

export interface CaseContext {
  id: string;
  caseNumber: string;
  title: string;
  description?: string;
  keywords: string[];
  referenceNumbers: string[];
  subjectPatterns: string[];
  lastActivityAt?: Date;
  actors: Array<{
    email: string | null;
    name: string;
    role: string;
    organization?: string;
    emailDomains?: string[]; // Domains associated with this actor (e.g., company domain)
  }>;
  client?: {
    id?: string; // Client ID for ClientInbox routing
    email?: string;
    name: string;
  };
  /** References from case metadata (UI stores references here) */
  metadataReferences?: Array<{ type: string; value: string }>;
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
  TITLE_MATCH: 40, // Case title keyword found in email
  CLIENT_NAME_MATCH: 35, // Client name found in email
  KEYWORD_SUBJECT: 30, // Case keyword in subject
  ACTOR_MATCH: 25, // Actor name/organization found in email
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

/**
 * Convert internal signal/match type to Prisma ClassificationMatchType enum
 */
function toClassificationMatchType(signalType: SignalType | string): ClassificationMatchType {
  switch (signalType) {
    case 'THREAD_CONTINUITY':
      return ClassificationMatchType.ThreadContinuity;
    case 'REFERENCE_NUMBER':
    case 'COURT_REFERENCE':
      return ClassificationMatchType.ReferenceNumber;
    case 'KEYWORD_SUBJECT':
    case 'KEYWORD_BODY':
    case 'TITLE_MATCH':
    case 'CLIENT_NAME_MATCH':
      return ClassificationMatchType.Keyword;
    case 'CONTACT_MATCH':
    case 'ACTOR_MATCH':
      return ClassificationMatchType.Actor;
    case 'RECENT_ACTIVITY':
      // Recent activity is supplementary, default to Actor
      return ClassificationMatchType.Actor;
    default:
      return ClassificationMatchType.Actor;
  }
}

// ============================================================================
// Service
// ============================================================================

export class ClassificationScoringService {
  /**
   * Classify an email to one or more cases
   * OPS-059: Now returns multiple case assignments when appropriate
   *
   * @param email - Email to classify
   * @param firmId - Firm ID for scoping
   * @param userId - User ID for scoping
   * @returns Classification result with case assignments
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

    // OPS-059: Collect ALL case assignments instead of returning on first match
    const caseAssignments: CaseAssignment[] = [];
    let threadCaseId: string | null = null;

    // Step 1: Check thread continuity - add to assignments but DON'T return early
    const threadMatch = await this.checkThreadContinuity(email.conversationId, firmId);
    if (threadMatch) {
      logger.info('[ClassificationScoring.classifyEmail] Thread continuity match found', {
        emailId: email.id,
        caseId: threadMatch.caseId,
      });
      threadCaseId = threadMatch.caseId;

      // Get case details for the thread match
      const threadCase = await prisma.case.findUnique({
        where: { id: threadMatch.caseId },
        select: { id: true, caseNumber: true, title: true },
      });

      if (threadCase) {
        caseAssignments.push({
          caseId: threadCase.id,
          caseNumber: threadCase.caseNumber,
          caseTitle: threadCase.title,
          confidence: 1.0,
          matchType: ClassificationMatchType.ThreadContinuity,
          isPrimary: true, // Thread continuity is always primary
          signals: [
            {
              type: 'THREAD_CONTINUITY',
              weight: WEIGHTS.THREAD_CONTINUITY,
              matched: email.conversationId,
            },
          ],
        });
      }
    }

    // Step 2: Find ALL cases for contacts
    // For sent emails, check recipients; for received emails, check sender
    // Note: "Elemente trimise" is Romanian for "Sent Items"
    const isSentEmail =
      email.parentFolderName === 'Sent Items' || email.parentFolderName === 'Elemente trimise';
    let candidateCases: CaseContext[] = [];

    if (isSentEmail) {
      // For sent emails, look up cases by recipients (to + cc)
      const allRecipients = [...email.toRecipients, ...(email.ccRecipients || [])];
      const recipientEmails = allRecipients.map((r) => r.address?.toLowerCase()).filter(Boolean);

      logger.info('[ClassificationScoring.classifyEmail] Sent email - checking recipients', {
        emailId: email.id,
        recipientCount: recipientEmails.length,
      });

      // Find cases for each recipient (deduplicate by case ID)
      const caseMap = new Map<string, CaseContext>();
      for (const recipientEmail of recipientEmails) {
        const cases = await this.findCasesForContact(recipientEmail, firmId, userId);
        for (const c of cases) {
          if (!caseMap.has(c.id)) {
            caseMap.set(c.id, c);
          }
        }
      }
      candidateCases = Array.from(caseMap.values());
    } else {
      // For received emails, look up cases by sender
      const senderEmail = email.from.address.toLowerCase();
      candidateCases = await this.findCasesForContact(senderEmail, firmId, userId);
    }

    if (candidateCases.length === 0 && caseAssignments.length === 0) {
      const contactInfo = isSentEmail
        ? `recipients: ${email.toRecipients.map((r) => r.address).join(', ')}`
        : `sender: ${email.from.address}`;
      logger.info('[ClassificationScoring.classifyEmail] Unknown contact, no assignments', {
        emailId: email.id,
        contactInfo,
        isSentEmail,
      });
      return {
        caseId: null,
        state: EmailClassificationState.Uncertain,
        confidence: 0,
        matchType: 'UNKNOWN_CONTACT',
        caseAssignments: [],
        reason: isSentEmail
          ? 'No recipients associated with any case'
          : 'Sender not associated with any case',
      };
    }

    // Step 3: Score ALL candidate cases and add qualifying ones
    for (const caseCtx of candidateCases) {
      // Skip if already added via thread continuity
      if (caseCtx.id === threadCaseId) {
        continue;
      }

      const caseScore = this.scoreCase(email, caseCtx, isSentEmail);

      // OPS-059: Add ALL cases that meet the minimum score threshold
      // This allows emails to be linked to multiple cases when contact appears in multiple
      if (caseScore.score >= THRESHOLDS.MIN_SCORE || candidateCases.length === 1) {
        const confidence =
          candidateCases.length === 1
            ? THRESHOLDS.SINGLE_CASE_CONFIDENCE
            : Math.min(caseScore.score / 100, 1.0);

        caseAssignments.push({
          caseId: caseScore.caseId,
          caseNumber: caseScore.caseNumber,
          caseTitle: caseScore.caseTitle,
          confidence,
          matchType: toClassificationMatchType(caseScore.signals[0]?.type || 'CONTACT_MATCH'),
          isPrimary: caseAssignments.length === 0, // First added is primary if no thread match
          signals: caseScore.signals,
        });

        logger.info('[ClassificationScoring.classifyEmail] Case added to assignments', {
          emailId: email.id,
          caseId: caseScore.caseId,
          score: caseScore.score,
          confidence,
          isPrimary: caseAssignments.length === 1,
        });
      }
    }

    // Step 4: Determine final classification state
    if (caseAssignments.length === 0) {
      // No qualifying cases - suggest top candidates for review
      const scores = candidateCases.map((c) => this.scoreCase(email, c, isSentEmail));
      scores.sort((a, b) => b.score - a.score);

      logger.info('[ClassificationScoring.classifyEmail] No qualifying cases, uncertain', {
        emailId: email.id,
        topScore: scores[0]?.score,
      });

      return {
        caseId: null,
        state: EmailClassificationState.Uncertain,
        confidence: scores[0] ? scores[0].score / 100 : 0,
        matchType: 'NO_MATCH',
        caseAssignments: [],
        suggestedCases: scores.slice(0, 3),
        reason: 'No case met classification threshold',
      };
    }

    // Determine primary case for backward compatibility
    const primaryAssignment = caseAssignments.find((a) => a.isPrimary) || caseAssignments[0];

    // OPS-195: Check if sender has multiple cases (requires confirmation)
    // needsConfirmation is true when:
    // 1. candidateCases has 2+ entries (sender appears in multiple cases)
    // 2. NOT a thread continuity match (those are deterministic)
    const hasThreadMatch = caseAssignments.some(
      (a) => a.matchType === ClassificationMatchType.ThreadContinuity
    );
    const needsConfirmation = candidateCases.length >= 2 && !hasThreadMatch;

    // Client Inbox: Route to ClientInbox when:
    // 1. Multiple cases for the same client (multi-case client)
    // 2. No thread continuity match
    // This allows manual assignment from the client inbox
    if (needsConfirmation && candidateCases.length >= 2) {
      // Check if all candidate cases belong to the same client
      const clientIds = new Set(candidateCases.map((c) => c.client?.id).filter(Boolean));

      if (clientIds.size === 1) {
        const clientId = candidateCases[0].client?.id;

        logger.info('[ClassificationScoring.classifyEmail] Client Inbox - multi-case client', {
          emailId: email.id,
          clientId,
          clientName: candidateCases[0].client?.name,
          caseCount: candidateCases.length,
        });

        return {
          caseId: null,
          state: EmailClassificationState.ClientInbox,
          confidence: 0,
          matchType: 'CONTACT_MATCH',
          caseAssignments,
          needsConfirmation: true,
          clientId,
          reason: `Multi-case client: ${candidateCases[0].client?.name} (${candidateCases.length} active cases)`,
        };
      }
    }

    logger.info('[ClassificationScoring.classifyEmail] Classification complete', {
      emailId: email.id,
      assignmentCount: caseAssignments.length,
      primaryCaseId: primaryAssignment.caseId,
      caseIds: caseAssignments.map((a) => a.caseId),
      needsConfirmation,
    });

    return {
      caseId: primaryAssignment.caseId,
      state: EmailClassificationState.Classified,
      confidence: primaryAssignment.confidence,
      matchType: primaryAssignment.signals?.[0]?.type || 'CONTACT_MATCH',
      caseAssignments,
      needsConfirmation,
    };
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
        caseAssignments: [],
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
        caseAssignments: [],
        reason: 'No case found with matching reference number',
        isFromInstitution: true,
        institutionCategory,
        extractedReferences,
      };
    }

    // OPS-059: Court emails can also match multiple cases - assign to all matching
    const courtAssignments: CaseAssignment[] = matchingCases.map((c, index) => ({
      caseId: c.id,
      caseNumber: c.caseNumber,
      caseTitle: c.title,
      confidence: 1.0,
      matchType: ClassificationMatchType.ReferenceNumber,
      isPrimary: index === 0,
      signals: [
        {
          type: 'COURT_REFERENCE' as SignalType,
          weight: WEIGHTS.REFERENCE_NUMBER,
          matched:
            c.referenceNumbers.find((r) =>
              extractedReferences.some(
                (e) => this.normalizeReference(r) === this.normalizeReference(e)
              )
            ) || c.referenceNumbers[0],
        },
      ],
    }));

    if (matchingCases.length === 1) {
      // Single match - auto-assign with high confidence
      return {
        caseId: matchingCases[0].id,
        state: EmailClassificationState.Classified,
        confidence: 1.0,
        matchType: 'COURT_REFERENCE',
        caseAssignments: courtAssignments,
        isFromInstitution: true,
        institutionCategory,
        extractedReferences,
      };
    }

    // Multiple matches - assign to all matching cases
    // OPS-059: Now assigns to all instead of going to INSTANȚE
    return {
      caseId: courtAssignments[0].caseId,
      state: EmailClassificationState.Classified,
      confidence: 1.0,
      matchType: 'COURT_REFERENCE',
      caseAssignments: courtAssignments,
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
   * Also matches by email domain if actor has emailDomains configured
   */
  private async findCasesForContact(
    contactEmail: string,
    firmId: string,
    userId: string
  ): Promise<CaseContext[]> {
    // Normalize contact email for comparison
    const normalizedContactEmail = contactEmail.toLowerCase().trim();
    const contactDomain = this.extractDomain(normalizedContactEmail);

    // Common select clause for all queries (include metadata for references)
    const caseSelect = {
      id: true,
      caseNumber: true,
      title: true,
      description: true,
      keywords: true,
      referenceNumbers: true,
      subjectPatterns: true,
      metadata: true, // Contains references array from UI
      actors: {
        select: {
          email: true,
          name: true,
          role: true,
          organization: true,
          emailDomains: true, // Include actor's associated domains
        },
      },
      client: { select: { id: true, name: true, contactInfo: true } },
      activityFeed: {
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' } as const,
        take: 1,
      },
    };

    // Query 1: Find cases where contact is an actor (case-insensitive via Prisma)
    const casesWithActor = await prisma.case.findMany({
      where: {
        firmId,
        status: { in: [CaseStatus.Active, CaseStatus.PendingApproval] },
        actors: { some: { email: { equals: contactEmail, mode: 'insensitive' } } },
        teamMembers: { some: { userId } },
      },
      select: caseSelect,
    });

    // Query 2: Find cases where client has an email (we'll filter in JS for case-insensitivity)
    const casesWithClientEmail = await prisma.case.findMany({
      where: {
        firmId,
        status: { in: [CaseStatus.Active, CaseStatus.PendingApproval] },
        client: {
          contactInfo: {
            path: ['email'],
            not: { equals: null },
          },
        },
        teamMembers: { some: { userId } },
      },
      select: caseSelect,
    });

    // Query 3: Find cases where an actor has the contact's domain in their emailDomains
    // This matches company-wide emails (e.g., anyone@company.com matches if actor has company.com)
    const casesWithActorDomain = contactDomain
      ? await prisma.case.findMany({
          where: {
            firmId,
            status: { in: [CaseStatus.Active, CaseStatus.PendingApproval] },
            actors: { some: { emailDomains: { has: contactDomain } } },
            teamMembers: { some: { userId } },
          },
          select: caseSelect,
        })
      : [];

    // Filter cases where client email matches (case-insensitive)
    const matchingClientCases = casesWithClientEmail.filter((c) => {
      const clientEmail = (c.client.contactInfo as { email?: string })?.email;
      return clientEmail && clientEmail.toLowerCase().trim() === normalizedContactEmail;
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
    for (const c of casesWithActorDomain) {
      if (!caseMap.has(c.id)) {
        caseMap.set(c.id, c);
      }
    }

    return Array.from(caseMap.values()).map((c) => this.mapCaseToContext(c));
  }

  /**
   * Map a Prisma case result to CaseContext
   */
  private mapCaseToContext(c: {
    id: string;
    caseNumber: string;
    title: string;
    description: string;
    keywords: string[];
    referenceNumbers: string[];
    subjectPatterns: string[];
    metadata: unknown;
    actors: Array<{
      email: string | null;
      name: string;
      role: string;
      organization: string | null;
      emailDomains: string[];
    }>;
    client: { id: string; name: string; contactInfo: unknown };
    activityFeed: Array<{ createdAt: Date }>;
  }): CaseContext {
    // Extract references from metadata (UI stores them here)
    const metadata = c.metadata as { references?: Array<{ type: string; value: string }> } | null;
    const metadataReferences = metadata?.references || [];

    return {
      id: c.id,
      caseNumber: c.caseNumber,
      title: c.title,
      description: c.description || undefined,
      keywords: c.keywords || [],
      referenceNumbers: c.referenceNumbers || [],
      subjectPatterns: c.subjectPatterns || [],
      lastActivityAt: c.activityFeed[0]?.createdAt,
      actors: c.actors.map((a) => ({
        email: a.email,
        name: a.name,
        role: a.role,
        organization: a.organization || undefined,
        emailDomains: a.emailDomains || [],
      })),
      client: {
        id: c.client.id,
        name: c.client.name,
        email: (c.client.contactInfo as { email?: string })?.email,
      },
      metadataReferences,
    };
  }

  /**
   * Score each candidate case and make classification decision
   * @deprecated OPS-059: Replaced by inline logic in classifyEmail that returns multiple assignments
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
        caseAssignments: [
          {
            caseId: top.caseId,
            caseNumber: top.caseNumber,
            caseTitle: top.caseTitle,
            confidence: Math.min(top.score / 100, 1.0),
            matchType: toClassificationMatchType(top.signals[0]?.type || 'CONTACT_MATCH'),
            isPrimary: true,
            signals: top.signals,
          },
        ],
      };
    }

    // Uncertain: needs user review
    return {
      caseId: null,
      state: EmailClassificationState.Uncertain,
      confidence: top.score / 100,
      matchType: 'NO_MATCH',
      caseAssignments: [],
      suggestedCases: scores.slice(0, 3),
      reason: gap < THRESHOLDS.MIN_GAP ? 'AMBIGUOUS' : 'LOW_CONFIDENCE',
    };
  }

  /**
   * Score a single case against an email
   * Uses all case setup data: title, description, client name, actors, keywords, reference numbers
   * @param email - Email to classify
   * @param caseCtx - Case context with all data
   * @param isSentEmail - If true, skip CONTACT_MATCH score (since sender is the user)
   */
  private scoreCase(
    email: EmailForClassification,
    caseCtx: CaseContext,
    isSentEmail: boolean = false
  ): CaseScore {
    const signals: ClassificationSignal[] = [];
    let totalScore = 0;

    // Base score for contact being associated (skip for sent emails since from=user)
    if (!isSentEmail) {
      totalScore = WEIGHTS.CONTACT_MATCH;
      signals.push({
        type: 'CONTACT_MATCH',
        weight: WEIGHTS.CONTACT_MATCH,
        matched: email.from.address,
      });
    }

    const subjectLower = email.subject.toLowerCase();
    const bodyLower = (email.bodyPreview || '').toLowerCase();
    const bodyContentLower = (email.bodyContent || '').toLowerCase();
    const emailText = `${subjectLower} ${bodyLower} ${bodyContentLower}`;

    // Collect ALL reference numbers from multiple sources:
    // 1. Direct referenceNumbers field
    // 2. Extracted from description
    // 3. From metadata.references (UI stores references here!)
    const allReferenceNumbers = [...caseCtx.referenceNumbers];

    // Extract reference numbers from description
    if (caseCtx.description) {
      const descriptionRefs = this.extractReferenceNumbers(caseCtx.description);
      for (const ref of descriptionRefs) {
        if (!allReferenceNumbers.includes(ref)) {
          allReferenceNumbers.push(ref);
        }
      }
    }

    // Add references from metadata (UI stores them here)
    if (caseCtx.metadataReferences && caseCtx.metadataReferences.length > 0) {
      for (const metaRef of caseCtx.metadataReferences) {
        if (metaRef.value && !allReferenceNumbers.includes(metaRef.value)) {
          allReferenceNumbers.push(metaRef.value);
        }
      }
    }

    const refMatches = this.findReferenceNumberMatches(email, allReferenceNumbers);
    for (const match of refMatches) {
      signals.push({
        type: 'REFERENCE_NUMBER',
        weight: WEIGHTS.REFERENCE_NUMBER,
        matched: match,
      });
      totalScore += WEIGHTS.REFERENCE_NUMBER;
    }

    // Check case title words in email (extract significant words from title)
    const titleKeywords = this.extractSignificantWords(caseCtx.title);
    let titleMatched = false;
    for (const word of titleKeywords) {
      if (emailText.includes(word.toLowerCase())) {
        if (!titleMatched) {
          signals.push({
            type: 'TITLE_MATCH',
            weight: WEIGHTS.TITLE_MATCH,
            matched: word,
          });
          totalScore += WEIGHTS.TITLE_MATCH;
          titleMatched = true;
        }
      }
    }

    // Check client name in email
    if (caseCtx.client?.name) {
      const clientKeywords = this.extractSignificantWords(caseCtx.client.name);
      let clientMatched = false;
      for (const word of clientKeywords) {
        if (emailText.includes(word.toLowerCase())) {
          if (!clientMatched) {
            signals.push({
              type: 'CLIENT_NAME_MATCH',
              weight: WEIGHTS.CLIENT_NAME_MATCH,
              matched: word,
            });
            totalScore += WEIGHTS.CLIENT_NAME_MATCH;
            clientMatched = true;
          }
        }
      }
    }

    // Check actor names and organizations in email
    let actorMatched = false;
    for (const actor of caseCtx.actors) {
      if (actorMatched) break;
      // Check actor name
      const actorNameWords = this.extractSignificantWords(actor.name);
      for (const word of actorNameWords) {
        if (emailText.includes(word.toLowerCase())) {
          signals.push({
            type: 'ACTOR_MATCH',
            weight: WEIGHTS.ACTOR_MATCH,
            matched: `${actor.name} (${actor.role})`,
          });
          totalScore += WEIGHTS.ACTOR_MATCH;
          actorMatched = true;
          break;
        }
      }
      // Check actor organization
      if (!actorMatched && actor.organization) {
        const orgWords = this.extractSignificantWords(actor.organization);
        for (const word of orgWords) {
          if (emailText.includes(word.toLowerCase())) {
            signals.push({
              type: 'ACTOR_MATCH',
              weight: WEIGHTS.ACTOR_MATCH,
              matched: `${actor.organization} (${actor.role})`,
            });
            totalScore += WEIGHTS.ACTOR_MATCH;
            actorMatched = true;
            break;
          }
        }
      }
    }

    // Check explicit keywords in subject
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

    // Check explicit keywords in body
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
   * Extract significant words from text for matching
   * Filters out common Romanian/English stop words and short words
   */
  private extractSignificantWords(text: string): string[] {
    if (!text) return [];

    // Common stop words in Romanian and English to ignore
    const stopWords = new Set([
      // Romanian
      'si',
      'de',
      'la',
      'in',
      'cu',
      'pe',
      'din',
      'pentru',
      'sau',
      'ca',
      'nu',
      'ce',
      'este',
      'sunt',
      'fost',
      'fie',
      'sa',
      'se',
      'lui',
      'ei',
      'lor',
      'care',
      'acest',
      'aceasta',
      'prin',
      'spre',
      'fara',
      'sub',
      'despre',
      'dupa',
      'intre',
      'pana',
      // English
      'the',
      'and',
      'for',
      'with',
      'from',
      'that',
      'this',
      'are',
      'was',
      'were',
      'been',
      'being',
      'have',
      'has',
      'had',
      'will',
      'would',
      'could',
      'should',
      // Common legal terms that are too generic
      'srl',
      'sa',
      'pfa',
      'nr',
      'art',
      'lit',
      'alin',
      // Common suffixes/prefixes
      'co',
      'grup',
      'group',
      'inc',
      'ltd',
      'llc',
    ]);

    // Split text into words, remove punctuation except for specific patterns
    const words = text
      .replace(/[^\w\s-]/g, ' ') // Keep alphanumeric, spaces, and hyphens
      .split(/\s+/)
      .filter((word) => {
        const lowerWord = word.toLowerCase();
        return (
          word.length >= 3 && // At least 3 characters
          !stopWords.has(lowerWord) &&
          !/^\d+$/.test(word) // Not purely numeric
        );
      });

    return [...new Set(words)]; // Remove duplicates
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
          caseAssignments: [],
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
