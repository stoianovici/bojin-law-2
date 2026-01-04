/**
 * Email Classification Service
 * OPS-029: AI Email Classification Service
 *
 * Classifies emails to the correct case for clients with multiple active cases.
 * Uses a multi-stage algorithm:
 * 1. Global source detection (courts, authorities - skip actor matching)
 * 2. Reference number extraction and matching
 * 3. CaseActor email matching
 * 4. Keyword matching
 * 5. Semantic analysis fallback (AI-powered)
 */

import { AIOperationType, ClaudeModel, TaskComplexity } from '@legal-platform/types';
import { providerManager, ProviderRequest } from './provider-manager.service';
import { modelRouter } from './model-router.service';
import { tokenTracker } from './token-tracker.service';
import {
  extractReferences,
  matchReferences,
  getEmailDomain,
  matchesDomain,
  ExtractedReference,
} from '../utils/reference-extractor';

// ============================================================================
// Types
// ============================================================================

export type MatchType = 'actor' | 'reference' | 'keyword' | 'semantic' | 'none';

export interface EmailForClassification {
  id: string;
  subject: string;
  bodyPreview: string;
  bodyContent: string;
  from: { name?: string; address: string };
  receivedDateTime: Date;
}

export interface CaseForClassification {
  id: string;
  title: string;
  type: string;
  description: string;
  keywords: string[];
  referenceNumbers: string[];
  subjectPatterns: string[];
  classificationNotes: string | null;
}

export interface CaseActorForClassification {
  id: string;
  caseId: string;
  email: string | null;
  emailDomains: string[];
}

export interface GlobalEmailSourceForClassification {
  id: string;
  category: string;
  name: string;
  domains: string[];
  emails: string[];
  classificationHint: string | null;
}

export interface AlternativeCase {
  caseId: string;
  confidence: number;
  reason: string;
}

export interface ClassificationResult {
  emailId: string;
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
  /** True when confidence < 0.8 - assignment is suggested but not definitive */
  isSuggestedAssignment: boolean;
  /** True when sender is unknown (not matched to any actor or global source) */
  isUnknownSender: boolean;
}

export interface ClassificationContext {
  email: EmailForClassification;
  candidateCases: CaseForClassification[];
  globalSources: GlobalEmailSourceForClassification[];
  caseActors: Map<string, CaseActorForClassification[]>;
}

export interface ClassificationThresholds {
  autoAssign: number;
  needsReview: number;
  actorMatchWeight: number;
  referenceMatchWeight: number;
  keywordMatchWeight: number;
  semanticWeight: number;
}

export interface CaseClassificationSummary {
  caseId: string;
  emailCount: number;
  autoClassified: number;
  needsReview: number;
}

export interface BatchClassificationResult {
  totalEmails: number;
  classifications: ClassificationResult[];
  byCase: CaseClassificationSummary[];
  needsReview: number;
  unclassified: number;
  tokensUsed: number;
  processingTimeMs: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_THRESHOLDS: ClassificationThresholds = {
  autoAssign: 0.85,
  needsReview: 0.5,
  actorMatchWeight: 0.4,
  referenceMatchWeight: 0.3,
  keywordMatchWeight: 0.2,
  semanticWeight: 0.1,
};

const SEMANTIC_CLASSIFICATION_PROMPT = `You are classifying an email for a Romanian law firm.
The client has multiple active cases and we need to determine which case this email belongs to.

IMPORTANT: Răspunde în limba română. Toate explicațiile (reasoning) trebuie să fie în română.

EMAIL:
- From: {from}
- Subject: {subject}
- Preview: {preview}
- Date: {date}

CANDIDATE CASES FOR THIS CLIENT:

{cases}

TASK:
Determine which case this email most likely belongs to.
Consider subject matter, terminology, and any references mentioned.
If the email clearly doesn't belong to any case, set mostLikelyCaseIndex to -1.

OUTPUT (JSON only, no explanation):
{
  "mostLikelyCaseIndex": 0,
  "confidence": 0.75,
  "reasoning": "Brief explanation of why",
  "alternativeCase": {
    "caseIndex": 1,
    "confidence": 0.45,
    "reasoning": "Why this could also match"
  }
}

If no alternative makes sense, set alternativeCase to null.`;

// ============================================================================
// Email Classification Service
// ============================================================================

export class EmailClassificationService {
  private thresholds: ClassificationThresholds;

