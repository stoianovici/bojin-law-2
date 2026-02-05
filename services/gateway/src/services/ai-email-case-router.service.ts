/**
 * AI Email Case Router Service
 *
 * Routes emails to the correct case when a contact exists on multiple cases.
 * Uses Claude Haiku for efficient batch classification based on email content
 * and case context.
 *
 * Used by historical-email-sync to avoid linking all emails to all cases
 * when a contact (e.g., TT Solaria) exists on multiple cases.
 */

import { CaseActorRole } from '@prisma/client';
import { aiClient } from './ai-client.service';
import logger from '../utils/logger';
import { withRateLimit } from '../utils/rate-limiter';

// ============================================================================
// Types
// ============================================================================

export interface EmailRoutingInput {
  id: string; // Email ID in our database
  graphMessageId: string;
  subject: string;
  bodyPreview: string;
  from: { name?: string; address: string };
  toRecipients: Array<{ name?: string; address: string }>;
  receivedDateTime: Date;
}

export interface CaseCandidate {
  id: string;
  title: string;
  caseNumber: string | null;
  referenceNumbers: string[];
  keywords: string[];
  clientName: string;
  actors: Array<{
    name: string;
    organization: string | null;
    email: string | null;
    role: CaseActorRole;
  }>;
}

export interface RoutingMatch {
  caseId: string;
  confidence: number;
  reason: string;
}

export interface RoutingResult {
  emailId: string;
  matches: RoutingMatch[];
}

// ============================================================================
// Constants
// ============================================================================

const BATCH_SIZE = 15; // Emails per AI call for efficiency
const HAIKU_MODEL = 'claude-3-5-haiku-20241022';

// Confidence thresholds
const CONFIDENCE_THRESHOLDS = {
  PRIMARY: 0.7, // >= 0.7 = link with isPrimary=true
  LINK: 0.5, // 0.5-0.69 = link with isPrimary=false
  // < 0.5 = don't link
} as const;

// ============================================================================
// Reference Number Extraction
// ============================================================================

/**
 * Common Romanian court reference number patterns:
 * - 1234/30/2025 (most common: number/court/year)
 * - 46576/325/2025 (larger numbers)
 */
const REFERENCE_PATTERNS = [
  /\b(\d{1,6}\/\d{1,3}\/20\d{2})\b/g, // Standard court reference: 1234/30/2025
];

/**
 * Extract potential reference numbers from text.
 */
function extractReferenceNumbers(text: string): string[] {
  const refs = new Set<string>();
  for (const pattern of REFERENCE_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      refs.add(match[1]);
    }
  }
  return Array.from(refs);
}

// ============================================================================
// AI Email Case Router Service
// ============================================================================

export class AIEmailCaseRouterService {
  /**
   * Route a batch of emails to their most likely cases.
   *
   * Uses a two-phase approach:
   * 1. DETERMINISTIC: Match emails with reference numbers to cases directly
   * 2. AI: Use Claude Haiku for emails without clear reference matches
   *
   * @param emails - Emails to route (with content for analysis)
   * @param candidateCases - Possible cases this contact could belong to
   * @param firmId - Firm ID for AI usage logging
   * @param userId - Optional user ID for AI usage logging
   * @returns Routing results for each email
   */
  async routeEmailsToCases(
    emails: EmailRoutingInput[],
    candidateCases: CaseCandidate[],
    firmId: string,
    userId?: string
  ): Promise<RoutingResult[]> {
    if (emails.length === 0 || candidateCases.length === 0) {
      return [];
    }

    logger.info('[AIEmailCaseRouter] Starting routing', {
      emailCount: emails.length,
      caseCount: candidateCases.length,
      firmId,
    });

    // Build reference number -> case lookup
    const refToCaseMap = new Map<string, CaseCandidate>();
    for (const c of candidateCases) {
      for (const ref of c.referenceNumbers) {
        refToCaseMap.set(ref.toLowerCase(), c);
      }
    }

    const results: RoutingResult[] = [];
    const emailsNeedingAI: EmailRoutingInput[] = [];

    // Phase 1: Deterministic reference number matching
    for (const email of emails) {
      const textToSearch = `${email.subject} ${email.bodyPreview}`.toLowerCase();
      const extractedRefs = extractReferenceNumbers(textToSearch);

      let matched = false;
      for (const ref of extractedRefs) {
        const matchedCase = refToCaseMap.get(ref.toLowerCase());
        if (matchedCase) {
          results.push({
            emailId: email.id,
            matches: [
              {
                caseId: matchedCase.id,
                confidence: 0.95, // High confidence for exact reference match
                reason: `Reference number match: ${ref}`,
              },
            ],
          });
          matched = true;
          logger.debug('[AIEmailCaseRouter] Reference match found', {
            emailId: email.id,
            reference: ref,
            caseId: matchedCase.id,
            caseTitle: matchedCase.title,
          });
          break; // First match wins
        }
      }

      if (!matched) {
        emailsNeedingAI.push(email);
      }
    }

    logger.info('[AIEmailCaseRouter] Phase 1 complete', {
      totalEmails: emails.length,
      refMatched: results.length,
      needingAI: emailsNeedingAI.length,
    });

    // Phase 2: AI routing for emails without reference matches
    if (emailsNeedingAI.length > 0) {
      for (let i = 0; i < emailsNeedingAI.length; i += BATCH_SIZE) {
        const batch = emailsNeedingAI.slice(i, i + BATCH_SIZE);
        const batchResults = await this.routeBatchWithAI(batch, candidateCases, firmId, userId);
        results.push(...batchResults);

        logger.debug('[AIEmailCaseRouter] AI batch processed', {
          batchIndex: Math.floor(i / BATCH_SIZE),
          batchSize: batch.length,
          resultsCount: batchResults.length,
        });
      }
    }

    logger.info('[AIEmailCaseRouter] Routing complete', {
      emailCount: emails.length,
      resultsCount: results.length,
      refMatched: emails.length - emailsNeedingAI.length,
      aiRouted: emailsNeedingAI.length,
    });

    return results;
  }

