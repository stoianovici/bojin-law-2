/**
 * AI Email Classifier Service
 *
 * Multi-phase email classification pipeline:
 * - Phase 1: Fast rules
 *   - 1a. Reference number match
 *   - 1b. Court source check
 *   - 1c. Case actor email exact match
 *   - 1d. Client contact match (contacts, administrators, contactInfo)
 * - Phase 2: Actor domain matching
 * - Phase 3: AI classification using Claude Haiku
 *
 * Uses the unified context system for building case context.
 */

import { prisma } from '@legal-platform/database';
import { EmailClassificationState, CaseStatus, GlobalEmailSourceCategory } from '@prisma/client';
import logger from '../utils/logger';
import { withRateLimit } from '../utils/rate-limiter';
import { extractDomain } from '../utils/email.util';
import { extractReferences, matchesCase } from './reference-extractor';
import { aiClient } from './ai-client.service';
import { ContextAggregatorService } from './context-aggregator.service';
import { contactMatcherService } from './contact-matcher';

// ============================================================================
// Types
// ============================================================================

export interface EmailForAIClassification {
  id: string;
  subject: string;
  bodyPreview: string;
  bodyContent?: string;
  from: { name?: string; address: string };
  toRecipients: Array<{ name?: string; address: string }>;
  ccRecipients?: Array<{ name?: string; address: string }>;
  receivedDateTime: Date;
}

export interface AIClassificationResult {
  state: EmailClassificationState;
  caseId: string | null;
  clientId: string | null;
  confidence: number;
  reason: string;
  classifiedBy: string;
  aiCost: number | null;
}

interface CaseCandidate {
  id: string;
  title: string;
  caseNumber: string | null;
  referenceNumbers: string[];
  clientId: string;
  clientName: string;
}

// ============================================================================
// Constants
// ============================================================================

const CONFIDENCE = {
  REFERENCE_MATCH: 1.0,
  COURT_SOURCE: 1.0,
  ACTOR_EMAIL: 0.95,
  CLIENT_CONTACT: 0.9, // Client contacts/administrators/contactInfo
  ACTOR_DOMAIN: 0.85,
  AI_HIGH: 0.8, // Threshold for Classified
  AI_MEDIUM: 0.5, // Threshold for ClientInbox
} as const;

const HAIKU_MODEL = 'claude-3-5-haiku-20241022';

// ============================================================================
// AI Email Classifier Service
// ============================================================================

export class AIEmailClassifierService {
  private contextAggregator = new ContextAggregatorService();

  /**
   * Classify an email using the three-phase pipeline.
   */
  async classify(
    email: EmailForAIClassification,
    firmId: string,
    userId?: string
  ): Promise<AIClassificationResult> {
    const senderAddress = email.from.address.toLowerCase();
    const senderDomain = extractDomain(senderAddress);

    logger.debug('AI classifier: starting classification', {
      emailId: email.id,
      subject: email.subject.substring(0, 50),
      sender: senderAddress,
    });

    // ========================================================================
    // Phase 1: Fast Rules
    // ========================================================================

    // 1a. Reference number match
    const referenceResult = await this.checkReferenceMatch(email, firmId);
    if (referenceResult) {
      logger.info('AI classifier: reference match', {
        emailId: email.id,
        caseId: referenceResult.caseId,
      });
      return referenceResult;
    }

    // 1b. Court source check
    const courtResult = await this.checkCourtSource(senderAddress, senderDomain, firmId);
    if (courtResult) {
      logger.info('AI classifier: court source', { emailId: email.id });
      return courtResult;
    }

    // 1c. Actor email exact match
    const actorEmailResult = await this.checkActorEmailMatch(senderAddress, firmId);
    if (actorEmailResult) {
      logger.info('AI classifier: actor email match', {
        emailId: email.id,
        caseId: actorEmailResult.caseId,
      });
      return actorEmailResult;
    }

    // 1d. Client contact match (contacts, administrators, contactInfo)
    const clientContactResult = await this.checkClientContactMatch(senderAddress, firmId);
    if (clientContactResult) {
      logger.info('AI classifier: client contact match', {
        emailId: email.id,
        state: clientContactResult.state,
        caseId: clientContactResult.caseId,
        clientId: clientContactResult.clientId,
      });
      return clientContactResult;
    }

    // ========================================================================
    // Phase 2: Actor Domain Match
    // ========================================================================

    if (senderDomain) {
      const domainResult = await this.checkActorDomainMatch(senderDomain, firmId);
      if (domainResult) {
        logger.info('AI classifier: actor domain match', {
          emailId: email.id,
          caseId: domainResult.caseId,
        });
        return domainResult;
      }
    }

    // ========================================================================
    // Phase 3: AI Classification
    // ========================================================================

    const aiResult = await this.classifyWithAI(email, firmId, userId);
    logger.info('AI classifier: AI classification', {
      emailId: email.id,
      state: aiResult.state,
      caseId: aiResult.caseId,
      confidence: aiResult.confidence,
    });

    return aiResult;
  }