  constructor(thresholds?: Partial<ClassificationThresholds>) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * Classify a single email against candidate cases
   */
  async classifyEmail(
    context: ClassificationContext,
    userId: string,
    firmId: string
  ): Promise<ClassificationResult> {
    const { email, candidateCases, globalSources, caseActors } = context;

    // Initialize result
    const result: ClassificationResult = {
      emailId: email.id,
      suggestedCaseId: null,
      confidence: 0,
      reasons: [],
      alternativeCases: [],
      needsHumanReview: false,
      matchType: 'none',
      extractedReferences: [],
      isGlobalSource: false,
      isSuggestedAssignment: false,
      isUnknownSender: true, // Default to unknown, will be set to false if matched
    };

    // Single case - no classification needed
    if (candidateCases.length === 1) {
      result.suggestedCaseId = candidateCases[0].id;
      result.confidence = 1.0;
      result.reasons.push('Client has only one active case');
      result.matchType = 'actor';
      return result;
    }

    // No cases - cannot classify
    if (candidateCases.length === 0) {
      result.needsHumanReview = true;
      result.reviewReason = 'No active cases found for client';
      return result;
    }

    // Step 1: Check global sources
    const globalSource = this.matchGlobalSource(email.from.address, globalSources);
    if (globalSource) {
      result.isGlobalSource = true;
      result.globalSourceName = globalSource.name;
      result.isUnknownSender = false; // Known global source (court, authority, etc.)
      result.reasons.push(`Sender is a ${globalSource.category}: ${globalSource.name}`);
    }

    // Step 2: Extract references from email
    const emailText = `${email.subject} ${email.bodyPreview}`;
    result.extractedReferences = extractReferences(emailText);

    // Step 3: Score each case
    const caseScores = new Map<
      string,
      { score: number; reasons: string[]; matchType: MatchType }
    >();

    for (const caseItem of candidateCases) {
      const score = { score: 0, reasons: [] as string[], matchType: 'none' as MatchType };

      // 3a: Reference number matching (priority for global sources)
      const refMatches = matchReferences(result.extractedReferences, caseItem.referenceNumbers);
      if (refMatches.length > 0) {
        const refBoost = result.isGlobalSource ? 0.95 : this.thresholds.referenceMatchWeight;
        score.score += refBoost;
        score.reasons.push(
          `Reference number match: ${refMatches.map((r) => r.normalized).join(', ')}`
        );
        score.matchType = 'reference';
      }

      // 3b: CaseActor matching (skip for global sources)
      if (!result.isGlobalSource) {
        const actors = caseActors.get(caseItem.id) || [];
        const actorMatch = this.matchActors(email.from.address, actors);
        if (actorMatch) {
          score.score += this.thresholds.actorMatchWeight;
          score.reasons.push(`Sender matches case actor: ${actorMatch.email || 'domain match'}`);
          if (score.matchType === 'none') score.matchType = 'actor';
          // Mark sender as known (matched to a case actor)
          result.isUnknownSender = false;
        }
      }

      // 3c: Keyword matching
      const keywordMatches = this.matchKeywords(emailText, caseItem.keywords);
      if (keywordMatches.length > 0) {
        const keywordBoost = Math.min(
          keywordMatches.length * 0.1,
          this.thresholds.keywordMatchWeight
        );
        score.score += keywordBoost;
        score.reasons.push(`Keyword matches: ${keywordMatches.join(', ')}`);
        if (score.matchType === 'none') score.matchType = 'keyword';
      }

      // 3d: Subject pattern matching
      const patternMatch = this.matchSubjectPatterns(email.subject, caseItem.subjectPatterns);
      if (patternMatch) {
        score.score += 0.15;
        score.reasons.push(`Subject pattern match: ${patternMatch}`);
        if (score.matchType === 'none') score.matchType = 'keyword';
      }

      caseScores.set(caseItem.id, score);
    }

    // Step 4: Find best match
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

    // Step 5: Apply semantic analysis if needed
    if (bestScore < this.thresholds.needsReview && !result.isGlobalSource) {
      // Use AI for semantic classification
      const semanticResult = await this.classifyWithAI(email, candidateCases, userId, firmId);

      if (semanticResult) {
        const semanticBoost = semanticResult.confidence * this.thresholds.semanticWeight;

        if (semanticResult.suggestedCaseId) {
          const currentScore = caseScores.get(semanticResult.suggestedCaseId);
          if (currentScore) {
            currentScore.score += semanticBoost;
            currentScore.reasons.push(`AI semantic match: ${semanticResult.reasoning}`);
            currentScore.matchType = 'semantic';
          }

          // Re-evaluate best match
          if (currentScore && currentScore.score > bestScore) {
            secondBestCaseId = bestCaseId;
            secondBestScore = bestScore;
            bestCaseId = semanticResult.suggestedCaseId;
            bestScore = currentScore.score;
          }
        }
      }
    }

    // Step 6: Build final result
    if (bestCaseId) {
      const bestScoreData = caseScores.get(bestCaseId)!;
      result.suggestedCaseId = bestCaseId;
      result.confidence = Math.min(bestScore, 1.0);
      result.reasons = bestScoreData.reasons;
      result.matchType = bestScoreData.matchType;

      // Add alternative if close enough
      if (secondBestCaseId && secondBestScore >= this.thresholds.needsReview * 0.5) {
        const secondScoreData = caseScores.get(secondBestCaseId)!;
        result.alternativeCases.push({
          caseId: secondBestCaseId,
          confidence: secondBestScore,
          reason: secondScoreData.reasons.join('; '),
        });
      }
    }

    // Step 7: Set isSuggestedAssignment flag when confidence < 0.8
    // This indicates the assignment is a suggestion that may need verification
    if (result.confidence < 0.8) {
      result.isSuggestedAssignment = true;
    }

    // Step 8: Determine if human review is needed (NECLAR state)
    // Only truly unknown senders go to uncertain queue, not low confidence
    if (result.isGlobalSource && result.extractedReferences.length === 0) {
      // Court/authority email without reference number - needs manual case matching
      result.needsHumanReview = true;
      result.reviewReason = 'Email from court/authority but no reference number found';
    } else if (result.isUnknownSender && !result.suggestedCaseId) {
      // Unknown sender with no case match - uncertain queue
      result.needsHumanReview = true;
      result.reviewReason = 'Unknown sender - cannot determine case association';
    } else if (result.isUnknownSender && result.confidence < this.thresholds.needsReview) {
      // Unknown sender with very low confidence match - uncertain queue
      result.needsHumanReview = true;
      result.reviewReason = 'Unknown sender with low confidence classification';
    }
    // Note: Low confidence alone no longer triggers human review (removed confirmation blocking)
    // The isSuggestedAssignment flag is set instead for UI indication

    return result;
  }