  /**
   * Process a single batch of emails through AI.
   */
  private async routeBatchWithAI(
    emails: EmailRoutingInput[],
    candidateCases: CaseCandidate[],
    firmId: string,
    userId?: string
  ): Promise<RoutingResult[]> {
    const prompt = this.buildPrompt(emails, candidateCases);

    try {
      // Wrap AI call with rate limiting to prevent API throttling
      const response = await withRateLimit(() =>
        aiClient.complete(
          prompt,
          {
            feature: 'email_case_routing',
            firmId,
            userId,
            entityType: 'email_batch',
          },
          {
            model: HAIKU_MODEL,
            maxTokens: 2000, // Allow room for batch response
            temperature: 0.1, // Low temperature for consistent classification
          }
        )
      );

      const parsed = this.parseResponse(response.content, emails, candidateCases);

      logger.debug('[AIEmailCaseRouter] AI response parsed', {
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        costEur: response.costEur,
        resultsCount: parsed.length,
      });

      return parsed;
    } catch (error) {
      logger.error('[AIEmailCaseRouter] AI call failed', {
        error: error instanceof Error ? error.message : String(error),
        emailCount: emails.length,
      });

      // On error, return empty matches for all emails (will use fallback logic)
      return emails.map((email) => ({
        emailId: email.id,
        matches: [],
      }));
    }
  }