  // ============================================================================
  // Phase 1: Fast Rules
  // ============================================================================

  /**
   * Check if email contains reference numbers that match a case.
   */
  private async checkReferenceMatch(
    email: EmailForAIClassification,
    firmId: string
  ): Promise<AIClassificationResult | null> {
    const references = extractReferences(
      email.subject,
      email.bodyPreview || email.bodyContent || ''
    );
    if (references.length === 0) return null;

    const referenceValues = references.map((r) => r.value);

    // Get active cases with reference numbers
    const cases = await prisma.case.findMany({
      where: {
        firmId,
        status: { in: [CaseStatus.Active, CaseStatus.OnHold] },
        referenceNumbers: { isEmpty: false },
      },
      select: {
        id: true,
        title: true,
        caseNumber: true,
        referenceNumbers: true,
        clientId: true,
      },
    });

    for (const caseData of cases) {
      if (matchesCase(referenceValues, caseData.referenceNumbers)) {
        return {
          state: EmailClassificationState.Classified,
          caseId: caseData.id,
          clientId: caseData.clientId,
          confidence: CONFIDENCE.REFERENCE_MATCH,
          reason: `Matched reference number: ${referenceValues[0]}`,
          classifiedBy: 'rule:reference',
          aiCost: null,
        };
      }
    }

    return null;
  }

  /**
   * Check if sender is a known court source.
   */
  private async checkCourtSource(
    senderEmail: string,
    senderDomain: string | null,
    firmId: string
  ): Promise<AIClassificationResult | null> {
    const courtSource = await prisma.globalEmailSource.findFirst({
      where: {
        firmId,
        category: GlobalEmailSourceCategory.Court,
        OR: [
          { emails: { has: senderEmail } },
          ...(senderDomain ? [{ domains: { has: senderDomain } }] : []),
        ],
      },
    });

    if (courtSource) {
      return {
        state: EmailClassificationState.CourtUnassigned,
        caseId: null,
        clientId: null,
        confidence: CONFIDENCE.COURT_SOURCE,
        reason: `Court email from ${courtSource.name}, no matching reference number`,
        classifiedBy: 'rule:court',
        aiCost: null,
      };
    }

    return null;
  }

  /**
   * Check if sender email exactly matches a case actor's email.
   */
  private async checkActorEmailMatch(
    senderEmail: string,
    firmId: string
  ): Promise<AIClassificationResult | null> {
    const actor = await prisma.caseActor.findFirst({
      where: {
        email: { equals: senderEmail, mode: 'insensitive' },
        case: {
          firmId,
          status: { in: [CaseStatus.Active, CaseStatus.OnHold] },
        },
      },
      include: {
        case: {
          select: {
            id: true,
            title: true,
            clientId: true,
          },
        },
      },
    });

    if (actor) {
      return {
        state: EmailClassificationState.Classified,
        caseId: actor.case.id,
        clientId: actor.case.clientId,
        confidence: CONFIDENCE.ACTOR_EMAIL,
        reason: `Sender matches actor "${actor.name}" (${actor.email})`,
        classifiedBy: 'rule:actor_email',
        aiCost: null,
      };
    }

    return null;
  }