  /**
   * Classify multiple emails in batch
   */
  async classifyBatch(
    emails: EmailForClassification[],
    candidateCases: CaseForClassification[],
    globalSources: GlobalEmailSourceForClassification[],
    caseActors: Map<string, CaseActorForClassification[]>,
    userId: string,
    firmId: string
  ): Promise<BatchClassificationResult> {
    const startTime = Date.now();
    const classifications: ClassificationResult[] = [];
    let totalTokensUsed = 0;

    // Process emails
    for (const email of emails) {
      const context: ClassificationContext = {
        email,
        candidateCases,
        globalSources,
        caseActors,
      };

      const result = await this.classifyEmail(context, userId, firmId);
      classifications.push(result);

      // Small delay to avoid rate limiting
      if (emails.length > 10) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    // Build summary by case
    const caseSummaryMap = new Map<string, CaseClassificationSummary>();
    for (const caseItem of candidateCases) {
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

    return {
      totalEmails: emails.length,
      classifications,
      byCase: Array.from(caseSummaryMap.values()),
      needsReview: needsReviewCount,
      unclassified: unclassifiedCount,
      tokensUsed: totalTokensUsed,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Check if sender matches a global email source
   */
  private matchGlobalSource(
    senderEmail: string,
    globalSources: GlobalEmailSourceForClassification[]
  ): GlobalEmailSourceForClassification | null {
    const senderLower = senderEmail.toLowerCase();
    const senderDomain = getEmailDomain(senderEmail);

    for (const source of globalSources) {
      // Check specific email addresses
      if (source.emails.some((e) => e.toLowerCase() === senderLower)) {
        return source;
      }

      // Check domains
      if (matchesDomain(senderEmail, source.domains)) {
        return source;
      }
    }

    return null;
  }

  /**
   * Match sender email against case actors
   */
  private matchActors(
    senderEmail: string,
    actors: CaseActorForClassification[]
  ): CaseActorForClassification | null {
    const senderLower = senderEmail.toLowerCase();

    for (const actor of actors) {
      // Exact email match
      if (actor.email && actor.email.toLowerCase() === senderLower) {
        return actor;
      }

      // Domain match
      if (actor.emailDomains.length > 0 && matchesDomain(senderEmail, actor.emailDomains)) {
        return actor;
      }
    }

    return null;
  }

  /**
   * Match email text against case keywords
   */
  private matchKeywords(text: string, keywords: string[]): string[] {
    if (keywords.length === 0) return [];

    const textLower = text.toLowerCase();
    const matches: string[] = [];

    for (const keyword of keywords) {
      // Support simple word matching (case-insensitive)
      const keywordLower = keyword.toLowerCase();
      if (textLower.includes(keywordLower)) {
        matches.push(keyword);
      }
    }

    return matches;
  }

  /**
   * Match subject against patterns (glob-style)
   */
  private matchSubjectPatterns(subject: string, patterns: string[]): string | null {
    if (patterns.length === 0) return null;

    const subjectLower = subject.toLowerCase();

    for (const pattern of patterns) {
      // Convert glob to regex
      const regexPattern = pattern
        .toLowerCase()
        .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special chars
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');

      try {
        if (new RegExp(regexPattern).test(subjectLower)) {
          return pattern;
        }
      } catch {
        // Invalid pattern, skip
      }
    }

    return null;
  }

  /**
   * Use AI for semantic classification when rule-based methods are inconclusive
   */
  private async classifyWithAI(
    email: EmailForClassification,
    cases: CaseForClassification[],
    userId: string,
    firmId: string
  ): Promise<{
    suggestedCaseId: string | null;
    confidence: number;
    reasoning: string;
    alternativeCase?: { caseId: string; confidence: number; reasoning: string };
  } | null> {
    try {
      // Build cases description
      const casesText = cases
        .map((c, index) => {
          return `Case ${index + 1}: ${c.title}
- Type: ${c.type}
- Description: ${c.description}
${c.keywords.length > 0 ? `- Keywords: ${c.keywords.join(', ')}` : ''}
${c.classificationNotes ? `- Classification notes: ${c.classificationNotes}` : ''}`;
        })
        .join('\n\n');

      // Build prompt
      const prompt = SEMANTIC_CLASSIFICATION_PROMPT.replace(
        '{from}',
        email.from.name || email.from.address
      )
        .replace('{subject}', email.subject)
        .replace('{preview}', email.bodyPreview.substring(0, 500))
        .replace('{date}', email.receivedDateTime.toISOString().split('T')[0])
        .replace('{cases}', casesText);

      // Route to appropriate model
      const routing = modelRouter.selectModel({
        operationType: AIOperationType.Classification,
        complexity: TaskComplexity.Standard,
      });

      const request: ProviderRequest = {
        systemPrompt:
          'You are an email classification assistant for a Romanian law firm. Output valid JSON only.',
        prompt,
        model: routing.model as ClaudeModel,
        maxTokens: 500,
        temperature: 0.2,
      };

      const response = await providerManager.execute(request);

      // Track token usage
      await tokenTracker.recordUsage({
        userId,
        firmId,
        operationType: AIOperationType.Classification,
        modelUsed: response.model,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        latencyMs: response.latencyMs,
      });

      // Parse response
      const parsed = this.parseAIResponse(response.content, cases);
      return parsed;
    } catch (error) {
      console.error('AI classification failed:', error);
      return null;
    }
  }

  /**
   * Parse AI classification response
   */
  private parseAIResponse(
    content: string,
    cases: CaseForClassification[]
  ): {
    suggestedCaseId: string | null;
    confidence: number;
    reasoning: string;
    alternativeCase?: { caseId: string; confidence: number; reasoning: string };
  } | null {
    try {
      // Extract JSON from response
      let jsonContent = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonContent);

      // Validate
      if (typeof parsed.mostLikelyCaseIndex !== 'number' || typeof parsed.confidence !== 'number') {
        return null;
      }

      // Map index to case ID
      const caseIndex = parsed.mostLikelyCaseIndex;
      const suggestedCaseId =
        caseIndex >= 0 && caseIndex < cases.length ? cases[caseIndex].id : null;

      const result: {
        suggestedCaseId: string | null;
        confidence: number;
        reasoning: string;
        alternativeCase?: { caseId: string; confidence: number; reasoning: string };
      } = {
        suggestedCaseId,
        confidence: Math.max(0, Math.min(1, parsed.confidence)),
        reasoning: parsed.reasoning || 'AI classification',
      };

      // Add alternative if present
      if (parsed.alternativeCase && typeof parsed.alternativeCase.caseIndex === 'number') {
        const altIndex = parsed.alternativeCase.caseIndex;
        if (altIndex >= 0 && altIndex < cases.length) {
          result.alternativeCase = {
            caseId: cases[altIndex].id,
            confidence: Math.max(0, Math.min(1, parsed.alternativeCase.confidence || 0)),
            reasoning: parsed.alternativeCase.reasoning || 'Alternative match',
          };
        }
      }

      return result;
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return null;
    }
  }
}

// Export singleton instance with default thresholds
export const emailClassification = new EmailClassificationService();