  /**
   * Build the AI prompt for email routing.
   */
  private buildPrompt(emails: EmailRoutingInput[], candidateCases: CaseCandidate[]): string {
    // Format emails
    const emailsSection = emails
      .map((email, idx) => {
        const recipients = email.toRecipients.map((r) => r.address).join(', ');
        return `=== Email ${idx + 1} (ID: ${email.id}) ===
From: ${email.from.name || ''} <${email.from.address}>
To: ${recipients}
Subject: ${email.subject}
Date: ${email.receivedDateTime.toISOString().split('T')[0]}
Body Preview: ${email.bodyPreview.substring(0, 500)}`;
      })
      .join('\n\n');

    // Format cases
    const casesSection = candidateCases
      .map((c, idx) => {
        const actorsSummary = c.actors
          .map((a) => {
            const parts = [a.name];
            if (a.organization) parts.push(`(${a.organization})`);
            if (a.email) parts.push(`<${a.email}>`);
            return `  - ${parts.join(' ')} [${a.role}]`;
          })
          .join('\n');

        return `=== Case ${idx + 1} (ID: ${c.id}) ===
Title: ${c.title}
Client: ${c.clientName}
${c.caseNumber ? `Case Number: ${c.caseNumber}` : ''}
${c.referenceNumbers.length > 0 ? `Reference Numbers: ${c.referenceNumbers.join(', ')}` : ''}
${c.keywords.length > 0 ? `Keywords: ${c.keywords.join(', ')}` : ''}
Actors:
${actorsSummary || '  (no actors)'}`;
      })
      .join('\n\n');

    return `You are a legal email routing assistant for a Romanian law firm.
Your task is to determine which case(s) each email belongs to based on content analysis.

## EMAILS

${emailsSection}

## CANDIDATE CASES

${casesSection}

## INSTRUCTIONS

For each email, analyze its content and determine which case(s) it most likely belongs to.
Consider these factors in order of importance:

1. **Reference Numbers**: Direct mentions of case reference numbers (e.g., "1234/56/2024", "Dosar nr. X")
2. **Keywords**: Legal terms, project names, or matter-specific terminology matching case keywords
3. **Actors**: Mentions of party names, organizations, or individuals from case actors
4. **Context**: Overall semantic relevance to case subject matter

## CONFIDENCE SCORING

- 0.9-1.0: Reference number match or explicit case mention
- 0.7-0.89: Clear keyword/actor match with supporting context
- 0.5-0.69: Partial match or contextual relevance
- Below 0.5: Weak or uncertain connection (don't include)

## OUTPUT FORMAT

Return a JSON array with one object per email. Only include matches with confidence >= 0.5.
If no case matches with sufficient confidence, return an empty matches array.

\`\`\`json
[
  {
    "emailId": "email-uuid",
    "matches": [
      { "caseId": "case-uuid", "confidence": 0.85, "reason": "Brief explanation" }
    ]
  }
]
\`\`\`

Return ONLY the JSON array, no other text.`;
  }

  /**
   * Parse the AI response and validate against known emails/cases.
   */
  private parseResponse(
    content: string,
    emails: EmailRoutingInput[],
    candidateCases: CaseCandidate[]
  ): RoutingResult[] {
    const emailIds = new Set(emails.map((e) => e.id));
    const caseIds = new Set(candidateCases.map((c) => c.id));

    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        logger.warn('[AIEmailCaseRouter] No JSON array found in response');
        return emails.map((e) => ({ emailId: e.id, matches: [] }));
      }

      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        emailId: string;
        matches: Array<{ caseId: string; confidence: number; reason: string }>;
      }>;

      // Validate and filter results
      const results: RoutingResult[] = [];

      for (const item of parsed) {
        if (!emailIds.has(item.emailId)) {
          logger.warn('[AIEmailCaseRouter] Unknown emailId in response', {
            emailId: item.emailId,
          });
          continue;
        }

        const validMatches: RoutingMatch[] = [];
        for (const match of item.matches || []) {
          if (!caseIds.has(match.caseId)) {
            logger.warn('[AIEmailCaseRouter] Unknown caseId in response', {
              caseId: match.caseId,
            });
            continue;
          }

          // Only include matches meeting minimum threshold
          const confidence = Math.min(1, Math.max(0, match.confidence));
          if (confidence >= CONFIDENCE_THRESHOLDS.LINK) {
            validMatches.push({
              caseId: match.caseId,
              confidence,
              reason: match.reason || 'AI classification',
            });
          }
        }

        // Sort by confidence descending
        validMatches.sort((a, b) => b.confidence - a.confidence);

        results.push({
          emailId: item.emailId,
          matches: validMatches,
        });
      }

      // Add empty results for any emails not in response
      for (const email of emails) {
        if (!results.find((r) => r.emailId === email.id)) {
          results.push({ emailId: email.id, matches: [] });
        }
      }

      return results;
    } catch (error) {
      logger.error('[AIEmailCaseRouter] Failed to parse AI response', {
        error: error instanceof Error ? error.message : String(error),
        contentPreview: content.substring(0, 200),
      });

      // Return empty results on parse failure
      return emails.map((e) => ({ emailId: e.id, matches: [] }));
    }
  }

  /**
   * Determine if a match should be marked as primary.
   */
  static isPrimaryMatch(confidence: number): boolean {
    return confidence >= CONFIDENCE_THRESHOLDS.PRIMARY;
  }

  /**
   * Check if confidence meets the minimum linking threshold.
   */
  static meetsLinkThreshold(confidence: number): boolean {
    return confidence >= CONFIDENCE_THRESHOLDS.LINK;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let instance: AIEmailCaseRouterService | null = null;

export function getAIEmailCaseRouterService(): AIEmailCaseRouterService {
  if (!instance) {
    instance = new AIEmailCaseRouterService();
  }
  return instance;
}