  /**
   * Check if sender email matches any client contact, administrator, or contactInfo.
   * Uses ContactMatcherService which checks:
   * - Client.contactInfo.email
   * - Client.contacts[].email
   * - Client.administrators[].email
   */
  private async checkClientContactMatch(
    senderEmail: string,
    firmId: string
  ): Promise<AIClassificationResult | null> {
    const contactMatch = await contactMatcherService.findContactMatch(senderEmail, firmId);

    if (contactMatch.certainty === 'NONE') {
      return null;
    }

    // HIGH certainty = single active case match -> Classified
    if (contactMatch.certainty === 'HIGH' && contactMatch.caseId) {
      return {
        state: EmailClassificationState.Classified,
        caseId: contactMatch.caseId,
        clientId: contactMatch.clientId,
        confidence: CONFIDENCE.CLIENT_CONTACT,
        reason: `Sender matches client contact for "${contactMatch.clientName}" (case ${contactMatch.caseNumber || contactMatch.caseId})`,
        classifiedBy: 'rule:client_contact',
        aiCost: null,
      };
    }

    // LOW certainty = known client, multiple cases or no active cases -> ClientInbox
    if (contactMatch.certainty === 'LOW' && contactMatch.clientId) {
      return {
        state: EmailClassificationState.ClientInbox,
        caseId: null,
        clientId: contactMatch.clientId,
        confidence: CONFIDENCE.CLIENT_CONTACT,
        reason: `Sender matches client contact for "${contactMatch.clientName}" (multiple cases or no active case)`,
        classifiedBy: 'rule:client_contact',
        aiCost: null,
      };
    }

    return null;
  }

  // ============================================================================
  // Phase 2: Actor Domain Match
  // ============================================================================

  /**
   * Check if sender domain matches any case actor's email domains.
   * Only returns a result if there's exactly one matching case.
   */
  private async checkActorDomainMatch(
    senderDomain: string,
    firmId: string
  ): Promise<AIClassificationResult | null> {
    const actors = await prisma.caseActor.findMany({
      where: {
        emailDomains: { has: senderDomain },
        case: {
          firmId,
          status: { in: [CaseStatus.Active, CaseStatus.OnHold] },
        },
      },
      include: {
        case: {
          select: {
            id: true,
            title: true,
            clientId: true,
          },
        },
      },
    });

    if (actors.length === 0) return null;

    // Get unique cases
    const uniqueCases = new Map<string, (typeof actors)[0]['case']>();
    for (const actor of actors) {
      uniqueCases.set(actor.case.id, actor.case);
    }

    // Only classify if single case matches
    if (uniqueCases.size === 1) {
      const matchedActor = actors[0];
      return {
        state: EmailClassificationState.Classified,
        caseId: matchedActor.case.id,
        clientId: matchedActor.case.clientId,
        confidence: CONFIDENCE.ACTOR_DOMAIN,
        reason: `Sender domain @${senderDomain} matches actor "${matchedActor.name}"`,
        classifiedBy: 'rule:actor_domain',
        aiCost: null,
      };
    }

    // Multiple cases match - continue to AI
    logger.debug('AI classifier: multiple domain matches, continuing to AI', {
      domain: senderDomain,
      caseCount: uniqueCases.size,
    });

    return null;
  }

  // ============================================================================
  // Phase 3: AI Classification
  // ============================================================================

  /**
   * Use AI to classify the email when rules don't match.
   */
  private async classifyWithAI(
    email: EmailForAIClassification,
    firmId: string,
    userId?: string
  ): Promise<AIClassificationResult> {
    // Get active cases for context using smart pre-filtering
    const senderAddress = email.from.address.toLowerCase();
    const senderDomain = extractDomain(senderAddress);
    const cases = await this.getActiveCasesWithContext(firmId, senderAddress, senderDomain);

    if (cases.length === 0) {
      return {
        state: EmailClassificationState.Uncertain,
        caseId: null,
        clientId: null,
        confidence: 0,
        reason: 'No active cases to classify against',
        classifiedBy: 'ai:haiku',
        aiCost: null,
      };
    }

    // Build context for each case (limited to 20)
    const casesToAnalyze = cases.slice(0, 20);
    const caseContexts = await this.buildCaseContextsForAI(casesToAnalyze);

    // Build the classification prompt
    const prompt = this.buildClassificationPrompt(email, caseContexts);

    try {
      // Wrap AI call with rate limiting to prevent API throttling
      const response = await withRateLimit(() =>
        aiClient.complete(
          prompt,
          {
            feature: 'email_classification',
            firmId,
            userId,
            entityType: 'email',
            entityId: email.id,
          },
          {
            model: HAIKU_MODEL,
            maxTokens: 500,
          }
        )
      );

      // Parse AI response
      const result = this.parseAIResponse(response.content, cases);

      // Calculate cost in USD (Haiku: $1/1M input, $5/1M output)
      const costUsd = response.inputTokens / 1_000_000 + (response.outputTokens * 5) / 1_000_000;

      return {
        ...result,
        classifiedBy: 'ai:haiku',
        aiCost: costUsd,
      };
    } catch (error) {
      logger.error('AI classifier: AI call failed', { error, emailId: email.id });

      return {
        state: EmailClassificationState.Uncertain,
        caseId: null,
        clientId: null,
        confidence: 0,
        reason: 'AI classification failed, needs manual review',
        classifiedBy: 'ai:haiku',
        aiCost: null,
      };
    }
  }

  /**
   * Get active cases with basic info for classification.
   *
   * Uses smart pre-filtering to prioritize cases where the sender is a known contact:
   * 1. First, find cases where sender is an actor (exact email or domain match)
   * 2. Then, find cases where sender is a client contact
   * 3. If we have enough relevant cases (5-30), use those
   * 4. Otherwise, supplement with recently active cases up to 30 total
   *
   * This improves AI classification accuracy by providing more relevant context.
   */
  private async getActiveCasesWithContext(
    firmId: string,
    senderEmail: string,
    senderDomain: string | null
  ): Promise<CaseCandidate[]> {
    // Step 1: Get cases where sender is a known contact/actor (highest relevance)
    const contactCases = await this.getCasesForContact(firmId, senderEmail, senderDomain);

    logger.debug('AI classifier: contact cases found', {
      senderEmail,
      senderDomain,
      contactCaseCount: contactCases.length,
    });

    // Step 2: If we have between 5 and 30 contact matches, use those
    if (contactCases.length >= 5 && contactCases.length <= 30) {
      return contactCases;
    }

    // Step 3: If we have more than 30, take the most recently updated
    if (contactCases.length > 30) {
      return contactCases.slice(0, 30);
    }

    // Step 4: Supplement with recently active cases to fill up to 30 total
    const contactCaseIds = new Set(contactCases.map((c) => c.id));
    const remainingSlots = Math.max(0, 30 - contactCases.length);

    const recentCases = await prisma.case.findMany({
      where: {
        firmId,
        status: { in: [CaseStatus.Active, CaseStatus.OnHold] },
        id: { notIn: Array.from(contactCaseIds) },
      },
      select: {
        id: true,
        title: true,
        caseNumber: true,
        referenceNumbers: true,
        clientId: true,
        client: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: remainingSlots,
    });

    const recentCasesMapped = recentCases.map((c) => ({
      id: c.id,
      title: c.title,
      caseNumber: c.caseNumber,
      referenceNumbers: c.referenceNumbers,
      clientId: c.clientId,
      clientName: c.client.name,
    }));

    // Contact cases first (higher relevance), then recent cases
    return [...contactCases, ...recentCasesMapped];
  }

  /**
   * Find cases where the sender is a known contact or actor.
   */
  private async getCasesForContact(
    firmId: string,
    email: string,
    domain: string | null
  ): Promise<CaseCandidate[]> {
    // Build OR conditions for finding cases
    const orConditions: Array<Record<string, unknown>> = [
      // Actor with exact email match
      { actors: { some: { email: { equals: email, mode: 'insensitive' } } } },
    ];

    // Actor with domain match
    if (domain) {
      orConditions.push({ actors: { some: { emailDomains: { has: domain } } } });
    }

    const cases = await prisma.case.findMany({
      where: {
        firmId,
        status: { in: [CaseStatus.Active, CaseStatus.OnHold] },
        OR: orConditions,
      },
      select: {
        id: true,
        title: true,
        caseNumber: true,
        referenceNumbers: true,
        clientId: true,
        updatedAt: true,
        client: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return cases.map((c) => ({
      id: c.id,
      title: c.title,
      caseNumber: c.caseNumber,
      referenceNumbers: c.referenceNumbers,
      clientId: c.clientId,
      clientName: c.client.name,
    }));
  }

  /**
   * Build concise context for each case for AI classification.
   */
  private async buildCaseContextsForAI(
    cases: CaseCandidate[]
  ): Promise<Array<{ caseId: string; context: string }>> {
    const contexts: Array<{ caseId: string; context: string }> = [];

    for (const caseData of cases) {
      try {
        // Get actors for this case
        const actors = await prisma.caseActor.findMany({
          where: { caseId: caseData.id },
          select: {
            name: true,
            email: true,
            emailDomains: true,
            organization: true,
            role: true,
          },
        });

        // Build concise context
        const actorSummary = actors
          .map((a) => {
            const parts = [a.name];
            if (a.organization) parts.push(`(${a.organization})`);
            if (a.email) parts.push(`<${a.email}>`);
            if (a.emailDomains.length > 0) parts.push(`[@${a.emailDomains.join(', @')}]`);
            return `- ${parts.join(' ')} [${a.role}]`;
          })
          .join('\n');

        const context = [
          `## Case: ${caseData.title}`,
          `Client: ${caseData.clientName}`,
          caseData.caseNumber ? `Case #: ${caseData.caseNumber}` : null,
          caseData.referenceNumbers.length > 0
            ? `References: ${caseData.referenceNumbers.join(', ')}`
            : null,
          actors.length > 0 ? `\nActors:\n${actorSummary}` : null,
        ]
          .filter(Boolean)
          .join('\n');

        contexts.push({ caseId: caseData.id, context });
      } catch (error) {
        logger.warn('AI classifier: failed to build context for case', {
          caseId: caseData.id,
          error,
        });
      }
    }

    return contexts;
  }

  /**
   * Build the classification prompt for AI.
   */
  private buildClassificationPrompt(
    email: EmailForAIClassification,
    caseContexts: Array<{ caseId: string; context: string }>
  ): string {
    const emailSummary = [
      `From: ${email.from.name || ''} <${email.from.address}>`,
      `To: ${email.toRecipients.map((r) => r.address).join(', ')}`,
      email.ccRecipients?.length
        ? `CC: ${email.ccRecipients.map((r) => r.address).join(', ')}`
        : null,
      `Subject: ${email.subject}`,
      `Date: ${email.receivedDateTime.toISOString()}`,
      '',
      'Body:',
      (email.bodyPreview || email.bodyContent || '').substring(0, 2000),
    ]
      .filter((line) => line !== null)
      .join('\n');

    const casesContext = caseContexts.map((c) => c.context).join('\n\n---\n\n');

    return `You are an email classification assistant for a Romanian law firm. Your task is to determine which legal case an email belongs to.

## Email to classify

${emailSummary}

## Active cases

${casesContext}

## Instructions

Analyze the email and determine which case it most likely belongs to. Consider:
1. Sender email/domain matching case actors
2. Subject line mentions of case names, client names, or legal matters
3. Body content references to parties, matters, or proceedings
4. Overall context and relevance

Respond in JSON format:
{
  "caseId": "case-uuid-here or null if no match",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this case matches or why no case matches"
}

If you're not confident about the match (confidence < 0.5), set caseId to null.
Only return the JSON object, no other text.`;
  }

  /**
   * Parse the AI response and map to classification result.
   */
  private parseAIResponse(
    content: string,
    cases: CaseCandidate[]
  ): Omit<AIClassificationResult, 'classifiedBy' | 'aiCost'> {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        caseId: string | null;
        confidence: number;
        reasoning: string;
      };

      // Validate caseId exists if provided
      if (parsed.caseId) {
        const matchedCase = cases.find((c) => c.id === parsed.caseId);
        if (!matchedCase) {
          logger.warn('AI classifier: AI returned invalid caseId', { caseId: parsed.caseId });
          return {
            state: EmailClassificationState.Uncertain,
            caseId: null,
            clientId: null,
            confidence: 0,
            reason: 'AI returned invalid case ID',
          };
        }

        // Map confidence to state
        const confidence = Math.min(1, Math.max(0, parsed.confidence));
        let state: EmailClassificationState;

        if (confidence >= CONFIDENCE.AI_HIGH) {
          state = EmailClassificationState.Classified;
        } else if (confidence >= CONFIDENCE.AI_MEDIUM) {
          state = EmailClassificationState.ClientInbox;
        } else {
          state = EmailClassificationState.Uncertain;
        }

        return {
          state,
          caseId: state === EmailClassificationState.Classified ? parsed.caseId : null,
          clientId:
            state === EmailClassificationState.Classified
              ? matchedCase.clientId
              : matchedCase.clientId,
          confidence,
          reason: `AI: ${parsed.reasoning}`,
        };
      }

      // No case match
      return {
        state: EmailClassificationState.Uncertain,
        caseId: null,
        clientId: null,
        confidence: parsed.confidence || 0,
        reason: `AI: ${parsed.reasoning || 'No matching case found'}`,
      };
    } catch (error) {
      logger.error('AI classifier: failed to parse AI response', { content, error });
      return {
        state: EmailClassificationState.Uncertain,
        caseId: null,
        clientId: null,
        confidence: 0,
        reason: 'Failed to parse AI response',
      };
    }
  }
}

// Export singleton
export const aiEmailClassifier = new AIEmailClassifierService();
